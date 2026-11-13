// فحص البرج: يوقف اللعبة، يلف أبراج الدبابات 90° عن الجسم، ويصوّر كل نوع من قريب
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2];
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:5174/index.html?auto=1&q=low');
await p.waitForFunction('window.__state && window.__state.T > 3', null, { timeout: 300000, polling: 200 });
await p.click('#spd button[data-s="0"]').catch(() => {});
for (const k of (process.argv[3] || 'abrams,t72,bmp').split(',')) {
  await p.evaluate(k => { const W = window.__getW(); for (const u of W.units) if (u.tur !== undefined) u.tur = u.yaw + 1.4; const x = W.units.find(u => u.kind === k && u.alive); window.__follow(x.id, 22); }, k);
  await p.waitForTimeout(4000); await p.screenshot({ path: `${out}/t-${k}.png` }); console.log(k);
}
console.log('errors', errs.join(' | ') || 'none'); await b.close();
