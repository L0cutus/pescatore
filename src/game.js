const ROUND = 90;
const FISHER = { x: PIER.bx - 4, y: PIER.by - 2 };
const ROD_BASE = { x: FISHER.x + 6, y: FISHER.y - 12 };

const SPECIES = [
  // minW/maxW in kg: l'intervallo reale della specie. Lo stivale non ha peso (taglia scherzosa).
  { id: 'carpa', name: 'Carpa', pts: 10, rx: 12, ry: 4.8, col: '#93704a', struggle: 0.55, w: 34, minW: 0.8, maxW: 6 },
  { id: 'persico', name: 'Persico', pts: 20, rx: 10, ry: 4.4, col: '#3f7f62', struggle: 0.8, w: 26, minW: 0.1, maxW: 1.5 },
  { id: 'trota', name: 'Trota', pts: 35, rx: 14, ry: 5, col: '#7b8b96', struggle: 1.15, w: 18, minW: 0.3, maxW: 3 },
  { id: 'storione', name: 'Storione', pts: 60, rx: 22, ry: 6.8, col: '#4d5b66', struggle: 1.35, w: 12, minW: 3, maxW: 25 },
  { id: 'tinca', name: 'Tinca', pts: 15, rx: 10, ry: 5.2, col: '#6f7f4a', struggle: 0.45, w: 14, minW: 0.3, maxW: 2.5 },
  { id: 'stivale', name: 'Stivale', pts: 5, rx: 8, ry: 8, col: '#5a4636', struggle: 0.2, w: 6, taglia: 42 }
];
const TOTAL_W = SPECIES.reduce((s, sp) => s + sp.w, 0);

function pickSpecies(){
  let r = rnd() * TOTAL_W;
  for (const sp of SPECIES){
    r -= sp.w;
    if (r <= 0) return sp;
  }
  return SPECIES[0];
}

function spawnFish(){
  let x = 0, y = 0, ok = false;
  for (let i = 0; i < 40 && !ok; i++){
    x = rng(24, VIEW.w - 24);
    const b = lakeBounds(x);
    y = rng(b.lt + 4, b.sb - 4);
    ok = inLake(x, y);
  }
  if (!ok){
    const p = randomLakePoint();
    x = p.x;
    y = p.y;
  }
  const sp = pickSpecies();
  const dir = rnd() < 0.5 ? rng(-0.5, 0.5) : Math.PI + rng(-0.5, 0.5);
  return {
    sp, x, y,
    ang: dir,
    speed: rng(18, 32) * (1.15 - sp.struggle * 0.3),
    phase: rng(0, 6.28),
    wob: rng(0, 6.28),
    hold: 0,
    state: 'free'
  };
}

function loadBest(){
  try {
    const v = Math.floor(Number(localStorage.getItem('pescatore-best')));
    return Number.isFinite(v) ? Math.max(0, Math.min(v, 1e9)) : 0;
  } catch (e){ return 0; }
}
function saveBest(v){
  try { localStorage.setItem('pescatore-best', String(v)); } catch (e){}
}

// Generatore separato dal rnd() del gioco: i pesi devono essere casuali ma non devono
// consumare il flusso del gioco (altrimenti la telecamera/le vesciche/i pesi smettevano
// di riallinearsi tra le copie nel confronto seq.js). Seed da Math.random; le prove in
// Chrome possono forzare il seed via window.__albumSeed.
let albumRngState = null;
function albumRng(){
  if (albumRngState === null){
    albumRngState =
      (typeof window !== 'undefined' && Number.isFinite(window.__albumSeed))
        ? Math.floor(window.__albumSeed) >>> 0
        : (Math.random() * 0x100000000) >>> 0;
    if (albumRngState === 0) albumRngState = 123456789;
  }
  albumRngState = (albumRngState * 1664525 + 1013904223) >>> 0;
  return albumRngState / 0x100000000;
}
// Distribuzione triangolare (media di due unifrome: moda a metà dell'intervallo): favorisce
// i pesci medi; i giganti (e i microscopici) sono rari.
function rollWeight(sp){
  const u = (albumRng() + albumRng()) / 2;
  const w = sp.minW + (sp.maxW - sp.minW) * u;
  return Math.round(w * 100) / 100;
}
function fmtKg(w){
  return w.toFixed(2).replace('.', ',') + ' kg';
}
function todayISO(){
  try { return new Date().toISOString().slice(0, 10); } catch (e){ return ''; }
}
function fmtDate(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  return m[3] + '/' + m[2] + '/' + m[1];
}

