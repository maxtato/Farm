"use strict";
// ---------- pièces d'engin ----------
let beacons = [];
function beacon(x,y,z,p){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,.24,8),
    jelly(new THREE.MeshLambertMaterial({ color:C.beacon, emissive:new THREE.Color(0,0,0) })));
  m.material.userData.own = true;
  m.position.set(x,y,z); m.castShadow = true; p.add(m); beacons.push(m); return m;
}
let brakeLights = [];
function tail(w,y,z,p){                                  // feux rouges + stop à l'arrière
  rbox(w*.9,.2,.12, C.dark, 0,y,z, p, .05);
  [1,-1].forEach(k => {
    const m = new THREE.Mesh(rboxGeo(.34,.2,.1,.03),
      jelly(new THREE.MeshLambertMaterial({ color:'#c22a1e', emissive:new THREE.Color(0,0,0) })));
    m.material.userData.own = true;
    m.position.set(k*w*.3, y, z-.04); m.castShadow = true; p.add(m); brakeLights.push(m);
  });
}
let headlamps = [];
function lamps(w,y,z,p){
  rbox(w*.92,.34,.16, C.dark, 0,y-.05,z, p, .06);
  [1,-1].forEach(k => {                                  // phares : allumés au crépuscule
    const m = new THREE.Mesh(rboxGeo(.3,.19,.1,.04*ROUND),
      jelly(new THREE.MeshLambertMaterial({ color:C.lamp, emissive:new THREE.Color(0,0,0) })));
    m.material.userData.own = true;
    m.position.set(k*w*.3, y, z+.05); m.castShadow = true; p.add(m); headlamps.push(m);
  });
}
// paire de phares seule, sans le bandeau : pour garnir une calandre déjà dessinée
function phares(w,y,z,p){
  [1,-1].forEach(k => {
    const m = new THREE.Mesh(rboxGeo(.28,.2,.1,.03),
      jelly(new THREE.MeshLambertMaterial({ color:C.lamp, emissive:new THREE.Color(0,0,0) })));
    m.material.userData.own = true;
    m.position.set(k*w, y, z); m.castShadow = true; p.add(m); headlamps.push(m);
  });
}
function glazing(w,h,d,col,x,y,z,p){
  rbox(w+.07,h,d+.07, C.glass, x,y,z, p, .05);          // toutes les faces vitrées, noires
  const t = .13, hh = h+.07;
  [[w/2,d/2],[-w/2,d/2],[w/2,-d/2],[-w/2,-d/2],[w/2,0],[-w/2,0]]
    .forEach(([dx,dz]) => rbox(t,hh,t, col, x+dx, y, z+dz, p, .02));
  rbox(.19,hh,.19, col, x, y, z+d/2, p, .02);           // montant central AVANT : 2 vitres
  rbox(.15,hh,.15, col, x, y, z-d/2, p, .02);           // montant central arrière
  rbox(w+.19,.12,.12, col, x, y+h/2, z+d/2, p, .03);    // cadre haut de pare-brise
  rbox(w+.19,.12,.12, col, x, y-h/2, z+d/2, p, .03);    // cadre bas
  rbox(w+.18,.11,d+.18, col, x, y-h/2, z, p, .03);      // ceinture basse
}
function door(h,d,col,x,y,z,p,s){          // la porte couvre tout le bloc vitré latéral
  rbox(.09, h*.46, d, col, x+s*.045, y-h*.26, z, p, .04);        // panneau bas pleine longueur
  rbox(.11, h, .11, col, x+s*.055, y, z-d/2, p, .02);            // montant arrière
  rbox(.11, h, .11, col, x+s*.055, y, z+d/2, p, .02);            // montant avant
  rbox(.1, .1, d, col, x+s*.055, y+h/2, z, p, .02);              // traverse haute
  rbox(.09,.11,.34, C.metal, x+s*.07, y-h*.03, z+d*.26, p, .02); // poignée
}
function ladder(h,x,y,z,p){
  rbox(.07,h,.07, C.metal, x,y,z-.16, p, .02);
  rbox(.07,h,.07, C.metal, x,y,z+.16, p, .02);
  for(let i=0;i<3;i++) rbox(.09,.06,.42, C.metal, x,y-h/2+.2+i*(h-.35)/2,z, p, .02);
}
// ---------- teintes des références : jantes dorées, vitrage bleu, capots fuselés ----------
const TP = { verre:'#3f9db5', toit:'#3a3f45', noir:'#272c32', pneu:'#1e2126',
             jante:'#c9a866', jante2:'#a8894f', chassis:'#3a4148' };
