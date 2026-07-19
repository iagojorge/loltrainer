import { dbAll, dbGet, dbRun } from '../db.js';
import { ladderScore, formatRank } from './rank.js';

/**
 * Histórico de elo/LP por jogador (isolado por usuário). A Riot só expõe o elo
 * atual, então salvamos um snapshot a cada atualização da SoloQ. Evita duplicatas:
 * só grava quando o ladder muda em relação ao último snapshot.
 */
export async function recordSnapshot(userId, playerName, rank, queue = 'RANKED_SOLO_5x5') {
  if (!rank || !rank.tier) return;
  const ladder = ladderScore(rank);
  const last = await dbGet(
    'SELECT ladder FROM rank_snapshots WHERE user_id = ? AND player_name = ? AND queue = ? ORDER BY id DESC LIMIT 1',
    [Number(userId), playerName, queue]
  );
  if (last && last.ladder === ladder) return;
  await dbRun(
    `INSERT INTO rank_snapshots (user_id, player_name, queue, tier, division, lp, ladder, wins, losses)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [Number(userId), playerName, queue, rank.tier, rank.division || null, rank.lp || 0, ladder, rank.wins || 0, rank.losses || 0]
  );
}

export async function getSnapshots(userId, playerName, queue = 'RANKED_SOLO_5x5') {
  const rows = await dbAll(
    'SELECT tier, division, lp, ladder, wins, losses, taken_at FROM rank_snapshots WHERE user_id = ? AND player_name = ? AND queue = ? ORDER BY taken_at ASC',
    [Number(userId), playerName, queue]
  );
  return rows.map((s) => ({ ...s, label: formatRank({ tier: s.tier, division: s.division, lp: s.lp }) }));
}
