import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
    'w-full rounded-2xl bg-ink/70 ring-1 ring-white/15 px-4 py-4 text-2xl outline-none focus:ring-2 focus:ring-civilian';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5">
      <Link to="/" className="mb-6">
        <Logo className="text-3xl text-center" />
      </Link>
      <Card className="w-full max-w-md p-6">
        <h1 className="text-3xl font-black mb-6 text-center">Join a Game</h1>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-white/70 font-bold">Room code</span>
            <input
              className={`${input} tracking-[0.3em] uppercase font-mono text-center`}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
            />
          </label>
          <label className="block">
            <span className="text-white/70 font-bold">Your name</span>
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
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
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
