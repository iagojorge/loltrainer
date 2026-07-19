import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { importMatch, getRiotHistory, previewRofl, confirmRofl } from '../api.js';
import { Card, SectionTitle, ResultBadge, Spinner, Tabs } from '../components/ui.jsx';
import ChampIcon from '../components/ChampIcon.jsx';
import { mmss, shortDate } from '../lib/format.js';

// Plataformas regionais da Riot (prefixo do Match ID).
const PLATFORMS = [
  { v: 'br1', l: 'BR (Brasil)' },
  { v: 'na1', l: 'NA (Norte-América)' },
  { v: 'la1', l: 'LAN (Lat. Norte)' },
  { v: 'la2', l: 'LAS (Lat. Sul)' },
  { v: 'euw1', l: 'EUW (Europa Oeste)' },
  { v: 'eune1', l: 'EUNE (Europa Nórdica)' },
  { v: 'kr', l: 'KR (Coreia)' },
  { v: 'jp1', l: 'JP (Japão)' },
  { v: 'oc1', l: 'OCE (Oceania)' },
  { v: 'tr1', l: 'TR (Turquia)' },
];

const SERIES = ['Scrim', 'Regular Season', 'Playoffs', 'Qualifiers'];

const QUEUES = {
  0: 'Personalizada', 400: 'Normal Draft', 420: 'Ranqueada Solo/Duo', 430: 'Normal Blind',
  440: 'Ranqueada Flex', 450: 'ARAM', 490: 'Quickplay', 700: 'Clash', 720: 'Clash ARAM',
  900: 'URF', 1700: 'Arena',
};
const queueName = (q) => QUEUES[q] || (q ? `Fila ${q}` : '—');

export default function ImportMatch() {
  const [tab, setTab] = useState('player');
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Link to="/" className="text-sm text-gray-400 hover:text-white">← Histórico</Link>
      <Card>
        <SectionTitle>Importar Partida (Riot API)</SectionTitle>
        <Tabs
          tabs={[
            { id: 'player', label: 'Buscar por jogador' },
            { id: 'manual', label: 'Match ID / gameId direto' },
            { id: 'rofl', label: 'Replay (.ROFL)' },
          ]}
          active={tab}
          onChange={setTab}
        />
        {tab === 'player' && <PlayerSearch />}
        {tab === 'manual' && <ManualImport />}
        {tab === 'rofl' && <RoflImport />}
      </Card>
    </div>
  );
}

