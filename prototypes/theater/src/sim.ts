// منطق «مسرح العمليات» v2 بدون رسم. متر، ثانية. x شرق، z شمال، y للأعلى.
// v2: خريطة مضغوطة (I-018)، تكتيك (I-013)، رمي رشاشات طلقة طلقة (I-015)، إطلاق ساخن/بارد (I-014، I-017)،
//     S-400 + صواريخ باليستية (I-017)، أوامر قليلة للاعب (I-020).
// المحاكاة تكتب أحداث (fx) والرسم يقراها؛ كلها تتفحص بـ Node بدون متصفح.

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
export const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ===== الجغرافيا: مدينة على نهر، مضغوطة (المسافات ≈ ثلث الحقيقة حتى تنشاف بالتلفون) =====
export const riverX = (z: number) => 260 * Math.sin(z / 900 + 0.6) + 110 * Math.sin(z / 380 + 2.1) + 120;
export const RIVER_W = (z: number) => 190 + 30 * Math.sin(z / 700);
export const CITY_R = 2300;
export const HIGHWAY_Z = -350;
export interface Site { id: string; name: string; p: V3; cost: string }
export const SITES: Site[] = [
  { id: 'airport', name: 'المهبط الميداني', p: [-2650, 0, -1250], cost: 'طيران الإسناد متوقف 3 أيام — خسارة 120 مليون $' },
  { id: 'green', name: 'قرية الوادي', p: [riverX(-150) - 170, 0, -150], cost: 'الاستقرار −4 والأهالي ينزحون' },
  { id: 'dora', name: 'خزانات الوقود', p: [950, 0, -1650], cost: 'إنتاج الوقود ينقص 15٪ هذا الشهر' },
  { id: 'rasheed', name: 'معسكر الجنوب', p: [1750, 0, -2350], cost: 'معنويات الجيش −5' },
  { id: 'taji', name: 'معسكر التل', p: [-950, 0, 3100], cost: 'مخزن ذخيرة احترق — كلفة 60 مليون $' },
];
export const site = (id: string) => SITES.find(s => s.id === id)!;
/** سواتر ترابية أمام خط الأبرامز (الرسم يرسمها، والمحاكاة تقلل الإصابة وراها) */
export const BERMS: V3[] = [[-2085, 0, -480], [-2085, 0, -350], [-2085, 0, -220]];

// ===== الوحدات =====
export type Side = 'iq' | 'en';
export type Kind = 'abrams' | 't72' | 'technical' | 'dshk' | 'd30' | 'grad' | 'patriot' | 's400';
export const KIND_AR: Record<Kind, string> = { abrams: 'أبرامز M1A1', t72: 'T-72B3', technical: 'بيكب دوشكا', dshk: 'دوشكا 12.7', d30: 'مدفع D-30', grad: 'راجمة غراد BM-21', patriot: 'باتريوت', s400: 'S-400 تريومف' };
export const SIDE_AR: Record<Side, string> = { iq: 'العراق', en: 'العدو' };
interface KindSpec { hp: number; range: number; reload: number; speed: number; aa: number; armor: number; turn: number }
export const SPEC: Record<Kind, KindSpec> = {
  abrams: { hp: 3, range: 2200, reload: 6.5, speed: 8, aa: 0, armor: 1, turn: 0.6 },
  t72: { hp: 2, range: 1900, reload: 8, speed: 8, aa: 0, armor: 1, turn: 0.55 },
  technical: { hp: 1, range: 1100, reload: 1.2, speed: 12, aa: 1200, armor: 0, turn: 1.2 },
  dshk: { hp: 1, range: 1100, reload: 1.0, speed: 0, aa: 1100, armor: 0, turn: 2.5 },
  d30: { hp: 1, range: 9000, reload: 6, speed: 0, aa: 0, armor: 0, turn: 0.4 },
  grad: { hp: 1, range: 12000, reload: 999, speed: 9, aa: 0, armor: 0, turn: 0.5 },
  patriot: { hp: 2, range: 0, reload: 0, speed: 0, aa: 0, armor: 0, turn: 0 },
  s400: { hp: 2, range: 0, reload: 0, speed: 0, aa: 0, armor: 0, turn: 0 },
};
export type UState = 'idle' | 'march' | 'deploy' | 'bound' | 'hold' | 'retreat' | 'scoot' | 'return' | 'reposition';
export interface Unit {
  id: number; kind: Kind; side: Side; name: string; group: string; p: V3; yaw: number; spd: number; hp: number; alive: boolean;
  cd: number; target: number; state: UState; goal: V3 | null; home: V3; team: number; slot: V3; cover: boolean;
  burst: number; burstT: number; shots: number; firedT: number; stateT: number; burnT: number;
}
export type AirKind = 'shahed' | 'kh101' | 'iskander' | 'pac2' | 'n48' | 'rocket' | 'shell';
export const AIR_AR: Record<AirKind, string> = { shahed: 'شاهد-136', kh101: 'كروز Kh-101', iskander: 'باليستي إسكندر', pac2: 'معترض PAC-2', n48: 'معترض 48N6 · S-400', rocket: 'صاروخ غراد', shell: 'قذيفة 122 ملم' };
export interface Air {
  id: number; kind: AirKind; side: Side; p: V3; v: V3; alive: boolean; t: number; aim: V3; siteName?: string; siteId?: string;
  tgtAir?: number; miss: number; dive?: boolean; shotsAt: number; phase: 'eject' | 'boost' | 'cruise'; ign: boolean;
}
// ===== أحداث للرسم =====
export type Fx =
  | { k: 'gun'; unit: number; p: V3; dir: V3; big: boolean }                  // مدفع دبابة/هاوتزر: لهب + غبار + ارتداد
  | { k: 'round'; unit: number; p: V3; dir: V3; to: V3; tracer: boolean; tf: number; hit: 'air' | 'metal' | 'ground' } // طلقة رشاش
  | { k: 'shell'; a: V3; b: V3; tf: number }                                  // قذيفة دبابة سريعة (خط مضيء)
  | { k: 'killshot'; shooter: number; target: number; tf: number }            // قذيفة راح تدمّر الهدف — للمخرج
  | { k: 'boom'; p: V3; size: number; air: boolean; metal?: boolean }
  | { k: 'plaunch'; muzzle: V3; rear: V3; dir: V3; air: number }              // إطلاق ساخن (باتريوت)
  | { k: 'eject'; p: V3; dir: V3; air: number }                               // إطلاق بارد (S-400): قذف بالغاز
  | { k: 'ignite'; air: number; p: V3 }                                       // اشتعال المحرك بالجو
  | { k: 'rlaunch'; unit: number; p: V3; dir: V3 }                            // صاروخ غراد
  | { k: 'kill'; unit: number; turret: boolean }
  | { k: 'siteHit'; site: string; p: V3; big: boolean }
  | { k: 'threat'; air: number; tti: number }                                 // تهديد قريب يضرب (للمخرج)
  | { k: 'intercept'; p: V3; big: boolean }
  | { k: 'mark'; p: V3; text: string; good: boolean };
