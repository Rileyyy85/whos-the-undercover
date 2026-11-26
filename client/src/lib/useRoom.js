import { useEffect, useRef, useState, useCallback } from 'react';
import { createSocket } from './socket.js';
import { registerAvatars } from '../components/ui.jsx';

/**
 * Connects to the server and attaches to a room as host or player.
 * Re-attaches automatically after every reconnect (phone sleep, refresh, network blip).
 */
export function useRoom({ code, kind, token }) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [fatal, setFatal] = useState(null); // 'not_found' | 'not_host' | 'not_player' | 'kicked' | 'replaced'
  const [clockOffset, setClockOffset] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return undefined;
    const socket = createSocket();
    socketRef.current = socket;

    const attach = () => {
      const event = kind === 'host' ? 'host:attach' : 'player:attach';
      const payload = kind === 'host' ? { code, hostToken: token } : { code, token };
      socket.emit(event, payload, (res) => {
        if (res?.error) setFatal(res.error);
      });
    };

    socket.on('connect', () => {
      setConnected(true);
      attach();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('state', (s) => {
      setClockOffset(s.serverNow - Date.now());
      registerAvatars(s.players.map((p) => p.id));
      setState(s);
    });
    socket.on('kicked', () => setFatal('kicked'));
    socket.on('replaced', () => setFatal('replaced'));

    // Phones often freeze sockets while asleep; nudge a reconnect when the tab becomes visible.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !socket.connected) socket.connect();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [code, kind, token]);

  const emit = useCallback(
    (event, payload) =>
      new Promise((resolve) => {
        const s = socketRef.current;
        if (!s?.connected) return resolve({ error: 'Not connected. Reconnecting…' });
        s.timeout(8000).emit(event, payload, (err, res) => resolve(err ? { error: 'No response from server. Try again.' } : res));
      }),
    [],
  );

  return { state, connected, fatal, emit, clockOffset };
}
