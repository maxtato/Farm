"use strict";

const C = {
  red:'#d63a29', redDark:'#9e2618', green:'#2f8f3d', greenDark:'#1b6528',
  blue:'#2f6fae', blueDark:'#1d4a7a', orange:'#ef7f1f', orangeDark:'#b85c10',
  cream:'#e9e2cd', glass:'#12171d', metal:'#b6bec6', steel:'#7d8891',
  dark:'#1c2127', tire:'#15181c', tread:'#2a3038',
  gold:'#efb833', goldDark:'#b98a1c', lamp:'#ffe9a8', beacon:'#ff7a18',
  barn:'#b23a2c', siloC:'#cfc9b8', roof:'#2c333c', trunk:'#6b4a2c', leaf:'#3f8a28',
  stemY:'#7fb03c', stemD:'#a8a94a', headY:'#8fc04a', headR:'#e6bf52'
};

const app = document.getElementById('app'), fx = document.getElementById('fx');
const stageEl = document.getElementById('stage');
let SW = 1, SH = 1, SX = 0, SY = 0;      // rectangle de l'aire de jeu, en pixels écran
const scene = new THREE.Scene();
scene.background = new THREE.Color('#54a52e');

// ---------- caméra : même angle qu'avant, mais elle suit l'engin (le terrain ne tient plus à l'écran)
let PITCH = 50*Math.PI/180;   // inclinaison de la caméra, réglable à deux doigts
let VIEW = 34;      // hauteur de monde visible au point visé
// Caméra en perspective. En projection orthogonale, incliner la caméra ne changeait que
// l'écrasement du sol : les bâtiments et les engins gardaient la même taille au premier
// plan comme au fond, et rien ne fuyait. Une ouverture de 34° donne la fuite qu'on attend
// d'une vue inclinée, sans déformer les bords comme le ferait un grand angle.
const FOV = 34;
const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 400);
let camDist = 150;                      // reculée pour cadrer VIEW mètres au point visé
const camOff = new THREE.Vector3();
function applyPitch(){
  const h = camDist*Math.sin(PITCH), r = camDist*Math.cos(PITCH);
  camOff.set(Math.sin(YAW)*r, h, Math.cos(YAW)*r);
}
const camLook = new THREE.Vector3(0,1,0);   // point visé — recalé sur la cour au démarrage
// La carte se manipule au doigt : deux doigts la déplacent, l'écartement la zoome. Elle
// cesse alors de suivre l'engin — c'est voulu, on va regarder ailleurs — et une pastille
// permet de revenir dessus.
// La caméra ne suit plus personne : elle reste où on l'a laissée. Deux doigts la
// déplacent, l'écartement la zoome, la torsion la fait tourner autour de son point visé.
let YAW = 0;
function camFollow(){ const v = pilote(); if (v) camLook.set(v.pos.x, 1, v.pos.z); }
function camPan(dx, dz){
  camLook.x = Math.max(X0-60, Math.min(X0+P+60, camLook.x + dx));
  camLook.z = Math.max(Z0-90, Math.min(Z0+P+70, camLook.z + dz));
}
function setYaw(a){ YAW = a; applyPitch(); }
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);
let zoom = 1.25;                        // facteur de rapprochement, piloté à deux doigts
function applyCamera(){
  const a = SW/SH;
  VIEW = Math.max(26, Math.min(50, SH/10.5));
  VIEW = Math.min(VIEW, 86/a) / zoom;   // écran très large : on ne montre pas toute la ferme d'un coup
  // le recul se déduit du cadrage voulu : au point visé, on voit toujours VIEW mètres
  camDist = (VIEW/2) / Math.tan(FOV*Math.PI/360);
  camera.aspect = a;
  camera.near = Math.max(.5, camDist*.04);
  camera.far  = camDist + 320;
  camera.updateProjectionMatrix();
  applyPitch();
}
function resize(){
  const r = stageEl.getBoundingClientRect();
  SW = Math.max(1, Math.round(r.width)); SH = Math.max(1, Math.round(r.height));
  SX = r.left; SY = r.top;
  applyCamera(); renderer.setSize(SW, SH);
}
let _zTag = null, _zHide = 0;
function showTag(txt){
  if (!_zTag) _zTag = document.getElementById('zoomTag');
  _zTag.textContent = txt;
  _zTag.classList.add('on');
  clearTimeout(_zHide);
  _zHide = setTimeout(() => _zTag.classList.remove('on'), 900);
}
function setZoom(z){
  const nz = Math.max(.45, Math.min(3.2, z));
  if (Math.abs(nz - zoom) < 1e-4) return;
  zoom = nz; applyCamera();
  showTag('🔍 ×' + zoom.toFixed(2).replace('.', ','));
}
// balayage vertical à deux doigts : la caméra se redresse ou se couche vers l'horizon
function setPitch(rad){
  const np = Math.max(28*Math.PI/180, Math.min(85*Math.PI/180, rad));
  if (Math.abs(np - PITCH) < 1e-4) return;
  PITCH = np; applyPitch();
  showTag('📐 ' + Math.round(PITCH*180/Math.PI) + '°');
}
resize(); addEventListener('resize', resize);
// les bandeaux changent de hauteur (contrat affiché, manette masquée) : on suit la scène
if (window.ResizeObserver) new ResizeObserver(resize).observe(stageEl);

