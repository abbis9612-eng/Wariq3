// منطق «مسرح العمليات» بدون رسم. متر، ثانية. x شرق، z شمال، y للأعلى.
// v4 «معركة القرية» (I-028…I-034، D-017): العدو يهاجم قرية الطريق، العراق يدافع بخطين وينسحب ويسوي هجوم معاكس.
//   خط نظر بالتلال والبيوت والدخان، دبابات تطلع ترمي وترجع تختبي، كبت تحت النار، مشاة تنزل من BMP وتقاتل بالبيوت،
//   كورنيت موجّه وRPG، وقائد آلي لكل طرف. المحاكاة تكتب أحداث (fx) والرسم يقراها؛ كلها تتفحص بـ Node (D-011).
export * from './geo.ts';
import type { V3, Site } from './geo.ts';
import {
  add, sub, scale, dot, cross, len, dist2d, norm, clamp, lerp, rotY, yawOf, angDiff, rng, HIGHWAY_Z, SITES, site, BERMS, BERMS2,
  PATRIOT_POS, PATRIOT_YAW, PATRIOT_MUZZLES, PATRIOT_REAR, PATRIOT_LAUNCH_LOCAL, S400_POS, S400_YAW, S400_MUZZLES, S400_LAUNCH_LOCAL,
} from './geo.ts';
import { groundH, houseBlocks, HOUSES } from './land.ts';
import type { House } from './land.ts';

// ===== الوحدات =====
export type Side = 'iq' | 'en';
export type Kind = 'abrams' | 't72' | 'bmp' | 'technical' | 'dshk' | 'd30' | 'grad' | 'patriot' | 's400' | 'inf' | 'kornet';
export const KIND_AR: Record<Kind, string> = { abrams: 'أبرامز M1A1', t72: 'T-72B3', bmp: 'BMP-2', technical: 'بيكب دوشكا', dshk: 'دوشكا 12.7', d30: 'مدفع D-30', grad: 'راجمة غراد BM-21', patriot: 'باتريوت', s400: 'S-400 تريومف', inf: 'حضيرة مشاة', kornet: 'فريق كورنيت' };
export const SIDE_AR: Record<Side, string> = { iq: 'العراق', en: 'العدو' };
interface KindSpec { hp: number; range: number; reload: number; speed: number; aa: number; armor: number; turn: number; eye: number; tall: number }
export const SPEC: Record<Kind, KindSpec> = {
  abrams: { hp: 3, range: 1000, reload: 7, speed: 8, aa: 0, armor: 1, turn: 0.6, eye: 2.7, tall: 2.9 },
  t72: { hp: 2, range: 900, reload: 9, speed: 8, aa: 0, armor: 1, turn: 0.55, eye: 2.4, tall: 2.3 },
  bmp: { hp: 1.3, range: 650, reload: 4, speed: 9, aa: 0, armor: 0.5, turn: 0.9, eye: 2.2, tall: 2.2 },
  technical: { hp: 1, range: 700, reload: 1.2, speed: 12, aa: 1200, armor: 0, turn: 1.2, eye: 2.3, tall: 2.1 },
  dshk: { hp: 1, range: 650, reload: 1.0, speed: 2, aa: 1100, armor: 0, turn: 2.5, eye: 1.3, tall: 1.2 },
  d30: { hp: 1, range: 9000, reload: 6, speed: 0, aa: 0, armor: 0, turn: 0.4, eye: 1.5, tall: 1.6 },
  grad: { hp: 1, range: 12000, reload: 999, speed: 9, aa: 0, armor: 0, turn: 0.5, eye: 3, tall: 3 },
  patriot: { hp: 2, range: 0, reload: 0, speed: 0, aa: 0, armor: 0, turn: 0, eye: 5, tall: 9 },
  s400: { hp: 2, range: 0, reload: 0, speed: 0, aa: 0, armor: 0, turn: 0, eye: 5, tall: 8 },
  inf: { hp: 7, range: 350, reload: 2.2, speed: 1.6, aa: 0, armor: 0, turn: 3, eye: 1.6, tall: 1.7 },
  kornet: { hp: 3, range: 1600, reload: 40, speed: 1.3, aa: 0, armor: 0, turn: 2, eye: 1.1, tall: 1.0 },
};
export type UState = 'idle' | 'march' | 'deploy' | 'bound' | 'hold' | 'retreat' | 'scoot' | 'return' | 'reposition'
  | 'hide' | 'peek' | 'aim' | 'mounted' | 'dismount' | 'assault' | 'rush' | 'pin' | 'house' | 'counter' | 'overwatch';
export type Pose = 'stand' | 'run' | 'prone' | 'fire';
export type Role = 'line' | 'reserve' | 'assault' | 'support' | 'flank' | 'aa' | 'arty';
export interface Unit {
  id: number; kind: Kind; side: Side; name: string; group: string; p: V3; yaw: number; spd: number; hp: number; alive: boolean;
  cd: number; target: number; state: UState; goal: V3 | null; home: V3; team: number; slot: V3; cover: boolean;
  burst: number; burstT: number; shots: number; firedT: number; stateT: number; burnT: number;
  // v4
  role: Role; supp: number; pose: Pose; men: number; menMax: number; dead: V3[]; house: number; mount: number; carry: number;
  fire: V3[]; hide: V3 | null; fi: number; ammo: number; rpg: number; rpgCd: number; seenT: number; peekShots: number; aimT: number;
}
export type AirKind = 'shahed' | 'kh101' | 'iskander' | 'pac2' | 'n48' | 'rocket' | 'shell' | 'atgm' | 'rpg' | 'smoke';
export const AIR_AR: Record<AirKind, string> = { shahed: 'شاهد-136', kh101: 'كروز Kh-101', iskander: 'باليستي إسكندر', pac2: 'معترض PAC-2', n48: 'معترض 48N6 · S-400', rocket: 'صاروخ غراد', shell: 'قذيفة 122 ملم', atgm: 'صاروخ كورنيت', rpg: 'قذيفة RPG-7', smoke: 'قذيفة دخان' };
export interface Air {
  id: number; kind: AirKind; side: Side; p: V3; v: V3; alive: boolean; t: number; aim: V3; siteName?: string; siteId?: string;
  tgtAir?: number; miss: number; dive?: boolean; shotsAt: number; phase: 'eject' | 'boost' | 'cruise'; ign: boolean;
  tgtUnit?: number; owner?: number; hit?: boolean;
}
export interface Smoke { p: V3; r: number; t0: number; until: number }
// ===== أحداث للرسم =====
export type Fx =
  | { k: 'gun'; unit: number; p: V3; dir: V3; big: boolean }                  // مدفع دبابة/هاوتزر: لهب + غبار + ارتداد
  | { k: 'round'; unit: number; p: V3; dir: V3; to: V3; tracer: boolean; tf: number; hit: 'air' | 'metal' | 'ground' } // طلقة رشاش
  | { k: 'volley'; unit: number; p: V3; to: V3; n: number; tracer: boolean; inf: boolean }  // رمي بنادق/رشاش خفيف (مشاة)
  | { k: 'cannon'; unit: number; p: V3; dir: V3; to: V3; tf: number }        // مدفع 30 ملم (BMP)
  | { k: 'shell'; a: V3; b: V3; tf: number }                                  // قذيفة دبابة سريعة (خط مضيء)
  | { k: 'killshot'; shooter: number; target: number; tf: number }            // قذيفة راح تدمّر الهدف — للمخرج
  | { k: 'boom'; p: V3; size: number; air: boolean; metal?: boolean }
  | { k: 'plaunch'; muzzle: V3; rear: V3; dir: V3; air: number }              // إطلاق ساخن (باتريوت)
  | { k: 'eject'; p: V3; dir: V3; air: number }                               // إطلاق بارد (S-400): قذف بالغاز
  | { k: 'ignite'; air: number; p: V3 }                                       // اشتعال المحرك بالجو
  | { k: 'rlaunch'; unit: number; p: V3; dir: V3 }                            // صاروخ غراد
  | { k: 'atgm'; unit: number; p: V3; dir: V3; air: number; rpg: boolean }    // إطلاق كورنيت أو RPG
  | { k: 'smoke'; p: V3; r: number; dur: number }                             // ستارة دخان
  | { k: 'houseHit'; house: number; p: V3; destroyed: boolean }
  | { k: 'manDown'; unit: number; p: V3 }                                     // جندي انصاب
  | { k: 'dismount'; unit: number; p: V3 }
  | { k: 'kill'; unit: number; turret: boolean }
  | { k: 'siteHit'; site: string; p: V3; big: boolean }
  | { k: 'threat'; air: number; tti: number }                                 // تهديد قريب يضرب (للمخرج)
  | { k: 'intercept'; p: V3; big: boolean }
  | { k: 'phase'; side: Side; phase: string; p: V3 }                          // تغيّر مرحلة (للمخرج)
  | { k: 'mark'; p: V3; text: string; good: boolean };
export interface LogLine { t: number; text: string; good: boolean | null; p: V3 }
export type Order = 'barrage' | 'smoke' | 'retreat' | 'counter' | 'aaPriority';
export const ORDER_CD: Record<Order, number> = { barrage: 45, smoke: 40, retreat: 60, counter: 9999, aaPriority: 5 };
export type EnPhase = 'march' | 'approach' | 'breach' | 'assault' | 'retreat';
export type IqPhase = 'line1' | 'line2' | 'counter';

export interface World {
  T: number; units: Unit[]; air: Air[]; fx: Fx[]; log: LogLine[]; r: () => number; nextId: number; over: boolean; result: '' | 'win' | 'loss' | 'draw';
  stats: { drones: number; dronesDown: number; dronesHit: number; cruise: number; cruiseDown: number; cruiseHit: number; ballistic: number; ballisticDown: number; ballisticHit: number;
    enTanks: number; enTanksLost: number; iqTanks: number; iqTanksLost: number; pacFired: number; n48Fired: number; rockets: number; shells: number; rounds: number;
    enBmpLost: number; enBmp: number; enMen: number; enMenLost: number; iqMen: number; iqMenLost: number; housesLost: number; atgm: number; rpg: number; counterT: number; fallbackT: number };
  schedule: { t: number; f: (w: World) => void; done?: boolean }[];
  orderCd: Record<Order, number>; aaPriority: boolean; columnPhase: string; boundTeam: number; boundT: number;
  en: EnPhase; iq: IqPhase; enT: number; iqT: number; smoke: Smoke[]; known: Record<Side, Map<number, number>>; houseHp: number[]; houseOwner: (Side | '')[]; spotT: number; dbg: Record<string, number>;
}
const WEST: V3 = [-1, 0, 0], EAST: V3 = [1, 0, 0];
const COLUMN = 'رتل مدرّع معادي';
export const VILLAGE_C: V3 = [-1480, 0, HIGHWAY_Z + 10];
export const FRONT_HOUSES = HOUSES.filter(h => h.vil === 'front');
const RESERVE_P: V3 = [-760, 0, 380], COUNTER_P: V3 = [-1260, 0, 60], KORNET_P: V3 = [-2108, 0, 165], KORNET_P2: V3 = [-1640, 0, 85];

