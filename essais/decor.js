// Le décor : le hameau au bord de la parcelle, les deux silos, et les états du sol.
const {chromium}=require('playwright');const serve=require('./srv');const fs=require('fs');
const D=__dirname+'/sorties/';
(async()=>{
 fs.mkdirSync(D,{recursive:true});
 const srv=await serve(8891);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:1100,height:980},hasTouch:true});
 p.on('pageerror',x=>console.log('[pageerror]',x.message));
 await p.goto('http://localhost:8891/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:60000});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{['top','bot'].forEach(k=>document.getElementById(k).style.opacity='0');
                       if(panelOpen())closePanel();});
 const pose = async (nom, prep, z, pi) => {
   await p.evaluate(prep);
   await p.evaluate(q=>{ zoom=q[0]; PITCH=q[1]*Math.PI/180; YAW=q[2]; applyPitch(); applyCamera(); },
                    [z, pi, .32]);
   await p.waitForTimeout(3800);
   await p.screenshot({path:D+nom});
   console.log('->',nom);
 };
 await pose('decor-friche.png', ()=>{ camLook.set(0,1,-6); }, 1.0, 44);
 await pose('decor-hameau.png', ()=>{ camLook.set(-26,1,YARD+5); }, 1.15, 40);
 await pose('decor-silos.png', ()=>{
   coins=99999; acheterSilo('petit'); acheterSilo('grand');
   camLook.set(24,1,YARD+3); }, 1.05, 40);
 await pose('decor-moissonne.png', ()=>{
   vierge=false; switchTo(0); primeField(0); camLook.set(0,1,-6); }, 1.0, 44);
 await pose('decor-laboure.png', ()=>{
   switchTo(1); primeField(1); camLook.set(0,1,-6); }, 1.0, 44);
 await pose('decor-seme.png', ()=>{
   switchTo(2); primeField(2); camLook.set(0,1,-6); }, 1.0, 44);
 console.log(await p.evaluate(()=>{const d=__FARM_DEBUG();
   return {obstacles:d.obstacles, cellules:d.cellules, tri:d.tri, appels:d.appels};}));
 await b.close(); srv.close();
})();
