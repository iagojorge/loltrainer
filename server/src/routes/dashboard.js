import { Router } from 'express';
import {
  teamSummary, topChampions, bestWinRate, performanceByPosition, playerRanking,
  winningCompositions, championPairs, opponentMatchups, earlyVsLate, winRateByPatch, autoInsights,
} from '../services/stats.js';
import { getUserById } from '../services/auth.js';

const router = Router();

// Tudo em uma chamada — conveniente para o Team Dashboard.
router.get('/all', async (req, res) => {
  const uid = req.userId;
  const user = await getUserById(uid);
  const [summary, topPlayed, best, positions, players, compositions, pairs, opponents, evl, byPatch, insights] = await Promise.all([
    teamSummary(uid, user?.teamName),
    topChampions(uid, 5), bestWinRate(uid, 3), performanceByPosition(uid), playerRanking(uid),
    winningCompositions(uid, 8), championPairs(uid, 10), opponentMatchups(uid),
    earlyVsLate(uid), winRateByPatch(uid), autoInsights(uid),
  ]);
  res.json({ summary, topPlayed, bestWinRate: best, positions, players, compositions, pairs, opponents, earlyVsLate: evl, byPatch, insights });
});

export default router;
