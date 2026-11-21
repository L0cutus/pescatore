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

function bake(key, w, h, paint){
  if (!bakeCache.has(key)){
    const c = bakeCanvas(w, h);
    paint(c.getContext('2d'), c);
    bakeCache.set(key, c);
  }
  return bakeCache.get(key);
}

function drawSpriteCached(c, spr, x, y, flip){
  c.drawImage(spriteCanvas(spr, flip), Math.round(x), Math.round(y));
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

function ellipseRing(c, cx, cy, rx, ry, col, thick){
  const steps = Math.max(24, Math.round(rx * 4));
  for (let s = 0; s < steps; s++){
    const a = (s / steps) * Math.PI * 2;
    px(c, Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), thick || 1, 1, col);
  }
}

function linePixels(c, x0, y0, x1, y1, col, thick){
  const dx = x1 - x0, dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= n; i++){
    px(c, Math.round(x0 + dx * (i / n)), Math.round(y0 + dy * (i / n)), thick || 1, 1, col);
  }
}

function bezierPixels(c, x0, y0, cx, cy, x1, y1, col, thick){
  const n = Math.max(14, Math.round(Math.hypot(x1 - x0, y1 - y0) * 1.1));
  for (let i = 0; i <= n; i++){
    const t = i / n;
    const a = (1 - t) * (1 - t);
    const b = 2 * t * (1 - t);
    const d = t * t;
    px(c, Math.round(a * x0 + b * cx + d * x1), Math.round(a * y0 + b * cy + d * y1), thick || 1, 1, col);
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

function drawFishBody(c, x, y, rx, ry, dir, col, alpha){
  c.globalAlpha = alpha;
  ellipse(c, x, y, rx, ry, col);
  px(c, Math.round(x - dir * rx), Math.round(y - ry * 0.9), Math.max(2, Math.round(rx * 0.5)), Math.max(2, Math.round(ry * 1.8)), col);
  px(c, Math.round(x + dir * rx * 0.45), Math.round(y - ry * 1.35), Math.max(2, Math.round(rx * 0.5)), Math.max(2, Math.round(ry * 0.7)), col);
  px(c, Math.round(x + dir * rx * 0.2), Math.round(y + ry * 1.2), Math.max(2, Math.round(rx * 0.3)), Math.max(1, Math.round(ry * 0.5)), col);
  c.globalAlpha = 1;
}

function ringCanvas(col, rx){
  const r = Math.max(3, Math.round(rx));
  const ry = Math.max(2, Math.round(r * 0.5));
  const ax = r + 1;
  const ay = ry + 1;
  return bake('ring:' + col + ':' + r + ':' + ry, ax * 2, ay * 2, (g, c) => {
    ellipseRing(g, ax, ay, r, ry, col, 1);
    c.ax = ax;
    c.ay = ay;
  });
}

function fishBodyCanvas(sp, dir, submerged){
  const rx = sp.rx, ry = sp.ry;
  const ax = Math.ceil(rx * 1.7) + 6;
  const ay = Math.ceil(ry * 2.2) + 8;
  const w = ax + Math.ceil(rx * 1.7) + 6;
  const h = ay + Math.ceil(ry * 2.2) + 8;
  return bake('fish:' + sp.id + ':' + (dir < 0 ? 'L' : 'R') + ':' + (submerged ? 'deep' : 'clear'), w, h, (g, c) => {
    ellipse(g, ax + 2, ay + 4, rx * 0.9, ry * 0.8, 'rgba(15,35,48,0.35)');
    drawFishBody(g, ax, ay, rx, ry, dir, mix(sp.col, PAL.waterDeep, submerged ? 0.45 : 0.18), submerged ? 0.5 : 0.75);
    c.ax = ax;
    c.ay = ay;
  });
}

function drawFishCached(c, f, x, y){
  const submerged = f.state === 'free';
  const baked = fishBodyCanvas(f.sp, Math.cos(f.ang) >= 0 ? 1 : -1, submerged);
  c.drawImage(baked, Math.round(x - baked.ax), Math.round(y - baked.ay));
}

function treeCanvas(size){
  const s = Math.round(size);
  const ax = Math.ceil(s * 0.72) + 4;
  const ay = Math.ceil(s * 1.05) + 4;
  return bake('tree:' + s, ax + Math.ceil(s * 0.72) + 4, ay + 2, (g, c) => {
    drawTree(g, ax, ay, s, 0);
    c.ax = ax;
    c.ay = ay;
  });
}

function drawTreeCached(c, x, baseY, size, sway){
  const baked = treeCanvas(size);
  c.drawImage(baked, Math.round(x - baked.ax + sway), Math.round(baseY - baked.ay));
}

function cloudCanvas(s){
  const r = Math.round(s);
  const ax = Math.ceil(r * 1.55) + 4;
  const ay = Math.ceil(r * 0.65) + 4;
  return bake('cloud:' + r, ax + Math.ceil(r * 1.55) + 4, ay + Math.ceil(r * 0.95) + 4, (g, c) => {
    drawCloud(g, ax, ay, r);
    c.ax = ax;
    c.ay = ay;
  });
}

function cloudShadowCanvas(s){
  const r = Math.round(s);
  const ax = Math.ceil(r * 1.65) + 4;
  const ay = Math.ceil(r * 0.55) + 4;
  return bake('cshadow:' + r, ax + Math.ceil(r * 1.65) + 4, ay + Math.ceil(r * 0.55) + 4, (g, c) => {
    ellipse(g, ax, ay, r * 1.6, r * 0.5, '#0e3448');
    c.ax = ax;
    c.ay = ay;
  });
}
