// supabase/functions/confirmar-presenca/index.ts
// Recebe { grupo_id, email, nomes: [{nome, vai}] }
// Valida contra a lista fechada, grava a confirmação, gera o token
// assinado do QR Code e chama a função enviar-ingresso.

import { createClient } from "npm:@supabase/supabase-js@2";
import { assinarToken } from "../_shared/qrToken.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { grupo_id, email, nomes } = await req.json();

    if (!grupo_id || !email || !Array.isArray(nomes) || nomes.length === 0) {
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
      .select("id, responsavel, quantidade_maxima")
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

    // 3) Cria/atualiza a confirmação (upsert por grupo_id, só 1 confirmação por grupo)
    const { data: confirmacao, error: erroUpsert } = await supabase
      .from("confirmacoes")
      .upsert(
        {
          grupo_id,
          email,
          nomes_confirmados: nomes,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "grupo_id" }
      )
      .select()
      .single();

    if (erroUpsert) throw erroUpsert;

    // 4) Gera o token assinado do QR (só entra quem vier com vai:true)
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

    // 5) Dispara o envio do email com o ingresso (não bloqueia a resposta em caso de falha)
    const enviarUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/enviar-ingresso`;
    fetch(enviarUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ confirmacao_id: confirmacao.id }),
    }).catch((e) => console.error("Falha ao chamar enviar-ingresso:", e));

    return new Response(
      JSON.stringify({ ok: true, responsavel: grupo.responsavel, nomes_confirmados: nomesVao }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
