const {chromium}=require('playwright');const serve=require('./srv');
(async()=>{const srv=await serve(8883);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:430,height:820},hasTouch:true});
 await p.goto('http://localhost:8883/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:180000});
 const m=await p.evaluate(()=>{
   const t=performance.timing, n=t.navigationStart;
   const res=performance.getEntriesByType('resource')
     .filter(r=>/\.js$/.test(r.name))
     .map(r=>[r.name.split('/').pop(), +(r.duration).toFixed(0), +(r.startTime).toFixed(0)]);
   return { dcl:t.domContentLoadedEventEnd-n, load:t.loadEventEnd-n, res };
 });
 console.log('page prête (DOMContentLoaded) :', (m.dcl/1000).toFixed(2)+' s');
 console.log('chargement complet           :', (m.load/1000).toFixed(2)+' s');
 console.log('fichiers (nom, durée ms, départ ms) :');
 m.res.forEach(r=>console.log('   ', r[0].padEnd(22), String(r[1]).padStart(5), String(r[2]).padStart(6)));
 await b.close(); srv.close();})();