export function newWorld(seed = 11): World {
  const w: World = {
    T: 0, units: [], air: [], fx: [], log: [], r: rng(seed), nextId: 1, schedule: [], over: false, result: '',
    stats: { drones: 0, dronesDown: 0, dronesHit: 0, cruise: 0, cruiseDown: 0, cruiseHit: 0, ballistic: 0, ballisticDown: 0, ballisticHit: 0, enTanks: 0, enTanksLost: 0, iqTanks: 0, iqTanksLost: 0, pacFired: 0, n48Fired: 0, rockets: 0, shells: 0, rounds: 0,
      enBmpLost: 0, enBmp: 0, enMen: 0, enMenLost: 0, iqMen: 0, iqMenLost: 0, housesLost: 0, atgm: 0, rpg: 0, counterT: 0, fallbackT: 0 },
    orderCd: { barrage: 0, smoke: 0, retreat: 0, counter: 0, aaPriority: 0 }, aaPriority: false, columnPhase: 'march', boundTeam: 0, boundT: 0,
    en: 'march', iq: 'line1', enT: 0, iqT: 0, smoke: [], known: { iq: new Map(), en: new Map() }, houseHp: HOUSES.map(() => 3), houseOwner: HOUSES.map(() => ''), spotT: 0, dbg: {},
  };
  const U = (kind: Kind, side: Side, p: V3, dir: V3, group: string, extra: Partial<Unit> = {}) => {
    const sp = SPEC[kind];
    const u: Unit = { id: w.nextId++, kind, side, name: KIND_AR[kind], group, p: [...p] as V3, yaw: yawOf(dir), spd: 0, hp: sp.hp, alive: true, cd: 1 + w.r() * 3,
      target: 0, state: 'idle', goal: null, home: [...p] as V3, team: 0, slot: [0, 0, 0], cover: false, burst: 0, burstT: 0, shots: 0, firedT: -99, stateT: 0, burnT: 0,
      role: 'line', supp: 0, pose: 'stand', men: kind === 'inf' ? 7 : kind === 'kornet' ? 3 : 0, menMax: kind === 'inf' ? 7 : kind === 'kornet' ? 3 : 0, dead: [], house: -1, mount: 0, carry: 0,
      fire: [], hide: null, fi: 0, ammo: kind === 'kornet' ? 4 : 0, rpg: kind === 'inf' ? 3 : 0, rpgCd: 0, seenT: -99, peekShots: 0, aimT: 0, ...extra };
    if (kind === 'inf' || kind === 'kornet') u.hp = u.men;
    w.units.push(u); return u;
  };
  // --- العراق: الخط الأول على التلّة (أبرامز ورا السواتر)، مشاة بالبيوت، كورنيت على الجنب، احتياط ورا التل ---
  BERMS.forEach((b, i) => {
    const hide: V3 = add(b, [95, 0, (i - 1) * 25]);
    const fire = [hullDownSpot(w, add(b, [70, 0, 0]), add(b, [-1500, 0, 0])), hullDownSpot(w, add(b, [70, 0, i === 1 ? 50 : (i === 0 ? -45 : 45)]), add(b, [-1500, 0, 0]))].filter(Boolean) as V3[];
    if (!fire.length) fire.push(add(b, [26, 0, 0]));
    U('abrams', 'iq', hide, WEST, 'خط الأبرامز', { state: 'hide', fire, hide, role: 'line', cd: 3 + i * 2 });
  });
  U('dshk', 'iq', [-1870, 0, HIGHWAY_Z - 70], WEST, 'سيطرة الطريق', { role: 'aa' }); U('dshk', 'iq', [-1870, 0, HIGHWAY_Z + 70], WEST, 'سيطرة الطريق', { role: 'aa' });
  U('technical', 'iq', [-1790, 0, HIGHWAY_Z - 22], WEST, 'سيطرة الطريق', { role: 'aa' });
  U('d30', 'iq', [-1050, 0, -720], WEST, 'كتيبة مدفعية', { role: 'arty' }); U('d30', 'iq', [-1050, 0, -600], WEST, 'كتيبة مدفعية', { role: 'arty' });
  // مشاة بالبيوت الغربية من قرية الطريق (كل حضيرة ببيت)
  const westHouses = [...FRONT_HOUSES].sort((a, b) => a.x - b.x);
  const pickHouse = (zSign: number, k: number) => westHouses.filter(h => Math.sign(h.z - VILLAGE_C[2]) === zSign)[k];
  [pickHouse(-1, 0), pickHouse(1, 0), pickHouse(-1, 2), pickHouse(1, 3)].forEach((h, i) => {
    if (!h) return; const s = U('inf', 'iq', [h.x, 0, h.z], WEST, 'مشاة القرية', { state: 'house', house: h.i, role: 'line', team: i }); w.houseOwner[h.i] = 'iq'; void s;
  });
  U('kornet', 'iq', KORNET_P, WEST, 'فريق كورنيت', { role: 'flank', state: 'hold' });
  // الاحتياط: دبابتين و BMP بيها حضيرة، ورا التل شمال القرية
  U('abrams', 'iq', add(RESERVE_P, [0, 0, -30]), [0, 0, -1], 'الاحتياط', { role: 'reserve', state: 'hold' });
  U('abrams', 'iq', add(RESERVE_P, [30, 0, 10]), [0, 0, -1], 'الاحتياط', { role: 'reserve', state: 'hold' });
  const rb = U('bmp', 'iq', add(RESERVE_P, [-35, 0, 25]), [0, 0, -1], 'الاحتياط', { role: 'reserve', state: 'hold', name: 'BMP-1 عراقية' });
  const rs = U('inf', 'iq', rb.p, [0, 0, -1], 'الاحتياط', { role: 'reserve', state: 'mounted', mount: rb.id }); rb.carry = rs.id;
  U('technical', 'iq', add(site('green').p, [-120, 0, 90]), [0, 0, 1], 'دفاع قرية الوادي', { role: 'aa' });
  U('technical', 'iq', add(site('dora').p, [-140, 0, 110]), [0, 0, 1], 'دفاع الخزانات', { role: 'aa' });
  U('technical', 'iq', add(site('taji').p, [150, 0, -150]), [0, 0, 1], 'دفاع معسكر التل', { role: 'aa' });
  U('patriot', 'iq', PATRIOT_POS, [0, 0, 1], 'بطارية باتريوت', { yaw: PATRIOT_YAW, role: 'aa' });
  U('s400', 'iq', S400_POS, [0, 0, 1], 'بطارية S-400', { yaw: S400_YAW, role: 'aa' });
  // --- العدو: سرية دبابات + فصيل BMP بيها مشاة + بيكبات، وراجمتين ---
  for (let i = 0; i < 6; i++) U('t72', 'en', [-3250 - i * 45, 0, HIGHWAY_Z + (i % 2 ? 8 : -8)], EAST, COLUMN, { state: 'march', team: i % 2, role: 'assault' });
  for (let i = 0; i < 4; i++) {
    const b = U('bmp', 'en', [-3560 - i * 45, 0, HIGHWAY_Z + (i % 2 ? 8 : -8)], EAST, COLUMN, { state: 'march', team: 2, role: 'assault' });
    const s = U('inf', 'en', b.p, EAST, 'مشاة العدو', { state: 'mounted', mount: b.id, role: 'assault', team: i, men: 9, menMax: 9, hp: 9 }); b.carry = s.id;
  }
  ['technical', 'technical'].forEach((k, i) => U(k as Kind, 'en', [-3760 - i * 45, 0, HIGHWAY_Z + (i ? 8 : -8)], EAST, COLUMN, { state: 'march', team: 3, role: 'support' }));
  U('grad', 'en', [-5100, 0, -1350], EAST, 'راجمات العدو', { role: 'arty' }); U('grad', 'en', [-5060, 0, -1460], EAST, 'راجمات العدو', { role: 'arty' });
  w.stats.enTanks = 6; w.stats.iqTanks = 5; w.stats.enBmp = 4;
  w.stats.enMen = w.units.filter(u => u.side === 'en' && u.kind === 'inf').reduce((s, u) => s + u.men, 0);
  w.stats.iqMen = w.units.filter(u => u.side === 'iq' && (u.kind === 'inf' || u.kind === 'kornet')).reduce((s, u) => s + u.men, 0);

  // --- جدول الهجمات الجوية (موزّعة على عشر دقايق) ---
  const D = (deg: number) => deg * Math.PI / 180;
  const drones = (t: number, list: [number, string][]) => w.schedule.push({ t, f: (w) => list.forEach(([deg, sid], i) => {
    const s = site(sid), dir: V3 = [Math.sin(D(deg)), 0, Math.cos(D(deg))], start = add(s.p, scale(dir, 2500 + i * 220));
    start[1] = 120 + w.r() * 40; spawnAir(w, 'shahed', 'en', start, scale(norm(sub(s.p, start)), 50), s); w.stats.drones++;
  }) });
  drones(8, [[-70, 'airport'], [-60, 'green'], [-80, 'dora']]);
  drones(200, [[-120, 'dora'], [-35, 'green'], [-100, 'rasheed'], [-25, 'taji']]);
  drones(430, [[-60, 'airport'], [-45, 'green']]);
  const cruise = (t: number, sid: string, deg: number) => w.schedule.push({ t, f: (w) => {
    const s = site(sid), dir: V3 = [Math.sin(D(deg)), 0, Math.cos(D(deg))], start = add(s.p, scale(dir, 8000)); start[1] = 60;
    spawnAir(w, 'kh101', 'en', start, scale(norm(sub(s.p, start)), 235), s); w.stats.cruise++;
    w.log.push({ t: w.T, text: `رادار الباتريوت رصد ${AIR_AR.kh101} متجه نحو ${s.name}`, good: null, p: start });
  } });
  cruise(60, 'green', -48); cruise(66, 'dora', -60);
  const ballistic = (t: number, sid: string, deg: number) => w.schedule.push({ t, f: (w) => {
    const s = site(sid), dir: V3 = [Math.sin(D(deg)), 0, Math.cos(D(deg))], start = add(s.p, scale(dir, 9500)); start[1] = 21000;
    spawnAir(w, 'iskander', 'en', start, scale(norm(sub(s.p, start)), 1450), s); w.stats.ballistic++;
    w.log.push({ t: w.T, text: `إنذار: ${AIR_AR.iskander} نازل من ارتفاع 21 كم نحو ${s.name}`, good: false, p: start });
  } });
  ballistic(150, 'green', -40); ballistic(360, 'taji', -55);
  // رشقات الغراد: على التلّة وحافة القرية
  const salvo = (t: number, aimX: number) => w.schedule.push({ t, f: (w) => {
    const gs = w.units.filter(u => u.kind === 'grad' && u.alive); if (!gs.length) return;
    gs.forEach((g, gi) => { for (let i = 0; i < 16; i++) w.schedule.push({ t: w.T + i * 0.5 + gi * 0.23, f: (w) => { if (g.alive) fireRocket(w, g, aimX); } });
      w.schedule.push({ t: w.T + 12, f: (w) => { if (g.alive) { g.state = 'reposition'; g.goal = add(g.p, [-150, 0, -330 + gi * 70]); } } }); });
    w.log.push({ t: w.T, text: aimX < -1900 ? 'راجمات الغراد المعادية تضرب خط الأبرامز على التلّة' : 'راجمات الغراد المعادية تضرب حافة قرية الطريق', good: false, p: gs[0].p });
  } });
  salvo(25, -2050); salvo(95, -1680); salvo(250, -1640);
  // مدفعية العدو (من بعيد، ما تنشاف): قصف على التلّة حتى تطمّس الأبرامز راسها وقت تقدم الدبابات
  const arty = (t: number, n: number) => w.schedule.push({ t, f: (w) => { for (let i = 0; i < n; i++) w.schedule.push({ t: w.T + i * 1.1, f: (w) => {
    const aim: V3 = [-2060 + (w.r() - 0.5) * 120, 0, HIGHWAY_Z + (w.r() - 0.5) * 320];
    const a = spawnAir(w, 'shell', 'en', [aim[0] - 600, 900, aim[2]], [600 / 6, -150, 0], undefined, undefined, aim); void a; } });
    w.log.push({ t: w.T, text: 'مدفعية العدو تقصف التلّة حتى تغطي تقدم الدبابات', good: false, p: [-2060, 0, HIGHWAY_Z] }); } });
  arty(110, 10); arty(175, 10); arty(235, 8);
  return w;
}

