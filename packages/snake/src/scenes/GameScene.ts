import Phaser from 'phaser';
import {
  GRID_SIZE,
  COLS,
  ROWS,
  PLAY_Y_OFFSET,
  PLAY_ROWS,
  TICK_MS_START,
  TICK_MS_MIN,
  SPEED_INCREASE_PER_FOOD,
} from '../constants';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Point {
  x: number;
  y: number;
}

export class GameScene extends Phaser.Scene {
  private snake: Point[] = [];
  private direction: Direction = 'RIGHT';
  private nextDirection: Direction = 'RIGHT';
  private food: Point = { x: 0, y: 0 };
  private score = 0;
  private tickMs = TICK_MS_START;
  private elapsed = 0;

  private snakeGraphics!: Phaser.GameObjects.Graphics;
  private foodGraphics!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.score = 0;
    this.tickMs = TICK_MS_START;
    this.elapsed = 0;
    this.direction = 'RIGHT';
    this.nextDirection = 'RIGHT';

    // Start snake in the middle of the play area
    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(PLAY_ROWS / 2);
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];

    this.snakeGraphics = this.add.graphics();
    this.foodGraphics = this.add.graphics();

    this.spawnFood();
    this.drawGrid();
    this.drawSnake();
    this.drawFood();

    // Score / UI bar
    this.add.rectangle(0, 0, 1280, PLAY_Y_OFFSET, 0x16213e).setOrigin(0, 0);
    this.scoreText = this.add
      .text(16, PLAY_Y_OFFSET / 2, 'SCORE: 0', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#e0e0e0',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(1264, PLAY_Y_OFFSET / 2, 'SNAKE', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#4ecca3',
      })
      .setOrigin(1, 0.5);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  update(_time: number, delta: number) {
    this.handleInput();

    this.elapsed += delta;
    if (this.elapsed >= this.tickMs) {
      this.elapsed -= this.tickMs;
      this.tick();
    }
  }

  private handleInput() {
    if (this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).isDown) {
      if (window.parent !== window) {
        window.parent.postMessage('backToArcade', '*');
      } else {
        window.history.back();
      }
      return;
    }

    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;

    if (up && this.direction !== 'DOWN') this.nextDirection = 'UP';
    else if (down && this.direction !== 'UP') this.nextDirection = 'DOWN';
    else if (left && this.direction !== 'RIGHT') this.nextDirection = 'LEFT';
    else if (right && this.direction !== 'LEFT') this.nextDirection = 'RIGHT';
  }

  private tick() {
    this.direction = this.nextDirection;

    const head = this.snake[0];
    const next: Point = { x: head.x, y: head.y };

    switch (this.direction) {
      case 'UP':    next.y -= 1; break;
      case 'DOWN':  next.y += 1; break;
      case 'LEFT':  next.x -= 1; break;
      case 'RIGHT': next.x += 1; break;
    }

    // Wrap around walls
    next.x = (next.x + COLS) % COLS;
    next.y = (next.y + PLAY_ROWS) % PLAY_ROWS;

    // Self collision
    if (this.snake.some(s => s.x === next.x && s.y === next.y)) {
      this.gameOver();
      return;
    }

    this.snake.unshift(next);

    if (next.x === this.food.x && next.y === this.food.y) {
      this.score += 10;
      this.scoreText.setText(`SCORE: ${this.score}`);
      this.tickMs = Math.max(TICK_MS_MIN, this.tickMs - SPEED_INCREASE_PER_FOOD);
      this.spawnFood();
    } else {
      this.snake.pop();
    }

    this.drawSnake();
    this.drawFood();
  }

  private spawnFood() {
    let pos: Point;
    do {
      pos = {
        x: Phaser.Math.Between(0, COLS - 1),
        y: Phaser.Math.Between(0, PLAY_ROWS - 1),
      };
    } while (this.snake.some(s => s.x === pos.x && s.y === pos.y));
    this.food = pos;
  }

  private drawGrid() {
    const grid = this.add.graphics();
    grid.lineStyle(1, 0xffffff, 0.04);
    for (let x = 0; x <= COLS; x++) {
      grid.moveTo(x * GRID_SIZE, PLAY_Y_OFFSET);
      grid.lineTo(x * GRID_SIZE, ROWS * GRID_SIZE);
    }
    for (let y = 0; y <= PLAY_ROWS; y++) {
      grid.moveTo(0, PLAY_Y_OFFSET + y * GRID_SIZE);
      grid.lineTo(COLS * GRID_SIZE, PLAY_Y_OFFSET + y * GRID_SIZE);
    }
    grid.strokePath();
  }

  private cellToPixel(p: Point): { px: number; py: number } {
    return {
      px: p.x * GRID_SIZE,
      py: PLAY_Y_OFFSET + p.y * GRID_SIZE,
    };
  }

  private drawSnake() {
    this.snakeGraphics.clear();
    const pad = 2;
    this.snake.forEach((seg, i) => {
      const { px, py } = this.cellToPixel(seg);
      const isHead = i === 0;
      this.snakeGraphics.fillStyle(isHead ? 0x4ecca3 : 0x38a085, 1);
      this.snakeGraphics.fillRoundedRect(
        px + pad,
        py + pad,
        GRID_SIZE - pad * 2,
        GRID_SIZE - pad * 2,
        4,
      );
    });
  }

  private drawFood() {
    this.foodGraphics.clear();
    const { px, py } = this.cellToPixel(this.food);
    const cx = px + GRID_SIZE / 2;
    const cy = py + GRID_SIZE / 2;
    this.foodGraphics.fillStyle(0xff6b6b, 1);
    this.foodGraphics.fillCircle(cx, cy, GRID_SIZE / 2 - 4);
  }

  private gameOver() {
    this.scene.start('GameOverScene', { score: this.score });
  }
}
