// Express + Socket.IO server. Serves the built React app (client/dist) and the game
// on the same origin and port, so the whole game lives at one public URL.
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomStore, GameError } from './game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const DIST = path.resolve(__dirname, '../client/dist');
const ROOM_IDLE_MS = 2 * 60 * 60 * 1000; // rooms idle for more than 2 hours are removed

const app = express();
app.use(express.json({ limit: '100kb' }));
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 20000,
  pingTimeout: 25000,
  connectionStateRecovery: {},
});
const store = new RoomStore();

// ---------- REST API ----------

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: store.rooms.size, uptime: Math.round(process.uptime()) });
});

app.post('/api/rooms', (req, res) => {
  try {
    const room = store.create(req.body?.pairs, req.body?.settings);
    room.onChange = () => broadcast(room);
    res.json({ code: room.code, hostToken: room.hostToken });
  } catch (err) {
    res.status(400).json({ error: err instanceof GameError ? err.message : 'Could not create the room.' });
  }
});

app.get('/api/rooms/:code', (req, res) => {
  const room = store.get(req.params.code);
  if (!room) return res.status(404).json({ error: 'Room not found. Check the code with your host.' });
  res.json({ code: room.code, phase: room.phase, players: room.players.length });
});

app.post('/api/rooms/:code/players', (req, res) => {
  const room = store.get(req.params.code);
  if (!room) return res.status(404).json({ error: 'Room not found. Check the code with your host.' });
  try {
    const p = room.addPlayer(req.body?.name);
    broadcast(room);
    res.json({ code: room.code, token: p.token, playerId: p.id });
  } catch (err) {
    res.status(400).json({ error: errorMessage(err) });
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- React app (production build) ----------

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  // SPA fallback: every other GET returns index.html so React Router can handle it.
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) =>
    res.type('text').send('Server is running. Build the client (npm run build) or use the Vite dev server on port 5173.'),
  );
}

// ---------- Socket.IO ----------

function broadcast(room) {
  if (room.hostSocketId) io.to(room.hostSocketId).emit('state', room.hostView());
  for (const p of room.players) {
    if (p.socketId) io.to(p.socketId).emit('state', room.playerView(p.id));
  }
}

function errorMessage(err) {
  if (err instanceof GameError) return err.message;
  console.error(err);
  return 'Something went wrong. Please try again.';
}

io.on('connection', (socket) => {
  const reply = (ack, payload) => typeof ack === 'function' && ack(payload);

  // Run a game action, then push fresh state to everyone in the room.
  const act = (ack, fn) => {
    const room = store.get(socket.data.code);
    if (!room) return reply(ack, { error: 'Room not found. It may have expired.' });
    try {
      fn(room);
      broadcast(room);
      reply(ack, { ok: true });
    } catch (err) {
      reply(ack, { error: errorMessage(err) });
    }
  };

  socket.on('host:attach', ({ code, hostToken } = {}, ack) => {
    const room = store.get(code);
    if (!room) return reply(ack, { error: 'not_found' });
    if (room.hostToken !== hostToken) return reply(ack, { error: 'not_host' });
    if (room.hostSocketId && room.hostSocketId !== socket.id) io.to(room.hostSocketId).emit('replaced');
    room.hostSocketId = socket.id;
    room.hostConnected = true;
    room.touch();
    socket.data = { code: room.code, kind: 'host' };
    reply(ack, { ok: true });
    broadcast(room);
  });

  socket.on('player:attach', ({ code, token } = {}, ack) => {
    const room = store.get(code);
    if (!room) return reply(ack, { error: 'not_found' });
    const p = room.findByToken(token);
    if (!p) return reply(ack, { error: 'not_player' });
    if (p.socketId && p.socketId !== socket.id) io.to(p.socketId).emit('replaced');
    p.socketId = socket.id;
    p.connected = true;
    room.touch();
    socket.data = { code: room.code, kind: 'player', playerId: p.id };
    reply(ack, { ok: true, playerId: p.id });
    broadcast(room);
  });

  // ----- player actions -----
  const playerOnly = (handler) => (payload, ack) => {
    if (socket.data?.kind !== 'player') return reply(ack, { error: 'Not joined to a room.' });
    act(ack, (room) => handler(room, socket.data.playerId, payload ?? {}));
  };
  socket.on('player:clue', playerOnly((room, pid, { text }) => room.submitClue(pid, text)));
  socket.on('player:vote', playerOnly((room, pid, { targetId }) => room.castVote(pid, targetId)));
  socket.on('player:guess', playerOnly((room, pid, { guess }) => room.mrWhiteGuess(pid, guess)));

  // ----- host actions -----
  socket.on('host:action', (payload = {}, ack) => {
    if (socket.data?.kind !== 'host') return reply(ack, { error: 'Only the host can do that.' });
    act(ack, (room) => {
      switch (payload.type) {
        case 'start': return room.startGame();
        case 'skipTurn': return room.skipTurn();
        case 'discussion': return room.startDiscussion();
        case 'voting': return room.startVoting();
        case 'reveal': return room.revealVotes();
        case 'revote': return room.revoteTied();
        case 'noElimination': return room.noElimination();
        case 'eliminate': return room.eliminate();
        case 'skipGuess': return room.skipMrWhiteGuess();
        case 'nextClueRound': return room.nextClueRound();
        case 'nextGame': return room.nextGame();
        case 'endSession': return room.endSession();
        case 'settings': return room.updateSettings(payload.settings);
        case 'kick': {
          const p = room.kick(payload.playerId);
          if (p.socketId) {
            io.to(p.socketId).emit('kicked');
            io.sockets.sockets.get(p.socketId)?.disconnect(true);
          }
          return;
        }
        default:
          throw new GameError('Unknown action.');
      }
    });
  });

  socket.on('disconnect', () => {
    const { code, kind, playerId } = socket.data ?? {};
    const room = store.get(code);
    if (!room) return;
    if (kind === 'host' && room.hostSocketId === socket.id) {
      room.hostSocketId = null;
      room.hostConnected = false;
    } else if (kind === 'player') {
      const p = room.getPlayer(playerId);
      if (p && p.socketId === socket.id) {
        p.socketId = null;
        p.connected = false;
      }
    }
    broadcast(room);
  });
});

// Clean up idle rooms every 10 minutes.
setInterval(() => {
  const removed = store.sweep(ROOM_IDLE_MS);
  if (removed.length) console.log(`Removed idle rooms: ${removed.join(', ')}`);
}, 10 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`Who's the Undercover? server listening on http://localhost:${PORT}`);
});

export { app, server, io, store };
