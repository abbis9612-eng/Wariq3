// مشهد اعتراض: صاروخ كروز Kh-101 ومنظومة باتريوت — Babylon.js
import {
  Engine, Scene, Vector3, Color3, Color4, FreeCamera, ArcRotateCamera, HemisphericLight, DirectionalLight, PointLight,
  ShadowGenerator, MeshBuilder, Mesh, StandardMaterial, PBRMaterial, DynamicTexture, ParticleSystem, TransformNode,
  VertexBuffer, VertexData, DefaultRenderingPipeline, ImageProcessingConfiguration, LoadAssetContainerAsync,
  AbstractMesh, Matrix, Particle, BaseTexture, Texture, Camera,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { SkyMaterial } from '@babylonjs/materials/sky';
// المجسمات بصيغة glTF نصية (JSON) مضمّنة — مقبولة للنشر كصفحة
import khUrl from '../models/kh101.gltf.json?url';
import patUrl from '../models/patriot.gltf.json?url';
import {
  V3, add, sub, scale, len, norm, lerp, clamp, smooth, rng, fbm, terrainH,
  Cruise, newCruise, stepCruise, Interceptor, newInterceptor, stepInterceptor, MUZZLES, Debris, stepDebris, CRUISE_SPEED,
} from './sim';

// ===== إعدادات =====
const qs = new URLSearchParams(location.search);
const AUTO = qs.has('auto');                 // للفحص الآلي: يبدأ بدون ضغطة
type Quality = 'high' | 'low';
let quality: Quality = qs.get('q') === 'low' ? 'low' : 'high';
const LAUNCH_T = 8.0, SECOND_DELAY = 1.4;
const SUN = norm([0.45, 0.38, 0.86]);         // اتجاه الشمس (عصر، ~20° فوق الأفق)

const $ = (id: string) => document.getElementById(id)!;
const canvas = $('c') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: AUTO }, true);
const scene = new Scene(engine);
scene.clearColor = new Color4(0.55, 0.6, 0.66, 1);
scene.skipPointerMovePicking = true;
const v = (a: V3) => new Vector3(a[0], a[1], a[2]);
const a3 = (p: Vector3): V3 => [p.x, p.y, p.z];

function applyScaling() {
  const dpr = window.devicePixelRatio || 1;
  engine.setHardwareScalingLevel(1 / Math.min(dpr, quality === 'high' ? 1.6 : 1));
}
applyScaling();

// ===== الضوء والسماء والضباب =====
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
hemi.intensity = 0.75; hemi.diffuse = new Color3(0.62, 0.68, 0.8); hemi.groundColor = new Color3(0.5, 0.42, 0.32);
const sun = new DirectionalLight('sun', v(scale(SUN, -1)), scene);
sun.intensity = 3.2; sun.diffuse = new Color3(1, 0.84, 0.66); sun.position = v(scale(SUN, 250));
const sky = MeshBuilder.CreateBox('sky', { size: 40000 }, scene);
const skyMat = new SkyMaterial('skyMat', scene);
skyMat.backFaceCulling = false; skyMat.useSunPosition = true; skyMat.sunPosition = v(scale(SUN, 1000));
skyMat.turbidity = 5; skyMat.luminance = 1; skyMat.rayleigh = 3; skyMat.mieCoefficient = 0.004; skyMat.mieDirectionalG = 0.82; skyMat.fogEnabled = false;
sky.material = skyMat; sky.infiniteDistance = true; sky.isPickable = false;
scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.000105; scene.fogColor = new Color3(0.79, 0.72, 0.63);

// ===== قوام مولّد بالكود =====
function canvasTex(name: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, mips = true) {
  const t = new DynamicTexture(name, { width: size, height: size }, scene, mips);
  const g = t.getContext() as unknown as CanvasRenderingContext2D;
  g.clearRect(0, 0, size, size); draw(g, size); t.update(); t.hasAlpha = true;
  return t;
}
const R = rng(7);
const texSoft = canvasTex('soft', 64, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
});
const texSmoke = canvasTex('smoke', 128, (g, s) => {
  for (let i = 0; i < 22; i++) {
    const a = R() * Math.PI * 2, r = R() * s * 0.22, x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r, rad = s * (0.12 + R() * 0.16);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const k = 0.75 + R() * 0.25;
    gr.addColorStop(0, `rgba(${255 * k | 0},${255 * k | 0},${255 * k | 0},.5)`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(s / 2, s / 2, s * 0.15, s / 2, s / 2, s / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, s, s);
});
const texFlare = canvasTex('flare', 128, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,240,200,.95)'); gr.addColorStop(0.35, 'rgba(255,170,60,.35)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
});
const texSand = canvasTex('sand', 256, (g, s) => {
  const im = g.createImageData(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const n = fbm(x / 9, y / 9, 4) * 0.6 + fbm(x / 2.5 + 40, y / 2.5, 2) * 0.4, rip = Math.sin((x + fbm(x / 20, y / 20, 2) * 40) / 3.2) * 0.04;
    const c = 205 + (n - 0.5) * 70 + rip * 255, i = (y * s + x) * 4;
    im.data[i] = c; im.data[i + 1] = c * 0.97; im.data[i + 2] = c * 0.93; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
});
texSand.hasAlpha = false; texSand.wrapU = texSand.wrapV = Texture.WRAP_ADDRESSMODE;

// ===== الأرض =====
let ground: Mesh;
function buildGround() {
  const SIZE = 26000, SUBD = quality === 'high' ? 300 : 190;
  ground = MeshBuilder.CreateGround('ground', { width: SIZE, height: SIZE, subdivisions: SUBD }, scene);
  const pos = ground.getVerticesData(VertexBuffer.PositionKind)!, n = pos.length / 3;
  const col = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], z = pos[i * 3 + 2], h = terrainH(x, z); pos[i * 3 + 1] = h;
    const slope = Math.min(1, Math.abs(terrainH(x + 30, z) - h) / 30 + Math.abs(terrainH(x, z + 30) - h) / 30);
    const tint = fbm(x * 0.002 + 5, z * 0.002, 3), rock = smooth(0.25, 0.7, slope) * smooth(80, 300, h);
    col[i * 4] = lerp(lerp(0.86, 0.74, tint), 0.5, rock); col[i * 4 + 1] = lerp(lerp(0.74, 0.62, tint), 0.45, rock); col[i * 4 + 2] = lerp(lerp(0.56, 0.47, tint), 0.4, rock); col[i * 4 + 3] = 1;
  }
  const idx = ground.getIndices()!, nor: number[] = [];
  VertexData.ComputeNormals(pos, idx, nor);
  ground.setVerticesData(VertexBuffer.PositionKind, pos); ground.setVerticesData(VertexBuffer.NormalKind, nor); ground.setVerticesData(VertexBuffer.ColorKind, col);
  const m = new StandardMaterial('groundMat', scene);
  m.diffuseTexture = texSand; (m.diffuseTexture as Texture).uScale = (m.diffuseTexture as Texture).vScale = SIZE / 55;
  m.specularColor = new Color3(0.03, 0.03, 0.03); m.maxSimultaneousLights = 6;
  ground.material = m; ground.receiveShadows = true; ground.isPickable = false; ground.freezeWorldMatrix();
}
buildGround();

