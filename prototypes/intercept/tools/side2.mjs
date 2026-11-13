import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [out, m] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 800, height: 800 } });
await p.goto('http://localhost:5173/tools/viewer.html?m=' + m);
await p.waitForFunction(() => window.done, null, { timeout: 120000 });
const info = await p.evaluate(() => { const r = BABYLON_SCENE.meshes[0]; const { min, max } = r.getHierarchyBoundingVectors(true); return { min: min.asArray(), max: max.asArray() }; });
console.log(JSON.stringify(info));
for (const [nm, axis] of [['side', 'x'], ['front', 'z'], ['top', 'y']]) {
  await p.evaluate(({ axis, info }) => {
    const B = BABYLON, s = BABYLON_SCENE, mn = new B.Vector3(...info.min), mx = new B.Vector3(...info.max), c = mn.add(mx).scale(.5), L = Math.max(...mx.subtract(mn).asArray()) * 0.6;
    const pos = c.clone(); if (axis === 'x') pos.x += 50; else if (axis === 'z') pos.z += 50; else pos.y += 50;
    const cam = new B.FreeCamera('o' + axis, pos, s); cam.upVector = axis === 'y' ? new B.Vector3(0, 0, 1) : new B.Vector3(0, 1, 0); cam.setTarget(c);
    cam.mode = B.Camera.ORTHOGRAPHIC_CAMERA; cam.orthoLeft = -L; cam.orthoRight = L; cam.orthoTop = L; cam.orthoBottom = -L; s.activeCamera = cam;
    if (!window.g2) { window.g2 = 1; const Ls = []; const st = 0.1;
      for (let a = -1; a <= 1.0001; a += st) { Ls.push([new B.Vector3(-1, a, 0), new B.Vector3(1, a, 0)], [new B.Vector3(a, -1, 0), new B.Vector3(a, 1, 0)], [new B.Vector3(0, a, -1), new B.Vector3(0, a, 1)], [new B.Vector3(0, -1, a), new B.Vector3(0, 1, a)], [new B.Vector3(a, 0, -1), new B.Vector3(a, 0, 1)], [new B.Vector3(-1, 0, a), new B.Vector3(1, 0, a)]); }
      const ls = B.MeshBuilder.CreateLineSystem('g', { lines: Ls }, s); ls.color = new B.Color3(1, 0, 0); ls.renderingGroupId = 1; }
  }, { axis, info });
  await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${m}_${nm}.png` });
}
await b.close();
