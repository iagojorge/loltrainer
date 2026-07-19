import { dbAll, dbGet, dbRun } from '../db.js';
import { championIcon, ROLES } from '../data/champions.js';
import { listRoster } from './roster.js';

// Roster do time (isolado por usuário).
const ourRoster = (userId) => listRoster(userId);

// ---------- helpers numéricos ----------
export const kdaRatio = (k, d, a) => Number(((k + a) / Math.max(1, d)).toFixed(2));
export const pct = (part, total) => (total ? Number(((part / total) * 100).toFixed(1)) : 0);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const r1 = (n) => Number(n.toFixed(1));
const r2 = (n) => Number(n.toFixed(2));

export function movingAverage(series, window = 5) {
  return series.map((_, i) => {
    const slice = series.slice(Math.max(0, i - window + 1), i + 1);
    return r1(avg(slice));
  });
}

// ---------- parsing ----------
function parseMatchRow(m) {
  const minutes = m.duration_s / 60;
  return {
    ...m,
    bans_our: JSON.parse(m.bans_our),
    bans_their: JSON.parse(m.bans_their),
    minutes,
    durationBucket: minutes < 25 ? 'early' : minutes <= 35 ? 'mid' : 'late',
  };
}
function parseStatRow(s) {
  return {
    ...s,
    is_our_team: !!s.is_our_team,
    items: JSON.parse(s.items),
    final_items: JSON.parse(s.final_items || '[]'),
    runes: JSON.parse(s.runes),
    rank: s.rank ? JSON.parse(s.rank) : null,
    kda: kdaRatio(s.kills, s.deaths, s.assists),
  };
}

const roleOrder = Object.fromEntries(ROLES.map((r, i) => [r, i]));
const byRole = (a, b) => roleOrder[a.role] - roleOrder[b.role];

// ---------- carga enriquecida (por usuário) ----------
async function loadEnriched(userId) {
  const matches = (await dbAll('SELECT * FROM matches WHERE user_id = ? ORDER BY date ASC', [Number(userId)])).map(parseMatchRow);
  const stats = (await dbAll(
    'SELECT ps.* FROM player_stats ps JOIN matches m ON ps.match_id = m.id WHERE m.user_id = ?',
    [Number(userId)]
  )).map(parseStatRow);
  const byMatch = new Map();
  for (const s of stats) {
    if (!byMatch.has(s.match_id)) byMatch.set(s.match_id, []);
    byMatch.get(s.match_id).push(s);
  }
  for (const m of matches) {
    const all = byMatch.get(m.id) || [];
    m.ourStats = all.filter((s) => s.is_our_team).sort(byRole);
    m.enemyStats = all.filter((s) => !s.is_our_team).sort(byRole);
    m.our = teamAggregate(m, m.ourStats);
  }
  return matches;
}

function teamAggregate(match, rows) {
  const k = rows.reduce((s, p) => s + p.kills, 0);
  const d = rows.reduce((s, p) => s + p.deaths, 0);
  const a = rows.reduce((s, p) => s + p.assists, 0);
  const cs = rows.reduce((s, p) => s + p.cs, 0);
  const gold = rows.reduce((s, p) => s + p.gold, 0);
  const damage = rows.reduce((s, p) => s + p.damage_dealt, 0);
  return {
    kills: k, deaths: d, assists: a,
    kda: kdaRatio(k, d, a),
    csPerMin: rows.length ? r1(cs / match.minutes / rows.length) : 0,
    gold, damage,
    champions: rows.map((p) => ({ champion: p.champion, role: p.role, icon: championIcon(p.champion), summoner: p.summoner_name })),
    nicks: rows.map((p) => p.summoner_name),
  };
}