// ===== الظلال =====
let shadows: ShadowGenerator | null = null;
function setupShadows(casters: AbstractMesh[]) {
  shadows?.dispose(); shadows = null;
  if (quality !== 'high') return;
  shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true; shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias = 0.0008; shadows.normalBias = 0.02; sun.shadowMinZ = 1; sun.shadowMaxZ = 600;
  casters.forEach(c => shadows!.addShadowCaster(c, true));
}

// ===== الكاميرات والمعالجة اللاحقة =====
const cine = new FreeCamera('cine', new Vector3(-9000, 600, -1100), scene);
cine.minZ = 1; cine.maxZ = 45000; cine.fov = 0.82; cine.inputs.clear();
const orbit = new ArcRotateCamera('orbit', -2.2, 1.25, 70, new Vector3(4, 5, 0), scene);
orbit.minZ = 1; orbit.maxZ = 45000; orbit.lowerRadiusLimit = 14; orbit.upperRadiusLimit = 2500; orbit.upperBetaLimit = 1.52;
orbit.wheelPrecision = 8; orbit.pinchPrecision = 6; orbit.panningSensibility = 0;
scene.activeCamera = cine;
const pipe = new DefaultRenderingPipeline('pipe', true, scene, [cine, orbit]);
function applyPipeline() {
  pipe.fxaaEnabled = true;
  pipe.bloomEnabled = true; pipe.bloomThreshold = 0.82; pipe.bloomWeight = quality === 'high' ? 0.42 : 0.32;
  pipe.bloomKernel = quality === 'high' ? 64 : 32; pipe.bloomScale = 0.5;
  pipe.imageProcessingEnabled = true;
  const ip = pipe.imageProcessing;
  ip.toneMappingEnabled = true; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.08; ip.contrast = 1.2; ip.vignetteEnabled = true; ip.vignetteWeight = 1.6; ip.vignetteColor = new Color4(0, 0, 0, 0);
  pipe.grainEnabled = quality === 'high'; pipe.grain.intensity = 7; pipe.grain.animated = true;
}
applyPipeline();

// ===== المجسمات =====
const cruiseNode = new TransformNode('cruiseNode', scene);
const interNodes: TransformNode[] = [];
let patriotMeshes: AbstractMesh[] = [];
function upgradeMaterials(meshes: AbstractMesh[]) {
  for (const m of meshes) { const mat = m.material; if (mat instanceof PBRMaterial) { mat.maxSimultaneousLights = 6; mat.environmentIntensity = 0; } }
}
async function loadModels(onProgress: (t: string) => void) {
  onProgress('يحمّل منظومة الباتريوت…');
  const pc = await LoadAssetContainerAsync(patUrl, scene, { pluginExtension: '.gltf' });
  pc.addAllToScene(); patriotMeshes = pc.meshes.filter(m => m.getTotalVertices() > 0); upgradeMaterials(pc.meshes);
  patriotMeshes.forEach(m => { m.receiveShadows = true; m.isPickable = false; m.freezeWorldMatrix(); });
  onProgress('يحمّل صاروخ الكروز…');
  const kc = await LoadAssetContainerAsync(khUrl, scene, { pluginExtension: '.gltf' });
  kc.addAllToScene(); upgradeMaterials(kc.meshes);
  const holder = new TransformNode('khHolder', scene); holder.parent = cruiseNode; holder.rotation.y = Math.PI; // الأنف كان باتجاه −z
  kc.meshes[0].parent = holder; kc.meshes.forEach(m => (m.isPickable = false));
  // المعترض: يُبنى بالكود (أبيض، جسم 5.3 م، قطر 0.41 م، أربع زعانف)
  const body = MeshBuilder.CreateCylinder('ib', { height: 4.6, diameter: 0.41, tessellation: 18 }, scene);
  body.rotation.x = Math.PI / 2;
  const nose = MeshBuilder.CreateCylinder('in', { height: 0.9, diameterTop: 0, diameterBottom: 0.41, tessellation: 18 }, scene);
  nose.rotation.x = Math.PI / 2; nose.position.z = 2.75;
  const fins: Mesh[] = [];
  for (let i = 0; i < 4; i++) { const f = MeshBuilder.CreateBox('if' + i, { width: 0.04, height: 0.95, depth: 0.7 }, scene); f.position.z = -1.9; f.rotation.z = i * Math.PI / 2; f.position.x = Math.sin(i * Math.PI / 2) * 0.42; f.position.y = Math.cos(i * Math.PI / 2) * 0.42; fins.push(f); }
  const proto = Mesh.MergeMeshes([body, nose, ...fins], true, true)!;
  const im = new PBRMaterial('interMat', scene); im.albedoColor = new Color3(0.86, 0.86, 0.82); im.metallic = 0.1; im.roughness = 0.45; im.maxSimultaneousLights = 6; im.environmentIntensity = 0;
  proto.material = im; proto.setEnabled(false);
  for (let i = 0; i < 2; i++) {
    const n = new TransformNode('inter' + i, scene); const c = proto.clone('interMesh' + i, n)!; c.setEnabled(true); c.isPickable = false;
    const tail = MeshBuilder.CreateBox('tail' + i, { size: 0.1 }, scene); tail.parent = n; tail.position.z = -2.4; tail.isVisible = false;
    n.metadata = { tail }; n.setEnabled(false); interNodes.push(n);
  }
  setupShadows(patriotMeshes);
}

