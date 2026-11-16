// node tools/bake.mjs [أسماء]   (vite لازم شغّال على 5183 من مجلد oblique)
// كل ورقة ← sprites/<اسم>.webp: 16 إطار (4×4، كل إطار 256): إما 16 اتجاه، أو مراحل حركة باتجاه ثابت + sprites/manifest.json
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); import fs from 'fs'; import { execFileSync } from 'child_process';
const T = '@fs/home/user/Wariq3/prototypes/theater/models', B = '@fs/home/user/Wariq3/prototypes/battle3d/models', O = '@fs/home/user/Wariq3/prototypes/oblique/models';
const S4 = `m=${O}/s400maz.glb&len=13.5&yaw=-1.5708&hideN=msl_show,stand_cradle,V55_&shadow=1`, ZF = `m=${O}/zolf.glb&len=13.2&yaw=1.5708&shadow=1`;
export const HEAD = { s400: 20, zolf: 205 };   // اتجاه ثابت للمنصات (درجات: 0 شرق، 90 شمال)
const dirs = (q) => Array.from({ length: 16 }, (_, i) => ({ q, deg: i * 22.5 }));
const SHEETS = {
  f16: dirs(`m=${B}/f16.glb&len=15.1&yaw=${process.env.F16YAW ?? 3.14159}`),
  patriot: dirs(`m=${T}/patriot.glb&len=10.4&shadow=1`),
  // S-400: 10 لقطات رفع الأنابيب + 6 لقطات حركة الإطلاق (نفس الاتجاه)
  s400: [...Array.from({ length: 10 }, (_, i) => ({ q: `${S4}&anim=Raise&at=${(i / 9).toFixed(3)}`, deg: HEAD.s400 })), ...Array.from({ length: 6 }, (_, i) => ({ q: `${S4}&anim=Launch&at=${((i + 1) / 6).toFixed(3)}`, deg: HEAD.s400 }))],
  // ذو الفقار: 10 لقطات رفع الصاروخ + المنصة فارغة
  zolf: [...Array.from({ length: 10 }, (_, i) => ({ q: `${ZF}&erect=6&ax=x&ang=${(-i * 10).toFixed(0)}`, deg: HEAD.zolf })), ...Array.from({ length: 6 }, () => ({ q: `${ZF}&hide=6`, deg: HEAD.zolf }))],
};
const ONLY = process.argv[2] ? process.argv[2].split(',') : Object.keys(SHEETS);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 256, height: 256 } });
const man = fs.existsSync('sprites/manifest.json') ? JSON.parse(fs.readFileSync('sprites/manifest.json')) : {};
for (const n of ONLY) {
  let lastQ = '', info = null; const fr = SHEETS[n]; let R = 0;
  // أول دورة: نحسب أكبر نص قطر بكل اللقطات حتى كل الإطارات بنفس المقياس
  for (const f of fr) { if (f.q !== lastQ) { await p.goto(`http://localhost:5183/tools/bake.html?${f.q}`); await p.waitForFunction(() => window.done, null, { timeout: 300000 }); lastQ = f.q; if (!f.q.includes('anim=Launch')) R = Math.max(R, (await p.evaluate(() => window.info)).R); } }
  lastQ = '';
  for (let i = 0; i < 16; i++) { const f = fr[i];
    if (f.q !== lastQ) { await p.goto(`http://localhost:5183/tools/bake.html?${f.q}&R=${R}`); await p.waitForFunction(() => window.done, null, { timeout: 300000 }); lastQ = f.q; info = await p.evaluate(() => window.info); }
    await p.evaluate(d => window.frame(d), f.deg); await (await p.$('#c')).screenshot({ path: `sprites/${n}_raw${i}.png`, omitBackground: true }); }
  execFileSync('python3', ['-c', `
from PIL import Image
s=Image.new('RGBA',(1024,1024))
for i in range(16): s.paste(Image.open('sprites/${n}_raw%d.png'%i).convert('RGBA'),((i%4)*256,(i//4)*256))
s.save('sprites/${n}.webp',quality=88,method=6)`]);
  man[n] = { mpp: +(2 * R / 256).toFixed(4), H: +info.H.toFixed(2), kind: n === 'f16' || n === 'patriot' ? 'dirs' : 'anim', head: HEAD[n] ?? null }; console.log(n, JSON.stringify(man[n]));
}
fs.writeFileSync('sprites/manifest.json', JSON.stringify(man, null, 1)); await b.close();
