import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [base, out, ...names] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 400 } });
p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => m.type() === 'error' && console.log('CONSOLE', m.text()));
for (const n of names) {
  await p.goto(`${base}/tools/viewer.html?m=${n}`);
  await p.waitForFunction(() => window.done, null, { timeout: 120000 });
  console.log(n, JSON.stringify(await p.evaluate(() => window.info)));
  await p.screenshot({ path: `${out}/${n}.png` });
}
await b.close();
