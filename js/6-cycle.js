"use strict";
// ---------- véhicules ----------
// Un seul disque au milieu du tracteur laissait passer tout le reste : l'outil traîné, la
// coupe de la moissonneuse, la caisse de la benne entraient dans les murs pendant que le
// centre, lui, passait à côté. À l'écran l'engin forçait dans le bâtiment. Chaque engin
// porte donc plusieurs disques répartis sur sa longueur — décalage vers l'avant, rayon.
const CORPS = {
  prep:    [[ .4,1.8], [-3.2,2.3]],
  sow:     [[ .4,1.8], [-3.2,2.3]],
  fert:    [[ .4,1.8], [-3.2,2.6]],          // rampes larges
  harvest: [[3.0,2.7], [0,2.3], [-2.4,2.0]], // coupe devant, corps, arrière
  trailer: [[2.4,1.8], [-2.6,2.2]]           // tracteur puis caisse
};
function vehicle(kind, opt){
  brakeLights = []; headlamps = []; beacons = [];
  const g = build(kind, opt);
  g.traverse(o => { if(o.isMesh) o.castShadow = true; });
  const h = new THREE.Group(); h.add(g); scene.add(h);
  g.userData.brakes = brakeLights; g.userData.lamps = headlamps; g.userData.beacons = beacons;
  // Où se pose l'effet sur la parcelle : le rouleau du déchaumeur, les socs du semoir, la
  // rampe, la barre de coupe, la caisse de la benne. C'est ce point-là que le joueur
  // désigne quand il double-tape ou qu'il dessine, jamais le nez du tracteur.
  h.updateMatrixWorld(true);
  const org = (g.userData.tool && g.userData.tool.obj) || g.userData.bin;
  const trav = org ? h.worldToLocal(org.getWorldPosition(new THREE.Vector3())).z : 0;
  // Le gabarit suit la machine : un tracteur de grande puissance attelé d'une 22 m³ n'a
  // pas les disques d'un compact tirant une 8 m³. `build` les calcule, sinon la table.
  const B = g.userData.corps || CORPS[kind] || CORPS.prep;
  return { kind, g, h, trav, pos:GATE.clone(), heading:Math.PI, speed:0, steerA:0, turnRate:0,
           bob:Math.random()*3, trk:0, laneI:0, lanes:null, done:false, hop:0,
           sus:0, susV:0, pit:0, pitV:0, rol:0, rolV:0, lastS:0, wph:Math.random()*6,
           sq:0, sqV:0, line:0, strk:0,
           corps: B,
           rad: Math.max.apply(null, B.map(c=>c[1])),
           avant: Math.max.apply(null, B.map(c=>c[0]+c[1])) };
}
// Allure en virage : plein régime dans l'axe, ralentissement franc au demi-tour, et
// entre les deux une courbe douce plutôt qu'une cassure. La même sert au manche et au
// pilote automatique, pour que les deux se comportent pareil.
function speedForTurn(diff){
  const k = .5 + .5*Math.cos(diff);          // 1 dans l'axe, 0 à l'opposé
  return .18 + .82*Math.pow(k, 1.3);
}
// et elle s'établit au lieu de sauter : sinon l'engin saccade à chaque coup de manche.
// Dissymétrique à dessein : il lève le pied franchement en entrant en courbe, et relance
// en douceur une fois revenu dans l'axe.
function easeGrip(v, target, dt){
  if (v.grip === undefined) v.grip = 1;
  v.grip += (target - v.grip)*Math.min(1, dt*(target < v.grip ? 8 : 3.5));
  return v.grip;
}

