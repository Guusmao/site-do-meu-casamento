// supabase/functions/confirmar-presenca/index.ts
// Recebe { grupo_id, email, pessoas: [{ id?, nome?, sobrenome?, parentesco?, vai }] }
// - Pessoa com `id`: já cadastrada — só muda "vai"/"não vai" (nome fica travado).
// - Pessoa sem `id`: cadastro novo (nome + sobrenome), até o limite do grupo.
// Quem já foi cadastrado não pode ser removido nem trocado pelo site; só pela página admin.
// Depois grava a confirmação, gera o token assinado do QR e chama enviar-ingresso.

import { createClient } from "npm:@supabase/supabase-js@2";
import { chaveNome, listarPessoas, sincronizarConfirmacao } from "../_shared/grupo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const erro = (mensagem: string, status = 400) =>
  new Response(JSON.stringify({ error: mensagem }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const limpar = (v: unknown, max = 60) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { grupo_id, email, pessoas } = await req.json();

    if (!grupo_id || !email || !Array.isArray(pessoas) || pessoas.length === 0) {
      return erro("Dados incompletos.");
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

    if (erroGrupo || !grupo) return erro("Grupo não encontrado na lista de convidados.", 404);

    const existentes = await listarPessoas(supabase, grupo_id);
    const existentesPorId = new Map(existentes.map((p: any) => [p.id, p]));
    const chaves = new Set(existentes.map((p: any) => chaveNome(p.nome, p.sobrenome)));

    // 2) Separa quem já estava cadastrado de quem é novo
    const atualizacoes: { id: string; vai: boolean }[] = [];
    const novas: { grupo_id: string; nome: string; sobrenome: string; parentesco: string | null; vai: boolean }[] = [];

    for (const p of pessoas) {
      const vai = p?.vai === true;
      if (p?.id) {
        if (!existentesPorId.has(p.id)) return erro("Uma das pessoas não pertence a este convite.");
        atualizacoes.push({ id: p.id, vai });
        continue;
      }
      const nome = limpar(p?.nome);
      const sobrenome = limpar(p?.sobrenome);
      if (!nome || !sobrenome) return erro("Preencha nome e sobrenome de cada convidado.");
      const chave = chaveNome(nome, sobrenome);
      if (chaves.has(chave)) return erro(`${nome} ${sobrenome} já está neste convite.`);
      chaves.add(chave);
      novas.push({ grupo_id, nome, sobrenome, parentesco: limpar(p?.parentesco, 40) || null, vai });
    }

    // 3) Regra de ouro: o grupo nunca passa do limite. Quem não vai continua
    //    ocupando a vaga, então não dá para trocar uma pessoa por outra.
    if (existentes.length + novas.length > grupo.quantidade_maxima) {
      return erro(`Este convite permite no máximo ${grupo.quantidade_maxima} pessoa(s).`);
    }

    const agora = new Date().toISOString();
    for (const a of atualizacoes) {
      const { error } = await supabase
        .from("convidados_pessoas")
        .update({ vai: a.vai, atualizado_em: agora })
        .eq("id", a.id)
        .eq("grupo_id", grupo_id);
      if (error) throw error;
    }
    if (novas.length > 0) {
      const { error } = await supabase.from("convidados_pessoas").insert(novas);
      if (error) throw error;
    }

    // 4) Grava a confirmação, gera o QR e dispara o envio do ingresso
    const nomesVao = await sincronizarConfirmacao(supabase, grupo_id, String(email).trim());

    return new Response(
      JSON.stringify({ ok: true, responsavel: grupo.responsavel, nomes_confirmados: nomesVao }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return erro(String(err));
  }
});
