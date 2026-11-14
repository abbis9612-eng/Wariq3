// node tools/view.mjs outDir models/a.glb ...  (السيرفر: vite على 5175)
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [out, ...files] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 360, height: 300 } });
for (const f of files) for (const v of ['top', 'side']) {
  try { await p.goto(`http://localhost:5175/tools/view.html?m=${f}&v=${v}`); await p.waitForFunction(() => window.done, null, { timeout: 40000 });
    const info = await p.evaluate(() => window.info); const n = f.split('/').pop().replace(/\.\w+$/, ''); await p.screenshot({ path: `${out}/${n}_${v}.png` }); if (v === 'top') console.log(n, JSON.stringify(info).slice(0, 300)); }
  catch (e) { console.log(f, 'ERR', e.message.slice(0, 160)); }
}
await b.close();
