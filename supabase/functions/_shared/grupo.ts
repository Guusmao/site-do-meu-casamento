// supabase/functions/_shared/grupo.ts
// Funções usadas por confirmar-presenca e admin para manter a confirmação
// (e o QR Code) do grupo sempre igual às pessoas cadastradas em convidados_pessoas.

import { assinarToken } from "./qrToken.ts";

export const nomeCompleto = (p: { nome: string; sobrenome: string }) =>
  `${p.nome.trim()} ${p.sobrenome.trim()}`;

// Mesma normalização do índice único do banco (lower + trim)
export const chaveNome = (nome: string, sobrenome: string) =>
  `${nome.trim().toLowerCase()}|${sobrenome.trim().toLowerCase()}`;

export async function listarPessoas(supabase: any, grupo_id: string) {
  const { data, error } = await supabase
    .from("convidados_pessoas")
    .select("id, nome, sobrenome, parentesco, vai")
    .eq("grupo_id", grupo_id)
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Recria nomes_confirmados + token assinado a partir das pessoas do grupo e
// dispara o envio do ingresso. Se `email` vier, cria/atualiza a confirmação;
// sem `email`, só atualiza uma confirmação que já existe (uso da página admin).
// Devolve a lista de quem vai, ou null se o grupo ainda não tem confirmação.
export async function sincronizarConfirmacao(
  supabase: any,
  grupo_id: string,
  email?: string
): Promise<string[] | null> {
  const pessoas = await listarPessoas(supabase, grupo_id);
  const nomes = pessoas.map((p: any) => ({ nome: nomeCompleto(p), vai: p.vai }));
  const agora = new Date().toISOString();

  let confirmacao: any;
  if (email) {
    const { data, error } = await supabase
      .from("confirmacoes")
      .upsert(
        { grupo_id, email, nomes_confirmados: nomes, atualizado_em: agora },
        { onConflict: "grupo_id" }
      )
      .select()
      .single();
    if (error) throw error;
    confirmacao = data;
  } else {
    const { data, error } = await supabase
      .from("confirmacoes")
      .update({ nomes_confirmados: nomes, atualizado_em: agora })
      .eq("grupo_id", grupo_id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    confirmacao = data;
  }

  // Token assinado do QR (só entra quem estiver com vai:true)
  const nomesVao = nomes.filter((n: any) => n.vai).map((n: any) => n.nome);
  const token = await assinarToken(
    { confirmacao_id: confirmacao.id, grupo_id, nomes: nomesVao, v: 1 },
    Deno.env.get("QR_SECRET")!
  );

  await supabase.from("confirmacoes").update({ qr_token: token }).eq("id", confirmacao.id);

  // Dispara o envio do ingresso (não bloqueia a resposta em caso de falha)
  const enviarUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/enviar-ingresso`;
  fetch(enviarUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ confirmacao_id: confirmacao.id }),
  }).catch((e) => console.error("Falha ao chamar enviar-ingresso:", e));

  return nomesVao;
}
