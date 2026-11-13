// مولّد الأرض: يبني خريطة ارتفاع (جبال، هضاب، وديان) مع تعرية مائية، ويخبز الظلال والتفاصيل بصور.
// التشغيل: node tools/genterrain.mjs   ← يكتب textures/land_h.png و land_a.webp و land_b.webp
import sharp from 'sharp';
import { LAND, HN, HMIN, HMAX, WADI_FLOOR, ROADS, WADIS, PADS, RIDGE_X } from '../src/land.ts';
import { riverX, RIVER_W, HIGHWAY_Z } from '../src/sim.ts';

const N = HN, CELL = LAND / (N - 1), h = new Float32Array(N * N);
const X = i => i * CELL - LAND / 2;
const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
// ضجيج قيمة بسيط وثابت
const hash = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 1274126177) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
function vn(x, y, s = 0) { const xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi, u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
  return lerp(lerp(hash(xi, yi, s), hash(xi + 1, yi, s), u), lerp(hash(xi, yi + 1, s), hash(xi + 1, yi + 1, s), u), v) * 2 - 1; }
function fbm(x, y, o, s = 0) { let a = 0, amp = 1, tot = 0; for (let i = 0; i < o; i++) { a += amp * vn(x, y, s + i * 17); tot += amp; amp *= 0.5; x = x * 2.03 + 11.3; y = y * 2.03 - 7.1; } return a / tot; }
function ridged(x, y, o, s = 0) { let a = 0, amp = 1, tot = 0, prev = 1; for (let i = 0; i < o; i++) { let n = 1 - Math.abs(vn(x, y, s + i * 31)); n *= n; a += amp * n * prev; prev = n; tot += amp; amp *= 0.5; x = x * 2.1 + 3.7; y = y * 2.1 + 9.2; } return a / tot; }
const distSeg = (x, z, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))); return Math.hypot(x - ax - vx * t, z - az - vz * t); };
const distPoly = (x, z, pts) => { let d = 1e9; for (let i = 1; i < pts.length; i++) d = Math.min(d, distSeg(x, z, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])); return d; };

console.time('base');
const wadiMask = new Float32Array(N * N);
for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
  const x = X(ix), z = X(iz), i = iz * N + ix;
  const wx = x + 380 * vn(x / 1700, z / 1700, 3), wz = z + 380 * vn(x / 1700, z / 1700, 4);
  let keep = 0; for (const [px, pz, r] of PADS) keep = Math.max(keep, 1 - sm(r + 60, r + 520, Math.hypot(x - px, z - pz)));
  keep = Math.max(keep, 1 - sm(150, 700, Math.abs(z - HIGHWAY_Z)) * 1);                       // وادي الطريق يبقى مفتوح
  let v = 8 * fbm(wx / 950, wz / 950, 4, 1) + 2.2 * fbm(wx / 210, wz / 210, 3, 9) + 4;
  const mN = sm(3250, 5300, z + 480 * vn(x / 2100, 0.3, 7)), mS = sm(-3550, -5500, z + 480 * vn(x / 1900, 0.7, 13));
  const rid = ridged(wx / 1650, wz / 1650, 5, 21);
  v += Math.pow(mN, 1.35) * (70 + 470 * Math.pow(rid, 1.25)) + Math.pow(mS, 1.35) * (55 + 340 * Math.pow(ridged(wx / 1400 + 40, wz / 1400, 5, 77), 1.25));
  const mesa = sm(0.02, 0.13, fbm(wx / 1500 + 50, wz / 1500, 3, 41)) * sm(-2950, -3700, x) * (1 - keep);
  v += mesa * (48 + 22 * vn(x / 600, z / 600, 5) + 10 * ridged(wx / 300, wz / 300, 3, 5));
  const jeb = sm(0.3, 0.52, fbm(wx / 1050 + 90, wz / 1050 + 30, 3, 55)) * sm(1300, 2300, x) * (1 - keep);
  v += jeb * (38 + 28 * ridged(wx / 500, wz / 500, 4, 63));
  v += 30 * sm(0.42, 0.62, fbm(wx / 800 + 7, wz / 800 + 70, 3, 91)) * (1 - keep) * (1 - sm(-2700, -3300, x)) * (1 - sm(1100, 1700, x)) * sm(900, 1700, Math.abs(z - HIGHWAY_Z)); // تلال متفرقة بالوسط
  // تلّة خط الدفاع (مقطوعة عند الطريق)
  v += 7.5 * Math.exp(-(((x - RIDGE_X) / 60) ** 2)) * sm(-1250, -900, z) * sm(520, 180, z);
  // وديان فرعية متعرجة
  const mx = x + 70 * vn(x / 260, z / 260, 31), mz = z + 70 * vn(x / 260, z / 260, 32);
  for (const w of WADIS) { const d = distPoly(mx, mz, w.pts), t = d / w.w, k = 1 - sm(0.45, 1.5, t);
    v -= Math.max(0, v - 6) * 0.8 * (1 - sm(1.2, 7, t)); v -= w.d * k; wadiMask[i] = Math.max(wadiMask[i], 1 - sm(0.5, 1.1, t)); }
  // الوادي الرئيسي
  const d = Math.abs(x - riverX(z)), hw = RIVER_W(z) / 2;
  v -= Math.max(0, v - 5) * 0.88 * (1 - sm(hw * 1.4, hw * 1.4 + 620, d));
  v = lerp(v, WADI_FLOOR, 1 - sm(hw * 0.72, hw * 1.55, d)); wadiMask[i] = Math.max(wadiMask[i], 1 - sm(hw * 0.8, hw * 1.25, d));
  h[i] = v;
}
console.timeEnd('base');

