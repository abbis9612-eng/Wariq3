// الأرض 3D (WM11.2): أربع شبكات (العالم، الشرق الأوسط، الجبهة، ساحة المعركة ~19 م/بكسل)، الأدق تنحفر لها فتحة بالأخشن وتنزل لها «تنورة» تسد الشقوق.
// الخريطة مرسومة ومظللة مسبقاً (بدون إضاءة)؛ الارتفاع يتضخم من بعيد حتى الجبال تبين، ومن قريب يرجع حقيقي تقريباً.
import { Mesh, VertexData, ShaderMaterial, Effect, Texture, Color3, Vector3, DynamicTexture, type Scene } from '@babylonjs/core';
// شيدر الأرض: الخريطة المرسومة × حبيبات تبين من قريب بس، + ضباب حسب البعد (لما تميل الكاميرا)
Effect.ShadersStore.terrVertexShader = `precision highp float; attribute vec3 position; attribute vec2 uv; uniform mat4 world; uniform mat4 viewProjection; uniform vec3 camPos; varying vec2 vUV; varying float vDist;
void main(){ vec4 wp = world * vec4(position, 1.); gl_Position = viewProjection * wp; vUV = uv; vDist = length(wp.xyz - camPos); }`;
Effect.ShadersStore.terrFragmentShader = `precision highp float; varying vec2 vUV; varying float vDist; uniform sampler2D map; uniform sampler2D grain; uniform float gScale; uniform float gAmt; uniform vec3 fogColor; uniform float fogDensity;
void main(){ vec3 c = texture2D(map, vUV).rgb; float g = texture2D(grain, vUV * gScale).r; c *= 1. + (g - .5) * gAmt * smoothstep(5000., 200., vDist);
 float d = vDist * fogDensity; gl_FragColor = vec4(mix(fogColor, c, clamp(exp(-d * d), 0., 1.)), 1.); }`;
import LVJ from '../terrain/levels.json';
import { m2s, clamp } from './geo';
const URL_ = import.meta.glob('../terrain/*.{webp,png}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const U = (n: string) => Object.entries(URL_).find(([k]) => k.endsWith('/' + n))![1];
type LvName = 'w' | 'me' | 'th' | 'cl';
interface Level { name: LvName; m: number[]; grid: number; h: Float32Array; mesh: Mesh; mat: ShaderMaterial; c: { x: number; y: number }; tex: Record<string, Texture> }
export const LEVELS: Level[] = [];
const CHILD: Record<LvName, LvName | null> = { w: 'me', me: 'th', th: 'cl', cl: null };
async function heights(url: string) {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D; x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, h = new Float32Array(c.width * c.height);
  for (let i = 0; i < h.length; i++) h[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
  return h;
}
export async function buildTerrain(scene: Scene, theme: string, prog: (s: string) => void) {
  const L = (LVJ as any).levels as Record<LvName, { m: number[]; grid: number }>;
  for (const name of ['w', 'me', 'th', 'cl'] as LvName[]) {
    const { m, grid: G } = L[name], h = await heights(U(`${name}_h.png`)); prog('الأرض');
    const ch = CHILD[name] ? L[CHILD[name]!].m : null;
    const p0 = m2s(m[0], m[1]), p1 = m2s(m[2], m[3]), c = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const pos: number[] = [], uv: number[] = [], idx: number[] = [], N = G + 1;
    for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
      const mx = m[0] + (m[2] - m[0]) * i / G, my = m[1] + (m[3] - m[1]) * j / G, s = m2s(mx, my);
      pos.push(s.x - c.x, Math.max(0, h[j * N + i]), s.y - c.y); uv.push(i / G, 1 - j / G); }
    const inside = (i: number, j: number) => { if (!ch) return false; const ax = m[0] + (m[2] - m[0]) * i / G, bx = m[0] + (m[2] - m[0]) * (i + 1) / G, ay = m[1] + (m[3] - m[1]) * j / G, by = m[1] + (m[3] - m[1]) * (j + 1) / G, e = 1e-9;
      return ax >= ch[0] - e && bx <= ch[2] + e && ay >= ch[1] - e && by <= ch[3] + e; };
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { if (inside(i, j)) continue; const a = j * N + i, b = a + 1, d = a + N, e = d + 1; idx.push(a, d, b, b, d, e); }
    // تنورة على الحافة (للمستويات الأدق): تنزل لتحت حتى ما يبين شق بينها وبين الأخشن
    if (name !== 'w') { const edge: number[] = []; for (let i = 0; i <= G; i++) edge.push(i); for (let j = 1; j <= G; j++) edge.push(j * N + G); for (let i = G - 1; i >= 0; i--) edge.push(G * N + i); for (let j = G - 1; j >= 1; j--) edge.push(j * N); edge.push(0);
      const base = pos.length / 3; for (const v of edge) { pos.push(pos[v * 3], -4000, pos[v * 3 + 2]); uv.push(uv[v * 2], uv[v * 2 + 1]); }
      for (let k = 0; k < edge.length - 1; k++) { const a = edge[k], b = edge[k + 1], a2 = base + k, b2 = base + k + 1; idx.push(a, b, a2, b, b2, a2, a, a2, b, b, a2, b2); } }
    const mesh = new Mesh('terrain_' + name, scene), vd = new VertexData(); vd.positions = pos; vd.indices = idx; vd.uvs = uv; vd.applyToMesh(mesh);
    const mat = new ShaderMaterial('tm_' + name, scene, 'terr', { attributes: ['position', 'uv'], uniforms: ['world', 'viewProjection', 'camPos', 'gScale', 'gAmt', 'fogColor', 'fogDensity'], samplers: ['map', 'grain'] }); mat.backFaceCulling = false;
    // تفاصيل ناعمة من قريب (حبيبات الأرض) حتى ما تبين الخريطة ضبابية: تتكرر كل ~60 م
    const span = Math.abs(m2s(m[2], m[1]).x - m2s(m[0], m[1]).x); mat.setTexture('grain', grain(scene)); mat.setFloat('gScale', span / (name === 'cl' ? 45 : 60)); mat.setFloat('gAmt', name === 'w' ? 0 : name === 'cl' ? .22 : .32);
    mesh.material = mat; mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true;
    LEVELS.push({ name, m, grid: G, h, mesh, mat, c, tex: {} });
  }
  await setTheme(scene, theme, prog);
}
// حبيبات الأرض: رمادي متوسط (0.5 = بدون تغيير) مع نقط أفتح وأغمق
function grain(scene: Scene) { const t = new DynamicTexture('grain', 256, scene, true), x = t.getContext() as CanvasRenderingContext2D; x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, 256, 256);
  let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 14000; i++) { const v = (128 + (rnd() - .5) * 120) | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 3); }
  t.update(); t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; return t; }
