// المعركة الكلاسيكية (D-027): نفس رسم معركة الأصل (index.html: Battle.draw) — الساحة كلها بشاشة وحدة، وحدات مكبّرة،
// انفجارات وأصوات الأصل — بس الأشكال صارت صور المجسمات الحقيقية (من battle2d/sprites) بإطار لون الطرف،
// وفوق انفجارات الأصل انفجار ودخان ونار مصوّرة، وفوق أصواته أصوات حقيقية.
import { create, step, bars, phase, skip, stamp, SAMPLES, VW, VH, END, CARD, PPM, K, World, Res, Unit, Terr } from './sim';
import manifest from '../../battle2d/sprites/manifest.json';

const $ = (id: string) => document.getElementById(id)!;
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const R = (a: number, b: number) => a + Math.random() * (b - a);
const sprUrls = import.meta.glob('../../battle2d/sprites/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const texUrls = import.meta.glob('../../theater/textures/{sand,road,fx_explo1,fx_explo2,fx_fire}.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const sndUrls = import.meta.glob('../../theater/sounds/{boom_big,boom_mid,boom_far,tank,akburst,mg,rocket,launch,atgm,incoming}.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const MAN = manifest as Record<string, { m: number; piv?: number[] }>;
const qs = new URLSearchParams(location.search), AUTO = qs.has('auto');
const cv = $('c') as HTMLCanvasElement, g = cv.getContext('2d')!;
let SW = 0, SH = 0, DPR = 1;
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); SW = cv.clientWidth; SH = cv.clientHeight; cv.width = SW * DPR; cv.height = SH * DPR; }
window.addEventListener('resize', resize); resize();
const S = Math.max(.75, PPM * 9);   // نفس مقياس أيقونات الأصل (drawUnit: s)
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const loadImg = (u: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });

// ===== الصور: كل مجسم بنسخة لكل طرف (إطار بلونه) + محروق + ظل =====
const TEAM = ['#f2cf4a', '#ff5638'];   // نفس ألوان أشرطة الأصل: ذهبي للمهاجم، أحمر للمدافع
interface Spr { side: HTMLCanvasElement[]; dark: HTMLCanvasElement; shadow: HTMLCanvasElement; plain: HTMLCanvasElement; piv?: number[]; m: number }
const SPR: Record<string, Spr> = {};
const TEX: Record<string, HTMLImageElement> = {};
let puff: Record<string, HTMLCanvasElement> = {};
function variants(img: HTMLImageElement, m: number, piv?: number[]): Spr {
  const n = 160, base = mk(n, n), bg = base.getContext('2d')!; bg.drawImage(img, 0, 0, n, n);
  const sil = (col: string, blur = 0) => { const c = mk(n, n), x = c.getContext('2d')!; if (blur) x.filter = `blur(${blur}px)`; x.drawImage(base, 0, 0); x.filter = 'none'; x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, n, n); return c; };
  const side = TEAM.map(col => { const s = sil(col), c = mk(n, n), x = c.getContext('2d')!; for (let a = 0; a < 8; a++) x.drawImage(s, Math.cos(a * Math.PI / 4) * 3.6, Math.sin(a * Math.PI / 4) * 3.6); x.drawImage(base, 0, 0); return c; });
  const dark = mk(n, n), dx = dark.getContext('2d')!; dx.drawImage(base, 0, 0); dx.globalCompositeOperation = 'source-atop'; dx.fillStyle = 'rgba(22,19,16,.84)'; dx.fillRect(0, 0, n, n);
  return { side, dark, shadow: sil('#000', 2), plain: base, piv, m };
}
async function loadAll(say: (t: string) => void) {
  const names = Object.keys(MAN).filter(n => n !== 'h5'); let k = 0;
  await Promise.all(names.map(async n => { SPR[n] = variants(await loadImg(sprUrls[`../../battle2d/sprites/${n}.png`]), MAN[n].m, MAN[n].piv); say(`يحمّل الصور… ${++k}/${names.length}`); }));
  for (const [k2, u] of Object.entries(texUrls)) TEX[k2.split('/').pop()!.replace('.webp', '')] = await loadImg(u);
  // دخان ناعم: نفس نفخات الأصل (puff) بس بقوام غيمة بدل دائرة مسطحة
  const sheet = mk(512, 512), sx = sheet.getContext('2d')!; let sd = 7; const rr = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let c = 0; c < 16; c++) { const ox = (c % 4) * 128 + 64, oy = Math.floor(c / 4) * 128 + 64; for (let i = 0; i < 14; i++) { const a = rr() * 6.28, r = rr() * 26, x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r, rad = 16 + rr() * 22, gr = sx.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(255,255,255,${0.25 + rr() * 0.2})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = gr; sx.beginPath(); sx.arc(x, y, rad, 0, 7); sx.fill(); } }
  const tint = (col: string) => { const c = mk(512, 512), x = c.getContext('2d')!; x.drawImage(sheet, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, 512, 512); return c; };
  puff = { black: tint('rgb(30,28,26)'), dust: tint('rgb(176,152,116)'), screen: tint('rgb(232,232,226)'), smoke: tint('rgb(205,205,198)') };
}

