const {chromium}=require('playwright');const fs=require('fs');
const D=__dirname+'/sorties/';
const b64=f=>'data:image/png;base64,'+fs.readFileSync(D+f).toString('base64');
(async()=>{
 require('fs').mkdirSync(__dirname+'/sorties',{recursive:true});
 const [sortie, titre, ...items]=process.argv.slice(2);
 const L=330,H=470,S=1.25;
 const cases=items.map(it=>{ const [f,lab,l,t]=it.split('|');
  return `<figure style="margin:0"><figcaption style="font:600 15px system-ui;color:#f0e8d8;padding:6px 2px">${lab}</figcaption>
   <div style="width:${L}px;height:${H}px;overflow:hidden;position:relative;border-radius:10px;background:#000">
    <img src="${b64(f)}" style="position:absolute;left:${-(+(l||0))*S}px;top:${-(+(t||0))*S}px;transform-origin:0 0;transform:scale(${S});image-rendering:auto"></div></figure>`;}).join('');
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const p=await br.newPage({viewport:{width:items.length*(L+14)+26,height:H+92}});
 await p.setContent(`<body style="margin:0;background:#191510;padding:12px">
  <div style="font:700 19px system-ui;color:#ffd76a;padding:2px 2px 8px">${titre}</div>
  <div style="display:flex;gap:14px">${cases}</div></body>`);
 await p.waitForTimeout(400); await p.screenshot({path:D+sortie}); await br.close();
 console.log('->',D+sortie);
})();
