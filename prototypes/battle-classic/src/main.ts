// المعركة الكلاسيكية v2 (I-052، D-027): نفس منطق معركة الأصل (sim.ts)، والرسم «كأنك بأرض المعركة»:
// - ذخيرة بمراحل: إشعال ← خروج بطيء ← تسارع ← لهب يرتجف ← انطفاء وسقوط، وذيول دخان متصلة تبقى وتتمدد مع الريح
// - إطلاقات لكل سلاح: غراد (عصفة خلفية وغبار)، D-30 (لهب الفوهة الجانبي وموجة ضغط)، دبابة (غبار العصفة)، صواريخ دفاع جوي (إطلاق عمودي)
// - الطيارات ترمي مشاعل حرارية لما ينطلق عليها صاروخ، والقنابل تنشاف وهي تنزل
// - إضاءة (نهار/غروب/ليل) والوهج يضوّي الأرض، ظلال غيوم
// - أرض من صور جوية حقيقية (Poly Haven)، وادي، سواتر وخنادق، أسوار بيوت، بساتين
// - أصوات حقيقية + يمين/يسار + صدى + تأخير بالمسافة
import { create, step, bars, phase, skip, stamp, SAMPLES, VW, VH, END, CARD, PPM, K, World, Res, Unit, Proj, Terr } from './sim';
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
const S = Math.max(.75, PPM * 9);   // مقياس أيقونات الأصل
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
function variants(img: HTMLImageElement, m: number, piv?: number[]): Spr {
  const n = 160, base = mk(n, n), bg = base.getContext('2d')!; bg.drawImage(img, 0, 0, n, n);
  const sil = (col: string, blur = 0) => { const c = mk(n, n), x = c.getContext('2d')!; if (blur) x.filter = `blur(${blur}px)`; x.drawImage(base, 0, 0); x.filter = 'none'; x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, n, n); return c; };
  const side = TEAM.map(col => { const s = sil(col), c = mk(n, n), x = c.getContext('2d')!; for (let a = 0; a < 8; a++) x.drawImage(s, Math.cos(a * Math.PI / 4) * 3.6, Math.sin(a * Math.PI / 4) * 3.6); x.drawImage(base, 0, 0); return c; });
  const dark = mk(n, n), dx = dark.getContext('2d')!; dx.drawImage(base, 0, 0); dx.globalCompositeOperation = 'source-atop'; dx.fillStyle = 'rgba(20,17,14,.86)'; dx.fillRect(0, 0, n, n);
  return { side, dark, shadow: sil('#000', 2), plain: base, piv, m };
}
async function loadAll(say: (t: string) => void) {
  const names = Object.keys(MAN).filter(n => n !== 'h5'); let k = 0;
  await Promise.all(names.map(async n => { SPR[n] = variants(await loadImg(sprUrls[`../../battle2d/sprites/${n}.png`]), MAN[n].m, MAN[n].piv); say(`يحمّل الصور… ${++k}/${names.length}`); }));
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
const GX0 = -260, GW = VW + 520, GR = 2;
let ground: HTMLCanvasElement, decal: HTMLCanvasElement, dctx: CanvasRenderingContext2D, overlay: HTMLCanvasElement;
const roadPts: [number, number][] = (() => { const o: [number, number][] = []; const a = [VW * .5, VH], b = [VW * .3, VH * .7], c = [VW * .7, VH * .45], d = [VW * .52, VH * .2]; for (let i = 0; i <= 60; i++) { const t = i / 60, u = 1 - t; o.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]); } o.push([VW * .5, 0]); return o; })();
const wadiY = (x: number) => VH * .6 + Math.sin(x / 70) * 22 + Math.sin(x / 31 + 1) * 8 + Math.sin(x / 13 + 2) * 3;
function buildGround(terr: Terr, w: World) {
  const seed = Math.random() * 100, Wpx = GW * GR, Hpx = VH * GR;
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
  const ty0 = VH * .2 + 30; G.strokeStyle = 'rgba(40,30,22,.75)'; G.lineWidth = 2.2; G.beginPath(); for (let x = VW * .08; x <= VW * .92; x += 9) { const y = ty0 + ((x / 9) % 2 ? 4 : -4); x === VW * .08 ? G.moveTo(x, y) : G.lineTo(x, y); } G.stroke();
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
  for (let i = 0, t = 0; i < 42 && t < 900; t++) { const x = R(-60, VW + 60), y = R(10, VH * .3); if (w.b.some(b => Math.hypot(b.x - x, b.y - y) < b.w * 1.6) || w.u.some(u => u.side === 1 && Math.hypot(u.x - x, u.y - y) < 18) || roadDist(x, y) < 8) continue; props.push({ n: palm ? 'palm' : 'tree', x, y, r: R(0, 6.28), s: R(.8, 1.15) }); i++; }
  for (let i = 0; i < 26; i++) { const side = Math.random() < .5 ? -1 : 1, x = side < 0 ? R(-200, 20) : R(VW - 20, VW + 200), y = R(0, VH); props.push({ n: terr === 'desert' ? 'acacia' : 'tree', x, y, r: R(0, 6.28), s: R(.8, 1.3) }); }
  for (let i = 0; i < 4; i++) { const [x, y] = roadPts[8 + Math.floor(Math.random() * 40)]; props.push({ n: Math.random() < .5 ? 'car1' : 'pickup', x: x + (Math.random() < .5 ? -9 : 9), y, r: R(0, 6.28), s: 1 }); }
  // ظلال الغيوم
  clouds = Array.from({ length: 5 }, () => ({ x: R(-200, VW + 200), y: R(0, VH), r: R(90, 170) }));
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

// ===== الصوت: تسجيلات + يمين/يسار + صدى + تأخير المسافة + الضربة الواطية للأصل =====
let speed = 1, muted = false, ac: AudioContext | null = null, master: GainNode, wet: GainNode, active = 0, amb: GainNode | null = null, heliG: GainNode | null = null;
const smp: Record<string, AudioBuffer> = {};
function audio() {
  if (muted) return null;
  try {
    if (!ac) {
      ac = new AudioContext(); master = ac.createGain(); master.gain.value = .9; const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master.connect(comp).connect(ac.destination);
      // صدى مفتوح (ارتداد عن التلال): نبضة ضجيج تخفت 2.6 ث
      const ir = ac.createBuffer(2, ac.sampleRate * 2.6, ac.sampleRate); for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6) * (i < ac.sampleRate * .06 ? 0 : 1); }
      const conv = ac.createConvolver(); conv.buffer = ir; wet = ac.createGain(); wet.gain.value = .32; wet.connect(conv).connect(master);
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
const distOf = (x: number, y: number) => Math.hypot(x - cam.x, y - cam.y) / PPM;   // متر «بالقصة» (الساحة 3 كم)
function play(name: string, x: number, y: number, vol: number, o: { rate?: number; delay?: number; wet?: number; lp?: number } = {}) {
  const a = ac; if (!a || !smp[name] || active > 26) return;
  const d = distOf(x, y), t = a.currentTime + (o.delay ?? 0) + d / 340 / speed, v = vol * Math.min(1, 1.1 / (1 + d / 1100));
  if (v < .02) return;
  const s = a.createBufferSource(); s.buffer = smp[name]; s.playbackRate.value = (o.rate ?? 1) * R(.95, 1.05);
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp ?? clamp(14000 - d * 3.2, 1200, 14000);
  const gn = a.createGain(); gn.gain.value = v; const pan = a.createStereoPanner(); pan.pan.value = clamp((x - cam.x) / (VW * .6 / cam.z), -.85, .85);
  s.connect(f).connect(gn).connect(pan).connect(master); const ws = a.createGain(); ws.gain.value = o.wet ?? .5; pan.connect(ws).connect(wet);
  s.start(t); active++; s.onended = () => active--;
}
function thump(x: number, y: number, size: number) {   // ضربة الأصل الواطية (90→28 هرتز) تنحس بالصدر
  const a = ac; if (!a) return; const d = distOf(x, y), t = a.currentTime + d / 340 / speed, vol = Math.min(1, .9 / (1 + d / 900));
  const o = a.createOscillator(), og = a.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(26, t + .55); og.gain.setValueAtTime(vol * (.35 + size * .12), t); og.gain.exponentialRampToValueAtTime(.001, t + .7); o.connect(og).connect(master); o.start(t); o.stop(t + .75);
}
function jetSound(x: number) {
  const a = ac; if (!a) return; const t = a.currentTime, dur = 3.4;
  if (smp.jet_roar) { const s = a.createBufferSource(); s.buffer = smp.jet_roar; s.playbackRate.setValueAtTime(1.25, t); s.playbackRate.linearRampToValueAtTime(.8, t + dur); const gn = a.createGain(); gn.gain.setValueAtTime(.001, t); gn.gain.linearRampToValueAtTime(.55, t + dur * .45); gn.gain.exponentialRampToValueAtTime(.001, t + dur); const pan = a.createStereoPanner(); pan.pan.setValueAtTime(clamp((x - VW / 2) / VW, -.8, .8), t); s.connect(gn).connect(pan).connect(master); pan.connect(wet); s.start(t, .3); s.stop(t + dur); }
  // صفير النفاث (مولّد مثل الأصل)
  const n = a.createBufferSource(), buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; n.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(600, t); f.frequency.linearRampToValueAtTime(2600, t + dur * .45); f.frequency.linearRampToValueAtTime(300, t + dur);
  const gn = a.createGain(); gn.gain.setValueAtTime(.001, t); gn.gain.linearRampToValueAtTime(.3, t + dur * .45); gn.gain.exponentialRampToValueAtTime(.001, t + dur); n.connect(f).connect(gn).connect(master); n.start(t); n.stop(t + dur);
}

// ===== الذخيرة المرئية: كل مقذوف بالمحاكاة إله «حياة» حقيقية =====
interface Mun { id: number; kind: string; tr: Trail | null; tr2: Trail | null; whistle: boolean; burnout: boolean; side: number; jet?: number; wob: number }
const mun = new Map<number, Mun>();
/** مكان المقذوف المرئي: نفس طريق المحاكاة ونفس وقت الوصول، بس بسرعة متغيرة وارتفاع */
function munPos(p: Proj): { x: number; y: number; z: number; burning: boolean; k: number } {
  const k = clamp(p.t / p.dur, 0, 1), d = Math.hypot(p.tx - p.sx, p.ty - p.sy);
  if (p.kind === 'rocket') {   // غراد: يطلع بطيء ويسرّع (k^1.7)، المحرك يحترق لحد 45٪، وبعدها سقوط
    const e = Math.pow(k, 1.7), x = lerp(p.sx, p.tx, e), y = lerp(p.sy, p.ty, e), z = Math.sin(Math.PI * e) * Math.max(30, d * .28) + (1 - e) * 3;
    return { x, y, z, burning: e < .45, k };
  }
  if (p.kind === 'msl') {   // دفاع جوي: يطلع عمودي 18٪ من الوقت، وبعدها ينعطف للهدف
    const up = clamp(k / .18, 0, 1), e = Math.pow(clamp((k - .12) / .88, 0, 1), 1.25), x = lerp(p.sx, p.tx, e), y = lerp(p.sy, p.ty, e), z = lerp(0, 34, Math.sqrt(up)) + e * 34;
    return { x, y, z, burning: true, k };
  }
  if (p.kind === 'atgm') { const e = Math.pow(k, 1.25), x = lerp(p.sx, p.tx, e), y = lerp(p.sy, p.ty, e); return { x, y, z: (1 - e) * 14 + Math.sin(k * 30) * .6, burning: true, k }; }
  if (p.kind === 'shell') { const x = lerp(p.sx, p.tx, k), y = lerp(p.sy, p.ty, k); return { x, y, z: Math.sin(Math.PI * k) * Math.max(40, d * .35), burning: false, k }; }
  if (p.kind === 'bomb') { const x = lerp(p.sx, p.tx, k), y = lerp(p.sy, p.ty, k); return { x, y, z: 36 * (1 - k * k), burning: false, k }; }
  return { x: p.x, y: p.y, z: p.kind === 'tank' ? 1.5 : 1, burning: false, k };
}
const lift = (z: number) => z * .55;            // الارتفاع يبين لفوق بالشاشة
const shadowOff = (z: number) => [z * .28, z * .16];   // والظل ينزاح لتحت-يمين
function updateMun(w: World, dt: number) {
  const seen = new Set<number>();
  for (const p of w.pr) {
    seen.add(p.id); if (p.t < 0) continue;
    let m = mun.get(p.id);
    const q = munPos(p), y = q.y - lift(q.z);
    if (!m) {
      m = { id: p.id, kind: p.kind, tr: null, tr2: null, whistle: false, burnout: false, side: p.side ?? 0, wob: R(0, 6) }; mun.set(p.id, m);
      if (p.kind === 'rocket') { m.tr = trail(1.1, 1.5, 6, '228,226,220', .62); m.tr2 = trail(.5, .8, .9, '255,200,120', .5); }
      else if (p.kind === 'msl') { m.tr = trail(1.6, 2, 9, '240,240,236', .75); }
      else if (p.kind === 'atgm') m.tr = trail(.6, 1, 3.5, '220,220,215', .5);
      else if (p.kind === 'bomb') { if (Math.random() < .5) play('incoming', p.tx, p.ty, .35, { rate: 1.6 }); }
    }
    if (m.tr && (q.burning || p.kind !== 'rocket')) m.tr.pts.push({ x: q.x, y, t: w.T }); else if (m.tr && !m.burnout) { m.burnout = true; m.tr.done = true; if (m.tr2) m.tr2.done = true; }
    if (m.tr2 && q.burning) m.tr2.pts.push({ x: q.x, y, t: w.T });
    if (q.burning) light(q.x, y, p.kind === 'msl' ? 26 : 16, p.kind === 'msl' ? .9 : .6, .06, '255,190,110');
    // صفير القذيفة الجاية قبل ما توصل
    if ((p.kind === 'shell' || (p.kind === 'rocket' && m.burnout)) && !m.whistle && p.dur - p.t < 1.6) { m.whistle = true; if (Math.random() < (p.kind === 'shell' ? .45 : .25)) play('incoming', p.tx, p.ty, .4, { delay: 0, rate: R(1.1, 1.4) }); }
  }
  for (const [id, m] of mun) if (!seen.has(id)) { if (m.tr) m.tr.done = true; if (m.tr2) m.tr2.done = true; mun.delete(id); }
  // الذيول تنجرف مع الريح وتنمسح
  for (const t of trails) { for (const p of t.pts) { p.x += WIND.x * dt * .6; p.y += WIND.y * dt * .6; } while (t.pts.length && w.T - t.pts[0].t > t.life) t.pts.shift(); }
  trails = trails.filter(t => t.pts.length || !t.done);
}

// ===== أحداث المحاكاة ← مشاهد =====
let W: World | null = null, terr: Terr = 'desert', curRes = 'win', running = false, tod: 'day' | 'dusk' | 'night' = 'dusk';
const mgT = new Map<number, number>(), recoil = new Map<number, number>(), jetFlare = new Map<number, number>(), turretFly: { x: number; y: number; z: number; vx: number; vy: number; vz: number; a: number; va: number; name: string; t: number }[] = [];
function explosion(x: number, y: number, cal: number, airZ = 0) {
  const r = cal * PPM * 14 + 3, big = cal >= 2.2, yy = y - lift(airZ);
  add(big ? 'ex' : 'ex2', x, yy, { max: big ? 1.4 : 1.1, size: r * (big ? 3.8 : 2.8) });
  add('ring', x, yy, { max: .35, size: r * 1.2, grow: r * 9, a: .55 });                  // موجة الضغط
  add('fire', x, yy, { n: 5 + cal * 3, spd: 40, max: .5, size: r * .6 });
  add('spark', x, yy, { n: 8 + cal * 5, spd: 160, max: .6, size: 1 });
  add('debris', x, yy, { n: 6 + cal * 4, spd: 55, max: 1.2, size: 1.1, vz: 40 });
  if (!airZ) { add('dust', x, y, { n: 4 + cal * 2, spd: 22, max: 3.5, size: r * .9, grow: 6, a: .75 }); add(big ? 'black' : 'grey', x, y, { n: 2 + cal, spd: 6, max: 6 + cal * 2, size: r * .8, grow: 5, a: .8 }); crater(x, y, r * 1.15); }
  light(x, yy, r * 7, 1.4, .35); shake = Math.max(shake, cal * 2.2 * clamp(1.4 - distOf(x, y) / 3000, .3, 1));
  play(cal >= 3 ? 'boom_huge' : cal >= 2.2 ? (Math.random() < .5 ? 'boom_big' : 'boom_bomb') : distOf(x, y) > 1600 ? 'boom_far' : 'boom_mid', x, y, cal >= 3 ? .9 : .55 + cal * .12, { rate: R(.9, 1.08), wet: .7 }); thump(x, y, cal);
}
function handle(e: World['fx'][0]) {
  const w = W!;
  switch (e.k) {
    case 'boom': explosion(e.x, e.y, e.cal); break;
    case 'muzzle': {
      const a = e.a, ca = Math.cos(a), sa = Math.sin(a), u = w.u.find(q => q.id === e.src); recoil.set(e.src, w.T);
      if (e.kind === 'tank') {   // دبابة: لهب موجّه + غبار العصفة حول الدبابة + دخان الفوهة
        const L = 15.5 * S * .5, mx = e.x + ca * L, my = e.y + sa * L;
        add('cone', mx, my, { max: .09, size: 26, ang: a }); add('ring', mx, my, { max: .25, size: 4, grow: 160, a: .35 });
        add('dust', e.x, e.y, { n: 7, spd: 34, max: 2.6, size: 7, grow: 7, a: .65 }); add('grey', mx, my, { n: 3, vx: ca * 14, vy: sa * 14, max: 2.2, size: 4, grow: 5, a: .6 });
        light(mx, my, 60, 1.1, .12); play('tank', e.x, e.y, .8, { rate: R(.92, 1.05) }); thump(e.x, e.y, 1);
      } else if (e.kind === 'shell') {   // D-30: لهب كبير + لهب الكابح الجانبي + موجة ضغط + غبار ودخان يبقى
        const L = 13 * S * .5, mx = e.x + ca * L, my = e.y + sa * L;
        add('cone', mx, my, { max: .12, size: 34, ang: a }); add('cone', mx, my, { max: .08, size: 13, ang: a + 1.57 }); add('cone', mx, my, { max: .08, size: 13, ang: a - 1.57 });
        add('ring', mx, my, { max: .4, size: 6, grow: 220, a: .45 }); add('dust', e.x, e.y, { n: 10, spd: 40, max: 3.5, size: 8, grow: 8, a: .7 });
        add('grey', mx, my, { n: 4, vx: ca * 10, vy: sa * 10, max: 5, size: 6, grow: 6, a: .65 });
        light(mx, my, 90, 1.4, .15); play(Math.random() < .5 ? 'howitzer' : 'mortar', e.x, e.y, .85, { wet: .8 }); thump(e.x, e.y, 1.6);
      } else if (e.kind === 'rocket') {   // غراد: إشعال + عصفة خلفية كبيرة (غبار ودخان ورا الراجمة)
        add('flare', e.x, e.y - 3, { max: .15, size: 12 }); add('dust', e.x - ca * 10, e.y - sa * 10, { n: 4, spd: 26, max: 3, size: 8, grow: 8, a: .75 });
        add('white', e.x - ca * 6, e.y - sa * 6, { n: 2, spd: 10, max: 4.5, size: 7, grow: 7, a: .7 });
        light(e.x, e.y, 70, 1.2, .2); play('rocket', e.x, e.y, .6, { rate: R(.85, 1.15) }); play('woosh', e.x, e.y, .5, { rate: R(.7, .9) });
      } else if (e.kind === 'msl') {   // دفاع جوي: غيمة إطلاق كبيرة + لهب لتحت + هدير
        add('white', e.x, e.y, { n: 8, spd: 30, max: 5, size: 9, grow: 8, a: .85 }); add('flare', e.x, e.y, { max: .3, size: 22 });
        light(e.x, e.y, 110, 1.6, .5); play('launch', e.x, e.y, .9, { wet: .7 }); thump(e.x, e.y, 1.2);
        // الطيارة المستهدفة ترمي مشاعل حرارية
        const j = w.air.filter(q => q.kind === 'jet' && q.side !== (u?.side ?? 1)).sort((p1, p2) => Math.hypot(p1.x - e.x - Math.cos(a) * 200, p1.y - e.y - Math.sin(a) * 200) - Math.hypot(p2.x - e.x - Math.cos(a) * 200, p2.y - e.y - Math.sin(a) * 200))[0];
        if (j) jetFlare.set(j.id, w.T);
      } else if (e.kind === 'atgm') { add('flare', e.x, e.y - 8, { max: .12, size: 9 }); add('white', e.x, e.y - 8, { n: 2, spd: 8, max: 2, size: 3, grow: 4, a: .6 }); play('atgm', e.x, e.y, .75); }
      break;
    }
    case 'mg': { mgT.set(e.src, w.T); if (Math.random() < .3 && speed <= 2) play(Math.random() < .5 ? 'akburst' : 'hmg', e.x, e.y, .28, { rate: R(.95, 1.1), wet: .4 }); break; }
    case 'mghit': if (Math.random() < .5) add('dust', e.x, e.y, { max: .9, size: 1.6, grow: 2, a: .6 }); if (Math.random() < .08) play('ricochet', e.x, e.y, .2); break;
    case 'mslhit': { add('ex2', e.x, e.y - lift(60), { max: 1, size: 34 }); add('spark', e.x, e.y - lift(60), { n: 18, spd: 140, max: .8, size: 1 }); add('grey', e.x, e.y - lift(60), { n: 4, spd: 6, max: 5, size: 6, grow: 5, a: .7 }); light(e.x, e.y - lift(60), 90, 1.2, .3); play('blast', e.x, e.y, .6, { wet: .9 }); break; }
    case 'screen': add('white', e.x, e.y, { n: 6, spd: 12, max: 22, size: 16, grow: 4, a: .9, jit: 10 }); add('flare', e.x, e.y, { max: .2, size: 8 }); play('blast', e.x, e.y, .25, { rate: 1.3 }); break;
    case 'house': { const b = w.b[e.id]; add('dust', b.x, b.y, { n: 14, spd: 26, max: 5, size: b.w * .6, grow: 6, a: .85 }); add('black', b.x, b.y, { n: 4, spd: 6, max: 9, size: b.w * .5, grow: 4, a: .8 }); add('debris', b.x, b.y, { n: 14, spd: 50, max: 1.4, size: 1.4, vz: 40 }); play('blast', b.x, b.y, .5); break; }
    case 'jet': { const j = w.air.find(q => q.id === e.id); if (j) jetSound(j.x); break; }
    case 'die': {
      const u = w.u.find(q => q.id === e.id); if (!u || u.type === 'inf') break;
      // إصابة قاتلة: كرة نار ثانوية + البرج يطير + حريق يبقى
      setTimeout(() => { if (!W) return; add('ex', u.x, u.y, { max: 1.3, size: 40 }); add('fire', u.x, u.y, { n: 10, spd: 50, max: .7, size: 4 }); light(u.x, u.y, 120, 1.6, .5); play('boom_big', u.x, u.y, .55); }, 250 / speed);
      if (u.type === 'tank' && Math.random() < .45) turretFly.push({ x: u.x, y: u.y, z: 0, vx: R(-14, 14), vy: R(-14, 14), vz: R(60, 90), a: u.a, va: R(-9, 9), name: (u.side ? 't72' : 'abrams') + '_t', t: w.T });
      scorch(u.x, u.y, 16); break;
    }
  }
}
function step2(dt: number) {
  const w = W!; step(w, dt); for (const e of w.fx) handle(e); w.fx.length = 0;
  updateMun(w, dt);
  // حرايق المركبات المضروبة: لهب + عمود دخان أسود ينجرف + طقطقة ذخيرة
  for (const x of w.u) if (x.burn! > 0) { if (Math.random() < dt * 9) add('fire', x.x + R(-3, 3), x.y + R(-3, 3), { max: .6, size: 3.5, vy: -6 }); if (Math.random() < dt * 4) add('black', x.x, x.y, { max: 9, size: 4, grow: 6, a: .75, vx: WIND.x * 1.6, vy: WIND.y * 2 - 4 }); if (Math.random() < dt * .6) { add('spark', x.x, x.y, { n: 8, spd: 90, max: .5 }); add('flare', x.x, x.y, { max: .08, size: 6 }); } light(x.x, x.y, 46, .5 + Math.random() * .25, .05, '255,140,60'); }
  // الطيارات: مشاعل حرارية لما ينطلق عليها صاروخ (رشقة 1.4 ث)
  for (const j of w.air) { const t0 = jetFlare.get(j.id); if (t0 !== undefined && w.T - t0 < 1.4 && Math.random() < dt * 22) { const a = Math.atan2(j.vy, j.vx); add('flare', j.x, j.y - lift(60), { max: 2.2, size: 4, vx: -Math.cos(a) * 60 + R(-50, 50), vy: -Math.sin(a) * 60 + R(-50, 50), z: 0, a: 1 }); } }
  for (const t of turretFly) { t.x += t.vx * dt; t.y += t.vy * dt; t.vz -= 140 * dt; t.z = Math.max(0, t.z + t.vz * dt); t.a += t.va * dt; if (t.z === 0) { t.vx *= .5; t.vy *= .5; t.va *= .5; } }
  for (const f of fx) { f.life += dt; f.x += (f.vx + (f.type === 'black' || f.type === 'grey' || f.type === 'white' || f.type === 'smoke' || f.type === 'dust' ? WIND.x : 0)) * dt; f.y += (f.vy + (f.type === 'black' || f.type === 'grey' || f.type === 'white' ? WIND.y : 0)) * dt;
    const dmp = f.type === 'spark' || f.type === 'debris' || f.type === 'flare' ? .985 : .93; f.vx *= dmp; f.vy *= dmp; if (f.type === 'debris') { f.vz -= 120 * dt; f.z = Math.max(0, f.z + f.vz * dt); } f.size += f.grow * dt; }
  fx = fx.filter(f => f.life < f.max); if (fx.length > 1400) fx.splice(0, fx.length - 1400);
  for (const l of lights) l.life += dt; lights = lights.filter(l => l.life < l.max);
  shake *= Math.pow(.02, dt);
  fadeT += dt; if (fadeT > 1) { fadeT = 0; dctx.save(); dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = 'destination-out'; dctx.fillStyle = 'rgba(0,0,0,.025)'; dctx.fillRect(0, 0, decal.width, decal.height); dctx.restore(); }
  for (const c of clouds) { c.x += 3 * dt; if (c.x - c.r > VW + 260) c.x = -260 - c.r; }
}
let fadeT = 0;

// ===== الرسم =====
const HOUSE = ['h1', 'h2', 'h3', 'h4', 'h6'];
const cam = { x: VW / 2, y: VH / 2, z: 1 };
function sprite(sp: Spr, x: number, y: number, ang: number, size: number, side: number, dead: boolean) { g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2); g.drawImage(dead ? sp.dark : side < 0 ? sp.plain : sp.side[side], -size / 2, -size / 2, size, size); g.restore(); }
function shadowOf(sp: Spr, x: number, y: number, ang: number, size: number, ox: number, oy: number, a = .38) { g.save(); g.translate(x + ox, y + oy); g.rotate(ang + Math.PI / 2); g.globalAlpha = a; g.drawImage(sp.shadow, -size / 2, -size / 2, size, size); g.restore(); g.globalAlpha = 1; }
const UN: Record<string, [string, string, number]> = { tank: ['abrams', 't72', 15.5], arty: ['d30', 'd30', 13], mlrs: ['grad', 'grad', 15], ad: ['patriot', 's400', 17] };
function drawUnit(x: Unit, T: number, pass: 0 | 1) {
  if (x.type === 'inf') { if (pass === 1) drawInf(x, T); return; }
  const [n0, n1, sz] = UN[x.type], name = x.side ? n1 : n0, sp = SPR[name], size = sz * S, dead = !x.alive;
  const hull = x.type === 'tank' ? (x.moving ? (x.side ? Math.PI / 2 : -Math.PI / 2) : x.a) : x.a;
  const rt = T - (recoil.get(x.id) ?? -9), rec = !dead && rt < .3 ? (1 - rt / .3) * (x.type === 'arty' ? 2.6 : 1.8) : 0, bx = x.x - Math.cos(x.a) * rec, by = x.y - Math.sin(x.a) * rec;
  if (pass === 0) { shadowOf(sp, bx, by, hull, size, 2.2, 3, dead ? .25 : .4); if (x.moving && Math.random() < .25) add('dust', x.x - Math.cos(hull) * 8, x.y - Math.sin(hull) * 8, { max: 2.2, size: 4, grow: 5, a: .5 }); return; }
  sprite(sp, bx, by, hull + (dead ? x.rot * .05 : 0), size, x.side, dead);
  if (x.type === 'tank' && !(dead && turretFly.some(t => Math.hypot(t.x - x.x, t.y - x.y) < 60 && t.name.startsWith(name)))) {
    const ts = SPR[name + '_t'], p = ts.piv ?? [0, 0], k = size / sp.m, c = Math.cos(hull + Math.PI / 2), s = Math.sin(hull + Math.PI / 2), px = p[0] * k, pz = -p[1] * k;
    sprite(ts, bx + px * c - pz * s, by + px * s + pz * c, dead ? x.a + .6 : x.a, size, -1, dead);
  }
}
function drawInf(x: Unit, T: number) {
  const firing = T - (mgT.get(x.id) ?? -9) < .45, ofs = [[-5, -3], [4, -5], [-1, 1], [6, 4], [-6, 5]], k = S * .9, a = firing ? x.a : (x.side ? Math.PI / 2 : -Math.PI / 2);
  if (!x.alive) { for (const [ox, oy] of ofs) { g.fillStyle = 'rgba(40,36,30,.55)'; g.beginPath(); g.ellipse(x.x + ox * S, x.y + oy * S, 1.5 * k, .6 * k, ox, 0, 7); g.fill(); } return; }
  const body = x.side ? '#8a7650' : '#56603a', helm = x.side ? '#4b3f28' : '#2d3420';
  ofs.forEach(([ox, oy], i) => {
    const bob = x.moving ? Math.sin(T * 14 + i * 1.7) * .35 : 0, sx = x.x + ox * S, sy = x.y + oy * S + bob;
    g.save(); g.translate(sx, sy); g.rotate(a + Math.PI / 2);
    g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(.9, 1.2, 1.4 * k, .9 * k, 0, 0, 7); g.fill();
    g.strokeStyle = TEAM[x.side]; g.lineWidth = .9; g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 1.45 * k, .85 * k, 0, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = '#1b1a16'; g.lineWidth = .7; g.beginPath(); g.moveTo(.5 * k, -.2 * k); g.lineTo(.5 * k, -2.6 * k); g.stroke();
    g.fillStyle = helm; g.beginPath(); g.arc(0, 0, .62 * k, 0, 7); g.fill();
    if (firing && (i + Math.floor(T * 14)) % 2 === 0) { g.globalCompositeOperation = 'lighter'; g.drawImage(glow, .5 * k - 2.5, -3 * k - 2.5, 5, 5); g.globalCompositeOperation = 'source-over'; }
    g.restore();
    if (firing && Math.random() < .05) light(sx, sy, 10, .5, .05, '255,210,130');
  });
}
function drawTrails(T: number) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const t of trails) {
    const n = t.pts.length; if (n < 2) continue;
    for (let i = 1; i < n; i += 3) {   // قطع صغيرة: كل قطعة بعمرها (أعرض وأشفّ كل ما تكبر)
      const p0 = t.pts[i - 1], age = T - p0.t, k = clamp(age / t.life, 0, 1), al = t.a * (1 - k) * (1 - k);
      if (al < .02) continue;
      g.strokeStyle = `rgba(${t.col},${al})`; g.lineWidth = t.w + age * t.grow; g.beginPath(); g.moveTo(p0.x, p0.y); for (let j = i; j < Math.min(n, i + 4); j++) g.lineTo(t.pts[j].x, t.pts[j].y); g.stroke();
    }
  }
}
function drawMun(w: World) {
  for (const p of w.pr) {
    if (p.t < 0) continue;
    const q = munPos(p), y = q.y - lift(q.z), [ox, oy] = shadowOff(q.z), a = Math.atan2(p.ty - p.sy, p.tx - p.sx);
    if (p.kind === 'mg') { g.strokeStyle = (p.side ?? 0) ? 'rgba(170,255,150,.95)' : 'rgba(255,214,120,.95)'; g.lineWidth = .9; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - Math.cos(a) * 9, p.y - Math.sin(a) * 9); g.stroke(); continue; }
    if (p.kind === 'tank') { g.strokeStyle = 'rgba(255,245,210,1)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - Math.cos(a) * 24, p.y - Math.sin(a) * 24); g.stroke(); g.globalCompositeOperation = 'lighter'; g.drawImage(glow, p.x - 5, p.y - 5, 10, 10); g.globalCompositeOperation = 'source-over'; light(p.x, p.y, 26, .8, .04); continue; }
    // ظل على الأرض
    if (q.z > 2) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(q.x + ox, q.y + oy, p.kind === 'bomb' ? 2.2 : 1.6, p.kind === 'bomb' ? 1.2 : .9, a, 0, 7); g.fill(); }
    const dx = Math.cos(a), dy = Math.sin(a) - (p.kind === 'shell' || p.kind === 'rocket' ? Math.cos(Math.PI * q.k) * .9 : 0), dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
    if (p.kind === 'shell') { g.strokeStyle = 'rgba(30,26,22,.7)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(q.x, y); g.lineTo(q.x - ux * 5, y - uy * 5); g.stroke(); continue; }
    if (p.kind === 'bomb') { g.save(); g.translate(q.x, y); g.rotate(Math.atan2(uy, ux) + Math.PI / 2 + q.k * .6); g.fillStyle = '#3d4036'; g.beginPath(); g.ellipse(0, 0, 1.3, 3.4, 0, 0, 7); g.fill(); g.fillRect(-1.6, 2.4, 3.2, .8); g.restore(); continue; }
    // صواريخ: جسم + لهب يرتجف (أكبر بالبداية) + وهج
    const len = p.kind === 'msl' ? 7 : p.kind === 'rocket' ? 5.5 : 3.5;
    g.strokeStyle = p.kind === 'msl' ? '#eeeeea' : '#4d5044'; g.lineWidth = p.kind === 'msl' ? 2 : 1.4; g.beginPath(); g.moveTo(q.x, y); g.lineTo(q.x - ux * len, y - uy * len); g.stroke();
    if (q.burning) { const fl = (p.kind === 'msl' ? 16 : 11) * (1 + R(-.25, .25)) * (q.k < .08 ? 1.6 : 1); g.globalCompositeOperation = 'lighter'; g.drawImage(glow, q.x - ux * len - fl / 2, y - uy * len - fl / 2, fl, fl); g.save(); g.translate(q.x - ux * len, y - uy * len); g.rotate(Math.atan2(-uy, -ux)); g.drawImage(flameC, 0, -fl * .18, fl * .9, fl * .36); g.restore(); g.globalCompositeOperation = 'source-over'; }
  }
}
function drawParts(high: boolean) {
  for (const f of fx) {
    const isHigh = f.type === 'flare' && f.z === 0 && f.max > 1; if (isHigh !== high) continue;
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
function drawLights(z: number, sx: number, sy: number) {
  // الإضاءة: ظلمة حسب الوقت (multiply) + أضواء الوهج والانفجارات والحرايق
  const L = lightC, lx = L.getContext('2d')!, cfg = TOD[tod], sc = .5 * z;
  const tr = (x: number, y: number) => [(SW / 2 + (x - cam.x) * z + sx) * .5, (SH / 2 + (y - cam.y) * z + sy) * .5];
  if (cfg.amb) {
    lx.globalCompositeOperation = 'source-over'; lx.fillStyle = cfg.amb; lx.fillRect(0, 0, L.width, L.height); lx.globalCompositeOperation = 'lighter';
    for (const l of lights) { const [x, y] = tr(l.x, l.y), r = l.r * sc * 1.6, k = 1 - l.life / l.max, gr = lx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${l.col},${clamp(l.i * k, 0, 1)})`); gr.addColorStop(1, `rgba(${l.col},0)`); lx.fillStyle = gr; lx.fillRect(x - r, y - r, r * 2, r * 2); }
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalCompositeOperation = 'multiply'; g.drawImage(L, 0, 0, SW, SH); g.globalCompositeOperation = 'source-over';
  }
  // توهج فوق (bloom بسيط)
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalCompositeOperation = 'lighter';
  for (const l of lights) { if (l.i < .9) continue; const [x, y] = tr(l.x, l.y), r = l.r * z * .5, k = 1 - l.life / l.max; g.globalAlpha = clamp(l.i * k * .22 * cfg.glow, 0, 1); g.drawImage(glow, x * 2 - r, y * 2 - r, r * 2, r * 2); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function draw(T: number) {
  const w = W!;
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = '#1d1b16'; g.fillRect(0, 0, SW, SH);
  const base = Math.min(SH / VH, SW / VW * 1.25), z = base * cam.z, sx = R(-shake, shake), sy = R(-shake, shake);
  g.setTransform(z * DPR, 0, 0, z * DPR, (SW / 2 - cam.x * z + sx) * DPR, (SH / 2 - cam.y * z + sy) * DPR);
  g.drawImage(ground, GX0, 0, GW, VH); g.drawImage(decal, GX0, 0, GW, VH);
  // بيوت
  for (const b of w.b) { const sp = SPR[HOUSE[b.c % 4 + (b.id % 2)]], size = b.w * 1.25;
    if (b.dead) { sprite(sp, b.x, b.y, b.r - Math.PI / 2, size * .92, -1, true); g.fillStyle = 'rgba(120,106,88,.75)'; for (let i = 0; i < 6; i++) g.fillRect(b.x + ((i * 7) % 5 - 2.5) * b.w * .2, b.y + ((i * 11) % 5 - 2.5) * b.h * .2, b.w * .3, b.h * .22); if (Math.random() < .04) add('grey', b.x, b.y, { max: 7, size: 4, grow: 5, a: .5 }); }
    else { shadowOf(sp, b.x, b.y, b.r - Math.PI / 2, size, 3.5, 4.5, .42); sprite(sp, b.x, b.y, b.r - Math.PI / 2, size, -1, false); } }
  for (const p of props) if (p.n === 'car1' || p.n === 'pickup') { const sp = SPR[p.n], s = 7 * S * p.s; shadowOf(sp, p.x, p.y, p.r, s, 1.2, 1.6, .35); sprite(sp, p.x, p.y, p.r, s, -1, true); }
  for (const x of w.u) drawUnit(x, T, 0);
  for (const x of w.u) drawUnit(x, T, 1);
  for (const t of turretFly) { const sp = SPR[t.name], s = 15.5 * S; if (t.z > 0) shadowOf(sp, t.x, t.y, t.a, s, t.z * .28, t.z * .16, .3); sprite(sp, t.x, t.y - lift(t.z), t.a, s, -1, true); }
  // أشجار (فوق الوحدات)
  for (const p of props) if (p.n !== 'car1' && p.n !== 'pickup') { const sp = SPR[p.n], s = (p.n === 'palm' ? 6.5 : 7) * S * p.s; shadowOf(sp, p.x, p.y, p.r, s, 4, 5, .4); sprite(sp, p.x, p.y, p.r, s, -1, false); }
  drawParts(false);
  drawTrails(T);
  drawMun(w);
  // هليكوبترات
  for (const h of w.heli) { if (T < h.t0) continue; const sp = SPR.ah64, size = 20 * S, zH = 22, hy = h.y - lift(zH);
    shadowOf(sp, h.x + zH * .28, h.y + zH * .16 - lift(zH) + lift(zH), -Math.PI / 2, size, 0, 0, .28); sprite(sp, h.x, hy, -Math.PI / 2, size, 0, !h.alive);
    g.strokeStyle = 'rgba(15,15,15,.45)'; g.lineWidth = 1.2; for (let i = 0; i < 4; i++) { const a = h.rot * 1.4 + i * Math.PI / 2; g.beginPath(); g.moveTo(h.x, hy); g.lineTo(h.x + Math.cos(a) * 9 * S, hy + Math.sin(a) * 9 * S); g.stroke(); }
    g.fillStyle = 'rgba(30,30,30,.13)'; g.beginPath(); g.arc(h.x, hy, 9 * S, 0, 7); g.fill();
    if (h.y > h.ty && Math.random() < .3) add('dust', h.x + zH * .28, h.y + zH * .16, { max: 1.5, size: 6, grow: 10, a: .35 }); }
  // طيارات ومسيّرات
  for (const j of w.air) { const jet = j.kind === 'jet', sp = SPR[jet ? (j.side ? 'f16' : 'su25') : (j.side ? 'shahed' : 'tb2')], size = (jet ? 17 : j.side ? 9 : 16) * S, a = Math.atan2(j.vy, j.vx), zz = jet ? 60 : 32, jy = j.y - lift(zz);
    shadowOf(sp, j.x + zz * .28, j.y + zz * .16, a, size, 0, 0, .22); sprite(sp, j.x, jy, a, size, j.side, false);
    if (jet) { const tx = j.x - Math.cos(a) * size * .46, ty2 = jy - Math.sin(a) * size * .46, fl = 8 + R(-1.5, 1.5); g.globalCompositeOperation = 'lighter'; g.drawImage(glow, tx - fl / 2, ty2 - fl / 2, fl, fl); g.globalCompositeOperation = 'source-over'; light(tx, ty2, 20, .5, .04, '255,180,110'); } }
  drawParts(true);
  // ظلال الغيوم
  if (tod === 'day' || tod === 'dusk') for (const c of clouds) { const gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r); gr.addColorStop(0, 'rgba(20,18,30,.16)'); gr.addColorStop(1, 'rgba(20,18,30,0)'); g.fillStyle = gr; g.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2); }
  drawLights(z, sx, sy);
}

// ===== الشريط =====
let endShown = false, lastPh = '';
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function hud() {
  const w = W!, ph = phase(w.T);
  if (ph !== lastPh) { lastPh = ph; $('bphase').textContent = ph; }
  const b = bars(w); ($('bla') as HTMLElement).style.width = clamp(b.a, 0, 100) + '%'; ($('bld') as HTMLElement).style.width = clamp(b.d, 0, 100) + '%';
  $('bwhere').innerHTML = `${w.res.rname} — ${TERR_N[w.res.terr]} <b>${mmss(Math.min(w.T, CARD))}</b>`;
  // صوت المعركة البعيد يكبر ويا القتال، والهليكوبترات حسب عددها
  if (ac && amb) amb.gain.setTargetAtTime(w.T > 17 * K && w.T < CARD ? .22 : w.T > 4 * K && w.T < CARD ? .08 : 0, ac.currentTime, .8);
  if (ac && heliG) { const n = w.heli.filter(h => w.T >= h.t0 && h.alive).length; heliG.gain.setTargetAtTime(Math.min(.5, n * .16), ac.currentTime, .6); }
  if (w.T >= CARD && !endShown) {
    endShown = true; const res = w.res, e = $('bend'); e.hidden = false; e.className = res.win ? 'win' : 'lose';
    e.innerHTML = `<div class="stamp">${stamp(res)}</div><h2>${res.rname}</h2><p>خسرت ${Math.round(res.la * 100)}٪ من القوة المشاركة، والعدو خسر ${Math.round(res.ld * 100)}٪ من مدافعيه. المدة ${res.wk} أسابيع.</p><button class="btn go" id="bBack">رجوع للقيادة</button><button class="btn" id="bAgain">شوفها مرة ثانية</button>`;
    $('bBack').onclick = () => showStart(); $('bAgain').onclick = () => startBattle();
  }
}
function startBattle() {
  const res: Res = { ...structuredClone(SAMPLES[curRes]), terr, an: 'العراق', bn: 'العدو' };
  W = create(res); fx = []; trails = []; lights = []; shake = 0; mgT.clear(); recoil.clear(); mun.clear(); jetFlare.clear(); turretFly.length = 0; buildGround(terr, W); cam.x = VW / 2; cam.y = VH / 2; cam.z = 1;
  $('bna').textContent = res.an!; $('bnd').textContent = res.bn!; endShown = false; lastPh = ''; setSpeed(1);
  ($('start') as HTMLElement).hidden = true; $('hud').hidden = false; $('ctl').hidden = false; $('bend').hidden = true; running = true; audio(); startLoops();
}
function showStart() { running = false; ($('start') as HTMLElement).hidden = false; $('hud').hidden = true; $('ctl').hidden = true; $('bend').hidden = true; if (ac && amb) amb.gain.value = 0; if (ac && heliG) heliG.gain.value = 0; }
function setSpeed(s: number) { speed = s; $('spd').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+(b as HTMLElement).dataset.s! === s))); }
$('spd').querySelectorAll('button').forEach(b => b.addEventListener('click', () => setSpeed(+(b as HTMLElement).dataset.s!)));
$('bSkip').onclick = () => { if (W && W.T < CARD) { setSpeed(1); skip(W); } };
$('bFit').onclick = () => { cam.x = VW / 2; cam.y = VH / 2; cam.z = 1; };
$('bMute').onclick = () => { muted = !muted; $('bMute').textContent = muted ? '🔇' : '🔊'; if (muted && ac) ac.suspend(); else if (ac) ac.resume(); };
const seg = (id: string, f: (v: string) => void) => $(id).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); f((b as HTMLElement).dataset.v!); }));
seg('sRes', v => { curRes = v; terr = SAMPLES[v].terr; $('sTerr').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.v === terr))); });
seg('sTerr', v => { terr = v as Terr; }); seg('sTod', v => { tod = v as typeof tod; });
$('bGo').onclick = () => startBattle();
$('credBtn').onclick = () => { $('credits').hidden = false; }; $('credX').onclick = () => { $('credits').hidden = true; };
const ptrs = new Map<number, { x: number; y: number }>(); let pinch = 0;
const baseZ = () => Math.min(SH / VH, SW / VW * 1.25);
cv.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return;
  if (ptrs.size === 1 && cam.z > 1.01) { const z = baseZ() * cam.z; cam.x -= (e.clientX - p.x) / z; cam.y -= (e.clientY - p.y) / z; }
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); p.x = e.clientX; p.y = e.clientY; const [c, d] = [...ptrs.values()], d1 = Math.hypot(c.x - d.x, c.y - d.y); if (pinch && d0) cam.z = clamp(cam.z * d1 / d0, 1, 4); pinch = d1; if (cam.z <= 1.01) { cam.x = VW / 2; cam.y = VH / 2; } return; }
  p.x = e.clientX; p.y = e.clientY; });
const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch = 0; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); cam.z = clamp(cam.z * Math.exp(-e.deltaY * .0015), 1, 4); if (cam.z <= 1.01) { cam.x = VW / 2; cam.y = VH / 2; } }, { passive: false });

let last = performance.now();
function frame(now: number) {
  const rdt = clamp((now - last) / 1000, 0, .05); last = now;
  if (running && W && W.T < END + 600) { let left = rdt * speed; while (left > 1e-6) { const d = Math.min(.05, left); left -= d; step2(d); } hud(); }
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
(window as any).seek = (t: number) => { if (!W) return; while (W.T < t) step2(1 / 30); hud(); };
(window as any).zoomAt = (x: number, y: number, z: number) => { cam.x = x; cam.y = y; cam.z = z; };
