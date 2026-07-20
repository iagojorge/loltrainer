import { dbGet, dbAll, dbTx } from '../db.js';
import { loadDDragonMeta } from './ddragon.js';
import { listRoster, detectOurTeamId, rosterTagMap } from './roster.js';
import { patchFromGameVersion } from './patch.js';
import { getRiotKey } from './riotKey.js';

const norm = (s) => String(s || '').trim().toLowerCase();
// Canonicaliza um gameName para o nome exato do roster (case-insensitive).
function makeCanonicalizer(roster) {
  const map = new Map(roster.map((p) => [norm(p.name), p.name]));
  return (gameName) => map.get(norm(gameName)) || gameName;
}

/**
 * Integração real com a Riot Games API (match-v5 + timeline).
 *
 * Fluxo de importação por Match ID:
 *   1. fetch GET /lol/match/v5/matches/{matchId}            (dados da partida)
 *   2. fetch GET /lol/match/v5/matches/{matchId}/timeline   (frames + eventos)
 *   3. Data Dragon traduz IDs numéricos (campeões/itens/runas) em nomes.
 *   4. Transforma no nosso schema e persiste numa transação.
 *
 * Não há roster fixo: quem importa escolhe qual lado (azul/vermelho) é o "nosso
 * time" (opts.ourSide), e os player_stats desse lado recebem is_our_team = 1.
 */

const ROLE_MAP = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Support' };

const DRAGON_TYPE = {
  FIRE_DRAGON: 'Infernal', EARTH_DRAGON: 'Mountain', WATER_DRAGON: 'Ocean',
  AIR_DRAGON: 'Cloud', HEXTECH_DRAGON: 'Hextech', CHEMTECH_DRAGON: 'Chemtech',
  ELDER_DRAGON: 'Elder',
};

const TOWER_TIER = { OUTER_TURRET: 1, INNER_TURRET: 2, BASE_TURRET: 3, NEXUS_TURRET: 4 };
const LANE_NAME = { TOP_LANE: 'Top', MID_LANE: 'Mid', BOT_LANE: 'Bot' };

// Plataforma → roteamento regional do match-v5.
const ROUTING = {
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas',
  euw1: 'europe', eun1: 'europe', eune1: 'europe', tr1: 'europe', ru: 'europe',
  kr: 'asia', jp1: 'asia',
  oc1: 'sea', ph2: 'sea', sg2: 'sea', th2: 'sea', tw2: 'sea', vn2: 'sea',
};

const colorOf = (teamId) => (teamId === 100 ? 'blue' : 'red');

function regionRouting(matchId, platform) {
  const prefix = String(matchId).split('_')[0]?.toLowerCase();
  return ROUTING[prefix] || ROUTING[String(platform || '').toLowerCase()] || 'americas';
}

// Mascara a chave para logs/diagnóstico (nunca expõe o valor completo).
export function maskKey(key) {
  if (!key) return null;
  if (key.length <= 12) return `${key.slice(0, 4)}…(${key.length})`;
  return `${key.slice(0, 10)}…${key.slice(-4)} (len ${key.length})`;
}

async function riotFetch(url, key) {
  const res = await fetch(url, { headers: { 'X-Riot-Token': key } });
  if (res.ok) return res.json();

  // Lê o corpo do erro (a Riot devolve JSON com a mensagem real).
  let body = '';
  try { body = await res.text(); } catch { /* ignore */ }
  const safeUrl = url.replace(/\/matches\/[^/]+/, '/matches/***');
  console.error(`[riot] ${res.status} ${res.statusText} em ${safeUrl} :: ${body?.slice(0, 300)}`);

  if (res.status === 400) {
    throw new Error(`HTTP 400 — requisição malformada (Match ID/Riot ID inválido). Resposta da Riot: ${body?.slice(0, 200) || 'sem corpo'}`);
  }
  if (res.status === 401) {
    throw new Error('HTTP 401 — chave ausente/não enviada (RIOT_API_KEY vazia ou header X-Riot-Token não chegou).');
  }
  if (res.status === 403) {
    throw new Error('HTTP 403 — chave rejeitada pela Riot. Quase sempre: chave de desenvolvimento EXPIRADA (expira a cada 24h) ou inválida. Gere uma nova em developer.riotgames.com e atualize o .env (reinicie o servidor).');
  }
  if (res.status === 404) throw new Error('HTTP 404 — não encontrado (Match ID / Riot ID / região).');
  if (res.status === 429) throw new Error('HTTP 429 — limite de requisições atingido. Aguarde alguns segundos.');
  throw new Error(`HTTP ${res.status} ${res.statusText} — ${body?.slice(0, 200) || 'sem corpo'}`);
}

