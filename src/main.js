import Phaser from 'phaser';
// Bundled Burmese (Myanmar Unicode) font so text renders correctly offline.
// Glob import: a missing package (before `npm install`) does NOT crash the dev server; index.html's Google Fonts link is the fallback.
import.meta.glob('/node_modules/@fontsource/noto-sans-myanmar/{400,700}.css', { eager: true });
import { VIEW_W, VIEW_H } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { CutsceneScene } from './scenes/CutsceneScene.js';
import { installReadableText } from './ui/textStyle.js';

function startGame() {
  installReadableText();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#05070f',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    input: { activePointers: 6 },   // stick + buttons + look-drag at the same time
    scene: [BootScene, MenuScene, GameScene, UIScene, CutsceneScene],
  });
  window.__game = game; // handy for debugging / screenshot tooling
  return game;
}

// Give the Myanmar web font a moment to load so title text renders correctly,
// but never block the game if the network is slow or offline.
const fontReady = document.fonts
  ? Promise.race([
      document.fonts.load('700 32px "Noto Sans Myanmar"', 'ကျောင်းည'),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
  : Promise.resolve();

fontReady.catch(() => {}).then(startGame);
