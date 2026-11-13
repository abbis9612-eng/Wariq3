// منطق «مسرح العمليات — بغداد» بدون رسم. كل الوحدات: متر، ثانية. x شرق، z شمال، y للأعلى.
// المحاكاة تكتب «أحداث مؤثرات» (fx) والرسم يقراها؛ حتى نگدر نفحص المعركة كلها بـ Node.

export type V3 = [number, number, number];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const dist2d = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** دوران حول y بنفس اتجاه Babylon (rotation.y) */
export const rotY = (v: V3, a: number): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
/** زاوية yaw تخلي +z المحلي يأشر على الاتجاه d */
export const yawOf = (d: V3) => Math.atan2(d[0], d[2]);

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ===== الجغرافيا: بغداد مبسّطة =====
/** مركز نهر دجلة (x) عند خط عرض z */
export const riverX = (z: number) => 900 * Math.sin(z / 2300 + 0.6) + 380 * Math.sin(z / 870 + 2.1) + 250;
export const RIVER_W = (z: number) => 330 + 60 * Math.sin(z / 1500);
export const HIGHWAY_Z = -800; // طريق أبو غريب السريع (من الغرب للشرق)
export interface Site { id: string; name: string; p: V3 }
export const SITES: Site[] = [
  { id: 'airport', name: 'مطار بغداد الدولي', p: [-6300, 0, -1700] },
  { id: 'green', name: 'المنطقة الخضراء', p: [riverX(-300) - 250, 0, -300] },
  { id: 'dora', name: 'مصفى الدورة', p: [1700, 0, -3300] },
  { id: 'rasheed', name: 'معسكر الرشيد', p: [3600, 0, -4400] },
  { id: 'taji', name: 'معسكر التاجي', p: [-2200, 0, 6900] },
];
export const site = (id: string) => SITES.find(s => s.id === id)!;

// ===== الوحدات الأرضية =====
export type Side = 'iq' | 'en';
export type Kind = 'abrams' | 't72' | 'technical' | 'dshk' | 'd30' | 'grad' | 'patriot';
export const KIND_AR: Record<Kind, string> = { abrams: 'أبرامز M1A1', t72: 'T-72B3', technical: 'بيكب دوشكا', dshk: 'دوشكا 12.7', d30: 'مدفع D-30', grad: 'راجمة غراد BM-21', patriot: 'باتريوت' };
export const SIDE_AR: Record<Side, string> = { iq: 'العراق', en: 'العدو' };
interface KindSpec { hp: number; range: number; reload: number; speed: number; aa: number; armor: number }
const SPEC: Record<Kind, KindSpec> = {
  abrams: { hp: 3, range: 3200, reload: 7, speed: 9, aa: 0, armor: 1 },
  t72: { hp: 2, range: 2600, reload: 8.5, speed: 9, aa: 0, armor: 1 },
  technical: { hp: 1, range: 1500, reload: 1.3, speed: 14, aa: 1500, armor: 0 },
  dshk: { hp: 1, range: 1500, reload: 1.1, speed: 0, aa: 1400, armor: 0 },
  d30: { hp: 1, range: 15000, reload: 6, speed: 0, aa: 0, armor: 0 },
  grad: { hp: 1, range: 20000, reload: 999, speed: 0, aa: 0, armor: 0 },
  patriot: { hp: 2, range: 0, reload: 0, speed: 0, aa: 0, armor: 0 },
};
export interface Unit {
  id: number; kind: Kind; side: Side; name: string; group: string; p: V3; yaw: number; hp: number; alive: boolean;
  cd: number; target: number; path?: V3[]; pi: number; moving: boolean; retreat: boolean; burnT: number;
}
// ===== الأجسام الطائرة =====
export type AirKind = 'shahed' | 'kh101' | 'pac2' | 'rocket' | 'shell';
export const AIR_AR: Record<AirKind, string> = { shahed: 'شاهد-136', kh101: 'كروز Kh-101', pac2: 'معترض PAC-2', rocket: 'صاروخ غراد', shell: 'قذيفة 122 ملم' };
export interface Air {
  id: number; kind: AirKind; side: Side; p: V3; v: V3; alive: boolean; t: number;
  aim: V3; siteName?: string; tgtAir?: number; miss: number; dive?: boolean; shotsAt: number;
}
// ===== أحداث للرسم والسجل =====
export type Fx =
  | { k: 'muzzle'; p: V3; dir: V3; big: boolean }
  | { k: 'tracer'; a: V3; b: V3; n: number }
  | { k: 'boom'; p: V3; size: number; air: boolean }
  | { k: 'launch'; p: V3; dir: V3 }
  | { k: 'kill'; unit: number }
  | { k: 'mark'; p: V3; text: string; good: boolean };
