// Le parc : terrain nu au départ, tout s'achète, et la sauvegarde retient ce qu'on possède.
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
 const dit=(t,v)=>console.log(String(t).padEnd(36),JSON.stringify(v));

 dit('terrain nu', await p.evaluate(()=>({
   sous:coins, niv:__FARM_DEBUG().niv, flotte:__FARM_DEBUG().flotte.length,
   bennes:Object.assign({},bennesOwned), attelee:benneAtt, trCap:TRCAP,
   bouton:document.getElementById('vehBtn').textContent })));

 // --- la chaîne minimale : déchaumeuse, semoir, moissonneuse, transport, benne ---
 dit('chaîne minimale', await p.evaluate(()=>{
   const pris=[]; let reste=coins;
   [['prep',0],['sow',0],['harvest',0],['trailer',0]].forEach(([k,i])=>{
     const r=acheterEngin(k,i); pris.push([k, r?r.net:null]); });
   coins-=BENNES[0].prix; bennesOwned.b8=true; livrerBenne('b8');
   return { pris, depense:reste-coins, reste:coins,
            flotte:__FARM_DEBUG().flotte.map(f=>f.k), posees:bennesPosees.length };
 }));

 // --- on attelle la benne et on vérifie la capacité ---
 dit('attelage', await p.evaluate(()=>{
   driven='trailer'; syncFleet();
   const r=bennesPosees[0], v=fleet.trailer, ball=pointAttelage(v);
   v.pos.x+=r.x-ball.x; v.pos.z+=r.z-ball.z; v.h.position.set(v.pos.x,0,v.pos.z);
   const n=raccrocher();
   return { nom:n, trCap:TRCAP, benne:benneAtt };
 }));

 // --- reprise : acheter mieux rend la moitié de l'ancienne ---
 dit('reprise du semoir', await p.evaluate(()=>{
   coins=40000; const avant=coins, r=acheterEngin('sow',2);
   return { paye:r&&r.net, reprise:r&&r.reprise, niveau:nivDe.sow,
            largeur:fleet.sow.g.userData.tool.W, debit:avant-coins };
 }));

 // --- une benne trop lourde pour le tracteur de transport reste en vente barrée ---
 dit('22 m³ avec transport compact', await p.evaluate(()=>({
   compatible:benneCompatible(benneDef('b22')), nivTransport:nivDe.trailer })));
 dit('après transport grande puissance', await p.evaluate(()=>{
   acheterEngin('trailer',2);
   return { compatible:benneCompatible(benneDef('b22')), nivTransport:nivDe.trailer };
 }));

 // --- sauvegarde et relecture ---
 const sv = await p.evaluate(()=>{ save();
   return JSON.parse(localStorage.getItem('ferme.cycle.v1')); });
 dit('sauvegarde', {niv:sv.niv, bennes:sv.bennes, benneAtt:sv.benneAtt, posees:sv.posees.length});
 await p.reload({waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:60000});
 await p.waitForTimeout(2500);
 dit('après rechargement', await p.evaluate(()=>({
   niv:__FARM_DEBUG().niv, flotte:__FARM_DEBUG().flotte.map(f=>f.k),
   trCap:TRCAP, posees:bennesPosees.length })));

 const n = await p.evaluate(()=>{openPanel('parc');
   return document.querySelectorAll('#body .card').length;});
 dit('cartes dans l’onglet Parc', n);
 await p.waitForTimeout(900);
 await p.screenshot({path:D+'parc-onglet.png'});
 await p.evaluate(()=>closePanel());

 console.log(err.length?('\nERREURS :\n'+err.join('\n')):'\naucune erreur de page');
 await b.close(); srv.close();
})();
