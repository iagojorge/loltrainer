import { Router } from 'express';
import { listChampions, getChampionDetail } from '../services/stats.js';

const router = Router();

router.get('/', async (req, res) => res.json(await listChampions(req.userId)));

router.get('/:name', async (req, res) => {
  const detail = await getChampionDetail(req.userId, req.params.name);
  if (!detail) return res.status(404).json({ error: 'Campeão não encontrado nos dados do time' });
  res.json(detail);
});

export default router;
