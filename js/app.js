import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Conexão com o Supabase
const supabaseUrl = 'https://faccbfidybfsoplaeqjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhY2NiZmlkeWJmc29wbGFlcWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTY4ODYsImV4cCI6MjA5Njc5Mjg4Nn0.SNPbyvdHeICpuswamoUeJ-bAUtMosv7RvlVoxYyOTc8';
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {

    // Inicializa os ícones da biblioteca Lucide
    lucide.createIcons();
    document.body.style.overflow = 'hidden';
    document.body.classList.add('overlay-active');

    const envelopeOverlay = document.getElementById('envelopeOverlay');
    const envelopeWrapper = envelopeOverlay?.querySelector('.envelope-wrapper');
    const heartSeal = document.getElementById('heartSeal');

    if (envelopeOverlay && envelopeWrapper && heartSeal) {
        const openEnvelope = () => {
            if (envelopeWrapper.classList.contains('flap')) return;

            envelopeWrapper.classList.add('flap');

            setTimeout(() => {
                envelopeOverlay.classList.add('hidden');
                document.body.style.overflow = '';
                document.body.classList.remove('overlay-active');
            }, 1300);
        };

        heartSeal.addEventListener('click', openEnvelope);
        heartSeal.addEventListener('touchend', openEnvelope);
    }

    /* ==========================================================================
       1. NAVEGAÇÃO E CABEÇALHO
       ========================================================================== */
    const navbar = document.querySelector('.navbar-container');
    const menuToggle = document.getElementById('menuToggle');
    const navLinksContainer = document.getElementById('navLinks');
    const navLinks = document.querySelectorAll('.nav-link');

    const setMenuIcon = (iconName) => {
        menuToggle.innerHTML = `<i data-lucide="${iconName}"></i>`;
        lucide.createIcons();
    };

    // Adiciona classe ao menu quando o usuário rola a página
    const navbarScrollTrigger = 120;
    const updateNavbarOnScroll = () => {
        if (window.scrollY > navbarScrollTrigger) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    };

    window.addEventListener('scroll', updateNavbarOnScroll);
    updateNavbarOnScroll();

    // Abre e fecha o menu no celular
    menuToggle.addEventListener('click', () => {
        navLinksContainer.classList.toggle('active');
        // Troca o ícone entre menu (☰) e fechar (X)
        const isActive = navLinksContainer.classList.contains('active');
        menuToggle.setAttribute('aria-expanded', String(isActive));
        if (isActive) {
            setMenuIcon('x');
        } else {
            setMenuIcon('menu');
        }
    });

    // Fecha o menu ao clicar em qualquer link de navegação
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinksContainer.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
            setMenuIcon('menu');
        });
    });

    /* ==========================================================================
       2. CONTAGEM REGRESSIVA
       ========================================================================== */
    // Data e horário do casamento: 08 de Fevereiro de 2027 às 16:30
    const weddingDate = new Date('Feb 08, 2027 16:30:00').getTime();

    const updateCountdown = () => {
        const now = new Date().getTime();
        const difference = weddingDate - now;

        const daysEl = document.getElementById('days');
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');

        if (difference <= 0) {
            // O dia do casamento chegou!
            document.getElementById('countdown').innerHTML = `
                <div class="wedding-day-message" style="font-family: var(--font-serif); font-size: 1.8rem; color: var(--color-accent); font-style: italic; margin-top: 15px;">
                    Chegou o Grande Dia! ♥
                </div>
            `;
            return;
        }

        // Calcula dias, horas, minutos e segundos restantes
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        // Atualiza os valores na tela com zero à esquerda (ex: 09)
        daysEl.textContent = String(days).padStart(2, '0');
        hoursEl.textContent = String(hours).padStart(2, '0');
        minutesEl.textContent = String(minutes).padStart(2, '0');
        secondsEl.textContent = String(seconds).padStart(2, '0');
    };

    // Executa imediatamente e repete a cada segundo
    updateCountdown();
    setInterval(updateCountdown, 1000);

    /* ==========================================================================
       3. ANIMAÇÕES DE REVELAÇÃO AO ROLAR A PÁGINA
       ========================================================================== */
    const revealElements = document.querySelectorAll('.scroll-reveal');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                revealObserver.unobserve(entry.target); // Anima apenas uma vez
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px' // Dispara um pouco antes do elemento aparecer na tela
    });

    revealElements.forEach(el => revealObserver.observe(el));

    /* ==========================================================================
       4. GALERIA DE FOTOS COM LIGHTBOX
       ========================================================================== */
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightboxModal = document.getElementById('lightboxModal');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');

    // Lista de imagens da galeria
    const galleryImages = [
        'assets/images/gallery/gallery-rings.png',
        'assets/images/gallery/gallery-bouquet.png',
        'assets/images/gallery/gallery-table.png',
        'assets/images/gallery/gallery-cake.png'
    ];
    let currentImgIndex = 0;

    const openLightbox = (index) => {
        currentImgIndex = parseInt(index);
        lightboxImg.src = galleryImages[currentImgIndex];
        lightboxImg.alt = galleryItems[currentImgIndex].querySelector('img').alt;
        lightboxModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Impede rolagem da página enquanto o modal está aberto
    };

    const closeLightbox = () => {
        lightboxModal.classList.remove('active');
        document.body.style.overflow = ''; // Restaura a rolagem da página
    };

    const prevImage = (e) => {
        e.stopPropagation();
        currentImgIndex = (currentImgIndex - 1 + galleryImages.length) % galleryImages.length;
        lightboxImg.src = galleryImages[currentImgIndex];
        lightboxImg.alt = galleryItems[currentImgIndex].querySelector('img').alt;
    };

    const nextImage = (e) => {
        e.stopPropagation();
        currentImgIndex = (currentImgIndex + 1) % galleryImages.length;
        lightboxImg.src = galleryImages[currentImgIndex];
        lightboxImg.alt = galleryItems[currentImgIndex].querySelector('img').alt;
    };

    // Adiciona os eventos de clique em cada item da galeria
    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            openLightbox(item.getAttribute('data-index'));
        });
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', prevImage);
    lightboxNext.addEventListener('click', nextImage);

    // Fecha o modal ao clicar fora da imagem
    lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) {
            closeLightbox();
        }
    });

    // Controles do teclado: Esc para fechar, setas para navegar
    document.addEventListener('keydown', (e) => {
        if (!lightboxModal.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') prevImage(e);
        if (e.key === 'ArrowRight') nextImage(e);
    });

    /* ==========================================================================
       5. LISTA DE PRESENTES E SISTEMA DE CÓPIA DO PIX
       ========================================================================== */
    const giftButtons = document.querySelectorAll('.btn-gift-select');
    const copyPixBtn = document.getElementById('copyPixBtn');
    const copyBtnText = document.getElementById('copyBtnText');
    const pixKeyField = document.getElementById('pixKeyField');
    const pixToast = document.getElementById('pixToast');
    const selectedGiftBanner = document.getElementById('selectedGiftBanner');
    const selectedGiftName = document.getElementById('selectedGiftName');
    const selectedGiftValue = document.getElementById('selectedGiftValue');
    const clearGiftBtn = document.getElementById('clearGiftBtn');
    const pixContainer = document.getElementById('pixContainer');

    let selectedGift = null;

    // Lógica de seleção dos presentes
    giftButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = btn.getAttribute('data-amount');
            const itemName = btn.getAttribute('data-item');

            // Alterna a seleção do presente
            if (selectedGift && selectedGift.name === itemName) {
                // Clicou no mesmo presente — remove a seleção
                removeGiftSelection();
            } else {
                // Seleciona o novo presente
                giftButtons.forEach(b => b.classList.remove('selected'));
                giftButtons.forEach(b => b.textContent = 'Presentear');

                btn.classList.add('selected');
                btn.textContent = 'Selecionado';

                selectedGift = { name: itemName, value: amount };

                // Exibe o banner com o presente selecionado
                selectedGiftName.textContent = itemName;
                selectedGiftValue.textContent = `R$ ${parseFloat(amount).toFixed(2).replace('.', ',')}`;
                selectedGiftBanner.classList.add('active');

                // Rola suavemente até a área do Pix
                pixContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    });

    const removeGiftSelection = () => {
        giftButtons.forEach(b => b.classList.remove('selected'));
        giftButtons.forEach(b => b.textContent = 'Presentear');
        selectedGift = null;
        selectedGiftBanner.classList.remove('active');
    };

    clearGiftBtn.addEventListener('click', (e) => {
        e.preventDefault();
        removeGiftSelection();
    });

    // Copiador da chave Pix
    copyPixBtn.addEventListener('click', () => {
        const keyText = pixKeyField.value;
        navigator.clipboard.writeText(keyText).then(() => {
            // Exibe confirmação visual de cópia
            pixToast.classList.add('active');
            copyBtnText.textContent = 'Copiado!';
            copyPixBtn.querySelector('i').setAttribute('data-lucide', 'check');
            lucide.createIcons();

            setTimeout(() => {
                pixToast.classList.remove('active');
                copyBtnText.textContent = 'Copiar';
                copyPixBtn.querySelector('i').setAttribute('data-lucide', 'copy');
                lucide.createIcons();
            }, 3000);
        }).catch(err => {
            console.error('Falha ao copiar texto: ', err);
        });
    });

    /* ==========================================================================
       6. CONFIRMAÇÃO DE PRESENÇA (RSVP) — LISTA FECHADA + QR CODE POR GRUPO
       Fluxo: busca pelo nome do responsável (Edge Function) -> seleciona grupo
       -> preenche nomes de quem vai -> confirma (Edge Function gera o QR e
       dispara o email). Tudo validado no servidor, nunca no navegador.
       ========================================================================== */
    const SUPABASE_FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;

    const rsvpFormContainer = document.getElementById('rsvpFormContainer');
    const rsvpSuccessContainer = document.getElementById('rsvpSuccessContainer');
    const rsvpSuccessMessage = document.getElementById('rsvpSuccessMessage');
    const rsvpEditBtn = document.getElementById('rsvpEditBtn');

    const rsvpEtapaBusca = document.getElementById('rsvpEtapaBusca');
    const rsvpBusca = document.getElementById('rsvpBusca');
    const rsvpSugestoes = document.getElementById('rsvpSugestoes');
    const rsvpBuscaError = document.getElementById('rsvpBuscaError');

    const rsvpForm = document.getElementById('rsvpForm');
    const rsvpGrupoId = document.getElementById('rsvpGrupoId');
    const rsvpGrupoResponsavel = document.getElementById('rsvpGrupoResponsavel');
    const rsvpGrupoMax = document.getElementById('rsvpGrupoMax');
    const rsvpNomesContainer = document.getElementById('rsvpNomesContainer');
    const rsvpAdicionarNome = document.getElementById('rsvpAdicionarNome');
    const rsvpVoltarBtn = document.getElementById('rsvpVoltarBtn');
    const rsvpEmail = document.getElementById('rsvpEmail');
    const rsvpSubmitBtn = document.getElementById('rsvpSubmitBtn');

    let grupoAtual = null; // { grupo_id, responsavel, quantidade_maxima }

    const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());

    // Cria uma linha de "nome + vai/não vai"
    function criarLinhaNome(valor = '') {
        const linha = document.createElement('div');
        linha.className = 'form-row-2 rsvp-linha-nome';
        linha.innerHTML = `
            <div class="form-group">
                <input type="text" class="rsvp-nome-input" placeholder="Nome do convidado" value="${valor}">
            </div>
            <div class="form-group" style="display:flex;align-items:center;gap:10px;">
                <select class="rsvp-vai-select">
                    <option value="sim" selected>Vai comparecer</option>
                    <option value="nao">Não vai comparecer</option>
                </select>
                <button type="button" class="rsvp-remover-nome" title="Remover" aria-label="Remover">✕</button>
            </div>`;
        linha.querySelector('.rsvp-remover-nome').addEventListener('click', () => {
            if (rsvpNomesContainer.children.length > 1) linha.remove();
        });
        return linha;
    }

    // Busca com debounce enquanto o usuário digita
    let buscaTimeout = null;
    rsvpBusca.addEventListener('input', () => {
        clearTimeout(buscaTimeout);
        const termo = rsvpBusca.value.trim();
        rsvpBuscaError.style.display = 'none';
        if (termo.length < 2) {
            rsvpSugestoes.innerHTML = '';
            return;
        }
        buscaTimeout = setTimeout(async () => {
            try {
                const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/buscar-grupo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ termo })
                });
                const data = await resp.json();
                renderSugestoes(data.resultados || []);
            } catch (err) {
                console.error('Erro ao buscar convidado:', err);
            }
        }, 300);
    });

    function renderSugestoes(resultados) {
        if (resultados.length === 0) {
            rsvpSugestoes.innerHTML = '<div class="rsvp-sugestao-vazia">Nenhum nome encontrado. Confira a grafia do convite.</div>';
            return;
        }
        rsvpSugestoes.innerHTML = '';
        resultados.forEach((r) => {
            const item = document.createElement('div');
            item.className = 'rsvp-sugestao-item';
            item.textContent = r.ja_confirmado ? `${r.responsavel} (já confirmado — clique para editar)` : r.responsavel;
            item.addEventListener('click', () => selecionarGrupo(r));
            rsvpSugestoes.appendChild(item);
        });
    }

    function selecionarGrupo(grupo) {
        grupoAtual = grupo;
        rsvpGrupoId.value = grupo.grupo_id;
        rsvpGrupoResponsavel.textContent = grupo.responsavel;
        rsvpGrupoMax.textContent = grupo.quantidade_maxima ?? '';

        rsvpNomesContainer.innerHTML = '';
        rsvpNomesContainer.appendChild(criarLinhaNome());

        rsvpEtapaBusca.style.display = 'none';
        rsvpForm.style.display = 'block';
        rsvpSugestoes.innerHTML = '';
    }

    rsvpAdicionarNome.addEventListener('click', () => {
        const max = grupoAtual?.quantidade_maxima ?? 1;
        if (rsvpNomesContainer.children.length >= max) {
            alert(`Este convite permite no máximo ${max} pessoa(s).`);
            return;
        }
        rsvpNomesContainer.appendChild(criarLinhaNome());
    });

    rsvpVoltarBtn.addEventListener('click', () => {
        rsvpForm.style.display = 'none';
        rsvpEtapaBusca.style.display = 'block';
        rsvpBusca.value = '';
        grupoAtual = null;
    });

    rsvpForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nomes = Array.from(rsvpNomesContainer.querySelectorAll('.rsvp-linha-nome')).map((linha) => ({
            nome: linha.querySelector('.rsvp-nome-input').value.trim(),
            vai: linha.querySelector('.rsvp-vai-select').value === 'sim'
        })).filter((n) => n.nome.length > 0);

        const emailValido = validateEmail(rsvpEmail.value.trim());
        rsvpEmail.closest('.form-group').classList.toggle('error', !emailValido);

        if (nomes.length === 0) {
            alert('Adicione ao menos um nome.');
            return;
        }
        if (!emailValido) return;

        rsvpSubmitBtn.disabled = true;
        rsvpSubmitBtn.textContent = 'Enviando...';

        try {
            const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/confirmar-presenca`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grupo_id: rsvpGrupoId.value,
                    email: rsvpEmail.value.trim(),
                    nomes
                })
            });
            const data = await resp.json();

            if (!resp.ok) {
                alert(data.error || 'Ocorreu um erro ao confirmar sua presença.');
                rsvpSubmitBtn.disabled = false;
                rsvpSubmitBtn.innerHTML = 'Confirmar Presença <i data-lucide="send" class="btn-icon-right"></i>';
                lucide.createIcons();
                return;
            }

            rsvpFormContainer.style.display = 'none';
            rsvpSuccessContainer.classList.add('active');

            const vao = data.nomes_confirmados || [];
            rsvpSuccessMessage.innerHTML = vao.length > 0
                ? `Confirmado! Enviamos o ingresso digital com QR Code para <strong>${rsvpEmail.value.trim()}</strong>.<br><br>Convidados confirmados: <em>${vao.join(', ')}</em><br><br>Nos vemos no dia 08 de Fevereiro de 2027! ♥`
                : `Obrigado por nos avisar! Sentiremos a falta de vocês no nosso grande dia.`;
        } catch (err) {
            console.error('Erro ao confirmar presença:', err);
            alert('Ocorreu um erro ao confirmar sua presença. Tente novamente.');
            rsvpSubmitBtn.disabled = false;
            rsvpSubmitBtn.innerHTML = 'Confirmar Presença <i data-lucide="send" class="btn-icon-right"></i>';
            lucide.createIcons();
        }
    });

    // Volta ao formulário para uma nova consulta
    rsvpEditBtn.addEventListener('click', () => {
        rsvpSuccessContainer.classList.remove('active');
        rsvpFormContainer.style.display = 'block';
        rsvpForm.style.display = 'none';
        rsvpEtapaBusca.style.display = 'block';
        rsvpBusca.value = '';
        grupoAtual = null;
        rsvpSubmitBtn.disabled = false;
        rsvpSubmitBtn.innerHTML = 'Confirmar Presença <i data-lucide="send" class="btn-icon-right"></i>';
        lucide.createIcons();
    });

    /* ==========================================================================
       7. MURAL DE RECADOS — INTEGRADO COM SUPABASE
       ========================================================================== */
    const guestbookForm = document.getElementById('guestbookForm');
    const guestbookMessagesContainer = document.getElementById('guestbookMessages');

    // Formata o tempo relativo (ex: "Há 2 dias", "Agora mesmo")
    const formatRelativeTime = (timestamp) => {
        const now = new Date().getTime();
        const diff = now - new Date(timestamp).getTime();

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return days === 1 ? 'Ontem' : `Há ${days} dias`;
        } else if (hours > 0) {
            return `Há ${hours}h`;
        } else if (minutes > 0) {
            return `Há ${minutes} min`;
        } else {
            return 'Agora mesmo';
        }
    };

    // Escapa caracteres especiais para evitar ataques XSS
    const escapeHTML = (str) => {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    // Renderiza a lista de mensagens do mural
    const renderMessages = (messages) => {
        guestbookMessagesContainer.innerHTML = '';

        if (!messages || messages.length === 0) {
            guestbookMessagesContainer.innerHTML = '<p class="no-messages" style="text-align: center; color: var(--color-text-muted); font-style: italic; margin-top: 30px;">Seja o primeiro a deixar um recado!</p>';
            return;
        }

        messages.forEach(msg => {
            const card = document.createElement('div');
            card.className = 'message-card';
            card.innerHTML = `
                <div class="message-header">
                    <span class="message-author">${escapeHTML(msg.nome)}</span>
                    <span class="message-date">${formatRelativeTime(msg.criado_em)}</span>
                </div>
                <p class="message-body">${escapeHTML(msg.mensagem)}</p>
            `;
            guestbookMessagesContainer.appendChild(card);
        });
    };

    // Busca as mensagens do Supabase e exibe na tela
    const loadMessages = async () => {
        const { data, error } = await supabase
            .from('recados')
            .select('*')
            .order('criado_em', { ascending: false });

        if (error) {
            console.error('Erro ao carregar recados:', error);
            return;
        }

        renderMessages(data);
    };

    // Envia o recado ao submeter o formulário
    guestbookForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('gbName');
        const messageInput = document.getElementById('gbMessage');
        const submitBtn = document.getElementById('gbSubmitBtn');

        const isNameValid = nameInput.value.trim().length > 1;
        const isMsgValid = messageInput.value.trim().length > 2;

        toggleInputError(nameInput, isNameValid);
        toggleInputError(messageInput, isMsgValid);

        if (isNameValid && isMsgValid) {
            // Desabilita o botão para evitar envios duplicados
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';

            // Salva o recado no Supabase
            const { error } = await supabase
                .from('recados')
                .insert({
                    nome: nameInput.value.trim(),
                    mensagem: messageInput.value.trim()
                });

            if (error) {
                console.error('Erro ao salvar recado:', error);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Publicar Recado';
                alert('Ocorreu um erro ao publicar o recado. Tente novamente.');
                return;
            }

            // Limpa os campos e remove as marcações de erro
            guestbookForm.reset();
            nameInput.closest('.form-group').classList.remove('error');
            messageInput.closest('.form-group').classList.remove('error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Publicar Recado <i data-lucide="message-square-heart" class="btn-icon-right"></i>';
            lucide.createIcons();

            // Atualiza a lista de mensagens na tela
            await loadMessages();

            // Rola o mural para o topo para mostrar a nova mensagem
            guestbookMessagesContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Carrega as mensagens ao abrir a página
    loadMessages();
});
