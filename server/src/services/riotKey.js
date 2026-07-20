import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Chave da Riot por requisição. A chave de desenvolvimento expira a cada 24h,
 * então o usuário informa a chave na hora de usar (SoloQ/import) — enviada no
 * header `X-Riot-Api-Key`. Guardamos no contexto assíncrono da requisição para
 * não precisar passar a chave por toda a cadeia de funções.
 *
 * Fallback: process.env.RIOT_API_KEY (se estiver configurada no sistema).
 */
const als = new AsyncLocalStorage();

// Middleware: se vier X-Riot-Api-Key, roda a requisição nesse contexto.
export function riotKeyContext(req, res, next) {
  const key = req.headers['x-riot-api-key'];
  if (key && String(key).trim()) return als.run(String(key).trim(), () => next());
  next();
}

export function getRiotKey() {
  return als.getStore() || process.env.RIOT_API_KEY || '';
}
