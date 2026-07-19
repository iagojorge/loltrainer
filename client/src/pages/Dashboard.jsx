import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMatches, getFilterOptions } from '../api.js';
import FilterBar from '../components/FilterBar.jsx';
import ChampIcon from '../components/ChampIcon.jsx';
import { Card, ResultBadge, Spinner, EmptyState } from '../components/ui.jsx';
import { mmss, shortDate } from '../lib/format.js';
import { exportCSV, exportJSON } from '../lib/export.js';

const SORTS = [
  { v: 'date', l: 'Data' },
  { v: 'result', l: 'Resultado' },
  { v: 'duration', l: 'Duração' },
];
const PAGE_SIZES = [10, 25, 50];

const FILTER_KEYS = ['patch', 'player', 'champion', 'role', 'result', 'series', 'opponent', 'duration', 'period', 'search'];

export default function Dashboard() {
  const [options, setOptions] = useState(null);
  const [filters, setFilters] = useState({ page: 1, pageSize: 25, sort: 'date', order: 'desc' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getFilterOptions().then(setOptions); }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      getMatches(filters).then((d) => { setData(d); setLoading(false); });
    }, filters.search ? 250 : 0);
    return () => clearTimeout(t);
  }, [filters]);

  const activeCount = useMemo(() => FILTER_KEYS.filter((k) => filters[k]).length, [filters]);
  const clearFilters = () => setFilters((f) => ({ page: 1, pageSize: f.pageSize, sort: f.sort, order: f.order }));

  const matches = data?.matches || [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const doExportCSV = () => exportCSV('partidas.csv', matches, [
    { key: 'date', label: 'Data', value: (m) => shortDate(m.date) },
    { key: 'result', label: 'Resultado' },
    { key: 'opponent', label: 'Adversário' },
    { key: 'duration_s', label: 'Duração', value: (m) => mmss(m.duration_s) },
    { key: 'kda', label: 'KDA' },
    { key: 'csPerMin', label: 'CS/min' },
    { key: 'damage', label: 'Dano' },
    { key: 'series_type', label: 'Série' },
    { key: 'patch', label: 'Patch' },
    { key: 'nicks', label: 'Nicks', value: (m) => m.nicks.join(' / ') },
    { key: 'champs', label: 'Campeões', value: (m) => m.champions.map((c) => c.champion).join(' / ') },
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Histórico de Partidas</h1>
          <p className="text-sm text-gray-400">
            {data ? <>Mostrando <b className="text-gray-200">{matches.length}</b> de <b className="text-gray-200">{data.total}</b> partidas
              {data.total !== data.totalUnfiltered && <> (total {data.totalUnfiltered})</>}</> : '…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="btn-primary" to="/import">+ Importar partida</Link>
          <button className="btn-ghost" onClick={doExportCSV}>⬇ CSV</button>
          <button className="btn-ghost" onClick={() => exportJSON('partidas.json', matches)}>⬇ JSON</button>
        </div>
      </div>

      <FilterBar
        options={options}
        value={filters}
        onChange={setFilters}
        activeCount={activeCount}
        onClear={clearFilters}
      />

      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-3 border-b border-line flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Ordenar:</span>
            <select className="input" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
              {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
            <button className="btn-ghost" onClick={() => setFilters({ ...filters, order: filters.order === 'asc' ? 'desc' : 'asc' })}>
              {filters.order === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Por página:</span>
            <select className="input" value={filters.pageSize} onChange={(e) => setFilters({ ...filters, pageSize: Number(e.target.value), page: 1 })}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {loading && !data ? <Spinner /> : matches.length === 0 ? (
          <EmptyState>
            {data?.totalUnfiltered === 0 ? (
              <>Nenhuma partida ainda. <Link to="/import" className="text-gold hover:underline">Importe sua primeira partida</Link> pela Riot API.</>
            ) : 'Nenhuma partida corresponde aos filtros.'}
          </EmptyState>
        ) : (
          <>
            {/* Tabela (desktop/tablet) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs uppercase border-b border-line">
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Resultado</th>
                    <th className="px-3 py-2 font-medium">Dur.</th>
                    <th className="px-3 py-2 font-medium">Adversário</th>
                    <th className="px-3 py-2 font-medium">Composição</th>
                    <th className="px-3 py-2 font-medium">Série</th>
                    <th className="px-3 py-2 font-medium">Patch</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id} className="border-b border-line/60 hover:bg-bg-hover/50 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link to={`/matches/${m.id}`} className="text-gray-300 hover:text-white">{shortDate(m.date)}</Link>
                      </td>
                      <td className="px-3 py-2"><ResultBadge result={m.result} /></td>
                      <td className="px-3 py-2 text-gray-400">{mmss(m.duration_s)}</td>
                      <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{m.opponent}{m.source === 'rofl' && <span title="Importada de replay .rofl"> 🎬</span>}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {m.champions.map((c) => (
                            <Link key={c.role} to={`/champions/${encodeURIComponent(c.champion)}`} title={`${c.champion} (${c.summoner})`}>
                              <ChampIcon champion={c.champion} src={c.icon} size="xs" className="hover:ring-2 hover:ring-gold/60" />
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-400 whitespace-nowrap text-xs">{m.series_type}{m.series_label ? ` · ${m.series_label}` : ''}</td>
                      <td className="px-3 py-2 text-gray-400">{m.patch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards (mobile) */}
            <div className="md:hidden divide-y divide-line">
              {matches.map((m) => (
                <Link key={m.id} to={`/matches/${m.id}`} className="block p-3 hover:bg-bg-hover/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ResultBadge result={m.result} />
                      <span className="text-sm text-gray-300">vs {m.opponent}{m.source === 'rofl' && ' 🎬'}</span>
                    </div>
                    <span className="text-xs text-gray-500">{shortDate(m.date)} · {mmss(m.duration_s)}</span>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    {m.champions.map((c) => <ChampIcon key={c.role} champion={c.champion} src={c.icon} size="xs" />)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{m.series_type}</span>
                    <span>{m.patch}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Paginação */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between p-3 border-t border-line text-sm">
            <span className="text-gray-500">Página {data.page} de {totalPages}</span>
            <div className="flex items-center gap-1">
              <button className="btn-ghost disabled:opacity-40" disabled={data.page <= 1}
                onClick={() => setFilters({ ...filters, page: data.page - 1 })}>← Anterior</button>
              <button className="btn-ghost disabled:opacity-40" disabled={data.page >= totalPages}
                onClick={() => setFilters({ ...filters, page: data.page + 1 })}>Próxima →</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