function spawnAir(w: World, kind: AirKind, side: Side, p: V3, v: V3, s?: Site, tgtAir?: number, aim?: V3): Air {
  const a: Air = { id: w.nextId++, kind, side, p: [...p] as V3, v, alive: true, t: 0, aim: aim ?? (s ? [...s.p] as V3 : [0, 0, 0]), siteName: s?.name, siteId: s?.id, tgtAir, miss: 1e9, shotsAt: 0, phase: 'cruise', ign: true };
  w.air.push(a); return a;
}
function fireRocket(w: World, g: Unit, aimX = -2000) {
  const aim: V3 = [aimX + (w.r() - 0.5) * 380, 0, HIGHWAY_Z + (w.r() - 0.5) * 460];
  const from: V3 = add(g.p, rotY([0, 3.2, -2.8], g.yaw)), d = dist2d(from, aim), tf = 11 + w.r() * 1.5;
  const vh = d / tf, vy = 0.5 * 9.81 * tf, dir = norm([aim[0] - from[0], 0, aim[2] - from[2]]), v: V3 = [dir[0] * vh, vy, dir[2] * vh];
  spawnAir(w, 'rocket', 'en', from, v, undefined, undefined, aim);
  w.fx.push({ k: 'rlaunch', unit: g.id, p: from, dir: norm(v) }); w.stats.rockets++;
}
function fireShell(w: World, u: Unit, aim: V3, kind: AirKind = 'shell') {
  const from: V3 = add(u.p, [0, 2, 0]), d = dist2d(from, aim), tf = 7 + d / 700;
  const vh = d / tf, vy = 0.5 * 9.81 * tf, dir = norm([aim[0] - from[0], 0, aim[2] - from[2]]);
  spawnAir(w, kind, u.side, from, [dir[0] * vh, vy, dir[2] * vh], undefined, undefined, aim);
  u.yaw = yawOf(dir);
  w.fx.push({ k: 'gun', unit: u.id, p: add(u.p, add(scale(dir, 4), [0, 1.6, 0])), dir: norm([dir[0], 0.7, dir[2]]), big: true }); w.stats.shells++;
}

// ===== الرؤية: تلال + بيوت + دخان =====
const gh = (p: V3) => groundH(p[0], p[2]);
function lineClear(w: World, a: V3, b: V3, skipA = -1, skipB = -1) {
  const d = dist2d(a, b), n = Math.max(4, Math.ceil(d / (d < 400 ? 12 : 24)));
  for (let i = 1; i < n; i++) { const t = i / n, x = lerp(a[0], b[0], t), z = lerp(a[2], b[2], t); if (groundH(x, z) > lerp(a[1], b[1], t) - 0.25) return false; }
  for (const s of w.smoke) {
    if (w.T > s.until) continue; const k = clamp(((s.p[0] - a[0]) * (b[0] - a[0]) + (s.p[2] - a[2]) * (b[2] - a[2])) / (d * d || 1), 0, 1);
    if (Math.hypot(a[0] + (b[0] - a[0]) * k - s.p[0], a[2] + (b[2] - a[2]) * k - s.p[2]) < s.r * clamp((w.T - s.t0) / 6, 0.3, 1) && lerp(a[1], b[1], k) < gh(s.p) + 22) return false;
  }
  const h = houseBlocks(a[0], a[2], b[0], b[2], skipA);
  if (h && h.i !== skipB) { const t = clamp(((h.x - a[0]) * (b[0] - a[0]) + (h.z - a[2]) * (b[2] - a[2])) / (d * d || 1), 0, 1); if (lerp(a[1], b[1], t) < groundH(h.x, h.z) + h.h) return false; }
  return true;
}
const eyeH = (u: Unit) => (u.kind === 'inf' && u.pose === 'prone' ? 0.5 : SPEC[u.kind].eye);
/** شكد الهدف ظاهر للرامي (0..1): الجزء الأعلى (البرج) والوسط؛ داخل البيت يبين بس من الشبابيك */
function visOf(w: World, from: Unit, to: Unit) {
  const tall = to.kind === 'inf' && to.pose === 'prone' ? 0.5 : SPEC[to.kind].tall;
  const e: V3 = [from.p[0], gh(from.p) + eyeH(from), from.p[2]];
  const top: V3 = [to.p[0], gh(to.p) + tall * 0.93, to.p[2]], mid: V3 = [to.p[0], gh(to.p) + tall * 0.5, to.p[2]];
  let v = (lineClear(w, e, top, from.house, to.house) ? 0.4 : 0) + (lineClear(w, e, mid, from.house, to.house) ? 0.6 : 0);
  if (to.house >= 0) v *= dist2d(from.p, to.p) < 450 ? 0.45 : 0.15;
  return v;
}
/** ساتر طبيعي: الجسم مخفي والبرج ظاهر = صعب ينضرب */
const hullDown = (w: World, from: Unit, to: Unit) => { const v = visOf(w, from, to); return v > 0 && v < 0.6; };

/** نلگى موقع رمي «جسم مخفي»: نتقدم من مكان الاختباء نحو العدو لحد ما البرج يشوف ساحة القتال وبس */
export function hullDownSpot(w: World, from: V3, toward: V3, maxAdv = 60): V3 | null {
  const dir = norm([toward[0] - from[0], 0, toward[2] - from[2]]);
  for (let s = 0; s <= maxAdv; s += 2) {
    const p: V3 = [from[0] + dir[0] * s, 0, from[2] + dir[2] * s], g = gh(p);
    const far: V3 = [p[0] + dir[0] * 500, 0, p[2] + dir[2] * 500], ft: V3 = [far[0], gh(far) + 1.5, far[2]];
    if (lineClear(w, [p[0], g + SPEC.abrams.eye, p[2]], ft)) return p;
  }
  return null;
}
// ===== أدوات القتال =====
const isColumn = (u: Unit) => u.group === COLUMN;
const isTank = (u: Unit) => u.kind === 'abrams' || u.kind === 't72';
const isVeh = (u: Unit) => SPEC[u.kind].armor > 0 || u.kind === 'technical';
const ground = (u: Unit) => u.kind !== 'patriot' && u.kind !== 's400' && u.kind !== 'grad';
const byName = (u: Unit) => u.side === 'en' ? `${u.name} معادية` : u.name;
function kill(w: World, u: Unit, by: string) {
  u.alive = false; u.spd = 0; u.burnT = w.T;
  if (u.carry) { const s = w.units.find(x => x.id === u.carry && x.alive && x.state === 'mounted'); if (s) { const lost = Math.round(s.men * (0.12 + w.r() * 0.3)); casualty(w, s, lost, by); if (s.alive) { s.state = 'pin'; s.mount = 0; s.p = add(u.p, [3, 0, 3]); s.supp = 1; w.fx.push({ k: 'dismount', unit: s.id, p: s.p }); } } }
  const tank = isTank(u);
  w.fx.push({ k: 'kill', unit: u.id, turret: u.kind === 't72' }, { k: 'boom', p: add(u.p, [0, 1.5, 0]), size: tank ? 1.4 : 0.9, air: false, metal: true });
  if (u.kind === 't72') w.stats.enTanksLost++;
  if (u.kind === 'abrams') w.stats.iqTanksLost++;
  if (u.kind === 'bmp' && u.side === 'en') w.stats.enBmpLost++;
  const good = u.side === 'en';
  w.log.push({ t: w.T, text: `${by} دمّرت ${u.name} ${good ? 'معادية' : 'عراقية'}${u.kind === 't72' ? ' — طار برجها من انفجار الذخيرة' : ''}`, good, p: u.p });
  w.fx.push({ k: 'mark', p: add(u.p, [0, 10, 0]), text: good ? `💥 ${u.name}` : `✗ ${u.name}`, good });
}
function casualty(w: World, u: Unit, n: number, by: string) {
  n = Math.min(n, u.men); if (n <= 0) return;
  for (let i = 0; i < n; i++) { const p = add(u.p, [(w.r() - 0.5) * 14, 0, (w.r() - 0.5) * 14]); u.dead.push(p); w.fx.push({ k: 'manDown', unit: u.id, p }); }
  u.men -= n; u.hp = u.men; if (u.side === 'en') w.stats.enMenLost += n; else w.stats.iqMenLost += n;
  const kk = u.side + ':' + by.replace(/ معادية| \(RPG\)/g, ''); w.dbg[kk] = (w.dbg[kk] ?? 0) + n;
  if (u.men <= 0) {
    u.alive = false; if (u.house >= 0 && w.houseOwner[u.house] === u.side) w.houseOwner[u.house] = '';
    const good = u.side === 'en'; w.log.push({ t: w.T, text: `${by} قضت على ${u.name} ${good ? 'معادية' : 'عراقية'}`, good, p: u.p });
    w.fx.push({ k: 'mark', p: add(u.p, [0, 8, 0]), text: good ? `✓ ${u.name}` : `✗ ${u.name}`, good });
  }
}
function damage(w: World, u: Unit, amount: number, by: string) {
  if (!u.alive) return;
  if (u.kind === 'inf' || u.kind === 'kornet') { casualty(w, u, Math.max(1, Math.round(amount)), by); return; }
  u.hp -= amount; u.supp = Math.min(1, u.supp + 0.5);
  if (u.hp <= 0) kill(w, u, by);
}
function suppress(w: World, p: V3, r: number, amt: number, side: Side) {
  for (const u of w.units) if (u.alive && u.side !== side && ground(u) && dist2d(u.p, p) < r) u.supp = Math.min(1, u.supp + amt * (u.house >= 0 ? 0.6 : 1) * (isVeh(u) ? 0.4 : 1));
}
function hitHouse(w: World, hi: number, dmg: number) {
  if (w.houseHp[hi] <= 0) return;
  w.houseHp[hi] -= dmg; const h = HOUSES[hi], destroyed = w.houseHp[hi] <= 0;
  w.fx.push({ k: 'houseHit', house: hi, p: [h.x, h.h * 0.6, h.z], destroyed });
  if (destroyed) { (h as House & { dead?: boolean }).dead = true; w.stats.housesLost++;
    for (const u of w.units) if (u.alive && u.house === hi) { casualty(w, u, 1 + Math.floor(w.r() * 3), 'انهيار البيت'); if (u.alive) { u.house = -1; u.state = u.side === 'iq' ? 'retreat' : 'assault'; u.supp = 1; } }
    w.houseOwner[hi] = ''; }
}
function blast(w: World, p: V3, rSoft: number, rHard: number, dmgSoft: number, dmgHard: number, by: string, side: Side) {
  for (const u of w.units) {
    if (!u.alive || u.side === side || !ground(u) || u.state === 'mounted') continue;
    const d = dist2d(u.p, p), hard = SPEC[u.kind].armor > 0;
    if (u.kind === 'inf' || u.kind === 'kornet') { if (d < rSoft * 1.6) { const exp = u.house >= 0 ? 0.25 : u.pose === 'prone' ? 0.45 : 1; const n = Math.round((1 - d / (rSoft * 1.6)) * 3 * exp * dmgSoft * w.r() * 1.4); if (n > 0) casualty(w, u, n, by); } }
    else if (hard ? d < rHard : d < rSoft) damage(w, u, hard ? dmgHard : dmgSoft, by);
  }
  suppress(w, p, rSoft * 2.5, 0.5, side);
  for (const h of HOUSES) if (Math.hypot(h.x - p[0], h.z - p[2]) < Math.max(h.w, h.d) * 0.6 + rSoft * 0.25) hitHouse(w, h.i, dmgSoft * 0.8);
}

