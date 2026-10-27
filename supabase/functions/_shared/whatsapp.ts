// supabase/functions/_shared/whatsapp.ts
// Envio de mensagens pela WhatsApp Cloud API oficial da Meta.
// Fora da janela de 24h de conversa, a Meta só aceita mensagens de template
// aprovado, então tudo que o robô manda (ingresso e lembretes) é template.
//
// Secrets usados (configurados no Supabase, nunca no código):
//   WHATSAPP_TOKEN            token permanente do usuário do sistema (Meta Business)
//   WHATSAPP_PHONE_NUMBER_ID  id do número que envia (painel do app na Meta)
//   WHATSAPP_API_VERSION      opcional, versão da Graph API (padrão abaixo)

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