// conduite au manche, au clavier ou sur parcours : le même code pour l'engin d'attelage
// comme pour la benne, puisque les deux se pilotent maintenant.
function driveManual(v, dt){
  {
    const push = Math.max(0, (jmag - .12)/.88);                // zone morte au centre
    const turning = jmag > .12;
    // Le manche est lu à l'écran, pas dans le monde : il faut le tourner du lacet de la
    // caméra, sinon pousser à droite n'envoie plus l'engin à droite de l'écran dès qu'on
    // a pivoté la vue. Droite d'écran = (cos, -sin) au sol, haut d'écran = -(sin, cos).
    const cyw = Math.cos(YAW), snw = Math.sin(YAW);
    const wantH = turning ? Math.atan2(jx*cyw + jy*snw, -jx*snw + jy*cyw) : v.heading;
    // demi-tour au manche : il lève le pied le temps de pivoter, puis relance
    let d = wantH - v.heading;
    while(d >  Math.PI) d -= 6.28318;
    while(d < -Math.PI) d += 6.28318;
    // il lève le pied dès qu'il braque, et relance tout seul une fois dans l'axe du manche
    const grip = easeGrip(v, turning ? speedForTurn(d) : 1, dt);
    step(v, dt, wantH, push*MAXSPD*mudK*grip, turning);
  }
}
function step(v, dt, wantHeading, wantSpeed, turnable){
  if (turnable){
    let diff = wantHeading - v.heading;
    while(diff> Math.PI) diff -= 6.28318;
    while(diff<-Math.PI) diff += 6.28318;
    const rate = Math.min(TURNCAP, v.speed/RMIN + TURNFLOOR);  // dθ/dt = v/R, plus un pivot de base
    // la vitesse angulaire s'établit au lieu de sauter à son maximum : le virage s'amorce
    // et se referme en douceur, sans l'à-coup d'un braquage instantané
    const want = Math.max(-rate, Math.min(rate, diff/Math.max(dt,1e-4)));
    if (v.wRate === undefined) v.wRate = 0;
    v.wRate += (want - v.wRate)*Math.min(1, dt*8);
    let turn = v.wRate*dt;
    if (Math.abs(turn) > Math.abs(diff)) turn = diff;          // sans jamais dépasser la consigne
    v.heading += turn; v.turnRate = turn/Math.max(dt,1e-4);
    v.steerA += (Math.max(-.6,Math.min(.6,diff*1.4)) - v.steerA)*Math.min(1,dt*10);
  } else {
    v.steerA += (0 - v.steerA)*Math.min(1,dt*6);
    v.turnRate *= .9; v.wRate = (v.wRate || 0)*.9;
  }
  // Prime de ligne droite : l'élan se construit tant que l'engin tient son cap et se perd
  // dès qu'il braque. Quelques secondes de passage droit et il file près d'un tiers plus
  // vite ; le moindre coup de manche le ramène à son allure de travail.
  const tenu = turnable ? Math.max(0, 1 - Math.abs(v.turnRate)/1.1) : 1;
  const vise = wantSpeed > .5 ? tenu : 0;
  v.line += (vise - v.line)*Math.min(1, dt*(vise > v.line ? 1.5 : 5));
  v.speed += (wantSpeed*(1 + LINEK*v.line) - v.speed)*Math.min(1, dt*ACC);
  v.pos.x += Math.sin(v.heading)*v.speed*dt;
  v.pos.z += Math.cos(v.heading)*v.speed*dt;
  unstick(v, dt);                                        // décor et autres engins : on ne traverse pas
  const d = v.g.userData;
  d.wheels.forEach(w => w.userData.spin.rotation.x += v.speed*dt/w.userData.r);
  (d.steer||[]).forEach(s => s.w.rotation.y = v.steerA*s.k);
  (d.tourne||[]).forEach(o => { o.rotation.y += dt*(2.2 + v.speed*1.9); });
  (d.spinners||[]).forEach(s => {
    if (s.spin) s.spin.rotation.x += dt*(s.rate + v.speed*.6);
    else s.userData.spin.rotation.x += v.speed*dt/s.userData.r;
  });
  if (d.hitch){
    let rel = d.hitch.rotation.y;
    rel += (v.speed/3.4)*Math.sin(-rel)*dt - (v.heading - (v.lastH===undefined?v.heading:v.lastH));
    d.hitch.rotation.y = Math.max(-.95, Math.min(.95, rel));   // butée : au-delà l'outil rentrerait dans les roues
  }
  v.lastH = v.heading;
  v.lastDt = dt;
  v.trk += v.speed*dt;
  if (v.trk > .34 && v.speed > .3){
    v.trk = 0;
    const cs = Math.cos(v.heading), sn = Math.sin(v.heading);
    for(const side of [-1,1])
      TRACKS.add(v.pos.x + cs*side*1.2 - sn*.6, v.pos.z - sn*side*1.2 - cs*.6, v.heading, .58);
  }
  // --- suspensions très molles : plus de saut sec, la caisse flotte sur ses ressorts ---
  const sf = Math.min(1, v.speed/5);
  v.bob += dt*(1.6 + v.speed*.85);
  v.wph += (v.speed/1.15)*dt;                                // phase de rotation des roues
  // L'irrégularité ne vient que du sol travaillé : sur l'herbe l'engin roule droit,
  // et il se met à sautiller dès qu'il monte sur la terre.
  const onSoil = Math.min(1, Math.max(0, parcelY(v.pos.x, v.pos.z)/(LIP*.6)));
  v.soil = (v.soil === undefined ? onSoil : v.soil + (onSoil - v.soil)*Math.min(1, dt*6));
  const warp = Math.sin(v.wph)*1.25 + Math.sin(v.wph*.5+1.1)*.7;   // roues voilées sur la terre
  const bump = ((Math.sin(v.bob*2.1) + Math.sin(v.bob*3.37)*.55 + Math.sin(v.bob*5.1)*.3)*2.4
                + warp*2.6)*sf*v.soil;
  const K = 24, D = 5.4;                                     // ~0,78 Hz, amortissement 0,55
  v.susV += (-K*v.sus - D*v.susV + bump)*dt;
  v.sus = Math.max(-.19, Math.min(.19, v.sus + v.susV*dt));
  const acc = (v.speed - v.lastS)/Math.max(dt,1e-4); v.lastS = v.speed;
  v.pitV += (-K*v.pit - D*v.pitV - acc*.05 + bump*.06)*dt;   // plongée au freinage, cabrage à l'accél.
  v.pit = Math.max(-.09, Math.min(.09, v.pit + v.pitV*dt));
  // Le penchant en virage, franchement plus marqué : la caisse s'incline vers l'extérieur
  // de la courbe, d'autant plus qu'on va vite, et revient en oscillant une fois redressé.
  v.rolV += (-K*v.rol - D*v.rolV - v.turnRate*v.speed*.155
             + Math.sin(v.wph + 2.1)*1.3*sf*v.soil)*dt;
  v.rol = Math.max(-.26, Math.min(.26, v.rol + v.rolV*dt));
  // Carrosserie molle : elle se tasse et s'étire en hauteur, entretenue par les cahots, par
  // les reprises et par un rebond continu tant qu'elle roule. Le volume se conserve — ce qui
  // s'écrase en hauteur s'élargit d'autant, sinon l'engin maigrit au lieu de rebondir.
  // Le ressort n'encaisse que les à-coups : cahots et reprises. Le balancement d'une caisse
  // molle, lui, est appliqué directement — passé par le ressort il était excité bien
  // au-dessus de sa fréquence propre et n'en sortait qu'un pour cent.
  // Mesuré sur la vidéo, sur un passage droit : la caisse varie de treize pour cent en
  // hauteur crête à crête, à 2,5 Hz, tandis que sa largeur ne bouge pas — deux et demi pour
  // cent, soit le bruit de mesure. Le bas reste posé, c'est le toit qui monte et redescend.
  // On s'aligne : plus aucune compensation de largeur, et une amplitude du même ordre.
  const K3 = 52, D3 = 5.8;                                   // ~1,15 Hz, bien élastique
  v.sqV += (-K3*v.sq - D3*v.sqV - v.susV*1.5 - acc*.11)*dt;
  v.sq = Math.max(-.045, Math.min(.045, v.sq + v.sqV*dt));
  v.wob = Math.sin(v.bob*1.5)*.05*sf;                        // ~2,5 Hz à pleine allure
  // la terre est en surépaisseur : l'engin y monte, et se cabre sur la rampe du bord
  const sn2 = Math.sin(v.heading), cs2 = Math.cos(v.heading);
  const gy = parcelY(v.pos.x, v.pos.z);
  const fy = parcelY(v.pos.x + sn2*1.8, v.pos.z + cs2*1.8);
  const by = parcelY(v.pos.x - sn2*1.8, v.pos.z - cs2*1.8);
  if (v.gy === undefined) v.gy = gy;
  v.gy += (gy - v.gy)*Math.min(1, dt*10);
  v.slope = (v.slope || 0) + (Math.atan2(by - fy, 3.6) - (v.slope || 0))*Math.min(1, dt*8);
  v.h.position.set(v.pos.x, v.gy, v.pos.z);
  v.h.rotation.y = v.heading;
  v.g.position.y = v.sus;
  v.g.rotation.set(v.pit + v.slope, 0, v.rol);
  // en hauteur seulement : la caisse ne s'élargit pas, elle se soulève et se rabaisse
  v.g.scale.set(1, 1 + v.sq + (v.wob||0), 1);
  // Deux rails posés juste sous l'arrière, dans la trace même de l'engin, dès que l'élan
  // de ligne droite est pris. Ils se recouvrent assez pour faire une ligne continue, et
  // s'effacent en un quart de seconde là où ils ont été posés.
  if (v.line > .3 && v.speed > 4){
    v.strk += dt*(9 + 9*v.line);
    while (v.strk >= 1){
      v.strk -= 1;
      const len = 1.5 + Math.random()*.8 + v.line*1.1;
      const rec = 2.3 + Math.random()*.4;
      popStreak(v.pos.x, v.pos.z, v.heading, -(.7 + Math.random()*.14), rec, len, v.line);
      popStreak(v.pos.x, v.pos.z, v.heading,  (.7 + Math.random()*.14), rec, len, v.line);
    }
  } else v.strk = 0;
  const br = v.g.userData.brakes;
  if (br){                                                   // feux stop au ralentissement
    const on = (wantSpeed < v.speed - .25) ? 1 : .18;
    br.forEach(m => m.material.emissive.setRGB(on, on*.06, on*.04));
  }
}
// valeurs d'usine, puis valeurs courantes modulées par les améliorations et par la météo
const MAXSPD0 = 7.6, RMIN0 = 2.0;   // vitesse de base ; rayon de braquage mini
// Le braquage tenait de l'engin de chantier : plafonné à 1,9 rad/s sur un rayon de 2,8 m,
// il fallait un virage large pour se retourner. On resserre le rayon, on relève le plafond,
// et on ajoute un pivot minimal pour que l'engin réponde au manche même en roulant doucement.
// Un cran plus rond encore : plafond et pivot de base abaissés, rayon mini élargi, et la
// vitesse angulaire met un peu plus longtemps à s'établir. Le demi-tour reste court, mais
// l'entrée en courbe ne casse plus la trajectoire.
const TURNCAP = 4.3, TURNFLOOR = 1.7;
const LINEK = .48;                  // jusqu'à +48 % d'allure sur un long passage droit
let MAXSPD = MAXSPD0, RMIN = RMIN0, ACC = 10, GROWK = 1, PRICEK = 1, mudK = 1;
// Le décalage de l'outil, ramené dans le repère du monde : viser un point avec l'outil,
// c'est viser, avec le tracteur, ce même point reculé de la longueur de l'attelage.
function outilXZ(v, out){
  const o = v.trav || 0;
  out.x = v.pos.x + Math.sin(v.heading)*o;
  out.z = v.pos.z + Math.cos(v.heading)*o;
  return out;
}
const _vise = { x:0, z:0 }, _out = { x:0, z:0 }, _out2 = { x:0, z:0 };
function driveTo(v, target, dt, stop, large, outil){
  const vrai = target;
  const dec = outil ? (v.trav || 0) : 0;
  if (dec){
    // L'outil traîne exactement derrière l'engin : viser un point avec lui, c'est viser
    // ce point reculé de la longueur de l'attelage, dans l'axe de l'engin. On dépasse
    // donc le point de cette longueur (outil porté à l'arrière) ou on s'arrête d'autant
    // avant (barre de coupe), et la consigne reste devant pendant tout le dépassement.
    _vise.x = target.x - Math.sin(v.heading)*dec;
    _vise.z = target.z - Math.cos(v.heading)*dec;
    target = _vise;
  }
  const dbut = Math.hypot(target.x-v.pos.x, target.z-v.pos.z);
  // `large` : on regarde aussi au-delà du point visé. Sur un tracé les points se suivent de
  // près, et se borner à eux revenait à rouler les yeux fermés.
  const portee = large ? Math.max(dbut, 14) : dbut;
  const want = dodge(v, Math.atan2(target.x-v.pos.x, target.z-v.pos.z), portee);
  let diff = want - v.heading;
  while(diff> Math.PI) diff -= 6.28318;
  while(diff<-Math.PI) diff += 6.28318;
  // en auto aussi il ralentit pour braquer, avec exactement la même courbe qu'au manche
  const grip = easeGrip(v, stop ? 1 : speedForTurn(diff), dt);
  step(v, dt, want, stop ? 0 : MAXSPD*mudK*(v.mul||1)*grip*(v.serre||1), true);
  if (dec){ const T = outilXZ(v, _out2); return Math.hypot(vrai.x-T.x, vrai.z-T.z); }
  return Math.hypot(target.x-v.pos.x, target.z-v.pos.z);
}
function lanesFor(W){
  const L = [], cols = Math.max(1, Math.ceil(P/W));
  for(let i=0;i<cols;i++){
    const x = X0 + W/2 + i*((P-W)/Math.max(1,cols-1));
    L.push(new THREE.Vector3(x,0, i%2 ? Z0+P+10 : Z0-10));
    L.push(new THREE.Vector3(x,0, i%2 ? Z0-10 : Z0+P+10));
  }
  return L;
}
const _tp = new THREE.Vector3(), _tq = new THREE.Quaternion(), _tsc = new THREE.Vector3(),
      _te = new THREE.Euler(), _spout = new THREE.Vector3(), _bin = new THREE.Vector3();
