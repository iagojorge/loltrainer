/**
 * Conversão do número de patch. Desde 2025 a Riot numera os patches pelo ANO
 * (25.x em 2025, 26.x em 2026), mas o Data Dragon / gameVersion continua em
 * 15.x, 16.x. A regra: para major >= 15, soma-se 10 (15→25, 16→26). Patches
 * antigos (14.x = 2024) permanecem iguais.
 */
export function toClientPatch(majorMinor) {
  const [maj, min] = String(majorMinor || '').split('.');
  const M = Number(maj);
  if (!Number.isFinite(M)) return majorMinor || 'desconhecido';
  const clientMajor = M >= 15 ? M + 10 : M;
  return min != null ? `${clientMajor}.${min}` : String(clientMajor);
}

// gameVersion completo (ex.: "16.13.598.1234") → patch do cliente ("26.13").
export function patchFromGameVersion(gameVersion) {
  if (!gameVersion) return null;
  return toClientPatch(String(gameVersion).split('.').slice(0, 2).join('.'));
}
