// الأرض المجسمة حول المعركة (WM15.1، I-075، D-036): نخل وبيوت وسواتر ترابية — مو سطح فارغ.
// المواقع من صور الأقمار الحقيقية (tools/masks.py ← terrain/cl_mask.png): R خضرة (بساتين نخل على الشط وكارون)، G ماء، B عمران (البصرة، التنومة، شلامجة، خرمشهر...).
// تنبني بمربعات 400 م بس حول الكاميرا (نسخ رقيقة: نداء رسم واحد لكل نوع)، وتختفي من بعيد. ارتفاعها = الأرض × 1.3 (تضخيم الجبال من قريب ثابت).
import { Mesh, VertexData, StandardMaterial, Color3, Matrix, Quaternion, Vector3, type Scene } from '@babylonjs/core';
import maskUrl from '../terrain/cl_mask.png?url';
import LVJ from '../terrain/levels.json';
import { m2s, s2m } from './geo';
const CH = 400, EX = 1.3;
type GH = (x: number, y: number) => number;
// مولّد أرقام ثابت لكل مربع (نفس النخل كل مرة ترجع)
const hash = (i: number, j: number, k = 0) => { let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return () => { h = (h ^ (h >>> 15)) * 2246822519 | 0; h ^= h + Math.imul(h ^ (h >>> 7), 61 | h); return ((h ^ (h >>> 14)) >>> 0) / 4294967296; }; };
// ---------- أشكال خفيفة (تنرسم بالآلاف على التلفون) ----------
function palmMesh(scene: Scene) {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const v = (x: number, y: number, z: number, c: number[]) => { pos.push(x, y, z); col.push(c[0], c[1], c[2], 1); return pos.length / 3 - 1; };
  // جذع: سداسي مستدق ومايل شوي (الطول = 1)
  const S = 6, trunk = [.52, .40, .28];
  for (let k = 0; k <= 1; k++) for (let i = 0; i < S; i++) { const a = i / S * Math.PI * 2, r = k ? .016 : .024, t = trunk.map(c => c * (k ? 1.15 : .85)); v(Math.cos(a) * r + k * .04, k * .96, Math.sin(a) * r, t); }
  for (let i = 0; i < S; i++) { const a = i, b = (i + 1) % S; idx.push(a, S + a, b, b, S + a, S + b); }
  // تاج: 9 سعفات تنحني لتحت
  const top = [.04, .96, 0];
  for (let f = 0; f < 9; f++) {
    const a = f / 9 * Math.PI * 2 + (f % 2) * .2, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, L = .40 + (f % 3) * .05, g = [.30 + (f % 3) * .04, .50 + (f % 2) * .06, .20];
    const p0 = v(top[0], top[1], top[2], g.map(c => c * .8)), w = .07;
    const m1 = v(top[0] + dx * L * .5 + px * w, top[1] + .05, top[2] + dz * L * .5 + pz * w, g), m2 = v(top[0] + dx * L * .5 - px * w, top[1] + .05, top[2] + dz * L * .5 - pz * w, g);
    const tip = v(top[0] + dx * L, top[1] - .12 - (f % 2) * .05, top[2] + dz * L, g.map(c => c * 1.15));
    idx.push(p0, m1, m2, m1, tip, m2);
  }
  const m = new Mesh('palm', scene), vd = new VertexData(); vd.positions = pos; vd.colors = col; vd.indices = idx; const nrm: number[] = []; VertexData.ComputeNormals(pos, idx, nrm); vd.normals = nrm; vd.applyToMesh(m);
  return m;
}
// صندوق وحدة قاعدته بالصفر (بيت سقفه مستوي، أو ساتر ترابي مايل الجوانب)
function boxMesh(scene: Scene, name: string, topW = 1) {
  const t = topW / 2, P = [[-.5, 0, -.5], [.5, 0, -.5], [.5, 0, .5], [-.5, 0, .5], [-t, 1, -.5], [t, 1, -.5], [t, 1, .5], [-t, 1, .5]];
  const F = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]];
  const pos: number[] = [], idx: number[] = [];
  for (const f of F) { const b = pos.length / 3; for (const k of f) pos.push(...P[k]); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  const m = new Mesh(name, scene), vd = new VertexData(); vd.positions = pos; vd.indices = idx; const nrm: number[] = []; VertexData.ComputeNormals(pos, idx, nrm); vd.normals = nrm; vd.applyToMesh(m);
  return m;
}
// شجيرة صحراوية / كومة تراب: مجسم واطي بثمان وجوه
function shrubMesh(scene: Scene) {
  const P = [[0, 1, 0], [1, .25, 0], [0, .25, 1], [-1, .25, 0], [0, .25, -1], [0, 0, 0]], F = [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]];
  const pos: number[] = [], idx: number[] = []; for (const f of F) { const b = pos.length / 3; for (const k of f) pos.push(...P[k]); idx.push(b, b + 1, b + 2); }
  const m = new Mesh('shrub', scene), vd = new VertexData(); vd.positions = pos; vd.indices = idx; const nrm: number[] = []; VertexData.ComputeNormals(pos, idx, nrm); vd.normals = nrm; vd.applyToMesh(m); return m;
}
interface Chunk { palm: number[]; house: number[]; hcol: number[]; shrub: number[]; scol: number[] }
export class Props {
  palm: Mesh; house: Mesh; berm: Mesh; shrub: Mesh; ok = false; mask!: Uint8ClampedArray; mw = 0; mh = 0; m: number[]; O: { x: number; y: number };
  chunks = new Map<string, Chunk>(); key = ''; berms: number[] = []; on = true;
  constructor(scene: Scene, private gh: GH) {
    this.m = (LVJ as any).levels.cl.m; const a = m2s(this.m[0], this.m[1]), b = m2s(this.m[2], this.m[3]); this.O = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const mat = (n: string, c: Color3 | null, vcol = false) => { const s = new StandardMaterial(n, scene); if (c) s.diffuseColor = c; s.specularColor = Color3.Black(); s.backFaceCulling = false; if (vcol) s.diffuseColor = Color3.White(); return s; };
    this.palm = palmMesh(scene); this.palm.material = mat('palmM', null, true);
    this.house = boxMesh(scene, 'house'); this.house.material = mat('houseM', Color3.White());
    this.berm = boxMesh(scene, 'berm', .3); this.berm.material = mat('bermM', new Color3(.36, .30, .22));
    this.shrub = shrubMesh(scene); this.shrub.material = mat('shrubM', Color3.White());
    for (const ms of [this.palm, this.house, this.berm, this.shrub]) { ms.isPickable = false; ms.alwaysSelectAsActiveMesh = true; ms.thinInstanceSetBuffer('matrix', new Float32Array(16), 16, false); ms.thinInstanceCount = 0; }
    for (const ms of [this.house, this.shrub]) { ms.thinInstanceRegisterAttribute('color', 4); ms.thinInstanceSetBuffer('color', new Float32Array(4), 4, false); }
  }
  async load() {
    const img = new Image(); img.src = maskUrl; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(img, 0, 0);
    this.mask = x.getImageData(0, 0, c.width, c.height).data; this.mw = c.width; this.mh = c.height; this.ok = true;
  }
  /** قيم القناع (0–1) بنقطة: [خضرة، ماء، عمران] */
  at(x: number, y: number) {
    const { mx, my } = s2m(x, y), u = (mx - this.m[0]) / (this.m[2] - this.m[0]), v = (my - this.m[1]) / (this.m[3] - this.m[1]);
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return [0, 0, 0];
    const i = ((v * this.mh | 0) * this.mw + (u * this.mw | 0)) * 4; return [this.mask[i] / 255, this.mask[i + 1] / 255, this.mask[i + 2] / 255];
  }
  chunk(i: number, j: number): Chunk {
    const k = i + ',' + j; let c = this.chunks.get(k); if (c) return c;
    c = { palm: [], house: [], hcol: [], shrub: [], scol: [] }; const r = hash(i, j), x0 = i * CH, y0 = j * CH, q = new Quaternion(), s = new Vector3(), p = new Vector3();
    const put = (arr: number[], x: number, y: number, sx: number, sy: number, sz: number, yaw: number, sink = 0) => { Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, q); s.set(sx, sy, sz); p.set(x - this.O.x, this.gh(x, y) * EX - sink, y - this.O.y); arr.push(...Matrix.Compose(s, q, p).asArray()); };
    // نخل: شبكة 16 م مهزوزة، الاحتمال حسب الخضرة؛ ونخلات متفرقة بحدائق البيوت
    for (let a = 8; a < CH; a += 16) for (let b = 8; b < CH; b += 16) {
      const x = x0 + a + (r() - .5) * 12, y = y0 + b + (r() - .5) * 12, [veg, wat, blt] = this.at(x, y);
      if (wat > .35) continue;
      if (r() < Math.min(.95, veg * 1.8) || (blt > .3 && r() < .03)) { const h = 10 + r() * 7; put(c.palm, x, y, h * 1.15, h, h * 1.15, r() * 6.28, .3); }
    }
    // بيوت: شبكة 22 م باتجاه ثابت للحي، الاحتمال حسب العمران؛ طابق أو طابقين، ألوان طابوق/لبخ/جص
    const yaw0 = (hash(Math.floor(i / 4), Math.floor(j / 4), 7)() - .5) * .8;
    const ca = Math.cos(yaw0), sa = Math.sin(yaw0);
    for (let a = 11; a < CH; a += 22) for (let b = 11; b < CH; b += 22) {
      const x = x0 + a + (r() - .5) * 4, y = y0 + b + (r() - .5) * 4, [veg, wat, blt] = this.at(x, y);
      // شوارع: البيت على شبكة الحي المايلة، وكل خامس صف ورابع عمود فراغ
      const u = Math.floor((x * ca + y * sa) / 22), w_ = Math.floor((-x * sa + y * ca) / 22); if (((u % 5) + 5) % 5 === 0 || ((w_ % 4) + 4) % 4 === 0) continue;
      if (wat > .2 || veg > .6 || r() > blt * .9) continue;
      const w = 8 + r() * 8, d = 8 + r() * 8, h = r() < .28 ? 6.5 + r() * 1.5 : 3.2 + r() * .8;
      put(c.house, x, y, w, h, d, yaw0 + (r() - .5) * .06, .2);
      const t = r(), base = t < .45 ? [.82, .74, .6] : t < .75 ? [.74, .66, .54] : t < .9 ? [.86, .84, .8] : [.62, .52, .42], k = .9 + r() * .15;
      c.hcol.push(base[0] * k, base[1] * k, base[2] * k, 1);
    }
    // الصحرا مو فارغة: شجيرات عاقول وأكوام تراب متفرقة
    for (let a = 10; a < CH; a += 30) for (let b = 10; b < CH; b += 30) {
      const x = x0 + a + (r() - .5) * 26, y = y0 + b + (r() - .5) * 26, [veg, wat, blt] = this.at(x, y);
      if (wat > .2 || blt > .25 || r() > .35 + veg * .4) continue;
      const mound = r() < .3, w = mound ? 2 + r() * 3 : .8 + r() * 1.4; put(c.shrub, x, y, w, mound ? w * .35 : w * .8, w * (.7 + r() * .6), r() * 6.28, .1);
      const col = mound ? [.55, .47, .35] : r() < .5 ? [.38, .42, .22] : [.47, .43, .28]; c.scol.push(col[0], col[1], col[2], 1);
    }
    this.chunks.set(k, c); if (this.chunks.size > 900) this.chunks.delete(this.chunks.keys().next().value!);
    return c;
  }
  /** سواتر ترابية: خط دفاع (من نقطة لنقطة) + سواتر قدام الدبابات المحفورة */
  setBerms(lines: { a: { x: number; y: number }; b: { x: number; y: number } }[], revets: { x: number; y: number; hd: number }[]) {
    const out: number[] = [], q = new Quaternion(), s = new Vector3(), p = new Vector3();
    const seg = (x: number, y: number, len: number, yaw: number, h = 2.4, w = 7) => { Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, q); s.set(len, h, w); p.set(x - this.O.x, this.gh(x, y) * EX - .3, y - this.O.y); out.push(...Matrix.Compose(s, q, p).asArray()); };
    for (const { a, b } of lines) { const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(L / 60), yaw = -Math.atan2(b.y - a.y, b.x - a.x);
      for (let k = 0; k < n; k++) { if (k % 9 === 4) continue; const t = (k + .5) / n, z = (k % 2 ? 1 : -1) * 4; seg(a.x + (b.x - a.x) * t - (b.y - a.y) / L * z, a.y + (b.y - a.y) * t + (b.x - a.x) / L * z, 62, yaw); } }
    // ساتر حدوة قدام كل دبابة محفورة (يغطي الجسم ويبين البرج)
    for (const r of revets) { const fx = Math.cos(r.hd), fy = Math.sin(r.hd), yaw = -Math.atan2(fy, fx) + Math.PI / 2;
      seg(r.x + fx * 8, r.y + fy * 8, 14, yaw, 2.1, 5); seg(r.x + fx * 3 + fy * 6, r.y + fy * 3 - fx * 6, 9, yaw + 1.2, 1.9, 4.5); seg(r.x + fx * 3 - fy * 6, r.y + fy * 3 + fx * 6, 9, yaw - 1.2, 1.9, 4.5); }
    this.berms = out; this.berm.thinInstanceSetBuffer('matrix', new Float32Array(out.length ? out : new Array(16).fill(0)), 16, false); this.berm.thinInstanceCount = out.length / 16;
  }
  /** كل إطار: أي مربعات حول الكاميرا تنرسم (يعيد البناء بس لما تتغير) */
  update(cam: { x: number; y: number; D: number; tilt: number; head: number }) {
    const show = this.ok && this.on && cam.D < 9000;
    for (const ms of [this.palm, this.house, this.berm, this.shrub]) { ms.setEnabled(show || (ms === this.berm && this.on && cam.D < 30000)); ms.position.set(this.O.x - cam.x, 0, this.O.y - cam.y); }
    if (!show) return;
    // المركز ينزاح لقدّام مع الميلان (اللي قدام الكاميرا أهم)
    const R = Math.min(2600, Math.max(900, cam.D * 1.7)), fwd = Math.min(R * .6, cam.D * Math.sin(cam.tilt)), cx = cam.x + Math.sin(cam.head) * fwd, cy = cam.y + Math.cos(cam.head) * fwd;
    const i0 = Math.floor((cx - R) / CH), i1 = Math.floor((cx + R) / CH), j0 = Math.floor((cy - R) / CH), j1 = Math.floor((cy + R) / CH), key = `${i0},${i1},${j0},${j1}`;
    if (key === this.key) return; this.key = key;
    const P: number[] = [], H: number[] = [], HC: number[] = [], SB: number[] = [], SC: number[] = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const dx = (i + .5) * CH - cx, dy = (j + .5) * CH - cy; if (dx * dx + dy * dy > (R + CH) * (R + CH)) continue; const c = this.chunk(i, j); P.push(...c.palm); H.push(...c.house); HC.push(...c.hcol); if (dx * dx + dy * dy < 1600 * 1600) { SB.push(...c.shrub); SC.push(...c.scol); } }
    const set = (ms: Mesh, a: number[]) => { ms.thinInstanceSetBuffer('matrix', new Float32Array(a.length ? a : new Array(16).fill(0)), 16, false); ms.thinInstanceCount = a.length / 16; };
    set(this.palm, P); set(this.house, H); this.house.thinInstanceSetBuffer('color', new Float32Array(HC.length ? HC : [1, 1, 1, 1]), 4, false);
    set(this.shrub, SB); this.shrub.thinInstanceSetBuffer('color', new Float32Array(SC.length ? SC : [1, 1, 1, 1]), 4, false);
  }
  stats() { return { palms: this.palm.thinInstanceCount, houses: this.house.thinInstanceCount, shrubs: this.shrub.thinInstanceCount, berms: this.berm.thinInstanceCount, chunks: this.chunks.size }; }
}