// Une roue reste un groupe de braquage contenant un groupe de rotation : c'est ce que
// `step` fait tourner et braquer. Seul le dessin change — pneu à 18 crampons, jante dorée.
function wheel(r,w,x,y,z,p){
  const steer = new THREE.Group(); steer.position.set(x,y,z); p.add(steer);
  const spin = new THREE.Group(); steer.add(spin);
  const tg = new THREE.CylinderGeometry(r,r,w,18); tg.rotateZ(Math.PI/2);
  const t = new THREE.Mesh(tg, mat(TP.pneu)); t.castShadow = true; spin.add(t);
  const lug = new THREE.BoxGeometry(w*.96,.09,r*.24);
  for(let i=0;i<18;i++){
    const a = i/18*6.28318, m = new THREE.Mesh(lug, mat(C.tread));
    m.position.set(0, Math.sin(a)*(r-.045), Math.cos(a)*(r-.045));
    m.rotation.x = -a; m.castShadow = true; spin.add(m);
  }
  const hg = new THREE.CylinderGeometry(r*.52,r*.52,w*1.02,16); hg.rotateZ(Math.PI/2);
  spin.add(new THREE.Mesh(hg, mat(TP.jante)));
  const bg = new THREE.CylinderGeometry(r*.2,r*.2,w*1.1,10); bg.rotateZ(Math.PI/2);
  spin.add(new THREE.Mesh(bg, mat(TP.jante2)));
  for(let i=0;i<6;i++){                                   // boulons
    const a = i/6*6.28318;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,w*1.12,6), mat(TP.jante2));
    b.rotation.z = Math.PI/2;
    b.position.set(0, Math.sin(a)*r*.34, Math.cos(a)*r*.34);
    spin.add(b);
  }
  steer.userData.spin = spin; steer.userData.r = r;
  return steer;
}
function disc(r,x,y,z,yaw,p,col){
  const tilt = new THREE.Group(); tilt.position.set(x,y,z); tilt.rotation.y = yaw; p.add(tilt);
  const spin = new THREE.Group(); tilt.add(spin);
  const g = new THREE.CylinderGeometry(r,r,.06,12); g.rotateZ(Math.PI/2);
  const m = new THREE.Mesh(g, mat(col||C.steel)); m.castShadow = true; spin.add(m);
  tilt.userData.spin = spin; tilt.userData.r = r;
  return tilt;
}
function reel(len,r,bats,x,y,z,p,col){
  const g = new THREE.Group(); g.position.set(x,y,z); p.add(g);
  const dg = new THREE.CylinderGeometry(r*.42,r*.42,len,10); dg.rotateZ(Math.PI/2);
  g.add(new THREE.Mesh(dg, mat(C.metal)));
  for(let i=0;i<bats;i++){
    const a = i/bats*6.28318;
    rbox(len,.46,.13,col,0,Math.sin(a)*r,Math.cos(a)*r,g,.05).rotation.x = -a;
    rbox(.1,r,.1,C.metal, len/2-.12, Math.sin(a)*r/2, Math.cos(a)*r/2, g,.03).rotation.x = -a;
    rbox(.1,r,.1,C.metal,-len/2+.12, Math.sin(a)*r/2, Math.cos(a)*r/2, g,.03).rotation.x = -a;
  }
  return g;
}
// capot : UN seul volume, dont les sommets sont fuselés vers l'avant
function capot(g, W, H, y, z0, z1, col){
  const L = z1 - z0, wEnd = .82, hEnd = .74;
  const geo = rboxGeo(W,H,L,.34).clone(); geo.userData = {};   // la copie se libère, elle
  const pos = geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const t = Math.min(1, Math.max(0, (pz + L/2)/L));      // 0 à l'arrière, 1 au nez
    const k = t*t*(3-2*t);                                 // adoucissement
    pos.setX(i, px*(1 + (wEnd-1)*k));
    pos.setY(i, -H/2 + (py + H/2)*(1 + (hEnd-1)*k));
  }
  pos.needsUpdate = true; geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(col));
  m.position.set(0, y, (z0+z1)/2); m.castShadow = true; g.add(m);
  return { avant:z1, largeurAvant:W*wEnd, hautAvant:y - H/2 + H*hEnd };
}
function basDeCaisse(g, W, y, z0, z1, col){ rbox(W,.5,z1-z0, col, 0,y,(z0+z1)/2, g, .1); }
function cabine(g, W, D, H, yb, zc, col, posts){
  rbox(W+.16,.3,D+.16, col, 0,yb-.08,zc, g, .1);          // ceinture couleur sous la cabine
  rbox(W+.1,.16,D+.1, TP.noir, 0,yb+.1,zc, g, .06);
  const py = yb+H/2;
  [[W/2,D/2],[-W/2,D/2],[W/2,-D/2],[-W/2,-D/2]].forEach(([dx,dz]) =>
    rbox(.15,H,.15, TP.noir, dx,py,zc+dz, g, .04));
  if (posts) rbox(.13,H,.13, TP.noir, 0,py,zc+D/2, g, .04);
  rbox(W-.12,H-.12,.09, TP.verre, 0,py,zc+D/2, g, .03);
  rbox(W-.12,H-.12,.09, TP.verre, 0,py,zc-D/2, g, .03);
  rbox(.09,H-.12,D-.12, TP.verre,  W/2,py,zc, g, .03);
  rbox(.09,H-.12,D-.12, TP.verre, -W/2,py,zc, g, .03);
  rbox(W+.34,.26,D+.42, TP.toit, 0,yb+H+.13,zc, g, .1);   // pavillon débordant
  rbox(W*.55,.12,D*.5, '#454b52', 0,yb+H+.3,zc-.1, g, .05);
  return yb+H+.26;
}
function echappement(g,x,z,y0,h,col){
  cyl(.09,.11,h,8, col, x,y0+h/2,z, g);
  const b = cyl(.085,.085,.5,8, col, x,y0+h+.16,z+.16, g); b.rotation.x = .7;
  cyl(.13,.13,.16,8, col, x,y0+h+.34,z+.34, g);
}
function arriere(g, W, y, zr, col){          // feux à l'arrière + attache caravane
  tail(W*.94, y, zr-.05, g);
  const yb = .95;                                             // hauteur d'attelage normalisée
  rbox(.9,.24,.55, TP.noir, 0,yb,zr-.24, g, .06);             // plaque
  rbox(.2,y-yb,.3, TP.noir,  .34,(y+yb)/2,zr-.1, g, .05);     // descentes depuis le bloc arrière
  rbox(.2,y-yb,.3, TP.noir, -.34,(y+yb)/2,zr-.1, g, .05);
  cyl(.1,.13,.16,10, C.metal, 0,yb+.14,zr-.45, g);            // la boule
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.14,10,8), mat(C.metal));
  ball.position.set(0,yb+.26,zr-.45); ball.castShadow = true; g.add(ball);
  return zr-.45;
}
function grille(g,W,y,z,n,col){
  rbox(W,.62,.22, TP.noir, 0,y,z, g, .06);
  for(let i=0;i<7;i++) rbox(.06,.5,.12, '#3a4148', -W/2+.12+i*(W-.24)/6,y,z+.06, g, .02);
  phares(W*.3, y+.16, z+.09, g);
  if (n > 2) phares(W*.3, y-.16, z+.09, g);
}

