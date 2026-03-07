import Phaser from 'phaser';
import daveSheetUrl from '../../assets/dave_sprite_sheet.png';
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
import { SnakeFXPipeline, SNAKE_FX_PIPELINE_KEY } from '../shaders/SnakeFXPipeline';
import { FoodManager, type FoodTypeDefinition } from '../game/FoodManager';
import { Snake, type Direction, type Point } from '../game/Snake';

const S = GRID_SIZE;

const FOOD_TYPES: readonly FoodTypeDefinition[] = [
  {
    id: 'apple',
    textureKey: 'food',
    score: 10,
    speedDelta: SPEED_INCREASE_PER_FOOD,
  },
];

export class GameScene extends Phaser.Scene {
  private snake = new Snake(COLS, PLAY_ROWS);
  private foodManager = new FoodManager(COLS, PLAY_ROWS, FOOD_TYPES);
  private score = 0;
  private tickMs = TICK_MS_START;
  private elapsed = 0;
  private tickCount = 0;

  private snakeSprites: Phaser.GameObjects.Image[] = [];
  private prevRotations: number[] = [];
  private currRotations: number[] = [];
  private foodSprite!: Phaser.GameObjects.Image;
  private fxPipeline: SnakeFXPipeline | null = null;
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

  preload() {
    this.load.spritesheet('dave', daveSheetUrl, {
      frameWidth: 128,
      frameHeight: 128,
    });
  }

  create() {
    this.snakeSprites = [];
    this.prevRotations = [];
    this.currRotations = [];

    this.generateTextures();

    this.score = 0;
    this.tickMs = TICK_MS_START;
    this.elapsed = 0;
    this.tickCount = 0;

    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(PLAY_ROWS / 2);
    this.snake.reset(startX, startY);
    this.foodManager.reset(this.snake.getSegments());

    this.drawGrid();

    this.foodSprite = this.add.image(0, 0, 'food').setOrigin(0.5, 0.5).setDepth(1);
    this.drawFood();
    this.drawSnake();
    this.prevRotations = [...this.currRotations];

    this.add.rectangle(0, 0, 1280, PLAY_Y_OFFSET, 0x16213e).setOrigin(0, 0).setDepth(10);
    this.scoreText = this.add
      .text(16, PLAY_Y_OFFSET / 2, 'SCORE: 0', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#e0e0e0',
      })
      .setOrigin(0, 0.5)
      .setDepth(11);

