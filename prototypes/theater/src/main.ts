// مسرح العمليات (غرب بغداد) v3 — رسم Babylon.js فوق منطق sim.ts. الأرض: world.ts + land.ts (I-027)
// v2: كاميرا تجمع الطرفين + أسهم الحافة + خريطة مصغّرة (I-018)، إطلاق ساخن/بارد مرئي ووضوح الصواريخ (I-014، I-017، I-019)،
//     دوشكا طلقة طلقة (I-015)، كاميرا الإصابة والدمار وبطاقة الثمن (I-012)، أضواء انفجارات وظلال (I-021)، أوامر (I-020)
import {
  Engine, Scene, Vector3, Color3, Color4, FreeCamera, HemisphericLight, DirectionalLight, PointLight, ShadowGenerator, MeshBuilder, Mesh,
  StandardMaterial, PBRMaterial, DynamicTexture, ParticleSystem, TransformNode, VertexBuffer, DefaultRenderingPipeline, ImageProcessingConfiguration,
  LoadAssetContainerAsync, AssetContainer, Matrix, Particle, BaseTexture, Texture, Quaternion, AbstractMesh, VertexData, VertexAnimationBaker, BakedVertexAnimationManager,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { SkyMaterial } from '@babylonjs/materials/sky';
import { CustomMaterial } from '@babylonjs/materials/custom';
import {
  V3, add, sub, scale, len, norm, lerp, clamp, rng, World, newWorld, step, order, Order, ORDER_CD, Unit, Air, Fx, SITES, riverX, RIVER_W, CITY_R,
  HIGHWAY_Z, BERMS, AIR_AR, SIDE_AR, PATRIOT_POS, S400_POS, S400_SCALE, dist2d, site, angDiff,
} from './sim';
import type { Sol } from './sim';
import { groundH, groundN, ROADS, HOUSES, COVER } from './land';
import { buildWorld, loadHeight, SiteProp, WorldOut } from './world';

const urls = import.meta.glob('../models/*.gltf.json', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const modelUrl = (n: string) => urls[`../models/${n}.gltf.json`];

// ===== إعداد وجودة =====
const qs = new URLSearchParams(location.search);
const AUTO = qs.has('auto');
let HQ = qs.get('q') !== 'low';
const $ = (id: string) => document.getElementById(id)!;
const canvas = $('c') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: AUTO }, true);
const applyRes = () => engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, HQ ? 1.5 : 1));
applyRes();
const scene = new Scene(engine);
scene.skipPointerMovePicking = true;
const v = (a: V3) => new Vector3(a[0], a[1], a[2]);
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const SUN = norm([0.42, 0.78, 0.46]);
// المحاكاة مسطّحة (y=0 هو الأرض)؛ وقت الرسم نرفع كل شي على ارتفاع الأرض الحقيقي. الأشياء العالية جداً ما تتأثر.
const liftK = (y: number) => 1 - smooth(600, 5000, y);
const L = (p: V3): V3 => [p[0], p[1] + groundH(p[0], p[2]) * liftK(p[1]), p[2]];
const G = (x: number, z: number, dy = 0): V3 => [x, groundH(x, z) + dy, z];
function liftFx(f: Fx): Fx { if (f.k === 'mark') return f; const o: any = { ...f }; for (const k of ['p', 'to', 'a', 'b', 'muzzle', 'rear']) if (Array.isArray(o[k])) o[k] = L(o[k] as V3); return o as Fx; }
const qTilt = new Quaternion();
const NL = 4; // أضواء الانفجارات

// ===== ضوء وسماء وظلال =====
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
hemi.intensity = 0.38; hemi.diffuse = new Color3(0.7, 0.76, 0.88); hemi.groundColor = new Color3(0.45, 0.38, 0.3);
const sun = new DirectionalLight('sun', v(scale(SUN, -1)), scene); sun.intensity = 0.75; // خامات Standard تقصّ الضوء عند 1، فنخلي مجال لأضواء الانفجارات؛ والتعريض يرفع الصورة
const PBR_DIRECT = 2.5; sun.diffuse = new Color3(1, 0.92, 0.8);
sun.position = v(scale(SUN, 700)); sun.shadowMinZ = 1; sun.shadowMaxZ = 1500;
const sky = MeshBuilder.CreateBox('sky', { size: 60000 }, scene);
const skyMat = new SkyMaterial('skyMat', scene);
Object.assign(skyMat, { backFaceCulling: false, useSunPosition: true, sunPosition: v(scale(SUN, 1000)), turbidity: 5, luminance: 1, rayleigh: 2.4, mieCoefficient: 0.005, mieDirectionalG: 0.8, fogEnabled: false });
sky.material = skyMat; sky.infiniteDistance = true; sky.isPickable = false;
scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.000052; scene.fogColor = new Color3(0.83, 0.79, 0.71);
let shadows: ShadowGenerator | null = null;
function setupShadows() {
  shadows?.dispose(); shadows = null; if (!HQ) return;
  shadows = new ShadowGenerator(2048, sun); shadows.usePercentageCloserFiltering = true; shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias = 0.004; shadows.normalBias = 0.02; shadows.frustumEdgeFalloff = 1; sun.autoUpdateExtends = false;
  for (const m of casters) shadows.addShadowCaster(m, false);
}
const casters: AbstractMesh[] = [];
const caster = (m: AbstractMesh) => { casters.push(m); shadows?.addShadowCaster(m, false); };

