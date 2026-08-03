// supabase/functions/enviar-ingresso/index.ts
// Recebe { confirmacao_id }, monta um email bonito com o QR Code
// (gerado via QuickChart, sem precisar de libs pesadas) e envia via Resend.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { confirmacao_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: confirmacao, error } = await supabase
      .from("confirmacoes")
      .select("id, email, nomes_confirmados, qr_token, convidados_lista(responsavel)")
      .eq("id", confirmacao_id)
      .single();

    if (error || !confirmacao) throw error ?? new Error("Confirmação não encontrada");

    const nomesVao = (confirmacao.nomes_confirmados as any[])
      .filter((n) => n.vai)
      .map((n) => n.nome);

    if (nomesVao.length === 0) {
      // Ninguém do grupo vai — não gera ingresso, só confirma o "não vou"
      return new Response(JSON.stringify({ ok: true, skip: "sem confirmados" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // QR Code gerado via QuickChart (imagem pública a partir do token — o token
    // em si só serve pra algo se for validado com o QR_SECRET no servidor)
    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(
      confirmacao.qr_token
    )}&size=400&margin=2&dark=2d2a26&light=fdfaf5`;

    const nomesHtml = nomesVao.map((n) => `<li>${escapeHtml(n)}</li>`).join("");
    const responsavelNome = (confirmacao as any).convidados_lista?.responsavel ?? "";

    const html = `
    <div style="background:#f3efe9;padding:32px;font-family:Georgia,'Playfair Display',serif;">
      <div style="max-width:480px;margin:0 auto;background:#fffdf9;border:1px solid #d9cdb8;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.08);">
        <div style="background:#2d2a26;color:#f3efe9;text-align:center;padding:28px 20px;">
          <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;opacity:0.8;">Convite de Casamento</div>
          <div style="font-size:30px;margin-top:6px;">Sarah &amp; Felipe</div>
          <div style="font-size:13px;margin-top:8px;opacity:0.85;">08 de Fevereiro de 2027</div>
        </div>
        <div style="padding:28px 24px;text-align:center;">
          <p style="color:#4a4640;font-size:15px;margin-bottom:20px;">
            Este é o ingresso digital de <strong>${escapeHtml(responsavelNome)}</strong>.
            Apresente o QR Code abaixo na entrada do evento.
          </p>
          <img src="${qrUrl}" alt="QR Code de entrada" style="width:220px;height:220px;border-radius:12px;border:1px solid #e4dbc8;" />
          <div style="margin-top:22px;text-align:left;display:inline-block;">
            <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#9a8f78;margin-bottom:8px;">Convidados neste ingresso</div>
            <ul style="list-style:none;padding:0;margin:0;color:#2d2a26;font-size:16px;line-height:1.7;">
              ${nomesHtml}
            </ul>
          </div>
        </div>
        <div style="background:#efe8db;color:#6b6355;text-align:center;font-size:12px;padding:14px;">
          Guarde este email — o QR Code será conferido na entrada.
        </div>
      </div>
    </div>`;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") ?? "Sarah & Felipe <onboarding@resend.dev>",
        to: [confirmacao.email],
        subject: "Seu ingresso digital — Casamento Sarah & Felipe 💍",
        html,
      }),
    });

    if (!resendResp.ok) {
      const t = await resendResp.text();
      throw new Error(`Falha ao enviar email via Resend: ${t}`);
    }

    await supabase
      .from("confirmacoes")
      .update({ qr_enviado_em: new Date().toISOString() })
      .eq("id", confirmacao_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
