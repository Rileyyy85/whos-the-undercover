import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useRoom } from '../lib/useRoom.js';
import { tokens } from '../lib/storage.js';
import { Avatar, Button, Card, ClueBoard, CodePill, ConnectionBanner, Logo, RoleTag, TimerBar, VoteReveal } from '../components/ui.jsx';
import { EliminationCard, FinalRoles, WinnerBanner, phaseTitle } from '../components/game.jsx';

function Message({ title, children }) {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <Card className="p-8 max-w-lg">
        <h1 className="text-3xl font-display font-bold mb-3">{title}</h1>
        <div className="text-lg text-white/80 space-y-4">{children}</div>
      </Card>
    </div>
  );
}

function PlayerRow({ p, state, onKick, confirming }) {
  const isSpeaker = state.currentSpeakerId === p.id;
  let status = null;
  if (!p.inGame && state.phase !== 'lobby') status = <span className="text-grape/50">next round</span>;
  else if (p.inGame && !p.alive && state.gameNumber > 0) status = p.role ? <RoleTag role={p.role} /> : <span>out</span>;
  else if (state.phase === 'clues') status = p.clueGiven ? <span className="text-k-green">✓ clue</span> : isSpeaker ? <span>speaking</span> : null;
  else if (state.phase === 'voting') status = p.voted ? <span className="text-k-green">✓ voted</span> : <span className="text-grape/40">voting…</span>;
  else if (state.phase === 'lobby') status = <span className="text-k-green">joined</span>;

  const out = p.inGame && !p.alive && state.gameNumber > 0;
  return (
    <li
      className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-grape transition shadow-[0_4px_0_rgba(20,4,50,0.35)] ${
        isSpeaker ? 'bg-gold animate-pulse-ring -rotate-1' : 'bg-white'
      } ${out ? 'opacity-50' : ''}`}
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="relative">
          <Avatar id={p.id} size={40} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ring-2 ring-white ${p.connected ? 'bg-k-green' : 'bg-gray-400'}`}
            title={p.connected ? 'online' : 'offline'}
          />
        </span>
        <span className={`font-display text-2xl font-bold truncate ${out ? 'line-through' : ''}`}>{p.name}</span>
        {isSpeaker && <span className="text-xl animate-wiggle">🎤</span>}
      </span>
      <span className="flex items-center gap-2 text-base font-extrabold shrink-0">
        {status}
        <button
          onClick={() => onKick(p.id)}
          className={`rounded-lg px-2 py-0.5 text-sm ${confirming ? 'bg-k-red text-white' : 'bg-grape/5 text-grape/40 hover:text-grape hover:bg-grape/10'}`}
          title="Remove player"
        >
          {confirming ? 'Kick?' : '✕'}
        </button>
      </span>
    </li>
  );
}

