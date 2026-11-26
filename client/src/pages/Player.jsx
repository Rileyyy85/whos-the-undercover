import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useRoom } from '../lib/useRoom.js';
import { tokens } from '../lib/storage.js';
import { Avatar, Button, Card, ClueBoard, CodePill, ConnectionBanner, RoleTag, TILES, TimerBar, VoteReveal } from '../components/ui.jsx';
import { EliminationCard, FinalRoles, WinnerBanner, phaseTitle } from '../components/game.jsx';

function Message({ title, children }) {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <Card className="p-8 max-w-md">
        <h1 className="text-3xl font-display font-bold mb-3">{title}</h1>
        <div className="text-lg text-white/80 space-y-4">{children}</div>
      </Card>
    </div>
  );
}

/** Secret word card: hidden by default, tap to reveal / hide, so people nearby on camera can't see. */
function WordCard({ me, gameNumber }) {
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(false), [gameNumber]);
  if (!me?.inGame || gameNumber === 0) return null;
  return (
    <button
      onClick={() => setShown((v) => !v)}
      className={`w-full rounded-[28px] p-6 text-center select-none transition active:translate-y-1 ${
        shown
          ? me.isMrWhite
            ? 'bg-mrwhite text-white shadow-[0_8px_0_#6a1fb3]'
            : 'bg-white text-grape shadow-[0_8px_0_#c9b6ee]'
          : 'bg-gradient-to-br from-[#7b3fe4] to-[#5a1fc0] ring-4 ring-white/20 shadow-[0_8px_0_rgba(20,4,50,0.5)]'
      }`}
    >
      {shown ? (
        me.isMrWhite ? (
          <div className="animate-flip">
            <div className="text-5xl mb-2">👻</div>
            <div className="text-3xl font-display font-bold">You are Mr. White</div>
            <div className="text-xl">You have no word. Blend in!</div>
          </div>
        ) : (
          <div className="animate-flip">
            <div className="text-grape/60 text-base tracking-widest">YOUR SECRET WORD</div>
            <div className="text-6xl font-display font-bold my-2 break-words">{me.word}</div>
          </div>
        )
      ) : (
        <div>
          <div className="text-6xl mb-2 inline-block animate-wiggle">🔑</div>
          <div className="text-2xl font-display font-bold">Tap to reveal your word</div>
          <div className="text-white/70 text-sm mt-1">Keep it hidden from your camera!</div>
        </div>
      )}
      {shown && <div className="opacity-60 text-sm mt-3">Tap to hide</div>}
    </button>
  );
}

function ClueInput({ emit, onError }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const res = await emit('player:clue', { text });
    setBusy(false);
    if (res?.error) onError(res.error);
    else setText('');
  };
  return (
    <form onSubmit={submit} className="space-y-3 animate-pop">
      <p className="text-3xl font-display font-bold text-gold text-center">🎤 Your turn!</p>
      <input
        className="w-full rounded-2xl bg-white text-grape ring-4 ring-gold px-4 py-4 text-2xl font-display outline-none placeholder:text-grape/40"
        value={text}
        maxLength={30}
        onChange={(e) => setText(e.target.value)}
        placeholder="One word or short clue"
        autoFocus
        autoComplete="off"
        enterKeyHint="send"
      />
      <div className="flex justify-between text-white/50 text-sm">
        <span>Don&apos;t say your word itself!</span>
        <span>{text.length}/30</span>
      </div>
      <Button type="submit" size="lg" variant="coral" className="w-full" disabled={busy || !text.trim()}>
        Send clue
      </Button>
    </form>
  );
}

function GuessInput({ emit, onError }) {
  const [guess, setGuess] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!guess.trim()) return;
    setBusy(true);
    const res = await emit('player:guess', { guess });
    setBusy(false);
    if (res?.error) onError(res.error);
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-[28px] bg-mrwhite p-5 shadow-[0_8px_0_#6a1fb3] animate-pop">
      <p className="text-2xl font-display font-bold text-center">👻 One secret guess!</p>
      <p className="text-center text-white/90">What is the Civilians&apos; word? Guess right and you win.</p>
      <input
        className="w-full rounded-2xl bg-white text-grape ring-4 ring-mrwhite px-4 py-4 text-2xl font-display outline-none placeholder:text-grape/40"
        value={guess}
        maxLength={30}
        onChange={(e) => setGuess(e.target.value)}
        placeholder="Your guess"
        autoFocus
        autoComplete="off"
      />
      <Button type="submit" size="lg" variant="warn" className="w-full" disabled={busy || !guess.trim()}>
        Submit guess
      </Button>
    </form>
  );
}

