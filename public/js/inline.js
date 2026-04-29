/* ════════════════════════════════════════════════════════════
   INLINE SCRIPT — MISTERIO DE VID (v4.0 — CORREGIDO)
   ════════════════════════════════════════════════════════════
   Movido a archivo separado para evitar bloqueos CSP.
   Cada bloque funcional es independiente con try/catch propio.
   Las funciones críticas se definen como window.* para disponibilidad global.
   ════════════════════════════════════════════════════════════ */
console.log('[inline] Script v4.0 cargado y ejecutando');

/* ════════════════════════════════════════════════════════════
   SWITCH (Kiosk/Cripta) — Definiciones globales
   ════════════════════════════════════════════════════════════ */
try {
const d1El = document.getElementById('d1');
const d2El = document.getElementById('d2');
const overlay = document.getElementById('t-overlay');
let current=1, busy=false;

window._switchDirect = function(toD2){
  if(toD2){d1El.style.display='none';d2El.style.display='flex';current=2;}
  else{d2El.style.display='none';d1El.style.display='flex';current=1;}
  document.body.classList.toggle('kiosk-mode', toD2);
  if(typeof window.updateActiveChat==='function')window.updateActiveChat(toD2?'kiosk':'cripta');
  if(typeof window.syncAvatars==='function')window.syncAvatars();
  busy=false;
};

function getOrigin(el){
  const r=el.getBoundingClientRect();
  return{x:((r.left+r.width/2)/window.innerWidth*100).toFixed(2),y:((r.top+r.height/2)/window.innerHeight*100).toFixed(2)};
}

window.doSwitch = function(originEl){
  if(busy)return;busy=true;
  const toD2=current===1;
  if(typeof gsap==='undefined')return window._switchDirect(toD2);
  try{
    const{x,y}=getOrigin(originEl);
    overlay.style.background=toD2?'#040e18':'#080810';
    overlay.style.clipPath=`circle(0% at ${x}% ${y}%)`;
    overlay.style.pointerEvents='all';
    gsap.to(overlay,{duration:.55,ease:'power3.in',clipPath:`circle(160% at ${x}% ${y}%)`,
      onComplete:()=>{
        if(toD2){d1El.style.display='none';d2El.style.display='flex';current=2;document.body.classList.add('kiosk-mode');if(typeof window.updateActiveChat==='function')window.updateActiveChat('kiosk');if(typeof window.syncAvatars==='function')window.syncAvatars();}
        else{d2El.style.display='none';d1El.style.display='flex';current=1;document.body.classList.remove('kiosk-mode');if(typeof window.updateActiveChat==='function')window.updateActiveChat('cripta');if(typeof window.syncAvatars==='function')window.syncAvatars();}
        gsap.to(overlay,{duration:.5,ease:'power3.out',clipPath:`circle(0% at ${x}% ${y}%)`,onComplete:()=>{overlay.style.pointerEvents='none';busy=false;}});
      }
    });
  }catch(e){console.warn('[switch] GSAP falló, usando directo:',e);window._switchDirect(toD2);}
};

/* ── Event listeners del switch ── */
document.getElementById('sw-btn-sidebar')?.addEventListener('click',function(e){e.stopPropagation();window.doSwitch(this);});
document.getElementById('sw-btn-kiosk-panel')?.addEventListener('click',function(e){e.stopPropagation();window.doSwitch(this);});
document.querySelector('.d1-mob-tab-switch')?.addEventListener('click',function(e){e.stopPropagation();window.doSwitch(this);});
document.querySelector('.d2-mob-tab-switch')?.addEventListener('click',function(e){e.stopPropagation();window.doSwitch(this);});
console.log('[inline] Switch listeners registrados');
}catch(e){console.error('[switch] Error:',e);}



/* ════════════════════════════════════════════════════════════
   TABS — CORREGIDO: ya no pisa estados de botones del sidebar
   ════════════════════════════════════════════════════════════ */
try {
document.querySelectorAll('.d1-tab').forEach(t=>t.addEventListener('click',(e)=>{
  e.stopPropagation();
  document.querySelectorAll('.d1-tab').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');
}));
document.querySelectorAll('.d2-tab').forEach(t=>t.addEventListener('click',(e)=>{
  e.stopPropagation();
  document.querySelectorAll('.d2-tab').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');
}));
// NOTA: Se ELIMINA el listener genérico de .d1-ico que pisaba los estados de los botones del sidebar
// Cada botón del sidebar maneja su propio estado visual ahora
console.log('[inline] Tab listeners registrados (sin pisar sidebar)');
}catch(e){console.error('[tabs] Error:',e);}

/* ════════════════════════════════════════════════════════════
   NUEVO CHAT — Limpia conversación actual
   ════════════════════════════════════════════════════════════ */
try {
function newChat() {
  localStorage.removeItem('vid_messages');
  localStorage.removeItem('vid_timestamp');
  localStorage.removeItem('vid_session_id');
  if (typeof window.stopVoice === 'function') window.stopVoice();
  clearChatView();
  if (typeof window.saveMessages === 'function') {
    window.saveMessages([], window.currentAvatarId || 'nara');
  }
}

function clearChatView() {
  ['chat-history-cripta', 'chat-history-kiosk'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  if (typeof window.resetMessages === 'function') {
    window.resetMessages();
  }
}

// Event listeners para nuevo chat (sidebar y mobile tabs)
document.getElementById('new-chat-btn-sidebar')?.addEventListener('click', function(e) {
  e.stopPropagation();
  newChat();
});
document.querySelector('.d1-mob-tab-newchat')?.addEventListener('click', function(e) {
  e.stopPropagation();
  newChat();
});
document.querySelector('.d2-mob-tab-newchat')?.addEventListener('click', function(e) {
  e.stopPropagation();
  newChat();
});
console.log('[inline] NewChat listeners registrados');
}catch(e){console.error('[newchat] Error:',e);}

/* ════════════════════════════════════════════════════════════
   FEEDBACK VISUAL INMEDIATO para botones del sidebar
   ════════════════════════════════════════════════════════════ */
try {
// Todos los .d1-ico reciben feedback visual inmediato al hacer clic
document.querySelectorAll('.d1-ico').forEach(btn => {
  btn.addEventListener('click', function(e) {
    // Feedback visual inmediato: flash momentáneo
    const originalBg = this.style.background;
    this.style.background = 'rgba(124,58,237,0.3)';
    setTimeout(() => {
      this.style.background = originalBg || '';
    }, 150);
  });
});
console.log('[inline] Feedback visual inmediato registrado en botones');
}catch(e){console.error('[feedback] Error:',e);}

/* ════════════════════════════════════════════════════════════
   CHAT INPUT — Auto-resize + Character Counter
   ════════════════════════════════════════════════════════════ */
try {
function autoResize(el){
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,parseInt(el.style.maxHeight||140))+'px';
}
function setupChatInput(inputId){
  var input=document.getElementById(inputId);
  if(!input)return;
  input.addEventListener('input',function(){
    var len=this.value.length,max=parseInt(this.getAttribute('maxlength')||400),pct=len/max;
    this.classList.toggle('char-warn',pct>=0.85);
    this.classList.toggle('char-over',pct>=1);
    autoResize(this);
  });
  autoResize(input);
}
setupChatInput('chat-input-cripta');
setupChatInput('chat-input-kiosk');
console.log('[inline] Auto-resize + warning visual en inputs de chat');
}catch(e){console.error('[chinput] Error:',e);}

console.log('[inline] Script v4.0 — TODOS los módulos cargados correctamente');
