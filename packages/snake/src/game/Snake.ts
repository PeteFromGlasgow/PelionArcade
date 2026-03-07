export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface Point {
  x: number;
  y: number;
}

export interface SnakeMoveResult {
  head: Point;
  direction: Direction;
  collidedSelf: boolean;
  ateFood: boolean;
}

export class Snake {
  private segments: Point[] = [];
  private previousSegments: Point[] = [];
  private direction: Direction = 'RIGHT';
  private nextDirection: Direction = 'RIGHT';

  constructor(
    private readonly cols: number,
    private readonly rows: number,
  ) {}

  reset(startX: number, startY: number, length = 3, direction: Direction = 'RIGHT') {
    this.direction = direction;
    this.nextDirection = direction;

    this.segments = Array.from({ length }, (_, index) => ({
      x: startX - index,
      y: startY,
    }));

    this.previousSegments = this.segments.map(segment => ({ ...segment }));
  }

  getSegments(): readonly Point[] {
    return this.segments;
  }

  getPreviousSegments(): readonly Point[] {
    return this.previousSegments;
  }

  getDirection(): Direction {
    return this.direction;
  }

  queueDirection(direction: Direction) {
    this.nextDirection = direction;
  }

  move(foodPosition?: Point): SnakeMoveResult {
    this.previousSegments = this.segments.map(segment => ({ ...segment }));
    this.direction = this.nextDirection;

    const head = this.segments[0];
    const nextHead: Point = { x: head.x, y: head.y };

    switch (this.direction) {
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

    nextHead.x = (nextHead.x + this.cols) % this.cols;
    nextHead.y = (nextHead.y + this.rows) % this.rows;

    if (this.segments.some(segment => segment.x === nextHead.x && segment.y === nextHead.y)) {
      return {
        head: nextHead,
        direction: this.direction,
        collidedSelf: true,
        ateFood: false,
      };
    }

    this.segments.unshift(nextHead);

    const ateFood =
      foodPosition !== undefined
      && nextHead.x === foodPosition.x
      && nextHead.y === foodPosition.y;

    if (!ateFood) {
      this.segments.pop();
    }

    return {
      head: nextHead,
      direction: this.direction,
      collidedSelf: false,
      ateFood,
    };
  }

  occupies(point: Point): boolean {
    return this.segments.some(segment => segment.x === point.x && segment.y === point.y);
  }
}