// ===== أوامر اللاعب (I-033): خمسة أوامر قليلة =====
export function order(w: World, o: Order, at?: V3): string | null {
  if (w.orderCd[o] > w.T) return o === 'counter' ? 'الهجوم المعاكس صار أو الاحتياط ما بقى' : `الأمر يرجع متاح بعد ${Math.ceil(w.orderCd[o] - w.T)} ثانية`;
  if (o === 'counter' && w.iq === 'counter') return 'الهجوم المعاكس شغّال';
  if (o === 'retreat' && w.iq !== 'line1') return 'المدافعين أصلاً بالخط الثاني';
  const foes = w.units.filter(u => u.side === 'en' && u.alive && ground(u) && u.kind !== 'grad' && u.state !== 'mounted');
  const target = at ?? (foes.length ? scale(foes.reduce((s, u) => add(s, u.p), [0, 0, 0] as V3), 1 / foes.length) : null);
  if ((o === 'barrage' || o === 'smoke') && !target) return 'ماكو هدف';
  w.orderCd[o] = w.T + ORDER_CD[o];
  if (o === 'barrage') {
    w.units.filter(u => u.kind === 'd30' && u.alive).forEach((g, gi) => { for (let i = 0; i < 6; i++) w.schedule.push({ t: w.T + i * 1.4 + gi * 0.5, f: (w) => { if (g.alive) fireShell(w, g, add(target!, [(w.r() - 0.5) * 110, 0, (w.r() - 0.5) * 110])); } }); });
    w.log.push({ t: w.T, text: 'أمرك: رشقة مدفعية مركّزة', good: null, p: target! });
  }
  if (o === 'smoke') { const g = w.units.find(u => u.kind === 'd30' && u.alive); if (!g) return 'المدفعية ما بقت';
    for (let i = 0; i < 4; i++) w.schedule.push({ t: w.T + i * 0.9, f: (w) => fireShell(w, g, add(target!, [(i - 1.5) * 45, 0, (w.r() - 0.5) * 30]), 'smoke') });
    w.log.push({ t: w.T, text: 'أمرك: ستارة دخان', good: null, p: target! }); }
  if (o === 'retreat') fallback(w, 'أمرك');
  if (o === 'counter') counter(w, 'أمرك');
  if (o === 'aaPriority') { w.aaPriority = !w.aaPriority; w.log.push({ t: w.T, text: w.aaPriority ? 'أمرك: الباتريوت يضرب المسيّرات هم (حماية أكثر، بس صواريخ غالية)' : 'أمرك: الباتريوت يرجع للكروز والباليستي بس', good: null, p: PATRIOT_POS }); }
  return null;
}

// ===== خطوة المحاكاة =====
export function step(w: World, dt: number) {
  w.T += dt;
  for (const s of w.schedule) if (!s.done && w.T >= s.t) { s.done = true; s.f(w); }
  if (w.T - w.spotT > 1) { w.spotT = w.T; spot(w); commanders(w); }
  for (const u of w.units) if (u.alive) { u.supp = Math.max(0, u.supp - dt * (isVeh(u) ? 0.35 : 0.16)); behave(w, u, dt); move(w, u, dt); fight(w, u, dt); }
  air(w, dt);
  w.smoke = w.smoke.filter(s => s.until > w.T);
  checkEnd(w);
}
/** كل طرف يعرف وين العدو إذا أي وحدة منه شايفته */
function spot(w: World) {
  for (const side of ['iq', 'en'] as Side[]) {
    const mine = w.units.filter(u => u.alive && u.side === side && ground(u) && u.state !== 'mounted' && u.kind !== 'd30');
    const known = w.known[side];
    for (const o of w.units) {
      if (!o.alive || o.side === side || !ground(o) || o.state === 'mounted') continue;
      const loud = w.T - o.firedT < 6 || o.spd > 2;
      const range = (o.kind === 'inf' || o.kind === 'kornet') ? (loud ? 450 : 280) : (loud ? 1400 : 1000);
      if (mine.some(m => dist2d(m.p, o.p) < range * (m.kind === 'kornet' ? 1.3 : 1) && visOf(w, m, o) > 0)) { known.set(o.id, w.T); o.seenT = w.T; }
    }
    for (const [id, t] of known) if (w.T - t > 20 || !w.units.find(u => u.id === id)?.alive) known.delete(id);
  }
}
const strength = (w: World, side: Side) => w.units.filter(u => u.side === side && u.alive && ground(u) && u.role !== 'aa').reduce((s, u) => s + (isTank(u) ? 3 : u.kind === 'bmp' ? 1.5 : u.kind === 'inf' ? u.men / 4 : 0.6), 0);
const inVillage = (p: V3) => Math.hypot((p[0] - VILLAGE_C[0]) * 0.8, p[2] - VILLAGE_C[2]) < 230;

