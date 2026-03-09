import Phaser from 'phaser';
import type { Point } from './Snake';

export interface FoodTypeDefinition {
  id: string;
  textureKey: string;
  score: number;
  speedDelta: number;
}

export interface FoodInstance extends FoodTypeDefinition {
  position: Point;
}

export class FoodManager {
  private activeFood: FoodInstance | null = null;

  constructor(
    private readonly cols: number,
    private readonly rows: number,
    private readonly foodTypes: readonly FoodTypeDefinition[],
  ) {
    if (this.foodTypes.length === 0) {
      throw new Error('FoodManager requires at least one food type.');
    }
  }

  reset(occupiedCells: readonly Point[]) {
    this.spawn(occupiedCells);
  }

  getActiveFood(): FoodInstance | null {
    return this.activeFood;
  }

  spawn(occupiedCells: readonly Point[]) {
    let position: Point;

    do {
      position = {
        x: Phaser.Math.Between(0, this.cols - 1),
        y: Phaser.Math.Between(0, this.rows - 1),
      };
    } while (occupiedCells.some(cell => cell.x === position.x && cell.y === position.y));

    const foodType = this.foodTypes[Phaser.Math.Between(0, this.foodTypes.length - 1)];
    this.activeFood = {
      ...foodType,
      position,
    };
  }
}
