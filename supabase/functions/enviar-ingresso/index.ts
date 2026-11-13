// supabase/functions/enviar-ingresso/index.ts
// Recebe { confirmacao_id } e manda o ingresso pelo WhatsApp do grupo:
// o QR Code como imagem (gerado via QuickChart, sem libs pesadas) e os nomes
// no texto. Pela Evolution vai como imagem com legenda livre; pela Meta, como
// template aprovado com o QR no cabeçalho.
// Cada envio fica registrado em mensagens_whatsapp.

import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarImagemEvolution, enviarTemplate, textoParametro, usarEvolution } from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Só o servidor (confirmar-presenca) chama esta função
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
      // Ninguém do grupo vai — não gera ingresso, só confirma o "não vou"
      return json({ ok: true, skip: "sem confirmados" });
    }
    if (!confirmacao.whatsapp) {
      return json({ ok: true, skip: "grupo sem whatsapp" });
    }

    // QR Code gerado via QuickChart (imagem pública a partir do token — o token
    // em si só serve pra algo se for validado com o QR_SECRET no servidor)
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
        ? await enviarIngressoEvolution(confirmacao.whatsapp, confirmacao.qr_token, qrUrl, legendaIngresso(primeiroNome, nomesVao))
        : // Template: cabeçalho = imagem do QR; {{1}} = primeiro nome; {{2}} = quem vai
          await enviarTemplate(confirmacao.whatsapp, template, [
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

// ["Ana", "João", "Maria"] -> "Ana, João e Maria"
function juntarNomes(nomes: string[]) {
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0];
}

// Pela Evolution manda a arte do ingresso (gerada no site em /api/ingresso).
// Se a arte falhar por algum motivo, manda o QR simples para o convidado não
// ficar sem ingresso.
async function enviarIngressoEvolution(para: string, token: string, qrUrl: string, legenda: string) {
  const site = (Deno.env.get("SITE_URL") ?? "https://casamento-sarah-e-felipe.vercel.app").replace(/\/+$/, "");
  const arteUrl = `${site}/api/ingresso?t=${encodeURIComponent(token)}`;
  try {
    return await enviarImagemEvolution(para, arteUrl, legenda);
  } catch (e) {
    console.error("Falha ao enviar a arte do ingresso, mandando o QR simples:", e);
    return await enviarImagemEvolution(para, qrUrl, legenda);
  }
}

// Texto que acompanha o QR Code quando o envio é pela Evolution
function legendaIngresso(primeiroNome: string, nomesVao: string[]) {
  const quem = nomesVao.length > 1 ? `Presenças confirmadas: ${juntarNomes(nomesVao)}.` : "Sua presença está confirmada!";
  return [
    `Oi, ${primeiroNome}! 💍`,
    "",
    `Que alegria ter vocês no casamento da Sarah e do Felipe, no dia 08/02/2027. ${quem}`,
    "",
    "Este QR Code é o ingresso de vocês: é só mostrar na entrada no dia. Guarde esta mensagem! 🥂",
  ].join("\n");
}