// ----- القادة الآليين -----
function commanders(w: World) {
  const en = w.units.filter(u => u.side === 'en' && u.alive && isColumn(u)), enInf = w.units.filter(u => u.side === 'en' && u.alive && u.kind === 'inf');
  const iqLine = w.units.filter(u => u.side === 'iq' && u.alive && u.role === 'line' && isTank(u));
  const front = en.length ? Math.max(...en.map(u => u.p[0])) : -9999;
  const s0 = w.stats.enTanks * 3 + w.stats.enBmp * 1.5 + w.stats.enMen / 4 + 1.2, sEn = strength(w, 'en') - w.units.filter(u => u.side === 'en' && u.alive && u.kind === 'grad').length * 0.6;
  // العدو
  if (w.en === 'march' && w.T > 35) setEn(w, 'approach', 'الرتل المعادي ترك الطريق وانتشر للهجوم', false);
  if (w.en === 'approach' && (w.T > 290 || (w.iq !== 'line1' && w.T > 200) || (w.T > 230 && en.filter(isTank).length >= 4))) {
    setEn(w, 'breach', 'العدو يرمي دخان ويندفع نحو التلّة والقرية', false);
    for (let i = 0; i < 5; i++) w.schedule.push({ t: w.T + i * 1.2, f: (w) => addSmoke(w, [-2120 + (w.r() - 0.5) * 60, 0, HIGHWAY_Z + (i - 2) * 75], 46, 70) });
  }
  if (w.en === 'breach' && w.units.every(u => !(u.side === 'en' && u.kind === 'inf' && u.state === 'mounted' && u.alive))) {
    setEn(w, 'assault', 'مشاة العدو نزلوا ويقتحمون قرية الطريق', false);
    // ستارة دخان كثيفة بين التلّة والقرية حتى يعبرون المشاة، وتتجدد بعد دقيقة ونص
    for (const t0 of [0, 85]) for (let i = 0; i < 6; i++) w.schedule.push({ t: w.T + t0 + i * 0.7, f: (w) => addSmoke(w, [(i % 2 ? -1830 : -1990) + (w.r() - 0.5) * 40, 0, HIGHWAY_Z + (Math.floor(i / 2) - 1) * 105 + (w.r() - 0.5) * 30], 62, 95) });
  }
  const heldEn = FRONT_HOUSES.filter(h => w.houseOwner[h.i] === 'en').length;
  if (w.en !== 'retreat' && w.en !== 'march' && ((sEn < s0 * 0.26 && w.T > 300) || (w.iq === 'counter' && w.T - w.iqT > 80 && sEn < s0 * 0.45) || (w.T > 610 && heldEn < FRONT_HOUSES.length * 0.35))) {
    setEn(w, 'retreat', 'العدو خسر أغلب قوته وبدأ ينسحب غرباً', true);
    for (const u of w.units) if (u.side === 'en' && u.alive && ground(u) && u.kind !== 'grad') { u.state = 'retreat'; u.goal = [-5400, 0, u.p[2] + (w.r() - 0.5) * 200]; u.house = -1; }
  }
  // العراق
  const lostLine = w.stats.iqTanksLost >= 1 || iqLine.length < 3;
  if (w.iq === 'line1' && ((front > -2100 - 430 && (lostLine || w.T > 280)) || front > -2100 - 230 || (w.en === 'breach' && w.T - w.enT > 25))) fallback(w, 'القائد');
  const enIn = enInf.filter(u => inVillage(u.p) || u.house >= 0).length;
  if (w.iq !== 'counter' && w.T > 330 && ((enIn >= 2 && en.filter(isTank).length <= 3) || (w.en === 'assault' && w.T - w.enT > 100) || w.T > 470)) counter(w, 'القائد');
}
function setEn(w: World, ph: EnPhase, text: string, good: boolean) {
  w.en = ph; w.enT = w.T; const c = w.units.find(u => u.side === 'en' && u.alive && isColumn(u))?.p ?? [-3000, 0, HIGHWAY_Z];
  w.log.push({ t: w.T, text, good, p: c }); w.fx.push({ k: 'phase', side: 'en', phase: ph, p: c }, { k: 'mark', p: add(c, [0, 30, 0]), text: ph === 'retreat' ? '↩ العدو ينسحب' : '⚠ ' + text.split(' ').slice(0, 4).join(' '), good });
}
function fallback(w: World, by: string) {
  if (w.iq !== 'line1') return; w.iq = 'line2'; w.iqT = w.T; w.stats.fallbackT = w.T; w.orderCd.retreat = w.T + 9999;
  // الأبرامز ترجع ورا البيوت بشرق القرية: تختبي ورا البيت وتطلع من جنبه
  const east = [...FRONT_HOUSES].filter(h => h.x > VILLAGE_C[0] + 60 && Math.abs(h.z - VILLAGE_C[2]) > 25).sort((a, b) => b.x - a.x);
  let k = 0;
  for (const u of w.units) {
    if (!u.alive || u.side !== 'iq' || u.role !== 'line') continue;
    if (isTank(u)) {
      const b2 = BERMS2[k % BERMS2.length], h = east[k * 3] ?? east[0]; k++;
      const hide: V3 = k <= 2 ? add(b2, [70, 0, 0]) : [h.x + 16, 0, h.z];
      u.hide = hide;
      const cands: V3[] = k <= 2 ? [add(b2, [60, 0, 0]), add(b2, [60, 0, (k % 2 ? 45 : -45)])] : [[h.x + 4, 0, h.z + Math.max(h.w, h.d) * 0.6 + 7], [h.x + 4, 0, h.z - Math.max(h.w, h.d) * 0.6 - 7]];
      u.fire = cands.map(c => hullDownSpot(w, c, add(c, [-1500, 0, 0]), 70)).filter(Boolean) as V3[];
      if (!u.fire.length) u.fire = [add(hide, [-40, 0, 0])];
      u.state = 'retreat'; u.goal = hide; u.fi = 0;
    } else if (u.kind === 'dshk' || u.kind === 'technical') { u.state = 'retreat'; u.goal = [-1560 + (w.r() - 0.5) * 60, 0, u.p[2] + (u.p[2] > HIGHWAY_Z ? 30 : -30)]; }
    else if (u.kind === 'kornet') { u.goal = [...KORNET_P2] as V3; }
  }
  w.log.push({ t: w.T, text: `${by}: الأبرامز تنسحب من التلّة لخط ثاني ورا بيوت القرية`, good: null, p: [-2050, 0, HIGHWAY_Z] });
  w.fx.push({ k: 'phase', side: 'iq', phase: 'line2', p: [-1700, 0, HIGHWAY_Z] }, { k: 'mark', p: [-2000, 40, HIGHWAY_Z], text: '↩ انسحاب للخط الثاني', good: false });
}
function counter(w: World, by: string) {
  if (w.iq === 'counter') return; const res = w.units.filter(u => u.side === 'iq' && u.alive && u.role === 'reserve');
  if (!res.length) return; w.iq = 'counter'; w.iqT = w.T; w.stats.counterT = w.T; w.orderCd.counter = w.T + 9999;
  // الهجوم يكون أقوى إذا العدو متشتت داخل القرية
  for (const u of res) { if (u.state === 'mounted') continue; u.state = 'counter'; u.stateT = 0; u.goal = add(COUNTER_P, [(w.r() - 0.5) * 80, 0, (w.r() - 0.5) * 40]); }
  for (const u of w.units) if (u.side === 'iq' && u.alive && u.role === 'line' && isTank(u)) { u.state = 'counter'; u.goal = add(u.p, [-220, 0, 0]); }
  w.log.push({ t: w.T, text: `${by}: هجوم معاكس! الاحتياط يضرب العدو من الجنب الشمالي`, good: true, p: RESERVE_P });
  w.fx.push({ k: 'phase', side: 'iq', phase: 'counter', p: COUNTER_P }, { k: 'mark', p: add(COUNTER_P, [0, 40, 0]), text: '⚔ هجوم معاكس', good: true });
}
function addSmoke(w: World, p: V3, r: number, dur: number) { w.smoke.push({ p, r, t0: w.T, until: w.T + dur }); w.fx.push({ k: 'smoke', p, r, dur }); }
function checkEnd(w: World) {
  if (w.over) return;
  const enAlive = w.units.filter(u => u.side === 'en' && u.alive && ground(u) && u.kind !== 'grad');
  const enGone = enAlive.every(u => u.state === 'retreat' && (u.p[0] < -3200 || dist2d(u.p, VILLAGE_C) > 1500)) || (w.en === 'retreat' && w.T - w.enT > 100);
  const pendingAir = w.air.some(a => a.alive && a.side === 'en' && (a.kind === 'shahed' || a.kind === 'kh101' || a.kind === 'iskander'));
  const iqLeft = w.units.filter(u => u.side === 'iq' && u.alive && ground(u) && u.role !== 'aa' && u.role !== 'arty').length;
  const held = FRONT_HOUSES.filter(h => w.houseOwner[h.i] === 'en').length, alive = FRONT_HOUSES.filter(h => w.houseHp[h.i] > 0).length;
  let res: World['result'] = '', text = '';
  if (w.en === 'retreat' && enGone && !pendingAir) { res = 'win'; text = 'انتهت المعركة: العدو انسحب والقرية بيدنا'; }
  else if (iqLeft === 0 || (w.T > 420 && held > alive * 0.6 && w.iq === 'counter' && w.T - w.iqT > 120)) { res = 'loss'; text = 'انتهت المعركة: العدو مسك قرية الطريق'; }
  else if (w.T > 780) { res = 'draw'; text = 'انتهت المعركة: الطرفين منهكين والقرية مقسومة'; }
  if (res) { w.over = true; w.result = res; w.log.push({ t: w.T, text, good: res === 'win' ? true : res === 'loss' ? false : null, p: VILLAGE_C }); }
}

