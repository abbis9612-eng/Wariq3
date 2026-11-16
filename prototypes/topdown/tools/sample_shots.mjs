import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const theme of ['light', 'dark']) for (const view of ['far', 'mid', 'close']) {
  const p = await b.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1.5 }); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`http://localhost:5185/sample.html?view=${view}&theme=${theme}`); await p.waitForFunction(() => window.done, null, { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.screenshot({ path: `shots/sample_${theme}_${view}.png` }); console.log(theme, view, errs.slice(0, 3)); await p.close(); }
await b.close();
