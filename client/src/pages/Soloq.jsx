import { useEffect, useState } from 'react';
import { getSoloq, getSoloqPlayer } from '../api.js';
import { Card, SectionTitle, Spinner, WinRatePill, Modal, ResultBadge, RankBadge } from '../components/ui.jsx';
import ChampIcon from '../components/ChampIcon.jsx';
import { TrendLine } from '../components/charts.jsx';
import { ROLE_ICON } from '../lib/champ.js';
import { shortDate, winRateColor, rankColor } from '../lib/format.js';

export default function Soloq() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(null);

  const load = (force) => {
    setBusy(true);
    getSoloq(force ? { force: 1 } : {}).then(setData).finally(() => setBusy(false));
  };
  useEffect(() => { load(false); }, []);

  if (!data) return <Spinner label="Buscando SoloQ na Riot…" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white text-glow">SoloQ · Tenebra Leviathan</h1>
          <p className="text-sm text-gray-400">Ranqueada Solo/Duo dos jogadores — campeões mais jogados, win rate e histórico.</p>
        </div>
        <button className="btn-ghost" disabled={busy} onClick={() => load(true)}>
          {busy ? 'Atualizando…' : '↻ Atualizar'}
        </button>
      </div>

      {!data.keyPresent && (
        <Card className="border-loss/40">
          <p className="text-sm text-loss font-medium">RIOT_API_KEY não configurada.</p>
          <p className="text-xs text-gray-400 mt-1">
            Cole uma chave válida (developer.riotgames.com) no arquivo <code className="text-brand-glow">.env</code> da raiz
            e reinicie o servidor. Chaves de desenvolvimento expiram a cada 24h.
          </p>
        </Card>
      )}

      <EloLadder players={data.players} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.players.map((p) => (
          <PlayerCard key={p.name} p={p} onOpen={() => p.ok && p.games > 0 && setSel(p.name)} />
        ))}
      </div>

      <PlayerModal name={sel} onClose={() => setSel(null)} />
    </div>
  );
}

