// supabase/functions/enviar-ingresso/index.ts
// Recebe { confirmacao_id } e manda o ingresso pelo WhatsApp do grupo.
// Pela Evolution vai primeiro um texto curto (só texto: primeira mensagem com
// imagem para número novo parece spam e o WhatsApp derruba o aparelho) e, logo
// depois, a arte do ingresso como imagem com legenda. Pela Meta, template.
// Cada envio fica registrado em mensagens_whatsapp.

import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarImagemEvolution, enviarTemplate, enviarTextoEvolution, textoParametro, usarEvolution } from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response(JSON.stringify({ error: "Não autorizado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { confirmacao_id } = await req.json();

    const { data: confirmacao, error } = await supabase
      .from("confirmacoes")
      .select("id, whatsapp, nomes_confirmados, qr_token")
      .eq("id", confirmacao_id)
      .single();

    if (error || !confirmacao) throw error ?? new Error("Confirmação não encontrada");

    const nomesVao = (confirmacao.nomes_confirmados as any[])
      .filter((n) => n.vai)
      .map((n) => n.nome);

    if (nomesVao.length === 0) {
      return json({ ok: true, skip: "sem confirmados" });
    }
    if (!confirmacao.whatsapp) {
      return json({ ok: true, skip: "grupo sem whatsapp" });
    }

    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(
      confirmacao.qr_token
    )}&size=600&margin=3&format=png&dark=2d2a26&light=fdfaf5`;

    const evolution = usarEvolution();
    const template = evolution
      ? "evolution:ingresso"
      : Deno.env.get("WHATSAPP_TEMPLATE_INGRESSO") ?? "ingresso_casamento";
    const { data: msg } = await supabase
      .from("mensagens_whatsapp")
      .insert({ confirmacao_id, tipo: "ingresso", telefone: confirmacao.whatsapp, template })
      .select("id")
      .single();

    try {
      const primeiroNome = nomesVao[0].split(" ")[0];
      const waId = evolution
        ? await enviarIngressoEvolution(confirmacao.whatsapp, confirmacao.qr_token, qrUrl, primeiroNome, nomesVao)
        : await enviarTemplate(confirmacao.whatsapp, template, [
            { type: "header", parameters: [{ type: "image", image: { link: qrUrl } }] },
            {
              type: "body",
              parameters: [textoParametro(primeiroNome), textoParametro(juntarNomes(nomesVao))],
            },
          ]);

      await supabase
        .from("mensagens_whatsapp")
        .update({ wa_message_id: waId, status: "enviado", atualizado_em: new Date().toISOString() })
        .eq("id", msg?.id);
      await supabase
        .from("confirmacoes")
        .update({ qr_enviado_em: new Date().toISOString() })
        .eq("id", confirmacao_id);
    } catch (e) {
      await supabase
        .from("mensagens_whatsapp")
        .update({ status: "erro", erro: String(e), atualizado_em: new Date().toISOString() })
        .eq("id", msg?.id);
      throw e;
    }

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function juntarNomes(nomes: string[]) {
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0];
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function enviarIngressoEvolution(para: string, token: string, qrUrl: string, primeiroNome: string, nomesVao: string[]) {
  // 1) Primeiro só texto, para o WhatsApp não tratar a mensagem como spam
  try {
    await enviarTextoEvolution(
      para,
      [
        `Oi, ${primeiroNome}! 👋`,
        "",
        "Aqui é o número oficial do casamento da Sarah e do Felipe. 💍",
        "Salve este contato como *Casamento Sarah & Felipe*: o seu ingresso chega na próxima mensagem.",
      ].join("\n")
    );
  } catch (e) {
    console.error("Falha ao mandar o texto de boas-vindas (segue para o ingresso):", e);
  }
  await esperar(6000 + Math.floor(Math.random() * 4000));

  // 2) Depois a arte do ingresso (ou o QR simples, se a arte falhar)
  const legenda = legendaIngresso(primeiroNome, nomesVao);
  const site = (Deno.env.get("SITE_URL") ?? "https://casamento-sarah-e-felipe.vercel.app").replace(/\/+$/, "");
  const arteUrl = `${site}/api/ingresso?t=${encodeURIComponent(token)}`;
  try {
    return await enviarImagemEvolution(para, arteUrl, legenda);
  } catch (e) {
    console.error("Falha ao enviar a arte do ingresso, mandando o QR simples:", e);
    return await enviarImagemEvolution(para, qrUrl, legenda);
  }
}

function legendaIngresso(primeiroNome: string, nomesVao: string[]) {
  const quem = nomesVao.length > 1 ? `Presenças confirmadas: ${juntarNomes(nomesVao)}.` : "Sua presença está confirmada!";
  return [
    `Que alegria ter vocês no casamento da Sarah e do Felipe, no dia 08/02/2027. ${quem}`,
    "",
    "Este QR Code é o ingresso de vocês: é só mostrar na entrada no dia. Guarde esta mensagem! 🥂",
  ].join("\n");
}
