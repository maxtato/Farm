"use strict";
// ---------- bâtiments de la ferme ----------
// Maçonnerie, menuiseries et couvertures reprises des références : un prisme pour le toit
// avec ses pignons, des pans débordants par-dessus, des fenêtres à croisillons et volets.
// Rien ici ne bouge : ce sont des décors, posés une fois, et déclarés comme obstacles.
const BAT = {
  mur:'#e6dcc4', murOmbre:'#cdc2a6', bois:'#8a5f34', boisF:'#6b4726',
  toitTuile:'#b4503a', toitPente:'#9c412e', toitTole:'#57616b', toitToleP:'#48525c',
  beton:'#b6b2a6', vitre:'#1a2129', porteC:'#3f5163', ferronnerie:'#9aa3ac', rouge:'#b8453a'
};
function prism(w,h,d,col,x,y,z,p){          // toit à deux pans, pignons compris
  const sh = new THREE.Shape();
  sh.moveTo(-w/2,0); sh.lineTo(w/2,0); sh.lineTo(0,h);
  const g = new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:false});
  g.translate(0,0,-d/2);
  const m = new THREE.Mesh(g, mat(col));
  m.position.set(x,y,z); m.castShadow = m.receiveShadow = true; p.add(m); return m;
}
function panToit(w,h,d,col,x,y,z,p,ov){     // couverture débordante par-dessus le prisme
  const slope = Math.atan2(h, w/2), len = Math.hypot(w/2,h)+(ov||.3);
  [1,-1].forEach(s => {
    const m = rbox(len,.16,d+(ov||.3)*2, col, x+s*(w/4)-s*.04, y+h/2, z, p, .05);
    m.rotation.z = -s*slope;
  });
}
function fenetre(w,h,x,y,z,p,volets){
  rbox(w+.16,h+.16,.12, BAT.mur, x,y,z, p, .04);
  rbox(w,h,.16, BAT.vitre, x,y,z+.03, p, .03);
  rbox(w+.16,.1,.2, BAT.bois, x,y+h/2+.06,z+.04, p, .03);
  rbox(.08,h,.18, BAT.mur, x,y,z+.05, p, .02);          // croisillon
  rbox(w,.08,.18, BAT.mur, x,y,z+.05, p, .02);
  if (volets){
    rbox(w/2,h,.1, BAT.rouge, x-w*.78,y,z+.06, p, .03);
    rbox(w/2,h,.1, BAT.rouge, x+w*.78,y,z+.06, p, .03);
  }
}
function huisserie(w,h,x,y,z,p,garage){
  rbox(w+.18,h+.12,.14, BAT.murOmbre, x,y,z-.02, p, .04);      // encadrement
  rbox(w,h,.16, BAT.porteC, x,y,z+.03, p, .04);
  if (garage){
    for(let i=0;i<5;i++) rbox(w-.12,.07,.2, BAT.murOmbre, x,y-h/2+(i+1)*h/6,z+.05, p, .02);
    rbox(.5,.1,.2, BAT.ferronnerie, x,y-h/2+.35,z+.06, p, .03);
  } else {
    rbox(.09,.09,.24, BAT.ferronnerie, x+w*.34,y,z+.1, p, .03);
    rbox(.16,.3,.14, BAT.ferronnerie, x+w*.34,y,z+.05, p, .03);
  }
}

// ---------- 1 · maison de ferme ----------
function maisonFerme(){
  const g = new THREE.Group();
  const W = 9.5, D = 7, H = 6.2;
  rbox(W,H,D, BAT.mur, 0,H/2,0, g, .12);
  rbox(W+.3,.5,D+.3, BAT.murOmbre, 0,.25,0, g, .08);      // soubassement
  prism(W+.8,3.2,D+.8, BAT.toitTuile, 0,H,0, g);
  panToit(W+.8,3.2,D+.8, BAT.toitPente, 0,H,0, g, .5);
  rbox(.9,2.4,.9, BAT.toitTuile, W/4,H+2.4,-D/4, g, .1);  // cheminée
  rbox(1.1,.3,1.1, BAT.murOmbre, W/4,H+3.6,-D/4, g, .05);
  [-2.9,2.9].forEach(x => fenetre(1.1,1.4, x,2.1,D/2, g, true));
  [-2.9,0,2.9].forEach(x => fenetre(1.1,1.3, x,4.6,D/2, g, x!==0));
  huisserie(1.5,2.6, 0,1.3,D/2+.05, g);
  rbox(1.8,.22,.9, BAT.bois, 0,2.75,D/2+.35, g, .05);     // marquise
  rbox(2.2,.18,1.4, BAT.beton, 0,.12,D/2+.6, g, .04);     // perron
  g.userData.obst = [[-2.6,3.2],[2.6,3.2]];               // demi-largeur, en deux disques
  return g;
}