// ===== الأرض (makeGround بالأصل + تفاصيل) =====
const PAL: Record<Terr, number[][]> = { desert: [[214, 190, 140], [190, 160, 108], [160, 128, 84]], plain: [[112, 128, 70], [136, 142, 82], [168, 156, 104]], hills: [[104, 116, 72], [140, 132, 90], [150, 140, 118]], mount: [[96, 104, 84], [128, 124, 112], [176, 172, 164]] };
const TERR_N: Record<Terr, string> = { plain: 'سهل', desert: 'صحراء', hills: 'تلال', mount: 'جبال' };
function vnoise(sx: number, sy: number, seed: number) { const h = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453; return n - Math.floor(n); }; const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0, s = (t: number) => t * t * (3 - 2 * t); return h(x0, y0) * (1 - s(fx)) * (1 - s(fy)) + h(x0 + 1, y0) * s(fx) * (1 - s(fy)) + h(x0, y0 + 1) * (1 - s(fx)) * s(fy) + h(x0 + 1, y0 + 1) * s(fx) * s(fy); }
const fbm = (x: number, y: number, s: number) => vnoise(x, y, s) * .5 + vnoise(x * 2.1, y * 2.1, s + 7) * .27 + vnoise(x * 4.3, y * 4.3, s + 13) * .15 + vnoise(x * 9, y * 9, s + 29) * .08;
const GX0 = -260, GW = VW + 520, GR = 2;   // الأرض أعرض من الساحة (للشاشات العريضة)، دقة 2 بكسل لكل بكسل
let ground: HTMLCanvasElement, decal: HTMLCanvasElement, dctx: CanvasRenderingContext2D;
function buildGround(terr: Terr) {
  const seed = Math.random() * 100, gw = 220, gh = Math.round(gw * VH / GW), c = mk(gw, gh), x = c.getContext('2d')!, im = x.createImageData(gw, gh), p = PAL[terr], sc = terr === 'mount' ? 7 : terr === 'hills' ? 5 : 3.5;
  const ht = (i: number, j: number) => fbm(i / gw * sc * GW / VW, j / gw * sc * GW / VW, seed);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const h = ht(i, j), sh = (ht(i + 1, j + 1) - ht(i - 1, j - 1)) * (terr === 'mount' ? 520 : terr === 'hills' ? 360 : terr === 'desert' ? 240 : 170);
    const t = clamp((h - .3) * 2.2, 0, 1), a = t < .5 ? p[0] : p[1], b = t < .5 ? p[1] : p[2], u = t < .5 ? t * 2 : (t - .5) * 2, k = (i + j * gw) * 4;
    const patch = terr === 'plain' ? ((Math.floor(i / 16 + vnoise(j / 26, 3, seed)) + Math.floor(j / 13)) % 2 ? 7 : -7) : 0;
    for (let q = 0; q < 3; q++) im.data[k + q] = clamp(a[q] + (b[q] - a[q]) * u - sh + patch + (Math.random() - .5) * 5, 0, 255); im.data[k + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  ground = mk(GW * GR, VH * GR); const G = ground.getContext('2d')!; G.imageSmoothingEnabled = true; G.drawImage(c, 0, 0, GW * GR, VH * GR);
  // ملمس الرمل
  const sd = mk(256, 256), sdx = sd.getContext('2d')!; sdx.filter = 'grayscale(1) contrast(1.4)'; sdx.drawImage(TEX.sand, 0, 0, 256, 256);
  G.globalCompositeOperation = 'overlay'; G.globalAlpha = 0.55; G.fillStyle = G.createPattern(sd, 'repeat')!; G.fillRect(0, 0, GW * GR, VH * GR); G.globalAlpha = 1; G.globalCompositeOperation = 'source-over';
  // شجيرات وحصى
  const shrub = terr === 'plain' ? [70, 92, 42] : terr === 'desert' ? [116, 106, 64] : [80, 92, 54];
  for (let i = 0; i < 2600; i++) { const X = Math.random() * GW * GR, Y = Math.random() * VH * GR, r = Math.random() * 1.2 + .4, c2 = 70 + Math.random() * 80; G.fillStyle = `rgba(${c2},${c2 * .88 | 0},${c2 * .7 | 0},.35)`; G.fillRect(X, Y, r, r); }
  for (let i = 0; i < (terr === 'desert' ? 160 : 420); i++) { const X = Math.random() * GW * GR, Y = Math.random() * VH * GR, r = (1 + Math.random() * 1.8) * GR; G.fillStyle = 'rgba(30,24,14,.22)'; G.beginPath(); G.ellipse(X + r * .5, Y + r * .5, r, r * .8, 0, 0, 7); G.fill(); const f = .8 + Math.random() * .4; G.fillStyle = `rgb(${shrub[0] * f | 0},${shrub[1] * f | 0},${shrub[2] * f | 0})`; G.beginPath(); G.arc(X, Y, r * .8, 0, 7); G.fill(); }
  // الطريق: نفس منحنى الأصل
  G.save(); G.scale(GR, GR); G.translate(-GX0, 0); const rp = G.createPattern(TEX.road, 'repeat')!; rp.setTransform(new DOMMatrix().scale(10 / 512)); G.strokeStyle = rp; G.lineWidth = Math.max(4, 8 * PPM * 2); G.lineCap = 'round'; G.globalAlpha = .9;
  G.beginPath(); G.moveTo(VW * .5, VH); G.bezierCurveTo(VW * .3, VH * .7, VW * .7, VH * .45, VW * .52, VH * .2); G.lineTo(VW * .5, 0); G.stroke(); G.restore();
  decal = mk(GW * GR, VH * GR); dctx = decal.getContext('2d')!; dctx.scale(GR, GR); dctx.translate(-GX0, 0);
}
function crater(x: number, y: number, r: number) {
  const eg = dctx.createRadialGradient(x, y, r * .4, x, y, r * 1.8); eg.addColorStop(0, 'rgba(205,182,142,.3)'); eg.addColorStop(1, 'rgba(205,182,142,0)'); dctx.fillStyle = eg; dctx.beginPath(); dctx.arc(x, y, r * 1.8, 0, 7); dctx.fill();
  const gr = dctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(20,16,12,.78)'); gr.addColorStop(.6, 'rgba(40,32,24,.45)'); gr.addColorStop(1, 'rgba(40,32,24,0)'); dctx.fillStyle = gr; dctx.beginPath(); dctx.arc(x, y, r, 0, 7); dctx.fill();
}

// ===== الجسيمات: نفس puff الأصل (fire/spark/dust/black/screen/smoke) + انفجار مصوّر =====
type PT = 'fire' | 'spark' | 'dust' | 'black' | 'screen' | 'smoke' | 'ex' | 'ex2';
interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; type: PT; cell: number; rot: number }
let fx: P[] = [], flash: { x: number; y: number; r: number; life: number }[] = [], shake = 0;
function puffs(x: number, y: number, type: PT, n: number, size: number) {
  for (let i = 0; i < n; i++) { const a = R(0, 6.28), v = type === 'fire' ? R(10, 60) : type === 'spark' ? R(80, 240) : R(4, 26);
    fx.push({ x: x + R(-size, size) * .3, y: y + R(-size, size) * .3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (type === 'smoke' || type === 'black' ? 8 : 0), life: 0, max: type === 'fire' ? R(.25, .6) : type === 'spark' ? R(.2, .5) : type === 'screen' ? R(9, 14) : type === 'black' ? R(3, 6) : R(1.4, 3.2), size: size * R(.6, 1.3), type, cell: Math.floor(Math.random() * 16), rot: R(0, 6.28) }); }
}
function explode(x: number, y: number, cal: number) {   // نفس explode() بالأصل + فليب بوك
  const r = cal * PPM * 14 + 3; flash.push({ x, y, r: r * 2.4, life: 0 }); puffs(x, y, 'fire', 6 + cal * 3, r); puffs(x, y, 'dust', 5 + cal * 2, r * 1.5); puffs(x, y, 'black', 2 + cal, r * 1.3); puffs(x, y, 'spark', 4 + cal * 2, 2);
  if (cal >= 1.2) fx.push({ x, y, vx: 0, vy: 0, life: 0, max: cal >= 2.2 ? 1.3 : 1, size: r * (cal >= 2.2 ? 3.4 : 2.6), type: cal >= 2.2 ? 'ex' : 'ex2', cell: 0, rot: 0 });
  crater(x, y, r * 1.2); snd('boom', x, y, cal); shake = Math.max(shake, cal * 2.2);
}

