# 🎭 El Misterio de VID

> Asistente IA con avatares, voz, memoria y panel de administración completo.
> Producto estrella de **Luna Roja Digital**.

---

## ⚡ Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + Express |
| LLM | Groq (primario) → DeepSeek (fallback) |
| Voz | Google Cloud Text-to-Speech |
| DB | SQLite3 (WAL) |
| Auth | JWT (jsonwebtoken) |
| Frontend | HTML + CSS + JS vanilla |
| Tests | Jest + Supertest |

---

## 🚀 Inicio rápido

```bash
npm install
npm run dev     # Desarrollo con nodemon
npm start       # Producción
```

**Variables de entorno requeridas** (`.env`):
`GROQ_API_KEY`, `GROQ_MODEL_FAST`, `PORT`, `ADMIN_SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`

---

## 🧠 ¿Qué hace?

Un asistente IA que:
- **Chatea** con visitantes en tu web (streaming en tiempo real)
- **Habla** con voz realista (Google TTS)
- **Recuerda** conversaciones (SQLite)
- **Se personaliza** desde un panel admin profesional
- **Predice** reacciones del usuario con flujos predictivos
- **Se modera** solo con reglas fijas (no editables desde el panel)

### Para el visitante

Llega a tu web y ve un avatar animado que le habla. Escribe y el asistente responde con texto + voz. Guía al usuario según los flujos que configures.

### Para el admin

`/admin` — panel completo para configurar cada aspecto del asistente: identidad, personalidad, tono, contexto de negocio, flujos predictivos, datos de contacto. Vista previa en vivo mientras escribes.

### Para el usuario registrado

Puede personalizar SU propio asistente (su propia capa sobre la config global). Límite: 10 guardados por día.

---

## 📁 Estructura del proyecto

```
config/moderacion.md          → Reglas fijas de moderación (inaccesibles desde panel)
public/
├── index.html                → Chat con IA + voz (diseño dual)
├── admin.html                → Panel admin SPA (1576 líneas, todo inline)
└── js/                       → Frontend JS
server/
├── index.js                  → Entry point
├── config/index.js           → Config centralizada
├── middleware/                → roles, rateLimit, security, validation
├── routes/                   → chat, tts, conversations, memory, auth, admin
├── services/                 → database, groqService, deepseekService, aiRouter,
│                                memoryService, ttsService, telegramService
└── utils/streamHelper.js     → Helpers SSE
```

---

## 🔐 Modelo de permisos

| Rol | Puede |
|-----|-------|
| Visitante | Chatear + leer configs |
| Usuario | Chatear + personalizar su avatar |
| Admin | Todo + config global + sistema |

Jerarquía de personalidad en cada chat:
1. Config personal del usuario (user_avatar_config)
2. Config global del admin (avatar_config)
3. Defaults del sistema (memoryService)
4. **+ moderacion.md** (siempre, inamovible)

---

## 📡 API (resumen)

| Grupo | Endpoints clave |
|-------|----------------|
| `/api/chat` | POST / — chat con streaming SSE |
| `/api/tts` | POST / — sintetizar voz |
| `/api/conversations` | CRUD de conversaciones |
| `/api/memory` | Gestión de memoria y KB |
| `/api/auth` | Register, login, verify, users |
| `/api/admin` | Config de avatares, stats, sistema, archivos |

Documentación completa de rutas en `doc/ROUTES.md`

---

## 🗄️ Base de datos (SQLite)

8 tablas: `conversations`, `users`, `avatar_config`, `user_avatar_config`, `context_files`, `visitors`, `events`, `daily_usage`

Migraciones automáticas al iniciar. WAL mode para concurrencia.

---

## 🧪 Tests

```bash
npm test
```

Actualmente 13 tests pasan, 7 fallan (tests preexistentes desactualizados, no afectan producción).

---

## 📚 Documentación detallada

| Archivo | Contenido |
|---------|-----------|
| `doc/ARCHITECTURE.md` | Arquitectura general y flujos |
| `doc/SERVER.md` | Entry point del servidor |
| `doc/ROUTES.md` | Todas las rutas de la API |
| `doc/SERVICES.md` | Servicios (DB, LLM, TTS, memoria, etc.) |
| `doc/MIDDLEWARE.md` | Middleware (auth, rate limiting, seguridad) |
| `doc/DATABASE.md` | Esquema SQLite y migraciones |
| `doc/FRONTEND.md` | Frontend (index.html, admin.html, scripts) |
| `doc/ADMIN_PANEL.md` | Panel admin y personalización de avatar |
| `doc/IMPROVEMENTS.md` | Errores detectados y mejoras propuestas |

---

## 👤 Créditos

| Rol | Persona |
|-----|---------|
| Idea original, full-stack, IA | **Guervency Guerrier** |
| Diseño de interfaz UI/UX | **Luneca** |
| Marca | **Luna Roja Digital** |

---

*"La demo en vivo es la mejor prueba social."*
