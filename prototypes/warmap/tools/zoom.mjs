// لقطات متتالية بدقة عالية لنفس التشغيلة (لفحص الإطلاقات): node tools/zoom.mjs win 8.3,8.8,9.5 [lon,lat,نص_العرض]
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const [r, ts, cam] = [process.argv[2], process.argv[3].split(',').map(Number), process.argv[4]];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
await p.goto(`http://localhost:5181/?auto&r=${r}${cam ? '&cam=' + cam : ''}`); await p.waitForFunction(() => window.ready);
for (const t of ts) { await p.evaluate(t => window.seek(t), t); await p.waitForTimeout(120); await p.screenshot({ path: `shots/z_${r}_${t}.png` }); }
await b.close();
