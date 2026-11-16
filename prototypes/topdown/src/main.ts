// «الحرب من فوق» v2 (WM9، I-063، D-032): عملية كاملة من sim2.ts، رسم PixiJS بتوهج، خريطة مرسومة بثيمين، حجم وحدات ١/٢/٣،
// مخرج بأولويات (يسرّع الهدوء ويبطّئ الإطلاق والإصابة)، و«لقطة قريبة» للإطلاق (صورة داخل صورة بمنظور مايل) بنفس المحاكاة.
import { Application, Assets, Container, Graphics, Sprite, Text, Texture, Rectangle, TilingSprite, type TextStyleOptions } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import MAP from './mapdata.json';
import BASE from '../textures/basemap.json';
import OMAN from '../../oblique/sprites/manifest.json';
import { World, SITES, RUNWAY, OMID_RW, type V3, type Msl } from './sim2';
import { MSL, AIR, GROUND } from './catalog';

const $ = (id: string) => document.getElementById(id)!;
const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const R = (a: number, b: number) => a + Math.random() * (b - a);
const hyp = Math.hypot;
const qs = new URLSearchParams(location.search), AUTO = qs.has('auto'), LITE = qs.has('lite');
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } } };
let THEME: 'light' | 'dark' = (store.get('td_theme') as any) || 'dark', SIZE = +(store.get('td_size') || 1), PIPON = store.get('td_pip') !== '0';
const SIZES = [1, 1.5, 2.2];
let SW = innerWidth, SH = innerHeight;
const EL = 50 * Math.PI / 180, SE = Math.sin(EL), CE = Math.cos(EL);

const app = new Application();
await app.init({ resizeTo: window, background: '#0d1218', antialias: !LITE, resolution: LITE ? 1 : Math.min(2, devicePixelRatio), autoDensity: true, preference: 'webgl' });
$('stage').appendChild(app.canvas);
const trackG = new Graphics();
const mapL = new Container(), vecC = new Container(), vec = new Graphics(), wreckL = new Container(), smokeL = new Container(), trailsG = new Graphics(), unitL = new Container(), fxL = new Container(), flagL = new Container(), labL = new Container(), pipL = new Container();
vecC.addChild(vec); app.stage.addChild(mapL, vecC, trackG, wreckL, trailsG, smokeL, unitL, fxL, flagL, labL, pipL);
const bloom = new AdvancedBloomFilter({ threshold: .35, bloomScale: 1.3, brightness: 1.1, blur: 8, quality: 5 }); if (!LITE) fxL.filters = [bloom];

// ===== الأصول =====
const G = (o: Record<string, string>, n: string) => Object.entries(o).find(([k]) => k.endsWith('/' + n))![1];
const SPRU = import.meta.glob('../sprites/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const MAPU = import.meta.glob('../textures/map_*_[01].webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const FXU = import.meta.glob('../../theater/textures/{fx_cloud,fx_explo1}.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const OBU = import.meta.glob('../../oblique/sprites/{s400,zolf,patriot,f16}.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const SHU = import.meta.glob('../sprites/*_sheet.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const SHEET: Record<string, Texture[]> = {};
// محور البرج بالصورة (نسبة) — من tools/bl_sheet.py
const PIV: Record<string, { u: number; v: number }> = { abrams: { u: .4722, v: .4985 }, t72: { u: .4033, v: .5005 } };
const T: Record<string, Texture> = {}, MAPT: Record<string, Texture> = {}, OB: Record<string, Texture[]> = {};
let CELLS: Texture[] = [], EXF: Texture[] = [], glowT: Texture, FLAG: Texture[] = [], grainT: Texture;
async function loadAll(prog: (s: string) => void) {
  for (const n of ['f16', 'su25', 'f14', 's400', 'zolf', 'patriot', 'abrams', 't72', 'bmp', 'grad', 'truck', 'abrams_t', 't72_t']) { T[n] = await Assets.load(G(SPRU, `${n}.png`)); prog('المجسمات'); }
  // كل طيارة 54 صورة من Blender: 18 ميلان × 3 أنف
  for (const n of ['f16', 'su25', 'f14']) { const t: Texture = await Assets.load(G(SHU, `${n}_sheet.webp`)); SHEET[n] = Array.from({ length: 54 }, (_, i) => new Texture({ source: t.source, frame: new Rectangle((i % 8) * 256, Math.floor(i / 8) * 256, 256, 256) })); prog('وضعيات الطيارات'); }
  for (const th of ['light', 'dark']) for (const l of [0, 1]) { MAPT[`${th}${l}`] = await Assets.load(G(MAPU, `map_${th}_${l}.webp`)); prog('الخريطة'); }
  for (const n of ['s400', 'zolf', 'patriot', 'f16']) { const t: Texture = await Assets.load(G(OBU, `${n}.webp`)); OB[n] = Array.from({ length: 16 }, (_, i) => new Texture({ source: t.source, frame: new Rectangle((i % 4) * 256, Math.floor(i / 4) * 256, 256, 256) })); prog('اللقطة القريبة'); }
  const cloud: Texture = await Assets.load(G(FXU, 'fx_cloud.webp')), explo: Texture = await Assets.load(G(FXU, 'fx_explo1.webp'));
  CELLS = Array.from({ length: 64 }, (_, i) => new Texture({ source: cloud.source, frame: new Rectangle((i % 8) * 128, Math.floor(i / 8) * 128, 128, 128) }));
  EXF = Array.from({ length: 25 }, (_, i) => new Texture({ source: explo.source, frame: new Rectangle((i % 5) * 200, Math.floor(i / 5) * 200, 200, 200) }));
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!, g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,245,1)'); g.addColorStop(.15, 'rgba(255,230,170,.95)'); g.addColorStop(.4, 'rgba(255,150,60,.35)'); g.addColorStop(1, 'rgba(255,110,30,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); glowT = Texture.from(c);
  FLAG = [0, 1].map(side => { const f = document.createElement('canvas'); f.width = 36; f.height = 24; const y = f.getContext('2d')!; (side ? ['#239f40', '#ffffff', '#da0000'] : ['#ce1126', '#ffffff', '#111111']).forEach((col, i) => { y.fillStyle = col; y.fillRect(0, i * 8, 36, 8); }); if (!side) { y.fillStyle = '#007a3d'; y.fillRect(10, 10, 16, 4); } else { y.fillStyle = '#da0000'; y.beginPath(); y.arc(18, 12, 3, 0, 7); y.fill(); } y.strokeStyle = 'rgba(0,0,0,.7)'; y.lineWidth = 2; y.strokeRect(1, 1, 34, 22); return Texture.from(f); });
  const gr = document.createElement('canvas'); gr.width = gr.height = 256; const z = gr.getContext('2d')!; for (let i = 0; i < 9000; i++) { const v = Math.random() < .5 ? 0 : 255; z.fillStyle = `rgba(${v},${v},${v},${Math.random() * .07})`; z.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); } grainT = Texture.from(gr);
}

// ===== الكاميرا والخريطة =====
const cam = { x: 0, y: 0, w: 60000 }; let k = 1;
const sx = (x: number) => (x - cam.x) * k + SW / 2, sy = (y: number) => -(y - cam.y) * k + SH / 2;
const Uof = () => Math.max(1, 30 / (15 * k)) * SIZES[SIZE];
const DARK = () => THEME === 'dark';
let mapSpr: Sprite | null = null, grain: TilingSprite | null = null, vecK = 0, vecTheme = '';
const b = BASE.b as number[];
function updateMap() {
  const t = MAPT[`${THEME}${cam.w > 70000 ? 0 : 1}`];
  if (!mapSpr) { mapSpr = new Sprite(t); mapL.addChild(mapSpr); grain = new TilingSprite({ texture: grainT, width: SW, height: SH }); mapL.addChild(grain); }
  if (mapSpr.texture !== t) mapSpr.texture = t;
  mapSpr.position.set(sx(b[0]), sy(b[1])); mapSpr.width = (b[2] - b[0]) * k; mapSpr.height = (b[1] - b[3]) * k;
  grain!.width = SW; grain!.height = SH; grain!.alpha = cam.w < 50000 ? (DARK() ? .5 : .8) * clamp((50000 - cam.w) / 30000, 0, 1) : 0; grain!.tilePosition.set(-cam.x * k % 256, cam.y * k % 256);
  vecC.position.set(SW / 2 - cam.x * k, SH / 2 + cam.y * k); vecC.scale.set(k, -k);
  if (!vecK || k / vecK > 1.3 || vecK / k > 1.3 || vecTheme !== THEME) { vecK = k; vecTheme = THEME; buildVec(); }
}
function buildVec() {
  vec.clear(); const px = 1 / vecK, D = DARK();
  const line = (p: number[], w: number, color: number, alpha: number) => { vec.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) vec.lineTo(p[i], p[i + 1]); vec.stroke({ width: w * px, color, alpha, cap: 'round', join: 'round' }); };
  for (const r of (MAP as any).roads) line(r.p, Math.max(1, 1.2 + 60 * vecK), D ? 0x6e7681 : 0x8a7a63, .72);
  for (const r of (MAP as any).rivers) { line(r.p, Math.max(2, 2.4 + 140 * vecK), D ? 0x0b2c45 : 0xe9f2f6, .9); line(r.p, Math.max(1.2, 1.5 + 110 * vecK), D ? 0x3aa6e0 : 0x4f8fbf, 1); }
  for (const l of (MAP as any).borders) { line(l, 5, D ? 0x9fd6ff : 0xffffff, .3); line(l, 1.6, D ? 0xe8edf2 : 0x3b3530, .85); }
  for (const [p, hd] of [[SITES.base, RUNWAY], [SITES.omid, OMID_RW]] as [{ x: number; y: number }, number][]) {
    const L = 3200, W2 = Math.max(45, 6 * px), ux = Math.cos(hd), uy = Math.sin(hd), T2 = (a: number, b2: number) => ({ x: p.x + ux * a - uy * b2, y: p.y + uy * a + ux * b2 });
    const rect = (a0: number, a1: number, b0: number, b1: number, col: number, al = 1) => { const q = [T2(a0, b0), T2(a1, b0), T2(a1, b1), T2(a0, b1)]; vec.poly(q.flatMap(v2 => [v2.x, v2.y])).fill({ color: col, alpha: al }); };
    const pav = D ? 0x353c45 : 0x6a665e; rect(-L / 2, L / 2, -W2 / 2, W2 / 2, D ? 0x2a3038 : 0x55524c);
    vec.moveTo(T2(-L * .45, 0).x, T2(-L * .45, 0).y).lineTo(T2(L * .45, 0).x, T2(L * .45, 0).y).stroke({ width: px, color: 0xffffff, alpha: .7 });
    if (vecK > .02) { rect(-L * .45, L * .45, 168, 192, pav); for (const a of [-L * .4, -L * .1, L * .2, L * .42]) rect(a - 12, a + 12, 22, 180, pav); rect(-450, 250, 240, 560, pav, .9); for (let i = 0; i < 8; i++) { const a = -1200 + i * 110; rect(a - 22, a + 22, 650, 700, D ? 0x4a525c : 0x8a8478); rect(a - 6, a + 6, 590, 650, pav); } }
  }
  vec.circle(SITES.s400.x, SITES.s400.y, 120000).stroke({ width: 1.5 * px, color: 0xff7a5c, alpha: .4 }); vec.circle(SITES.pat.x, SITES.pat.y, 40000).stroke({ width: 1.5 * px, color: 0x8fd0ff, alpha: .4 });
  // سهم الهجوم من شلامجة لخرمشهر
  const s = SITES.stage, o = SITES.objective, a = Math.atan2(o.y - s.y, o.x - s.x), L2 = hyp(o.x - s.x, o.y - s.y), w = Math.max(250, 8 * px);
  vec.moveTo(s.x, s.y).lineTo(o.x - Math.cos(a) * w * 2, o.y - Math.sin(a) * w * 2).stroke({ width: w, color: 0xd2ab33, alpha: .35, cap: 'round' });
  vec.poly([o.x, o.y, o.x - Math.cos(a - .5) * w * 3, o.y - Math.sin(a - .5) * w * 3, o.x - Math.cos(a + .5) * w * 3, o.y - Math.sin(a + .5) * w * 3]).fill({ color: 0xd2ab33, alpha: .45 }); void L2;
}
const txt = (size: number, bold = true): TextStyleOptions => ({ fontFamily: 'IBM Plex Sans Arabic, Tahoma, sans-serif', fontSize: size, fontWeight: bold ? '600' : '400', fill: DARK() ? '#e9eef3' : '#2b2620', stroke: { color: DARK() ? '#0b0f14' : '#f7f1e2', width: 4 } });
let cityT: { t: Text; dot: Graphics; p: { x: number; y: number }; big: boolean }[] = [], siteT: { t: Text; p: { x: number; y: number } }[] = [], labTheme = '', scaleG = new Graphics(), scaleT: Text;
function buildLabels() {
  labL.removeChildren(); cityT = []; siteT = []; labTheme = THEME;
  for (const c of (MAP as any).cities) { const big = c.pop > 400000, t = new Text({ text: c.n, style: txt(big ? 14 : 11.5) }); t.anchor.set(.5, 1); const dot = new Graphics(); dot.circle(0, 0, big ? 4 : 3).fill({ color: DARK() ? 0xffd27a : 0x3b342c }).stroke({ width: 1.5, color: DARK() ? 0x0b0f14 : 0xf7f1e2 }); labL.addChild(dot, t); cityT.push({ t, dot, p: { x: c.p[0], y: c.p[1] }, big }); }
  for (const [n, p] of [['قاعدة البصرة', SITES.base], ['S-400', SITES.s400], ['باتريوت', SITES.pat], ['ذو الفقار', SITES.zolf], ['أميدية', SITES.omid], ['شلامجة', SITES.stage], ['خرمشهر ← الهدف', SITES.objective], ['خط دفاعهم', SITES.defense]] as [string, { x: number; y: number }][]) { const t = new Text({ text: n, style: txt(11, false) }); t.anchor.set(.5, 0); labL.addChild(t); siteT.push({ t, p }); }
  scaleG = new Graphics(); scaleT = new Text({ text: '', style: txt(12) }); scaleT.anchor.set(0, .5); labL.addChild(scaleG, scaleT);
}
function updateLabels() {
  if (labTheme !== THEME) buildLabels();
  for (const c of cityT) { const vis = (c.big || (cam.w < 120000 && cam.w > 4000)) && cam.w > 2500; c.t.visible = c.dot.visible = vis; c.t.position.set(sx(c.p.x), sy(c.p.y) - 6); c.dot.position.set(sx(c.p.x), sy(c.p.y)); }
  for (const s of siteT) { s.t.visible = cam.w > 8000 && cam.w < 260000; s.t.position.set(sx(s.p.x), sy(s.p.y) + 18); }
  const m = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].reduce((a, v) => v * k < SW * .28 ? v : a, 50);
  scaleG.clear().moveTo(14, SH - 112).lineTo(14 + m * k, SH - 112).stroke({ width: 3, color: DARK() ? 0xffffff : 0x222222 }); scaleT.text = m >= 1000 ? `${m / 1000} كم` : `${m} م`; scaleT.position.set(20 + m * k, SH - 112);
}