/**
 * Diagnóstico da chave: chama o endpoint leve lol-status-v4/platform-data e
 * devolve o status HTTP bruto + corpo da Riot, sem mascarar a causa. Usado pelo
 * endpoint de debug GET /api/riot/check e pelo Swagger.
 */
export async function checkRiotKey(platform) {
  const key = getRiotKey();
  const plat = (platform || process.env.RIOT_PLATFORM || 'br1').toLowerCase();
  const routing = ROUTING[plat] || 'americas';
  const diag = {
    keyPresent: !!key,
    keyPreview: maskKey(key),
    platform: plat,
    routing,
    envLoadedAtStartup: !!getRiotKey(),
  };
  if (!key) {
    return { ...diag, ok: false, hint: 'RIOT_API_KEY vazia em process.env. Confirme o .env na raiz e reinicie o servidor (o .env é lido só no boot).' };
  }
  // Detecta espaços/aspas acidentais que invalidam a chave silenciosamente.
  if (key !== key.trim() || /["']/.test(key)) {
    diag.warning = 'A chave contém espaços ou aspas — remova-os do .env.';
  }
  try {
    const url = `https://${plat}.api.riotgames.com/lol/status/v4/platform-data`;
    const res = await fetch(url, { headers: { 'X-Riot-Token': key } });
    let body = '';
    try { body = await res.text(); } catch { /* ignore */ }
    let parsed; try { parsed = JSON.parse(body); } catch { parsed = body?.slice(0, 300); }
    return {
      ...diag,
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      endpoint: url,
      response: res.ok ? { name: parsed?.name, status_ok: true } : parsed,
      hint: res.ok
        ? 'Chave válida — a Riot respondeu 200 no status da plataforma.'
        : res.status === 403
          ? 'A Riot respondeu 403: chave de desenvolvimento provavelmente EXPIRADA (24h) ou inválida. Gere outra em developer.riotgames.com.'
          : res.status === 401
            ? 'A Riot respondeu 401: chave ausente/malformada.'
            : `A Riot respondeu ${res.status}.`,
    };
  } catch (err) {
    return { ...diag, ok: false, error: String(err?.message || err) };
  }
}

/**
 * Normaliza o identificador de partida para o formato do match-v5
 * (PLATAFORMA_gameId). Aceita tanto "BR1_1234567890" quanto um gameId numérico
 * cru ("1234567890"), que é prefixado com a plataforma escolhida.
 * @returns {string|null} matchId normalizado ou null se inválido.
 */
function normalizeMatchId(input, platform) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const plat = String(platform || process.env.RIOT_PLATFORM || 'br1').toUpperCase();
    return `${plat}_${raw}`;
  }
  const m = raw.match(/^([A-Za-z0-9]+)_(\d+)$/);
  if (m) return `${m[1].toUpperCase()}_${m[2]}`;
  return null;
}

/** Resolve um Riot ID (gameName#tagLine) no PUUID via account-v1. */
export async function resolveRiotId(gameName, tagLine, platform) {
  const key = getRiotKey();
  const routing = regionRouting(`${platform || ''}_0`, platform);
  const url = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return riotFetch(url, key); // { puuid, gameName, tagLine }
}

/**
 * Entradas de liga (elo) de um PUUID via league-v4 (by-puuid). Endpoint é
 * roteado por plataforma (br1, na1…), não por região. Usado para capturar o elo
 * dos jogadores no momento do import e na SoloQ.
 */
