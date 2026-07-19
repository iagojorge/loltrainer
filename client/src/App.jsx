import { Routes, Route, NavLink, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import TeamDashboard from './pages/TeamDashboard.jsx';
import MatchDetail from './pages/MatchDetail.jsx';
import ChampionDetail from './pages/ChampionDetail.jsx';
import PlayerDetail from './pages/PlayerDetail.jsx';
import Champions from './pages/Champions.jsx';
import Players from './pages/Players.jsx';
import ImportMatch from './pages/ImportMatch.jsx';
import Soloq from './pages/Soloq.jsx';
import Login from './pages/Login.jsx';
import { useAuth } from './auth.jsx';
import { Spinner } from './components/ui.jsx';

const nav = [
  { to: '/', label: 'Histórico', end: true },
  { to: '/team', label: 'Dashboard do Time' },
  { to: '/soloq', label: 'SoloQ' },
  { to: '/champions', label: 'Campeões' },
  { to: '/players', label: 'Jogadores' },
  { to: '/import', label: 'Importar' },
];

function Header() {
  const { user, logout } = useAuth();
  const teamName = user?.teamName || 'Meu Time';
  const [first, ...rest] = teamName.split(' ');
  return (
    <header className="sticky top-0 z-30 bg-bg-soft/95 backdrop-blur border-b border-brand/20">
      <div className="max-w-[1400px] mx-auto px-4 flex items-center gap-6 h-14">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-lg shrink-0">
          <span className="text-brand text-glow uppercase">{first}</span>
          <span className="text-white">{rest.join(' ')}</span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'bg-brand/15 text-brand-glow shadow-neon' : 'text-gray-400 hover:text-gray-200 hover:bg-bg-hover/60'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="text-xs text-gray-500 hidden sm:inline">{user?.username}</span>
          <button onClick={logout} className="btn-ghost !py-1 !px-2 text-xs">Sair</button>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner label="Carregando…" /></div>;
  if (!user) return <Login />;
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/team" element={<TeamDashboard />} />
          <Route path="/matches/:id" element={<MatchDetail />} />
          <Route path="/champions" element={<Champions />} />
          <Route path="/champions/:name" element={<ChampionDetail />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:name" element={<PlayerDetail />} />
          <Route path="/soloq" element={<Soloq />} />
          <Route path="/import" element={<ImportMatch />} />
        </Routes>
      </main>
      <footer className="max-w-[1400px] mx-auto px-4 py-8 text-center text-xs text-gray-600">
        Análise de partidas de LoL · dados via Riot API · ícones via Data Dragon
      </footer>
    </div>
  );
}