export interface LogLine { t: number; text: string; good: boolean | null; p: V3 }

export interface World {
  T: number; units: Unit[]; air: Air[]; fx: Fx[]; log: LogLine[]; r: () => number; nextId: number;
  stats: { drones: number; dronesDown: number; dronesHit: number; cruise: number; cruiseDown: number; cruiseHit: number;
    enTanks: number; enTanksLost: number; iqTanks: number; iqTanksLost: number; pacFired: number; rockets: number; shells: number };
  schedule: { t: number; f: (w: World) => void; done?: boolean }[];
  over: boolean;
}

// ===== بناء المشهد =====
export const PATRIOT_POS: V3 = [-1500, 0, 2700];
export const PATRIOT_YAW = yawOf(norm([-0.62, 0, 0.78])) - yawOf([-1, 0, 0]); // الفوهات (−x محلياً) تتجه للشمال الغربي
export const PATRIOT_MUZZLES: V3[] = [[6.3, 8.9, 0.55], [6.3, 8.9, -0.55], [6.1, 7.5, 0.55], [6.1, 7.5, -0.55]];
export const PATRIOT_LAUNCH_LOCAL: V3 = norm([-0.854, 0.52, 0]);
const WEST: V3 = [-1, 0, 0], EAST: V3 = [1, 0, 0];

