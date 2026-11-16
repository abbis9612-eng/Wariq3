// المشهد المايل (I-058، D-031): كاميرا ثابتة الميلان 50°، الأرض صور أقمار، المجسمات صور مخبوزة من نفس الزاوية،
// كل شي بحجمه وسرعته الحقيقية (متر/ثانية)، ومن بعيد رموز بحد أدنى. «تابع» = مخرج ينقل الكاميرا ويبطّئ الوقت، والإصبع يكبّر ويسحب.
import { World, SITES, HEAD, fromMerc, toXY, type V3, type Msl } from './sim';
import TILES from '../textures/tiles.json';
import MAN from '../sprites/manifest.json';

const $ = (id: string) => document.getElementById(id)!;
const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const R = (a: number, b: number) => a + Math.random() * (b - a);
const hyp = Math.hypot;
const EL = 50 * Math.PI / 180, SE = Math.sin(EL), CE = Math.cos(EL);
const texUrls = import.meta.glob('../textures/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const sprUrls = import.meta.glob('../sprites/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const fxUrls = { ...import.meta.glob('../../theater/textures/{fx_cloud,fx_explo1}.webp', { query: '?url', import: 'default', eager: true }), ...import.meta.glob('../../battle-classic/textures/dirt_aerial_03.webp', { query: '?url', import: 'default', eager: true }) } as Record<string, string>;
const sndUrls = { ...import.meta.glob('../../theater/sounds/{launch,rocket,boom_big,boom_far,boom_mid,incoming}.mp3', { query: '?url', import: 'default', eager: true }), ...import.meta.glob('../../battle-classic/sounds/{jet_roar,woosh,boom_huge,blast,sonic}.mp3', { query: '?url', import: 'default', eager: true }) } as Record<string, string>;
const base = (k: string) => k.split('/').pop()!.replace(/\.(webp|png|mp3)$/, '');
const qs = new URLSearchParams(location.search), AUTO = qs.has('auto');
const cv = $('c') as HTMLCanvasElement, g = cv.getContext('2d')!;
let SW = 0, SH = 0, DPR = 1;
function resize() { DPR = Math.min(1.75, window.devicePixelRatio || 1); SW = cv.clientWidth; SH = cv.clientHeight; cv.width = Math.round(SW * DPR); cv.height = Math.round(SH * DPR); }
window.addEventListener('resize', resize); resize();
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const loadImg = (u: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });

