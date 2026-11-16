// الحرب على الخريطة v2 (I-055، I-057): صور أقمار صناعية حقيقية، كل شي بارتفاع (منظور مائل)، إطلاقات حقيقية
// S-300 عمودي بارد (يطلع، يميل، يشعل، ينطلق) · باتريوت مائل حار · باليستي من منصة بعمود دخان وقوس ودخول ووهج ·
// دخان يبقى بالجو ويتمدد ويمشي مع الريح · صوت يوصل بعد الوميض حسب المسافة والبعيد مكتوم · النتيجة من حساب اللعبة.
import MAP from './mapdata.json';
import SAT from '../textures/sat.json';
import { ll, NAMES, CITIES, RIVERS, AIRBASES, ADS, MISSILE_BASES, BORDER, TARGET, STAGING, DEFENSE, type Base } from './geo';

const $ = (id: string) => document.getElementById(id)!;
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const angd = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const R = (a: number, b: number) => a + Math.random() * (b - a);
const hyp = Math.hypot;
type V = [number, number];
const sprUrls = { ...import.meta.glob('../../battle-classic/sprites/{abrams,t72,su25,f16,patriot,s400,shahed,grad,d30}.png', { query: '?url', import: 'default', eager: true }), ...import.meta.glob('../sprites/f14.png', { query: '?url', import: 'default', eager: true }) } as Record<string, string>;
const texUrls = { ...import.meta.glob('../../theater/textures/fx_explo1.webp', { query: '?url', import: 'default', eager: true }), ...import.meta.glob('../textures/sat{7,8}.webp', { query: '?url', import: 'default', eager: true }) } as Record<string, string>;
const sndUrls = { ...import.meta.glob('../../battle-classic/sounds/{jet_roar,boom_huge,boom_bomb,howitzer,blast,woosh,battle_amb}.mp3', { query: '?url', import: 'default', eager: true }), ...import.meta.glob('../../theater/sounds/{boom_big,boom_mid,boom_far,launch,tank,incoming,rocket}.mp3', { query: '?url', import: 'default', eager: true }) } as Record<string, string>;
const base = (k: string) => k.split('/').pop()!.replace(/\.(png|webp|mp3)$/, '');
const qs = new URLSearchParams(location.search), AUTO = qs.has('auto');
const cv = $('c') as HTMLCanvasElement, g = cv.getContext('2d')!;
let SW = 0, SH = 0, DPR = 1;
function resize() { DPR = Math.min(1.75, window.devicePixelRatio || 1); SW = cv.clientWidth; SH = cv.clientHeight; cv.width = SW * DPR; cv.height = SH * DPR; }
window.addEventListener('resize', resize); resize();
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const loadImg = (u: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });

// ===== الأصول =====
interface Spr { img: HTMLCanvasElement; shadow: HTMLCanvasElement }
const SPR: Record<string, Spr> = {}, TEX: Record<string, HTMLImageElement> = {};
let glow: HTMLCanvasElement, puffW: HTMLCanvasElement, puffD: HTMLCanvasElement, puffB: HTMLCanvasElement, flame: HTMLCanvasElement;
function radial(stops: [number, string][], n = 64) { const c = mk(n, n), x = c.getContext('2d')!, gr = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); stops.forEach(([o, s]) => gr.addColorStop(o, s)); x.fillStyle = gr; x.fillRect(0, 0, n, n); return c; }
function cloudy(rgb: string) { // نفخة دخان بحواف متكسّرة (مو دائرة ملساء)
  const n = 96, c = mk(n, n), x = c.getContext('2d')!;
  for (let i = 0; i < 14; i++) { const a = Math.random() * 7, r = Math.random() * 18, s = 14 + Math.random() * 18, cx = n / 2 + Math.cos(a) * r, cy = n / 2 + Math.sin(a) * r, gr = x.createRadialGradient(cx, cy, 0, cx, cy, s); gr.addColorStop(0, `rgba(${rgb},.32)`); gr.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = gr; x.fillRect(0, 0, n, n); }
  return c;
}
async function loadAll() {
  for (const [k, u] of Object.entries(sprUrls)) { const img = await loadImg(u), n = 160, s = mk(n, n), sx = s.getContext('2d')!; sx.drawImage(img, 0, 0, n, n);
    const sh = mk(n, n), hx = sh.getContext('2d')!; hx.drawImage(s, 0, 0); hx.globalCompositeOperation = 'source-in'; hx.fillStyle = '#000'; hx.fillRect(0, 0, n, n); SPR[base(k)] = { img: s, shadow: sh }; }
  for (const [k, u] of Object.entries(texUrls)) TEX[base(k)] = await loadImg(u);
  glow = radial([[0, 'rgba(255,250,235,1)'], [.18, 'rgba(255,220,150,.9)'], [.45, 'rgba(255,150,60,.35)'], [1, 'rgba(255,110,30,0)']]);
  puffW = cloudy('236,234,228'); puffD = cloudy('48,44,40'); puffB = cloudy('150,128,98');
  flame = mk(64, 16); { const x = flame.getContext('2d')!, gr = x.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.25, 'rgba(255,210,120,.9)'); gr.addColorStop(1, 'rgba(255,120,30,0)'); x.fillStyle = gr; x.beginPath(); x.ellipse(32, 8, 32, 6, 0, 0, 7); x.fill(); }
}

// ===== الخريطة =====
const MAPD = MAP as Record<string, number[][]>;
const borders = new Path2D(), ourBorders = new Path2D();
for (const iso in MAPD) for (const r of MAPD[iso]) { const p = iso === '368' || iso === '364' ? ourBorders : borders; p.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1]); p.closePath(); }
const rivers = new Path2D(); for (const r of RIVERS) r.forEach(([x, y], i) => i ? rivers.lineTo(x, y) : rivers.moveTo(x, y));

// ===== النتيجة (من حساب اللعبة) =====
interface Res { win: boolean; la: number; ld: number; wk: number; rname: string; ca: { tank: number; air: number; ad: number }; cd: { tank: number; air: number; ad: number } }
const SAMPLES: Record<string, Res> = {
  win: { win: true, la: .07, ld: .22, wk: 3, rname: 'خوزستان', ca: { tank: 420, air: 60, ad: 30 }, cd: { tank: 300, air: 40, ad: 24 } },
  lose: { win: false, la: .16, ld: .05, wk: 4, rname: 'خوزستان', ca: { tank: 200, air: 20, ad: 10 }, cd: { tank: 600, air: 70, ad: 40 } },
};
const END = 80, CARD = 72;
const WIND: V = [.022, -.006];   // ريح شمالية غربية خفيفة (وحدة خريطة/ث)
const ZS = 1;                    // مبالغة الارتفاع بالرسم

// ===== الكيانات =====
type JType = 'f16' | 'su25' | 'f14';
interface Jet { id: number; side: 0 | 1; type: JType; x: number; y: number; z: number; zc: number; hd: number; spd: number; st: 'roll' | 'fly' | 'evade' | 'land' | 'down'; mission: 'sead' | 'strike' | 'cap'; tx: number; ty: number; adi: number; base: Base; t0: number; trail: { x: number; y: number; z: number; t: number }[]; bank: number; evT: number; evDir: number; done: boolean; dead: boolean; roll: number; ammo: number; cd: number }
type MK = 'sam' | 'pac' | 'aam' | 'arm' | 'bomb' | 'bm' | 'rkt' | 'shell' | 'uav';
interface Msl { id: number; kind: MK; side: 0 | 1; x: number; y: number; z: number; ux: number; uy: number; uz: number; spd: number; vmax: number; acc: number; turn: number; burn: number; t: number; life: number; ph: 'eject' | 'fly'; tj: number; tm: number; tu: number; gx: number; gy: number; hit: boolean; dead: boolean; tr: Trail | null; px: number; py: number; pz: number; sx: number; sy: number; D: number; apex: number; flag: number }
interface Trail { pts: { x: number; y: number; z: number; t: number }[]; w0: number; gw: number; life: number; a: number; live: boolean }
interface Tank { side: 0 | 1; x: number; y: number; hd: number; dead: boolean; dieT: number; path: V[]; pi: number; fireT: number }
interface Puff { x: number; y: number; z: number; r: number; gr: number; t: number; life: number; a: number; c: 0 | 1 | 2; vz: number; rot: number }
interface Fx { x: number; y: number; z: number; t: number; life: number; size: number; type: 'ex' | 'flash' | 'ring' | 'spark' | 'flare' | 'chute' | 'fire' | 'tracer'; vx: number; vy: number; vz: number; x2?: number; y2?: number }
let trails: Trail[] = [];
let T = 0, res = SAMPLES.win, jets: Jet[] = [], msls: Msl[] = [], tanks: Tank[] = [], puffs: Puff[] = [], fx: Fx[] = [], craters: { x: number; y: number; r: number }[] = [], nid = 1, speed = 1, running = false, endShown = false;
const stats = { lostA: 0, lostD: 0, bmShot: 0, bmHit: 0, tanksA: 0, tanksD: 0, uavShot: 0, adKilled: 0 };
const adAlive = ADS.map(() => true), adAmmo = ADS.map(() => 8), adCD = ADS.map(() => 0), adFire = ADS.map(() => -9);
let pkA = .5, pkD = .5, capA = 0, capD = 0, pendA = 0, pendD = 0, sched: { t: number; f: () => void }[] = [], front = 0, msgs: { t: string; base: string; n: number; side: number; at: number }[] = [], killAhvaz = false;
let ambT = -1;
const at = (t: number, f: () => void) => sched.push({ t, f });
const say = (t: string, side: number) => { const l = msgs[msgs.length - 1], now = performance.now(); if (l && l.base === t) { l.n++; l.t = t + ' ×' + l.n; l.at = now; return; } msgs.push({ t, base: t, n: 1, side, at: now }); if (msgs.length > 3) msgs.shift(); };
const ARTY_A: V[] = [ll(47.25, 31.25), ll(47.35, 30.85), ll(47.1, 31.6)], ARTY_D: V[] = [ll(48.75, 31.55), ll(48.85, 31.0), ll(48.6, 31.85)];
const UAV_SITE: V = ll(49.3, 32.0);