function toolPose(v){
  const T = v.g.userData.tool; if (!T) return null;
  v.h.updateMatrixWorld(true);
  T.obj.matrixWorld.decompose(_tp,_tq,_tsc);
  _te.setFromQuaternion(_tq,'YXZ');
  return { x:_tp.x, z:_tp.z, a:_te.y, W:T.W, near:T.near, far:T.far };
}

// échantillonne le ruban à la largeur exacte de l'outil, tous les 25 cm
function laySwath(v, layer){
  const p = toolPose(v); if (!p) return;
  const mid = (p.near + p.far)/2;
  const x = p.x + Math.sin(p.a)*mid, z = p.z + Math.cos(p.a)*mid;
  if (v.swX !== undefined){
    const dd = Math.hypot(x-v.swX, z-v.swZ);
    if (dd < .25) return;
    SWATH.add(layer, x, z, p.a, p.W, dd < 1.6 && v.swL === layer, v.kind);
  } else {
    SWATH.add(layer, x, z, p.a, p.W, false, v.kind);
  }
  v.swX = x; v.swZ = z; v.swL = layer;
}
function applyTool(v, fn){
  const p = toolPose(v); if (!p) return 0;
  const cs = Math.cos(-p.a), sn = Math.sin(-p.a);
  const R = p.W/2 + Math.max(Math.abs(p.near), Math.abs(p.far)) + .5;
  const i0 = Math.max(0, Math.floor((p.x-R-X0)/CS)), i1 = Math.min(NS-1, Math.ceil((p.x+R-X0)/CS));
  const j0 = Math.max(0, Math.floor((p.z-R-Z0)/CS)), j1 = Math.min(NS-1, Math.ceil((p.z+R-Z0)/CS));
  let n = 0;
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
    const cx = X0+(i+.5)*CS, cz = Z0+(j+.5)*CS;
    const dx = cx-p.x, dz = cz-p.z;
    const lx = dx*cs+dz*sn, lz = -dx*sn+dz*cs;
    if (Math.abs(lx) < p.W/2 && lz > p.near && lz < p.far) n += fn(j*NS+i) ? 1 : 0;
  }
  return n;
}

