// صور المعركة: TIMES=.. ZOOM="x,y,z" node tools/shots.mjs outDir [r] [terr] [tod]  (vite على 5179)
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [out, r = 'win', terr = '', tod = 'dusk'] = process.argv.slice(2);
const TIMES = (process.env.TIMES || '6.75,22.5,40.5,56,72,88,104,122,135,149').split(',').map(Number);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 780 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://localhost:5179/index.html?auto=1&r=${r}&tod=${tod}${terr ? '&terr=' + terr : ''}`);
await p.waitForFunction(() => window.ready, null, { timeout: 120000 });
if (process.env.ZOOM) await p.evaluate(z => window.zoomAt(...z.split(',').map(Number)), process.env.ZOOM);
for (const t of TIMES) { await p.evaluate(t => window.seek(t), t); await p.waitForTimeout(250); await p.screenshot({ path: `${out}/${r}${terr}_${tod}${process.env.ZOOM ? 'z' : ''}_${t}.png` }); }
console.log('errors:', errs.slice(0, 6));
await b.close();
