// النموذج المتحرك (WM8.2، I-062، D-032): من فوق، خريطة مرسومة بثيمين، مجسمات Blender، مؤثرات بكرت الشاشة (PixiJS + توهج)
// المنطق من sim.ts (متر/ثانية حقيقية). «تابع» = مخرج يختار اللقطة ويسرّع/يبطّئ الوقت؛ الإصبع يسحب ويكبّر؛ زر للثيم وزر لحجم الوحدات.
import { Application, Assets, Container, Graphics, Sprite, Text, Texture, Rectangle, TilingSprite, type TextStyleOptions } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import MAP from './mapdata.json';
import BASE from '../textures/basemap.json';
import { World, SITES, RUNWAY, type V3, type Msl } from './sim';

const $ = (id: string) => document.getElementById(id)!;
const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const R = (a: number, b: number) => a + Math.random() * (b - a);
const hyp = Math.hypot;
const qs = new URLSearchParams(location.search), AUTO = qs.has('auto');
let THEME: 'light' | 'dark' = (localStorage.getItem('td_theme') as any) || 'dark', SIZE = +(localStorage.getItem('td_size') || 1);
const SIZES = [1, 1.5, 2.2];
let SW = innerWidth, SH = innerHeight;

const app = new Application();
const LITE = qs.has('lite');   // للفحص بدون كرت شاشة
await app.init({ resizeTo: window, background: '#0d1218', antialias: !LITE, resolution: LITE ? 1 : Math.min(2, devicePixelRatio), autoDensity: true, preference: 'webgl' });
$('stage').appendChild(app.canvas);
const flagL = new Container(), mapL = new Container(), vecC = new Container(), vec = new Graphics(), trailsG = new Graphics(), smokeL = new Container(), unitL = new Container(), fxL = new Container(), labL = new Container();
vecC.addChild(vec); app.stage.addChild(mapL, vecC, smokeL, trailsG, unitL, fxL, flagL, labL);
const bloom = new AdvancedBloomFilter({ threshold: .35, bloomScale: 1.3, brightness: 1.1, blur: 8, quality: 5 }); if (!LITE) fxL.filters = [bloom];

// ===== الأصول =====
const SPRU = import.meta.glob('../sprites/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const MAPU = import.meta.glob('../textures/map_*_[01].webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const FXU = import.meta.glob('../../theater/textures/{fx_cloud,fx_explo1}.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const byName = (o: Record<string, string>, n: string) => Object.entries(o).find(([k2]) => k2.endsWith('/' + n))![1];
const T: Record<string, Texture> = {};
const MAPT: Record<string, Texture> = {};
let cloud: Texture, explo: Texture, CELLS: Texture[] = [], EXF: Texture[] = [], glowT: Texture, FLAG: Texture[] = [], grainT: Texture;
async function loadAll(prog: (s: string) => void) {
  for (const n of ['f16', 'su25', 'f14', 's400', 'zolf', 'patriot', 'abrams', 't72']) { T[n] = await Assets.load(byName(SPRU, `${n}.png`)); prog('المجسمات'); }
  for (const th of ['light', 'dark']) for (const l of [0, 1]) { MAPT[`${th}${l}`] = await Assets.load(byName(MAPU, `map_${th}_${l}.webp`)); prog('الخريطة'); }
  cloud = await Assets.load(byName(FXU, 'fx_cloud.webp')); explo = await Assets.load(byName(FXU, 'fx_explo1.webp'));
  CELLS = Array.from({ length: 64 }, (_, i) => new Texture({ source: cloud.source, frame: new Rectangle((i % 8) * 128, Math.floor(i / 8) * 128, 128, 128) }));
  EXF = Array.from({ length: 25 }, (_, i) => new Texture({ source: explo.source, frame: new Rectangle((i % 5) * 200, Math.floor(i / 5) * 200, 200, 200) }));
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!, g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,245,1)'); g.addColorStop(.15, 'rgba(255,230,170,.95)'); g.addColorStop(.4, 'rgba(255,150,60,.35)'); g.addColorStop(1, 'rgba(255,110,30,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); glowT = Texture.from(c);
  FLAG = [0, 1].map(side => { const f = document.createElement('canvas'); f.width = 36; f.height = 24; const y = f.getContext('2d')!; (side ? ['#239f40', '#ffffff', '#da0000'] : ['#ce1126', '#ffffff', '#111111']).forEach((col, i) => { y.fillStyle = col; y.fillRect(0, i * 8, 36, 8); }); if (!side) { y.fillStyle = '#007a3d'; y.fillRect(10, 10, 16, 4); } else { y.fillStyle = '#da0000'; y.beginPath(); y.arc(18, 12, 3, 0, 7); y.fill(); } y.strokeStyle = 'rgba(0,0,0,.7)'; y.lineWidth = 2; y.strokeRect(1, 1, 34, 22); return Texture.from(f); });
  const gr = document.createElement('canvas'); gr.width = gr.height = 256; const z = gr.getContext('2d')!; for (let i = 0; i < 9000; i++) { const v = Math.random() < .5 ? 0 : 255; z.fillStyle = `rgba(${v},${v},${v},${Math.random() * .07})`; z.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); } grainT = Texture.from(gr);
}

// ===== الكاميرا =====
const cam = { x: 0, y: 0, w: 60000 }; let k = 1;
const sx = (x: number) => (x - cam.x) * k + SW / 2, sy = (y: number) => -(y - cam.y) * k + SH / 2;
const Uof = () => Math.max(1, 30 / (15 * k)) * SIZES[SIZE];   // كل الوحدات بنفس النسبة: الطيارة (15 م) ما تقل عن 30 بكسل × الحجم المختار