// ----- سلوك كل وحدة -----
function behave(w: World, u: Unit, dt: number) {
  u.stateT += dt;
  if (u.state === 'mounted') { const b = w.units.find(x => x.id === u.mount); if (b) u.p = [...b.p] as V3; return; }
  // ---- العدو ----
  if (u.side === 'en' && isColumn(u)) {
    if (w.en === 'march') { u.state = 'march'; return; }
    if (w.en === 'approach') {
      // قفزات متبادلة: فريق يتقدم 280 م والثاني يغطي؛ توقف على 1500 م من التلّة
      if (u.kind === 't72' && (u.state === 'march' || ((u.state === 'hold' || u.state === 'overwatch') && u.stateT > 14 + w.r() * 6 && u.team === Math.floor(w.T / 24) % 2))) {
        if (u.p[0] < -2100 - 520) { u.state = 'bound'; u.stateT = 0; u.goal = coverNear(w, u, [u.p[0] + 120, 0, HIGHWAY_Z + (u.team ? 1 : -1) * (40 + u.id % 3 * 40)], 40); }
        else if (u.state !== 'overwatch') { u.state = 'overwatch'; u.stateT = 0; u.goal = null; }
      }
      if ((u.kind === 'bmp' || u.kind === 'technical') && (u.state === 'march' || u.state === 'hold') && u.stateT > 5) {
        const tanks = w.units.filter(x => x.alive && x.kind === 't72'); const back = tanks.length ? Math.min(...tanks.map(t => t.p[0])) - 220 : u.p[0];
        if (u.p[0] < back - 30) { u.state = 'bound'; u.stateT = 0; u.goal = [Math.min(back, u.p[0] + 150), 0, HIGHWAY_Z + (u.id % 3 - 1) * 55]; }
      }
      return;
    }
    if (w.en === 'breach' || w.en === 'assault') {
      if (u.kind === 't72' && (u.state !== 'bound' || u.stateT > 40) && u.state !== 'scoot' && u.state !== 'return') {
        // الدبابات تطلع للتلّة وتسند المشاة من فوق
        // الدبابات تتقدم بقفزات (300 م) لحد التلّة، وتسند المشاة من فوقها
        const slot: V3 = [-2150 + (u.id % 2) * 40, 0, HIGHWAY_Z + (u.id % 6 - 2.5) * 70];
        if (dist2d(u.p, slot) > 30) { if (u.state !== 'bound' && (u.state !== 'overwatch' || u.stateT > 6 + (u.id % 3) * 3)) { u.state = 'bound'; u.stateT = 0; u.goal = dist2d(u.p, slot) > 180 ? add(u.p, scale(norm(sub(slot, u.p)), 150)) : slot; } }
        else if (u.state !== 'overwatch') { u.state = 'overwatch'; u.stateT = 0; u.goal = null; }
      }
      if (u.kind === 'bmp' && u.carry) {
        const s = w.units.find(x => x.id === u.carry && x.alive && x.state === 'mounted');
        const drop: V3 = [-2270, 0, HIGHWAY_Z + (u.id % 4 - 1.5) * 90];
        const tanksUp = w.units.filter(x => x.alive && x.kind === 't72').some(x => x.p[0] > -2350) || w.T - w.enT > 75;
        if (s && (dist2d(u.p, drop) < 25 || u.hp < SPEC.bmp.hp * 0.45)) dismount(w, u, s);
        else if (s && tanksUp && u.state !== 'bound') { u.state = 'bound'; u.goal = drop; }
        else if (s && !tanksUp && u.state !== 'overwatch' && u.state !== 'bound') { u.state = 'bound'; u.goal = [-2560 - (u.id % 3) * 30, 0, HIGHWAY_Z + (u.id % 3 - 1) * 90]; }
        else if (!s && u.state !== 'overwatch' && u.state !== 'bound') { u.state = 'bound'; u.goal = [-2000 + (u.id % 3) * 40, 0, HIGHWAY_Z + (u.id % 3 - 1) * 90]; }
      }
      if (u.kind === 'technical' && u.state !== 'overwatch' && u.state !== 'bound') { u.state = 'bound'; u.goal = [-2250, 0, HIGHWAY_Z + (u.id % 2 ? 140 : -140)]; }
      return;
    }
  }
  if (u.kind === 'inf' && u.side === 'en' && u.state !== 'retreat') return infAssault(w, u, dt);
  if (u.kind === 'inf' && u.side === 'iq') return infDefend(w, u, dt);
  if (u.side === 'iq' && isTank(u) && u.hide && (u.role === 'line') && w.iq !== 'counter') return peekCycle(w, u);
  if (u.side === 'iq' && u.state === 'counter') {
    if (u.kind === 'bmp' && u.carry && u.goal && dist2d(u.p, u.goal) < 30) { const s = w.units.find(x => x.id === u.carry && x.alive && x.state === 'mounted'); if (s) { dismount(w, u, s); s.role = 'assault'; } }
    if (!u.goal || dist2d(u.p, u.goal) < 15) { const t = nearestFoe(w, u, 2500); if (t && u.stateT > 8) { u.goal = add(u.p, scale(norm(sub(t.p, u.p)), Math.min(160, dist2d(t.p, u.p) - 250))); u.stateT = 0; } }
  }
}
/** نختار نقطة قريبة بيها ساتر من العدو (تل، بيت) بدل نقطة مكشوفة */
function coverNear(w: World, u: Unit, p: V3, r: number): V3 {
  const foe = [...w.known[u.side].keys()].map(id => w.units.find(x => x.id === id)!).filter(Boolean)[0];
  if (!foe) return p;
  let best = p, bs = -1;
  for (let i = 0; i < 7; i++) {
    const c: V3 = i === 0 ? p : [p[0] + (w.r() - 0.5) * r * 2, 0, p[2] + (w.r() - 0.5) * r * 2];
    const e: V3 = [foe.p[0], gh(foe.p) + 2.6, foe.p[2]], mid: V3 = [c[0], gh(c) + 1.1, c[2]], top: V3 = [c[0], gh(c) + 2.3, c[2]];
    const s = (lineClear(w, e, mid) ? 0 : 2) + (lineClear(w, e, top) ? 1 : 0);
    if (s > bs) { bs = s; best = c; }
  }
  return best;
}
function dismount(w: World, b: Unit, s: Unit) {
  s.state = 'pin'; s.stateT = 0; s.mount = 0; b.carry = 0; s.p = add(b.p, rotY([0, 0, -6], b.yaw)); s.pose = 'prone';
  w.fx.push({ k: 'dismount', unit: s.id, p: s.p });
  if (s.side === 'en') w.log.push({ t: w.T, text: 'مشاة العدو نزلوا من BMP وانبطحوا', good: false, p: s.p });
  b.state = 'overwatch'; b.goal = null; b.stateT = 0;
}
/** دبابة دفاعية: تختبي ← تطلع لموقع رمي ← تنشن ← ترمي طلقة/طلقتين ← ترجع تختبي ← تطلع من مكان ثاني */
function peekCycle(w: World, u: Unit) {
  const foes = [...w.known.iq.keys()].map(id => w.units.find(x => x.id === id)!).filter(o => o && o.alive && dist2d(o.p, u.p) < SPEC[u.kind].range + 300);
  if (u.state === 'retreat') { if (u.goal && dist2d(u.p, u.goal) > 8) return; u.state = 'hide'; u.stateT = 0; }
  if (u.state === 'hide' || u.state === 'idle' || u.state === 'hold') {
    u.state = 'hide'; if (dist2d(u.p, u.hide!) > 8) { u.goal = u.hide; return; }
    u.goal = null;
    if (foes.length && u.cd <= 0 && u.stateT > 4 + w.r() * 4 && u.supp < 0.6) { u.fi = (u.fi + 1) % u.fire.length; u.state = 'peek'; u.stateT = 0; u.goal = u.fire[u.fi]; u.peekShots = 0; }
    return;
  }
  if (u.state === 'peek') { if (u.goal && dist2d(u.p, u.goal) > 6) return; u.state = 'aim'; u.stateT = 0; u.goal = null; return; }
  if (u.state === 'aim' && (u.peekShots >= 1 + (w.r() < 0.4 ? 1 : 0) || u.stateT > 11 || u.supp > 0.7)) { u.state = 'scoot'; u.stateT = 0; u.goal = u.hide; }
  if (u.state === 'scoot' && u.goal && dist2d(u.p, u.goal) < 8) { u.state = 'hide'; u.stateT = 0; u.goal = null; }
}
function nearestFoe(w: World, u: Unit, range: number, filt?: (o: Unit) => boolean) {
  let best: Unit | null = null, bd = range;
  for (const id of w.known[u.side].keys()) { const o = w.units.find(x => x.id === id); if (!o || !o.alive || (filt && !filt(o))) continue; const d = dist2d(o.p, u.p); if (d < bd) { bd = d; best = o; } }
  return best;
}
/** مشاة العدو: نار وحركة نحو البيوت، اقتحام بيت بيت */
function infAssault(w: World, u: Unit, dt: number) {
  if (u.house >= 0) { // ماسكين بيت: يرمون منه، وكل شوي يكملون للبيت الجاي
    if (u.stateT > 25 + w.r() * 20 && u.supp < 0.5) { u.house = -1; u.state = 'rush'; u.stateT = 0; } else { u.pose = 'fire'; return; } }
  const tgtHouse = nextHouse(w, u);
  if (!tgtHouse) { u.state = 'hold'; u.pose = 'fire'; return; }
  const hp: V3 = [tgtHouse.x, 0, tgtHouse.z], d = dist2d(u.p, hp);
  if (u.supp > 0.65 && u.state !== 'pin') { u.state = 'pin'; u.stateT = 0; u.goal = null; }
  if (u.state === 'pin') { u.pose = 'prone'; if (u.stateT > 5 && (u.supp < 0.45 || u.stateT > 14 + w.r() * 8)) { u.state = 'rush' as UState; u.stateT = 0; u.supp *= 0.5; u.goal = add(u.p, scale(norm(sub(hp, u.p)), Math.min(d, 40))); } return; }
  const close = w.units.some(o => o.alive && o.side === 'iq' && ground(o) && o.role !== 'aa' && dist2d(o.p, u.p) < 300);
  if (!close && u.state !== 'rush') { u.state = 'rush'; u.stateT = 0; u.goal = add(u.p, scale(norm(sub(hp, u.p)), Math.min(d, 120))); }
  if ((u.state as string) === 'fire' || u.state === 'idle' || u.state === 'hold' || u.state === 'assault') {
    u.pose = 'fire'; u.goal = null;
    if (u.stateT > 6 + w.r() * 5) { u.state = 'rush'; u.stateT = 0; u.goal = add(u.p, scale(norm(sub(hp, u.p)), Math.min(d, 45 + w.r() * 25))); }
    return;
  }
  if (u.state === 'rush') {
    u.pose = 'run';
    if (d < 14) { // وصلوا البيت: إذا بيه مدافعين = قتال قريب؛ إذا فارغ يمسكوه
      const def = w.units.find(o => o.alive && o.side === 'iq' && o.house === tgtHouse.i);
      if (def) closeFight(w, u, def, dt); else { u.house = tgtHouse.i; w.houseOwner[tgtHouse.i] = 'en'; u.state = 'house'; u.stateT = 0; u.p = [tgtHouse.x, 0, tgtHouse.z]; }
      return;
    }
    if (!u.goal || dist2d(u.p, u.goal) < 3 || u.stateT > 14) { u.state = 'fire' as UState; u.stateT = 0; }
  }
}
function nextHouse(w: World, u: Unit) {
  let best: House | null = null, bs = 1e9;
  for (const h of FRONT_HOUSES) { if (w.houseHp[h.i] <= 0 || w.houseOwner[h.i] === 'en') continue; const s = Math.hypot(h.x - u.p[0], h.z - u.p[2]) + (h.x - u.p[0]) * 0.6 + (w.houseOwner[h.i] === 'iq' ? -60 : 0); if (s < bs) { bs = s; best = h; } }
  return best;
}
function closeFight(w: World, a: Unit, b: Unit, dt: number) {
  // قتال من مسافة قريبة: كل ثانية خسائر حسب العدد والكبت؛ المدافع داخل البيت عنده أفضلية
  const pa = 0.09 * dt * a.men * (1 - a.supp * 0.5), pb = 0.12 * dt * b.men * (1 - b.supp * 0.5);
  if (w.r() < pb) casualty(w, a, 1, byName(b)); if (w.r() < pa) casualty(w, b, 1, byName(a));
  if (w.r() < dt * 2) w.fx.push({ k: 'volley', unit: a.id, p: add(a.p, [0, 1.3, 0]), to: add(b.p, [0, 1.5, 0]), n: 3, tracer: true, inf: true }, { k: 'volley', unit: b.id, p: add(b.p, [0, 2, 0]), to: add(a.p, [0, 1, 0]), n: 3, tracer: false, inf: true });
  if (b.alive && (b.men <= 2 || (b.men < a.men * 0.5 && w.r() < dt * 0.2))) { b.house = -1; b.state = 'retreat'; b.supp = 1; w.houseOwner[a.house >= 0 ? a.house : 0] = w.houseOwner[a.house >= 0 ? a.house : 0]; }
}
/** مشاة العراق: يدافعون من البيوت، وإذا البيت تهدّم أو الضغط كبير ينسحبون للبيت الشرقي الجاي */
function infDefend(w: World, u: Unit, dt: number) {
  if (u.role === 'assault') { // مشاة الاحتياط بالهجوم المعاكس
    if (u.state === 'mounted') return;
    const e = w.units.filter(o => o.alive && o.side === 'en' && o.kind === 'inf').sort((a, b) => dist2d(a.p, u.p) - dist2d(b.p, u.p))[0];
    if (!e) { u.state = 'hold'; u.pose = 'fire'; return; }
    const d = dist2d(e.p, u.p);
    if (d < 16) { closeFight(w, u, e, dt); return; }
    if (u.supp > 0.65) { u.pose = 'prone'; return; }
    if (u.state !== 'rush' && u.stateT > 6 + w.r() * 4) { u.state = 'rush'; u.stateT = 0; u.goal = add(u.p, scale(norm(sub(e.p, u.p)), Math.min(d, 50))); }
    else if (u.state === 'rush' && (!u.goal || dist2d(u.p, u.goal) < 3)) { u.state = 'hold'; u.stateT = 0; }
    u.pose = u.state === 'rush' ? 'run' : 'fire'; return;
  }
  if (u.state === 'house' && u.house >= 0) {
    u.pose = 'fire';
    const threat = w.units.some(o => o.alive && o.side === 'en' && o.kind === 'inf' && dist2d(o.p, u.p) < 60 && o.men > u.men * 1.6);
    if (w.houseHp[u.house] <= 0 || (u.men <= 2 && u.supp > 0.5) || (threat && u.supp > 0.8) || (w.iq !== 'line1' && u.stateT > 60 && u.p[0] < -1600 && w.r() < dt * 0.05)) { w.houseOwner[u.house] = ''; u.house = -1; u.state = 'retreat'; u.stateT = 0; }
    return;
  }
  if (u.state === 'retreat') {
    u.pose = 'run';
    if (!u.goal) { const h = FRONT_HOUSES.filter(h => w.houseHp[h.i] > 0 && w.houseOwner[h.i] === '' && h.x > u.p[0] + 30).sort((a, b) => dist2d([a.x, 0, a.z], u.p) - dist2d([b.x, 0, b.z], u.p))[0];
      u.goal = h ? [h.x, 0, h.z] : add(u.p, [250, 0, 0]); u.slot = h ? [h.i, 0, 0] : [-1, 0, 0]; }
    if (dist2d(u.p, u.goal) < 6) { const hi = u.slot[0]; if (hi >= 0 && w.houseHp[hi] > 0 && w.houseOwner[hi] === '') { u.house = hi; w.houseOwner[hi] = 'iq'; u.state = 'house'; u.stateT = 0; u.supp = 0.3; } else { u.goal = null; } }
  }
}