// ===== قوام بالكود =====
function canvasTex(name: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const t = new DynamicTexture(name, { width: size, height: size }, scene, true);
  const g = t.getContext() as unknown as CanvasRenderingContext2D; g.clearRect(0, 0, size, size); draw(g, size); t.update(); t.hasAlpha = true; return t;
}
const R = rng(5);
const radial = (stops: [number, string][]) => (g: CanvasRenderingContext2D, s: number) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, s, s); };
const texSoft = canvasTex('soft', 64, radial([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]));
const texFlare = canvasTex('flare', 64, radial([[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,235,190,.9)'], [0.4, 'rgba(255,160,60,.3)'], [1, 'rgba(255,120,20,0)']]));
const texBlob = canvasTex('blob', 64, radial([[0, 'rgba(0,0,0,.55)'], [0.6, 'rgba(0,0,0,.3)'], [1, 'rgba(0,0,0,0)']]));
const texScorch = canvasTex('scorch', 64, radial([[0, 'rgba(30,24,16,.62)'], [0.4, 'rgba(45,36,24,.35)'], [1, 'rgba(60,45,30,0)']]));
const texSmoke = canvasTex('smoke', 128, (g, s) => {
  for (let i = 0; i < 22; i++) { const a = R() * 6.28, r = R() * s * 0.22, x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r, rad = s * (0.12 + R() * 0.16), k = 0.75 + R() * 0.25;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${255 * k | 0},${255 * k | 0},${255 * k | 0},.5)`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'destination-in'; radial([[0, 'rgba(0,0,0,1)'], [0.3, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']])(g, s);
});
const texUrls = import.meta.glob('../textures/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
// الأرض والقرى والمواقع تنبني بـ world.ts؛ هنا نحتفظ بالبيوت والمعالم حتى ندمّرها وقت القصف
let houses: WorldOut['houses'];
let keepClear: V3[] = [];
let siteProps: SiteProp[] = [];

// ===== الكاميرا: مايلة من فوق، تجمع الطرفين، تلاحق، ولقطة إصابة =====
const cam = new FreeCamera('cam', new Vector3(0, 3000, -3000), scene);
cam.inputs.clear(); cam.minZ = 2; cam.maxZ = 70000; cam.fov = 0.8;
const view = { tx: -2300, tz: -380, dist: 900, yaw: 0, pitch: -1, follow: 0, fDist: 0 };
// D-018: المعركة القريبة: كاميرا مايلة 50° بعدسة ضيقة (تشبه المنظر الثابت، بدون سما)، ولما تبعّد تنتقل للمنظر العام
const CLOSE_PITCH = 0.87, CLOSE_FOV = 0.42, WIDE_FOV = 0.8;
const closeK = (d: number) => 1 - smooth(1300, 3000, d);
const pitchFor = (d: number) => lerp(lerp(0.95, 1.12, smooth(3000, 7000, d)), CLOSE_PITCH, closeK(d));
let camTarget = new Vector3(view.tx, 0, view.tz), camDist = view.dist, camPitch = pitchFor(view.dist), camYaw = 0;
let camFov = CLOSE_FOV, trauma = 0, shakeT = 0, followBlend = 1, followFrom = new Vector3(), targetY = 0;
const portrait = () => canvas.clientWidth < canvas.clientHeight;
// I-037: منظر جانبي بزر: الكاميرا تنزل قريب الأرض وتشوف المعركة من الجنب (الأفق والجبال بالخلفية). نفس المخرج والتلاحق.
let sideView = false, sideDist = 220;
const SIDE_PITCH = 0.13, SIDE_FOV = 0.62;
function updateCamera(dt: number) {
  const k = 1 - Math.exp(-dt * 5);
  let tgt = new Vector3(view.tx, groundH(view.tx, view.tz) + targetY, view.tz), want = view.dist, pitch = view.pitch > 0 ? view.pitch : pitchFor(view.dist);
  const f = view.follow ? findEntity(view.follow) : null;
  if (f) { tgt = v(f.p); want = view.fDist; pitch = f.air ? 0.2 : CLOSE_PITCH; view.tx = tgt.x; view.tz = tgt.z;
    if (sideView && !f.air) { want = Math.min(view.fDist, 75); pitch = SIDE_PITCH; }
    if (f.air && f.vel && len(f.vel) > 5) view.yaw = camYaw + angDiff(camYaw, Math.atan2(f.vel[0], f.vel[2])) * (1 - Math.exp(-dt * 2)); }
  if (f) { followBlend = Math.min(1, followBlend + dt / 0.8); const e = followBlend * followBlend * (3 - 2 * followBlend); camTarget = Vector3.Lerp(followFrom, tgt, e); if (followBlend < 1) followFrom = Vector3.Lerp(followFrom, tgt, k * 0.5); }
  else camTarget = Vector3.Lerp(camTarget, tgt, k);
  if (sideView && !f) { want = sideDist; pitch = SIDE_PITCH; tgt.y += 3; }
  if (!(f && f.air) && !sideView) pitch = Math.max(pitch, lerp(0.3, 0.78, closeK(want)));   // بالمعركة القريبة ما نخلي الكاميرا تنزل وتبين السما
  camDist = lerp(camDist, want, k); camPitch = lerp(camPitch, pitch, k); camYaw = camYaw + angDiff(camYaw, view.yaw) * k;
  const fovW = f && f.air ? WIDE_FOV : sideView ? SIDE_FOV : lerp(WIDE_FOV, CLOSE_FOV, closeK(camDist)); camFov = lerp(camFov, fovW, k);
  // الشاشة بالطول: نثبت الزاوية الأفقية حتى ما يطلع الهدف برّا
  cam.fovMode = portrait() ? FreeCamera.FOVMODE_HORIZONTAL_FIXED : FreeCamera.FOVMODE_VERTICAL_FIXED; cam.fov = portrait() ? camFov * 1.15 : camFov;
  const cp = Math.cos(camPitch) * camDist, pos = new Vector3(camTarget.x - Math.sin(camYaw) * cp, camTarget.y + Math.sin(camPitch) * camDist, camTarget.z - Math.cos(camYaw) * cp);
  pos.y = Math.max(pos.y, groundH(pos.x, pos.z) + 4);
  // إذا تلّة تسد النظر بين الكاميرا والهدف، نرفع الكاميرا
  for (let it = 0; it < 7; it++) { let blocked = false; for (let q = 0.12; q < 0.95; q += 0.11) { const x = lerp(pos.x, camTarget.x, q), z = lerp(pos.z, camTarget.z, q); if (groundH(x, z) + 2.5 > lerp(pos.y, camTarget.y, q)) { blocked = true; break; } } if (!blocked) break; pos.y += camDist * 0.07 + 2; }
  trauma = Math.max(0, trauma - dt * 1.4); shakeT += dt * 30;
  const sh = trauma * trauma * camDist * 0.007;
  cam.position.copyFrom(pos);
  cam.setTarget(camTarget.add(new Vector3(Math.sin(shakeT * 1.7) * sh, Math.sin(shakeT * 2.3) * sh, Math.sin(shakeT * 1.1) * sh)));
  // الظلال تتبع مكان الكاميرا
  if (shadows) { const on = camDist < 1500; sun.shadowEnabled = on; if (on) { sun.position = camTarget.add(v(scale(SUN, 700))); sun.shadowFrustumSize = sideView ? 650 : clamp(camDist * Math.tan(camFov) * 2.2, 90, 1300); } }
}
// لمس
const ptrs = new Map<number, { x: number; y: number }>();
let pinch0 = 0, angle0 = 0, moved = 0;
canvas.addEventListener('pointerdown', e => { setAuto(false); canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); angle0 = Math.atan2(b.y - a.y, b.x - a.x); } });
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
  if (ptrs.size === 1) {
    if (view.follow && moved > 12) endFollow(); if (view.follow) return;
    view.pitch = -1; targetY = 0;
    const s = (camDist * 2 * Math.tan(camFov / 2)) / canvas.clientHeight, fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const sp = Math.max(Math.sin(camPitch), 0.35); view.tx += (-dx * fz + dy * fx / sp * 0.9) * s; view.tz += (dx * fx + dy * fz / sp * 0.9) * s;
    view.tx = clamp(view.tx, -6000, 6000); view.tz = clamp(view.tz, -6000, 6000);
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    if (pinch0) { zoomBy(pinch0 / d); view.yaw -= angDiff(angle0, ang); }
    pinch0 = d; angle0 = ang;
  }
});
const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch0 = 0; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { e.preventDefault(); setAuto(false); zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
function zoomBy(f: number) { if (view.follow) view.fDist = clamp(view.fDist * f, 25, 1500); else if (sideView) sideDist = clamp(sideDist * f, 50, 800); else { view.pitch = -1; view.dist = clamp(view.dist * f, 120, 9000); } }

// ===== معالجة الصورة =====
const pipe = new DefaultRenderingPipeline('pipe', true, scene, [cam]);
function applyPipe() {
  pipe.fxaaEnabled = true; pipe.bloomEnabled = true; pipe.bloomThreshold = 0.8; pipe.bloomWeight = HQ ? 0.45 : 0.35; pipe.bloomKernel = HQ ? 48 : 32; pipe.bloomScale = 0.5;
  const ip = pipe.imageProcessing; ip.toneMappingEnabled = true; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.75; ip.contrast = 1.15; ip.vignetteEnabled = true; ip.vignetteWeight = 1.3;
  pipe.sharpenEnabled = HQ; pipe.sharpen.edgeAmount = 0.25;
}
applyPipe();

// ===== المجسمات =====
const MODEL: Record<string, { scale: number; yaw: number; y?: number; center?: boolean; off?: V3 }> = {
  // y: المجسم الأصلي نازل تحت الأرض (الجنزير عند -0.8م)؛ T-72 مدفعها على -z بالملف فندوّرها
  abrams: { scale: 1, yaw: 0, y: 0.8 }, t72: { scale: 1, yaw: Math.PI, y: 0.8 }, technical: { scale: 0.8, yaw: 0 }, dshk: { scale: 0.11, yaw: 0, y: 0.5 },
  d30: { scale: 0.22, yaw: Math.PI }, grad: { scale: 1, yaw: 0 }, patriot: { scale: 1, yaw: 0 }, s400: { scale: S400_SCALE, yaw: 0, y: 0.502 * S400_SCALE },
  shahed: { scale: 1.45, yaw: 0 }, kh101: { scale: 1, yaw: Math.PI },
  bmp: { scale: 0.24, yaw: 0, center: true }, kornet: { scale: 0.2, yaw: Math.PI / 2, center: true },
};
const containers: Record<string, AssetContainer> = {};
// ===== البرج منفصل (TH5.2): المجسمات قطعها حسب الخامة مو حسب الجزء، فنقسم المثلثات بالمكان (البرج فوق خط القطع وداخل حلقته + السبطانة).
// الحدود بإحداثيات glTF (x بـ Babylon معكوس)، مضبوطة بالعين بـ tools/turretmap.mjs. piv = مركز دوران البرج [x, z].
const TURRET: Record<string, { piv: [number, number]; f: (x: number, y: number, z: number) => boolean }> = {
  abrams: { piv: [0, -0.7], f: (x, y, z) => (y > 1.3 && Math.abs(x) < 1.9 && z > -3.7 && z < 1.95) || (y > 1.12 && Math.abs(x) < 0.2 && z > 1.9) /* السبطانة: محورها y≈1.33 فنصها التحتاني تحت 1.3 */ },
  t72: { piv: [0, 0.85], f: (x, y, z) => (y > 0.9 && Math.hypot(x, z - 0.85) < 1.75) || (y > 1.25 && Math.abs(x) < 2.05 && z > -1 && z < 3) || (y > 0.9 && Math.abs(x) < 0.3 && z < 0.85) },
  bmp: { piv: [-166.87, -152.6], f: (x, y, z) => (y > 7.1 && Math.hypot(x + 166.87, z + 152.6) < 4.3) || (y > 7.4 && Math.abs(x + 166.87) < 0.6 && z > -152.6) },
};
const PROTO: Record<string, { hull: Mesh[]; tur: Mesh[]; piv: Vector3; dark?: { hull: Mesh[]; tur: Mesh[] } }> = {};
function splitTurret(n: string, c: AssetContainer) {
  const T = TURRET[n], piv = new Vector3(-T.piv[0], 0, T.piv[1]), hull: Mesh[] = [], tur: Mesh[] = [];
  const tv = new Vector3(), tn = new Vector3();
  for (const m of c.meshes) {
    if (!(m instanceof Mesh) || !m.getTotalVertices()) continue;
    m.computeWorldMatrix(true); const Wm = m.getWorldMatrix(), flip = Wm.determinant() < 0;
    const pos = m.getVerticesData('position')!, nor = m.getVerticesData('normal'), uv = m.getVerticesData('uv'), col = m.getVerticesData('color');
    const nv = pos.length / 3, idx = m.getIndices() ?? Array.from({ length: nv }, (_, i) => i);
    const P = new Float32Array(pos.length), N = nor ? new Float32Array(nor.length) : null;
    for (let i = 0; i < nv; i++) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], Wm, tv); P[i * 3] = tv.x; P[i * 3 + 1] = tv.y; P[i * 3 + 2] = tv.z;
      if (N && nor) { Vector3.TransformNormalFromFloatsToRef(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2], Wm, tn); tn.normalize(); N[i * 3] = tn.x; N[i * 3 + 1] = tn.y; N[i * 3 + 2] = tn.z; }
    }
    const parts: number[][] = [[], []];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], d = idx[t + 2];
      const cx = (P[a * 3] + P[b * 3] + P[d * 3]) / 3, cy = (P[a * 3 + 1] + P[b * 3 + 1] + P[d * 3 + 1]) / 3, cz = (P[a * 3 + 2] + P[b * 3 + 2] + P[d * 3 + 2]) / 3;
      parts[T.f(-cx, cy, cz) ? 1 : 0].push(a, flip ? d : b, flip ? b : d);
    }
    parts.forEach((ix, k) => {
      if (!ix.length) return;
      const map = new Map<number, number>(), np: number[] = [], nn: number[] = [], nu: number[] = [], nc: number[] = [], ni: number[] = [];
      const o = k ? piv : Vector3.ZeroReadOnly;
      for (const i of ix) { let j = map.get(i); if (j === undefined) { j = map.size; map.set(i, j); np.push(P[i * 3] - o.x, P[i * 3 + 1] - o.y, P[i * 3 + 2] - o.z); if (N) nn.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); if (uv) nu.push(uv[i * 2], uv[i * 2 + 1]); if (col) nc.push(col[i * 4], col[i * 4 + 1], col[i * 4 + 2], col[i * 4 + 3]); } ni.push(j); }
      const vd = new VertexData(); vd.positions = np; vd.indices = ni; if (N) vd.normals = nn; if (uv) vd.uvs = nu; if (col) vd.colors = nc;
      const pm = new Mesh(`${n}_${k ? 'tur' : 'hull'}_${m.name}`, scene); vd.applyToMesh(pm); pm.material = m.material; pm.isVisible = false; pm.isPickable = false;
      (k ? tur : hull).push(pm);
    });
    m.isVisible = false;
  }
  PROTO[n] = { hull, tur, piv };
}
const wreckMat = new StandardMaterial('wreckMat', scene); wreckMat.diffuseColor = new Color3(0.07, 0.066, 0.06); wreckMat.specularColor = Color3.Black();
function protoSet(kind: string, wreck: boolean) {
  const pr = PROTO[kind]; if (!wreck) return pr;
  if (!pr.dark) { const dk = (ms: Mesh[]) => ms.map(m => { const c = m.clone(m.name + '_w', null, true)!; c.material = wreckMat; c.isVisible = false; return c; }); pr.dark = { hull: dk(pr.hull), tur: dk(pr.tur) }; }
  return pr.dark;
}
async function loadModels(progress: (t: string) => void) {
  const names = Object.keys(MODEL); let done = 0;
  await Promise.all(names.map(async n => {
    const c = await LoadAssetContainerAsync(modelUrl(n), scene, { pluginExtension: '.gltf' });
    c.materials.forEach(m => { if (m instanceof PBRMaterial) { m.environmentIntensity = 0; m.directIntensity = PBR_DIRECT; m.metallic = Math.min(m.metallic ?? 1, 0.15); /* بدون بيئة انعكاس المعدن يطلع أسود */ m.maxSimultaneousLights = 2 + NL; } });
    c.addAllToScene(); c.meshes.forEach(m => { m.isVisible = false; m.isPickable = false; });
    if (MODEL[n].center) { let mn = new Vector3(1e9, 1e9, 1e9), mx = new Vector3(-1e9, -1e9, -1e9); c.meshes.forEach(m => { if (!m.getTotalVertices()) return; m.computeWorldMatrix(true); const bb = m.getBoundingInfo().boundingBox; mn = Vector3.Minimize(mn, bb.minimumWorld); mx = Vector3.Maximize(mx, bb.maximumWorld); });
      MODEL[n].off = [-(mn.x + mx.x) / 2, -mn.y, -(mn.z + mx.z) / 2]; }
    if (TURRET[n]) splitTurret(n, c);
    containers[n] = c; progress(`يحمّل المجسمات… ${++done}/${names.length}`);
  }));
}
const blobMat = new StandardMaterial('blobMat', scene); blobMat.diffuseTexture = texBlob; blobMat.opacityTexture = texBlob; blobMat.disableLighting = true; blobMat.emissiveColor = Color3.Black(); blobMat.specularColor = Color3.Black();
function spawnModel(kind: string, wreck = false): { root: TransformNode; inner: TransformNode; tur: TransformNode | null } {
  const root = new TransformNode('u_' + kind, scene), inner = new TransformNode('in', scene); inner.parent = root;
  const spec = MODEL[kind]; inner.rotation.y = spec.yaw; inner.scaling.setAll(spec.scale); inner.position.y = spec.y ?? 0;
  if (PROTO[kind]) {
    // جسم + برج كنسخ خفيفة (instances) من القطع المقسومة
    const pr = PROTO[kind], set = protoSet(kind, wreck), ofs = new TransformNode('ofs', scene); ofs.parent = inner; if (spec.off) ofs.position.set(...spec.off);
    const tur = new TransformNode('tur', scene); tur.parent = ofs; tur.position.copyFrom(pr.piv);
    const mk = (m: Mesh, par: TransformNode) => { const i = m.createInstance(m.name + '_i'); i.parent = par; i.isPickable = false; i.isVisible = true; caster(i); };
    set.hull.forEach(m => mk(m, ofs)); set.tur.forEach(m => mk(m, tur));
    return { root, inner, tur };
  }
  const inst = containers[kind].instantiateModelsToScene(n => n, wreck, { doNotInstantiate: wreck });
  const ofs = new TransformNode('ofs', scene); ofs.parent = inner; if (spec.off) ofs.position.set(...spec.off);
  inst.rootNodes.forEach(r => { r.parent = ofs; });
  root.getChildMeshes().forEach(m => { m.isPickable = false; m.isVisible = true; if (!wreck || true) caster(m); if (wreck && m.material instanceof PBRMaterial) { m.material.albedoColor = new Color3(0.09, 0.085, 0.08); m.material.metallic = 0; m.material.roughness = 1; m.material.emissiveColor = Color3.Black(); } });
  return { root, inner, tur: null };
}

// ===== الجنود (TH5.4): حركات مخبوزة بقوام (VAT). كل الجنود نسخ رقيقة (thin instances) لقطعة وحدة؛
// وضع العظام لكل لقطة محفوظ بقوام، والكارت يقراه — فـ 300 جندي تقريباً بكلفة جندي واحد على المعالج.
type Anim = 'run' | 'simple walk' | 'simple shoot' | 'crouch shoot' | 'pron idle' | 'pron shot' | 'pron walk' | 'simple death' | 'pron death' | 'idle simple'
  | 'crouch idle' | 'walk crouch' | 'crouch death' | 'reload idle' | 'reload crouch' | 'pron reload' | 'reload walk' | 'reload run' | 'simple to crouch' | 'idle simple to crouch' | 'crouch to pron' | 'pron to crouch';
const SOL_FPS = 30, SOL_CAP = 700;
let solMesh: Mesh | null = null, SOL_S = 1, vatTime = 0;
const solW0 = Matrix.Identity(), animRange = new Map<string, { s: number; e: number; fps: number; dur: number }>();
let solMat = new Float32Array(16), solSet = new Float32Array(4), solMan: BakedVertexAnimationManager | null = null;
// TH6.2: نقاط التعليق لكل لقطة (بإحداثيات الجندي): الكتف اليمين، اليد اليمين، اليد اليسار — للسلاح وفوهته
let solAtt = new Float32Array(9);
async function loadSoldier() {
  const c = await LoadAssetContainerAsync(modelUrl('soldier'), scene, { pluginExtension: '.gltf' });
  c.materials.forEach(m => { if (m instanceof PBRMaterial) { m.environmentIntensity = 0; m.directIntensity = PBR_DIRECT * 1.35; m.metallic = 0; m.roughness = 0.85; m.emissiveColor = new Color3(0.035, 0.035, 0.03); m.maxSimultaneousLights = 2 + NL; } });
  c.addAllToScene();
  const ms = c.meshes.filter(m => m.getTotalVertices() > 0) as Mesh[], sk = ms[0].skeleton!, par = ms[0].parent;
  ms.forEach(m => { m.parent = null; m.position.setAll(0); m.rotationQuaternion = null; m.rotation.setAll(0); m.scaling.setAll(1); });
  const merged = Mesh.MergeMeshes(ms, true, true, undefined, false, false);
  const body = merged ?? ms[0]; body.skeleton = sk; body.parent = par; body.name = 'soldierBody'; body.isPickable = false;
  c.animationGroups.forEach(g => g.stop());
  // نقيس طول الجندي ونخليه 1.8 م
  body.refreshBoundingInfo({ applySkeleton: true }); body.computeWorldMatrix(true);
  const bb = body.getBoundingInfo().boundingBox, h = bb.maximumWorld.y - bb.minimumWorld.y; SOL_S = h > 0.01 ? 1.8 / h : 1;
  // خبز الحركات: كل حركة نمشي لقطاتها (30 بالثانية) ونحفظ مصفوفات العظام
  solW0.copyFrom(body.getWorldMatrix());
  const frames: Float32Array[] = [], att: number[] = [];
  const boneNode = (nm: string) => sk.bones.find(b => b.name.startsWith('mixamorig:' + nm + '_'))?.getTransformNode() ?? null;
  const attN = ['RightShoulder', 'RightHand', 'LeftHand'].map(boneNode), invB = Matrix.Invert(body.getWorldMatrix());
  for (const g of c.animationGroups) {
    const fps = g.targetedAnimations[0]?.animation.framePerSecond ?? 60, dur = Math.max(0.05, (g.to - g.from) / fps), n = Math.max(2, Math.round(dur * SOL_FPS) + 1), s0 = frames.length;
    g.start(false, 1, g.from, g.to); g.pause();
    for (let i = 0; i < n; i++) { g.goToFrame(g.from + (g.to - g.from) * i / (n - 1)); sk.bones.forEach(b => b.getTransformNode()?.computeWorldMatrix(true)); sk.prepare(true); frames.push(sk.getTransformMatrices(body).slice());
      for (const nd of attN) { const q = nd ? Vector3.TransformCoordinates(nd.getAbsolutePosition(), invB) : Vector3.Zero(); att.push(q.x, q.y, q.z); } }
    g.stop(); animRange.set(g.name, { s: s0, e: frames.length - 1, fps: (n - 1) / dur, dur });
  }
  solAtt = new Float32Array(att);
  const data = new Float32Array(frames.length * frames[0].length); frames.forEach((f, i) => data.set(f, i * f.length));
  solMan = new BakedVertexAnimationManager(scene); solMan.texture = new VertexAnimationBaker(scene, body).textureFromBakedVertexData(data); body.bakedVertexAnimationManager = solMan;
  c.animationGroups.forEach(g => g.dispose());
  body.parent = null; body.position.setAll(0); body.rotationQuaternion = null; body.rotation.setAll(0); body.scaling.setAll(1);
  c.meshes.forEach(m => { if (m !== body) m.isVisible = false; });
  solMat = new Float32Array(SOL_CAP * 16); solSet = new Float32Array(SOL_CAP * 4);
  body.thinInstanceSetBuffer('matrix', solMat, 16, false);
  body.thinInstanceRegisterAttribute('bakedVertexAnimationSettingsInstanced', 4); body.thinInstanceSetBuffer('bakedVertexAnimationSettingsInstanced', solSet, 4, false);
  body.thinInstanceCount = 0; body.alwaysSelectAsActiveMesh = true; body.isVisible = true; body.receiveShadows = true; caster(body);
  solMesh = body;
  // آر بي جي-7 (TastyTony، CC BY): طوله على x (القذيفة لـ +x بـ glTF = −x ببابلون) ← نلفه للـ +z
  try {
    const rc = await LoadAssetContainerAsync(modelUrl('p_rpg'), scene, { pluginExtension: '.gltf' }); rc.addAllToScene();
    rc.materials.forEach(m => { if (m instanceof PBRMaterial) { m.environmentIntensity = 0; m.directIntensity = PBR_DIRECT; m.metallic = Math.min(m.metallic ?? 1, 0.15); m.maxSimultaneousLights = 2 + NL; } });
    const rms = rc.meshes.filter(m => m.getTotalVertices() > 0) as Mesh[]; let mn = new Vector3(1e9, 1e9, 1e9), mx = new Vector3(-1e9, -1e9, -1e9);
    rms.forEach(m => { m.computeWorldMatrix(true); const bb = m.getBoundingInfo().boundingBox; mn = Vector3.Minimize(mn, bb.minimumWorld); mx = Vector3.Maximize(mx, bb.maximumWorld); });
    const N = Matrix.Translation(-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -(mn.z + mx.z) / 2).multiply(Matrix.RotationY(Math.PI / 2)).multiply(Matrix.Scaling(1.25 / 1.33, 1.25 / 1.33, 1.25 / 1.33));
    for (const m of rms) { const wmx = m.computeWorldMatrix(true).clone(); m.setParent(null); m.position.setAll(0); m.rotationQuaternion = null; m.rotation.setAll(0); m.scaling.setAll(1); m.bakeTransformIntoVertices(wmx.multiply(N)); m.isPickable = false;
      m.thinInstanceSetBuffer('matrix', rpgMat, 16, false); m.thinInstanceCount = 0; m.alwaysSelectAsActiveMesh = true; caster(m); }
    rc.meshes.filter(m => m.getTotalVertices() === 0).forEach(m => m.dispose()); rc.transformNodes.forEach(t => t.dispose()); rpgMeshes = rms;
  } catch (e) { console.warn('rpg', e); }
  // قذيفة PG-7V (D_U، CC BY): الرأس الحربي على −x بـ glTF (= +x ببابلون) ← نلفها للـ +z، طولها الحقيقي ~0.93م
  try {
    const pc = await LoadAssetContainerAsync(modelUrl('p_pg7'), scene, { pluginExtension: '.gltf' }); pc.addAllToScene();
    pc.materials.forEach(m => { if (m instanceof PBRMaterial) { m.environmentIntensity = 0; m.directIntensity = PBR_DIRECT; m.metallic = 0.1; m.albedoColor = new Color3(0.36, 0.38, 0.27); m.maxSimultaneousLights = 2 + NL; } });
    const pms = pc.meshes.filter(m => m.getTotalVertices() > 0) as Mesh[]; pms.forEach(m => m.computeWorldMatrix(true));
    const k = 0.93 / 10.07, N = Matrix.RotationY(-Math.PI / 2).multiply(Matrix.Scaling(k, k, k));
    for (const m of pms) { const wmx = m.computeWorldMatrix(true).clone(); m.setParent(null); m.position.setAll(0); m.rotationQuaternion = null; m.rotation.setAll(0); m.scaling.setAll(1); m.bakeTransformIntoVertices(wmx.multiply(N)); }
    pg7Mesh = pms.length > 1 ? Mesh.MergeMeshes(pms, true, true, undefined, false, true) : pms[0]; if (pg7Mesh) { pg7Mesh.isVisible = false; pg7Mesh.isPickable = false; }
    pc.transformNodes.forEach(t => t.dispose());
  } catch (e) { console.warn('pg7', e); }
  console.log('soldier VAT', { frames: frames.length, bones: sk.bones.length, anims: [...animRange.keys()].join(',') });
}
// جندي = بيانات بس (مكان، اتجاه، حركة)؛ الرسم كله بـ drawSoldiers
// ===== رسم الجنود (TH6.1): كل جندي من مكانه ووضعيته وحالته بالمحاكاة؛ هنا بس اختيار الحركة والانتقالات =====
interface SV { ph: number; spd: number; dieT: number; die: Anim | ''; pose: string; tr: Anim | ''; trT: number; dx: number; dz: number; mz: V3 | null }
const solVis = new Map<number, SV>(), deadOrder: number[] = [];
interface SVis { kornet?: TransformNode }
const squadVis = new Map<number, SVis>();
const TRANS: Record<string, Anim> = { 'stand>crouch': 'simple to crouch', 'crouch>prone': 'crouch to pron', 'stand>prone': 'crouch to pron', 'prone>crouch': 'pron to crouch' };
function syncSquads(dt: number) {
  const VS = visScale(0.6);
  for (const u of W.units) {
    if (u.kind !== 'kornet') continue;
    let sv = squadVis.get(u.id); if (!sv) { sv = { kornet: spawnModel('kornet').root }; squadVis.set(u.id, sv); }
    const g = u.sol.find(s => s.role === 'at') , p = g ? g.p : u.p;
    sv.kornet!.position.set(p[0] + 0.8, groundH(p[0], p[2]), p[2]); sv.kornet!.scaling.setAll(VS); sv.kornet!.rotation.y = g ? g.yaw : u.yaw; sv.kornet!.setEnabled(u.alive && u.state !== 'mounted');
  }
  void dt;
}
function solAnim(u: Unit, s: Sol): Anim {
  const P = s.pose;
  if (s.act === 'rush') return 'run';
  if (s.act === 'crawl') return 'pron walk';
  if (s.act === 'move') return P === 'crouch' ? 'walk crouch' : u.pose === 'run' || u.state === 'retreat' ? 'run' : 'simple walk';
  if (s.act === 'reload') return P === 'prone' ? 'pron reload' : P === 'crouch' ? 'reload crouch' : 'reload idle';
  if (s.act === 'fire' && W.T - s.lastShot < 0.8) return P === 'prone' ? 'pron shot' : P === 'crouch' ? 'crouch shoot' : 'simple shoot';
  return P === 'prone' ? 'pron idle' : P === 'crouch' ? 'crouch idle' : 'idle simple';
}
const tS = new Vector3(), tT = new Vector3(), tQ = new Quaternion(), tM = new Matrix(), tO = new Matrix();
const rpgMat = new Float32Array(64 * 16); let rpgMeshes: Mesh[] = [];
/** نفس حساب الكارت لرقم اللقطة (bakedVertexAnimation)، حتى نعرف وين اليد بهاللحظة */
function vatFrame(k: number) { const st = solSet[k], en = solSet[k + 1], off = solSet[k + 2], sp = solSet[k + 3], tot = en - st + 1, t = vatTime * sp / tot, corr = t < 1 ? 0 : 1, num = tot - corr;
  return Math.max(0, Math.floor(((((t - Math.floor(t)) * num + off) % num) + num) % num) + st + corr); }
const aS = new Vector3(), aR = new Vector3(), aL = new Vector3(), aV = new Vector3();
/** مكان الجندي بالرسم: نفس مكانه بالمحاكاة، بس البعد عن مركز الحضيرة يتكبر ويا التكبير البصري */
const solAt = (u: Unit, p: V3, VS: number): [number, number] => [u.p[0] + (p[0] - u.p[0]) * VS, u.p[2] + (p[2] - u.p[2]) * VS];
function drawSoldiers(dt: number) {
  if (!solMesh || !solMan) return;
  vatTime += dt * slowK * simSpeed; solMan.time = vatTime;
  const VS = visScale(0.6), cp = cam.globalPosition; let n = 0, nR = 0;
  const once = (k: number, a: Anim, t0: number) => { const r = animRange.get(a)!, tot = r.e - r.s + 1; if (vatTime - t0 < r.dur) { solSet[k] = r.s; solSet[k + 1] = r.e; solSet[k + 2] = ((-t0 * r.fps) % tot + tot) % tot; solSet[k + 3] = r.fps; return true; } return false; };
  const hold = (k: number, a: Anim) => { const r = animRange.get(a)!; solSet[k] = r.e - 1; solSet[k + 1] = r.e; solSet[k + 2] = 1.5; solSet[k + 3] = 0.0001; };
  const lim = new Set(deadOrder.slice(-160));
  for (const u of W.units) {
    if (u.kind !== 'inf' && u.kind !== 'kornet') continue;
    for (const s of u.sol) {
      if (n >= SOL_CAP) break;
      let v = solVis.get(s.id); if (!v) { v = { ph: Math.random() * 60, spd: 0.9 + Math.random() * 0.2, dieT: -1, die: '', pose: s.pose, tr: '', trT: 0, dx: 0, dz: 0, mz: null }; solVis.set(s.id, v); }
      if (!s.alive && v.dieT < 0) { if (s.hidden || u.state === 'mounted') continue; v.dieT = vatTime; v.die = v.pose === 'prone' ? 'pron death' : v.pose === 'crouch' ? 'crouch death' : 'simple death'; [v.dx, v.dz] = solAt(u, s.p, VS); deadOrder.push(s.id); }
      if (!s.alive && !lim.has(s.id)) continue;
      if (s.alive && s.hidden) continue;
      const [x, z] = s.alive ? solAt(u, s.p, VS) : [v.dx, v.dz];
      if (Math.abs(x - cp.x) + Math.abs(z - cp.z) > 3200) continue;
      tS.setAll(SOL_S * VS); tT.set(x, groundH(x, z), z); Quaternion.RotationYawPitchRollToRef(s.yaw, 0, 0, tQ); Matrix.ComposeToRef(tS, tQ, tT, tM); solW0.multiplyToRef(tM, tO); tO.copyToArray(solMat, n * 16);
      const k = n * 4;
      if (!s.alive) { if (!once(k, v.die as Anim, v.dieT)) hold(k, v.die as Anim); }
      else {
        if (v.pose !== s.pose) { const t = TRANS[v.pose + '>' + s.pose]; if (t && s.act !== 'rush' && s.act !== 'move') { v.tr = t; v.trT = vatTime; } v.pose = s.pose; }   // انتقال طبيعي بين الوضعيات
        if (!(v.tr && once(k, v.tr, v.trT))) { v.tr = ''; const a = solAnim(u, s), r = animRange.get(a) ?? animRange.get('idle simple')!, tot = r.e - r.s + 1;
          solSet[k] = r.s; solSet[k + 1] = r.e; solSet[k + 2] = v.ph % tot; solSet[k + 3] = r.fps * v.spd * (a === 'run' && s.act !== 'rush' ? 0.9 : 1); }
        // نقاط اليد والكتف بهاللقطة ← فوهة السلاح، والآر بي جي على الكتف
        const f = vatFrame(k) * 9;
        if (f + 8 < solAtt.length) {
          Vector3.TransformCoordinatesFromFloatsToRef(solAtt[f], solAtt[f + 1], solAtt[f + 2], tO, aS); Vector3.TransformCoordinatesFromFloatsToRef(solAtt[f + 3], solAtt[f + 4], solAtt[f + 5], tO, aR); Vector3.TransformCoordinatesFromFloatsToRef(solAtt[f + 6], solAtt[f + 7], solAtt[f + 8], tO, aL);
          aL.subtractToRef(aR, aV); const l = aV.length(), fy = Math.sin(s.yaw), fz = Math.cos(s.yaw);
          if (l < 0.12 * VS) aV.set(fy, 0, fz); else aV.scaleInPlace(1 / l);
          v.mz = [aL.x + aV.x * 0.45 * VS, aL.y + aV.y * 0.45 * VS, aL.z + aV.z * 0.45 * VS];
          if (s.role === 'rpg' && u.rpg > 0 && nR < 64) {
            // يرمي/ينشن: القاذفة على الكتف باتجاه اليدين؛ يمشي/يركض: معلّقة على الظهر بميلان
            const aiming = s.act === 'fire' || s.act === 'idle', yaw = aiming ? Math.atan2(aV.x, aV.z) : s.yaw + 0.3, pitch = aiming ? -Math.asin(Math.max(-0.5, Math.min(0.5, aV.y))) : -1.0;
            const px = aiming ? aS.x : aS.x - fy * 0.18 * VS, py = aS.y + (aiming ? 0.08 : -0.15) * VS, pz = aiming ? aS.z : aS.z - fz * 0.18 * VS;
            Matrix.ComposeToRef(new Vector3(VS, VS, VS), Quaternion.RotationYawPitchRoll(yaw, pitch, 0), new Vector3(px, py, pz), tM); tM.copyToArray(rpgMat, nR * 16); nR++;
          }
        }
      }
      n++;
    }
  }
  solMesh.thinInstanceCount = n; solMesh.thinInstanceBufferUpdated('matrix'); solMesh.thinInstanceBufferUpdated('bakedVertexAnimationSettingsInstanced');
  for (const m of rpgMeshes) { m.thinInstanceCount = nR; m.thinInstanceBufferUpdated('matrix'); }
}

// ===== الجسيمات: مجمّعات مشتركة =====
const pools: Pool[] = [];
interface Req { a: V3; b?: V3; n: number; dir?: V3; spd?: [number, number]; life?: number; up?: number; jit?: number; spread?: number }
class Pool {
  ps: ParticleSystem; q: Req[] = []; cur: Req | null = null; left = 0;
  constructor(name: string, cap: number, tex: BaseTexture, add: boolean, o: { life: [number, number]; size: [number, number][]; colors: [number, Color4][]; gravity?: number; damp?: number; stretched?: boolean; spin?: number; sheet?: { cw: number; ch: number; n: number; rand?: boolean; speed?: number; sy?: number } }) {
    const p = this.ps = new ParticleSystem(name, cap, scene, null, !!o.sheet);
    if (o.sheet) { const sh = o.sheet; p.spriteCellWidth = sh.cw; p.spriteCellHeight = sh.ch; p.startSpriteCellID = 0; p.endSpriteCellID = sh.n - 1; p.spriteCellChangeSpeed = sh.speed ?? 1; p.spriteRandomStartCell = !!sh.rand; p.spriteCellLoop = false; if (sh.sy) { p.minScaleY = p.maxScaleY = sh.sy; } }
    p.particleTexture = tex; p.blendMode = add ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
    p.emitter = Vector3.Zero(); p.emitRate = 0; p.manualEmitCount = 0; p.minEmitPower = p.maxEmitPower = 1; p.updateSpeed = 1 / 60;
    p.minLifeTime = o.life[0]; p.maxLifeTime = o.life[1];
    o.size.forEach(([t, s], i) => p.addSizeGradient(t, s, s * (i === 0 ? 1.6 : 1.3))); o.colors.forEach(([t, c]) => p.addColorGradient(t, c));
    p.gravity = new Vector3(0, o.gravity ?? 0, 0);
    if (o.damp) { p.addLimitVelocityGradient(0, 400); p.addLimitVelocityGradient(0.2, 40); p.addLimitVelocityGradient(1, 2); p.limitVelocityDamping = o.damp; }
    if (o.stretched) p.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    p.minInitialRotation = 0; p.maxInitialRotation = 6.28; p.minAngularSpeed = -(o.spin ?? 0.3); p.maxAngularSpeed = o.spin ?? 0.3;
    p.startPositionFunction = (_w: Matrix, out: Vector3, pt: Particle) => {
      if (this.left <= 0) { this.cur = this.q.shift() ?? null; this.left = this.cur?.n ?? 0; }
      this.left--; const r = this.cur; if (!r) { out.set(0, -9999, 0); return; }
      const k = Math.random(), j = r.jit ?? 0.5, b = r.b ?? r.a;
      out.set(lerp(r.a[0], b[0], k) + (Math.random() - 0.5) * j, lerp(r.a[1], b[1], k) + (Math.random() - 0.5) * j, lerp(r.a[2], b[2], k) + (Math.random() - 0.5) * j);
      if (r.life) pt.lifeTime = r.life * (0.9 + Math.random() * 0.2);
    };
    p.startDirectionFunction = (_w: Matrix, out: Vector3) => {
      const r = this.cur; if (!r) { out.set(0, 0, 0); return; }
      const s = r.spd ? lerp(r.spd[0], r.spd[1], Math.random()) : 0;
      if (r.dir) { const sp = r.spread ?? 0; const d = norm([r.dir[0] + (Math.random() - 0.5) * sp, r.dir[1] + (Math.random() - 0.5) * sp, r.dir[2] + (Math.random() - 0.5) * sp]); out.set(d[0] * s, d[1] * s, d[2] * s); }
      else { const d = norm([Math.random() - 0.5, Math.random() - 0.5 + (r.up ?? 0), Math.random() - 0.5]); out.set(d[0] * s, d[1] * s, d[2] * s); }
    };
    p.start(); pools.push(this);
  }
  emit(r: Req) { if (r.n <= 0) return; this.q.push(r); this.ps.manualEmitCount = Math.max(0, this.ps.manualEmitCount) + Math.round(r.n); }
  flush() { this.q.length = 0; this.left = 0; this.cur = null; }
}
// فليب بوك حقيقي (Unity Labs، CC0، مسوّى بـ Houdini): انفجارات، كرة نار، دخان متكوّر، لهب (I-023)
const fxTex = (n: string) => { const t = new Texture(texUrls[`../textures/${n}.webp`], scene, false, true, Texture.TRILINEAR_SAMPLINGMODE); t.hasAlpha = true; return t; };
const texExplo1 = fxTex('fx_explo1'), texExplo2 = fxTex('fx_explo2'), texCloud = fxTex('fx_cloud'), texFire = fxTex('fx_fire'), texFlame = fxTex('fx_flame');
const SH_CLOUD = { cw: 128, ch: 128, n: 64, rand: true }, SH_FIRE = { cw: 64, ch: 64, n: 64, rand: true };
const Qn = (n: number) => Math.max(1, Math.round(n * (HQ ? 1 : 0.55)));
const C4 = (r: number, g: number, b: number, a: number) => new Color4(r, g, b, a);
const fireS = new Pool('fireS', 1000, texFire, true, { sheet: SH_FIRE,  life: [0.3, 0.8], size: [[0, 2], [0.4, 6], [1, 8]], damp: 0.85, colors: [[0, C4(2.6, 2.1, 1.6, 1)], [0.5, C4(1.6, 1, 0.6, 0.8)], [1, C4(0.3, 0.15, 0.08, 0)]] });
const fireL = new Pool('fireL', 800, texFire, true, { sheet: SH_FIRE,  life: [0.6, 1.5], size: [[0, 7], [0.3, 22], [1, 30]], damp: 0.85, colors: [[0, C4(2.6, 2.1, 1.6, 1)], [0.4, C4(1.7, 1, 0.55, 0.85)], [0.8, C4(0.6, 0.3, 0.12, 0.4)], [1, C4(0.1, 0.05, 0.03, 0)]] });
const fireJet = new Pool('fireJet', 500, texFire, true, { sheet: SH_FIRE,  life: [0.4, 0.9], size: [[0, 2.5], [1, 6]], colors: [[0, C4(7, 5, 2.4, 1)], [0.5, C4(3.5, 1.4, 0.3, 0.8)], [1, C4(0.4, 0.1, 0.02, 0)]], gravity: -3 });
const smokeS = new Pool('smokeS', 1800, texCloud, false, { sheet: SH_CLOUD,  life: [4, 8], size: [[0, 3], [0.3, 10], [1, 18]], damp: 0.9, gravity: 1.5, colors: [[0, C4(0.3, 0.27, 0.24, 0)], [0.05, C4(0.32, 0.29, 0.26, 0.8)], [1, C4(0.55, 0.52, 0.48, 0)]] });
const smokeL = new Pool('smokeL', 1600, texCloud, false, { sheet: SH_CLOUD,  life: [10, 16], size: [[0, 9], [0.25, 32], [1, 62]], damp: 0.9, gravity: 1.2, colors: [[0, C4(0.36, 0.32, 0.27, 0)], [0.05, C4(0.34, 0.3, 0.26, 0.7)], [0.5, C4(0.5, 0.47, 0.42, 0.4)], [1, C4(0.62, 0.6, 0.56, 0)]] });
const dust = new Pool('dust', 2200, texSmoke, false, { life: [2, 4.5], size: [[0, 2.5], [1, 14]], damp: 0.86, gravity: 0.5, colors: [[0, C4(0.72, 0.6, 0.44, 0)], [0.06, C4(0.7, 0.58, 0.43, 0.7)], [1, C4(0.78, 0.68, 0.55, 0)]] });
const trackDust = new Pool('trackDust', 900, texSmoke, false, { life: [1.5, 3], size: [[0, 1.5], [1, 6]], damp: 0.9, gravity: 0.2, colors: [[0, C4(0.72, 0.62, 0.47, 0)], [0.1, C4(0.72, 0.62, 0.47, 0.32)], [1, C4(0.78, 0.7, 0.58, 0)]] });
const sparks = new Pool('sparks', 1000, texSoft, true, { life: [0.4, 1.2], size: [[0, 1], [1, 0.35]], gravity: -9.8, stretched: true, colors: [[0, C4(5, 4, 2.4, 1)], [0.6, C4(3, 1.2, 0.3, 0.9)], [1, C4(1, 0.2, 0, 0)]] });
const muzzle = new Pool('muzzle', 600, texFlare, true, { life: [0.04, 0.09], size: [[0, 2.5], [1, 4]], colors: [[0, C4(7, 5.5, 3, 1)], [1, C4(3, 1.4, 0.3, 0)]] });
// TH6.4: أجزاء حاضن القذيفة الخارقة (3 قطع تنفصل قرب الفوهة) + خط مضيء أقوى لقذيفة الدبابة
const petals = new Pool('petals', 240, texSoft, false, { life: [0.9, 1.4], size: [[0, 0.55], [1, 0.45]], gravity: -9.8, spin: 6, colors: [[0, C4(0.12, 0.11, 0.1, 1)], [0.85, C4(0.15, 0.14, 0.12, 1)], [1, C4(0.15, 0.14, 0.12, 0)]] });
// ===== TH6.3: الطلقات حسب السلاح — ومضات بحجم كل سلاح، متتبعات خضر (ذخيرة روسية/العدو) وحمر (العراق)، وأثر حسب السطح =====
const rifleFlash = new Pool('rifleFlash', 500, texFlare, true, { life: [0.025, 0.05], size: [[0, 0.45], [1, 0.75]], colors: [[0, C4(8, 6.5, 3.5, 1)], [1, C4(4, 2, 0.5, 0)]] });
const mgFlash = new Pool('mgFlash', 400, texFlare, true, { life: [0.03, 0.06], size: [[0, 0.8], [1, 1.2]], colors: [[0, C4(8, 6, 3, 1)], [1, C4(4, 1.8, 0.4, 0)]] });
const hmgFlash = new Pool('hmgFlash', 300, texFlare, true, { life: [0.04, 0.07], size: [[0, 1.6], [1, 2.4]], colors: [[0, C4(8, 6, 3, 1)], [1, C4(4, 1.6, 0.3, 0)]] });
const canFlash = new Pool('canFlash', 200, texFlare, true, { life: [0.05, 0.09], size: [[0, 2.6], [1, 3.6]], colors: [[0, C4(8, 6, 3, 1)], [1, C4(4, 1.5, 0.3, 0)]] });
const tracerG = new Pool('tracerG', 600, texSoft, true, { life: [0.4, 0.4], size: [[0, 0.32], [1, 0.32]], stretched: true, colors: [[0, C4(1.6, 7, 2, 1)], [1, C4(1.2, 5, 1.4, 1)]] });
const tracerR = new Pool('tracerR', 600, texSoft, true, { life: [0.4, 0.4], size: [[0, 0.32], [1, 0.32]], stretched: true, colors: [[0, C4(8, 2.2, 1, 1)], [1, C4(6, 1.4, 0.6, 1)]] });
const chips = new Pool('chips', 500, texSoft, false, { life: [0.5, 1.1], size: [[0, 0.22], [1, 0.16]], gravity: -9.8, colors: [[0, C4(0.82, 0.78, 0.7, 1)], [0.8, C4(0.78, 0.74, 0.66, 1)], [1, C4(0.78, 0.74, 0.66, 0)]] });
const spurt = new Pool('spurt', 900, texSmoke, false, { life: [0.5, 1], size: [[0, 0.4], [1, 1.6]], damp: 0.8, gravity: -2, colors: [[0, C4(0.7, 0.6, 0.45, 0.85)], [1, C4(0.72, 0.64, 0.5, 0)]] });
const tracerFor = (unitId: number) => (W.units.find(x => x.id === unitId)?.side === 'en' ? tracerG : tracerR);
/** وين توصل الطلقة: تراب = نافورة غبار صغيرة، حايط = شظايا + غبرة، حديد = شرار، وأحياناً ترتد مضيئة */
function bulletHit(to: V3, surf: string, spread: number, tr: Pool | null) {
  const q: V3 = surf === 'ground' ? G(to[0] + (Math.random() - 0.5) * spread, to[2] + (Math.random() - 0.5) * spread, 0.15) : add(to, [(Math.random() - 0.5) * spread * 0.4, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * spread * 0.4]);
  if (surf === 'metal') { sparks.emit({ a: q, n: 3, spd: [10, 35], jit: 0.2 }); if (tr && Math.random() < 0.3) tr.emit({ a: q, n: 1, dir: norm([Math.random() - 0.5, 0.6 + Math.random() * 0.5, Math.random() - 0.5]), spd: [300, 400], life: 0.25, jit: 0 }); }
  else if (surf === 'wall') { chips.emit({ a: q, n: 3, dir: [0, 0.6, 0], spd: [2, 6], spread: 2, jit: 0.2 }); spurt.emit({ a: q, n: 1, spd: [0.3, 1], jit: 0.2 }); }
  else { spurt.emit({ a: q, n: 2, dir: [0, 1, 0], spd: [2, 5], spread: 0.6, jit: 0.15 }); if (tr && Math.random() < 0.15) tr.emit({ a: q, n: 1, dir: norm([Math.random() - 0.5, 0.4 + Math.random() * 0.4, Math.random() - 0.5]), spd: [200, 300], life: 0.3, jit: 0 }); }
}
const motorFlame = new Pool('motorFlame', 400, texFlare, true, { life: [0.04, 0.1], size: [[0, 0.7], [1, 0.25]], colors: [[0, C4(6, 4.5, 2.2, 1)], [1, C4(3, 1, 0.2, 0)]] });   // لهب محرك صاروخ صغير (آر بي جي/كورنيت)
const apTracer = new Pool('apTracer', 200, texSoft, true, { life: [0.3, 0.3], size: [[0, 1.5], [1, 1.2]], stretched: true, colors: [[0, C4(9, 7, 3.5, 1)], [1, C4(7, 4.5, 1.6, 1)]] });
const tracers = new Pool('tracers', 900, texSoft, true, { life: [0.4, 0.4], size: [[0, 0.8], [1, 0.8]], stretched: true, colors: [[0, C4(7, 4, 1.4, 1)], [1, C4(6, 3, 0.8, 1)]] });
const casings = new Pool('casings', 600, texSoft, false, { life: [0.5, 0.8], size: [[0, 0.22], [1, 0.22]], gravity: -9.8, stretched: true, colors: [[0, C4(0.95, 0.75, 0.3, 1)], [1, C4(0.8, 0.6, 0.25, 1)]] });
const exhaust = new Pool('exhaust', 400, texSmoke, false, { life: [1.2, 2.4], size: [[0, 0.8], [1, 4.5]], damp: 0.9, gravity: 0.8, colors: [[0, C4(0.2, 0.19, 0.18, 0)], [0.1, C4(0.22, 0.21, 0.2, 0.45)], [1, C4(0.4, 0.38, 0.36, 0)]] });
const puffs = new Pool('puffs', 900, texSmoke, false, { life: [0.4, 1], size: [[0, 0.6], [1, 2.5]], colors: [[0, C4(0.8, 0.78, 0.74, 0.5)], [1, C4(0.8, 0.78, 0.74, 0)]] });
const flame = new Pool('flame', 1600, texFlare, true, { life: [0.05, 0.12], size: [[0, 2.2], [1, 0.6]], colors: [[0, C4(7, 5.5, 3.2, 1)], [0.5, C4(4, 1.8, 0.4, 0.8)], [1, C4(0.8, 0.2, 0.02, 0)]] });
const rocketTrail = new Pool('rocketTrail', 3500, texSmoke, false, { life: [2.5, 4.5], size: [[0, 0.9], [1, 6]], colors: [[0, C4(0.85, 0.82, 0.78, 0)], [0.05, C4(0.8, 0.78, 0.75, 0.55)], [1, C4(0.8, 0.78, 0.75, 0)]], gravity: 0.5 });
const bigTrail = new Pool('bigTrail', 6000, texSmoke, false, { life: [12, 18], size: [[0, 2.2], [0.2, 6.5], [1, 15]], colors: [[0, C4(1, 0.92, 0.8, 0)], [0.02, C4(0.97, 0.96, 0.94, 0.8)], [1, C4(0.85, 0.86, 0.88, 0)]], gravity: 0.4 });
const thinTrail = new Pool('thinTrail', 2500, texSmoke, false, { life: [5, 8], size: [[0, 2], [1, 7]], colors: [[0, C4(0.8, 0.8, 0.8, 0)], [0.04, C4(0.85, 0.85, 0.85, 0.45)], [1, C4(0.9, 0.9, 0.9, 0)]] });
const burnSmoke = new Pool('burnSmoke', 3200, texCloud, false, { sheet: SH_CLOUD,  life: [10, 18], size: [[0, 4], [0.3, 18], [1, 46]], colors: [[0, C4(0.12, 0.1, 0.09, 0)], [0.05, C4(0.1, 0.09, 0.08, 0.85)], [1, C4(0.4, 0.39, 0.38, 0)]] });
const burnFire = new Pool('burnFire', 600, texFlame, true, { sheet: { cw: 64, ch: 128, n: 64, rand: true, sy: 2 },  life: [0.3, 0.7], size: [[0, 2], [1, 4.5]], colors: [[0, C4(5, 3, 1.2, 0.9)], [1, C4(1.2, 0.3, 0.05, 0)]] });
const EXC: [number, Color4][] = [[0, C4(1.5, 1.4, 1.3, 1)], [0.75, C4(1, 1, 1, 0.95)], [1, C4(1, 1, 1, 0)]], SH_EX = { cw: 200, ch: 200, n: 25, speed: 1 };
const exS = new Pool('exS', 80, texExplo2, false, { sheet: SH_EX, life: [1.3, 1.7], size: [[0, 9], [1, 15]], colors: EXC, gravity: 1, spin: 0.15 });
const exM = new Pool('exM', 60, texExplo1, false, { sheet: SH_EX, life: [1.8, 2.3], size: [[0, 20], [1, 32]], colors: EXC, gravity: 1.5, spin: 0.1 });
const exL = new Pool('exL', 40, texExplo1, false, { sheet: SH_EX, life: [2.4, 3], size: [[0, 38], [1, 60]], colors: EXC, gravity: 2, spin: 0.08 });
const screen = new Pool('screen', 3200, texCloud, false, { sheet: SH_CLOUD, life: [16, 24], size: [[0, 16], [0.3, 38], [1, 56]], gravity: 0.2, spin: 0.08, colors: [[0, C4(0.86, 0.86, 0.84, 0)], [0.1, C4(0.84, 0.84, 0.82, 0.36)], [0.8, C4(0.82, 0.82, 0.8, 0.24)], [1, C4(0.82, 0.82, 0.8, 0)]] });
const screens: { p: V3; r: number; until: number }[] = [];
const cloud = new Pool('cloud', 1400, texCloud, false, { sheet: SH_CLOUD,  life: [5, 10], size: [[0, 6], [0.3, 18], [1, 30]], damp: 0.86, gravity: 0.6, colors: [[0, C4(1.15, 1.12, 1.06, 0)], [0.04, C4(1.12, 1.1, 1.05, 0.8)], [1, C4(1, 0.98, 0.92, 0)]] });

// ===== أضواء الانفجارات: تضوي الأرض والبنايات والمجسمات =====
const lights: { l: PointLight; t: number; dur: number; i0: number }[] = [];
for (let i = 0; i < NL; i++) { const l = new PointLight('xl' + i, Vector3.Zero(), scene); l.intensity = 0; l.range = 200; lights.push({ l, t: 0, dur: 0, i0: 0 }); }
function flashLight(p: V3, i0: number, range: number, dur: number, col = new Color3(1, 0.62, 0.3)) {
  if (!HQ && i0 < 3) return;
  const s = lights.reduce((a, b) => (a.l.intensity / (a.i0 || 1) <= b.l.intensity / (b.i0 || 1) ? a : b));
  s.l.position.set(p[0], p[1] + 4, p[2]); s.l.range = range; s.l.diffuse = col; s.i0 = i0; s.t = 0; s.dur = dur; s.l.intensity = i0;
}
function tickLights(dt: number) { for (const s of lights) { if (s.l.intensity <= 0) continue; s.t += dt; const k = 1 - s.t / s.dur; s.l.intensity = k > 0 ? s.i0 * k * k * (0.85 + Math.random() * 0.3) : 0; } }

// ===== آثار على الأرض =====
const decal = MeshBuilder.CreateGround('decal', { width: 1, height: 1 }, scene);
const decalMat = new StandardMaterial('decalMat', scene); decalMat.diffuseTexture = texScorch; decalMat.opacityTexture = texScorch; decalMat.disableLighting = true; decalMat.emissiveColor = new Color3(0.12, 0.1, 0.08); decalMat.specularColor = Color3.Black(); decalMat.zOffset = -2;
decal.material = decalMat; decal.isPickable = false; decal.alwaysSelectAsActiveMesh = true;
let decals: number[] = [];
function addDecal(p: V3, size: number) {
  if (decals.length / 16 > 160) decals.splice(0, 16);
  const n = groundN(p[0], p[2], Math.max(3, size * 0.3)), q = new Quaternion(); Quaternion.FromUnitVectorsToRef(Vector3.UpReadOnly, new Vector3(n[0], n[1], n[2]), q);
  decals.push(...Matrix.Compose(new Vector3(size, 1, size), q.multiply(Quaternion.RotationAxis(Vector3.UpReadOnly, Math.random() * 6.28)), new Vector3(p[0], groundH(p[0], p[2]) + 0.3, p[2])).asArray());
  decal.thinInstanceSetBuffer('matrix', new Float32Array(decals), 16, false);
}

// ===== الصوت (مولّد) =====
let simSpeed = 2, slowK = 1;
// أصوات حقيقية مسجّلة (SoundBible CC BY 3.0 + BigSoundBank CC0): تتأخر حسب المسافة (سرعة الصوت) وتنكتم من بعيد (I-024)
const sndUrls = import.meta.glob('../sounds/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const sfx = (() => {
  let ac: AudioContext | null = null, master: GainNode, muted = false, buzz: GainNode | null = null, nb: AudioBuffer;
  const smp: Record<string, AudioBuffer> = {};
  function play(name: string, d: number, g0: number, rate = 1, delay = 0) {
    if (!ac || !smp[name]) return false; const v0 = vol(d) * g0; if (v0 < 0.01) return true;
    const t = ac.currentTime + delay + Math.min(2.5, d / 343 / Math.max(1, simSpeed * slowK));
    const s = ac.createBufferSource(); s.buffer = smp[name]; s.playbackRate.value = rate * (slowK < 1 ? 0.7 : 1);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = clamp(16000 - d * 6, 900, 16000);
    const g = ac.createGain(); g.gain.value = v0; s.connect(f).connect(g).connect(master); s.start(t); return true;
  }
  const noise = (sec: number) => { const b = ac!.createBuffer(1, ac!.sampleRate * sec, ac!.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
  const vol = (d: number) => clamp(1.1 - d / 3200, 0, 1) ** 2;
  function hit(d: number, dur: number, f0: number, f1: number, g0: number, sub = 0, delay = 0) {
    if (!ac) return; const v0 = vol(d) * g0; if (v0 < 0.008) return;
    const t = ac.currentTime + delay + Math.min(2.5, d / 343 / Math.max(1, simSpeed * slowK));
    const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(v0, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 3); s.stop(t + dur);
    if (sub) { const o = ac.createOscillator(), og = ac.createGain(); o.frequency.setValueAtTime(sub, t); o.frequency.exponentialRampToValueAtTime(sub * 0.4, t + 0.6); og.gain.setValueAtTime(v0 * 0.8, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.connect(og).connect(master); o.start(t); o.stop(t + 0.8); }
  }
  return {
    init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try { ac = new AudioContext(); } catch { return; }
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(ac.destination); nb = noise(4);
      const a = ac; for (const [k, u] of Object.entries(sndUrls)) { const n = k.split('/').pop()!.replace('.mp3', ''); fetch(u).then(r => r.arrayBuffer()).then(b => a.decodeAudioData(b)).then(buf => { smp[n] = buf; }).catch(() => {}); }
      const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 3;
      buzz = ac.createGain(); buzz.gain.value = 0; s.connect(f).connect(buzz).connect(master); s.start();
    },
    toggle() { muted = !muted; if (ac) master.gain.setTargetAtTime(muted ? 0 : 0.85, ac.currentTime, 0.05); return muted; },
    boom(d: number, size: number) { const r = 0.9 + Math.random() * 0.2; if (!play(d > 1800 ? 'boom_far' : size >= 1.3 ? 'boom_big' : 'boom_mid', d, d > 1800 ? 1.6 : 0.6 + size * 0.35, size < 0.6 ? r * 1.15 : r)) hit(d, 1.1 + size * 0.8, 2400, 55, 0.45 + size * 0.3, 50); else if (size >= 1) hit(d, 0.9, 300, 40, 0.25 * size, 42); },
    gun(d: number) { if (!play('tank', d, 1, 0.92 + Math.random() * 0.14)) hit(d, 0.6, 3200, 140, 0.75, 65); },
    round(d: number) { if (!play('dshk', d, 0.42, 0.85 + Math.random() * 0.12)) hit(d, 0.07, 2600, 500, 0.32, 95); },
    launch(d: number) { if (!play('launch', d, 1)) hit(d, 3, 1500, 180, 0.8, 55); },
    whump(d: number) { if (!play('eject', d, 0.9, 0.8)) hit(d, 0.35, 600, 80, 0.7, 45); },
    rifle(d: number, n: number) { for (let i = 0; i < Math.min(3, n); i++) play('dshk', d, 0.16, 1.7 + Math.random() * 0.4, i * 0.09 + Math.random() * 0.05); },
    cannon(d: number) { play('dshk', d, 0.5, 0.62 + Math.random() * 0.06); },
    rocket(d: number) { if (!play('rocket', d, 0.5, 0.9 + Math.random() * 0.2)) hit(d, 1.2, 2200, 400, 0.35); },
    drones(d: number) { if (ac && buzz) buzz.gain.setTargetAtTime(simSpeed ? vol(d) * 0.12 : 0, ac.currentTime, 0.2); },
  };
})();

// ===== ربط المحاكاة بالرسم =====
let W: World;
interface UVis { root: TransformNode; inner: TransformNode; tur: TransformNode | null; tyaw: number; lastSpd: number; acc: number; recoil: number; shake: number; wreck: boolean; baseY: number; yaw: number }
const unitVis = new Map<number, UVis>();
interface AVis { n: TransformNode; body: TransformNode | null; glow: AbstractMesh | null; L: number; lastP: V3 }
const airVis = new Map<number, AVis>();
const burning: { p: V3; t: number; big: number }[] = [];
const vq: { t: number; f: () => void }[] = [];               // مؤثرات مؤجلة بزمن المحاكاة (ارتطام الرصاص…)
const debris: { m: TransformNode; p: V3; v: V3; spin: V3; until: number }[] = [];
let interMesh: Mesh, n48Mesh: Mesh, iskMesh: Mesh, dotMesh: Mesh, chunkMesh: Mesh, capMesh: Mesh, kornetMsl: Mesh, pg7Mesh: Mesh | null = null;
function makeProcedural() {
  const missile = (name: string, Lh: number, dia: number, col: Color3, fins = true) => {
    const parts: Mesh[] = [];
    const body = MeshBuilder.CreateCylinder(name + 'b', { height: Lh, diameter: dia, tessellation: 14 }, scene); body.rotation.x = Math.PI / 2; parts.push(body);
    const nose = MeshBuilder.CreateCylinder(name + 'n', { height: dia * 2.4, diameterTop: 0, diameterBottom: dia, tessellation: 14 }, scene); nose.rotation.x = Math.PI / 2; nose.position.z = Lh / 2 + dia * 1.2; parts.push(nose);
    if (fins) for (let i = 0; i < 4; i++) { const f = MeshBuilder.CreateBox(name + 'f', { width: 0.04, height: dia * 2.2, depth: dia * 1.8 }, scene); f.position.z = -Lh / 2 + dia; f.rotation.z = i * Math.PI / 2; f.position.x = Math.sin(i * Math.PI / 2) * dia; f.position.y = Math.cos(i * Math.PI / 2) * dia; parts.push(f); }
    const m = Mesh.MergeMeshes(parts, true, true)!; const mat = new StandardMaterial(name + 'm', scene); mat.diffuseColor = col; mat.specularColor = new Color3(0.3, 0.3, 0.3); mat.maxSimultaneousLights = 2 + NL; m.material = mat; m.isVisible = false; return m;
  };
  interMesh = missile('pac', 4.6, 0.41, new Color3(0.92, 0.92, 0.88));
  n48Mesh = missile('n48', 6.4, 0.52, new Color3(0.88, 0.89, 0.86));
  kornetMsl = missile('kor', 1.15, 0.152, new Color3(0.33, 0.36, 0.26));   // 9M133: طول ~1.2م، قطر 152ملم، لون زيتوني
  iskMesh = missile('isk', 6.2, 0.92, new Color3(0.32, 0.34, 0.3), false);
  dotMesh = MeshBuilder.CreatePlane('dot', { size: 1 }, scene); const dm = new StandardMaterial('dotMat', scene);
  dm.emissiveTexture = texFlare; dm.opacityTexture = texFlare; dm.emissiveColor = new Color3(5, 3.4, 1.6); dm.disableLighting = true; dm.alphaMode = Engine.ALPHA_ADD; dm.fogEnabled = false;
  dotMesh.material = dm; dotMesh.billboardMode = Mesh.BILLBOARDMODE_ALL; dotMesh.isVisible = false;
  chunkMesh = MeshBuilder.CreateBox('chunk', { width: 3.3, height: 0.9, depth: 3.6 }, scene); const cm = new StandardMaterial('chunkMat', scene); cm.diffuseColor = new Color3(0.08, 0.08, 0.07); chunkMesh.material = cm; chunkMesh.isVisible = false;
  capMesh = MeshBuilder.CreateBox('cap', { width: 0.9, height: 0.06, depth: 0.9 }, scene); const capm = new StandardMaterial('capMat', scene); capm.diffuseColor = new Color3(0.85, 0.84, 0.8); capMesh.material = capm; capMesh.isVisible = false;
}
// تكبير بصري (TH5.2): من بعيد المركبات والجنود يكبرون شوية حتى ينقرون (مثل ألعاب الاستراتيجية)، ومن قريب حجمهم الحقيقي
const visScale = (k: number) => 1 + k * smooth(40, 450, camDist) * (sideView ? 0.25 : 1);   // من الجنب التكبير يبين غريب جنب البيوت
let curVS = 1;
// فوهة المركبة المكبّرة بصرياً: نمد نقطة الطلقة من مركز الوحدة بنفس التكبير حتى اللهب يطلع من راس السبطانة
function muzzleAt(id: number, p: V3): V3 { const u = W.units.find(x => x.id === id); if (!u || curVS === 1) return p; const c = L(u.p); return add(c, scale(sub(p, c), curVS)); }
function syncUnits(dt: number) {
  const VS = curVS = visScale(0.8);
  for (const u of W.units) {
    if (u.kind === 'inf' || u.kind === 'kornet') continue;
    let vis = unitVis.get(u.id);
    if (!vis) {
      const m = spawnModel(u.kind); vis = { ...m, tyaw: u.tur, lastSpd: 0, acc: 0, recoil: 0, shake: 0, wreck: false, baseY: m.inner.position.y, yaw: u.yaw }; unitVis.set(u.id, vis);
      const blob = MeshBuilder.CreateGround('blob', { width: 1, height: 1 }, scene); blob.material = blobMat; blob.parent = vis.root; blob.position.y = 0.5; blob.isPickable = false;
      const s = u.kind === 'patriot' ? 24 : u.kind === 's400' ? 16 : u.kind === 'dshk' ? 3 : u.kind === 'd30' ? 7 : u.kind === 'bmp' ? 9 : 10; blob.scaling.set(s * 0.55, 1, s);
    }
    vis.root.position.set(u.p[0], groundH(u.p[0], u.p[2]), u.p[2]);
    if (u.kind !== 'patriot' && u.kind !== 's400') vis.root.scaling.setAll(VS);
    if (u.alive) { vis.yaw += angDiff(vis.yaw, u.yaw) * Math.min(1, dt * 8); vis.tyaw += angDiff(vis.tyaw, u.tur) * Math.min(1, dt * 10); }
    if (vis.tur) vis.tur.rotation.y = angDiff(vis.yaw, vis.tyaw);
    // الوحدة تميل ويا ميلان الأرض
    const gn = groundN(u.p[0], u.p[2], 3.5); Quaternion.FromUnitVectorsToRef(Vector3.UpReadOnly, new Vector3(gn[0], gn[1], gn[2]), qTilt);
    vis.root.rotationQuaternion = qTilt.multiply(Quaternion.RotationAxis(Vector3.UpReadOnly, vis.yaw));
    if (!u.alive) continue;
    // ارتداد عند الرمي، اهتزاز الرشاش، تمايل الحركة، وغبار الجنازير
    vis.recoil = Math.max(0, vis.recoil - dt * 3.5); vis.shake = Math.max(0, vis.shake - dt * 6);
    const sway = u.spd > 0.5 ? Math.sin(W.T * 9 + u.id) * 0.012 * Math.min(1, u.spd / 6) : 0;
    // تسارع/فرملة: المقدمة ترتفع لما تنطلق وتغطس لما توقف؛ والارتداد باتجاه السبطانة (مو باتجاه الجسم)
    if (dt > 0) { vis.acc = lerp(vis.acc, (u.spd - vis.lastSpd) / dt, Math.min(1, dt * 4)); vis.lastSpd = u.spd; }
    const rel = vis.tur ? vis.tur.rotation.y : 0, r2 = vis.recoil * vis.recoil, pitchA = clamp(-vis.acc * 0.018, -0.045, 0.045);
    vis.inner.rotation.x = -0.075 * r2 * Math.cos(rel) + sway + pitchA;
    vis.inner.rotation.z = 0.075 * r2 * Math.sin(rel);
    if (vis.tur) { vis.tur.position.x = PROTO[u.kind].piv.x - Math.sin(rel) * 0.35 * r2; vis.tur.position.z = PROTO[u.kind].piv.z - Math.cos(rel) * 0.35 * r2; }
    // دخان العادم لما تنطلق بقوة
    if (vis.acc > 0.6 && Math.random() < dt * 10) exhaust.emit({ a: L(add(u.p, [-Math.sin(u.yaw) * 4.5 * VS, 1.6 * VS, -Math.cos(u.yaw) * 4.5 * VS])), n: 2, spd: [0.5, 2], up: 0.5, jit: 0.4 });
    vis.inner.position.x = (Math.random() - 0.5) * 0.08 * vis.shake; vis.inner.position.y = vis.baseY + (Math.random() - 0.5) * 0.05 * vis.shake;
    if (u.spd > 1 && W) { const back = L(add(u.p, [-Math.sin(u.yaw) * 4, 0.8, -Math.cos(u.yaw) * 4])); trackDust.emit({ a: back, n: Qn(u.spd * 0.07 * slowK * simSpeed), spd: [0.5, 2], up: 0.3, jit: 1.8 }); }
  }
}
function airBody(a: Air): { body: TransformNode | null; glow: AbstractMesh | null; L: number } {
  if (a.kind === 'shahed' || a.kind === 'kh101') { const m = spawnModel(a.kind); return { body: m.root, glow: null, L: a.kind === 'kh101' ? 7.4 : 3.5 }; }
  const inst = (src: Mesh, name: string) => { const i = src.createInstance(name); i.isVisible = true; return i; };
  if (a.kind === 'pac2' || a.kind === 'n48' || a.kind === 'iskander') {
    const holder = new TransformNode('mb' + a.id, scene); const m = inst(a.kind === 'pac2' ? interMesh : a.kind === 'n48' ? n48Mesh : iskMesh, 'm' + a.id); m.parent = holder; caster(m);
    const g = inst(dotMesh, 'g' + a.id); g.billboardMode = Mesh.BILLBOARDMODE_ALL; g.parent = holder;
    const L = a.kind === 'pac2' ? 5.3 : a.kind === 'n48' ? 7.5 : 7.3; g.position.z = a.kind === 'iskander' ? L / 2 : -L / 2 - 0.6; g.scaling.setAll(a.kind === 'iskander' ? 3 : 1.7);
    if (a.kind === 'n48' && !a.ign) g.isVisible = false;
    return { body: holder, glow: g, L };
  }
  if ((a.kind === 'rpg' && pg7Mesh) || a.kind === 'atgm') {
    // TH6.4: مجسم الصاروخ نفسه (PG-7V حقيقي / كورنيت 9M133) + لهب المحرك بالذيل
    const holder = new TransformNode('mb' + a.id, scene), m = inst(a.kind === 'rpg' ? pg7Mesh! : kornetMsl, 'm' + a.id); m.parent = holder; caster(m);
    const L = a.kind === 'rpg' ? 0.93 : 1.2, g = inst(dotMesh, 'g' + a.id); g.billboardMode = Mesh.BILLBOARDMODE_ALL; g.parent = holder; g.position.z = -L / 2 - 0.15; g.scaling.setAll(a.kind === 'rpg' ? 0.5 : 0.4);
    if (a.kind === 'rpg') g.isVisible = false;   // المحرك يشتغل بعد ~11م
    return { body: holder, glow: g, L };
  }
  const g = inst(dotMesh, 'g' + a.id); g.billboardMode = Mesh.BILLBOARDMODE_ALL; g.scaling.setAll(a.kind === 'rocket' ? 2.4 : a.kind === 'smoke' ? 0.5 : 1.6); return { body: null, glow: g, L: 2 };
}
function syncAir() {
  const seen = new Set<number>(), cp = cam.position;
  for (const a of W.air) {
    seen.add(a.id); const lp = L(a.p);
    let vis = airVis.get(a.id);
    if (!vis) { const n = new TransformNode('air' + a.id, scene), b = airBody(a); if (b.body) b.body.parent = n; if (b.glow && !b.body) b.glow.parent = n; vis = { n, body: b.body, glow: b.glow, L: b.L, lastP: lp }; airVis.set(a.id, vis); }
    vis.n.position.set(lp[0], lp[1], lp[2]);
    if (len(a.v) > 1) vis.n.lookAt(vis.n.position.add(v(a.v)));
    // وضوح: الصاروخ ما يصغر أقل من ~1٪ من المسافة للكاميرا (يبين حتى من بعيد)
    const d = Vector3.Distance(cp, vis.n.position), sMin = Math.max(1, (d * 0.011) / vis.L); vis.n.scaling.setAll(sMin);
    if (vis.glow && a.kind === 'n48') vis.glow.isVisible = a.ign;
    const prev = vis.lastP, dd = len(sub(lp, prev)), dirV = norm(a.v), sp = len(a.v);
    const tail = add(lp, scale(dirV, -(vis.L / 2 + 0.6) * sMin));
    if ((a.kind === 'pac2' || (a.kind === 'n48' && a.ign)) && a.t < 10) {
      bigTrail.emit({ a: add(prev, scale(dirV, -(vis.L / 2) * sMin)), b: tail, n: Qn(dd * 0.55), jit: 0.6, spd: [0, 1.5] });
      flame.emit({ a: tail, n: Qn(6), dir: dirV, spd: [Math.max(0, sp - 220), Math.max(0, sp - 120)], spread: 0.15, jit: 0.3 * sMin });
    }
    if (a.kind === 'n48' && !a.ign) puffs.emit({ a: tail, n: 2, spd: [1, 3], jit: 0.5 });
    if (a.kind === 'iskander') thinTrail.emit({ a: prev, b: lp, n: Qn(dd * 0.06), jit: 1.5, spd: [0, 1] });
    if (a.kind === 'rocket' && a.t < 3) rocketTrail.emit({ a: prev, b: lp, n: Qn(dd * 0.14), jit: 0.3, spd: [0, 1] });
    if (a.kind === 'rpg') {
      // PG-7V: بشحنة الطرد بس نفخة رمادية؛ بعد ~11م المحرك: لهب ودخان أبيض كثيف، والقذيفة تلف حول نفسها
      if (vis.glow) vis.glow.isVisible = a.t > 0.1 && a.t < 0.75;
      if (vis.body) vis.body.getChildMeshes()[0]?.addRotation(0, 0, 0.6);
      if (a.t <= 0.1) puffs.emit({ a: lp, n: 1, spd: [0.2, 0.6], jit: 0.1 });
      else { rocketTrail.emit({ a: prev, b: tail, n: Qn(dd * 0.7), jit: 0.2, spd: [0, 0.6] }); if (a.t < 0.75) motorFlame.emit({ a: tail, n: 2, dir: scale(dirV, -1), spd: [6, 14], spread: 0.15, jit: 0.04 }); }
    }
    if (a.kind === 'atgm') { thinTrail.emit({ a: prev, b: tail, n: Qn(dd * 0.18), jit: 0.15, spd: [0, 0.4] }); if (a.t > 0.25) motorFlame.emit({ a: tail, n: 1, dir: scale(dirV, -1), spd: [3, 8], spread: 0.15, jit: 0.03 }); }
    vis.lastP = lp;
  }
  for (const [id, vis] of airVis) if (!seen.has(id)) { vis.n.dispose(); airVis.delete(id); }
}
const camD = (p: V3) => Vector3.Distance(cam.position, v(p));
function handleFx(fx: Fx) {
  switch (fx.k) {
    case 'gun': {
      const vis = unitVis.get(fx.unit); if (vis) vis.recoil = 1; fx.p = muzzleAt(fx.unit, fx.p);
      muzzle.emit({ a: fx.p, n: 4, jit: 0.6 }); fireS.emit({ a: fx.p, n: Qn(8), dir: fx.dir, spd: [20, 45], spread: 0.4, jit: 0.5 });
      // عصفة الفوهة: كرة نار قصيرة + حلقة دخان من فتحات كابح الارتداد؛ والخارق: الحاضن يتطاير 3 قطع
      exS.emit({ a: add(fx.p, scale(fx.dir, 2.5)), n: 1, spd: [0, 1], jit: 0.3 }); smokeS.emit({ a: fx.p, n: Qn(4), dir: [fx.dir[2], 0.2, -fx.dir[0]], spd: [4, 9], spread: 2, jit: 0.4 });
      if (fx.ap) for (let i = 0; i < 3; i++) { const a = i * 2.094 + Math.random(), side: V3 = [Math.cos(a) * fx.dir[2], Math.sin(a) * 0.8 + 0.3, -Math.cos(a) * fx.dir[0]]; petals.emit({ a: add(fx.p, scale(fx.dir, 6)), n: 1, dir: norm(add(scale(fx.dir, 3), side)), spd: [45, 70], spread: 0.2, jit: 0.2 }); }
      // حلقة غبار حول الدبابة من ضغط الطلقة
      const u = W.units.find(x => x.id === fx.unit); if (u) dust.emit({ a: add(L(u.p), [0, 0.6, 0]), n: Qn(26), spd: [8, 18], up: -0.45, jit: 3 });
      smokeS.emit({ a: add(fx.p, scale(fx.dir, 3)), n: Qn(5), spd: [3, 8], jit: 1.5 });
      flashLight(fx.p, 4, 60, 0.15); trauma = Math.min(1, trauma + clamp(0.25 - camD(fx.p) / 2000, 0, 0.25)); sfx.gun(camD(fx.p)); break;
    }
    case 'round': {
      const vis = unitVis.get(fx.unit); if (vis) vis.shake = 1; fx.p = muzzleAt(fx.unit, fx.p);
      // دوشكا 12.7 / رشاش محوري: ومضة كبيرة (الدوشكا) أو متوسطة، ظرف كبير، متتبع بلون الطرف، والإصابة حسب السطح
      const sk = W.units.find(x => x.id === fx.unit)?.kind, hmg = sk !== 'abrams' && sk !== 't72', TR = tracerFor(fx.unit);
      (hmg ? hmgFlash : mgFlash).emit({ a: fx.p, n: 1, jit: 0.1 });
      const side = norm([fx.dir[2], 0.8, -fx.dir[0]]); casings.emit({ a: add(fx.p, [0, -0.2, 0]), n: 1, dir: side, spd: [3, 5], spread: 0.6, jit: 0.1 });
      if (Math.random() < 0.3) puffs.emit({ a: add(fx.p, scale(fx.dir, 0.6)), n: 1, spd: [0.5, 1.5], jit: 0.2 });
      if (fx.tracer) TR.emit({ a: fx.p, n: 1, dir: fx.dir, spd: [850, 850], life: fx.tf, jit: 0.05 });
      const to = fx.to, kind = fx.hit;
      vq.push({ t: W.T + fx.tf, f: () => { if (kind !== 'air') bulletHit(to, kind, 2, fx.tracer ? TR : null); } });
      sfx.round(camD(fx.p)); break;
    }
    case 'shell': apTracer.emit({ a: fx.a, n: 1, dir: norm(sub(fx.b, fx.a)), spd: [1650, 1650], life: fx.tf, jit: 0 }); break;
    case 'boom': {
      const s = fx.size, big = s >= 1.3, P = big ? fireL : fireS;
      // الانفجار نفسه: فليب بوك مصوّر (كرة نار تتحول لدخان أسود)، وفوقه شرار وغبار وكرة نار سريعة
      const EX = s < 0.7 ? exS : s < 1.3 ? exM : exL, lift = fx.air ? 0 : (s < 0.7 ? 4 : s < 1.3 ? 9 : 16);
      EX.emit({ a: add(fx.p, [0, lift, 0]), n: big ? 2 : 1, spd: [0, 1.5], up: 1, jit: 3 * s });
      P.emit({ a: fx.p, n: Qn(big ? 22 * s : 8 * s + 3), spd: [10 * s, 38 * s], jit: 2 * s, up: fx.air ? 0 : 0.35 });
      (big ? smokeL : smokeS).emit({ a: fx.p, n: Qn(big ? 36 * s : 14 * s + 4), spd: [3 * s, 13 * s], jit: 3 * s, up: fx.air ? 0 : 0.5 });
      sparks.emit({ a: fx.p, n: Qn((fx.metal ? 45 : 26) * s), spd: [40, 140 * s], jit: 1 });
      if (!fx.air) { dust.emit({ a: fx.p, n: Qn(14 * s + 4), spd: [8, 26 * s], up: 0.1, jit: 3 }); addDecal(fx.p, 4 + 7 * s); }
      flashLight(fx.p, 3 + 5 * s, 50 + 90 * s, 0.3 + 0.3 * s);
      trauma = Math.min(1, trauma + clamp(0.55 - camD(fx.p) / 3500, 0, 0.55) * s); sfx.boom(camD(fx.p), s); break;
    }
    case 'plaunch': {
      // إطلاق ساخن: غطا الحاوية يطير، لهب من ورا الحاوية، غيمة ضخمة على الأرض
      fireJet.emit({ a: fx.rear, n: Qn(40), dir: norm([-fx.dir[0], -0.35, -fx.dir[2]]), spd: [25, 60], spread: 0.5, jit: 1 });
      cloud.emit({ a: G(fx.rear[0], fx.rear[2], 1.5), n: Qn(70), spd: [6, 26], up: -0.3, jit: 3 });
      cloud.emit({ a: fx.muzzle, n: Qn(16), dir: fx.dir, spd: [3, 10], spread: 1.2, jit: 1 });
      fireS.emit({ a: fx.muzzle, n: Qn(12), dir: fx.dir, spd: [8, 25], spread: 0.6, jit: 0.6 });
      throwDebris(capMesh, fx.muzzle, add(scale(fx.dir, 18), [(Math.random() - 0.5) * 6, 6, (Math.random() - 0.5) * 6]), 4);
      flashLight(fx.muzzle, 6, 120, 0.7); trauma = Math.min(1, trauma + clamp(0.6 - camD(fx.muzzle) / 1500, 0, 0.6)); sfx.launch(camD(fx.muzzle)); break;
    }
    case 'eject': {
      // إطلاق بارد: «طكّة» غاز بيضاء، والغطا يطير، بدون لهب
      cloud.emit({ a: fx.p, n: Qn(28), dir: fx.dir, spd: [4, 14], spread: 1.6, jit: 0.8 });
      puffs.emit({ a: fx.p, n: 10, spd: [3, 8], jit: 0.5 });
      throwDebris(capMesh, fx.p, add(scale(fx.dir, 14), [(Math.random() - 0.5) * 5, 3, (Math.random() - 0.5) * 5]), 4);
      sfx.whump(camD(fx.p)); break;
    }
    case 'ignite': {
      fireS.emit({ a: fx.p, n: Qn(20), spd: [6, 22], jit: 1 }); cloud.emit({ a: fx.p, n: Qn(24), spd: [4, 12], jit: 1.5 });
      flashLight(fx.p, 7, 160, 0.5); sfx.launch(camD(fx.p)); break;
    }
    case 'rlaunch': {
      const vis = unitVis.get(fx.unit); if (vis) vis.shake = 1.2;
      fireS.emit({ a: fx.p, n: Qn(5), dir: scale(fx.dir, -1), spd: [10, 25], spread: 0.5, jit: 0.4 }); dust.emit({ a: G(fx.p[0], fx.p[2], 0.8), n: Qn(10), spd: [5, 14], up: -0.3, jit: 3 });
      flashLight(fx.p, 5, 60, 0.15); sfx.rocket(camD(fx.p)); break;
    }
    case 'smokeLaunch': {
      // قاذفات الدخان (902B): 6 قنابل تطلع بقوس من البرج، كل وحدة تخلي خيط دخان وتنفجر غيمة قدّام المدرعة
      const vis = unitVis.get(fx.unit); if (vis) vis.shake = 0.6;
      for (let i = 0; i < 6; i++) { const side = (i - 2.5) * 5, to = add(fx.to, [side * Math.cos(0.3), 0, side * Math.sin(0.3)]), a0 = fx.p;
        for (let k = 1; k <= 8; k++) { const t = k / 8, q: V3 = [lerp(a0[0], to[0], t), lerp(a0[1], groundH(to[0], to[2]) + 1, t) + Math.sin(t * Math.PI) * 9, lerp(a0[2], to[2], t)];
          vq.push({ t: W.T + t * 0.7 + i * 0.05, f: () => puffs.emit({ a: q, n: 1, spd: [0.2, 0.6], jit: 0.2 }) }); }
        vq.push({ t: W.T + 0.75 + i * 0.05, f: () => cloud.emit({ a: G(to[0], to[2], 2), n: Qn(6), spd: [2, 7], up: 0.3, jit: 3 }) }); }
      muzzle.emit({ a: fx.p, n: 3, jit: 0.6 }); sfx.whump(camD(fx.p)); break;
    }
    case 'shot': {
      // طلقة/رشقة من جندي معيّن: ومضة من مكانه، متتبع أحياناً، وغبار وين توصل (TH6.1؛ الأشكال الحقيقية لكل سلاح بـ TH6.3)
      const u = W.units.find(x => x.id === fx.unit), VS = visScale(0.6); let p = fx.p;
      const sv = solVis.get(fx.sid); if (sv?.mz) p = sv.mz; else if (u) { const [x, z] = solAt(u, fx.p, VS); p = [x, fx.p[1], z]; }
      // كل طلقة من الرشقة: ومضة بوقتها (كلاشنكوف ~600/د، بي كي إم ~650/د)، ظرف فارغ يطير لليمين، والمتتبع كل رابعة (بي كي إم)
      const dir = norm(sub(fx.to, p)), d = len(sub(fx.to, p)), tf = d / 850, to = fx.to, FL = fx.mg ? mgFlash : rifleFlash, TR = tracerFor(fx.unit), rate = fx.mg ? 0.092 : 0.1;
      const right = norm([dir[2], 0.6, -dir[0]]), surf = fx.surf ?? 'ground', spread = 1.5 + d / 90;
      for (let i = 0; i < fx.n; i++) vq.push({ t: W.T + i * rate, f: () => { FL.emit({ a: p, n: 1, jit: 0.05 }); casings.emit({ a: p, n: 1, dir: right, spd: [2, 4], spread: 0.5, jit: 0.05 });
        if (fx.tracer && (fx.mg ? i % 4 === 0 : i === 0)) TR.emit({ a: p, n: 1, dir, spd: [850, 850], life: tf, jit: 0.15 }); } });
      for (let i = 0; i < Math.min(5, fx.n); i++) vq.push({ t: W.T + tf + i * rate, f: () => bulletHit(to, surf, spread, fx.tracer ? TR : null) });
      if (Math.random() < 0.5) vq.push({ t: W.T + fx.n * rate, f: () => puffs.emit({ a: p, n: 1, spd: [0.3, 0.8], jit: 0.1 }) });
      sfx.rifle(camD(p), fx.mg ? Math.min(3, fx.n) : 1); break;
    }
    case 'volley': {
      // رمي مشاة: ومضات صغيرة عند الرماة، متتبعات أحياناً، وغبار وين تضرب
      const dir = norm(sub(fx.to, fx.p)), d = len(sub(fx.to, fx.p)), tf = d / 800, to = fx.to, TR = tracerFor(fx.unit);
      for (let i = 0; i < Math.min(6, fx.n * 2); i++) vq.push({ t: W.T + i * 0.11, f: () => rifleFlash.emit({ a: add(fx.p, [(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 6]), n: 1, jit: 0.05 }) });
      if (fx.tracer) TR.emit({ a: fx.p, n: 1, dir, spd: [800, 800], life: tf, jit: 3 });
      for (let i = 0; i < 3; i++) vq.push({ t: W.T + tf + i * 0.1, f: () => bulletHit(to, 'ground', 6, null) });
      sfx.rifle(camD(fx.p), fx.n); break;
    }
    case 'cannon': {
      const vis = unitVis.get(fx.unit); if (vis) vis.shake = 0.8; fx.p = muzzleAt(fx.unit, fx.p);
      // 2A42 عيار 30: ومضة ضخمة + دخان من الفوهة، متتبع (HE-T) بلون الطرف، والقذيفة المتفجرة: ومضة صغيرة + غبار + شظايا
      canFlash.emit({ a: fx.p, n: 1, jit: 0.2 }); smokeS.emit({ a: add(fx.p, scale(fx.dir, 1.5)), n: 1, spd: [1, 3], jit: 0.4 }); casings.emit({ a: add(fx.p, [0, -0.5, 0]), n: 1, dir: norm([fx.dir[2], 0.5, -fx.dir[0]]), spd: [3, 5], spread: 0.5, jit: 0.1 });
      tracerFor(fx.unit).emit({ a: fx.p, n: 1, dir: fx.dir, spd: [960, 960], life: fx.tf, jit: 0.1 });
      const to = fx.to; vq.push({ t: W.T + fx.tf, f: () => { exS.emit({ a: add(to, [0, 1, 0]), n: 1, spd: [0, 1], jit: 0.5 }); fireS.emit({ a: to, n: 2, spd: [4, 10], jit: 1 }); spurt.emit({ a: G(to[0], to[2], 0.3), n: Qn(6), dir: [0, 1, 0], spd: [4, 9], spread: 1, jit: 1 }); sparks.emit({ a: to, n: 4, spd: [10, 35], jit: 0.5 }); } });
      sfx.cannon(camD(fx.p)); break;
    }
    case 'atgm': {
      // كورنيت: نفخة من الأنبوب ودخان؛ RPG: نار ودخان من ورا الرامي
      const back = scale(fx.dir, -1);
      if (fx.rpg) {
        // آر بي جي: عصفة خلفية (منطقة خطر ~20م ورا الرامي): لهب قصير + غبار ودخان يرتفع ورا، ونفخة من الفوهة
        fireJet.emit({ a: fx.p, n: Qn(10), dir: back, spd: [14, 28], spread: 0.35, jit: 0.2 });
        for (let k = 1; k <= 4; k++) { const q = add(fx.p, scale(back, k * 2.5)); dust.emit({ a: G(q[0], q[2], 0.6), n: Qn(5), spd: [2, 6], up: 0.4, jit: 1 + k * 0.4 }); }
        cloud.emit({ a: add(fx.p, scale(back, 3)), n: Qn(14), dir: back, spd: [3, 9], spread: 0.8, jit: 1 });
        puffs.emit({ a: add(fx.p, scale(fx.dir, 1)), n: 4, spd: [1, 3], jit: 0.3 }); muzzle.emit({ a: fx.p, n: 2, jit: 0.3 });
      } else {
        // كورنيت: شحنة طرد تدفع الصاروخ من الأنبوب (نفخة من القدام والورا)، والمحرك يشتغل بعدين
        cloud.emit({ a: fx.p, n: Qn(10), dir: fx.dir, spd: [2, 6], spread: 1, jit: 0.6 }); cloud.emit({ a: add(fx.p, scale(back, 1.2)), n: Qn(8), dir: back, spd: [3, 8], spread: 0.6, jit: 0.6 });
        dust.emit({ a: G(fx.p[0], fx.p[2], 0.5), n: Qn(8), spd: [3, 8], up: 0.2, jit: 2 }); fireS.emit({ a: add(fx.p, scale(back, 1)), n: 3, dir: back, spd: [6, 12], spread: 0.4, jit: 0.2 });
      }
      flashLight(fx.p, 2, 40, 0.15); fx.rpg ? sfx.rocket(camD(fx.p)) : sfx.launch(camD(fx.p) + 300); break;
    }
    case 'smoke': screens.push({ p: fx.p, r: fx.r, until: W.T + fx.dur }); cloud.emit({ a: G(fx.p[0], fx.p[2], 3), n: Qn(30), spd: [3, 12], up: 0.3, jit: fx.r * 0.4 }); break;
    case 'houseHit': {
      const h = HOUSES[fx.house], c = G(h.x, h.z, h.h * 0.5);
      dust.emit({ a: c, n: Qn(fx.destroyed ? 60 : 18), spd: [4, fx.destroyed ? 16 : 9], up: 0.3, jit: Math.max(h.w, h.d) * 0.45 });
      if (!fx.destroyed) { const own = W.houseOwner[fx.house], d = own === 'en' ? 1 : -1; houses.hole(fx.house, d, (Math.random() - 0.5) * 0.6); if (W.houseHp[fx.house] <= 1.2) houses.crack(fx.house); }   // الضرب جاي من الطرف الثاني
      if (fx.destroyed) { houses.damage(fx.house); smokeS.emit({ a: c, n: Qn(16), spd: [2, 6], up: 0.6, jit: h.w * 0.4 }); burning.push({ p: G(h.x, h.z, 1), t: W.T, big: 0.7 }); for (let k = 0; k < 4; k++) throwDebris(chunkMesh, add(c, [0, 2, 0]), [(Math.random() - 0.5) * 14, 6 + Math.random() * 8, (Math.random() - 0.5) * 14], 3); }
      break;
    }
    case 'dismount': dust.emit({ a: G(fx.p[0], fx.p[2], 0.6), n: Qn(10), spd: [2, 5], up: 0.3, jit: 4 }); break;
    case 'kill': killVisual(fx.unit, fx.turret); break;
    case 'hit': {
      // إصابة بدون تدمير: الدبابة ترتج، شرار، والقذيفة ترتد لفوق إذا ما خرقت (صوت معدن)
      const vis = unitVis.get(fx.unit); if (vis) vis.shake = 1.6;
      sparks.emit({ a: fx.p, n: Qn(fx.pen ? 30 : 55), spd: [15, 70], jit: 0.4 });
      if (!fx.pen) { const rd = norm([-fx.dir[0] * 0.5 + (Math.random() - 0.5) * 0.8, 0.7 + Math.random() * 0.5, -fx.dir[2] * 0.5 + (Math.random() - 0.5) * 0.8]); tracers.emit({ a: fx.p, n: 1, dir: rd, spd: [500, 500], life: 0.35, jit: 0 }); }
      else { smokeS.emit({ a: fx.p, n: Qn(6), spd: [1, 4], jit: 1 }); vq.push({ t: W.T + 0.4, f: () => fireS.emit({ a: fx.p, n: Qn(6), spd: [2, 6], up: 0.6, jit: 0.8 }) }); }
      flashLight(fx.p, 3, 40, 0.12); break;
    }
    case 'siteHit': siteDamage(fx.site, fx.p, fx.big); break;
    case 'mark': marks.push({ p: fx.p, text: fx.text, good: fx.good, t: performance.now() }); break;
    default: break;
  }
}
function throwDebris(src: Mesh, p: V3, vel: V3, life: number) {
  const m = src.clone('deb', null)!; m.isVisible = true; m.isPickable = false; m.position.set(...p);
  debris.push({ m, p: [...p] as V3, v: vel, spin: [Math.random() * 8, Math.random() * 8, Math.random() * 8], until: W.T + life });
}
function tickDebris(simDt: number) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.v = add(d.v, [0, -9.81 * simDt, 0]); d.p = add(d.p, scale(d.v, simDt));
    const gy = groundH(d.p[0], d.p[2]) + 0.3; if (d.p[1] < gy) { d.p[1] = gy; d.v = scale(d.v, 0); }
    d.m.position.set(...d.p); d.m.rotation.addInPlace(v(scale(d.spin, simDt)));
    if (W.T > d.until && d.v[1] === 0) { if (d.m.name === 'turret') { dust.emit({ a: d.p, n: Qn(16), spd: [4, 12], up: 0.2, jit: 2 }); } d.until = Infinity; }
  }
}
function killVisual(id: number, turret: boolean) {
  const u = W.units.find(x => x.id === id)!, up = L(u.p), vis = unitVis.get(id); if (!vis || vis.wreck) return;
  vis.wreck = true; vis.inner.dispose();
  // هيكل محترق (نسخة بخامات غامقة)
  const w = spawnModel(u.kind, true); w.inner.parent = vis.root; w.root.dispose(); vis.inner = w.inner; vis.inner.rotation.z = (Math.random() - 0.5) * 0.12;
  vis.tur = w.tur; if (w.tur) w.tur.rotation.y = angDiff(vis.yaw, vis.tyaw);
  burning.push({ p: [...up] as V3, t: W.T, big: u.kind === 'abrams' || u.kind === 't72' ? 1.3 : 1 });
  if (turret) {
    // انفجار الذخيرة: البرج يطير وعمود نار (jack-in-the-box) وانفجارات متتالية
    // البرج الحقيقي (المحروق) يطير من مكانه؛ إذا المجسم ما بيه برج منفصل نستعمل قطعة بديلة
    let ch: TransformNode;
    if (vis.tur) { const t = vis.tur, sc = MODEL[u.kind].scale; t.setParent(null); t.rotationQuaternion = null; t.rotation.set(0, vis.tyaw + MODEL[u.kind].yaw, 0); t.scaling.setAll(sc); t.name = 'turret'; vis.tur = null; ch = t; }
    else { const cm = chunkMesh.clone('turret', null)!; cm.isVisible = true; cm.material = (chunkMesh.material as StandardMaterial); caster(cm); ch = cm; }
    const p0 = add(up, [0, 2.6, 0]); ch.position.set(...p0);
    debris.push({ m: ch, p: p0, v: [(Math.random() - 0.5) * 9, 21 + Math.random() * 6, (Math.random() - 0.5) * 9], spin: [Math.random() * 5, Math.random() * 3, Math.random() * 5], until: W.T + 2 });
    for (let k = 0; k < 8; k++) vq.push({ t: W.T + k * 0.12, f: () => fireJet.emit({ a: add(up, [0, 2.4, 0]), n: Qn(10), dir: [0, 1, 0], spd: [18, 38], spread: 0.35, jit: 0.8 }) });
    for (let k = 0; k < 4; k++) vq.push({ t: W.T + 1.5 + Math.random() * 5, f: () => { fireS.emit({ a: add(up, [0, 1.6, 0]), n: Qn(12), spd: [6, 18], up: 0.5, jit: 1 }); sparks.emit({ a: add(up, [0, 1.6, 0]), n: Qn(10), spd: [20, 60], jit: 1 }); flashLight(up, 6, 50, 0.25); sfx.boom(camD(up), 0.4); } });
  }
  addDecal(up, 14);
}
// ===== دمار المواقع + بطاقة الثمن =====
function siteDamage(sid: string, p: V3, big: boolean) {
  const R0 = big ? 70 : 45;
  for (const h of HOUSES) if (Math.hypot(h.x - p[0], h.z - p[2]) < R0 + Math.max(h.w, h.d) / 2 && houses.damage(h.i)) burning.push({ p: G(h.x, h.z, 1), t: W.T, big: 0.8 });
  for (const sp of siteProps) {
    if (sp.hit || sp.site !== sid || Math.hypot(sp.mesh.getAbsolutePosition().x - p[0], sp.mesh.getAbsolutePosition().z - p[2]) > R0 + 60) continue;
    sp.hit = true; sp.mat.diffuseColor = sp.mat.diffuseColor.scale(0.25); sp.mesh.scaling.y *= 0.55; sp.mesh.position.y *= 0.55;
  }
  burning.push({ p: [...p] as V3, t: W.T, big: sid === 'dora' ? 2.6 : big ? 1.8 : 1.4 });
  const s = site(sid); showCost(`✗ ${s.name} انضرب`, s.cost);
}
let costTimer = 0;
function showCost(t: string, s: string) { $('costT').textContent = t; $('costS').textContent = s; $('cost').classList.remove('off'); clearTimeout(costTimer); costTimer = window.setTimeout(() => $('cost').classList.add('off'), 5500); }
function burnFx(simDt: number) {
  for (let i = screens.length - 1; i >= 0; i--) { const sc = screens[i]; if (W.T > sc.until) { screens.splice(i, 1); continue; } const left = sc.until - W.T;
    if (left > 12) screen.emit({ a: G(sc.p[0], sc.p[2], 7), n: Qn(simDt * 4 * sc.r / 30), spd: [0.4, 1.6], up: 0.2, jit: sc.r * 1.6 }); }
  for (const b of burning) { const age = W.T - b.t, k = clamp(1 - age / 200, 0.3, 1) * b.big;
    burnSmoke.emit({ a: add(b.p, [0, 2, 0]), n: Qn(12 * simDt * k * 3), spd: [3, 7], dir: norm([0.14, 1, 0.08]), spread: 0.2, jit: 2 * b.big });
    burnFire.emit({ a: add(b.p, [0, 1.5, 0]), n: Qn(10 * simDt * k * 2), spd: [1, 4], up: 1, jit: 1.5 * b.big }); }
}

// ===== البطاقات (أسماء) =====
const layer = $('labels');
interface Item { key: string; text: string; cls: string; p: V3; prio: number; follow?: number }
const els = new Map<string, HTMLElement>();
let marks: { p: V3; text: string; good: boolean; t: number }[] = [];
let selected = 0;
function labelItems(): Item[] {
  const out: Item[] = [], near = camDist < 650;
  for (const s of SITES) out.push({ key: 's' + s.id, text: s.name, cls: 'site', p: add(s.p, [0, 30, 0]), prio: 1 });
  if (near) for (const u of W.units) if (u.state !== 'mounted' && !(u.kind === 'inf' && !u.alive)) out.push({ key: 'u' + u.id, text: u.alive ? `${u.name} · ${SIDE_AR[u.side]}${u.kind === 'inf' || u.kind === 'kornet' ? ` (${u.men})` : ''}${u.house >= 0 ? ' 🏠' : ''}` : `${u.name} (محطّم)`, cls: `${u.side}${u.alive ? '' : ' dead'}`, p: add(u.p, [0, u.kind === 'patriot' || u.kind === 's400' ? 17 : 9, 0]), prio: u.alive ? 3 : 0, follow: u.id });
  else {
    const groups = new Map<string, Unit[]>(); for (const u of W.units) if (u.alive) { const k = u.side + '|' + u.group; groups.set(k, [...(groups.get(k) ?? []), u]); }
    for (const [k, us] of groups) { const c = us.reduce((s, u) => add(s, u.p), [0, 0, 0] as V3); out.push({ key: 'g' + k, text: `${k.split('|')[1]}${us.length > 1 ? ' ×' + us.length : ''}`, cls: `${us[0].side} group`, p: add(scale(c, 1 / us.length), [0, 20, 0]), prio: 3, follow: us[0].id }); }
  }
  for (const a of W.air) {
    if (a.kind === 'shahed' || a.kind === 'kh101' || a.kind === 'iskander') out.push({ key: 'a' + a.id, text: `${AIR_AR[a.kind]} · ${SIDE_AR[a.side]} ← ${a.siteName}`, cls: `${a.side} air`, p: add(a.p, [0, 14, 0]), prio: 5, follow: a.id });
    else if (a.kind === 'pac2' || a.kind === 'n48') out.push({ key: 'a' + a.id, text: a.kind === 'pac2' ? 'معترض PAC-2 · باتريوت' : 'معترض 48N6 · S-400', cls: 'iq air', p: add(a.p, [0, 12, 0]), prio: 4, follow: a.id });
  }
  const rk = W.air.filter(a => a.kind === 'rocket'); if (rk.length) out.push({ key: 'rk', text: `رشقة غراد ×${rk.length}`, cls: 'en air', p: scale(rk.reduce((s, a) => add(s, a.p), [0, 0, 0] as V3), 1 / rk.length), prio: 4 });
  const now = performance.now(); marks = marks.filter(m => now - m.t < 4200);
  for (const m of marks) out.push({ key: 'm' + m.t + m.text, text: m.text, cls: `mark ${m.good ? 'good' : 'bad'}`, p: add(m.p, [0, (now - m.t) / 1000 * 15, 0]), prio: 9 });
  return out;
}
const tmpV = new Vector3();
function project(p: V3) {
  Vector3.ProjectToRef(v(L(p)), Matrix.IdentityReadOnly, scene.getTransformMatrix(), cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()), tmpV);
  const sc = engine.getHardwareScalingLevel(); return { x: tmpV.x * sc, y: tmpV.y * sc, z: tmpV.z };
}
function drawLabels() {
  const items = labelItems().sort((a, b) => b.prio - a.prio), W_ = canvas.clientWidth, H_ = canvas.clientHeight, placed: number[][] = [], used = new Set<string>();
  for (const it of items) {
    const { x, y, z } = project(it.p);
    if (z < 0 || z > 1 || x < -60 || x > W_ + 60 || y < 40 || y > H_ - 20) continue;
    const w = it.text.length * 6.2 + 22, h = 20, r = [x - w / 2, y - h, x + w / 2, y];
    if (it.prio < 9 && placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) continue;
    placed.push(r); used.add(it.key);
    let el = els.get(it.key);
    if (!el) { el = document.createElement('div'); el.innerHTML = '<i></i><span></span>'; layer.appendChild(el); els.set(it.key, el);
      if (it.follow) { const id = it.follow; el.addEventListener('click', () => { setAuto(false); startFollow(id); }); } }
    const cls = 'lb ' + it.cls + (it.follow && it.follow === selected ? ' sel' : ''); if (el.className !== cls) el.className = cls;
    const sp = el.lastChild as HTMLElement; if (sp.textContent !== it.text) sp.textContent = it.text;
    el.style.transform = `translate(${(x - w / 2).toFixed(0)}px,${(y - h).toFixed(0)}px)`; el.style.display = '';
  }
  for (const [k, el] of els) if (!used.has(k)) { if (k.startsWith('m') || k === 'rk' || k.startsWith('a') || k.startsWith('g')) { el.remove(); els.delete(k); } else el.style.display = 'none'; }
}
// أسهم الحافة: تهديدات برّا الشاشة
const arrowLayer = $('arrows'), arrowEls = new Map<number, HTMLElement>();
function drawArrows() {
  const W_ = canvas.clientWidth, H_ = canvas.clientHeight, cx = W_ / 2, cy = H_ / 2, used = new Set<number>();
  const threats = W.air.filter(a => a.kind === 'shahed' || a.kind === 'kh101' || a.kind === 'iskander')
    .map(a => ({ a, d: Vector3.Distance(camTarget, v(a.p)) })).sort((x, y) => x.d - y.d).slice(0, 3);
  const botH = ($('bottom') as HTMLElement).hidden ? 90 : ($('bottom') as HTMLElement).offsetHeight + 10;
  if (!view.follow) for (const { a, d } of threats) {
    const pr = project(a.p); let { x, y } = pr; const behind = pr.z > 1 || pr.z < 0;
    if (!behind && x > 0 && x < W_ && y > 50 && y < H_ - botH) continue;
    if (behind) { x = W_ - x; y = H_ - y; }
    const ang = Math.atan2(y - cy, x - cx), mx = W_ / 2 - 70, my = H_ / 2 - Math.max(60, botH * 0.6), k = Math.min(Math.abs(mx / Math.cos(ang)), Math.abs(my / Math.sin(ang)));
    const ex = cx + Math.cos(ang) * k, ey = cy + Math.sin(ang) * k;
    let el = arrowEls.get(a.id);
    if (!el) { el = document.createElement('div'); el.className = 'ar'; el.innerHTML = '<b>➤</b><span></span>'; const id = a.id; el.addEventListener('click', () => { setAuto(false); startFollow(id); }); arrowLayer.appendChild(el); arrowEls.set(a.id, el); }
    (el.firstChild as HTMLElement).style.transform = `rotate(${ang}rad)`;
    (el.lastChild as HTMLElement).textContent = `${AIR_AR[a.kind]} · ${(d / 1000).toFixed(1)} كم`;
    el.style.transform = `translate(${(ex - 55).toFixed(0)}px,${(ey - 11).toFixed(0)}px)`; used.add(a.id);
  }
  for (const [id, el] of arrowEls) if (!used.has(id)) { el.remove(); arrowEls.delete(id); }
}

// ===== التتبّع =====
function findEntity(id: number): { p: V3; vel?: V3; air: boolean; name: string; info: string } | null {
  const u = W.units.find(x => x.id === id);
  if (u && (u.kind === 'inf' || u.kind === 'kornet')) return { p: L(add(u.p, [0, 1.5, 0])), air: false, name: `${u.name} · ${SIDE_AR[u.side]}`, info: u.alive ? `${u.group} · ${u.men} جنود · ${({ house: 'يقاتلون من بيت', rush: 'يركضون للساتر الجاي', pin: 'منبطحين تحت النار', fire: 'يرمون', retreat: 'ينسحبون', mounted: 'راكبين بالناقلة', hold: 'بمواقعهم', counter: 'هجوم معاكس' } as Record<string, string>)[u.state] ?? 'بمواقعهم'}${u.supp > 0.6 ? ' · تحت ضغط' : ''}` : 'انقضى عليهم' };
  if (u) return { p: L(add(u.p, [0, 2, 0])), air: false, name: `${u.name} · ${SIDE_AR[u.side]}`, info: u.alive ? `${u.group} · ${u.spd > 1 ? `يتحرك ${Math.round(u.spd * 3.6)} كم/س` : 'بموقعه'}${u.cover ? ' · ورا ساتر' : ''}` : 'محطّمة' };
  const a = W.air.find(x => x.id === id);
  if (a) return { p: L(a.p), vel: a.v, air: true, name: `${AIR_AR[a.kind]} · ${SIDE_AR[a.side]}`, info: `${Math.round(len(a.v) * 3.6).toLocaleString('en')} كم/س · ارتفاع ${Math.round(a.p[1]).toLocaleString('en')} م${a.siteName ? ' · الهدف: ' + a.siteName : ''}${a.kind === 'n48' && !a.ign ? ' · مقذوف بالغاز' : ''}` };
  return null;
}
function startFollow(id: number, dist?: number) {
  const f = findEntity(id); if (!f) return;
  view.follow = id; selected = id; view.fDist = dist ?? (f.air ? 34 : 110 * PF()); followBlend = 0; followFrom = camTarget.clone();
  const a = W.air.find(x => x.id === id); if (a) view.yaw = Math.atan2(a.v[0], a.v[2]);
  ($('follow') as HTMLElement).hidden = false; ($('bottom') as HTMLElement).hidden = true;
}
function endFollow() { if (view.follow) { view.follow = 0; selected = 0; } ($('follow') as HTMLElement).hidden = true; ($('bottom') as HTMLElement).hidden = !running; targetY = 0; }
function followPanel() {
  if (!view.follow) return; const f = findEntity(view.follow);
  if (!f) { $('fInfo').textContent = 'انتهى (انفجر أو اعتُرض)'; return; }
  $('fName').textContent = f.name; $('fInfo').textContent = f.info;
}

// ===== المخرج التلقائي: لقطة تجمع الطرفين، متابعة الإطلاق، لقطة إصابة بحركة بطيئة =====
let auto = true, shotUntil = 0, shotPrio = 0, impactReady = 0;
const slowWins: { t0: number; t1: number }[] = [];
function setAuto(on: boolean) { auto = on; $('bAuto').setAttribute('aria-pressed', String(on)); if (on) { shotUntil = 0; shotPrio = 0; } }
const nowS = () => (W ? W.T : 0); // توقيت المخرج بثواني المعركة (يبقى صحيح حتى لو التلفون بطيء)
function claim(prio: number, holdReal: number) { const n = nowS(); if (!auto || (n < shotUntil && prio <= shotPrio)) return false; shotUntil = n + holdReal; shotPrio = prio; return true; }
let beat = 0;
// لقطات المنظر العام تتناوب: الرتل من قريب، المدافعين ورا السواتر، لقطة تجمع الطرفين، والسيطرة إذا المسيّرات قريبة
function overview(force = false) {
  const col = W.units.filter(u => u.side === 'en' && u.alive && u.group === 'رتل مدرّع معادي');
  const lead = col.length ? col.reduce((a, b) => (a.p[0] > b.p[0] ? a : b)) : null, line: V3 = [-2050, 0, -350];
  const gap = lead ? dist2d(lead.p, line) : 9999, drone = W.air.find(a => a.kind === 'shahed' && dist2d(a.p, [-1830, 0, -350]) < 900);
  const b = beat++ % 4;
  if (force || !lead) return twoShot(lead ? lead.p : [-3600, 0, -400], line, 0, 0, true);
  if (drone && b % 2 === 1) return looseShot([-1830, 4, -350], 260, CLOSE_PITCH, Math.atan2(drone.p[0] + 1830, drone.p[2] + 350) + Math.PI);
  if (b === 0 || b === 2 && gap > 700) return looseShot(add(lead.p, [0, 3, 0]), 230, CLOSE_PITCH, lead.yaw + Math.PI * 0.8);
  if (b === 1) return looseShot([-1700, 3, -340], 260, CLOSE_PITCH, -Math.PI / 2 + 0.5);
  twoShot(lead.p, line, 0, 0, true);
}
const PF = () => (portrait() ? 1.35 : 1);   // بالطول العدسة أضيق أفقياً، فنبعّد شوية
function looseShot(p: V3, dist: number, pitch: number, yaw: number) { endFollow(); view.tx = p[0]; view.tz = p[2]; targetY = p[1]; view.dist = dist * 0.65 * PF(); view.pitch = pitch; view.yaw = yaw; }
function twoShot(a: V3, b: V3, prio: number, holdReal: number, force = false) {
  if (!force && !claim(prio, holdReal)) return;
  endFollow(); const m = scale(add(a, b), 0.5), s = Math.max(120, dist2d(a, b)), line = Math.atan2(b[0] - a[0], b[2] - a[2]);
  view.tx = m[0]; view.tz = m[2]; targetY = 0; view.pitch = -1;
  if (portrait()) { view.yaw = line; view.dist = Math.min(900, s * 1.1 + 220); } else { view.yaw = line + Math.PI / 2; view.dist = Math.min(800, s * 0.85 + 150); }
}
function closeShot(p: V3, from: V3 | null, dist: number, pitch: number, prio: number, holdReal: number) {
  if (!claim(prio, holdReal)) return false;
  endFollow(); view.tx = p[0]; view.tz = p[2]; targetY = p[1] - groundH(p[0], p[2]); view.dist = dist * 0.8 * PF(); view.pitch = pitch;
  if (from) view.yaw = Math.atan2(p[0] - from[0], p[2] - from[2]) + 0.55;
  return true;
}
function impactCam(p: V3, from: V3 | null, tImpact: number) {
  if (nowS() < impactReady) return;                                 // حد أقصى لقطة إصابة كل 15 ثانية
  if (!closeShot(p, from, from ? 170 : 360, CLOSE_PITCH, 8, 3.2)) return;
  impactReady = nowS() + 15; slowWins.push({ t0: tImpact - 0.35, t1: tImpact + 1.1 });
}
// D-018: المخرج يركّز على المعركة الأرضية؛ إطلاقات الدفاع الجوي البعيدة يتابعها اللاعب بالأسهم
const AIRCAM = false as boolean;
function directorFx(fx: Fx) {
  if (!auto) return;
  switch (fx.k) {
    case 'killshot': { const sh = W.units.find(u => u.id === fx.shooter), tg = W.units.find(u => u.id === fx.target); if (sh && tg) impactCam(L(add(tg.p, [0, 2, 0])), sh.p, W.T + fx.tf); break; }
    case 'threat': { const a = W.air.find(x => x.id === fx.air); if (a && a.kind !== 'iskander' && dist2d(a.aim, [-1800, 0, -340]) < 900) impactCam(L(add(a.aim, [0, 12, 0])), null, W.T + fx.tti); break; }
    case 'plaunch': if (AIRCAM && claim(6, 1.2)) { closeShot(fx.muzzle, add(fx.muzzle, scale(fx.dir, -50)), 190, 0.6, 6, 1.2); pendingFollow = { id: fx.air, at: nowS() + 0.9, dist: 40 }; } break;
    case 'eject': if (AIRCAM && claim(7, 3)) { endFollow(); view.tx = fx.p[0]; view.tz = fx.p[2]; targetY = 8; view.dist = 70; view.pitch = 0.2; view.yaw = Math.atan2(fx.dir[0], fx.dir[2]) + Math.PI / 2; pendingFollow = { id: fx.air, at: nowS() + 2.2, dist: 45 }; } break;
    case 'intercept': if (view.follow && fx.big) slowWins.push({ t0: W.T - 0.05, t1: W.T + 0.9 }); break;
    case 'rlaunch': { const g = W.units.find(u => u.id === fx.unit); if (g && W.T - lastSalvoShot > 30) { lastSalvoShot = W.T; twoShot(g.p, [-2000, 0, HIGHWAY_Z], 5, 6); } break; }
    case 'phase': { const vc: V3 = [-1600, 0, HIGHWAY_Z]; if (fx.phase === 'counter') { closeShot(G(fx.p[0], fx.p[2], 3), [-760, 0, 380], 520, CLOSE_PITCH, 7, 8); } else twoShot(fx.p, vc, 5, 7); break; }
    case 'dismount': if (claim(4, 6)) { endFollow(); view.tx = fx.p[0]; view.tz = fx.p[2]; targetY = 2; view.dist = 230; view.pitch = CLOSE_PITCH; view.yaw = Math.PI / 2 + 0.4; } break;
    case 'atgm': if (!fx.rpg && claim(6, 1)) { pendingFollow = { id: fx.air, at: nowS() + 0.3, dist: 30 }; } break;
    case 'mark': if (fx.text.includes('انتشر') || fx.text.includes('ينسحب')) { const col = W.units.find(u => u.side === 'en' && u.alive && u.group === 'رتل مدرّع معادي'); if (col) twoShot(col.p, [-2050, 0, -350], 4, 6); } break;
    default: break;
  }
}
let pendingFollow: { id: number; at: number; dist: number } | null = null, lastSalvoShot = -99;
function directorFrame() {
  if (!auto || !W) return;
  if (pendingFollow && nowS() > pendingFollow.at) { const p = pendingFollow; pendingFollow = null; if (findEntity(p.id)) { startFollow(p.id, p.dist); shotUntil = nowS() + 9; shotPrio = 6; } }
  if (view.follow && !findEntity(view.follow)) { if (nowS() > shotUntil - 6) { endFollow(); shotUntil = nowS() + 1.5; } }
  if (!view.follow && nowS() > shotUntil + 0.5) { overview(); shotUntil = nowS() + 7; shotPrio = 0; }
}

// ===== الخريطة المصغّرة =====
const mini = $('mini') as HTMLCanvasElement, mg = mini.getContext('2d')!, MW = 10000;
const m2px = (x: number, z: number) => [(x + MW / 2) / MW * mini.width, (MW / 2 - z) / MW * mini.height];
function drawMini() {
  const g = mg, S = mini.width; g.clearRect(0, 0, S, S); g.fillStyle = 'rgba(205,180,130,.18)'; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(150,135,100,.95)'; g.lineWidth = 3; g.beginPath(); for (let z = -5000; z <= 5000; z += 200) { const [x, y] = m2px(riverX(z), z); z === -5000 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
  g.strokeStyle = 'rgba(235,220,180,.75)'; g.beginPath(); for (const [ax, az, bx, bz, , kd] of ROADS) { if (kd === 2) continue; const [x1, y1] = m2px(Math.max(-5000, ax), az), [x2, y2] = m2px(bx, bz); g.moveTo(x1, y1); g.lineTo(x2, y2); } g.lineWidth = 1.3; g.stroke();
  for (const s of SITES) { const [x, y] = m2px(s.p[0], s.p[2]); g.fillStyle = '#f0e6c8'; g.fillRect(x - 2.5, y - 2.5, 5, 5); }
  for (const u of W.units) { if (!u.alive) continue; const [x, y] = m2px(u.p[0], u.p[2]); g.fillStyle = u.side === 'iq' ? '#5fbf7a' : '#e0553c'; g.beginPath(); g.arc(x, y, u.kind === 'patriot' || u.kind === 's400' ? 4 : 3, 0, 7); g.fill(); }
  for (const a of W.air) { const [x, y] = m2px(a.p[0], a.p[2]); g.fillStyle = a.side === 'iq' ? '#bff5cc' : '#ff8a70'; g.fillRect(x - 2, y - 2, 4, 4); }
  const hw = clamp(camDist * 0.7, 80, 5000); const [vx, vy] = m2px(camTarget.x, camTarget.z); g.strokeStyle = '#d2ab33'; g.lineWidth = 2; g.strokeRect(vx - hw / MW * S, vy - hw / MW * S * 0.7, 2 * hw / MW * S, 1.4 * hw / MW * S * 0.7);
}
mini.addEventListener('pointerdown', e => { e.stopPropagation(); setAuto(false); endFollow(); const r = mini.getBoundingClientRect(); view.tx = ((e.clientX - r.left) / r.width) * MW - MW / 2; view.tz = MW / 2 - ((e.clientY - r.top) / r.height) * MW; view.dist = Math.min(view.dist, 1800); view.pitch = -1; targetY = 0; });

// ===== الشريط السفلي والأوامر =====
let tickN = -1;
function hud() {
  const s = W.stats, mm = `${Math.floor(W.T / 60)}:${String(Math.floor(W.T % 60)).padStart(2, '0')}`;
  $('clock').textContent = mm;
  $('phase').textContent = W.air.some(a => a.kind === 'iskander') ? '⚠ صاروخ باليستي بالجو' : W.air.some(a => a.kind === 'shahed') ? 'مسيّرات بالجو' : W.air.some(a => a.kind === 'kh101') ? 'صواريخ كروز بالجو' : ({ march: 'رتل العدو على الطريق', approach: 'العدو يتقدم بقفزات', breach: 'العدو يخترق نحو التلّة', assault: 'اقتحام قرية الطريق', retreat: 'العدو ينسحب' } as Record<string, string>)[W.en] + (W.iq === 'line2' ? ' · خطنا الثاني' : W.iq === 'counter' ? ' · هجومنا المعاكس' : '');
  const held = W.houseOwner.filter(o => o === 'en').length;
  $('tally').innerHTML = `<span>T-72 <b class="g">${s.enTanksLost}</b>/${s.enTanks}</span><span>BMP <b class="g">${s.enBmpLost}</b>/${s.enBmp}</span><span>مشاة العدو <b class="g">${s.enMenLost}</b>/${s.enMen}</span>`
    + `<span>أبرامز <b>${s.iqTanks - s.iqTanksLost}</b>/${s.iqTanks}</span><span>جنودنا <b>${s.iqMen - s.iqMenLost}</b>/${s.iqMen}</span>${held ? `<span>بيوت بيد العدو <b class="x">${held}</b></span>` : ''}`
    + `<span>جو: <b class="g">${s.dronesDown + s.cruiseDown + s.ballisticDown}</b>/${s.drones + s.cruise + s.ballistic}</span>`;
  if (W.log.length !== tickN) {
    tickN = W.log.length;
    $('ticker').innerHTML = W.log.slice(-2).map((l, i) => `<button data-i="${W.log.length - 2 + i}"><span class="t">${Math.floor(l.t / 60)}:${String(Math.floor(l.t % 60)).padStart(2, '0')}</span><b class="${l.good === true ? 'g' : l.good === false ? 'x' : 'n'}">${l.good === true ? '✓' : l.good === false ? '✗' : '•'}</b><span>${l.text}</span></button>`).join('');
  }
  document.querySelectorAll<HTMLButtonElement>('#orders button').forEach(b => {
    const o = b.dataset.o as Order, left = Math.max(0, W.orderCd[o] - W.T);
    (b.lastChild as HTMLElement).style.width = `${(left / ORDER_CD[o]) * 100}%`; b.disabled = left > 0 && o !== 'aaPriority';
    if (o === 'aaPriority') b.setAttribute('aria-pressed', String(W.aaPriority));
  });
}
$('ticker').addEventListener('click', e => { setAuto(false); const b = (e.target as HTMLElement).closest('button'); if (!b) return; const l = W.log[+b.dataset.i!]; if (l) { endFollow(); view.tx = l.p[0]; view.tz = l.p[2]; view.dist = 900; view.pitch = -1; targetY = 0; } });
document.querySelectorAll<HTMLButtonElement>('#orders button').forEach(b => b.onclick = () => { const msg = order(W, b.dataset.o as Order); toast(msg ?? '✓ انطلق الأمر'); });

// ===== الحلقة =====
let running = false, endShown = false, acc = 0, autoQ = false;
const fpsEl = $('fps'); let fpsAcc = 0, fpsN = 0, fpsT = 0, miniT = 0; const fpsHist: number[] = [];
function frame() {
  const dtReal = Math.min(engine.getDeltaTime() / 1000, 0.1);
  let simDt = 0;
  if (running && simSpeed > 0) {
    slowK = slowWins.some(w => W.T >= w.t0 && W.T <= w.t1) ? 0.22 : 1;
    acc += dtReal * simSpeed * slowK; const STEP = 1 / 60; let n = 0;
    while (acc >= STEP && n < 16) {
      step(W, STEP); acc -= STEP; simDt += STEP; n++;
      for (const f0 of W.fx) { const f = liftFx(f0); handleFx(f); directorFx(f); } W.fx.length = 0;
      for (let i = vq.length - 1; i >= 0; i--) if (vq[i].t <= W.T) { const f = vq[i].f; vq.splice(i, 1); f(); }
    }
    if (n === 16) acc = 0;
  }
  ($('slow') as HTMLElement).hidden = slowK === 1;
  if (W) { syncUnits(dtReal); syncSquads(dtReal); drawSoldiers(dtReal); syncAir(); if (simDt) { burnFx(simDt); tickDebris(simDt); } directorFrame(); }
  const k = simDt ? simDt / Math.max(1e-4, engine.getDeltaTime() / 1000) : 0;
  for (const p of pools) p.ps.updateSpeed = k / 60;
  tickLights(dtReal * (simDt ? 1 : 0.3)); updateCamera(dtReal);
  scene.render();
  for (const p of pools) p.flush();
  if (W) { drawLabels(); drawArrows(); followPanel(); hud(); const sh = W.air.filter(a => a.kind === 'shahed'); sfx.drones(sh.length ? Math.min(...sh.map(a => Vector3.Distance(cam.position, v(a.p)))) : 1e9);
    if ((miniT += dtReal) > 0.25) { miniT = 0; drawMini(); } }
  if (W?.over && !endShown) { endShown = true; setTimeout(showEnd, 3000); }
  const fps = engine.getFps(); fpsAcc += fps; fpsN++; fpsT += dtReal;
  if (fpsT > 0.5) { const avg = fpsAcc / fpsN; fpsEl.textContent = `${avg.toFixed(0)} FPS · ${HQ ? 'عالية' : 'خفيفة'}`; if (running && W.T > 12 && W.T < 22) fpsHist.push(avg); /* بعد ما يخلص تجهيز الرسم أول مرة */ fpsAcc = fpsN = fpsT = 0; }
  if (!autoQ && running && W.T > 22 && !AUTO) { autoQ = true; const a = fpsHist.reduce((x, y) => x + y, 0) / Math.max(1, fpsHist.length); if (HQ && fpsHist.length > 3 && a < 26) { setQuality(false); toast(`خفّضت الجودة تلقائياً (${a.toFixed(0)} إطار/ث) حتى تبقى سلسة`); } }
  (window as any).__state = { T: W?.T ?? 0, over: W?.over, stats: W?.stats, dist: camDist, follow: view.follow, fps, log: W?.log.length, slow: slowK < 1, phase: W?.columnPhase };
}
function setQuality(hq: boolean) { HQ = hq; applyRes(); applyPipe(); setupShadows(); $('bQual').setAttribute('aria-pressed', String(hq)); }
function showEnd() {
  const s = W.stats;
  $('endTitle').textContent = W.result === 'win' ? 'القرية صمدت: العدو انسحب' : W.result === 'loss' ? 'العدو مسك قرية الطريق' : 'المعركة وگفت: القرية مقسومة';
  $('endSum').innerHTML = `<div>دبابات العدو<b>${s.enTanksLost} من ${s.enTanks} دُمّرت</b></div><div>ناقلات BMP<b>${s.enBmpLost} من ${s.enBmp}</b></div>`
    + `<div>مشاة العدو<b>${s.enMenLost} من ${s.enMen}</b></div><div>خسائرنا<b>${s.iqTanksLost} دبابة · ${s.iqMenLost} جندي</b></div>`
    + `<div>بيوت تهدّمت<b>${s.housesLost}</b></div><div>كورنيت + RPG<b>${s.atgm} + ${s.rpg}</b></div>`
    + `<div>الجو: أُسقط<b>${s.dronesDown + s.cruiseDown + s.ballisticDown} من ${s.drones + s.cruise + s.ballistic}</b></div><div>مدة المعركة<b>${Math.floor(W.T / 60)}:${String(Math.floor(W.T % 60)).padStart(2, '0')}</b></div>`;
  ($('end') as HTMLElement).hidden = false;
}
function toast(m: string) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout((toast as any).h); (toast as any).h = setTimeout(() => t.classList.remove('show'), 2600); }
let seed = 3;
function start() {
  sfx.init();
  for (const sv of squadVis.values()) sv.kornet?.dispose(); squadVis.clear(); solVis.clear(); deadOrder.length = 0; screens.length = 0;
  for (const u of unitVis.values()) u.root.dispose(); unitVis.clear(); for (const a of airVis.values()) a.n.dispose(); airVis.clear();
  debris.forEach(d => d.m.dispose()); debris.length = 0; burning.length = 0; marks = []; vq.length = 0; slowWins.length = 0; decals = [];
  decal.thinInstanceSetBuffer('matrix', new Float32Array(16), 16, false); decal.thinInstanceCount = 0;
  for (const el of els.values()) el.remove(); els.clear(); for (const el of arrowEls.values()) el.remove(); arrowEls.clear(); pools.forEach(p => p.ps.reset());
  houses.reset();
  siteProps.forEach(sp => { if (!sp.hit) return; sp.hit = false; sp.mat.diffuseColor = sp.mat.diffuseColor.scale(4); sp.mesh.scaling.y /= 0.55; sp.mesh.position.y /= 0.55; });
  W = newWorld(seed); seed = 1 + Math.floor(Math.random() * 9999); running = true; endShown = false; tickN = -1; impactReady = 0; lastSalvoShot = -99;
  setAuto(true); overview(true);
  for (const id of ['intro', 'end']) ($(id) as HTMLElement).hidden = true;
  for (const id of ['top', 'bottom', 'sideBtns', 'fps', 'mini']) ($(id) as HTMLElement).hidden = false;
}
document.querySelectorAll<HTMLButtonElement>('#spd button').forEach(b => b.onclick = () => { simSpeed = +b.dataset.s!; document.querySelectorAll('#spd button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
$('bStart').onclick = start; $('bAgain').onclick = start;
$('bExplore').onclick = () => { ($('end') as HTMLElement).hidden = true; setAuto(false); toast('حرّك الخريطة واضغط على أي اسم'); };
$('bBack').onclick = () => { setAuto(false); endFollow(); }; $('bHome').onclick = () => { setAuto(false); endFollow(); view.tx = -1900; view.tz = -330; view.dist = 1000; view.yaw = 0; view.pitch = -1; targetY = 0; };
$('bAuto').onclick = () => setAuto(!auto);
$('bSide').onclick = () => { sideView = !sideView; $('bSide').setAttribute('aria-pressed', String(sideView)); };
$('bRotL').onclick = () => (view.yaw += 0.5); $('bRotR').onclick = () => (view.yaw -= 0.5);
$('bQual').onclick = () => { setQuality(!HQ); toast(HQ ? 'جودة عالية: ظلال وأضواء انفجارات' : 'جودة خفيفة: أسرع على التلفون'); };
$('bMute').onclick = () => ($('bMute').textContent = sfx.toggle() ? '🔇' : '🔊');
$('bCred').onclick = () => (($('credits') as HTMLElement).hidden = false); $('bCredClose').onclick = () => (($('credits') as HTMLElement).hidden = true);
window.addEventListener('resize', () => engine.resize());
(window as any).__step = (dt: number) => { step(W, dt); for (const f0 of W.fx) handleFx(liftFx(f0)); W.fx.length = 0; for (let i = vq.length - 1; i >= 0; i--) if (vq[i].t <= W.T) { const f = vq[i].f; vq.splice(i, 1); f(); } };
(window as any).__follow = startFollow; (window as any).__getW = () => W; (window as any).__houses = HOUSES; (window as any).__view = view; (window as any).__scene = scene; (window as any).__order = (o: Order) => order(W, o);

(async () => {
  const load = $('load');
  try {
    keepClear = newWorld(3).units.map(u => u.p).concat([PATRIOT_POS, S400_POS]);
    await loadHeight();
    ({ houses, siteProps } = await buildWorld(scene, { HQ, NL, caster, texUrls, keepClear, modelUrl, prepMat: m => { if (m instanceof PBRMaterial) { m.environmentIntensity = 0; m.directIntensity = PBR_DIRECT; m.metallic = Math.min(m.metallic ?? 1, 0.15); m.maxSimultaneousLights = 2 + NL; } } }));
    makeProcedural();
    await loadModels(t => (load.textContent = t)); load.textContent = 'يحمّل الجنود…'; await loadSoldier();
    setupShadows(); $('bQual').setAttribute('aria-pressed', String(HQ));
    W = newWorld(3); syncUnits(0);
    await scene.whenReadyAsync();
    load.textContent = 'جاهز.'; ($('bStart') as HTMLButtonElement).disabled = false;
    engine.runRenderLoop(frame);
    if (AUTO) start();
  } catch (e) { load.textContent = 'صار خطأ بالتحميل: ' + (e as Error).message; console.error(e); }
})();
