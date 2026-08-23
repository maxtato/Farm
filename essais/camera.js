// La caméra suit l'engin au manche, et ne bouge pas quand on dessine ou qu'on double-tape.
const {chromium}=require('playwright');const serve=require('./srv');
(async()=>{
 const srv=await serve(8889);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:430,height:820},hasTouch:true});
 const err=[];
 p.on('pageerror',x=>err.push('[pageerror] '+x.message));
 await p.goto('http://localhost:8889/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:60000});
 await p.waitForTimeout(2500);
 const dit=(t,v)=>console.log(String(t).padEnd(38),JSON.stringify(v));

 // un tracteur et une déchaumeuse, attelés, au milieu du champ
 await p.evaluate(()=>{
   if(panelOpen())closePanel();
   coins=200000; acheterPorteur('tracteur',0); acheterOutil('sol',0);
   const v=engins[0], o=outils[0], ball=pointAttelage(v);
   v.pos.x+=o.x-ball.x; v.pos.z+=o.z-ball.z; v.h.position.set(v.pos.x,0,v.pos.z);
   raccrocher(v);
   const w=pilote(); w.pos.set(0,0,-6); w.h.position.set(0,0,-6);
   camLook.set(0,1,-6);
 });
 await p.waitForTimeout(1200);

 // --- au manche : on pousse, et on regarde si la caméra recolle à l'engin ---
 const suivi = await p.evaluate(async ()=>{
   setManual();
   const dodo=ms=>new Promise(r=>setTimeout(r,ms));
   const d0={ eng:[pilote().pos.x,pilote().pos.z], cam:[camLook.x,camLook.z] };
   jx=0; jy=-1; jmag=1;                       // plein nord, comme un doigt tenu sur le manche
   const suite=[];
   for(let i=0;i<10;i++){ await dodo(700);
     suite.push({ ecart:+Math.hypot(pilote().pos.x-camLook.x, pilote().pos.z-camLook.z).toFixed(2) }); }
   jmag=0; jx=0; jy=0;
   return { depart:d0, ecartFinal:suite[suite.length-1].ecart,
            ecartMax:Math.max(...suite.map(s=>s.ecart)),
            parcouru:+Math.hypot(pilote().pos.x-d0.eng[0], pilote().pos.z-d0.eng[1]).toFixed(1) };
 });
 dit('au manche : écart caméra ↔ engin', suivi);

 // --- manche relâché : la caméra ne doit plus bouger même si l'engin roule ---
 const lache = await p.evaluate(async ()=>{
   const dodo=ms=>new Promise(r=>setTimeout(r,ms));
   const c0=[camLook.x,camLook.z];
   pilote().speed=6;                          // il continue sur son erre
   await dodo(2500);
   return { bougeCamera:+Math.hypot(camLook.x-c0[0], camLook.z-c0[1]).toFixed(2) };
 });
 dit('manche lâché : la caméra bouge de', lache);

 // --- pendant un tracé au doigt : la caméra ne doit pas bouger non plus ---
 const trace = await p.evaluate(async ()=>{
   const dodo=ms=>new Promise(r=>setTimeout(r,ms));
   setAuto();
   const c0=[camLook.x,camLook.z];
   const el=document.getElementById('stage'), R=el.getBoundingClientRect();
   const mk=(x,y,t)=>el.dispatchEvent(new PointerEvent(t,{pointerId:9,clientX:x,clientY:y,
                                       bubbles:true,pointerType:'touch'}));
   mk(R.x+R.width*.5, R.y+R.height*.7,'pointerdown');
   for(let i=1;i<=14;i++){ mk(R.x+R.width*(.5+.02*i), R.y+R.height*(.7-.03*i),'pointermove');
                           await dodo(30); }
   mk(R.x+R.width*.78, R.y+R.height*.28,'pointerup');
   await dodo(2500);
   return { bougeCamera:+Math.hypot(camLook.x-c0[0], camLook.z-c0[1]).toFixed(2),
            points:__FARM_DEBUG().suivi ? __FARM_DEBUG().suivi.n : 0 };
 });
 dit('pendant un tracé : la caméra bouge de', trace);

 console.log(err.length?('\nERREURS :\n'+err.join('\n')):'\naucune erreur de page');
 await b.close(); srv.close();
})();
