export const GRID_SIZE = 32;
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Playfield in grid units
export const COLS = Math.floor(GAME_WIDTH / GRID_SIZE);   // 40
export const ROWS = Math.floor(GAME_HEIGHT / GRID_SIZE);  // 22

// UI bar at top (in pixels)
export const UI_HEIGHT = GRID_SIZE * 1;  // one row reserved for score/UI

// Effective play area starts below the UI bar
export const PLAY_Y_OFFSET = UI_HEIGHT;
export const PLAY_ROWS = ROWS - 1;      // 21 rows of playfield

export const TICK_MS_START = 150;       // ms per move at the start
export const TICK_MS_MIN = 60;          // fastest the snake can move
export const SPEED_INCREASE_PER_FOOD = 5; // ms reduction per food eaten
