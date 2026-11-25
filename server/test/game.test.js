import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, checkWinner, shuffle, undercoverCount, sanitizePairs, RoomStore } from '../game.js';

const pairs = [{ a: 'Coffee', b: 'Tea', mrWhite: true }, { a: 'Dog', b: 'Cat', mrWhite: false }];

function room(n, opts = {}) {
  const r = new Room({ code: 'TEST01', pairs: opts.pairs ?? pairs, settings: { clueTimer: false } });
  for (let i = 0; i < n; i++) r.addPlayer(`P${i}`);
  return r;
}

test('shuffle keeps every element', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual([...shuffle(a)].sort(), a);
});

test('undercover count: 1 for 4-7, 2 for 8+', () => {
  assert.equal(undercoverCount(4), 1);
  assert.equal(undercoverCount(7), 1);
  assert.equal(undercoverCount(8), 2);
  assert.equal(undercoverCount(12), 2);
});

test('role assignment by player count', () => {
  for (const n of [4, 5, 7, 8, 12]) {
    const r = room(n);
    r.startGame();
    const roles = r.players.map((p) => p.role);
    const count = (x) => roles.filter((y) => y === x).length;
    assert.equal(count('undercover'), n >= 8 ? 2 : 1, `undercovers for ${n}`);
    assert.equal(count('mrwhite'), n >= 5 ? 1 : 0, `mr white for ${n}`);
    assert.equal(count('civilian'), n - count('undercover') - count('mrwhite'));
    for (const p of r.players) {
      if (p.role === 'civilian') assert.equal(p.word, 'Tea');
      if (p.role === 'undercover') assert.equal(p.word, 'Coffee');
      if (p.role === 'mrwhite') assert.equal(p.word, null);
    }
  }
});

test('Mr. White is never the first speaker', () => {
  for (let i = 0; i < 300; i++) {
    const r = room(6);
    r.startGame();
    assert.notEqual(r.getPlayer(r.speakingOrder[0]).role, 'mrwhite');
  }
});

test('Mr. White off for a pair', () => {
  const r = room(6, { pairs: [{ a: 'Dog', b: 'Cat', mrWhite: false }] });
  r.startGame();
  assert.equal(r.players.filter((p) => p.role === 'mrwhite').length, 0);
});

test('need 4 players to start', () => {
  const r = room(3);
  assert.throws(() => r.startGame(), /at least 4/);
});

test('duplicate names rejected, limits applied', () => {
  const r = room(1);
  r.players[0].connected = true;
  assert.throws(() => r.addPlayer('p0'), /taken/);
  const long = r.addPlayer('   A very very long name that goes on   ');
  assert.equal(long.name.length, 20);
});

test('disconnected player can reclaim their name', () => {
  const r = room(4);
  const p = r.players[0];
  const oldToken = p.token;
  const back = r.addPlayer('P0');
  assert.equal(back.id, p.id);
  assert.notEqual(back.token, oldToken);
});

test('win conditions', () => {
  const P = (role) => ({ role });
  assert.equal(checkWinner([P('civilian'), P('civilian')]).team, 'civilians');
  assert.equal(checkWinner([P('undercover'), P('civilian')]).team, 'undercover');
  assert.equal(checkWinner([P('undercover'), P('civilian'), P('civilian')]), null);
  assert.equal(checkWinner([P('mrwhite'), P('civilian')]).team, 'mrwhite');
  assert.equal(checkWinner([P('undercover'), P('mrwhite'), P('civilian'), P('civilian')]).team, 'undercover');
  assert.equal(checkWinner([P('undercover'), P('mrwhite'), P('civilian'), P('civilian'), P('civilian')]), null);
});

function playClues(r) {
  while (r.currentSpeakerId) r.submitClue(r.currentSpeakerId, 'clue');
}
function voteFor(r, targetId) {
  for (const p of r.alivePlayers) {
    const t = p.id === targetId ? r.alivePlayers.find((x) => x.id !== targetId).id : targetId;
    r.castVote(p.id, t);
  }
}

test('full flow: civilians win by voting out the undercover (no Mr. White)', () => {
  const r = room(4);
  r.startGame();
  assert.equal(r.phase, 'clues');
  assert.throws(() => r.startVoting(), /Wait until everyone/);
  playClues(r);
  r.startDiscussion();
  assert.equal(r.timer.kind, 'discussion');
  r.startVoting();
  const u = r.players.find((p) => p.role === 'undercover');
  voteFor(r, u.id);
  r.revealVotes();
  assert.equal(r.reveal.tie, false);
  r.eliminate();
  assert.equal(r.phase, 'gameover');
  assert.equal(r.winner.team, 'civilians');
});

test('cannot vote for self or eliminated player', () => {
  const r = room(5);
  r.startGame();
  playClues(r);
  r.startVoting();
  const [a] = r.players;
  assert.throws(() => r.castVote(a.id, a.id), /yourself/);
});

