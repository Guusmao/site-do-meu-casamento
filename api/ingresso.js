// api/ingresso.js
// Gera a imagem do ingresso (PNG) que o robô manda no WhatsApp:
// a mesma arte do antigo ingresso por e-mail, com o QR Code e os nomes.
//
// Uso: /api/ingresso?t=<qr_token>
// O token é o mesmo do QR Code (assinado no Supabase). Aqui ele só é lido
// para mostrar os nomes; quem valida a entrada é a função validar-checkin.

import { ImageResponse } from '@vercel/og';
import qrcode from 'qrcode-generator';

export const config = { runtime: 'edge' };

const CORES = {
    fundo: '#f3efe9',
    cartao: '#fffdf9',
    borda: '#d9cdb8',
    escuro: '#2d2a26',
    claro: '#f3efe9',
    texto: '#4a4640',
    rotulo: '#9a8f78',
    rodape: '#efe8db',
    rodapeTexto: '#6b6355',
};

// Atalho para montar os elementos sem JSX
const h = (type, style, children) => ({ type, props: { style: { display: 'flex', ...style }, children } });

function lerNomes(token) {
    try {
        let b64 = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const payload = JSON.parse(new TextDecoder().decode(bytes));
        return Array.isArray(payload.nomes) ? payload.nomes.map(String).slice(0, 12) : [];
    } catch {
        return [];
    }
}

// QR Code em SVG, gerado aqui mesmo (sem depender de serviço externo)
function qrDataUrl(texto) {
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    const m = 2; // margem em módulos
    let d = '';
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            if (qr.isDark(y, x)) d += `M${x + m} ${y + m}h1v1h-1z`;
        }
    }
    const lado = n + m * 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges">` +
        `<rect width="${lado}" height="${lado}" fill="${CORES.cartao}"/><path d="${d}" fill="${CORES.escuro}"/></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

async function carregarFonte(url) {
    try {
        const resp = await fetch(url);
        return resp.ok ? await resp.arrayBuffer() : null;
    } catch {
        return null;
    }
}

export default async function handler(req) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('t') || '';
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 2000) {
        return new Response('Ingresso inválido', { status: 400 });
    }

    const nomes = lerNomes(token);
    const qrUrl = qrDataUrl(token);

    const playfair = await carregarFonte(
        'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-normal.ttf'
    );
    const serif = playfair ? 'Playfair' : 'serif';

    const largura = 1080;
    const alturaNomes = Math.max(1, nomes.length) * 46;
    const altura = 1240 + alturaNomes;

    const arte = h('div', {
        width: '100%', height: '100%', background: CORES.fundo,
        alignItems: 'center', justifyContent: 'center', padding: 60,
    }, [
        h('div', {
            flexDirection: 'column', width: '100%', height: '100%',
            background: CORES.cartao, border: `2px solid ${CORES.borda}`, borderRadius: 36, overflow: 'hidden',
        }, [
            // Faixa escura do topo
            h('div', {
                flexDirection: 'column', alignItems: 'center', background: CORES.escuro,
                color: CORES.claro, padding: '56px 40px',
            }, [
                h('div', { fontSize: 26, letterSpacing: 7, textTransform: 'uppercase', opacity: 0.8 }, 'Convite de Casamento'),
                h('div', { fontSize: 76, marginTop: 14, fontFamily: serif }, 'Sarah & Felipe'),
                h('div', { fontSize: 28, marginTop: 14, opacity: 0.85 }, '08 de Fevereiro de 2027'),
            ]),
            // QR e nomes
            h('div', { flexDirection: 'column', alignItems: 'center', padding: '44px 60px', flexGrow: 1 }, [
                h('div', { fontSize: 28, color: CORES.texto, textAlign: 'center', marginBottom: 32 },
                    'Apresente este QR Code na entrada do evento.'),
                {
                    type: 'img',
                    props: {
                        src: qrUrl, width: 480, height: 480,
                        style: { borderRadius: 24, border: `2px solid #e4dbc8` },
                    },
                },
                h('div', {
                    fontSize: 22, letterSpacing: 5, textTransform: 'uppercase',
                    color: CORES.rotulo, marginTop: 40, marginBottom: 12,
                }, 'Convidados neste ingresso'),
                h('div', { flexDirection: 'column', alignItems: 'center' },
                    (nomes.length ? nomes : ['—']).map((n) =>
                        h('div', { fontSize: 34, color: CORES.escuro, lineHeight: 1.35, fontFamily: serif }, n))),
            ]),
            // Rodapé
            h('div', {
                justifyContent: 'center', background: CORES.rodape, color: CORES.rodapeTexto,
                fontSize: 24, padding: '26px 30px',
            }, 'Guarde esta mensagem: o QR Code será conferido na entrada.'),
        ]),
    ]);

    return new ImageResponse(arte, {
        width: largura,
        height: altura,
        fonts: playfair ? [{ name: 'Playfair', data: playfair, weight: 400, style: 'normal' }] : undefined,
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
}