// ===== الوحدات =====
const LEN: Record<string, number> = { f16: 15.1, su25: 15.5, f14: 19.1, s400: 13.5, zolf: 13.2, patriot: 10.4, abrams: 9.8, t72: 9.5, bmp: 6.7, grad: 7.4, truck: 5.3 };
interface USpr { s: Sprite; sh: Sprite; f: Sprite; t?: Sprite; seen: number }
const uMap = new Map<string, USpr>(); let frameNo = 0;
interface UOpt { bank?: number; alpha?: number; dead?: boolean; tint?: number; ground?: boolean; tex?: Texture; zs?: number; tur?: { n: string; a: number; recoil: number; toss?: { dx: number; dy: number; r: number } } }
function drawUnit(key: string, n: string, side: 0 | 1, p: V3, hd: number, o: UOpt = {}) {
  const tex = o.tex ?? T[n];
  let u = uMap.get(key); if (!u) { const sh = new Sprite(tex); sh.anchor.set(.5); sh.tint = 0; sh.alpha = .25; const s2 = new Sprite(tex); s2.anchor.set(.5); const f = new Sprite(FLAG[side]); f.anchor.set(.5); (o.ground ? wreckL : unitL).addChild(sh, s2); flagL.addChild(f); u = { s: s2, sh, f, seen: 0 }; uMap.set(key, u); }
  if (u.s.texture !== tex) { u.s.texture = tex; u.sh.texture = tex; }
  u.seen = frameNo; const U = Uof(), sc = LEN[n] * 1.18 * k * U / tex.width * (o.zs ?? 1), x = sx(p.x), y = sy(p.y);
  if (x < -200 || x > SW + 200 || y < -200 || y > SH + 200) { u.s.visible = u.sh.visible = u.f.visible = false; if (u.t) u.t.visible = false; return; }
  u.s.visible = true; u.s.position.set(x, y); u.s.rotation = -hd; u.s.scale.set(sc, sc * (o.tex ? 1 : 1 - Math.min(.3, Math.abs(o.bank ?? 0) * .25))); u.s.alpha = o.alpha ?? 1; u.s.tint = o.dead ? 0x3a3530 : o.tint ?? 0xffffff;
  const off = Math.min(60, p.z * k * .35 + (p.z > 5 ? 6 : 0)); u.sh.visible = p.z > 5; u.sh.position.set(x + off, y + off * .6); u.sh.rotation = -hd; u.sh.scale.set(sc * .95);
  // البرج: يلف حول محوره فوق الجسم، وبعد الرمي يرتد لورا شوي
  if (o.tur) { const tt = T[o.tur.n], pv = PIV[n]; if (!u.t) { u.t = new Sprite(tt); u.t.anchor.set(pv.u, pv.v); u.s.parent!.addChildAt(u.t, u.s.parent!.getChildIndex(u.s) + 1); }
    const W0 = tt.width * sc, ox = (pv.u - .5) * W0, oy = (pv.v - .5) * W0, r = -hd, ta = -o.tur.a, rc = o.tur.recoil * .7 * k * U;
    let tx = x + ox * Math.cos(r) - oy * Math.sin(r) - Math.cos(ta) * rc, ty = y + ox * Math.sin(r) + oy * Math.cos(r) - Math.sin(ta) * rc, trot = ta;
    if (o.tur.toss) { tx += o.tur.toss.dx * k * U; ty -= o.tur.toss.dy * k * U; trot += o.tur.toss.r; }
    u.t.visible = true; u.t.position.set(tx, ty); u.t.rotation = trot; u.t.scale.set(sc); u.t.tint = u.s.tint; }
  u.f.visible = !o.dead && sc * tex.width > 6; const fs = clamp(sc * tex.width / 120, .38, .7); u.f.scale.set(fs); u.f.position.set(x + LEN[n] * .5 * k * U + 8, y - LEN[n] * .45 * k * U - 6);
}
function sweepUnits() { for (const [, u] of uMap) if (u.seen !== frameNo) { u.s.visible = u.sh.visible = u.f.visible = false; if (u.t) u.t.visible = false; } }
// إطار الطيارة: الميلان (الجناح اليمين نازل = لفة يمين) × الأنف
const jetFrame = (bank: number, gam: number) => { const ri = (((Math.round((-bank * 180 / Math.PI + 180) / 20)) % 18) + 18) % 18, pi = gam < -.3 ? 0 : gam > .3 ? 2 : 1; return pi * 18 + ri; };
const lastGun = new Map<number, number>(), tossed = new Map<number, { dx: number; dy: number; r: number }>();

