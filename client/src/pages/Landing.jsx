import { Link } from 'react-router-dom';
import { Logo, ROLE_INFO } from '../components/ui.jsx';

const BIG =
  'block rounded-3xl px-6 py-5 text-2xl font-display font-bold transition-transform hover:brightness-110 active:translate-y-1 active:!shadow-none';

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <Logo className="text-4xl sm:text-6xl mb-4 animate-pop" />
      <p className="text-lg sm:text-2xl text-white/80 max-w-2xl mb-10 animate-fade-up">
        Everyone gets a secret word, except the Undercover, whose word is <em>almost</em> the same. Give clues, vote, and
        find the spy!
      </p>
      <div className="grid gap-5 w-full max-w-md">
        <Link to="/setup" className={`${BIG} bg-gradient-to-r from-[#ff5f6d] to-[#ff9966] shadow-[0_7px_0_#c8434f]`}>
          🎤 Host a Game
        </Link>
        <Link to="/join" className={`${BIG} bg-k-blue shadow-[0_7px_0_#0b4a94]`}>
          📱 Join a Game
        </Link>
        <Link to="/rules" className={`${BIG} bg-white text-grape text-xl shadow-[0_7px_0_#c9b6ee]`}>
          📖 How to Play
        </Link>
      </div>
      <div className="flex gap-3 mt-12 flex-wrap justify-center">
        {Object.entries(ROLE_INFO).map(([k, r]) => (
          <span key={k} className={`rounded-full px-4 py-1.5 font-display font-bold ring-2 ring-white/70 ${r.bg}`}>
            {r.emoji} {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}
