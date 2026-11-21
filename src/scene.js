const VIEW = { w: 960, h: 540 };
const HORIZON = 208;
const WATER_TOP = 236;
const SUN = { x: 744, y: 68, r: 20 };

const ISLANDS = [
  { x: 592, y: 304, rx: 52, ry: 22, trees: 4 },
  { x: 300, y: 282, rx: 30, ry: 14, trees: 3 },
  { x: 828, y: 266, rx: 22, ry: 10, trees: 2 }
];

const PIER = { ax: 60, ay: 500, bx: 356, by: 362 };

const LOW_POWER = typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

function lakeTop(x){
  return WATER_TOP + 10 * Math.sin(x * 0.007 + 1.1) + 6 * Math.sin(x * 0.0155 + 2.3);
}
function shoreY(x){
  return 504 - 68 * Math.exp(-Math.pow((x - 52) / 236, 2)) - 26 * Math.exp(-Math.pow((x - 904) / 160, 2));
}
function grassTop(x){
  return HORIZON - 12 + 10 * Math.sin(x * 0.009 + 0.6) + 6 * Math.sin(x * 0.0225 + 1.8);
}
function hillTop(x){
  return HORIZON - 52 + 26 * Math.sin(x * 0.0055 + 2.1) + 12 * Math.sin(x * 0.013 + 0.4);
}
function hillTop2(x){
  return HORIZON - 24 + 18 * Math.sin(x * 0.0095 + 4.0) + 8 * Math.sin(x * 0.0205 + 1.2);
}
function inIsland(x, y, pad){
  for (const isl of ISLANDS){
    const dx = (x - isl.x) / (isl.rx + pad);
    const dy = (y - isl.y) / (isl.ry + pad);
    if (dx * dx + dy * dy < 1) return isl;
  }
  return null;
}
function pierAt(x){
  const t = (x - PIER.ax) / (PIER.bx - PIER.ax);
  if (t < -0.15 || t > 1.15) return null;
  return { cy: PIER.ay + (PIER.by - PIER.ay) * t, half: 22 - 8 * t };
}
function onPier(x, y){
  const p = pierAt(x);
  return !!p && Math.abs(y - p.cy) < p.half + 6;
}
function inLake(x, y){
  return y > lakeTop(x) + 12 && y < shoreY(x) - 10 && !inIsland(x, y, 10) && !onPier(x, y);
}

