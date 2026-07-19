import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ username: '', password: '', teamName: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (mode === 'login') await login(form.username.trim(), form.password);
      else await register({ username: form.username.trim(), password: form.password, teamName: form.teamName.trim() });
    } catch (e2) {
      setErr(e2?.response?.data?.reason || 'Falha. Verifique os dados.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl font-extrabold">
            <span className="text-brand text-glow">TENEBRA</span> <span className="text-white">Leviathan</span>
          </div>
          <p className="text-sm text-gray-400 mt-1">Plataforma de análise de partidas de LoL</p>
        </div>

        <div className="card p-6 shadow-neon">
          <div className="flex gap-1 mb-5 p-1 rounded-lg bg-bg-soft">
            {['login', 'register'].map((m) => (
              <button key={m} onClick={() => { setMode(m); setErr(null); }}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === m ? 'bg-brand text-white shadow-neon' : 'text-gray-400 hover:text-gray-200'
                }`}>
                {m === 'login' ? 'Entrar' : 'Criar time'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'register' && (
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-gray-500">Nome do time</span>
                <input className="input w-full mt-1" placeholder="Ex.: Tenebra Leviathan" value={form.teamName}
                  onChange={set('teamName')} required />
                <span className="text-[11px] text-gray-600">Aparece no topo do sistema.</span>
              </label>
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
            <button className="btn-primary w-full justify-center !py-2" disabled={busy}>
              {busy ? '...' : mode === 'login' ? 'Entrar' : 'Criar time e entrar'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-600 mt-4">
          {mode === 'login' ? 'Cada time tem seus próprios dados isolados.' : 'Você começa com um roster vazio para adicionar seus jogadores.'}
        </p>
      </div>
    </div>
  );
}
