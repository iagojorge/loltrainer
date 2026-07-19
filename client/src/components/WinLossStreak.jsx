import { Link } from 'react-router-dom';

export default function WinLossStreak({ results }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {results.map((r) => {
        const win = r.result === 'win';
        return (
          <Link
            key={r.id}
            to={`/matches/${r.id}`}
            title={`${win ? 'Vitória' : 'Derrota'} vs ${r.opponent}`}
            className="h-7 w-7 rounded-md flex items-center justify-center text-[11px] font-bold transition-transform hover:scale-110"
            style={{
              color: win ? '#00D166' : '#FF5252',
              backgroundColor: win ? 'rgba(0,209,102,0.16)' : 'rgba(255,82,82,0.16)',
              border: `1px solid ${win ? 'rgba(0,209,102,0.4)' : 'rgba(255,82,82,0.4)'}`,
            }}
          >
            {win ? 'W' : 'L'}
          </Link>
        );
      })}
    </div>
  );
}
