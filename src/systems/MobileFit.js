// Phones and tablets: go fullscreen on the first tap, lock the screen to landscape, and pause the game while the phone is held upright.
//  - Android Chrome: requestFullscreen() + screen.orientation.lock('landscape') work from a tap, so the game turns sideways by itself.
//  - iPhone Safari cannot lock or fullscreen a web page: the overlay in index.html asks the player to turn the phone (and "Add to Home Screen"
//    runs it fullscreen, because of the meta tags + manifest).
// Desktop browsers (mouse) are untouched. `?touch=1` does not trigger this, only a real coarse pointer does.

const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

export function installMobileFit(getGame) {
  if (typeof window === 'undefined' || !window.matchMedia?.('(pointer: coarse)').matches) return;
  const root = document.documentElement;

  const lockLandscape = () => {
    try { const r = screen.orientation?.lock?.('landscape'); r?.catch?.(() => {}); } catch (e) { /* not supported (iOS) */ }
  };
  const goFullscreen = () => {
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!req || isFs()) { lockLandscape(); return; }
    try {
      const r = req.call(root, { navigationUI: 'hide' });
      if (r?.then) r.then(lockLandscape).catch(() => {}); else lockLandscape();
    } catch (e) { /* the browser refused: the rotate overlay still works */ }
  };

  // Keep trying on taps until fullscreen has worked once; after that the player stays in control (Settings > Fullscreen toggles it).
  let entered = false;
  const onTap = () => { if (entered) return; goFullscreen(); };
  window.addEventListener('pointerup', onTap, { passive: true });
  const onFs = () => { if (isFs()) { entered = true; lockLandscape(); } };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // Portrait: the overlay (index.html) covers the screen. Freeze the game under it so the monster cannot act while nobody can see.
  const rotate = document.getElementById('rotate');
  rotate?.addEventListener('pointerup', goFullscreen);
  const mq = window.matchMedia('(orientation: portrait)');
  let slept = false;
  const sync = () => {
    const game = getGame?.(), portrait = mq.matches;
    if (!game?.loop) return;
    if (portrait && !slept) { game.loop.sleep(); try { game.sound?.pauseAll?.(); } catch (e) { /* ignore */ } slept = true; }
    else if (!portrait && slept) { game.loop.wake(); try { game.sound?.resumeAll?.(); } catch (e) { /* ignore */ } slept = false; }
  };
  mq.addEventListener?.('change', sync);
  window.addEventListener('resize', sync);
  getGame?.()?.events?.once?.('ready', sync);   // the loop starts after boot: re-check then, in case the phone was already upright
  sync();
}
