// Pixel art colorata delle catture, condivisa dal box della cattura (src/catchbox.js)
// e dal pannello album (src/album.js). Niente DOM a livello di modulo: è chiamato solo
// da contesto dove esiste un canvas vero (catchbox/album disattivano da soli negli stub Node).
// Niente stile inline: i colori arrivano da mix() di palette.js.

function speciesArtDims(sp){
  if (sp.id === 'stivale') return { lw: 30, lh: 32 };
  return {
    lw: Math.ceil(sp.rx * 1.7) + 6 + Math.ceil(sp.rx * 1.7) + 6,
    lh: Math.ceil(sp.ry * 2.2) + 8 + Math.ceil(sp.ry * 2.2) + 8
  };
}

// tinte della specie per il disegno: corpo nel colore di SPECIES, dorso scuro, pancia chiara,
// pinne più scure del corpo. In sagoma (silhouette) tutto è nero-azzurro: si vede la forma
// ma non i dettagli — è ciò che appare nell'album per le specie mai pescate.
function speciesArtTint(sp, silhouette){
  if (silhouette){
    return { col: '#26333e', shade: '#1d2831', dark: '#141c23', belly: '#2e3d49', light: '#2e3d49', fin: '#10171d' };
  }
  return {
    col: sp.col,
    shade: mix(sp.col, '#1d2b36', 0.28),
    dark: mix(sp.col, '#1d2b36', 0.55),
    belly: mix(sp.col, '#f3e8cd', 0.5),
    light: mix(sp.col, '#eef4f6', 0.55),
    fin: mix(sp.col, '#16232c', 0.62)
  };
}

// disegna un rettangolo in pixel-di-mondo come blocchi di b pixel device: b è intero, così
// le righe restano uniformi. Con dir < 0 la x è specchiata, quindi la stessa specie guarda a sinistra.
function speciesArtBlocks(g, dir, b, ox, oy){
  return (x, y, w, h, col) => {
    const bx = dir < 0 ? -(x + w) : x;
    g.fillStyle = col;
    g.fillRect(ox + Math.round(bx * b), oy + Math.round(y * b),
      Math.max(1, Math.round(w * b)), Math.max(1, Math.round(h * b)));
  };
}

function paintSpeciesFish(g, sp, dir, b, ox, oy, silhouette){
  const t = speciesArtTint(sp, silhouette), rx = sp.rx, ry = sp.ry, P = speciesArtBlocks(g, dir, b, ox, oy);
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
function paintSpeciesBoot(g, sp, b, ox, oy, silhouette){
  const P = speciesArtBlocks(g, 1, b, ox, oy);
  if (silhouette){
    const leather = '#26333e', dark = '#141c23', sole = '#0d1318', rim = '#2b3946', lace = '#222d36';
    // gambale
    P(-8, -16, 12, 18, leather);
    P(-8, -16, 12, 3.2, rim);
    P(-8, -12.8, 2.4, 14.8, dark);
    P(2.6, -12.8, 2.4, 14.8, dark);
    P(-4, -10.8, 8, 2, lace);
    P(-4, -6.4, 8, 2, lace);
    P(-4, -2.6, 8, 2, lace);
    P(-6.4, -8.6, 2, 2, dark);
    // piede
    P(-8, 2, 18, 6, leather);
    P(8, 2, 6, 6, rim);
    P(-8, 2, 4, 5.6, dark);
    P(-10, 8.2, 24, 3.4, sole);
    P(-10, 8.2, 24, 1.2, rim);
    P(12.8, 8.2, 4, 3.4, sole);
    P(-11, 11.8, 26, 2.4, 'rgba(12,28,40,0.35)');
    return;
  }
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

// Disegna una cattura in un canvas: acqua scura con riflessi, poi la specie.
// opts: { t, dir, sway, bob, silhouette } — sway/bob/dir sono per l'animazione del box;
// l'album chiama la stessa funzione con dir:1 e sway/bob a 0: stesso disegno, fermo.
// Il disegno è centrato sul canvas (Wdev/Hdev), come nel box del gioco.
function drawSpeciesArt(artCtx, Wdev, Hdev, Wcss, Hcss, dpr, sp, opts){
  opts = opts || {};
  const silhouette = !!opts.silhouette;
  const stivale = sp.id === 'stivale';
  const t = opts.t || 0;
  const dir = stivale ? 1 : (opts.dir !== undefined ? opts.dir : (Math.floor(t / 1.5) % 2 === 0 ? 1 : -1));
  const dims = speciesArtDims(sp);
  // blocco di pixel: E è pixel-css per pixel-di-mondo, moltiplicato per dpr e arrotondato a intero;
  // il cap impedisce che il disegno esca dal canvas (stessa formula del box del gioco)
  const E = Math.min(2.8, Wcss * 0.92 / dims.lw, Hcss * 0.88 / dims.lh);
  const b = Math.max(1, Math.min(Math.round(E * dpr), Math.floor(Wdev / dims.lw), Math.floor(Hdev / dims.lh)));
  const sway = stivale ? 0 : (typeof opts.sway === 'number' ? opts.sway : Math.sin(t * 3.1) * 2.2);
  const bob = stivale ? 0 : (typeof opts.bob === 'number' ? opts.bob : Math.sin(t * 4.2) * 1.2);
  const ox = Math.round(Wdev / 2 + sway * b);
  const oy = Math.round(Hdev / 2 + bob * b);
  artCtx.clearRect(0, 0, Wdev, Hdev);
  // acqua scura ma più calda del pannello: le specie grigie (trota, storione) staccano bene
  artCtx.fillStyle = silhouette ? '#16232c' : '#22587a';
  artCtx.fillRect(0, 0, Wdev, Hdev);
  if (!silhouette){
    artCtx.fillStyle = 'rgba(233,241,244,0.16)';
    for (let i = 0; i < 3; i++){
      const yy = Math.round(Hdev * (0.16 + i * 0.3));
      artCtx.fillRect(Math.round(Wdev * 0.08), yy, Math.round(Wdev * 0.34), Math.max(1, Math.round(dpr)));
      artCtx.fillRect(Math.round(Wdev * 0.58), Math.round(yy + dpr), Math.round(Wdev * 0.3), Math.max(1, Math.round(dpr)));
    }
  }
  if (stivale) paintSpeciesBoot(artCtx, sp, b, ox, oy, silhouette);
  else paintSpeciesFish(artCtx, sp, dir, b, ox, oy, silhouette);
}
