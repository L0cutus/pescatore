function updateAmbient(dt){
  for (const cl of dyn.clouds){
    cl.x += cl.speed * dt;
    if (cl.x > VIEW.w + 90) cl.x = -90;
  }
  for (const b of dyn.birds){
    b.x += b.speed * dt;
    b.flap += dt * 6;
    if (b.x > VIEW.w + 40) b.x = -40;
  }
  for (const bo of dyn.boats){
    bo.x += bo.speed * bo.dir * dt;
    bo.wake -= dt;
    bo.oar += dt * 2.2;
    if (bo.x > VIEW.w - 48) bo.dir = -1;
    if (bo.x < 48) bo.dir = 1;
    const isl = inIsland(bo.x, bo.y, 28);
    if (isl){
      bo.dir = bo.x > isl.x ? 1 : -1;
      bo.x += bo.dir * 8;
    }
    const bb = lakeBounds(bo.x);
    bo.y = Math.max(bb.lt, Math.min(bb.sb, bo.y));
    bo.y = outsidePier(bo.x, bo.y, 12);
    if (bo.wake <= 0){
      bo.wake = 1.6;
      addRipple(bo.x - bo.dir * 18, bo.y + 6, 18, PAL.shimmer);
    }
  }
  for (const d of dyn.dashes){
    d.x += d.speed * dt;
    if (d.x > VIEW.w + 16) d.x = -16;
    if (d.x < -16) d.x = VIEW.w + 16;
  }
  for (const s of dyn.sparkles) s.phase += dt * s.speed * 3;
  for (const fl of dyn.flies){
    fl.phase += dt * 2;
    fl.x += fl.speed * dt;
    if (fl.x > VIEW.w + 12) fl.x = -12;
    if (fl.x < -12) fl.x = VIEW.w + 12;
  }
  for (let i = ripples.length - 1; i >= 0; i--){
    const r = ripples[i];
    r.r += (r.max / 1.6) * dt;
    r.life -= dt / 1.6;
    if (r.life <= 0 || r.r > r.max) ripples.splice(i, 1);
  }
  for (let i = splashes.length - 1; i >= 0; i--){
    const s = splashes[i];
    s.t += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 140 * dt;
    if (s.t > s.life) splashes.splice(i, 1);
  }
}