// Album delle catture: conteggi e record di peso per specie. Persistito in localStorage con
// try/catch ovunque: se non funziona (navigazione privata) l'album vale solo per la sessione.
// Chiave nuova e versionata; 'pescatore-best' resta com'è.
const ALBUM_KEY = 'pescatore-album-v1';
function defaultAlbumData(){ return { counts: {}, records: {} }; }
function loadAlbum(){
  try {
    const raw = localStorage.getItem(ALBUM_KEY);
    if (!raw) return defaultAlbumData();
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object') return defaultAlbumData();
    const out = defaultAlbumData();
    for (const sp of SPECIES){
      const n = v.counts && v.counts[sp.id];
      if (Number.isFinite(n) && n > 0) out.counts[sp.id] = Math.floor(n);
      const r = v.records && v.records[sp.id];
      if (r && Number.isFinite(r.w) && r.w > 0){
        out.records[sp.id] = { w: r.w, date: typeof r.date === 'string' ? r.date : '' };
      }
    }
    return out;
  } catch (e){ return defaultAlbumData(); }
}
function saveAlbum(){
  try { localStorage.setItem(ALBUM_KEY, JSON.stringify(game.albumData)); } catch (e){}
}

const game = {
  t: 0,
  phase: 'idle',
  score: 0,
  caught: 0,
  combo: 0,
  left: ROUND,
  best: loadBest(),
  holding: false,
  pointer: { x: VIEW.w * 0.5, y: VIEW.h * 0.62 },
  bob: { x: 0, y: 0, dip: 0 },
  cast: { from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, t: 0 },
  fish: null,
  bite: 0,
  cooldown: 0,
  waitTime: 0,
  tension: 0,
  dist: 0,
  dist0: 1,
  ang: 0,
  burst: false,
  burstT: 0,
  rodSwing: 0,
  landedFx: null,
  box: null,        // passo 4: box "pesce catturato" aperto a schermo (null = chiuso)
  album: null,      // album delle catture aperto a schermo (null = chiuso)
  roundBest: null,  // più grosso pesato del turno: { sp, weight, pts } (null = nessuno)
  albumData: loadAlbum(),
  lastRippleT: -1,
  duckT: 0,
  msg: '',
  log: {}
};

const holders = new Set();
function holdOn(key){ holders.add(key); game.holding = holders.size > 0; }
function holdOff(key){ holders.delete(key); game.holding = holders.size > 0; }
function clearHolds(){ holders.clear(); game.holding = false; }
function clearPointerHolds(){
  for (const k of [...holders]) if (k.startsWith('p')) holders.delete(k);
  game.holding = holders.size > 0;
}

const fish = [];
for (let i = 0; i < 26; i++) fish.push(spawnFish());

const ripples = [];
const splashes = [];

function addRipple(x, y, max, col){
  if (ripples.length > 60) ripples.shift();
  ripples.push({ x, y, r: 2, max, life: 1, col: col || PAL.foam });
}
function addSplash(x, y, n){
  for (let i = 0; i < (n || 8); i++){
    if (splashes.length > 140) splashes.shift();
    splashes.push({ x, y, vx: rng(-44, 44), vy: rng(-68, -16), life: rng(0.25, 0.6), t: 0 });
  }
}

