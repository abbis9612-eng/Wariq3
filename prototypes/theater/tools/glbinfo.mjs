import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/core';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const root = doc.getRoot();
  console.log('==', f, 'textures', root.listTextures().map(t => (t.getImage()?.byteLength / 1e3 | 0) + 'KB').join(','));
  for (const n of root.listNodes()) { const m = n.getMesh(); if (!m) continue; const b = getBounds(n);
    let tris = 0; for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
    console.log(`  ${n.getName().slice(0, 34).padEnd(34)} tris=${tris | 0} min=${b.min.map(x => x.toFixed(2))} max=${b.max.map(x => x.toFixed(2))}`); }
}