// ---------- Modo 1: buscar histórico por Riot ID ----------
function PlayerSearch() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ gameName: '', tagLine: '', platform: 'br1', count: 10 });
  const [meta, setMeta] = useState({ opponent: '', series_type: 'Scrim', series_label: '' });
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: false, error: null });
  const [importingId, setImportingId] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setM = (k) => (e) => setMeta((m) => ({ ...m, [k]: e.target.value }));

  const search = async (e) => {
    e.preventDefault();
    if (!form.gameName.trim() || !form.tagLine.trim()) return;
    setStatus({ loading: true, error: null }); setData(null);
    try {
      const res = await getRiotHistory({
        riotId: `${form.gameName.trim()}#${form.tagLine.trim()}`,
        platform: form.platform,
        count: form.count,
      });
      if (res.ok) setData(res);
      else setStatus({ loading: false, error: res.reason || 'Falha na busca.' });
      if (res.ok) setStatus({ loading: false, error: null });
    } catch (err) {
      setStatus({ loading: false, error: err?.response?.data?.reason || err?.message || 'Erro de rede.' });
    }
  };

  const doImport = async (match) => {
    setImportingId(match.matchId);
    try {
      const res = await importMatch({
        matchId: match.matchId,
        ourPuuid: data.account.puuid, // detecta nosso lado pelo jogador buscado
        platform: data.platform,
        opponent: meta.opponent,
        series_type: meta.series_type,
        series_label: meta.series_label,
      });
      if (res.id) navigate(`/matches/${res.id}`);
      else setStatus({ loading: false, error: res.reason || 'Falha ao importar.' });
    } catch (err) {
      setStatus({ loading: false, error: err?.response?.data?.reason || err?.message || 'Erro de rede.' });
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Busque pelo <b>Riot ID</b> (Nome + #TAG) e importe direto do histórico — sem precisar de Match ID.
        O <b>nosso lado</b> é detectado automaticamente como o lado do jogador buscado.
      </p>

      <form onSubmit={search} className="grid sm:grid-cols-[1fr_120px_160px_90px_auto] gap-2 items-end">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Nome</span>
          <input className="input w-full mt-1" placeholder="Faker" value={form.gameName} onChange={set('gameName')} required />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">#TAG</span>
          <input className="input w-full mt-1" placeholder="KR1" value={form.tagLine} onChange={set('tagLine')} required />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Região</span>
          <select className="input w-full mt-1" value={form.platform} onChange={set('platform')}>
            {PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Qtd</span>
          <select className="input w-full mt-1" value={form.count} onChange={set('count')}>
            {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button className="btn-primary" disabled={status.loading}>{status.loading ? 'Buscando…' : 'Buscar'}</button>
      </form>

      {status.error && (
        <div className="rounded-lg border border-loss/40 bg-loss/10 text-loss text-sm px-3 py-2">{status.error}</div>
      )}

      {status.loading && <Spinner label="Buscando histórico…" />}

      {data && (
        <>
          <div className="text-sm text-gray-400">
            <b className="text-gray-200">{data.account.gameName}#{data.account.tagLine}</b> · {data.matches.length} partidas recentes
          </div>

          {/* Metadados aplicados na importação */}
          <div className="grid sm:grid-cols-3 gap-2">
            <input className="input" placeholder="Adversário (opcional)" value={meta.opponent} onChange={setM('opponent')} />
            <select className="input" value={meta.series_type} onChange={setM('series_type')}>
              {SERIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="input" placeholder="Rótulo da série (ex.: Bo5 G3)" value={meta.series_label} onChange={setM('series_label')} />
          </div>

          <div className="overflow-x-auto border border-line rounded-lg">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left text-[11px] uppercase text-gray-500 border-b border-line">
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Fila</th>
                  <th className="px-3 py-2 font-medium">Resultado</th>
                  <th className="px-3 py-2 font-medium">Duração</th>
                  <th className="px-3 py-2 font-medium">Lado</th>
                  <th className="px-3 py-2 font-medium">Composições</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.matches.map((m) => m.error ? (
                  <tr key={m.matchId} className="border-b border-line/60">
                    <td colSpan={7} className="px-3 py-2 text-gray-500 text-xs">{m.matchId} — falha ao carregar</td>
                  </tr>
                ) : (
                  <tr key={m.matchId} className="border-b border-line/60 hover:bg-bg-hover/50">
                    <td className="px-3 py-2 text-gray-300">{shortDate(m.date)}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{queueName(m.queueId)}</td>
                    <td className="px-3 py-2"><ResultBadge result={m.win ? 'win' : 'loss'} /></td>
                    <td className="px-3 py-2 text-gray-400">{mmss(m.durationS)}</td>
                    <td className="px-3 py-2">
                      <span className={m.yourSide === 'blue' ? 'text-blueteam' : 'text-redteam'}>
                        {m.yourSide === 'blue' ? 'Azul' : 'Vermelho'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-0.5">
                        {m.participants.filter((p) => p.side === 'blue').map((p, i) => (
                          <ChampIcon key={`b${i}`} champion={p.champion} size="xs" className={p.isYou ? 'ring-2 ring-gold' : ''} />
                        ))}
                        <span className="text-gray-600 mx-1">vs</span>
                        {m.participants.filter((p) => p.side === 'red').map((p, i) => (
                          <ChampIcon key={`r${i}`} champion={p.champion} size="xs" className={p.isYou ? 'ring-2 ring-gold' : ''} />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {m.alreadyImported ? (
                        <span className="text-xs text-gray-500">importada</span>
                      ) : (
                        <button className="btn-primary text-xs py-1" disabled={importingId === m.matchId}
                          onClick={() => doImport(m)}>
                          {importingId === m.matchId ? 'Importando…' : 'Importar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600">
            Scrims em realm de torneio podem não aparecer aqui — o histórico cobre soloq/flex/normal/clash do invocador.
          </p>
        </>
      )}
    </div>
  );
}

// ---------- Modo 2: Match ID / gameId direto ----------
function ManualImport() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    matchId: '', platform: 'br1', ourSide: 'blue',
    opponent: '', series_type: 'Scrim', series_label: '',
  });
  const [status, setStatus] = useState({ loading: false, error: null });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.matchId.trim()) return;
    setStatus({ loading: true, error: null });
    try {
      const res = await importMatch({
        matchId: form.matchId.trim(), platform: form.platform, ourSide: form.ourSide,
        opponent: form.opponent, series_type: form.series_type, series_label: form.series_label,
      });
      if (res.id) navigate(`/matches/${res.id}`);
      else setStatus({ loading: false, error: res.reason || 'Falha ao importar.' });
    } catch (err) {
      setStatus({ loading: false, error: err?.response?.data?.reason || err?.message || 'Erro de rede.' });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-400">
        Cole o <b>Match ID</b> (<code className="text-gold">BR1_1234567890</code>) ou apenas o <b>gameId numérico</b>
        (<code className="text-gold">1234567890</code>) — nesse caso a região é usada como prefixo.
      </p>

      <div className="grid sm:grid-cols-[1fr_auto] gap-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Match ID ou gameId *</span>
          <input className="input w-full mt-1" placeholder="BR1_1234567890" value={form.matchId} onChange={set('matchId')} required />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Região</span>
          <select className="input w-full mt-1" value={form.platform} onChange={set('platform')}>
            {PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </label>
      </div>

      <div>
        <span className="text-xs uppercase tracking-wide text-gray-500">Nosso lado *</span>
        <div className="flex gap-2 mt-1">
          {[{ v: 'blue', l: 'Azul (Blue)' }, { v: 'red', l: 'Vermelho (Red)' }].map((s) => (
            <button type="button" key={s.v} onClick={() => setForm((f) => ({ ...f, ourSide: s.v }))}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.ourSide === s.v
                  ? s.v === 'blue' ? 'border-blueteam text-blueteam bg-blueteam/10' : 'border-redteam text-redteam bg-redteam/10'
                  : 'border-line text-gray-400 hover:text-gray-200'
              }`}>
              {s.l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <input className="input" placeholder="Adversário (opcional)" value={form.opponent} onChange={set('opponent')} />
        <select className="input" value={form.series_type} onChange={set('series_type')}>
          {SERIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="input" placeholder="Rótulo da série (ex.: Bo5 G3)" value={form.series_label} onChange={set('series_label')} />
      </div>

      {status.error && (
        <div className="rounded-lg border border-loss/40 bg-loss/10 text-loss text-sm px-3 py-2">{status.error}</div>
      )}

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={status.loading || !form.matchId.trim()}>
          {status.loading ? 'Importando…' : 'Importar partida'}
        </button>
        <span className="text-xs text-gray-500">Requer RIOT_API_KEY no .env.</span>
      </div>
    </form>
  );
}

// ---------- Modo 3: upload de replay .ROFL ----------
function RoflImport() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState({ loading: false, error: null });
  const [preview, setPreview] = useState(null); // { token, durationS, patch, date, blue, red }
  const [meta, setMeta] = useState({ ourSide: 'blue', opponent: '', series_type: 'Scrim', series_label: '', date: '' });

  const pick = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.rofl')) { setStatus({ loading: false, error: 'O arquivo deve ser .rofl' }); return; }
    setFile(f); setStatus({ loading: false, error: null });
  };

  const process = async () => {
    if (!file) return;
    setStatus({ loading: true, error: null });
    try {
      const res = await previewRofl(file);
      if (res.ok) {
        setPreview({ ...res.preview });
        setMeta((m) => ({ ...m, date: res.preview.date || '' })); // data sugerida (editável)
        setStatus({ loading: false, error: null });
      } else setStatus({ loading: false, error: res.reason || 'Falha ao ler o replay.' });
    } catch (err) {
      setStatus({ loading: false, error: err?.response?.data?.reason || err?.message || 'Erro de rede.' });
    }
  };

  const confirm = async () => {
    setStatus({ loading: true, error: null });
    try {
      const res = await confirmRofl(file, meta);
      if (res.id) navigate(`/matches/${res.id}`);
      else setStatus({ loading: false, error: res.reason || 'Falha ao importar.' });
    } catch (err) {
      setStatus({ loading: false, error: err?.response?.data?.reason || err?.message || 'Erro de rede.' });
    }
  };

  // Preview + confirmação
  if (preview) {
    const Team = ({ label, side, players }) => (
      <div className={`rounded-lg border p-3 ${meta.ourSide === side ? 'border-gold' : 'border-line'}`}>
        <button type="button" onClick={() => setMeta((m) => ({ ...m, ourSide: side }))}
          className={`w-full text-left text-sm font-semibold mb-2 ${side === 'blue' ? 'text-blueteam' : 'text-redteam'}`}>
          {meta.ourSide === side ? '★ ' : ''}{label} {meta.ourSide === side && <span className="text-gold text-xs">(nosso time)</span>}
        </button>
        <ul className="space-y-1">
          {players.map((p, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <ChampIcon champion={p.champion} size="xs" />
              <span className="text-gray-200 truncate grow">{p.name}</span>
              <span className="text-gray-500 text-xs">{p.kda}</span>
            </li>
          ))}
        </ul>
      </div>
    );
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          Replay lido ({mmss(preview.durationS)} · patch {preview.patch}). Clique no time que é o <b>nosso</b> e confirme.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Team label="Time Azul" side="blue" players={preview.blue} />
          <Team label="Time Vermelho" side="red" players={preview.red} />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input className="input" placeholder="Adversário / nome (ex.: Scrim vs Team X)"
            value={meta.opponent} onChange={(e) => setMeta((m) => ({ ...m, opponent: e.target.value }))} />
          <select className="input" value={meta.series_type} onChange={(e) => setMeta((m) => ({ ...m, series_type: e.target.value }))}>
            {SERIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="input" placeholder="Rótulo da série (ex.: Bo5 G3)"
            value={meta.series_label} onChange={(e) => setMeta((m) => ({ ...m, series_label: e.target.value }))} />
          <label className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Data da partida</span>
            <input type="date" className="input" value={meta.date}
              onChange={(e) => setMeta((m) => ({ ...m, date: e.target.value }))} />
          </label>
        </div>
        {status.error && <div className="rounded-lg border border-loss/40 bg-loss/10 text-loss text-sm px-3 py-2">{status.error}</div>}
        <p className="text-xs text-gray-600">Replays não contêm timeline — as abas Timeline/Gráficos ficam vazias; estatísticas e build/runas funcionam.</p>
        <div className="flex items-center gap-2">
          <button className="btn-primary" disabled={status.loading} onClick={confirm}>{status.loading ? 'Importando…' : 'Confirmar e salvar'}</button>
          <button className="btn-ghost" disabled={status.loading} onClick={() => { setPreview(null); setFile(null); }}>Cancelar</button>
        </div>
      </div>
    );
  }

  // Seleção de arquivo
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Importe partidas locais (scrims/customs) pelo arquivo <b>.rofl</b> do cliente do LoL —
        elas não aparecem no match-v5. O arquivo fica guardado para baixar e reassistir depois.
      </p>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${drag ? 'border-gold bg-gold/5' : 'border-line'}`}
      >
        {file ? (
          <div className="space-y-1">
            <div className="text-gray-200 font-medium">{file.name}</div>
            <div className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            <button className="btn-ghost mt-2" onClick={() => setFile(null)}>Trocar arquivo</button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-gray-400">Arraste o arquivo .rofl aqui</div>
            <label className="btn-ghost inline-block cursor-pointer">
              Selecionar arquivo
              <input type="file" accept=".rofl" hidden onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          </div>
        )}
      </div>
      {status.error && <div className="rounded-lg border border-loss/40 bg-loss/10 text-loss text-sm px-3 py-2">{status.error}</div>}
      <button className="btn-primary" disabled={!file || status.loading} onClick={process}>
        {status.loading ? 'Processando…' : 'Processar arquivo'}
      </button>
    </div>
  );
}