// ===== الجسيمات =====
const systems: ParticleSystem[] = [];
let timeScale = 1, userSlow = 1;
function makePS(name: string, cap: number, tex: BaseTexture, add: boolean) {
  const p = new ParticleSystem(name, cap, scene);
  p.particleTexture = tex; p.blendMode = add ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
  p.updateSpeed = 1 / 60; p.emitRate = 0; p.minEmitPower = p.maxEmitPower = 1; p.gravity = Vector3.Zero();
  p.minInitialRotation = 0; p.maxInitialRotation = Math.PI * 2; p.minLifeTime = 1; p.maxLifeTime = 1;
  p.emitter = Vector3.Zero(); p.minEmitBox = p.maxEmitBox = Vector3.Zero();
  systems.push(p); return p;
}
const Q = () => (quality === 'high' ? 1 : 0.5);

/** أثر دخان يتوزّع بين موقعين متتاليين حتى يطلع متصل حتى بسرعة 1300 م/ث */
class Trail {
  ps: ParticleSystem; prev: V3 | null = null; cur: V3 = [0, 0, 0]; on = false;
  constructor(name: string, private opt: { life: [number, number]; size: [number, number, number]; colors: [number, Color4][]; drift: number; perMeter: number; maxRate: number; add?: boolean; tex?: BaseTexture }) {
    this.ps = makePS(name, Math.ceil(opt.maxRate * opt.life[1] * 1.1), opt.tex ?? texSmoke, !!opt.add);
    const p = this.ps;
    p.minLifeTime = opt.life[0]; p.maxLifeTime = opt.life[1];
    p.addSizeGradient(0, opt.size[0], opt.size[0] * 1.4); p.addSizeGradient(0.18, opt.size[1], opt.size[1] * 1.3); p.addSizeGradient(1, opt.size[2], opt.size[2] * 1.3);
    opt.colors.forEach(([t, c]) => p.addColorGradient(t, c));
    p.minAngularSpeed = -0.25; p.maxAngularSpeed = 0.25;
    p.startPositionFunction = (_w: Matrix, out: Vector3, _pt: Particle) => {
      const a = this.prev ?? this.cur, k = Math.random(), j = 0.35;
      out.set(lerp(a[0], this.cur[0], k) + (Math.random() - 0.5) * j, lerp(a[1], this.cur[1], k) + (Math.random() - 0.5) * j, lerp(a[2], this.cur[2], k) + (Math.random() - 0.5) * j);
    };
    p.startDirectionFunction = (_w: Matrix, out: Vector3) => { const d = this.opt.drift; out.set((Math.random() - 0.5) * d + 1.6, (Math.random() - 0.3) * d, (Math.random() - 0.5) * d + 0.8); };
    p.start();
  }
  update(pos: V3, simDt: number) {
    this.prev = this.on ? this.cur : pos; this.cur = pos;
    const dist = len(sub(this.cur, this.prev));
    // المعدّل بالثانية (بزمن المحاكاة)، يتناسب مع المسافة المقطوعة
    const dt = Math.max(1e-4, simDt);
    this.ps.emitRate = this.on ? Math.min(this.opt.maxRate, (dist / dt) * this.opt.perMeter) * (quality === 'high' ? 1 : 0.75) : 0;
  }
  stop() { this.on = false; this.ps.emitRate = 0; }
  reset() { this.on = false; this.prev = null; this.ps.reset(); this.ps.emitRate = 0; this.ps.start(); }
}
const smokeCol: [number, Color4][] = [[0, new Color4(1, 0.9, 0.75, 0)], [0.015, new Color4(1, 0.92, 0.8, 0.8)], [0.12, new Color4(0.93, 0.93, 0.92, 0.6)], [1, new Color4(0.82, 0.83, 0.86, 0)]];
const trails = [0, 1].map(i => new Trail('trail' + i, { life: [15, 22], size: [2.4, 6, 15], colors: smokeCol, drift: 1.4, perMeter: 0.6, maxRate: 700 }));
const wreckTrail = new Trail('wreckTrail', { life: [6, 10], size: [2, 6, 18], colors: [[0, new Color4(0.25, 0.2, 0.16, 0)], [0.03, new Color4(0.16, 0.14, 0.13, 0.85)], [1, new Color4(0.32, 0.31, 0.3, 0)]], drift: 2.5, perMeter: 0.5, maxRate: 260 });
const debrisTrail = new Trail('debrisTrail', { life: [2.5, 4.5], size: [0.6, 1.8, 5], colors: [[0, new Color4(0.5, 0.45, 0.4, 0)], [0.05, new Color4(0.42, 0.4, 0.38, 0.55)], [1, new Color4(0.5, 0.5, 0.5, 0)]], drift: 1.2, perMeter: 0, maxRate: 0 });

// لهب المحرك: جسيمات محلية مربوطة بذيل المعترض + وهج
const flames: ParticleSystem[] = [], glows: Mesh[] = [];
const glowMat = new StandardMaterial('glowMat', scene);
glowMat.emissiveTexture = texFlare; glowMat.opacityTexture = texFlare; glowMat.emissiveColor = new Color3(5, 3.6, 2.2);
glowMat.disableLighting = true; glowMat.alphaMode = Engine.ALPHA_ADD; glowMat.backFaceCulling = false; glowMat.fogEnabled = false;
function buildFlames() {
  interNodes.forEach((n, i) => {
    const f = makePS('flame' + i, 400, texFlare, true);
    f.emitter = n.metadata.tail as AbstractMesh; f.isLocal = true;
    f.direction1 = new Vector3(-0.06, -0.06, -1); f.direction2 = new Vector3(0.06, 0.06, -1);
    f.minEmitPower = 30; f.maxEmitPower = 55; f.minLifeTime = 0.05; f.maxLifeTime = 0.13;
    f.addSizeGradient(0, 0.9, 1.3); f.addSizeGradient(1, 0.25, 0.4);
    f.addColorGradient(0, new Color4(4, 3.4, 2.4, 1)); f.addColorGradient(0.5, new Color4(3, 1.4, 0.4, 0.8)); f.addColorGradient(1, new Color4(0.6, 0.15, 0.02, 0));
    f.start(); flames.push(f);
    const g = MeshBuilder.CreatePlane('glow' + i, { size: 1 }, scene); g.material = glowMat; g.billboardMode = Mesh.BILLBOARDMODE_ALL;
    g.parent = n; g.position.z = -3; g.isPickable = false; glows.push(g);
  });
}
const rocketLight = new PointLight('rocketLight', Vector3.Zero(), scene); rocketLight.diffuse = new Color3(1, 0.62, 0.3); rocketLight.range = 900; rocketLight.intensity = 0;
const boomLight = new PointLight('boomLight', Vector3.Zero(), scene); boomLight.diffuse = new Color3(1, 0.7, 0.4); boomLight.range = 4000; boomLight.intensity = 0;

