// supabase/functions/_shared/ingresso.ts
// Peças comuns para mandar o ingresso (arte com QR Code) pela Evolution,
// usadas pelos lembretes e pela resposta automática do robô.
// O envio no momento da confirmação continua em enviar-ingresso.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { enviarImagemEvolution } from "./whatsapp.ts";

export const SITE_PADRAO = "https://casamento-sarah-e-felipe.vercel.app";

export function urlSite() {
  return (Deno.env.get("SITE_URL") ?? SITE_PADRAO).replace(/\/+$/, "");
}

// ["Ana", "João", "Maria"] -> "Ana, João e Maria"
export function juntarNomes(nomes: string[]) {
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0];
}

export type Confirmacao = {
  id: string;
  whatsapp: string | null;
  qr_token: string | null;
  nomes_confirmados: { nome: string; vai: boolean }[];
};

export function nomesQueVao(c: Confirmacao) {
  return (c.nomes_confirmados ?? []).filter((n) => n.vai).map((n) => n.nome);
}

// Manda a arte do ingresso com a legenda e registra em mensagens_whatsapp.
// Se a arte falhar, manda o QR simples para ninguém ficar sem ingresso.
// "registroId" permite reaproveitar uma linha já criada (os lembretes reservam
// a linha antes de enviar, para nunca mandar o mesmo lembrete duas vezes).
export async function enviarIngresso(
  supabase: SupabaseClient,
  c: Confirmacao,
  tipo: string,
  legenda: string,
  registroId?: string,
  para?: string
) {
  const destino = para ?? c.whatsapp!;
  let id = registroId;
  if (!id) {
    // Fora os lembretes, tudo é registrado como "ingresso" (que pode se repetir);
    // o motivo do envio (reenvio, teste...) fica em "template".
    const { data } = await supabase
      .from("mensagens_whatsapp")
      .insert({
        confirmacao_id: c.id,
        tipo: tipo.startsWith("lembrete_") ? tipo : "ingresso",
        telefone: destino,
        template: `evolution:${tipo}`,
      })
      .select("id")
      .single();
    id = data?.id;
  }

  const arteUrl = `${urlSite()}/api/ingresso?t=${encodeURIComponent(c.qr_token!)}`;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(
    c.qr_token!
  )}&size=600&margin=3&format=png&dark=2d2a26&light=fdfaf5`;

  try {
    let waId: string | undefined;
    try {
      waId = await enviarImagemEvolution(destino, arteUrl, legenda);
    } catch (e) {
      console.error("Falha ao enviar a arte do ingresso, mandando o QR simples:", e);
      waId = await enviarImagemEvolution(destino, qrUrl, legenda);
    }
    await supabase
      .from("mensagens_whatsapp")
      .update({ wa_message_id: waId ?? null, status: "enviado", atualizado_em: new Date().toISOString() })
      .eq("id", id);
  } catch (e) {
    await supabase
      .from("mensagens_whatsapp")
      .update({ status: "erro", erro: String(e), atualizado_em: new Date().toISOString() })
      .eq("id", id);
    throw e;
  }
}

export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
