import { useEffect, useMemo, useState, Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMatch, addNote, deleteNote, updateMatch, refreshMatchRanks, getMeta } from '../api.js';
import { Card, SectionTitle, Spinner, ResultBadge, Badge, Tabs, EmptyState, RankBadge } from '../components/ui.jsx';
import ChampIcon from '../components/ChampIcon.jsx';
import { ItemSequence, RunesView } from '../components/Build.jsx';
import { DualArea, MultiLine, HBar, StackedBar, ScatterPerf, PALETTE, COLORS } from '../components/charts.jsx';
import { mmss, dateTime, kStr } from '../lib/format.js';

const EVENT_ICON = { kill: '⚔️', tower: '🏰', dragon: '🐉', baron: '🟣', inhibitor: '🔻' };

export default function MatchDetail() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);

  const reload = () => getMatch(id).then(setM).catch(() => setMissing(true));
  useEffect(() => {
    setM(null); setMissing(false); setEditing(false);
    getMatch(id).then(setM).catch(() => setMissing(true));
  }, [id]);

  if (missing) return <EmptyState>Partida não encontrada.</EmptyState>;
  if (!m) return <Spinner />;

  const ourBlue = m.our_side === 'blue';
  const teamLabel = (side) => (side === m.our_side ? m.teamName : m.opponent);

  return (
    <div className="space-y-5">
      <Link to="/" className="text-sm text-gray-400 hover:text-white">← Histórico</Link>

      {/* Resumo */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ResultBadge result={m.result} size="lg" />
            <div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                {mmss(m.duration_s)} · Patch {m.patch}
                {m.source === 'rofl' && <Badge color="gold">🎬 Replay</Badge>}
              </div>
              <div className="text-sm text-gray-400">
                vs {m.opponent} · {m.series_type}{m.series_label ? ` (${m.series_label})` : ''} · {dateTime(m.date)}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-end">
              <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => setEditing((v) => !v)}>
                {editing ? 'Fechar edição' : '✎ Editar partida'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20">Bans nosso:</span>
              <div className="flex gap-1">{m.bans_our.map((b) => <ChampIcon key={b} champion={b} size="xs" />)}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20">Bans deles:</span>
              <div className="flex gap-1">{m.bans_their.map((b) => <ChampIcon key={b} champion={b} size="xs" />)}</div>
            </div>
          </div>
        </div>

        {editing && <EditMatchForm match={m} onSaved={() => { setEditing(false); reload(); }} />}

        {/* Placar de objetivos */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
          <ObjStat label="Torres" our={m.towers_our} their={m.towers_their} />
          <ObjStat label="Dragões" our={m.dragons_our} their={m.dragons_their} />
          <ObjStat label="Barões" our={m.barons_our} their={m.barons_their} />
          <ObjStat label="First Blood" our={m.first_blood_side === m.our_side ? '✓' : '—'} their={m.first_blood_side !== m.our_side ? '✓' : '—'} />
          <ObjStat label="Kills" our={m.ourStats.reduce((s, p) => s + p.kills, 0)} their={m.enemyStats.reduce((s, p) => s + p.kills, 0)} />
          <ObjStat label="Ouro" our={kStr(m.ourStats.reduce((s, p) => s + p.gold, 0))} their={kStr(m.enemyStats.reduce((s, p) => s + p.gold, 0))} />
        </div>
      </Card>

      <Tabs
        tabs={[
          { id: 'overview', label: 'Composição & Stats' },
          { id: 'builds', label: 'Builds & Runas' },
          { id: 'stats', label: 'Stats' },
          { id: 'timeline', label: 'Timeline' },
          { id: 'charts', label: 'Gráficos' },
          { id: 'notes', label: `Notas (${m.notes.length})` },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="space-y-4">
          <TeamTable title={`${m.teamName} (${m.our_side})`} side={m.our_side} rows={m.ourStats} minutes={m.duration_s / 60} ours />
          <TeamTable title={`${m.opponent} (${ourBlue ? 'red' : 'blue'})`} side={ourBlue ? 'red' : 'blue'} rows={m.enemyStats} minutes={m.duration_s / 60} />
        </div>
      )}

      {tab === 'builds' && <Builds match={m} />}

      {tab === 'stats' && <Stats match={m} />}

      {tab === 'timeline' && <Timeline events={m.events} teamLabel={teamLabel} ourSide={m.our_side} source={m.source} />}

      {tab === 'charts' && <Charts match={m} />}

      {tab === 'notes' && <Notes matchId={m.id} initial={m.notes} />}
    </div>
  );
}

function EditMatchForm({ match, onSaved }) {
  const [form, setForm] = useState({
    patch: match.patch || '',
    opponent: match.opponent || '',
    series_type: match.series_type || 'Scrim',
    series_label: match.series_label || '',
    date: (match.date || '').slice(0, 10),
  });
  const [patches, setPatches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [elo, setElo] = useState({ busy: false, msg: null, err: false });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => { getMeta().then((m) => setPatches(m.patches || [])).catch(() => {}); }, []);
  // Garante que o patch atual apareça na lista mesmo se não vier do Data Dragon.
  const patchOptions = [...new Set([form.patch, ...patches].filter(Boolean))];

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await updateMatch(match.id, form);
      if (res.ok) onSaved();
      else setErr(res.reason || 'Falha ao salvar.');
    } catch (e2) {
      setErr(e2?.response?.data?.reason || 'Erro de rede.');
    } finally { setBusy(false); }
  };

  const updateElo = async () => {
    setElo({ busy: true, msg: null, err: false });
    try {
      const res = await refreshMatchRanks(match.id);
      if (res.ok) { setElo({ busy: false, msg: `Elo atualizado: ${res.ranked}/${res.checked} rankeados.`, err: false }); onSaved(); }
      else setElo({ busy: false, msg: res.reason || 'Falha ao atualizar elo.', err: true });
    } catch (e2) {
      setElo({ busy: false, msg: e2?.response?.data?.reason || 'Erro de rede.', err: true });
    }
  };

  return (
    <form onSubmit={save} className="mt-4 p-3 rounded-lg bg-bg-soft border border-brand/30 grid sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
      <label className="block"><span className="text-[10px] uppercase tracking-wide text-gray-500">Patch</span>
        <select className="input w-full mt-1" value={form.patch} onChange={set('patch')}>
          {patchOptions.length === 0 && <option value="">—</option>}
          {patchOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select></label>
      <label className="block"><span className="text-[10px] uppercase tracking-wide text-gray-500">Adversário</span>
        <input className="input w-full mt-1" value={form.opponent} onChange={set('opponent')} /></label>
      <label className="block"><span className="text-[10px] uppercase tracking-wide text-gray-500">Tipo</span>
        <select className="input w-full mt-1" value={form.series_type} onChange={set('series_type')}>
          {['Scrim', 'Oficial', 'Playoffs', 'Qualifiers', 'Ranked'].map((t) => <option key={t}>{t}</option>)}
        </select></label>
      <label className="block"><span className="text-[10px] uppercase tracking-wide text-gray-500">Rótulo (opcional)</span>
        <input className="input w-full mt-1" value={form.series_label} onChange={set('series_label')} placeholder="Semana 3 · G2" /></label>
      <label className="block"><span className="text-[10px] uppercase tracking-wide text-gray-500">Data</span>
        <input type="date" className="input w-full mt-1" value={form.date} onChange={set('date')} /></label>
      <div className="sm:col-span-2 lg:col-span-5 flex items-center gap-3 flex-wrap">
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        <button type="button" className="btn-ghost" disabled={elo.busy} onClick={updateElo}>
          {elo.busy ? 'Atualizando elo…' : '↻ Atualizar elo'}
        </button>
        {err && <span className="text-xs text-loss">{err}</span>}
        {elo.msg && <span className={`text-xs ${elo.err ? 'text-loss' : 'text-win'}`}>{elo.msg}</span>}
      </div>
    </form>
  );
}

