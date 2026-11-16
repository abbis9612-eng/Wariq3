// منطق المشهد المايل (I-058، D-031) بدون رسم: كل شي بالمتر والثانية الحقيقية. x شرق، y شمال، z فوق.
// حدث 1: S-400 (إطلاق بارد عمودي) على زوج F-16 قرب الأهواز. حدث 2: ذو الفقار من دزفول على البصرة، وباتريوت PAC-3 يعترضه.
// الأرقام من معلومات عامة [ASSUMPTION]: 48N6 يطّرد بالغاز ~30 م ثم يشتعل، يوصل ~2 كم/ث؛ PAC-3 حوالي 5 ماخ ويضرب ضربة مباشرة؛ F-16 ~260 م/ث.

export type V3 = { x: number; y: number; z: number };
export const v = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
const norm = (a: V3): V3 => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
const G = 9.81;

// ===== الجغرافيا: ميركاتور حول مرجع وسط المنطقة =====
export const REF = { lat: 31.5, lon: 48.5 };
const MX = (lon: number) => (lon + 180) / 360, MY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2;
export const MPU = 40075016 * Math.cos(REF.lat * Math.PI / 180);   // متر لكل وحدة ميركاتور قرب المرجع
export const toXY = (lat: number, lon: number) => ({ x: (MX(lon) - MX(REF.lon)) * MPU, y: -(MY(lat) - MY(REF.lat)) * MPU });
export const fromMerc = (mx: number, my: number) => ({ x: (mx - MX(REF.lon)) * MPU, y: -(my - MY(REF.lat)) * MPU });
export const SITES = { s400: toXY(31.30, 48.80), zolf: toXY(32.42, 48.45), pat: toXY(30.58, 47.72), basra: toXY(30.50, 47.81) };
export const HEAD = { s400: 20, zolf: 205 };   // نفس اتجاه الصور المخبوزة (درجات)

// ===== رقم عشوائي ثابت (نفس المشهد كل مرة إلا إذا غيّرنا البذرة) =====
export function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export interface Jet { id: number; name: string; p: V3; hd: number; pitch: number; spd: number; bank: number; st: 'ingress' | 'break' | 'notch' | 'egress' | 'hit' | 'gone'; t0: number; vz: number; roll: number }
export interface Msl { id: number; kind: 'sam' | 'pac' | 'bm'; p: V3; vel: V3; ph: 'eject' | 'boost' | 'coast' | 'dead'; t: number; burn: number; acc: number; tgtJet?: number; tgtMsl?: number; miss: boolean; bestD: number; from: string; lastT?: V3; lastP?: V3; lostAt?: number }
export interface Ev { t: number; type: string; p: V3; id?: number; data?: any }
export interface Debris { p: V3; vel: V3; t: number; life: number; burn: boolean }

export class World {
  t = 0; ev: Ev[] = []; jets: Jet[] = []; msls: Msl[] = []; debris: Debris[] = []; chute: { p: V3; t: number } | null = null; nid = 1;
  s400 = { p: { ...SITES.s400, z: 0 }, raise: 0, raiseT: 2, fired: 0, nextFire: 0 };
  zolf = { p: { ...SITES.zolf, z: 0 }, erect: 0, erectT: -1, fired: false };
  pat = { p: { ...SITES.pat, z: 0 }, fired: 0, az: 0 };
  bmPlan: { v0: V3; tb: number; k: number } | null = null; bmT0 = -1; phase = 'air'; endT = -1;
  seed: number; patriotOn: boolean;
  constructor(seed = 7, patriotOn = true) {
    this.seed = seed; this.patriotOn = patriotOn;
    const s = this.s400.p;
    this.jets.push(this.jet('lead', add(s, v(-47000, 4200, 6100))), this.jet('wing', add(s, v(-48600, 2600, 5900))));
  }
  jet(name: string, p: V3): Jet { return { id: this.nid++, name, p, hd: -.06, pitch: 0, spd: 262, bank: 0, st: 'ingress', t0: 0, vz: 0, roll: 0 }; }
  emit(type: string, p: V3, id?: number, data?: any) { this.ev.push({ t: this.t, type, p: { ...p }, id, data }); }
  get lead() { return this.jets[0]; } get wing() { return this.jets[1]; }

