import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlayers, getRoster, addRosterPlayer, removeRosterPlayer } from '../api.js';
import { Card, Spinner, WinRatePill, SectionTitle } from '../components/ui.jsx';
import { ROLE_ICON } from '../lib/champ.js';

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

export default function Players() {
  const [roster, setRoster] = useState(null);
  const [stats, setStats] = useState([]);
  const [form, setForm] = useState({ name: '', tag: '', role: 'Top' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => Promise.all([getRoster(), getPlayers()]).then(([r, s]) => { setRoster(r); setStats(s); });
  useEffect(() => { load(); }, []);

  const statsByName = Object.fromEntries((stats || []).map((p) => [p.name, p]));

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true); setError(null);
    try {
      const res = await addRosterPlayer({ name: form.name.trim(), tag: form.tag.trim(), role: form.role });
      if (res.ok) { setForm({ name: '', tag: '', role: form.role }); await load(); }
      else setError(res.reason || 'Falha ao adicionar.');
    } catch (err) {
      setError(err?.response?.data?.reason || err?.message || 'Erro de rede.');
    } finally { setBusy(false); }
  };

  const remove = async (id) => { await removeRosterPlayer(id); await load(); };

  if (!roster) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white text-glow">Jogadores do time</h1>

      <Card>
        <SectionTitle>Roster</SectionTitle>
        <p className="text-sm text-gray-400 mb-3">
          Adicione os jogadores do seu time (Riot ID: <b>Nome</b> e <b>#TAG</b>). A tag é usada na SoloQ e para
          casar os campeões nas partidas importadas.
        </p>
        <form onSubmit={add} className="flex flex-wrap gap-2 items-end">
          <label className="block grow min-w-[160px]">
            <span className="text-xs uppercase tracking-wide text-gray-500">Nome do jogador</span>
            <input className="input w-full mt-1" placeholder="Ex.: LeKuTaaká" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className="block w-28">
            <span className="text-xs uppercase tracking-wide text-gray-500">Tag</span>
            <input className="input w-full mt-1" placeholder="BR1" value={form.tag}
              onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-gray-500">Posição</span>
            <select className="input mt-1" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button className="btn-primary" disabled={busy || !form.name.trim()}>+ Adicionar</button>
        </form>
        {error && <div className="mt-2 text-sm text-loss">{error}</div>}
      </Card>

      {roster.length === 0 ? (
        <Card className="text-center text-gray-500 text-sm py-8">
          Nenhum jogador no roster ainda. Adicione os jogadores do seu time acima.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roster.map((p) => {
            const s = statsByName[p.name];
            const hasGames = s && s.games > 0;
            return (
              <div key={p.id} className="card p-5 relative">
                <button onClick={() => remove(p.id)} title="Remover do roster"
                  className="absolute top-3 right-3 text-gray-600 hover:text-loss text-sm">✕</button>
                <Link to={hasGames ? `/players/${encodeURIComponent(p.name)}` : '#'}
                  className={hasGames ? '' : 'pointer-events-none'}>
                  <div className="flex items-center justify-between pr-6">
                    <div className="min-w-0">
                      <div className="text-lg font-bold text-white truncate">{p.name}</div>
                      <div className="text-sm text-gray-400">
                        {ROLE_ICON[p.role]} {p.role}{p.tag ? <span className="text-gray-600"> · #{p.tag}</span> : null}
                      </div>
                    </div>
                    {hasGames && (
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold"><WinRatePill value={s.winRate} /></div>
                        <div className="text-xs text-gray-500">{s.wins}-{s.games - s.wins}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 mt-4 text-sm text-gray-300">
                    {hasGames ? (
                      <>
                        <span>KDA <b className="text-gray-100">{s.kda}</b></span>
                        <span>CS/m <b className="text-gray-100">{s.csPerMin}</b></span>
                        <span>{s.games} jogos</span>
                      </>
                    ) : (
                      <span className="text-gray-500">Sem partidas importadas ainda.</span>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
