function makeSprite(rows, pal, scale){
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  return { w, h, rows, pal, scale: scale || 2 };
}

function drawSprite(c, spr, x, y, flip, tint){
  const s = spr.scale;
  for (let j = 0; j < spr.h; j++){
    const row = spr.rows[j];
    for (let i = 0; i < spr.w; i++){
      const ch = row[flip ? spr.w - 1 - i : i];
      if (ch === '.' || ch === ' ') continue;
      const col = tint ? tint(spr.pal[ch]) : spr.pal[ch];
      px(c, Math.round(x + i * s), Math.round(y + j * s), s, s, col);
    }
  }
}

function spriteW(spr){ return spr.w * spr.scale; }
function spriteH(spr){ return spr.h * spr.scale; }

const spriteCache = new Map();
const bakeCache = new Map();

function bakeCanvas(w, h){
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g && g.imageSmoothingEnabled !== undefined) g.imageSmoothingEnabled = false;
  return c;
}

function spriteCanvas(spr, flip){
  const slot = spriteCache.get(spr) || {};
  const k = flip ? 1 : 0;
  if (!slot[k]){
    const c = bakeCanvas(spriteW(spr), spriteH(spr));
    drawSprite(c.getContext('2d'), spr, 0, 0, flip);
    slot[k] = c;
    spriteCache.set(spr, slot);
  }
  return slot[k];
}

function drawSpriteCached(c, spr, x, y, flip){
  c.drawImage(spriteCanvas(spr, flip), Math.round(x), Math.round(y));
}

function pxD(c, x, y, w, h, col){
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}

// I helper "smooth" disegnano in pixel device: PS è la scala corrente
// (SC*zoom + offset della camera nei disegni diretti, livello di bake
// nei disegni su canvas cotti). Con PS.s = SC e PS.ox/oy = 0 sono identici
// alla versione senza camera.
function smoothEllipse(c, cx, cy, rx, ry, col){
  const x = cx * PS.s, y = cy * PS.s, ex = rx * PS.s, ey = Math.max(1, ry * PS.s);
  const rows = Math.round(ey);
  for (let dy = -rows; dy <= rows; dy++){
    const t = dy / ey;
    if (t < -1 || t > 1) continue;
    const hw = ex * Math.sqrt(1 - t * t);
    const x0 = Math.round(x - hw + PS.ox), x1 = Math.round(x + hw + PS.ox);
    pxD(c, x0, Math.round(y + PS.oy) + dy, Math.max(1, x1 - x0 + 1), 1, col);
  }
}

function smoothRing(c, cx, cy, rx, ry, col, thick){
  const steps = Math.max(32, Math.round(rx * PS.s * 4));
  const t = thick || 1;
  for (let s = 0; s < steps; s++){
    const a = (s / steps) * Math.PI * 2;
    pxD(c, Math.round(cx * PS.s + Math.cos(a) * rx * PS.s + PS.ox), Math.round(cy * PS.s + Math.sin(a) * ry * PS.s + PS.oy), t, t, col);
  }
}

function lineSS(){
  return LOW_POWER ? 1 : PS.s;
}

function smoothLine(c, x0, y0, x1, y1, col, thick){
  const ss = lineSS();
  const dx = (x1 - x0) * ss, dy = (y1 - y0) * ss;
  const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const t = Math.max(1, Math.round((thick || 1) * PS.s));
  for (let i = 0; i <= n; i++){
    pxD(c, Math.round(x0 * PS.s + dx * (i / n) + PS.ox), Math.round(y0 * PS.s + dy * (i / n) + PS.oy), t, t, col);
  }
}

function smoothBezier(c, x0, y0, cx, cy, x1, y1, col, thick){
  const ss = lineSS();
  const n = Math.max(28, Math.round(Math.hypot(x1 - x0, y1 - y0) * ss * 1.1));
  const t = Math.max(1, Math.round((thick || 1) * PS.s));
  for (let i = 0; i <= n; i++){
    const p = i / n;
    const a = (1 - p) * (1 - p), b = 2 * p * (1 - p), d = p * p;
    pxD(c, Math.round(a * x0 * PS.s + b * cx * PS.s + d * x1 * PS.s + PS.ox), Math.round(a * y0 * PS.s + b * cy * PS.s + d * y1 * PS.s + PS.oy), t, t, col);
  }
}

function deviceDraw(c, paint){
  if (!c.setTransform){ paint(c); return; }
  const s0 = PS.s, ox0 = PS.ox, oy0 = PS.oy;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  psCam();
  paint(c);
  c.restore();
  PS.s = s0; PS.ox = ox0; PS.oy = oy0;
}

