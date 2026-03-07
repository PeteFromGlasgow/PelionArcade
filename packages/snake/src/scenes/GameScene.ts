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

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Point {
  x: number;
  y: number;
}

const S = GRID_SIZE;

export class GameScene extends Phaser.Scene {
  private snake: Point[] = [];
  private prevSnake: Point[] = [];
  private direction: Direction = 'RIGHT';
  private nextDirection: Direction = 'RIGHT';
  private food: Point = { x: 0, y: 0 };
  private score = 0;
  private tickMs = TICK_MS_START;
  private elapsed = 0;

  private tickCount = 0;

  private snakeSprites: Phaser.GameObjects.Image[] = [];
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
    // Reset sprite references (Phaser destroys game objects on scene restart)
    this.snakeSprites = [];

    this.generateTextures();

    this.score = 0;
    this.tickMs = TICK_MS_START;
    this.elapsed = 0;
    this.tickCount = 0;
    this.direction = 'RIGHT';
    this.nextDirection = 'RIGHT';

    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(PLAY_ROWS / 2);
    this.snake = [
      { x: startX,     y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    this.prevSnake = this.snake.map(p => ({ ...p }));

    this.spawnFood();
    this.drawGrid();

    // Food rendered below snake
    this.foodSprite = this.add.image(0, 0, 'food').setOrigin(0.5, 0.5).setDepth(1);
    this.drawFood();
    this.drawSnake();

    // UI bar on top
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

    // Register the PostFX class with Phaser's pipeline manager (safe to call
    // every time; addPostPipeline skips duplicates internally).
    // getPostPipeline() always looks up by name in this registry, so the
    // class must be registered before setPostPipeline is called.
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
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
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
    const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.down.isDown;
    const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;

    if      (up    && this.direction !== 'DOWN')  this.nextDirection = 'UP';
    else if (down  && this.direction !== 'UP')    this.nextDirection = 'DOWN';
    else if (left  && this.direction !== 'RIGHT') this.nextDirection = 'LEFT';
    else if (right && this.direction !== 'LEFT')  this.nextDirection = 'RIGHT';
  }

  private tick() {
    this.prevSnake = this.snake.map(p => ({ ...p }));
    this.tickCount++;
    this.direction = this.nextDirection;

    // Update motion-blur velocity (one grid cell in UV space, scaled to blur spread).
    if (this.fxPipeline) {
      const stepX = (GRID_SIZE / 1280) * 0.4;
      const stepY = (GRID_SIZE / 720)  * 0.4;
      switch (this.direction) {
        case 'RIGHT': this.fxPipeline.setVelocity( stepX,  0);     break;
        case 'LEFT':  this.fxPipeline.setVelocity(-stepX,  0);     break;
        case 'DOWN':  this.fxPipeline.setVelocity( 0,      stepY); break;
        case 'UP':    this.fxPipeline.setVelocity( 0,     -stepY); break;
      }
    }

    const head = this.snake[0];
    const next: Point = { x: head.x, y: head.y };

    switch (this.direction) {
      case 'UP':    next.y -= 1; break;
      case 'DOWN':  next.y += 1; break;
      case 'LEFT':  next.x -= 1; break;
      case 'RIGHT': next.x += 1; break;
    }

    next.x = (next.x + COLS)      % COLS;
    next.y = (next.y + PLAY_ROWS) % PLAY_ROWS;

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
      grid.moveTo(0,                PLAY_Y_OFFSET + y * GRID_SIZE);
      grid.lineTo(COLS * GRID_SIZE, PLAY_Y_OFFSET + y * GRID_SIZE);
    }
    grid.strokePath();
  }

  // Returns the pixel center of a grid cell
  private cellCenter(p: Point): { px: number; py: number } {
    return {
      px: p.x * GRID_SIZE + GRID_SIZE / 2,
      py: PLAY_Y_OFFSET + p.y * GRID_SIZE + GRID_SIZE / 2,
    };
  }

  // Returns the rotation angle (radians) for a given direction,
  // where 0 = pointing RIGHT (base orientation of all sprites).
  private dirToRotation(dir: Direction): number {
    switch (dir) {
      case 'RIGHT': return 0;
      case 'DOWN':  return Math.PI / 2;
      case 'LEFT':  return Math.PI;
      case 'UP':    return -Math.PI / 2;
    }
  }