export async function fetchLeagueEntriesByPuuid(puuid, platform) {
  const key = getRiotKey();
  const plat = String(platform || process.env.RIOT_PLATFORM || 'br1').toLowerCase();
  return riotFetch(`https://${plat}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`, key);
}

/** Busca uma partida completa (match-v5) por matchId. Usado pela SoloQ. */
export async function fetchMatchById(matchId, platform) {
  const key = getRiotKey();
  const routing = regionRouting(matchId, platform);
  return riotFetch(`https://${routing}.api.riotgames.com/lol/match/v5/matches/${matchId}`, key);
}

/** Lista os matchIds recentes de um PUUID via match-v5 (by-puuid). */
export async function fetchMatchIds(puuid, platform, { start = 0, count = 10, queue, type } = {}) {
  const key = getRiotKey();
  const routing = regionRouting(`${platform || ''}_0`, platform);
  const qs = new URLSearchParams({ start: String(start), count: String(Math.min(100, count)) });
  if (queue) qs.set('queue', String(queue));
  if (type) qs.set('type', String(type));
  const url = `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?${qs}`;
  return riotFetch(url, key); // string[]
}

/**
 * Histórico de partidas de um jogador: resolve o Riot ID, busca os matchIds e
 * monta um resumo leve de cada partida (1 chamada match-v5 por partida) para o
 * usuário escolher qual importar. O lado do jogador buscado já vem indicado.
 * @param {object} p { riotId:"Nome#TAG", platform, count }
 */
export async function listMatchHistory(userId, { riotId, platform, count = 10 } = {}) {
  const key = getRiotKey();
  if (!key) return { ok: false, reason: 'RIOT_API_KEY não configurada. Defina a chave no .env e reinicie o servidor.' };
  const [gameName, tagLine] = String(riotId || '').split('#');
  if (!gameName || !tagLine) {
    return { ok: false, reason: 'Riot ID inválido. Use o formato Nome#TAG (ex.: Faker#KR1).' };
  }
  try {
    const routing = regionRouting(`${platform || ''}_0`, platform);
    const { puuid } = await resolveRiotId(gameName, tagLine, platform);
    const ids = await fetchMatchIds(puuid, platform, { count: Math.min(20, count) });

    const base = `https://${routing}.api.riotgames.com/lol/match/v5/matches`;
    const matches = await Promise.all(ids.map(async (matchId) => {
      try {
        const j = await riotFetch(`${base}/${matchId}`, key);
        return await summarizeMatch(userId, j, puuid);
      } catch {
        return { matchId, error: true };
      }
    }));

    return {
      ok: true,
      account: { gameName, tagLine, puuid },
      platform: String(platform || process.env.RIOT_PLATFORM || 'br1').toLowerCase(),
      matches: matches.filter(Boolean),
    };
  } catch (err) {
    return { ok: false, reason: String(err?.message || err) };
  }
}

/** Resumo leve de uma partida (sem persistir) para a tela de histórico. */
async function summarizeMatch(userId, matchJson, ourPuuid) {
  const info = matchJson?.info || {};
  const me = (info.participants || []).find((p) => p.puuid === ourPuuid);
  const ourTeamId = me?.teamId || 100;
  const duration_s = info.gameEndTimestamp ? info.gameDuration : Math.round((info.gameDuration || 0) / 1000);
  return {
    matchId: matchJson?.metadata?.matchId,
    date: new Date(info.gameStartTimestamp || info.gameCreation || 0).toISOString(),
    queueId: info.queueId,
    durationS: duration_s,
    patch: info.gameVersion ? patchFromGameVersion(info.gameVersion) : '',
    yourSide: colorOf(ourTeamId),
    yourChampion: me?.championName || null,
    win: !!me?.win,
    alreadyImported: !!(await dbGet('SELECT 1 FROM matches WHERE user_id = ? AND game_id = ?', [Number(userId), matchJson?.metadata?.matchId])),
    participants: (info.participants || []).map((p) => ({
      name: p.riotIdGameName || p.summonerName,
      champion: p.championName,
      side: colorOf(p.teamId),
      isYou: p.puuid === ourPuuid,
    })),
  };
}