function start(key: string) {
  res = SAMPLES[key]; T = 0; trails = []; jets = []; msls = []; tanks = []; puffs = []; fx = []; craters = []; sched = []; msgs = []; endShown = false; front = 0; pendA = pendD = 0;
  Object.assign(stats, { lostA: 0, lostD: 0, bmShot: 0, bmHit: 0, tanksA: 0, tanksD: 0, uavShot: 0, adKilled: 0 });
  adAlive.fill(true); adAmmo.fill(8); adCD.fill(0); adFire.fill(-9);
  const lg = (n: number, k: number, lo: number, hi: number) => clamp(Math.round(Math.log2(n + 1) * k), lo, hi);
  // نسبة الإصابة وسقف الخسائر من نفس نسب الحساب (الشكل يطابق النتيجة)
  pkD = clamp(.15 + res.la * 2, .15, .55); pkA = clamp(.25 + res.ld * 2, .25, .75);
  const fa = clamp(res.la * 4.5, .05, .8), fd = res.win ? clamp(.45 + res.ld * 1.5, .5, .95) : clamp(res.ld * 2.5, .08, .4);
  const nSead = lg(res.ca.air, .6, 2, 4), nStrike = lg(res.ca.air, .9, 3, 6), nCap = lg(res.cd.air, .7, 2, 5);
  capA = Math.max(1, Math.round((nSead + nStrike * 1.6) * fa * .5)); capD = Math.max(1, Math.round(nCap * fd * .7));
  killAhvaz = res.win;
  // موجة الإخماد: F-16 بصواريخ مضادة للرادار على S-300 الأهواز ودزفول
  for (let i = 0; i < nSead; i++) at(3 + i * 1.3, () => takeoff(0, 'f16', 'sead', AIRBASES[i % 2 ? 2 : 0], ADS[3 + (i % 2)].p, 3 + (i % 2)));
  // موجتين Su-25 على الدفاعات والمطار (بعد الإخماد)
  const strikeT: V[] = [...DEFENSE, AIRBASES[5].p];
  for (let i = 0; i < nStrike; i++) at(9 + i * 1.5, () => takeoff(0, 'su25', 'strike', AIRBASES[i % 2 ? 2 : 3], strikeT[i % strikeT.length], -1));
  for (let i = 0; i < Math.ceil(nStrike / 2); i++) at(36 + i * 2, () => takeoff(0, 'su25', 'strike', AIRBASES[2], DEFENSE[i % DEFENSE.length], -1));
  // اعتراض: F-14 تقلع من دزفول وأميدية
  for (let i = 0; i < nCap; i++) at(6 + i * 2.2, () => takeoff(1, 'f14', 'cap', AIRBASES[4 + (i % 2)], AIRBASES[4 + (i % 2)].p, -1));
  // باليستي: رشقتين
  const nBM = lg(res.cd.air, .9, 3, 7), bmT: V[] = [AIRBASES[0].p, AIRBASES[2].p, CITIES[1].p, AIRBASES[3].p, CITIES[0].p];
  for (let i = 0; i < nBM; i++) at((i < 3 ? 4.5 : 16) + (i % 3) * 1.4, () => launchBM(MISSILE_BASES[i % 2].p, bmT[i % bmT.length], i % 2));
  // مسيّرات شاهد على تجمّع الدروع والبصرة
  const nU = lg(res.cd.air, .7, 2, 5); for (let i = 0; i < nU; i++) at(22 + i * 1.8, () => launchUAV(i));
  // مدفعية وراجمات (تمهيد ثم دعم)
  for (let i = 0; i < 9; i++) at(21 + i * 3.2, () => artillery(0)); for (let i = 0; i < 6; i++) at(23 + i * 4.4, () => artillery(1));
  at(25, () => grad(0)); at(31, () => grad(0)); at(44, () => grad(0)); at(28, () => grad(1));
  // الدروع وخسائرها (نفس معادلات الأصل)
  const nTA = lg(res.ca.tank, 1.2, 6, 12), nTD = lg(res.cd.tank, 1, 4, 10);
  for (let i = 0; i < nTA; i++) { const s = STAGING[i % 3], sx = s[0] + R(-.5, .4), sy = s[1] + R(-.45, .45); const dst: V = res.win ? [TARGET.p[0] + R(-.5, .4), TARGET.p[1] + R(-.5, .5)] : [lerp(sx, TARGET.p[0], .42) + R(-.2, .2), lerp(sy, TARGET.p[1], .42) + R(-.2, .2)];
    tanks.push({ side: 0, x: sx, y: sy, hd: 0, dead: false, dieT: 0, path: [[lerp(sx, dst[0], .35), lerp(sy, dst[1], .35)], dst], pi: 0, fireT: 0 }); }
  for (let i = 0; i < nTD; i++) { const d = DEFENSE[i % DEFENSE.length]; tanks.push({ side: 1, x: d[0] + R(-.4, .4), y: d[1] + R(-.4, .4), hd: Math.PI, dead: false, dieT: 0, path: [], pi: 0, fireT: 0 }); }
  const kA = Math.round(nTA * fa), kD = Math.round(nTD * fd);
  tanks.filter(t => t.side === 0).sort(() => Math.random() - .5).slice(0, kA).forEach(t => t.dieT = R(34, 58));
  tanks.filter(t => t.side === 1).sort(() => Math.random() - .5).slice(0, kD).forEach(t => t.dieT = R(26, 58));
  say('بدأت العملية: هجوم على ' + res.rname, 2);
  running = true; $('hud').hidden = false; $('ctl').hidden = false; $('legend').hidden = false; $('start').hidden = true; $('bend').hidden = true; audio(); ambT = -1;
}

// ===== الطيارات =====
function takeoff(side: 0 | 1, type: JType, mission: Jet['mission'], b: Base, tg: V, adi: number) {
  const j: Jet = { id: nid++, side, type, x: b.p[0] - Math.cos(b.rw) * .12, y: b.p[1] - Math.sin(b.rw) * .12, z: 0, zc: type === 'su25' ? R(.07, .1) : R(.17, .23), hd: b.rw, spd: 0, st: 'roll', mission, tx: tg[0], ty: tg[1], adi, base: b, t0: T, trail: [], bank: 0, evT: 0, evDir: 1, done: false, dead: false, roll: 0, ammo: type === 'su25' ? 4 : 2, cd: 0 };
  jets.push(j); snd('jet_roar', j.x, j.y, .55, type === 'su25' ? .9 : 1.1);
  if (jets.filter(q => q.side === side && q.type === type && T - q.t0 < 2.5).length === 1) say(side ? 'طيارات F-14 إيرانية تقلع للاعتراض' : type === 'f16' ? 'طيارات F-16 تقلع: إخماد الدفاع الجوي' : 'طيارات Su-25 تقلع: ضرب الدفاعات', side);
}
function jetStep(j: Jet, dt: number) {
  if (j.st === 'down') { j.roll += dt * 6; j.z = Math.max(0, j.z - dt * .07); j.spd = Math.max(.35, j.spd - dt * .3); j.hd += dt * .25 * j.evDir; mv(j, dt); emit(j.x, j.y, j.z, 1, 2.5, 1.6, 6, .6); if (Math.random() < dt * 20) fx.push({ x: j.x, y: j.y, z: j.z, t: 0, life: .25, size: 9, type: 'flash', vx: 0, vy: 0, vz: 0 });
    if (j.z <= 0) { j.dead = true; boom(j.x, j.y, 0, 1.1, 'boom_big'); groundFire(j.x, j.y, 14); } return; }
  let want = j.hd, turn = j.type === 'su25' ? .85 : .7;
  if (j.st === 'roll') { j.spd = Math.min(1, j.spd + dt * .8); if (j.spd > .55) j.z = Math.min(j.zc, j.z + dt * .04); if (T - j.t0 > 1.8) j.st = 'fly'; mv(j, dt); return; }
  if (j.st === 'evade') { want = j.hd + j.evDir * 1.2; turn = 1.75; j.zc = Math.max(.05, j.zc - dt * .03); if (T > j.evT) j.st = 'fly'; }
  else if (j.st === 'land') { want = Math.atan2(j.base.p[1] - j.y, j.base.p[0] - j.x); j.z = Math.max(0, j.z - dt * .05); j.spd = Math.max(.55, j.spd - dt * .2); if (hyp(j.base.p[0] - j.x, j.base.p[1] - j.y) < .12 || T - j.evT > 12) j.done = true; }
  else { // fly
    if (j.mission === 'cap' && j.ammo > 0) {
      const e = nearestJet(j, 6); if (e) { const d = hyp(e.x - j.x, e.y - j.y); want = Math.atan2(e.y - j.y, e.x - j.x);
        if (d < 3.4 && j.cd <= 0 && T - j.t0 > 4 && !msls.some(m => m.tj === e.id)) { j.cd = R(4, 7); j.ammo--; fireAt('aam', j.side, j.x, j.y, j.z, e, j.hd); say('F-14 أطلقت صاروخ «فينكس» بعيد المدى', 1); } }
      else want = Math.atan2(j.ty - j.y, j.tx - j.x) + .9;   // دورية: يلف حول القاعدة
      if (T - j.t0 > 34) j.ammo = 0;
    } else if (j.mission === 'cap' || j.ammo <= 0) { want = Math.atan2(j.base.p[1] - j.y, j.base.p[0] - j.x); if (hyp(j.base.p[0] - j.x, j.base.p[1] - j.y) < 1.4) { j.st = 'land'; j.evT = T; } }
    else { const d = hyp(j.tx - j.x, j.ty - j.y); want = Math.atan2(j.ty - j.y, j.tx - j.x);
      if (j.mission === 'sead' && d < 2.3) { // HARM من بعيد ويرجع
        const ad = ADS[j.adi]; fireGround('arm', 0, j.x, j.y, j.z, ad.p[0], ad.p[1], j.hd, killAhvaz && j.adi === 3 && adAlive[3] && !msls.some(m => m.kind === 'arm' && m.flag === 1) ? 1 : 0); j.ammo = 0; say('F-16 أطلقت صاروخ مضاد للرادار على ' + ad.n.split('—')[1].trim(), 0); }
      if (j.mission === 'strike' && d < .75 && j.cd <= 0) { // قنابل موجهة: 4 بالتتابع على خط
        for (let i = 0; i < 4; i++) at(T + i * .22, () => { if (!j.dead && j.st !== 'down') fireGround('bomb', 0, j.x, j.y, j.z, j.tx + R(-.12, .12) + Math.cos(j.hd) * i * .06, j.ty + R(-.12, .12) + Math.sin(j.hd) * i * .06, j.hd, 0); });
        j.ammo = 0; j.cd = 9; }
    } }
  j.cd -= dt;
  const dh = clamp(angd(want, j.hd), -turn * dt, turn * dt); j.hd += dh; j.bank = lerp(j.bank, clamp(dh / dt / 1.6, -1, 1), Math.min(1, dt * 4));
  const vt = j.st === 'evade' ? 1.55 : j.st === 'land' ? j.spd : j.type === 'su25' ? 1.0 : 1.3; j.spd = lerp(j.spd, vt, Math.min(1, dt * 1.5));
  if (j.st !== 'land') j.z = lerp(j.z, j.zc, Math.min(1, dt * .8));
  mv(j, dt);
  if (j.z > .12 && j.type !== 'su25' && j.st !== 'land') { const l = j.trail[j.trail.length - 1]; if (!l || hyp(l.x - j.x, l.y - j.y) > .05) j.trail.push({ x: j.x, y: j.y, z: j.z, t: T }); }
  while (j.trail.length && T - j.trail[0].t > 7) j.trail.shift();
}
const mv = (j: Jet, dt: number) => { j.x += Math.cos(j.hd) * j.spd * dt; j.y += Math.sin(j.hd) * j.spd * dt; };
function nearestJet(j: Jet, r: number) { let b: Jet | null = null, bd = r; for (const q of jets) { if (q.dead || q.done || q.side === j.side || q.st === 'down' || q.st === 'roll' || q.z < .03) continue; const d = hyp(q.x - j.x, q.y - j.y); if (d < bd) { bd = d; b = q; } } return b; }
function evade(j: Jet) { if (j.st === 'down' || j.st === 'roll' || j.st === 'land') return; j.st = 'evade'; j.evT = T + R(1.4, 2.4); j.evDir = Math.random() < .5 ? 1 : -1;
  for (let i = 0; i < 6; i++) at(T + i * .14, () => { if (!j.dead) for (const s of [-1, 1]) fx.push({ x: j.x, y: j.y, z: j.z, t: 0, life: 2.2, size: 7, type: 'flare', vx: -Math.cos(j.hd) * .25 + Math.sin(j.hd) * s * .25, vy: -Math.sin(j.hd) * .25 - Math.cos(j.hd) * s * .25, vz: .02 }); }); }
