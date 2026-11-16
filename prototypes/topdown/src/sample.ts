// عيّنة الشكل (WM8.1، D-032): من فوق، خريطة مرسومة بثيمين، مجسمات Blender، مؤثرات بكرت الشاشة (PixiJS + توهج)
// ?view=far|mid|close&theme=light|dark — مشهد ثابت للحكم على الشكل قبل البناء
import { Application, Assets, Container, Graphics, Sprite, Text, Texture, Rectangle, TilingSprite } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import MAP from './mapdata.json';
import BASE from '../textures/basemap.json';

const q = new URLSearchParams(location.search), VIEW = q.get('view') || 'far', THEME = (q.get('theme') || 'light') as 'light' | 'dark';
const DARK = THEME === 'dark';
const REF = MAP.ref as number[], MPU = 40075016 * Math.cos(REF[0] * Math.PI / 180);
const MX = (lo: number) => (lo + 180) / 360, MY = (la: number) => (1 - Math.log(Math.tan(Math.PI / 4 + la * Math.PI / 360)) / Math.PI) / 2;
const P = (la: number, lo: number) => ({ x: (MX(lo) - MX(REF[1])) * MPU, y: -(MY(la) - MY(REF[0])) * MPU });
const R = (a: number, b: number) => a + Math.random() * (b - a);
let seed = 5; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };   // نفس العيّنة كل مرة

const SW = innerWidth, SH = innerHeight;
const VIEWS: Record<string, { c: { x: number; y: number }; w: number }> = {
  far: { c: P(31.25, 48.05), w: 190000 }, mid: { c: P(31.36, 48.66), w: 30000 }, close: { c: P(31.305, 48.785), w: 3400 },
};
const V = VIEWS[VIEW], k = SW / V.w;
const sx = (x: number) => (x - V.c.x) * k + SW / 2, sy = (y: number) => -(y - V.c.y) * k + SH / 2;
// مقياس الوحدات: كلها نفس النسبة (الحجم الحقيقي × U) حتى الطيارة 15 م ما تقل عن ~34 بكسل
const U = Math.max(1, (VIEW === 'close' ? 50 : VIEW === 'mid' ? 40 : 30) / (15 * k));   // المؤثرات بحجمها الحقيقي (حد أدنى بالبكسل بس)

const app = new Application();
await app.init({ width: SW, height: SH, background: DARK ? '#0d1218' : '#cfc3a4', antialias: true, resolution: Math.min(2, devicePixelRatio), autoDensity: true, preference: 'webgl' });
document.body.appendChild(app.canvas);
const world = new Container(), vec = new Graphics(), units = new Container(), smoke = new Container(), fx = new Container(), labels = new Container();
app.stage.addChild(world, vec, smoke, units, fx, labels);
fx.filters = [new AdvancedBloomFilter({ threshold: .35, bloomScale: DARK ? 1.6 : 1.1, brightness: 1.1, blur: 8, quality: 6 })];