export function newWorld(seed = 11): World {
  const w: World = {
    T: 0, units: [], air: [], fx: [], log: [], r: rng(seed), nextId: 1, schedule: [], over: false,
    stats: { drones: 0, dronesDown: 0, dronesHit: 0, cruise: 0, cruiseDown: 0, cruiseHit: 0, enTanks: 0, enTanksLost: 0, iqTanks: 0, iqTanksLost: 0, pacFired: 0, rockets: 0, shells: 0 },
  };
  const U = (kind: Kind, side: Side, p: V3, dir: V3, group: string, extra: Partial<Unit> = {}) => {
    const u: Unit = { id: w.nextId++, kind, side, name: KIND_AR[kind], group, p: [...p] as V3, yaw: yawOf(dir), hp: SPEC[kind].hp, alive: true, cd: 1 + w.r() * 3, target: 0, pi: 0, moving: false, retreat: false, burnT: 0, ...extra };
    w.units.push(u); return u;
  };
  // --- العراق: خط دفاع غربي على طريق أبو غريب ---
  [-1000, -780, -560].forEach(z => U('abrams', 'iq', [-4300, 0, z], WEST, 'خط الأبرامز'));
  U('dshk', 'iq', [-3950, 0, HIGHWAY_Z - 150], WEST, 'سيطرة أبو غريب'); U('dshk', 'iq', [-3950, 0, HIGHWAY_Z + 150], WEST, 'سيطرة أبو غريب');
  U('technical', 'iq', [-3800, 0, HIGHWAY_Z - 40], WEST, 'سيطرة أبو غريب');
  U('d30', 'iq', [-2500, 0, -1500], WEST, 'كتيبة مدفعية'); U('d30', 'iq', [-2500, 0, -1250], WEST, 'كتيبة مدفعية');
  // دفاع جوي قصير داخل المدينة (دوشكات على بيكبات ضد المسيّرات)
  U('technical', 'iq', add(site('green').p, [-180, 0, 140]), [0, 0, 1], 'دفاع المنطقة الخضراء');
  U('technical', 'iq', add(site('dora').p, [-220, 0, 160]), [0, 0, 1], 'دفاع الدورة');
  U('technical', 'iq', add(site('airport').p, [1000, 0, -350]), WEST, 'دفاع المطار');
  U('patriot', 'iq', PATRIOT_POS, [0, 0, 1], 'بطارية باتريوت', { yaw: PATRIOT_YAW });
  // --- العدو: رتل مدرّع على الطريق السريع + راجمات ---
  const path: V3[] = [[-9600, 0, HIGHWAY_Z], [-3300, 0, HIGHWAY_Z]];
  ['t72', 't72', 'technical', 't72', 't72', 'technical'].forEach((k, i) =>
    U(k as Kind, 'en', [-7700 - i * 75, 0, HIGHWAY_Z + (i % 2 ? 9 : -9)], EAST, 'رتل مدرّع معادي', { path: [...path], moving: true }));
  U('grad', 'en', [-8800, 0, -2300], EAST, 'راجمات العدو'); U('grad', 'en', [-8750, 0, -2420], EAST, 'راجمات العدو');
  w.stats.enTanks = w.units.filter(u => u.side === 'en' && u.kind === 't72').length;
  w.stats.iqTanks = w.units.filter(u => u.side === 'iq' && u.kind === 'abrams').length;

  // --- جدول الهجمات الجوية ---
  const droneWave = (t: number, list: [number, string][]) => w.schedule.push({ t, f: (w) => list.forEach(([bearing, sid], i) => {
    const s = site(sid), dir: V3 = [Math.sin(bearing), 0, Math.cos(bearing)], start = add(s.p, scale(dir, 3300 + i * 260));
    start[1] = 140 + w.r() * 40;
    spawnAir(w, 'shahed', 'en', start, scale(norm(sub(s.p, start)), 52), s.p, s.name);
    w.stats.drones++;
  }) });
  const D = (deg: number) => deg * Math.PI / 180;
  droneWave(4, [[D(-70), 'airport'], [D(-60), 'green'], [D(-80), 'dora'], [D(-50), 'airport']]);
  droneWave(40, [[D(-120), 'dora'], [D(-35), 'green'], [D(-100), 'rasheed'], [D(-25), 'taji']]);
  const cruise = (t: number, sid: string, deg: number) => w.schedule.push({ t, f: (w) => {
    const s = site(sid), dir: V3 = [Math.sin(D(deg)), 0, Math.cos(D(deg))], start = add(s.p, scale(dir, 15500));
    start[1] = 70; spawnAir(w, 'kh101', 'en', start, scale(norm(sub(s.p, start)), 235), s.p, s.name); w.stats.cruise++;
    w.log.push({ t: w.T, text: `رادار الباتريوت رصد ${AIR_AR.kh101} متجه نحو ${s.name}`, good: null, p: start });
  } });
  cruise(26, 'green', -48); cruise(31, 'dora', -60); cruise(36, 'taji', -30);
  // راجمات الغراد: رشقتين على خط الأبرامز
  const salvo = (t: number) => w.schedule.push({ t, f: (w) => {
    w.units.filter(u => u.kind === 'grad' && u.alive).forEach((g, gi) => {
      for (let i = 0; i < 16; i++) w.schedule.push({ t: w.T + i * 0.35 + gi * 0.17, f: (w) => { if (g.alive) fireRocket(w, g); } });
    });
    w.log.push({ t: w.T, text: 'راجمات الغراد المعادية فتحت النار على خط الدفاع', good: false, p: [-8800, 0, -2300] });
  } });
  salvo(22); salvo(58);
  return w;
}