  step(dt: number) {
    this.t += dt;
    this.stepS400(dt); this.stepJets(dt);
    if (this.phase === 'air' && this.endT < 0 && this.s400.fired === 2 && !this.msls.some(m => m.kind === 'sam' && m.ph !== 'dead')) this.endT = this.t + 10; this.stepZolf(dt); this.stepPatriot();
    for (const m of this.msls) if (m.ph !== 'dead') this.stepMsl(m, dt);
    for (const d of this.debris) { d.t += dt; d.vel.z -= G * dt; d.vel = add(d.vel, d.vel, -.08 * dt); d.p = add(d.p, d.vel, dt); if (d.p.z < 0) { d.p.z = 0; d.vel = v(); if (d.burn) { d.burn = false; this.emit('debris_land', d.p); } } }
    if (this.chute) { this.chute.t += dt; this.chute.p.z = Math.max(0, this.chute.p.z - (this.chute.t < 2 ? 40 : 6) * dt); this.chute.p.x += 4 * dt; }
  }
  // ---------- S-400: رفع الأنابيب ثم إطلاق بارد ----------
  stepS400(dt: number) {
    const s = this.s400; if (this.t > s.raiseT) s.raise = Math.min(1, (this.t - s.raiseT) / 9);
    if (s.raise >= 1 && s.fired < 2 && this.t >= s.nextFire) {
      const tgt = s.fired === 0 ? this.lead : this.wing, r = len(sub(tgt.p, s.p));
      if (r < 40000) { this.launchSam(tgt, s.fired === 1); s.fired++; s.nextFire = this.t + 4; }
    }
  }
  launchSam(tgt: Jet, miss: boolean) {
    // 4 أنابيب ورا الشاحنة؛ الصاروخ يطلع من أنبوب حسب الرقم
    const k = this.s400.fired, h = HEAD.s400 * Math.PI / 180, back = -6.2, side = (k % 2 ? .65 : -.65);
    const p = add(this.s400.p, v(Math.cos(h) * back - Math.sin(h) * side, Math.sin(h) * back + Math.cos(h) * side, 8.5));
    const m: Msl = { id: this.nid++, kind: 'sam', p, vel: v(0, 0, 33), ph: 'eject', t: 0, burn: 11, acc: 175, tgtJet: tgt.id, miss, bestD: 1e9, from: 's400' };
    this.msls.push(m); this.emit('sam_eject', p, m.id);
  }
  // ---------- الطيارات ----------
  stepJets(dt: number) {
    for (const j of this.jets) {
      if (j.st === 'gone') continue;
      if (j.st === 'hit') { j.roll += dt * 2.2; j.vz -= G * dt * .9; j.spd *= 1 - .12 * dt; j.p = add(j.p, v(Math.cos(j.hd) * j.spd, Math.sin(j.hd) * j.spd, j.vz), dt); if (j.p.z <= 0) { j.p.z = 0; j.st = 'gone'; this.emit('crash', j.p, j.id); } continue; }
      const threat = this.msls.find(m => m.tgtJet === j.id && m.ph !== 'dead');
      let want = j.hd, turnRate = .08, wantZ = j.p.z;
      if (threat && j.st === 'ingress' && threat.t > 2.5) { j.st = j.name === 'lead' ? 'break' : 'notch'; j.t0 = this.t; this.emit(j.name === 'lead' ? 'rwr_break' : 'rwr_notch', j.p, j.id); }
      if (j.st === 'ingress') want = Math.atan2(this.s400.p.y - j.p.y, this.s400.p.x - j.p.x) + .35;   // داخلة على هدف شمال الموقع
      else if (j.st === 'break') { const m = threat; want = m ? Math.atan2(m.p.y - j.p.y, m.p.x - j.p.x) + Math.PI * .62 : j.hd; turnRate = .29; wantZ = 2500; }   // لفة حادة 7g ونزول
      else if (j.st === 'notch') { const m = threat; want = m ? Math.atan2(m.p.y - j.p.y, m.p.x - j.p.x) - Math.PI / 2 : j.hd; turnRate = .3; wantZ = 1200;   // يخلي الصاروخ على جنبه (يعمي الرادار) وينزل
        if (!m && this.t - j.t0 > 6) { j.st = 'egress'; } }
      else if (j.st === 'egress') { want = Math.PI; turnRate = .2; wantZ = 900; }
      const d = Math.atan2(Math.sin(want - j.hd), Math.cos(want - j.hd)), dh = clamp(d, -turnRate * dt, turnRate * dt);
      j.hd += dh; j.bank += (clamp(dh / dt / .3, -1.3, 1.3) - j.bank) * Math.min(1, dt * 3);
      j.vz += (clamp((wantZ - j.p.z) * .15, -110, 60) - j.vz) * Math.min(1, dt * 1.5);
      j.p = add(j.p, v(Math.cos(j.hd) * j.spd, Math.sin(j.hd) * j.spd, j.vz), dt);
      // مشاعل وشرائح تشويش لما الصاروخ يقرب
      if (threat && len(sub(threat.p, j.p)) < 7000 && Math.floor(this.t * 4) !== Math.floor((this.t - dt) * 4)) this.emit('cm', j.p, j.id, { hd: j.hd });
      if (j.st === 'egress' && len(sub(j.p, this.s400.p)) > 70000) j.st = 'gone';
    }
  }
  // ---------- توجيه الصواريخ ----------
  stepMsl(m: Msl, dt: number) {
    m.t += dt;
    if (m.kind === 'bm') return this.stepBM(m, dt);
    if (m.ph === 'eject') { // بالغاز بدون نار: يطلع ويتباطأ
      m.vel.z -= G * dt; m.p = add(m.p, m.vel, dt);
      if (m.t >= .95) { m.ph = 'boost'; m.t = 0; this.emit('ignite', m.p, m.id); }
      return;
    }
    const tj = m.tgtJet ? this.jets.find(j => j.id === m.tgtJet && j.st !== 'gone' && j.st !== 'hit') : null;
    const tm = m.tgtMsl ? this.msls.find(b => b.id === m.tgtMsl && b.ph !== 'dead') : null;
    const tgtP = tj ? tj.p : tm ? tm.p : null, tgtV = tj ? v(Math.cos(tj.hd) * tj.spd, Math.sin(tj.hd) * tj.spd, tj.vz) : tm ? tm.vel : v();
        if (m.t < m.burn) m.vel = add(m.vel, norm(len(m.vel) === 0 ? v(0, 0, 1) : m.vel), m.acc * dt);
    else m.vel = add(m.vel, m.vel, -.035 * dt);
    if (m.ph === 'boost' && m.t >= m.burn) { m.ph = 'coast'; this.emit('burnout', m.p, m.id); }
    m.vel.z -= G * dt * .3;   // الجناح يرفع أغلب الوزن
    if (tgtP) {
      let aim = tgtP;
      const r = sub(tgtP, m.p), dist = len(r);
      if (m.miss && dist < 9000) aim = add(tgtP, norm(cross(r, v(0, 0, 1))), 900);   // تشويش/مراوغة: يروح على أثر كاذب
      // ميلان أولي بالغاز (S-400): ~1.5 ث يلف صوب الهدف بسرعة
      if ((m.kind === 'sam' && m.t < 1.6) || (m.kind === 'pac' && m.t < .8)) { if (m.kind === 'sam') { const want = norm(add(norm(sub(aim, m.p)), v(0, 0, .55))); const u = norm(m.vel), s2 = len(m.vel), k = Math.min(1, 2.4 * dt), nu = norm(add(u, sub(want, u), k)); m.vel = { x: nu.x * s2, y: nu.y * s2, z: nu.z * s2 }; } }
      else {
        // توجيه تناسبي (N=4) بحد أقصى للانعطاف
        const rel = sub(aim, m.p), vr = sub(tgtV, m.vel), R2 = Math.max(1, dot(rel, rel)), om = cross(rel, vr), om2 = { x: om.x / R2, y: om.y / R2, z: om.z / R2 };
        const N = m.kind === 'pac' ? 5 : 4, rh = norm(rel), Vc = Math.max(200, -dot(vr, rh)); let acc = cross(om2, rh); acc = { x: acc.x * N * Vc, y: acc.y * N * Vc, z: acc.z * N * Vc };   // PN حقيقي: a = N·Vc·(Ω×r̂)
        if (tm && tm.ph === 'coast') { const u = norm(m.vel), at = v(0, 0, -G), ap = add(at, u, -dot(at, u)); acc = add(acc, ap, N / 2); }   // PN معزّز: يحسب حساب جاذبية الهدف
        const amax = (m.kind === 'pac' ? 60 : 30) * G, al = len(acc); if (al > amax) acc = { x: acc.x * amax / al, y: acc.y * amax / al, z: acc.z * amax / al };
        // تحميل للأعلى بالمسافات البعيدة (يطير أعلى وينزل على الهدف)
        if (m.kind === 'sam' && dist > 15000) acc.z += 12;
        const s2 = len(m.vel); m.vel = add(m.vel, acc, dt); const s3 = len(m.vel) || 1; m.vel = { x: m.vel.x * s2 / s3, y: m.vel.y * s2 / s3, z: m.vel.z * s2 / s3 };
      }
      const prevBest = m.bestD, p0 = { ...m.p }; m.p = add(m.p, m.vel, dt);
      const r0 = m.lastT && m.lastP ? sub(m.lastT, m.lastP) : sub(tgtP, p0), r1 = sub(tgtP, m.p), dr = sub(r1, r0), dd = dot(dr, dr), sc = dd > 0 ? clamp(-dot(r0, dr) / dd, 0, 1) : 1, d2 = len(add(r0, dr, sc));
      m.lastT = { ...tgtP }; m.lastP = { ...m.p }; m.bestD = Math.min(m.bestD, d2);
      const fuze = m.kind === 'pac' ? 6 : 16;
      if (!m.miss && d2 < fuze) {
        m.ph = 'dead';
        if (tj) { tj.st = 'hit'; tj.vz = 0; this.emit('kill_jet', m.p, tj.id); this.breakUp(tj); }
        if (tm) { tm.ph = 'dead'; this.emit('kill_bm', m.p, tm.id); for (const o of this.msls) if (o.tgtMsl === tm.id && o !== m && o.ph !== 'dead') { o.tgtMsl = undefined; } this.endT = this.t + 8; for (let i = 0; i < 26; i++) this.debris.push({ p: { ...m.p }, vel: add(tm.vel, v((Math.random() - .5) * 400, (Math.random() - .5) * 400, (Math.random() - .5) * 400), .35), t: 0, life: 60, burn: i < 8 }); }
        return;
      }
      if (m.miss && d2 > prevBest && prevBest < 3000) { m.ph = 'dead'; this.emit('selfdestruct', m.p, m.id, { miss: prevBest }); return; }
    } else { m.p = add(m.p, m.vel, dt); m.lostAt ??= this.t; if (this.t - m.lostAt > 1.6) { m.ph = 'dead'; this.emit('selfdestruct', m.p, m.id); } }
    if (m.p.z < 0) { m.ph = 'dead'; this.emit('ground', m.p, m.id); }
  }
  breakUp(j: Jet) {
    for (let i = 0; i < 9; i++) this.debris.push({ p: { ...j.p }, vel: add(v(Math.cos(j.hd) * j.spd * .6, Math.sin(j.hd) * j.spd * .6, 0), v((Math.random() - .5) * 120, (Math.random() - .5) * 120, Math.random() * 80)), t: 0, life: 90, burn: i < 4 });
    // الطيار يقفز: كرسي لفوق ثم مظلة
    this.chute = { p: add(j.p, v(0, 0, 30)), t: 0 }; this.emit('eject_seat', j.p, j.id);
  }
  // ---------- ذو الفقار ----------
  stepZolf(dt: number) {
    const z = this.zolf;
    if (z.erectT < 0 && this.endT > 0 && this.phase === 'air' && this.t > this.endT) { this.phase = 'bm'; this.endT = -1; z.erectT = this.t; this.emit('bm_erect', z.p); }
    if (z.erectT >= 0) z.erect = Math.min(1, (this.t - z.erectT) / 8);
    if (z.erect >= 1 && !z.fired) { z.fired = true; this.launchBM(); }
  }
  launchBM() {
    const z = this.zolf, h = HEAD.zolf * Math.PI / 180;
    const p = add(z.p, v(-Math.cos(h) * 7.6, -Math.sin(h) * 7.6, 2));   // الصاروخ واقف ورا المنصة
    if (!this.bmPlan) this.bmPlan = World.planBM(p, { ...SITES.basra, z: 0 });
    const m: Msl = { id: this.nid++, kind: 'bm', p, vel: v(0, 0, 0), ph: 'boost', t: 0, burn: this.bmPlan.tb, acc: 0, miss: false, bestD: 1e9, from: 'zolf' };
    this.msls.push(m); this.bmT0 = this.t; this.emit('bm_launch', p, m.id);
  }
  // مسار الباليستي: صعود عمودي 8 ث، ميلان تدريجي لزاوية 45° لحد نهاية الحرق، بعدين قذيفة بالجاذبية. نحل سرعة الحرق حتى يوصل الهدف
  static bmBoost(p0: V3, dir: V3, k: number, t: number, dt = .05) {
    let p = { ...p0 }, vel = v(0, 0, 0); const tb = 26;
    for (let s = 0; s < t && s < tb; s += dt) {
      const pitch = s < 6 ? Math.PI / 2 : Math.PI / 2 - (Math.PI / 2 - .55) * Math.min(1, Math.pow((s - 6) / 16, .8));   // عمودي 6 ث ثم ميلان لحد ~32°
      const a = 27 * k * (1 + s / tb * .8), u = v(dir.x * Math.cos(pitch), dir.y * Math.cos(pitch), Math.sin(pitch));
      vel = add(vel, add(u, v(0, 0, 0), 1), a * dt); vel.z -= G * dt; p = add(p, vel, dt);
    }
    return { p, vel, tb };
  }
  static planBM(p0: V3, tgt: V3) {
    const dir = norm(v(tgt.x - p0.x, tgt.y - p0.y, 0)), D = Math.hypot(tgt.x - p0.x, tgt.y - p0.y);
    let lo = .5, hi = 3, k = 1;
    for (let it = 0; it < 40; it++) { k = (lo + hi) / 2; const b = World.bmBoost(p0, dir, k, 99); const r = World.ballisticRange(b.p, b.vel); const done = Math.hypot(b.p.x - p0.x, b.p.y - p0.y) + r; if (done < D) lo = k; else hi = k; }
    return { v0: dir, tb: 26, k };
  }
  static ballisticRange(p: V3, vel: V3) { // مسافة أفقية للسقوط من p بسرعة vel (بدون هوا)
    const vz = vel.z, tFall = (vz + Math.sqrt(vz * vz + 2 * G * p.z)) / G; return Math.hypot(vel.x, vel.y) * tFall;
  }
  stepBM(m: Msl, dt: number) {
    const plan = this.bmPlan!;
    if (m.t < plan.tb) { const b = World.bmBoost(this.zolfLaunchP(), plan.v0, plan.k, m.t); m.p = b.p; m.vel = b.vel; }
    else { if (m.ph === 'boost') { m.ph = 'coast'; this.emit('bm_burnout', m.p, m.id); } m.vel.z -= G * dt; m.p = add(m.p, m.vel, dt); }
    if (m.p.z < 0 && m.t > 5) { m.ph = 'dead'; this.emit('bm_impact', { ...m.p, z: 0 }, m.id); this.endT = this.t + 8; }
  }
  zolfLaunchP() { const h = HEAD.zolf * Math.PI / 180; return add(this.zolf.p, v(-Math.cos(h) * 7.6, -Math.sin(h) * 7.6, 2)); }
  // ---------- باتريوت: يرمي صاروخين على الباليستي النازل ----------
  stepPatriot() {
    if (!this.patriotOn) return;
    const bm = this.msls.find(m => m.kind === 'bm' && m.ph !== 'dead'); if (!bm || bm.vel.z > -200) return;
    // وقت الوصول للأرض تقريباً
    const tgo = (bm.vel.z + Math.sqrt(bm.vel.z * bm.vel.z + 2 * G * bm.p.z)) / G;
    if (this.pat.fired < 2 && bm.p.z < 52000 && tgo < 34 + this.pat.fired && (this.pat.fired === 0 || this.t > this.pat.az)) {
      const a = Math.atan2(bm.p.y - this.pat.p.y, bm.p.x - this.pat.p.x), el = 38 * Math.PI / 180, k = this.pat.fired;
      const p = add(this.pat.p, v(Math.cos(a) * -2, Math.sin(a) * -2, 4.5));
      const m: Msl = { id: this.nid++, kind: 'pac', p, vel: v(Math.cos(a) * Math.cos(el) * 60, Math.sin(a) * Math.cos(el) * 60, Math.sin(el) * 60), ph: 'boost', t: 0, burn: 7, acc: 230, tgtMsl: bm.id, miss: k === 1, bestD: 1e9, from: 'pat' };
      this.msls.push(m); this.pat.fired++; this.pat.az = this.t + 1.1; this.emit('pac_launch', p, m.id, { az: a });
    }
  }
}
