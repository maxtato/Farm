const {chromium}=require('playwright');const fs=require('fs');
const D=__dirname+'/sorties/';
const b64=f=>'data:image/png;base64,'+fs.readFileSync(D+f).toString('base64');
const f=process.argv[2], L=+process.argv[3]||0, T=+process.argv[4]||0, S=+process.argv[5]||4;
(async()=>{
 require('fs').mkdirSync(__dirname+'/sorties',{recursive:true});const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const p=await br.newPage({viewport:{width:640,height:520}});
 await p.setContent(`<body style="margin:0;background:#111"><div style="width:640px;height:520px;overflow:hidden;position:relative">
  <img src="${b64(f)}" style="position:absolute;left:${-L*S}px;top:${-T*S}px;transform-origin:0 0;transform:scale(${S});image-rendering:pixelated"></div></body>`);
 await p.waitForTimeout(300); await p.screenshot({path:D+'zg.png'}); await br.close();})();
