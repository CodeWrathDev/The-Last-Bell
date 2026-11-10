import { audio } from './AudioSystem.js';

// Connects AudioManager (pure logic) to the Howler placeholder synth. PLACEHOLDER audio only: replace GENS in
// AudioSystem.js with real recordings/music before release.
export const placeholderBackend = {
  oneShot(name, { gain = 1, pan = 0, rate = 1 } = {}) { audio.play(name, gain, rate, { pan, ch: 'sfx' }); },
  setLayer(name, gain) { audio.loop(name, gain, 700, 'music'); },
};

export const SURFACE_BY_MAP = {
  campus: 'concrete', hall: 'tile', classroomA: 'tile', classroomB: 'tile', library: 'wood', office: 'tile',
  toilets: 'tile', stairs: 'concrete', upper: 'tile', storage: 'concrete', oldroom: 'wood', service: 'concrete',
  auditorium: 'wood', basement: 'concrete', rooftop: 'concrete',
};
