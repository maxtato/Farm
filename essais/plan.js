// Une carte en texte du voisinage du hangar : ce qui est libre, ce qui est route,
// champ de la carte, bâtiment ou arbre. De quoi caler la parcelle et la cour à vue.
const {chromium}=require('playwright');const fs=require('fs');const serve=require('./srv');
const D=__dirname+'/sorties/'; const LOG=D+'plan.log';
(async()=>{
 fs.mkdirSync(D,{recursive:true}); fs.writeFileSync(LOG,'');
 const dit=s=>fs.appendFileSync(LOG,s+'\n');
 const srv=await serve(8897);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:900,height:700}});
 p.on('pageerror',x=>dit('[pageerror] '+x.message));
 await p.goto('http://localhost:8897/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:90000});
 await p.waitForTimeout(2500);
 const txt = await p.evaluate(()=>{
   const segD=(x,z,a,b)=>{ const dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz;
     let t=L?((x-a[0])*dx+(z-a[1])*dz)/L:0; t=Math.max(0,Math.min(1,t));
     return Math.hypot(x-(a[0]+dx*t), z-(a[1]+dz*t)); };
   const dRoute=(x,z)=>{ let m=1e9;
     for(const r of routes){ const q=r.pts,n=q.length;
       for(let i=0;i<n-1;i++) m=Math.min(m,segD(x,z,q[i],q[i+1]));
       if(r.ferme) m=Math.min(m,segD(x,z,q[n-1],q[0])); }
     return m; };
   const inChamp=(x,z)=>parcelles.some(q=>dedansPoly(q,x,z));
   const dObst=(x,z)=>{ let m=1e9; for(const o of OBST) m=Math.min(m,Math.hypot(x-o.x,z-o.z)-o.r); return m; };
   const L=[]; const X1=-190,X2=-20,Z1=-140,Z2=30, PAS=4;
   L.push('x de '+X1+' a '+X2+', z de '+Z1+' a '+Z2+', pas '+PAS+' m');
   L.push('  # route  = champ carte  O obstacle  . libre');
   let head='      '; for(let x=X1;x<=X2;x+=PAS*5) head+=String(x).padEnd(PAS*5/PAS*1,' ').slice(0,1)+'    ';
   for(let z=Z1;z<=Z2;z+=PAS){
     let s=String(z).padStart(5,' ')+' ';
     for(let x=X1;x<=X2;x+=PAS){
       const c = dRoute(x,z)<4.6 ? '#' : dObst(x,z)<0 ? 'O' : inChamp(x,z) ? '=' : '.';
       s+=c;
     }
     L.push(s);
   }
   L.push('colonnes : x = '+X1+' + 4*i');
   return L.join('\n');
 });
 dit(txt);
 await b.close(); srv.close();
})();
