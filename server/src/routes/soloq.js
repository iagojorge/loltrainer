import { Router } from 'express';
import { soloqOverview, soloqForPlayer } from '../services/soloq.js';

const router = Router();

router.get('/', async (req, res) => {
  const force = req.query.force === '1' || req.query.force === 'true';
  const count = Math.min(20, Number(req.query.count) || 12);
  const result = await soloqOverview(req.userId, { count, force });
  res.status(result.ok ? 200 : 502).json(result);
});

router.get('/:name', async (req, res) => {
  const force = req.query.force === '1' || req.query.force === 'true';
  const count = Math.min(50, Number(req.query.count) || 25);
  const result = await soloqForPlayer(req.userId, req.params.name, { count, force });
  res.status(result.ok ? 200 : 400).json(result);
});

export default router;