// ===== الصوت: snd() الأصل بالضبط (مولّد) + تسجيلات حقيقية فوقه =====
let speed = 1, muted = false, ac: AudioContext | null = null, master: GainNode | null = null, active = 0;
const smp: Record<string, AudioBuffer> = {};
function audio() { if (muted) return null; try { if (!ac) { ac = new AudioContext(); master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination); const a = ac; for (const [k, u] of Object.entries(sndUrls)) fetch(u).then(r => r.arrayBuffer()).then(b => a.decodeAudioData(b)).then(buf => { smp[k.split('/').pop()!.replace('.mp3', '')] = buf; }).catch(() => {}); } if (ac.state === 'suspended') ac.resume(); return ac; } catch { return null; } }
let nbuf: AudioBuffer | null = null;
function noiseBuf(a: AudioContext) { if (!nbuf) { nbuf = a.createBuffer(1, a.sampleRate * 3, a.sampleRate); const ch = nbuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; } return nbuf; }
function sample(name: string, t: number, vol: number, rate = 1) { const a = ac!; if (!smp[name] || active > 24) return; const s = a.createBufferSource(); s.buffer = smp[name]; s.playbackRate.value = rate; const gn = a.createGain(); gn.gain.value = vol; s.connect(gn).connect(master!); s.start(t); active++; s.onended = () => active--; }
function snd(type: 'boom' | 'gun' | 'mg' | 'jet' | 'pop', x: number, y: number, size = 1, kind = '') {
  const a = audio(); if (!a || !master) return;
  const d = Math.hypot(x - VW / 2, y - VH / 2) / PPM, t = a.currentTime + d / 340 / speed, vol = Math.min(1, .9 / (1 + d / 900));
  if (speed >= 6 && type === 'mg') return;
  const n = a.createBufferSource(), f = a.createBiquadFilter(), gn = a.createGain();
  const dur = type === 'boom' ? .9 + size * .5 : type === 'gun' ? .35 : type === 'mg' ? .07 : type === 'jet' ? 2.4 : .5; n.buffer = noiseBuf(a); f.type = type === 'jet' ? 'bandpass' : 'lowpass';
  if (type === 'boom') { f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(60, t + dur); gn.gain.setValueAtTime(vol * (.5 + size * .25), t);
    const o = a.createOscillator(), og = a.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + .5); og.gain.setValueAtTime(vol * .7, t); og.gain.exponentialRampToValueAtTime(.001, t + .6); o.connect(og).connect(master); o.start(t); o.stop(t + .6);
    sample(size >= 2 ? 'boom_big' : d > 1500 ? 'boom_far' : 'boom_mid', t, vol * (.35 + size * .12), R(.9, 1.1)); }
  else if (type === 'gun') { f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(200, t + dur); gn.gain.setValueAtTime(vol * .55, t); sample('tank', t, vol * .55, kind === 'shell' ? R(.66, .74) : R(.92, 1.06)); }
  else if (type === 'mg') { f.frequency.value = 3500; gn.gain.setValueAtTime(vol * .22, t); }
  else if (type === 'jet') { f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(2400, t + dur * .45); f.frequency.linearRampToValueAtTime(350, t + dur); gn.gain.setValueAtTime(.001, t); gn.gain.linearRampToValueAtTime(vol * .5, t + dur * .45); }
  else { f.frequency.setValueAtTime(1500, t); gn.gain.setValueAtTime(vol * .3, t); if (kind === 'rocket') sample('rocket', t, vol * .35, R(.9, 1.15)); else if (kind === 'msl') sample('launch', t, vol * .5); else if (kind === 'atgm') sample('atgm', t, vol * .5); }
  gn.gain.exponentialRampToValueAtTime(.001, t + dur); n.connect(f).connect(gn).connect(master); n.start(t, Math.random()); n.stop(t + dur);
}

