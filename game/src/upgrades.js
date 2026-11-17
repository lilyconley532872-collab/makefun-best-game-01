// The draft between waves: three cards, pick one. Each upgrade changes how
// the Keeper fights, so every run plays differently. `max` caps the stacks;
// `apply` mutates the player's stats object.
export const UPGRADES = [
  {
    id: 'damage', name: 'Ember Rounds', max: 5,
    desc: '+25% bullet damage',
    apply(s) { s.damageMul *= 1.25; },
  },
  {
    id: 'rate', name: 'Rapid Wick', max: 5,
    desc: '+20% fire rate',
    apply(s) { s.fireInterval *= 0.83; },
  },
  {
    id: 'speed', name: 'Swift Boots', max: 4,
    desc: '+15% move speed',
    apply(s) { s.moveSpeed *= 1.15; },
  },
  {
    id: 'multishot', name: 'Twin Flame', max: 3,
    desc: '+1 bullet per shot',
    apply(s) { s.projectiles += 1; },
  },
  {
    id: 'pierce', name: 'Piercing Light', max: 3,
    desc: 'Bolts pierce +1 enemy',
    apply(s) { s.pierce += 1; },
  },
  {
    id: 'heart', name: "Warden's Heart", max: 4,
    desc: '+25 max health, heal 25',
    apply(s) { s.maxHp += 25; s.heal = (s.heal || 0) + 25; },
  },
  {
    id: 'mend', name: 'Lantern Mend', max: 5,
    desc: 'Repair the lantern +30',
    apply(s) { s.lanternHeal = (s.lanternHeal || 0) + 30; },
  },
  {
    id: 'magnet', name: 'Ember Magnet', max: 2,
    desc: 'Embers and hearts fly to you',
    apply(s) { s.magnet = true; },
  },
  {
    id: 'crit', name: 'Critical Spark', max: 5,
    desc: '+10% critical chance (crits deal double)',
    apply(s) { s.critChance += 0.1; },
  },
  {
    id: 'trail', name: 'Flame Trail', max: 3,
    desc: 'Leave a burning trail that hurts shades',
    apply(s) { s.trail = (s.trail || 0) + 1; },
  },
  {
    id: 'frost', name: 'Frost Lantern', max: 3,
    desc: 'Bolts slow shades 30% for 1 second',
    apply(s) { s.slow = true; },
  },
  {
    id: 'range', name: 'Long Wick', max: 3,
    desc: '+25% bullet speed and range',
    apply(s) { s.bulletSpeed *= 1.25; s.bulletRange *= 1.25; },
  },
];

// Draw three distinct upgrades the player has not maxed out yet.
export function drawUpgrades(taken, random) {
  const pool = UPGRADES.filter((u) => (taken[u.id] || 0) < u.max);
  const picks = [];
  const bag = pool.slice();
  while (picks.length < 3 && bag.length > 0) {
    const i = Math.floor(random.next() * bag.length);
    picks.push(bag.splice(i, 1)[0]);
  }
  return picks;
}
