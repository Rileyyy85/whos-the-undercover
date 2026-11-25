// Core game logic for "Who's the Undercover?".
// Everything lives in memory. A Room holds players, word pairs and the current phase.
import crypto from 'node:crypto';

export const LIMITS = {
  name: 20,
  clue: 30,
  word: 30,
  minPlayers: 4,
  maxPlayers: 12,
  // Mr. White is only dealt when there are at least this many players,
  // otherwise a 4-player game with 1 Undercover + 1 Mr. White leaves only 2 Civilians.
  mrWhiteMinPlayers: 5,
  maxPairs: 50,
};

export const CLUE_SECONDS = 30;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

export class GameError extends Error {}

/** Fisher-Yates shuffle using a cryptographically strong RNG. Returns a new array. */
export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cleanText(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function undercoverCount(playerCount) {
  return playerCount >= 8 ? 2 : 1;
}

export function normalizeWord(w) {
  return cleanText(w, 100).toLowerCase();
}

export function sanitizePairs(pairs) {
  if (!Array.isArray(pairs)) throw new GameError('Word pairs are missing.');
  const clean = pairs
    .slice(0, LIMITS.maxPairs)
    .map((p) => ({
      a: cleanText(p?.a, LIMITS.word),
      b: cleanText(p?.b, LIMITS.word),
      mrWhite: p?.mrWhite !== false,
    }))
    .filter((p) => p.a && p.b && normalizeWord(p.a) !== normalizeWord(p.b));
  if (clean.length === 0) throw new GameError('Add at least one valid word pair (two different words).');
  return clean;
}

/**
 * Decide who wins, given the people still alive.
 * - Civilians win when every Undercover and Mr. White is out.
 * - The infiltrators (Undercover + Mr. White) win once they are at least as many as the Civilians.
 *   This also covers "an Undercover survives to the final 2".
 */
export function checkWinner(alive) {
  const u = alive.filter((p) => p.role === 'undercover').length;
  const w = alive.filter((p) => p.role === 'mrwhite').length;
  const c = alive.filter((p) => p.role === 'civilian').length;
  if (u === 0 && w === 0) return { team: 'civilians', reason: 'All infiltrators were found!' };
  if (u + w >= c) {
    if (u > 0) return { team: 'undercover', reason: 'The Undercover survived until the end!' };
    return { team: 'mrwhite', reason: 'Mr. White blended in until the end!' };
  }
  return null;
}

function id(len = 8) {
  return crypto.randomBytes(16).toString('base64url').slice(0, len);
}

export class Room {
  constructor({ code, pairs, settings = {} }) {
    this.code = code;
    this.hostToken = crypto.randomUUID();
    this.hostSocketId = null;
    this.hostConnected = false;
    this.pairs = sanitizePairs(pairs);
    this.pairIndex = 0;
    this.settings = {
      clueTimer: settings.clueTimer !== false,
      discussionSeconds: [0, 60, 90].includes(settings.discussionSeconds) ? settings.discussionSeconds : 90,
    };
    this.players = []; // { id, token, name, socketId, connected, inGame, alive, role, word }
    this.phase = 'lobby'; // lobby | clues | discussion | voting | reveal | elimination | gameover | ended
    this.gameNumber = 0;
    this.cycle = 0;
    this.speakingOrder = [];
    this.speakerIdx = 0;
    this.clues = []; // { cycle, playerId, text, skipped }
    this.votes = {}; // voterId -> targetId
    this.voteCandidates = null; // null = anyone alive; array of ids during a tie re-vote
    this.reveal = null; // { tally, topIds, tie }
    this.elimination = null; // { playerId, role, word, guessPending, guess, guessCorrect } or { playerId: null }
    this.timer = null; // { kind, endsAt, seconds }
    this.winner = null;
    this.lastActivity = Date.now();
    this.onChange = () => {};
    this._timeout = null;
  }

  touch() {
    this.lastActivity = Date.now();
  }

  get currentPair() {
    return this.pairs[this.pairIndex] ?? null;
  }

  get participants() {
    return this.players.filter((p) => p.inGame);
  }

  get alivePlayers() {
    return this.players.filter((p) => p.inGame && p.alive);
  }

  get currentSpeakerId() {
    if (this.phase !== 'clues') return null;
    return this.speakingOrder[this.speakerIdx] ?? null;
  }

  get inProgress() {
    return ['clues', 'discussion', 'voting', 'reveal', 'elimination'].includes(this.phase);
  }

  getPlayer(playerId) {
    return this.players.find((p) => p.id === playerId) ?? null;
  }

  // ---------- players ----------

  addPlayer(rawName) {
    const name = cleanText(rawName, LIMITS.name);
    if (!name) throw new GameError('Please enter your name.');
    if (this.phase === 'ended') throw new GameError('This session has ended.');
    const existing = this.players.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Allow someone whose tab was closed to take back their seat, but never steal a live seat.
      if (!existing.connected) {
        existing.token = crypto.randomUUID();
        this.touch();
        return existing;
      }
      throw new GameError('That name is already taken in this room. Try another one.');
    }
    if (this.players.length >= LIMITS.maxPlayers) throw new GameError(`This room is full (max ${LIMITS.maxPlayers} players).`);
    const player = {
      id: id(),
      token: crypto.randomUUID(),
      name,
      socketId: null,
      connected: false,
      // People who join mid-game watch until the next round starts.
      inGame: this.phase === 'lobby',
      alive: false,
      role: null,
      word: null,
    };
    this.players.push(player);
    this.touch();
    return player;
  }

  findByToken(token) {
    return token ? this.players.find((p) => p.token === token) ?? null : null;
  }

  kick(playerId) {
    const p = this.getPlayer(playerId);
    if (!p) throw new GameError('Player not found.');
    const wasSpeaker = this.currentSpeakerId === playerId;
    this.players = this.players.filter((x) => x.id !== playerId);
    delete this.votes[playerId];
    for (const [voter, target] of Object.entries(this.votes)) if (target === playerId) delete this.votes[voter];
    if (this.voteCandidates) this.voteCandidates = this.voteCandidates.filter((x) => x !== playerId);
    if (this.inProgress) {
      if (this.phase === 'clues') {
        const idx = this.speakingOrder.indexOf(playerId);
        if (idx !== -1) {
          this.speakingOrder.splice(idx, 1);
          if (idx < this.speakerIdx) this.speakerIdx--;
        }
        if (wasSpeaker) this._startSpeakerTimer();
      }
      if (this.elimination?.playerId === playerId && this.elimination.guessPending) {
        this.elimination.guessPending = false;
      }
      if (this.participants.length > 0 && p.inGame && p.alive) {
        const w = checkWinner(this.alivePlayers);
        if (w && !this.elimination?.guessPending) this._endGame(w);
      }
    }
    this.touch();
    return p;
  }

  // ---------- game flow ----------

  startGame() {
    if (!['lobby', 'gameover'].includes(this.phase)) throw new GameError('A game is already running.');
    const pair = this.currentPair;
    if (!pair) throw new GameError('No more word pairs. Add more on the setup page or end the session.');
    for (const p of this.players) p.inGame = true;
    const players = this.participants;
    if (players.length < LIMITS.minPlayers) throw new GameError(`Need at least ${LIMITS.minPlayers} players to start.`);

    const shuffled = shuffle(players);
    const uCount = undercoverCount(players.length);
    const withWhite = pair.mrWhite && players.length >= LIMITS.mrWhiteMinPlayers;
    shuffled.forEach((p, i) => {
      p.alive = true;
      if (i < uCount) {
        p.role = 'undercover';
        p.word = pair.a;
      } else if (withWhite && i === uCount) {
        p.role = 'mrwhite';
        p.word = null;
      } else {
        p.role = 'civilian';
        p.word = pair.b;
      }
    });

    this.gameNumber++;
    this.cycle = 0;
    this.clues = [];
    this.winner = null;
    this._startClueCycle();
  }

  _startClueCycle() {
    this.cycle++;
    this.votes = {};
    this.voteCandidates = null;
    this.reveal = null;
    this.elimination = null;
    let order = shuffle(this.alivePlayers.map((p) => p.id));
    // Mr. White must never speak first.
    if (order.length > 1 && this.getPlayer(order[0])?.role === 'mrwhite') {
      const swap = order.findIndex((pid) => this.getPlayer(pid)?.role !== 'mrwhite');
      [order[0], order[swap]] = [order[swap], order[0]];
    }
    this.speakingOrder = order;
    this.speakerIdx = 0;
    this.phase = 'clues';
    this._startSpeakerTimer();
    this.touch();
  }

  nextClueRound() {
    if (this.phase !== 'elimination') throw new GameError('Finish the current round first.');
    if (this.elimination?.guessPending) throw new GameError('Waiting for Mr. White to guess.');
    this._startClueCycle();
  }

  _clearTimer() {
    if (this._timeout) clearTimeout(this._timeout);
    this._timeout = null;
    this.timer = null;
  }

  _startSpeakerTimer() {
    this._clearTimer();
    if (this.phase !== 'clues' || !this.currentSpeakerId || !this.settings.clueTimer) return;
    const seconds = CLUE_SECONDS;
    this.timer = { kind: 'clue', seconds, endsAt: Date.now() + seconds * 1000 };
    const speaker = this.currentSpeakerId;
    this._timeout = setTimeout(() => {
      if (this.phase === 'clues' && this.currentSpeakerId === speaker) {
        this._advanceSpeaker({ skipped: true });
        this.onChange();
      }
    }, seconds * 1000 + 250);
  }

  _advanceSpeaker({ text = '', skipped = false } = {}) {
    const pid = this.currentSpeakerId;
    if (!pid) return;
    this.clues.push({ cycle: this.cycle, playerId: pid, text, skipped });
    this.speakerIdx++;
    this._startSpeakerTimer();
    this.touch();
  }

  submitClue(playerId, rawText) {
    if (this.phase !== 'clues') throw new GameError('It is not clue time.');
    if (this.currentSpeakerId !== playerId) throw new GameError("It's not your turn yet.");
    const text = cleanText(rawText, LIMITS.clue);
    if (!text) throw new GameError('Type a clue first.');
    this._advanceSpeaker({ text });
  }

  skipTurn() {
    if (this.phase !== 'clues' || !this.currentSpeakerId) throw new GameError('Nobody is speaking right now.');
    this._advanceSpeaker({ skipped: true });
  }

  startDiscussion() {
    if (!['clues', 'discussion'].includes(this.phase)) throw new GameError('Discussion comes after the clues.');
    if (this.phase === 'clues' && this.currentSpeakerId) throw new GameError('Wait until everyone has given a clue (or skip).');
    this._clearTimer();
    this.phase = 'discussion';
    const s = this.settings.discussionSeconds;
    if (s > 0) this.timer = { kind: 'discussion', seconds: s, endsAt: Date.now() + s * 1000 };
    this.touch();
  }

  startVoting() {
    if (!['clues', 'discussion'].includes(this.phase)) throw new GameError('Voting comes after clues or discussion.');
    if (this.phase === 'clues' && this.currentSpeakerId) throw new GameError('Wait until everyone has given a clue (or skip).');
    this._clearTimer();
    this.phase = 'voting';
    this.votes = {};
    this.voteCandidates = null;
    this.reveal = null;
    this.touch();
  }

  votableIds() {
    return this.voteCandidates ?? this.alivePlayers.map((p) => p.id);
  }

  castVote(voterId, targetId) {
    if (this.phase !== 'voting') throw new GameError('Voting is not open.');
    const voter = this.getPlayer(voterId);
    if (!voter?.inGame || !voter.alive) throw new GameError('Only players still in the game can vote.');
    if (voterId === targetId) throw new GameError("You can't vote for yourself.");
    const target = this.getPlayer(targetId);
    if (!target?.alive || !this.votableIds().includes(targetId)) throw new GameError('You can’t vote for that player.');
    this.votes[voterId] = targetId;
    this.touch();
  }

  revealVotes() {
    if (this.phase !== 'voting') throw new GameError('Voting is not open.');
    if (Object.keys(this.votes).length === 0) throw new GameError('No votes yet.');
    const counts = new Map(this.votableIds().map((pid) => [pid, []]));
    for (const [voter, target] of Object.entries(this.votes)) {
      if (counts.has(target)) counts.get(target).push(voter);
    }
    const tally = [...counts.entries()]
      .map(([playerId, voters]) => ({ playerId, voters, votes: voters.length }))
      .filter((t) => t.votes > 0)
      .sort((x, y) => y.votes - x.votes);
    const top = tally[0]?.votes ?? 0;
    const topIds = tally.filter((t) => t.votes === top).map((t) => t.playerId);
    this.reveal = { tally, topIds, tie: topIds.length > 1 };
    this.phase = 'reveal';
    this.touch();
  }

  revoteTied() {
    if (this.phase !== 'reveal' || !this.reveal?.tie) throw new GameError('There is no tie to re-vote.');
    this.voteCandidates = [...this.reveal.topIds];
    this.votes = {};
    this.reveal = null;
    this.phase = 'voting';
    this.touch();
  }

  noElimination() {
    if (this.phase !== 'reveal') throw new GameError('Reveal the votes first.');
    this.elimination = { playerId: null };
    this.phase = 'elimination';
    this.touch();
  }

  eliminate() {
    if (this.phase !== 'reveal') throw new GameError('Reveal the votes first.');
    if (this.reveal.tie) throw new GameError('It’s a tie: re-vote or skip elimination.');
    const p = this.getPlayer(this.reveal.topIds[0]);
    if (!p) throw new GameError('That player has left.');
    p.alive = false;
    this.elimination = {
      playerId: p.id,
      role: p.role,
      word: p.word,
      guessPending: p.role === 'mrwhite',
      guess: null,
      guessCorrect: null,
    };
    this.phase = 'elimination';
    if (!this.elimination.guessPending) {
      const w = checkWinner(this.alivePlayers);
      if (w) this._endGame(w);
    }
    this.touch();
  }

  mrWhiteGuess(playerId, rawGuess) {
    const e = this.elimination;
    if (this.phase !== 'elimination' || !e?.guessPending || e.playerId !== playerId) {
      throw new GameError('You can’t guess right now.');
    }
    const guess = cleanText(rawGuess, LIMITS.word);
    if (!guess) throw new GameError('Type your guess first.');
    e.guess = guess;
    e.guessPending = false;
    e.guessCorrect = normalizeWord(guess) === normalizeWord(this.currentPair.b);
    if (e.guessCorrect) {
      this._endGame({ team: 'mrwhite', reason: `Mr. White guessed the Civilians’ word: “${this.currentPair.b}”!` });
    } else {
      const w = checkWinner(this.alivePlayers);
      if (w) this._endGame(w);
    }
    this.touch();
  }

  skipMrWhiteGuess() {
    const e = this.elimination;
    if (this.phase !== 'elimination' || !e?.guessPending) throw new GameError('No guess is pending.');
    e.guessPending = false;
    e.guess = null;
    e.guessCorrect = false;
    const w = checkWinner(this.alivePlayers);
    if (w) this._endGame(w);
    this.touch();
  }

  _endGame(winner) {
    this._clearTimer();
    this.winner = winner;
    this.phase = 'gameover';
  }

  nextGame() {
    if (this.phase !== 'gameover') throw new GameError('Finish this game first.');
    if (this.pairIndex + 1 >= this.pairs.length) throw new GameError('That was the last word pair.');
    this.pairIndex++;
    this.startGame();
  }

  endSession() {
    this._clearTimer();
    this.phase = 'ended';
    this.touch();
  }

  updateSettings(s = {}) {
    if (typeof s.clueTimer === 'boolean') this.settings.clueTimer = s.clueTimer;
    if ([0, 60, 90].includes(s.discussionSeconds)) this.settings.discussionSeconds = s.discussionSeconds;
    if (this.phase === 'clues' && typeof s.clueTimer === 'boolean') this._startSpeakerTimer();
    this.touch();
  }

  destroy() {
    this._clearTimer();
  }

  // ---------- views ----------

  _roleVisible(p) {
    return this.phase === 'gameover' || this.phase === 'ended' || (p.inGame && !p.alive && this.gameNumber > 0);
  }

  _publicView() {
    const showRoles = (p) => this._roleVisible(p);
    const cycleClues = new Set(this.clues.filter((c) => c.cycle === this.cycle).map((c) => c.playerId));
    const nameOf = (pid) => this.getPlayer(pid)?.name ?? '(left)';
    const view = {
      code: this.code,
      phase: this.phase,
      gameNumber: this.gameNumber,
      pairNumber: this.pairIndex + 1,
      totalPairs: this.pairs.length,
      hasNextPair: this.pairIndex + 1 < this.pairs.length,
      cycle: this.cycle,
      settings: this.settings,
      hostConnected: this.hostConnected,
      minPlayers: LIMITS.minPlayers,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        inGame: p.inGame,
        alive: p.alive,
        clueGiven: cycleClues.has(p.id),
        voted: this.phase === 'voting' && !!this.votes[p.id],
        role: showRoles(p) ? p.role : null,
        word: showRoles(p) ? p.word : null,
      })),
      speakingOrder: this.speakingOrder,
      currentSpeakerId: this.currentSpeakerId,
      clues: this.clues.map((c) => ({ ...c, name: nameOf(c.playerId) })),
      voting: {
        candidates: this.voteCandidates,
        votedCount: Object.keys(this.votes).length,
        eligibleCount: this.alivePlayers.length,
      },
      reveal: this.reveal
        ? {
            tie: this.reveal.tie,
            topIds: this.reveal.topIds,
            tally: this.reveal.tally.map((t) => ({ ...t, name: nameOf(t.playerId), voterNames: t.voters.map(nameOf) })),
          }
        : null,
      elimination: this.elimination
        ? { ...this.elimination, name: this.elimination.playerId ? nameOf(this.elimination.playerId) : null }
        : null,
      timer: this.timer,
      winner: this.winner,
      words:
        this.phase === 'gameover' && this.currentPair
          ? { civilian: this.currentPair.b, undercover: this.currentPair.a }
          : null,
      serverNow: Date.now(),
    };
    return view;
  }

  hostView() {
    return { ...this._publicView(), role: 'host' };
  }

  playerView(playerId) {
    const p = this.getPlayer(playerId);
    const view = this._publicView();
    if (!p) return { ...view, me: null };
    const isMrWhite = p.inGame && p.role === 'mrwhite' && this.gameNumber > 0;
    view.me = {
      id: p.id,
      name: p.name,
      inGame: p.inGame,
      alive: p.alive,
      word: p.inGame && this.gameNumber > 0 ? p.word : null,
      isMrWhite,
      myVote: this.phase === 'voting' ? this.votes[p.id] ?? null : null,
      votable:
        this.phase === 'voting' && p.alive && p.inGame ? this.votableIds().filter((pid) => pid !== p.id) : [],
      mustGuess: this.phase === 'elimination' && this.elimination?.guessPending && this.elimination.playerId === p.id,
    };
    // Your own role is revealed to you only when everyone's is (or you're Mr. White).
    view.role = 'player';
    return view;
  }
}

export class RoomStore {
  constructor() {
    this.rooms = new Map();
  }

  create(pairs, settings) {
    let code;
    do {
      code = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
    } while (this.rooms.has(code));
    const room = new Room({ code, pairs, settings });
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get(String(code ?? '').trim().toUpperCase()) ?? null;
  }

  /** Remove rooms that have been idle longer than maxIdleMs. Returns removed codes. */
  sweep(maxIdleMs, now = Date.now()) {
    const removed = [];
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > maxIdleMs) {
        room.destroy();
        this.rooms.delete(code);
        removed.push(code);
      }
    }
    return removed;
  }
}
