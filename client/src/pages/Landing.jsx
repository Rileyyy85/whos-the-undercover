import { Link } from 'react-router-dom';
import { Logo, ROLE_INFO } from '../components/ui.jsx';

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <Logo className="text-4xl sm:text-6xl mb-4 animate-pop" />
      <p className="text-lg sm:text-2xl text-white/70 max-w-2xl mb-10 animate-fade-up">
        Everyone gets a secret word, except the Undercover, whose word is <em>almost</em> the same. Give clues, vote, and
        find the spy!
      </p>
      <div className="grid gap-4 w-full max-w-md">
        <Link
          to="/setup"
          className="rounded-3xl bg-undercover hover:bg-red-400 px-6 py-5 text-2xl font-black shadow-lg shadow-black/40 transition active:scale-95"
        >
          🎤 Host a Game
        </Link>
        <Link
          to="/join"
          className="rounded-3xl bg-civilian hover:bg-blue-400 px-6 py-5 text-2xl font-black shadow-lg shadow-black/40 transition active:scale-95"
        >
          📱 Join a Game
        </Link>
        <Link
          to="/rules"
          className="rounded-3xl bg-white/10 hover:bg-white/20 px-6 py-4 text-xl font-bold transition active:scale-95"
        >
          📖 How to Play
        </Link>
      </div>
      <div className="flex gap-3 mt-10 flex-wrap justify-center">
        {Object.entries(ROLE_INFO).map(([k, r]) => (
          <span key={k} className={`rounded-full px-4 py-1 font-bold ${r.bg}`}>
            {r.emoji} {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}
