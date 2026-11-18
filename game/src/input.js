// Keyboard + mouse, read fresh every frame. Movement is WASD or arrows;
// the mouse aims; holding the left button (or Space) fires. P or Escape
// pauses; Enter or click confirms on menus; M toggles sound; R restarts on
// the end screens; E carries a win into Endless Night. Number keys 1-3 pick
// an upgrade card, or a difficulty on the title screen.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_RESTART = 'restart';
export const ACTION_ENDLESS = 'endless';

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function setView(w, h, sx, sy, ox, oy) {
    scale = sx;
    offsetX = ox;
    offsetY = oy;
    void w;
    void h;
  }

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    pressed.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const p = toField(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const p = toField(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function move() {
    let x = 0;
    let y = 0;
    for (const code of keys) {
      const d = MOVE_KEYS[code];
      if (d) {
        x += d[0];
        y += d[1];
      }
    }
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  function action(name) {
    if (name === ACTION_CONFIRM) {
      return pressed.has('Enter') || pressed.has('Space') || mouse.clicked;
    }
    if (name === ACTION_PAUSE) {
      return pressed.has('KeyP') || pressed.has('Escape');
    }
    if (name === ACTION_MUTE) {
      return pressed.has('KeyM');
    }
    if (name === ACTION_RESTART) {
      return pressed.has('KeyR');
    }
    if (name === ACTION_ENDLESS) {
      return pressed.has('KeyE');
    }
    return false;
  }

  function upgradeKey() {
    if (pressed.has('Digit1')) return 0;
    if (pressed.has('Digit2')) return 1;
    if (pressed.has('Digit3')) return 2;
    return -1;
  }

  function endFrame() {
    pressed.clear();
    mouse.clicked = false;
  }

  return {
    mouse,
    setView,
    move,
    action,
    upgradeKey,
    endFrame,
    get firing() {
      return mouse.down || keys.has('Space');
    },
  };
}
