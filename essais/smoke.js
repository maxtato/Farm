const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = '/home/user/Farm';
const MIME = {'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'text/plain'});
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => srv.listen(8765, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await browser.newPage({ viewport:{width:430,height:820}, deviceScaleFactor:1 });
  const errs = [];
  page.on('console', m => { if (m.type()==='error' || m.type()==='warning') errs.push('['+m.type()+'] '+m.text()); });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  await page.goto('http://127.0.0.1:8765/', { waitUntil:'load' });
  await page.waitForTimeout(2500);
  // run a few in-page checks
  for (const step of (process.argv.slice(2)[0]||'').split(',').filter(Boolean)) {
    const [k, ms] = step.split(':');
    if (k === 'wait') { await page.waitForTimeout(+ms); continue; }
    if (ms) { await page.keyboard.down(k); await page.waitForTimeout(+ms); await page.keyboard.up(k); }
    else { await page.keyboard.press(k); await page.waitForTimeout(350); }
  }
  await page.waitForTimeout(600);
  const probe = await page.evaluate(() => (window.__FARM_DEBUG ? window.__FARM_DEBUG() : 'no hook'));
  await page.screenshot({ path: '/tmp/claude-0/-home-user/0175dd7b-ddbd-5db7-9322-4c5768b6eb39/scratchpad/shot.png' });
  console.log('PROBE:', JSON.stringify(probe));
  console.log('ISSUES:', errs.length);
  errs.slice(0,25).forEach(e => console.log('  ' + e));
  await browser.close(); srv.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
