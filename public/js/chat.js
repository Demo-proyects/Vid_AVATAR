/* chat.js v3.1 — JWT en headers para personalidad personal */

const ChatManager = {
    MAX_HISTORY: 20,
    messages: [],
    currentSentence: '',
    isResponding: false,
    currentLayout: 'cripta',

    refs: { history: null, input: null, sendBtn: null },

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._setup());
        } else {
            this._setup();
        }
    },

    async _setup() {
        this.currentLayout = 'cripta';
        this._updateRefs();
        this._bindLayoutEvents('cripta');
        this._bindLayoutEvents('kiosk');
        await this._loadHistory();
        console.log('[chat] Inicializado v3.1');
    },

    _getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = sessionStorage.getItem('vid_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    },

    async _loadHistory() {
        try {
            if (typeof window.loadSavedMessages === 'function') {
                const savedMessages = await window.loadSavedMessages();
                if (savedMessages && savedMessages.length > 0) {
                    this.messages = savedMessages;
                    ['cripta', 'kiosk'].forEach(layout => {
                        const ids = this._getLayoutIds(layout);
                        const history = document.getElementById(ids.history);
                        if (history) history.innerHTML = '';
                    });
                    savedMessages.forEach(msg => {
                        if (msg.role === 'user') {
                            this._syncMessageToLayouts(msg.content, 'user');
                        } else {
                            const avatarName = window.AVATARS?.[window.currentAvatarId]?.name || 'Asistente';
                            this._syncMessageToLayouts(msg.content, 'assistant', avatarName);
                        }
                    });
                    this._scrollBottom();
                }
            }
        } catch (error) {
            console.warn('[chat] Error al cargar historial:', error);
        }
    },

    _bindLayoutEvents(layout) {
        const ids = this._getLayoutIds(layout);
        const input = document.getElementById(ids.input);
        const sendBtn = document.getElementById(ids.sendBtn);

        if (!input || input._chatBound) return;
        input._chatBound = true;

        const handleSubmit = async () => {
            if (this.currentLayout !== layout) return;
            const text = input.value.trim();
            if (!text || this.isResponding) return;
            input.value = '';
            this._updateRefs();
            this._addUserMessage(text);
            await this._sendToAI(text);
        };

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
        });
        sendBtn?.addEventListener('click', handleSubmit);
    },

    _updateRefs() {
        const ids = this._getLayoutIds(this.currentLayout);
        this.refs.history = document.getElementById(ids.history);
        this.refs.input   = document.getElementById(ids.input);
        this.refs.sendBtn = document.getElementById(ids.sendBtn);
    },

    _getLayoutIds(layout) {
        const p = layout === 'cripta' ? 'cripta' : 'kiosk';
        return { history: `chat-history-${p}`, input: `chat-input-${p}`, sendBtn: `send-btn-${p}`, typing: `typing-indicator-${p}` };
    },

    updateActiveLayout(layout) {
        this.currentLayout = layout;
        this._updateRefs();
        setTimeout(() => this.refs.input?.focus(), 50);
    },

    addMessage(role, content, avatarId) {
        if (role === 'user') this._addUserMessage(content);
        else this._addAssistantMessage(content, avatarId || window.currentAvatarId || 'nara');
    },

    _addUserMessage(text) {
        this.messages.push({ role: 'user', content: text });
        this._trimHistory();
        if (typeof window.saveMessages === 'function') window.saveMessages(this.messages, window.currentAvatarId);
        this._syncMessageToLayouts(text, 'user');
    },

    _addAssistantMessage(text, avatarId) {
        const avatar = window.AVATARS?.[avatarId] || { name: 'Asistente' };
        this.messages.push({ role: 'assistant', content: text });
        this._trimHistory();
        if (typeof window.saveMessages === 'function') window.saveMessages(this.messages, window.currentAvatarId);
        this._syncMessageToLayouts(text, 'assistant', avatar.name);
        const bubbleClass = this.currentLayout === 'cripta' ? 'd1-bubble-a' : 'd2-bubble-a';
        const nameClass   = this.currentLayout === 'cripta' ? 'd1-name'     : 'd2-name';
        const html = `<span class="${nameClass}">${avatar.name}</span><span class="msg-text">${text || ''}</span>`;
        return this._appendBubble(html, bubbleClass, true);
    },

    _syncMessageToLayouts(text, role, avatarName = null) {
        ['cripta', 'kiosk'].forEach(layout => {
            const ids    = this._getLayoutIds(layout);
            const history = document.getElementById(ids.history);
            if (!history) return;

            const existing = Array.from(history.querySelectorAll('.msg-text')).some(el => el.textContent.trim() === text.trim());
            if (existing) return;

            if (role === 'user') {
                const div = document.createElement('div');
                div.className = layout === 'cripta' ? 'd1-bubble-u' : 'd2-bubble-u';
                div.textContent = text;
                history.appendChild(div);
            } else {
                const bubbleClass = layout === 'cripta' ? 'd1-bubble-a' : 'd2-bubble-a';
                const nameClass   = layout === 'cripta' ? 'd1-name'     : 'd2-name';
                const div = document.createElement('div');
                div.className = bubbleClass;
                div.innerHTML = `<span class="${nameClass}">${avatarName || 'Asistente'}</span><span class="msg-text">${text || ''}</span>`;
                history.appendChild(div);
            }
            history.scrollTop = history.scrollHeight;
        });
    },

    async _sendToAI(userText) {
        this.isResponding = true;
        this._setInputEnabled(false);
        this._showTyping(true);
        this.currentSentence = '';

        const avatarId = window.currentAvatarId || 'nara';
        const avatar   = window.AVATARS?.[avatarId] || { name: 'Asistente' };
        const isCripta = this.currentLayout === 'cripta';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify({ messages: [...this.messages], avatar: avatarId })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this._showTyping(false);
            await this._processStream(response, avatar, isCripta);

        } catch (error) {
            console.error('[chat] Error:', error);
            this._showTyping(false);
            this._showError(avatar, isCripta);
        } finally {
            this.isResponding = false;
            this._setInputEnabled(true);
            this.refs.input?.focus();
        }
    },

    sendUserMessage(text) {
        if (!text || this.isResponding) return;
        this._addUserMessage(text);
        this._sendToAI(text);
    },

    async _processStream(response, avatar, isCripta) {
        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '', messageElement = null, textElement = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const lines = decoder.decode(value).split('\n');
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') break;

                try {
                    const { content } = JSON.parse(dataStr);
                    if (!content) continue;

                    if (!messageElement) {
                        messageElement = this._createMessageElement(avatar, isCripta);
                        textElement = messageElement.querySelector('.msg-text');
                    }

                    fullText += content;
                    if (textElement) textElement.textContent = fullText;
                    if (messageElement._syncElement) {
                        const syncText = messageElement._syncElement.querySelector('.msg-text');
                        if (syncText) syncText.textContent = fullText;
                    }

                    this._scrollBottom();
                    this._handleSentenceBuffer(content);
                } catch (_) {}
            }
        }

        this._finalizeMessage(fullText, messageElement, avatar, isCripta);
    },

    _createMessageElement(avatar, isCripta) {
        const bubbleClass = isCripta ? 'd1-bubble-a' : 'd2-bubble-a';
        const nameClass   = isCripta ? 'd1-name'     : 'd2-name';
        const div = document.createElement('div');
        div.className = bubbleClass;
        div.innerHTML = `<span class="${nameClass}">${avatar.name}</span><span class="msg-text"></span>`;
        this.refs.history?.appendChild(div);

        const otherLayout  = isCripta ? 'kiosk' : 'cripta';
        const otherHistory = document.getElementById(this._getLayoutIds(otherLayout).history);
        if (otherHistory) {
            const oBubble = otherLayout === 'cripta' ? 'd1-bubble-a' : 'd2-bubble-a';
            const oName   = otherLayout === 'cripta' ? 'd1-name'     : 'd2-name';
            const otherDiv = document.createElement('div');
            otherDiv.className = oBubble;
            otherDiv.innerHTML = `<span class="${oName}">${avatar.name}</span><span class="msg-text"></span>`;
            otherHistory.appendChild(otherDiv);
            div._syncElement = otherDiv;
        }
        return div;
    },

    _finalizeMessage(fullText, messageElement, avatar, isCripta) {
        if (!fullText.trim() && !messageElement) {
            const fallbackHtml = `<span class="${isCripta ? 'd1-name' : 'd2-name'}">${avatar.name}</span><span class="msg-text" style="opacity:.6">...</span>`;
            this._appendBubble(fallbackHtml, isCripta ? 'd1-bubble-a' : 'd2-bubble-a', true);
        }
        if (this.currentSentence.trim().length > 4) {
            if (typeof speakText === 'function') speakText(this.currentSentence.trim());
            this.currentSentence = '';
        }
        if (fullText.trim()) {
            this.messages.push({ role: 'assistant', content: fullText });
            this._trimHistory();
            this._syncMessageToLayouts(fullText, 'assistant', avatar.name);
        }
    },

    _handleSentenceBuffer(chunk) {
        this.currentSentence += chunk;
        if (/[.!?]["'\s]*(\s|$)/.test(this.currentSentence)) {
            const toSpeak = this.currentSentence.trim();
            if (toSpeak.length > 3 && typeof speakText === 'function') speakText(toSpeak);
            this.currentSentence = '';
        }
    },

    _showTyping(show) {
        const el = document.getElementById(this._getLayoutIds(this.currentLayout).typing);
        if (el) el.classList.toggle('hidden', !show);
    },

    _setInputEnabled(enabled) {
        if (this.refs.input)   this.refs.input.disabled   = !enabled;
        if (this.refs.sendBtn) this.refs.sendBtn.disabled = !enabled;
    },

    _showError(avatar, isCripta) {
        const errorHtml = `<span class="${isCripta ? 'd1-name' : 'd2-name'}">${avatar.name}</span><span class="msg-text" style="color:#f87171">Lo siento, hubo un error. Intenta de nuevo.</span>`;
        this._appendBubble(errorHtml, isCripta ? 'd1-bubble-a' : 'd2-bubble-a', true);
        this._scrollBottom();
        if (typeof setAvatarState === 'function') setAvatarState(window.AVATAR_STATES?.WAITING);
    },

    _appendBubble(content, className, isHtml = false) {
        const div = document.createElement('div');
        div.className = className;
        if (isHtml) div.innerHTML = content;
        else div.textContent = content;
        this.refs.history?.appendChild(div);
        this._scrollBottom();
        return div;
    },

    _trimHistory() {
        if (this.messages.length > this.MAX_HISTORY) this.messages = this.messages.slice(-this.MAX_HISTORY);
    },

    _scrollBottom() {
        if (this.refs.history) this.refs.history.scrollTop = this.refs.history.scrollHeight;
    }
};

window.addMessage    = (role, content, avatarId) => ChatManager.addMessage(role, content, avatarId);
window.initChat      = () => ChatManager.init();
window.updateActiveChat = (layout) => ChatManager.updateActiveLayout(layout);
window.ChatManager   = ChatManager;
