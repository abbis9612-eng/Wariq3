// خريطة البرج: يرسم مثلثات المجسم من الجنب ومن فوق، والأحمر = اللي راح يصير برج (حتى نضبط حدوده بالعين)
// node tools/turretmap.mjs models/abrams.glb out.png 'yCut,cx,cz,R,hw,z0,z1,gunDir,gunHalfW,gunY,pxPerM'
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
const [src, out, prm] = process.argv.slice(2); const [yCut, cx, cz, R, hw, z0, z1, gd, gw, gy, S0] = (prm || '99,0,0,0,0,0,0,1,0,99,60').split(',').map(Number);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(src);
const tris = []; let ni = 0; const PAL = [[230,25,75],[60,180,75],[0,130,200],[245,130,48],[145,30,180],[70,240,240],[240,50,230],[128,128,0],[0,0,128],[170,110,40],[0,128,128],[100,100,100]];
for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue; const M = n.getWorldMatrix();
  const tf = p => [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]];
  for (const pr of m.listPrimitives()) { const P = pr.getAttribute('POSITION'), I = pr.getIndices(); const cnt = I ? I.getCount() : P.getCount();
    for (let i = 0; i < cnt; i += 3) { const c = [0, 0, 0]; for (let k = 0; k < 3; k++) { const v = tf(P.getElement(I ? I.getScalar(i + k) : i + k, [])); c[0] += v[0] / 3; c[1] += v[1] / 3; c[2] += v[2] / 3; } c.push(ni); tris.push(c); } } ni++; }
// نفس قاعدة main.ts: دائرة (R>0) أو صندوق، وفوق خط القطع؛ والسبطانة: شريط ضيق قدّام البرج باتجاه gd
const isT = c => (c[1] > yCut && (R > 0 ? Math.hypot(c[0] - cx, c[2] - cz) < R : Math.abs(c[0] - cx) < hw && c[2] > z0 && c[2] < z1)) || (c[1] > gy && Math.abs(c[0] - cx) < gw && gd * (c[2] - cz) > 0);
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const c of tris) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], c[k]); mx[k] = Math.max(mx[k], c[k]); }
const S = S0 || 60, W = Math.ceil((mx[2] - mn[2]) * S) + 20, H1 = Math.ceil((mx[1] - mn[1]) * S) + 20, H2 = Math.ceil((mx[0] - mn[0]) * S) + 20, H = H1 + H2 + 10;
const buf = Buffer.alloc(W * H * 3, 255);
const put = (x, y, col) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 3; buf[o] = col[0]; buf[o + 1] = col[1]; buf[o + 2] = col[2]; };
let nT = 0;
for (const c of tris) { const t = isT(c); nT += t; const col = process.env.BYMESH ? PAL[c[3] % PAL.length] : t ? [220, 30, 30] : [60, 60, 60];
  put(Math.round((c[2] - mn[2]) * S) + 10, H1 - 10 - Math.round((c[1] - mn[1]) * S), col);   // من الجنب: z أفقي، y عمودي
  put(Math.round((c[2] - mn[2]) * S) + 10, H1 + 10 + Math.round((c[0] - mn[0]) * S), col); } // من فوق: z أفقي، x عمودي
// خطوط مرجعية كل متر
for (let z = Math.ceil(mn[2]); z <= mx[2]; z++) for (let y = 0; y < H; y += 3) put(Math.round((z - mn[2]) * S) + 10, y, z === 0 ? [0, 0, 255] : [180, 180, 255]);
for (let yy = Math.ceil(mn[1]); yy <= mx[1]; yy++) for (let x = 0; x < W; x += 3) put(x, H1 - 10 - Math.round((yy - mn[1]) * S), yy === 0 ? [0, 0, 255] : [180, 180, 255]);
await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(out);
console.log(out, 'tris', tris.length, 'turret', nT, 'min', mn.map(x => x.toFixed(2)), 'max', mx.map(x => x.toFixed(2)));
