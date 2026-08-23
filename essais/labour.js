// Un seul chantier — le labour — mais à vitesse normale, et on mesure ce qui est vraiment
// travaillé. C'est la seule façon honnête de juger le jeu sur cette machine : accéléré,
// le pas de temps devient si gros que l'engin ne sait plus tenir sa ligne, et on mesure
// alors le banc d'essai, pas le jeu.
const {chromium}=require('playwright');const fs=require('fs');const serve=require('./srv');
const D=__dirname+'/sorties/', LOG=D+'labour.log';
(async()=>{
 fs.mkdirSync(D,{recursive:true}); fs.writeFileSync(LOG,'');
 const dit=(...a)=>fs.appendFileSync(LOG,a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')+'\n');
 const srv=await serve(8891);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:900,height:760}});
 p.on('pageerror',x=>dit('[pageerror]',x.message));
 await p.goto('http://localhost:8891/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:90000});
 await p.waitForTimeout(2500);
 const dep = await p.evaluate(()=>{
   if (panelOpen()) closePanel();
   SND.set(false); coins = 400000;
   const v = acheterPorteur('tracteur',2), o = acheterOutil('sol',2), ball = pointAttelage(v);
   v.pos.x += o.x-ball.x; v.pos.z += o.z-ball.z; v.h.position.set(v.pos.x,0,v.pos.z);
   raccrocher(v);
   // on part du bord du champ : le trajet depuis la cour n'est pas l'objet de l'essai
   v.pos.set(X0+P/2, 0, Z0+P*.5); v.h.position.set(v.pos.x,0,v.pos.z);
   setAuto();
   ['top','bot'].forEach(k=>document.getElementById(k).style.opacity='0');
   camLook.set(X0+P/2,1,Z0+P/2); zoom=.62; PITCH=70*Math.PI/180; applyPitch(); applyCamera();
   return { rangs:lanesFor(6.8).length/2, NIN, P:+P.toFixed(1) };
 });
 dit('départ :', dep);
 const part = () => p.evaluate(()=>{
   let n=0; for(let i=0;i<cell.length;i++) if (MASQ[i]>0 && cell[i]===1) n++;
   const w = engins[0];
   return { fait:+(100*n/NIN).toFixed(1), rang:w.laneI, rangs:w.lanes?w.lanes.length:0,
            fini:!!w.done, etape:STAGES[stage].n, frotte:+(w.frotte||0).toFixed(1) };
 });
 let d = null, calme = 0;
 for(let t=0; t<1500; t++){
   d = await part();
   if (t % 60 === 0) dit('  t=' + t, d);
   if (d.fini || d.etape !== 'Préparer'){ dit('CHANTIER FINI à t=' + t, d); break; }
   await p.waitForTimeout(1000);
 }
 await p.screenshot({path:D+'labour.png'}); dit('-> labour.png');
 dit('fin :', d);
 dit(d && d.fait >= 92 ? 'OK : le champ est labouré à ' + d.fait + ' %'
                       : 'ÉCHEC : ' + (d?d.fait:'?') + ' % seulement');
 await b.close(); srv.close();
})();