/**
 * Importa uma partida pelo Match ID (ou gameId numérico, que é prefixado com a
 * plataforma). Se ourPuuid for informado e ourSide não, o lado do nosso time é
 * detectado automaticamente pelo participante correspondente.
 * @param {string} matchId  "BR1_1234567890" ou "1234567890"
 * @param {object} opts { ourSide?, ourPuuid?, opponent?, series_type?, series_label?, platform? }
 */
export async function importMatchById(userId, matchId, opts = {}) {
  const key = getRiotKey();
  if (!key) {
    return { ok: false, reason: 'RIOT_API_KEY não configurada. Defina a chave no arquivo .env e reinicie o servidor.' };
  }
  const id = normalizeMatchId(matchId, opts.platform);
  if (!id) {
    return { ok: false, reason: 'Match ID inválido. Use "BR1_1234567890" ou um gameId numérico + região.' };
  }

  const existing = await dbGet('SELECT id FROM matches WHERE user_id = ? AND game_id = ?', [Number(userId), id]);
  if (existing) return { ok: false, reason: 'Partida já importada.', id: existing.id };

  try {
    const routing = regionRouting(id, opts.platform);
    const base = `https://${routing}.api.riotgames.com/lol/match/v5/matches/${id}`;
    const [matchJson, timelineJson, meta, roster] = await Promise.all([
      riotFetch(base, key),
      riotFetch(`${base}/timeline`, key),
      loadDDragonMeta(),
      listRoster(userId),
    ]);

    // Resolve o nosso lado: explícito > pelo PUUID > pelo roster > azul.
    let ourSide = opts.ourSide;
    if (!ourSide && opts.ourPuuid) {
      const me = (matchJson.info?.participants || []).find((p) => p.puuid === opts.ourPuuid);
      if (me) ourSide = colorOf(me.teamId);
    }
    if (!ourSide) {
      const parts = (matchJson.info?.participants || []).map((p) => ({
        gameName: p.riotIdGameName || p.summonerName, teamId: p.teamId,
      }));
      const tid = await detectOurTeamId(userId, parts);
      if (tid) ourSide = colorOf(tid);
    }

    const ranks = await fetchRanksForParticipants(matchJson.info?.participants || [], opts.platform);

    const newId = await persistMatch(userId, matchJson, timelineJson, meta, {
      ...opts, ourSide: ourSide || 'blue', ranks, canonical: makeCanonicalizer(roster),
    });
    return { ok: true, id: newId };
  } catch (err) {
    return { ok: false, reason: String(err?.message || err) };
  }
}

/**
 * Reatualiza o elo Solo/Duo de todos os jogadores de uma partida já importada
 * (botão "Atualizar elo" no editar). Refetch por PUUID; sem PUUID (alguns .rofl)
 * o jogador é mantido como está.
 */
// Um PUUID de API tem ~78 chars; o PUUID interno do .rofl é um UUID (36) e não
// serve para a league-v4 → tratamos como inválido e reresolvemos pelo Riot ID.
const isApiPuuid = (p) => typeof p === 'string' && p.length > 60;

export async function refreshMatchRanks(userId, matchId, platform) {
  if (!getRiotKey()) {
    return { ok: false, reason: 'RIOT_API_KEY não configurada.' };
  }
  // Garante que a partida é do usuário.
  const owns = await dbGet('SELECT id FROM matches WHERE id = ? AND user_id = ?', [Number(matchId), Number(userId)]);
  if (!owns) return { ok: false, reason: 'Partida não encontrada.' };
  const rows = await dbAll('SELECT id, puuid, riot_tag, summoner_name FROM player_stats WHERE match_id = ?', [Number(matchId)]);

  const { rankByPuuid, rankAndPuuidByRiotId } = await import('./rank.js');
  const rosterTag = await rosterTagMap(userId);

  let ranked = 0, checked = 0;
  const updates = [];
  await Promise.all(rows.map(async (r) => {
    checked++;
    let puuid = isApiPuuid(r.puuid) ? r.puuid : null;
    let rank = puuid ? await rankByPuuid(puuid, platform) : null;
    if (!rank) {
      const tag = r.riot_tag || rosterTag.get(String(r.summoner_name || '').toLowerCase());
      if (tag) {
        const res = await rankAndPuuidByRiotId(r.summoner_name, tag, platform);
        if (res.puuid) puuid = res.puuid;
        rank = res.rank;
      }
    }
    updates.push([rank ? JSON.stringify(rank) : null, puuid, r.id]);
    if (rank) ranked++;
  }));
  await dbTx(async (tx) => {
    for (const args of updates) await tx.run('UPDATE player_stats SET rank = ?, puuid = ? WHERE id = ?', args);
  });
  return { ok: true, total: rows.length, checked, ranked };
}

