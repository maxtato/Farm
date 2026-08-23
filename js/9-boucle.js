"use strict";
// ---------- boucle ----------
const clock = new THREE.Clock();
let jbx=0,jbvx=0,jbz=0,jbvz=0;
const JK=40, JD=3.1;
const elCoins=document.getElementById('coins'), elStock=document.getElementById('stock'),
      elClock=document.getElementById('clock'), elWIcon=document.getElementById('wIcon'),
      elLvl=document.getElementById('lvl'), elGauge=document.getElementById('gauge'),
      elGVal=document.getElementById('gval'), chipLvl=document.getElementById('chipLvl');

let saveT = 0, lastCoins = -1, lastLvl = 0;
(function boot(){
  const had = restore();
  applyCrop();
  if (had && stage > 0) primeField(stage);   // on reprend la parcelle telle que l'étape la suppose
  // Toute la flotte est là dès le lancement, rangée sur la cour à côté du hangar. On ne la
  // découvre plus au fur et à mesure : les cinq engins attendent, on prend celui qu'on veut.
  // Première partie : la parcelle n'a jamais été touchée — c'est une friche, avec ses
  // repousses sèches, pas le chaume d'une moisson qu'on n'a pas faite.
  if (!had){ for(let k=0;k<plants.length;k++) plants[k].r = 2; redrawPlants(); }
  startStage();                              // ni remise à nu ni semence : c'est l'affaire du cycle
  // On conduit l'engin du chantier s'il existe, sinon le premier du parc ; et si le parc
  // est vide, le bouton du bas mène droit à la boutique.
  { const w = engins.find(v => v.metier === STAGES[stage].k) || engins[0];
    if (w) driven = w.pid; }
  syncFleet(); drawVeh(); camFollow();
  { const v = pilote(); if (v) camLook.set(v.pos.x, 1, v.pos.z); }
  applyCtrl();
  if (!contract) newContract(); else drawContract();
  if (!had) setTimeout(() => openPanel('help'), 400);   // première partie : on montre les commandes
})();

