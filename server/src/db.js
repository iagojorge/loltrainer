import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Camada de banco assíncrona com dois backends:
 *  - Produção (Vercel): libSQL/Turso via HTTP (@libsql/client/web) — sem
 *    dependência nativa, funciona em serverless. Ativado quando
 *    TURSO_DATABASE_URL está definido.
 *  - Desenvolvimento local: node:sqlite (DatabaseSync) num arquivo local.
 *
 * Toda a aplicação usa a MESMA interface assíncrona (dbAll/dbGet/dbRun/dbExec/
 * dbTx) com placeholders posicionais `?`, compatível com os dois backends.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = join(__dirname, 'data', 'lol.db');

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const isTurso = !!TURSO_URL;

const num = (v) => (v == null ? 0 : Number(v));

let backend; // { all, get, run, exec, tx }

if (isTurso) {
  // ---- Backend Turso / libSQL (produção) ----
  const { createClient } = await import('@libsql/client/web');
  const client = createClient({ url: TURSO_URL, authToken: process.env.TURSO_AUTH_TOKEN });

  backend = {
    async all(sql, args = []) { return (await client.execute({ sql, args })).rows; },
    async get(sql, args = []) { return (await client.execute({ sql, args })).rows[0]; },
    async run(sql, args = []) {
      const r = await client.execute({ sql, args });
      return { lastInsertRowid: num(r.lastInsertRowid), changes: num(r.rowsAffected) };
    },
    async exec(sql) { await client.executeMultiple(sql); },
    async tx(fn) {
      const t = await client.transaction('write');
      const wrap = {
        all: async (sql, args = []) => (await t.execute({ sql, args })).rows,
        get: async (sql, args = []) => (await t.execute({ sql, args })).rows[0],
        run: async (sql, args = []) => {
          const r = await t.execute({ sql, args });
          return { lastInsertRowid: num(r.lastInsertRowid), changes: num(r.rowsAffected) };
        },
      };
      try { const out = await fn(wrap); await t.commit(); return out; }
      catch (e) { try { await t.rollback(); } catch { /* ignore */ } throw e; }
    },
  };
} else {
  // ---- Backend node:sqlite (desenvolvimento local) ----
  const { DatabaseSync } = await import('node:sqlite');
  const sdb = new DatabaseSync(DB_PATH);
  sdb.exec('PRAGMA journal_mode = WAL;');
  sdb.exec('PRAGMA foreign_keys = ON;');

  const cache = new Map();
  const prep = (sql) => { let s = cache.get(sql); if (!s) { s = sdb.prepare(sql); cache.set(sql, s); } return s; };
  const norm = (r) => ({ lastInsertRowid: num(r.lastInsertRowid), changes: num(r.changes) });

  const sync = {
    all: (sql, args = []) => prep(sql).all(...args),
    get: (sql, args = []) => prep(sql).get(...args),
    run: (sql, args = []) => norm(prep(sql).run(...args)),
  };

  backend = {
    async all(sql, args = []) { return sync.all(sql, args); },
    async get(sql, args = []) { return sync.get(sql, args); },
    async run(sql, args = []) { return sync.run(sql, args); },
    async exec(sql) { sdb.exec(sql); },
    async tx(fn) {
      sdb.exec('BEGIN');
      try {
        const wrap = {
          all: async (sql, args = []) => sync.all(sql, args),
          get: async (sql, args = []) => sync.get(sql, args),
          run: async (sql, args = []) => sync.run(sql, args),
        };
        const out = await fn(wrap);
        sdb.exec('COMMIT');
        return out;
      } catch (e) { try { sdb.exec('ROLLBACK'); } catch { /* ignore */ } throw e; }
    },
  };
}

export const dbAll = (sql, args) => backend.all(sql, args);
export const dbGet = (sql, args) => backend.get(sql, args);
export const dbRun = (sql, args) => backend.run(sql, args);
export const dbExec = (sql) => backend.exec(sql);
export const dbTx = (fn) => backend.tx(fn);

/**
 * Cria o schema (idempotente). Multi-tenant: quase toda tabela referencia
 * users(id); as queries dos services filtram por user_id.
 */
