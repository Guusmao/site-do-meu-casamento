// supabase/functions/registrar-pendente/index.ts
// Recebe { nome_digitado, contato?, mensagem? } de quem não achou o próprio
// convite na busca do RSVP. Os noivos ligam o pedido ao grupo certo pela página admin.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const limpar = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const nome_digitado = limpar(body.nome_digitado, 120);
    const contato = limpar(body.contato, 120);
    const mensagem = limpar(body.mensagem, 500);

    if (nome_digitado.length < 3 || !contato) {
      return new Response(JSON.stringify({ error: "Informe seu nome completo e um contato." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase
      .from("pendentes")
      .insert({ nome_digitado, contato, mensagem: mensagem || null });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