export interface LogLine { t: number; text: string; good: boolean | null; p: V3 }
export type Order = 'retreat' | 'counter' | 'barrage' | 'aaPriority';
export const ORDER_CD: Record<Order, number> = { retreat: 30, counter: 30, barrage: 40, aaPriority: 5 };

export interface World {
  T: number; units: Unit[]; air: Air[]; fx: Fx[]; log: LogLine[]; r: () => number; nextId: number; over: boolean;
  stats: { drones: number; dronesDown: number; dronesHit: number; cruise: number; cruiseDown: number; cruiseHit: number; ballistic: number; ballisticDown: number; ballisticHit: number;
    enTanks: number; enTanksLost: number; iqTanks: number; iqTanksLost: number; pacFired: number; n48Fired: number; rockets: number; shells: number; rounds: number };
  schedule: { t: number; f: (w: World) => void; done?: boolean }[];
  orderCd: Record<Order, number>; aaPriority: boolean; columnPhase: 'march' | 'deploy' | 'bound' | 'hold' | 'retreat'; boundTeam: number; boundT: number;
}

// ===== منظومات الدفاع الجوي: مواضع الفوهات (مقاسة من المجسمات) =====
export const PATRIOT_POS: V3 = [-650, 0, 1250];
export const PATRIOT_YAW = yawOf(norm([-0.7, 0, 0.72])) - yawOf([-1, 0, 0]);   // الفوهات (−x محلياً) للشمال الغربي
export const PATRIOT_MUZZLES: V3[] = [[6.3, 8.9, 0.55], [6.3, 8.9, -0.55], [6.1, 7.5, 0.55], [6.1, 7.5, -0.55]];
export const PATRIOT_REAR: V3 = [12.4, 4.9, 0];
export const PATRIOT_LAUNCH_LOCAL: V3 = norm([-0.854, 0.52, 0]);
export const S400_POS: V3 = [650, 0, 1500];
export const S400_YAW = yawOf(norm([-0.75, 0, 0.66]));                         // الأنابيب (+z محلياً) للشمال الغربي
export const S400_SCALE = 7.2;
const S4 = (x: number, y: number, z: number): V3 => [x * S400_SCALE, y * S400_SCALE + 0.502 * S400_SCALE, z * S400_SCALE];
export const S400_MUZZLES: V3[] = [S4(0.12, 0.456, -0.3), S4(-0.12, 0.456, -0.3), S4(0.12, 0.35, -0.19), S4(-0.12, 0.35, -0.19)];
export const S400_LAUNCH_LOCAL: V3 = norm([0, 0.667, 0.745]);
const WEST: V3 = [-1, 0, 0], EAST: V3 = [1, 0, 0];
const COLUMN = 'رتل مدرّع معادي';

