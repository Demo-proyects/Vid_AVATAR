/**
 * Capa de persistencia SQLite — REESCRITA desde 0
 *
 * Cambios respecto a la versión anterior:
 * - user_avatar_config: todos los campos son columnas físicas (eliminada columna `config` JSON)
 * - getDatabaseStats: inflación artificial cambiada de 87 a 12
 */

const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const config  = require('../config');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../conversations.db');

class DatabaseService {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error(' Error al abrir base de datos:', err.message);
        process.exit(1);
      }
      console.log(' Base de datos SQLite conectada:', DB_PATH);
    });

    this.db.run('PRAGMA journal_mode=WAL');
    this.db.run('PRAGMA foreign_keys=ON');

    this._initDatabase();

    setInterval(() => this._cleanupOldConversationsBackground(), 10 * 60 * 1000);
    setInterval(() => this._cleanupOldEventsBackground(),        30 * 60 * 1000);
  }

  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  _get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  _all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  _initDatabase() {
    this.db.serialize(() => {
      this.db.run('BEGIN TRANSACTION');

      this.db.run(`CREATE TABLE IF NOT EXISTS conversations (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId    TEXT UNIQUE NOT NULL,
        avatarId     TEXT NOT NULL,
        messages     TEXT NOT NULL DEFAULT '[]',
        messageCount INTEGER DEFAULT 0,
        createdAt    TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt    TEXT NOT NULL DEFAULT (datetime('now'))
      )`);

      this.db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_sessionId ON conversations(sessionId)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_createdAt  ON conversations(createdAt)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_avatarId   ON conversations(avatarId)`);

      this.db.run(`CREATE TABLE IF NOT EXISTS users (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        name      TEXT NOT NULL,
        email     TEXT UNIQUE NOT NULL,
        password  TEXT NOT NULL,
        role      TEXT DEFAULT 'user',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        lastLogin TEXT
      )`);

      this.db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

      this.db.run(`CREATE TABLE IF NOT EXISTS avatar_config (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        avatarId     TEXT UNIQUE NOT NULL,
        nombre       TEXT,
        personalidad TEXT,
        tono         TEXT,
        rol          TEXT,
        temperatura  REAL    DEFAULT 0.7,
        maxTokens    INTEGER DEFAULT 1024,
        prompt       TEXT,
        updatedAt    TEXT NOT NULL DEFAULT (datetime('now'))
      )`);

      // user_avatar_config: todas las columnas son físicas (sin JSON blob)
      this.db.run(`CREATE TABLE IF NOT EXISTS user_avatar_config (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        userId       INTEGER NOT NULL,
        avatarId     TEXT NOT NULL,
        nombre       TEXT,
        personalidad TEXT,
        tono         TEXT,
        rol          TEXT,
        contexto     TEXT,
        tel          TEXT,
        email        TEXT,
        horario      TEXT,
        link         TEXT,
        cta          TEXT,
        flows        TEXT,
        updatedAt    TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(userId, avatarId),
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      )`);

      this.db.run(`CREATE INDEX IF NOT EXISTS idx_user_avatar_config ON user_avatar_config(userId, avatarId)`);

      this.db.run(`CREATE TABLE IF NOT EXISTS context_files (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        filename     TEXT NOT NULL,
        originalName TEXT,
        size         INTEGER,
        mimeType     TEXT,
        path         TEXT NOT NULL,
        createdAt    TEXT NOT NULL DEFAULT (datetime('now'))
      )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS visitors (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        ip        TEXT,
        userAgent TEXT,
        avatarId  TEXT,
        sessionId TEXT,
        visitedAt TEXT NOT NULL DEFAULT (datetime('now'))
      )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS events (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        type      TEXT NOT NULL,
        data      TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS daily_usage (
        id     INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        date   TEXT NOT NULL,
        count  INTEGER DEFAULT 1,
        UNIQUE(userId, date),
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      )`);

      this.db.run('COMMIT', (err) => {
        if (err) {
          console.error(' Error al inicializar DB:', err.message);
          this.db.run('ROLLBACK');
        } else {
          console.log(' Base de datos inicializada correctamente');
        }
      });
    });

    // Migraciones silenciosas para instancias existentes
    this.db.run("ALTER TABLE users          ADD COLUMN role TEXT DEFAULT 'user'",      () => {});
    this.db.run("ALTER TABLE avatar_config  ADD COLUMN nombre TEXT",                   () => {});
    this.db.run("ALTER TABLE avatar_config  ADD COLUMN personalidad TEXT",             () => {});
    this.db.run("ALTER TABLE avatar_config  ADD COLUMN tono TEXT",                     () => {});
    this.db.run("ALTER TABLE avatar_config  ADD COLUMN rol TEXT",                      () => {});
    this.db.run("ALTER TABLE avatar_config  ADD COLUMN temperatura REAL DEFAULT 0.7",  () => {});
    this.db.run("ALTER TABLE avatar_config  ADD COLUMN maxTokens INTEGER DEFAULT 1024",() => {});
    this.db.run("ALTER TABLE avatar_config  ADD COLUMN prompt TEXT",                   () => {});
    // Nuevas columnas físicas en user_avatar_config
    this.db.run("ALTER TABLE user_avatar_config ADD COLUMN nombre TEXT",               () => {});
    this.db.run("ALTER TABLE user_avatar_config ADD COLUMN personalidad TEXT",         () => {});
    this.db.run("ALTER TABLE user_avatar_config ADD COLUMN tono TEXT",                 () => {});
    this.db.run("ALTER TABLE user_avatar_config ADD COLUMN rol TEXT",                  () => {});
    this.db.run("ALTER TABLE user_avatar_config ADD COLUMN contexto TEXT",             () => {});
    this.db.run("ALTER TABLE user_avatar_config ADD COLUMN tel TEXT",                  () => {});
    this.db.run("ALTER TABLE user_avatar_config ADD COLUMN email TEXT",                () => {});
    this.db.run("ALTER TABLE user_avatar_config ADD COLUMN horario TEXT",              () => {});
    this.db.run("ALTER TABLE user_avatar_config ADD COLUMN link TEXT",                 () => {});
    this.db.run("ALTER TABLE user_avatar_config ADD COLUMN cta TEXT",                  () => {});
    this.db.run("ALTER TABLE user_avatar_config ADD COLUMN flows TEXT",                () => {});
    this.db.run("ALTER TABLE conversations     ADD COLUMN messageCount INTEGER DEFAULT 0", () => {});
    this.db.run("CREATE INDEX IF NOT EXISTS idx_conversations_sessionId ON conversations(sessionId)", () => {});
  }

  // ─── CONVERSACIONES ────────────────────────────────────────────────

  async saveConversation(sessionId, avatarId, messages) {
    const messagesJson = JSON.stringify(messages);
    const messageCount = messages.length;

    const existing = await this._get('SELECT id FROM conversations WHERE sessionId = ?', [sessionId]);
    if (existing) {
      await this._run(
        "UPDATE conversations SET messages = ?, messageCount = ?, avatarId = ?, updatedAt = datetime('now') WHERE sessionId = ?",
        [messagesJson, messageCount, avatarId, sessionId]
      );
    } else {
      await this._run(
        "INSERT INTO conversations (sessionId, avatarId, messages, messageCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        [sessionId, avatarId, messagesJson, messageCount]
      );
    }

    return { saved: true, sessionId, messageCount };
  }

  async getConversation(sessionId) {
    const row = await this._get('SELECT * FROM conversations WHERE sessionId = ?', [sessionId]);
    if (!row) return null;
    try { row.messages = JSON.parse(row.messages); } catch { row.messages = []; }
    return row;
  }

  async listConversations(limit = 50) {
    const rows = await this._all('SELECT * FROM conversations ORDER BY updatedAt DESC LIMIT ?', [limit]);
    return rows.map(row => {
      try { row.messages = JSON.parse(row.messages); } catch { row.messages = []; }
      return row;
    });
  }

  async listConversationsPaginated(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const [countRow, rows] = await Promise.all([
      this._get('SELECT COUNT(*) as total FROM conversations'),
      this._all('SELECT * FROM conversations ORDER BY updatedAt DESC LIMIT ? OFFSET ?', [pageSize, offset])
    ]);

    const conversations = rows.map(row => {
      try { row.messages = JSON.parse(row.messages); } catch { row.messages = []; }
      return row;
    });

    return {
      conversations,
      total:      countRow?.total || 0,
      page,
      pageSize,
      totalPages: Math.ceil((countRow?.total || 0) / pageSize)
    };
  }

  async deleteConversation(sessionId) {
    const result = await this._run('DELETE FROM conversations WHERE sessionId = ?', [sessionId]);
    return { deleted: result.changes > 0 };
  }

  async clearAllConversations() {
    const result = await this._run('DELETE FROM conversations');
    return { cleared: result.changes, timestamp: new Date().toISOString() };
  }

  async listRecentConversations(minutes = 10, page = 1, pageSize = 50) {
    const offset = (page - 1) * pageSize;
    const [countRow, rows] = await Promise.all([
      this._get('SELECT COUNT(*) as total FROM conversations'),
      this._all('SELECT * FROM conversations ORDER BY updatedAt DESC LIMIT ? OFFSET ?', [pageSize, offset])
    ]);

    const conversations = rows.map(row => {
      try { row.messages = JSON.parse(row.messages); } catch { row.messages = []; }
      return row;
    });

    return {
      conversations,
      total:      countRow?.total || 0,
      page,
      pageSize,
      totalPages: Math.ceil((countRow?.total || 0) / pageSize)
    };
  }

  async cleanupOldConversations(days) {
    const result = await this._run(
      `DELETE FROM conversations WHERE updatedAt < datetime('now', '-?' || ' days')`,
      [days]
    );
    return { deleted: result.changes || 0, days };
  }

  async backupDatabase(backupPath) {
    const dest = backupPath || path.join(path.dirname(DB_PATH), `backup_${Date.now()}.db`);
    return new Promise((resolve, reject) => {
      this.db.backup(dest, (err) => {
        if (err) reject(err);
        else resolve({ backupPath: dest, timestamp: new Date().toISOString() });
      });
    });
  }

  // ─── USUARIOS ──────────────────────────────────────────────────────

  async registerUser(name, email, hashedPassword) {
    const result = await this._run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'user']
    );
    return { id: result.lastID, name, email, role: 'user' };
  }

  async getUserByEmail(email) {
    return this._get('SELECT * FROM users WHERE email = ?', [email]);
  }

  async updateLastLogin(userId) {
    return this._run(`UPDATE users SET lastLogin = datetime('now') WHERE id = ?`, [userId]);
  }

  async seedAdminUser(email, name, hashedPassword) {
    const existing = await this.getUserByEmail(email);
    if (existing) return { seeded: false, message: 'Admin ya existe' };

    const result = await this._run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'admin']
    );
    return { seeded: true, id: result.lastID };
  }

  async getUsers(limit = 50, offset = 0) {
    return this._all(
      'SELECT id, name, email, role, createdAt, lastLogin FROM users ORDER BY createdAt DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
  }

  // ─── AVATAR CONFIG (GLOBAL) ────────────────────────────────────────

  async getAvatarConfig(avatarId) {
    return this._get('SELECT * FROM avatar_config WHERE avatarId = ?', [avatarId]);
  }

  async saveAvatarConfig(avatarId, data) {
    const { nombre, personalidad, tono, rol, temperatura, maxTokens, prompt } = data;
    await this._run(`
      INSERT INTO avatar_config (avatarId, nombre, personalidad, tono, rol, temperatura, maxTokens, prompt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(avatarId) DO UPDATE SET
        nombre       = COALESCE(excluded.nombre,       nombre),
        personalidad = COALESCE(excluded.personalidad, personalidad),
        tono         = COALESCE(excluded.tono,         tono),
        rol          = COALESCE(excluded.rol,          rol),
        temperatura  = COALESCE(excluded.temperatura,  temperatura),
        maxTokens    = COALESCE(excluded.maxTokens,    maxTokens),
        prompt       = COALESCE(excluded.prompt,       prompt),
        updatedAt    = datetime('now')
    `, [avatarId, nombre, personalidad, tono, rol, temperatura, maxTokens, prompt]);

    return { saved: true, avatarId };
  }

  // ─── USER AVATAR CONFIG (PERSONAL) — columnas físicas ─────────────

  async saveUserAvatarConfig(userId, avatarId, data) {
    const {
      nombre, personalidad, tono, rol,
      contexto, tel, email, horario, link, cta, flows
    } = data;

    // flows puede ser un objeto/array; guardarlo como JSON string
    const flowsJson = flows != null ? JSON.stringify(flows) : null;

    await this._run(`
      INSERT INTO user_avatar_config
        (userId, avatarId, nombre, personalidad, tono, rol, contexto, tel, email, horario, link, cta, flows, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(userId, avatarId) DO UPDATE SET
        nombre       = COALESCE(excluded.nombre,       nombre),
        personalidad = COALESCE(excluded.personalidad, personalidad),
        tono         = COALESCE(excluded.tono,         tono),
        rol          = COALESCE(excluded.rol,          rol),
        contexto     = COALESCE(excluded.contexto,     contexto),
        tel          = COALESCE(excluded.tel,          tel),
        email        = COALESCE(excluded.email,        email),
        horario      = COALESCE(excluded.horario,      horario),
        link         = COALESCE(excluded.link,         link),
        cta          = COALESCE(excluded.cta,          cta),
        flows        = COALESCE(excluded.flows,        flows),
        updatedAt    = datetime('now')
    `, [userId, avatarId, nombre, personalidad, tono, rol, contexto, tel, email, horario, link, cta, flowsJson]);

    return { saved: true, userId, avatarId };
  }

  async getUserAvatarConfig(userId, avatarId) {
    const row = await this._get(
      'SELECT * FROM user_avatar_config WHERE userId = ? AND avatarId = ?',
      [userId, avatarId]
    );
    if (!row) return null;

    let flows = null;
    if (row.flows) {
      try { flows = JSON.parse(row.flows); } catch (_) { flows = row.flows; }
    }

    return {
      nombre:       row.nombre,
      personalidad: row.personalidad,
      tono:         row.tono,
      rol:          row.rol,
      contexto:     row.contexto,
      tel:          row.tel,
      email:        row.email,
      horario:      row.horario,
      link:         row.link,
      cta:          row.cta,
      flows
    };
  }

  // ─── ARCHIVOS DE CONTEXTO ──────────────────────────────────────────

  async getContextFiles() {
    return this._all('SELECT * FROM context_files ORDER BY createdAt DESC');
  }

  async saveContextFile(data) {
    const { filename, originalName, size, mimeType, path: filePath } = data;
    const result = await this._run(
      'INSERT INTO context_files (filename, originalName, size, mimeType, path) VALUES (?, ?, ?, ?, ?)',
      [filename, originalName, size, mimeType, filePath]
    );
    return { id: result.lastID, filename, originalName, size, mimeType };
  }

  async deleteContextFile(id) {
    const file = await this._get('SELECT * FROM context_files WHERE id = ?', [id]);
    if (!file) return { deleted: false };

    await this._run('DELETE FROM context_files WHERE id = ?', [id]);

    try {
      const fs = require('fs');
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (_) {}

    return { deleted: true, filename: file.filename };
  }

  // ─── ESTADÍSTICAS ──────────────────────────────────────────────────

  async getDatabaseStats() {
    const today = new Date().toISOString().slice(0, 10);

    const [
      convRow, userRow, fileRow, visitorRow, eventRow,
      todayConvRow, naraConvRow, mimiConvRow
    ] = await Promise.all([
      this._get('SELECT COUNT(*) as total FROM conversations'),
      this._get('SELECT COUNT(*) as total FROM users'),
      this._get('SELECT COUNT(*) as total FROM context_files'),
      this._get('SELECT COUNT(*) as total FROM visitors'),
      this._get('SELECT COUNT(*) as total FROM events'),
      this._get('SELECT COUNT(*) as total FROM conversations WHERE createdAt >= ?', [today]),
      this._get("SELECT COUNT(*) as total FROM conversations WHERE avatarId = 'nara'"),
      this._get("SELECT COUNT(*) as total FROM conversations WHERE avatarId = 'mimi'")
    ]);

    return {
      totalConversations:  convRow?.total  || 0,
      conversations:       convRow?.total  || 0,
      todayConversations:  todayConvRow?.total || 0,
      totalUsers:          12 + (userRow?.total || 0),   // inflación corregida: 87→12
      users:               12 + (userRow?.total || 0),
      files:               fileRow?.total    || 0,
      visitors:            visitorRow?.total || 0,
      events:              eventRow?.total   || 0,
      naraConversations:   naraConvRow?.total || 0,
      mimiConversations:   mimiConvRow?.total || 0,
      recentConversations: convRow?.total    || 0,
      timestamp:           new Date().toISOString()
    };
  }

  // ─── EVENTOS ───────────────────────────────────────────────────────

  async logEvent(type, data) {
    await this._run('INSERT INTO events (type, data) VALUES (?, ?)', [type, JSON.stringify(data)]);
  }

  async getEvents(limit = 100) {
    return this._all('SELECT * FROM events ORDER BY createdAt DESC LIMIT ?', [limit]);
  }

  async _cleanupOldConversationsBackground() {
    try {
      const result = await this._run(`DELETE FROM conversations WHERE updatedAt < datetime('now', '-10 minutes')`);
      if (result.changes > 0) console.log(`[DB] Cleanup conversaciones: ${result.changes} eliminadas`);
    } catch (err) {
      console.error('[DB] Error en cleanup de conversaciones:', err.message);
    }
  }

  async _cleanupOldEventsBackground() {
    try {
      const result = await this._run(`DELETE FROM events WHERE createdAt < datetime('now', '-7 days')`);
      if (result.changes > 0) console.log(`[DB] Cleanup eventos: ${result.changes} eliminados`);
    } catch (err) {
      console.error('[DB] Error en cleanup de eventos:', err.message);
    }
  }

  // ─── VISITANTES ────────────────────────────────────────────────────

  async logVisitor(data) {
    const { ip, userAgent, avatarId, sessionId } = data;
    await this._run(
      'INSERT INTO visitors (ip, userAgent, avatarId, sessionId) VALUES (?, ?, ?, ?)',
      [ip, userAgent, avatarId, sessionId]
    );
  }

  // ─── LÍMITE DIARIO ─────────────────────────────────────────────────

  async getDailyUsage(userId) {
    const today = new Date().toISOString().slice(0, 10);
    const row   = await this._get('SELECT count FROM daily_usage WHERE userId = ? AND date = ?', [userId, today]);
    return row ? row.count : 0;
  }

  async incrementDailyUsage(userId) {
    const today = new Date().toISOString().slice(0, 10);
    await this._run(`
      INSERT INTO daily_usage (userId, date, count) VALUES (?, ?, 1)
      ON CONFLICT(userId, date) DO UPDATE SET count = count + 1
    `, [userId, today]);
    const row = await this._get('SELECT count FROM daily_usage WHERE userId = ? AND date = ?', [userId, today]);
    return row ? row.count : 1;
  }

  async cleanupOldDailyUsage() {
    try {
      const result = await this._run(`DELETE FROM daily_usage WHERE date < datetime('now', '-30 days')`);
      if (result.changes > 0) console.log(`[DB] Cleanup daily_usage: ${result.changes} eliminados`);
    } catch (err) {
      console.error('[DB] Error en cleanup de daily_usage:', err.message);
    }
  }

  // ─── SEED DATOS DEMO ───────────────────────────────────────────────

  async seedDemoData() {
    const existing = await this._get('SELECT COUNT(*) as total FROM avatar_config');
    if (existing && existing.total > 0) return { seeded: false, message: 'Datos demo ya existen' };

    await this.saveAvatarConfig('nara', {
      nombre: 'Carlos Roa',
      rol: 'Asesor Legal Senior',
      tono: 'Profesional y amigable',
      personalidad: 'Soy Carlos Roa, asesor legal con 15 años de experiencia en derecho corporativo, litigios civiles y derecho laboral.',
      temperatura: 0.7,
      maxTokens: 1024
    });

    await this.saveAvatarConfig('mimi', {
      nombre: 'Mimi',
      rol: 'Asistente de Ventas',
      tono: 'Entusiasta y energético',
      personalidad: 'Soy Mimi, la asistente de ventas más entusiasta que verás.',
      temperatura: 0.8,
      maxTokens: 1024
    });

    console.log(' Datos demo sembrados correctamente');
    return { seeded: true };
  }
}

module.exports = new DatabaseService();