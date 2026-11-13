import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [out, ...names] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 360, height: 300 } });
for (const n of names) {
  await p.goto('http://localhost:5173/tools/viewer.html?m=' + n);
  await p.waitForFunction(() => window.done, null, { timeout: 120000 });
  const info = await p.evaluate(() => {
    const B = BABYLON, s = BABYLON_SCENE, r = s.meshes[0];
    const { min, max } = r.getHierarchyBoundingVectors(true); const c = min.add(max).scale(.5), L = max.subtract(min).length();
    const cam = new B.FreeCamera('f', new B.Vector3(c.x, c.y + L * 0.25, c.z + L * 1.3), s); cam.setTarget(c); s.activeCamera = cam;
    // PCA أفقي على نقاط العالم
    let pts = []; for (const m of s.meshes) { const pos = m.getVerticesData && m.getVerticesData('position'); if (!pos) continue; const wm = m.computeWorldMatrix(true);
      for (let i = 0; i < pos.length; i += 9) pts.push(B.Vector3.TransformCoordinates(new B.Vector3(pos[i], pos[i + 1], pos[i + 2]), wm)); }
    const cx = pts.reduce((a, v) => a + v.x, 0) / pts.length, cz = pts.reduce((a, v) => a + v.z, 0) / pts.length;
    let sxx = 0, szz = 0, sxz = 0; for (const v of pts) { const dx = v.x - cx, dz = v.z - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
    return { yawOfLongAxisFromZ: (0.5 * Math.atan2(2 * sxz, szz - sxx) * 180 / Math.PI).toFixed(1) };
  });
  await p.waitForTimeout(400); await p.screenshot({ path: `${out}/front_${n}.png` }); console.log(n, JSON.stringify(info));
}
await b.close();
