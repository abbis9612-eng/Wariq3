// مسرح العمليات (غرب بغداد) v3 — رسم Babylon.js فوق منطق sim.ts. الأرض: world.ts + land.ts (I-027)
// v2: كاميرا تجمع الطرفين + أسهم الحافة + خريطة مصغّرة (I-018)، إطلاق ساخن/بارد مرئي ووضوح الصواريخ (I-014، I-017، I-019)،
//     دوشكا طلقة طلقة (I-015)، كاميرا الإصابة والدمار وبطاقة الثمن (I-012)، أضواء انفجارات وظلال (I-021)، أوامر (I-020)
import {
  Engine, Scene, Vector3, Color3, Color4, FreeCamera, HemisphericLight, DirectionalLight, PointLight, ShadowGenerator, MeshBuilder, Mesh,
  StandardMaterial, PBRMaterial, DynamicTexture, ParticleSystem, TransformNode, VertexBuffer, DefaultRenderingPipeline, ImageProcessingConfiguration,
  LoadAssetContainerAsync, AssetContainer, Matrix, Particle, BaseTexture, Texture, Quaternion, AbstractMesh,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { SkyMaterial } from '@babylonjs/materials/sky';
import { CustomMaterial } from '@babylonjs/materials/custom';
import {
  V3, add, sub, scale, len, norm, lerp, clamp, rng, World, newWorld, step, order, Order, ORDER_CD, Unit, Air, Fx, SITES, riverX, RIVER_W, CITY_R,
  HIGHWAY_Z, BERMS, AIR_AR, SIDE_AR, PATRIOT_POS, S400_POS, S400_SCALE, dist2d, site, angDiff,
} from './sim';
import { groundH, groundN, ROADS } from './land';
import { buildWorld, loadHeight, bldMatrix, Bld, SiteProp } from './world';

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
const texScorch = canvasTex('scorch', 64, radial([[0, 'rgba(18,14,10,.9)'], [0.45, 'rgba(32,26,18,.6)'], [1, 'rgba(40,30,20,0)']]));
const texSmoke = canvasTex('smoke', 128, (g, s) => {
  for (let i = 0; i < 22; i++) { const a = R() * 6.28, r = R() * s * 0.22, x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r, rad = s * (0.12 + R() * 0.16), k = 0.75 + R() * 0.25;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${255 * k | 0},${255 * k | 0},${255 * k | 0},.5)`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'destination-in'; radial([[0, 'rgba(0,0,0,1)'], [0.3, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']])(g, s);
});
const texUrls = import.meta.glob('../textures/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
// الأرض والقرى والمواقع تنبني بـ world.ts؛ هنا نحتفظ بالبيوت والمعالم حتى ندمّرها وقت القصف
let bld: Mesh, bldMat: Float32Array, bldCol: Float32Array, bldInfo: Bld[] = [];
let keepClear: V3[] = [];
let siteProps: SiteProp[] = [];

// ===== الكاميرا: مايلة من فوق، تجمع الطرفين، تلاحق، ولقطة إصابة =====
const cam = new FreeCamera('cam', new Vector3(0, 3000, -3000), scene);
cam.inputs.clear(); cam.minZ = 2; cam.maxZ = 70000; cam.fov = 0.8;
const view = { tx: -2600, tz: -450, dist: 3000, yaw: 0, pitch: -1, follow: 0, fDist: 0 };
const pitchFor = (d: number) => lerp(0.5, 1.0, smooth(250, 6500, d));
let camTarget = new Vector3(view.tx, 0, view.tz), camDist = view.dist, camPitch = pitchFor(view.dist), camYaw = 0;
let trauma = 0, shakeT = 0, followBlend = 1, followFrom = new Vector3(), targetY = 0;
const portrait = () => canvas.clientWidth < canvas.clientHeight;
function updateCamera(dt: number) {
  const k = 1 - Math.exp(-dt * 5);
  let tgt = new Vector3(view.tx, groundH(view.tx, view.tz) + targetY, view.tz), want = view.dist, pitch = view.pitch > 0 ? view.pitch : pitchFor(view.dist);
  const f = view.follow ? findEntity(view.follow) : null;
  if (f) { tgt = v(f.p); want = view.fDist; pitch = f.air ? 0.2 : 0.42; view.tx = tgt.x; view.tz = tgt.z;
    if (f.air && f.vel && len(f.vel) > 5) view.yaw = camYaw + angDiff(camYaw, Math.atan2(f.vel[0], f.vel[2])) * (1 - Math.exp(-dt * 2)); }
  if (f) { followBlend = Math.min(1, followBlend + dt / 0.8); const e = followBlend * followBlend * (3 - 2 * followBlend); camTarget = Vector3.Lerp(followFrom, tgt, e); if (followBlend < 1) followFrom = Vector3.Lerp(followFrom, tgt, k * 0.5); }
  else camTarget = Vector3.Lerp(camTarget, tgt, k);
  camDist = lerp(camDist, want, k); camPitch = lerp(camPitch, pitch, k); camYaw = camYaw + angDiff(camYaw, view.yaw) * k;
  // الشاشة بالطول: نثبت الزاوية الأفقية حتى ما يطلع الهدف برّا
  cam.fovMode = portrait() ? FreeCamera.FOVMODE_HORIZONTAL_FIXED : FreeCamera.FOVMODE_VERTICAL_FIXED; cam.fov = portrait() ? 0.95 : 0.8;
  const cp = Math.cos(camPitch) * camDist, pos = new Vector3(camTarget.x - Math.sin(camYaw) * cp, camTarget.y + Math.sin(camPitch) * camDist, camTarget.z - Math.cos(camYaw) * cp);
  pos.y = Math.max(pos.y, groundH(pos.x, pos.z) + 4);
  // إذا تلّة تسد النظر بين الكاميرا والهدف، نرفع الكاميرا
  for (let it = 0; it < 7; it++) { let blocked = false; for (let q = 0.12; q < 0.95; q += 0.11) { const x = lerp(pos.x, camTarget.x, q), z = lerp(pos.z, camTarget.z, q); if (groundH(x, z) + 2.5 > lerp(pos.y, camTarget.y, q)) { blocked = true; break; } } if (!blocked) break; pos.y += camDist * 0.07 + 2; }
  trauma = Math.max(0, trauma - dt * 1.4); shakeT += dt * 30;
  const sh = trauma * trauma * camDist * 0.007;
  cam.position.copyFrom(pos);
  cam.setTarget(camTarget.add(new Vector3(Math.sin(shakeT * 1.7) * sh, Math.sin(shakeT * 2.3) * sh, Math.sin(shakeT * 1.1) * sh)));
  // الظلال تتبع مكان الكاميرا
  if (shadows) { const on = camDist < 1100; sun.shadowEnabled = on; if (on) { sun.position = camTarget.add(v(scale(SUN, 700))); sun.shadowFrustumSize = clamp(camDist * 1.3, 90, 1300); } }
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
    const s = (camDist * 2 * Math.tan(0.4)) / canvas.clientHeight, fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    view.tx += (-dx * fz + dy * fx / Math.sin(camPitch) * 0.9) * s; view.tz += (dx * fx + dy * fz / Math.sin(camPitch) * 0.9) * s;
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
function zoomBy(f: number) { if (view.follow) view.fDist = clamp(view.fDist * f, 25, 1500); else { view.pitch = -1; view.dist = clamp(view.dist * f, 120, 9000); } }

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
const MODEL: Record<string, { scale: number; yaw: number; y?: number }> = {
  // y: المجسم الأصلي نازل تحت الأرض (الجنزير عند -0.8م)؛ T-72 مدفعها على -z بالملف فندوّرها
  abrams: { scale: 1, yaw: 0, y: 0.8 }, t72: { scale: 1, yaw: Math.PI, y: 0.8 }, technical: { scale: 0.8, yaw: 0 }, dshk: { scale: 0.11, yaw: 0, y: 0.5 },
  d30: { scale: 0.22, yaw: Math.PI }, grad: { scale: 1, yaw: 0 }, patriot: { scale: 1, yaw: 0 }, s400: { scale: S400_SCALE, yaw: 0, y: 0.502 * S400_SCALE },
  shahed: { scale: 1.45, yaw: 0 }, kh101: { scale: 1, yaw: Math.PI },
};
const containers: Record<string, AssetContainer> = {};
async function loadModels(progress: (t: string) => void) {
  const names = Object.keys(MODEL); let done = 0;
  await Promise.all(names.map(async n => {
    const c = await LoadAssetContainerAsync(modelUrl(n), scene, { pluginExtension: '.gltf' });
    c.materials.forEach(m => { if (m instanceof PBRMaterial) { m.environmentIntensity = 0; m.directIntensity = PBR_DIRECT; m.metallic = Math.min(m.metallic ?? 1, 0.15); /* بدون بيئة انعكاس المعدن يطلع أسود */ m.maxSimultaneousLights = 2 + NL; } });
    c.addAllToScene(); c.meshes.forEach(m => { m.isVisible = false; m.isPickable = false; });
    containers[n] = c; progress(`يحمّل المجسمات… ${++done}/${names.length}`);
  }));
}
const blobMat = new StandardMaterial('blobMat', scene); blobMat.diffuseTexture = texBlob; blobMat.opacityTexture = texBlob; blobMat.disableLighting = true; blobMat.emissiveColor = Color3.Black(); blobMat.specularColor = Color3.Black();
function spawnModel(kind: string, wreck = false) {
  const root = new TransformNode('u_' + kind, scene), inner = new TransformNode('in', scene); inner.parent = root;
  const spec = MODEL[kind]; inner.rotation.y = spec.yaw; inner.scaling.setAll(spec.scale); inner.position.y = spec.y ?? 0;
  const inst = containers[kind].instantiateModelsToScene(n => n, wreck, { doNotInstantiate: wreck });
  inst.rootNodes.forEach(r => { r.parent = inner; });
  root.getChildMeshes().forEach(m => { m.isPickable = false; m.isVisible = true; if (!wreck || true) caster(m); if (wreck && m.material instanceof PBRMaterial) { m.material.albedoColor = new Color3(0.09, 0.085, 0.08); m.material.metallic = 0; m.material.roughness = 1; m.material.emissiveColor = Color3.Black(); } });
  return { root, inner };
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
const smokeL = new Pool('smokeL', 1400, texCloud, false, { sheet: SH_CLOUD,  life: [9, 14], size: [[0, 8], [0.25, 26], [1, 48]], damp: 0.9, gravity: 1.2, colors: [[0, C4(0.36, 0.32, 0.27, 0)], [0.05, C4(0.34, 0.3, 0.26, 0.7)], [0.5, C4(0.5, 0.47, 0.42, 0.4)], [1, C4(0.62, 0.6, 0.56, 0)]] });
const dust = new Pool('dust', 2200, texSmoke, false, { life: [2, 4.5], size: [[0, 2.5], [1, 14]], damp: 0.86, gravity: 0.5, colors: [[0, C4(0.72, 0.6, 0.44, 0)], [0.06, C4(0.7, 0.58, 0.43, 0.7)], [1, C4(0.78, 0.68, 0.55, 0)]] });
const trackDust = new Pool('trackDust', 900, texSmoke, false, { life: [1.5, 3], size: [[0, 1.5], [1, 6]], damp: 0.9, gravity: 0.2, colors: [[0, C4(0.72, 0.62, 0.47, 0)], [0.1, C4(0.72, 0.62, 0.47, 0.32)], [1, C4(0.78, 0.7, 0.58, 0)]] });
const sparks = new Pool('sparks', 1000, texSoft, true, { life: [0.4, 1.2], size: [[0, 1], [1, 0.35]], gravity: -9.8, stretched: true, colors: [[0, C4(5, 4, 2.4, 1)], [0.6, C4(3, 1.2, 0.3, 0.9)], [1, C4(1, 0.2, 0, 0)]] });
const muzzle = new Pool('muzzle', 600, texFlare, true, { life: [0.04, 0.09], size: [[0, 2.5], [1, 4]], colors: [[0, C4(7, 5.5, 3, 1)], [1, C4(3, 1.4, 0.3, 0)]] });
const tracers = new Pool('tracers', 900, texSoft, true, { life: [0.4, 0.4], size: [[0, 0.8], [1, 0.8]], stretched: true, colors: [[0, C4(7, 4, 1.4, 1)], [1, C4(6, 3, 0.8, 1)]] });
const casings = new Pool('casings', 600, texSoft, false, { life: [0.5, 0.8], size: [[0, 0.22], [1, 0.22]], gravity: -9.8, stretched: true, colors: [[0, C4(0.95, 0.75, 0.3, 1)], [1, C4(0.8, 0.6, 0.25, 1)]] });
const puffs = new Pool('puffs', 900, texSmoke, false, { life: [0.4, 1], size: [[0, 0.6], [1, 2.5]], colors: [[0, C4(0.8, 0.78, 0.74, 0.5)], [1, C4(0.8, 0.78, 0.74, 0)]] });
const flame = new Pool('flame', 1600, texFlare, true, { life: [0.05, 0.12], size: [[0, 2.2], [1, 0.6]], colors: [[0, C4(7, 5.5, 3.2, 1)], [0.5, C4(4, 1.8, 0.4, 0.8)], [1, C4(0.8, 0.2, 0.02, 0)]] });
const rocketTrail = new Pool('rocketTrail', 3500, texSmoke, false, { life: [2.5, 4.5], size: [[0, 0.9], [1, 6]], colors: [[0, C4(0.85, 0.82, 0.78, 0)], [0.05, C4(0.8, 0.78, 0.75, 0.55)], [1, C4(0.8, 0.78, 0.75, 0)]], gravity: 0.5 });
const bigTrail = new Pool('bigTrail', 6000, texSmoke, false, { life: [12, 18], size: [[0, 2.2], [0.2, 6.5], [1, 15]], colors: [[0, C4(1, 0.92, 0.8, 0)], [0.02, C4(0.97, 0.96, 0.94, 0.8)], [1, C4(0.85, 0.86, 0.88, 0)]], gravity: 0.4 });
const thinTrail = new Pool('thinTrail', 2500, texSmoke, false, { life: [5, 8], size: [[0, 2], [1, 7]], colors: [[0, C4(0.8, 0.8, 0.8, 0)], [0.04, C4(0.85, 0.85, 0.85, 0.45)], [1, C4(0.9, 0.9, 0.9, 0)]] });
const burnSmoke = new Pool('burnSmoke', 2600, texCloud, false, { sheet: SH_CLOUD,  life: [8, 14], size: [[0, 3], [0.3, 13], [1, 32]], colors: [[0, C4(0.12, 0.1, 0.09, 0)], [0.05, C4(0.1, 0.09, 0.08, 0.85)], [1, C4(0.4, 0.39, 0.38, 0)]] });
const burnFire = new Pool('burnFire', 600, texFlame, true, { sheet: { cw: 64, ch: 128, n: 64, rand: true, sy: 2 },  life: [0.3, 0.7], size: [[0, 2], [1, 4.5]], colors: [[0, C4(5, 3, 1.2, 0.9)], [1, C4(1.2, 0.3, 0.05, 0)]] });
const EXC: [number, Color4][] = [[0, C4(1.5, 1.4, 1.3, 1)], [0.75, C4(1, 1, 1, 0.95)], [1, C4(1, 1, 1, 0)]], SH_EX = { cw: 200, ch: 200, n: 25, speed: 1 };
const exS = new Pool('exS', 80, texExplo2, false, { sheet: SH_EX, life: [1.3, 1.7], size: [[0, 9], [1, 15]], colors: EXC, gravity: 1, spin: 0.15 });
const exM = new Pool('exM', 60, texExplo1, false, { sheet: SH_EX, life: [1.8, 2.3], size: [[0, 20], [1, 32]], colors: EXC, gravity: 1.5, spin: 0.1 });
const exL = new Pool('exL', 40, texExplo1, false, { sheet: SH_EX, life: [2.4, 3], size: [[0, 38], [1, 60]], colors: EXC, gravity: 2, spin: 0.08 });
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
  if (decals.length / 16 > 500) decals.splice(0, 16);
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
    rocket(d: number) { if (!play('rocket', d, 0.5, 0.9 + Math.random() * 0.2)) hit(d, 1.2, 2200, 400, 0.35); },
    drones(d: number) { if (ac && buzz) buzz.gain.setTargetAtTime(simSpeed ? vol(d) * 0.12 : 0, ac.currentTime, 0.2); },
  };
})();

// ===== ربط المحاكاة بالرسم =====
let W: World;
interface UVis { root: TransformNode; inner: TransformNode; recoil: number; shake: number; wreck: boolean; baseY: number; yaw: number }
const unitVis = new Map<number, UVis>();
interface AVis { n: TransformNode; body: TransformNode | null; glow: AbstractMesh | null; L: number; lastP: V3 }
const airVis = new Map<number, AVis>();
const burning: { p: V3; t: number; big: number }[] = [];
const vq: { t: number; f: () => void }[] = [];               // مؤثرات مؤجلة بزمن المحاكاة (ارتطام الرصاص…)
const debris: { m: Mesh; p: V3; v: V3; spin: V3; until: number }[] = [];
let interMesh: Mesh, n48Mesh: Mesh, iskMesh: Mesh, dotMesh: Mesh, chunkMesh: Mesh, capMesh: Mesh;
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
  iskMesh = missile('isk', 6.2, 0.92, new Color3(0.32, 0.34, 0.3), false);
  dotMesh = MeshBuilder.CreatePlane('dot', { size: 1 }, scene); const dm = new StandardMaterial('dotMat', scene);
  dm.emissiveTexture = texFlare; dm.opacityTexture = texFlare; dm.emissiveColor = new Color3(5, 3.4, 1.6); dm.disableLighting = true; dm.alphaMode = Engine.ALPHA_ADD; dm.fogEnabled = false;
  dotMesh.material = dm; dotMesh.billboardMode = Mesh.BILLBOARDMODE_ALL; dotMesh.isVisible = false;
  chunkMesh = MeshBuilder.CreateBox('chunk', { width: 3.3, height: 0.9, depth: 3.6 }, scene); const cm = new StandardMaterial('chunkMat', scene); cm.diffuseColor = new Color3(0.08, 0.08, 0.07); chunkMesh.material = cm; chunkMesh.isVisible = false;
  capMesh = MeshBuilder.CreateBox('cap', { width: 0.9, height: 0.06, depth: 0.9 }, scene); const capm = new StandardMaterial('capMat', scene); capm.diffuseColor = new Color3(0.85, 0.84, 0.8); capMesh.material = capm; capMesh.isVisible = false;
}
function syncUnits(dt: number) {
  for (const u of W.units) {
    let vis = unitVis.get(u.id);
    if (!vis) {
      const m = spawnModel(u.kind); vis = { ...m, recoil: 0, shake: 0, wreck: false, baseY: m.inner.position.y, yaw: u.yaw }; unitVis.set(u.id, vis);
      const blob = MeshBuilder.CreateGround('blob', { width: 1, height: 1 }, scene); blob.material = blobMat; blob.parent = vis.root; blob.position.y = 0.5; blob.isPickable = false;
      const s = u.kind === 'patriot' ? 24 : u.kind === 's400' ? 16 : u.kind === 'dshk' ? 3 : u.kind === 'd30' ? 7 : 10; blob.scaling.set(s * 0.55, 1, s);
    }
    vis.root.position.set(u.p[0], groundH(u.p[0], u.p[2]), u.p[2]);
    if (u.alive) vis.yaw += angDiff(vis.yaw, u.yaw) * Math.min(1, dt * 8);
    // الوحدة تميل ويا ميلان الأرض
    const gn = groundN(u.p[0], u.p[2], 3.5); Quaternion.FromUnitVectorsToRef(Vector3.UpReadOnly, new Vector3(gn[0], gn[1], gn[2]), qTilt);
    vis.root.rotationQuaternion = qTilt.multiply(Quaternion.RotationAxis(Vector3.UpReadOnly, vis.yaw));
    if (!u.alive) continue;
    // ارتداد عند الرمي، اهتزاز الرشاش، تمايل الحركة، وغبار الجنازير
    vis.recoil = Math.max(0, vis.recoil - dt * 3.5); vis.shake = Math.max(0, vis.shake - dt * 6);
    const sway = u.spd > 0.5 ? Math.sin(W.T * 9 + u.id) * 0.012 * Math.min(1, u.spd / 6) : 0;
    vis.inner.rotation.x = -0.07 * vis.recoil * vis.recoil + sway;
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
  const g = inst(dotMesh, 'g' + a.id); g.billboardMode = Mesh.BILLBOARDMODE_ALL; g.scaling.setAll(a.kind === 'rocket' ? 2.4 : 1.6); return { body: null, glow: g, L: 2 };
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
    vis.lastP = lp;
  }
  for (const [id, vis] of airVis) if (!seen.has(id)) { vis.n.dispose(); airVis.delete(id); }
}
const camD = (p: V3) => Vector3.Distance(cam.position, v(p));
function handleFx(fx: Fx) {
  switch (fx.k) {
    case 'gun': {
      const vis = unitVis.get(fx.unit); if (vis) vis.recoil = 1;
      muzzle.emit({ a: fx.p, n: 4, jit: 0.6 }); fireS.emit({ a: fx.p, n: Qn(8), dir: fx.dir, spd: [20, 45], spread: 0.4, jit: 0.5 });
      // حلقة غبار حول الدبابة من ضغط الطلقة
      const u = W.units.find(x => x.id === fx.unit); if (u) dust.emit({ a: add(L(u.p), [0, 0.6, 0]), n: Qn(26), spd: [8, 18], up: -0.45, jit: 3 });
      smokeS.emit({ a: add(fx.p, scale(fx.dir, 3)), n: Qn(5), spd: [3, 8], jit: 1.5 });
      flashLight(fx.p, 4, 60, 0.15); trauma = Math.min(1, trauma + clamp(0.25 - camD(fx.p) / 2000, 0, 0.25)); sfx.gun(camD(fx.p)); break;
    }
    case 'round': {
      const vis = unitVis.get(fx.unit); if (vis) vis.shake = 1;
      muzzle.emit({ a: fx.p, n: 1, jit: 0.1 });
      const side = norm([fx.dir[2], 0.8, -fx.dir[0]]); casings.emit({ a: add(fx.p, [0, -0.2, 0]), n: 1, dir: side, spd: [3, 5], spread: 0.6, jit: 0.1 });
      if (Math.random() < 0.3) puffs.emit({ a: add(fx.p, scale(fx.dir, 0.6)), n: 1, spd: [0.5, 1.5], jit: 0.2 });
      if (fx.tracer) tracers.emit({ a: fx.p, n: 1, dir: fx.dir, spd: [850, 850], life: fx.tf, jit: 0.05 });
      const to = fx.to, kind = fx.hit;
      vq.push({ t: W.T + fx.tf, f: () => { if (kind === 'ground') dust.emit({ a: G(to[0], to[2], 0.4), n: 2, spd: [2, 6], up: 1.2, jit: 0.6 }); else if (kind === 'metal') sparks.emit({ a: to, n: 4, spd: [10, 40], jit: 0.3 }); else if (Math.random() < 0.3) puffs.emit({ a: to, n: 1, spd: [0.2, 0.5], jit: 0.3 }); } });
      sfx.round(camD(fx.p)); break;
    }
    case 'shell': tracers.emit({ a: fx.a, n: 1, dir: norm(sub(fx.b, fx.a)), spd: [1650, 1650], life: fx.tf, jit: 0 }); break;
    case 'boom': {
      const s = fx.size, big = s >= 1.3, P = big ? fireL : fireS;
      // الانفجار نفسه: فليب بوك مصوّر (كرة نار تتحول لدخان أسود)، وفوقه شرار وغبار وكرة نار سريعة
      const EX = s < 0.7 ? exS : s < 1.3 ? exM : exL, lift = fx.air ? 0 : (s < 0.7 ? 4 : s < 1.3 ? 9 : 16);
      EX.emit({ a: add(fx.p, [0, lift, 0]), n: big ? 2 : 1, spd: [0, 1.5], up: 1, jit: 3 * s });
      P.emit({ a: fx.p, n: Qn(big ? 22 * s : 8 * s + 3), spd: [10 * s, 38 * s], jit: 2 * s, up: fx.air ? 0 : 0.35 });
      (big ? smokeL : smokeS).emit({ a: fx.p, n: Qn(big ? 36 * s : 14 * s + 4), spd: [3 * s, 13 * s], jit: 3 * s, up: fx.air ? 0 : 0.5 });
      sparks.emit({ a: fx.p, n: Qn((fx.metal ? 45 : 26) * s), spd: [40, 140 * s], jit: 1 });
      if (!fx.air) { dust.emit({ a: fx.p, n: Qn(14 * s + 4), spd: [8, 26 * s], up: 0.1, jit: 3 }); addDecal(fx.p, 8 + 12 * s); }
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
    case 'kill': killVisual(fx.unit, fx.turret); break;
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
  burning.push({ p: [...up] as V3, t: W.T, big: u.kind === 'abrams' || u.kind === 't72' ? 1.3 : 1 });
  if (turret) {
    // انفجار الذخيرة: البرج يطير وعمود نار (jack-in-the-box) وانفجارات متتالية
    const ch = chunkMesh.clone('turret', null)!; ch.isVisible = true; ch.material = (chunkMesh.material as StandardMaterial); caster(ch);
    const p0 = add(up, [0, 2.6, 0]); ch.position.set(...p0);
    debris.push({ m: ch, p: p0, v: [(Math.random() - 0.5) * 9, 21 + Math.random() * 6, (Math.random() - 0.5) * 9], spin: [Math.random() * 5, Math.random() * 3, Math.random() * 5], until: W.T + 2 });
    for (let k = 0; k < 8; k++) vq.push({ t: W.T + k * 0.12, f: () => fireJet.emit({ a: add(up, [0, 2.4, 0]), n: Qn(10), dir: [0, 1, 0], spd: [18, 38], spread: 0.35, jit: 0.8 }) });
    for (let k = 0; k < 4; k++) vq.push({ t: W.T + 1.5 + Math.random() * 5, f: () => { fireS.emit({ a: add(up, [0, 1.6, 0]), n: Qn(12), spd: [6, 18], up: 0.5, jit: 1 }); sparks.emit({ a: add(up, [0, 1.6, 0]), n: Qn(10), spd: [20, 60], jit: 1 }); flashLight(up, 6, 50, 0.25); sfx.boom(camD(up), 0.4); } });
  }
  addDecal(up, 14);
}
// ===== دمار المواقع + بطاقة الثمن =====
function siteDamage(sid: string, p: V3, big: boolean) {
  const R0 = big ? 85 : 55; let changed = false;
  bldInfo.forEach((b, i) => {
    if (b.dmg || Math.hypot(b.x - p[0], b.z - p[2]) > R0) return; b.dmg = true; changed = true;
    const h = b.h * (0.25 + Math.random() * 0.25);
    bldMatrix(b, h).copyToArray(bldMat, i * 16);
    for (let k = 0; k < 3; k++) bldCol[i * 4 + k] *= 0.28;
  });
  if (changed) { bld.thinInstanceBufferUpdated('matrix'); bld.thinInstanceBufferUpdated('color'); }
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
  const out: Item[] = [], near = camDist < 2600;
  for (const s of SITES) out.push({ key: 's' + s.id, text: s.name, cls: 'site', p: add(s.p, [0, 30, 0]), prio: 1 });
  if (near) for (const u of W.units) out.push({ key: 'u' + u.id, text: u.alive ? `${u.name} · ${SIDE_AR[u.side]}` : `${u.name} (محطّم)`, cls: `${u.side}${u.alive ? '' : ' dead'}`, p: add(u.p, [0, u.kind === 'patriot' || u.kind === 's400' ? 17 : 9, 0]), prio: u.alive ? 3 : 0, follow: u.id });
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
  if (u) return { p: L(add(u.p, [0, 2, 0])), air: false, name: `${u.name} · ${SIDE_AR[u.side]}`, info: u.alive ? `${u.group} · ${u.spd > 1 ? `يتحرك ${Math.round(u.spd * 3.6)} كم/س` : 'بموقعه'}${u.cover ? ' · ورا ساتر' : ''}` : 'محطّمة' };
  const a = W.air.find(x => x.id === id);
  if (a) return { p: L(a.p), vel: a.v, air: true, name: `${AIR_AR[a.kind]} · ${SIDE_AR[a.side]}`, info: `${Math.round(len(a.v) * 3.6).toLocaleString('en')} كم/س · ارتفاع ${Math.round(a.p[1]).toLocaleString('en')} م${a.siteName ? ' · الهدف: ' + a.siteName : ''}${a.kind === 'n48' && !a.ign ? ' · مقذوف بالغاز' : ''}` };
  return null;
}
function startFollow(id: number, dist?: number) {
  const f = findEntity(id); if (!f) return;
  view.follow = id; selected = id; view.fDist = dist ?? (f.air ? 34 : 30); followBlend = 0; followFrom = camTarget.clone();
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
  if (drone && b % 2 === 1) return looseShot([-1830, 4, -350], 210, 0.36, Math.atan2(drone.p[0] + 1830, drone.p[2] + 350) + Math.PI);
  if (b === 0 || b === 2 && gap > 1500) return looseShot(add(lead.p, [0, 3, 0]), 190, 0.36, lead.yaw + Math.PI * 0.8);
  if (b === 1) return looseShot([-2085, 3, -350], 170, 0.34, -Math.PI / 2 + 0.6);
  twoShot(lead.p, line, 0, 0, true);
}
function looseShot(p: V3, dist: number, pitch: number, yaw: number) { endFollow(); view.tx = p[0]; view.tz = p[2]; targetY = p[1]; view.dist = dist; view.pitch = pitch; view.yaw = yaw; }
function twoShot(a: V3, b: V3, prio: number, holdReal: number, force = false) {
  if (!force && !claim(prio, holdReal)) return;
  endFollow(); const m = scale(add(a, b), 0.5), s = Math.max(120, dist2d(a, b)), line = Math.atan2(b[0] - a[0], b[2] - a[2]);
  view.tx = m[0]; view.tz = m[2]; targetY = 0; view.pitch = -1;
  if (portrait()) { view.yaw = line; view.dist = s * 1.05 + 220; } else { view.yaw = line + Math.PI / 2; view.dist = s * 0.72 + 180; }
}
function closeShot(p: V3, from: V3 | null, dist: number, pitch: number, prio: number, holdReal: number) {
  if (!claim(prio, holdReal)) return false;
  endFollow(); view.tx = p[0]; view.tz = p[2]; targetY = p[1] - groundH(p[0], p[2]); view.dist = dist; view.pitch = pitch;
  if (from) view.yaw = Math.atan2(p[0] - from[0], p[2] - from[2]) + 0.55;
  return true;
}
function impactCam(p: V3, from: V3 | null, tImpact: number) {
  if (nowS() < impactReady) return;                                 // حد أقصى لقطة إصابة كل 15 ثانية
  if (!closeShot(p, from, from ? 80 : 190, from ? 0.32 : 0.42, 8, 3.2)) return;
  impactReady = nowS() + 15; slowWins.push({ t0: tImpact - 0.35, t1: tImpact + 1.1 });
}
function directorFx(fx: Fx) {
  if (!auto) return;
  switch (fx.k) {
    case 'killshot': { const sh = W.units.find(u => u.id === fx.shooter), tg = W.units.find(u => u.id === fx.target); if (sh && tg) impactCam(L(add(tg.p, [0, 2, 0])), sh.p, W.T + fx.tf); break; }
    case 'threat': { const a = W.air.find(x => x.id === fx.air); if (a && a.kind !== 'iskander') impactCam(L(add(a.aim, [0, 12, 0])), null, W.T + fx.tti); break; }
    case 'plaunch': if (claim(6, 1.2)) { closeShot(fx.muzzle, add(fx.muzzle, scale(fx.dir, -50)), 85, 0.28, 6, 1.2); pendingFollow = { id: fx.air, at: nowS() + 0.9, dist: 40 }; } break;
    case 'eject': if (claim(7, 3)) { endFollow(); view.tx = fx.p[0]; view.tz = fx.p[2]; targetY = 8; view.dist = 70; view.pitch = 0.2; view.yaw = Math.atan2(fx.dir[0], fx.dir[2]) + Math.PI / 2; pendingFollow = { id: fx.air, at: nowS() + 2.2, dist: 45 }; } break;
    case 'intercept': if (view.follow && fx.big) slowWins.push({ t0: W.T - 0.05, t1: W.T + 0.9 }); break;
    case 'rlaunch': { const g = W.units.find(u => u.id === fx.unit); if (g && W.T - lastSalvoShot > 30) { lastSalvoShot = W.T; twoShot(g.p, [-2000, 0, HIGHWAY_Z], 5, 6); } break; }
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
  $('phase').textContent = W.air.some(a => a.kind === 'iskander') ? '⚠ صاروخ باليستي بالجو' : W.air.some(a => a.kind === 'shahed') ? 'مسيّرات بالجو' : W.air.some(a => a.kind === 'kh101') ? 'صواريخ كروز بالجو' : ({ march: 'رتل على الطريق', deploy: 'العدو ينتشر', bound: 'العدو يتقدم بقفزات', hold: 'اشتباك على خط التماس', retreat: 'العدو ينسحب' } as Record<string, string>)[W.columnPhase];
  $('tally').innerHTML = `<span>مسيّرات <b class="g">${s.dronesDown}</b>/${s.drones} أُسقطت${s.dronesHit ? ` · <b class="x">${s.dronesHit}</b> أصابت` : ''}</span>`
    + `<span>كروز <b class="g">${s.cruiseDown}</b>/${s.cruise}</span><span>باليستي <b class="g">${s.ballisticDown}</b>/${s.ballistic}${s.ballisticHit ? ` · <b class="x">${s.ballisticHit}</b>` : ''}</span>`
    + `<span>T-72 <b class="g">${s.enTanksLost}</b>/${s.enTanks} دُمّرت</span><span>أبرامز <b>${s.iqTanks - s.iqTanksLost}</b>/${s.iqTanks}</span>`;
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
  if (W) { syncUnits(dtReal); syncAir(); if (simDt) { burnFx(simDt); tickDebris(simDt); } directorFrame(); }
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
  const s = W.stats, lost = W.units.filter(u => u.side === 'iq' && !u.alive).length;
  $('endTitle').textContent = s.enTanksLost >= 3 ? 'انصد الهجوم' : 'المعركة انتهت';
  $('endSum').innerHTML = `<div>المسيّرات<b>${s.dronesDown} من ${s.drones} أُسقطت</b></div><div>كروز + باليستي<b>${s.cruiseDown + s.ballisticDown} من ${s.cruise + s.ballistic} اعتُرضت</b></div>`
    + `<div>دبابات العدو<b>${s.enTanksLost} من ${s.enTanks} دُمّرت</b></div><div>خسائرنا<b>${lost} وحدة</b></div>`
    + `<div>معترضات (باتريوت + S-400)<b>${s.pacFired} + ${s.n48Fired}</b></div><div>طلقات الدوشكا<b>${s.rounds.toLocaleString('en')}</b></div>`;
  ($('end') as HTMLElement).hidden = false;
}
function toast(m: string) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout((toast as any).h); (toast as any).h = setTimeout(() => t.classList.remove('show'), 2600); }
let seed = 3;
function start() {
  sfx.init();
  for (const u of unitVis.values()) u.root.dispose(); unitVis.clear(); for (const a of airVis.values()) a.n.dispose(); airVis.clear();
  debris.forEach(d => d.m.dispose()); debris.length = 0; burning.length = 0; marks = []; vq.length = 0; slowWins.length = 0; decals = [];
  decal.thinInstanceSetBuffer('matrix', new Float32Array(16), 16, false); decal.thinInstanceCount = 0;
  for (const el of els.values()) el.remove(); els.clear(); for (const el of arrowEls.values()) el.remove(); arrowEls.clear(); pools.forEach(p => p.ps.reset());
  bldInfo.forEach((b, i) => { if (!b.dmg) return; b.dmg = false; bldMatrix(b, b.h).copyToArray(bldMat, i * 16); for (let k = 0; k < 3; k++) bldCol[i * 4 + k] /= 0.28; });
  bld.thinInstanceBufferUpdated('matrix'); bld.thinInstanceBufferUpdated('color');
  siteProps.forEach(sp => { if (!sp.hit) return; sp.hit = false; sp.mat.diffuseColor = sp.mat.diffuseColor.scale(4); sp.mesh.scaling.y /= 0.55; sp.mesh.position.y /= 0.55; });
  W = newWorld(seed); seed = 1 + Math.floor(Math.random() * 9999); running = true; endShown = false; tickN = -1; impactReady = 0; lastSalvoShot = -99;
  setAuto(true); overview(true);
  for (const id of ['intro', 'end']) ($(id) as HTMLElement).hidden = true;
  for (const id of ['top', 'bottom', 'sideBtns', 'fps', 'mini']) ($(id) as HTMLElement).hidden = false;
}
document.querySelectorAll<HTMLButtonElement>('#spd button').forEach(b => b.onclick = () => { simSpeed = +b.dataset.s!; document.querySelectorAll('#spd button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
$('bStart').onclick = start; $('bAgain').onclick = start;
$('bExplore').onclick = () => { ($('end') as HTMLElement).hidden = true; setAuto(false); toast('حرّك الخريطة واضغط على أي اسم'); };
$('bBack').onclick = () => { setAuto(false); endFollow(); }; $('bHome').onclick = () => { setAuto(false); endFollow(); view.tx = -1600; view.tz = -300; view.dist = 5200; view.yaw = 0; view.pitch = -1; targetY = 0; };
$('bAuto').onclick = () => setAuto(!auto);
$('bRotL').onclick = () => (view.yaw += 0.5); $('bRotR').onclick = () => (view.yaw -= 0.5);
$('bQual').onclick = () => { setQuality(!HQ); toast(HQ ? 'جودة عالية: ظلال وأضواء انفجارات' : 'جودة خفيفة: أسرع على التلفون'); };
$('bMute').onclick = () => ($('bMute').textContent = sfx.toggle() ? '🔇' : '🔊');
$('bCred').onclick = () => (($('credits') as HTMLElement).hidden = false); $('bCredClose').onclick = () => (($('credits') as HTMLElement).hidden = true);
window.addEventListener('resize', () => engine.resize());
(window as any).__follow = startFollow; (window as any).__getW = () => W; (window as any).__view = view; (window as any).__scene = scene; (window as any).__order = (o: Order) => order(W, o);

(async () => {
  const load = $('load');
  try {
    keepClear = newWorld(3).units.map(u => u.p).concat([PATRIOT_POS, S400_POS]);
    await loadHeight();
    ({ bld, bldMat, bldCol, bldInfo, siteProps } = await buildWorld(scene, { HQ, NL, caster, texUrls, keepClear }));
    makeProcedural();
    await loadModels(t => (load.textContent = t));
    setupShadows(); $('bQual').setAttribute('aria-pressed', String(HQ));
    W = newWorld(3); syncUnits(0);
    await scene.whenReadyAsync();
    load.textContent = 'جاهز.'; ($('bStart') as HTMLButtonElement).disabled = false;
    engine.runRenderLoop(frame);
    if (AUTO) start();
  } catch (e) { load.textContent = 'صار خطأ بالتحميل: ' + (e as Error).message; console.error(e); }
})();
