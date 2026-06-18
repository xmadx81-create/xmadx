let ctx = null;
let bgmGain = null;
let sfxGain = null;
let bgmOsc = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  bgmGain = ctx.createGain();
  bgmGain.gain.value = 0.08;
  bgmGain.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.15;
  sfxGain.connect(ctx.destination);
}

export function toggleMute() {
  muted = !muted;
  if (bgmGain) bgmGain.gain.value = muted ? 0 : 0.08;
  if (sfxGain) sfxGain.gain.value = muted ? 0 : 0.15;
  return muted;
}

export function isMuted() { return muted; }

export function startBGM() {
  if (!ctx || bgmOsc) return;
  bgmOsc = ctx.createOscillator();
  bgmOsc.type = 'sine';
  bgmOsc.frequency.value = 65;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.15;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 8;
  lfo.connect(lfoGain);
  lfoGain.connect(bgmOsc.frequency);
  lfo.start();

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;

  bgmOsc.connect(filter);
  filter.connect(bgmGain);
  bgmOsc.start();
}

export function stopBGM() {
  if (bgmOsc) {
    bgmOsc.stop();
    bgmOsc = null;
  }
}

function playSfx(freq, duration, type = 'sine', decay = true) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = sfxGain.gain.value;
  if (decay) gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function sfxCardPlay() {
  playSfx(440, 0.12, 'triangle');
  setTimeout(() => playSfx(554, 0.1, 'triangle'), 60);
}

export function sfxCollect() {
  playSfx(330, 0.15, 'sine');
  setTimeout(() => playSfx(440, 0.12, 'sine'), 80);
  setTimeout(() => playSfx(554, 0.1, 'sine'), 160);
}

export function sfxFulfill() {
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playSfx(f, 0.2, 'triangle'), i * 100);
  });
}

export function sfxEvent() {
  playSfx(220, 0.3, 'sawtooth');
}

export function sfxWin() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => {
    setTimeout(() => playSfx(f, 0.4, 'triangle'), i * 150);
  });
}

export function sfxLose() {
  [440, 370, 311, 261].forEach((f, i) => {
    setTimeout(() => playSfx(f, 0.5, 'sawtooth'), i * 200);
  });
}

export function sfxEquip() {
  playSfx(261, 0.1, 'square');
  setTimeout(() => playSfx(330, 0.1, 'square'), 80);
  setTimeout(() => playSfx(392, 0.15, 'square'), 160);
}

export function sfxHit() {
  playSfx(180, 0.08, 'sawtooth');
  setTimeout(() => playSfx(120, 0.12, 'square'), 40);
}

export function sfxCritical() {
  playSfx(300, 0.06, 'sawtooth');
  setTimeout(() => playSfx(450, 0.08, 'triangle'), 50);
  setTimeout(() => playSfx(600, 0.1, 'sine'), 100);
}

export function sfxDeath() {
  playSfx(200, 0.3, 'sawtooth');
  setTimeout(() => playSfx(150, 0.3, 'sawtooth'), 100);
  setTimeout(() => playSfx(100, 0.4, 'sawtooth'), 200);
}

export function sfxSkill() {
  playSfx(523, 0.15, 'sine');
  setTimeout(() => playSfx(659, 0.12, 'sine'), 80);
  setTimeout(() => playSfx(784, 0.2, 'triangle'), 160);
}

export function sfxEvade() {
  playSfx(800, 0.06, 'sine');
  setTimeout(() => playSfx(600, 0.06, 'sine'), 60);
}

export function sfxLevelUp() {
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playSfx(f, 0.15, 'sine'), i * 80);
  });
}
