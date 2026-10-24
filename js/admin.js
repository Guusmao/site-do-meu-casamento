// js/admin.js
// Página dos noivos: vê os grupos e as pessoas cadastradas, liga os pedidos
// "não achei meu convite" ao grupo certo, corrige nomes e exporta a planilha (CSV).
// A senha de admin não fica salva no código — é digitada e enviada a cada chamada,
// e conferida no servidor pela Edge Function `admin`.

const SUPABASE_URL = window.SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG.anonKey;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const telaSenha = document.getElementById('telaSenha');
const telaAdmin = document.getElementById('telaAdmin');
const senhaInput = document.getElementById('senhaInput');
const senhaErro = document.getElementById('senhaErro');
const resumo = document.getElementById('resumo');
const listaPendentes = document.getElementById('listaPendentes');
const listaGrupos = document.getElementById('listaGrupos');
const filtroGrupos = document.getElementById('filtroGrupos');
const filtroStatus = document.getElementById('filtroStatus');

let senhaAdmin = '';
let dados = { grupos: [], pessoas: [], confirmacoes: [], pendentes: [] };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Sem acento e minúsculo, para filtrar "joao" achando "João"
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function chamar(acao, extra = {}) {
    const resp = await fetch(`${FUNCTIONS_URL}/admin`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ senha: senhaAdmin, acao, ...extra })
    });
    const data = await resp.json();
    if (!resp.ok) throw Object.assign(new Error(data.error || 'Erro'), { status: resp.status });
    return data;
}

async function carregar() {
    dados = await chamar('listar');
    render();
}

// Executa uma ação, mostra o erro (se houver) e recarrega a lista
async function executar(acao, extra) {
    try {
        await chamar(acao, extra);
        await carregar();
    } catch (err) {
        alert(err.message);
    }
}

document.getElementById('btnEntrar').addEventListener('click', entrar);
senhaInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });

async function entrar() {
    senhaAdmin = senhaInput.value.trim();
    if (!senhaAdmin) return;
    senhaErro.classList.add('hidden');
    try {
        await carregar();
        telaSenha.classList.add('hidden');
        telaAdmin.classList.remove('hidden');
    } catch (err) {
        senhaErro.textContent = err.message;
        senhaErro.classList.remove('hidden');
    }
}

document.getElementById('btnAtualizar').addEventListener('click', () => carregar().catch((e) => alert(e.message)));
document.getElementById('btnExportar').addEventListener('click', exportarCsv);
filtroGrupos.addEventListener('input', renderGrupos);
filtroStatus.addEventListener('change', renderGrupos);

function pessoasDoGrupo(grupoId) {
    return dados.pessoas.filter((p) => p.grupo_id === grupoId);
}

function confirmacaoDoGrupo(grupoId) {
    return dados.confirmacoes.find((c) => c.grupo_id === grupoId);
}

function render() {
    const totalVagas = dados.grupos.reduce((s, g) => s + g.quantidade_maxima, 0);
    const vao = dados.pessoas.filter((p) => p.vai).length;
    const pendentesAbertos = dados.pendentes.filter((p) => p.status === 'pendente').length;
    resumo.innerHTML = `
        <span>Grupos: <strong>${dados.grupos.length}</strong></span>
        <span>Vagas: <strong>${totalVagas}</strong></span>
        <span>Nomes cadastrados: <strong>${dados.pessoas.length}</strong></span>
        <span>Vão: <strong>${vao}</strong></span>
        <span>Grupos confirmados: <strong>${dados.confirmacoes.length}</strong></span>
        <span>Pendentes: <strong>${pendentesAbertos}</strong></span>`;
    renderPendentes();
    renderGrupos();
}

function opcoesGrupos() {
    return dados.grupos.map((g) => {
        const ocupadas = pessoasDoGrupo(g.id).length;
        const cheio = ocupadas >= g.quantidade_maxima;
        return `<option value="${g.id}" ${cheio ? 'disabled' : ''}>${esc(g.responsavel)} (${ocupadas}/${g.quantidade_maxima})</option>`;
    }).join('');
}

function renderPendentes() {
    const abertos = dados.pendentes.filter((p) => p.status === 'pendente');
    if (abertos.length === 0) {
        listaPendentes.innerHTML = '<p class="muted">Nenhum pedido pendente.</p>';
        return;
    }
    listaPendentes.innerHTML = '';
    abertos.forEach((p) => {
        const [nome, ...resto] = p.nome_digitado.trim().split(/\s+/);
        const item = document.createElement('div');
        item.className = 'item';
        item.innerHTML = `
            <div class="item-topo">
                <strong>${esc(p.nome_digitado)}</strong>
                <span class="muted">${new Date(p.criado_em).toLocaleString('pt-BR')}</span>
            </div>
            <p class="muted" style="margin:4px 0 10px;">Contato: ${esc(p.contato)}${p.mensagem ? `<br>Mensagem: ${esc(p.mensagem)}` : ''}</p>
            <div class="linha">
                <input class="p-nome" value="${esc(nome)}" placeholder="Nome">
                <input class="p-sobrenome" value="${esc(resto.join(' '))}" placeholder="Sobrenome">
                <input class="p-parentesco" placeholder="Parentesco (opcional)">
            </div>
            <div class="linha">
                <select class="p-grupo"><option value="">Escolha o grupo...</option>${opcoesGrupos()}</select>
                <button class="p-vincular">Adicionar ao grupo</button>
                <button class="perigo p-descartar">Descartar</button>
            </div>`;
        item.querySelector('.p-vincular').addEventListener('click', () => {
            const grupo_id = item.querySelector('.p-grupo').value;
            if (!grupo_id) return alert('Escolha o grupo.');
            executar('adicionar_pessoa', {
                grupo_id,
                pendente_id: p.id,
                nome: item.querySelector('.p-nome').value,
                sobrenome: item.querySelector('.p-sobrenome').value,
                parentesco: item.querySelector('.p-parentesco').value
            });
        });
        item.querySelector('.p-descartar').addEventListener('click', () => {
            if (confirm(`Descartar o pedido de ${p.nome_digitado}?`)) executar('descartar_pendente', { pendente_id: p.id });
        });
        listaPendentes.appendChild(item);
    });
}

