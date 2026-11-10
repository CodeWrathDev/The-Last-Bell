// The flashlight is an old, weak torch: it is never perfectly steady. Returns a brightness multiplier 0..1 for time `ms`.
//   * a constant nervous shimmer (about +-10%),
//   * every few seconds a short burst of stutters where it drops low and snaps back.
// Pure maths (no Phaser) so the 3D view and the 2D lighting can share it.
export const FLASH_STRENGTH = 0.55;   // overall brightness of the beam (it used to be 1.55 in the 3D renderer: far too strong)
export function flashFlicker(ms) {
  const t = ms / 1000;
  let k = 0.9 + 0.06 * Math.sin(t * 23) + 0.04 * Math.sin(t * 57 + 1.3);
  const burst = Math.sin(t * 2.3) * Math.sin(t * 5.9 + 2);                    // rarely high: the stutter windows
  if (burst > 0.72) k *= 0.18 + 0.5 * Math.abs(Math.sin(t * 83));            // quick random drops while a stutter lasts
  return Math.max(0.05, Math.min(1, k));
}
