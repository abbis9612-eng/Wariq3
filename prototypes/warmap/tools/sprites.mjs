// يخبز صور من فوق للمجسمات الجديدة بأداة المعركة الكلاسيكية (sprite.html، قراءة بس)
// شغّل أول: (cd ../battle-classic && npx vite --port 5179)   ثم: node tools/sprites.mjs [yaw]
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const L = [['f14', '@fs/home/user/Wariq3/prototypes/warmap/models/f14.glb', +(process.argv[2] ?? Math.PI / 2)]];
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
for (const [n, f, yaw] of L) {
  await p.goto(`http://localhost:5179/tools/sprite.html?m=${f}&yaw=${yaw}`);
  await p.waitForFunction(() => window.done, null, { timeout: 180000 });
  const info = await p.evaluate(() => window.info);
  await (await p.$('#c')).screenshot({ path: `sprites/${n}_raw.png`, omitBackground: true });
  console.log(n, JSON.stringify(info));
}
await b.close();
