// api/ingresso.js
// Gera a imagem do ingresso (PNG) que o robô manda no WhatsApp, com a
// identidade do site: aquarela de hortênsias e limões, monograma S&F,
// azul e amarelo, Playfair Display + Inter.
//
// Uso: /api/ingresso?t=<qr_token>
// O token é o mesmo do QR Code (assinado no Supabase). Aqui ele só é lido
// para mostrar os nomes; quem valida a entrada é a função validar-checkin.
// As imagens e fontes ficam em /assets/images/ingresso/.

import { ImageResponse } from '@vercel/og';
import qrcode from 'qrcode-generator';

export const config = { runtime: 'edge' };

const COR = {
    papel: '#F7F3F0',      // fundo da aquarela
    marinho: '#123F7A',    // azul do monograma
    azul: '#8FA8C8',       // azul do site
    amarelo: '#E3AE2F',    // amarelo do site, um pouco mais escuro para ler bem
    texto: '#2D2825',
    suave: '#736B67',
    cartao: '#FFFFFF',
};

const LARGURA = 1080;

// Atalho para montar os elementos sem JSX
const h = (type, style, children) => ({ type, props: { style: { display: 'flex', ...style }, children } });
const img = (src, width, height, style = {}) => ({ type: 'img', props: { src, width, height, style } });

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
        `<rect width="${lado}" height="${lado}" fill="#FFFFFF"/><path d="${d}" fill="${COR.marinho}"/></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function paraBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
}

async function baixar(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Falha ao carregar ${url}: ${resp.status}`);
    return resp.arrayBuffer();
}

export default async function handler(req) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('t') || '';
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 2000) {
        return new Response('Ingresso inválido', { status: 400 });
    }

    const base = new URL('/assets/images/ingresso/', req.url).href;
    const [topo, rodape, monograma, pf400, pf400i, pf600, in400, in500] = await Promise.all([
        baixar(base + 'fundo-topo.jpg'),
        baixar(base + 'fundo-base.jpg'),
        baixar(base + 'monograma.png'),
        baixar(base + 'playfair-400.woff'),
        baixar(base + 'playfair-400-italic.woff'),
        baixar(base + 'playfair-600.woff'),
        baixar(base + 'inter-400.woff'),
        baixar(base + 'inter-500.woff'),
    ]);

    const nomes = lerNomes(token);
    const listaNomes = nomes.length ? nomes : ['Convidados'];
    const altura = 1720 + Math.max(0, listaNomes.length - 2) * 52;

    const serif = { fontFamily: 'Playfair' };
    const sans = { fontFamily: 'Inter' };

    const arte = h('div', {
        position: 'relative', width: '100%', height: '100%', background: COR.papel,
        flexDirection: 'column', alignItems: 'center',
    }, [
        // Aquarela: hortênsias e limões no topo e no rodapé
        img(`data:image/jpeg;base64,${paraBase64(topo)}`, LARGURA, 420, { position: 'absolute', top: 0, left: 0 }),
        img(`data:image/jpeg;base64,${paraBase64(rodape)}`, LARGURA, 420, { position: 'absolute', bottom: 0, left: 0 }),

        // Monograma e nomes do casal
        h('div', { flexDirection: 'column', alignItems: 'center', marginTop: 70 }, [
            img(`data:image/png;base64,${paraBase64(monograma)}`, 230, 206),
            h('div', { ...sans, fontSize: 24, letterSpacing: 8, color: COR.suave, marginTop: 26, textTransform: 'uppercase' },
                'Ingresso do casamento de'),
            h('div', { ...serif, fontSize: 92, color: COR.marinho, marginTop: 6, fontWeight: 600 }, 'Sarah & Felipe'),
            h('div', { alignItems: 'center', marginTop: 10 }, [
                h('div', { width: 70, height: 2, background: COR.amarelo }),
                h('div', { ...serif, fontStyle: 'italic', fontSize: 36, color: COR.texto, margin: '0 22px' }, '08 de fevereiro de 2027'),
                h('div', { width: 70, height: 2, background: COR.amarelo }),
            ]),
        ]),

        // Cartão branco com o QR e os convidados
        h('div', {
            flexDirection: 'column', alignItems: 'center', marginTop: 44, width: 780,
            background: 'rgba(255,255,255,0.88)', borderRadius: 36, padding: '44px 50px 40px',
            border: `2px solid rgba(143,168,200,0.45)`, boxShadow: '0 10px 40px rgba(18,63,122,0.10)',
        }, [
            img(qrDataUrl(token), 440, 440, { borderRadius: 20 }),
            h('div', { ...sans, fontSize: 22, letterSpacing: 6, color: COR.azul, marginTop: 34, textTransform: 'uppercase', fontWeight: 500 },
                nomes.length > 1 ? 'Convidados' : 'Convidado(a)'),
            h('div', { flexDirection: 'column', alignItems: 'center', marginTop: 10 },
                listaNomes.map((n) => h('div', { ...serif, fontSize: 40, color: COR.texto, lineHeight: 1.3, textAlign: 'center' }, n))),
        ]),

        // Local e horário
        h('div', { flexDirection: 'column', alignItems: 'center', marginTop: 40 }, [
            h('div', { ...sans, fontSize: 30, color: COR.marinho, fontWeight: 500 }, '16h30  ·  Villa Garden Buffet'),
            h('div', { ...sans, fontSize: 24, color: COR.suave, marginTop: 8 }, 'Rua Dr. Rodrigo Codes Sandoval, 76 · Maraponga, Fortaleza'),
            h('div', { ...serif, fontStyle: 'italic', fontSize: 28, color: COR.texto, marginTop: 26 },
                'Apresente este QR Code na entrada. Contamos com você!'),
        ]),
    ]);

    return new ImageResponse(arte, {
        width: LARGURA,
        height: altura,
        fonts: [
            { name: 'Playfair', data: pf400, weight: 400, style: 'normal' },
            { name: 'Playfair', data: pf400i, weight: 400, style: 'italic' },
            { name: 'Playfair', data: pf600, weight: 600, style: 'normal' },
            { name: 'Inter', data: in400, weight: 400, style: 'normal' },
            { name: 'Inter', data: in500, weight: 500, style: 'normal' },
        ],
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
}