// ----- الحركة: توجيه + تسارع + دوران محدود -----
function move(w: World, u: Unit, dt: number) {
  const spec = SPEC[u.kind];
  if (u.state === 'mounted' || u.house >= 0 && u.kind === 'inf' && u.state === 'house') { u.spd = 0; return; }
  if (u.state === 'march') u.goal = [u.p[0] + 200, 0, HIGHWAY_Z + (u.team % 2 ? 7 : -7)];
  if (w.en === 'march' && isColumn(u) && u.p[0] > -2950) u.goal = null;
  const g = u.goal;
  if (!g || spec.speed === 0) { u.spd = Math.max(0, u.spd - 3 * dt); return; }
  const to = sub(g, u.p), d = dist2d(g, u.p);
  if (d < (u.kind === 'inf' ? 1.5 : 5)) {
    u.spd = Math.max(0, u.spd - 4 * dt);
    if (u.spd < 0.5) {
      if (u.state === 'deploy' || u.state === 'bound' || u.state === 'reposition') { u.state = isColumn(u) ? 'overwatch' : 'hold'; u.stateT = 0; u.goal = null; }
      else if (u.state === 'retreat' && !u.hide) u.goal = null;
      else if (u.state === 'counter' && u.kind !== 'inf') { u.goal = null; }
    }
    return;
  }
  if (u.kind === 'inf' || u.kind === 'kornet') {
    const v = (u.pose === 'run' || u.state === 'retreat' ? 3.8 : 1.4) * (1 - u.supp * 0.6);
    u.yaw = yawOf(to); u.spd = v; u.p = add(u.p, scale(norm([to[0], 0, to[2]]), Math.min(d, v * dt))); return;
  }
  const reverse = u.state === 'scoot' || (u.state === 'peek' && u.side === 'iq' && isTank(u) && Math.abs(angDiff(u.yaw, yawOf(to))) > 2.2) || (u.state === 'retreat' && !!u.hide && Math.abs(angDiff(u.yaw, yawOf(to))) > 2.2 && d < 140);
  const wantYaw = reverse ? yawOf(scale(to, -1)) : yawOf(to);
  const da = angDiff(u.yaw, wantYaw), maxTurn = spec.turn * dt;
  u.yaw += clamp(da, -maxTurn, maxTurn);
  const align = Math.max(0, Math.cos(da));
  const vmax = (u.state === 'march' ? spec.speed * 1.1 : reverse ? 3.2 : u.state === 'peek' ? 3.5 : spec.speed * 0.9) * align * (1 - u.supp * 0.3);
  u.spd += clamp(vmax - u.spd, -4 * dt, 1.6 * dt);
  const fwd: V3 = [Math.sin(u.yaw), 0, Math.cos(u.yaw)];
  u.p = add(u.p, scale(fwd, (reverse ? -1 : 1) * u.spd * dt));
}

