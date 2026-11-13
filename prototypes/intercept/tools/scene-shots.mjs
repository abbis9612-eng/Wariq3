import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url, out, w = 390, h = 844] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
await p.goto(url);
const marks = [
  ['1-approach', s => s.T > 3], ['2-battery', s => s.T > 6.6], ['3-launch', s => s.T > 8.35], ['4-launch2', s => s.T > 9.9],
  ['5-track', s => s.shot === 'track' && s.T > 12.5], ['6-preintercept', s => s.shot === 'intercept' && s.hit < 0 && s.timeScale < 0.3],
  ['7-boom', s => s.hit > 0 && s.T > s.hit + 0.08], ['8-boom2', s => s.hit > 0 && s.T > s.hit + 0.6], ['9-fall', s => s.shot === 'fall' && s.T > s.hit + 4],
  ['10-landed', s => s.landed > 0 && s.T > s.landed + 0.6], ['11-end', s => s.shot === 'end' && s.T > s.landed + 6],
];
const t0 = Date.now();
for (const [name, cond] of marks) {
  const fn = cond.toString();
  try { await p.waitForFunction(`(()=>{const s=window.__state;return s&&(${fn})(s)})()`, null, { timeout: 240000, polling: 50 }); }
  catch { console.log('TIMEOUT waiting', name, JSON.stringify(await p.evaluate(() => window.__state))); break; }
  const s = await p.evaluate(() => window.__state);
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log(name, 'T=' + s.T.toFixed(2), 'shot=' + s.shot, 'ts=' + s.timeScale.toFixed(2), 'fps=' + s.fps.toFixed(1), ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
console.log('errors:', errs.length ? errs.slice(0, 15).join('\n') : 'none');
await b.close();
