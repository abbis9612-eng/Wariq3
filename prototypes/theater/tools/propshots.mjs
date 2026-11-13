// صور ثابتة لأماكن محددة (TH5.3): يوقف المخرج ويحط الكاميرا بكل مكان. node tools/propshots.mjs outDir [w h]
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [out, w = 844, h = 390] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); if (m.text().startsWith('props')) console.log(m.text()); });
await p.goto('http://localhost:5174/index.html?auto=1');
await p.waitForFunction('window.__state && window.__state.T > 2', null, { timeout: 300000, polling: 200 });
await p.evaluate(() => { document.getElementById('bAuto')?.getAttribute('aria-pressed') === 'true' && document.getElementById('bAuto').click(); });
const SP = process.env.SPOTS ? JSON.parse(process.env.SPOTS) : null;
const spots = SP || { village: [-1480, -330, 420, 0.4], checkpoint: [-1890, -350, 160, 0.9], berms: [-2070, -350, 300, -0.6], river: [-80, 350, 700, 0.3], desert: [-3000, -200, 700, 0.2] };
for (const [n, [x, z, d, yaw]] of Object.entries(spots)) {
  await p.evaluate(([x, z, d, yaw]) => { const v = window.__view; v.follow = 0; v.tx = x; v.tz = z; v.dist = d; v.yaw = yaw; v.pitch = -1; }, [x, z, d, yaw]);
  await p.waitForTimeout(9000); await p.screenshot({ path: `${out}/s-${n}.png` }); console.log(n);
}
console.log('errors', errs.join(' | ') || 'none'); await b.close();
