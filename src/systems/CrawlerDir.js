// Which of the creature's 8 pre-rendered views to show. Pure maths (no Phaser) so it can be unit-tested in Node.
// heading: the creature's world direction (radians, map coordinates: x right, y down, so angles grow clockwise on screen).
// yaw: the camera's look direction in the same space. Result 0 = walking away from the camera (back view),
// 2 = walking to the camera's right, 4 = walking toward the camera (face view), 6 = to the camera's left.
const TAU = Math.PI * 2;

export function crawlerDir(heading, yaw, cur = null, n = 8) {
  const step = TAU / n;
  const rel = (((heading - yaw) % TAU) + TAU) % TAU;
  if (cur != null) {
    const off = Math.abs((((rel - cur * step + Math.PI) % TAU) + TAU) % TAU - Math.PI);
    if (off <= step / 2 + 0.14) return cur;            // hysteresis: no flicker right on a 22.5 degree border
  }
  return Math.round(rel / step) % n;
}
