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
// Le champ de travail n'est plus un carré posé sur le monde : c'est l'une des parcelles
// de la carte, avec son contour à elle. `calerChamp` la reçoit une fois la carte engendrée
// et cale tout dessus — la grille de cellules, le masque de découpe, la hauteur de terre.
const NS = 256;
let X0 = -120, Z0 = -200, P = 80, CS = P/NS;
// La ferme n'est plus au centre du monde : elle est posée sur la carte, au corps de ferme
// dont le hangar sert de point de départ. Le parc à engins tient sur la cour de sable de ce
// corps de ferme, à côté du hangar — mesuré dans cette cour, à distance de ses bâtiments
// (essais/sols.js). Le champ, lui, est choisi par la carte : voir plus bas `calerChamp`.
const HANGAR = { x:-108.41, z:-69.07 };
const COUR = { x0:-112, x1:-64, z0:-100, z1:-78 };   // le parc, sur la cour du corps de ferme
const cell = new Uint8Array(NS*NS);           // état du sol : logique seule, plus aucun rendu par texture
function cellIndex(x,z){
  const ix = Math.floor((x-X0)/CS), jz = Math.floor((z-Z0)/CS);
  if (ix<0||jz<0||ix>=NS||jz>=NS) return -1;
  return jz*NS+ix;
}
// 0 friche · 1 labouré · 2 semé · 3 fertilisé · 4 moissonné. La friche et le chaume
// partageaient le même code : on ne pouvait pas les dessiner différemment.
const cellN = [0, 0, 0, 0, 0];                // combien de cellules dans chaque état
// La grille couvre le rectangle englobant du champ ; le champ, lui, a la forme qu'il a.
// MASQ porte la distance signée à son bord — positive dedans. Les cellules du dehors ne
// se travaillent pas et ne comptent pas : sans quoi l'avancement plafonnerait à soixante
// pour cent sur une parcelle qui n'est pas carrée.
const MASQ = new Float32Array(NS*NS);
let NIN = 0, POLY = null;
function setCell(i,s2){
  if (i<0 || MASQ[i] <= 0 || cell[i]===s2) return false;
  cellN[cell[i]]--; cellN[s2]++; cell[i] = s2; return true;
}
function fillCells(s2){
  for(let k=0;k<5;k++) cellN[k] = 0;
  for(let i=0;i<cell.length;i++){
    if (MASQ[i] > 0){ cell[i] = s2; cellN[s2]++; } else cell[i] = 0;
  }
}

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
// Creux et bosses très doux, et seulement au-delà de la carte.
const dRect = (x,z,x0,x1,z0,z1) =>
  Math.hypot(Math.max(x0-x, 0, x-x1), Math.max(z0-z, 0, z-z1));
