import { Router } from 'express';
import { listRoster, addRosterPlayer, removeRosterPlayer } from '../services/roster.js';

const router = Router();

router.get('/', async (req, res) => res.json(await listRoster(req.userId)));

router.post('/', async (req, res) => {
  const result = await addRosterPlayer(req.userId, req.body || {});
  res.status(result.ok ? 201 : 400).json(result);
});

router.delete('/:id', async (req, res) => {
  const result = await removeRosterPlayer(req.userId, req.params.id);
  res.status(result.ok ? 200 : 404).json(result);
});

export default router;
