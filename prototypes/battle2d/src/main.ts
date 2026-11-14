// معركة الهجوم 2D الواقعية (I-049): رسم Canvas من فوق فوق محاكاة sim.ts.
// كل وحدة صورة مخبوزة من مجسمها الحقيقي (البرج منفصل يلف)، ظلال حسب الارتفاع، انفجارات ودخان ونار مصوّرة،
// حفر وآثار جنازير تبقى، بيوت تنهدم، جنود فرادى، كاميرا «مخرج» + سحب/تقريب، سرعات ×1–×8، أصوات حقيقية.
import { create, step, bars, phaseName, skip, stamp, roadX, SAMPLES, FW, FH, World, Res, Unit, Air, Proj, Fx, Terr, Tactic } from './sim';
import manifest from '../sprites/manifest.json';

const $ = (id: string) => document.getElementById(id)!;
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sprUrls = import.meta.glob('../sprites/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const texUrls = import.meta.glob('../../theater/textures/{sand,road,fx_explo1,fx_explo2,fx_cloud,fx_fire}.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const sndUrls = import.meta.glob('../../theater/sounds/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const MAN = manifest as Record<string, { m: number; piv?: number[] }>;
const qs = new URLSearchParams(location.search), AUTO = qs.has('auto');

const cv = $('c') as HTMLCanvasElement, g = cv.getContext('2d')!;
let SW = 0, SH = 0, DPR = 1;
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); SW = cv.clientWidth; SH = cv.clientHeight; cv.width = SW * DPR; cv.height = SH * DPR; }
window.addEventListener('resize', resize); resize();

// ===== تحميل =====
const loadImg = (u: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });
const mkCanvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
interface Spr { img: CanvasImageSource; dark: HTMLCanvasElement; shadow: HTMLCanvasElement; m: number; piv?: number[]; px: number }
const SPR: Record<string, Spr> = {};
const TEX: Record<string, HTMLImageElement> = {};
let smokeTint: Record<string, HTMLCanvasElement> = {};
function variants(img: HTMLImageElement) {
  const n = 256, sc = mkCanvas(n, n), sg = sc.getContext('2d')!; sg.drawImage(img, 0, 0, n, n);
  const dk = mkCanvas(n, n), dg = dk.getContext('2d')!; dg.drawImage(sc, 0, 0); dg.globalCompositeOperation = 'source-atop'; dg.fillStyle = 'rgba(16,13,10,.84)'; dg.fillRect(0, 0, n, n);
  const sh = mkCanvas(n, n), hg = sh.getContext('2d')!; hg.filter = 'blur(3px)'; hg.drawImage(sc, 0, 0); hg.filter = 'none'; hg.globalCompositeOperation = 'source-in'; hg.fillStyle = '#000'; hg.fillRect(0, 0, n, n);
  return { img: sc, dark: dk, shadow: sh };
}
async function loadAll(say: (t: string) => void) {
  const names = Object.keys(MAN); let k = 0;
  await Promise.all(names.map(async n => { const img = await loadImg(sprUrls[`../sprites/${n}.png`]); SPR[n] = { ...variants(img), m: MAN[n].m, piv: MAN[n].piv, px: 256 }; say(`يحمّل الصور… ${++k}/${names.length}`); }));
  for (const [k2, u] of Object.entries(texUrls)) TEX[k2.split('/').pop()!.replace('.webp', '')] = await loadImg(u);
  // الدخان بثلاث ألوان (أسود حريق، رمادي انفجار، أبيض ستار، تراب)
  // غيمة ناعمة: 64 شكل مختلف (8×8) من دوائر ضبابية متراكبة — من فوق الدخان يبين كتل ناعمة مو دوائر
  const puffSheet = mkCanvas(1024, 1024), px = puffSheet.getContext('2d')!; let sd = 11; const rr = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let c = 0; c < 64; c++) { const ox = (c % 8) * 128 + 64, oy = Math.floor(c / 8) * 128 + 64;
    for (let i = 0; i < 16; i++) { const a = rr() * 6.28, r = rr() * 30, x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r, rad = 14 + rr() * 22, gr = px.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(255,255,255,${0.22 + rr() * 0.2})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); px.fillStyle = gr; px.beginPath(); px.arc(x, y, rad, 0, 7); px.fill(); } }
  const tint = (rgb: string) => { const c = mkCanvas(1024, 1024), x = c.getContext('2d')!; x.drawImage(puffSheet, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = rgb; x.fillRect(0, 0, 1024, 1024); return c; };
  smokeTint = { blk: tint('rgb(78,72,66)'), gry: tint('rgb(150,144,134)'), wht: tint('rgb(238,238,232)'), dust: tint('rgb(184,158,118)') };
}

