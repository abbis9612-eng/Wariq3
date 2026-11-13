import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url, out, w = 844, h = 390] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto(url);
for (const t of [6, 14, 24, 33, 38, 44, 52, 62, 75, 90, 105]) {
  try { await p.waitForFunction(`window.__state && window.__state.T > ${t}`, null, { timeout: 300000, polling: 100 }); } catch { console.log('TIMEOUT', t); break; }
  await p.screenshot({ path: `${out}/a${String(t).padStart(3, '0')}.png` });
  const s = await p.evaluate(() => window.__state); console.log(t, 'dist=' + s.dist.toFixed(0), 'follow=' + s.follow, 'log=' + s.log);
}
await p.waitForFunction('window.__state && window.__state.over', null, { timeout: 300000 }).catch(() => {}); await p.waitForTimeout(4000);
await p.screenshot({ path: `${out}/a999-end.png` });
console.log('errors:', errs.length ? errs.slice(0, 10).join('\n') : 'none'); await b.close();