// ===== تعرية مائية بالقطرات (خوارزمية معروفة: كل قطرة تنزل، تحفر وتترسب) =====
console.time('erode');
const sed = new Float32Array(N * N), ero = new Float32Array(N * N);
{
  const hc = h; const S = 1 / CELL; for (let i = 0; i < hc.length; i++) hc[i] *= S;
  let seed = 12345; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const R = 3, brush = []; { let tot = 0; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const d = Math.hypot(dx, dy); if (d < R) { brush.push([dx, dy, 1 - d / R]); tot += 1 - d / R; } } brush.forEach(b => (b[2] /= tot)); }
  const grad = (px, py) => { const x = px | 0, y = py | 0, u = px - x, v = py - y, i = y * N + x, a = hc[i], b = hc[i + 1], c = hc[i + N], d = hc[i + N + 1];
    return [(b - a) * (1 - v) + (d - c) * v, (c - a) * (1 - u) + (d - b) * u, a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v]; };
  const DROPS = 420000, inertia = 0.06, cap = 5, minSlope = 0.01, kE = 0.28, kD = 0.3, evap = 0.012, grav = 4;
  for (let n = 0; n < DROPS; n++) {
    let px = rnd() * (N - 3) + 1, py = rnd() * (N - 3) + 1, dx = 0, dy = 0, sp = 1, water = 1, s = 0;
    for (let life = 0; life < 48; life++) {
      const x = px | 0, y = py | 0, u = px - x, v = py - y, [gx, gy, h0] = grad(px, py);
      dx = dx * inertia - gx * (1 - inertia); dy = dy * inertia - gy * (1 - inertia); const l = Math.hypot(dx, dy); if (l < 1e-9) break; dx /= l; dy /= l;
      px += dx; py += dy; if (px < 1 || px > N - 2 || py < 1 || py > N - 2) break;
      const dh = grad(px, py)[2] - h0, c = Math.max(-dh, minSlope) * sp * water * cap, i = y * N + x;
      if (s > c || dh > 0) { const dep = dh > 0 ? Math.min(dh, s) : (s - c) * kD; s -= dep;
        hc[i] += dep * (1 - u) * (1 - v); hc[i + 1] += dep * u * (1 - v); hc[i + N] += dep * (1 - u) * v; hc[i + N + 1] += dep * u * v; sed[i] += dep; }
      else { const amt = Math.min((c - s) * kE, -dh);
        for (const [bx, by, w] of brush) { const xx = x + bx, yy = y + by; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const j = yy * N + xx, d = Math.min(hc[j] + 2, amt * w); hc[j] -= d; s += d; ero[j] += d; } }
      sp = Math.sqrt(Math.max(0, sp * sp + dh * -grav)); water *= 1 - evap;
    }
  }
  for (let i = 0; i < hc.length; i++) hc[i] *= CELL;
}
console.timeEnd('erode');

