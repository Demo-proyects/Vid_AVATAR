/* chat.js (frontend) — Sistema de chat con streaming
   FIXES: IDs correctos para dual layout (chat-history-cripta / kiosk),
   no duplica listeners, usa window.currentAvatarId correctamente */

const MAX_HISTORY = 20;
let messages        = [];
let currentSentence = '';
let _isResponding   = false;
let _currentLayout  = 'cripta';

// Referencias activas al layout visible
let _chatHistory, _chatInput, _sendBtn;

function initChat(){
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', _doInitChat);
  }else{
    _doInitChat();
  }
}

function _doInitChat(){
  _currentLayout = 'cripta';
  _updateRefs();
  _bindLayoutEvents('cripta');
  _bindLayoutEvents('kiosk');
  console.log('[chat] Inicializado');
}

// Vincula eventos de envío a un layout específico (se llama 1 sola vez por layout)
function _bindLayoutEvents(layout){
  const inputId  = layout==='cripta' ? 'chat-input-cripta'  : 'chat-input-kiosk';
  const sendId   = layout==='cripta' ? 'send-btn-cripta'    : 'send-btn-kiosk';
  const input    = document.getElementById(inputId);
  const sendBtn  = document.getElementById(sendId);
  if(!input || input._chatBound) return;
  input._chatBound = true;

  const handleSubmit = async ()=>{
    if(_currentLayout !== layout) return; // solo responde el layout activo
    const text = input.value.trim();
    if(!text || _isResponding) return;
    input.value = '';
    _updateRefs();
    _addUserMessage(text);
    await _sendToAI(text);
  };

  input.addEventListener('keydown', e=>{
    if(e.key==='Enter' && !e.shiftKey){e.preventDefault();handleSubmit();}
  });
  sendBtn?.addEventListener('click', handleSubmit);
}

function _updateRefs(){
  const histId  = _currentLayout==='cripta' ? 'chat-history-cripta' : 'chat-history-kiosk';
  const inputId = _currentLayout==='cripta' ? 'chat-input-cripta'   : 'chat-input-kiosk';
  const sendId  = _currentLayout==='cripta' ? 'send-btn-cripta'     : 'send-btn-kiosk';
  _chatHistory = document.getElementById(histId);
  _chatInput   = document.getElementById(inputId);
  _sendBtn     = document.getElementById(sendId);
}

// Llamado desde el switch de tema
window.updateActiveChat = function(layout){
  _currentLayout = layout;
  _updateRefs();
  setTimeout(()=>_chatInput?.focus(), 50);
};

function addMessage(role, content, avatarId){
  if(role==='user') _addUserMessage(content);
  else              _addAssistantMessage(content, avatarId || window.currentAvatarId || 'nara');
}

function _addUserMessage(text){
  messages.push({role:'user', content:text});
  _trimHistory();
  const div = document.createElement('div');
  div.className = _currentLayout==='cripta' ? 'd1-bubble-u' : 'd2-bubble-u';
  div.textContent = text;
  _chatHistory?.appendChild(div);
  _scrollBottom();
}

function resetMessages(){
  messages = [];
  currentSentence = '';
  _isResponding = false;
}

function _addAssistantMessage(text, avatarId){
  const avatar = (window.AVATARS && window.AVATARS[avatarId]) ? window.AVATARS[avatarId] : {name:'Asistente'};
  messages.push({role:'assistant', content:text});
  _trimHistory();

  const div      = document.createElement('div');
  div.className  = _currentLayout==='cripta' ? 'd1-bubble-a' : 'd2-bubble-a';
  const nameSpan = document.createElement('span');
  nameSpan.className = _currentLayout==='cripta' ? 'd1-name' : 'd2-name';
  nameSpan.textContent = avatar.name;
  const textSpan = document.createElement('span');
  textSpan.className = 'msg-text';
  textSpan.textContent = text || '';
  div.appendChild(nameSpan);
  div.appendChild(textSpan);
  _chatHistory?.appendChild(div);
  _scrollBottom();
  return textSpan;
}

