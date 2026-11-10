import { bind } from '../systems/Lang.js';

export const FONT = '"Noto Sans Myanmar", "Segoe UI", system-ui, sans-serif';

/** label: English key or () => string (re-evaluated when the language changes).
 *  Pixel-art nine-slice button (frames come from the `ui` atlas). Returns { box, text, setActive, setLabel, setVisible, setEnabled, destroy }. */
export function makeButton(scene, x, y, w, h, label, onClick, { depth = 30, size = 20 } = {}) {
  const box = scene.add.nineslice(x, y, 'ui', 'ui_button', w, h, 8, 8, 8, 8).setDepth(depth).setInteractive({ useHandCursor: true });
  const text = scene.add.text(x, y, '', { fontFamily: FONT, fontSize: size + 'px', color: '#dfe6ff' }).setOrigin(0.5).setDepth(depth + 1);
  bind(text, label);   // a plain string is an English key (translated), a function returns the finished label
  const api = {
    box, text, active: false,
    setActive(a) { api.active = a; box.setTexture('ui', a ? 'ui_button_active' : 'ui_button'); text.setColor(a ? '#ffffff' : '#dfe6ff'); },
    setLabel(s) { bind(text, s); },
    setVisible(v) { box.setVisible(v); text.setVisible(v); if (box.input) box.input.enabled = v; },
    setEnabled(e) { text.setAlpha(e ? 1 : 0.35); box.setAlpha(e ? 1 : 0.5); api.disabled = !e; },
    destroy() { box.destroy(); text.destroy(); },
  };
  box.on('pointerover', () => { if (!api.disabled) api.onHover?.(); });
  box.on('pointerdown', () => { if (!api.disabled) onClick(); });
  return api;
}
