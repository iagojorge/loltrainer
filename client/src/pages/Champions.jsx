import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getChampions } from '../api.js';
import { Card, Spinner, WinRatePill } from '../components/ui.jsx';
import ChampIcon from '../components/ChampIcon.jsx';

const ROLE_LIST = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
const SORTS = [
  { v: 'games', l: 'Mais jogados' },
  { v: 'winRate', l: 'Win Rate' },
  { v: 'kda', l: 'KDA' },
];

export default function Champions() {
  const [list, setList] = useState(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [sort, setSort] = useState('games');

  useEffect(() => { getChampions().then(setList); }, []);

  const filtered = useMemo(() => {
    if (!list) return [];
    return list
      .filter((c) => (!role || c.roles.includes(role)) && c.champion.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b[sort] - a[sort]);
  }, [list, search, role, sort]);

  if (!list) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Campeões</h1>

      <Card className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 grow min-w-[12rem]">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Buscar</span>
          <input className="input" placeholder="Nome do campeão…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Role</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Todas</option>
            {ROLE_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-gray-500">Ordenar</span>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </label>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filtered.map((c) => (
          <Link key={c.champion} to={`/champions/${encodeURIComponent(c.champion)}`}
            className="card card-hover p-3 flex items-center gap-3">
            <ChampIcon champion={c.champion} src={c.icon} size="md" />
            <div className="min-w-0">
              <div className="font-semibold text-gray-100 truncate">{c.champion}</div>
              <div className="text-xs text-gray-500">{c.roles.join(', ')}</div>
              <div className="text-xs text-gray-400 mt-1">
                {c.games}j · <WinRatePill value={c.winRate} /> · KDA {c.kda}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && <Card className="text-center text-gray-500">Nenhum campeão encontrado.</Card>}
    </div>
  );
}
