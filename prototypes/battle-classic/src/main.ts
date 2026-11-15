// المعركة الكلاسيكية v2 (I-052، D-027): نفس منطق معركة الأصل (sim.ts)، والرسم «كأنك بأرض المعركة»:
// - ذخيرة بمراحل: إشعال ← خروج بطيء ← تسارع ← لهب يرتجف ← انطفاء وسقوط، وذيول دخان متصلة تبقى وتتمدد مع الريح
// - إطلاقات لكل سلاح: غراد (عصفة خلفية وغبار)، D-30 (لهب الفوهة الجانبي وموجة ضغط)، دبابة (غبار العصفة)، صواريخ دفاع جوي (إطلاق عمودي)
// - الطيارات ترمي مشاعل حرارية لما ينطلق عليها صاروخ، والقنابل تنشاف وهي تنزل
// - إضاءة (نهار/غروب/ليل) والوهج يضوّي الأرض، ظلال غيوم
// - أرض من صور جوية حقيقية (Poly Haven)، وادي، سواتر وخنادق، أسوار بيوت، بساتين
// - أصوات حقيقية + يمين/يسار + صدى + تأخير بالمسافة
import { create, step, bars, phaseName, skip, stamp, SAMPLES, MW, MH, S, END, DEF_LINE, VILL_Y, roadX } from './sim3';
import type { World, Res, Unit, Proj, Terr, Air } from './sim3';
import manifest from '../../battle2d/sprites/manifest.json';

const $ = (id: string) => document.getElementById(id)!;
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const R = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sprUrls = import.meta.glob('../../battle2d/sprites/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const fxUrls = import.meta.glob('../../theater/textures/{fx_explo1,fx_explo2,fx_fire}.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const groundUrls = import.meta.glob('../textures/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const oldSnd = import.meta.glob('../../theater/sounds/{boom_big,boom_mid,boom_far,tank,akburst,mg,rocket,launch,atgm,incoming,ricochet}.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const newSnd = import.meta.glob('../sounds/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const MAN = manifest as Record<string, { m: number; piv?: number[] }>;
const qs = new URLSearchParams(location.search), AUTO = qs.has('auto');
const cv = $('c') as HTMLCanvasElement, g = cv.getContext('2d')!;
let SW = 0, SH = 0, DPR = 1;
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); SW = cv.clientWidth; SH = cv.clientHeight; cv.width = SW * DPR; cv.height = SH * DPR; lightC = mk(Math.ceil(SW / 2), Math.ceil(SH / 2)); }
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
let lightC = mk(2, 2);
window.addEventListener('resize', resize); resize();
const loadImg = (u: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });
const WIND = { x: 5.5, y: -1.2 };   // الريح: الدخان ينجرف شرق شوية

