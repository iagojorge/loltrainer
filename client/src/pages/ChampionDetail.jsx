import { useEffect, useMemo, useState, Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getChampion } from '../api.js';
import { Card, SectionTitle, StatCard, Spinner, ResultBadge, WinRatePill, EmptyState } from '../components/ui.jsx';
import ChampIcon from '../components/ChampIcon.jsx';
import { ItemSequence, RunesView } from '../components/Build.jsx';
import { TrendLine, ScatterPerf, VBar } from '../components/charts.jsx';
import { shortDate, mmss, winRateColor, winRateBg, kStr } from '../lib/format.js';

export default function ChampionDetail() {
  const { name } = useParams();
  const [c, setC] = useState(null);
  const [missing, setMissing] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setC(null); setMissing(false);
    getChampion(name).then(setC).catch(() => setMissing(true));
  }, [name]);

  const chartData = useMemo(() => {
    if (!c) return [];
    return c.timeSeries.map((t, i) => ({
      i: i + 1, date: shortDate(t.date), wr: c.winSeries[i], kda: t.kda, csPerMin: t.csPerMin,
    }));
  }, [c]);

  if (missing) return <EmptyState>Campeão “{name}” não possui partidas registradas.</EmptyState>;
  if (!c) return <Spinner />;

  return (
    <div className="space-y-6">
      <Link to="/champions" className="text-sm text-gray-400 hover:text-white">← Campeões</Link>

      <div className="flex items-center gap-4">
        <ChampIcon champion={c.champion} src={c.icon} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-white">{c.champion}</h1>
          <p className="text-sm text-gray-400">{c.roles.join(', ')} · {c.games} jogos</p>
        </div>
      </div>

      {/* Cards agregados */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Games" value={c.games} sub={`${c.wins}-${c.losses}`} />
        <StatCard label="Win Rate" value={`${c.winRate}%`} accent={winRateColor(c.winRate)} />
        <StatCard label="KDA" value={c.kda} sub={`${c.kills}/${c.deaths}/${c.assists}`} />
        <StatCard label="CS/min" value={c.csPerMin} />
        <StatCard label="Dano/min" value={kStr(c.dmgPerMin)} />
        <StatCard label="Ouro/min" value={c.goldPerMin} />
        <StatCard label="Participação" value={`${c.killParticipation}%`} />
      </div>

      {/* WR por patch */}
      {c.byPatch.length > 0 && (
        <Card>
          <SectionTitle>Win Rate por Patch</SectionTitle>
          <VBar data={c.byPatch} xKey="patch" yKey="winRate" domain={[0, 100]} unit="%" colorByValue={winRateColor} height={200} />
        </Card>
      )}

      {/* Matchups heatmap */}
      <Card>
        <SectionTitle right={<span className="text-xs text-gray-500">verde &gt;60% · amarelo 40-60% · vermelho &lt;40%</span>}>
          Matchups (vs campeão inimigo na mesma lane)
        </SectionTitle>
        {c.matchups.length === 0 ? <p className="text-sm text-gray-500">Sem dados de matchup.</p> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {c.matchups.map((m) => (
              <Link key={m.enemy} to={`/champions/${encodeURIComponent(m.enemy)}`}
                className="flex items-center gap-2 p-2 rounded-lg border border-line hover:brightness-110 transition"
                style={{ backgroundColor: winRateBg(m.winRate) }}>
                <ChampIcon champion={m.enemy} src={m.icon} size="xs" />
                <div className="min-w-0">
                  <div className="text-xs text-gray-200 truncate">{m.enemy}</div>
                  <div className="text-[11px]" style={{ color: winRateColor(m.winRate) }}>
                    {m.wins}-{m.losses} · {m.winRate}%
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <SectionTitle>Win Rate Temporal</SectionTitle>
          <TrendLine data={chartData} xKey="i" yKey="wr" color="#2E94DE" domain={[0, 100]} unit="%" height={200} />
        </Card>
        <Card>
          <SectionTitle>KDA por Partida</SectionTitle>
          <ScatterPerf data={chartData} xKey="csPerMin" yKey="kda" xLabel="CS/min" yLabel="KDA" height={200} />
        </Card>
        <Card>
          <SectionTitle>CS/min Temporal</SectionTitle>
          <TrendLine data={chartData} xKey="i" yKey="csPerMin" color="#00D166" height={200} />
        </Card>
      </div>

      {/* Builds mais comuns */}
      {c.builds.length > 0 && (
        <Card>
          <SectionTitle>Builds Mais Comuns</SectionTitle>
          <div className="space-y-3">
            {c.builds.map((b, i) => (
              <div key={i} className="p-3 rounded-lg bg-bg-soft">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{b.games} jogo(s)</span>
                  <WinRatePill value={b.winRate} />
                </div>
                <ItemSequence items={b.build} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabela de partidas */}
      <Card className="!p-0 overflow-hidden">
        <div className="p-4"><SectionTitle>Partidas com {c.champion}</SectionTitle></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-line">
              <th className="px-3 py-2 font-medium">Data</th><th className="px-3 py-2 font-medium">vs</th>
              <th className="px-3 py-2 font-medium">Res.</th><th className="px-3 py-2 font-medium">Por</th>
              <th className="px-3 py-2 font-medium">KDA</th><th className="px-3 py-2 font-medium">CS</th>
              <th className="px-3 py-2 font-medium">CS/m</th><th className="px-3 py-2 font-medium">Dano</th>
              <th className="px-3 py-2 font-medium">Dur</th><th className="px-3 py-2 font-medium">Patch</th><th></th>
            </tr></thead>
            <tbody>
              {c.matches.map((m) => (
                <Fragment key={m.id}>
                  <tr className="border-b border-line/60 hover:bg-bg-hover/50">
                    <td className="px-3 py-2"><Link to={`/matches/${m.id}`} className="text-gray-300 hover:text-white">{shortDate(m.date)}</Link></td>
                    <td className="px-3 py-2">
                      {m.vsChampion ? (
                        <Link to={`/champions/${encodeURIComponent(m.vsChampion)}`} className="flex items-center gap-1.5 text-gray-300 hover:text-white" title={`vs ${m.vsChampion} (${m.role})`}>
                          <ChampIcon champion={m.vsChampion} src={m.vsIcon} size="xs" />
                          <span className="text-xs truncate max-w-[90px]">{m.vsChampion}</span>
                        </Link>
                      ) : <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-3 py-2"><ResultBadge result={m.result} /></td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{m.summoner}</td>
                    <td className="px-3 py-2 text-gray-200">{m.kills}/{m.deaths}/{m.assists} <span className="text-gray-500">({m.kda})</span></td>
                    <td className="px-3 py-2 text-gray-300">{m.cs}</td>
                    <td className="px-3 py-2 text-gray-300">{m.csPerMin}</td>
                    <td className="px-3 py-2 text-gray-300">{kStr(m.damage)}</td>
                    <td className="px-3 py-2 text-gray-400">{mmss(m.duration_s)}</td>
                    <td className="px-3 py-2 text-gray-400">{m.patch}</td>
                    <td className="px-3 py-2">
                      <button className="text-xs text-brand-glow hover:underline" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                        {expanded === m.id ? 'Fechar' : 'Build'}
                      </button>
                    </td>
                  </tr>
                  {expanded === m.id && (
                    <tr className="bg-bg-soft/50">
                      <td colSpan={11} className="px-3 py-3 space-y-3">
                        <ItemSequence items={m.items} boots={m.boots} />
                        <RunesView runes={m.runes} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
