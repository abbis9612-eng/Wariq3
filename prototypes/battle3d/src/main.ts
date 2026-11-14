// معركة الهجوم 3D (D-024): نفس معركة اللعبة الأساسية بالضبط (sim.ts نقل حرفي)، والرسم هنا بس:
// أرض حسب نوع المنطقة، بيوت حقيقية، دبابات/مدفعية/غراد/دفاع جوي/مسيّرات/طيارات/هليكوبترات بمجسمات حقيقية،
// جنود متحركين (حركات مخبوزة)، انفجارات فليب بوك، دخان، أصوات حقيقية، وكاميرا «مخرج» تتبع المراحل.
// الأصول (مجسمات/قوام/أصوات) تنقرا من المسرح المجمّد ../theater (D-023) بدون تعديل.
import {
  Engine, Scene, Vector3, Color3, Color4, FreeCamera, Camera, HemisphericLight, DirectionalLight, PointLight, ShadowGenerator, MeshBuilder, Mesh,
  StandardMaterial, PBRMaterial, DynamicTexture, ParticleSystem, TransformNode, DefaultRenderingPipeline, ImageProcessingConfiguration,
  LoadAssetContainerAsync, AssetContainer, Matrix, Particle, BaseTexture, Texture, Quaternion, AbstractMesh, VertexData, VertexAnimationBaker, BakedVertexAnimationManager, Material,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { SkyMaterial } from '@babylonjs/materials/sky';
import { create, step, bars, phase, skip, stamp, SAMPLES, VW, VH, END, CARD, World, Res, Terr, Unit, Fx, Proj, Air, Heli } from './sim';

type V3 = [number, number, number];
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const $ = (id: string) => document.getElementById(id)!;

const urls = import.meta.glob('../models/*.gltf.json', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const modelUrl = (n: string) => urls[`../models/${n}.gltf.json`];
const texUrls = import.meta.glob('../../theater/textures/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const tUrl = (n: string) => texUrls[`../../theater/textures/${n}.webp`];
const sndUrls = import.meta.glob('../../theater/sounds/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

// ===== إعداد =====
const qs = new URLSearchParams(location.search);
const AUTO = qs.has('auto');
const canvas = $('c') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: AUTO }, true);
engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
const scene = new Scene(engine);
scene.skipPointerMovePicking = true;
const v = (a: V3) => new Vector3(a[0], a[1], a[2]);
/** إحداثيات الميدان (بكسل الأصل) ← متر بالعالم: x يمين، z لقدّام (العدو فوق الشاشة = +z) */
const WX = (x: number) => x - VW / 2, WZ = (y: number) => VH / 2 - y;
/** زاوية الأصل (atan2 بالشاشة، y لتحت) ← اتجاه Babylon (0 = +z) */
const yawOf = (a: number) => Math.atan2(Math.cos(a), -Math.sin(a));
const SUN = norm([0.42, 0.78, 0.46]);
const NL = 4;

// ===== ضوء وسماء =====
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
hemi.intensity = 0.42; hemi.diffuse = new Color3(0.7, 0.76, 0.88); hemi.groundColor = new Color3(0.45, 0.38, 0.3);
const sun = new DirectionalLight('sun', v([-SUN[0], -SUN[1], -SUN[2]]), scene); sun.intensity = 0.8; sun.diffuse = new Color3(1, 0.92, 0.8);
const PBR_DIRECT = 2.5;
sun.shadowMinZ = 1; sun.shadowMaxZ = 1600; sun.autoUpdateExtends = false;
const sky = MeshBuilder.CreateBox('sky', { size: 16000 }, scene);
const skyMat = new SkyMaterial('skyMat', scene);
Object.assign(skyMat, { backFaceCulling: false, useSunPosition: true, sunPosition: v([SUN[0] * 1000, SUN[1] * 1000, SUN[2] * 1000]), turbidity: 5, luminance: 1, rayleigh: 2.4, mieCoefficient: 0.005, mieDirectionalG: 0.8, fogEnabled: false });
sky.material = skyMat; sky.infiniteDistance = true; sky.isPickable = false;
scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.00028; scene.fogColor = new Color3(0.83, 0.79, 0.71);
const shadows = new ShadowGenerator(2048, sun); shadows.usePercentageCloserFiltering = true; shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
shadows.bias = 0.004; shadows.normalBias = 0.02; shadows.frustumEdgeFalloff = 1;
const caster = (m: AbstractMesh) => shadows.addShadowCaster(m, false);
const cam = new FreeCamera('cam', new Vector3(0, 120, -520), scene); cam.minZ = 1; cam.maxZ = 30000; cam.inputs.clear();
const pipe = new DefaultRenderingPipeline('pipe', true, scene, [cam]);
pipe.fxaaEnabled = true; pipe.bloomEnabled = true; pipe.bloomThreshold = 0.8; pipe.bloomWeight = 0.4; pipe.bloomKernel = 40; pipe.bloomScale = 0.5;
{ const ip = pipe.imageProcessing; ip.toneMappingEnabled = true; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = 1.7; ip.contrast = 1.15; ip.vignetteEnabled = true; ip.vignetteWeight = 1.3; }
const prepMat = (m: Material) => { if (m instanceof PBRMaterial) { m.environmentIntensity = 0; m.directIntensity = PBR_DIRECT; m.metallic = Math.min(m.metallic ?? 1, 0.15); m.maxSimultaneousLights = 2 + NL; } };

// ===== قوام بالكود =====
function canvasTex(name: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const t = new DynamicTexture(name, { width: size, height: size }, scene, true);
  const g = t.getContext() as unknown as CanvasRenderingContext2D; g.clearRect(0, 0, size, size); draw(g, size); t.update(); t.hasAlpha = true; return t;
}
const radial = (stops: [number, string][]) => (g: CanvasRenderingContext2D, s: number) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, s, s); };
const texSoft = canvasTex('soft', 64, radial([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]));
const texFlare = canvasTex('flare', 64, radial([[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,235,190,.9)'], [0.4, 'rgba(255,160,60,.3)'], [1, 'rgba(255,120,20,0)']]));
const texScorch = canvasTex('scorch', 64, radial([[0, 'rgba(26,20,14,.75)'], [0.45, 'rgba(45,36,24,.42)'], [1, 'rgba(60,45,30,0)']]));
let seedK = 9; const R = () => { seedK = (seedK * 16807) % 2147483647; return seedK / 2147483647; };
const texSmoke = canvasTex('smoke', 128, (g, s) => {
  for (let i = 0; i < 22; i++) { const a = R() * 6.28, r = R() * s * 0.22, x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r, rad = s * (0.12 + R() * 0.16), k = 0.75 + R() * 0.25;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${255 * k | 0},${255 * k | 0},${255 * k | 0},.5)`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'destination-in'; radial([[0, 'rgba(0,0,0,1)'], [0.3, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']])(g, s);
});
const fxTex = (n: string) => { const t = new Texture(tUrl(n), scene, false, true, Texture.TRILINEAR_SAMPLINGMODE); t.hasAlpha = true; return t; };

// ===== الأرض: نفس ألوان الأصل حسب نوع المنطقة (PAL) + ارتفاعات خفيفة بالميدان وجبال بالأفق =====
const PAL: Record<Terr, number[][]> = { desert: [[214, 190, 140], [190, 160, 108], [160, 128, 84]], plain: [[112, 128, 70], [136, 142, 82], [168, 156, 104]], hills: [[104, 116, 72], [140, 132, 90], [150, 140, 118]], mount: [[96, 104, 84], [128, 124, 112], [176, 172, 164]] };
const TERR_N: Record<Terr, string> = { plain: 'سهل', desert: 'صحراء', hills: 'تلال', mount: 'جبال' };
let terr: Terr = 'desert', gSeed = 3;
function vnoise(sx: number, sy: number, seed: number) {
  const h = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453; return n - Math.floor(n); };
  const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0, s = (t: number) => t * t * (3 - 2 * t);
  return h(x0, y0) * (1 - s(fx)) * (1 - s(fy)) + h(x0 + 1, y0) * s(fx) * (1 - s(fy)) + h(x0, y0 + 1) * (1 - s(fx)) * s(fy) + h(x0 + 1, y0 + 1) * s(fx) * s(fy);
}
const fbm = (x: number, y: number, s: number) => vnoise(x, y, s) * .5 + vnoise(x * 2.1, y * 2.1, s + 7) * .27 + vnoise(x * 4.3, y * 4.3, s + 13) * .15 + vnoise(x * 9, y * 9, s + 29) * .08;
const AMP: Record<Terr, [number, number]> = { desert: [3, 60], plain: [1.5, 25], hills: [9, 220], mount: [16, 650] };   // [بالميدان، بالأفق]
function groundH(x: number, z: number) {
  const [a, b] = AMP[terr], out = Math.max(Math.abs(x) - 260, Math.abs(z) - 470, 0), road = Math.max(0, 1 - roadD(x, z) / 30);
  return (fbm(x / 260 + 5, z / 260 + 5, gSeed) - 0.45) * a * (1 - road * 0.7) + smooth(80, 1400, out) * (fbm(x / 700, z / 700, gSeed + 3) * 1.3 - 0.15) * b;
}
// الطريق: نفس منحنى الأصل (من تحت الوسط، يتلوى، للقرية)
const ROAD: V3[] = (() => { const P = (x: number, y: number): [number, number] => [WX(x * VW), WZ(y * VH)];
  const a = P(.5, 1), b = P(.3, .7), c = P(.7, .45), d = P(.52, .2), e = P(.5, 0), out: V3[] = [[a[0], 0, a[1] - 900]];
  for (let i = 0; i <= 40; i++) { const t = i / 40, u = 1 - t; out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], 0, u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]); }
  out.push([e[0], 0, e[1]], [e[0], 0, e[1] + 900]); return out; })();
function roadD(x: number, z: number) { let m = 1e9; for (let i = 0; i < ROAD.length - 1; i++) { const [ax, , az] = ROAD[i], [bx, , bz] = ROAD[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; }
let ground: Mesh | null = null, roadMesh: Mesh | null = null;
const SAND = [205, 178, 140];   // متوسط لون قوام الرمل: نقسم عليه حتى اللون النهائي = لون الأصل
const sandT = new Texture(tUrl('sand'), scene); sandT.uScale = sandT.vScale = 4000 / 9; sandT.anisotropicFilteringLevel = 8;
const sandN = new Texture(tUrl('sand_nor'), scene); sandN.uScale = sandN.vScale = 4000 / 9; sandN.level = 0.7;
const roadT = new Texture(tUrl('road'), scene); roadT.anisotropicFilteringLevel = 8;
const groundMat = new StandardMaterial('gm', scene); groundMat.diffuseTexture = sandT; groundMat.bumpTexture = sandN; groundMat.specularColor = new Color3(0.03, 0.03, 0.03); groundMat.maxSimultaneousLights = 2 + NL;
const roadMat = new StandardMaterial('rm', scene); roadMat.diffuseTexture = roadT; roadMat.specularColor = Color3.Black(); roadMat.zOffset = -1; roadMat.maxSimultaneousLights = 2 + NL;
function buildGround() {
  ground?.dispose(); roadMesh?.dispose();
  const N = 220, S = 4000, pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [], p = PAL[terr];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    // شبكة أكثف بالوسط: نضغط الإحداثيات بمنحنى
    const fx = (i / N) * 2 - 1, fz = (j / N) * 2 - 1, x = Math.sign(fx) * Math.pow(Math.abs(fx), 1.6) * S / 2, z = Math.sign(fz) * Math.pow(Math.abs(fz), 1.6) * S / 2;
    const y = groundH(x, z); pos.push(x, y, z); uv.push(x / S + 0.5, z / S + 0.5);
    // الألوان مثل makeGround بالأصل: خليط ثلاث درجات حسب الضجيج + ظل المنحدر + رقع حقول بالسهل
    const h = fbm(x / 420 * 3.5 + 2, z / 420 * 3.5 + 2, gSeed), t = clamp((h - .3) * 2.2, 0, 1), A = t < .5 ? p[0] : p[1], B = t < .5 ? p[1] : p[2], u = t < .5 ? t * 2 : (t - .5) * 2;
    const sl = (groundH(x + 6, z + 6) - groundH(x - 6, z - 6)) * 2.2, patch = terr === 'plain' ? ((Math.floor(x / 38 + vnoise(z / 70, 3, gSeed)) + Math.floor(z / 31)) % 2 ? 7 : -7) : 0, rock = terr === 'mount' || terr === 'hills' ? smooth(30, 160, y) * 40 : 0;
    for (let q = 0; q < 3; q++) col.push(clamp((A[q] + (B[q] - A[q]) * u - sl + patch + rock) / SAND[q] * 1.05, 0, 1.5)); col.push(1);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const vd = new VertexData(); vd.positions = pos; vd.indices = idx; vd.uvs = uv; vd.colors = col; const nor: number[] = []; VertexData.ComputeNormals(pos, idx, nor); vd.normals = nor;
  ground = new Mesh('ground', scene); vd.applyToMesh(ground); ground.material = groundMat; ground.receiveShadows = true; ground.isPickable = false;
  // الطريق شريط فوق الأرض
  const L: Vector3[] = [], Rr: Vector3[] = [];
  const pts: V3[] = []; for (let i = 0; i < ROAD.length - 1; i++) { const [ax, , az] = ROAD[i], [bx, , bz] = ROAD[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 6)); for (let k = 0; k < n; k++) pts.push([lerp(ax, bx, k / n), 0, lerp(az, bz, k / n)]); }
  pts.forEach((q, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], d = norm([b[0] - a[0], 0, b[2] - a[2]]), w = 4;
    L.push(new Vector3(q[0] - d[2] * w, groundH(q[0] - d[2] * w, q[2] + d[0] * w) + 0.12, q[2] + d[0] * w)); Rr.push(new Vector3(q[0] + d[2] * w, groundH(q[0] + d[2] * w, q[2] - d[0] * w) + 0.12, q[2] - d[0] * w)); });
  roadMesh = MeshBuilder.CreateRibbon('road', { pathArray: [L, Rr] }, scene);
  const ruv: number[] = []; let acc = 0; for (let i = 0; i < pts.length; i++) { if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]); ruv.push(0, acc / 8); } for (let i = 0; i < pts.length; i++) ruv.push(1, ruv[i * 2 + 1]);
  roadMesh.setVerticesData('uv', ruv); roadMesh.material = roadMat; roadMesh.receiveShadows = true; roadMesh.isPickable = false;
}

// ===== المجسمات =====
const MODEL: Record<string, { f: string; scale: number; yaw: number; y?: number; center?: boolean; off?: V3 }> = {
  abrams: { f: 't_abrams', scale: 1, yaw: 0, y: 0.8 }, t72: { f: 't_t72', scale: 1, yaw: Math.PI, y: 0.8 },
  d30: { f: 't_d30', scale: 0.22, yaw: Math.PI }, grad: { f: 't_grad', scale: 1, yaw: 0 },
  patriot: { f: 't_patriot', scale: 1, yaw: Math.PI / 2 }, s400: { f: 't_s400', scale: 7.2, yaw: 0, y: 0.502 * 7.2 },
  shahed: { f: 't_shahed', scale: 1.45, yaw: 0 }, tb2: { f: 'tb2', scale: 4.3, yaw: 0, center: true },
  su25: { f: 'su25', scale: 0.19, yaw: Math.PI / 2, center: true }, f16: { f: 'f16', scale: 0.0163, yaw: Math.PI / 2, center: true },
  ah64: { f: 'ah64', scale: 7.1, yaw: Math.PI / 2, center: true },
};
const containers: Record<string, AssetContainer> = {};
// البرج منفصل (من المسرح TH5.2): نقسم المثلثات بالمكان
const TURRET: Record<string, { piv: [number, number]; f: (x: number, y: number, z: number) => boolean }> = {
  abrams: { piv: [0, -0.7], f: (x, y, z) => (y > 1.3 && Math.abs(x) < 1.9 && z > -3.7 && z < 1.95) || (y > 1.12 && Math.abs(x) < 0.2 && z > 1.9) },
  t72: { piv: [0, 0.85], f: (x, y, z) => (y > 0.9 && Math.hypot(x, z - 0.85) < 1.75) || (y > 1.25 && Math.abs(x) < 2.05 && z > -1 && z < 3) || (y > 0.9 && Math.abs(x) < 0.3 && z < 0.85) },
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
const wreckMat = new StandardMaterial('wreckMat', scene); wreckMat.diffuseColor = new Color3(0.08, 0.072, 0.065); wreckMat.specularColor = Color3.Black();
function protoSet(kind: string, wreck: boolean) {
  const pr = PROTO[kind]; if (!wreck) return pr;
  if (!pr.dark) { const dk = (ms: Mesh[]) => ms.map(m => { const c = m.clone(m.name + '_w', null, true)!; c.material = wreckMat; c.isVisible = false; return c; }); pr.dark = { hull: dk(pr.hull), tur: dk(pr.tur) }; }
  return pr.dark;
}
async function loadModel(n: string) {
  const spec = MODEL[n], c = await LoadAssetContainerAsync(modelUrl(spec.f), scene, { pluginExtension: '.gltf' });
  c.materials.forEach(prepMat); c.addAllToScene(); c.meshes.forEach(m => { m.isVisible = false; m.isPickable = false; });
  if (spec.center) { let mn = new Vector3(1e9, 1e9, 1e9), mx = new Vector3(-1e9, -1e9, -1e9); c.meshes.forEach(m => { if (!m.getTotalVertices()) return; m.computeWorldMatrix(true); const bb = m.getBoundingInfo().boundingBox; mn = Vector3.Minimize(mn, bb.minimumWorld); mx = Vector3.Maximize(mx, bb.maximumWorld); });
    spec.off = [-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -(mn.z + mx.z) / 2]; }
  if (TURRET[n]) splitTurret(n, c);
  containers[n] = c;
}
interface Spawned { root: TransformNode; inner: TransformNode; tur: TransformNode | null; meshes: AbstractMesh[] }
function spawnModel(kind: string, wreck = false): Spawned {
  const root = new TransformNode('u_' + kind, scene), inner = new TransformNode('in', scene); inner.parent = root;
  const spec = MODEL[kind]; inner.rotation.y = spec.yaw; inner.scaling.setAll(spec.scale); inner.position.y = spec.y ?? 0;
  const ofs = new TransformNode('ofs', scene); ofs.parent = inner; if (spec.off) ofs.position.set(...spec.off);
  const meshes: AbstractMesh[] = [];
  if (PROTO[kind]) {
    const pr = PROTO[kind], set = protoSet(kind, wreck), tur = new TransformNode('tur', scene); tur.parent = ofs; tur.position.copyFrom(pr.piv);
    const mk = (m: Mesh, par: TransformNode) => { const i = m.createInstance(m.name + '_i'); i.parent = par; i.isPickable = false; i.isVisible = true; caster(i); i.receiveShadows = true; meshes.push(i); };
    set.hull.forEach(m => mk(m, ofs)); set.tur.forEach(m => mk(m, tur));
    return { root, inner, tur, meshes };
  }
  const inst = containers[kind].instantiateModelsToScene(n => n, wreck, { doNotInstantiate: wreck });
  inst.rootNodes.forEach(r => { r.parent = ofs; });
  root.getChildMeshes().forEach(m => { m.isPickable = false; m.isVisible = true; caster(m); m.receiveShadows = true; meshes.push(m);
    if (wreck) m.material = wreckMat; });
  return { root, inner, tur: null, meshes };
}

// ===== البيوت والأشجار =====
const HOUSE_TYPES = [
  { model: 't_h_arabic4', s: 1.50, w: 10.6, d: 9.6 }, { model: 't_h_arab1', s: 1.25, w: 12.0, d: 11.6 }, { model: 't_h_arab2', s: 1.62, w: 6.1, d: 12.8 },
  { model: 't_h_arabic1', s: 1.25, w: 10.1, d: 14.9 }, { model: 't_h_desert', s: 0.75, w: 10.4, d: 15.8 }, { model: 't_h_low', s: 1.12, w: 16.2, d: 11.2 },
];
const houseC: AssetContainer[] = [];
async function loadHouses() { await Promise.all(HOUSE_TYPES.map(async (t, i) => { const c = await LoadAssetContainerAsync(modelUrl(t.model), scene, { pluginExtension: '.gltf' }); c.materials.forEach(prepMat); c.addAllToScene(); c.meshes.forEach(m => { m.isVisible = false; m.isPickable = false; }); houseC[i] = c; })); }
const loadProp = async (name: string, fit: 'h' | 'len', size: number, bright = 1): Promise<Mesh[]> => {
  try {
    const c = await LoadAssetContainerAsync(modelUrl(name), scene, { pluginExtension: '.gltf' });
    c.addAllToScene(); c.materials.forEach(prepMat);
    if (bright !== 1) c.materials.forEach(m => { const a = (m as Material & { albedoColor?: Color3 }).albedoColor; if (a) a.scaleInPlace(bright); });
    const ms = c.meshes.filter(m => m.getTotalVertices() > 0) as Mesh[];
    let mn = new Vector3(1e9, 1e9, 1e9), mx = new Vector3(-1e9, -1e9, -1e9);
    ms.forEach(m => { m.computeWorldMatrix(true); const bb = m.getBoundingInfo().boundingBox; mn = Vector3.Minimize(mn, bb.minimumWorld); mx = Vector3.Maximize(mx, bb.maximumWorld); });
    const k = fit === 'h' ? size / (mx.y - mn.y) : size / Math.max(mx.x - mn.x, mx.z - mn.z);
    const N = Matrix.Translation(-(mn.x + mx.x) / 2, -mn.y, -(mn.z + mx.z) / 2).multiply(Matrix.Scaling(k, k, k));
    for (const m of ms) { const wmx = m.computeWorldMatrix(true).clone(); m.setParent(null); m.position.setAll(0); m.rotationQuaternion = null; m.rotation.setAll(0); m.scaling.setAll(1); m.bakeTransformIntoVertices(wmx.multiply(N)); m.isPickable = false; m.isVisible = false; }
    c.meshes.filter(m => m.getTotalVertices() === 0).forEach(m => m.dispose()); c.transformNodes.forEach(t => t.dispose());
    return ms;
  } catch (e) { console.warn('prop', name, e); return []; }
};
const PROPS: Record<string, Mesh[]> = {};
const propMeshes: Mesh[] = [];
function scatterProp(base: Mesh[], mats: number[]) {
  if (!base.length || !mats.length) return;
  for (const b of base) { const m = b.clone(b.name + '_s', null, true)!; m.makeGeometryUnique(); m.isVisible = true; m.receiveShadows = true; m.thinInstanceSetBuffer('matrix', new Float32Array(mats), 16, true); m.thinInstanceRefreshBoundingInfo(false); caster(m); propMeshes.push(m); }
}

// ===== الجنود: حركات مخبوزة بقوام (VAT) — من المسرح TH5.4 =====
type Anim = 'run' | 'simple walk' | 'simple shoot' | 'crouch shoot' | 'pron idle' | 'pron shot' | 'simple death' | 'pron death' | 'idle simple' | 'crouch idle' | 'crouch death' | 'reload crouch';
const SOL_CAP = 160;
let solMesh: Mesh | null = null, SOL_S = 1, vatTime = 0;
const solW0 = Matrix.Identity(), animRange = new Map<string, { s: number; e: number; fps: number; dur: number }>();
let solMat = new Float32Array(16), solSet = new Float32Array(4), solCol = new Float32Array(4), solMan: BakedVertexAnimationManager | null = null;
async function loadSoldier() {
  const c = await LoadAssetContainerAsync(modelUrl('t_soldier'), scene, { pluginExtension: '.gltf' });
  c.materials.forEach(m => { if (m instanceof PBRMaterial) { m.environmentIntensity = 0; m.directIntensity = PBR_DIRECT * 1.8; m.metallic = 0; m.roughness = 0.8; m.emissiveColor = new Color3(0.07, 0.07, 0.06); m.maxSimultaneousLights = 2 + NL; } });
  c.addAllToScene();
  const ms = c.meshes.filter(m => m.getTotalVertices() > 0) as Mesh[], sk = ms[0].skeleton!, par = ms[0].parent;
  ms.forEach(m => { m.parent = null; m.position.setAll(0); m.rotationQuaternion = null; m.rotation.setAll(0); m.scaling.setAll(1); });
  const merged = Mesh.MergeMeshes(ms, true, true, undefined, false, false);
  const body = merged ?? ms[0]; body.skeleton = sk; body.parent = par; body.isPickable = false;
  c.animationGroups.forEach(g => g.stop());
  body.refreshBoundingInfo({ applySkeleton: true }); body.computeWorldMatrix(true);
  const bb = body.getBoundingInfo().boundingBox, h = bb.maximumWorld.y - bb.minimumWorld.y; SOL_S = h > 0.01 ? 1.8 / h : 1;
  solW0.copyFrom(body.getWorldMatrix());
  const frames: Float32Array[] = [];
  for (const g of c.animationGroups) {
    const fps = g.targetedAnimations[0]?.animation.framePerSecond ?? 60, dur = Math.max(0.05, (g.to - g.from) / fps), n = Math.max(2, Math.round(dur * 30) + 1), s0 = frames.length;
    g.start(false, 1, g.from, g.to); g.pause();
    for (let i = 0; i < n; i++) { g.goToFrame(g.from + (g.to - g.from) * i / (n - 1)); sk.bones.forEach(b => b.getTransformNode()?.computeWorldMatrix(true)); sk.prepare(true); frames.push(sk.getTransformMatrices(body).slice()); }
    g.stop(); animRange.set(g.name, { s: s0, e: frames.length - 1, fps: (n - 1) / dur, dur });
  }
  const data = new Float32Array(frames.length * frames[0].length); frames.forEach((f, i) => data.set(f, i * f.length));
  solMan = new BakedVertexAnimationManager(scene); solMan.texture = new VertexAnimationBaker(scene, body).textureFromBakedVertexData(data); body.bakedVertexAnimationManager = solMan;
  c.animationGroups.forEach(g => g.dispose());
  body.parent = null; body.position.setAll(0); body.rotationQuaternion = null; body.rotation.setAll(0); body.scaling.setAll(1);
  c.meshes.forEach(m => { if (m !== body) m.isVisible = false; });
  solMat = new Float32Array(SOL_CAP * 16); solSet = new Float32Array(SOL_CAP * 4); solCol = new Float32Array(SOL_CAP * 4).fill(1);
  body.thinInstanceSetBuffer('matrix', solMat, 16, false);
  body.thinInstanceRegisterAttribute('bakedVertexAnimationSettingsInstanced', 4); body.thinInstanceSetBuffer('bakedVertexAnimationSettingsInstanced', solSet, 4, false);
  body.thinInstanceRegisterAttribute('color', 4); body.thinInstanceSetBuffer('color', solCol, 4, false);
  body.thinInstanceCount = 0; body.alwaysSelectAsActiveMesh = true; body.isVisible = true; body.receiveShadows = true; caster(body);
  solMesh = body;
}
// ترتيب الجنود الخمسة بالمجموعة: نفس نقاط الأصل (drawUnit: 5 نقاط) بمتر
const FORM: [number, number][] = [[-5, -3], [4, -5], [-1, 1], [6, 4], [-6, 5]];
const tS = new Vector3(), tT = new Vector3(), tQ = new Quaternion(), tM = new Matrix(), tO = new Matrix();
const solState = new Map<number, { dieT: number; die: Anim; ph: number; jit: [number, number][] }>();
function drawSoldiers(dt: number) {
  if (!solMesh || !solMan || !W) return;
  vatTime += dt; solMan.time = vatTime;
  let n = 0;
  const once = (k: number, a: Anim, t0: number) => { const r = animRange.get(a)!, tot = r.e - r.s + 1; if (vatTime - t0 < r.dur) { solSet[k] = r.s; solSet[k + 1] = r.e; solSet[k + 2] = ((-t0 * r.fps) % tot + tot) % tot; solSet[k + 3] = r.fps; return true; } return false; };
  const hold = (k: number, a: Anim) => { const r = animRange.get(a)!; solSet[k] = r.e - 1; solSet[k + 1] = r.e; solSet[k + 2] = 1.5; solSet[k + 3] = 0.0001; };
  for (const u of W.u) {
    if (u.type !== 'inf') continue;
    let st = solState.get(u.id);
    if (!st) { st = { dieT: -1, die: 'simple death', ph: Math.random() * 60, jit: FORM.map(() => [(Math.random() - .5) * 2, (Math.random() - .5) * 2]) }; solState.set(u.id, st); }
    if (!u.alive && st.dieT < 0) { st.dieT = vatTime; st.die = W.T > 23 ? 'crouch death' : 'simple death'; }
    const T = W.T, firing = T - u.fireT < 0.7, contact = u.side === 0 ? T > 23 : T > 22, yaw0 = u.side === 0 ? 0 : Math.PI, aim = firing ? yawOf(u.a) : yaw0;
    for (let i = 0; i < 5 && n < SOL_CAP; i++) {
      const f = FORM[i], j = st.jit[i], x = WX(u.x) + f[0] * 1.9 + j[0], z = WZ(u.y) - f[1] * 1.9 + j[1], k = n * 4;
      const yaw = (u.moving ? yaw0 : aim) + j[0] * 0.15;
      tS.setAll(SOL_S * 1.25); tT.set(x, groundH(x, z), z); Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, tQ); Matrix.ComposeToRef(tS, tQ, tT, tM); solW0.multiplyToRef(tM, tO); tO.copyToArray(solMat, n * 16);
      if (u.side === 0) { solCol[k] = 1.3; solCol[k + 1] = 1.18; solCol[k + 2] = 0.92; } else { solCol[k] = 0.85; solCol[k + 1] = 1.02; solCol[k + 2] = 0.78; } solCol[k + 3] = 1;
      if (!u.alive) { const t0 = st.dieT + i * 0.18; if (vatTime < t0) { const r = animRange.get('crouch shoot')!; solSet[k] = r.s; solSet[k + 1] = r.e; solSet[k + 2] = 0; solSet[k + 3] = r.fps; } else if (!once(k, st.die, t0)) hold(k, st.die); }
      else {
        const a: Anim = u.moving ? 'run' : firing ? (i % 2 ? 'crouch shoot' : 'simple shoot') : contact ? (i === 2 && Math.sin(T * .7 + u.id) > .6 ? 'reload crouch' : 'crouch idle') : 'idle simple';
        const r = animRange.get(a) ?? animRange.get('idle simple')!, tot = r.e - r.s + 1;
        solSet[k] = r.s; solSet[k + 1] = r.e; solSet[k + 2] = (st.ph + i * 7) % tot; solSet[k + 3] = r.fps * (0.92 + i * 0.03);
      }
      n++;
    }
  }
  solMesh.thinInstanceCount = n; solMesh.thinInstanceBufferUpdated('matrix'); solMesh.thinInstanceBufferUpdated('bakedVertexAnimationSettingsInstanced'); solMesh.thinInstanceBufferUpdated('color');
}

// ===== الجسيمات (مجمّعات مشتركة، من المسرح) =====
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
  flush() { this.q.length = 0; this.left = 0; this.cur = null; this.ps.reset(); }
}
const pools: Pool[] = [];
const texExplo1 = fxTex('fx_explo1'), texExplo2 = fxTex('fx_explo2'), texCloud = fxTex('fx_cloud'), texFire = fxTex('fx_fire'), texFlame = fxTex('fx_flame');
const SH_CLOUD = { cw: 128, ch: 128, n: 64, rand: true }, SH_FIRE = { cw: 64, ch: 64, n: 64, rand: true };
const C4 = (r: number, g: number, b: number, a: number) => new Color4(r, g, b, a);
const fireS = new Pool('fireS', 900, texFire, true, { sheet: SH_FIRE, life: [0.3, 0.8], size: [[0, 2], [0.4, 6], [1, 8]], damp: 0.85, colors: [[0, C4(2.6, 2.1, 1.6, 1)], [0.5, C4(1.6, 1, 0.6, 0.8)], [1, C4(0.3, 0.15, 0.08, 0)]] });
const fireL = new Pool('fireL', 700, texFire, true, { sheet: SH_FIRE, life: [0.6, 1.5], size: [[0, 7], [0.3, 22], [1, 30]], damp: 0.85, colors: [[0, C4(2.6, 2.1, 1.6, 1)], [0.4, C4(1.7, 1, 0.55, 0.85)], [0.8, C4(0.6, 0.3, 0.12, 0.4)], [1, C4(0.1, 0.05, 0.03, 0)]] });
const smokeS = new Pool('smokeS', 1600, texCloud, false, { sheet: SH_CLOUD, life: [4, 8], size: [[0, 3], [0.3, 10], [1, 18]], damp: 0.9, gravity: 1.5, colors: [[0, C4(0.3, 0.27, 0.24, 0)], [0.05, C4(0.32, 0.29, 0.26, 0.8)], [1, C4(0.55, 0.52, 0.48, 0)]] });
const smokeL = new Pool('smokeL', 1400, texCloud, false, { sheet: SH_CLOUD, life: [7, 12], size: [[0, 6], [0.25, 18], [1, 36]], damp: 0.9, gravity: 1.2, colors: [[0, C4(0.36, 0.32, 0.27, 0)], [0.05, C4(0.34, 0.3, 0.26, 0.7)], [0.5, C4(0.5, 0.47, 0.42, 0.4)], [1, C4(0.62, 0.6, 0.56, 0)]] });
const dust = new Pool('dust', 2000, texSmoke, false, { life: [2, 4.5], size: [[0, 2.5], [1, 14]], damp: 0.86, gravity: 0.5, colors: [[0, C4(0.72, 0.6, 0.44, 0)], [0.06, C4(0.7, 0.58, 0.43, 0.7)], [1, C4(0.78, 0.68, 0.55, 0)]] });
const trackDust = new Pool('trackDust', 900, texSmoke, false, { life: [1.5, 3], size: [[0, 1.5], [1, 7]], damp: 0.9, gravity: 0.2, colors: [[0, C4(0.72, 0.62, 0.47, 0)], [0.1, C4(0.72, 0.62, 0.47, 0.35)], [1, C4(0.78, 0.7, 0.58, 0)]] });
const sparks = new Pool('sparks', 900, texSoft, true, { life: [0.4, 1.2], size: [[0, 1], [1, 0.35]], gravity: -9.8, stretched: true, colors: [[0, C4(5, 4, 2.4, 1)], [0.6, C4(3, 1.2, 0.3, 0.9)], [1, C4(1, 0.2, 0, 0)]] });
const muzzle = new Pool('muzzle', 400, texFlare, true, { life: [0.05, 0.11], size: [[0, 3], [1, 5]], colors: [[0, C4(7, 5.5, 3, 1)], [1, C4(3, 1.4, 0.3, 0)]] });
const mgFlash = new Pool('mgFlash', 500, texFlare, true, { life: [0.03, 0.06], size: [[0, 0.9], [1, 1.3]], colors: [[0, C4(8, 6, 3, 1)], [1, C4(4, 1.8, 0.4, 0)]] });
const tracerR = new Pool('tracerR', 600, texSoft, true, { life: [0.12, 0.12], size: [[0, 0.5], [1, 0.5]], stretched: true, colors: [[0, C4(8, 3, 1.2, 1)], [1, C4(6, 1.8, 0.6, 1)]] });
const tracerG = new Pool('tracerG', 600, texSoft, true, { life: [0.12, 0.12], size: [[0, 0.5], [1, 0.5]], stretched: true, colors: [[0, C4(1.6, 7, 2, 1)], [1, C4(1.2, 5, 1.4, 1)]] });
const apTracer = new Pool('apTracer', 200, texSoft, true, { life: [0.08, 0.08], size: [[0, 1.4], [1, 1.2]], stretched: true, colors: [[0, C4(9, 7, 3.5, 1)], [1, C4(7, 4.5, 1.6, 1)]] });
const puffs = new Pool('puffs', 900, texSmoke, false, { life: [0.4, 1], size: [[0, 0.6], [1, 2.5]], colors: [[0, C4(0.8, 0.78, 0.74, 0.5)], [1, C4(0.8, 0.78, 0.74, 0)]] });
const flame = new Pool('flame', 1600, texFlare, true, { life: [0.05, 0.12], size: [[0, 2.2], [1, 0.6]], colors: [[0, C4(7, 5.5, 3.2, 1)], [0.5, C4(4, 1.8, 0.4, 0.8)], [1, C4(0.8, 0.2, 0.02, 0)]] });
const rocketTrail = new Pool('rocketTrail', 3500, texSmoke, false, { life: [2.5, 4.5], size: [[0, 0.9], [1, 6]], colors: [[0, C4(0.85, 0.82, 0.78, 0)], [0.05, C4(0.8, 0.78, 0.75, 0.55)], [1, C4(0.8, 0.78, 0.75, 0)]], gravity: 0.5 });
const thinTrail = new Pool('thinTrail', 2000, texSmoke, false, { life: [1.2, 2.2], size: [[0, 0.5], [1, 2.5]], colors: [[0, C4(0.8, 0.8, 0.8, 0)], [0.05, C4(0.75, 0.74, 0.72, 0.35)], [1, C4(0.9, 0.9, 0.9, 0)]] });
const burnSmoke = new Pool('burnSmoke', 2600, texCloud, false, { sheet: SH_CLOUD, life: [8, 14], size: [[0, 3], [0.3, 12], [1, 32]], colors: [[0, C4(0.12, 0.1, 0.09, 0)], [0.05, C4(0.1, 0.09, 0.08, 0.85)], [1, C4(0.4, 0.39, 0.38, 0)]] });
const burnFire = new Pool('burnFire', 600, texFlame, true, { sheet: { cw: 64, ch: 128, n: 64, rand: true, sy: 2 }, life: [0.3, 0.7], size: [[0, 2], [1, 4.5]], colors: [[0, C4(5, 3, 1.2, 0.9)], [1, C4(1.2, 0.3, 0.05, 0)]] });
const EXC: [number, Color4][] = [[0, C4(1.5, 1.4, 1.3, 1)], [0.75, C4(1, 1, 1, 0.95)], [1, C4(1, 1, 1, 0)]], SH_EX = { cw: 200, ch: 200, n: 25, speed: 1 };
const exS = new Pool('exS', 80, texExplo2, false, { sheet: SH_EX, life: [1.3, 1.7], size: [[0, 9], [1, 15]], colors: EXC, gravity: 1, spin: 0.15 });
const exM = new Pool('exM', 60, texExplo1, false, { sheet: SH_EX, life: [1.8, 2.3], size: [[0, 20], [1, 32]], colors: EXC, gravity: 1.5, spin: 0.1 });
const exL = new Pool('exL', 40, texExplo1, false, { sheet: SH_EX, life: [2.4, 3], size: [[0, 38], [1, 60]], colors: EXC, gravity: 2, spin: 0.08 });
// ستار الدخان (screen بالأصل: يعيش 9–14 ث ويكبر)
const screenP = new Pool('screen', 2400, texCloud, false, { sheet: SH_CLOUD, life: [9, 14], size: [[0, 10], [0.3, 30], [1, 46]], gravity: 0.25, spin: 0.06, damp: 0.92, colors: [[0, C4(0.92, 0.92, 0.9, 0)], [0.08, C4(0.9, 0.9, 0.88, 0.62)], [0.8, C4(0.86, 0.86, 0.84, 0.42)], [1, C4(0.86, 0.86, 0.84, 0)]] });
const cloud = new Pool('cloud', 900, texCloud, false, { sheet: SH_CLOUD, life: [4, 8], size: [[0, 5], [0.3, 14], [1, 24]], damp: 0.86, gravity: 0.6, colors: [[0, C4(1.1, 1.08, 1.02, 0)], [0.04, C4(1.05, 1.02, 0.98, 0.75)], [1, C4(1, 0.98, 0.92, 0)]] });

// أضواء الانفجارات
const lights: { l: PointLight; t: number; dur: number; i0: number }[] = [];
for (let i = 0; i < NL; i++) { const l = new PointLight('xl' + i, Vector3.Zero(), scene); l.intensity = 0; l.range = 200; lights.push({ l, t: 0, dur: 0, i0: 0 }); }
function flashLight(p: V3, i0: number, range: number, dur: number, col = new Color3(1, 0.62, 0.3)) {
  const s = lights.reduce((a, b) => (a.l.intensity / (a.i0 || 1) <= b.l.intensity / (b.i0 || 1) ? a : b));
  s.l.position.set(p[0], p[1] + 4, p[2]); s.l.range = range; s.l.diffuse = col; s.i0 = i0; s.t = 0; s.dur = dur; s.l.intensity = i0;
}
function tickLights(dt: number) { for (const s of lights) { if (s.l.intensity <= 0) continue; s.t += dt; const k = 1 - s.t / s.dur; s.l.intensity = k > 0 ? s.i0 * k * k * (0.85 + Math.random() * 0.3) : 0; } }

// حفر على الأرض (crater بالأصل)
const decal = MeshBuilder.CreateGround('decal', { width: 1, height: 1 }, scene);
const decalMat = new StandardMaterial('decalMat', scene); decalMat.diffuseTexture = texScorch; decalMat.opacityTexture = texScorch; decalMat.disableLighting = true; decalMat.emissiveColor = new Color3(0.13, 0.11, 0.09); decalMat.specularColor = Color3.Black(); decalMat.zOffset = -2;
decal.material = decalMat; decal.isPickable = false; decal.alwaysSelectAsActiveMesh = true; decal.thinInstanceCount = 0;
let decals: number[] = [];
function addDecal(x: number, z: number, size: number) {
  if (decals.length / 16 > 220) decals.splice(0, 16);
  const e = Math.max(2, size * 0.3), n = new Vector3(groundH(x - e, z) - groundH(x + e, z), 2 * e, groundH(x, z - e) - groundH(x, z + e)).normalize(), q = new Quaternion();
  Quaternion.FromUnitVectorsToRef(Vector3.UpReadOnly, n, q);
  decals.push(...Matrix.Compose(new Vector3(size, 1, size), q.multiply(Quaternion.RotationAxis(Vector3.UpReadOnly, Math.random() * 6.28)), new Vector3(x, groundH(x, z) + 0.25, z)).asArray());
  decal.thinInstanceSetBuffer('matrix', new Float32Array(decals), 16, false);
}

// ===== الصوت: تسجيلات المسرح الحقيقية + طيارة/هليكوبتر/مسيّرة مولّدة =====
let speed = 1, muted = false;
const sfx = (() => {
  let ac: AudioContext | null = null, master: GainNode, nb: AudioBuffer, buzz: GainNode | null = null, chop: GainNode | null = null, active = 0;
  const smp: Record<string, AudioBuffer> = {};
  const vol = (d: number) => clamp(1.1 - d / 2600, 0, 1) ** 2;
  const at = (d: number, delay = 0) => ac!.currentTime + delay + Math.min(2.5, d / 343 / speed);
  function play(name: string, d: number, g0: number, rate = 1, delay = 0, echo = false) {
    if (!ac || !smp[name]) return false; const v0 = vol(d) * g0; if (v0 < 0.01) return true;
    if (active > 28 && g0 < 0.7) return true;
    const t = at(d, delay), s = ac.createBufferSource(); s.buffer = smp[name]; s.playbackRate.value = rate;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = clamp(16000 - d * 7, 900, 16000);
    const g = ac.createGain(); g.gain.value = v0; s.connect(f).connect(g).connect(master); s.start(t); active++; s.onended = () => { active--; };
    if (echo && d > 120) { const e = ac.createBufferSource(); e.buffer = smp[name]; e.playbackRate.value = rate; const ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = clamp(4000 - d, 600, 4000);
      const eg = ac.createGain(); eg.gain.value = v0 * 0.28; e.connect(ef).connect(eg).connect(master); e.start(t + 0.15 + Math.random() * 0.2); }
    return true;
  }
  function hit(d: number, dur: number, f0: number, f1: number, g0: number, sub = 0) {
    if (!ac) return; const v0 = vol(d) * g0; if (v0 < 0.008) return; const t = at(d);
    const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(v0, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 3); s.stop(t + dur);
    if (sub) { const o = ac.createOscillator(), og = ac.createGain(); o.frequency.setValueAtTime(sub, t); o.frequency.exponentialRampToValueAtTime(sub * 0.4, t + 0.6); og.gain.setValueAtTime(v0 * 0.8, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.connect(og).connect(master); o.start(t); o.stop(t + 0.8); }
  }
  const loopNoise = (fType: BiquadFilterType, freq: number, q: number) => { const s = ac!.createBufferSource(); s.buffer = nb; s.loop = true; const f = ac!.createBiquadFilter(); f.type = fType; f.frequency.value = freq; f.Q.value = q; const g = ac!.createGain(); g.gain.value = 0; s.connect(f).connect(g); s.start(); return g; };
  return {
    init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try { ac = new AudioContext(); } catch { return; }
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(ac.destination);
      nb = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate); const dd = nb.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
      const a = ac; for (const [k, u] of Object.entries(sndUrls)) { const n = k.split('/').pop()!.replace('.mp3', ''); fetch(u).then(r => r.arrayBuffer()).then(b => a.decodeAudioData(b)).then(buf => { smp[n] = buf; }).catch(() => {}); }
      buzz = loopNoise('bandpass', 420, 3); buzz.connect(master);
      // هليكوبتر: ضجيج واطي يتقطع 18 مرة بالثانية (ضربات الريش)
      const cg = loopNoise('lowpass', 260, 0.7), lfo = ac.createOscillator(), lg = ac.createGain(), am = ac.createGain(); lfo.frequency.value = 18; lg.gain.value = 0.5; am.gain.value = 0.5;
      lfo.connect(lg).connect(am.gain); lfo.start(); cg.connect(am).connect(master); chop = cg;
    },
    toggle() { muted = !muted; if (ac) master.gain.setTargetAtTime(muted ? 0 : 0.85, ac.currentTime, 0.05); return muted; },
    boom(d: number, s: number) { const r = 0.9 + Math.random() * 0.2; if (!play(d > 1800 ? 'boom_far' : s >= 1.3 ? 'boom_big' : 'boom_mid', d, 0.6 + s * 0.35, s < 0.6 ? r * 1.15 : r, 0, true)) hit(d, 1.1 + s * 0.8, 2400, 55, 0.45 + s * 0.3, 50); else if (s >= 1) hit(d, 0.9, 300, 40, 0.25 * s, 42); },
    tank(d: number) { if (!play('tank', d, 1, 0.92 + Math.random() * 0.14, 0, true)) hit(d, 0.6, 3200, 140, 0.75, 65); },
    howitzer(d: number) { if (!play('tank', d, 1.1, 0.68 + Math.random() * 0.08, 0, true)) hit(d, 0.9, 2000, 90, 0.8, 50); },
    mg(d: number) { play('akburst', d, 0.42, 0.95 + Math.random() * 0.1, 0, true) || play('mg', d, 0.4); },
    rocket(d: number) { if (!play('rocket', d, 0.6, 0.9 + Math.random() * 0.2)) hit(d, 1.2, 2200, 400, 0.35); },
    launch(d: number) { if (!play('launch', d, 0.9)) hit(d, 2.5, 1500, 180, 0.7, 55); },
    atgm(d: number) { if (!play('atgm', d, 0.9, 0.95 + Math.random() * 0.1)) play('launch', d, 0.7); },
    incoming(d: number) { play('incoming', d, 0.7, 1); },
    whiz(d: number) { play('whiz', d, 0.5, 0.9 + Math.random() * 0.25); },
    // طيارة: صفير يعلى ويرجع (مثل snd('jet') بالأصل) + هدير واطي
    jet(d: number) {
      if (!ac) return; const t = ac.currentTime, dur = 3.2, v0 = clamp(1.2 - d / 1500, 0.15, 1) * 0.55;
      const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(2600, t + dur * .45); f.frequency.linearRampToValueAtTime(320, t + dur);
      const g = ac.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(v0, t + dur * .45); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur);
      hit(d * 0.6, 2.6, 260, 60, 0.5);
    },
    loops(drone: number, heli: number) { if (!ac) return; buzz?.gain.setTargetAtTime(vol(drone) * 0.1, ac.currentTime, 0.2); chop?.gain.setTargetAtTime(vol(heli) * 0.55, ac.currentTime, 0.2); },
  };
})();

// ===== ربط المحاكاة بالرسم =====
let W: World | null = null;
interface UVis { s: Spawned; kind: string; yaw: number; tur: number; recoil: number; wreck: boolean; lastFire: number; burnUntil: number }
const unitVis = new Map<number, UVis>();
interface HVis { root: TransformNode; rotor: Mesh; tail: Mesh; s: Spawned }
const heliVis = new Map<number, HVis>();
const airVis = new Map<number, { s: Spawned; glow: Mesh | null; lp: V3; roll: number }>();
const prVis = new Map<number, { m: AbstractMesh | null; kind: string; lp: V3; snd: boolean }>();
const houseVis: { root: TransformNode; rubble: TransformNode | null; x: number; z: number; w: number }[] = [];
const embers: { p: V3; until: number; big: number }[] = [];
let protoShell: Mesh, protoRocket: Mesh, protoMsl: Mesh, protoAtgm: Mesh, protoBomb: Mesh, rubbleBox: Mesh, rotorMat: StandardMaterial;
function makeProcedural() {
  const mat = (c: Color3, em = Color3.Black()) => { const m = new StandardMaterial('pm', scene); m.diffuseColor = c; m.emissiveColor = em; m.specularColor = new Color3(0.1, 0.1, 0.1); return m; };
  const missile = (name: string, Lh: number, dia: number, col: Color3) => { const b = MeshBuilder.CreateCylinder(name, { height: Lh, diameter: dia, tessellation: 8 }, scene); b.rotation.x = Math.PI / 2; b.bakeCurrentTransformIntoVertices();
    const nose = MeshBuilder.CreateCylinder(name + 'n', { height: dia * 2.2, diameterTop: 0, diameterBottom: dia, tessellation: 8 }, scene); nose.rotation.x = Math.PI / 2; nose.position.z = Lh / 2 + dia * 1.1; nose.bakeCurrentTransformIntoVertices();
    const m = Mesh.MergeMeshes([b, nose], true)!; m.material = mat(col); m.isVisible = false; m.isPickable = false; return m; };
  protoShell = missile('shell', 0.7, 0.152, new Color3(0.25, 0.27, 0.2));
  protoRocket = missile('rocket', 2.9, 0.122, new Color3(0.36, 0.38, 0.3));
  protoMsl = missile('msl', 5, 0.4, new Color3(0.85, 0.85, 0.82));
  protoAtgm = missile('atgm', 1.6, 0.18, new Color3(0.3, 0.32, 0.28));
  protoBomb = missile('bomb', 2.2, 0.36, new Color3(0.32, 0.34, 0.28));
  rubbleBox = MeshBuilder.CreateBox('rubble', { size: 1 }, scene); rubbleBox.material = mat(new Color3(0.55, 0.5, 0.42)); rubbleBox.isVisible = false; rubbleBox.isPickable = false;
  rotorMat = new StandardMaterial('rotor', scene); rotorMat.diffuseColor = new Color3(0.08, 0.08, 0.08); rotorMat.alpha = 0.32; rotorMat.specularColor = Color3.Black(); rotorMat.backFaceCulling = false;
}
const groundAt = (x: number, z: number, dy = 0): V3 => [x, groundH(x, z) + dy, z];
const camD = (p: V3) => Vector3.Distance(cam.position, v(p));
let shake = 0;
const MODEL_FOR: Record<string, [string, string]> = { tank: ['abrams', 't72'], arty: ['d30', 'd30'], mlrs: ['grad', 'grad'], ad: ['patriot', 's400'] };
const VIS = 1.35;   // تكبير بصري خفيف للمركبات (الأصل يرسمها أكبر بكثير من حجمها)
function spawnUnit(u: Unit) {
  if (u.type === 'inf') return;
  const kind = MODEL_FOR[u.type][u.side], s = spawnModel(kind), yaw = yawOf(u.a); s.root.scaling.setAll(VIS);
  s.root.rotation.y = yaw; unitVis.set(u.id, { s, kind, yaw, tur: 0, recoil: 0, wreck: false, lastFire: -9, burnUntil: 0 });
}
function muzzleOf(u: Unit): V3 {
  const X = WX(u.x), Z = WZ(u.y), vis = unitVis.get(u.id), y0 = groundH(X, Z);
  const dir = yawOf(u.a), fx = Math.sin(dir), fz = Math.cos(dir);
  if (u.type === 'tank') return [X + fx * 6, y0 + 2.3, Z + fz * 6];
  if (u.type === 'arty') return [X + fx * 4.5, y0 + 1.9, Z + fz * 4.5];
  if (u.type === 'mlrs') { const hy = vis ? vis.yaw : dir; return [X - Math.sin(hy) * 2, y0 + 3.2, Z - Math.cos(hy) * 2]; }
  if (u.type === 'ad') return [X, y0 + 6, Z];
  return [X + fx * 0.6, y0 + 1.3, Z + fz * 0.6];
}
const AIR_ALT = { drone: 85, jet: 130, heli: 32 };
function heliPos(h: Heli): V3 { const X = WX(h.x), Z = WZ(h.y); const climb = smooth(0, 1, (W!.T - h.t0) / 2.5); return [X, groundH(X, Z) + lerp(8, AIR_ALT.heli, climb) + Math.sin(W!.T * 1.3 + h.id) * 0.8, Z]; }
function airPos(a: Air): V3 { const X = WX(a.x), Z = WZ(a.y); return [X, (a.kind === 'jet' ? AIR_ALT.jet : AIR_ALT.drone) + groundH(X, Z) * 0.5, Z]; }
/** بداية/نهاية القذيفة بالعالم (الأصل خطي على الشاشة؛ هنا نفس المسار بالأفق + قوس/ارتفاع) */
function projPoint(p: Proj, k: number): V3 {
  const sx = WX(p.sx), sz = WZ(p.sy), tx = WX(p.tx), tz = WZ(p.ty), x = lerp(sx, tx, k), z = lerp(sz, tz, k), d = Math.hypot(tx - sx, tz - sz);
  const g0 = groundH(sx, sz), g1 = groundH(tx, tz), base = lerp(g0, g1, k);
  if (p.kind === 'shell') return [x, base + 2 + Math.sin(Math.PI * k) * Math.max(40, d * 0.42), z];
  if (p.kind === 'rocket') return [x, base + 3 + Math.sin(Math.PI * k) * Math.max(30, d * 0.3), z];
  if (p.kind === 'msl') { const alt = nearestAirAlt(tx, tz); return [x, lerp(g0 + 6, alt, Math.pow(k, 0.8)), z]; }
  if (p.kind === 'atgm') { const h = W!.heli.find(q => Math.abs(WX(q.x) - sx) < 1 && Math.abs(WZ(q.y) - sz) < 1); const y0 = h ? heliPos(h)[1] - 1 : g0 + AIR_ALT.heli; return [x, lerp(y0, g1 + 1.2, k) + Math.sin(Math.PI * k) * 3, z]; }
  return [x, lerp(g0 + (p.kind === 'tank' ? 2.3 : 1.3), g1 + 1, k), z];
}
function nearestAirAlt(x: number, z: number) { let best = 1e9, alt = AIR_ALT.jet; for (const a of W!.air) { const p = airPos(a), d = Math.hypot(p[0] - x, p[2] - z); if (d < best) { best = d; alt = p[1]; } } return alt; }

function handleFx(f: Fx) {
  const w = W!;
  switch (f.k) {
    case 'boom': {
      const X = WX(f.x), Z = WZ(f.y), p = groundAt(X, Z, 0.5), s = f.cal / 2;
      const EX = s < 0.7 ? exS : s < 1.3 ? exM : exL, lift = s < 0.7 ? 4 : s < 1.3 ? 9 : 16;
      EX.emit({ a: [p[0], p[1] + lift, p[2]], n: s >= 1.3 ? 2 : 1, spd: [0, 1.5], up: 1, jit: 3 * s });
      (s >= 1 ? fireL : fireS).emit({ a: p, n: Math.round(s >= 1 ? 18 * s : 8 * s + 3), spd: [10 * s, 36 * s], jit: 2 * s, up: 0.35 });
      (s >= 1 ? smokeL : smokeS).emit({ a: p, n: Math.round(s >= 1 ? 14 * s : 10 * s + 3), spd: [3 * s, 12 * s], jit: 3 * s, up: 0.5 });
      sparks.emit({ a: p, n: Math.round(24 * s), spd: [30, 120 * s], jit: 1 });
      dust.emit({ a: p, n: Math.round(14 * s + 4), spd: [8, 26 * s], up: 0.1, jit: 3 }); addDecal(X, Z, 4 + 7 * s);
      flashLight(p, 3 + 5 * s, 50 + 90 * s, 0.3 + 0.3 * s);
      const d = camD(p); shake = Math.max(shake, f.cal * 0.45 * clamp(1 - d / 700, 0, 1)); sfx.boom(d, s); break;
    }
    case 'muzzle': {
      const src = w.u.find(u => u.id === f.src), h = src ? null : w.heli.find(q => q.id === f.src);
      const p: V3 = src ? muzzleOf(src) : h ? heliPos(h) : groundAt(WX(f.x), WZ(f.y), 2), dir = yawOf(f.a), d3: V3 = [Math.sin(dir), 0, Math.cos(dir)], dist = camD(p);
      const vis = src ? unitVis.get(src.id) : null; if (vis) { vis.recoil = 1; vis.lastFire = w.T; }
      if (f.kind === 'tank') { muzzle.emit({ a: p, n: 3, jit: 0.3 }); puffs.emit({ a: p, n: 10, dir: d3, spd: [3, 12], spread: 1.4, jit: 0.6 }); if (src) dust.emit({ a: groundAt(p[0] - d3[0] * 3, p[2] - d3[2] * 3, 0.5), n: 8, spd: [6, 14], up: 0, jit: 4 }); flashLight(p, 3, 40, 0.12); sfx.tank(dist); }
      else if (f.kind === 'shell') { muzzle.emit({ a: p, n: 4, jit: 0.5 }); cloud.emit({ a: p, n: 8, dir: [d3[0], 0.4, d3[2]], spd: [3, 10], spread: 1.5, jit: 1 }); dust.emit({ a: groundAt(p[0], p[2], 0.5), n: 10, spd: [6, 18], up: 0, jit: 5 }); flashLight(p, 4, 60, 0.15); sfx.howitzer(dist); }
      else if (f.kind === 'rocket') { flame.emit({ a: p, n: 8, dir: [-d3[0], -0.2, -d3[2]], spd: [10, 25], spread: 0.6, jit: 0.4 }); cloud.emit({ a: p, n: 6, spd: [2, 8], jit: 1.5 }); sfx.rocket(dist); }
      else if (f.kind === 'msl') { cloud.emit({ a: p, n: 14, spd: [3, 12], up: -0.2, jit: 2 }); flame.emit({ a: p, n: 10, dir: [0, -1, 0], spd: [8, 18], spread: 0.6, jit: 0.4 }); flashLight(p, 3, 60, 0.4); sfx.launch(dist); }
      else if (f.kind === 'atgm') { flame.emit({ a: p, n: 6, dir: [-d3[0], 0, -d3[2]], spd: [6, 15], spread: 0.5, jit: 0.3 }); puffs.emit({ a: p, n: 6, spd: [1, 4], jit: 0.5 }); sfx.atgm(dist); }
      break;
    }
    case 'mg': {
      const u = w.u.find(q => q.id === f.src); if (!u) break;
      const X = WX(u.x), Z = WZ(u.y), dir = yawOf(u.a), d = camD(groundAt(X, Z, 1));
      for (let i = 0; i < 5; i++) { if (Math.random() < 0.55) continue; const fo = FORM[i], x = X + fo[0] * 1.9 + Math.sin(dir) * 0.8, z = Z - fo[1] * 1.9 + Math.cos(dir) * 0.8; mgFlash.emit({ a: [x, groundH(x, z) + 1.25, z], n: 1, jit: 0.1 }); }
      if (Math.random() < 0.5) sfx.mg(d); break;
    }
    case 'mghit': { const X = WX(f.x), Z = WZ(f.y), p = groundAt(X, Z, 0.3); puffs.emit({ a: p, n: 3, spd: [1, 4], up: 1, jit: 1.5 }); if (Math.random() < 0.3) sparks.emit({ a: p, n: 2, spd: [10, 30], jit: 0.5 }); if (camD(p) < 30) sfx.whiz(camD(p)); break; }
    case 'mslhit': { const X = WX(f.x), Z = WZ(f.y), p: V3 = [X, nearestAirAlt(X, Z), Z]; exS.emit({ a: p, n: 1, spd: [0, 1], jit: 1 }); fireS.emit({ a: p, n: 8, spd: [8, 20], jit: 1 }); smokeS.emit({ a: p, n: 8, spd: [2, 6], jit: 2 }); flashLight(p, 4, 120, 0.3); sfx.boom(camD(p), 0.6); break; }
    case 'screen': {
      const X = WX(f.x), Z = WZ(f.y);
      // 5 نفخات بالأصل؛ هنا غيمة عريضة: كل وحدة 46 م بعرض الميدان
      for (let i = 0; i < 5; i++) { const x = X + (Math.random() - 0.5) * 50, z = Z + (Math.random() - 0.5) * 16; screenP.emit({ a: groundAt(x, z, 3), n: 4, spd: [1, 4], up: 0.15, jit: 8 }); }
      puffs.emit({ a: groundAt(X, Z, 2), n: 10, spd: [4, 10], up: 0.4, jit: 3 }); sfx.boom(camD(groundAt(X, Z)), 0.25); break;
    }
    case 'house': {
      const hv = houseVis[f.id]; if (!hv) break; collapseHouse(f.id);
      const p = groundAt(hv.x, hv.z, 2); dust.emit({ a: p, n: 40, spd: [6, 20], up: 0.25, jit: hv.w * 0.6 }); smokeL.emit({ a: p, n: 12, spd: [2, 6], up: 0.6, jit: hv.w * 0.5 });
      embers.push({ p, until: (W?.T ?? 0) + 14, big: 0.6 }); break;
    }
    case 'jet': { const a = w.air.find(q => q.id === f.id); if (a) sfx.jet(camD(airPos(a))); break; }
    case 'die': {
      const u = w.u.find(q => q.id === f.id); if (!u) break; const vis = unitVis.get(u.id); if (!vis) break;
      // دبابة/مدفع/راجمة تنضرب: نبدّلها بهيكل محروق، والبرج ممكن يطير
      const yaw = vis.s.root.rotation.y, tur = vis.s.tur?.rotation.y ?? 0, pos = vis.s.root.position.clone();
      vis.s.root.dispose(); const s = spawnModel(vis.kind, true); s.root.scaling.setAll(VIS); s.root.position.copyFrom(pos); s.root.rotation.y = yaw + (Math.random() - 0.5) * 0.25; s.root.rotation.z = (Math.random() - 0.5) * 0.06;
      if (s.tur) { s.tur.rotation.y = tur + (Math.random() - 0.5) * 0.8; if (Math.random() < 0.3) { s.tur.position.y += 1.2; s.tur.rotation.x = (Math.random() - 0.5) * 0.9; s.tur.rotation.z = (Math.random() - 0.5) * 0.9; } }
      vis.s = s; vis.wreck = true; vis.burnUntil = w.T + (u.burn ?? 12) + 0.5;
      break;
    }
  }
}
function collapseHouse(i: number) {
  const hv = houseVis[i]; if (!hv || hv.rubble) return;
  // البيت ينهار: يبقى ربعه التحتاني (جدران مكسرة) وكومة ركام
  hv.root.scaling.y *= 0.3; hv.root.position.y -= 0.4; hv.root.rotation.z = (Math.random() - 0.5) * 0.08;
  const r = new TransformNode('rub', scene); r.position.set(hv.x, groundH(hv.x, hv.z), hv.z); hv.rubble = r;
  for (let k = 0; k < 9; k++) { const b = rubbleBox.createInstance('rb'); b.parent = r; b.isVisible = true; const s = hv.w * (0.12 + Math.random() * 0.18);
    b.scaling.set(s * (1 + Math.random()), s * 0.45, s); b.position.set((Math.random() - 0.5) * hv.w * 0.8, s * 0.15, (Math.random() - 0.5) * hv.w * 0.8); b.rotation.set(Math.random() * 0.6, Math.random() * 3, Math.random() * 0.6); caster(b); }
}
function syncUnits(dt: number) {
  const w = W!;
  for (const u of w.u) {
    const vis = unitVis.get(u.id); if (!vis) continue;
    const X = WX(u.x), Z = WZ(u.y), y = groundH(X, Z); vis.s.root.position.set(X, y, Z);
    if (!u.alive) continue;
    // جسم الدبابة: يمشي لقدّام؛ واقفة تلف لهدفها (مثل الأصل). البرج يصوّب على x.a
    const want = u.type === 'tank' && u.moving ? (u.side === 0 ? 0 : (u.vy > 0 ? Math.PI : 0) + (u.side === 1 && u.vy <= 0 ? Math.PI : 0)) : yawOf(u.a);
    const hullYaw = u.type === 'tank' ? (u.moving ? want : vis.yaw) : want;
    vis.yaw += Math.atan2(Math.sin(hullYaw - vis.yaw), Math.cos(hullYaw - vis.yaw)) * Math.min(1, dt * 2.5); vis.s.root.rotation.y = vis.yaw;
    if (vis.s.tur) { const tw = yawOf(u.a) - vis.yaw; vis.tur += Math.atan2(Math.sin(tw - vis.tur), Math.cos(tw - vis.tur)) * Math.min(1, dt * 4); vis.s.tur.rotation.y = vis.tur; }
    // ميلان الأرض + ارتداد الرمي
    const e = 3, pitch = Math.atan2(groundH(X + Math.sin(vis.yaw) * e, Z + Math.cos(vis.yaw) * e) - groundH(X - Math.sin(vis.yaw) * e, Z - Math.cos(vis.yaw) * e), 2 * e);
    vis.recoil = Math.max(0, vis.recoil - dt * 4); vis.s.inner.rotation.x = -pitch - vis.recoil * (u.type === 'tank' ? 0.035 : 0.02);
    if (u.moving && u.type === 'tank' && Math.random() < dt * 14) { const bx = X - Math.sin(vis.yaw) * 4, bz = Z - Math.cos(vis.yaw) * 4; trackDust.emit({ a: groundAt(bx, bz, 0.6), n: 2, spd: [0.5, 2], up: 0.4, jit: 3 }); }
  }
}
function syncHelis(dt: number) {
  const w = W!;
  for (const h of w.heli) {
    let hv = heliVis.get(h.id);
    if (w.T < h.t0) { if (hv) hv.root.setEnabled(false); continue; }
    if (!hv) {
      const s = spawnModel('ah64'), root = s.root;
      const rotor = MeshBuilder.CreateDisc('rd', { radius: 7.3, tessellation: 28 }, scene); rotor.rotation.x = Math.PI / 2; rotor.bakeCurrentTransformIntoVertices(); rotor.material = rotorMat; rotor.parent = root; rotor.position.set(0.3, 4.15, 0); rotor.isPickable = false;
      const tail = MeshBuilder.CreateDisc('td', { radius: 1.4, tessellation: 16 }, scene); tail.material = rotorMat; tail.parent = root; tail.position.set(0, 3.2, -8.6); tail.rotation.y = Math.PI / 2; tail.isPickable = false;
      hv = { root, rotor, tail, s }; heliVis.set(h.id, hv);
    }
    hv.root.setEnabled(true);
    const p = heliPos(h); hv.root.position.set(...p);
    const climbing = h.y > h.ty; hv.root.rotation.y = climbing ? 0 : Math.sin(w.T * 0.4 + h.id) * 0.15; hv.root.rotation.x = climbing ? 0.12 : Math.sin(w.T * .9) * 0.02; hv.root.rotation.z = Math.sin(w.T * 0.7 + h.id) * 0.04;
    hv.rotor.rotation.y += dt * 30; hv.tail.rotation.x += dt * 40;
    if (p[1] - groundH(p[0], p[2]) < 20) dust.emit({ a: groundAt(p[0], p[2], 0.5), n: 1, spd: [8, 14], up: -0.1, jit: 6 });
  }
}
function syncAir(dt: number) {
  const w = W!, seen = new Set<number>();
  for (const a of w.air) {
    seen.add(a.id); let av = airVis.get(a.id);
    if (!av) { const kind = a.kind === 'jet' ? (a.side === 0 ? 'su25' : 'f16') : (a.side === 0 ? 'tb2' : 'shahed'); const s = spawnModel(kind); av = { s, glow: null, lp: airPos(a), roll: 0 }; airVis.set(a.id, av); }
    const p = airPos(a); av.s.root.position.set(...p);
    const yaw = Math.atan2(a.vx, -a.vy); av.s.root.rotation.y = yaw;
    if (a.kind === 'jet') { av.roll = lerp(av.roll, a.drop ? Math.sin(w.T * 2 + a.id) * 0.5 : 0, dt * 2); av.s.root.rotation.z = av.roll; const back = [p[0] - Math.sin(yaw) * 8, p[1], p[2] - Math.cos(yaw) * 8] as V3; flame.emit({ a: back, n: 1, jit: 0.2 }); }
    av.lp = p;
  }
  for (const [id, av] of airVis) if (!seen.has(id)) { av.s.root.dispose(); airVis.delete(id); }
  // قنابل الطيارات: ينزلن من الطيارة لنقطة الانفجار (المحاكاة تفجّرها بعد 0–0.4 ث)
}
function syncProj(dt: number) {
  const w = W!, seen = new Set<number>();
  for (const p of w.pr) {
    seen.add(p.id); const k = clamp(p.t / p.dur, 0, 1), q = projPoint(p, k);
    let pv = prVis.get(p.id)!;
    if (!pv) {
      const base = p.kind === 'shell' ? protoShell : p.kind === 'rocket' ? protoRocket : p.kind === 'msl' ? protoMsl : p.kind === 'atgm' ? protoAtgm : null;
      const m = base ? base.createInstance('pr') : null; if (m) { m.isVisible = true; m.isPickable = false; }
      pv = { m, kind: p.kind, lp: projPoint(p, Math.max(0, k - 0.02)), snd: false }; prVis.set(p.id, pv);
    }
    const dv: V3 = [q[0] - pv.lp[0], q[1] - pv.lp[1], q[2] - pv.lp[2]], L = Math.hypot(...dv) || 1;
    if (pv.m) { pv.m.position.set(...q); pv.m.lookAt(v([q[0] + dv[0], q[1] + dv[1], q[2] + dv[2]])); }
    if (p.kind === 'tank') apTracer.emit({ a: q, b: pv.lp, n: 1, dir: [dv[0] / L, dv[1] / L, dv[2] / L], spd: [L / Math.max(dt, 1e-3) * 0.02, L / Math.max(dt, 1e-3) * 0.02], jit: 0 });
    else if (p.kind === 'mg') { const u = w.u.find(z => Math.abs(WX(z.x) - WX(p.sx)) < 0.01 && Math.abs(z.y - p.sy) < 0.01); (u?.side === 1 ? tracerG : tracerR).emit({ a: q, n: 1, dir: [dv[0] / L, dv[1] / L, dv[2] / L], spd: [30, 30], jit: 0.3 }); }
    else if (p.kind === 'rocket' || p.kind === 'msl' || p.kind === 'atgm') { flame.emit({ a: q, n: 1, jit: 0.2 }); (p.kind === 'msl' ? rocketTrail : p.kind === 'rocket' ? rocketTrail : thinTrail).emit({ a: q, b: pv.lp, n: p.kind === 'atgm' ? 1 : 2, spd: [0, 0.6], jit: 0.4 }); }
    else if (p.kind === 'shell') { if (Math.random() < 0.4) thinTrail.emit({ a: q, n: 1, jit: 0.1 }); if (!pv.snd && p.dur - p.t < 1.6) { pv.snd = true; const tgt = groundAt(WX(p.tx), WZ(p.ty)); if (camD(tgt) < 450) sfx.incoming(camD(tgt)); } }
    pv.lp = q;
  }
  for (const [id, pv] of prVis) if (!seen.has(id)) { pv.m?.dispose(); prVis.delete(id); }
}
function burnFx(dt: number) {
  const w = W!;
  for (const u of w.u) { if (u.alive || u.type === 'inf') continue; const vis = unitVis.get(u.id); if (!vis) continue; const p = groundAt(WX(u.x), WZ(u.y), 2.2);
    if (w.T < vis.burnUntil) { if (Math.random() < dt * 18) burnFire.emit({ a: p, n: 1, spd: [0.5, 2], up: 1, jit: 1.6 }); if (Math.random() < dt * 6) burnSmoke.emit({ a: p, n: 1, spd: [2, 4], up: 1, jit: 1.2 }); }
    else if (Math.random() < dt * 1.5) burnSmoke.emit({ a: p, n: 1, spd: [1.5, 3], up: 1, jit: 1 }); }
  for (const e of embers) if (w.T < e.until && Math.random() < dt * 3 * e.big) burnSmoke.emit({ a: e.p, n: 1, spd: [1.5, 3], up: 1, jit: 4 });
}

// ===== الكاميرا: «مخرج» يتبع مراحل الأصل، وسحب/تقريب بالإصبع =====
let auto = true, shotId = '', camPos = new Vector3(0, 120, -520), camTgt = new Vector3(0, 0, 0);
const orbit = { yaw: 0, pitch: 0.5, dist: 400, tx: 0, ty: 0, tz: 0 };
const portrait = () => canvas.clientWidth < canvas.clientHeight;
function mean(l: { x: number; y: number }[]): [number, number] | null { if (!l.length) return null; let x = 0, y = 0; for (const q of l) { x += q.x; y += q.y; } return [WX(x / l.length), WZ(y / l.length)]; }
function lead(l: Unit[], side: 0 | 1): Unit | null { const al = l.filter(u => u.alive); const q = al.length ? al : l; if (!q.length) return null; return q.reduce((a, b) => (side === 0 ? (b.y < a.y ? b : a) : (b.y > a.y ? b : a))); }
function shot(): { id: string; pos: V3; tgt: V3 } {
  const w = W!, T = w.T, U = w.u, PF = portrait() ? 1.2 : 1;
  const G = (x: number, z: number, dy: number): V3 => [x, groundH(x, z) + dy, z];
  const tankA = lead(U.filter(u => u.side === 0 && u.type === 'tank'), 0), tankD = lead(U.filter(u => u.side === 1 && u.type === 'tank'), 1);
  const infA = lead(U.filter(u => u.side === 0 && u.type === 'inf'), 0);
  const arty = mean(U.filter(u => u.side === 0 && (u.type === 'arty' || u.type === 'mlrs')));
  const vill = mean(w.b) ?? [0, 300], enemy = mean(U.filter(u => u.side === 1)) ?? [0, 220];
  const drone = w.air.find(a => a.kind === 'drone' && a.side === 0) ?? w.air.find(a => a.kind === 'drone'), jetA = w.air.find(a => a.kind === 'jet' && a.side === 0) ?? w.air.find(a => a.kind === 'jet');
  const at = (u: Unit): [number, number] => [WX(u.x), WZ(u.y)];
  if (T >= CARD) { const a = T * 0.08; return { id: 'end', pos: G(vill[0] + Math.sin(a) * 190 * PF, vill[1] + Math.cos(a) * 190 * PF - 40, 80), tgt: G(vill[0], vill[1], 0) }; }
  if (T < 4) {
    if (drone) { const p = airPos(drone), yaw = Math.atan2(drone.vx, -drone.vy), fx = Math.sin(yaw), fz = Math.cos(yaw); return { id: 'drone', pos: [p[0] - fx * 16 + fz * 5, p[1] + 4, p[2] - fz * 16 - fx * 5], tgt: [p[0] + fx * 70, p[1] - 30, p[2] + fz * 70] }; }
    return { id: 'open', pos: G(0, -470 * PF, 50), tgt: G(0, 40, 0) };
  }
  const gun = U.find(u => u.side === 0 && u.type === 'arty');
  if (T < 8 && gun) { const [x, z] = at(gun); return { id: 'arty', pos: G(x + 13, z - 15, 4), tgt: G(x - 25, z + 160, 26) }; }
  if (T < 11) { const e = tankD ? at(tankD) : enemy; return { id: 'impact', pos: G(e[0] - 70 * PF, e[1] - 150 * PF, 55), tgt: G(e[0], e[1] + 30, 0) }; }
  if (T < 15 && jetA) { const p = airPos(jetA), yaw = Math.atan2(jetA.vx, -jetA.vy), fx = Math.sin(yaw), fz = Math.cos(yaw); return { id: 'jet' + jetA.id, pos: [p[0] - fx * 34 + fz * 9, p[1] + 7, p[2] - fz * 34 - fx * 9], tgt: [p[0] + fx * 140, groundH(p[0], p[2]) + 30, p[2] + fz * 140] }; }
  if (T < 15) return { id: 'impact2', pos: G(enemy[0] + 90 * PF, enemy[1] - 150 * PF, 60), tgt: G(enemy[0], enemy[1] + 30, 0) };
  if (T < 18) return { id: 'smoke', pos: G(-170 * PF, -70, 18), tgt: G(30, 8, 0) };
  if (T < 21.5 && tankA) { const [x, z] = at(tankA); return { id: 'tank' + tankA.id, pos: G(x - 9, z - 24, 7.5), tgt: G(x + 4, z + 120, 3) }; }
  if (T < 25 && tankA) { const [x, z] = at(tankA), e = tankD ? at(tankD) : enemy, sd = x >= 0 ? 1 : -1; return { id: 'duel', pos: G(x + sd * 55, z - 20, 6), tgt: G(lerp(x, e[0], 0.4), lerp(z, e[1], 0.4), 3) }; }
  if (T < 29 && infA) { const [x, z] = at(infA); return { id: 'inf' + infA.id, pos: G(x - 6, z - 15, 3.8), tgt: G(x + 4, z + 80, 2) }; }
  return { id: 'vill', pos: G(vill[0] - 120 * PF, vill[1] - 170 * PF, 45), tgt: G(vill[0], vill[1] - 40, 0) };
}
function updateCamera(dt: number) {
  if (!W) return;
  if (auto) {
    const s = shot();
    if (s.id !== shotId) { shotId = s.id; camPos.set(...s.pos); camTgt.set(...s.tgt); }   // قطع سينمائي بين المراحل
    else { const k = 1 - Math.exp(-dt * 2.2); camPos = Vector3.Lerp(camPos, v(s.pos), k); camTgt = Vector3.Lerp(camTgt, v(s.tgt), k); }
  } else {
    const cp = Math.cos(orbit.pitch); camTgt.set(orbit.tx, orbit.ty, orbit.tz);
    camPos.set(orbit.tx - Math.sin(orbit.yaw) * cp * orbit.dist, orbit.ty + Math.sin(orbit.pitch) * orbit.dist, orbit.tz - Math.cos(orbit.yaw) * cp * orbit.dist);
    const gy = groundH(camPos.x, camPos.z) + 3; if (camPos.y < gy) camPos.y = gy;
  }
  const sh = shake; shake *= Math.exp(-dt * 7);
  cam.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z + (Math.random() - 0.5) * sh);
  cam.setTarget(camTgt);
  if (portrait()) { cam.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED; cam.fov = 1.15; } else { cam.fovMode = Camera.FOVMODE_VERTICAL_FIXED; cam.fov = 0.8; }
  // الظلال حول اللي نشوفه
  const r = clamp(Vector3.Distance(camPos, camTgt) * 0.9, 80, 420); const c = Vector3.Lerp(camPos, camTgt, 0.6);
  sun.position.set(c.x + SUN[0] * 600, c.y + SUN[1] * 600, c.z + SUN[2] * 600); sun.orthoLeft = -r; sun.orthoRight = r; sun.orthoTop = r; sun.orthoBottom = -r;
}
function setAuto(on: boolean) {
  auto = on; $('bCam').setAttribute('aria-pressed', String(on)); shotId = '';
  if (!on) { const d = camTgt.subtract(camPos); orbit.dist = d.length(); orbit.yaw = Math.atan2(d.x, d.z); orbit.pitch = Math.asin(clamp(-d.y / orbit.dist, -1, 1)); orbit.tx = camTgt.x; orbit.ty = camTgt.y; orbit.tz = camTgt.z; }
}
const ptrs = new Map<number, { x: number; y: number }>(); let pinch0 = 0;
canvas.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId); if (auto && W) setAuto(false); });
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  if (ptrs.size === 1) { const dx = e.clientX - p.x, dy = e.clientY - p.y; orbit.yaw += dx * 0.006; orbit.pitch = clamp(orbit.pitch + dy * 0.004, 0.05, 1.45); }
  else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); p.x = e.clientX; p.y = e.clientY; const [c, d] = [...ptrs.values()], d1 = Math.hypot(c.x - d.x, c.y - d.y);
    if (pinch0 && d0 > 0) orbit.dist = clamp(orbit.dist * d0 / d1, 25, 1600); pinch0 = d1;
    // تحريك بإصبعين: نزحزح المركز
    return;
  }
  p.x = e.clientX; p.y = e.clientY;
});
const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch0 = 0; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { e.preventDefault(); if (auto && W) setAuto(false); orbit.dist = clamp(orbit.dist * Math.exp(e.deltaY * 0.001), 25, 1600); }, { passive: false });

// ===== الشريط (hud بالأصل) =====
let lastPh = '', endShown = false;
function hud() {
  const w = W!; const ph = phase(w.T);
  if (ph !== lastPh) { lastPh = ph; const el = $('bphase'); el.style.opacity = '0'; setTimeout(() => { el.textContent = ph; el.style.opacity = '1'; }, 150); }
  const b = bars(w); ($('bla') as HTMLElement).style.width = clamp(b.a, 0, 100) + '%'; ($('bld') as HTMLElement).style.width = clamp(b.d, 0, 100) + '%';
  if (w.T >= CARD && !endShown) {
    endShown = true; const res = w.res, e = $('bend'); e.hidden = false; e.className = res.win ? 'win' : 'lose';
    e.innerHTML = `<div class="stamp">${stamp(res)}</div><h2>${res.rname}</h2><p>خسرت ${Math.round(res.la * 100)}٪ من القوة المشاركة، والعدو خسر ${Math.round(res.ld * 100)}٪ من مدافعيه. المدة ${res.wk} أسابيع.</p><button class="btn go" id="bBack">رجوع للقيادة</button><button class="btn" id="bAgain">شوفها مرة ثانية</button>`;
    $('bBack').onclick = () => showStart(); $('bAgain').onclick = () => startBattle();
  }
}

// ===== التشغيل =====
let curRes = 'win', running = false, paused = false, last = performance.now();
function clearBattle() {
  for (const v of unitVis.values()) v.s.root.dispose(); unitVis.clear();
  for (const h of heliVis.values()) h.root.dispose(); heliVis.clear();
  for (const a of airVis.values()) a.s.root.dispose(); airVis.clear();
  for (const p of prVis.values()) p.m?.dispose(); prVis.clear();
  for (const h of houseVis) { h.root.dispose(); h.rubble?.dispose(); } houseVis.length = 0;
  for (const m of propMeshes) m.dispose(); propMeshes.length = 0;
  pools.forEach(p => p.flush()); decals = []; decal.thinInstanceCount = 0; embers.length = 0; solState.clear();
}
function buildScene(res: Res) {
  gSeed = 3 + Math.random() * 50; buildGround();
  // البيوت: نفس أماكن الأصل وأحجامها (b.w بالبكسل = متر)
  for (const b of W!.b) {
    const ti = (b.id * 7 + b.c) % HOUSE_TYPES.length, T = HOUSE_TYPES[ti], k = T.s * clamp(b.w / Math.max(T.w, T.d) * 1.15, 0.85, 1.6);
    const X = WX(b.x), Z = WZ(b.y), root = new TransformNode('house', scene);
    const inst = houseC[ti].instantiateModelsToScene(n => n, false); inst.rootNodes.forEach(r => { r.parent = root; });
    root.getChildMeshes().forEach(m => { m.isVisible = true; m.isPickable = false; m.receiveShadows = true; caster(m); });
    root.scaling.setAll(k); root.position.set(X, groundH(X, Z) - 0.2, Z); root.rotation.y = -b.r + (b.id % 2 ? Math.PI / 2 : 0) + (b.id % 3 === 0 ? Math.PI : 0);
    houseVis.push({ root, rubble: null, x: X, z: Z, w: b.w });
  }
  // أشجار وسيارات محروقة حسب الأرض (بعيد عن طريق الدبابات والبيوت)
  const rr = (() => { let s = 11; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  const freeAt = (x: number, z: number, rad: number) => roadD(x, z) > 7 + rad && houseVis.every(h => Math.hypot(h.x - x, h.z - z) > h.w * 0.9 + rad);
  const mats = (n: number, area: () => [number, number], rad: number, s0: number, s1: number) => { const out: number[] = []; for (let i = 0, t = 0; i < n && t < n * 30; t++) { const [x, z] = area(); if (!freeAt(x, z, rad)) continue; const s = lerp(s0, s1, rr()); out.push(...Matrix.Compose(new Vector3(s, s, s), Quaternion.RotationYawPitchRoll(rr() * 6.28, 0, 0), new Vector3(x, groundH(x, z) - 0.1, z)).asArray()); i++; } return out; };
  const edge = (): [number, number] => { const side = rr() < 0.5 ? -1 : 1; return [side * lerp(170, 700, rr() ** 0.7), lerp(-600, 700, rr())]; };
  const village = (): [number, number] => [lerp(-200, 200, rr()), lerp(220, 420, rr())];
  const band = (): [number, number] => [lerp(-230, 230, rr()), lerp(-60, 160, rr())];
  if (terr === 'desert') { scatterProp(PROPS.p_palm, mats(26, village, 2, 0.8, 1.2)); scatterProp(PROPS.p_acacia, mats(40, edge, 3, 0.7, 1.3)); scatterProp(PROPS.p_acacia, mats(6, band, 3, 0.7, 1.1)); }
  else if (terr === 'plain') { scatterProp(PROPS.p_palm, mats(46, village, 2, 0.8, 1.2)); scatterProp(PROPS.p_tree, mats(60, edge, 3, 0.8, 1.4)); scatterProp(PROPS.p_palm, mats(12, band, 2, 0.8, 1.2)); }
  else { scatterProp(PROPS.p_tree, mats(28, village, 3, 0.7, 1.2)); scatterProp(PROPS.p_acacia, mats(50, edge, 3, 0.8, 1.4)); scatterProp(PROPS.p_tree, mats(10, band, 3, 0.7, 1.1)); }
  const nearRoad = (): [number, number] => { const q = ROAD[1 + Math.floor(rr() * (ROAD.length - 3))], s = rr() < 0.5 ? -1 : 1; return [q[0] + s * lerp(9, 16, rr()), q[2] + lerp(-10, 10, rr())]; };
  const carM = (n: number) => { const out: number[] = []; for (let i = 0; i < n; i++) { const [x, z] = nearRoad(); out.push(...Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(rr() * 6.28, 0, (rr() - 0.5) * 0.1), new Vector3(x, groundH(x, z), z)).asArray()); } return out; };
  scatterProp(PROPS.p_car1, carM(2)); scatterProp(PROPS.p_car2, carM(2)); scatterProp(PROPS.p_pickup, carM(2));
  void res;
}
function startBattle() {
  const base = SAMPLES[curRes]; const res: Res = { ...structuredClone(base), terr, an: 'العراق', bn: curRes === 'capital' ? 'العدو' : 'العدو' };
  clearBattle(); W = create(res); buildScene(res); W.u.forEach(spawnUnit);
  $('bna').textContent = res.an!; $('bnd').textContent = res.bn!; $('bwhere').textContent = `${res.rname} — ${TERR_N[terr]}`;
  $('bend').hidden = true; endShown = false; lastPh = ''; speed = 1; $('bSpeed').textContent = 'سرعة ×1'; shotId = ''; setAuto(true);
  ($('start') as HTMLElement).hidden = true; $('hud').hidden = false; $('ctl').hidden = false; running = true; sfx.init(); last = performance.now();
}
function showStart() { running = false; ($('start') as HTMLElement).hidden = false; $('hud').hidden = true; $('ctl').hidden = true; $('bend').hidden = true; }
$('bSpeed').onclick = () => { speed = speed === 1 ? 3 : 1; $('bSpeed').textContent = 'سرعة ×' + speed; };
$('bSkip').onclick = () => { if (W) { speed = 1; $('bSpeed').textContent = 'سرعة ×1'; skip(W); } };
$('bCam').onclick = () => setAuto(!auto);
$('bMute').onclick = () => { $('bMute').textContent = sfx.toggle() ? '🔇' : '🔊'; };
const seg = (id: string, f: (v: string) => void) => $(id).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); f(b.dataset.v!); }));
seg('sRes', v => { curRes = v; const t = SAMPLES[v].terr; terr = t; $('sTerr').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.v === t))); });
seg('sTerr', v => { terr = v as Terr; });
$('bGo').onclick = () => startBattle();
$('credBtn').onclick = () => { $('credits').hidden = false; }; $('credX').onclick = () => { $('credits').hidden = true; };

function frame() {
  const now = performance.now(), rdt = clamp((now - last) / 1000, 0, 0.05); last = now;
  if (running && W) {
    const dt = paused ? 0 : rdt * speed;
    if (W.T < END + 600 && dt > 0) { step(W, dt); for (const f of W.fx) handleFx(f); W.fx.length = 0; }
    syncUnits(dt); syncHelis(dt); syncAir(dt); syncProj(dt); burnFx(dt); drawSoldiers(dt); hud();
    // أصوات مستمرة: مسيّرة وهليكوبتر حسب القرب
    let dd = 1e9, hd = 1e9; for (const a of W.air) if (a.kind === 'drone') dd = Math.min(dd, camD(airPos(a))); for (const h of W.heli) if (W.T >= h.t0) hd = Math.min(hd, camD(heliPos(h)));
    sfx.loops(dd, hd);
    tickLights(dt);
  } else {
    // شاشة البداية: لفّة بطيئة حول الميدان
    const a = now / 9000; camPos.set(Math.sin(a) * 520, 140, Math.cos(a) * 520 - 100); camTgt.set(0, 0, 60);
  }
  updateCamera(rdt);
  pools.forEach(p => { p.ps.updateSpeed = (running ? rdt * speed : rdt) || 1 / 60; });
  scene.render();
}

async function boot() {
  const L = $('load'), say = (t: string) => { L.textContent = t; };
  makeProcedural(); terr = 'desert'; buildGround();
  let done = 0; const jobs: Promise<unknown>[] = [];
  const tick = () => say(`يحمّل المجسمات… ${++done}/${Object.keys(MODEL).length + 3}`);
  for (const n of Object.keys(MODEL)) jobs.push(loadModel(n).then(tick));
  jobs.push(loadHouses().then(tick), loadSoldier().then(tick));
  jobs.push(Promise.all([loadProp('t_p_palm', 'h', 9.5), loadProp('t_p_tree', 'h', 7.5, 2.1), loadProp('t_p_acacia', 'h', 6, 1.7), loadProp('t_p_car1', 'len', 4.4), loadProp('t_p_car2', 'len', 4.3), loadProp('t_p_pickup', 'len', 5.2)])
    .then(([a, b, c, d, e, f]) => { Object.assign(PROPS, { p_palm: a, p_tree: b, p_acacia: c, p_car1: d, p_car2: e, p_pickup: f }); tick(); }));
  engine.runRenderLoop(frame);
  await Promise.all(jobs);
  say(''); const go = $('bGo') as HTMLButtonElement; go.disabled = false; go.textContent = 'ابدأ المعركة';
  if (AUTO) { const r = qs.get('r'); if (r && SAMPLES[r]) curRes = r; const t = qs.get('terr') as Terr | null; terr = t ?? SAMPLES[curRes].terr; startBattle(); (window as any).ready = true; }
}
window.addEventListener('resize', () => engine.resize());
// للفحص الآلي: تقديم المعركة لوقت معيّن بخطوات ثابتة
(window as any).seek = (t: number) => { if (!W) return; while (W.T < t) { step(W, 1 / 30); for (const f of W.fx) handleFx(f); W.fx.length = 0; syncUnits(1 / 30); syncHelis(1 / 30); syncAir(1 / 30); syncProj(1 / 30); burnFx(1 / 30); drawSoldiers(1 / 30); } hud(); };
(window as any).camShot = () => shotId;
(window as any).pause = (on: boolean) => { paused = on; };
(window as any).camAt = (p: V3, t: V3) => { setAuto(false); const d = v(t).subtract(v(p)); orbit.dist = d.length(); orbit.yaw = Math.atan2(d.x, d.z); orbit.pitch = Math.asin(clamp(-d.y / orbit.dist, -1, 1)); orbit.tx = t[0]; orbit.ty = t[1]; orbit.tz = t[2]; };
(window as any).ent = () => ({ air: W!.air.map(a => [a.kind, a.side, ...airPos(a)]), heli: W!.heli.filter(h => W!.T >= h.t0).map(h => heliPos(h)) });
(window as any).hideFx = (k: string) => { if (k === 'ps') scene.particleSystems.forEach(p => p.reset()); if (k === 'decal') decal.isVisible = false; if (k === 'props') propMeshes.forEach(m => m.isVisible = false); if (k === 'sol') solMesh!.isVisible = false; };
(window as any).dbg = () => scene.getActiveMeshes().data.slice(0, scene.getActiveMeshes().length).map(m => { const b = m.getBoundingInfo().boundingBox; return m.name + ':' + b.extendSizeWorld.x.toFixed(0) + 'x' + b.extendSizeWorld.y.toFixed(0) + 'x' + b.extendSizeWorld.z.toFixed(0) + (m.material ? '/' + m.material.name : ''); }).filter(s => /:([0-9]{3,})/.test(s));
boot().catch(e => { console.error(e); $('load').textContent = 'خطأ بالتحميل: ' + e.message; });