// ===== الأرض =====
const PAL: Record<Terr, number[][]> = { desert: [[214, 190, 140], [190, 160, 108], [160, 128, 84]], plain: [[112, 128, 70], [136, 142, 82], [168, 156, 104]], hills: [[104, 116, 72], [140, 132, 90], [150, 140, 118]], mount: [[96, 104, 84], [128, 124, 112], [176, 172, 164]] };
const TERR_N: Record<Terr, string> = { plain: 'سهل', desert: 'صحراء', hills: 'تلال', mount: 'جبال' };
function vnoise(sx: number, sy: number, seed: number) {
  const h = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453; return n - Math.floor(n); };
  const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0, s = (t: number) => t * t * (3 - 2 * t);
  return h(x0, y0) * (1 - s(fx)) * (1 - s(fy)) + h(x0 + 1, y0) * s(fx) * (1 - s(fy)) + h(x0, y0 + 1) * (1 - s(fx)) * s(fy) + h(x0 + 1, y0 + 1) * s(fx) * s(fy);
}
const fbm = (x: number, y: number, s: number) => vnoise(x, y, s) * .5 + vnoise(x * 2.1, y * 2.1, s + 7) * .27 + vnoise(x * 4.3, y * 4.3, s + 13) * .15 + vnoise(x * 9, y * 9, s + 29) * .08;
const GX0 = -450, GY0 = -450, GW = FW + 900, GH = FH + 900, GS = 0.5, DS = 1;   // الأرض نص بكسل/متر، والآثار 0.8
let ground: HTMLCanvasElement, decal: HTMLCanvasElement, dctx: CanvasRenderingContext2D, sandPat: CanvasPattern | null = null, roadPat: CanvasPattern | null = null;
function buildGround(terr: Terr, seed: number) {
  const w = Math.round(GW * GS), h = Math.round(GH * GS); ground = mkCanvas(w, h); const x = ground.getContext('2d')!, im = x.createImageData(w, h), p = PAL[terr];
  const relief = terr === 'mount' ? 70 : terr === 'hills' ? 45 : terr === 'desert' ? 22 : 12;
  const H = (i: number, j: number) => fbm(i / w * 6, j / h * 9, seed);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = H(i, j), sl = (H(i + 1, j + 1) - H(i - 1, j - 1)) * relief * 8, t = clamp((v - .3) * 2.2, 0, 1), A = t < .5 ? p[0] : p[1], B = t < .5 ? p[1] : p[2], u = t < .5 ? t * 2 : (t - .5) * 2, k = (i + j * w) * 4;
    const patch = terr === 'plain' ? ((Math.floor(i / 22 + vnoise(j / 40, 3, seed) * 2) + Math.floor(j / 18)) % 2 ? 6 : -6) : 0;
    const wx = i / GS + GX0, wy = j / GS + GY0, edge = Math.max(0, Math.abs(wx - FW / 2) - FW / 2 - 60, Math.abs(wy - FH / 2) - FH / 2 - 60) / 300;
    const rock = (terr === 'mount' || terr === 'hills') ? clamp(edge, 0, 1) * (v > .5 ? 30 : 10) : 0;
    for (let q = 0; q < 3; q++) im.data[k + q] = clamp(A[q] + (B[q] - A[q]) * u - sl + patch + rock, 0, 255); im.data[k + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  decal = mkCanvas(Math.round(GW * DS), Math.round(GH * DS)); dctx = decal.getContext('2d')!;
  // تفاصيل مخبوزة: حصى، شجيرات صغيرة، بقع — حتى من قريب الأرض ما تبين ملساء
  let gsd = Math.floor(seed * 1000) + 5; const rr = () => { gsd = (gsd * 16807) % 2147483647; return gsd / 2147483647; };
  const shrub = terr === 'plain' ? [72, 92, 44] : terr === 'desert' ? [112, 104, 64] : [84, 92, 56];
  for (let i = 0; i < 26000; i++) { const X = rr() * GW * DS, Y = rr() * GH * DS, r = 0.4 + rr() * 1.1, c = 70 + rr() * 90; dctx.fillStyle = `rgba(${c},${c * 0.88},${c * 0.7},${0.25 + rr() * 0.35})`; dctx.fillRect(X, Y, r, r); }
  const nSh = terr === 'plain' ? 2600 : terr === 'desert' ? 900 : 1800;
  for (let i = 0; i < nSh; i++) { const X = rr() * GW * DS, Y = rr() * GH * DS, R = (0.8 + rr() * 1.8) * DS;
    if (Math.abs(X / DS + GX0 - roadX(Y / DS + GY0)) < 7) continue;
    dctx.fillStyle = 'rgba(30,24,14,.22)'; dctx.beginPath(); dctx.ellipse(X + R * 0.5, Y + R * 0.4, R, R * 0.8, 0, 0, 7); dctx.fill();
    for (let k = 0; k < 4; k++) { const a = rr() * 6.28, q = rr() * R * 0.5, f = 0.75 + rr() * 0.4; dctx.fillStyle = `rgba(${shrub[0] * f | 0},${shrub[1] * f | 0},${shrub[2] * f | 0},.8)`; dctx.beginPath(); dctx.arc(X + Math.cos(a) * q, Y + Math.sin(a) * q, R * (0.45 + rr() * 0.3), 0, 7); dctx.fill(); } }
  for (let i = 0; i < 90; i++) { const X = rr() * GW * DS, Y = rr() * GH * DS, R = (15 + rr() * 40) * DS, gr = dctx.createRadialGradient(X, Y, 0, X, Y, R), dark = rr() < .5; gr.addColorStop(0, dark ? 'rgba(70,55,35,.12)' : 'rgba(255,240,210,.1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); dctx.fillStyle = gr; dctx.fillRect(X - R, Y - R, R * 2, R * 2); }
  // تفاصيل الرمل: نسخة رمادية نطبعها بـ soft-light فوق اللون
  const sd = mkCanvas(512, 512), sx = sd.getContext('2d')!; sx.filter = 'grayscale(1) contrast(1.3)'; sx.drawImage(TEX.sand, 0, 0, 512, 512); sandPat = g.createPattern(sd, 'repeat');
  roadPat = g.createPattern(TEX.road, 'repeat');
}

// ===== الجسيمات =====
type PK = 'smk' | 'gry' | 'wht' | 'dust' | 'fire' | 'ex' | 'ex2' | 'flash' | 'spark';
interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; life: number; s0: number; s1: number; k: PK; cell: number; rot: number; vr: number; a: number }
const parts: Part[] = [];
const MAXP = 1400;
function emit(k: PK, x: number, y: number, o: Partial<Part> & { n?: number; spd?: number; jit?: number } = {}) {
  const n = o.n ?? 1;
  for (let i = 0; i < n; i++) {
    if (parts.length >= MAXP) parts.splice(0, 40);
    const a = Math.random() * 6.28, sp = (o.spd ?? 0) * (0.4 + Math.random() * 0.6), j = o.jit ?? 0;
    parts.push({ x: x + (Math.random() - .5) * j, y: y + (Math.random() - .5) * j, z: o.z ?? 0, vx: (o.vx ?? 0) + Math.cos(a) * sp, vy: (o.vy ?? 0) + Math.sin(a) * sp, vz: o.vz ?? 0, t: 0, life: (o.life ?? 1) * (0.8 + Math.random() * 0.4), s0: o.s0 ?? 4, s1: o.s1 ?? 10, k, cell: Math.floor(Math.random() * 64), rot: Math.random() * 6.28, vr: (Math.random() - .5) * 0.6, a: o.a ?? 1 });
  }
}
const flare = (() => { const c = mkCanvas(128, 128), x = c.getContext('2d')!, gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(.18, 'rgba(255,215,140,.85)'); gr.addColorStop(.5, 'rgba(255,140,50,.28)'); gr.addColorStop(1, 'rgba(255,110,20,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return c; })();
function crater(x: number, y: number, r: number) {
  const X = (x - GX0) * DS, Y = (y - GY0) * DS, R = r * DS, gr = dctx.createRadialGradient(X, Y, 0, X, Y, R);
  // حفرة من فوق: تراب مقذوف فاتح حواليها، وحافة، ونص غامق صغير
  const eg = dctx.createRadialGradient(X, Y, R * 0.4, X, Y, R * 1.9); eg.addColorStop(0, 'rgba(200,178,140,.32)'); eg.addColorStop(1, 'rgba(200,178,140,0)'); dctx.fillStyle = eg; dctx.beginPath(); dctx.arc(X, Y, R * 1.9, 0, 7); dctx.fill();
  gr.addColorStop(0, 'rgba(26,20,14,.72)'); gr.addColorStop(.55, 'rgba(48,38,26,.45)'); gr.addColorStop(.85, 'rgba(90,74,52,.25)'); gr.addColorStop(1, 'rgba(90,74,52,0)');
  dctx.fillStyle = gr; dctx.beginPath(); dctx.arc(X, Y, R, 0, 7); dctx.fill();
}
function track(x: number, y: number, hd: number, w: number) {
  const X = (x - GX0) * DS, Y = (y - GY0) * DS; dctx.save(); dctx.translate(X, Y); dctx.rotate(hd); dctx.fillStyle = 'rgba(60,46,32,.09)';
  dctx.fillRect(-1.5 * DS, -w * 0.42 * DS, 3 * DS, w * 0.2 * DS); dctx.fillRect(-1.5 * DS, w * 0.22 * DS, 3 * DS, w * 0.2 * DS); dctx.restore();
}

// ===== الصوت =====
let speed = 1, muted = false;
const sfx = (() => {
  let ac: AudioContext | null = null, master: GainNode, nb: AudioBuffer, buzz: GainNode | null = null, chop: GainNode | null = null, active = 0;
  const smp: Record<string, AudioBuffer> = {};
  const vol = (d: number) => clamp(1.1 - d / 1800, 0, 1) ** 2;
  function play(name: string, d: number, g0: number, rate = 1, echo = false) {
    if (!ac || !smp[name]) return false; const v0 = vol(d) * g0; if (v0 < 0.012) return true;
    if (active > 22 && g0 < 0.7) return true;
    const t = ac.currentTime + Math.min(1.5, d / 343 / speed), s = ac.createBufferSource(); s.buffer = smp[name]; s.playbackRate.value = rate;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = clamp(16000 - d * 9, 900, 16000);
    const gn = ac.createGain(); gn.gain.value = v0; s.connect(f).connect(gn).connect(master); s.start(t); active++; s.onended = () => { active--; };
    if (echo && d > 150) { const e = ac.createBufferSource(); e.buffer = smp[name]; e.playbackRate.value = rate; const eg = ac.createGain(); eg.gain.value = v0 * 0.25; e.connect(eg).connect(master); e.start(t + 0.18 + Math.random() * 0.2); }
    return true;
  }
  const loopNoise = (type: BiquadFilterType, fr: number, q: number) => { const s = ac!.createBufferSource(); s.buffer = nb; s.loop = true; const f = ac!.createBiquadFilter(); f.type = type; f.frequency.value = fr; f.Q.value = q; const gn = ac!.createGain(); gn.gain.value = 0; s.connect(f).connect(gn); s.start(); return gn; };
  return {
    init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try { ac = new AudioContext(); } catch { return; }
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(ac.destination);
      nb = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate); const dd = nb.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
      const a = ac; for (const [k, u] of Object.entries(sndUrls)) { const n = k.split('/').pop()!.replace('.mp3', ''); fetch(u).then(r => r.arrayBuffer()).then(b => a.decodeAudioData(b)).then(buf => { smp[n] = buf; }).catch(() => {}); }
      buzz = loopNoise('bandpass', 420, 3); buzz.connect(master);
      const cg = loopNoise('lowpass', 260, 0.7), lfo = ac.createOscillator(), lg = ac.createGain(), am = ac.createGain(); lfo.frequency.value = 18; lg.gain.value = 0.5; am.gain.value = 0.5; lfo.connect(lg).connect(am.gain); lfo.start(); cg.connect(am).connect(master); chop = cg;
    },
    toggle() { muted = !muted; if (ac) master.gain.setTargetAtTime(muted ? 0 : 0.85, ac.currentTime, 0.05); return muted; },
    boom(d: number, s: number) { play(d > 1200 ? 'boom_far' : s >= 1.6 ? 'boom_big' : 'boom_mid', d, 0.55 + s * 0.2, 0.9 + Math.random() * 0.2, true); },
    tank(d: number) { play('tank', d, 0.95, 0.92 + Math.random() * 0.14, true); },
    how(d: number) { play('tank', d, 1, 0.66 + Math.random() * 0.08, true); },
    can(d: number) { play('can30', d, 0.6, 0.95 + Math.random() * 0.1); },
    mg(d: number) { if (speed <= 2) play(Math.random() < .5 ? 'akburst' : 'mg', d, 0.38, 0.95 + Math.random() * 0.1); },
    rocket(d: number) { play('rocket', d, 0.5, 0.9 + Math.random() * 0.2); },
    launch(d: number) { play('launch', d, 0.8); },
    atgm(d: number) { play('atgm', d, 0.85) || play('launch', d, 0.6); },
    incoming(d: number) { if (speed <= 2) play('incoming', d, 0.6); },
    jet(d: number) {
      if (!ac) return; const t = ac.currentTime, dur = 3, v0 = clamp(1.2 - d / 1500, 0.15, 1) * 0.5;
      const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(2600, t + dur * .45); f.frequency.linearRampToValueAtTime(320, t + dur);
      const gn = ac.createGain(); gn.gain.setValueAtTime(0.001, t); gn.gain.linearRampToValueAtTime(v0, t + dur * .45); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f).connect(gn).connect(master); s.start(t, Math.random()); s.stop(t + dur);
    },
    loops(drone: number, heli: number) { if (!ac) return; buzz?.gain.setTargetAtTime(vol(drone) * 0.07, ac.currentTime, 0.3); chop?.gain.setTargetAtTime(vol(heli) * 0.5, ac.currentTime, 0.3); },
  };
})();

// ===== الكاميرا =====
const cam = { x: FW / 2, y: FH / 2, z: 0.5 };
let auto = true, focus = { x: FW / 2, y: FH / 2, z: 0.5 }, shake = 0;
const fitZ = () => Math.min(SW / (FW + 120), SH / (FH + 200));
const ZMIN = () => fitZ() * 0.9, ZMAX = 9;
const camDist = (x: number, y: number) => Math.hypot(x - cam.x, y - cam.y) + 260 / Math.max(0.3, cam.z);
function director(w: World, dt: number) {
  const T = w.T, ph = w.phase, base = SW / 390;
  const alive = (f: (u: Unit) => boolean) => w.u.filter(u => u.alive && !u.mounted && f(u));
  const mean = (l: { x: number; y: number }[]) => l.length ? { x: l.reduce((a, b) => a + b.x, 0) / l.length, y: l.reduce((a, b) => a + b.y, 0) / l.length } : null;
  let f: { x: number; y: number } | null = null, z = 2;
  if (w.over) { f = { x: w.vill[0], y: w.vill[1] + 60 }; z = 2.2; }
  else if (ph === 0) { const d = w.air.find(a => a.kind === 'drone' && a.side === 0 && a.alive); f = d ? { x: d.x, y: d.y + 40 } : { x: FW / 2, y: 650 }; z = 1.7; }
  else if (ph === 1) { const slot = Math.floor(T / 9) % 3; if (slot === 0) { f = mean(alive(u => u.side === 0 && (u.kind === 'arty' || u.kind === 'mlrs'))); f = f && { x: f.x, y: f.y - 50 }; z = 3.4; } else { f = lastBoom(T, 1) ?? { x: w.vill[0], y: 500 }; z = 2.3; } }
  else if (ph === 2) { const j = w.air.find(a => a.kind === 'jet' && a.alive && a.side === 0) ?? w.air.find(a => a.kind === 'jet' && a.alive); f = j ? { x: j.x, y: j.y - (j.vy < 0 ? 110 : -110) } : lastBoom(T, 1); z = 2; }
  else if (ph === 3) { f = { x: FW / 2, y: 980 }; z = 1.3; }
  else if (ph === 4) { const l = alive(u => u.side === 0 && u.kind === 'tank'), lead = l.sort((a, b) => a.y - b.y)[Math.floor(l.length / 2)]; f = lead ? { x: lead.x, y: lead.y - 60 } : null; z = 2.8; }
  else { const i = mean(alive(u => u.side === 0 && u.kind === 'inf')); f = i ? { x: i.x, y: i.y - 70 } : mean(alive(u => u.side === 0 && u.kind === 'tank')); z = i ? 4.2 : 2.6; if (ph >= 6) { f = { x: w.vill[0], y: w.vill[1] + 50 }; z = 2.6; } }
  if (!f) f = { x: FW / 2, y: 800 };
  focus = { x: f.x, y: f.y, z: Math.max(ZMIN(), z * base) };
  if (Math.hypot(focus.x - cam.x, focus.y - cam.y) > 320) { cam.x = focus.x; cam.y = focus.y; cam.z = focus.z; return; }   // قطع مثل المخرج بدل الزحف على رمل فاضي
  const k = 1 - Math.exp(-dt * 1.4); cam.x += (focus.x - cam.x) * k; cam.y += (focus.y - cam.y) * k; cam.z *= Math.pow(focus.z / cam.z, 1 - Math.exp(-dt * 0.9));
}
const booms: { x: number; y: number; t: number; side: number }[] = [];
function lastBoom(T: number, side: number) { for (let i = booms.length - 1; i >= 0; i--) if (booms[i].side === side && T - booms[i].t < 8) return { x: booms[i].x, y: booms[i].y }; return null; }
function setAuto(on: boolean) { auto = on; $('bCam').setAttribute('aria-pressed', String(on)); }
const ptrs = new Map<number, { x: number; y: number }>(); let pinch = 0;
cv.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId); if (W) setAuto(false); });
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  if (ptrs.size === 1) { cam.x -= (e.clientX - p.x) / cam.z; cam.y -= (e.clientY - p.y) / cam.z; }
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); p.x = e.clientX; p.y = e.clientY; const [c, d] = [...ptrs.values()], d1 = Math.hypot(c.x - d.x, c.y - d.y); if (pinch && d0 > 0) cam.z = clamp(cam.z * d1 / d0, ZMIN(), ZMAX); pinch = d1; return; }
  p.x = e.clientX; p.y = e.clientY;
});
const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch = 0; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); if (W) setAuto(false); cam.z = clamp(cam.z * Math.exp(-e.deltaY * 0.0015), ZMIN(), ZMAX); }, { passive: false });

