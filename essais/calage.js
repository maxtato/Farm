// Où poser la parcelle de travail et la cour : on cherche le couple de rectangles
// (parcelle 44x44 + cour 46x18 accolée) le plus proche du hangar qui ne mord ni sur une
// route, ni sur un champ de la carte, ni sur un bâtiment ou un arbre de la carte.
const {chromium}=require('playwright');const fs=require('fs');const serve=require('./srv');
const D=__dirname+'/sorties/'; const LOG=D+'calage.log';
(async()=>{
 fs.mkdirSync(D,{recursive:true}); fs.writeFileSync(LOG,'');
 const dit=s=>fs.appendFileSync(LOG,s+'\n');
 const srv=await serve(8899);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:900,height:700}});
 p.on('pageerror',x=>dit('[pageerror] '+x.message));
 await p.goto('http://localhost:8899/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:90000});
 await p.waitForTimeout(2500);
 const r = await p.evaluate(()=>{
   const segD=(x,z,a,b)=>{ const dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz;
     let t=L?((x-a[0])*dx+(z-a[1])*dz)/L:0; t=Math.max(0,Math.min(1,t));
     return Math.hypot(x-(a[0]+dx*t), z-(a[1]+dz*t)); };
   const dRoute=(x,z)=>{ let m=1e9;
     for(const r of routes){ const q=r.pts,n=q.length;
       for(let i=0;i<n-1;i++) m=Math.min(m,segD(x,z,q[i],q[i+1]));
       if(r.ferme) m=Math.min(m,segD(x,z,q[n-1],q[0])); }
     return m-4.6; };                       // la route fait 9,2 m de large, bas-côté compris
   const dChamp=(x,z)=>{ let m=1e9;
     for(const q of parcelles){ const n=q.length; if(dedansPoly(q,x,z)) return -1;
       for(let i=0;i<n;i++) m=Math.min(m,segD(x,z,q[i],q[(i+1)%n])); }
     return m; };
   const dObst=(x,z)=>{ let m=1e9; for(const o of OBST) m=Math.min(m,Math.hypot(x-o.x,z-o.z)-o.r); return m; };
   const libre=(x0,x1,z0,z1,pas)=>{ let m=1e9;
     for(let x=x0;x<=x1+.01;x+=pas) for(let z=z0;z<=z1+.01;z+=pas){
       m=Math.min(m,dRoute(x,z),dChamp(x,z),dObst(x,z)); if(m<0) return m; }
     return m; };
   const H={x:-108.41,z:-69.07}, P=44, CW=46, CH=18, best=[];
   for(let x0=-180;x0<=-40;x0+=2) for(let z0=-150;z0<=10;z0+=2){
     const mp=libre(x0,x0+P,z0,z0+P,4); if(mp<2.5) continue;
     // la cour : au nord de la parcelle (z plus petit) ou au sud
     for(const [cz0,cz1] of [[z0-4-CH, z0-4],[z0+P+4, z0+P+4+CH]]){
       const cx0=x0+(P-CW)/2, mc=libre(cx0,cx0+CW,cz0,cz1,3); if(mc<2.5) continue;
       const cx=(cx0+cx0+CW)/2, cy=(cz0+cz1)/2;
       best.push({X0:x0,Z0:z0,cour:[+cx.toFixed(1),+cy.toFixed(1)],
                  mp:+mp.toFixed(1),mc:+mc.toFixed(1),
                  d:+Math.hypot(cx-H.x,cy-H.z).toFixed(1)});
     }
   }
   best.sort((a,b)=>a.d-b.d);
   return { n:best.length, top:best.slice(0,20) };
 });
 dit(JSON.stringify(r,null,1));
 await b.close(); srv.close();
})();