// ---------- listagem de partidas ----------
export async function listMatches(userId, q = {}) {
  const all = await loadEnriched(userId);
  let matches = [...all].sort((a, b) => new Date(b.date) - new Date(a.date));
  const has = (v) => v !== undefined && v !== null && v !== '';

  if (has(q.patch)) matches = matches.filter((m) => m.patch === q.patch);
  if (has(q.result)) matches = matches.filter((m) => m.result === q.result);
  if (has(q.series)) matches = matches.filter((m) => m.series_type === q.series);
  if (has(q.opponent)) matches = matches.filter((m) => m.opponent === q.opponent);
  if (has(q.duration)) matches = matches.filter((m) => m.durationBucket === q.duration);
  if (has(q.player)) matches = matches.filter((m) => m.ourStats.some((s) => s.summoner_name === q.player));
  if (has(q.champion)) matches = matches.filter((m) => m.ourStats.some((s) => s.champion === q.champion));
  if (has(q.role)) matches = matches.filter((m) => m.ourStats.some((s) => s.role === q.role && (!has(q.champion) || s.champion === q.champion)));
  if (has(q.from)) matches = matches.filter((m) => new Date(m.date) >= new Date(q.from));
  if (has(q.to)) matches = matches.filter((m) => new Date(m.date) <= new Date(q.to));
  if (has(q.period)) {
    const days = { '24h': 1, '7d': 7, '30d': 30 }[q.period];
    if (days && all.length) {
      const latest = new Date(all.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b)).date);
      const cutoff = new Date(latest.getTime() - days * 86400000);
      matches = matches.filter((m) => new Date(m.date) >= cutoff);
    }
  }
  if (has(q.search)) {
    const term = q.search.toLowerCase();
    matches = matches.filter((m) =>
      m.opponent.toLowerCase().includes(term) ||
      m.ourStats.some((s) => s.summoner_name.toLowerCase().includes(term) || s.champion.toLowerCase().includes(term))
    );
  }

  const dir = q.order === 'asc' ? 1 : -1;
  const sorters = {
    date: (a, b) => (new Date(a.date) - new Date(b.date)) * dir,
    result: (a, b) => ((a.result === 'win' ? 1 : 0) - (b.result === 'win' ? 1 : 0)) * dir,
    duration: (a, b) => (a.duration_s - b.duration_s) * dir,
    kda: (a, b) => (a.our.kda - b.our.kda) * dir,
  };
  matches.sort(sorters[q.sort] || sorters.date);

  const total = matches.length;
  const page = Math.max(1, parseInt(q.page) || 1);
  const pageSize = Math.min(100, parseInt(q.pageSize) || 25);
  const start = (page - 1) * pageSize;
  const paged = matches.slice(start, start + pageSize).map(toListItem);
  return { total, page, pageSize, totalUnfiltered: all.length, matches: paged };
}

function toListItem(m) {
  return {
    id: m.id, game_id: m.game_id, date: m.date, duration_s: m.duration_s,
    result: m.result, patch: m.patch, series_type: m.series_type, series_label: m.series_label,
    opponent: m.opponent, our_side: m.our_side, source: m.source,
    kda: m.our.kda, kills: m.our.kills, deaths: m.our.deaths, assists: m.our.assists,
    csPerMin: m.our.csPerMin, damage: m.our.damage, champions: m.our.champions, nicks: m.our.nicks,
  };
}

// ---------- detalhe ----------
export async function getMatchDetail(userId, id, teamName) {
  const m = (await loadEnriched(userId)).find((x) => x.id === Number(id));
  if (!m) return null;
  const events = (await dbAll('SELECT * FROM match_events WHERE match_id = ? ORDER BY timestamp_s ASC', [Number(id)]))
    .map((e) => ({ ...e, details: JSON.parse(e.details) }));
  const frames = (await dbAll('SELECT * FROM timeline_frames WHERE match_id = ? ORDER BY minute ASC', [Number(id)]))
    .map((f) => ({ ...f, players: JSON.parse(f.players) }));
  const notes = (await dbAll('SELECT * FROM notes WHERE match_id = ? ORDER BY created_at DESC', [Number(id)]))
    .map((n) => ({ ...n, tags: JSON.parse(n.tags) }));

  const decorate = (rows) => rows.map((s) => ({ ...s, icon: championIcon(s.champion), csPerMin: r1(s.cs / m.minutes) }));
  return {
    ...m, teamName,
    ourStats: decorate(m.ourStats), enemyStats: decorate(m.enemyStats),
    events, frames, notes,
  };
}

