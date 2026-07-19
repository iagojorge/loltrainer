import { Router } from 'express';
import { checkRiotKey, listMatchHistory } from '../services/riot.js';

const router = Router();

// Diagnóstico da RIOT_API_KEY.
router.get('/check', async (req, res) => {
  const result = await checkRiotKey(req.query.platform);
  res.status(result.ok ? 200 : 502).json(result);
});

// Histórico de partidas de um jogador (Riot ID → PUUID → match-v5 by-puuid).
router.get('/history', async (req, res) => {
  const { riotId, platform, count } = req.query;
  const result = await listMatchHistory(req.userId, { riotId, platform, count: Number(count) || 10 });
  res.status(result.ok ? 200 : 400).json(result);
});

export default router;