function ObjStat({ label, our, their }) {
  return (
    <div className="bg-bg-soft rounded-lg p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm font-semibold">
        <span className="text-blueteam">{our}</span>
        <span className="text-gray-600 mx-1">·</span>
        <span className="text-redteam">{their}</span>
      </div>
    </div>
  );
}

function TeamTable({ title, side, rows, minutes, ours }) {
  const [open, setOpen] = useState(null);
  return (
    <Card className="!p-0 overflow-hidden">
      <div className={`px-4 py-2.5 font-semibold text-sm ${ours ? 'text-blueteam' : 'text-redteam'} border-b border-line`}>
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead><tr className="text-left text-[11px] uppercase text-gray-500 border-b border-line">
            <th className="px-3 py-2 font-medium">Jogador</th><th className="px-2 py-2 font-medium">Lvl</th>
            <th className="px-2 py-2 font-medium">KDA</th><th className="px-2 py-2 font-medium">KP</th>
            <th className="px-2 py-2 font-medium">CS</th><th className="px-2 py-2 font-medium">Gold</th>
            <th className="px-2 py-2 font-medium">Dano</th><th className="px-2 py-2 font-medium">Recebido</th>
            <th className="px-2 py-2 font-medium">Visão</th><th className="px-2 py-2 font-medium">CC</th>
            <th className="px-2 py-2 font-medium">Wards</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map((p) => (
              <Fragment key={p.id}>
                <tr className="border-b border-line/60 hover:bg-bg-hover/50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <ChampIcon champion={p.champion} src={p.icon} size="sm" ring={side} />
                      <div>
                        <Link to={ours ? `/players/${encodeURIComponent(p.summoner_name)}` : '#'}
                          className={ours ? 'text-gray-100 hover:text-white font-medium' : 'text-gray-300 font-medium'}>
                          {p.summoner_name}
                        </Link>
                        <div className="text-[11px] text-gray-500">
                          <Link to={`/champions/${encodeURIComponent(p.champion)}`} className="hover:text-gold">{p.champion}</Link> · {p.role}
                        </div>
                        <div className="mt-1"><RankBadge rank={p.rank} size="xs" /></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-gray-400">{p.level}</td>
                  <td className="px-2 py-2"><span className="text-gray-200">{p.kills}/{p.deaths}/{p.assists}</span> <span className="text-gray-500">({p.kda})</span></td>
                  <td className="px-2 py-2 text-gray-400">{Math.round(p.kill_participation * 100)}%</td>
                  <td className="px-2 py-2 text-gray-300">{p.cs} <span className="text-gray-600 text-xs">({p.csPerMin})</span></td>
                  <td className="px-2 py-2 text-gray-300">{kStr(p.gold)}</td>
                  <td className="px-2 py-2 text-gray-300">{kStr(p.damage_dealt)}</td>
                  <td className="px-2 py-2 text-gray-400">{kStr(p.damage_taken)}</td>
                  <td className="px-2 py-2 text-gray-400">{p.vision_score}</td>
                  <td className="px-2 py-2 text-gray-400">{p.cc_score}</td>
                  <td className="px-2 py-2 text-gray-400 text-xs">{p.wards_placed}/{p.wards_destroyed}</td>
                  <td className="px-2 py-2">
                    <button className="text-xs text-blueteam hover:underline" onClick={() => setOpen(open === p.id ? null : p.id)}>
                      {open === p.id ? '−' : 'Build'}
                    </button>
                  </td>
                </tr>
                {open === p.id && (
                  <tr className="bg-bg-soft/50">
                    <td colSpan={12} className="px-4 py-3 space-y-3">
                      <ItemSequence items={p.items} boots={p.boots} />
                      <RunesView runes={p.runes} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Builds({ match }) {
  const TeamBuilds = ({ title, rows, side, ours }) => (
    <Card className="!p-0 overflow-hidden">
      <div className={`px-4 py-2.5 font-semibold text-sm ${ours ? 'text-blueteam' : 'text-redteam'} border-b border-line`}>{title}</div>
      <div className="divide-y divide-line">
        {rows.map((p) => (
          <div key={p.id} className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ChampIcon champion={p.champion} src={p.icon} size="sm" ring={side} />
              <div>
                <Link to={`/champions/${encodeURIComponent(p.champion)}`} className="text-gray-100 font-medium hover:text-gold">{p.champion}</Link>
                <div className="text-[11px] text-gray-500">{p.summoner_name} · {p.role}</div>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Ordem de itens</div>
              {p.items?.length ? <ItemSequence items={p.items} boots={p.boots} /> : <span className="text-xs text-gray-500">Sem dados de build.</span>}
            </div>
            <RunesView runes={p.runes} />
          </div>
        ))}
      </div>
    </Card>
  );
  const ourBlue = match.our_side === 'blue';
  return (
    <div className="space-y-4">
      <TeamBuilds title={`${match.teamName} (${match.our_side})`} side={match.our_side} rows={match.ourStats} ours />
      <TeamBuilds title={`${match.opponent} (${ourBlue ? 'red' : 'blue'})`} side={ourBlue ? 'red' : 'blue'} rows={match.enemyStats} />
    </div>
  );
}

function describeEvent(e, teamLabel) {
  const team = teamLabel(e.side);
  const d = e.details || {};
  switch (e.event_type) {
    case 'kill':
      if (d.firstBlood) return `First Blood para ${team}`;
      return `${d.killer?.name} (${d.killer?.champion}) matou ${d.victim?.name} (${d.victim?.champion})` +
        (d.assists?.length ? ` [assist: ${d.assists.map((a) => a.champion).join(', ')}]` : '');
    case 'tower': return `${team} destruiu Torre Tier ${d.tier} (${d.lane})`;
    case 'dragon': return `${team} conquistou Dragão ${d.type}`;
    case 'baron': return `${team} conquistou Baron Nashor`;
    case 'inhibitor': return `${team} destruiu Inibidor (${d.lane})`;
    default: return e.event_type;
  }
}

function Timeline({ events, teamLabel, ourSide, source }) {
  if (!events.length) {
    return (
      <EmptyState>
        {source === 'rofl'
          ? 'Partidas importadas de replay (.rofl) não contêm timeline — apenas as estatísticas de fim de jogo.'
          : 'Sem eventos de timeline para esta partida.'}
      </EmptyState>
    );
  }
  return (
    <Card>
      <SectionTitle>Linha do Tempo ({events.length} eventos)</SectionTitle>
      <ol className="relative border-l border-line ml-3 space-y-1">
        {events.map((e) => (
          <li key={e.id} className="ml-4 py-1.5">
            <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-bg"
              style={{ backgroundColor: e.side === ourSide ? '#2E94DE' : '#D04040' }} />
            <div className="flex items-baseline gap-3">
              <span className="text-xs font-mono text-gray-500 w-12 shrink-0">{mmss(e.timestamp_s)}</span>
              <span className="text-sm">{EVENT_ICON[e.event_type]} </span>
              <span className="text-sm text-gray-300">{describeEvent(e, teamLabel)}</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// Aba Stats — status individual dos 10 jogadores em gráficos próprios, derivados
// só dos totais de fim de jogo (independem da timeline → funcionam para .rofl).
function Stats({ match }) {
  const all = [...match.ourStats, ...match.enemyStats];
  // Rótulo "Campeão (Nick)" para deixar claro de quem é cada dado nos gráficos.
  const label = (p) => `${p.champion} (${p.summoner_name})`;

  const byDmg = [...all].sort((a, b) => b.damage_dealt - a.damage_dealt).map((p) => ({ name: label(p), value: p.damage_dealt }));
  const byTaken = [...all].sort((a, b) => b.damage_taken - a.damage_taken).map((p) => ({ name: label(p), value: p.damage_taken }));
  const byGold = [...all].sort((a, b) => b.gold - a.gold).map((p) => ({ name: label(p), value: p.gold }));
  const byVision = [...all].sort((a, b) => b.vision_score - a.vision_score).map((p) => ({ name: label(p), value: p.vision_score }));
  const byCC = [...all].sort((a, b) => b.cc_score - a.cc_score).map((p) => ({ name: label(p), value: p.cc_score }));
  const scatter = all.map((p) => ({ name: label(p), dealt: p.damage_dealt, taken: p.damage_taken }));

  const comp = all.map((p) => ({ name: label(p), fis: p.damage_physical || 0, mag: p.damage_magic || 0, ver: p.damage_true || 0 }));
  const hasComp = comp.some((c) => c.fis + c.mag + c.ver > 0);
  const compSeries = [
    { key: 'fis', name: 'Físico', color: '#F59E0B' },
    { key: 'mag', name: 'Mágico', color: '#22D3EE' },
    { key: 'ver', name: 'Verdadeiro', color: '#E5E7EB' },
  ];

  // Utilidade: cura em aliados + escudo em aliados (empilhado).
  const util = [...all]
    .map((p) => ({ name: label(p), cura: p.heals_teammates || 0, escudo: p.shielding || 0 }))
    .sort((a, b) => (b.cura + b.escudo) - (a.cura + a.escudo));
  const hasUtil = util.some((u) => u.cura + u.escudo > 0);
  const utilSeries = [
    { key: 'cura', name: 'Cura em aliados', color: '#25b567' },
    { key: 'escudo', name: 'Escudo em aliados', color: '#5b8dff' },
  ];

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <SectionTitle>Dano a campeões por jogador</SectionTitle>
        <HBar data={byDmg} labelKey="name" valueKey="value" color={COLORS.red} height={340} />
      </Card>
      <Card>
        <SectionTitle>Composição de dano</SectionTitle>
        {hasComp
          ? <StackedBar data={comp} xKey="name" series={compSeries} height={340} />
          : <EmptyState>Composição de dano indisponível (partida importada antes desta atualização).</EmptyState>}
      </Card>
      <Card>
        <SectionTitle>Dano recebido por jogador</SectionTitle>
        <HBar data={byTaken} labelKey="name" valueKey="value" color="#F59E0B" height={340} />
      </Card>
      <Card>
        <SectionTitle right={<span className="text-xs text-gray-500">rótulo = Campeão (Nick)</span>}>Dano causado vs. recebido</SectionTitle>
        <ScatterPerf data={scatter} xKey="dealt" yKey="taken" labelKey="name" xLabel="Dano causado" yLabel="Dano recebido" height={360} color="#b026ff" />
      </Card>
      <Card>
        <SectionTitle>Ouro por jogador</SectionTitle>
        <HBar data={byGold} labelKey="name" valueKey="value" color={COLORS.gold} height={340} />
      </Card>
      <Card>
        <SectionTitle>Controle de visão (vision score)</SectionTitle>
        <HBar data={byVision} labelKey="name" valueKey="value" color={COLORS.blue} height={340} />
      </Card>
      <Card>
        <SectionTitle>Cura + Escudo em aliados</SectionTitle>
        {hasUtil
          ? <StackedBar data={util} xKey="name" series={utilSeries} height={340} />
          : <EmptyState>Sem dados de cura/escudo em aliados nesta partida (comum em .rofl antigos).</EmptyState>}
      </Card>
      <Card>
        <SectionTitle>Controle de grupo (CC, em segundos)</SectionTitle>
        <HBar data={byCC} labelKey="name" valueKey="value" color="#A78BFA" height={340} unit="s" />
      </Card>
    </div>
  );
}

function Charts({ match }) {
  if (!match.frames?.length) {
    return (
      <EmptyState>
        {match.source === 'rofl'
          ? 'Gráficos de evolução exigem timeline, que replays (.rofl) não fornecem.'
          : 'Sem dados de evolução para esta partida.'}
      </EmptyState>
    );
  }
  const ourBlue = match.our_side === 'blue';
  const goldData = match.frames.map((f) => ({ minute: f.minute, blue: f.blue_gold, red: f.red_gold }));
  const killData = match.frames.map((f) => ({ minute: f.minute, blue: f.blue_kills, red: f.red_kills }));
  const players = match.ourStats.map((s) => s.summoner_name);
  const levelData = match.frames.map((f) => ({ minute: f.minute, ...Object.fromEntries(players.map((n) => [n, f.players[n]?.level])) }));
  const csData = match.frames.map((f) => ({ minute: f.minute, ...Object.fromEntries(players.map((n) => [n, f.players[n]?.cs])) }));
  const playerSeries = players.map((n, i) => ({ key: n, name: n, color: PALETTE[i % PALETTE.length] }));

  const goldSeries = [
    { key: 'blue', name: ourBlue ? `${match.teamName} (azul)` : `${match.opponent} (azul)`, color: '#2E94DE' },
    { key: 'red', name: ourBlue ? `${match.opponent} (vermelho)` : `${match.teamName} (vermelho)`, color: '#D04040' },
  ];

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <SectionTitle>Evolução de Ouro</SectionTitle>
        <DualArea data={goldData} xKey="minute" series={goldSeries} />
      </Card>
      <Card>
        <SectionTitle>Evolução de Kills</SectionTitle>
        <MultiLine data={killData} xKey="minute" series={goldSeries} unit="m" />
      </Card>
      <Card>
        <SectionTitle>Evolução de Níveis (nosso time)</SectionTitle>
        <MultiLine data={levelData} xKey="minute" series={playerSeries} unit="m" />
      </Card>
      <Card>
        <SectionTitle>Evolução de CS (nosso time)</SectionTitle>
        <MultiLine data={csData} xKey="minute" series={playerSeries} unit="m" />
      </Card>
    </div>
  );
}

function Notes({ matchId, initial }) {
  const [notes, setNotes] = useState(initial);
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    const tagArr = tags.split(',').map((t) => t.trim()).filter(Boolean);
    const note = await addNote(matchId, { body, tags: tagArr });
    setNotes([note, ...notes]);
    setBody(''); setTags(''); setSaving(false);
  };

  const remove = async (noteId) => {
    await deleteNote(matchId, noteId);
    setNotes(notes.filter((n) => n.id !== noteId));
  };

  return (
    <Card>
      <SectionTitle>Notas do Coach</SectionTitle>
      <form onSubmit={submit} className="space-y-2 mb-4">
        <textarea className="input w-full min-h-[70px]" placeholder="Adicionar análise (ex.: bom macro, erro no Baron)…"
          value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <input className="input grow" placeholder="Tags separadas por vírgula" value={tags} onChange={(e) => setTags(e.target.value)} />
          <button className="btn-primary" disabled={saving || !body.trim()}>{saving ? 'Salvando…' : 'Adicionar nota'}</button>
        </div>
      </form>
      {notes.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma nota ainda.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="p-3 rounded-lg bg-bg-soft">
              <div className="flex justify-between items-start gap-3">
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{n.body}</p>
                <button className="text-xs text-loss hover:underline shrink-0" onClick={() => remove(n.id)}>remover</button>
              </div>
              {n.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">{n.tags.map((t) => <Badge key={t} color="blue">{t}</Badge>)}</div>
              )}
              <div className="text-[11px] text-gray-600 mt-1">{n.created_at}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
