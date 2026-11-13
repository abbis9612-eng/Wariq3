import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url, out, w = 844, h = 390] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto(url);
const until = async (cond, ms = 300000) => p.waitForFunction(`(()=>{const s=window.__state;return s&&(${cond})(s)})()`, null, { timeout: ms, polling: 100 });
const snap = async (n) => { await p.screenshot({ path: `${out}/${n}.png` }); const s = await p.evaluate(() => window.__state); console.log(n, 'T=' + s.T.toFixed(1), 'dist=' + s.dist.toFixed(0), 'fps=' + s.fps.toFixed(1), 'log=' + s.log); };
const plan = [
  ['01-overview', 's=>s.T>4', null],
  ['02-column', 's=>s.T>21', `v=>{v.tx=-6200;v.tz=-850;v.dist=2600;v.yaw=0.9}`],
  ['03-drone', 's=>s.T>30', null, 'drone'],
  ['04-patriot', 's=>s.T>37', `v=>{v.follow=0;v.tx=-1550;v.tz=2650;v.dist=420;v.yaw=-0.6}`],
  ['05-abrams', 's=>s.T>46', null, 'abrams'],
  ['06-wide', 's=>s.T>60', `v=>{v.follow=0;v.tx=-2500;v.tz=-600;v.dist=7000;v.yaw=0.3}`],
  ['07-end', 's=>s.over', `v=>{v.follow=0;v.tx=-3500;v.tz=-900;v.dist=4500;v.yaw=0.6}`],
];
for (const [name, cond, setView, follow] of plan) {
  try { await until(cond); } catch { console.log('TIMEOUT', name, JSON.stringify(await p.evaluate(() => window.__state))); break; }
  if (setView) await p.evaluate(`(${setView})(window.__view)`);
  if (follow) await p.evaluate((k) => { const W = window.__getW(); const pick = k === 'drone' ? W.air.find(a => a.kind === 'shahed' && a.alive) : W.units.find(u => u.kind === 'abrams' && u.alive); if (pick) window.__follow(pick.id); }, follow);
  await p.waitForTimeout(follow ? 2500 : 1500);
  await snap(name);
}
console.log('errors:', errs.length ? errs.slice(0, 10).join('\n') : 'none');
await b.close();