// مؤثرات مؤقتة (انفجار، غيمة إطلاق) تُمسح عند الإعادة
type Fx = { t: number; dur: number; tick: (k: number, dt: number) => void; done: () => void };
let fxList: Fx[] = [];
const transient: { dispose: () => void }[] = [];
function burst(name: string, at: V3, n: number, o: {
  tex: BaseTexture; add: boolean; life: [number, number]; power: [number, number]; size: [number, number][]; colors: [number, Color4][];
  gravity?: number; damp?: number; radius?: number; dir?: (out: Vector3) => void; stretched?: boolean;
}) {
  const p = makePS(name, n, o.tex, o.add);
  p.emitter = v(at); p.minLifeTime = o.life[0]; p.maxLifeTime = o.life[1]; p.minEmitPower = o.power[0]; p.maxEmitPower = o.power[1];
  const r = o.radius ?? 1;
  if (o.dir) { const f = o.dir; p.startDirectionFunction = (_w: Matrix, out: Vector3) => f(out); p.minEmitBox = new Vector3(-r, -r, -r); p.maxEmitBox = new Vector3(r, r, r); }
  else p.createSphereEmitter(r, 1);
  o.size.forEach(([t, s], i) => p.addSizeGradient(t, s, s * (i === 0 ? 1.6 : 1.3)));
  o.colors.forEach(([t, c]) => p.addColorGradient(t, c));
  if (o.gravity) p.gravity = new Vector3(0, o.gravity, 0);
  if (o.damp) { p.addLimitVelocityGradient(0, o.power[1]); p.addLimitVelocityGradient(0.25, o.power[1] * 0.25); p.addLimitVelocityGradient(1, 1); p.limitVelocityDamping = o.damp; }
  if (o.stretched) p.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
  p.minAngularSpeed = -0.4; p.maxAngularSpeed = 0.4;
  p.manualEmitCount = Math.round(n * (o.add ? 1 : Q() * 0.7 + 0.3)); p.targetStopDuration = o.life[1] + 0.5;
  // القوام مشترك بين كل الأنظمة: نمسح النظام بدون قوامه (dispose(false))
  let gone = false;
  const kill = () => { if (gone) return; gone = true; const i = systems.indexOf(p); if (i >= 0) systems.splice(i, 1); p.dispose(false); };
  p.onStoppedObservable.addOnce(() => setTimeout(kill, 0));
  p.start(); transient.push({ dispose: kill });
  return p;
}
function flash(at: V3, size: number, dur: number, light: number) {
  const fl = MeshBuilder.CreatePlane('flash', { size: 1 }, scene); fl.material = glowMat; fl.billboardMode = Mesh.BILLBOARDMODE_ALL; fl.position = v(at); fl.isPickable = false;
  transient.push(fl);
  boomLight.position = v(at); boomLight.intensity = light;
  fxList.push({ t: 0, dur, tick: (k) => { const s = size * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85 * 0.4); fl.scaling.setAll(Math.max(0.01, s)); fl.visibility = 1 - k * k; boomLight.intensity = light * (1 - k) ** 2; }, done: () => { fl.dispose(); boomLight.intensity = 0; } });
}
function explode(at: V3, big: boolean, airVel: V3 = [0, 0, 0]) {
  const k = big ? 1 : 0.55;
  flash(at, 110 * k, 0.9, 60 * k);
  burst('fire', at, 160 * k | 0, { tex: texSmoke, add: true, life: [0.5, 1.4], power: [25 * k, 85 * k], radius: 3 * k, damp: 0.85, size: [[0, 6 * k], [0.3, 18 * k], [1, 26 * k]],
    colors: [[0, new Color4(6, 4.6, 2.6, 1)], [0.25, new Color4(3.2, 1.3, 0.35, 0.9)], [0.6, new Color4(0.8, 0.22, 0.05, 0.5)], [1, new Color4(0.1, 0.05, 0.03, 0)]] });
  burst('smoke', at, 130 * k | 0, { tex: texSmoke, add: false, life: [16, 26], power: [8 * k, 34 * k], radius: 5 * k, damp: 0.9, gravity: 1.5, size: [[0, 10 * k], [0.25, 32 * k], [1, 58 * k]],
    colors: [[0, new Color4(0.2, 0.17, 0.15, 0)], [0.04, new Color4(0.17, 0.15, 0.14, 0.92)], [0.5, new Color4(0.32, 0.31, 0.3, 0.6)], [1, new Color4(0.5, 0.5, 0.5, 0)]],
    dir: (o) => { const r = norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]); o.set(r[0] + airVel[0] * 0.004, r[1] + airVel[1] * 0.004, r[2] + airVel[2] * 0.004); } });
  burst('sparks', at, 140 * k | 0, { tex: texSoft, add: true, life: [0.7, 1.9], power: [90, 260 * k], radius: 1, gravity: -9.8, stretched: true, size: [[0, 1.1], [1, 0.4]],
    colors: [[0, new Color4(5, 4, 2.4, 1)], [0.6, new Color4(3, 1.2, 0.3, 0.9)], [1, new Color4(1, 0.2, 0, 0)]] });
  addTrauma(big ? 0.9 : 0.5);
  sfx.boom(len(sub(at, a3(scene.activeCamera!.position))), big);
}
function launchFx(muzzle: V3) {
  const rear: V3 = [muzzle[0] + 6.3, muzzle[1] - 4.0, muzzle[2]];
  burst('launchFire', muzzle, 70, { tex: texSmoke, add: true, life: [0.25, 0.6], power: [10, 40], radius: 1.2, damp: 0.8, size: [[0, 3], [1, 9]],
    colors: [[0, new Color4(6, 4.5, 2.6, 1)], [0.5, new Color4(2.6, 1, 0.25, 0.7)], [1, new Color4(0.3, 0.1, 0.02, 0)]] });
  // غازات العادم تطلع من ورا الحاوية وتنتشر على الأرض
  burst('launchCloud', rear, 240, { tex: texSmoke, add: false, life: [6, 12], power: [6, 34], radius: 2.5, damp: 0.86, gravity: 0.6, size: [[0, 4], [0.3, 13], [1, 24]],
    colors: [[0, new Color4(0.95, 0.9, 0.82, 0)], [0.03, new Color4(0.93, 0.9, 0.85, 0.85)], [0.6, new Color4(0.86, 0.83, 0.78, 0.45)], [1, new Color4(0.84, 0.8, 0.74, 0)]],
    dir: (o) => { const a = Math.random() * Math.PI * 2; o.set(Math.cos(a) * 0.9 + 0.5, Math.random() * 0.35, Math.sin(a) * 0.9); } });
  burst('launchDust', [rear[0], 0.5, rear[2]], 120, { tex: texSmoke, add: false, life: [5, 9], power: [10, 30], radius: 4, damp: 0.84, gravity: 0.3, size: [[0, 3], [1, 16]],
    colors: [[0, new Color4(0.75, 0.62, 0.45, 0)], [0.05, new Color4(0.72, 0.6, 0.44, 0.7)], [1, new Color4(0.78, 0.68, 0.55, 0)]],
    dir: (o) => { const a = Math.random() * Math.PI * 2; o.set(Math.cos(a), Math.random() * 0.12, Math.sin(a)); } });
  flash(muzzle, 30, 0.5, 25);
  addTrauma(0.75);
  sfx.launch(len(sub(muzzle, a3(scene.activeCamera!.position))));
}

