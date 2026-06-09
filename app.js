document.addEventListener('DOMContentLoaded', () => {
    
    // Initialize Lucide Icons
    lucide.createIcons();

    /* ==========================================================================
       1. NAVIGATION AND HEADER
       ========================================================================== */
    const navbar = document.querySelector('.navbar-container');
    const menuToggle = document.getElementById('menuToggle');
    const navLinksContainer = document.getElementById('navLinks');
    const navLinks = document.querySelectorAll('.nav-link');

    // Scroll effect for navbar
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle
    menuToggle.addEventListener('click', () => {
        navLinksContainer.classList.toggle('active');
        // Toggle menu icon between burger and X
        const icon = menuToggle.querySelector('i');
        if (navLinksContainer.classList.contains('active')) {
            icon.setAttribute('data-lucide', 'x');
        } else {
            icon.setAttribute('data-lucide', 'menu');
        }
        lucide.createIcons(); // Re-render Lucide icons
    });

    // Close mobile menu when a link is clicked
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinksContainer.classList.remove('active');
            const icon = menuToggle.querySelector('i');
            icon.setAttribute('data-lucide', 'menu');
            lucide.createIcons();
        });
    });

    /* ==========================================================================
       2. COUNTDOWN TIMER
       ========================================================================== */
    // Set the wedding date: February 8, 2027 at 16:30
    const weddingDate = new Date('Feb 08, 2027 16:30:00').getTime();

    const updateCountdown = () => {
        const now = new Date().getTime();
        const difference = weddingDate - now;

        const daysEl = document.getElementById('days');
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');

        if (difference <= 0) {
            // Wedding day has arrived!
            document.getElementById('countdown').innerHTML = `
                <div class="wedding-day-message" style="font-family: var(--font-serif); font-size: 1.8rem; color: var(--color-accent); font-style: italic; margin-top: 15px;">
                    Chegou o Grande Dia! ♥
                </div>
            `;
            return;
        }

        // Calculations
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        // Update DOM with padding zeros
        daysEl.textContent = String(days).padStart(2, '0');
        hoursEl.textContent = String(hours).padStart(2, '0');
        minutesEl.textContent = String(minutes).padStart(2, '0');
        secondsEl.textContent = String(seconds).padStart(2, '0');
    };

    // Run immediately and then every second
    updateCountdown();
    setInterval(updateCountdown, 1000);

    /* ==========================================================================
       3. SCROLL REVEAL ANIMATIONS
       ========================================================================== */
    const revealElements = document.querySelectorAll('.scroll-reveal');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                revealObserver.unobserve(entry.target); // Reveal once
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px' // Trigger slightly before element enters view
    });

    revealElements.forEach(el => revealObserver.observe(el));

    /* ==========================================================================
       4. PHOTO GALLERY WITH LIGHTBOX
       ========================================================================== */
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightboxModal = document.getElementById('lightboxModal');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');

    // List of images in the gallery
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
        document.body.style.overflow = 'hidden'; // Stop page scrolling
    };

    const closeLightbox = () => {
        lightboxModal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
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

    // Attach Listeners
    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            openLightbox(item.getAttribute('data-index'));
        });
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', prevImage);
    lightboxNext.addEventListener('click', nextImage);

    // Close lightbox on click outside the image
    lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) {
            closeLightbox();
        }
    });

    // Keyboard controls for Lightbox
    document.addEventListener('keydown', (e) => {
        if (!lightboxModal.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') prevImage(e);
        if (e.key === 'ArrowRight') nextImage(e);
    });

    /* ==========================================================================
       5. GIFT REGISTRY & PIX COPY SYSTEM
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

    // Selection logic
    giftButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = btn.getAttribute('data-amount');
            const itemName = btn.getAttribute('data-item');

            // Toggle selection state
            if (selectedGift && selectedGift.name === itemName) {
                // Clicking again removes selection
                removeGiftSelection();
            } else {
                // Select new gift cota
                giftButtons.forEach(b => b.classList.remove('selected'));
                giftButtons.forEach(b => b.textContent = 'Presentear');

                btn.classList.add('selected');
                btn.textContent = 'Selecionado';

                selectedGift = { name: itemName, value: amount };
                
                // Show banner
                selectedGiftName.textContent = itemName;
                selectedGiftValue.textContent = `R$ ${parseFloat(amount).toFixed(2).replace('.', ',')}`;
                selectedGiftBanner.classList.add('active');

                // Smooth scroll to pix transfer box
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

    // Pix Key Copier
    copyPixBtn.addEventListener('click', () => {
        const keyText = pixKeyField.value;
        navigator.clipboard.writeText(keyText).then(() => {
            // Visual feedback toast
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
       6. RSVP FORM MANAGEMENT
       ========================================================================== */
    const rsvpForm = document.getElementById('rsvpForm');
    const rsvpFormContainer = document.getElementById('rsvpFormContainer');
    const rsvpSuccessContainer = document.getElementById('rsvpSuccessContainer');
    const rsvpSuccessMessage = document.getElementById('rsvpSuccessMessage');
    const rsvpEditBtn = document.getElementById('rsvpEditBtn');
    const rsvpAttending = document.getElementById('rsvpAttending');
    const guestsGroup = document.getElementById('guestsGroup');
    const rsvpGuests = document.getElementById('rsvpGuests');

    // Dynamic show/hide accompaniment selection
    rsvpAttending.addEventListener('change', () => {
        if (rsvpAttending.value === 'no') {
            guestsGroup.classList.add('hidden');
            rsvpGuests.value = '0'; // reset
        } else {
            guestsGroup.classList.remove('hidden');
        }
    });

    // Helper for input error class toggle
    const toggleInputError = (input, isValid, errorEl) => {
        const group = input.closest('.form-group');
        if (isValid) {
            group.classList.remove('error');
        } else {
            group.classList.add('error');
        }
    };

    // Validate email structure
    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    };

    rsvpForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('rsvpName');
        const emailInput = document.getElementById('rsvpEmail');
        const attendingSelect = document.getElementById('rsvpAttending');

        // Validation states
        const isNameValid = nameInput.value.trim().length > 2;
        const isEmailValid = validateEmail(emailInput.value.trim());
        const isAttendingValid = attendingSelect.value !== '';

        toggleInputError(nameInput, isNameValid);
        toggleInputError(emailInput, isEmailValid);
        toggleInputError(attendingSelect, isAttendingValid);

        if (isNameValid && isEmailValid && isAttendingValid) {
            // Collect Form data
            const guestResponse = {
                name: nameInput.value.trim(),
                email: emailInput.value.trim(),
                attending: attendingSelect.value,
                guests: attendingSelect.value === 'yes' ? parseInt(rsvpGuests.value) : 0,
                message: document.getElementById('rsvpMessage').value.trim(),
                timestamp: new Date().getTime()
            };

            // Save in localStorage (list)
            let rsvpList = JSON.parse(localStorage.getItem('rsvp_confirmations')) || [];
            // Remove previous answer from same email to avoid duplicates, only keep latest
            rsvpList = rsvpList.filter(item => item.email.toLowerCase() !== guestResponse.email.toLowerCase());
            rsvpList.push(guestResponse);
            localStorage.setItem('rsvp_confirmations', JSON.stringify(rsvpList));

            // Show Success Container
            rsvpFormContainer.style.display = 'none';
            rsvpSuccessContainer.classList.add('active');

            // Build response message
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

    // Edit RSVP back action
    rsvpEditBtn.addEventListener('click', () => {
        rsvpSuccessContainer.classList.remove('active');
        rsvpFormContainer.style.display = 'block';

        // Prepopulate from storage if exists
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
       7. GUESTBOOK MURAL (MURAL DE RECADOS)
       ========================================================================== */
    const guestbookForm = document.getElementById('guestbookForm');
    const guestbookMessagesContainer = document.getElementById('guestbookMessages');

    // Default messages seeds
    const defaultMessages = [
        {
            name: "Sofia e Bruno (Padrinhos)",
            message: "Casal maravilhoso! Que a cumplicidade de vocês continue crescendo a cada dia. O site ficou lindo, já confirmamos presença! Beijos!",
            timestamp: new Date().getTime() - (4 * 60 * 60 * 1000) // 4 hours ago
        },
        {
            name: "Lucas P. (Amigo de infância)",
            message: "Que alegria ver vocês dando esse passo! O Felipe finalmente tomou juízo haha. Brincadeiras à parte, vocês merecem toda a felicidade do mundo. Vai ser a festa do ano!",
            timestamp: new Date().getTime() - (24 * 60 * 60 * 1000) // 1 day ago
        },
        {
            name: "Tia Regina",
            message: "Meus afilhados lindos, que Deus abençoe imensamente essa união. Estou contando os dias para ver a Sarah de noiva! Amo vocês!",
            timestamp: new Date().getTime() - (2 * 24 * 60 * 60 * 1000) // 2 days ago
        }
    ];

    const getMessages = () => {
        let list = localStorage.getItem('guestbook_messages');
        if (!list) {
            // Seed defaults
            localStorage.setItem('guestbook_messages', JSON.stringify(defaultMessages));
            return defaultMessages;
        }
        return JSON.parse(list);
    };

    // Format relative time helper
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

    // Render message list
    const renderMessages = () => {
        const messages = getMessages();
        // Sort newest first
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

    // Escaping to prevent XSS
    const escapeHTML = (str) => {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    // Form submit
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

            // Reset form inputs & remove error classes
            guestbookForm.reset();
            nameInput.closest('.form-group').classList.remove('error');
            messageInput.closest('.form-group').classList.remove('error');

            // Re-render
            renderMessages();

            // Animate scroll guestbook list top to show the new message
            guestbookMessagesContainer.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    });

    // Initial load
    renderMessages();
});
