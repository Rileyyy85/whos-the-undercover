// Starts the real server and plays a game over HTTP + Socket.IO, like real phones would.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { io } from 'socket.io-client';

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const serverFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.js');
let proc;

before(async () => {
  proc = spawn(process.execPath, [serverFile], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
after(() => proc?.kill());

const post = (url, body) =>
  fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));

function client() {
  const s = io(BASE, { transports: ['websocket'], forceNew: true, reconnection: false });
  s.latest = null;
  s.on('state', (st) => (s.latest = st));
  return s;
}
const emit = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 2000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (fn()) return;
    await wait(20);
  }
  throw new Error('timeout waiting for condition');
}

test('health check and SPA fallback', async () => {
  const h = await fetch(`${BASE}/api/health`).then((r) => r.json());
  assert.equal(h.ok, true);
  const page = await fetch(`${BASE}/room/ABC123/player`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root">/);
  const api404 = await fetch(`${BASE}/api/nope`);
  assert.equal(api404.status, 404);
});

test('full game over sockets, with reconnect and privacy checks', async () => {
  const created = await post('/api/rooms', { pairs: [{ a: 'Coffee', b: 'Tea', mrWhite: true }, { a: 'Dog', b: 'Cat', mrWhite: false }], settings: { clueTimer: false } });
  assert.equal(created.status, 200);
  const { code, hostToken } = created.body;
  assert.match(code, /^[A-Z0-9]{6}$/);

  const host = client();
  assert.deepEqual(await emit(host, 'host:attach', { code, hostToken }), { ok: true });
  const bad = client();
  assert.equal((await emit(bad, 'host:attach', { code, hostToken: 'nope' })).error, 'not_host');
  bad.close();

  const names = ['Amy', 'Ben', 'Chen', 'Dana', 'Eli', 'Fay'];
  const players = [];
  for (const n of names) {
    const j = await post(`/api/rooms/${code.toLowerCase()}/players`, { name: n });
    assert.equal(j.status, 200, JSON.stringify(j.body));
    const s = client();
    s.token = j.body.token;
    s.pid = j.body.playerId;
    assert.equal((await emit(s, 'player:attach', { code, token: s.token })).ok, true);
    players.push(s);
  }
  const dup = await post(`/api/rooms/${code}/players`, { name: 'amy' });
  assert.equal(dup.status, 400);

  await until(() => host.latest?.players.length === 6 && host.latest.players.every((p) => p.connected));
  // Players can't do host things.
  assert.match((await emit(players[0], 'host:action', { type: 'start' })).error, /host/);

  assert.deepEqual(await emit(host, 'host:action', { type: 'start' }), { ok: true });
  await until(() => players.every((p) => p.latest?.phase === 'clues'));

  // Privacy: the host screen has no words/roles; each player sees only their own word.
  const hostJson = JSON.stringify(host.latest);
  assert.ok(!hostJson.includes('Tea') && !hostJson.includes('Coffee'));
  const words = players.map((p) => p.latest.me.word);
  const whites = players.filter((p) => p.latest.me.isMrWhite);
  assert.equal(whites.length, 1);
  assert.equal(words.filter((w) => w === 'Tea').length, 4);
  assert.equal(words.filter((w) => w === 'Coffee').length, 1);
  assert.notEqual(host.latest.currentSpeakerId, whites[0].pid, 'Mr. White must not speak first');

  // Reconnect: a phone drops and comes back with the same token, keeping its word.
  const dropIdx = players.findIndex((p) => p.latest.me.word === 'Tea');
  const before = players[dropIdx].latest.me.word;
  players[dropIdx].close();
  await until(() => host.latest.players.find((p) => p.id === players[dropIdx].pid).connected === false);
  const again = client();
  Object.assign(again, { token: players[dropIdx].token, pid: players[dropIdx].pid });
  assert.equal((await emit(again, 'player:attach', { code, token: again.token })).ok, true);
  players[dropIdx] = again;
  await until(() => again.latest?.me?.word === before);

  // Wrong player can't give a clue.
  const speakerId = host.latest.currentSpeakerId;
  const notSpeaker = players.find((p) => p.pid !== speakerId);
  assert.match((await emit(notSpeaker, 'player:clue', { text: 'hi' })).error, /not your turn/);

  // Everyone gives a clue in order (one turn gets skipped by the host).
  let turn = 0;
  while (host.latest.currentSpeakerId) {
    const sid = host.latest.currentSpeakerId;
    if (turn === 2) assert.deepEqual(await emit(host, 'host:action', { type: 'skipTurn' }), { ok: true });
    else assert.deepEqual(await emit(players.find((p) => p.pid === sid), 'player:clue', { text: `  clue number ${turn} that is way too long for the limit ` }), { ok: true });
    turn++;
    await until(() => host.latest.currentSpeakerId !== sid);
  }
  assert.equal(host.latest.clues.length, 6);
  assert.ok(host.latest.clues.every((c) => c.skipped || c.text.length <= 30));
  assert.equal(host.latest.clues.filter((c) => c.skipped).length, 1);

  assert.deepEqual(await emit(host, 'host:action', { type: 'discussion' }), { ok: true });
  await until(() => host.latest.phase === 'discussion' && host.latest.timer?.seconds === 90);
  assert.deepEqual(await emit(host, 'host:action', { type: 'voting' }), { ok: true });
  await until(() => players.every((p) => p.latest.phase === 'voting'));

  // Everyone votes for Mr. White.
  const white = players.find((p) => p.latest.me.isMrWhite);
  assert.match((await emit(white, 'player:vote', { targetId: white.pid })).error, /yourself/);
  for (const p of players) {
    const target = p === white ? players.find((x) => x !== white).pid : white.pid;
    assert.deepEqual(await emit(p, 'player:vote', { targetId: target }), { ok: true });
  }
  await until(() => host.latest.voting.votedCount === 6);
  assert.ok(!JSON.stringify(host.latest).includes(`"voters"`), 'who-voted-whom hidden before reveal');

  await emit(host, 'host:action', { type: 'reveal' });
  await until(() => host.latest.phase === 'reveal');
  assert.equal(host.latest.reveal.topIds[0], white.pid);
  await emit(host, 'host:action', { type: 'eliminate' });
  await until(() => white.latest.me.mustGuess === true);
  assert.equal(host.latest.elimination.role, 'mrwhite');

  // Mr. White guesses wrong: game continues.
  assert.deepEqual(await emit(white, 'player:guess', { guess: 'Coffee' }), { ok: true });
  await until(() => host.latest.elimination.guessPending === false);
  assert.equal(host.latest.phase, 'elimination');
  assert.equal(host.latest.elimination.guessCorrect, false);

  // Next clue round; then vote out the undercover -> civilians win.
  await emit(host, 'host:action', { type: 'nextClueRound' });
  await until(() => host.latest.phase === 'clues' && host.latest.cycle === 2);
  assert.equal(host.latest.speakingOrder.length, 5);
  while (host.latest.currentSpeakerId) {
    const sid = host.latest.currentSpeakerId;
    await emit(players.find((p) => p.pid === sid), 'player:clue', { text: 'again' });
    await until(() => host.latest.currentSpeakerId !== sid);
  }
  await emit(host, 'host:action', { type: 'voting' });
  await until(() => host.latest.phase === 'voting');
  const uc = players.find((p) => p.latest.me.word === 'Coffee');
  for (const p of players) {
    if (p === white) {
      assert.match((await emit(p, 'player:vote', { targetId: uc.pid })).error, /Only players still in/);
      continue;
    }
    const target = p === uc ? players.find((x) => x !== uc && x !== white).pid : uc.pid;
    await emit(p, 'player:vote', { targetId: target });
  }
  await emit(host, 'host:action', { type: 'reveal' });
  await emit(host, 'host:action', { type: 'eliminate' });
  await until(() => host.latest.phase === 'gameover');
  assert.equal(host.latest.winner.team, 'civilians');
  assert.deepEqual(host.latest.words, { civilian: 'Tea', undercover: 'Coffee' });
  assert.ok(host.latest.players.every((p) => p.role));

  // Next round: next pair, everyone back in.
  await emit(host, 'host:action', { type: 'nextGame' });
  await until(() => host.latest.phase === 'clues' && host.latest.gameNumber === 2);
  await until(() => players.every((p) => p.latest.me.alive && (p.latest.me.word === 'Cat' || p.latest.me.word === 'Dog')));

  // Kick a player.
  const victim = players[5];
  const kicked = new Promise((r) => victim.once('kicked', r));
  await emit(host, 'host:action', { type: 'kick', playerId: victim.pid });
  await kicked;
  await until(() => host.latest.players.length === 5);

  // Host refresh: re-attach with the same host token.
  host.close();
  await until(() => players[0].latest.hostConnected === false);
  const host2 = client();
  assert.deepEqual(await emit(host2, 'host:attach', { code, hostToken }), { ok: true });
  await until(() => players[0].latest.hostConnected === true && host2.latest?.gameNumber === 2);

  await emit(host2, 'host:action', { type: 'endSession' });
  await until(() => players[0].latest.phase === 'ended');

  host2.close();
  players.forEach((p) => p.close());
});
