import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Logo } from '../components/ui.jsx';
import { DEFAULT_PAIRS } from '../lib/wordPairs.js';
import { tokens } from '../lib/storage.js';

const STORE_KEY = 'wtu:pairs';
const SETTINGS_KEY = 'wtu:settings';

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Setup() {
  const navigate = useNavigate();
  const [pairs, setPairs] = useState(() => loadJSON(STORE_KEY, DEFAULT_PAIRS.slice(0, 7)));
  const [settings, setSettings] = useState(() => loadJSON(SETTINGS_KEY, { clueTimer: true, discussionSeconds: 90 }));
  const [draft, setDraft] = useState({ a: '', b: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(pairs));
  }, [pairs]);
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const update = (i, patch) => setPairs((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const remove = (i) => setPairs((ps) => ps.filter((_, j) => j !== i));
  const move = (i, d) =>
    setPairs((ps) => {
      const j = i + d;
      if (j < 0 || j >= ps.length) return ps;
      const a = [...ps];
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  const add = (e) => {
    e.preventDefault();
    const a = draft.a.trim();
    const b = draft.b.trim();
    if (!a || !b) return setError('Fill in both words.');
    if (a.toLowerCase() === b.toLowerCase()) return setError('The two words must be different.');
    setPairs((ps) => [...ps, { a, b, mrWhite: true }]);
    setDraft({ a: '', b: '' });
    setError('');
  };

  const valid = pairs.filter((p) => p.a.trim() && p.b.trim() && p.a.trim().toLowerCase() !== p.b.trim().toLowerCase());

  const create = async () => {
    setError('');
    if (valid.length === 0) return setError('Add at least one word pair.');
    setBusy(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairs: valid, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create room.');
      tokens.set(data.code, 'host', data.hostToken);
      navigate(`/room/${data.code}/host`);
    } catch (err) {
      setError(err.message || 'Could not reach the server.');
      setBusy(false);
    }
  };

  const input =
    'w-full rounded-xl bg-white text-grape px-3 py-2 text-lg font-display outline-none ring-4 ring-transparent focus:ring-gold placeholder:text-grape/40';

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <Link to="/">
          <Logo className="text-2xl sm:text-3xl" />
        </Link>
        <Link to="/rules" className="text-white/60 hover:text-white">
          Rules →
        </Link>
      </div>
      <h1 className="text-3xl sm:text-4xl font-display font-bold mb-1">Host setup</h1>
      <p className="text-white/80 mb-6 text-lg">
        Word A goes to the <b className="text-[#ff8a9b]">Undercover</b>, Word B to the{' '}
        <b className="text-[#8fd0ff]">Civilians</b>. We recommend 5–7 pairs for a 45-minute session. Pairs are played in
        this order.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => setPairs(DEFAULT_PAIRS)}>
          Load Defaults (20)
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setPairs((p) => shuffle(p))}>
          🔀 Shuffle order
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setPairs([])}>
          Clear all
        </Button>
      </div>

      <Card className="p-4 sm:p-6 mb-6">
        <div className="hidden sm:grid grid-cols-[2rem_1fr_1fr_7rem_6rem] gap-2 text-sm text-white/50 font-bold mb-2 px-1">
          <span>#</span>
          <span className="text-[#ff8a9b]">Word A (Undercover)</span>
          <span className="text-[#8fd0ff]">Word B (Civilians)</span>
          <span className="text-[#dcb4ff]">Mr. White</span>
          <span />
        </div>
        {pairs.length === 0 && <p className="text-white/50 italic p-2">No pairs yet. Load the defaults or add your own.</p>}
        <div className="space-y-2">
          {pairs.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-[2rem_1fr_1fr] sm:grid-cols-[2rem_1fr_1fr_7rem_6rem] gap-2 items-center rounded-2xl bg-deep/40 p-2"
            >
              <span className="text-gold font-display font-bold text-center text-xl">{i + 1}</span>
              <input className={input} value={p.a} maxLength={30} onChange={(e) => update(i, { a: e.target.value })} aria-label="Word A" />
              <input className={input} value={p.b} maxLength={30} onChange={(e) => update(i, { b: e.target.value })} aria-label="Word B" />
              <label className="col-start-2 sm:col-start-auto flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="size-5 accent-purple-500"
                  checked={p.mrWhite}
                  onChange={(e) => update(i, { mrWhite: e.target.checked })}
                />
                <span className="text-sm">{p.mrWhite ? 'On' : 'Off'}</span>
              </label>
              <div className="flex gap-1 justify-end">
                <button className="rounded-lg bg-white/10 hover:bg-white/20 size-9" onClick={() => move(i, -1)} aria-label="Move up">
                  ↑
                </button>
                <button className="rounded-lg bg-white/10 hover:bg-white/20 size-9" onClick={() => move(i, 1)} aria-label="Move down">
                  ↓
                </button>
                <button className="rounded-lg bg-k-red hover:brightness-110 size-9" onClick={() => remove(i)} aria-label="Delete">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mt-4 pt-4 border-t border-white/10">
          <input className={input} placeholder="Word A (Undercover)" value={draft.a} maxLength={30} onChange={(e) => setDraft({ ...draft, a: e.target.value })} />
          <input className={input} placeholder="Word B (Civilians)" value={draft.b} maxLength={30} onChange={(e) => setDraft({ ...draft, b: e.target.value })} />
          <Button size="sm" type="submit" variant="warn">
            + Add pair
          </Button>
        </form>
      </Card>

      <Card className="p-4 sm:p-6 mb-6 grid sm:grid-cols-2 gap-4 text-lg">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="size-6 accent-blue-500"
            checked={settings.clueTimer}
            onChange={(e) => setSettings({ ...settings, clueTimer: e.target.checked })}
          />
          30-second timer per clue
        </label>
        <label className="flex items-center gap-3">
          Discussion timer
          <select
            className="rounded-xl bg-white text-grape px-3 py-2"
            value={settings.discussionSeconds}
            onChange={(e) => setSettings({ ...settings, discussionSeconds: Number(e.target.value) })}
          >
            <option value={0}>Off</option>
            <option value={60}>60 seconds</option>
            <option value={90}>90 seconds</option>
          </select>
        </label>
      </Card>

      {error && <p className="text-[#ff8a9b] font-bold mb-4 text-lg">{error}</p>}
      <div className="flex items-center gap-4 flex-wrap">
        <Button size="lg" variant="coral" onClick={create} disabled={busy || valid.length === 0}>
          {busy ? 'Creating…' : 'Save & Generate Room'}
        </Button>
        <span className="text-white/60">
          {valid.length} pair{valid.length === 1 ? '' : 's'} ready
        </span>
      </div>
    </div>
  );
}