export async function setTheme(scene: Scene, theme: string, prog: (s: string) => void = () => {}) {
  for (const l of LEVELS) { if (!l.tex[theme]) { const t = new Texture(U(`${l.name}_${theme}.webp`), scene, false, true, Texture.TRILINEAR_SAMPLINGMODE); t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; await new Promise<void>(r => t.isReady() ? r() : t.onLoadObservable.addOnce(() => r())); l.tex[theme] = t; prog('الخريطة'); }
    l.mat.setTexture('map', l.tex[theme]); }
}
// الارتفاع الحقيقي بأي نقطة (من أدق مستوى يغطيها)، بالمتر
export function groundH(x: number, y: number) {
  for (let k = LEVELS.length - 1; k >= 0; k--) { const l = LEVELS[k], p0 = m2s(l.m[0], l.m[1]), p1 = m2s(l.m[2], l.m[3]);
    const u = (x - p0.x) / (p1.x - p0.x), v = (y - p0.y) / (p1.y - p0.y); if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    const G = l.grid, N = G + 1, fx = u * G, fy = v * G, i = Math.min(G - 1, fx | 0), j = Math.min(G - 1, fy | 0), a = fx - i, b = fy - j, H = l.h;
    return Math.max(0, (H[j * N + i] * (1 - a) + H[j * N + i + 1] * a) * (1 - b) + (H[(j + 1) * N + i] * (1 - a) + H[(j + 1) * N + i + 1] * a) * b); }
  return 0;
}
// تضخيم الجبال حسب بعد الكاميرا: ×1.3 من قريب، ×~20 من الفضاء
export const exagOf = (D: number) => clamp(1.3 * Math.pow(D / 20000, .38), 1.3, 22);
export function placeTerrain(anchor: { x: number; y: number }, exag: number, camPos: Vector3, fog: Color3, fogDensity: number) { for (const l of LEVELS) { l.mesh.position.set(l.c.x - anchor.x, 0, l.c.y - anchor.y); l.mesh.scaling.y = exag; l.mat.setVector3('camPos', camPos); l.mat.setColor3('fogColor', fog); l.mat.setFloat('fogDensity', fogDensity); } }