  // Returns the direction of travel from `from` to `to`, accounting for
  // grid wrap-around.
  private dirBetween(from: Point, to: Point): Direction {
    let dx = to.x - from.x;
    let dy = to.y - from.y;

    if      (dx >  COLS      / 2) dx -= COLS;
    else if (dx < -COLS      / 2) dx += COLS;
    if      (dy >  PLAY_ROWS / 2) dy -= PLAY_ROWS;
    else if (dy < -PLAY_ROWS / 2) dy += PLAY_ROWS;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? 'RIGHT' : 'LEFT';
    } else {
      return dy >= 0 ? 'DOWN' : 'UP';
    }
  }

  // Returns the texture key and rotation for a body segment at index i.
  // The base bend texture (rotation=0) connects the RIGHT and DOWN sides.
  // The base straight texture (rotation=0) is horizontal.
  private getBodySpriteInfo(i: number): { texture: string; rotation: number } {
    const seg  = this.snake[i];
    const prev = this.snake[i - 1]; // toward head
    const next = this.snake[i + 1]; // toward tail

    // fromNext: direction of travel arriving at seg from the tail side
    // toPrev:   direction of travel leaving seg toward the head side
    const fromNext = this.dirBetween(next, seg);
    const toPrev   = this.dirBetween(seg, prev);

    if (fromNext === toPrev) {
      // Straight segment
      const isHorizontal = fromNext === 'LEFT' || fromNext === 'RIGHT';
      return { texture: 'snake-body', rotation: isHorizontal ? 0 : Math.PI / 2 };
    }

    // Bend segment
    // Map (fromNext, toPrev) to the rotation needed so the base RIGHT+DOWN
    // bend opens toward the correct pair of sides.
    //
    // Logic: the open sides of the cell are:
    //   entryFromSide = opposite(fromNext)   [where the tail-side body enters]
    //   exitToSide    = toPrev               [where the head-side body exits]
    //
    // Base texture opens RIGHT+DOWN.
    // Rotating 90° CW: RIGHT→DOWN, DOWN→LEFT → opens DOWN+LEFT.
    // Rotating 180°:                           opens LEFT+UP.
    // Rotating 270° CW (-90°):                 opens UP+RIGHT.
    const bendMap: Record<string, number> = {
      'UP+RIGHT':   0,          // entry from top,   exit right  → open DOWN+RIGHT → 0
      'LEFT+DOWN':  0,          // entry from left,  exit down   → open RIGHT+DOWN → 0
      'UP+LEFT':    Math.PI / 2,
      'RIGHT+DOWN': Math.PI / 2,
      'DOWN+LEFT':  Math.PI,
      'RIGHT+UP':   Math.PI,
      'DOWN+RIGHT': -Math.PI / 2,
      'LEFT+UP':    -Math.PI / 2,
    };

    const key = `${fromNext}+${toPrev}`;
    return { texture: 'snake-bend', rotation: bendMap[key] ?? 0 };
  }

  private drawSnake() {
    // Grow or shrink the sprite pool to match snake length
    while (this.snakeSprites.length < this.snake.length) {
      this.snakeSprites.push(
        this.add.image(0, 0, 'snake-body').setOrigin(0.5, 0.5).setDepth(2),
      );
    }
    while (this.snakeSprites.length > this.snake.length) {
      this.snakeSprites.pop()!.destroy();
    }

    for (let i = 0; i < this.snake.length; i++) {
      const sprite = this.snakeSprites[i];

      if (i === 0) {
        // Head – frame 0 = closed mouth, frame 1 = open mouth, alternates every tick
        const frame = this.tickCount % 2;
        sprite.setTexture('dave', frame).setDisplaySize(S * 2, S * 2);
        sprite.setRotation(0);
      } else if (i === this.snake.length - 1) {
        // Tail – sprite base is pointing DOWN, so offset rotation by -Math.PI/2
        const tailDir = this.dirBetween(this.snake[i - 1], this.snake[i]);
        sprite.setTexture('dave', 3).setDisplaySize(S, S);
        sprite.setRotation(this.dirToRotation(tailDir) - Math.PI / 2);
      } else {
        // Body
        const { texture, rotation } = this.getBodySpriteInfo(i);
        if (texture === 'snake-body') {
          // Sprite base is vertical, offset rotation by -Math.PI/2
          sprite.setTexture('dave', 2).setDisplaySize(S * 2, S * 2);
          sprite.setRotation(rotation - Math.PI / 2);
        } else {
          // Bend – still uses programmatic texture with its own rotation convention
          sprite.setTexture(texture).setDisplaySize(S * 2, S * 2);
          sprite.setRotation(rotation);
        }
      }
    }
  }

  // Interpolates pixel position between two grid points, handling wrap-around
  // so the snake slides through the wall edge rather than snapping across it.
  private lerpPixel(prev: Point, curr: Point, t: number): { px: number; py: number } {
    let dx = curr.x - prev.x;
    let dy = curr.y - prev.y;
    if (dx >  COLS      / 2) dx -= COLS;
    else if (dx < -COLS / 2) dx += COLS;
    if (dy >  PLAY_ROWS / 2) dy -= PLAY_ROWS;
    else if (dy < -PLAY_ROWS / 2) dy += PLAY_ROWS;
    return {
      px: (prev.x + dx * t) * S + S / 2,
      py: PLAY_Y_OFFSET + (prev.y + dy * t) * S + S / 2,
    };
  }

  private renderSnakePositions(t: number) {
    for (let i = 0; i < this.snakeSprites.length; i++) {
      const curr = this.snake[i];
      const prev = this.prevSnake[i] ?? curr;
      const { px, py } = this.lerpPixel(prev, curr, t);
      this.snakeSprites[i].setPosition(px, py);
    }
  }

  private drawFood() {
    const { px, py } = this.cellCenter(this.food);
    this.foodSprite.setPosition(px, py);
  }

  private gameOver() {
    this.scene.start('GameOverScene', { score: this.score });
  }

  // Generates all sprite textures programmatically. Skips if already created.
  private generateTextures() {
    if (this.textures.exists('snake-body')) return;

    const g = new Phaser.GameObjects.Graphics(this);

    // snake-head is loaded as a spritesheet in preload(); no generation needed here.

    // ── BODY STRAIGHT (base: horizontal, connecting LEFT and RIGHT) ──
    g.clear();
    g.fillStyle(0x38a085, 1);
    g.fillRect(0, 4, S, S - 8);
    // Scale dots
    g.fillStyle(0x2d8a72, 1);
    g.fillCircle(S / 4,       S / 2, 4);
    g.fillCircle((3 * S) / 4, S / 2, 4);
    g.generateTexture('snake-body', S, S);

    // ── BODY BEND (base: connects RIGHT side and DOWN/BOTTOM side) ──
    // Right arm:  x=[S/2, S],   y=[4, S-4]  — runs centre→right at channel height
    // Down arm:   x=[4, S-4],   y=[S/2, S]  — runs centre→bottom at channel width
    g.clear();
    g.fillStyle(0x38a085, 1);
    g.fillRect(S / 2,     4,     S / 2,     S - 8); // right arm
    g.fillRect(4,         S / 2, S - 8,     S / 2); // down arm
    // Scale dot at corner
    g.fillStyle(0x2d8a72, 1);
    g.fillCircle((3 * S) / 4, (3 * S) / 4, 4);
    g.generateTexture('snake-bend', S, S);

    // ── TAIL (base: tip points RIGHT, body connects on LEFT) ──
    g.clear();
    g.fillStyle(0x38a085, 1);
    // Triangle: left edge (body side) is flat, right vertex is the tip
    g.fillTriangle(
      2,     6,      // top-left
      2,     S - 6,  // bottom-left
      S - 4, S / 2,  // tip at right
    );
    g.generateTexture('snake-tail', S, S);

    // ── FOOD (apple) ──
    g.clear();
    // Apple body
    g.fillStyle(0xff6b6b, 1);
    g.fillCircle(S / 2, S / 2 + 2, S / 2 - 3);
    // Shine highlight
    g.fillStyle(0xffaaaa, 0.7);
    g.fillCircle(S / 2 - 4, S / 2 - 2, 4);
    // Stem
    g.fillStyle(0x5c4a1e, 1);
    g.fillRect(S / 2 - 1, 2, 2, 6);
    // Leaf
    g.fillStyle(0x4ecca3, 1);
    g.fillEllipse(S / 2 + 4, 5, 8, 4);
    g.generateTexture('food', S, S);

    g.destroy();
  }
}
