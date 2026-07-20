import { listRoster, setPlayerPuuid } from './roster.js';
import { resolveRiotId, fetchMatchIds, fetchMatchById } from './riot.js';
import { rankByPuuid, ladderScore, formatRank } from './rank.js';
import { recordSnapshot, getSnapshots } from './snapshots.js';
import { getRiotKey } from './riotKey.js';
import { loadDDragonMeta } from './ddragon.js';
import { championIcon } from '../data/champions.js';
import { TEAM_PLATFORM } from '../data/roster.js';

/**
 * SoloQ dos jogadores do time: para cada jogador do roster resolve o PUUID
 * (cache na tabela roster), busca as partidas ranqueadas de Solo/Duo (queue 420)
 * via match-v5 e agrega campeões mais jogados, win rate e histórico.
 *
 * Requer RIOT_API_KEY válida no .env (chave de dev expira a cada 24h).
 */

const SOLO_QUEUE = 420; // Ranqueada Solo/Duo
const ROLE_MAP = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support' };

const kda = (k, d, a) => Number(((k + a) / Math.max(1, d)).toFixed(2));
const pct = (part, total) => (total ? Number(((part / total) * 100).toFixed(1)) : 0);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const r1 = (n) => Number(n.toFixed(1));

// Cache simples em memória (TTL) para não estourar o rate limit da chave de dev.
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map(); // key `${name}:${count}` → { at, data }

async function puuidFor(userId, player) {
  if (player.puuid) return player.puuid;
  const acc = await resolveRiotId(player.name, player.tag || TEAM_PLATFORM, TEAM_PLATFORM);
  if (acc?.puuid) {
    await setPlayerPuuid(userId, player.id, acc.puuid);
    return acc.puuid;
  }
  return null;
}

function summarizeGame(matchJson, puuid, meta) {
  const info = matchJson?.info || {};
  const me = (info.participants || []).find((p) => p.puuid === puuid);
  if (!me) return null;
  const durationS = info.gameEndTimestamp ? info.gameDuration : Math.round((info.gameDuration || 0) / 1000);
  const champion = meta.championNameById(me.championName);
  const cs = (me.totalMinionsKilled || 0) + (me.neutralMinionsKilled || 0);
  return {
    matchId: matchJson?.metadata?.matchId,
    date: new Date(info.gameStartTimestamp || info.gameCreation || 0).toISOString(),
    durationS,
    champion,
    icon: championIcon(champion),
    role: ROLE_MAP[me.teamPosition] || ROLE_MAP[me.individualPosition] || me.teamPosition || '—',
    win: !!me.win,
    kills: me.kills || 0, deaths: me.deaths || 0, assists: me.assists || 0,
    kda: kda(me.kills || 0, me.deaths || 0, me.assists || 0),
    cs,
    csPerMin: durationS ? r1(cs / (durationS / 60)) : 0,
    damage: me.totalDamageDealtToChampions || 0,
    visionScore: me.visionScore || 0,
  };
}

function aggregate(games) {
  const total = games.length;
  const wins = games.filter((g) => g.win).length;

  const byChamp = new Map();
  for (const g of games) {
    if (!byChamp.has(g.champion)) byChamp.set(g.champion, []);
    byChamp.get(g.champion).push(g);
  }
  const champions = [...byChamp.entries()].map(([champion, rs]) => {
    const w = rs.filter((r) => r.win).length;
    return {
      champion, icon: rs[0].icon, games: rs.length, wins: w, losses: rs.length - w,
      winRate: pct(w, rs.length),
      kda: Number(avg(rs.map((r) => r.kda)).toFixed(2)),
      kills: r1(avg(rs.map((r) => r.kills))),
      deaths: r1(avg(rs.map((r) => r.deaths))),
      assists: r1(avg(rs.map((r) => r.assists))),
      csPerMin: r1(avg(rs.map((r) => r.csPerMin))),
    };
  }).sort((a, b) => b.games - a.games || b.winRate - a.winRate);

  const roles = {};
  for (const g of games) roles[g.role] = (roles[g.role] || 0) + 1;

  return {
    games: total, wins, losses: total - wins, winRate: pct(wins, total),
    kda: Number(avg(games.map((g) => g.kda)).toFixed(2)),
    kills: r1(avg(games.map((g) => g.kills))),
    deaths: r1(avg(games.map((g) => g.deaths))),
    assists: r1(avg(games.map((g) => g.assists))),
    csPerMin: r1(avg(games.map((g) => g.csPerMin))),
    champions,
    roles: Object.entries(roles).map(([role, n]) => ({ role, games: n })).sort((a, b) => b.games - a.games),
  };
}

