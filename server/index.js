require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');

const config = require('./config');
const { conditionalRateLimit, ENDPOINT_LIMITS } = require('./middleware/rateLimit');
const { applySecurityMiddleware } = require('./middleware/security');

try {
  config.validateEnv();
} catch (error) {
  console.error(' Error de configuración:', error.message);
  process.exit(1);
}

const app = express();
const PORT = config.server.port;

applySecurityMiddleware(app);

app.use(cors({
  origin: config.server.allowedOrigins,
  credentials: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 },
  abortOnLimit: true,
  createParentPath: true
}));
app.use(express.static(path.join(__dirname, '../public')));

const avaPath = path.join(__dirname, '../ava');
if (fs.existsSync(avaPath)) app.use('/ava', express.static(avaPath));

const assetsPath = path.join(__dirname, '../AVATAR/ava');
if (fs.existsSync(assetsPath)) app.use('/ava', express.static(assetsPath));

app.use((req, res, next) => {
  const configPath = path.join(__dirname, '../config/avatar.config.js');
  try {
    if (fs.existsSync(configPath)) {
      delete require.cache[require.resolve(configPath)];
      req.projectConfig = require(configPath);
    } else {
      req.projectConfig = {};
    }
  } catch (err) {
    console.warn('No se pudo cargar avatar.config.js:', err.message);
    req.projectConfig = {};
  }
  next();
});

app.use('/api', conditionalRateLimit);

const chatRoutes = require('./routes/chat');
const ttsRoutes = require('./routes/tts');
const conversationRoutes = require('./routes/conversations');
const memoryRoutes = require('./routes/memory');
const { router: authRoutes } = require('./routes/auth');
const adminRoutes = require('./routes/admin');

app.use('/api/chat', chatRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/config', (req, res) => {
  res.json({ success: true, config: req.projectConfig || {} });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
    rateLimiting: {
      enabled: config.server.isProduction,
      limits: {
        chat: `${ENDPOINT_LIMITS.CHAT.max}/${Math.floor(ENDPOINT_LIMITS.CHAT.windowMs / 60000)}min`,
        tts: `${ENDPOINT_LIMITS.TTS.max}/${Math.floor(ENDPOINT_LIMITS.TTS.windowMs / 60000)}min`,
        auth: `${ENDPOINT_LIMITS.AUTH.max}/${Math.floor(ENDPOINT_LIMITS.AUTH.windowMs / 60000)}min`
      }
    }
  });
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Página no encontrada');
  }
});

const server = app.listen(PORT, async () => {
  console.log(` Servidor corriendo en http://localhost:${PORT}`);
  console.log(` Entorno: ${config.server.nodeEnv}`);
  console.log(` Modelo: ${config.groq.models.fast}`);
  console.log(` Admin panel: http://localhost:${PORT}/admin`);

  if (config.server.isProduction) {
    console.log(' Rate limiting: ACTIVO');
  } else {
    console.log(' Rate limiting: permisivo (desarrollo)');
  }

  try {
    const bcrypt = require('bcryptjs');
    const db = require('./services/database');
    const adminEmail = config.admin.email;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.warn(' ADMIN_EMAIL o ADMIN_PASSWORD no configurados — seed omitido');
    } else {
      const existing = await db.getUserByEmail(adminEmail);
      if (!existing) {
        const hashedPw = await bcrypt.hash(adminPassword, 10);
        const result = await db.seedAdminUser(adminEmail, 'Admin', hashedPw);
        if (result.seeded) console.log(` Admin creado: ${adminEmail}`);
      } else {
        console.log(` Admin verificado: ${adminEmail}`);
      }
    }
  } catch (err) {
    console.error(' Error al seed admin:', err.message);
  }

  // Seed datos demo para avatares (solo si la DB está vacía)
  try {
    const db = require('./services/database');
    const demoResult = await db.seedDemoData();
    if (demoResult.seeded) {
      console.log(' Datos demo de avatares sembrados');
    }
  } catch (err) {
    console.error(' Error al seed datos demo:', err.message);
  }

  const db = require('./services/database');
  // Limpieza forzosa al arrancar — borra TODAS las conversaciones >10min
  try {
    const forceClean = await db.forceCleanupAllOld();
    console.log(` Limpieza forzosa inicial completada`);
  } catch (err) {
    console.error(' Error en limpieza forzosa:', err.message);
  }
  const cleanupInterval = setInterval(async () => {
    try {
      const result = await db.cleanupOldConversationsMinutes(10);
      if (result.deleted > 0) console.log(` Limpieza 10min: ${result.deleted} conversaciones eliminadas`);
      const result2 = await db.cleanupMessageContent(5);
      if (result2.cleaned > 0) console.log(` Limpieza contenido: ${result2.cleaned} conversaciones`);
    } catch (err) {
      console.error(' Error en limpieza:', err.message);
    }
  }, 10 * 60 * 1000);

  process.on('SIGTERM', () => {
    console.log(' SIGTERM recibido — cerrando servidor...');
    clearInterval(cleanupInterval);
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    clearInterval(cleanupInterval);
    server.close(() => process.exit(0));
  });
});