function update(dt){
  game.t += dt;

  if (game.phase !== 'over'){
    game.left -= dt;
    if (game.left <= 0){
      game.left = 0;
      game.phase = 'over';
      game.fish = null;
      clearHolds();
      for (const f of fish){
        if (f.state !== 'free'){ f.state = 'free'; f.ang = rng(0, 6.28); }
      }
      say('fine giornata: ' + game.score + ' punti, ' + game.caught + ' pescato - premi r');
      chord([392, 523, 659], 120, 0.2);
      musicModeSet('rest');
    }
  }

  for (const f of fish) updateFish(f, dt);

  if (game.phase === 'casting'){
    game.cast.t += dt / 0.55;
    game.rodSwing = Math.min(1, game.cast.t * 1.6);
    const t = Math.min(1, game.cast.t);
    game.bob.x = game.cast.from.x + (game.cast.to.x - game.cast.from.x) * t;
    game.bob.y = game.cast.from.y + (game.cast.to.y - game.cast.from.y) * t - Math.sin(Math.PI * t) * 32;
    if (t >= 1){
      game.phase = 'waiting';
      game.cooldown = rng(0.6, 1.6);
      game.waitTime = 0;
      game.bob.x = game.cast.to.x;
      game.bob.y = game.cast.to.y;
      addRipple(game.bob.x, game.bob.y, 32);
      addSplash(game.bob.x, game.bob.y, 6);
      say('in attesa...');
      beep(300, 0.1, 'sine', 0.05);
    }
  }

  if (game.phase === 'waiting'){
    game.cooldown -= dt;
    game.waitTime += dt;
    if (game.cooldown <= 0 && !game.fish){
      let best = null, bd = game.waitTime > 6 ? 1e9 : 260;
      for (const f of fish){
        if (f.state !== 'free') continue;
        const d = Math.hypot(f.x - game.bob.x, f.y - game.bob.y);
        if (d < bd){ bd = d; best = f; }
      }
      if (best){
        best.state = 'approach';
        best.phase = 0;
        game.fish = best;
        game.cooldown = 0.4;
      } else {
        game.cooldown = 0.8;
      }
    }
    game.bob.dip = Math.sin(game.t * 2.2) * 0.7;
    if (Math.random() < 0.015) addRipple(game.bob.x, game.bob.y, 18);
  }

  if (game.phase === 'bite'){
    game.bite -= dt;
    game.bob.dip = 1 + Math.sin(game.t * 12) * 1.6;
    const tick = Math.floor(game.t * 5);
    if (tick !== game.lastRippleT){
      game.lastRippleT = tick;
      addRipple(game.bob.x, game.bob.y, 20);
    }
    if (game.bite <= 0){
      game.fish.state = 'free';
      game.fish.ang = rng(0, 6.28);
      game.fish = null;
      game.phase = 'waiting';
      game.cooldown = rng(1.4, 3);
      game.waitTime = 0;
      game.bob.dip = 0;
      say('ha mangiato e lasciato');
    }
  }

  if (game.phase === 'reel' && game.fish){
    const st = game.fish.sp.struggle;
    game.burstT -= dt;
    if (game.burstT <= 0){
      game.burst = rnd() < 0.42;
      game.burstT = rng(0.45, 1.3);
    }
    if (game.holding){
      game.dist -= (54 + 14 * (1.7 - st)) * dt;
      game.dist += st * 20 * dt;
      game.tension += (14 + st * 22 + (game.burst ? 30 * st : 0)) * dt;
    } else {
      game.dist += (10 + (game.burst ? 24 * st : 0)) * dt;
      game.tension -= 58 * dt;
    }
    game.tension = Math.max(0, Math.min(100, game.tension));
    game.ang += Math.sin(game.t * 3.4) * (game.burst ? 0.5 : 0.12) * dt;
    const tip = rodTip();
    game.fish.x = Math.max(16, Math.min(VIEW.w - 16, tip.x + Math.cos(game.ang) * game.dist));
    const fb = lakeBounds(game.fish.x);
    game.fish.y = Math.max(fb.lt, Math.min(fb.sb, tip.y + Math.sin(game.ang) * game.dist * 0.75));
    const isl = inIsland(game.fish.x, game.fish.y, 12);
    if (isl){
      const a = Math.atan2(game.fish.y - isl.y, game.fish.x - isl.x);
      game.fish.x = isl.x + Math.cos(a) * (isl.rx + 16);
      game.fish.y = isl.y + Math.sin(a) * (isl.ry + 16);
    }
    const fb2 = lakeBounds(game.fish.x);
    game.fish.y = Math.max(fb2.lt, Math.min(fb2.sb, game.fish.y));
    game.fish.y = outsidePier(game.fish.x, game.fish.y, 6);
    game.bob.x = game.fish.x;
    game.bob.y = game.fish.y;
    if (game.holding && Math.random() < 0.2) addRipple(game.fish.x, game.fish.y, 20);

    game.duckT = (game.duckT || 0) + dt;
    if (game.duckT > 0.2){
      game.duckT = 0;
      musicDuck(1 - game.tension / 220);
    }

    if (game.tension >= 100) loseFish('si e rotta la lenza!');
    else if (game.dist > game.dist0 * 1.35) loseFish('il pesce scappa via');
    else if (game.dist <= 10) landIt();
  }

  if (game.phase === 'landed'){
    if (game.landedFx) game.landedFx.t += dt;
    if (game.landedFx && game.landedFx.t > 1.1){
      const f = game.fish;
      game.fish = null;
      game.landedFx = null;
      game.phase = 'idle';
      const idx = fish.indexOf(f);
      if (idx >= 0) fish.splice(idx, 1);
      fish.push(spawnFish());
      say('lancio: tap o spazio');
    }
  }

  updateAmbient(dt);
  syncHud();
}

