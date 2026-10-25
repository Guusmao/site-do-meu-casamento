// supabase/functions/buscar-grupo/index.ts
// Recebe { termo: string } e devolve grupos cujo "responsavel" ou algum dos
// integrantes (coluna "nomes") combina, sem diferenciar maiúsculas/acentos.
// Não expõe quantidade_maxima em texto livre, só o necessário pro autocomplete.

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

    // Busca "contém", sem case/acento, no responsável e nos integrantes
    // (função buscar_convidados no Postgres, usa unaccent)
    const { data, error } = await supabase.rpc("buscar_convidados", {
      termo: termo.trim(),
    });

    if (error) throw error;

    // Verifica se cada grupo já tem confirmação registrada
    const ids = (data ?? []).map((g) => g.id);
    let jaConfirmados = new Set<string>();
    if (ids.length > 0) {
      const { data: confs } = await supabase
        .from("confirmacoes")
        .select("grupo_id")
        .in("grupo_id", ids);
      jaConfirmados = new Set((confs ?? []).map((c) => c.grupo_id));
    }

    const resultados = (data ?? []).map((g) => ({
      grupo_id: g.id,
      responsavel: g.responsavel,
      nome_encontrado: g.nome_encontrado,
      ja_confirmado: jaConfirmados.has(g.id),
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