// ===== المؤثرات =====
interface Puff { x: number; y: number; r: number; gr: number; t: number; life: number; a: number; s: Sprite; vx: number; vy: number; minPx: number }
interface Fx { x: number; y: number; t: number; life: number; size: number; minPx: number; kind: 'glow' | 'ex' | 'ring' | 'flare' | 'fire' | 'tracer' | 'spark'; tint: number; vx: number; vy: number; s?: Sprite; g?: Graphics; x2?: number; y2?: number }
interface Trail { pts: { x: number; y: number; t: number }[]; r0: number; gr: number; life: number; a: number; dark: boolean; live: boolean }
const WIND = { x: 3.5, y: 1.2 };
let puffs: Puff[] = [], fxs: Fx[] = [], trails: Trail[] = [], mTrail = new Map<number, Trail>(), dTrail = new Map<object, Trail>(), vTrail = new Map<number, Trail>(), tracks = new Map<number, { x: number; y: number; hd: number; t: number }[]>();
function puff(p: { x: number; y: number }, r: number, gr: number, life: number, a: number, tint: number, minPx = 4, vx = 0, vy = 0) {
  if (puffs.length > 1400) { const o = puffs.shift()!; o.s.destroy(); }
  const s = new Sprite(CELLS[Math.floor(R(0, 64))]); s.anchor.set(.5); s.tint = tint; s.rotation = R(0, 6.28); smokeL.addChild(s); puffs.push({ x: p.x, y: p.y, r, gr, t: 0, life, a, s, vx, vy, minPx });
}
function fx(kind: Fx['kind'], p: { x: number; y: number }, size: number, life: number, minPx: number, tint = 0xffffff, vx = 0, vy = 0, to?: { x: number; y: number }) {
  if (fxs.length > 600) return;
  const f: Fx = { x: p.x, y: p.y, t: 0, life, size, minPx, kind, tint, vx, vy, x2: to?.x, y2: to?.y };
  if (kind === 'ring' || kind === 'tracer' || kind === 'spark') { f.g = new Graphics(); fxL.addChild(f.g); } else { f.s = new Sprite(kind === 'ex' ? EXF[0] : glowT); f.s.anchor.set(.5); if (kind !== 'ex') { f.s.blendMode = 'add'; f.s.tint = tint; } fxL.addChild(f.s); }
  fxs.push(f);
}
const smokeCol = () => DARK() ? 0xb8c4d0 : 0xffffff;
// انفجار طبقات: ومضة بيضاء ← كرة نار ← موجة صدمة ← شظايا ← عمود دخان يبقى
function blast(p: { x: number; y: number }, r: number, ground: boolean, big = 1) {
  fx('glow', p, r * 3, .35, 40 * big); fx('glow', p, r * 7, .9, 90 * big, 0xff9a40); fx('ex', p, r * 2.2, 1.5, 34 * big); fx('ring', p, r * 5, .9, 34 * big);
  for (let i = 0; i < 6 + 6 * big; i++) { const a = R(0, 6.28), sp = R(.6, 1.6) * r * 2.5; fx('spark', p, R(.5, 1) * r, R(.5, 1.1), 0, 0xffc070, Math.cos(a) * sp, Math.sin(a) * sp); }
  for (let i = 0; i < 10 + 6 * big; i++) { const a = R(0, 6.28), d = R(.2, 1) * r; puff({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }, r * R(.4, .8), r * .05, R(14, 26), .6, ground ? 0x2a2622 : (DARK() ? 0x707a86 : 0x8a8a88), 6 * big, Math.cos(a) * r * .02, Math.sin(a) * r * .02); }
  if (ground) for (let i = 0; i < 4; i++) puff({ x: p.x + R(-r, r) * .3, y: p.y + R(-r, r) * .3 }, r * R(.5, .9), r * .08, R(40, 70), .55, 0x1e1b19, 6 * big, R(0, 1), R(0, 1));
}
let capAt = 0;
function caption(t: string) { const el = $('cap'); el.textContent = t; el.style.opacity = '1'; capAt = performance.now(); }
// ===== المخرج: لقطات بأولوية ومدة (وقت المحاكاة) =====
interface Focus { key: string; pos: () => { x: number; y: number } | null; w: () => number; ts: number; until: number; pri: number }
let focuses: Focus[] = [];
function focus(key: string, pos: Focus['pos'], w: number | (() => number), ts: number, dur: number, pri: number) { focuses = focuses.filter(f => f.key !== key); focuses.push({ key, pos, w: typeof w === 'number' ? () => w : w, ts, until: W.t + dur, pri }); }
const gf = (p: { x: number; y: number }) => ({ x: p.x, y: p.y });
const jetPos = (id: number) => () => { const j = W.jets.find(q => q.id === id); return j && j.st !== 'gone' ? gf(j.p) : null; };
function followMissile(m: Msl, pri: number) {
  const tgtOf = () => { const q = W.msls.find(x => x.id === m.id); if (!q) return null; const tj = q.tgtJet ? W.jets.find(j => j.id === q.tgtJet) : null, tm = q.tgtMsl ? W.msls.find(x => x.id === q.tgtMsl) : null; return tj ? tj.p : tm ? tm.p : q.tgtPt ?? null; };
  focus('m' + m.id, () => { const q = W.msls.find(x => x.id === m.id && x.ph !== 'dead'); if (!q) return null; const t = tgtOf(); return t ? { x: (q.p.x + t.x) / 2, y: (q.p.y + t.y) / 2 } : gf(q.p); },
    () => { const q = W.msls.find(x => x.id === m.id); const t = tgtOf(); return q && t ? clamp(hyp(q.p.x - t.x, q.p.y - t.y) * 1.5, 2500, 120000) : 8000; }, 1.5, 400, pri);
}
let PIP: { mid: number; at: V3; kind: string; t0: number; dur: number; az?: number; jet?: number } | null = null, pipBig = false;
function onEvent(e: { type: string; p: V3; id?: number; data?: any }) {
  const p = e.p, D = e.data || {};
  switch (e.type) {
    case 'takeoff': { const j = W.jets.find(q => q.id === e.id)!; if (j.slot === 0) { caption(j.side ? 'إنذار! F-14 إيرانية تقلع من أميدية للاعتراض' : j.mission === 'sead' ? 'أربع F-16 تقلع بأزواج: مهمة إخماد الدفاع الجوي' : 'أربع Su-25 تقلع: قصف دروع العدو'); focus('to' + j.id, jetPos(j.id), 4500, 2.5, 14, 3); } snd('jet_roar', p, .9, j.type === 'su25' ? .85 : 1); break; }
    case 'liftoff': for (let i = 0; i < 3; i++) puff(p, 14, 4, 6, .35, 0xd8cfbf, 3); break;
    case 'scramble': caption('رادار إيران لكط طياراتنا — F-14 تستعد'); break;
    case 'sam_alert': caption(D.type === 's400' ? 'S-400 لكط الطيارات — الأنابيب ترتفع' : 'الباتريوت جاهز'); if (D.type === 's400') focus('alert', () => gf(SITES.s400), 1600, 2, 10, 4); break;
    case 'sam_eject': { const m = W.msls.find(q => q.id === e.id); for (let i = 0; i < 10; i++) puff({ x: p.x + R(-6, 6), y: p.y + R(-6, 6) }, R(4, 8), 3, R(4, 7), .6, 0xffffff, 6); snd('eject', p, 1, .9); snd('woosh', p, .7, .7); caption('S-400: إطلاق بارد — الغاز يطرد الصاروخ لفوق ثم يشتعل');
      focus('ej' + e.id, () => gf(p), 1100, .45, 3, 7); if (m) { followMissile(m, 5); if (!PIP || W.t - PIP.t0 > 2.5) startPip(m, p, 's400'); } break; }
    case 'ignite': fx('glow', p, 40, .4, 30); for (let i = 0; i < 8; i++) puff(p, R(5, 9), 3, R(6, 10), .6, 0xffffff, 6); snd('launch', p, 1, .95); break;
    case 'sam_hot': { const m = W.msls.find(q => q.id === e.id); fx('glow', p, 50, .5, 36); for (let i = 0; i < 16; i++) { const a = D.az + Math.PI + R(-.9, .9); puff({ x: p.x + Math.cos(a) * R(3, 16), y: p.y + Math.sin(a) * R(3, 16) }, R(6, 12), 3, R(10, 18), .65, i % 3 ? 0xffffff : 0xc9b48e, 8, Math.cos(a) * R(2, 8), Math.sin(a) * R(2, 8)); }
      snd('launch', p, 1, 1); snd('rocket', p, .7, 1.1); caption('باتريوت PAC-3: إطلاق مايل على الصاروخ النازل'); focus('ph' + e.id, () => gf(p), 1100, .45, 2.6, 7); if (m) { followMissile(m, 5); if (!PIP || W.t - PIP.t0 > 2) startPip(m, p, 'patriot', D.az); } break; }
    case 'air_launch': { const m = W.msls.find(q => q.id === e.id);
      caption(D.w === 'AGM-88' ? 'F-16 أطلقت HARM على رادار S-400 — يسقط ثم يشتعل' : D.w === 'AIM-54' ? 'F-14 أطلقت فينكس بعيد المدى' : D.w === 'AIM-120' ? 'F-16 أطلقت AIM-120 على الـF-14' : 'Su-25 فوق الهدف — قنابل');
      snd(D.w === 'FAB-500' ? 'woosh' : 'rocket', p, .6, 1.2);
      if (m && D.w !== 'FAB-500') { followMissile(m, 4); const j = W.jets.filter(q => q.side === D.side && q.type === D.by).sort((a, c) => hyp(a.p.x - p.x, a.p.y - p.y) - hyp(c.p.x - p.x, c.p.y - p.y))[0]; if (!PIP || W.t - PIP.t0 > 6) startPip(m, p, 'air', undefined, j?.id); }
      else focus('bomb' + e.id, () => gf(p), 3500, .7, 6, 4); break; }
    case 'ignite_air': fx('glow', p, 30, .3, 20); snd('rocket', p, .5, 1.3); break;
    case 'evade': caption(D.split ? 'Split-S: تنقلب على ظهرها وتسحب لتحت هرباً من الصاروخ' : 'مراوغة! كسر حاد بكل الـG عمودي على الصاروخ ومشاعل'); snd('sonic', p, .5); focus('ev' + e.id, jetPos(e.id!), 3500, .7, 5, 6); break;
    case 'popup': caption('Su-25 تطلع لفوق فجأة (pop-up) قبل الهدف…'); focus('pu' + e.id, jetPos(e.id!), 3000, 1, 9, 5); break;
    case 'rollin': caption('…تقلب على جنبها وتغطس 30° على الدبابات'); focus('ri' + e.id, jetPos(e.id!), 2600, .8, 10, 6); break;
    case 'break': { const j = W.jets.find(q => q.id === e.id); if (j && j.slot === 0) { caption('كسر فوق المدرج: لفة 180° حادة ثم دورة الهبوط'); focus('br' + e.id, jetPos(e.id!), 4500, 2, 14, 2); } break; }
    case 'goaround': caption('ما اصطفّت على المدرج — ترجع تدور مرة ثانية'); break;
    case 'cm': for (let i = 0; i < 4; i++) { const s2 = i % 2 ? 1 : -1, h = D.hd; fx('flare', p, 14, 3.5, 7, 0xffffff, -Math.cos(h) * 60 + Math.sin(h) * s2 * 45, -Math.sin(h) * 60 - Math.cos(h) * s2 * 45); } break;
    case 'kill_jet': blast(p, 60, false, 1.3); snd('boom_big', p, 1, .9); caption(D.side ? 'أسقطنا F-14 للعدو!' : `خسرنا ${AIR[D.type].name} — الطيار قفز بالمظلة`); focus('kj' + e.id, () => gf(p), 5000, .6, 6, 8); break;
    case 'crash': case 'debris_land': blast(p, 40, true); fx('fire', p, 18, 40, 10); snd('boom_mid', p, .7); break;
    case 'sam_silent': caption('رادار S-400 طفّى حتى لا يضربه الـHARM'); break;
    case 'sam_resume': caption('رادار S-400 رجع يشتغل'); break;
    case 'sam_kill': blast(p, 60, true, 1.4); fx('fire', p, 30, 120, 14); snd('boom_huge', p, 1, .9); caption('HARM دمّر منصة S-400!'); focus('sk' + Math.round(W.t), () => gf(p), 2200, .6, 6, 8); break;
    case 'selfdestruct': fx('glow', p, 40, .4, 24); fx('ex', p, 30, 1, 22); if (D.miss) caption(`الصاروخ فات ${D.tgt ? AIR[D.tgt]?.name ?? '' : 'الهدف'} بـ ${Math.round(D.miss)} م — راوغت ونجت`); snd('blast', p, .6); break;
    case 'bm_erect': caption('منصة ذو الفقار ترفع الصاروخ…'); focus('er' + Math.round(W.t), () => gf(p), 1600, 1.6, 8, 5); break;
    case 'bm_launch': { const m = W.msls.find(q => q.id === e.id); fx('glow', p, 120, .9, 50); fx('ring', p, 160, 2.5, 40); for (let i = 0; i < 30; i++) { const a = R(0, 6.28), s2 = R(4, 14); puff({ x: p.x + Math.cos(a) * R(5, 25), y: p.y + Math.sin(a) * R(5, 25) }, R(10, 20), R(3, 6), R(20, 36), .7, i % 3 ? 0xc9b48e : 0xffffff, 8, Math.cos(a) * s2, Math.sin(a) * s2); }
      snd('rocket', p, 1, .6); snd('boom_far', p, .9, .7); caption('ذو الفقار انطلق على قاعدة البصرة!'); focus('bl' + e.id, () => gf(p), 1800, .5, 4, 7);
      if (m) { focus('bm' + m.id, () => { const q = W.msls.find(x => x.id === m.id && x.ph !== 'dead'); return q ? { x: (q.p.x + q.tgtPt!.x) / 2, y: (q.p.y + q.tgtPt!.y) / 2 } : null; }, 200000, 10, 400, 3); startPip(m, p, 'zolf'); } break; }
    case 'incoming': snd('incoming', p, 1.2); snd('whiz', p, .8, .8); caption('صفير! الباليستي نازل على القاعدة'); break;
    case 'kill_bm': blast(p, 220, false, 1.5); fx('glow', p, 1500, 1.2, 150); snd('boom_huge', p, 1, .9); caption(`اعتراض! ضربة مباشرة على ارتفاع ${(p.z / 1000).toFixed(1)} كم`); focus('kb' + e.id, () => gf(p), 9000, .6, 6, 8); break;
    case 'bm_impact': blast(p, 180, true, 2); fx('fire', p, 60, 200, 20); fx('fire', { x: p.x + 60, y: p.y - 40 }, 40, 160, 14); snd('boom_huge', p, 1, .8); caption('الباليستي الثاني نزل على قاعدة البصرة — حريق'); focus('bi' + e.id, () => gf(p), 3500, .5, 7, 8); break;
    case 'advance': caption('الهجوم البري بدأ: دبابات أبرامز وعربات BMP تعبر الحدود'); focus('adv', () => gf(SITES.stage), 9000, 3, 12, 3); break;
    case 'gun': { const g = W.gnd.find(q => q.id === e.id); if (!g) break; lastGun.set(g.id, W.t); const h = D.hd, mz = { x: p.x + Math.cos(h) * 8, y: p.y + Math.sin(h) * 8 }; fx('glow', mz, 14, .18, 12); puff(mz, 6, 3, 4, .4, 0xc9b48e, 4); const m = W.msls.filter(q => q.from === g.type && q.ph !== 'dead').pop(); if (m?.tgtPt) fx('tracer', mz, 0, Math.max(.4, hyp(m.tgtPt.x - p.x, m.tgtPt.y - p.y) / 1650), 0, 0xffd28a, 0, 0, m.tgtPt); snd('tank', p, .5); break; }
    case 'salvo': caption(D.side ? 'راجمات العدو تضرب' : 'راجماتنا تمهّد على خط الدفاع'); snd('rocket', p, .7, 1.3); break;
    case 'rocket': fx('glow', p, 12, .15, 10); puff(p, 8, 3, 8, .4, 0xc9b48e, 4); break;
    case 'blast': { const r = D.r ?? 10; if (D.kind === 'shell') { fx('glow', p, r * 2, .2, 10); for (let i = 0; i < 3; i++) puff(p, r, 2, 5, .5, 0xa8957a, 4); }
      else if (D.kind === 'rocket') { fx('glow', p, 40, .25, 14); fx('spark', p, 20, .5, 0, 0xffc070, R(-40, 40), R(-40, 40)); for (let i = 0; i < 4; i++) puff(p, 16, 3, 8, .5, 0x3a332c, 5); if (Math.random() < .3) snd('boom_mid', p, .4); }
      else blast(p, r, true, D.kind === 'bomb' ? 1.1 : .8); if (D.kind === 'bomb') snd('boom_bomb', p, .9); break; }
    case 'kill_gnd': if (D.type === 't72') { const a = R(0, 6.28), d = R(6, 14); tossed.set(e.id!, { dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: R(-2, 2) }); } blast(p, 18, true, .8); fx('fire', p, 14, 90, 8); snd('boom_mid', p, .8); if (D.side === 0) caption(`خسرنا ${GROUND[D.type].name}`); break;
    case 'reinforce': caption(`تعزيزات: ${D.n} دبابات جديدة ورتل إمداد بالطريق`); focus('rf' + Math.round(W.t), () => gf(p), 6000, 4, 10, 4); break;
    case 'landed': { const j = W.jets.find(q => q.id === e.id); if (j && j.side === 0) caption(`${AIR[j.type].name} رجعت وهبطت بالقاعدة`); break; }
    case 'objective': caption('قواتنا وصلت خرمشهر — الهدف تحقق'); focus('obj', () => gf(SITES.objective), 9000, 2, 20, 9); break;
  }
}
const isBurning = (m: Msl) => { const M = MSL[m.type]; return m.type === 'Zolfaghar' ? m.t < 26 : m.type === '122mm' ? m.t < 2 : m.ph === 'boost' && M.burn > 0; };
// خطوة مؤثرات لكل خطوة محاكاة (نقاط الذيول فقط — خفيفة)
function fxStep(dt: number) {
  for (const m of W.msls) {
    let tr = mTrail.get(m.id);
    if (isBurning(m) && m.ph !== 'dead') { if (!tr) { tr = m.type === 'Zolfaghar' ? { pts: [], r0: 4, gr: 6, life: 70, a: .85, dark: false, live: true } : m.type === '122mm' ? { pts: [], r0: .8, gr: 1.6, life: 12, a: .5, dark: false, live: true } : { pts: [], r0: 1.4, gr: 3, life: 40, a: .8, dark: false, live: true }; mTrail.set(m.id, tr); trails.push(tr); }
      const l = tr.pts[tr.pts.length - 1], sp = hyp(m.vel.x, m.vel.y); if (!l || hyp(m.p.x - l.x, m.p.y - l.y) > Math.max(6, sp * .04)) tr.pts.push({ x: m.p.x, y: m.p.y, t: W.t }); }
    else if (tr && tr.live) { tr.pts.push({ x: m.p.x, y: m.p.y, t: W.t }); tr.live = false; }
  }
  for (const d of W.debris) { let tr = dTrail.get(d); if (!d.burn) { if (tr) tr.live = false; continue; } if (!tr) { tr = { pts: [], r0: 2, gr: 4, life: 30, a: .65, dark: true, live: true }; dTrail.set(d, tr); trails.push(tr); } const l = tr.pts[tr.pts.length - 1]; if (!l || hyp(d.p.x - l.x, d.p.y - l.y) > 20) tr.pts.push({ x: d.p.x, y: d.p.y, t: W.t }); }
  for (const j of W.jets) if (j.st === 'hit' && Math.random() < dt * 20) puff(j.p, R(6, 12), R(3, 6), R(14, 22), .7, 0x2b2724, 4);
  // بخار أطراف الأجنحة بالـG العالي، وخيط تكثيف (contrail) فوق 8.5 كم
  for (const j of W.jets) { const fly = W.alive(j), L2 = LEN[AIR[j.type].sprite], span = L2 * .34 * Math.abs(Math.cos(j.bank)), nx = -Math.sin(j.hd), ny = Math.cos(j.hd);
    for (const sd of [-1, 1]) { const key = j.id * 10 + (sd + 1), on = fly && j.n > 4.2; let tr = vTrail.get(key);
      if (on) { if (!tr) { tr = { pts: [], r0: .5, gr: .9, life: 2.2, a: .55, dark: false, live: true }; vTrail.set(key, tr); trails.push(tr); } const q = { x: j.p.x + nx * span * sd, y: j.p.y + ny * span * sd }, l = tr.pts[tr.pts.length - 1]; if (!l || hyp(q.x - l.x, q.y - l.y) > 8) tr.pts.push({ ...q, t: W.t }); }
      else if (tr) { tr.live = false; vTrail.delete(key); } }
    const key = j.id * 10 + 5, on = fly && j.p.z > 8500; let tr = vTrail.get(key);
    if (on) { if (!tr) { tr = { pts: [], r0: 1.5, gr: 2.5, life: 50, a: .5, dark: false, live: true }; vTrail.set(key, tr); trails.push(tr); } const l = tr.pts[tr.pts.length - 1]; if (!l || hyp(j.p.x - l.x, j.p.y - l.y) > 30) tr.pts.push({ x: j.p.x - Math.cos(j.hd) * L2 * 2, y: j.p.y - Math.sin(j.hd) * L2 * 2, t: W.t }); }
    else if (tr) { tr.live = false; vTrail.delete(key); } }
  // الدبابات: غبار ورا الجنزير، وآثار جنزير تبقى بالأرض
  for (const g of W.gnd) { if (g.st === 'dead' || g.st === 'gone' || Math.abs(g.spd) < 1.5) continue; const L2 = LEN[GROUND[g.type].sprite] * .5, dir = Math.sign(g.spd);
    if (Math.random() < dt * Math.abs(g.spd) * .35) puff({ x: g.p.x - Math.cos(g.hd) * L2 * dir + R(-2, 2), y: g.p.y - Math.sin(g.hd) * L2 * dir + R(-2, 2) }, R(2.5, 4), R(1.2, 2.2), R(5, 9), .35, DARK() ? 0x8a7c66 : 0xd8c8a4, 3, R(-1, 1), R(-1, 1));
    if (g.type === 'truck') continue; let tk = tracks.get(g.id); if (!tk) { tk = []; tracks.set(g.id, tk); } const l = tk[tk.length - 1]; if (!l || hyp(g.p.x - l.x, g.p.y - l.y) > 7) { tk.push({ x: g.p.x, y: g.p.y, hd: g.hd, t: W.t }); if (tk.length > 500) tk.shift(); } }
  for (const f of fxs) if (f.kind === 'flare') { let tr = dTrail.get(f); if (!tr) { tr = { pts: [], r0: .8, gr: 1.8, life: 10, a: .6, dark: false, live: true }; dTrail.set(f, tr); trails.push(tr); } const l = tr.pts[tr.pts.length - 1]; if (!l || hyp(f.x - l.x, f.y - l.y) > 6) tr.pts.push({ x: f.x, y: f.y, t: W.t }); if (f.t > f.life - .1) tr.live = false; }
}
// تعمير المؤثرات مرة بالإطار (بقطع ≤ ربع ثانية) — حتى السرعات العالية ما تثقل
function fxAge(simDt: number) {
  let left = simDt; while (left > 1e-6) { const dt = Math.min(.25, left); left -= dt;
    for (const p of puffs) { p.t += dt; p.x += (WIND.x + p.vx) * dt; p.y += (WIND.y + p.vy) * dt; p.vx *= 1 - Math.min(1, dt * .6); p.vy *= 1 - Math.min(1, dt * .6); p.r += p.gr * dt / (1 + p.t * .2); }
    for (const f of fxs) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.kind === 'flare' || f.kind === 'spark') { f.vx *= 1 - Math.min(1, dt * (f.kind === 'spark' ? 2.5 : .6)); f.vy *= 1 - Math.min(1, dt * (f.kind === 'spark' ? 2.5 : .6)); }
      if (f.kind === 'fire' && Math.random() < dt * 4 * (1 - f.t / f.life)) puff({ x: f.x + R(-4, 4), y: f.y + R(-4, 4) }, R(5, 9), R(3, 6), R(16, 26), .55, 0x231f1c, 4, R(0, 2), R(0, 1)); } }
  const dead = puffs.filter(p => p.t >= p.life); dead.forEach(p => p.s.destroy()); puffs = puffs.filter(p => p.t < p.life);
  const fd = fxs.filter(f => f.t >= f.life); fd.forEach(f => { f.s?.destroy(); f.g?.destroy(); }); fxs = fxs.filter(f => f.t < f.life);
  trails = trails.filter(r => r.live || (r.pts.length && W.t - r.pts[r.pts.length - 1].t < r.life));
  if (dTrail.size > 300) for (const [key, tr] of dTrail) if (!tr.live) dTrail.delete(key);
}
function drawFx() {
  for (const p of puffs) { const q = p.t / p.life, a = p.a * Math.min(1, q * 8) * (1 - q); p.s.position.set(sx(p.x), sy(p.y)); p.s.width = p.s.height = Math.max(p.minPx, p.r * 2 * k) * 1.3; p.s.alpha = a; }
  for (const f of fxs) { const q = f.t / f.life, px = Math.max(f.minPx, f.size * k);
    if (f.kind === 'ring') { f.g!.clear().circle(sx(f.x), sy(f.y), px * Math.sqrt(q)).stroke({ width: 2.5, color: 0xfff1d0, alpha: (1 - q) * .6 }); continue; }
    if (f.kind === 'spark') { const l = Math.max(3, hyp(f.vx, f.vy) * .06 * k); const a = Math.atan2(-f.vy, f.vx); f.g!.clear().moveTo(sx(f.x), sy(f.y)).lineTo(sx(f.x) - Math.cos(a) * l, sy(f.y) - Math.sin(a) * l).stroke({ width: 1.6, color: f.tint, alpha: 1 - q }); continue; }
    if (f.kind === 'tracer') { const a = Math.max(0, q * 1.2 - .25), c = Math.min(1, q * 1.2); f.g!.clear().moveTo(sx(lerp(f.x, f.x2!, a)), sy(lerp(f.y, f.y2!, a))).lineTo(sx(lerp(f.x, f.x2!, c)), sy(lerp(f.y, f.y2!, c))).stroke({ width: 2, color: 0xffd28a, alpha: 1 }); continue; }
    f.s!.position.set(sx(f.x), sy(f.y));
    if (f.kind === 'ex') { f.s!.texture = EXF[Math.min(24, Math.floor(q * 25))]; f.s!.width = f.s!.height = px; }
    else if (f.kind === 'fire') { const fl = (Math.max(f.minPx, f.size * k * Uof() * .5)) * (1 + Math.sin(W.t * 13 + f.x) * .15) * (1 - q * .6); f.s!.width = f.s!.height = fl; f.s!.alpha = .9; f.s!.tint = 0xffb050; }
    else { f.s!.width = f.s!.height = px; f.s!.alpha = f.kind === 'flare' ? 1 - q * .7 : 1 - q; } }
  trackG.clear();
  if (cam.w < 20000) for (const [, tk] of tracks) { if (tk.length < 2) continue; for (const sd of [-1.7, 1.7]) { trackG.moveTo(sx(tk[0].x - Math.sin(tk[0].hd) * sd), sy(tk[0].y + Math.cos(tk[0].hd) * sd)); for (let i = 1; i < tk.length; i++) trackG.lineTo(sx(tk[i].x - Math.sin(tk[i].hd) * sd), sy(tk[i].y + Math.cos(tk[i].hd) * sd)); trackG.stroke({ width: Math.max(1, .9 * k * Uof()), color: DARK() ? 0x1a1814 : 0x6b5a40, alpha: .32 }); } }
  trailsG.clear(); const sc = smokeCol();
  for (const r of trails) { const P = r.pts; if (P.length < 2) continue;
    for (let i0 = 0; i0 < P.length - 1; i0 += 4) { const i1 = Math.min(P.length - 1, i0 + 4), am = W.t - P[Math.floor((i0 + i1) / 2)].t; if (am > r.life) continue;
      const q = am / r.life, rad = r.r0 + r.gr * Math.sqrt(am), al = r.a * (1 - q) * (1 - q * .4);
      trailsG.moveTo(sx(P[i0].x + WIND.x * (W.t - P[i0].t)), sy(P[i0].y + WIND.y * (W.t - P[i0].t)));
      for (let i = i0 + 1; i <= i1; i++) trailsG.lineTo(sx(P[i].x + WIND.x * (W.t - P[i].t)), sy(P[i].y + WIND.y * (W.t - P[i].t)));
      trailsG.stroke({ width: Math.max(1.6, rad * 2 * k), color: r.dark ? 0x2d2925 : sc, alpha: al * .85, cap: 'round', join: 'round' }); } }
}
const mG = new Graphics(); unitL.addChild(mG); const mGlow: Sprite[] = [], abPool: Sprite[] = [];
function drawMissiles() {
  mG.clear(); let gi = 0; const U = Uof();
  for (const m of W.msls) { if (m.ph === 'dead' || m.type === '125mm' || m.type === '120mm') continue; const M = MSL[m.type], sp = hyp(m.vel.x, m.vel.y), ang = sp > 1 ? Math.atan2(m.vel.y, m.vel.x) : -Math.PI / 2, x = sx(m.p.x), y = sy(m.p.y);
    const burning = isBurning(m), l = Math.max(m.type === '122mm' ? 5 : 9, M.len * k * U * .9), cx = Math.cos(-ang), cy = Math.sin(-ang);
    mG.moveTo(x - cx * l / 2, y - cy * l / 2).lineTo(x + cx * l / 2, y + cy * l / 2).stroke({ width: Math.max(2.2, l * .1), color: M.color, cap: 'round' });
    if (!burning && m.type !== 'Zolfaghar') continue;
    const g = mGlow[gi] ?? (() => { const s = new Sprite(glowT); s.anchor.set(.5); s.blendMode = 'add'; fxL.addChild(s); mGlow.push(s); return s; })(); gi++;
    g.visible = true; g.position.set(x - cx * l / 2, y - cy * l / 2); const gs = burning ? Math.max(m.type === '122mm' ? 12 : 24, l * 1.6) * R(.9, 1.1) : 14; g.width = g.height = gs; g.alpha = burning ? 1 : .4; g.tint = 0xffffff;
    if (m.type === 'Zolfaghar' && m.vel.z < -900 && m.p.z < 45000) { g.width = g.height = gs + (45000 - m.p.z) / 900; g.alpha = 1; g.tint = 0xffc070; } }
  for (; gi < mGlow.length; gi++) mGlow[gi].visible = false;
}
// المظلة: قبة مقسّمة وحبال وطيار؛ بعد ما تنزل تنطوي وتختفي (كانت تبقى دائرة بيضاء مكان الطيارة)
const chuteG = new Graphics(); unitL.addChild(chuteG);
function drawChutes() { chuteG.clear(); for (const c of W.chutes) { const x = sx(c.p.x), y = sy(c.p.y), s = Math.max(5, 7 * k * Uof());
  if (c.landed) { const age = (W.t - c.landed) / 12; if (age >= 1) continue; chuteG.ellipse(x + s * .7, y, s * (1 - age * .7), s * .3 * (1 - age)).fill({ color: 0xe8e2d2, alpha: (1 - age) * .8 }); chuteG.circle(x, y, Math.max(1.5, s * .15)).fill({ color: 0x3a3d34, alpha: 1 - age }); continue; }
  const sway = Math.sin(W.t * 1.3 + c.p.x) * .15;
  for (let i = 0; i < 6; i++) { const a0 = i / 6 * 6.283 + sway, a1 = (i + 1) / 6 * 6.283 + sway; chuteG.moveTo(x, y).arc(x, y, s, a0, a1).lineTo(x, y).fill({ color: i % 2 ? 0xf2efe6 : 0xd9a441 }); }
  chuteG.circle(x, y, s).stroke({ width: 1, color: 0x222222, alpha: .55 }); chuteG.circle(x, y, s * .18).fill({ color: 0x8a8576 });
  chuteG.circle(x + s * .5, y + s * .5, Math.max(1.5, s * .16)).fill({ color: 0x3a3d34 }); for (const d of [-1, 1]) chuteG.moveTo(x + d * s * .7, y + s * .2).lineTo(x + s * .5, y + s * .5).stroke({ width: .8, color: 0x222222, alpha: .6 }); } }