// ---------- cycle ----------
const STAGES = [
  { k:'prep',    n:'Préparer', ic:'🚜', d:'Déchaumeuse — travail du sol' },
  { k:'sow',     n:'Semer',    ic:'🌱', d:'Semoir — mise en terre' },
  { k:'fert',    n:'Engrais',  ic:'💧', d:'Pulvérisateur — rampes déployées' },
  { k:'grow',    n:'Pousse',   ic:'🌿', d:'La culture mûrit' },
  { k:'harvest', n:'Moisson',  ic:'🌾', d:'Moissonneuse — la benne vient au transfert' }
];
let stage = 0, coins = 0, stock = 0;
// Toute la flotte vit sur la carte. On passe d'un engin à l'autre sans que le précédent
// disparaisse : il garde son tracé, continue de rouler et continue de travailler. `worker`
// et `hauler` ne sont plus que des vues sur la flotte, rafraîchies à chaque image.
const KINDS = ['prep','sow','fert','harvest','trailer'];
const fleet = { prep:null, sow:null, fert:null, harvest:null, trailer:null };
let driven = 'prep';            // clé de l'engin qui répond aux commandes
let worker = null, hauler = null;
// ---------- parc : niveau de tracteur, bennes possédées, benne attelée ----------
// Les trois tracteurs ne sont pas interchangeables : la puissance décide de la largeur de
// l'outil porté et du poids de remorque admissible. Une benne se décroche sur place et se
// reprend plus tard — c'est le même tracteur qui va en chercher une autre.
// Vierge tant qu'aucun outil n'a mordu la parcelle : c'est ce qui décide entre friche et
// chaume au repos. Le premier passage de déchaumeuse l'éteint pour de bon.
let vierge = true;
const silosOwned = { petit:false, grand:false };
// Prime de stockage : garder la récolte au lieu de la vendre le jour même se paie.
const primeSilos = () => SILOS.reduce((k,S) => k + (silosOwned[S.id] ? S.prime : 0), 0);
function acheterSilo(id){
  const S = siloDef(id);
  if (!S || silosOwned[id] || coins < S.prix) return false;
  coins -= S.prix; silosOwned[id] = true;
  montreSilo(id); applyUpgrades(); save();
  return true;
}
let nivTr = 0;
const bennesOwned = { b8:true, b14:false, b22:false };
let benneAtt = 'b8';                 // benne accrochée, ou null quand le tracteur roule seul
const bennesPosees = [];             // { id, obj, x, z, ang, hop, obst[] }
const benneAttDef = () => (benneAtt ? benneDef(benneAtt) : null);
const benneCompatible = b => b.force <= nivTr;
function optFor(kind){
  return { niv:nivTr, benne: kind === 'trailer' ? benneAtt : null };
}
function fleetGet(kind){
  if (!KINDS.includes(kind)) return null;
  if (!fleet[kind]){
    const v = vehicle(kind, optFor(kind)), n = KINDS.indexOf(kind);
    // Rangés côte à côte au fond de la cour, derrière les bâtiments. Alignés devant, comme
    // ils l'étaient, les cinq engins formaient un mur de vingt-trois mètres exactement en
    // travers du chemin entre le champ et la cour : impossible d'aller au silo sans se
    // frotter à sa propre flotte.
    v.pos.set(GATE.x + (n-2)*6.4, 0, YARD + 10.5);
    v.heading = Math.PI; v.h.position.set(v.pos.x, 0, v.pos.z);
    if (kind === 'trailer'){ v.hop = 0; v.paid = 0; v.cropId = crop().id; }
    const tw = v.g.userData.tool ? v.g.userData.tool.W : 4;
    v.lanes = lanesFor(tw); v.laneI = 0; v.done = false;
    v.path = []; v.head = 0; v.goto = null;
    fleet[kind] = v;
  }
  return fleet[kind];
}
function syncFleet(){ worker = fleet[STAGES[stage].k] || null; hauler = fleet.trailer; }
// Changer de tracteur ou de benne refait la machine, mais la partie continue : place, cap,
// chargement, tracé en cours et rangs sont repris tels quels sur le nouvel engin.
function rebuildVeh(kind){
  const o = fleet[kind]; if (!o) return null;
  scene.remove(o.h); libere(o.h);
  const v = vehicle(kind, optFor(kind));
  ['pos','heading','speed','hop','paid','cropId','path','head','goto','laneI','done',
   'detour','cote','trace','warned','augWant'].forEach(k => { if (o[k] !== undefined) v[k] = o[k]; });
  v.h.position.set(v.pos.x, 0, v.pos.z); v.h.rotation.y = v.heading;
  v.lanes = lanesFor(v.g.userData.tool ? v.g.userData.tool.W : 4);
  fleet[kind] = v; syncFleet();
  if (typeof drawVeh === 'function') drawVeh();
  return v;
}
// Le niveau vaut pour toute la flotte : le pulvérisateur et la moissonneuse changent de
// machine eux aussi, pas seulement les engins d'attelage.
function rebuildTracteurs(){ KINDS.forEach(k => { if (fleet[k]) rebuildVeh(k); }); }
// Une benne posée est un obstacle comme un autre : on l'inscrit avec les mêmes disques que
// ceux qu'elle avait en roulant, sinon les autres engins lui passeraient au travers.
function obstBenne(rec){
  const B = benneDef(rec.id);
  rec.obst = discsTractes(0, B.Lt, B.W).map(([off,r]) => {
    const o = { x:rec.x + Math.sin(rec.ang)*off, z:rec.z + Math.cos(rec.ang)*off, r };
    OBST.push(o); return o;
  });
}
function retirerObst(rec){
  (rec.obst||[]).forEach(o => { const i = OBST.indexOf(o); if (i >= 0) OBST.splice(i,1); });
  rec.obst = [];
}
function poserBenne(rec){
  const g = buildBenneSeule(rec.id);
  g.position.set(rec.x, 0, rec.z); g.rotation.y = rec.ang;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g); rec.obj = g;
  majBenneePosee(rec);
  obstBenne(rec);
  bennesPosees.push(rec);
}
function majBenneePosee(rec){
  const f = rec.obj && rec.obj.userData.fill, cap = benneDef(rec.id).cap;
  if (!f) return;
  f.visible = rec.hop > .5; f.scale.y = .01 + Math.min(1, rec.hop/cap)*.99;
}
// Le point d'attelage dans le monde : c'est la boule, pas le centre du tracteur.
const _bp = new THREE.Vector3();
function pointAttelage(v){
  v.h.updateMatrixWorld(true);
  v.g.userData.hitch.getWorldPosition(_bp);
  return _bp;
}
function decrocher(){
  const v = fleet.trailer;
  if (!v || !v.g.userData.benne) return 'rien';
  const p = pointAttelage(v);
  const rec = { id:v.g.userData.benne, hop:v.hop,
                x:p.x, z:p.z, ang:v.heading + v.g.userData.hitch.rotation.y };
  benneAtt = null;
  const n = rebuildVeh('trailer'); n.hop = 0;
  poserBenne(rec);
  applyUpgrades();                    // plus de benne, plus de charge : la jauge doit le dire
  save();
  return benneDef(rec.id).n;
}
function benneAPortee(){
  const v = fleet.trailer; if (!v || v.g.userData.benne) return -1;
  const p = pointAttelage(v);
  let best = -1, bd = 5;
  bennesPosees.forEach((r,i) => {
    const d = Math.hypot(r.x-p.x, r.z-p.z);
    if (d < bd && benneCompatible(benneDef(r.id))){ bd = d; best = i; }
  });
  return best;
}
function raccrocher(){
  const v = fleet.trailer; if (!v) return null;
  if (v.g.userData.benne) return null;
  const i = benneAPortee(); if (i < 0) return null;
  const rec = bennesPosees.splice(i,1)[0];
  retirerObst(rec);
  scene.remove(rec.obj); libere(rec.obj);
  benneAtt = rec.id;
  const n = rebuildVeh('trailer'); n.hop = rec.hop;
  // la benne reprend l'angle où elle était posée : sans ça elle pivote d'un coup dans l'axe
  let rel = rec.ang - n.heading;
  while(rel >  Math.PI) rel -= 6.28318;
  while(rel < -Math.PI) rel += 6.28318;
  n.g.userData.hitch.rotation.y = Math.max(-.95, Math.min(.95, rel));
  applyUpgrades(); save();
  return benneDef(rec.id).n;
}
// Une benne neuve arrive rangée au fond de la cour : on va la chercher avec le tracteur.
function placeLibre(k){
  return { x: GATE.x - 8.5 + k*6.5, z: YARD + 16.5, ang: Math.PI };
}
function livrerBenne(id){
  const pris = bennesPosees.map(r => r.pl).filter(n => n !== undefined);
  let k = 0; while(pris.includes(k)) k++;
  const q = placeLibre(k);
  poserBenne({ id, hop:0, x:q.x, z:q.z, ang:q.ang, pl:k });
}
function pilote(){ return fleet[driven] || null; }
const CAP0 = 900, TRCAP0 = 1800;   // une trémie qui tient un vrai bout de parcelle
let CAP = CAP0, TRCAP = TRCAP0;
const elNow = null;