function killJet(j: Jet) { j.st = 'down'; j.trail = []; if (j.side === 0) { stats.lostA++; pendA--; } else { stats.lostD++; pendD--; } j.evDir = Math.random() < .5 ? 1 : -1;
  say(j.side ? 'أسقطنا طائرة F-14 للعدو' : `خسرنا طائرة ${j.type === 'su25' ? 'Su-25' : 'F-16'}`, j.side);
  at(T + R(.4, .9), () => fx.push({ x: j.x, y: j.y, z: j.z, t: 0, life: 14, size: 4, type: 'chute', vx: WIND[0], vy: WIND[1], vz: -.012 })); }

// ===== الصواريخ =====
function mkMsl(kind: MK, side: 0 | 1, x: number, y: number, z: number): Msl { return { id: nid++, kind, side, x, y, z, ux: 0, uy: 0, uz: 1, spd: 0, vmax: 3, acc: 3, turn: 2.5, burn: 2.5, t: 0, life: 9, ph: 'fly', tj: 0, tm: 0, tu: 0, gx: 0, gy: 0, hit: false, dead: false, tr: null, px: x, py: y, pz: z, sx: x, sy: y, D: 0, apex: 0, flag: 0 }; }
function decideHit(side: 0 | 1, tgt: Jet) { // نصيب أو لا، حسب نسبة الحساب وسقف الخسائر
  const p = side ? pkD : pkA; if (tgt.side === 0) { if (stats.lostA + pendA < capA && Math.random() < p) { pendA++; return true; } return false; }
  if (stats.lostD + pendD < capD && Math.random() < p) { pendD++; return true; } return false; }
