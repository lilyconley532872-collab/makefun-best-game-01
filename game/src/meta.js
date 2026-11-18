// Difficulties and the ember bank: the meta-progression that carries
// between runs. Embers a run collects are banked when it ends; the bank
// earns the Keeper a rank, and each rank kindles the lantern a little
// stronger at the start of every later run. Nothing here is bought or
// downloaded: it is all localStorage on the player's own machine.
export const META_KEY = 'lanternkeep.meta';

export const DIFFICULTIES = {
  ember: {
    id: 'ember', name: 'EMBER', label: 'Ember — a gentle night',
    lanternHp: 130, playerHp: 120, hpMul: 0.85, speedMul: 0.9, scoreMul: 0.8,
    desc: 'Lantern 130 · Keeper 120 · weaker shades · score x0.8',
  },
  keeper: {
    id: 'keeper', name: 'KEEPER', label: 'Keeper — the true night',
    lanternHp: 100, playerHp: 100, hpMul: 1, speedMul: 1, scoreMul: 1,
    desc: 'Lantern 100 · Keeper 100 · score x1',
  },
  nightfall: {
    id: 'nightfall', name: 'NIGHTFALL', label: 'Nightfall — no mercy',
    lanternHp: 80, playerHp: 80, hpMul: 1.25, speedMul: 1.1, scoreMul: 1.5,
    desc: 'Lantern 80 · Keeper 80 · stronger shades · score x1.5',
  },
};

export const DIFFICULTY_ORDER = ['ember', 'keeper', 'nightfall'];

/** Banked-ember ranks: the title the bank earns, and the lantern bonus it kindles. */
export const RANKS = [
  { at: 0, title: 'KINDLER', bonus: 0 },
  { at: 100, title: 'WARDEN', bonus: 10 },
  { at: 300, title: 'LANTERNLORD', bonus: 20 },
  { at: 600, title: 'DAWNBRINGER', bonus: 30 },
];

/** The rank a bank has earned: the last rank whose threshold it passed. */
export function rankFor(bank) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (bank >= r.at) rank = r;
  }
  return rank;
}

/** The next rank, or null when the bank already holds the highest. */
export function nextRank(bank) {
  for (const r of RANKS) {
    if (bank < r.at) return r;
  }
  return null;
}

export function loadMeta() {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const bank = parsed && Number.isFinite(parsed.bank) ? Math.max(0, Math.floor(parsed.bank)) : 0;
    return { bank };
  } catch {
    return { bank: 0 };
  }
}

export function saveMeta(meta) {
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify({ bank: Math.max(0, Math.floor(meta.bank || 0)) }));
  } catch {
    // Storage can be off (private windows): the bank then lasts this visit only.
  }
}
