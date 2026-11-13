// js/checkin.js
// Página usada pela pessoa da portaria no dia do evento.
// Lê o QR Code com a câmera e valida contra a Edge Function `validar-checkin`.
// A senha da portaria não fica salva em lugar nenhum do código — é digitada
// na hora e enviada junto de cada verificação.

const SUPABASE_URL = 'https://faccbfidybfsoplaeqjw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhY2NiZmlkeWJmc29wbGFlcWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTY4ODYsImV4cCI6MjA5Njc5Mjg4Nn0.SNPbyvdHeICpuswamoUeJ-bAUtMosv7RvlVoxYyOTc8';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const telaSenha = document.getElementById('telaSenha');
const telaLeitor = document.getElementById('telaLeitor');
const senhaInput = document.getElementById('senhaInput');
const senhaErro = document.getElementById('senhaErro');
const btnEntrar = document.getElementById('btnEntrar');
const btnNovaLeitura = document.getElementById('btnNovaLeitura');
const areaResultado = document.getElementById('areaResultado');

let senhaPortaria = '';
let html5QrCode = null;

btnEntrar.addEventListener('click', () => {
    if (!senhaInput.value.trim()) return;
    senhaPortaria = senhaInput.value.trim();
    senhaErro.classList.add('hidden');
    telaSenha.classList.add('hidden');
    telaLeitor.classList.remove('hidden');
    iniciarLeitor();
});

function iniciarLeitor() {
    areaResultado.innerHTML = '';
    html5QrCode = new Html5Qrcode('reader');
    html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        onQrLido,
        () => {} // erros de frame sem QR são ignorados
    ).catch((err) => {
        areaResultado.innerHTML = `<div class="msg-erro">Não foi possível acessar a câmera: ${err}</div>`;
    });
}

async function onQrLido(token) {
    await html5QrCode.pause(true);
    await consultarToken(token);
}

// Aviso grande no topo do resultado: verde (pode entrar) ou vermelho
// (QR inválido ou já usado). Vibra o celular para a portaria sentir.
function mostrarAviso(tipo, titulo, detalhe = '') {
    const icone = tipo === 'ok' ? '✓' : '✕';
    if (navigator.vibrate) navigator.vibrate(tipo === 'ok' ? 120 : [80, 60, 80]);
    return `
        <div class="aviso aviso-${tipo}" role="status">
            <span class="aviso-icone" aria-hidden="true">${icone}</span>
            <div>
                <strong>${titulo}</strong>
                ${detalhe ? `<span>${detalhe}</span>` : ''}
            </div>
        </div>`;
}

const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function chamarFuncao(corpo) {
    const resp = await fetch(`${FUNCTIONS_URL}/validar-checkin`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ senha_portaria: senhaPortaria, ...corpo })
    });
    const data = await resp.json().catch(() => ({}));
    return { resp, data };
}

async function voltarParaSenha(mensagem) {
    telaLeitor.classList.add('hidden');
    telaSenha.classList.remove('hidden');
    senhaErro.textContent = mensagem;
    senhaErro.classList.remove('hidden');
    if (html5QrCode) { try { await html5QrCode.stop(); } catch {} }
}

// avisoExtra: aviso que substitui o automático (ex.: depois de liberar alguém)
async function consultarToken(token, avisoExtra = '') {
    areaResultado.innerHTML = '<p class="verificando">Verificando...</p>';
    try {
        const { resp, data } = await chamarFuncao({ token });

        if (resp.status === 401) return voltarParaSenha(data.error);

        if (!resp.ok) {
            areaResultado.innerHTML = mostrarAviso('erro', 'QR Code inválido', escapar(data.error || 'Não foi possível validar este QR Code.'));
            return;
        }

        renderResultado(token, data, avisoExtra);
    } catch (err) {
        areaResultado.innerHTML = mostrarAviso('erro', 'Erro ao verificar', escapar(err));
    }
    // No celular o resultado fica abaixo da câmera: rola até o aviso
    areaResultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderResultado(token, data, avisoExtra) {
    const pendentes = data.nomes.filter((n) => !n.ja_entrou);

    let aviso = avisoExtra;
    if (!aviso) {
        aviso = pendentes.length === 0
            ? mostrarAviso('erro', 'QR Code já usado', 'Todos deste convite já entraram.')
            : mostrarAviso('ok', 'QR Code válido', pendentes.length === 1 ? '1 pessoa pode entrar.' : `${pendentes.length} pessoas podem entrar.`);
    }

    const linhas = data.nomes.map((n) => `
        <div class="nome-item ${n.ja_entrou ? 'entrou' : ''}">
            <span>${escapar(n.nome)} ${n.ja_entrou ? '<span class="tag-entrou">já entrou</span>' : ''}</span>
            ${n.ja_entrou ? '' : `<button class="btn-liberar" data-nome="${escapar(n.nome)}">Liberar</button>`}
        </div>
    `).join('');

    areaResultado.innerHTML = `
        ${aviso}
        <h2>${escapar(data.responsavel)}</h2>
        ${pendentes.length > 1 ? `<button class="btn-liberar-todos" id="btnLiberarTodos">Liberar todos (${pendentes.length})</button>` : ''}
        ${linhas}
    `;

    const botoes = Array.from(areaResultado.querySelectorAll('.btn-liberar'));

    // Libera uma pessoa; devolve a mensagem de erro, se houver
    const liberar = async (nome) => {
        const { resp, data: r } = await chamarFuncao({ token, nome });
        if (resp.status === 401) { await voltarParaSenha(r.error); return 'senha'; }
        // 409 = já tinha entrado (outra pessoa da portaria liberou antes): não é erro
        if (!resp.ok && resp.status !== 409) return r.error || 'Erro ao liberar entrada.';
        return null;
    };

    botoes.forEach((btn) => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Liberando...';
            try {
                const erro = await liberar(btn.dataset.nome);
                if (erro === 'senha') return;
                await consultarToken(token, erro
                    ? mostrarAviso('erro', 'Não foi possível liberar', escapar(erro))
                    : mostrarAviso('ok', 'Entrada liberada', `${escapar(btn.dataset.nome)} pode entrar.`));
            } catch (err) {
                await consultarToken(token, mostrarAviso('erro', 'Erro ao liberar entrada', escapar(err)));
            }
        });
    });

    const btnTodos = document.getElementById('btnLiberarTodos');
    btnTodos?.addEventListener('click', async () => {
        btnTodos.disabled = true;
        botoes.forEach((b) => { b.disabled = true; });
        btnTodos.textContent = 'Liberando...';
        const falhas = [];
        for (const n of pendentes) {
            try {
                const erro = await liberar(n.nome);
                if (erro === 'senha') return;
                if (erro) falhas.push(n.nome);
            } catch { falhas.push(n.nome); }
        }
        await consultarToken(token, falhas.length
            ? mostrarAviso('erro', 'Alguns não foram liberados', `Tente de novo: ${escapar(falhas.join(', '))}.`)
            : mostrarAviso('ok', 'Entrada liberada', 'Todo o grupo pode entrar.'));
    });
}

btnNovaLeitura.addEventListener('click', async () => {
    if (html5QrCode) {
        try { await html5QrCode.resume(); } catch { iniciarLeitor(); }
    }
    areaResultado.innerHTML = '';
});