// Busca o elo Solo/Duo (por PUUID) de todos os participantes → Map(puuid → rank).
async function fetchRanksForParticipants(participants, platform) {
  const map = new Map();
  if (!getRiotKey()) return map;
  const { rankByPuuid } = await import('./rank.js');
  await Promise.all(participants.map(async (p) => {
    if (!p.puuid) return;
    const rank = await rankByPuuid(p.puuid, platform);
    if (rank) map.set(p.puuid, rank);
  }));
  return map;
}

// ---------- transformação match-v5 + timeline → nosso schema ----------

function buildRunes(perks, meta) {
  const styles = perks?.styles || [];
  const primary = styles[0];
  const secondary = styles[1];
  const stat = perks?.statPerks || {};
  // sel = { perk, var1, var2, var3 }: var* são os valores de interação da runa
  // (cura do Conquistador, dano bloqueado do Osso Revestido, etc.).
  const rune = (sel) => ({
    id: sel?.perk,
    name: meta.runeName(sel?.perk),
    icon: meta.runeIcon(sel?.perk),
    vars: [sel?.var1 || 0, sel?.var2 || 0, sel?.var3 || 0],
  });
  return {
    primary: primary ? {
      tree: meta.styleName(primary.style),
      treeIcon: meta.styleIcon(primary.style),
      keystone: rune(primary.selections?.[0]),
      runes: (primary.selections || []).slice(1).map(rune).filter((r) => r.name),
    } : null,
    secondary: secondary ? {
      tree: meta.styleName(secondary.style),
      treeIcon: meta.styleIcon(secondary.style),
      runes: (secondary.selections || []).map(rune).filter((r) => r.name),
    } : null,
    shards: [stat.offense, stat.flex, stat.defense].map((s) => meta.statShardName(s)).filter(Boolean),
  };
}

// Build final (itens fechados) a partir dos slots item0..item6 do participante.
function finalItems(p, meta) {
  const out = [];
  for (let i = 0; i <= 6; i++) {
    const id = p[`item${i}`];
    if (!id) continue;
    const name = meta.itemName(id);
    if (!name || meta.itemIsConsumable(id)) continue; // ignora trinket/consumível
    out.push({ id, name });
  }
  return out;
}

function buildItemsByParticipant(timelineJson, meta) {
  // ITEM_PURCHASED em ordem cronológica por participante (ignora consumíveis).
  const seq = new Map(); // participantId → [{id,name,t}]
  const boots = new Map(); // participantId → nome da bota mais recente
  for (const frame of timelineJson?.info?.frames || []) {
    for (const ev of frame.events || []) {
      if (ev.type !== 'ITEM_PURCHASED') continue;
      const name = meta.itemName(ev.itemId);
      if (!name || meta.itemIsConsumable(ev.itemId)) continue;
      if (!seq.has(ev.participantId)) seq.set(ev.participantId, []);
      seq.get(ev.participantId).push({ id: ev.itemId, name, t: Math.round(ev.timestamp / 1000) });
      if (meta.itemIsBoots(ev.itemId)) boots.set(ev.participantId, name);
    }
  }
  return { seq, boots };
}

