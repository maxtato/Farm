"use strict";
// ---------- pilotage : manche, cap et allure, ou parcours dessiné ----------
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(),
      _plane = new THREE.Plane(new THREE.Vector3(0,1,0), -LIP), _hit = new THREE.Vector3();
function screenToWorld(cx, cy){
  _ndc.set(((cx-SX)/SW)*2 - 1, -((((cy-SY)/SH))*2 - 1));
  _ray.setFromCamera(_ndc, camera);
  return _ray.ray.intersectPlane(_plane, _hit) ? _hit.clone() : null;
}
// le parcours dessiné, montré comme un ruban posé sur la terre
// ---------- tracés : un par engin, et il s'efface derrière ----------
// Chaque engin porte son propre parcours. Le ruban n'est dessiné qu'à partir du point
// courant : ce qui a été parcouru disparaît de lui-même, on voit toujours ce qui reste.
const TRMAX = 700;
function traceKit(v){
  if (v.trace) return v.trace;
  const pos = new Float32Array(TRMAX*6), idx = new Uint32Array((TRMAX-1)*6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(new THREE.BufferAttribute(idx,1));
  geo.setDrawRange(0,0);
  // posé sur la terre, test de profondeur actif : l'engin qui roule dessus passe devant
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color:'#fff0a8', transparent:true, opacity:.26, side:THREE.DoubleSide,
    depthTest:true, depthWrite:false }));
  mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
  v.trace = { mesh, geo, pos, idx };
  return v.trace;
}
function traceDraw(v){
  const t = traceKit(v), W = Math.max(1.6, toolW(v));
  const pts = v.path, h = v.head, n = Math.min(pts.length - h, TRMAX);
  if (n < 2){ t.geo.setDrawRange(0,0); t.mesh.visible = false; return; }
  for(let i=0;i<n;i++){
    const a = pts[h+Math.max(0,i-1)], b = pts[h+Math.min(n-1,i+1)];
    let dx = b.x-a.x, dz = b.z-a.z;
    const m = Math.hypot(dx,dz) || 1; dx/=m; dz/=m;
    const px = -dz*W/2, pz = dx*W/2;                 // normale au tracé
    const o = i*6, x = pts[h+i].x, z = pts[h+i].z, y = parcelY(x,z) + .045;
    t.pos[o]   = x+px; t.pos[o+1] = y; t.pos[o+2] = z+pz;
    t.pos[o+3] = x-px; t.pos[o+4] = y; t.pos[o+5] = z-pz;
  }
  for(let i=0;i<n-1;i++){
    const a = i*2, b = a+1, c = a+2, d = a+3, q = i*6;
    t.idx[q]=a; t.idx[q+1]=b; t.idx[q+2]=c; t.idx[q+3]=b; t.idx[q+4]=d; t.idx[q+5]=c;
  }
  t.geo.attributes.position.needsUpdate = true; t.geo.index.needsUpdate = true;
  t.geo.setDrawRange(0, (n-1)*6);
  t.mesh.visible = true;
}
function traceAdd(v, p){
  if (!v) return;
  if (!v.path){ v.path = []; v.head = 0; }
  const last = v.path[v.path.length-1];
  if (!last || Math.hypot(p.x-last.x, p.z-last.z) > 1.1){
    if (v.path.length - v.head < TRMAX) v.path.push(p);
    traceDraw(v);
  }
}
function traceClear(v){
  if (!v) return;
  v.path = []; v.head = 0; v.accroche = false; v.prog = undefined; v.progT = 0;
  v.rate = 0; v.detour = 0; v.sauts = 0;
  if (v.trace){ v.trace.geo.setDrawRange(0,0); v.trace.mesh.visible = false; }
}
function traceLeft(v){ return v && v.path ? Math.max(0, v.path.length - v.head) : 0; }
// Le suivi visait le point suivant, à un mètre devant. L'évitement, borné à la distance du
// but, ne voyait donc rien venir : l'engin entrait dans la grange et forçait dessus. Il vise
// maintenant un point pris plus loin sur le tracé — assez loin pour anticiper, ce qui lisse
// aussi la trajectoire — et l'évitement travaille à pleine portée.
function followPath(v, dt){
  let avance = false;
  // Le tracteur suit la ligne et l'outil la suit derrière lui : en cours de route c'est
  // donc bien le tracteur qui consomme les points. Le dernier, en revanche, c'est l'outil
  // qui doit l'atteindre — c'est là que le joueur a voulu que l'effet s'arrête.
  const sn0 = Math.sin(v.heading), cs0 = Math.cos(v.heading);
  while (v.head < v.path.length){
    const der = v.head === v.path.length - 1;
    const P = der ? outilXZ(v, _out) : v.pos;
    const dx = v.path[v.head].x - P.x, dz = v.path[v.head].z - P.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.0){ v.head++; avance = true; continue; }
    // Dépassé : le dernier point est derrière nous et à portée. Faire demi-tour pour le
    // cueillir ferait tourner l'engin en rond autour du bout du tracé au lieu de le finir.
    // Ce raccourci ne vaut QUE pour le dernier point : appliqué à tous, il avalait d'un
    // coup tout le début du dessin quand l'engin ne pointait pas déjà dans le bon sens.
    if (der && d < 6 && dx*sn0 + dz*cs0 < 0){ v.head++; avance = true; continue; }
    break;
  }
  // Sauter des points du tracé, on ne s'y autorise que dans deux cas, et pas un de plus :
  //   — à l'accrochage, parce que le joueur commence rarement son trait pile sur l'engin et
  //     que le premier point tombe souvent derrière lui, hors de portée ;
  //   — après un contournement, pour reprendre la ligne plus loin plutôt que de repartir
  //     chercher le point qu'un obstacle nous a fait laisser derrière.
  // Le reste du temps on suit le dessin point par point, tel qu'il a été tracé. C'était le
  // défaut : la reprise tournait en permanence et rognait les courbes en plein champ vide.
  v.detour = Math.max(0, (v.detour || 0) - dt);
  if (v.head < v.path.length - 1 && v.detour > 0){
    const t0 = v.head;
    const d0 = Math.hypot(v.path[t0].x-v.pos.x, v.path[t0].z-v.pos.z);
    let j = t0, best = d0;
    const fin = Math.min(v.path.length, t0 + (v.accroche ? 90 : 40));
    for(let k = t0+1; k < fin; k++){
      const d = Math.hypot(v.path[k].x-v.pos.x, v.path[k].z-v.pos.z);
      // À l'accrochage on prend le PREMIER point à portée, pas le plus proche : un tracé qui
      // revient près de son départ — un demi-tour, une boucle — se ferait sinon couper d'un
      // bout à l'autre dès la première image.
      if (!v.accroche && d < 3){ best = d; j = k; break; }
      if (d < best){ best = d; j = k; }
    }
    if (j > t0 && best < d0 - 1){ v.head = j; avance = true; v.sauts = (v.sauts||0) + (j-t0); }
  }
  if (v.head >= v.path.length){
    traceClear(v); if (v === pilote()) setPathState('pret');
    return;
  }
  if (v.head > 80){ v.path.splice(0, v.head); v.head = 0; avance = true; }
  if (avance){ traceDraw(v); v.prog = undefined; v.progT = 0; }   // nouveau point, nouveau compte
  const dTete = Math.hypot(v.path[v.head].x-v.pos.x, v.path[v.head].z-v.pos.z);
  // accroché : on est arrivé sur la ligne. À partir de là, plus de raccourci sans obstacle.
  if (dTete < 3) v.accroche = true;
  // Choix du point visé. L'ancienne règle — avancer tant que le point est à moins de LOOK
  // de l'engin — basculait d'un coup : à quelques centimètres près, la consigne sautait du
  // premier point du tracé à un point bien plus loin, souvent dans une autre direction.
  // L'engin partait alors tourner en rond sans jamais accrocher la ligne. On sépare donc
  // les deux cas : tant qu'on n'est pas sur le tracé, on va droit sur son premier point ;
  // une fois dessus, on avance LE LONG du tracé, ce qui ne peut plus revenir en arrière.
  const LOOK = Math.max(2.5, Math.min(8, v.speed*.50));
  let i = v.head;
  if (dTete < LOOK){
    let reste = LOOK - dTete;
    while (i < v.path.length-1 && reste > 0){
      reste -= Math.hypot(v.path[i+1].x-v.path[i].x, v.path[i+1].z-v.path[i].z);
      i++;
    }
  }
  // Jamais un point posé sur le capot : viser à bout portant fait tourner l'engin en rond au
  // lieu de l'amener sur la ligne. Mais ce garde-fou ne vaut que lorsqu'on est LOIN du
  // tracé, c'est-à-dire en train de le rejoindre. Une fois dessus, l'imposer revenait à
  // toujours viser quatre mètres devant, et un demi-tour serré se faisait couper en deux.
  if (dTete > 3){
    const MINI = RMIN*1.6 + .8;
    while (i < v.path.length-1 &&
           Math.hypot(v.path[i].x-v.pos.x, v.path[i].z-v.pos.z) < MINI) i++;
  }
  // Le dessin tourne : on lève le pied. Un engin lancé à dix mètres par seconde vise loin
  // devant et rogne les courbes ; ralenti, il vise court et colle au trait. On ne mesure
  // plus ça sur un seul angle — trop bruyant quand le point suivant est à un mètre — mais
  // sur le braquage cumulé du tracé jusqu'au point visé : zéro sur une ligne droite, un
  // radian et demi sur un zigzag serré.
  {
    let courbe = 0, prec = null;
    for(let k = v.head; k < i && k+1 < v.path.length; k++){
      const a = Math.atan2(v.path[k+1].x-v.path[k].x, v.path[k+1].z-v.path[k].z);
      if (prec !== null){
        let d2 = a - prec;
        while (d2 >  Math.PI) d2 -= 6.28318;
        while (d2 < -Math.PI) d2 += 6.28318;
        courbe += Math.abs(d2);
      }
      prec = a;
    }
    v.mul = Math.max(.5, 1 - courbe*.5);
  }
  // Coincé pour de bon. On ne mesure plus ça à la vitesse : un engin qui rebondit contre la
  // grange à trois mètres par seconde n'est pas lent, il n'avance simplement plus vers son
  // point. On regarde donc le seul chiffre qui compte, la distance à ce point : si elle ne
  // baisse plus pendant trois secondes, le point est hors d'atteinte et on passe au suivant.
  if (v.prog === undefined || dTete < v.prog - .4){ v.prog = dTete; v.progT = 0; }
  else {
    v.progT = (v.progT || 0) + dt;
    if (v.progT > 3){
      v.progT = 0; v.prog = undefined; v.head++; traceDraw(v);
      // Quatre points de suite hors d'atteinte sans jamais avoir touché la ligne : le tracé
      // mène quelque part où l'engin ne peut pas aller. Mieux vaut s'arrêter franchement
      // que continuer à racler la grange point après point.
      if (++v.rate >= 4){
        traceClear(v); v.speed = 0;
        if (v === pilote()) setPathState('pret');
      }
      return;
    }
  }
  if (dTete < 3) v.rate = 0;                   // on est sur la ligne : le compte repart
  // sur le tout dernier point seulement, on vise avec l'outil : l'engin dépasse le bout du
  // tracé de la longueur de son attelage, pour que l'outil, lui, s'arrête pile dessus
  v.__cible = v.path[i];
  driveTo(v, v.path[i], dt, false, true, i === v.path.length-1);
}

