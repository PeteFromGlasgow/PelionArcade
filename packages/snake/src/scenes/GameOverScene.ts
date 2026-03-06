import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: { score: number }) {
    const score: number = data?.score ?? 0;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setOrigin(0, 0);

    this.add
      .text(cx, cy - 80, 'GAME OVER', {
        fontFamily: 'monospace',
        fontSize: '72px',
        color: '#ff6b6b',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy, `SCORE: ${score}`, {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#e0e0e0',
      })
      .setOrigin(0.5);

    const restartText = this.add
      .text(cx, cy + 80, 'PRESS SPACE OR CLICK TO PLAY AGAIN', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#4ecca3',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: restartText,
      alpha: 0,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard!.once('keydown-SPACE', () => this.restart());
    this.input.once('pointerdown', () => this.restart());
  }

  private restart() {
    this.scene.start('GameScene');
  }
}
