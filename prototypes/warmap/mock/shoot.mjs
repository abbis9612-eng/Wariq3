import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const shot of ['top', 'tilt', 'eject', 'fire']) { const p = await b.newPage({ viewport: { width: 412, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:5181/mock/mock.html?shot=' + shot); await p.waitForFunction(() => window.done, null, { timeout: 240000 }); await p.screenshot({ path: `shots/mock_${shot}.png` }); console.log(shot, errs.slice(0, 3)); await p.close(); }
await b.close();
