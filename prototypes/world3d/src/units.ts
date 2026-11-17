// مجسمات 3D (WM11.4): كل مجسم ينخبز لشبكة وحدة (قدّامه +z، طوله الحقيقي، قاعدته على الأرض) وتنسخ لكل وحدة.
// الدبابات: البرج ينفصل عن الجسم (نفس حدود المسرح) ويلف حول محوره. S-400 يبقى بهيكله حتى حركة رفع الأنابيب تشتغل.
import { SceneLoader, Mesh, VertexData, Vector3, Matrix, Quaternion, StandardMaterial, Color3, PBRMaterial, TransformNode, type AssetContainer, type Scene, type AnimationGroup, type Material } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
const MURL = import.meta.glob('../models/*.gltf.json', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
// [ملف، لف حتى قدّامه يصير +z، الطول بالمتر]
export const MODELS: Record<string, { yaw: number; len: number }> = {
  f16: { yaw: Math.PI / 2, len: 15.1 }, su25: { yaw: Math.PI / 2, len: 15.5 }, f14: { yaw: -Math.PI / 2, len: 19.1 },
  abrams: { yaw: 0, len: 9.8 }, t72: { yaw: Math.PI, len: 9.5 }, bmp: { yaw: 0, len: 6.7 }, grad: { yaw: 0, len: 7.4 }, truck: { yaw: Math.PI, len: 5.3 },
  patriot: { yaw: Math.PI / 2, len: 10.4 }, s400: { yaw: Math.PI, len: 13.5 }, zolf: { yaw: 0, len: 13.2 },
};
const TURRET: Record<string, { piv: [number, number]; f: (x: number, y: number, z: number) => boolean }> = {
  abrams: { piv: [0, -0.7], f: (x, y, z) => (y > 1.3 && Math.abs(x) < 1.9 && z > -3.7 && z < 1.95) || (y > 1.12 && Math.abs(x) < 0.2 && z > 1.9) },
  t72: { piv: [0, 0.85], f: (x, y, z) => (y > 0.9 && Math.hypot(x, z - 0.85) < 1.75) || (y > 1.25 && Math.abs(x) < 2.05 && z > -1 && z < 3) || (y > 0.9 && Math.abs(x) < 0.3 && z < 0.85) },
};
export interface Proto { hull: Mesh; tur?: Mesh; dead: Mesh; deadTur?: Mesh; shadow: Mesh; piv?: Vector3; h: number; cont?: AssetContainer; scale?: number; yawFix?: number; off?: Vector3 }
export const PROTO: Record<string, Proto> = {};
let darkMat: StandardMaterial, shadowMat: StandardMaterial;
function fixMats(c: AssetContainer) { for (const m of c.materials) if (m instanceof PBRMaterial) { m.metallic = Math.min(m.metallic ?? 0, .15); m.roughness = Math.max(m.roughness ?? .8, .65); m.environmentIntensity = 0; } }
export async function loadModels(scene: Scene, prog: (s: string) => void) {
  darkMat = new StandardMaterial('dark', scene); darkMat.diffuseColor = new Color3(.08, .075, .07); darkMat.specularColor = Color3.Black();
  shadowMat = new StandardMaterial('shadow', scene); shadowMat.diffuseColor = Color3.Black(); shadowMat.disableLighting = true; shadowMat.alpha = .28; shadowMat.backFaceCulling = false;
  await Promise.all(Object.keys(MODELS).map(async n => {
    const url = Object.entries(MURL).find(([k]) => k.endsWith(`/${n}.gltf.json`))![1];
    const c = await SceneLoader.LoadAssetContainerAsync(url, '', scene, null, '.gltf'); fixMats(c); prog('المجسمات');
    if (n === 's400') return animated(n, c, scene);
    bake(n, c, scene);
  }));
}
// يخبز كل الأجزاء بإحداثيات العالم، يقص البرج إذا موجود، ويرجّع شبكة واحدة لكل جزء بعد اللف والتحجيم
function bake(n: string, c: AssetContainer, scene: Scene) {
  const T = TURRET[n], cfg = MODELS[n]; c.addAllToScene();
  const parts: { pos: Float32Array; nor: Float32Array | null; uv: Float32Array | null; idx: number[]; mat: Material | null; tur: boolean }[] = [];
  const tv = new Vector3(), tn = new Vector3();
  for (const m of c.meshes) {
    if (!(m instanceof Mesh) || !m.getTotalVertices()) continue;
    m.computeWorldMatrix(true); const Wm = m.getWorldMatrix(), flip = Wm.determinant() < 0;
    const pos = m.getVerticesData('position')!, nor = m.getVerticesData('normal'), uv = m.getVerticesData('uv'), nv = pos.length / 3, idx = m.getIndices() ?? Array.from({ length: nv }, (_, i) => i);
    const P = new Float32Array(pos.length), N = nor ? new Float32Array(nor.length) : null;
    for (let i = 0; i < nv; i++) { Vector3.TransformCoordinatesFromFloatsToRef(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], Wm, tv); P.set([tv.x, tv.y, tv.z], i * 3);
      if (N && nor) { Vector3.TransformNormalFromFloatsToRef(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2], Wm, tn); tn.normalize(); N.set([tn.x, tn.y, tn.z], i * 3); } }
    const sets: number[][] = [[], []];
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], d = idx[t + 2];
      const isT = T ? T.f(-(P[a * 3] + P[b * 3] + P[d * 3]) / 3, (P[a * 3 + 1] + P[b * 3 + 1] + P[d * 3 + 1]) / 3, (P[a * 3 + 2] + P[b * 3 + 2] + P[d * 3 + 2]) / 3) : false;
      sets[isT ? 1 : 0].push(a, flip ? d : b, flip ? b : d); }
    sets.forEach((ix, k) => { if (ix.length) parts.push({ pos: P, nor: N, uv: uv ? Float32Array.from(uv) : null, idx: ix, mat: m.material, tur: k === 1 }); });
  }
  // اللف حتى قدّامه +z، والطول الحقيقي، والوسط على المحور، والقاعدة على الأرض
  const R = Matrix.RotationY(cfg.yaw), mn = new Vector3(1e9, 1e9, 1e9), mx = new Vector3(-1e9, -1e9, -1e9), q = new Vector3();
  for (const p of parts) for (const i of p.idx) { Vector3.TransformCoordinatesFromFloatsToRef(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2], R, q); mn.minimizeInPlace(q); mx.maximizeInPlace(q); }
  const s = cfg.len / (mx.z - mn.z), ctr = new Vector3((mn.x + mx.x) / 2, mn.y, (mn.z + mx.z) / 2);
  const X = (v: Vector3) => Vector3.TransformCoordinates(v, R).subtract(ctr).scale(s);
  const piv = T ? X(new Vector3(-T.piv[0], 0, T.piv[1])) : undefined; if (piv) piv.y = 0;
  const build = (tur: boolean) => { const ms: Mesh[] = [];
    for (const p of parts.filter(p2 => p2.tur === tur)) { const map = new Map<number, number>(), np: number[] = [], nn: number[] = [], nu: number[] = [], ni: number[] = [];
      for (const i of p.idx) { let j = map.get(i); if (j === undefined) { j = map.size; map.set(i, j); const v = X(new Vector3(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2])); if (tur && piv) v.subtractInPlace(piv); np.push(v.x, v.y, v.z);
        if (p.nor) { const nv2 = Vector3.TransformNormal(new Vector3(p.nor[i * 3], p.nor[i * 3 + 1], p.nor[i * 3 + 2]), R); nn.push(nv2.x, nv2.y, nv2.z); } if (p.uv) nu.push(p.uv[i * 2], p.uv[i * 2 + 1]); } ni.push(j); }
      const vd = new VertexData(); vd.positions = np; vd.indices = ni; if (!nn.length) VertexData.ComputeNormals(np, ni, nn); vd.normals = nn; vd.uvs = nu.length ? nu : new Array(np.length / 3 * 2).fill(0); /* كل الأجزاء لازم نفس الخصائص حتى تندمج */ const pm = new Mesh(`${n}_p`, scene); vd.applyToMesh(pm); pm.material = p.mat; ms.push(pm); }
    if (!ms.length) return undefined; const M = ms.length > 1 ? Mesh.MergeMeshes(ms, true, true, undefined, false, true)! : ms[0]; M.name = `${n}_${tur ? 'tur' : 'hull'}`; M.isPickable = false; M.setEnabled(false); return M; };
  const hull = build(false)!, tur = build(true);
  for (const m of c.meshes) m.dispose(); for (const t of c.transformNodes) t.dispose();
  const dead = hull.clone(`${n}_dead`); dead.material = darkMat; dead.setEnabled(false); const deadTur = tur?.clone(`${n}_deadt`); if (deadTur) { deadTur.material = darkMat; deadTur.setEnabled(false); }
  const shadow = hull.clone(`${n}_sh`); shadow.material = shadowMat; shadow.setEnabled(false);
  PROTO[n] = { hull, tur, dead, deadTur, shadow, piv, h: (mx.y - mn.y) * s };
}
// مجسم متحرك (S-400): ينسخ بهيكله لكل منصة، وأنيميشن «Raise» يتحكم بيه حسب رفع المحاكاة
function animated(n: string, c: AssetContainer, scene: Scene) {
  const cfg = MODELS[n]; const root = c.createRootMesh(); root.computeWorldMatrix(true);
  const { min, max } = root.getHierarchyBoundingVectors(true); const s = cfg.len / Math.max(max.z - min.z, max.x - min.x);
  PROTO[n] = { hull: null as any, dead: null as any, shadow: null as any, cont: c, scale: s, yawFix: cfg.yaw, off: new Vector3(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2), h: (max.y - min.y) * s };
  void scene;
}
export interface UnitVis { node: TransformNode; hull: Mesh; tur?: Mesh; sh: Mesh; dead: boolean; anim?: AnimationGroup; n: string }
export function makeUnit(n: string, scene: Scene, dead = false): UnitVis {
  const P = PROTO[n], node = new TransformNode('u_' + n, scene);
  if (P.cont) { const inst = P.cont.instantiateModelsToScene(nm => nm, false, { doNotInstantiate: true }); const r = inst.rootNodes[0] as TransformNode;
    const inner = new TransformNode('in', scene); inner.parent = node; inner.rotation.y = P.yawFix!; r.parent = inner; r.scaling.scaleInPlace(P.scale!); r.position = P.off!.scale(P.scale!);
    for (const m of r.getChildMeshes(false)) { let q: any = m, hide = false; while (q) { if (/^(msl_show|stand_|V55_)/.test(q.name)) hide = true; q = q.parent; } if (hide) m.setEnabled(false); }   // نفس الأجزاء المخفية بصور WM8
    const anim = inst.animationGroups.find(a => a.name === 'Raise'); inst.animationGroups.forEach(a => a.stop());
    const sh = new Mesh('nosh', scene); return { node, hull: r as any, sh, dead, anim, n }; }
  const hull = (dead ? P.dead : P.hull).clone(`h_${n}`, node)!; hull.setEnabled(true);
  let tur: Mesh | undefined; if (P.tur) { tur = (dead ? P.deadTur! : P.tur).clone(`t_${n}`, node)!; tur.setEnabled(true); tur.position.copyFrom(P.piv!); }
  const sh = P.shadow.clone(`s_${n}`)!; sh.setEnabled(false);
  return { node, hull, tur, sh, dead, n };
}
// اتجاه بالمحاكاة (hd من الشرق عكس الساعة، أنف gam، ميلان bank) ← كواترنيون Babylon (قدّام المجسم +z)
export const orient = (hd: number, gam = 0, bank = 0) => Quaternion.RotationYawPitchRoll(Math.PI / 2 - hd, -gam, bank);
