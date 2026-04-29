/**
 * Middleware de seguridad básico
 * - Headers de seguridad HTTP
 * - Protección contra ataques comunes
 * - Validación de entrada básica
 */

const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');

/**
 * Configuración de headers de seguridad con Helmet
 */
function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        mediaSrc: ["'self'", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
        scriptSrcAttr: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.groq.com", "https://api.deepseek.com"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
}

/**
 * Middleware para sanitizar entrada contra XSS
 */
function xssProtection() {
  return xss();
}

/**
 * Middleware para prevenir parameter pollution
 */
function preventParameterPollution() {
  return hpp();
}

/**
 * Middleware para sanitizar entrada contra NoSQL injection
 */
function noSqlInjectionProtection() {
  return mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      console.warn(`[security] Campo sanitizado: ${key}`, req.ip);
    }
  });
}

/**
 * Middleware para validación básica de entrada
 */
function inputValidation(req, res, next) {
  // Validar tamaño máximo del body
  const maxBodySize = 10 * 1024 * 1024; // 10MB
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxBodySize) {
    return res.status(413).json({
      success: false,
      error: 'Payload demasiado grande',
      details: `El tamaño máximo permitido es ${maxBodySize / (1024 * 1024)}MB`
    });
  }

  // Validar content-type para JSON (excepto uploads de archivos)
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.headers['content-type'] || '';
    // Permitir multipart/form-data para subida de archivos
    if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      return res.status(415).json({
        success: false,
        error: 'Content-Type no soportado',
        details: 'Solo se acepta application/json o multipart/form-data'
      });
    }
  }

  next();
}

/**
 * Middleware para logging de seguridad
 */
function securityLogging(req, res, next) {
  const startTime = Date.now();
  
  // Interceptar respuesta para logging
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    
    // Log de seguridad para respuestas de error
    if (res.statusCode >= 400) {
      console.log(`[security] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - IP: ${req.ip}`, {
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'],
        statusCode: res.statusCode
      });
    }
    
    // Log para intentos de autenticación fallidos
    if (req.path.includes('/auth') && res.statusCode === 401) {
      console.warn(`[security] Intento de autenticación fallido - IP: ${req.ip}`, {
        path: req.path,
        username: req.body?.username || 'unknown'
      });
    }
    
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * Middleware para limitar métodos HTTP
 */
function limitHttpMethods(allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
  return (req, res, next) => {
    if (!allowedMethods.includes(req.method)) {
      return res.status(405).json({
        success: false,
        error: 'Método no permitido',
        details: `Método ${req.method} no está permitido para esta ruta`
      });
    }
    next();
  };
}

/**
 * Middleware para protección contra fuerza bruta (complementario a rate limiting)
 */
function bruteForceProtection(req, res, next) {
  // Esta función sería complementaria al rate limiting
  // Podría integrarse con una base de datos para tracking más avanzado
  
  // Por ahora, solo logging
  if (req.path.includes('/auth/login') && req.method === 'POST') {
    console.log(`[security] Intento de login desde IP: ${req.ip}`);
  }
  
  next();
}

/**
 * Middleware completo de seguridad
 */
function applySecurityMiddleware(app) {
  // Headers de seguridad
  app.use(securityHeaders());
  
  // Protección XSS
  app.use(xssProtection());
  
  // Prevenir parameter pollution
  app.use(preventParameterPollution());
  
  // Protección NoSQL injection
  app.use(noSqlInjectionProtection());
  
  // Validación de entrada
  app.use(inputValidation);
  
  // Logging de seguridad
  app.use(securityLogging);
  
  // Protección contra fuerza bruta
  app.use(bruteForceProtection);
  
  console.log('✅ Middleware de seguridad aplicado');
}

module.exports = {
  securityHeaders,
  xssProtection,
  preventParameterPollution,
  noSqlInjectionProtection,
  inputValidation,
  securityLogging,
  limitHttpMethods,
  bruteForceProtection,
  applySecurityMiddleware
};
