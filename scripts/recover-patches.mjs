/**
 * Recupera os PATCHES (e datas exatas) das partidas a partir de um banco antigo
 * (lol.db pré-migração, recuperado do histórico de versões do OneDrive) e aplica
 * no Turso, casando por game_id.
 *
 * Uso:
 *   OLD_DB="C:/caminho/para/lol_antigo.db" \
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... \
 *   node scripts/recover-patches.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import '../server/src/app.js'; // inicializa o Turso (destino)
import { dbGet, dbRun } from '../server/src/db.js';

const OLD = process.env.OLD_DB;
if (!OLD || !existsSync(OLD)) { console.error('Defina OLD_DB com o caminho do lol.db antigo.'); process.exit(1); }

const uid = (await dbGet('SELECT id FROM users WHERE username = ?', ['leviathan']))?.id;
if (!uid) { console.error('leviathan não encontrado no destino.'); process.exit(1); }

const old = new DatabaseSync(OLD);
const rows = old.prepare('SELECT game_id, patch, date FROM matches').all();
console.log(`Lidas ${rows.length} partidas do banco antigo.`);

let patched = 0, dated = 0;
for (const r of rows) {
  if (r.patch && r.patch !== 'desconhecido' && r.patch !== 'unknown') {
    const u = await dbRun('UPDATE matches SET patch = ? WHERE user_id = ? AND game_id = ?', [r.patch, uid, r.game_id]);
    if (u.changes > 0) patched++;
  }
  if (r.date) {
    const u = await dbRun('UPDATE matches SET date = ? WHERE user_id = ? AND game_id = ?', [r.date, uid, r.game_id]);
    if (u.changes > 0) dated++;
  }
}
console.log(`✓ patches recuperados: ${patched} | datas exatas: ${dated}`);
process.exit(0);
