/**
 * Configuración centralizada del proyecto
 * Valida variables de entorno y proporciona configuración estructurada
 */

const REQUIRED_ENV_VARS = [
  'GROQ_API_KEY',
  'GROQ_MODEL_FAST',
  'PORT',
  'ADMIN_SESSION_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD'
];

const OPTIONAL_ENV_VARS = [
  'GROQ_MODEL_SMART',
  'DEEPSEEK_API_KEY',
  'GOOGLE_TTS_PROJECT_ID',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'NODE_ENV',
  'ADMIN_URL',
  'ALLOWED_ORIGINS',
  // ── CAMBIO: nuevas variables opcionales de OpenAI ──
  'OPENAI_API_KEY',
  'OPENAI_TTS_MODEL',
  'OPENAI_LLM_MODEL'
];

const VALID_AVATARS = ['nara', 'mimi', 'ava03', 'vid'];

function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas: ${missing.join(', ')}\n` +
      'Por favor, revisa tu archivo .env'
    );
  }

  if (process.env.ADMIN_SESSION_SECRET === 'misterio-de-vid-secret-key-change-in-production') {
    console.warn('⚠️  ADMIN_SESSION_SECRET usa el valor por defecto. Cámbialo en producción.');
  }

  console.log('✅ Configuración de entorno validada correctamente');
}

const groqConfig = {
  apiKey: process.env.GROQ_API_KEY,
  models: {
    fast: process.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant',
    smart: process.env.GROQ_MODEL_SMART || 'llama-3.3-70b-versatile'
  }
};

const serverConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : '*'
};

const ttsConfig = {
  projectId: process.env.GOOGLE_TTS_PROJECT_ID,
  credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS
};

const deepseekConfig = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
};

// ── CAMBIO: bloque de configuración de OpenAI (totalmente opcional) ──
// El servidor arranca normalmente si estas variables no están definidas.
// openaiService.isAvailable() comprobará en runtime si la key es válida.
const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY || null,
  ttsModel: process.env.OPENAI_TTS_MODEL || 'tts-1-hd',
  llmModel: process.env.OPENAI_LLM_MODEL || 'gpt-4.1-mini'
};

const adminConfig = {
  email: process.env.ADMIN_EMAIL,
  url: process.env.ADMIN_URL || 'http://localhost:3000/admin'
};

const config = {
  groq: groqConfig,
  server: serverConfig,
  tts: ttsConfig,
  deepseek: deepseekConfig,
  // ── CAMBIO: exportar openaiConfig junto al resto ──
  openai: openaiConfig,
  admin: adminConfig,
  validAvatars: VALID_AVATARS,
  validateEnv
};

module.exports = config;