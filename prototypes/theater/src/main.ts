// مسرح عمليات بغداد — رسم Babylon.js فوق منطق sim.ts
import {
  Engine, Scene, Vector3, Color3, Color4, FreeCamera, HemisphericLight, DirectionalLight, MeshBuilder, Mesh, StandardMaterial,
  PBRMaterial, DynamicTexture, ParticleSystem, TransformNode, VertexBuffer, DefaultRenderingPipeline, ImageProcessingConfiguration,
  LoadAssetContainerAsync, AssetContainer, Matrix, Particle, BaseTexture, Texture, Quaternion,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { SkyMaterial } from '@babylonjs/materials/sky';
import {
  V3, add, sub, scale, len, norm, lerp, clamp, rng, World, newWorld, step, Unit, Air, Fx, AirKind, Kind,
  SITES, riverX, RIVER_W, HIGHWAY_Z, AIR_AR, SIDE_AR, PATRIOT_POS, dist2d,
} from './sim';

const urls = import.meta.glob('../models/*.gltf.json', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const modelUrl = (n: string) => urls[`../models/${n}.gltf.json`];

// ===== إعداد =====
const qs = new URLSearchParams(location.search);
const AUTO = qs.has('auto');
const LOW = qs.get('q') === 'low';
const $ = (id: string) => document.getElementById(id)!;
const canvas = $('c') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: AUTO }, true);
engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, LOW ? 1 : 1.5));
const scene = new Scene(engine);
scene.skipPointerMovePicking = true;
const v = (a: V3) => new Vector3(a[0], a[1], a[2]);
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const SUN = norm([0.35, 0.62, 0.55]);

