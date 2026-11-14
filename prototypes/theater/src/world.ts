// رسم الأرض (I-027): جبال ووديان من خريطة ارتفاع مولّدة بتعرية، خامة تخلط صور حقيقية حسب الميلان والمكان،
// طرق ترابية بآثار عجلات، قرية طين، نخل، شجيرات، صخور، مواقع، وبغداد بالأفق.
import {
  Scene, Mesh, MeshBuilder, LoadAssetContainerAsync, Material, VertexData, VertexBuffer, StandardMaterial, Color3, Texture, Matrix, Quaternion, Vector3, AbstractMesh, TransformNode,
} from '@babylonjs/core';
import { CustomMaterial } from '@babylonjs/materials/custom';
import { V3, SITES, riverX, RIVER_W, HIGHWAY_Z, BERMS, rng, site, dist2d } from './sim';
import { LAND, HN, HMIN, HMAX, WADI_FLOOR, ROADS, WADIS, HIGHWAY_END, setHeightData, groundH, groundN, roadDist, wadiDist, STRIP_ROT, HOUSES, HOUSE_TYPES, House, VILLAGES, WALLS, SANDBAGS, MOUNDS } from './land';
import hUrl from '../textures/land_h.png?url';

export interface SiteProp { site: string; mesh: Mesh; mat: StandardMaterial; hit: boolean }
export interface WorldOut { houses: { damage(i: number): boolean; hole(i: number, dx: number, dz: number): void; crack(i: number): void; reset(): void }; siteProps: SiteProp[] }
const EDGE_Y = -26;
const sm = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const edgeK = (x: number, z: number) => sm(LAND / 2 - 520, LAND / 2 - 20, Math.max(Math.abs(x), Math.abs(z)));
const landY = (x: number, z: number) => groundH(x, z) * (1 - edgeK(x, z)) + EDGE_Y * edgeK(x, z);

export async function loadHeight() {
  const img = new Image(); img.src = hUrl; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = HN; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, HN, HN).data, h = new Float32Array(HN * HN);
  for (let i = 0; i < HN * HN; i++) h[i] = ((d[i * 4] << 8) | d[i * 4 + 1]) / 65535 * (HMAX - HMIN) + HMIN;
  setHeightData(h);
}
const distPoly = (x: number, z: number, pts: [number, number][]) => { let d = 1e9; for (let i = 1; i < pts.length; i++) { const ax = pts[i - 1][0], az = pts[i - 1][1], vx = pts[i][0] - ax, vz = pts[i][1] - az, t = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))); d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t)); } return d; };
const tribDist = (x: number, z: number) => Math.min(...WADIS.map(w => distPoly(x, z, w.pts) - w.w));
function paint(m: Mesh, c: V3) { const n = m.getTotalVertices(), a = new Float32Array(n * 4); for (let i = 0; i < n; i++) a.set([c[0], c[1], c[2], 1], i * 4); m.setVerticesData(VertexBuffer.ColorKind, a); return m; }
function instances(m: Mesh, mats: number[], cols?: number[], stat = true) {
  m.thinInstanceSetBuffer('matrix', new Float32Array(mats), 16, stat);
  if (cols) { m.thinInstanceRegisterAttribute('color', 4); m.thinInstanceSetBuffer('color', new Float32Array(cols), 4, stat); }
  m.isPickable = false; m.alwaysSelectAsActiveMesh = true;
}
const onGround = (x: number, z: number, s: V3, yaw: number, sink = 0, tilt = true) => {
  const q = Quaternion.RotationAxis(Vector3.Up(), yaw);
  if (tilt) { const n = groundN(x, z, 4), t = new Quaternion(); Quaternion.FromUnitVectorsToRef(Vector3.Up(), new Vector3(n[0], n[1], n[2]), t); t.multiplyToRef(q, q); }
  return Matrix.Compose(new Vector3(s[0], s[1], s[2]), q, new Vector3(x, groundH(x, z) - sink, z)).asArray();
};

