const RESULTS = [{ v: 'win', l: 'Vitórias' }, { v: 'loss', l: 'Derrotas' }];
const DURATIONS = [{ v: 'early', l: 'Early (<25m)' }, { v: 'mid', l: 'Mid (25-35m)' }, { v: 'late', l: 'Late (>35m)' }];
const PERIODS = [{ v: '24h', l: 'Últimas 24h' }, { v: '7d', l: 'Últimos 7 dias' }, { v: '30d', l: 'Últimos 30 dias' }];

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-gray-500">{label}</span>
      <select className="input min-w-[8rem]" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>
        ))}
      </select>
    </label>
  );
}

export default function FilterBar({ options, value, onChange, activeCount, onClear }) {
  const set = (key) => (v) => onChange({ ...value, [key]: v, page: 1 });
  const opts = options || {};

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-300">Filtros</span>
          {activeCount > 0 && (
            <span className="chip bg-brand/15 text-brand-glow border border-brand/30">{activeCount} ativo(s)</span>
          )}
        </div>
        {activeCount > 0 && (
          <button className="btn-ghost text-xs" onClick={onClear}>Limpar filtros</button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 grow min-w-[12rem]">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Busca (nick / campeão / time)</span>
          <input className="input" placeholder="Pesquisar…" value={value.search || ''} onChange={(e) => set('search')(e.target.value)} />
        </label>
        <Select label="Patch" value={value.patch} onChange={set('patch')} options={opts.patches || []} />
        <Select label="Jogador" value={value.player} onChange={set('player')} options={opts.players || []} />
        <Select label="Campeão" value={value.champion} onChange={set('champion')} options={opts.champions || []} />
        <Select label="Role" value={value.role} onChange={set('role')} options={opts.roles || []} />
        <Select label="Resultado" value={value.result} onChange={set('result')} options={RESULTS} />
        <Select label="Contexto" value={value.series} onChange={set('series')} options={opts.series || []} />
        <Select label="Adversário" value={value.opponent} onChange={set('opponent')} options={opts.opponents || []} />
        <Select label="Duração" value={value.duration} onChange={set('duration')} options={DURATIONS} />
        <Select label="Período" value={value.period} onChange={set('period')} options={PERIODS} />
      </div>
    </div>
  );
}
