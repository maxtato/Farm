// Planche des engins : les trois tracteurs avec leurs outils, et les trois bennes.
// On range la flotte en ligne dans la cour, on vise la caméra dessus, et on photographie.
const {chromium}=require('playwright');const serve=require('./srv');const fs=require('fs');
const D=__dirname+'/sorties/';
(async()=>{
 fs.mkdirSync(D,{recursive:true});
 const srv=await serve(8899);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:1100,height:980},hasTouch:true});
 p.on('pageerror',x=>console.log('[pageerror]',x.message));
 await p.goto('http://localhost:8899/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:60000});
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{['top','bot'].forEach(k=>document.getElementById(k).style.opacity='0'); if (panelOpen()) closePanel();});

 const pose = async (nom, prep) => {
   await p.evaluate(prep);
   await p.waitForTimeout(3500);                       // 1,3 image/s : il faut laisser rendre
   await p.screenshot({path:D+nom});
   console.log('->',nom);
 };
 // Les trois attelages, un niveau par image
 for(const [i,nom] of [[0,'compact'],[1,'standard'],[2,'gros']]){
   await pose('engins-'+nom+'.png', new Function('', `
     coins=99999; nivTr=${i}; applyUpgrades(); rebuildTracteurs();
     ['prep','sow','trailer'].forEach(fleetGet);
     ['fert','harvest'].forEach(k=>{if(fleet[k])fleet[k].h.visible=false;});
     ['prep','sow','trailer'].forEach(k=>{if(fleet[k])fleet[k].h.visible=true;});
     [['prep',-13],['sow',1],['trailer',15]].forEach(([k,x])=>{
       const v=fleet[k];v.pos.set(x,0,YARD+13);v.heading=Math.PI*.5;
       v.h.position.set(v.pos.x,0,v.pos.z);v.h.rotation.y=v.heading;});
     camLook.set(0,1,YARD+13);                        // la caméra reste où on la pose
     zoom=1.25; PITCH=40*Math.PI/180; YAW=.32; applyPitch(); applyCamera();`));
 }
 // Le pulvérisateur et la moissonneuse, un niveau par image
 for(const [i,nom] of [[0,'compact'],[1,'standard'],[2,'gros']]){
   await pose('engins-recolte-'+nom+'.png', new Function('', `
     coins=99999; nivTr=${i}; applyUpgrades(); rebuildTracteurs();
     ['fert','harvest'].forEach(fleetGet);
     ['prep','sow','trailer'].forEach(k=>{if(fleet[k])fleet[k].h.visible=false;});
     ['fert','harvest'].forEach(k=>{if(fleet[k])fleet[k].h.visible=true;});
     [['fert',-11],['harvest',7]].forEach(([k,x])=>{
       const v=fleet[k];v.pos.set(x,0,YARD+13);v.heading=Math.PI*.5;
       v.h.position.set(v.pos.x,0,v.pos.z);v.h.rotation.y=v.heading;});
     if (fleet.harvest) fleet.harvest.g.userData.auger.rotation.y = 0;   // vis déployée
     camLook.set(-2,1,YARD+13);
     zoom=1.25; PITCH=40*Math.PI/180; YAW=.32; applyPitch(); applyCamera();`));
 }
 // Les trois bennes côte à côte, posées au sol
 await pose('engins-bennes.png', () => {
   bennesPosees.slice().forEach(r=>{retirerObst(r);scene.remove(r.obj);libere(r.obj);});
   bennesPosees.length=0;
   nivTr=2; benneAtt=null; applyUpgrades(); rebuildTracteurs();
   ['fert','harvest','prep','sow'].forEach(k=>{if(fleet[k])fleet[k].h.visible=false;});
   [['b8',-14],['b14',-1],['b22',14]].forEach(([id,x])=>{
     bennesOwned[id]=true; poserBenne({id,hop:0,x,z:YARD+13,ang:Math.PI*.5});});
   const v=fleet.trailer; v.pos.set(0,0,YARD+22); v.heading=Math.PI*.5;
   v.h.position.set(v.pos.x,0,v.pos.z); v.h.rotation.y=v.heading;
   camLook.set(0,1,YARD+15);
   zoom=1.25; PITCH=40*Math.PI/180; YAW=.32; applyPitch(); applyCamera();
 });
 await b.close(); srv.close();
})();