// ---------- les trois tracteurs : puissance, gabarit, ce qu'ils peuvent tirer ----------
// Le niveau se lit partout : voie, capot, roues, mais aussi largeur de l'outil porté et
// poids de remorque admissible. Un compact ne tire pas une 22 m³.
function tracteurCompact(g){
  const col = '#4aa32a';
  const cp = capot(g,1.52,1.1,1.62,.35,2.9,col);
  basDeCaisse(g,1.56,.95,-1.1,2.5,TP.chassis);
  rbox(1.5,.9,.9, col, 0,1.35,-1.35, g, .2);              // bloc arrière plein
  rbox(1.56,.34,1, TP.chassis, 0,.85,-1.5, g, .1);
  const top = cabine(g,1.62,1.55,1.25,1.62,-.35,col,false);
  beacon(.66,top+.1,.2,g);
  [.72,.42].forEach(y => { rbox(.5,.1,.28, TP.noir, .95,y,.3, g, .03);
                           rbox(.5,.1,.28, TP.noir,-.95,y,.3, g, .03); });
  echappement(g,.56,1.45,1.75,1.35,TP.noir);
  grille(g,cp.largeurAvant-.08,1.28,cp.avant-.06,2,col);
  rbox(cp.largeurAvant+.12,.34,.42, TP.chassis, 0,.78,cp.avant+.02, g, .1);
  const wa = [], wv = [];
  [1,-1].forEach(k => { wa.push(wheel(1.02,.5,k*1.12,1.02,-.45,g));
                        wv.push(wheel(.6,.36,k*1.02,.6,2.05,g)); });
  return { ball:arriere(g,1.5,1.35,-1.8,col), wheels:wa.concat(wv), avant:wv };
}
function tracteurStandard(g){
  const col = '#1f66d0';
  const cp = capot(g,1.74,1.3,1.85,.4,3.4,col);
  basDeCaisse(g,1.9,1.05,-1.5,3,TP.chassis);
  rbox(1.72,1.05,1.05, col, 0,1.55,-1.7, g, .22);
  rbox(1.8,.4,1.2, TP.chassis, 0,.95,-1.85, g, .1);
  const top = cabine(g,1.86,1.85,1.5,1.85,-.5,col,true);
  beacon(.78,top+.1,.18,g);
  [.85,.5].forEach(y => { rbox(.56,.11,.3, TP.noir, 1.05,y,.35, g, .03);
                          rbox(.56,.11,.3, TP.noir,-1.05,y,.35, g, .03); });
  echappement(g,.64,1.7,2,1.6,TP.noir);
  grille(g,cp.largeurAvant-.08,1.5,cp.avant-.06,2,col);
  rbox(cp.largeurAvant+.14,.4,.5, TP.chassis, 0,.88,cp.avant+.02, g, .12);
  const wa = [], wv = [];
  [1,-1].forEach(k => { wa.push(wheel(1.24,.6,k*1.32,1.24,-.6,g));
                        wv.push(wheel(.74,.44,k*1.2,.74,2.45,g)); });
  return { ball:arriere(g,1.8,1.5,-2.23,col), wheels:wa.concat(wv), avant:wv };
}
function tracteurGros(g){
  const col = '#c9352c';
  const cp = capot(g,1.98,1.5,2.15,.45,3.85,col);
  basDeCaisse(g,2.14,1.22,-1.7,3.4,TP.chassis);
  rbox(1.96,1.2,1.2, col, 0,1.8,-1.95, g, .24);
  rbox(2.04,.46,1.4, TP.chassis, 0,1.1,-2.1, g, .1);
  const top = cabine(g,2.1,2.05,1.7,2.15,-.6,col,true);
  beacon(.9,top+.1,.18,g);
  for(let i=0;i<2;i++) phares(.2+i*.4, top-.13, .695, g);          // quatre projecteurs de toit
  phares(.72, top-.13, -1.895, g);                                 // et deux vers l'arrière
  [.95,.58,.21].forEach(y => { rbox(.62,.12,.32, TP.noir, 1.18,y,.4, g, .03);
                               rbox(.62,.12,.32, TP.noir,-1.18,y,.4, g, .03); });
  echappement(g,.74,1.95,2.3,1.9,TP.noir);
  grille(g,cp.largeurAvant-.1,1.68,cp.avant-.06,4,col);
  rbox(cp.largeurAvant+.16,.46,.58, TP.chassis, 0,1,cp.avant+.02, g, .12);
  rbox(cp.largeurAvant-.06,.12,.18, '#d8b23a', 0,2.06,cp.avant-.04, g, .05);
  const wa = [], wv = [];
  [1,-1].forEach(k => { wa.push(wheel(1.5,.72,k*1.5,1.5,-.7,g));
                        wv.push(wheel(.92,.52,k*1.36,.92,2.75,g)); });
  return { ball:arriere(g,2.1,1.75,-2.55,col), wheels:wa.concat(wv), avant:wv };
}
const TRACTEURS = [
  { id:'compact',  n:'Compact',          emo:'🚜', prix:0,     f:tracteurCompact,
    demi:1.40, nez:3.20, d:'2,2 m de voie — léger, mais il ne tire qu’une petite benne' },
  { id:'standard', n:'Standard',         emo:'🚜', prix:5400,  f:tracteurStandard,
    demi:1.65, nez:3.70, d:'2,6 m de voie — outils plus larges, benne moyenne' },
  { id:'gros',     n:'Grande puissance', emo:'🚜', prix:13000, f:tracteurGros,
    demi:1.90, nez:4.15, d:'3,0 m de voie — les outils larges et toutes les bennes' }
];
const LARG = { prep:[3.4,4.6,6.8], sow:[2.4,3.6,5.4] };
const RAMPE = [9, 12.9, 18];            // largeur de rampe du pulvérisateur, par niveau
const BEC   = [4.8, 6.2, 9.2];          // largeur de la barre de coupe, par niveau

// Disques de collision de la partie tractée : découpés le long de la flèche, serrés sur la
// caisse. Une seule grosse bulle faisait éviter les obstacles de bien trop loin.
function discsTractes(ball, Lt, W){
  const n = Math.max(1, Math.round(Lt/2.4)), R = Math.max(Lt/(2*n)+.3, W*.45), out = [];
  for(let i=0;i<n;i++) out.push([ball - Lt*(i+.5)/n, R]);
  return out;
}