function spawnAir(w: World, kind: AirKind, side: Side, p: V3, v: V3, aim: V3, siteName?: string, tgtAir?: number) {
  const a: Air = { id: w.nextId++, kind, side, p: [...p] as V3, v, alive: true, t: 0, aim: [...aim] as V3, siteName, tgtAir, miss: 1e9, shotsAt: 0 };
  w.air.push(a); return a;
}
function fireRocket(w: World, g: Unit) {
  // هدف عشوائي حول خط الأبرامز/السيطرة (بقعة 500×300 م)
  const aim: V3 = [-4150 + (w.r() - 0.5) * 520, 0, HIGHWAY_Z + (w.r() - 0.5) * 620];
  const from: V3 = add(g.p, [0, 3, 0]), d = dist2d(from, aim), tf = 14 + w.r() * 2;
  const vh = d / tf, vy = 0.5 * 9.81 * tf; // قذف بالستي يوصل بعد tf ثانية
  const dir = norm([aim[0] - from[0], 0, aim[2] - from[2]]);
  spawnAir(w, 'rocket', 'en', from, [dir[0] * vh, vy, dir[2] * vh], aim);
  w.fx.push({ k: 'launch', p: from, dir: norm([dir[0] * vh, vy, dir[2] * vh]) }); w.stats.rockets++;
}
function fireShell(w: World, u: Unit, tgt: Unit) {
  const lead = tgt.moving && !tgt.retreat ? scale(EAST, SPEC[tgt.kind].speed * 8) : [0, 0, 0] as V3;
  const aim = add(add(tgt.p, lead), [(w.r() - 0.5) * 120, 0, (w.r() - 0.5) * 120]);
  const from: V3 = add(u.p, [0, 2, 0]), d = dist2d(from, aim), tf = 9 + d / 900;
  const vh = d / tf, vy = 0.5 * 9.81 * tf, dir = norm([aim[0] - from[0], 0, aim[2] - from[2]]);
  spawnAir(w, 'shell', 'iq', from, [dir[0] * vh, vy, dir[2] * vh], aim);
  w.fx.push({ k: 'muzzle', p: add(u.p, scale(dir, 4)), dir: norm([dir[0], 0.6, dir[2]]), big: true }); w.stats.shells++;
}

// ===== أدوات القتال =====
const enemiesOf = (w: World, u: Unit) => w.units.filter(o => o.alive && o.side !== u.side && o.kind !== 'patriot');
function damage(w: World, u: Unit, amount: number, by: string) {
  if (!u.alive) return;
  u.hp -= amount;
  if (u.hp <= 0) {
    u.alive = false; u.moving = false; u.burnT = w.T;
    w.fx.push({ k: 'kill', unit: u.id }, { k: 'boom', p: add(u.p, [0, 1.5, 0]), size: u.kind === 'abrams' || u.kind === 't72' ? 1.4 : 0.9, air: false });
    if (u.kind === 't72') w.stats.enTanksLost++;
    if (u.kind === 'abrams') w.stats.iqTanksLost++;
    const good = u.side === 'en';
    w.log.push({ t: w.T, text: `${by} دمّرت ${u.name} ${good ? 'معادية' : 'عراقية'}`, good, p: u.p });
    w.fx.push({ k: 'mark', p: add(u.p, [0, 10, 0]), text: good ? `💥 ${u.name}` : `✗ ${u.name}`, good });
  }
}
function blast(w: World, p: V3, rSoft: number, rHard: number, dmgSoft: number, dmgHard: number, by: string, side: Side) {
  for (const u of w.units) {
    if (!u.alive || u.side === side) continue;
    const d = dist2d(u.p, p), hard = SPEC[u.kind].armor > 0;
    if (hard ? d < rHard : d < rSoft) damage(w, u, hard ? dmgHard : dmgSoft, by);
  }
}

// ===== خطوة المحاكاة =====
export function step(w: World, dt: number) {
  w.T += dt;
  for (const s of w.schedule) if (!s.done && w.T >= s.t) { s.done = true; s.f(w); }
  stepGround(w, dt);
  stepAir(w, dt);
  // نهاية: الجو خلص والرتل انتهى أو انسحب
  const enAir = w.air.some(a => a.alive && a.side === 'en'), pending = w.schedule.some(s => !s.done);
  const column = w.units.filter(u => u.side === 'en' && u.group === 'رتل مدرّع معادي' && u.alive && !(u.retreat && u.p[0] < -7600));
  if (!w.over && w.T > 60 && !enAir && !pending && column.length === 0 && !w.air.some(a => a.alive && a.kind !== 'shell')) {
    w.over = true; w.log.push({ t: w.T, text: 'انتهت المعركة: الهجوم انصد', good: true, p: [0, 0, 0] });
  }
}

