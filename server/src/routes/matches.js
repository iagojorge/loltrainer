import { Router } from 'express';
import { listMatches, getMatchDetail, filterOptions, updateMatch, deleteMatch } from '../services/stats.js';
import { importMatchById, refreshMatchRanks } from '../services/riot.js';
import { getUserById } from '../services/auth.js';

const router = Router();

router.get('/filters/options', async (req, res) => res.json(await filterOptions(req.userId)));

router.get('/', async (req, res) => res.json(await listMatches(req.userId, req.query)));

router.post('/import', async (req, res) => {
  const { matchId, ourSide, ourPuuid, opponent, series_type, series_label, platform } = req.body || {};
  if (!matchId) return res.status(400).json({ ok: false, reason: 'Informe o Match ID.' });
  const result = await importMatchById(req.userId, matchId, { ourSide, ourPuuid, opponent, series_type, series_label, platform });
  res.status(result.ok ? 201 : 400).json(result);
});

router.get('/:id', async (req, res) => {
  const user = await getUserById(req.userId);
  const detail = await getMatchDetail(req.userId, req.params.id, user?.teamName);
  if (!detail) return res.status(404).json({ error: 'Partida não encontrada' });
  res.json(detail);
});

router.patch('/:id', async (req, res) => {
  const result = await updateMatch(req.userId, req.params.id, req.body || {});
  res.status(result.ok ? 200 : 400).json(result);
});

router.delete('/:id', async (req, res) => {
  const result = await deleteMatch(req.userId, req.params.id);
  res.status(result.ok ? 200 : 404).json(result);
});

router.post('/:id/refresh-ranks', async (req, res) => {
  const result = await refreshMatchRanks(req.userId, req.params.id, req.body?.platform);
  res.status(result.ok ? 200 : 400).json(result);
});

export default router;
