// Le parc : tout s'achète pièce par pièce, tout s'interchange, tout monte en gamme à part.
const {chromium}=require('playwright');const serve=require('./srv');const fs=require('fs');
const D=__dirname+'/sorties/';
(async()=>{
 fs.mkdirSync(D,{recursive:true});
 const srv=await serve(8879);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:430,height:820},hasTouch:true});
 const err=[];
 p.on('pageerror',x=>err.push('[pageerror] '+x.message+'\n'+(x.stack||'').split('\n').slice(0,3).join('\n')));
 p.on('console',m=>{if(m.type()==='error')err.push('[console] '+m.text().slice(0,300));});
 await p.goto('http://localhost:8879/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:60000});
 await p.waitForTimeout(2500);
 const dit=(t,v)=>console.log(String(t).padEnd(34),JSON.stringify(v));
 // amène la boule du tracteur pile sur l'outil visé, puis attelle
 const attelle = oid => p.evaluate(id=>{
   const v=pilote(), o=outilPar(id), ball=pointAttelage(v);
   v.pos.x+=o.x-ball.x; v.pos.z+=o.z-ball.z; v.h.position.set(v.pos.x,0,v.pos.z);
   const r=raccrocher(v);
   return { attele:!!r, metier:v.metier===undefined?null:pilote().metier, largeur:
     pilote().g.userData.tool ? pilote().g.userData.tool.W : null };
 }, oid);

 dit('terrain nu', await p.evaluate(()=>({ sous:coins, engins:engins.length,
   outils:outils.length, bouton:document.getElementById('vehBtn').textContent })));

 // --- deux tracteurs et quatre outils, achetés séparément ---
 dit('achats', await p.evaluate(()=>{
   coins=200000;                       // le banc n'est pas là pour éprouver la trésorerie
   const t1=acheterPorteur('tracteur',0), t2=acheterPorteur('tracteur',1);
   const os=['sol','semis','engrais','benne'].map(t=>acheterOutil(t,0));
   const m=acheterPorteur('moiss',0);
   return { engins:engins.map(v=>({id:v.pid,k:v.kind,n:v.niv})),
            outils:outils.map(o=>({id:o.oid,t:o.type,n:o.niv,pose:!o.porteur})),
            reste:coins };
 }));

 // --- le même tracteur enchaîne les quatre outils ---
 for (const t of ['sol','semis','engrais','benne']){
   const r = await p.evaluate(async type=>{
     const v=engins[0]; driven=v.pid; syncFleet();
     if (v.outil) decrocher(v);
     const o=outils.find(x=>x.type===type&&!x.porteur);
     const w=pilote(), ball=pointAttelage(w);
     w.pos.x+=o.x-ball.x; w.pos.z+=o.z-ball.z; w.h.position.set(w.pos.x,0,w.pos.z);
     const got=raccrocher(w);
     const n=pilote();
     return { outil:type, attele:!!got, metier:n.metier,
              largeur:n.g.userData.tool?n.g.userData.tool.W:null,
              benne:!!n.g.userData.benne, cap:capDe(n) };
   }, t);
   dit('tracteur 1 + ' + t, r);
 }

 // --- l'échange : le tracteur 1 pose sa benne, le tracteur 2 la reprend ---
 dit('échange de benne', await p.evaluate(()=>{
   const a=engins[0], bq=engins[1];
   const o=decrocher(a);                       // a lâche la benne où il est
   driven=bq.pid; syncFleet();
   const w=pilote(), ball=pointAttelage(w);
   w.pos.x+=o.x-ball.x; w.pos.z+=o.z-ball.z; w.h.position.set(w.pos.x,0,w.pos.z);
   const got=raccrocher(w);
   return { repris:!!got, porteurA:engins[0].outil, porteurB:engins[1].outil,
            capA:capDe(engins[0]), capB:capDe(engins[1]) };
 }));

 // --- chaque pièce monte en gamme de son côté ---
 dit('améliorations séparées', await p.evaluate(()=>{
   coins=200000;
   const t=engins[0], sol=outils.find(o=>o.type==='sol'), m=engins.find(v=>v.kind==='moiss');
   ameliorerEngin(t.pid); ameliorerOutil(sol.oid); ameliorerBec(m.pid);
   return { tracteur:engins[0].niv, outilSol:outils.find(o=>o.type==='sol').niv,
            moissNiv:engins.find(v=>v.kind==='moiss').niv,
            moissBec:engins.find(v=>v.kind==='moiss').bec,
            coupe:engins.find(v=>v.kind==='moiss').g.userData.tool.W };
 }));

 // --- une benne trop lourde ne se pose pas derrière un tracteur trop léger ---
 dit('règle de puissance', await p.evaluate(()=>{
   const b22=acheterOutil('benne',2);            // 22 m³ : demande un tracteur de niveau 2
   const petit=acheterPorteur('tracteur',0), fort=acheterPorteur('tracteur',2);
   return { besoin:OUTILS.benne.force[2],
            compactRefuse:!tirable(b22,petit), grosAccepte:tirable(b22,fort) };
 }));

 // --- sauvegarde et relecture ---
 const sv = await p.evaluate(()=>{ save();
   return JSON.parse(localStorage.getItem('ferme.cycle.v1')); });
 dit('sauvegarde', {engins:sv.engins.length, outils:sv.outils.length, conduit:sv.conduit});
 await p.reload({waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:60000});
 await p.waitForTimeout(2500);
 dit('après rechargement', await p.evaluate(()=>({
   engins:engins.map(v=>({id:v.pid,k:v.kind,n:v.niv,o:v.outil,m:v.metier})),
   outils:outils.map(o=>({id:o.oid,t:o.type,n:o.niv,p:o.porteur||0})),
   obst:OBST.length })));

 const n = await p.evaluate(()=>{openPanel('parc');
   return document.querySelectorAll('#body .card').length;});
 dit('cartes dans l’onglet Parc', n);
 await p.waitForTimeout(900);
 await p.screenshot({path:D+'parc-onglet.png'});
 await p.evaluate(()=>closePanel());
 console.log(err.length?('\nERREURS :\n'+err.join('\n')):'\naucune erreur de page');
 await b.close(); srv.close();
})();