// ===== الأصول =====
const IMG: Record<string, CanvasImageSource> = {}; let puffs: Record<string, HTMLCanvasElement> = {}, glow: HTMLCanvasElement, dirtPat: CanvasPattern | null = null;
function feather(img: HTMLImageElement) { // حواف الرقعة الأدق تذوب بالأساس (ما يبين مربع)
  const c = mk(img.width, img.height), x = c.getContext('2d')!; x.drawImage(img, 0, 0); x.globalCompositeOperation = 'destination-out';
  const f = Math.round(img.width * .14);
  for (const [x0, y0, x1, y1, w, h, rx, ry] of [[0, 0, f, 0, f, img.height, 0, 0], [img.width, 0, img.width - f, 0, f, img.height, img.width - f, 0], [0, 0, 0, f, img.width, f, 0, 0], [0, img.height, 0, img.height - f, img.width, f, 0, img.height - f]] as number[][]) {
    const gr = x.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(rx, ry, w, h); }
  return c;
}
async function loadAll(prog: (s: string) => void) {
  for (const [k, u] of Object.entries(texUrls)) { const n = base(k), im = await loadImg(u); IMG[n] = n === 'base' || n === 'wide' ? im : feather(im); prog('الأرض'); }
  for (const [k, u] of Object.entries(sprUrls)) { IMG[base(k)] = await loadImg(u); prog('المجسمات'); }
  for (const [k, u] of Object.entries(fxUrls)) IMG[base(k)] = await loadImg(u);
  // نفخات دخان من ورقة السحب الحقيقية (8×8)، ملونة: أبيض، رمادي، غامق، غبار
  const cl = IMG.fx_cloud as HTMLImageElement;
  const tint = (rgb: string) => { const c = mk(1024, 1024), x = c.getContext('2d')!; x.drawImage(cl, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = rgb; x.fillRect(0, 0, 1024, 1024); return c; };
  puffs = { w: tint('rgb(238,236,230)'), g: tint('rgb(150,146,140)'), d: tint('rgb(40,36,33)'), b: tint('rgb(176,150,112)') };
  glow = mk(64, 64); { const x = glow.getContext('2d')!, gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,252,240,1)'); gr.addColorStop(.18, 'rgba(255,225,160,.9)'); gr.addColorStop(.5, 'rgba(255,150,60,.3)'); gr.addColorStop(1, 'rgba(255,110,30,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  dirtPat = g.createPattern(IMG.dirt_aerial_03 as HTMLImageElement, 'repeat');
}

// ===== المحاكاة + المؤثرات بالعالم (متر) =====
let W = new World(7);
interface Trail { pts: { x: number; y: number; z: number; t: number }[]; r0: number; gr: number; life: number; a: number; col: string; live: boolean; last: V3 | null }
interface Puff { x: number; y: number; z: number; r: number; gr: number; t: number; life: number; a: number; col: string; vz: number; cell: number; vx: number; vy: number }
interface Fx { x: number; y: number; z: number; t: number; life: number; size: number; type: 'flash' | 'ex' | 'flare' | 'spark' | 'ring'; vx: number; vy: number; vz: number }
let trails: Trail[] = [], pf: Puff[] = [], fx: Fx[] = [], mTrail = new Map<number, Trail>(), dTrail = new Map<object, Trail>();
const WIND = { x: 3.5, y: 1.2 };   // ريح خفيفة م/ث
const puff = (p: V3, r: number, gr: number, life: number, a: number, col: string, vz = 0, vx = 0, vy = 0) => pf.push({ x: p.x, y: p.y, z: p.z, r, gr, t: 0, life, a, col, vz, cell: Math.floor(Math.random() * 64), vx, vy });
function onEvent(e: { type: string; p: V3; id?: number; data?: any }) {
  const p = e.p;
  switch (e.type) {
    case 'sam_eject': // سحابة غاز بيضاء من فوهة الأنبوب، بدون نار
      for (let i = 0; i < 12; i++) puff({ x: p.x + R(-1.2, 1.2), y: p.y + R(-1.2, 1.2), z: p.z + R(-1, 1.5) }, R(.7, 1.4), R(1, 2), R(2.5, 5), .5, i % 3 ? 'w' : 'g', R(.5, 3), R(-3, 3), R(-3, 3));
      snd('woosh', p, .9, .7); caption('إطلاق بارد: الغاز يطرد الصاروخ لفوق… بدون نار'); break;
    case 'ignite':
      fx.push({ x: p.x, y: p.y, z: p.z, t: 0, life: .35, size: 14, type: 'flash', vx: 0, vy: 0, vz: 0 });
      for (let i = 0; i < 6; i++) puff(p, R(1, 2), 2.5, R(4, 7), .7, 'w', R(-2, 2));
      snd('launch', p, 1, .95); caption(`اشتعل المحرك على ارتفاع ${Math.round(p.z - W.s400.p.z - 8)} م — يميل وينطلق`); break;
    case 'pac_launch': // إطلاق حار مائل: نار، دخان أبيض، غبار ورا المنصة
      fx.push({ x: p.x, y: p.y, z: p.z, t: 0, life: .5, size: 26, type: 'flash', vx: 0, vy: 0, vz: 0 });
      for (let i = 0; i < 18; i++) { const a = e.data.az + Math.PI + R(-.9, .9), r = R(2, 14); puff({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, z: R(0, 3) }, R(3, 6), R(2, 4), R(9, 16), .7, i % 3 ? 'w' : 'b', R(0, 1.5), Math.cos(a) * R(2, 8), Math.sin(a) * R(2, 8)); }
      snd('launch', p, 1, 1); snd('rocket', p, .8, 1.1); caption('باتريوت PAC-3: إطلاق حار مائل 38° على الصاروخ النازل'); break;
    case 'bm_launch': // سحابة كبيرة على الأرض وعمود دخان
      fx.push({ x: p.x, y: p.y, z: 2, t: 0, life: .9, size: 60, type: 'flash', vx: 0, vy: 0, vz: 0 }, { x: p.x, y: p.y, z: 0, t: 0, life: 2.5, size: 70, type: 'ring', vx: 0, vy: 0, vz: 0 });
      for (let i = 0; i < 34; i++) { const a = Math.random() * 7, r = R(3, 18), s = R(6, 18); puff({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, z: R(0, 4) }, R(4, 9), R(2.5, 5), R(18, 34), .75, i % 3 ? 'b' : 'w', R(0, 2), Math.cos(a) * s, Math.sin(a) * s); }
      snd('rocket', p, 1, .6); snd('boom_far', p, .9, .7); caption('ذو الفقار: إطلاق حار من المنصة — صعود عمودي بطيء بالأول'); break;
    case 'kill_jet':
      fx.push({ x: p.x, y: p.y, z: p.z, t: 0, life: .6, size: 110, type: 'flash', vx: 0, vy: 0, vz: 0 }, { x: p.x, y: p.y, z: p.z, t: 0, life: 1.8, size: 95, type: 'ex', vx: 0, vy: 0, vz: 0 }, { x: p.x + 12, y: p.y, z: p.z - 6, t: 0, life: 1.4, size: 60, type: 'ex', vx: 0, vy: 0, vz: 0 });
      for (let i = 0; i < 14; i++) puff({ x: p.x + R(-10, 10), y: p.y + R(-10, 10), z: p.z + R(-8, 8) }, R(5, 10), R(3, 6), R(14, 24), .8, i % 2 ? 'd' : 'g');
      snd('boom_big', p, 1, .9); caption('إصابة! الشظايا مزّقت الطيارة'); break;
    case 'eject_seat': caption('الطيار قفز بالكرسي… والمظلة انفتحت'); break;
    case 'kill_bm':
      fx.push({ x: p.x, y: p.y, z: p.z, t: 0, life: .8, size: 420, type: 'flash', vx: 0, vy: 0, vz: 0 }, { x: p.x, y: p.y, z: p.z, t: 0, life: 2.2, size: 240, type: 'ex', vx: 0, vy: 0, vz: 0 }, { x: p.x - 40, y: p.y, z: p.z - 30, t: 0, life: 1.8, size: 150, type: 'ex', vx: 0, vy: 0, vz: 0 }, { x: p.x, y: p.y, z: p.z, t: 0, life: 1.6, size: 700, type: 'ring', vx: 0, vy: 0, vz: 0 });
      for (let i = 0; i < 26; i++) puff({ x: p.x + R(-60, 60), y: p.y + R(-60, 60), z: p.z + R(-50, 50) }, R(18, 40), R(6, 12), R(30, 50), .85, i % 3 ? 'g' : 'd', R(-10, 0));
      snd('boom_huge', p, 1, .9); caption(`اعتراض! ضربة مباشرة على ارتفاع ${(p.z / 1000).toFixed(1)} كم`); break;
    case 'selfdestruct': fx.push({ x: p.x, y: p.y, z: p.z, t: 0, life: .4, size: 30, type: 'flash', vx: 0, vy: 0, vz: 0 }, { x: p.x, y: p.y, z: p.z, t: 0, life: 1.1, size: 24, type: 'ex', vx: 0, vy: 0, vz: 0 }); for (let i = 0; i < 5; i++) puff(p, R(4, 7), 3, R(10, 16), .6, 'g'); snd('blast', p, .7);
      if (e.data?.miss) caption(`الصاروخ الثاني فات الطيارة بـ ${Math.round(e.data.miss)} م — راوغت ونجت`); break;
    case 'cm': for (let i = 0; i < 4; i++) { const s = i % 2 ? 1 : -1, h = e.data.hd; fx.push({ x: p.x, y: p.y, z: p.z, t: 0, life: 3.5, size: 6, type: 'flare', vx: -Math.cos(h) * 60 + Math.sin(h) * s * 45, vy: -Math.sin(h) * 60 - Math.cos(h) * s * 45, vz: -8 }); } puff(p, 4, 6, 8, .5, 'g'); break;
    case 'rwr_break': caption('F-16: إنذار رادار! لفة حادة ونزول ومشاعل'); snd('sonic', p, .5); break;
    case 'rwr_notch': caption('الطيارة الثانية تلف على جنب وتنزل حتى تعمي الرادار'); break;
    case 'bm_erect': caption('منصة ذو الفقار ترفع الصاروخ عمودي'); break;
    case 'crash': case 'debris_land': fx.push({ x: p.x, y: p.y, z: 0, t: 0, life: 1.2, size: 30, type: 'ex', vx: 0, vy: 0, vz: 0 }); for (let i = 0; i < 6; i++) puff(p, R(4, 8), 3, R(20, 30), .7, 'd', R(3, 6)); break;
  }
}
function fxStep(dt: number) {
  for (const m of W.msls) {
    const burning = m.kind === 'bm' ? m.t < W.bmPlan!.tb : m.ph === 'boost';
    let tr = mTrail.get(m.id);
    if (burning && m.ph !== 'dead') {
      if (!tr) { tr = m.kind === 'bm' ? { pts: [], r0: 2.4, gr: 5.5, life: 55, a: .8, col: 'w', live: true, last: null } : m.kind === 'pac' ? { pts: [], r0: .8, gr: 2.6, life: 30, a: .75, col: 'w', live: true, last: null } : { pts: [], r0: 1, gr: 3, life: 34, a: .78, col: 'w', live: true, last: null }; mTrail.set(m.id, tr); trails.push(tr); }
      const sp = hyp(m.vel.x, m.vel.y, m.vel.z), step = Math.max(1.5, sp * .025), l = tr.last;
      if (!l || hyp(m.p.x - l.x, m.p.y - l.y, m.p.z - l.z) > step) { tr.pts.push({ x: m.p.x, y: m.p.y, z: m.p.z, t: W.t }); tr.last = { ...m.p }; }
    } else if (tr && tr.live) { tr.pts.push({ x: m.p.x, y: m.p.y, z: m.p.z, t: W.t }); tr.live = false; }
  }
  // حطام يحترق: كل قطعة تترك خط دخان غامق
  for (const d of W.debris) { if (!d.burn) continue; let tr = dTrail.get(d); if (!tr) { tr = { pts: [], r0: 1.5, gr: 3.5, life: 26, a: .6, col: 'd', live: true, last: null }; dTrail.set(d, tr); trails.push(tr); }
    const l = tr.last; if (!l || hyp(d.p.x - l.x, d.p.y - l.y, d.p.z - l.z) > 25) { tr.pts.push({ x: d.p.x, y: d.p.y, z: d.p.z, t: W.t }); tr.last = { ...d.p }; } }
  // الطيارة المضروبة تولّع وتدخّن
  for (const j of W.jets) if (j.st === 'hit' && Math.random() < dt * 25) puff(j.p, R(4, 8), R(3, 6), R(12, 20), .75, 'd');
  trails = trails.filter(r => r.live || (r.pts.length && W.t - r.pts[r.pts.length - 1].t < r.life));
  for (const p of pf) { p.t += dt; p.x += (WIND.x + p.vx) * dt; p.y += (WIND.y + p.vy) * dt; p.z = Math.max(0, p.z + p.vz * dt); p.vx *= 1 - dt * .8; p.vy *= 1 - dt * .8; p.r += p.gr * dt / (1 + p.t * .25); }
  pf = pf.filter(p => p.t < p.life); if (pf.length > 1800) pf.splice(0, pf.length - 1800);
  for (const f of fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z = Math.max(0, f.z + f.vz * dt); if (f.type === 'flare') { f.vz -= 9.8 * dt * .3; f.vx *= 1 - dt * .6; f.vy *= 1 - dt * .6; let tr = dTrail.get(f); if (!tr) { tr = { pts: [], r0: .6, gr: 1.6, life: 9, a: .6, col: 'w', live: true, last: null }; dTrail.set(f, tr); trails.push(tr); } const l = tr.last; if (!l || hyp(f.x - l.x, f.y - l.y, f.z - l.z) > 6) { tr.pts.push({ x: f.x, y: f.y, z: f.z, t: W.t }); tr.last = { x: f.x, y: f.y, z: f.z }; } if (f.t > f.life - .05) tr.live = false; } }
  fx = fx.filter(f => f.t < f.life);
}

// ===== الكاميرا =====
const cam = { x: 0, y: 0, w: 60000 }; let follow = true, fly: { x0: number; y0: number; w0: number; x1: number; y1: number; w1: number; t: number; d: number } | null = null, shotId = '';
const S = (x: number, y: number, z = 0): [number, number] => { const k = SW / cam.w; return [(x - cam.x) * k + SW / 2, (-(y - cam.y) * SE - z * CE) * k + SH / 2]; };
const groundFor = (p: V3) => ({ x: p.x, y: p.y + p.z * CE / SE });   // نقطة أرض تخلي الجسم بالنص على الشاشة
interface Shot { id: string; x: number; y: number; w: number; ts: number; z?: number }
let killP: V3 | null = null, focusZ = 0, lastLaunchT = -99, launchKind = '', pacT = -99, killT = -99, bmT = -99;
function director(): Shot {
  const t = W.t, lead = W.lead, wing = W.wing, s4 = W.s400.p;
  const sam = W.msls.find(m => m.kind === 'sam' && m.ph !== 'dead'), pac = W.msls.find(m => m.kind === 'pac' && m.ph !== 'dead' && m.tgtMsl), bm = W.msls.find(m => m.kind === 'bm' && m.ph !== 'dead');
  if (W.phase === 'air') {
    if (t - killT < 5) { const c = W.chute ? groundFor(W.chute.p) : groundFor(lead.p); return { id: 'kill', x: c.x, y: c.y, w: 1600, ts: .7, z: W.chute ? W.chute.p.z : lead.p.z }; }
    if (killT > 0 && W.chute && t - killT < 11 && !sam) { const c = groundFor(W.chute.p); return { id: 'chute', x: c.x, y: c.y, w: 260, ts: 1, z: W.chute.p.z }; }
    if (sam) {
      const tj = W.jets.find(j => j.id === sam.tgtJet)!, d = hyp(tj.p.x - sam.p.x, tj.p.y - sam.p.y, tj.p.z - sam.p.z);
      if (sam.ph === 'eject' || (sam.t < 1.8 && t - lastLaunchT < 3.5)) { return { id: 'launch' + sam.id, x: s4.x - 4, y: s4.y + 16, w: 62, ts: .3 }; }
      if (d < 7000) { const a = groundFor(sam.p), b = groundFor(tj.p); return { id: 'term' + sam.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: Math.max(900, d * 1.5), ts: d < 2500 ? .35 : .8, z: tj.p.z }; }
      const a = groundFor(sam.p); return { id: 'fly' + sam.id, x: a.x + sam.vel.x * .8, y: a.y + sam.vel.y * .8, w: clamp(300 + sam.t * 900, 300, 9000), ts: sam.t < 5 ? 1 : 2, z: sam.p.z };
    }
    if (t < 3) return { id: 'est', x: (lead.p.x + s4.x) / 2, y: (lead.p.y + s4.y) / 2, w: 62000, ts: 1.2 };
    if (W.s400.raise > 0 && W.s400.raise < 1) return { id: 'raise', x: s4.x - 3, y: s4.y + 8, w: 58, ts: 2 };
    if (W.s400.fired === 0) { const a = groundFor(lead.p); return { id: 'jets', x: a.x + 250, y: a.y - 200, w: 1500, ts: 3, z: lead.p.z }; }
    const a = groundFor(wing.p); return { id: 'wing', x: a.x, y: a.y, w: 4000, ts: 2, z: wing.p.z };
  }
  // ---- الباليستي ----
  const zp = W.zolf.p;
  if (t - killT < 6 && killT > bmT) { const bd = W.debris.slice(-26), cz = bd.reduce((a, d) => a + d.p.z, 0) / Math.max(1, bd.length), c = killP && t - killT < 2 ? groundFor(killP) : groundFor({ x: bd.reduce((a, d) => a + d.p.x, 0) / Math.max(1, bd.length), y: bd.reduce((a, d) => a + d.p.y, 0) / Math.max(1, bd.length), z: cz }); return { id: 'bmkill', x: c.x, y: c.y, w: 2600, ts: .55, z: cz }; }
  if (pac) { const d = bm ? hyp(bm.p.x - pac.p.x, bm.p.y - pac.p.y, bm.p.z - pac.p.z) : 0;
    if (t - pacT < 2.6) return { id: 'pacl', x: W.pat.p.x, y: W.pat.p.y + 25, w: 110, ts: .35 };
    if (bm && d < 9000) { const a = groundFor(pac.p), b = groundFor(bm.p); return { id: 'pact', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: Math.max(700, d * 1.3), ts: d < 3000 ? .3 : .7, z: pac.p.z }; }
    const a = groundFor(pac.p); return { id: 'pacf', x: a.x, y: a.y, w: clamp(400 + pac.t * 1600, 400, 14000), ts: 1, z: pac.p.z }; }
  if (bm) { const a = groundFor(bm.p), age = bm.t;
    if (age < 4) return { id: 'bml', x: zp.x - 6, y: zp.y + 30, w: 160, ts: .4 };
    if (age < 26) return { id: 'bmb', x: a.x, y: a.y, w: clamp(160 + age * age * 60, 160, 40000), ts: age < 10 ? 1 : 2, z: bm.p.z * .3 };
    if (bm.vel.z < 0 && bm.p.z < 60000) { return { id: 'bmd', x: a.x, y: a.y, w: 60000, ts: 5 }; }
    return { id: 'bmm', x: a.x, y: a.y, w: 140000, ts: 9 }; }
  if (W.zolf.erect > 0) return { id: 'erect', x: zp.x - 4, y: zp.y + 8, w: 80, ts: 1.6 };
  return { id: 'gap', x: (zp.x + s4.x) / 2, y: (zp.y + s4.y) / 2, w: 90000, ts: 3 };
}
function camUpdate(sh: Shot, rdt: number) {
  focusZ = lerp(focusZ, follow ? sh.z ?? 0 : 0, 1 - Math.exp(-rdt * 2));
  if (!follow) return;
  if (sh.id !== shotId) { // لقطة جديدة: طيران ناعم (يبعد ويقرب إذا المسافة كبيرة)
    const d = hyp(sh.x - cam.x, sh.y - cam.y), far = d > Math.max(cam.w, sh.w) * .9;
    if (far && shotId) fly = { x0: cam.x, y0: cam.y, w0: cam.w, x1: sh.x, y1: sh.y, w1: sh.w, t: 0, d: clamp(.9 + Math.log10(d / Math.min(cam.w, sh.w)) * .45, .9, 2.4) };
    shotId = sh.id;
  }
  if (fly) { fly.t += rdt; const u = clamp(fly.t / fly.d, 0, 1), e = u * u * (3 - 2 * u), dist = hyp(fly.x1 - fly.x0, fly.y1 - fly.y0), lw0 = Math.log(fly.w0), lw1 = Math.log(sh.w), bump = Math.max(0, Math.log(dist * 1.4) - Math.max(lw0, lw1));
    fly.x1 = sh.x; fly.y1 = sh.y; cam.x = lerp(fly.x0, fly.x1, e); cam.y = lerp(fly.y0, fly.y1, e); cam.w = Math.exp(lerp(lw0, lw1, e) + bump * Math.sin(Math.PI * e)); if (u >= 1) fly = null; return; }
  const k = 1 - Math.exp(-rdt * 3.5); cam.x = lerp(cam.x, sh.x, k); cam.y = lerp(cam.y, sh.y, k); cam.w = Math.exp(lerp(Math.log(cam.w), Math.log(sh.w), 1 - Math.exp(-rdt * 2.6)));
}

// ===== الإصبع: سحب وتقريب =====
const ptrs = new Map<number, { x: number; y: number }>(); let pinch0 = 0, w0 = 0;
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = hyp(a.x - b.x, a.y - b.y); w0 = cam.w; } setFollow(false); });
cv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; const k = SW / cam.w;
  if (ptrs.size === 1) { cam.x -= (e.clientX - p.x) / k; cam.y += (e.clientY - p.y) / k / SE; }
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = hyp(a.x - b.x, a.y - b.y); if (pinch0 > 0) cam.w = clamp(w0 * pinch0 / d, 40, 300000); } });
const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); setFollow(false); cam.w = clamp(cam.w * Math.exp(e.deltaY * .0015), 40, 300000); }, { passive: false });
function setFollow(on: boolean) { follow = on; $('bFollow').setAttribute('aria-pressed', String(on)); if (on) shotId = ''; }