const hud = { score: -1, best: -1, caught: -1, clock: -1, tension: -1, dist: -1, logKey: null, cue: null };

function syncHud(){
  if (hud.score !== game.score){ hud.score = game.score; elScore.textContent = game.score; }
  if (hud.best !== game.best){ hud.best = game.best; elBest.textContent = game.best; }
  if (hud.caught !== game.caught){ hud.caught = game.caught; elCaught.textContent = game.caught; }
  const clock = Math.round(Math.max(0, game.left / ROUND * 100));
  if (hud.clock !== clock){ hud.clock = clock; elClock.style.width = clock + '%'; }
  const tens = game.phase === 'reel' ? Math.round(game.tension) : 0;
  if (hud.tension !== tens){
    hud.tension = tens;
    elTension.style.width = tens + '%';
    elTension.style.background = tens > 70 ? '#e0523c' : tens > 45 ? '#ffd27a' : '#3f8ea8';
  }
  const dist = game.phase === 'reel' ? Math.round(Math.max(0, Math.min(100, game.dist / game.dist0 * 100))) : 0;
  if (hud.dist !== dist){ hud.dist = dist; elDist.style.width = dist + '%'; }
  if (!LOW_POWER){
    const key = SPECIES.map(sp => game.log[sp.id] || 0).join('.');
    if (key !== hud.logKey){
      hud.logKey = key;
      elLog.innerHTML = SPECIES
        .filter(sp => game.log[sp.id])
        .map(sp => '<span>' + sp.name + ' <b>' + game.log[sp.id] + '</b> \u00b7 ' + sp.pts + 'pt</span>')
        .join('');
    }
  }
  const cue = game.phase === 'bite' ? 'bite-cue on' : 'bite-cue';
  if (elBite && hud.cue !== cue){ hud.cue = cue; elBite.className = cue; }
}

function drawSurface(){
  const h = Math.max(1, Math.round(SC));
  deviceDraw(ctx, g => {
    for (const d of dyn.dashes){
      const blink = Math.sin(game.t * 1.5 + d.phase);
      g.globalAlpha = 0.22 + 0.22 * Math.max(0, blink);
      pxD(g, Math.round(d.x * SC), Math.round(d.y * SC), Math.round(d.len * SC), h, PAL.shimmer);
    }
    for (const s of dyn.sparkles){
      const blink = Math.sin(s.phase);
      if (blink < 0.2) continue;
      g.globalAlpha = 0.35 + 0.45 * blink;
      pxD(g, Math.round(s.x * SC), Math.round(s.y * SC), Math.round(s.len * SC), h, PAL.sparkle);
    }
    for (const fd of dyn.foam){
      const blink = Math.sin(game.t * 2.4 + fd.phase);
      g.globalAlpha = 0.3 + 0.4 * Math.max(0, blink);
      pxD(g, Math.round(fd.x * SC), Math.round(fd.y * SC), Math.round(fd.len * SC), h, PAL.foam);
    }
  });
  ctx.globalAlpha = 1;
}

function drawFishLayer(){
  for (const f of fish){
    if (f.state === 'landed') continue;
    drawFishCached(ctx, f, f.x, f.y);
    if (f.state === 'bite' || f.state === 'inspect'){
      px(ctx, Math.round(f.x + f.sp.rx), Math.round(f.y), 4, 2, PAL.sparkle);
    }
  }
}