async function persistMatch(userId, matchJson, timelineJson, meta, opts) {
  const info = matchJson.info;
  const metadata = matchJson.metadata;
  if (!info || !Array.isArray(info.participants)) {
    throw new Error('JSON match-v5 inválido (faltam info.participants).');
  }
  const canonical = opts.canonical || ((g) => g);

  const ourTeamId = opts.ourSide === 'red' ? 200 : 100;
  const our_side = colorOf(ourTeamId);
  const rankByPuuidMap = opts.ranks || new Map(); // puuid → elo Solo/Duo (capturado no import)

  // gameDuration: em segundos quando há gameEndTimestamp; senão em ms.
  const duration_s = info.gameEndTimestamp ? info.gameDuration : Math.round((info.gameDuration || 0) / 1000);
  const patch = info.gameVersion ? patchFromGameVersion(info.gameVersion) : 'unknown';
  const date = new Date(info.gameStartTimestamp || info.gameCreation || Date.now()).toISOString();

  const teams = info.teams || [];
  const ourTeam = teams.find((t) => t.teamId === ourTeamId) || {};
  const enemyTeam = teams.find((t) => t.teamId !== ourTeamId) || {};
  const result = ourTeam.win ? 'win' : 'loss';

  const banNames = (team) => (team.bans || [])
    .filter((b) => b.championId && b.championId !== -1)
    .map((b) => meta.championNameByKey(b.championId))
    .filter(Boolean);

  const obj = (team, k) => team?.objectives?.[k]?.kills || 0;

  // kills por time (para kill participation).
  const teamKills = { 100: 0, 200: 0 };
  for (const p of info.participants) teamKills[p.teamId] = (teamKills[p.teamId] || 0) + p.kills;

  // mapa participantId → info resumida (para timeline/eventos).
  const pById = new Map();
  for (const p of info.participants) {
    pById.set(p.participantId, {
      teamId: p.teamId,
      side: colorOf(p.teamId),
      name: p.riotIdGameName || p.summonerName || `Player${p.participantId}`,
      champion: meta.championNameById(p.championName),
    });
  }

  const { seq: itemSeq, boots: bootsByP } = buildItemsByParticipant(timelineJson, meta);

  const statRows = info.participants.map((p) => {
    const tk = teamKills[p.teamId] || 0;
    const gameName = p.riotIdGameName || p.summonerName || `Player${p.participantId}`;
    // Casa o participante com o roster (case-insensitive): garante que o campeão
    // seja atribuído ao jogador certo mesmo com variação de maiúsculas.
    return {
      side: colorOf(p.teamId),
      is_our_team: p.teamId === ourTeamId ? 1 : 0,
      summoner_name: canonical(gameName),
      champion: meta.championNameById(p.championName),
      role: ROLE_MAP[p.teamPosition] || ROLE_MAP[p.individualPosition] || p.teamPosition || 'Unknown',
      level: p.champLevel || 0,
      kills: p.kills, deaths: p.deaths, assists: p.assists,
      kill_participation: tk > 0 ? Number(((p.kills + p.assists) / tk).toFixed(3)) : 0,
      cs: (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
      gold: p.goldEarned || 0,
      damage_dealt: p.totalDamageDealtToChampions || 0,
      damage_physical: p.physicalDamageDealtToChampions || 0,
      damage_magic: p.magicDamageDealtToChampions || 0,
      damage_true: p.trueDamageDealtToChampions || 0,
      damage_taken: p.totalDamageTaken || 0,
      damage_mitigated: p.damageSelfMitigated || 0,
      healing: p.totalHeal || 0,
      heals_teammates: p.totalHealsOnTeammates || 0,
      shielding: p.totalDamageShieldedOnTeammates || 0,
      puuid: p.puuid || null,
      riot_tag: p.riotIdTagline || null,
      rank: rankByPuuidMap.get(p.puuid) ? JSON.stringify(rankByPuuidMap.get(p.puuid)) : null,
      wards_placed: p.wardsPlaced || 0,
      wards_destroyed: p.wardsKilled || 0,
      vision_score: p.visionScore || 0,
      cc_score: p.timeCCingOthers || 0,
      items: JSON.stringify(itemSeq.get(p.participantId) || []),
      final_items: JSON.stringify(finalItems(p, meta)),
      boots: bootsByP.get(p.participantId) || null,
      runes: JSON.stringify(buildRunes(p.perks, meta)),
    };
  });

  // ----- eventos a partir da timeline -----
  const events = [];
  const dragonStacks = { blue: 0, red: 0 };
  const killTimes = []; // { t, side } para acumular kills nos frames

  for (const frame of timelineJson?.info?.frames || []) {
    for (const ev of frame.events || []) {
      const t = Math.round(ev.timestamp / 1000);
      if (ev.type === 'CHAMPION_KILL') {
        const killer = pById.get(ev.killerId);
        const victim = pById.get(ev.victimId);
        // killerId 0 = execução por torre/minion: credita ao time oposto da vítima.
        const side = killer ? killer.side : (victim ? colorOf(victim.teamId === 100 ? 200 : 100) : 'blue');
        killTimes.push({ t: ev.timestamp, side });
        events.push({
          event_type: 'kill', timestamp_s: t, side,
          details: JSON.stringify({
            killer: killer ? { name: killer.name, champion: killer.champion } : null,
            victim: victim ? { name: victim.name, champion: victim.champion } : null,
            assists: (ev.assistingParticipantIds || []).map((aid) => {
              const a = pById.get(aid);
              return a ? { name: a.name, champion: a.champion } : null;
            }).filter(Boolean),
          }),
        });
      } else if (ev.type === 'BUILDING_KILL') {
        // ev.teamId = time dono (destruído); destruidor é o oposto.
        const side = colorOf(ev.teamId === 100 ? 200 : 100);
        const lane = LANE_NAME[ev.laneType] || ev.laneType || '';
        if (ev.buildingType === 'TOWER_BUILDING') {
          events.push({ event_type: 'tower', timestamp_s: t, side, details: JSON.stringify({ lane, tier: TOWER_TIER[ev.towerType] || 1, gold: 200 }) });
        } else if (ev.buildingType === 'INHIBITOR_BUILDING') {
          events.push({ event_type: 'inhibitor', timestamp_s: t, side, details: JSON.stringify({ lane }) });
        }
      } else if (ev.type === 'ELITE_MONSTER_KILL') {
        const side = colorOf(ev.killerTeamId || pById.get(ev.killerId)?.teamId || 100);
        if (ev.monsterType === 'DRAGON') {
          dragonStacks[side]++;
          events.push({ event_type: 'dragon', timestamp_s: t, side, details: JSON.stringify({ type: DRAGON_TYPE[ev.monsterSubType] || 'Dragão', stacks: dragonStacks[side] }) });
        } else if (ev.monsterType === 'BARON_NASHOR') {
          events.push({ event_type: 'baron', timestamp_s: t, side, details: JSON.stringify({}) });
        }
        // RIFTHERALD / HORDE (grubs) não são exibidos na timeline da UI.
      }
    }
  }
  events.sort((a, b) => a.timestamp_s - b.timestamp_s);

  // first blood = lado do primeiro abate.
  killTimes.sort((a, b) => a.t - b.t);
  const first_blood_side = killTimes[0]?.side || our_side;

  // ----- frames (gráficos de evolução) -----
  const ourNames = statRows.filter((s) => s.is_our_team).map((s) => s.summoner_name);
  const nameByPid = new Map([...pById.entries()].map(([pid, v]) => [pid, v.name]));
  const frames = (timelineJson?.info?.frames || []).map((frame) => {
    const minute = Math.round(frame.timestamp / 60000);
    let blue_gold = 0, red_gold = 0;
    const players = {};
    for (const pf of Object.values(frame.participantFrames || {})) {
      const meta2 = pById.get(pf.participantId);
      if (!meta2) continue;
      if (meta2.side === 'blue') blue_gold += pf.totalGold || 0; else red_gold += pf.totalGold || 0;
      if (meta2.teamId === ourTeamId) {
        players[meta2.name] = {
          level: pf.level || 1,
          cs: (pf.minionsKilled || 0) + (pf.jungleMinionsKilled || 0),
          gold: pf.totalGold || 0,
        };
      }
    }
    const blue_kills = killTimes.filter((k) => k.t <= frame.timestamp && k.side === 'blue').length;
    const red_kills = killTimes.filter((k) => k.t <= frame.timestamp && k.side === 'red').length;
    return { minute, blue_gold, red_gold, blue_kills, red_kills, players: JSON.stringify(players) };
  });

  const matchRow = {
    game_id: metadata.matchId,
    date, duration_s, result, patch,
    game_version: info.gameVersion || null,
    series_type: opts.series_type || 'Scrim',
    series_label: opts.series_label || null,
    opponent: opts.opponent?.trim() || 'Adversário',
    our_side,
    bans_our: JSON.stringify(banNames(ourTeam)),
    bans_their: JSON.stringify(banNames(enemyTeam)),
    first_blood_side,
    dragons_our: obj(ourTeam, 'dragon'), dragons_their: obj(enemyTeam, 'dragon'),
    barons_our: obj(ourTeam, 'baron'), barons_their: obj(enemyTeam, 'baron'),
    towers_our: obj(ourTeam, 'tower'), towers_their: obj(enemyTeam, 'tower'),
    source: 'riot',
  };

  return await insertAll(userId, matchRow, statRows, events, frames);
}

// Colunas (ordem fixa) para inserts posicionais compatíveis com os dois backends.
const MATCH_COLS = ['game_id', 'date', 'duration_s', 'result', 'patch', 'game_version', 'series_type', 'series_label', 'opponent', 'our_side', 'bans_our', 'bans_their', 'first_blood_side', 'dragons_our', 'dragons_their', 'barons_our', 'barons_their', 'towers_our', 'towers_their', 'source'];
const STAT_COLS = ['side', 'is_our_team', 'summoner_name', 'champion', 'role', 'level', 'kills', 'deaths', 'assists', 'kill_participation', 'cs', 'gold', 'damage_dealt', 'damage_physical', 'damage_magic', 'damage_true', 'damage_taken', 'damage_mitigated', 'healing', 'heals_teammates', 'shielding', 'wards_placed', 'wards_destroyed', 'vision_score', 'cc_score', 'items', 'final_items', 'boots', 'runes', 'puuid', 'riot_tag', 'rank'];
const STAT_DEFAULTS = { heals_teammates: 0, shielding: 0, puuid: null, riot_tag: null, rank: null, game_version: null };
const pick = (obj, cols) => cols.map((c) => (obj[c] === undefined ? null : obj[c]));

// Persiste partida + stats + eventos + frames numa transação (por usuário).
// Reutilizado pela importação Riot (match-v5) e pela importação de replays (.rofl).
export async function insertAll(userId, matchRow, statRows, events, frames) {
  const row = { source: 'riot', game_version: null, ...matchRow };
  const matchSql = `INSERT INTO matches (user_id,${MATCH_COLS.join(',')}) VALUES (${['?', ...MATCH_COLS.map(() => '?')].join(',')})`;
  const statSql = `INSERT INTO player_stats (match_id,${STAT_COLS.join(',')}) VALUES (${['?', ...STAT_COLS.map(() => '?')].join(',')})`;
  const eventSql = 'INSERT INTO match_events (match_id,event_type,timestamp_s,side,details) VALUES (?,?,?,?,?)';
  const frameSql = 'INSERT INTO timeline_frames (match_id,minute,blue_gold,red_gold,blue_kills,red_kills,players) VALUES (?,?,?,?,?,?)';

  return dbTx(async (tx) => {
    const { lastInsertRowid } = await tx.run(matchSql, [Number(userId), ...pick(row, MATCH_COLS)]);
    const matchId = Number(lastInsertRowid);
    for (const s of statRows) await tx.run(statSql, [matchId, ...pick({ ...STAT_DEFAULTS, ...s }, STAT_COLS)]);
    for (const e of events) await tx.run(eventSql, [matchId, e.event_type, e.timestamp_s, e.side, e.details]);
    for (const f of frames) await tx.run(frameSql, [matchId, f.minute, f.blue_gold, f.red_gold, f.blue_kills, f.red_kills, f.players]);
    return matchId;
  });
}