// ===== بعد التعرية: قاع الوادي، الأماكن المنبسطة، الطريق الرئيسي والمدرج =====
for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) { const x = X(ix), z = X(iz), i = iz * N + ix, d = Math.abs(x - riverX(z)), hw = RIVER_W(z) / 2;
  h[i] = lerp(h[i], WADI_FLOOR + 0.5 * vn(x / 40, z / 40, 88), 1 - sm(hw * 0.7, hw * 1.2, d)); }
const sample = (x, z) => { const fx = Math.min(N - 1.001, Math.max(0, (x + LAND / 2) / CELL)), fz = Math.min(N - 1.001, Math.max(0, (z + LAND / 2) / CELL)), ix = fx | 0, iz = fz | 0, u = fx - ix, v = fz - iz, i = iz * N + ix;
  return (h[i] * (1 - u) + h[i + 1] * u) * (1 - v) + (h[i + N] * (1 - u) + h[i + N + 1] * u) * v; };
for (const [px, pz, r] of PADS) {
  let tot = 0, n = 0; for (let a = 0; a < 6.28; a += 0.3) for (const rr of [0, r * 0.3, r * 0.6]) { tot += sample(px + Math.cos(a) * rr, pz + Math.sin(a) * rr); n++; }
  const target = Math.max(1.5, tot / n);
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) { const d = Math.hypot(X(ix) - px, X(iz) - pz); if (d < r + 200) { const i = iz * N + ix; h[i] = lerp(h[i], target + 0.25 * vn(X(ix) / 30, X(iz) / 30, 90), 1 - sm(r, r + 190, d)); } }
}
for (const [ax, az, bx, bz, hw, kind] of ROADS) {
  if (kind === 1) continue;
  const len = Math.hypot(bx - ax, bz - az), M = Math.ceil(len / 20), prof = new Float32Array(M + 1);
  for (let k = 0; k <= M; k++) prof[k] = sample(lerp(ax, bx, k / M), lerp(az, bz, k / M));
  const W = kind === 2 ? 60 : 9, smp = new Float32Array(M + 1);
  for (let k = 0; k <= M; k++) { let t = 0, n = 0; for (let j = Math.max(0, k - W); j <= Math.min(M, k + W); j++) { t += prof[j]; n++; } smp[k] = t / n; }
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) { const x = X(ix), z = X(iz), vx = bx - ax, vz = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / (len * len))), d = Math.hypot(x - ax - vx * t, z - az - vz * t);
    if (d < hw + 70) { const f = t * M, k0 = Math.min(M - 1, f | 0), target = lerp(smp[k0], smp[k0 + 1], f - k0), i = iz * N + ix; h[i] = lerp(h[i], target, 1 - sm(hw + 3, hw + 62, d)); } }
}
let lo = 1e9, hi = -1e9; for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
console.log('height range', lo.toFixed(1), hi.toFixed(1));
if (lo < HMIN || hi > HMAX) throw new Error('الارتفاع طلع برّا المدى');

