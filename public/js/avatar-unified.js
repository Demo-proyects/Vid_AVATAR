/**
 * Sistema unificado de avatares para frontend y scripts
 * Combina la funcionalidad de scripts/avatar.js y public/js/avatar.js
 */

const AVATAR_STATES = {
    IDLE: 'idle',
    WAITING: 'waiting',
    SPEAKING: 'speaking'
};

const AVATARS = {
    nara: {
        id: 'nara',
        name: 'Nara01',
        personality: 'Directo, amigable y eficiente. Va al grano.',
        voices: [
            { id: 'es-US-Neural2-B', name: 'Nara01 · Neural US' },
            { id: 'es-ES-Neural2-F', name: 'Profunda · Narrador' },
            { id: 'es-ES-Chirp-HD-D', name: 'Masculino natural' },
            { id: 'es-ES-Chirp3-HD-Algieba', name: 'Grave · HD' },
            { id: 'es-ES-Chirp3-HD-Pulcherrima', name: 'Asistente · Pro' }
        ],
        defaultVoice: 'es-US-Neural2-B',
        assets: {
            static: 'assets/avatars/nara-estatico.avif',
            waiting: 'assets/avatars/nara-espera.webp',
            speaking: 'assets/avatars/nara-speak.webp'
        }
    },
    mimi: {
        id: 'mimi',
        name: 'Mimi',
        personality: 'Entusiasta, empática y muy expresiva. 💫',
        voices: [
            { id: 'es-ES-Neural2-E', name: 'Mimi · Simpática' },
            { id: 'es-ES-Neural2-H', name: 'Rápida · Fluida' },
            { id: 'es-ES-Chirp-HD-O', name: 'Premium · HD' },
            { id: 'es-ES-Chirp3-HD-Leda', name: 'Femenina · HD Premium' }
        ],
        defaultVoice: 'es-ES-Chirp3-HD-Leda',
        assets: {
            static: 'assets/avatars/mimi-estatico.avif',
            waiting: 'assets/avatars/mimi-espera.webp',
            speaking: 'assets/avatars/mimi-speak.webp'
        }
    },
    ava03: {
        id: 'ava03',
        name: 'Ava03',
        personality: 'Robot amigable con curiosidad infantil. Aprende de cada interacción.',
        voices: [],
        defaultVoice: '',
        assets: {
            static: 'assets/avatars/ava03-estatico.avif',
            waiting: 'assets/avatars/ava03-estatico.avif',
            speaking: 'assets/avatars/ava03-estatico.avif'
        }
    },
    vid: {
        id: 'vid',
        name: 'Vid',
        personality: 'Misteriosa, enigmática, habla en acertijos. No tiene voz propia aún.',
        voices: [],
        defaultVoice: '',
        assets: {
            static: 'assets/avatars/vid-estatico.avif',
            waiting: 'assets/avatars/vid-estatico.avif',
            speaking: 'assets/avatars/vid-estatico.avif'
        }
    }
};

// Estado global
window.currentAvatarId = 'nara';
let _currentAvatarState = AVATAR_STATES.WAITING;

/**
 * Inicializa el sistema de avatares
 */
function initAvatarSystem() {
    _renderActiveAvatar();
    _renderGallery();
    _setupAvatarListeners();
    console.log('✅ Sistema de avatares unificado inicializado');
}

/**
 * Cambia el estado del avatar y actualiza la UI en todos los layouts
 */
function setAvatarState(state) {
    _currentAvatarState = state;
    
    // Usar la función de sincronización para actualizar todo
    syncAvatarsToLayouts();
}

/**
 * Sincroniza avatares entre layouts
 */