function fireAt(kind: 'sam' | 'aam', side: 0 | 1, x: number, y: number, z: number, tgt: Jet, hd: number) {
  const m = mkMsl(kind, side, x, y, z); m.tj = tgt.id; m.hit = decideHit(side, tgt);
  if (kind === 'sam' && side === 1) { m.ph = 'eject'; m.uz = 1; m.spd = .16; m.vmax = 3.1; m.acc = 3.4; m.turn = 2.6; m.burn = 1.7; m.life = 8;   // S-300: إطلاق بارد عمودي
    puffAt(x, y, .01, 0, 5, 4, 1.6, .55); snd('woosh', x, y, .6, .7); }
  else if (kind === 'sam') { const a = Math.atan2(tgt.y - y, tgt.x - x), el = .66; m.ux = Math.cos(a) * Math.cos(el); m.uy = Math.sin(a) * Math.cos(el); m.uz = Math.sin(el); m.spd = .7; m.vmax = 3.4; m.acc = 4; m.turn = 2.4; m.burn = 1.5;   // باتريوت: مائل حار
    hotLaunch(x, y, a); snd('launch', x, y, .8); }
  else { m.ux = Math.cos(hd); m.uy = Math.sin(hd); m.uz = -.1; m.spd = .9; m.vmax = 2.7; m.acc = 2.2; m.turn = 1.8; m.burn = 2; m.life = 11; m.ph = 'eject'; }   // فينكس: يسقط من الطيارة وبعدين يشتعل
  msls.push(m);
  at(T + .8, () => { if (!tgt.dead && !m.dead) evade(tgt); });
}
function fireGround(kind: 'arm' | 'bomb', side: 0 | 1, x: number, y: number, z: number, gx: number, gy: number, hd: number, flag: number) {
  const m = mkMsl(kind, side, x, y, z); m.gx = gx; m.gy = gy; m.flag = flag; m.ux = Math.cos(hd); m.uy = Math.sin(hd); m.uz = 0;
  if (kind === 'arm') { m.spd = 1.2; m.vmax = 2.4; m.acc = 2; m.turn = 1.4; m.burn = 2.2; m.life = 10; snd('rocket', x, y, .5, 1.2); }
  else { m.spd = .9; m.vmax = 1.1; m.acc = 0; m.turn = 1.6; m.burn = 0; m.life = 6; }
  msls.push(m);
}
function launchBM(from: V, to: V, site: number) {
  const m = mkMsl('bm', 1, from[0], from[1], 0); m.gx = to[0] + R(-.12, .12); m.gy = to[1] + R(-.12, .12); const d = hyp(m.gx - from[0], m.gy - from[1]);
  m.D = 7 + d * .55; m.apex = clamp(d * .45, 1.1, 2.6); m.life = m.D + 1; msls.push(m);
  // منصة على الأرض: وميض، عمود دخان وغبار يندفع حواليها
  fx.push({ x: from[0], y: from[1], z: 0, t: 0, life: .7, size: 70, type: 'flash', vx: 0, vy: 0, vz: 0 });
  for (let i = 0; i < 16; i++) { const a = Math.random() * 7, r = R(.02, .16); puffs.push({ x: from[0] + Math.cos(a) * r, y: from[1] + Math.sin(a) * r * .6, z: R(0, .03), r: R(5, 9), gr: R(2, 3.5), t: 0, life: R(8, 14), a: R(.5, .75), c: i % 3 ? 2 : 0, vz: R(0, .01), rot: Math.random() * 7 }); }
  snd('rocket', from[0], from[1], 1, .7); snd('boom_far', from[0], from[1], .6, .8); say('إيران أطلقت صاروخ باليستي من ' + (site ? 'خرم آباد' : 'كرمانشاه'), 1);
}
function bmPos(m: Msl, t: number): [number, number, number] { const s = clamp(t / m.D, 0, 1), gp = Math.pow(s, 1.7); return [lerp(m.sx, m.gx, gp), lerp(m.sy, m.gy, gp), m.apex * Math.pow(Math.sin(Math.PI * s), .9)]; }
function launchUAV(i: number) {
  const m = mkMsl('uav', 1, UAV_SITE[0] + R(-.2, .2), UAV_SITE[1] + R(-.2, .2), .01); const tg = i % 2 ? STAGING[i % 3] : CITIES[1].p; m.gx = tg[0] + R(-.2, .2); m.gy = tg[1] + R(-.2, .2);
  const a = Math.atan2(m.gy - m.y, m.gx - m.x); m.ux = Math.cos(a); m.uy = Math.sin(a); m.uz = 0; m.spd = .38; m.vmax = .38; m.turn = .6; m.life = 60; m.hit = Math.random() < pkA; msls.push(m);
  if (i === 0) say('مسيّرات «شاهد» إيرانية جاية على قواتنا', 1);
}
function hotLaunch(x: number, y: number, a: number) {
  fx.push({ x, y, z: 0, t: 0, life: .35, size: 34, type: 'flash', vx: 0, vy: 0, vz: 0 });
  for (let i = 0; i < 7; i++) { const b = a + Math.PI + R(-.7, .7), r = R(.01, .07); puffs.push({ x: x + Math.cos(b) * r * .5, y: y + Math.sin(b) * r * .5, z: .005, r: R(3, 5), gr: R(1.5, 2.5), t: 0, life: R(4, 7), a: R(.45, .65), c: 2, vz: 0, rot: Math.random() * 7 }); }
}
function guide(m: Msl, ax: number, ay: number, az: number, dt: number) {
  let dx = ax - m.x, dy = ay - m.y, dz = az - m.z; const L = hyp(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
  const k = Math.min(1, m.turn * dt); m.ux += (dx - m.ux) * k; m.uy += (dy - m.uy) * k; m.uz += (dz - m.uz) * k; const n = hyp(m.ux, m.uy, m.uz) || 1; m.ux /= n; m.uy /= n; m.uz /= n;
}
function fly(m: Msl, dt: number) { if (m.t < m.burn) m.spd = Math.min(m.vmax, m.spd + m.acc * dt); else m.spd *= 1 - .06 * dt; m.x += m.ux * m.spd * dt; m.y += m.uy * m.spd * dt; m.z += m.uz * m.spd * dt; }
function mslStep(m: Msl, dt: number) {
  m.t += dt; m.px = m.x; m.py = m.y; m.pz = m.z;
  if (m.kind === 'bm') {
    const [x, y, z] = bmPos(m, m.t); m.x = x; m.y = y; m.z = z; const s = m.t / m.D;
    if (s < .38) emitTrail(m, 2.6, 1.6, 16, .7);
    if (s > .86 && !m.flag) { m.flag = 1; snd('incoming', m.gx, m.gy, .7); }
    if (s >= 1) { m.dead = true; stats.bmHit++; bigImpact(m.gx, m.gy); const near = AIRBASES.find(b => hyp(b.p[0] - m.gx, b.p[1] - m.gy) < .4) || CITIES.find(c => hyp(c.p[0] - m.gx, c.p[1] - m.gy) < .4); say('صاروخ باليستي نزل على ' + (near ? near.n : 'هدف عندنا'), 0); }
    return;
  }
  if (m.kind === 'uav') { // مسيّرة بطيئة واطية، تنزل على الهدف
    guide(m, m.gx, m.gy, hyp(m.gx - m.x, m.gy - m.y) < .25 ? -.05 : .02, dt); m.x += m.ux * m.spd * dt; m.y += m.uy * m.spd * dt; m.z = Math.max(0, m.z + m.uz * m.spd * dt);
    if (m.z <= 0 || m.t > m.life) { m.dead = true; boom(m.x, m.y, 0, .8, 'boom_mid'); groundFire(m.x, m.y, 8); say('مسيّرة ضربت قرب ' + (hyp(m.x - CITIES[1].p[0], m.y - CITIES[1].p[1]) < .5 ? 'البصرة' : 'رتل الدروع'), 0); }
    return;
  }
  if (m.kind === 'shell' || m.kind === 'rkt') { const s = clamp(m.t / m.D, 0, 1); m.x = lerp(m.sx, m.gx, s); m.y = lerp(m.sy, m.gy, s); m.z = m.apex * 4 * s * (1 - s);
    if (m.kind === 'rkt' && s < .45) emitTrail(m, 1.2, 1, 6, .5);
    if (s >= 1) { m.dead = true; boom(m.gx, m.gy, 0, m.kind === 'rkt' ? .55 : .5, m.kind === 'rkt' ? 'boom_mid' : 'boom_bomb', true); craters.push({ x: m.gx, y: m.gy, r: .015 }); }
    return;
  }
  if (m.ph === 'eject') { // S-300 يطلع بالغاز بدون نار، أو فينكس يسقط من الطيارة
    if (m.kind === 'sam') { m.z += m.spd * dt; m.spd = Math.max(.04, m.spd - dt * .3); if (m.t > .55) { m.ph = 'fly'; m.spd = .3; fx.push({ x: m.x, y: m.y, z: m.z, t: 0, life: .3, size: 26, type: 'flash', vx: 0, vy: 0, vz: 0 }); snd('launch', m.x, m.y, .9); for (let i = 0; i < 3; i++) puffs.push({ x: m.x + R(-.006, .006), y: m.y, z: m.z, r: 3, gr: 2, t: 0, life: 5, a: .55, c: 0, vz: 0, rot: 0 }); } return; }
    m.x += m.ux * m.spd * dt; m.y += m.uy * m.spd * dt; m.z -= .04 * dt; if (m.t > .45) { m.ph = 'fly'; snd('rocket', m.x, m.y, .4, 1.3); } return;
  }
  if (m.tu) { // باتريوت على مسيّرة
    const u = msls.find(q => q.id === m.tu && !q.dead); if (u) { guide(m, u.x, u.y, u.z, dt); fly(m, dt); if (m.t < m.burn) emitTrail(m, 1.6, 1.3, 8, .65);
      if (hyp(u.x - m.x, u.y - m.y, u.z - m.z) < .07) { m.dead = true; if (m.hit) { u.dead = true; stats.uavShot++; airBurst(u.x, u.y, u.z, .8); say('أسقطنا مسيّرة شاهد', 0); } else airBurst(m.x, m.y, m.z, .4, true); } }
    else { fly(m, dt); if (m.t > m.life || m.z < 0) { m.dead = true; airBurst(m.x, m.y, Math.max(0, m.z), .4, true); } }
    return;
  }
  // توجيه
  const tj = m.tj ? jets.find(j => j.id === m.tj) : null, tm = m.tm ? msls.find(b => b.id === m.tm && !b.dead) : null;
  let ax = m.gx, ay = m.gy, az = 0;
  if (tj && !tj.dead && tj.st !== 'down') { const d = hyp(tj.x - m.x, tj.y - m.y, tj.z - m.z), tgo = d / Math.max(1, m.spd); ax = tj.x + Math.cos(tj.hd) * tj.spd * tgo; ay = tj.y + Math.sin(tj.hd) * tj.spd * tgo; az = tj.z;
    if (!m.hit && d < 1.2) { ax += Math.cos(tj.hd + 1.57) * .35; ay += Math.sin(tj.hd + 1.57) * .35; az += .1; if (d < .3) m.tj = 0; }   // الطيارة راوغت: الصاروخ يعدّي
    if (m.kind === 'aam' && d > 1.5) az = Math.max(az, m.z + .25);   // فينكس يرتفع وبعدين ينزل
    if (m.hit && d < .07) { m.dead = true; airBurst(m.x, m.y, m.z, 1); killJet(tj); snd('boom_mid', m.x, m.y, .8); return; } }
  else if (tm) { let tgo = hyp(tm.x - m.x, tm.y - m.y, tm.z - m.z) / Math.max(1.5, m.spd); for (let i = 0; i < 3; i++) { const p = bmPos(tm, tm.t + tgo); tgo = hyp(p[0] - m.x, p[1] - m.y, p[2] - m.z) / Math.max(1.5, m.spd); }
    const p = bmPos(tm, tm.t + tgo); ax = p[0]; ay = p[1]; az = p[2]; if (!m.hit) { ax += .25; az += .15; }
    if (m.hit && hyp(tm.x - m.x, tm.y - m.y, tm.z - m.z) < .1) { m.dead = true; tm.dead = true; stats.bmShot++; airBurst(m.x, m.y, m.z, 2.2); snd('boom_big', m.x, m.y, 1); say('الباتريوت اعترض صاروخ باليستي بالجو', 0); msls.forEach(o => { if (o.tm === tm.id && !o.dead && o !== m) o.life = o.t + .8; }); return; } }
  else if (m.kind === 'arm') { const d = hyp(m.gx - m.x, m.gy - m.y); az = d > 1 ? m.z + .2 : 0; }
  else if (m.kind === 'bomb') az = 0;
  else { m.life = Math.min(m.life, m.t + .6); ax = m.x + m.ux; ay = m.y + m.uy; az = m.z + m.uz; }   // الهدف راح: يكمل ويدمّر نفسه
  guide(m, ax, ay, az, dt);
  if (m.kind === 'bomb') m.uz = Math.min(m.uz, -.12);
  fly(m, dt);
  if (m.t < m.burn) emitTrail(m, m.kind === 'sam' || m.kind === 'pac' ? 1.6 : 1.1, m.kind === 'sam' || m.kind === 'pac' ? 1.1 : .8, m.kind === 'aam' || m.kind === 'arm' ? 7 : 10, m.kind === 'aam' || m.kind === 'arm' ? .45 : .6);
  if ((m.kind === 'arm' || m.kind === 'bomb') && (m.z <= 0 || hyp(m.gx - m.x, m.gy - m.y) < .03)) { m.dead = true; boom(m.gx, m.gy, 0, m.kind === 'arm' ? .8 : .65, 'boom_bomb'); craters.push({ x: m.gx, y: m.gy, r: .02 });
    if (m.kind === 'arm') { const i = ADS.findIndex(a => hyp(a.p[0] - m.gx, a.p[1] - m.gy) < .05); if (i >= 0 && m.flag === 1 && adAlive[i]) { adAlive[i] = false; stats.adKilled++; groundFire(m.gx, m.gy, 40); boom(m.gx, m.gy, 0, 1.4, 'boom_huge'); say('دمّرنا رادار ' + ADS[i].n + ' — الطريق انفتح', 0); } else if (i >= 0) say('الرادار انطفى وسلم — ' + ADS[i].n, 1); }
    else hitGround(m.gx, m.gy); return; }
  if (m.z < 0 || m.t > m.life) { m.dead = true; airBurst(m.x, m.y, Math.max(0, m.z), .5, true); }
}
function emitTrail(m: Msl, w0: number, gw: number, life: number, a: number) { // خط دخان: نقاط على المسار، الخط يتوسع ويتلاشى ويمشي مع الريح
  if (!m.tr) { m.tr = { pts: [{ x: m.px, y: m.py, z: m.pz, t: T }], w0, gw, life, a, live: true }; trails.push(m.tr); }
  const l = m.tr.pts[m.tr.pts.length - 1]; if (hyp(m.x - l.x, m.y - l.y, m.z - l.z) > .035 || T - l.t > .12) m.tr.pts.push({ x: m.x, y: m.y, z: m.z, t: T });
}
function emit(x: number, y: number, z: number, c: 0 | 1 | 2, r: number, gr: number, life: number, a: number) { puffs.push({ x: x + R(-.005, .005), y: y + R(-.005, .005), z, r, gr, t: 0, life, a, c, vz: c === 1 ? .012 : 0, rot: Math.random() * 7 }); }
function puffAt(x: number, y: number, z: number, c: 0 | 1 | 2, n: number, r: number, gr: number, a: number) { for (let i = 0; i < n; i++) emit(x + R(-.012, .012), y + R(-.008, .008), z, c, r * R(.7, 1.3), gr, R(4, 8), a); }

// ===== الأرض: مدفعية، راجمات، دروع =====
function artillery(side: 0 | 1) {
  const bat = (side ? ARTY_D : ARTY_A)[Math.floor(Math.random() * 3)], foes = tanks.filter(t => !t.dead && t.side !== side);
  for (let i = 0; i < 3; i++) at(T + i * .35, () => { const f = foes.length ? foes[Math.floor(Math.random() * foes.length)] : null, gx = (f ? f.x : side ? STAGING[0][0] : DEFENSE[0][0]) + R(-.25, .25), gy = (f ? f.y : side ? STAGING[0][1] : DEFENSE[0][1]) + R(-.25, .25);
    const m = mkMsl('shell', side, bat[0] + R(-.06, .06), bat[1] + R(-.06, .06), 0); m.gx = gx; m.gy = gy; m.D = 2.4 + hyp(gx - m.x, gy - m.y) * .9; m.apex = .35; msls.push(m);
    fx.push({ x: m.x, y: m.y, z: 0, t: 0, life: .18, size: 16, type: 'flash', vx: 0, vy: 0, vz: 0 }); emit(m.x, m.y, .005, 2, 4, 3, 4, .5); if (i === 0) snd('howitzer', m.x, m.y, .7); });
}
function grad(side: 0 | 1) { // رشقة راجمة: 12 صاروخ بالتتابع، كل واحد بذيل، تنزل سجادة على منطقة
  const bat = side ? ARTY_D[1] : ARTY_A[0], tgt = side ? STAGING[1] : DEFENSE[Math.floor(Math.random() * DEFENSE.length)];
  for (let i = 0; i < 12; i++) at(T + i * .16, () => { const m = mkMsl('rkt', side, bat[0] + R(-.02, .02), bat[1] + R(-.02, .02), 0); m.gx = tgt[0] + R(-.3, .3); m.gy = tgt[1] + R(-.25, .25); m.D = 2.8 + hyp(m.gx - m.x, m.gy - m.y) * .6; m.apex = .5; msls.push(m); fx.push({ x: m.x, y: m.y, z: 0, t: 0, life: .12, size: 14, type: 'flash', vx: 0, vy: 0, vz: 0 }); if (i % 4 === 0) snd('rocket', m.x, m.y, .45, 1.4); });
  say(side ? 'راجمات العدو تضرب تجمّعنا' : 'راجماتنا تضرب خط الدفاع', side);
}
function tankStep(t: Tank, dt: number) {
  if (t.dead) return;
  if (t.dieT && T > t.dieT) { t.dead = true; boom(t.x, t.y, 0, .6, 'boom_mid'); groundFire(t.x, t.y, 22); if (t.side === 0) stats.tanksA++; else stats.tanksD++; return; }
  let moving = false;
  if (t.side === 0 && T > 30 && t.pi < t.path.length && !(!res.win && T > 52)) { const [px, py] = t.path[t.pi], d = hyp(px - t.x, py - t.y); if (d < .05) t.pi++; else { t.hd += clamp(angd(Math.atan2(py - t.y, px - t.x), t.hd), -dt, dt); t.x += Math.cos(t.hd) * .085 * dt; t.y += Math.sin(t.hd) * .085 * dt; moving = true; } }
  if (!res.win && t.side === 0 && T > 52) { const s = STAGING[0]; t.hd += clamp(angd(Math.atan2(s[1] - t.y, s[0] - t.x), t.hd), -dt, dt); t.x += Math.cos(t.hd) * .06 * dt; t.y += Math.sin(t.hd) * .06 * dt; moving = true; }
  if (res.win && t.side === 1 && T > 50) { t.hd += clamp(angd(-.7, t.hd), -dt, dt); t.x += Math.cos(t.hd) * .06 * dt; t.y += Math.sin(t.hd) * .06 * dt; moving = true; }
  if (moving && Math.random() < dt * 4) emit(t.x - Math.cos(t.hd) * .03, t.y - Math.sin(t.hd) * .03, 0, 2, 2, 1.5, 4, .4);
  const e = tanks.filter(q => !q.dead && q.side !== t.side).sort((a, b) => hyp(a.x - t.x, a.y - t.y) - hyp(b.x - t.x, b.y - t.y))[0];
  if (e && hyp(e.x - t.x, e.y - t.y) < 1 && T - t.fireT > R(3, 6)) { t.fireT = T; const ex = e.x + R(-.05, .05), ey = e.y + R(-.05, .05);
    fx.push({ x: t.x, y: t.y, z: 0, t: 0, life: .15, size: 12, type: 'flash', vx: 0, vy: 0, vz: 0 }, { x: t.x, y: t.y, z: .005, t: 0, life: .35, size: 1, type: 'tracer', vx: 0, vy: 0, vz: 0, x2: ex, y2: ey });
    emit(t.x, t.y, .005, 2, 3, 3, 3, .45); at(T + .35, () => { fx.push({ x: ex, y: ey, z: 0, t: 0, life: .2, size: 10, type: 'flash', vx: 0, vy: 0, vz: 0 }); emit(ex, ey, 0, 2, 3, 3, 3, .5); }); if (Math.random() < .35) snd('tank', t.x, t.y, .4); }
}

// ===== مؤثرات =====
function boom(x: number, y: number, z: number, s: number, sn = 'boom_mid', dusty = false) {
  fx.push({ x, y, z, t: 0, life: 1.1, size: 24 * s + 8, type: 'ex', vx: 0, vy: 0, vz: 0 }, { x, y, z, t: 0, life: .3, size: 50 * s + 14, type: 'flash', vx: 0, vy: 0, vz: 0 });
  if (s > .5) fx.push({ x, y, z, t: 0, life: .7, size: 46 * s, type: 'ring', vx: 0, vy: 0, vz: 0 });
  for (let i = 0; i < 2 + s * 3; i++) emit(x + R(-.02, .02), y + R(-.02, .02), z + R(0, .015), dusty || i % 2 ? 2 : 1, 3.5 * (s + .4), 1.8, R(5, 9), .55);
  snd(sn, x, y, .45 + s * .35);
}
function airBurst(x: number, y: number, z: number, s: number, quiet = false) {
  fx.push({ x, y, z, t: 0, life: .35, size: 40 * s, type: 'flash', vx: 0, vy: 0, vz: 0 }, { x, y, z, t: 0, life: .9, size: 18 * s + 6, type: 'ex', vx: 0, vy: 0, vz: 0 });
  for (let i = 0; i < 3 * s + 2; i++) emit(x, y, z, i % 3 ? 0 : 1, 2.5 * s + 2, 1.6, R(4, 7), .55);
  for (let i = 0; i < 6 * s + 3; i++) { const a = Math.random() * 7, v = R(.05, .2) * s; fx.push({ x, y, z, t: 0, life: R(1.5, 3.5), size: 3, type: 'spark', vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: R(-.02, .08) }); }
  if (!quiet) snd('blast', x, y, .4 * s);
}
function bigImpact(x: number, y: number) {
  boom(x, y, 0, 2, 'boom_huge'); fx.push({ x, y, z: 0, t: 0, life: 1.4, size: 150, type: 'ring', vx: 0, vy: 0, vz: 0 });
  for (let i = 0; i < 12; i++) at(T + i * .15, () => puffs.push({ x: x + R(-.015, .015), y: y + R(-.015, .015), z: i * .02, r: 5 + i * .7, gr: 2.2, t: 0, life: 16, a: .65, c: i < 3 ? 2 : 1, vz: .015, rot: Math.random() * 7 }));
  groundFire(x, y, 45); craters.push({ x, y, r: .05 });
}
function hitGround(x: number, y: number) { const t = tanks.find(q => !q.dead && q.side === 1 && hyp(q.x - x, q.y - y) < .1 && q.dieT); if (t) t.dieT = Math.min(t.dieT, T + .05); }
function groundFire(x: number, y: number, life: number) { if (fx.filter(f => f.type === 'fire').length > 26) return; fx.push({ x, y, z: 0, t: 0, life, size: 1, type: 'fire', vx: 0, vy: 0, vz: 0 }); }

// ===== الدفاع الجوي =====
function adStep(dt: number) {
  ADS.forEach((ad, i) => {
    adCD[i] -= dt; if (!adAlive[i] || adCD[i] > 0 || adAmmo[i] <= 0) return;
    if (ad.side === 0) {
      // باتريوت: الأولوية للباليستي النازل، رشقة صاروخين
      const bm = msls.find(m => m.kind === 'bm' && !m.dead && m.t / m.D > .5 && m.t / m.D < .88 && hyp(m.gx - ad.p[0], m.gy - ad.p[1]) < ad.r * .75 && !msls.some(q => q.tm === m.id));
      if (bm) { const hit = Math.random() < clamp(pkA + .15, .3, .85); for (let k = 0; k < 2; k++) at(T + k * .55, () => { if (bm.dead) return; const m = mkMsl('pac', 0, ad.p[0] + R(-.03, .03), ad.p[1], 0); m.tm = bm.id; m.hit = hit && k === 0; const a = Math.atan2(bm.y - ad.p[1], bm.x - ad.p[0]); m.ux = Math.cos(a) * .7; m.uy = Math.sin(a) * .7; m.uz = .71; m.spd = .9; m.vmax = 3.8; m.acc = 5; m.turn = 3; m.burn = 1.6; m.life = 7; msls.push(m); hotLaunch(m.x, m.y, a); snd('launch', m.x, m.y, .9); });
        adAmmo[i] -= 2; adCD[i] = 3; adFire[i] = T; say('الباتريوت يطلق على صاروخ باليستي', 0); return; }
      const u = msls.find(m => m.kind === 'uav' && !m.dead && !m.flag && hyp(m.x - ad.p[0], m.y - ad.p[1]) < ad.r * .6);
      if (u) { u.flag = 1; const a = Math.atan2(u.y - ad.p[1], u.x - ad.p[0]), m = mkMsl('sam', 0, ad.p[0], ad.p[1], 0); m.tu = u.id; m.hit = u.hit; m.ux = Math.cos(a) * .8; m.uy = Math.sin(a) * .8; m.uz = .6; m.spd = .8; m.vmax = 3; m.acc = 4; m.turn = 3; m.burn = 2; m.life = 6;
        msls.push(m); hotLaunch(ad.p[0], ad.p[1], a); snd('launch', ad.p[0], ad.p[1], .7); adAmmo[i]--; adCD[i] = 2; adFire[i] = T; return; }
    }
    let e: Jet | null = null; for (const j of jets) if (!j.dead && !j.done && j.side !== ad.side && j.st !== 'down' && j.st !== 'roll' && j.z > .03 && hyp(j.x - ad.p[0], j.y - ad.p[1]) < ad.r && !msls.some(m => m.tj === j.id)) { e = j; break; }
    if (e) { fireAt('sam', ad.side, ad.p[0] + R(-.02, .02), ad.p[1] + R(-.02, .02), .005, e, 0); adAmmo[i]--; adCD[i] = R(2.2, 3.6); adFire[i] = T;
      if (Math.random() < .5) say(ad.side ? ad.n.split('—')[0].trim() + ' يرمي على طيارتنا' : 'الباتريوت يرمي على طيارة للعدو', ad.side ? 1 : 0); }
  });
}

// ===== الخطوة =====
function step(dt: number) {
  T += dt;
  const due = sched.filter(e => e.t <= T); sched = sched.filter(e => e.t > T); due.forEach(e => e.f());
  for (const j of jets) if (!j.dead && !j.done) jetStep(j, dt);
  adStep(dt);
  for (const m of msls) if (!m.dead) mslStep(m, dt);
  for (const m of msls) if (m.tr && (m.dead || (m.kind !== 'bm' && m.kind !== 'rkt' && m.t > m.burn + .1) || (m.kind === 'bm' && m.t / m.D > .4) || (m.kind === 'rkt' && m.t / m.D > .47))) { if (m.tr.live) m.tr.pts.push({ x: m.x, y: m.y, z: m.z, t: T }); m.tr.live = false; m.tr = null; }
  trails = trails.filter(r => r.live || T - r.pts[r.pts.length - 1].t < r.life);
  msls = msls.filter(m => !m.dead); jets = jets.filter(j => !j.dead && !j.done);
  for (const t of tanks) tankStep(t, dt);
  front = res.win ? smooth(30, 56, T) : smooth(30, 50, T) * .4 - smooth(52, 60, T) * .25;
  for (const p of puffs) { p.t += dt; p.x += WIND[0] * dt; p.y += WIND[1] * dt; p.z += p.vz * dt; p.r += p.gr * dt * (1 - p.t / p.life * .6); }
  puffs = puffs.filter(p => p.t < p.life); if (puffs.length > 2200) puffs.splice(0, puffs.length - 2200);
  for (const f of fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z = Math.max(0, f.z + f.vz * dt);
    if (f.type === 'spark') { f.vz -= .12 * dt; if (Math.random() < dt * 12) emit(f.x, f.y, f.z, 1, 2, 2, 3, .45); }
    if (f.type === 'flare') { f.vz -= .03 * dt; f.vx *= 1 - dt; f.vy *= 1 - dt; if (Math.random() < dt * 14) emit(f.x, f.y, f.z, 0, 2, 2.5, 3, .5); }
    if (f.type === 'fire' && Math.random() < dt * 3.5 && f.life - f.t > 1) puffs.push({ x: f.x + R(-.008, .008), y: f.y + R(-.008, .008), z: .005, r: R(2.5, 4), gr: R(1.4, 2.4), t: 0, life: R(7, 11), a: .45, c: 1, vz: R(.01, .018), rot: Math.random() * 7 }); }
  fx = fx.filter(f => f.t < f.life);
  if (T > 30 && T < 62 && ambT < 0 && ambT > -2) { ambT = T; amb(true); } if (T > 64 && ambT > 0) { ambT = -2; amb(false); }
}

// ===== الصوت: يوصل بعد الوميض حسب المسافة، والبعيد مكتوم وواطي =====
let ac: AudioContext | null = null, master: GainNode, ambG: GainNode | null = null; const smp: Record<string, AudioBuffer> = {}; let act = 0, muted = false;
function audio() { if (muted) return; try { if (!ac) { ac = new AudioContext(); master = ac.createGain(); master.gain.value = .9; const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; master.connect(comp).connect(ac.destination); const a = ac; for (const [k, u] of Object.entries(sndUrls)) fetch(u).then(r => r.arrayBuffer()).then(b => a.decodeAudioData(b)).then(buf => { smp[base(k)] = buf; }).catch(() => {}); } if (ac.state === 'suspended') ac.resume(); } catch { /* */ } }
function snd(n: string, x: number, y: number, v: number, rate = 1) {
  if (!ac || !smp[n] || muted || act > 16) return;
  const d = hyp((x - cam.x) * cam.k, (y - cam.y) * cam.k) / (Math.min(SW, SH) / 2) * 1.6;   // 0 بالنص، ~1.6 عند الحافة
  const delay = Math.min(1.8, d * .35) / speed, gain = v / (1 + d * .8); if (gain < .05) return;
  const s = ac.createBufferSource(); s.buffer = smp[n]; s.playbackRate.value = rate * R(.92, 1.06);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(16000 / (1 + d * 2.2), 600, 16000);
  const gn = ac.createGain(); gn.gain.value = gain; const pan = ac.createStereoPanner(); pan.pan.value = clamp((x - cam.x) * cam.k / SW * 1.6, -.85, .85);
  s.connect(lp).connect(gn).connect(pan).connect(master); s.start(ac.currentTime + delay); act++; s.onended = () => act--;
}
function amb(on: boolean) { if (!ac || !smp.battle_amb) return; if (on && !ambG) { const s = ac.createBufferSource(); s.buffer = smp.battle_amb; s.loop = true; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; ambG = ac.createGain(); ambG.gain.value = 0; s.connect(lp).connect(ambG).connect(master); s.start(); ambG.gain.linearRampToValueAtTime(.16, ac.currentTime + 4); }
  if (!on && ambG) { ambG.gain.linearRampToValueAtTime(0, ac.currentTime + 3); ambG = null; } }

// ===== الكاميرا: أبعد، لقطات ثابتة بانتقال ناعم =====
const CAMQ = qs.get('cam')?.split(',').map(Number) ?? null;
const cam = { x: 0, y: 0, k: 1 }; let overview = false, kAll = 1;
const BOX = { all: [41.2, 53.4, 27.6, 37.8], air: [43.4, 50.4, 29.2, 35.4], gnd: [46.0, 50.1, 29.8, 33.0], end: [45.4, 50.6, 29.4, 33.6] };
const KEYS: [number, number[]][] = [[0, BOX.all], [3, BOX.all], [7, BOX.air], [27, BOX.air], [32, BOX.gnd], [62, BOX.gnd], [67, BOX.end]];
function fit(b: number[]) { const [a0, y1] = ll(b[0], b[2]), [a1, y0] = ll(b[1], b[3]); return { x: (a0 + a1) / 2, y: (y0 + y1) / 2, k: Math.min(SW / (a1 - a0), (SH - 140) / (y1 - y0)) }; }
function camFor(t: number) {
  kAll = fit(BOX.all).k; if (overview) { Object.assign(cam, fit(BOX.all)); return; }
  if (CAMQ) { Object.assign(cam, fit([CAMQ[0] - CAMQ[2], CAMQ[0] + CAMQ[2], CAMQ[1] - CAMQ[2] * .8, CAMQ[1] + CAMQ[2] * .8])); return; }   // للفحص: ?cam=lon,lat,نص_العرض
  let i = 0; while (i < KEYS.length - 1 && KEYS[i + 1][0] <= t) i++;
  const A = fit(KEYS[i][1]), B = i < KEYS.length - 1 ? fit(KEYS[i + 1][1]) : A, e = i < KEYS.length - 1 ? smooth(KEYS[i][0], KEYS[i + 1][0], t) : 0;
  cam.k = Math.exp(lerp(Math.log(A.k), Math.log(B.k), e)); cam.x = lerp(A.x, B.x, e); cam.y = lerp(A.y, B.y, e) - 30 / cam.k;
  // اهتزاز خفيف وقت الانفجارات الكبيرة
  const sh = fx.reduce((s, f) => f.type === 'ring' && f.size > 80 ? s + (1 - f.t / f.life) : s, 0); if (sh > 0) { cam.x += R(-1, 1) * sh * 2 / cam.k; cam.y += R(-1, 1) * sh * 2 / cam.k; }
}
const S = (x: number, y: number, z = 0): V => [(x - cam.x) * cam.k + SW / 2, (y - z * ZS - cam.y) * cam.k + SH / 2];
const SC = () => clamp(Math.sqrt(cam.k / kAll), 1, 1.7);   // الأيقونات تكبر شوية مع التقريب

// ===== الرسم =====
function spriteAt(n: string, x: number, y: number, z: number, a: number, px: number, squash = 1, shadow = true, alpha = 1) {
  const sp = SPR[n]; if (!sp) return; px *= SC();
  if (shadow) { const air = z > .01, [hx, hy] = S(x + z * .45, y + z * .3, 0); g.save(); g.translate(hx + (air ? 0 : 1.2), hy + (air ? 0 : 1.2)); g.rotate(a + Math.PI / 2); g.globalAlpha = air ? .28 : .45; g.drawImage(sp.shadow, -px * squash / 2, -px / 2, px * squash, px); g.restore(); g.globalAlpha = 1; }
  const [sx, sy] = S(x, y, z); g.save(); g.translate(sx, sy); g.rotate(a + Math.PI / 2); g.globalAlpha = alpha; g.drawImage(sp.img, -px * squash / 2, -px / 2, px * squash, px); g.restore(); g.globalAlpha = 1;
}
function flag(x: number, y: number, side: number) { const w = 11, h = 7; g.save(); g.translate(x, y);
  (side ? ['#239f40', '#ffffff', '#da0000'] : ['#ce1126', '#ffffff', '#000000']).forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * h / 3, w, h / 3 + .3); });
  if (!side) { g.fillStyle = '#007a3d'; g.fillRect(3, h / 3 + .6, 5, 1.2); } g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = .6; g.strokeRect(0, 0, w, h); g.restore(); }