function stepGround(w: World, dt: number) {
  const col = w.units.filter(u => u.side === 'en' && u.group === 'رتل مدرّع معادي');
  const colAlive = col.filter(u => u.alive), tanksLeft = colAlive.filter(u => u.kind === 't72').length;
  if (!colAlive[0]?.retreat && w.stats.enTanksLost >= 3 && tanksLeft > 0) {
    colAlive.forEach(u => { u.retreat = true; u.moving = true; });
    w.log.push({ t: w.T, text: 'الرتل المعادي خسر أغلب دباباته وبدأ ينسحب غرباً', good: true, p: colAlive[0].p });
    w.fx.push({ k: 'mark', p: add(colAlive[0].p, [0, 30, 0]), text: '↩ العدو ينسحب', good: true });
  }
  for (const u of w.units) {
    if (!u.alive) continue;
    const spec = SPEC[u.kind];
    u.cd -= dt;
    // اختيار هدف أرضي: الأقرب ضمن المدى
    const foes = enemiesOf(w, u);
    let best: Unit | null = null, bd = 1e9;
    if (spec.range > 0 && u.kind !== 'grad') for (const o of foes) {
      const d = dist2d(u.p, o.p);
      // الدوشكا ما تضرب الدبابات (ما تأثر عليها) — تختار أهداف خفيفة بس
      if (spec.armor === 0 && u.kind !== 'd30' && SPEC[o.kind].armor > 0) continue;
      if (u.kind === 'd30' && (o.group !== 'رتل مدرّع معادي' || (o.retreat && o.p[0] < -7600))) continue;
      if (d < spec.range && d < bd) { bd = d; best = o; }
    }
    // الحركة: الرتل يتقدم إذا ماكو هدف بمدى دباباته، أو ينسحب
    if (u.path && u.moving) {
      const engaged = !!best && bd < spec.range * 0.95 && !u.retreat;
      if (!engaged) {
        const dir: V3 = u.retreat ? WEST : EAST;
        u.p = add(u.p, scale(dir, spec.speed * (u.retreat ? 1.2 : 1) * dt));
        u.yaw = yawOf(dir);
        if (!u.retreat && u.p[0] > -4600) u.moving = false; // وصل لخط التماس
      }
    }
    if (!best || u.cd > 0) continue;
    if (u.retreat && u.kind !== 't72') continue;
    u.cd = spec.reload * (0.85 + w.r() * 0.3); u.target = best.id;
    const dir = norm(sub(best.p, u.p));
    if (u.kind === 'abrams' || u.kind === 't72') {
      if (!u.retreat) u.yaw = yawOf(dir);
      const muzzle = add(add(u.p, scale(dir, 5.5)), [0, 2.2, 0]);
      const pHit = u.kind === 'abrams' ? 0.85 - bd / 9000 : 0.7 - bd / 7000;
      const hit = w.r() < pHit, impact = hit ? add(best.p, [0, 1.2, 0]) : add(best.p, [(w.r() - 0.5) * 40, 0, (w.r() - 0.5) * 40]);
      w.fx.push({ k: 'muzzle', p: muzzle, dir, big: true }, { k: 'tracer', a: muzzle, b: impact, n: 1 });
      const tgt = best, tf = bd / 1650, by = u.side === 'en' ? `${u.name} معادية` : u.name;
      w.schedule.push({ t: w.T + tf, f: (w) => {
        w.fx.push({ k: 'boom', p: impact, size: hit ? 0.7 : 0.35, air: false });
        if (hit) damage(w, tgt, u.kind === 'abrams' ? (SPEC[tgt.kind].armor ? 1.8 : 3) : (tgt.kind === 'abrams' ? 1.1 : 3), by);
      } });
    } else if (u.kind === 'technical' || u.kind === 'dshk') {
      const muzzle = add(u.p, [0, u.kind === 'dshk' ? 1.2 : 2.6, 0]);
      const hit = w.r() < 0.22 - bd / 9000;
      const impact = add(best.p, [(w.r() - 0.5) * (hit ? 3 : 30), 1, (w.r() - 0.5) * (hit ? 3 : 30)]);
      w.fx.push({ k: 'muzzle', p: muzzle, dir, big: false }, { k: 'tracer', a: muzzle, b: impact, n: 6 });
      if (hit) { const tgt = best, by = u.side === 'en' ? `${u.name} معادية` : u.name; w.schedule.push({ t: w.T + bd / 850, f: (w) => damage(w, tgt, 0.35, by) }); }
    } else if (u.kind === 'd30') fireShell(w, u, best);
  }
}

