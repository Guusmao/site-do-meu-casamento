// supabase/functions/validar-checkin/index.ts
// Recebe { token, senha_portaria, nome? }
// - Sem "nome": só valida o token e devolve os nomes do grupo (pra portaria escolher quem chegou).
// - Com "nome": registra o check-in daquela pessoa específica (evita reuso).

import { createClient } from "npm:@supabase/supabase-js@2";
import { verificarToken } from "../_shared/qrToken.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token, senha_portaria, nome } = await req.json();

    // Senha simples da portaria (evita que a página fique aberta pra qualquer um usar)
    if (senha_portaria !== Deno.env.get("PORTARIA_SENHA")) {
      return new Response(JSON.stringify({ error: "Senha da portaria inválida." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qrSecret = Deno.env.get("QR_SECRET")!;
    const { valido, payload } = await verificarToken(token, qrSecret);

    if (!valido) {
      return new Response(JSON.stringify({ error: "QR Code inválido ou adulterado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: confirmacao, error } = await supabase
      .from("confirmacoes")
      .select("id, qr_token, convidados_lista(responsavel)")
      .eq("id", payload.confirmacao_id)
      .single();

    if (error || !confirmacao || confirmacao.qr_token !== token) {
      return new Response(JSON.stringify({ error: "QR Code não corresponde a nenhuma confirmação ativa." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: jaCheckados } = await supabase
      .from("checkins")
      .select("nome")
      .eq("confirmacao_id", confirmacao.id);

    const nomesCheckados = new Set((jaCheckados ?? []).map((c) => c.nome));

    if (!nome) {
      // Modo consulta: devolve a lista para a portaria escolher
      return new Response(
        JSON.stringify({
          ok: true,
          responsavel: (confirmacao as any).convidados_lista?.responsavel,
          nomes: (payload.nomes as string[]).map((n) => ({
            nome: n,
            ja_entrou: nomesCheckados.has(n),
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Modo check-in: registra a entrada de uma pessoa específica
    if (!payload.nomes.includes(nome)) {
      return new Response(JSON.stringify({ error: "Esse nome não pertence a este QR Code." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (nomesCheckados.has(nome)) {
      return new Response(JSON.stringify({ error: `${nome} já entrou anteriormente.` }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("checkins").insert({
      confirmacao_id: confirmacao.id,
      nome,
      checado_por: "portaria",
    });

    return new Response(JSON.stringify({ ok: true, entrou: nome }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
