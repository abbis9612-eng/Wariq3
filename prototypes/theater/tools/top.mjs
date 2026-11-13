import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [out, ...names] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 360, height: 360 } });
for (const n of names) {
  await p.goto('http://localhost:5173/tools/viewer.html?m=' + n);
  await p.waitForFunction(() => window.done, null, { timeout: 120000 });
  await p.evaluate(() => {
    const B = BABYLON, s = BABYLON_SCENE, r = s.meshes[0];
    const { min, max } = r.getHierarchyBoundingVectors(true); const c = min.add(max).scale(.5), L = Math.max(max.x - min.x, max.z - min.z) * 0.75;
    const cam = new B.FreeCamera('t', new B.Vector3(c.x, max.y + L * 3, c.z), s); cam.setTarget(new B.Vector3(c.x, min.y, c.z + 0.0001));
    cam.mode = B.Camera.ORTHOGRAPHIC_CAMERA; cam.orthoLeft = -L; cam.orthoRight = L; cam.orthoTop = L; cam.orthoBottom = -L; s.activeCamera = cam;
    const z = B.MeshBuilder.CreateLines('z', { points: [new B.Vector3(c.x, max.y + 1, c.z), new B.Vector3(c.x, max.y + 1, c.z + L)] }, s); z.color = new B.Color3(1, 0, 0);
    const x = B.MeshBuilder.CreateLines('x', { points: [new B.Vector3(c.x, max.y + 1, c.z), new B.Vector3(c.x + L, max.y + 1, c.z)] }, s); x.color = new B.Color3(0, .8, 0);
  });
  await p.waitForTimeout(500); await p.screenshot({ path: `${out}/top_${n}.png` });
}
await b.close();
