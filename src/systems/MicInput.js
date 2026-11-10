import { Settings } from './Settings.js';

// OPTIONAL microphone noise detection. Off by default; only runs if the player enables it (Settings, or the MIC button on the HUD).
// Audio is analysed locally (Web Audio AnalyserNode, RMS level). Nothing is recorded, stored or uploaded.
//
// v41 REDO. What was wrong before:
//   * the bar only moved if the AudioContext happened to be running and the analyser was fed (Chrome starves an analyser that leads nowhere);
//   * a FIXED threshold (0.07) meant any room noise / fan / the game's own speakers counted as "you are shouting", so the monster came for a
//     player who was doing nothing (and the browser's auto-gain even pumps silence up to that level).
// Now: it measures the room's own noise first (calibration), only counts the part of the sound ABOVE that, scales it by the player's
// sensitivity setting, and only raises a noise after the sound has stayed above the line for a moment (a click or a cough is ignored).

/** Pure mapping from a (boosted) microphone level (0..1) to a sound event, or null if below the threshold. */
export function levelToEvent(rms, threshold = MIC_THRESHOLD, cooldownOk = true) {
  if (!cooldownOk || rms < threshold) return null;
  const loud = Math.min(1, (rms - threshold) / 0.3);          // 0..1 above threshold
  return { type: 'voice', loudness: 0.3 + 0.5 * loud, radius: 80 + 200 * loud, duration: 0.6 };
}

export const MIC_THRESHOLD = 0.07;   // boosted level above the room's own noise that counts as a noise the monster can hear (the white line on the bar)
export const MIC_FULL_SCALE = 0.25;  // boosted level shown as a full bar
export const MIC_SUSTAIN = 0.15;     // seconds the sound must stay above the line before it counts
export const MIC_CALIBRATE = 1.2;    // seconds spent measuring the room's own noise after the mic starts (no events during this)
export const MIC_SENS_MIN = 0.5;
export const MIC_SENS_MAX = 5;
export const MIC_SENS_STEP = 0.5;
export const MIC_SENS_DEFAULT = 2;
const FLOOR_MAX = 0.04;              // the room-noise estimate never rises above this, so a loud voice can never "hide" itself

export const MIC_STATUS_TEXT = { off: 'OFF', asking: 'ALLOW MIC', calibrating: 'CALIBRATING', listening: 'LISTENING', denied: 'BLOCKED', nosignal: 'NO SIGNAL', nomic: 'NO MIC', insecure: 'NEEDS HTTPS', error: 'ERROR' };
/** Volume meter scale for the HUD: raw microphone level (RMS) in decibels, -66 dB = empty bar, -12 dB = full bar. Every sound moves it. */
export const toBar = (rms) => Math.max(0, Math.min(1, (20 * Math.log10(Math.max(rms, 1e-5)) + 66) / 54));
export const micSens = () => { const v = Settings.get('micSens'); return typeof v === 'number' && v > 0 ? v : MIC_SENS_DEFAULT; };

export class MicInput {
  constructor(bus, getPos) {
    this.bus = bus; this.getPos = getPos;
    this.active = false; this.status = 'off';      // off | asking | calibrating | listening | denied | nomic | insecure | error
    this.cool = 0; this.shown = 0; this.trig = 0.5; this.level = 0; this.peak = 0; this.raw = 0; this.floor = 0.01; this.above = 0; this.calT = 0; this.calSum = 0; this.calN = 0;
  }

  /** Ask for permission. Resolves true if the mic is now being analysed; false if denied/unsupported (keyboard sounds still work). */
  async start() {
    if (this.active || this.status === 'asking' || !Settings.get('microphone')) return false;
    this.status = 'asking';
    try {
      if (!navigator.mediaDevices?.getUserMedia) { this.status = 'insecure'; return false; }   // needs https or localhost
      // Echo cancellation + noise suppression keep the game's own speakers out of the mic. Auto-gain is OFF: it pumps room noise up to "speech" level.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
      if (!Settings.get('microphone')) { stream.getTracks().forEach((t) => t.stop()); this.status = 'off'; return false; }   // switched off while the permission box was open
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Browsers start an AudioContext 'suspended' until a user gesture. Resume now and on the next tap/key.
      const wake = () => { if (ctx.state !== 'running') ctx.resume?.().catch(() => {}); };
      wake(); for (const ev of ['pointerdown', 'touchstart', 'keydown', 'click']) window.addEventListener(ev, wake, { passive: true });
      this.wake = wake;
      const src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser(); an.fftSize = 1024;
      src.connect(an);
      // Some browsers stop feeding an analyser that leads nowhere: route it to the output through a silent gain node (nothing is heard).
      const mute = ctx.createGain(); mute.gain.value = 0; an.connect(mute); mute.connect(ctx.destination);
      this.stream = stream; this.ctx = ctx; this.an = an;
      this.src = src; this.mute = mute;      // v43: keep EVERY node referenced: Chrome garbage-collects an unreferenced MediaStream source and the analyser then reads silence (the bar froze)
      this.deadT = 0;
      this.useFloat = typeof an.getFloatTimeDomainData === 'function';
      this.buf = this.useFloat ? new Float32Array(an.fftSize) : new Uint8Array(an.fftSize);
      this.level = 0; this.peak = 0; this.above = 0; this.calT = 0; this.calSum = 0; this.calN = 0; this.floor = 0.01;
      this.active = true; this.status = 'calibrating';
      return true;
    } catch (e) {
      this.active = false;
      this.status = e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? 'nomic' : 'error';
      return false;
    }
  }

