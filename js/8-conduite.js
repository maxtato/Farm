"use strict";
// ---------- collisions ----------
// Tout est ramené à des disques : le décor y est réduit une fois pour toutes, et un engin
// vaut son gabarit. On repousse hors du chevauchement plutôt que d'annuler le mouvement :
// l'engin glisse le long d'un mur au lieu de s'y coller.
// Repousser hors du chevauchement ne suffisait pas : l'engin restait le nez dans le mur et
// poussait dessus. On retient donc la direction de la poussée, et on braque du même côté —
// le mur écarte l'avant au lieu de l'arrêter, et l'engin longe puis contourne.
function unstick(v, dt){
  const sn = Math.sin(v.heading), cs = Math.cos(v.heading);
  const B = v.corps || CORPS.prep;
  let px = 0, pz = 0, tor = 0, prof = 0;
  // pousser (dx,dz) sur le disque placé à `off` : ça déplace l'engin et le fait pivoter,
  // puisqu'une poussée reçue à l'arrière chasse l'arrière et rentre le nez.
  const pousse = (off, dx, dz, k, p) => {
    v.pos.x += dx*k; v.pos.z += dz*k;
    px += dx*k; pz += dz*k;
    tor += off * (dx*k*cs - dz*k*sn);
    if (p > prof) prof = p;
  };
  for(let b=0;b<B.length;b++){
    const off = B[b][0], R = B[b][1];
    const cx = v.pos.x + sn*off, cz = v.pos.z + cs*off;
    for(let i=0;i<OBST.length;i++){
      const o = OBST[i], dx = cx-o.x, dz = cz-o.z;
      const min = R + o.r, d2 = dx*dx + dz*dz;
      if (d2 >= min*min) continue;
      const d = Math.sqrt(d2) || 1e-3;
      pousse(off, dx, dz, (min-d)/d, min-d);
    }
    for(let i=0;i<engins.length;i++){
      const w = engins[i];
      if (w === v) continue;
      const WB = w.corps || CORPS.prep, wsn = Math.sin(w.heading), wcs = Math.cos(w.heading);
      for(let c=0;c<WB.length;c++){
        const wx = w.pos.x + wsn*WB[c][0], wz = w.pos.z + wcs*WB[c][0];
        const dx = cx-wx, dz = cz-wz;
        const min = R + WB[c][1], d2 = dx*dx + dz*dz;
        if (d2 >= min*min) continue;
        const d = Math.sqrt(d2) || 1e-3, k = (min-d)/d*.5;   // chacun recule de moitié
        pousse(off, dx, dz, k, min-d);
        w.pos.x -= dx*k; w.pos.z -= dz*k;
      }
    }
  }
  if (!prof){ v.frotte = 0; return; }
  v.frotte = (v.frotte || 0) + (dt || .016);         // depuis combien de temps on frotte
  v.heading += Math.max(-.13, Math.min(.13, tor*.5));
  // et si le couple est nul — choc de plein fouet — on choisit quand même un côté
  const cote = px*cs - pz*sn;
  if (Math.abs(tor) < .02) v.heading += (cote >= 0 ? 1 : -1) * Math.min(.11, prof*.55);
  v.cote = cote >= 0 ? 1 : -1;                           // l'évitement contournera du même côté
  v.choc = 1.4;                                          // mémoire de contact, en secondes
  v.speed *= .74; v.line = 0;                            // on ralentit sans caler
}
// Évitement. Une simple poussée latérale ne suffisait pas : l'engin venait buter sur la
// grange et s'y usait. On vise donc la tangente de l'obstacle qui bloque — l'écart exact
// pour le raser — et on garde le même côté tant qu'il gêne, sinon l'engin hésite entre
// les deux et n'avance plus.
// `portee` = distance du but. Sans elle, un obstacle situé derrière le point visé faisait
// tourner l'engin autour indéfiniment : il ne pouvait plus jamais atteindre un point posé
// près d'un bâtiment ou d'un autre engin. On n'évite que ce qui est sur le chemin.
// Jusqu'où peut-on aller dans cette direction avant de toucher quelque chose ? Sert à
// choisir de quel côté contourner : le côté le plus dégagé, pas le premier venu.
function degage(v, ang, look){
  const sn = Math.sin(ang), cs = Math.cos(ang);
  const R = (v.rad || 2.2) + .35, nez = v.avant || 2.2;
  let d = look;
  const test = (ox, oz, orad) => {
    const dx = ox - v.pos.x, dz = oz - v.pos.z;
    const along = dx*sn + dz*cs - nez;
    if (along < 0 || along >= d) return;
    if (Math.abs(dx*cs - dz*sn) > R + orad) return;
    d = along;
  };
  for(let i=0;i<OBST.length;i++){ const o = OBST[i]; test(o.x, o.z, o.r); }
  for(let i=0;i<engins.length;i++){
    const w = engins[i];
    if (w === v) continue;
    // la moissonneuse et la benne doivent pouvoir se serrer l'une contre l'autre pour le
    // transfert : elles ne s'évitent pas entre elles
    if ((v.metier === 'harvest' && w.g.userData.benne) ||
        (v.g.userData.benne && w.metier === 'harvest')) continue;
    const WB = w.corps || CORPS.prep, ws = Math.sin(w.heading), wc = Math.cos(w.heading);
    for(let c=0;c<WB.length;c++) test(w.pos.x + ws*WB[c][0], w.pos.z + wc*WB[c][0], WB[c][1]*.92);
  }
  return d;
}
function dodge(v, want, portee){
  v.choc = Math.max(0, (v.choc || 0) - .016);            // le souvenir du choc s'estompe
  // On frôle : la marge, c'est ce qu'il faut pour ne pas toucher, pas un mètre de plus.
  // Fraîchement cogné, on s'écarte un peu davantage le temps de se dégager.
  const marge = v.choc > 0 ? 1.7 : 1.0;
  const R = (v.rad || 2.2) + marge;
  const but = portee === undefined ? 1e9 : portee;
  // On ne regarde qu'à la distance qu'il faut pour se déporter à cette allure. Regarder à
  // douze mètres faisait braquer bien avant l'obstacle, puis se redresser, puis rebraquer.
  const look = Math.min(but, Math.max(6.5, v.speed*1.15) + (v.rad || 2.2));
  const sn = Math.sin(want), cs = Math.cos(want);
  let bloc = null, proche = 1e9;
  const nez = v.avant || 2.2;                             // l'obstacle se mesure depuis l'avant
  const test = (ox, oz, orad) => {
    const dx = ox - v.pos.x, dz = oz - v.pos.z;
    const along = dx*sn + dz*cs - nez;                    // distance devant le nez
    if (along <= -orad - nez) return;                     // derrière : il ne gêne plus
    if (along > but + .5) return;                         // au-delà du but : il ne gêne pas
    const side = dx*cs - dz*sn;                           // écart latéral, positif à droite
    const need = R + orad;
    if (Math.abs(side) > need) return;                    // on passe à côté sans le frôler
    const dist = Math.max(.1, Math.hypot(dx, dz) - nez);
    if (dist > look + orad || dist >= proche) return;
    proche = dist; bloc = { along, side, need, dist };
  };
  for(let i=0;i<OBST.length;i++){ const o = OBST[i]; test(o.x, o.z, o.r); }
  for(let i=0;i<engins.length;i++){
    const w = engins[i];
    if (w === v) continue;
    // la moissonneuse et la benne doivent pouvoir se rapprocher pour la vidange : entre
    // elles deux, on garde le choc mais pas l'évitement, sinon la goulotte ne trouve jamais
    // la moissonneuse et la benne doivent pouvoir se serrer l'une contre l'autre pour le
    // transfert : elles ne s'évitent pas entre elles
    if ((v.metier === 'harvest' && w.g.userData.benne) ||
        (v.g.userData.benne && w.metier === 'harvest')) continue;
    const WB = w.corps || CORPS.prep, wsn = Math.sin(w.heading), wcs = Math.cos(w.heading);
    for(let c=0;c<WB.length;c++)
      test(w.pos.x + wsn*WB[c][0], w.pos.z + wcs*WB[c][0], WB[c][1]*.92);
  }
  // Coincé pour de bon — calé contre une botte, pris entre deux murs. On laisse tomber la
  // consigne le temps de se dégager : on balaye tout autour et on part vers l'air libre.
  // Sans ça l'engin oscillait sur place, une seconde d'un côté, une seconde de l'autre.
  if ((v.frotte || 0) > 1.2){
    let mieux = v.heading, large = -1;
    for(let k=-5;k<=5;k++){
      const a = v.heading + k*.32, l = degage(v, a, 18);
      if (l > large){ large = l; mieux = a; }
    }
    v.cote = 0; v.serre = .8; v.detour = 2.5;
    if (large > 6) v.frotte = 0;                         // dégagé : on reprend la consigne
    return mieux;
  }
  if (!bloc){ v.cote = 0; v.serre = 1; return want; }
  // On lève le pied à l'approche. Un engin qui arrive à dix mètres par seconde sur un mur
  // n'a pas le temps de se déporter, quoi qu'on lui commande ; à quatre, il passe à côté.
  v.serre = Math.max(.62, Math.min(1, (bloc.dist - bloc.need + 5)/6));
  const demi = bloc.dist > bloc.need ? Math.asin(Math.min(1, bloc.need/bloc.dist)) : Math.PI/2;
  const rel  = Math.atan2(bloc.side, Math.max(.1, bloc.along));   // relèvement de l'obstacle
  // De quel côté ? Contourner par le plus proche bord ne suffit pas : dans une cour, l'esquive
  // d'un bâtiment envoie droit dans le suivant. On regarde donc ce qu'il y a derrière chaque
  // tangente et on prend la plus dégagée — puis on s'y tient, tant qu'elle le reste.
  const port = look*1.7;
  const g = degage(v, want + rel - demi, port);          // côté -1
  const d = degage(v, want + rel + demi, port);          // côté +1
  if (!v.cote) v.cote = g >= d ? -1 : 1;
  else {
    // On ne change d'avis en cours de contournement que si l'autre côté est franchement
    // plus ouvert : hésiter, c'est se remettre en plein dans ce qu'on esquivait.
    const ici = v.cote < 0 ? g : d, la = v.cote < 0 ? d : g;
    if (ici < Math.min(4.5, port*.5) && la > ici + 3) v.cote = -v.cote;
  }
  // Deux garde-fous, et c'est là qu'était le blocage.
  // 1. La consigne se borne. Un obstacle qui arrive contre le nez donnait un relèvement de
  //    quatre-vingt-dix degrés, plus une demi-ouverture de quatre-vingt-dix : cent quatre-
  //    vingts degrés de consigne, l'engin faisait demi-tour et repartait dans le décor.
  // 2. Elle ne prend toute son ampleur qu'à l'approche. De loin on se contente d'infléchir
  //    la trajectoire ; on ne se déporte franchement qu'une fois l'obstacle proche. C'est
  //    ce qui fait qu'on le frôle au lieu de l'éviter dix mètres avant.
  const corr = Math.max(-1.5, Math.min(1.5, rel + v.cote*demi));
  // Le droit de reprendre le tracé plus loin ne s'ouvre pas parce qu'on a APERÇU quelque
  // chose : il s'ouvre parce qu'on a dû quitter la ligne pour de bon. Il y fallait donc
  // deux conditions, et pas une. L'obstacle doit être sur le point d'être touché — pas un
  // arbre entrevu à huit mètres — et la consigne doit vraiment s'écarter de celle qu'on
  // voulait. Un obstacle qu'on frôle sans dévier ne donne aucun droit à couper le dessin.
  // C'était le défaut : le simple fait de longer une haie ouvrait le raccourci en
  // permanence, et l'engin rognait les courbes en plein champ vide.
  if (bloc.dist < bloc.need + 2.5 && Math.abs(corr) > .14) v.detour = 1.2;
  return want + corr;
}

