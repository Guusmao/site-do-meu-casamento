// supabase/functions/enviar-ingresso/index.ts
// Recebe { confirmacao_id } e manda o ingresso pelo WhatsApp do grupo:
// template aprovado na Meta com o QR Code como imagem de cabeçalho
// (gerado via QuickChart, sem precisar de libs pesadas) e os nomes no texto.
// Cada envio fica registrado em mensagens_whatsapp.

import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarTemplate, textoParametro } from "../_shared/whatsapp.ts";

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

    const template = Deno.env.get("WHATSAPP_TEMPLATE_INGRESSO") ?? "ingresso_casamento";
    const { data: msg } = await supabase
      .from("mensagens_whatsapp")
      .insert({ confirmacao_id, tipo: "ingresso", telefone: confirmacao.whatsapp, template })
      .select("id")
      .single();

    try {
      // Template: cabeçalho = imagem do QR; {{1}} = primeiro nome; {{2}} = quem vai
      const waId = await enviarTemplate(confirmacao.whatsapp, template, [
        { type: "header", parameters: [{ type: "image", image: { link: qrUrl } }] },
        {
          type: "body",
          parameters: [textoParametro(nomesVao[0].split(" ")[0]), textoParametro(juntarNomes(nomesVao))],
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
