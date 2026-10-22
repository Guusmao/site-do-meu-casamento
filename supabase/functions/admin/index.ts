// supabase/functions/admin/index.ts
// Usada pela página admin.html (só os noivos). Toda chamada exige ADMIN_SENHA.
// Recebe { senha, acao, ...dados }:
// - listar                                  -> grupos com pessoas e confirmação + pendentes
// - adicionar_pessoa  { grupo_id, nome, sobrenome, parentesco?, pendente_id? }
//                       (com pendente_id, marca o pedido como vinculado ao grupo)
// - editar_pessoa     { pessoa_id, nome, sobrenome, parentesco? }
// - remover_pessoa    { pessoa_id }
// - descartar_pendente { pendente_id }
// Mudanças em um grupo já confirmado geram um novo QR e reenviam o ingresso
// (o QR antigo deixa de valer na portaria).

import { createClient } from "npm:@supabase/supabase-js@2";
import { chaveNome, listarPessoas, sincronizarConfirmacao } from "../_shared/grupo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const responder = (corpo: object, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const limpar = (v: unknown, max = 60) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const senhaAdmin = Deno.env.get("ADMIN_SENHA");
    if (!senhaAdmin || body.senha !== senhaAdmin) {
      return responder({ error: "Senha de admin inválida." }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Confere limite e nome repetido antes de gravar uma pessoa no grupo
    const validarPessoa = async (grupo_id: string, nome: string, sobrenome: string, ignorarId?: string) => {
      if (!nome || !sobrenome) return "Preencha nome e sobrenome.";
      const { data: grupo } = await supabase
        .from("convidados_lista")
        .select("quantidade_maxima")
        .eq("id", grupo_id)
        .single();
      if (!grupo) return "Grupo não encontrado.";
      const pessoas = (await listarPessoas(supabase, grupo_id)).filter((p: any) => p.id !== ignorarId);
      if (!ignorarId && pessoas.length >= grupo.quantidade_maxima) {
        return `Este grupo já está cheio (${grupo.quantidade_maxima}). Aumente quantidade_maxima no banco se precisar.`;
      }
      if (pessoas.some((p: any) => chaveNome(p.nome, p.sobrenome) === chaveNome(nome, sobrenome))) {
        return `${nome} ${sobrenome} já está neste grupo.`;
      }
      return null;
    };

    switch (body.acao) {
      case "listar": {
        const [grupos, pessoas, confirmacoes, pendentes] = await Promise.all([
          supabase.from("convidados_lista").select("id, responsavel, quantidade_maxima, origem, observacoes").order("responsavel"),
          supabase.from("convidados_pessoas").select("id, grupo_id, nome, sobrenome, parentesco, vai").order("criado_em"),
          supabase.from("confirmacoes").select("grupo_id, email, qr_enviado_em, atualizado_em"),
          supabase.from("pendentes").select("*").order("criado_em", { ascending: false }),
        ]);
        for (const r of [grupos, pessoas, confirmacoes, pendentes]) if (r.error) throw r.error;
        return responder({
          grupos: grupos.data,
          pessoas: pessoas.data,
          confirmacoes: confirmacoes.data,
          pendentes: pendentes.data,
        });
      }

      case "adicionar_pessoa": {
        const grupo_id = String(body.grupo_id ?? "");
        const nome = limpar(body.nome);
        const sobrenome = limpar(body.sobrenome);
        const problema = await validarPessoa(grupo_id, nome, sobrenome);
        if (problema) return responder({ error: problema }, 400);

        const { error } = await supabase.from("convidados_pessoas").insert({
          grupo_id, nome, sobrenome, parentesco: limpar(body.parentesco, 40) || null, vai: true,
        });
        if (error) throw error;

        if (body.pendente_id) {
          await supabase
            .from("pendentes")
            .update({ status: "vinculado", grupo_id, resolvido_em: new Date().toISOString() })
            .eq("id", body.pendente_id);
        }
        await sincronizarConfirmacao(supabase, grupo_id);
        return responder({ ok: true });
      }

      case "editar_pessoa": {
        const { data: pessoa } = await supabase
          .from("convidados_pessoas").select("id, grupo_id").eq("id", body.pessoa_id).single();
        if (!pessoa) return responder({ error: "Pessoa não encontrada." }, 404);
        const nome = limpar(body.nome);
        const sobrenome = limpar(body.sobrenome);
        const problema = await validarPessoa(pessoa.grupo_id, nome, sobrenome, pessoa.id);
        if (problema) return responder({ error: problema }, 400);

        const { error } = await supabase
          .from("convidados_pessoas")
          .update({ nome, sobrenome, parentesco: limpar(body.parentesco, 40) || null, atualizado_em: new Date().toISOString() })
          .eq("id", pessoa.id);
        if (error) throw error;
        await sincronizarConfirmacao(supabase, pessoa.grupo_id);
        return responder({ ok: true });
      }

      case "remover_pessoa": {
        const { data: pessoa } = await supabase
          .from("convidados_pessoas").select("id, grupo_id").eq("id", body.pessoa_id).single();
        if (!pessoa) return responder({ error: "Pessoa não encontrada." }, 404);
        const { error } = await supabase.from("convidados_pessoas").delete().eq("id", pessoa.id);
        if (error) throw error;
        await sincronizarConfirmacao(supabase, pessoa.grupo_id);
        return responder({ ok: true });
      }

      case "descartar_pendente": {
        const { error } = await supabase
          .from("pendentes")
          .update({ status: "descartado", resolvido_em: new Date().toISOString() })
          .eq("id", body.pendente_id);
        if (error) throw error;
        return responder({ ok: true });
      }

      default:
        return responder({ error: "Ação desconhecida." }, 400);
    }
  } catch (err) {
    return responder({ error: String(err) }, 400);
  }
});