(function loop(){
  requestAnimationFrame(loop);
  const tick = Math.min(clock.getDelta(), .05), now = clock.getElapsedTime();
  const raw = paused ? 0 : tick, dt = raw*SPEED;
  UW.t.value = now;
  if (!paused) readKeys();

  // --- journée, météo, lumière
  weatherTick(dt);
  dayT += dt/DAYLEN;
  while (dayT >= 1){ dayT -= 1; day++; }
  const sk = skyAt(dayT);
  nightK = sk.nuit;
  scene.background.setHex(sk.sky).multiplyScalar(.62 + .38*curDim);
  hemi.color.setHex(sk.hs); hemi.groundColor.setHex(sk.hg);
  hemi.intensity = sk.hi*(.7 + .3*curDim);
  sun.color.setHex(sk.sc); sun.intensity = sk.si*(.45 + .55*curDim);
  const glow = Math.max(nightK, 1 - curDim*1.05);          // phares : la nuit et sous l'averse

  jbvx += (-JK*jbx - JD*jbvx)*raw + (Math.sin(now*1.6)*.5 + Math.sin(now*2.7)*.3)*raw;
  jbvz += (-JK*jbz - JD*jbvz)*raw + (Math.sin(now*1.35+1.4)*.42)*raw;
  jbx = Math.max(-.28,Math.min(.28,jbx+jbvx*raw)); jbz = Math.max(-.28,Math.min(.28,jbz+jbvz*raw));
  UJ.bend.value.set(jbx,0,jbz);
  const flash = Math.max(0, Math.sin(now*6.2))**3;
  [worker, hauler].forEach(v => {
    if (!v) return;
    (v.g.userData.beacons||[]).forEach(b => b.material.emissive.setRGB(flash, flash*.42, 0));
    (v.g.userData.lamps||[]).forEach(m => m.material.emissive.setRGB(glow, glow*.9, glow*.62));
  });

  const S = STAGES[stage];
  syncFleet();

  // Toute la flotte roule, pas seulement l'engin conduit : chacun suit son tracé ou son
  // point d'arrivée, et celui du chantier reprend le pilote automatique s'il n'a rien d'autre.
  for (let i=0;i<engins.length;i++){
    const v = engins[i];
    driveOne(v, v.pid === driven, v.metier === S.k, dt);
  }
  // Et chacun travaille avec son propre outil, là où il passe. Un engin qu'on a laissé sur
  // un tracé continue donc son chantier pendant qu'on en conduit un autre.
  for (let i=0;i<engins.length;i++){
    const v = engins[i];
    // seul un engin qui porte un outil de travail laboure, sème ou fauche : un tracteur
    // attelé d'une benne roule sans rien poser au sol
    if (v.metier && v.speed > .12) work(v, dt);
  }
  engins.forEach(v => { if (v.metier === 'harvest' && v.g.userData.fill)
    v.g.userData.fill.scale.y = .02 + v.hop/CAP*.98; });

  // pousse continue
  let ripe = 0, sown = 0, gsum = 0;
  const growK = dt*GROWK*crop().grow, rainK = curRain*.009;
  for(let k=0;k<plants.length;k++){
    const p = plants[k], t = cell[p.ti];
    if (p.g > 0){ sown++; gsum += p.g; }
    if (t >= 2 && p.g > 0 && p.g < 1){   // l'engrais accélère fortement, il ne bloque plus
      p.g = Math.min(1, p.g + ((t===3 ? .032 : .006) + rainK)*growK);
      writePlant(k);
    }
    if (p.g > .8) ripe++;
  }
  if (S.k === 'grow' && !manual && (sown === 0 || ripe >= sown*.95)) nextStage();
  // Les grains blancs s'effacent avec la maturité, pas avec l'étape en cours : dès que les
  // brins sont franchement sortis, la terre ne doit plus montrer un seul point de semence,
  // même si le pulvérisateur n'a pas fini son travail. Pleins jusqu'à 15 % de maturité,
  // disparus à 38 % — c'est-à-dire dès l'entrée dans la pousse.
  const mur = sown ? gsum/sown : 0;
  const grainCible = !sown ? 0 : 1 - Math.max(0, Math.min(1, (mur - .15)/.23));
  GRAIN.value += (grainCible - GRAIN.value) * Math.min(1, dt*1.6);
  majMottes();                              // le sol suit l'état des cellules, image par image
  chunks.forEach(c => {
    if (c.dirty){ c.young.instanceMatrix.needsUpdate = true;
                  c.ripe.instanceMatrix.needsUpdate = true;
                  c.straw.instanceMatrix.needsUpdate = true; c.dirty = false; }
    let y = 0, r = 0, st = 0;
    for(const k of c.list){
      const pl = plants[k];
      if (pl.r) st++;
      if (pl.g > 0){ if (pl.g < .8) y++; if (pl.g > .62) r++; }
    }
    c.young.visible = y > 0; c.ripe.visible = r > 0; c.straw.visible = st > 0;   // pas de maillage vide au GPU
  });

  // tracteur de transfert
  // ---------- moisson : la benne se conduit, elle ne vient plus toute seule ----------
  const combine = (worker && worker.metier === 'harvest') ? worker : null;
  const cFull = !!combine && (combine.hop >= CAP - .5 || (combine.done && combine.hop > .5));


  // transfert : uniquement quand la benne est venue se ranger sous la goulotte
  let vidange = false;
  const trCap = hauler ? capDe(hauler) : 0;
  if (combine && hauler && combine.hop > .5 && hauler.hop < trCap - .5){
    combine.h.updateMatrixWorld(true); hauler.h.updateMatrixWorld(true);
    combine.g.userData.spout.getWorldPosition(_spout);
    hauler.g.userData.bin.getWorldPosition(_bin);
    const gap = Math.hypot(_spout.x-_bin.x, _spout.z-_bin.z);
    const deployee = combine.g.userData.auger.rotation.y < .55;
    if (gap < 3.4 && deployee) vidange = true;
  }
  if (vidange){
    const give = Math.min(combine.hop, 150*dt, trCap-hauler.hop);
    combine.hop -= give; hauler.hop += give;
    // débit calé sur le temps, pas sur l'image : sinon le jet sature à 60 fps
    if (give > 0 && Math.random() < Math.min(.9, dt*30))
      popGrain(_spout.x, _spout.y, _spout.z, _bin.x, _bin.z);
    if (Math.random() < .05) popDust(_bin.x, _bin.z);
  }
  // La vis reste rangée pendant la coupe. Elle sort à trémie pleine comme avant, mais aussi
  // dès que la benne s'approche alors qu'il reste du grain — même une trémie à moitié se
  // vide, il suffit de venir la chercher. Le seuil de sortie est plus court que celui de
  // rentrée : sans cela la vis battait dès qu'on longeait la benne à la limite.
  if (combine){
    const a = combine.g.userData.auger;
    const reste = combine.hop > .5;
    const place = !!hauler && hauler.hop < trCap - .5;
    const dist = hauler ? combine.pos.distanceTo(hauler.pos) : 1e9;
    combine.augWant = cFull || vidange ||
                      (reste && place && dist < (combine.augWant ? 17 : 13));
    a.rotation.y += ((combine.augWant ? AUG_OPEN : AUG_FOLD) - a.rotation.y)*Math.min(1, dt*2.2);
  }
  if (combine && combine.g.userData.fill) combine.g.userData.fill.scale.y = .02 + combine.hop/CAP*.98;

  // livraison : on amène la benne au silo et elle se vide
  if (hauler){
    // On se vide au silo le plus proche : le silo d'origine, ou l'un de ceux qu'on a
    // fait bâtir. Inutile de traverser toute la cour si on en a un sous la main.
    let depot = null, dmin = 6;
    for(let i=0;i<DEPOTS.length;i++){
      const d = hauler.pos.distanceTo(DEPOTS[i]);
      if (d < dmin){ dmin = d; depot = DEPOTS[i]; }
    }
    if (hauler.hop > .2 && depot){
      const give = Math.min(hauler.hop, 160*dt);
      const c = CROPS.find(x => x.id === hauler.cropId) || CROPS[0];
      const pay = give*c.price*PRICEK;
      hauler.hop -= give; stock += give; totalT += give; coins += pay;
      hauler.paid += pay;
      contractDeliver(c.id, give);
      if (hauler.paid > 700){                  // une tranche encaissée : le gain part vers le compteur
        floatCoin(depot.x, depot.z-2, '+' + fmt(hauler.paid));
        for(let i=0;i<4;i++) flyCoin(depot.x, depot.z-2, i*70);
        hauler.paid = 0; sfx('coin');
      }
      if (hauler.hop <= .2){ hauler.cropId = crop().id; sfx('cash'); save(); toast('Benne vidée au silo', 'good'); }
    }
    const rf = hauler.g.userData.fill;                  // benne ouverte : vide, on doit voir le fond
    if (rf && trCap){ rf.visible = hauler.hop > .5; rf.scale.y = .01 + hauler.hop/trCap*.99; }
  }

  // le joueur est prévenu une seule fois par remplissage
  if (cFull && !combine.warned){ combine.warned = true; toast('Trémie pleine — prends la benne', 'bad'); sfx('deny'); }
  if (combine && !cFull) combine.warned = false;
  drawVeh(); drawHitch();

  if (combine && !combine.done && !manual){
    let left = 0;
    for(let k=0;k<plants.length;k++) if (plants[k].g > .55){ left++; break; }
    if (left === 0) combine.done = true;
  }

  SOIL.update(dt); SEED.update(dt);
  grains.forEach(d => {
    if(!d.m.visible) return;
    d.t += dt; d.vy -= 9.2*dt;
    d.m.position.x += d.vx*dt; d.m.position.y += d.vy*dt; d.m.position.z += d.vz*dt;
    if (d.m.position.y < 1.1 || d.t > .8) d.m.visible = false;
  });
  spray.forEach(d => {
    if(!d.m.visible) return;
    d.t += dt; d.vy -= 7*dt;
    d.m.position.x += d.vx*dt; d.m.position.y += d.vy*dt; d.m.position.z += d.vz*dt;
    d.m.material.opacity = Math.max(0, .95 - d.t*1.1);
    if (d.m.position.y < parcelY(d.m.position.x, d.m.position.z) + .05 || d.t > .9) d.m.visible = false;
  });
  RAIN.update(tick, curRain, camLook.x, camLook.z);
  SND.rain(curRain);
  SND.engine(worker ? worker.speed : (hauler ? hauler.speed : 0),
             !!(worker || hauler) && !paused);
  TRACKS.update(raw);
  dust.forEach(d => {
    if(!d.m.visible) return;
    d.t += dt; d.m.position.y += d.vy*dt; d.m.scale.multiplyScalar(1+dt*.9);
    d.m.material.opacity = Math.max(0,.65-d.t*.8);
    if (d.t>.85) d.m.visible = false;
  });
  streaks.forEach(d => {                       // le rail s'efface là où il a été posé
    if(!d.m.visible) return;
    d.t += dt;
    const k = d.t/d.life;
    d.m.material.opacity = Math.max(0, d.a*(1-k)*(1-k));
    if (d.t > d.life) d.m.visible = false;
  });

  // Caméra. Au manche, elle suit l'engin : on ne conduit pas à l'aveugle, et le véhicule
  // reste au centre tant qu'on pousse le manche — ou une touche du clavier, qui alimente
  // le même manche. Dès qu'on lâche, elle s'arrête où elle est.
  // Quand on dessine un parcours ou qu'on double-tape, en revanche, elle ne bouge pas d'un
  // pouce : là on regarde le champ, on choisit un endroit, et un recadrage sous les doigts
  // déplacerait le trait qu'on est en train de tracer.
  if (manual && jmag > .12){
    const v = pilote();
    if (v){
      const k = Math.min(1, raw*4.5);              // rattrapage souple, jamais un saut
      camLook.x += (Math.max(X0-60, Math.min(X0+P+60, v.pos.x)) - camLook.x)*k;
      camLook.z += (Math.max(Z0-60, Math.min(Z0+P+70, v.pos.z)) - camLook.z)*k;
    }
  }
  camera.position.copy(camLook).add(camOff);
  camera.lookAt(camLook);
  // Le soleil est accroché au point visé pour que l'ombre porte là où on regarde. S'il y
  // saute, tout l'éclairage change d'un coup : on l'y amène en douceur.
  sunAt.x += (camLook.x - sunAt.x)*Math.min(1, raw*1.6);
  sunAt.z += (camLook.z - sunAt.z)*Math.min(1, raw*1.6);
  sun.position.set(sunAt.x+12, 32, sunAt.z+18);
  sun.target.position.set(sunAt.x, 0, sunAt.z); sun.target.updateMatrixWorld();

  const shownCoins = Math.floor(coins);
  if (shownCoins !== lastCoins){
    if (shownCoins > lastCoins) popChip(chipCoins);
    lastCoins = shownCoins; elCoins.textContent = fmt(shownCoins);
  }
  elStock.textContent = fmt(stock);
  const lvNow = level();
  if (lvNow !== lastLvl){
    elLvl.textContent = lvNow; popChip(chipLvl);
    if (lvNow > lastLvl && lastLvl > 0){ lvlShown = lvNow; levelUp(lvNow); }
    lastLvl = lvNow;
  }
  const hh = Math.floor(dayT*24), mm = Math.floor(dayT*1440 % 60);
  elClock.textContent = (hh<10?'0':'') + hh + ':' + (mm<10?'0':'') + mm;
  elWIcon.textContent = WEATHER[wKey].emo;

  // la jauge suit le chantier en cours : sol travaillé, puis maturité, puis trémie
  let gf = 0, gl = '';
  const NC = NS*NS;
  if (S.k === 'prep'){       gf = (cellN[1]+cellN[2]+cellN[3])/NC; gl = 'Sol ' + Math.round(gf*100) + ' %'; }
  else if (S.k === 'sow'){   gf = (cellN[2]+cellN[3])/NC;          gl = 'Semis ' + Math.round(gf*100) + ' %'; }
  else if (S.k === 'fert'){  gf = cellN[3]/NC;                     gl = 'Engrais ' + Math.round(gf*100) + ' %'; }
  else if (S.k === 'grow'){  gf = sown ? ripe/sown : 0;            gl = 'Maturité ' + Math.round(gf*100) + ' %'; }
  else if (pilote() && pilote().g.userData.benne){
    const q = pilote(), c = capDe(q);
    gf = c ? q.hop/c : 0;
    gl = c ? 'Benne ' + Math.round(gf*100) + ' %' : 'Sans benne';
  }
  else {                     gf = combine ? combine.hop/CAP : (hauler && trCap ? hauler.hop/trCap : 0);
                             gl = (combine ? 'Trémie ' : 'Benne ') + Math.round(gf*100) + ' %'; }
  elGauge.firstElementChild.style.width = (gf*100).toFixed(1) + '%';
  elGVal.textContent = gl;
  elGauge.classList.toggle('full', gf > .985);

  if (pathState === 'trace') drawPathBtn();      // le bouton compte les points qui restent
  { const v = pilote();                           // le triangle de sélection
    if (v){ MARK.visible = true;
            MARK.position.set(v.pos.x, (v.gy||0) + (v.metier==='harvest'?4.9:3.9) + Math.sin(now*2.4)*.2, v.pos.z);
            MARK.quaternion.copy(camera.quaternion); }
    else MARK.visible = false; }
  if (PING.m.visible){                            // le repère du double-appui s'efface seul
    PING.t += tick;
    const k = Math.min(1, PING.t/1.1);
    PING.m.material.opacity = .75*(1-k);
    PING.m.scale.setScalar(1 + k*.9);
    if (k >= 1) PING.m.visible = false;
  }
  saveT += tick;
  if (saveT > 6){ saveT = 0; save(); }

  renderer.render(scene, camera);
})();