export async function initSchema() {
  await dbExec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      team_name     TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS matches (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      game_id       TEXT NOT NULL,
      date          TEXT NOT NULL,
      duration_s    INTEGER NOT NULL,
      result        TEXT NOT NULL,
      patch         TEXT NOT NULL,
      series_type   TEXT NOT NULL,
      series_label  TEXT,
      opponent      TEXT NOT NULL,
      our_side      TEXT NOT NULL,
      bans_our      TEXT NOT NULL DEFAULT '[]',
      bans_their    TEXT NOT NULL DEFAULT '[]',
      first_blood_side TEXT,
      dragons_our   INTEGER NOT NULL DEFAULT 0,
      dragons_their INTEGER NOT NULL DEFAULT 0,
      barons_our    INTEGER NOT NULL DEFAULT 0,
      barons_their  INTEGER NOT NULL DEFAULT 0,
      towers_our    INTEGER NOT NULL DEFAULT 0,
      towers_their  INTEGER NOT NULL DEFAULT 0,
      source        TEXT NOT NULL DEFAULT 'riot',
      game_version  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, game_id)
    );

    CREATE TABLE IF NOT EXISTS player_stats (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id       INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      side           TEXT NOT NULL,
      is_our_team    INTEGER NOT NULL DEFAULT 0,
      summoner_name  TEXT NOT NULL,
      champion       TEXT NOT NULL,
      role           TEXT NOT NULL,
      level          INTEGER NOT NULL,
      kills          INTEGER NOT NULL,
      deaths         INTEGER NOT NULL,
      assists        INTEGER NOT NULL,
      kill_participation REAL NOT NULL DEFAULT 0,
      cs             INTEGER NOT NULL,
      gold           INTEGER NOT NULL,
      damage_dealt   INTEGER NOT NULL,
      damage_physical INTEGER NOT NULL DEFAULT 0,
      damage_magic    INTEGER NOT NULL DEFAULT 0,
      damage_true     INTEGER NOT NULL DEFAULT 0,
      damage_taken   INTEGER NOT NULL,
      damage_mitigated INTEGER NOT NULL DEFAULT 0,
      healing        INTEGER NOT NULL DEFAULT 0,
      heals_teammates INTEGER NOT NULL DEFAULT 0,
      shielding      INTEGER NOT NULL DEFAULT 0,
      wards_placed   INTEGER NOT NULL DEFAULT 0,
      wards_destroyed INTEGER NOT NULL DEFAULT 0,
      vision_score   INTEGER NOT NULL DEFAULT 0,
      cc_score       INTEGER NOT NULL DEFAULT 0,
      items          TEXT NOT NULL DEFAULT '[]',
      final_items    TEXT NOT NULL DEFAULT '[]',
      boots          TEXT,
      runes          TEXT NOT NULL DEFAULT '{}',
      puuid          TEXT,
      riot_tag       TEXT,
      rank           TEXT
    );

    CREATE TABLE IF NOT EXISTS match_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id     INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      event_type   TEXT NOT NULL,
      timestamp_s  INTEGER NOT NULL,
      side         TEXT,
      details      TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS timeline_frames (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      minute      INTEGER NOT NULL,
      blue_gold   INTEGER NOT NULL,
      red_gold    INTEGER NOT NULL,
      blue_kills  INTEGER NOT NULL,
      red_kills   INTEGER NOT NULL,
      players     TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      tags        TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roster (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      name        TEXT NOT NULL,
      tag         TEXT,
      role        TEXT NOT NULL DEFAULT 'Top',
      puuid       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, name)
    );

    CREATE TABLE IF NOT EXISTS invite_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      token       TEXT NOT NULL UNIQUE,
      used        INTEGER NOT NULL DEFAULT 0,
      used_by     INTEGER,
      used_at     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rank_snapshots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      queue       TEXT NOT NULL DEFAULT 'RANKED_SOLO_5x5',
      tier        TEXT,
      division    TEXT,
      lp          INTEGER,
      ladder      INTEGER NOT NULL DEFAULT 0,
      wins        INTEGER NOT NULL DEFAULT 0,
      losses      INTEGER NOT NULL DEFAULT 0,
      taken_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_matches_user   ON matches(user_id);
    CREATE INDEX IF NOT EXISTS idx_ps_match       ON player_stats(match_id);
    CREATE INDEX IF NOT EXISTS idx_ev_match       ON match_events(match_id);
    CREATE INDEX IF NOT EXISTS idx_tf_match       ON timeline_frames(match_id);
    CREATE INDEX IF NOT EXISTS idx_notes_match    ON notes(match_id);
    CREATE INDEX IF NOT EXISTS idx_roster_user    ON roster(user_id);
    CREATE INDEX IF NOT EXISTS idx_snap_user      ON rank_snapshots(user_id, player_name);
  `);
}
