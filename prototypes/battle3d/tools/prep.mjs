// تجهيز مجسم للتلفون: شيل عقد بالاسم، تبسيط اختياري، قوام WebP بحجم أقصى، ضغط بسيط
// node tools/prep.mjs in.glb out.glb --drop Object_2 --simplify 0.4 --tex 512
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, simplify, textureCompress, flatten, join } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
const [src, dst, ...rest] = process.argv.slice(2);
const opt = { drop: [], simplify: 0, tex: 512, err: 0.002 };
for (let i = 0; i < rest.length; i++) { const k = rest[i].replace('--', ''); const v = rest[++i]; if (k === 'drop') opt.drop.push(...v.split(',')); else opt[k] = +v; }
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
for (const n of doc.getRoot().listNodes()) if (opt.drop.includes(n.getName())) { n.getMesh()?.dispose(); n.dispose(); }
const tris = () => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0) | 0;
const before = tris();
await doc.transform(prune(), dedup(), flatten(), join(), weld());
if (opt.simplify) { await MeshoptSimplifier.ready; await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: opt.simplify, error: opt.err ?? 0.002 })); }
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [opt.tex, opt.tex], quality: 82 }), prune());
await io.write(dst, doc);
const scene = doc.getRoot().listScenes()[0]; const b = getBounds(scene);
console.log(`${dst}: tris ${before} -> ${tris()}, ${(fs.statSync(src).size / 1e6).toFixed(2)}MB -> ${(fs.statSync(dst).size / 1e6).toFixed(2)}MB, size=${b.max.map((x, i) => (x - b.min[i]).toFixed(2))}`);