function refreshNow(){
  if (typeof drawCropBtn === 'function') drawCropBtn();
  if (typeof drawVeh === 'function') drawVeh();
}
// Ne fait plus que remettre l'affichage et les rangs à jour. Effacer la parcelle et payer
// la semence appartiennent au cycle, pas au choix d'un engin : tant qu'ils étaient ici,
// reprendre la déchaumeuse remettait tout le champ à nu d'un coup, et reprendre le semoir
// repayait la semence.
function startStage(){
  const s = STAGES[stage];
  document.querySelectorAll('#steps .step').forEach((e,i) => {
    e.classList.toggle('on', i === stage);
    e.classList.toggle('done', i < stage);
  });
  refreshNow();
  if (s.k !== 'grow') fleetGet(s.k);   // l'engin du chantier existe, mais rien n'est détruit
  syncFleet();
  if (worker){ worker.lanes = lanesFor(toolW(worker)); worker.laneI = 0; worker.done = false; }
}
function toolW(v){ return v && v.g.userData.tool ? v.g.userData.tool.W : 4; }
// la semence est une vraie dépense : trop juste, on retombe sur le blé, qui ne coûte rien
function paySeed(){
  const c = crop();
  if (!c.seed) return;
  if (coins >= c.seed){
    coins -= c.seed;
    toast('Semence ' + c.emo + ' ' + c.n + ' : −' + c.seed + ' 🪙');
  } else {
    cropI = 0; applyCrop(); refreshNow();
    toast('Trésorerie trop juste : on sème du blé', 'bad'); sfx('deny');
  }
  save();
}
function nextStage(){
  const fini = STAGES[stage];
  const suivait = driven === fini.k;   // on conduisait celui qui vient de finir : on suit le chantier
  stage = (stage+1) % STAGES.length;
  if (stage === 0){ harvests++; SWATH.reset(); }   // cycle bouclé : la parcelle repart à nu
  if (STAGES[stage].k === 'sow') paySeed();        // la semence se règle en entrant au semis
  startStage(); sfx('stage'); save();
  if (fleet[fini.k]) fleet[fini.k].done = true;
  if (suivait){
    const k = STAGES[stage].k;
    if (KINDS.includes(k)){ driven = k; syncFleet(); drawVeh(); }
  }
  toast(fini.ic + ' ' + fini.n + ' — terminé !', 'good');
  confetti(stage === 0 ? 34 : 14);
}
// Changer d'étape ne déplace ni ne supprime rien : chaque engin reste où il est.
function switchTo(i){
  if (i === stage) return;
  stage = i; startStage();
}

