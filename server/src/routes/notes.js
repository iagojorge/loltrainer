import { Router } from 'express';
import { dbAll, dbGet, dbRun } from '../db.js';

const router = Router();

// Confirma que a partida pertence ao usuário logado.
async function ownsMatch(userId, matchId) {
  return !!(await dbGet('SELECT id FROM matches WHERE id = ? AND user_id = ?', [Number(matchId), Number(userId)]));
}

router.get('/:matchId/notes', async (req, res) => {
  if (!(await ownsMatch(req.userId, req.params.matchId))) return res.status(404).json({ error: 'Partida não encontrada' });
  const notes = (await dbAll('SELECT * FROM notes WHERE match_id = ? ORDER BY created_at DESC', [Number(req.params.matchId)]))
    .map((n) => ({ ...n, tags: JSON.parse(n.tags) }));
  res.json(notes);
});

router.post('/:matchId/notes', async (req, res) => {
  const { body, tags } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'Corpo da nota é obrigatório' });
  if (!(await ownsMatch(req.userId, req.params.matchId))) return res.status(404).json({ error: 'Partida não encontrada' });
  const { lastInsertRowid } = await dbRun('INSERT INTO notes (match_id, body, tags) VALUES (?, ?, ?)',
    [Number(req.params.matchId), body.trim(), JSON.stringify(Array.isArray(tags) ? tags : [])]);
  const note = await dbGet('SELECT * FROM notes WHERE id = ?', [Number(lastInsertRowid)]);
  res.status(201).json({ ...note, tags: JSON.parse(note.tags) });
});

router.delete('/:matchId/notes/:noteId', async (req, res) => {
  if (!(await ownsMatch(req.userId, req.params.matchId))) return res.status(404).json({ error: 'Partida não encontrada' });
  await dbRun('DELETE FROM notes WHERE id = ? AND match_id = ?', [Number(req.params.noteId), Number(req.params.matchId)]);
  res.status(204).end();
});

export default router;
