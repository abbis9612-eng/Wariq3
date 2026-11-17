// أسماء الدول والمدن بالعربي فوق الأرض (DOM، حتى الخط العربي يطلع مضبوط) — تختفي حسب البعد وما تتراكب
import { Vector3, Matrix, type Scene } from '@babylonjs/core';
import LB from '../labels/labels.json';
import MD from '../../topdown/src/mapdata.json';
import { ll2s } from './geo';
import { cam, camera } from './cam';
interface Lab { el: HTMLDivElement; x: number; y: number; z: number; kind: 'c' | 'city' | 'site'; pri: number; show: (D: number) => boolean; w: number }
const L: Lab[] = []; let root: HTMLDivElement; let sitesOn = true;
export const showSites = (on: boolean) => { sitesOn = on; };
export function buildLabels(host: HTMLElement, sites: [string, { x: number; y: number }][]) {
  root = document.createElement('div'); root.id = 'labels'; host.appendChild(root);
  const add = (n: string, x: number, y: number, kind: Lab['kind'], pri: number, show: Lab['show']) => { const el = document.createElement('div'); el.className = 'lab ' + kind; el.textContent = n; root.appendChild(el); L.push({ el, x, y, z: 0, kind, pri, show, w: n.length * (kind === 'c' ? 9 : 7) + 8 }); };
  for (const c of LB.countries) { const p = ll2s(c.lat, c.lon), r = c.r; add(c.n, p.x, p.y, 'c', 10 - r, D => D < (r <= 3 ? 4.5e7 : r <= 4 ? 1.6e7 : r <= 5 ? 6e6 : 2.5e6) && D > 1.2e5); }
  for (const c of LB.cities) { const p = ll2s(c.lat, c.lon), r = c.r; add(c.n, p.x, p.y, 'city', 8 - r + (c.cap ? 2 : 0), D => D < (r <= 1 ? 9e6 : r <= 3 ? 3.5e6 : 1.4e6) && D > 4e4); }
  for (const c of (MD as any).cities) { if (L.some(l => l.kind === 'city' && l.el.textContent === c.n)) continue; add(c.n, c.p[0], c.p[1], 'city', c.pop > 400000 ? 3 : 1, D => D < 2.5e5 && D > 3e3); }   // بدون تكرار
  for (const [n, p] of sites) add(n, p.x, p.y, 'site', 5, D => D < 1.5e5 && D > 2e3);
}
const v = new Vector3(), out = new Vector3();
export function updateLabels(scene: Scene, W: number, H: number, ground: (x: number, y: number) => number) {
  const tm = scene.getTransformMatrix(), vp = camera.viewport.toGlobal(W, H), placed: number[][] = [];
  const vis = L.filter(l => (sitesOn || l.kind !== 'site') && l.show(cam.D)).sort((a, b) => b.pri - a.pri), seen = new Set<Lab>();
  for (const l of vis) { v.set(l.x - cam.x, ground(l.x, l.y), l.y - cam.y); Vector3.ProjectToRef(v, Matrix.IdentityReadOnly, tm, vp, out);
    if (out.z < 0 || out.z > 1 || out.x < -50 || out.x > W + 50 || out.y < -20 || out.y > H + 20) continue;
    const box = [out.x - l.w / 2, out.y - 10, out.x + l.w / 2, out.y + 10]; if (placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
    placed.push(box); seen.add(l); l.el.style.transform = `translate(${out.x.toFixed(1)}px,${out.y.toFixed(1)}px) translate(-50%,-50%)`; }
  for (const l of L) { const s = seen.has(l); if ((l.el.style.display !== 'none') !== s) l.el.style.display = s ? '' : 'none'; }
}
