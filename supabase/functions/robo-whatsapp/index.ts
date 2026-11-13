// supabase/functions/robo-whatsapp/index.ts
// Resposta automática quando alguém manda mensagem para o número do robô.
// O robô não conversa: responde uma vez avisando isso, e a única coisa que
// ele faz é reenviar o ingresso para quem responder "INGRESSO".
//
// Chamada pela Evolution API (webhook do evento MESSAGES_UPSERT).
// Publicada com verify_jwt desligado; a Evolution chama com ?t=<chave> na URL,
// e a chave é derivada do QR_SECRET (ninguém precisa criar segredo novo).
//
// Configurar o webhook na Evolution: GET ...?configurar=1 aponta a instância
// para esta função com a chave certa (pode ser chamado de novo sem problema).
//
// Limites para proteger o número:
//  - aviso "não sou de conversa": no máximo 1 a cada 12 horas por número
//  - reenvio do ingresso: no máximo 3 por dia por número
//  - grupos, status e mensagens enviadas pelo próprio robô são ignorados

import { createClient } from "npm:@supabase/supabase-js@2";
import { chaveTelefone, configurarWebhookEvolution, codigoPareamentoEvolution, enviarTextoEvolution, estadoEvolution } from "../_shared/whatsapp.ts";
import { Confirmacao, enviarIngresso, juntarNomes, nomesQueVao, urlSite } from "../_shared/ingresso.ts";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const chave = await chaveWebhook();

  if (url.searchParams.get("configurar")) {
    const destino = `${Deno.env.get("SUPABASE_URL")}/functions/v1/robo-whatsapp?t=${chave}`;
    try {
      await configurarWebhookEvolution(destino);
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ ok: false, error: String(e) }, { status: 502 });
    }
  }

  // Só diz se o número está conectado (sem dados de ninguém)
  if (url.searchParams.get("status")) {
    try {
      return Response.json({ estado: await estadoEvolution() });
    } catch (e) {
      return Response.json({ estado: "erro", error: String(e) }, { status: 502 });
    }
  }

  // Reconectar sem QR: devolve o código de pareamento (só quando está desconectado;
  // o código só serve no celular do próprio número, então não expõe nada)
  const numero = url.searchParams.get("conectar");
  if (numero) {
    try {
      const estado = await estadoEvolution();
      if (estado === "open") return Response.json({ estado });
      return Response.json({ estado, codigo: await codigoPareamentoEvolution(numero, url.searchParams.has("limpar")) });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 502 });
    }
  }

  if (url.searchParams.get("t") !== chave) return new Response("Forbidden", { status: 403 });
  if (req.method !== "POST") return new Response("ok");

  const evento = await req.json().catch(() => null);
  try {
    await tratar(evento);
  } catch (e) {
    console.error("robo-whatsapp:", e);
  }
  // A Evolution só precisa de um 200
  return new Response("ok");
});

async function tratar(evento: any) {
  if (!evento || !String(evento.event ?? "").toLowerCase().includes("messages.upsert")) return;
  const msgs = Array.isArray(evento.data) ? evento.data : [evento.data];

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  for (const m of msgs) {
    const key = m?.key ?? {};
    const jid: string = key.remoteJid ?? "";
    if (key.fromMe || !jid || jid.endsWith("@g.us") || jid === "status@broadcast" || jid.endsWith("@newsletter")) continue;
    // Mensagens antigas (ex: sincronização quando o número reconecta) não recebem resposta
    const enviadaEm = Number(m.messageTimestamp ?? 0) * 1000;
    if (enviadaEm && Date.now() - enviadaEm > 10 * 60_000) continue;

    // Número de telefone: pode vir no remoteJid ou, quando o WhatsApp usa LID, em outro campo
    const comTelefone = [key.remoteJidAlt, key.senderPn, m.senderPn, jid].find(
      (j: string | undefined) => typeof j === "string" && j.endsWith("@s.whatsapp.net")
    );
    const telefone = comTelefone ? comTelefone.split("@")[0] : null;
    const responderPara = telefone ?? jid;

    const texto: string =
      m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? m.message?.buttonsResponseMessage?.selectedDisplayText ?? "";
    const pediuIngresso = /ingresso|qr ?code|convite/i.test(texto.normalize("NFD").replace(/[̀-ͯ]/g, ""));
    const nome = String(m.pushName ?? "").split(" ")[0];

    if (pediuIngresso) {
      await reenviarIngresso(supabase, responderPara, telefone, nome);
    } else {
      await avisarQueERobo(supabase, responderPara, nome);
    }
  }
}

async function avisarQueERobo(supabase: any, para: string, nome: string) {
  const dozeHoras = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { count } = await supabase
    .from("robo_respostas")
    .select("id", { count: "exact", head: true })
    .eq("contato", para)
    .eq("tipo", "aviso")
    .gte("criado_em", dozeHoras);
  if ((count ?? 0) > 0) return;

  await supabase.from("robo_respostas").insert({ contato: para, tipo: "aviso" });
  await enviarTextoEvolution(
    para,
    [
      `Oi${nome ? `, ${nome}` : ""}! 🤖💍`,
      "",
      "Este é o número automático do casamento da Sarah e do Felipe. Ele só envia ingressos e lembretes, então *não responde conversas*.",
      "",
      "Perdeu o seu ingresso? Responda *INGRESSO* que eu mando de novo.",
      "",
      "Para falar com os noivos, chame eles no WhatsApp pessoal. 😉",
    ].join("\n")
  );
}

async function reenviarIngresso(supabase: any, para: string, telefone: string | null, nome: string) {
  const umDia = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await supabase
    .from("robo_respostas")
    .select("id", { count: "exact", head: true })
    .eq("contato", para)
    .eq("tipo", "reenvio")
    .gte("criado_em", umDia);
  if ((count ?? 0) >= 3) return;
  await supabase.from("robo_respostas").insert({ contato: para, tipo: "reenvio" });

  // Procura a confirmação feita com este número
  let confirmacao: Confirmacao | undefined;
  if (telefone) {
    const alvo = chaveTelefone(telefone);
    const { data } = await supabase
      .from("confirmacoes")
      .select("id, whatsapp, qr_token, nomes_confirmados")
      .not("whatsapp", "is", null)
      .not("qr_token", "is", null);
    confirmacao = (data ?? []).find((c: Confirmacao) => chaveTelefone(c.whatsapp!) === alvo && nomesQueVao(c).length > 0);
  }

  if (!confirmacao) {
    await enviarTextoEvolution(
      para,
      [
        `Não encontrei uma confirmação de presença com este número${nome ? `, ${nome}` : ""}. 🤔`,
        "",
        `Se ainda não confirmou, é rapidinho pelo site: ${urlSite()}`,
        "Se confirmou com outro número, o ingresso foi para aquele WhatsApp.",
      ].join("\n")
    );
    return;
  }

  const nomes = nomesQueVao(confirmacao);
  const legenda = [
    `Aqui está o seu ingresso de novo, ${nomes[0].split(" ")[0]}! 🎟️`,
    "",
    nomes.length > 1 ? `Vale para: ${juntarNomes(nomes)}.` : "",
    "É só mostrar este QR Code na entrada no dia 08/02/2027. 💍",
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
  await enviarIngresso(supabase, confirmacao, "reenvio", legenda, undefined, para);
}

// Chave do webhook derivada do QR_SECRET (HMAC), em hexadecimal
async function chaveWebhook() {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("QR_SECRET") ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("robo-whatsapp-webhook")));
  return [...sig].slice(0, 20).map((b) => b.toString(16).padStart(2, "0")).join("");
}