function stepAir(w: World, dt: number) {
  const r = w.r;
  // الدفاع الجوي القصير: دوشكات وبيكبات ضد المسيّرات
  for (const u of w.units) {
    const aa = SPEC[u.kind].aa; if (!u.alive || !aa || u.side !== 'iq') continue;
    if (u.cd > 0) continue;
    let tgt: Air | null = null, bd = 1e9;
    for (const a of w.air) if (a.alive && a.kind === 'shahed') { const d = len(sub(a.p, u.p)); if (d < aa && d < bd) { bd = d; tgt = a; } }
    if (!tgt) continue;
    u.cd = SPEC[u.kind].reload * (0.8 + r() * 0.4);
    const muzzle = add(u.p, [0, u.kind === 'dshk' ? 1.2 : 2.6, 0]), lead = add(tgt.p, scale(tgt.v, bd / 850));
    const pk = 0.07 + 0.2 * (1 - bd / aa); tgt.shotsAt++;
    w.fx.push({ k: 'muzzle', p: muzzle, dir: norm(sub(lead, muzzle)), big: false }, { k: 'tracer', a: muzzle, b: add(lead, [(r() - 0.5) * 25, (r() - 0.5) * 25, (r() - 0.5) * 25]), n: 7 });
    if (r() < pk) {
      const a = tgt; w.schedule.push({ t: w.T + bd / 850, f: (w) => { if (!a.alive) return; a.alive = false; w.stats.dronesDown++;
        w.fx.push({ k: 'boom', p: a.p, size: 0.6, air: true }, { k: 'mark', p: add(a.p, [0, 25, 0]), text: '✓ أُسقطت', good: true });
        w.log.push({ t: w.T, text: `${u.name} أسقطت ${AIR_AR.shahed} كانت متجهة نحو ${a.siteName}`, good: true, p: a.p }); } });
    }
  }
  // الباتريوت: يشتبك ويا صواريخ الكروز (معترضين لكل هدف)
  const pat = w.units.find(u => u.kind === 'patriot' && u.alive);
  if (pat) for (const a of w.air) {
    if (!a.alive || a.kind !== 'kh101' || a.shotsAt > 0) continue;
    if (dist2d(a.p, pat.p) > 12500) continue;
    a.shotsAt = 2;
    for (let k = 0; k < 2; k++) w.schedule.push({ t: w.T + k * 1.6, f: (w) => {
      if (!a.alive) return;
      const mi = (w.stats.pacFired++) % 4, m = add(pat.p, rotY(PATRIOT_MUZZLES[mi], pat.yaw)), dir = rotY(PATRIOT_LAUNCH_LOCAL, pat.yaw);
      spawnAir(w, 'pac2', 'iq', m, scale(dir, 25), a.p, undefined, a.id);
      w.fx.push({ k: 'launch', p: m, dir });
      if (k === 0) w.log.push({ t: w.T, text: `الباتريوت أطلق معترضين على ${AIR_AR.kh101} المتجه نحو ${a.siteName}`, good: null, p: m });
    } });
  }
  for (const a of w.air) {
    if (!a.alive) continue;
    a.t += dt;
    if (a.kind === 'shahed') {
      const hd = dist2d(a.p, a.aim);
      if (!a.dive && hd < 700) a.dive = true;
      const want = a.dive ? norm(sub(a.aim, a.p)) : norm([a.aim[0] - a.p[0], (150 - a.p[1]) * 0.002, a.aim[2] - a.p[2]]);
      a.v = scale(norm(add(norm(a.v), scale(want, dt * 1.5))), a.dive ? 75 : 52);
    } else if (a.kind === 'kh101') {
      const want = norm([a.aim[0] - a.p[0], (60 - a.p[1]) * 0.01, a.aim[2] - a.p[2]]);
      if (dist2d(a.p, a.aim) < 900) a.v = scale(norm(sub(a.aim, a.p)), 240); else a.v = scale(norm(add(norm(a.v), scale(want, dt * 0.8))), 235);
    } else if (a.kind === 'pac2') {
      const tgt = w.air.find(o => o.id === a.tgtAir);
      const sp = len(a.v), dir = norm(a.v);
      let acc: V3 = add([0, -9.81, 0], scale(dir, (a.t < 9 ? 260 : 0) - 0.00011 * sp * sp));
      if (tgt && tgt.alive && a.t > 0.7) {
        const rr = sub(tgt.p, a.p), vr = sub(tgt.v, a.v), om = scale(cross(rr, vr), 1 / Math.max(1, dot(rr, rr)));
        let g = add(scale(cross(om, a.v), 4), [0, 9.81, 0]); const gl = len(g); if (gl > 320) g = scale(g, 320 / gl);
        acc = add(acc, g);
        const d = len(rr); a.miss = Math.min(a.miss, d);
        if (d < 9 || (d < 40 && d > a.miss + 1)) {
          a.alive = false; tgt.alive = false; w.stats.cruiseDown++;
          w.fx.push({ k: 'boom', p: a.p, size: 1.6, air: true }, { k: 'mark', p: add(a.p, [0, 40, 0]), text: '✓ اعتُرض', good: true });
          w.log.push({ t: w.T, text: `الباتريوت اعترض ${AIR_AR.kh101} قبل ما يوصل ${tgt.siteName}`, good: true, p: a.p });
          continue;
        }
      } else if (a.t > 4 && (!tgt || !tgt.alive)) { a.alive = false; w.fx.push({ k: 'boom', p: a.p, size: 0.5, air: true }); continue; } // تدمير ذاتي
      a.v = add(a.v, scale(acc, dt));
    } else { // صواريخ غراد وقذائف المدفعية: بالستية
      a.v = add(a.v, [0, -9.81 * dt, 0]);
    }
    a.p = add(a.p, scale(a.v, dt));
    // الاصطدام بالأرض
    if (a.p[1] <= 0.5 && a.t > 0.5) {
      a.alive = false; a.p[1] = 0.3;
      if (a.kind === 'shahed' || a.kind === 'kh101') {
        const big = a.kind === 'kh101';
        if (big) w.stats.cruiseHit++; else w.stats.dronesHit++;
        w.fx.push({ k: 'boom', p: a.p, size: big ? 2.2 : 1.2, air: false }, { k: 'mark', p: add(a.p, [0, 40, 0]), text: `✗ أصاب ${a.siteName}`, good: false });
        w.log.push({ t: w.T, text: `${AIR_AR[a.kind]} أصاب ${a.siteName}`, good: false, p: a.p });
        blast(w, a.p, 40, 12, 1, 0.5, AIR_AR[a.kind], 'en');
      } else if (a.kind === 'rocket') {
        w.fx.push({ k: 'boom', p: a.p, size: 0.55, air: false }); blast(w, a.p, 22, 5, 1, 0.6, 'راجمات الغراد', 'en');
      } else if (a.kind === 'shell') {
        w.fx.push({ k: 'boom', p: a.p, size: 0.65, air: false }); blast(w, a.p, 28, 9, 1, 1.2, 'مدفعية D-30', 'iq');
      }
    }
  }
  w.air = w.air.filter(a => a.alive || a.t < 0); // نشيل الميت (الرسم يشوف حالته من الأحداث)
}
