// يصوّر المعركة بأوقات محددة: node tools/shots.mjs outDir [r=win] [terr] [w h] — السيرفر vite على 5175
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [out, r = 'win', terr = '', W = 390, H = 780] = process.argv.slice(2);
const TIMES = (process.env.TIMES || '2,6,9.5,12.5,16.5,21,28,33').split(',').map(Number);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: +W, height: +H } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://localhost:5175/index.html?auto=1&r=${r}${terr ? '&terr=' + terr : ''}`);
await p.waitForFunction(() => window.ready, null, { timeout: 300000 });
for (const t of TIMES) {
  await p.evaluate(t => window.seek(t), t);
  await p.waitForTimeout(2500);
  const shot = await p.evaluate(() => window.camShot());
  await p.screenshot({ path: `${out}/${r}_${terr || 'def'}_${String(t).replace('.', '_')}.png` });
  console.log('t=' + t, shot);
}
console.log('errors:', errs.slice(0, 8));
await b.close();
