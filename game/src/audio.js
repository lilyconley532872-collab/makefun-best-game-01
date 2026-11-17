// Every sound is synthesised with WebAudio: no audio files, no network.
// Short effects (shoot, hit, pickup, hurt, wave horn, boss) plus a quiet
// two-oscillator drone that hums under the game. M toggles it all.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicStarted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.05;
      musicGain.connect(master);
    } catch {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    startMusic();
  }

  function startMusic() {
    if (!ctx || musicStarted) return;
    musicStarted = true;
    // A low drone (A1 + E2, slow beating) that never resolves: the dark glade.
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 55;
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 82.41;
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = 110;
    const g1 = ctx.createGain();
    g1.gain.value = 0.5;
    const g2 = ctx.createGain();
    g2.gain.value = 0.22;
    const g3 = ctx.createGain();
    g3.gain.value = 0.12;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.25;
    lfo.connect(lfoGain);
    lfoGain.connect(g1.gain);
    osc1.connect(g1);
    osc2.connect(g2);
    osc3.connect(g3);
    g1.connect(musicGain);
    g2.connect(musicGain);
    g3.connect(musicGain);
    osc1.start();
    osc2.start();
    osc3.start();
    lfo.start();
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shoot() {
      tone(720, 0.08, 'square', 0.08, 240);
    },
    hit() {
      noise(0.06, 0.12, 1800);
    },
    kill() {
      tone(320, 0.12, 'triangle', 0.14, 90);
      noise(0.1, 0.1, 1200);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.12, 1320);
    },
    heart() {
      tone(523, 0.14, 'sine', 0.14, 784);
      tone(784, 0.18, 'sine', 0.1, 1046);
    },
    hurt() {
      tone(160, 0.22, 'sawtooth', 0.16, 60);
      noise(0.14, 0.14, 700);
    },
    lanternHit() {
      tone(98, 0.3, 'sawtooth', 0.18, 49);
    },
    waveHorn() {
      tone(220, 0.5, 'triangle', 0.16, 330);
      tone(330, 0.5, 'triangle', 0.1, 440);
    },
    bossRoar() {
      tone(70, 0.7, 'sawtooth', 0.22, 45);
      noise(0.5, 0.16, 400);
    },
    upgrade() {
      tone(660, 0.1, 'sine', 0.12, 660);
      setTimeout(() => tone(990, 0.14, 'sine', 0.12, 990), 90);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.14, f), i * 130));
    },
    lose() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.13, f * 0.94), i * 160));
    },
  };
}
