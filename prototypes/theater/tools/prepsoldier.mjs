// تجهيز الجندي للتلفون: كل الصور الصغيرة بصورة وحدة (أطلس)، كل القطع بقطعة وحدة، وبس الحركات اللي نحتاجها.
// node tools/prepsoldier.mjs in.glb out.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, join, flatten, weld, resample } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'fs';
const [src, dst] = process.argv.slice(2);
const KEEP = ['run', 'simple walk', 'simple shoot', 'crouch shoot', 'pron idle', 'pron shot', 'pron walk', 'simple death', 'pron death', 'idle simple'];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src), root = doc.getRoot();
for (const a of root.listAnimations()) if (!KEEP.includes(a.getName())) a.dispose();
// الأطلس: كل صورة بخانة 64×64 (8×8 خانات = 512)
const prims = root.listMeshes().flatMap(m => m.listPrimitives());
const mats = [...new Set(prims.map(p => p.getMaterial()))];
const CELL = 64, COLS = 8, SIZE = CELL * COLS, comp = [];
const slot = new Map();
for (const [i, m] of mats.entries()) {
  const t = m.getBaseColorTexture(), cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * CELL; slot.set(m, [cx, cy]);
  const f = m.getBaseColorFactor();
  const img = t ? await sharp(Buffer.from(t.getImage())).resize(CELL - 4, CELL - 4, { kernel: 'nearest' }).extend({ top: 2, bottom: 2, left: 2, right: 2, extendWith: 'copy' }).png().toBuffer()
    : await sharp({ create: { width: CELL, height: CELL, channels: 4, background: { r: f[0] * 255, g: f[1] * 255, b: f[2] * 255, alpha: 1 } } }).png().toBuffer();
  comp.push({ input: img, left: cx, top: cy });
}
const atlas = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } } }).composite(comp).png().toBuffer();
const tex = doc.createTexture('atlas').setImage(new Uint8Array(atlas)).setMimeType('image/png');
const mat = doc.createMaterial('soldier').setBaseColorTexture(tex).setRoughnessFactor(0.9).setMetallicFactor(0);
for (const p of prims) {
  const [cx, cy] = slot.get(p.getMaterial()), uv = p.getAttribute('TEXCOORD_0');
  if (uv) { const a = uv.getArray().slice(); for (let i = 0; i < a.length; i += 2) { const u = a[i] - Math.floor(a[i]), v = a[i + 1] - Math.floor(a[i + 1]);
      a[i] = (cx + 2 + u * (CELL - 4)) / SIZE; a[i + 1] = (cy + 2 + v * (CELL - 4)) / SIZE; }
    uv.setArray(a); }
  p.setMaterial(mat);
}
await doc.transform(dedup(), resample({ tolerance: 0.002 }), weld(), prune());
await io.write(dst, doc);
const r2 = doc.getRoot();
console.log(dst, (fs.statSync(dst).size / 1e6).toFixed(2) + 'MB', 'meshes', r2.listMeshes().length, 'prims', r2.listMeshes().reduce((s, m) => s + m.listPrimitives().length, 0), 'anims', r2.listAnimations().map(a => a.getName()).join(','));
