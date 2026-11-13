// تصميم الأرض: ملف مشترك بين مولّد الأرض (tools/genterrain.mjs) والرسم (main.ts). بدون أي رسم.
// الفكرة (I-027): سهل صحراوي بالوسط للقتال، وديان جافة تقطعه، هضاب غرباً، سلسلتين جبال شمالاً وجنوباً، وقرية على الوادي.
import type { V3 } from './sim.ts';
import { SITES, riverX, RIVER_W, HIGHWAY_Z, BERMS, PATRIOT_POS, S400_POS, site } from './sim.ts';

export const LAND = 13000;          // عرض الأرض بالمتر
export const HN = 1025;             // دقة خريطة الارتفاع
export const HMIN = -30, HMAX = 630;
export const WADI_FLOOR = -9;

// الطرق كلها ترابية: [ax, az, bx, bz, نص العرض, النوع: 0 طريق رئيسي، 1 درب، 2 مدرج ترابي]
export type Seg = [number, number, number, number, number, number];
const poly = (pts: [number, number][], hw: number, kind: number): Seg[] => pts.slice(1).map((b, i) => [pts[i][0], pts[i][1], b[0], b[1], hw, kind]);
const G = site('green').p, AP = site('airport').p, TJ = site('taji').p, DR = site('dora').p, RS = site('rasheed').p;
export const HIGHWAY_END = riverX(HIGHWAY_Z) - 150;
export const STRIP_ROT = 0.18, STRIP_LEN = 1500;
const sx = Math.sin(STRIP_ROT) * STRIP_LEN / 2, sz = Math.cos(STRIP_ROT) * STRIP_LEN / 2;
export const ROADS: Seg[] = [
  [-6500, HIGHWAY_Z, HIGHWAY_END, HIGHWAY_Z, 8, 0],
  ...poly([[HIGHWAY_END, HIGHWAY_Z], [G[0] - 60, G[2] - 40]], 5, 1),
  ...poly([[-700, HIGHWAY_Z], [-760, 500], [-820, 1500], [TJ[0] + 60, TJ[2] - 120]], 4, 1),
  ...poly([[-760, 600], [PATRIOT_POS[0] - 30, PATRIOT_POS[2] - 10]], 3.5, 1),
  ...poly([[G[0] + 40, G[2] - 60], [riverX(-900), -900], [DR[0] - 120, DR[2] + 60], [RS[0] - 100, RS[2] + 40]], 4, 1),
  ...poly([[AP[0] + 60, HIGHWAY_Z], [AP[0] + 150, AP[2] + 500]], 4, 1),
  ...poly([[riverX(900) + 20, 900], [S400_POS[0] - 20, S400_POS[2] - 30]], 3.5, 1),
  [AP[0] - sx, AP[2] - sz, AP[0] + sx, AP[2] + sz, 16, 2],
];
// وديان فرعية (تصب بالوادي الرئيسي): نقاط + عرض + عمق
export const WADIS: { pts: [number, number][]; w: number; d: number }[] = [
  { pts: [[-5600, 3300], [-4700, 1900], [-3900, 500], [-3750, -350], [-3850, -1300], [-3350, -2500], [-1900, -3300], [riverX(-3700), -3700]], w: 60, d: 6.5 },
  { pts: [[-3300, 4000], [-2400, 2600], [-1700, 1500], [-1250, 650], [-450, 320], [riverX(420), 420]], w: 45, d: 5 },
  { pts: [[4200, 3300], [2900, 1900], [1700, 900], [riverX(150) + 60, 150]], w: 50, d: 5.5 },
  { pts: [[3800, -3600], [2700, -2900], [1500, -2950], [riverX(-2900) + 60, -2900]], w: 45, d: 5 },
];
// أماكن تنبسط (مواقع، بطاريات): [x, z, نص القطر, الارتفاع أو null = معدل الأرض]
export const PADS: [number, number, number][] = [
  ...SITES.map(s => [s.p[0], s.p[2], s.id === 'airport' ? 120 : 210] as [number, number, number]),
  [PATRIOT_POS[0], PATRIOT_POS[2], 60], [S400_POS[0], S400_POS[2], 55], [-1050, -660, 90], [-1830, HIGHWAY_Z, 70], [-5080, -1400, 90],
];
export const RIDGE_X = -2100;   // تلّة الدفاع: خط الأبرامز عليها والسواتر فوقها

// ===== قراءة الارتفاع وقت اللعب =====
let hmap: Float32Array | null = null;
export function setHeightData(h: Float32Array) { hmap = h; }
function base(x: number, z: number) {
  if (!hmap) return 0;
  const fx = clampN((x / LAND + 0.5) * (HN - 1), 0, HN - 1.001), fz = clampN((z / LAND + 0.5) * (HN - 1), 0, HN - 1.001);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * HN + ix;
  return (hmap[i] * (1 - tx) + hmap[i + 1] * tx) * (1 - tz) + (hmap[i + HN] * (1 - tx) + hmap[i + HN + 1] * tx) * tz;
}
const clampN = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
// السواتر الترابية: كومة تراب قدّام كل دبابة (تنضاف فوق خريطة الارتفاع حتى تكون دقيقة)
export function bermH(x: number, z: number) {
  let h = 0;
  for (const b of BERMS) { const dx = (x - b[0] - 22) / 3.5, dz = Math.abs(z - b[2]) - 9; const kz = dz < 0 ? 1 : Math.exp(-((dz / 4) ** 2)); h = Math.max(h, 2.1 * Math.exp(-dx * dx) * kz); }
  return h;
}
export const groundH = (x: number, z: number) => base(x, z) + bermH(x, z);
export function groundN(x: number, z: number, e = 3): V3 {
  const dx = groundH(x + e, z) - groundH(x - e, z), dz = groundH(x, z + e) - groundH(x, z - e), l = Math.hypot(dx, 2 * e, dz);
  return [-dx / l, 2 * e / l, -dz / l];
}
// المسافة لأقرب طريق (للخريطة المصغرة وتوزيع الأشياء)
export function roadDist(x: number, z: number) {
  let best = 1e9;
  for (const [ax, az, bx, bz, hw] of ROADS) { const vx = bx - ax, vz = bz - az, t = clampN(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1); best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t) - hw); }
  return best;
}
export const wadiDist = (x: number, z: number) => Math.abs(x - riverX(z)) - RIVER_W(z) / 2;