// ===== الصور =====
const TEAM = ['#f2cf4a', '#ff5638'];
interface Spr { side: HTMLCanvasElement[]; dark: HTMLCanvasElement; shadow: HTMLCanvasElement; plain: HTMLCanvasElement; piv?: number[]; m: number }
const SPR: Record<string, Spr> = {};
const TEX: Record<string, HTMLImageElement> = {};
let puff: Record<string, HTMLCanvasElement> = {}, glow: HTMLCanvasElement, flameC: HTMLCanvasElement;
function variants(img: HTMLImageElement, m: number, piv?: number[], side2 = false): Spr {
  const n = side2 ? 240 : 160, base = mk(n, n), bg = base.getContext('2d')!; bg.drawImage(img, 0, 0, n, n);
  const sil = (col: string, blur = 0) => { const c = mk(n, n), x = c.getContext('2d')!; if (blur) x.filter = `blur(${blur}px)`; x.drawImage(base, 0, 0); x.filter = 'none'; x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, n, n); return c; };
  const side = TEAM.map(col => { const s = sil(col), c = mk(n, n), x = c.getContext('2d')!; for (let a = 0; a < 8; a++) x.drawImage(s, Math.cos(a * Math.PI / 4) * n / 44, Math.sin(a * Math.PI / 4) * n / 44); x.drawImage(base, 0, 0); return c; });
  const dark = mk(n, n), dx = dark.getContext('2d')!; dx.drawImage(base, 0, 0); dx.globalCompositeOperation = 'source-atop'; dx.fillStyle = 'rgba(26,20,15,.66)'; dx.fillRect(0, 0, n, n);
  return { side, dark, shadow: sil('#000', 2), plain: base, piv, m };
}
async function loadAll(say: (t: string) => void) {
  const names = Object.keys(MAN).filter(n => n !== 'h5'); let k = 0;
  await Promise.all(names.map(async n => { SPR[n] = variants(await loadImg(sprUrls[`../../battle2d/sprites/${n}.png`]), MAN[n].m, MAN[n].piv, /^(abrams|t72|bmp)/.test(n)); say(`يحمّل الصور… ${++k}/${names.length}`); }));
  for (const [k2, u] of Object.entries({ ...fxUrls, ...groundUrls })) TEX[k2.split('/').pop()!.replace('.webp', '')] = await loadImg(u);
  // غيوم دخان ناعمة (16 شكل)
  const sheet = mk(512, 512), sx = sheet.getContext('2d')!; let sd = 7; const rr = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let c = 0; c < 16; c++) { const ox = (c % 4) * 128 + 64, oy = Math.floor(c / 4) * 128 + 64; for (let i = 0; i < 16; i++) { const a = rr() * 6.28, r = rr() * 26, x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r, rad = 14 + rr() * 24, gr = sx.createRadialGradient(x - 3, y - 3, 0, x, y, rad); gr.addColorStop(0, `rgba(255,255,255,${0.26 + rr() * 0.2})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = gr; sx.beginPath(); sx.arc(x, y, rad, 0, 7); sx.fill(); } }
  const tint = (col: string) => { const c = mk(512, 512), x = c.getContext('2d')!; x.drawImage(sheet, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, 512, 512); return c; };
  puff = { black: tint('rgb(34,31,28)'), grey: tint('rgb(120,114,106)'), dust: tint('rgb(178,152,114)'), white: tint('rgb(236,236,232)'), smoke: tint('rgb(210,208,202)') };
  glow = mk(128, 128); { const x = glow.getContext('2d')!, gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,252,235,1)'); gr.addColorStop(.12, 'rgba(255,225,150,.9)'); gr.addColorStop(.35, 'rgba(255,150,50,.35)'); gr.addColorStop(1, 'rgba(255,100,20,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); }
  // لهب فوهة موجّه (مخروط): يرسم لقدّام
  flameC = mk(128, 64); { const x = flameC.getContext('2d')!; const gr = x.createRadialGradient(10, 32, 0, 10, 32, 118); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(.2, 'rgba(255,220,120,.95)'); gr.addColorStop(.55, 'rgba(255,130,40,.5)'); gr.addColorStop(1, 'rgba(255,80,10,0)'); x.fillStyle = gr; x.beginPath(); x.moveTo(4, 32); x.quadraticCurveTo(60, 0, 128, 32); x.quadraticCurveTo(60, 64, 4, 32); x.fill(); }
}

// ===== الأرض: صور جوية حقيقية + ألوان المنطقة + وادي وطريق وسواتر وخنادق =====
const PAL: Record<Terr, number[]> = { desert: [214, 190, 140], plain: [120, 134, 74], hills: [128, 128, 86], mount: [128, 124, 110] };
const TERR_N: Record<Terr, string> = { plain: 'سهل', desert: 'صحراء', hills: 'تلال', mount: 'جبال' };
const TEXSET: Record<Terr, [string, string, number]> = { desert: ['aerial_sand', 'dirt_aerial_03', 70], plain: ['rocky_terrain_02', 'dirt_aerial_02', 90], hills: ['aerial_ground_rock', 'rocky_terrain_02', 80], mount: ['coast_sand_05', 'aerial_ground_rock', 80] };
function vnoise(sx: number, sy: number, seed: number) { const h = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453; return n - Math.floor(n); }; const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0, s = (t: number) => t * t * (3 - 2 * t); return h(x0, y0) * (1 - s(fx)) * (1 - s(fy)) + h(x0 + 1, y0) * s(fx) * (1 - s(fy)) + h(x0, y0 + 1) * (1 - s(fx)) * s(fy) + h(x0 + 1, y0 + 1) * s(fx) * s(fy); }
const fbm = (x: number, y: number, s: number) => vnoise(x, y, s) * .5 + vnoise(x * 2.1, y * 2.1, s + 7) * .27 + vnoise(x * 4.3, y * 4.3, s + 13) * .15 + vnoise(x * 9, y * 9, s + 29) * .08;
const GX0 = -260, GW = MW + 520, GR = 2;
let ground: HTMLCanvasElement, decal: HTMLCanvasElement, dctx: CanvasRenderingContext2D, overlay: HTMLCanvasElement;
const roadPts: [number, number][] = (() => { const o: [number, number][] = []; for (let y = MH + 40; y >= -40; y -= 14) o.push([roadX(y), y]); return o; })();
const wadiY = (x: number) => MH * .6 + Math.sin(x / 70) * 22 + Math.sin(x / 31 + 1) * 8 + Math.sin(x / 13 + 2) * 3;
function buildGround(terr: Terr, w: World) {
  const seed = Math.random() * 100, Wpx = GW * GR, Hpx = MH * GR;
  ground = mk(Wpx, Hpx); const G = ground.getContext('2d')!;
  const [ta, tb, tile] = TEXSET[terr], pa = G.createPattern(TEX[ta], 'repeat')!, pb = G.createPattern(TEX[tb], 'repeat')!;
  const sc = tile * GR / 1024; pa.setTransform(new DOMMatrix().scale(sc)); pb.setTransform(new DOMMatrix().rotate(37).scale(sc * 1.3));
  G.fillStyle = pa; G.fillRect(0, 0, Wpx, Hpx);
  // خليط الثاني بقناع ضجيج
  const mask = mk(Wpx / 8, Hpx / 8), mx = mask.getContext('2d')!, im = mx.createImageData(mask.width, mask.height);
  for (let j = 0; j < mask.height; j++) for (let i = 0; i < mask.width; i++) { const v = fbm(i / mask.width * 5, j / mask.height * 9, seed), k = (i + j * mask.width) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = 0; im.data[k + 3] = clamp((v - .42) * 4, 0, 1) * 255; }
  mx.putImageData(im, 0, 0);
  const lb = mk(Wpx, Hpx), lx = lb.getContext('2d')!; lx.fillStyle = pb; lx.fillRect(0, 0, Wpx, Hpx); lx.globalCompositeOperation = 'destination-in'; lx.imageSmoothingEnabled = true; lx.drawImage(mask, 0, 0, Wpx, Hpx);
  G.drawImage(lb, 0, 0);
  // لون المنطقة + تظليل التضاريس (مثل makeGround بالأصل)
  const tone = mk(Wpx / 8, Hpx / 8), tx = tone.getContext('2d')!, ti = tx.createImageData(tone.width, tone.height), p = PAL[terr], rel = terr === 'mount' ? 420 : terr === 'hills' ? 300 : terr === 'desert' ? 160 : 120;
  const ht = (i: number, j: number) => fbm(i / tone.width * 3.4 + 9, j / tone.height * 6 + 9, seed + 3);
  for (let j = 0; j < tone.height; j++) for (let i = 0; i < tone.width; i++) { const sh = (ht(i + 1, j + 1) - ht(i - 1, j - 1)) * rel, k = (i + j * tone.width) * 4; for (let q = 0; q < 3; q++) ti.data[k + q] = clamp(p[q] - sh, 0, 255); ti.data[k + 3] = 255; }
  tx.putImageData(ti, 0, 0);
  G.globalCompositeOperation = 'soft-light'; G.globalAlpha = .9; G.drawImage(tone, 0, 0, Wpx, Hpx); G.globalAlpha = .28; G.globalCompositeOperation = 'color'; G.drawImage(tone, 0, 0, Wpx, Hpx); G.globalAlpha = 1; G.globalCompositeOperation = 'source-over';
  G.save(); G.scale(GR, GR); G.translate(-GX0, 0);
  // وادي جاف بالنص (حصى وحافتين)
  G.lineCap = 'round'; G.lineJoin = 'round';
  const wadi = (lw: number, col: string) => { G.strokeStyle = col; G.lineWidth = lw; G.beginPath(); for (let x = GX0; x <= GX0 + GW; x += 6) { const y = wadiY(x); x === GX0 ? G.moveTo(x, y) : G.lineTo(x, y); } G.stroke(); };
  wadi(18, 'rgba(60,46,30,.12)'); wadi(12, 'rgba(206,190,156,.22)'); wadi(5, 'rgba(150,136,110,.25)');
  for (let i = 0; i < 260; i++) { const x = R(GX0, GX0 + GW), y = wadiY(x) + R(-6, 6); G.fillStyle = `rgba(${R(120, 200) | 0},${R(110, 180) | 0},${R(90, 150) | 0},.7)`; G.beginPath(); G.arc(x, y, R(.4, 1.1), 0, 7); G.fill(); }
  // طريق ترابي بحافات وآثار عجلات
  const road = (lw: number, col: string) => { G.strokeStyle = col; G.lineWidth = lw; G.beginPath(); roadPts.forEach(([x, y], i) => i ? G.lineTo(x, y) : G.moveTo(x, y)); G.stroke(); };
  road(9, 'rgba(70,56,40,.35)'); const rp = G.createPattern(TEX.dirt_aerial_03, 'repeat')!; rp.setTransform(new DOMMatrix().scale(.05)); G.strokeStyle = rp; G.lineWidth = 6.5; G.beginPath(); roadPts.forEach(([x, y], i) => i ? G.lineTo(x, y) : G.moveTo(x, y)); G.stroke();
  road(.6, 'rgba(60,48,34,.35)');
  // سواتر ترابية قدّام دبابات العدو، وخندق متعرج قدّام القرية
  for (const u of w.u) if (u.side === 1 && u.type === 'tank') { const x = u.x, y = u.y + 9; G.fillStyle = 'rgba(40,30,20,.35)'; G.beginPath(); G.ellipse(x + 2, y + 3, 15, 4.5, 0, 0, 7); G.fill(); G.fillStyle = 'rgba(196,170,126,.95)'; G.beginPath(); G.ellipse(x, y, 14, 4, 0, 0, 7); G.fill(); G.fillStyle = 'rgba(232,212,170,.7)'; G.beginPath(); G.ellipse(x - 1, y - 1.2, 11, 1.8, 0, 0, 7); G.fill(); }
  const ty0 = VILL_Y + 165; G.strokeStyle = 'rgba(40,30,22,.75)'; G.lineWidth = 2.2; G.beginPath(); for (let x = MW * .08; x <= MW * .92; x += 9) { const y = ty0 + ((x / 9) % 2 ? 4 : -4); x === MW * .08 ? G.moveTo(x, y) : G.lineTo(x, y); } G.stroke();
  G.strokeStyle = 'rgba(214,196,156,.6)'; G.lineWidth = .9; G.stroke();
  // أسوار البيوت (حوش) — طين بظل
  for (const b of w.b) { const s2 = b.w * 1.15; G.save(); G.translate(b.x, b.y); G.rotate(b.r); G.strokeStyle = 'rgba(30,24,18,.4)'; G.lineWidth = 1.6; G.strokeRect(-s2 + .8, -s2 * .9 + 1, s2 * 2, s2 * 1.8); G.strokeStyle = 'rgba(190,168,130,.95)'; G.lineWidth = 1.1; G.strokeRect(-s2, -s2 * .9, s2 * 2, s2 * 1.8); G.restore(); }
  G.restore();
  // شجيرات وحصى
  const shrub = terr === 'plain' ? [62, 88, 38] : terr === 'desert' ? [118, 108, 66] : [74, 90, 50];
  for (let i = 0; i < (terr === 'desert' ? 220 : 520); i++) { const X = Math.random() * Wpx, Y = Math.random() * Hpx, r = (.9 + Math.random() * 1.6) * GR; G.fillStyle = 'rgba(25,20,12,.28)'; G.beginPath(); G.ellipse(X + r * .6, Y + r * .6, r, r * .8, 0, 0, 7); G.fill(); for (let q = 0; q < 3; q++) { const f = .75 + Math.random() * .45; G.fillStyle = `rgb(${shrub[0] * f | 0},${shrub[1] * f | 0},${shrub[2] * f | 0})`; G.beginPath(); G.arc(X + R(-r, r) * .4, Y + R(-r, r) * .4, r * R(.5, .8), 0, 7); G.fill(); } }
  decal = mk(Wpx, Hpx); dctx = decal.getContext('2d')!; dctx.scale(GR, GR); dctx.translate(-GX0, 0);
  // بساتين نخل حول القرية + أشجار
  props = [];
  const palm = terr === 'plain' || terr === 'desert';
  for (let i = 0, t = 0; i < 42 && t < 900; t++) { const x = R(-60, MW + 60), y = R(VILL_Y - 200, VILL_Y + 190); if (w.b.some(b => Math.hypot(b.x - x, b.y - y) < b.w * 1.6) || w.u.some(u => u.side === 1 && Math.hypot(u.x - x, u.y - y) < 18) || roadDist(x, y) < 8) continue; props.push({ n: palm ? 'palm' : 'tree', x, y, r: R(0, 6.28), s: R(.8, 1.15) }); i++; }
  for (let i = 0; i < 26; i++) { const side = Math.random() < .5 ? -1 : 1, x = side < 0 ? R(-200, 20) : R(MW - 20, MW + 200), y = R(0, MH); props.push({ n: terr === 'desert' ? 'acacia' : 'tree', x, y, r: R(0, 6.28), s: R(.8, 1.3) }); }
  for (let i = 0; i < 4; i++) { const [x, y] = roadPts[5 + Math.floor(Math.random() * (roadPts.length - 10))]; props.push({ n: Math.random() < .5 ? 'car1' : 'pickup', x: x + (Math.random() < .5 ? -9 : 9), y, r: R(0, 6.28), s: 1 }); }
  // ظلال الغيوم
  clouds = Array.from({ length: 8 }, () => ({ x: R(-200, MW + 200), y: R(0, MH), r: R(90, 170) }));
}
function roadDist(x: number, y: number) { let m = 1e9; for (const [a, b] of roadPts) m = Math.min(m, Math.hypot(a - x, b - y)); return m; }
interface Prop { n: string; x: number; y: number; r: number; s: number }
let props: Prop[] = [], clouds: { x: number; y: number; r: number }[] = [];
function crater(x: number, y: number, r: number) {
  const eg = dctx.createRadialGradient(x, y, r * .4, x, y, r * 2); eg.addColorStop(0, 'rgba(200,178,140,.32)'); eg.addColorStop(1, 'rgba(200,178,140,0)'); dctx.fillStyle = eg; dctx.beginPath(); dctx.arc(x, y, r * 2, 0, 7); dctx.fill();
  const gr = dctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(18,14,10,.82)'); gr.addColorStop(.6, 'rgba(40,32,24,.5)'); gr.addColorStop(1, 'rgba(40,32,24,0)'); dctx.fillStyle = gr; dctx.beginPath(); dctx.arc(x, y, r, 0, 7); dctx.fill();
  for (let i = 0; i < 6; i++) { const a = R(0, 6.28), d = r * R(1, 2.2); dctx.fillStyle = 'rgba(40,32,22,.35)'; dctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, R(.6, 1.6), R(.6, 1.6)); }
}
function scorch(x: number, y: number, r: number) { const gr = dctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(14,12,10,.55)'); gr.addColorStop(1, 'rgba(14,12,10,0)'); dctx.fillStyle = gr; dctx.beginPath(); dctx.arc(x, y, r, 0, 7); dctx.fill(); }

// ===== الجسيمات =====
type PT = 'fire' | 'spark' | 'debris' | 'dust' | 'black' | 'grey' | 'white' | 'smoke' | 'ex' | 'ex2' | 'flare' | 'ring' | 'cone';
interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grow: number; type: PT; cell: number; rot: number; a: number; ang?: number }
let fx: P[] = [];
function add(type: PT, x: number, y: number, o: Partial<P> & { n?: number; spd?: number; jit?: number } = {}) {
  for (let i = 0, n = o.n ?? 1; i < n; i++) {
    const a = R(0, 6.28), sp = (o.spd ?? 0) * R(.3, 1), j = o.jit ?? 0;
    fx.push({ x: x + R(-j, j), y: y + R(-j, j), z: o.z ?? 0, vx: (o.vx ?? 0) + Math.cos(a) * sp, vy: (o.vy ?? 0) + Math.sin(a) * sp, vz: o.vz ?? 0, life: 0, max: (o.max ?? 1) * R(.8, 1.2), size: (o.size ?? 4) * R(.75, 1.25), grow: o.grow ?? 0, type, cell: Math.floor(Math.random() * 16), rot: R(0, 6.28), a: o.a ?? 1, ang: o.ang });
  }
}
// ذيول دخان متصلة
interface Trail { pts: { x: number; y: number; t: number }[]; w: number; grow: number; life: number; col: string; a: number; done: boolean }
let trails: Trail[] = [];
function trail(w: number, grow: number, life: number, col: string, a: number): Trail { const t = { pts: [], w, grow, life, col, a, done: false }; trails.push(t); return t; }
// أضواء (للإضاءة): مؤقتة
let lights: { x: number; y: number; r: number; i: number; life: number; max: number; col: string }[] = [];
const light = (x: number, y: number, r: number, i: number, max: number, col = '255,170,80') => lights.push({ x, y, r, i, life: 0, max, col });
let shake = 0;

// ===== الصوت v3: قنوات مرتبة (ما تتخربط) + يمين/يسار + صدى + تأخير المسافة =====
// كل صوت إله قناة: انفجارات، مدافع، أسلحة خفيفة، إطلاقات، جو. لكل قناة حد أصوات بنفس اللحظة وفاصل أدنى،
// والانفجار الكبير يخفّض الأسلحة الخفيفة والخلفية لحظة (مثل أفلام الحرب) حتى يبين.
type Ch = 'boom' | 'gun' | 'small' | 'launch' | 'air';
const LIM: Record<Ch, number> = { boom: 4, gun: 3, small: 3, launch: 3, air: 2 }, GAP: Record<Ch, number> = { boom: .06, gun: .07, small: .1, launch: .09, air: .4 };
let speed = 1, muted = false, ac: AudioContext | null = null, master: GainNode, wet: GainNode, amb: GainNode | null = null, heliG: GainNode | null = null;
const bus: Partial<Record<Ch, GainNode>> = {}, chAct: Record<Ch, number> = { boom: 0, gun: 0, small: 0, launch: 0, air: 0 }, chLast: Record<Ch, number> = { boom: -9, gun: -9, small: -9, launch: -9, air: -9 };
const smp: Record<string, AudioBuffer> = {};
function audio() {
  if (muted) return null;
  try {
    if (!ac) {
      ac = new AudioContext(); master = ac.createGain(); master.gain.value = .9;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .25; master.connect(comp).connect(ac.destination);
      for (const c of Object.keys(LIM) as Ch[]) { const gn = ac.createGain(); gn.gain.value = c === 'small' ? .8 : 1; gn.connect(master); bus[c] = gn; }
      const ir = ac.createBuffer(2, ac.sampleRate * 2.6, ac.sampleRate); for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6) * (i < ac.sampleRate * .06 ? 0 : 1); }
      const conv = ac.createConvolver(); conv.buffer = ir; wet = ac.createGain(); wet.gain.value = .28; wet.connect(conv).connect(master);
      const a = ac; for (const [k, u] of Object.entries({ ...oldSnd, ...newSnd })) fetch(u).then(r => r.arrayBuffer()).then(b => a.decodeAudioData(b)).then(buf => { smp[k.split('/').pop()!.replace('.mp3', '')] = buf; if (k.includes('battle_amb') || k.includes('heli_loop')) startLoops(); }).catch(() => {});
    }
    if (ac.state === 'suspended') ac.resume(); return ac;
  } catch { return null; }
}
function startLoops() {
  if (!ac) return;
  const loop = (n: string) => { if (!smp[n]) return null; const s = ac!.createBufferSource(); s.buffer = smp[n]; s.loop = true; const gn = ac!.createGain(); gn.gain.value = 0; s.connect(gn).connect(master); s.start(); return gn; };
  if (!amb) amb = loop('battle_amb'); if (!heliG) heliG = loop('heli_loop');
}
const M_PER_PX = 3.75;   // الساحة بالقصة: كل بكسل ≈ 3.75 م
const distOf = (x: number, y: number) => Math.hypot(x - cam.x, y - cam.y) * M_PER_PX;
function duck(amount: number) { if (!ac) return; const t = ac.currentTime; for (const g2 of [bus.small, amb]) { if (!g2) continue; const v = g2 === amb ? (g2.gain.value || 0) : .8; g2.gain.cancelScheduledValues(t); g2.gain.setValueAtTime(g2.gain.value, t); g2.gain.linearRampToValueAtTime(v * amount, t + .03); g2.gain.linearRampToValueAtTime(v, t + .7); } }
function play(ch: Ch, name: string, x: number, y: number, vol: number, o: { rate?: number; delay?: number; wet?: number } = {}) {
  const a = ac; if (!a || !smp[name]) return;
  const now = a.currentTime;
  if (speed >= 4 && ch === 'small') return;
  if (chAct[ch] >= LIM[ch] - (speed >= 4 ? 1 : 0) || now - chLast[ch] < GAP[ch] / Math.min(speed, 3)) return;   // القناة مليانة أو الصوت لازگ بالسابق ← نتركه
  const d = distOf(x, y), v = vol * Math.min(1, 1.15 / (1 + d / 1300)); if (v < .025) return;
  chLast[ch] = now; chAct[ch]++;
  const t = now + (o.delay ?? 0) + Math.min(1.2, d / 343 / speed), s = a.createBufferSource(); s.buffer = smp[name]; s.playbackRate.value = (o.rate ?? 1) * R(.94, 1.06);
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = clamp(15000 - d * 3, 1100, 15000);
  const gn = a.createGain(); gn.gain.value = v; const pan = a.createStereoPanner(); pan.pan.value = clamp((x - cam.x) / (MW * .55 / cam.z), -.85, .85);
  s.connect(f).connect(gn).connect(pan).connect(bus[ch]!); const ws = a.createGain(); ws.gain.value = (o.wet ?? .5) * Math.min(1, .4 + d / 2000); pan.connect(ws).connect(wet);
  s.start(t); s.onended = () => chAct[ch]--;
}
function thump(x: number, y: number, size: number) {
  const a = ac; if (!a || !bus.boom) return; const d = distOf(x, y), t = a.currentTime + Math.min(1.2, d / 343 / speed), vol = Math.min(1, .9 / (1 + d / 1000));
  const o = a.createOscillator(), og = a.createGain(); o.frequency.setValueAtTime(85, t); o.frequency.exponentialRampToValueAtTime(26, t + .55); og.gain.setValueAtTime(vol * (.3 + size * .1), t); og.gain.exponentialRampToValueAtTime(.001, t + .7); o.connect(og).connect(bus.boom); o.start(t); o.stop(t + .75);
}
function jetSound(x: number) {
  const a = ac; if (!a || !bus.air || chAct.air >= 2) return; const t = a.currentTime, dur = 3.4; chAct.air++; setTimeout(() => chAct.air--, dur * 1000);
  if (smp.jet_roar) { const s = a.createBufferSource(); s.buffer = smp.jet_roar; s.playbackRate.setValueAtTime(1.25, t); s.playbackRate.linearRampToValueAtTime(.8, t + dur); const gn = a.createGain(); gn.gain.setValueAtTime(.001, t); gn.gain.linearRampToValueAtTime(.5, t + dur * .45); gn.gain.exponentialRampToValueAtTime(.001, t + dur); const pan = a.createStereoPanner(); pan.pan.setValueAtTime(clamp((x - MW / 2) / MW, -.8, .8), t); s.connect(gn).connect(pan).connect(bus.air); pan.connect(wet); s.start(t, .3); s.stop(t + dur); }
  const n = a.createBufferSource(), buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; n.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(600, t); f.frequency.linearRampToValueAtTime(2600, t + dur * .45); f.frequency.linearRampToValueAtTime(300, t + dur);
  const gn = a.createGain(); gn.gain.setValueAtTime(.001, t); gn.gain.linearRampToValueAtTime(.26, t + dur * .45); gn.gain.exponentialRampToValueAtTime(.001, t + dur); n.connect(f).connect(gn).connect(bus.air); n.start(t); n.stop(t + dur);
}

// ===== الذخيرة المرئية =====
interface Mun { id: number; tr: Trail | null; tr2: Trail | null; whistle: boolean; burnout: boolean }
const mun = new Map<number, Mun>();
function munPos(p: Proj): { x: number; y: number; z: number; burning: boolean; k: number } {
  const k = clamp(p.t / p.dur, 0, 1), d = Math.hypot(p.tx - p.sx, p.ty - p.sy);
  if (p.kind === 'rocket') { const e = Math.pow(k, 1.7); return { x: lerp(p.sx, p.tx, e), y: lerp(p.sy, p.ty, e), z: Math.sin(Math.PI * e) * Math.max(30, d * .26) + (1 - e) * 3, burning: e < .45, k }; }
  if (p.kind === 'shell') return { x: lerp(p.sx, p.tx, k), y: lerp(p.sy, p.ty, k), z: Math.sin(Math.PI * k) * Math.max(40, d * .33), burning: false, k };
  if (p.kind === 'sam') { const up = clamp(k / .16, 0, 1); return { x: p.x, y: p.y, z: Math.max(p.z, 34 * Math.sqrt(up)), burning: true, k }; }   // يطلع عمودي وبعدين يلاحق
  if (p.kind === 'atgm' || p.kind === 'rpg') { const e = Math.pow(k, 1.25); return { x: lerp(p.sx, p.tx, e), y: lerp(p.sy, p.ty, e), z: lerp(p.sz, 1, e) + Math.sin(k * 26) * .5, burning: true, k }; }
  if (p.kind === 'bomb') return { x: p.x, y: p.y, z: p.z, burning: false, k };
  return { x: p.x, y: p.y, z: 1.5, burning: false, k };
}
const lift = (z: number) => z * .55;
const shadowOff = (z: number) => [z * .28, z * .16];
function updateMun(w: World, dt: number) {
  const seen = new Set<number>();
  for (const p of w.pr) {
    seen.add(p.id); if (p.t < 0) continue;
    let m = mun.get(p.id); const q = munPos(p), y = q.y - lift(q.z);
    if (!m) {
      m = { id: p.id, tr: null, tr2: null, whistle: false, burnout: false }; mun.set(p.id, m);
      if (p.kind === 'rocket') { m.tr = trail(1.1, 1.5, 6, '228,226,220', .62); m.tr2 = trail(.5, .8, .9, '255,200,120', .5); }
      else if (p.kind === 'sam') m.tr = trail(1.6, 2, 9, '240,240,236', .78);
      else if (p.kind === 'atgm') m.tr = trail(.6, 1, 3.5, '222,222,216', .5);
      else if (p.kind === 'rpg') m.tr = trail(.6, 1.4, 2.2, '200,198,190', .55);
      else if (p.kind === 'bomb' && Math.random() < .35) play('launch', 'incoming', p.tx, p.ty, .3, { rate: 1.7 });
    }
    if (m.tr && (q.burning || p.kind !== 'rocket')) m.tr.pts.push({ x: q.x, y, t: w.T }); else if (m.tr && !m.burnout) { m.burnout = true; m.tr.done = true; if (m.tr2) m.tr2.done = true; }
    if (m.tr2 && q.burning) m.tr2.pts.push({ x: q.x, y, t: w.T });
    if (q.burning && p.kind !== 'rpg') light(q.x, y, p.kind === 'sam' ? 26 : 16, p.kind === 'sam' ? .9 : .6, .06, '255,190,110');
    if ((p.kind === 'shell' || (p.kind === 'rocket' && m.burnout)) && !m.whistle && p.dur - p.t < 1.5) { m.whistle = true; if (Math.random() < (p.kind === 'shell' ? .35 : .2)) play('launch', 'incoming', p.tx, p.ty, .35, { rate: R(1.1, 1.4) }); }
  }
  for (const [id, m] of mun) if (!seen.has(id)) { if (m.tr) m.tr.done = true; if (m.tr2) m.tr2.done = true; mun.delete(id); }
  for (const t of trails) { for (const p of t.pts) { p.x += WIND.x * dt * .6; p.y += WIND.y * dt * .6; } while (t.pts.length && w.T - t.pts[0].t > t.life) t.pts.shift(); }
  trails = trails.filter(t => t.pts.length || !t.done);
}

// ===== أحداث المحاكاة ← مشاهد وردود فعل =====
let W: World | null = null, terr: Terr = 'desert', curRes = 'win', running = false, tod: 'day' | 'dusk' | 'night' = 'dusk';
const recoil = new Map<number, number>(), turretFly: { x: number; y: number; z: number; vx: number; vy: number; vz: number; a: number; va: number; name: string; id: number }[] = [];
const feed: { el: HTMLElement; t: number }[] = [];
function say(t: string, side: 0 | 1 | 2) {
  const box = $('feed'); if (!box) return; if (feed.length && feed[feed.length - 1].el.textContent === t) { feed[feed.length - 1].t = performance.now(); return; }
  const el = document.createElement('div'); el.className = 's' + side; el.textContent = t; box.appendChild(el); feed.push({ el, t: performance.now() }); while (feed.length > 3) feed.shift()!.el.remove();
}
function explosion(x: number, y: number, cal: number, airZ = 0) {
  const r = cal * .2667 * 14 + 3, big = cal >= 2.2, yy = y - lift(airZ);
  add(big ? 'ex' : 'ex2', x, yy, { max: big ? 1.4 : 1.1, size: r * (big ? 3.8 : 2.8) });
  add('ring', x, yy, { max: .35, size: r * 1.2, grow: r * 9, a: .55 });
  add('fire', x, yy, { n: 4 + cal * 3, spd: 40, max: .5, size: r * .6 });
  add('spark', x, yy, { n: 6 + cal * 5, spd: 160, max: .6, size: 1 });
  add('debris', x, yy, { n: 4 + cal * 4, spd: 55, max: 1.2, size: 1.1, vz: 40 });
  if (!airZ) { add('dust', x, y, { n: 3 + cal * 2, spd: 22, max: 3.5, size: r * .9, grow: 6, a: .75 }); add(big ? 'black' : 'grey', x, y, { n: 2 + cal, spd: 6, max: 6 + cal * 2, size: r * .8, grow: 5, a: .8 }); crater(x, y, r * 1.15); }
  light(x, yy, r * 7, 1.4, .35); shake = Math.max(shake, cal * 1.8 * clamp(1.3 - distOf(x, y) / 3500, .25, 1));
  const name = cal >= 3 ? 'boom_huge' : cal >= 2.2 ? (Math.random() < .5 ? 'boom_big' : 'boom_bomb') : distOf(x, y) > 1800 ? 'boom_far' : cal < .8 ? 'blast' : 'boom_mid';
  play('boom', name, x, y, cal >= 3 ? .9 : .5 + cal * .13, { rate: R(.9, 1.08), wet: .7 }); thump(x, y, cal); if (cal >= 2.2) duck(.35);
}
function handle(e: World['fx'][0]) {
  const w = W!;
  switch (e.k) {
    case 'boom': if (e.cal > 0) explosion(e.x, e.y, e.cal, e.z); break;
    case 'fire': {
      const a = e.a, ca = Math.cos(a), sa = Math.sin(a), u = w.u.find(q => q.id === e.id); recoil.set(e.id, w.T);
      if (e.kind === 'ap') { const L = 18 * S * .5, mx = e.x + ca * L, my = e.y + sa * L;
        add('cone', mx, my, { max: .09, size: 28, ang: a }); add('ring', mx, my, { max: .25, size: 4, grow: 160, a: .35 });
        add('dust', e.x, e.y, { n: 6, spd: 34, max: 2.6, size: 7, grow: 7, a: .65 }); add('grey', mx, my, { n: 2, vx: ca * 14, vy: sa * 14, max: 2.2, size: 4, grow: 5, a: .6 });
        light(mx, my, 60, 1.1, .12); play('gun', 'tank', e.x, e.y, .8); thump(e.x, e.y, .8); }
      else if (e.kind === 'can') { const L = 13 * S * .5; add('cone', e.x + ca * L, e.y + sa * L, { max: .05, size: 9, ang: a }); play('small', 'hmg', e.x, e.y, .3, { rate: 1.25 }); }
      else if (e.kind === 'shell') { const L = 13 * S * .5, mx = e.x + ca * L, my = e.y + sa * L;
        add('cone', mx, my, { max: .12, size: 34, ang: a }); add('cone', mx, my, { max: .08, size: 13, ang: a + 1.57 }); add('cone', mx, my, { max: .08, size: 13, ang: a - 1.57 });
        add('ring', mx, my, { max: .4, size: 6, grow: 220, a: .45 }); add('dust', e.x, e.y, { n: 9, spd: 40, max: 3.5, size: 8, grow: 8, a: .7 }); add('grey', mx, my, { n: 3, vx: ca * 10, vy: sa * 10, max: 5, size: 6, grow: 6, a: .65 });
        light(mx, my, 90, 1.4, .15); play('gun', Math.random() < .5 ? 'howitzer' : 'mortar', e.x, e.y, .85, { wet: .8 }); thump(e.x, e.y, 1.4); }
      else if (e.kind === 'rocket') { add('flare', e.x, e.y - 3, { max: .15, size: 12 }); add('dust', e.x - ca * 10, e.y - sa * 10, { n: 3, spd: 26, max: 3, size: 8, grow: 8, a: .75 }); add('white', e.x - ca * 6, e.y - sa * 6, { n: 2, spd: 10, max: 4.5, size: 7, grow: 7, a: .7 });
        light(e.x, e.y, 70, 1.2, .2); play('launch', 'rocket', e.x, e.y, .55, { rate: R(.85, 1.15) }); }
      else if (e.kind === 'sam') { add('white', e.x, e.y, { n: 7, spd: 30, max: 5, size: 9, grow: 8, a: .85 }); add('flare', e.x, e.y, { max: .3, size: 22 }); light(e.x, e.y, 110, 1.6, .5); play('launch', 'launch', e.x, e.y, .8, { wet: .7 }); thump(e.x, e.y, 1); }
      else if (e.kind === 'atgm' || e.kind === 'rpg') { const zz = e.z || 1; add('flare', e.x, e.y - lift(zz), { max: .12, size: e.kind === 'rpg' ? 6 : 9 }); add('white', e.x - ca * 3, e.y - lift(zz) - sa * 3, { n: 2, spd: 8, max: 2, size: 3, grow: 4, a: .6 }); play('launch', 'atgm', e.x, e.y, e.kind === 'rpg' ? .45 : .7, { rate: e.kind === 'rpg' ? 1.3 : 1 }); }
      void u; break;
    }
    case 'hit': { add('spark', e.x, e.y, { n: 14, spd: 110, max: .6 }); add('flare', e.x, e.y, { max: .1, size: 8 }); add('grey', e.x, e.y, { n: 1, max: 3, size: 3, grow: 5, a: .6 }); light(e.x, e.y, 30, .9, .1); if (Math.random() < .5) play('small', 'ricochet', e.x, e.y, .35); break; }
    case 'mghit': if (Math.random() < .4) add('dust', e.x, e.y, { max: .9, size: 1.6, grow: 2, a: .6 }); break;
    case 'kill': {
      if (e.type === 'sol') { const u = w.u.find(q => q.id === e.id); if (u && Math.random() < .3) { const s = u.sol.filter(q => !q.alive).pop(); if (s) add('dust', s.x, s.y, { max: .8, size: 2, grow: 3, a: .5 }); } break; }
      const u = w.u.find(q => q.id === e.id); if (!u) break;
      if (e.type === 'heli') { turretFly.push({ x: u.x, y: u.y, z: u.alt, vx: R(-10, 10), vy: R(-10, 10), vz: -5, a: u.hull, va: R(3, 6), name: 'ah64', id: u.id }); add('ex2', u.x, u.y - lift(u.alt), { max: 1.1, size: 34 }); play('boom', 'boom_big', u.x, u.y, .6); break; }
      // إصابة قاتلة: كرة نار، والبرج ممكن يطير، وحريق يبقى
      setTimeout(() => { if (!W) return; add('ex', u.x, u.y, { max: 1.3, size: 44 }); add('fire', u.x, u.y, { n: 10, spd: 50, max: .7, size: 4 }); add('debris', u.x, u.y, { n: 16, spd: 60, max: 1.4, size: 1.3, vz: 60 }); light(u.x, u.y, 120, 1.6, .5); play('boom', 'boom_big', u.x, u.y, .6); duck(.4); }, 220 / speed);
      if (u.type === 'tank' && Math.random() < .45) turretFly.push({ x: u.x, y: u.y, z: 0, vx: R(-14, 14), vy: R(-14, 14), vz: R(60, 90), a: u.tur, va: R(-9, 9), name: (u.side ? 't72' : 'abrams') + '_t', id: u.id });
      scorch(u.x, u.y, 16); break;
    }
    case 'airkill': { const a = w.air.find(q => q.id === e.id); if (a) { add('ex2', a.x, a.y - lift(a.alt), { max: 1.1, size: a.kind === 'jet' ? 40 : 22 }); add('fire', a.x, a.y - lift(a.alt), { n: 8, spd: 40, max: .6, size: 3 }); play('boom', 'boom_mid', a.x, a.y, .6, { wet: .9 }); } break; }
    case 'crash': explosion(e.x, e.y, 2.6); add('black', e.x, e.y, { n: 4, spd: 5, max: 10, size: 8, grow: 6, a: .8 }); scorch(e.x, e.y, 22); break;
    case 'smoke': add('white', e.x, e.y, { n: 5, spd: 12, max: 24, size: 16, grow: 4, a: .9, jit: 10 }); add('flare', e.x, e.y, { max: .2, size: 8 }); play('launch', 'blast', e.x, e.y, .2, { rate: 1.3 }); break;
    case 'house': { const b = w.b[e.id]; add('dust', b.x, b.y, { n: 12, spd: 26, max: 5, size: b.w * .6, grow: 6, a: .85 }); add('black', b.x, b.y, { n: 3, spd: 6, max: 9, size: b.w * .5, grow: 4, a: .8 }); add('debris', b.x, b.y, { n: 14, spd: 50, max: 1.4, size: 1.4, vz: 40 }); play('boom', 'blast', b.x, b.y, .5); break; }
    case 'jet': { const j = w.air.find(q => q.id === e.id); if (j) setTimeout(() => jetSound(j.x), 700 / speed); break; }
    case 'spawn': { const u = w.u.find(q => q.id === e.id); if (u && u.type === 'heli') play('air', 'heli_pass', u.x, u.y, .45); break; }
    case 'msg': if (speed <= 4 || e.side === 2) say(e.t, e.side); break;
  }
}
function step2(dt: number) {
  const w = W!; step(w, dt); for (const e of w.fx) handle(e); w.fx.length = 0;
  updateMun(w, dt);
  for (const x of w.u) {
    if (!x.alive && x.burn > 0 && x.type !== 'inf') { if (Math.random() < dt * 9) add('fire', x.x + R(-3, 3), x.y + R(-3, 3), { max: .6, size: 3.5, vy: -6 }); if (Math.random() < dt * 4) add('black', x.x, x.y, { max: 9, size: 4, grow: 6, a: .75, vx: WIND.x * 1.6, vy: WIND.y * 2 - 4 }); if (Math.random() < dt * .6) { add('spark', x.x, x.y, { n: 8, spd: 90, max: .5 }); add('flare', x.x, x.y, { max: .08, size: 6 }); } light(x.x, x.y, 22, .3 + Math.random() * .2, .05, '255,120,40'); }
    else if (x.alive && x.dmg > 0 && Math.random() < dt * x.dmg * 1.4) add('grey', x.x, x.y, { max: 4, size: 2.5, grow: 4, a: .55 });   // متضررة: تدخن
    if (x.alive && x.moving && (x.type === 'tank' || x.type === 'ifv') && Math.random() < dt * 5) add('dust', x.x - Math.cos(x.hull) * 9, x.y - Math.sin(x.hull) * 9, { max: 2.2, size: 4, grow: 5, a: .45 });
  }
  // الطيارات: مشاعل حرارية لما ينطلق عليها صاروخ؛ اللي ينضربت تحترق وتنزل
  for (const j of w.air) {
    const jy = j.y - lift(j.alt);
    if (j.flareT > -9 && w.T > j.flareT && w.T - j.flareT < 1.4 && Math.random() < dt * 24) { const a = Math.atan2(j.vy, j.vx); add('flare', j.x, jy, { max: 2.2, size: 4, vx: -Math.cos(a) * 60 + R(-50, 50), vy: -Math.sin(a) * 60 + R(-50, 50), a: 1 }); }
    if (j.state === 'down') { if (Math.random() < dt * 30) add('black', j.x, jy, { max: 5, size: 3, grow: 4, a: .8 }); if (Math.random() < dt * 20) add('fire', j.x, jy, { max: .4, size: 3 }); light(j.x, jy, 24, .6, .05, '255,130,50'); }
  }
  for (const t of turretFly) { t.x += t.vx * dt; t.y += t.vy * dt; t.vz -= 140 * dt; t.z = Math.max(0, t.z + t.vz * dt); t.a += t.va * dt; if (t.z === 0) { t.vx *= .5; t.vy *= .5; t.va *= .5; if (t.name === 'ah64' && t.vz < -20) { explosion(t.x, t.y, 2); t.vz = 0; } } }
  for (const f of fx) { f.life += dt; f.x += (f.vx + (f.type === 'black' || f.type === 'grey' || f.type === 'white' || f.type === 'smoke' || f.type === 'dust' ? WIND.x : 0)) * dt; f.y += (f.vy + (f.type === 'black' || f.type === 'grey' || f.type === 'white' ? WIND.y : 0)) * dt;
    const dmp = f.type === 'spark' || f.type === 'debris' || f.type === 'flare' ? .985 : .93; f.vx *= dmp; f.vy *= dmp; if (f.type === 'debris') { f.vz -= 120 * dt; f.z = Math.max(0, f.z + f.vz * dt); } f.size += f.grow * dt; }
  fx = fx.filter(f => f.life < f.max); if (fx.length > 1500) fx.splice(0, fx.length - 1500);
  for (const l of lights) l.life += dt; lights = lights.filter(l => l.life < l.max);
  shake *= Math.pow(.02, dt);
  fadeT += dt; if (fadeT > 1) { fadeT = 0; dctx.save(); dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = 'destination-out'; dctx.fillStyle = 'rgba(0,0,0,.02)'; dctx.fillRect(0, 0, decal.width, decal.height); dctx.restore(); }
  for (const c of clouds) { c.x += 3 * dt; if (c.x - c.r > MW + 260) c.x = -260 - c.r; }
}
let fadeT = 0;

// ===== الرسم =====
const HOUSE = ['h1', 'h2', 'h3', 'h4', 'h6'];
const cam = { x: MW / 2, y: MH / 2, z: 1, auto: true };
function sprite(sp: Spr, x: number, y: number, ang: number, size: number, side: number, dead: boolean) { g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2); g.drawImage(dead ? sp.dark : side < 0 ? sp.plain : sp.side[side], -size / 2, -size / 2, size, size); g.restore(); }
function shadowOf(sp: Spr, x: number, y: number, ang: number, size: number, ox: number, oy: number, a = .38) { g.save(); g.translate(x + ox, y + oy); g.rotate(ang + Math.PI / 2); g.globalAlpha = a; g.drawImage(sp.shadow, -size / 2, -size / 2, size, size); g.restore(); g.globalAlpha = 1; }
const UN: Record<string, [string, string, number]> = { tank: ['abrams', 't72', 18], ifv: ['bmp', 'bmp', 14], arty: ['d30', 'd30', 13], mlrs: ['grad', 'grad', 15], ad: ['patriot', 's400', 17] };
function drawUnit(x: Unit, T: number, pass: 0 | 1) {
  if (x.type === 'inf' || x.type === 'heli') return;
  const [n0, n1, sz] = UN[x.type], name = x.side ? n1 : n0, sp = SPR[name], size = sz * S, dead = !x.alive;
  const aim = x.type === 'tank' || x.type === 'ifv' ? x.tur : x.hull;
  const rt = T - (recoil.get(x.id) ?? -9), rec = !dead && rt < .3 ? (1 - rt / .3) * (x.type === 'arty' ? 2.6 : 1.8) : 0, bx = x.x - Math.cos(aim) * rec, by = x.y - Math.sin(aim) * rec;
  if (pass === 0) { shadowOf(sp, bx, by, x.hull, size, 2.4, 3.2, dead ? .25 : .45); return; }
  sprite(sp, bx, by, x.hull + (dead ? x.rot * .05 : 0), size, x.side, dead);
  if (x.type === 'tank' && !(dead && turretFly.some(t => t.id === x.id))) {
    const ts = SPR[name + '_t'], p = ts.piv ?? [0, 0], k = size / sp.m, c = Math.cos(x.hull + Math.PI / 2), s = Math.sin(x.hull + Math.PI / 2), px = p[0] * k, pz = -p[1] * k, tx = bx + px * c - pz * s, ty = by + px * s + pz * c;
    shadowOf(ts, tx, ty, dead ? x.tur + .6 : x.tur, size, 1, 1.4, .3);   // ظل البرج على الجسم: يعطي عمق
    sprite(ts, tx, ty, dead ? x.tur + .6 : x.tur, size, -1, dead);
  }
}
function drawInf(x: Unit, T: number) {
  const k = S * .95, body = x.side ? '#8a7650' : '#56603a', helm = x.side ? '#4b3f28' : '#2d3420';
  for (const s of x.sol) {
    g.save(); g.translate(s.x, s.y); g.rotate(s.a + Math.PI / 2);
    if (!s.alive) { if (T - s.dieT < 40) { g.fillStyle = 'rgba(40,36,30,.6)'; g.beginPath(); g.ellipse(0, 0, .7 * k, 1.6 * k, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(90,20,12,.35)'; g.beginPath(); g.arc(.5, .8, .9 * k, 0, 7); g.fill(); } g.restore(); continue; }
    const bob = x.moving ? Math.sin(T * 14 + s.ox) * .35 : 0, firing = T - s.fireT < .12;
    g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(.9, 1.2, 1.4 * k, (s.prone ? 1.7 : .9) * k, 0, 0, 7); g.fill();
    g.strokeStyle = TEAM[x.side]; g.lineWidth = .9; g.fillStyle = body; g.beginPath(); if (s.prone) g.ellipse(0, .9 * k, .75 * k, 1.75 * k, 0, 0, 7); else g.ellipse(0, bob, 1.45 * k, .85 * k, 0, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = '#1b1a16'; g.lineWidth = .7; g.beginPath(); g.moveTo(.5 * k, -.2 * k); g.lineTo(.5 * k, -2.7 * k); g.stroke();
    g.fillStyle = helm; g.beginPath(); g.arc(0, 0, .62 * k, 0, 7); g.fill();
    if (firing) { g.globalCompositeOperation = 'lighter'; g.drawImage(glow, .5 * k - 3, -3.1 * k - 3, 6, 6); g.globalCompositeOperation = 'source-over'; }
    g.restore();
  }
}
function drawTrails(T: number) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const t of trails) { const n = t.pts.length; if (n < 2) continue;
    for (let i = 1; i < n; i += 3) { const p0 = t.pts[i - 1], age = T - p0.t, k = clamp(age / t.life, 0, 1), al = t.a * (1 - k) * (1 - k); if (al < .02) continue;
      g.strokeStyle = `rgba(${t.col},${al})`; g.lineWidth = t.w + age * t.grow; g.beginPath(); g.moveTo(p0.x, p0.y); for (let j = i; j < Math.min(n, i + 4); j++) g.lineTo(t.pts[j].x, t.pts[j].y); g.stroke(); } }
}
function drawMun(w: World) {
  for (const p of w.pr) {
    if (p.t < 0) continue;
    const q = munPos(p), y = q.y - lift(q.z), [ox, oy] = shadowOff(q.z), a = Math.atan2(p.ty - p.sy, p.tx - p.sx);
    if (p.kind === 'mg' || p.kind === 'can') { g.strokeStyle = p.side ? 'rgba(170,255,150,.95)' : 'rgba(255,214,120,.95)'; g.lineWidth = p.kind === 'can' ? 1.3 : .8; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - Math.cos(a) * (p.kind === 'can' ? 11 : 8), p.y - Math.sin(a) * (p.kind === 'can' ? 11 : 8)); g.stroke(); continue; }
    if (p.kind === 'ap') { g.strokeStyle = 'rgba(255,245,210,1)'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - Math.cos(a) * 26, p.y - Math.sin(a) * 26); g.stroke(); g.globalCompositeOperation = 'lighter'; g.drawImage(glow, p.x - 5, p.y - 5, 10, 10); g.globalCompositeOperation = 'source-over'; light(p.x, p.y, 26, .8, .04); continue; }
    if (q.z > 2) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(q.x + ox, q.y + oy, p.kind === 'bomb' ? 2.2 : 1.6, p.kind === 'bomb' ? 1.2 : .9, a, 0, 7); g.fill(); }
    const dx = Math.cos(a), dy = Math.sin(a) - (p.kind === 'shell' || p.kind === 'rocket' ? Math.cos(Math.PI * q.k) * .9 : 0), dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
    if (p.kind === 'shell') { g.strokeStyle = 'rgba(30,26,22,.7)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(q.x, y); g.lineTo(q.x - ux * 5, y - uy * 5); g.stroke(); continue; }
    if (p.kind === 'bomb') { g.save(); g.translate(q.x, y); g.rotate(a + Math.PI / 2 + q.k * .6); g.fillStyle = '#3d4036'; g.beginPath(); g.ellipse(0, 0, 1.3, 3.4, 0, 0, 7); g.fill(); g.fillRect(-1.6, 2.4, 3.2, .8); g.restore(); continue; }
    const len = p.kind === 'sam' ? 7 : p.kind === 'rocket' ? 5.5 : 3.5;
    g.strokeStyle = p.kind === 'sam' ? '#eeeeea' : '#4d5044'; g.lineWidth = p.kind === 'sam' ? 2 : 1.4; g.beginPath(); g.moveTo(q.x, y); g.lineTo(q.x - ux * len, y - uy * len); g.stroke();
    if (q.burning) { const fl = (p.kind === 'sam' ? 16 : p.kind === 'rpg' ? 7 : 11) * (1 + R(-.25, .25)) * (q.k < .08 ? 1.6 : 1); g.globalCompositeOperation = 'lighter'; g.drawImage(glow, q.x - ux * len - fl / 2, y - uy * len - fl / 2, fl, fl); g.save(); g.translate(q.x - ux * len, y - uy * len); g.rotate(Math.atan2(-uy, -ux)); g.drawImage(flameC, 0, -fl * .18, fl * .9, fl * .36); g.restore(); g.globalCompositeOperation = 'source-over'; }
  }
}
function drawParts(high: boolean) {
  for (const f of fx) {
    const isHigh = f.type === 'flare' && f.max > 1; if (isHigh !== high) continue;
    const k = f.life / f.max, y = f.y - lift(f.z);
    switch (f.type) {
      case 'ex': case 'ex2': { const fr = Math.min(24, Math.floor(k * 25)), src = f.type === 'ex' ? TEX.fx_explo1 : TEX.fx_explo2; g.drawImage(src, (fr % 5) * 200, Math.floor(fr / 5) * 200, 200, 200, f.x - f.size / 2, y - f.size * .62, f.size, f.size); break; }
      case 'fire': { const fr = Math.floor(k * 63), s = f.size * 2.4; g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k; g.drawImage(TEX.fx_fire, (fr % 8) * 64, Math.floor(fr / 8) * 64, 64, 64, f.x - s / 2, y - s / 2, s, s); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; break; }
      case 'spark': { g.strokeStyle = `rgba(255,220,140,${1 - k})`; g.lineWidth = .8; g.beginPath(); g.moveTo(f.x, y); g.lineTo(f.x - f.vx * .03, y - f.vy * .03); g.stroke(); break; }
      case 'debris': { g.fillStyle = `rgba(30,26,20,${1 - k * .6})`; g.fillRect(f.x - .7, f.y - lift(f.z) - .7, 1.4, 1.4); if (f.z > 0) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(f.x + f.z * .28, f.y + f.z * .16, 1, 1); } break; }
      case 'flare': { const s = f.size * (1 + Math.sin(f.life * 40) * .2); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k * .8; g.drawImage(glow, f.x - s, y - s, s * 2, s * 2); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; if (f.max > 1) { light(f.x, y, 22, .6, .05, '255,230,180'); if (Math.random() < .5) add('white', f.x, y, { max: 2.5, size: 1.5, grow: 2.5, a: .5 }); } break; }
      case 'ring': { g.strokeStyle = `rgba(255,248,232,${f.a * (1 - k)})`; g.lineWidth = 1.4 * (1 - k) + .3; g.beginPath(); g.arc(f.x, y, f.size, 0, 7); g.stroke(); break; }
      case 'cone': { g.save(); g.translate(f.x, f.y); g.rotate(f.ang ?? 0); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k; g.drawImage(flameC, 0, -f.size * .22, f.size, f.size * .44); g.restore(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; break; }
      default: { const src = puff[f.type], fa = Math.min(1, k * 5) * (1 - k) * f.a, s = f.size * 2.2; g.globalAlpha = fa; g.save(); g.translate(f.x, y); g.rotate(f.rot + f.life * .15); g.drawImage(src, (f.cell % 4) * 128, Math.floor(f.cell / 4) * 128, 128, 128, -s / 2, -s / 2, s, s); g.restore(); g.globalAlpha = 1; }
    }
  }
}
const TOD = { day: { amb: null as string | null, glow: .55 }, dusk: { amb: 'rgb(222,190,168)', glow: .8 }, night: { amb: 'rgb(70,78,112)', glow: 1.1 } };
function drawLights(z: number, ox: number, oy: number) {
  const L = lightC, lx = L.getContext('2d')!, cfg = TOD[tod], sc = .5 * z, tr = (x: number, y: number) => [(x * z + ox) * .5, (y * z + oy) * .5];
  if (cfg.amb) {
    lx.globalCompositeOperation = 'source-over'; lx.fillStyle = cfg.amb; lx.fillRect(0, 0, L.width, L.height); lx.globalCompositeOperation = 'lighter';
    for (const l of lights) { const [x, y] = tr(l.x, l.y), r = l.r * sc * 1.6, k = 1 - l.life / l.max, gr = lx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${l.col},${clamp(l.i * k, 0, 1)})`); gr.addColorStop(1, `rgba(${l.col},0)`); lx.fillStyle = gr; lx.fillRect(x - r, y - r, r * 2, r * 2); }
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalCompositeOperation = 'multiply'; g.drawImage(L, 0, 0, SW, SH); g.globalCompositeOperation = 'source-over';
  }
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalCompositeOperation = 'lighter';
  for (const l of lights) { if (l.i < .9) continue; const [x, y] = tr(l.x, l.y), r = l.r * z * .5, k = 1 - l.life / l.max; g.globalAlpha = clamp(l.i * k * .22 * cfg.glow, 0, 1); g.drawImage(glow, x * 2 - r, y * 2 - r, r * 2, r * 2); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
const baseZ = () => Math.min(SW / MW, SH / 900);
function draw(T: number) {
  const w = W!;
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = '#1d1b16'; g.fillRect(0, 0, SW, SH);
  const z = baseZ() * cam.z, sx = R(-shake, shake), sy = R(-shake, shake), ox = SW / 2 - cam.x * z + sx, oy = SH / 2 - cam.y * z + sy;
  g.setTransform(z * DPR, 0, 0, z * DPR, ox * DPR, oy * DPR);
  g.drawImage(ground, GX0, 0, GW, MH); g.drawImage(decal, GX0, 0, GW, MH);
  for (const b of w.b) { const sp = SPR[HOUSE[b.c % 4 + (b.id % 2)]], size = b.w * 1.25;
    if (b.dead) { sprite(sp, b.x, b.y, b.r - Math.PI / 2, size * .92, -1, true); g.fillStyle = 'rgba(120,106,88,.75)'; for (let i = 0; i < 6; i++) g.fillRect(b.x + ((i * 7) % 5 - 2.5) * b.w * .2, b.y + ((i * 11) % 5 - 2.5) * b.h * .2, b.w * .3, b.h * .22); if (Math.random() < .03) add('grey', b.x, b.y, { max: 7, size: 4, grow: 5, a: .5 }); }
    else { shadowOf(sp, b.x, b.y, b.r - Math.PI / 2, size, 3.5, 4.5, .42); sprite(sp, b.x, b.y, b.r - Math.PI / 2, size, -1, false);
      if (b.owner === 0) { g.strokeStyle = '#2b2416'; g.lineWidth = .7; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x, b.y - 10); g.stroke(); g.fillStyle = TEAM[0]; g.fillRect(b.x, b.y - 10, 6, 4); } } }
  for (const p of props) if (p.n === 'car1' || p.n === 'pickup') { const sp = SPR[p.n], s = 7 * S * p.s; shadowOf(sp, p.x, p.y, p.r, s, 1.2, 1.6, .35); sprite(sp, p.x, p.y, p.r, s, -1, true); }
  for (const x of w.u) drawUnit(x, T, 0);
  for (const x of w.u) drawUnit(x, T, 1);
  for (const x of w.u) if (x.type === 'inf') drawInf(x, T);
  for (const t of turretFly) if (t.name !== 'ah64') { const sp = SPR[t.name], s = 18 * S; if (t.z > 0) shadowOf(sp, t.x, t.y, t.a, s, t.z * .28, t.z * .16, .3); sprite(sp, t.x, t.y - lift(t.z), t.a, s, -1, true); }
  for (const p of props) if (p.n !== 'car1' && p.n !== 'pickup') { const sp = SPR[p.n], s = (p.n === 'palm' ? 6.5 : 7) * S * p.s; shadowOf(sp, p.x, p.y, p.r, s, 4, 5, .4); sprite(sp, p.x, p.y, p.r, s, -1, false); }
  drawParts(false); drawTrails(T); drawMun(w);
  // هليكوبترات
  for (const h of w.u) { if (h.type !== 'heli' || !h.alive) continue; const sp = SPR.ah64, size = 20 * S, hy = h.y - lift(h.alt);
    shadowOf(sp, h.x + h.alt * .28, h.y + h.alt * .16, h.hull, size, 0, 0, .28); sprite(sp, h.x, hy, h.hull, size, h.side, false);
    g.strokeStyle = 'rgba(15,15,15,.45)'; g.lineWidth = 1.2; for (let i = 0; i < 4; i++) { const a = T * 40 + i * Math.PI / 2; g.beginPath(); g.moveTo(h.x, hy); g.lineTo(h.x + Math.cos(a) * 9 * S, hy + Math.sin(a) * 9 * S); g.stroke(); }
    g.fillStyle = 'rgba(30,30,30,.13)'; g.beginPath(); g.arc(h.x, hy, 9 * S, 0, 7); g.fill();
    if (h.alt < 20 && Math.random() < .3) add('dust', h.x + h.alt * .28, h.y + h.alt * .16, { max: 1.5, size: 6, grow: 10, a: .35 }); }
  for (const t of turretFly) if (t.name === 'ah64') { const sp = SPR.ah64, s = 20 * S; shadowOf(sp, t.x + t.z * .28, t.y + t.z * .16, t.a, s, 0, 0, .25); sprite(sp, t.x, t.y - lift(t.z), t.a, s, -1, t.z <= 0); if (t.z > 0 && Math.random() < .5) add('black', t.x, t.y - lift(t.z), { max: 4, size: 3, grow: 4, a: .8 }); }
  // طيارات ومسيّرات
  for (const j of w.air) { if (!j.alive && j.state !== 'down') continue; const jet = j.kind === 'jet', sp = SPR[j.model], size = (jet ? 17 : j.side ? 9 : 16) * S, a = Math.atan2(j.vy, j.vx) + (j.state === 'down' ? j.spin : 0), jy = j.y - lift(j.alt);
    shadowOf(sp, j.x + j.alt * .28, j.y + j.alt * .16, a, size, 0, 0, .22); sprite(sp, j.x, jy, a, size * (j.state === 'down' ? .9 : 1), j.side, j.state === 'down');
    if (jet && j.state !== 'down') { const tx = j.x - Math.cos(a) * size * .46, ty2 = jy - Math.sin(a) * size * .46, fl = 8 + R(-1.5, 1.5); g.globalCompositeOperation = 'lighter'; g.drawImage(glow, tx - fl / 2, ty2 - fl / 2, fl, fl); g.globalCompositeOperation = 'source-over'; light(tx, ty2, 20, .5, .04, '255,180,110'); } }
  drawParts(true);
  if (tod !== 'night') for (const c of clouds) { const gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r); gr.addColorStop(0, 'rgba(20,18,30,.15)'); gr.addColorStop(1, 'rgba(20,18,30,0)'); g.fillStyle = gr; g.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2); }
  drawLights(z, ox, oy);
}
function camFollow(w: World, dt: number) {
  if (!cam.auto) return;
  // الكاميرا تتبع الجبهة: النص بين خط الهجوم وخط الدفاع، والصورة تبقى ضمن الخريطة
  const z = baseZ() * cam.z, half = SH / 2 / z, ty = clamp((w.frontA + w.frontD) / 2 + 40, half - 40, MH - half + 40), tx = MW / 2;
  const k = 1 - Math.exp(-dt * .8); cam.y += (ty - cam.y) * k; cam.x += (tx - cam.x) * k;
}

