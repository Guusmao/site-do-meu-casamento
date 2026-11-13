// supabase/functions/enviar-lembretes/index.ts
// Lembretes automáticos do robô, cada um com o ingresso (arte + QR) de novo:
//   - faltam 30 dias  (09/01/2027)
//   - faltam 15 dias  (24/01/2027)
//   - no dia          (08/02/2027, de manhã)
// Chamada a cada 10 minutos pelo pg_cron (migration 20261113180000_robo_lembretes).
// Em cada chamada manda no máximo LOTE mensagens, com pausas entre elas, para o
// número não parecer robô de spam. Cada lembrete sai uma vez por grupo
// (índice único em mensagens_whatsapp), então chamar de novo nunca duplica.
// Por isso pode ser chamada com a chave pública (anon): no pior caso só
// adianta um envio que já ia acontecer.
//
// Teste: POST { "teste": true, "confirmacao_id": "..." } manda os 3 lembretes
// na hora, mas só para grupos cujo responsável começa com "Teste".

import { createClient } from "npm:@supabase/supabase-js@2";
import { usarEvolution } from "../_shared/whatsapp.ts";
import { Confirmacao, enviarIngresso, esperar, juntarNomes, nomesQueVao, urlSite } from "../_shared/ingresso.ts";

const LOTE = 6;

type Lembrete = {
  tipo: string;
  data: string; // dia do envio (horário de Brasília)
  diasDeJanela: number; // se o cron falhar, ainda envia nos dias seguintes
  horas: [number, number]; // faixa de horário de Brasília em que pode enviar
  legenda: (primeiroNome: string, nomes: string[]) => string;
};

