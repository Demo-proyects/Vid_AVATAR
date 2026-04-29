const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../services/database');
const config = require('../config');

const SECRET = process.env.ADMIN_SESSION_SECRET;
const ADMIN_EMAIL = () => process.env.ADMIN_EMAIL;

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de autenticación requerido' });
  }

  jwt.verify(token, SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
};

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nombre, email y contraseña son requeridos' });
    }
    if (name.length < 2) {
      return res.status(400).json({ success: false, message: 'El nombre debe tener al menos 2 caracteres' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Email inválido' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Este email ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.registerUser(name, email, hashedPassword);

    const role = email === ADMIN_EMAIL() ? 'admin' : 'user';
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role },
      SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Registro exitoso',
      token,
      user: { id: user.id, name: user.name, email: user.email, role }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ success: false, message: 'Error interno al registrar usuario' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });
    }

    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    await db.updateLastLogin(user.id);

    const role = user.email === ADMIN_EMAIL() ? 'admin' : (user.role || 'user');

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role },
      SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: { id: user.id, name: user.name, email: user.email, role }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, message: 'Error interno al iniciar sesión' });
  }
});

router.get('/verify', authenticateToken, (req, res) => {
  res.json({ success: true, message: 'Token válido', user: req.user });
});

router.post('/logout', authenticateToken, (req, res) => {
  res.json({ success: true, message: 'Sesión cerrada exitosamente' });
});

router.get('/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

/**
 * POST /api/auth/seed — protegido con SEED_TOKEN
 */
router.post('/seed', async (req, res) => {
  try {
    const { seedToken } = req.body;
    const expectedToken = process.env.SEED_TOKEN;

    if (!expectedToken || seedToken !== expectedToken) {
      return res.status(403).json({ success: false, message: 'Token de seed inválido' });
    }

    const adminEmail = ADMIN_EMAIL();
    const existingAdmin = await db.getUserByEmail(adminEmail);
    if (existingAdmin) {
      return res.json({ success: true, message: 'Admin ya existe', seeded: false });
    }

    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    const result = await db.seedAdminUser(adminEmail, 'Admin', hashedPassword);
    res.json({ success: true, ...result });

  } catch (error) {
    console.error('Error seeding admin:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/auth/users — solo admin
 */
router.get('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.email !== ADMIN_EMAIL()) {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede ver usuarios' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const users = await db.getUsers(limit, (page - 1) * limit);
    res.json({ success: true, users, page, limit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = { router, authenticateToken };