// ===== الخريطة =====
let mapSpr: Sprite | null = null, grain: TilingSprite | null = null, vecK = 0, vecTheme = '';
const b = BASE.b as number[];
const DARK = () => THEME === 'dark';
function updateMap() {
  const lvl = cam.w > 70000 ? 0 : 1, t = MAPT[`${THEME}${lvl}`];
  if (!mapSpr) { mapSpr = new Sprite(t); mapL.addChild(mapSpr); grain = new TilingSprite({ texture: grainT, width: SW, height: SH }); mapL.addChild(grain); }
  if (mapSpr.texture !== t) mapSpr.texture = t;
  mapSpr.position.set(sx(b[0]), sy(b[1])); mapSpr.width = (b[2] - b[0]) * k; mapSpr.height = (b[1] - b[3]) * k;
  grain!.width = SW; grain!.height = SH; grain!.alpha = cam.w < 50000 ? (DARK() ? .5 : .8) * clamp((50000 - cam.w) / 30000, 0, 1) : 0; grain!.tilePosition.set(-cam.x * k % 256, cam.y * k % 256);
  // الخطوط (أنهار، طرق، حدود) بإحداثيات العالم داخل حاوية تتحرك ويه الكاميرا؛ نعيد بناءها بس إذا التقريب تغيّر هواية (حتى السمك يبقى بالبكسل)
  vecC.position.set(SW / 2 - cam.x * k, SH / 2 + cam.y * k); vecC.scale.set(k, -k);
  if (!vecK || k / vecK > 1.3 || vecK / k > 1.3 || vecTheme !== THEME) { vecK = k; vecTheme = THEME; buildVec(); }
}
function buildVec() {
  vec.clear(); const px = 1 / vecK, D = DARK();
  const line = (p: number[], w: number, color: number, alpha: number) => { vec.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) vec.lineTo(p[i], p[i + 1]); vec.stroke({ width: w * px, color, alpha, cap: 'round', join: 'round' }); };
  for (const r of MAP.roads) line(r.p, Math.max(1, 1.2 + 60 * vecK), D ? 0x6e7681 : 0x8a7a63, .72);
  for (const r of MAP.rivers) { line(r.p, Math.max(2, 2.4 + 140 * vecK), D ? 0x0b2c45 : 0xe9f2f6, .9); line(r.p, Math.max(1.2, 1.5 + 110 * vecK), D ? 0x3aa6e0 : 0x4f8fbf, 1); }
  for (const l of MAP.borders) { line(l, 5, D ? 0x9fd6ff : 0xffffff, .3); line(l, 1.6, D ? 0xe8edf2 : 0x3b3530, .85); }
  // مدرج قاعدة البصرة (حقيقي بالحجم ~3.2 كم) + مدارج إيران
  for (const [p, hd] of [[SITES.base, RUNWAY], [xy(30.83, 49.53), .2], [xy(32.43, 48.40), -.4]] as [{ x: number; y: number }, number][]) {
    const L = 3200, W = Math.max(45, 6 * px), ux = Math.cos(hd), uy = Math.sin(hd), nx = -uy * W / 2, ny = ux * W / 2;
    vec.poly([p.x - ux * L / 2 + nx, p.y - uy * L / 2 + ny, p.x + ux * L / 2 + nx, p.y + uy * L / 2 + ny, p.x + ux * L / 2 - nx, p.y + uy * L / 2 - ny, p.x - ux * L / 2 - nx, p.y - uy * L / 2 - ny]).fill({ color: D ? 0x2a3038 : 0x55524c });
    vec.moveTo(p.x - ux * L * .45, p.y - uy * L * .45).lineTo(p.x + ux * L * .45, p.y + uy * L * .45).stroke({ width: 1 * px, color: 0xffffff, alpha: .7 });
    if (vecK > .02) { // من قريب: ممر موازي، ساحة، ملاجئ
      const tw = 23, off = 180, T = (a: number, b2: number) => ({ x: p.x + ux * a - uy * b2, y: p.y + uy * a + ux * b2 }), rect = (a0: number, a1: number, b0: number, b1: number, col: number, al = 1) => { const q = [T(a0, b0), T(a1, b0), T(a1, b1), T(a0, b1)]; vec.poly(q.flatMap(v2 => [v2.x, v2.y])).fill({ color: col, alpha: al }); };
      const pav = D ? 0x353c45 : 0x6a665e; rect(-L * .45, L * .45, off - tw / 2, off + tw / 2, pav); for (const a of [-L * .4, -L * .1, L * .2, L * .42]) rect(a - 12, a + 12, 22, off, pav);
      rect(-450, 250, off + 60, off + 380, pav, .9);   // ساحة
      for (let i = 0; i < 8; i++) { const a = -1200 + i * 110; rect(a - 22, a + 22, off + 470, off + 520, D ? 0x4a525c : 0x8a8478); rect(a - 6, a + 6, off + 410, off + 470, pav); }   // ملاجئ محصّنة
      for (const m of [-.47, .47]) for (let i = 0; i < 6; i++) rect(L * m - 4 + i * 8 * Math.sign(-m), L * m + 4 + i * 8 * Math.sign(-m), -18, 18, 0xffffff, .55);   // علامات العتبة
    }
  }
  // دوائر مدى الدفاع الجوي
  vec.circle(SITES.s400.x, SITES.s400.y, 120000).stroke({ width: 1.5 * px, color: 0xff7a5c, alpha: .5 }); vec.circle(SITES.pat.x, SITES.pat.y, 70000).stroke({ width: 1.5 * px, color: 0x8fd0ff, alpha: .5 });
}
const REFM = MAP.ref as number[], MPU = 40075016 * Math.cos(REFM[0] * Math.PI / 180);
function xy(la: number, lo: number) { const MX = (l: number) => (l + 180) / 360, MY = (a: number) => (1 - Math.log(Math.tan(Math.PI / 4 + a * Math.PI / 360)) / Math.PI) / 2; return { x: (MX(lo) - MX(REFM[1])) * MPU, y: -(MY(la) - MY(REFM[0])) * MPU }; }

