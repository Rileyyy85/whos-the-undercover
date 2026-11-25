import { ROLE_INFO, RoleTag } from './ui.jsx';

const WIN_STYLE = {
  civilians: { title: 'Civilians win!', cls: 'from-civilian/40 to-civilian/10 ring-civilian', emoji: '🎉' },
  undercover: { title: 'Undercover wins!', cls: 'from-undercover/40 to-undercover/10 ring-undercover', emoji: '🕵️' },
  mrwhite: { title: 'Mr. White wins!', cls: 'from-mrwhite/40 to-mrwhite/10 ring-mrwhite', emoji: '👻' },
};

export function WinnerBanner({ winner, big = false }) {
  if (!winner) return null;
  const w = WIN_STYLE[winner.team];
  return (
    <div className={`rounded-3xl bg-gradient-to-br ${w.cls} ring-2 p-6 text-center animate-pop`}>
      <div className={big ? 'text-7xl mb-2' : 'text-5xl mb-1'}>{w.emoji}</div>
      <div className={`font-black ${big ? 'text-6xl' : 'text-3xl'}`}>{w.title}</div>
      <div className={`text-white/80 mt-2 ${big ? 'text-2xl' : 'text-lg'}`}>{winner.reason}</div>
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
            Civilians: <b className="text-civilian">{words.civilian}</b>
          </span>
          <span>
            Undercover: <b className="text-undercover">{words.undercover}</b>
          </span>
        </div>
      )}
      <div className={`grid gap-2 ${big ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center justify-between rounded-2xl bg-panel2 ring-2 ${ROLE_INFO[p.role].ring} px-4 py-2 animate-flip`}
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <span className={`font-bold ${big ? 'text-2xl' : 'text-lg'} ${p.alive ? '' : 'line-through opacity-60'}`}>
              {p.name}
            </span>
            <span className="flex items-center gap-2">
              <span className={`${big ? 'text-xl' : ''} text-white/80`}>{p.word ?? '—'}</span>
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
      <div className={`text-center font-bold animate-pop ${big ? 'text-4xl' : 'text-2xl'}`}>
        🤝 No one was eliminated this round.
      </div>
    );
  }
  const r = ROLE_INFO[elimination.role];
  return (
    <div className={`rounded-3xl ring-2 ${r.ring} bg-panel2 p-6 text-center animate-flip`}>
      <div className={`text-white/70 ${big ? 'text-2xl' : 'text-lg'}`}>Eliminated</div>
      <div className={`font-black ${big ? 'text-6xl' : 'text-3xl'} my-2`}>{elimination.name}</div>
      <div className={`font-black ${r.color} ${big ? 'text-5xl' : 'text-2xl'}`}>
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
              {elimination.guessCorrect ? <b className="text-emerald-400">Correct!</b> : <b className="text-undercover">Wrong!</b>}
            </span>
          )}
          {!elimination.guessPending && !elimination.guess && <span className="text-white/60">No guess made.</span>}
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