function drawBoats(){
  for (const bo of dyn.boats){
    const bob = Math.sin(game.t * 1.6 + bo.x * 0.025) * 2.4;
    const y = Math.round(bo.y + bob);
    const left = Math.round(bo.x - spriteW(bo.sprite) / 2);
    blitShadow(ctx, bo.x, y + spriteH(bo.sprite) / 2 + 4, spriteW(bo.sprite) * 0.6, 4, PAL.shadowSoft);
    drawSpriteCached(ctx, bo.sprite, left, Math.round(y - spriteH(bo.sprite) / 2), bo.dir < 0);
    if (bo.sprite === BOAT_ROWER){
      const swing = Math.sin(bo.oar) * 6;
      const ox = bo.x + (bo.dir < 0 ? -14 : 14);
      deviceDraw(ctx, g => smoothLine(g, ox, y - 2, ox + bo.dir * 18, y + 8 + swing, PAL.woodHi, 2));
      if (Math.abs(swing) > 5 && Math.random() < 0.12) addRipple(ox + bo.dir * 18, y + 8, 14, PAL.foam);
    }
  }
}

function drawRipples(){
  for (const r of ripples){
    ctx.globalAlpha = Math.max(0, r.life) * 0.55;
    const baked = ringCanvas(r.col, r.r);
    blitHi(ctx, baked, r.x - baked.ax, r.y - baked.ay);
  }
  ctx.globalAlpha = 1;
}

function drawSplashes(){
  const s = Math.max(2, Math.round(SC));
  deviceDraw(ctx, g => {
    for (const sp of splashes){
      g.globalAlpha = Math.max(0, 1 - sp.t / sp.life);
      pxD(g, Math.round(sp.x * SC), Math.round(sp.y * SC), s, s, PAL.foam);
    }
  });
  ctx.globalAlpha = 1;
}

function drawFishing(){
  const tip = rodTip();
  deviceDraw(ctx, g => {
    smoothLine(g, ROD_BASE.x, ROD_BASE.y, tip.x, tip.y, PAL.woodHi, 2);
    smoothLine(g, ROD_BASE.x + 2, ROD_BASE.y + 2, tip.x + 2, tip.y + 2, PAL.woodDark, 2);
  });
  px(ctx, ROD_BASE.x - 2, ROD_BASE.y - 2, 4, 4, PAL.woodShade);

  const active = game.phase === 'casting' || game.phase === 'waiting' || game.phase === 'bite' || game.phase === 'reel';
  if (active){
    const bx = game.bob.x;
    const by = game.bob.y + game.bob.dip;
    const dx = bx - tip.x;
    const dy = by - tip.y;
    const sag = (game.phase === 'reel' ? 8 - (game.tension / 100) * 8 : 20) + Math.hypot(dx, dy) * 0.05;
    deviceDraw(ctx, g => {
      smoothBezier(g, tip.x, tip.y, tip.x + dx / 2, tip.y + dy / 2 + sag, bx, by, PAL.lineDark, 1);
      smoothBezier(g, tip.x, tip.y - 2, tip.x + dx / 2, tip.y + dy / 2 + sag - 2, bx, by - 2, PAL.line, 1);
    });
  }

  blitShadow(ctx, FISHER.x, FISHER.y + 2, 12, 4, PAL.shadowSoft);
  drawSpriteCached(ctx, FISHERMAN, Math.round(FISHER.x - 12), Math.round(FISHER.y - 30), false);
  drawSpriteCached(ctx, FISHERMAN_DETAIL, Math.round(FISHER.x - 12), Math.round(FISHER.y - 30), false);

  if (active){
    const bx = Math.round(game.bob.x);
    const by = Math.round(game.bob.y + game.bob.dip);
    blitShadow(ctx, bx, by + 6, 8, 3, PAL.shadowSoft);
    blitHi(ctx, bobCanvas(), bx - 4, by - 4);
  }

  if (game.landedFx){
    const t = game.landedFx.t;
    const fx = Math.round(game.landedFx.x + t * 14);
    const fy = Math.round(game.landedFx.y - Math.sin(Math.min(1, t / 0.45) * Math.PI) * 14);
    const baked = fishBodyCanvas(game.landedFx.sp, 1, false);
    blitHi(ctx, baked, fx - baked.ax, fy - baked.ay);
    blitShadow(ctx, fx, fy + game.landedFx.sp.ry + 4, game.landedFx.sp.rx * 0.8, 3, PAL.shadowSoft);
  }

  if (game.phase === 'bite'){
    const bx = Math.round(game.bob.x);
    const by = Math.round(game.bob.y);
    deviceDraw(ctx, g => {
      smoothLine(g, bx + 12, by - 22, bx + 12, by - 10, PAL.hudGold, 2);
      smoothEllipse(g, bx + 13, by - 6, 2.6, 2.6, PAL.hudGold);
    });
  }
}