// ---------- 2 · petite maison ----------
function maisonPetite(){
  const g = new THREE.Group();
  const W = 6.4, D = 5, H = 3.6;
  rbox(W,H,D, BAT.mur, 0,H/2,0, g, .12);
  rbox(W+.25,.4,D+.25, BAT.murOmbre, 0,.2,0, g, .07);
  prism(W+.7,2.2,D+.7, BAT.toitTuile, 0,H,0, g);
  panToit(W+.7,2.2,D+.7, BAT.toitPente, 0,H,0, g, .4);
  rbox(.7,1.9,.7, BAT.toitTuile, -W/4,H+1.9,0, g, .09);
  [-1.9,1.9].forEach(x => fenetre(1,1.2, x,2,D/2, g, true));
  huisserie(1.3,2.2, 0,1.1,D/2+.05, g);
  g.userData.obst = [[-1.6,2.3],[1.6,2.3]];
  return g;
}

// ---------- 3 · longère, avec son appentis en guise de garage ----------
function longere(){
  const g = new THREE.Group();
  const W = 15, D = 5.4, H = 3.9;
  rbox(W,H,D, BAT.mur, 0,H/2,0, g, .12);
  rbox(W+.3,.45,D+.3, BAT.murOmbre, 0,.22,0, g, .07);
  prism(W+.7,2.4,D+.7, BAT.toitTuile, 0,H,0, g);
  panToit(W+.7,2.4,D+.7, BAT.toitPente, 0,H,0, g, .45);
  // implantation calculée : 1,49 m entre chaque élément et jusqu'aux bords
  [-5.43,0.12,2.77,5.43].forEach(x => fenetre(1,1.2, x, 2.2, D/2, g, true));
  huisserie(1.4,2.3, -2.65,1.15,D/2+.05, g);
  const a = new THREE.Group(); a.position.set(W/2+1.7,0,0); g.add(a);
  const AW = 3.6, AD = D-.4, AH = 3.1;
  rbox(AW,AH,AD, BAT.murOmbre, 0,AH/2,0, a, .1);
  const r = rbox(AW+.7,.18,AD+.4, BAT.toitTuile, -.1,AH+.42,0, a, .05); r.rotation.z = -.26;
  rbox(.3,AH,.3, BAT.bois, AW/2-.2,AH/2, AD/2-.2, a, .05);
  rbox(.3,AH,.3, BAT.bois, AW/2-.2,AH/2,-AD/2+.2, a, .05);
  huisserie(2.6,2.5, 0,1.25,AD/2+.05, a, true);           // porte de garage
  g.userData.obst = [[-5.6,2.6],[-1.9,2.6],[1.9,2.6],[5.6,2.6],[8.9,2.2]];
  return g;
}

