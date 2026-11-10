// Persistent player settings (volume channels, sensitivity, quality, subtitles, fullscreen).
const KEY = 'last-bell-settings-v1';
// First launch: Myanmar if the browser is set to Burmese, otherwise English. The player can change it in the menu at any time.
const guessLang = () => (String(globalThis.navigator?.language || '').toLowerCase().startsWith('my') ? 'my' : 'en');
export const DEFAULTS = { lang: guessLang(), master: 1, music: 0.7, sfx: 0.9, ambient: 0.8, voice: 1, sens: 1, quality: 'auto', subtitles: true, microphone: false, micSens: 2, fullscreen: false, resolution: '960x540' };
let cur = { ...DEFAULTS };
try { cur = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* storage unavailable */ }
export const Settings = {
  get: (k) => cur[k],
  all: () => ({ ...cur }),
  set(k, v) { cur[k] = v; try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* ignore */ } },
};
