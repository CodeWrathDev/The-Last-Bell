// Additional generated sprites: banyan canopy, props, HUD art, soft flashlight cone.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function canvasTex(scene, key, w, h) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.createCanvas(key, w, h);
}
const circle = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };

export function generateExtraTextures(scene) {
  // ---- Banyan canopy (transparent outside the blob) ----
  {
    const t = canvasTex(scene, 'banyan', 448, 300), c = t.context, R = rng(4242);
    const pt = (spread) => { const a = R() * 6.283, r = Math.sqrt(R()) * spread; return [224 + Math.cos(a) * r * 190, 140 + Math.sin(a) * r * 105]; };
    for (let i = 0; i < 150; i++) { const [x, y] = pt(1); circle(c, x, y, 22 + R() * 30, ['#0a2a1a', '#0d3320', '#0f3a24'][(R() * 3) | 0]); }
    for (let i = 0; i < 170; i++) { const [x, y] = pt(0.9); circle(c, x, y - 8, 10 + R() * 20, ['#134a2c', '#17512e', '#115032'][(R() * 3) | 0]); }
    c.globalAlpha = 0.55;
    for (let i = 0; i < 110; i++) { const [x, y] = pt(0.75); circle(c, x - 26, y - 30, 3 + R() * 8, ['#2a7a45', '#1f6a3a'][(R() * 2) | 0]); }
    c.globalAlpha = 1;
    // aerial roots hanging from the lower edge
    c.strokeStyle = '#3b2a1e'; c.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const x = 60 + R() * 330, edge = 140 + Math.sqrt(Math.max(0, 1 - ((x - 224) / 190) ** 2)) * 105;
      c.beginPath(); c.moveTo(x, edge - 6); c.lineTo(x + (R() - 0.5) * 6, Math.min(299, edge + 14 + R() * 26)); c.stroke();
    }
    t.refresh();
  }

  // ---- Basketball hoop (32x64, origin bottom-centre) ----
  {
    const t = canvasTex(scene, 'hoop', 32, 64), c = t.context;
    c.fillStyle = '#2a2f44'; c.fillRect(14, 14, 4, 50);
    c.fillStyle = '#cfd6e4'; c.fillRect(4, 2, 24, 16);
    c.fillStyle = '#7a8094'; c.fillRect(4, 2, 24, 2); c.fillRect(4, 16, 24, 2);
    c.fillStyle = '#c8552a'; c.fillRect(10, 18, 12, 2);
    c.strokeStyle = '#d6dbe8'; c.lineWidth = 1; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(11 + i * 3, 20); c.lineTo(13 + i * 2, 28); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(16, 62, 10, 3, 0, 0, 6.3); c.fill();
    t.refresh();
  }

  // ---- Flagpole with Myanmar flag (32x128) ----
  {
    const t = canvasTex(scene, 'flagpole', 32, 128), c = t.context;
    c.fillStyle = '#9aa0b4'; c.fillRect(6, 4, 3, 122);
    c.fillStyle = '#d6b25e'; c.beginPath(); c.arc(7.5, 4, 3, 0, 6.3); c.fill();
    c.fillStyle = '#fecb00'; c.fillRect(10, 8, 22, 7);
    c.fillStyle = '#34b233'; c.fillRect(10, 15, 22, 7);
    c.fillStyle = '#ea2839'; c.fillRect(10, 22, 22, 7);
    // Myanmar flag: pixelated white star centered across the yellow/green/red bands.
    c.fillStyle = '#ffffff';
    const star = [[20, 14], [21, 17], [25, 17], [22, 19], [23, 23], [20, 21], [17, 23], [18, 19], [15, 17], [19, 17]];
    c.beginPath(); c.moveTo(star[0][0], star[0][1]); for (const [x, y] of star.slice(1)) c.lineTo(x, y); c.closePath(); c.fill();
    c.fillStyle = '#4a5068'; c.fillRect(2, 122, 12, 6);
    t.refresh();
  }

  // ---- Street lamp (32x64, origin bottom-centre) ----
  {
    const t = canvasTex(scene, 'lamp', 32, 64), c = t.context;
    c.fillStyle = '#1a1d2a'; c.fillRect(14, 12, 4, 52);
    c.fillStyle = '#2a2f44'; c.fillRect(8, 2, 16, 4); c.fillRect(11, 6, 10, 2);
    c.fillStyle = '#ffd98a'; c.fillRect(11, 8, 10, 7);
    c.fillStyle = '#fff2c4'; c.fillRect(13, 9, 6, 3);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(16, 62, 8, 2.5, 0, 0, 6.3); c.fill();
    t.refresh();
  }

  // ---- HUD art ----
  {
    const HEART = ['01100110', '11111111', '11111111', '11111111', '01111110', '00111100', '00011000'];
    const heart = (key, col, hi) => {
      const t = canvasTex(scene, key, 16, 16), c = t.context;
      HEART.forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') { c.fillStyle = col; c.fillRect(x * 2, y * 2 + 1, 2, 2); } }));
      if (hi) { c.fillStyle = hi; c.fillRect(2, 3, 2, 2); }
      t.refresh();
    };
    heart('ui_heart', '#e0303c', '#ff9aa2'); heart('ui_heart_empty', '#3a2a35', null);

    const f = canvasTex(scene, 'ui_flash', 24, 24), c = f.context;
    c.fillStyle = '#cfd6e4'; c.fillRect(3, 9, 12, 7); c.fillStyle = '#7a8094'; c.fillRect(15, 7, 5, 11);
    c.fillStyle = '#ffe9a0'; c.fillRect(20, 8, 3, 9); c.fillStyle = '#4a5068'; c.fillRect(5, 11, 8, 3);
    f.refresh();

    const p = canvasTex(scene, 'portrait', 44, 44), q = p.context;
    q.fillStyle = '#1a2238'; q.fillRect(0, 0, 44, 44);
    q.fillStyle = '#e8ecf4'; q.fillRect(6, 34, 32, 10);
    q.fillStyle = '#d8a070'; q.fillRect(12, 10, 20, 24);
    q.fillStyle = '#16121a'; q.fillRect(10, 5, 24, 10); q.fillRect(10, 13, 4, 8); q.fillRect(30, 13, 4, 8);
    q.fillStyle = '#111'; q.fillRect(16, 23, 3, 3); q.fillRect(26, 23, 3, 3);
    q.fillStyle = '#a0603c'; q.fillRect(20, 30, 5, 1);
    p.refresh();

    const v = canvasTex(scene, 'vignette', 480, 270), vc = v.context;
    const g = vc.createRadialGradient(240, 135, 80, 240, 135, 290);
    g.addColorStop(0, 'rgba(140,0,0,0)'); g.addColorStop(1, 'rgba(140,0,0,0.9)');
    vc.fillStyle = g; vc.fillRect(0, 0, 480, 270); v.refresh();
  }

  // ---- Soft flashlight cone (apex at left-middle, pointing +x) ----
  {
    const t = canvasTex(scene, 'light_cone', 300, 300), c = t.context;
    for (let i = 0; i < 10; i++) {
      const half = ((11 + i * 2.2) * Math.PI) / 180, ty = Math.tan(half) * 300;
      c.save(); c.beginPath(); c.moveTo(0, 150); c.lineTo(300, 150 - ty); c.lineTo(300, 150 + ty); c.closePath(); c.clip();
      const g = c.createRadialGradient(0, 150, 6, 0, 150, 300);
      g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.6, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 300, 300); c.restore();
    }
    t.refresh();
  }
}