// ---------- outils portés ----------
function outilSol(p, W){
  const spin = [], n = Math.max(4, Math.round(W/.62)), z = -2.1, CH = 1.5;
  rbox(.24,.24,1.9, C.orange, 0,.9,-.95, p, .07);                  // flèche jusqu'à la boule
  rbox(CH,.42,3.8, C.orange, 0,.98,z-.6, p, .1);
  rbox(W,.3,.3, C.orange, 0,1,z, p, .1);
  rbox(W,.3,.3, C.orange, 0,1,z-1, p, .1);
  if (W > CH+.6) [1,-1].forEach(k => {                             // contreventement aux bouts
    const b = rbox(W/2-CH/2+.3,.16,.16, C.orange, k*(CH/2+(W/2-CH/2)/2),1.15,z-.5, p, .05);
    b.rotation.y = k*.22;
  });
  for(let i=0;i<n;i++){
    const x = -W/2 + (i+.5)*W/n;
    rbox(.11,.62,.11, C.dark, x,.72,z, p, .03); spin.push(disc(.44,x,.42,z,.34,p));
    rbox(.11,.62,.11, C.dark, x+.28,.72,z-1, p, .03); spin.push(disc(.44,x+.28,.42,z-1,-.34,p));
  }
  const cage = new THREE.Group(); cage.position.set(0,.42,z-2); p.add(cage);
  const cg = new THREE.CylinderGeometry(.4,.4,W+.1,10); cg.rotateZ(Math.PI/2);
  cage.add(new THREE.Mesh(cg, mat(C.steel)));
  for(let i=0;i<9;i++){ const a = i/9*6.28318;
    rbox(W+.1,.09,.09, C.dark, 0,Math.sin(a)*.44,Math.cos(a)*.44, cage, .03); }
  cage.userData.spin = cage; cage.userData.r = .44; spin.push(cage);
  [CH/2+.22,-CH/2-.22].forEach(x => {                              // roues de jauge
    spin.push(wheel(.4,.26,x,.4,z+1.05,p));
    rbox(.14,.8,.14, C.orange, x,.85,z+1.05, p, .03);
  });
  const mk = new THREE.Object3D(); mk.position.set(0,0,z-2); p.add(mk);   // le rouleau packer
  return { mk, spin, Lt:4.7 };
}
function outilSemis(p, W){
  const spin = [], tourne = [], n = Math.max(5, Math.round(W/.32)), z = -1.9;
  const TW = Math.min(W, 3.2);                                     // trémie : largeur plafonnée
  rbox(.26,.26,2.6, C.dark, 0,.9,-1.2, p, .07);
  rbox(TW,1.5,2.4, C.cream, 0,2,z-.5, p, .22);
  rbox(TW+.1,.3,2.5, C.orange, 0,2.85,z-.5, p, .1);
  const tur = new THREE.Group(); tur.position.set(0,3.15,z-.5); p.add(tur);
  cyl(.34,.34,.26,12, C.metal, 0,0,0, tur);
  for(let b=0;b<6;b++){ const a = b/6*6.28318;
    const pa = rbox(.42,.05,.14, C.steel, 0,.08,0, tur, .02);
    pa.rotation.y = a; pa.position.set(Math.cos(a)*.26,.08,Math.sin(a)*.26); }
  cyl(.16,.16,.5,10, C.metal, 0,-.3,0, tur);
  tourne.push(tur);
  rbox(TW,.5,2.6, C.orange, 0,1.15,z-.5, p, .12);
  rbox(W,.34,.34, C.orange, 0,1,z-1.9, p, .1);
  if (W > TW+.4) [1,-1].forEach(k => {
    const b = rbox(W/2-TW/2+.3,.16,.16, C.orange, k*(TW/2+(W/2-TW/2)/2),1.1,z-1.55, p, .05);
    b.rotation.y = k*.3;
  });
  for(let i=0;i<n;i++){
    const x = -W/2 + (i+.5)*W/n;
    rbox(.1,1.1,.1, C.metal, x,1.5,z-1.9, p, .04);
    spin.push(disc(.3,x,.34,z-2.2,.18,p,C.metal));
    spin.push(disc(.22,x,.24,z-2.8,0,p,C.tread));
  }
  [TW/2+.24,-TW/2-.24].forEach(x => spin.push(wheel(.58,.4,x,.58,z-.6,p)));
  const mk = new THREE.Object3D(); mk.position.set(0,0,z-2.8); p.add(mk);   // la ligne des socs
  return { mk, spin, tourne, Lt:5.1 };
}