function JoinPanel({ code, compact = false }) {
  const url = `${window.location.origin}/join?code=${code}`;
  return (
    <div className={`flex ${compact ? 'flex-row items-center gap-4' : 'flex-col items-center gap-4'} text-center`}>
      <div className="rounded-3xl bg-white p-4 shadow-[0_8px_0_rgba(20,4,50,0.45)] ring-4 ring-gold">
        <QRCodeSVG value={url} size={compact ? 96 : 240} fgColor="#2b1055" />
      </div>
      <div>
        {!compact && <div className="text-xl text-white/70">Scan, or open:</div>}
        <div className={`font-display font-bold break-all ${compact ? 'text-lg' : 'text-2xl'}`}>{url.replace(/^https?:\/\//, '')}</div>
      </div>
    </div>
  );
}

export default function Host() {
  const { code: rawCode } = useParams();
  const code = rawCode.toUpperCase();
  const token = tokens.get(code, 'host');
  const { state, connected, fatal, emit, clockOffset } = useRoom({ code, kind: 'host', token });
  const [error, setError] = useState('');
  const [kickId, setKickId] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  if (!token || fatal === 'not_host') {
    return (
      <Message title="Not the host">
        <p>This browser tab isn&apos;t the host of room {code}. If you are a player, join instead.</p>
        <div className="flex gap-3 justify-center">
          <Link className="underline text-gold" to={`/join?code=${code}`}>Join as player</Link>
          <Link className="underline text-gold" to="/setup">Create a new room</Link>
        </div>
      </Message>
    );
  }
  if (fatal === 'not_found') {
    return (
      <Message title="Room not found">
        <p>Room {code} no longer exists. Rooms reset if the server restarts or is idle for 2 hours.</p>
        <Link className="underline text-gold" to="/setup">Create a new room</Link>
      </Message>
    );
  }
  if (fatal === 'replaced') {
    return (
      <Message title="Opened elsewhere">
        <p>The host screen was opened in another tab. Use that one, or reload this page to take over.</p>
      </Message>
    );
  }
  if (!state) {
    return (
      <>
        <ConnectionBanner connected={connected} isHost />
        <Message title="Connecting…">
          <p>Loading room {code}</p>
        </Message>
      </>
    );
  }

  const act = async (type, extra = {}) => {
    setError('');
    const res = await emit('host:action', { type, ...extra });
    if (res?.error) setError(res.error);
  };
  const onKick = (id) => {
    if (kickId === id) {
      setKickId(null);
      act('kick', { playerId: id });
    } else {
      setKickId(id);
      setTimeout(() => setKickId((k) => (k === id ? null : k)), 3000);
    }
  };

  const s = state;
  const participants = s.players.filter((p) => p.inGame);
  const speaker = s.players.find((p) => p.id === s.currentSpeakerId);
  const cluesDone = s.phase === 'clues' && !s.currentSpeakerId;
  const tied = s.reveal?.tie;
  const topName = s.reveal && !tied ? s.reveal.tally[0]?.name : null;

  // ---------- controls for each phase ----------
  let controls = null;
  switch (s.phase) {
    case 'lobby':
      controls = (
        <>
          <Button size="lg" variant="success" disabled={participants.length < s.minPlayers} onClick={() => act('start')}>
            ▶ Start round
          </Button>
          {participants.length < s.minPlayers && (
            <span className="text-white/60 text-lg">Need at least {s.minPlayers} players ({participants.length} joined)</span>
          )}
        </>
      );
      break;
    case 'clues':
      controls = (
        <>
          <Button variant="ghost" disabled={!speaker} onClick={() => act('skipTurn')}>
            ⏭ Skip turn
          </Button>
          <Button variant="purple" disabled={!cluesDone} onClick={() => act('discussion')}>
            💬 Start discussion
          </Button>
          <Button variant="danger" disabled={!cluesDone} onClick={() => act('voting')}>
            🗳 Start voting
          </Button>
        </>
      );
      break;
    case 'discussion':
      controls = (
        <Button size="lg" variant="danger" onClick={() => act('voting')}>
          🗳 Start voting
        </Button>
      );
      break;
    case 'voting':
      controls = (
        <Button size="lg" variant="warn" disabled={s.voting.votedCount === 0} onClick={() => act('reveal')}>
          🎬 Reveal votes ({s.voting.votedCount}/{s.voting.eligibleCount})
        </Button>
      );
      break;
    case 'reveal':
      controls = tied ? (
        <>
          <Button variant="warn" onClick={() => act('revote')}>
            🔁 Re-vote among tied players
          </Button>
          <Button variant="ghost" onClick={() => act('noElimination')}>
            🤝 No elimination this round
          </Button>
        </>
      ) : (
        <Button size="lg" variant="danger" onClick={() => act('eliminate')}>
          ☠ Eliminate {topName}
        </Button>
      );
      break;
    case 'elimination':
      controls = s.elimination?.guessPending ? (
        <Button variant="ghost" onClick={() => act('skipGuess')}>
          Skip Mr. White&apos;s guess
        </Button>
      ) : (
        <Button size="lg" variant="success" onClick={() => act('nextClueRound')}>
          ▶ Next clue round
        </Button>
      );
      break;
    case 'gameover':
      controls = (
        <>
          <Button size="lg" variant="success" disabled={!s.hasNextPair} onClick={() => act('nextGame')}>
            ▶ Next Round {s.hasNextPair ? `(pair ${s.pairNumber + 1}/${s.totalPairs})` : '(no pairs left)'}
          </Button>
          <Button size="lg" variant="ghost" onClick={() => act('endSession')}>
            🏁 End Session
          </Button>
        </>
      );
      break;
    default:
      break;
  }

  if (s.phase === 'ended') {
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div className="animate-pop">
          <div className="text-8xl mb-6">🎉</div>
          <h1 className="text-6xl font-display font-bold mb-4">Thanks for playing!</h1>
          <p className="text-3xl text-white/70 mb-8">
            {s.gameNumber} round{s.gameNumber === 1 ? '' : 's'} played with {s.players.length} undercover agents.
          </p>
          <Logo className="text-3xl" />
          <Link to="/setup" className="block mt-10 text-gold underline text-lg">
            Host another session
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-6 flex flex-col gap-4">
      <ConnectionBanner connected={connected} isHost />

      {/* Header: phase banner and big room code (top-right) */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <Logo className="text-2xl lg:text-3xl" />
          <div className="mt-3 inline-flex items-center gap-3 rounded-2xl bg-white text-grape px-5 py-2 shadow-[0_5px_0_#c9b6ee]">
            <span className="text-3xl lg:text-4xl font-display font-bold">{phaseTitle(s)}</span>
            {s.gameNumber > 0 && (
              <span className="text-lg rounded-full bg-lilac px-3 text-grape/70">
                Game {s.gameNumber} · Pair {s.pairNumber}/{s.totalPairs}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-white/70 text-lg font-bold tracking-widest mb-1">ROOM CODE</div>
          <CodePill code={s.code} size="xl" />
          {s.phase !== 'lobby' && (
            <button className="block ml-auto text-white/70 underline mt-3" onClick={() => setShowJoin((v) => !v)}>
              {showJoin ? 'Hide' : 'Show'} join QR
            </button>
          )}
        </div>
      </header>

      {showJoin && s.phase !== 'lobby' && (
        <Card className="p-4 self-end">
          <JoinPanel code={s.code} compact />
        </Card>
      )}

      <main className="flex-1 grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        {/* Player list */}
        <Card className="p-4">
          <h2 className="text-xl font-bold text-white/80 mb-3">
            Players ({s.players.length}){s.gameNumber > 0 && s.phase !== 'lobby' && ` · ${participants.filter((p) => p.alive).length} alive`}
          </h2>
          <ul className="space-y-2">
            {s.players.map((p) => (
              <PlayerRow key={p.id} p={p} state={s} onKick={onKick} confirming={kickId === p.id} />
            ))}
          </ul>
          {s.players.length === 0 && <p className="text-white/50 italic text-lg">No one here yet…</p>}
        </Card>

        {/* Main stage */}
        <Card className="p-6 flex flex-col gap-6">
          {s.phase === 'lobby' && (
            <div className="flex flex-col lg:flex-row items-center justify-around gap-8 py-4">
              <JoinPanel code={s.code} />
              <div className="text-center max-w-md space-y-4">
                <p className="text-3xl font-bold">Join on your phone or laptop!</p>
                <p className="text-xl text-white/70">Everyone gets a secret word on their own device. Keep it hidden!</p>
                <div className="flex flex-col gap-3 text-lg text-left rounded-2xl bg-deep/40 ring-2 ring-white/10 p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="size-5 accent-blue-500" checked={s.settings.clueTimer} onChange={(e) => act('settings', { settings: { clueTimer: e.target.checked } })} />
                    30-second clue timer
                  </label>
                  <label className="flex items-center gap-3">
                    Discussion timer
                    <select
                      className="rounded-xl bg-white text-grape px-2 py-1"
                      value={s.settings.discussionSeconds}
                      onChange={(e) => act('settings', { settings: { discussionSeconds: Number(e.target.value) } })}
                    >
                      <option value={0}>Off</option>
                      <option value={60}>60s</option>
                      <option value={90}>90s</option>
                    </select>
                  </label>
                  <p className="text-sm text-white/60">Mr. White is only dealt when 5+ players are in the game.</p>
                </div>
              </div>
            </div>
          )}

          {s.phase === 'clues' && (
            <div className="text-center">
              {speaker ? (
                <p className="text-4xl font-display font-bold animate-fade-up" key={speaker.id}>
                  🎤 <span className="rounded-2xl bg-gold text-grape px-3">{speaker.name}</span>, it&apos;s your turn to give a clue!
                </p>
              ) : (
                <p className="text-4xl font-display font-bold animate-pop">All clues are in! Discuss or vote.</p>
              )}
            </div>
          )}

          {s.phase === 'discussion' && (
            <p className="text-4xl font-display font-bold text-center animate-pop">💬 Who seems suspicious? Talk it out on Zoom!</p>
          )}

          {s.phase === 'voting' && (
            <div className="text-center animate-pop">
              <p className="text-4xl font-display font-bold mb-2">🗳 Vote on your device!</p>
              {s.voting.candidates && (
                <p className="text-2xl text-gold mb-2">
                  Re-vote between: {s.voting.candidates.map((id) => s.players.find((p) => p.id === id)?.name).join(' vs ')}
                </p>
              )}
              <p className="inline-block mt-2 rounded-3xl bg-white text-grape px-8 py-3 text-6xl font-display font-bold shadow-[0_8px_0_#c9b6ee]">
                {s.voting.votedCount} / {s.voting.eligibleCount} voted
              </p>
            </div>
          )}

          {s.phase === 'reveal' && (
            <div>
              <VoteReveal reveal={s.reveal} big />
              {tied && <p className="text-3xl font-display font-bold text-gold text-center mt-6 animate-pop">It&apos;s a tie!</p>}
            </div>
          )}

          {s.phase === 'elimination' && <EliminationCard elimination={s.elimination} big />}

          {s.phase === 'gameover' && (
            <div className="space-y-6">
              <WinnerBanner winner={s.winner} big />
              <FinalRoles players={s.players} words={s.words} big />
            </div>
          )}

          {(s.timer || ['clues', 'discussion'].includes(s.phase)) && <TimerBar timer={s.timer} clockOffset={clockOffset} big />}

          {s.gameNumber > 0 && s.phase !== 'gameover' && (
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-3">📋 Clue Board</h2>
              <ClueBoard clues={s.clues} cycle={s.cycle} big />
            </div>
          )}
        </Card>
      </main>

      {/* Host controls */}
      <footer className="sticky bottom-0 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 bg-deep/85 backdrop-blur border-t-2 border-white/10 flex flex-wrap items-center gap-3">
        {controls}
        {error && <span className="text-undercover font-bold text-lg">{error}</span>}
        <span className="flex-1" />
        <Link to={`/rules`} target="_blank" className="text-white/50 hover:text-white underline">
          Rules
        </Link>
        {s.phase !== 'gameover' && (
          <Button
            variant={confirmEnd ? 'danger' : 'ghost'}
            size="sm"
            onClick={() => {
              if (confirmEnd) act('endSession');
              else {
                setConfirmEnd(true);
                setTimeout(() => setConfirmEnd(false), 3000);
              }
            }}
          >
            {confirmEnd ? 'Click again to end' : 'End session'}
          </Button>
        )}
      </footer>
    </div>
  );
}
