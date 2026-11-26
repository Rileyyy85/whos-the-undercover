import { Avatar, ROLE_INFO, RoleTag } from './ui.jsx';

const WIN_STYLE = {
  civilians: { title: 'Civilians win!', cls: 'bg-civilian', edge: '#0b4a94', emoji: '🎉' },
  undercover: { title: 'Undercover wins!', cls: 'bg-undercover', edge: '#a3102a', emoji: '🕵️' },
  mrwhite: { title: 'Mr. White wins!', cls: 'bg-mrwhite', edge: '#6a1fb3', emoji: '👻' },
};

export function WinnerBanner({ winner, big = false }) {
  if (!winner) return null;
  const w = WIN_STYLE[winner.team];
  return (
    <div className={`rounded-[28px] ${w.cls} ring-4 ring-white/80 p-6 text-center animate-pop`} style={{ boxShadow: `0 8px 0 ${w.edge}` }}>
      <div className={big ? 'text-7xl mb-2' : 'text-5xl mb-1'}>{w.emoji}</div>
      <div className={`font-display font-bold ${big ? 'text-6xl' : 'text-3xl'}`}>{w.title}</div>
      <div className={`text-white/90 mt-2 ${big ? 'text-2xl' : 'text-lg'}`}>{winner.reason}</div>
    </div>
  );
}

export function FinalRoles({ players, words, big = false }) {
  const inGame = players.filter((p) => p.inGame && p.role);
  const order = { undercover: 0, mrwhite: 1, civilian: 2 };
  const sorted = [...inGame].sort((a, b) => order[a.role] - order[b.role]);
  return (
    <div>
      {words && (
        <div className={`flex flex-wrap gap-4 justify-center mb-4 ${big ? 'text-2xl' : 'text-lg'}`}>
          <span>
            Civilians: <b className="rounded-xl bg-civilian px-3 py-0.5">{words.civilian}</b>
          </span>
          <span>
            Undercover: <b className="rounded-xl bg-undercover px-3 py-0.5">{words.undercover}</b>
          </span>
        </div>
      )}
      <div className={`grid gap-2 ${big ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center justify-between gap-2 rounded-2xl bg-white text-grape ring-4 ${ROLE_INFO[p.role].ring} px-3 py-2 shadow-[0_5px_0_rgba(20,4,50,0.35)] animate-flip`}
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <span className={`flex items-center gap-2 font-display font-bold ${big ? 'text-2xl' : 'text-lg'}`}>
              <Avatar id={p.id} size={big ? 40 : 30} />
              <span className={p.alive ? '' : 'line-through opacity-60'}>{p.name}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className={`${big ? 'text-xl' : ''} text-grape/70`}>{p.word ?? '—'}</span>
              <RoleTag role={p.role} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EliminationCard({ elimination, big = false }) {
  if (!elimination) return null;
  if (!elimination.playerId) {
    return (
      <div className={`text-center font-display font-bold animate-pop ${big ? 'text-4xl' : 'text-2xl'}`}>
        🤝 No one was eliminated this round.
      </div>
    );
  }
  const r = ROLE_INFO[elimination.role];
  return (
    <div className={`rounded-[28px] ring-4 ${r.ring} bg-white text-grape p-6 text-center shadow-[0_8px_0_rgba(20,4,50,0.45)] animate-flip`}>
      <div className={`text-grape/60 ${big ? 'text-2xl' : 'text-lg'}`}>Eliminated</div>
      <div className="flex justify-center my-2">
        <Avatar id={elimination.playerId} size={big ? 90 : 56} />
      </div>
      <div className={`font-display font-bold ${big ? 'text-6xl' : 'text-3xl'} mb-2`}>{elimination.name}</div>
      <div className={`inline-block rounded-2xl px-5 py-1 font-display font-bold text-white ${r.bg} ${big ? 'text-5xl' : 'text-2xl'}`}>
        {r.emoji} {r.label}
      </div>
      {elimination.word && (
        <div className={`mt-2 ${big ? 'text-3xl' : 'text-xl'}`}>
          Word: <b>{elimination.word}</b>
        </div>
      )}
      {elimination.role === 'mrwhite' && (
        <div className={`mt-4 ${big ? 'text-2xl' : 'text-lg'}`}>
          {elimination.guessPending && <span className="animate-pulse">👻 Mr. White is making one secret guess…</span>}
          {!elimination.guessPending && elimination.guess && (
            <span>
              Guessed “<b>{elimination.guess}</b>”:{' '}
              {elimination.guessCorrect ? <b className="text-k-green">Correct!</b> : <b className="text-undercover">Wrong!</b>}
            </span>
          )}
          {!elimination.guessPending && !elimination.guess && <span className="text-grape/60">No guess made.</span>}
        </div>
      )}
    </div>
  );
}

export function phaseTitle(s) {
  switch (s.phase) {
    case 'lobby':
      return 'Waiting for players';
    case 'clues':
      return `Clue round ${s.cycle}`;
    case 'discussion':
      return 'Discussion time';
    case 'voting':
      return s.voting.candidates ? 'Re-vote among tied players' : 'Voting';
    case 'reveal':
      return 'Vote results';
    case 'elimination':
      return 'Elimination';
    case 'gameover':
      return 'Game over';
    case 'ended':
      return 'Thanks for playing!';
    default:
      return '';
  }
}
