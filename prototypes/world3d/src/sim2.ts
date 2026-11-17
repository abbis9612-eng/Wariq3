// منطق «العملية الكاملة» (WM9، I-063) بدون رسم — متر وثانية حقيقية. x شرق، y شمال، z فوق.
// العراق يهاجم شلامجة → خرمشهر: إخماد دفاع جوي (F-16 + HARM)، قصف دروع (Su-25)، اعتراض إيراني (F-14)، S-400 وباتريوت،
// ذو الفقار على قاعدة البصرة، اشتباك دروع بقذائف حقيقية، حطام، تعزيزات ورتل إمداد. الأرقام من catalog.ts.
import { MSL, AIR, GROUND, SAM, type Side } from './catalog.ts';

export type V3 = { x: number; y: number; z: number };
export const v = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
const norm = (a: V3): V3 => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const scl = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
const angd = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const G = 9.81;
// سرعة لف الجناح (راد/ث)، أقصى تسارع بالمحرك (م/ث²)، سرعة الانهيار (م/ث) [ASSUMPTION تقريبية]
const ROLL: Record<string, number> = { f16: 3.4, su25: 1.9, f14: 2.3 }, THR: Record<string, number> = { f16: 11, su25: 6, f14: 9 }, VSTALL: Record<string, number> = { f16: 72, su25: 62, f14: 68 };
const TURRET_RATE: Record<string, number> = { abrams: .73, t72: .42, bmp: .6 };   // سرعة لف البرج راد/ث [ASSUMPTION]

export const REF = { lat: 31.45, lon: 47.95 };
const MX = (lon: number) => (lon + 180) / 360, MY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2;
export const MPU = 40075016 * Math.cos(REF.lat * Math.PI / 180);
export const toXY = (lat: number, lon: number) => ({ x: (MX(lon) - MX(REF.lon)) * MPU, y: -(MY(lat) - MY(REF.lat)) * MPU });
export const SITES = {
  base: toXY(30.55, 47.66), omid: toXY(30.83, 49.53), s400: toXY(31.30, 48.80), pat: toXY(30.58, 47.72), zolf: toXY(32.42, 48.45), zolf2: toXY(32.30, 48.62),
  stage: toXY(30.515, 47.985), defense: toXY(30.47, 48.07), objective: toXY(30.445, 48.13), depot: toXY(30.545, 47.86),
};
export const RUNWAY = .3, OMID_RW = .2;
export function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export interface Jet { id: number; type: string; side: Side; p: V3; hd: number; spd: number; vz: number; bank: number; st: string; mission: 'sead' | 'strike' | 'cap'; slot: number; lead: number; home: { x: number; y: number }; rw: number; ammo: string[]; t0: number; roll: number; fired: number; tgt: number; faf: number; cmT: number; gam: number; n: number; man: string; manT: number; manH: number }
export interface Msl { id: number; type: string; side: Side; p: V3; vel: V3; ph: 'eject' | 'drop' | 'boost' | 'coast' | 'dead'; t: number; tgtJet?: number; tgtMsl?: number; tgtGnd?: number; tgtPt?: V3; miss: boolean; bestD: number; from: string; lastT?: V3; lastP?: V3; lostAt?: number; plan?: { dir: V3; k: number; p0: V3 } }
export interface Gnd { id: number; type: string; side: Side; p: V3; hd: number; st: 'idle' | 'move' | 'dead' | 'gone'; goal: V3 | null; reload: number; hp: number; burnT: number; plt: number; dug: boolean; turret: number; shotsAt: number; spd: number; rev: boolean; man: string; manP: V3 | null; manT: number }
export interface Battery { id: number; type: string; side: Side; p: V3; hd: number; launchers: { p: V3; alive: boolean; raise: number; hd: number }[]; ammo: number; alert: boolean; next: number }
export interface Ev { t: number; type: string; p: V3; id?: number; data?: any }
export interface Debris { p: V3; vel: V3; t: number; burn: boolean }
export interface Chute { p: V3; t: number; landed: number }

export class World {
  t = 0; ev: Ev[] = []; jets: Jet[] = []; msls: Msl[] = []; gnd: Gnd[] = []; bats: Battery[] = []; debris: Debris[] = []; chutes: Chute[] = []; nid = 1; r: () => number;
  stats = { lostA: [0, 0], lostG: [0, 0], bm: 0, bmShot: 0, reinf: 0 }; phase = 'air'; won = false; endT = -1; nextReinf = 1e9; bmT = [240, 300]; tels: { p: V3; erect: number; fired: boolean; t: number }[] = [];
  constructor(seed = 3) {
    this.r = rng(seed);
    // طيارات العراق: 4×F-16 إخماد (أزواج كل 40 ث) + 4×Su-25 قصف (بعد 100 ث)
    for (let i = 0; i < 4; i++) this.jets.push(this.mkJet('f16', 0, 'sead', i, SITES.base, RUNWAY, 6 + i * 20, ['AGM-88', 'AIM-120', 'AIM-120']));
    for (let i = 0; i < 4; i++) this.jets.push(this.mkJet('su25', 0, 'strike', i, SITES.base, RUNWAY, 100 + i * 18, ['FAB-500', 'FAB-500']));
    // إيران: 2×F-14 اعتراض من أميدية (تقلع لما الطيارات تقرب)
    for (let i = 0; i < 2; i++) this.jets.push(this.mkJet('f14', 1, 'cap', i, SITES.omid, OMID_RW, 1e9, ['AIM-54', 'AIM-54']));
    // دفاع جوي: S-400 (3 منصات) قرب الأهواز، باتريوت (2) قرب البصرة
    this.bats.push(this.mkBat('s400', 1, SITES.s400, .35, [[0, 0], [180, -120], [-160, 140]], 8), this.mkBat('patriot', 0, SITES.pat, .9, [[0, 0], [150, 90]], 8));
    // ذو الفقار: منصتين
    this.tels = [{ p: { ...SITES.zolf, z: 0 }, erect: 0, fired: false, t: this.bmT[0] }, { p: { ...SITES.zolf2, z: 0 }, erect: 0, fired: false, t: this.bmT[1] }];
    // الأرض: العراق 2 فصيل أبرامز + فصيل BMP + 2 غراد؛ إيران 2 فصيل T-72 بسواتر + غراد
    const S = SITES.stage, D = SITES.defense;
    for (let p = 0; p < 3; p++) for (let i = 0; i < 4; i++) this.gnd.push(this.mkGnd(p < 2 ? 'abrams' : 'bmp', 0, { x: S.x - 400 * p - 60 * i, y: S.y + (p - 1) * 350 + (i - 1.5) * 90, z: 0 }, -.2, p));
    for (let i = 0; i < 2; i++) this.gnd.push(this.mkGnd('grad', 0, { x: S.x - 4500, y: S.y + 600 + i * 150, z: 0 }, -.2, 9));
    for (let p = 0; p < 3; p++) for (let i = 0; i < 4; i++) { const O = SITES.objective, c = p < 2 ? { x: D.x, y: D.y + (p - .5) * 900 } : { x: O.x - 1200, y: O.y + 300 }; const g = this.mkGnd('t72', 1, { x: c.x + (i - 1.5) * 220 + this.r() * 60, y: c.y + this.r() * 80, z: 0 }, Math.PI + .2, 10 + p); g.dug = true; this.gnd.push(g); }
    this.gnd.push(this.mkGnd('grad', 1, { x: D.x + 6000, y: D.y + 1800, z: 0 }, Math.PI, 19));
  }
  mkJet(type: string, side: Side, mission: Jet['mission'], slot: number, home: { x: number; y: number }, rw: number, t0: number, ammo: string[]): Jet {
    const back = slot * 350, p = v(home.x - Math.cos(rw) * (1400 + back), home.y - Math.sin(rw) * (1400 + back), 0);
    return { id: this.nid++, type, side, p, hd: rw, spd: 0, vz: 0, bank: 0, st: 'parked', mission, slot, lead: 0, home, rw, ammo: [...ammo], t0, roll: 0, fired: 0, tgt: 0, faf: 0, cmT: 0, gam: 0, n: 1, man: '', manT: 0, manH: 0 };
  }
  mkBat(type: string, side: Side, c: { x: number; y: number }, hd: number, offs: number[][], ammo: number): Battery { return { id: this.nid++, type, side, p: { ...c, z: 0 }, hd, launchers: offs.map(o => ({ p: { x: c.x + o[0], y: c.y + o[1], z: 0 }, alive: true, raise: type === 'patriot' ? 1 : 0, hd })), ammo, alert: false, next: 0 }; }
  mkGnd(type: string, side: Side, p: V3, hd: number, plt: number): Gnd { return { id: this.nid++, type, side, p, hd, st: 'idle', goal: null, reload: 3 + this.r() * 4, hp: 1, burnT: 0, plt, dug: false, turret: hd, shotsAt: 0, spd: 0, rev: false, man: '', manP: null, manT: 0 }; }
  emit(type: string, p: { x: number; y: number; z?: number }, id?: number, data?: any) { this.ev.push({ t: this.t, type, p: { z: 0, ...p }, id, data }); }
  jet(id: number) { return this.jets.find(j => j.id === id); }
  pend(dly: number, go: () => void) { (this as any).pending = [...((this as any).pending || []), { at: this.t + dly, go }]; }
  alive(j: Jet) { return !['hit', 'gone', 'landed', 'parked'].includes(j.st); }

