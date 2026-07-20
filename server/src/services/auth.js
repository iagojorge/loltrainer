import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { dbGet, dbRun, dbAll, dbTx } from '../db.js';

/**
 * Autenticação multi-tenant. Cada usuário = um time (com team_name). Senhas com
 * scrypt (node:crypto, sem dependência nativa) e sessão via JWT em cookie httpOnly.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-troque-em-producao';
const TOKEN_TTL = '30d';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = scryptSync(String(password), salt, 64);
  const ref = Buffer.from(hash, 'hex');
  return test.length === ref.length && timingSafeEqual(test, ref);
}

export function signToken(user) {
  return jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

const publicUser = (u) => ({ id: u.id, username: u.username, teamName: u.team_name });

export async function registerUser({ username, password, teamName, inviteToken }) {
  const u = String(username || '').trim();
  const t = String(teamName || '').trim();
  const invite = String(inviteToken || '').trim();
  if (!invite) return { ok: false, reason: 'Informe o token de criação.' };
  if (u.length < 3) return { ok: false, reason: 'Usuário deve ter ao menos 3 caracteres.' };
  if (String(password || '').length < 4) return { ok: false, reason: 'Senha deve ter ao menos 4 caracteres.' };
  if (!t) return { ok: false, reason: 'Informe o nome do time.' };

  const exists = await dbGet('SELECT id FROM users WHERE lower(username) = lower(?)', [u]);
  if (exists) return { ok: false, reason: 'Esse usuário já existe.' };

  // Valida e consome o token de convite numa transação (uso único).
  try {
    const user = await dbTx(async (tx) => {
      const row = await tx.get('SELECT id, used FROM invite_tokens WHERE token = ?', [invite]);
      if (!row) throw new Error('Token de criação inválido.');
      if (row.used) throw new Error('Esse token já foi usado.');
      const ins = await tx.run('INSERT INTO users (username, password_hash, team_name) VALUES (?, ?, ?)',
        [u, hashPassword(password), t]);
      const uid = Number(ins.lastInsertRowid);
      await tx.run("UPDATE invite_tokens SET used = 1, used_by = ?, used_at = datetime('now') WHERE id = ?", [uid, row.id]);
      return { id: uid, username: u, team_name: t };
    });
    return { ok: true, user: publicUser(user), token: signToken(user) };
  } catch (err) {
    return { ok: false, reason: String(err?.message || err) };
  }
}

// ---------- tokens de criação de time (uso único) ----------
export async function createInviteTokens(n = 5) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const token = `TENEBRA-${randomBytes(5).toString('hex').toUpperCase()}`;
    try { await dbRun('INSERT INTO invite_tokens (token) VALUES (?)', [token]); out.push(token); }
    catch { i--; /* colisão rara → tenta de novo */ }
  }
  return out;
}

export async function listInviteTokens() {
  return dbAll('SELECT token, used, used_by, used_at FROM invite_tokens ORDER BY id ASC', []);
}

export async function loginUser({ username, password }) {
  const row = await dbGet('SELECT * FROM users WHERE lower(username) = lower(?)', [String(username || '').trim()]);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return { ok: false, reason: 'Usuário ou senha inválidos.' };
  }
  return { ok: true, user: publicUser(row), token: signToken(row) };
}

export async function getUserById(id) {
  const row = await dbGet('SELECT id, username, team_name FROM users WHERE id = ?', [Number(id)]);
  return row ? publicUser(row) : null;
}

// Atualiza o nome do time exibido.
export async function updateTeamName(userId, teamName) {
  const t = String(teamName || '').trim();
  if (!t) return { ok: false, reason: 'Informe o nome do time.' };
  await dbRun('UPDATE users SET team_name = ? WHERE id = ?', [t, Number(userId)]);
  return { ok: true, teamName: t };
}