export async function updateMatch(userId, id, fields = {}) {
  const existing = await dbGet('SELECT id FROM matches WHERE id = ? AND user_id = ?', [Number(id), Number(userId)]);
  if (!existing) return { ok: false, reason: 'Partida não encontrada.' };
  const sets = []; const args = [];
  const put = (col, val) => { sets.push(`${col} = ?`); args.push(val); };
  if (fields.patch !== undefined) put('patch', String(fields.patch).trim() || 'desconhecido');
  if (fields.opponent !== undefined) put('opponent', String(fields.opponent).trim() || 'Adversário');
  if (fields.series_type !== undefined) put('series_type', String(fields.series_type).trim() || 'Scrim');
  if (fields.series_label !== undefined) put('series_label', String(fields.series_label).trim() || null);
  if (fields.date !== undefined) {
    const d = new Date(fields.date);
    if (Number.isNaN(d.getTime())) return { ok: false, reason: 'Data inválida.' };
    put('date', d.toISOString());
  }
  if (!sets.length) return { ok: false, reason: 'Nada para atualizar.' };
  args.push(Number(id), Number(userId));
  await dbRun(`UPDATE matches SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, args);
  return { ok: true, id: Number(id) };
}

export async function deleteMatch(userId, id) {
  const { changes } = await dbRun('DELETE FROM matches WHERE id = ? AND user_id = ?', [Number(id), Number(userId)]);
  return { ok: changes > 0 };
}

// ---------- campeões ----------
async function ourChampionRows(userId) {
  return (await loadEnriched(userId)).flatMap((m) => m.ourStats.map((s) => ({ ...s, match: m })));
}

function championAggregate(champion, rows) {
  const games = rows.length;
  const wins = rows.filter((r) => r.match.result === 'win').length;
  return {
    champion, icon: championIcon(champion),
    roles: [...new Set(rows.map((r) => r.role))],
    games, wins, losses: games - wins, winRate: pct(wins, games),
    kda: r2(avg(rows.map((r) => r.kda))),
    kills: r1(avg(rows.map((r) => r.kills))),
    deaths: r1(avg(rows.map((r) => r.deaths))),
    assists: r1(avg(rows.map((r) => r.assists))),
    csPerMin: r1(avg(rows.map((r) => r.cs / r.match.minutes))),
    dmgPerMin: Math.round(avg(rows.map((r) => r.damage_dealt / r.match.minutes))),
    goldPerMin: Math.round(avg(rows.map((r) => r.gold / r.match.minutes))),
    killParticipation: pct(avg(rows.map((r) => r.kill_participation)), 1),
  };
}

export async function listChampions(userId) {
  const rows = await ourChampionRows(userId);
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.champion)) map.set(r.champion, []);
    map.get(r.champion).push(r);
  }
  return [...map.entries()].map(([champion, rs]) => championAggregate(champion, rs))
    .sort((a, b) => b.games - a.games);
}

export async function getChampionDetail(userId, champion) {
  const rows = (await ourChampionRows(userId)).filter((r) => r.champion === champion);
  if (!rows.length) return null;
  const agg = championAggregate(champion, rows);

  const patchMap = new Map();
  for (const r of rows) {
    if (!patchMap.has(r.match.patch)) patchMap.set(r.match.patch, { games: 0, wins: 0 });
    const e = patchMap.get(r.match.patch); e.games++; if (r.match.result === 'win') e.wins++;
  }
  const byPatch = [...patchMap.entries()].sort().map(([patch, e]) => ({ patch, games: e.games, winRate: pct(e.wins, e.games) }));

  const matches = rows
    .sort((a, b) => new Date(b.match.date) - new Date(a.match.date))
    .map((r) => {
      const laneOpp = r.match.enemyStats.find((s) => s.role === r.role);
      return {
        id: r.match.id, date: r.match.date, opponent: r.match.opponent,
        result: r.match.result, patch: r.match.patch, role: r.role, summoner: r.summoner_name,
        vsChampion: laneOpp?.champion || null, vsIcon: laneOpp ? championIcon(laneOpp.champion) : null,
        kills: r.kills, deaths: r.deaths, assists: r.assists, kda: r.kda,
        cs: r.cs, csPerMin: r1(r.cs / r.match.minutes),
        damage: r.damage_dealt, gold: r.gold, duration_s: r.match.duration_s,
        items: r.items, final_items: r.final_items, boots: r.boots, runes: r.runes,
      };
    });

  const timeSeries = [...rows].sort((a, b) => new Date(a.match.date) - new Date(b.match.date))
    .map((r) => ({ date: r.match.date, kda: r.kda, csPerMin: r1(r.cs / r.match.minutes), win: r.match.result === 'win' ? 1 : 0 }));
  const winSeries = movingAverage(timeSeries.map((t) => t.win * 100), 5);

  const buildCount = new Map();
  for (const r of rows) {
    const fb = (r.final_items || []).slice(0, 6);
    if (fb.length === 0) continue;
    const key = [...fb.map((it) => it.name)].sort().join(' | ');
    if (!buildCount.has(key)) buildCount.set(key, { build: fb, games: 0, wins: 0 });
    const e = buildCount.get(key); e.games++; if (r.match.result === 'win') e.wins++;
  }
  const builds = [...buildCount.values()].map((b) => ({ ...b, winRate: pct(b.wins, b.games) }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate).slice(0, 5);

  return { ...agg, byPatch, matches, timeSeries, winSeries, matchups: championMatchups(rows, champion), builds };
}

function championMatchups(allRows, champion) {
  const map = new Map();
  for (const r of allRows) {
    const enemy = r.match.enemyStats.find((s) => s.role === r.role);
    if (!enemy) continue;
    if (!map.has(enemy.champion)) map.set(enemy.champion, { games: 0, wins: 0 });
    const e = map.get(enemy.champion); e.games++; if (r.match.result === 'win') e.wins++;
  }
  return [...map.entries()].map(([enemy, e]) => ({
    enemy, icon: championIcon(enemy), games: e.games, wins: e.wins,
    losses: e.games - e.wins, winRate: pct(e.wins, e.games),
  })).sort((a, b) => b.games - a.games || b.winRate - a.winRate);
}

// ---------- jogadores ----------
export async function listPlayers(userId) {
  const roster = await ourRoster(userId);
  const rows = await ourChampionRows(userId);
  return roster.map((p) => {
    const pr = rows.filter((r) => r.summoner_name === p.name);
    const wins = pr.filter((r) => r.match.result === 'win').length;
    return {
      name: p.name, role: p.role, games: pr.length, wins, winRate: pct(wins, pr.length),
      kda: r2(avg(pr.map((r) => r.kda))), csPerMin: r1(avg(pr.map((r) => r.cs / r.match.minutes))),
    };
  });
}

export async function getPlayerProfile(userId, name) {
  const roster = await ourRoster(userId);
  const rows = (await ourChampionRows(userId)).filter((r) => r.summoner_name === name);
  if (!rows.length) return null;
  const wins = rows.filter((r) => r.match.result === 'win').length;

  const champMap = new Map();
  for (const r of rows) {
    if (!champMap.has(r.champion)) champMap.set(r.champion, []);
    champMap.get(r.champion).push(r);
  }
  const champions = [...champMap.entries()].map(([champion, rs]) => {
    const w = rs.filter((r) => r.match.result === 'win').length;
    const ordered = [...rs].sort((a, b) => new Date(a.match.date) - new Date(b.match.date));
    const half = Math.ceil(ordered.length / 2);
    const firstHalf = avg(ordered.slice(0, half).map((r) => r.kda));
    const secondHalf = avg(ordered.slice(half).map((r) => r.kda));
    const trend = ordered.length < 2 ? 'flat' : secondHalf > firstHalf + 0.2 ? 'up' : secondHalf < firstHalf - 0.2 ? 'down' : 'flat';
    return {
      champion, icon: championIcon(champion), games: rs.length, wins: w,
      winRate: pct(w, rs.length), kda: r2(avg(rs.map((r) => r.kda))),
      csPerMin: r1(avg(rs.map((r) => r.cs / r.match.minutes))),
      dmgPerMin: Math.round(avg(rs.map((r) => r.damage_dealt / r.match.minutes))), trend,
    };
  }).sort((a, b) => b.games - a.games);

  const roleMap = new Map();
  for (const r of rows) {
    if (!roleMap.has(r.role)) roleMap.set(r.role, { games: 0, wins: 0 });
    const e = roleMap.get(r.role); e.games++; if (r.match.result === 'win') e.wins++;
  }
  const byRoleArr = [...roleMap.entries()].map(([role, e]) => ({ role, games: e.games, winRate: pct(e.wins, e.games) }));

  const timeSeries = [...rows].sort((a, b) => new Date(a.match.date) - new Date(b.match.date))
    .map((r) => ({ date: r.match.date, kda: r.kda, csPerMin: r1(r.cs / r.match.minutes), win: r.match.result === 'win' ? 1 : 0, champion: r.champion }));

  return {
    name, role: roster.find((p) => p.name === name)?.role,
    games: rows.length, wins, losses: rows.length - wins, winRate: pct(wins, rows.length),
    kda: r2(avg(rows.map((r) => r.kda))), csPerMin: r1(avg(rows.map((r) => r.cs / r.match.minutes))),
    dmgPerMin: Math.round(avg(rows.map((r) => r.damage_dealt / r.match.minutes))),
    champions, byRole: byRoleArr, timeSeries,
    winSeries: movingAverage(timeSeries.map((t) => t.win * 100), 5),
  };
}

// ---------- dashboard ----------
export async function teamSummary(userId, teamName) {
  const matches = await loadEnriched(userId);
  const sorted = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  const games = matches.length;
  const wins = matches.filter((m) => m.result === 'win').length;
  const last10 = sorted.slice(-10); const prev10 = sorted.slice(-20, -10);
  const wr = (arr) => pct(arr.filter((m) => m.result === 'win').length, arr.length);
  const trendDelta = r1(wr(last10) - (prev10.length ? wr(prev10) : wr(last10)));
  const playoffs = matches.filter((m) => m.series_type === 'Playoffs' || m.series_type === 'Qualifiers');
  return {
    teamName,
    games, wins, losses: games - wins, winRate: pct(wins, games), record: `${wins}-${games - wins}`,
    currentPatch: sorted[sorted.length - 1]?.patch,
    seriesRecord: `${playoffs.filter((m) => m.result === 'win').length}-${playoffs.filter((m) => m.result === 'loss').length}`,
    avgDuration: Math.round(avg(matches.map((m) => m.duration_s))),
    avgKda: r2(avg(matches.map((m) => m.our.kda))),
    trendDelta,
    recentResults: sorted.slice(-15).map((m) => ({ id: m.id, result: m.result, opponent: m.opponent, date: m.date })),
    winRateTrend: sorted.map((m, i) => ({
      index: i + 1, date: m.date,
      winRate: movingAverage(sorted.slice(0, i + 1).map((x) => (x.result === 'win' ? 100 : 0)), 5).slice(-1)[0],
    })),
  };
}

export async function topChampions(userId, limit = 5) {
  return (await listChampions(userId)).sort((a, b) => b.games - a.games).slice(0, limit);
}

export async function bestWinRate(userId, minGames = 3) {
  const total = (await loadEnriched(userId)).length;
  return (await listChampions(userId)).filter((c) => c.games >= minGames)
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
    .map((c) => ({ ...c, pickRate: pct(c.games, total) }));
}

export async function performanceByPosition(userId) {
  const matches = await loadEnriched(userId);
  return ROLES.map((role) => {
    const rows = matches.flatMap((m) => m.ourStats.filter((s) => s.role === role).map(() => ({ win: m.result === 'win' })));
    const wins = rows.filter((r) => r.win).length;
    return { role, games: rows.length, winRate: pct(wins, rows.length) };
  });
}

export async function playerRanking(userId) {
  return (await listPlayers(userId)).sort((a, b) => b.kda - a.kda);
}

export async function winningCompositions(userId, limit = 8) {
  const matches = await loadEnriched(userId);
  const map = new Map();
  for (const m of matches) {
    const champs = m.ourStats.map((s) => s.champion).sort();
    const key = champs.join(' | ');
    if (!map.has(key)) {
      map.set(key, {
        champs: m.ourStats.map((s) => ({ champion: s.champion, role: s.role, icon: championIcon(s.champion) })),
        games: 0, wins: 0, matches: [],
      });
    }
    const e = map.get(key); e.games++; if (m.result === 'win') e.wins++;
    e.matches.push({
      id: m.id, date: m.date, opponent: m.opponent, result: m.result,
      our_side: m.our_side, patch: m.patch, duration_s: m.duration_s,
      enemyChamps: m.enemyStats.map((s) => ({ champion: s.champion, role: s.role, icon: championIcon(s.champion) })),
    });
  }
  return [...map.values()].map((c) => ({
    ...c, winRate: pct(c.wins, c.games), matches: c.matches.sort((a, b) => new Date(b.date) - new Date(a.date)),
  })).sort((a, b) => b.wins - a.wins || b.winRate - a.winRate).slice(0, limit);
}

export async function championPairs(userId, limit = 10) {
  const matches = await loadEnriched(userId);
  const map = new Map();
  for (const m of matches) {
    const champs = m.ourStats.map((s) => s.champion).sort();
    for (let i = 0; i < champs.length; i++) {
      for (let j = i + 1; j < champs.length; j++) {
        const key = `${champs[i]} + ${champs[j]}`;
        if (!map.has(key)) map.set(key, { pair: [champs[i], champs[j]], games: 0, wins: 0 });
        const e = map.get(key); e.games++; if (m.result === 'win') e.wins++;
      }
    }
  }
  return [...map.values()].filter((p) => p.games >= 2).map((p) => ({ ...p, winRate: pct(p.wins, p.games) }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate).slice(0, limit);
}

export async function opponentMatchups(userId) {
  const matches = await loadEnriched(userId);
  const map = new Map();
  for (const m of matches) {
    if (!map.has(m.opponent)) map.set(m.opponent, { games: 0, wins: 0 });
    const e = map.get(m.opponent); e.games++; if (m.result === 'win') e.wins++;
  }
  return [...map.entries()].map(([opponent, e]) => ({ opponent, games: e.games, wins: e.wins, winRate: pct(e.wins, e.games) }))
    .sort((a, b) => b.games - a.games);
}

export async function earlyVsLate(userId) {
  const matches = await loadEnriched(userId);
  const bucket = (name, filter) => {
    const arr = matches.filter(filter);
    return { bucket: name, games: arr.length, winRate: pct(arr.filter((m) => m.result === 'win').length, arr.length) };
  };
  return [
    bucket('< 25 min', (m) => m.durationBucket === 'early'),
    bucket('25-35 min', (m) => m.durationBucket === 'mid'),
    bucket('> 35 min', (m) => m.durationBucket === 'late'),
  ];
}

export async function winRateByPatch(userId) {
  const matches = await loadEnriched(userId);
  const map = new Map();
  for (const m of matches) {
    if (!map.has(m.patch)) map.set(m.patch, { games: 0, wins: 0 });
    const e = map.get(m.patch); e.games++; if (m.result === 'win') e.wins++;
  }
  return [...map.entries()].sort().map(([patch, e]) => ({ patch, games: e.games, winRate: pct(e.wins, e.games) }));
}

export async function autoInsights(userId) {
  const insights = [];
  const evl = await earlyVsLate(userId);
  const early = evl[0], late = evl[2];
  if (early.games && late.games) insights.push(`Win rate em early game (<25min): ${early.winRate}% vs late game (>35min): ${late.winRate}%.`);
  const byPos = (await performanceByPosition(userId)).sort((a, b) => b.winRate - a.winRate);
  if (byPos.length && byPos[0].games) insights.push(`Melhor desempenho por posição: ${byPos[0].role} (${byPos[0].winRate}% WR).`);
  const best = (await bestWinRate(userId, 3))[0];
  if (best) insights.push(`Campeão com melhor win rate (min 3 jogos): ${best.champion} (${best.winRate}% em ${best.games} jogos).`);
  const pair = (await championPairs(userId, 1))[0];
  if (pair) insights.push(`Dupla mais forte: ${pair.pair.join(' + ')} — ${pair.winRate}% (${pair.wins}/${pair.games}).`);
  const opp = (await opponentMatchups(userId)).sort((a, b) => b.winRate - a.winRate)[0];
  if (opp) insights.push(`Melhor matchup: vs ${opp.opponent} (${opp.winRate}% em ${opp.games} jogos).`);
  return insights;
}

export async function filterOptions(userId) {
  const matches = await loadEnriched(userId);
  const roster = await ourRoster(userId);
  return {
    patches: [...new Set(matches.map((m) => m.patch))].sort(),
    opponents: [...new Set(matches.map((m) => m.opponent))].sort(),
    series: [...new Set(matches.map((m) => m.series_type))].sort(),
    players: roster.map((p) => p.name),
    champions: [...new Set(matches.flatMap((m) => m.ourStats.map((s) => s.champion)))].sort(),
    roles: ROLES,
  };
}