// ===== اللقطة القريبة للإطلاق (صورة داخل صورة بمنظور مايل 50°، بنفس المحاكاة) =====
interface PPuff { x: number; y: number; z: number; r: number; gr: number; t: number; life: number; a: number; s: Sprite }
let pipPuffs: PPuff[] = [];
const pipBg = new TilingSprite({ texture: Texture.WHITE, width: 10, height: 10 }), pipMask = new Graphics(), pipFrame = new Graphics(), pipLauncher = new Sprite(), pipJet = new Sprite(), pipM = new Graphics(), pipSmoke = new Container(), pipFx = new Container(), pipTitle = new Text({ text: '', style: { fontFamily: 'IBM Plex Sans Arabic, Tahoma', fontSize: 12, fontWeight: '700', fill: '#fff', stroke: { color: '#000', width: 4 } } });
const pipGlow = new Sprite(); pipGlow.anchor.set(.5); pipGlow.blendMode = 'add';
const pipHint = new Text({ text: '⤢ اضغط تكبر', style: { fontFamily: 'IBM Plex Sans Arabic, Tahoma', fontSize: 10, fill: '#fff', stroke: { color: '#000', width: 3 } } });
const pipFill = new Graphics();
pipL.addChild(pipFill, pipBg, pipLauncher, pipJet, pipSmoke, pipM, pipFx, pipFrame, pipTitle, pipHint); pipFx.addChild(pipGlow); pipL.mask = pipMask; app.stage.addChild(pipMask); pipL.visible = false;
pipLauncher.anchor.set(.5); pipJet.anchor.set(.5); pipTitle.anchor.set(1, 0);
const pipRect = () => { const W0 = pipBig ? SW - 16 : Math.round(Math.min(SW * .5, 260)), H0 = pipBig ? Math.round(SH * .6) : Math.round(W0 * 1.2), X0 = pipBig ? 8 : 8, Y0 = pipBig ? 76 : 96; return { W0, H0, X0, Y0 }; };
function startPip(m: Msl, at: V3, kind: string, az?: number, jet?: number) {
  if (!PIPON) return; pipPuffs.forEach(p => p.s.destroy()); pipPuffs = [];
  const l = W.bats.flatMap(bb => bb.launchers).find(l2 => hyp(l2.p.x - at.x, l2.p.y - at.y) < 40), tel = W.tels.find(tl => hyp(tl.p.x - at.x, tl.p.y - at.y) < 40);
  PIP = { mid: m.id, at: l ? { ...l.p, z: 0 } : tel ? { ...tel.p, z: 0 } : { ...at }, kind, t0: W.t, dur: kind === 'zolf' ? 14 : kind === 'air' ? 7 : 6, az, jet };
  // نفخة الطرد من فم الأنبوب (صغيرة حتى ما تغطي المنصة)؛ الباليستي: غبار عريض حول المنصة
  const zf = kind === 'zolf';
  for (let i = 0; i < (zf ? 30 : kind === 'air' ? 0 : 8); i++) { const a = R(0, 6.28), r = zf ? R(4, 18) : R(0, 2); pipPuff({ x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r, z: zf ? R(0, 3) : R(6, 10) }, zf ? R(1.5, 6) : R(.6, 1.4), zf ? R(1.5, 4) : R(.5, 1.2), zf ? R(6, 14) : R(3, 6), zf ? .6 : .5, zf ? 0xc9b48e : 0xffffff); }
}
function pipPuff(p: V3, r: number, gr: number, life: number, a: number, tint: number) { if (pipPuffs.length > 400) { pipPuffs.shift()!.s.destroy(); } const s = new Sprite(CELLS[Math.floor(R(0, 64))]); s.anchor.set(.5); s.tint = tint; s.rotation = R(0, 6.28); pipSmoke.addChild(s); pipPuffs.push({ x: p.x, y: p.y, z: p.z, r, gr, t: 0, life, a, s }); }
let pipLast: V3 | null = null;
function pipStep() {
  if (!PIP) return; const m = W.msls.find(q => q.id === PIP!.mid);
  if (m && m.ph !== 'dead') { const ej = m.ph === 'eject' || m.ph === 'drop';
    if (pipLast && !ej && isBurning(m)) { const d = hyp(m.p.x - pipLast.x, m.p.y - pipLast.y, m.p.z - pipLast.z), n = Math.min(8, Math.ceil(d / 3)); for (let i = 1; i <= n; i++) { const u = i / n; pipPuff({ x: lerp(pipLast.x, m.p.x, u), y: lerp(pipLast.y, m.p.y, u), z: lerp(pipLast.z, m.p.z, u) }, m.type === 'Zolfaghar' ? 2.5 : 1.2, m.type === 'Zolfaghar' ? 3 : 1.8, R(8, 14), .7, 0xf2f0ea); } }
    pipLast = { ...m.p }; } else pipLast = null;
}
function pipAge(dt: number) {
  if (!PIP) return;
  for (const p of pipPuffs) { p.t += dt; p.x += WIND.x * dt; p.y += WIND.y * dt; p.z += .6 * dt; p.r += p.gr * dt / (1 + p.t * .3); }
  const d2 = pipPuffs.filter(p => p.t >= p.life); d2.forEach(p => p.s.destroy()); pipPuffs = pipPuffs.filter(p => p.t < p.life);
  if (W.t - PIP.t0 > PIP.dur) { PIP = null; pipPuffs.forEach(p => p.s.destroy()); pipPuffs = []; pipBig = false; }
}
function drawPip() {
  pipL.visible = !!PIP; pipMask.clear(); if (!PIP) return;
  const { W0, H0, X0, Y0 } = pipRect();
  pipMask.rect(X0, Y0, W0, H0).fill({ color: 0xffffff });
  const m = W.msls.find(q => q.id === PIP!.mid), jet = PIP.jet ? W.jets.find(j => j.id === PIP!.jet) : null;
  const at = PIP.kind === 'air' && jet && (!m || m.ph === 'drop') ? jet.p : PIP.at, top = m && m.ph !== 'dead' ? m.p : at;
  // صواريخ الأرض: المنصة ثابتة تحت الإطار والكاميرا تبعد بهدوء لحد 900 م (تشوف الطرد والاشتعال والميلان)؛ الجو والباليستي: بين النقطتين
  const dist = hyp(top.x - at.x, top.y - at.y, top.z - at.z), anch = PIP.kind === 's400' || PIP.kind === 'patriot';
  const pw = anch ? clamp(32 + dist * .6, 32, 700) : clamp(60 + dist * 1.15, 60, PIP.kind === 'zolf' ? 1600 : 2500), kk = W0 / pw;
  const mx = anch ? at.x : (top.x + at.x) / 2, my = anch ? at.y : (top.y + at.y) / 2, mz = anch ? 0 : (top.z + at.z) / 2, cyF = anch ? .8 : .55;
  const P = (x: number, y: number, z: number): [number, number] => [X0 + W0 / 2 + (x - mx) * kk, Y0 + H0 * cyF - ((y - my) * SE + (z - mz) * CE) * kk];
  const airshot = PIP.kind === 'air';
  pipFill.clear().rect(X0, Y0, W0, H0).fill({ color: airshot ? (DARK() ? 0x1c2836 : 0x8fb0cc) : DARK() ? 0x6b5f4c : 0xcbb894 });
  if (!airshot) { const [, hy] = P(mx, my + 2000, 0); pipFill.rect(X0, Y0, W0, Math.max(0, hy - Y0)).fill({ color: DARK() ? 0x2a3442 : 0xa9c2d6 }); }   // سما بالأفق
  pipBg.texture = grainT; pipBg.position.set(X0, Y0); pipBg.width = W0; pipBg.height = H0; pipBg.tileScale.set(1, SE); pipBg.alpha = airshot ? .4 : 1.6;
  const [ox, oy] = P(0, 0, 0); pipBg.tilePosition.set((ox - X0) % 256, (oy - Y0) % 256);
  const OM = OMAN as Record<string, { mpp: number }>;
  pipLauncher.visible = false; pipJet.visible = false;
  const age = W.t - PIP.t0, [lx, ly] = P(PIP.at.x, PIP.at.y, 0);
  if (PIP.kind === 's400') { pipLauncher.texture = OB.s400[9]; pipLauncher.position.set(lx, ly); pipLauncher.width = pipLauncher.height = 256 * OM.s400.mpp * kk; pipLauncher.visible = true; }
  if (PIP.kind === 'patriot') { const i = (((Math.round((PIP.az ?? 0) / (Math.PI / 8)) % 16) + 16) % 16); pipLauncher.texture = OB.patriot[i]; pipLauncher.position.set(lx, ly); pipLauncher.width = pipLauncher.height = 256 * OM.patriot.mpp * kk; pipLauncher.visible = true; }
  if (PIP.kind === 'zolf') { pipLauncher.texture = OB.zolf[age < .25 ? 9 : 12]; pipLauncher.position.set(lx, ly); pipLauncher.width = pipLauncher.height = 256 * OM.zolf.mpp * kk; pipLauncher.visible = true; }
  if (airshot && jet && jet.st !== 'gone') { const i = (((Math.round(jet.hd / (Math.PI / 8)) % 16) + 16) % 16); pipJet.texture = OB.f16[i]; const [jx, jy] = P(jet.p.x, jet.p.y, jet.p.z); pipJet.position.set(jx, jy); pipJet.width = pipJet.height = 256 * OM.f16.mpp * kk; pipJet.visible = true; pipJet.tint = jet.type === 'f16' ? 0xffffff : 0xd8d0c0; }
  for (const p of pipPuffs) { const q = p.t / p.life, [x, y] = P(p.x, p.y, p.z); p.s.position.set(x, y); p.s.width = p.s.height = Math.max(3, p.r * 2 * kk * 1.3); p.s.alpha = p.a * Math.min(1, q * 8) * (1 - q); }
  pipM.clear(); pipGlow.visible = false;
  if (m && m.ph !== 'dead') { const M = MSL[m.type], sp = len3(m.vel), u = sp > 1 ? { x: m.vel.x / sp, y: m.vel.y / sp, z: m.vel.z / sp } : { x: 0, y: 0, z: 1 };
    const [tx, ty] = P(m.p.x - u.x * M.len / 2, m.p.y - u.y * M.len / 2, m.p.z - u.z * M.len / 2), [nx, ny] = P(m.p.x + u.x * M.len / 2, m.p.y + u.y * M.len / 2, m.p.z + u.z * M.len / 2);
    pipM.moveTo(tx, ty).lineTo(nx, ny).stroke({ width: Math.max(2.5, M.diam * kk), color: M.color, cap: 'round' });
    if (isBurning(m)) { const fl = Math.max(12, (m.type === 'Zolfaghar' ? 16 : 9) * kk) * R(.85, 1.15), a = Math.atan2(ty - ny, tx - nx); pipM.moveTo(tx, ty).lineTo(tx + Math.cos(a) * fl, ty + Math.sin(a) * fl).stroke({ width: Math.max(3, M.diam * kk * 1.4), color: 0xffd28a, alpha: .9, cap: 'round' }); pipGlow.texture = glowT; pipGlow.visible = true; pipGlow.position.set(tx, ty); pipGlow.width = pipGlow.height = fl * 2.2; } }
  pipFrame.clear().rect(X0, Y0, W0, H0).stroke({ width: 2, color: 0xd2ab33 });
  const st = !m || m.ph === 'dead' ? '' : m.ph === 'eject' ? ' — طرد بالغاز' : m.ph === 'drop' ? ' — سقوط حر' : isBurning(m) ? ' — اشتعال' : '';
  pipTitle.text = ({ s400: 'S-400 إطلاق بارد', patriot: 'باتريوت PAC-3', zolf: 'ذو الفقار', air: 'صاروخ من الطيارة' } as Record<string, string>)[PIP.kind] + st; pipTitle.position.set(X0 + W0 - 6, Y0 + 4); pipTitle.style.fontSize = pipBig ? 14 : 10.5;
  pipHint.visible = !pipBig; pipHint.position.set(X0 + 6, Y0 + H0 - 20);
}
const len3 = (a: V3) => hyp(a.x, a.y, a.z);