function drawFlies(){
  for (const fl of dyn.flies){
    const y = Math.round(fl.y + Math.sin(fl.phase) * fl.amp);
    const x = Math.round(fl.x);
    if (fl.kind === 'dragon'){
      px(ctx, x, y, 8, 2, '#6f9fb0');
      px(ctx, x + 2, y - 2, 6, 2, '#cfe6ef');
    } else if (fl.kind === 'butterfly'){
      const open = Math.sin(fl.phase * 3) > 0;
      px(ctx, x, y, 2, 2, open ? PAL.flower : PAL.flower2);
      px(ctx, x + 2, y, 2, 2, open ? PAL.flower2 : PAL.flower);
      px(ctx, x + 4, y, 2, 2, '#fff3d6');
    } else {
      px(ctx, x, y, 4, 2, '#5c7b6b');
    }
  }
}

function render(){
  ctx.drawImage(bg, 0, 0);

  for (const tr of dyn.trees){
    const sway = Math.sin(game.t * 0.9 + tr.phase) * (tr.size * 0.06);
    drawTreeCached(ctx, tr.x, tr.y, tr.size, sway);
  }

  ctx.globalAlpha = 0.09;
  for (const cl of dyn.clouds){
    const baked = cloudShadowCanvas(cl.s * 20);
    blitHi(ctx, baked, cl.x - baked.ax, cl.shadowY - baked.ay);
  }
  ctx.globalAlpha = 1;

  drawFishLayer();
  drawSurface();
  drawBoats();
  drawRipples();
  drawSplashes();
  drawFishing();

  for (const cl of dyn.clouds){
    const s = Math.round(cl.s * 20);
    const baked = cloudCanvas(s);
    blitHi(ctx, baked, cl.x - baked.ax, cl.y - baked.ay);
  }
  for (const b of dyn.birds){
    drawSpriteCached(ctx, BIRD, Math.round(b.x), Math.round(b.y) + (Math.sin(b.flap) > 0 ? 0 : 2), false);
  }

  drawFlies();

  if (game.phase === 'over'){
    ctx.globalAlpha = 0.75;
    px(ctx, 240, 216, 480, 108, PAL.hudPanel);
    ctx.globalAlpha = 1;
    px(ctx, 240, 216, 480, 2, PAL.hudGold);
    px(ctx, 240, 322, 480, 2, PAL.hudGold);
    ctx.fillStyle = PAL.hudGold;
    ctx.font = '22px ui-monospace, monospace';
    ctx.fillText('FINE GIORNATA', 264, 248);
    ctx.fillStyle = PAL.hudInk;
    ctx.font = '20px ui-monospace, monospace';
    ctx.fillText('punti ' + game.score + '   pescato ' + game.caught, 264, 276);
    ctx.fillStyle = PAL.hudDim;
    ctx.font = '18px ui-monospace, monospace';
    ctx.fillText('record ' + game.best + '   [r] nuova giornata', 264, 302);
  }
}

seed = 20260721;
const bg = buildBackground();
const dyn = buildDynamic();
say('giornata estiva: tap o spazio per lanciare');

let last = performance.now();
function frame(now){
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden){
    stopMusic();
  } else {
    last = performance.now();
    if (audioOn) startMusic();
  }
});
