// يصوّر المعركة بأوقات محددة: node tools/shots.mjs outDir [r=win] [terr] [tac] — vite على 5177
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [out, r = 'win', terr = '', tac = ''] = process.argv.slice(2);
const TIMES = (process.env.TIMES || '20,90,175,225,300,380,470,560').split(',').map(Number);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://localhost:5177/index.html?auto=1&r=${r}${terr ? '&terr=' + terr : ''}${tac ? '&tac=' + tac : ''}`);
await p.waitForFunction(() => window.ready, null, { timeout: 120000 });
for (const t of TIMES) { await p.evaluate(t => window.seek(t), t); await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${r}${terr}${tac}_${t}.png` }); }
console.log('errors:', errs.slice(0, 6));
await b.close();
