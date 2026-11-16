// الحرب على الخريطة العامة — المرحلة الأولى «شكل بس» (I-055، D-030)
// شهر حرب بين العراق وإيران على خريطة الدول نفسها (بيانات اللعبة): مطارات تقلع منها طيارات، دفاع جوي بمدى ظاهر يرمي ويسقط،
// معترضات تطلع، صواريخ باليستية وباتريوت يعترضها، مدفعية الحدود، رتل دروع يتقدم، وخط جبهة يتحرك حسب نتيجة الحساب.
import MAP from './mapdata.json';
import { ll, NAMES, CITIES, RIVERS, AIRBASES, ADS, MISSILE_BASES, BORDER, TARGET, STAGING, DEFENSE } from './geo';
import manifest from '../../battle-classic/sprites/manifest.json';

const $ = (id: string) => document.getElementById(id)!;
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const angd = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
type V = [number, number];
const sprUrls = import.meta.glob('../../battle-classic/sprites/{abrams,t72,su25,f16,patriot,s400,technical,ah64}.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const fxUrls = import.meta.glob('../../theater/textures/{fx_explo1,fx_explo2,fx_fire}.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const sndUrls = { ...import.meta.glob('../../battle-classic/sounds/{jet_roar,boom_huge,howitzer,sonic,blast}.mp3', { query: '?url', import: 'default', eager: true }), ...import.meta.glob('../../theater/sounds/{boom_big,boom_mid,boom_far,launch,tank,incoming,rocket}.mp3', { query: '?url', import: 'default', eager: true }) } as Record<string, string>;
void manifest;
const qs = new URLSearchParams(location.search), AUTO = qs.has('auto');
const cv = $('c') as HTMLCanvasElement, g = cv.getContext('2d')!;
let SW = 0, SH = 0, DPR = 1;
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); SW = cv.clientWidth; SH = cv.clientHeight; cv.width = SW * DPR; cv.height = SH * DPR; }
window.addEventListener('resize', resize); resize();
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const loadImg = (u: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });
const TEAM = ['#f2cf4a', '#ff5638'];
const SPR: Record<string, HTMLCanvasElement[]> = {}, TEX: Record<string, HTMLImageElement> = {};
let glow: HTMLCanvasElement, puffC: HTMLCanvasElement;
async function loadAll() {
  for (const [k, u] of Object.entries(sprUrls)) { const img = await loadImg(u), n = 128, base = mk(n, n), bx = base.getContext('2d')!; bx.drawImage(img, 0, 0, n, n);
    SPR[k.split('/').pop()!.replace('.png', '')] = TEAM.map(col => { const s = mk(n, n), sx = s.getContext('2d')!; sx.drawImage(base, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = col; sx.fillRect(0, 0, n, n); const c = mk(n, n), x = c.getContext('2d')!; for (let a = 0; a < 8; a++) x.drawImage(s, Math.cos(a * .785) * 4, Math.sin(a * .785) * 4); x.drawImage(base, 0, 0); return c; }); }
  for (const [k, u] of Object.entries(fxUrls)) TEX[k.split('/').pop()!.replace('.webp', '')] = await loadImg(u);
  glow = mk(64, 64); { const x = glow.getContext('2d')!, gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(.2, 'rgba(255,215,140,.85)'); gr.addColorStop(.5, 'rgba(255,140,50,.3)'); gr.addColorStop(1, 'rgba(255,100,20,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  puffC = mk(64, 64); { const x = puffC.getContext('2d')!, gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(150,144,134,.6)'); gr.addColorStop(.6, 'rgba(120,115,106,.3)'); gr.addColorStop(1, 'rgba(110,105,96,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
}

// ===== الخريطة: الدول من بيانات اللعبة + ملمس + أنهار + مدن =====
const MAPD = MAP as Record<string, number[][]>;
const VIEW = { lon0: 41.4, lon1: 53.2, lat0: 27.8, lat1: 37.6 };
let mapC: HTMLCanvasElement, MX0 = 0, MY0 = 0, MSC = 1;
function buildMap() {
  // نرسم الخريطة مرة وحدة بدقة عالية لمنطقة أكبر من المسرح
  const [x0, y1] = ll(37, 24), [x1, y0] = ll(59, 40.5); MX0 = x0; MY0 = y0; MSC = 36;
  mapC = mk(Math.ceil((x1 - x0) * MSC), Math.ceil((y1 - y0) * MSC)); const m = mapC.getContext('2d')!;
  m.fillStyle = '#132029'; m.fillRect(0, 0, mapC.width, mapC.height);
  // تموج البحر
  for (let i = 0; i < 900; i++) { m.fillStyle = `rgba(120,170,190,${Math.random() * .05})`; m.fillRect(Math.random() * mapC.width, Math.random() * mapC.height, 30 + Math.random() * 60, 1); }
  const path = (iso: string) => { m.beginPath(); for (const r of MAPD[iso]) { m.moveTo((r[0] - x0) * MSC, (r[1] - y0) * MSC); for (let i = 2; i < r.length; i += 2) m.lineTo((r[i] - x0) * MSC, (r[i + 1] - y0) * MSC); m.closePath(); } };
  for (const iso in MAPD) {
    const col = iso === '368' ? '#5b5130' : iso === '364' ? '#5a3329' : '#3a3d33';
    path(iso); m.fillStyle = col; m.fill();
  }
  // ملمس الأرض (تضاريس خفيفة) داخل اليابسة بس
  const tex = mk(mapC.width, mapC.height), t = tex.getContext('2d')!;
  for (let i = 0; i < 26000; i++) { const x = Math.random() * tex.width, y = Math.random() * tex.height, r = Math.random() * 3 + .5, c = Math.random() < .5 ? 255 : 0; t.fillStyle = `rgba(${c},${c},${c},${Math.random() * .06})`; t.beginPath(); t.arc(x, y, r, 0, 7); t.fill(); }
  // جبال زاغروس (شرق الحدود) أغمق وبظل
  const [zx0, zy0] = ll(45.5, 37.5), [zx1, zy1] = ll(52, 30.5);
  for (let i = 0; i < 1600; i++) { const k = Math.random(), x = lerp(zx0, zx1, k) + (Math.random() - .5) * 3.5, y = lerp(zy0, zy1, k) + (Math.random() - .5) * 3.5; t.fillStyle = `rgba(20,14,10,${.05 + Math.random() * .08})`; t.beginPath(); t.ellipse((x - x0) * MSC, (y - y0) * MSC, 6 + Math.random() * 16, 3 + Math.random() * 6, -.6, 0, 7); t.fill(); }
  m.save(); for (const iso in MAPD) { path(iso); } m.clip(); m.drawImage(tex, 0, 0); m.restore();
  // حدود
  m.lineJoin = 'round'; m.strokeStyle = 'rgba(12,16,18,.9)'; m.lineWidth = 2.2; for (const iso in MAPD) { path(iso); m.stroke(); }
  m.strokeStyle = 'rgba(230,220,190,.18)'; m.lineWidth = .8; for (const iso in MAPD) { path(iso); m.stroke(); }
  // أنهار
  m.strokeStyle = 'rgba(90,150,180,.75)'; m.lineWidth = 2.4; m.lineCap = 'round';
  for (const r of RIVERS) { m.beginPath(); r.forEach(([x, y], i) => i ? m.lineTo((x - x0) * MSC, (y - y0) * MSC) : m.moveTo((x - x0) * MSC, (y - y0) * MSC)); m.stroke(); }
}

// ===== المشهد =====
interface Res { win: boolean; la: number; ld: number; wk: number; rname: string; ca: { tank: number; air: number; ad: number }; cd: { tank: number; air: number; ad: number } }
const SAMPLES: Record<string, Res> = {
  win: { win: true, la: .07, ld: .22, wk: 3, rname: 'خوزستان', ca: { tank: 420, air: 60, ad: 30 }, cd: { tank: 300, air: 40, ad: 24 } },
  lose: { win: false, la: .16, ld: .05, wk: 4, rname: 'خوزستان', ca: { tank: 200, air: 20, ad: 10 }, cd: { tank: 600, air: 70, ad: 40 } },
};
const END = 58, CARD = 50;
interface Jet { id: number; side: 0 | 1; x: number; y: number; hd: number; spd: number; alt: number; state: 'roll' | 'in' | 'out' | 'down' | 'cap' | 'evade'; t0: number; tx: number; ty: number; base: V; rw: number; dead: boolean; spin: number; tgtJet: number; flareT: number; evT: number; evDir: number; trail: V[]; bank: number; fired: boolean }
interface Msl { kind: 'sam' | 'aam' | 'bm' | 'pac' | 'shell'; side: 0 | 1; x: number; y: number; z: number; sx: number; sy: number; tx: number; ty: number; t: number; dur: number; tgt: number; hit: boolean; trail: V[]; done: boolean; arc: number }
interface Tank { side: 0 | 1; x: number; y: number; hd: number; dead: boolean; dieT: number; path: V[]; pi: number; fireT: number }
interface Fx { x: number; y: number; t: number; max: number; size: number; type: 'ex' | 'flash' | 'smoke' | 'fire' | 'flare'; vx: number; vy: number }
let T = 0, res = SAMPLES.win, jets: Jet[] = [], msls: Msl[] = [], tanks: Tank[] = [], fx: Fx[] = [], nid = 1, speed = 1, running = false, endShown = false;
const stats = { lostA: 0, lostD: 0, bmShot: 0, bmHit: 0, tanksA: 0, tanksD: 0 };
const adAmmo = ADS.map(() => 6), adCD = ADS.map(() => 0), adFire = ADS.map(() => -9);
let pkA = .5, pkD = .5, capA = 0, capD = 0, sched: { t: number; f: () => void }[] = [], front = 0, msgs: { t: string; base: string; n: number; side: number; at: number }[] = [];
const R = (a: number, b: number) => a + Math.random() * (b - a);
const say = (t: string, side: number) => { const l = msgs[msgs.length - 1], now = performance.now(); if (l && l.base === t) { l.n++; l.t = t + ' ×' + l.n; l.at = now; return; } msgs.push({ t, base: t, n: 1, side, at: now }); if (msgs.length > 3) msgs.shift(); };
function start(key: string) {
  res = SAMPLES[key]; T = 0; jets = []; msls = []; tanks = []; fx = []; sched = []; msgs = []; endShown = false; front = 0; Object.assign(stats, { lostA: 0, lostD: 0, bmShot: 0, bmHit: 0, tanksA: 0, tanksD: 0 });
  adAmmo.fill(6); adCD.fill(0); adFire.fill(-9);
  const lg = (n: number, k: number, lo: number, hi: number) => clamp(Math.round(Math.log2(n + 1) * k), lo, hi);
  // نسبة الإصابة من نتيجة الحساب: اللي خسر أكثر، دفاع خصمه يصيب أكثر (الشكل يطابق الحساب)
  pkD = clamp(.15 + res.la * 2, .15, .55); pkA = clamp(.25 + res.ld * 2, .25, .75);
  // طلعات عراقية: أول موجة على الدفاع الجوي (إخماد)، بعدها المطارات والدفاعات
  const nA = lg(res.ca.air, 1.6, 4, 12), nD = lg(res.cd.air, 1.1, 2, 8);
  // سقف الطيارات اللي تسقط من نفس نسب الحساب (مثل معركة الأصل): ما يصير الشكل أسوأ أو أحسن من النتيجة
  const fa0 = clamp(res.la * 4.5, .05, .8), fd0 = res.win ? clamp(.45 + res.ld * 1.5, .5, .95) : clamp(res.ld * 2.5, .08, .4);
  capA = Math.max(1, Math.round(nA * fa0 * .5)); capD = Math.max(1, Math.round(nD * fd0 * .7));
  const tgts: V[] = [ADS[3].p, ADS[4].p, AIRBASES[5].p, AIRBASES[4].p, ...DEFENSE];
  for (let i = 0; i < nA; i++) { const b = AIRBASES[i % 4]; sched.push({ t: 3 + i * 1.6, f: () => takeoff(0, b, tgts[i % tgts.length]) }); }
  for (let i = 0; i < nD; i++) { const b = AIRBASES[4 + (i % 2 ? 2 : 0)]; sched.push({ t: 6 + i * 2.6, f: () => takeoff(1, b, null) }); }
  // صواريخ باليستية إيرانية على قواعدنا
  const nBM = lg(res.cd.air, .8, 2, 6);
  for (let i = 0; i < nBM; i++) sched.push({ t: 8 + i * 2.8, f: () => { const mb = MISSILE_BASES[i % 2], tg = [AIRBASES[0].p, CITIES[0].p, AIRBASES[2].p][i % 3]; launchBM(mb.p, tg); } });
  // الدروع
  const nTA = lg(res.ca.tank, 1.1, 5, 10), nTD = lg(res.cd.tank, 1, 4, 9);
  for (let i = 0; i < nTA; i++) { const s = STAGING[i % 3]; const sx = s[0] + R(-.55, .45), sy = s[1] + R(-.5, .5); const dst = res.win ? [TARGET.p[0] + R(-.5, .4), TARGET.p[1] + R(-.5, .5)] as V : [lerp(sx, TARGET.p[0], .42) + R(-.2, .2), lerp(sy, TARGET.p[1], .42) + R(-.2, .2)] as V;
    tanks.push({ side: 0, x: sx, y: sy, hd: 0, dead: false, dieT: 0, path: [[lerp(sx, dst[0], .35), lerp(sy, dst[1], .35)], dst], pi: 0, fireT: 0 }); }
  for (let i = 0; i < nTD; i++) { const d = DEFENSE[i % DEFENSE.length]; tanks.push({ side: 1, x: d[0] + R(-.4, .4), y: d[1] + R(-.4, .4), hd: Math.PI, dead: false, dieT: 0, path: [], pi: 0, fireT: 0 }); }
  // خسائر الدروع حسب الحساب (نفس معادلات الأصل)
  const fa = clamp(res.la * 4.5, .05, .8), fd = res.win ? clamp(.45 + res.ld * 1.5, .5, .95) : clamp(res.ld * 2.5, .08, .4);
  const kA = Math.round(nTA * fa), kD = Math.round(nTD * fd);
  tanks.filter(t => t.side === 0).sort(() => Math.random() - .5).slice(0, kA).forEach(t => t.dieT = R(26, 44));
  tanks.filter(t => t.side === 1).sort(() => Math.random() - .5).slice(0, kD).forEach(t => t.dieT = R(22, 45));
  say('بدأت العملية: هجوم على ' + res.rname, 2);
  running = true; $('hud').hidden = false; $('ctl').hidden = false; $('legend').hidden = false; $('start').hidden = true; $('bend').hidden = true; audio();
}
function takeoff(side: 0 | 1, b: { p: V; rw: number }, tg: V | null) {
  const j: Jet = { id: nid++, side, x: b.p[0], y: b.p[1], hd: b.rw, spd: 0, alt: 0, state: 'roll', t0: T, tx: tg ? tg[0] : 0, ty: tg ? tg[1] : 0, base: b.p, rw: b.rw, dead: false, spin: 0, tgtJet: 0, flareT: -9, evT: -9, evDir: 1, trail: [], bank: 0, fired: false };
  if (!tg) j.state = 'roll'; jets.push(j); play('jet_roar', b.p[0], b.p[1], .35, 1.2);
}
function launchBM(from: V, to: V) { const d = Math.hypot(to[0] - from[0], to[1] - from[1]); msls.push({ kind: 'bm', side: 1, x: from[0], y: from[1], z: 0, sx: from[0], sy: from[1], tx: to[0] + R(-.15, .15), ty: to[1] + R(-.15, .15), t: 0, dur: d / 2.6, tgt: 0, hit: false, trail: [], done: false, arc: d * .55 }); boom(from[0], from[1], .4, 'launch'); say('إيران أطلقت صاروخ باليستي', 1); }
function fireMsl(kind: Msl['kind'], side: 0 | 1, from: V, tgt: Jet | null, to: V | null, hit: boolean, spd = 9) {
  const tx = tgt ? tgt.x : to![0], ty = tgt ? tgt.y : to![1], d = Math.hypot(tx - from[0], ty - from[1]);
  msls.push({ kind, side, x: from[0], y: from[1], z: kind === 'aam' ? 1 : 0, sx: from[0], sy: from[1], tx, ty, t: 0, dur: Math.max(.3, d / spd), tgt: tgt ? tgt.id : 0, hit, trail: [], done: false, arc: 0 });
}
function boom(x: number, y: number, s: number, snd = '') {
  fx.push({ x, y, t: 0, max: 1.2, size: 26 * s + 10, type: 'ex', vx: 0, vy: 0 }, { x, y, t: 0, max: .25, size: 60 * s + 20, type: 'flash', vx: 0, vy: 0 });
  for (let i = 0; i < 3 + s * 3; i++) fx.push({ x: x + R(-.05, .05), y: y + R(-.05, .05), t: 0, max: R(4, 8), size: R(8, 16) * (s + .5), type: 'smoke', vx: R(.01, .04), vy: R(-.03, -.005) });
  play(snd || (s > 1.5 ? 'boom_huge' : s > .8 ? 'boom_big' : 'boom_mid'), x, y, .3 + s * .25);
}
function step(dt: number) {
  T += dt;
  const due = sched.filter(e => e.t <= T); sched = sched.filter(e => e.t > T); due.forEach(e => e.f());
  // ---------- الطيارات ----------
  for (const j of jets) {
    if (j.dead) continue;
    if (j.state === 'down') { j.spin += dt * 5; j.alt = Math.max(0, j.alt - dt * .5); j.x += Math.cos(j.hd) * j.spd * .4 * dt; j.y += Math.sin(j.hd) * j.spd * .4 * dt; if (Math.random() < dt * 25) fx.push({ x: j.x, y: j.y, t: 0, max: 3, size: 8, type: 'smoke', vx: 0, vy: 0 }); if (j.alt <= 0) { j.dead = true; boom(j.x, j.y, 1.2); } continue; }
    let want = j.hd, turn = .9;
    if (j.state === 'roll') { j.spd = Math.min(2.2, j.spd + dt * 2.2); if (T - j.t0 > 1.1) j.state = j.side === 0 ? 'in' : 'cap'; }
    else if (j.state === 'evade') { want = j.hd + j.evDir * 1.4; turn = 2; if (T > j.evT) j.state = j.side === 0 ? (j.fired ? 'out' : 'in') : 'cap'; }
    else if (j.state === 'in') { want = Math.atan2(j.ty - j.y, j.tx - j.x); if (Math.hypot(j.tx - j.x, j.ty - j.y) < .35) { j.state = 'out'; j.fired = true; for (let i = 0; i < 2; i++) sched.push({ t: T + .6 + i * .25, f: () => boom(j.tx + R(-.12, .12), j.ty + R(-.12, .12), 1) }); } }
    else if (j.state === 'out') want = Math.atan2(j.base[1] - j.y, j.base[0] - j.x) + (Math.hypot(j.base[0] - j.x, j.base[1] - j.y) < .5 ? 0 : 0);
    else if (j.state === 'cap') { // معترض: يلاحق أقرب طيارة معادية ويرمي صاروخ جو-جو
      const e = jets.filter(q => !q.dead && q.side !== j.side && q.state !== 'down' && q.state !== 'roll').sort((a, b) => Math.hypot(a.x - j.x, a.y - j.y) - Math.hypot(b.x - j.x, b.y - j.y))[0];
      if (e) { want = Math.atan2(e.y - j.y, e.x - j.x); if (Math.hypot(e.x - j.x, e.y - j.y) < 2.6 && T - j.t0 > 3 && !msls.some(m => m.kind === 'aam' && m.side === j.side && !m.done && m.sx === j.x)) { if (Math.random() < dt * .8) { const hit = Math.random() < (j.side ? pkD * .8 : pkA * .7); fireMsl('aam', j.side, [j.x, j.y], e, null, hit, 7); evade(e); } } }
      else want = Math.atan2(j.base[1] - j.y, j.base[0] - j.x);
      if (T - j.t0 > 26) j.state = 'out';
    }
    if (j.state !== 'roll') { const d = angd(want, j.hd), dh = clamp(d, -turn * dt, turn * dt); j.hd += dh; j.bank = lerp(j.bank, clamp(dh / dt / 2, -1, 1), Math.min(1, dt * 4)); j.spd = j.state === 'evade' ? 2.9 : 2.4; j.alt = Math.min(1, j.alt + dt * .5); }
    j.x += Math.cos(j.hd) * j.spd * dt; j.y += Math.sin(j.hd) * j.spd * dt;
    if (j.alt > .3) { j.trail.push([j.x, j.y]); if (j.trail.length > 40) j.trail.shift(); }
    if (j.state === 'out' && Math.hypot(j.base[0] - j.x, j.base[1] - j.y) < .4) j.dead = true;   // هبطت سالمة
    if (T > j.flareT && T - j.flareT < 1.2 && Math.random() < dt * 30) fx.push({ x: j.x, y: j.y, t: 0, max: 1.8, size: 5, type: 'flare', vx: -Math.cos(j.hd) * .5 + R(-.4, .4), vy: -Math.sin(j.hd) * .5 + R(-.4, .4) });
  }
  // ---------- الدفاع الجوي ----------
  ADS.forEach((ad, i) => {
    adCD[i] -= dt; if (adCD[i] > 0 || adAmmo[i] <= 0) return;
    const e = jets.filter(j => !j.dead && j.side !== ad.side && j.state !== 'down' && j.alt > .4 && Math.hypot(j.x - ad.p[0], j.y - ad.p[1]) < ad.r && !msls.some(m => m.tgt === j.id && !m.done && m.kind === 'sam'))[0];
    if (e) { const hit = Math.random() < (ad.side ? pkD : pkA); fireMsl('sam', ad.side, ad.p, e, null, hit, 8); adAmmo[i]--; adCD[i] = R(1.6, 3); adFire[i] = T; evade(e); play('launch', ad.p[0], ad.p[1], .45); return; }
    const bm = msls.find(m => m.kind === 'bm' && !m.done && m.side !== ad.side && Math.hypot(m.x - ad.p[0], m.y - ad.p[1]) < ad.r * .8 && m.t > m.dur * .45 && !msls.some(q => q.kind === 'pac' && q.tgt === -m.sx && !q.done));
    if (bm && ad.side === 0) { const hit = Math.random() < pkA + .1; msls.push({ kind: 'pac', side: 0, x: ad.p[0], y: ad.p[1], z: 0, sx: ad.p[0], sy: ad.p[1], tx: bm.x, ty: bm.y, t: 0, dur: .9, tgt: -bm.sx, hit, trail: [], done: false, arc: 0 }); (bm as any).pac = hit ? 1 : 2; adAmmo[i]--; adCD[i] = 1.2; adFire[i] = T; play('launch', ad.p[0], ad.p[1], .5); say(hit ? 'الباتريوت اعترض صاروخ باليستي' : 'الباتريوت رمى على صاروخ باليستي', 0); }
  });
  // ---------- الصواريخ ----------
  for (const m of msls) {
    if (m.done) continue; m.t += dt;
    const tj = m.tgt > 0 ? jets.find(j => j.id === m.tgt) : null;
    if (tj && !tj.dead && (m.hit || m.t < m.dur * .6)) { m.tx = tj.x; m.ty = tj.y; }
    let k = clamp(m.t / m.dur, 0, 1);
    if (m.kind === 'bm') { m.x = lerp(m.sx, m.tx, k); m.y = lerp(m.sy, m.ty, k); m.z = Math.sin(Math.PI * k) * m.arc; }
    else { const e = m.kind === 'sam' || m.kind === 'pac' ? Math.pow(k, 1.3) : k; m.x = lerp(m.sx, m.tx, e); m.y = lerp(m.sy, m.ty, e); m.z = m.kind === 'pac' ? lerp(0, (msls.find(b => b.kind === 'bm' && -b.sx === m.tgt)?.z ?? 1), e) : 0; }
    m.trail.push([m.x, m.y - m.z * .5]); if (m.trail.length > (m.kind === 'bm' ? 90 : 50)) m.trail.shift();
    if (m.kind === 'pac') { const bm = msls.find(b => b.kind === 'bm' && -b.sx === m.tgt && !b.done); if (bm) { m.tx = bm.x; m.ty = bm.y; } }
    if (k >= 1) {
      m.done = true;
      if (m.kind === 'bm') { if ((m as any).pac === 1) continue; boom(m.tx, m.ty, 1.8); stats.bmHit++; say('صاروخ باليستي ضرب ' + (Math.hypot(m.tx - AIRBASES[0].p[0], m.ty - AIRBASES[0].p[1]) < .5 ? 'قاعدة بلد' : 'هدف عندنا'), 0); continue; }
      if (m.kind === 'pac') { const bm = msls.find(b => b.kind === 'bm' && -b.sx === m.tgt && !b.done); boom(m.x, m.y - m.z * .5, .6, 'blast'); if (m.hit && bm) { bm.done = true; stats.bmShot++; } continue; }
      boom(m.x, m.y, .45, 'blast');
      if (tj && !tj.dead && tj.state !== 'down' && m.hit && (tj.side === 0 ? stats.lostA < capA : stats.lostD < capD)) { tj.state = 'down'; if (tj.side === 0) stats.lostA++; else stats.lostD++; say(tj.side ? 'أسقطنا طائرة للعدو' : 'خسرنا طائرة — دفاع العدو أسقطها', tj.side); }
      else if (tj && Math.random() < .4) say(tj.side ? 'طائرة للعدو راوغت الصاروخ' : 'طائرتنا راوغت الصاروخ ونجت', tj.side);
    }
  }
  msls = msls.filter(m => !m.done || m.trail.length > 0); for (const m of msls) if (m.done) m.trail.splice(0, 3);
  // ---------- الدروع ----------
  const adv = smooth(20, 44, T);
  for (const t of tanks) {
    if (t.dead) continue;
    if (t.dieT && T > t.dieT) { t.dead = true; boom(t.x, t.y, .7); if (t.side === 0) stats.tanksA++; else stats.tanksD++; continue; }
    if (t.side === 0 && T > 20 && t.pi < t.path.length) { const [px, py] = t.path[t.pi], dx = px - t.x, dy = py - t.y, d = Math.hypot(dx, dy); if (d < .05) t.pi++; else { const a = Math.atan2(dy, dx); t.hd += clamp(angd(a, t.hd), -dt, dt); const v = .11 * dt; t.x += Math.cos(t.hd) * v; t.y += Math.sin(t.hd) * v; if (Math.random() < dt * 3) fx.push({ x: t.x - Math.cos(t.hd) * .08, y: t.y - Math.sin(t.hd) * .08, t: 0, max: 2, size: 5, type: 'smoke', vx: 0, vy: 0 }); } }
    if (!res.win && t.side === 0 && T > 40) { const s = STAGING[0]; const a = Math.atan2(s[1] - t.y, s[0] - t.x); t.hd += clamp(angd(a, t.hd), -dt, dt); t.x += Math.cos(t.hd) * .08 * dt; t.y += Math.sin(t.hd) * .08 * dt; }
    if (res.win && t.side === 1 && T > 40) { const a = Math.atan2(-1, 1.2); t.hd += clamp(angd(a, t.hd), -dt, dt); t.x += Math.cos(t.hd) * .07 * dt; t.y += Math.sin(t.hd) * .07 * dt; }
    // رمي مباشر بين الدروع إذا قريبين
    const e = tanks.filter(q => !q.dead && q.side !== t.side).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
    if (e && Math.hypot(e.x - t.x, e.y - t.y) < 1.1 && T - t.fireT > R(2.5, 5)) { t.fireT = T; fireMsl('shell', t.side, [t.x, t.y], null, [e.x + R(-.05, .05), e.y + R(-.05, .05)], false, 6); fx.push({ x: t.x, y: t.y, t: 0, max: .15, size: 18, type: 'flash', vx: 0, vy: 0 }); if (Math.random() < .3) play('tank', t.x, t.y, .25); }
  }
  // مدفعية الحدود: قوس قذائف بين الطرفين
  if (T > 10 && T < 46 && Math.random() < dt * 1.6) { const side = Math.random() < (res.win ? .62 : .42) ? 0 : 1, from = side ? [lerp(DEFENSE[0][0], AIRBASES[4].p[0], .5) + R(-.4, .4), DEFENSE[0][1] + R(-.6, .6)] as V : [STAGING[0][0] - .6 + R(-.3, .3), STAGING[0][1] + R(-.5, .5)] as V;
    const tg = tanks.filter(q => !q.dead && q.side !== side); const to: V = tg.length ? [tg[0].x + R(-.4, .4), tg[0].y + R(-.4, .4)] : [TARGET.p[0], TARGET.p[1]];
    const d = Math.hypot(to[0] - from[0], to[1] - from[1]); msls.push({ kind: 'shell', side, x: from[0], y: from[1], z: 0, sx: from[0], sy: from[1], tx: to[0], ty: to[1], t: 0, dur: d / 3, tgt: 0, hit: false, trail: [], done: false, arc: d * .35 });
    fx.push({ x: from[0], y: from[1], t: 0, max: .15, size: 22, type: 'flash', vx: 0, vy: 0 }); if (Math.random() < .3) play('howitzer', from[0], from[1], .25); sched.push({ t: T + d / 3, f: () => boom(to[0], to[1], .55) }); }
  front = res.win ? adv : adv * .4 - smooth(40, 48, T) * adv * .3;
  for (const f of fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.type === 'smoke') f.size += dt * 6; }
  fx = fx.filter(f => f.t < f.max); if (fx.length > 600) fx.splice(0, fx.length - 600);
}
function evade(j: Jet) { if (j.state === 'down' || j.state === 'roll') return; j.state = 'evade'; j.evT = T + R(.8, 1.6); j.evDir = Math.random() < .5 ? 1 : -1; j.flareT = T + R(.2, .6); }

// ===== الصوت =====
let ac: AudioContext | null = null, master: GainNode; const smp: Record<string, AudioBuffer> = {}; let act = 0, muted = false;
function audio() { if (muted) return; try { if (!ac) { ac = new AudioContext(); master = ac.createGain(); master.gain.value = .85; const comp = ac.createDynamicsCompressor(); master.connect(comp).connect(ac.destination); const a = ac; for (const [k, u] of Object.entries(sndUrls)) fetch(u).then(r => r.arrayBuffer()).then(b => a.decodeAudioData(b)).then(buf => { smp[k.split('/').pop()!.replace('.mp3', '')] = buf; }).catch(() => {}); } if (ac.state === 'suspended') ac.resume(); } catch { /* */ } }
function play(n: string, x: number, y: number, v: number, rate = 1) { if (!ac || !smp[n] || act > 14 || speed > 2 && v < .4) return; const s = ac.createBufferSource(); s.buffer = smp[n]; s.playbackRate.value = rate * R(.93, 1.07); const gn = ac.createGain(); gn.gain.value = v; const pan = ac.createStereoPanner(); pan.pan.value = clamp((x - cam.x) / 6, -.8, .8); s.connect(gn).connect(pan).connect(master); s.start(); act++; s.onended = () => act--; void y; }

// ===== الرسم =====
const cam = { x: 0, y: 0, k: 1 }; let overview = false, kBase = 1;
// كاميرا مخرج: الصورة الكاملة، بعدين الحرب الجوية، بعدين أرض خوزستان (لقطات ثابتة بانتقال ناعم حتى التقديم يضبط)
const BOX = { all: [VIEW.lon0, VIEW.lon1, VIEW.lat0, VIEW.lat1], air: [43.6, 50.4, 29.6, 35.4], gnd: [46.7, 49.5, 30.1, 32.4], end: [45.6, 50.2, 29.6, 33.2] };
const KEYS: [number, number[]][] = [[0, BOX.all], [2.5, BOX.all], [5.5, BOX.air], [19, BOX.air], [23, BOX.gnd], [45, BOX.gnd], [49, BOX.end]];
function fit(b: number[]): V & { k?: number } { const [a0, y1] = ll(b[0], b[2]), [a1, y0] = ll(b[1], b[3]); const r: any = [(a0 + a1) / 2, (y0 + y1) / 2]; r.k = Math.min(SW / (a1 - a0), (SH - 150) / (y1 - y0)); return r; }
function camFor(t: number) {
  kBase = fit(BOX.all).k!;
  if (overview) { const f = fit(BOX.all); cam.x = f[0]; cam.y = f[1]; cam.k = f.k!; return; }
  let i = 0; while (i < KEYS.length - 1 && KEYS[i + 1][0] <= t) i++;
  const A = fit(KEYS[i][1]), B = i < KEYS.length - 1 ? fit(KEYS[i + 1][1]) : A, e = i < KEYS.length - 1 ? smooth(KEYS[i][0], KEYS[i + 1][0], t) : 0;
  cam.k = Math.exp(lerp(Math.log(A.k!), Math.log(B.k!), e)); cam.x = lerp(A[0], B[0], e); cam.y = lerp(A[1], B[1], e) - 40 / cam.k;
}
const W2S = (x: number, y: number): V => [(x - cam.x) * cam.k + SW / 2, (y - cam.y) * cam.k + SH / 2];
function sprite(n: string, side: number, x: number, y: number, a: number, px: number, squash = 1) { const im = SPR[n]?.[side]; if (!im) return; const [sx, sy] = W2S(x, y); g.save(); g.translate(sx, sy); g.rotate(a + Math.PI / 2); px *= clamp(Math.sqrt(cam.k / kBase), 1, 1.7); g.drawImage(im, -px * squash / 2, -px / 2, px * squash, px); g.restore(); }
function draw() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = '#0f1a20'; g.fillRect(0, 0, SW, SH);
  const [mx, my] = W2S(MX0, MY0); g.drawImage(mapC, mx, my, mapC.width / MSC * cam.k, mapC.height / MSC * cam.k);
  const k = cam.k;
  // أسماء الدول
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [iso, n] of Object.entries({ '368': ll(43.2, 34.6), '364': ll(51.5, 33.6), '414': ll(47.6, 29.2), '682': ll(45.8, 28.3), '792': ll(41.5, 37.3), '760': ll(40.5, 35.0) })) { const [x, y] = W2S(n[0], n[1]); g.font = `700 ${clamp(k * .9, 12, 26)}px "Reem Kufi",sans-serif`; g.fillStyle = iso === '368' ? 'rgba(242,207,74,.55)' : iso === '364' ? 'rgba(255,110,80,.5)' : 'rgba(230,225,210,.25)'; g.fillText(NAMES[iso], x, y); }
  // المنطقة المسيطر عليها: سهم وتظليل بين الحدود والجبهة
  drawFront();
  // مدن
  for (const c of CITIES) { const [x, y] = W2S(c.p[0], c.p[1]); g.fillStyle = c.cap ? '#fff6d6' : 'rgba(240,235,220,.85)'; g.beginPath(); g.arc(x, y, c.cap ? 3.5 : 2.2, 0, 7); g.fill(); g.font = `${c.cap ? 600 : 400} ${c.cap ? 12 : 10.5}px "IBM Plex Sans Arabic",sans-serif`; g.fillStyle = 'rgba(245,240,225,.9)'; g.shadowColor = '#000'; g.shadowBlur = 3; g.fillText(c.n, x, y - 9); g.shadowBlur = 0; }
  // دفاع جوي: مدى + منظومة
  ADS.forEach((ad, i) => { const [x, y] = W2S(ad.p[0], ad.p[1]), hot = T - adFire[i] < 1.5, col = ad.side ? '255,86,56' : '242,207,74';
    g.strokeStyle = `rgba(${col},${hot ? .55 : .2})`; g.setLineDash([5, 5]); g.lineWidth = hot ? 1.6 : 1; g.beginPath(); g.arc(x, y, ad.r * k, 0, 7); g.stroke(); g.setLineDash([]);
    if (hot) { g.fillStyle = `rgba(${col},.05)`; g.beginPath(); g.arc(x, y, ad.r * k, 0, 7); g.fill(); }
    sprite(ad.side ? 's400' : 'patriot', ad.side, ad.p[0], ad.p[1], -Math.PI / 2, 22); });
  // مطارات: مدرج
  for (const b of AIRBASES) { const [x, y] = W2S(b.p[0], b.p[1]); g.save(); g.translate(x, y); g.rotate(b.rw); g.fillStyle = 'rgba(40,40,42,.95)'; g.fillRect(-14, -2.5, 28, 5); g.strokeStyle = 'rgba(255,255,255,.6)'; g.setLineDash([3, 3]); g.lineWidth = .7; g.beginPath(); g.moveTo(-12, 0); g.lineTo(12, 0); g.stroke(); g.setLineDash([]); g.restore();
    g.font = '10px "IBM Plex Sans Arabic",sans-serif'; g.fillStyle = b.side ? 'rgba(255,150,130,.9)' : 'rgba(255,225,120,.9)'; g.fillText('✈ ' + b.n, x, y + 12); }
  for (const mb of MISSILE_BASES) { const [x, y] = W2S(mb.p[0], mb.p[1]); g.fillStyle = 'rgba(255,90,60,.9)'; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x - 5, y + 4); g.lineTo(x + 5, y + 4); g.fill(); }
  // دروع
  for (const t of tanks) { const n = t.side ? 't72' : 'abrams'; if (t.dead) { const [x, y] = W2S(t.x, t.y); g.fillStyle = 'rgba(20,16,12,.8)'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); if (T - t.dieT < 20 && Math.random() < .15) fx.push({ x: t.x, y: t.y, t: 0, max: 4, size: 6, type: 'smoke', vx: .02, vy: -.02 }); continue; } sprite(n, t.side, t.x, t.y, t.hd, 17); }
  // دخان وانفجارات تحت الطيران
  for (const f of fx) { const [x, y] = W2S(f.x, f.y), q = f.t / f.max;
    if (f.type === 'smoke') { g.globalAlpha = .45 * (1 - q); g.drawImage(puffC, x - f.size / 2, y - f.size / 2, f.size, f.size); g.globalAlpha = 1; }
    else if (f.type === 'ex') { const fr = Math.min(24, Math.floor(q * 25)); g.drawImage(TEX.fx_explo1, (fr % 5) * 200, Math.floor(fr / 5) * 200, 200, 200, x - f.size / 2, y - f.size * .6, f.size, f.size); }
    else if (f.type === 'flash') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - q; g.drawImage(glow, x - f.size / 2, y - f.size / 2, f.size, f.size); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; } }
  // ذيول الصواريخ
  g.lineCap = 'round';
  for (const m of msls) { if (m.trail.length < 2) continue; const col = m.kind === 'bm' ? '230,225,215' : m.kind === 'shell' ? '0,0,0' : '240,240,235';
    if (m.kind === 'shell') { if (!m.done) { const [x, y] = W2S(m.x, m.y - m.z * .5); g.fillStyle = 'rgba(30,26,22,.8)'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); } continue; }
    g.strokeStyle = `rgba(${col},${m.kind === 'bm' ? .55 : .45})`; g.lineWidth = m.kind === 'bm' ? 2.6 : 1.4; g.beginPath(); m.trail.forEach(([tx, ty], i) => { const [x, y] = W2S(tx, ty); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    if (!m.done) { const [x, y] = W2S(m.x, m.y - m.z * .5); g.globalCompositeOperation = 'lighter'; const s = m.kind === 'bm' ? 16 : 10; g.drawImage(glow, x - s / 2, y - s / 2, s, s); g.globalCompositeOperation = 'source-over';
      if (m.kind === 'bm') { const [sx, sy] = W2S(m.x, m.y); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(sx, sy, 3, 1.6, 0, 0, 7); g.fill(); } } }
  // طيارات (مع ذيل تكاثف وظل)
  for (const j of jets) { if (j.dead) continue; const n = j.side ? 'f16' : 'su25';
    if (j.trail.length > 2) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.2; g.beginPath(); j.trail.forEach(([tx, ty], i) => { const [x, y] = W2S(tx, ty); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
    const lift = j.alt * 10, [x, y] = W2S(j.x, j.y); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + lift * .6, y + lift * .5, 6, 3, j.hd, 0, 7); g.fill();
    sprite(n, j.side, j.x, j.y - lift / k, j.hd + (j.state === 'down' ? j.spin : 0), 26, 1 - Math.min(.4, Math.abs(j.bank) * .4));
    if (j.state !== 'down' && j.state !== 'roll') { g.globalCompositeOperation = 'lighter'; const [ex, ey] = W2S(j.x - Math.cos(j.hd) * 12 / k, j.y - lift / k - Math.sin(j.hd) * 12 / k); g.drawImage(glow, ex - 4, ey - 4, 8, 8); g.globalCompositeOperation = 'source-over'; } }
  for (const f of fx) if (f.type === 'flare') { const [x, y] = W2S(f.x, f.y), q = f.t / f.max; g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - q; g.drawImage(glow, x - 5, y - 5 - 10, 10, 10); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
  // تظليل حواف
  const vg = g.createRadialGradient(SW / 2, SH / 2, Math.min(SW, SH) * .35, SW / 2, SH / 2, Math.max(SW, SH) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = vg; g.fillRect(0, 0, SW, SH);
}
function drawFront() {
  if (front <= 0.01) { const pts = BORDER.map(p => W2S(p[0], p[1])); g.strokeStyle = 'rgba(255,90,60,.5)'; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.setLineDash([]); return; }
  // الجبهة تنزاح من الحدود لجهة الأهواز (أكثر بالنص)
  const tgt = TARGET.p, adv = BORDER.map(p => { const w = Math.exp(-((p[1] - tgt[1]) ** 2) / 1.2); return [lerp(p[0], tgt[0] + .6, front * w * .95), lerp(p[1], tgt[1], front * w * .25)] as V; });
  const A = BORDER.map(p => W2S(p[0], p[1])), B = adv.map(p => W2S(p[0], p[1]));
  g.fillStyle = 'rgba(242,207,74,.26)'; g.beginPath(); A.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); for (let i = B.length - 1; i >= 0; i--) g.lineTo(B[i][0], B[i][1]); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(242,207,74,.9)'; g.lineWidth = 2.4; g.beginPath(); B.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  // سهم الهجوم
  const s0 = W2S(STAGING[0][0], STAGING[0][1]), mid = B[Math.floor(B.length / 2) + 1], ang = Math.atan2(mid[1] - s0[1], mid[0] - s0[0]);
  g.strokeStyle = 'rgba(242,207,74,.7)'; g.lineWidth = 5; g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(mid[0], mid[1]); g.stroke();
  g.fillStyle = 'rgba(242,207,74,.85)'; g.beginPath(); g.moveTo(mid[0] + Math.cos(ang) * 12, mid[1] + Math.sin(ang) * 12); g.lineTo(mid[0] + Math.cos(ang + 2.5) * 12, mid[1] + Math.sin(ang + 2.5) * 12); g.lineTo(mid[0] + Math.cos(ang - 2.5) * 12, mid[1] + Math.sin(ang - 2.5) * 12); g.fill();
}
const PHS: [number, string][] = [[0, 'الوضع قبل العملية'], [3, 'ضربات جوية وصاروخية'], [20, 'تقدّم الدروع'], [46, '']];
function hud() {
  const ph = PHS.filter(p => p[0] <= T).pop()![1]; $('phase').textContent = ph || (res.win ? 'السيطرة على ' + res.rname : 'الهجوم تعطّل');
  $('cnt').innerHTML = `طائرات سقطت: <b>${stats.lostA}</b> لنا · <b>${stats.lostD}</b> للعدو · باليستي اعترضنا <b>${stats.bmShot}</b> وضربنا <b>${stats.bmHit}</b> · دبابات: <b>${stats.tanksA}</b> / <b>${stats.tanksD}</b>`;
  const now = performance.now(); $('feed').innerHTML = msgs.filter(m => now - m.at < 5000).map(m => `<div class="s${m.side}">${m.t}</div>`).join('');
  if (T >= CARD && !endShown) { endShown = true; const e = $('bend'); e.hidden = false; e.className = res.win ? 'win' : 'lose';
    e.innerHTML = `<div class="stamp">${res.win ? 'نجحت العملية' : 'فشل الهجوم'}</div><h2>${res.rname}</h2><p>خسرت ${Math.round(res.la * 100)}٪ من القوة المشاركة، والعدو خسر ${Math.round(res.ld * 100)}٪ من مدافعيه. المدة ${res.wk} أسابيع.</p><p class="sub">طائرات سقطت: ${stats.lostA} لنا و${stats.lostD} للعدو · صواريخ باليستية اعترضناها ${stats.bmShot}</p><a class="btn go" href="https://claude.ai/artifact/2K4CRwvNJ6kjQev9YBwHxj" target="_blank">شوف المعركة المقرّبة</a><button class="btn" id="bAgain">مرة ثانية</button>`;
    $('bAgain').onclick = () => { $('bend').hidden = true; start(curKey); }; }
}
let curKey = 'win', last = performance.now();
function frame(now: number) {
  const rdt = clamp((now - last) / 1000, 0, .05); last = now;
  if (running && T < END + 300) { let left = rdt * speed; while (left > 1e-6) { const d = Math.min(.05, left); left -= d; step(d); } hud(); }
  camFor(T); if (mapC) draw();
  requestAnimationFrame(frame);
}
document.querySelectorAll<HTMLButtonElement>('#sRes button').forEach(b => b.onclick = () => { document.querySelectorAll('#sRes button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); curKey = b.dataset.v!; });
document.querySelectorAll<HTMLButtonElement>('#spd button').forEach(b => b.onclick = () => { speed = +b.dataset.s!; document.querySelectorAll('#spd button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
$('bSkip').onclick = () => { while (T < CARD) step(.05); };
$('bFit').onclick = () => { overview = !overview; $('bFit').setAttribute('aria-pressed', String(overview)); };
$('bMute').onclick = () => { muted = !muted; $('bMute').textContent = muted ? '🔇' : '🔊'; if (ac) muted ? ac.suspend() : ac.resume(); };
$('bGo').onclick = () => start(curKey);
(async () => { await loadAll(); buildMap(); ($('bGo') as HTMLButtonElement).disabled = false; $('bGo').textContent = 'ابدأ الشهر'; requestAnimationFrame(frame);
  if (AUTO) { curKey = qs.get('r') || 'win'; start(curKey); (window as any).ready = true; } })();
(window as any).stats = stats;
(window as any).seek = (t: number) => { while (T < t) step(1 / 30); hud(); };