// ===== المعركة =====
let W: World | null = null, terr: Terr = 'desert', curRes = 'win', tactic: Tactic = 'direct', running = false;
const EXV = 2.2, EXA = 1.5, EXS = 3, ZK = 0.3, SHX = 0.28, SHY = 0.2;   // تكبير بصري (المركبات/الطيران/الجنود)، ارتفاع←إزاحة، اتجاه الظل
interface Prop { n: string; x: number; y: number; r: number; s: number }
let props: Prop[] = [];
const wreckT = new Map<number, number>(), capT = new Map<number, number>(), houseDead = new Map<number, number>();
const feed: { el: HTMLElement; t: number }[] = [];
function say(t: string, side: 0 | 1 | 2) {
  if (feed.length && feed[feed.length - 1].el.textContent === t) { feed[feed.length - 1].t = performance.now(); return; }
  const el = document.createElement('div'); el.className = 's' + side; el.textContent = t; $('feed').appendChild(el); feed.push({ el, t: performance.now() });
  while (feed.length > 4) feed.shift()!.el.remove();
}
function scatterProps(seed: number) {
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out: Prop[] = [], free = (x: number, y: number, rad: number) => Math.abs(x - roadX(y)) > 10 + rad && W!.b.every(b => Math.hypot(b.x - x, b.y - y) > b.w * 0.8 + rad) && out.every(p => Math.hypot(p.x - x, p.y - y) > rad * 1.4);
  const add = (n: string, k: number, area: () => [number, number], rad: number, s0: number, s1: number) => { for (let i = 0, t = 0; i < k && t < k * 40; t++) { const [x, y] = area(); if (!free(x, y, rad)) continue; out.push({ n, x, y, r: r() * 6.28, s: lerp(s0, s1, r()) }); i++; } };
  const vill = (): [number, number] => [W!.vill[0] + (r() - .5) * 700, W!.vill[1] + (r() - .5) * 420];
  const edge = (): [number, number] => [r() < .5 ? -300 + r() * 360 : FW - 60 + r() * 360, -300 + r() * (FH + 600)];
  const field = (): [number, number] => [r() * FW, 600 + r() * 700];
  const any = (): [number, number] => [-300 + r() * (FW + 600), -300 + r() * (FH + 600)];
  if (terr === 'desert') { add('palm', 34, vill, 4, .8, 1.2); add('acacia', 26, edge, 5, .7, 1.2); add('acacia', 8, field, 5, .7, 1); }
  else if (terr === 'plain') { add('palm', 50, vill, 4, .8, 1.2); add('tree', 60, edge, 4, .8, 1.3); add('palm', 22, any, 4, .8, 1.2); add('tree', 10, field, 4, .8, 1.1); }
  else { add('tree', 26, vill, 4, .7, 1.1); add('acacia', 46, edge, 5, .8, 1.3); add('tree', 12, field, 4, .7, 1); }
  for (let i = 0; i < 6; i++) { const y = 380 + r() * 1000, sd = r() < .5 ? -1 : 1; out.push({ n: r() < .5 ? 'car1' : 'pickup', x: roadX(y) + sd * (10 + r() * 6), y, r: r() * 6.28, s: 1 }); }
  props = out;
}
function startBattle() {
  const base = SAMPLES[curRes]; const res: Res = { ...structuredClone(base), terr, tactic, an: 'العراق', bn: 'العدو' };
  W = create(res); parts.length = 0; booms.length = 0; wreckT.clear(); capT.clear(); houseDead.clear(); feed.forEach(f => f.el.remove()); feed.length = 0;
  buildGround(terr, 3 + Math.random() * 40); scatterProps(7 + Math.floor(Math.random() * 1000));
  $('bna').textContent = res.an!; $('bnd').textContent = res.bn!;
  cam.x = FW / 2; cam.y = 1200; cam.z = 1; setAuto(true); setSpeed(1); endShown = false; lastPh = '';
  ($('start') as HTMLElement).hidden = true; $('hud').hidden = false; $('ctl').hidden = false; $('bend').hidden = true; running = true; sfx.init();
}
function showStart() { running = false; ($('start') as HTMLElement).hidden = false; $('hud').hidden = true; $('ctl').hidden = true; $('bend').hidden = true; feed.forEach(f => f.el.remove()); feed.length = 0; }

