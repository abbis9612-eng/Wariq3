// الجغرافيا والأدوات المشتركة (بدون رسم): تقراها المحاكاة (sim.ts) وتصميم الأرض (land.ts)
export type V3 = [number, number, number];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const dist2d = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** دوران حول y بنفس اتجاه Babylon (rotation.y) */
export const rotY = (v: V3, a: number): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
/** زاوية yaw تخلي +z المحلي يأشر على الاتجاه d */
export const yawOf = (d: V3) => Math.atan2(d[0], d[2]);
export const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ===== الجغرافيا: مدينة على نهر، مضغوطة (المسافات ≈ ثلث الحقيقة حتى تنشاف بالتلفون) =====
export const riverX = (z: number) => 260 * Math.sin(z / 900 + 0.6) + 110 * Math.sin(z / 380 + 2.1) + 120;
export const RIVER_W = (z: number) => 190 + 30 * Math.sin(z / 700);
export const CITY_R = 2300;
export const HIGHWAY_Z = -350;
export interface Site { id: string; name: string; p: V3; cost: string }
export const SITES: Site[] = [
  { id: 'airport', name: 'المهبط الميداني', p: [-2650, 0, -1250], cost: 'طيران الإسناد متوقف 3 أيام — خسارة 120 مليون $' },
  { id: 'green', name: 'قرية الوادي', p: [riverX(-150) - 170, 0, -150], cost: 'الاستقرار −4 والأهالي ينزحون' },
  { id: 'dora', name: 'خزانات الوقود', p: [950, 0, -1650], cost: 'إنتاج الوقود ينقص 15٪ هذا الشهر' },
  { id: 'rasheed', name: 'معسكر الجنوب', p: [1750, 0, -2350], cost: 'معنويات الجيش −5' },
  { id: 'taji', name: 'معسكر التل', p: [-950, 0, 3100], cost: 'مخزن ذخيرة احترق — كلفة 60 مليون $' },
];
export const site = (id: string) => SITES.find(s => s.id === id)!;
/** سواتر ترابية أمام خط الأبرامز (الرسم يرسمها، والمحاكاة تقلل الإصابة وراها) */
export const BERMS: V3[] = [[-2085, 0, -480], [-2085, 0, -350], [-2085, 0, -220]];

/** الخط الثاني: سواتر شرق قرية الطريق (المدافع ينسحب إلها) */
export const BERMS2: V3[] = [[-1190, 0, -430], [-1190, 0, -275]];
/** مواقع فريق الكورنيت (الأول على التل، الثاني ورا القرية) — بيها أكياس رمل */
export const KORNET_P: V3 = [-2108, 0, 165], KORNET_P2: V3 = [-1640, 0, 85];
// ===== منظومات الدفاع الجوي: مواضع الفوهات (مقاسة من المجسمات) =====
export const PATRIOT_POS: V3 = [-650, 0, 1250];
export const PATRIOT_YAW = yawOf(norm([-0.7, 0, 0.72])) - yawOf([-1, 0, 0]);   // الفوهات (−x محلياً) للشمال الغربي
export const PATRIOT_MUZZLES: V3[] = [[6.3, 8.9, 0.55], [6.3, 8.9, -0.55], [6.1, 7.5, 0.55], [6.1, 7.5, -0.55]];
export const PATRIOT_REAR: V3 = [12.4, 4.9, 0];
export const PATRIOT_LAUNCH_LOCAL: V3 = norm([-0.854, 0.52, 0]);
export const S400_POS: V3 = [650, 0, 1500];
export const S400_YAW = yawOf(norm([-0.75, 0, 0.66]));                         // الأنابيب (+z محلياً) للشمال الغربي
export const S400_SCALE = 7.2;
const S4 = (x: number, y: number, z: number): V3 => [x * S400_SCALE, y * S400_SCALE + 0.502 * S400_SCALE, z * S400_SCALE];
export const S400_MUZZLES: V3[] = [S4(0.12, 0.456, -0.3), S4(-0.12, 0.456, -0.3), S4(0.12, 0.35, -0.19), S4(-0.12, 0.35, -0.19)];
export const S400_LAUNCH_LOCAL: V3 = norm([0, 0.667, 0.745]);
