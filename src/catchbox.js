// Passo 4: box "pesce catturato" centrato a schermo. Script dedicato (CSP: niente stile inline).
// Il disegno riusa lo sprite gia' cotto fishBodyCanvas(), ingrandito con smoothing spento:
// la animazione e' nel DOM (canvas #catchart), il canvas del gioco non viene toccato.
const boxEl = document.getElementById('catchbox');
const artEl = document.getElementById('catchart');
const nameEl = document.getElementById('catchname');
const ptsEl = document.getElementById('catchpts');
const noteEl = document.getElementById('catchnote');

// negli stub Node (to-be-deleted-after-use/) gli elementi non hanno getContext: si disattiva
if (!boxEl || !artEl || typeof artEl.getContext !== 'function') {
  // niente box nei test a stub: la logica resta in game.js/render.js (timer e chiusura)
} else {
  const JOKES = { stivale: 'non è un pesce: è un stivale. +5 alla spazzatura' };

  let artCtx = null;
  let Wdev = 0, Hdev = 0, Wcss = 160, Hcss = 100, dpr = 1;
  let shownKey = null;   // 'specie:punti' dell'ultimo box mostrato

  function sizeArt(){
    dpr = Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1);
    const w = Math.max(1, artEl.clientWidth || 160);
    const h = Math.max(1, artEl.clientHeight || 100);
    Wcss = w;
    Hcss = h;
    Wdev = Math.round(w * dpr);
    Hdev = Math.round(h * dpr);
    if (artEl.width !== Wdev) artEl.width = Wdev;
    if (artEl.height !== Hdev) artEl.height = Hdev;
    if (!artCtx) artCtx = artEl.getContext('2d');
    // assegnare width/height riporta il contesto ai valori di default: lo smoothing va spento ogni volta
    artCtx.imageSmoothingEnabled = false;
  }

  let open = false;
  function setOpen(on){
    if (on === open) return;
    open = on;
    boxEl.className = on ? 'catchbox on' : 'catchbox';
    if (!on) shownKey = null;   // il testo si riscrive al riaprirsi
    boxEl.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  // variante del sprite per il box: stesso disegno di fishBodyCanvas, colore schiarito
  // verso PAL.line e alpha 1 (sul fondo scuro del pannello la specie pallida non si leggeva)
  function boxFishCanvas(sp, dir){
    const rx = sp.rx, ry = sp.ry;
    const ax = Math.ceil(rx * 1.7) + 6;
    const ay = Math.ceil(ry * 2.2) + 8;
    const w = ax + Math.ceil(rx * 1.7) + 6;
    const h = ay + Math.ceil(ry * 2.2) + 8;
    return bakeHi('boxfish:' + sp.id + ':' + (dir < 0 ? 'L' : 'R'), w, h, (g, c) => {
      smoothEllipse(g, ax + 2, ay + 4, rx * 0.9, ry * 0.8, 'rgba(15,35,48,0.35)');
      smoothFishBody(g, ax, ay, rx, ry, dir, mix(sp.col, PAL.line, 0.35), 1);
      c.ax = ax;
      c.ay = ay;
    });
  }

  function drawArt(box){
    if (!artCtx) return;
    const stivale = box.sp.id === 'stivale';
    // il pesce si gira di tanto in tanto (il "battito" della coda e' nel sprite girato);
    // lo stivale sta fermo
    const t = box.t;
    const dir = stivale ? 1 : (Math.floor(t / 1.5) % 2 === 0 ? 1 : -1);
    const baked = boxFishCanvas(box.sp, dir);
    // ingrandimento rispetto alla misura di mondo, limitato dal canvas del box: si calcola sui
    // pixel CSS (E = pixel-showing per pixel-di-mondo) e si moltiplica per dpr solo nel disegno,
    // cosi' lo stesso pesce ha la stessa dimensione visibile su dpr1 e dpr2 e non esce dal canvas
    const E = Math.min(2.8, Wcss * 0.92 / baked.lw, Hcss * 0.88 / baked.lh);
    const dw = Math.max(1, Math.round(baked.lw * E * dpr));
    const dh = Math.max(1, Math.round(baked.lh * E * dpr));
    const sway = stivale ? 0 : Math.sin(t * 3.1) * 2.2;
    const bob = stivale ? 0 : Math.sin(t * 4.2) * 1.2;
    artCtx.clearRect(0, 0, Wdev, Hdev);
    // piccolo specchio d'acqua dentro il box: lo sprite e' pensato sul lago, sul pannello
    // scuro (col mixato verso waterDeep + alpha 0.75) quasi non si vedeva
    // acqua scura ma piu' calda del pannello: le specie grigie (trota, storione) staccano bene
    artCtx.fillStyle = '#22587a';
    artCtx.fillRect(0, 0, Wdev, Hdev);
    artCtx.fillStyle = 'rgba(233,241,244,0.16)';
    for (let i = 0; i < 3; i++){
      const yy = Math.round(Hdev * (0.16 + i * 0.3));
      artCtx.fillRect(Math.round(Wdev * 0.08), yy, Math.round(Wdev * 0.34), Math.max(1, Math.round(dpr)));
      artCtx.fillRect(Math.round(Wdev * 0.58), Math.round(yy + dpr), Math.round(Wdev * 0.3), Math.max(1, Math.round(dpr)));
    }
    const x = Math.round((Wdev - dw) / 2 + sway * dpr);
    const y = Math.round((Hdev - dh) / 2 + bob * dpr);
    artCtx.drawImage(baked, x, y, dw, dh);
  }

  function texts(box){
    const key = box.sp.id + ':' + box.pts;
    if (key === shownKey) return;
    shownKey = key;
    nameEl.textContent = box.sp.name;
    ptsEl.textContent = '+' + box.pts + (game.combo > 1 ? ' · combo x' + game.combo : '');
    noteEl.textContent = JOKES[box.sp.id] || '';
  }

  function tick(){
    if (game.box){
      // si apre PRIMA di leggere offsetParent: da chiuso il box è display:none e offsetParent è
      // null sempre, quindi il controllo fatto prima chiudeva il box appena nato (il box non
      // compariva mai). In verticale il box resta display:none anche con .on, e lì si chiude
      // subito: il tap dopo la cattura non "ingoia" un box che non si vede (timer ripartito)
      setOpen(true);
      if (!boxEl.offsetParent){
        setOpen(false);
        game.box = null;
      } else {
        if (!shownKey) sizeArt();
        texts(game.box);
        drawArt(game.box);
      }
    } else {
      setOpen(false);
    }
    requestAnimationFrame(tick);
  }
  setOpen(false);
  requestAnimationFrame(tick);
  window.addEventListener('resize', () => { if (game.box) sizeArt(); });
}