// ===== المعركة =====
let W: World | null = null, terr: Terr = 'desert', curRes = 'win', running = false;
const mgT = new Map<number, number>();
function handle(e: World['fx'][0]) {
  const w = W!;
  switch (e.k) {
    case 'boom': explode(e.x, e.y, e.cal); break;
    case 'muzzle': {   // fire() بالأصل: ومضة + غبار + صوت
      const a = e.a; flash.push({ x: e.x + Math.cos(a) * 8, y: e.y + Math.sin(a) * 8, r: e.kind === 'tank' || e.kind === 'shell' ? 12 : 7, life: 0 }); puffs(e.x, e.y, 'dust', e.kind === 'shell' || e.kind === 'rocket' ? 4 : 2, 10);
      snd(e.kind === 'rocket' || e.kind === 'msl' || e.kind === 'atgm' ? 'pop' : 'gun', e.x, e.y, 1, e.kind);
      if (e.kind === 'shell' && Math.random() < .3) { const a2 = audio(); if (a2) sample('incoming', a2.currentTime + R(1.2, 2) / speed, .18); }
      break;
    }
    case 'mg': { snd('mg', e.x, e.y); mgT.set(e.src, w.T); if (Math.random() < .25 && speed <= 2) { const a2 = audio(); if (a2) sample(Math.random() < .5 ? 'akburst' : 'mg', a2.currentTime, .12, R(.95, 1.08)); } break; }
    case 'mghit': puffs(e.x, e.y, 'dust', 1, 3); break;
    case 'mslhit': flash.push({ x: e.x, y: e.y, r: 16, life: 0 }); puffs(e.x, e.y, 'smoke', 3, 8); break;
    case 'screen': puffs(e.x, e.y, 'screen', 5, 26 * PPM + 14); snd('pop', e.x, e.y); break;
    case 'house': { const b = w.b[e.id]; puffs(b.x, b.y, 'dust', 10, b.w); puffs(b.x, b.y, 'black', 3, b.w * .7); break; }
    case 'jet': { const j = w.air.find(q => q.id === e.id); if (j) snd('jet', j.x, VH / 2); break; }
  }
}
function step2(dt: number) {
  const w = W!; step(w, dt); for (const e of w.fx) handle(e); w.fx.length = 0;
  // دخان الصواريخ (الأصل: 70٪ من الإطارات) + الحرايق
  for (const p of w.pr) if ((p.kind === 'rocket' || p.kind === 'msl' || p.kind === 'atgm') && Math.random() < .7) { const k = p.t / p.dur, arc = p.kind === 'rocket' ? Math.sin(Math.min(1, k) * Math.PI) * 26 : 0; fx.push({ x: p.x, y: p.y - arc, vx: 0, vy: 0, life: 0, max: .9 * 1.6, size: 3, type: 'smoke', cell: Math.floor(Math.random() * 16), rot: R(0, 6.28) }); }
  for (const x of w.u) if (x.burn! > 0) { if (Math.random() < .3) puffs(x.x, x.y, 'black', 1, 9); if (Math.random() < .2) puffs(x.x, x.y, 'fire', 1, 5); }
  fx = fx.filter(f => { f.life += dt; f.x += f.vx * dt + (f.type !== 'spark' ? 6 * dt : 0); f.y += f.vy * dt; f.vx *= .94; f.vy *= .94; if (f.type !== 'spark' && f.type !== 'fire' && f.type !== 'ex' && f.type !== 'ex2') f.size += dt * (f.type === 'screen' ? 5 : 8); return f.life < f.max; });
  if (fx.length > 900) fx.splice(0, fx.length - 900);
  flash = flash.filter(f => (f.life += dt) < .12); shake *= .86;
  // الحفر تبهت ببطء (المعركة أطول من الأصل ×4.5، فبدونها الأرض تصير كلها حفر)
  fadeT += dt; if (fadeT > 1) { fadeT = 0; dctx.save(); dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = 'destination-out'; dctx.fillStyle = 'rgba(0,0,0,.03)'; dctx.fillRect(0, 0, decal.width, decal.height); dctx.restore(); }
}
let fadeT = 0;