export function newWorld(seed = 11): World {
  const w: World = {
    T: 0, units: [], air: [], fx: [], log: [], r: rng(seed), nextId: 1, schedule: [], over: false,
    stats: { drones: 0, dronesDown: 0, dronesHit: 0, cruise: 0, cruiseDown: 0, cruiseHit: 0, ballistic: 0, ballisticDown: 0, ballisticHit: 0, enTanks: 0, enTanksLost: 0, iqTanks: 0, iqTanksLost: 0, pacFired: 0, n48Fired: 0, rockets: 0, shells: 0, rounds: 0 },
    orderCd: { retreat: 0, counter: 0, barrage: 0, aaPriority: 0 }, aaPriority: false, columnPhase: 'march', boundTeam: 0, boundT: 0,
  };
  const U = (kind: Kind, side: Side, p: V3, dir: V3, group: string, extra: Partial<Unit> = {}) => {
    const u: Unit = { id: w.nextId++, kind, side, name: KIND_AR[kind], group, p: [...p] as V3, yaw: yawOf(dir), spd: 0, hp: SPEC[kind].hp, alive: true, cd: 1 + w.r() * 3,
      target: 0, state: 'idle', goal: null, home: [...p] as V3, team: 0, slot: [0, 0, 0], cover: false, burst: 0, burstT: 0, shots: 0, firedT: -99, stateT: 0, burnT: 0, ...extra };
    w.units.push(u); return u;
  };
  // --- العراق ---
  BERMS.forEach(b => U('abrams', 'iq', add(b, [35, 0, 0]), WEST, 'خط الأبرامز', { cover: true }));
  U('dshk', 'iq', [-1870, 0, HIGHWAY_Z - 70], WEST, 'سيطرة الطريق'); U('dshk', 'iq', [-1870, 0, HIGHWAY_Z + 70], WEST, 'سيطرة الطريق');
  U('technical', 'iq', [-1790, 0, HIGHWAY_Z - 22], WEST, 'سيطرة الطريق');
  U('d30', 'iq', [-1050, 0, -720], WEST, 'كتيبة مدفعية'); U('d30', 'iq', [-1050, 0, -600], WEST, 'كتيبة مدفعية');
  U('technical', 'iq', add(site('green').p, [-120, 0, 90]), [0, 0, 1], 'دفاع القرية');
  U('technical', 'iq', add(site('dora').p, [-140, 0, 110]), [0, 0, 1], 'دفاع الخزانات');
  U('technical', 'iq', add(site('airport').p, [420, 0, 260]), WEST, 'دفاع المهبط');
  U('technical', 'iq', add(site('taji').p, [150, 0, -150]), [0, 0, 1], 'دفاع معسكر التل');
  U('patriot', 'iq', PATRIOT_POS, [0, 0, 1], 'بطارية باتريوت', { yaw: PATRIOT_YAW });
  U('s400', 'iq', S400_POS, [0, 0, 1], 'بطارية S-400', { yaw: S400_YAW });
  // --- العدو: رتل على الطريق (مسير)، وراجمتين ---
  ['t72', 't72', 't72', 't72', 'technical', 'technical'].forEach((k, i) =>
    U(k as Kind, 'en', [-4700 - i * 70, 0, HIGHWAY_Z + (i % 2 ? 7 : -7)], EAST, COLUMN, { state: 'march', team: i % 2 }));
  U('grad', 'en', [-5100, 0, -1350], EAST, 'راجمات العدو'); U('grad', 'en', [-5060, 0, -1460], EAST, 'راجمات العدو');
  w.stats.enTanks = 4; w.stats.iqTanks = 3;

  // --- جدول الهجمات ---
  const D = (deg: number) => deg * Math.PI / 180;
  const drones = (t: number, list: [number, string][]) => w.schedule.push({ t, f: (w) => list.forEach(([deg, sid], i) => {
    const s = site(sid), dir: V3 = [Math.sin(D(deg)), 0, Math.cos(D(deg))], start = add(s.p, scale(dir, 2500 + i * 220));
    start[1] = 120 + w.r() * 40; spawnAir(w, 'shahed', 'en', start, scale(norm(sub(s.p, start)), 50), s); w.stats.drones++;
  }) });
  drones(3, [[-70, 'airport'], [-60, 'green'], [-80, 'dora'], [-50, 'airport']]);
  drones(42, [[-120, 'dora'], [-35, 'green'], [-100, 'rasheed'], [-25, 'taji']]);
  const cruise = (t: number, sid: string, deg: number) => w.schedule.push({ t, f: (w) => {
    const s = site(sid), dir: V3 = [Math.sin(D(deg)), 0, Math.cos(D(deg))], start = add(s.p, scale(dir, 8000)); start[1] = 60;
    spawnAir(w, 'kh101', 'en', start, scale(norm(sub(s.p, start)), 235), s); w.stats.cruise++;
    w.log.push({ t: w.T, text: `رادار الباتريوت رصد ${AIR_AR.kh101} متجه نحو ${s.name}`, good: null, p: start });
  } });
  cruise(20, 'green', -48); cruise(26, 'dora', -60);
  const ballistic = (t: number, sid: string, deg: number) => w.schedule.push({ t, f: (w) => {
    const s = site(sid), dir: V3 = [Math.sin(D(deg)), 0, Math.cos(D(deg))], start = add(s.p, scale(dir, 9500)); start[1] = 21000;
    const v = scale(norm(sub(s.p, start)), 1450);
    spawnAir(w, 'iskander', 'en', start, v, s); w.stats.ballistic++;
    w.log.push({ t: w.T, text: `إنذار: ${AIR_AR.iskander} نازل من ارتفاع 21 كم نحو ${s.name}`, good: false, p: start });
  } });
  ballistic(55, 'green', -40); ballistic(80, 'taji', -55);
  const salvo = (t: number) => w.schedule.push({ t, f: (w) => {
    const gs = w.units.filter(u => u.kind === 'grad' && u.alive); if (!gs.length) return;
    gs.forEach((g, gi) => { for (let i = 0; i < 20; i++) w.schedule.push({ t: w.T + i * 0.5 + gi * 0.23, f: (w) => { if (g.alive) fireRocket(w, g); } });
      w.schedule.push({ t: w.T + 12, f: (w) => { if (g.alive) { g.state = 'reposition'; g.goal = add(g.p, [-150, 0, -330 + gi * 70]); w.log.push({ t: w.T, text: 'الراجمة المعادية رمت وتحركت فوراً حتى ما تنكشف (اضرب واهرب)', good: null, p: g.p }); } } }); });
    w.log.push({ t: w.T, text: 'راجمات الغراد المعادية فتحت النار على خط الدفاع', good: false, p: gs[0].p });
  } });
  salvo(18); salvo(62);
  return w;
}

function spawnAir(w: World, kind: AirKind, side: Side, p: V3, v: V3, s?: Site, tgtAir?: number, aim?: V3): Air {
  const a: Air = { id: w.nextId++, kind, side, p: [...p] as V3, v, alive: true, t: 0, aim: aim ?? (s ? [...s.p] as V3 : [0, 0, 0]), siteName: s?.name, siteId: s?.id, tgtAir, miss: 1e9, shotsAt: 0, phase: 'cruise', ign: true };
  w.air.push(a); return a;
}
function fireRocket(w: World, g: Unit) {
  const aim: V3 = [-2000 + (w.r() - 0.5) * 380, 0, HIGHWAY_Z + (w.r() - 0.5) * 460];
  const from: V3 = add(g.p, rotY([0, 3.2, -2.8], g.yaw)), d = dist2d(from, aim), tf = 11 + w.r() * 1.5;
  const vh = d / tf, vy = 0.5 * 9.81 * tf, dir = norm([aim[0] - from[0], 0, aim[2] - from[2]]), v: V3 = [dir[0] * vh, vy, dir[2] * vh];
  spawnAir(w, 'rocket', 'en', from, v, undefined, undefined, aim);
  w.fx.push({ k: 'rlaunch', unit: g.id, p: from, dir: norm(v) }); w.stats.rockets++;
}
function fireShell(w: World, u: Unit, aim: V3) {
  const from: V3 = add(u.p, [0, 2, 0]), d = dist2d(from, aim), tf = 7 + d / 700;
  const vh = d / tf, vy = 0.5 * 9.81 * tf, dir = norm([aim[0] - from[0], 0, aim[2] - from[2]]);
  spawnAir(w, 'shell', 'iq', from, [dir[0] * vh, vy, dir[2] * vh], undefined, undefined, aim);
  u.yaw = yawOf(dir);
  w.fx.push({ k: 'gun', unit: u.id, p: add(u.p, add(scale(dir, 4), [0, 1.6, 0])), dir: norm([dir[0], 0.7, dir[2]]), big: true }); w.stats.shells++;
}

