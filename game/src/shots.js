// The screenshot scenes behind ?shot=title|play|upgrade|end. Each one plays
// the real rules forward from a fresh world for a fixed time, steered by a
// simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame.
import { LANTERN, STEP } from './config.js';
import { EVENT_OVER, EVENT_UPGRADE, EVENT_WIN } from './world.js';
import { UPGRADES } from './upgrades.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';

const TITLE_SECONDS = 5;
const PLAY_SECONDS = 34;
const LIMIT_SECONDS = 600;

/** The autopilot's controls for one step. Good play guards the lantern: it
 * shoots the shade closest to the lantern and stands between the two, so
 * the light is defended and the Keeper is rarely caught out. Bad play
 * flees the lantern and aims wide, so the light is drained and the game
 * is lost. */
function autopilot(state, good) {
  const p = state.player;
  let nearest = null;
  let nearestD = Infinity;
  for (const e of state.enemies) {
    // Good play hunts the shade nearest the lantern; bad play the one
    // nearest the Keeper, which it then runs away from.
    const d = good
      ? Math.hypot(e.x - LANTERN.x, e.y - LANTERN.y)
      : Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = e;
    }
  }
  if (!nearest) {
    return { move: { x: 0, y: 0 }, aim: { x: LANTERN.x, y: LANTERN.y - 100 }, firing: false };
  }
  const aimErr = good ? 0 : 0.5;
  const aim = {
    x: nearest.x + Math.cos(aimErr) * 10,
    y: nearest.y + Math.sin(aimErr) * 10,
  };
  let move;
  if (good) {
    // Self-preservation first: a shade on top of the Keeper is shot while
    // the Keeper kites away from it. Otherwise guard the lantern: stand
    // between the light and the shade nearest it, and shoot that shade.
    let threat = null;
    let threatD = 80;
    for (const e of state.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < threatD) {
        threatD = d;
        threat = e;
      }
    }
    if (threat) {
      const a = Math.atan2(p.y - threat.y, p.x - threat.x);
      return { move: { x: Math.cos(a), y: Math.sin(a) }, aim: { x: threat.x, y: threat.y }, firing: true };
    }
    const a = Math.atan2(nearest.y - LANTERN.y, nearest.x - LANTERN.x);
    const tx = LANTERN.x + Math.cos(a) * 110;
    const ty = LANTERN.y + Math.sin(a) * 110;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const len = Math.hypot(dx, dy) || 1;
    move = len < 12 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
  } else {
    // Flee outward, away from the lantern.
    const a = Math.atan2(p.y - LANTERN.y, p.x - LANTERN.x);
    move = { x: Math.cos(a), y: Math.sin(a) };
  }
  return { move, aim, firing: true };
}

function drive(world, seconds, good) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, autopilot(world.state, good));
    if (events & EVENT_UPGRADE) {
      world.applyUpgrade(world.state.offered[0].id);
      world.startWave(world.state.wave + 1);
    }
    if (events & (EVENT_OVER | EVENT_WIN)) return events;
  }
  return 0;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * title: a few seconds of play behind the title. play: mid-combat.
 * upgrade: the first wave cleared, cards on the table. boss: the wave 5
 * Gloombrute fight, the game's first boss. end: played badly until the
 * light goes out (or the Keeper falls).
 */
export function stageShot(name, world) {
  world.reset();
  world.startWave(1);
  if (name === 'title') {
    drive(world, TITLE_SECONDS, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    drive(world, PLAY_SECONDS, true);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    // A well-drafted run: three boons already taken, as a player who
    // drafted well would carry into the boss wave. Then good play through
    // the waves until the Gloombrute is on the field, and a few seconds
    // of the fight itself.
    for (const id of ['damage', 'rate', 'multishot']) {
      const up = UPGRADES.find((u) => u.id === id);
      up.apply(world.state.stats);
      world.state.taken[id] = 1;
    }
    const steps = Math.floor(LIMIT_SECONDS / STEP);
    let bossSeenAt = -1;
    for (let i = 0; i < steps; i += 1) {
      const events = world.step(STEP, autopilot(world.state, true));
      if (events & EVENT_UPGRADE) {
        world.applyUpgrade(world.state.offered[0].id);
        world.startWave(world.state.wave + 1);
      }
      if (world.state.wave === 5) {
        // The brute spawns at waveTime 6, at an edge. Wait until it has
        // walked fully on screen, so the frame shows the boss and not a
        // half-clipped spawn — but never wait long: the Keeper can kill
        // it, and the frame must stay on wave 5 either way.
        if (world.state.boss && bossSeenAt < 0) bossSeenAt = world.state.waveTime;
        const b = world.state.boss;
        const onScreen = b && b.x > 60 && b.x < 900 && b.y > 60 && b.y < 540;
        const waitedOut = bossSeenAt >= 0 && world.state.waveTime - bossSeenAt > 6;
        if ((onScreen && world.state.waveTime > 5) || waitedOut || (bossSeenAt >= 0 && !b)) {
          return { screen: SCREEN_PLAY, best: world.state.score };
        }
      }
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'upgrade') {
    const steps = Math.floor(LIMIT_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      const events = world.step(STEP, autopilot(world.state, true));
      if (events & EVENT_UPGRADE) return { screen: SCREEN_UPGRADE, best: world.state.score };
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    return { screen: SCREEN_UPGRADE, best: world.state.score };
  }
  // end: bad play until the game ends.
  const steps = Math.floor(LIMIT_SECONDS / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, autopilot(world.state, false));
    if (events & EVENT_UPGRADE) {
      world.applyUpgrade(world.state.offered[0].id);
      world.startWave(world.state.wave + 1);
    }
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    if (events & EVENT_OVER) return { screen: SCREEN_OVER, best: world.state.score };
  }
  return { screen: SCREEN_OVER, best: world.state.score };
}