// ===== الصوت: يوصل بسرعة الصوت الحقيقية (محدود)، والبعيد مكتوم، والتبطيء ينزّل النغمة =====
let ac: AudioContext | null = null, master: GainNode; const smp: Record<string, AudioBuffer> = {}; let muted = false, act = 0;
function audio() { try { if (!ac) { ac = new AudioContext(); master = ac.createGain(); master.gain.value = .9; const cmp = ac.createDynamicsCompressor(); master.connect(cmp).connect(ac.destination); const a = ac; for (const [k, u] of Object.entries(sndUrls)) fetch(u).then(r => r.arrayBuffer()).then(b => a.decodeAudioData(b)).then(buf => { smp[base(k)] = buf; }).catch(() => {}); } if (ac.state === 'suspended') ac.resume(); } catch { /* */ } }
let curTs = 1;
function snd(n: string, p: V3, v: number, rate = 1) {
  if (!ac || !smp[n] || muted || act > 14) return;
  const d = hyp(p.x - cam.x, p.y - cam.y, p.z), dEff = hyp(d, cam.w * .5), delay = Math.min(2.5, d / 343) / Math.max(.3, curTs * speed);
  const gain = v / (1 + dEff / 900); if (gain < .03) return;
  const s = ac.createBufferSource(); s.buffer = smp[n]; s.playbackRate.value = rate * clamp(curTs * speed, .55, 1) * R(.95, 1.04);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(18000 / (1 + dEff / 1500), 500, 18000);
  const gn = ac.createGain(); gn.gain.value = gain; const pan = ac.createStereoPanner(); pan.pan.value = clamp((p.x - cam.x) / cam.w * 1.4, -.8, .8);
  s.connect(lp).connect(gn).connect(pan).connect(master); s.start(ac.currentTime + delay); act++; s.onended = () => act--;
}