function bakeHi(key, w, h, paint){
  const lv = bakeLevel;
  const k = key + '@' + lv;
  if (!bakeCache.has(k)){
    const bw = Math.max(1, Math.round(w * lv)), bh = Math.max(1, Math.round(h * lv));
    // il fondo è il pezzo grosso (a livello 4 sono ~33MB): si tiene solo l'ultimo
    // livello cotto, altrimenti i livelli attraversati dallo zoom si accumulano
    if (k.startsWith('bg@')){
      for (const old of [...bakeCache.keys()]){
        if (old !== k && old.startsWith('bg@')){ bakeBytes -= bakeCache.get(old).bytes || 0; bakeCache.delete(old); }
      }
    }
    if (bakeBytes + bw * bh * 4 > BAKE_BUDGET){ bakeCache.clear(); bakeBytes = 0; }
    const c = bakeCanvas(bw, bh);
    const s0 = PS.s, ox0 = PS.ox, oy0 = PS.oy;
    psBake(lv);
    paint(c.getContext('2d'), c);
    PS.s = s0; PS.ox = ox0; PS.oy = oy0;
    c.lw = w;
    c.lh = h;
    c.bytes = bw * bh * 4;
    bakeBytes += bw * bh * 4;
    bakeCache.set(k, c);
  }
  return bakeCache.get(k);
}

function blitHi(c, img, x, y){
  const dx = Number.isFinite(x) ? Math.round(x) : 0;
  const dy = Number.isFinite(y) ? Math.round(y) : 0;
  c.drawImage(img, dx, dy, img.lw, img.lh);
}

function ellipse(c, cx, cy, rx, ry, col){
  cx = Math.round(cx); cy = Math.round(cy);
  const ry2 = Math.max(1, Math.round(ry));
  for (let dy = -ry2; dy <= ry2; dy++){
    const t = dy / ry2;
    if (t < -1 || t > 1) continue;
    const hw = rx * Math.sqrt(1 - t * t);
    const x0 = Math.round(cx - hw);
    const x1 = Math.round(cx + hw);
    px(c, x0, cy + dy, Math.max(1, x1 - x0 + 1), 1, col);
  }
}

const FISHERMAN = makeSprite([
  '....HHHH....',
  '...HHHHHH...',
  '..HHhhhhHH..',
  '..HHHHHHHH..',
  '...hhhhhh...',
  '....SSSS....',
  '...VVVVVV...',
  '..BVVVVVVB..',
  '..BVVVVVVB..',
  '..bbVVVVbb..',
  '...VVVVVV...',
  '...PPPPPP...',
  '...PP..PP...',
  '..pP..Pp....',
  '..OO..OO....'
], { H: PAL.hat, h: PAL.hatDark, S: PAL.skin, V: PAL.vest, b: PAL.vestDark, B: PAL.shirt, P: PAL.pants, p: PAL.pantsDark, O: PAL.boot }, 2);

const FISHERMAN_DETAIL = makeSprite([
  '............',
  '..HhhhhH....',
  '............',
  '............',
  '..hhhhhh....',
  '....SSSS....',
  '..VVbVVVV...',
  '...VVVVVV...',
  '..BVVVVVVB..',
  '............',
  '..bVVVVVb...',
  '..PPPPPP....',
  '............',
  '............',
  '..OO..OO....'
], { H: PAL.hat, h: PAL.hatDark, S: PAL.skinDark, V: PAL.vest, b: PAL.vestDark, B: PAL.shirtDark, P: PAL.pantsDark, O: PAL.boot }, 2);

const BOAT = makeSprite([
  '....WWWWW.....',
  '..WWAAAAAWW...',
  '.WAAABAAABAAW.',
  '.WAAAAAAAAAAW.',
  '.WAAABAAABAAW.',
  '..WWAAAAAAWW..',
  '....WWWWW.....'
], { W: PAL.woodDark, A: PAL.wood, B: PAL.woodHi }, 2);

const BOAT_ROWER = makeSprite([
  '....WWWWW.....',
  '..WWAAAAAWW...',
  '.WAAABAAABAAW.',
  '.WAARAAAAAAAW.',
  '.WAAABAAABAAW.',
  '..WWAAAAAAWW..',
  '....WWWWW.....'
], { W: PAL.woodDark, A: PAL.wood, B: PAL.woodHi, R: PAL.skin }, 2);

const BIRD = makeSprite([
  '..w..w..',
  '.wwwwww.',
  'ww....ww'
], { w: PAL.bird }, 2);

