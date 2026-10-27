// supabase/functions/whatsapp-webhook/index.ts
// Webhook da Meta: avisa quando cada mensagem do robô foi entregue, lida ou
// falhou (ex: número sem WhatsApp) e atualiza mensagens_whatsapp.
// Publicada com verify_jwt desligado, porque quem chama é a Meta; a origem
// é conferida pela assinatura X-Hub-Signature-256 (secret WHATSAPP_APP_SECRET).
//   GET  -> verificação do webhook no painel da Meta (WHATSAPP_VERIFY_TOKEN)
//   POST -> atualizações de status

import { createClient } from "npm:@supabase/supabase-js@2";

const STATUS: Record<string, string> = {
  sent: "enviado",
  delivered: "entregue",
  read: "lido",
  failed: "erro",
};
// Ordem para não "voltar" de lido para entregue quando os avisos chegam fora de ordem
const ORDEM = ["pendente", "enviado", "entregue", "lido"];

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const ok =
      url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    return ok
      ? new Response(url.searchParams.get("hub.challenge") ?? "")
      : new Response("Forbidden", { status: 403 });
  }

  const corpo = await req.text();
  if (!(await assinaturaValida(corpo, req.headers.get("X-Hub-Signature-256")))) {
    return new Response("Assinatura inválida", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const evento = JSON.parse(corpo);
  for (const entry of evento.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        const novo = STATUS[s.status];
        if (!novo) continue;

        const { data: atual } = await supabase
          .from("mensagens_whatsapp")
          .select("id, status")
          .eq("wa_message_id", s.id)
          .maybeSingle();
        if (!atual || atual.status === "erro") continue;
        if (novo !== "erro" && ORDEM.indexOf(novo) <= ORDEM.indexOf(atual.status)) continue;

        await supabase
          .from("mensagens_whatsapp")
          .update({
            status: novo,
            erro: novo === "erro" ? JSON.stringify(s.errors ?? []) : null,
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", atual.id);
      }
    }
  }

  // A Meta só precisa de um 200 rápido
  return new Response("ok");
});

async function assinaturaValida(corpo: string, cabecalho: string | null) {
  const segredo = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!segredo || !cabecalho?.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(corpo)));
  const esperado = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  const recebido = cabecalho.slice("sha256=".length);

  // Comparação em tempo constante
  if (esperado.length !== recebido.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diff === 0;
}
