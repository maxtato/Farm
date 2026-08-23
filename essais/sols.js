// Qui est posé sur quoi. La carte a des places de sable sous ses bâtiments, de la terre
// partout ailleurs et de l'herbe seulement là où il y a des arbres : cet essai vérifie
// qu'aucun bâtiment ne se retrouve dans l'herbe ou en plein champ, et que le parc, les
// outils au sol et le silo du joueur tombent bien sur la cour.
const {chromium}=require('playwright');const fs=require('fs');const serve=require('./srv');
const D=__dirname+'/sorties/', LOG=D+'sols.log';
(async()=>{
 fs.mkdirSync(D,{recursive:true}); fs.writeFileSync(LOG,'');
 const dit=s=>fs.appendFileSync(LOG,s+'\n');
 const srv=await serve(8896);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:800,height:600}});
 p.on('pageerror',x=>dit('[pageerror] '+x.message));
 await p.goto('http://localhost:8896/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:90000});
 await p.waitForTimeout(2000);
 const r = await p.evaluate(()=>{
   const surTerre = (x,z) => parcelles.some(q => dedansPoly(q,x,z));
   const surSable = (x,z) => SABLES.some(q => dedansPoly(q,x,z));
   const bats = BATIMENTS.map(([f,x,z]) => ({ f, x:+x.toFixed(0), z:+z.toFixed(0),
                                              sable:surSable(x,z), terre:surTerre(x,z) }));
   const places = [];
   for(let n=0;n<16;n++){ const q = placeParc(n);  places.push(['engin '+n, q.x, q.z]); }
   for(let n=0;n<8; n++){ const q = placeOutil(n); places.push(['outil '+n, q.x, q.z]); }
   SILOS.forEach((S,i) => places.push(['silo '+i, S.x, S.z]));
   return {
     champs: parcelles.length, sables: SABLES.length, batiments: bats.length,
     batHorsSable: bats.filter(q => !q.sable),
     batEnPleinChamp: bats.filter(q => q.terre),
     placesHorsCour: places.filter(([n,x,z]) => !surSable(x,z)).map(([n,x,z]) => n),
     terreSurParcelle: surTerre(X0+P/2, Z0+P/2),
     terreSurCour: surTerre((COUR.x0+COUR.x1)/2, (COUR.z0+COUR.z1)/2)
   };
 });
 dit(JSON.stringify(r,null,1));
 const ko = r.batHorsSable.length + r.batEnPleinChamp.length + r.placesHorsCour.length
          + (r.terreSurParcelle?1:0) + (r.terreSurCour?1:0);
 dit(ko ? 'ÉCHEC : ' + ko + ' élément(s) mal posé(s)' : 'OK : tout est sur le bon sol');
 await b.close(); srv.close();
})();
