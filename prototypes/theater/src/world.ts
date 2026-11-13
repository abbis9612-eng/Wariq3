// رسم الأرض (I-027): جبال ووديان من خريطة ارتفاع مولّدة بتعرية، خامة تخلط صور حقيقية حسب الميلان والمكان،
// طرق ترابية بآثار عجلات، قرية طين، نخل، شجيرات، صخور، مواقع، وبغداد بالأفق.
import {
  Scene, Mesh, MeshBuilder, VertexData, VertexBuffer, StandardMaterial, Material, Color3, Texture, DynamicTexture, Matrix, Quaternion, Vector3, AbstractMesh, TransformNode,
} from '@babylonjs/core';
import { CustomMaterial } from '@babylonjs/materials/custom';
import { V3, SITES, riverX, RIVER_W, HIGHWAY_Z, BERMS, rng, site, dist2d } from './sim';
import { LAND, HN, HMIN, HMAX, WADI_FLOOR, ROADS, WADIS, HIGHWAY_END, setHeightData, groundH, groundN, roadDist, wadiDist, STRIP_ROT } from './land';
import hUrl from '../textures/land_h.png?url';

export interface Bld { x: number; y: number; z: number; w: number; d: number; h: number; rot: number; dmg: boolean }
export interface SiteProp { site: string; mesh: Mesh; mat: StandardMaterial; hit: boolean }
export interface WorldOut { bld: Mesh; bldMat: Float32Array; bldCol: Float32Array; bldInfo: Bld[]; siteProps: SiteProp[] }
export const bldMatrix = (b: Bld, h: number) => Matrix.Compose(new Vector3(b.w, h, b.d), Quaternion.RotationAxis(Vector3.Up(), b.rot), new Vector3(b.x, b.y - 0.4, b.z));
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

