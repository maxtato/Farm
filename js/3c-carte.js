"use strict";
// ---------- la campagne : bocage engendré, sols et herbe du jeu ----------
// Le tracé vient du générateur de cartes : maillage déformé, îlots de tailles
// inégales, routes qui suivent les limites — donc courbes, jamais d’équerre. Tout
// le revêtement, lui, est celui du jeu : la friche de la parcelle et l’herbe des prés,
// pas les textures du prototype. La graine est verrouillée : la carte est la même à
// chaque ouverture.

const A = {
  bois:'#6b4a2c', boisF:'#513622', boisC:'#7d5c38',
  vert1:'#3f8a28', vert2:'#4fa532', vert3:'#347320', vertC:'#67bb42',
  auto:'#c9772a', sec:'#7a6a4e', fruit:'#c9352c', fleur:'#f0e2ea'
};
function tronc(g, h, r0, r1, x, z, incl){
  const t = cyl(r1, r0, h, 6, A.bois, x, h/2, z, g);
  if (incl){ t.rotation.z = incl; t.position.x = x + Math.sin(incl)*h/2*-1; }
  return t;
}
function branche(g, x0,y0,z0, x1,y1,z1, r, col){
  const d = new THREE.Vector3(x1-x0,y1-y0,z1-z0), L = d.length();
  const m = cyl(r*.7, r, L, 5, col||A.bois, (x0+x1)/2,(y0+y1)/2,(z0+z1)/2, g);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), d.normalize());
  return m;
}
function boule(g, r, x, y, z, col, det){
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, det===undefined?0:det),
    new THREE.MeshPhongMaterial({ color:col, flatShading:true, shininess:0,
                                  specular:new THREE.Color(0,0,0) }));
  m.position.set(x,y,z); m.castShadow = m.receiveShadow = true; g.add(m);
  return m;
}
function chene(){
  const g = new THREE.Group();
  tronc(g, 3.2, .42, .28, 0, 0);
  branche(g, 0,2.4,0, 1.1,3.6,.5, .16);
  branche(g, 0,2.4,0, -1,3.4,-.6, .16);
  boule(g, 1.9, 0, 4.4, 0, A.vert1);
  boule(g, 1.4, 1.5, 3.9, .5, A.vert2);
  boule(g, 1.3, -1.4, 3.7, -.6, A.vert3);
  boule(g, 1.1, .3, 5.5, -.7, A.vertC);
  return g;
}
function peuplier(){
  const g = new THREE.Group();
  tronc(g, 8, .34, .16, 0, 0);
  for(let i=0;i<5;i++){
    const y = 2.4 + i*1.5, r = 1.35 - i*.17;
    boule(g, r, (i%2?.12:-.12), y, (i%2?-.1:.1), i%2 ? A.vert1 : A.vert2);
  }
  boule(g, .7, 0, 9.4, 0, A.vertC);
  return g;
}
function sapin(){
  const g = new THREE.Group();
  tronc(g, 1.6, .3, .24, 0, 0);
  for(let i=0;i<4;i++){
    const y = 1.3 + i*1.5, r = 2.1 - i*.42, h = 2.2 - i*.25;
    const c = cyl(0, r, h, 7, i%2 ? A.vert3 : A.vert1, 0, y+h/2, 0, g);
  }
  return g;
}
function pommier(){
  const g = new THREE.Group();
  tronc(g, 1.7, .34, .26, 0, 0);
  branche(g, 0,1.4,0, .9,2.4,.4, .13);
  branche(g, 0,1.4,0, -.85,2.3,-.5, .13);
  const masses = [[1.5,0,3,0,A.vert2],[1.1,1.1,2.6,.4,A.vert1],[1,-1,2.5,-.5,A.vert3]];
  masses.forEach(([r,cx,cy,cz,col]) => boule(g, r, cx, cy, cz, col));
  masses.forEach(([r,cx,cy,cz]) => {                  // pommes posées sur le feuillage
    const n = Math.round(r*9);
    for(let i=0;i<n;i++){
      const u = Math.random()*1.6 - .75, th = Math.random()*6.283;
      const s2 = Math.sqrt(Math.max(0,1-u*u)), d = r*.86;
      boule(g, .13, cx + s2*Math.cos(th)*d, cy + u*d, cz + s2*Math.sin(th)*d, A.fruit);
    }
  });
  return g;
}
function buisson(){
  const g = new THREE.Group();
  for(let i=0;i<7;i++){
    const a = i/7*6.28, R = .7 + Math.random()*.5;
    boule(g, .5+Math.random()*.35, Math.cos(a)*R, .45+Math.random()*.5, Math.sin(a)*R,
          [A.vert1,A.vert2,A.vert3][i%3]);
  }
  tronc(g, .5, .12, .1, 0, 0);
  return g;
}


