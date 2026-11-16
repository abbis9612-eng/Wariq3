// صور لحظات من النموذج: node tools/shots.mjs 10,200,426 [theme] [size] [tag]   (vite على 5185)
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const ts = process.argv[2].split(',').map(Number), th = process.argv[3] || 'dark', sz = +(process.argv[4] || 0), tag = process.argv[5] || th;
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1 }); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:5185/?auto&lite'); await p.waitForFunction(() => window.ready, null, { timeout: 120000 });
await p.evaluate(() => window.freeze()); await p.evaluate(([th, sz]) => window.opts(th, sz), [th, sz]);
for (const t of ts) { await p.evaluate(t => window.seek(t), t); await p.waitForTimeout(300); await p.screenshot({ path: `shots/${tag}_${String(t).padStart(6, '0')}.png`, timeout: 120000 }); }
console.log('errors:', errs.length ? errs.slice(0, 5).join('\n') : 'none'); await b.close();
