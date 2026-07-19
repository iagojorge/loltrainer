import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlayer } from '../api.js';
import { Card, SectionTitle, StatCard, Spinner, WinRatePill, EmptyState } from '../components/ui.jsx';
import ChampIcon from '../components/ChampIcon.jsx';
import { TrendLine, ScatterPerf, VBar, Donut } from '../components/charts.jsx';
import { shortDate, winRateColor, kStr, trendArrow, trendColor } from '../lib/format.js';
import { ROLE_ICON } from '../lib/champ.js';

export default function PlayerDetail() {
  const { name } = useParams();
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setP(null); setMissing(false);
    getPlayer(name).then(setP).catch(() => setMissing(true));
  }, [name]);

  const chartData = useMemo(() => {
    if (!p) return [];
    return p.timeSeries.map((t, i) => ({
      i: i + 1, date: shortDate(t.date), kda: t.kda, csPerMin: t.csPerMin, wr: p.winSeries[i], champion: t.champion,
    }));
  }, [p]);

  if (missing) return <EmptyState>Jogador “{name}” não encontrado.</EmptyState>;
  if (!p) return <Spinner />;

  return (
    <div className="space-y-6">
      <Link to="/players" className="text-sm text-gray-400 hover:text-white">← Jogadores</Link>

      <div>
        <h1 className="text-2xl font-bold text-white">{p.name}</h1>
        <p className="text-sm text-gray-400">{ROLE_ICON[p.role]} {p.role} · {p.games} jogos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Win Rate" value={`${p.winRate}%`} sub={`${p.wins}-${p.losses}`} accent={winRateColor(p.winRate)} />
        <StatCard label="Games" value={p.games} />
        <StatCard label="KDA" value={p.kda} />
        <StatCard label="CS/min" value={p.csPerMin} />
        <StatCard label="Dano/min" value={kStr(p.dmgPerMin)} />
      </div>

      {/* Campeões */}
      <Card className="!p-0 overflow-hidden">
        <div className="p-4"><SectionTitle>Campeões</SectionTitle></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-line">
              <th className="px-4 py-2 font-medium">Campeão</th><th className="px-3 py-2 font-medium">Games</th>
              <th className="px-3 py-2 font-medium">WR</th><th className="px-3 py-2 font-medium">KDA</th>
              <th className="px-3 py-2 font-medium">CS/m</th><th className="px-3 py-2 font-medium">Dano/m</th>
              <th className="px-3 py-2 font-medium">Trend</th>
            </tr></thead>
            <tbody>
              {p.champions.map((c) => (
                <tr key={c.champion} className="border-b border-line/60 hover:bg-bg-hover/50">
                  <td className="px-4 py-2">
                    <Link to={`/champions/${encodeURIComponent(c.champion)}`} className="flex items-center gap-2 hover:text-white">
                      <ChampIcon champion={c.champion} src={c.icon} size="xs" />
                      <span className="text-gray-200">{c.champion}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-400">{c.games} <span className="text-gray-600">({c.wins}-{c.games - c.wins})</span></td>
                  <td className="px-3 py-2"><WinRatePill value={c.winRate} /></td>
                  <td className="px-3 py-2 text-gray-200">{c.kda}</td>
                  <td className="px-3 py-2 text-gray-300">{c.csPerMin}</td>
                  <td className="px-3 py-2 text-gray-300">{kStr(c.dmgPerMin)}</td>
                  <td className={`px-3 py-2 font-bold ${trendColor(c.trend)}`}>{trendArrow(c.trend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Posições */}
      {p.byRole.length > 1 && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <SectionTitle>Distribuição por Posição</SectionTitle>
            <Donut data={p.byRole.map((r) => ({ name: r.role, value: r.games }))} />
          </Card>
          <Card>
            <SectionTitle>Win Rate por Posição</SectionTitle>
            <VBar data={p.byRole} xKey="role" yKey="winRate" domain={[0, 100]} unit="%" colorByValue={winRateColor} />
          </Card>
        </div>
      )}

      {/* Gráficos pessoais */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>KDA Temporal</SectionTitle>
          <TrendLine data={chartData} xKey="i" yKey="kda" color="#FFD700" height={200} />
        </Card>
        <Card>
          <SectionTitle>Win Rate Temporal (média móvel)</SectionTitle>
          <TrendLine data={chartData} xKey="i" yKey="wr" color="#2E94DE" domain={[0, 100]} unit="%" height={200} />
        </Card>
        <Card>
          <SectionTitle>CS/min Temporal</SectionTitle>
          <TrendLine data={chartData} xKey="i" yKey="csPerMin" color="#00D166" height={200} />
        </Card>
        <Card>
          <SectionTitle>Performance (CS/min × KDA)</SectionTitle>
          <ScatterPerf data={chartData} xKey="csPerMin" yKey="kda" xLabel="CS/min" yLabel="KDA" height={200} />
        </Card>
      </div>
    </div>
  );
}