export default function Player() {
  const { code: rawCode } = useParams();
  const code = rawCode.toUpperCase();
  const [token] = useState(() => tokens.get(code, 'player'));
  const { state, connected, fatal, emit, clockOffset } = useRoom({ code, kind: 'player', token });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (fatal === 'kicked' || fatal === 'not_player' || fatal === 'not_found') tokens.clear(code, 'player');
  }, [fatal, code]);

  if (!token) return <Navigate to={`/join?code=${code}`} replace />;
  if (fatal === 'kicked') {
    return (
      <Message title="You were removed">
        <p>The host removed you from room {code}.</p>
        <Link className="underline text-gold" to={`/join?code=${code}`}>Join again</Link>
      </Message>
    );
  }
  if (fatal === 'not_found' || fatal === 'not_player') {
    return (
      <Message title={fatal === 'not_found' ? 'Room not found' : 'Seat not found'}>
        <p>{fatal === 'not_found' ? `Room ${code} no longer exists. Ask your host for the new code.` : 'Please join the room again.'}</p>
        <Link className="underline text-gold" to={`/join?code=${code}`}>Go to Join</Link>
      </Message>
    );
  }
  if (fatal === 'replaced') {
    return (
      <Message title="Opened elsewhere">
        <p>You opened this game in another tab or device. Use that one, or reload here to take over.</p>
      </Message>
    );
  }
  if (!state?.me) {
    return (
      <>
        <ConnectionBanner connected={connected} />
        <Message title="Connecting…">
          <p>Joining room {code}</p>
        </Message>
      </>
    );
  }

  const s = state;
  const me = s.me;
  const speaker = s.players.find((p) => p.id === s.currentSpeakerId);
  const myTurn = s.phase === 'clues' && s.currentSpeakerId === me.id;
  const eliminated = me.inGame && !me.alive && s.gameNumber > 0 && s.phase !== 'gameover' && s.phase !== 'lobby';
  const spectator = !me.inGame && !['lobby', 'ended'].includes(s.phase);
  const vote = async (targetId) => {
    const res = await emit('player:vote', { targetId });
    if (res?.error) setError(res.error);
  };
  const nameOf = (id) => s.players.find((p) => p.id === id)?.name;

  if (s.phase === 'ended') {
    return (
      <Message title="Thanks for playing! 🎉">
        <p>The host has ended the session. See you next time, {me.name}!</p>
      </Message>
    );
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto p-4 pb-10 flex flex-col gap-4">
      <ConnectionBanner connected={connected} hostConnected={s.hostConnected} />

      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <Avatar id={me.id} size={44} />
          <div>
            <div className="text-white/60 text-sm">Playing as</div>
            <div className="text-2xl font-display font-bold leading-tight">{me.name}</div>
          </div>
        </div>
        <CodePill code={s.code} size="sm" />
      </header>

      <div className="rounded-2xl bg-white text-grape px-4 py-2 text-center text-xl font-display font-bold shadow-[0_5px_0_#c9b6ee]">{phaseTitle(s)}</div>

      {eliminated && (
        <div className="rounded-2xl bg-deep/50 ring-2 ring-white/15 p-4 text-center text-lg font-bold">
          ☠ You&apos;ve been eliminated. You can still watch!
        </div>
      )}
      {spectator && (
        <div className="rounded-2xl bg-deep/50 ring-2 ring-white/15 p-4 text-center text-lg font-bold">
          👀 A game is in progress. You&apos;ll be dealt in next round!
        </div>
      )}

      {s.phase !== 'gameover' && <WordCard me={me} gameNumber={s.gameNumber} />}

      {error && <div className="rounded-2xl bg-k-red p-3 text-center font-bold shadow-[0_5px_0_#a3102a]">{error}</div>}

      {s.phase === 'lobby' && (
        <Card className="p-5 text-center">
          <p className="text-2xl font-bold mb-2">You&apos;re in! ✅</p>
          <p className="text-white/70 mb-4">Waiting for the host to start…</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {s.players.map((p) => (
              <span key={p.id} className={`inline-flex items-center gap-2 rounded-full pl-1 pr-3 py-1 font-display ${p.id === me.id ? 'bg-gold text-grape' : 'bg-white text-grape'}`}>
                <Avatar id={p.id} size={28} />
                {p.name}
              </span>
            ))}
          </div>
          <Link to="/rules" target="_blank" className="block mt-4 text-white/60 underline">
            How to play
          </Link>
        </Card>
      )}

      {s.phase === 'clues' && (
        <Card className="p-5">
          {myTurn ? (
            <ClueInput emit={emit} onError={setError} />
          ) : (
            <p className="text-xl text-center">
              {speaker ? (
                <>
                  Waiting for <b className="text-gold">{speaker.name}</b> to give a clue…
                </>
              ) : (
                'All clues are in!'
              )}
            </p>
          )}
          {s.timer && (
            <div className="mt-4">
              <TimerBar timer={s.timer} clockOffset={clockOffset} />
            </div>
          )}
        </Card>
      )}

      {s.phase === 'discussion' && (
        <Card className="p-5 text-center space-y-4">
          <p className="text-2xl font-bold">💬 Discuss on Zoom!</p>
          <p className="text-white/70">Who seems suspicious?</p>
          <TimerBar timer={s.timer} clockOffset={clockOffset} />
        </Card>
      )}

      {s.phase === 'voting' && (
        <Card className="p-5">
          {me.votable.length > 0 ? (
            <>
              <p className="text-2xl font-bold text-center mb-1">🗳 Who is the Undercover?</p>
              <p className="text-white/60 text-center mb-4">
                {me.myVote ? `You voted for ${nameOf(me.myVote)}. You can change it until the reveal.` : 'Tap a player to vote.'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {me.votable.map((id, i) => {
                  const tile = TILES[i % TILES.length];
                  const picked = me.myVote === id;
                  return (
                    <button
                      key={id}
                      onClick={() => vote(id)}
                      style={{ boxShadow: picked ? 'none' : `0 6px 0 ${tile.edge}` }}
                      className={`relative rounded-2xl px-3 py-5 text-xl font-display font-bold text-white transition ${tile.bg} ${
                        picked ? 'translate-y-1 ring-4 ring-white scale-105' : me.myVote ? 'opacity-75 saturate-75' : ''
                      }`}
                    >
                      <span className="absolute left-2 top-1 text-sm opacity-70">{tile.shape}</span>
                      <span className="flex flex-col items-center gap-1">
                        <Avatar id={id} size={36} />
                        {nameOf(id)}
                      </span>
                      {picked && <span className="absolute right-2 top-1">✔</span>}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xl text-center">Votes are coming in…</p>
          )}
          <p className="text-center text-white/60 mt-4">
            {s.voting.votedCount}/{s.voting.eligibleCount} voted
          </p>
        </Card>
      )}

      {s.phase === 'reveal' && (
        <Card className="p-5">
          <VoteReveal reveal={s.reveal} />
          {s.reveal?.tie && <p className="text-center font-display font-bold text-gold text-2xl mt-4">It&apos;s a tie!</p>}
        </Card>
      )}

      {s.phase === 'elimination' && (
        <>
          {me.mustGuess ? <GuessInput emit={emit} onError={setError} /> : <EliminationCard elimination={s.elimination} />}
        </>
      )}

      {s.phase === 'gameover' && (
        <div className="space-y-4">
          <WinnerBanner winner={s.winner} />
          {me.inGame && (
            <p className="text-center text-xl">
              You were: <RoleTag role={s.players.find((p) => p.id === me.id)?.role} />
            </p>
          )}
          <Card className="p-4">
            <FinalRoles players={s.players} words={s.words} />
          </Card>
          <p className="text-center text-white/60">Waiting for the host…</p>
        </div>
      )}

      {s.gameNumber > 0 && !['gameover', 'lobby'].includes(s.phase) && (
        <Card className="p-4">
          <h2 className="font-display font-bold text-white/80 mb-2">📋 Clues</h2>
          <ClueBoard clues={s.clues} cycle={s.cycle} />
        </Card>
      )}
    </div>
  );
}
