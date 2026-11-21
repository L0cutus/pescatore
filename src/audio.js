let audioOn = false;
let actx = null;
let musicGain = null;
let sfxGain = null;
let noiseBuf = null;

function getCtx(){
  if (!audioOn) return null;
  if (!actx){
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      musicGain = actx.createGain();
      musicGain.gain.value = 0.32;
      musicGain.connect(actx.destination);
      sfxGain = actx.createGain();
      sfxGain.gain.value = 0.5;
      sfxGain.connect(actx.destination);
      noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.6, actx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    } catch (e){
      audioOn = false;
      return null;
    }
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function tone(freq, t, dur, type, gain, dest){
  const ctx = getCtx();
  if (!ctx || !audioOn) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
  o.connect(g);
  g.connect(dest || sfxGain);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(t, dur, gain, type, freq, dest){
  const ctx = getCtx();
  if (!ctx || !audioOn || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type || 'highpass';
  f.frequency.value = freq || 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  src.connect(f); f.connect(g); g.connect(dest || sfxGain);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function beep(freq, dur, type, gain){
  const ctx = getCtx();
  if (!ctx || !audioOn) return;
  tone(freq, ctx.currentTime, dur || 0.1, type || 'square', gain || 0.05);
}
function chord(freqs, step, dur){
  const ctx = getCtx();
  if (!ctx || !audioOn) return;
  freqs.forEach((f, i) => tone(f, ctx.currentTime + i * (step || 70) / 1000, dur || 0.12, 'triangle', 0.06));
}

const BPM_PLAY = 132;
const BPM_REST = 88;
const CHORDS = [
  { root: 130.8, tones: [261.6, 329.6, 392.0], lead: [523.0, 659.3, 784.0, 659.3] },
  { root: 174.6, tones: [349.2, 440.0, 523.3], lead: [698.5, 784.0, 880.0, 784.0] },
  { root: 196.0, tones: [392.0, 493.9, 587.3], lead: [784.0, 880.0, 987.8, 880.0] },
  { root: 110.0, tones: [220.0, 261.6, 329.6], lead: [659.3, 523.0, 659.3, 440.0] }
];
const STEPS_PER_BAR = 8;
const LOOP_STEPS = 32;

let musicTimer = null;
let musicMode = 'play';
let nextStep = 0;
let nextTime = 0;
let scheduled = 0;

function stepDur(){
  return 60 / (musicMode === 'rest' ? BPM_REST : BPM_PLAY) / 2;
}

function scheduleStep(step, t){
  const bar = Math.floor(step / STEPS_PER_BAR) % 4;
  const ch = CHORDS[bar];
  const inBar = step % STEPS_PER_BAR;
  const beat = inBar % 2 === 0;

  if (musicMode === 'play'){
    if (beat){
      tone(ch.root, t, 0.16, 'square', 0.055, musicGain);
      tone(ch.root * 2, t + stepDur() * 0.5, 0.1, 'square', 0.03, musicGain);
    }
    const leadIdx = Math.floor(inBar / 2);
    if (inBar % 2 === 0) tone(ch.lead[leadIdx], t, 0.22, 'triangle', 0.05, musicGain);
    if (inBar === 6) tone(ch.lead[3] * 1.5, t + stepDur() * 0.5, 0.14, 'triangle', 0.035, musicGain);
    const a = ch.tones[step % 3];
    tone(a, t, 0.09, 'square', 0.022, musicGain);
    tone(ch.tones[(step + 1) % 3], t + stepDur() * 0.5, 0.09, 'square', 0.022, musicGain);
    noise(t, 0.035, 0.03, 'highpass', 7000, musicGain);
    if (inBar === 0) { noise(t, 0.12, 0.16, 'lowpass', 180, musicGain); tone(90, t, 0.12, 'sine', 0.14, musicGain); }
    if (inBar === 4) noise(t, 0.11, 0.07, 'bandpass', 1800, musicGain);
  } else {
    if (inBar === 0){
      ch.tones.forEach((f, i) => tone(f, t, stepDur() * 6, 'triangle', 0.035, musicGain));
      tone(ch.root, t, stepDur() * 6, 'sine', 0.05, musicGain);
    }
    if (inBar === 4) tone(ch.tones[2] * 2, t, stepDur() * 3, 'triangle', 0.02, musicGain);
  }
  scheduled++;
}

function pumpMusic(){
  const ctx = getCtx();
  if (!ctx || !audioOn){
    if (musicTimer){ clearInterval(musicTimer); musicTimer = null; }
    return;
  }
  const ahead = 0.25;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + ahead){
    scheduleStep(nextStep % LOOP_STEPS, nextTime);
    nextTime += stepDur();
    nextStep++;
  }
}

function startMusic(){
  const ctx = getCtx();
  if (!ctx || !audioOn) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  if (!musicTimer){
    nextTime = ctx.currentTime + 0.1;
    nextStep = 0;
    musicTimer = setInterval(pumpMusic, 90);
  }
}
function stopMusic(){
  if (musicTimer){ clearInterval(musicTimer); musicTimer = null; }
}
function musicModeSet(mode){
  musicMode = mode;
  const ctx = getCtx();
  if (ctx && musicGain){
    musicGain.gain.setTargetAtTime(mode === 'rest' ? 0.22 : 0.32, ctx.currentTime, 0.3);
  }
}
function musicDuck(level){
  const ctx = getCtx();
  if (!ctx || !musicGain) return;
  const target = musicMode === 'rest' ? 0.22 : 0.32;
  musicGain.gain.setTargetAtTime(target * level, ctx.currentTime, 0.12);
}
