import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRef } from 'react';
import { Button, Card, Logo } from '../components/ui.jsx';
import { lastName, tokens } from '../lib/storage.js';

export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState((params.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  const [name, setName] = useState(lastName.get());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const c = code.trim().toUpperCase();
    const n = name.trim();
    if (c.length !== 6) return setError('The room code has 6 characters.');
    if (!n) return setError('Please enter your name.');
    // Already joined this room in this tab? Go straight back in.
    if (tokens.get(c, 'player')) return navigate(`/room/${c}/player`);
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${c}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not join.');
      tokens.set(data.code, 'player', data.token);
      lastName.set(n);
      navigate(`/room/${data.code}/player`);
    } catch (err) {
      setError(err.message || 'Could not reach the server.');
      setBusy(false);
    }
  };

  const input =
    'w-full rounded-2xl bg-white text-grape px-4 py-4 text-2xl font-display outline-none ring-4 ring-transparent focus:ring-gold placeholder:text-grape/40';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5">
      <Link to="/" className="mb-6">
        <Logo className="text-3xl text-center" />
      </Link>
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="text-6xl text-center mb-2 animate-wiggle">🔑</div>
        <h1 className="text-3xl font-display font-bold mb-6 text-center">Join a Game</h1>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-white/80 font-bold block mb-2">Room code</span>
            <CodeBoxes value={code} onChange={setCode} />
          </label>
          <label className="block">
            <span className="text-white/80 font-bold block mb-2">Your name</span>
            <input
              className={input}
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              autoComplete="nickname"
              autoFocus={!!code}
            />
          </label>
          {error && <p className="text-undercover font-bold">{error}</p>}
          <Button type="submit" size="lg" variant="coral" className="w-full" disabled={busy}>
            {busy ? 'Joining…' : 'Join'}
          </Button>
        </form>
      </Card>
      <Link to="/rules" className="mt-6 text-white/60 hover:text-white underline">
        How to play
      </Link>
    </div>
  );
}

/** Six chunky boxes for the room code, backed by one real input (works with phone keyboards and paste). */
function CodeBoxes({ value, onChange }) {
  const ref = useRef(null);
  const chars = value.padEnd(6, ' ').split('');
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        className="absolute inset-0 w-full h-full opacity-0"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        autoCapitalize="characters"
        autoComplete="off"
        aria-label="Room code"
      />
      <div className="grid grid-cols-6 gap-2 pointer-events-none">
        {chars.map((c, i) => (
          <div
            key={i}
            className={`aspect-[4/5] grid place-items-center rounded-xl text-3xl font-display font-bold shadow-[0_5px_0_rgba(20,4,50,0.4)] ${
              c.trim() ? 'bg-white text-grape' : i === value.length ? 'bg-white/30 ring-4 ring-gold' : 'bg-white/15'
            }`}
          >
            {c.trim()}
          </div>
        ))}
      </div>
    </div>
  );
}