// ===== اهتزاز الكاميرا (نموذج trauma) =====
let trauma = 0, shakeT = 0, shakeScale = 1;
function addTrauma(x: number) { trauma = Math.min(1, trauma + x); }

// ===== الصوت (مولّد بالكود) =====
const sfx = (() => {
  let ac: AudioContext | null = null, master: GainNode, lp: BiquadFilterNode, muted = false;
  let jetG: GainNode | null = null, rocketG: GainNode | null = null;
  const noise = (sec: number) => { const b = ac!.createBuffer(1, ac!.sampleRate * sec, ac!.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
  function loop(freq: number, q: number, type: BiquadFilterType) {
    const s = ac!.createBufferSource(); s.buffer = noise(2); s.loop = true; const f = ac!.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac!.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(lp); s.start(); return g;
  }
  return {
    init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try { ac = new AudioContext(); } catch { return; }
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000;
      lp.connect(master).connect(ac.destination);
      jetG = loop(1100, 0.9, 'bandpass'); rocketG = loop(700, 0.6, 'lowpass');
    },
    set muted(m: boolean) { muted = m; if (ac) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); },
    get muted() { return muted; },
    frame(jetDist: number, rocketDist: number, rocketOn: boolean, ts: number) {
      if (!ac) return;
      const t = ac.currentTime;
      jetG?.gain.setTargetAtTime(clamp(120 / Math.max(1, jetDist), 0, 0.5), t, 0.1);
      rocketG?.gain.setTargetAtTime(rocketOn ? clamp(260 / Math.max(1, rocketDist), 0, 0.8) : 0, t, 0.08);
      lp.frequency.setTargetAtTime(ts < 0.6 ? 500 : 18000, t, 0.15);
    },
    launch(dist: number) {
      if (!ac) return; const t = ac.currentTime + dist / 343;
      const s = ac.createBufferSource(); s.buffer = noise(4.5); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1600, t); f.frequency.exponentialRampToValueAtTime(220, t + 4);
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + 4.4);
      s.connect(f).connect(g).connect(lp); s.start(t); s.stop(t + 4.5);
      const o = ac.createOscillator(), og = ac.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
      og.gain.setValueAtTime(0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.connect(og).connect(lp); o.start(t); o.stop(t + 0.8);
    },
    boom(dist: number, big: boolean) {
      if (!ac) return; const t = ac.currentTime + Math.min(2.5, dist / 343), d = big ? 3.2 : 2;
      const s = ac.createBufferSource(); s.buffer = noise(d); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(big ? 2600 : 1800, t); f.frequency.exponentialRampToValueAtTime(70, t + d);
      const g = ac.createGain(), v0 = clamp(900 / Math.max(200, dist), 0.25, 1.2); g.gain.setValueAtTime(v0, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(f).connect(g).connect(lp); s.start(t); s.stop(t + d);
      const o = ac.createOscillator(), og = ac.createGain(); o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(22, t + 1.2);
      og.gain.setValueAtTime(v0, t); og.gain.exponentialRampToValueAtTime(0.001, t + 1.3); o.connect(og).connect(lp); o.start(t); o.stop(t + 1.4);
    },
  };
})();

// ===== حالة المشهد =====
let hitPos: V3 = [0, 0, 0];
let T = 0, cruise: Cruise, inters: (Interceptor | null)[] = [null, null], hitT = -1, wreck: Debris | null = null, wreckLandT = -1, selfDestructT = -1, endShown = false;
let debris: { d: Debris; mesh: Mesh }[] = [];
let shot = '', shotStart = 0, camPos = new Vector3(), camTgt = new Vector3(), interceptCam: { pos: Vector3; tgt: Vector3 } | null = null;
let freeCam = false, running = false;
const debrisMat = new PBRMaterial('debrisMat', scene); debrisMat.albedoColor = new Color3(0.2, 0.2, 0.2); debrisMat.roughness = 0.8; debrisMat.metallic = 0.3; debrisMat.environmentIntensity = 0;

function resetScene() {
  fxList.forEach(f => f.done()); fxList = [];
  transient.splice(0).forEach(x => x.dispose());
  debris.forEach(d => d.mesh.dispose()); debris = [];
  trails.forEach(t => t.reset()); wreckTrail.reset(); debrisTrail.reset();
  flames.forEach(f => (f.emitRate = 0));
  interNodes.forEach(n => n.setEnabled(false));
  rocketLight.intensity = 0; boomLight.intensity = 0;
  cruise = newCruise(); inters = [null, null]; hitT = -1; wreck = null; wreckLandT = -1; selfDestructT = -1; endShown = false;
  cruiseNode.setEnabled(true); cruiseNode.rotationQuaternion = null; cruiseNode.rotation.setAll(0);
  T = 0; shot = ''; interceptCam = null; trauma = 0; timeScale = 1;
  ($('end') as HTMLElement).hidden = true;
}

function orient(node: TransformNode, p: V3, vel: V3) {
  node.position.set(p[0], p[1], p[2]);
  node.lookAt(node.position.add(v(vel)));
}

// ===== منطق كل إطار =====
const cap = $('cap'), subEl = $('sub');
let capText = '';
function caption(t: string, s = '') { if (t !== capText) { cap.textContent = t; capText = t; } subEl.textContent = s; }
const km = (m: number) => (m / 1000).toFixed(1);

