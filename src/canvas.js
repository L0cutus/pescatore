const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const PIXEL_CAP = VIEW.w * VIEW.h * 4;
let SC = 1;
let scaleReady = false;

function applyScale(){
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const next = Math.max(1, Math.min(Math.round(dpr), 2, Math.sqrt(PIXEL_CAP / (VIEW.w * VIEW.h))));
  if (scaleReady && next === SC) return;
  SC = next;
  scaleReady = true;
  canvas.width = VIEW.w * SC;
  canvas.height = VIEW.h * SC;
  if (ctx.setTransform) ctx.setTransform(SC, 0, 0, SC, 0, 0);
  ctx.imageSmoothingEnabled = false;
  bakeCache.clear();
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
