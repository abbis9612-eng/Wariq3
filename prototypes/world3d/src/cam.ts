// الكاميرا (WM11.3): هدف على الأرض + بعد + اتجاه + ميلان. تبدي من فوق (ميلان 0)؛
// إصبع يسحب الأرض، إصبعين: تكبير (قرصة)، لف (تدوير)، ميلان (سحب الإصبعين سوا لفوق/تحت). الماوس: عجلة تكبير، زر يمين/Ctrl للف والميلان.
import { FreeCamera, Vector3, Matrix, type Scene } from '@babylonjs/core';
import { clamp, WORLD } from './geo';
export const cam = { x: 0, y: 0, D: 3e7, head: 0, tilt: 0 };   // x,y بمتر المحاكاة؛ D بعد الكاميرا عن الهدف؛ head راد (0 = شمال فوق)؛ tilt راد (0 = عمودي)
export const DMIN = 12, DMAX = 4.2e7, TMAX = 1.25;
export let camera: FreeCamera;
export function makeCamera(scene: Scene) { camera = new FreeCamera('cam', new Vector3(0, 1000, 0), scene); camera.fov = .8; camera.inputs.clear(); return camera; }
// يحدّث كاميرا Babylon (نسبةً للمرساة = الهدف) — ترجع موقعها بمتر المحاكاة
export function applyCamera(groundY: number) {
  const p = Math.PI / 2 - cam.tilt, fx = Math.sin(cam.head) * Math.cos(p), fy = -Math.sin(p), fz = Math.cos(cam.head) * Math.cos(p);
  camera.position.set(-fx * cam.D, groundY - fy * cam.D, -fz * cam.D); camera.rotation.set(p, cam.head, 0);
  const alt = Math.max(1, camera.position.y); camera.minZ = clamp(alt * .02, .3, 5e4); camera.maxZ = Math.max(cam.D * 40, alt * 60, 2e5);
  return { x: cam.x - fx * cam.D, y: cam.y - fz * cam.D, z: groundY - fy * cam.D };
}
// نقطة على الأرض (مستوي y=0 نسبةً للمرساة) تحت بكسل الشاشة
export function pickGround(scene: Scene, sx: number, sy: number): { x: number; y: number } | null {
  camera.getViewMatrix(true); camera.getProjectionMatrix(true); const r = scene.createPickingRay(sx, sy, Matrix.Identity(), camera, false); if (r.direction.y > -1e-4) return null;
  const t = -r.origin.y / r.direction.y; return { x: cam.x + r.origin.x + r.direction.x * t, y: cam.y + r.origin.z + r.direction.z * t };
}
export function limit() { cam.D = clamp(cam.D, DMIN, DMAX); cam.tilt = clamp(cam.tilt, 0, TMAX); cam.x = clamp(cam.x, WORLD.x0, WORLD.x1); cam.y = clamp(cam.y, WORLD.y1, WORLD.y0); }
export function attachGestures(scene: Scene, el: HTMLElement, onUser: () => void, onTap: (x: number, y: number) => boolean) {
  const ptrs = new Map<number, { x: number; y: number }>(); let last: { d: number; a: number; mx: number; my: number } | null = null, down = { x: 0, y: 0 }, moved = false, rot = false;
  const two = () => { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
  const zoomAt = (f: number, sx: number, sy: number) => { const g0 = pickGround(scene, sx, sy); cam.D *= f; limit(); applyCamera(0); const g1 = pickGround(scene, sx, sy); if (g0 && g1) { cam.x += g0.x - g1.x; cam.y += g0.y - g1.y; } limit(); };
  el.addEventListener('pointerdown', e => { if (onTap(e.clientX, e.clientY)) return; el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); down = { x: e.clientX, y: e.clientY }; moved = false; rot = e.button === 2 || e.ctrlKey; last = ptrs.size === 2 ? two() : null; });
  el.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return;
    if (!moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { moved = true; onUser(); }
    if (ptrs.size === 1 && moved) {
      if (rot) { cam.head -= (e.clientX - p.x) * .006; cam.tilt += (e.clientY - p.y) * .005; limit(); }
      else { applyCamera(0); const g0 = pickGround(scene, p.x, p.y), g1 = pickGround(scene, e.clientX, e.clientY); if (g0 && g1) { cam.x += g0.x - g1.x; cam.y += g0.y - g1.y; limit(); } } }
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) { const n = two(); if (last) { onUser();
      if (Math.abs(n.d - last.d) > .5) zoomAt(last.d / n.d, n.mx, n.my);
      cam.head -= Math.atan2(Math.sin(n.a - last.a), Math.cos(n.a - last.a));
      const dy = n.my - last.my; if (Math.abs(n.d - last.d) < 6) cam.tilt -= dy * .005;   // سحب الإصبعين سوا لفوق = ميلان
      limit(); } last = n; } });
  const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); last = ptrs.size === 2 ? two() : null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', e => { e.preventDefault(); onUser(); zoomAt(Math.exp(e.deltaY * .0015), e.clientX, e.clientY); }, { passive: false });
}
