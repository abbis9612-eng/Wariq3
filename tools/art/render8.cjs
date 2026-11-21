const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const [m, f0 = 0, out = m] = process.argv.slice(2);
 const p = await b.newPage({ viewport: { width: 1280, height: 200 } }); p.on('console', x => console.log('c:', x.text())); p.on('pageerror', e => console.log('E', e.message));
 await p.goto(`http://localhost:8765/render.html?m=${m}&f0=${f0}`); await p.waitForFunction(() => window.DONE, null, { timeout: 60000 });
 const d = await p.evaluate(() => window.DONE); if (d.startsWith('ERR')) { console.log(d); process.exit(1); } fs.writeFileSync(out + '.png', Buffer.from(d.split(',')[1], 'base64')); console.log(m, JSON.stringify(await p.evaluate(() => window.DIM))); await b.close(); })();
