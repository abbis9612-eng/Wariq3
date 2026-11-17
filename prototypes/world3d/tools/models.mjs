// مجسمات «العالم 3D» (WM11.4): تخفيف للتلفون (تبسيط + قوام WebP ≤512) ثم glTF نصي بملف واحد (models/*.gltf.json) — صيغة مقبولة للنشر
// قبلها المجسمات الثقيلة تتخفف بـ Blender ← data/*_dec.glb (bl_decimate.py: f14 .12، s400maz .25، zolf .2، t72 .35)
// node tools/models.mjs   (المجسمات المتحركة: s400، zolf تنحفظ بهيكلها حتى حركة الرفع تبقى)
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, simplify, textureCompress, flatten, join } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
const P = '..';
// [الاسم، المصدر، نسبة التبسيط (0 = بدون)، حجم القوام، متحرك؟، أقصى خطأ للتبسيط]
const L = [
  ['f16', `${P}/battle3d/models/f16.glb`, 0, 512, false], ['su25', `${P}/battle3d/models/su25.glb`, 0, 512, false], ['f14', 'data/f14_dec.glb', 0, 512, false]   /* قبلها: venv/bin/python tools/bl_decimate.py ../warmap/models/f14.glb data/f14_dec.glb .12 */,
  ['abrams', `${P}/theater/models/abrams.glb`, 0, 512, false], ['t72', 'data/t72_dec.glb', 0, 512, false], ['bmp', `${P}/theater/models/bmp.glb`, 0, 512, false],
  ['grad', `${P}/theater/models/grad.glb`, 0, 512, false], ['truck', `${P}/theater/models/p_pickup.glb`, 0, 256, false], ['patriot', `${P}/theater/models/patriot.glb`, 0, 512, false],
  ['s400', 'data/s400_dec.glb', 0, 512, true], ['zolf', 'data/zolf_dec.glb', 0, 512, true],
];
fs.mkdirSync('models', { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); await MeshoptSimplifier.ready;
const tris = d => d.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0) | 0;
const mime = n => n.endsWith('.png') ? 'image/png' : n.endsWith('.jpg') || n.endsWith('.jpeg') ? 'image/jpeg' : n.endsWith('.webp') ? 'image/webp' : 'application/octet-stream';
const only = process.argv[2]?.split(',');
for (const [n, src, simp, tex, anim, err] of L) { if (only && !only.includes(n)) continue;
  const doc = await io.read(src), before = tris(doc);
  await doc.transform(prune(), dedup(), ...(anim ? [] : [flatten(), join()]), weld());
  if (simp) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: simp, error: err ?? .004 }));
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 80 }), prune());
  const { json, resources } = await io.writeJSON(doc, { format: 'gltf' });
  for (const b of json.buffers || []) if (b.uri && resources[b.uri]) b.uri = `data:application/octet-stream;base64,${Buffer.from(resources[b.uri]).toString('base64')}`;
  for (const im of json.images || []) if (im.uri && resources[im.uri]) im.uri = `data:${mime(im.uri)};base64,${Buffer.from(resources[im.uri]).toString('base64')}`;
  const out = `models/${n}.gltf.json`; fs.writeFileSync(out, JSON.stringify(json));
  const b = getBounds(doc.getRoot().listScenes()[0]);
  console.log(`${n}: tris ${before} -> ${tris(doc)}, ${(fs.statSync(out).size / 1e6).toFixed(2)}MB, size=${b.max.map((x, i) => (x - b.min[i]).toFixed(2))}, anims=${doc.getRoot().listAnimations().map(a => a.getName()).join('|')}`);
}