function rodTip(){
  if (game.phase === 'reel'){
    const tx = game.fish ? game.fish.x : game.bob.x;
    const ty = game.fish ? game.fish.y : game.bob.y;
    const aim = Math.atan2(ty - ROD_BASE.y, tx - ROD_BASE.x);
    const ang = aim * 0.35 - 0.55;
    const bend = (game.tension / 100) * 10;
    const len = 48 + bend;
    return {
      x: ROD_BASE.x + Math.cos(ang) * len + Math.cos(aim) * bend,
      y: ROD_BASE.y + Math.sin(ang) * len + Math.sin(aim) * bend * 0.6
    };
  }
  let ang = -0.92 + Math.sin(game.t * 1.1) * 0.05;
  if (game.phase === 'casting') ang = -0.92 + game.rodSwing * 0.55;
  if (game.phase === 'bite') ang = -0.85 + Math.sin(game.t * 9) * 0.08;
  return { x: ROD_BASE.x + Math.cos(ang) * 48, y: ROD_BASE.y + Math.sin(ang) * 48 };
}

function clampLake(x, y, depth){
  const tx = Math.max(20, Math.min(VIEW.w - 20, x));
  const b = lakeBounds(tx);
  let ty = Math.max(b.lt, Math.min(b.sb, y));
  if (depth > 0){
    const isl = inIsland(tx, ty, 16);
    if (isl){
      const a = Math.atan2(ty - isl.y, tx - isl.x);
      return clampLake(isl.x + Math.cos(a) * (isl.rx + 22), isl.y + Math.sin(a) * (isl.ry + 22), depth - 1);
    }
    const pr = pierAt(tx);
    if (pr && Math.abs(ty - pr.cy) < pr.half + 6){
      ty = outsidePier(tx, ty, 6);
      const b2 = lakeBounds(tx);
      ty = Math.max(b2.lt, Math.min(b2.sb, ty));
    }
  }
  return { x: tx, y: ty };
}

function castTo(x, y){
  const tip = rodTip();
  const target = clampLake(x, y, 3);
  game.cast.from = tip;
  game.cast.to = target;
  game.cast.t = 0;
  game.rodSwing = 0;
  game.phase = 'casting';
  game.fish = null;
  say('in acqua...');
  beep(560, 0.09, 'triangle', 0.05);
}

function hookIt(){
  if (!game.fish) return;
  const tip = rodTip();
  game.phase = 'reel';
  game.fish.state = 'hooked';
  game.dist = Math.min(160, Math.max(28, Math.hypot(game.fish.x - tip.x, game.fish.y - tip.y)));
  game.dist0 = game.dist;
  game.tension = 22;
  game.ang = Math.atan2(game.fish.y - tip.y, game.fish.x - tip.x);
  game.bob.x = game.fish.x;
  game.bob.y = game.fish.y;
  game.bob.dip = 0;
  game.burst = false;
  game.burstT = 0.6;
  game.duckT = 0;
  addRipple(game.bob.x, game.bob.y, 28);
  addSplash(game.bob.x, game.bob.y, 6);
  say('agganciato! ' + game.fish.sp.name);
  chord([520, 700, 860], 60, 0.1);
  musicDuck(0.85);
  buzz(18);
}