// ===== ضوء وسماء =====
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
hemi.intensity = 0.9; hemi.diffuse = new Color3(0.68, 0.74, 0.86); hemi.groundColor = new Color3(0.52, 0.45, 0.36);
const sun = new DirectionalLight('sun', v(scale(SUN, -1)), scene); sun.intensity = 2.6; sun.diffuse = new Color3(1, 0.9, 0.76);
const sky = MeshBuilder.CreateBox('sky', { size: 60000 }, scene);
const skyMat = new SkyMaterial('skyMat', scene);
Object.assign(skyMat, { backFaceCulling: false, useSunPosition: true, sunPosition: v(scale(SUN, 1000)), turbidity: 6, luminance: 1, rayleigh: 2.6, mieCoefficient: 0.005, mieDirectionalG: 0.8, fogEnabled: false });
sky.material = skyMat; sky.infiniteDistance = true; sky.isPickable = false;
scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.000022; scene.fogColor = new Color3(0.78, 0.76, 0.7);

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
const texScorch = canvasTex('scorch', 64, radial([[0, 'rgba(20,16,12,.85)'], [0.5, 'rgba(35,28,20,.55)'], [1, 'rgba(40,30,20,0)']]));
const texSmoke = canvasTex('smoke', 128, (g, s) => {
  for (let i = 0; i < 22; i++) { const a = R() * 6.28, r = R() * s * 0.22, x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r, rad = s * (0.12 + R() * 0.16), k = 0.75 + R() * 0.25;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${255 * k | 0},${255 * k | 0},${255 * k | 0},.5)`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'destination-in'; radial([[0, 'rgba(0,0,0,1)'], [0.3, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']])(g, s);
});
const texGround = canvasTex('ground', 256, (g, s) => {
  const im = g.createImageData(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const n = (Math.sin(x * 0.7 + Math.sin(y * 0.31) * 3) + Math.sin(y * 0.53 + Math.sin(x * 0.23) * 2)) * 0.5, r = R(); const c = 214 + n * 10 + (r - 0.5) * 26, i = (y * s + x) * 4;
    im.data[i] = c; im.data[i + 1] = c; im.data[i + 2] = c; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
});
texGround.hasAlpha = false;

// ===== الأرض: صحراء غرباً، بساتين على دجلة، مدينة بالوسط =====
const CITY_R = 5600;
const inRiver = (x: number, z: number, pad = 0) => Math.abs(x - riverX(z)) < RIVER_W(z) / 2 + pad;
function buildGround() {
  const SIZE = 22000, SUB = LOW ? 140 : 200;
  const g = MeshBuilder.CreateGround('ground', { width: SIZE, height: SIZE, subdivisions: SUB }, scene);
  const pos = g.getVerticesData(VertexBuffer.PositionKind)!, n = pos.length / 3, col = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], z = pos[i * 3 + 2], d = Math.hypot(x, z), dr = Math.abs(x - riverX(z));
    const desert: V3 = [0.82, 0.7, 0.5], farm: V3 = [0.42, 0.52, 0.3], urban: V3 = [0.74, 0.7, 0.62];
    const farmK = (1 - smooth(900, 2600, dr)) * (0.6 + 0.4 * Math.sin(x * 0.004) * Math.sin(z * 0.0035)), urbanK = 1 - smooth(CITY_R - 600, CITY_R + 900, d);
    const c = [0, 1, 2].map(k => lerp(lerp(desert[k], farm[k], clamp(farmK, 0, 1)), urban[k], urbanK * 0.75));
    col.set([c[0], c[1], c[2], 1], i * 4);
  }
  g.setVerticesData(VertexBuffer.ColorKind, col);
  const m = new StandardMaterial('groundMat', scene); m.diffuseTexture = texGround; (texGround as Texture).uScale = (texGround as Texture).vScale = SIZE / 45;
  m.specularColor = Color3.Black(); g.material = m; g.isPickable = false; g.freezeWorldMatrix();
}
function ribbonAlong(name: string, pts: V3[], width: number, y: number, mat: StandardMaterial) {
  const L: Vector3[] = [], Rr: Vector3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], t = norm(sub(b, a)), nrm: V3 = [-t[2], 0, t[0]];
    L.push(v([pts[i][0] + nrm[0] * width / 2, y, pts[i][2] + nrm[2] * width / 2]));
    Rr.push(v([pts[i][0] - nrm[0] * width / 2, y, pts[i][2] - nrm[2] * width / 2]));
  }
  const r = MeshBuilder.CreateRibbon(name, { pathArray: [L, Rr] }, scene); r.material = mat; r.isPickable = false; r.freezeWorldMatrix(); return r;
}
function buildRiverAndRoads() {
  const water = new StandardMaterial('water', scene); water.diffuseColor = new Color3(0.16, 0.3, 0.32); water.specularColor = new Color3(0.55, 0.55, 0.5); water.specularPower = 90;
  const L: Vector3[] = [], Rr: Vector3[] = [];
  for (let z = -11000; z <= 11000; z += 80) { const x = riverX(z), w = RIVER_W(z) / 2; L.push(new Vector3(x - w, 0.4, z)); Rr.push(new Vector3(x + w, 0.4, z)); }
  const river = MeshBuilder.CreateRibbon('river', { pathArray: [L, Rr] }, scene); river.material = water; river.isPickable = false;
  const asphalt = new StandardMaterial('asphalt', scene); asphalt.diffuseColor = new Color3(0.28, 0.27, 0.25); asphalt.specularColor = Color3.Black();
  const line = (a: V3, b: V3, n = 2) => Array.from({ length: n }, (_, i) => [lerp(a[0], b[0], i / (n - 1)), 0, lerp(a[2], b[2], i / (n - 1))] as V3);
  ribbonAlong('highway', line([-11000, 0, HIGHWAY_Z], [riverX(HIGHWAY_Z) - 200, 0, HIGHWAY_Z], 40), 34, 0.3, asphalt);
  const ring: V3[] = []; for (let a = 0; a <= 6.2832 + 0.01; a += 0.05) ring.push([Math.cos(a) * 5900, 0, Math.sin(a) * 5900]);
  ribbonAlong('ring', ring, 26, 0.32, asphalt);
  ribbonAlong('north', line([-1900, 0, 0], [-2300, 0, 11000], 30), 22, 0.31, asphalt);
  ribbonAlong('south', line([2200, 0, -1000], [3800, 0, -11000], 30), 22, 0.31, asphalt);
  ribbonAlong('east', line([riverX(1200) + 200, 0, 1200], [11000, 0, 2600], 30), 22, 0.31, asphalt);
  // جسور على دجلة
  const bridgeMat = new StandardMaterial('bridge', scene); bridgeMat.diffuseColor = new Color3(0.62, 0.6, 0.55); bridgeMat.specularColor = Color3.Black();
  for (const z of [-2600, -300, 1200, 3300]) { const w = RIVER_W(z) + 120, b = MeshBuilder.CreateBox('br', { width: w, height: 3, depth: 22 }, scene); b.position.set(riverX(z), 2.5, z); b.material = bridgeMat; b.isPickable = false; }
}
let keepClear: V3[] = [];
function buildCity() {
  // مباني: نسخ رقيقة (thin instances) من مكعب واحد = نداء رسم واحد
  const box = MeshBuilder.CreateBox('bld', { size: 1 }, scene); box.isPickable = false;
  const m = new StandardMaterial('bldMat', scene); m.specularColor = new Color3(0.04, 0.04, 0.04); box.material = m;
  const grid = LOW ? 115 : 88, mats: number[] = [], cols: number[] = [], r = rng(31);
  const palette: V3[] = [[0.86, 0.8, 0.68], [0.8, 0.74, 0.62], [0.9, 0.87, 0.8], [0.74, 0.68, 0.58], [0.68, 0.64, 0.58]];
  for (let x = -CITY_R - 900; x <= CITY_R + 900; x += grid) for (let z = -CITY_R - 900; z <= CITY_R + 900; z += grid) {
    const px = x + (r() - 0.5) * grid * 0.5, pz = z + (r() - 0.5) * grid * 0.5, d = Math.hypot(px, pz);
    const dens = 1 - smooth(CITY_R * 0.55, CITY_R + 700, d); if (r() > dens * 0.85 + 0.03) continue;
    if (inRiver(px, pz, 90) || Math.abs(pz - HIGHWAY_Z) < 60 || Math.abs(d - 5900) < 50 || Math.abs(px - (-1900 - pz * 0.036)) < 40) continue;
    if (SITES.some(s => dist2d([px, 0, pz], s.p) < 260) || dist2d([px, 0, pz], PATRIOT_POS) < 300) continue;
    if (keepClear.some(q => dist2d([px, 0, pz], q) < 140) || (px < -3300 && Math.abs(pz - HIGHWAY_Z) < 900)) continue;
    const w = 18 + r() * 34, dpt = 18 + r() * 34, h = 5 + r() * 12 + (1 - smooth(0, 3500, d)) * r() * 26;
    const mat = Matrix.Compose(new Vector3(w, h, dpt), Quaternion.RotationAxis(Vector3.Up(), (r() - 0.5) * 0.25 + Math.atan2(px, pz) * 0.08), new Vector3(px, h / 2, pz));
    mats.push(...mat.asArray()); const c = palette[(r() * palette.length) | 0], k = 0.92 + r() * 0.1; cols.push(c[0] * k, c[1] * k, c[2] * k, 1);
  }
  box.thinInstanceSetBuffer('matrix', new Float32Array(mats), 16, true);
  box.thinInstanceRegisterAttribute('color', 4); box.thinInstanceSetBuffer('color', new Float32Array(cols), 4, true);
  // نخيل على ضفاف دجلة وبالبساتين
  const trunk = MeshBuilder.CreateCylinder('tr', { height: 9, diameter: 0.7, tessellation: 5 }, scene); trunk.position.y = 4.5;
  const crown = MeshBuilder.CreateSphere('cr', { diameter: 7, segments: 3 }, scene); crown.position.y = 9.5; crown.scaling.y = 0.55;
  const palm = Mesh.MergeMeshes([trunk, crown], true, true)!; palm.isPickable = false;
  const pm = new StandardMaterial('palmMat', scene); pm.specularColor = Color3.Black(); palm.material = pm;
  const pmats: number[] = [], pcols: number[] = [];
  for (let i = 0; i < (LOW ? 2500 : 5000); i++) {
    const z = (r() - 0.5) * 20000, side = r() < 0.5 ? -1 : 1, off = RIVER_W(z) / 2 + 40 + Math.pow(r(), 1.6) * 2200;
    const x = riverX(z) + side * off, d = Math.hypot(x, z); if (d < CITY_R * 0.7 && r() < 0.8) continue;
    const s = 0.8 + r() * 0.5, mt = Matrix.Compose(new Vector3(s, s, s), Quaternion.Identity(), new Vector3(x, 0, z));
    pmats.push(...mt.asArray()); const g = 0.32 + r() * 0.12; pcols.push(0.25, g, 0.16, 1);
  }
  palm.thinInstanceSetBuffer('matrix', new Float32Array(pmats), 16, true);
  palm.thinInstanceRegisterAttribute('color', 4); palm.thinInstanceSetBuffer('color', new Float32Array(pcols), 4, true);
  // مطار: مدرج + مبنى
  const ap = SITES[0].p, run = new StandardMaterial('run', scene); run.diffuseColor = new Color3(0.3, 0.3, 0.29); run.specularColor = Color3.Black();
  for (const [dx, dz, wid, ang] of [[0, 0, 60, 0.18], [700, -500, 45, 0.18]]) { const rw = MeshBuilder.CreateGround('rw', { width: wid, height: 3600 }, scene); rw.position.set(ap[0] + dx, 0.25, ap[2] + dz); rw.rotation.y = ang; rw.material = run; }
  const term = MeshBuilder.CreateBox('term', { width: 380, height: 18, depth: 70 }, scene); term.position.set(ap[0] + 520, 9, ap[2] + 260); term.material = m;
  // مصفى الدورة: خزانات
  const tank = MeshBuilder.CreateCylinder('tk', { height: 14, diameter: 36, tessellation: 20 }, scene); tank.isPickable = false;
  const tm = new StandardMaterial('tkm', scene); tm.diffuseColor = new Color3(0.86, 0.86, 0.83); tm.specularColor = new Color3(0.2, 0.2, 0.2); tank.material = tm;
  const tmats: number[] = []; const dp = SITES[2].p;
  for (let i = 0; i < 12; i++) { const mt = Matrix.Compose(new Vector3(1, 1, 1), Quaternion.Identity(), new Vector3(dp[0] + (i % 4) * 55 - 80, 7, dp[2] + Math.floor(i / 4) * 55 - 60)); tmats.push(...mt.asArray()); }
  tank.thinInstanceSetBuffer('matrix', new Float32Array(tmats), 16, true);
}

// ===== كاميرا استراتيجية: مايلة من فوق =====
const cam = new FreeCamera('cam', new Vector3(0, 5000, -5000), scene);
cam.inputs.clear(); cam.minZ = 3; cam.maxZ = 80000; cam.fov = 0.78;
const view = { tx: -2700, tz: -900, dist: 11000, yaw: 0.0, follow: 0 as number, fDist: 0 };
const pitchFor = (d: number) => lerp(0.62, 1.02, smooth(600, 14000, d));
let camTarget = new Vector3(view.tx, 0, view.tz), camDist = view.dist, camPitch = pitchFor(view.dist);
function homeView() { view.tx = -2700; view.tz = -900; view.dist = 11000; view.yaw = 0; endFollow(); }
function updateCamera(dt: number) {
  const k = 1 - Math.exp(-dt * 7);
  let tgt = new Vector3(view.tx, 0, view.tz), want = view.dist, pitch = pitchFor(view.dist);
  const f = view.follow ? findEntity(view.follow) : null;
  if (f) { tgt = v(f.p); want = view.fDist; pitch = f.air ? 0.22 : 0.42; view.tx = tgt.x; view.tz = tgt.z;
    if (f.air && f.vel) view.yaw = lerpAngle(view.yaw, Math.atan2(f.vel[0], f.vel[2]), 1 - Math.exp(-dt * 2)); }
  // عند التتبع: انتقال ناعم أول 0.8 ثانية، بعدها الكاميرا ملتصقة بالهدف (حتى صاروخ بسرعة 1300 م/ث ما يفلت)
  if (f) { followBlend = Math.min(1, followBlend + dt / 0.8); const e = followBlend * followBlend * (3 - 2 * followBlend); camTarget = Vector3.Lerp(followFrom, tgt, e); if (followBlend < 1) followFrom = Vector3.Lerp(followFrom, tgt, k * 0.5); }
  else camTarget = Vector3.Lerp(camTarget, tgt, k);
  camDist = lerp(camDist, want, k); camPitch = lerp(camPitch, pitch, k);
  const cp = Math.cos(camPitch) * camDist, pos = new Vector3(camTarget.x - Math.sin(view.yaw) * cp, camTarget.y + Math.sin(camPitch) * camDist, camTarget.z - Math.cos(view.yaw) * cp);
  pos.y = Math.max(pos.y, 4);
  // اهتزاز خفيف بالانفجارات القريبة
  trauma = Math.max(0, trauma - dt * 1.3); shakeT += dt * 30;
  const sh = trauma * trauma * camDist * 0.006;
  cam.position.copyFrom(pos);
  cam.setTarget(camTarget.add(new Vector3(Math.sin(shakeT * 1.7) * sh, Math.sin(shakeT * 2.3) * sh, Math.sin(shakeT * 1.1) * sh)));
}
let trauma = 0, shakeT = 0, followBlend = 1, followFrom = new Vector3();
// لمس: إصبع = تحريك، إصبعين = تقريب ولف؛ عجلة الماوس = تقريب
const ptrs = new Map<number, { x: number; y: number }>();
let pinch0 = 0, angle0 = 0, moved = 0;
canvas.addEventListener('pointerdown', e => { setAuto(false); canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); angle0 = Math.atan2(b.y - a.y, b.x - a.x); } });
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
  if (ptrs.size === 1) {
    if (view.follow && moved > 12) endFollow();
    if (view.follow) return;
    const s = (camDist * 2 * Math.tan(cam.fov / 2)) / canvas.clientHeight, fx = Math.sin(view.yaw), fz = Math.cos(view.yaw);
    view.tx += (-dx * fz + dy * fx / Math.sin(camPitch) * 0.9) * s; view.tz += (dx * fx + dy * fz / Math.sin(camPitch) * 0.9) * s;
    view.tx = clamp(view.tx, -10000, 10000); view.tz = clamp(view.tz, -10000, 10000);
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    if (pinch0) { zoomBy(pinch0 / d); let da = ang - angle0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; view.yaw -= da; }
    pinch0 = d; angle0 = ang;
  }
});
const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch0 = 0; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { e.preventDefault(); setAuto(false); zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
function zoomBy(f: number) { if (view.follow) view.fDist = clamp(view.fDist * f, 40, 1500); else view.dist = clamp(view.dist * f, 250, 17000); }

// ===== المعالجة اللاحقة =====
const pipe = new DefaultRenderingPipeline('pipe', true, scene, [cam]);
pipe.fxaaEnabled = true; pipe.bloomEnabled = true; pipe.bloomThreshold = 0.85; pipe.bloomWeight = 0.38; pipe.bloomKernel = LOW ? 32 : 48; pipe.bloomScale = 0.5;
pipe.imageProcessing.toneMappingEnabled = true; pipe.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
pipe.imageProcessing.exposure = 1.15; pipe.imageProcessing.contrast = 1.12; pipe.imageProcessing.vignetteEnabled = true; pipe.imageProcessing.vignetteWeight = 1.2;

// ===== المجسمات (نسخ متعددة من كل نوع) =====
const MODEL: Record<string, { scale: number; yaw: number }> = {
  abrams: { scale: 1, yaw: 0 }, t72: { scale: 1, yaw: 0 }, technical: { scale: 0.8, yaw: 0 }, dshk: { scale: 0.11, yaw: 0 },
  d30: { scale: 0.22, yaw: Math.PI }, grad: { scale: 1, yaw: 0 }, patriot: { scale: 1, yaw: 0 }, shahed: { scale: 1.45, yaw: 0 }, kh101: { scale: 1, yaw: Math.PI },
};
const containers: Record<string, AssetContainer> = {};
async function loadModels(progress: (t: string) => void) {
  const names = Object.keys(MODEL); let done = 0;
  await Promise.all(names.map(async n => {
    const c = await LoadAssetContainerAsync(modelUrl(n), scene, { pluginExtension: '.gltf' });
    c.materials.forEach(m => { if (m instanceof PBRMaterial) { m.environmentIntensity = 0; m.maxSimultaneousLights = 2; } });
    // النسخ تنرسم عن طريق المجسم الأصلي: نضيفه للمشهد ونخفيه هو بس
    c.addAllToScene(); c.meshes.forEach(m => { m.isVisible = false; m.isPickable = false; });
    containers[n] = c; progress(`يحمّل المجسمات… ${++done}/${names.length}`);
  }));
}
const blobMat = new StandardMaterial('blobMat', scene); blobMat.diffuseTexture = texBlob; blobMat.opacityTexture = texBlob; blobMat.disableLighting = true; blobMat.emissiveColor = Color3.Black(); blobMat.specularColor = Color3.Black();
function spawnModel(kind: string) {
  const root = new TransformNode('u_' + kind, scene), inner = new TransformNode('in', scene); inner.parent = root;
  const spec = MODEL[kind]; inner.rotation.y = spec.yaw; inner.scaling.setAll(spec.scale);
  const inst = containers[kind].instantiateModelsToScene(n => n, false, { doNotInstantiate: false });
  inst.rootNodes.forEach(r => { r.parent = inner; });
  root.getChildMeshes().forEach(m => (m.isPickable = false));
  return root;
}

// ===== الجسيمات: مجمّعات مشتركة (طلب = موقع + عدد) =====
const pools: Pool[] = [];
let simSpeed = 2;
interface Req { a: V3; b?: V3; n: number; dir?: V3; spd?: [number, number]; life?: number; up?: number; jit?: number }
class Pool {
  ps: ParticleSystem; q: Req[] = []; cur: Req | null = null; left = 0;
  constructor(name: string, cap: number, tex: BaseTexture, add: boolean, o: { life: [number, number]; size: [number, number][]; colors: [number, Color4][]; gravity?: number; damp?: number; stretched?: boolean; spin?: number }) {
    const p = this.ps = new ParticleSystem(name, cap, scene);
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
      if (r.dir) out.set(r.dir[0] * s, r.dir[1] * s, r.dir[2] * s);
      else { const d = norm([Math.random() - 0.5, Math.random() - 0.5 + (r.up ?? 0), Math.random() - 0.5]); out.set(d[0] * s, d[1] * s, d[2] * s); }
    };
    p.start(); pools.push(this);
  }
  emit(r: Req) { if (r.n <= 0) return; this.q.push(r); this.ps.manualEmitCount = Math.max(0, this.ps.manualEmitCount) + Math.round(r.n); }
  flush() { this.q.length = 0; this.left = 0; this.cur = null; }
}
const Qn = (n: number) => Math.max(1, Math.round(n * (LOW ? 0.55 : 1)));
const C4 = (r: number, g: number, b: number, a: number) => new Color4(r, g, b, a);
const fireS = new Pool('fireS', 900, texSmoke, true, { life: [0.3, 0.8], size: [[0, 2], [0.4, 7], [1, 9]], damp: 0.85, colors: [[0, C4(6, 4.5, 2.4, 1)], [0.35, C4(3, 1.2, 0.3, 0.8)], [1, C4(0.2, 0.05, 0.02, 0)]] });
const fireL = new Pool('fireL', 700, texSmoke, true, { life: [0.6, 1.5], size: [[0, 8], [0.3, 26], [1, 36]], damp: 0.85, colors: [[0, C4(6, 4.6, 2.6, 1)], [0.3, C4(3.2, 1.3, 0.35, 0.9)], [0.7, C4(0.8, 0.22, 0.05, 0.45)], [1, C4(0.1, 0.05, 0.03, 0)]] });
const smokeS = new Pool('smokeS', 1600, texSmoke, false, { life: [4, 8], size: [[0, 4], [0.3, 12], [1, 22]], damp: 0.9, gravity: 1.5, colors: [[0, C4(0.3, 0.27, 0.24, 0)], [0.05, C4(0.32, 0.29, 0.26, 0.8)], [1, C4(0.55, 0.52, 0.48, 0)]] });
const smokeL = new Pool('smokeL', 1400, texSmoke, false, { life: [12, 20], size: [[0, 12], [0.25, 40], [1, 75]], damp: 0.9, gravity: 1.2, colors: [[0, C4(0.18, 0.16, 0.15, 0)], [0.04, C4(0.17, 0.15, 0.14, 0.9)], [0.5, C4(0.33, 0.32, 0.31, 0.55)], [1, C4(0.5, 0.5, 0.5, 0)]] });
const dust = new Pool('dust', 1400, texSmoke, false, { life: [2.5, 5], size: [[0, 3], [1, 18]], damp: 0.86, gravity: 0.5, colors: [[0, C4(0.72, 0.6, 0.44, 0)], [0.06, C4(0.7, 0.58, 0.43, 0.75)], [1, C4(0.78, 0.68, 0.55, 0)]] });
const sparks = new Pool('sparks', 900, texSoft, true, { life: [0.5, 1.4], size: [[0, 1.2], [1, 0.4]], gravity: -9.8, stretched: true, colors: [[0, C4(5, 4, 2.4, 1)], [0.6, C4(3, 1.2, 0.3, 0.9)], [1, C4(1, 0.2, 0, 0)]] });
const muzzle = new Pool('muzzle', 400, texFlare, true, { life: [0.06, 0.12], size: [[0, 3], [1, 5]], colors: [[0, C4(6, 5, 3, 1)], [1, C4(3, 1.4, 0.3, 0)]] });
const tracers = new Pool('tracers', 1200, texSoft, true, { life: [0.4, 0.4], size: [[0, 0.9], [1, 0.9]], stretched: true, colors: [[0, C4(6, 4.2, 1.6, 1)], [1, C4(5, 3, 1, 1)]] });
const rocketTrail = new Pool('rocketTrail', 3000, texSmoke, false, { life: [2.5, 4.5], size: [[0, 1], [1, 7]], colors: [[0, C4(0.85, 0.82, 0.78, 0)], [0.05, C4(0.8, 0.78, 0.75, 0.55)], [1, C4(0.8, 0.78, 0.75, 0)]], gravity: 0.5 });
const pacTrail = new Pool('pacTrail', 5000, texSmoke, false, { life: [12, 18], size: [[0, 2.5], [0.2, 7], [1, 16]], colors: [[0, C4(1, 0.92, 0.8, 0)], [0.02, C4(0.97, 0.96, 0.94, 0.8)], [1, C4(0.85, 0.86, 0.88, 0)]], gravity: 0.4 });
const burnSmoke = new Pool('burnSmoke', 2200, texSmoke, false, { life: [8, 14], size: [[0, 3], [0.3, 14], [1, 34]], gravity: 0, colors: [[0, C4(0.12, 0.1, 0.09, 0)], [0.05, C4(0.1, 0.09, 0.08, 0.85)], [1, C4(0.4, 0.39, 0.38, 0)]] });
const burnFire = new Pool('burnFire', 400, texSmoke, true, { life: [0.3, 0.7], size: [[0, 2], [1, 4]], colors: [[0, C4(5, 3, 1.2, 0.9)], [1, C4(1.2, 0.3, 0.05, 0)]] });
const launchCloud = new Pool('launchCloud', 900, texSmoke, false, { life: [4, 9], size: [[0, 4], [0.3, 14], [1, 26]], damp: 0.86, gravity: 0.6, colors: [[0, C4(0.95, 0.92, 0.86, 0)], [0.04, C4(0.93, 0.9, 0.85, 0.85)], [1, C4(0.85, 0.82, 0.76, 0)]] });

// ===== آثار على الأرض (نسخ رقيقة) =====
const decal = MeshBuilder.CreateGround('decal', { width: 1, height: 1 }, scene);
const decalMat = new StandardMaterial('decalMat', scene); decalMat.diffuseTexture = texScorch; decalMat.opacityTexture = texScorch; decalMat.disableLighting = true; decalMat.emissiveColor = new Color3(0.12, 0.1, 0.08); decalMat.specularColor = Color3.Black(); decalMat.zOffset = -2;
decal.material = decalMat; decal.isPickable = false; decal.alwaysSelectAsActiveMesh = true;
let decals: number[] = [];
function addDecal(p: V3, size: number) {
  if (decals.length / 16 > 600) decals.splice(0, 16);
  decals.push(...Matrix.Compose(new Vector3(size, 1, size), Quaternion.RotationAxis(Vector3.Up(), Math.random() * 6.28), new Vector3(p[0], 0.45, p[2])).asArray());
  decal.thinInstanceSetBuffer('matrix', new Float32Array(decals), 16, false);
}

// ===== الصوت (مولّد) =====
const sfx = (() => {
  let ac: AudioContext | null = null, master: GainNode, muted = false, buzz: GainNode | null = null;
  const noise = (sec: number) => { const b = ac!.createBuffer(1, ac!.sampleRate * sec, ac!.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
  let nb: AudioBuffer;
  const vol = (d: number) => clamp(1.1 - d / 4500, 0, 1) ** 2;
  function hit(d: number, dur: number, f0: number, f1: number, g0: number, sub = 0) {
    if (!ac) return; const v0 = vol(d) * g0; if (v0 < 0.01) return;
    const t = ac.currentTime + Math.min(3, d / 343 / Math.max(1, simSpeed));
    const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(v0, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 2); s.stop(t + dur);
    if (sub) { const o = ac.createOscillator(), og = ac.createGain(); o.frequency.setValueAtTime(sub, t); o.frequency.exponentialRampToValueAtTime(sub * 0.4, t + 0.8); og.gain.setValueAtTime(v0 * 0.8, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.9); o.connect(og).connect(master); o.start(t); o.stop(t + 1); }
  }
  return {
    init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try { ac = new AudioContext(); } catch { return; }
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(ac.destination); nb = noise(4);
      const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 3;
      buzz = ac.createGain(); buzz.gain.value = 0; s.connect(f).connect(buzz).connect(master); s.start();
    },
    toggle() { muted = !muted; if (ac) master.gain.setTargetAtTime(muted ? 0 : 0.85, ac.currentTime, 0.05); return muted; },
    boom(d: number, size: number) { hit(d, 1.2 + size, 2200, 60, 0.5 + size * 0.35, 55); },
    shot(d: number) { hit(d, 0.5, 3000, 150, 0.6, 70); },
    rattle(d: number) { if (!ac) return; for (let i = 0; i < 5; i++) setTimeout(() => hit(d, 0.06, 4000, 1500, 0.22), i * 70); },
    launch(d: number) { hit(d, 3, 1400, 200, 0.7, 60); },
    drones(d: number) { if (ac && buzz) buzz.gain.setTargetAtTime(simSpeed ? vol(d) * 0.12 : 0, ac.currentTime, 0.2); },
  };
})();

// ===== ربط المحاكاة بالرسم =====
let W: World;
const unitNodes = new Map<number, TransformNode>(), airNodes = new Map<number, TransformNode>(), lastPos = new Map<number, V3>();
const burning: { p: V3; t: number }[] = [];
let interMesh: Mesh, dotMesh: Mesh;
function makeProcedural() {
  const body = MeshBuilder.CreateCylinder('ib', { height: 4.6, diameter: 0.41, tessellation: 12 }, scene); body.rotation.x = Math.PI / 2;
  const nose = MeshBuilder.CreateCylinder('in', { height: 0.9, diameterTop: 0, diameterBottom: 0.41, tessellation: 12 }, scene); nose.rotation.x = Math.PI / 2; nose.position.z = 2.75;
  interMesh = Mesh.MergeMeshes([body, nose], true, true)!; const im = new StandardMaterial('interMat', scene); im.diffuseColor = new Color3(0.9, 0.9, 0.86); interMesh.material = im; interMesh.isVisible = false;
  dotMesh = MeshBuilder.CreatePlane('dot', { size: 1 }, scene); const dm = new StandardMaterial('dotMat', scene);
  dm.emissiveTexture = texFlare; dm.opacityTexture = texFlare; dm.emissiveColor = new Color3(4, 2.8, 1.4); dm.disableLighting = true; dm.alphaMode = Engine.ALPHA_ADD; dm.fogEnabled = false;
  dotMesh.material = dm; dotMesh.billboardMode = Mesh.BILLBOARDMODE_ALL; dotMesh.isVisible = false;
}
function syncUnits() {
  for (const u of W.units) {
    let n = unitNodes.get(u.id);
    if (!n) {
      n = spawnModel(u.kind); unitNodes.set(u.id, n);
      const blob = MeshBuilder.CreateGround('blob', { width: 1, height: 1 }, scene); blob.material = blobMat; blob.parent = n; blob.position.y = 0.5; blob.isPickable = false;
      const s = u.kind === 'patriot' ? 26 : u.kind === 'dshk' ? 3 : u.kind === 'd30' ? 7 : 10; blob.scaling.set(s * 0.55, 1, s);
    }
    n.position.set(u.p[0], 0, u.p[2]);
    if (u.alive) n.rotation.y = lerpAngle(n.rotation.y, u.yaw, 0.15);
  }
}
const lerpAngle = (a: number, b: number, t: number) => { let d = b - a; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return a + d * t; };
function syncAir(simDt: number) {
  const seen = new Set<number>();
  for (const a of W.air) {
    seen.add(a.id);
    let n = airNodes.get(a.id);
    if (!n) {
      n = new TransformNode('air' + a.id, scene);
      if (a.kind === 'shahed' || a.kind === 'kh101') { const m = spawnModel(a.kind); m.parent = n; }
      else if (a.kind === 'pac2') { const m = interMesh.createInstance('pi' + a.id); m.parent = n; const g = dotMesh.createInstance('pg' + a.id); g.parent = n; g.position.z = -3; g.scaling.setAll(4); g.billboardMode = Mesh.BILLBOARDMODE_ALL; }
      else { const g = dotMesh.createInstance('d' + a.id); g.parent = n; g.scaling.setAll(a.kind === 'rocket' ? 3 : 2); g.billboardMode = Mesh.BILLBOARDMODE_ALL; }
      airNodes.set(a.id, n);
    }
    n.position.set(a.p[0], a.p[1], a.p[2]);
    if (len(a.v) > 1) n.lookAt(n.position.add(v(a.v)));
    // آثار الدخان بين الموقع السابق والحالي
    const prev = lastPos.get(a.id) ?? a.p, dd = len(sub(a.p, prev));
    if (a.kind === 'pac2') pacTrail.emit({ a: prev, b: a.p, n: Qn(dd * 0.55), jit: 0.6, spd: [0, 1.5] });
    if (a.kind === 'rocket') rocketTrail.emit({ a: prev, b: a.p, n: Qn(dd * 0.12), jit: 0.3, spd: [0, 1] });
    lastPos.set(a.id, [...a.p] as V3);
  }
  for (const [id, n] of airNodes) if (!seen.has(id)) { n.dispose(); airNodes.delete(id); lastPos.delete(id); }
  void simDt;
}
function handleFx(fx: Fx) {
  const camD = (p: V3) => Vector3.Distance(camTarget, v(p));
  switch (fx.k) {
    case 'muzzle': muzzle.emit({ a: fx.p, n: fx.big ? 3 : 1, jit: 0.3 }); if (fx.big) { dust.emit({ a: fx.p, n: Qn(4), spd: [3, 8], up: 0.2, jit: 2 }); sfx.shot(camD(fx.p)); } else sfx.rattle(camD(fx.p)); break;
    case 'tracer': { const d = norm(sub(fx.b, fx.a)), L = len(sub(fx.b, fx.a)), sp = fx.n > 1 ? 850 : 1650;
      for (let i = 0; i < fx.n; i++) tracers.emit({ a: add(fx.a, scale(d, -i * 9)), n: 1, dir: d, spd: [sp, sp], life: L / sp, jit: fx.n > 1 ? 1.5 : 0.1 }); break; }
    case 'boom': {
      const s = fx.size, big = s >= 1.3, P = big ? fireL : fireS;
      P.emit({ a: fx.p, n: Qn(big ? 70 * s : 26 * s + 6), spd: [10 * s, 45 * s], jit: 2 * s, up: fx.air ? 0 : 0.35 });
      (big ? smokeL : smokeS).emit({ a: fx.p, n: Qn(big ? 40 * s : 16 * s + 4), spd: [3 * s, 14 * s], jit: 3 * s, up: fx.air ? 0 : 0.5 });
      sparks.emit({ a: fx.p, n: Qn(30 * s), spd: [40, 150 * s], jit: 1 });
      if (!fx.air) { dust.emit({ a: fx.p, n: Qn(14 * s + 4), spd: [8, 26 * s], up: 0.1, jit: 3 }); addDecal(fx.p, 10 + 14 * s); }
      trauma = Math.min(1, trauma + clamp(0.5 - camD(fx.p) / 6000, 0, 0.5) * s);
      sfx.boom(camD(fx.p), s); break;
    }
    case 'launch': launchCloud.emit({ a: fx.p, n: Qn(40), spd: [4, 18], up: 0.1, jit: 2 }); fireS.emit({ a: fx.p, n: 10, spd: [5, 20], jit: 1 }); sfx.launch(camD(fx.p)); break;
    case 'kill': { const u = W.units.find(x => x.id === fx.unit)!, n = unitNodes.get(fx.unit); burning.push({ p: [...u.p] as V3, t: W.T });
      if (n) { n.rotation.z = (Math.random() - 0.5) * 0.15; n.rotation.x = (Math.random() - 0.5) * 0.1; n.position.y = -0.3; } addDecal(u.p, 16); break; }
    case 'mark': marks.push({ p: fx.p, text: fx.text, good: fx.good, t: performance.now() }); break;
  }
}
function burnFx(simDt: number) {
  for (const b of burning) { const age = W.T - b.t, k = clamp(1 - age / 160, 0.25, 1);
    burnSmoke.emit({ a: add(b.p, [0, 2, 0]), n: Qn(10 * simDt * k * 3) , spd: [3, 6], dir: norm([0.12, 1, 0.06]), jit: 2 });
    burnFire.emit({ a: add(b.p, [0, 1.5, 0]), n: Qn(10 * simDt * k * 2), spd: [1, 4], up: 1, jit: 1.5 }); }
}

// ===== البطاقات (أسماء فوق الأشياء) =====
const layer = $('labels');
interface Item { key: string; text: string; cls: string; p: V3; prio: number; follow?: number }
const els = new Map<string, HTMLElement>();
let marks: { p: V3; text: string; good: boolean; t: number }[] = [];
let selected = 0;
function labelItems(): Item[] {
  const out: Item[] = [], near = camDist < 6500;
  for (const s of SITES) out.push({ key: 's' + s.id, text: s.name, cls: 'site', p: add(s.p, [0, 30, 0]), prio: 1 });
  if (near) for (const u of W.units) out.push({ key: 'u' + u.id, text: u.alive ? `${u.name} · ${SIDE_AR[u.side]}` : `${u.name} (محطّم)`, cls: `${u.side}${u.alive ? '' : ' dead'}`, p: add(u.p, [0, u.kind === 'patriot' ? 16 : 9, 0]), prio: u.alive ? 3 : 0, follow: u.id });
  else { // من بعيد: مجموعات
    const groups = new Map<string, Unit[]>(); for (const u of W.units) if (u.alive) { const k = u.side + '|' + u.group; groups.set(k, [...(groups.get(k) ?? []), u]); }
    for (const [k, us] of groups) { const c = us.reduce((s, u) => add(s, u.p), [0, 0, 0] as V3); out.push({ key: 'g' + k, text: `${k.split('|')[1]}${us.length > 1 ? ' ×' + us.length : ''}`, cls: `${us[0].side} group`, p: add(scale(c, 1 / us.length), [0, 20, 0]), prio: 3, follow: us[0].id }); }
  }
  for (const a of W.air) {
    if (a.kind === 'shahed' || a.kind === 'kh101') out.push({ key: 'a' + a.id, text: `${AIR_AR[a.kind]} · ${SIDE_AR[a.side]} ← ${a.siteName}`, cls: `${a.side} air`, p: add(a.p, [0, 12, 0]), prio: 5, follow: a.id });
    else if (a.kind === 'pac2') out.push({ key: 'a' + a.id, text: 'معترض PAC-2 · باتريوت', cls: 'iq air', p: add(a.p, [0, 10, 0]), prio: 4, follow: a.id });
  }
  const rk = W.air.filter(a => a.kind === 'rocket'); if (rk.length) { const c = rk.reduce((s, a) => add(s, a.p), [0, 0, 0] as V3); out.push({ key: 'rk', text: `رشقة غراد ×${rk.length}`, cls: 'en air', p: scale(c, 1 / rk.length), prio: 4 }); }
  const now = performance.now(); marks = marks.filter(m => now - m.t < 4200);
  for (const m of marks) out.push({ key: 'm' + m.t + m.text, text: m.text, cls: `mark ${m.good ? 'good' : 'bad'}`, p: add(m.p, [0, (now - m.t) / 1000 * 18, 0]), prio: 9 });
  return out;
}
const tmpV = new Vector3();
function drawLabels() {
  const items = labelItems().sort((a, b) => b.prio - a.prio), tm = scene.getTransformMatrix(), vp = cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const sc = engine.getHardwareScalingLevel(), W_ = canvas.clientWidth, H_ = canvas.clientHeight, placed: number[][] = [], used = new Set<string>();
  for (const it of items) {
    Vector3.ProjectToRef(v(it.p), Matrix.IdentityReadOnly, tm, vp, tmpV);
    const x = tmpV.x * sc, y = tmpV.y * sc;
    if (tmpV.z < 0 || tmpV.z > 1 || x < -60 || x > W_ + 60 || y < 40 || y > H_ - 20) continue;
    const w = it.text.length * 6.2 + 22, h = 20, r = [x - w / 2, y - h, x + w / 2, y];
    if (it.prio < 9 && placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) continue;
    placed.push(r); used.add(it.key);
    let el = els.get(it.key);
    if (!el) { el = document.createElement('div'); el.innerHTML = '<i></i><span></span>'; layer.appendChild(el); els.set(it.key, el);
      if (it.follow) { const id = it.follow; el.addEventListener('click', () => { setAuto(false); startFollow(id); }); } }
    const cls = 'lb ' + it.cls + (it.follow && it.follow === selected ? ' sel' : '');
    if (el.className !== cls) el.className = cls;
    const sp = el.lastChild as HTMLElement; if (sp.textContent !== it.text) sp.textContent = it.text;
    el.style.transform = `translate(${(x - w / 2).toFixed(0)}px,${(y - h).toFixed(0)}px)`; el.style.display = '';
  }
  for (const [k, el] of els) if (!used.has(k)) { if (k.startsWith('m') || k === 'rk' || k.startsWith('a') || k.startsWith('g')) { el.remove(); els.delete(k); } else el.style.display = 'none'; }
}

// ===== التتبّع (ضغطة على اسم) =====
function findEntity(id: number): { p: V3; vel?: V3; air: boolean; name: string; info: string } | null {
  const u = W.units.find(x => x.id === id);
  if (u) return { p: add(u.p, [0, 2, 0]), air: false, name: `${u.name} · ${SIDE_AR[u.side]}`, info: u.alive ? `${u.group} · ${u.moving ? 'يتحرك' : 'بموقعه'}` : 'محطّمة' };
  const a = W.air.find(x => x.id === id);
  if (a) return { p: a.p, vel: a.v, air: true, name: `${AIR_AR[a.kind]} · ${SIDE_AR[a.side]}`, info: `${Math.round(len(a.v) * 3.6).toLocaleString('en')} كم/س · ارتفاع ${Math.round(a.p[1])} م${a.siteName ? ' · الهدف: ' + a.siteName : ''}` };
  return null;
}
function startFollow(id: number) {
  const f = findEntity(id); if (!f) return;
  view.follow = id; selected = id; view.fDist = f.air ? 38 : 34; followBlend = 0; followFrom = camTarget.clone();
  const a = W.air.find(x => x.id === id); if (a) view.yaw = Math.atan2(a.v[0], a.v[2]);
  ($('follow') as HTMLElement).hidden = false; ($('bottom') as HTMLElement).hidden = true;
}
function endFollow() { view.follow = 0; selected = 0; ($('follow') as HTMLElement).hidden = true; ($('bottom') as HTMLElement).hidden = !running; view.dist = Math.max(view.dist, 1500); }
function followPanel() {
  if (!view.follow) return; const f = findEntity(view.follow);
  if (!f) { $('fInfo').textContent = 'انتهى (انفجر أو اعتُرض)'; setTimeout(() => { if (view.follow && !findEntity(view.follow)) endFollow(); }, 1500); return; }
  $('fName').textContent = f.name; $('fInfo').textContent = f.info;
}

// ===== المخرج التلقائي: الكاميرا تروح للأحداث المهمة =====
let auto = true, autoUntil = 0, pendingPac = 0;
function setAuto(on: boolean) { auto = on; $('bAuto').setAttribute('aria-pressed', String(on)); if (on) { autoUntil = 0; directorIdle(); } }
function directorIdle() { if (!auto || view.follow) return; view.tx = -4600; view.tz = -700; view.dist = 5200; view.yaw = 0.25; }
function shotAt(p: V3, dist: number, holdMs: number, force = false) {
  const now = performance.now(); if (!auto || (!force && now < autoUntil)) return;
  if (view.follow) endFollow(); view.tx = p[0]; view.tz = p[2]; view.dist = dist; autoUntil = now + holdMs;
}
function directorFx(fx: Fx) {
  if (!auto) return;
  if (fx.k === 'launch' && dist2d(fx.p, PATRIOT_POS) < 60 && performance.now() > autoUntil - 2000) { pendingPac = performance.now() + 250; }
  if (fx.k === 'mark') shotAt(fx.p, fx.good ? 1100 : 1300, 4500 / Math.max(1, simSpeed / 2));
}
function directorFrame() {
  if (!auto || !W) return;
  if (pendingPac && performance.now() > pendingPac) { pendingPac = 0; const a = [...W.air].reverse().find(x => x.kind === 'pac2'); if (a) { startFollow(a.id); autoUntil = performance.now() + 9000 / Math.max(1, simSpeed / 2); return; } }
  if (view.follow && performance.now() > autoUntil && !findEntity(view.follow)) endFollow();
  if (!view.follow && performance.now() > autoUntil + 3500) { directorIdle(); autoUntil = performance.now() + 2000; }
}
// علامات ملونة على الأرض تحت كل وحدة (تبين من بعيد)
const markIq = new StandardMaterial('mIq', scene), markEn = new StandardMaterial('mEn', scene);
for (const [m, c] of [[markIq, new Color3(0.37, 0.75, 0.48)], [markEn, new Color3(0.88, 0.33, 0.24)]] as [StandardMaterial, Color3][]) { m.emissiveColor = c; m.disableLighting = true; m.backFaceCulling = false; m.fogEnabled = false; }
const unitMarks = new Map<number, Mesh>();
function syncMarks() {
  const k = smooth(900, 3500, camDist), sz = camDist * 0.0085;
  for (const u of W.units) {
    let m = unitMarks.get(u.id);
    if (!m) { m = MeshBuilder.CreateDisc('mk', { radius: 1, tessellation: u.side === 'iq' ? 24 : 4 }, scene); m.material = u.side === 'iq' ? markIq : markEn; m.isPickable = false; m.billboardMode = Mesh.BILLBOARDMODE_ALL; m.renderingGroupId = 1; unitMarks.set(u.id, m); }
    m.position.set(u.p[0], 3, u.p[2]); m.scaling.setAll(Math.max(0.01, sz * k)); m.isVisible = k > 0.02 && u.alive;
  }
}

// ===== الشريط السفلي =====
let tickN = -1;
function hud() {
  const s = W.stats, mm = `${Math.floor(W.T / 60)}:${String(Math.floor(W.T % 60)).padStart(2, '0')}`;
  $('clock').textContent = mm;
  $('phase').textContent = W.air.some(a => a.kind === 'shahed' && a.alive) ? 'مسيّرات فوق المدينة' : W.air.some(a => a.kind === 'kh101' && a.alive) ? 'صواريخ كروز بالجو' : W.units.some(u => u.side === 'en' && u.moving && u.alive) ? 'رتل مدرّع يتقدم' : 'الجو والأرض';
  $('tally').innerHTML = `<span>مسيّرات <b>${s.drones}</b> · <b class="g">${s.dronesDown}</b> أُسقطت · <b class="x">${s.dronesHit}</b> أصابت</span>`
    + `<span>كروز <b>${s.cruise}</b> · <b class="g">${s.cruiseDown}</b> اعتُرض${s.cruiseHit ? ` · <b class="x">${s.cruiseHit}</b> أصاب` : ''}</span>`
    + `<span>دبابات العدو <b>${s.enTanks}</b> · <b class="g">${s.enTanksLost}</b> دُمّرت</span><span>أبرامز <b>${s.iqTanks - s.iqTanksLost}</b>/${s.iqTanks} سليمة</span>`;
  if (W.log.length !== tickN) {
    tickN = W.log.length;
    $('ticker').innerHTML = W.log.slice(-3).map((l, i) => `<button data-i="${W.log.length - 3 + i}"><span class="t">${Math.floor(l.t / 60)}:${String(Math.floor(l.t % 60)).padStart(2, '0')}</span><b class="${l.good === true ? 'g' : l.good === false ? 'x' : 'n'}">${l.good === true ? '✓' : l.good === false ? '✗' : '•'}</b><span>${l.text}</span></button>`).join('');
  }
}
$('ticker').addEventListener('click', e => { setAuto(false); const b = (e.target as HTMLElement).closest('button'); if (!b) return; const l = W.log[+b.dataset.i!]; if (l) { endFollow(); view.tx = l.p[0]; view.tz = l.p[2]; view.dist = 1800; } });

// ===== الحلقة =====
let running = false, endShown = false, acc = 0;
const fpsEl = $('fps'); let fpsAcc = 0, fpsN = 0, fpsT = 0;
function frame() {
  const dtReal = Math.min(engine.getDeltaTime() / 1000, 0.1);
  let simDt = 0;
  if (running && simSpeed > 0) {
    acc += dtReal * simSpeed; const STEP = 1 / 60; let n = 0;
    while (acc >= STEP && n < 16) { step(W, STEP); acc -= STEP; simDt += STEP; n++; for (const f of W.fx) { handleFx(f); directorFx(f); } W.fx.length = 0; }
    if (n === 16) acc = 0;
  }
  if (W) { syncUnits(); syncMarks(); syncAir(simDt); if (simDt) burnFx(simDt); directorFrame(); }
  const k = simDt ? simDt / Math.max(1e-4, engine.getDeltaTime() / 1000) : 0;
  for (const p of pools) p.ps.updateSpeed = k / 60;
  updateCamera(dtReal);
  scene.render();
  for (const p of pools) p.flush();
  if (W) { drawLabels(); followPanel(); hud(); const sh = W.air.filter(a => a.kind === 'shahed'); sfx.drones(sh.length ? Math.min(...sh.map(a => Vector3.Distance(camTarget, v(a.p)))) : 1e9); }
  if (W?.over && !endShown) { endShown = true; setTimeout(showEnd, 2500); }
  fpsAcc += engine.getFps(); fpsN++; fpsT += dtReal;
  if (fpsT > 0.5) { fpsEl.textContent = `${(fpsAcc / fpsN).toFixed(0)} FPS`; fpsAcc = fpsN = fpsT = 0; }
  (window as any).__state = { T: W?.T ?? 0, over: W?.over, stats: W?.stats, dist: camDist, follow: view.follow, fps: engine.getFps(), log: W?.log.length };
}
function showEnd() {
  const s = W.stats;
  $('endTitle').textContent = s.enTanksLost >= 3 ? 'انصد الهجوم' : 'المعركة انتهت';
  $('endSum').innerHTML = `<div>المسيّرات<b>${s.dronesDown} من ${s.drones} أُسقطت</b></div><div>صواريخ الكروز<b>${s.cruiseDown} من ${s.cruise} اعتُرضت</b></div>`
    + `<div>دبابات العدو<b>${s.enTanksLost} من ${s.enTanks} دُمّرت</b></div><div>خسائرنا<b>${W.units.filter(u => u.side === 'iq' && !u.alive).length} وحدة</b></div>`
    + `<div>معترضات باتريوت<b>${s.pacFired}</b></div><div>صواريخ غراد سقطت<b>${s.rockets}</b></div>`;
  ($('end') as HTMLElement).hidden = false;
}
function toast(m: string) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout((toast as any).h); (toast as any).h = setTimeout(() => t.classList.remove('show'), 2600); }
function start() {
  sfx.init();
  for (const n of unitNodes.values()) n.dispose(); unitNodes.clear(); for (const n of airNodes.values()) n.dispose(); airNodes.clear(); lastPos.clear();
  burning.length = 0; marks = []; decals = []; decal.thinInstanceSetBuffer('matrix', new Float32Array(16), 16, false); decal.thinInstanceCount = 0;
  for (const el of els.values()) el.remove(); els.clear(); pools.forEach(p => p.ps.reset());
  for (const m of unitMarks.values()) m.dispose(); unitMarks.clear();
  W = newWorld(11); running = true; endShown = false; tickN = -1; homeView(); setAuto(true);
  for (const id of ['intro', 'end']) ($(id) as HTMLElement).hidden = true;
  for (const id of ['top', 'bottom', 'sideBtns', 'fps']) ($(id) as HTMLElement).hidden = false;
}
document.querySelectorAll<HTMLButtonElement>('#spd button').forEach(b => b.onclick = () => { simSpeed = +b.dataset.s!; document.querySelectorAll('#spd button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
$('bStart').onclick = start; $('bAgain').onclick = start;
$('bExplore').onclick = () => { ($('end') as HTMLElement).hidden = true; toast('حرّك الخريطة واضغط على أي اسم'); };
$('bBack').onclick = () => { setAuto(false); endFollow(); }; $('bHome').onclick = () => { setAuto(false); homeView(); };
$('bAuto').onclick = () => setAuto(!auto);
$('bRotL').onclick = () => (view.yaw += 0.5); $('bRotR').onclick = () => (view.yaw -= 0.5);
$('bMute').onclick = () => ($('bMute').textContent = sfx.toggle() ? '🔇' : '🔊');
$('bCred').onclick = () => (($('credits') as HTMLElement).hidden = false); $('bCredClose').onclick = () => (($('credits') as HTMLElement).hidden = true);
window.addEventListener('resize', () => engine.resize());
(window as any).__follow = startFollow; (window as any).__getW = () => W; (window as any).__view = view; (window as any).__scene = scene;

(async () => {
  const load = $('load');
  try {
    keepClear = newWorld(11).units.map(u => u.p);
    buildGround(); buildRiverAndRoads(); buildCity(); makeProcedural();
    await loadModels(t => (load.textContent = t));
    W = newWorld(11); syncUnits();
    await scene.whenReadyAsync();
    load.textContent = 'جاهز.'; ($('bStart') as HTMLButtonElement).disabled = false;
    engine.runRenderLoop(frame);
    if (AUTO) start();
  } catch (e) { load.textContent = 'صار خطأ بالتحميل: ' + (e as Error).message; console.error(e); }
})();
