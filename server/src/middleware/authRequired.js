import { verifyToken } from '../services/auth.js';

// Extrai o usuário do JWT (cookie httpOnly `token` ou header Authorization).
export function currentUserId(req) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7) : null;
  const token = req.cookies?.token || bearer;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.uid || null;
}

// Middleware: exige autenticação e injeta req.userId.
export function authRequired(req, res, next) {
  const uid = currentUserId(req);
  if (!uid) return res.status(401).json({ error: 'Não autenticado.' });
  req.userId = uid;
  next();
}
