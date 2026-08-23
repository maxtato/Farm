const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=require('path').join(__dirname,'..'),M={'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml'};
module.exports = port => new Promise(r=>{
  const s=http.createServer((q,res)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';
    const f=path.join(ROOT,p);if(!fs.existsSync(f)){res.writeHead(404);return res.end('x')}
    res.writeHead(200,{'Content-Type':M[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(res)});
  s.listen(port,()=>r(s));
});