// ===== الرسم =====
const SPR = MAN as Record<string, { mpp: number; H: number }>;
function frame(name: string, i: number, x: number, y: number, z: number, minPx: number, fill = .65, alpha = 1) {
  const img = IMG[name], m = SPR[name]; if (!img || !m) return; const k = SW / cam.w, sz = Math.max(256 * m.mpp * k, minPx / fill);
  const [sx, sy] = S(x, y, z); g.globalAlpha = alpha; g.drawImage(img, (i % 4) * 256, Math.floor(i / 4) * 256, 256, 256, sx - sz / 2, sy - sz / 2, sz, sz); g.globalAlpha = 1;
}
const dirIdx = (hd: number) => ((Math.round(hd / (Math.PI / 8)) % 16) + 16) % 16;
function drawGround() {
  const T = (TILES as any).tiles as Record<string, { z: number; b: number[] }>, k = SW / cam.w;
  for (const n of ['wide', 'base', 's40012', 'zolf12', 'pat12', 's40014', 'zolf14', 'pat14']) {
    const t = T[n], img = IMG[n]; if (!t || !img) continue;
    const a = fromMerc(t.b[0], t.b[1]), b = fromMerc(t.b[2], t.b[3]);
    const mpp = (b.x - a.x) / (img as HTMLCanvasElement).width; if (n !== 'base' && n !== 'wide' && mpp * k < .35) continue;   // ما نحتاج الأدق من بعيد
    const [x0, y0] = S(a.x, a.y), [x1, y1] = S(b.x, b.y); if (x1 < 0 || x0 > SW || y1 < 0 || y0 > SH) continue;
    g.drawImage(img, x0, y0, x1 - x0, y1 - y0);
  }
  // تفاصيل أرض حقيقية من قريب (صورة القمر من قريب ضبابية)
  if (dirtPat && k > .3) { const a = clamp((k - .3) / 1.6, 0, .78), sc = 14 * k / 1024, [ox, oy] = S(0, 0);   // كل تكرار ~14 م
    dirtPat.setTransform(new DOMMatrix([sc, 0, 0, sc * SE, ox, oy])); g.globalCompositeOperation = 'luminosity'; g.globalAlpha = a; g.fillStyle = dirtPat; g.fillRect(0, 0, SW, SH); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
}
const BORDER = [[33.4, 45.9], [32.9, 46.4], [32.4, 47.1], [31.85, 47.68], [31.3, 47.7], [30.95, 47.7], [30.45, 48.03], [29.95, 48.55]].map(([la, lo]) => toXY(la, lo));
const PLACES: [string, number, number, number][] = [['الأهواز', 31.32, 48.67, 1], ['دزفول', 32.38, 48.4, 1], ['البصرة', 30.51, 47.81, 1], ['عبادان', 30.34, 48.3, 0], ['العمارة', 31.84, 47.15, 0], ['المحمرة', 30.44, 48.17, 0], ['أنديمشك', 32.46, 48.36, 0]];
function label(t: string, x: number, y: number, size: number, a = .92) { g.font = `600 ${size}px "IBM Plex Sans Arabic",sans-serif`; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(t, x, y); g.fillStyle = `rgba(250,248,240,${a})`; g.fillText(t, x, y); }
function drawMapMarks() {
  const k = SW / cam.w; if (k > .05) return;   // من قريب ما نحتاج أسماء
  g.save(); g.setLineDash([6, 5]); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.4; g.beginPath(); BORDER.forEach((p, i) => { const [x, y] = S(p.x, p.y); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.restore();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [n, la, lo, big] of PLACES) { const p = toXY(la, lo), [x, y] = S(p.x, p.y); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, big ? 2.6 : 1.8, 0, 7); g.fill(); label(n, x, y - 10, big ? 12 : 10.5); }
  for (const [n, p] of [['S-400', SITES.s400], ['ذو الفقار', SITES.zolf], ['باتريوت', SITES.pat]] as [string, { x: number; y: number }][]) { const [x, y] = S(p.x, p.y); label(n, x, y + 16, 10.5, .85); }
}
function drawTrails() {
  const k = SW / cam.w; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const r of trails) { const P = r.pts; if (P.length < 2) continue; const sheet = puffs[r.col];
    const scr = P.map(p => { const a = W.t - p.t, rise = Math.min(a * .6, 40); return { a, s: S(p.x + WIND.x * a, p.y + WIND.y * a, p.z + rise) }; });
    for (let i0 = 0; i0 < P.length - 1; i0 += 4) { // قطعة من 5 نقاط بخط واحد
      const i1 = Math.min(P.length - 1, i0 + 4), am = scr[Math.floor((i0 + i1) / 2)].a; if (am > r.life) continue;
      const q = am / r.life, rad = r.r0 + r.gr * Math.sqrt(am), al = r.a * (1 - q) * (1 - q * .5), rp = rad * k;
      g.strokeStyle = r.col === 'd' ? `rgba(45,40,36,${al * .75})` : `rgba(238,236,230,${al * (rp > 5 ? .45 : .8)})`; g.lineWidth = Math.max(1.1, rp * 2);
      g.beginPath(); g.moveTo(scr[i0].s[0], scr[i0].s[1]); for (let i = i0 + 1; i <= i1; i++) g.lineTo(scr[i].s[0], scr[i].s[1]); g.stroke();
      if (rp > 5) { // من قريب: نفخات دخان حقيقية فوق الخط
        for (let i = i0; i < i1; i++) { const [x1, y1] = scr[i].s, [x2, y2] = scr[i + 1].s, seg = hyp(x2 - x1, y2 - y1), n = Math.min(5, Math.max(1, Math.ceil(seg / (rp * .9))));
          for (let s2 = 0; s2 < n; s2++) { const u = s2 / n, cx = lerp(x1, x2, u), cy = lerp(y1, y2, u), cell = (i * 7 + s2 * 13) % 64, sz = rp * 2.7; if (cx < -sz || cx > SW + sz || cy < -sz || cy > SH + sz) continue; g.globalAlpha = al * .7; g.drawImage(sheet, (cell % 8) * 128, Math.floor(cell / 8) * 128, 128, 128, cx - sz / 2, cy - sz / 2, sz, sz); } }
        g.globalAlpha = 1; }
    } }
}
function drawPuffs(lowZ: boolean) {
  const k = SW / cam.w;
  for (const p of pf) { if ((p.z < 60) !== lowZ) continue; const q = p.t / p.life, a = p.a * Math.min(1, q * 10) * (1 - q), rp = p.r * k; if (rp < .6 || a < .02) continue;
    const [x, y] = S(p.x, p.y, p.z), sz = Math.max(rp, 1.5) * 2.6; if (x < -sz || x > SW + sz || y < -sz || y > SH + sz) continue;
    g.globalAlpha = a; g.drawImage(puffs[p.col], (p.cell % 8) * 128, Math.floor(p.cell / 8) * 128, 128, 128, x - sz / 2, y - sz / 2, sz, sz); }
  g.globalAlpha = 1;
}
function drawMissile(m: Msl) {
  const k = SW / cam.w, sp = hyp(m.vel.x, m.vel.y, m.vel.z) || 1, u = { x: m.vel.x / sp, y: m.vel.y / sp, z: m.vel.z / sp };
  if (sp < 1) { u.x = 0; u.y = 0; u.z = 1; }
  const L = m.kind === 'bm' ? 10.3 : m.kind === 'pac' ? 5.2 : 7.5, D = m.kind === 'bm' ? .68 : m.kind === 'pac' ? .26 : .52;
  const [tx, ty] = S(m.p.x - u.x * L / 2, m.p.y - u.y * L / 2, m.p.z - u.z * L / 2), [nx, ny] = S(m.p.x + u.x * L / 2, m.p.y + u.y * L / 2, m.p.z + u.z * L / 2);
  let dx = nx - tx, dy = ny - ty; const pl = hyp(dx, dy), minL = 7; if (pl < minL) { const f = pl > .01 ? minL / pl : 0; const cx = (tx + nx) / 2, cy = (ty + ny) / 2; dx = pl > .01 ? dx * f : 0; dy = pl > .01 ? dy * f : -minL; return body(cx - dx / 2, cy - dy / 2, cx + dx / 2, cy + dy / 2, Math.max(1.6, D * k)); }
  body(tx, ty, nx, ny, Math.max(1.6, D * k));
  function body(ax: number, ay: number, bx: number, by: number, w: number) {
    const burning = m.kind === 'bm' ? m.t < W.bmPlan!.tb : m.ph === 'boost';
    const a = Math.atan2(by - ay, bx - ax), l = hyp(bx - ax, by - ay);
    if (burning) { // لهب: طوله حقيقي تقريباً (أطول وقت الإقلاع)، مع وهج
      const fl = Math.max(10, (m.kind === 'bm' ? 22 : 12) * k * (m.t < 2 ? 1.5 : 1)) * R(.85, 1.15);
      g.save(); g.translate(ax, ay); g.rotate(a + Math.PI); g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(0, 0, fl, 0); gr.addColorStop(0, 'rgba(255,255,235,1)'); gr.addColorStop(.25, 'rgba(255,200,110,.85)'); gr.addColorStop(1, 'rgba(255,110,30,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -w * .55); g.quadraticCurveTo(fl * .5, -w * .9, fl, 0); g.quadraticCurveTo(fl * .5, w * .9, 0, w * .55); g.fill(); g.restore();
      const gs = Math.max(14, fl * 1.1); g.globalCompositeOperation = 'lighter'; g.drawImage(glow, ax - gs / 2, ay - gs / 2, gs, gs); g.globalCompositeOperation = 'source-over';
    }
    g.save(); g.translate(ax, ay); g.rotate(a);
    const gr = g.createLinearGradient(0, -w / 2, 0, w / 2); const c = m.kind === 'bm' ? ['#e9dcc0', '#b9a88a'] : ['#f2f1ec', '#a9aaa4']; gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -w / 2); g.lineTo(l * .82, -w / 2); g.quadraticCurveTo(l, 0, l * .82, w / 2); g.lineTo(0, w / 2); g.closePath(); g.fill();
    if (w > 2.5) { g.fillStyle = 'rgba(60,62,58,.9)'; g.fillRect(0, -w * 1.1, l * .08, w * 2.2); g.fillRect(l * .45, -w * .8, l * .05, w * 1.6); }   // زعانف
    g.restore();
    // وهج الرجوع للجو (الباليستي نازل بسرعة عالية)
    if (m.kind === 'bm' && m.vel.z < -900 && m.p.z < 45000) { const s = 18 + (45000 - m.p.z) / 1500; g.globalCompositeOperation = 'lighter'; g.globalAlpha = .9; g.drawImage(glow, bx - s / 2, by - s / 2, s, s); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  }
}
function draw() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = '#8fa3b0'; g.fillRect(0, 0, SW, SH);
  drawGround(); drawMapMarks();
  const k = SW / cam.w;
  // المنصات
  const s4f = W.s400.fired > 0 && W.t - lastLaunchT < 1.2 ? 10 + Math.min(5, Math.floor((W.t - lastLaunchT) * 5)) : Math.round(W.s400.raise * 9);
  frame('s400', s4f, W.s400.p.x, W.s400.p.y, 0, 30, .55);
  const zf = W.zolf.fired ? 12 : Math.round(W.zolf.erect * 9); frame('zolf', zf, W.zolf.p.x, W.zolf.p.y, 0, 30, .55);
  const pa = Math.atan2(SITES.zolf.y - SITES.pat.y, SITES.zolf.x - SITES.pat.x); frame('patriot', dirIdx(pa), W.pat.p.x, W.pat.p.y, 0, 26, .5);
  // طبقة هوا بين الأرض والجو حسب ارتفاع اللي نتابعه (الأرض تبين بعيدة تحت)
  const hz = clamp(focusZ / 14000, 0, .28); if (hz > .02) { g.fillStyle = `rgba(186,204,224,${hz})`; g.fillRect(0, 0, SW, SH); }
  drawPuffs(true);
  drawTrails();
  // ظل الطيارات على الأرض
  for (const j of W.jets) { if (j.st === 'gone') continue; const [hx, hy] = S(j.p.x + j.p.z * .35, j.p.y + j.p.z * .25, 0); const s = Math.max(15 * k, 6); if (hx > -50 && hx < SW + 50 && hy > -50 && hy < SH + 50) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(hx, hy, s * .55, s * .3, 0, 0, 7); g.fill(); } }
  for (const m of W.msls) if (m.ph !== 'dead') drawMissile(m);
  drawPuffs(false);
  // الطيارات (صورة الاتجاه + ميلان + لهب المحرك)
  for (const j of W.jets) { if (j.st === 'gone') continue; const hit = j.st === 'hit';
    const sq = hit ? Math.abs(Math.cos(j.roll)) * .8 + .2 : 1 - Math.min(.3, Math.abs(j.bank) * .25);
    const img = IMG.f16, m = SPR.f16, i = dirIdx(j.hd), sz = Math.max(256 * m.mpp * k, 30 / .62), [sx, sy] = S(j.p.x, j.p.y, j.p.z);
    g.save(); g.translate(sx, sy); g.rotate(hit ? Math.sin(j.roll) * .4 : j.bank * .12); g.scale(1, sq); g.drawImage(img, (i % 4) * 256, Math.floor(i / 4) * 256, 256, 256, -sz / 2, -sz / 2, sz, sz); g.restore();
    if (hit) { g.globalCompositeOperation = 'lighter'; const s = Math.max(18, 30 * k); g.drawImage(glow, sx - s / 2, sy - s / 2, s, s); g.globalCompositeOperation = 'source-over'; }
    else if (j.st === 'break' || j.st === 'notch') { const [ex, ey] = S(j.p.x - Math.cos(j.hd) * 8, j.p.y - Math.sin(j.hd) * 8, j.p.z + 1); const s = Math.max(6, 6 * k); g.globalCompositeOperation = 'lighter'; g.drawImage(glow, ex - s / 2, ey - s / 2, s, s); g.globalCompositeOperation = 'source-over'; } }
  // حطام ومظلة
  for (const d of W.debris) { const [x, y] = S(d.p.x, d.p.y, d.p.z); g.fillStyle = 'rgba(40,38,34,.95)'; g.fillRect(x - 1.5, y - 1.5, 3, 3); if (d.burn) { g.globalCompositeOperation = 'lighter'; g.drawImage(glow, x - 5, y - 5, 10, 10); g.globalCompositeOperation = 'source-over'; } }
  if (W.chute) { const [x, y] = S(W.chute.p.x, W.chute.p.y, W.chute.p.z), s = Math.max(5, 9 * k); g.fillStyle = '#f2efe6'; g.beginPath(); g.arc(x, y - s, s, Math.PI, 0); g.fill(); g.strokeStyle = 'rgba(240,238,230,.8)'; g.lineWidth = .8; g.beginPath(); g.moveTo(x - s, y - s); g.lineTo(x, y + s * .4); g.lineTo(x + s, y - s); g.stroke(); g.fillStyle = '#3a3d34'; g.fillRect(x - 1, y + s * .3, 2, Math.max(2, 1.8 * k)); }
  // مؤثرات
  for (const f of fx) { const q = f.t / f.life, [x, y] = S(f.x, f.y, f.z), s = Math.max(f.size * k, f.type === 'flare' ? 5 : 10);
    if (f.type === 'flash') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - q; g.drawImage(glow, x - s, y - s, s * 2, s * 2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    else if (f.type === 'ex') { const fr = Math.min(24, Math.floor(q * 25)); g.drawImage(IMG.fx_explo1, (fr % 5) * 200, Math.floor(fr / 5) * 200, 200, 200, x - s / 2, y - s * .6, s, s); }
    else if (f.type === 'flare') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - q * .7; g.drawImage(glow, x - s / 2, y - s / 2, s, s); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    else if (f.type === 'ring') { g.strokeStyle = `rgba(255,248,230,${(1 - q) * .5})`; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, s * q, s * q * SE, 0, 0, 7); g.stroke(); } }
  // ضباب خفيف للأبعاد الكبيرة + حواف
  if (cam.w > 20000) { g.fillStyle = `rgba(190,200,210,${clamp((cam.w - 20000) / 300000, 0, .18)})`; g.fillRect(0, 0, SW, SH); }
  const vg = g.createRadialGradient(SW / 2, SH / 2, Math.min(SW, SH) * .4, SW / 2, SH / 2, Math.max(SW, SH) * .8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.42)'); g.fillStyle = vg; g.fillRect(0, 0, SW, SH);
  // علامة حول الشي اللي نتابعه إذا صار صغير (من بعيد)
  const tgt = follow ? W.msls.find(m => m.ph !== 'dead' && m.kind !== 'bm' && (m.tgtJet || m.tgtMsl)) ?? W.msls.find(m => m.kind === 'bm' && m.ph !== 'dead') : null;
  if (tgt && 10 * k < 10) { const [x, y] = S(tgt.p.x, tgt.p.y, tgt.p.z), b = 11; g.strokeStyle = 'rgba(255,230,140,.9)'; g.lineWidth = 1.4; g.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.moveTo(x + sx * b, y + sy * b * .45); g.lineTo(x + sx * b, y + sy * b); g.lineTo(x + sx * b * .45, y + sy * b); } g.stroke(); }
  scaleBar(k);
}
function scaleBar(k: number) { // مسطرة: تعطي إحساس الحجم الحقيقي
  const targets = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]; let m = targets[0]; for (const t of targets) if (t * k < SW * .28) m = t;
  const L = m * k, x = 14, y = SH - 78; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y); g.lineTo(x + L, y); g.lineTo(x + L, y - 4); g.stroke();
  g.textAlign = 'left'; label(m >= 1000 ? `${m / 1000} كم` : `${m} م`, x + L + 26, y - 2, 11);
}
let capT = 0;
function caption(t: string) { const el = $('cap'); el.textContent = t; el.style.opacity = '1'; capT = performance.now(); }
function hud() {
  if (performance.now() - capT > 4200) $('cap').style.opacity = '0';
  // قراءة للجسم المتابَع: ارتفاع وسرعة (ماخ)
  const sam = W.msls.find(m => m.ph !== 'dead' && m.kind !== 'bm' && (m.tgtJet || m.tgtMsl)), bm = W.msls.find(m => m.kind === 'bm' && m.ph !== 'dead');
  const o = sam ?? bm; let txt = '';
  if (o) { const sp = hyp(o.vel.x, o.vel.y, o.vel.z); txt = `${o.kind === 'bm' ? 'ذو الفقار' : o.kind === 'pac' ? 'PAC-3' : '48N6 (S-400)'} · ارتفاع ${(o.p.z / 1000).toFixed(o.p.z < 1000 ? 2 : 1)} كم · ${Math.round(sp)} م/ث (ماخ ${(sp / 300).toFixed(1)})`; }
  else if (W.phase === 'air' && W.lead.st !== 'gone') { const j = W.lead; txt = `F-16 · ارتفاع ${(j.p.z / 1000).toFixed(1)} كم · ${Math.round(j.spd * 3.6)} كم/س · بعدها عن S-400 ${(hyp(j.p.x - W.s400.p.x, j.p.y - W.s400.p.y) / 1000).toFixed(0)} كم`; }
  $('read').textContent = txt;
  $('slow').hidden = !(follow && curTs < .9);
}

