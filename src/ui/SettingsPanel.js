import { VIEW_W, VIEW_H } from '../config.js';
import { Settings } from '../systems/Settings.js';
import { audio } from '../systems/AudioSystem.js';
import { FONT, makeButton } from './widgets.js';
import { bind, tr, onLang, LANGS, LANG_NAME, setLang } from '../systems/Lang.js';

const pct = (v) => Math.round(v * 100) + '%';
const onoff = (v) => tr(v ? 'On' : 'Off');
const ROWS = [
  { key: 'lang', label: 'Language', cycle: LANGS, fmt: (v) => LANG_NAME[v] },
  { key: 'master', label: 'Master volume', min: 0, max: 1, step: 0.1, fmt: pct },
  { key: 'music', label: 'Music volume', min: 0, max: 1, step: 0.1, fmt: pct },
  { key: 'sfx', label: 'SFX volume', min: 0, max: 1, step: 0.1, fmt: pct },
  { key: 'ambient', label: 'Ambient volume', min: 0, max: 1, step: 0.1, fmt: pct },
  { key: 'voice', label: 'Voice volume', min: 0, max: 1, step: 0.1, fmt: pct },
  { key: 'sens', label: 'Mouse / turn sensitivity', min: 0.4, max: 2, step: 0.1, fmt: (v) => v.toFixed(1) + 'x' },
  { key: 'subtitles', label: 'Subtitles', toggle: true, fmt: onoff },
  { key: 'microphone', label: 'Microphone noise (optional)', toggle: true, fmt: onoff },
  { key: 'micSens', label: 'Microphone sensitivity', min: 0.5, max: 5, step: 0.5, fmt: (v) => v.toFixed(1) + 'x' },
  { key: 'quality', label: 'Graphics quality', cycle: ['auto', 'low', 'high'], fmt: (v) => tr(v) },
  { key: 'fullscreen', label: 'Fullscreen', toggle: true, fmt: onoff },
];

/** Settings overlay for the menu and pause screens. Returns { destroy }. */
export function openSettings(scene, depth = 60, onClose = () => {}) {
  const all = [];
  const add = (o) => { all.push(o); return o; };
  add(scene.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0.86).setOrigin(0).setDepth(depth).setInteractive());
  add(bind(scene.add.text(VIEW_W / 2, 40, '', { fontFamily: FONT, fontSize: '32px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(depth + 1), 'SETTINGS'));
  const vals = [];
  const refresh = () => ROWS.forEach((r, i) => vals[i].setText(r.fmt(Settings.get(r.key))));
  const apply = (r) => {
    if (r.key === 'fullscreen') { try { scene.scale.toggleFullscreen(); } catch { /* ignore */ } }
    if (r.key === 'lang') setLang(Settings.get('lang'));      // every bound label, menu, HUD line and door sign follows
    audio.refreshVolumes();
  };
  ROWS.forEach((r, i) => {
    const y = 88 + i * 33;
    add(bind(scene.add.text(170, y, '', { fontFamily: FONT, fontSize: '18px', color: '#dfe6ff' }).setOrigin(0, 0.5).setDepth(depth + 1), r.label));
    vals[i] = add(scene.add.text(700, y, '', { fontFamily: FONT, fontSize: '18px', color: '#e8c46a' }).setOrigin(0.5).setDepth(depth + 1));
    const bump = (dir) => {
      const v = Settings.get(r.key);
      if (r.toggle) Settings.set(r.key, !v);
      else if (r.cycle) Settings.set(r.key, r.cycle[(r.cycle.indexOf(v) + dir + r.cycle.length) % r.cycle.length]);
      else Settings.set(r.key, Math.round(Math.max(r.min, Math.min(r.max, v + dir * r.step)) * 100) / 100);
      apply(r); refresh();
    };
    const minus = makeButton(scene, 610, y, 40, 30, () => '-', () => bump(-1), { depth: depth + 1, size: 18 });
    const plus = makeButton(scene, 790, y, 40, 30, () => '+', () => bump(1), { depth: depth + 1, size: 18 });
    all.push(minus.box, minus.text, plus.box, plus.text);
  });
  refresh();
  const offLang = onLang(refresh);               // On/Off, auto/low/high and the language name follow the language
  const close = makeButton(scene, VIEW_W / 2, VIEW_H - 38, 220, 42, 'Close', () => { destroy(); onClose(); }, { depth: depth + 1 });
  all.push(close.box, close.text);
  const kb = scene.input.keyboard, esc = () => { destroy(); onClose(); };
  kb.once('keydown-ESC', esc);
  function destroy() { offLang(); kb.off('keydown-ESC', esc); all.forEach((o) => o.destroy()); }
  return { destroy, refresh };
}