// ===== أسماء ومسطرة =====
const txt = (size: number, bold = true): TextStyleOptions => ({ fontFamily: 'IBM Plex Sans Arabic, Tahoma, sans-serif', fontSize: size, fontWeight: bold ? '600' : '400', fill: DARK() ? '#e9eef3' : '#2b2620', stroke: { color: DARK() ? '#0b0f14' : '#f7f1e2', width: 4 } });
let cityTexts: { t: Text; dot: Graphics; p: { x: number; y: number }; big: boolean }[] = [], siteTexts: { t: Text; p: { x: number; y: number } }[] = [], labTheme = '';
let scaleG = new Graphics(), scaleT: Text;
function buildLabels() {
  labL.removeChildren(); cityTexts = []; siteTexts = []; labTheme = THEME;
  for (const c of (MAP as any).cities) { const big = c.pop > 400000, t = new Text({ text: c.n, style: txt(big ? 14 : 11.5) }); t.anchor.set(.5, 1); const dot = new Graphics(); dot.circle(0, 0, big ? 4 : 3).fill({ color: DARK() ? 0xffd27a : 0x3b342c }).stroke({ width: 1.5, color: DARK() ? 0x0b0f14 : 0xf7f1e2 }); labL.addChild(dot, t); cityTexts.push({ t, dot, p: { x: c.p[0], y: c.p[1] }, big }); }
  for (const [n, p] of [['قاعدة البصرة', SITES.base], ['S-400', SITES.s400], ['باتريوت', SITES.pat], ['ذو الفقار', SITES.zolf], ['أميدية', xy(30.83, 49.53)], ['وحدتي', xy(32.43, 48.40)]] as [string, { x: number; y: number }][]) { const t = new Text({ text: n, style: txt(11, false) }); t.anchor.set(.5, 0); labL.addChild(t); siteTexts.push({ t, p }); }
  scaleG = new Graphics(); scaleT = new Text({ text: '', style: txt(12) }); scaleT.anchor.set(0, .5); labL.addChild(scaleG, scaleT);
}
function updateLabels() {
  if (labTheme !== THEME) buildLabels();
  const showSmall = cam.w < 120000 && cam.w > 4000;
  for (const c of cityTexts) { const x = sx(c.p.x), y = sy(c.p.y), vis = (c.big || showSmall) && cam.w > 2500; c.t.visible = c.dot.visible = vis; c.t.position.set(x, y - 6); c.dot.position.set(x, y); }
  for (const s of siteTexts) { s.t.visible = cam.w > 8000; s.t.position.set(sx(s.p.x), sy(s.p.y) + 16 + 9 * Uof() * k); }
  const m = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].reduce((a, v) => v * k < SW * .28 ? v : a, 50);
  scaleG.clear().moveTo(14, SH - 96).lineTo(14 + m * k, SH - 96).stroke({ width: 3, color: DARK() ? 0xffffff : 0x222222 }); scaleT.text = m >= 1000 ? `${m / 1000} كم` : `${m} م`; scaleT.position.set(20 + m * k, SH - 96);
}

// ===== الوحدات =====
const LEN: Record<string, number> = { f16: 15.1, su25: 15.5, f14: 19.1, s400: 13.5, zolf: 13.2, patriot: 10.4, abrams: 9.8, t72: 9.5 };
interface USpr { s: Sprite; sh: Sprite; f: Sprite }
const uMap = new Map<string, USpr>();
function uspr(key: string, n: string, side: 0 | 1): USpr {
  let u = uMap.get(key); if (u) return u;
  const sh = new Sprite(T[n]); sh.anchor.set(.5); sh.tint = 0; sh.alpha = .25; const s = new Sprite(T[n]); s.anchor.set(.5); const f = new Sprite(FLAG[side]); f.anchor.set(.5);
  unitL.addChild(sh, s); flagL.addChild(f); u = { s, sh, f }; uMap.set(key, u); return u;
}
function drawUnit(key: string, n: string, side: 0 | 1, p: V3, hd: number, opt: { bank?: number; alpha?: number; roll?: number } = {}) {
  const u = uspr(key, n, side), U = Uof(), sc = LEN[n] * 1.18 * k * U / T[n].width, x = sx(p.x), y = sy(p.y);
  u.s.visible = u.sh.visible = u.f.visible = true;
  u.s.position.set(x, y); u.s.rotation = -hd + (opt.roll ?? 0); u.s.scale.set(sc, sc * (1 - Math.min(.3, Math.abs(opt.bank ?? 0) * .25))); u.s.alpha = opt.alpha ?? 1;
  const off = Math.min(60, p.z * k * .35 + (p.z > 5 ? 6 : 0));   // ظل الطيارة على الأرض يبعد حسب الارتفاع
  u.sh.visible = p.z > 5; u.sh.position.set(x + off, y + off * .6); u.sh.rotation = -hd; u.sh.scale.set(sc * .95);
  const fs = clamp(sc * T[n].width / 120, .4, .75); u.f.scale.set(fs); u.f.position.set(x + LEN[n] * .5 * k * U + 8, y - LEN[n] * .45 * k * U - 6);
}
function hideUnit(key: string) { const u = uMap.get(key); if (u) u.s.visible = u.sh.visible = u.f.visible = false; }

