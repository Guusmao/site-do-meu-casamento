// supabase/functions/confirmar-presenca/index.ts
// Recebe { grupo_id, nomes: [{nome, vai}], whatsapp? }
// Valida contra a lista fechada, grava a confirmação, gera o token
// assinado do QR Code e chama a função enviar-ingresso (WhatsApp).
// O ingresso vai para o número digitado ou, se vier vazio, para o
// número do grupo cadastrado na lista de convidados.

import { createClient } from "npm:@supabase/supabase-js@2";
import { assinarToken } from "../_shared/qrToken.ts";
import { normalizarTelefone } from "../_shared/whatsapp.ts";

// Disponível no runtime das Edge Functions: mantém a tarefa viva depois da resposta
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { grupo_id, nomes, whatsapp: whatsappDigitado } = await req.json();

    if (!grupo_id || !Array.isArray(nomes) || nomes.length === 0) {
      return new Response(JSON.stringify({ error: "Dados incompletos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Confere se o grupo existe e pega a quantidade máxima permitida
    const { data: grupo, error: erroGrupo } = await supabase
      .from("convidados_lista")
      .select("id, responsavel, quantidade_maxima, whatsapp")
      .eq("id", grupo_id)
      .single();

    if (erroGrupo || !grupo) {
      return new Response(JSON.stringify({ error: "Grupo não encontrado na lista de convidados." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Regra de ouro: nunca pode confirmar mais gente do que o permitido
    const quantosVao = nomes.filter((n: any) => n.vai === true).length;
    if (nomes.length > grupo.quantidade_maxima || quantosVao > grupo.quantidade_maxima) {
      return new Response(
        JSON.stringify({ error: `Este grupo tem no máximo ${grupo.quantidade_maxima} convidados.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Para onde vai o ingresso: número digitado ou o do grupo na lista
    let whatsapp = grupo.whatsapp as string | null;
    if (whatsappDigitado) {
      whatsapp = normalizarTelefone(whatsappDigitado);
      if (!whatsapp) {
        return new Response(JSON.stringify({ error: "WhatsApp inválido. Digite com DDD, ex: (11) 98765-4321." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (!whatsapp && quantosVao > 0) {
      return new Response(JSON.stringify({ error: "Digite seu WhatsApp para receber o convite." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Cria/atualiza a confirmação (upsert por grupo_id, só 1 confirmação por grupo)
    const { data: confirmacao, error: erroUpsert } = await supabase
      .from("confirmacoes")
      .upsert(
        {
          grupo_id,
          whatsapp,
          nomes_confirmados: nomes,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "grupo_id" }
      )
      .select()
      .single();

    if (erroUpsert) throw erroUpsert;

    // 5) Gera o token assinado do QR (só entra quem vier com vai:true)
    const qrSecret = Deno.env.get("QR_SECRET")!;
    const nomesVao = nomes.filter((n: any) => n.vai).map((n: any) => n.nome);

    const token = await assinarToken(
      {
        confirmacao_id: confirmacao.id,
        grupo_id,
        nomes: nomesVao,
        v: 1,
      },
      qrSecret
    );

    await supabase
      .from("confirmacoes")
      .update({ qr_token: token })
      .eq("id", confirmacao.id);

    // 6) Dispara o envio do ingresso pelo WhatsApp em segundo plano
    // (a resposta ao site não espera, e uma falha no envio não desfaz a confirmação)
    const enviarUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/enviar-ingresso`;
    const envio = fetch(enviarUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ confirmacao_id: confirmacao.id }),
    }).catch((e) => console.error("Falha ao chamar enviar-ingresso:", e));
    EdgeRuntime.waitUntil(envio);

    return new Response(
      JSON.stringify({
        ok: true,
        responsavel: grupo.responsavel,
        nomes_confirmados: nomesVao,
        whatsapp_final: whatsapp ? whatsapp.slice(-4) : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
