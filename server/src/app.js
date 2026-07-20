import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { initSchema, dbGet, dbRun } from './db.js';
import { hashPassword } from './services/auth.js';
import { seedFixedRoster } from './services/roster.js';
import { authRequired } from './middleware/authRequired.js';
import { riotKeyContext } from './services/riotKey.js';
import authRouter from './routes/auth.js';
import matchesRouter from './routes/matches.js';
import championsRouter from './routes/champions.js';
import playersRouter from './routes/players.js';
import dashboardRouter from './routes/dashboard.js';
import notesRouter from './routes/notes.js';
import riotRouter from './routes/riot.js';
import rosterRouter from './routes/roster.js';
import soloqRouter from './routes/soloq.js';
import replaysRouter from './routes/replays.js';
import { loadDDragonMeta, listPatches } from './services/ddragon.js';
import { DDRAGON_VERSION, setIconVersion } from './data/champions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- Inicialização (roda uma vez no cold start) ----
await initSchema();
await ensureLeviathan();
loadDDragonMeta().then((m) => setIconVersion(m.version)).catch(() => {});

// Garante a conta principal (leviathan / Tenebra Leviathan) e seu roster fixo.
async function ensureLeviathan() {
  const existing = await dbGet('SELECT id FROM users WHERE lower(username) = lower(?)', ['leviathan']);
  let id = existing?.id;
  if (!id) {
    const r = await dbRun('INSERT INTO users (username, password_hash, team_name) VALUES (?, ?, ?)',
      ['leviathan', hashPassword('lev@2026'), 'Leviathan']);
    id = r.lastInsertRowid;
  }
  await seedFixedRoster(id);
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(riotKeyContext); // captura X-Riot-Api-Key (chave por requisição)
// express.json em tudo, EXCETO os endpoints de .rofl (corpo binário cru).
app.use((req, res, next) => {
  if (req.path.startsWith('/api/matches/rofl/')) return next();
  express.json({ limit: '5mb' })(req, res, next);
});

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.get('/api/meta', async (req, res) => {
  try {
    const meta = await loadDDragonMeta();
    res.json({ ddragonVersion: meta.version, patches: await listPatches() });
  } catch {
    res.json({ ddragonVersion: DDRAGON_VERSION, patches: [] });
  }
});

// Rotas públicas de autenticação.
app.use('/api/auth', authRouter);

// A partir daqui, tudo exige login (injeta req.userId).
app.use('/api/matches', authRequired, replaysRouter); // /rofl/preview, /rofl/confirm
app.use('/api/matches', authRequired, matchesRouter);
app.use('/api/matches', authRequired, notesRouter);
app.use('/api/champions', authRequired, championsRouter);
app.use('/api/players', authRequired, playersRouter);
app.use('/api/dashboard', authRequired, dashboardRouter);
app.use('/api/riot', authRequired, riotRouter);
app.use('/api/roster', authRequired, rosterRouter);
app.use('/api/soloq', authRequired, soloqRouter);

// Em produção local (npm start), serve o build do client. No Vercel o estático é
// servido pela plataforma (ver vercel.json).
const clientDist = join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno', detail: String(err?.message || err) });
});

export default app;
