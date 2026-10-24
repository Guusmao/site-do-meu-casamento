// supabase/functions/buscar-grupo/index.ts
// Recebe { termo: string } e devolve grupos cujo "responsavel" combina (autocomplete).
// Recebe { grupo_id } e devolve as pessoas já cadastradas no grupo (para o RSVP
// mostrar os nomes travados e só deixar marcar "vai"/"não vai").

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
    const { termo, grupo_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (grupo_id) {
      const { data: pessoas, error } = await supabase
        .from("convidados_pessoas")
        .select("id, nome, sobrenome, parentesco, vai")
        .eq("grupo_id", grupo_id)
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return new Response(JSON.stringify({ pessoas: pessoas ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!termo || typeof termo !== "string" || termo.trim().length < 2) {
      return new Response(JSON.stringify({ resultados: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca "contém", sem case/acento (via unaccent no Postgres)
    const { data, error } = await supabase
      .from("convidados_lista")
      .select("id, responsavel, quantidade_maxima")
      .ilike("responsavel", `%${termo.trim()}%`)
      .limit(8);

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
      quantidade_maxima: g.quantidade_maxima,
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
