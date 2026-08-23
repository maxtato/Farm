// Le parc : trois tracteurs, trois bennes, décrochage et réattelage.
// On pilote le jeu par ses propres fonctions plutôt que par l'écran — une seconde de jeu
// coûte dix secondes réelles sur cette machine, on ne conduit donc pas jusqu'à la benne.
const {chromium}=require('playwright');const serve=require('./srv');const fs=require('fs');
const D=__dirname+'/sorties/';
(async()=>{
 fs.mkdirSync(D,{recursive:true});
 const srv=await serve(8879);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:430,height:820},hasTouch:true});
 const err=[];
 p.on('pageerror',x=>err.push('[pageerror] '+x.message+'\n'+(x.stack||'').split('\n').slice(0,3).join('\n')));
 p.on('console',m=>{if(m.type()==='error')err.push('[console] '+m.text().slice(0,300));});
 await p.goto('http://localhost:8879/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:60000});
 await p.waitForTimeout(2500);
 const dit=(t,v)=>console.log(String(t).padEnd(34),JSON.stringify(v));

 const d0=await p.evaluate(()=>{const d=window.__FARM_DEBUG();
   return {niv:d.nivTr,benne:d.benneAtt,posees:d.posees,trCap:d.trCapMax,
           largPrep:fleet.prep?fleet.prep.g.userData.tool.W:null};});
 dit('départ',d0);

 // --- niveau 1 : tracteur standard ---
 const d1=await p.evaluate(()=>{coins=40000;nivTr=1;applyUpgrades();rebuildTracteurs();
   fleetGet('prep');fleetGet('sow');fleetGet('trailer');
   return {prep:fleet.prep.g.userData.tool.W, sow:fleet.sow.g.userData.tool.W,
           corps:fleet.trailer.corps, rad:fleet.trailer.rad};});
 dit('standard : largeurs, gabarit',d1);
 // --- niveau 2 ---
 const d2=await p.evaluate(()=>{nivTr=2;applyUpgrades();rebuildTracteurs();
   return {prep:fleet.prep.g.userData.tool.W, sow:fleet.sow.g.userData.tool.W};});
 dit('grande puissance : largeurs',d2);

 // --- achat des deux bennes, elles arrivent au parc ---
 const d3=await p.evaluate(()=>{['b14','b22'].forEach(id=>{bennesOwned[id]=true;livrerBenne(id);});
   return {posees:__FARM_DEBUG().posees, obst:OBST.length};});
 dit('deux bennes livrées',d3);

 // --- décrochage sur place ---
 const d4=await p.evaluate(()=>{driven='trailer';syncFleet();fleet.trailer.hop=900;
   const n=decrocher();
   return {nom:n, benne:__FARM_DEBUG().benneAtt, trCap:TRCAP, hop:fleet.trailer.hop,
           posees:__FARM_DEBUG().posees, corps:fleet.trailer.corps};});
 dit('décroché',d4);

 // --- on amène la boule sur la 22 m³ et on rattelle ---
 const d5=await p.evaluate(()=>{
   const r=bennesPosees.find(x=>x.id==='b22');
   const v=fleet.trailer, ball=pointAttelage(v);
   v.pos.x += r.x-ball.x; v.pos.z += r.z-ball.z;      // la boule pile sur l'attache
   v.h.position.set(v.pos.x,0,v.pos.z);
   const n=raccrocher();
   return {nom:n, benne:__FARM_DEBUG().benneAtt, trCap:TRCAP,
           posees:__FARM_DEBUG().posees, corps:fleet.trailer.corps, obst:OBST.length};});
 dit('rattelé 22 m³',d5);

 // --- une benne trop lourde pour un compact reste à terre ---
 const d6=await p.evaluate(()=>{decrocher();nivTr=0;applyUpgrades();rebuildTracteurs();
   const r=bennesPosees.find(x=>x.id==='b22');
   const v=fleet.trailer, ball=pointAttelage(v);
   v.pos.x += r.x-ball.x; v.pos.z += r.z-ball.z; v.h.position.set(v.pos.x,0,v.pos.z);
   return {tenté:raccrocher(), benne:__FARM_DEBUG().benneAtt};});
 dit('compact + 22 m³ (doit refuser)',d6);

 // --- sauvegarde et relecture ---
 const d7=await p.evaluate(()=>{nivTr=2;applyUpgrades();rebuildTracteurs();
   const r=bennesPosees.find(x=>x.id==='b22');
   const v=fleet.trailer, ball=pointAttelage(v);
   v.pos.x += r.x-ball.x; v.pos.z += r.z-ball.z; v.h.position.set(v.pos.x,0,v.pos.z);
   raccrocher(); fleet.trailer.hop=2000; save();
   return JSON.parse(localStorage.getItem('ferme.cycle.v1'));});
 dit('sauvegarde',{niv:d7.nivTr,benneAtt:d7.benneAtt,bennes:d7.bennes,posees:d7.posees});

 await p.reload({waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:60000});
 await p.waitForTimeout(2500);
 const d8=await p.evaluate(()=>{const d=__FARM_DEBUG();
   return {niv:d.nivTr,benne:d.benneAtt,posees:d.posees,trCap:d.trCapMax,obst:OBST.length};});
 dit('après rechargement',d8);

 // --- l'onglet Parc s'ouvre et se dessine ---
 const d9=await p.evaluate(()=>{openPanel('parc');
   return document.querySelectorAll('#body .card').length;});
 dit('cartes dans l’onglet Parc',d9);
 await p.waitForTimeout(900);
 await p.screenshot({path:D+'parc-onglet.png'});
 await p.evaluate(()=>closePanel());

 console.log(err.length?('\nERREURS :\n'+err.join('\n')):'\naucune erreur de page');
 await b.close(); srv.close();
})();
