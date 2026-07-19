import { Router } from 'express';
import { registerUser, loginUser, getUserById, updateTeamName } from '../services/auth.js';
import { authRequired, currentUserId } from '../middleware/authRequired.js';

const router = Router();

// Cookie de sessão (httpOnly). secure em produção (HTTPS/Vercel).
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

router.post('/register', async (req, res) => {
  const { username, password, teamName } = req.body || {};
  const result = await registerUser({ username, password, teamName });
  if (!result.ok) return res.status(400).json(result);
  // Time novo começa com roster vazio — o usuário adiciona seus jogadores.
  res.cookie('token', result.token, cookieOpts);
  res.status(201).json({ ok: true, user: result.user });
});

router.post('/login', async (req, res) => {
  const result = await loginUser(req.body || {});
  if (!result.ok) return res.status(401).json(result);
  res.cookie('token', result.token, cookieOpts);
  res.json({ ok: true, user: result.user });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { ...cookieOpts, maxAge: undefined });
  res.json({ ok: true });
});

// Usuário atual (para o front decidir logado/deslogado).
router.get('/me', async (req, res) => {
  const uid = currentUserId(req);
  if (!uid) return res.status(401).json({ error: 'Não autenticado.' });
  const user = await getUserById(uid);
  if (!user) return res.status(401).json({ error: 'Não autenticado.' });
  res.json({ user });
});

// Renomear o time.
router.patch('/team-name', authRequired, async (req, res) => {
  const result = await updateTeamName(req.userId, req.body?.teamName);
  res.status(result.ok ? 200 : 400).json(result);
});

export default router;
