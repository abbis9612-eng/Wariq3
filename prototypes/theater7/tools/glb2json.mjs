// يحوّل GLB إلى glTF نصي (JSON) فيه كل البيانات مضمّنة كـ data URI — صيغة مقبولة للنشر
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';
const [src, dst] = process.argv.slice(2);
if (!src) { fs.mkdirSync("models", { recursive: true }); const M = "../theater/models"; for (const n of fs.readdirSync(M).filter(f => f.endsWith(".glb"))) { const d = "models/" + n.replace(".glb", ".gltf.json"); if (!fs.existsSync(d)) await convert(M + "/" + n, d); } process.exit(0); }   // I-170: من المسرح المجمّد، بدون نسخ الـglb
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
