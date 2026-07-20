import { useState } from 'react';
import { useAuth } from '../auth.jsx';

// Splash art (Data Dragon, CDN público) como fundo temático de LoL.
const SPLASH = 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Viego_0.jpg';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', teamName: '', inviteToken: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (mode === 'login') await login(form.username.trim(), form.password);
      else await register({
        username: form.username.trim(), password: form.password,
        teamName: form.teamName.trim(), inviteToken: form.inviteToken.trim(),
      });
    } catch (e2) {
      setErr(e2?.response?.data?.reason || 'Falha. Verifique os dados.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 overflow-hidden">
      {/* Fundo: splash art + camadas de escuridão roxa */}
      <div className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: `url(${SPLASH})`, filter: 'saturate(0.85)' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/85 to-bg" />
      <div className="absolute inset-0"
        style={{ background: 'radial-gradient(1000px 600px at 50% -10%, rgba(176,38,255,0.28), transparent 60%)' }} />

      <div className="relative w-full max-w-md">
        {/* Marca */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-brand-glow mb-3">
            <span className="h-px w-6 bg-brand/50" /> League of Legends <span className="h-px w-6 bg-brand/50" />
          </div>
          <h1 className="text-5xl font-extrabold leading-none">
            <span className="text-brand text-glow">TENEBRA</span>
          </h1>
          <div className="mt-1 text-lg font-bold tracking-[0.3em] text-white/90">E-SPORTS</div>
          <p className="text-sm text-gray-400 mt-3">Central de análise e desempenho dos times da organização.</p>
        </div>

        <div className="card p-6 shadow-neon border-brand/25 bg-bg-card/80 backdrop-blur">
          <div className="flex gap-1 mb-5 p-1 rounded-lg bg-bg-soft/80">
            {[['login', 'Entrar'], ['register', 'Criar time']].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setErr(null); }}
                className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  mode === m ? 'bg-brand text-white shadow-neon' : 'text-gray-400 hover:text-gray-200'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'register' && (
              <>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-gray-500">Token de criação</span>
                  <input className="input w-full mt-1 font-mono" placeholder="TENEBRA-XXXXXXXXXX"
                    value={form.inviteToken} onChange={set('inviteToken')} required />
                  <span className="text-[11px] text-gray-600">Fornecido pela organização. Cada token cria um time (uso único).</span>
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-gray-500">Nome do time</span>
                  <input className="input w-full mt-1" placeholder="Ex.: Leviathan" value={form.teamName}
                    onChange={set('teamName')} required />
                  <span className="text-[11px] text-gray-600">
                    Aparece como <span className="text-brand-glow font-semibold">TENEBRA {form.teamName || '…'}</span>
                  </span>
                </label>
              </>
            )}
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-gray-500">Usuário</span>
              <input className="input w-full mt-1" value={form.username} onChange={set('username')} autoComplete="username" required />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-gray-500">Senha</span>
              <input type="password" className="input w-full mt-1" value={form.password} onChange={set('password')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
            </label>
            {err && <div className="text-sm text-loss">{err}</div>}
            <button className="btn-primary w-full justify-center !py-2.5 text-base" disabled={busy}>
              {busy ? '...' : mode === 'login' ? '⚔ Entrar na central' : 'Criar time e entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 mt-4">
          {mode === 'login'
            ? 'Cada time tem seus próprios dados, isolados.'
            : 'Precisa de um token? Fale com a organização TENEBRA.'}
        </p>
      </div>
    </div>
  );
}