// ===== الحلقة =====
let speed = 1, paused = false, running = false, last = performance.now(), ended = false;
function start() {
  W = new World(7); trails = []; pf = []; fx = []; mTrail = new Map(); dTrail = new Map(); lastLaunchT = -99; pacT = -99; killT = -99; bmT = -99; ended = false; shotId = ''; fly = null;
  const s = director(); cam.x = s.x; cam.y = s.y; cam.w = s.w; setFollow(true);
  running = true; $('start').hidden = true; $('ui').hidden = false; $('end').hidden = true; audio(); caption('F-16 اثنين داخلات على الأهواز… وS-400 جاهز');
}
function loop(now: number) {
  const rdt = clamp((now - last) / 1000, 0, .05); last = now;
  if (running && !paused) {
    const sh = director(); curTs = follow ? sh.ts : 1; let left = rdt * curTs * speed, n = 0;
    while (left > 1e-6 && n < 400) { const d = Math.min(.01, left); left -= d; n++; W.step(d); fxStep(d);
      for (const e of W.ev.splice(0)) { if (e.type === 'sam_eject') { lastLaunchT = W.t; launchKind = 'sam'; } if (e.type === 'pac_launch') pacT = W.t; if (e.type === 'kill_jet' || e.type === 'kill_bm') { killT = W.t; killP = { ...e.p }; } if (e.type === 'bm_launch') bmT = W.t; onEvent(e); } }
    camUpdate(director(), rdt);
    if (W.phase === 'bm' && W.endT > 0 && W.t > W.endT && !ended) { ended = true; $('end').hidden = false; }
  } else if (running) camUpdate(director(), 0);
  if (IMG.base) { draw(); if (running) hud(); }
  requestAnimationFrame(loop);
}
void launchKind; void HEAD;
$('bGo').onclick = start;
$('bFollow').onclick = () => setFollow(!follow);
$('bPause').onclick = () => { paused = !paused; $('bPause').textContent = paused ? '▶' : '⏸'; };
document.querySelectorAll<HTMLButtonElement>('#spd button').forEach(b => b.onclick = () => { speed = +b.dataset.s!; document.querySelectorAll('#spd button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
$('bMute').onclick = () => { muted = !muted; $('bMute').textContent = muted ? '🔇' : '🔊'; if (ac) muted ? ac.suspend() : ac.resume(); };
$('bAgain').onclick = start;
(async () => {
  let n = 0; await loadAll(s => { n++; $('load').textContent = `يحمّل ${s}… ${n}`; });
  $('load').textContent = ''; ($('bGo') as HTMLButtonElement).disabled = false; $('bGo').textContent = 'ابدأ';
  const s = director(); cam.x = s.x; cam.y = s.y; cam.w = s.w; requestAnimationFrame(loop);
  if (AUTO) { start(); (window as any).ready = true; }
})();
// للفحص: يقدّم المشهد لوقت محاكاة معين بنفس المخرج
(window as any).seek = (t: number) => { while (W.t < t) { W.step(.01); fxStep(.01); for (const e of W.ev.splice(0)) { if (e.type === 'sam_eject') lastLaunchT = W.t; if (e.type === 'pac_launch') pacT = W.t; if (e.type === 'kill_jet' || e.type === 'kill_bm') { killT = W.t; killP = { ...e.p }; } if (e.type === 'bm_launch') bmT = W.t; onEvent(e); } }
  const sh = director(); shotId = sh.id; fly = null; cam.x = sh.x; cam.y = sh.y; cam.w = sh.w; curTs = sh.ts; };
(window as any).W = () => W;
