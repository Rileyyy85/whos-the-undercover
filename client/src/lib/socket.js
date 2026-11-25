import { io } from 'socket.io-client';

// Same origin by default (one URL on Render). VITE_SOCKET_URL can override it if ever needed.
const url = import.meta.env.VITE_SOCKET_URL || undefined;

export function createSocket() {
  return io(url, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    transports: ['websocket', 'polling'],
  });
}