// ---------- son : tout est synthétisé, aucun fichier à charger ----------
const SND = (function(){
  let ctx = null, master = null, eng = null, engG = null, rainG = null, on = true;
  function boot(){
    if (!on) return;
    // le contexte peut naître suspendu (politique d'autoplay) : on le relance à chaque geste
    if (ctx){ if (ctx.state === 'suspended') ctx.resume().catch(()=>{}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch(e){ return; }
    master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination);
    engG = ctx.createGain(); engG.gain.value = 0;                 // ronflement moteur
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 640;
    eng = ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 58;
    eng.connect(lp); lp.connect(engG); engG.connect(master); eng.start();
    const len = Math.floor(ctx.sampleRate*2);                    // pluie : bruit blanc filtré
    const buf = ctx.createBuffer(1,len,ctx.sampleRate), ch = buf.getChannelData(0);
    for(let i=0;i<len;i++) ch[i] = (Math.random()*2-1)*.5;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = .5;
    rainG = ctx.createGain(); rainG.gain.value = 0;
    src.connect(bp); bp.connect(rainG); rainG.connect(master); src.start();
  }
  return {
    boot,
    isOn(){ return on; },
    set(v){ on = v; if (on){ boot(); if (master) master.gain.value = .5; }
            else if (master) master.gain.value = 0; return on; },
    toggle(){ return this.set(!on); },
    engine(spd, working){
      if (!ctx || !on) return;
      eng.frequency.setTargetAtTime(50 + spd*13, ctx.currentTime, .12);
      engG.gain.setTargetAtTime(working ? .045 + spd*.011 : 0, ctx.currentTime, .25);
    },
    rain(a){ if (!ctx || !on) return; rainG.gain.setTargetAtTime(a*.11, ctx.currentTime, .6); },
    blip(f0,f1,dur,type,vol){
      if (!ctx || !on) return;
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = type || 'triangle'; o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t+dur);
      g.gain.setValueAtTime(.0001, t);
      g.gain.linearRampToValueAtTime(vol || .2, t+.012);
      g.gain.exponentialRampToValueAtTime(.0001, t+dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+.03);
    }
  };
})();
function sfx(k){
  if (k === 'coin')  SND.blip(880,1320,.12,'triangle',.13);
  else if (k === 'cash'){ SND.blip(660,990,.16,'square',.13);
                          setTimeout(()=>SND.blip(990,1480,.2,'square',.11), 90); }
  else if (k === 'buy')   SND.blip(420,780,.2,'square',.16);
  else if (k === 'deny')  SND.blip(240,130,.18,'sawtooth',.13);
  else if (k === 'stage') SND.blip(520,790,.22,'triangle',.15);
}

// l'audio ne peut démarrer qu'après un vrai geste de l'utilisateur
['pointerdown','keydown','touchstart'].forEach(ev =>
  addEventListener(ev, () => SND.boot(), { passive:true }));

// grands nombres : 57 600 ne tient pas dans une pastille, 57,6 k oui
const dec1 = v => v.toFixed(1).replace('.0','').replace('.', ',');
function fmt(n){
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('fr-FR');
  if (n < 100000) return dec1(n/1000) + ' k';
  if (n < 1000000) return Math.round(n/1000) + ' k';
  return dec1(n/1000000) + ' M';
}

// chaque bouton répond : sans retour sonore, l'interface reste plate
addEventListener('pointerdown', e => {
  if (e.target.closest && e.target.closest('.btn, .tab, .buy, #sheetX'))
    SND.blip(720, 940, .06, 'triangle', .09);
}, true);

// ---------- messages fugaces ----------
const toastEl = document.getElementById('toast');
function toast(msg, cls){
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = msg;
  toastEl.appendChild(d);
  setTimeout(()=>{ d.style.transition = 'opacity .4s'; d.style.opacity = '0'; }, 1800);
  setTimeout(()=>d.remove(), 2300);
}

// ---------- améliorations ----------
// Plus rien ne s'achète qui touche à la conduite. La transmission jouait sur le braquage et
// la reprise, le moteur sur la vitesse : au bout de quelques niveaux l'engin filait si vite
// et braquait si court qu'il ne rattrapait plus le tracé qu'on venait de lui dessiner. Un
// engin se pilote donc pareil du premier au dernier jour, et la boutique s'occupe du reste.
const UPGRADES = [
  { id:'tremie',  n:'Trémie',      emo:'🛢️', d:'Capacité de récolte',   max:5, base:2800 },
  { id:'semence', n:'Fertilisant', emo:'🌿', d:'Vitesse de pousse',     max:5, base:2600 },
  { id:'negoce',  n:'Négoce',      emo:'💵', d:'Prix de vente au silo', max:5, base:3200 }
];
const upCost = (u,l) => Math.round(u.base*Math.pow(1.8,l)/50)*50;
const lv = {}; UPGRADES.forEach(u => lv[u.id] = 0);
const owned = { ble:true, colza:false, mais:false };
let totalT = 0, harvests = 0;
const level = () => 1 + Math.floor(Math.sqrt(totalT/1500));
function applyUpgrades(){
  MAXSPD = MAXSPD0;                                // la vitesse ne s'achète pas
  RMIN   = RMIN0;                                  // le braquage non plus
  ACC    = 10;                                     // la reprise non plus
  CAP    = Math.round(CAP0  *(1 + .28*lv.tremie));
  // La benne attelée décide de ce qu'on emporte. Décroché, le tracteur ne charge rien.
  const B = typeof benneAttDef === 'function' ? benneAttDef() : null;
  TRCAP  = B ? Math.round(B.cap*(1 + .28*lv.tremie)) : 0;
  GROWK  = 1 + .22*lv.semence;
  PRICEK = (1 + .16*lv.negoce) * (1 + primeSilos());
}
applyUpgrades();