async function _sendToAI(userText){
  _isResponding = true;
  _setInputEnabled(false);
  _showTyping(true);
  currentSentence = '';

  const avatarId = window.currentAvatarId || 'nara';
  const avatar   = (window.AVATARS && window.AVATARS[avatarId]) ? window.AVATARS[avatarId] : {name:'Asistente'};
  const isCripta = _currentLayout==='cripta';
  let msgDiv=null, textSpan=null;

  try{
    // Leer token JWT — se guarda en localStorage desde admin.html
    const _token = localStorage.getItem('vid_token');
    const _headers = { 'Content-Type': 'application/json' };
    if (_token) _headers['Authorization'] = 'Bearer ' + _token;

    const res = await fetch('/api/chat',{
      method:'POST',
      headers: _headers,
      body:JSON.stringify({messages:[...messages], avatar:avatarId}),
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    _showTyping(false);

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';

    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      const raw = decoder.decode(value);
      for(const line of raw.split('\n')){
        if(!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if(dataStr==='[DONE]') break;
        try{
          const {content} = JSON.parse(dataStr);
          if(!content) continue;
          if(!msgDiv){
            msgDiv = document.createElement('div');
            msgDiv.className = isCripta ? 'd1-bubble-a' : 'd2-bubble-a';
            const senderSpan = document.createElement('span');
            senderSpan.className = isCripta ? 'd1-name' : 'd2-name';
            senderSpan.textContent = avatar.name;
            textSpan = document.createElement('span');
            textSpan.className = 'msg-text';
            msgDiv.appendChild(senderSpan);
            msgDiv.appendChild(textSpan);
            _chatHistory?.appendChild(msgDiv);
          }
          fullText += content;
          textSpan.textContent = fullText;
          _scrollBottom();
          _handleSentenceBuffer(content);
        }catch(_){}
      }
    }

    if(!fullText.trim() && !msgDiv){
      msgDiv = document.createElement('div');
      msgDiv.className = isCripta ? 'd1-bubble-a' : 'd2-bubble-a';
      msgDiv.innerHTML = `<span class="${isCripta?'d1-name':'d2-name'}">${avatar.name}</span><span class="msg-text" style="opacity:.6">...</span>`;
      _chatHistory?.appendChild(msgDiv);
      _scrollBottom();
    }

    if(currentSentence.trim().length > 4){
      if(typeof speakText==='function') speakText(currentSentence.trim());
      currentSentence = '';
    }
    if(fullText.trim()){
      messages.push({role:'assistant', content:fullText});
      _trimHistory();
    }

  }catch(err){
    console.error('[chat] Error:',err);
    _showTyping(false);
    const errDiv = document.createElement('div');
    errDiv.className = isCripta ? 'd1-bubble-a' : 'd2-bubble-a';
    errDiv.innerHTML = `<span class="${isCripta?'d1-name':'d2-name'}">${avatar.name}</span><span class="msg-text" style="color:#f87171">Lo siento, hubo un error. Intenta de nuevo.</span>`;
    _chatHistory?.appendChild(errDiv);
    _scrollBottom();
    if(typeof setAvatarState==='function') setAvatarState(AVATAR_STATES.WAITING);
  }finally{
    _isResponding=false;
    _setInputEnabled(true);
    _chatInput?.focus();
  }
}

function _handleSentenceBuffer(chunk){
  currentSentence += chunk;
  if(/[.!?]["'\s]*(\s|$)/.test(currentSentence)){
    const toSpeak = currentSentence.trim();
    if(toSpeak.length > 3 && typeof speakText==='function') speakText(toSpeak);
    currentSentence = '';
  }
}

function _showTyping(show){
  const id = _currentLayout==='cripta' ? 'typing-indicator-cripta' : 'typing-indicator-kiosk';
  const el = document.getElementById(id);
  if(el) el.classList.toggle('hidden', !show);
}

function _setInputEnabled(enabled){
  if(_chatInput) _chatInput.disabled = !enabled;
  if(_sendBtn)   _sendBtn.disabled   = !enabled;
}

function _trimHistory(){
  if(messages.length > MAX_HISTORY) messages = messages.slice(-MAX_HISTORY);
}

function _scrollBottom(){
  if(_chatHistory) _chatHistory.scrollTop = _chatHistory.scrollHeight;
}

window.addMessage = addMessage;
window.initChat   = initChat;
window.resetMessages = resetMessages;