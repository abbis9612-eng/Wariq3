// صور لحظات بنفس التشغيلة: node tools/shots.mjs 1,6,31.3 [اسم]   (vite على 5183)
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const ts = process.argv[2].split(',').map(Number), tag = process.argv[3] || 's';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:5183/?auto'); await p.waitForFunction(() => window.ready, null, { timeout: 90000 });
for (const t of ts) { await p.evaluate(t => window.seek(t), t); await p.waitForTimeout(200); await p.screenshot({ path: `shots/${tag}_${String(t).padStart(6, '0')}.png` }); }
console.log('errors:', errs.length ? errs.slice(0, 5).join('\n') : 'none'); await b.close();
