import { dbAll, dbGet, dbRun } from '../db.js';
import { ROLES, TEAM_ROSTER } from '../data/roster.js';

// Roster do time — SEMPRE isolado por usuário (user_id).
export function listRoster(userId) {
  return dbAll('SELECT id, name, tag, role, puuid FROM roster WHERE user_id = ? ORDER BY id ASC', [Number(userId)]);
}

// Semeia um roster fixo (usado só para a conta leviathan no boot).
export async function seedFixedRoster(userId) {
  const n = await dbGet('SELECT COUNT(*) c FROM roster WHERE user_id = ?', [Number(userId)]);
  if (n?.c > 0) return;
  for (const p of TEAM_ROSTER) {
    await dbRun('INSERT INTO roster (user_id, name, tag, role) VALUES (?, ?, ?, ?)', [Number(userId), p.gameName, p.tag, p.role]);
  }
}

export async function addRosterPlayer(userId, { name, role, tag }) {
  let n = String(name || '').trim();
  let t = String(tag || '').trim();
  // Aceita "Nome#TAG" no campo nome.
  if (!t && n.includes('#')) { const [g, tg] = n.split('#'); n = g.trim(); t = (tg || '').trim(); }
  if (!n) return { ok: false, reason: 'Informe o nome do jogador.' };
  const r = ROLES.includes(role) ? role : 'Top';
  const exists = await dbGet('SELECT id FROM roster WHERE user_id = ? AND lower(name) = lower(?)', [Number(userId), n]);
  if (exists) return { ok: false, reason: 'Esse jogador já está no roster.' };
  const { lastInsertRowid } = await dbRun(
    'INSERT INTO roster (user_id, name, tag, role) VALUES (?, ?, ?, ?)',
    [Number(userId), n, t || null, r]
  );
  return { ok: true, player: { id: lastInsertRowid, name: n, tag: t || null, role: r } };
}

export async function removeRosterPlayer(userId, id) {
  const { changes } = await dbRun('DELETE FROM roster WHERE user_id = ? AND id = ?', [Number(userId), Number(id)]);
  return { ok: changes > 0 };
}

export async function setPlayerPuuid(userId, id, puuid) {
  await dbRun('UPDATE roster SET puuid = ? WHERE user_id = ? AND id = ?', [puuid, Number(userId), Number(id)]);
}

// ---------- casamento participante ↔ roster ----------
const norm = (s) => String(s || '').trim().toLowerCase();

async function rosterMap(userId) {
  const m = new Map();
  for (const p of await listRoster(userId)) m.set(norm(p.name), p.name);
  return m;
}

export async function canonicalRosterName(userId, gameName) {
  return (await rosterMap(userId)).get(norm(gameName)) || null;
}

export async function detectOurTeamId(userId, participants) {
  const map = await rosterMap(userId);
  const counts = {};
  for (const p of participants) {
    if (map.has(norm(p.gameName))) counts[p.teamId] = (counts[p.teamId] || 0) + 1;
  }
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return Number(entries[0][0]);
}

// Map nome(lower) → tag, para reresolver PUUID no "Atualizar elo".
export async function rosterTagMap(userId) {
  const m = new Map();
  for (const p of await listRoster(userId)) m.set(norm(p.name), p.tag);
  return m;
}