// ---------- remorques : caisse creuse, trois capacités ----------
function caisse(p, W, H, L, y0, z, ep, col, plancher){
  if (plancher) rbox(W, ep, L, col, 0, y0+ep/2, z, p, .06);        // fond
  rbox(W, H, ep, col, 0, y0+H/2, z+L/2-ep/2, p, .08);              // face avant
  rbox(W, H, ep, col, 0, y0+H/2, z-L/2+ep/2, p, .08);              // hayon
  rbox(ep, H, L-2*ep, col,  W/2-ep/2, y0+H/2, z, p, .08);          // ridelles
  rbox(ep, H, L-2*ep, col, -W/2+ep/2, y0+H/2, z, p, .08);
  if (!plancher) return null;
  const wrap = new THREE.Group(); wrap.position.set(0, y0+ep, z); p.add(wrap);
  const gg = new THREE.BoxGeometry(W-2*ep, H-ep, L-2*ep); gg.translate(0,(H-ep)/2,0);
  const m = new THREE.Mesh(gg, mat(C.gold)); m.castShadow = true; wrap.add(m);
  wrap.scale.y = .01; wrap.visible = false;                        // vide : on voit le fond
  return wrap;
}
function filetDeco(p, W, L, y, z, col){              // liseré fin qui ceinture la caisse
  const e = .05;
  rbox(W+.02, e, e, col, 0, y, z+L/2, p, .02);
  rbox(W+.02, e, e, col, 0, y, z-L/2, p, .02);
  rbox(e, e, L, col,  W/2, y, z, p, .02);
  rbox(e, e, L, col, -W/2, y, z, p, .02);
}
function rebord(p, Wi, Wo, Li, Lo, y, z, col){       // ferme le décrochement caisse / rehausse
  rbox(Wo, .12, (Lo-Li)/2+.02, col, 0, y, z+(Li+Lo)/4, p, .04);
  rbox(Wo, .12, (Lo-Li)/2+.02, col, 0, y, z-(Li+Lo)/4, p, .04);
  rbox((Wo-Wi)/2+.02, .12, Li, col,  (Wi+Wo)/4, y, z, p, .04);
  rbox((Wo-Wi)/2+.02, .12, Li, col, -(Wi+Wo)/4, y, z, p, .04);
}
function bennePetite(p){
  const z = -2.95, roues = [];
  rbox(.22,.22,1.55, C.dark, 0,.85,-.78, p, .07);
  rbox(2.2,.3,3.5, '#b23a2c', 0,.75,z, p, .12);
  const fill = caisse(p, 2.1, 1.15, 3.4, .9, z, .12, '#d9d2bd', true);
  filetDeco(p, 2.12, 3.42, 1.55, z, '#b23a2c');
  [1,-1].forEach(k => roues.push(wheel(.62,.42,k*1.28,.62,z,p)));
  return { fill, roues, Lt:4.85, W:2.1 };
}
function benneMoyenne(p){
  const z = -3.5, roues = [];
  rbox(.24,.24,1.7, C.dark, 0,.85,-.85, p, .07);
  rbox(2.4,.34,4.5, '#1d4a7a', 0,.82,z, p, .12);
  const fill = caisse(p, 2.3, 1.2, 4.4, .99, z, .12, '#2f6fae', true);
  rebord(p, 2.3, 2.7, 4.4, 4.5, 2.19, z, '#2f6fae');
  caisse(p, 2.7, .9, 4.5, 2.25, z, .12, '#2f6fae', false);         // rehausse évasée
  filetDeco(p, 2.32, 4.42, 1.68, z, '#f2f4f6');
  rbox(.1,1.1,.1, C.steel, 1.36,3.6,z+1.4, p, .03);
  rbox(.1,1.1,.1, C.steel,-1.36,3.6,z+1.4, p, .03);
  rbox(2.8,.1,.1, C.steel, 0,4.15,z+1.4, p, .03);                  // arceau de bâche
  [.9,-.9].forEach(dz => {
    cyl(.11,.11,2.7,10, '#39424b', 0,.7,z+dz, p).rotation.z = Math.PI/2;
    rbox(.3,.3,.5, '#39424b', 0,.7,z+dz, p, .06);
  });
  [1,-1].forEach(k => { roues.push(wheel(.7,.5,k*1.48,.7,z+.9,p));
                        roues.push(wheel(.7,.5,k*1.48,.7,z-.9,p)); });
  return { fill, roues, Lt:5.95, W:2.7 };
}
function benneGrande(p){
  const z = -4.7, roues = [];
  rbox(.28,.28,1.85, C.dark, 0,.9,-.93, p, .07);
  rbox(2.6,.5,7, '#39424b', 0,.95,z, p, .12);
  const fill = caisse(p, 2.5, 1.9, 6.6, 1.2, z, .14, '#c8842a', true);
  rebord(p, 2.5, 2.9, 6.6, 6.7, 3.1, z, '#c8842a');
  caisse(p, 2.9, .7, 6.7, 3.16, z, .14, '#c8842a', false);
  ladder(2,1.33,2.2,z+3.05,p);
  for(let i=0;i<4;i++) rbox(3.02,.14,.14, '#39424b', 0,2.6,z-2.6+i*1.7, p, .04);
  [1.95,0,-1.95].forEach(dz => {
    cyl(.12,.12,2.9,10, '#39424b', 0,.78,z+dz, p).rotation.z = Math.PI/2;
    [1,-1].forEach(k => roues.push(wheel(.78,.52,k*1.58,.78,z+dz,p)));
  });
  return { fill, roues, Lt:8.15, W:2.9 };
}
const BENNES = [
  { id:'b8',  n:'Benne 8 m³',  emo:'🛻', vol:8,  cap:1800, force:0, prix:1600,
    f:bennePetite,  Lt:4.85, W:2.1, d:'un essieu — n’importe quel tracteur la tire' },
  { id:'b14', n:'Benne 14 m³', emo:'🛻', vol:14, cap:3200, force:1, prix:5200,
    f:benneMoyenne, Lt:5.95, W:2.7, d:'deux essieux et rehausse — tracteur standard' },
  { id:'b22', n:'Benne 22 m³', emo:'🛻', vol:22, cap:5200, force:2, prix:12000,
    f:benneGrande,  Lt:8.15, W:2.9, d:'trois essieux — grande puissance obligatoire' }
];
const benneDef = id => BENNES.find(b => b.id === id) || null;

// ---------- le catalogue : rien n'est donné, tout s'achète ----------
// Un poste par métier, trois machines par poste. Les niveaux ne sont pas liés entre eux :
// on peut mener une grande moissonneuse avec un petit semoir, c'est au joueur de décider
// où passe l'argent. Reprendre une machine pour en acheter une meilleure rend la moitié
// de son prix, sinon acheter petit d'abord serait toujours une erreur.
const nb = n => n.toFixed(1).replace('.', ',');
const MACHINES = [
  { k:'prep', n:'Déchaumeuse', emo:'🚜', prix:[3200,8500,19000],
    nom:['Compacte','Standard','Large'],
    det:i => 'tracteur ' + TRACTEURS[i].n.toLowerCase() + ' · disques sur ' + nb(LARG.prep[i]) + ' m' },
  { k:'sow', n:'Semoir', emo:'🌱', prix:[2800,7500,17000],
    nom:['Compact','Standard','Large'],
    det:i => 'tracteur ' + TRACTEURS[i].n.toLowerCase() + ' · ' + nb(LARG.sow[i]) + ' m de rangs' },
  { k:'fert', n:'Pulvérisateur', emo:'💧', prix:[3600,9500,21000],
    nom:['Cuve traînée','Cuve traînée renforcée','Automoteur'],
    det:i => (i < 2 ? 'derrière un tracteur ' + TRACTEURS[i].n.toLowerCase() : 'machine autonome')
             + ' · rampes de ' + nb(RAMPE[i]) + ' m' },
  { k:'harvest', n:'Moissonneuse', emo:'🌾', prix:[6500,15000,34000],
    nom:['Compacte','Compacte renforcée','Grande machine'],
    det:i => (i < 2 ? 'moissonneuse compacte' : 'grande moissonneuse') +
             ' · coupe de ' + nb(BEC[i]) + ' m' },
  { k:'trailer', n:'Tracteur de transport', emo:'🛻', prix:[2400,6000,13500],
    nom:['Compact','Standard','Grande puissance'],
    det:i => 'tracteur ' + TRACTEURS[i].n.toLowerCase() + ' · tire jusqu\u2019à ' +
             BENNES[i].vol + ' m³' }
];
const machDef = k => MACHINES.find(m => m.k === k) || null;

