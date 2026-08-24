// D'où vient la charge. Trois relevés : ce qui part à la carte graphique (appels, triangles,
// objets), le coût en millisecondes de chaque poste du jeu, et l'écart entre beau temps et
// pluie. La machine d'essai n'a pas de carte graphique : les millisecondes de RENDU n'ont
// donc aucune valeur absolue. Les comptes d'objets, eux, sont les mêmes partout, et ce sont
// eux qui décident de la fluidité sur un téléphone.
const {chromium}=require('playwright');const fs=require('fs');const serve=require('./srv');
const D=__dirname+'/sorties/', LOG=D+'poids.log';
(async()=>{
 fs.mkdirSync(D,{recursive:true}); fs.writeFileSync(LOG,'');
 const dit=(...a)=>fs.appendFileSync(LOG,a.map(x=>typeof x==='string'?x:JSON.stringify(x,null,1)).join(' ')+'\n');
 const srv=await serve(8888);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:430,height:820},hasTouch:true});
 p.on('pageerror',x=>dit('[pageerror]',x.message));
 await p.goto('http://localhost:8888/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:90000});
 await p.waitForTimeout(3000);

 dit('--- ce que la scène contient ---');
 dit(await p.evaluate(()=>{
   const par = {}, mat = new Set(), geo = new Set();
   let mesh=0, inst=0, instN=0, tri=0, objets=0;
   const triDe = g => { if(!g||!g.attributes||!g.attributes.position) return 0;
     return (g.index ? g.index.count : g.attributes.position.count)/3; };
   scene.traverse(o=>{
     objets++;
     if(!o.isMesh) return;
     const n = o.isInstancedMesh ? o.count : 1;
     if(o.isInstancedMesh){ inst++; instN += o.count; } else mesh++;
     tri += triDe(o.geometry)*n;
     mat.add(o.material.uuid); geo.add(o.geometry.uuid);
     const cle = o.name || (o.isInstancedMesh ? 'instancié' : 'maillage') ;
     par[cle] = (par[cle]||0) + 1;
   });
   const i = renderer.info;
   return { objets, maillagesSimples:mesh, maillagesInstanciés:inst, instances:instN,
            triangles:Math.round(tri), matériaux:mat.size, géométries:geo.size,
            rendu:{ appels:i.render.calls, triangles:i.render.triangles,
                    programmes:i.programs?i.programs.length:-1,
                    texturesEnMémoire:i.memory.textures, géométriesEnMémoire:i.memory.geometries } };
 }));

 dit('--- qui fait les appels de dessin : les cinquante plus gros postes ---');
 dit(await p.evaluate(()=>{
   // on remonte chaque maillage à son ancêtre nommé le plus proche, sinon à sa géométrie
   const par = {};
   const triDe = g => (g&&g.attributes&&g.attributes.position)
     ? (g.index ? g.index.count : g.attributes.position.count)/3 : 0;
   scene.traverse(o=>{
     if(!o.isMesh) return;
     let e = o, nom = null;
     while(e && !nom){ if(e.userData && e.userData.quoi) nom = e.userData.quoi; e = e.parent; }
     if(!nom) nom = o.material.name || ('geo:' + Math.round(triDe(o.geometry)) + 'tri');
     const n = o.isInstancedMesh ? o.count : 1;
     const q = par[nom] || (par[nom] = { appels:0, tri:0 });
     q.appels++; q.tri += Math.round(triDe(o.geometry)*n);
   });
   return Object.entries(par).sort((a,b)=>b[1].appels-a[1].appels).slice(0,50)
     .map(([k,v])=>k+' : '+v.appels+' appels, '+v.tri+' tri');
 }));

 // ---- chronométrage des postes, beau temps puis pluie ----
 const mesure = async (nom, pluie) => {
   await p.evaluate(r=>{ curRain = r; W_FORCE = r; }, pluie);
   await p.waitForTimeout(1500);
   const t = await p.evaluate(async (r)=>{
     curRain = r;
     const chrono = f => { const a=performance.now(); f(); return performance.now()-a; };
     const N = 12, o = { rendu:0, pluie:0, plantes:0, boucle:0 };
     for(let k=0;k<N;k++){
       o.pluie  += chrono(()=>RAIN.update(.016, r, camLook.x, camLook.z));
       o.rendu  += chrono(()=>renderer.render(scene, camera));
       await new Promise(q=>requestAnimationFrame(q));
     }
     const i = renderer.info;
     return { parImage:{ pluie:+(o.pluie/N).toFixed(2), rendu:+(o.rendu/N).toFixed(1) },
              appels:i.render.calls, triangles:i.render.triangles };
   }, pluie);
   dit(nom, t);
 };
 dit('--- coût par image (le RENDU est celui du logiciel, sans carte graphique) ---');
 await mesure('beau temps :', 0);
 await mesure('pluie      :', 1);

 // ---- attribution ----
 // Deux précautions. La boucle du jeu continue de rendre entre deux mesures : on coupe donc
 // la remise à zéro automatique des compteurs, et on enchaîne les rendus sans rendre la
 // main, sinon on mesure les images du jeu autant que les siennes. Et on mesure le champ
 // couvert de blé mûr : c'est là que le jeu est le plus lourd, pas sur une terre nue.
 const mesurer = (quoi) => p.evaluate(q=>{
   const vus = [];
   if (q) scene.traverse(o=>{ if(o.userData && o.userData.quoi === q && o.visible){ o.visible=false; vus.push(o); } });
   renderer.info.autoReset = false;
   renderer.info.reset();
   const N = 10, a = performance.now();
   for(let k=0;k<N;k++) renderer.render(scene, camera);
   const ms = (performance.now()-a)/N;
   const i = renderer.info;
   const out = { objets:vus.length, rendu:+ms.toFixed(1),
                 appels:Math.round(i.render.calls/N), triangles:Math.round(i.render.triangles/N) };
   renderer.info.autoReset = true;
   vus.forEach(o=>o.visible=true);
   return out;
 }, quoi);

 for(const [nom, etat] of [['terre nue', 0], ['blé mûr', 1]]){
   await p.evaluate(m=>{
     curRain = 0;
     if (m){ for(let k=0;k<plants.length;k++){ plants[k].g = 1; plants[k].r = 0; } redrawPlants(); }
   }, etat);
   await p.waitForTimeout(1200);
   dit('');
   dit('=== ' + nom + ' ===');
   dit('tout allumé :', await mesurer(null));
   for(const q of ['culture','paille','arbre','batiment','champ','route','sable','herbe'])
     dit('sans ' + q.padEnd(9), await mesurer(q));
 }
 await b.close(); srv.close();
})();
