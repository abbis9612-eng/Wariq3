// إحداثيات «العالم 3D»: نفس متر المحاكاة (x شرق، y شمال) حول REF بميركاتور، والعالم كله على نفس المستوي.
// Babylon: x = x، z = y (شمال)، y = فوق. كل شي ينرسم نسبةً لـ «مرساة» = هدف الكاميرا (دقة عالية حتى لو العالم 34 ألف كم).
import LV from '../terrain/levels.json';
export const REF = { lat: LV.ref[0], lon: LV.ref[1] }, MPU = LV.mpu as number;
export const MX = (lo: number) => (lo + 180) / 360;
export const MY = (la: number) => (1 - Math.log(Math.tan(Math.PI / 4 + Math.max(-85.05, Math.min(85.05, la)) * Math.PI / 360)) / Math.PI) / 2;
const MX0 = MX(REF.lon), MY0 = MY(REF.lat);
export const m2s = (mx: number, my: number) => ({ x: (mx - MX0) * MPU, y: -(my - MY0) * MPU });
export const s2m = (x: number, y: number) => ({ mx: x / MPU + MX0, my: MY0 - y / MPU });
export const ll2s = (lat: number, lon: number) => m2s(MX(lon), MY(lat));
export const WORLD = { x0: m2s(0, 0).x, y0: m2s(0, 0).y, x1: m2s(1, 1).x, y1: m2s(1, 1).y };
export const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
