// La campagne vue de haut, puis de près : le tracé du générateur, les sols et l'herbe du jeu.
const {chromium}=require('playwright');const fs=require('fs');const serve=require('./srv');
const D=__dirname+'/sorties/';
const LOG=D+'carte.log'; 
(async()=>{
 fs.mkdirSync(D,{recursive:true}); fs.writeFileSync(LOG,'');
 const dit=(...a)=>fs.appendFileSync(LOG,a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')+'\n');
 const srv=await serve(8898);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:1100,height:980}});
 p.on('pageerror',x=>dit('[pageerror]',x.message));
 await p.goto('http://localhost:8898/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:90000});
 await p.waitForTimeout(3000);
 await p.evaluate(()=>{['top','bot'].forEach(k=>document.getElementById(k).style.opacity='0');
                       if(panelOpen())closePanel();});
 dit('carte :', await p.evaluate(()=>({ parcelles:parcelles.length, obstacles:OBST.length,
                                        batiments:BATIMENTS.length, arbres:ARBRES.length,
                                        tri:__FARM_DEBUG().tri, appels:__FARM_DEBUG().appels })));
 const vue = async (nom, z, pi, cx, cz) => {
   await p.evaluate(q=>{ camLook.set(q[2],1,q[3]); zoom=q[0]; PITCH=q[1]*Math.PI/180;
                         applyPitch(); applyCamera(); }, [z,pi,cx,cz]);
   await p.waitForTimeout(5000);
   await p.screenshot({path:D+nom}); dit('->',nom);
 };
 await vue('carte-vue.png', .14, 62, 0, 0);              // toute la campagne
 await vue('carte-ferme.png', .5, 44, -95, -60);         // le corps de ferme et son hangar
 await vue('carte-pres.png', 1.0, 40, -108, -69);        // le hangar de départ, de près
 await b.close(); srv.close();
})();