function EloLadder({ players }) {
  const ranked = players.filter((p) => p.rank && p.ladder > 0).sort((a, b) => b.ladder - a.ladder);
  if (!ranked.length) return null;
  const max = Math.max(...ranked.map((p) => p.ladder));
  return (
    <Card>
      <SectionTitle right={<span className="text-xs text-gray-500">Solo/Duo</span>}>Elo do time</SectionTitle>
      <div className="space-y-2">
        {ranked.map((p) => {
          const color = rankColor(p.rank.tier);
          return (
            <div key={p.name} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-gray-200 truncate">{p.name}</div>
              <div className="flex-1 h-6 rounded-md bg-bg-soft overflow-hidden relative">
                <div className="h-full rounded-md" style={{ width: `${Math.max(8, (p.ladder / max) * 100)}%`, backgroundColor: `${color}55`, borderRight: `2px solid ${color}` }} />
                <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold" style={{ color }}>{p.rankLabel}</span>
              </div>
              <div className="w-16 shrink-0 text-right text-xs text-gray-500">{p.wins}-{p.losses}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PlayerCard({ p, onOpen }) {
  const clickable = p.ok && p.games > 0;
  return (
    <div onClick={onOpen}
      className={`card p-4 ${clickable ? 'card-hover' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-lg font-bold text-white truncate">{p.name}</div>
          <div className="text-xs text-gray-500">#{p.tag} · {ROLE_ICON[p.role]} {p.role}</div>
          <div className="mt-1.5"><RankBadge rank={p.rank} /></div>
        </div>
        {clickable && (
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold"><WinRatePill value={p.winRate} /></div>
            <div className="text-xs text-gray-500">{p.wins}-{p.losses} · {p.games}j</div>
          </div>
        )}
      </div>

      {!p.ok ? (
        <div className="mt-3 text-xs text-loss">{p.reason || 'Falha ao carregar.'}</div>
      ) : p.games === 0 ? (
        <div className="mt-3 text-xs text-gray-500">Sem partidas de SoloQ recentes.</div>
      ) : (
        <>
          <div className="flex gap-4 mt-3 text-sm text-gray-300">
            <span>KDA <b className="text-gray-100">{p.kda}</b></span>
            <span>CS/m <b className="text-gray-100">{p.csPerMin}</b></span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {p.topChampions.map((c) => (
              <div key={c.champion} className="flex items-center gap-1.5 bg-bg-soft rounded-lg px-1.5 py-1">
                <ChampIcon champion={c.champion} src={c.icon} size="xs" />
                <span className="text-[11px] font-semibold" style={{ color: winRateColor(c.winRate) }}>{c.winRate}%</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-1">
            {p.recent.map((g, i) => (
              <span key={i} title={g.champion}
                className={`h-2.5 w-2.5 rounded-full ${g.win ? 'bg-win' : 'bg-loss'}`} />
            ))}
            <span className="ml-1 text-[10px] text-gray-600">últimos jogos</span>
          </div>
        </>
      )}
    </div>
  );
}

function PlayerModal({ name, onClose }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    if (!name) { setD(null); return; }
    setD(null);
    getSoloqPlayer(name, { count: 25 }).then(setD);
  }, [name]);

  if (!name) return null;
  return (
    <Modal open={!!name} onClose={onClose} width="max-w-3xl"
      title={<span>{name} <span className="text-gray-500 text-sm">· SoloQ</span></span>}>
      {!d ? <Spinner label="Carregando…" /> : !d.ok ? (
        <div className="text-sm text-loss">{d.reason || 'Falha ao carregar.'}</div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <RankBadge rank={d.rank} />
            <span className="text-xs text-gray-500">elo Solo/Duo atual</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Win Rate" value={`${d.winRate}%`} accent={winRateColor(d.winRate)} sub={`${d.wins}-${d.losses}`} />
            <Stat label="Partidas" value={d.games} />
            <Stat label="KDA" value={d.kda} sub={`${d.kills}/${d.deaths}/${d.assists}`} />
            <Stat label="CS/min" value={d.csPerMin} />
          </div>

          <EloProgression snapshots={d.snapshots} />

          <div>
            <SectionTitle>Campeões mais jogados</SectionTitle>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-line">
                <th className="py-2 font-medium">Campeão</th><th className="py-2 font-medium">Jogos</th>
                <th className="py-2 font-medium">WR</th><th className="py-2 font-medium">KDA</th><th className="py-2 font-medium">CS/m</th>
              </tr></thead>
              <tbody>
                {d.champions.map((c) => (
                  <tr key={c.champion} className="border-b border-line/60">
                    <td className="py-2"><div className="flex items-center gap-2">
                      <ChampIcon champion={c.champion} src={c.icon} size="xs" /><span className="text-gray-200">{c.champion}</span>
                    </div></td>
                    <td className="py-2 text-gray-400">{c.wins}-{c.losses}</td>
                    <td className="py-2"><WinRatePill value={c.winRate} /></td>
                    <td className="py-2 text-gray-300">{c.kda}</td>
                    <td className="py-2 text-gray-400">{c.csPerMin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <SectionTitle right={<span className="text-xs text-gray-500">apenas Ranqueada Solo/Duo (420)</span>}>Histórico ({d.history.length})</SectionTitle>
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
              {d.history.map((g) => (
                <div key={g.matchId} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-bg-soft">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ResultBadge result={g.win ? 'win' : 'loss'} />
                    <ChampIcon champion={g.champion} src={g.icon} size="xs" />
                    <div className="min-w-0">
                      <div className="text-sm text-gray-200 truncate">{g.champion} <span className="text-gray-500">· {g.role}</span></div>
                      <div className="text-[11px] text-gray-500">{shortDate(g.date)}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-sm">
                    <div className="text-gray-200">{g.kills}/{g.deaths}/{g.assists} <span className="text-gray-500">({g.kda})</span></div>
                    <div className="text-[11px] text-gray-500">{g.cs} cs · {g.csPerMin}/m</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EloProgression({ snapshots }) {
  const data = (snapshots || []).map((s, i) => ({ i: i + 1, ladder: s.ladder, label: s.label, date: s.taken_at }));
  return (
    <div>
      <SectionTitle right={<span className="text-xs text-gray-500">construído a cada atualização</span>}>Progressão de Elo</SectionTitle>
      {data.length < 2 ? (
        <p className="text-sm text-gray-500">
          {data.length === 1
            ? `Primeiro registro salvo (${data[0].label}). O gráfico de progressão aparece quando houver ao menos duas medições — atualize a SoloQ de tempos em tempos.`
            : 'Ainda sem histórico de elo. Atualize a SoloQ para começar a registrar.'}
        </p>
      ) : (
        <TrendLine data={data} xKey="i" yKey="ladder" color="#b026ff" height={200} />
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  return (
    <div className="card p-3 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-xl font-bold" style={accent ? { color: accent } : undefined}>{value}</span>
      {sub && <span className="text-[11px] text-gray-500">{sub}</span>}
    </div>
  );
}
