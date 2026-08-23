// Le tour complet : labour, semis, engrais, moisson, puis la benne qui vide au silo.
// C'est l'essai qui dit si la ferme reste jouable après un déménagement — les engins
// doivent traverser la cour, la route et retrouver le dépôt sans se coincer.
const {chromium}=require('playwright');const fs=require('fs');const serve=require('./srv');
const D=__dirname+'/sorties/', LOG=D+'cycle.log';
(async()=>{
 fs.mkdirSync(D,{recursive:true}); fs.writeFileSync(LOG,'');
 const dit=(...a)=>fs.appendFileSync(LOG,a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')+'\n');
 const srv=await serve(8894);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:430,height:820},hasTouch:true});
 p.on('pageerror',x=>dit('[pageerror]',x.message));
 await p.goto('http://localhost:8894/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:90000});
 await p.waitForTimeout(2500);
 // de quoi faire le tour : un tracteur par métier, une moissonneuse, une benne
 dit('achats :', await p.evaluate(()=>{
   if (panelOpen()) closePanel();
   SND.set(false); coins = 400000;
   const att = (t) => { const v = acheterPorteur('tracteur',2), o = acheterOutil(t,2);
     const ball = pointAttelage(v);
     v.pos.x += o.x-ball.x; v.pos.z += o.z-ball.z; v.h.position.set(v.pos.x,0,v.pos.z);
     raccrocher(v); return v.pid; };
   const ids = { sol:att('sol'), semis:att('semis'), engrais:att('engrais'), benne:att('benne') };
   ids.moiss = acheterPorteur('moiss',2).pid;
   setAuto();                                  // pilote automatique
   setSpeed(6);                                // la machine d'essai est lente : on la compense
   return { engins:engins.length, outils:outils.length, ids };
 }));
 // Compter le temps de jeu écoulé, pas le temps réel : sur cette machine sans carte
 // graphique une seconde de jeu en coûte trois, et un tour complet fait dix minutes de jeu.
 const etapes = [];
 let dernier = -1, fini = false;
 for(let t=0; t<2400; t++){
   const d = await p.evaluate(()=>{ const q = window.__FARM_DEBUG();
     return { stage:q.stage, etape:q.etape, cell:q.cellules, coins:q.coins, stock:q.stock,
              hop:q.hop, moissons:q.harvests, jour:q.jour }; });
   if (d.stage !== dernier){ dernier = d.stage; etapes.push({ t:+(t*0.6).toFixed(0), ...d }); dit('->', d); }
   if (d.moissons >= 1){ dit('RÉCOLTE LIVRÉE', d); fini = true; break; }
   if (t % 120 === 0) dit('   t=' + t, d);
   await p.waitForTimeout(1000);
 }
 if (!fini) dit('BUDGET ÉPUISÉ : 2400 relevés sans livraison');
 const fin = await p.evaluate(()=>{ const q = window.__FARM_DEBUG();
   return { coins:q.coins, stock:q.stock, moissons:q.harvests, cellules:q.cellules,
            bloques:engins.filter(v=>v.frotte>4).map(v=>v.pid) }; });
 dit('fin :', fin);
 dit(fin.moissons >= 1 ? 'OK : le tour complet passe'
                       : 'ÉCHEC : la récolte n\'est pas arrivée au silo');
 await b.close(); srv.close();
})();
