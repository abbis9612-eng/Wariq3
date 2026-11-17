// مؤثرات 3D (WM11.5): دخان (صور Unity Labs)، انفجار، توهج بالإضافة، ذيول دخان تبقى وتتمدد (شريط يواجه الكاميرا)، آثار على الأرض، أعلام.
// كل شي بإحداثيات المحاكاة (x، y، z = ارتفاع فوق البحر) وينحسب نسبةً للمرساة؛ الحجم يتحدد لكل كاميرا (حد أدنى بالبكسل).
import { SpriteManager, Sprite, Constants, Mesh, VertexData, StandardMaterial, Texture, Color3, Color4, DynamicTexture, type Scene, type Camera } from '@babylonjs/core';
const FXU = import.meta.glob('../../theater/textures/{fx_cloud,fx_explo1}.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const G = (n: string) => Object.entries(FXU).find(([k]) => k.endsWith('/' + n))![1];
export interface P3 { x: number; y: number; z: number }
interface Puff { s: Sprite; g: number; p: P3; r: number; gr: number; t: number; life: number; a: number; v: P3; minPx: number; col: Color3 }
export interface Fx { s?: Sprite; g: number; kind: 'glow' | 'ex' | 'ring' | 'flare' | 'fire' | 'spark' | 'tracer'; p: P3; size: number; t: number; life: number; minPx: number; tint: Color3; v: P3; to?: P3 }
export interface Trail { pts: { x: number; y: number; z: number; t: number; g: number }[]; r0: number; gr: number; life: number; a: number; col: Color3; live: boolean; flat?: boolean; minPx?: number; maxPts?: number }
const R = (a: number, b: number) => a + Math.random() * (b - a);
export const WIND = { x: 3.5, y: 1.2 };
export class FX {
  smoke: SpriteManager; ex: SpriteManager; glow: SpriteManager; flags: SpriteManager;
  puffs: Puff[] = []; fxs: Fx[] = []; trails: Trail[] = []; trailMesh: Mesh; tmat: StandardMaterial; t = 0; k = 1; view = 1e9;   // view: عرض المشهد بالمتر (لتخطي البعيد)   // k: تكبير المؤثرات بنفس نسبة تكبير الآليات
  constructor(private scene: Scene, private gh: (x: number, y: number) => number, private A: () => { x: number; y: number }, private exag: () => number) {
    this.smoke = new SpriteManager('smoke', G('fx_cloud.webp'), 2600, 128, scene); this.smoke.disableDepthWrite = true;
    this.ex = new SpriteManager('ex', G('fx_explo1.webp'), 200, 200, scene); this.ex.disableDepthWrite = true;
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,245,1)'); g.addColorStop(.15, 'rgba(255,230,170,.95)'); g.addColorStop(.4, 'rgba(255,150,60,.35)'); g.addColorStop(1, 'rgba(255,110,30,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(255,245,220,.9)'; x.lineWidth = 6; x.beginPath(); x.arc(192, 64, 56, 0, 7); x.stroke();
    this.glow = new SpriteManager('glow', c.toDataURL(), 1200, 128, scene); this.glow.blendMode = Constants.ALPHA_ADD; this.glow.disableDepthWrite = true;
    const f = document.createElement('canvas'); f.width = 72; f.height = 24; const y = f.getContext('2d')!;
    [['#ce1126', '#ffffff', '#111111'], ['#239f40', '#ffffff', '#da0000']].forEach((cols, side) => { cols.forEach((col, i) => { y.fillStyle = col; y.fillRect(side * 36, i * 8, 36, 8); });
      if (!side) { y.fillStyle = '#007a3d'; y.fillRect(10, 10, 16, 4); } else { y.fillStyle = '#da0000'; y.beginPath(); y.arc(54, 12, 3, 0, 7); y.fill(); } y.strokeStyle = 'rgba(0,0,0,.7)'; y.lineWidth = 2; y.strokeRect(side * 36 + 1, 1, 34, 22); });
    this.flags = new SpriteManager('flags', f.toDataURL(), 300, { width: 36, height: 24 }, scene); this.flags.renderingGroupId = 1;
    // شريط الذيول: شبكة وحدة تنبني كل إطار، حوافها ناعمة
    this.trailMesh = new Mesh('trails', scene); this.trailMesh.isPickable = false; this.trailMesh.alwaysSelectAsActiveMesh = true; this.trailMesh.hasVertexAlpha = true;
    const dt = new DynamicTexture('tgrad', { width: 64, height: 4 }, scene, false); const tc = dt.getContext() as CanvasRenderingContext2D, lg = tc.createLinearGradient(0, 0, 64, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.3, 'rgba(255,255,255,.8)'); lg.addColorStop(.5, 'rgba(255,255,255,1)'); lg.addColorStop(.7, 'rgba(255,255,255,.8)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); tc.fillStyle = lg; tc.fillRect(0, 0, 64, 4); dt.update(); dt.hasAlpha = true;
    this.tmat = new StandardMaterial('tmat', scene); this.tmat.disableLighting = true; this.tmat.emissiveColor = Color3.White(); this.tmat.diffuseColor = Color3.Black(); this.tmat.opacityTexture = dt; this.tmat.backFaceCulling = false; this.tmat.disableDepthWrite = true;
    this.trailMesh.material = this.tmat;
  }
  puff(p: P3, r: number, gr: number, life: number, a: number, col: Color3, minPx = 3, v: P3 = { x: 0, y: 0, z: 0 }) {
    if (this.puffs.length > 1300) { this.puffs.shift()!.s.dispose(); }
    const s = new Sprite('p', this.smoke); s.cellIndex = (Math.random() * 64) | 0; s.angle = R(0, 6.28); this.puffs.push({ s, g: this.gh(p.x, p.y), p: { ...p }, r, gr, t: 0, life, a, v: { ...v }, minPx, col });
  }
  fx(kind: Fx['kind'], p: P3, size: number, life: number, minPx: number, tint: Color3 = Color3.White(), v: P3 = { x: 0, y: 0, z: 0 }, to?: P3) {
    if (this.fxs.length > 900) return; const f: Fx = { g: this.gh(p.x, p.y), kind, p: { ...p }, size, t: 0, life, minPx, tint, v: { ...v }, to };
    if (kind === 'ex') { f.s = new Sprite('e', this.ex); } else { f.s = new Sprite('g', this.glow); f.s.cellIndex = kind === 'ring' ? 1 : 0; }
    this.fxs.push(f); return f;
  }
  // تعمير بالزمن (بقطع ≤ ربع ثانية حتى السرعات العالية ما تثقل)
  age(simDt: number) {
    let left = simDt; this.t += simDt;
    while (left > 1e-6) { const dt = Math.min(.25, left); left -= dt;
      for (const q of this.puffs) { q.t += dt; q.p.x += (WIND.x + q.v.x) * dt; q.p.y += (WIND.y + q.v.y) * dt; q.p.z += q.v.z * dt; const d = 1 - Math.min(1, dt * .6); q.v.x *= d; q.v.y *= d; q.v.z *= d; q.r += q.gr * dt / (1 + q.t * .2); }
      for (const f of this.fxs) { f.t += dt; f.p.x += f.v.x * dt; f.p.y += f.v.y * dt; f.p.z += f.v.z * dt;
        if (f.kind === 'spark' || f.kind === 'flare') { const d = 1 - Math.min(1, dt * (f.kind === 'spark' ? 2.5 : .6)); f.v.x *= d; f.v.y *= d; f.v.z = f.v.z * d - (f.kind === 'flare' ? 6 : 9) * dt; }
        if (f.kind === 'fire' && Math.random() < dt * 4 * (1 - f.t / f.life)) this.puff({ x: f.p.x + R(-4, 4), y: f.p.y + R(-4, 4), z: f.p.z + 4 }, R(5, 9), R(3, 6), R(16, 26), .55, new Color3(.14, .12, .11), 4, { x: R(0, 2), y: R(0, 1), z: R(4, 9) }); } }
    for (const q of this.puffs) if (q.t >= q.life) q.s.dispose(); this.puffs = this.puffs.filter(q => q.t < q.life);
    for (const f of this.fxs) if (f.t >= f.life) f.s?.dispose(); this.fxs = this.fxs.filter(f => f.t < f.life);
    this.trails = this.trails.filter(r => r.live || (r.pts.length && this.t - r.pts[r.pts.length - 1].t < r.life));
  }
  trail(o: Omit<Trail, 'pts' | 'live'>): Trail { const t: Trail = { ...o, pts: [], live: true }; this.trails.push(t); return t; }
  add(t: Trail, p: P3, minStep: number) { const l = t.pts[t.pts.length - 1]; if (!l || Math.hypot(p.x - l.x, p.y - l.y, p.z - l.z) > minStep) { t.pts.push({ x: p.x, y: p.y, z: p.z, t: this.t, g: this.gh(p.x, p.y) }); if (t.pts.length > (t.maxPts ?? 240)) t.pts.shift(); } }   // حد للنقاط (WM13.1)
  // يحدّث المواقع والأحجام لكاميرا معينة (الرئيسية أو اللقطة القريبة)
  draw(cam: Camera, mpp: (x: number, y: number, z: number) => number, smokeCol: Color3) {
    const A = this.A(), E = this.exag(), cp = cam.position, now = this.t;
    for (const q of this.puffs) { const u = q.t / q.life, y = q.g * E + q.p.z, s = q.s; s.position.set(q.p.x - A.x, y, q.p.y - A.y);
      const px = mpp(s.position.x - cp.x, y - cp.y, s.position.z - cp.z); s.width = s.height = Math.max(q.minPx * px * this.k, q.r * 2) * 1.3;
      s.color.set(q.col.r, q.col.g, q.col.b, q.a * Math.min(1, u * 8) * (1 - u)); }
    for (const f of this.fxs) { const s = f.s!, u = f.t / f.life, y = f.g * E + f.p.z; s.position.set(f.p.x - A.x, y, f.p.y - A.y);
      const px = mpp(s.position.x - cp.x, y - cp.y, s.position.z - cp.z), sz = Math.max(f.minPx * px * this.k, f.size);
      if (f.kind === 'ex') { s.cellIndex = Math.min(24, (u * 25) | 0); s.width = s.height = sz; s.color.set(1, 1, 1, 1); }
      else if (f.kind === 'ring') { s.width = s.height = sz * Math.sqrt(u) * 2; s.color.set(1, .95, .85, (1 - u) * .7); }
      else if (f.kind === 'fire') { const fl = sz * (1 + Math.sin(now * 13 + f.p.x) * .15) * (1 - u * .6); s.width = s.height = fl; s.color.set(1, .7, .32, .95); }
      else if (f.kind === 'tracer' && f.to) { const k = Math.min(1, u * 1.1); s.position.set(f.p.x + (f.to.x - f.p.x) * k - A.x, f.g * E + f.p.z + (f.to.z - f.p.z) * k, f.p.y + (f.to.y - f.p.y) * k - A.y); s.width = s.height = 5 * px; s.color.set(1, .82, .54, 1); }
      else { s.width = s.height = sz; s.color.set(f.tint.r, f.tint.g, f.tint.b, f.kind === 'flare' ? 1 - u * .7 : 1 - u); } }
    // الشريط: كل نقطة تنزاح مع الريح وتتسع وتخفت
    const pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [];
    const far = this.view * 1.6;
    for (const r of this.trails) { const P = r.pts; if (P.length < 2) continue; let base = -1;
      const a0 = P[0], a1 = P[P.length - 1], am0 = P[(P.length / 2) | 0]; if ([a0, a1, am0].every(q => Math.hypot(q.x - A.x, q.y - A.y) > far)) continue;   // بعيد عن الشاشة
      for (let i = 0; i < P.length; i++) { const q = P[i], am = now - q.t; const alive = am <= r.life;
        const x = q.x + WIND.x * (r.flat ? 0 : am) - A.x, z = q.y + WIND.y * (r.flat ? 0 : am) - A.y, y = q.g * E + q.z + (r.flat ? .3 : 0);
        const n = P[Math.min(P.length - 1, i + 1)], pr = P[Math.max(0, i - 1)], tx = n.x - pr.x, ty = n.z - pr.z, tz = n.y - pr.y;
        let sx: number, sy: number, sz: number;
        if (r.flat) { const l = Math.hypot(tx, tz) || 1; sx = -tz / l; sy = 0; sz = tx / l; }
        else { const vx = x - cp.x, vy = y - cp.y, vz = z - cp.z; sx = ty * vz - tz * vy; sy = tz * vx - tx * vz; sz = tx * vy - ty * vx; const l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l; }
        const u = Math.min(1, am / r.life), w = Math.max((r.minPx ?? 1.4) * mpp(x - cp.x, y - cp.y, z - cp.z), r.r0 + r.gr * Math.sqrt(Math.max(0, am))), al = alive ? r.a * (1 - u) * (1 - u * .4) * Math.min(1, am * 4 + .3) : 0;
        const c = r.col.r < 0 ? smokeCol : r.col;
        pos.push(x + sx * w, y + sy * w, z + sz * w, x - sx * w, y - sy * w, z - sz * w); col.push(c.r, c.g, c.b, al, c.r, c.g, c.b, al); uv.push(0, i, 1, i);
        const k = pos.length / 3 - 2; if (base >= 0) idx.push(base, base + 1, k, base + 1, k + 1, k); base = k; } }
    if (!idx.length) { this.trailMesh.setEnabled(false); return; } this.trailMesh.setEnabled(true);
    const vd = new VertexData(); vd.positions = pos; vd.colors = col; vd.uvs = uv; vd.indices = idx; vd.applyToMesh(this.trailMesh, true);
  }
  clear() { this.puffs.forEach(q => q.s.dispose()); this.fxs.forEach(f => f.s?.dispose()); this.puffs = []; this.fxs = []; this.trails = []; }
}
export const C = (h: number) => new Color3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
export const SMOKE = new Color3(-1, 0, 0);   // لون الدخان يتبع الثيم
void Texture; void Color4;
