import Phaser from 'phaser';

// One choke point that makes every Phaser text easy to read, Burmese above all.
// Why: Myanmar glyphs stack vowel marks above and below the line. At 1x resolution on a FIT-scaled pixel canvas they smear,
// the tops get clipped by the text box and thin strokes vanish on dark backgrounds. So every text gets:
//   - 2x+ backing resolution (sharp after the canvas is scaled to the window)
//   - vertical padding (marks are no longer clipped) and extra line spacing
//   - a dark outline + soft drop shadow (readable over fog, rain, bright lamps and the 3D view)
//   - Burmese strings are never smaller than BM_MIN px.
export const BM_RE = /[\u1000-\u109F\uAA60-\uAA7F\uA9E0-\uA9FF]/;
export const hasBurmese = (s) => BM_RE.test(String(s ?? ''));
export const BM_MIN = 17;

const RES = Math.min(3, Math.max(2, Math.ceil(globalThis.devicePixelRatio || 1)));

export function readableStyle(text, style = {}) {
  const st = { ...style };
  const bm = hasBurmese(text);
  let size = parseFloat(st.fontSize) || 16;
  if (bm && size < BM_MIN) size = BM_MIN;
  st.fontSize = size + 'px';
  st.resolution = st.resolution || RES;
  const pad = st.padding || {};
  st.padding = { left: pad.left ?? 2, right: pad.right ?? 2, top: pad.top ?? (bm ? 8 : 3), bottom: pad.bottom ?? (bm ? 8 : 3) };
  if (st.stroke == null) { st.stroke = '#04060d'; st.strokeThickness = Math.max(3, Math.round(size / 5)); }
  else if (!st.strokeThickness) st.strokeThickness = Math.max(3, Math.round(size / 5));
  if (bm) {
    if (st.lineSpacing == null) st.lineSpacing = Math.round(size * 0.35);
    if (!st.shadow) st.shadow = { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, stroke: true, fill: true };
    if (!st.fontStyle) st.fontStyle = 'bold';
  }
  return st;
}

/** Call once before the Phaser.Game is created. */
export function installReadableText() {
  const F = Phaser.GameObjects.GameObjectFactory.prototype;
  if (F.__readable) return;
  const orig = F.text;
  F.text = function (x, y, text, style) { return orig.call(this, x, y, text, readableStyle(Array.isArray(text) ? text.join('') : text, style)); };
  F.__readable = true;

  // Text whose content changes later (subtitles, hints, objectives): re-apply the Burmese rules on every setText.
  const T = Phaser.GameObjects.Text.prototype, setText = T.setText;
  T.setText = function (value) {
    // The first call happens inside the Text constructor, before the object is ready; the factory patch above already styled it.
    if (!this.__ready) { this.__ready = true; return setText.call(this, value); }
    const s = Array.isArray(value) ? value.join('\n') : String(value ?? '');
    const r = setText.call(this, value);
    if (hasBurmese(s)) {
      let changed = false;
      if ((parseFloat(this.style.fontSize) || 16) < BM_MIN) { this.style.fontSize = BM_MIN + 'px'; changed = true; }
      if ((this.padding?.top ?? 0) < 8) { this.padding.top = 8; this.padding.bottom = 8; changed = true; }
      if (!this.style.strokeThickness) { this.style.stroke = '#04060d'; this.style.strokeThickness = 4; changed = true; }
      if (changed) this.updateText();
    }
    return r;
  };
}