// Repliée, la vis doit longer le corps vers l'arrière — à 2,25 rad elle dépassait
// encore sur le côté, et du mauvais côté qui plus est.
const AUG_FOLD = Math.PI/2, AUG_OPEN = 0;

// ---------- pulvérisation : la cuve traînée, puis l'automoteur ----------
function detailCuve(p, R, L, x, y, z, col, dk){
  const c = cyl(R,R,L,18, col, x,y,z, p); c.rotation.z = Math.PI/2;
  rbox(L*.96,.07,.07, dk, x,y+R*.62,z, p, .02);          // filets longitudinaux
  rbox(L*.96,.06,.06, dk, x,y+R*.28,z, p, .02);
  cyl(.26,.3,.22,12, dk, x,y+R+.02,z, p);                // bouchon, au milieu de la cuve
}
// Cuve traînée : elle s'attelle derrière le tracteur du niveau, comme n'importe quel outil.
function cuveTrainee(p){
  const col = '#e8b41c', dk = '#b8352a', z = -2.55, roues = [];
  rbox(.24,.24,1.55, C.dark, 0,.85,-.78, p, .07);        // timon jusqu'à la boule
  rbox(1.7,.42,3.1, dk, 0,.95,z+.15, p, .1);
  detailCuve(p, 1.05, 2.6, 0, 1.9, z, '#e9e2cd', dk);
  rbox(2,.3,.3, dk, 0,1.1,z+.95, p, .08);
  rbox(2,.3,.3, dk, 0,1.1,z-.95, p, .08);
  rbox(1.7,.95,.66, col, 0,1.55,z-1.62, p, .14);         // bâti porteur des rampes
  rbox(1.8,.22,.74, dk, 0,1.97,z-1.62, p, .06);
  rbox(1.8,.22,.74, dk, 0,1.13,z-1.62, p, .06);
  [1,-1].forEach(k => roues.push(wheel(.62,.42,k*1.07,.62,z,p)));
  return { boom:[0,1.6,z-1.62], dk, roues, Lt:4.7, W:5.2 };
}
function pulveAutomoteur(g){
  const dk = C.blueDark, av = [], ar = [];
  rbox(2.3,1.1,4.2, C.blue, 0,2.55,-.2, g, .2);
  rbox(2.45,.42,4.4, dk, 0,1.95,-.2, g, .14);
  rbox(1.9,1.2,1.6, C.blue, 0,3.65,1.4, g, .16);
  glazing(1.9,.9,1.62, C.blue, 0,3.76,1.4, g);
  door(1.2,1.6, dk, .95,3.68,1.4, g, 1); door(1.2,1.6, dk, -.95,3.68,1.4, g, -1);
  rbox(2.12,.16,1.8, C.dark, 0,4.3,1.4, g, .06);
  beacon(-.7,4.44,1.4,g); tail(2.3,2.35,-2.42,g);
  rbox(2.36,.62,.22, C.dark, 0,2.18,1.96, g, .06); lamps(2.3,2.22,2.02,g);
  detailCuve(g, 1.15, 3, 0, 3.5, -1.4, '#e9e2cd', dk);
  rbox(1.8,1.2,.9, C.blue, 0,3.25,-2.95, g, .16);        // bloc arrière porteur de rampes
  rbox(1.92,.24,1, dk, 0,3.85,-2.95, g, .07);
  rbox(1.92,.24,1, dk, 0,2.65,-2.95, g, .07);
  rbox(.3,1.7,.3, dk, .78,2.4,-2.6, g, .06);             // jambes de liaison au châssis
  rbox(.3,1.7,.3, dk,-.78,2.4,-2.6, g, .06);
  ladder(1.6,1.3,2.4,.7,g);
  [[1.56,1.7],[-1.56,1.7]].forEach(([x,z]) => {
    rbox(.4,1.7,.4, dk, x*.85,1.5,z, g, .1); av.push(wheel(.98,.52,x,.98,z,g)); });
  [[1.56,-2.1],[-1.56,-2.1]].forEach(([x,z]) => {
    rbox(.4,1.7,.4, dk, x*.85,1.5,z, g, .1); ar.push(wheel(.98,.52,x,.98,z,g)); });
  return { boom:[0,3.25,-2.95], dk, wheels:av.concat(ar), vire:ar };
}
// Un segment de rampe : la poutre double et ses buses, dessinée dans son propre groupe
// pour que la rampe puisse se replier en trois brisures.
function segRampe(a, L, dk){
  rbox(L,.17,.17, dk, L/2,.16,0, a, .05);
  rbox(L,.13,.13, dk, L/2,-.22,0, a, .04);
  for(let i=0;i<Math.round(L/.45);i++){
    cyl(.03,.07,.16,5, C.gold, .25+i*.45,-.44,0, a);
    rbox(.09,.12,.09, C.dark, .25+i*.45,-.32,0, a, .03);
  }
}
function rampes(p, mnt, span){
  const half = span/2, bras = [], [bx,by,bz] = mnt.boom;
  const L1 = half*.42, L2 = half*.34, L3 = half*.24;
  [1,-1].forEach(sg => {
    const side = new THREE.Group(); side.position.set(bx,by,bz);
    side.rotation.y = sg>0?0:Math.PI; p.add(side);
    const a1 = new THREE.Group(); a1.position.set(.62,0,0); side.add(a1); segRampe(a1,L1,mnt.dk);
    const a2 = new THREE.Group(); a2.position.set(L1,0,0); a1.add(a2);   segRampe(a2,L2,mnt.dk);
    const a3 = new THREE.Group(); a3.position.set(L2,0,0); a2.add(a3);   segRampe(a3,L3,mnt.dk);
    bras.push({a1,a2,a3});
  });
  const mk = new THREE.Object3D(); mk.position.set(0,0,bz); p.add(mk);
  return { mk, fold:f => bras.forEach(({a1,a2,a3}) => {
    a1.rotation.z = (1-f)*1.48; a2.rotation.z = -(1-f)*2.85; a3.rotation.z = (1-f)*2.85; }) };
}