// ===== أدوات القتال =====
const isColumn = (u: Unit) => u.group === COLUMN;
function damage(w: World, u: Unit, amount: number, by: string) {
  if (!u.alive) return;
  u.hp -= amount;
  if (u.hp > 0) return;
  u.alive = false; u.spd = 0; u.burnT = w.T;
  const tank = u.kind === 'abrams' || u.kind === 't72';
  w.fx.push({ k: 'kill', unit: u.id, turret: u.kind === 't72' }, { k: 'boom', p: add(u.p, [0, 1.5, 0]), size: tank ? 1.4 : 0.9, air: false, metal: true });
  if (u.kind === 't72') w.stats.enTanksLost++;
  if (u.kind === 'abrams') w.stats.iqTanksLost++;
  const good = u.side === 'en';
  w.log.push({ t: w.T, text: `${by} دمّرت ${u.name} ${good ? 'معادية' : 'عراقية'}${u.kind === 't72' ? ' — طار برجها من انفجار الذخيرة' : ''}`, good, p: u.p });
  w.fx.push({ k: 'mark', p: add(u.p, [0, 10, 0]), text: good ? `💥 ${u.name}` : `✗ ${u.name}`, good });
}
function blast(w: World, p: V3, rSoft: number, rHard: number, dmgSoft: number, dmgHard: number, by: string, side: Side) {
  for (const u of w.units) {
    if (!u.alive || u.side === side) continue;
    const d = dist2d(u.p, p), hard = SPEC[u.kind].armor > 0;
    if (hard ? d < rHard : d < rSoft) damage(w, u, hard ? dmgHard : dmgSoft, by);
  }
}
const byName = (u: Unit) => u.side === 'en' ? `${u.name} معادية` : u.name;

// ===== أوامر اللاعب (I-020) =====
export function order(w: World, o: Order): string | null {
  if (w.orderCd[o] > w.T) return `الأمر يرجع متاح بعد ${Math.ceil(w.orderCd[o] - w.T)} ثانية`;
  w.orderCd[o] = w.T + ORDER_CD[o];
  const abrams = w.units.filter(u => u.kind === 'abrams' && u.alive);
  if (o === 'retreat') { abrams.forEach(u => { u.state = 'reposition'; u.goal = add(u.home, [320, 0, 0]); u.cover = false; }); w.log.push({ t: w.T, text: 'أمرك: الأبرامز تنسحب للخط الثاني', good: null, p: abrams[0]?.p ?? [0, 0, 0] }); }
  if (o === 'counter') { abrams.forEach(u => { u.state = 'reposition'; u.goal = add(u.p, [-480, 0, 0]); u.cover = false; }); w.log.push({ t: w.T, text: 'أمرك: هجوم مضاد — الأبرامز طلعت من السواتر', good: null, p: abrams[0]?.p ?? [0, 0, 0] }); }
  if (o === 'barrage') {
    const foes = w.units.filter(u => u.side === 'en' && u.alive && isColumn(u)); if (!foes.length) return 'ماكو هدف للمدفعية';
    const c = scale(foes.reduce((s, u) => add(s, u.p), [0, 0, 0] as V3), 1 / foes.length);
    w.units.filter(u => u.kind === 'd30' && u.alive).forEach((g, gi) => { for (let i = 0; i < 6; i++) w.schedule.push({ t: w.T + i * 1.4 + gi * 0.5, f: (w) => { if (g.alive) fireShell(w, g, add(c, [(w.r() - 0.5) * 140, 0, (w.r() - 0.5) * 140])); } }); });
    w.log.push({ t: w.T, text: 'أمرك: رشقة مدفعية مركّزة على الرتل', good: null, p: c });
  }
  if (o === 'aaPriority') { w.aaPriority = !w.aaPriority; w.log.push({ t: w.T, text: w.aaPriority ? 'أمرك: الباتريوت يضرب المسيّرات هم (حماية أكثر، بس صواريخ غالية)' : 'أمرك: الباتريوت يرجع للكروز والباليستي بس', good: null, p: PATRIOT_POS }); }
  return null;
}

// ===== خطوة المحاكاة =====
export function step(w: World, dt: number) {
  w.T += dt;
  for (const s of w.schedule) if (!s.done && w.T >= s.t) { s.done = true; s.f(w); }
  column(w, dt);
  for (const u of w.units) if (u.alive) { move(w, u, dt); fight(w, u, dt); }
  air(w, dt);
  const enAir = w.air.some(a => a.alive && a.side === 'en'), pending = w.schedule.some(s => !s.done);
  const col = w.units.filter(u => isColumn(u) && u.alive && !(u.state === 'retreat' && u.p[0] < -3900));
  if (!w.over && w.T > 90 && !enAir && !pending && col.length === 0 && !w.air.some(a => a.alive && (a.kind === 'pac2' || a.kind === 'n48'))) {
    w.over = true; w.log.push({ t: w.T, text: 'انتهت المعركة: الهجوم انصد', good: true, p: [0, 0, 0] });
  }
}

