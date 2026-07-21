/**
 * Recupera os campos digitados à mão (adversário, patch, tipo, rótulo, data) de
 * um banco antigo (lol.db pré-migração, recuperado da Lixeira/Histórico do
 * OneDrive) e aplica no Turso, casando por game_id.
 *
 * Uso:
 *   OLD_DB="C:/caminho/para/lol_antigo.db" \
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... \
 *   node scripts/recover-matches.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import '../server/src/app.js';
import { dbGet, dbRun } from '../server/src/db.js';

const OLD = process.env.OLD_DB;
if (!OLD || !existsSync(OLD)) { console.error('Defina OLD_DB com o caminho do lol.db antigo.'); process.exit(1); }

const uid = (await dbGet('SELECT id FROM users WHERE username = ?', ['leviathan']))?.id;
if (!uid) { console.error('leviathan não encontrado no destino.'); process.exit(1); }

const old = new DatabaseSync(OLD);
const rows = old.prepare('SELECT game_id, opponent, patch, series_type, series_label, date FROM matches').all();
console.log(`Lidas ${rows.length} partidas do banco antigo.`);

const bad = (v) => !v || v === 'desconhecido' || v === 'unknown' || v === 'Adversário' || v === 'Scrim (.rofl)';
let n = 0;
for (const r of rows) {
  const sets = [], args = [];
  if (!bad(r.opponent)) { sets.push('opponent = ?'); args.push(r.opponent); }
  if (!bad(r.patch)) { sets.push('patch = ?'); args.push(r.patch); }
  if (r.series_type) { sets.push('series_type = ?'); args.push(r.series_type); }
  sets.push('series_label = ?'); args.push(r.series_label || null);
  if (r.date) { sets.push('date = ?'); args.push(r.date); }
  if (!sets.length) continue;
  args.push(uid, r.game_id);
  const u = await dbRun(`UPDATE matches SET ${sets.join(', ')} WHERE user_id = ? AND game_id = ?`, args);
  if (u.changes > 0) n++;
}
console.log(`✓ ${n} partidas atualizadas (adversário/patch/tipo/rótulo/data).`);
process.exit(0);
