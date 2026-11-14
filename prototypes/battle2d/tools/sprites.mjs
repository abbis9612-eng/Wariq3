// يخبز كل الصور من فوق + sprites/manifest.json (عرض كل صورة بالمتر، ومحور البرج)
// node tools/sprites.mjs   (vite على 5177 من مجلد battle2d)
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'fs';
const T = '@fs/home/user/Wariq3/prototypes/theater/models', B = '@fs/home/user/Wariq3/prototypes/battle3d/models';
// [اسم، ملف، yaw حتى قدّامه يصير +z، مقياس المجسم للمتر، split، part]
const PI = Math.PI;
const L = [
  ['abrams', T + '/abrams.glb', 0, 1, 'abrams', 'hull'], ['abrams_t', T + '/abrams.glb', 0, 1, 'abrams', 'tur'],
  ['t72', T + '/t72.glb', PI, 1, 't72', 'hull'], ['t72_t', T + '/t72.glb', PI, 1, 't72', 'tur'],
  ['bmp', T + '/bmp.glb', 0, 0.24], ['d30', T + '/d30.glb', PI, 0.22], ['grad', T + '/grad.glb', 0, 1],
  ['patriot', T + '/patriot.glb', PI / 2, 1], ['s400', T + '/s400.glb', 0, 7.2], ['technical', T + '/technical.glb', 0, 0.8],
  ['su25', B + '/su25.glb', PI / 2, 0.19], ['f16', B + '/f16.glb', PI / 2, 0.0163], ['ah64', B + '/ah64.glb', PI / 2, 7.1], ['tb2', B + '/tb2.glb', 0, 4.3], ['shahed', T + '/shahed.glb', 0, 1.45],
  ['h1', T + '/h_arabic4.glb', 0, 1.5], ['h2', T + '/h_arab1.glb', 0, 1.25], ['h3', T + '/h_arab2.glb', 0, 1.62], ['h4', T + '/h_arabic1.glb', 0, 1.25], ['h5', T + '/h_desert.glb', 0, 0.75], ['h6', T + '/h_low.glb', 0, 1.12],
  ['palm', T + '/p_palm.glb', 0, 0], ['tree', T + '/p_tree.glb', 0, 0], ['acacia', T + '/p_acacia.glb', 0, 0], ['car1', T + '/p_car1.glb', 0, 0], ['pickup', T + '/p_pickup.glb', 0, 0],
];
// الأشجار والسيارات: حجمها بالمتر يدوي (المجسمات بوحدات مختلفة)
const FIXED = { palm: 9, tree: 8, acacia: 9, car1: 4.6, pickup: 5.4 };
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 512, height: 512 } });
const man = {}; let hullExt = {};
for (const [n, f, yaw, sc, split, part] of L) {
  const extQ = part === 'tur' ? `&ext=${hullExt[split]}` : '';
  await p.goto(`http://localhost:5177/tools/sprite.html?m=${f}&yaw=${yaw}${split ? `&split=${split}&part=${part}` : ''}${extQ}`);
  await p.waitForFunction(() => window.done, null, { timeout: 90000 });
  const info = await p.evaluate(() => window.info); if (part === 'hull') hullExt[split] = info.ext;
  await (await p.$('#c')).screenshot({ path: `sprites/${n}.png`, omitBackground: true });
  man[n] = { m: +(FIXED[n] ?? info.ext * 2 * sc).toFixed(2), ...(info.piv ? { piv: info.piv.map(v => +(v * sc).toFixed(2)) } : {}) };
  console.log(n, JSON.stringify(man[n]));
}
fs.writeFileSync('sprites/manifest.json', JSON.stringify(man, null, 1));
await b.close();