// ===== أحداث المحاكاة ← مؤثرات وأصوات =====
function handle(f: Fx) {
  const w = W!;
  switch (f.k) {
    case 'boom': {
      const s = f.cal, z = f.air ? 120 : 0;
      if (!f.air) { crater(f.x, f.y, 1.5 + s * 2.2); booms.push({ x: f.x, y: f.y, t: w.T, side: f.y < 1000 ? 1 : 0 }); if (booms.length > 60) booms.shift(); }
      if (s >= 0.9) emit(s >= 2 ? 'ex' : 'ex2', f.x, f.y, { z, life: s >= 2 ? 1.6 : 1.2, s0: 10 + s * 7, s1: 16 + s * 10, jit: 2 });
      emit('flash', f.x, f.y, { z, life: 0.18, s0: 14 + s * 14, s1: 22 + s * 18 });
      emit('fire', f.x, f.y, { z, n: Math.round(3 + s * 3), spd: 6 + s * 5, life: 0.5, s0: 3 + s, s1: 6 + s * 2, jit: s * 2 });
      emit(f.air ? 'gry' : s >= 2 ? 'blk' as PK : 'gry', f.x, f.y, { z, n: Math.round(1 + s * 1.5), spd: 2 + s * 1.5, life: 5 + s * 2, s0: 5 + s * 2.5, s1: 12 + s * 6, jit: s * 3, a: 0.6, vx: 1.5 });
      if (!f.air) emit('dust', f.x, f.y, { n: Math.round(3 + s * 3), spd: 8 + s * 5, life: 3 + s, s0: 5 + s * 2, s1: 14 + s * 7, jit: 2, a: 0.7 });
      emit('spark', f.x, f.y, { z: z + 1, n: Math.round(6 + s * 6), spd: 30 + s * 25, life: 0.5 });
      const d = camDist(f.x, f.y); shake = Math.max(shake, s * 2.2 * clamp(1 - d / 900, 0, 1)); sfx.boom(d, s); break;
    }
    case 'fire': {
      const u = w.u.find(q => q.id === f.id), d = camDist(f.x, f.y), ca = Math.cos(f.a), sa = Math.sin(f.a);
      if (f.kind === 'mg') { if (Math.random() < 0.3) sfx.mg(d); break; }
      const len = u?.kind === 'tank' ? 7 * EXV : u?.kind === 'arty' ? 4.5 * EXV : 3, mx = f.x + ca * len, my = f.y + sa * len;
      if (f.kind === 'ap') { emit('flash', mx, my, { life: 0.12, s0: 9, s1: 14 }); emit('dust', f.x, f.y, { n: 4, spd: 10, life: 2.5, s0: 5, s1: 14, jit: 6, a: .6 }); emit('gry', mx, my, { n: 2, vx: ca * 6, vy: sa * 6, life: 2, s0: 3, s1: 8, a: .5 }); sfx.tank(d); }
      else if (f.kind === 'shell') { emit('flash', mx, my, { life: 0.14, s0: 10, s1: 15 }); emit('dust', f.x, f.y, { n: 6, spd: 12, life: 3, s0: 6, s1: 16, jit: 8, a: .65 }); emit('gry', mx, my, { n: 3, vx: ca * 5, vy: sa * 5, life: 3.5, s0: 4, s1: 12, a: .6 }); sfx.how(d); }
      else if (f.kind === 'rocket') { emit('flash', f.x, f.y, { z: 3, life: 0.1, s0: 6, s1: 9 }); emit('gry', f.x - ca * 6, f.y - sa * 6, { n: 2, spd: 4, life: 3, s0: 4, s1: 10, a: .55 }); if (Math.random() < .4) sfx.rocket(d); }
      else if (f.kind === 'sam') { emit('flash', f.x, f.y, { z: 6, life: 0.2, s0: 8, s1: 12 }); emit('wht', f.x, f.y, { n: 6, spd: 6, life: 4, s0: 5, s1: 14, a: .6 }); sfx.launch(d); }
      else if (f.kind === 'atgm') { emit('flash', f.x, f.y, { z: u?.alt ?? 2, life: 0.1, s0: 5, s1: 8 }); emit('wht', f.x, f.y, { z: u?.alt ?? 1, n: 2, spd: 2, life: 2, s0: 2, s1: 6, a: .5 }); sfx.atgm(d); }
      else if (f.kind === 'can') { emit('flash', mx, my, { life: 0.06, s0: 3, s1: 5 }); if (Math.random() < .5) sfx.can(d); }
      break;
    }
    case 'hit': if (!f.kill) { emit('spark', f.x, f.y, { z: 2, n: 10, spd: 40, life: .5 }); emit('flash', f.x, f.y, { z: 2, life: .1, s0: 5, s1: 8 }); } break;
    case 'mghit': if (Math.random() < .5) emit('dust', f.x, f.y, { life: .8, s0: .6, s1: 2.2, a: .5 }); break;
    case 'kill': {
      if (f.kind === 'sol') break;
      if (f.kind === 'jet' || f.kind === 'drone') { const a = w.air.find(q => q.id === f.id); if (a) { emit('ex2', a.x, a.y, { z: a.alt, life: 1.2, s0: 12, s1: 20 }); emit('blk' as PK, a.x, a.y, { z: a.alt, n: 4, spd: 4, life: 5, s0: 6, s1: 16 }); } break; }
      wreckT.set(f.id, w.T); const u = w.u.find(q => q.id === f.id); if (u) { emit('ex', u.x, u.y, { z: 2, life: 1.5, s0: 16, s1: 26 }); emit('fire', u.x, u.y, { n: 8, spd: 14, life: .7, s0: 4, s1: 9 }); emit('spark', u.x, u.y, { z: 3, n: 26, spd: 60, life: .8 }); crater(u.x, u.y, 7); }
      break;
    }
    case 'house': houseDead.set(f.id, w.T); { const b = w.b[f.id]; emit('dust', b.x, b.y, { n: 12, spd: 10, life: 6, s0: 8, s1: 24, jit: b.w, a: .8 }); emit('gry', b.x, b.y, { n: 6, spd: 3, life: 10, s0: 8, s1: 22, jit: b.w * .6 }); } break;
    case 'capture': capT.set(f.id, w.T); break;
    case 'smoke': emit('wht', f.x, f.y, { n: f.big ? 9 : 3, spd: 3, life: 26, s0: 16, s1: 52, jit: 40, a: 0.72, vx: 1.2 }); emit('flash', f.x, f.y, { life: .1, s0: 6, s1: 8 }); sfx.boom(camDist(f.x, f.y), 0.3); break;
    case 'jet': { const a = w.air.find(q => q.id === f.id); if (a) setTimeout(() => sfx.jet(camDist(a.x, a.y)), 900 / speed); break; }
    case 'msg': if (speed <= 4 || f.side === 2) say(f.t, f.side); break;
  }
}