// ===== الخَبز: اتجاه السطح، ظل الشمس، التظليل المحيطي، أقنعة الوادي والرواسب =====
console.time('bake');
const SUN = (() => { const v = [0.42, 0.78, 0.46], l = Math.hypot(...v); return v.map(c => c / l); })();
const H = (x, y) => h[Math.min(N - 1, Math.max(0, y)) * N + Math.min(N - 1, Math.max(0, x))];
const A = Buffer.alloc(N * N * 3), B = Buffer.alloc(N * N * 3), HP = Buffer.alloc(N * N * 3), PV = Buffer.alloc(N * N * 3);
const sh = new Float32Array(N * N), sl = Math.hypot(SUN[0], SUN[2]), sdx = SUN[0] / sl, sdz = SUN[2] / sl, rise = SUN[1] / sl * CELL;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const h0 = h[y * N + x] + 0.6; let m = 1;
  for (let t = 1; t < 260; t++) { const rx = x + sdx * t, ry = y + sdz * t; if (rx < 0 || ry < 0 || rx > N - 1 || ry > N - 1) break; const rh = h0 + rise * t; if (rh > hi) break;
    const th = H(Math.round(rx), Math.round(ry)); m = Math.min(m, (rh - th) / (t * CELL) * 9 + 0.5); if (m <= 0) break; }
  sh[y * N + x] = Math.min(1, Math.max(0, m)); }
const blur = (src, r) => { const tmp = new Float32Array(N * N), out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let t = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < N) { t += src[y * N + xx]; n++; } } tmp[y * N + x] = t / n; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let t = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < N) { t += tmp[yy * N + x]; n++; } } out[y * N + x] = t / n; } return out; };
const shB = blur(sh, 1), sedB = blur(sed, 2), eroB = blur(ero, 1), hB = blur(h, 6), hB2 = blur(h, 22);
let sedMax = 0, eroMax = 0; for (let i = 0; i < N * N; i++) { sedMax = Math.max(sedMax, sedB[i]); eroMax = Math.max(eroMax, eroB[i]); }
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, o = i * 3;
  const dx = (H(x + 1, y) - H(x - 1, y)) / (2 * CELL), dz = (H(x, y + 1) - H(x, y - 1)) / (2 * CELL), l = Math.hypot(dx, 1, dz), nx = -dx / l, ny = 1 / l, nz = -dz / l;
  const ao = Math.min(1, Math.max(0, 1 - Math.max(0, hB[i] - h[i]) * 0.07 - Math.max(0, hB2[i] - h[i]) * 0.012));
  const gully = Math.min(1, Math.pow(eroB[i] / eroMax, 0.5) * 2.2), sd = Math.min(1, Math.pow(sedB[i] / sedMax, 0.45) * 1.6);
  A[o] = Math.round((nx * 0.5 + 0.5) * 255); A[o + 1] = Math.round((nz * 0.5 + 0.5) * 255); A[o + 2] = Math.round(Math.min(1, wadiMask[i]) * 255);
  B[o] = Math.round(shB[i] * 255); B[o + 1] = Math.round(ao * 255); B[o + 2] = Math.round(Math.max(sd * 0.75, gully * 0.0) * 255 * 1) | 0; B[o + 2] = Math.round((sd * 0.5 + 0.5 - gully * 0.5) * 255);
  const q = Math.round((h[i] - HMIN) / (HMAX - HMIN) * 65535); HP[o] = q >> 8; HP[o + 1] = q & 255; HP[o + 2] = 0;
  const lit = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]) * (0.35 + 0.65 * shB[i]) * ao + 0.18, slope = 1 - ny, rock = sm(0.1, 0.3, slope);
  const c = [lerp(205, 150, rock), lerp(170, 105, rock), lerp(120, 70, rock)].map(v => v * lit * (1 - 0.3 * wadiMask[i]));
  PV[o] = Math.min(255, c[0]); PV[o + 1] = Math.min(255, c[1]); PV[o + 2] = Math.min(255, c[2]); }
console.timeEnd('bake');
const raw = { raw: { width: N, height: N, channels: 3 } };
await sharp(HP, raw).png({ compressionLevel: 9 }).toFile('textures/land_h.png');
await sharp(A, raw).resize(1024, 1024).webp({ quality: 92 }).toFile('textures/land_a.webp');
await sharp(B, raw).resize(1024, 1024).webp({ quality: 88 }).toFile('textures/land_b.webp');
await sharp(PV, raw).png().toFile(process.argv[2] || '/tmp/land_preview.png');
console.log('done');
