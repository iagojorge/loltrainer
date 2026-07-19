import { winRateColor, rankLabel, rankColor } from '../lib/format.js';

export function RankBadge({ rank, size = 'sm' }) {
  const label = rankLabel(rank);
  const color = rank?.tier ? rankColor(rank.tier) : '#6b7280';
  const cls = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span className={`chip font-semibold ${cls}`}
      style={{ color, backgroundColor: `${color}22`, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`card p-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">{children}</h2>
      {right}
    </div>
  );
}

export function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-2xl font-bold" style={accent ? { color: accent } : undefined}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

export function ResultBadge({ result, size = 'sm' }) {
  const win = result === 'win';
  const cls = size === 'lg' ? 'text-sm px-2.5 py-1' : 'text-xs px-2 py-0.5';
  return (
    <span
      className={`chip font-bold ${cls}`}
      style={{
        color: win ? '#00D166' : '#FF5252',
        backgroundColor: win ? 'rgba(0,209,102,0.15)' : 'rgba(255,82,82,0.15)',
      }}
    >
      {win ? 'WIN' : 'LOSS'}
    </span>
  );
}

export function WinRatePill({ value }) {
  return (
    <span className="font-semibold" style={{ color: winRateColor(value) }}>
      {value}%
    </span>
  );
}

export function Badge({ children, color = 'gray' }) {
  const map = {
    gray: 'bg-bg-soft text-gray-300 border-line',
    gold: 'bg-gold/10 text-gold border-gold/30',
    blue: 'bg-blueteam/10 text-blueteam border-blueteam/30',
    brand: 'bg-brand/10 text-brand-glow border-brand/30',
  };
  return <span className={`chip border ${map[color] || map.gray}`}>{children}</span>;
}

export function Spinner({ label = 'Carregando…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-gray-400">
      <div className="h-5 w-5 rounded-full border-2 border-gray-600 border-t-brand animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="card p-8 text-center text-gray-500 text-sm">{children}</div>;
}

export function Modal({ open, onClose, title, children, width = 'max-w-2xl' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      onClick={onClose}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className={`relative w-full ${width} card border-brand/30 shadow-neon p-5 my-8`}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold text-white text-glow">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-line mb-4 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
            active === t.id ? 'border-brand text-white' : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
