/**
 * Servicio de notificaciones por Telegram
 * 
 * Fixes:
 * - URLSearchParams para construir query params (no string concatenation)
 * - ADMIN_URL desde .env en lugar de localhost hardcodeado
 * - Timeout en la petición HTTP
 */

const https = require('https');
const config = require('../config');

class TelegramService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    this.enabled = !!(this.botToken && this.chatId);

    if (this.enabled) {
      console.log(' Servicio de Telegram activado');
    } else {
      console.log(' Telegram desactivado (configurar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en .env)');
    }
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      if (!this.enabled) {
        resolve({ sent: false, reason: 'Telegram no configurado' });
        return;
      }

      const params = new URLSearchParams({
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML'
      });

      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${this.botToken}/sendMessage?${params.toString()}`,
        method: 'GET',
        timeout: 5000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.ok) {
              resolve({ sent: true, result: result.result });
            } else {
              console.error('[Telegram] Error:', result.description);
              resolve({ sent: false, error: result.description });
            }
          } catch (e) {
            resolve({ sent: false, error: e.message });
          }
        });
      });

      req.on('timeout', () => {
        console.warn('[Telegram] Timeout — descartando notificación');
        req.destroy();
        resolve({ sent: false, error: 'timeout' });
      });

      req.on('error', (err) => {
        console.error('[Telegram] Error de conexión:', err.message);
        resolve({ sent: false, error: err.message });
      });

      req.end();
    });
  }

  async notifyNewConversation(data) {
    if (!this.enabled) return;
    const message = this._buildNewConversationMessage(data);
    return this.sendMessage(message);
  }

  _buildNewConversationMessage(data) {
    const emoji = data.avatarId === 'mimi' ? '' : '';
    const avatarName = data.avatarId === 'mimi' ? 'Mimi' : data.avatarId === 'nara' ? 'Nara' : data.avatarId || 'Desconocido';
    const userName = data.user?.name || 'Visitante';
    const userEmail = data.user?.email ? ` (${data.user.email})` : '';
    const lastMessage = data.lastMessage ? `\n\n<b> Mensaje:</b> ${data.lastMessage.substring(0, 300)}` : '';
    const response = data.response ? `\n\n<b> Respuesta:</b> ${data.response}` : '';

    const adminUrl = config.admin.url;

    return [
      `<b> NUEVA CONVERSACIÓN</b>`,
      ``,
      `<b>${emoji} Avatar:</b> ${avatarName}`,
      `<b> Usuario:</b> ${userName}${userEmail}`,
      `<b> Sesión:</b> <code>${data.sessionId}</code>`,
      `<b> Mensajes:</b> ${data.messageCount || 1}`,
      `<b> Hora:</b> ${data.timestamp || new Date().toLocaleString('es-DO')}`,
      lastMessage,
      response,
      ``,
      `<i>Panel admin: ${adminUrl}</i>`
    ].join('\n');
  }

  async verifyBot() {
    if (!this.botToken) return { ok: false, error: 'Token no configurado' };

    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${this.botToken}/getMe`,
        timeout: 5000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({ ok: result.ok, bot: result.result });
          } catch (e) {
            resolve({ ok: false, error: e.message });
          }
        });
      });

      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
      req.on('error', (err) => resolve({ ok: false, error: err.message }));
      req.end();
    });
  }
}

module.exports = new TelegramService();
