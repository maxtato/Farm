const {chromium}=require('playwright');const serve=require('./srv');
(async()=>{const srv=await serve(8877);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:430,height:820},hasTouch:true});
 p.on('pageerror',x=>console.log('[pageerror]',x.message,'\n',(x.stack||'').split('\n').slice(0,4).join('\n')));
 p.on('console',m=>{if(m.type()==='error')console.log('[console]',m.text().slice(0,300));});
 await p.goto('http://localhost:8877/',{waitUntil:'load'});
 await p.waitForTimeout(12000);
 console.log('debug dispo :', await p.evaluate(()=>typeof window.__FARM_DEBUG));
 await b.close(); srv.close();})();
