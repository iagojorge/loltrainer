/**
 * Ajustes pontuais no banco (rode com as variáveis do Turso apontadas):
 *  1. Renomeia o time da conta leviathan para "Leviathan".
 *  2. Corrige a DATA de cada partida .rofl usando o mtime do arquivo (restaura a
 *     ordem cronológica que a migração havia perdido).
 *  3. Cria 5 tokens de criação de time (uso único) e imprime.
 *
 * Uso:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/fix-turso.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import '../server/src/app.js'; // initSchema + garante leviathan
import { dbGet, dbRun } from '../server/src/db.js';
import { parseRofl } from '../server/src/services/rofl.js';
import { createInviteTokens, listInviteTokens } from '../server/src/services/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '..', 'server', 'src', 'data', 'replays');

const uid = (await dbGet('SELECT id FROM users WHERE username = ?', ['leviathan']))?.id;
if (!uid) { console.error('leviathan não encontrado'); process.exit(1); }

// 1) nome do time
await dbRun('UPDATE users SET team_name = ? WHERE id = ?', ['Leviathan', uid]);
console.log('✓ time renomeado para "Leviathan"');

// 2) datas pelo mtime dos .rofl (game_id = mesmo cálculo do import)
let fixed = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.rofl'))) {
  const path = join(dir, f);
  let parsed;
  try { parsed = parseRofl(readFileSync(path)); } catch { continue; }
  const gid = parsed.gameId || parsed.stats[0]?.GAME_ID;
  const game_id = `ROFL_${gid || createHash('sha1').update(JSON.stringify(parsed.stats)).digest('hex').slice(0, 16)}`;
  const mtime = statSync(path).mtime.toISOString();
  const r = await dbRun('UPDATE matches SET date = ? WHERE user_id = ? AND game_id = ?', [mtime, uid, game_id]);
  if (r.changes > 0) fixed++;
}
console.log(`✓ datas corrigidas (mtime): ${fixed} partidas`);

// 3) tokens de criação (só cria se ainda não houver nenhum)
const existing = await listInviteTokens();
if (existing.length === 0) {
  const tokens = await createInviteTokens(5);
  console.log('\n=== 5 TOKENS DE CRIAÇÃO DE TIME (uso único) ===');
  tokens.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
} else {
  console.log(`\nJá existem ${existing.length} tokens (não criei novos):`);
  existing.forEach((t) => console.log(`  ${t.token}  ${t.used ? '(usado)' : '(livre)'}`));
}
process.exit(0);