// ===== الصوت: يوصل بسرعة الصوت (محدود)، والبعيد مكتوم =====
let ac: AudioContext | null = null, master: GainNode; const smp: Record<string, AudioBuffer> = {}; let muted = false, act = 0;
const SNDU = { ...import.meta.glob('../../theater/sounds/{launch,rocket,boom_big,boom_far,boom_mid,incoming,tank,eject,whiz}.mp3', { query: '?url', import: 'default', eager: true }), ...import.meta.glob('../../battle-classic/sounds/{jet_roar,woosh,boom_huge,blast,sonic,boom_bomb}.mp3', { query: '?url', import: 'default', eager: true }) } as Record<string, string>;
function audio() { try { if (!ac) { ac = new AudioContext(); master = ac.createGain(); master.gain.value = .9; master.connect(ac.createDynamicsCompressor()).connect(ac.destination); const a = ac; for (const [kk2, u] of Object.entries(SNDU)) fetch(u).then(r => r.arrayBuffer()).then(bb => a.decodeAudioData(bb)).then(buf => { smp[kk2.split('/').pop()!.replace('.mp3', '')] = buf; }).catch(() => {}); } if (ac.state === 'suspended') ac.resume(); } catch { /* */ } }
let curTs = 1;
function snd(n: string, p: V3, v: number, rate = 1) {
  if (!ac || !smp[n] || muted || act > 14) return; const eff = curTs * speed; if (eff > 40 && v < 1) return;
  const d = hyp(p.x - cam.x, p.y - cam.y), dEff = hyp(d, cam.w * .4), delay = Math.min(2.5, d / 343) / Math.max(.4, eff), gain = v / (1 + dEff / 2500); if (gain < .03) return;
  const s = ac.createBufferSource(); s.buffer = smp[n]; s.playbackRate.value = rate; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(18000 / (1 + dEff / 4000), 600, 18000);
  const gn = ac.createGain(); gn.gain.value = gain; const pan = ac.createStereoPanner(); pan.pan.value = clamp((p.x - cam.x) / cam.w * 1.4, -.8, .8); s.connect(lp).connect(gn).connect(pan).connect(master); s.start(ac.currentTime + delay); act++; s.onended = () => act--;
}

