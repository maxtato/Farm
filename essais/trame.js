// La trame vue de près et de loin : c'est un effet d'impression, il ne se juge qu'à l'œil.
const {chromium}=require('playwright');const fs=require('fs');const serve=require('./srv');
const D=__dirname+'/sorties/';
(async()=>{
 fs.mkdirSync(D,{recursive:true});
 const srv=await serve(8886);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:430,height:820},hasTouch:true,deviceScaleFactor:2});
 p.on('pageerror',x=>console.log('[pageerror]',x.message));
 await p.goto('http://localhost:8886/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:90000});
 await p.waitForTimeout(3000);
 const vue = async (nom, z, pi, cx, cz, trame) => {
   await p.evaluate(q=>{ document.getElementById('trame').style.display = q[4] ? '' : 'none';
     camLook.set(q[2],1,q[3]); zoom=q[0]; PITCH=q[1]*Math.PI/180; applyPitch(); applyCamera(); },
     [z,pi,cx,cz,trame]);
   await p.waitForTimeout(4500);
   await p.screenshot({path:D+nom});
   console.log('->', nom);
 };
 await p.evaluate(()=>{ if(panelOpen())closePanel(); });
 await vue('trame-sans.png', .55, 52, -86, -168, false);
 await vue('trame-avec.png', .55, 52, -86, -168, true);
 await vue('trame-pres.png', 1.6, 44, -95, -160, true);
 await vue('trame-loin.png', .18, 60, -40, -60,  true);
 await b.close(); srv.close();
})();