function landIt(){
  const sp = game.fish.sp;
  const comboMul = game.combo;          // il bonus usa il combo PRIMA dell'incremento
  // peso casuale della specie (stivale: no peso, taglia scherzosa) — generatore separato,
  // non consuma il rnd() del gioco
  const weight = sp.minW !== undefined ? rollWeight(sp) : null;
  const factor = weight === null ? 1
    : 0.7 + 1.1 * ((weight - sp.minW) / (sp.maxW - sp.minW));
  // punti base della specie × fattore peso, poi bonus combo come oggi
  const base = Math.round(sp.pts * factor);
  const pts = Math.round(base * (1 + comboMul * 0.15));
  game.score += pts;
  game.caught++;
  game.combo++;
  game.log[sp.id] = (game.log[sp.id] || 0) + 1;
  if (game.score > game.best){
    game.best = game.score;
    saveBest(game.best);
  }
  // album: conteggio sempre, record solo se la specie ne ha uno (lo stivale no)
  let isRecord = false;
  if (weight !== null){
    const rec = game.albumData.records[sp.id];
    if (!rec || weight > rec.w){
      isRecord = true;
      game.albumData.records[sp.id] = { w: weight, date: todayISO() };
    }
    if (!game.roundBest || weight > game.roundBest.weight){
      game.roundBest = { sp, weight, pts };
    }
  }
  game.albumData.counts[sp.id] = (game.albumData.counts[sp.id] || 0) + 1;
  saveAlbum();
  game.landedFx = { x: FISHER.x - 18, y: FISHER.y + 6, sp, t: 0 };
  // passo 4: si apre al centro, il timer si congela. base/factor/bonus dicono come si è fatto
  // pts, così il "+N" del box non contraddice i pt della specie nella riga in basso
  game.box = {
    sp, pts, base, factor, weight, taglia: sp.taglia || null, bonus: pts - base,
    combo: comboMul, isRecord, t: 0
  };
  addSplash(FISHER.x - 12, FISHER.y + 6, 10);
  game.phase = 'landed';
  game.fish.state = 'landed';
  clearHolds();
  const weightTxt = weight !== null ? ' · ' + fmtKg(weight) : ' · taglia ' + sp.taglia;
  say(sp.name + weightTxt + ' +' + pts + (game.box.bonus > 0 ? ' · base ' + base + ' · bonus +' + game.box.bonus : ''));
  chord(sp.id === 'storione' ? [523, 659, 784, 988] : [440, 587, 740], 70, 0.14);
  musicDuck(1);
  buzz([45, 60, 45]);
}

function loseFish(reason){
  game.combo = 0;
  if (game.fish){
    game.fish.state = 'free';
    game.fish.ang = rng(0, 6.28);
    const p = clampLake(game.fish.x + rng(-60, 60), game.fish.y, 3);
    game.fish.x = p.x;
    game.fish.y = p.y;
  }
  game.fish = null;
  game.phase = 'idle';
  game.bob.dip = 0;
  clearHolds();
  say(reason);
  beep(220, 0.18, 'sawtooth', 0.05);
  musicDuck(0.75);
  buzz(reason.includes('rotta') ? 140 : 70);
}

const elMsg = document.getElementById('msg');
const elScore = document.getElementById('score');
const elBest = document.getElementById('best');
const elCaught = document.getElementById('caught');
const elClock = document.getElementById('clockbar');
const elTension = document.getElementById('tensionbar');
const elDist = document.getElementById('distbar');
const elLog = document.getElementById('log');
const elBite = document.getElementById('bitecue');
const btnCast = document.getElementById('btnCast');
const btnHold = document.getElementById('btnHold');
const btnRestart = document.getElementById('btnRestart');
const btnMusic = document.getElementById('btnMusic');
const btnAlbum = document.getElementById('btnAlbum');
const btnAlbumDesk = document.getElementById('btnAlbumDesk');

function buzz(pattern){
  if (typeof navigator !== 'undefined' && navigator.vibrate){
    try { navigator.vibrate(pattern); } catch (e){}
  }
}
function toggleAudio(){
  audioOn = !audioOn;
  if (audioOn){ getCtx(); startMusic(); } else {
    stopMusic();
    if (actx && actx.suspend){ try { actx.suspend(); } catch (e){} }
  }
  syncMusicBtn();
  say(audioOn ? 'musica on' : 'musica off');
}

function say(text){
  game.msg = text;
  elMsg.textContent = text;
  elMsg.className = /rotta|scappa|mangiato|abbocca/.test(text) ? 'hot' : '';
}

