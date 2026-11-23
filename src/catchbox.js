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
  const JOKES = { stivale: 'non è un pesce: è uno stivale. +5 alla spazzatura' };

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

  // tinte della specie per il box: corpo nel colore di SPECIES, dorso scuro, pancia chiara,
  // pinne più scure del corpo. Il pesce nel gioco è la sagoma subacquea (fishBodyCanvas, mixato
  // verso waterDeep): qui serve una versione colorata e dettagliata.
  function tint(sp){
    return {
      col: sp.col,
      shade: mix(sp.col, '#1d2b36', 0.28),
      dark: mix(sp.col, '#1d2b36', 0.55),
      belly: mix(sp.col, '#f3e8cd', 0.5),
      light: mix(sp.col, '#eef4f6', 0.55),
      fin: mix(sp.col, '#16232c', 0.62)
    };
  }

  // disegna un rettangolo in pixel-di-mondo come blocchi di b pixel device: b è intero, così le
  // righe restano uniformi (con il blit a scala frazionaria i dettagli da 1 px si perdevano).
  // Con dir < 0 la x è specchiata, quindi la stessa specie guarda a sinistra.
  function blocks(g, dir, b, ox, oy){
    return (x, y, w, h, col) => {
      const bx = dir < 0 ? -(x + w) : x;
      g.fillStyle = col;
      g.fillRect(ox + Math.round(bx * b), oy + Math.round(y * b),
        Math.max(1, Math.round(w * b)), Math.max(1, Math.round(h * b)));
    };
  }

  function paintFish(g, sp, dir, b, ox, oy){
    const t = tint(sp), rx = sp.rx, ry = sp.ry, P = blocks(g, dir, b, ox, oy);
    const ryI = Math.ceil(ry);
    // ombra sull'acqua
    P(-rx * 0.85, ry + 0.8, rx * 1.7, 1.2, 'rgba(12,28,40,0.35)');
    // corpo: file ellittiche, dorso scuro e pancia chiara
    for (let yy = -ryI; yy <= ryI; yy++){
      const u = yy / ry;
      const hw = rx * Math.sqrt(Math.max(0, 1 - u * u));
      if (hw < 0.5) continue;
      const col = yy <= -ryI + 1 ? t.shade : yy >= ryI - 1 ? t.belly : t.col;
      P(-hw, yy, hw * 2, 1, col);
    }
    // coda a forca: due lobi che si allargano dietro il corpo
    for (let d = 0; d < 4; d++){
      const x = -rx - d * 1.5;
      const h = ry * (0.5 + d * 0.32);
      P(x, -h, 1.6, h - ry * 0.22, t.fin);
      P(x, ry * 0.22, 1.6, h - ry * 0.22, t.fin);
    }
    // pinna dorsale e pinna laterale
    P(-rx * 0.25, -ry - 2.2, rx * 0.55, 2.2, t.fin);
    P(rx * 0.3, ry * 0.5, rx * 0.35, 2, t.fin);
    // occhio: bianco + pupilla
    P(rx * 0.62, -ry * 0.5, 2.2, 2.2, '#f7f4e8');
    P(rx * 0.78, -ry * 0.42, 1, 1.4, '#1a232b');
    // bocca
    P(rx * 0.92, ry * 0.12, 1.6, 1, t.dark);
    // segni propri della specie
    if (sp.id === 'persico'){
      for (let i = 0; i < 4; i++) P(-rx * 0.55 + i * rx * 0.34, -ry * 0.75, 1.4, ry * 1.5, t.dark);
    } else if (sp.id === 'trota'){
      for (let i = 0; i < 5; i++) P(-rx * 0.6 + i * rx * 0.3, -ry * 0.2 + (i % 2) * ry * 0.35, 1, 1, t.light);
    } else if (sp.id === 'storione'){
      // scudi lungo il dorso e muso allungato
      for (let i = 0; i < 6; i++) P(-rx * 0.75 + i * rx * 0.3, -ry + 0.2, 1.4, 1.4, t.light);
      P(rx, -ry * 0.35, 3, ry * 0.7, t.col);
      P(rx + 3, -ry * 0.2, 2, ry * 0.5, t.shade);
    } else if (sp.id === 'carpa'){
      P(-rx * 0.3, -ry * 0.85, rx * 0.8, 1, t.dark);
      P(rx * 0.55, ry * 0.3, 1.4, 1, t.dark);   // barbiglio
    } else if (sp.id === 'tinca'){
      P(-rx * 0.7, -ry * 0.85, rx * 1.4, 1.2, t.dark);
    }
  }

  // stivale: gambale + orlo + lacci + piede + punta + suola + tacco. Disegnato più grande della
  // misura di mondo (rx 8, ry 8): a quella scala nel box era un "L" di 13 px, non si capiva
  function paintBoot(g, sp, b, ox, oy){
    const P = blocks(g, 1, b, ox, oy);
    const leather = mix(sp.col, '#c9a27a', 0.35);
    const dark = mix(sp.col, '#12191f', 0.5);
    const sole = mix(sp.col, '#0d1317', 0.72);
    const rim = mix(sp.col, '#e9d6b8', 0.55);
    const lace = '#d8c9a4';
    // gambale
    P(-8, -16, 12, 18, leather);
    P(-8, -16, 12, 3.2, rim);           // orlo chiaro
    P(-8, -12.8, 2.4, 14.8, dark);      // bordo posteriore scuro
    P(2.6, -12.8, 2.4, 14.8, dark);     // bordo anteriore scuro
    P(-4, -10.8, 8, 2, lace);           // lacci
    P(-4, -6.4, 8, 2, lace);
    P(-4, -2.6, 8, 2, lace);
    P(-6.4, -8.6, 2, 2, '#8b6b4f');     // occhiello
    // piede
    P(-8, 2, 18, 6, leather);
    P(8, 2, 6, 6, mix(sp.col, '#c9a27a', 0.55));   // punta più chiara
    P(-8, 2, 4, 5.6, dark);            // bordo sotto il gambale
    P(-10, 8.2, 24, 3.4, sole);        // suola
    P(-10, 8.2, 24, 1.2, mix(sole, '#e9d6b8', 0.22));  // bordo della suola
    P(12.8, 8.2, 4, 3.4, mix(sole, '#e9d6b8', 0.25));  // tacco
    P(-11, 11.8, 26, 2.4, 'rgba(12,28,40,0.35)');      // ombra sull'acqua
  }

  function drawArt(box){
    if (!artCtx) return;
    const stivale = box.sp.id === 'stivale';
    // il pesce si gira di tanto in tanto (la coda batte nel disegno girato); lo stivale sta fermo
    const t = box.t;
    const dir = stivale ? 1 : (Math.floor(t / 1.5) % 2 === 0 ? 1 : -1);
    // misura del disegno: per i pesci le stesse di fishBodyCanvas (corpo + coda + ombra), per lo
    // stivale la sua sagoma ingrandita (x da -11 a +18.8, y da -16 a +14.2)
    const lw = stivale ? 30 : Math.ceil(box.sp.rx * 1.7) + 6 + Math.ceil(box.sp.rx * 1.7) + 6;
    const lh = stivale ? 32 : Math.ceil(box.sp.ry * 2.2) + 8 + Math.ceil(box.sp.ry * 2.2) + 8;
    // blocco di pixel: E è pixel-showing per pixel-di-mondo (pixel CSS), moltiplicato per dpr e
    // arrotondato a intero; il cap impedisce che il disegno esca dal canvas del box
    const E = Math.min(2.8, Wcss * 0.92 / lw, Hcss * 0.88 / lh);
    const b = Math.max(1, Math.min(
      Math.round(E * dpr),
      Math.floor(Wdev / lw),
      Math.floor(Hdev / lh)
    ));
    const sway = stivale ? 0 : Math.sin(t * 3.1) * 2.2;
    const bob = stivale ? 0 : Math.sin(t * 4.2) * 1.2;
    // il disegno è centrato sull'origine (le coordinate vanno da -rx/2 a +rx/2 e da -ry-4 a +ry+4),
    // quindi ox/oy sono il CENTRO del canvas: usarli come bordo sinistro mandava il pesce in alto
    // a sinistra (vedi out-box/desktop-dpr2/03-storione.png del primo run)
    const ox = Math.round(Wdev / 2 + sway * b);
    const oy = Math.round(Hdev / 2 + bob * b);
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
    if (stivale) paintBoot(artCtx, box.sp, b, ox, oy);
    else paintFish(artCtx, box.sp, dir, b, ox, oy);
  }

  function texts(box){
    const key = box.sp.id + ':' + box.pts;
    if (key === shownKey) return;
    shownKey = key;
    nameEl.textContent = box.sp.name;
    // il "+N" è quello che il punteggio ha davvero incassato: la base della specie e il bonus
    // combo sono scritti accanto, così 78 non sembra 60 × 3 (il bonus è +0.15 per combo, non ×combo)
    ptsEl.textContent = '+' + box.pts
      + (box.bonus > 0 ? ' · base ' + box.base + ' · bonus +' + box.bonus : ' · base ' + box.base);
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