// ===== المخرج =====
function director(): { x: number; y: number; w: number; ts: number; key: string } {
  focuses = focuses.filter(f => W.t < f.until && f.pos());
  const f = focuses.sort((a, c) => c.pri - a.pri)[0];
  if (f) { const p = f.pos()!; return { ...p, w: f.w(), ts: f.ts, key: f.key }; }
  const fight = W.gnd.filter(g => g.st === 'move' && g.side === 0);
  if (fight.length) { const c = fight.reduce((a, g) => ({ x: a.x + g.p.x / fight.length, y: a.y + g.p.y / fight.length }), { x: 0, y: 0 }); return { ...c, x: c.x + 900, w: 6500, ts: 5, key: 'ground' }; }
  const air = W.jets.filter(j => j.side === 0 && W.alive(j));
  if (air.length) { const c = air.reduce((a, j) => ({ x: a.x + j.p.x / air.length, y: a.y + j.p.y / air.length }), { x: 0, y: 0 }); const spread = Math.max(...air.map(j => hyp(j.p.x - c.x, j.p.y - c.y))); return { ...c, w: clamp(spread * 2.4 + 30000, 30000, 160000), ts: 14, key: 'air' }; }
  return { x: (SITES.stage.x + SITES.base.x) / 2, y: SITES.stage.y, w: 60000, ts: 16, key: 'idle' };
}
let follow = true, fly: { x0: number; y0: number; w0: number; t: number; d: number } | null = null, shotKey = '';
function setFollow(on: boolean) { follow = on; $('bFollow').setAttribute('aria-pressed', String(on)); if (on) shotKey = ''; }
function camUpdate(sh: ReturnType<typeof director>, rdt: number) {
  if (!follow) return;
  if (sh.key !== shotKey) { const d = hyp(sh.x - cam.x, sh.y - cam.y); if (shotKey && d > Math.max(cam.w, sh.w) * .8) fly = { x0: cam.x, y0: cam.y, w0: cam.w, t: 0, d: clamp(.8 + Math.log10(d / Math.min(cam.w, sh.w) + 1) * .45, .8, 2.2) }; shotKey = sh.key; }
  if (fly) { fly.t += rdt; const u = clamp(fly.t / fly.d, 0, 1), e = u * u * (3 - 2 * u), dist = hyp(sh.x - fly.x0, sh.y - fly.y0), l0 = Math.log(fly.w0), l1 = Math.log(sh.w), bump = Math.max(0, Math.log(dist * 1.3) - Math.max(l0, l1));
    cam.x = lerp(fly.x0, sh.x, e); cam.y = lerp(fly.y0, sh.y, e); cam.w = Math.exp(lerp(l0, l1, e) + bump * Math.sin(Math.PI * e)); if (u >= 1) fly = null; return; }
  const a = 1 - Math.exp(-rdt * 3), z = 1 - Math.exp(-rdt * 2.4); cam.x = lerp(cam.x, sh.x, a); cam.y = lerp(cam.y, sh.y, a); cam.w = Math.exp(lerp(Math.log(cam.w), Math.log(sh.w), z));
}

