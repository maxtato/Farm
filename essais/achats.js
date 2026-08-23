// Ce qu'on reçoit vraiment quand on achète : un tracteur seul, puis chaque outil seul.
const {chromium}=require('playwright');const serve=require('./srv');const fs=require('fs');
const D=__dirname+'/sorties/';
(async()=>{
 fs.mkdirSync(D,{recursive:true});
 const srv=await serve(8887);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:1100,height:980},hasTouch:true});
 p.on('pageerror',x=>console.log('[pageerror]',x.message));
 await p.goto('http://localhost:8887/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:60000});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{['top','bot'].forEach(k=>document.getElementById(k).style.opacity='0');
                       if(panelOpen())closePanel();});
 // la boutique sur une partie vierge : un seul article par famille
 console.log('boutique vierge :', await p.evaluate(()=>{
   openPanel('parc');
   return [...document.querySelectorAll('#body .card')].map(c =>
     c.querySelector('b').textContent + ' | ' + c.querySelector('button').textContent);
 }));
 await p.waitForTimeout(700);
 await p.screenshot({path:D+'achats-boutique.png'});
 await p.evaluate(()=>closePanel());
 console.log(await p.evaluate(()=>{
   coins=200000;
   acheterPorteur('tracteur',0);
   ['sol','semis','engrais','benne'].forEach(t=>acheterOutil(t,0));
   acheterPorteur('moiss',0); acheterPorteur('pulve',0); acheterSilo();
   camLook.set(GATE.x-6,1,YARD+18); zoom=.78; PITCH=42*Math.PI/180; YAW=.3;
   applyPitch(); applyCamera();
   return { engins:engins.map(v=>({k:v.kind, roues:v.g.userData.wheels.length,
                                   outil:v.outil, metier:v.metier})),
            outils:outils.map(o=>({t:o.type, pose:!o.porteur})) };
 }));
 await p.waitForTimeout(4200);
 await p.screenshot({path:D+'achats-cour.png'});
 console.log('-> achats-cour.png');
 console.log('boutique après achats :', await p.evaluate(()=>{
   openPanel('parc');
   return [...document.querySelectorAll('#body .card')].map(c =>
     c.querySelector('b').textContent + ' | ' + c.querySelector('button').textContent);
 }));
 await p.waitForTimeout(800);
 await p.screenshot({path:D+'achats-parc.png'});
 console.log('silo amélioré :', await p.evaluate(()=>{
   const r=ameliorerSilo();
   return { paye:r, niveau:siloNiv, depots:DEPOTS.length, prime:primeSilos() };
 }));
 await b.close(); srv.close();
})();