// ----- قيادة الرتل: مسير ← انتشار ← قفزات متناوبة ← ثبات ← انسحاب -----
function column(w: World, dt: number) {
  const col = w.units.filter(u => isColumn(u) && u.alive); if (!col.length) return;
  const lead = col.reduce((a, b) => (a.p[0] > b.p[0] ? a : b));
  const foes = w.units.filter(u => u.side === 'iq' && u.alive && u.kind !== 'patriot' && u.kind !== 's400');
  const near = Math.min(...foes.map(f => dist2d(f.p, lead.p)));
  if (w.columnPhase !== 'retreat' && w.stats.enTanksLost >= 3) {
    w.columnPhase = 'retreat'; col.forEach(u => { u.state = 'retreat'; u.goal = [-5200, 0, u.p[2]]; });
    w.log.push({ t: w.T, text: 'الرتل المعادي خسر أغلب دباباته وبدأ ينسحب غرباً', good: true, p: lead.p });
    w.fx.push({ k: 'mark', p: add(lead.p, [0, 30, 0]), text: '↩ العدو ينسحب', good: true }); return;
  }
  if (w.columnPhase === 'march' && near < 2300) {
    w.columnPhase = 'deploy'; const x0 = lead.p[0] + 120;
    const tanks = col.filter(u => u.kind === 't72'), techs = col.filter(u => u.kind !== 't72');
    const lat = [-150, -50, 50, 150];
    tanks.forEach((u, i) => { u.state = 'deploy'; u.team = i % 2; u.slot = [x0 - Math.abs(lat[i]) * 0.35, 0, HIGHWAY_Z + lat[i]]; u.goal = u.slot; });
    techs.forEach((u, i) => { u.state = 'deploy'; u.team = 2; u.slot = [x0 - 220, 0, HIGHWAY_Z + (i ? 90 : -90)]; u.goal = u.slot; });
    w.log.push({ t: w.T, text: 'الرتل المعادي ترك الطريق وانتشر بتشكيل سهم', good: false, p: lead.p });
    w.fx.push({ k: 'mark', p: add(lead.p, [0, 30, 0]), text: '⚠ العدو انتشر للقتال', good: false });
  }
  if (w.columnPhase === 'deploy' && col.every(u => u.state !== 'deploy')) { w.columnPhase = 'bound'; w.boundTeam = 0; w.boundT = w.T; startBound(w, col); }
  if (w.columnPhase === 'bound') {
    const movers = col.filter(u => u.team === w.boundTeam && u.state === 'bound');
    if (!movers.length || w.T - w.boundT > 22) {
      const front = Math.max(...col.map(u => u.p[0]));
      if (front > -2050 - 1250) { w.columnPhase = 'hold'; col.forEach(u => { u.state = 'hold'; u.goal = null; }); w.log.push({ t: w.T, text: 'الرتل المعادي وگف على بعد كيلو من خط الأبرامز ويرمي', good: null, p: lead.p }); }
      else { w.boundTeam = 1 - w.boundTeam; w.boundT = w.T; startBound(w, col); }
    }
  }
  void dt;
}
function startBound(w: World, col: Unit[]) {
  // فريق يتقدّم 230 م والثاني يغطي بالنار؛ البيكبات تتبع ورا
  col.forEach(u => {
    if (u.team === w.boundTeam || (u.team === 2 && w.boundTeam === 0)) { u.state = 'bound'; u.goal = [u.p[0] + 280, 0, u.p[2] + (w.r() - 0.5) * 30]; }
    else { u.state = 'hold'; u.goal = null; }
  });
}

// ----- الحركة: توجيه + تسارع + دوران محدود -----
function move(w: World, u: Unit, dt: number) {
  const spec = SPEC[u.kind];
  if (u.state === 'march') u.goal = [u.p[0] + 200, 0, HIGHWAY_Z + (u.team ? 7 : -7)];
  const g = u.goal;
  if (!g || spec.speed === 0) { u.spd = Math.max(0, u.spd - 3 * dt); return; }
  const to = sub(g, u.p), d = dist2d(g, u.p);
  if (d < 6) {
    u.spd = Math.max(0, u.spd - 4 * dt);
    if (u.spd < 0.5) {
      if (u.state === 'deploy' || u.state === 'bound' || u.state === 'reposition') { u.state = 'hold'; u.goal = null; if (u.kind === 'abrams' && u.state === 'hold') u.home = [...u.p] as V3; }
      else if (u.state === 'scoot') { u.state = 'return'; u.goal = [...u.home] as V3; u.stateT = w.T; }
      else if (u.state === 'return') { u.state = 'hold'; u.goal = null; u.cover = u.kind === 'abrams' && BERMS.some(b => dist2d(b, u.p) < 60); }
      else if (u.state === 'retreat') u.goal = null;
    }
    return;
  }
  const reverse = u.state === 'scoot';
  const wantYaw = reverse ? yawOf(scale(to, -1)) : yawOf(to);
  const da = angDiff(u.yaw, wantYaw), maxTurn = spec.turn * dt;
  u.yaw += clamp(da, -maxTurn, maxTurn);
  const align = Math.max(0, Math.cos(da));
  const vmax = (u.state === 'march' ? spec.speed * 1.1 : u.state === 'scoot' || u.state === 'return' ? 3 : spec.speed * 0.9) * align;
  u.spd += clamp(vmax - u.spd, -4 * dt, 1.6 * dt);
  const fwd: V3 = [Math.sin(u.yaw), 0, Math.cos(u.yaw)];
  u.p = add(u.p, scale(fwd, (reverse ? -1 : 1) * u.spd * dt));
}

