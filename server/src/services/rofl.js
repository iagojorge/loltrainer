import { createHash } from 'node:crypto';
import { dbGet } from '../db.js';
import { loadDDragonMeta } from './ddragon.js';
import { insertAll } from './riot.js';
import { listRoster, detectOurTeamId } from './roster.js';
import { patchFromGameVersion } from './patch.js';
import { ROLES } from '../data/champions.js';

/**
 * Importação de replays .ROFL (scrims/customs que não aparecem no match-v5).
 * O .rofl traz metadados JSON com `statsJson` (stats de fim de jogo dos 10
 * jogadores). Processamos o buffer em memória e NÃO guardamos o arquivo
 * (compatível com serverless/Vercel). Limitação: .rofl não tem timeline.
 */

const ROLE_MAP = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support' };
const colorOf = (teamId) => (teamId === 100 ? 'blue' : 'red');
const norm = (s) => String(s || '').trim().toLowerCase();

// ---------- localização robusta do bloco de metadados JSON ----------
function parseMetadataObject(buffer, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < buffer.length; i++) {
    const c = buffer[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === 0x5c) esc = true;
      else if (c === 0x22) inStr = false;
    } else if (c === 0x22) inStr = true;
    else if (c === 0x7b) depth++;
    else if (c === 0x7d) {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(buffer.toString('utf8', start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function extractMetadata(buffer) {
  if (buffer.length >= 288) {
    try {
      const off = buffer.readUInt32LE(268);
      const len = buffer.readUInt32LE(272);
      if (off > 0 && len > 0 && off + len <= buffer.length) {
        const j = JSON.parse(buffer.toString('utf8', off, off + len));
        if (j && j.statsJson) return j;
      }
    } catch { /* cai na varredura */ }
  }
  const hay = buffer.toString('latin1');
  let start = hay.indexOf('{"gameLength"');
  if (start < 0) {
    const sj = hay.indexOf('"statsJson"');
    if (sj >= 0) start = hay.lastIndexOf('{', sj);
  }
  if (start < 0) return null;
  return parseMetadataObject(buffer, start);
}

function extractGameDate(metadata) {
  for (const campo of ['gameCreation', 'creationTime', 'gameStartTime', 'date']) {
    const v = metadata?.[campo];
    if (v == null || v === '') continue;
    const ts = Number(v);
    if (Number.isFinite(ts) && ts > 0) {
      const d = new Date(ts > 1e12 ? ts : ts * 1000);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

function normalizeDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ---------- parser do formato .rofl ----------
export function parseRofl(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 64) throw new Error('Arquivo .rofl inválido ou vazio.');
  const metadata = extractMetadata(buffer);
  if (!metadata) throw new Error('Não foi possível localizar os metadados no .rofl (formato não reconhecido).');
  let stats;
  try { stats = JSON.parse(metadata.statsJson || '[]'); }
  catch { throw new Error('statsJson do .rofl ilegível.'); }
  if (!Array.isArray(stats) || stats.length === 0) throw new Error('.rofl sem estatísticas de jogadores.');
  return {
    gameLength: Number(metadata.gameLength) || 0,
    gameVersion: metadata.gameVersion || null,
    gameId: metadata.gameId,
    gameDate: extractGameDate(metadata),
    stats,
  };
}

export function buildPreview(parsed) {
  const player = (p) => ({
    name: p.RIOT_ID_GAME_NAME || p.NAME || '—',
    champion: p.SKIN,
    side: colorOf(Number(p.TEAM) === 200 ? 200 : 100),
    win: p.WIN === 'Win',
    kda: `${Number(p.CHAMPIONS_KILLED) || 0}/${Number(p.NUM_DEATHS) || 0}/${Number(p.ASSISTS) || 0}`,
  });
  const players = parsed.stats.map(player);
  return {
    durationS: Math.round(parsed.gameLength / 1000),
    patch: parsed.gameVersion ? patchFromGameVersion(parsed.gameVersion) : 'desconhecido',
    gameVersion: parsed.gameVersion,
    date: (parsed.gameDate || new Date().toISOString()).slice(0, 10),
    blue: players.filter((p) => p.side === 'blue'),
    red: players.filter((p) => p.side === 'red'),
  };
}

// ---------- transformação .rofl → schema ----------
function buildRunes(p, meta) {
  const num = (k) => Number(p[k]) || 0;
  const rune = (slot) => {
    const id = num(`PERK${slot}`);
    return { id, name: meta.runeName(id), icon: meta.runeIcon(id), vars: [num(`PERK${slot}_VAR1`), num(`PERK${slot}_VAR2`), num(`PERK${slot}_VAR3`)] };
  };
  const primaryStyle = num('PERK_PRIMARY_STYLE');
  const subStyle = num('PERK_SUB_STYLE');
  return {
    primary: primaryStyle ? {
      tree: meta.styleName(primaryStyle), treeIcon: meta.styleIcon(primaryStyle),
      keystone: rune(0), runes: [1, 2, 3].map(rune).filter((r) => r.id && r.name),
    } : null,
    secondary: subStyle ? {
      tree: meta.styleName(subStyle), treeIcon: meta.styleIcon(subStyle),
      runes: [4, 5].map(rune).filter((r) => r.id && r.name),
    } : null,
    shards: [num('STAT_PERK_0'), num('STAT_PERK_1'), num('STAT_PERK_2')].map((s) => meta.statShardName(s)).filter(Boolean),
  };
}

function buildItems(p, meta) {
  const items = [];
  let boots = null;
  for (let i = 0; i < 7; i++) {
    const id = Number(p[`ITEM${i}`]) || 0;
    if (!id) continue;
    const name = meta.itemName(id);
    if (!name || meta.itemIsConsumable(id)) continue;
    items.push({ id, name });
    if (meta.itemIsBoots(id)) boots = name;
  }
  return { items, boots };
}

// Elo Solo/Duo dos 10 jogadores → Map(gameName.toLowerCase() → {puuid,rank}).
// O PUUID do .rofl é interno (UUID) e não serve para a API; resolvemos pelo Riot ID.
async function fetchRoflRanks(stats, platform) {
  const map = new Map();
  const { getRiotKey } = await import('./riotKey.js');
  if (!getRiotKey()) return map;
  const { rankAndPuuidByRiotId } = await import('./rank.js');
  await Promise.all((stats || []).map(async (p) => {
    const name = norm(p.RIOT_ID_GAME_NAME || p.NAME);
    if (!name || !p.RIOT_ID_GAME_NAME || !p.RIOT_ID_TAG_LINE) return;
    map.set(name, await rankAndPuuidByRiotId(p.RIOT_ID_GAME_NAME, p.RIOT_ID_TAG_LINE, platform));
  }));
  return map;
}

/**
 * Processa e importa um .rofl a partir do buffer (sem guardar o arquivo).
 * @param {number} userId
 * @param {Buffer} buffer conteúdo do .rofl
 * @param {object} opts { ourSide?, opponent?, series_type?, series_label?, date?, platform? }
 */
export async function importRoflFromBuffer(userId, buffer, opts = {}) {
  let parsed;
  try { parsed = parseRofl(buffer); }
  catch (err) { return { ok: false, reason: String(err?.message || err) }; }

  const gid = parsed.gameId || parsed.stats[0]?.GAME_ID;
  const game_id = `ROFL_${gid || createHash('sha1').update(JSON.stringify(parsed.stats)).digest('hex').slice(0, 16)}`;
  const existing = await dbGet('SELECT id FROM matches WHERE user_id = ? AND game_id = ?', [Number(userId), game_id]);
  if (existing) return { ok: false, reason: 'Esse replay já foi importado.', id: existing.id };

  const [meta, roster, ranksByName] = await Promise.all([
    loadDDragonMeta(),
    listRoster(userId),
    fetchRoflRanks(parsed.stats, opts.platform),
  ]);
  const canonMap = new Map(roster.map((p) => [norm(p.name), p.name]));
  const canonical = (g) => canonMap.get(norm(g)) || g;

  // Lado do nosso time: explícito > detectado pelo roster > azul.
  let ourSide = opts.ourSide;
  if (!ourSide) {
    const parts = parsed.stats.map((p) => ({ gameName: p.RIOT_ID_GAME_NAME || p.NAME, teamId: Number(p.TEAM) === 200 ? 200 : 100 }));
    const tid = await detectOurTeamId(userId, parts);
    if (tid) ourSide = colorOf(tid);
  }
  const ourTeamId = ourSide === 'red' ? 200 : 100;
  const our_side = colorOf(ourTeamId);

  const teamKills = { 100: 0, 200: 0 };
  for (const p of parsed.stats) teamKills[Number(p.TEAM) === 200 ? 200 : 100] += Number(p.CHAMPIONS_KILLED) || 0;
  const idxInTeam = { 100: 0, 200: 0 };

  const statRows = parsed.stats.map((p) => {
    const num = (k) => Number(p[k]) || 0;
    const teamId = num('TEAM') === 200 ? 200 : 100;
    const i = idxInTeam[teamId]++;
    const role = ROLE_MAP[p.TEAM_POSITION] || ROLE_MAP[p.INDIVIDUAL_POSITION] || ROLES[i] || 'Unknown';
    const tk = teamKills[teamId];
    const { items, boots } = buildItems(p, meta);
    const k = num('CHAMPIONS_KILLED'), a = num('ASSISTS');
    const rk = ranksByName.get(norm(p.RIOT_ID_GAME_NAME || p.NAME));
    return {
      side: colorOf(teamId),
      is_our_team: teamId === ourTeamId ? 1 : 0,
      summoner_name: canonical(p.RIOT_ID_GAME_NAME || p.NAME || `Player${i + 1}`),
      champion: meta.championNameById(p.SKIN),
      role,
      level: num('LEVEL'),
      kills: k, deaths: num('NUM_DEATHS'), assists: a,
      kill_participation: tk > 0 ? Number(((k + a) / tk).toFixed(3)) : 0,
      cs: num('MINIONS_KILLED') + num('NEUTRAL_MINIONS_KILLED'),
      gold: num('GOLD_EARNED'),
      damage_dealt: num('TOTAL_DAMAGE_DEALT_TO_CHAMPIONS'),
      damage_physical: num('PHYSICAL_DAMAGE_DEALT_TO_CHAMPIONS'),
      damage_magic: num('MAGIC_DAMAGE_DEALT_TO_CHAMPIONS'),
      damage_true: num('TRUE_DAMAGE_DEALT_TO_CHAMPIONS'),
      damage_taken: num('TOTAL_DAMAGE_TAKEN'),
      damage_mitigated: num('TOTAL_DAMAGE_SELF_MITIGATED'),
      healing: num('TOTAL_HEAL'),
      heals_teammates: num('TOTAL_HEAL_ON_TEAMMATES'),
      shielding: num('TOTAL_DAMAGE_SHIELDED_ON_TEAMMATES'),
      puuid: rk?.puuid || null,
      riot_tag: p.RIOT_ID_TAG_LINE || null,
      rank: rk?.rank ? JSON.stringify(rk.rank) : null,
      wards_placed: num('WARD_PLACED'),
      wards_destroyed: num('WARD_KILLED'),
      vision_score: num('VISION_SCORE'),
      cc_score: num('TIME_CCING_OTHERS'),
      items: JSON.stringify(items),
      final_items: JSON.stringify(items),
      boots,
      runes: JSON.stringify(buildRunes(p, meta)),
    };
  });

  const sumTeam = (teamId, field) => parsed.stats
    .filter((p) => (Number(p.TEAM) === 200 ? 200 : 100) === teamId)
    .reduce((s, p) => s + (Number(p[field]) || 0), 0);
  const enemyTeamId = ourTeamId === 100 ? 200 : 100;
  const fbPlayer = parsed.stats.find((p) => Number(p.FIRST_BLOOD) === 1 || Number(p.FIRST_BLOOD_KILL) === 1);
  const ourWin = parsed.stats.find((p) => (Number(p.TEAM) === 200 ? 200 : 100) === ourTeamId)?.WIN === 'Win';
  const gameDate = normalizeDate(opts.date) || parsed.gameDate || new Date().toISOString();

  const matchRow = {
    game_id, date: gameDate,
    duration_s: Math.round(parsed.gameLength / 1000),
    result: ourWin ? 'win' : 'loss',
    patch: parsed.gameVersion ? patchFromGameVersion(parsed.gameVersion) : 'desconhecido',
    game_version: parsed.gameVersion,
    series_type: opts.series_type || 'Scrim',
    series_label: opts.series_label || null,
    opponent: opts.opponent?.trim() || 'Scrim (.rofl)',
    our_side,
    bans_our: '[]', bans_their: '[]',
    first_blood_side: fbPlayer ? colorOf(Number(fbPlayer.TEAM) === 200 ? 200 : 100) : our_side,
    dragons_our: sumTeam(ourTeamId, 'DRAGON_KILLS'), dragons_their: sumTeam(enemyTeamId, 'DRAGON_KILLS'),
    barons_our: sumTeam(ourTeamId, 'BARON_KILLS'), barons_their: sumTeam(enemyTeamId, 'BARON_KILLS'),
    towers_our: sumTeam(ourTeamId, 'TURRETS_KILLED'), towers_their: sumTeam(enemyTeamId, 'TURRETS_KILLED'),
    source: 'rofl',
  };

  try {
    const id = await insertAll(userId, matchRow, statRows, [], []);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, reason: String(err?.message || err) };
  }
}
