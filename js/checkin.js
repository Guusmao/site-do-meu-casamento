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

async function consultarToken(token) {
    areaResultado.innerHTML = '<p>Verificando...</p>';
    try {
        const resp = await fetch(`${FUNCTIONS_URL}/validar-checkin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ token, senha_portaria: senhaPortaria })
        });
        const data = await resp.json();

        if (resp.status === 401) {
            // Senha errada — manda voltar pra tela de senha
            telaLeitor.classList.add('hidden');
            telaSenha.classList.remove('hidden');
            senhaErro.textContent = data.error;
            senhaErro.classList.remove('hidden');
            if (html5QrCode) await html5QrCode.stop();
            return;
        }

        if (!resp.ok) {
            areaResultado.innerHTML = `<div class="msg-erro">${data.error}</div>`;
            return;
        }

        renderResultado(token, data);
    } catch (err) {
        areaResultado.innerHTML = `<div class="msg-erro">Erro ao verificar: ${err}</div>`;
    }
}

function renderResultado(token, data) {
    const linhas = data.nomes.map((n) => `
        <div class="nome-item ${n.ja_entrou ? 'entrou' : ''}">
            <span>${n.nome} ${n.ja_entrou ? '<span class="tag-entrou">já entrou</span>' : ''}</span>
            ${n.ja_entrou ? '' : `<button class="btn-liberar" data-nome="${n.nome}">Liberar entrada</button>`}
        </div>
    `).join('');

    areaResultado.innerHTML = `
        <h2>${data.responsavel}</h2>
        ${linhas}
    `;

    areaResultado.querySelectorAll('.btn-liberar').forEach((btn) => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Liberando...';
            try {
                const resp = await fetch(`${FUNCTIONS_URL}/validar-checkin`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'apikey': SUPABASE_ANON_KEY
                    },
                    body: JSON.stringify({ token, senha_portaria: senhaPortaria, nome: btn.dataset.nome })
                });
                const result = await resp.json();
                if (!resp.ok) {
                    alert(result.error || 'Erro ao liberar entrada.');
                    btn.disabled = false;
                    btn.textContent = 'Liberar entrada';
                    return;
                }
                await consultarToken(token); // recarrega o estado (marca como "já entrou")
            } catch (err) {
                alert('Erro ao liberar entrada: ' + err);
                btn.disabled = false;
                btn.textContent = 'Liberar entrada';
            }
        });
    });
}

btnNovaLeitura.addEventListener('click', async () => {
    if (html5QrCode) {
        try { await html5QrCode.resume(); } catch { iniciarLeitor(); }
    }
    areaResultado.innerHTML = '';
});
