// منطق المشهد بدون رسم: أرض، صاروخ كروز، معترض بتوجيه تناسبي، صاعق تقاربي.
// كل الوحدات: متر، ثانية. المحور y للأعلى. الباتريوت عند (0,0,0) وفوهاته باتجاه −x.

export type V3 = [number, number, number];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/** مولد عشوائي ببذرة حتى يتكرر المشهد نفسه بالضبط */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ===== الأرض =====
function hash(x: number, y: number) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, oct = 5) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f); n += amp; f *= 2.03; amp *= 0.5; }
  return s / n;
}
/** ارتفاع الأرض: سهل مستوي حول البطارية، كثبان، وجبال بعيدة مع وادي يجي منه الصاروخ */
export function terrainH(x: number, z: number) {
  const d = Math.hypot(x, z);
  const dunes = (fbm(x * 0.0018 + 3, z * 0.0018 - 7, 4) - 0.5) * 34 + (fbm(x * 0.009, z * 0.009, 3) - 0.5) * 5;
  const flat = smooth(140, 700, d);
  const ridge = 1 - Math.abs(fbm(x * 0.00055 + 11, z * 0.00055 - 4, 5) * 2 - 1);
  const valley = x < 0 ? 1 - Math.exp(-(((z + 300) / 900) ** 2)) * smooth(0, -2500, x) : 1;
  const mount = smooth(6800, 11000, d) * (ridge * ridge * 820 + fbm(x * 0.002, z * 0.002, 4) * 140) * (0.08 + 0.92 * valley);
  return dunes * flat + mount;
}

// ===== الصاروخ المهاجم (Kh-101) =====
export interface Cruise { p: V3; v: V3; alive: boolean }
export const CRUISE_SPEED = 230; // م/ث (تقريباً 830 كم/س)
export const CRUISE_START: V3 = [-9200, 0, -1150];
export const CRUISE_AIM: V3 = [3000, 0, 420];
export function newCruise(): Cruise {
  const p: V3 = [CRUISE_START[0], terrainH(CRUISE_START[0], CRUISE_START[2]) + 60, CRUISE_START[2]];
  const dir = norm([CRUISE_AIM[0] - p[0], 0, CRUISE_AIM[2] - p[2]]);
  return { p, v: scale(dir, CRUISE_SPEED), alive: true };
}
/** متابعة التضاريس: يطير ~45 م فوق أعلى أرض قدامه، بتسلق محدود */
export function stepCruise(c: Cruise, dt: number) {
  const fwd = norm([c.v[0], 0, c.v[2]]);
  // أعلى أرض قدامه، والمسافة الأقرب أهم (حتى يتسلق قبل الجبل بوقت كافي)
  let want = -1e9;
  for (let s = 0; s <= 2400; s += 120) want = Math.max(want, terrainH(c.p[0] + fwd[0] * s, c.p[2] + fwd[2] * s) + 45 - s * 0.06);
  want = Math.max(want, terrainH(c.p[0], c.p[2]) + 45);
  const vy = clamp((want - c.p[1]) * 1.2, -60, 110);
  c.v[1] += clamp(vy - c.v[1], -60 * dt, 60 * dt);
  const h = norm([c.v[0], 0, c.v[2]]), hs = Math.sqrt(Math.max(1, CRUISE_SPEED ** 2 - c.v[1] ** 2));
  c.v[0] = h[0] * hs; c.v[2] = h[2] * hs;
  c.p = add(c.p, scale(c.v, dt));
}

// ===== المعترض (PAC-2 تقريبي) =====
export const LAUNCH_DIR: V3 = norm([-0.854, 0.52, 0]);
/** فوهات الحاويات الأربع مقاسة من مجسم الباتريوت */
export const MUZZLES: V3[] = [[6.3, 8.9, 0.55], [6.3, 8.9, -0.55], [6.1, 7.5, 0.55], [6.1, 7.5, -0.55]];
export interface Interceptor { p: V3; v: V3; t: number; state: 'fly' | 'boom' | 'gone'; miss: number }
export const BURN = 9;          // ثواني احتراق المحرك
export const THRUST = 260;      // م/ث² تسارع أثناء الاحتراق
export const MAX_G = 32 * 9.81; // أقصى مناورة
export const NAV = 4;           // ثابت التوجيه التناسبي
export const FUZE = 9;          // م: مسافة الصاعق التقاربي
export function newInterceptor(muzzle: V3): Interceptor {
  return { p: [...muzzle] as V3, v: scale(LAUNCH_DIR, 25), t: 0, state: 'fly', miss: 1e9 };
}
/** ترجع 'hit' إذا انفجر قرب الهدف */
export function stepInterceptor(m: Interceptor, tgt: Cruise | null, dt: number): 'hit' | null {
  if (m.state !== 'fly') return null;
  m.t += dt;
  const sp = len(m.v), dir = norm(m.v);
  let acc: V3 = [0, -9.81, 0];
  if (m.t < BURN) acc = add(acc, scale(dir, THRUST));
  acc = add(acc, scale(dir, -0.00011 * sp * sp)); // مقاومة الهواء
  if (tgt && tgt.alive && m.t > 0.7) {
    const r = sub(tgt.p, m.p), vr = sub(tgt.v, m.v), r2 = Math.max(1, dot(r, r));
    const omega = scale(cross(r, vr), 1 / r2);            // سرعة دوران خط الرؤية
    let a = scale(cross(omega, m.v), NAV);                // توجيه تناسبي: a = N·(Ω×V)
    a = add(a, [0, 9.81, 0]);                             // تعويض الجاذبية
    const al = len(a); if (al > MAX_G) a = scale(a, MAX_G / al);
    acc = add(acc, a);
    const d = len(r);
    if (d < m.miss) m.miss = d;
    if (d < FUZE || (d < 40 && d > m.miss + 1)) { m.state = 'boom'; return 'hit'; }
  }
  m.v = add(m.v, scale(acc, dt));
  m.p = add(m.p, scale(m.v, dt));
  return null;
}

// ===== الحطام =====
export interface Debris { p: V3; v: V3; spin: V3; rot: V3; alive: boolean; size: number }
export function stepDebris(d: Debris, dt: number): boolean {
  if (!d.alive) return false;
  d.v = add(d.v, scale([0, -9.81, 0], dt));
  d.v = scale(d.v, 1 - 0.12 * dt);
  d.p = add(d.p, scale(d.v, dt));
  d.rot = add(d.rot, scale(d.spin, dt));
  const g = terrainH(d.p[0], d.p[2]);
  if (d.p[1] <= g) { d.p[1] = g; d.alive = false; return true; }
  return false;
}
