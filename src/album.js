// Album delle catture: pannello modale con il disegno (come nel box), quante ne hai prese
// in totale e il record di peso con la data, per ogni specie. Specie mai prese → sagoma scura
// con "???". Niente DOM a livello di modulo: si disattiva negli stub Node (come catchbox.js).
// negli stub Node gli elementi non hanno getContext/classList/appendChild: si disattiva (come catchbox.js)
// l'intero blocco è incapsulato in un IIFE, così le funzioni interne (render, tick, ...) non
// ereditano il global scope e coprono accidentalmente il render() del gioco
(function(){
  const albumEl = document.getElementById('album');
  const albumGrid = document.getElementById('albumGrid');
  const albumCloseBtn = document.getElementById('albumClose');

  if (!albumEl || !albumGrid || !albumEl.classList || typeof albumEl.appendChild !== 'function') {
    // niente album nei test a stub: la logica (conteggio/record) resta in game.js
    return;
  }
  const cardEls = [];   // { canvas, nameEl, countEl, recEl, sp }

  function dprCap(){ return Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1); }

  function buildCard(sp){
    const card = document.createElement('div');
    card.className = 'album-card';
    const art = document.createElement('canvas');
    art.className = 'album-art';
    const nameEl = document.createElement('div');
    nameEl.className = 'album-name';
    const countEl = document.createElement('div');
    countEl.className = 'album-count';
    const recEl = document.createElement('div');
    recEl.className = 'album-rec';
    card.appendChild(art);
    card.appendChild(nameEl);
    card.appendChild(countEl);
    card.appendChild(recEl);
    albumGrid.appendChild(card);
    return { canvas: art, nameEl, countEl, recEl, sp };
  }

  function sizeCardCanvas(canvas){
    const dpr = dprCap();
    const w = Math.max(1, canvas.clientWidth || 96);
    const h = Math.max(1, canvas.clientHeight || 60);
    const Wdev = Math.round(w * dpr), Hdev = Math.round(h * dpr);
    if (canvas.width !== Wdev) canvas.width = Wdev;
    if (canvas.height !== Hdev) canvas.height = Hdev;
    const g = canvas.getContext('2d');
    if (g) g.imageSmoothingEnabled = false;
    return { g, Wdev, Hdev, Wcss: w, Hcss: h, dpr };
  }

  function renderAlbum(){
    // si ricrea il griglia a ogni aperture/cambio: è piccolo (6 schede) e locale
    albumGrid.innerHTML = '';
    cardEls.length = 0;
    const d = (typeof game !== 'undefined' && game.albumData) ? game.albumData : { counts: {}, records: {} };
    for (const sp of SPECIES){
      const card = buildCard(sp);
      cardEls.push(card);
    }
    for (const card of cardEls){
      const sp = card.sp;
      const count = d.counts[sp.id] || 0;
      const rec = d.records[sp.id];
      const silhouette = count <= 0;
      const { g, Wdev, Hdev, Wcss, Hcss, dpr } = sizeCardCanvas(card.canvas);
      if (g) drawSpeciesArt(g, Wdev, Hdev, Wcss, Hcss, dpr, sp, { silhouette });
      if (silhouette){
        card.nameEl.textContent = '???';
        card.countEl.textContent = 'mai presa';
        card.recEl.textContent = '';
        card.canvas.classList.add('album-silhouette');
      } else {
        card.nameEl.textContent = sp.name;
        card.countEl.textContent = '×' + count + (count === 1 ? ' presa' : ' prese');
        card.recEl.textContent = sp.id === 'stivale'
          ? 'taglia ' + sp.taglia + ' (scherzosa)'
          : (rec ? 'record ' + fmtKg(rec.w) + ' · ' + fmtDate(rec.date) : 'record —');
      }
    }
  }

  function setOpen(on){
    if (on === undefined) return;
    if (on === albumElOpen) return;
    albumElOpen = on;
    albumEl.className = on ? 'album on' : 'album';
    albumEl.setAttribute('aria-hidden', on ? 'false' : 'true');
    // i bottoni galleggianti (desktop/telefono) restano dietro il modale: li nasconde
    if (document.body && typeof document.body.classList === 'object' && typeof document.body.classList.toggle === 'function') {
      document.body.classList.toggle('album-open', on);
    }
    if (on) renderAlbum();
  }

  let albumElOpen = false;

  function closeAlbum(){ game.album = null; }

  // tap sulla backdrop chiude l'album (il tap non deve lanciare: il pannello copre il
  // canvas ed è pointer-events:auto, il canvas non lo vede mai). Il target esplicito
  // evita di chiudere quando si scorre la griglia o si tocca il pannello: quelle
  // superfici non chiudono, solo la backdrop scura e il pulsante "chiudi".
  // Il pointerdown (come gli altri bottoni del gioco) è anche l'unico evento che il
  // harness CDP può sintetizzare: il click non viene sintetizzato in headless.
  albumEl.addEventListener('pointerdown', e => {
    if (e.target !== albumEl) return;
    e.preventDefault();
    e.stopPropagation();
    closeAlbum();
  });
  if (albumCloseBtn) albumCloseBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); closeAlbum(); });

  function tick(){
    if (game.album){
      setOpen(true);
      if (!albumEl.offsetParent){
        // in verticale il pannello è display:none (l'invito a ruotare c'è già): lo chiuso qui,
        // così il tap dopo l'apertura non "ingoia" nulla e il timer riparte
        setOpen(false);
        game.album = null;
      }
    } else {
      setOpen(false);
    }
    requestAnimationFrame(tick);
  }
  setOpen(false);
  requestAnimationFrame(tick);
  window.addEventListener('resize', () => { if (game.album) renderAlbum(); });
})();