function simStep(dt: number) {
  T += dt;
  if (cruise.alive) stepCruise(cruise, dt);
  if (!inters[0] && T >= LAUNCH_T) { inters[0] = newInterceptor(MUZZLES[0]); interNodes[0].setEnabled(true); trails[0].on = true; launchFx(MUZZLES[0]); }
  if (!inters[1] && T >= LAUNCH_T + SECOND_DELAY) { inters[1] = newInterceptor(MUZZLES[3]); interNodes[1].setEnabled(true); trails[1].on = true; launchFx(MUZZLES[3]); }
  inters.forEach((m, i) => {
    if (!m || m.state !== 'fly') return;
    const r = stepInterceptor(m, cruise.alive ? cruise : null, dt);
    if (r === 'hit' && cruise.alive) {
      cruise.alive = false; hitT = T; hitPos = [...m.p] as V3; explode(m.p, true, cruise.v); endFlight(i);
      // الجسم الرئيسي يسقط محترقاً + شظايا صغيرة
      wreck = { p: [...cruise.p] as V3, v: add(scale(cruise.v, 0.5), [0, 25, 0]), spin: [1.6, 0.9, 2.3], rot: [0, 0, 0], alive: true, size: 1 };
      wreckTrail.on = true;
      const rr = rng(Math.floor(T * 1000));
      for (let k = 0; k < 26; k++) {
        const dir = norm([rr() - 0.5, rr() - 0.3, rr() - 0.5]), sp = 50 + rr() * 140;
        const d: Debris = { p: [...cruise.p] as V3, v: add(scale(cruise.v, 0.35), scale(dir, sp)), spin: [rr() * 9, rr() * 9, rr() * 9], rot: [0, 0, 0], alive: true, size: 0.25 + rr() * 0.7 };
        const mesh = MeshBuilder.CreateBox('deb', { width: d.size, height: d.size * 0.4, depth: d.size * 1.4 }, scene); mesh.material = debrisMat; mesh.isPickable = false;
        debris.push({ d, mesh });
      }
      selfDestructT = T + 2.4;
    } else if (!cruise.alive && i === 1 && selfDestructT > 0 && T >= selfDestructT) { m.state = 'boom'; explode(m.p, false, m.v); endFlight(i); selfDestructT = -1; }
  });
  if (wreck && wreck.alive && stepDebris(wreck, dt)) { wreckLandT = T; wreckTrail.stop(); explode([wreck.p[0], wreck.p[1] + 3, wreck.p[2]], true); groundDust(wreck.p); }
  for (const x of debris) if (x.d.alive) stepDebris(x.d, dt);
}
function endFlight(i: number) { interNodes[i].setEnabled(false); trails[i].stop(); flames[i].emitRate = 0; }
function groundDust(p: V3) {
  burst('dustRing', [p[0], p[1] + 1, p[2]], 160, { tex: texSmoke, add: false, life: [6, 11], power: [20, 60], radius: 3, damp: 0.85, gravity: 0.4, size: [[0, 5], [1, 30]],
    colors: [[0, new Color4(0.72, 0.6, 0.45, 0)], [0.04, new Color4(0.7, 0.58, 0.43, 0.8)], [1, new Color4(0.78, 0.68, 0.55, 0)]],
    dir: (o) => { const a = Math.random() * Math.PI * 2; o.set(Math.cos(a), Math.random() * 0.2, Math.sin(a)); } });
}

function syncVisuals(simDt: number) {
  if (cruise.alive) orient(cruiseNode, cruise.p, cruise.v);
  else if (wreck) { cruiseNode.position.set(wreck.p[0], wreck.p[1], wreck.p[2]); cruiseNode.rotation.set(wreck.rot[0], wreck.rot[1], wreck.rot[2]); if (!wreck.alive) cruiseNode.setEnabled(T - wreckLandT < 0.15); }
  if (wreck?.alive) wreckTrail.update(wreck.p, simDt);
  inters.forEach((m, i) => {
    if (!m || m.state !== 'fly') return;
    orient(interNodes[i], m.p, m.v);
    const tail = add(m.p, scale(norm(m.v), -2.9));
    trails[i].update(tail, simDt);
    flames[i].emitRate = 500 * Q();
    glows[i].scaling.setAll(2.6 + Math.random() * 1.2);
  });
  // ضوء الصاروخ الأول (ينير الأرض والدخان)
  const lead = inters.find(m => m && m.state === 'fly');
  if (lead) { rocketLight.position.set(...add(lead.p, scale(norm(lead.v), -4))); rocketLight.intensity = 5 + Math.random() * 2; } else rocketLight.intensity = 0;
  // الشظايا: موقع + أثر دخان مشترك
  let alive = 0;
  for (const x of debris) { x.mesh.position.set(...x.d.p); x.mesh.rotation.set(...x.d.rot); if (x.d.alive) alive++; }
  debrisTrail.ps.emitRate = alive ? 220 * Q() * (alive / Math.max(1, debris.length)) : 0;
  if (alive) debrisTrail.ps.startPositionFunction = (_w: Matrix, out: Vector3) => { const l = debris.filter(x => x.d.alive); const x = l[(Math.random() * l.length) | 0]; out.set(...x.d.p); };
}

