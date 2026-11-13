import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 900, height: 700 } });
await p.goto('http://localhost:5173/tools/viewer.html?m=patriotA');
await p.waitForFunction(() => window.done, null, { timeout: 120000 });
const out = process.argv[2];
for (const [nm, pos, tgt] of [['side', [9, 6, 40], [9, 6, 0]], ['back', [40, 9, 0.01], [9, 7, 0]]]) {
  await p.evaluate(({ pos, tgt }) => {
    const B = BABYLON, s = BABYLON_SCENE;
    s.activeCamera.detachControl?.();
    const cam = new B.FreeCamera('f', new B.Vector3(...pos), s); cam.setTarget(new B.Vector3(...tgt));
    cam.mode = B.Camera.ORTHOGRAPHIC_CAMERA; cam.orthoLeft = -9; cam.orthoRight = 9; cam.orthoTop = 7; cam.orthoBottom = -7; s.activeCamera = cam;
    if (!window.grid) { window.grid = 1; const L = [];
      for (let x = 0; x <= 16; x++) L.push([new B.Vector3(x, 0, 0), new B.Vector3(x, 14, 0)], [new B.Vector3(x, 0, 0), new B.Vector3(x, 0, 0)]);
      for (let y = 0; y <= 14; y++) L.push([new B.Vector3(0, y, 0), new B.Vector3(16, y, 0)]);
      for (let z = -3; z <= 3; z++) L.push([new B.Vector3(16, 0, z), new B.Vector3(16, 14, z)]);
      for (let y = 0; y <= 14; y++) L.push([new B.Vector3(16, y, -3), new B.Vector3(16, y, 3)]);
      const ls = B.MeshBuilder.CreateLineSystem('g', { lines: L }, s); ls.color = new B.Color3(1, 0, 0); ls.renderingGroupId = 1; }
  }, { pos, tgt });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/${nm}.png` });
}
await b.close();