// ---------- contrats de livraison ----------
const elContract = document.getElementById('contract');
let contract = null;
function newContract(){
  const pool = CROPS.filter(c => owned[c.id]);
  const c = pool[Math.floor(Math.random()*pool.length)];
  const qty = Math.round((700 + Math.random()*900)*(1 + .18*(level()-1))/25)*25;
  contract = { crop:c.id, qty, got:0, reward:Math.round(qty*c.price*PRICEK*.5/50)*50 };
  drawContract();
}
function drawContract(){
  if (!contract){ elContract.classList.remove('on'); return; }
  const c = CROPS.find(x => x.id === contract.crop);
  const f = Math.min(1, contract.got/contract.qty);
  elContract.classList.add('on');
  elContract.innerHTML =
    '<div class="hd">📋 <span>' + c.emo + ' <b>' + Math.floor(contract.got) + '</b> / ' +
    contract.qty + ' t</span><span class="sp"></span><span>🪙 <b>' + fmt(contract.reward) + '</b></span></div>' +
    '<div class="bar"><i style="width:' + (f*100).toFixed(1) + '%"></i></div>';
}
function contractDeliver(cropId, t){
  if (!contract || contract.crop !== cropId) return;
  contract.got += t;
  if (contract.got >= contract.qty){
    coins += contract.reward;
    toast('Contrat rempli : +' + fmt(contract.reward) + ' 🪙', 'good');
    confetti(26); sfx('cash');
    contract = null; drawContract(); save();
    setTimeout(newContract, 1400);
  } else drawContract();
}

