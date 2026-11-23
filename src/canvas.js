const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const PIXEL_CAP = VIEW.w * VIEW.h * 4;
let SC = 1;
let scaleReady = false;

// --- telecamera: zooma l'intera scena (NON un riquadro a parte) ---
// Costanti facili da ritoccare:
const ZOOM_TOUCH = 2.0;     // intensità sui dispositivi touch (LOW_POWER)
const ZOOM_DESKTOP = 1.4;   // intensità su desktop
const ZOOM_RATE = 3.5;      // velocità dell'interpolazione esponenziale (1/s)
const FOLLOW_ROD = 0.35;    // in 'reel': quanto il centro (sul pesce) tira verso la punta della canna
const cam = { z: 1, cx: VIEW.w / 2, cy: VIEW.h / 2 };

// Le figure cotte (bakeHi) non si rifanno a ogni frame dello zoom: si ricottano
// solo a pochi livelli fissi di densità effettiva, con un tetto di memoria.
// 1.4 e 2.8 ci sono perché i target dello zoom (ZOOM_DESKTOP 1.4 con SC 1 e 2)
// cadono esattamente su un livello: così allo zoom fermo il blit resta 1:1 e non
// si vedono righe di pixel di spessore diverso.
const BAKE_LEVELS = [1, 1.4, 1.5, 2, 2.8, 3, 4];
const BAKE_BUDGET = 48 * 1024 * 1024;
let bakeLevel = 1;
let bakeBytes = 0;
function snapLevel(v){
  let best = BAKE_LEVELS[0];
  for (const L of BAKE_LEVELS){
    if (Math.abs(L - v) < Math.abs(best - v)) best = L;
  }
  return best;
}

// Spazio "device pixel" per i disegni che calcolano le coordinate a mano
// (deviceDraw/pxD/smoothLine/smoothBezier): PS è la scala corrente.
let PS = { s: 1, ox: 0, oy: 0 };
function psCam(){
  const s = SC * cam.z;
  PS.s = s;
  // il centro del buffer device è SC*VIEW.w/2: con z=1 e cx=VIEW.w/2 l'offset viene 0,
  // cioè la vecchia trasformazione (x*SC) senza camera
  PS.ox = SC * VIEW.w / 2 - s * cam.cx;
  PS.oy = SC * VIEW.h / 2 - s * cam.cy;
}
function psBake(lv){ PS.s = lv; PS.ox = 0; PS.oy = 0; }
function toDevX(x){ return Math.round(x * PS.s + PS.ox); }
function toDevY(y){ return Math.round(y * PS.s + PS.oy); }

function camTarget(){
  if (game.phase === 'waiting' || game.phase === 'bite'){
    return { z: LOW_POWER ? ZOOM_TOUCH : ZOOM_DESKTOP, cx: game.bob.x, cy: game.bob.y };
  }
  // Passo 2: in 'reel' la camera segue il pesce agganciato fino al pontile. Il centro sta
  // sul pesce, tirato un po' verso la punta della canna (rodTip()), poi è bloccato
  // nell'intervallo di centri che tiene ENTRAMBI nella finestra mostrata: la distanza
  // pesce↔punta resta sotto ~216 px (rule: se dist > dist0*1.35 il pesce scappa), che sta
  // dentro la finestra a entrambe le intensità (480×270 sul touch, 686×386 sul desktop),
  // quindi l'intervallo non è mai vuoto. Il blocco ai bordi del mondo in updateCamera
  // viene dopo: la finestra resta sempre piena di mondo.
  if (game.phase === 'reel' && game.fish){
    const z = LOW_POWER ? ZOOM_TOUCH : ZOOM_DESKTOP;
    const hw = VIEW.w / (2 * z), hh = VIEW.h / (2 * z);
    const tip = rodTip();
    const fx = game.fish.x, fy = game.fish.y;
    const cx = Math.min(Math.min(fx, tip.x) + hw, Math.max(Math.max(fx, tip.x) - hw, fx + (tip.x - fx) * FOLLOW_ROD));
    const cy = Math.min(Math.min(fy, tip.y) + hh, Math.max(Math.max(fy, tip.y) - hh, fy + (tip.y - fy) * FOLLOW_ROD));
    return { z, cx, cy };
  }
  return { z: 1, cx: VIEW.w / 2, cy: VIEW.h / 2 };
}