function syncAvatarsToLayouts() {
    const avatar = AVATARS[window.currentAvatarId];
    if (!avatar) return;

    let src = avatar.assets.waiting;
    if (_currentAvatarState === AVATAR_STATES.SPEAKING && avatar.assets.speaking) {
        src = avatar.assets.speaking;
    } else if (_currentAvatarState === AVATAR_STATES.IDLE) {
        src = avatar.assets.static;
    }

    // Actualizar imágenes en todos los layouts
    const avatarImageIds = [
        'main-avatar-img', 'mobile-avatar-img', 
        'main-avatar-img-kiosk', 'mobile-avatar-img-kiosk'
    ];
    
    avatarImageIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.src = src;
            element.alt = avatar.name;
        }
    });

    // Actualizar nombres en layout cripta (mobile)
    _setText('mobile-avatar-name', avatar.name);
    
    // Actualizar nombres en layout kiosk
    document.querySelectorAll('.d2-av-name').forEach(el => {
        if (el) el.textContent = avatar.name;
    });
    document.querySelectorAll('.d2-mob-av-name').forEach(el => {
        if (el) el.textContent = avatar.name;
    });

    // Actualizar personalidad en layout kiosk
    const personaElements = document.querySelectorAll('.d2-av-persona');
    personaElements.forEach(el => {
        if (el) {
            const shortPersonality = avatar.personality.split('.')[0].substring(0, 40);
            el.textContent = shortPersonality;
        }
    });

    // Sincronizar estado visual
    _syncAvatarStateVisual();
}

/**
 * Sincroniza el estado visual del avatar entre layouts
 */
function _syncAvatarStateVisual() {
    const state = _currentAvatarState;
    
    // Actualizar anillos de avatar en ambos layouts
    const ringIds = ['avatar-ring', 'mobile-avatar-ring'];
    ringIds.forEach(id => {
        const ring = document.getElementById(id);
        if (ring) {
            ring.classList.toggle('speaking', state === AVATAR_STATES.SPEAKING);
        }
    });

    // Actualizar indicadores de estado en layout cripta
    const dot = document.getElementById('state-dot');
    if (dot) {
        dot.style.background = state === AVATAR_STATES.SPEAKING ? '#06b6d4' : '#7c3aed';
    }

    const stateText = state === AVATAR_STATES.SPEAKING ? 'HABLANDO…' : 'EN ESPERA';
    _setText('state-label', stateText);
    _setText('mobile-state-label', '● ' + (state === AVATAR_STATES.SPEAKING ? 'HABLANDO' : 'EN ESPERA'));

    // Actualizar indicadores en layout kiosk
    const d2StateElements = document.querySelectorAll('.d2-mob-av-state');
    d2StateElements.forEach(el => {
        if (el) {
            el.textContent = state === AVATAR_STATES.SPEAKING ? 'ACTIVE' : 'SYS_OK';
        }
    });
}

/**
 * Renderiza el avatar activo
 */
function _renderActiveAvatar() {
    const avatar = AVATARS[window.currentAvatarId];
    if (!avatar) return;

    // Actualizar imágenes
    ['main-avatar-img', 'mobile-avatar-img', 'main-avatar-img-kiosk', 'mobile-avatar-img-kiosk'].forEach(id => {
        _setSrc(id, avatar.assets.waiting);
    });

    // Actualizar nombres
    _setText('mobile-avatar-name', avatar.name);
    document.querySelectorAll('.d2-av-name').forEach(el => el.textContent = avatar.name);

    // Actualizar personalidad
    const p = document.querySelector('.d2-av-persona');
    if (p) p.textContent = avatar.personality.split('.')[0].substring(0, 40);

    // Sincronizar layouts
    syncAvatarsToLayouts();
    setAvatarState(AVATAR_STATES.WAITING);
}

/**
 * Renderiza la galería de avatares
 */
function _renderGallery() {
    const g = document.getElementById('avatar-gallery');
    if (!g) return;
    
    g.innerHTML = '';
    Object.values(AVATARS).forEach(av => {
        const card = document.createElement('div');
        card.className = `gallery-card ${av.id === window.currentAvatarId ? 'active' : ''}`;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.innerHTML = `<img src="${av.assets.static}" alt="${av.name}" loading="lazy"/><p>${av.name}</p>`;
        
        card.addEventListener('click', () => selectAvatar(av.id));
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter') selectAvatar(av.id);
        });
        
        g.appendChild(card);
    });
}

