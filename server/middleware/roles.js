/**
 * Middleware de roles y autenticación
 *
 * requireAuth  → cualquier usuario logueado
 * requireAdmin → solo el admin supremo (email desde .env)
 * optionalAuth → si hay token lo decodifica, si no sigue como visitante
 */

const jwt = require('jsonwebtoken');

const SECRET = process.env.ADMIN_SESSION_SECRET;
const ADMIN_EMAIL = () => process.env.ADMIN_EMAIL;

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Autenticación requerida' });
  }

  jwt.verify(token, SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Autenticación requerida' });
  }

  jwt.verify(token, SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token inválido o expirado' });
    }
    if (user.email !== ADMIN_EMAIL()) {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede realizar esta acción' });
    }
    req.user = user;
    next();
  });
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, SECRET, (err, user) => {
    req.user = err ? null : user;
    next();
  });
}

module.exports = { requireAuth, requireAdmin, optionalAuth };
