// The shades that crawl out of the dark. Each kind has its own shape, speed,
// health, damage and score, so the player reads the threat at a glance.
// Bosses are kinds too, with phases and their own attacks.
export const KIND_WISP = 'wisp';
export const KIND_CRAWLER = 'crawler';
export const KIND_SPITTER = 'spitter';
export const KIND_SPLITTER = 'splitter';
export const KIND_BRUTE = 'brute';
export const KIND_KING = 'king';

export const KINDS = {
  [KIND_WISP]: {
    name: 'Wisp', radius: 11, hp: 18, speed: 95, damage: 6, score: 50,
    color: '#8b7bff', eye: '#e8e4ff', emberChance: 0.25,
  },
  [KIND_CRAWLER]: {
    name: 'Crawler', radius: 17, hp: 55, speed: 48, damage: 12, score: 100,
    color: '#5fb08a', eye: '#d8ffe9', emberChance: 0.4,
  },
  [KIND_SPITTER]: {
    name: 'Spitter', radius: 13, hp: 30, speed: 62, damage: 8, score: 120,
    color: '#e07b54', eye: '#ffe9d8', emberChance: 0.35, ranged: true, range: 260, shotInterval: 2.2,
  },
  [KIND_SPLITTER]: {
    name: 'Splitter', radius: 15, hp: 36, speed: 72, damage: 8, score: 110,
    color: '#d95f8a', eye: '#ffe0ec', emberChance: 0.3, splits: 2,
  },
  [KIND_BRUTE]: {
    name: 'Gloombrute', radius: 34, hp: 520, speed: 42, damage: 22, score: 1500,
    color: '#a06be0', eye: '#f4e8ff', emberChance: 1, boss: true,
  },
  [KIND_KING]: {
    name: 'The Hollow King', radius: 40, hp: 950, speed: 36, damage: 28, score: 4000,
    color: '#e0c06b', eye: '#fff6d8', emberChance: 1, boss: true,
  },
};

// What each wave sends. `at` is seconds into the wave; the wave ends when
// every spawned enemy is dead. Boss waves add their boss at 6 seconds.
export const WAVE_TABLE = {
  1: [{ kind: KIND_WISP, count: 8, at: 0, gap: 1.1 }],
  2: [{ kind: KIND_WISP, count: 12, at: 0, gap: 0.9 }, { kind: KIND_CRAWLER, count: 3, at: 6, gap: 2.0 }],
  3: [{ kind: KIND_WISP, count: 14, at: 0, gap: 0.8 }, { kind: KIND_CRAWLER, count: 5, at: 4, gap: 1.6 }, { kind: KIND_SPITTER, count: 3, at: 10, gap: 2.4 }],
  4: [{ kind: KIND_WISP, count: 16, at: 0, gap: 0.7 }, { kind: KIND_SPLITTER, count: 5, at: 5, gap: 1.8 }, { kind: KIND_CRAWLER, count: 6, at: 8, gap: 1.5 }, { kind: KIND_SPITTER, count: 4, at: 12, gap: 2.0 }],
  5: [{ kind: KIND_WISP, count: 10, at: 0, gap: 0.8 }, { kind: KIND_BRUTE, count: 1, at: 6, gap: 0 }, { kind: KIND_CRAWLER, count: 6, at: 14, gap: 1.6 }],
  6: [{ kind: KIND_WISP, count: 18, at: 0, gap: 0.6 }, { kind: KIND_SPLITTER, count: 7, at: 4, gap: 1.5 }, { kind: KIND_SPITTER, count: 6, at: 8, gap: 1.7 }, { kind: KIND_CRAWLER, count: 8, at: 12, gap: 1.3 }],
  7: [{ kind: KIND_WISP, count: 20, at: 0, gap: 0.55 }, { kind: KIND_SPLITTER, count: 8, at: 3, gap: 1.4 }, { kind: KIND_SPITTER, count: 8, at: 7, gap: 1.5 }, { kind: KIND_CRAWLER, count: 9, at: 11, gap: 1.2 }],
  8: [{ kind: KIND_WISP, count: 22, at: 0, gap: 0.5 }, { kind: KIND_SPLITTER, count: 9, at: 3, gap: 1.3 }, { kind: KIND_SPITTER, count: 9, at: 6, gap: 1.4 }, { kind: KIND_CRAWLER, count: 10, at: 10, gap: 1.1 }, { kind: KIND_BRUTE, count: 1, at: 18, gap: 0 }],
  9: [{ kind: KIND_WISP, count: 24, at: 0, gap: 0.45 }, { kind: KIND_SPLITTER, count: 10, at: 2, gap: 1.2 }, { kind: KIND_SPITTER, count: 10, at: 5, gap: 1.3 }, { kind: KIND_CRAWLER, count: 12, at: 9, gap: 1.0 }],
  10: [{ kind: KIND_WISP, count: 14, at: 0, gap: 0.6 }, { kind: KIND_KING, count: 1, at: 6, gap: 0 }, { kind: KIND_SPLITTER, count: 8, at: 14, gap: 1.4 }, { kind: KIND_SPITTER, count: 6, at: 18, gap: 1.6 }],
};

// Later waves hit harder: health and speed scale with the wave number.
export function scaledStats(kind, wave) {
  const base = KINDS[kind];
  const hpMul = 1 + (wave - 1) * 0.14;
  const speedMul = 1 + Math.min(0.35, (wave - 1) * 0.03);
  return {
    hp: Math.round(base.hp * hpMul),
    speed: base.speed * speedMul,
    damage: base.damage + Math.floor((wave - 1) / 3),
  };
}