function surface(pts){
  const f = new THREE.Shape();
  f.moveTo(pts[0][0], -pts[0][1]);
  for(let i=1;i<pts.length;i++) f.lineTo(pts[i][0], -pts[i][1]);
  f.closePath();
  const g = new THREE.ShapeGeometry(f, 10);
  g.rotateX(-Math.PI/2);
  const nb = g.attributes.position.count, nor = new Float32Array(nb*3);
  for(let i=0;i<nb;i++) nor[i*3+1] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nor,3));
  return g;
}
function lisser(pts, n, ferme){
  for(let it=0; it<n; it++){
    const N = pts.length, out = [];
    if (N < 3) return pts;
    if (!ferme) out.push(pts[0]);
    for(let i=0; i<(ferme?N:N-1); i++){
      const a = pts[i], b = pts[(i+1)%N];
      out.push([a[0]*.75+b[0]*.25, a[1]*.75+b[1]*.25]);
      out.push([a[0]*.25+b[0]*.75, a[1]*.25+b[1]*.75]);
    }
    if (!ferme) out.push(pts[N-1]);
    pts = out;
  }
  return pts;
}
function ruban(pts, larg, col, y, ferme){
  const N = pts.length; if (N < 2) return null;
  const pos = new Float32Array(N*6), nor = new Float32Array(N*6);
  for(let i=0;i<N;i++){
    const p = pts[i], a = pts[(i-1+N)%N], b = pts[(i+1)%N];
    let tx, tz;
    if (!ferme && i===0){ tx = pts[1][0]-p[0]; tz = pts[1][1]-p[1]; }
    else if (!ferme && i===N-1){ tx = p[0]-pts[N-2][0]; tz = p[1]-pts[N-2][1]; }
    else { tx = b[0]-a[0]; tz = b[1]-a[1]; }
    const L = Math.hypot(tx,tz) || 1; tx/=L; tz/=L;
    const nx = tz*larg/2, nz = -tx*larg/2;
    pos[i*6]=p[0]+nx; pos[i*6+1]=y; pos[i*6+2]=p[1]+nz;
    pos[i*6+3]=p[0]-nx; pos[i*6+4]=y; pos[i*6+5]=p[1]-nz;
    nor[i*6+1]=1; nor[i*6+4]=1;
  }
  const seg = ferme ? N : N-1, idx = new Uint32Array(seg*6);
  for(let i=0;i<seg;i++){
    const a=i*2,b=a+1,c=((i+1)%N)*2,d=c+1,t=i*6;
    idx[t]=a; idx[t+1]=b; idx[t+2]=c; idx[t+3]=b; idx[t+4]=d; idx[t+5]=c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor,3));
  g.setIndex(new THREE.BufferAttribute(idx,1));
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({color:col, side:THREE.DoubleSide}));
  m.receiveShadow = true; return m;
}
function adoucir(pts, seuilDeg, iter){       // rabote les angles vifs jusqu'à ce qu'il n'en reste plus
  const seuil = Math.cos(seuilDeg*Math.PI/180);
  for(let t=0; t<(iter||8); t++){
    const N = pts.length, out = [];
    let change = false;
    for(let i=0;i<N;i++){
      const p = pts[(i-1+N)%N], q = pts[i], r = pts[(i+1)%N];
      const v1 = [q[0]-p[0], q[1]-p[1]], v2 = [r[0]-q[0], r[1]-q[1]];
      const L1 = Math.hypot(v1[0],v1[1])||1, L2 = Math.hypot(v2[0],v2[1])||1;
      const c = (v1[0]*v2[0] + v1[1]*v2[1])/(L1*L2);
      if (c < seuil){                          // virage trop serré : on coupe le coin
        out.push([ q[0] + (p[0]-q[0])*.35, q[1] + (p[1]-q[1])*.35 ]);
        out.push([ q[0] + (r[0]-q[0])*.35, q[1] + (r[1]-q[1])*.35 ]);
        change = true;
      } else out.push(q);
    }
    pts = out;
    if (!change) break;
  }
  return pts;
}
function simplifier(pts, tol){               // Douglas-Peucker : ramène le contour à ses sommets utiles
  const dist = (p,a,b) => {
    const dx=b[0]-a[0], dz=b[1]-a[1], L2=dx*dx+dz*dz||1;
    let t=((p[0]-a[0])*dx+(p[1]-a[1])*dz)/L2; t=Math.max(0,Math.min(1,t));
    return Math.hypot(p[0]-(a[0]+dx*t), p[1]-(a[1]+dz*t));
  };
  const rec = (P, i, j, garde) => {
    let dmax = 0, idx = -1;
    for(let k=i+1;k<j;k++){ const d = dist(P[k], P[i], P[j]); if (d > dmax){ dmax = d; idx = k; } }
    if (dmax > tol){ rec(P,i,idx,garde); garde.push(idx); rec(P,idx,j,garde); }
  };
  if (pts.length < 4) return pts;
  const garde = [0];
  rec(pts, 0, pts.length-1, garde);
  garde.push(pts.length-1);
  return garde.map(k => pts[k]);
}
function densifierPas(pts, pas){             // un point tous les `pas` mètres, quelle que soit la longueur du côté
  const out = [];
  for(let i=0;i<pts.length;i++){
    const a = pts[i], b = pts[(i+1)%pts.length];
    const L = Math.hypot(b[0]-a[0], b[1]-a[1]);
    const n = Math.max(1, Math.round(L/pas));
    for(let k=0;k<n;k++) out.push([a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n]);
  }
  return out;
}
function densifier(pts, n){                  // points intermédiaires sur chaque côté
  const out = [];
  for(let i=0;i<pts.length;i++){
    const a = pts[i], b = pts[(i+1)%pts.length];
    for(let k=0;k<n;k++) out.push([a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n]);
  }
  return out;
}
function bbox(pts){
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  pts.forEach(p => { x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); z0=Math.min(z0,p[1]); z1=Math.max(z1,p[1]); });
  return { x0,x1,z0,z1, w:x1-x0, d:z1-z0, cx:(x0+x1)/2, cz:(z0+z1)/2 };
}
function aireSignee(pts){
  let A = 0;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++) A += pts[j][0]*pts[i][1] - pts[i][0]*pts[j][1];
  return A/2;
}
function inter(a,b,c,d){                     // intersection de deux segments, ou null
  const r = [b[0]-a[0], b[1]-a[1]], sg = [d[0]-c[0], d[1]-c[1]];
  const den = r[0]*sg[1] - r[1]*sg[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0]-a[0])*sg[1] - (c[1]-a[1])*sg[0]) / den;
  const u = ((c[0]-a[0])*r[1]  - (c[1]-a[1])*r[0])  / den;
  if (t <= .001 || t >= .999 || u <= .001 || u >= .999) return null;
  return [ a[0] + r[0]*t, a[1] + r[1]*t ];
}
function deboucler(pts){                     // supprime les boucles créées par le décalage
  let P = pts.slice(), tour = 0;
  while (tour++ < 40){
    let coupe = null;
    for(let i=0;i<P.length && !coupe;i++){
      for(let j=i+2;j<P.length;j++){
        if (i === 0 && j === P.length-1) continue;
        const x = inter(P[i], P[(i+1)%P.length], P[j], P[(j+1)%P.length]);
        if (x){ coupe = {i, j, x}; break; }
      }
    }
    if (!coupe) break;
    const A = P.slice(0, coupe.i+1).concat([coupe.x], P.slice(coupe.j+1));
    const B = [coupe.x].concat(P.slice(coupe.i+1, coupe.j+1));
    P = Math.abs(aireSignee(A)) >= Math.abs(aireSignee(B)) ? A : B;   // on garde la plus grande boucle
    if (P.length < 4) break;
  }
  return P;
}
function nettoyer(pts, eps){                 // supprime les points confondus, sinon les normales explosent
  const out = [];
  for(const p of pts){
    const q = out[out.length-1];
    if (!q || Math.hypot(p[0]-q[0], p[1]-q[1]) > (eps||.5)) out.push(p);
  }
  while (out.length > 3 && Math.hypot(out[0][0]-out[out.length-1][0], out[0][1]-out[out.length-1][1]) < (eps||.5))
    out.pop();
  return out;
}
function decaler(pts, m){                    // décalage vers l'intérieur, marge constante
  let P = nettoyer(pts, .6);
  if (aireSignee(P) < 0) P = P.slice().reverse();     // sens de parcours normalisé
  const N = P.length, out = [];
  const nrm = (x,z) => { const L = Math.hypot(x,z)||1; return [x/L, z/L]; };
  for(let i=0;i<N;i++){
    const p = P[i], a = P[(i-1+N)%N], b = P[(i+1)%N];
    const t1 = nrm(p[0]-a[0], p[1]-a[1]), t2 = nrm(b[0]-p[0], b[1]-p[1]);
    const n1 = [ -t1[1], t1[0] ], n2 = [ -t2[1], t2[0] ];
    let bx = n1[0]+n2[0], bz = n1[1]+n2[1];
    const L = Math.hypot(bx,bz);
    if (L < 1e-6){ bx = n1[0]; bz = n1[1]; } else { bx /= L; bz /= L; }
    const cos = n1[0]*bx + n1[1]*bz;
    const k = Math.min(1/Math.max(cos, .1), 1.3);      // onglet court : le coin reste, sans éperon
    out.push([ p[0] + bx*m*k, p[1] + bz*m*k ]);
  }
  // garde-fou : si le résultat n'est pas plus petit, on retombe sur le rétrécissement central
  // rattrapage local : un sommet trop près d'un bord est ramené sur sa normale, jamais supprimé
  const proj = q => {
    let d = 1e9, best = null;
    for(let i=0,j=P.length-1;i<P.length;j=i++){
      const a = P[j], b = P[i], dx = b[0]-a[0], dz = b[1]-a[1], L2 = dx*dx+dz*dz||1;
      let t = ((q[0]-a[0])*dx + (q[1]-a[1])*dz)/L2; t = Math.max(0, Math.min(1, t));
      const px = a[0]+dx*t, pz = a[1]+dz*t, e = Math.hypot(q[0]-px, q[1]-pz);
      if (e < d){ d = e; best = [px,pz]; }
    }
    return { d, best };
  };
  const rattrape = out.map(q => {
    const r = proj(q);
    if (r.d >= m*.8 || r.d < .01) return q;
    const ux = (q[0]-r.best[0])/r.d, uz = (q[1]-r.best[1])/r.d;
    return [ r.best[0] + ux*m*.8, r.best[1] + uz*m*.8 ];
  });
  const net = deboucler(nettoyer(rattrape, .4));
  if (Math.abs(aireSignee(net)) >= Math.abs(aireSignee(P))) return retrecir(pts, m);
  return net;
}
function retrecir(pts, m){
  let cx=0, cz=0;
  pts.forEach(p => { cx += p[0]; cz += p[1]; });
  cx /= pts.length; cz /= pts.length;
  return pts.map(p => {
    const dx = p[0]-cx, dz = p[1]-cz, L = Math.hypot(dx,dz) || 1;
    const k = Math.max(.25, (L-m)/L);
    return [cx+dx*k, cz+dz*k];
  });
}