// ----- القتال -----
function fight(w: World, u: Unit, dt: number) {
  const spec = SPEC[u.kind]; u.cd -= dt; u.rpgCd -= dt;
  if (u.kind === 'patriot' || u.kind === 's400' || u.kind === 'grad' || u.state === 'mounted') return;
  if (u.burst > 0) { u.burstT -= dt; if (u.burstT <= 0) { u.burstT += u.kind === 'bmp' ? 0.32 : 0.1; u.burst--; if (u.kind === 'bmp') cannonRound(w, u); else mgRound(w, u); } return; }
  if (u.kind === 'inf') return infFire(w, u);
  if (u.kind === 'kornet') return kornetFire(w, u);
  if (u.cd > 0) return;
  if (u.kind === 'technical' || u.kind === 'dshk') {
    let tA: Air | null = null, bd = 1e9;
    if (u.side === 'iq') for (const a of w.air) if (a.alive && a.kind === 'shahed') { const d = len(sub(a.p, u.p)); if (d < spec.aa && d < bd) { bd = d; tA = a; } }
    let tU: Unit | null = null;
    if (!tA) { const t = nearestFoe(w, u, spec.range, o => SPEC[o.kind].armor < 1 && o.state !== 'mounted' && (o.kind !== 'inf' || dist2d(o.p, u.p) < (u.kind === 'dshk' ? 400 : 500))); if (t && visOf(w, u, t) > 0) { tU = t; bd = dist2d(t.p, u.p); } }
    if (!tA && !tU) return;
    u.target = tA ? -tA.id : tU!.id; u.burst = 5 + Math.floor(w.r() * 5); u.burstT = 0; u.cd = tU ? 2.2 + w.r() * 2 : 0.5 + w.r() * 0.9; u.firedT = w.T;
    if (u.kind === 'dshk') u.yaw = yawOf(sub(tA ? tA.p : tU!.p, u.p));
    return;
  }
  if (u.kind === 'd30') {
    // مدفعية: تضرب تجمعات العدو اللي ينشافون (ما تضرب المنسحبين البعيدين)
    const t = nearestFoe(w, u, spec.range, o => o.p[0] > -3600 && o.state !== 'retreat' && !(o.house >= 0));
    if (!t || w.T < 60) return; u.cd = spec.reload * 6 * (0.85 + w.r() * 0.3);
    const lead: V3 = t.spd > 1 ? scale([Math.sin(t.yaw), 0, Math.cos(t.yaw)], t.spd * 9) : [0, 0, 0];
    fireShell(w, u, add(add(t.p, lead), [(w.r() - 0.5) * 170, 0, (w.r() - 0.5) * 170])); return;
  }
  // الدبابات والـ BMP: لازم تكون واقفة تقريباً وموجّهة
  if (u.state === 'bound' || u.state === 'march' || u.state === 'reposition' || u.state === 'retreat' || u.state === 'peek' || u.state === 'scoot' || u.state === 'hide') return;
  if (u.spd > (u.kind === 'bmp' ? 3 : 1.4)) return;
  // اختيار الهدف: دبابة للدبابة، والمشاة للرشاش المحوري
  const cands = [...w.known[u.side].keys()].map(id => w.units.find(x => x.id === id)!).filter(o => o && o.alive && o.state !== 'mounted' && dist2d(o.p, u.p) < spec.range);
  let best: Unit | null = null, bs = -1, bv = 0;
  for (const o of cands) { const v = visOf(w, u, o); if (v <= 0) continue; const s = v * (isTank(o) ? (isTank(u) ? 3 : 0.8) : o.kind === 'bmp' ? 2.2 : o.kind === 'inf' ? (u.kind === 'bmp' ? 2.5 : 1.2) : 1) * (1.6 - dist2d(o.p, u.p) / spec.range); if (s > bs) { bs = s; best = o; bv = v; } }
  if (!best) return;
  const bd = dist2d(best.p, u.p), dir = norm(sub(best.p, u.p)), want = yawOf(dir), da = angDiff(u.yaw, want);
  if (Math.abs(da) > 0.12 && u.kind !== 'bmp') { u.yaw += clamp(da, -spec.turn * dt, spec.turn * dt); return; }
  if (u.kind === 'bmp' || (isTank(u) && best.kind === 'inf' && bd < 500 && w.r() < 0.7)) {
    // مدفع 30 ملم / رشاش محوري: رشقة
    u.target = best.id; u.burst = u.kind === 'bmp' ? 4 + Math.floor(w.r() * 4) : 6 + Math.floor(w.r() * 5); u.burstT = 0; u.cd = (u.kind === 'bmp' ? spec.reload : 3) * (0.8 + w.r() * 0.5); u.firedT = w.T; return;
  }
  u.cd = spec.reload * (0.85 + w.r() * 0.3) * (1 + u.supp * 0.5); u.target = best.id; u.firedT = w.T; u.shots++; u.peekShots++;
  const muzzle = add(add(u.p, scale(dir, 5.6)), [0, 2.3, 0]);
  let pHit = (u.kind === 'abrams' ? 0.66 - bd / 2400 : 0.55 - bd / 2400) * (bv >= 0.99 ? 1 : 0.55) * (1 - u.supp * 0.4);
  if (best.spd > 2) pHit *= 0.8;
  if (best.kind === 'inf') pHit = 0.75;
  const hit = w.r() < pHit;
  const impact: V3 = hit ? add(best.p, [0, best.kind === 'inf' ? 0 : 1.3, 0]) : add(best.p, [(w.r() - 0.5) * 40, 0, (w.r() - 0.5) * 40]);
  const tf = bd / 1650, flank = Math.abs(angDiff(best.yaw, yawOf(scale(dir, -1)))) > 1.1;
  let dmg = u.kind === 'abrams' ? (SPEC[best.kind].armor ? 2.1 : 3) : (best.kind === 'abrams' ? 1.05 : 3);
  if (flank && SPEC[best.kind].armor) dmg *= 1.35;
  const kills = hit && best.kind !== 'inf' && best.hp - dmg <= 0;
  w.fx.push({ k: 'gun', unit: u.id, p: muzzle, dir, big: true }, { k: 'shell', a: muzzle, b: impact, tf });
  if (kills) w.fx.push({ k: 'killshot', shooter: u.id, target: best.id, tf });
  const tgt = best, by = byName(u), side = u.side;
  w.schedule.push({ t: w.T + tf, f: (w) => {
    w.fx.push({ k: 'boom', p: impact, size: hit ? 0.7 : 0.45, air: false, metal: hit && tgt.kind !== 'inf' });
    suppress(w, impact, 30, 0.45, side);
    if (tgt.kind === 'inf') { if (tgt.house >= 0) { hitHouse(w, tgt.house, 1); if (w.r() < 0.6) casualty(w, tgt, 1 + Math.floor(w.r() * 2), by); } else casualty(w, tgt, Math.round((tgt.pose === 'prone' ? 0.35 : 0.75) * (0.2 + 0.8 * w.r())), by); }
    else if (hit) damage(w, tgt, dmg, by);
  } });
  if (u.side === 'en' && isTank(u) && w.r() < 0.35) { u.state = 'scoot'; u.stateT = 0; u.goal = add(u.p, scale(dir, -22)); w.schedule.push({ t: w.T + 9, f: () => { if (u.alive && u.state === 'scoot') { u.state = 'overwatch'; u.goal = null; } } }); }
}
function infFire(w: World, u: Unit) {
  if (u.pose === 'run' && u.state === 'rush') return;
  // RPG على عربة قريبة
  if (u.rpg > 0 && u.rpgCd <= 0) {
    const v = nearestFoe(w, u, 220, o => isVeh(o) && o.state !== 'mounted');
    if (v && visOf(w, u, v) > 0) {
      u.rpg--; u.rpgCd = 18 + w.r() * 10; u.firedT = w.T; w.stats.rpg++;
      const from: V3 = add(u.p, [0, u.house >= 0 ? 3 : 1.4, 0]), d = dist2d(v.p, from), dir = norm(sub(add(v.p, [0, 1.2, 0]), from));
      const hit = w.r() < clamp(0.6 - d / 450, 0.12, 0.58) * (1 - u.supp * 0.5);
      const a = spawnAir(w, 'rpg', u.side, from, scale(dir, 120), undefined, undefined, hit ? add(v.p, [0, 1.2, 0]) : add(v.p, [(w.r() - 0.5) * 16, -1, (w.r() - 0.5) * 16]));
      a.tgtUnit = v.id; a.owner = u.id; a.hit = hit;
      w.fx.push({ k: 'atgm', unit: u.id, p: from, dir, air: a.id, rpg: true }); return;
    }
  }
  if (u.cd > 0) return;
  const t = nearestFoe(w, u, SPEC.inf.range, o => o.kind === 'inf' || o.kind === 'kornet' || o.kind === 'technical' || o.kind === 'dshk');
  if (!t) return; const v = visOf(w, u, t); if (v <= 0) return;
  u.cd = SPEC.inf.reload * (0.8 + w.r() * 0.6) * (1 + u.supp); u.firedT = w.T; u.target = t.id;
  const d = dist2d(t.p, u.p), cover = t.house >= 0 ? 0.3 : t.pose === 'prone' ? 0.45 : 1;
  const pk = 0.035 * u.men / 7 * (1 - d / 450) * cover * (1 - u.supp * 0.6) * (0.4 + v);
  w.fx.push({ k: 'volley', unit: u.id, p: add(u.p, [0, u.house >= 0 ? 3 : u.pose === 'prone' ? 0.4 : 1.3, 0]), to: add(t.p, [(w.r() - 0.5) * 6, 1, (w.r() - 0.5) * 6]), n: Math.max(1, Math.round(u.men / 2)), tracer: w.r() < 0.5, inf: true });
  w.stats.rounds += u.men * 3;
  t.supp = Math.min(1, t.supp + 0.16 * (t.house >= 0 ? 0.6 : 1));
  if (w.r() < pk * 4) { const by = byName(u); w.schedule.push({ t: w.T + d / 800, f: (w) => casualty(w, t, 1, by) }); }
}
function kornetFire(w: World, u: Unit) {
  if (u.cd > 0 || u.ammo <= 0 || u.supp > 0.6) return;
  const t = nearestFoe(w, u, SPEC.kornet.range, o => isTank(o) && visOf(w, u, o) >= 0.4) ?? nearestFoe(w, u, 1200, o => o.kind === 'bmp' && o.alive);
  if (!t || visOf(w, u, t) < 0.4 || dist2d(t.p, u.p) < 150) return;
  u.ammo--; u.cd = SPEC.kornet.reload * (0.9 + w.r() * 0.3); u.firedT = w.T; w.stats.atgm++;
  const from: V3 = add(u.p, [0, 1.1, 0]), dir = norm(sub(add(t.p, [0, 1.5, 0]), from));
  const a = spawnAir(w, 'atgm', 'iq', from, scale(dir, 60), undefined, undefined, add(t.p, [0, 1.5, 0])); a.tgtUnit = t.id; a.owner = u.id; a.phase = 'boost';
  w.fx.push({ k: 'atgm', unit: u.id, p: from, dir, air: a.id, rpg: false });
  w.log.push({ t: w.T, text: `فريق الكورنيت أطلق صاروخ موجّه على ${t.name} معادية (${(dist2d(t.p, u.p) / 1000).toFixed(1)} كم)`, good: null, p: u.p });
  // بعد طلقتين يغيّر مكانه حتى ما ينكشف
  if (u.ammo % 2 === 0) { u.goal = add(w.iq === 'line1' ? KORNET_P : KORNET_P2, [(w.r() - 0.5) * 90, 0, (w.r() - 0.5) * 70]); }
}
function cannonRound(w: World, u: Unit) {
  const o = w.units.find(x => x.id === u.target); if (!o || !o.alive) { u.burst = 0; return; }
  const muzzle = add(u.p, [0, 2.4, 0]), d = dist2d(o.p, muzzle), tf = d / 960, hit = w.r() < (o.kind === 'inf' ? 0.2 : 0.3) - d / 3500;
  const to: V3 = add(o.p, [(w.r() - 0.5) * (hit ? 2 : 18), hit ? 1 : 0, (w.r() - 0.5) * (hit ? 2 : 18)]);
  w.fx.push({ k: 'cannon', unit: u.id, p: muzzle, dir: norm(sub(to, muzzle)), to, tf }); w.stats.rounds++;
  const by = byName(u);
  w.schedule.push({ t: w.T + tf, f: (w) => { suppress(w, to, 12, 0.18, u.side); if (!hit) return;
    if (o.kind === 'inf') { if (o.house >= 0) { hitHouse(w, o.house, 0.15); if (w.r() < 0.25) casualty(w, o, 1, by); } else casualty(w, o, w.r() < 0.35 ? 1 : 0, by); } else damage(w, o, isTank(o) ? 0.03 : 0.25, by); } });
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
    const d = dist2d(o.p, muzzle), tf = d / 850, hit = w.r() < (o.kind === 'inf' ? (o.pose === 'prone' ? 0.004 : 0.008) : 0.16 - d / 14000);
    const to: V3 = add(o.p, [(w.r() - 0.5) * (hit ? 2 : 24), hit ? 1.2 : 0, (w.r() - 0.5) * (hit ? 2 : 24)]);
    w.fx.push({ k: 'round', unit: u.id, p: muzzle, dir: norm(sub(to, muzzle)), to, tracer, tf, hit: hit && o.kind !== 'inf' ? 'metal' : 'ground' });
    const by = byName(u);
    w.schedule.push({ t: w.T + tf, f: (w) => { suppress(w, to, 12, 0.09, u.side); if (!hit) return; if (o.kind === 'inf' || o.kind === 'kornet') { if (o.house < 0 || w.r() < 0.3) casualty(w, o, 1, by); } else damage(w, o, SPEC[o.kind].armor > 0 ? 0.025 : 0.12, by); } });
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
    else if (a.kind === 'atgm' || a.kind === 'rpg') missile(w, a, dt);
    else a.v = add(a.v, [0, -9.81 * dt, 0]);          // غراد + قذائف: بالستي
    if (!a.alive) continue;
    a.p = add(a.p, scale(a.v, dt));
    if (a.p[1] <= 0.4 && a.t > 0.6) impact(w, a);
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
function impact(w: World, a: Air) {
  a.alive = false; a.p[1] = 0.3;
  if (a.kind === 'shahed' || a.kind === 'kh101' || a.kind === 'iskander') {
    const big = a.kind !== 'shahed', huge = a.kind === 'iskander';
    if (a.kind === 'kh101') w.stats.cruiseHit++; else if (huge) w.stats.ballisticHit++; else w.stats.dronesHit++;
    w.fx.push({ k: 'boom', p: a.p, size: huge ? 3 : big ? 2.2 : 1.2, air: false }, { k: 'siteHit', site: a.siteId!, p: a.p, big }, { k: 'mark', p: add(a.p, [0, 40, 0]), text: `✗ أصاب ${a.siteName}`, good: false });
    w.log.push({ t: w.T, text: `${AIR_AR[a.kind]} أصاب ${a.siteName}`, good: false, p: a.p });
    blast(w, a.p, huge ? 70 : 40, huge ? 25 : 12, 1, 0.8, AIR_AR[a.kind], 'en');
  } else if (a.kind === 'rocket') { w.fx.push({ k: 'boom', p: a.p, size: 0.55, air: false }); blast(w, a.p, 20, 5, 1, 0.6, 'راجمات الغراد', 'en'); }
  else if (a.kind === 'shell') { w.fx.push({ k: 'boom', p: a.p, size: 0.65, air: false }); blast(w, a.p, 26, 9, a.side === 'iq' ? 1 : 0.8, a.side === 'iq' ? 1.2 : 0.6, a.side === 'iq' ? 'مدفعية D-30' : 'مدفعية العدو', a.side); }
  else if (a.kind === 'smoke') { w.fx.push({ k: 'boom', p: a.p, size: 0.2, air: false }); addSmoke(w, a.p, 48, 65); }
  else if (a.kind === 'atgm' || a.kind === 'rpg') { w.fx.push({ k: 'boom', p: a.p, size: 0.35, air: false }); suppress(w, a.p, 12, 0.3, a.side); }
  else w.fx.push({ k: 'boom', p: a.p, size: 0.5, air: false });
}

/** كورنيت موجّه بالليزر (يحتاج الرامي يشوف الهدف لحد الإصابة) و RPG غير موجّه */
function missile(w: World, a: Air, dt: number) {
  const t = w.units.find(u => u.id === a.tgtUnit), own = w.units.find(u => u.id === a.owner);
  if (a.kind === 'atgm') {
    const guided = !!(own && own.alive && own.supp < 0.85 && t && t.alive && visOf(w, own, t) > 0);
    if (guided && t) a.aim = add(t.p, [0, 1.4, 0]);
    const sp = Math.min(240, len(a.v) + 220 * dt), want = norm(sub(a.aim, a.p));
    a.v = scale(norm(add(norm(a.v), scale(want, dt * (a.t < 0.6 ? 1 : 6)))), sp);
    if (t && t.alive && len(sub(add(t.p, [0, 1.4, 0]), a.p)) < 4.5) {
      a.alive = false; const by = 'صاروخ كورنيت';
      w.fx.push({ k: 'boom', p: a.p, size: 0.9, air: false, metal: true });
      if (guided || w.r() < 0.3) damage(w, t, isTank(t) ? 2.2 : 2, by); return;
    }
    if (a.t > 30) { a.alive = false; w.fx.push({ k: 'boom', p: a.p, size: 0.4, air: false }); }
    return;
  }
  // RPG: خط مستقيم وجاذبية خفيفة
  a.v = add(a.v, [0, -1.5 * dt, 0]);
  if (len(sub(a.aim, a.p)) < 3.5 || a.t > 4) {
    a.alive = false; w.fx.push({ k: 'boom', p: a.p, size: 0.5, air: false, metal: !!a.hit });
    if (a.hit && t && t.alive && dist2d(t.p, a.p) < 7) damage(w, t, t.kind === 'abrams' ? 0.7 : t.kind === 't72' ? 0.9 : 1.4, own ? byName(own) + ' (RPG)' : 'RPG');
    suppress(w, a.p, 12, 0.3, a.side);
  }
}
