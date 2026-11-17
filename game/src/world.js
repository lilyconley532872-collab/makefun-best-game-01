// The whole game state and its rules: the Keeper, the lantern, the shades,
// bullets, pickups, waves, bosses, upgrades, score and combo. The renderer
// only reads state; main.js only calls reset/step and the wave functions.
// A step returns a bitmask of events so main.js can play sounds and announce.
import { COMBO_WINDOW, EMBER_SCORE, FIELD, LANTERN, PLAYER, WAVE_CLEAR_BONUS, WAVES } from './config.js';
import { KINDS, WAVE_TABLE, scaledStats } from './enemies.js';
import { UPGRADES, drawUpgrades } from './upgrades.js';
import { createParticles } from './particles.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_PLAYER_HURT = 4;
export const EVENT_LANTERN_HIT = 8;
export const EVENT_PICKUP = 16;
export const EVENT_WAVE_CLEAR = 32;
export const EVENT_OVER = 64;
export const EVENT_WIN = 128;
export const EVENT_BOSS = 256;
export const EVENT_UPGRADE = 512;

function baseStats() {
  return {
    damageMul: 1,
    fireInterval: PLAYER.fireInterval,
    moveSpeed: PLAYER.speed,
    projectiles: 1,
    pierce: 0,
    maxHp: PLAYER.maxHp,
    heal: 0,
    lanternHeal: 0,
    magnet: false,
    critChance: 0,
    trail: 0,
    slow: false,
    bulletSpeed: PLAYER.bulletSpeed,
    bulletRange: PLAYER.bulletRange,
  };
}

function edgeSpawn(random) {
  const side = random.int(0, 3);
  const m = 30;
  if (side === 0) return { x: random.range(m, FIELD.width - m), y: -m };
  if (side === 1) return { x: random.range(m, FIELD.width - m), y: FIELD.height + m };
  if (side === 2) return { x: -m, y: random.range(m, FIELD.height - m) };
  return { x: FIELD.width + m, y: random.range(m, FIELD.height - m) };
}

