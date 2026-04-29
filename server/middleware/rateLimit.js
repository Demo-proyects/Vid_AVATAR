/**
 * Rate limiting diferenciado por endpoint
 */

const rateLimit = require('express-rate-limit');

const ENDPOINT_LIMITS = {
  CHAT: {
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: {
      error: 'Límite de chat excedido',
      details: 'Has excedido el límite de 50 peticiones de chat cada 15 minutos. Intenta más tarde.'
    }
  },
  TTS: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      error: 'Límite de TTS excedido',
      details: 'Has excedido el límite de 100 peticiones de TTS cada 15 minutos. Intenta más tarde.'
    }
  },
  AUTH: {
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
      error: 'Límite de autenticación excedido',
      details: 'Demasiados intentos de autenticación. Intenta nuevamente en 1 hora.'
    }
  },
  API: {
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: {
      error: 'Límite de API excedido',
      details: 'Has excedido el límite de 200 peticiones cada 15 minutos. Intenta más tarde.'
    }
  },
  ADMIN: {
    windowMs: 5 * 60 * 1000,
    max: 30,
    message: {
      error: 'Límite de administración excedido',
      details: 'Has excedido el límite de 30 peticiones de administración cada 5 minutos.'
    }
  }
};

function createLimiter(endpointType) {
  const config = ENDPOINT_LIMITS[endpointType] || ENDPOINT_LIMITS.API;

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: config.message,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
      if (endpointType === 'AUTH' && req.body?.email) {
        return `${req.ip}:${req.body.email}`;
      }
      return req.ip;
    },
    handler: (req, res, _next, options) => {
      res.status(options.statusCode || 429).json({
        success: false,
        error: options.message.error,
        details: options.message.details,
        retryAfter: Math.ceil(options.windowMs / 1000),
        limitType: endpointType
      });
    }
  });
}

const limiters = {
  chat: createLimiter('CHAT'),
  tts: createLimiter('TTS'),
  auth: createLimiter('AUTH'),
  api: createLimiter('API'),
  admin: createLimiter('ADMIN')
};

const devHandler = (type) => rateLimit({
  windowMs: ENDPOINT_LIMITS[type].windowMs,
  max: ENDPOINT_LIMITS[type].max * 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode || 429).json({
      success: false,
      error: 'Límite de desarrollo excedido',
      details: 'En producción este límite sería más restrictivo.',
      limitType: type
    });
  }
});

const devLimiters = {
  chat: devHandler('CHAT'),
  api: devHandler('API')
};

function conditionalRateLimit(req, res, next) {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'test') return next();

  const url = req.originalUrl;

  if (env === 'development') {
    if (url.includes('/chat')) return devLimiters.chat(req, res, next);
    return devLimiters.api(req, res, next);
  }

  if (url.includes('/chat'))                                              return limiters.chat(req, res, next);
  if (url.includes('/tts'))                                               return limiters.tts(req, res, next);
  if (url.includes('/auth'))                                              return limiters.auth(req, res, next);
  if (url.includes('/admin') || url.includes('/memory') || url.includes('/conversations')) return limiters.admin(req, res, next);
  return limiters.api(req, res, next);
}

module.exports = { conditionalRateLimit, limiters, ENDPOINT_LIMITS };