function herbeY(x, z){
  const k = 1;
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
// ---------- le champ de travail : une parcelle de la carte, pas une dalle posée dessus ----
// Il n'y a plus de bloc de terre en surépaisseur, plus de bord crénelé fabriqué, plus de
// dalle carrée au milieu de la campagne : on travaille l'un des champs de la carte, dessiné
// par elle, à sa forme et à sa texture. Ne restent ici que ce qu'il faut pour y jouer — de
// quoi dire où est le dedans, à quelle hauteur est la terre, et où découper les passages.
const LIP = .06;                                       // l'épaisseur des champs de la carte
// Distance signée au bord, lue dans MASQ par interpolation : appelée pour chaque brin, pour
// chaque motte et à chaque image, elle ne peut pas reparcourir un contour de soixante points.
function parcelInset(x, z){
  const u = (x-X0)/CS - .5, v = (z-Z0)/CS - .5;
  const i = Math.floor(u), j = Math.floor(v);
  if (i < 0 || j < 0 || i >= NS-1 || j >= NS-1) return -99;
  const fu = u-i, fv = v-j, k = j*NS+i;
  return (MASQ[k]*(1-fu)      + MASQ[k+1]*fu)*(1-fv)
       + (MASQ[k+NS]*(1-fu)   + MASQ[k+NS+1]*fu)*fv;
}
const dansChamp = (x, z) => parcelInset(x, z) > 0;
// hauteur du dessus de la terre : 0 sur l'herbe, une rampe d'un mètre au bord du champ
function parcelY(x, z){
  const d = parcelInset(x, z);
  if (d <= 0) return 0;
  const k = Math.min(1, d/1.15);
  return LIP * k*k*(3-2*k);
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
// ---------- traînées de passage : un ruban continu, pas des rectangles bout à bout ----------
// (des quads successifs faisaient un bord en dents de scie dans les courbes : ici les sommets
//  sont partagés d'un échantillon au suivant, le bord est une polyligne lisse)
// Le ruban de travail était rogné sur un rectangle droit : au bout de chaque passage il
// s'arrêtait donc net, alors que la terre, elle, ondule. On le laisse déborder et c'est le
// contour réel qui le découpe, au pixel près, dans le fragment shader.
// La découpe se faisait sur un rectangle, avec le bord ondulé recalculé dans le shader.
// Le champ n'est plus un rectangle : on découpe sur le masque du contour, la même image que
// celle qui sert à MASQ. Les uniformes sont posés par `calerChamp`, après la carte.
const MASQ_TEX = new THREE.DataTexture(new Uint8Array(NS*NS*4), NS, NS, THREE.RGBAFormat);
const CLIP = { masque:{ value:MASQ_TEX }, orig:{ value:new THREE.Vector2() }, cote:{ value:1 } };
function clipToParcel(m){
  gouache(m, .42, true);
  chainCompile(m, sh => {
    sh.uniforms.uMasq = CLIP.masque;
    sh.uniforms.uOrig = CLIP.orig;
    sh.uniforms.uCote = CLIP.cote;
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace(
      '#include <fog_vertex>',
      '#include <fog_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = ('varying vec3 vWP;\nuniform sampler2D uMasq;\n' +
      'uniform vec2 uOrig;\nuniform float uCote;\n' + sh.fragmentShader).replace(
      '#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\n' +
      '  vec2 _uv = (vWP.xz - uOrig) / uCote;\n' +
      '  if (_uv.x < 0.0 || _uv.x > 1.0 || _uv.y < 0.0 || _uv.y > 1.0) discard;\n' +
      '  if (texture2D(uMasq, _uv).r < 0.5) discard;');
  }, 'champMasque');
  return m;
}
// Le champ que la carte a retenu : on cale dessus la grille des cellules, le masque du
// contour et la texture de découpe. Appelé une fois, depuis js/3c-carte.js.
function calerChamp(poly){
  POLY = poly;
  let x0=1e9, x1=-1e9, z0=1e9, z1=-1e9;
  poly.forEach(p => { x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]);
                      z0=Math.min(z0,p[1]); z1=Math.max(z1,p[1]); });
  P = Math.max(x1-x0, z1-z0) + 6;                      // grille carrée : trois mètres de marge
  X0 = (x0+x1)/2 - P/2; Z0 = (z0+z1)/2 - P/2; CS = P/NS;
  // Remplissage par balayage : une ligne de cellules à la fois, on relève les croisements
  // du contour et on remplit entre eux. Mesurer au lieu de cela la distance exacte de
  // chaque cellule à chaque sommet coûtait le produit des deux — supportable sur un
  // rectangle de quatre sommets, plus du tout depuis que le bord est découpé et en compte
  // cinq cents.
  const dedans = new Uint8Array(NS*NS), xs = [];
  for(let j=0;j<NS;j++){
    const z = Z0 + (j+.5)*CS;
    xs.length = 0;
    for(let k=0,l=poly.length-1;k<poly.length;l=k++){
      const a = poly[l], b = poly[k];
      if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + (b[0]-a[0])*(z-a[1])/(b[1]-a[1]));
    }
    xs.sort((p,q) => p-q);
    for(let s=0;s+1<xs.length;s+=2){
      let i0 = Math.ceil((xs[s]-X0)/CS - .5), i1 = Math.floor((xs[s+1]-X0)/CS - .5);
      if (i0 < 0) i0 = 0;
      if (i1 > NS-1) i1 = NS-1;
      for(let i=i0;i<=i1;i++) dedans[j*NS+i] = 1;
    }
  }
  // Distance au bord par chanfrein 3-4, deux passes : le coût ne dépend plus que de la
  // grille. Positive dedans, négative dehors.
  const LOIN = 1e6, A = new Float32Array(NS*NS), B = new Float32Array(NS*NS);
  for(let k=0;k<NS*NS;k++){ A[k] = dedans[k] ? LOIN : 0; B[k] = dedans[k] ? 0 : LOIN; }
  const chanfrein = D => {
    const lu = (i,j) => (i<0||j<0||i>=NS||j>=NS) ? LOIN : D[j*NS+i];
    for(let j=0;j<NS;j++) for(let i=0;i<NS;i++){
      const k = j*NS+i;
      D[k] = Math.min(D[k], lu(i-1,j)+3, lu(i,j-1)+3, lu(i-1,j-1)+4, lu(i+1,j-1)+4);
    }
    for(let j=NS-1;j>=0;j--) for(let i=NS-1;i>=0;i--){
      const k = j*NS+i;
      D[k] = Math.min(D[k], lu(i+1,j)+3, lu(i,j+1)+3, lu(i+1,j+1)+4, lu(i-1,j+1)+4);
    }
  };
  chanfrein(A); chanfrein(B);
  const px = MASQ_TEX.image.data;
  NIN = 0;
  for(let k=0;k<NS*NS;k++){
    MASQ[k] = (A[k] - B[k]) * CS/3;
    const v = dedans[k] ? 255 : 0;
    px[k*4] = px[k*4+1] = px[k*4+2] = v; px[k*4+3] = 255;
    if (dedans[k]) NIN++;
  }
  MASQ_TEX.needsUpdate = true;
  CLIP.orig.value.set(X0, Z0); CLIP.cote.value = P;
  fillCells(0);
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
  // Un échantillon tous les 25 cm de parcours d'outil : 20 000 ne couvraient que cinq
  // kilomètres, tous engins et toute la durée d'une étape confondus. Passé ce nombre le
  // ruban cessait de s'allonger sans rien dire, et le champ gardait sa friche là où l'outil
  // était pourtant passé. Le champ du jeu fait quarante fois la surface de l'ancien carré
  // une fois comptés les allers-retours à la cour ; on triple, et surtout on le dit.
  const MAXS = 60000, TILE = 2.9;         // 1 motif = 2,9 m au sol, échelle constante
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
      if (n >= MAXS){
        if (!SWATH.plein){ SWATH.plein = true; console.warn('ruban saturé :', MAXS, 'échantillons'); }
        return;
      }
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
    reset(){ n = 0; tri = 0; fil = null; SWATH.plein = false; geo.setDrawRange(0,0); },
    plein: false,                          // le ruban a-t-il saturé ? sinon on ne le saurait pas
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
