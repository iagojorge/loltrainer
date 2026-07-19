// Helpers de formatação compartilhados.

export function mmss(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function shortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function dateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function kStr(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function pctStr(n) {
  return `${n}%`;
}

// Cor de win rate (escala verde→amarelo→vermelho) — usada no heatmap e células.
export function winRateColor(wr) {
  if (wr >= 60) return '#00D166';
  if (wr >= 40) return '#E6B800';
  return '#FF5252';
}

// Fundo translúcido para células de heatmap conforme win rate.
export function winRateBg(wr) {
  if (wr >= 60) return 'rgba(0, 209, 102, 0.22)';
  if (wr >= 40) return 'rgba(230, 184, 0, 0.20)';
  return 'rgba(255, 82, 82, 0.20)';
}

export const trendArrow = (t) => (t === 'up' ? '↑' : t === 'down' ? '↓' : '→');
export const trendColor = (t) => (t === 'up' ? 'text-win' : t === 'down' ? 'text-loss' : 'text-gray-400');

// ---------- elo/rank ----------
const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);

// "Gold II · 45 LP" (apex sem divisão) ou "Unranked".
export function rankLabel(rank) {
  if (!rank || !rank.tier) return 'Unranked';
  const tier = rank.tier[0] + rank.tier.slice(1).toLowerCase();
  const div = APEX.has(rank.tier) ? '' : ` ${rank.division}`;
  return `${tier}${div} · ${rank.lp ?? 0} LP`;
}

// Cor por tier (aproximada às cores do LoL).
export function rankColor(tier) {
  const map = {
    IRON: '#6b6b6b', BRONZE: '#a1663c', SILVER: '#9aa4ad', GOLD: '#e6b800',
    PLATINUM: '#3fb6a8', EMERALD: '#25b567', DIAMOND: '#5b8dff',
    MASTER: '#c77dff', GRANDMASTER: '#ff5d5d', CHALLENGER: '#7ad1ff',
  };
  return map[tier] || '#8b94a3';
}
