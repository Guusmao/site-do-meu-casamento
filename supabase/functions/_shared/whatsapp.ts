// supabase/functions/_shared/whatsapp.ts
// Envio de mensagens pelo WhatsApp. Provedores:
//  - WAHA (motor WEBJS): usado quando configurado (ver waha.ts)
//  - Evolution API (não oficial, número conectado por QR Code, texto livre)
//  - WhatsApp Cloud API oficial da Meta (só templates aprovados)
// Os nomes enviarImagemEvolution / enviarTextoEvolution ficaram por
// compatibilidade: com o WAHA configurado, eles mandam pelo WAHA.
//
// Secrets da Evolution (configurados no Supabase, nunca no código):
//   EVOLUTION_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE
// Meta (Cloud API): WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_VERSION
import { enviarImagemWaha, enviarTextoWaha, usarWaha } from "./waha.ts";

const API_VERSION_PADRAO = "v23.0";

export type ComponenteTemplate = {
  type: "header" | "body" | "button";
  sub_type?: string;
  index?: string;
  parameters: Record<string, unknown>[];
};

// Deixa só os dígitos, com DDI. Sem DDI (10 ou 11 dígitos), assume Brasil (55).
// Quem digita com "+" na frente é tratado como número internacional.
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const internacional = bruto.trim().startsWith("+");
  let digitos = bruto.replace(/\D/g, "");
  if (!internacional && (digitos.length === 10 || digitos.length === 11)) digitos = `55${digitos}`;
  return digitos.length >= 11 && digitos.length <= 15 ? digitos : null;
}

export async function enviarTemplate(
  para: string,
  template: string,
  componentes: ComponenteTemplate[],
  idioma = "pt_BR"
): Promise<string> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) throw new Error("WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID não configurados");

  const versao = Deno.env.get("WHATSAPP_API_VERSION") ?? API_VERSION_PADRAO;
  const resp = await fetch(`https://graph.facebook.com/${versao}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "template",
      template: { name: template, language: { code: idioma }, components: componentes },
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`WhatsApp recusou o envio: ${data?.error?.message ?? resp.status}`);
  }
  return data.messages?.[0]?.id;
}

// Parâmetro de texto de template: a Meta não aceita quebra de linha, tab
// nem mais de 4 espaços seguidos.
export function textoParametro(s: string) {
  return { type: "text", text: s.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim() };
}

export function usarEvolution(): boolean {
  const provedor = Deno.env.get("WHATSAPP_PROVEDOR");
  if (provedor === "meta") return false;
  if (usarWaha()) return true;
  return Boolean(Deno.env.get("EVOLUTION_URL") && Deno.env.get("EVOLUTION_API_KEY"));
}

// Manda uma imagem com legenda pela Evolution API (v2). Devolve o id da mensagem.
// O "delay" faz o WhatsApp mostrar "digitando..." antes, como uma pessoa faria.
export async function enviarImagemEvolution(
  para: string,
  imagemUrl: string,
  legenda: string
): Promise<string | undefined> {
  if (usarWaha()) return await enviarImagemWaha(para, imagemUrl, legenda);
  // Aceita o endereço colado com "/manager" ou barra no final
  const base = Deno.env.get("EVOLUTION_URL")?.trim().replace(/\/+$/, "").replace(/\/manager$/, "");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY");
  const instancia = Deno.env.get("EVOLUTION_INSTANCE") ?? "casamento";
  if (!base || !apiKey) throw new Error("EVOLUTION_URL/EVOLUTION_API_KEY não configurados");

  const resp = await fetch(`${base}/message/sendMedia/${encodeURIComponent(instancia)}`, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      number: para,
      mediatype: "image",
      mimetype: "image/png",
      media: imagemUrl,
      fileName: "ingresso.png",
      caption: legenda,
      delay: 1500 + Math.floor(Math.random() * 2500),
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detalhe = data?.response?.message ?? data?.message ?? data?.error ?? resp.status;
    throw new Error(`Evolution recusou o envio: ${typeof detalhe === "string" ? detalhe : JSON.stringify(detalhe)}`);
  }
  return data?.key?.id;
}

// Manda só texto pela Evolution API (usado antes do ingresso e pelo robô).
export async function enviarTextoEvolution(para: string, texto: string): Promise<string | undefined> {
  if (usarWaha()) return await enviarTextoWaha(para, texto);
  const base = Deno.env.get("EVOLUTION_URL")?.trim().replace(/\/+$/, "").replace(/\/manager$/, "");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY");
  const instancia = Deno.env.get("EVOLUTION_INSTANCE") ?? "casamento";
  if (!base || !apiKey) throw new Error("EVOLUTION_URL/EVOLUTION_API_KEY não configurados");

  const resp = await fetch(`${base}/message/sendText/${encodeURIComponent(instancia)}`, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ number: para, text: texto, delay: 1200 + Math.floor(Math.random() * 1800) }),
  });
  const data = await resp.json().catch(() => ({}));
  console.log("evolution sendText:", resp.status, JSON.stringify(data?.key ?? data).slice(0, 300));
  if (!resp.ok) {
    const detalhe = data?.response?.message ?? data?.message ?? data?.error ?? resp.status;
    throw new Error(`Evolution recusou o texto: ${typeof detalhe === "string" ? detalhe : JSON.stringify(detalhe)}`);
  }
  return data?.key?.id;
}
