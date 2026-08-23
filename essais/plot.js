const {chromium}=require('playwright');const fs=require('fs');
const D=__dirname+'/sorties/';
const rel=JSON.parse(fs.readFileSync(D+'trajet.json'));
(async()=>{
 require('fs').mkdirSync(__dirname+'/sorties',{recursive:true});
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const W=430,H=430;
 const cases=rel.map(r=>{
   const xs=[], zs=[];
   for(let k=0;k<r.n;k++){ xs.push(r.ch[k*2]); zs.push(r.ch[k*2+1]); }
   r.traj.forEach(t=>{ xs.push(t[0]); zs.push(t[1]); });
   const x0=Math.min(...xs)-4, x1=Math.max(...xs)+4, z0=Math.min(...zs)-4, z1=Math.max(...zs)+4;
   const s=Math.min(W/(x1-x0), H/(z1-z0));
   const px=x=>(x-x0)*s, pz=z=>H-(z-z0)*s;
   const dess=[]; for(let k=0;k<r.n;k++) dess.push(px(r.ch[k*2]).toFixed(1)+','+pz(r.ch[k*2+1]).toFixed(1));
   const traj=r.traj.map(t=>px(t[0]).toFixed(1)+','+pz(t[1]).toFixed(1));
   const pts=[]; for(let k=0;k<r.n;k++) pts.push(`<circle cx="${px(r.ch[k*2])}" cy="${pz(r.ch[k*2+1])}" r="3.2" fill="#ffd76a"/>`);
   const ob=(r.obst||[]).map(o=>`<circle cx="${px(o[0])}" cy="${pz(o[1])}" r="${o[2]*s}" fill="#5a3b2a" stroke="#8b5e3c" stroke-width="1.5"/>`);
   const lents=r.traj.filter(t=>t[2]<1.5).map(t=>`<circle cx="${px(t[0])}" cy="${pz(t[1])}" r="2.4" fill="#ff5b5b"/>`);
   return `<figure style="margin:0">
     <figcaption style="font:600 15px system-ui;color:#f0e8d8;padding:6px 2px">${r.nom} — ${r.n} points, ${(r.traj.length*0.11).toFixed(0)} s</figcaption>
     <svg width="${W}" height="${H}" style="background:#221c14;border-radius:10px">
       ${ob.join('')}
       <polyline points="${dess.join(' ')}" fill="none" stroke="#8a7326" stroke-width="7" stroke-linejoin="round"/>
       ${pts.join('')}
       <polyline points="${traj.join(' ')}" fill="none" stroke="#4fc3ff" stroke-width="2.2"/>
       ${lents.join('')}
       <circle cx="${px(r.depart[0])}" cy="${pz(r.depart[1])}" r="6" fill="none" stroke="#7cff6b" stroke-width="2.5"/>
     </svg></figure>`;
 }).join('');
 const p=await br.newPage({viewport:{width:rel.length*(W+16)+28,height:H+80}});
 await p.setContent(`<body style="margin:0;background:#151009;padding:12px">
  <div style="font:700 18px system-ui;color:#ffd76a;padding:2px 2px 8px">
   Dessin au doigt (jaune) · trajectoire réelle du tracteur (bleu) · vert = départ · rouge = quasi à l'arrêt</div>
  <div style="display:flex;gap:16px">${cases}</div></body>`);
 await p.waitForTimeout(500); await p.screenshot({path:D+'trajet.png'}); await br.close();
 console.log('->',D+'trajet.png');
})();