// ===== الرسم =====
function drawSpr(s: Spr, x: number, y: number, ang: number, size: number, mode: 'n' | 'd' = 'n', alpha = 1) {
  g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2); g.globalAlpha = alpha; const h = size / 2; g.drawImage(mode === 'd' ? s.dark : s.img, -h, -h, size, size); g.restore();
}
function drawShadow(s: Spr, x: number, y: number, ang: number, size: number, off: number, a = 0.38) {
  g.save(); g.translate(x + off * SHX * 4, y + off * SHY * 4); g.rotate(ang + Math.PI / 2); g.globalAlpha = a; const h = size / 2; g.drawImage(s.shadow, -h, -h, size, size); g.restore();
}
const HOUSE = ['h1', 'h2', 'h3', 'h4', 'h6'];
const SIDE_COL = [['#c9b787', '#3e3a2c'], ['#6f7f55', '#2b3022']];
function vehSprite(u: Unit): [string, string | null] {
  if (u.kind === 'tank') return u.side ? ['t72', 't72_t'] : ['abrams', 'abrams_t'];
  if (u.kind === 'ifv') return ['bmp', null]; if (u.kind === 'arty') return ['d30', null]; if (u.kind === 'mlrs') return ['grad', null];
  if (u.kind === 'ad') return [u.side ? 's400' : 'patriot', null]; return ['ah64', null];
}
function drawUnit(u: Unit, T: number, pass: 'shadow' | 'body') {
  if (u.mounted || u.kind === 'inf' || u.kind === 'heli') return;
  const [hn, tn] = vehSprite(u), S = SPR[hn], size = S.m * EXV, dead = !u.alive;
  const rec = !dead && T - u.fireT < 0.25 ? (1 - (T - u.fireT) / 0.25) * 0.6 : 0, bx = u.x - Math.cos(u.hd) * rec, by = u.y - Math.sin(u.hd) * rec;
  if (pass === 'shadow') { drawShadow(S, bx, by, u.hd, size, 2.2 * EXV); return; }
  drawSpr(S, bx, by, u.hd, size, dead ? 'd' : 'n');
  if (tn) {
    const TS = SPR[tn], p = TS.piv ?? [0, 0], c = Math.cos(u.hd + Math.PI / 2), s = Math.sin(u.hd + Math.PI / 2), px = p[0] * EXV, pz = -p[1] * EXV;
    const tx = bx + px * c - pz * s, ty = by + px * s + pz * c, ta = dead ? u.tur + (u.id % 3 - 1) * 0.5 : u.tur;
    const rt = !dead && T - u.fireT < 0.2 ? (1 - (T - u.fireT) / 0.2) * 0.9 : 0;
    drawSpr(TS, tx - Math.cos(ta) * rt, ty - Math.sin(ta) * rt, ta, size, dead ? 'd' : 'n');
  }
  if (!dead && T - u.hitT < 0.5) { g.globalAlpha = 0.6 * (1 - (T - u.hitT) / 0.5); g.fillStyle = '#ffd9a0'; g.beginPath(); g.arc(u.x, u.y, 2.5, 0, 7); g.fill(); g.globalAlpha = 1; }
}
function drawSoldiers(u: Unit, T: number) {
  if (u.kind !== 'inf' || u.mounted) return;
  const col = SIDE_COL[u.side], k = EXS;
  for (const s of u.sol) {
    const dead = !s.alive, prone = s.pose === 1 || dead, a = s.dir;
    g.save(); g.translate(s.x, s.y); g.rotate(a + Math.PI / 2);
    // ظل
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0.35 * k, 0.3 * k, 0.32 * k, (prone ? 0.9 : 0.25) * k, 0, 0, 7); g.fill();
    if (dead) { g.fillStyle = 'rgba(60,20,14,.45)'; g.beginPath(); g.ellipse(0.2 * k, 0.2 * k, 0.5 * k, 0.4 * k, 0, 0, 7); g.fill(); }
    g.fillStyle = dead ? '#4a463c' : col[0];
    if (prone) { g.beginPath(); g.ellipse(0, 0.25 * k, 0.24 * k, 0.78 * k, 0, 0, 7); g.fill(); }
    else { const bob = s.pose === 2 ? Math.sin(T * 12 + s.ox) * 0.08 * k : 0; g.beginPath(); g.ellipse(0, bob, 0.34 * k, 0.2 * k, 0, 0, 7); g.fill(); }
    if (!dead) { g.strokeStyle = '#1d1c18'; g.lineWidth = 0.09 * k; g.beginPath(); g.moveTo(0.12 * k, (prone ? -0.3 : -0.05) * k); g.lineTo(0.12 * k, (prone ? -1.05 : -0.75) * k); g.stroke();
      if (T - s.fireT < 0.08) { g.fillStyle = 'rgba(255,220,140,.95)'; g.beginPath(); g.arc(0.12 * k, (prone ? -1.15 : -0.85) * k, 0.18 * k, 0, 7); g.fill(); } }
    g.fillStyle = dead ? '#3a3830' : col[1]; g.beginPath(); g.arc(0, (prone ? -0.42 : 0) * k, 0.14 * k, 0, 7); g.fill();
    g.restore();
  }
}
function drawHouse(b: World['b'][0], T: number, pass: 'shadow' | 'body') {
  const S = SPR[HOUSE[b.t]], size = S.m;
  if (pass === 'shadow') { if (!b.dead) drawShadow(S, b.x, b.y, b.r - Math.PI / 2, size, 6, 0.42); return; }
  if (b.dead) { const dt = T - (houseDead.get(b.id) ?? -99); drawSpr(S, b.x, b.y, b.r - Math.PI / 2, size * 0.94, 'd', 0.9);
    g.fillStyle = 'rgba(120,108,90,.55)'; for (let i = 0; i < 7; i++) { const a = b.id * 2.3 + i * 0.9, r = b.w * (0.15 + (i % 3) * 0.12); g.fillRect(b.x + Math.cos(a) * r - 1.5, b.y + Math.sin(a) * r - 1, 3 + (i % 2) * 2, 2); }
    if (dt < 40 && Math.random() < 0.08 * (speed > 2 ? 0.4 : 1)) emit('gry', b.x, b.y, { life: 9, s0: 5, s1: 18, jit: b.w * .5, a: .55, vx: 1.2 });
    return; }
  drawSpr(S, b.x, b.y, b.r - Math.PI / 2, size);
  if (b.owner === 0) { const t = clamp((T - (capT.get(b.id) ?? T)) * 2, 0, 1); g.strokeStyle = '#2b2416'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x, b.y - 6 * t); g.stroke(); g.fillStyle = '#d2ab33'; g.fillRect(b.x, b.y - 6 * t, 4 * t, 2.6 * t); }
}
function drawAir(a: Air, pass: 'shadow' | 'body') {
  const S = SPR[a.model], size = S.m * EXA * (a.kind === 'drone' ? 1.4 : 1), ang = Math.atan2(a.vy, a.vx), z = a.alt * (a.kind === 'drone' ? 0.25 : 1);
  if (pass === 'shadow') { g.save(); g.translate(a.x + z * SHX, a.y + z * SHY); g.rotate(ang + Math.PI / 2); g.globalAlpha = 0.28; g.drawImage(S.shadow, -size / 2, -size / 2, size, size); g.restore(); return; }
  const sc = 1 + z / 1500; drawSpr(S, a.x, a.y - z * ZK, ang, size * sc, a.alive ? 'n' : 'd');
  if (a.kind === 'jet' && a.alive) emit('flash', a.x - Math.cos(ang) * size * 0.45, a.y - Math.sin(ang) * size * 0.45, { z: z, life: 0.05, s0: 3, s1: 3 });
  if (!a.alive && Math.random() < 0.5) emit('blk' as PK, a.x, a.y, { z, life: 3, s0: 3, s1: 9 });
}
function drawHeli(h: Unit, T: number, pass: 'shadow' | 'body') {
  if (h.kind !== 'heli' || h.alt <= 0 && h.alive) return;
  const S = SPR.ah64, size = S.m * EXA, z = h.alt;
  if (pass === 'shadow') { g.save(); g.translate(h.x + z * SHX, h.y + z * SHY); g.rotate(h.hd + Math.PI / 2); g.globalAlpha = 0.3; g.drawImage(S.shadow, -size / 2, -size / 2, size, size); g.restore();
    if (h.alive && z < 40) { g.globalAlpha = 0.15; g.fillStyle = '#000'; g.beginPath(); g.arc(h.x + z * SHX, h.y + z * SHY, 7.5 * EXA, 0, 7); g.fill(); g.globalAlpha = 1; } return; }
  const y = h.y - z * ZK; drawSpr(S, h.x, y, h.hd, size, h.alive ? 'n' : 'd');
  if (h.alive) { g.save(); g.translate(h.x, y); g.globalAlpha = 0.18; g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, 7.4 * EXA, 0, 7); g.fill(); g.globalAlpha = 0.55; g.strokeStyle = '#151515'; g.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) { const a = T * 31 + i * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 7.4 * EXA, Math.sin(a) * 7.4 * EXA); g.stroke(); } g.restore(); }
}
function drawProj(p: Proj, pass: 'shadow' | 'body') {
  const z = p.z, sx = p.x, sy = p.y - z * ZK, a = Math.atan2(p.ty - p.sy, p.tx - p.sx), ca = Math.cos(a), sa = Math.sin(a);
  if (pass === 'shadow') { if (z > 3 && (p.kind === 'shell' || p.kind === 'rocket' || p.kind === 'bomb')) { g.globalAlpha = 0.3; g.fillStyle = '#000'; g.beginPath(); g.arc(p.x + z * SHX, p.y + z * SHY, p.kind === 'bomb' ? 1.4 : 0.9, 0, 7); g.fill(); g.globalAlpha = 1; } return; }
  g.lineCap = 'round';
  if (p.kind === 'ap' || p.kind === 'can' || p.kind === 'mg') {
    const L = p.kind === 'ap' ? 22 : p.kind === 'can' ? 9 : 6, col = p.kind === 'ap' ? 'rgba(255,240,190,.95)' : p.side ? 'rgba(170,255,150,.9)' : 'rgba(255,190,110,.9)';
    g.strokeStyle = col; g.lineWidth = p.kind === 'ap' ? 0.9 : p.kind === 'can' ? 0.6 : 0.35; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - ca * L, sy - sa * L); g.stroke();
  } else if (p.kind === 'shell') { g.fillStyle = '#2a2622'; g.beginPath(); g.arc(sx, sy, 0.7 + z / 400, 0, 7); g.fill(); }
  else if (p.kind === 'bomb') { g.save(); g.translate(sx, sy); g.rotate(a + Math.PI / 2); g.fillStyle = '#3a3c34'; g.beginPath(); g.ellipse(0, 0, 0.7, 2.2, 0, 0, 7); g.fill(); g.restore(); }
  else {   // صواريخ: جسم + لهب + ذيل دخان
    g.fillStyle = p.kind === 'sam' ? '#eeeeea' : '#5a5c50'; g.beginPath(); g.arc(sx, sy, p.kind === 'sam' ? 1.1 : 0.7, 0, 7); g.fill();
    g.globalCompositeOperation = 'lighter'; g.drawImage(flare, sx - ca * 1.5 - 3, sy - sa * 1.5 - 3, 6, 6); g.globalCompositeOperation = 'source-over';
    if (Math.random() < (speed > 4 ? 0.35 : 0.8)) emit(p.kind === 'rocket' ? 'gry' : 'wht', p.x - ca * 2, p.y - sa * 2, { z, life: p.kind === 'sam' ? 5 : 2.5, s0: 1.5, s1: p.kind === 'sam' ? 9 : 5, a: 0.55 });
  }
}
const CLOUD = 128, FIRE = 64, EXC = 200;
function drawParts(dt: number, high: boolean) {
  for (const p of parts) {
    if ((p.z > 60) !== high) continue;
    const k = p.t / p.life, s = lerp(p.s0, p.s1, Math.sqrt(k)) * (p.k === 'ex' || p.k === 'ex2' || p.k === 'flash' || p.k === 'fire' || p.k === 'spark' ? 1 : 1.6), x = p.x, y = p.y - p.z * ZK;
    if (p.k === 'ex' || p.k === 'ex2') { const fr = Math.min(24, Math.floor(k * 25)), src = p.k === 'ex' ? TEX.fx_explo1 : TEX.fx_explo2; g.globalAlpha = 1; g.drawImage(src, (fr % 5) * EXC, Math.floor(fr / 5) * EXC, EXC, EXC, x - s / 2, y - s * 0.62, s, s); }
    else if (p.k === 'flash') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k; g.drawImage(flare, x - s / 2, y - s / 2, s, s); g.globalCompositeOperation = 'source-over'; }
    else if (p.k === 'fire') { const fr = Math.floor(k * 63); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - k) * 0.95; g.drawImage(TEX.fx_fire, (fr % 8) * FIRE, Math.floor(fr / 8) * FIRE, FIRE, FIRE, x - s / 2, y - s / 2, s, s); g.globalCompositeOperation = 'source-over'; }
    else if (p.k === 'spark') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k; g.strokeStyle = '#ffd890'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(x, y); g.lineTo(x - p.vx * 0.04, y - p.vy * 0.04); g.stroke(); g.globalCompositeOperation = 'source-over'; }
    else { const src = smokeTint[p.k === 'smk' ? 'blk' : p.k] ?? smokeTint.gry, fa = Math.min(1, k * 6) * (1 - k) ** 1.2 * p.a; g.globalAlpha = fa; g.save(); g.translate(x, y); g.rotate(p.rot + p.vr * p.t); g.drawImage(src, (p.cell % 8) * CLOUD, Math.floor(p.cell / 8) * CLOUD, CLOUD, CLOUD, -s / 2, -s / 2, s, s); g.restore(); }
  }
  g.globalAlpha = 1;
}
function stepParts(dt: number) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t += dt; if (p.t >= p.life) { parts.splice(i, 1); continue; } const damp = p.k === 'spark' ? 1 : Math.exp(-dt * 1.6); p.vx *= damp; p.vy *= damp; p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 'smk' || p.k === 'gry' || (p.k as string) === 'blk') p.x += 1.2 * dt; }
}
function burnFx(w: World, dt: number) {
  const rate = speed > 4 ? 0.4 : 1;
  for (const u of w.u) { if (u.alive || u.kind === 'inf' || u.mounted) continue; const t0 = wreckT.get(u.id); if (t0 === undefined) continue; const age = w.T - t0;
    if (age < 30) { if (Math.random() < dt * 14 * rate) emit('fire', u.x + (Math.random() - .5) * 3, u.y + (Math.random() - .5) * 3, { life: .6, s0: 2.5, s1: 5, vy: -2 }); if (Math.random() < dt * 4 * rate) emit('blk' as PK, u.x, u.y, { life: 9, s0: 2.5, s1: 11, a: .42, vx: 5, vy: -1.5 }); }
    else if (age < 120 && Math.random() < dt * 0.8 * rate) emit('gry', u.x, u.y, { life: 9, s0: 3, s1: 12, a: .35, vx: 1.2 }); }
  for (const u of w.u) if (u.alive && u.moving && (u.kind === 'tank' || u.kind === 'ifv')) { if (Math.random() < dt * 4) track(u.x, u.y, u.hd, 3.6 * EXV); if (Math.random() < dt * 3 * rate && terr !== 'plain') emit('dust', u.x - Math.cos(u.hd) * 6, u.y - Math.sin(u.hd) * 6, { life: 2.5, s0: 3, s1: 9, a: .45 }); }
}
function render(dt: number) {
  const w = W; g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = '#2a2620'; g.fillRect(0, 0, SW, SH);
  if (!w || !ground) return;
  const sx = (Math.random() - .5) * shake, sy = (Math.random() - .5) * shake; shake *= Math.exp(-dt * 8);
  const z = cam.z; g.setTransform(z * DPR, 0, 0, z * DPR, (SW / 2 - cam.x * z + sx) * DPR, (SH / 2 - cam.y * z + sy) * DPR);
  const vx0 = cam.x - SW / 2 / z, vy0 = cam.y - SH / 2 / z, vw = SW / z, vh = SH / z;
  g.imageSmoothingEnabled = true;
  g.drawImage(ground, GX0, GY0, GW, GH);
  if (sandPat) { sandPat.setTransform(new DOMMatrix().scale(6 / 512)); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.75; g.fillStyle = sandPat; g.fillRect(vx0, vy0, vw, vh); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  // الطريق
  if (roadPat) { roadPat.setTransform(new DOMMatrix().scale(8 / 512)); g.strokeStyle = roadPat; g.lineWidth = 8; g.lineJoin = 'round'; g.beginPath(); for (let y = FH + 450; y >= -450; y -= 20) { const x = roadX(y); if (y === FH + 450) g.moveTo(x, y); else g.lineTo(x, y); } g.globalAlpha = 0.85; g.stroke(); g.globalAlpha = 1; }
  g.drawImage(decal, GX0, GY0, GW, GH);
  const inView = (x: number, y: number, m = 60) => x > vx0 - m && x < vx0 + vw + m && y > vy0 - m && y < vy0 + vh + m;
  const T = w.T;
  // ظلال الأرض
  for (const b of w.b) if (inView(b.x, b.y)) drawHouse(b, T, 'shadow');
  for (const p of props) if (inView(p.x, p.y)) { const S = SPR[p.n]; drawShadow(S, p.x, p.y, p.r, S.m * p.s, p.n === 'car1' || p.n === 'pickup' ? 1.5 : 6, 0.32); }
  for (const u of w.u) if (inView(u.x, u.y)) drawUnit(u, T, 'shadow');
  for (const b of w.b) if (inView(b.x, b.y)) drawHouse(b, T, 'body');
  for (const p of props) if ((p.n === 'car1' || p.n === 'pickup') && inView(p.x, p.y)) drawSpr(SPR[p.n], p.x, p.y, p.r, SPR[p.n].m * p.s, 'd', 0.95);
  for (const u of w.u) if (inView(u.x, u.y)) drawUnit(u, T, 'body');
  for (const u of w.u) if (u.kind === 'inf' && inView(u.x, u.y, 40)) drawSoldiers(u, T);
  for (const p of props) if (p.n !== 'car1' && p.n !== 'pickup' && inView(p.x, p.y)) drawSpr(SPR[p.n], p.x, p.y, p.r, SPR[p.n].m * p.s);
  for (const p of w.pr) drawProj(p, 'shadow');
  for (const a of w.air) drawAir(a, 'shadow');
  for (const h of w.u) drawHeli(h, T, 'shadow');
  for (const p of w.pr) if (p.z < 60) drawProj(p, 'body');
  drawParts(dt, false);
  for (const h of w.u) drawHeli(h, T, 'body');
  for (const p of w.pr) if (p.z >= 60) drawProj(p, 'body');
  for (const a of w.air) drawAir(a, 'body');
  drawParts(dt, true);
}

// ===== الشريط =====
let endShown = false, lastPh = '';
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function hud() {
  const w = W!, ph = phaseName(w);
  if (ph !== lastPh) { lastPh = ph; const el = $('bphase'); el.style.opacity = '0'; setTimeout(() => { el.textContent = ph; el.style.opacity = '1'; }, 150); }
  const b = bars(w); ($('bla') as HTMLElement).style.width = clamp(b.a, 0, 100) + '%'; ($('bld') as HTMLElement).style.width = clamp(b.d, 0, 100) + '%';
  $('bwhere').innerHTML = `${w.res.rname} — ${TERR_N[w.res.terr]} · ${({ direct: 'هجوم مباشر', flank: 'التفاف', siege: 'حصار' })[w.tac]} <b>${mmss(Math.min(w.T, w.END))}</b>`;
  const now = performance.now(); for (const f of feed) f.el.style.opacity = String(clamp(1 - (now - f.t - 5000) / 1500, 0, 1));
  if (w.over && !endShown && w.T > w.END + 2) {
    endShown = true; const res = w.res, e = $('bend'); e.hidden = false; e.className = res.win ? 'win' : 'lose';
    e.innerHTML = `<div class="stamp">${stamp(res)}</div><h2>${res.rname}</h2><p>خسرت ${Math.round(res.la * 100)}٪ من القوة المشاركة، والعدو خسر ${Math.round(res.ld * 100)}٪ من مدافعيه. المدة ${res.wk} أسابيع.</p><button class="btn go" id="bBack">رجوع للقيادة</button><button class="btn" id="bAgain">شوفها مرة ثانية</button>`;
    $('bBack').onclick = () => showStart(); $('bAgain').onclick = () => startBattle();
  }
}
function setSpeed(s: number) { speed = s; $('spd').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+(b as HTMLElement).dataset.s! === s))); }
$('spd').querySelectorAll('button').forEach(b => b.addEventListener('click', () => setSpeed(+(b as HTMLElement).dataset.s!)));
$('bSkip').onclick = () => { if (W && !W.over) { skip(W); W.T = W.END + 2; parts.length = 0; } };
$('bCam').onclick = () => setAuto(!auto);
$('bMute').onclick = () => { $('bMute').textContent = sfx.toggle() ? '🔇' : '🔊'; };
const seg = (id: string, f: (v: string) => void) => $(id).querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); f((b as HTMLElement).dataset.v!); }));
const pick = (id: string, v: string) => $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.v === v)));
seg('sRes', v => { curRes = v; terr = SAMPLES[v].terr; tactic = SAMPLES[v].tactic ?? 'direct'; pick('sTerr', terr); pick('sTac', tactic); });
seg('sTerr', v => { terr = v as Terr; }); seg('sTac', v => { tactic = v as Tactic; });
$('bGo').onclick = () => startBattle();
$('credBtn').onclick = () => { $('credits').hidden = false; }; $('credX').onclick = () => { $('credits').hidden = true; };