// ===== الإصبع =====
const ptrs = new Map<number, { x: number; y: number }>(); let pinch0 = 0, w0 = 0, downAt = { x: 0, y: 0, t: 0 };
const inPip = (x: number, y: number) => { if (!PIP) return false; const { W0, H0, X0, Y0 } = pipRect(); return x > X0 && x < X0 + W0 && y > Y0 && y < Y0 + H0; };
app.canvas.addEventListener('pointerdown', e => { if (inPip(e.clientX, e.clientY)) { pipBig = !pipBig; return; } app.canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; if (ptrs.size === 2) { const [a, c] = [...ptrs.values()]; pinch0 = hyp(a.x - c.x, a.y - c.y); w0 = cam.w; } });
app.canvas.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; if (hyp(e.clientX - downAt.x, e.clientY - downAt.y) > 6 || ptrs.size > 1) setFollow(false); if (!follow) { if (ptrs.size === 1) { cam.x -= (e.clientX - p.x) / k; cam.y += (e.clientY - p.y) / k; } } p.x = e.clientX; p.y = e.clientY; if (ptrs.size === 2) { const [a, c] = [...ptrs.values()], d = hyp(a.x - c.x, a.y - c.y); if (pinch0) cam.w = clamp(w0 * pinch0 / d, 600, 400000); } });
const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; };
app.canvas.addEventListener('pointerup', up); app.canvas.addEventListener('pointercancel', up);
app.canvas.addEventListener('wheel', e => { e.preventDefault(); setFollow(false); cam.w = clamp(cam.w * Math.exp(e.deltaY * .0015), 600, 400000); }, { passive: false });