// ---------- pièces communes aux silos ----------
function fosse(w,d,x,z,p,nb){                 // grille de réception au sol
  const g = new THREE.Group(); g.position.set(x,0,z); p.add(g);
  rbox(w+.8,.3,d+.8, BAT.beton, 0,.15,0, g, .05);
  rbox(w,.5,d, '#14181c', 0,.05,0, g, .02);
  for(let i=0;i<(nb||9);i++)
    rbox(w+.1,.09,.11, BAT.ferronnerie, 0,.3,-d/2+(i+.5)*d/(nb||9), g, .03);
  rbox(.14,.14,d+.8, BAT.ferronnerie,  w/2+.18,.34,0, g, .04);
  rbox(.14,.14,d+.8, BAT.ferronnerie, -w/2-.18,.34,0, g, .04);
  return g;
}
function echelle(h,x,y,z,p,cage){
  rbox(.07,h,.07, BAT.ferronnerie, x-.24,y+h/2,z, p, .02);
  rbox(.07,h,.07, BAT.ferronnerie, x+.24,y+h/2,z, p, .02);
  for(let i=0;i<Math.floor(h/.4);i++) rbox(.62,.06,.06, BAT.ferronnerie, x,y+.3+i*.4,z, p, .02);
  if (cage){
    // crinoline : arceaux horizontaux en demi-cercle, ouverts vers la paroi, reliés par
    // trois filantes. Ils commencent à 2,20 m, comme sur une vraie échelle.
    const R = .42, y0 = y + 2.2, n = Math.max(1, Math.floor((h - 2.2)/.9));
    for(let i=0;i<n;i++){
      const t = new THREE.Mesh(new THREE.TorusGeometry(R,.04,4,12,Math.PI), mat(BAT.ferronnerie));
      t.position.set(x, y0 + i*.9, z);
      t.rotation.set(Math.PI/2, 0, 0);
      t.castShadow = true; p.add(t);
    }
    const hc = (n-1)*.9 + .3;
    [[R,0],[0,R],[-R,0]].forEach(([dx,dz]) =>
      rbox(.06,hc,.06, BAT.ferronnerie, x+dx, y0 + hc/2 - .15, z+dz, p, .02));
  }
}
function echellePlaquee(h, dist, azim, y, p, cage, cx, cz){
  const grp = new THREE.Group();
  grp.position.set(cx||0, 0, cz||0);
  grp.rotation.y = azim; p.add(grp);
  echelle(h, 0, y, dist, grp, cage);
  return grp;
}
// relie deux points par un tube : impossible qu'il flotte dans le vide
function tube(r, a, b, col, p, seg){
  const d = new THREE.Vector3(b[0]-a[0], b[1]-a[1], b[2]-a[2]);
  const L = d.length();
  const m = cyl(r,r,L,seg||8, col, (a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2, p);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), d.normalize());
  return m;
}
function caisson(w,h, a, b, col, p){          // le même, à section carrée
  const d = new THREE.Vector3(b[0]-a[0], b[1]-a[1], b[2]-a[2]);
  const L = d.length();
  const m = rbox(w,L,h, col, (a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2, p, .05);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), d.normalize());
  return m;
}
// goulotte de reprise : à l'opposé de la fosse, la benne se gare dessous
function goulotte(a, out, p){
  tube(.3, a, out, BAT.ferronnerie, p);
  rbox(.85,.75,.85, BAT.ferronnerie, out[0],out[1],out[2], p, .08);
  cyl(.36,.2,.95,10, BAT.ferronnerie, out[0],out[1]-.82,out[2], p);
  cyl(.22,.22,.55,8, '#3f4a52', out[0],out[1]-1.42,out[2], p);
  return out[1]-1.7;
}

// ---------- 4 · petit silo : deux cellules carrées sur pieds ----------
function siloPetit(){
  const g = new THREE.Group();
  const CW = 3, H = 5.4, GAP = 3.4, LEGY = 2.4, PZ = CW/2 + 2.8;
  rbox(GAP+CW+1.4,.3,CW+1.4, BAT.beton, 0,.15,0, g, .06);
  [-GAP/2, GAP/2].forEach(dx => {
    rbox(CW,H,CW, '#c9ccc8', dx,H/2+LEGY,0, g, .12);
    for(let i=0;i<6;i++) rbox(CW+.08,.12,CW+.08, '#aeb2ae', dx,LEGY+.8+i*(H-1)/5,0, g, .03);
    const cone = cyl(0,CW*.72,2.2,4, '#b9bdb9', dx,LEGY-1.1,0, g);
    cone.rotation.set(Math.PI,Math.PI/4,0);
    cyl(.34,.34,.9,8, BAT.ferronnerie, dx,.75,0, g);
    prism(CW+.5,1.1,CW+.5, BAT.toitTole, dx,H+LEGY,0, g);
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz]) =>
      rbox(.24,LEGY,.24, BAT.ferronnerie, dx+sx*(CW/2-.2),LEGY/2,sz*(CW/2-.2), g, .05));
  });
  const SPAN = GAP + CW - .4;
  [1,-1].forEach(sz => {
    rbox(SPAN,.2,.2, BAT.ferronnerie, 0,LEGY-.35,sz*(CW/2-.2), g, .05);
    rbox(SPAN,.2,.2, BAT.ferronnerie, 0,LEGY-1.6,sz*(CW/2-.2), g, .05);
  });
  echellePlaquee(H+LEGY-.2, CW/2+.14, Math.PI/2, 0, g, true, GAP/2, 0);
  fosse(2.6,2, 0, PZ, g, 9);
  rbox(1.1,.28,PZ-CW/2, BAT.beton, 0,.14,(PZ+CW/2)/2, g, .04);
  goulotte([0,1.1,-CW/2+.2], [0,5.3,-(CW/2+3)], g);
  g.userData.obst = [[-1.9,2],[1.9,2]];
  g.userData.depot = [0, PZ];                 // où l'on vient déverser la benne
  return g;
}