// ---------- les doigts ----------
// Tout passe par un seul gestionnaire, posé plus bas avec le reste des commandes. Deux
// jeux d'écouteurs sur le même élément se marchaient dessus : l'un capturait le premier
// doigt, l'autre attendait le second, et le pincement ne partait pas une fois sur deux.
// Ici on ne garde que le registre partagé et la molette.
const TOUCH = new Map();
const pinching = () => TOUCH.size >= 2;
stageEl.addEventListener('wheel', e => {       // à la souris, la molette fait le même office
  e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.12 : 1/1.12));
}, { passive:false });

const hemi = new THREE.HemisphereLight('#ffffff','#4e8a34',.88);   // lumière plate comme la réf
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff6de',.5);
const sunAt = new THREE.Vector3(0,0,0);      // le point que le soleil suit, en douceur
sun.castShadow = true; sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:110});
scene.add(sun, sun.target);

// ---------- matériaux ----------
// ---------- le filtre ----------
// Un voile de matière, deux fois plus discret que le premier essai : la couleur est un peu
// plus dense là où l'outil a repassé, un peu plus claire ailleurs, avec le grain du papier
// par-dessus. Les engins en reçoivent un peu plus, et un cran de saturation en prime pour
// qu'ils restent vifs devant le terrain.
const GOU_FN = `
  varying vec2 vGouP;
  float gouH(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
  float gouN(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(gouH(i), gouH(i+vec2(1.0,0.0)), u.x),
               mix(gouH(i+vec2(0.0,1.0)), gouH(i+vec2(1.0,1.0)), u.x), u.y);
  }`;