export async function buildWorld(scene: Scene, o: { HQ: boolean; NL: number; caster: (m: AbstractMesh) => void; texUrls: Record<string, string>; keepClear: V3[] }): Promise<WorldOut> {
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
    float farmK=(1.-smoothstep(170.,330.,wd+(mac2-.5)*160.))*smoothstep(100.,125.,wd)*(1.-smoothstep(900.,1500.,abs(P.y+150.)))*(1.-rockK)*smoothstep(215.,265.,length(P-vec2(${G0},${G2})));
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
    palmParts.push(paint(MeshBuilder.CreateRibbon('fr', { pathArray: [pa, pb], sideOrientation: Mesh.DOUBLESIDE }, scene), i % 2 ? [0.4, 0.56, 0.24] : [0.5, 0.64, 0.28])); }
  const palm = Mesh.MergeMeshes(palmParts, true, true)!; palm.material = plain('palmMat'); (palm.material as StandardMaterial).backFaceCulling = false;
  const pm: number[] = [], pcol: number[] = []; const G = site('green').p;
  for (let i = 0, n = 0; i < 6000 && n < (HQ ? 420 : 220); i++) {
    const z = -1900 + r() * 3500, side = r() < 0.5 ? -1 : 1, x = riverX(z) + side * (RIVER_W(z) / 2 + 12 + Math.pow(r(), 1.6) * 330);
    if (groundH(x, z) < WADI_FLOOR + 2.5 || roadDist(x, z) < 5 || !clear(x, z, 16) || (dist2d([x, 0, z], G) < 215 && r() < 0.6)) continue;
    const s = 0.75 + r() * 0.6; pm.push(...onGround(x, z, [s, s * (0.85 + r() * 0.4), s], r() * 6.28, 0.2, false)); const k = 0.8 + r() * 0.35; pcol.push(k, k, k, 1); n++; }
  instances(palm, pm, pcol); caster(palm);
  // شجيرات صحراوية: بطاقتان متقاطعتان بقوام مقصوص. الكرة كانت تقرأ ككتلة من فوق ومن الجنب.
  const shrubTex = new DynamicTexture('shrubTex', { width: 128, height: 128 }, scene, false);
  shrubTex.hasAlpha = true;
  {
    const g = shrubTex.getContext() as unknown as CanvasRenderingContext2D;
    g.clearRect(0, 0, 128, 128);
    const ell = (x: number, y: number, rx: number, ry: number, rot: number, col: string) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 6.283); g.fill(); g.restore();
    };
    ell(64, 112, 4, 14, 0, 'rgba(86,62,34,.95)');
    ell(64, 72, 34, 28, 0, 'rgba(78,96,38,.97)');
    ell(42, 80, 20, 14, -0.45, 'rgba(104,112,44,.95)');
    ell(88, 76, 18, 16, 0.4, 'rgba(64,82,32,.96)');
    ell(58, 50, 16, 12, 0.15, 'rgba(122,126,54,.92)');
    ell(80, 98, 14, 9, 0.35, 'rgba(92,84,36,.88)');
    shrubTex.update();
  }
  const sA = MeshBuilder.CreatePlane('shA', { width: 2.2, height: 1.55, sideOrientation: Mesh.DOUBLESIDE }, scene); sA.position.y = 0.78;
  const sB = MeshBuilder.CreatePlane('shB', { width: 2.2, height: 1.55, sideOrientation: Mesh.DOUBLESIDE }, scene); sB.position.y = 0.78; sB.rotation.y = Math.PI / 2;
  const shrub = Mesh.MergeMeshes([sA, sB], true, true)!;
  const smat = plain('shrubMat');
  smat.diffuseTexture = shrubTex; smat.useAlphaFromDiffuseTexture = true; smat.transparencyMode = Material.MATERIAL_ALPHATEST; smat.alphaCutOff = 0.42; smat.backFaceCulling = false;
  shrub.material = smat;
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
  instances(rock, rk, rkc); // الصخور ما ترمي ظل: آلاف النسخ تثقل خريطة الظل، وظلها صغير من ارتفاع الكاميرا
  // أعمدة كهرباء على الطريق الرئيسي
  const pole = Mesh.MergeMeshes([MeshBuilder.CreateCylinder('pl', { height: 9, diameter: 0.28, tessellation: 5 }, scene), (() => { const b = MeshBuilder.CreateBox('cb', { width: 0.14, height: 0.14, depth: 2.4 }, scene); b.position.y = 3.9; return b; })()], true)!;
  pole.material = plain('poleMat'); (pole.material as StandardMaterial).diffuseColor = new Color3(0.5, 0.42, 0.33);
  const pl: number[] = []; for (let x = -6100; x < HIGHWAY_END; x += 85) { const z = HIGHWAY_Z + 15 + Math.sin(x) * 0.8; pl.push(...Matrix.Compose(Vector3.One(), Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.sin(x * 3) * 0.04), new Vector3(x, groundH(x, z) + 4.3, z)).asArray()); }
  instances(pole, pl); caster(pole);

  // ---------- البيوت: طين وطابوق، سطح بسياج، باب وشبابيك ----------
  const hp: Mesh[] = [];
  const bx = (w: number, h: number, d: number, x: number, y: number, z: number, c: V3) => { const m = MeshBuilder.CreateBox('b', { width: w, height: h, depth: d }, scene); m.position.set(x, y, z); hp.push(paint(m, c)); };
  bx(1, 0.92, 1, 0, 0.46, 0, [1, 1, 1]);
  for (const [w, d, x, z] of [[1, 0.06, 0, 0.47], [1, 0.06, 0, -0.47], [0.06, 1, 0.47, 0], [0.06, 1, -0.47, 0]]) bx(w, 0.1, d, x, 0.97, z, [0.93, 0.93, 0.93]);
  bx(0.13, 0.5, 0.02, 0.12, 0.25, 0.505, [0.3, 0.2, 0.12]); bx(0.11, 0.2, 0.02, -0.24, 0.55, 0.505, [0.1, 0.09, 0.08]); bx(0.02, 0.2, 0.12, 0.505, 0.55, 0.15, [0.1, 0.09, 0.08]);
  bx(0.02, 0.2, 0.12, -0.505, 0.55, -0.2, [0.1, 0.09, 0.08]); bx(0.11, 0.2, 0.02, 0.2, 0.55, -0.505, [0.1, 0.09, 0.08]);
  const bld = Mesh.MergeMeshes(hp, true, true)!; bld.name = 'bld'; bld.receiveShadows = true;
  const wm = new CustomMaterial('bldMat', scene); wm.specularColor = new Color3(0.03, 0.03, 0.03); wm.maxSimultaneousLights = 2 + NL;
  wm.AddUniform('wallT', 'sampler2D', tex('road')); wm.AddUniform('macT', 'sampler2D', tex('macro'));
  wm.Fragment_Custom_Diffuse(`
    vec3 wp=vPositionW; float top=step(.6,abs(vNormalW.y));
    vec2 wu=mix(vec2(wp.x+wp.z,wp.y)/5.,wp.xz/5.,top);
    vec3 wt=texture2D(wallT,wu).rgb; wt=(.5+1.5*dot(wt,vec3(.33)))*vec3(1.04,.95,.8);
    float st=dot(texture2D(macT,vec2(wp.x+wp.z,wp.y*3.)/40.).rgb,vec3(.333));
    baseColor.rgb*=wt*(.8+.36*st)*mix(1.,.88,top);
  `);
  bld.material = wm;
  const bldInfo: Bld[] = [], mats: number[] = [], cols: number[] = [];
  const palette: V3[] = [[0.95, 0.88, 0.74], [0.86, 0.78, 0.64], [1, 0.97, 0.9], [0.8, 0.72, 0.6], [0.9, 0.8, 0.66]];
  const wallM: number[] = [];
  const addHouse = (x: number, z: number, rot: number, big = 1) => {
    if (bldInfo.some(b => Math.hypot(b.x - x, b.z - z) < 21) || roadDist(x, z) < 9 || wadiDist(x, z) < 22 || !clear(x, z, 26)) return false;
    const b: Bld = { x, z, y: Math.min(groundH(x - 5, z), groundH(x + 5, z), groundH(x, z - 5), groundH(x, z + 5)), w: (8 + r() * 7) * big, d: (7 + r() * 6) * big, h: 3.4 + r() * 1.3 + (r() < 0.22 ? 3 : 0), rot, dmg: false };
    bldInfo.push(b); mats.push(...bldMatrix(b, b.h).asArray()); const c = palette[(r() * palette.length) | 0], k = 0.88 + r() * 0.14; cols.push(c[0] * k, c[1] * k, c[2] * k, 1);
    if (r() < 0.6) { const cw = b.w + 9 + r() * 6, cd = b.d + 9 + r() * 7, ox = (r() - 0.5) * 5, oz = (r() - 0.5) * 5, cs = Math.cos(rot), sn = Math.sin(rot);
      for (const [lx, lz, lw, ld] of [[0, cd / 2, cw, 0.45], [-cw / 2, 0, 0.45, cd], [cw / 2, 0, 0.45, cd], [cw * 0.28, -cd / 2, cw * 0.44, 0.45]]) { const px = x + (lx + ox) * cs + (lz + oz) * sn, pz = z - (lx + ox) * sn + (lz + oz) * cs;
        wallM.push(...Matrix.Compose(new Vector3(lw, 2.1, ld), Quaternion.RotationAxis(Vector3.Up(), rot), new Vector3(px, groundH(px, pz) + 0.75, pz)).asArray()); } }
    return true;
  };
  const village = (cx: number, cz: number, n: number, rad: number, axis0: number) => { for (let i = 0, k = 0; i < 900 && k < n; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * rad; if (addHouse(cx + Math.cos(a) * d, cz + Math.sin(a) * d, axis0 + (r() < 0.5 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.25)) k++; } };
  village(G[0] - 30, G[2], HQ ? 46 : 34, 200, 0.25);                 // قرية الوادي
  village(-3080, 420, 9, 95, 0.6); village(1330, 640, 11, 110, -0.3); village(-640, -1560, 8, 90, 0.1); village(riverX(1900) - 260, 1900, 7, 80, 0.4);   // قرى صغيرة
  const bldMat = new Float32Array(mats), bldCol = new Float32Array(cols);
  bld.thinInstanceSetBuffer('matrix', bldMat, 16, false); bld.thinInstanceRegisterAttribute('color', 4); bld.thinInstanceSetBuffer('color', bldCol, 4, false); bld.isPickable = false; bld.alwaysSelectAsActiveMesh = true; caster(bld);
  const wall = MeshBuilder.CreateBox('wall', { size: 1 }, scene); paint(wall, [0.9, 0.84, 0.72]); wall.material = wm; wall.receiveShadows = true; instances(wall, wallM); caster(wall);

  // ---------- المواقع (تتضرر بالقصف) ----------
  const siteProps: SiteProp[] = [];
  const prop = (sid: string, mk: () => Mesh, x: number, z: number, color: V3, rot = 0) => {
    const s = site(sid), px = s.p[0] + x, pz = s.p[2] + z, node = new TransformNode('pn', scene); node.position.set(px, groundH(px, pz) - 0.2, pz); node.rotation.y = rot;
    const mesh = mk(), mat = new StandardMaterial('pm' + siteProps.length, scene); mat.diffuseColor = new Color3(...color); mat.specularColor = new Color3(0.06, 0.06, 0.06); mat.maxSimultaneousLights = 2 + NL;
    mesh.material = mat; mesh.parent = node; mesh.isPickable = false; mesh.receiveShadows = true; caster(mesh);
    if (mesh.name === 'dome') mat.emissiveColor = mat.diffuseColor.scale(0.32);
    siteProps.push({ site: sid, mesh, mat, hit: false });
  };
  const box = (w: number, h: number, d: number) => () => { const b = MeshBuilder.CreateBox('p', { width: w, height: h, depth: d }, scene); b.position.y = h / 2; return b; };
  const cyl = (dia: number, h: number, top = dia) => () => { const c = MeshBuilder.CreateCylinder('p', { diameterBottom: dia, diameterTop: top, height: h, tessellation: 20 }, scene); c.position.y = h / 2; return c; };
  const hangar = (w: number, len: number) => () => { const c = MeshBuilder.CreateCylinder('hg', { diameter: w, height: len, tessellation: 18, arc: 0.5, sideOrientation: Mesh.DOUBLESIDE }, scene); c.rotation.z = Math.PI / 2; c.rotation.y = Math.PI / 2; return c; };
  // جامع القرية
  prop('green', box(22, 7, 16), 20, 10, [0.9, 0.86, 0.76], 0.25);
  prop('green', () => {
    // قبة: نص كرة فوق طبل، بدون سحق (السحق كان يقلب الإضاءة وتصير القبة سودا)
    const drum = MeshBuilder.CreateCylinder('dome', { height: 1.3, diameter: 8.6, tessellation: 16 }, scene); drum.position.y = 7.65;
    const cap = MeshBuilder.CreateSphere('cap', { diameter: 8.2, segments: 14 }, scene); cap.position.y = 8.15;
    const fin = MeshBuilder.CreateCylinder('fin', { height: 1.6, diameterTop: 0, diameterBottom: 0.36, tessellation: 6 }, scene); fin.position.y = 12.15;
    for (const part of [drum, cap, fin]) part.bakeCurrentTransformIntoVertices();
    const m = Mesh.MergeMeshes([drum, cap, fin], true, true)!; m.name = 'dome'; return m;
  }, 20, 10, [0.7, 0.74, 0.68]);
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
  return { bld, bldMat, bldCol, bldInfo, siteProps };
}
