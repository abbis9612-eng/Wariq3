import { createRequire } from "module"; const { chromium } = createRequire(import.meta.url)("playwright");
const r = process.argv[2] || 'win', times = (process.argv[3] || '2,8,16,26,36,46,52').split(',').map(Number);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://localhost:5181/?auto&r=${r}`); await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
for (const t of times) { await p.evaluate(t => window.seek(t), t); await p.waitForTimeout(150); await p.screenshot({ path: `shots/${r}_${String(t).padStart(2,'0')}.png` }); }
console.log('errors:', errs.length ? errs.join('\n') : 'none'); await b.close();
