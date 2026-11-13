import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2];
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:5174/index.html?auto=1&q=low');
const shot = async (n, cond, pick) => {
  await p.waitForFunction(`window.__state && (${cond})(window.__state)`, null, { timeout: 300000, polling: 100 });
  const ok = await p.evaluate((k) => { const W = window.__getW(); const x = k === 'pac2' ? [...W.air].reverse().find(a => a.kind === 'pac2') : k === 'shahed' ? W.air.find(a => a.kind === 'shahed') : k === 't72' ? W.units.find(u => u.kind === 't72' && u.alive) : W.units.find(u => u.kind === k); if (!x) return false; window.__follow(x.id); return true; }, pick);
  await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/c-${n}.png` }); console.log(n, ok);
};
await shot('overview-marks', 's=>s.T>8', 'none');
await shot('shahed', 's=>s.T>10', 'shahed');
await shot('t72', 's=>s.T>18', 't72');
await shot('pac2', 's=>s.T>27.5', 'pac2');
await shot('technical', 's=>s.T>45', 'technical');
await shot('grad', 's=>s.T>58.5', 'grad');
console.log('errors', errs.join(' | ') || 'none'); await b.close();