// ---------- extraction du contour d’une parcelle, aux carrés marchants ----------
// La parcelle est l’ensemble des points à plus de MARGE du bord de l’îlot et à plus de
// MARGE_OBS des obstacles. On en extrait la frontière : elle contourne donc réellement
// chaque obstacle, avec un arrondi naturel et sans repliement possible.
const MARGE = 7.6, MARGE_OBS = 5.0;
function dedansPoly(P, x, z){
  let d = false;
  for(let i=0,j=P.length-1;i<P.length;j=i++)
    if ((P[i][1] > z) !== (P[j][1] > z) &&
        x < (P[j][0]-P[i][0])*(z-P[i][1])/(P[j][1]-P[i][1]) + P[i][0]) d = !d;
  return d;
}
let OBSTACLES = [];
function distBordSigne(P, x, z){
  let d = 1e9;
  for(let i=0,j=P.length-1;i<P.length;j=i++){
    const a = P[j], b = P[i], dx = b[0]-a[0], dz = b[1]-a[1], L2 = dx*dx+dz*dz||1;
    let t = ((x-a[0])*dx + (z-a[1])*dz)/L2; t = Math.max(0, Math.min(1, t));
    d = Math.min(d, Math.hypot(x-(a[0]+dx*t), z-(a[1]+dz*t)));
  }
  let dedans = false;
  for(let i=0,j=P.length-1;i<P.length;j=i++)
    if ((P[i][1] > z) !== (P[j][1] > z) &&
        x < (P[j][0]-P[i][0])*(z-P[i][1])/(P[j][1]-P[i][1]) + P[i][0]) dedans = !dedans;
  return dedans ? d : -d;
}
function contourParcelle(bord){
  let x0=1e9, x1=-1e9, z0=1e9, z1=-1e9;
  bord.forEach(p => { x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); z0=Math.min(z0,p[1]); z1=Math.max(z1,p[1]); });
  const pas = 2.6;
  x0 -= pas; z0 -= pas; x1 += pas; z1 += pas;
  const nx = Math.ceil((x1-x0)/pas), nz = Math.ceil((z1-z0)/pas);
  const val = new Float32Array((nx+1)*(nz+1));
  for(let j=0;j<=nz;j++) for(let i=0;i<=nx;i++){
    const x = x0 + i*pas, z = z0 + j*pas;
    let v = distBordSigne(bord, x, z) - MARGE;
    for(const O of OBSTACLES){
      const d = distBordSigne(O, x, z);          // positif dedans, négatif dehors
      v = Math.min(v, -d - MARGE_OBS);
    }
    val[j*(nx+1)+i] = v;
  }
  // carrés marchants
  const segs = [];
  const interp = (xa,za,va,xb,zb,vb) => {
    const t = va/(va-vb);
    return [xa + (xb-xa)*t, za + (zb-za)*t];
  };
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){
    const v0 = val[j*(nx+1)+i],   v1 = val[j*(nx+1)+i+1],
          v2 = val[(j+1)*(nx+1)+i+1], v3 = val[(j+1)*(nx+1)+i];
    const X = x0+i*pas, Z = z0+j*pas;
    const c = (v0>0?1:0) | (v1>0?2:0) | (v2>0?4:0) | (v3>0?8:0);
    if (c === 0 || c === 15) continue;
    const bas   = () => interp(X,Z,v0, X+pas,Z,v1);
    const droit = () => interp(X+pas,Z,v1, X+pas,Z+pas,v2);
    const haut  = () => interp(X+pas,Z+pas,v2, X,Z+pas,v3);
    const gauche= () => interp(X,Z+pas,v3, X,Z,v0);
    const A = {1:[bas,gauche],2:[droit,bas],3:[droit,gauche],4:[haut,droit],
               6:[haut,bas],7:[haut,gauche],8:[gauche,haut],9:[bas,haut],
               11:[droit,haut],12:[gauche,droit],13:[bas,droit],14:[gauche,bas]}[c];
    if (A) segs.push([A[0](), A[1]()]);
    else if (c === 5){ segs.push([bas(), droit()]); segs.push([haut(), gauche()]); }
    else if (c === 10){ segs.push([gauche(), bas()]); segs.push([droit(), haut()]); }
  }
  if (!segs.length) return decaler(bord, MARGE);
  // chaînage en boucles, on garde la plus longue
  const clef = p => (Math.round(p[0]*50)/50)+','+(Math.round(p[1]*50)/50);
  const depuis = new Map();
  segs.forEach(sg => { const k = clef(sg[0]); (depuis.get(k) || depuis.set(k,[]).get(k)).push(sg); });
  const vus = new Set(); let best = [];
  segs.forEach(sg => {
    if (vus.has(sg)) return;
    const boucle = []; let cur = sg;
    for(let n=0;n<8000 && cur && !vus.has(cur);n++){
      vus.add(cur); boucle.push(cur[0]);
      const suivants = depuis.get(clef(cur[1])) || [];
      cur = suivants.find(x => !vus.has(x));
    }
    if (boucle.length > best.length) best = boucle;
  });
  if (best.length < 8) return decaler(bord, MARGE);
  return lisser(simplifier(nettoyer(best, .6), .25), 1, true);
}
function alea(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed>>>15, 1 | seed);
  t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t;
  return ((t ^ t>>>14) >>> 0) / 4294967296; }; }

