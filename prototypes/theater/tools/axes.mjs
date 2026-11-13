// يحسب: مركز الصندوق مقابل مركز الكتلة (المدفع/الأنف يسحب الصندوق لقدّام)، وزاوية المحور الطويل بالمستوى الأفقي (PCA)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const mul = (m, p) => [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const pts = [];
  for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue; const W = n.getWorldMatrix();
    for (const pr of m.listPrimitives()) { const a = pr.getAttribute('POSITION'); const e = []; for (let i = 0; i < a.getCount(); i++) pts.push(mul(W, a.getElement(i, e))); } }
  const mn = [0,1,2].map(k => Math.min(...pts.map(p => p[k]))), mx = [0,1,2].map(k => Math.max(...pts.map(p => p[k])));
  const c = [0,1,2].map(k => pts.reduce((s, p) => s + p[k], 0) / pts.length), bc = [0,1,2].map(k => (mn[k] + mx[k]) / 2);
  let sxx = 0, szz = 0, sxz = 0; for (const p of pts) { const dx = p[0]-c[0], dz = p[2]-c[2]; sxx += dx*dx; szz += dz*dz; sxz += dx*dz; }
  const ang = 0.5 * Math.atan2(2*sxz, sxx - szz) * 180 / Math.PI; // زاوية المحور الطويل عن x
  console.log(f.split('/').pop().padEnd(14), 'size', mx.map((v,k)=>(v-mn[k]).toFixed(2)).join(','), '| boxC-massC z=', (bc[2]-c[2]).toFixed(2), 'x=', (bc[0]-c[0]).toFixed(2), '| long-axis angle from x:', ang.toFixed(1), '| minY', mn[1].toFixed(2));
}