function buildBackground(){
  const bg = document.createElement('canvas');
  bg.width = VIEW.w;
  bg.height = VIEW.h;
  const c = bg.getContext('2d');
  const img = c.createImageData(VIEW.w, VIEW.h);
  const buf = img.data;
  const W = VIEW.w, H = VIEW.h;

  ditherGradient(buf, W, H, 0, W, 0, HORIZON + 8, [PAL.skyTop, PAL.skyUpper, PAL.skyMid, PAL.skyLow, PAL.skyHz, PAL.haze]);

  for (let x = 0; x < W; x++){
    fillBand(buf, W, H, x, Math.round(hillTop(x)), HORIZON + 6, PAL.hillFar, PAL.hillFar2);
    fillBand(buf, W, H, x, Math.round(hillTop2(x)), HORIZON + 6, PAL.hillMid, PAL.hillMid2);
  }

  for (let x = 0; x < W; x++){
    const g0 = Math.round(grassTop(x));
    const g1 = Math.max(Math.round(lakeTop(x)), WATER_TOP - 8);
    for (let y = g0; y <= g1; y++){
      const t = (y - g0) / Math.max(1, g1 - g0);
      const a = t < 0.5 ? PAL.grassMid : PAL.grassHi;
      const b = t < 0.5 ? PAL.grassLow : PAL.grassMid;
      putPx(buf, W, H, x, y, BAYER[x & 1][y & 1] / 4 > 0.5 ? b : a);
    }
    for (let y = g1 + 2; y <= g1 + 4; y++) putPx(buf, W, H, x, y, PAL.grassShade);
  }

  ditherGradient(buf, W, H, 0, W, WATER_TOP - 8, H, [PAL.waterHz, PAL.waterFar, PAL.waterMid, PAL.waterDeep, PAL.waterDeep2]);

  for (let x = 0; x < W; x++){
    const lt = Math.round(lakeTop(x));
    for (let y = lt + 4; y <= lt + 7; y++) putPx(buf, W, H, x, y, mix(PAL.waterHz, PAL.foam, 0.45));
    putPx(buf, W, H, x, lt + 8, PAL.waterFar);
  }

  for (let x = 0; x < W; x++){
    const sy = Math.round(shoreY(x));
    for (let y = sy; y < H; y++){
      const t = (y - sy) / Math.max(1, H - sy);
      const a = t > 0.35 ? PAL.grassHi : PAL.grassMid;
      const b = t > 0.35 ? PAL.grassMid : PAL.grassLow;
      putPx(buf, W, H, x, y, rndAt(x, y) > 0.74 ? PAL.grassDark : (BAYER[x & 1][y & 1] / 4 > 0.5 ? b : a));
    }
    for (let y = sy - 6; y < sy; y++) putPx(buf, W, H, x, y, rndAt(x, 3) > 0.6 ? PAL.sandDark : PAL.sand);
    putPx(buf, W, H, x, sy - 7, mix(PAL.sandEdge, PAL.waterFar, 0.5));
  }

  c.putImageData(img, 0, 0);

  for (let r = SUN.r + 24; r >= SUN.r; r -= 4){
    ellipse(c, SUN.x, SUN.y, r, r * 1.05, r > SUN.r + 12 ? PAL.sunGlow : PAL.sunEdge);
  }
  ellipse(c, SUN.x, SUN.y, SUN.r, SUN.r * 1.05, PAL.sunMid);
  ellipse(c, SUN.x - 4, SUN.y - 4, SUN.r - 8, (SUN.r - 8) * 1.05, PAL.sunCore);

  for (let i = 0; i < 86; i++){
    const x = Math.round(rng(8, W - 8));
    const y = Math.round(hillTop2(x) + rng(-2, 10));
    drawTree(c, x, y, rng(8, 14), 0);
  }

  for (let i = 0; i < 52; i++){
    const x = Math.round(rng(6, W - 8));
    drawBush(c, x, Math.round(grassTop(x) + rng(4, 24)));
  }
  for (let i = 0; i < 78; i++){
    const x = Math.round(rng(0, W - 6));
    drawTuft(c, x, Math.round(shoreY(x) + rng(8, 60)));
  }
  for (let i = 0; i < 18; i++){
    const x = Math.round(rng(4, W - 12));
    drawRock(c, x, Math.round(shoreY(x) + rng(12, 50)), rng(4, 8));
  }
  for (let i = 0; i < 34; i++){
    const x = Math.round(rng(8, W - 12));
    drawSprite(c, REED, x, Math.round(lakeTop(x) - 14), false);
  }
  for (let i = 0; i < 22; i++){
    const x = Math.round(rng(8, W - 12));
    drawSprite(c, REED, x, Math.round(shoreY(x) - 20), rnd() < 0.5);
  }
  for (let i = 0; i < 34; i++){
    const x = Math.round(rng(12, W - 16));
    const y = Math.round(lakeTop(x) + rng(14, 36));
    if (inIsland(x, y, 14) || onPier(x, y)) continue;
    const s = rng(6, 10);
    ellipse(c, x, y, s, s * 0.5, PAL.treeDark);
    ellipse(c, x - 2, y - 2, s * 0.75, s * 0.4, PAL.treeMid);
    px(c, x - 2, y - 4, 4, 2, PAL.treeLite);
    if (rnd() < 0.25) px(c, x + 4, y - 4, 2, 2, PAL.flower2);
  }

  for (const isl of ISLANDS) drawIsland(c, isl);

  drawPier(c);

  return bg;
}

function drawBush(c, x, y){
  const s = rng(6, 12);
  ellipse(c, x, y, s, s * 0.55, PAL.treeDark);
  ellipse(c, x - 2, y - 2, s * 0.8, s * 0.45, PAL.treeMid);
  ellipse(c, x - 4, y - 4, s * 0.5, s * 0.3, PAL.treeLite);
}