const REED = makeSprite([
  '..r..',
  '..r..',
  '.Rr..',
  '.Rr..',
  '..r..',
  '..r..',
  'r.r..',
  '.r...'
], { r: PAL.reed, R: PAL.reedHi }, 2);

function drawTree(c, x, baseY, size, sway){
  const s = size;
  const trunkW = Math.max(2, Math.round(s * 0.16));
  px(c, Math.round(x - trunkW / 2), Math.round(baseY - s * 0.45), trunkW, Math.round(s * 0.45), PAL.trunk);
  px(c, Math.round(x - trunkW / 2), Math.round(baseY - s * 0.45), Math.max(1, Math.round(trunkW * 0.4)), Math.round(s * 0.45), PAL.trunkHi);
  const cy = baseY - s * 0.62;
  const ox = Math.round(sway);
  ellipse(c, x + ox, cy + Math.round(s * 0.22), s * 0.62, s * 0.30, PAL.treeDark);
  ellipse(c, x + ox, cy + Math.round(s * 0.08), s * 0.58, s * 0.30, PAL.treeMid);
  ellipse(c, x + ox - Math.round(s * 0.18), cy - Math.round(s * 0.10), s * 0.42, s * 0.26, PAL.treeLite);
  ellipse(c, x + ox - Math.round(s * 0.26), cy - Math.round(s * 0.22), s * 0.28, s * 0.18, PAL.treeHi);
  px(c, Math.round(x + ox - s * 0.10), Math.round(cy - Math.round(s * 0.34)), Math.max(2, Math.round(s * 0.22)), 1, PAL.treeHi);
  px(c, Math.round(x + ox + s * 0.30), Math.round(cy + s * 0.14), Math.max(2, Math.round(s * 0.16)), 2, PAL.treeDark);
}

function ringCanvas(col, rx){
  const r = Math.max(3, Math.round(rx));
  const ry = Math.max(2, Math.round(r * 0.5));
  const ax = r + 1;
  const ay = ry + 1;
  return bakeHi('ring:' + col + ':' + r + ':' + ry, ax * 2, ay * 2, (g, c) => {
    smoothRing(g, ax, ay, r, ry, col, 1);
    c.ax = ax;
    c.ay = ay;
  });
}

function smoothFishBody(c, x, y, rx, ry, dir, col, alpha){
  c.globalAlpha = alpha;
  smoothEllipse(c, x, y, rx, ry, col);
  pxD(c, toDevX(x - dir * rx), toDevY(y - ry * 0.9), Math.max(PS.s, Math.round(rx * 0.5 * PS.s)), Math.max(PS.s, Math.round(ry * 1.8 * PS.s)), col);
  pxD(c, toDevX(x + dir * rx * 0.45), toDevY(y - ry * 1.35), Math.max(PS.s, Math.round(rx * 0.5 * PS.s)), Math.max(PS.s, Math.round(ry * 0.7 * PS.s)), col);
  pxD(c, toDevX(x + dir * rx * 0.2), toDevY(y + ry * 1.2), Math.max(PS.s, Math.round(rx * 0.3 * PS.s)), Math.max(PS.s, Math.round(ry * 0.5 * PS.s)), col);
  c.globalAlpha = 1;
}

function fishBodyCanvas(sp, dir, submerged){
  const rx = sp.rx, ry = sp.ry;
  const ax = Math.ceil(rx * 1.7) + 6;
  const ay = Math.ceil(ry * 2.2) + 8;
  const w = ax + Math.ceil(rx * 1.7) + 6;
  const h = ay + Math.ceil(ry * 2.2) + 8;
  return bakeHi('fish:' + sp.id + ':' + (dir < 0 ? 'L' : 'R') + ':' + (submerged ? 'deep' : 'clear'), w, h, (g, c) => {
    smoothEllipse(g, ax + 2, ay + 4, rx * 0.9, ry * 0.8, 'rgba(15,35,48,0.35)');
    smoothFishBody(g, ax, ay, rx, ry, dir, mix(sp.col, PAL.waterDeep, submerged ? 0.45 : 0.18), submerged ? 0.5 : 0.75);
    c.ax = ax;
    c.ay = ay;
  });
}

function drawFishCached(c, f, x, y){
  const submerged = f.state === 'free';
  const baked = fishBodyCanvas(f.sp, Math.cos(f.ang) >= 0 ? 1 : -1, submerged);
  blitHi(c, baked, x - baked.ax, y - baked.ay);
}

function shadowCanvas(rx, ry, col){
  const baked = bakeHi('shadow:' + Math.round(rx) + ':' + Math.round(ry) + ':' + col, rx * 2, ry * 2, (g, c) => {
    smoothEllipse(g, rx, ry, rx, ry, col);
    c.ax = rx;
    c.ay = ry;
  });
  return baked;
}