// Interpolazione esponenziale (morbida, niente scatti); quando manca poco
// al target si blocca esattamente sul target, così fuori dallo zoom i frame
// sono identici pixel per pixel a quelli senza camera.
function updateCamera(dt){
  const t = camTarget();
  const k = 1 - Math.exp(-ZOOM_RATE * dt);
  cam.z += (t.z - cam.z) * k;
  cam.cx += (t.cx - cam.cx) * k;
  cam.cy += (t.cy - cam.cy) * k;
  if (Math.abs(cam.z - t.z) < 0.004) cam.z = t.z;
  if (Math.abs(cam.cx - t.cx) < 0.5) cam.cx = t.cx;
  if (Math.abs(cam.cy - t.cy) < 0.5) cam.cy = t.cy;
  // il centro è bloccato ai bordi della scena: mai mostrare vuoto fuori dal mondo
  const hw = VIEW.w / (2 * cam.z), hh = VIEW.h / (2 * cam.z);
  cam.cx = Math.max(hw, Math.min(VIEW.w - hw, cam.cx));
  cam.cy = Math.max(hh, Math.min(VIEW.h - hh, cam.cy));
  bakeLevel = snapLevel(SC * cam.z);
}

function applyCam(){
  const s = SC * cam.z;
  if (ctx.setTransform) ctx.setTransform(s, 0, 0, s, SC * VIEW.w / 2 - s * cam.cx, SC * VIEW.h / 2 - s * cam.cy);
  ctx.imageSmoothingEnabled = false;
  psCam();
}

function applyScale(){
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const next = Math.max(1, Math.min(Math.round(dpr), 2, Math.sqrt(PIXEL_CAP / (VIEW.w * VIEW.h))));
  if (scaleReady && next === SC) return;
  SC = next;
  scaleReady = true;
  canvas.width = VIEW.w * SC;
  canvas.height = VIEW.h * SC;
  bakeLevel = snapLevel(SC * cam.z);
  bakeCache.clear();
  bakeBytes = 0;
  applyCam();
}
applyScale();
window.addEventListener('resize', applyScale);

const fsBtn = document.getElementById('fs');
const fsZone = document.getElementById('fsZone');
const fsTargets = [fsBtn, fsZone].filter(Boolean);

function fullscreenSupported(el){
  return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen || el.msRequestFullscreen);
}
function enterFullscreen(el){
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen || el.msRequestFullscreen;
  if (!req) return null;
  const p = req.call(el);
  return p && p.then ? p : Promise.resolve();
}
function exitFullscreen(){
  const ex = document.fullscreenElement ? document.exitFullscreen || document.webkitExitFullscreen : null;
  if (ex) ex.call(document);
}
function lockLandscape(){
  if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.lock){
    try { screen.orientation.lock('landscape').catch(() => {}); } catch (e){}
  }
}
function note(text){
  if (typeof say === 'function') say(text);
}
function toggleFullscreen(){
  const active = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  if (active){ exitFullscreen(); return; }
  const target = document.getElementById('stage') || document.documentElement;
  const p = enterFullscreen(target);
  if (!p){
    note('schermo intero non supportato da questo browser: usa Chrome');
    return;
  }
  p.then(lockLandscape).catch(() => {
    note('orientamento bloccato non disponibile: ruota il telefono');
  });
}
if (fsTargets.length){
  for (const el of fsTargets) el.addEventListener('click', toggleFullscreen);
  const onChange = () => {
    const active = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
    const label = active ? 'esci' : 'schermo intero';
    for (const el of fsTargets) el.textContent = label;
    if (active) lockLandscape();
  };
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
}