// ---------- pilotage d'un engin de la flotte ----------
// Ordre de priorité : le tracé dessiné, puis le point désigné au double-appui, puis le
// manche si c'est l'engin conduit, puis le pilote automatique si c'est celui du chantier.
// Une trémie pleine, c'est un chantier à l'arrêt : la moissonneuse ne doit pas continuer
// à tourner sur le champ en coupant dans le vide. Elle se range sur place et attend d'être
// vidée, puis reprend son parcours là où elle l'avait laissé — il n'est pas effacé.
// Le manche reste prioritaire, pour qu'on puisse toujours aller la chercher soi-même.
// La benne, elle, n'est jamais bloquée : pleine, il faut justement pouvoir l'amener au silo.
function pleine(v){ return v.metier === 'harvest' && v.hop >= CAP - .5; }
function driveOne(v, conduit, chantier, dt){
  if (pleine(v)){
    if (conduit && manual && jmag > .12){ driveManual(v, dt); return; }
    step(v, dt, v.heading, 0, false);
    return;
  }
  if (v.path && v.head < v.path.length){ followPath(v, dt); return; }
  if (v.goto){
    // `stop` mettrait la consigne de vitesse à zéro : on roule jusqu'au point, on ne s'y gare pas
    const dv = Math.hypot(v.goto.x-v.pos.x, v.goto.z-v.pos.z);
    if (v.prog === undefined || dv < v.prog - .4){ v.prog = dv; v.progT = 0; }
    else if ((v.progT = (v.progT||0) + dt) > 4){    // on n'approche plus : c'est inatteignable
      v.progT = 0; v.prog = undefined; v.goto = null; v.speed = 0; return;
    }
    if (driveTo(v, v.goto, dt, false, false, true) < RMIN + 1.2){
      v.goto = null; v.speed = 0; v.prog = undefined;
    }
    return;
  }
  if (conduit && manual){ driveManual(v, dt); return; }
  if (chantier && !manual){ autoWork(v, dt); return; }
  step(v, dt, v.heading, 0, false);                       // à l'arrêt, moteur au ralenti
}
function autoWork(v, dt){
  if (v.done){
    const waiting = v.metier === 'harvest' && v.hop > 1;
    const dist = driveTo(v, waiting ? v.pos : GATE, dt, waiting);
    if (!waiting && dist < RMIN+1) nextStage();
    return;
  }
  const t = v.lanes[v.laneI];
  const full = v.metier === 'harvest' && v.hop >= CAP - .5;
  v.wpT = (v.wpT||0) + dt;
  if (driveTo(v, t, dt, full) < RMIN || v.wpT > 30){      // RMIN : inutile de viser plus près
    v.laneI++; v.wpT = 0;
    if (v.laneI >= v.lanes.length) v.done = true;
  }
}
// ---------- l'outil d'un engin, appliqué là où il passe ----------
function work(v, dt){
  const d = v.g.userData;
  // Règle d'ordre. Le déchaumage passe partout : quel que soit l'état du sol — chaume,
  // semis, terre mouillée, épis prêts à faucher — l'outil remet la terre à nu, et cet état
  // prévaut sur tous les autres. Les trois autres outils, eux, ne servent à rien hors de
  // leur tour : semer sur du chaume ou sur des épis, mouiller avant d'avoir semé, tout cela
  // ne laisse aucune trace. C'est pour ça que le ruban et les effets ne se posent que si
  // l'outil a réellement changé quelque chose.
  if (v.metier === 'prep'){
    const n = applyTool(v, i => setCell(i,1));
    if (n){
      vierge = false;                    // la parcelle a été travaillée : ce n'est plus une friche
      laySwath(v, 0);
      popDust(v.pos.x - Math.sin(v.heading)*3.5, v.pos.z - Math.cos(v.heading)*3.5);
      // le déchaumage enfouit ce qui traînait : plants levés comme dépôt de paille
      plants.forEach((p,k) => {
        if (cell[p.ti]===1 && (p.g>0 || p.r)){ p.g = 0; p.r = 0; writePlant(k); }
      });
    }
    // la terre gicle derrière le rouleau, d'autant plus qu'on avance vite
    const q = toolPose(v);
    if (q && v.speed > .5){
      const back = -Math.sin(q.a), backZ = -Math.cos(q.a);
      let nb = Math.min(6, Math.round(dt*v.speed*9));
      while (nb-- > 0){
        const u = (Math.random()-.5)*q.W;
        const x = q.x + Math.cos(q.a)*u + back*.5, z = q.z - Math.sin(q.a)*u + backZ*.5;
        SOIL.spawn(x, parcelY(x,z)+.25, z,
                   back*(1.4+Math.random()*2.4) + (Math.random()-.5)*1.6,
                   1.8 + Math.random()*2.3,
                   backZ*(1.4+Math.random()*2.4) + (Math.random()-.5)*1.6,
                   .8 + Math.random()*.45, .8 + Math.random()*.8);
      }
    }
  }
  else if (v.metier === 'sow'){
    const n = applyTool(v, i => cell[i]===1 && setCell(i,2));   // rien à semer hors terre labourée
    if (!n) return;
    laySwath(v, 1);
    plants.forEach((p,k) => { if (cell[p.ti]===2 && p.g===0){ p.g = .04; writePlant(k); } });
    const q = toolPose(v);
    if (q && v.speed > .3){
      let nb = Math.min(7, Math.round(dt*v.speed*13));
      while (nb-- > 0){
        const u = (Math.random()-.5)*q.W;
        const x = q.x + Math.cos(q.a)*u, z = q.z - Math.sin(q.a)*u;
        SEED.spawn(x, parcelY(x,z)+1.05, z,
                   (Math.random()-.5)*1.7 - Math.sin(q.a)*v.speed*.25,
                   .5 + Math.random()*.9,
                   (Math.random()-.5)*1.7 - Math.cos(q.a)*v.speed*.25,
                   .8 + Math.random()*.5, .8 + Math.random()*.6);
      }
    }
  }
  else if (v.metier === 'fert'){
    const n = applyTool(v, i => cell[i]===2 && setCell(i,3));   // rien à mouiller hors semis
    if (!n) return;
    laySwath(v, 2);
    const q = toolPose(v);                       // buses réparties sur toute la rampe
    if (q && v.speed > .3){
      const NB = 8;                                   // une buse tous les mètres environ
      for(let k=0;k<NB;k++){
        const u = (k + .5)/NB*q.W - q.W/2 + (Math.random()-.5)*.4;
        popSpray(q.x + Math.cos(q.a)*u, 3.15, q.z - Math.sin(q.a)*u,
                 -Math.sin(q.a)*v.speed*.15, -Math.cos(q.a)*v.speed*.15);
      }
    }
  }
  else if (v.metier === 'harvest'){
    if (v.hop < CAP){
      let cut = 0;
      const q = toolPose(v);
      const cs = Math.cos(-q.a), sn = Math.sin(-q.a), RR = (q.W/2+1.2)*(q.W/2+1.2);
      for(let k=0;k<plants.length;k++){
        const p = plants[k];
        if (p.g < .55) continue;
        const dx = p.x-q.x, dz = p.z-q.z;
        if (dx*dx+dz*dz > RR) continue;
        const lx = dx*cs+dz*sn, lz = -dx*sn+dz*cs;
        if (Math.abs(lx) < q.W/2 && lz > q.near && lz < q.far){ p.g = 0; p.r = 1; writePlant(k); cut++; }
      }
      if (cut){
        v.hop = Math.min(CAP, v.hop + cut*crop().yieldK*RENDK);
        applyTool(v, i => setCell(i,4));      // moissonné : ni friche, ni terre travaillée
        laySwath(v, 3);
        if (Math.random()<.3) popDust(v.pos.x-Math.sin(v.heading)*2.5,
                                      v.pos.z-Math.cos(v.heading)*2.5);
      }
    }
    if (d.fill) d.fill.scale.y = .02 + v.hop/CAP*.98;
  }
}
