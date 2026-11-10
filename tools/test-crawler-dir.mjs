import { crawlerDir } from '../src/systems/CrawlerDir.js';
let n = 0; const eq = (a, b, m) => { if (a !== b) { console.error('FAIL', m, 'expected', b, 'got', a); process.exit(1); } n++; console.log('ok ', m); };
const P = Math.PI;
for (const yaw of [0, 1, -P / 2, 3, -3]) {
  eq(crawlerDir(yaw, yaw), 0, `moving along the camera look direction (yaw ${yaw}) shows the back view`);
  eq(crawlerDir(yaw + P, yaw), 4, `moving toward the camera (yaw ${yaw}) shows the face view`);
  eq(crawlerDir(yaw + P / 2, yaw), 2, `moving to the camera's right (yaw ${yaw}) shows the right view`);
  eq(crawlerDir(yaw - P / 2, yaw), 6, `moving to the camera's left (yaw ${yaw}) shows the left view`);
  eq(crawlerDir(yaw + P / 4, yaw), 1, `away-right diagonal (yaw ${yaw})`);
  eq(crawlerDir(yaw + 3 * P / 4, yaw), 3, `toward-right diagonal (yaw ${yaw})`);
  eq(crawlerDir(yaw - 3 * P / 4, yaw), 5, `toward-left diagonal (yaw ${yaw})`);
  eq(crawlerDir(yaw - P / 4, yaw), 7, `away-left diagonal (yaw ${yaw})`);
}
// hysteresis: just past the 22.5 degree border keeps the old view, well past it switches
eq(crawlerDir(0.42, 0, 0), 0, 'hysteresis holds the current view 24 degrees off');
eq(crawlerDir(0.6, 0, 0), 1, 'switches once clearly into the next sector');
// wrap-around: 359 degrees is still the back view
eq(crawlerDir(-0.02, 0, null), 0, 'wraps across 0');
console.log(`\n${n} tests passed`);