// ---------- la carte ----------
// Maillage 7×7 déformé, découpé en îlots de tailles inégales : c'est ce qui donne des
// parcelles qui ne se ressemblent pas. La graine est fixée, la carte est donc toujours
// la même. Les routes suivent le contour de chaque îlot, jamais le milieu d'une parcelle.
const CARTE = { n:7, taille:540, gigue:.32, seed:7 };
const parcelles = [];                     // contours des champs en friche, pour la suite
const routes = [];                        // axes des chemins et des routes, pour le calage
// La parcelle de départ, la cour et le hameau occupent déjà le centre. Rien de la campagne
// ne s'y pose : ni champ, ni arbre. La ferme se retrouve dans une clairière d'herbe au
// milieu du bocage, au lieu d'être bâtie au beau milieu d'une friche.
// La clairière de la ferme : le corps de ferme de la carte, la cour et la parcelle de
// travail. Aucun champ de la campagne ne s'y pose.
const ZJ = { x0:-126, x1:-28, z0:-126, z1:36 };
const zoneJoueur = (x, z) => x > ZJ.x0 && x < ZJ.x1 && z > ZJ.z0 && z < ZJ.z1;
// Un îlot ne se juge pas à son centre : un grand champ dont le milieu tombe au loin peut
// très bien recouvrir la ferme. C'est son emprise entière qu'il faut regarder.
function mordSurLaFerme(pts){
  const b = bbox(pts);
  return !(b.cx + b.w/2 < ZJ.x0 || b.cx - b.w/2 > ZJ.x1 ||
           b.cz + b.d/2 < ZJ.z0 || b.cz - b.d/2 > ZJ.z1);
}
(function carte(){
  const R = alea(CARTE.seed), N = CARTE.n, T = CARTE.taille, pas = T/N;
  // maillage déformé : le tour reste carré, l'intérieur bouge
  const S = [];
  for(let j=0;j<=N;j++){
    S[j] = [];
    for(let i=0;i<=N;i++){
      const bord = (i===0||j===0||i===N||j===N) ? 0 : 1;
      S[j][i] = [ -T/2 + i*pas + (R()-.5)*pas*CARTE.gigue*2*bord,
                  -T/2 + j*pas + (R()-.5)*pas*CARTE.gigue*2*bord ];
    }
  }
  // découpage en blocs de tailles variées
  const pris = Array.from({length:N}, () => new Array(N).fill(false));
  const blocs = [];
  for(let j=0;j<N;j++) for(let i=0;i<N;i++){
    if (pris[j][i]) continue;
    let w = 1 + ((R()*R()*3)|0), h = 1 + ((R()*R()*3)|0);
    while (i+w > N) w--;
    while (j+h > N) h--;
    for(let a=0;a<h;a++) for(let b=0;b<w;b++) if (pris[j+a][i+b]){ w = b; break; }
    if (w < 1) w = 1;
    for(let a=0;a<h;a++) for(let b=0;b<w;b++) pris[j+a][i+b] = true;
    blocs.push({ i0:i, j0:j, i1:i+w, j1:j+h });
  }
  const contourBloc = B => {
    const P2 = [];
    for(let i=B.i0;i<=B.i1;i++) P2.push(S[B.j0][i]);
    for(let j=B.j0+1;j<=B.j1;j++) P2.push(S[j][B.i1]);
    for(let i=B.i1-1;i>=B.i0;i--) P2.push(S[B.j1][i]);
    for(let j=B.j1-1;j>B.j0;j--) P2.push(S[j][B.i0]);
    return P2;
  };
  blocs.forEach(B => {
    B.pts = contourBloc(B); B.c = bbox(B.pts);
    B.aire = (B.i1-B.i0)*(B.j1-B.j0);
    B.type = 'champ';
  });
  // quelques îlots restent en herbe, quelques-uns partent en bois
  blocs.slice().sort((a,b) => (a.c.cx*7+a.c.cz*3) - (b.c.cx*7+b.c.cz*3))
    .filter((_,k) => k % Math.max(1, Math.floor(blocs.length/4)) === 0).slice(0,4)
    .forEach(B => B.type = 'prairie');
  const grand = blocs.reduce((a,b) => b.aire > a.aire ? b : a, blocs[0]);
  [[-120,-61],[65,34],[-118,137],[29,153],[121,127]].forEach(([x,z]) => {
    const B = blocs.find(b => b !== grand && b.type === 'champ' && dedansPoly(b.pts, x, z));
    if (B) B.type = 'foret';
  });
  // un chemin courbe traverse les grands îlots : sans lui la parcelle serait démesurée
  function coupure(B){
    const P2 = B.pts, nTop = B.i1-B.i0, nRight = B.j1-B.j0;
    const vertical = (B.j1-B.j0) >= (B.i1-B.i0);
    let a, b;
    if (vertical){ a = Math.floor(nTop/2); b = nTop + nRight + Math.floor(nTop/2); }
    else { a = nTop + Math.floor(nRight/2); b = 2*nTop + nRight + Math.floor(nRight/2); }
    a = ((a % P2.length) + P2.length) % P2.length;
    b = ((b % P2.length) + P2.length) % P2.length;
    if (a > b){ const t = a; a = b; b = t; }
    const A0 = P2[a], B0 = P2[b], gros = [A0];
    for(let k=1;k<5;k++){
      const t = k/5;
      const x = A0[0] + (B0[0]-A0[0])*t, z = A0[1] + (B0[1]-A0[1])*t;
      const dx = B0[0]-A0[0], dz = B0[1]-A0[1], L = Math.hypot(dx,dz)||1;
      const amp = Math.sin(t*Math.PI) * (R()-.5) * L * .2;
      gros.push([ x + (dz/L)*amp, z - (dx/L)*amp ]);
    }
    gros.push(B0);
    return { chemin: lisser(gros, 3, false),
             moities: [ P2.slice(a, b+1).concat(gros.slice(1,-1).reverse()),
                        P2.slice(b).concat(P2.slice(0, a+1)).concat(gros.slice(1,-1)) ] };
  }
  // ---------- les champs, tous en friche, avec la terre du jeu ----------
  // `surface` fabrique ses coordonnées de texture à partir de la forme : deux parcelles
  // voisines montreraient donc le même bout d'image, à des échelles différentes. On les
  // réécrit en repère sol, au pas de la parcelle de départ, pour que le motif soit continu
  // d'un champ à l'autre et de la même finesse partout.
  const TERRE = gouache(new THREE.MeshLambertMaterial({ map:soilTex(), side:THREE.DoubleSide }), .3, true);
  function champ(pts){
    const g = surface(pts), p = g.attributes.position, uv = new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){ uv[i*2] = p.getX(i)/2.9; uv[i*2+1] = p.getZ(i)/2.9; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv,2));
    const m = new THREE.Mesh(g, TERRE);
    m.position.y = .06; m.receiveShadow = true; m.renderOrder = -11; scene.add(m);
    parcelles.push(pts);
    const bd = ruban(pts, .7, '#8a7343', .12, true); if (bd) scene.add(bd);
  }
  blocs.forEach(B => {
    if (B.type === 'prairie') return;                       // laissé en herbe
    const coupable = B.aire >= 4 && Math.min(B.i1-B.i0, B.j1-B.j0) >= 2;
    const coupe = coupable ? (B.coupe = coupure(B)) : null;
    (coupe ? coupe.moities : [B.pts]).forEach(m => {
      const pts = contourParcelle(m);
      if (!mordSurLaFerme(pts)) champ(pts);
    });
    if (coupe){
      const bv = ruban(coupe.chemin, 8.4, '#9db354', .045, false); if (bv) scene.add(bv);
      const md = ruban(coupe.chemin, 5.6, '#c9b184', .078, false); if (md) scene.add(md);
      routes.push({ pts:coupe.chemin, ferme:false });
    }
  });
  // ---------- routes : le contour de chaque îlot ----------
  blocs.forEach(B => {
    const pts = lisser(densifier(B.pts, 3), 2, true);
    const bd = ruban(pts, 8.4, '#9db354', .04, true); if (bd) scene.add(bd);
    const md = ruban(pts, 5.6, '#c9b184', .07, true); if (md) scene.add(md);
    routes.push({ pts, ferme:true });
  });
  // ---------- le mobilier de la carte ----------
  // Ni bois ni arbres engendrés : la carte a les siens, relevés un par un avec leur
  // essence, leur orientation et leur taille. On les repose exactement là où ils étaient.
  const ESP = [chene, peuplier, sapin, pommier, buisson];
  const rnd = alea(31);
  BATIMENTS.forEach(([f, x, z, ry, sc]) => {
    const b = BATS[f]; if (!b) return;
    const g = poserBatiment(b, x, z, ry);
    if (sc && sc !== 1) g.scale.setScalar(sc);
  });
  ARBRES.forEach(([e, n, x, z, ry, sc]) => {
    const g = new THREE.Group();
    for(let k=0;k<n;k++){
      const t = ESP[e]();
      // un bosquet, c'est plusieurs pieds serrés autour du même point
      if (n > 1){ const a = rnd()*6.283, r = rnd()*8;
                  t.position.set(Math.cos(a)*r, 0, Math.sin(a)*r); }
      t.rotation.y = rnd()*6.28; t.scale.setScalar(.8 + rnd()*.5);
      g.add(t);
    }
    g.position.set(x, 0, z); g.rotation.y = ry || 0;
    if (sc && sc !== 1) g.scale.setScalar(sc);
    g.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
    addObst(x, z, n > 1 ? 6 : 1.1);            // un bosquet se contourne d'un bloc
  });
})();
