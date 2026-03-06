import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL, // PostFX pipelines require WebGL
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: document.body,
    width: 1280,
    height: 720,
  },
  scene: [GameScene, GameOverScene],
};

new Phaser.Game(config);