function drawTuft(c, x, y){
  const s = Math.round(rng(4, 8));
  px(c, x, y - s, 2, s, PAL.grassLow);
  px(c, x + 2, y - s + 2, 2, s - 2, PAL.grassHi);
  px(c, x - 2, y - s + 4, 2, s - 4, PAL.grassMid);
  if (rnd() < 0.3) px(c, x, y - s - 2, 2, 2, rnd() < 0.5 ? PAL.flower : PAL.flower2);
}

function drawRock(c, x, y, s){
  ellipse(c, x, y, s, s * 0.7, PAL.rockDark);
  ellipse(c, x - 2, y - 2, s * 0.8, s * 0.6, PAL.rock);
  px(c, x - 2, y - Math.round(s * 0.6), 4, 2, mix(PAL.rock, PAL.foam, 0.5));
}

function drawIsland(c, isl){
  ellipse(c, isl.x, isl.y + 2, isl.rx + 6, isl.ry + 4, mix(PAL.waterFar, PAL.sandEdge, 0.5));
  ellipse(c, isl.x, isl.y, isl.rx, isl.ry, PAL.sandDark);
  ellipse(c, isl.x, isl.y - 2, isl.rx - 4, isl.ry - 2, PAL.sand);
  ellipse(c, isl.x - 2, isl.y - 4, (isl.rx - 8) * 0.9, (isl.ry - 6) * 0.9, PAL.grassMid);
  ellipse(c, isl.x - 6, isl.y - 6, (isl.rx - 12) * 0.8, (isl.ry - 8) * 0.8, PAL.grassHi);
  drawRock(c, isl.x + isl.rx - 8, isl.y + 4, 4);
}

function drawPier(c){
  const dx = PIER.bx - PIER.ax, dy = PIER.by - PIER.ay;
  const len = Math.hypot(dx, dy);
  for (let i = 0; i <= len; i++){
    const t = i / len;
    const x = Math.round(PIER.ax + dx * t);
    const y = Math.round(PIER.ay + dy * t);
    const half = 22 - 8 * t;
    px(c, x, y - half, 1, half * 2, PAL.woodMid);
    px(c, x, y - half, 1, 4, PAL.woodHi);
    px(c, x, y + half - 4, 1, 4, PAL.woodShade);
    px(c, x + 4, y + half, 1, 6, PAL.shadow);
  }
  for (let t = 0.05; t < 1; t += 0.055){
    const x = Math.round(PIER.ax + dx * t);
    const y = Math.round(PIER.ay + dy * t);
    const half = 22 - 8 * t;
    px(c, x, y - half, 1, half * 2, PAL.woodDark);
    px(c, x, y - half, 1, 2, PAL.woodHi);
    px(c, x + 2, y - half, 1, half * 2, PAL.wood);
    px(c, x + 2, y - 2, 1, 4, PAL.woodGrain);
    px(c, x + 3, y + half - 6, 1, 4, PAL.woodGrain);
  }
  for (let t = 0.22; t < 1; t += 0.24){
    const x = Math.round(PIER.ax + dx * t + 6);
    const y = Math.round(PIER.ay + dy * t + 12);
    px(c, x, y, 4, 10, PAL.post);
    px(c, x, y, 2, 10, PAL.postHi);
    ellipse(c, x + 2, y + 12, 10, 4, PAL.shadowSoft);
  }
}