  step(dt: number) {
    this.t += dt;
    for (const j of this.jets) this.stepJet(j, dt);
    for (const b of this.bats) this.stepBattery(b, dt);
    this.stepTels(dt);
    for (const m of this.msls) if (m.ph !== 'dead') this.stepMsl(m, dt);
    for (const g of this.gnd) this.stepGnd(g, dt);
    this.stepReinf();
    for (const d of this.debris) { d.t += dt; if (d.p.z > 0) { d.vel.z -= G * dt; d.vel = add(d.vel, d.vel, -.06 * dt); d.p = add(d.p, d.vel, dt); if (d.p.z <= 0) { d.p.z = 0; d.vel = v(); if (d.burn) this.emit('debris_land', d.p); d.burn = false; } } }
    for (const c of this.chutes) { c.t += dt; if (c.p.z > 0) { c.p.z = Math.max(0, c.p.z - (c.t < 2 ? 35 : 6.5) * dt); c.p.x += 4 * dt; c.p.y += 1.2 * dt; if (c.p.z === 0) { c.landed = this.t; this.emit('chute_land', c.p); } } }
    this.chutes = this.chutes.filter(c => !c.landed || this.t - c.landed < 20);   // المظلة بعد الهبوط تنطوي وتختفي
    this.msls = this.msls.filter(m => m.ph !== 'dead' || this.t - m.t < 0);
    if (!this.won && this.gnd.some(g => g.side === 0 && g.type !== 'grad' && g.type !== 'truck' && g.st !== 'dead' && Math.hypot(g.p.x - SITES.objective.x, g.p.y - SITES.objective.y) < 1500)) { this.won = true; this.endT = this.t + 20; this.emit('objective', SITES.objective); }
  }
  // ---------- الطيارات (WM10.2، I-064): فيزياء نقطة كتلة بلفّات منسّقة ----------
  // الطيارة تلف فقط لما تميل: معدل الدوران = g·n·sinφ / (V·cosγ)، والأنف يرفع/ينزل بـ g/V·(n·cosφ − cosγ).
  // الطيار يختار الحمل n (≤ حد الـG) واتجاه الرفع φ؛ لازم يلف الجناح أول (سرعة لف محدودة) قبل ما تبدي اللفة.
  // للنزول الحاد يقلب الطيارة على ظهرها ويسحب (Split-S)، والصعود يأكل سرعة والغطس يزيدها.
  fly(j: Jet, wantHd: number, wantZ: number, wantSpd: number, dt: number, o: { g?: number; bank?: number; gam?: number; inv?: boolean; gamCmd?: number } = {}) {
    const ty = AIR[j.type], V = Math.max(50, j.spd), cg = Math.cos(j.gam), nMax = Math.min(ty.maxG, o.g ?? ty.maxG * .55), bankMax = o.bank ?? 1.05;
    const wMax = G * Math.tan(bankMax) / V, w = clamp(angd(wantHd, j.hd) * .45, -wMax, wMax);
    const gamMax = o.gam ?? .3; let gc = o.gamCmd ?? clamp(Math.atan2(wantZ - j.p.z, V * 10), -gamMax, gamMax);
    if (j.p.z < 120 && j.st !== 'land' && j.st !== 'roll') gc = Math.max(gc, .06);   // ما تدخل بالأرض
    if (j.p.z + j.vz * 4 < 60 && j.st !== 'land') gc = Math.max(gc, .2);
    const nh = w * V * cg / G, nv = clamp(cg + V * .55 * (gc - j.gam) / G, o.inv ? -nMax : .25, nMax);
    let n = Math.hypot(nh, nv); const phiCmd = Math.atan2(nh, nv); if (n > nMax) n = nMax;
    const R = ROLL[j.type], dphi = angd(phiCmd, j.bank); j.bank += clamp(dphi * 5, -R, R) * dt; j.bank = angd(j.bank, 0);
    const al = Math.max(0, Math.cos(angd(phiCmd, j.bank))), nAct = al * n + (1 - al) * Math.min(1, n);   // يلف الجناح أول وبعدين يسحب
    this.dyn(j, nAct, wantSpd, dt);
  }
  dyn(j: Jet, n: number, wantSpd: number, dt: number) {
    const V = Math.max(50, j.spd), cg = Math.cos(j.gam);
    j.n += clamp(n - j.n, -9 * dt, 9 * dt);   // الـG يتبنى بثانية تقريباً
    j.gam = clamp(j.gam + (G / V) * (j.n * Math.cos(j.bank) - cg) * dt, -1.45, 1.45);
    j.hd = angd(j.hd + G * j.n * Math.sin(j.bank) / (V * Math.max(.15, Math.cos(j.gam))) * dt, 0);
    j.spd = clamp(j.spd + (clamp(.4 * (wantSpd - j.spd), -7, THR[j.type]) - G * Math.sin(j.gam) - .32 * (j.n - 1) * (j.n - 1)) * dt, VSTALL[j.type], 650);
    j.vz = j.spd * Math.sin(j.gam); const hs = j.spd * Math.cos(j.gam);
    j.p = add(j.p, v(Math.cos(j.hd) * hs, Math.sin(j.hd) * hs, j.vz), dt); if (j.p.z < 0) j.p.z = 0;
  }
  // تتبّع خط (مدرج، رجل هبوط): يرجع اتجاه يقرّب الطيارة من الخط
  track(j: Jet, p: { x: number; y: number }, h: number, k = 700) { const e = -(j.p.x - p.x) * Math.sin(h) + (j.p.y - p.y) * Math.cos(h); return h - Math.atan(e / k); }
  stepJet(j: Jet, dt: number) {
    const ty = AIR[j.type];
    if (j.st === 'gone' || j.st === 'landed') return;
    if (j.st === 'parked') {
      if (j.side === 1 && j.t0 > 1e8 && this.jets.some(q => q.side === 0 && this.alive(q) && Math.hypot(q.p.x - j.home.x, q.p.y - j.home.y) < 150000)) { j.t0 = this.t + j.slot * 15; this.emit('scramble', j.p, j.id); }
      if (this.t >= j.t0) { j.st = 'roll'; this.emit('takeoff', j.p, j.id, { type: j.type, mission: j.mission, slot: j.slot }); } return;
    }
    if (j.st === 'hit') { // دوامة سقوط: تلف على نفسها والأنف ينزل
      j.roll += dt * 2.4; j.bank = angd(j.bank + dt * 2.2, 0); j.gam = Math.max(-1.25, j.gam - dt * .35); j.spd = Math.max(120, j.spd * (1 - .05 * dt)); j.vz = j.spd * Math.sin(j.gam); j.hd += dt * .25;
      const hs = j.spd * Math.cos(j.gam); j.p = add(j.p, v(Math.cos(j.hd) * hs, Math.sin(j.hd) * hs, j.vz), dt); if (j.p.z <= 0) { j.p.z = 0; j.st = 'gone'; this.emit('crash', j.p, j.id); } return; }
    if (j.st === 'roll') { // ركض على المدرج، رفع الأنف عند 75 م/ث، إقلاع عند 88
      j.spd = Math.min(95, j.spd + 4 * dt); j.hd = j.rw; if (j.spd > 75) j.gam = Math.min(.17, j.gam + dt * .1);
      j.p = add(j.p, v(Math.cos(j.hd) * j.spd, Math.sin(j.hd) * j.spd, j.spd > 88 ? j.spd * Math.sin(j.gam) : 0), dt);
      if (j.spd >= 88) { j.st = 'climb'; this.emit('liftoff', j.p, j.id); } return; }
    const tgtNow = this.missionTarget(j), cruiseZ = j.type === 'su25' ? 150 : 7000,
      threat = this.msls.find(m => m.tgtJet === j.id && m.ph !== 'dead'), tD = threat ? len(sub(threat.p, j.p)) : 1e9;
    // مراوغة: كسر حاد عمودي على الصاروخ (beam) بكل الـG، نزول، مشاعل؛ لو قريب وفوق 2.5 كم: يقلب ويغطس (Split-S)
    if (threat && tD < 14000 && j.st !== 'land') {
      if (j.st !== 'evade') { j.st = 'evade'; j.manH = j.slot % 2 ? -1 : 1; if (this.t - ((j as any).evT ?? -99) > 6) { (j as any).evT = this.t; this.emit('evade', j.p, j.id, { split: j.p.z > 2500 && tD < 7000 }); } }
      const a = Math.atan2(threat.p.y - j.p.y, threat.p.x - j.p.x), split = j.p.z > 2500 && tD < 7000;
      this.fly(j, a + Math.PI / 2 * j.manH * 1.15, split ? j.p.z - 5000 : Math.max(300, j.p.z - 2500), ty.cruise * 1.3, dt, { g: ty.maxG, bank: 1.45, gam: split ? 1 : .5, inv: split });
      if (tD < 8000 && this.t - j.cmT > .25) { j.cmT = this.t; this.emit('cm', j.p, j.id, { hd: j.hd }); } return; }
    if (j.st === 'evade') j.st = j.ammo.length ? 'transit' : 'rtb';
    if (j.st === 'climb') { // صعود 10°، لفة هادية (≤30°) نحو المهمة بعد 300 م
      const want = j.p.z > 300 ? this.missionHd(j) : j.rw; this.fly(j, want, cruiseZ, ty.cruise, dt, { bank: .52, gam: .2, g: 3 });
      if (j.p.z > Math.min(cruiseZ * .7, 2500) || (j.type === 'su25' && j.p.z > 120)) j.st = 'transit'; return; }
    if (j.st === 'transit') {
      if (!tgtNow) { j.st = 'rtb'; j.man = ''; return; }
      const d = Math.hypot(tgtNow.x - j.p.x, tgtNow.y - j.p.y), brg = Math.atan2(tgtNow.y - j.p.y, tgtNow.x - j.p.x);
      if (j.man === 'crank') { if (this.t > j.manT) j.man = ''; else { this.fly(j, brg + j.manH, Math.max(3000, j.p.z - 1500), ty.cruise, dt, { bank: 1.1, g: 4 }); return; } }
      if (j.type === 'su25') return this.strike(j, tgtNow, d, brg, dt);
      // صواريخ بعيدة: رفع الأنف (loft) قبل الرمي حتى يروح الصاروخ أبعد
      const w = j.ammo[0], rng = w === 'AGM-88' ? 72000 : w === 'AIM-54' ? 70000 : w === 'AIM-120' ? 35000 : 0;
      if (rng && d < rng + 9000 && w !== 'AIM-120') { this.fly(j, brg, Math.min(j.p.z + 4000, ty.ceiling), ty.cruise * 1.1, dt, { gam: .4, g: 4 }); if (d < rng && (j.gam > .18 || j.p.z > ty.ceiling - 500)) this.weaponRelease(j, tgtNow, d); return; }
      // تشكيل: الجناح يمسك مكانه يمين ورا القائد ويعدّل سرعته
      let want = brg, spd = ty.cruise; const leader = this.jets.find(q => q.mission === j.mission && q.side === j.side && q.slot === j.slot - (j.slot % 2) && q !== j && this.alive(q) && q.st !== 'roll');
      if (leader && j.slot % 2) { const ch = Math.cos(leader.hd), sh = Math.sin(leader.hd), off = { x: leader.p.x - ch * 700 + sh * 600, y: leader.p.y - sh * 700 - ch * 600 }, ex = off.x - j.p.x, ey = off.y - j.p.y, along = ex * ch + ey * sh;
        if (Math.hypot(ex, ey) > 250) want = Math.atan2(ey, ex); spd = clamp(leader.spd + along * .08, ty.cruise * .8, ty.cruise * 1.3); if (Math.hypot(ex, ey) <= 250) want = leader.hd; }
      this.fly(j, want, cruiseZ, spd, dt, { bank: .9 }); this.weaponRelease(j, tgtNow, d); return;
    }
    if (j.st === 'rtb' && j.ammo.some(a2 => a2.startsWith('AIM')) && this.nearestEnemyJet(j, 45000)) { j.st = 'transit'; j.t0 = this.t - 400; }   // عدو قريب وهي راجعة: تلتفت وتشتبك
    if (j.st === 'rtb') { const h = j.home, d = Math.hypot(h.x - j.p.x, h.y - j.p.y); this.fly(j, Math.atan2(h.y - j.p.y, h.x - j.p.x), Math.min(j.type === 'su25' ? 1500 : 6000, 4000), ty.cruise, dt, { bank: .8 }); if (d < 30000) { j.st = 'land'; j.man = 'ip'; this.emit('approach', j.p, j.id); } return; }
    if (j.st === 'land') return this.land(j, dt);
  }
  // Su-25: دخول واطي ← طلعة (pop-up) مع ميلان على جنب ← قلب وغطس 30° على الهدف ← رمي ← سحب 5G وكسر ومشاعل ← خروج واطي ← لفة ثانية
  strike(j: Jet, tgt: V3, d: number, brg: number, dt: number) {
    const ty = AIR[j.type], side = j.slot % 2 ? 1 : -1;
    if (!j.man) j.man = 'ingress';
    if (j.man === 'ingress') { this.fly(j, brg, 120, 200, dt, { bank: .9 }); if (d < 7500 && Math.abs(angd(brg, j.hd)) < .5) { j.man = 'popup'; this.emit('popup', j.p, j.id); } return; }
    if (j.man === 'popup') { this.fly(j, brg + side * .55, 2600, 210, dt, { gam: .55, g: 4.5, bank: .7 }); if (j.p.z > 2000 || d < 3000) { j.man = 'dive'; this.emit('rollin', j.p, j.id); } return; }
    if (j.man === 'dive') { const dive = clamp(-Math.atan2(j.p.z, d), -.62, -.05); this.fly(j, brg, 0, 230, dt, { gamCmd: dive, g: 4.5, bank: 1.5, inv: true });
      const slant = Math.hypot(d, j.p.z); if ((slant < 1700 && j.gam < -.2) || j.p.z < 450 || d < 500) { this.weaponRelease(j, tgt, 0, true); j.man = 'pull'; j.manT = this.t + 5; j.manH = j.hd + side * 1.7; } return; }
    if (j.man === 'pull') { this.fly(j, j.manH, 900, 220, dt, { gamCmd: .3, g: 5.5, bank: 1.3 }); if (this.t - j.cmT > .3) { j.cmT = this.t; this.emit('cm', j.p, j.id, { hd: j.hd }); } if (this.t > j.manT) { j.man = 'egress'; j.manT = this.t + 30; } return; }
    if (j.man === 'egress') { this.fly(j, j.manH, 120, 210, dt, { bank: .8 }); if (this.t > j.manT || d > 9000) { j.man = j.ammo.length ? 'ingress' : ''; if (!j.ammo.length) j.st = 'rtb'; } return; }
  }
  // هبوط حقيقي «overhead break»: نقطة دخول ورا المدرج بـ 8 كم على 450 م ← فوق المدرج ← كسر 180° بـ 4G ← رجل موازية ← لفة 180° نازلة ← نهائي 3° ← لمس وفرملة
  land(j: Jet, dt: number) {
    const b = j.home, h = j.rw, ux = Math.cos(h), uy = Math.sin(h), rx = j.p.x - b.x, ry = j.p.y - b.y, along = rx * ux + ry * uy, crs = -rx * uy + ry * ux, lane = 1 + j.slot * .25, side = j.side ? -1 : 1;
    if (j.man === 'ip') { // لو جاي من قدّام المدرج يلف لفة واسعة لنقطة جانبية أول، حتى يدخل على الخط بدون دوران
      const far = along > -7000, ip = far ? { x: b.x - ux * 12000 * lane + uy * 3000 * side, y: b.y - uy * 12000 * lane - ux * 3000 * side } : { x: b.x - ux * 8000 * lane, y: b.y - uy * 8000 * lane };
      this.fly(j, Math.atan2(ip.y - j.p.y, ip.x - j.p.x), 450, 190, dt, { bank: 1 });
      if ((along < -7000 && Math.abs(crs) < 4000 && Math.abs(angd(j.hd, h)) < 1.2) || Math.hypot(ip.x - j.p.x, ip.y - j.p.y) < 1200) j.man = far ? 'ip' : 'initial'; return; }
    if (j.man === 'initial') { this.fly(j, this.track(j, b, h, 1200), 450, 180, dt, { bank: 1 }); if (along > -200 && Math.abs(crs) < 600) { j.man = 'break'; this.emit('break', j.p, j.id); } else if (along > 1500) j.man = 'ip'; return; }
    if (j.man === 'break') { this.fly(j, h + Math.PI * .999 * side, 300, 120, dt, { g: 2.6, bank: 1.2 }); if (Math.abs(angd(j.hd, h + Math.PI)) < .25) j.man = 'downwind'; return; }
    if (j.man === 'downwind') { const p0 = { x: b.x - uy * 1800 * side, y: b.y + ux * 1800 * side }; this.fly(j, this.track(j, p0, h + Math.PI, 500), 300, 105, dt, { bank: .7 }); if (along < -1800 && Math.abs(crs - 1800 * side) < 350) j.man = 'base'; return; }
    if (j.man === 'base') { this.fly(j, h, 180, 90, dt, { bank: .75, g: 2.5 }); if (Math.abs(angd(j.hd, h)) < .35) j.man = 'final'; return; }
    // نهائي: 3° (z = −along·tan3°) وتصحيح جانبي، لمس وفرملة
    const wantZ = Math.max(0, -along * .052), onRw = j.p.z <= .5 && along > -200;
    if (!onRw && j.p.z < 40 && Math.abs(crs) > 120) { j.man = 'ip'; this.emit('goaround', j.p, j.id); return; }   // ما مصطفّة: دورة ثانية
    if (!onRw) { this.fly(j, this.track(j, b, h, 500), wantZ, 78, dt, { bank: .6, gamCmd: clamp(Math.atan2(wantZ - j.p.z, 600) - .02, -.12, .05) }); if (j.p.z < 1.5 && along > -300) { j.p.z = 0; j.gam = 0; j.bank = 0; } }
    else { j.p.z = 0; j.gam = 0; j.bank = 0; j.n = 1; j.spd = Math.max(0, j.spd - 6 * dt); j.hd += angd(h, j.hd) * dt; j.p = add(j.p, v(Math.cos(j.hd) * j.spd, Math.sin(j.hd) * j.spd, 0), dt); }
    if (onRw && j.spd < 12) { j.st = 'landed'; this.emit('landed', j.p, j.id); }
  }
  missionHd(j: Jet) { const t = this.missionTarget(j); return t ? Math.atan2(t.y - j.p.y, t.x - j.p.x) : j.hd; }
  missionTarget(j: Jet): V3 | null {
    if (this.t - j.t0 > (j.mission === 'sead' ? 760 : 560)) return null;   // وقت المهمة خلص: رجوع
    if (j.mission === 'sead') { if (j.ammo.includes('AGM-88')) { const l = this.bats[0].launchers.find(l2 => l2.alive); return l ? l.p : null; }
      const e = this.nearestEnemyJet(j, 120000); return e ? e.p : j.ammo.length ? { x: SITES.defense.x - 15000, y: SITES.defense.y + 25000, z: 0 } : null; }
    if (j.mission === 'strike') { if (!j.ammo.length) return null; /* WM15.2: القصف على الراجمات والفصيل الخلفي، وخط الدبابات الأمامي يبقى لمعركة الدروع */ let tg = this.gnd.filter(g => g.side !== j.side && g.st !== 'dead' && (g.type === 'grad' || (g.type === 't72' && g.plt === 12))); if (!tg.length) tg = this.gnd.filter(g => g.side !== j.side && g.st !== 'dead' && g.type === 't72'); return tg.length ? tg[(j.slot + j.fired) % tg.length].p : null; }
    const e = this.nearestEnemyJet(j, 180000); return e && j.ammo.length ? e.p : null;
  }
  nearestEnemyJet(j: Jet, r: number) { let b: Jet | null = null, bd = r; for (const q of this.jets) { if (q.side === j.side || !this.alive(q) || q.st === 'roll') continue; const d = len(sub(q.p, j.p)); if (d < bd) { bd = d; b = q; } } return b; }
  weaponRelease(j: Jet, tgt: V3, d: number, force = false) {
    if (this.t - (j as any).lastShot < 3) return;
    const w = j.ammo[0]; if (!w) return;
    if (w === 'FAB-500') { if (force) { const g = this.gnd.find(q => q.p === tgt); this.fireAt(j, w, { gnd: g?.id, pt: tgt }); if (j.ammo[0] === 'FAB-500') { const g2 = g; this.pend(.35, () => { if (this.alive(j) && j.ammo[0] === 'FAB-500') this.fireAt(j, 'FAB-500', { gnd: g2?.id, pt: { x: tgt.x + Math.cos(j.hd) * 40, y: tgt.y + Math.sin(j.hd) * 40, z: 0 } }); }); } } return; }
    const crank = () => { j.man = 'crank'; j.manT = this.t + (w === 'AIM-120' ? 15 : 28); j.manH = (j.slot % 2 ? -1 : 1) * (w === 'AIM-120' ? .8 : 1); };
    if (w === 'AGM-88' && d < 72000) { const l = this.bats[0].launchers.find(l2 => l2.alive && l2.p === tgt) ?? this.bats[0].launchers.find(l2 => l2.alive); if (l) { this.fireAt(j, w, { pt: l.p }); crank(); } }
    else if ((w === 'AIM-120' || w === 'AIM-54') && d < (w === 'AIM-54' ? 70000 : 35000)) { const e = this.nearestEnemyJet(j, Math.hypot(d, 20000)); if (e && !this.msls.some(m => m.tgtJet === e.id && m.ph !== 'dead')) { this.fireAt(j, w, { jet: e }); crank(); } }
  }
  fireAt(j: Jet, w: string, t: { jet?: Jet; pt?: V3; gnd?: number }) {
    const M = MSL[w], miss = this.r() > M.pk * (t.jet ? 1 - (AIR[t.jet.type].gen - 3) * .1 : 1);
    const m: Msl = { id: this.nid++, type: w, side: j.side, p: add(j.p, v(0, 0, -2)), vel: v(Math.cos(j.hd) * j.spd * Math.cos(j.gam), Math.sin(j.hd) * j.spd * Math.cos(j.gam), j.vz), ph: M.drop ? 'drop' : 'coast', t: 0, tgtJet: t.jet?.id, tgtPt: t.pt ? { ...t.pt } : undefined, tgtGnd: t.gnd, miss, bestD: 1e9, from: j.type };
    this.msls.push(m); j.ammo.shift(); j.fired++; (j as any).lastShot = this.t; this.emit('air_launch', j.p, m.id, { w, by: j.type, side: j.side });
  }
  // ---------- الدفاع الجوي ----------
  stepBattery(b: Battery, dt: number) {
    const ty = SAM[b.type], horizon = (z: number) => 4120 * (5 + Math.sqrt(Math.max(0, z))), foes = this.jets.filter(q => q.side !== b.side && this.alive(q) && q.st !== 'roll' && q.p.z > 50 && len(sub(q.p, b.p)) < horizon(q.p.z));
    if (!b.alert && foes.some(q => len(sub(q.p, b.p)) < ty.range * .9)) { b.alert = true; this.emit('sam_alert', b.p, b.id, { type: b.type }); }
    for (const l of b.launchers) if (b.alert && l.alive) l.raise = Math.min(1, l.raise + dt / 9);
    // HARM بالطريق: الرادار يطفي (إخماد) لحد ما يوصل أو يفوت
    const harm = this.msls.some(m => m.type === 'AGM-88' && m.ph !== 'dead' && m.tgtPt && Math.hypot(m.tgtPt.x - b.p.x, m.tgtPt.y - b.p.y) < 2000);
    if (harm !== !!(b as any).silent) { (b as any).silent = harm; this.emit(harm ? 'sam_silent' : 'sam_resume', b.p, b.id); }
    if (harm || this.t < b.next || b.ammo <= 0) return;
    const L = b.launchers.filter(l => l.alive && l.raise >= 1); if (!L.length) return;
    // باتريوت: الأولوية للباليستي النازل
    if (b.type === 'patriot') { const bm = this.msls.find(m => m.type === 'Zolfaghar' && m.ph !== 'dead' && m.vel.z < -300 && m.p.z < 50000 && Math.hypot(m.tgtPt!.x - b.p.x, m.tgtPt!.y - b.p.y) < 30000 && this.bmTgo(m) < 34 && !this.msls.some(q => q.tgtMsl === m.id && q.ph !== 'dead'));
      if (bm) { const hit = this.r() < .82; for (let i = 0; i < 2; i++) this.launchSam(b, L[i % L.length], { msl: bm }, !(hit && i === 0), i * 1.1); b.next = this.t + 4; return; } }
    const tgt = foes.filter(q => len(sub(q.p, b.p)) < ty.range * (b.type === 's400' ? .8 : 1) && !this.msls.some(m => m.tgtJet === q.id && m.ph !== 'dead')).sort((a, c) => len(sub(a.p, b.p)) - len(sub(c.p, b.p)))[0];
    if (tgt) { const M = MSL[ty.missile], hit = this.r() < M.pk - (AIR[tgt.type].gen - 3) * .08 - (tgt.type === 'su25' ? .1 : 0); this.launchSam(b, L[Math.floor(this.r() * L.length)], { jet: tgt }, !hit, 0); b.next = this.t + 5 + this.r() * 4; }
  }
  launchSam(b: Battery, l: Battery['launchers'][0], t: { jet?: Jet; msl?: Msl }, miss: boolean, delay: number) {
    const ty = SAM[b.type], M = MSL[ty.missile];
    const go = () => {
      if (!l.alive) return; b.ammo--;
      let p: V3, vel: V3, ph: Msl['ph'];
      if (ty.cold) { const h = l.hd, k = b.ammo % 4, back = -6.2, side = k % 2 ? .65 : -.65; p = add(l.p, v(Math.cos(h) * back - Math.sin(h) * side, Math.sin(h) * back + Math.cos(h) * side, 8.5)); vel = v(0, 0, M.eject ?? 33); ph = 'eject'; }
      else { const tp = t.jet?.p ?? t.msl!.p, a = Math.atan2(tp.y - l.p.y, tp.x - l.p.x), el = ty.elev * Math.PI / 180; p = add(l.p, v(Math.cos(a) * -2, Math.sin(a) * -2, 4.5)); vel = v(Math.cos(a) * Math.cos(el) * 60, Math.sin(a) * Math.cos(el) * 60, Math.sin(el) * 60); ph = 'boost'; }
      const m: Msl = { id: this.nid++, type: ty.missile, side: b.side, p, vel, ph, t: 0, tgtJet: t.jet?.id, tgtMsl: t.msl?.id, miss, bestD: 1e9, from: b.type };
      this.msls.push(m); this.emit(ty.cold ? 'sam_eject' : 'sam_hot', p, m.id, { bat: b.type, az: Math.atan2(vel.y, vel.x) });
    };
    if (delay > 0) (this as any).pending = [...((this as any).pending || []), { at: this.t + delay, go }]; else go();
  }
  bmTgo(m: Msl) { return (m.vel.z + Math.sqrt(m.vel.z * m.vel.z + 2 * G * Math.max(0, m.p.z))) / G; }
  // ---------- ذو الفقار ----------
  stepTels(dt: number) {
    const pend = (this as any).pending as { at: number; go: () => void }[] | undefined; if (pend?.length) { const due = pend.filter(e => e.at <= this.t); (this as any).pending = pend.filter(e => e.at > this.t); due.forEach(e => e.go()); }
    for (const tl of this.tels) { if (this.t > tl.t - 8 && !tl.fired) { if (tl.erect === 0) this.emit('bm_erect', tl.p); tl.erect = Math.min(1, tl.erect + dt / 8); }
      if (tl.erect >= 1 && !tl.fired) { tl.fired = true; const p0 = add(tl.p, v(-Math.cos(3.6) * 7.6, -Math.sin(3.6) * 7.6, 2)), tgt = { x: SITES.base.x + (this.r() - .5) * 1500, y: SITES.base.y + (this.r() - .5) * 800, z: 0 };
        const plan = World.planBM(p0, tgt); const m: Msl = { id: this.nid++, type: 'Zolfaghar', side: 1, p: p0, vel: v(), ph: 'boost', t: 0, tgtPt: tgt, miss: false, bestD: 1e9, from: 'zolf', plan }; this.msls.push(m); this.stats.bm++; this.emit('bm_launch', p0, m.id); } }
  }
  static bmBoost(p0: V3, dir: V3, k: number, t: number, dt = .05) {
    let p = { ...p0 }, vel = v(); const tb = 26;
    for (let s = 0; s < t && s < tb; s += dt) { const pitch = s < 6 ? Math.PI / 2 : Math.PI / 2 - (Math.PI / 2 - .55) * Math.min(1, Math.pow((s - 6) / 16, .8)), a = 27 * k * (1 + s / tb * .8);
      vel = add(vel, v(dir.x * Math.cos(pitch), dir.y * Math.cos(pitch), Math.sin(pitch)), a * dt); vel.z -= G * dt; p = add(p, vel, dt); }
    return { p, vel };
  }
  static planBM(p0: V3, tgt: V3) {
    const dir = norm(v(tgt.x - p0.x, tgt.y - p0.y, 0)), D = Math.hypot(tgt.x - p0.x, tgt.y - p0.y); let lo = .3, hi = 3, k = 1;
    for (let it = 0; it < 40; it++) { k = (lo + hi) / 2; const b = World.bmBoost(p0, dir, k, 99), vz = b.vel.z, tf = (vz + Math.sqrt(vz * vz + 2 * G * b.p.z)) / G, r = Math.hypot(b.vel.x, b.vel.y) * tf + Math.hypot(b.p.x - p0.x, b.p.y - p0.y); if (r < D) lo = k; else hi = k; }
    return { dir, k, p0 };
  }
  // ---------- الصواريخ ----------
  stepMsl(m: Msl, dt: number) {
    m.t += dt; const M = MSL[m.type];
    if (m.type === 'Zolfaghar') { if (m.t < 26) { const b = World.bmBoost(m.plan!.p0, m.plan!.dir, m.plan!.k, m.t); m.p = b.p; m.vel = b.vel; } else { if (m.ph === 'boost') { m.ph = 'coast'; this.emit('bm_burnout', m.p, m.id); } m.vel.z -= G * dt; m.p = add(m.p, m.vel, dt); }
      if (m.vel.z < -800 && m.p.z < 8000 && !(m as any).whistle) { (m as any).whistle = 1; this.emit('incoming', m.p, m.id); }
      if (m.p.z <= 0 && m.t > 5) { m.ph = 'dead'; m.p.z = 0; this.emit('bm_impact', m.p, m.id); } return; }
    if (m.type === '125mm' || m.type === '120mm' || m.type === '122mm') return this.stepShell(m, dt);
    if (m.ph === 'eject') { m.vel.z -= G * dt; m.p = add(m.p, m.vel, dt); if (m.t >= .95) { m.ph = 'boost'; m.t = 0; this.emit('ignite', m.p, m.id); } return; }
    if (m.ph === 'drop') { m.vel.z -= G * dt; m.p = add(m.p, m.vel, dt); if (m.t >= (M.drop ?? .5)) { m.ph = M.burn ? 'boost' : 'coast'; m.t = 0; if (M.burn) this.emit('ignite_air', m.p, m.id); } return; }
    if (m.type === 'FAB-500') { // قنبلة: تسقط بالجاذبية على الهدف (توجيه بسيط)
      const tp = m.tgtPt!, h = norm(v(tp.x - m.p.x, tp.y - m.p.y, 0)), hs = Math.hypot(m.vel.x, m.vel.y); m.vel.x += (h.x * hs - m.vel.x) * dt * .8; m.vel.y += (h.y * hs - m.vel.y) * dt * .8; m.vel.z -= G * dt; m.p = add(m.p, m.vel, dt);
      if (m.p.z <= 0) { m.p.z = 0; m.ph = 'dead'; this.groundBlast(m.p, 60, m.miss ? -1 : m.tgtGnd ?? -1, 'bomb'); } return; }
    const tj = m.tgtJet ? this.jets.find(j => j.id === m.tgtJet && this.alive(j)) : null, tm = m.tgtMsl ? this.msls.find(b => b.id === m.tgtMsl && b.ph !== 'dead') : null;
    const tgtP = tj ? tj.p : tm ? tm.p : m.tgtPt ?? null, tgtV = tj ? v(Math.cos(tj.hd) * tj.spd * Math.cos(tj.gam), Math.sin(tj.hd) * tj.spd * Math.cos(tj.gam), tj.vz) : tm ? tm.vel : v();
    if (m.t < M.burn) m.vel = add(m.vel, norm(len(m.vel) === 0 ? v(0, 0, 1) : m.vel), M.acc * dt); else { m.vel = add(m.vel, m.vel, -.012 * dt); if (len(m.vel) < 160 && m.ph === 'coast') { m.ph = 'dead'; this.emit('selfdestruct', m.p, m.id); return; } }
    if (m.ph === 'boost' && m.t >= M.burn) { m.ph = 'coast'; this.emit('burnout', m.p, m.id); }
    m.vel.z -= G * dt * .3;
    if (!tgtP) { m.p = add(m.p, m.vel, dt); m.lostAt ??= this.t; if (this.t - m.lostAt > 1.6 || m.p.z < 0) { m.ph = 'dead'; this.emit('selfdestruct', m.p, m.id); } return; }
    let aim = tgtP; const r = sub(tgtP, m.p), dist = len(r);
    if (m.miss && dist < 9000 && !m.tgtPt) aim = add(tgtP, norm(cross(r, v(0, 0, 1))), 800);
    if (m.from === 's400' && m.t < 1.6) { const want = norm(add(norm(sub(aim, m.p)), v(0, 0, .55))), u = norm(m.vel), s2 = len(m.vel), nu = norm(add(u, scl(sub(want, u), Math.min(1, 2.4 * dt)))); m.vel = scl(nu, s2); }
    else if (!(m.from === 'patriot' && m.t < .8)) {
      const rel = sub(aim, m.p), vr = sub(tgtV, m.vel), R2 = Math.max(1, dot(rel, rel)), om = scl(cross(rel, vr), 1 / R2), rh = norm(rel), Vc = Math.max(200, -dot(vr, rh)), N = m.type === 'PAC-3' ? 5 : 4;
      let acc = scl(cross(om, rh), N * Vc); if (tm && tm.ph === 'coast') { const u = norm(m.vel), at = v(0, 0, -G); acc = add(acc, add(at, u, -dot(at, u)), N / 2); }
      if (m.type === 'AGM-88' || m.type === 'AIM-54') { if (dist > 15000) acc.z += 10; }
      if (m.type === '48N6' && dist > 15000) acc.z += 12;
      const amax = M.maxG * G, al = len(acc); if (al > amax) acc = scl(acc, amax / al);
      const s2 = len(m.vel); m.vel = add(m.vel, acc, dt); m.vel = scl(norm(m.vel), s2);
    }
    const p0 = { ...m.p }; m.p = add(m.p, m.vel, dt);
    const r0 = m.lastT && m.lastP ? sub(m.lastT, m.lastP) : sub(tgtP, p0), r1 = sub(tgtP, m.p), dr = sub(r1, r0), dd = dot(dr, dr), sc = dd > 0 ? clamp(-dot(r0, dr) / dd, 0, 1) : 1, d2 = len(add(r0, dr, sc));
    m.lastT = { ...tgtP }; m.lastP = { ...m.p }; const prevBest = m.bestD; m.bestD = Math.min(m.bestD, d2);
    if (!m.miss && d2 < Math.max(M.fuze, m.tgtPt ? 25 : 0)) {
      m.ph = 'dead';
      if (tj) { tj.st = 'hit'; tj.vz = 0; this.stats.lostA[tj.side]++; this.emit('kill_jet', m.p, tj.id, { type: tj.type, side: tj.side, by: m.type }); this.breakUp(tj); }
      else if (tm) { tm.ph = 'dead'; this.stats.bmShot++; this.emit('kill_bm', m.p, tm.id); for (const o of this.msls) if (o.tgtMsl === tm.id && o !== m) o.tgtMsl = undefined; for (let i = 0; i < 24; i++) this.debris.push({ p: { ...m.p }, vel: add(scl(tm.vel, .35), v((this.r() - .5) * 400, (this.r() - .5) * 400, (this.r() - .5) * 400)), t: 0, burn: i < 8 }); }
      else if (m.tgtPt) { this.groundBlast(m.p, 30, -1, 'harm'); const l = this.bats.flatMap(b => b.launchers).find(l2 => l2.alive && Math.hypot(l2.p.x - m.p.x, l2.p.y - m.p.y) < 60); if (l) { l.alive = false; this.emit('sam_kill', l.p); } }
      return;
    }
    if (m.miss && d2 > prevBest && prevBest < 3000) { m.ph = 'dead'; this.emit('selfdestruct', m.p, m.id, { miss: prevBest, tgt: tj?.type }); if (m.tgtPt) this.groundBlast({ ...m.p, z: 0 }, 25, -1, 'harm'); return; }
    if (m.p.z < 0) { m.ph = 'dead'; this.emit('ground', m.p, m.id); }
  }
  breakUp(j: Jet) {
    for (let i = 0; i < 9; i++) this.debris.push({ p: { ...j.p }, vel: add(v(Math.cos(j.hd) * j.spd * .6, Math.sin(j.hd) * j.spd * .6, 0), v((this.r() - .5) * 120, (this.r() - .5) * 120, this.r() * 80)), t: 0, burn: i < 4 });
    if (this.r() < .85) { this.chutes.push({ p: add(j.p, v(0, 0, 30)), t: 0, landed: 0 }); this.emit('eject_seat', j.p, j.id); }
  }
  // ---------- الأرض ----------
  stepGnd(g: Gnd, dt: number) {
    if (g.st === 'dead' || g.st === 'gone') return;
    const ty = GROUND[g.type];
    // الهجوم يبدأ بعد الإخماد والقصف (أو بعد 260 ث)
    if (g.side === 0 && g.type !== 'grad' && g.type !== 'truck' && !g.goal && this.t > 260) { const o = SITES.objective; g.goal = { x: o.x + (g.plt - 1) * 500 + (this.r() - .5) * 300, y: o.y + (g.plt - 1) * 400 + (this.r() - .5) * 300, z: 0 }; g.st = 'move'; if (!(this as any).adv) { (this as any).adv = 1; this.emit('advance', g.p, g.id); } }
    const foes = this.gnd.filter(q => q.side !== g.side && q.st !== 'dead' && q.st !== 'gone' && q.type !== 'truck'), near = foes.map(q => ({ q, d: Math.hypot(q.p.x - g.p.x, q.p.y - g.p.y) })).sort((a, b) => a.d - b.d)[0];
    // راجمات: رشقة على أكثف تجمّع للعدو
    if (g.type === 'grad') { g.reload -= dt; if (g.reload <= 0 && (g as any).shots !== 0 && this.t > (g.side ? 290 : 230) && near && near.d < ty.range) { (g as any).shots = ((g as any).shots ?? 3) - 1; g.reload = 90 + this.r() * 30; this.salvo(g, near.q.p); } return; }
    if (g.type === 'truck') { if (g.goal) { this.drive(g, g.goal, ty.speed, dt); if (Math.hypot(g.goal.x - g.p.x, g.goal.y - g.p.y) < 60) { g.goal = g.goal === (g as any).back ? null : (g as any).back; if (!g.goal) g.st = 'gone'; } } return; }
    const engaging = !!(near && ty.gun && near.d < ty.range), aimA = engaging ? Math.atan2(near!.q.p.y - g.p.y, near!.q.p.x - g.p.x) : g.hd, TR = TURRET_RATE[g.type] ?? .5;
    // البرج يلف بسرعته الحقيقية (أبرامز 42°/ث، T-72 24°/ث) مستقل عن الجسم
    g.turret = angd(g.turret + clamp(angd(aimA, g.turret) * 3, -TR, TR) * dt, 0);
    if (engaging) g.reload -= dt;
    // T-72 بموضعها: ترمي وترجع لورا من الحفرة، تتحرك على جنب وتطلع من مكان ثاني (shoot-and-scoot)
    if (g.man === 'back' || g.man === 'shift') {
      if (this.drive(g, g.manP!, g.man === 'back' ? 5 : ty.speed * .6, dt, true)) { if (g.man === 'back') { const s2 = g.plt % 2 ? 1 : -1; g.man = 'shift'; g.manP = { x: g.p.x + Math.cos(g.hd + Math.PI / 2 * s2) * 70 - Math.cos(g.hd) * 0, y: g.p.y + Math.sin(g.hd + Math.PI / 2 * s2) * 70, z: 0 }; } else { g.man = 'face'; } }
      return; }
    if (g.man === 'face') { const want = engaging ? aimA : Math.PI; this.stop(g, dt); g.hd = angd(g.hd + clamp(angd(want, g.hd), -.45 * dt, .45 * dt), 0); if (Math.abs(angd(want, g.hd)) < .1) { g.man = ''; g.dug = true; } return; }
    const aligned = engaging && Math.abs(angd(aimA, g.turret)) < .06;
    // رمي من توقف قصير: يفرمل لحد ما يوقف وبعدين يرمي
    const wantFire = engaging && g.reload <= 0 && aligned;
    if (wantFire && (Math.abs(g.spd) < 1 || (g.type === 'abrams' && Math.abs(g.spd) < 6))) {   /* أبرامز مدفعه مثبّت: يرمي وهو ماشي ببطء (WM15.2) */ g.reload = (g.type === 'abrams' ? 6 : 6.5) + this.r() * 3; this.shoot(g, near!.q, near!.d); g.manT = this.t + 1.5;
      if (g.side === 1 && g.dug && this.r() < .3) { g.dug = false; g.man = 'back'; g.manP = { x: g.p.x - Math.cos(g.hd) * 40, y: g.p.y - Math.sin(g.hd) * 40, z: 0 }; } return; }
    if (wantFire || this.t < g.manT) { this.stop(g, dt); return; }
    if (g.st === 'move' && g.goal) {
      // قفزات (bounding overwatch): فصيل يغطي واقف وفصيل يتقدم، يتبادلون كل 14 ث
      const halt = engaging && near!.d < ty.range * .85 && (g.plt + Math.floor(this.t / 14)) % 2 === 0;
      // تشكيل سهم: القائد يروح للهدف والباقين بأماكنهم ورا يمين/يسار
      const mates = this.gnd.filter(q => q.side === g.side && q.plt === g.plt && q.st === 'move' && q.type === g.type), rank = mates.indexOf(g), lead = mates[0];
      let goal = g.goal, vmax = ty.speed * (engaging ? .7 : 1);
      if (lead && lead !== g) { const ch = Math.cos(lead.hd), sh = Math.sin(lead.hd), back = 55 * Math.ceil(rank / 2), side = 60 * Math.ceil(rank / 2) * (rank % 2 ? 1 : -1); goal = { x: lead.p.x - ch * back - sh * side, y: lead.p.y - sh * back + ch * side, z: 0 }; vmax *= 1.25; if (Math.hypot(goal.x - g.p.x, goal.y - g.p.y) < 20) vmax = Math.abs(lead.spd); }
      if (halt) this.stop(g, dt); else this.drive(g, goal, vmax, dt);
      if (Math.hypot(g.goal.x - g.p.x, g.goal.y - g.p.y) < 80) g.st = 'idle'; }
    else this.stop(g, dt);
  }
  // سياقة دبابة: تسارع وفرملة، تلف بمكانها لما بطيئة وبنصف قطر لما سريعة، بدون انزلاق؛ تتجنب الجيران بالتوجيه؛ ترجع لورا لو الهدف خلفها وقريب
  drive(g: Gnd, goal: V3, vmax: number, dt: number, allowRev = false): boolean {
    const dx = goal.x - g.p.x, dy = goal.y - g.p.y, d = Math.hypot(dx, dy); if (d < 6) { this.stop(g, dt); return true; }
    let ax = dx / d, ay = dy / d;
    for (const q of this.gnd) { if (q === g || q.st === 'dead' || q.st === 'gone') continue; const ox = g.p.x - q.p.x, oy = g.p.y - q.p.y, od = Math.hypot(ox, oy); if (od < 55 && od > .1) { const w = (55 - od) / 55; ax += ox / od * w * 1.3; ay += oy / od * w * 1.3; } }
    const a = Math.atan2(ay, ax); let err = angd(a, g.hd); const rev = allowRev && Math.abs(err) > 2 && d < 150; g.rev = rev; if (rev) err = angd(a + Math.PI, g.hd);
    const w = Math.abs(g.spd) < 2.5 ? .45 : Math.min(.45, Math.abs(g.spd) / 10);
    g.hd = angd(g.hd + clamp(err * 1.8, -w, w) * dt, 0);
    let vt = (rev ? -Math.min(5, vmax) : vmax) * Math.max(0, Math.cos(err)); if (Math.abs(err) > 1.1) vt = 0; if (d < 40) vt *= d / 40;
    g.spd += clamp(vt - g.spd, -3.5 * dt, 1.6 * dt); g.p.x += Math.cos(g.hd) * g.spd * dt; g.p.y += Math.sin(g.hd) * g.spd * dt;
    return false;
  }
  stop(g: Gnd, dt: number) { g.spd -= clamp(g.spd, -3.5 * dt, 3.5 * dt); g.p.x += Math.cos(g.hd) * g.spd * dt; g.p.y += Math.sin(g.hd) * g.spd * dt; }
  shoot(g: Gnd, q: Gnd, d: number) {
    const M = MSL[GROUND[g.type].gun!], hitP = M.pk * (1 - d / 6000) * (q.dug ? .62 : 1) * (Math.abs(g.spd) > 1 ? .75 : 1) * (1 - GROUND[q.type].armor * .3) + (GROUND[g.type].gen - GROUND[q.type].gen) * .06;
    const hit = this.r() < hitP, tgt = hit ? { ...q.p } : { x: q.p.x + (this.r() - .5) * 60, y: q.p.y + (this.r() - .5) * 60, z: 0 };
    const m: Msl = { id: this.nid++, type: GROUND[g.type].gun!, side: g.side, p: { ...g.p, z: 2 }, vel: scl(norm(sub(tgt, g.p)), M.vmax), ph: 'coast', t: 0, tgtGnd: hit ? q.id : undefined, tgtPt: tgt, miss: !hit, bestD: 1e9, from: g.type };
    this.msls.push(m); this.emit('gun', g.p, g.id, { hd: g.turret, side: g.side });
  }
  salvo(g: Gnd, c: V3) { for (let i = 0; i < 12; i++) { const tgt = { x: c.x + (this.r() - .5) * 700, y: c.y + (this.r() - .5) * 500, z: 0 }, d = Math.hypot(tgt.x - g.p.x, tgt.y - g.p.y);
    (this as any).pending = [...((this as any).pending || []), { at: this.t + i * .5, go: () => { const m: Msl = { id: this.nid++, type: '122mm', side: g.side, p: { ...g.p, z: 2 }, vel: v(), ph: 'boost', t: 0, tgtPt: tgt, miss: true, bestD: 1e9, from: 'grad', plan: { dir: v(tgt.x - g.p.x, tgt.y - g.p.y, 0), k: d / 450, p0: { ...g.p, z: 2 } } }; this.msls.push(m); this.emit('rocket', g.p, m.id); } }]; } this.emit('salvo', g.p, g.id, { side: g.side }); }
  stepShell(m: Msl, dt: number) {
    if (m.type === '122mm') { const P = m.plan!, T = P.k, s = clamp(m.t / T, 0, 1); m.p = { x: P.p0.x + P.dir.x * s, y: P.p0.y + P.dir.y * s, z: 2 + Math.sin(Math.PI * s) * Math.hypot(P.dir.x, P.dir.y) * .22 }; if (s >= 1) { m.ph = 'dead'; m.p.z = 0; this.groundBlast(m.p, 25, -1, 'rocket'); } return; }
    m.p = add(m.p, m.vel, dt); const tp = m.tgtPt!; if (Math.hypot(tp.x - m.p.x, tp.y - m.p.y) < 40 || m.t > 3) { m.ph = 'dead'; m.p = { ...tp }; this.groundBlast(m.p, m.tgtGnd ? 12 : 6, m.tgtGnd ?? -1, 'shell'); }
  }
  groundBlast(p: V3, r: number, hitId: number, kind: string) {
    this.emit('blast', p, hitId, { r, kind });
    for (const g of this.gnd) { if (g.st === 'dead' || g.st === 'gone') continue; const d = Math.hypot(g.p.x - p.x, g.p.y - p.y); const kill = g.id === hitId || (kind === 'bomb' && d < 35) || (kind === 'rocket' && d < 18 && this.r() < .35);
      if (kill) { g.st = 'dead'; g.burnT = this.t; this.stats.lostG[g.side]++; this.emit('kill_gnd', g.p, g.id, { type: g.type, side: g.side }); if (g.side === 0 && this.nextReinf > 1e8) this.nextReinf = this.t + 45; } }
  }
  // تعزيزات (أبرامز من الخلف) + رتل إمداد شاحنات من المستودع للجبهة ويرجع
  stepReinf() {
    if (this.t < this.nextReinf) return; this.nextReinf = 1e9; const lost = this.gnd.filter(g => g.side === 0 && g.st === 'dead' && (g.type === 'abrams' || g.type === 'bmp')).length - this.stats.reinf; if (lost <= 0) return;
    const D = SITES.depot;
    for (let i = 0; i < Math.min(4, lost); i++) { const g = this.mkGnd('abrams', 0, { x: D.x - i * 70, y: D.y - i * 25, z: 0 }, -.1, 3); g.goal = { x: SITES.objective.x - 300 + i * 120, y: SITES.objective.y + 200, z: 0 }; g.st = 'move'; this.gnd.push(g); this.stats.reinf++; }
    for (let i = 0; i < 4; i++) { const t = this.mkGnd('truck', 0, { x: D.x - 400 - i * 60, y: D.y - 150 - i * 20, z: 0 }, -.1, 8); t.goal = { x: SITES.stage.x + 300, y: SITES.stage.y - 100 - i * 40, z: 0 }; (t as any).back = { x: D.x, y: D.y, z: 0 }; t.st = 'move'; this.gnd.push(t); }
    this.emit('reinforce', D, 0, { n: Math.min(4, lost) });
  }
}