// ---------- 5 · grand silo : cellule métallique ondulée ----------
function siloGrand(){
  const g = new THREE.Group();
  const R = 4.6, H = 8.4, PZ = R + 3.6;
  cyl(R+.8,R+.8,.3,24, BAT.beton, 0,.15,0, g);
  cyl(R,R,H,24, '#c9ccc8', 0,H/2+.3,0, g);
  for(let i=0;i<17;i++) cyl(R+.04,R+.04,.15,24, '#aeb2ae', 0,.85+i*(H-.9)/16,0, g);
  for(let i=0;i<14;i++){
    const a = i/14*6.283;
    rbox(.18,H,.18, '#9aa0a0', Math.cos(a)*(R+.03),H/2+.3,Math.sin(a)*(R+.03), g, .04);
  }
  cyl(0,R+.4,2.4,24, BAT.toitTole, 0,H+1.5,0, g);
  cyl(.46,.46,.8,10, BAT.ferronnerie, 0,H+2.8,0, g);
  echellePlaquee(H - .1, R+.12, .95, .3, g, true);
  fosse(3.4,2.4, 0, PZ, g, 11);
  tube(.36, [0,.35,PZ-1.2], [0,H+1.9,.6], BAT.ferronnerie, g);
  rbox(1.3,.85,1.3, BAT.ferronnerie, 0,.42,PZ-1.7, g, .1);
  rbox(1,.6,1, BAT.ferronnerie, 0,H+2.15,.6, g, .08);
  goulotte([0,.7,-R+.7], [0,5.3,-(R+3.2)], g);
  rbox(1.1,.8,1.1, BAT.ferronnerie, 0,.45,-R+.4, g, .1);
  g.userData.obst = [[-2.6,2.6],[0,2.7],[2.6,2.6]];
  g.userData.depot = [0, PZ];
  return g;
}

// Pose un bâtiment : on l'oriente, on l'installe, et on relève ses disques d'obstacle
// dans le même mouvement. `obst` est donné en repère bâtiment — décalage latéral, rayon.
function poserBatiment(f, x, z, ang){
  const g = f();
  g.position.set(x, 0, z); g.rotation.y = ang || 0;
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);
  const c = Math.cos(ang||0), s = Math.sin(ang||0);
  (g.userData.obst || []).forEach(([off,r]) => addObst(x + c*off, z - s*off, r));
  return g;
}

// ---------- le hameau : trois bâtiments posés au bord de la parcelle ----------
// Ils occupent la partie ouest de la cour, entre le champ et la grange : la ferme et la
// petite maison en première ligne, portes tournées vers la parcelle, la longère derrière.
poserBatiment(maisonFerme,  -33, YARD + 1,  Math.PI);
poserBatiment(maisonPetite, -22, YARD,      Math.PI);
poserBatiment(longere,      -28, YARD + 10, Math.PI);

// ---------- les deux silos, à acheter ----------
// Ils ne sont pas là au départ : on les monte quand on peut se les payer. Chacun ajoute un
// point de déchargement — la benne se vide au plus proche — et fait monter le prix payé,
// puisqu'on peut garder la récolte au lieu de la brader à la moisson.
const SILOS = [
  { id:'petit', n:'Petit silo', emo:'🏚️', prix:6800, f:siloPetit,
    x:18, z:YARD - 1, ang:0, prime:.08,
    d:'deux cellules sur pieds — +8 % sur le prix payé' },
  { id:'grand', n:'Grand silo', emo:'🏢', prix:16500, f:siloGrand,
    x:31, z:YARD + 1, ang:0, prime:.18,
    d:'cellule métallique de 9 m — +18 % sur le prix payé' }
];
const siloDef = id => SILOS.find(s => s.id === id) || null;
const silosBatis = {};                        // identifiant -> groupe posé
// Les points où la benne peut se vider : le silo d'origine, plus ceux qu'on a fait bâtir.
const DEPOTS = [SILO];             // le silo d'origine en fait partie d'office
function montreSilo(id){
  const S = siloDef(id);
  if (!S || silosBatis[id]) return null;
  const g = poserBatiment(S.f, S.x, S.z, S.ang);
  silosBatis[id] = g;
  const [dx, dz] = g.userData.depot || [0,0];
  const c = Math.cos(S.ang), s = Math.sin(S.ang);
  DEPOTS.push(new THREE.Vector3(S.x + c*dx + s*dz, 0, S.z - s*dx + c*dz));
  return g;
}
