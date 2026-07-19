import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../api.js';
import { Card, SectionTitle, StatCard, Spinner, WinRatePill, Modal, ResultBadge } from '../components/ui.jsx';
import WinLossStreak from '../components/WinLossStreak.jsx';
import ChampIcon from '../components/ChampIcon.jsx';
import { VBar, TrendLine, HBar } from '../components/charts.jsx';
import { mmss, winRateColor, shortDate } from '../lib/format.js';

export default function TeamDashboard() {
  const [d, setD] = useState(null);
  const [comp, setComp] = useState(null); // composição selecionada (modal)
  useEffect(() => { getDashboard().then(setD); }, []);
  if (!d) return <Spinner />;

  const s = d.summary;
  const trendUp = s.trendDelta >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">{s.teamName} — Visão Executiva</h1>
        <p className="text-sm text-gray-400">Resumo de desempenho competitivo sobre {s.games} partidas.</p>
      </div>

      {/* Cards resumidos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Win Rate" value={`${s.winRate}%`} sub={`${s.record}`} accent={winRateColor(s.winRate)} />
        <StatCard label="Patch Atual" value={s.currentPatch} />
        <StatCard label="Séries (PO/Quali)" value={s.seriesRecord} />
        <StatCard label="Duração Média" value={mmss(s.avgDuration)} />
        <StatCard label="KDA Médio" value={s.avgKda} />
        <StatCard label="Tendência (10j)" value={`${trendUp ? '↑ +' : '↓ '}${s.trendDelta}%`} accent={trendUp ? '#00D166' : '#FF5252'} />
      </div>

      {/* Streak + tendência */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <SectionTitle>Últimas 15 partidas</SectionTitle>
          <WinLossStreak results={s.recentResults} />
          <p className="text-xs text-gray-500 mt-3">Clique em cada resultado para abrir a partida.</p>
        </Card>
        <Card className="lg:col-span-2">
          <SectionTitle>Tendência de Win Rate (média móvel 5)</SectionTitle>
          <TrendLine data={s.winRateTrend} xKey="index" yKey="winRate" color="#b026ff" domain={[0, 100]} unit="%" height={200} />
        </Card>
      </div>

      {/* Insights automáticos */}
      {d.insights?.length > 0 && (
        <Card>
          <SectionTitle>Relatórios Automáticos</SectionTitle>
          <ul className="space-y-1.5">
            {d.insights.map((i, idx) => (
              <li key={idx} className="text-sm text-gray-300 flex gap-2">
                <span className="text-gold">▸</span>{i}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Campeões */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Campeões Mais Jogados</SectionTitle>
          <ChampTable rows={d.topPlayed} />
        </Card>
        <Card>
          <SectionTitle>Melhores Win Rates (mín. 3 jogos)</SectionTitle>
          <ChampTable rows={d.bestWinRate} showPick />
        </Card>
      </div>

      {/* Posição + jogadores */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Desempenho por Posição</SectionTitle>
          <VBar data={d.positions} xKey="role" yKey="winRate" domain={[0, 100]} unit="%" colorByValue={winRateColor} />
        </Card>
        <Card>
          <SectionTitle>Ranking de Jogadores (KDA)</SectionTitle>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-line">
              <th className="py-2 font-medium">Jogador</th><th className="py-2 font-medium">Role</th>
              <th className="py-2 font-medium">KDA</th><th className="py-2 font-medium">WR</th><th className="py-2 font-medium">CS/m</th>
            </tr></thead>
            <tbody>
              {d.players.map((p) => (
                <tr key={p.name} className="border-b border-line/60">
                  <td className="py-2"><Link to={`/players/${encodeURIComponent(p.name)}`} className="text-brand-glow hover:underline font-medium">{p.name}</Link></td>
                  <td className="py-2 text-gray-400">{p.role}</td>
                  <td className="py-2 text-gray-200 font-semibold">{p.kda}</td>
                  <td className="py-2"><WinRatePill value={p.winRate} /></td>
                  <td className="py-2 text-gray-300">{p.csPerMin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Timing + patch */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Early vs Mid vs Late Game</SectionTitle>
          <VBar data={d.earlyVsLate} xKey="bucket" yKey="winRate" domain={[0, 100]} unit="%" colorByValue={winRateColor} />
        </Card>
        <Card>
          <SectionTitle>Win Rate por Patch</SectionTitle>
          <VBar data={d.byPatch} xKey="patch" yKey="winRate" domain={[0, 100]} unit="%" colorByValue={winRateColor} />
        </Card>
      </div>

      {/* Composições + duplas */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle right={<span className="text-xs text-gray-500">clique para ver contra o que jogaram</span>}>Composições Vencedoras</SectionTitle>
          <div className="space-y-2">
            {d.compositions.map((c, i) => (
              <button key={i} onClick={() => setComp(c)}
                className="w-full flex items-center justify-between gap-2 p-2 rounded-lg bg-bg-soft border border-transparent hover:border-brand/40 hover:bg-bg-hover transition-colors text-left">
                <div className="flex items-center gap-1">
                  {c.champs.map((ch) => <ChampIcon key={ch.role} champion={ch.champion} src={ch.icon} size="xs" />)}
                </div>
                <span className="text-sm whitespace-nowrap">
                  <span className="text-gray-300">{c.wins}-{c.games - c.wins}</span>
                  <span className="ml-2 font-semibold" style={{ color: winRateColor(c.winRate) }}>{c.winRate}%</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle>Correlação de Campeões (duplas)</SectionTitle>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-line">
              <th className="py-2 font-medium">Dupla</th><th className="py-2 font-medium">Jogos</th><th className="py-2 font-medium">WR</th>
            </tr></thead>
            <tbody>
              {d.pairs.map((p, i) => (
                <tr key={i} className="border-b border-line/60">
                  <td className="py-2 text-gray-300">{p.pair.join(' + ')}</td>
                  <td className="py-2 text-gray-400">{p.wins}-{p.games - p.wins}</td>
                  <td className="py-2"><WinRatePill value={p.winRate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Adversários */}
      <Card>
        <SectionTitle>Matchups por Adversário</SectionTitle>
        <HBar data={[...d.opponents].sort((a, b) => b.winRate - a.winRate).map((o) => ({ ...o, label: o.opponent }))}
          labelKey="label" valueKey="winRate" unit="%" height={Math.max(180, d.opponents.length * 36)} />
      </Card>

      <CompositionModal comp={comp} onClose={() => setComp(null)} />
    </div>
  );
}

function CompositionModal({ comp, onClose }) {
  if (!comp) return null;
  return (
    <Modal open={!!comp} onClose={onClose} width="max-w-3xl"
      title={<span>Nossa composição · {comp.wins}-{comp.games - comp.wins} · <span style={{ color: winRateColor(comp.winRate) }}>{comp.winRate}%</span></span>}>
      <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-bg-soft">
        {comp.champs.map((ch) => (
          <div key={ch.role} className="flex flex-col items-center gap-1">
            <ChampIcon champion={ch.champion} src={ch.icon} size="sm" />
            <span className="text-[10px] uppercase text-gray-500">{ch.role}</span>
          </div>
        ))}
      </div>
      <h4 className="text-sm font-semibold text-gray-300 mb-2">Contra o que jogaram ({comp.matches.length})</h4>
      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        {comp.matches.map((m) => (
          <Link key={m.id} to={`/matches/${m.id}`} onClick={onClose}
            className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-bg-soft border border-line hover:border-brand/40 hover:bg-bg-hover transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <ResultBadge result={m.result} />
              <div className="min-w-0">
                <div className="text-sm text-white truncate font-medium">{m.opponent}</div>
                <div className="text-[11px] text-gray-500">{shortDate(m.date)} · {m.patch} · {mmss(m.duration_s)}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {m.enemyChamps.map((ch) => <ChampIcon key={ch.role} champion={ch.champion} src={ch.icon} size="xs" ring="red" />)}
            </div>
          </Link>
        ))}
      </div>
    </Modal>
  );
}

function ChampTable({ rows, showPick }) {
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-line">
        <th className="py-2 font-medium">Campeão</th><th className="py-2 font-medium">Jogos</th>
        <th className="py-2 font-medium">WR</th><th className="py-2 font-medium">KDA</th>
        {showPick && <th className="py-2 font-medium">Pick</th>}
      </tr></thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.champion} className="border-b border-line/60">
            <td className="py-2">
              <Link to={`/champions/${encodeURIComponent(c.champion)}`} className="flex items-center gap-2 hover:text-white">
                <ChampIcon champion={c.champion} src={c.icon} size="xs" />
                <span className="text-gray-200">{c.champion}</span>
              </Link>
            </td>
            <td className="py-2 text-gray-400">{c.games}</td>
            <td className="py-2"><WinRatePill value={c.winRate} /></td>
            <td className="py-2 text-gray-300">{c.kda}</td>
            {showPick && <td className="py-2 text-gray-400">{c.pickRate}%</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