// ---------- journée et météo ----------
const DAYLEN = 300;                                   // 5 minutes de jeu par journée
let day = 1, dayT = .34;                              // 0 = minuit, .5 = midi
// La nuit reste lisible : c'est un clair de lune bleu, pas un écran noir.
const SKY = [
  { t:0,   sky:'#2c4272', hs:'#9fb0dd', hg:'#3b5236', hi:.72, si:.26, sc:'#b6c6f2', nuit:1 },
  { t:.23, sky:'#42598a', hs:'#a9b6d8', hg:'#41573a', hi:.74, si:.28, sc:'#c0cdf0', nuit:.85 },
  { t:.31, sky:'#7d9c50', hs:'#ffd3a4', hg:'#4d6a30', hi:.78, si:.38, sc:'#ffbe83', nuit:.25 },
  { t:.5,  sky:'#54a52e', hs:'#ffffff', hg:'#4e8a34', hi:.88, si:.50, sc:'#fff6de', nuit:0 },
  { t:.68, sky:'#5da03a', hs:'#ffeccd', hg:'#4e7c31', hi:.84, si:.46, sc:'#ffdda9', nuit:0 },
  { t:.78, sky:'#a68350', hs:'#ffd0aa', hg:'#556031', hi:.78, si:.36, sc:'#ff9f5e', nuit:.45 },
  { t:.87, sky:'#4a5c88', hs:'#a2aecf', hg:'#3a4c30', hi:.74, si:.28, sc:'#b6c3ec', nuit:.95 },
  { t:1,   sky:'#2c4272', hs:'#9fb0dd', hg:'#3b5236', hi:.72, si:.26, sc:'#b6c6f2', nuit:1 }
];
const WEATHER = {
  clear: { n:'Dégagé',  emo:'☀️', dim:1,   wind:.10, rain:0, mud:1 },
  cloud: { n:'Nuageux', emo:'⛅', dim:.84, wind:.18, rain:0, mud:1 },
  rain:  { n:'Pluie',   emo:'🌧️', dim:.58, wind:.27, rain:1, mud:.86 }
};
let wKey = 'clear', wNext = 60, curDim = 1, curWind = .1, curRain = 0, nightK = 0;
const _cA = new THREE.Color(), _cB = new THREE.Color(), _cX = new THREE.Color();
function skyAt(t){
  let i = 0;
  while (i < SKY.length-2 && t > SKY[i+1].t) i++;
  const a = SKY[i], b = SKY[i+1], f = (t-a.t)/Math.max(1e-6, b.t-a.t);
  const mix = (ka,kb) => _cX.set(_cA.set(ka)).lerp(_cB.set(kb), f).getHex();
  return { sky:mix(a.sky,b.sky), hs:mix(a.hs,b.hs), hg:mix(a.hg,b.hg),
           hi:a.hi+(b.hi-a.hi)*f, si:a.si+(b.si-a.si)*f, sc:mix(a.sc,b.sc),
           nuit:a.nuit+(b.nuit-a.nuit)*f };
}
function weatherTick(dt){
  wNext -= dt;
  if (wNext <= 0){
    const r = Math.random();
    const k = r < .50 ? 'clear' : r < .80 ? 'cloud' : 'rain';
    wNext = 45 + Math.random()*75;
    if (k !== wKey){ wKey = k; toast(WEATHER[k].emo + ' ' + WEATHER[k].n); }
  }
  const W = WEATHER[wKey], k = Math.min(1, dt*.45);
  curDim  += (W.dim - curDim)*k;
  curWind += (W.wind - curWind)*k;
  curRain += (W.rain - curRain)*k;
  mudK = 1 - (1 - W.mud)*curRain;
  UW.amp.value = curWind;
}
const RAIN = (function(){
  const N = 440;
  const g = new THREE.BoxGeometry(.1,1.7,.1);          // vues de loin, des traits fins seraient invisibles
  const m = new THREE.InstancedMesh(g,
    new THREE.MeshBasicMaterial({ color:'#cfe6f6', transparent:true, opacity:.6, depthWrite:false }), N);
  m.frustumCulled = false; m.visible = false; m.renderOrder = 3; scene.add(m);
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
  for(let i=0;i<N;i++){ px[i]=(Math.random()-.5)*74; py[i]=Math.random()*26; pz[i]=(Math.random()-.5)*74; }
  const d = new THREE.Object3D();
  d.rotation.set(.14,0,.1);
  return { update(dt, amount, cx, cz){
    m.visible = amount > .03;
    if (!m.visible) return;
    m.material.opacity = .62*amount;
    const n = Math.round(N*amount);
    for(let i=0;i<N;i++){
      py[i] -= (26 + (i%9)*1.4)*dt;
      if (py[i] < 0){ py[i] += 26; px[i]=(Math.random()-.5)*74; pz[i]=(Math.random()-.5)*74; }
      d.position.set(cx+px[i], py[i], cz+pz[i]);
      d.scale.set(1, i < n ? 1 : 0, 1);
      d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }};
})();

// ---------- sauvegarde ----------
const SKEY = 'ferme.cycle.v1';
function save(){
  try {
    localStorage.setItem(SKEY, JSON.stringify({
      v:1, coins, stock, totalT, harvests, lv, owned, cropI, stage, day, dayT,
      nivTr, bennes:bennesOwned, benneAtt, vierge, silos:silosOwned,
      posees: bennesPosees.map(r => ({ id:r.id, hop:Math.round(r.hop),
                x:+r.x.toFixed(2), z:+r.z.toFixed(2), ang:+r.ang.toFixed(3), pl:r.pl })),
      contract, son:SND.isOn(), ctrl:ctrlMode, conduit:driven,
      vue:{ z:+zoom.toFixed(3), p:+PITCH.toFixed(4), v:2 }
    }));
  } catch(e){ /* mode privé : on joue sans sauvegarde */ }
}
function restore(){
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch(e){ d = null; }
  if (!d || d.v !== 1) return null;
  coins = +d.coins || 0; stock = +d.stock || 0;
  totalT = +d.totalT || 0; harvests = +d.harvests || 0;
  UPGRADES.forEach(u => { lv[u.id] = Math.max(0, Math.min(u.max, +d.lv?.[u.id] || 0)); });
  SILOS.forEach(S => { if (d.silos && d.silos[S.id]){ silosOwned[S.id] = true; montreSilo(S.id); } });
  vierge = d.vierge === undefined ? (+d.harvests || 0) === 0 && (+d.stage || 0) === 0 : !!d.vierge;
  nivTr = Math.max(0, Math.min(2, +d.nivTr || 0));
  BENNES.forEach(b => { if (d.bennes && d.bennes[b.id]) bennesOwned[b.id] = true; });
  bennesOwned.b8 = true;                                  // la petite benne fait partie du lot
  // Une benne trop lourde pour le tracteur enregistré ne peut pas rester attelée : on la
  // laisse au parc plutôt que de la traîner avec un engin qui n'en a pas la force.
  benneAtt = (d.benneAtt && bennesOwned[d.benneAtt] && benneCompatible(benneDef(d.benneAtt)))
             ? d.benneAtt : null;
  bennesPosees.length = 0;
  (Array.isArray(d.posees) ? d.posees : []).forEach(r => {
    if (!benneDef(r.id) || !bennesOwned[r.id]) return;
    poserBenne({ id:r.id, hop:+r.hop || 0, x:+r.x || 0, z:+r.z || 0, ang:+r.ang || 0, pl:r.pl });
  });
  // au pire — sauvegarde d'avant les niveaux — la benne de départ existe quelque part
  if (!benneAtt && !bennesPosees.some(r => r.id === 'b8')) benneAtt = 'b8';
  CROPS.forEach(c => { if (d.owned && d.owned[c.id]) owned[c.id] = true; });
  cropI = Math.max(0, Math.min(CROPS.length-1, +d.cropI || 0));
  if (!owned[CROPS[cropI].id]) cropI = 0;
  stage = Math.max(0, Math.min(STAGES.length-1, +d.stage || 0));
  day = Math.max(1, +d.day || 1); dayT = +d.dayT || .3;
  contract = d.contract && d.contract.qty ? d.contract : null;
  if (d.son === false) SND.set(false);
  if (CTRL.some(c => c.id === d.ctrl)) ctrlMode = d.ctrl;
  if (KINDS.includes(d.conduit)) driven = d.conduit;
  // Le cadrage d'usine a changé : une vue enregistrée avant ce réglage est périmée, on la
  // laisse tomber une fois pour reprendre 50° et ×1,25. Ce que le joueur règle ensuite est
  // conservé comme avant.
  if (d.vue && d.vue.v === 2){
    if (d.vue.z) zoom = Math.max(.45, Math.min(3.2, d.vue.z));
    if (d.vue.p) PITCH = Math.max(.48, Math.min(1.49, d.vue.p));
  }
  applyCamera();
  applyUpgrades();
  return d;
}
function wipe(){
  try { localStorage.removeItem(SKEY); } catch(e){}
  location.reload();
}
// remet la parcelle dans l'état où elle doit être au début de l'étape reprise
function paintParcel(layer){
  for(let z = Z0; z <= Z0+P+.01; z += .5) SWATH.add(layer, X0+P/2, z, 0, P, z > Z0);
}
function primeField(st){
  SWATH.reset();
  // À l'étape « préparer », la parcelle n'est pas dans le même état selon qu'on n'y a
  // jamais touché ou qu'on vient d'en sortir une récolte : friche au tout premier jour,
  // chaume ensuite. Le fond de parcelle EST la friche, il n'y a donc rien à peindre
  // dessus tant qu'elle est vierge.
  const repos = vierge ? 0 : 4;
  const state = [repos,1,2,3,3][st], g0 = [0,0,.05,.34,1][st];
  const layer = st === 0 ? (vierge ? -1 : 3) : [0,0,1,2,2][st];
  fillCells(state);
  if (layer >= 0) paintParcel(layer);
  // La friche porte ses repousses sèches, le chaume sa paille de moisson ; une terre
  // travaillée, elle, est nue.
  const sec = state === 0 ? 2 : state === 4 ? 1 : 0;
  for(let k=0;k<plants.length;k++){ plants[k].g = g0; plants[k].r = sec; }
  redrawPlants();
}
