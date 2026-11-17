// Sparks, embers, smoke and the floating numbers that tell the player what
// just happened. Everything here is cosmetic: it never changes the rules.
export function createParticles() {
  const list = [];
  const texts = [];

  function burst(x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      list.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: life * (0.5 + Math.random() * 0.5),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        drag: 0.92,
        glow: true,
      });
    }
  }

  function ring(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      list.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45,
        maxLife: 0.45,
        size: 3,
        color,
        drag: 0.94,
        glow: true,
      });
    }
  }

  function floatText(x, y, text, color, big) {
    texts.push({ x, y, text, color, life: big ? 1.1 : 0.8, maxLife: big ? 1.1 : 0.8, big: !!big });
  }

  function step(dt) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
    }
    for (let i = texts.length - 1; i >= 0; i -= 1) {
      const t = texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) texts.splice(i, 1);
    }
  }

  function clear() {
    list.length = 0;
    texts.length = 0;
  }

  return { list, texts, burst, ring, floatText, step, clear };
}
