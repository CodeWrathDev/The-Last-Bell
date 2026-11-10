import Phaser from 'phaser';
import { preloadAssets, buildAssets } from '../assets/Loader.js';
import { VIEW_W, VIEW_H } from '../config.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    const bar = this.add.rectangle(VIEW_W / 2 - 100, VIEW_H / 2, 0, 6, 0x6a78a8).setOrigin(0, 0.5);
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, 204, 10).setStrokeStyle(1, 0x3a4468);
    this.load.on('progress', (v) => { bar.width = 200 * v; });
    preloadAssets(this);
  }
  create() {
    buildAssets(this);
    this.scene.start('Menu');
  }
}
