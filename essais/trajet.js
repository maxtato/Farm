const {chromium}=require('playwright');
const serve=require('./srv');
const fs=require('fs');
const OUT=__dirname+'/sorties/', PORT=8871;
(async()=>{
 require('fs').mkdirSync(__dirname+'/sorties',{recursive:true});
 const srv=await serve(PORT);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const e=[], releve=[];
 async function essai(nom, pts, opt){
   opt = opt || {};
   const p=await b.newPage({viewport:{width:430,height:820},hasTouch:true});
   p.on('pageerror',x=>e.push(nom+': '+x.message)); p.setDefaultTimeout(120000);
   await p.goto('http://localhost:'+PORT+'/',{waitUntil:'load'});
   await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:120000});
   await p.waitForTimeout(2500);
   // La cour démarre vide : on s'équipe d'un tracteur et d'une déchaumeuse, on les attelle,
   // et on cadre la vue. C'est cet attelage-là qui suivra le tracé.
   await p.evaluate(q=>{
     if (panelOpen()) closePanel();
     SND.set(false);
     coins = 200000;
     acheterPorteur('tracteur',0); acheterOutil('sol',0);
     const v = engins[0], o = outils[0], ball = pointAttelage(v);
     v.pos.x += o.x-ball.x; v.pos.z += o.z-ball.z; v.h.position.set(v.pos.x,0,v.pos.z);
     raccrocher(v);
     const w = pilote();
     // L'essai « obstacle » vise un vrai bâtiment : on achète le petit silo, posé au bord
     // de la cour, et on part quarante mètres au sud de lui, nez au nord. Les autres
     // partent en plein champ, tournés vers le sud.
     // vingt mètres devant le silo, nez dessus : le tracé, centré sur l'engin, le traverse
     if (q.silo){ acheterSilo(); const S = SILOS[0]; w.pos.set(S.x, 0, S.z + 20); w.heading = Math.PI; }
     else { w.pos.set(X0+P*.5, 0, Z0+P*.72); w.heading = Math.PI; }
     w.h.position.set(w.pos.x,0,w.pos.z); w.h.rotation.y = w.heading;
     camLook.set(w.pos.x,1,w.pos.z);
     zoom = q.z; PITCH = 0.8727; applyPitch(); applyCamera();
   }, {z:opt.z||1.0, silo:!!opt.silo});
   await p.waitForTimeout(1500);
   if(opt.champ!==false){ if(await p.evaluate(()=>window.__FARM_DEBUG().manuel))
       await p.evaluate(()=>document.getElementById('btnAuto').click());
     await p.waitForTimeout(opt.champ||28000); }
   if(!(await p.evaluate(()=>window.__FARM_DEBUG().manuel)))
     await p.evaluate(()=>document.getElementById('btnAuto').click());
   await p.waitForTimeout(4500);
   await p.evaluate(()=>document.getElementById('btnCam').click());
   await p.waitForTimeout(700);
   const R=await p.locator('#stage').boundingBox();
   const ecran=pts.map(([u,w])=>[R.x+R.width*u, R.y+R.height*w]);
   const depart=await p.evaluate(()=>{const d=window.__FARM_DEBUG(); return [d.posX,d.posZ,d.cap];});
   await p.evaluate(async q=>{
     const el=document.getElementById('stage');
     const mk=(x,y,t)=>el.dispatchEvent(new PointerEvent(t,{pointerId:6,clientX:x,clientY:y,bubbles:true,pointerType:'touch'}));
     const dodo=ms=>new Promise(r=>setTimeout(r,ms));
     mk(q[0][0],q[0][1],'pointerdown');
     for(let i=1;i<q.length;i++){ mk(q[i][0],q[i][1],'pointermove'); await dodo(24); }
     mk(q[q.length-1][0],q[q.length-1][1],'pointerup');
   }, ecran);
   await p.waitForTimeout(250);
   const d0=await p.evaluate(()=>window.__FARM_DEBUG());
   const ch=d0.chemin;
   if(!ch){ console.log(nom,': aucun tracé'); await p.close(); return; }
   const traj=[]; let t=0, fini=false;
   while(t++<700){
     const q=await p.evaluate(()=>{const d=window.__FARM_DEBUG();
       return {x:d.posX,z:d.posZ,v:d.vit,tr:d.trace,en:d.enfonce,sa:d.sauts,tete:d.suivi?d.suivi.tete:-1};});
     traj.push([q.x,q.z,q.v,q.tr,q.tete,q.sa]);
     if(!q.tr){ fini=true; break; }
     await p.waitForTimeout(110);
   }
   const obst=await p.evaluate(()=>window.__FARM_LISTE_OBST ? window.__FARM_LISTE_OBST() : []);
   // Un « 0 sauté » ne vaut que si quelque chose barrait vraiment la route : sans ce
   // contrôle, un tracé qui s'arrête avant l'obstacle rend le même chiffre qu'un
   // contournement réussi, et l'essai passe sans avoir rien éprouvé.
   let barre = 1e9;
   for(const [ox,oz,orad] of obst) for(let k=0;k<ch.length/2;k++)
     barre = Math.min(barre, Math.hypot(ch[k*2]-ox, ch[k*2+1]-oz) - orad);
   releve.push({nom, ch, traj, depart, fini, n:ch.length/2, obst});
   const N=ch.length/2, mini=new Array(N).fill(1e9);
   for(let k=0;k<N;k++) for(const t of traj){
     const d=Math.hypot(ch[k*2]-t[0], ch[k*2+1]-t[1]); if(d<mini[k]) mini[k]=d; }
   let k0=0; while(k0<N && mini[k0]>2.5) k0++;
   const suite=mini.slice(k0);
   console.log(nom.padEnd(12),'| pts', N,
     '| accroché au', k0, '| ratés après', suite.filter(m=>m>2.5).length+'/'+suite.length,
     '| écart moy', (suite.reduce((a,c)=>a+c,0)/Math.max(1,suite.length)).toFixed(2)+'m',
     '| pire', Math.max(...suite).toFixed(1)+'m',
     '| durée', (traj.length*0.11).toFixed(0)+'s',
     '| fini', fini, '| sautés', traj[traj.length-1][5]||0,
     '| obstacle sur le tracé', barre < 0 ? 'oui, à ' + (-barre).toFixed(1) + 'm dedans'
                                         : 'NON (' + barre.toFixed(1) + 'm au large)');
   await p.close();
 }
 await essai('courbe',   Array.from({length:30},(_,i)=>{
   const t=i/29; return [0.50+0.26*Math.sin(t*2.2), 0.60-0.40*t]; }));
 // et un tracé tiré droit sur les bâtiments : là, il a le droit de contourner
 await essai('zigzag',   Array.from({length:30},(_,i)=>{
   const t=i/29; return [0.50+Math.sin(t*7)*0.13, 0.66-0.44*t]; }));
 await essai('crochet',  Array.from({length:30},(_,i)=>{
   const t=i/29; return t<0.5 ? [0.50, 0.66-0.36*t*2] : [0.50+0.30*(t-0.5)*2, 0.30+0.20*(t-0.5)*2]; }));
 // tracé tiré droit sur le silo : là, et là seulement, il a le droit de couper
 await essai('obstacle', Array.from({length:26},(_,i)=>[0.50, 0.78-0.62*i/25]),
   {champ:false, z:0.9, silo:true});
 fs.writeFileSync(OUT+'trajet.json', JSON.stringify(releve));
 console.log('ERREURS :', e.length, e.join(' | '));
 await b.close(); srv.close();
})();