// ===== الرسم (draw بالأصل، بصور حقيقية) =====
const HOUSE = ['h1', 'h2', 'h3', 'h4', 'h6'];
const cam = { x: VW / 2, y: VH / 2, z: 1 };   // تقريب اختياري بالإصبع (الأساس: الساحة كلها)
function sprite(sp: Spr, x: number, y: number, ang: number, size: number, side: number, dead: boolean) {
  g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2); g.drawImage(dead ? sp.dark : side < 0 ? sp.plain : sp.side[side], -size / 2, -size / 2, size, size); g.restore();
}
function shadowOf(sp: Spr, x: number, y: number, ang: number, size: number, ox: number, oy: number, a = .35) { g.save(); g.translate(x + ox, y + oy); g.rotate(ang + Math.PI / 2); g.globalAlpha = a; g.drawImage(sp.shadow, -size / 2, -size / 2, size, size); g.restore(); }
const UN: Record<string, [string, string, number]> = { tank: ['abrams', 't72', 15.5], arty: ['d30', 'd30', 13], mlrs: ['grad', 'grad', 15], ad: ['patriot', 's400', 17] };
function drawUnit(x: Unit, T: number, pass: 0 | 1) {
  if (x.type === 'inf') { if (pass === 1) drawInf(x, T); return; }
  const [n0, n1, sz] = UN[x.type], name = x.side ? n1 : n0, sp = SPR[name], size = sz * S, dead = !x.alive;
  const hull = x.type === 'tank' ? (x.moving ? (x.side ? Math.PI / 2 : -Math.PI / 2) : x.a) : x.a;   // مثل الأصل: الدبابة تمشي لقدّام وتلف للهدف وهي واقفة
  const rec = !dead && T - x.fireT < .25 ? (1 - (T - x.fireT) / .25) * 1.6 : 0, bx = x.x - Math.cos(x.a) * rec, by = x.y - Math.sin(x.a) * rec;
  if (pass === 0) { if (!dead) shadowOf(sp, bx, by, hull, size, 2, 3); return; }
  sprite(sp, bx, by, hull + (dead ? x.rot * .05 : 0), size, x.side, dead);
  if (x.type === 'tank') { const ts = SPR[name + '_t'], p = ts.piv ?? [0, 0], k = size / sp.m, c = Math.cos(hull + Math.PI / 2), s = Math.sin(hull + Math.PI / 2), px = p[0] * k, pz = -p[1] * k;
    sprite(ts, bx + px * c - pz * s, by + px * s + pz * c, dead ? x.a + .6 : x.a, size, -1, dead); }
}
function drawInf(x: Unit, T: number) {
  // نفس النقاط الخمس بالأصل، بس كل نقطة جندي (خوذة، كتوف، بندقية) بإطار لون طرفه
  const firing = T - (mgT.get(x.id) ?? -9) < .4, ofs = [[-5, -3], [4, -5], [-1, 1], [6, 4], [-6, 5]], k = S * .9, a = firing ? x.a : (x.side ? Math.PI / 2 : -Math.PI / 2);
  if (!x.alive) { for (const [ox, oy] of ofs) { g.fillStyle = 'rgba(40,36,30,.55)'; g.beginPath(); g.ellipse(x.x + ox * S, x.y + oy * S, 1.5 * k, .6 * k, ox, 0, 7); g.fill(); } return; }
  const body = x.side ? '#8a7650' : '#56603a', helm = x.side ? '#4b3f28' : '#2d3420';
  ofs.forEach(([ox, oy], i) => {
    const bob = x.moving ? Math.sin(T * 14 + i * 1.7) * .35 : 0;
    g.save(); g.translate(x.x + ox * S, x.y + oy * S + bob); g.rotate(a + Math.PI / 2);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(.9, 1.2, 1.4 * k, .9 * k, 0, 0, 7); g.fill();
    g.strokeStyle = TEAM[x.side]; g.lineWidth = .9; g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 1.45 * k, .85 * k, 0, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = '#1b1a16'; g.lineWidth = .7; g.beginPath(); g.moveTo(.5 * k, -.2 * k); g.lineTo(.5 * k, -2.6 * k); g.stroke();
    g.fillStyle = helm; g.beginPath(); g.arc(0, 0, .62 * k, 0, 7); g.fill();
    if (firing && (i + Math.floor(T * 12)) % 2 === 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,220,140,.95)'; g.beginPath(); g.arc(.5 * k, -3 * k, .9 * k, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
    g.restore();
  });
}
function draw(T: number) {
  const w = W!;
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = '#1d1b16'; g.fillRect(0, 0, SW, SH);
  // المقياس: الساحة 440×800 تملي طول الشاشة (مثل الأصل)، والتقريب الاختياري فوقه
  const base = Math.min(SH / VH, SW / VW * 1.25), z = base * cam.z, sx = R(-shake, shake), sy = R(-shake, shake);
  g.setTransform(z * DPR, 0, 0, z * DPR, (SW / 2 - cam.x * z + sx) * DPR, (SH / 2 - cam.y * z + sy) * DPR);
  g.drawImage(ground, GX0, 0, GW, VH); g.drawImage(decal, GX0, 0, GW, VH);
  // بيوت
  for (const b of w.b) { const sp = SPR[HOUSE[b.c % 4 + (b.id % 2)]], size = b.w * 1.25;
    if (b.dead) { sprite(sp, b.x, b.y, b.r - Math.PI / 2, size * .92, -1, true); g.fillStyle = 'rgba(110,98,82,.7)'; for (let i = 0; i < 5; i++) g.fillRect(b.x + ((i * 7) % 5 - 2.5) * b.w * .2, b.y + ((i * 11) % 5 - 2.5) * b.h * .2, b.w * .3, b.h * .22); }
    else { shadowOf(sp, b.x, b.y, b.r - Math.PI / 2, size, 3, 4, .4); sprite(sp, b.x, b.y, b.r - Math.PI / 2, size, -1, false); } }
  for (const x of w.u) drawUnit(x, T, 0);
  for (const x of w.u) drawUnit(x, T, 1);
  // الجسيمات تحت الطيران
  for (const f of fx) {
    const k = f.life / f.max;
    if (f.type === 'ex' || f.type === 'ex2') { const fr = Math.min(24, Math.floor(k * 25)), src = f.type === 'ex' ? TEX.fx_explo1 : TEX.fx_explo2; g.drawImage(src, (fr % 5) * 200, Math.floor(fr / 5) * 200, 200, 200, f.x - f.size / 2, f.y - f.size * .62, f.size, f.size); continue; }
    if (f.type === 'fire') { const fr = Math.floor(k * 63); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k; const s = f.size * 2; g.drawImage(TEX.fx_fire, (fr % 8) * 64, Math.floor(fr / 8) * 64, 64, 64, f.x - s / 2, f.y - s / 2, s, s); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; continue; }
    if (f.type === 'spark') { g.fillStyle = `rgba(255,230,150,${1 - k})`; g.beginPath(); g.arc(f.x, f.y, 1.4, 0, 7); g.fill(); continue; }
    const src = puff[f.type === 'smoke' ? 'smoke' : f.type], al = f.type === 'dust' ? .62 * (1 - k) : f.type === 'black' ? .78 * (1 - k) : f.type === 'screen' ? .82 * Math.min(1, k * 6) * (1 - k) : .62 * (1 - k), s = f.size * 2.4;
    g.globalAlpha = al; g.save(); g.translate(f.x, f.y); g.rotate(f.rot + f.life * .2); g.drawImage(src, (f.cell % 4) * 128, Math.floor(f.cell / 4) * 128, 128, 128, -s / 2, -s / 2, s, s); g.restore(); g.globalAlpha = 1;
  }
  // المقذوفات (نفس الأصل: قوس للقذائف بظل، خطوط للطلقات)
  for (const p of w.pr) {
    const arc = p.kind === 'shell' || p.kind === 'rocket' ? Math.sin(Math.min(1, p.t / p.dur) * Math.PI) * 26 : 0, a = Math.atan2(p.ty - p.sy, p.tx - p.sx);
    if (arc) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(p.x, p.y, 2, 0, 7); g.fill(); }
    const L = p.kind === 'tank' ? 16 : p.kind === 'mg' ? 8 : 5;
    g.strokeStyle = p.kind === 'mg' ? 'rgba(255,230,120,.95)' : p.kind === 'tank' ? 'rgba(255,240,200,1)' : '#2a2622'; g.lineWidth = p.kind === 'mg' ? 1 : 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(p.x, p.y - arc); g.lineTo(p.x - Math.cos(a) * L, p.y - arc - Math.sin(a) * L); g.stroke();
    if (p.kind === 'tank' || p.kind === 'rocket' || p.kind === 'msl' || p.kind === 'atgm') { g.globalCompositeOperation = 'lighter'; g.fillStyle = p.kind === 'tank' ? 'rgba(255,230,160,.6)' : 'rgba(255,170,70,.75)'; g.beginPath(); g.arc(p.x, p.y - arc, p.kind === 'tank' ? 2.4 : 2, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
  }
  // هليكوبترات (ظل + صورة + مراوح تلف مثل الأصل)
  for (const h of w.heli) { if (T < h.t0) continue; const sp = SPR.ah64, size = 20 * S;
    shadowOf(sp, h.x, h.y, -Math.PI / 2, size, 10, 14, .25); sprite(sp, h.x, h.y, -Math.PI / 2, size, 0, !h.alive);
    g.strokeStyle = 'rgba(20,20,20,.5)'; g.lineWidth = 1.5; for (let i = 0; i < 2; i++) { const a = h.rot + i * Math.PI / 2; g.beginPath(); g.moveTo(h.x - Math.cos(a) * 9 * S, h.y - Math.sin(a) * 9 * S); g.lineTo(h.x + Math.cos(a) * 9 * S, h.y + Math.sin(a) * 9 * S); g.stroke(); }
    g.fillStyle = 'rgba(40,40,40,.12)'; g.beginPath(); g.arc(h.x, h.y, 9 * S, 0, 7); g.fill(); }
  // طيارات ومسيّرات (ظل بعيد مثل الأصل)
  for (const j of w.air) { const jet = j.kind === 'jet', sp = SPR[jet ? (j.side ? 'f16' : 'su25') : (j.side ? 'shahed' : 'tb2')], size = (jet ? 17 : j.side ? 9 : 16) * S, a = Math.atan2(j.vy, j.vx);
    shadowOf(sp, j.x, j.y, a, size, jet ? 26 : 8, jet ? 30 : 12, .22); sprite(sp, j.x, j.y, a, size, j.side, false);
    if (jet) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,190,110,.7)'; g.beginPath(); g.arc(j.x - Math.cos(a) * size * .46, j.y - Math.sin(a) * size * .46, 2.2, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; } }
  // ومضات (نفس الأصل)
  for (const f of flash) { const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); gr.addColorStop(0, 'rgba(255,250,220,.95)'); gr.addColorStop(.4, 'rgba(255,190,80,.6)'); gr.addColorStop(1, 'rgba(255,150,40,0)'); g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill(); }
}

