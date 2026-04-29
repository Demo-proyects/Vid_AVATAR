/* main.js v2.6 — Ejecución inmediata + try/catch individual */
(function() {
    function init() {
        console.log('✨ El Misterio de Vid — v2.6');
        
        try { if (typeof initStorage === 'function') initStorage(); } catch(e) { console.warn('[main] storage:', e); }
        try { if (typeof initAvatarSystem === 'function') initAvatarSystem(); } catch(e) { console.warn('[main] avatar:', e); }
        try { if (typeof initVoice === 'function') initVoice(); } catch(e) { console.warn('[main] voice:', e); }
        try { if (typeof initChat === 'function') initChat(); } catch(e) { console.warn('[main] chat:', e); }

        const originalSelectAvatar = window.selectAvatar;
        if (typeof originalSelectAvatar === 'function') {
            window.selectAvatar = function(id) {
                originalSelectAvatar(id);
                if (typeof saveAvatarPreference === 'function') {
                    saveAvatarPreference(id);
                }
            };
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