// ---------- effets ----------
const proj = new THREE.Vector3();
// coordonnées écran d'un point du monde, dans le repère de la fenêtre
function toScreen(x,y,z){
  proj.set(x,y,z).project(camera);
  const m = 34;                       // un gain né hors cadre reste au bord de l'aire de jeu
  return { x:Math.max(SX+m, Math.min(SX+SW-m, SX + (proj.x*.5+.5)*SW)),
           y:Math.max(SY+m, Math.min(SY+SH-m, SY + (-proj.y*.5+.5)*SH)) };
}
function floatCoin(x,z,val){
  const s = toScreen(x,1.6,z);
  const el = document.createElement('div'); el.className = 'float';
  el.innerHTML = '<span class="c"></span>'+val;
  el.style.cssText += `left:${s.x}px;top:${s.y}px;opacity:0`;
  fx.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transition = 'transform .95s cubic-bezier(.2,.7,.3,1), opacity .95s ease-out';
    el.style.opacity = '1';
    el.style.transform = `translate(calc(-50% + ${(Math.random()-.5)*40}px), calc(-50% - 78px)) scale(1.12)`;
    setTimeout(()=>{ el.style.opacity='0'; }, 520);
  });
  setTimeout(()=>el.remove(), 1500);
}
// une pièce qui part du silo et file jusqu'au compteur : le geste qui rend l'encaissement lisible
const chipCoins = document.getElementById('chipCoins');
function flyCoin(x,z,delay){
  const from = toScreen(x,1.4,z);
  const el = document.createElement('div'); el.className = 'fly';
  el.style.cssText += `left:${from.x}px;top:${from.y}px;opacity:0`;
  fx.appendChild(el);
  const r = chipCoins.getBoundingClientRect();
  const dx = r.left + 22 - from.x, dy = r.top + r.height/2 - from.y;
  setTimeout(() => {
    el.style.opacity = '1';
    el.style.transition = 'transform .62s cubic-bezier(.5,-0.35,.6,1), opacity .62s ease-in';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(.55)`;
    setTimeout(() => { el.remove(); popChip(chipCoins); }, 600);
  }, delay||0);
}
function popChip(el){ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function confetti(n){
  const cols = ['#ffc93c','#4cb44e','#e2593f','#4fa9de','#a374de','#fff5e0'];
  for(let i=0;i<n;i++){
    const el = document.createElement('div'); el.className = 'conf';
    const x = innerWidth*(.2+Math.random()*.6), y = innerHeight*.32;
    el.style.cssText = `left:${x}px;top:${y}px;background:${cols[i%cols.length]};` +
                       `transform:rotate(${Math.random()*360}deg)`;
    fx.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transition = 'transform 1.5s cubic-bezier(.25,.7,.5,1), opacity 1.5s ease-in';
      el.style.transform = `translate(${(Math.random()-.5)*380}px, ${220+Math.random()*300}px) ` +
                           `rotate(${Math.random()*900-450}deg)`;
      el.style.opacity = '0';
    });
    setTimeout(()=>el.remove(), 1700);
  }
}
const dustGeo = new THREE.SphereGeometry(.3,6,5), dust = [];
for(let i=0;i<26;i++){
  const m = new THREE.Mesh(dustGeo, new THREE.MeshLambertMaterial({color:'#e0d2ab', transparent:true}));
  m.visible = false; scene.add(m); dust.push({m,t:0,vy:0});
}
const sprayGeo = new THREE.SphereGeometry(.16,5,4), spray = [];
for(let i=0;i<90;i++){
  const m = new THREE.Mesh(sprayGeo,
    new THREE.MeshLambertMaterial({color:'#9fdcf7', transparent:true, opacity:.9}));
  m.visible = false; scene.add(m); spray.push({m,t:0,vx:0,vy:0,vz:0});
}
function popSpray(x,y,z,ax,az){
  const d = spray.find(d=>!d.m.visible); if(!d) return;
  d.m.visible = true; d.t = 0;
  d.m.position.set(x,y,z);
  d.m.scale.setScalar(.6+Math.random()*.7);
  d.m.material.opacity = .9;
  d.vx = ax*.6 + (Math.random()-.5)*1.1;
  d.vz = az*.6 + (Math.random()-.5)*1.1;
  d.vy = -1.1 - Math.random()*.8;
}
// Un champ de particules instancié : position, vitesse, gravité et culbute.
// Elles retombent sur la terre — dont la hauteur varie — et s'y posent avant de disparaître.
function particleField(n, geo, color, g, spin){
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color }), n);
  mesh.frustumCulled = false; mesh.castShadow = false; scene.add(mesh);
  const P = [], d = new THREE.Object3D();
  for(let i=0;i<n;i++){
    P.push({ t:-1, x:0,y:0,z:0, vx:0,vy:0,vz:0, s:1, rx:0,ry:0,rz:0, wx:0,wy:0,wz:0, life:1 });
    d.scale.set(0,0,0); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
  }
  let head = 0;
  return {
    spawn(x,y,z, vx,vy,vz, life, sc){
      const p = P[head]; head = (head+1)%n;
      p.t = 0; p.life = life; p.x = x; p.y = y; p.z = z;
      p.vx = vx; p.vy = vy; p.vz = vz; p.s = sc;
      p.rx = Math.random()*6.28; p.ry = Math.random()*6.28; p.rz = Math.random()*6.28;
      p.wx = (Math.random()-.5)*spin; p.wy = (Math.random()-.5)*spin; p.wz = (Math.random()-.5)*spin;
    },
    update(dt){
      let any = false;
      for(let i=0;i<n;i++){
        const p = P[i]; if (p.t < 0) continue;
        any = true; p.t += dt;
        if (p.t > p.life){ p.t = -1; d.scale.set(0,0,0); d.updateMatrix(); mesh.setMatrixAt(i,d.matrix); continue; }
        p.vy -= g*dt;
        p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt;
        const sol = parcelY(p.x, p.z) + .035;
        if (p.y <= sol){                       // elle touche : elle roule un peu puis s'immobilise
          p.y = sol; p.vy = -p.vy*.18; p.vx *= .42; p.vz *= .42;
          if (Math.abs(p.vy) < .35) p.vy = 0;
          p.wx *= .3; p.wy *= .3; p.wz *= .3;
        } else {
          p.rx += p.wx*dt; p.ry += p.wy*dt; p.rz += p.wz*dt;
        }
        d.position.set(p.x, p.y, p.z);
        d.rotation.set(p.rx, p.ry, p.rz);
        d.scale.setScalar(p.s * Math.min(1, (p.life-p.t)*5));
        d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      }
      if (any) mesh.instanceMatrix.needsUpdate = true;
    },
    live(){ let n = 0; for(let i=0;i<P.length;i++) if (P[i].t >= 0) n++; return n; }
  };
}
const SOIL = particleField(170, new THREE.TetrahedronGeometry(.2),  '#5b4823', 15, 9);
const SEED = particleField(150, new THREE.SphereGeometry(.085,4,3), '#fff0c2', 13, 5);

const grainGeo = new THREE.SphereGeometry(.11,5,4), grains = [];
for(let i=0;i<44;i++){
  const m = new THREE.Mesh(grainGeo, new THREE.MeshLambertMaterial({color:'#f0c74a'}));
  m.visible = false; scene.add(m); grains.push({m,t:0,vx:0,vy:0,vz:0});
}
// le grain part de la vis et retombe dans la benne : c'est là que la moisson se voit
function popGrain(x,y,z,tx,tz){
  const d = grains.find(d=>!d.m.visible); if(!d) return;
  const T = .55;
  d.m.visible = true; d.t = 0;
  d.m.position.set(x,y,z);
  d.m.scale.setScalar(.7+Math.random()*.7);
  d.vx = (tx-x)/T + (Math.random()-.5)*.6;
  d.vz = (tz-z)/T + (Math.random()-.5)*.6;
  d.vy = (1.2-y)/T + 4.6*T/2;
}
// Traits de vitesse : de fines lignes claires posées au sol de part et d'autre de l'engin,
// qui s'effacent en un tiers de seconde. Elles ne se déclenchent que quand l'élan de ligne
// droite est installé — c'est ce qui rend la vitesse lisible sur un plan aussi éloigné.
const streakGeo = (function(){ const g = new THREE.PlaneGeometry(1,.3); g.rotateX(-Math.PI/2); return g; })();
const streaks = [];
for(let i=0;i<30;i++){
  const m = new THREE.Mesh(streakGeo, new THREE.MeshBasicMaterial({
    color:'#fffbe8', transparent:true, opacity:0, depthWrite:false }));
  m.visible = false; m.renderOrder = 3; scene.add(m); streaks.push({ m, t:0, life:.3, a:.5 });
}
function popStreak(x,z,hd,lat,recul,len,fort){
  const d = streaks.find(d=>!d.m.visible); if(!d) return;
  const sn = Math.sin(hd), cs = Math.cos(hd);       // avant (sn,cs), côté (cs,-sn)
  const px = x + cs*lat - sn*recul, pz = z - sn*lat - cs*recul;
  d.m.visible = true; d.t = 0; d.life = .24 + Math.random()*.1;
  d.a = .17 + .16*fort;                             // à peine plus clair que le sol
  d.m.position.set(px, parcelY(px,pz) + .05, pz);
  d.m.rotation.y = hd + Math.PI/2;      // le trait file dans l'axe de marche, pas en travers
  d.m.scale.set(len, 1, .85 + Math.random()*.35);
  d.m.material.opacity = d.a;
}
function popDust(x,z){
  const d = dust.find(d=>!d.m.visible); if(!d) return;
  d.m.visible = true; d.t = 0; d.vy = .8+Math.random();
  d.m.position.set(x+(Math.random()-.5)*1.6,.35,z+(Math.random()-.5)*1.6);
  d.m.scale.setScalar(.45+Math.random()*.5); d.m.material.opacity = .65;
}
