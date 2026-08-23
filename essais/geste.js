const {chromium}=require('playwright');
const serve=require('./srv');
const PORT=8873;
(async()=>{
 const srv=await serve(PORT);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const e=[];
 const p=await b.newPage({viewport:{width:430,height:820},hasTouch:true});
 p.on('pageerror',x=>e.push(x.message)); p.setDefaultTimeout(120000);
 await p.goto('http://localhost:'+PORT+'/',{waitUntil:'load'});
 await p.waitForTimeout(7000);
 await p.evaluate(()=>{const b=document.getElementById('sheetX'); if(b) b.click();});
 await p.waitForTimeout(600);
 const R=await p.locator('#stage').boundingBox();
 const cx=R.x+R.width*0.5, cy=R.y+R.height*0.5;
 async function geste(n,dx,dy,pause){
   await p.evaluate(async q=>{
     const el=document.getElementById('stage');
     const mk=(x,y,t)=>el.dispatchEvent(new PointerEvent(t,{pointerId:9,clientX:x,clientY:y,bubbles:true,pointerType:'touch'}));
     const dodo=ms=>new Promise(r=>setTimeout(r,ms));
     mk(q.x,q.y,'pointerdown');
     for(let k=1;k<=q.n;k++){ mk(q.x+q.dx*k/q.n, q.y+q.dy*k/q.n,'pointermove'); if(q.pause) await dodo(q.pause); }
     mk(q.x+q.dx,q.y+q.dy,'pointerup');
   },{x:cx,y:cy,n,dx,dy,pause});
   await p.waitForTimeout(400);
   const t=(await p.evaluate(()=>window.__FARM_DEBUG())).trace;
   await p.evaluate(()=>document.getElementById('pathBtn').click());
   await p.waitForTimeout(400);
   return t;
 }
 console.log('1. ripage 18 px       ->', await geste(4,14,11,0),  '(attendu 0)');
 console.log('2. 150 px en 0 ms     ->', await geste(6,120,90,0), '(attendu 0)');
 console.log('3. 30 px tenus 400 ms ->', await geste(8,20,22,50), '(attendu 0)');
 console.log('4. vrai balayage      ->', await geste(14,150,-110,35), '(attendu > 3)');
 console.log('ERREURS :', e.length, e.join(' | '));
 await b.close(); srv.close();
})();