// ===== الحلقة =====
let last = performance.now();
function frame() {
  const now = performance.now(), rdt = clamp((now - last) / 1000, 0, 0.05); last = now;
  if (running && W) {
    let left = rdt * speed;
    while (left > 1e-6) { const d = Math.min(0.05, left); left -= d; step(W, d); for (const f of W.fx) handle(f); W.fx.length = 0; burnFx(W, d); stepParts(d); }
    if (auto) director(W, rdt); else { cam.x = clamp(cam.x, -300, FW + 300); cam.y = clamp(cam.y, -300, FH + 300); }
    let dd = 1e9, hd = 1e9; for (const a of W.air) if (a.kind === 'drone' && a.alive) dd = Math.min(dd, camDist(a.x, a.y)); for (const h of W.u) if (h.kind === 'heli' && h.alive && h.alt > 0) hd = Math.min(hd, camDist(h.x, h.y));
    sfx.loops(dd, hd); hud();
  }
  render(rdt);
  requestAnimationFrame(frame);
}
(async () => {
  const L = $('load');
  try { await loadAll(t => { L.textContent = t; }); } catch (e) { L.textContent = 'خطأ بالتحميل: ' + (e as Error).message; return; }
  L.textContent = ''; const go = $('bGo') as HTMLButtonElement; go.disabled = false; go.textContent = 'ابدأ المعركة';
  requestAnimationFrame(frame);
  if (AUTO) { const r = qs.get('r'); if (r && SAMPLES[r]) { curRes = r; terr = SAMPLES[r].terr; tactic = SAMPLES[r].tactic ?? 'direct'; } if (qs.get('terr')) terr = qs.get('terr') as Terr; if (qs.get('tac')) tactic = qs.get('tac') as Tactic; startBattle(); (window as any).ready = true; }
})();
// للفحص الآلي
(window as any).seek = (t: number) => { if (!W) return; while (W.T < t && !(W.over && W.T > W.END + 3)) { step(W, 0.05); for (const f of W.fx) handle(f); W.fx.length = 0; burnFx(W, 0.05); stepParts(0.05); director(W, 0.05); } hud(); };
(window as any).pause = () => { speed = 0; };
(window as any).dbg = () => ({ cam, focus, arty: W!.u.filter(u => u.kind === "arty").map(u => [u.side, u.x | 0, u.y | 0, u.alive, +(W!.T - u.fireT).toFixed(1)]), booms: booms.slice(-5).map(b => [b.x | 0, b.y | 0, +b.t.toFixed(1), b.side]), sp: W!.u.filter(u => u.spotted).length });
