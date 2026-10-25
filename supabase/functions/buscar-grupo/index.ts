// supabase/functions/buscar-grupo/index.ts
// Recebe { termo: string } e devolve os convidados cujo nome combina (coluna
// "nomes" de convidados_lista), sem diferenciar maiúsculas/acentos.
// Uma sugestão por pessoa, com o grupo (convite) ao qual ela pertence.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { termo } = await req.json();

    if (!termo || typeof termo !== "string" || termo.trim().length < 2) {
      return new Response(JSON.stringify({ resultados: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Busca "contém", sem case/acento, só nos nomes dos integrantes
    // (função buscar_convidado_por_nome no Postgres, usa unaccent)
    const { data, error } = await supabase.rpc("buscar_convidado_por_nome", {
      termo: termo.trim(),
    });

    if (error) throw error;

    // Verifica se cada grupo já tem confirmação registrada e se tem WhatsApp
    // cadastrado (o site só recebe o final do número, nunca ele inteiro)
    const ids = (data ?? []).map((g) => g.id);
    let jaConfirmados = new Set<string>();
    const finalWhatsapp = new Map<string, string>();
    if (ids.length > 0) {
      const [{ data: confs }, { data: grupos }] = await Promise.all([
        supabase.from("confirmacoes").select("grupo_id").in("grupo_id", ids),
        supabase.from("convidados_lista").select("id, whatsapp").in("id", ids),
      ]);
      jaConfirmados = new Set((confs ?? []).map((c) => c.grupo_id));
      for (const g of grupos ?? []) if (g.whatsapp) finalWhatsapp.set(g.id, g.whatsapp.slice(-4));
    }

    const resultados = (data ?? []).map((g) => ({
      grupo_id: g.id,
      nome: g.nome,
      responsavel: g.nome, // o site mostra este campo na lista de sugestões
      integrantes: g.integrantes,
      quantidade_maxima: g.quantidade_maxima,
      ja_confirmado: jaConfirmados.has(g.id),
      whatsapp_final: finalWhatsapp.get(g.id) ?? null,
    }));

    return new Response(JSON.stringify({ resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
