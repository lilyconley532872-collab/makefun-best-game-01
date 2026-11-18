// Everything the player sees: the dark glade, the lantern's light, the
// shades, the Keeper, the HUD and every screen. The world only hands it
// state; this file owns all the drawing. Each realm paints its own night:
// the Glade is warm dark, the Mire is cold teal, the Deep is violet.
import { FIELD, LANTERN, PLAYER, WAVES } from './config.js';
import { KINDS } from './enemies.js';
import { UPGRADES } from './upgrades.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, nextRank, rankFor } from './meta.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

// The difficulty rows on the title screen, and the Endless Night button on
// the win screen: main.js reads clicks against these same rectangles.
export const DIFFICULTY_ROWS = { x: 270, y: 440, w: 420, h: 20, gap: 2 };
export const ENDLESS_BUTTON = { x: 350, y: 380, w: 260, h: 44 };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dark = document.createElement('canvas');
  dark.width = FIELD.width;
  dark.height = FIELD.height;
  const dctx = dark.getContext('2d');

  // Stars and grass, placed once so the glade never shimmers between frames.
  const stars = [];
  let s = 1234567;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: rnd() * FIELD.width, y: rnd() * FIELD.height, r: 0.6 + rnd() * 1.4, a: 0.25 + rnd() * 0.55 });
  }
  const tufts = [];
  for (let i = 0; i < 46; i += 1) {
    tufts.push({ x: rnd() * FIELD.width, y: rnd() * FIELD.height, h: 6 + rnd() * 8 });
  }

  let view = { scale: 1, ox: 0, oy: 0 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view = { scale, ox: (canvas.width - FIELD.width * scale) / 2, oy: (canvas.height - FIELD.height * scale) / 2 };
  }

  // A hex colour with an alpha, for the per-realm dark overlay.
  function hexA(hex, a) {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function frame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#07080d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  }

  function drawBackground(time, realm) {
    const g = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, 40,
      FIELD.width / 2, FIELD.height / 2, 620,
    );
    g.addColorStop(0, realm.bg[0]);
    g.addColorStop(0.6, realm.bg[1]);
    g.addColorStop(1, realm.bg[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = realm.star;
    for (const st of stars) {
      ctx.globalAlpha = st.a * (0.7 + 0.3 * Math.sin(time * 0.8 + st.x));
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = realm.tuft;
    ctx.lineWidth = 1.5;
    for (const t of tufts) {
      ctx.beginPath();
      ctx.moveTo(t.x - 3, t.y);
      ctx.lineTo(t.x - 1, t.y - t.h);
      ctx.moveTo(t.x + 3, t.y);
      ctx.lineTo(t.x + 1, t.y - t.h);
      ctx.stroke();
    }
    // Faint standing stones ring the glade.
    ctx.fillStyle = realm.stone;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const x = FIELD.width / 2 + Math.cos(a) * 420;
      const y = FIELD.height / 2 + Math.sin(a) * 250;
      ctx.beginPath();
      ctx.ellipse(x, y, 9, 16, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLantern(state, time, realm) {
    const hpFrac = state.lanternHp / state.lanternMaxHp;
    const flicker = 1 + Math.sin(time * 7) * 0.04 + Math.sin(time * 13.7) * 0.03;
    const r = LANTERN.radius * flicker;
    const glow = ctx.createRadialGradient(LANTERN.x, LANTERN.y, 4, LANTERN.x, LANTERN.y, 90 * flicker);
    glow.addColorStop(0, realm.glow);
    glow.addColorStop(0.35, 'rgba(255, 170, 60, 0.28)');
    glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(LANTERN.x, LANTERN.y, 90 * flicker, 0, Math.PI * 2);
    ctx.fill();
    // Post and cage.
    ctx.strokeStyle = '#3a2f22';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(LANTERN.x, LANTERN.y + 8);
    ctx.lineTo(LANTERN.x, LANTERN.y + 26);
    ctx.stroke();
    ctx.fillStyle = '#241d14';
    ctx.beginPath();
    ctx.arc(LANTERN.x, LANTERN.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hpFrac > 0.3 ? '#ffd76b' : '#ff7b6b';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = `rgba(255, ${Math.round(190 + 40 * hpFrac)}, 90, 0.95)`;
    ctx.beginPath();
    ctx.arc(LANTERN.x, LANTERN.y, r * 0.55 * flicker, 0, Math.PI * 2);
    ctx.fill();
    // Lantern health ring.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(LANTERN.x, LANTERN.y, r + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = hpFrac > 0.3 ? '#ffd76b' : '#ff5b6b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(LANTERN.x, LANTERN.y, r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpFrac);
    ctx.stroke();
  }

  function drawEnemy(e, time) {
    const def = KINDS[e.kind];
    const flash = e.flash > 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    const bob = Math.sin(time * 3 + e.wobble) * 2;
    ctx.translate(0, bob);
    // Shadow body.
    ctx.fillStyle = flash ? '#ffffff' : def.color;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    if (e.kind === 'crawler') {
      ctx.ellipse(0, 0, e.radius, e.radius * 0.75, 0, 0, Math.PI * 2);
    } else if (e.kind === 'mirelurker') {
      // A darting diamond.
      ctx.moveTo(0, -e.radius);
      ctx.lineTo(e.radius, 0);
      ctx.lineTo(0, e.radius);
      ctx.lineTo(-e.radius, 0);
      ctx.closePath();
    } else if (e.kind === 'wight') {
      // An armoured square.
      ctx.rect(-e.radius * 0.85, -e.radius * 0.85, e.radius * 1.7, e.radius * 1.7);
    } else if (e.kind === 'brute' || e.kind === 'king' || e.kind === 'queen') {
      ctx.moveTo(0, -e.radius);
      ctx.lineTo(e.radius * 0.85, e.radius * 0.6);
      ctx.lineTo(-e.radius * 0.85, e.radius * 0.6);
      ctx.closePath();
    } else {
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    // The Mire Queen wears a crown of thorns.
    if (e.kind === 'queen') {
      ctx.fillStyle = '#d8fff2';
      for (let k = -1; k <= 1; k += 1) {
        ctx.beginPath();
        ctx.moveTo(k * e.radius * 0.45 - 5, -e.radius * 0.7);
        ctx.lineTo(k * e.radius * 0.45, -e.radius * 1.25);
        ctx.lineTo(k * e.radius * 0.45 + 5, -e.radius * 0.7);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Glowing eyes, always facing the lantern.
    const a = Math.atan2(LANTERN.y - e.y, LANTERN.x - e.x);
    const ex = Math.cos(a) * e.radius * 0.35;
    const ey = Math.sin(a) * e.radius * 0.35;
    ctx.fillStyle = def.eye;
    ctx.beginPath();
    ctx.arc(ex - e.radius * 0.22, ey - e.radius * 0.12, Math.max(2, e.radius * 0.14), 0, Math.PI * 2);
    ctx.arc(ex + e.radius * 0.22, ey - e.radius * 0.12, Math.max(2, e.radius * 0.14), 0, Math.PI * 2);
    ctx.fill();
    if (def.boss) {
      ctx.strokeStyle = 'rgba(255, 215, 107, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 6 + Math.sin(time * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Health bar for hurt or big enemies.
    if ((e.hp < e.maxHp && e.maxHp > 60) || def.boss) {
      const w = e.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(-w / 2, -e.radius - 12, w, 5);
      ctx.fillStyle = '#ff5b6b';
      ctx.fillRect(-w / 2, -e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 5);
    }
    ctx.restore();
    // Boss name above the brute and the king.
    if (def.boss) {
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(def.name, e.x, e.y - e.radius - 20);
    }
  }

  function drawPlayer(p, time) {
    ctx.save();
    ctx.translate(p.x, p.y);
    // Little light around the Keeper so he is never lost in the dark.
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 70);
    glow.addColorStop(0, 'rgba(255, 200, 100, 0.22)');
    glow.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fill();
    const blink = p.invulnerable > 0 && Math.floor(time * 14) % 2 === 0;
    ctx.globalAlpha = blink ? 0.4 : 1;
    // Hooded cloak.
    ctx.fillStyle = '#2e6f6a';
    ctx.beginPath();
    ctx.moveTo(0, -PLAYER.radius - 2);
    ctx.lineTo(PLAYER.radius, PLAYER.radius);
    ctx.lineTo(-PLAYER.radius, PLAYER.radius);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2e8d5';
    ctx.beginPath();
    ctx.arc(0, -3, 7, 0, Math.PI * 2);
    ctx.fill();
    // The flame gun, pointing where the mouse is.
    ctx.rotate(p.aim);
    ctx.strokeStyle = '#c98a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(22, 0, 4 + Math.sin(time * 20) * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDarkness(state, realm) {
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, FIELD.width, FIELD.height);
    dctx.fillStyle = hexA(realm.bg[1], realm.dark);
    dctx.fillRect(0, 0, FIELD.width, FIELD.height);
    dctx.globalCompositeOperation = 'destination-out';
    const lightR = state ? state.lightRadius : LANTERN.lightFull;
    const hole = dctx.createRadialGradient(LANTERN.x, LANTERN.y, 10, LANTERN.x, LANTERN.y, lightR);
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(0.75, 'rgba(0,0,0,0.85)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = hole;
    dctx.beginPath();
    dctx.arc(LANTERN.x, LANTERN.y, lightR, 0, Math.PI * 2);
    dctx.fill();
    if (state && state.player) {
      const ph = dctx.createRadialGradient(state.player.x, state.player.y, 6, state.player.x, state.player.y, 130);
      ph.addColorStop(0, 'rgba(0,0,0,0.9)');
      ph.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = ph;
      dctx.beginPath();
      dctx.arc(state.player.x, state.player.y, 130, 0, Math.PI * 2);
      dctx.fill();
    }
    ctx.drawImage(dark, 0, 0);
  }

  function bar(x, y, w, h, frac, color, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    if (label) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 5, y + h - 4);
    }
  }

  function drawHud(world, best, extras) {
    const s = world.state;
    const p = s.player;
    const realm = extras.realm;
    ctx.textAlign = 'left';
    bar(12, 10, 220, 16, s.lanternHp / s.lanternMaxHp, s.lanternHp > 30 ? '#ffd76b' : '#ff5b6b', `LANTERN ${Math.ceil(s.lanternHp)}`);
    bar(12, 30, 220, 16, p.hp / s.stats.maxHp, p.hp > 30 ? '#7dff9b' : '#ff5b6b', `KEEPER ${Math.ceil(p.hp)}`);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(s.endless ? `ENDLESS WAVE ${s.wave}` : `WAVE ${Math.max(1, s.wave)} / ${WAVES}`, 12, 68);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`SCORE ${s.score}`, 12, 90);
    if (s.combo > 1) {
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`COMBO x${(1 + Math.min(s.combo, 20) * 0.1).toFixed(1)}  (${s.combo})`, 12, 112);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px sans-serif';
    ctx.fillText(`BEST ${Math.max(best, s.score)}`, FIELD.width - 12, 24);
    ctx.fillText(`KILLS ${s.kills}   EMBERS ${s.embers}`, FIELD.width - 12, 44);
    ctx.fillText(`REALM ${realm.num} · ${realm.name}`, FIELD.width - 12, 64);
    ctx.fillText(`${extras.difficulty.name}  ·  P pause · M mute`, FIELD.width - 12, 84);
    if (s.boss) {
      const b = s.boss;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(KINDS[b.kind].name.toUpperCase(), FIELD.width / 2, FIELD.height - 34);
      bar(FIELD.width / 2 - 160, FIELD.height - 28, 320, 10, b.hp / b.maxHp, '#e0c06b', '');
    }
    if (s.bannerTimer > 0 && s.banner) {
      ctx.globalAlpha = Math.min(1, s.bannerTimer);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(s.banner, FIELD.width / 2, 150);
      ctx.globalAlpha = 1;
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(8, 10, 20, 0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 215, 107, 0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  function drawTitle(world, best, extras) {
    const selected = extras.difficulty;
    const meta = extras.meta;
    const rank = rankFor(meta.bank);
    const next = nextRank(meta.bank);
    ctx.fillStyle = 'rgba(4, 6, 16, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76b';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('LANTERNKEEP', FIELD.width / 2, 150);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Defend the last light. Three realms. Three bosses. No dawn.', FIELD.width / 2, 188);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('WASD / arrows to move · Mouse to aim · Hold click or Space to shoot', FIELD.width / 2, 246);
    ctx.fillText('Shades that reach the lantern drain its light. Shades inside the light burn faster.', FIELD.width / 2, 272);
    ctx.fillText('Between waves, pick one of three boons from twenty. Beat wave 10 — or keep going into Endless Night.', FIELD.width / 2, 298);
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('3 REALMS · 3 BOSSES · 20 BOONS · 3 DIFFICULTIES · ENDLESS NIGHT', FIELD.width / 2, 336);
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(best > 0 ? `BEST SCORE ${best}` : 'CLICK OR PRESS ENTER TO BEGIN', FIELD.width / 2, 372);
    if (best > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText('Click or press Enter to begin', FIELD.width / 2, 398);
    }
    // Difficulty rows: 1 Ember, 2 Keeper, 3 Nightfall. Click or press 1–3.
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px sans-serif';
    ctx.fillText('CHOOSE YOUR NIGHT — press 1, 2 or 3, or click a row', FIELD.width / 2, 428);
    DIFFICULTY_ORDER.forEach((id, i) => {
      const d = DIFFICULTIES[id];
      const y = DIFFICULTY_ROWS.y + i * (DIFFICULTY_ROWS.h + DIFFICULTY_ROWS.gap);
      const isSel = d.id === selected.id;
      if (isSel) {
        ctx.fillStyle = 'rgba(255, 215, 107, 0.18)';
        ctx.fillRect(DIFFICULTY_ROWS.x, y, DIFFICULTY_ROWS.w, DIFFICULTY_ROWS.h);
        ctx.strokeStyle = '#ffd76b';
        ctx.lineWidth = 1;
        ctx.strokeRect(DIFFICULTY_ROWS.x, y, DIFFICULTY_ROWS.w, DIFFICULTY_ROWS.h);
      }
      ctx.fillStyle = isSel ? '#ffd76b' : 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`[${i + 1}] ${d.name} — ${d.desc}`, FIELD.width / 2, y + 14);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '14px sans-serif';
    ctx.fillText(
      `EMBER BANK ${meta.bank} · RANK ${rank.title} (+${rank.bonus} lantern)` +
      (next ? ` · next rank ${next.title} at ${next.at} embers` : ' · highest rank'),
      FIELD.width / 2, 524,
    );
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '13px sans-serif';
    ctx.fillText('P pause · M mute · R restart on the end screens', FIELD.width / 2, 560);
    void world;
  }

  function drawUpgrade(world, extras) {
    const taken = Object.values(world.state.taken).reduce((a, b) => a + b, 0);
    const realm = extras.realm;
    ctx.fillStyle = 'rgba(4, 6, 16, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76b';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`WAVE ${world.state.wave} CLEAR — CHOOSE A BOON`, FIELD.width / 2, 110);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('Click a card, or press 1, 2 or 3.', FIELD.width / 2, 140);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px sans-serif';
    ctx.fillText(`REALM ${realm.num} · ${realm.name} — BOON ${taken} OF ${UPGRADES.length}`, FIELD.width / 2, 168);
    const cards = world.state.offered;
    const cw = 240;
    const ch = 150;
    const gap = 24;
    const total = cards.length * cw + (cards.length - 1) * gap;
    let x = (FIELD.width - total) / 2;
    const y = 210;
    cards.forEach((card, i) => {
      panel(x, y, cw, ch);
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`[${i + 1}] ${card.name}`, x + cw / 2, y + 44);
      ctx.fillStyle = '#fff';
      ctx.font = '15px sans-serif';
      const words = card.desc.split(' ');
      let line = '';
      let ly = y + 78;
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 26) {
          ctx.fillText(line.trim(), x + cw / 2, ly);
          ly += 22;
          line = word;
        } else {
          line += ' ' + word;
        }
      }
      ctx.fillText(line.trim(), x + cw / 2, ly);
      x += cw + gap;
    });
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Score ${world.state.score} · Lantern ${Math.ceil(world.state.lanternHp)} · Keeper ${Math.ceil(world.state.player.hp)}`, FIELD.width / 2, 420);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(4, 6, 16, 0.7)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('PAUSED', FIELD.width / 2, 280);
    ctx.font = '16px sans-serif';
    ctx.fillText('Press P or Escape to keep playing', FIELD.width / 2, 320);
  }

  function drawEnd(world, best, won, extras) {
    const s = world.state;
    ctx.fillStyle = 'rgba(4, 6, 16, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#ffd76b' : '#ff8b8b';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(won ? 'DAWN BREAKS — YOU WIN' : 'THE LIGHT GOES OUT', FIELD.width / 2, 160);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText(won
      ? 'Ten waves held. The glade is yours until the dark returns.'
      : (s.lanternHp <= 0 ? 'The lantern is dark. The shades own the glade now.' : 'The Keeper has fallen. The lantern burns alone.'),
    FIELD.width / 2, 200);
    ctx.font = '18px sans-serif';
    ctx.fillText(`SCORE ${s.score}   ·   BEST ${Math.max(best, s.score)}`, FIELD.width / 2, 250);
    ctx.fillText(`WAVE ${s.wave} / ${WAVES}   ·   KILLS ${s.kills}   ·   EMBERS ${s.embers}`, FIELD.width / 2, 282);
    const rank = rankFor(extras.meta.bank);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '15px sans-serif';
    ctx.fillText(`EMBERS BANKED ${s.embers} · BANK ${extras.meta.bank} · RANK ${rank.title}`, FIELD.width / 2, 312);
    if (won) {
      panel(ENDLESS_BUTTON.x, ENDLESS_BUTTON.y, ENDLESS_BUTTON.w, ENDLESS_BUTTON.h);
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('ENDLESS NIGHT — press E or click', FIELD.width / 2, ENDLESS_BUTTON.y + 28);
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Press R or click to play again', FIELD.width / 2, 470);
    } else {
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Press R or click to play again', FIELD.width / 2, 340);
    }
    void world;
  }

  function draw(state, screen, best, extras) {
    const world = extras.world;
    const time = state.time;
    frame();
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    ctx.translate(shakeX, shakeY);
    drawBackground(time, extras.realm);
    // Burning ground.
    for (const f of state.fires) {
      ctx.globalAlpha = Math.min(0.7, f.life);
      const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.radius);
      g.addColorStop(0, 'rgba(255, 140, 40, 0.8)');
      g.addColorStop(1, 'rgba(255, 140, 40, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawLantern(state, time, extras.realm);
    for (const pk of state.pickups) {
      const bob = Math.sin(time * 4 + pk.x) * 2;
      if (pk.kind === 'ember') {
        ctx.fillStyle = '#ffd76b';
        ctx.save();
        ctx.translate(pk.x, pk.y + bob);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();
      } else {
        ctx.fillStyle = '#ff5b6b';
        ctx.beginPath();
        ctx.arc(pk.x - 3, pk.y + bob, 4, 0, Math.PI * 2);
        ctx.arc(pk.x + 3, pk.y + bob, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(pk.x - 7, pk.y + bob - 1, 14, 7);
      }
    }
    for (const e of state.enemies) drawEnemy(e, time);
    // Enemy globs.
    for (const g of state.enemyBullets) {
      ctx.fillStyle = '#ff9a5c';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 154, 92, 0.35)';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // The dark, with holes for the lantern and the Keeper.
    drawDarkness({ lightRadius: extras.lightRadius, player: state.player }, extras.realm);
    // Glowing things shine through the dark: bullets, particles, and the
    // shades' own glow and eyes, so the dark never hides a threat.
    ctx.globalCompositeOperation = 'lighter';
    for (const b of state.bullets) {
      ctx.fillStyle = '#ffc95e';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius - 1, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pt of world.particles.list) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of state.enemies) {
      const def = KINDS[e.kind];
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      const a = Math.atan2(LANTERN.y - e.y, LANTERN.x - e.x);
      const ex = Math.cos(a) * e.radius * 0.35;
      const ey = Math.sin(a) * e.radius * 0.35;
      ctx.fillStyle = def.eye;
      ctx.beginPath();
      ctx.arc(e.x + ex - e.radius * 0.22, e.y + ey - e.radius * 0.12, Math.max(2, e.radius * 0.14), 0, Math.PI * 2);
      ctx.arc(e.x + ex + e.radius * 0.22, e.y + ey - e.radius * 0.12, Math.max(2, e.radius * 0.14), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawPlayer(state.player, time);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (const t of world.particles.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.font = t.big ? 'bold 17px sans-serif' : 'bold 13px sans-serif';
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_UPGRADE) {
      drawHud(world, best, extras);
    }
    if (screen === SCREEN_TITLE) drawTitle(world, best, extras);
    if (screen === SCREEN_UPGRADE) drawUpgrade(world, extras);
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_OVER) drawEnd(world, best, false, extras);
    if (screen === SCREEN_WIN) drawEnd(world, best, true, extras);
  }

  return { draw, resize, get view() { return view; } };
}
