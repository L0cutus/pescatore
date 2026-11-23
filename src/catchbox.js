// Passo 4: box "pesce catturato" centrato a schermo. Script dedicato (CSP: niente stile inline).
// Il disegno è pixel art colorata (src/fishart.js, condivisa col pannello album): la animazione
// e' nel DOM (canvas #catchart), il canvas del gioco non viene toccato.
// negli stub Node (to-be-deleted-after-use/) gli elementi non hanno getContext: si disattiva
// l'intero blocco è incapsulato in un IIFE, così le funzioni interne (tick, setOpen, sizeArt, ...)
// non ereditano il global scope e non coprono accidentalmente il render() del gioco
(function(){
  const boxEl = document.getElementById('catchbox');
  const artEl = document.getElementById('catchart');
  const nameEl = document.getElementById('catchname');
  const ptsEl = document.getElementById('catchpts');
  const noteEl = document.getElementById('catchnote');
  const recordEl = document.getElementById('catchrecord');

  if (!boxEl || !artEl || typeof artEl.getContext !== 'function') {
    // niente box nei test a stub: la logica resta in game.js/render.js (timer e chiusura)
    return;
  }
  const JOKES = { stivale: 'non è un pesce: è uno stivale. +5 alla spazzatura' };

  let artCtx = null;
  let Wdev = 0, Hdev = 0, Wcss = 160, Hcss = 100, dpr = 1;
  let shownKey = null;   // 'specie:punti:peso:record' dell'ultimo box mostrato

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

  function drawArt(box){
    if (!artCtx) return;
    drawSpeciesArt(artCtx, Wdev, Hdev, Wcss, Hcss, dpr, box.sp, { t: box.t });
  }

  function texts(box){
    const key = box.sp.id + ':' + box.pts + ':' + (box.weight === null ? 'taglia' : box.weight) + ':' + (box.isRecord ? 'r' : '-');
    if (key === shownKey) return;
    shownKey = key;
    const name = box.sp.name + (box.weight !== null ? ' · ' + fmtKg(box.weight) : ' · taglia ' + box.taglia);
    nameEl.textContent = name;
    // il "+N" è quello che il punteggio ha davvero incassato: base (specie × fattore peso) e
    // bonus combo sono scritti accanto, così 78 non sembra 60 × 3
    const parts = ['+' + box.pts, 'base ' + box.base];
    if (box.weight !== null && box.factor !== 1) parts.push('peso ×' + box.factor.toFixed(2).replace('.', ','));
    if (box.bonus > 0) parts.push('bonus +' + box.bonus);
    ptsEl.textContent = parts.join(' · ');
    noteEl.textContent = JOKES[box.sp.id] || '';
    if (recordEl) recordEl.className = box.isRecord ? 'catch-record on' : 'catch-record';
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
})();
