import Phaser from 'phaser';
import daveSheetUrl from '../../assets/dave_sprite_sheet.png';
import {
  GRID_SIZE,
  GAME_WIDTH,
  COLS,
  PLAY_VIEW_HEIGHT,
  PLAY_Y_OFFSET,
  PLAY_ROWS,
  TICK_MS_START,
  TICK_MS_MIN,
  SPEED_INCREASE_PER_FOOD,
} from '../constants';
import { SnakeFXPipeline, SNAKE_FX_PIPELINE_KEY } from '../shaders/SnakeFXPipeline';
import { FoodManager, type FoodTypeDefinition } from '../game/FoodManager';
import { Snake, type Direction, type Point, type SnakeMoveResult } from '../game/Snake';

const S = GRID_SIZE;
const CAMERA_ZOOM = 1;
const FIELD_MARGIN = GRID_SIZE * 6;
const FOOD_HINT_EDGE_PADDING = GRID_SIZE * 1.5;
const WRAP_RENDER_OFFSETS: readonly Point[] = [
  { x: -COLS, y: -PLAY_ROWS },
  { x: 0, y: -PLAY_ROWS },
  { x: COLS, y: -PLAY_ROWS },
  { x: -COLS, y: 0 },
  { x: 0, y: 0 },
  { x: COLS, y: 0 },
  { x: -COLS, y: PLAY_ROWS },
  { x: 0, y: PLAY_ROWS },
  { x: COLS, y: PLAY_ROWS },
];

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

  private snakeSpriteCopies: Phaser.GameObjects.Image[][] = [];
  private prevRotations: number[] = [];
  private currRotations: number[] = [];
  private worldSegments: Point[] = [];
  private previousWorldSegments: Point[] = [];
  private fieldGraphics!: Phaser.GameObjects.Graphics;
  private foodSprites: Phaser.GameObjects.Image[] = [];
  private fxPipeline: SnakeFXPipeline | null = null;
  private gameCamera!: Phaser.Cameras.Scene2D.Camera;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private overlayCamera!: Phaser.Cameras.Scene2D.Camera;
  private cameraZoom = CAMERA_ZOOM;
  private foodHintArrow!: Phaser.GameObjects.Image;
  private titleText!: Phaser.GameObjects.Text;
  private uiBar!: Phaser.GameObjects.Rectangle;
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
    this.snakeSpriteCopies = WRAP_RENDER_OFFSETS.map(() => []);
    this.prevRotations = [];
    this.currRotations = [];
    this.worldSegments = [];
    this.previousWorldSegments = [];
    this.foodSprites = [];
    this.cameraZoom = CAMERA_ZOOM;

    this.generateTextures();
    this.setupCameras();

    this.score = 0;
    this.tickMs = TICK_MS_START;
    this.elapsed = 0;
    this.tickCount = 0;

    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(PLAY_ROWS / 2);
    this.snake.reset(startX, startY);
    this.syncWorldSegments();
    this.foodManager.reset(this.snake.getSegments());

    this.fieldGraphics = this.add.graphics().setDepth(0);
    this.uiCamera.ignore(this.fieldGraphics);
    this.overlayCamera.ignore(this.fieldGraphics);

    this.foodSprites = WRAP_RENDER_OFFSETS.map(() => {
      const sprite = this.add.image(0, 0, 'food').setOrigin(0.5, 0.5).setDepth(1);
      this.uiCamera.ignore(sprite);
      this.overlayCamera.ignore(sprite);
      return sprite;
    });

    this.foodHintArrow = this.add
      .image(0, 0, 'food-indicator')
      .setDepth(30)
      .setVisible(false);

    this.drawFood();
    this.drawSnake();
    this.prevRotations = [...this.currRotations];

    this.uiBar = this.add.rectangle(0, 0, GAME_WIDTH, PLAY_Y_OFFSET, 0x16213e).setOrigin(0, 0);
    this.scoreText = this.add
      .text(16, PLAY_Y_OFFSET / 2, 'SCORE: 0', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#e0e0e0',
      })
      .setOrigin(0, 0.5);

    this.titleText = this.add
      .text(GAME_WIDTH - 16, PLAY_Y_OFFSET / 2, 'SNAKE', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#4ecca3',
      })
      .setOrigin(1, 0.5);

    this.gameCamera.ignore([this.uiBar, this.scoreText, this.titleText, this.foodHintArrow]);
    this.uiCamera.ignore(this.foodHintArrow);
    this.overlayCamera.ignore([this.uiBar, this.scoreText, this.titleText]);

    const pipelineManager = (
      this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer
    ).pipelines as unknown as {
      addPostPipeline: (key: string, cls: unknown) => void;
    };
    pipelineManager.addPostPipeline(SNAKE_FX_PIPELINE_KEY, SnakeFXPipeline);

    this.gameCamera.setPostPipeline(SNAKE_FX_PIPELINE_KEY);
    this.fxPipeline = this.gameCamera.getPostPipeline(
      SNAKE_FX_PIPELINE_KEY,
    ) as SnakeFXPipeline;

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.renderWorld(1);
  }

  update(_time: number, delta: number) {
    this.handleInput();

    this.elapsed += delta;
    if (this.elapsed >= this.tickMs) {
      this.elapsed -= this.tickMs;
      this.tick();
    }

    this.renderWorld(this.elapsed / this.tickMs);
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
    this.advanceWorldSegments(moveResult);

    if (this.fxPipeline) {
      const stepX = (GRID_SIZE / GAME_WIDTH) * 0.4;
      const stepY = (GRID_SIZE / PLAY_VIEW_HEIGHT) * 0.4;
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

  private setupCameras() {
    this.gameCamera = this.cameras.main;
    this.gameCamera.setViewport(0, PLAY_Y_OFFSET, GAME_WIDTH, PLAY_VIEW_HEIGHT);
    this.gameCamera.setBackgroundColor('#08111b');

    this.uiCamera = this.cameras.add(0, 0, GAME_WIDTH, PLAY_Y_OFFSET, false, 'ui');
    this.uiCamera.setBackgroundColor('#16213e');

    this.overlayCamera = this.cameras.add(
      0,
      0,
      GAME_WIDTH,
      PLAY_Y_OFFSET + PLAY_VIEW_HEIGHT,
      false,
      'overlay',
    );
    this.overlayCamera.setBackgroundColor('rgba(0, 0, 0, 0)');
  }

  private syncWorldSegments() {
    this.worldSegments = this.snake.getSegments().map(segment => ({ ...segment }));
    this.previousWorldSegments = this.worldSegments.map(segment => ({ ...segment }));
  }

  private advanceWorldSegments(moveResult: SnakeMoveResult) {
    this.previousWorldSegments = this.worldSegments.map(segment => ({ ...segment }));

    if (moveResult.collidedSelf) {
      return;
    }

    const previousHead = this.previousWorldSegments[0];
    const nextHead = { ...previousHead };

    switch (moveResult.direction) {
      case 'UP':
        nextHead.y -= 1;
        break;
      case 'DOWN':
        nextHead.y += 1;
        break;
      case 'LEFT':
        nextHead.x -= 1;
        break;
      case 'RIGHT':
        nextHead.x += 1;
        break;
    }

    const nextSegments: Point[] = [nextHead];
    for (let i = 1; i < this.snake.getSegments().length; i++) {
      nextSegments.push({ ...(this.previousWorldSegments[i - 1] ?? nextHead) });
    }

    this.worldSegments = nextSegments;
  }

  private renderWorld(t: number) {
    const headPosition = this.renderSnakePositions(t);
    this.updateCamera(headPosition);
    this.updateFoodHint(headPosition);
  }

  private updateCamera(headPosition: { px: number; py: number }) {
    this.gameCamera.setZoom(this.cameraZoom);
    this.gameCamera.centerOn(headPosition.px, headPosition.py);

    this.drawField(headPosition);
  }

  private drawField(headPosition: { px: number; py: number }) {
    const halfWidth = GAME_WIDTH / (2 * this.cameraZoom);
    const halfHeight = PLAY_VIEW_HEIGHT / (2 * this.cameraZoom);
    const left = headPosition.px - halfWidth - FIELD_MARGIN;
    const right = headPosition.px + halfWidth + FIELD_MARGIN;
    const top = headPosition.py - halfHeight - FIELD_MARGIN;
    const bottom = headPosition.py + halfHeight + FIELD_MARGIN;
    const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
    const endX = Math.ceil(right / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;
    const endY = Math.ceil(bottom / GRID_SIZE) * GRID_SIZE;

    this.fieldGraphics.clear();
    this.fieldGraphics.fillGradientStyle(0x08111b, 0x08111b, 0x10233a, 0x10233a, 1);
    this.fieldGraphics.fillRect(left, top, right - left, bottom - top);

    this.fieldGraphics.lineStyle(1, 0xffffff, 0.05);
    for (let x = startX; x <= endX; x += GRID_SIZE) {
      this.fieldGraphics.moveTo(x, top);
      this.fieldGraphics.lineTo(x, bottom);
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      this.fieldGraphics.moveTo(left, y);
      this.fieldGraphics.lineTo(right, y);
    }
    this.fieldGraphics.strokePath();

    this.fieldGraphics.lineStyle(2, 0x4ecca3, 0.12);
    for (let x = startX; x <= endX; x += GRID_SIZE * 4) {
      this.fieldGraphics.moveTo(x, top);
      this.fieldGraphics.lineTo(x, bottom);
    }
    for (let y = startY; y <= endY; y += GRID_SIZE * 4) {
      this.fieldGraphics.moveTo(left, y);
      this.fieldGraphics.lineTo(right, y);
    }
    this.fieldGraphics.strokePath();
  }

  private getFoodWorldPosition(foodPosition: Point): Point {
    const head = this.snake.getSegments()[0];
    const worldHead = this.worldSegments[0];

    let dx = foodPosition.x - head.x;
    let dy = foodPosition.y - head.y;

    if (dx > COLS / 2) dx -= COLS;
    else if (dx < -COLS / 2) dx += COLS;
    if (dy > PLAY_ROWS / 2) dy -= PLAY_ROWS;
    else if (dy < -PLAY_ROWS / 2) dy += PLAY_ROWS;

    return {
      x: worldHead.x + dx,
      y: worldHead.y + dy,
    };
  }

  private updateFoodHint(headPosition: { px: number; py: number }) {
    const food = this.foodManager.getActiveFood();
    if (!food) {
      this.foodHintArrow.setVisible(false);
      return;
    }

    const foodWorldPosition = this.getFoodWorldPosition(food.position);
    const { px, py } = this.cellCenter(foodWorldPosition);
    const centerX = GAME_WIDTH / 2;
    const centerY = PLAY_Y_OFFSET + PLAY_VIEW_HEIGHT / 2;
    const offsetX = (px - headPosition.px) * this.cameraZoom;
    const offsetY = (py - headPosition.py) * this.cameraZoom;
    const maxX = GAME_WIDTH / 2 - FOOD_HINT_EDGE_PADDING;
    const maxY = PLAY_VIEW_HEIGHT / 2 - FOOD_HINT_EDGE_PADDING;

    if (Math.abs(offsetX) <= maxX && Math.abs(offsetY) <= maxY) {
      this.foodHintArrow.setVisible(false);
      return;
    }

    const safeX = Math.max(Math.abs(offsetX), 0.001);
    const safeY = Math.max(Math.abs(offsetY), 0.001);
    const scale = Math.min(maxX / safeX, maxY / safeY);
    const hintX = centerX + offsetX * scale;
    const hintY = centerY + offsetY * scale;
    const alpha = 0.72 + Math.sin(this.time.now * 0.012) * 0.18;

    this.foodHintArrow
      .setVisible(true)
      .setPosition(hintX, hintY)
      .setRotation(Math.atan2(offsetY, offsetX) + Math.PI)
      .setAlpha(alpha);
  }

  private cellCenter(p: Point): { px: number; py: number } {
    return {
      px: p.x * GRID_SIZE + GRID_SIZE / 2,
      py: p.y * GRID_SIZE + GRID_SIZE / 2,
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
    const dx = to.x - from.x;
    const dy = to.y - from.y;

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

  private ensureSnakeSprites(length: number) {
    while (this.currRotations.length < length) {
      this.currRotations.push(0);
      this.prevRotations.push(0);
    }

    while (this.currRotations.length > length) {
      this.currRotations.pop();
      this.prevRotations.pop();
    }

    for (const copySprites of this.snakeSpriteCopies) {
      while (copySprites.length < length) {
        const sprite = this.add.image(0, 0, 'snake-body').setOrigin(0.5, 0.5).setDepth(2);
        copySprites.push(sprite);
        this.uiCamera.ignore(sprite);
        this.overlayCamera.ignore(sprite);
      }

      while (copySprites.length > length) {
        copySprites.pop()!.destroy();
      }
    }
  }

  private drawSnake() {
    const segments = this.worldSegments;
    this.ensureSnakeSprites(segments.length);

    for (let i = 0; i < segments.length; i++) {
      let textureKey = 'dave';
      let frame: number | undefined;
      let displayWidth = S;
      let displayHeight = S;
      let depth = 2;

      if (i === 0) {
        frame = this.tickCount % 2;
        displayWidth = S * 2;
        displayHeight = S * 2;
        depth = 3;
        this.currRotations[i] = 0;
      } else if (i === segments.length - 1) {
        const tailDir = this.dirBetween(segments[i - 1], segments[i]);
        frame = 3;
        this.currRotations[i] = this.dirToRotation(tailDir) - Math.PI / 2;
      } else {
        frame = 2;
        this.currRotations[i] = this.getBodyRotation(i, segments);
      }

      for (const copySprites of this.snakeSpriteCopies) {
        const sprite = copySprites[i];
        sprite
          .setTexture(textureKey, frame)
          .setDisplaySize(displayWidth, displayHeight)
          .setDepth(depth);
      }
    }
  }

  private lerpPixel(prev: Point, curr: Point, t: number): { px: number; py: number } {
    return {
      px: Phaser.Math.Linear(prev.x, curr.x, t) * S + S / 2,
      py: Phaser.Math.Linear(prev.y, curr.y, t) * S + S / 2,
    };
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    if (diff > Math.PI) diff -= 2 * Math.PI;
    else if (diff < -Math.PI) diff += 2 * Math.PI;
    return a + diff * t;
  }

  private renderSnakePositions(t: number): { px: number; py: number } {
    const segments = this.worldSegments;
    const previousSegments = this.previousWorldSegments;
    let headPosition = this.cellCenter(segments[0]);

    for (let i = 0; i < segments.length; i++) {
      const curr = segments[i];
      const prev = previousSegments[i] ?? curr;
      const { px, py } = this.lerpPixel(prev, curr, t);

      if (i === 0) {
        headPosition = { px, py };
      }

      const currRot = this.currRotations[i] ?? 0;
      const prevRot = this.prevRotations[i] ?? currRot;
      const rotation = this.lerpAngle(prevRot, currRot, t);

      for (let copyIndex = 0; copyIndex < this.snakeSpriteCopies.length; copyIndex++) {
        const offset = WRAP_RENDER_OFFSETS[copyIndex];
        this.snakeSpriteCopies[copyIndex][i]
          .setPosition(px + offset.x * GRID_SIZE, py + offset.y * GRID_SIZE)
          .setRotation(rotation);
      }
    }

    return headPosition;
  }

  private drawFood() {
    const food = this.foodManager.getActiveFood();
    if (!food) {
      for (const sprite of this.foodSprites) {
        sprite.setVisible(false);
      }
      return;
    }

    const foodWorldPosition = this.getFoodWorldPosition(food.position);
    const { px, py } = this.cellCenter(foodWorldPosition);

    for (let i = 0; i < this.foodSprites.length; i++) {
      const offset = WRAP_RENDER_OFFSETS[i];
      this.foodSprites[i]
        .setVisible(true)
        .setTexture(food.textureKey)
        .setPosition(px + offset.x * GRID_SIZE, py + offset.y * GRID_SIZE);
    }
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

    g.clear();
    g.fillStyle(0xffd166, 1);
    g.fillTriangle(2, S / 2, S - 4, 5, S - 4, S - 5);
    g.fillStyle(0xfff0b3, 1);
    g.fillTriangle(10, S / 2, S - 10, 10, S - 10, S - 10);
    g.generateTexture('food-indicator', S, S);

    g.destroy();
  }
}