// ===== الخريطة: نسيج الأساس المرسوم + خطوط حادة =====
const b = BASE.b as number[];
const lvl = V.w > 90000 ? 0 : 1;
const mapTex = await Assets.load(new URL(`../textures/map_${THEME}_${lvl}.webp`, import.meta.url).href);
const map = new Sprite(mapTex); map.position.set(sx(b[0]), sy(b[1])); map.width = (b[2] - b[0]) * k; map.height = (b[1] - b[3]) * k; world.addChild(map);
// حبيبات خفيفة من قريب حتى ما تبين ضبابية
if (V.w < 60000) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!; for (let i = 0; i < 9000; i++) { const v = Math.random() < .5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${Math.random() * .07})`; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  const ts = new TilingSprite({ texture: Texture.from(c), width: SW, height: SH }); ts.alpha = DARK ? .5 : .8; world.addChild(ts); }
const line = (pts: number[], w: number, color: number, alpha = 1) => { vec.moveTo(sx(pts[0]), sy(pts[1])); for (let i = 2; i < pts.length; i += 2) vec.lineTo(sx(pts[i]), sy(pts[i + 1])); vec.stroke({ width: w, color, alpha, cap: 'round', join: 'round' }); };
const RIV = DARK ? 0x3aa6e0 : 0x4f8fbf, ROAD = DARK ? 0x6e7681 : 0x8a7a63, BORD = DARK ? 0xe8edf2 : 0x3b3530;
for (const r of MAP.roads) line(r.p, Math.max(1, 1.2 + 60 * k), ROAD, DARK ? .7 : .75);
for (const r of MAP.rivers) { line(r.p, Math.max(1.6, 2.2 + 140 * k), DARK ? 0x0b2c45 : 0xe9f2f6, .9); line(r.p, Math.max(1.1, 1.4 + 110 * k), RIV, 1); }
for (const l of MAP.borders) { line(l, 5, DARK ? 0x9fd6ff : 0xffffff, .35); line(l, 1.6, BORD, .85); }

// ===== الأصول =====
const tex = async (n: string) => Assets.load(new URL(`../sprites/${n}.png`, import.meta.url).href) as Promise<Texture>;
const T: Record<string, Texture> = {}; for (const n of ['f16', 'su25', 'f14', 's400', 'zolf', 'patriot', 'abrams', 't72']) T[n] = await tex(n);
const cloud = await Assets.load(new URL('../../theater/textures/fx_cloud.webp', import.meta.url).href) as Texture;
const explo = await Assets.load(new URL('../../theater/textures/fx_explo1.webp', import.meta.url).href) as Texture;
const cell = (i: number) => new Texture({ source: cloud.source, frame: new Rectangle((i % 8) * 128, Math.floor(i / 8) * 128, 128, 128) });
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!, g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,245,1)'); g.addColorStop(.15, 'rgba(255,230,170,.95)'); g.addColorStop(.4, 'rgba(255,150,60,.35)'); g.addColorStop(1, 'rgba(255,110,30,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return Texture.from(c); })();
const flagTex = (side: 0 | 1) => { const c = document.createElement('canvas'); c.width = 36; c.height = 24; const x = c.getContext('2d')!; (side ? ['#239f40', '#ffffff', '#da0000'] : ['#ce1126', '#ffffff', '#111111']).forEach((col, i) => { x.fillStyle = col; x.fillRect(0, i * 8, 36, 8); }); if (!side) { x.fillStyle = '#007a3d'; x.fillRect(10, 10, 16, 4); } else { x.fillStyle = '#da0000'; x.beginPath(); x.arc(18, 12, 3, 0, 7); x.fill(); } x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 2; x.strokeRect(1, 1, 34, 22); return Texture.from(c); };
const FLAG = [flagTex(0), flagTex(1)];

// ===== أدوات الرسم =====
const LEN: Record<string, number> = { f16: 15.1, su25: 15.5, f14: 19.1, s400: 13.5, zolf: 13.2, patriot: 10.4, abrams: 9.8, t72: 9.5 };
function unit(n: string, p: { x: number; y: number }, hd: number, side: 0 | 1, alt = 0) {
  const t = T[n], s = LEN[n] * 1.18 * k * U / t.width;   // الصورة = الطول × 1.18
  if (alt > 0) { const sh = new Sprite(t); sh.anchor.set(.5); sh.tint = 0x000000; sh.alpha = .22; sh.scale.set(s * .95); sh.rotation = -hd; sh.position.set(sx(p.x) + alt * k * .00035 * U * 40 + 10, sy(p.y) + 14); units.addChild(sh); }
  const sp = new Sprite(t); sp.anchor.set(.5); sp.scale.set(s); sp.rotation = -hd; sp.position.set(sx(p.x), sy(p.y)); units.addChild(sp);
  const f = new Sprite(FLAG[side]); f.anchor.set(.5); const fs = Math.max(.42, Math.min(.7, s * t.width / 110)); f.scale.set(fs); f.position.set(sx(p.x) + LEN[n] * .5 * k * U + 6, sy(p.y) - LEN[n] * .45 * k * U - 4); labels.addChild(f);
  return sp;
}
function puff(p: { x: number; y: number }, r: number, a: number, tint: number, minPx = 4, i = Math.floor(R(0, 64))) { const s = new Sprite(cell(i)); s.anchor.set(.5); s.position.set(sx(p.x), sy(p.y)); s.width = s.height = Math.max(minPx, r * 2 * k); s.alpha = a; s.tint = tint; s.rotation = R(0, 6.28); smoke.addChild(s); }
function glow(p: { x: number; y: number }, px: number, a = 1, tint = 0xffffff) { const s = new Sprite(glowTex); s.anchor.set(.5); s.blendMode = 'add'; s.position.set(sx(p.x), sy(p.y)); s.width = s.height = px; s.alpha = a; s.tint = tint; fx.addChild(s); }
// خط صاروخ: منحنى (بيزيه) من البداية للرأس؛ دخان يكبر ويخف لورا، خط رفيع مضوي قرب الرأس، رأس مضوي
function missile(a: { x: number; y: number }, c: { x: number; y: number }, h: { x: number; y: number }, opt: { r0: number; r1: number; a0: number; head: number; col?: number }) {
  const N = 70, pts: { x: number; y: number }[] = []; for (let i = 0; i <= N; i++) { const t = i / N, u = 1 - t; pts.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * h.x, y: u * u * a.y + 2 * u * t * c.y + t * t * h.y }); }
  const smokeC = DARK ? 0xb8c4d0 : 0xffffff;
  // خط ناعم أساسي (يبين حتى من بعيد)
  for (let i = 1; i <= N; i++) { const t = i / N; vec.moveTo(sx(pts[i - 1].x), sy(pts[i - 1].y)); vec.lineTo(sx(pts[i].x), sy(pts[i].y)); vec.stroke({ width: Math.max(2.2 + 3 * (1 - t), (opt.r1 + (opt.r0 - opt.r1) * t) * 2 * k * .7), color: smokeC, alpha: opt.a0 * (.25 + .7 * t), cap: 'round' }); }
  for (let i = 0; i <= N; i += 2) { const t = i / N; puff(pts[i], opt.r1 + (opt.r0 - opt.r1) * t, opt.a0 * (.12 + .45 * t), smokeC, 5 + 6 * (1 - t)); }
  const last = pts[N], prev = pts[N - 3], ang = Math.atan2(-(last.y - prev.y), last.x - prev.x);
  const fl = new Graphics(); const L = opt.head * 1.6; fl.moveTo(0, 0).lineTo(-L, -L * .18).lineTo(-L * 1.6, 0).lineTo(-L, L * .18).closePath().fill({ color: 0xffd28a, alpha: .9 }); fl.position.set(sx(last.x), sy(last.y)); fl.rotation = ang; fl.blendMode = 'add'; fx.addChild(fl);
  glow(last, opt.head * 2.6, 1); glow(last, opt.head * 6, .5, 0xffb060);
  const body = new Graphics(); body.rect(-opt.head * .55, -1.5, opt.head * 1.1, 3).fill({ color: 0xf4f2ea }); body.position.set(sx(last.x), sy(last.y)); body.rotation = ang; units.addChild(body);
}
function contrail(pts: { x: number; y: number }[], w: number) { for (let i = 1; i < pts.length; i++) { const t = i / pts.length; vec.moveTo(sx(pts[i - 1].x), sy(pts[i - 1].y)); vec.lineTo(sx(pts[i].x), sy(pts[i].y)); vec.stroke({ width: w * (1.6 - t), color: 0xffffff, alpha: (DARK ? .35 : .55) * t, cap: 'round' }); } }
function blast(p: { x: number; y: number }, r: number, air: boolean) {
  glow(p, Math.max(46, r * 3 * k), 1); glow(p, Math.max(110, r * 7 * k), .45, 0xff9a40);
  const ex = new Sprite(new Texture({ source: explo.source, frame: new Rectangle(400, 200, 200, 200) })); ex.anchor.set(.5); ex.position.set(sx(p.x), sy(p.y)); ex.width = ex.height = Math.max(40, r * 2.2 * k); fx.addChild(ex);
  const ring = new Graphics(); ring.circle(sx(p.x), sy(p.y), Math.max(34, r * 4 * k)).stroke({ width: 3, color: 0xfff1d0, alpha: .55 }); fx.addChild(ring);
  for (let i = 0; i < 16; i++) { const a = R(0, 6.28), d = R(.2, 1.2) * r; puff({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }, r * R(.5, .9), .55, air ? (DARK ? 0x707a86 : 0x8a8a88) : 0x2a2622, 10); }
  if (!air) for (let i = 0; i < 14; i++) puff({ x: p.x + i * r * .35 + R(-r * .2, r * .2), y: p.y - i * r * .12 }, r * (.6 + i * .12), .55 - i * .03, 0x2b2724, 8 + i * 1.5);   // عمود دخان مع الريح
}
function label(t: string, p: { x: number; y: number }, size: number, a = 1, dy = -14) {
  const tx = new Text({ text: t, style: { fontFamily: 'IBM Plex Sans Arabic, Tahoma, sans-serif', fontSize: size, fontWeight: '600', fill: DARK ? '#e9eef3' : '#2b2620', stroke: { color: DARK ? '#0b0f14' : '#f7f1e2', width: 4 } } });
  tx.anchor.set(.5); tx.alpha = a; tx.position.set(sx(p.x), sy(p.y) + dy); labels.addChild(tx);
}
function site(p: { x: number; y: number }, ring: number, side: 0 | 1) { const g = new Graphics(); g.circle(sx(p.x), sy(p.y), ring * k).stroke({ width: 1.5, color: side ? 0xff7a5c : 0x8fd0ff, alpha: .55 }); g.circle(sx(p.x), sy(p.y), ring * k).fill({ color: side ? 0xff7a5c : 0x8fd0ff, alpha: .05 }); vec.addChild(g); }
function runway(p: { x: number; y: number }, hd: number, side: 0 | 1, name: string) {
  const L = Math.max(46, 3200 * k), g = new Graphics(); g.rect(-L / 2, -Math.max(4, 50 * k), L, Math.max(8, 100 * k)).fill({ color: DARK ? 0x2a3038 : 0x55524c }); g.moveTo(-L / 2 + 6, 0).lineTo(L / 2 - 6, 0).stroke({ width: 1, color: 0xffffff, alpha: .7 });
  g.position.set(sx(p.x), sy(p.y)); g.rotation = -hd; vec.addChild(g); const f = new Sprite(FLAG[side]); f.anchor.set(.5); f.scale.set(.6); f.position.set(sx(p.x) - L / 2 - 14, sy(p.y) - 8); labels.addChild(f); label(name, p, 11, .9, 18);
}

// ===== المشهد =====
const S400 = P(31.30, 48.80), PAT = P(30.58, 47.72), ZOLF = P(32.42, 48.45), OMID = P(30.83, 49.53), VAHD = P(32.43, 48.40), BASRA_AB = P(30.55, 47.66);
for (const c of (MAP as any).cities) { const big = c.pop > 400000; if (V.w < 60000 && !big && VIEW !== 'mid') continue; const g = new Graphics(); g.circle(sx(c.p[0]), sy(c.p[1]), big ? 4 : 3).fill({ color: DARK ? 0xffd27a : 0x3b342c }).stroke({ width: 1.5, color: DARK ? 0x0b0f14 : 0xf7f1e2 }); vec.addChild(g); if (DARK) glow({ x: c.p[0], y: c.p[1] }, big ? 60 : 30, .5, 0xffb050); label(c.n, { x: c.p[0], y: c.p[1] }, big ? 14 : 11.5); }
runway(BASRA_AB, .3, 0, 'قاعدة البصرة'); runway(OMID, .2, 1, 'أميدية'); runway(VAHD, -.4, 1, 'وحدتي');
site(S400, 120000, 1); site(PAT, 70000, 0);
unit('s400', S400, .35, 1); unit('patriot', PAT, .9, 0); unit('zolf', ZOLF, 3.6, 1);
if (VIEW !== 'far') { unit('s400', { x: S400.x + 70 * U, y: S400.y - 40 * U }, .35, 1); unit('s400', { x: S400.x - 60 * U, y: S400.y + 50 * U }, .2, 1); }
// طيارتين F-16 داخلات، وصاروخ S-400 طالع عليهن (بعدهن بعيد بالبعيد، قريب بالمتوسط)
const lead = VIEW === 'close' ? { x: S400.x - 1100, y: S400.y + 700 } : VIEW === 'mid' ? { x: S400.x - 11000, y: S400.y + 5000 } : { x: S400.x - 52000, y: S400.y + 9000 };
const wing = { x: lead.x - (VIEW === 'far' ? 3500 : VIEW === 'mid' ? 1500 : 260), y: lead.y - (VIEW === 'far' ? 2500 : VIEW === 'mid' ? 900 : 180) };
contrail(Array.from({ length: 40 }, (_, i) => ({ x: lead.x - (40 - i) * (VIEW === 'far' ? 900 : VIEW === 'mid' ? 220 : 40), y: lead.y - (40 - i) * (VIEW === 'far' ? 120 : 30) * (VIEW === 'close' ? .2 : 1) })), 2.2);
contrail(Array.from({ length: 40 }, (_, i) => ({ x: wing.x - (40 - i) * (VIEW === 'far' ? 900 : VIEW === 'mid' ? 220 : 40), y: wing.y - (40 - i) * (VIEW === 'far' ? 120 : 30) * (VIEW === 'close' ? .2 : 1) })), 2.2);
unit('f16', lead, .14, 0, 6000); unit('f16', wing, .14, 0, 6000);
const mHead = VIEW === 'close' ? { x: S400.x - 520, y: S400.y + 240 } : VIEW === 'mid' ? { x: lead.x + 3600, y: lead.y - 1500 } : { x: lead.x + 14000, y: lead.y - 2500 };
missile(S400, { x: (S400.x + mHead.x) / 2 + (VIEW === 'close' ? 0 : 2000), y: (S400.y + mHead.y) / 2 - (VIEW === 'close' ? 120 : 4000) }, mHead, { r0: VIEW === 'close' ? 3 : 6, r1: VIEW === 'close' ? 14 : 60, a0: .9, head: VIEW === 'close' ? 26 : 16 });
if (VIEW === 'close') { for (let i = 0; i < 18; i++) puff({ x: S400.x + R(-40, 60), y: S400.y + R(-30, 30) }, R(10, 22), .5, 0xd8cfbf, 14); for (let i = 0; i < 6; i++) { const a = R(0, 6.28); const fl = { x: lead.x - 120 - i * 60, y: lead.y + Math.sin(a) * 90 }; glow(fl, 14, .9); } }
if (VIEW !== 'close') {
  // F-14 إيرانية من أميدية للاعتراض
  const f14a = VIEW === 'far' ? { x: OMID.x - 26000, y: OMID.y + 15000 } : { x: S400.x + 9000, y: S400.y + 7000 };
  contrail(Array.from({ length: 30 }, (_, i) => ({ x: f14a.x + (30 - i) * (VIEW === 'far' ? 800 : 200), y: f14a.y - (30 - i) * (VIEW === 'far' ? 450 : 100) })), 2);
  unit('f14', f14a, 2.6, 1, 7000);
}
if (VIEW === 'far') {
  // باليستي من دزفول للبصرة واعتراض باتريوت بالجو + ضربة سابقة على قاعدة البصرة تحترق
  const ic = { x: PAT.x + 14000, y: PAT.y + 26000 };
  missile(ZOLF, { x: (ZOLF.x + ic.x) / 2 - 9000, y: (ZOLF.y + ic.y) / 2 + 8000 }, { x: ic.x + 6000, y: ic.y + 15000 }, { r0: 30, r1: 140, a0: .8, head: 18 });
  missile(PAT, { x: PAT.x + 2000, y: PAT.y + 12000 }, { x: ic.x - 800, y: ic.y - 1500 }, { r0: 15, r1: 80, a0: .85, head: 14 });
  missile(PAT, { x: PAT.x + 4500, y: PAT.y + 9000 }, { x: ic.x - 3000, y: ic.y - 5000 }, { r0: 15, r1: 80, a0: .85, head: 12 });
  blast({ x: ic.x + 5200, y: ic.y + 13500 }, 1400, true);
  blast({ x: BASRA_AB.x + 1500, y: BASRA_AB.y + 600 }, 900, false);
}
if (VIEW === 'mid') {
  unit('abrams', { x: S400.x - 13000, y: S400.y - 9000 }, 0, 0); unit('abrams', { x: S400.x - 12000, y: S400.y - 10200 }, 0, 0); unit('t72', { x: S400.x - 7000, y: S400.y - 8800 }, 3.14, 1);
  blast({ x: S400.x - 7400, y: S400.y - 8300 }, 220, false);
}
// إطار المسطرة
const k1 = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].reduce((a, m) => m * k < SW * .3 ? m : a, 100);
const sb = new Graphics(); sb.moveTo(14, SH - 40).lineTo(14 + k1 * k, SH - 40).stroke({ width: 3, color: DARK ? 0xffffff : 0x222222 }); labels.addChild(sb); label(k1 >= 1000 ? `${k1 / 1000} كم` : `${k1} م`, { x: V.c.x + (14 + k1 * k / 2 - SW / 2) / k, y: V.c.y - (SH - 40 - SH / 2) / k }, 12, 1, -12);
const tag = new Text({ text: { far: 'من بعيد (~190 كم)', mid: 'متوسط (~30 كم)', close: 'قريب (~6 كم)' }[VIEW]! + (DARK ? ' · غامق' : ' · فاتح'), style: { fontFamily: 'IBM Plex Sans Arabic, Tahoma', fontSize: 15, fontWeight: '700', fill: '#fff', stroke: { color: '#000', width: 4 } } });
tag.anchor.set(.5, 0); tag.position.set(SW / 2, 12); labels.addChild(tag);
app.render(); app.ticker.stop(); (window as any).done = true;   // مشهد ثابت: رسمة وحدة