// ===== المؤثرات (بالعالم، متر) =====
interface Puff { x: number; y: number; r: number; gr: number; t: number; life: number; a: number; tint: number; s: Sprite; vx: number; vy: number; minPx: number }
interface Fx { x: number; y: number; t: number; life: number; size: number; minPx: number; kind: 'glow' | 'ex' | 'ring' | 'flare'; tint: number; vx: number; vy: number; s?: Sprite; g?: Graphics }
interface Trail { pts: { x: number; y: number; t: number }[]; r0: number; gr: number; life: number; a: number; dark: boolean; live: boolean }
const WIND = { x: 3.5, y: 1.2 };
let puffs: Puff[] = [], fxs: Fx[] = [], trails: Trail[] = [], mTrail = new Map<number, Trail>(), dTrail = new Map<object, Trail>();
function puff(p: { x: number; y: number }, r: number, gr: number, life: number, a: number, tint: number, minPx = 4, vx = 0, vy = 0) {
  if (puffs.length > 1400) { const o = puffs.shift()!; o.s.destroy(); }
  const s = new Sprite(CELLS[Math.floor(R(0, 64))]); s.anchor.set(.5); s.tint = tint; s.rotation = R(0, 6.28); smokeL.addChild(s); puffs.push({ x: p.x, y: p.y, r, gr, t: 0, life, a, tint, s, vx, vy, minPx });
}
function fx(kind: Fx['kind'], p: { x: number; y: number }, size: number, life: number, minPx: number, tint = 0xffffff, vx = 0, vy = 0) {
  const f: Fx = { x: p.x, y: p.y, t: 0, life, size, minPx, kind, tint, vx, vy };
  if (kind === 'ring') { f.g = new Graphics(); fxL.addChild(f.g); } else { f.s = new Sprite(kind === 'ex' ? EXF[0] : glowT); f.s.anchor.set(.5); if (kind !== 'ex') { f.s.blendMode = 'add'; f.s.tint = tint; } fxL.addChild(f.s); }
  fxs.push(f);
}
const smokeCol = () => DARK() ? 0xb8c4d0 : 0xffffff;
function blast(p: { x: number; y: number }, r: number, ground: boolean) {
  fx('glow', p, r * 3, .5, 46); fx('glow', p, r * 7, .9, 110, 0xff9a40); fx('ex', p, r * 2.2, 1.6, 40); fx('ring', p, r * 4, 1.1, 34);
  for (let i = 0; i < 14; i++) { const a = R(0, 6.28), d = R(.2, 1) * r; puff({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }, r * R(.4, .8), r * .05, R(14, 26), .6, ground ? 0x2a2622 : (DARK() ? 0x707a86 : 0x8a8a88), 8, Math.cos(a) * r * .02, Math.sin(a) * r * .02); }
}
let cap = { t: '', at: 0 };
function caption(t: string) { cap = { t, at: performance.now() }; const el = $('cap'); el.textContent = t; el.style.opacity = '1'; }
let killP: V3 | null = null, killT = -99, launchT = -99, pacT = -99, bmT = -99, landingT = -99;
function onEvent(e: { type: string; p: V3; id?: number; data?: any }) {
  const p = e.p;
  switch (e.type) {
    case 'takeoff': if (e.id === W.jets[0].id) caption('F-16 تقلع من قاعدة البصرة'); else caption('الطيارة الثانية تقلع وراها'); snd('jet_roar', p, 1, .9); break;
    case 'liftoff': for (let i = 0; i < 4; i++) puff(p, 12, 4, 6, .35, 0xd8cfbf, 3); break;
    case 's400_alert': caption('رادار S-400 لكط الطيارات — الأنابيب ترتفع'); break;
    case 'sam_eject': launchT = W.t; for (let i = 0; i < 10; i++) puff({ x: p.x + R(-6, 6), y: p.y + R(-6, 6) }, R(4, 8), 3, R(4, 7), .6, 0xffffff, 6); snd('woosh', p, .9, .7); caption('S-400: إطلاق بارد — الغاز يطرد الصاروخ لفوق'); break;
    case 'ignite': fx('glow', p, 40, .4, 30); for (let i = 0; i < 8; i++) puff(p, R(5, 9), 3, R(6, 10), .6, 0xffffff, 6); snd('launch', p, 1, .95); caption('اشتعل المحرك — الصاروخ يميل وينطلق'); break;
    case 'rwr_break': caption('F-16: إنذار! لفة حادة ونزول ومشاعل'); snd('sonic', p, .6); break;
    case 'rwr_notch': caption('الثانية تلف على جنب وتنزل حتى تعمي الرادار'); break;
    case 'cm': for (let i = 0; i < 4; i++) { const s2 = i % 2 ? 1 : -1, h = e.data.hd; fx('flare', p, 14, 3.5, 7, 0xffffff, -Math.cos(h) * 60 + Math.sin(h) * s2 * 45, -Math.sin(h) * 60 - Math.cos(h) * s2 * 45); } break;
    case 'kill_jet': killT = W.t; killP = { ...p }; blast(p, 60, false); snd('boom_big', p, 1, .9); caption('إصابة! الطيارة تولّع وتطيح… والطيار قفز بالمظلة'); break;
    case 'selfdestruct': fx('glow', p, 40, .4, 24); fx('ex', p, 30, 1, 22); if (e.data?.miss) caption(`الصاروخ فات الثانية بـ ${Math.round(e.data.miss)} م — نجت وراجعة للقاعدة`); snd('blast', p, .6); break;
    case 'crash': case 'debris_land': blast(p, 40, true); break;
    case 'bm_erect': caption('منصة ذو الفقار ترفع الصاروخ'); break;
    case 'bm_launch': bmT = W.t; fx('glow', p, 120, .9, 50); fx('ring', p, 160, 2.5, 40); for (let i = 0; i < 30; i++) { const a = R(0, 6.28), s2 = R(4, 14); puff({ x: p.x + Math.cos(a) * R(5, 25), y: p.y + Math.sin(a) * R(5, 25) }, R(10, 20), R(3, 6), R(20, 36), .7, i % 3 ? 0xc9b48e : 0xffffff, 8, Math.cos(a) * s2, Math.sin(a) * s2); } snd('rocket', p, 1, .6); snd('boom_far', p, .9, .7); caption('ذو الفقار انطلق — صاعد لـ 80 كم'); break;
    case 'pac_launch': pacT = W.t; fx('glow', p, 50, .5, 36); for (let i = 0; i < 16; i++) { const a = e.data.az + Math.PI + R(-.9, .9); puff({ x: p.x + Math.cos(a) * R(3, 16), y: p.y + Math.sin(a) * R(3, 16) }, R(6, 12), 3, R(10, 18), .65, i % 3 ? 0xffffff : 0xc9b48e, 8, Math.cos(a) * R(2, 8), Math.sin(a) * R(2, 8)); } snd('launch', p, 1, 1); caption('باتريوت PAC-3: إطلاق على الصاروخ النازل'); break;
    case 'kill_bm': killT = W.t; killP = { ...p }; blast(p, 220, false); fx('glow', p, 1500, 1.2, 160); snd('boom_huge', p, 1, .9); caption(`اعتراض! ضربة مباشرة على ارتفاع ${(p.z / 1000).toFixed(1)} كم`); break;
    case 'approach': caption('الطيارة الثانية وصلت — تصطف على المدرج'); landingT = W.t; break;
    case 'touchdown': caption('هبطت على المدرج'); for (let i = 0; i < 6; i++) puff(p, 6, 2, 4, .4, 0x555555, 3); break;
    case 'landed': caption('رجعت سالمة'); break;
  }
}
function fxStep(dt: number) {
  for (const m of W.msls) {
    const burning = m.kind === 'bm' ? m.t < W.bmPlan!.tb : m.ph === 'boost' || m.ph === 'eject';
    let tr = mTrail.get(m.id);
    if (burning && m.ph !== 'dead') { if (!tr) { tr = m.kind === 'bm' ? { pts: [], r0: 4, gr: 6, life: 70, a: .85, dark: false, live: true } : { pts: [], r0: 1.5, gr: 3.2, life: 40, a: .85, dark: false, live: true }; mTrail.set(m.id, tr); trails.push(tr); }
      const l = tr.pts[tr.pts.length - 1], sp = hyp(m.vel.x, m.vel.y); if (!l || hyp(m.p.x - l.x, m.p.y - l.y) > Math.max(6, sp * .04)) tr.pts.push({ x: m.p.x, y: m.p.y, t: W.t }); }
    else if (tr && tr.live) { tr.pts.push({ x: m.p.x, y: m.p.y, t: W.t }); tr.live = false; }
  }
  for (const d of W.debris) { if (!d.burn) continue; let tr = dTrail.get(d); if (!tr) { tr = { pts: [], r0: 2, gr: 4, life: 30, a: .65, dark: true, live: true }; dTrail.set(d, tr); trails.push(tr); } const l = tr.pts[tr.pts.length - 1]; if (!l || hyp(d.p.x - l.x, d.p.y - l.y) > 20) tr.pts.push({ x: d.p.x, y: d.p.y, t: W.t }); }
  for (const j of W.jets) if (j.st === 'hit' && Math.random() < dt * 20) puff(j.p, R(6, 12), R(3, 6), R(14, 22), .7, 0x2b2724, 4);
  trails = trails.filter(r => r.live || (r.pts.length && W.t - r.pts[r.pts.length - 1].t < r.life));
  for (const p of puffs) { p.t += dt; p.x += (WIND.x + p.vx) * dt; p.y += (WIND.y + p.vy) * dt; p.vx *= 1 - dt * .6; p.vy *= 1 - dt * .6; p.r += p.gr * dt / (1 + p.t * .2); }
  const dead = puffs.filter(p => p.t >= p.life); dead.forEach(p => p.s.destroy()); puffs = puffs.filter(p => p.t < p.life);
  for (const f of fxs) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.kind === 'flare') { f.vx *= 1 - dt * .6; f.vy *= 1 - dt * .6; let tr = dTrail.get(f); if (!tr) { tr = { pts: [], r0: .8, gr: 1.8, life: 10, a: .6, dark: false, live: true }; dTrail.set(f, tr); trails.push(tr); } const l = tr.pts[tr.pts.length - 1]; if (!l || hyp(f.x - l.x, f.y - l.y) > 6) tr.pts.push({ x: f.x, y: f.y, t: W.t }); if (f.t > f.life - .05) tr.live = false; } }
  const fd = fxs.filter(f => f.t >= f.life); fd.forEach(f => { f.s?.destroy(); f.g?.destroy(); }); fxs = fxs.filter(f => f.t < f.life);
}
function drawFx() {
  for (const p of puffs) { const q = p.t / p.life, a = p.a * Math.min(1, q * 8) * (1 - q); p.s.position.set(sx(p.x), sy(p.y)); p.s.width = p.s.height = Math.max(p.minPx, p.r * 2 * k) * 1.3; p.s.alpha = a; }
  for (const f of fxs) { const q = f.t / f.life, px = Math.max(f.minPx, f.size * k);
    if (f.kind === 'ring') { f.g!.clear().circle(sx(f.x), sy(f.y), px * q).stroke({ width: 2.5, color: 0xfff1d0, alpha: (1 - q) * .6 }); continue; }
    f.s!.position.set(sx(f.x), sy(f.y));
    if (f.kind === 'ex') { f.s!.texture = EXF[Math.min(24, Math.floor(q * 25))]; f.s!.width = f.s!.height = px; }
    else { f.s!.width = f.s!.height = px; f.s!.alpha = f.kind === 'flare' ? 1 - q * .7 : 1 - q; } }
  // خطوط الدخان: قطع من 5 نقاط، العرض يكبر والشفافية تقل مع العمر، وتمشي مع الريح
  trailsG.clear(); const sc = smokeCol();
  for (const r of trails) { const P = r.pts; if (P.length < 2) continue;
    for (let i0 = 0; i0 < P.length - 1; i0 += 4) { const i1 = Math.min(P.length - 1, i0 + 4), am = W.t - P[Math.floor((i0 + i1) / 2)].t; if (am > r.life) continue;
      const q = am / r.life, rad = r.r0 + r.gr * Math.sqrt(am), al = r.a * (1 - q) * (1 - q * .4);
      trailsG.moveTo(sx(P[i0].x + WIND.x * (W.t - P[i0].t)), sy(P[i0].y + WIND.y * (W.t - P[i0].t)));
      for (let i = i0 + 1; i <= i1; i++) trailsG.lineTo(sx(P[i].x + WIND.x * (W.t - P[i].t)), sy(P[i].y + WIND.y * (W.t - P[i].t)));
      trailsG.stroke({ width: Math.max(1.6, rad * 2 * k), color: r.dark ? 0x2d2925 : sc, alpha: al * .85, cap: 'round', join: 'round' }); } }
}
// الصاروخ: جسم بطوله الحقيقي × نسبة الوحدات، لهب، ورأس مضوي يبين من بعيد
const mG = new Graphics(); unitL.addChild(mG); const mGlow: Sprite[] = [];
function drawMissiles() {
  mG.clear(); let gi = 0; const U = Uof();
  for (const m of W.msls) { if (m.ph === 'dead') continue; const sp = hyp(m.vel.x, m.vel.y), ang = sp > 1 ? Math.atan2(m.vel.y, m.vel.x) : -Math.PI / 2, L = (m.kind === 'bm' ? 10.3 : m.kind === 'pac' ? 5.2 : 7.5) * k * U * .9, x = sx(m.p.x), y = sy(m.p.y);
    const burning = m.kind === 'bm' ? m.t < W.bmPlan!.tb : m.ph === 'boost';
    const cx = Math.cos(-ang), cy = Math.sin(-ang); const l = Math.max(10, L);
    mG.moveTo(x - cx * l / 2, y - cy * l / 2).lineTo(x + cx * l / 2, y + cy * l / 2).stroke({ width: Math.max(2.4, l * .1), color: m.kind === 'bm' ? 0xe9dcc0 : 0xf4f2ea, cap: 'round' });
    const g = mGlow[gi] ?? (() => { const s = new Sprite(glowT); s.anchor.set(.5); s.blendMode = 'add'; fxL.addChild(s); mGlow.push(s); return s; })(); gi++;
    g.visible = true; g.position.set(x - cx * l / 2, y - cy * l / 2); const gs = burning ? Math.max(26, l * 1.6) * R(.9, 1.1) : 16; g.width = g.height = gs; g.alpha = burning ? 1 : .5;
    if (m.kind === 'bm' && m.vel.z < -900 && m.p.z < 45000) { g.width = g.height = gs + (45000 - m.p.z) / 900; g.tint = 0xffc070; } else g.tint = 0xffffff; }
  for (; gi < mGlow.length; gi++) mGlow[gi].visible = false;
}

