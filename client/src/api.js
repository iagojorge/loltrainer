import axios from 'axios';

// withCredentials envia o cookie de sessão (httpOnly) nas requisições.
const api = axios.create({ baseURL: '/api', withCredentials: true });

// Chave da Riot informada pelo usuário (expira a cada 24h) — guardada só no
// navegador e enviada por header quando presente. Nunca fica no servidor.
const RIOT_KEY_STORAGE = 'riotApiKey';
export const getStoredRiotKey = () => localStorage.getItem(RIOT_KEY_STORAGE) || '';
export const setStoredRiotKey = (k) => {
  if (k && k.trim()) localStorage.setItem(RIOT_KEY_STORAGE, k.trim());
  else localStorage.removeItem(RIOT_KEY_STORAGE);
};
api.interceptors.request.use((cfg) => {
  const k = getStoredRiotKey();
  if (k) cfg.headers['X-Riot-Api-Key'] = k;
  return cfg;
});

// ---- Autenticação ----
export const register = (payload) => api.post('/auth/register', payload).then((r) => r.data);
export const login = (payload) => api.post('/auth/login', payload).then((r) => r.data);
export const logout = () => api.post('/auth/logout').then((r) => r.data);
export const getMe = () => api.get('/auth/me').then((r) => r.data);
export const setTeamName = (teamName) => api.patch('/auth/team-name', { teamName }).then((r) => r.data);

// ---- Partidas ----
export const getMatches = (params) => api.get('/matches', { params }).then((r) => r.data);
export const getMatch = (id) => api.get(`/matches/${id}`).then((r) => r.data);
export const getFilterOptions = () => api.get('/matches/filters/options').then((r) => r.data);
export const importMatch = (payload) => api.post('/matches/import', payload).then((r) => r.data);
export const updateMatch = (id, payload) => api.patch(`/matches/${id}`, payload).then((r) => r.data);
export const deleteMatch = (id) => api.delete(`/matches/${id}`).then((r) => r.data);
export const refreshMatchRanks = (id) => api.post(`/matches/${id}/refresh-ranks`).then((r) => r.data);

// ---- Riot ----
export const getRiotHistory = (params) => api.get('/riot/history', { params }).then((r) => r.data);
export const getRiotCheck = (platform) => api.get('/riot/check', { params: { platform } }).then((r) => r.data);

// ---- Import de .rofl (buffer; não guarda arquivo) ----
export const previewRofl = (file) =>
  api.post('/matches/rofl/preview', file, { headers: { 'Content-Type': 'application/octet-stream' } }).then((r) => r.data);
export const confirmRofl = (file, opts = {}) =>
  api.post('/matches/rofl/confirm', file, { params: opts, headers: { 'Content-Type': 'application/octet-stream' } }).then((r) => r.data);

// ---- Meta / roster ----
export const getMeta = () => api.get('/meta').then((r) => r.data);
export const getRoster = () => api.get('/roster').then((r) => r.data);
export const addRosterPlayer = (payload) => api.post('/roster', payload).then((r) => r.data);
export const removeRosterPlayer = (id) => api.delete(`/roster/${id}`).then((r) => r.data);

// ---- Campeões / jogadores / dashboard / soloq ----
export const getChampions = () => api.get('/champions').then((r) => r.data);
export const getChampion = (name) => api.get(`/champions/${encodeURIComponent(name)}`).then((r) => r.data);
export const getPlayers = () => api.get('/players').then((r) => r.data);
export const getPlayer = (name) => api.get(`/players/${encodeURIComponent(name)}`).then((r) => r.data);
export const getDashboard = () => api.get('/dashboard/all').then((r) => r.data);
export const getSoloq = (params) => api.get('/soloq', { params }).then((r) => r.data);
export const getSoloqPlayer = (name, params) => api.get(`/soloq/${encodeURIComponent(name)}`, { params }).then((r) => r.data);

// ---- Notas ----
export const getNotes = (matchId) => api.get(`/matches/${matchId}/notes`).then((r) => r.data);
export const addNote = (matchId, payload) => api.post(`/matches/${matchId}/notes`, payload).then((r) => r.data);
export const deleteNote = (matchId, noteId) => api.delete(`/matches/${matchId}/notes/${noteId}`).then((r) => r.data);

export default api;