async function fetchPlayer(userId, player, count) {
  const puuid = await puuidFor(userId, player);
  if (!puuid) return { ok: false, reason: 'Não foi possível resolver o Riot ID (verifique o nick/tag).' };
  const meta = await loadDDragonMeta();

  // Elo atual (Solo/Duo) + registra snapshot para o gráfico de progressão.
  const rank = await rankByPuuid(puuid, TEAM_PLATFORM);
  if (rank) await recordSnapshot(userId, player.name, rank);

  const ids = await fetchMatchIds(puuid, TEAM_PLATFORM, { queue: SOLO_QUEUE, count });
  const results = await Promise.all(ids.map(async (id) => {
    try { return summarizeGame(await fetchMatchById(id, TEAM_PLATFORM), puuid, meta); }
    catch { return null; }
  }));
  const games = results.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
  return {
    ok: true,
    rank, rankLabel: formatRank(rank), ladder: ladderScore(rank),
    snapshots: await getSnapshots(userId, player.name),
    ...aggregate(games),
    history: games,
  };
}

/** SoloQ detalhada de um jogador do roster (por nome canônico). */
export async function soloqForPlayer(userId, name, { count = 20, force = false } = {}) {
  if (!getRiotKey()) {
    return { ok: false, reason: 'Informe a chave da Riot no campo acima (ela expira a cada 24h).' };
  }
  const player = (await listRoster(userId)).find((p) => p.name.toLowerCase() === String(name || '').toLowerCase());
  if (!player) return { ok: false, reason: 'Jogador não encontrado no roster.' };

  const key = `${userId}:${player.name}:${count}`;
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_TTL) return hit.data;

  try {
    const data = { ok: true, player: { name: player.name, tag: player.tag, role: player.role }, ...(await fetchPlayer(userId, player, count)) };
    if (data.ok) cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    return { ok: false, player: { name: player.name, tag: player.tag, role: player.role }, reason: String(err?.message || err) };
  }
}

/** Resumo de SoloQ de todo o roster (leve — menos partidas por jogador). */
export async function soloqOverview(userId, { count = 12, force = false } = {}) {
  const roster = await listRoster(userId);
  const players = [];
  // Sequencial entre jogadores para respeitar o rate limit da chave de dev.
  for (const p of roster) {
    const data = await soloqForPlayer(userId, p.name, { count, force });
    players.push({
      name: p.name, tag: p.tag, role: p.role,
      ok: data.ok,
      reason: data.reason || null,
      rank: data.rank || null, rankLabel: data.rankLabel || 'Unranked', ladder: data.ladder || 0,
      games: data.games || 0, wins: data.wins || 0, losses: data.losses || 0,
      winRate: data.winRate || 0, kda: data.kda || 0, csPerMin: data.csPerMin || 0,
      topChampions: (data.champions || []).slice(0, 3),
      recent: (data.history || []).slice(0, 8).map((g) => ({ win: g.win, champion: g.champion, icon: g.icon, matchId: g.matchId })),
    });
  }
  return { ok: true, keyPresent: !!getRiotKey(), platform: TEAM_PLATFORM, players };
}