// ===== المخرج =====
interface Shot { id: string; x: number; y: number; w: number; ts: number }
const gp = (p: { x: number; y: number }) => ({ x: p.x, y: p.y });
function director(): Shot {
  const t = W.t, lead = W.lead, wing = W.wing, s4 = W.s400.p, B = SITES.base;
  const sam = W.msls.find(m => m.kind === 'sam' && m.ph !== 'dead'), pac = W.msls.find(m => m.kind === 'pac' && m.ph !== 'dead' && m.tgtMsl), bm = W.msls.find(m => m.kind === 'bm' && m.ph !== 'dead');
  if (t - killT < 6 && killP) return { id: 'kill' + Math.round(killT), x: killP.x, y: killP.y, w: W.phase === 'air' ? 5000 : 14000, ts: .7 };
  if (W.phase === 'air') {
    if (lead.st === 'roll' || lead.st === 'parked' || (lead.st === 'climb' && lead.p.z < 400)) return { id: 'takeoff', x: lead.p.x, y: lead.p.y, w: 3500, ts: 2.5 };
    if (sam) { const tj = W.jets.find(j => j.id === sam.tgtJet)!, d = hyp(tj.p.x - sam.p.x, tj.p.y - sam.p.y);
      if (sam.ph === 'eject' || t - launchT < 2.5) return { id: 'launch' + sam.id, x: s4.x, y: s4.y, w: 900, ts: .4 };
      if (d < 6000) return { id: 'term' + sam.id, x: (sam.p.x + tj.p.x) / 2, y: (sam.p.y + tj.p.y) / 2, w: Math.max(2500, d * 1.6), ts: d < 2000 ? .35 : .7 };
      return { id: 'fly' + sam.id, x: (sam.p.x + tj.p.x) / 2, y: (sam.p.y + tj.p.y) / 2, w: Math.max(6000, d * 1.4), ts: 1.5 }; }
    if (W.s400.raise > 0 && W.s400.raise < 1) return { id: 'raise', x: s4.x, y: s4.y, w: 1200, ts: 2 };
    if (W.s400.fired === 0) { const d = hyp(lead.p.x - s4.x, lead.p.y - s4.y); return d > 70000 ? { id: 'cruise', x: lead.p.x + 12000, y: lead.p.y + 6000, w: 60000, ts: 14 } : { id: 'appr', x: (lead.p.x + s4.x) / 2, y: (lead.p.y + s4.y) / 2, w: Math.max(30000, d * 1.3), ts: 6 }; }
    return { id: 'wing', x: wing.p.x, y: wing.p.y, w: 20000, ts: 4 };
  }
  // الباليستي
  const zp = W.zolf.p;
  if (pac) { const d = bm ? hyp(bm.p.x - pac.p.x, bm.p.y - pac.p.y) : 0;
    if (t - pacT < 2.6) return { id: 'pacl', x: W.pat.p.x, y: W.pat.p.y, w: 900, ts: .4 };
    if (bm && d < 9000) return { id: 'pact', x: (pac.p.x + bm.p.x) / 2, y: (pac.p.y + bm.p.y) / 2, w: Math.max(3000, d * 1.4), ts: d < 3000 ? .3 : .7 };
    return { id: 'pacf', x: pac.p.x, y: pac.p.y, w: 12000, ts: 1 }; }
  if (bm) { if (bm.t < 4) return { id: 'bml', x: zp.x, y: zp.y, w: 1500, ts: .5 }; if (bm.t < 26) return { id: 'bmb', x: bm.p.x, y: bm.p.y, w: clamp(1500 + bm.t * bm.t * 120, 1500, 60000), ts: 1.5 };
    return { id: 'bmm', x: (zp.x + SITES.basra.x) / 2, y: (zp.y + SITES.basra.y) / 2, w: 230000, ts: 12 }; }
  if (W.zolf.erect > 0 && !W.zolf.fired) return { id: 'erect', x: zp.x, y: zp.y, w: 1500, ts: 1.6 };
  if (wing.st === 'land' || wing.st === 'landed') { const d = hyp(wing.p.x - B.x, wing.p.y - B.y); return { id: 'land', x: (wing.p.x + B.x) / 2, y: (wing.p.y + B.y) / 2, w: Math.max(5000, d * 1.6), ts: wing.st === 'landed' ? 1 : 5 }; }
  return { id: 'wing2', x: wing.p.x, y: wing.p.y, w: 30000, ts: 10 };
}
let follow = true, fly: { x0: number; y0: number; w0: number; t: number; d: number } | null = null, shotId = '';
function setFollow(on: boolean) { follow = on; $('bFollow').setAttribute('aria-pressed', String(on)); if (on) shotId = ''; }
function camUpdate(sh: Shot, rdt: number) {
  if (!follow) return;
  if (sh.id !== shotId) { const d = hyp(sh.x - cam.x, sh.y - cam.y); if (shotId && d > Math.max(cam.w, sh.w) * .8) fly = { x0: cam.x, y0: cam.y, w0: cam.w, t: 0, d: clamp(.9 + Math.log10(d / Math.min(cam.w, sh.w) + 1) * .5, .9, 2.4) }; shotId = sh.id; }
  if (fly) { fly.t += rdt; const u = clamp(fly.t / fly.d, 0, 1), e = u * u * (3 - 2 * u), dist = hyp(sh.x - fly.x0, sh.y - fly.y0), l0 = Math.log(fly.w0), l1 = Math.log(sh.w), bump = Math.max(0, Math.log(dist * 1.3) - Math.max(l0, l1));
    cam.x = lerp(fly.x0, sh.x, e); cam.y = lerp(fly.y0, sh.y, e); cam.w = Math.exp(lerp(l0, l1, e) + bump * Math.sin(Math.PI * e)); if (u >= 1) fly = null; return; }
  const a = 1 - Math.exp(-rdt * 3), z = 1 - Math.exp(-rdt * 2.4); cam.x = lerp(cam.x, sh.x, a); cam.y = lerp(cam.y, sh.y, a); cam.w = Math.exp(lerp(Math.log(cam.w), Math.log(sh.w), z));
}

