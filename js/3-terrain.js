"use strict";
// ---------- outils de dessin des motifs de sol ----------
// Tirage reproductible : le motif posé au sol est exactement celui validé au nuancier.
const TS = 256;
function rng(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function cv(){
  const c = document.createElement('canvas'); c.width = c.height = TS;
  return [c, c.getContext('2d')];
}
// Tout se répète sur les bords : le motif se raccorde sans couture d'une tuile à l'autre.
function wrapDraw(x, px, py, r, fn, N){
  N = N || TS;
  for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){
    const ax = px + dx*N, ay = py + dy*N;
    if (ax < -r || ax > N+r || ay < -r || ay > N+r) continue;
    fn(ax, ay);
  }
}
function blob(x,px,py,r,col){
  x.fillStyle = col;
  wrapDraw(x,px,py,r,(ax,ay)=>{ x.beginPath(); x.arc(ax,ay,r,0,6.3); x.fill(); });
}
function glow(x,px,py,r,c0,c1){
  wrapDraw(x,px,py,r,(ax,ay)=>{
    const g = x.createRadialGradient(ax,ay,0,ax,ay,r);
    g.addColorStop(0,c0); g.addColorStop(1,c1);
    x.fillStyle = g; x.beginPath(); x.arc(ax,ay,r,0,6.3); x.fill();
  });
}
// sillon ondulé, périodique sur la hauteur pour se raccorder
function furrow(x, px, col, w, amp, k, ph){
  x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round';
  for(const dx of [-TS,0,TS]){
    x.beginPath();
    for(let y=0;y<=TS;y+=6){
      const o = Math.sin(y/TS*6.28318*k + ph)*amp + Math.sin(y/TS*6.28318*k*2.4 + ph*1.7)*amp*.35;
      x.lineTo(px + dx + o, y);
    }
    x.stroke();
  }
}
function speck(x, R, n, cols, rmin, rmax){
  for(let i=0;i<n;i++)
    blob(x, R()*TS, R()*TS, rmin + R()*(rmax-rmin), cols[(R()*cols.length)|0]);
}
// brin couché : retracé aux neuf décalages pour ne pas être coupé au bord
function straw(x, R, px, py, a, L, w, col){
  x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round';
  for(const dx of [-TS,0,TS]) for(const dy of [-TS,0,TS]){
    x.beginPath(); x.moveTo(px+dx,py+dy);
    x.lineTo(px+dx+Math.cos(a)*L, py+dy+Math.sin(a)*L); x.stroke();
  }
}

// ---------- terrain ----------
// petit relief de terrain : le sol n'est plus un plan parfait
function groundH(x,z){
  return (Math.sin(x*.68 + z*.31)*.5 + Math.sin(x*.23 - z*.59)*.34
        + Math.sin((x+z)*1.11)*.16) * .055;
}
const P = 44, NS = 256, CS = P/NS;                 // cellules de 17 cm : le passage a un bord net
// La ferme n'est plus au centre du monde : elle est posée sur la carte, au corps de ferme
// dont le hangar sert de point de départ. Ce corps de ferme occupe une clairière, et une
// route le longe au sud. La parcelle de travail et la cour se posent donc de l'autre côté
// de cette route, sur la grande étendue d'herbe libre : à huit mètres de tout chemin, de
// tout champ de la carte et de tout arbre. L'emplacement a été cherché à la mesure, pas à
// l'estime — voir essais/calage.js et essais/plan.js.
const HANGAR = { x:-108.41, z:-69.07 };
const X0 = -102, Z0 = -16;                          // la parcelle de travail
const COUR = { x0:-103, x1:-57, z0:-38, z1:-20 };   // la cour, entre la route et la parcelle
const cell = new Uint8Array(NS*NS);           // état du sol : logique seule, plus aucun rendu par texture
function cellIndex(x,z){
  const ix = Math.floor((x-X0)/CS), jz = Math.floor((z-Z0)/CS);
  if (ix<0||jz<0||ix>=NS||jz>=NS) return -1;
  return jz*NS+ix;
}
// 0 friche · 1 labouré · 2 semé · 3 fertilisé · 4 moissonné. La friche et le chaume
// partageaient le même code : on ne pouvait pas les dessiner différemment.
const cellN = [NS*NS, 0, 0, 0, 0];            // combien de cellules dans chaque état
function setCell(i,s2){
  if (i<0 || cell[i]===s2) return false;
  cellN[cell[i]]--; cellN[s2]++; cell[i] = s2; return true;
}
function fillCells(s2){ cell.fill(s2); for(let k=0;k<5;k++) cellN[k] = k===s2 ? NS*NS : 0; }