// l'album è disegnabile solo con un DOM vero: negli stub Node si resta tranquilli
function albumDomReady(){
  if (typeof document === 'undefined' || !document.getElementById) return false;
  const el = document.getElementById('album');
  return !!el && !!el.classList && typeof el.appendChild === 'function';
}
function toggleAlbum(){
  if (game.album){ game.album = null; return; }
  if (!albumDomReady()) return;
  if (game.box) game.box = null;   // l'album è un modale: il box si disarma
  game.album = { t: 0 };
  say('album delle catture');
}

function restart(){
  game.phase = 'idle';
  game.score = 0;
  game.caught = 0;
  game.combo = 0;
  game.left = ROUND;
  game.log = {};
  game.fish = null;
  game.tension = 0;
  game.landedFx = null;
  game.box = null;
  game.album = null;
  game.roundBest = null;
  game.dist = 0;
  game.dist0 = 1;
  game.ang = 0;
  game.bite = 0;
  game.cooldown = 0;
  game.burst = false;
  game.burstT = 0;
  game.duckT = 0;
  game.lastRippleT = -1;
  game.rodSwing = 0;
  game.waitTime = 0;
  game.bob.x = VIEW.w * 0.5;
  game.bob.y = VIEW.h * 0.62;
  game.bob.dip = 0;
  clearHolds();
  for (const f of fish) Object.assign(f, spawnFish());
  ripples.length = 0;
  splashes.length = 0;
  say('nuova giornata: tap o spazio per lanciare');
  musicModeSet('play');
  musicDuck(1);
}

let pointerFresh = false;

// Conversione tocco → mondo con la trasformazione inversa della camera:
// lo schermo mostra una finestra di VIEW.w/cam.z × VIEW.h/cam.z centrata su cam.
function pointerToWorld(e){
  const r = canvas.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return;
  const u = (e.clientX - r.left) / r.width;
  const v = (e.clientY - r.top) / r.height;
  const x = cam.cx + (u - 0.5) * VIEW.w / cam.z;
  const y = cam.cy + (v - 0.5) * VIEW.h / cam.z;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  // il limite è la finestra che la camera mostra (cam.cx ± hw), non il mondo: la pubblicata non
  // limitava affatto il puntatore (game.pointer.x = x diretto), quindi con lo zoom si poteva
  // mirare fuori da quanto si vede; con la finestra mostrata il puntatore resta dove lo guardi
  const hw = VIEW.w / (2 * cam.z), hh = VIEW.h / (2 * cam.z);
  const x0 = Math.max(0, cam.cx - hw), x1 = Math.min(VIEW.w, cam.cx + hw);
  const y0 = Math.max(0, cam.cy - hh), y1 = Math.min(VIEW.h, cam.cy + hh);
  game.pointer.x = Math.min(x1, Math.max(x0, x));
  game.pointer.y = Math.min(y1, Math.max(y0, y));
  pointerFresh = true;
}

function randomLakePoint(){
  for (let i = 0; i < 30; i++){
    const x = rng(40, VIEW.w - 40);
    const b = lakeBounds(x);
    const y = rng(b.lt + 6, b.sb - 6);
    if (inLake(x, y)) return { x, y };
  }
  return { x: VIEW.w * 0.5, y: VIEW.h * 0.62 };
}