// ----- القتال الأرضي -----
function fight(w: World, u: Unit, dt: number) {
  const spec = SPEC[u.kind]; u.cd -= dt;
  if (u.kind === 'patriot' || u.kind === 's400' || u.kind === 'grad') return;
  // رشقة رشاش جارية: طلقة كل 0.1 ثانية (600 طلقة/دقيقة)
  if (u.burst > 0) { u.burstT -= dt; if (u.burstT <= 0) { u.burstT += 0.1; u.burst--; mgRound(w, u); } return; }
  if (u.cd > 0) return;
  if (u.kind === 'technical' || u.kind === 'dshk') {
    // الأولوية: مسيّرة قريبة، بعدها عربة خفيفة
    let tA: Air | null = null, bd = 1e9;
    if (u.side === 'iq') for (const a of w.air) if (a.alive && a.kind === 'shahed') { const d = len(sub(a.p, u.p)); if (d < spec.aa && d < bd) { bd = d; tA = a; } }
    let tU: Unit | null = null;
    if (!tA) for (const o of w.units) if (o.alive && o.side !== u.side && SPEC[o.kind].armor === 0 && o.kind !== 'patriot' && o.kind !== 's400') { const d = dist2d(o.p, u.p); if (d < spec.range && d < bd) { bd = d; tU = o; } }
    if (!tA && !tU) return;
    u.target = tA ? -tA.id : tU!.id; u.burst = 5 + Math.floor(w.r() * 5); u.burstT = 0; u.cd = 0.5 + w.r() * 0.9;
    if (u.kind === 'dshk') u.yaw = yawOf(sub(tA ? tA.p : tU!.p, u.p));
    return;
  }
  // الدبابات والمدفعية: الأقرب ضمن المدى
  let best: Unit | null = null, bd = 1e9;
  for (const o of w.units) {
    if (!o.alive || o.side === u.side || o.kind === 'patriot' || o.kind === 's400') continue;
    if (u.kind === 'd30' && (!isColumn(o) || (o.state === 'retreat' && o.p[0] < -3900))) continue;
    const d = dist2d(u.p, o.p); if (d < spec.range && d < bd) { bd = d; best = o; }
  }
  if (!best) return;
  if (u.kind === 'd30') { u.cd = spec.reload * (0.85 + w.r() * 0.3); const lead: V3 = best.spd > 1 ? scale([Math.sin(best.yaw), 0, Math.cos(best.yaw)], best.spd * 9) : [0, 0, 0]; fireShell(w, u, add(add(best.p, lead), [(w.r() - 0.5) * 90, 0, (w.r() - 0.5) * 90])); return; }
  // الدبابة: لازم توقف (أو تكاد) وتلف جسمها للهدف قبل ما ترمي
  if (u.state === 'bound' || u.state === 'deploy' || u.state === 'march' || u.state === 'reposition') return;
  if (u.spd > 1.2) return;
  const dir = norm(sub(best.p, u.p)), want = yawOf(dir), da = angDiff(u.yaw, want);
  if (Math.abs(da) > 0.12) { u.yaw += clamp(da, -spec.turn * dt, spec.turn * dt); return; }
  u.cd = spec.reload * (0.85 + w.r() * 0.3); u.target = best.id; u.firedT = w.T; u.shots++;
  const muzzle = add(add(u.p, scale(dir, 5.6)), [0, 2.3, 0]);
  let pHit = u.kind === 'abrams' ? 0.82 - bd / 9000 : 0.68 - bd / 7000;
  if (best.cover) pHit *= 0.6;                       // ورا ساتر: بس البرج ظاهر
  if (best.spd > 2) pHit *= 0.8;
  const hit = w.r() < pHit;
  const impact: V3 = hit ? add(best.p, [0, 1.3, 0]) : add(best.p, [(w.r() - 0.5) * 36, 0, (w.r() - 0.5) * 36]);
  const tf = bd / 1650, dmg = u.kind === 'abrams' ? (SPEC[best.kind].armor ? 2.1 : 3) : (best.kind === 'abrams' ? (best.cover ? 0.8 : 1.1) : 3);
  const kills = hit && best.hp - dmg <= 0;
  w.fx.push({ k: 'gun', unit: u.id, p: muzzle, dir, big: true }, { k: 'shell', a: muzzle, b: impact, tf });
  if (kills) w.fx.push({ k: 'killshot', shooter: u.id, target: best.id, tf });
  const tgt = best, by = byName(u);
  w.schedule.push({ t: w.T + tf, f: (w) => { w.fx.push({ k: 'boom', p: impact, size: hit ? 0.7 : 0.4, air: false, metal: hit }); if (hit) damage(w, tgt, dmg, by); } });
  // اضرب وتحرّك: الأبرامز ترجع ورا الساتر بعد الرمي أحياناً
  if (u.kind === 'abrams' && u.cover && w.r() < 0.45) { u.state = 'scoot'; u.goal = add(u.p, [28, 0, (w.r() - 0.5) * 10]); u.cover = false; }
}
function mgRound(w: World, u: Unit) {
  const muzzle = add(u.p, [0, u.kind === 'dshk' ? 1.1 : 2.4, 0]); w.stats.rounds++;
  const tracer = u.shots++ % 4 === 0;
  if (u.target < 0) {
    const a = w.air.find(x => x.id === -u.target && x.alive); if (!a) { u.burst = 0; return; }
    const d = len(sub(a.p, muzzle)), tf = d / 850, lead = add(a.p, scale(a.v, tf));
    const pk = 0.004 + 0.013 * (1 - d / SPEC[u.kind].aa), hit = w.r() < pk, r = () => (w.r() - 0.5) * (hit ? 2 : 30);
    const to: V3 = add(lead, [r(), r(), r()]);
    w.fx.push({ k: 'round', unit: u.id, p: muzzle, dir: norm(sub(to, muzzle)), to, tracer, tf, hit: hit ? 'metal' : 'air' });
    if (hit) w.schedule.push({ t: w.T + tf, f: (w) => { if (!a.alive) return; a.alive = false; w.stats.dronesDown++;
      w.fx.push({ k: 'boom', p: a.p, size: 0.6, air: true }, { k: 'intercept', p: a.p, big: false }, { k: 'mark', p: add(a.p, [0, 25, 0]), text: '✓ أُسقطت', good: true });
      w.log.push({ t: w.T, text: `${u.name} أسقطت ${AIR_AR.shahed} كانت متجهة نحو ${a.siteName}`, good: true, p: a.p }); } });
  } else {
    const o = w.units.find(x => x.id === u.target); if (!o || !o.alive) { u.burst = 0; return; }
    const d = dist2d(o.p, muzzle), tf = d / 850, hit = w.r() < 0.16 - d / 12000;
    const to: V3 = add(o.p, [(w.r() - 0.5) * (hit ? 2 : 24), hit ? 1.2 : 0, (w.r() - 0.5) * (hit ? 2 : 24)]);
    w.fx.push({ k: 'round', unit: u.id, p: muzzle, dir: norm(sub(to, muzzle)), to, tracer, tf, hit: hit ? 'metal' : 'ground' });
    if (hit) { const by = byName(u); w.schedule.push({ t: w.T + tf, f: (w) => damage(w, o, 0.12, by) }); }
  }
}

