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
function mirrors(w,y,z,p,col){
  [1,-1].forEach(s => {
    rbox(.06,.06,.5, col, s*(w/2+.24), y, z+.2, p, .02);
    rbox(.12,.34,.1, C.dark, s*(w/2+.42), y-.06, z+.42, p, .03);
  });
}
function ladder(h,x,y,z,p){
  rbox(.07,h,.07, C.metal, x,y,z-.16, p, .02);
  rbox(.07,h,.07, C.metal, x,y,z+.16, p, .02);
  for(let i=0;i<3;i++) rbox(.09,.06,.42, C.metal, x,y-h/2+.2+i*(h-.35)/2,z, p, .02);
}
function fender(w,r,x,y,z,p,col){            // aile au-dessus d'une roue
  rbox(w,.16,r*2.1, col, x,y+r*.92,z, p, .07);
  rbox(w,r*.55,.16, col, x,y+r*.62,z-r*1.0, p, .05);
  rbox(w,r*.35,.16, col, x,y+r*.74,z+r*1.0, p, .05);
}
function wheel(r,w,x,y,z,p){
  const steer = new THREE.Group(); steer.position.set(x,y,z); p.add(steer);
  const spin = new THREE.Group(); steer.add(spin);
  const tg = new THREE.CylinderGeometry(r,r,w,16); tg.rotateZ(Math.PI/2);
  const t = new THREE.Mesh(tg, mat(C.tire)); t.castShadow = true; spin.add(t);
  const hg = new THREE.CylinderGeometry(r*.42,r*.42,w+.14,12); hg.rotateZ(Math.PI/2);
  spin.add(new THREE.Mesh(hg, mat(C.cream)));
  const NL = 16, lug = new THREE.BoxGeometry(w*.94,.06,r*.2);
  for(let i=0;i<NL;i++){
    const a = i/NL*6.28318, m = new THREE.Mesh(lug, mat(C.tread));
    m.position.set(0, Math.sin(a)*(r-.015), Math.cos(a)*(r-.015));
    m.rotation.x = -a; m.castShadow = true; spin.add(m);
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
function fillBox(w,h,d,x,y,z,p){
  const wrap = new THREE.Group(); wrap.position.set(x,y,z); p.add(wrap);
  const g = new THREE.BoxGeometry(w,h,d); g.translate(0,h/2,0);
  const m = new THREE.Mesh(g, mat(C.gold)); m.castShadow = true; wrap.add(m);
  wrap.scale.y = .02; return wrap;
}

// Repliée, la vis doit longer le corps vers l'arrière — à 2,25 rad elle dépassait
// encore sur le côté, et du mauvais côté qui plus est.
const AUG_FOLD = Math.PI/2, AUG_OPEN = 0;

// ---------- engins : formes d'origine ----------
function tractorBase(g, col){
  const dk = col===C.green ? C.greenDark : C.blueDark;
  rbox(1.95,1,3.7, col, 0,1.3,.7, g, .16);
  rbox(2.05,.4,3.8, dk, 0,.82,.7, g, .12);
  rbox(2.02,.22,2.6, dk, 0,1.62,1.1, g, .05);
  rbox(1.66,1.15,1.5, col, 0,2.3,-.15, g, .16);
  glazing(1.66,.92,1.52, col, 0,2.44,-.15, g);
  door(1.15,1.5, dk, .83,2.34,-.15, g, 1); door(1.15,1.5, dk, -.83,2.34,-.15, g, -1);
  rbox(1.96,.14,1.72, C.dark, 0,2.94,-.15, g, .05);
  cyl(.12,.1,1.35,6, C.dark, .78,2.6,1.5, g);
  beacon(-.62,3.06,-.15, g);
  lamps(1.9,1.42,2.56,g);
  tail(1.95,1.32,-1.26,g);   // en saillie sur la face arrière
  // attache caravane : plaque, chapes et boule. C'est le pivot de tout ce qui est tracté.
  rbox(.66,.13,.55, C.dark, 0,.82,-1.95, g, .05);
  rbox(.15,.36,.15, C.dark,  .24,.6,-2.0, g, .04);
  rbox(.15,.36,.15, C.dark, -.24,.6,-2.0, g, .04);
  cyl(.1,.13,.14,10, C.metal, 0,.92,-2.15, g);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.14,10,8), mat(C.metal));
  ball.position.set(0,1.04,-2.15); ball.castShadow = true; g.add(ball);
  const hitch = new THREE.Group(); hitch.position.set(0,0,-2.15); g.add(hitch);   // pivot = la boule
  const w = [ wheel(1.28,.66,1.43,1.28,-.55,g), wheel(1.28,.66,-1.43,1.28,-.55,g),
              wheel(.7,.48,1.33,.7,2.35,g), wheel(.7,.48,-1.33,.7,2.35,g) ];
  return { wheels:w, steer:[{w:w[2],k:1},{w:w[3],k:1}], hitch };
}

