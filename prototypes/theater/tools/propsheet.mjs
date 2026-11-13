// يصوّر مجسمات للمقارنة: node tools/propsheet.mjs outDir file1.glb file2.glb ...  (السيرفر: vite على 5174)
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [out, ...files] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 320, height: 240 } });
for (const f of files) {
  try { await p.goto('http://localhost:5174/tools/propview.html?m=' + f); await p.waitForFunction(() => window.done, null, { timeout: 120000 });
    const info = await p.evaluate(() => window.info); await p.screenshot({ path: `${out}/${f.split('/').pop().replace(/\.\w+$/, '')}.png` }); console.log(f.split('/').pop().slice(0, 8), JSON.stringify(info)); }
  catch (e) { console.log(f, 'ERR', e.message.slice(0, 120)); }
}
await b.close();
