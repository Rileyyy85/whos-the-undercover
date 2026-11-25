import { useEffect, useState } from 'react';

export const ROLE_INFO = {
  civilian: { label: 'Civilian', color: 'text-civilian', bg: 'bg-civilian', ring: 'ring-civilian', emoji: '🧑‍🤝‍🧑' },
  undercover: { label: 'Undercover', color: 'text-undercover', bg: 'bg-undercover', ring: 'ring-undercover', emoji: '🕵️' },
  mrwhite: { label: 'Mr. White', color: 'text-mrwhite', bg: 'bg-mrwhite', ring: 'ring-mrwhite', emoji: '👻' },
};

export const PHASE_LABEL = {
  lobby: 'Lobby',
  clues: 'Clue round',
  discussion: 'Discussion',
  voting: 'Voting',
  reveal: 'Vote results',
  elimination: 'Elimination',
  gameover: 'Game over',
  ended: 'Thanks for playing!',
};

const VARIANTS = {
  primary: 'bg-civilian hover:bg-blue-400 text-white',
  danger: 'bg-undercover hover:bg-red-400 text-white',
  purple: 'bg-mrwhite hover:bg-purple-400 text-white',
  ghost: 'bg-white/10 hover:bg-white/20 text-white',
  success: 'bg-emerald-500 hover:bg-emerald-400 text-white',
  warn: 'bg-amber-400 hover:bg-amber-300 text-black',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-5 py-3 text-lg', lg: 'px-7 py-4 text-xl' };
  return (
    <button
      {...props}
      className={`rounded-2xl font-bold shadow-lg shadow-black/30 transition active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${VARIANTS[variant]} ${sizes[size]} ${className}`}
    />
  );
}

export function Card({ className = '', children }) {
  return <div className={`rounded-3xl bg-panel/90 ring-1 ring-white/10 shadow-xl ${className}`}>{children}</div>;
}

export function RoleTag({ role, className = '' }) {
  const r = ROLE_INFO[role];
  if (!r) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-sm font-bold text-white ${r.bg} ${className}`}>
      {r.emoji} {r.label}
    </span>
  );
}

export function ConnectionBanner({ connected, hostConnected, isHost }) {
  if (!connected) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 bg-amber-400 text-black text-center font-bold py-2 animate-fade-up">
        Reconnecting…
      </div>
    );
  }
  if (!isHost && hostConnected === false) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 bg-mrwhite text-white text-center font-bold py-2 animate-fade-up">
        Host reconnecting… hang tight
      </div>
    );
  }
  return null;
}

/** Countdown bar driven by the server's endsAt timestamp (corrected for clock offset). */
export function TimerBar({ timer, clockOffset = 0, big = false }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!timer) return undefined;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [timer]);
  if (!timer) return null;
  const msLeft = Math.max(0, timer.endsAt - (now + clockOffset));
  const pct = Math.min(100, (msLeft / (timer.seconds * 1000)) * 100);
  const secs = Math.ceil(msLeft / 1000);
  const color = pct > 50 ? 'bg-emerald-400' : pct > 20 ? 'bg-amber-400' : 'bg-undercover';
  return (
    <div className="w-full">
      <div className={`flex justify-between font-bold mb-1 ${big ? 'text-2xl' : 'text-base'}`}>
        <span>{timer.kind === 'clue' ? '⏱ Clue timer' : '💬 Discussion'}</span>
        <span className={secs <= 5 ? 'text-undercover' : ''}>{secs > 0 ? `${secs}s` : "Time's up!"}</span>
      </div>
      <div className={`w-full rounded-full bg-white/10 overflow-hidden ${big ? 'h-5' : 'h-3'}`}>
        <div className={`h-full ${color} transition-[width] duration-200 ease-linear`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ClueBoard({ clues, cycle, big = false }) {
  const cycles = [...new Set(clues.map((c) => c.cycle))].sort((a, b) => b - a);
  if (clues.length === 0) {
    return <p className={`text-white/50 italic ${big ? 'text-2xl' : 'text-lg'}`}>Clues will appear here…</p>;
  }
  return (
    <div className="space-y-4">
      {cycles.map((cy) => (
        <div key={cy} className={cy === cycle ? '' : 'opacity-60'}>
          <h3 className={`font-bold text-white/60 uppercase tracking-wider mb-2 ${big ? 'text-lg' : 'text-sm'}`}>
            Round {cy}
          </h3>
          <div className="flex flex-wrap gap-3">
            {clues
              .filter((c) => c.cycle === cy)
              .map((c, i) => (
                <div
                  key={`${cy}-${c.playerId}-${i}`}
                  className={`rounded-2xl bg-panel2 ring-1 ring-white/10 animate-pop ${big ? 'px-5 py-3' : 'px-3 py-2'}`}
                >
                  <div className={`text-white/60 ${big ? 'text-base' : 'text-xs'}`}>{c.name}</div>
                  <div className={`font-bold ${big ? 'text-3xl' : 'text-xl'} ${c.skipped ? 'text-white/40 italic' : ''}`}>
                    {c.skipped ? 'skipped' : c.text}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function VoteReveal({ reveal, big = false }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 60);
    return () => clearTimeout(t);
  }, []);
  if (!reveal) return null;
  const max = Math.max(1, ...reveal.tally.map((t) => t.votes));
  return (
    <div className="space-y-3">
      {reveal.tally.map((t, i) => {
        const top = reveal.topIds.includes(t.playerId);
        return (
          <div key={t.playerId} className="animate-fade-up" style={{ animationDelay: `${i * 250}ms` }}>
            <div className={`flex justify-between font-bold ${big ? 'text-2xl' : 'text-lg'}`}>
              <span>{t.name}</span>
              <span>
                {t.votes} vote{t.votes === 1 ? '' : 's'}
              </span>
            </div>
            <div className={`w-full rounded-full bg-white/10 overflow-hidden ${big ? 'h-6' : 'h-4'}`}>
              <div
                className={`h-full rounded-full ${top ? 'bg-undercover' : 'bg-white/40'} transition-all duration-1000 ease-out`}
                style={{ width: go ? `${(t.votes / max) * 100}%` : '0%', transitionDelay: `${i * 250}ms` }}
              />
            </div>
            <div className={`text-white/60 mt-1 ${big ? 'text-base' : 'text-xs'}`}>from {t.voterNames.join(', ')}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Logo({ className = '' }) {
  return (
    <div className={`font-black tracking-tight ${className}`}>
      <span className="mr-2">🕵️</span>
      Who&apos;s the <span className="text-undercover">Undercover</span>?
    </div>
  );
}
