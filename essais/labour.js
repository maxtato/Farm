// Un seul chantier — le labour — mais à vitesse normale, et on mesure ce qui est vraiment
// travaillé. C'est la seule façon honnête de juger le jeu sur cette machine : accéléré,
// le pas de temps devient si gros que l'engin ne sait plus tenir sa ligne, et on mesure
// alors le banc d'essai, pas le jeu.
const {chromium}=require('playwright');const fs=require('fs');const serve=require('./srv');
const D=__dirname+'/sorties/', LOG=D+'labour.log';
(async()=>{
 fs.mkdirSync(D,{recursive:true}); fs.writeFileSync(LOG,'');
 const dit=(...a)=>fs.appendFileSync(LOG,a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')+'\n');
 const srv=await serve(8891);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await b.newPage({viewport:{width:900,height:760}});
 p.on('pageerror',x=>dit('[pageerror]',x.message));
 await p.goto('http://localhost:8891/',{waitUntil:'load'});
 await p.waitForFunction(()=>typeof window.__FARM_DEBUG==='function',null,{timeout:90000});
 await p.waitForTimeout(2500);
 const dep = await p.evaluate(()=>{
   if (panelOpen()) closePanel();
   SND.set(false); coins = 400000;
   const v0 = acheterPorteur('tracteur',2), o = acheterOutil('sol',2), ball = pointAttelage(v0);
   v0.pos.x += o.x-ball.x; v0.pos.z += o.z-ball.z; v0.h.position.set(v0.pos.x,0,v0.pos.z);
   raccrocher(v0);
   // `raccrocher` reconstruit l'engin : l'objet d'avant n'est plus celui du parc. Le poser
   // lui, c'était déplacer un fantôme pendant que le vrai tracteur restait dans la cour.
   const v = engins[0];
   // On part sur le premier rang, pas au milieu du champ : posé au centre, l'engin se
   // trouve d'emblée à portée des premiers points de passage, les coche sans les avoir
   // parcourus, et laisse tout un pan de terre intact. C'est ce qui m'avait fait prendre
   // un essai mal placé pour un défaut du jeu.
   setAuto();
   const L = lanesFor(6.8);
   v.pos.set(L[0].x, 0, L[0].z);
   v.heading = Math.atan2(L[1].x - L[0].x, L[1].z - L[0].z);
   v.h.position.set(v.pos.x,0,v.pos.z); v.h.rotation.y = v.heading;
   v.laneI = 0; v.done = false; v.lanes = L;
   ['top','bot'].forEach(k=>document.getElementById(k).style.opacity='0');
   camLook.set(X0+P/2,1,Z0+P/2); zoom=.62; PITCH=70*Math.PI/180; applyPitch(); applyCamera();
   return { rangs:L.length/2, NIN, P:+P.toFixed(1),
            posEngin:[+v.pos.x.toFixed(1), +v.pos.z.toFixed(1)],
            premierRang:[+L[0].x.toFixed(1), +L[0].z.toFixed(1)] };
 });
 dit('départ :', dep);
 // Trois essais de suite ont mesuré un banc mal posé plutôt que le jeu. On vérifie donc
 // le point de départ avant de lancer dix minutes de chantier.
 if (Math.hypot(dep.posEngin[0]-dep.premierRang[0], dep.posEngin[1]-dep.premierRang[1]) > 1){
   dit('ABANDON : l\'engin n\'est pas sur le premier rang'); await b.close(); srv.close(); return;
 }
 const part = () => p.evaluate(()=>{
   let n=0; for(let i=0;i<cell.length;i++) if (MASQ[i]>0 && cell[i]===1) n++;
   const w = engins[0];
   return { fait:+(100*n/NIN).toFixed(1), rang:w.laneI, rangs:w.lanes?w.lanes.length:0,
            fini:!!w.done, etape:STAGES[stage].n, frotte:+(w.frotte||0).toFixed(1) };
 });
 let d = null, calme = 0;
 for(let t=0; t<1500; t++){
   d = await part();
   if (t % 60 === 0) dit('  t=' + t, d);
   if (d.fini || d.etape !== 'Préparer'){ dit('CHANTIER FINI à t=' + t, d); break; }
   await p.waitForTimeout(1000);
 }
 await p.screenshot({path:D+'labour.png'}); dit('-> labour.png');
 // Le pourcentage ne dit pas OÙ ça manque. Un plan en texte du champ, une case pour huit
 // cellules : « . » travaillé, « # » resté en friche, « ~ » hors du champ. Un bord, une
 // rayure ou une tache ne se diagnostiquent pas de la même façon.
 dit(await p.evaluate(()=>{
   const K = 8, M = Math.ceil(NS/K), L = [];
   for(let J=0;J<M;J++){
     let ligne = '';
     for(let I=0;I<M;I++){
       let dedans = 0, fait = 0;
       for(let j=J*K;j<Math.min(NS,(J+1)*K);j++) for(let i=I*K;i<Math.min(NS,(I+1)*K);i++){
         const k = j*NS+i;
         if (MASQ[k] > 0){ dedans++; if (cell[k] === 1) fait++; }
       }
       ligne += !dedans ? '~' : fait === dedans ? '.' : fait > dedans*.5 ? ':' : '#';
     }
     L.push(ligne);
   }
   // et le compte des cellules restées en friche, par distance au bord
   const reste = [0,0,0,0];
   for(let k=0;k<NS*NS;k++) if (MASQ[k] > 0 && cell[k] !== 1){
     const d = MASQ[k];
     reste[d < 1 ? 0 : d < 2 ? 1 : d < 4 ? 2 : 3]++;
   }
   return 'plan du champ (. tout labouré  : partiel  # rien  ~ hors champ)\n' + L.join('\n')
        + '\ncellules restées en friche par distance au bord :'
        + ' <1m ' + reste[0] + ' | 1-2m ' + reste[1] + ' | 2-4m ' + reste[2] + ' | >4m ' + reste[3]
        + '\nruban : ' + SWATH.pose() + ' échantillons, saturé : ' + SWATH.plein;
 }));
 dit('fin :', d);
 dit(d && d.fait >= 92 ? 'OK : le champ est labouré à ' + d.fait + ' %'
                       : 'ÉCHEC : ' + (d?d.fait:'?') + ' % seulement');
 await b.close(); srv.close();
})();