function buildDynamic(){
  const trees = [];
  const canopyOnPier = (x, y, size) => onPier(x, y - size * 0.35) || onPier(x, y - size * 0.7);
  for (let i = 0; i < 34; i++){
    const x = Math.round(rng(10, VIEW.w - 10));
    trees.push({ x, y: Math.round(lakeTop(x) - 4), size: rng(18, 32), phase: rng(0, 6.28), shore: true });
  }
  for (let i = 0; i < 22; i++){
    const x = Math.round(rng(0, 300));
    const y = Math.round(shoreY(x) + rng(12, 48));
    const size = rng(22, 40);
    if (!canopyOnPier(x, y, size)) trees.push({ x, y, size, phase: rng(0, 6.28), shore: false });
  }
  for (let i = 0; i < 20; i++){
    const x = Math.round(rng(660, VIEW.w - 8));
    const y = Math.round(shoreY(x) + rng(16, 44));
    const size = rng(20, 36);
    if (!canopyOnPier(x, y, size)) trees.push({ x, y, size, phase: rng(0, 6.28), shore: false });
  }
  for (const isl of ISLANDS){
    for (let i = 0; i < isl.trees; i++){
      trees.push({
        x: Math.round(isl.x + rng(-isl.rx * 0.5, isl.rx * 0.5)),
        y: Math.round(isl.y - isl.ry * 0.4 - 2),
        size: rng(14, 24), phase: rng(0, 6.28), shore: false
      });
    }
  }
  trees.sort((a, b) => a.y - b.y);

  const clouds = [];
  for (let i = 0; i < 7; i++){
    clouds.push({
      x: rng(-80, VIEW.w + 80), y: rng(20, 124),
      s: rng(0.6, 1.5), speed: rng(5, 11), shadowY: rng(300, 448)
    });
  }

  const birds = [];
  for (let i = 0; i < 5; i++){
    birds.push({ x: rng(0, VIEW.w), y: rng(36, 136), speed: rng(18, 34), flap: rng(0, 6.28) });
  }

  const boats = [
    { x: 420, y: 352, speed: 14, dir: 1, sprite: BOAT_ROWER, wake: 0, oar: 0 },
    { x: 720, y: 272, speed: 10, dir: -1, sprite: BOAT, wake: 0, oar: 0 },
    { x: 880, y: 400, speed: 8, dir: -1, sprite: BOAT, wake: 0, oar: 0 }
  ];

  const dashes = [];
  for (let i = 0; i < (LOW_POWER ? 170 : 340); i++){
    const y = Math.round(rng(WATER_TOP + 12, VIEW.h - 12));
    dashes.push({
      x: rng(0, VIEW.w), y,
      len: Math.round(rng(4, 14)),
      speed: rng(8, 24) * (rnd() < 0.5 ? -1 : 1),
      phase: rng(0, 6.28)
    });
  }
  const sparkles = [];
  for (let i = 0; i < (LOW_POWER ? 80 : 130); i++){
    const y = Math.round(rng(WATER_TOP + 12, VIEW.h - 8));
    const band = 12 + (y - WATER_TOP) * 0.84;
    sparkles.push({ x: SUN.x + rng(-band, band), y, len: Math.round(rng(2, 6)), phase: rng(0, 6.28), speed: rng(0.4, 1.2) });
  }

  const foam = [];
  for (let i = 0; i < (LOW_POWER ? 70 : 120); i++){
    const near = rnd() < 0.55;
    const x = Math.round(rng(0, VIEW.w - 12));
    const y = Math.round(near ? shoreY(x) - 8 : lakeTop(x) + 4);
    foam.push({ x, y, len: Math.round(rng(4, 12)), phase: rng(0, 6.28), near });
  }

  const flies = [];
  for (let i = 0; i < (LOW_POWER ? 12 : 18); i++){
    const shore = rnd() < 0.6;
    flies.push({
      x: rng(0, VIEW.w),
      y: shore ? rng(shoreY(rng(0, VIEW.w)) + 12, VIEW.h - 8) : rng(WATER_TOP + 16, WATER_TOP + 52),
      phase: rng(0, 6.28),
      amp: rng(6, 18),
      speed: rng(8, 22) * (rnd() < 0.5 ? -1 : 1),
      kind: shore ? (rnd() < 0.5 ? 'butterfly' : 'fly') : 'dragon'
    });
  }

  return { trees, clouds, birds, boats, dashes, sparkles, foam, flies };
}

function drawCloud(c, x, y, s){
  x = Math.round(x); y = Math.round(y);
  ellipse(c, x, y + 6, s * 1.5, s * 0.42, PAL.haze);
  ellipse(c, x, y, s * 1.15, s * 0.55, '#ffffff');
  ellipse(c, x - s * 0.6, y + 2, s * 0.8, s * 0.42, '#ffffff');
  ellipse(c, x + s * 0.7, y + 4, s * 0.9, s * 0.45, PAL.skyHz);
  ellipse(c, x - s * 0.2, y - s * 0.35, s * 0.6, s * 0.35, '#ffffff');
  px(c, x - Math.round(s * 0.5), y + Math.round(s * 0.5), Math.round(s * 1.4), 2, mix(PAL.skyHz, PAL.skyLow, 0.6));
}