// sonde de mise au point : lecture seule, pratique pour vérifier une partie sans y jouer
window.__FARM_LISTE_OBST = () => OBST.map(o => [o.x, o.z, o.r]);
window.__FARM_DEBUG = () => ({
  coins:Math.round(coins), stock:Math.round(stock), totalT:Math.round(totalT), harvests,
  stage, etape:STAGES[stage].n, culture:crop().id, jour:day, heure:+(dayT*24).toFixed(2),
  meteo:wKey, niveaux:Object.assign({}, lv), contrat:contract && {c:contract.crop, q:contract.qty, got:Math.round(contract.got)},
  manuel:manual, pause:paused, vitesse:SPEED,
  pilotage:ctrlMode, tracage:pathState, trace:traceLeft(pilote()), zoom:+zoom.toFixed(2),
  obstacles:OBST.length,
  cape:+(YAW*180/Math.PI).toFixed(1), vise:[+camLook.x.toFixed(1), +camLook.z.toFixed(1)],
  // pénétration la plus profonde de l'engin conduit dans un obstacle : doit rester nulle
  enfonce:(function(){
    const v = pilote(); if (!v) return 0;
    let pire = 0;
    const sn = Math.sin(v.heading), cs = Math.cos(v.heading);
    for(const b of v.corps){
      const cx = v.pos.x + sn*b[0], cz = v.pos.z + cs*b[0];
      for(const o of OBST) pire = Math.max(pire, (b[1]+o.r) - Math.hypot(cx-o.x, cz-o.z));
      for(const w of engins){ if (w===v) continue;
        const ws = Math.sin(w.heading), wc = Math.cos(w.heading);
        for(const c of w.corps)
          pire = Math.max(pire, (b[1]+c[1]) - Math.hypot(cx-(w.pos.x+ws*c[0]), cz-(w.pos.z+wc*c[0])));
      }
    }
    return +pire.toFixed(2);
  })(),
  trav:(function(){ const o={}; engins.forEach(v => { o[v.pid] = +v.trav.toFixed(2); }); return o; })(),
  grains:+GRAIN.value.toFixed(3),
  ruban:SWATH.pose(),
  sauts:(function(){ const v = pilote(); return v ? (v.sauts||0) : 0; })(),
  // distance libre au plus proche obstacle, gabarit compris : négatif = ça touche
  frole:(function(){ const v = pilote(); if (!v) return undefined;
    const sn = Math.sin(v.heading), cs = Math.cos(v.heading); let m = 1e9;
    for(const b of v.corps){ const cx = v.pos.x + sn*b[0], cz = v.pos.z + cs*b[0];
      for(const o of OBST) m = Math.min(m, Math.hypot(cx-o.x, cz-o.z) - b[1] - o.r);
      for(const w of engins){ if (w===v) continue;
        const ws = Math.sin(w.heading), wc = Math.cos(w.heading);
        for(const c of w.corps)
          m = Math.min(m, Math.hypot(cx-(w.pos.x+ws*c[0]), cz-(w.pos.z+wc*c[0])) - b[1] - c[1]); } }
    return +m.toFixed(2); })(),
  // de combien on s'est écarté de la ligne qu'on suit
  ecartTrace:(function(){ const v = pilote(); if (!v || !v.path || v.head >= v.path.length) return undefined;
    let m = 1e9;
    for(let k=Math.max(0,v.head-3); k<Math.min(v.path.length, v.head+8); k++)
      m = Math.min(m, Math.hypot(v.path[k].x-v.pos.x, v.path[k].z-v.pos.z));
    return +m.toFixed(2); })(),
  cellules:(function(){ const o=[0,0,0,0,0]; for(let i=0;i<cell.length;i++) o[cell[i]]++;
    return o.map(v=>+(100*v/cell.length).toFixed(1)); })(),
  murs:(function(){ let m=0; for(const p of plants) if (p.g > .55) m++; return m; })(),
  suivi:(function(){ const v = pilote(); if (!v) return null;
    return { tete:v.head, n:v.path?v.path.length:0, cote:v.cote||0, choc:+(v.choc||0).toFixed(2),
             bloque:+(v.bloque||0).toFixed(1), cap:+v.heading.toFixed(2),
             cible:v.__cible ? [+v.__cible.x.toFixed(1), +v.__cible.z.toFixed(1)] : null,
             pt0:(v.path&&v.path[v.head])?[+v.path[v.head].x.toFixed(1), +v.path[v.head].z.toFixed(1)]:null }; })(),
  chemin:(function(){ const v = pilote(); if (!v || !v.path || !v.path.length) return null;
    const o = []; for(let k=0;k<Math.min(v.path.length,200);k++)
      o.push(+v.path[k].x.toFixed(2), +v.path[k].z.toFixed(2));
    return o; })(),
  finTrace:(function(){ const v = pilote(); if (!v || !v.path || !v.path.length) return null;
    const p = v.path[v.path.length-1]; return [+p.x.toFixed(2), +p.z.toFixed(2)]; })(),
  outil:(function(){ const v = pilote(); if (!v) return null;
    const p = outilXZ(v, {x:0,z:0}); return [+p.x.toFixed(2), +p.z.toFixed(2)]; })(),
  traceVu:!!(pilote() && pilote().trace && pilote().trace.mesh.visible),
  cap:+(worker ? worker.heading : 0).toFixed(3), vit:+(worker ? worker.speed : 0).toFixed(2),
  allure:+(worker && worker.grip !== undefined ? worker.grip : 1).toFixed(2),
  posX:+worker?.pos.x.toFixed(1), posZ:+worker?.pos.z.toFixed(1),
  cly:+(worker ? worker.gy || 0 : 0).toFixed(3), surTerre:+(worker ? worker.soil || 0 : 0).toFixed(2),
  elan:+(pilote() ? (pilote().line||0) : 0).toFixed(2),
  ecrase:+(pilote() ? ((pilote().sq||0)+(pilote().wob||0)) : 0).toFixed(3),
  penche:+(pilote() ? (pilote().rol||0) : 0).toFixed(3),
  traits:streaks.reduce((n,d)=>n+(d.m.visible?1:0),0),
  hop:worker ? Math.round(worker.hop) : 0,
  incl:Math.round(PITCH*180/Math.PI),
  conduit:driven, benneLa:!!hauler, benne:hauler ? Math.round(hauler.hop) : -1,
  // la flotte présente sur la carte : clé, position, points de tracé restants, but désigné
  flotte:engins.map(v=>({id:v.pid, k:v.kind, m:v.metier, n:v.niv,
          x:+v.pos.x.toFixed(1), z:+v.pos.z.toFixed(1),
          v:+v.speed.toFixed(1), tr:traceLeft(v),
          but:v.goto ? [+v.goto.x.toFixed(1), +v.goto.z.toFixed(1)] : null})),
  bx:+(hauler ? hauler.pos.x : 0).toFixed(1), bz:+(hauler ? hauler.pos.z : 0).toFixed(1),
  capMax:Math.round(CAP), trCapMax:hauler ? capDe(hauler) : 0,
  vis:+(worker && worker.g.userData.auger ? worker.g.userData.auger.rotation.y : -1).toFixed(2),
  // écart goulotte -> benne : c'est lui qui déclenche le transfert, pas la distance des engins
  ecart:(function(){
    if (!worker || worker.metier !== 'harvest' || !hauler || !hauler.g.userData.bin) return -1;
    worker.h.updateMatrixWorld(true); hauler.h.updateMatrixWorld(true);
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    worker.g.userData.spout.getWorldPosition(a); hauler.g.userData.bin.getWorldPosition(b);
    return +Math.hypot(a.x-b.x, a.z-b.z).toFixed(2);
  })(),
  capBenne:+(hauler ? hauler.heading : 0).toFixed(3),
  outils:outils.map(o => ({ id:o.oid, t:o.type, n:o.niv, p:o.porteur||0,
          x:+o.x.toFixed(1), z:+o.z.toFixed(1), hop:Math.round(o.hop) })),
  largOutil:+(worker && worker.g.userData.tool ? worker.g.userData.tool.W : 0).toFixed(1),
  grain:grains.reduce((n,d)=>n+(d.m.visible?1:0),0),
  terre:SOIL.live(), graines:SEED.live(), gouttes:spray.reduce((n,d)=>n+(d.m.visible?1:0),0),
  paille:plants.reduce((n,p)=>n+(p.r?1:0),0),
  vole:document.querySelectorAll('#fx .fly').length,
  tri:renderer.info.render.triangles, appels:renderer.info.render.calls
});
