import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2];
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:5173/index.html?auto=1');
for (const [n, c] of [['hq-battery', 's=>s.T>6.8'], ['hq-launch2', 's=>s.T>10.2'], ['hq-boom', 's=>s.hit>0&&s.T>s.hit+0.1'], ['hq-end', 's=>s.shot==="end"&&s.T>s.landed+5']]) {
  await p.waitForFunction(`(()=>{const s=window.__state;return s&&(${c})(s)})()`, null, { timeout: 400000, polling: 50 });
  await p.screenshot({ path: `${out}/${n}.png` }); const s = await p.evaluate(() => window.__state); console.log(n, s.T.toFixed(2), s.quality, 'particles', await p.evaluate(() => window.__scene.particleSystems.reduce((a, x) => a + x.getActiveCount(), 0)));
}
console.log('errors:', errs.length ? errs.join('\n') : 'none'); await b.close();