/**
 * Selecciona un avatar
 */
function selectAvatar(id) {
    if (!AVATARS[id]) return;
    
    // Si el avatar no tiene voz, mostrar modal informativo
    const avatar = AVATARS[id];
    if (avatar.voices.length === 0) {
        // Mostrar modal en lugar de mensaje en el chat
        _showAvatarUnavailableModal(avatar.name);
        // No cambiar el avatar activo, solo cerrar galería
        _closeGallery();
        return;
    }
    
    window.currentAvatarId = id;
    _renderActiveAvatar();
    _renderGallery();
    _closeGallery();
    
    // Guardar preferencia
    if (typeof saveAvatarPreference === 'function') {
        saveAvatarPreference(id);
    }
}

/**
 * Muestra un modal cuando se selecciona un avatar no disponible
 * CORREGIDO: Ya no clona nodos (eso rompía los event listeners)
 */
let _unavailableModalInitialized = false;

function _showAvatarUnavailableModal(avatarName) {
    const modal = document.getElementById('avatar-unavailable-modal');
    const message = document.getElementById('avatar-unavailable-message');
    const closeBtn = document.getElementById('avatar-unavailable-close');
    const backdrop = document.getElementById('avatar-unavailable-backdrop');
    
    if (!modal || !message) return;
    
    message.textContent = `"${avatarName}" está actualmente en desarrollo y no tiene voces disponibles.`;
    modal.classList.remove('hidden');
    
    // Inicializar eventos solo una vez
    if (!_unavailableModalInitialized) {
        _unavailableModalInitialized = true;
        const closeModal = () => { modal.classList.add('hidden'); };
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (backdrop) backdrop.addEventListener('click', closeModal);
    }
}

/**
 * Obtiene el ID de voz activa (voz por defecto del avatar actual)
 */
function getActiveVoiceId() {
    return AVATARS[window.currentAvatarId]?.defaultVoice || '';
}

/**
 * Abre la galería de avatares
 */
function _openGallery() {
    const m = document.getElementById('gallery-modal');
    if (m) m.classList.remove('hidden');
}

/**
 * Cierra la galería de avatares
 */
function _closeGallery() {
    const m = document.getElementById('gallery-modal');
    if (m) m.classList.add('hidden');
}

/**
 * Configura los listeners de avatar
 */
function _setupAvatarListeners() {
    // Botones para abrir galería
    document.getElementById('avatar-ring')?.addEventListener('click', _openGallery);
    document.getElementById('sidebar-avatar-btn')?.addEventListener('click', _openGallery);
    document.getElementById('mobile-avatar-ring')?.addEventListener('click', _openGallery);
    document.getElementById('change-assistant-btn-kiosk')?.addEventListener('click', _openGallery);
    document.getElementById('close-gallery-btn')?.addEventListener('click', _closeGallery);
    document.getElementById('gallery-backdrop')?.addEventListener('click', _closeGallery);
    document.querySelector('.d1-mob-tab-asistente')?.addEventListener('click', _openGallery);
    document.querySelector('.d2-mob-tab-avatar')?.addEventListener('click', _openGallery);
    
}

/**
 * Helper: establece el src de un elemento
 */
function _setSrc(id, src) {
    const el = document.getElementById(id);
    if (el) el.src = src;
}

/**
 * Helper: establece el texto de un elemento
 */
function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// Exportar al ámbito global
window.AVATARS = AVATARS;
window.AVATAR_STATES = AVATAR_STATES;
window.selectAvatar = selectAvatar;
window.getActiveVoiceId = getActiveVoiceId;
window.setAvatarState = setAvatarState;
window.syncAvatars = syncAvatarsToLayouts;
window.initAvatarSystem = initAvatarSystem;