// ===== الشريط (hud بالأصل + ساعة) =====
let endShown = false, lastPh = '';
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function hud() {
  const w = W!, ph = phase(w.T);
  if (ph !== lastPh) { lastPh = ph; $('bphase').textContent = ph; }
  const b = bars(w); ($('bla') as HTMLElement).style.width = clamp(b.a, 0, 100) + '%'; ($('bld') as HTMLElement).style.width = clamp(b.d, 0, 100) + '%';
  $('bwhere').innerHTML = `${w.res.rname} — ${TERR_N[w.res.terr]} <b>${mmss(Math.min(w.T, CARD))}</b>`;
  if (w.T >= CARD && !endShown) {
    endShown = true; const res = w.res, e = $('bend'); e.hidden = false; e.className = res.win ? 'win' : 'lose';
    e.innerHTML = `<div class="stamp">${stamp(res)}</div><h2>${res.rname}</h2><p>خسرت ${Math.round(res.la * 100)}٪ من القوة المشاركة، والعدو خسر ${Math.round(res.ld * 100)}٪ من مدافعيه. المدة ${res.wk} أسابيع.</p><button class="btn go" id="bBack">رجوع للقيادة</button><button class="btn" id="bAgain">شوفها مرة ثانية</button>`;
    $('bBack').onclick = () => showStart(); $('bAgain').onclick = () => startBattle();
  }
}
function startBattle() {
  const res: Res = { ...structuredClone(SAMPLES[curRes]), terr, an: 'العراق', bn: 'العدو' };
  W = create(res); fx = []; flash = []; shake = 0; mgT.clear(); buildGround(terr); cam.x = VW / 2; cam.y = VH / 2; cam.z = 1;
  $('bna').textContent = res.an!; $('bnd').textContent = res.bn!; endShown = false; lastPh = ''; setSpeed(1);
  ($('start') as HTMLElement).hidden = true; $('hud').hidden = false; $('ctl').hidden = false; $('bend').hidden = true; running = true; audio();
}
function showStart() { running = false; ($('start') as HTMLElement).hidden = false; $('hud').hidden = true; $('ctl').hidden = true; $('bend').hidden = true; }
function setSpeed(s: number) { speed = s; $('spd').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+(b as HTMLElement).dataset.s! === s))); }
$('spd').querySelectorAll('button').forEach(b => b.addEventListener('click', () => setSpeed(+(b as HTMLElement).dataset.s!)));
$('bSkip').onclick = () => { if (W && W.T < CARD) { setSpeed(1); skip(W); } };
$('bFit').onclick = () => { cam.x = VW / 2; cam.y = VH / 2; cam.z = 1; };
$('bMute').onclick = () => { muted = !muted; $('bMute').textContent = muted ? '🔇' : '🔊'; if (muted && ac) ac.suspend(); else if (ac) ac.resume(); };
const seg = (id: string, f: (v: string) => void) => $(id).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); f((b as HTMLElement).dataset.v!); }));
seg('sRes', v => { curRes = v; terr = SAMPLES[v].terr; $('sTerr').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.v === terr))); });
seg('sTerr', v => { terr = v as Terr; });
$('bGo').onclick = () => startBattle();
$('credBtn').onclick = () => { $('credits').hidden = false; }; $('credX').onclick = () => { $('credits').hidden = true; };
// تقريب اختياري: إصبعين للتقريب، إصبع للسحب، ⤢ يرجع الساحة كلها
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
  if (AUTO) { const r = qs.get('r'); if (r && SAMPLES[r]) { curRes = r; terr = SAMPLES[r].terr; } if (qs.get('terr')) terr = qs.get('terr') as Terr; startBattle(); (window as any).ready = true; }
})();
(window as any).seek = (t: number) => { if (!W) return; while (W.T < t) step2(1 / 30); hud(); };
(window as any).K = K;