  /** Current room-noise-free level (0..1) of a raw RMS reading: what the bar shows and what the monster can hear. */
  boosted(rms) { return Math.max(0, rms - this.floor) * micSens(); }

  /** @param {number} dt @param {boolean} [canEmit=true] false while paused / in a cutscene: the bar still moves but nothing is heard */
  update(dt, canEmit = true) {
    if (!this.active) return;
    if (this.ctx?.state === 'suspended') this.ctx.resume?.().catch(() => {});
    this.cool -= dt;
    let rms;
    if (this.useFloat) { this.an.getFloatTimeDomainData(this.buf); let s = 0; for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i]; rms = Math.sqrt(s / this.buf.length); }
    else { this.an.getByteTimeDomainData(this.buf); let s = 0; for (let i = 0; i < this.buf.length; i++) { const v = (this.buf[i] - 128) / 128; s += v * v; } rms = Math.sqrt(s / this.buf.length); }
    this.raw = rms;
    const track = this.stream?.getAudioTracks?.()[0];
    if (this.status !== 'calibrating' && rms < 1e-6) {                // a live mic is never exactly 0: muted device / stream died / GC'd source
      this.deadT = (this.deadT ?? 0) + dt;
      if (this.deadT > 3) { this.status = 'nosignal'; if (this.ctx.state === 'running' && track && track.readyState === 'live' && !track.muted && this.deadT > 6) { this.deadT = 3.5; this.reconnect(); } }
    } else if (rms >= 1e-6) { this.deadT = 0; if (this.status === 'nosignal') { this.status = 'listening'; this.above = 0; } }
    // v44: what the HUD shows. A plain volume meter (dB scale) that moves with EVERY sound, and the white line = where your voice starts to count
    // (room noise + threshold / sensitivity), so raising the sensitivity visibly moves the line down.
    { const t = toBar(rms); this.shown += (t - this.shown) * Math.min(1, dt * (t > this.shown ? 30 : 7)); this.trig = toBar(this.floor + MIC_THRESHOLD / micSens()); }
    if (this.ctx?.state !== 'running') return;                  // not fed yet (waiting for a tap/key): do not calibrate on silence

    if (this.status === 'calibrating') {                         // measure the room's own noise for a moment, make no events
      this.calT += dt; this.calSum += rms; this.calN++;
      this.floor = Math.min(FLOOR_MAX, this.calSum / this.calN);
      if (this.calT >= MIC_CALIBRATE) this.status = 'listening';
    } else {                                                     // follow the room: drops quickly, rises very slowly
      this.floor += (rms - this.floor) * Math.min(1, dt * (rms < this.floor ? 4 : 0.08));
      this.floor = Math.max(0, Math.min(FLOOR_MAX, this.floor));
    }

    const sig = this.boosted(rms);
    this.level += (sig - this.level) * Math.min(1, dt * (sig > this.level ? 25 : 6));   // quick attack, slower release: easy to read
    this.peak = Math.max(this.level, this.peak - dt * 0.15);     // slowly falling peak marker
    if (this.status !== 'listening') { this.above = 0; return; }
    this.above = sig >= MIC_THRESHOLD ? this.above + dt : Math.max(0, this.above - dt * 2);   // judged on the live signal, not the slow-falling bar, so a click does not count; short dips in speech do not reset it
    if (!canEmit || this.above < MIC_SUSTAIN) return;
    const ev = levelToEvent(Math.max(this.level, sig), MIC_THRESHOLD, this.cool <= 0);
    if (ev) { this.cool = 0.8; const p = this.getPos(); this.bus.emit('voice', p.x, p.y, ev); }
  }

  /** Rebuild the audio chain from the still-open microphone stream (used when the analyser has gone silent). */
  reconnect() {
    try {
      const src = this.ctx.createMediaStreamSource(this.stream), an = this.ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
      const mute = this.ctx.createGain(); mute.gain.value = 0; an.connect(mute); mute.connect(this.ctx.destination);
      this.src = src; this.an = an; this.mute = mute;
    } catch { /* keep the old chain */ }
  }

  stop() {
    try { if (this.wake) for (const ev of ['pointerdown', 'touchstart', 'keydown', 'click']) window.removeEventListener(ev, this.wake); } catch { /* ignore */ }
    try { this.stream?.getTracks().forEach((t) => t.stop()); this.ctx?.close(); } catch { /* ignore */ }
    this.active = false; this.status = 'off'; this.shown = 0; this.level = 0; this.peak = 0; this.above = 0; this.src = this.mute = this.an = null;
  }
}
