// يحوّل GLB إلى glTF نصي (JSON) فيه كل البيانات مضمّنة كـ data URI — صيغة مقبولة للنشر
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';
const [src, dst] = process.argv.slice(2);
// بدون وسائط: مجسماتنا + اللي نحتاجه من المسرح المجمّد (D-023) بأسماء t_* — قراءة بس
const THEATER = ['abrams', 't72', 'd30', 'grad', 'patriot', 's400', 'shahed', 'soldier', 'h_arabic4', 'h_arab1', 'h_arab2', 'h_arabic1', 'h_desert', 'h_low', 'p_palm', 'p_tree', 'p_acacia', 'p_car1', 'p_car2', 'p_pickup'];
if (!src) {
  for (const n of fs.readdirSync("models").filter(f => f.endsWith(".glb"))) await convert("models/" + n, "models/" + n.replace(".glb", ".gltf.json"));
  for (const n of THEATER) { const d = `models/t_${n}.gltf.json`; if (!fs.existsSync(d)) await convert(`../theater/models/${n}.glb`, d); }
  process.exit(0);
}
await convert(src, dst);
async function convert(src, dst) {
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const { json, resources } = await io.writeJSON(doc, { format: 'gltf' });
const mime = n => n.endsWith('.png') ? 'image/png' : n.endsWith('.jpg') || n.endsWith('.jpeg') ? 'image/jpeg' : n.endsWith('.webp') ? 'image/webp' : 'application/octet-stream';
for (const b of json.buffers || []) if (b.uri && resources[b.uri]) b.uri = `data:application/octet-stream;base64,${Buffer.from(resources[b.uri]).toString('base64')}`;
for (const im of json.images || []) if (im.uri && resources[im.uri]) im.uri = `data:${mime(im.uri)};base64,${Buffer.from(resources[im.uri]).toString('base64')}`;
fs.writeFileSync(dst, JSON.stringify(json));
console.log(dst, (fs.statSync(dst).size / 1e6).toFixed(2) + ' MB');
}