// ===== الحلقة =====
let W = new World(), speed = 1, paused = false, running = false, ended = false;
function reset() { W = new World(); for (const p of puffs) p.s.destroy(); for (const f of fxs) { f.s?.destroy(); f.g?.destroy(); } puffs = []; fxs = []; trails = []; mTrail = new Map(); dTrail = new Map(); vTrail = new Map(); tracks = new Map(); lastGun.clear(); tossed.clear(); focuses = []; PIP = null; pipPuffs.forEach(p => p.s.destroy()); pipPuffs = []; ended = false; shotKey = ''; fly = null; uMap.forEach(u => { u.s.destroy(); u.sh.destroy(); u.f.destroy(); u.t?.destroy(); }); uMap.clear(); }
function start() { reset(); const s = director(); cam.x = s.x; cam.y = s.y; cam.w = s.w; setFollow(true); running = true; $('start').hidden = true; $('ui').hidden = false; $('end').hidden = true; audio(); caption('العملية بدأت: الهدف خرمشهر'); }
// ميزانية وقت بالإطار (14 ملي ثانية): بالسرعات العالية على تلفون ضعيف تتباطأ اللعبة شوي بدل ما تقطّع
function stepSim(simDt: number, budget = 14) { let left = simDt, n = 0; const t0 = performance.now(); while (left > 1e-6 && n < 3000 && (n % 50 || performance.now() - t0 < budget)) { const d = Math.min(.02, left); left -= d; n++; W.step(d); fxStep(d); pipStep(); for (const e of W.ev.splice(0)) onEvent(e); } const done = simDt - Math.max(0, left); fxAge(done); pipAge(done); }
function render() {
  SW = app.screen.width; SH = app.screen.height; k = SW / cam.w; frameNo++;
  updateMap(); updateLabels();
  let ab = 0;
  for (const j of W.jets) { if (j.st === 'gone') continue; const air = j.st !== 'landed' && j.st !== 'parked', spr = AIR[j.type].sprite;
    drawUnit('j' + j.id, spr, j.side, j.p, j.hd, { tex: SHEET[spr][air ? jetFrame(j.bank, j.gam) : 27], zs: 1 + Math.min(.2, j.p.z / 50000), alpha: j.st === 'hit' ? .9 : 1, ground: !air });
    // حارق خلفي: بالإقلاع والصعود وبالسحب القوي
    if (air && j.st !== 'hit' && (j.st === 'roll' || j.st === 'climb' || j.n > 5.5)) { const g = abPool[ab] ?? (() => { const q = new Sprite(glowT); q.anchor.set(.5); q.blendMode = 'add'; q.tint = 0xffb070; fxL.addChild(q); abPool.push(q); return q; })(); ab++;
      const L2 = LEN[spr] * .52 * k * Uof() * Math.cos(j.gam); g.visible = true; g.position.set(sx(j.p.x) - Math.cos(j.hd) * L2, sy(j.p.y) + Math.sin(j.hd) * L2); g.width = g.height = Math.max(9, 4.5 * k * Uof()) * R(.85, 1.15); } }
  for (; ab < abPool.length; ab++) abPool[ab].visible = false;
  for (const bt of W.bats) bt.launchers.forEach((l, i) => drawUnit(`b${bt.id}_${i}`, bt.type, bt.side, l.p, l.hd, { dead: !l.alive, ground: true }));
  W.tels.forEach((tl, i) => drawUnit('tel' + i, 'zolf', 1, tl.p, 3.6, { ground: true }));
  for (const g of W.gnd) { if (g.st === 'gone') continue; const hasT = g.type === 'abrams' || g.type === 't72', lg = lastGun.get(g.id);
    drawUnit('g' + g.id, GROUND[g.type].sprite, g.side, g.p, g.hd, { dead: g.st === 'dead', tint: g.type === 'truck' ? 0x9aa07a : undefined, ground: true, tur: hasT ? { n: g.type + '_t', a: g.turret, recoil: lg !== undefined ? Math.max(0, 1 - (W.t - lg) / .5) : 0, toss: tossed.get(g.id) } : undefined }); }
  sweepUnits(); drawMissiles(); drawFx(); drawChutes(); drawPip(); hud();
}
function hud() {
  if (performance.now() - capAt > 4500) $('cap').style.opacity = '0';
  const S = W.stats; $('stats').innerHTML = `✈ خسرنا <b>${S.lostA[0]}</b> · أسقطنا <b>${S.lostA[1]}</b> │ 🛡 خسرنا <b>${S.lostG[0]}</b> · دمّرنا <b>${S.lostG[1]}</b> │ 🚀 اعترضنا <b>${S.bmShot}</b>/${S.bm}`;
  const o = W.msls.find(m => m.ph !== 'dead' && ['48N6', 'PAC-3', 'AIM-54', 'AIM-120', 'AGM-88', 'Zolfaghar'].includes(m.type)); let t = '';
  if (o && follow) { const sp = len3(o.vel); t = `${MSL[o.type].name} · ارتفاع ${(o.p.z / 1000).toFixed(1)} كم · ${Math.round(sp)} م/ث (ماخ ${(sp / 300).toFixed(1)})`; }
  $('read').textContent = t; const eff = (follow ? curTs : 1) * speed; $('rate').textContent = eff < .95 ? `تبطيء ×${eff.toFixed(1)}` : `الوقت ×${Math.round(eff)}`; $('rate').className = 'tag' + (eff < .95 ? ' slow' : '');
  $('clock').textContent = `${Math.floor(W.t / 60)}:${String(Math.floor(W.t % 60)).padStart(2, '0')}`;
}
app.ticker.add(tk => {
  const rdt = Math.min(.05, tk.deltaMS / 1000);
  if (running && !paused) { const sh = director(); curTs = follow ? sh.ts : 1; stepSim(rdt * curTs * speed); camUpdate(director(), rdt); if (W.endT > 0 && W.t > W.endT && !ended) { ended = true; $('end').hidden = false; $('endTxt').innerHTML = endText(); } }
  else if (running) camUpdate(director(), 0);
  if (mapSpr || running) render();
});
function endText() { const S = W.stats; return `قواتنا وصلت خرمشهر بعد ${Math.round(W.t / 60)} دقيقة قتال.<br>طيارات: خسرنا ${S.lostA[0]} وأسقطنا ${S.lostA[1]}<br>دروع: خسرنا ${S.lostG[0]} (وصلت ${S.reinf} تعزيزات) ودمّرنا ${S.lostG[1]}<br>باليستي: اعترضنا ${S.bmShot} من ${S.bm}`; }
// ===== الأزرار =====
const themeBtn = () => { $('bTheme').textContent = DARK() ? '🌙' : '☀️'; app.renderer.background.color = DARK() ? 0x0d1218 : 0xcfc3a4; bloom.bloomScale = DARK() ? 1.6 : 1; };
const sizeBtn = () => { $('bSize').textContent = ['حجم ١', 'حجم ٢', 'حجم ٣'][SIZE]; };
const pipBtn = () => { $('bPip').textContent = PIPON ? '🎬 قريب' : '🎬 مطفأ'; $('bPip').setAttribute('aria-pressed', String(PIPON)); };
$('bTheme').onclick = () => { THEME = DARK() ? 'light' : 'dark'; store.set('td_theme', THEME); themeBtn(); };
$('bSize').onclick = () => { SIZE = (SIZE + 1) % 3; store.set('td_size', String(SIZE)); sizeBtn(); };
$('bPip').onclick = () => { PIPON = !PIPON; store.set('td_pip', PIPON ? '1' : '0'); if (!PIPON) PIP = null; pipBtn(); };
$('bFollow').onclick = () => setFollow(!follow);
$('bPause').onclick = () => { paused = !paused; $('bPause').textContent = paused ? '▶' : '⏸'; };
const spdBtns = document.querySelectorAll<HTMLButtonElement>('#spd button');
spdBtns.forEach(bt => bt.onclick = () => { speed = +bt.dataset.s!; spdBtns.forEach(x => x.setAttribute('aria-pressed', String(x === bt))); });
$('bMute').onclick = () => { muted = !muted; $('bMute').textContent = muted ? '🔇' : '🔊'; if (ac) muted ? ac.suspend() : ac.resume(); };
$('bGo').onclick = start; $('bAgain').onclick = start;
themeBtn(); sizeBtn(); pipBtn();
let nl = 0; await loadAll(s => { nl++; $('load').textContent = `يحمّل ${s}… ${nl}`; }); $('load').textContent = ''; ($('bGo') as HTMLButtonElement).disabled = false; $('bGo').textContent = 'ابدأ العملية';
buildLabels(); cam.x = SITES.stage.x; cam.y = SITES.stage.y + 30000; cam.w = 220000; render();
if (AUTO) { start(); (window as any).ready = true; }
(window as any).seek = (t: number) => { while (W.t < t - 1e-4) stepSim(Math.min(2, t - W.t), 1e9); const sh = director(); shotKey = sh.key; fly = null; cam.x = sh.x; cam.y = sh.y; cam.w = sh.w; curTs = sh.ts; render(); app.render(); };
(window as any).opts = (th: string, sz: number) => { THEME = th as any; SIZE = sz; themeBtn(); sizeBtn(); render(); app.render(); };
(window as any).W = () => W; (window as any).freeze = () => app.ticker.stop(); (window as any).pip = (big: boolean) => { pipBig = big; render(); app.render(); };
(window as any).camAt = (x: number, y: number, w: number) => { setFollow(false); cam.x = x; cam.y = y; cam.w = w; render(); app.render(); };