// ----- الجو -----
function air(w: World, dt: number) {
  const pat = w.units.find(u => u.kind === 'patriot' && u.alive), s4 = w.units.find(u => u.kind === 's400' && u.alive);
  // الباتريوت: كروز (والمسيّرات إذا أمرت بالأولوية)
  if (pat) for (const a of w.air) {
    const ok = a.kind === 'kh101' || (w.aaPriority && a.kind === 'shahed' && a.dive !== true);
    if (!a.alive || !ok || a.shotsAt > 0) continue;
    if (dist2d(a.p, pat.p) > (a.kind === 'kh101' ? 7000 : 2600)) continue;
    const n = a.kind === 'kh101' ? 2 : 1; a.shotsAt = n;
    for (let k = 0; k < n; k++) w.schedule.push({ t: w.T + k * 1.6, f: (w) => {
      if (!a.alive) return;
      const mi = (w.stats.pacFired++) % 4, m = add(pat.p, rotY(PATRIOT_MUZZLES[mi], pat.yaw)), dir = rotY(PATRIOT_LAUNCH_LOCAL, pat.yaw);
      const rear = add(pat.p, rotY([PATRIOT_REAR[0], PATRIOT_REAR[1] - (mi > 1 ? 1.4 : 0), PATRIOT_MUZZLES[mi][2]], pat.yaw));
      const i = spawnAir(w, 'pac2', 'iq', m, scale(dir, 40), undefined, a.id); i.phase = 'boost';
      w.fx.push({ k: 'plaunch', muzzle: m, rear, dir, air: i.id });
      if (k === 0) w.log.push({ t: w.T, text: `الباتريوت أطلق ${n === 2 ? 'معترضين' : 'معترض'} على ${AIR_AR[a.kind]} المتجه نحو ${a.siteName}`, good: null, p: m });
    } });
  }
  // S-400: الباليستي أولاً، وبعدين الكروز اللي فلت من الباتريوت
  if (s4) for (const a of w.air) {
    if (!a.alive || a.shotsAt > 0 || !(a.kind === 'iskander' || (a.kind === 'kh101' && dist2d(a.p, a.aim) < 2500))) continue;
    if (a.kind === 'iskander') { const tti = a.p[1] / Math.max(1, -a.v[1]); if (tti > 14.5) continue; }
    a.shotsAt = 2;
    for (let k = 0; k < 2; k++) w.schedule.push({ t: w.T + k * 1.2, f: (w) => {
      if (!a.alive) return;
      const mi = (w.stats.n48Fired++) % 4, m = add(s4.p, rotY(S400_MUZZLES[mi], s4.yaw)), dir = rotY(S400_LAUNCH_LOCAL, s4.yaw);
      const i = spawnAir(w, 'n48', 'iq', m, scale(dir, 30), undefined, a.id); i.phase = 'eject'; i.ign = false;
      w.fx.push({ k: 'eject', p: m, dir, air: i.id });
      if (k === 0) w.log.push({ t: w.T, text: `S-400 أطلق معترضين 48N6 على ${AIR_AR[a.kind]} — إطلاق بارد`, good: null, p: m });
    } });
  }
  for (const a of w.air) {
    if (!a.alive) continue;
    a.t += dt;
    if (a.kind === 'shahed') {
      if (!a.dive && dist2d(a.p, a.aim) < 450) { a.dive = true; w.fx.push({ k: 'threat', air: a.id, tti: 6 }); }
      const want = a.dive ? norm(sub(a.aim, a.p)) : norm([a.aim[0] - a.p[0], (130 - a.p[1]) * 0.002, a.aim[2] - a.p[2]]);
      a.v = scale(norm(add(norm(a.v), scale(want, dt * 1.5))), a.dive ? 70 : 50);
    } else if (a.kind === 'kh101') {
      const d = dist2d(a.p, a.aim);
      if (d < 700) { a.v = scale(norm(sub(a.aim, a.p)), 240); if (!a.dive) { a.dive = true; w.fx.push({ k: 'threat', air: a.id, tti: 3 }); } }
      else a.v = scale(norm(add(norm(a.v), scale(norm([a.aim[0] - a.p[0], (60 - a.p[1]) * 0.01, a.aim[2] - a.p[2]]), dt * 0.8))), 235);
    } else if (a.kind === 'iskander') {
      a.v = scale(norm(add(norm(a.v), scale(norm(sub(a.aim, a.p)), dt * 0.4))), 1450);  // تصحيح نهائي بسيط
      if (!a.dive && a.p[1] < 5500) { a.dive = true; w.fx.push({ k: 'threat', air: a.id, tti: a.p[1] / 1450 }); }
    } else if (a.kind === 'pac2' || a.kind === 'n48') interceptor(w, a, dt);
    else a.v = add(a.v, [0, -9.81 * dt, 0]);          // غراد + قذائف: بالستي
    if (!a.alive) continue;
    a.p = add(a.p, scale(a.v, dt));
    if (a.p[1] <= 0.4 && a.t > 0.6) ground(w, a);
  }
  w.air = w.air.filter(a => a.alive);
}
const ACC = { pac2: { thrust: 260, burn: 9, g: 320, fuze: 9 }, n48: { thrust: 300, burn: 10, g: 380, fuze: 18 } };
function interceptor(w: World, a: Air, dt: number) {
  const P = ACC[a.kind as 'pac2' | 'n48'], tgt = w.air.find(o => o.id === a.tgtAir);
  const sp = len(a.v), dir = norm(a.v);
  // إطلاق بارد: أول ~0.9 ثانية الصاروخ مقذوف بالغاز بلا محرك، يتباطأ، وبعدين يشتعل ويلف
  if (a.phase === 'eject') { a.v = add(a.v, [0, -9.81 * dt, 0]); if (a.t > 0.9) { a.phase = 'boost'; a.ign = true; w.fx.push({ k: 'ignite', air: a.id, p: [...a.p] as V3 }); } return; }
  let acc: V3 = add([0, -9.81, 0], scale(dir, (a.t < P.burn ? P.thrust : 0) - 0.00011 * sp * sp));
  if (tgt && tgt.alive) {
    const rr = sub(tgt.p, a.p), d = len(rr);
    if (a.kind === 'n48' && a.t < 2.4) {
      // انقلاب نحو نقطة الاعتراض المتوقعة (pitch-over) بدل التوجيه التناسبي مباشرة
      // نقطة الالتقاء المتوقعة بالتكرار (سرعة معترض متوسطة 1100 م/ث)، ولا تنزل تحت 2 كم
      let tgo = 0, aimP = tgt.p;
      for (let it = 0; it < 6; it++) { aimP = add(tgt.p, scale(tgt.v, tgo)); tgo = len(sub(aimP, a.p)) / 1100; }
      if (aimP[1] < 2000) aimP = [aimP[0], 2000, aimP[2]];
      const want = norm(sub(aimP, a.p));
      acc = add(acc, scale(sub(want, dir), 260)); acc = add(acc, [0, 9.81, 0]);
    } else if (a.t > 0.6) {
      const vr = sub(tgt.v, a.v), om = scale(cross(rr, vr), 1 / Math.max(1, dot(rr, rr)));
      let g = add(scale(cross(om, a.v), 4), [0, 9.81, 0]); const gl = len(g); if (gl > P.g) g = scale(g, P.g / gl);
      acc = add(acc, g);
    }
    // أقرب مسافة خلال هذي الخطوة (السرعات عالية: 50 م بالخطوة)
    const vr2 = sub(tgt.v, a.v), tc = clamp(-dot(rr, vr2) / Math.max(1e-6, dot(vr2, vr2)), 0, dt), dmin = len(add(rr, scale(vr2, tc)));
    a.miss = Math.min(a.miss, dmin);
    if (dmin < P.fuze || (d < 60 && d > a.miss + 2)) {
      a.alive = false; tgt.alive = false;
      const big = tgt.kind !== 'shahed';
      if (tgt.kind === 'kh101') w.stats.cruiseDown++; else if (tgt.kind === 'iskander') w.stats.ballisticDown++; else w.stats.dronesDown++;
      w.fx.push({ k: 'boom', p: a.p, size: big ? 1.7 : 0.8, air: true }, { k: 'intercept', p: a.p, big }, { k: 'mark', p: add(a.p, [0, 40, 0]), text: '✓ اعتُرض', good: true });
      w.log.push({ t: w.T, text: `${a.kind === 'n48' ? 'S-400' : 'الباتريوت'} اعترض ${AIR_AR[tgt.kind]} على ارتفاع ${Math.round(a.p[1] / 100) / 10} كم قبل ما يوصل ${tgt.siteName}`, good: true, p: a.p });
      return;
    }
  } else if (a.t > 3) { a.alive = false; w.fx.push({ k: 'boom', p: a.p, size: 0.5, air: true }); return; } // تدمير ذاتي
  a.v = add(a.v, scale(acc, dt));
}
function ground(w: World, a: Air) {
  a.alive = false; a.p[1] = 0.3;
  if (a.kind === 'shahed' || a.kind === 'kh101' || a.kind === 'iskander') {
    const big = a.kind !== 'shahed', huge = a.kind === 'iskander';
    if (a.kind === 'kh101') w.stats.cruiseHit++; else if (huge) w.stats.ballisticHit++; else w.stats.dronesHit++;
    w.fx.push({ k: 'boom', p: a.p, size: huge ? 3 : big ? 2.2 : 1.2, air: false }, { k: 'siteHit', site: a.siteId!, p: a.p, big }, { k: 'mark', p: add(a.p, [0, 40, 0]), text: `✗ أصاب ${a.siteName}`, good: false });
    w.log.push({ t: w.T, text: `${AIR_AR[a.kind]} أصاب ${a.siteName}`, good: false, p: a.p });
    blast(w, a.p, huge ? 70 : 40, huge ? 25 : 12, 1, 0.8, AIR_AR[a.kind], 'en');
  } else if (a.kind === 'rocket') { w.fx.push({ k: 'boom', p: a.p, size: 0.55, air: false }); blast(w, a.p, 20, 5, 1, 0.6, 'راجمات الغراد', 'en'); }
  else if (a.kind === 'shell') { w.fx.push({ k: 'boom', p: a.p, size: 0.65, air: false }); blast(w, a.p, 26, 9, 1, 1.2, 'مدفعية D-30', 'iq'); }
  else w.fx.push({ k: 'boom', p: a.p, size: 0.5, air: false });
}