// ===== الشريط =====
let endShown = false, lastPh = '';
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function hud() {
  const w = W!, ph = phaseName(w);
  if (ph !== lastPh) { lastPh = ph; $('bphase').textContent = ph; }
  const b = bars(w); ($('bla') as HTMLElement).style.width = clamp(b.a, 0, 100) + '%'; ($('bld') as HTMLElement).style.width = clamp(b.d, 0, 100) + '%';
  const cnt = (s: 0 | 1) => { const t = w.u.filter(u => u.side === s && u.type === 'tank' && u.alive).length, j = w.air.filter(a => a.side === s && a.kind === 'jet' && a.alive && a.state !== 'down').length; return `دبابات ${t}<small>+${w.pool[s].tank}</small> · طائرات ${w.pool[s].jet + j}`; };
  $('cna').innerHTML = cnt(0); $('cnd').innerHTML = cnt(1);
  $('bwhere').innerHTML = `${w.res.rname} — ${TERR_N[w.res.terr]} <b>${mmss(Math.min(w.T, END))}</b>`;
  if (ac && amb) amb.gain.setTargetAtTime(w.T > 105 && !w.over ? .2 : w.T > 25 && !w.over ? .07 : 0, ac.currentTime, .8);
  if (ac && heliG) { const n = w.u.filter(h => h.type === 'heli' && h.alive && h.alt > 5).length; heliG.gain.setTargetAtTime(Math.min(.45, n * .12), ac.currentTime, .6); }
  const now = performance.now(); for (const f of feed) f.el.style.opacity = String(clamp(1 - (now - f.t - 4500) / 1200, 0, 1));
  if (w.over && !endShown) {
    endShown = true; const res = w.res, e = $('bend'); e.hidden = false; e.className = res.win ? 'win' : 'lose';
    e.innerHTML = `<div class="stamp">${stamp(res)}</div><h2>${res.rname}</h2><p>خسرت ${Math.round(res.la * 100)}٪ من القوة المشاركة، والعدو خسر ${Math.round(res.ld * 100)}٪ من مدافعيه. المدة ${res.wk} أسابيع.</p><p class="sub">دبابات خسرناها ${w.killed.veh[0]} · دمّرنا ${w.killed.veh[1]} · طائرات ومسيّرات أسقطنا ${w.killed.air[1]} وخسرنا ${w.killed.air[0]}</p><button class="btn go" id="bBack">رجوع للقيادة</button><button class="btn" id="bAgain">شوفها مرة ثانية</button>`;
    $('bBack').onclick = () => showStart(); $('bAgain').onclick = () => startBattle();
  }
}
function startBattle() {
  const res: Res = { ...structuredClone(SAMPLES[curRes]), terr, an: 'العراق', bn: 'العدو' };
  W = create(res); fx = []; trails = []; lights = []; shake = 0; recoil.clear(); mun.clear(); turretFly.length = 0; feed.forEach(f => f.el.remove()); feed.length = 0;
  buildGround(terr, W as any); cam.x = MW / 2; cam.y = 1000; cam.z = 1; cam.auto = true;
  $('bna').textContent = res.an!; $('bnd').textContent = res.bn!; endShown = false; lastPh = ''; setSpeed(1);
  ($('start') as HTMLElement).hidden = true; $('hud').hidden = false; $('ctl').hidden = false; $('bend').hidden = true; running = true; audio(); startLoops();
}
function showStart() { running = false; ($('start') as HTMLElement).hidden = false; $('hud').hidden = true; $('ctl').hidden = true; $('bend').hidden = true; if (ac && amb) amb.gain.value = 0; if (ac && heliG) heliG.gain.value = 0; }
function setSpeed(s: number) { speed = s; $('spd').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+(b as HTMLElement).dataset.s! === s))); }
$('spd').querySelectorAll('button').forEach(b => b.addEventListener('click', () => setSpeed(+(b as HTMLElement).dataset.s!)));
$('bSkip').onclick = () => { if (W && !W.over) { setSpeed(1); skip(W); } };
$('bFit').onclick = () => { cam.z = 1; cam.auto = true; };
$('bMute').onclick = () => { muted = !muted; $('bMute').textContent = muted ? '🔇' : '🔊'; if (muted && ac) ac.suspend(); else if (ac) ac.resume(); };
const seg = (id: string, f: (v: string) => void) => $(id).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); f((b as HTMLElement).dataset.v!); }));
seg('sRes', v => { curRes = v; terr = SAMPLES[v].terr; $('sTerr').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.v === terr))); });
seg('sTerr', v => { terr = v as Terr; }); seg('sTod', v => { tod = v as typeof tod; });
$('bGo').onclick = () => startBattle();
$('credBtn').onclick = () => { $('credits').hidden = false; }; $('credX').onclick = () => { $('credits').hidden = true; };
const ptrs = new Map<number, { x: number; y: number }>(); let pinch = 0;
cv.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return;
  if (ptrs.size === 1) { const z = baseZ() * cam.z; cam.x = clamp(cam.x - (e.clientX - p.x) / z, 0, MW); cam.y = clamp(cam.y - (e.clientY - p.y) / z, 0, MH); cam.auto = false; }
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); p.x = e.clientX; p.y = e.clientY; const [c, d] = [...ptrs.values()], d1 = Math.hypot(c.x - d.x, c.y - d.y); if (pinch && d0) cam.z = clamp(cam.z * d1 / d0, .7, 4); pinch = d1; cam.auto = false; return; }
  p.x = e.clientX; p.y = e.clientY; });
