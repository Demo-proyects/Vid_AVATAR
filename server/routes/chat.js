const express = require('express');
const router = express.Router();

const aiRouter = require('../services/aiRouter');
const database = require('../services/database');
const StreamHelper = require('../utils/streamHelper');
const validation = require('../middleware/validation');
const { optionalAuth } = require('../middleware/roles');

function detectLanguage(text) {
  const patterns = {
    es: {
      words: ['hola','gracias','por favor','cómo','estás','qué','muy','bueno','tengo','quiero','puedo','necesito','hacer','este','para','con','una','pero','que','como'],
      chars: ['á','é','í','ó','ú','ñ','¿','¡']
    },
    fr: {
      words: ['bonjour','merci','comment','très','bien','oui','les','des','est','que','pas','vous','nous','dans','sur','avec','pour','fait','aussi','même'],
      chars: ['é','è','ê','ë','à','â','ù','û','ç','œ']
    },
    en: {
      words: ['hello','thanks','please','how','what','this','that','have','will','would','could','should','they','there','their','about','which','when','your'],
      chars: []
    }
  };

  const lower = text.toLowerCase();
  const scores = { es: 0, en: 0, fr: 0 };

  for (const [lang, p] of Object.entries(patterns)) {
    for (const w of p.words) {
      if (new RegExp(`\\b${w}\\b`).test(lower)) scores[lang] += 2;
    }
    for (const c of p.chars) {
      if (lower.includes(c)) scores[lang] += 3;
    }
  }

  let maxLang = 'es', maxScore = -1;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) { maxScore = score; maxLang = lang; }
  }
  return maxLang;
}

const LANG_NAMES = { es: 'español', en: 'inglés', fr: 'francés' };

let telegramService = null;
try {
  telegramService = require('../services/telegramService');
} catch (_) {}

router.post('/', optionalAuth, validation.validateChatRequest, async (req, res) => {
  const { messages, avatar, sessionId: clientSessionId, userInfo } = req.body;
  const projectConfig = req.projectConfig || {};

  try {
    StreamHelper.setupSSEHeaders(res);

    let clientDisconnected = false;
    req.on('close', () => { clientDisconnected = true; });

    const projectContext = projectConfig.contexto || '';
    const personalidad = projectConfig.personalidad || '';
    const combinedContext = `${personalidad}\n${projectContext}`.trim();

    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMsg = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
    const detectedLang = detectLanguage(lastUserMsg || 'hola');
    const langName = LANG_NAMES[detectedLang] || 'español';

    const langInstruction = `IMPORTANTE: El usuario está hablando en ${langName}. Responde SIEMPRE en ${langName} durante toda la conversación.`;
    const sysIdx = messages.findIndex(m => m.role === 'system');
    if (sysIdx >= 0) {
      messages[sysIdx] = { ...messages[sysIdx], content: messages[sysIdx].content + '\n\n' + langInstruction };
    } else {
      messages.unshift({ role: 'system', content: langInstruction });
    }

    const sessionId = clientSessionId || `sess_${Date.now()}`;
    const userId = req.user?.id || null;

    const result = await aiRouter.routeAI(messages, {
      avatar,
      context: combinedContext,
      sessionId,
      userId
    });

    const { stream } = result;

    let fullResponse = '';
    let hasContent = false;

    try {
      for await (const chunk of stream) {
        if (clientDisconnected) break;
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          hasContent = true;
          fullResponse += content;
          StreamHelper.sendChunk(res, { content });
        }
      }
    } catch (streamError) {
      console.error('Error procesando stream:', streamError);
      throw streamError;
    }

    if (!hasContent) {
      const fallback = avatar === 'mimi' ? '😊 ¿Puedes contarme más?' : 'Cuéntame más.';
      StreamHelper.sendChunk(res, { content: fallback });
      fullResponse = fallback;
    }

    StreamHelper.sendDone(res);
    res.end();

    if (!clientDisconnected) {
      try {
        const allMessages = [...messages, { role: 'assistant', content: fullResponse }];
        await database.saveConversation(sessionId, avatar, allMessages);

        if (telegramService?.enabled) {
          const userName = req.user?.name || userInfo?.name || 'Visitante';
          const userEmail = req.user?.email || userInfo?.email || '';
          const userMessage = messages[messages.length - 1]?.content || '';

          telegramService.notifyNewConversation({
            sessionId,
            avatarId: avatar,
            messageCount: allMessages.length,
            timestamp: new Date().toLocaleString('es-DO'),
            user: { name: userName, email: userEmail },
            lastMessage: userMessage,
            response: fullResponse.substring(0, 200)
          }).catch(err => console.error('[chat] Error Telegram:', err.message));
        }
      } catch (dbError) {
        console.error('Error al guardar conversación:', dbError);
      }
    }

  } catch (error) {
    StreamHelper.handleStreamError(error, res);
  }
});

module.exports = router;
