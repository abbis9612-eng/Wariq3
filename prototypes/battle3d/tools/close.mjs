// لقطات قريبة للتحقق: node tools/close.mjs outDir — يقرب على المسيّرة، الطيارة، الهليكوبتر
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 780 } });
await p.goto('http://localhost:5175/index.html?auto=1&r=capital');
await p.waitForFunction(() => window.ready, null, { timeout: 300000 });
await p.evaluate(() => window.pause(true));
const near = async (t, pick, off, name) => { await p.evaluate(t => window.seek(t), t); const e = await p.evaluate(() => window.ent()); const q = pick(e); if (!q) { console.log(name, 'none', JSON.stringify(e)); return; }
  await p.evaluate(([q, off]) => window.camAt([q[0] + off[0], q[1] + off[1], q[2] + off[2]], q), [q, off]); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/close_${name}.png` }); console.log(name, q.map(x => +(+x).toFixed(1))); };
await near(1.2, e => e.air.find(a => a[0] === 'drone' && a[1] === 0)?.slice(2), [14, 4, -14], 'tb2');
await near(2.5, e => e.air.find(a => a[0] === 'drone' && a[1] === 1)?.slice(2), [8, 3, 8], 'shahed');
await near(11.6, e => e.air.find(a => a[0] === 'jet')?.slice(2), [22, 6, -22], 'jet');
await near(21, e => e.heli[0], [18, 5, -18], 'heli');
await near(24, e => e.heli[1] ?? e.heli[0], [-22, 8, 16], 'heli2');
await b.close();
