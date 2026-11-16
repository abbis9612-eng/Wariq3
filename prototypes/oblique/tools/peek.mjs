// لقطة وحدة كبيرة للفحص: node tools/peek.mjs "<query>" out.png [deg]
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:5183/tools/bake.html?' + process.argv[2]); await p.waitForFunction(() => window.done, null, { timeout: 300000 });
await p.evaluate(d => window.frame(d), +(process.argv[4] || 0)); await (await p.$('#c')).screenshot({ path: process.argv[3] }); await b.close();
