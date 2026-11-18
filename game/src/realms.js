// The three realms of the night. One glade, three faces of the dark: the
// Keeper defends the same lantern through all three, but each realm has its
// own palette, its own shades and its own boss. The realm changes at wave 4
// and wave 7, so the run visibly transforms as it deepens.
export const REALMS = [
  {
    id: 'glade',
    num: 1,
    name: 'THE EMBER GLADE',
    subtitle: 'Waves 1–3 — the dark stirs',
    bg: ['#171a2c', '#0e1120', '#07080d'],
    star: '#ffffff',
    tuft: 'rgba(90, 110, 90, 0.35)',
    stone: 'rgba(120, 130, 160, 0.28)',
    dark: 0.62,
    glow: 'rgba(255, 215, 107, 0.85)',
  },
  {
    id: 'mire',
    num: 2,
    name: 'THE SUNKEN MIRE',
    subtitle: 'Waves 4–6 — the water remembers',
    bg: ['#0d2027', '#0a161b', '#050a0c'],
    star: '#bfe8ff',
    tuft: 'rgba(70, 140, 130, 0.4)',
    stone: 'rgba(90, 150, 160, 0.3)',
    dark: 0.66,
    glow: 'rgba(140, 230, 200, 0.8)',
  },
  {
    id: 'deep',
    num: 3,
    name: 'THE HOLLOW DEEP',
    subtitle: 'Waves 7–10 — where the King waits',
    bg: ['#1e1129', '#130a1e', '#08050d'],
    star: '#e8c8ff',
    tuft: 'rgba(140, 90, 160, 0.35)',
    stone: 'rgba(150, 110, 180, 0.3)',
    dark: 0.68,
    glow: 'rgba(200, 150, 255, 0.8)',
  },
];

/** The realm a wave belongs to: 1–3 the Glade, 4–6 the Mire, 7+ the Deep. */
export function realmForWave(wave) {
  if (wave <= 3) return REALMS[0];
  if (wave <= 6) return REALMS[1];
  return REALMS[2];
}
