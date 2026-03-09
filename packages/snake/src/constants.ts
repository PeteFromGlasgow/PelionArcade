export const GRID_SIZE = 32;
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// UI bar at top (in pixels)
export const UI_HEIGHT = GRID_SIZE * 1;  // one row reserved for score/UI

// Playfield viewport on screen
export const PLAY_Y_OFFSET = UI_HEIGHT;
export const PLAY_VIEW_HEIGHT = GAME_HEIGHT - PLAY_Y_OFFSET;

// Playfield in grid units
export const COLS = 48;
export const PLAY_ROWS = 48;
export const PLAY_WIDTH = COLS * GRID_SIZE;
export const PLAY_HEIGHT = PLAY_ROWS * GRID_SIZE;

export const TICK_MS_START = 150;       // ms per move at the start
export const TICK_MS_MIN = 60;          // fastest the snake can move
export const SPEED_INCREASE_PER_FOOD = 5; // ms reduction per food eaten