// ===== الإصبع =====
const ptrs = new Map<number, { x: number; y: number }>(); let pinch0 = 0, w0 = 0;
app.canvas.addEventListener('pointerdown', e => { app.canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, c] = [...ptrs.values()]; pinch0 = hyp(a.x - c.x, a.y - c.y); w0 = cam.w; } setFollow(false); });
app.canvas.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; if (ptrs.size === 1) { cam.x -= (e.clientX - p.x) / k; cam.y += (e.clientY - p.y) / k; } p.x = e.clientX; p.y = e.clientY; if (ptrs.size === 2) { const [a, c] = [...ptrs.values()], d = hyp(a.x - c.x, a.y - c.y); if (pinch0) cam.w = clamp(w0 * pinch0 / d, 600, 400000); } });
const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; };
app.canvas.addEventListener('pointerup', up); app.canvas.addEventListener('pointercancel', up);
app.canvas.addEventListener('wheel', e => { e.preventDefault(); setFollow(false); cam.w = clamp(cam.w * Math.exp(e.deltaY * .0015), 600, 400000); }, { passive: false });

// ===== الصوت =====
let ac: AudioContext | null = null, master: GainNode; const smp: Record<string, AudioBuffer> = {}; let muted = false, act = 0;
const sndUrls = { ...import.meta.glob('../../theater/sounds/{launch,rocket,boom_big,boom_far,boom_mid,incoming}.mp3', { query: '?url', import: 'default', eager: true }), ...import.meta.glob('../../battle-classic/sounds/{jet_roar,woosh,boom_huge,blast,sonic}.mp3', { query: '?url', import: 'default', eager: true }) } as Record<string, string>;
function audio() { try { if (!ac) { ac = new AudioContext(); master = ac.createGain(); master.gain.value = .9; master.connect(ac.createDynamicsCompressor()).connect(ac.destination); const a = ac; for (const [kk, u] of Object.entries(sndUrls)) fetch(u).then(r => r.arrayBuffer()).then(bb => a.decodeAudioData(bb)).then(buf => { smp[kk.split('/').pop()!.replace('.mp3', '')] = buf; }).catch(() => {}); } if (ac.state === 'suspended') ac.resume(); } catch { /* */ } }
let curTs = 1;
function snd(n: string, p: V3, v: number, rate = 1) {
  if (!ac || !smp[n] || muted || act > 14) return; const d = hyp(p.x - cam.x, p.y - cam.y), dEff = hyp(d, cam.w * .4), delay = Math.min(2.5, d / 343) / Math.max(.4, curTs * speed), gain = v / (1 + dEff / 2500); if (gain < .03) return;
  const s = ac.createBufferSource(); s.buffer = smp[n]; s.playbackRate.value = rate * clamp(curTs * speed, .6, 1); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(18000 / (1 + dEff / 4000), 600, 18000);
  const gn = ac.createGain(); gn.gain.value = gain; const pan = ac.createStereoPanner(); pan.pan.value = clamp((p.x - cam.x) / cam.w * 1.4, -.8, .8); s.connect(lp).connect(gn).connect(pan).connect(master); s.start(ac.currentTime + delay); act++; s.onended = () => act--;
}