// monde : le motif est fixé au terrain, il ne glisse pas quand la caméra bouge.
// objet : le motif est peint sur la pièce, il la suit — c'est ce qu'il faut pour un engin.
function gouache(m, force, monde, vif){
  const a = (force === undefined ? 1 : force).toFixed(3);
  const sat = (vif === undefined ? 1 : vif).toFixed(3);
  const src = monde
    ? `#ifdef USE_INSTANCING
         vec4 gouW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
       #else
         vec4 gouW = modelMatrix * vec4(transformed, 1.0);
       #endif
       vGouP = gouW.xz + gouW.y*vec2(0.63,-0.47);`
    : `vGouP = position.xz + position.y*vec2(0.71,-0.53);`;
  return chainCompile(m, sh => {
    sh.vertexShader = 'varying vec2 vGouP;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n' + src);
    sh.fragmentShader = GOU_FN + '\n' + sh.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       {
         vec2 gp = vGouP * 1.15;
         float gl1 = gouN(gp*0.42), gl2 = gouN(gp*1.35), gl3 = gouN(gp*6.5);
         float lav = (gl1*0.5 + gl2*0.34 + gl3*0.16) - 0.5;
         diffuseColor.rgb *= 1.0 + lav * 0.34 * ${a};
         float dep = smoothstep(0.60, 0.95, gouN(gp*0.72 + 11.3));
         diffuseColor.rgb *= 1.0 - dep * 0.09 * ${a};
         float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
         diffuseColor.rgb = clamp(mix(vec3(lum), diffuseColor.rgb, ${sat}), 0.0, 1.0);
       }`);
  }, 'gou' + a + '/' + sat + '/' + (monde ? 'monde' : 'objet'));
}
// Un patch de shader peut en cacher un autre : on les enchaîne au lieu de les écraser.
// three range ses programmes compilés par le TEXTE de onBeforeCompile. Nos patchs enchaînés
// ont tous le même texte — celui de la fonction ci-dessous — si bien que deux matériaux aux
// réglages pourtant différents tombaient sur la même case et se repassaient le shader du
// premier arrivé. Chaque patch ajoute donc sa signature à celle du matériau.
function chainCompile(m, fn, cle){
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = s => { if (prev) prev(s); fn(s); };
  const base = m.__cle !== undefined ? m.__cle : (prev ? prev.toString() : '');
  const k = m.__cle = base + '|' + (cle || fn.toString());
  m.customProgramCacheKey = () => k;
  m.needsUpdate = true;
  return m;
}
const matS = {}, matJ = {}, geoC = {};
const UJ = { bend:{value:new THREE.Vector3()}, h:{value:4.5} };
let JELLY = false;
function jelly(m){
  m.onBeforeCompile = s => {
    s.uniforms.uBend = UJ.bend; s.uniforms.uJH = UJ.h;
    s.vertexShader = 'uniform vec3 uBend;uniform float uJH;\n' + s.vertexShader.replace(
      '#include <fog_vertex>',
      `#include <fog_vertex>
       vec4 jw = modelMatrix * vec4(transformed, 1.0);
       float jk = clamp(jw.y/uJH, 0.0, 1.0); jk *= jk;
       float tw = 0.72 + 0.5*sin(jw.x*.7 + jw.z*.45);
       gl_Position = projectionMatrix * viewMatrix * vec4(jw.xyz + uBend*jk*tw, 1.0);`);
  };
  return m;
}
function mat(c){
  const T = JELLY ? matJ : matS;
  if (T[c]) return T[c];
  const m = new THREE.MeshLambertMaterial({color:c});
  if (JELLY) jelly(m);
  return T[c] = gouache(m, .6, false, 1.16);   // peint sur la pièce, et un rien plus vif
}
function rrShape(w,h,r){
  const s = new THREE.Shape(), x=-w/2, y=-h/2;
  s.moveTo(x+r,y);
  s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y);
  return s;
}
const ROUND = .40;
function rboxGeo(w,h,d,r){
  r = Math.min(r, w/2.6, h/2.6, d/2.6);
  const k = [w,h,d,r].map(v=>v.toFixed(3)).join('|');
  if (geoC[k]) return geoC[k];
  const sw=w-2*r, sh=h-2*r;
  const g = new THREE.ExtrudeGeometry(rrShape(sw,sh,Math.min(r*1.4,Math.min(sw,sh)/2.3)),
    { depth:Math.max(.002,d-2*r), bevelEnabled:true, bevelThickness:r, bevelSize:r,
      bevelSegments:2, curveSegments:3, steps:1 });
  g.center();
  g.userData.shared = true;          // mise en cache : elle survit aux engins qui l'utilisent
  return geoC[k] = g;
}
function rbox(w,h,d,col,x,y,z,p,r){
  const m = new THREE.Mesh(rboxGeo(w,h,d,(r===undefined?.12:r)*ROUND), mat(col));
  m.position.set(x,y,z); m.castShadow = true; (p||scene).add(m); return m;
}
function cyl(rt,rb,h,s,col,x,y,z,p){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s), mat(col));
  m.position.set(x,y,z); m.castShadow = true; (p||scene).add(m); return m;
}