function press(key, randomTarget){
  if (audioOn){ getCtx(); startMusic(); }
  // album aperto: chiude senza lanciare
  if (game.album){ game.album = null; return; }
  if (game.phase === 'over') { restart(); return; }
  // passo 4: il primo tap/spazio chiude il box della cattura e NON lancia
  if (game.box){ game.box = null; return; }
  if (game.phase === 'idle') {
    const t = pointerFresh && !randomTarget ? game.pointer : randomLakePoint();
    castTo(t.x, t.y);
    return;
  }
  if (game.phase === 'waiting'){
    if (game.fish) game.fish.state = 'free';
    game.fish = null;
    game.phase = 'idle';
    say('linea ritirata');
    return;
  }
  if (game.phase === 'bite') { hookIt(); return; }
  if (game.phase === 'reel') holdOn(key);
}
function release(e){
  if (e && e.pointerId !== undefined) holdOff('p' + e.pointerId);
  else clearPointerHolds();
}

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  pointerToWorld(e);
  press('p' + e.pointerId);
});
canvas.addEventListener('pointermove', pointerToWorld);
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
window.addEventListener('keydown', e => {
  if (e.code === 'Space'){
    e.preventDefault();
    if (!e.repeat){
      const albumOpen = !!game.album;
      press('space');
      if (!albumOpen) holdOn('space');
    }
  }
  if (e.key === 'r' || e.key === 'R'){ if (!e.repeat) restart(); }
  if (e.key === 'm' || e.key === 'M'){ if (!e.repeat) toggleAudio(); }
  if (e.key === 'a' || e.key === 'A'){ if (!e.repeat) toggleAlbum(); }
});
window.addEventListener('keyup', e => { if (e.code === 'Space') holdOff('space'); });

function stopBubble(e){ e.preventDefault(); e.stopPropagation(); }
if (btnCast) btnCast.addEventListener('pointerdown', e => { stopBubble(e); press('p' + e.pointerId, true); });
if (btnHold) btnHold.addEventListener('pointerdown', e => {
  stopBubble(e);
  if (btnHold.setPointerCapture && e.pointerId !== undefined){
    try { btnHold.setPointerCapture(e.pointerId); } catch (err){}
  }
  press('p' + e.pointerId, true);
  if (game.phase === 'reel') holdOn('p' + e.pointerId);
});
if (btnHold){
  const stop = e => {
    if (e.pointerId !== undefined) holdOff('p' + e.pointerId);
    else clearPointerHolds();
  };
  btnHold.addEventListener('pointerup', stop);
  btnHold.addEventListener('pointercancel', stop);
  btnHold.addEventListener('lostpointercapture', stop);
}
const noLongPressMenu = el => { if (el) el.addEventListener('contextmenu', e => e.preventDefault()); };
const stageEl = document.getElementById('stage');
noLongPressMenu(stageEl);
noLongPressMenu(canvas);
noLongPressMenu(btnCast);
noLongPressMenu(btnHold);
noLongPressMenu(btnRestart);
noLongPressMenu(btnMusic);
noLongPressMenu(btnAlbum);
noLongPressMenu(btnAlbumDesk);
noLongPressMenu(document.getElementById('fs'));
noLongPressMenu(document.getElementById('fsZone'));
if (btnRestart) btnRestart.addEventListener('pointerdown', e => { stopBubble(e); restart(); });
if (btnMusic) btnMusic.addEventListener('pointerdown', e => { stopBubble(e); toggleAudio(); });
for (const b of [btnAlbum, btnAlbumDesk]){
  if (b) b.addEventListener('pointerdown', e => { stopBubble(e); toggleAlbum(); });
}

function buttonKey(el, down, up){
  if (!el) return;
  el.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.code !== 'Space') return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) down();
  });
  if (up){
    el.addEventListener('keyup', e => {
      if (e.key !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault();
      e.stopPropagation();
      up();
    });
  }
}
buttonKey(btnCast, () => press('kb-cast', true));
buttonKey(btnHold, () => { press('kb-hold', true); if (game.phase === 'reel') holdOn('kb-hold'); }, () => holdOff('kb-hold'));
buttonKey(btnRestart, restart);
buttonKey(btnMusic, toggleAudio);
buttonKey(btnAlbum, toggleAlbum);
buttonKey(btnAlbumDesk, toggleAlbum);

function syncMusicBtn(){ if (btnMusic) btnMusic.textContent = audioOn ? 'musica on' : 'musica off'; }
syncMusicBtn();