function label(t: string, x: number, y: number, font: string, a = .9) { g.font = font; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.65)'; g.strokeText(t, x, y); g.fillStyle = `rgba(245,242,232,${a})`; g.fillText(t, x, y); }
function draw() {
  const k = cam.k; g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = '#0d1418'; g.fillRect(0, 0, SW, SH);
  // صور الأقمار: الأساس z7 وفوقه الوسط z8 الأدق
  for (const n of ['sat7', 'sat8']) { const b = (SAT as Record<string, number[]>)[n], [x0, y0] = S(b[0], b[1]); if (TEX[n]) g.drawImage(TEX[n], x0, y0, (b[2] - b[0]) * k, (b[3] - b[1]) * k); }
  // حدود بشكل خريطة عسكرية
  g.setTransform(DPR * k, 0, 0, DPR * k, DPR * (SW / 2 - cam.x * k), DPR * (SH / 2 - cam.y * k)); g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2.6 / k; g.stroke(borders); g.stroke(ourBorders);
  g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = .9 / k; g.setLineDash([5 / k, 3 / k]); g.stroke(borders); g.setLineDash([]);
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.3 / k; g.stroke(ourBorders);
  g.strokeStyle = 'rgba(120,175,200,.45)'; g.lineWidth = 1.4 / k; g.stroke(rivers);
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [iso, p] of Object.entries({ '368': ll(43.4, 34.2), '364': ll(51.2, 33.4), '414': ll(47.6, 29.15), '682': ll(45.6, 28.4), '792': ll(41.8, 37.4), '760': ll(40.8, 35.2) })) { const [x, y] = S(p[0], p[1]); g.save(); (g as any).letterSpacing = '3px'; label(NAMES[iso], x, y, `700 ${clamp(k * .55, 13, 24)}px "Reem Kufi",sans-serif`, iso === '368' || iso === '364' ? .62 : .35); g.restore(); }
  for (const c of craters) { const [x, y] = S(c.x, c.y); g.fillStyle = 'rgba(20,16,12,.55)'; g.beginPath(); g.arc(x, y, Math.max(1.2, c.r * k), 0, 7); g.fill(); }
  drawFront();
  for (const c of CITIES) { const [x, y] = S(c.p[0], c.p[1]); g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 1; g.beginPath(); if (c.cap) g.rect(x - 3, y - 3, 6, 6); else g.arc(x, y, 2.2, 0, 7); g.fill(); g.stroke(); label(c.n, x, y - 10, `${c.cap ? 600 : 400} ${c.cap ? 12.5 : 10.5}px "IBM Plex Sans Arabic",sans-serif`); }
  // دفاع جوي: مدى أبيض منقط (يضوي وقت الرمي) + المنظومة + علم
  ADS.forEach((ad, i) => { const [x, y] = S(ad.p[0], ad.p[1]), hot = T - adFire[i] < 2; if (!adAlive[i]) { g.fillStyle = 'rgba(15,12,10,.75)'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); return; }
    g.strokeStyle = `rgba(255,255,255,${hot ? .5 : .16})`; g.setLineDash([3, 5]); g.lineWidth = hot ? 1.3 : .9; g.beginPath(); g.arc(x, y, ad.r * k, 0, 7); g.stroke(); g.setLineDash([]);
    spriteAt(ad.side ? 's400' : 'patriot', ad.p[0], ad.p[1], 0, -Math.PI / 2 + (ad.side ? .3 : -.4), 17); });
  for (const b of AIRBASES) { const [x, y] = S(b.p[0], b.p[1]), L = 16 * SC(); g.save(); g.translate(x, y); g.rotate(b.rw); g.fillStyle = 'rgba(52,52,54,.95)'; g.fillRect(-L, -2.2, L * 2, 4.4); g.strokeStyle = 'rgba(255,255,255,.55)'; g.setLineDash([2.5, 2.5]); g.lineWidth = .6; g.beginPath(); g.moveTo(-L + 2, 0); g.lineTo(L - 2, 0); g.stroke(); g.setLineDash([]); g.restore();
    flag(x - 22, y + 7, b.side); if (!CITIES.some(c => hyp(c.p[0] - b.p[0], c.p[1] - b.p[1]) < .45)) label(b.n, x + 6, y + 11, '10px "IBM Plex Sans Arabic",sans-serif', .85); }
  for (const mb of MISSILE_BASES) { const [x, y] = S(mb.p[0], mb.p[1]); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x - 5, y + 3); g.lineTo(x + 5, y + 3); g.closePath(); g.stroke(); }
  ARTY_A.forEach((b, i) => spriteAt(i === 0 ? 'grad' : 'd30', b[0], b[1], 0, 0, 11)); ARTY_D.forEach((b, i) => spriteAt(i === 1 ? 'grad' : 'd30', b[0], b[1], 0, Math.PI, 11));
  for (const t of tanks) { if (t.dead) { const [x, y] = S(t.x, t.y); g.fillStyle = 'rgba(18,14,10,.85)'; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); continue; } spriteAt(t.side ? 't72' : 'abrams', t.x, t.y, 0, t.hd, 15); }
  // خطوط دخان الصواريخ: كل قطعة تتوسع وتتلاشى حسب عمرها وتمشي مع الريح
  g.lineCap = 'round';
  for (const r of trails) { const P = r.pts; for (let i = 1; i < P.length; i++) { const p0 = P[i - 1], p1 = P[i], age = T - p1.t; if (age > r.life) continue; const q = age / r.life, a = r.a * (1 - q) * (1 - q * .4);
    const [x0, y0] = S(p0.x + WIND[0] * (T - p0.t), p0.y + WIND[1] * (T - p0.t), p0.z), [x1, y1] = S(p1.x + WIND[0] * age, p1.y + WIND[1] * age, p1.z);
    g.strokeStyle = `rgba(238,236,230,${a})`; g.lineWidth = (r.w0 + r.gw * Math.sqrt(age)) * SC(); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); } }
  // دخان: من الأوطى للأعلى
  puffs.sort((a, b) => a.z - b.z);
  for (const p of puffs) { const q = p.t / p.life, a = p.a * Math.min(1, q * 8) * (1 - q) * (1 - q * .3); if (a < .02) continue; const [x, y] = S(p.x, p.y, p.z), s = p.r * SC(); g.globalAlpha = a; g.save(); g.translate(x, y); g.rotate(p.rot + p.t * .1); g.drawImage(p.c === 0 ? puffW : p.c === 1 ? puffD : puffB, -s, -s, s * 2, s * 2); g.restore(); }
  g.globalAlpha = 1;
  // نار على الأرض
  for (const f of fx) if (f.type === 'fire') { const [x, y] = S(f.x, f.y), q = f.t / f.life, s = (8 + Math.sin(T * 13 + f.x * 50) * 2.5) * (1 - q * .6) * SC(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .85; g.drawImage(glow, x - s / 2, y - s * .7, s, s); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  for (const f of fx) if (f.type === 'tracer') { const q = f.t / f.life, [x1, y1] = S(f.x, f.y), [x2, y2] = S(f.x2!, f.y2!); g.strokeStyle = `rgba(255,220,150,${1 - q})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(lerp(x1, x2, Math.max(0, q * 1.4 - .4)), lerp(y1, y2, Math.max(0, q * 1.4 - .4))); g.lineTo(lerp(x1, x2, Math.min(1, q * 1.4)), lerp(y1, y2, Math.min(1, q * 1.4))); g.stroke(); }
  // ذيول التكاثف (خط رفيع يتلاشى ويتوسع)
  g.lineCap = 'round';
  for (const j of jets) for (let i = 1; i < j.trail.length; i++) { const p0 = j.trail[i - 1], p1 = j.trail[i], a = (1 - (T - p1.t) / 7) * .4; const [x0, y0] = S(p0.x, p0.y, p0.z), [x1, y1] = S(p1.x, p1.y, p1.z); g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 1.1 + (T - p1.t) * .5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  // الصواريخ: جسم صغير + لهب + وهج
  for (const m of msls) {
    const [x, y] = S(m.x, m.y, m.z);
    if (m.kind === 'shell') { g.fillStyle = 'rgba(30,26,22,.9)'; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill(); continue; }
    if (m.kind === 'uav') { spriteAt('shahed', m.x, m.y, m.z, Math.atan2(m.uy, m.ux), 12); continue; }
    const [px, py] = S(m.px, m.py, m.pz); const a = hyp(x - px, y - py) < .01 ? -Math.PI / 2 : Math.atan2(y - py, x - px);
    const burning = m.kind === 'bm' ? m.t / m.D < .38 : m.kind === 'rkt' ? m.t / m.D < .45 : m.ph === 'fly' && m.t < m.burn && m.kind !== 'bomb';
    const L = m.kind === 'bm' ? 7 : m.kind === 'bomb' ? 3 : 4.5;
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = m.kind === 'bomb' ? '#4a4c44' : '#e8e6de'; g.fillRect(-L, -1, L * 1.6, 2); g.restore();
    if (burning) { const fl = (m.kind === 'bm' ? 22 : 13) * R(.85, 1.15); g.globalCompositeOperation = 'lighter'; g.save(); g.translate(x - Math.cos(a) * L, y - Math.sin(a) * L); g.rotate(a + Math.PI); g.drawImage(flame, 0, -fl * .14, fl, fl * .28); g.restore(); g.drawImage(glow, x - Math.cos(a) * L - fl * .4, y - Math.sin(a) * L - fl * .4, fl * .8, fl * .8); g.globalCompositeOperation = 'source-over'; }
    if (m.kind === 'bm' && m.t / m.D > .72) { const s = 14 + (m.t / m.D - .72) * 50; g.globalCompositeOperation = 'lighter'; g.globalAlpha = .9; g.drawImage(glow, x - s / 2, y - s / 2, s, s); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }   // وهج الدخول للجو
    if (m.kind === 'bm') { const [hx, hy] = S(m.x, m.y, 0); g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(hx, hy, 3, 1.5, 0, 0, 7); g.fill(); }
  }
  // الطيارات (الصورة دائماً باتجاه الحركة)
  for (const j of jets) { const sz = j.type === 'f14' ? 25 : j.type === 'f16' ? 21 : 20;
    if (j.st === 'down') { spriteAt(j.type, j.x, j.y, j.z, j.hd + Math.sin(j.roll) * .25, sz, Math.abs(Math.cos(j.roll)) * .8 + .2, true, .9); const [x, y] = S(j.x, j.y, j.z); g.globalCompositeOperation = 'lighter'; g.drawImage(glow, x - 8, y - 8, 16, 16); g.globalCompositeOperation = 'source-over'; continue; }
    spriteAt(j.type, j.x, j.y, j.z, j.hd, sz, 1 - Math.min(.35, Math.abs(j.bank) * .35));
    if (j.st !== 'roll' && j.type !== 'su25') { const off = 11 * SC() / cam.k, [ex, ey] = S(j.x - Math.cos(j.hd) * off, j.y - Math.sin(j.hd) * off, j.z); g.globalCompositeOperation = 'lighter'; const s = j.st === 'evade' ? 11 : 6; g.drawImage(glow, ex - s / 2, ey - s / 2, s, s); g.globalCompositeOperation = 'source-over'; } }
  // مؤثرات بالجو
  for (const f of fx) { const q = f.t / f.life, [x, y] = S(f.x, f.y, f.z);
    if (f.type === 'ex') { const fr = Math.min(24, Math.floor(q * 25)), s = f.size * SC(); g.drawImage(TEX.fx_explo1, (fr % 5) * 200, Math.floor(fr / 5) * 200, 200, 200, x - s / 2, y - s * .62, s, s); }
    else if (f.type === 'flash') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - q; const s = f.size * SC(); g.drawImage(glow, x - s / 2, y - s / 2, s, s); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
    else if (f.type === 'ring') { g.strokeStyle = `rgba(255,245,225,${(1 - q) * .55})`; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, f.size * q * SC(), f.size * q * .6 * SC(), 0, 0, 7); g.stroke(); }
    else if (f.type === 'spark' || f.type === 'flare') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - q; const s = f.type === 'flare' ? 7 : 5; g.drawImage(glow, x - s / 2, y - s / 2, s, s); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
    else if (f.type === 'chute') { g.fillStyle = 'rgba(250,250,245,.95)'; g.beginPath(); g.arc(x, y - 2, 3, Math.PI, 0); g.fill(); g.strokeStyle = 'rgba(250,250,245,.7)'; g.lineWidth = .6; g.beginPath(); g.moveTo(x - 3, y - 2); g.lineTo(x, y + 2); g.lineTo(x + 3, y - 2); g.stroke(); } }
  const vg = g.createRadialGradient(SW / 2, SH / 2, Math.min(SW, SH) * .38, SW / 2, SH / 2, Math.max(SW, SH) * .78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, SW, SH);
}
function drawFront() { // خط تماس بشكل الخرائط العسكرية: خط أبيض بأسنان باتجاه العدو، والأرض المأخوذة مخططة
  const tgt = TARGET.p, f = Math.max(0, front), adv = BORDER.map(p => { const w = Math.exp(-((p[1] - tgt[1]) ** 2) / 1.2); return [lerp(p[0], tgt[0] + .6, f * w * .95), lerp(p[1], tgt[1], f * w * .25)] as V; });
  const A = BORDER.map(p => S(p[0], p[1])), B = adv.map(p => S(p[0], p[1]));
  if (f > .01) { g.save(); g.beginPath(); A.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); for (let i = B.length - 1; i >= 0; i--) g.lineTo(B[i][0], B[i][1]); g.closePath(); g.fillStyle = 'rgba(255,255,255,.07)'; g.fill(); g.clip();
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; for (let i = -SH; i < SW + SH; i += 9) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - SH, SH); g.stroke(); } g.restore(); }
  g.beginPath(); B.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 1.6; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.92)';
  for (let i = 0; i < B.length - 1; i++) { const [x0, y0] = B[i], [x1, y1] = B[i + 1], L = hyp(x1 - x0, y1 - y0); if (L < 1) continue; const dx = (x1 - x0) / L, dy = (y1 - y0) / L, nx = -dy, ny = dx, n = Math.floor(L / 12);
    for (let s = 0; s < n; s++) { const x = lerp(x0, x1, (s + .5) / n), y = lerp(y0, y1, (s + .5) / n); g.beginPath(); g.moveTo(x - dx * 3, y - dy * 3); g.lineTo(x + dx * 3, y + dy * 3); g.lineTo(x - nx * 5, y - ny * 5); g.closePath(); g.fill(); } }
  if (f > .05) { const s0 = S(STAGING[0][0], STAGING[0][1]), mid = B[Math.floor(B.length / 2) + 1], ang = Math.atan2(mid[1] - s0[1], mid[0] - s0[0]), w = 7, px = -Math.sin(ang) * w, py = Math.cos(ang) * w, hx = mid[0] - Math.cos(ang) * 14, hy = mid[1] - Math.sin(ang) * 14;
    g.fillStyle = 'rgba(255,255,255,.18)'; g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(s0[0] + px, s0[1] + py); g.lineTo(hx + px, hy + py); g.lineTo(hx + px * 2, hy + py * 2); g.lineTo(mid[0], mid[1]); g.lineTo(hx - px * 2, hy - py * 2); g.lineTo(hx - px, hy - py); g.lineTo(s0[0] - px, s0[1] - py); g.closePath(); g.fill(); g.stroke(); }
}
const PHS: [number, string][] = [[0, 'الوضع قبل العملية'], [3, 'إخماد الدفاع الجوي وضربات جوية'], [21, 'تمهيد مدفعي وراجمات'], [30, 'تقدّم الدروع'], [60, '']];
function hud() {
  const ph = PHS.filter(p => p[0] <= T).pop()![1]; $('phase').textContent = ph || (res.win ? 'السيطرة على ' + res.rname : 'الهجوم تعطّل');
  $('cnt').innerHTML = `طائرات سقطت <b>${stats.lostA}</b> لنا و<b>${stats.lostD}</b> لهم · باليستي: <b>${stats.bmShot}</b> اعترضنا و<b>${stats.bmHit}</b> نزل · شاهد <b>${stats.uavShot}</b> · دبابات <b>${stats.tanksA}</b>/<b>${stats.tanksD}</b>`;
  const now = performance.now(); $('feed').innerHTML = msgs.filter(m => now - m.at < 5500).map(m => `<div class="s${m.side}">${m.t}</div>`).join('');
  if (T >= CARD && !endShown) { endShown = true; const e = $('bend'); e.hidden = false; e.className = res.win ? 'win' : 'lose';
    e.innerHTML = `<div class="stamp">${res.win ? 'نجحت العملية' : 'فشل الهجوم'}</div><h2>${res.rname}</h2><p>خسرت ${Math.round(res.la * 100)}٪ من القوة المشاركة، والعدو خسر ${Math.round(res.ld * 100)}٪ من مدافعيه. المدة ${res.wk} أسابيع.</p><p class="sub">طائرات سقطت: ${stats.lostA} لنا و${stats.lostD} للعدو · باليستي اعترضنا ${stats.bmShot} ونزل ${stats.bmHit} · رادارات دمّرنا ${stats.adKilled}</p><a class="btn go" href="https://claude.ai/artifact/2K4CRwvNJ6kjQev9YBwHxj" target="_blank">شوف المعركة المقرّبة</a><button class="btn" id="bAgain">مرة ثانية</button>`;
    $('bAgain').onclick = () => { $('bend').hidden = true; start(curKey); }; }
}
let curKey = 'win', last = performance.now();
function frame(now: number) {
  const rdt = clamp((now - last) / 1000, 0, .05); last = now;
  if (running && T < END + 300) { let left = rdt * speed; while (left > 1e-6) { const d = Math.min(.04, left); left -= d; step(d); } hud(); }
  camFor(T); draw(); requestAnimationFrame(frame);
}
document.querySelectorAll<HTMLButtonElement>('#sRes button').forEach(b => b.onclick = () => { document.querySelectorAll('#sRes button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); curKey = b.dataset.v!; });
document.querySelectorAll<HTMLButtonElement>('#spd button').forEach(b => b.onclick = () => { speed = +b.dataset.s!; document.querySelectorAll('#spd button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
$('bSkip').onclick = () => { while (T < CARD) step(.04); };
$('bFit').onclick = () => { overview = !overview; $('bFit').setAttribute('aria-pressed', String(overview)); };
$('bMute').onclick = () => { muted = !muted; $('bMute').textContent = muted ? '🔇' : '🔊'; if (ac) muted ? ac.suspend() : ac.resume(); };
$('bGo').onclick = () => start(curKey);
(async () => { await loadAll(); ($('bGo') as HTMLButtonElement).disabled = false; $('bGo').textContent = 'ابدأ الشهر'; requestAnimationFrame(frame);
  if (AUTO) { curKey = qs.get('r') || 'win'; start(curKey); (window as any).ready = true; } })();
(window as any).stats = stats;
(window as any).log = () => msls.map(m => [m.kind, m.side, m.ph, +m.t.toFixed(2), +m.x.toFixed(2), +m.y.toFixed(2), +m.z.toFixed(2)]);
(window as any).seek = (t: number) => { while (T < t) step(1 / 30); hud(); };
