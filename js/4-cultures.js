"use strict";
// ---------- blé : variante E, champ découpé en tuiles pour le frustum culling ----------
function merge(parts){
  const gs = parts.map(p => {
    let g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
    g.applyMatrix4(p.m);
    const n = g.attributes.position.count, c = new THREE.Color(p.c), col = new Float32Array(n*3);
    for(let i=0;i<n;i++){ col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col,3));
    return g;
  });
  const total = gs.reduce((s,g)=>s+g.attributes.position.count,0);
  const pos=new Float32Array(total*3), nor=new Float32Array(total*3), col=new Float32Array(total*3);
  let o=0;
  gs.forEach(g => {
    pos.set(g.attributes.position.array,o*3);
    nor.set(g.attributes.normal.array,o*3);
    col.set(g.attributes.color.array,o*3);
    o += g.attributes.position.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos,3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor,3));
  out.setAttribute('color', new THREE.BufferAttribute(col,3));
  return out;
}
const MX = (x,y,z,rx,ry,rz,s) => new THREE.Matrix4().compose(
  new THREE.Vector3(x,y,z),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)),
  new THREE.Vector3(1,1,1).multiplyScalar(s===undefined?1:s));
// Six brins par pied au lieu de quatre, et écartés jusqu'à vingt-six centimètres du centre.
// Les pieds étant à soixante, les brins d'un pied entrent dans ceux d'à côté : plus un
// centimètre de terre entre les rangs.
function tuftE(head, stemCol){
  const p = [];
  [[0,0,1.5],[.24,.14,1.22],[-.21,-.16,1.36],[.06,-.26,1.12],
   [-.19,.24,1.28],[.20,-.10,1.16]].forEach(([x,z,H]) => {
    const g = new THREE.CylinderGeometry(.019,.03,H,4,1,true); g.translate(0,H/2,0);
    p.push({ g, c:stemCol, m:MX(x,0,z) });
    for(let k=0;k<3;k++){
      const y = H-.02+k*.15, s = 1-k*.14;
      p.push({ g:new THREE.ConeGeometry(.056,.18,3), c:head, m:MX(x+.05,y,z,0,0,-.7,s) });
      p.push({ g:new THREE.ConeGeometry(.056,.18,3), c:head, m:MX(x-.05,y,z,0,0, .7,s) });
    }
  });
  return merge(p);
}
const UW = { t:{value:0}, amp:{value:.1}, h:{value:2.1} };
function windMat(){
  const m = new THREE.MeshLambertMaterial({ vertexColors:true });
  gouache(m, .3, true);
  chainCompile(m, s => {
    s.uniforms.uTime = UW.t; s.uniforms.uAmp = UW.amp; s.uniforms.uH = UW.h;
    s.vertexShader = 'uniform float uTime;uniform float uAmp;uniform float uH;\n' + s.vertexShader
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 wp = instanceMatrix[3].xyz;
        float seed = fract(sin(dot(wp.xz, vec2(12.9898,78.233)))*43758.5453);
        float ph = wp.x*.55 + wp.z*.75 + seed*6.2831;
        float sway = sin(uTime*1.7 + ph)*.6 + sin(uTime*2.9 + ph*1.7)*.4;
        float gust = .55 + .45*sin(uTime*.42 + wp.x*.07 + wp.z*.03);
        float k = pow(clamp(transformed.y/uH,0.,1.), 1.7);
        float a = uAmp*(.7+seed*.6)*gust*k;
        vec3 W = vec3(sway*a, 0., sway*a*.45);
        vec3 ix = instanceMatrix[0].xyz, iz = instanceMatrix[2].xyz;
        transformed.x += dot(W, ix)/max(dot(ix,ix),1e-4);
        transformed.z += dot(W, iz)/max(dot(iz,iz),1e-4);
      `);
  });
  return m;
}
const CN = 9, CH = P/CN;                                    // 9×9 tuiles : le GPU n'affiche que celles à l'écran

// ---------- cultures : chacune a sa silhouette, son prix et son rythme ----------
function tuftRape(flower, stemCol){                         // colza : tiges ramifiées, tête en grappe
  const p = [];
  [[0,0,1.32],[.25,.17,1.14],[-.23,-.18,1.26],[.08,-.26,1.02]].forEach(([x,z,H]) => {
    const g = new THREE.CylinderGeometry(.022,.036,H,4,1,true); g.translate(0,H/2,0);
    p.push({ g, c:stemCol, m:MX(x,0,z) });
    p.push({ g:new THREE.ConeGeometry(.075,.3,4), c:stemCol, m:MX(x+.1,H*.42,z, 0,.6,-1.15) });
    p.push({ g:new THREE.ConeGeometry(.075,.3,4), c:stemCol, m:MX(x-.1,H*.62,z, 0,-.6, 1.15) });
    // La grappe coûtait à elle seule les trois quarts du colza : sept boules de cinq par
    // quatre facettes, par tige, par pied. À la distance où on la voit, quatre par trois
    // font exactement la même fleur pour un tiers du prix.
    for(let k=0;k<6;k++){
      const a = k/6*6.28318, r = .075 + (k%3)*.024;
      p.push({ g:new THREE.SphereGeometry(.055,4,3), c:flower,
               m:MX(x+Math.cos(a)*r, H - .02 + (k%3)*.075, z+Math.sin(a)*r) });
    }
  });
  return merge(p);
}
function tuftCorn(leaf, stemCol, cob){                      // maïs : des cannes hautes, feuilles en hélice
  // Un vrai champ de maïs, où les cannes se touchent. Six cannes par pied au lieu de trois,
  // écartées jusqu'à trente centimètres du centre : les pieds voisins étant à soixante-douze
  // centimètres, les feuilles d'un pied entrent dans celles d'à côté et la terre disparaît
  // sous le rang. Onze cannes et demie au mètre carré, sans un objet de plus à afficher —
  // c'est une seule géométrie posée aux mêmes emplacements.
  const p = [], H = 2.75;
  const CANNES = [ [0,0,1], [.36,.07,.92], [-.30,.25,.97], [.13,-.36,.88],
                   [-.36,-.20,.95], [.27,.34,.90] ];          // décalage x, z, échelle
  for(const [dx,dz,sc] of CANNES){
    const h = H*sc, tour = dx*7.3 + dz*4.1;
    const g = new THREE.CylinderGeometry(.05,.08,h,5,1,true); g.translate(0,h/2,0);
    p.push({ g, c:stemCol, m:MX(dx,0,dz) });
    for(let k=0;k<5;k++){
      const a = k*1.26 + tour, y = (.34 + k*.33)*sc, s2 = (1 - k*.1)*sc;
      p.push({ g:new THREE.ConeGeometry(.12,1.02,3), c:leaf,
               m:MX(dx+Math.cos(a)*.2, y, dz+Math.sin(a)*.2, 0, -a, 1.18, s2) });
    }
    p.push({ g:new THREE.CylinderGeometry(.12,.085,.70,6), c:cob,
             m:MX(dx+.16, h*.58, dz+.05, 0, tour, -.3) });
    p.push({ g:new THREE.ConeGeometry(.07,.46,4), c:cob, m:MX(dx,h,dz) });  // la panicule au sommet
  }
  return merge(p);
}
// Avant le labour, la parcelle ne montre plus aucun motif peint : uniquement ce dépôt,
// les tiges de la récolte précédente qui ont séché sur place.
function tuftStraw(){
  // De la menue paille, telle qu'une moissonneuse la hache. Les morceaux restent bien plus
  // courts que la botte d'origine, remontés d'un quart pour qu'on les distingue un à un à
  // la distance de la caméra. Vingt-huit par touffe, sur la même emprise. Les sections sont
  // à trois pans : à cette taille les faces ne se distinguent plus, et c'est ce qui permet
  // d'en poser autant sans alourdir l'affichage.
  const p = [], col = '#f7e598', colD = '#cfae52', colP = '#e8d178';
  for(let k=0;k<28;k++){
    const a = k*1.11 + (k%3)*.42, L = .38 + (k%4)*.118, r = .05 + (k%7)*.07;
    const g = new THREE.CylinderGeometry(.032,.023,L,3); g.rotateZ(Math.PI/2);
    p.push({ g, c: k%3 === 0 ? col : k%3 === 1 ? colD : colP,
             m: MX(Math.cos(a)*r, .036 + (k%3)*.027, Math.sin(a)*r, 0, a, .04 + (k%2)*.05) });
  }
  return merge(p);
}
const CROPS = [
  { id:'ble', n:'Blé', emo:'🌾', d:'Rustique et sans frais de semence.',
    price:9, yieldK:.70, grow:1, scale:1, uh:2.1, seed:0, unlock:0,
    young:()=>tuftE(C.headY, C.stemY), ripe:()=>tuftE(C.headR, C.stemD) },
  { id:'colza', n:'Colza', emo:'🌼', d:'Pousse plus lentement, se vend bien mieux.',
    price:16, yieldK:.58, grow:.78, scale:1.05, uh:2.0, seed:1500, unlock:6000,
    young:()=>tuftRape('#a9c552','#4f8f36'), ripe:()=>tuftRape('#f2d417','#779c34') },
  { id:'mais', n:'Maïs', emo:'🌽', d:'Long à mûrir, mais c\'est la culture reine.',
    price:27, yieldK:.50, grow:.58, scale:1.3, uh:3.9, seed:4000, unlock:25000,
    young:()=>tuftCorn('#4f9c33','#478f2e','#4f9c33'), ripe:()=>tuftCorn('#84a53d','#8a9a35','#e8c236') }
];
function cropGeo(c){
  if (!c._y){
    c._y = c.young(); c._r = c.ripe();
    [c._y, c._r].forEach(g => {
      g.computeBoundingSphere();
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,1,0), CH*.75 + 3);
    });
  }
  return c;
}
let cropI = 0, cropScale = 1;
const crop = () => CROPS[cropI];
// Pieds franchement plus serrés : de soixante-douze centimètres on descend à soixante, soit
// une moitié de plants en plus au mètre carré. Comme chaque pied porte le même rendement, on
// le divise d'autant : le champ est plus dense à l'œil, la benne se remplit pareil.
const SP0 = .72, SP = .60, RENDK = (SP/SP0)*(SP/SP0);
const plants = [], chunks = [];
for(let cz=0;cz<CN;cz++) for(let cx=0;cx<CN;cx++)
  chunks.push({ cx:X0+(cx+.5)*CH, cz:Z0+(cz+.5)*CH, list:[] });
for(let x=X0+SP/2; x<X0+P; x+=SP)
  for(let z=Z0+SP/2; z<Z0+P; z+=SP){
    const ti = cellIndex(x,z);
    const ci = Math.min(CN-1,Math.floor((z-Z0)/CH))*CN + Math.min(CN-1,Math.floor((x-X0)/CH));
    const px = x+(Math.random()-.5)*.24, pz = z+(Math.random()-.5)*.24;
    if (parcelInset(px,pz) < .4) continue;        // rien ne lève hors du contour de la terre
    const p = { x:px, z:pz, y:parcelY(px,pz), ti, ci,
                g:0, r:0, rot:Math.random()*3.1, s:.85+Math.random()*.3, i:chunks[ci].list.length };
    chunks[ci].list.push(plants.length); plants.push(p);
  }
const geoStraw = tuftStraw();
geoStraw.computeBoundingSphere();
geoStraw.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,.2,0), CH*.75 + 1);
chunks.forEach(c => {
  c.young = new THREE.InstancedMesh(cropGeo(CROPS[0])._y, windMat(), Math.max(1,c.list.length));
  c.ripe  = new THREE.InstancedMesh(cropGeo(CROPS[0])._r, windMat(), Math.max(1,c.list.length));
  c.straw = new THREE.InstancedMesh(geoStraw,
    gouache(new THREE.MeshLambertMaterial({ vertexColors:true }), .3, true), Math.max(1,c.list.length));
  c.straw.position.set(c.cx,0,c.cz); c.straw.receiveShadow = true;
  c.straw.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // La teinte par instance doit exister AVANT la première compilation : créée après coup,
  // three garde le programme d'origine, sans l'attribut, et la couleur reste ignorée.
  const tc = new Float32Array(Math.max(1,c.list.length)*3).fill(1);
  c.straw.instanceColor = new THREE.InstancedBufferAttribute(tc,3);
  c.straw.instanceColor.setUsage(THREE.DynamicDrawUsage);
  scene.add(c.straw);
  [c.young,c.ripe].forEach(m => {
    m.position.set(c.cx,0,c.cz); m.castShadow = false; m.receiveShadow = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m);
  });
});

// ---------- les mottes : le relief de la terre, en volumes ----------
// L'état du sol ne se joue plus seulement sur la couleur du ruban. La parcelle porte de
// vraies mottes, qui prennent la lumière et portent leur ombre, et qui changent de taille,
// de teinte et d'alignement selon ce qu'on vient de faire à la terre : tassées et grises
// sur la friche, grosses et fraîches derrière la déchaumeuse — rangées le long des sillons —
// cassées menu une fois le lit de semence rappuyé, et assombries quand on mouille.
// Quatre tuiles de côté seulement : le sol est bas en triangles, mieux vaut peu d'appels.
const MN = 4, MH = P/MN, MSP = .58;                     // trois mottes au mètre carré
const mottes = [], mtiles = [];
for(let j=0;j<MN;j++) for(let i=0;i<MN;i++)
  mtiles.push({ cx:X0+(i+.5)*MH, cz:Z0+(j+.5)*MH, list:[] });
for(let x=X0+MSP/2; x<X0+P; x+=MSP)
  for(let z=Z0+MSP/2; z<Z0+P; z+=MSP){
    const px = x+(Math.random()-.5)*MSP*.85, pz = z+(Math.random()-.5)*MSP*.85;
    if (parcelInset(px,pz) < .35) continue;
    const ci = Math.min(MN-1,Math.floor((pz-Z0)/MH))*MN + Math.min(MN-1,Math.floor((px-X0)/MH));
    const ti = cellIndex(px,pz);
    if (ti < 0) continue;                      // hors de la grille : pas de motte
    mottes.push({ x:px, z:pz, y:parcelY(px,pz), ti, ci,
                  rx:Math.random()*3.1, ry:Math.random()*3.1, rz:Math.random()*3.1,
                  u:Math.random(), ton:Math.random() < .5 ? 0 : 1, e:-1,
                  i:mtiles[ci].list.length });
    mtiles[ci].list.push(mottes.length-1);
  }
// par état : taille mini et maxi, et les deux tons qui se répondent
const MOTTE = [
  { s:[.26,.46], c:['#7a6a45','#94855c'] },   // 0 · friche, terre grise et tassée
  { s:[.32,.60], c:['#7d6039','#8a6a3f'] },   // 1 · labouré, la motte est retournée
  { s:[.15,.29], c:['#7c5f3d','#8a6c47'] },   // 2 · semé, lit rappuyé, motte cassée menu
  { s:[.15,.29], c:['#5c452b','#684f34'] },   // 3 · fertilisé, la même en mouillée
  { s:[.11,.22], c:['#836f45','#97815a'] }    // 4 · moissonné, terre sèche entre les chaumes
];
const SILLON = .46;                                     // un sillon tous les 46 cm
(function(){
  const geo = new THREE.IcosahedronGeometry(.5, 0);
  mtiles.forEach(t => {
    const m = new THREE.InstancedMesh(geo,
      gouache(new THREE.MeshPhongMaterial({ flatShading:true, shininess:0,
                specular:new THREE.Color(0,0,0) }), .3, true),
      Math.max(1, t.list.length));
    m.position.set(t.cx, 0, t.cz);
    m.castShadow = true; m.receiveShadow = true;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.renderOrder = -6;
    scene.add(m); t.mesh = m;
  });
})();
const _mc = new THREE.Color();
function writeMotte(k){
  const m = mottes[k], t = mtiles[m.ci], e = cell[m.ti], R = MOTTE[e];
  // sur le labour, la motte grossit sur la crête du sillon et s'efface dans le creux :
  // c'est ce qui donne au champ son sens de lecture
  const k1 = e === 1 ? .74 + .36*Math.sin(m.x/SILLON*6.2832) : 1;
  const sc = (R.s[0] + m.u*(R.s[1]-R.s[0])) * k1;
  dummy.position.set(m.x-t.cx, m.y + sc*.22, m.z-t.cz);
  dummy.rotation.set(m.rx, m.ry, m.rz);
  dummy.scale.set(sc, sc*.55, sc*1.06);
  dummy.updateMatrix();
  t.mesh.setMatrixAt(m.i, dummy.matrix);
  t.mesh.setColorAt(m.i, _mc.set(R.c[m.ton]));
  m.e = e; t.sale = true;
}
function majMottes(){
  for(let k=0;k<mottes.length;k++) if (mottes[k].e !== cell[mottes[k].ti]) writeMotte(k);
  mtiles.forEach(t => {
    if (!t.sale) return;
    t.mesh.instanceMatrix.needsUpdate = true;
    if (t.mesh.instanceColor) t.mesh.instanceColor.needsUpdate = true;
    t.sale = false;
  });
}

const dummy = new THREE.Object3D();
// `p.r` distingue deux dépôts au sol qui partagent le même touffe : 1 = la paille jaune
// que laisse la moissonneuse, 2 = les repousses sèches de la friche, plus courtes et
// tirant sur le gris-vert. La teinte se pose par instance, la géométrie ne change pas.
const TON_PAILLE = new THREE.Color(1,1,1), TON_FRICHE = new THREE.Color(.68,.72,.64);
function writePlant(k){
  const p = plants[k], c = chunks[p.ci];
  const ripe = Math.max(0, Math.min(1, (p.g-.62)/.18));
  dummy.position.set(p.x-c.cx, p.y, p.z-c.cz); dummy.rotation.set(0,p.rot,0);
  const h = p.s*cropScale*Math.min(1,p.g*1.25);
  dummy.scale.setScalar(h*(1-ripe)); dummy.updateMatrix();
  c.young.setMatrixAt(p.i, dummy.matrix);
  dummy.scale.setScalar(h*ripe); dummy.updateMatrix();
  c.ripe.setMatrixAt(p.i, dummy.matrix);
  dummy.rotation.set(0, p.rot*1.7, 0);
  dummy.scale.setScalar(p.r ? p.s*(p.r === 2 ? .74 : 1) : 0); dummy.updateMatrix();
  c.straw.setMatrixAt(p.i, dummy.matrix);
  c.straw.setColorAt(p.i, p.r === 2 ? TON_FRICHE : TON_PAILLE);
  c.dirty = true;
}
function redrawPlants(){
  plants.forEach((p,k) => writePlant(k));
  chunks.forEach(c => {
    c.young.instanceMatrix.needsUpdate = c.ripe.instanceMatrix.needsUpdate = true;
    c.straw.instanceMatrix.needsUpdate = true;
    if (c.straw.instanceColor) c.straw.instanceColor.needsUpdate = true;
  });
}
// bascule de culture : on échange la géométrie des tuiles, les instances restent en place
function applyCrop(){
  const c = cropGeo(crop());
  cropScale = c.scale; UW.h.value = c.uh;
  chunks.forEach(ch => { ch.young.geometry = c._y; ch.ripe.geometry = c._r; });
  redrawPlants();
}
applyCrop();

// ---------- traces de roues ----------
const TRACKS = (function(){
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0,0,64,0);
  grd.addColorStop(0,'rgba(0,0,0,0)'); grd.addColorStop(.3,'rgba(0,0,0,.9)');
  grd.addColorStop(.7,'rgba(0,0,0,.9)'); grd.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle = grd; x.fillRect(0,0,64,32);
  x.globalCompositeOperation = 'destination-out';
  for(let i=0;i<8;i++) x.fillRect(0, i*4, 64, 1.6);
  const tex = new THREE.CanvasTexture(c);
  const MAX = 300, LIFE = 5.5;
  const geo = new THREE.PlaneGeometry(1,1); geo.rotateX(-Math.PI/2);
  const mesh = new THREE.InstancedMesh(geo,
    new THREE.MeshBasicMaterial({ map:tex, color:0x2c5c1a, transparent:true, opacity:.5, depthWrite:false }), MAX);
  mesh.frustumCulled = false; mesh.renderOrder = 1; scene.add(mesh);
  const life = new Float32Array(MAX), px = new Float32Array(MAX), pz = new Float32Array(MAX),
        pa = new Float32Array(MAX), pw = new Float32Array(MAX);
  let head = 0;
  const d = new THREE.Object3D();
  for(let i=0;i<MAX;i++){ d.scale.set(0,0,0); d.updateMatrix(); mesh.setMatrixAt(i,d.matrix); }
  return {
    add(x,z,ang,w){ life[head]=LIFE; px[head]=x; pz[head]=z; pa[head]=ang; pw[head]=w; head=(head+1)%MAX; },
    update(dt){
      let any = false;
      for(let i=0;i<MAX;i++){
        if (life[i] <= 0) continue;
        life[i] -= dt; any = true;
        const f = Math.max(0, Math.min(1, life[i]/LIFE));
        d.position.set(px[i], parcelY(px[i],pz[i]) + .05, pz[i]); d.rotation.set(0,pa[i],0);
        d.scale.set(pw[i]*f, 1, .55); d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      }
      if (any) mesh.instanceMatrix.needsUpdate = true;
    }
  };
})();
