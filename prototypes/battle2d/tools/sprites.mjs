// يخبز كل الصور من فوق: node tools/sprites.mjs  (vite على 5177)
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const T = '@fs/home/user/Wariq3/prototypes/theater/models', B = '@fs/home/user/Wariq3/prototypes/battle3d/models';
const L = [['abrams', T + '/abrams.glb', 0], ['t72', T + '/t72.glb', Math.PI], ['d30', T + '/d30.glb', Math.PI], ['grad', T + '/grad.glb', 0], ['s400', T + '/s400.glb', 0], ['bmp', T + '/bmp.glb', 0],
  ['su25', B + '/su25.glb', Math.PI / 2], ['ah64', B + '/ah64.glb', Math.PI / 2], ['tb2', B + '/tb2.glb', 0], ['h1', T + '/h_arabic4.glb', 0], ['h2', T + '/h_arab1.glb', 0], ['h3', T + '/h_low.glb', 0], ['palm', T + '/p_palm.glb', 0]];
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 512, height: 512 } });
for (const [n, f, yaw] of L) {
  await p.goto(`http://localhost:5177/tools/sprite.html?m=${f}&yaw=${yaw}`); await p.waitForFunction(() => window.done, null, { timeout: 90000 });
  const info = await p.evaluate(() => window.info); await (await p.$('#c')).screenshot({ path: `sprites/${n}.png`, omitBackground: true }); console.log(n, JSON.stringify(info));
}
await b.close();
