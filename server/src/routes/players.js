import { Router } from 'express';
import { listPlayers, getPlayerProfile } from '../services/stats.js';

const router = Router();

router.get('/', async (req, res) => res.json(await listPlayers(req.userId)));

router.get('/:name', async (req, res) => {
  const profile = await getPlayerProfile(req.userId, req.params.name);
  if (!profile) return res.status(404).json({ error: 'Jogador não encontrado' });
  res.json(profile);
});

export default router;