// ---------- moisson : deux machines, trois barres de coupe ----------
// La vis de déchargement n'est pas dans les références — elle y est dessinée couchée le
// long du corps. Ici elle doit s'ouvrir vers la benne, on la remonte donc articulée.
function visDechargement(g, x, y, z, L){
  const piv = new THREE.Group(); piv.position.set(x,y,z); piv.rotation.y = AUG_FOLD; g.add(piv);
  cyl(.26,.26,L,8, C.metal, L/2,0,0, piv).rotation.z = Math.PI/2;
  rbox(.34,.5,.34, C.steel, .35,-.28,0, piv, .06);
  rbox(.62,.58,.62, C.metal, L+.05,-.28,0, piv, .12);                    // la goulotte
  const spout = new THREE.Object3D(); spout.position.set(L+.05,-.66,0); piv.add(spout);
  return { piv, spout };
}
function moissCompacte(g){
  const av = [], ar = [];
  rbox(2.4,1.3,3.4, '#c4432f', 0,1.55,-.3, g, .18);
  rbox(2.5,.44,3.5, '#8e2418', 0,.95,-.3, g, .14);
  rbox(2.2,.95,1.7, '#c4432f', 0,2.62,-1.1, g, .16);
  rbox(2.3,.14,1.8, '#8e2418', 0,3.14,-1.1, g, .05);
  const fw = new THREE.Group(); fw.position.set(0,2.19,-1.1); g.add(fw);  // le grain dans la trémie
  const fg = new THREE.BoxGeometry(1.8,.86,1.4); fg.translate(0,.43,0);
  fw.add(new THREE.Mesh(fg, mat(C.gold))); fw.scale.y = .02;
  rbox(1.7,1.1,1.5, '#c4432f', 0,2.75,.8, g, .16);
  glazing(1.7,.85,1.52, '#c4432f', 0,2.86,.8, g);
  door(1.1,1.5, '#8e2418', .86,2.78,.8, g, 1); door(1.1,1.5,'#8e2418',-.86,2.78,.8,g,-1);
  rbox(1.94,.14,1.7, C.dark, 0,3.36,.8, g, .05);
  beacon(-.62,3.48,.8,g); lamps(1.9,3.2,1.6,g); tail(2.1,1.5,-2.05,g);
  const vis = visDechargement(g, .5, 3.22, -.6, 3.2);
  [1,-1].forEach(k => av.push(wheel(.95,.56,k*1.6,.95,.9,g)));
  [1,-1].forEach(k => ar.push(wheel(.55,.38,k*1.5,.55,-1.95,g)));
  return { head:[0,0,2.5], y:.9, fill:fw, vis, wheels:av.concat(ar), vire:ar,
           corps:[[2.5,2.1],[0,1.9],[-1.9,1.7]] };
}
function moissGrande(g){
  const av = [], ar = [];
  rbox(2.8,1.5,4.2, '#f0b41d', 0,1.7,-.4, g, .18);
  rbox(2.9,.5,4.3, '#22262a', 0,1,-.4, g, .14);
  rbox(2.6,1.15,2.1, '#f0b41d', 0,2.92,-1.4, g, .16);
  rbox(2.7,.16,2.2, '#22262a', 0,3.55,-1.4, g, .05);
  const fw = new THREE.Group(); fw.position.set(0,2.39,-1.4); g.add(fw);
  const fg = new THREE.BoxGeometry(2.2,1.02,1.8); fg.translate(0,.51,0);
  fw.add(new THREE.Mesh(fg, mat(C.gold))); fw.scale.y = .02;
  rbox(1.9,1.25,1.7, '#f0b41d', 0,3.05,.9, g, .16);
  glazing(1.9,.94,1.72, '#f0b41d', 0,3.18,.9, g);
  door(1.25,1.7, '#22262a', .95,3.08,.9, g, 1); door(1.25,1.7, '#22262a',-.95,3.08,.9,g,-1);
  rbox(2.14,.16,1.9, C.dark, 0,3.72,.9, g, .06);
  rbox(2.1,.2,.36, C.dark, 0,3.6,1.42, g, .06);            // bandeau au ras du toit
  for(let i=0;i<2;i++) phares(.2+i*.4, 3.6, 1.6, g);
  rbox(1.9,.22,.5, C.dark, 0,3.91,.95, g, .07);            // panneau de lumière sur le toit
  for(let i=0;i<2;i++) phares(.2+i*.4, 3.91, 1.16, g);
  beacon(-.72,3.86,.9,g); lamps(2.2,3.5,1.78,g); tail(2.5,1.65,-2.45,g);
  ladder(1.9,1.5,1.5,.4,g);
  rbox(2.35,.85,1.35, '#f0b41d', 0,2.35,-2.45, g, .16);    // capot moteur arrière
  rbox(2.45,.2,1.45, '#22262a', 0,2.82,-2.45, g, .06);
  rbox(2.15,.6,.16, C.dark, 0,2.3,-3.1, g, .05);           // calandre de radiateur
  for(let i=0;i<6;i++) rbox(.09,.48,.1, '#3a4148', -.8+i*.32,2.3,-3.16, g, .02);
  rbox(2.9,.7,1.1, '#22262a', 0,1,-2.6, g, .12);           // éparpilleur
  const vis = visDechargement(g, .6, 3.62, -.9, 3.8);
  [1,-1].forEach(k => av.push(wheel(1.12,.68,k*1.86,1.12,1.1,g)));
  [1,-1].forEach(k => ar.push(wheel(.62,.42,k*1.73,.62,-2.3,g)));
  return { head:[0,0,2.9], y:1, fill:fw, vis, wheels:av.concat(ar), vire:ar,
           corps:[[3.1,2.5],[0,2.3],[-2.5,2.1]] };
}
function becCoupe(g, mnt, W){
  const [x0,,z0] = mnt.head, y = mnt.y;
  rbox(1.9,1.1*y,1.1, C.cream, x0,1.35*y,z0-.8, g, .14);
  rbox(W,.7*y,1.3, C.metal, x0,1*y,z0+.2, g, .14);
  rbox(W,.34,.5, C.dark, x0,.6*y,z0+.7, g, .08);
  for(let i=0;i<Math.round(W/.48);i++) rbox(.16,.1,.34, C.steel, -W/2+.24+i*.48,.6*y,z0+.95, g, .03);
  const r = reel(W-.5,.72*y,5, x0,1.5*y,z0+.5, g, C.gold);   // rabatteur, sur la barre de coupe
  [1,-1].forEach(k => cyl(0,.22,1.5,5, C.cream, k*(W/2-.15),.95*y,z0+.75, g).rotation.x = Math.PI/2);
  const mk = new THREE.Object3D(); mk.position.set(0,0,z0+.95); g.add(mk);
  return { reel:r, mk };
}