// ===== المخرج: لقطات الكاميرا =====
function setShot(s: string) { if (s !== shot) { shot = s; shotStart = T; } }
function director(dtReal: number) {
  const c = cruise, m0 = inters[0];
  let pos: Vector3, tgt: Vector3, snap = false, fov = 0.82;
  const prev = shot;
  if (hitT < 0) {
    if (T < 5.6) setShot('approach');
    else if (T < LAUNCH_T - 0.6) setShot('battery');
    else if (T < LAUNCH_T + SECOND_DELAY + 1.5) setShot('launch');
    else if (m0 && len(sub(m0.p, c.p)) > 1100) setShot('track');
    else setShot('intercept');
  } else if (wreck && (wreck.alive || T - wreckLandT < 3.5)) setShot(T - hitT < 2.2 ? 'intercept' : 'fall');
  else setShot('end');
  snap = prev !== shot;

  const up: V3 = [0, 1, 0];
  switch (shot) {
    case 'approach': {
      const f = norm(c.v), r = norm([f[2], 0, -f[0]]), k = (T - shotStart) / 5.6;
      pos = v(add(add(c.p, scale(f, lerp(-16, -9, k))), add(scale(r, lerp(7.5, 5, k)), [0, lerp(2.4, 1.2, k), 0])));
      tgt = v(add(c.p, scale(f, 9)));
      caption('صاروخ كروز Kh-101 يقترب بين الجبال', `الارتفاع ${Math.round(c.p[1] - terrainH(c.p[0], c.p[2]))} م فوق الأرض · ${Math.round(CRUISE_SPEED * 3.6)} كم/س`);
      break;
    }
    case 'battery': {
      const k = (T - shotStart) / (LAUNCH_T - 0.6 - 5.6), a = lerp(2.25, 2.62, k), r = 34;
      pos = new Vector3(6 + Math.cos(a) * r, 4.2, Math.sin(a) * r); tgt = new Vector3(4, 6.5, 0);
      caption('رادار الباتريوت رصد الهدف', `المسافة ${km(len(c.p))} كم · يقترب بسرعة ${Math.round(CRUISE_SPEED * 3.6)} كم/س`);
      break;
    }
    case 'launch': {
      const k = clamp((T - shotStart) / 3.5, 0, 1);
      pos = new Vector3(lerp(70, 64, k), lerp(4, 5, k), lerp(78, 72, k));
      const look = m0 ? Vector3.Lerp(new Vector3(0, 10, 0), v(m0.p), clamp((T - LAUNCH_T) / 2.5, 0, 0.45)) : new Vector3(0, 10, 0);
      tgt = look; fov = 0.8;
      caption(T < LAUNCH_T ? 'جاهز للإطلاق' : T < LAUNCH_T + SECOND_DELAY ? 'إطلاق!' : 'إطلاق المعترض الثاني', T >= LAUNCH_T ? 'باتريوت يطلق معترضين على كل هدف لضمان الإصابة' : '');
      break;
    }
    case 'track': {
      const f = norm(m0!.v), r = norm([f[2], 0, -f[0]]);
      pos = v(add(add(m0!.p, scale(f, -42)), add(scale(r, 9), [0, 6, 0]))); tgt = v(add(m0!.p, scale(f, 60)));
      caption('المعترض يلاحق الهدف', `${Math.round(len(m0!.v) * 3.6).toLocaleString('en')} كم/س · المسافة للهدف ${km(len(sub(c.p, m0!.p)))} كم`);
      break;
    }
    case 'intercept': {
      if (!interceptCam) {
        const rel = m0 ? sub(c.p, m0.p) : [1, 0, 0] as V3, closing = m0 ? Math.max(200, -(rel[0] * (c.v[0] - m0.v[0]) + rel[1] * (c.v[1] - m0.v[1]) + rel[2] * (c.v[2] - m0.v[2])) / Math.max(1, len(rel))) : 1;
        const meet = add(c.p, scale(c.v, len(rel) / closing)), los = norm(rel);
        let side = norm([los[2], 0, -los[0]]); if (side[2] < 0) side = scale(side, -1);
        const cp = add(add(meet, scale(side, 240)), [0, -25, 0]); cp[1] = Math.max(cp[1], terrainH(cp[0], cp[2]) + 12);
        interceptCam = { pos: v(cp), tgt: v(meet) };
      }
      pos = interceptCam.pos; tgt = hitT > 0 ? v(hitPos) : Vector3.Lerp(interceptCam.tgt, v(c.p), 0.35); fov = 0.72;
      caption(hitT < 0 ? 'اعتراض…' : 'تم تدمير الهدف ✓', hitT < 0 ? `المسافة بين الصاروخين ${Math.round(len(sub(c.p, m0!.p)))} م` : 'صاعق تقاربي فجّر الرأس الحربي قرب الهدف');
      break;
    }
    case 'fall': {
      const w = wreck!.p;
      if (snap) camPos = v(add(w, [-260, -60, 300]));
      const base = camPos.clone(); base.y = Math.max(base.y, terrainH(base.x, base.z) + 15);
      pos = base; tgt = v(w); fov = 0.62;
      caption(wreck!.alive ? 'حطام الصاروخ يسقط' : 'سقط الحطام بعيداً عن الهدف', selfDestructT < 0 && inters[1]?.state === 'boom' ? 'المعترض الثاني فجّر نفسه ذاتياً بعد ما انتهى الهدف' : '');
      break;
    }
    default: {
      const k = (T - shotStart) / 10, a = lerp(0.9, 1.15, k), hp = hitPos;
      const cp: V3 = [hp[0] + Math.cos(a) * 900, 0, hp[2] + Math.sin(a) * 900]; cp[1] = terrainH(cp[0], cp[2]) + 14;
      pos = v(cp); tgt = v(add(hp, [0, 45, 0])); fov = 0.85;
      caption('السماء بعد الاعتراض', 'دخان الانفجار وآثار الصواريخ تبقى معلّقة بالجو وتتفرّق ويا الريح');
      if (!endShown && T - shotStart > 4) { endShown = true; showEnd(); }
    }
  }
  // تنعيم الحركة إلا عند القطع
  const k = snap ? 1 : 1 - Math.exp(-dtReal * (shot === 'approach' || shot === 'track' ? 14 : 6));
  camPos = snap ? pos.clone() : Vector3.Lerp(camPos, pos, k);
  camTgt = snap ? tgt.clone() : Vector3.Lerp(camTgt, tgt, k);
  if (camPos.y < terrainH(camPos.x, camPos.z) + 1.5) camPos.y = terrainH(camPos.x, camPos.z) + 1.5;
  // الشاشة بالطول: نثبت الزاوية الأفقية حتى ما يطلع الهدف برّا الصورة
  const portrait = engine.getRenderWidth() < engine.getRenderHeight();
  cine.fovMode = portrait ? Camera.FOVMODE_HORIZONTAL_FIXED : Camera.FOVMODE_VERTICAL_FIXED;
  const want = portrait ? fov * 0.95 : fov;
  cine.fov = lerp(cine.fov, want, snap ? 1 : 1 - Math.exp(-dtReal * 4));
  // اهتزاز
  trauma = Math.max(0, trauma - dtReal * 1.1); shakeT += dtReal * 28;
  const sh = trauma * trauma * shakeScale, dist = Vector3.Distance(camPos, camTgt);
  const off = new Vector3(Math.sin(shakeT * 1.7) * 0.012, Math.sin(shakeT * 2.3 + 1) * 0.009, Math.sin(shakeT * 1.3 + 2) * 0.01).scale(sh * dist);
  cine.position.copyFrom(camPos);
  cine.setTarget(camTgt.add(off));
}

