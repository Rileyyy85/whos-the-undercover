// Tokens are kept in sessionStorage so a refresh (or a phone waking up) rejoins the same seat.
const key = (code, kind) => `wtu:${String(code).toUpperCase()}:${kind}`;

export const tokens = {
  get: (code, kind) => {
    try { return sessionStorage.getItem(key(code, kind)); } catch { return null; }
  },
  set: (code, kind, value) => {
    try { sessionStorage.setItem(key(code, kind), value); } catch { /* private mode */ }
  },
  clear: (code, kind) => {
    try { sessionStorage.removeItem(key(code, kind)); } catch { /* ignore */ }
  },
};

export const lastName = {
  get: () => { try { return localStorage.getItem('wtu:name') || ''; } catch { return ''; } },
  set: (v) => { try { localStorage.setItem('wtu:name', v); } catch { /* ignore */ } },
};