function blitShadow(c, cx, cy, rx, ry, col){
  const baked = shadowCanvas(rx, ry, col);
  blitHi(c, baked, cx - baked.ax, cy - baked.ay);
}

function bobCanvas(){
  return bakeHi('bob', 8, 12, g => {
    smoothEllipse(g, 4, 3.4, 3.4, 2.6, PAL.bobWhite);
    smoothEllipse(g, 4, 7.6, 3.4, 2.8, PAL.bobRed);
    pxD(g, toDevX(2.6), toDevY(1.4), Math.round(2 * PS.s), Math.max(1, Math.round(PS.s * 0.7)), PAL.sparkle);
  });
}

function smoothTree(c, x, baseY, size){
  const s = size;
  smoothLine(c, x, baseY - s * 0.45, x, baseY, PAL.trunk, s * 0.16);
  smoothLine(c, x - s * 0.03, baseY - s * 0.45, x - s * 0.03, baseY, PAL.trunkHi, s * 0.06);
  const cy = baseY - s * 0.62;
  smoothEllipse(c, x, cy + s * 0.22, s * 0.62, s * 0.30, PAL.treeDark);
  smoothEllipse(c, x, cy + s * 0.08, s * 0.58, s * 0.30, PAL.treeMid);
  smoothEllipse(c, x - s * 0.18, cy - s * 0.10, s * 0.42, s * 0.26, PAL.treeLite);
  smoothEllipse(c, x - s * 0.26, cy - s * 0.22, s * 0.28, s * 0.18, PAL.treeHi);
  pxD(c, toDevX(x - s * 0.10), toDevY(cy - s * 0.34), Math.max(PS.s, Math.round(s * 0.22 * PS.s)), Math.max(1, Math.round(PS.s)), PAL.treeHi);
  pxD(c, toDevX(x + s * 0.30), toDevY(cy + s * 0.14), Math.max(PS.s, Math.round(s * 0.16 * PS.s)), Math.max(1, Math.round(PS.s * 2)), PAL.treeDark);
}

function smoothCloud(c, x, y, s){
  smoothEllipse(c, x, y + s * 0.42, s * 1.5, s * 0.42, PAL.haze);
  smoothEllipse(c, x, y, s * 1.15, s * 0.55, '#ffffff');
  smoothEllipse(c, x - s * 0.6, y + 2, s * 0.8, s * 0.42, '#ffffff');
  smoothEllipse(c, x + s * 0.7, y + 4, s * 0.9, s * 0.45, PAL.skyHz);
  smoothEllipse(c, x - s * 0.2, y - s * 0.35, s * 0.6, s * 0.35, '#ffffff');
  pxD(c, toDevX(x - s * 0.5), toDevY(y + s * 0.5), Math.round(s * 1.4 * PS.s), Math.max(1, Math.round(PS.s)), mix(PAL.skyHz, PAL.skyLow, 0.6));
}

function treeCanvas(size){
  const s = Math.round(size);
  const ax = Math.ceil(s * 0.72) + 4;
  const ay = Math.ceil(s * 1.05) + 4;
  const baked = bakeHi('tree:' + s, ax + Math.ceil(s * 0.72) + 4, ay + 2, (g, c) => {
    smoothTree(g, ax, ay, s);
    c.ax = ax;
    c.ay = ay;
  });
  return baked;
}

function drawTreeCached(c, x, baseY, size, sway){
  const baked = treeCanvas(size);
  blitHi(c, baked, x - baked.ax + sway, baseY - baked.ay);
}

function cloudCanvas(s){
  const r = Math.round(s);
  const ax = Math.ceil(r * 1.55) + 4;
  const ay = Math.ceil(r * 0.65) + 4;
  return bakeHi('cloud:' + r, ax + Math.ceil(r * 1.55) + 4, ay + Math.ceil(r * 0.95) + 4, (g, c) => {
    smoothCloud(g, ax, ay, r);
    c.ax = ax;
    c.ay = ay;
  });
}

function cloudShadowCanvas(s){
  const r = Math.round(s);
  const ax = Math.ceil(r * 1.65) + 4;
  const ay = Math.ceil(r * 0.55) + 4;
  return bakeHi('cshadow:' + r, ax + Math.ceil(r * 1.65) + 4, ay + Math.ceil(r * 0.55) + 4, (g, c) => {
    smoothEllipse(g, ax, ay, r * 1.6, r * 0.5, '#0e3448');
    c.ax = ax;
    c.ay = ay;
  });
}