export function createWorld(random) {
  const particles = createParticles();
  const state = {
    player: null,
    lanternHp: LANTERN.maxHp,
    wave: 0,
    waveTime: 0,
    score: 0,
    kills: 0,
    embers: 0,
    combo: 0,
    comboTimer: 0,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    fires: [],
    spawnQueue: [],
    over: false,
    won: false,
    banner: '',
    bannerTimer: 0,
    shake: 0,
    time: 0,
    stats: baseStats(),
    taken: {},
    offered: [],
    boss: null,
  };

  function lightRadius() {
    const f = state.lanternHp / LANTERN.maxHp;
    return LANTERN.lightLow + (LANTERN.lightFull - LANTERN.lightLow) * f;
  }

  function reset() {
    state.player = {
      x: LANTERN.x,
      y: LANTERN.y + 120,
      hp: PLAYER.maxHp,
      aim: -Math.PI / 2,
      fireCooldown: 0,
      invulnerable: 0,
      trailTimer: 0,
    };
    state.lanternHp = LANTERN.maxHp;
    state.wave = 0;
    state.waveTime = 0;
    state.score = 0;
    state.kills = 0;
    state.embers = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.enemies.length = 0;
    state.bullets.length = 0;
    state.enemyBullets.length = 0;
    state.pickups.length = 0;
    state.fires.length = 0;
    state.spawnQueue.length = 0;
    state.over = false;
    state.won = false;
    state.banner = '';
    state.bannerTimer = 0;
    state.shake = 0;
    state.time = 0;
    state.stats = baseStats();
    state.taken = {};
    state.offered = [];
    state.boss = null;
    particles.clear();
  }

  function comboMultiplier() {
    return 1 + Math.min(state.combo, 20) * 0.1;
  }

  function addScore(base, x, y, big) {
    const gained = Math.round(base * comboMultiplier());
    state.score += gained;
    if (x !== undefined) particles.floatText(x, y, `+${gained}`, '#ffd76b', big);
    return gained;
  }

  function spawnEnemy(kind) {
    const def = KINDS[kind];
    const scaled = scaledStats(kind, state.wave);
    const pos = edgeSpawn(random);
    const enemy = {
      kind,
      x: pos.x,
      y: pos.y,
      hp: scaled.hp,
      maxHp: scaled.hp,
      radius: def.radius,
      speed: scaled.speed,
      damage: scaled.damage,
      score: def.score,
      slowUntil: 0,
      shotCooldown: random.range(1, 2),
      feedCooldown: 0,
      chargeTimer: random.range(3, 5),
      charging: 0,
      summonTimer: 5,
      burstTimer: 7,
      flash: 0,
      wobble: random.range(0, Math.PI * 2),
    };
    state.enemies.push(enemy);
    if (def.boss) {
      state.boss = enemy;
      state.banner = def.name.toUpperCase();
      state.bannerTimer = 2.2;
    }
    return enemy;
  }

  function startWave(n) {
    state.wave = n;
    state.waveTime = 0;
    state.cleared = false;
    state.spawnQueue = [];
    for (const group of WAVE_TABLE[n] || []) {
      for (let i = 0; i < group.count; i += 1) {
        state.spawnQueue.push({ kind: group.kind, at: group.at + i * group.gap });
      }
    }
    state.spawnQueue.sort((a, b) => a.at - b.at);
    state.banner = `WAVE ${n} / ${WAVES}`;
    state.bannerTimer = 2;
    if (n === 1) state.banner = 'WAVE 1 — THE DARK STIRS';
  }

  function offerUpgrades() {
    state.offered = drawUpgrades(state.taken, random);
    return EVENT_UPGRADE;
  }

  function applyUpgrade(id) {
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade || !state.offered.includes(upgrade)) return false;
    upgrade.apply(state.stats);
    state.taken[id] = (state.taken[id] || 0) + 1;
    if (state.stats.heal) {
      state.player.hp = Math.min(state.stats.maxHp, state.player.hp + state.stats.heal);
      state.stats.heal = 0;
    }
    if (state.stats.lanternHeal) {
      state.lanternHp = Math.min(LANTERN.maxHp, state.lanternHp + state.stats.lanternHeal);
      state.stats.lanternHeal = 0;
    }
    state.offered = [];
    particles.ring(state.player.x, state.player.y, '#ffd76b', 24, 160);
    return true;
  }

  function fireBullet() {
    const p = state.player;
    const s = state.stats;
    const count = s.projectiles;
    const spread = 0.14;
    for (let i = 0; i < count; i += 1) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const angle = p.aim + offset;
      state.bullets.push({
        x: p.x + Math.cos(angle) * (PLAYER.radius + 6),
        y: p.y + Math.sin(angle) * (PLAYER.radius + 6),
        vx: Math.cos(angle) * s.bulletSpeed,
        vy: Math.sin(angle) * s.bulletSpeed,
        damage: PLAYER.bulletDamage * s.damageMul,
        pierce: s.pierce,
        range: s.bulletRange,
        travelled: 0,
        crit: random.chance(s.critChance),
        slow: s.slow,
        radius: PLAYER.bulletRadius,
      });
    }
    p.fireCooldown = s.fireInterval;
    particles.burst(p.x + Math.cos(p.aim) * 18, p.y + Math.sin(p.aim) * 18, '#ffb347', 3, 90, 0.18, 2.5);
  }

  function dropPickup(enemy) {
    const def = KINDS[enemy.kind];
    if (random.chance(def.emberChance)) {
      state.pickups.push({
        kind: 'ember', x: enemy.x, y: enemy.y,
        vx: random.range(-30, 30), vy: random.range(-30, 30),
        value: EMBER_SCORE, life: 9, radius: 8,
      });
    }
    if (random.chance(0.06)) {
      state.pickups.push({
        kind: 'heart', x: enemy.x, y: enemy.y,
        vx: random.range(-20, 20), vy: random.range(-20, 20),
        value: 20, life: 9, radius: 10,
      });
    }
  }

  function killEnemy(index, award) {
    const enemy = state.enemies[index];
    const def = KINDS[enemy.kind];
    state.enemies.splice(index, 1);
    particles.burst(enemy.x, enemy.y, def.color, enemy.radius > 25 ? 26 : 12, 170, 0.5, 3.5);
    particles.ring(enemy.x, enemy.y, def.color, 10, 120);
    if (enemy === state.boss) state.boss = null;
    if (award) {
      state.kills += 1;
      state.combo += 1;
      state.comboTimer = COMBO_WINDOW;
      addScore(def.score, enemy.x, enemy.y, def.boss);
      dropPickup(enemy);
      if (def.splits) {
        for (let i = 0; i < def.splits; i += 1) {
          const wisp = spawnEnemy('wisp');
          wisp.x = enemy.x + random.range(-16, 16);
          wisp.y = enemy.y + random.range(-16, 16);
        }
      }
    }
    return EVENT_KILL;
  }

  function hurtPlayer(damage) {
    const p = state.player;
    if (p.invulnerable > 0 || state.over) return 0;
    p.hp -= damage;
    p.invulnerable = PLAYER.invulnerableSeconds;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = Math.max(state.shake, 7);
    particles.burst(p.x, p.y, '#ff5b6b', 14, 190, 0.45, 3);
    if (p.hp <= 0) {
      p.hp = 0;
      state.over = true;
      particles.burst(p.x, p.y, '#ffd76b', 40, 260, 0.9, 4);
      return EVENT_PLAYER_HURT | EVENT_OVER;
    }
    return EVENT_PLAYER_HURT;
  }

  function hurtLantern(damage, x, y) {
    if (state.over) return 0;
    state.lanternHp -= damage;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = Math.max(state.shake, 5);
    particles.burst(x, y, '#7fd4ff', 12, 150, 0.4, 3);
    particles.floatText(LANTERN.x, LANTERN.y - 40, `-${damage}`, '#7fd4ff', false);
    if (state.lanternHp <= 0) {
      state.lanternHp = 0;
      state.over = true;
      particles.burst(LANTERN.x, LANTERN.y, '#7fd4ff', 60, 320, 1.1, 4);
      return EVENT_LANTERN_HIT | EVENT_OVER;
    }
    return EVENT_LANTERN_HIT;
  }

  function step(dt, controls) {
    if (state.over) {
      particles.step(dt);
      return state.won ? EVENT_WIN : EVENT_OVER;
    }
    let events = 0;
    state.time += dt;
    state.waveTime += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    const p = state.player;
    const s = state.stats;
    if (p.invulnerable > 0) p.invulnerable -= dt;
    if (p.fireCooldown > 0) p.fireCooldown -= dt;

    // Spawn the wave's queue.
    while (state.spawnQueue.length > 0 && state.spawnQueue[0].at <= state.waveTime) {
      const next = state.spawnQueue.shift();
      spawnEnemy(next.kind);
      if (KINDS[next.kind].boss) events |= EVENT_BOSS;
    }

    // Move the Keeper and aim.
    const mv = controls.move;
    p.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, p.x + mv.x * s.moveSpeed * dt));
    p.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, p.y + mv.y * s.moveSpeed * dt));
    p.aim = Math.atan2(controls.aim.y - p.y, controls.aim.x - p.x);
    if (controls.firing && p.fireCooldown <= 0) fireBullet();

    // Flame trail.
    if (s.trail > 0) {
      p.trailTimer -= dt;
      if ((mv.x !== 0 || mv.y !== 0) && p.trailTimer <= 0) {
        p.trailTimer = 0.12;
        state.fires.push({ x: p.x, y: p.y, life: 1.5, radius: 22, dps: 10 * s.trail });
      }
    }
    for (let i = state.fires.length - 1; i >= 0; i -= 1) {
      const f = state.fires[i];
      f.life -= dt;
      if (f.life <= 0) {
        state.fires.splice(i, 1);
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        const d = Math.hypot(e.x - f.x, e.y - f.y);
        if (d < f.radius + e.radius) {
          e.hp -= f.dps * dt;
          if (e.hp <= 0) events |= killEnemy(j, true);
        }
      }
    }

    // Bullets fly, hit shades and enemy globs.
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.travelled += Math.hypot(b.vx, b.vy) * dt;
      let dead = b.travelled >= b.range
        || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20;
      if (!dead) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const e = state.enemies[j];
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < e.radius + b.radius) {
            const inLight = Math.hypot(e.x - LANTERN.x, e.y - LANTERN.y) < lightRadius();
            let damage = b.damage * (inLight ? 1.5 : 1) * (b.crit ? 2 : 1);
            e.hp -= damage;
            e.flash = 0.08;
            if (b.slow) e.slowUntil = state.time + 1;
            particles.floatText(e.x, e.y - e.radius - 6, String(Math.round(damage)), b.crit ? '#ffe066' : '#fff', b.crit);
            particles.burst(b.x, b.y, '#ffb347', 4, 110, 0.22, 2.5);
            events |= EVENT_HIT;
            if (e.hp <= 0) events |= killEnemy(j, true);
            if (b.pierce > 0) {
              b.pierce -= 1;
            } else {
              dead = true;
            }
            break;
          }
        }
      }
      if (!dead) {
        for (let j = state.enemyBullets.length - 1; j >= 0; j -= 1) {
          const g = state.enemyBullets[j];
          if (Math.hypot(g.x - b.x, g.y - b.y) < g.radius + b.radius) {
            state.enemyBullets.splice(j, 1);
            particles.burst(g.x, g.y, '#e07b54', 5, 100, 0.25, 2.5);
            dead = true;
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }

    // Shades move: toward the lantern, or the Keeper if he is closer and near.
    const lightR = lightRadius();
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      const def = KINDS[e.kind];
      if (e.flash > 0) e.flash -= dt;
      if (e.feedCooldown > 0) e.feedCooldown -= dt;
      const dLantern = Math.hypot(LANTERN.x - e.x, LANTERN.y - e.y);
      const dPlayer = Math.hypot(p.x - e.x, p.y - e.y);
      const slowed = state.time < e.slowUntil;
      let speed = e.speed * (slowed ? 0.7 : 1);
      // Boss charge: the brute telegraphs, then rushes the Keeper.
      if (e.kind === 'brute') {
        e.chargeTimer -= dt;
        if (e.charging > 0) {
          e.charging -= dt;
          speed *= 3;
        } else if (e.chargeTimer <= 0 && dPlayer < 320) {
          e.charging = 0.6;
          e.chargeTimer = 4;
        }
      }
      // The Hollow King summons wisps and fires radial bursts; enraged below half.
      if (e.kind === 'king') {
        const enraged = e.hp < e.maxHp / 2;
        e.summonTimer -= dt;
        e.burstTimer -= dt * (enraged ? 1.4 : 1);
        if (e.summonTimer <= 0) {
          e.summonTimer = 5;
          let alive = 0;
          for (const other of state.enemies) if (other.kind === 'wisp') alive += 1;
          for (let k = 0; k < 3 && alive < 12; k += 1, alive += 1) {
            const w = spawnEnemy('wisp');
            w.x = e.x + random.range(-50, 50);
            w.y = e.y + random.range(-50, 50);
          }
          particles.ring(e.x, e.y, '#e0c06b', 18, 140);
        }
        if (e.burstTimer <= 0) {
          e.burstTimer = enraged ? 5 : 7;
          const n = 10;
          for (let k = 0; k < n; k += 1) {
            const a = (k / n) * Math.PI * 2 + state.time;
            state.enemyBullets.push({
              x: e.x, y: e.y,
              vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
              damage: 10, radius: 7, life: 4,
            });
          }
          particles.ring(e.x, e.y, '#e0c06b', 20, 200);
        }
        if (enraged) speed *= 1.4;
      }
      // Spitters hold their range and lob globs at the lantern.
      if (def.ranged && dLantern < def.range && e.feedCooldown <= 0) {
        e.shotCooldown -= dt;
        if (e.shotCooldown <= 0) {
          e.shotCooldown = def.shotInterval;
          const a = Math.atan2(LANTERN.y - e.y, LANTERN.x - e.x);
          state.enemyBullets.push({
            x: e.x, y: e.y,
            vx: Math.cos(a) * 190, vy: Math.sin(a) * 190,
            damage: 6, radius: 7, life: 3,
          });
        }
      } else {
        // Chase the lantern, but turn on the Keeper when he is close.
        const target = dPlayer < 90 ? p : LANTERN;
        const a = Math.atan2(target.y - e.y, target.x - e.x);
        const wob = Math.sin(state.time * 2 + e.wobble) * 0.25;
        e.x += Math.cos(a + wob) * speed * dt;
        e.y += Math.sin(a + wob) * speed * dt;
      }
      // Touching the Keeper hurts him.
      if (dPlayer < e.radius + PLAYER.radius && p.invulnerable <= 0) {
        events |= hurtPlayer(e.damage);
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        e.x -= Math.cos(a) * 18;
        e.y -= Math.sin(a) * 18;
        if (state.over) return events;
      }
      // Touching the lantern drains it; the shade is consumed by the light,
      // bosses feed and back away instead.
      if (dLantern < e.radius + LANTERN.radius && e.feedCooldown <= 0) {
        if (def.boss) {
          events |= hurtLantern(e.damage, e.x, e.y);
          e.feedCooldown = 3;
          const a = Math.atan2(e.y - LANTERN.y, e.x - LANTERN.x);
          e.x += Math.cos(a) * 60;
          e.y += Math.sin(a) * 60;
        } else {
          events |= hurtLantern(e.damage, e.x, e.y);
          events |= killEnemy(i, false);
        }
        if (state.over) return events;
      }
    }

    // Enemy globs fly and can hit the Keeper or the lantern.
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const g = state.enemyBullets[i];
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.life -= dt;
      let dead = g.life <= 0 || g.x < -20 || g.x > FIELD.width + 20 || g.y < -20 || g.y > FIELD.height + 20;
      if (!dead && Math.hypot(p.x - g.x, p.y - g.y) < PLAYER.radius + g.radius) {
        events |= hurtPlayer(g.damage);
        dead = true;
        if (state.over) return events;
      }
      if (!dead && Math.hypot(LANTERN.x - g.x, LANTERN.y - g.y) < LANTERN.radius + g.radius) {
        events |= hurtLantern(4, g.x, g.y);
        dead = true;
        if (state.over) return events;
      }
      if (dead) state.enemyBullets.splice(i, 1);
    }

    // Pickups drift, wait, and get collected.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      pk.life -= dt;
      if (pk.life <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      const d = Math.hypot(p.x - pk.x, p.y - pk.y);
      const magnetRange = s.magnet ? 240 : 0;
      if (d < magnetRange || d < PLAYER.radius + pk.radius) {
        if (d < magnetRange && d >= PLAYER.radius + pk.radius) {
          const a = Math.atan2(p.y - pk.y, p.x - pk.x);
          pk.x += Math.cos(a) * 320 * dt;
          pk.y += Math.sin(a) * 320 * dt;
          continue;
        }
        if (pk.kind === 'ember') {
          state.embers += 1;
          addScore(pk.value, pk.x, pk.y, false);
        } else {
          p.hp = Math.min(s.maxHp, p.hp + pk.value);
          particles.floatText(pk.x, pk.y, `+${pk.value} HP`, '#7dff9b', false);
        }
        particles.burst(pk.x, pk.y, pk.kind === 'ember' ? '#ffd76b' : '#7dff9b', 8, 120, 0.35, 2.5);
        state.pickups.splice(i, 1);
        events |= EVENT_PICKUP;
        continue;
      }
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      pk.vx *= 0.96;
      pk.vy *= 0.96;
    }

    particles.step(dt);

    // The wave is clear when nothing is left to spawn and nothing is alive.
    // Fires once per wave: the flag stops the bonus and the upgrade offer
    // repeating on every step until the next wave starts.
    if (state.spawnQueue.length === 0 && state.enemies.length === 0 && !state.over && !state.cleared) {
      state.cleared = true;
      state.score += WAVE_CLEAR_BONUS * state.wave;
      if (state.wave >= WAVES) {
        state.won = true;
        state.over = true;
        return events | EVENT_WIN;
      }
      return events | EVENT_WAVE_CLEAR | offerUpgrades();
    }
    return events;
  }

  return {
    state,
    particles,
    reset,
    startWave,
    applyUpgrade,
    lightRadius,
    comboMultiplier,
    step,
  };
}
