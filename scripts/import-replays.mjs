/**
 * Importa todos os .rofl de server/src/data/replays para a conta `leviathan`.
 * Útil para popular o banco (local ou Turso) de uma vez.
 *
 * Uso:
 *   Local:  node --env-file-if-exists=.env scripts/import-replays.mjs
 *   Turso:  TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/import-replays.mjs
 *
 * Obs.: sem RIOT_API_KEY o elo não é capturado (você pode usar "Atualizar elo"
 * em cada partida depois). Com a chave, cuidado com o rate limit (dev = 100/2min).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import '../server/src/app.js'; // roda initSchema + garante a conta leviathan
import { dbGet } from '../server/src/db.js';
import { importRoflFromBuffer } from '../server/src/services/rofl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '..', 'server', 'src', 'data', 'replays');

if (!existsSync(dir)) { console.log('Pasta de replays não encontrada:', dir); process.exit(0); }

const uid = (await dbGet('SELECT id FROM users WHERE username = ?', ['leviathan']))?.id;
if (!uid) { console.error('Conta leviathan não encontrada.'); process.exit(1); }

const files = readdirSync(dir).filter((f) => f.endsWith('.rofl'));
let ok = 0, dup = 0, err = 0;
for (const f of files) {
  const r = await importRoflFromBuffer(uid, readFileSync(join(dir, f)), {});
  if (r.ok) ok++;
  else if (String(r.reason || '').includes('já foi')) dup++;
  else { err++; console.log('ERRO', f, r.reason); }
}
console.log(`Importadas: ${ok} | duplicadas: ${dup} | erros: ${err} | arquivos: ${files.length}`);
process.exit(0);
