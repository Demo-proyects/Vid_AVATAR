/**
 * Utilidades de avatar para scripts (lado del servidor)
 * Este archivo se mantiene para compatibilidad con scripts existentes
 * La lógica principal ahora está en public/js/avatar-unified.js
 */

const AVATARS_INFO = {
    nara: {
        name: 'Nara01',
        personality: 'Directo, amigable y eficiente. Va al grano.',
        defaultVoice: 'es-US-Neural2-B'
    },
    mimi: {
        name: 'Mimi',
        personality: 'Entusiasta, empática y muy expresiva.',
        defaultVoice: 'es-ES-Chirp3-HD-Leda'
    }
};

// Exportar para uso en scripts
module.exports = {
    AVATARS_INFO
};