const LEMBRETES: Lembrete[] = [
  {
    tipo: "lembrete_30_dias",
    data: "2027-01-09",
    diasDeJanela: 3,
    horas: [9, 20],
    legenda: (nome, nomes) =>
      [
        `Oi, ${nome}! 💍`,
        "",
        "Falta só *1 mês* para o casamento da Sarah e do Felipe! Estamos contando os dias para celebrar com vocês.",
        "",
        `📅 08/02/2027, às 16h30`,
        "📍 Villa Garden Buffet, Rua Dr. Rodrigo Codes Sandoval, 76, Maraponga, Fortaleza",
        "",
        `Mandamos o ingresso de novo para ficar fácil de achar${nomes.length > 1 ? ` (${juntarNomes(nomes)})` : ""}. É só mostrar este QR Code na entrada.`,
        "",
        `Traje, mapa e lista de presentes: ${urlSite()}`,
      ].join("\n"),
  },
  {
    tipo: "lembrete_15_dias",
    data: "2027-01-24",
    diasDeJanela: 3,
    horas: [9, 20],
    legenda: (nome) =>
      [
        `Oi, ${nome}! ✨`,
        "",
        "Faltam *15 dias* para o grande dia! Já separou a roupa? O traje é esporte fino/social, e pedimos para evitar as cores reservadas aos padrinhos, damas e pais (estão no site).",
        "",
        "📅 08/02/2027, às 16h30",
        "📍 Villa Garden Buffet, Maraponga, Fortaleza",
        "",
        "Aqui está o ingresso mais uma vez. Guarde esta mensagem! 🥂",
        "",
        urlSite(),
      ].join("\n"),
  },
  {
    tipo: "lembrete_dia",
    data: "2027-02-08",
    diasDeJanela: 1,
    horas: [8, 13],
    legenda: (nome) =>
      [
        `Bom dia, ${nome}! 🎉`,
        "",
        "*Hoje é o dia!* A Sarah e o Felipe esperam vocês às *16h30* no Villa Garden Buffet.",
        "📍 Rua Dr. Rodrigo Codes Sandoval, 76, Maraponga, Fortaleza",
        "",
        "Deixe este QR Code à mão para mostrar na entrada. Até daqui a pouco! 💍",
      ].join("\n"),
  },
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const corpo = await req.json().catch(() => ({}));

  try {
    if (!usarEvolution()) return json({ ok: false, error: "Evolution não configurada" }, 500);
    if (corpo?.teste) return json(await enviarTeste(supabase, corpo.confirmacao_id));

    const { dia, hora } = agoraBrasilia();
    const lembrete = LEMBRETES.find((l) => {
      const fim = somarDias(l.data, l.diasDeJanela - 1);
      return dia >= l.data && dia <= fim && hora >= l.horas[0] && hora < l.horas[1];
    });
    if (!lembrete) return json({ ok: true, nada: "nenhum lembrete agora", dia, hora });

    // Quem ainda não recebeu este lembrete
    const { data: confirmacoes } = await supabase
      .from("confirmacoes")
      .select("id, whatsapp, qr_token, nomes_confirmados, qr_enviado_em")
      .not("whatsapp", "is", null)
      .not("qr_token", "is", null);

    const { data: jaForam } = await supabase
      .from("mensagens_whatsapp")
      .select("confirmacao_id, status")
      .eq("tipo", lembrete.tipo);
    const enviados = new Set((jaForam ?? []).filter((m) => m.status !== "erro").map((m) => m.confirmacao_id));
    const erros = new Map<string, number>();
    for (const m of jaForam ?? []) if (m.status === "erro") erros.set(m.confirmacao_id, (erros.get(m.confirmacao_id) ?? 0) + 1);

    const doisDiasAtras = Date.now() - 2 * 86400_000;
    const fila = (confirmacoes ?? []).filter((c: any) => {
      if (enviados.has(c.id) || (erros.get(c.id) ?? 0) >= 3) return false;
      if (nomesQueVao(c).length === 0) return false;
      // Quem acabou de confirmar já recebeu o ingresso (menos no dia do casamento)
      if (lembrete.tipo !== "lembrete_dia" && c.qr_enviado_em && Date.parse(c.qr_enviado_em) > doisDiasAtras) return false;
      return true;
    });

    let enviadosAgora = 0;
    const falhas: string[] = [];
    for (const c of fila.slice(0, LOTE)) {
      // Reserva o envio antes de mandar: se outra chamada rodar junto, o índice único barra
      const { data: reserva, error } = await supabase
        .from("mensagens_whatsapp")
        .insert({ confirmacao_id: c.id, tipo: lembrete.tipo, telefone: c.whatsapp, template: `evolution:${lembrete.tipo}` })
        .select("id")
        .single();
      if (error || !reserva) continue;

      if (enviadosAgora > 0) await esperar(6000 + Math.random() * 6000);
      const nomes = nomesQueVao(c);
      try {
        await enviarIngresso(supabase, c, lembrete.tipo, lembrete.legenda(nomes[0].split(" ")[0], nomes), reserva.id);
        enviadosAgora++;
      } catch (e) {
        falhas.push(`${c.id}: ${e}`);
      }
    }

    return json({ ok: true, lembrete: lembrete.tipo, enviados: enviadosAgora, faltam: Math.max(0, fila.length - LOTE), falhas });
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 400);
  }
});

// Manda os 3 lembretes na hora para um grupo de teste
async function enviarTeste(supabase: any, confirmacaoId: string) {
  const { data: c } = await supabase
    .from("confirmacoes")
    .select("id, whatsapp, qr_token, nomes_confirmados, convidados_lista(responsavel)")
    .eq("id", confirmacaoId)
    .single();
  const responsavel: string = c?.convidados_lista?.responsavel ?? "";
  if (!c || !/^teste/i.test(responsavel)) throw new Error("Teste só funciona com grupos cujo responsável começa com 'Teste'.");
  if (!c.whatsapp || !c.qr_token) throw new Error("Grupo de teste sem WhatsApp ou sem ingresso.");

  const nomes = nomesQueVao(c as Confirmacao);
  for (const [i, l] of LEMBRETES.entries()) {
    if (i > 0) await esperar(5000);
    await enviarIngresso(supabase, c, `teste_${l.tipo}`, l.legenda(nomes[0].split(" ")[0], nomes));
  }
  return { ok: true, teste: LEMBRETES.map((l) => l.tipo) };
}

function agoraBrasilia() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const p = (t: string) => partes.find((x) => x.type === t)!.value;
  return { dia: `${p("year")}-${p("month")}-${p("day")}`, hora: Number(p("hour")) };
}

function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