// ---------- l'herbe ----------
// Le revêtement du prototype, à son échelle : une tuile de quatre mètres à cent vingt-huit
// pixels le mètre. Bandes de tonte, taches de densité, brins courbés de vingt à trente-cinq
// centimètres et quelques fleurs — le tout dans une seule image. Le sol ondule doucement
// par-dessous, et de vraies touffes en volume viennent s'y poser.
const HERBE_M = 4;                                     // mètres couverts par une tuile
function herbeTex(){
  const px = 512;
  const c = document.createElement('canvas'); c.width = c.height = px;
  const x = c.getContext('2d');
  x.fillStyle = '#5cb033'; x.fillRect(0,0,px,px);
  x.fillStyle = '#68be3a';
  for(let i=0;i<px;i+=px/4.6) x.fillRect(i,0,px/9.2,px);           // bandes de tonte
  for(let i=0;i<90;i++){                                          // variations de densité
    const a = Math.random()*px, b = Math.random()*px, r = px*(.02+Math.random()*.06);
    const g = x.createRadialGradient(a,b,0,a,b,r);
    g.addColorStop(0, Math.random()>.5 ? 'rgba(112,196,64,.30)' : 'rgba(58,120,32,.26)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(a,b,r,0,6.3); x.fill();
  }
  x.lineCap = 'round';
  for(let i=0;i<1500;i++){                                        // brins, 20 à 35 cm au sol
    const a = Math.random()*px, b = Math.random()*px;
    x.strokeStyle = Math.random()>.5 ? 'rgba(146,222,90,.6)' : 'rgba(52,112,28,.42)';
    x.lineWidth = px/150;
    x.beginPath(); x.moveTo(a,b);
    x.quadraticCurveTo(a+(Math.random()-.5)*px/34, b-px/38,
                       a+(Math.random()-.5)*px/22, b-px/22-Math.random()*px/22);
    x.stroke();
  }
  for(let i=0;i<125;i++){                                         // fleurs
    x.fillStyle = ['#f3f0c8','#f5e58a','#ffffff'][(Math.random()*3)|0];
    x.beginPath(); x.arc(Math.random()*px, Math.random()*px, px/160, 0, 6.3); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (renderer.capabilities) t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
// creux et bosses très doux. On les efface sous la parcelle et sous la cour : leurs bords
// sont posés à plat, une bosse dessous les ferait percer.
const dRect = (x,z,x0,x1,z0,z1) =>
  Math.hypot(Math.max(x0-x, 0, x-x1), Math.max(z0-z, 0, z-z1));
function herbeY(x, z){
  const d = Math.min(dRect(x,z, X0-3, X0+P+3, Z0-3, Z0+P+3),
                     dRect(x,z, COUR.x0-3, COUR.x1+3, COUR.z0-3, COUR.z1+3));
  const k = Math.min(1, d/11);
  // La campagne est plate, et il le faut : ses champs et ses routes sont des surfaces
  // posées à quatre ou sept centimètres du sol, quand l'ondulation du pré en fait
  // quatorze. Elle les traversait donc par plaques vertes, au milieu des parcelles comme
  // en travers des chemins. Le relief ne reprend qu'au-delà de la ceinture, là où plus
  // rien n'est posé — voir js/3c-carte.js.
  const dm = Math.max(Math.abs(x), Math.abs(z));
  const kc = Math.min(1, Math.max(0, (dm - 282)/26));
  return (Math.sin(x*.13+z*.09)*.5 + Math.sin(x*.31-z*.24)*.28) * .14 * k * kc;
}
(function ground(){
  // Le pré porte maintenant toute la campagne, pas seulement l'aire de jeu : la carte fait
  // 540 m de côté et il faut de l'herbe au-delà de ses routes de ceinture.
  const SOL = 1120;
  const t = herbeTex();
  t.repeat.set(SOL/HERBE_M, SOL/HERBE_M);
  t.center.set(.5,.5); t.rotation = Math.PI/4.2;
  const geo = new THREE.PlaneGeometry(SOL,SOL,168,168);
  const pos = geo.attributes.position;
  for(let i=0;i<pos.count;i++) pos.setZ(i, herbeY(pos.getX(i), -pos.getY(i)));
  pos.needsUpdate = true; geo.computeVertexNormals();
  const g = new THREE.Mesh(geo, gouache(new THREE.MeshLambertMaterial({map:t}), .4, true));
  g.rotation.x = -Math.PI/2; g.receiveShadow = true; g.renderOrder = -13; scene.add(g);
})();
// Les touffes : des paquets de brins en volume, posés autour de l'aire de jeu seulement —
// couvrir quatre cents mètres de côté à cette densité coûterait trois cent mille objets.
(function touffes(){
  const R = 64, PAS = 1.05;
  const geo = new THREE.ConeGeometry(.028,.30,3); geo.translate(0,.15,0);
  const cols = ['#7cc94a','#8fd457','#a3c05c'];         // deux verts clairs et un ton sec
  const lots = cols.map(() => []);
  for(let x=X0+P/2-R; x<X0+P/2+R; x+=PAS) for(let z=Z0+P/2-R; z<Z0+P/2+R; z+=PAS){
    const px = x + (Math.random()-.5)*PAS*.9, pz = z + (Math.random()-.5)*PAS*.9;
    // Seulement le long des bords. Une touffe de trente centimètres ne se voit qu'à contre-jour
    // du sol nu ou de la cour ; en pleine prairie, à quarante mètres de haut, elle disparaît
    // dans la texture — et couvrir tout le pourtour coûterait quarante mille objets pour rien.
    const d = Math.min(dRect(px,pz, X0, X0+P, Z0, Z0+P),
                       dRect(px,pz, COUR.x0+2, COUR.x1-2, COUR.z0+2, COUR.z1-2));
    if (d < 1.1 || d > 13) continue;
    // par paquets : une touffe, c'est cinq ou six brins serrés, pas un brin isolé
    const n = 3 + (Math.random()*3|0), k = (Math.random()*cols.length)|0;
    for(let b=0;b<n;b++){
      const a = Math.random()*6.283, r = Math.random()*(.14+Math.random()*.2);
      lots[Math.random() < .78 ? k : (Math.random()*cols.length)|0]
        .push(px+Math.cos(a)*r, pz+Math.sin(a)*r);
    }
  }
  const d = new THREE.Object3D();
  cols.forEach((col,k) => {
    const L = lots[k], n = L.length/2;
    const im = new THREE.InstancedMesh(geo,
      gouache(new THREE.MeshLambertMaterial({ color:col }), .3, true), Math.max(1,n));
    im.castShadow = false; im.receiveShadow = false;
    for(let q=0;q<n;q++){
      const x = L[q*2], z = L[q*2+1];
      d.position.set(x, herbeY(x,z), z);
      d.rotation.set((Math.random()-.5)*.7, Math.random()*3, (Math.random()-.5)*.7);
      const sc = .52 + Math.random()*.85;               // 16 à 41 cm : ras
      d.scale.set(sc*.85, sc, sc*.85); d.updateMatrix();
      im.setMatrixAt(q, d.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false; scene.add(im);
  });
})();

// ---------- la parcelle : un bloc de terre en surépaisseur, ni plat ni rectiligne ----------
// Le sol du champ domine l'herbe d'une vingtaine de centimètres : les engins y montent
// pour de vrai. Le bord n'est pas une arête droite mais une découpe crantée, et le dessus
// ondule sur deux échelles avec des mottes posées dessus.
const LIP = .22;                                       // surépaisseur de la terre
function soilBump(x,z){                                // le relief propre à la parcelle
  return Math.sin(x*.41 + z*.23)*.055
       + Math.sin(x*.19 - z*.47)*.042
       + Math.sin((x+z)*.83)*.024
       + Math.sin(x*1.63)*Math.sin(z*1.49)*.032
       + Math.sin(x*2.71 + z*1.9)*.017 + Math.sin(z*2.53 - x*1.7)*.015;
}
// Le bord se dessine par harmoniques, de la grande ondulation au petit accident.
// Un terme en marche d'escalier donnait des crans énormes et anguleux : ici tout est continu,
// et c'est la finesse du maillage qui décide du détail visible.
function edgeWob(t, seed){                             // écart du bord, en mètres
  return Math.sin(t*.29 + seed)*.30
       + Math.sin(t*.73 - seed*1.7)*.17
       + Math.sin(t*1.61 + seed*2.1)*.085
       + Math.sin(t*3.37 - seed*.9)*.042
       + Math.sin(t*6.9  + seed*3.1)*.018;
}
// Le maillage épouse le bord au lieu de jeter les cellules qui dépassent : on déforme
// le carré paramétrique près de ses côtés, donc plus aucune marche d'escalier.
const EW = .09;                                        // part du côté touchée par la déformation
const smooth3 = k => k*k*(3-2*k);
function parcelPoint(u,v){
  const bx = X0 + u*P, bz = Z0 + v*P;
  const fl = Math.max(0, 1 - u/EW),     fr = Math.max(0, 1 - (1-u)/EW);
  const fb = Math.max(0, 1 - v/EW),     ft = Math.max(0, 1 - (1-v)/EW);
  return [ bx - smooth3(fl)*edgeWob(bz, 0.7) + smooth3(fr)*edgeWob(bz, 2.9),
           bz - smooth3(fb)*edgeWob(bx, 4.1) + smooth3(ft)*edgeWob(bx, 5.7) ];
}
// distance signée au bord découpé : > 0 dedans
function parcelInset(x,z){
  const l = x - (X0        - edgeWob(z, 0.7));
  const r = (X0 + P + edgeWob(z, 2.9)) - x;
  const b = z - (Z0        - edgeWob(x, 4.1));
  const t = (Z0 + P + edgeWob(x, 5.7)) - z;
  return Math.min(l, r, b, t);
}
// hauteur du dessus de la terre : 0 sur l'herbe, la rampe de bord fait monter l'engin
function parcelY(x,z){
  const d = parcelInset(x,z);
  if (d <= 0) return 0;
  const k = Math.min(1, d/1.15), sm = k*k*(3-2*k);
  return (LIP + soilBump(x,z)) * sm;
}
// « Chaume clair » : le seul et même dessin pour le sol de départ et pour ce que la
// moissonneuse laisse derrière elle. Les deux doivent se superposer sans se distinguer,
// donc une seule recette, une seule graine, et la même échelle au sol.
// Chaque brin portait son ombre : à trois cents brins cela faisait autant de mouchetures
// sombres et le champ paraissait sali. Le relief se rend maintenant par quatre tons de
// paille, du plus clair au plus mat, sans aucun trait sombre.
// Pas de bandes de rouleau non plus : sur une surface aussi large leur couture se lisait
// d'un bout à l'autre du champ.
const CUT_TONS = ['#f6e59d', '#e6d089', '#cdb271', '#b39c64'];
function drawCut(x, R){
  x.fillStyle='#ab9862'; x.fillRect(0,0,TS,TS);
  speck(x,R,110,['rgba(214,199,150,.34)','rgba(186,170,118,.3)'],2.5,7);
  for(let i=0;i<260;i++){
    const px=R()*TS, py=R()*TS, a=R()*6.28, L=10+R()*20, w=3.6+R()*3;
    straw(x,R,px,py,a,L,w,CUT_TONS[(R()*CUT_TONS.length)|0]);
  }
}
// La friche : le champ tel qu'on l'achète, jamais retourné. C'est le sol de fond de la
// parcelle, celui qu'on voit au tout premier lancement. Terre grise et sèche, mottes
// tassées jetées sans ordre, repousses courtes en tous sens — rien n'y est aligné, et
// c'est justement ce qui la distingue du chaume que laisse la moissonneuse, lui peigné
// en rangs. Tout ce qui vient après — labour, semis, engrais, chaume — se pose par-dessus.
const FRICHE_TONS = ['#9c9558', '#7f8a44', '#8d8a4e'];
function drawFriche(x, R){
  x.fillStyle = '#8b7c52'; x.fillRect(0,0,TS,TS);
  for(let i=0;i<170;i++){                        // mottes tassées, deux gris de terre
    const px=R()*TS, py=R()*TS, r=5.5+R()*13;    // 6 à 21 cm au sol, sur une tuile de 2,9 m
    blob(x,px+r*.3,py+r*.32,r,'rgba(52,44,24,.34)');
    blob(x,px,py,r*.88, R()>.5 ? '#94855c' : '#7a6a45');
    blob(x,px-r*.28,py-r*.3,r*.32,'rgba(214,203,166,.26)');
  }
  speck(x,R,130,['rgba(64,56,32,.32)','rgba(168,158,110,.3)'],2.4,7);
  for(let i=0;i<220;i++){                        // repousses sèches, courtes, désordonnées
    const px=R()*TS, py=R()*TS, a=R()*6.28, L=10+R()*16, w=2.6+R()*2.2;
    straw(x,R,px,py,a,L,w,FRICHE_TONS[(R()*FRICHE_TONS.length)|0]);
  }
}
function soilTex(){
  const [c,x] = cv();
  drawFriche(x, rng(714203));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
(function parcelle(){
  const N = 220, W = N+1;                              // ~20 cm le long du bord : le contour lisse à l'œil
  const pos = [], uvs = [], col = [], tri = [];
  const px = new Float32Array(W*W), pz = new Float32Array(W*W), idx = new Int32Array(W*W);
  const push = (x,y,z,shade) => {
    pos.push(x,y,z); uvs.push((x-X0)/2.9, (z-Z0)/2.9); col.push(shade,shade,shade);
    return pos.length/3 - 1;
  };
  for(let j=0;j<=N;j++) for(let i=0;i<=N;i++){
    const k = j*W+i, p = parcelPoint(i/N, j/N), y = parcelY(p[0], p[1]);
    px[k] = p[0]; pz[k] = p[1];
    // creux à peine plus sombres, bosses à peine plus claires : le relief se devine
    // sans peindre de grandes taches brunes sur le chaume
    idx[k] = push(p[0], y, p[1], .95 + (y - LIP)*.8);
  }
  for(let j=0;j<N;j++) for(let i=0;i<N;i++){
    const a = j*W+i, b = a+1, c = a+W, d = c+1;
    tri.push(idx[a], idx[c], idx[b], idx[b], idx[c], idx[d]);
  }
  // jupe : les quatre bords descendent sous l'herbe, c'est ce qui donne l'épaisseur
  // La tranche est presque verticale : elle ne reçoit quasiment pas de lumière et se
  // dessinait en liseré noir tout autour du champ. On l'éclaircit franchement et on la
  // raccourcit, pour qu'elle ne soit qu'un bord de terre, pas un contour d'encre.
  const skirt = (k1,k2) => {
    const t1 = push(px[k1], parcelY(px[k1],pz[k1]), pz[k1], 1.02);
    const t2 = push(px[k2], parcelY(px[k2],pz[k2]), pz[k2], 1.02);
    const b1 = push(px[k1], -.035, pz[k1], .86);
    const b2 = push(px[k2], -.035, pz[k2], .86);
    tri.push(t1,b1,t2, t2,b1,b2);
  };
  for(let i=0;i<N;i++){
    skirt(i+1, i);                                     // v = 0
    skirt(N*W+i, N*W+i+1);                             // v = 1
    skirt(i*W, (i+1)*W);                               // u = 0
    skirt((i+1)*W+N, i*W+N);                           // u = 1
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,2));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(col,3));
  geo.setIndex(tri);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    map:soilTex(), vertexColors:true, side:THREE.DoubleSide }));
  gouache(m.material, .42, true);
  m.receiveShadow = true; m.renderOrder = -11; scene.add(m);
})();
// mottes : de petits volumes posés sur la terre, plus denses près des bords
function semerMottes(){
  const clods = [], cg = new THREE.SphereGeometry(1, 6, 4);
  for(let i=0;i<260;i++){
    const x = X0 + Math.random()*P, z = Z0 + Math.random()*P;
    const d = parcelInset(x,z);
    if (d <= .25) continue;
    if (d > 2.4 && Math.random() > .3) continue;
    const r = .10 + Math.random()*.19;
    const m = MX(x, parcelY(x,z) + r*.28, z, 0, Math.random()*3, 0, 1);
    m.scale(new THREE.Vector3(r*1.5, r*.6, r*1.25));
    clods.push({ g:cg, c: Math.random()>.5 ? '#8f7c4c' : '#6f5f38', m });
  }
  if (!clods.length) return;
  const cm = new THREE.Mesh(merge(clods), new THREE.MeshLambertMaterial({ vertexColors:true }));
  cm.castShadow = true; cm.receiveShadow = true; scene.add(cm);
}

// ---------- traînées de passage : un ruban continu, pas des rectangles bout à bout ----------
// (des quads successifs faisaient un bord en dents de scie dans les courbes : ici les sommets
//  sont partagés d'un échantillon au suivant, le bord est une polyligne lisse)
// Le ruban de travail était rogné sur un rectangle droit : au bout de chaque passage il
// s'arrêtait donc net, alors que la terre, elle, ondule. On le laisse déborder et c'est le
// contour réel qui le découpe, au pixel près, dans le fragment shader.
function clipToParcel(m){
  const L = X0.toFixed(3), Rr = (X0+P).toFixed(3), B = Z0.toFixed(3), T = (Z0+P).toFixed(3);
  gouache(m, .42, true);
  chainCompile(m, sh => {
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace(
      '#include <fog_vertex>',
      '#include <fog_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = ('varying vec3 vWP;\n' +
      'float ewob(float t, float sd){\n' +
      '  return sin(t*.29 + sd)*.30 + sin(t*.73 - sd*1.7)*.17 + sin(t*1.61 + sd*2.1)*.085\n' +
      '       + sin(t*3.37 - sd*.9)*.042 + sin(t*6.9 + sd*3.1)*.018;\n}\n' +
      sh.fragmentShader).replace(
      '#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\n' +
      '  float _l = vWP.x - (' + L + ' - ewob(vWP.z, 0.7));\n' +
      '  float _r = (' + Rr + ' + ewob(vWP.z, 2.9)) - vWP.x;\n' +
      '  float _b = vWP.z - (' + B + ' - ewob(vWP.x, 4.1));\n' +
      '  float _t = (' + T + ' + ewob(vWP.x, 5.7)) - vWP.z;\n' +
      '  if (min(min(_l,_r), min(_b,_t)) <= 0.0) discard;');
  });
  return m;
}

// Les points de semence s'effacent avec la maturité : l'uniforme est partagé par le ruban,
// qui les mélange lui-même à la terre labourée.
const GRAIN = { value: 1 };

// Un seul ruban pour tous les passages. Chaque échantillon porte l'état qu'il dépose, et
// tout se dessine dans l'ordre où c'est arrivé : le dernier outil passé recouvre les
// précédents. C'est ce qu'il fallait pour que le déchaumage prévale sur tout — labourer un
// champ déjà semé, mouillé ou couvert d'épis le remet à la terre nue, sous les yeux.
// Une couche par état, dessinée chacune dans son coin, ne pouvait pas faire ça : leur ordre
// était figé, la terre nue passait toujours SOUS le semis.
//
// Il n'y a plus que deux dessins de terre. Le semis, c'est la terre labourée avec des points
// de semence par-dessus ; l'engrais, c'est la même terre en plus sombre, comme mouillée. Les
// deux se font dans le shader, il n'y a donc rien à redessiner.
const SWATH = (function(){
  function finish(c){
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (renderer.capabilities) t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  // La terre travaillée : des mottes jetées au hasard, de toutes les tailles, sans une seule
  // ligne ni une seule bande — c'est l'alignement qui faisait le quadrillage.
  function texLabour(){
    const [c,x] = cv(), R = rng(601844);
    x.fillStyle = '#755934'; x.fillRect(0,0,TS,TS);
    for(let i=0;i<210;i++){                       // grosses mottes, avec leur ombre portée
      const px=R()*TS, py=R()*TS, r=3.4+R()*9.6;
      blob(x,px+r*.32,py+r*.34,r,'rgba(46,32,16,.44)');
      blob(x,px,py,r*.86, R()>.5 ? '#a3814e' : '#8d6f42');
      blob(x,px-r*.26,py-r*.3,r*.34,'rgba(228,208,164,.34)');
    }
    speck(x,R,150,['rgba(58,42,23,.4)','rgba(176,148,96,.34)'],2.2,6.6);
    return finish(c);
  }
  // Les points de semence, seuls, sur fond transparent : semés au hasard comme la paille.
  // Ce qui tombe au sol doit valoir ce qui sort du semoir — il en pleut beaucoup, la terre
  // doit en être criblée. Quatre fois plus de grains qu'avant, et un peu plus petits pour
  // que ça reste une pluie de points et pas une nappe blanche : la terre passe encore entre.
  function texGrains(){
    const [c,x] = cv(), R = rng(884411);
    for(let i=0;i<620;i++){
      const gx=R()*TS, gy=R()*TS, r=2.9+R()*2.7;
      blob(x,gx+.9,gy+1.0,r,'rgba(74,54,26,.22)');
      blob(x,gx,gy,r,'#f6ecd2');
      blob(x,gx-r*.3,gy-r*.32,r*.46,'#fffaf0');
    }
    return finish(c);
  }
  function texChaume(){ const [c,x] = cv(); drawCut(x, rng(1028679)); return finish(c); }

  const LAB = texLabour(), CHAUME = texChaume(), GRAINS = texGrains();
  const MAXS = 20000, TILE = 2.9;         // 1 motif = 2,9 m au sol, échelle constante
  const pos = new Float32Array(MAXS*6), nor = new Float32Array(MAXS*6);
  const uv  = new Float32Array(MAXS*4), lay = new Float32Array(MAXS*2);
  for(let k=0;k<MAXS*2;k++){ nor[k*3]=0; nor[k*3+1]=1; nor[k*3+2]=0; }
  const idx = new Uint32Array((MAXS-1)*6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal',   new THREE.BufferAttribute(nor,3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(uv,2).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aEtat',    new THREE.BufferAttribute(lay,1).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(new THREE.BufferAttribute(idx,1));
  geo.setDrawRange(0,0);

  const mat = new THREE.MeshLambertMaterial({ map:LAB, side:THREE.DoubleSide,
                                              depthTest:false, depthWrite:false });
  chainCompile(mat, sh => {
    sh.uniforms.uChaume = { value: CHAUME };
    sh.uniforms.uGrains = { value: GRAINS };
    sh.uniforms.uGrain  = GRAIN;
    sh.vertexShader = 'attribute float aEtat;\nvarying float vEtat;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vEtat = aEtat;');
    sh.fragmentShader = 'uniform sampler2D uChaume;\nuniform sampler2D uGrains;\n' +
      'uniform float uGrain;\nvarying float vEtat;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
       {
         float chaume = step(2.5, vEtat);                       // 3 = moissonné
         vec4 ch = texture2D(uChaume, vUv);
         diffuseColor = mix(diffuseColor, ch, chaume);
         float mouille = step(1.5, vEtat) * (1.0 - chaume);     // 2 = fertilisé
         diffuseColor.rgb *= mix(vec3(1.0), vec3(0.56, 0.51, 0.45), mouille);
         float pose = step(0.5, vEtat) * (1.0 - chaume);        // 1 et 2 portent la semence
         vec4 gr = texture2D(uGrains, vUv);
         diffuseColor.rgb = mix(diffuseColor.rgb,
                                gr.rgb * mix(1.0, 0.62, mouille),
                                gr.a * uGrain * pose);
       }`);
  }, 'ruban');
  clipToParcel(mat);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = .004; m.frustumCulled = false; m.receiveShadow = true;
  m.renderOrder = -10;                    // juste après le sol, avant tout le reste
  scene.add(m);

  let n = 0, tri = 0, fil = null;
  return {
    // `chaine` : à qui appartient le point. Deux engins qui travaillent en même temps ne
    // doivent pas voir leurs échantillons cousus l'un à l'autre.
    add(etat, x, z, ang, w, link, chaine){
      if (n >= MAXS) return;
      const suite = link && fil === (chaine === undefined ? etat : chaine + ':' + etat);
      const c = Math.cos(ang), si = Math.sin(ang);
      fil = (chaine === undefined ? etat : chaine + ':' + etat);
      const o = n*6, u = n*4, e = n*2;
      const ax = x + c*w/2, az = z - si*w/2;
      const bx = x - c*w/2, bz = z + si*w/2;
      pos[o]   = ax; pos[o+1] = parcelY(ax,az)*.97 + .015; pos[o+2] = az;   // travaillé = aplani
      pos[o+3] = bx; pos[o+4] = parcelY(bx,bz)*.97 + .015; pos[o+5] = bz;
      // La texture est accrochée au SOL, pas au passage. Elle l'était au passage : chaque
      // aller repartait à zéro dans l'image et la parcourait sur la largeur exacte de
      // l'outil, si bien que tous les passages montraient rigoureusement le même morceau
      // d'image, bord à bord. C'était ça, l'effet carreaux — un damier calé sur les allées.
      // En repère sol, deux passages voisins prolongent le même dessin sans couture, et le
      // ruban tombe pile sur la texture de la parcelle qui compte dans le même repère.
      uv[u]   = (ax-X0)/TILE; uv[u+1] = (az-Z0)/TILE;
      uv[u+2] = (bx-X0)/TILE; uv[u+3] = (bz-Z0)/TILE;
      lay[e] = lay[e+1] = etat;
      if (suite && n > 0){
        const a = (n-1)*2, b = a+1, cc = n*2, d = cc+1, t = tri*6;
        idx[t]=a; idx[t+1]=b; idx[t+2]=cc;
        idx[t+3]=b; idx[t+4]=d; idx[t+5]=cc;
        tri++;
        geo.index.needsUpdate = true;
        geo.setDrawRange(0, tri*6);
      }
      n++;
      geo.attributes.position.needsUpdate = true;
      geo.attributes.uv.needsUpdate = true;
      geo.attributes.aEtat.needsUpdate = true;
    },
    reset(){ n = 0; tri = 0; fil = null; geo.setDrawRange(0,0); },
    pose(){ return n; }                    // combien d'échantillons déposés, pour les essais
  };
})();

// ---------- ferme ----------
// Le silo à cellules de la carte, celui du corps de ferme, reçoit la récolte ; la barrière
// est le point de ralliement, au milieu de la cour, entre le parc et le champ.
const SILO = new THREE.Vector3(-50.5,0,-77.8);
const GATE = new THREE.Vector3((COUR.x0+COUR.x1)/2 + 10, 0, COUR.z1 - 4);
// Les obstacles du décor, relevés en même temps qu'on les pose : de simples disques, qui
// suffisent à des engins vus de dessus. Un bâtiment long en aligne plusieurs.
const OBST = [];
function addObst(x,z,r){ OBST.push({ x, z, r }); }
// La grange rouge et le silo de béton ont disparu : la ferme n'est plus un décor posé
// autour d'une parcelle, c'est un vrai corps de ferme de la carte — hangar, auvent,
// maisons, longère et silos, aux places relevées dans js/3d-mobilier.js.
// Les arbres ne sont plus semés au hasard autour de la parcelle : c'est la campagne
// engendrée qui les pose, dans ses bois et ses prairies. Voir js/3c-carte.js.
