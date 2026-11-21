const PAL = {
  skyTop:   '#4a93cf',
  skyUpper: '#63a9dd',
  skyMid:   '#7fbcE3',
  skyLow:   '#a3cfe8',
  skyHz:    '#c6e2f0',
  haze:     '#d9edf6',

  sunCore:  '#fffbe4',
  sunMid:   '#ffefba',
  sunEdge:  '#ffdca0',
  sunGlow:  '#ffe7bd',

  hillFar:  '#93b6c8',
  hillFar2: '#7fa4b9',
  hillMid:  '#6f957c',
  hillMid2: '#5a8168',

  treeDark: '#2b5a3d',
  treeMid:  '#3b7750',
  treeLite: '#55965c',
  treeHi:   '#74b56b',
  trunk:    '#6a4a31',
  trunkHi:  '#8b6342',

  grassHi:  '#96d175',
  grassMid: '#78ba5d',
  grassLow: '#5e9c4c',
  grassDark:'#48803e',
  grassShade:'#3c6f37',

  sand:     '#e6d1a6',
  sandDark: '#cbb287',
  sandEdge: '#a89572',

  waterHz:  '#7cbaC7',
  waterFar: '#5ca6b8',
  waterMid: '#3e8da7',
  waterDeep:'#2c6e90',
  waterDeep2:'#22587a',
  foam:     '#dff3f7',
  shimmer:  '#93c8d6',
  sparkle:  '#eaf7fb',

  woodHi:   '#dcb27c',
  wood:     '#c09362',
  woodMid:  '#a5794c',
  woodGrain:'#8f6644',
  woodDark: '#7f5a3b',
  woodShade:'#61432e',
  post:     '#6d4c34',
  postHi:   '#93694a',

  shadow:   'rgba(20,42,56,0.32)',
  shadowSoft:'rgba(20,42,56,0.16)',
  line:     '#e9f1f4',
  lineDark: '#93a8b4',
  bobRed:   '#e0523c',
  bobWhite: '#f6e9d8',
  skin:     '#e2a879',
  skinDark: '#c08a5f',
  shirt:    '#3d6f9c',
  shirtDark:'#2b567c',
  vest:     '#d5693f',
  vestDark: '#ab5331',
  hat:      '#f2d477',
  hatDark:  '#c9a455',
  pants:    '#4c5f70',
  pantsDark:'#354757',
  boot:     '#3a2c22',
  bird:     '#4f6b7a',
  reed:     '#4d8250',
  reedHi:   '#6ea365',
  flower:   '#f4c65a',
  flower2:  '#e8788f',
  rock:     '#7f8f96',
  rockDark: '#5d6d76',
  hudGold:  '#ffd27a',
  hudInk:   '#dff0f6',
  hudDim:   '#8fb6c4',
  hudPanel: '#0d2431'
};

function rgbOf(col){
  if (typeof col !== 'string') return [0, 0, 0];
  if (col[0] === '#'){
    const n = parseInt(col.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = col.match(/rgba?\(([^)]+)\)/);
  if (m){
    const p = m[1].split(',').map(Number);
    return [p[0], p[1], p[2]];
  }
  return [255, 0, 255];
}

function mix(a, b, t){
  const A = rgbOf(a), B = rgbOf(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}

function alphaOf(col){
  const m = col.match(/rgba\(([^)]+)\)/);
  if (m) return parseFloat(m[1].split(',')[3]);
  return 1;
}

const BAYER = [[0, 2], [3, 1]];

function px(c, x, y, w, h, col){
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}

function putPx(buf, w, h, x, y, col){
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const [r, g, b] = rgbOf(col);
  const a = alphaOf(col);
  const i = (y * w + x) * 4;
  if (a < 1){
    const da = buf[i + 3] / 255;
    const out = a + da * (1 - a);
    buf[i] = Math.round(r * a + buf[i] * da * (1 - a) / out);
    buf[i + 1] = Math.round(g * a + buf[i + 1] * da * (1 - a) / out);
    buf[i + 2] = Math.round(b * a + buf[i + 2] * da * (1 - a) / out);
    buf[i + 3] = Math.round(out * 255);
    return;
  }
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = 255;
}

function ditherGradient(buf, w, h, x0, x1, y0, y1, cols){
  const n = cols.length;
  for (let y = y0; y < y1; y++){
    const t = (y - y0) / Math.max(1, y1 - y0 - 1);
    const f = t * (n - 1);
    const i = Math.floor(f);
    const fr = f - i;
    const a = cols[i];
    const b = cols[Math.min(i + 1, n - 1)];
    for (let x = x0; x < x1; x++){
      const thr = BAYER[x & 1][y & 1] / 4;
      putPx(buf, w, h, x, y, fr > thr ? b : a);
    }
  }
}

function fillBand(buf, w, h, x, y0, y1, colA, colB){
  for (let y = y0; y < y1; y++){
    putPx(buf, w, h, x, y, BAYER[x & 1][y & 1] / 4 > 0.5 ? colB : colA);
  }
}

let seed = 1337;
function rnd(){
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function rndAt(x, y){
  const v = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  return (v % 9973) / 9973;
}
function rng(min, max){ return min + rnd() * (max - min); }
