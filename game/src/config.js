// Lanternkeep tuning: every number the rest of the game shares. The field is
// a fixed logical size; the renderer scales it to the window.
export const FIELD = { width: 960, height: 600 };
export const STEP = 1 / 60;
export const BEST_KEY = 'lanternkeep.best';
export const LANTERN = {
  x: FIELD.width / 2,
  y: FIELD.height / 2,
  radius: 26,
  maxHp: 100,
  lightFull: 300,
  lightLow: 140,
};
export const PLAYER = {
  radius: 14,
  speed: 250,
  maxHp: 100,
  fireInterval: 0.22,
  bulletSpeed: 560,
  bulletDamage: 12,
  bulletRadius: 5,
  bulletRange: 520,
  touchDamage: 8,
  invulnerableSeconds: 0.8,
};
export const WAVES = 10;
export const BOSS_WAVES = [5, 7, 10];
export const ENDLESS_START = WAVES + 1;
export const NOVA_INTERVAL = 9;
export const COMBO_WINDOW = 3;
export const EMBER_SCORE = 25;
export const WAVE_CLEAR_BONUS = 100;