// ---------- engins ----------
function build(kind){
  JELLY = true;
  const g = new THREE.Group();
  let d;
  if (kind === 'prep'){
    const t = tractorBase(g, C.green), spin = [];
    const tool = new THREE.Group(); tool.position.set(0,0,-1.6); t.hitch.add(tool);   // flèche longue
    rbox(.22,.22,1.7, C.orange, 0,.95,-.6, t.hitch, .06);   // timon jusqu'à la boule
    rbox(.3,.3,1.4, C.dark, 0,1.05,.7, tool, .08);
    rbox(4.4,.28,.28, C.orange, 0,1,-.1, tool, .1);
    rbox(4.4,.28,.28, C.orange, 0,1,-1, tool, .1);
    for(let i=0;i<7;i++){
      const x = -1.8+i*.6;
      spin.push(disc(.42,x,.45,-.1,.32,tool));
      spin.push(disc(.42,x+.3,.45,-1,-.32,tool));
    }
    const cage = new THREE.Group(); cage.position.set(0,.4,-1.9); tool.add(cage);
    const cg = new THREE.CylinderGeometry(.4,.4,4.4,10); cg.rotateZ(Math.PI/2);
    cage.add(new THREE.Mesh(cg, mat(C.steel)));
    for(let i=0;i<8;i++){
      const a = i/8*6.28318;
      rbox(4.4,.09,.09, C.dark, 0,Math.sin(a)*.44,Math.cos(a)*.44, cage, .03);
    }
    cage.userData.spin = cage; cage.userData.r = .44; spin.push(cage);
    const mk = new THREE.Object3D(); mk.position.set(0,0,-2.1); tool.add(mk);   // le rouleau packer
    d = { wheels:t.wheels, steer:t.steer, spinners:spin, hitch:t.hitch,
          tool:{ obj:mk, W:4.5, near:-.5, far:.15 } };
  }
  else if (kind === 'sow'){
    const t = tractorBase(g, C.green), spin = [];
    const h = new THREE.Group(); h.position.set(0,0,-.9); t.hitch.add(h);   // flèche longue   // -1.9 - (-2.15)
    rbox(.22,.22,2.4, C.dark, 0,.85,.95, h, .07);
    rbox(2.6,1.5,2.4, C.cream, 0,2,-1.6, h, .22);
    rbox(2.7,.3,2.5, C.orange, 0,2.85,-1.6, h, .1);
    rbox(2.9,.3,.3, C.orange, 0,.95,-2.9, h, .1);
    for(let i=0;i<8;i++){
      const x = -1.25+i*.36;
      rbox(.1,1.1,.1, C.metal, x,1.5,-2.9, h, .04);
      spin.push(disc(.3,x,.32,-3.2,.18,h,C.metal));
    }
    const w = [ wheel(.58,.4,1.66,.58,-1.6,h), wheel(.58,.4,-1.66,.58,-1.6,h) ];
    const mk = new THREE.Object3D(); mk.position.set(0,0,-3.45); h.add(mk);    // ligne des socs
    d = { wheels:t.wheels.concat(w), steer:t.steer, spinners:spin, hitch:t.hitch,
          tool:{ obj:mk, W:3.0, near:-.45, far:.3 } };
  }
  else if (kind === 'fert'){
    rbox(2.4,1.2,4.4, C.blue, 0,2.5,-.2, g, .22);
    rbox(2.5,.4,4.5, C.blueDark, 0,1.9,-.2, g, .14);
    rbox(2.48,.24,3.4, C.blueDark, 0,2.9,-.4, g, .05);
    rbox(1.9,1.2,1.6, C.blue, 0,3.65,1.4, g, .16);
    glazing(1.9,.9,1.62, C.blue, 0,3.76,1.4, g);
    door(1.2,1.6, C.blueDark, .95,3.68,1.4, g, 1); door(1.2,1.6, C.blueDark, -.95,3.68,1.4, g, -1);
    rbox(2.12,.16,1.8, C.dark, 0,4.3,1.4, g, .06);
    beacon(-.7,4.44,1.4,g); tail(2.3,2.35,-2.42,g);
    rbox(2.36,.62,.22, C.dark, 0,2.18,1.96, g, .06);      // calandre basse
    for(let i=0;i<7;i++) rbox(.1,.46,.1, C.steel, -.9+i*.3,2.18,2.03, g, .03);
    lamps(2.3,2.22,2.02,g);                               // phares en bas
    cyl(1.15,1.15,3,14, C.cream, 0,3.4,-1.3, g).rotation.z = Math.PI/2;
    [[1.3,1.6],[-1.3,1.6],[1.3,-2],[-1.3,-2]].forEach(([x,z]) => rbox(.34,1.6,.34, C.blueDark, x,1.5,z, g, .1));
    const w = [ wheel(.95,.5,1.56,.95,1.6,g), wheel(.95,.5,-1.56,.95,1.6,g),
                wheel(.95,.5,1.56,.95,-2,g), wheel(.95,.5,-1.56,.95,-2,g) ];
    const arms = [];
    [1,-1].forEach(s => {
      const side = new THREE.Group(); side.position.set(0,3.3,-2.2); side.rotation.y = s>0?0:Math.PI; g.add(side);
      const a1 = new THREE.Group(); a1.position.set(1.05,0,0); side.add(a1);
      rbox(1.9,.16,.16, C.blueDark, .95,0,0, a1, .06);
      const a2 = new THREE.Group(); a2.position.set(1.9,0,0); a1.add(a2);
      rbox(1.6,.14,.14, C.blueDark, .8,0,0, a2, .05);
      const a3 = new THREE.Group(); a3.position.set(1.6,0,0); a2.add(a3);
      rbox(1.3,.12,.12, C.blueDark, .65,0,0, a3, .05);
      [[a1,1.9],[a2,1.6],[a3,1.3]].forEach(([a,L]) => {
        for(let i=0;i<Math.round(L/.42);i++) cyl(.03,.07,.16,5, C.gold, .2+i*.42,-.16,0, a);
      });
      arms.push({a1,a2,a3});
    });
    // la rampe est l'outil du pulvérisateur : sans cette déclaration, applyTool ne trouvait
    // aucune zone de travail et l'étape engrais ne fertilisait rien
    const mkF = new THREE.Object3D(); mkF.position.set(0,0,-2.4); g.add(mkF);
    d = { wheels:w, steer:[{w:w[2],k:-1},{w:w[3],k:-1}], spinners:[],
          tool:{ obj:mkF, W:8.6, near:-.55, far:.55 },
          fold:f => arms.forEach(({a1,a2,a3}) => { a1.rotation.z=(1-f)*1.48; a2.rotation.z=-(1-f)*2.85; a3.rotation.z=(1-f)*2.85; }) };
    d.fold(1);
  }
  else if (kind === 'harvest'){
    rbox(2.8,1.5,4.4, C.red, 0,1.7,-.2, g, .18);
    rbox(2.9,.5,4.5, C.redDark, 0,1,-.2, g, .14);
    rbox(2.88,.26,3.4, C.redDark, 0,2.15,-.4, g, .05);
    rbox(2.6,1.1,2, C.red, 0,2.9,-1.2, g, .16);
    const fw = new THREE.Group(); fw.position.set(0,2.36,-1.2); g.add(fw);
    const fg = new THREE.BoxGeometry(2.2,1.05,1.6); fg.translate(0,.52,0);
    fw.add(new THREE.Mesh(fg, mat(C.gold))); fw.scale.y = .02;
    rbox(1.9,1.25,1.7, C.red, 0,3.05,.9, g, .16);
    glazing(1.9,.94,1.72, C.red, 0,3.18,.9, g);
    door(1.25,1.7, C.redDark, .95,3.08,.9, g, 1); door(1.25,1.7, C.redDark, -.95,3.08,.9, g, -1);
    rbox(2.14,.16,1.9, C.dark, 0,3.72,.9, g, .06);
    beacon(-.72,3.86,.9,g); tail(2.5,1.65,-2.45,g);
    rbox(2.1,.2,.36, C.dark, 0,3.92,1.42, g, .06);          // barre d'éclairage sur le toit
    for(let i=0;i<5;i++) rbox(.3,.2,.12, C.lamp, -.8+i*.4,3.92,1.6, g, .04);
    lamps(2.2,3.5,1.78,g);
    // vis de déchargement : rangée le long du corps pendant la coupe, déployée à trémie pleine
    const augPiv = new THREE.Group(); augPiv.position.set(.6,3.62,.2); augPiv.rotation.y = AUG_FOLD; g.add(augPiv);
    cyl(.26,.26,3.8,8, C.metal, 1.9,0,0, augPiv).rotation.z = Math.PI/2;
    rbox(.34,.5,.34, C.steel, .35,-.28,0, augPiv, .06);
    rbox(.62,.58,.62, C.metal, 3.85,-.28,0, augPiv, .12);                    // la goulotte
    const spout = new THREE.Object3D(); spout.position.set(3.85,-.66,0); augPiv.add(spout);
    rbox(6,.7,1.3, C.metal, 0,1,3.1, g, .14);
    rbox(6,.34,.5, C.dark, 0,.6,3.6, g, .08);
    const r = reel(5.7,.72,5, 0,1.8,3.4, g, C.gold);
    const mkH = new THREE.Object3D(); mkH.position.set(0,0,3.45); g.add(mkH);   // barre de coupe / rabatteur
    const w = [ wheel(1.12,.68,1.86,1.12,1.1,g), wheel(1.12,.68,-1.86,1.12,1.1,g),
                wheel(.62,.42,1.73,.62,-2.1,g), wheel(.62,.42,-1.73,.62,-2.1,g) ];
    d = { wheels:w, steer:[{w:w[2],k:-1},{w:w[3],k:-1}], spinners:[{spin:r,rate:1.1}],
          fill:fw, auger:augPiv, spout:spout, tool:{ obj:mkH, W:6.0, near:-.35, far:.4 } };
  }
  else {                                          // benne de transfert
    const t = tractorBase(g, C.blue);
    const h = new THREE.Group(); h.position.set(0,0,-.9); t.hitch.add(h);   // flèche longue
    rbox(.22,.22,2.4, C.dark, 0,.85,.95, h, .07);
    // Caisse ouverte : quatre ridelles et un fond, pas de couvercle. On voit le grain
    // monter dedans pendant tout le transfert, au lieu d'un capot qui s'ouvre et masque.
    const LB = 2.6, HB = 1.42, PB = 4.2, YB = 1.56, EP = .16, ZB = -2.4;
    rbox(LB, .18, PB, C.cream, 0, .97, ZB, h, .08);                           // fond
    rbox(LB, HB, EP, C.cream, 0, YB, ZB-PB/2+EP/2, h, .08);                   // ridelle avant
    rbox(LB, HB, EP, C.cream, 0, YB, ZB+PB/2-EP/2, h, .08);                   // ridelle arrière
    rbox(EP, HB, PB-EP*2, C.cream, -LB/2+EP/2, YB, ZB, h, .08);               // ridelle gauche
    rbox(EP, HB, PB-EP*2, C.cream,  LB/2-EP/2, YB, ZB, h, .08);               // ridelle droite
    const RM = YB+HB/2;                                                       // margelle : quatre
    rbox(LB+.06, .1, EP+.06, C.redDark, 0, RM, ZB-PB/2+EP/2, h, .04);         // barres sur les
    rbox(LB+.06, .1, EP+.06, C.redDark, 0, RM, ZB+PB/2-EP/2, h, .04);         // arêtes hautes,
    rbox(EP+.06, .1, PB+.06, C.redDark, -LB/2+EP/2, RM, ZB, h, .04);          // surtout pas un
    rbox(EP+.06, .1, PB+.06, C.redDark,  LB/2-EP/2, RM, ZB, h, .04);          // bloc plein
    rbox(2.7,.35,4.3, C.redDark, 0,.8,-2.4, h, .14);
    const fw = new THREE.Group(); fw.position.set(0,1.06,-2.4); h.add(fw);
    const fg = new THREE.BoxGeometry(LB-EP*2-.04, 1.3, PB-EP*2-.04); fg.translate(0,.65,0);
    fw.add(new THREE.Mesh(fg, mat(C.gold))); fw.scale.y = .02;
    const w = [ wheel(.7,.5,1.67,.7,-2.6,h), wheel(.7,.5,-1.67,.7,-2.6,h) ];
    d = { wheels:t.wheels.concat(w), steer:t.steer, spinners:[], hitch:t.hitch,
          fill:fw, bin:fw, lid:null, tool:null };
  }
  JELLY = false;
  g.userData = d;
  return g;
}
