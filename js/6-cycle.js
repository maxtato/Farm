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
function vehicle(spec){
  brakeLights = []; headlamps = []; beacons = [];
  const g = build(spec);
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
  const B = g.userData.corps || CORPS.prep;
  return { kind:spec.kind, g, h, trav, pos:GATE.clone(), heading:Math.PI, speed:0, steerA:0, turnRate:0,
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
// Les rangs balaient le champ colonne par colonne. Le champ n'étant plus un carré, chaque
// colonne s'arrête là où la terre s'arrête : on cherche par balayage le premier et le
// dernier point de la colonne qui tombent dedans, et on vise trois mètres au-delà pour que
// l'outil sorte franchement du bord. Une colonne qui ne rencontre rien est sautée.
// La tournière : un tour du champ avant les rangs. Les rangs sont des bandes droites, et
// le long d'un bord oblique l'engin coupe fatalement l'angle en fin de rang — il restait
// une lisière intacte tout autour, jusqu'à quatre mètres par endroits, alors que les rangs
// couvrent bien cent pour cent de la terre sur le papier. La perte était dans la conduite,
// pas dans le tracé. C'est d'ailleurs par là que commence le vrai travail d'un champ.
function tourniere(W){
  if (!POLY || POLY.length < 8) return [];
  // Le contour du champ est découpé, donc très dense : on le ramène d'abord à ses sommets
  // utiles — inutile de faire suivre une dentelle au décimètre à un tracteur — puis on le
  // rééchantillonne tous les cinq mètres. Simplifier seul ne laissait que huit sommets pour
  // cent soixante mètres de tour : l'engin aurait coupé le bord en cordes de dix-neuf
  // mètres, c'est-à-dire refait exactement ce qu'on cherche à éviter.
  const b = densifierPas(simplifier(POLY, .9), 5), n = b.length, brut = [];
  for(let i=0;i<n;i++){
    const a = b[(i-1+n)%n], c = b[(i+1)%n], q = b[i];
    const tx = c[0]-a[0], tz = c[1]-a[1], L = Math.hypot(tx,tz) || 1;
    const x = q[0] - (tz/L)*W*.5, z = q[1] + (tx/L)*W*.5;   // normale rentrante
    // Dans un angle rentrant, le décalage peut sortir du champ : on ne garde que ce qui
    // tombe vraiment sur la terre.
    if (parcelInset(x, z) > W*.28) brut.push([x, z]);
  }
  if (brut.length < 4) return [];
  const out = brut.map(q => new THREE.Vector3(q[0], 0, q[1]));
  out.push(out[0].clone());                              // on referme le tour
  return out;
}
function lanesFor(W){
  const L = [], cols = Math.max(1, Math.ceil(P/W)), PAS = 1;
  for(let i=0;i<cols;i++){
    const x = X0 + W/2 + i*((P-W)/Math.max(1,cols-1));
    let z0 = null, z1 = null;
    // On sonde toute la largeur de l'outil, pas seulement son axe. Sur un champ qui
    // s'évase — et une parcelle de la carte s'évase toujours — le bord du passage atteint
    // de la terre que son milieu n'atteint pas : un rang calé sur le seul milieu laissait
    // la moitié du champ intacte, et le chantier se déclarait fini quand même.
    for(let u=-W/2; u<=W/2+1e-6; u+=Math.max(.5, W/6))
      for(let z=Z0; z<=Z0+P; z+=PAS)
        if (parcelInset(x+u, z) > 0){
          if (z0 === null || z < z0) z0 = z;
          if (z1 === null || z > z1) z1 = z;
        }
    // On ne saute une colonne que si elle ne rencontre aucune terre. Elle était aussi
    // écartée quand le champ y tenait sur moins d'une demi-largeur d'outil — or sur une
    // parcelle qui se termine en pointe, les colonnes extrêmes sont précisément de fines
    // langues de terre. Elles n'étaient jamais labourées, et rien ne pouvait plus les
    // atteindre : deux colonnes sur dix perdues, treize mètres de terre inaccessibles au
    // pilote automatique le long du bord ouest.
    if (z0 === null) continue;
    const a = z0 - 3, b = z1 + 3;
    L.push(new THREE.Vector3(x,0, i%2 ? b : a));
    L.push(new THREE.Vector3(x,0, i%2 ? a : b));
  }
  const T = tourniere(W);
  const tout = T.concat(L);
  return tout.length ? tout : [new THREE.Vector3(X0+P/2,0,Z0), new THREE.Vector3(X0+P/2,0,Z0+P)];
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
// L'empreinte de l'outil à un endroit donné : le rectangle largeur × profondeur, dans son
// repère, reporté sur la grille de cellules.
function tamponOutil(x, z, p, fn){
  const cs = Math.cos(-p.a), sn = Math.sin(-p.a);
  const R = p.W/2 + Math.max(Math.abs(p.near), Math.abs(p.far)) + .5;
  const i0 = Math.max(0, Math.floor((x-R-X0)/CS)), i1 = Math.min(NS-1, Math.ceil((x+R-X0)/CS));
  const j0 = Math.max(0, Math.floor((z-R-Z0)/CS)), j1 = Math.min(NS-1, Math.ceil((z+R-Z0)/CS));
  let n = 0;
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
    const cx = X0+(i+.5)*CS, cz = Z0+(j+.5)*CS;
    const dx = cx-x, dz = cz-z;
    const lx = dx*cs+dz*sn, lz = -dx*sn+dz*cs;
    if (Math.abs(lx) < p.W/2 && lz > p.near && lz < p.far) n += fn(j*NS+i) ? 1 : 0;
  }
  return n;
}
// Le sol se marquait à la seule position de l'instant. Or une déchaumeuse ne mord que sur
// soixante-cinq centimètres de profondeur : dès que l'outil avance de plus que cela entre
// deux images — en vitesse ×6, ou sur une machine lente — il laisse derrière lui des bandes
// intactes, que le ruban dessine pourtant pleines. L'image et le compte se contredisaient,
// et le chantier se déclarait fini sur un champ à moitié travaillé.
// On repasse donc tout le segment parcouru depuis le dernier marquage.
const PAS_TAMPON = .3;
function applyTool(v, fn){
  const p = toolPose(v); if (!p) return 0;
  const px = v.apX, pz = v.apZ;
  // un saut trop grand n'est pas un passage : l'engin a été reposé, ou il revient de la cour
  const d = px === undefined ? 0 : Math.hypot(p.x-px, p.z-pz);
  const n = (d > .01 && d < 14)
    ? (function(){ let t = 0, k = Math.ceil(d/PAS_TAMPON);
        for(let s=1;s<=k;s++){ const f = s/k;
          t += tamponOutil(px + (p.x-px)*f, pz + (p.z-pz)*f, p, fn); }
        return t; })()
    : tamponOutil(p.x, p.z, p, fn);
  v.apX = p.x; v.apZ = p.z;
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
// De quoi équiper une ferme au minimum — un tracteur, une déchaumeuse, un semoir, une
// benne et une moissonneuse font 16 500 — et un peu de marge pour choisir où mettre le
// reste. Tout ce qui suit se gagne au silo.
const COINS0 = 18000;
let stage = 0, coins = COINS0, stock = 0;
// Vierge tant qu'aucun outil n'a mordu la parcelle : c'est ce qui décide entre friche et
// chaume au repos. Le premier passage de déchaumeuse l'éteint pour de bon.
let vierge = true;
let siloNiv = -1;                 // -1 = pas de silo à soi, 0 = petit, 1 = grand
// Prime de stockage : garder la récolte au lieu de la vendre le jour même se paie.
const primeSilos = () => siloNiv >= 0 ? SILOS[siloNiv].prime : 0;
function acheterSilo(){
  if (siloNiv >= 0 || coins < SILOS[0].prix) return false;
  coins -= SILOS[0].prix; siloNiv = 0;
  montreSilo(0); applyUpgrades(); save();
  return true;
}
// Le grand silo ne s'achète pas : il remplace le petit, contre la différence, l'ancien
// étant repris à moitié prix comme n'importe quelle pièce du parc.
function ameliorerSilo(){
  if (siloNiv !== 0) return null;
  const net = coutAmelioration([SILOS[0].prix, SILOS[1].prix], 0, 1);
  if (coins < net) return null;
  coins -= net; siloNiv = 1;
  montreSilo(1); applyUpgrades(); save();
  return net;
}

// ---------- le parc : des pièces, pas des postes ----------
// Rien n'est solidaire de rien. On achète autant de tracteurs qu'on veut, autant d'outils
// qu'on veut, et chaque pièce monte en gamme de son côté. N'importe quel outil se pose
// derrière n'importe quel tracteur assez fort pour le tirer : c'est la seule règle.
// `engins` = ce qui roule et se pilote — chaque véhicule porte sa propre fiche.
// `outils` = ce qui s'attelle, qu'il soit accroché ou posé au sol.
let idSeq = 1;
const engins = [];
const outils = [];
let driven = 0;                 // identifiant de l'engin qui répond aux commandes
let worker = null, hauler = null;
const enginPar = id => engins.find(e => e.pid === id) || null;
const outilPar = id => outils.find(o => o.oid === id) || null;
const pilote = () => enginPar(driven);
const outilDe = v => (v && v.outil) ? outilPar(v.outil) : null;
// Un outil ne se pose que derrière un tracteur assez fort pour le tirer.
const tirable = (o, v) => !!v && v.kind === 'tracteur' && OUTILS[o.type].force[o.niv] <= v.niv;
// Ce que l'engin emporte : capacité de la benne accrochée, zéro s'il n'en a pas.
function capDe(v){
  const o = outilDe(v);
  return (o && o.type === 'benne') ? Math.round(BENNES[o.niv].cap*(1 + .28*lv.tremie)) : 0;
}
function specDe(v){
  if (v.kind === 'tracteur'){
    const o = outilDe(v);
    return { kind:'tracteur', niv:v.niv, outil: o ? { type:o.type, niv:o.niv } : null };
  }
  return { kind:v.kind, niv:v.niv, bec:v.bec };
}
// Refaire une machine ne doit rien coûter à la partie : place, cap, chargement, tracé en
// cours et rangs passent sur la neuve, et sa fiche la suit.
const FICHE = ['pid','kind','niv','bec','outil'];
const GARDE = ['pos','heading','speed','hop','paid','cropId','path','head','goto','laneI',
               'done','detour','cote','trace','warned','augWant'];
function poser(v){                       // finitions communes à toute machine montée
  v.metier = v.g.userData.metier || null;
  v.h.position.set(v.pos.x, 0, v.pos.z); v.h.rotation.y = v.heading;
  v.lanes = lanesFor(v.g.userData.tool ? v.g.userData.tool.W : 4);
  return v;
}
function monter(anc){
  scene.remove(anc.h); libere(anc.h);
  const v = vehicle(specDe(anc));
  FICHE.forEach(k => v[k] = anc[k]);
  GARDE.forEach(k => { if (anc[k] !== undefined) v[k] = anc[k]; });
  const i = engins.indexOf(anc); if (i >= 0) engins[i] = v;
  poser(v); syncFleet();
  if (typeof drawVeh === 'function') drawVeh();
  return v;
}
// Les engins neufs se rangent en épi au fond de la cour, derrière les bâtiments.
// Les engins se rangent en épi dans la moitié ouest de la cour, les outils au sol dans la
// moitié est : sans quoi un semoir posé se retrouvait sous le nez d'un tracteur.
const placeParc = n => ({ x: COUR.x0 + 4 + (n % 6)*6.4, z: COUR.z0 + 5 + Math.floor(n/6)*8 });
function creerEngin(kind, niv){
  const v = vehicle(kind === 'tracteur' ? { kind, niv, outil:null } : { kind, niv, bec:0 });
  v.pid = idSeq++; v.kind = kind; v.niv = niv; v.bec = 0; v.outil = null;
  const q = placeParc(engins.length);
  v.pos.set(q.x, 0, q.z); v.heading = Math.PI;
  v.laneI = 0; v.done = false; v.path = []; v.head = 0; v.goto = null;
  v.hop = 0; v.paid = 0; v.cropId = crop().id;
  engins.push(v); poser(v);
  if (!driven) driven = v.pid;
  syncFleet();
  return v;
}
// `worker` : l'engin dont le métier est celui du chantier — celui qu'on conduit en
// priorité, sinon le premier qui sait le faire. `hauler` : celui qui porte une benne.
function syncFleet(){
  const k = STAGES[stage].k, p = pilote();
  worker = (p && p.metier === k) ? p : (engins.find(v => v.metier === k) || null);
  hauler = (p && p.g.userData.benne) ? p : (engins.find(v => v.g.userData.benne) || null);
}
const possede = k => k === 'trailer' ? engins.some(v => v.g.userData.benne)
                                     : engins.some(v => v.metier === k);

// ---------- outils posés au sol : ils encombrent la cour comme le reste ----------
function obstOutil(o){
  o.obst = discsTractes(0, o.Lt, o.Wc).map(([off,r]) => {
    const q = { x:o.x + Math.sin(o.ang)*off, z:o.z + Math.cos(o.ang)*off, r };
    OBST.push(q); return q;
  });
}
function retirerObst(o){
  (o.obst||[]).forEach(q => { const i = OBST.indexOf(q); if (i >= 0) OBST.splice(i,1); });
  o.obst = [];
}
function poserOutil(o){
  const g = buildOutilSeul(o.type, o.niv);
  g.position.set(o.x, 0, o.z); g.rotation.y = o.ang;
  g.traverse(n => { if (n.isMesh) n.castShadow = true; });
  scene.add(g);
  o.obj = g; o.Lt = g.userData.Lt; o.Wc = g.userData.Wc;
  majOutilPose(o); obstOutil(o);
}
function relever(o){                     // on le reprend : plus rien au sol
  if (!o.obj) return;
  retirerObst(o); scene.remove(o.obj); libere(o.obj); o.obj = null;
}
function majOutilPose(o){
  const f = o.obj && o.obj.userData.fill;
  if (!f) return;
  const cap = BENNES[o.niv].cap;
  f.visible = o.hop > .5; f.scale.y = .01 + Math.min(1, o.hop/cap)*.99;
}
// Une pièce neuve arrive rangée au fond de la cour : on va la chercher avec un tracteur.
const placeOutil = n => ({ x: COUR.x0 + 4 + (n % 6)*6.4, z: COUR.z1 - 4, ang: Math.PI });
function creerOutil(type, niv){
  const D = OUTILS[type]; if (!D) return null;
  const q = placeOutil(outils.filter(o => !o.porteur).length);
  const o = { oid:idSeq++, type, niv, hop:0, porteur:null,
              x:q.x, z:q.z, ang:q.ang, obj:null, obst:[], Lt:4.7, Wc:2 };
  outils.push(o); poserOutil(o);
  return o;
}
// Le point d'attelage dans le monde : c'est la boule, pas le centre du tracteur.
const _bp = new THREE.Vector3();
function pointAttelage(v){
  if (!v || !v.g.userData.hitch) return null;
  v.h.updateMatrixWorld(true);
  v.g.userData.hitch.getWorldPosition(_bp);
  return _bp;
}
function decrocher(v){
  v = v || pilote();
  if (!v || !v.outil) return null;
  const o = outilPar(v.outil); if (!o) return null;
  const p = pointAttelage(v);
  o.x = p.x; o.z = p.z; o.ang = v.heading + v.g.userData.hitch.rotation.y;
  o.hop = o.type === 'benne' ? v.hop : 0;
  o.porteur = null; v.outil = null;
  const n = monter(v); n.hop = 0;
  poserOutil(o);
  applyUpgrades(); save();
  return o;
}
function outilAPortee(v){
  v = v || pilote();
  if (!v || v.kind !== 'tracteur' || v.outil) return null;
  const p = pointAttelage(v); if (!p) return null;
  let best = null, bd = 5;
  outils.forEach(o => {
    if (o.porteur || !tirable(o, v)) return;
    const d = Math.hypot(o.x-p.x, o.z-p.z);
    if (d < bd){ bd = d; best = o; }
  });
  return best;
}
function raccrocher(v){
  v = v || pilote();
  const o = outilAPortee(v); if (!o) return null;
  relever(o);
  o.porteur = v.pid; v.outil = o.oid;
  const n = monter(v);
  if (o.type === 'benne') n.hop = o.hop;
  // l'outil reprend l'angle où il était posé : sans ça il pivote d'un coup dans l'axe
  let rel = o.ang - n.heading;
  while(rel >  Math.PI) rel -= 6.28318;
  while(rel < -Math.PI) rel += 6.28318;
  n.g.userData.hitch.rotation.y = Math.max(-.95, Math.min(.95, rel));
  applyUpgrades(); save();
  return o;
}

// ---------- la caisse ----------
// Acheter une machine neuve, ou faire monter en gamme une pièce déjà au parc. Améliorer
// coûte la différence, l'ancienne étant reprise à moitié prix : commencer petit ne se
// paie donc jamais deux fois.
const prixPorteur = (kind, niv) => PORTEURS[kind].prix[Math.min(niv, PORTEURS[kind].prix.length-1)];
const coutAmelioration = (prix, de, vers) => prix[vers] - Math.round(prix[de]*.5);
function acheterPorteur(kind, niv){
  const P = PORTEURS[kind]; if (!P) return null;
  niv = Math.max(0, Math.min(P.prix.length-1, niv|0));
  const prix = P.prix[niv];
  if (coins < prix) return null;
  coins -= prix;
  const v = creerEngin(kind, niv);
  applyUpgrades(); save();
  return v;
}
function acheterOutil(type, niv){
  const D = OUTILS[type]; if (!D) return null;
  niv = Math.max(0, Math.min(2, niv|0));
  if (coins < D.prix[niv]) return null;
  coins -= D.prix[niv];
  const o = creerOutil(type, niv);
  applyUpgrades(); save();
  return o;
}
function ameliorerEngin(pid){
  const v = enginPar(pid); if (!v) return null;
  const P = PORTEURS[v.kind];
  if (v.niv >= P.prix.length-1) return null;
  const net = coutAmelioration(P.prix, v.niv, v.niv+1);
  if (coins < net) return null;
  coins -= net; v.niv++;
  monter(v); applyUpgrades(); save();
  return net;
}
// La coupe de la moissonneuse et les rampes de l'automoteur montent séparément du porteur.
function ameliorerBec(pid){
  const v = enginPar(pid); if (!v) return null;
  const P = PORTEURS[v.kind]; if (!P.outil || v.bec >= 2) return null;
  const net = coutAmelioration(P.outil.prix, v.bec, v.bec+1);
  if (coins < net) return null;
  coins -= net; v.bec++;
  monter(v); applyUpgrades(); save();
  return net;
}
function ameliorerOutil(oid){
  const o = outilPar(oid); if (!o || o.niv >= 2) return null;
  const D = OUTILS[o.type];
  const net = coutAmelioration(D.prix, o.niv, o.niv+1);
  if (coins < net) return null;
  const v = o.porteur ? enginPar(o.porteur) : null;
  // trop lourd pour le tracteur qui le tire : on ne l'améliore pas en douce sous lui
  if (v && D.force[o.niv+1] > v.niv) return 'lourd';
  coins -= net; o.niv++;
  if (v) monter(v);
  else { const g = o.obj; relever(o); poserOutil(o); }
  applyUpgrades(); save();
  return net;
}
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
  syncFleet();                        // le chantier prend l'engin qui sait le faire
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
  const p = pilote();
  const suivait = !!p && p.metier === fini.k;   // on suivait le chantier : on continue de le suivre
  stage = (stage+1) % STAGES.length;
  if (stage === 0){ harvests++; SWATH.reset(); }   // cycle bouclé : la parcelle repart à nu
  if (STAGES[stage].k === 'sow') paySeed();        // la semence se règle en entrant au semis
  startStage(); sfx('stage'); save();
  engins.forEach(v => { if (v.metier === fini.k) v.done = true; });
  if (suivait){
    const n = engins.find(v => v.metier === STAGES[stage].k);
    if (n){ driven = n.pid; syncFleet(); drawVeh(); }
  }
  toast(fini.ic + ' ' + fini.n + ' — terminé !', 'good');
  confetti(stage === 0 ? 34 : 14);
}
// Changer d'étape ne déplace ni ne supprime rien : chaque engin reste où il est.
function switchTo(i){
  if (i === stage) return;
  stage = i; startStage();
  const k = STAGES[i].k;
  if (k !== 'grow' && !possede(k))
    toast(STAGES[i].ic + ' ' + STAGES[i].n + ' — aucune machine pour ce chantier', 'bad');
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
  // La benne attelée décide de ce qu'on emporte, et elle n'est plus la même d'un tracteur
  // à l'autre : `capDe` la lit sur l'engin. TRCAP ne sert plus que de repli.
  TRCAP  = typeof hauler !== 'undefined' && hauler ? capDe(hauler) : 0;
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
// Dans un décor sans texture, c'est l'ombre qui donne le relief. Le remplissage baisse et
// la clé monte : à midi, 0,52 d'hémisphérique contre 0,95 de soleil, là où c'était 0,88
// contre 0,50. L'écart entre une face au soleil et une face à l'ombre triple, et les ombres
// portées deviennent des formes franches au lieu d'un voile.
const SKY = [
  { t:0,   sky:'#2c4272', hs:'#9fb0dd', hg:'#3b5236', hi:.50, si:.30, sc:'#b6c6f2', nuit:1 },
  { t:.23, sky:'#42598a', hs:'#a9b6d8', hg:'#41573a', hi:.51, si:.33, sc:'#c0cdf0', nuit:.85 },
  { t:.31, sky:'#7d9c50', hs:'#ffd3a4', hg:'#4d6a30', hi:.50, si:.72, sc:'#ffbe83', nuit:.25 },
  { t:.5,  sky:'#54a52e', hs:'#ffffff', hg:'#4e8a34', hi:.52, si:.95, sc:'#fff6de', nuit:0 },
  { t:.68, sky:'#5da03a', hs:'#ffeccd', hg:'#4e7c31', hi:.51, si:.88, sc:'#ffdda9', nuit:0 },
  { t:.78, sky:'#a68350', hs:'#ffd0aa', hg:'#556031', hi:.50, si:.70, sc:'#ff9f5e', nuit:.45 },
  { t:.87, sky:'#4a5c88', hs:'#a2aecf', hg:'#3a4c30', hi:.51, si:.33, sc:'#b6c3ec', nuit:.95 },
  { t:1,   sky:'#2c4272', hs:'#9fb0dd', hg:'#3b5236', hi:.50, si:.30, sc:'#b6c6f2', nuit:1 }
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
      vierge, silo:siloNiv, idSeq,
      // le parc, pièce par pièce : où chacune se trouve, et ce qu'elle porte
      engins: engins.map(v => ({ id:v.pid, k:v.kind, n:v.niv, b:v.bec, o:v.outil,
                x:+v.pos.x.toFixed(2), z:+v.pos.z.toFixed(2), a:+v.heading.toFixed(3),
                hop:Math.round(v.hop) })),
      outils: outils.map(o => ({ id:o.oid, t:o.type, n:o.niv, p:o.porteur,
                hop:Math.round(o.hop), x:+o.x.toFixed(2), z:+o.z.toFixed(2),
                a:+o.ang.toFixed(3) })),
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
  // ancienne sauvegarde : deux silos indépendants — on garde le plus grand des deux
  siloNiv = d.silo !== undefined ? Math.max(-1, Math.min(1, +d.silo))
          : (d.silos ? (d.silos.grand ? 1 : d.silos.petit ? 0 : -1) : -1);
  if (siloNiv >= 0) montreSilo(siloNiv);
  vierge = d.vierge === undefined ? (+d.harvests || 0) === 0 && (+d.stage || 0) === 0 : !!d.vierge;
  // Une sauvegarde d'avant l'achat des engins avait toute la flotte, à un niveau unique :
  // on la lui rend telle quelle plutôt que de la déshabiller sans prévenir.
  // ---------- le parc ----------
  // Les outils d'abord : un engin ne peut pas se monter avec un outil qui n'existe pas
  // encore. Chacun retrouve sa place, attelé ou posé là où on l'avait laissé.
  engins.slice().forEach(v => { scene.remove(v.h); libere(v.h); });
  engins.length = 0;
  outils.slice().forEach(o => relever(o));
  outils.length = 0;
  idSeq = Math.max(1, +d.idSeq || 1);
  (Array.isArray(d.outils) ? d.outils : []).forEach(r => {
    if (!OUTILS[r.t]) return;
    const o = { oid:+r.id || idSeq++, type:r.t, niv:Math.max(0,Math.min(2,+r.n||0)),
                hop:+r.hop || 0, porteur:r.p || null,
                x:+r.x || 0, z:+r.z || 0, ang:+r.a || 0, obj:null, obst:[], Lt:4.7, Wc:2 };
    outils.push(o);
    if (!o.porteur) poserOutil(o);
  });
  (Array.isArray(d.engins) ? d.engins : []).forEach(r => {
    if (!PORTEURS[r.k]) return;
    const v = vehicle(r.k === 'tracteur'
      ? { kind:'tracteur', niv:+r.n || 0,
          outil: r.o && outilPar(r.o) ? { type:outilPar(r.o).type, niv:outilPar(r.o).niv } : null }
      : { kind:r.k, niv:+r.n || 0, bec:+r.b || 0 });
    v.pid = +r.id || idSeq++; v.kind = r.k; v.niv = +r.n || 0; v.bec = +r.b || 0;
    v.outil = (r.o && outilPar(r.o)) ? r.o : null;
    v.pos.set(+r.x || 0, 0, +r.z || 0); v.heading = +r.a || 0;
    v.laneI = 0; v.done = false; v.path = []; v.head = 0; v.goto = null;
    v.hop = +r.hop || 0; v.paid = 0; v.cropId = crop().id;
    engins.push(v); poser(v);
    idSeq = Math.max(idSeq, v.pid + 1);
  });
  // un outil qui se croyait attelé à un engin disparu retombe au sol plutôt que de s'effacer
  outils.forEach(o => {
    if (o.porteur && !engins.some(v => v.outil === o.oid)){ o.porteur = null; poserOutil(o); }
    idSeq = Math.max(idSeq, o.oid + 1);
  });
  cropI = Math.max(0, Math.min(CROPS.length-1, +d.cropI || 0));
  if (!owned[CROPS[cropI].id]) cropI = 0;
  stage = Math.max(0, Math.min(STAGES.length-1, +d.stage || 0));
  day = Math.max(1, +d.day || 1); dayT = +d.dayT || .3;
  contract = d.contract && d.contract.qty ? d.contract : null;
  if (d.son === false) SND.set(false);
  if (CTRL.some(c => c.id === d.ctrl)) ctrlMode = d.ctrl;
  driven = enginPar(+d.conduit) ? +d.conduit : (engins.length ? engins[0].pid : 0);
  syncFleet();
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
  // La friche ne porte plus ses repousses sèches. Cinq mille touffes en volume posées sur un
  // à-plat, c'est exactement la texture que ce style refuse : de loin elles se lisaient comme
  // un bruit, et la trame d'impression s'y noyait. La friche se dit par sa couleur.
  // Le chaume garde sa paille : elle, on vient de la faire, et on veut la voir.
  const sec = state === 4 ? 1 : 0;
  for(let k=0;k<plants.length;k++){ plants[k].g = g0; plants[k].r = sec; }
  redrawPlants();
}