// ===== الحلقة =====
let W = new World(7), speed = 1, paused = false, running = false, ended = false;
function reset() { W = new World(7); for (const p of puffs) p.s.destroy(); for (const f of fxs) { f.s?.destroy(); f.g?.destroy(); } puffs = []; fxs = []; trails = []; mTrail = new Map(); dTrail = new Map(); killT = launchT = pacT = bmT = landingT = -99; killP = null; ended = false; shotId = ''; fly = null; uMap.forEach(u => { u.s.destroy(); u.sh.destroy(); u.f.destroy(); }); uMap.clear(); }
function start() { reset(); const s = director(); cam.x = s.x; cam.y = s.y; cam.w = s.w; setFollow(true); running = true; $('start').hidden = true; $('ui').hidden = false; $('end').hidden = true; audio(); }
function stepSim(simDt: number) { let left = simDt, n = 0; while (left > 1e-6 && n < 2500) { const d = Math.min(.02, left); left -= d; n++; W.step(d); fxStep(d); for (const e of W.ev.splice(0)) onEvent(e); } }
function render() {
  SW = app.screen.width; SH = app.screen.height; k = SW / cam.w;
  updateMap(); updateLabels();
  const j0 = W.jets[0], j1 = W.jets[1];
  for (const [i, j] of [[0, j0], [1, j1]] as [number, typeof j0][]) { if (j.st === 'gone') hideUnit('j' + i); else drawUnit('j' + i, 'f16', 0, j.p, j.hd, { bank: j.bank, roll: j.st === 'hit' ? Math.sin(j.roll) * .5 : 0, alpha: j.st === 'hit' ? .85 : 1 }); }
  drawUnit('s400', 's400', 1, W.s400.p, .35); drawUnit('s400b', 's400', 1, { x: W.s400.p.x + 180, y: W.s400.p.y - 120, z: 0 }, .35); drawUnit('s400c', 's400', 1, { x: W.s400.p.x - 160, y: W.s400.p.y + 140, z: 0 }, .2);
  drawUnit('pat', 'patriot', 0, W.pat.p, .9); drawUnit('pat2', 'patriot', 0, { x: W.pat.p.x + 150, y: W.pat.p.y + 90, z: 0 }, .9); drawUnit('zolf', 'zolf', 1, W.zolf.p, 3.6);
  drawUnit('t1', 't72', 1, { ...xy(31.15, 48.35), z: 0 }, 3.3); drawUnit('t2', 't72', 1, { ...xy(31.14, 48.36), z: 0 }, 3.2); drawUnit('a1', 'abrams', 0, { ...xy(31.0, 47.62), z: 0 }, .2); drawUnit('a2', 'abrams', 0, { ...xy(30.99, 47.63), z: 0 }, .1);
  drawMissiles(); drawFx();
  if (W.chute) { const x = sx(W.chute.p.x), y = sy(W.chute.p.y); chuteG.clear().circle(x, y, Math.max(5, 7 * k * Uof())).fill({ color: 0xf2efe6 }).stroke({ width: 1, color: 0x333333, alpha: .5 }); } else chuteG.clear();
  hud();
}
const chuteG = new Graphics(); unitL.addChild(chuteG);
function hud() {
  if (performance.now() - cap.at > 4500) $('cap').style.opacity = '0';
  const sam = W.msls.find(m => m.ph !== 'dead' && m.kind !== 'bm' && (m.tgtJet || m.tgtMsl)), bm = W.msls.find(m => m.kind === 'bm' && m.ph !== 'dead'), o: Msl | undefined = sam ?? bm; let t = '';
  if (o) { const sp = hyp(o.vel.x, o.vel.y, o.vel.z); t = `${o.kind === 'bm' ? 'ذو الفقار' : o.kind === 'pac' ? 'PAC-3' : '48N6 (S-400)'} · ارتفاع ${(o.p.z / 1000).toFixed(1)} كم · ${Math.round(sp)} م/ث (ماخ ${(sp / 300).toFixed(1)})`; }
  else { const j = W.jets.find(q => q.st !== 'gone' && q.st !== 'landed' && q.st !== 'parked'); if (j) t = `F-16 · ارتفاع ${(j.p.z / 1000).toFixed(1)} كم · ${Math.round(j.spd * 3.6)} كم/س`; }
  $('read').textContent = t; $('slow').hidden = !(follow && curTs < .9); $('fast').hidden = !(follow && curTs > 3); if (follow && curTs > 3) $('fast').textContent = `تسريع ×${Math.round(curTs * speed)}`;
}
app.ticker.add(tk => {
  const rdt = Math.min(.05, tk.deltaMS / 1000);
  if (running && !paused) { const sh = director(); curTs = follow ? sh.ts : 1; stepSim(rdt * curTs * speed); camUpdate(director(), rdt);
    if (W.wing.st === 'landed' && W.phase === 'bm' && W.endT > 0 && W.t > W.endT + 4 && !ended) { ended = true; $('end').hidden = false; } }
  else if (running) camUpdate(director(), 0);
  if (mapSpr || running) render();
});
// ===== الأزرار =====
const themeBtn = () => { $('bTheme').textContent = DARK() ? '🌙' : '☀️'; app.renderer.background.color = DARK() ? 0x0d1218 : 0xcfc3a4; bloom.bloomScale = DARK() ? 1.6 : 1; };
const sizeBtn = () => { $('bSize').textContent = ['حجم ١', 'حجم ٢', 'حجم ٣'][SIZE]; };
$('bTheme').onclick = () => { THEME = DARK() ? 'light' : 'dark'; try { localStorage.setItem('td_theme', THEME); } catch { /* */ } themeBtn(); };
$('bSize').onclick = () => { SIZE = (SIZE + 1) % 3; try { localStorage.setItem('td_size', String(SIZE)); } catch { /* */ } sizeBtn(); };
$('bFollow').onclick = () => setFollow(!follow);
$('bPause').onclick = () => { paused = !paused; $('bPause').textContent = paused ? '▶' : '⏸'; };
document.querySelectorAll<HTMLButtonElement>('#spd button').forEach(bt => bt.onclick = () => { speed = +bt.dataset.s!; document.querySelectorAll('#spd button').forEach(x => x.setAttribute('aria-pressed', String(x === bt))); });
$('bMute').onclick = () => { muted = !muted; $('bMute').textContent = muted ? '🔇' : '🔊'; if (ac) muted ? ac.suspend() : ac.resume(); };
$('bGo').onclick = start; $('bAgain').onclick = start;
themeBtn(); sizeBtn();
let nl = 0; await loadAll(s => { nl++; $('load').textContent = `يحمّل ${s}… ${nl}`; if (LITE) console.log('load', nl, s); }); $('load').textContent = ''; ($('bGo') as HTMLButtonElement).disabled = false; $('bGo').textContent = 'ابدأ';
buildLabels(); { const s = director(); cam.x = s.x; cam.y = s.y; cam.w = 220000; } render();
if (AUTO) { start(); (window as any).ready = true; }
// للفحص: يقدّم المحاكاة لوقت معين ويثبّت الكاميرا على لقطة المخرج
(window as any).seek = (t: number) => { while (W.t < t - 1e-4) stepSim(Math.min(5, t - W.t)); const sh = director(); shotId = sh.id; fly = null; cam.x = sh.x; cam.y = sh.y; cam.w = sh.w; curTs = sh.ts; render(); app.render(); };
(window as any).opts = (th: string, sz: number) => { THEME = th as any; SIZE = sz; themeBtn(); sizeBtn(); render(); app.render(); };
(window as any).W = () => W;
(window as any).freeze = () => app.ticker.stop();
