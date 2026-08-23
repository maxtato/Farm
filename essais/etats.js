const {chromium}=require('playwright');
const serve=require('./srv');
const OUT=__dirname+'/sorties/', PORT=8875;
(async()=>{
 require('fs').mkdirSync(__dirname+'/sorties',{recursive:true});
 const srv=await serve(PORT);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const e=[];
 async function vue(nom, stage, z, travail, engin){
   const p=await b.newPage({viewport:{width:430,height:820},hasTouch:true});
   p.on('pageerror',x=>{e.push(nom+': '+x.message); console.log('  [ERR]',nom,x.message);}); p.setDefaultTimeout(120000);
   await p.addInitScript(s=>localStorage.setItem('ferme.cycle.v1',JSON.stringify(s)),
     {v:1,coins:9000,stock:0,totalT:0,harvests:1,lv:{tremie:0,semence:0,negoce:0},
      owned:{ble:true},cropI:0,stage:stage||0,day:2,dayT:0.40,contract:null,son:false,
      ctrl:'manche',conduit:engin||'prep',vue:{z,p:0.8727,v:2}});
   await p.goto('http://localhost:'+PORT+'/',{waitUntil:'load'});
   await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:90000});
   await p.waitForTimeout(2500);
   await p.evaluate(()=>{const b=document.getElementById('sheetX'); if(b) b.click();});
   await p.waitForTimeout(600);
   if(travail){ if(await p.evaluate(()=>window.__FARM_DEBUG()&&window.__FARM_DEBUG().manuel))
       await p.evaluate(()=>document.getElementById('btnAuto').click());
     await p.waitForTimeout(travail); }
   // on recentre pendant qu'il travaille : il est en plein champ
   await p.evaluate(()=>document.getElementById('btnCam').click());
   await p.waitForTimeout(500);
   const d=await p.evaluate(()=>window.__FARM_DEBUG());
   console.log(nom.padEnd(12),'| etape',(d.etape||'').padEnd(9),'| triangles',d.tri,'| appels',d.appels);
   await p.screenshot({path:OUT+'e-'+nom+'.png'});
   await p.close();
 }
 await vue('herbe-jeu',   null, 1.25, 0);
 await vue('herbe-pres',  null, 2.4,  0);
 await vue('herbe-large', null, 0.62, 0);
 console.log('ERREURS :', e.length, e.join(' | '));
 await b.close(); srv.close();
})();
