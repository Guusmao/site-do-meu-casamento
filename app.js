document.addEventListener('DOMContentLoaded', () => {
    
    // Inicializa os ícones da biblioteca Lucide
    lucide.createIcons();

    /* ==========================================================================
       1. NAVEGAÇÃO E CABEÇALHO
       ========================================================================== */
    const navbar = document.querySelector('.navbar-container');
    const menuToggle = document.getElementById('menuToggle');
    const navLinksContainer = document.getElementById('navLinks');
    const navLinks = document.querySelectorAll('.nav-link');

    // Adiciona classe ao menu quando o usuário rola a página
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Abre e fecha o menu no celular
    menuToggle.addEventListener('click', () => {
        navLinksContainer.classList.toggle('active');
        // Troca o ícone entre menu (☰) e fechar (X)
        const icon = menuToggle.querySelector('i');
        if (navLinksContainer.classList.contains('active')) {
            icon.setAttribute('data-lucide', 'x');
        } else {
            icon.setAttribute('data-lucide', 'menu');
        }
        lucide.createIcons(); // Atualiza os ícones após a troca
    });

    // Fecha o menu ao clicar em qualquer link de navegação
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinksContainer.classList.remove('active');
            const icon = menuToggle.querySelector('i');
            icon.setAttribute('data-lucide', 'menu');
            lucide.createIcons();
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
        'assets/gallery-rings.png',
        'assets/gallery-bouquet.png',
        'assets/gallery-table.png',
        'assets/gallery-cake.png'
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
       6. FORMULÁRIO DE CONFIRMAÇÃO DE PRESENÇA (RSVP)
       ========================================================================== */
    const rsvpForm = document.getElementById('rsvpForm');
    const rsvpFormContainer = document.getElementById('rsvpFormContainer');
    const rsvpSuccessContainer = document.getElementById('rsvpSuccessContainer');
    const rsvpSuccessMessage = document.getElementById('rsvpSuccessMessage');
    const rsvpEditBtn = document.getElementById('rsvpEditBtn');
    const rsvpAttending = document.getElementById('rsvpAttending');
    const guestsGroup = document.getElementById('guestsGroup');
    const rsvpGuests = document.getElementById('rsvpGuests');

    // Mostra ou esconde o campo de acompanhantes conforme a resposta
    rsvpAttending.addEventListener('change', () => {
        if (rsvpAttending.value === 'no') {
            guestsGroup.classList.add('hidden');
            rsvpGuests.value = '0'; // reset
        } else {
            guestsGroup.classList.remove('hidden');
        }
    });

    // Adiciona ou remove a classe de erro no campo do formulário
    const toggleInputError = (input, isValid, errorEl) => {
        const group = input.closest('.form-group');
        if (isValid) {
            group.classList.remove('error');
        } else {
            group.classList.add('error');
        }
    };

    // Valida o formato do e-mail
    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    };

    rsvpForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('rsvpName');
        const emailInput = document.getElementById('rsvpEmail');
        const attendingSelect = document.getElementById('rsvpAttending');

        // Verifica se os campos obrigatórios são válidos
        const isNameValid = nameInput.value.trim().length > 2;
        const isEmailValid = validateEmail(emailInput.value.trim());
        const isAttendingValid = attendingSelect.value !== '';

        toggleInputError(nameInput, isNameValid);
        toggleInputError(emailInput, isEmailValid);
        toggleInputError(attendingSelect, isAttendingValid);

        if (isNameValid && isEmailValid && isAttendingValid) {
            // Coleta os dados do formulário
            const guestResponse = {
                name: nameInput.value.trim(),
                email: emailInput.value.trim(),
                attending: attendingSelect.value,
                guests: attendingSelect.value === 'yes' ? parseInt(rsvpGuests.value) : 0,
                message: document.getElementById('rsvpMessage').value.trim(),
                timestamp: new Date().getTime()
            };

            // Salva a confirmação no armazenamento local do navegador
            let rsvpList = JSON.parse(localStorage.getItem('rsvp_confirmations')) || [];
            // Remove resposta anterior do mesmo e-mail para evitar duplicatas
            rsvpList = rsvpList.filter(item => item.email.toLowerCase() !== guestResponse.email.toLowerCase());
            rsvpList.push(guestResponse);
            localStorage.setItem('rsvp_confirmations', JSON.stringify(rsvpList));

            // Exibe a mensagem de sucesso após o envio
            rsvpFormContainer.style.display = 'none';
            rsvpSuccessContainer.classList.add('active');

            // Monta a mensagem de confirmação personalizada
            if (guestResponse.attending === 'yes') {
                const companionText = guestResponse.guests === 0 
                    ? 'Apenas você.' 
                    : `Você e + ${guestResponse.guests} acompanhante(s).`;
                rsvpSuccessMessage.innerHTML = `Que alegria, <strong>${guestResponse.name}</strong>! Sua presença está confirmada com sucesso.<br><br>Detalhe dos convidados: <em>${companionText}</em><br><br>Nos vemos no dia 08 de Fevereiro de 2027! ♥`;
            } else {
                rsvpSuccessMessage.innerHTML = `Obrigado por nos avisar, <strong>${guestResponse.name}</strong>. Sentiremos a sua falta no nosso grande dia, mas agradecemos imensamente o seu carinho e votos de felicidade!`;
            }
        }
    });

    // Volta ao formulário para editar a confirmação
    rsvpEditBtn.addEventListener('click', () => {
        rsvpSuccessContainer.classList.remove('active');
        rsvpFormContainer.style.display = 'block';

        // Preenche o formulário com os dados já salvos
        const rsvpList = JSON.parse(localStorage.getItem('rsvp_confirmations')) || [];
        if (rsvpList.length > 0) {
            const lastRsvp = rsvpList[rsvpList.length - 1];
            document.getElementById('rsvpName').value = lastRsvp.name;
            document.getElementById('rsvpEmail').value = lastRsvp.email;
            document.getElementById('rsvpAttending').value = lastRsvp.attending;
            
            if (lastRsvp.attending === 'no') {
                guestsGroup.classList.add('hidden');
                rsvpGuests.value = '0';
            } else {
                guestsGroup.classList.remove('hidden');
                rsvpGuests.value = String(lastRsvp.guests);
            }
            document.getElementById('rsvpMessage').value = lastRsvp.message;
        }
    });

    /* ==========================================================================
       7. MURAL DE RECADOS
       ========================================================================== */
    const guestbookForm = document.getElementById('guestbookForm');
    const guestbookMessagesContainer = document.getElementById('guestbookMessages');

    // Mensagens padrão exibidas antes de qualquer convidado escrever
    const defaultMessages = [
        {
            name: "Sofia e Bruno (Padrinhos)",
            message: "Casal maravilhoso! Que a cumplicidade de vocês continue crescendo a cada dia. O site ficou lindo, já confirmamos presença! Beijos!",
            timestamp: new Date().getTime() - (4 * 60 * 60 * 1000) // 4 horas atrás
        },
        {
            name: "Lucas P. (Amigo de infância)",
            message: "Que alegria ver vocês dando esse passo! O Felipe finalmente tomou juízo haha. Brincadeiras à parte, vocês merecem toda a felicidade do mundo. Vai ser a festa do ano!",
            timestamp: new Date().getTime() - (24 * 60 * 60 * 1000) // 1 dia atrás
        },
        {
            name: "Tia Regina",
            message: "Meus afilhados lindos, que Deus abençoe imensamente essa união. Estou contando os dias para ver a Sarah de noiva! Amo vocês!",
            timestamp: new Date().getTime() - (2 * 24 * 60 * 60 * 1000) // 2 dias atrás
        }
    ];

    const getMessages = () => {
        let list = localStorage.getItem('guestbook_messages');
        if (!list) {
            // Salva as mensagens padrão na primeira vez que a página é aberta
            localStorage.setItem('guestbook_messages', JSON.stringify(defaultMessages));
            return defaultMessages;
        }
        return JSON.parse(list);
    };

    // Formata o tempo relativo (ex: "Há 2 dias", "Agora mesmo")
    const formatRelativeTime = (timestamp) => {
        const now = new Date().getTime();
        const diff = now - timestamp;
        
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

    // Renderiza a lista de mensagens do mural
    const renderMessages = () => {
        const messages = getMessages();
        // Ordena as mensagens da mais recente para a mais antiga
        messages.sort((a, b) => b.timestamp - a.timestamp);

        guestbookMessagesContainer.innerHTML = '';

        if (messages.length === 0) {
            guestbookMessagesContainer.innerHTML = '<p class="no-messages" style="text-align: center; color: var(--color-text-muted); font-style: italic; margin-top: 30px;">Seja o primeiro a deixar um recado!</p>';
            return;
        }

        messages.forEach(msg => {
            const card = document.createElement('div');
            card.className = 'message-card';
            card.innerHTML = `
                <div class="message-header">
                    <span class="message-author">${escapeHTML(msg.name)}</span>
                    <span class="message-date">${formatRelativeTime(msg.timestamp)}</span>
                </div>
                <p class="message-body">${escapeHTML(msg.message)}</p>
            `;
            guestbookMessagesContainer.appendChild(card);
        });
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

    // Envia o recado ao submeter o formulário
    guestbookForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('gbName');
        const messageInput = document.getElementById('gbMessage');

        const isNameValid = nameInput.value.trim().length > 1;
        const isMsgValid = messageInput.value.trim().length > 2;

        toggleInputError(nameInput, isNameValid);
        toggleInputError(messageInput, isMsgValid);

        if (isNameValid && isMsgValid) {
            const newMsg = {
                name: nameInput.value.trim(),
                message: messageInput.value.trim(),
                timestamp: new Date().getTime()
            };

            const messages = getMessages();
            messages.push(newMsg);
            localStorage.setItem('guestbook_messages', JSON.stringify(messages));

            // Limpa os campos e remove as marcações de erro
            guestbookForm.reset();
            nameInput.closest('.form-group').classList.remove('error');
            messageInput.closest('.form-group').classList.remove('error');

            // Atualiza a lista de mensagens na tela
            renderMessages();

            // Rola o mural para o topo para mostrar a nova mensagem
            guestbookMessagesContainer.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    });

    // Carrega as mensagens ao abrir a página
    renderMessages();
});