function renderGrupos() {
    const termo = normalizar(filtroGrupos.value.trim());
    const status = filtroStatus.value;

    const grupos = dados.grupos.filter((g) => {
        const pessoas = pessoasDoGrupo(g.id);
        if (status === 'sem_nomes' && pessoas.length > 0) return false;
        if (status === 'incompleto' && pessoas.length >= g.quantidade_maxima) return false;
        if (status === 'confirmado' && !confirmacaoDoGrupo(g.id)) return false;
        if (!termo) return true;
        return normalizar(g.responsavel).includes(termo) ||
            pessoas.some((p) => normalizar(`${p.nome} ${p.sobrenome}`).includes(termo));
    });

    listaGrupos.innerHTML = grupos.length === 0 ? '<p class="muted">Nenhum grupo encontrado.</p>' : '';
    grupos.forEach((g) => {
        const pessoas = pessoasDoGrupo(g.id);
        const conf = confirmacaoDoGrupo(g.id);
        const item = document.createElement('div');
        item.className = 'item';
        item.innerHTML = `
            <div class="item-topo">
                <strong>${esc(g.responsavel)}</strong>
                <span>
                    <span class="tag">${esc(g.origem)}</span>
                    <span class="tag">${pessoas.length}/${g.quantidade_maxima} nomes</span>
                    ${conf ? '<span class="tag ok">confirmado</span>' : ''}
                </span>
            </div>
            ${g.observacoes ? `<p class="muted" style="margin:4px 0;">${esc(g.observacoes)}</p>` : ''}
            ${conf ? `<p class="muted" style="margin:4px 0;">Ingresso: ${esc(conf.email)}${conf.qr_enviado_em ? ' (enviado)' : ' (não enviado)'}</p>` : ''}
            <div class="g-pessoas" style="margin-top:8px;"></div>`;

        const lista = item.querySelector('.g-pessoas');
        pessoas.forEach((p) => {
            const linha = document.createElement('div');
            linha.className = 'pessoa';
            linha.innerHTML = `
                <span>${esc(p.nome)} ${esc(p.sobrenome)}${p.parentesco ? ` <span class="muted">(${esc(p.parentesco)})</span>` : ''}
                    <span class="tag ${p.vai ? 'ok' : 'nao'}">${p.vai ? 'vai' : 'não vai'}</span></span>
                <span>
                    <button class="sec b-editar">Editar</button>
                    <button class="perigo b-remover">Remover</button>
                </span>`;
            linha.querySelector('.b-editar').addEventListener('click', () => {
                const nome = prompt('Nome:', p.nome);
                if (nome === null) return;
                const sobrenome = prompt('Sobrenome:', p.sobrenome);
                if (sobrenome === null) return;
                const parentesco = prompt('Parentesco (opcional):', p.parentesco || '');
                if (parentesco === null) return;
                executar('editar_pessoa', { pessoa_id: p.id, nome, sobrenome, parentesco });
            });
            linha.querySelector('.b-remover').addEventListener('click', () => {
                const aviso = conf ? '\n\nO grupo já confirmou: um novo QR Code será enviado e o antigo deixa de valer.' : '';
                if (confirm(`Remover ${p.nome} ${p.sobrenome} deste grupo?${aviso}`)) executar('remover_pessoa', { pessoa_id: p.id });
            });
            lista.appendChild(linha);
        });

        if (pessoas.length < g.quantidade_maxima) {
            const add = document.createElement('div');
            add.className = 'linha';
            add.style.marginTop = '8px';
            add.innerHTML = `
                <input class="a-nome" placeholder="Nome">
                <input class="a-sobrenome" placeholder="Sobrenome">
                <input class="a-parentesco" placeholder="Parentesco">
                <button class="sec a-adicionar">Adicionar</button>`;
            add.querySelector('.a-adicionar').addEventListener('click', () => executar('adicionar_pessoa', {
                grupo_id: g.id,
                nome: add.querySelector('.a-nome').value,
                sobrenome: add.querySelector('.a-sobrenome').value,
                parentesco: add.querySelector('.a-parentesco').value
            }));
            lista.appendChild(add);
        }
        listaGrupos.appendChild(item);
    });
}

// Uma linha por pessoa (e uma linha por vaga ainda vazia), pronto pra abrir no Excel.
// Usa ";" e BOM UTF-8 porque é o que o Excel em português espera.
function exportarCsv() {
    const celula = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [['Grupo', 'Origem', 'Vagas', 'Observações', 'Nome', 'Sobrenome', 'Parentesco', 'Vai', 'Grupo confirmado', 'Contato do ingresso']];

    dados.grupos.forEach((g) => {
        const pessoas = pessoasDoGrupo(g.id);
        const conf = confirmacaoDoGrupo(g.id);
        const base = [g.responsavel, g.origem, g.quantidade_maxima, g.observacoes];
        const fim = [conf ? 'sim' : 'não', conf?.email];
        pessoas.forEach((p) => linhas.push([...base, p.nome, p.sobrenome, p.parentesco, p.vai ? 'sim' : 'não', ...fim]));
        for (let i = pessoas.length; i < g.quantidade_maxima; i++) linhas.push([...base, '', '', '', '', ...fim]);
    });

    const csv = '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `convidados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
