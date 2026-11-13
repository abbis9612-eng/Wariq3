import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(process.argv[2]);
await p.waitForFunction(() => window.__state && window.__state.T > 9, null, { timeout: 200000 });
console.log('state', JSON.stringify(await p.evaluate(() => window.__state)).slice(0, 160), 'errors:', errs.length ? errs.join(' | ') : 'none');
await b.close();
