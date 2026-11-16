// supabase/functions/_shared/waha.ts
// Envio pelo WAHA (WhatsApp HTTP API, motor WEBJS): roda o WhatsApp Web de
// verdade num navegador, então manda o "token de confiança" que o WhatsApp
// passou a exigir (a Evolution 2.3.7 não manda e leva erro 463).
// Quando WAHA_URL e WAHA_API_KEY estão configurados, todo envio passa por aqui.
//
// Endereço e chave ficam no Vault do Supabase (waha_url, waha_api_key),
// lidos pela função config_waha() (só service_role). Secrets WAHA_URL e
// WAHA_API_KEY, se existirem, têm prioridade. Nunca no código.
// WHATSAPP_PROVEDOR=evolution desliga o WAHA e volta para a Evolution.

const CONFIG = await carregarConfig();

async function carregarConfig(): Promise<{ url?: string; key?: string }> {
  const url = Deno.env.get("WAHA_URL");
  const key = Deno.env.get("WAHA_API_KEY");
  if (url && key) return { url, key };
  try {
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/config_waha`, {
      method: "POST",
      headers: {
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const data = await resp.json();
    return { url: data?.waha_url, key: data?.waha_api_key };
  } catch (e) {
    console.error("waha: não consegui ler a configuração:", e);
    return {};
  }
}

function configWaha() {
  const base = CONFIG.url?.trim().replace(/\/+$/, "").replace(/\/dashboard$/, "");
  const apiKey = CONFIG.key;
  const sessao = Deno.env.get("WAHA_SESSION") ?? "default";
  if (!base || !apiKey) throw new Error("WAHA não configurado");
  return { base, apiKey, sessao };
}

export function usarWaha(): boolean {
  if (Deno.env.get("WHATSAPP_PROVEDOR") === "evolution") return false;
  return Boolean(CONFIG.url && CONFIG.key);
}

async function chamar(metodo: string, caminho: string, corpo?: unknown) {
  const { base, apiKey } = configWaha();
  const resp = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resp.text();
  let data: any = {};
  try {
    data = texto ? JSON.parse(texto) : {};
  } catch {
    data = { bruto: texto.slice(0, 300) };
  }
  if (!resp.ok) {
    const detalhe = data?.message ?? data?.error ?? data?.bruto ?? resp.status;
    throw new Error(`WAHA recusou (${resp.status}): ${typeof detalhe === "string" ? detalhe : JSON.stringify(detalhe)}`);
  }
  return data;
}

// "5585999998888" -> chatId que o WhatsApp usa para esse número (pode ser @lid).
// Quem chega pelo robô já vem com o chatId (tem "@") e passa direto.
export async function chatIdWaha(para: string): Promise<string> {
  if (para.includes("@")) return para;
  const { sessao } = configWaha();
  const digitos = para.replace(/\D/g, "");
  const r = await chamar("GET", `/api/contacts/check-exists?phone=${digitos}&session=${encodeURIComponent(sessao)}`);
  if (r?.numberExists === false) throw new Error("Este número não tem WhatsApp.");
  return r?.chatId ?? `${digitos}@c.us`;
}

function idDaMensagem(r: any): string | undefined {
  return r?.id?._serialized ?? (typeof r?.id === "string" ? r.id : undefined) ?? r?._data?.id?._serialized;
}

async function digitando(chatId: string, ms: number) {
  const { sessao } = configWaha();
  try {
    await chamar("POST", "/api/startTyping", { session: sessao, chatId });
    await new Promise((r) => setTimeout(r, ms));
    await chamar("POST", "/api/stopTyping", { session: sessao, chatId });
  } catch (e) {
    console.error("waha digitando:", e);
  }
}

export async function enviarTextoWaha(para: string, texto: string): Promise<string | undefined> {
  const { sessao } = configWaha();
  const chatId = await chatIdWaha(para);
  await digitando(chatId, 1200 + Math.floor(Math.random() * 1800));
  const r = await chamar("POST", "/api/sendText", { session: sessao, chatId, text: texto });
  const id = idDaMensagem(r);
  console.log("waha sendText:", chatId, id);
  return id;
}

export async function enviarImagemWaha(para: string, imagemUrl: string, legenda: string): Promise<string | undefined> {
  const { sessao } = configWaha();
  const chatId = await chatIdWaha(para);
  await digitando(chatId, 1500 + Math.floor(Math.random() * 2500));
  const r = await chamar("POST", "/api/sendImage", {
    session: sessao,
    chatId,
    file: { mimetype: "image/png", filename: "ingresso.png", url: imagemUrl },
    caption: legenda,
  });
  const id = idDaMensagem(r);
  console.log("waha sendImage:", chatId, id);
  return id;
}

// Estado no formato da Evolution, para o vigia e o ?status=1:
// "open" = conectado; "close" = caiu; "connecting" = esperando QR/código.
export async function estadoWaha(): Promise<string> {
  const { sessao } = configWaha();
  const r = await chamar("GET", `/api/sessions/${encodeURIComponent(sessao)}`);
  const s = String(r?.status ?? "");
  if (s === "WORKING") return "open";
  if (s === "SCAN_QR_CODE" || s === "STARTING") return "connecting";
  return "close";
}

export async function travaWaha(): Promise<unknown> {
  const { sessao } = configWaha();
  const r = await chamar("GET", `/api/sessions/${encodeURIComponent(sessao)}`);
  return r?.me?.reachoutTimelock ?? null;
}

export async function reconectarWaha() {
  const { sessao } = configWaha();
  await chamar("POST", `/api/sessions/${encodeURIComponent(sessao)}/restart`);
}

export async function codigoPareamentoWaha(numero: string) {
  const { sessao } = configWaha();
  const r = await chamar("POST", `/api/${encodeURIComponent(sessao)}/auth/request-code`, { phoneNumber: numero.replace(/\D/g, "") });
  return r?.code;
}

export async function configurarWebhookWaha(url: string) {
  const { sessao } = configWaha();
  await chamar("PUT", `/api/sessions/${encodeURIComponent(sessao)}`, {
    config: { webhooks: [{ url, events: ["message", "message.ack", "session.status"] }] },
  });
}

// Número de telefone (só dígitos) de um chatId @lid, quando o WhatsApp informa.
export async function telefoneDoChat(chatId: string): Promise<string | null> {
  if (chatId.endsWith("@c.us") || chatId.endsWith("@s.whatsapp.net")) return chatId.split("@")[0];
  if (!chatId.endsWith("@lid")) return null;
  const { sessao } = configWaha();
  try {
    const r = await chamar("GET", `/api/${encodeURIComponent(sessao)}/lids/${encodeURIComponent(chatId)}`);
    const pn: string | undefined = r?.pn;
    return pn ? pn.split("@")[0] : null;
  } catch (e) {
    console.error("waha lid->pn:", e);
    return null;
  }
}
