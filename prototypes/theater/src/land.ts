// تصميم الأرض: ملف مشترك بين مولّد الأرض (tools/genterrain.mjs) والرسم (main.ts). بدون أي رسم.
// الفكرة (I-027): سهل صحراوي بالوسط للقتال، وديان جافة تقطعه، هضاب غرباً، سلسلتين جبال شمالاً وجنوباً، وقرية على الوادي.
import type { V3 } from './geo.ts';
import { SITES, riverX, RIVER_W, HIGHWAY_Z, BERMS, BERMS2, PATRIOT_POS, S400_POS, site, rng } from './geo.ts';

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
  [-1480, HIGHWAY_Z + 10, 250],   // قرية الطريق (ساحة الاشتباك)
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
  for (const b of [...BERMS, ...BERMS2]) { const dx = (x - b[0] - 22) / 3.5, dz = Math.abs(z - b[2]) - 9; const kz = dz < 0 ? 1 : Math.exp(-((dz / 4) ** 2)); h = Math.max(h, 2.1 * Math.exp(-dx * dx) * kz); }
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

// ===== القرى والبيوت (I-031): بيانات بدون رسم، حتى المحاكاة تعرف وين البيوت (ساتر، يسد النظر) =====
// أنواع البيوت: مجسمات حقيقية من Sketchfab (CC BY) — المقاسات بعد التكبير (عرض × ارتفاع × عمق بالمتر)
export interface HouseType { model: string; s: number; w: number; h: number; d: number; weight: number; farm?: boolean }
export const HOUSE_TYPES: HouseType[] = [
  { model: 'h_arabic4', s: 1.50, w: 10.6, h: 6.8, d: 9.6, weight: 0.27 },   // بيت طين بباب خشب مقوّس
  { model: 'h_arab1', s: 1.25, w: 12.0, h: 8.1, d: 11.6, weight: 0.16 },     // بيت بلوك بسياج طابوق
  { model: 'h_arab2', s: 1.62, w: 6.1, h: 5.6, d: 12.8, weight: 0.14 },    // بيت ضيق ملبّخ
  { model: 'h_arabic1', s: 1.25, w: 10.1, h: 7.1, d: 14.9, weight: 0.12 },  // بيت أبيض بقبة ودرج
  { model: 'h_desert', s: 0.75, w: 10.4, h: 10.5, d: 15.8, weight: 0.08 },   // بيت بطابقين وأقواس
  { model: 'h_low', s: 1.12, w: 16.2, h: 8.1, d: 11.2, weight: 0.14 },          // بيت بسقف جينكو
  { model: 'h_farm', s: 1.50, w: 6.2, h: 4.1, d: 9.2, weight: 0.09, farm: true }, // سقيفة مزرعة
];
export interface House { i: number; x: number; z: number; rot: number; t: number; w: number; d: number; h: number; vil: string; yard: boolean }
export interface Village { id: string; name: string; x: number; z: number; n: number; rad: number; rot: number; street: boolean }
const GV = site('green').p;
export const VILLAGES: Village[] = [
  { id: 'front', name: 'قرية الطريق', x: -1480, z: HIGHWAY_Z + 10, n: 62, rad: 240, rot: 0, street: true },
  { id: 'river', name: 'قرية الوادي', x: GV[0] - 30, z: GV[2], n: 52, rad: 190, rot: 0.25, street: false },
  { id: 'v3', name: 'قرية التل', x: -3080, z: 420, n: 10, rad: 95, rot: 0.6, street: false },
  { id: 'v4', name: 'قرية الشرق', x: 1330, z: 640, n: 12, rad: 110, rot: -0.3, street: false },
  { id: 'v5', name: 'قرية الجنوب', x: -640, z: -1560, n: 9, rad: 90, rot: 0.1, street: false },
  { id: 'v6', name: 'قرية النخيل', x: riverX(1900) - 260, z: 1900, n: 8, rad: 80, rot: 0.4, street: false },
];
function pickType(r: () => number, farm: boolean) { const list = HOUSE_TYPES.map((t, i) => [i, t.farm && !farm ? 0 : t.weight] as [number, number]); let x = r() * list.reduce((a, b) => a + b[1], 0); for (const [i, w] of list) { x -= w; if (x <= 0) return i; } return 0; }
export const HOUSES: House[] = (() => {
  const r = rng(4242), out: House[] = [];
  const ok = (x: number, z: number, rad: number) => roadDist(x, z) > rad * 0.75 + 4 && wadiDist(x, z) > 24 && out.every(h => Math.hypot(h.x - x, h.z - z) > rad + Math.max(h.w, h.d) * 0.55 + 2.5);
  const add = (v: Village, x: number, z: number, rot: number) => {
    const t = pickType(r, Math.hypot(x - v.x, z - v.z) > v.rad * 0.7), T = HOUSE_TYPES[t], rad = Math.max(T.w, T.d) * 0.55;
    if (!ok(x, z, rad)) return false;
    out.push({ i: out.length, x, z, rot, t, w: T.w, d: T.d, h: T.h, vil: v.id, yard: !T.farm && r() < 0.45 }); return true;
  };
  for (const v of VILLAGES) {
    let k = 0;
    if (v.street) {
      // قرية على الطريق: صفين بيوت على جانبي الشارع، وأزقة ورا، والبيوت مقابل الشارع
      for (let i = 0; i < 1500 && k < v.n; i++) {
        const along = (r() - 0.5) * 2 * v.rad, row = 1 + Math.floor(r() * r() * 4.5), side = r() < 0.5 ? -1 : 1;
        const off = side * (19 + (row - 1) * 27 + r() * 6) * (1 - 0.3 * Math.abs(along) / v.rad);
        const x = v.x + along, z = v.z + off;
        if (add(v, x, z, (side < 0 ? 0 : Math.PI) + (r() - 0.5) * 0.12)) k++;
      }
    } else for (let i = 0; i < 900 && k < v.n; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * v.rad;
      if (add(v, v.x + Math.cos(a) * d, v.z + Math.sin(a) * d, v.rot + (r() < 0.5 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.25)) k++;
    }
  }
  return out;
})();
// هل الخط بين نقطتين يمر ببيت؟ (للمحاكاة: خط النظر والساتر)
export function houseBlocks(ax: number, az: number, bx: number, bz: number, skip = -1) {
  for (const h of HOUSES) {
    if (h.i === skip || (h as House & { dead?: boolean }).dead) continue;
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz, t = clampN(((h.x - ax) * vx + (h.z - az) * vz) / l2, 0, 1);
    if (Math.hypot(h.x - ax - vx * t, h.z - az - vz * t) < Math.min(h.w, h.d) * 0.45 && t > 0.02 && t < 0.98) return h;
  }
  return null;
}