export async function buildWorld(scene: Scene, o: { HQ: boolean; NL: number; caster: (m: AbstractMesh) => void; texUrls: Record<string, string>; keepClear: V3[]; modelUrl: (n: string) => string; prepMat: (m: Material) => void }): Promise<WorldOut> {
  const { HQ, NL, caster } = o, r = rng(77);
  const tex = (n: string, inv = true) => { const t = new Texture(o.texUrls[`../textures/${n}.webp`], scene, false, inv, Texture.TRILINEAR_SAMPLINGMODE); t.anisotropicFilteringLevel = 8; return t; };
  const mapTex = (n: string) => { const t = tex(n, false); t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE; t.anisotropicFilteringLevel = 1; return t; };

  // ---------- شبكة الأرض: كثيفة بساحة القتال وخفيفة بالأطراف ----------
  const axis = (c0: number, c1: number) => { const out: number[] = []; const fine = HQ ? 15 : 24; let x = -LAND / 2;
    while (x < LAND / 2) { out.push(x); const outside = Math.max(c0 - x, x - c1, 0); x += fine + (115 - fine) * sm(0, 2600, outside); } out.push(LAND / 2); return out; };
  const xs = axis(-5350, 1900), zs = axis(-2500, 1900), nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), nor = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, x = xs[i], z = zs[j], e = 7;
    pos.set([x, landY(x, z), z], k * 3); const dx = landY(x + e, z) - landY(x - e, z), dz = landY(x, z + e) - landY(x, z - e), l = Math.hypot(dx, 2 * e, dz);
    nor.set([-dx / l, 2 * e / l, -dz / l], k * 3); uv.set([x / LAND + 0.5, z / LAND + 0.5], k * 2); }
  let t = 0; for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.set([a, b, c, b, d, c], t); t += 6; }
  const ground = new Mesh('ground', scene); const vd = new VertexData(); vd.positions = pos; vd.normals = nor; vd.uvs = uv; vd.indices = idx; vd.applyToMesh(ground);
  ground.isPickable = false; ground.receiveShadows = true; ground.alwaysSelectAsActiveMesh = true;

  // ---------- خامة الأرض ----------
  const gm = new CustomMaterial('groundMat', scene);
  gm.diffuseColor = new Color3(0.85, 0.85, 0.85); gm.specularColor = new Color3(0.035, 0.035, 0.03); gm.specularPower = 10; gm.maxSimultaneousLights = 2 + NL;
  const bump = tex('sand_nor'); bump.uScale = bump.vScale = LAND / 6; bump.level = 0.85; gm.bumpTexture = bump;
  for (const [u, n] of [['sandT', 'sand'], ['rockT', 'rock'], ['pebT', 'pebble'], ['roadT', 'road'], ['macroT', 'macro'], ['farmT', 'farm']] as const) gm.AddUniform(u, 'sampler2D', tex(n));
  gm.AddUniform('landA', 'sampler2D', mapTex('land_a')); gm.AddUniform('landB', 'sampler2D', mapTex('land_b'));
  const f = (n: number) => n.toFixed(1); const G0 = f(site('green').p[0] - 30), G2 = f(site('green').p[2]);
  const roadGL = ROADS.map(([ax, az, bx, bz, hw, k]) => `d=sdS(P,vec2(${f(ax)},${f(az)}),vec2(${f(bx)},${f(bz)}));r${k}=min(r${k},d-${f(hw)});c${k}=min(c${k},d);`).join('\n');
  gm.Fragment_Definitions(`
    float rX(float z){return 260.*sin(z/900.+.6)+110.*sin(z/380.+2.1)+120.;}
    float h21(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    float sdS(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.));}
  `);
  gm.Fragment_Custom_Diffuse(`
    vec2 P=vPositionW.xz; vec2 U=P/${f(LAND)}+.5; float cd=length(vEyePosition.xyz-vPositionW), hgt=vPositionW.y;
    vec3 la=texture2D(landA,U).rgb, lb=texture2D(landB,U).rgb;
    vec2 bxz=la.rg*2.-1.; vec3 bn=vec3(bxz.x,sqrt(max(.04,1.-dot(bxz,bxz))),bxz.y);
    float slope=1.-bn.y, farK=smoothstep(60.,700.,cd);
    vec2 Pr=vec2(P.x*.8+P.y*.6,P.y*.8-P.x*.6)+90.*sin(P.yx/700.);
    float mac=mix(.5,dot(texture2D(macroT,Pr/470.).rgb,vec3(.333)),.6), mac2=dot(texture2D(macroT,vec2(P.x*.6-P.y*.8,P.y*.6+P.x*.8)/2300.+.5).rgb,vec3(.333));
    // رمل وحصى
    vec3 sand=mix(texture2D(sandT,P/6.).rgb,texture2D(sandT,P/41.+.37).rgb,.2+.65*farK);
    sand*=(.62+.55*mac+.25*mac2)*(.86+.3*lb.b);
    float sl=dot(sand,vec3(.3,.55,.15)); sand=mix(sand,sl*vec3(1.08,.98,.8),.45);
    // صخر: إسقاط من فوق + إسقاط جانبي حتى تبين طبقات الصخر على المنحدرات
    vec3 rk=mix(texture2D(rockT,P/34.).rgb,texture2D(rockT,vec2(P.x+P.y,hgt*1.6)/46.).rgb,smoothstep(.12,.34,slope));
    rk=mix(rk,vec3(dot(rk,vec3(.33))),.3)*vec3(1.02,.94,.82)*(.75+.5*mac);
    float rockK=smoothstep(.07,.2,slope+(mac-.5)*.09+smoothstep(70.,300.,hgt)*.05);
    // حصى الوديان
    vec3 pb=mix(texture2D(pebT,P/4.).rgb,vec3(.5,.46,.4),.25+.6*farK)*vec3(1.25,1.18,1.05)*(.8+.4*mac);
    float wad=smoothstep(.25,.75,la.b+(mac-.5)*.3);
    // حقول صغيرة على ضفة الوادي قرب القرية
    float wd=abs(P.x-rX(P.y));
    float vfd=length((P-vec2(-1480.,-320.))*vec2(.62,1.)); float farmV=(1.-smoothstep(250.,420.,vfd+(mac2-.5)*120.))*smoothstep(150.,190.,vfd)*smoothstep(10.,30.,abs(P.y+350.));
    float farmK=max(farmV,1.-smoothstep(170.,330.,wd+(mac2-.5)*160.))*smoothstep(100.,125.,wd)*(1.-smoothstep(900.,1500.,abs(P.y+150.)))*(1.-rockK)*smoothstep(215.,265.,length(P-vec2(${G0},${G2})));
    vec2 pq=vec2(P.x*.96+P.y*.28,P.y*.96-P.x*.28)/vec2(38.,27.); vec2 pf=abs(fract(pq)-.5); float plot=h21(floor(pq));
    vec3 fm=texture2D(farmT,P/7.).rgb*1.5; vec3 crop=mix(fm,vec3(.3,.4,.17)*(.7+.6*mac),.75*(.6+.4*sin(pq.y*40.)));
    fm=mix(fm,crop,step(.5,plot)); fm=mix(fm,sand*.85,smoothstep(.4,.49,max(pf.x,pf.y))); farmK*=step(.18,plot);
    vec3 c=mix(sand,rk,rockK); c=mix(c,pb,wad*.92); c=mix(c,fm,farmK*.9);
    // طرق ترابية: طريق رئيسي، دروب، مدرج
    float r0=1e5,r1=1e5,r2=1e5,c0=1e5,c1=1e5,c2=1e5,d; ${roadGL}
    float nz=(mac-.5)*2.6+(h21(floor(P*.7))-.5)*.5;
    float k0=1.-smoothstep(-1.,2.4,r0+nz), k1=1.-smoothstep(-.8,1.5,r1+nz*.6), k2=1.-smoothstep(-1.,3.,r2+nz);
    vec3 rd=texture2D(roadT,P/7.).rgb; rd=mix(rd,vec3(dot(rd,vec3(.33))),.4)*vec3(1.62,1.5,1.3)*(.85+.3*mac);
    float rut=(1.-smoothstep(.2,.7,abs(c1-1.1)))*k1*.24+((1.-smoothstep(.3,.9,abs(c0-1.5)))+(1.-smoothstep(.3,.9,abs(c0-4.4))))*k0*.17+(1.-smoothstep(.3,1.,abs(c2-2.2)))*k2*.12;
    float rk0=max(k0,max(k1,k2)); c=mix(c,rd,rk0*.92); c*=1.-rut*(.6+.4*h21(floor(P*.5)));
    c*=1.+.1*(1.-smoothstep(0.,9.,min(r0,r2)))*(1.-rk0);
    // الإضاءة المخبوزة: ظل الجبال + تعتيم الشقوق
    c*=mix(vec3(.5,.55,.68),vec3(1.),lb.r)*(.55+.45*lb.g);
    baseColor.rgb=c*1.42;
  `);
  gm.Fragment_Before_Lights(`normalW=normalize(normalW+(bn-normalize(vNormalW))*.9);`);
  ground.material = gm;

  // سواتر ترابية دقيقة فوق الأرض (نفس الخامة فتندمج)
  for (const b of BERMS) { const cx = b[0] + 22, m = MeshBuilder.CreateGround('berm', { width: 22, height: 44, subdivisionsX: 22, subdivisionsY: 30, updatable: true }, scene);
    const p = m.getVerticesData(VertexBuffer.PositionKind)!; for (let i = 0; i < p.length; i += 3) { p[i] += cx; p[i + 2] += b[2]; p[i + 1] = groundH(p[i], p[i + 2]) + 0.04; }
    m.updateVerticesData(VertexBuffer.PositionKind, p); const nn: number[] = []; VertexData.ComputeNormals(p, m.getIndices()!, nn); m.setVerticesData(VertexBuffer.NormalKind, nn);
    const u = m.getVerticesData(VertexBuffer.UVKind)!; for (let i = 0, k = 0; i < p.length; i += 3, k += 2) { u[k] = p[i] / LAND + 0.5; u[k + 1] = p[i + 2] / LAND + 0.5; } m.setVerticesData(VertexBuffer.UVKind, u);
    m.material = gm; m.isPickable = false; m.receiveShadows = true; caster(m); }

  // قاعدة بعيدة تحت كل شي + ماي خفيف بقاع الوادي
  const far = MeshBuilder.CreateGround('far', { width: 90000, height: 90000 }, scene); far.position.y = EDGE_Y - 0.5; far.isPickable = false;
  const fm = new StandardMaterial('farMat', scene); fm.diffuseColor = new Color3(0.6, 0.5, 0.36); fm.specularColor = Color3.Black(); far.material = fm;
  const water = new StandardMaterial('water', scene); water.diffuseColor = new Color3(0.34, 0.4, 0.33); water.specularColor = new Color3(0.8, 0.8, 0.7); water.specularPower = 90; water.alpha = 0.82;
  const L: Vector3[] = [], Rr: Vector3[] = [];
  for (let z = -LAND / 2 + 200; z <= LAND / 2 - 200; z += 40) { const x = riverX(z) + 18 * Math.sin(z / 130), w = RIVER_W(z) * (0.16 + 0.07 * Math.sin(z / 210)); L.push(new Vector3(x - w, WADI_FLOOR + 0.12, z)); Rr.push(new Vector3(x + w, WADI_FLOOR + 0.12, z)); }
  const river = MeshBuilder.CreateRibbon('river', { pathArray: [L, Rr] }, scene); river.material = water; river.isPickable = false;

  // ---------- النبات والصخور ----------
  const clear = (x: number, z: number, rad: number) => o.keepClear.every(q => Math.hypot(x - q[0], z - q[2]) > rad);
  const plain = (name: string) => { const m = new StandardMaterial(name, scene); m.specularColor = Color3.Black(); m.emissiveColor = new Color3(0.07, 0.07, 0.05); m.maxSimultaneousLights = 2 + NL; return m; };
  // نخلة: جذع + سعف مقوّس
  const palmParts: Mesh[] = [];
  const trunk = MeshBuilder.CreateCylinder('tr', { height: 7.2, diameterTop: 0.34, diameterBottom: 0.6, tessellation: 6 }, scene); trunk.position.y = 3.6; palmParts.push(paint(trunk, [0.55, 0.44, 0.31]));
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + (i % 2) * 0.3, droop = 1.6 + (i % 3) * 0.7, pa: Vector3[] = [], pb: Vector3[] = [];
    for (let s = 0; s <= 5; s++) { const u = s / 5, rr = 0.2 + 3.7 * u, y = 7.1 + 1.3 * Math.sin(u * 2.6) - droop * u * u, w = 0.6 * Math.sin(Math.PI * (0.12 + 0.86 * u));
      pa.push(new Vector3(Math.cos(a) * rr - Math.sin(a) * w, y, Math.sin(a) * rr + Math.cos(a) * w)); pb.push(new Vector3(Math.cos(a) * rr + Math.sin(a) * w, y, Math.sin(a) * rr - Math.cos(a) * w)); }
    palmParts.push(paint(MeshBuilder.CreateRibbon('fr', { pathArray: [pa, pb], sideOrientation: Mesh.DOUBLESIDE }, scene), i % 2 ? [0.52, 0.66, 0.3] : [0.62, 0.74, 0.34])); }
  const palm = Mesh.MergeMeshes(palmParts, true, true)!; palm.material = plain('palmMat'); (palm.material as StandardMaterial).backFaceCulling = false;
  const pm: number[] = [], pcol: number[] = []; const G = site('green').p;
  for (let i = 0, n = 0; i < 9000 && n < (HQ ? 620 : 320); i++) {
    const z = -1900 + r() * 3500, side = r() < 0.5 ? -1 : 1, x = riverX(z) + side * (RIVER_W(z) / 2 + 12 + Math.pow(r(), 1.6) * 330);
    if (groundH(x, z) < WADI_FLOOR + 2.5 || roadDist(x, z) < 5 || !clear(x, z, 16) || HOUSES.some(h => Math.hypot(h.x - x, h.z - z) < Math.max(h.w, h.d) * 0.7 + 4)) continue;
    const s = 0.75 + r() * 0.6; pm.push(...onGround(x, z, [s, s * (0.85 + r() * 0.4), s], r() * 6.28, 0.2, false)); const k = 0.8 + r() * 0.35; pcol.push(k, k, k, 1); n++; }
  // نخل بين البيوت وحول القرى
  for (const h of HOUSES) { if (r() > 0.75) continue; for (let q = 0; q < 1 + (r() * 3 | 0); q++) { const a = r() * 6.28, d = Math.max(h.w, h.d) * 0.7 + 4 + r() * 12, x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d;
    if (roadDist(x, z) < 4 || HOUSES.some(o => Math.hypot(o.x - x, o.z - z) < Math.max(o.w, o.d) * 0.6 + 1.5)) continue;
    const s = 0.7 + r() * 0.6; pm.push(...onGround(x, z, [s, s * (0.85 + r() * 0.4), s], r() * 6.28, 0.2, false)); const k = 0.8 + r() * 0.35; pcol.push(k, k, k, 1); } }
  // (النخلة المرسومة صارت احتياط: تنعرض بس إذا ما تحمّل المجسم الحقيقي — شوف TH5.3 جوّه)
  // شجيرات صحراوية
  const shrub = MeshBuilder.CreateIcoSphere('shrub', { radius: 1, subdivisions: 1, flat: true }, scene); shrub.scaling.y = 0.62; shrub.bakeCurrentTransformIntoVertices(); shrub.material = plain('shrubMat');
  const sh: number[] = [], shc: number[] = [];
  for (let i = 0, n = 0; i < 60000 && n < (HQ ? 5200 : 2200); i++) {
    const x = -5600 + r() * 8600, z = -3400 + r() * 6900, td = Math.min(tribDist(x, z), wadiDist(x, z)), near = 1 - sm(0, 260, td);
    if (r() > 0.12 + near * 0.88 || td < -6 || roadDist(x, z) < 2.5 || !clear(x, z, 7) || groundN(x, z)[1] < 0.93) continue;
    const s = 0.5 + r() * r() * 1.5; sh.push(...onGround(x, z, [s * (0.8 + r() * 0.6), s * (0.7 + r() * 0.5), s * (0.8 + r() * 0.6)], r() * 6.28, 0.25 * s, false));
    const dry = r(); shc.push(0.5 + dry * 0.25, 0.56 + dry * 0.1, 0.3 + dry * 0.12, 1); n++; }
  instances(shrub, sh, shc);
  // صخور: على المنحدرات وبالوديان
  const rock = MeshBuilder.CreateIcoSphere('rockM', { radius: 1, subdivisions: 2, flat: false, updatable: true }, scene);
  { const p = rock.getVerticesData(VertexBuffer.PositionKind)!; for (let i = 0; i < p.length; i += 3) { const h = Math.sin(p[i] * 12.9898 + p[i + 1] * 78.233 + p[i + 2] * 37.719) * 43758.5453, k = 0.72 + (h - Math.floor(h)) * 0.5; p[i] *= k; p[i + 1] *= k * 0.7; p[i + 2] *= k; }
    rock.updateVerticesData(VertexBuffer.PositionKind, p); const nn: number[] = []; VertexData.ComputeNormals(p, rock.getIndices()!, nn); rock.setVerticesData(VertexBuffer.NormalKind, nn); }
  const rm = plain('rockMat'); rm.diffuseTexture = tex('rock'); rock.material = rm;
  const rk: number[] = [], rkc: number[] = [];
  for (let i = 0, n = 0; i < 90000 && n < (HQ ? 2600 : 1100); i++) {
    const x = -6000 + r() * 12000, z = -6000 + r() * 12000, ny = groundN(x, z, 8)[1], inW = Math.min(tribDist(x, z), wadiDist(x, z)) < 4;
    if (!(ny < 0.95 || (inW && r() < 0.5) || r() < 0.012) || roadDist(x, z) < 3 || !clear(x, z, 9)) continue;
    const s = (0.4 + r() * r() * (ny < 0.9 ? 4.2 : 1.6)); rk.push(...onGround(x, z, [s * (0.7 + r() * 0.8), s * (0.5 + r() * 0.7), s * (0.7 + r() * 0.8)], r() * 6.28, s * 0.3));
    const k = 0.8 + r() * 0.3; rkc.push(k * 1.05, k * 0.95, k * 0.8, 1); n++; }
  instances(rock, rk, rkc); if (HQ) caster(rock);
  // أعمدة كهرباء على الطريق الرئيسي
  const pole = Mesh.MergeMeshes([MeshBuilder.CreateCylinder('pl', { height: 9, diameter: 0.28, tessellation: 5 }, scene), (() => { const b = MeshBuilder.CreateBox('cb', { width: 0.14, height: 0.14, depth: 2.4 }, scene); b.position.y = 3.9; return b; })()], true)!;
  pole.material = plain('poleMat'); (pole.material as StandardMaterial).diffuseColor = new Color3(0.5, 0.42, 0.33);
  const pl: number[] = []; for (let x = -6100; x < HIGHWAY_END; x += 85) { const z = HIGHWAY_Z + 15 + Math.sin(x) * 0.8; pl.push(...Matrix.Compose(Vector3.One(), Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.sin(x * 3) * 0.04), new Vector3(x, groundH(x, z) + 4.3, z)).asArray()); }
  instances(pole, pl); caster(pole);

  // ---------- البيوت: مجسمات حقيقية (Sketchfab CC BY) بنسخ رقيقة، وحائط حوش، وحالة مهدّم (I-031) ----------
  const wm = new CustomMaterial('bldMat', scene); wm.specularColor = new Color3(0.03, 0.03, 0.03); wm.maxSimultaneousLights = 2 + NL;
  wm.AddUniform('wallT', 'sampler2D', tex('road')); wm.AddUniform('macT', 'sampler2D', tex('macro'));
  wm.Fragment_Custom_Diffuse(`
    vec3 wp=vPositionW; float top=step(.6,abs(vNormalW.y));
    vec2 wu=mix(vec2(wp.x+wp.z,wp.y)/5.,wp.xz/5.,top);
    vec3 wt=texture2D(wallT,wu).rgb; wt=(.5+1.5*dot(wt,vec3(.33)))*vec3(1.04,.95,.8);
    float st=dot(texture2D(macT,vec2(wp.x+wp.z,wp.y*3.)/40.).rgb,vec3(.333));
    baseColor.rgb*=wt*(.8+.36*st)*mix(1.,.88,top);
  `);
  const typeMeshes: Mesh[][] = await Promise.all(HOUSE_TYPES.map(async T => {
    const c = await LoadAssetContainerAsync(o.modelUrl(T.model), scene, { pluginExtension: '.gltf' });
    c.addAllToScene(); c.materials.forEach(o.prepMat);
    const ms = c.meshes.filter(m => m.getTotalVertices() > 0) as Mesh[];
    let mn = new Vector3(1e9, 1e9, 1e9), mx = new Vector3(-1e9, -1e9, -1e9);
    ms.forEach(m => { m.computeWorldMatrix(true); const bb = m.getBoundingInfo().boundingBox; mn = Vector3.Minimize(mn, bb.minimumWorld); mx = Vector3.Maximize(mx, bb.maximumWorld); });
    const N = Matrix.Translation(-(mn.x + mx.x) / 2, -mn.y, -(mn.z + mx.z) / 2).multiply(Matrix.Scaling(T.s, T.s, T.s));
    for (const m of ms) { const wmx = m.computeWorldMatrix(true).clone(); m.setParent(null); m.position.setAll(0); m.rotationQuaternion = null; m.rotation.setAll(0); m.scaling.setAll(1);
      m.bakeTransformIntoVertices(wmx.multiply(N)); m.receiveShadows = true; m.isPickable = false; }
    c.meshes.filter(m => m.getTotalVertices() === 0).forEach(m => m.dispose()); c.transformNodes.forEach(t => t.dispose());
    return ms;
  }));
  const TINT = HOUSE_TYPES.map(T => (T.model === 'h_arabic1' ? 0.72 : 1));
  const slot: number[] = [], byType: number[][] = HOUSE_TYPES.map(() => []);
  const baseY = (h: House) => Math.min(groundH(h.x - h.w / 2, h.z), groundH(h.x + h.w / 2, h.z), groundH(h.x, h.z - h.d / 2), groundH(h.x, h.z + h.d / 2)) - 0.25;
  const hMatrix = (h: House, squash = 1) => Matrix.Compose(new Vector3(1, squash, 1), Quaternion.RotationAxis(Vector3.Up(), h.rot), new Vector3(h.x, baseY(h), h.z));
  for (const h of HOUSES) { slot[h.i] = byType[h.t].length; byType[h.t].push(h.i); }
  const bufs = byType.map(list => { const m = new Float32Array(list.length * 16), c = new Float32Array(list.length * 4);
    list.forEach((hi, k) => { hMatrix(HOUSES[hi]).copyToArray(m, k * 16); const g = (0.9 + ((hi * 37) % 13) / 60) * TINT[HOUSES[hi].t]; c.set([g, g * 0.95, g * 0.86, 1], k * 4); }); return { m, c }; });
  typeMeshes.forEach((ms, t) => ms.forEach(m => { if (!byType[t].length) { m.setEnabled(false); return; }
    m.thinInstanceSetBuffer('matrix', bufs[t].m, 16, false); m.thinInstanceRegisterAttribute('color', 4); m.thinInstanceSetBuffer('color', bufs[t].c, 4, false);
    m.alwaysSelectAsActiveMesh = true; caster(m); }));
  // حائط حوش حول قسم من البيوت (طابوق ملبّخ)
  // الحيطان من land.WALLS (نفسها اللي المحاكاة تستعملها ستر)
  const wallM: number[] = [];
  for (const wl of WALLS) wallM.push(...Matrix.Compose(new Vector3(wl.w, 2.1, wl.d), Quaternion.RotationAxis(Vector3.Up(), wl.rot), new Vector3(wl.x, groundH(wl.x, wl.z) + 0.75, wl.z)).asArray());
  const wall = MeshBuilder.CreateBox('wall', { size: 1 }, scene); paint(wall, [0.9, 0.84, 0.72]); wall.material = wm; wall.receiveShadows = true; instances(wall, wallM); caster(wall);
  // ---------- دمار البيوت (TH5.5): ثقوب بالحيطان ← انهيار جزئي ← ركام ----------
  const dead = new Set<number>(), cracked = new Set<number>();
  const holeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!, hr = rng(5);
    // ثقب قذيفة: حافة مكسرة غير منتظمة، قلب أسود، وهالة سخام
    const ring = (rad: number, jag: number, col: string) => { g.beginPath(); for (let a = 0; a <= 26; a++) { const t = a / 26 * 6.283, rr = rad * (1 - jag + hr() * jag * 2); g.lineTo(64 + Math.cos(t) * rr, 64 + Math.sin(t) * rr); } g.closePath(); g.fillStyle = col; g.fill(); };
    ring(60, 0.25, 'rgba(40,34,28,0.35)'); ring(44, 0.3, 'rgba(70,60,50,0.9)'); ring(30, 0.35, 'rgba(14,12,10,1)');
    const t = new Texture(c.toDataURL(), scene); t.hasAlpha = true; return t; })();
  const holeMat = new StandardMaterial('holeMat', scene); holeMat.diffuseTexture = holeTex; holeMat.useAlphaFromDiffuseTexture = true; holeMat.specularColor = Color3.Black(); holeMat.backFaceCulling = false; holeMat.zOffset = -1; holeMat.maxSimultaneousLights = 2 + NL;
  const holeMesh = MeshBuilder.CreatePlane('hole', { size: 1 }, scene); holeMesh.material = holeMat; holeMesh.isPickable = false;
  const holes: { i: number; m: number[] }[] = [];
  const rub = MeshBuilder.CreateBox('rubble', { size: 1 }, scene); paint(rub, [0.78, 0.72, 0.62]); rub.material = wm; rub.isPickable = false; rub.receiveShadows = true; caster(rub);
  const rubble: number[] = [], rr = rng(17);
  const flushHoles = () => { const a = holes.flatMap(h => h.m); holeMesh.thinInstanceSetBuffer('matrix', new Float32Array(a.length ? a : Matrix.Scaling(0, 0, 0).asArray()), 16, false); holeMesh.alwaysSelectAsActiveMesh = true; };
  const flushRubble = () => { rub.thinInstanceSetBuffer('matrix', new Float32Array(rubble.length ? rubble : Matrix.Scaling(0, 0, 0).asArray()), 16, true); rub.alwaysSelectAsActiveMesh = true; };
  flushHoles(); flushRubble();
  const setHouse = (i: number, squash: number, tilt: number, col: number) => { const h = HOUSES[i], t = h.t, k = slot[i];
    Matrix.Compose(new Vector3(1, squash, 1), Quaternion.RotationAxis(Vector3.Up(), h.rot).multiply(Quaternion.RotationAxis(new Vector3(1, 0, 0), tilt)), new Vector3(h.x, baseY(h), h.z)).copyToArray(bufs[t].m, k * 16);
    const g = (0.9 + ((i * 37) % 13) / 60) * TINT[t] * col; bufs[t].c.set([g, g * 0.95, g * 0.86, 1], k * 4);
    typeMeshes[t].forEach(m => { m.thinInstanceBufferUpdated('matrix'); m.thinInstanceBufferUpdated('color'); }); };
  const houses = {
    damage(i: number) { if (dead.has(i)) return false; dead.add(i); const h = HOUSES[i]; (h as House & { dead?: boolean }).dead = true;
      setHouse(i, 0.3, (rr() - 0.5) * 0.08, 0.36);
      // ركام: كتل طابوق/كونكريت حول الأساس، تبقى
      const R = Math.max(h.w, h.d) * 0.6; for (let q = 0; q < 14; q++) { const a = rr() * 6.28, d = Math.sqrt(rr()) * R, x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d, sz = 0.6 + rr() * 1.8;
        rubble.push(...Matrix.Compose(new Vector3(sz, sz * (0.4 + rr() * 0.5), sz * (0.6 + rr() * 0.8)), Quaternion.FromEulerAngles((rr() - 0.5) * 0.9, rr() * 6.28, (rr() - 0.5) * 0.9), new Vector3(x, groundH(x, z) + sz * 0.15, z)).asArray()); }
      flushRubble();
      for (let q = holes.length - 1; q >= 0; q--) if (holes[q].i === i) holes.splice(q, 1); flushHoles(); return true; },
    /** ثقب على الوجه اللي يقابل اتجاه الضرب (dx,dz = من وين جاية الضربة) */
    hole(i: number, dx: number, dz: number) { if (dead.has(i)) return; const h = HOUSES[i], cs = Math.cos(h.rot), sn = Math.sin(h.rot);
      const faces: [number, number, number][] = [[1, 0, h.w / 2], [-1, 0, h.w / 2], [0, 1, h.d / 2], [0, -1, h.d / 2]];
      let best = faces[0], bs = -9; for (const f of faces) { const nx = f[0] * cs + f[1] * sn, nz = -f[0] * sn + f[1] * cs, sc = nx * dx + nz * dz + rr() * 0.6; if (sc > bs) { bs = sc; best = f; } }
      const along = (rr() - 0.5) * ((best[0] ? h.d : h.w) - 2.5), lx = best[0] ? best[0] * (best[2] + 0.06) : along, lz = best[1] ? best[1] * (best[2] + 0.06) : along;
      const x = h.x + lx * cs + lz * sn, z = h.z - lx * sn + lz * cs, y = baseY(h) + 1.3 + rr() * Math.max(0.5, h.h - 3.2), nx = best[0] * cs + best[1] * sn, nz = -best[0] * sn + best[1] * cs, sz = 1 + rr() * 1.4;
      const m = Matrix.Compose(new Vector3(sz, sz * (0.8 + rr() * 0.4), 1), Quaternion.RotationYawPitchRoll(Math.atan2(nx, nz) + Math.PI, 0, rr() * 6.28), new Vector3(x, y, z)).asArray();
      if (holes.filter(q => q.i === i).length >= 9) return; holes.push({ i, m: [...m] }); if (holes.length > 420) holes.shift(); flushHoles(); },
    /** انهيار جزئي: البيت يميل وينزل شوية ويسود */
    crack(i: number) { if (dead.has(i) || cracked.has(i)) return; cracked.add(i); setHouse(i, 0.8, (rr() < 0.5 ? -1 : 1) * (0.04 + rr() * 0.04), 0.72); },
    reset() { for (const i of new Set([...dead, ...cracked])) { (HOUSES[i] as House & { dead?: boolean }).dead = false; setHouse(i, 1, 0, 1); }
      dead.clear(); cracked.clear(); holes.length = 0; rubble.length = 0; flushHoles(); flushRubble(); },
  };

  // ---------- أشياء حقيقية (TH5.3): نخل، بساتين، أكاسيا، سيارات مهجورة، أكياس رمل، حواجز (Sketchfab CC BY — models/CREDITS.md) ----------
  // كل نوع ينقسم لقطع حسب المكان (خلايا 700م)، وكل قطعة تنخفي إذا بعيدة عن الكاميرا: الرسم والظل بس للقريب (أخف على التلفون)
  const chunks: { ms: Mesh[]; c: Vector3; far: number }[] = [];
  const loadProp = async (name: string, fit: 'h' | 'len', size: number, yaw0 = 0, bright = 1): Promise<Mesh[]> => {
    try {
      const c = await LoadAssetContainerAsync(o.modelUrl(name), scene, { pluginExtension: '.gltf' });
      c.addAllToScene(); c.materials.forEach(o.prepMat);
      if (bright !== 1) c.materials.forEach(m => { const a = (m as Material & { albedoColor?: Color3 }).albedoColor; if (a) a.scaleInPlace(bright); });   // أوراق غامقة بدون إضاءة بيئة
      const ms = c.meshes.filter(m => m.getTotalVertices() > 0) as Mesh[];
      let mn = new Vector3(1e9, 1e9, 1e9), mx = new Vector3(-1e9, -1e9, -1e9);
      ms.forEach(m => { m.computeWorldMatrix(true); const bb = m.getBoundingInfo().boundingBox; mn = Vector3.Minimize(mn, bb.minimumWorld); mx = Vector3.Maximize(mx, bb.maximumWorld); });
      const k = fit === 'h' ? size / (mx.y - mn.y) : size / Math.max(mx.x - mn.x, mx.z - mn.z);
      const N = Matrix.Translation(-(mn.x + mx.x) / 2, -mn.y, -(mn.z + mx.z) / 2).multiply(Matrix.Scaling(k, k, k)).multiply(Matrix.RotationY(yaw0));
      for (const m of ms) { const wmx = m.computeWorldMatrix(true).clone(); m.setParent(null); m.position.setAll(0); m.rotationQuaternion = null; m.rotation.setAll(0); m.scaling.setAll(1); m.bakeTransformIntoVertices(wmx.multiply(N)); m.isPickable = false; m.setEnabled(false); }
      c.meshes.filter(m => m.getTotalVertices() === 0).forEach(m => m.dispose()); c.transformNodes.forEach(t => t.dispose());
      return ms;
    } catch (e) { console.warn('prop', name, e); return []; }
  };
  const scatter = (base: Mesh[], mats: number[], far: number, cast = true, cell = 700) => {
    if (!base.length || !mats.length) return 0;
    const groups = new Map<string, number[]>();
    for (let i = 0; i < mats.length; i += 16) { const key = `${Math.floor(mats[i + 12] / cell)},${Math.floor(mats[i + 14] / cell)}`; let g = groups.get(key); if (!g) groups.set(key, g = []); for (let q = 0; q < 16; q++) g.push(mats[i + q]); }
    for (const [key, arr] of groups) { const [gx, gz] = key.split(',').map(Number);
      const ms = base.map(b => { const m = b.clone(b.name + '_' + key, null, true)!; m.makeGeometryUnique(); /* النسخ تتشارك الهندسة، وأزرار thin instances تنحفظ بالهندسة: بدون هذا آخر قطعة تمسح الباقي */ m.setEnabled(true); m.isVisible = true; m.isPickable = false; m.receiveShadows = true;
        m.thinInstanceSetBuffer('matrix', new Float32Array(arr), 16, true); m.thinInstanceRefreshBoundingInfo(false); if (cast) caster(m); return m; });
      chunks.push({ ms, c: new Vector3((gx + 0.5) * cell, 0, (gz + 0.5) * cell), far }); }
    return mats.length / 16;
  };
  scene.onBeforeRenderObservable.add(() => { const cp = scene.activeCamera?.globalPosition; if (!cp) return;
    for (const ch of chunks) { const v = Math.hypot(cp.x - ch.c.x, cp.z - ch.c.z) < ch.far + cp.y * 0.6; if (ch.ms[0].isVisible !== v) for (const m of ch.ms) m.isVisible = v; } });
  const [P_PALM, P_TREE, P_ACACIA, P_SAND, P_BAR, P_CAR1, P_CAR2, P_PICK] = await Promise.all([
    loadProp('p_palm', 'h', 9.5), loadProp('p_tree', 'h', 7.5, 0, 2.1), loadProp('p_acacia', 'h', 6, 0, 1.7), loadProp('p_sandbag', 'len', 4.2),
    loadProp('p_barrier', 'len', 3.2), loadProp('p_car1', 'len', 4.4), loadProp('p_car2', 'len', 4.3, Math.PI / 2), loadProp('p_pickup', 'len', 5.2)]);
  const nearHouse = (x: number, z: number, pad: number) => HOUSES.some(h => Math.hypot(h.x - x, h.z - z) < Math.max(h.w, h.d) * 0.6 + pad);
  const okAt = (x: number, z: number, rad: number, road = 4, houses = true) => roadDist(x, z) > road && clear(x, z, rad) && (!houses || !nearHouse(x, z, rad * 0.5)) && groundN(x, z)[1] > 0.9 && groundH(x, z) > WADI_FLOOR + 1.5;
  // نخل: نفس أماكن النخل القديم بس بمجسم حقيقي
  if (P_PALM.length) { scatter(P_PALM, pm, 2600); palm.dispose(); } else { instances(palm, pm, pcol); caster(palm); }
  // بساتين: صفوف شجر حول القرى + شجر على ضفاف الوادي
  const orch: number[] = [];
  for (const v of VILLAGES) { const nb = v.id === 'front' ? 10 : v.id === 'river' ? 7 : 3;
    for (let b = 0; b < nb; b++) { const a = r() * 6.28, d = v.rad * (0.45 + r() * 0.75), cx = v.x + Math.cos(a) * d, cz = v.z + Math.sin(a) * d, rot = v.rot + (r() < 0.5 ? 0 : Math.PI / 2), nr = 3 + (r() * 3 | 0), nc = 4 + (r() * 4 | 0), sp = 8 + r() * 2;
      for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { const lx = (j - (nc - 1) / 2) * sp, lz = (i - (nr - 1) / 2) * sp, x = cx + lx * Math.cos(rot) + lz * Math.sin(rot), z = cz - lx * Math.sin(rot) + lz * Math.cos(rot);
        if (r() < (HQ ? 0.12 : 0.5) || !okAt(x, z, 6)) continue; const s = 0.75 + r() * 0.4; orch.push(...onGround(x + (r() - 0.5) * 1.5, z + (r() - 0.5) * 1.5, [s, s * (0.85 + r() * 0.3), s], r() * 6.28, 0.1, false)); } } }
  for (let i = 0, n = 0; i < 4000 && n < (HQ ? 160 : 80); i++) { const z = -1800 + r() * 3400, side = r() < 0.5 ? -1 : 1, x = riverX(z) + side * (RIVER_W(z) / 2 + 20 + r() * 220);
    if (!okAt(x, z, 8)) continue; const s = 0.7 + r() * 0.5; orch.push(...onGround(x, z, [s, s, s], r() * 6.28, 0.1, false)); n++; }
  // أكاسيا متفرقة بالصحراء (بعيد عن الطرق)
  const ac: number[] = [];
  for (let i = 0, n = 0; i < 30000 && n < (HQ ? 320 : 160); i++) { const x = -4800 + r() * 4600, z = -1500 + r() * 2800;
    if (!okAt(x, z, 14, 22) || Math.min(tribDist(x, z), wadiDist(x, z)) < 6) continue; const s = 0.6 + r() * 0.8; ac.push(...onGround(x, z, [s, s * (0.8 + r() * 0.4), s], r() * 6.28, 0.1, false)); n++; }
  // سيارات مهجورة: على كتف الطريق السريع، وواكفة جنب البيوت
  const cars: number[][] = [[], [], []];
  const car = (x: number, z: number, yaw: number, houses: boolean) => { if (!okAt(x, z, 5, 0, houses)) return; cars[(r() * 3) | 0].push(...onGround(x, z, [1, 1, 1], yaw, 0.05)); };
  for (let x = -5200; x < HIGHWAY_END - 50; x += 90 + r() * 240) { const side = r() < 0.5 ? -1 : 1; car(x, HIGHWAY_Z + side * (7 + r() * 6), (r() < 0.8 ? Math.PI / 2 : 0) + (r() - 0.5) * 0.9, true); }
  for (const h of HOUSES) { if (r() > 0.3) continue; const a = h.rot + (r() < 0.5 ? 0 : Math.PI), d = Math.max(h.w, h.d) * 0.5 + 4.5, x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d;
    if (HOUSES.some(o2 => o2 !== h && Math.hypot(o2.x - x, o2.z - z) < Math.max(o2.w, o2.d) * 0.6 + 2)) continue; car(x, z, h.rot + (r() < 0.5 ? Math.PI / 2 : 0), false); }
  // أكياس رمل: مواقع الأبرامز ورا السواتر، الكورنيت، الخط الثاني، وطرف القرية الغربي؛ وحواجز كونكريت بالسيطرة
  const sb: number[] = [], bar: number[] = [], FV = VILLAGES[0];
  for (const b of SANDBAGS) sb.push(...onGround(b.x, b.z, [1, 1, 1], b.yaw, 0.15));   // من land.SANDBAGS (ستر بالمحاكاة)
  for (let i = 0; i < 3; i++) { bar.push(...onGround(-1905, HIGHWAY_Z - 7 + i * 3.3, [1, 1, 1], 0, 0)); bar.push(...onGround(-1875, HIGHWAY_Z + 7 - i * 3.3, [1, 1, 1], 0, 0)); }
  for (let x = FV.x - FV.rad; x < FV.x + FV.rad; x += 40 + r() * 70) bar.push(...onGround(x, HIGHWAY_Z + (r() < 0.5 ? -9.5 : 9.5), [1, 1, 1], Math.PI / 2 + (r() - 0.5) * 0.2, 0));
  // تلال ترابية صغيرة بطريق الهجوم (ستر بالمحاكاة): بيضاوي مسطّح بخامة الرمل
  const mound = MeshBuilder.CreateIcoSphere('mound', { radius: 0.5, subdivisions: 3, updatable: true }, scene);
  { const p = mound.getVerticesData(VertexBuffer.PositionKind)!; for (let i = 0; i < p.length; i += 3) { const h = Math.sin(p[i] * 41.3 + p[i + 1] * 17.9 + p[i + 2] * 63.1) * 43758.5453, k = 0.86 + (h - Math.floor(h)) * 0.28; p[i] *= k; p[i + 2] *= k; p[i + 1] = Math.max(-0.05, p[i + 1] * k); }
    mound.updateVerticesData(VertexBuffer.PositionKind, p); const nn: number[] = []; VertexData.ComputeNormals(p, mound.getIndices()!, nn); mound.setVerticesData(VertexBuffer.NormalKind, nn);
    const mm = plain('moundMat'); const st = tex('sand'); st.uScale = 2; st.vScale = 3; mm.diffuseTexture = st; mm.diffuseColor = new Color3(0.74, 0.69, 0.6); mm.emissiveColor = new Color3(0.05, 0.045, 0.035); mound.material = mm; mound.receiveShadows = true; }
  const mdm: number[] = []; for (const m of MOUNDS) mdm.push(...Matrix.Compose(new Vector3(5, 2.6, m.len), Quaternion.RotationAxis(Vector3.Up(), m.rot), new Vector3(m.x, groundH(m.x, m.z) - 0.05, m.z)).asArray());
  instances(mound, mdm); caster(mound);
  const nProps = scatter(P_TREE, orch, 2000) + scatter(P_ACACIA, ac, 1800) + scatter(P_CAR1, cars[0], 1500) + scatter(P_CAR2, cars[1], 1500) + scatter(P_PICK, cars[2], 1500) + scatter(P_SAND, sb, 1300) + scatter(P_BAR, bar, 1300);
  console.log('props', { palms: pm.length / 16, orch: orch.length / 16, acacia: ac.length / 16, cars: cars.map(c => c.length / 16), sandbags: sb.length / 16, barriers: bar.length / 16, total: nProps, chunks: chunks.length });

  // ---------- المواقع (تتضرر بالقصف) ----------
  const siteProps: SiteProp[] = [];
  const prop = (sid: string, mk: () => Mesh, x: number, z: number, color: V3, rot = 0) => {
    const s = site(sid), px = s.p[0] + x, pz = s.p[2] + z, node = new TransformNode('pn', scene); node.position.set(px, groundH(px, pz) - 0.2, pz); node.rotation.y = rot;
    const mesh = mk(), mat = new StandardMaterial('pm' + siteProps.length, scene); mat.diffuseColor = new Color3(...color); mat.specularColor = new Color3(0.06, 0.06, 0.06); mat.maxSimultaneousLights = 2 + NL;
    mesh.material = mat; mesh.parent = node; mesh.isPickable = false; mesh.receiveShadows = true; caster(mesh); siteProps.push({ site: sid, mesh, mat, hit: false });
  };
  const box = (w: number, h: number, d: number) => () => { const b = MeshBuilder.CreateBox('p', { width: w, height: h, depth: d }, scene); b.position.y = h / 2; return b; };
  const cyl = (dia: number, h: number, top = dia) => () => { const c = MeshBuilder.CreateCylinder('p', { diameterBottom: dia, diameterTop: top, height: h, tessellation: 20 }, scene); c.position.y = h / 2; return c; };
  const hangar = (w: number, len: number) => () => { const c = MeshBuilder.CreateCylinder('hg', { diameter: w, height: len, tessellation: 18, arc: 0.5, sideOrientation: Mesh.DOUBLESIDE }, scene); c.rotation.z = Math.PI / 2; c.rotation.y = Math.PI / 2; return c; };
  // جامع القرية
  prop('green', box(22, 7, 16), 20, 10, [0.9, 0.86, 0.76], 0.25); prop('green', () => { const s = MeshBuilder.CreateSphere('dome', { diameter: 10, segments: 12 }, scene); s.position.y = 7.4; s.scaling.y = 0.8; return s; }, 20, 10, [0.42, 0.62, 0.6]);
  prop('green', cyl(2.6, 21, 1.9), 34, 2, [0.92, 0.88, 0.78]); prop('green', box(26, 5, 12), -60, -40, [0.85, 0.8, 0.68], 0.25);
  // المهبط: حظائر وبرج صغير
  prop('airport', hangar(26, 38), 150, 120, [0.62, 0.6, 0.5], STRIP_ROT); prop('airport', hangar(26, 38), 150, 60, [0.6, 0.58, 0.5], STRIP_ROT); prop('airport', box(9, 13, 9), 110, 190, [0.82, 0.78, 0.68]);
  // خزانات الوقود
  for (let i = 0; i < 6; i++) prop('dora', cyl(22, 11), (i % 3) * 38 - 38, Math.floor(i / 3) * 40 - 20, [0.86, 0.85, 0.8]);
  prop('dora', cyl(3, 30, 2.2), 80, 40, [0.5, 0.46, 0.42]); prop('dora', box(18, 5, 10), -80, 50, [0.8, 0.75, 0.64]);
  for (let i = 0; i < 4; i++) prop('rasheed', box(46, 5, 11), -30, i * 26 - 40, [0.74, 0.69, 0.56]);
  for (let i = 0; i < 3; i++) prop('taji', hangar(22, 44), i * 34 - 34, 0, [0.58, 0.58, 0.5]);
  // حواجز ترابية (هيسكو) حول المعسكرات والسيطرة
  const hesco = MeshBuilder.CreateBox('hesco', { width: 1, height: 1, depth: 1 }, scene); const hm = plain('hescoMat'); hm.diffuseTexture = tex('sand'); (hm.diffuseTexture as Texture).uScale = 3; hm.diffuseColor = new Color3(0.9, 0.82, 0.68); hesco.material = hm; hesco.receiveShadows = true;
  const hs: number[] = []; const ring = (cx: number, cz: number, hw: number, hd: number, gapSide: number) => { for (let k = 0; k < 4; k++) { const horiz = k < 2, len = horiz ? hw * 2 : hd * 2, n = Math.floor(len / 6);
    for (let i = 0; i < n; i++) { if (k === gapSide && Math.abs(i - n / 2) < 1.5) continue; const tpos = -len / 2 + (i + 0.5) * 6, x = cx + (horiz ? tpos : (k === 2 ? -hw : hw)), z = cz + (horiz ? (k === 0 ? -hd : hd) : tpos);
      hs.push(...Matrix.Compose(new Vector3(horiz ? 5.8 : 1.6, 2.2, horiz ? 1.6 : 5.8), Quaternion.Identity(), new Vector3(x, groundH(x, z) + 0.9, z)).asArray()); } } };
  const RS = site('rasheed').p, TJ = site('taji').p, DR = site('dora').p; ring(RS[0] - 30, RS[2], 70, 75, 3); ring(TJ[0], TJ[2], 85, 60, 0); ring(DR[0], DR[2] + 5, 95, 70, 2);
  for (const dz of [-34, 34]) for (let i = 0; i < 3; i++) { const x = -1885 - i * 0.01, z = HIGHWAY_Z + dz + (i - 1) * 6; hs.push(...Matrix.Compose(new Vector3(1.6, 1.7, 5.8), Quaternion.Identity(), new Vector3(x, groundH(x, z) + 0.7, z)).asArray()); }
  instances(hesco, hs); caster(hesco);

  // ---------- بغداد بالأفق (شرقاً): خيال بنايات بالغبار ----------
  const sky = MeshBuilder.CreateBox('skyline', { size: 1 }, scene); const sk = new StandardMaterial('skylineMat', scene); sk.diffuseColor = new Color3(0.7, 0.68, 0.66); sk.specularColor = Color3.Black(); sky.material = sk;
  const sl: number[] = []; for (let i = 0; i < 260; i++) { const x = 8200 + r() * 5200, z = -5200 + r() * 10400, c = 1 - Math.min(1, Math.abs(z) / 5200), h = 18 + r() * 40 + r() * r() * 170 * c, w = 40 + r() * 70;
    sl.push(...Matrix.Compose(new Vector3(w, h, 40 + r() * 70), Quaternion.Identity(), new Vector3(x, EDGE_Y + h / 2, z)).asArray()); }
  instances(sky, sl);
  void SITES;
  return { houses, siteProps };
}