test('tie: re-vote among tied players, or no elimination', () => {
  const r = room(4, { pairs: [{ a: 'Dog', b: 'Cat', mrWhite: false }] });
  r.startGame();
  playClues(r);
  r.startVoting();
  const [a, b, c, d] = r.players;
  r.castVote(a.id, b.id);
  r.castVote(b.id, a.id);
  r.castVote(c.id, a.id);
  r.castVote(d.id, b.id);
  r.revealVotes();
  assert.equal(r.reveal.tie, true);
  assert.throws(() => r.eliminate(), /tie/);
  r.revoteTied();
  assert.deepEqual([...r.voteCandidates].sort(), [a.id, b.id].sort());
  assert.throws(() => r.castVote(a.id, c.id), /can’t vote/);
  r.castVote(c.id, a.id);
  r.castVote(d.id, a.id);
  r.castVote(b.id, a.id);
  r.castVote(a.id, b.id);
  r.revealVotes();
  assert.equal(r.reveal.tie, false);
  assert.equal(r.reveal.topIds[0], a.id);
});

test('Mr. White correct guess wins; wrong guess continues', () => {
  for (const [guess, expectWin] of [['  tEa ', true], ['coffee', false]]) {
    const r = room(6);
    r.startGame();
    playClues(r);
    r.startVoting();
    const w = r.players.find((p) => p.role === 'mrwhite');
    voteFor(r, w.id);
    r.revealVotes();
    r.eliminate();
    assert.equal(r.elimination.guessPending, true);
    assert.throws(() => r.nextClueRound(), /Mr. White/);
    const other = r.players.find((p) => p.id !== w.id);
    assert.throws(() => r.mrWhiteGuess(other.id, 'tea'));
    r.mrWhiteGuess(w.id, guess);
    if (expectWin) {
      assert.equal(r.phase, 'gameover');
      assert.equal(r.winner.team, 'mrwhite');
    } else {
      assert.equal(r.phase, 'elimination');
      r.nextClueRound();
      assert.equal(r.phase, 'clues');
      assert.equal(r.cycle, 2);
      assert.equal(r.speakingOrder.length, 5);
    }
  }
});

test('undercover wins at final two', () => {
  const r = room(4, { pairs: [{ a: 'Dog', b: 'Cat', mrWhite: false }] });
  r.startGame();
  for (let i = 0; i < 2; i++) {
    playClues(r);
    r.startVoting();
    const civ = r.alivePlayers.find((p) => p.role === 'civilian');
    voteFor(r, civ.id);
    r.revealVotes();
    r.eliminate();
    if (r.phase === 'gameover') break;
    r.nextClueRound();
  }
  assert.equal(r.phase, 'gameover');
  assert.equal(r.winner.team, 'undercover');
});

test('next game: next pair, everyone revived, late joiner dealt in', () => {
  const r = room(4);
  r.startGame();
  const late = r.addPlayer('Late');
  assert.equal(late.inGame, false);
  playClues(r);
  r.startVoting();
  const u = r.players.find((p) => p.role === 'undercover');
  voteFor(r, u.id);
  r.revealVotes();
  r.eliminate();
  assert.equal(r.phase, 'gameover');
  r.nextGame();
  assert.equal(r.pairIndex, 1);
  assert.equal(r.players.every((p) => p.inGame && p.alive), true);
  assert.equal(r.players.find((p) => p.role === 'undercover').word, 'Dog');
  assert.throws(() => {
    playClues(r);
    r.startVoting();
    const uu = r.players.find((p) => p.role === 'undercover');
    voteFor(r, uu.id);
    r.revealVotes();
    r.eliminate();
    r.nextGame();
  }, /last word pair/);
});

test('kick current speaker advances turn', () => {
  let r;
  do {
    r = room(6);
    r.startGame();
  } while (r.getPlayer(r.currentSpeakerId).role !== 'civilian');
  const first = r.currentSpeakerId;
  const second = r.speakingOrder[1];
  r.kick(first);
  assert.equal(r.currentSpeakerId, second);
  assert.equal(r.phase, 'clues');
});

test('kicking the last undercover ends the game for civilians', () => {
  const r = room(4, { pairs: [{ a: 'Dog', b: 'Cat', mrWhite: false }] });
  r.startGame();
  r.kick(r.players.find((p) => p.role === 'undercover').id);
  assert.equal(r.phase, 'gameover');
  assert.equal(r.winner.team, 'civilians');
});

test('host view never leaks words or roles mid-game', () => {
  const r = room(6);
  r.startGame();
  const json = JSON.stringify(r.hostView());
  assert.equal(json.includes('Tea'), false);
  assert.equal(json.includes('Coffee'), false);
  assert.equal(/"role":"(civilian|undercover|mrwhite)"/.test(json), false);
  // A player's view holds only their own word, never their role or other words.
  const civ = r.players.find((p) => p.role === 'civilian');
  const pv = JSON.stringify(r.playerView(civ.id));
  assert.equal(pv.includes('Coffee'), false);
  assert.equal(/"role":"(civilian|undercover|mrwhite)"/.test(pv), false);
});

test('sanitizePairs drops invalid pairs', () => {
  assert.equal(sanitizePairs([{ a: 'x', b: 'X' }, { a: '', b: 'y' }, { a: 'a', b: 'b' }]).length, 1);
  assert.throws(() => sanitizePairs([]), /at least one/);
});

test('idle rooms are swept', () => {
  const s = new RoomStore();
  const r = s.create(pairs);
  r.lastActivity = Date.now() - 3 * 3600 * 1000;
  assert.deepEqual(s.sweep(2 * 3600 * 1000), [r.code]);
  assert.equal(s.rooms.size, 0);
});
