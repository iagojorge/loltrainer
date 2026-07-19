import { fetchLeagueEntriesByPuuid, resolveRiotId } from './riot.js';

/**
 * Elo (rank) Solo/Duo dos jogadores. A Riot só expõe o elo ATUAL — usamos isso
 * tanto para capturar o elo no momento do import quanto para a SoloQ.
 */

export const SOLO_QUEUE = 'RANKED_SOLO_5x5';
const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);
const DIV_VALUE = { I: 4, II: 3, III: 2, IV: 1 };

// Pontuação linear no ladder (para ordenar/comparar e plotar gráficos).
export function ladderScore(rank) {
  if (!rank || !rank.tier) return 0;
  const t = TIERS.indexOf(rank.tier);
  if (t < 0) return 0;
  const divVal = APEX.has(rank.tier) ? 4 : (DIV_VALUE[rank.division] || 1);
  return t * 400 + (divVal - 1) * 100 + (rank.lp || 0);
}

// Extrai a entrada Solo/Duo das entradas de liga da Riot.
export function extractSolo(entries) {
  const e = (entries || []).find((x) => x.queueType === SOLO_QUEUE);
  if (!e) return null;
  return { tier: e.tier, division: e.rank, lp: e.leaguePoints || 0, wins: e.wins || 0, losses: e.losses || 0 };
}

// Rótulo curto: "Gold II · 45 LP" (apex sem divisão) ou "Unranked".
export function formatRank(rank) {
  if (!rank || !rank.tier) return 'Unranked';
  const tier = rank.tier[0] + rank.tier.slice(1).toLowerCase();
  const div = APEX.has(rank.tier) ? '' : ` ${rank.division}`;
  return `${tier}${div} · ${rank.lp || 0} LP`;
}

/** Elo Solo/Duo de um PUUID (null se unranked ou erro). */
export async function rankByPuuid(puuid, platform) {
  if (!puuid) return null;
  try { return extractSolo(await fetchLeagueEntriesByPuuid(puuid, platform)); }
  catch { return null; }
}

/**
 * Elo Solo/Duo por Riot ID (gameName + tag) — resolve o PUUID e busca o elo.
 * Usado no import de .rofl, que não traz PUUID válido de API. Retorna null em falha.
 */
export async function rankByRiotId(gameName, tag, platform) {
  return (await rankAndPuuidByRiotId(gameName, tag, platform)).rank;
}

/**
 * Resolve o PUUID REAL da API (78 chars) + elo Solo/Duo a partir do Riot ID.
 * O .rofl traz um PUUID interno (formato UUID) que NÃO serve para a API — por
 * isso resolvemos pelo nick#tag. Devolve { puuid, rank } (ambos null em falha).
 */
export async function rankAndPuuidByRiotId(gameName, tag, platform) {
  if (!gameName || !tag) return { puuid: null, rank: null };
  try {
    const { puuid } = await resolveRiotId(gameName, tag, platform);
    const rank = await rankByPuuid(puuid, platform);
    return { puuid: puuid || null, rank };
  } catch { return { puuid: null, rank: null }; }
}