// ===== الحركة البطيئة حول لحظة الاعتراض =====
function updateTimeScale(dtReal: number) {
  let target = 1;
  const m0 = inters[0];
  if (hitT < 0 && m0 && m0.state === 'fly' && cruise.alive) { const d = len(sub(m0.p, cruise.p)); if (d < 300) target = 0.1; else if (d < 900) target = 0.35; }
  if (hitT > 0) { const since = T - hitT; target = since < 0.12 ? 0.1 : since < 1.0 ? 0.35 : 1; }
  timeScale = lerp(timeScale, target, 1 - Math.exp(-dtReal * 8));
}

// ===== الحلقة =====
const fpsEl = $('fps');
let fpsAcc = 0, fpsN = 0, fpsT = 0, fpsSamples: number[] = [], autoChecked = false;
function frame() {
  const dtReal = Math.min(engine.getDeltaTime() / 1000, 1 / 20);
  if (running) {
    updateTimeScale(dtReal);
    const dt = dtReal * timeScale * userSlow;
    const sub = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < sub; i++) simStep(dt / sub);
    syncVisuals(dt);
    for (const f of fxList) { f.t += dtReal; f.tick(Math.min(1, f.t / f.dur), dtReal); }
    fxList = fxList.filter(f => { if (f.t >= f.dur) { f.done(); return false; } return true; });
    // الجسيمات تتقدم بنفس زمن المحاكاة حتى لو الإطارات قليلة (dtReal مقصوص)
    const clampK = dtReal / Math.max(1e-4, engine.getDeltaTime() / 1000);
    for (const p of systems) p.updateSpeed = ((timeScale * userSlow) / 60) * clampK;
    if (!freeCam) director(dtReal);
    const cam = scene.activeCamera!.position;
    const lead = inters.find(m => m && m.state === 'fly');
    sfx.frame(cruise.alive ? Vector3.Distance(cam, v(cruise.p)) : 1e9, lead ? Vector3.Distance(cam, v(lead.p)) : 1e9, !!lead, timeScale * userSlow);
  }
  scene.render();
  // عدّاد الإطارات + خفض الجودة تلقائياً إذا التلفون ما يلحق
  const fps = engine.getFps(); fpsAcc += fps; fpsN++; fpsT += dtReal;
  if (fpsT > 0.5) {
    const avg = fpsAcc / fpsN; fpsEl.textContent = `${avg.toFixed(0)} FPS · ${quality === 'high' ? 'عالية' : 'منخفضة'}`;
    if (running && T > 1.5 && T < 5.5) fpsSamples.push(avg);
    fpsAcc = fpsN = fpsT = 0;
  }
  if (!autoChecked && running && T >= 5.5 && !AUTO) {
    autoChecked = true; const avg = fpsSamples.reduce((a, b) => a + b, 0) / Math.max(1, fpsSamples.length);
    if (quality === 'high' && avg < 32) { setQuality('low'); toast(`خفّضت الجودة تلقائياً (${avg.toFixed(0)} إطار/ثانية) حتى تبقى الحركة سلسة`); }
  }
  (window as any).__scene = scene; (window as any).__state = { T, shot, timeScale, fps, hit: hitT, landed: wreckLandT, quality };
}

// ===== الواجهة =====
function toast(m: string) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout((toast as any).h); (toast as any).h = setTimeout(() => t.classList.remove('show'), 3200); }
function setQuality(q: Quality) {
  quality = q; applyScaling(); applyPipeline(); setupShadows(patriotMeshes);
  ($('bQual') as HTMLElement).textContent = 'الجودة: ' + (q === 'high' ? 'عالية' : 'منخفضة');
}
function showEnd() {
  const m0 = inters[0];
  $('endTxt').textContent = `الاعتراض صار على بعد ${km(m0 ? len(m0.p) : 0)} كم من البطارية، بعد ${(hitT - LAUNCH_T).toFixed(1)} ثانية من الإطلاق. هاي بس البداية: نفس الأسلوب نستخدمه لكل الأسلحة باللعبة.`;
  ($('end') as HTMLElement).hidden = false;
}
function setFree(on: boolean) {
  freeCam = on; ($('bCam') as HTMLElement).setAttribute('aria-pressed', String(on));
  if (on) { orbit.setTarget(new Vector3(4, 5, 0)); orbit.radius = 70; scene.activeCamera = orbit; orbit.attachControl(canvas, true); toast('حرّك بإصبع للدوران، وبإصبعين للتقريب'); }
  else { orbit.detachControl(); scene.activeCamera = cine; }
}
function start() {
  sfx.init(); resetScene(); running = true;
  ($('intro') as HTMLElement).hidden = true; ($('ctl') as HTMLElement).hidden = false;
}
$('bStart').onclick = start;
$('bReplay').onclick = () => { setFree(false); start(); };
$('bAgain').onclick = () => { setFree(false); start(); };
$('bFree').onclick = () => { ($('end') as HTMLElement).hidden = true; setFree(true); };
$('bCam').onclick = () => setFree(!freeCam);
$('bSlow').onclick = () => { userSlow = userSlow === 1 ? 0.5 : 1; $('bSlow').setAttribute('aria-pressed', String(userSlow < 1)); };
$('bQual').onclick = () => setQuality(quality === 'high' ? 'low' : 'high');
$('bMute').onclick = () => { sfx.muted = !sfx.muted; $('bMute').setAttribute('aria-pressed', String(sfx.muted)); $('bMute').textContent = sfx.muted ? '🔇 الصوت' : '🔊 الصوت'; };
$('bCred').onclick = () => (($('credits') as HTMLElement).hidden = false);
$('bCredClose').onclick = () => (($('credits') as HTMLElement).hidden = true);
window.addEventListener('resize', () => engine.resize());
document.addEventListener('visibilitychange', () => { if (!document.hidden) sfx.init(); });

// ===== التشغيل =====
(async () => {
  const load = $('load');
  try {
    await loadModels(t => (load.textContent = t));
    buildFlames();
    cruise = newCruise(); orient(cruiseNode, cruise.p, cruise.v);
    camPos = v(add(cruise.p, [-30, 6, 14])); camTgt = v(cruise.p); cine.position.copyFrom(camPos); cine.setTarget(camTgt);
    await scene.whenReadyAsync();
    load.textContent = 'جاهز.'; ($('bStart') as HTMLButtonElement).disabled = false;
    engine.runRenderLoop(frame);
    if (AUTO) start();
  } catch (e) {
    load.textContent = 'صار خطأ بالتحميل: ' + (e as Error).message; console.error(e);
  }
})();
