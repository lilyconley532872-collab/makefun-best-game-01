// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, upgrade, paused, game over and win.
//
// ?seed=N fixes the spawn pattern. ?shot=title|play|upgrade|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_BOSS,
  EVENT_HIT,
  EVENT_KILL,
  EVENT_LANTERN_HIT,
  EVENT_OVER,
  EVENT_PICKUP,
  EVENT_PLAYER_HURT,
  EVENT_UPGRADE,
  EVENT_WAVE_CLEAR,
  EVENT_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_UPGRADE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

// The upgrade cards sit in a row; this is where render.js draws them, so a
// click on one picks that card.
function cardIndexAt(fx, fy) {
  const cards = world.state.offered;
  if (cards.length === 0) return -1;
  const cw = 240;
  const ch = 150;
  const gap = 24;
  const y = 210;
  const total = cards.length * cw + (cards.length - 1) * gap;
  const x0 = (FIELD.width - total) / 2;
  if (fy < y || fy > y + ch) return -1;
  const i = Math.floor((fx - x0) / (cw + gap));
  if (i < 0 || i >= cards.length) return -1;
  if (fx - x0 - i * (cw + gap) > cw) return -1;
  return i;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.resize();
    renderer.draw(world.state, scene.screen, scene.best, {
      world,
      lightRadius: world.lightRadius(),
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let attract = null;
  announce('Lanternkeep. Defend the last light. Press Enter or click to begin.');

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.startWave(1);
    accumulator = 0;
    screen = SCREEN_PLAY;
    attract = null;
    announce(`Playing. Wave 1 of 10. Defend the lantern.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) audio.win();
    else audio.lose();
    announce(won
      ? `Victory. Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function playEvents(events) {
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_PLAYER_HURT) {
      audio.hurt();
      announce(`Hurt. ${Math.ceil(world.state.player.hp)} health left.`);
    }
    if (events & EVENT_LANTERN_HIT) {
      audio.lanternHit();
      announce(`The lantern is hit. ${Math.ceil(world.state.lanternHp)} light left.`);
    }
    if (events & EVENT_BOSS) {
      audio.bossRoar();
      announce(`${world.state.boss ? world.state.boss.kind : 'A boss'} approaches.`);
    }
    if (events & EVENT_WAVE_CLEAR) {
      announce(`Wave ${world.state.wave} clear. Choose a boon.`);
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    renderer.resize();
    const view = renderer.view;
    input.setView(FIELD.width, FIELD.height, view.scale, view.scale, view.ox, view.oy);

    if (input.action(ACTION_MUTE)) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }

    if (screen === SCREEN_TITLE) {
      // The game plays behind the title: an autopilot Keeper holds the
      // lantern while the player reads. A fresh world when it ends.
      if (!attract) {
        world.reset();
        world.startWave(1);
        attract = { t: 0 };
      }
      const controls = attractControls(world.state);
      const events = world.step(STEP, controls);
      if (events & (EVENT_OVER | EVENT_WIN | EVENT_UPGRADE) || world.state.wave > 2) {
        world.reset();
        world.startWave(1);
      }
      if (input.action(ACTION_CONFIRM)) {
        audio.unlock();
        startGame();
      }
    } else if (screen === SCREEN_PLAY) {
      if (input.action(ACTION_PAUSE)) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else {
        accumulator += dt;
        while (accumulator >= STEP) {
          accumulator -= STEP;
          const controls = {
            move: input.move(),
            aim: { x: input.mouse.x, y: input.mouse.y },
            firing: input.firing,
          };
          const events = world.step(STEP, controls);
          playEvents(events);
          if (events & EVENT_UPGRADE) screen = SCREEN_UPGRADE;
          if (screen !== SCREEN_PLAY) break;
        }
      }
    } else if (screen === SCREEN_UPGRADE) {
      const key = input.upgradeKey();
      let pick = key;
      if (pick < 0 && input.mouse.clicked) {
        pick = cardIndexAt(input.mouse.x, input.mouse.y);
      }
      if (pick >= 0 && pick < world.state.offered.length) {
        const card = world.state.offered[pick];
        audio.upgrade();
        world.applyUpgrade(card.id);
        world.startWave(world.state.wave + 1);
        audio.waveHorn();
        announce(`Wave ${world.state.wave} begins.`);
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.action(ACTION_PAUSE)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (input.action(ACTION_RESTART) || input.action(ACTION_CONFIRM)) {
        audio.unlock();
        startGame();
      }
    }

    renderer.draw(world.state, screen, best, {
      world,
      lightRadius: world.lightRadius(),
    });
    input.endFrame();
  }

  // The title screen's autopilot: stand between the lantern and the nearest
  // shade and shoot it. Kept here, not in shots.js, so the live title and
  // the staged title shots steer the same way.
  function attractControls(state) {
    const p = state.player;
    let nearest = null;
    let nearestD = Infinity;
    for (const e of state.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < nearestD) {
        nearestD = d;
        nearest = e;
      }
    }
    if (!nearest) {
      return { move: { x: 0, y: 0 }, aim: { x: 480, y: 200 }, firing: false };
    }
    const a = Math.atan2(nearest.y - 300, nearest.x - 480);
    const tx = 480 + Math.cos(a) * 110;
    const ty = 300 + Math.sin(a) * 110;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      move: len < 12 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len },
      aim: { x: nearest.x, y: nearest.y },
      firing: true,
    };
  }

  world.reset();
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