function updateFish(f, dt){
  if (f.state === 'hooked' || f.state === 'bite') return;

  if (game.phase !== 'waiting' && (f.state === 'approach' || f.state === 'inspect')){
    f.state = 'free';
    f.ang = rng(0, 6.28);
    if (game.fish === f) game.fish = null;
  }

  if (f.state === 'approach' && game.phase === 'waiting'){
    f.phase += dt;
    f.ang = Math.atan2(game.bob.y - f.y, game.bob.x - f.x);
    f.x += Math.cos(f.ang) * f.speed * 3.2 * dt;
    f.y += Math.sin(f.ang) * f.speed * 2.2 * dt;
    if (Math.hypot(game.bob.x - f.x, game.bob.y - f.y) < 14){
      f.state = 'inspect';
      f.phase = 0;
      f.hold = rng(0.4, 1.2);
      return;
    }
    if (f.phase > 5){
      f.state = 'free';
      f.ang = rng(0, 6.28);
      game.fish = null;
      game.cooldown = rng(0.6, 1.4);
    }
    return;
  }

  if (f.state === 'inspect'){
    f.phase += dt;
    if (f.phase > f.hold){
      if (game.phase !== 'waiting'){
        f.state = 'free';
        f.ang = rng(0, 6.28);
        if (game.fish === f) game.fish = null;
        return;
      }
      const roll = rnd();
      if (roll < 0.7){
        game.phase = 'bite';
        game.bite = 0.9;
        game.fish = f;
        f.state = 'bite';
        game.bob.dip = 1;
        addRipple(game.bob.x, game.bob.y, 24);
        say('abbocca! tap');
        beep(880, 0.06, 'square', 0.06);
        setTimeout(() => beep(700, 0.06, 'square', 0.06), 90);
        buzz(30);
      } else if (roll < 0.88){
        addRipple(game.bob.x, game.bob.y, 16);
        f.state = 'free';
        f.ang = rng(0, 6.28);
        game.fish = null;
        game.cooldown = rng(0.8, 1.8);
      } else {
        f.state = 'free';
        f.ang = rng(0, 6.28);
        game.fish = null;
        game.cooldown = rng(0.6, 1.2);
      }
    }
    return;
  }

  f.phase += dt;
  f.ang += Math.sin(f.phase * 0.55 + f.wob) * 0.35 * dt;

  if (game.phase === 'waiting'){
    const dx = game.bob.x - f.x;
    const dy = game.bob.y - f.y;
    const d = Math.hypot(dx, dy);
    if (d > 12 && d < 340){
      const want = Math.atan2(dy, dx);
      let diff = want - f.ang;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      f.ang += diff * 0.5 * dt;
    }
  }

  f.x += Math.cos(f.ang) * f.speed * dt;
  f.y += Math.sin(f.ang) * f.speed * 0.6 * dt;

  const isl = inIsland(f.x, f.y, 12);
  if (isl){
    const a = Math.atan2(f.y - isl.y, f.x - isl.x);
    f.x = isl.x + Math.cos(a) * (isl.rx + 16);
    f.y = isl.y + Math.sin(a) * (isl.ry + 16);
    f.ang = a;
  }

  if (f.x < 20){ f.x = 20; f.ang = Math.PI - f.ang; }
  if (f.x > VIEW.w - 20){ f.x = VIEW.w - 20; f.ang = Math.PI - f.ang; }

  const b = lakeBounds(f.x);
  if (f.y < b.lt){ f.y = b.lt; f.ang = -f.ang; }
  if (f.y > b.sb){ f.y = b.sb; f.ang = -f.ang; }

  const pr = pierAt(f.x);
  if (pr && Math.abs(f.y - pr.cy) < pr.half + 6){
    f.y = outsidePier(f.x, f.y, 6);
    f.ang = -f.ang;
  }
}