    this.add
      .text(1264, PLAY_Y_OFFSET / 2, 'SNAKE', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#4ecca3',
      })
      .setOrigin(1, 0.5)
      .setDepth(11);

    const pipelineManager = (
      this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer
    ).pipelines as unknown as {
      addPostPipeline: (key: string, cls: unknown) => void;
    };
    pipelineManager.addPostPipeline(SNAKE_FX_PIPELINE_KEY, SnakeFXPipeline);

    this.cameras.main.setPostPipeline(SNAKE_FX_PIPELINE_KEY);
    this.fxPipeline = this.cameras.main.getPostPipeline(
      SNAKE_FX_PIPELINE_KEY,
    ) as SnakeFXPipeline;

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

    this.renderSnakePositions(this.elapsed / this.tickMs);
  }

  private handleInput() {
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const currentDirection = this.snake.getDirection();

    if (up && currentDirection !== 'DOWN') this.snake.queueDirection('UP');
    else if (down && currentDirection !== 'UP') this.snake.queueDirection('DOWN');
    else if (left && currentDirection !== 'RIGHT') this.snake.queueDirection('LEFT');
    else if (right && currentDirection !== 'LEFT') this.snake.queueDirection('RIGHT');
  }

  private tick() {
    this.prevRotations = [...this.currRotations];
    this.tickCount++;

    const activeFood = this.foodManager.getActiveFood();
    const moveResult = this.snake.move(activeFood?.position);

    if (this.fxPipeline) {
      const stepX = (GRID_SIZE / 1280) * 0.4;
      const stepY = (GRID_SIZE / 720) * 0.4;
      switch (moveResult.direction) {
        case 'RIGHT':
          this.fxPipeline.setVelocity(stepX, 0);
          break;
        case 'LEFT':
          this.fxPipeline.setVelocity(-stepX, 0);
          break;
        case 'DOWN':
          this.fxPipeline.setVelocity(0, stepY);
          break;
        case 'UP':
          this.fxPipeline.setVelocity(0, -stepY);
          break;
      }
    }

    if (moveResult.collidedSelf) {
      this.gameOver();
      return;
    }

    if (moveResult.ateFood && activeFood) {
      this.score += activeFood.score;
      this.scoreText.setText(`SCORE: ${this.score}`);
      this.tickMs = Math.max(TICK_MS_MIN, this.tickMs - activeFood.speedDelta);
      this.foodManager.spawn(this.snake.getSegments());
    }

    this.drawSnake();
    this.drawFood();
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

  private cellCenter(p: Point): { px: number; py: number } {
    return {
      px: p.x * GRID_SIZE + GRID_SIZE / 2,
      py: PLAY_Y_OFFSET + p.y * GRID_SIZE + GRID_SIZE / 2,
    };
  }

  private dirToRotation(dir: Direction): number {
    switch (dir) {
      case 'RIGHT':
        return 0;
      case 'DOWN':
        return Math.PI / 2;
      case 'LEFT':
        return Math.PI;
      case 'UP':
        return -Math.PI / 2;
    }
  }

  private dirBetween(from: Point, to: Point): Direction {
    let dx = to.x - from.x;
    let dy = to.y - from.y;

    if (dx > COLS / 2) dx -= COLS;
    else if (dx < -COLS / 2) dx += COLS;
    if (dy > PLAY_ROWS / 2) dy -= PLAY_ROWS;
    else if (dy < -PLAY_ROWS / 2) dy += PLAY_ROWS;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? 'RIGHT' : 'LEFT';
    }
    return dy >= 0 ? 'DOWN' : 'UP';
  }

  private getBodyRotation(i: number, segments: readonly Point[]): number {
    const seg = segments[i];
    const prev = segments[i - 1];
    const toPrev = this.dirBetween(seg, prev);
    return this.dirToRotation(toPrev) - Math.PI / 2;
  }

  private drawSnake() {
    const segments = this.snake.getSegments();

    while (this.snakeSprites.length < segments.length) {
      this.snakeSprites.push(
        this.add.image(0, 0, 'snake-body').setOrigin(0.5, 0.5).setDepth(2),
      );
      this.currRotations.push(0);
      this.prevRotations.push(0);
    }
    while (this.snakeSprites.length > segments.length) {
      this.snakeSprites.pop()!.destroy();
      this.currRotations.pop();
      this.prevRotations.pop();
    }

    for (let i = 0; i < segments.length; i++) {
      const sprite = this.snakeSprites[i];

      if (i === 0) {
        const frame = this.tickCount % 2;
        sprite.setTexture('dave', frame).setDisplaySize(S * 2, S * 2);
        sprite.setDepth(3);
        this.currRotations[i] = 0;
      } else if (i === segments.length - 1) {
        const tailDir = this.dirBetween(segments[i - 1], segments[i]);
        sprite.setTexture('dave', 3).setDisplaySize(S, S);
        sprite.setDepth(2);
        this.currRotations[i] = this.dirToRotation(tailDir) - Math.PI / 2;
      } else {
        sprite.setTexture('dave', 2).setDisplaySize(S, S);
        sprite.setDepth(2);
        this.currRotations[i] = this.getBodyRotation(i, segments);
      }
    }
  }

  private lerpPixel(prev: Point, curr: Point, t: number): { px: number; py: number } {
    let dx = curr.x - prev.x;
    let dy = curr.y - prev.y;
    if (dx > COLS / 2) dx -= COLS;
    else if (dx < -COLS / 2) dx += COLS;
    if (dy > PLAY_ROWS / 2) dy -= PLAY_ROWS;
    else if (dy < -PLAY_ROWS / 2) dy += PLAY_ROWS;
    return {
      px: (prev.x + dx * t) * S + S / 2,
      py: PLAY_Y_OFFSET + (prev.y + dy * t) * S + S / 2,
    };
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    if (diff > Math.PI) diff -= 2 * Math.PI;
    else if (diff < -Math.PI) diff += 2 * Math.PI;
    return a + diff * t;
  }

  private renderSnakePositions(t: number) {
    const segments = this.snake.getSegments();
    const previousSegments = this.snake.getPreviousSegments();

    for (let i = 0; i < this.snakeSprites.length; i++) {
      const curr = segments[i];
      const prev = previousSegments[i] ?? curr;
      const { px, py } = this.lerpPixel(prev, curr, t);
      this.snakeSprites[i].setPosition(px, py);

      const currRot = this.currRotations[i] ?? 0;
      const prevRot = this.prevRotations[i] ?? currRot;
      this.snakeSprites[i].setRotation(this.lerpAngle(prevRot, currRot, t));
    }
  }

  private drawFood() {
    const food = this.foodManager.getActiveFood();
    if (!food) {
      this.foodSprite.setVisible(false);
      return;
    }

    const { px, py } = this.cellCenter(food.position);
    this.foodSprite
      .setVisible(true)
      .setTexture(food.textureKey)
      .setPosition(px, py);
  }

  private gameOver() {
    this.scene.start('GameOverScene', { score: this.score });
  }

  private generateTextures() {
    if (this.textures.exists('snake-body')) return;

    const g = new Phaser.GameObjects.Graphics(this);

    g.clear();
    g.fillStyle(0x38a085, 1);
    g.fillRect(0, 4, S, S - 8);
    g.fillStyle(0x2d8a72, 1);
    g.fillCircle(S / 4, S / 2, 4);
    g.fillCircle((3 * S) / 4, S / 2, 4);
    g.generateTexture('snake-body', S, S);

    g.clear();
    g.fillStyle(0x38a085, 1);
    g.fillRect(S / 2, 4, S / 2, S - 8);
    g.fillRect(4, S / 2, S - 8, S / 2);
    g.fillStyle(0x2d8a72, 1);
    g.fillCircle((3 * S) / 4, (3 * S) / 4, 4);
    g.generateTexture('snake-bend', S, S);

    g.clear();
    g.fillStyle(0x38a085, 1);
    g.fillTriangle(
      2,
      6,
      2,
      S - 6,
      S - 4,
      S / 2,
    );
    g.generateTexture('snake-tail', S, S);

    g.clear();
    g.fillStyle(0xff6b6b, 1);
    g.fillCircle(S / 2, S / 2 + 2, S / 2 - 3);
    g.fillStyle(0xffaaaa, 0.7);
    g.fillCircle(S / 2 - 4, S / 2 - 2, 4);
    g.fillStyle(0x5c4a1e, 1);
    g.fillRect(S / 2 - 1, 2, 2, 6);
    g.fillStyle(0x4ecca3, 1);
    g.fillEllipse(S / 2 + 4, 5, 8, 4);
    g.generateTexture('food', S, S);

    g.destroy();
  }
}
