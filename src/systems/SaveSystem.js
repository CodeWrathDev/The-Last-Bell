import { SAVE_KEY } from '../config.js';

// LocalStorage wrapper. Every call is guarded: storage can be blocked (private windows).
export const Save = {
  has() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } },
  load() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch { return null; } },
  write(state) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch { return false; } },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } },
};