const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch = 0; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); cam.z = clamp(cam.z * Math.exp(-e.deltaY * .0015), .7, 4); cam.auto = false; }, { passive: false });

let last = performance.now();
function frame(now: number) {
  const rdt = clamp((now - last) / 1000, 0, .05); last = now;
  if (running && W && W.T < END + 600) { let left = rdt * speed; while (left > 1e-6) { const d = Math.min(.05, left); left -= d; step2(d); } camFollow(W, rdt); hud(); }
  if (W && ground) draw(W.T); else { g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = '#1d1b16'; g.fillRect(0, 0, SW, SH); }
  requestAnimationFrame(frame);
}
(async () => {
  const L = $('load');
  try { await loadAll(t => { L.textContent = t; }); } catch (e) { L.textContent = 'خطأ بالتحميل: ' + (e as Error).message; return; }
  L.textContent = ''; const go = $('bGo') as HTMLButtonElement; go.disabled = false; go.textContent = 'ابدأ المعركة';
  requestAnimationFrame(frame);
  if (AUTO) { const r = qs.get('r'); if (r && SAMPLES[r]) { curRes = r; terr = SAMPLES[r].terr; } if (qs.get('terr')) terr = qs.get('terr') as Terr; if (qs.get('tod')) tod = qs.get('tod') as typeof tod; startBattle(); (window as any).ready = true; }
})();
(window as any).seek = (t: number) => { if (!W) return; while (W.T < t && !W.over) { step2(1 / 30); camFollow(W, 1 / 30); } hud(); };
(window as any).zoomAt = (x: number, y: number, z: number) => { cam.x = x; cam.y = y; cam.z = z; cam.auto = false; };
void (null as unknown as Air);
