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

// ---------- avatars ----------
const ANIMALS = ['🦊', '🐼', '🐸', '🐯', '🐨', '🐙', '🐰', '🐻', '🐥', '🐱', '🐶', '🐹', '🦁', '🐵', '🦄', '🐧'];
const AVATAR_BG = ['#ff6b8b', '#4dabf7', '#ffd43b', '#69db7c', '#b197fc', '#ffa94d', '#63e6be', '#f783ac'];

function hash(str) {
  let h = 0;
  for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// Give every player in the room a different animal (in join order); fall back to a hash.
const assigned = new Map();
export function registerAvatars(ids) {
  const used = new Set(ids.filter((id) => assigned.has(id)).map((id) => assigned.get(id)));
  for (const id of ids) {
    if (assigned.has(id)) continue;
    let k = 0;
    while (used.has(k) && k < ANIMALS.length) k++;
    assigned.set(id, k % ANIMALS.length);
    used.add(k);
  }
}

/** A stable animal avatar for each player. */
export function avatarFor(id) {
  const idx = assigned.get(id) ?? hash(id) % ANIMALS.length;
  return { emoji: ANIMALS[idx], bg: AVATAR_BG[idx % AVATAR_BG.length] };
}

export function Avatar({ id, size = 40, className = '' }) {
  const a = avatarFor(id);
  return (
    <span
      className={`inline-grid place-items-center rounded-full ring-2 ring-white shrink-0 ${className}`}
      style={{ width: size, height: size, background: a.bg, fontSize: size * 0.55 }}
    >
      {a.emoji}
    </span>
  );
}

// Kahoot-style answer tiles: colour + shape, cycling.
export const TILES = [
  { bg: 'bg-k-red', edge: '#a3102a', shape: '▲' },
  { bg: 'bg-k-blue', edge: '#0b4a94', shape: '◆' },
  { bg: 'bg-k-yellow', edge: '#c27c00', shape: '●' },
  { bg: 'bg-k-green', edge: '#175706', shape: '■' },
];

// ---------- buttons & cards ----------
const VARIANTS = {
  primary: { cls: 'bg-k-blue text-white', edge: '#0b4a94' },
  danger: { cls: 'bg-k-red text-white', edge: '#a3102a' },
  purple: { cls: 'bg-mrwhite text-white', edge: '#6a1fb3' },
  ghost: { cls: 'bg-white/15 text-white', edge: 'rgba(0,0,0,0.3)' },
  success: { cls: 'bg-k-green text-white', edge: '#175706' },
  warn: { cls: 'bg-gold text-grape', edge: '#c78f00' },
  coral: { cls: 'bg-gradient-to-r from-[#ff5f6d] to-[#ff9966] text-white', edge: '#c8434f' },
  light: { cls: 'bg-white text-grape', edge: '#c9b6ee' },
};

export function Button({ variant = 'primary', size = 'md', className = '', style, ...props }) {
  const sizes = { sm: 'px-4 py-2 text-base', md: 'px-6 py-3 text-lg', lg: 'px-8 py-4 text-2xl' };
  const v = VARIANTS[variant];
  return (
    <button
      {...props}
      style={{ boxShadow: `0 5px 0 ${v.edge}`, ...style }}
      className={`rounded-2xl font-bold tracking-wide transition-transform hover:brightness-110 active:translate-y-1 active:!shadow-none disabled:opacity-40 disabled:active:translate-y-0 ${v.cls} ${sizes[size]} ${className}`}
    />
  );
}

export function Card({ className = '', children, light = false }) {
  return (
    <div
      className={`rounded-[28px] ${light ? 'bg-lilac text-grape' : 'bg-panel/90 ring-2 ring-white/15'} shadow-[0_8px_0_rgba(20,4,50,0.45)] ${className}`}
    >
      {children}
    </div>
  );
}

export function CodePill({ code, size = 'md' }) {
  const sizes = { sm: 'text-xl px-3 py-0.5', md: 'text-3xl px-4 py-1', xl: 'text-5xl lg:text-7xl px-6 py-2' };
  return (
    <span
      className={`inline-block font-display font-bold tracking-[0.2em] rounded-2xl bg-gold text-grape shadow-[0_5px_0_#c78f00] ${sizes[size]}`}
    >
      {code}
    </span>
  );
}

export function RoleTag({ role, className = '' }) {
  const r = ROLE_INFO[role];
  if (!r) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-sm font-extrabold text-white ${r.bg} ${className}`}>
      {r.emoji} {r.label}
    </span>
  );
}

export function ConnectionBanner({ connected, hostConnected, isHost }) {
  if (!connected) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 bg-gold text-grape text-center font-extrabold py-2 animate-fade-up">
        Reconnecting…
      </div>
    );
  }
  if (!isHost && hostConnected === false) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 bg-mrwhite text-white text-center font-extrabold py-2 animate-fade-up">
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
  const color = pct > 50 ? 'bg-[#2ee66b]' : pct > 20 ? 'bg-gold' : 'bg-k-red';
  return (
    <div className="w-full">
      <div className={`flex justify-between font-display font-bold mb-1 ${big ? 'text-2xl' : 'text-base'}`}>
        <span>{timer.kind === 'clue' ? '⏱ Clue timer' : '💬 Discussion'}</span>
        <span className={`rounded-full px-3 ${secs <= 5 ? 'bg-k-red text-white' : 'bg-white/15'}`}>
          {secs > 0 ? `${secs}s` : "Time's up!"}
        </span>
      </div>
      <div className={`w-full rounded-full bg-deep/60 ring-2 ring-white/15 overflow-hidden ${big ? 'h-6' : 'h-4'}`}>
        <div className={`h-full rounded-full ${color} transition-[width] duration-200 ease-linear`} style={{ width: `${pct}%` }} />
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
        <div key={cy} className={cy === cycle ? '' : 'opacity-55'}>
          <h3 className={`font-bold text-white/70 uppercase tracking-wider mb-2 ${big ? 'text-lg' : 'text-sm'}`}>Round {cy}</h3>
          <div className="flex flex-wrap gap-3">
            {clues
              .filter((c) => c.cycle === cy)
              .map((c, i) => (
                <div
                  key={`${cy}-${c.playerId}-${i}`}
                  className={`flex items-center gap-3 rounded-2xl bg-white text-grape shadow-[0_5px_0_#c9b6ee] animate-pop ${big ? 'px-4 py-3' : 'px-3 py-2'}`}
                >
                  <Avatar id={c.playerId} size={big ? 40 : 28} />
                  <div>
                    <div className={`text-grape/60 ${big ? 'text-base' : 'text-xs'}`}>{c.name}</div>
                    <div className={`font-display font-bold leading-tight ${big ? 'text-3xl' : 'text-xl'} ${c.skipped ? 'text-grape/40 italic' : ''}`}>
                      {c.skipped ? 'skipped' : c.text}
                    </div>
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
    <div className="space-y-4">
      {reveal.tally.map((t, i) => {
        const top = reveal.topIds.includes(t.playerId);
        const tile = TILES[i % TILES.length];
        return (
          <div key={t.playerId} className="animate-fade-up" style={{ animationDelay: `${i * 250}ms` }}>
            <div className={`flex items-center gap-3 font-display font-bold mb-1 ${big ? 'text-3xl' : 'text-lg'}`}>
              <Avatar id={t.playerId} size={big ? 44 : 30} />
              <span>{t.name}</span>
              {top && <span className="animate-wiggle">🎯</span>}
              <span className="ml-auto rounded-full bg-white text-grape px-3">
                {t.votes} vote{t.votes === 1 ? '' : 's'}
              </span>
            </div>
            <div className={`w-full rounded-full bg-deep/60 overflow-hidden ${big ? 'h-7' : 'h-4'}`}>
              <div
                className={`h-full rounded-full ${top ? 'bg-k-red' : tile.bg} transition-all duration-1000 ease-out`}
                style={{ width: go ? `${(t.votes / max) * 100}%` : '0%', transitionDelay: `${i * 250}ms` }}
              />
            </div>
            <div className={`text-white/70 mt-1 ${big ? 'text-base' : 'text-xs'}`}>from {t.voterNames.join(', ')}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Logo({ className = '' }) {
  return (
    <div className={`font-display font-bold tracking-tight ${className}`}>
      <span className="mr-2 inline-block animate-wiggle">🕵️</span>
      Who&apos;s the <span className="text-gold">Undercover</span>?
    </div>
  );
}