// ---------- engins ----------
// `opt.niv` = niveau de tracteur (0..2), `opt.benne` = identifiant de remorque attelée
// ou null quand le tracteur roule seul, décroché.
function build(kind, opt){
  opt = opt || {};
  const niv = Math.max(0, Math.min(2, opt.niv|0)), TR = TRACTEURS[niv];
  JELLY = true;
  const g = new THREE.Group();
  let d;
  if (kind === 'prep' || kind === 'sow' || kind === 'trailer'){
    const t = TR.f(g);
    const hitch = new THREE.Group(); hitch.position.set(0,0,t.ball); g.add(hitch);
    const corps = [[ (t.ball + TR.nez)/2, TR.demi ]];
    if (kind === 'prep'){
      const W = LARG.prep[niv], o = outilSol(hitch, W);
      corps.push.apply(corps, discsTractes(t.ball, o.Lt, W));
      d = { wheels:t.wheels, steer:t.avant.map(w => ({ w, k:1 })), spinners:o.spin, hitch,
            tool:{ obj:o.mk, W, near:-.5, far:.15 }, corps, niv };
    } else if (kind === 'sow'){
      const W = LARG.sow[niv], o = outilSemis(hitch, W);
      corps.push.apply(corps, discsTractes(t.ball, o.Lt, W));
      d = { wheels:t.wheels, steer:t.avant.map(w => ({ w, k:1 })), spinners:o.spin,
            tourne:o.tourne, hitch, tool:{ obj:o.mk, W, near:-.45, far:.3 }, corps, niv };
    } else {
      const B = opt.benne ? benneDef(opt.benne) : null;
      let fill = null, wheels = t.wheels;
      if (B){
        const r = B.f(hitch);
        fill = r.fill; wheels = wheels.concat(r.roues);
        corps.push.apply(corps, discsTractes(t.ball, r.Lt, r.W));
      }
      d = { wheels, steer:t.avant.map(w => ({ w, k:1 })), spinners:[], hitch,
            fill, bin:fill, tool:null, benne:B ? B.id : null, corps, niv };
    }
  }
  else if (kind === 'fert'){
    // Trois niveaux là aussi : cuve traînée derrière le tracteur du parc pour les deux
    // premiers, automoteur pour le dernier. La rampe s'élargit d'un cran à chaque fois.
    const span = RAMPE[niv];
    let mnt, wheels, steer, corps, mk;
    if (niv < 2){
      const t = TR.f(g);
      const hitch = new THREE.Group(); hitch.position.set(0,0,t.ball); g.add(hitch);
      const cv = cuveTrainee(hitch);
      const r = rampes(hitch, cv, span);
      mk = r.mk; mnt = r;
      wheels = t.wheels.concat(cv.roues);
      steer = t.avant.map(w => ({ w, k:1 }));
      corps = [[ (t.ball + TR.nez)/2, TR.demi ]].concat(discsTractes(t.ball, cv.Lt, cv.W));
      d = { wheels, steer, spinners:[], hitch,
            tool:{ obj:mk, W:span, near:-.55, far:.55 }, corps, niv, fold:r.fold };
    } else {
      const a = pulveAutomoteur(g);
      const r = rampes(g, a, span);
      mk = r.mk;
      d = { wheels:a.wheels, steer:a.vire.map(w => ({ w, k:-1 })), spinners:[],
            tool:{ obj:mk, W:span, near:-.55, far:.55 },
            corps:[[.5,1.9],[-3.1,2.5]], niv, fold:r.fold };
    }
    d.fold(1);                                     // rampes dépliées, comme avant
  }
  else {
    // Moissonneuse compacte pour les deux premiers niveaux, grande pour le dernier ; et
    // une barre de coupe qui passe de 4,8 à 9,2 m. Trémie, vis de déchargement et
    // goulotte restent en place : c'est par elles que la benne se remplit.
    const M = (niv < 2 ? moissCompacte : moissGrande)(g);
    const b = becCoupe(g, M, BEC[niv]);
    const W = BEC[niv];
    const corps = M.corps.slice();
    // La coupe est large mais mince : un disque à sa demi-largeur déborderait de quatre
    // mètres devant la machine et la ferait s'écarter des obstacles de bien trop loin.
    // On le plafonne, comme on l'a toujours fait pour les rampes du pulvérisateur.
    corps[0] = [ M.head[2] + .7, Math.max(2.0, Math.min(3.0, W*.45)) ];
    d = { wheels:M.wheels, steer:M.vire.map(w => ({ w, k:-1 })),
          spinners:[{ spin:b.reel, rate:1.1 }],
          fill:M.fill, auger:M.vis.piv, spout:M.vis.spout,
          tool:{ obj:b.mk, W, near:-.35, far:.4 }, corps, niv };
  }
  JELLY = false;
  g.userData = d;
  return g;
}
// Une benne posée au sol : la même caisse, sans tracteur, avec sa béquille. Son origine
// est le point d'attelage — il suffit d'y amener la boule pour la reprendre.
function buildBenneSeule(id){
  const B = benneDef(id); if (!B) return null;
  JELLY = true;
  const g = new THREE.Group();
  const r = B.f(g);
  rbox(.16,.86,.16, C.dark, 0,.43,-.45, g, .04);
  rbox(.44,.12,.34, C.dark, 0,.06,-.45, g, .03);
  JELLY = false;
  g.userData = { benne:id, fill:r.fill, Lt:B.Lt, W:B.W };
  return g;
}
// Un engin remplacé rend ses géométries : seules les boîtes arrondies sont partagées.
function libere(o){
  o.traverse(n => {
    if (!n.isMesh) return;
    if (n.geometry && !(n.geometry.userData && n.geometry.userData.shared)) n.geometry.dispose();
    // les feux ont chacun leur matière, pour pouvoir s'allumer séparément : elle part avec eux
    if (n.material && n.material.userData && n.material.userData.own) n.material.dispose();
  });
}
