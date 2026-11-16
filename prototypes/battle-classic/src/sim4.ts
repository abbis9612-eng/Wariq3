// المعركة الكلاسيكية v4 (I-054): نفس قواعد v3 (مخزون، تعزيزات، دفاع جوي يسقط، منظّم خسائر = الحساب، D-026/D-028)
// بس الحركة والقتال صارت تكتيك حقيقي:
// - الدبابات بفصائل (3) بتشكيل سهم، بينها تباعد وما تتداخل، تلف بنص قطر وتسرّع وتفرمل، وترجع لورا للتعديلات القصيرة
// - قفزات: فصيل يتقدم وفصيل واقف يغطي؛ الرمي: يلقى هدف ← البرج يلف بسرعة محدودة ← يتوقف ← يرمي ← يعبّي
// - دبابات العدو بالسواتر: ترمي طلقتين وتبدّل موقعها؛ المضروبة بدون تدمير ترجع لورا وتدخن
// - التعزيزات تجي برتل على الطريق وبعدين تنتشر؛ شاحنات إمداد رايحة جاية
// - الطيارات: اتجاه وسرعة بلفّات ناعمة (ما تمشي بالعكس أبداً)، تضرب وتكمل وتلف من ورا العدو وترجع؛
//   لما ينطلق عليها صاروخ تناور (لفة حادة + نزول + مشاعل) وقسم يفلت حسب قوة الدفاع مقابل الطيران
import { SAMPLES, stamp } from './sim.ts';
import type { Res, Terr } from './sim.ts';
export { SAMPLES, stamp }; export type { Res, Terr };

export const MW = 600, MH = 1400, S = 2.4, END = 330;
export type Kind = 'tank' | 'ifv' | 'inf' | 'arty' | 'mlrs' | 'ad' | 'heli' | 'truck';
export interface Sol { ox: number; oy: number; x: number; y: number; alive: boolean; prone: boolean; fireT: number; dieT: number; a: number }
export interface Unit {
  id: number; side: 0 | 1; type: Kind; x: number; y: number; hull: number; tur: number; alive: boolean; dieT: number; moving: boolean;
  cd: number; fireT: number; hitT: number; dmg: number; burn: number; slot: number; grp: number; sol: Sol[]; house: number; ammo: number; reload: number; alt: number; spawnT: number; rot: number; tx: number; ty: number;
  spd: number; state: 'road' | 'form' | 'retreat' | 'back' | 'park'; plt: number; pos: number; haltT: number; tgt: number; shots: number; acqT: number; rev: boolean; retreatT: number; engaged: number;
}
export interface Air { id: number; side: 0 | 1; kind: 'jet' | 'drone'; model: string; x: number; y: number; alt: number; vx: number; vy: number; hd: number; spd: number; bank: number; alive: boolean; state: 'in' | 'out' | 'down' | 'dive' | 'evade'; prev: 'in' | 'out'; tx: number; ty: number; tgt: number; dropped: boolean; flareT: number; dieT: number; spin: number; engaged: number; evadeT: number; evDir: number; outT: number }
export type PK = 'shell' | 'rocket' | 'ap' | 'atgm' | 'sam' | 'bomb' | 'mg' | 'can' | 'rpg';
export interface Proj { id: number; kind: PK; side: 0 | 1; sx: number; sy: number; sz: number; tx: number; ty: number; tz: number; x: number; y: number; z: number; t: number; dur: number; tgt: number; air: number; hit: boolean; src: number }
export interface Bld { id: number; x: number; y: number; w: number; h: number; r: number; c: number; hp: number; dead: boolean; owner: 0 | 1 }
export type Fx =
  | { k: 'fire'; kind: PK; x: number; y: number; a: number; id: number; z: number }
  | { k: 'boom'; x: number; y: number; cal: number; z: number }
  | { k: 'hit'; x: number; y: number; id: number }
  | { k: 'kill'; id: number; side: 0 | 1; type: Kind | 'sol' }
  | { k: 'airkill'; id: number; side: 0 | 1 } | { k: 'crash'; x: number; y: number }
  | { k: 'jet'; id: number } | { k: 'spawn'; id: number }
  | { k: 'house'; id: number } | { k: 'capture'; id: number } | { k: 'smoke'; x: number; y: number }
  | { k: 'mghit'; x: number; y: number } | { k: 'msg'; t: string; side: 0 | 1 | 2 };
type Pool = { tank: number; ifv: number; inf: number; heli: number; jet: number; drone: number };
interface Plt { id: number; lane: number; members: number[]; bound: number }
export interface World {
  T: number; res: Res; r: () => number; nid: number; u: Unit[]; air: Air[]; pr: Proj[]; b: Bld[]; fx: Fx[]; ev: { t: number; f: () => void }[];
  pool: [Pool, Pool]; total: [Pool, Pool]; cap: [Pool, Pool]; lastSpawn: Record<string, number>; plts: Plt[]; berms: { x: number; y: number }[];
  budget: { veh: [number, number]; sol: [number, number]; sup: number }; killed: { veh: [number, number]; sol: [number, number]; sup: number; air: [number, number] };
  pk: [{ jet: number; drone: number; heli: number }, { jet: number; drone: number; heli: number }];
  frontA: number; frontD: number; vill: [number, number]; PH: [number, string][]; phase: number; over: boolean; withdraw: boolean;
}
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const angd = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const lg = (n: number, k: number, lo: number, hi: number) => n <= 0 ? 0 : clamp(Math.round(Math.log2(n + 1) * k), lo, hi);
export function rng(seed: number) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const DEF_LINE = 520, VILL_Y = 230;
export const roadX = (y: number) => MW * .52 + Math.sin(y / 160) * 55 + Math.sin(y / 61) * 12;
export const P = { prep: 30, air: 85, smoke: 125, armor: 135, assault: 235, end: 300 };
const WEDGE: [number, number][] = [[0, 0], [-34, 24], [34, 24]];   // سهم: قائد بالنص، والاثنين ورا يمين ويسار

export function create(res: Res, seed = (Math.random() * 1e9) | 0): World {
  const r = rng(seed), R = (a: number, b: number) => a + r() * (b - a), ca = res.ca, cd = res.cd;
  const total: [Pool, Pool] = [
    { tank: lg(ca.tank, 3.0, 6, 36), ifv: 0, inf: lg(ca.troops, 1.6, 6, 24), heli: lg(ca.heli, 1, 0, 8), jet: lg(ca.air, 1.4, 0, 12), drone: lg(ca.drone, 1.5, 0, 14) },
    { tank: lg(cd.tank, 2.6, 5, 30), ifv: 0, inf: lg(cd.troops, 1.4, 5, 20), heli: lg(cd.heli, .6, 0, 4), jet: lg(cd.air, 1.0, 0, 8), drone: lg(cd.drone, 1.5, 0, 14) },
  ];
  total[0].ifv = Math.ceil(total[0].inf / 3);
  const cap: [Pool, Pool] = [{ tank: 12, ifv: 4, inf: 10, heli: 3, jet: 3, drone: 3 }, { tank: 10, ifv: 0, inf: 9, heli: 2, jet: 2, drone: 3 }];
  const pk = (s: 0 | 1) => { const mine = s ? cd : ca, theirs = s ? ca : cd, j = clamp(.3 + .45 * mine.ad / (mine.ad + theirs.air * .5 + 1), .3, .8); return { jet: j, drone: Math.min(.92, j + .18), heli: clamp(j - .05, .25, .75) }; };
  const w: World = {
    T: 0, res, r, nid: 1, u: [], air: [], pr: [], b: [], fx: [], ev: [], pool: [{ ...total[0] }, { ...total[1] }], total, cap, lastSpawn: {}, plts: [], berms: [],
    budget: { veh: [0, 0], sol: [0, 0], sup: 0 }, killed: { veh: [0, 0], sol: [0, 0], sup: 0, air: [0, 0] }, pk: [pk(0), pk(1)],
    frontA: 1150, frontD: DEF_LINE, vill: [MW / 2, VILL_Y], phase: 0, over: false, withdraw: false,
    PH: [[0, 'استطلاع بالمسيّرات'], [P.prep, 'تمهيد مدفعي'], [P.air, 'ضربات جوية'], [P.smoke, 'ستار دخان'], [P.armor, 'تقدّم الدروع'], [P.assault, 'اقتحام المشاة'], [P.end, res.win ? 'تطهير القرية' : 'الانسحاب']],
  };
  const nb = res.cap ? 30 : 20;
  for (let i = 0, t = 0; i < nb && t < 4000; t++) { const x = MW / 2 + R(-230, 230) * (.45 + r() * .55), y = VILL_Y + R(-150, 120), bw = R(12, 18);
    if (w.b.some(b => Math.hypot(b.x - x, b.y - y) < (b.w + bw) * 1.25 + 4) || Math.abs(x - roadX(y)) < bw + 8) continue;
    w.b.push({ id: i++, x, y, w: bw, h: bw * R(.8, 1.2), r: R(-.25, .25), c: Math.floor(r() * 4), hp: 1, dead: false, owner: 1 }); }
  // سواتر العدو: 12 موقع على خط الدفاع (الدبابة تبدّل بينها)
  for (let i = 0; i < 12; i++) w.berms.push({ x: MW * (.06 + .88 * i / 11) + R(-8, 8), y: DEF_LINE + R(-14, 14) });
  for (let i = 0; i < 4; i++) w.plts.push({ id: i, lane: .14 + .72 * i / 3 + R(-.03, .03), members: [0, 0, 0], bound: 1150 });
  const line = (n: number, cx: number, y: number, sp: number, f: (x: number, y: number, i: number) => void) => { for (let i = 0; i < n; i++) f(cx + (n === 1 ? 0 : (i / (n - 1) - .5)) * sp + R(-10, 10), y + R(-10, 10), i); };
  line(lg(ca.arty, .8, 1, 6), MW / 2, MH - 70, 380, (x, y) => mk(w, 0, 'arty', x, y));
  line(ca.arty > 60 ? 2 : ca.arty > 10 ? 1 : 0, MW / 2 + 230, MH - 95, 60, (x, y) => mk(w, 0, 'mlrs', x, y));
  line(lg(ca.ad, .5, 1, 3), MW / 2 - 200, MH - 130, 120, (x, y) => mk(w, 0, 'ad', x, y));
  line(lg(cd.arty, .6, 1, 4), MW / 2, 60, 320, (x, y) => mk(w, 1, 'arty', x, y));
  line(lg(cd.ad, .5, 1, 3), MW / 2 + 150, 110, 160, (x, y) => mk(w, 1, 'ad', x, y));
  for (let i = 0; i < Math.min(cap[1].tank, total[1].tank); i++) spawn(w, 1, 'tank', true);
  for (let i = 0; i < Math.min(cap[1].inf, total[1].inf); i++) spawn(w, 1, 'inf', true);
  for (let i = 0; i < Math.min(cap[0].tank, total[0].tank); i++) spawn(w, 0, 'tank', true);
  for (let i = 0; i < Math.min(cap[0].ifv, total[0].ifv); i++) spawn(w, 0, 'ifv', true);
  for (let i = 0; i < Math.min(cap[0].inf, total[0].inf); i++) spawn(w, 0, 'inf', true);
  const fa = clamp(res.la * 4.5, .05, .8), fd = res.win ? clamp(.45 + res.ld * 1.5, .5, .95) : clamp(res.ld * 2.5, .08, .4);
  const vehTot = (s: 0 | 1) => total[s].tank + total[s].ifv + w.u.filter(u => u.side === s && u.type === 'ad').length;
  w.budget.veh = [Math.round(vehTot(0) * fa), Math.round(vehTot(1) * fd)];
  w.budget.sol = [Math.round(total[0].inf * 5 * fa), Math.round(total[1].inf * 5 * fd)];
  w.budget.sup = Math.round(w.u.filter(u => u.side === 1 && u.type === 'arty').length * (res.win ? .7 : .2));
  for (let i = 0; i < 16; i++) w.ev.push({ t: P.smoke + i * .35, f: () => w.fx.push({ k: 'smoke', x: MW * (.04 + .92 * i / 15), y: 820 + R(-25, 25) }) });
  w.fx.push({ k: 'msg', t: 'بدأت العملية', side: 2 });
  return w;
}
function mk(w: World, side: 0 | 1, type: Kind, x: number, y: number): Unit {
  const a = side ? Math.PI / 2 : -Math.PI / 2;
  const u: Unit = { id: w.nid++, side, type, x, y, hull: a, tur: a, alive: true, dieT: -1, moving: false, cd: 1 + w.r() * 4, fireT: -9, hitT: -9, dmg: 0, burn: 0, slot: w.r(), grp: w.nid % 2, sol: [], house: -1, ammo: type === 'ad' ? 8 : 0, reload: 0, alt: 0, spawnT: w.T, rot: w.r() * 6, tx: x, ty: y,
    spd: 0, state: 'form', plt: -1, pos: 0, haltT: -9, tgt: 0, shots: 0, acqT: -9, rev: false, retreatT: -9, engaged: 0 };
  if (type === 'inf') { const F = [[-5, -3], [4, -5], [-1, 1], [6, 4], [-6, 5]]; for (const [ox, oy] of F) u.sol.push({ ox: ox * S, oy: oy * S, x: x + ox * S, y: y + oy * S, alive: true, prone: false, fireT: -9, dieT: -1, a }); }
  w.u.push(u); return u;
}
function spawn(w: World, side: 0 | 1, type: 'tank' | 'ifv' | 'inf' | 'heli', initial = false) {
  if (w.pool[side][type] <= 0) return null; w.pool[side][type]--;
  const R = (a: number, b: number) => a + w.r() * (b - a);
  // تعزيز: يجي برتل على الطريق من حافة طرفه
  let y = side ? -30 : MH + 30, x = roadX(y);
  if (initial) { y = side ? DEF_LINE : (type === 'tank' ? 1150 : type === 'ifv' ? 1235 + R(-15, 15) : 1265 + R(-25, 25)); x = R(MW * .1, MW * .9); }
  const u = mk(w, side, type, x, y);
  if (!initial && (type === 'tank' || type === 'ifv')) u.state = 'road';
  if (type === 'tank' && side === 0) { const p = w.plts.map(p => ({ p, free: p.members.findIndex(id => !w.u.some(q => q.id === id && q.alive)) })).filter(o => o.free >= 0).sort((a, b) => a.free - b.free)[0]; if (p) { p.p.members[p.free] = u.id; u.plt = p.p.id; u.pos = p.free; if (initial) { const [ox, oy] = WEDGE[p.free]; u.x = MW * p.p.lane + ox; u.y = 1150 + oy; } } }
  if (type === 'tank' && side === 1) { const used = new Set(w.u.filter(q => q.side === 1 && q.type === 'tank' && q.alive && q !== u).map(q => q.slot)); const free = w.berms.map((_, i) => i).filter(i => !used.has(i)); u.slot = free.length ? free[Math.floor(w.r() * free.length)] : Math.floor(w.r() * w.berms.length); if (initial) { u.x = w.berms[u.slot].x; u.y = w.berms[u.slot].y; } }
  if (type === 'inf' && side === 1) { const hs = w.b.filter(b => !b.dead).sort((a, b) => b.y - a.y), h = hs[w.u.filter(q => q.side === 1 && q.type === 'inf').length % Math.max(1, hs.length)]; if (h) { u.house = h.id; if (initial) { u.x = h.x; u.y = h.y + 10; u.sol.forEach(s => { s.x = u.x + s.ox * .8; s.y = u.y + s.oy * .8; s.prone = true; }); } } }
  if (initial) u.sol.forEach(s => { s.x = u.x + s.ox; s.y = u.y + s.oy; });
  if (!initial) w.fx.push({ k: 'spawn', id: u.id });
  return u;
}
function allowed(w: World, what: 'veh' | 'sol' | 'sup', side: 0 | 1) {
  const t = w.T; let k: number;
  if (what === 'sup') k = smooth(35, 125, t);
  else if (side === 1 && what === 'veh') k = .1 * smooth(35, 85, t) + .15 * smooth(85, 135, t) + .75 * smooth(140, 295, t);
  else if (side === 1) k = .1 * smooth(35, 140, t) + .9 * smooth(180, 310, t);
  else if (what === 'veh') k = .06 * smooth(45, 140, t) + .94 * smooth(145, 305, t);
  else k = w.res.win ? smooth(180, 312, t) : smooth(150, 292, t);   // بالفشل مشاتنا يتكبّدون خسايرهم قبل الانسحاب
  return (what === 'sup' ? w.budget.sup : w.budget[what][side]) * k;
}
const cat = (u: Unit): 'veh' | 'sup' | 'sol' | null => u.type === 'inf' ? 'sol' : (u.type === 'arty' || u.type === 'mlrs') ? (u.side === 1 ? 'sup' : null) : u.type === 'heli' || u.type === 'truck' ? null : 'veh';
function mayKill(w: World, u: Unit, base: number) {
  const c = cat(u); if (!c) return false;
  const done = c === 'sup' ? w.killed.sup : w.killed[c][u.side], al = allowed(w, c, u.side);
  if (done + 1 > al + .5) return false;
  return w.r() < Math.min(.97, base * (al - done > 2 ? 1.8 : 1) * (w.T > END - 50 ? 2.5 : 1));
}
function mayKillSol(w: World, u: Unit, base: number) { const al = allowed(w, 'sol', u.side), done = w.killed.sol[u.side]; if (done + 1 > al + .5) return false; return w.r() < Math.min(.95, base * (al - done > 3 ? 1.8 : 1) * (w.T > END - 50 ? 2.5 : 1)); }
function kill(w: World, u: Unit) {
  u.alive = false; u.dieT = w.T; u.moving = false; u.spd = 0; u.burn = u.type === 'inf' ? 0 : 16 + w.r() * 16;
  const c = cat(u); if (c === 'sup') w.killed.sup++; else if (c === 'veh') w.killed.veh[u.side]++;
  w.fx.push({ k: 'kill', id: u.id, side: u.side, type: u.type });
  const nm = { tank: 'دبابة', ifv: 'ناقلة', ad: 'منظومة دفاع جوي', arty: 'مدفع', mlrs: 'راجمة', heli: 'هليكوبتر', inf: 'حضيرة', truck: 'شاحنة' }[u.type];
  w.fx.push({ k: 'msg', t: u.side ? `تدمير ${nm} للعدو` : `خسرنا ${nm}`, side: u.side });
}
function killSol(w: World, u: Unit, s: Sol) { s.alive = false; s.dieT = w.T; w.killed.sol[u.side]++; w.fx.push({ k: 'kill', id: u.id, side: u.side, type: 'sol' }); if (!u.sol.some(q => q.alive)) { u.alive = false; u.dieT = w.T; } }
const enemies = (w: World, side: number, f?: (u: Unit) => boolean) => w.u.filter(u => u.side !== side && u.alive && u.type !== 'heli' && u.type !== 'truck' && (!f || f(u)));
function nearest<T extends { x: number; y: number }>(l: T[], p: { x: number; y: number }, max = 1e9) { let b: T | null = null, bd = max; for (const e of l) { const d = dist(e, p); if (d < bd) { bd = d; b = e; } } return b; }
function shoot(w: World, u: { id: number; side: 0 | 1; x: number; y: number }, kind: PK, tx: number, ty: number, tgt: number, o: { sz?: number; tz?: number; air?: number; hit?: boolean; spd?: number } = {}) {
  const d = Math.hypot(tx - u.x, ty - u.y), sp = o.spd ?? { shell: 170, rocket: 150, ap: 650, atgm: 190, sam: 330, bomb: 1, mg: 500, can: 520, rpg: 140 }[kind];
  const dur = kind === 'bomb' ? 1.5 : Math.max(.06, d / sp);
  w.pr.push({ id: w.nid++, kind, side: u.side, sx: u.x, sy: u.y, sz: o.sz ?? 2, tx, ty, tz: o.tz ?? 0, x: u.x, y: u.y, z: o.sz ?? 2, t: 0, dur, tgt, air: o.air ?? 0, hit: o.hit ?? false, src: u.id });
  const a = Math.atan2(ty - u.y, tx - u.x);
  if (kind !== 'mg') w.fx.push({ k: 'fire', kind, x: u.x, y: u.y, a, id: u.id, z: o.sz ?? 0 });
  return a;
}
/** قيادة مركبة: تلف بنص قطر، تسرّع وتفرمل، وللتعديلات القصيرة ورا ترجع بالريوس بدل ما تلف كاملة */
function drive(u: Unit, tx: number, ty: number, vmax: number, dt: number) {
  const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy), turn = u.type === 'ifv' || u.type === 'truck' ? 1.4 : 1.05, acc = 9;
  let want = 0;
  if (d > 5) {
    const a = Math.atan2(dy, dx), diff = angd(a, u.hull);
    u.rev = Math.abs(diff) > 2.2 && d < 70;   // الهدف ورا وقريب: ريوس
    const head = u.rev ? a + Math.PI : a, dd = angd(head, u.hull);
    u.hull += clamp(dd, -turn * dt, turn * dt);
    want = (u.rev ? -.45 : 1) * vmax * Math.max(0, Math.cos(dd)) * clamp(d / 40, .25, 1);
  } else u.rev = false;
  u.spd += clamp(want - u.spd, -acc * 1.6 * dt, acc * dt);
  u.x += Math.cos(u.hull) * u.spd * dt; u.y += Math.sin(u.hull) * u.spd * dt;
  u.moving = Math.abs(u.spd) > .6;
}
function separate(w: World) {
  const v = w.u.filter(u => u.alive && (u.type === 'tank' || u.type === 'ifv' || u.type === 'truck'));
  const dead = w.u.filter(u => !u.alive && (u.type === 'tank' || u.type === 'ifv'));
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    for (let j = i + 1; j < v.length; j++) { const b = v[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = 26; if (d < m && d > .01) { const p = (m - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p; } }
    for (const b of dead) { const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy), m = 22; if (d < m && d > .01) { a.x += dx / d * (m - d); a.y += dy / d * (m - d); } }   // يلفون حول الحطام
  }
}

export function step(w: World, dt: number) {
  w.T += dt; const T = w.T, res = w.res, R = (a: number, b: number) => a + w.r() * (b - a);
  if (w.over) return;
  const due = w.ev.filter(e => e.t <= T); w.ev = w.ev.filter(e => e.t > T); due.forEach(e => e.f());
  const ph = w.PH.filter(p => p[0] <= T).length - 1; if (ph !== w.phase) { w.phase = ph; w.fx.push({ k: 'msg', t: w.PH[ph][1], side: 2 }); }
  // ---------- الجبهة ----------
  if (res.win) { w.frontA = 1150 - smooth(P.armor, 270, T) * (1150 - (DEF_LINE - 60)) - smooth(270, 305, T) * (DEF_LINE - 60 - (VILL_Y + 40)); w.frontD = DEF_LINE - smooth(240, 290, T) * (DEF_LINE - VILL_Y + 20) - smooth(305, 325, T) * 300; }
  else { w.frontA = 1150 - smooth(P.armor, 215, T) * 380 + smooth(P.end - 5, 325, T) * 420; w.frontD = DEF_LINE + smooth(240, 285, T) * 140; if (!w.withdraw && T > P.end - 5) { w.withdraw = true; w.fx.push({ k: 'msg', t: 'الهجوم تعطّل — قواتنا تنسحب تحت الدخان', side: 0 }); for (let i = 0; i < 10; i++) w.fx.push({ k: 'smoke', x: MW * (.06 + .88 * i / 9), y: w.frontA - 30 }); } }
  // ---------- تعزيزات ----------
  if (Math.floor(T) !== Math.floor(T - dt)) for (const side of [0, 1] as const) for (const ty of ['tank', 'ifv', 'inf', 'heli'] as const) {
    const act = w.u.filter(u => u.side === side && u.type === ty && u.alive && (ty !== 'inf' || u.sol.filter(q => q.alive).length >= 3)).length, key = side + ty;   // الحضيرة اللي باقي بيها أقل من 3 تنحسب منتهية وتجي بدالها
    const ok = ty === 'heli' ? T > (side ? 155 : 150) && T < 310 : ty === 'inf' && side === 0 ? T > 70 : T > 20;
    if (ok && act < w.cap[side][ty] && w.pool[side][ty] > 0 && T - (w.lastSpawn[key] ?? -99) > (ty === 'heli' ? 16 : ty === 'tank' ? 3.5 : 5) && !(side === 0 && w.withdraw)) {
      const u = spawn(w, side, ty); if (u) { w.lastSpawn[key] = T; if (act > 0 && (ty === 'tank' || ty === 'heli')) w.fx.push({ k: 'msg', t: side ? `تعزيزات للعدو: ${ty === 'tank' ? 'دبابة' : 'هليكوبتر'}` : `وصلت ${ty === 'tank' ? 'دبابة' : 'هليكوبتر'} تعزيز`, side }); }
    }
  }
  // شاحنات الإمداد (ذخيرة ووقود): رايحة جاية على الطريق
  for (const side of [0, 1] as const) if (T > 15 && T < END - 25 && T - (w.lastSpawn[side + 'truck'] ?? -99) > (side ? 34 : 22)) { w.lastSpawn[side + 'truck'] = T; const y = side ? -30 : MH + 30, t = mk(w, side, 'truck', roadX(y), y); t.state = 'road'; t.ty = side ? 130 : 1250; }
  // طيران ومسيّرات (الطيارة اللي ترجع سالمة ترجع للمخزون؛ اللي تنضرب تنقص)
  for (const side of [0, 1] as const) {
    const jets = w.air.filter(a => a.side === side && a.kind === 'jet' && a.state !== 'down').length, drones = w.air.filter(a => a.side === side && a.kind === 'drone' && a.state !== 'down').length;
    if (T > (side ? 95 : P.air) && T < 305 && jets < w.cap[side].jet && w.pool[side].jet > 0 && T - (w.lastSpawn[side + 'jet'] ?? -99) > (T < P.smoke ? 6 : 15)) { w.lastSpawn[side + 'jet'] = T; sortie(w, side); }
    if (T > (side ? 6 : 1) && T < 312 && drones < w.cap[side].drone && w.pool[side].drone > 0 && T - (w.lastSpawn[side + 'drone'] ?? -99) > 10) { w.lastSpawn[side + 'drone'] = T; w.pool[side].drone--; const x = R(MW * .15, MW * .85), hd = side ? Math.PI / 2 : -Math.PI / 2; w.air.push({ id: w.nid++, side, kind: 'drone', model: side ? 'shahed' : 'tb2', x, y: side ? -40 : MH + 40, alt: 34, vx: 0, vy: 0, hd, spd: 32, bank: 0, alive: true, state: 'in', prev: 'in', tx: x, ty: side ? R(800, 1150) : R(150, 600), tgt: 0, dropped: false, flareT: -9, dieT: -1, spin: 0, engaged: 0, evadeT: -9, evDir: 1, outT: 0 }); }
  }
  // ---------- الفصائل: قفزات (فصيل يتقدم وفصيل يغطي) ----------
  for (const p of w.plts) {
    const movingTurn = Math.floor(Math.max(0, T - P.armor) / 16) % 2 === p.id % 2;
    const target = w.frontA;
    if (T < P.armor) p.bound = 1150; else if (w.withdraw) p.bound = w.frontA; else if (movingTurn) p.bound = Math.max(target, Math.min(p.bound, p.bound - dt * 9)); else p.bound = Math.max(p.bound, target - 0);
  }
  // ---------- الوحدات ----------
  for (const u of w.u) {
    if (!u.alive) { if (u.burn > 0) u.burn -= dt; continue; }
    u.cd -= dt;
    if (u.type === 'tank' || u.type === 'ifv' || u.type === 'truck') {
      let tx = u.x, ty = u.y, vmax = 12;
      if (u.state === 'road' || u.state === 'back') {   // رتل على الطريق
        const dir = u.side ? 1 : -1, back = u.state === 'back', ny = u.y + (back ? -dir : dir) * 30; tx = roadX(ny); ty = ny; vmax = u.type === 'truck' ? 18 : 20;
        if (u.type === 'truck') { if (!back && (u.side ? u.y > u.ty : u.y < u.ty)) { u.state = 'park'; u.haltT = T + 8; } if (back && (u.y < -40 || u.y > MH + 40)) { u.alive = false; u.dieT = -99; } }
        else { const deploy = u.side ? DEF_LINE - 120 : Math.min(1150, w.frontA + 150); if (u.side ? u.y > deploy : u.y < deploy) u.state = 'form'; }
      }
      if (u.state === 'park') { tx = u.x; ty = u.y; if (T > u.haltT) { u.state = 'back'; u.hull += Math.PI; } }
      if (u.state === 'form' || u.state === 'retreat') {
        if (u.side === 0) {
          const p = w.plts[u.plt] ?? null, [ox, oy] = u.type === 'tank' && p ? WEDGE[u.pos] : [0, 0];
          if (u.type === 'tank' && p) { tx = MW * p.lane + ox; ty = p.bound + oy; } else { tx = MW * (.12 + .76 * u.slot); ty = w.frontA + 95; }
          if (w.withdraw) ty = 1230;
        } else {
          const b = w.berms[u.slot] ?? { x: u.x, y: DEF_LINE }; tx = b.x; ty = b.y + (w.frontD - DEF_LINE);
          if (res.win && T > 305) { ty = -90; vmax = 14; }
        }
        if (u.state === 'retreat') { if (T > u.retreatT) u.state = 'form'; else { tx = u.x - Math.cos(u.hull) * 40; ty = u.y - Math.sin(u.hull) * 40; vmax = 6; } }
        if (T < u.haltT) vmax = 0;   // توقف قصير للرمي
      }
      if (vmax > 0) drive(u, tx, ty, vmax, dt); else { u.spd = Math.max(0, u.spd - 14 * dt); u.x += Math.cos(u.hull) * u.spd * dt; u.y += Math.sin(u.hull) * u.spd * dt; u.moving = u.spd > .6; }
      if (u.type !== 'truck' && !(u.type === 'tank' && u.side === 0 && T < P.armor - 25)) gun(w, u, dt);
      continue;
    }
    let gx = u.x, gy = u.y, spd = 0;
    if (u.type === 'inf') {
      if (u.side === 0) {
        if (res.win && T > P.assault) { const h = w.b.find(b => b.id === u.house && b.owner === 1) ?? nearest(w.b.filter(b => b.owner === 1 && !w.u.some(q => q !== u && q.side === 0 && q.alive && q.type === 'inf' && q.house === b.id)), u) ?? nearest(w.b.filter(b => b.owner === 1), u); u.house = h ? h.id : -1; if (h) { gx = h.x + 8; gy = h.y + 16; } else { gx = w.vill[0]; gy = VILL_Y; }
          if (h && dist(u, h) < 32 && !w.u.some(d => d.side === 1 && d.alive && d.type === 'inf' && d.house === h.id)) { h.owner = 0; u.house = -1; w.fx.push({ k: 'capture', id: h.id }); } }
        else { gx = MW * (.1 + .8 * u.slot); gy = w.withdraw ? 1260 : w.frontA + 60; }
        const far = dist(u, { x: gx, y: gy }) > 120; spd = far ? 19 : Math.floor((T + u.id) / 6) % 3 === 0 ? 0 : 9;
      } else {
        const h = w.b.find(b => b.id === u.house); if (h) { gx = h.x; gy = h.y + 10; } else { gx = MW * (.15 + .7 * u.slot); gy = w.frontD - 40; }
        if (!res.win && T > 245 && T < 305) { gx = MW * (.12 + .76 * u.slot); gy = w.frontD + 30; }
        if (res.win && T > 305) { gy = -80; u.house = -1; } spd = 10;
      }
    } else if (u.type === 'heli') {
      // يحوم واطي ورا الخط، يطلع يرمي، وينزل (pop-up)
      const hover = u.side ? w.frontD - 170 : w.frontA + 180; gx = MW * (.15 + .7 * u.slot) + Math.sin(T * .35 + u.id) * 24; gy = (T > 312 || (u.side === 0 && w.withdraw)) ? (u.side ? -100 : MH + 100) : hover; spd = 24;
      const pop = (T + u.id * 3) % 10 < 4; u.alt += clamp((pop ? 26 : 11) - u.alt, -8 * dt, 8 * dt);
    }
    if (spd > 0) { const dx = gx - u.x, dy = gy - u.y, d = Math.hypot(dx, dy); if (d > 2) { const a = Math.atan2(dy, dx); u.hull += clamp(angd(a, u.hull), -2.5 * dt, 2.5 * dt); const v = Math.min(spd, d * 1.5) * dt; u.x += Math.cos(a) * v; u.y += Math.sin(a) * v; u.moving = true; } else u.moving = false; } else u.moving = false;
    if (u.type === 'inf') { const under = T - u.hitT < 3; for (const s of u.sol) if (s.alive) { const tx = u.x + s.ox, ty = u.y + s.oy, ex = tx - s.x, ey = ty - s.y, ed = Math.hypot(ex, ey); if (ed > .5) { const k = Math.min(1, (u.moving ? 14 : 6) * dt / ed); s.x += ex * k; s.y += ey * k; } s.prone = (!u.moving && (under || u.side === 1 || T > 150)); } }
    if (u.cd > 0) continue;
    if (u.type === 'arty') {
      if (!(T > P.prep && (u.side === 1 || (T < 265 && !w.withdraw)))) { u.cd = 1; continue; }
      const vis = enemies(w, u.side), tg = vis.length ? vis[Math.floor(w.r() * vis.length)] : null;
      if (tg) { u.tur = shoot(w, u, 'shell', tg.x + R(-16, 16), tg.y + R(-16, 16), tg.id); u.hull = u.tur; u.fireT = T; u.cd = T < P.air ? R(2.5, 4.5) : R(5, 8); } else u.cd = 2;
    } else if (u.type === 'mlrs') {
      if (!(T > P.prep + 5 && T < P.smoke + 5)) { u.cd = 2; continue; }
      const vis = enemies(w, u.side), tg = vis[Math.floor(w.r() * vis.length)]; if (!tg) { u.cd = 2; continue; }
      u.hull = Math.atan2(tg.y - u.y, tg.x - u.x);
      for (let i = 0; i < 12; i++) w.ev.push({ t: T + i * .28, f: () => { if (u.alive) { shoot(w, u, 'rocket', tg.x + R(-26, 26), tg.y + R(-22, 22), i < 4 ? tg.id : 0); u.fireT = w.T; } } });
      u.cd = 26;
    } else if (u.type === 'ad') {
      if (u.ammo <= 0) { u.reload += dt; if (u.reload > 14) { u.ammo = 8; u.reload = 0; } u.cd = .5; continue; }
      const cand = w.air.filter(a => a.side !== u.side && a.alive && a.state !== 'down' && !a.engaged && dist(a, u) < 1000 && a.y > -20 && a.y < MH + 20).sort((a, b) => (a.kind === 'jet' ? 0 : 1) - (b.kind === 'jet' ? 0 : 1) || dist(a, u) - dist(b, u));
      const hl = !cand.length ? w.u.find(h => h.type === 'heli' && h.side !== u.side && h.alive && h.alt > 18 && !h.engaged && dist(h, u) < 900) : null;
      if (cand.length) { const a = cand[0], hit = w.r() < w.pk[u.side][a.kind]; a.engaged = 1; u.tur = shoot(w, u, 'sam', a.x, a.y, 0, { air: a.id, tz: a.alt, sz: 4, hit }); u.hull = u.tur; u.ammo--; u.fireT = T; u.cd = R(2, 3.5);
        // الطيارة تحس بالصاروخ: مناورة (لفة حادة بعيد عن الصاروخ + نزول) ومشاعل
        const brg = Math.atan2(a.y - u.y, a.x - u.x); a.evDir = angd(brg, a.hd) > 0 ? 1 : -1; if (a.state !== 'dive') { a.prev = a.state === 'evade' ? a.prev : (a.state as 'in' | 'out'); a.state = 'evade'; a.evadeT = T + R(.6, 1.2); }
        if (a.kind === 'jet') a.flareT = T + R(.5, 1.1); }
      else if (hl) { const hit = w.r() < w.pk[u.side].heli; hl.engaged = 1; shoot(w, u, 'sam', hl.x, hl.y, hl.id, { tz: hl.alt, sz: 4, hit }); u.ammo--; u.fireT = T; u.cd = R(3, 5); }
      else u.cd = .6;
    } else if (u.type === 'inf') {
      const tg = nearest(enemies(w, u.side, e => e.type === 'inf' || e.type === 'ifv' || e.type === 'tank'), u, 190);
      if (!tg) { u.cd = 1; continue; }
      if ((tg.type === 'tank' || tg.type === 'ifv') && dist(tg, u) < 120 && w.r() < .35) { const s = u.sol.find(q => q.alive)!; shoot(w, { id: u.id, side: u.side, x: s.x, y: s.y }, 'rpg', tg.x, tg.y, tg.id, { sz: 1 }); s.fireT = T; u.fireT = T; u.cd = R(8, 14); continue; }
      const al = u.sol.filter(q => q.alive); for (const s of al) if (w.r() < .6) { const tsol = tg.type === 'inf' ? tg.sol.filter(q => q.alive) : []; const q = tsol.length ? tsol[Math.floor(w.r() * tsol.length)] : null; s.a = Math.atan2((q ? q.y : tg.y) - s.y, (q ? q.x : tg.x) - s.x);
        for (let i = 0; i < 3; i++) w.ev.push({ t: T + i * .1 + w.r() * .3, f: () => { if (s.alive) { s.fireT = w.T; shoot(w, { id: u.id, side: u.side, x: s.x, y: s.y }, 'mg', (q ? q.x : tg.x) + R(-4, 4), (q ? q.y : tg.y) + R(-4, 4), i === 2 && q ? tg.id : 0, { sz: 1 }); } } }); }
      u.fireT = T; u.cd = R(1.2, 2.6);
    } else if (u.type === 'heli') {
      if (u.alt < 22 || T > 312) { u.cd = .5; continue; }
      const tg = nearest(enemies(w, u.side, e => e.type === 'tank' || e.type === 'ifv' || e.type === 'ad'), u, 420); if (!tg) { u.cd = 1.5; continue; }
      u.hull = Math.atan2(tg.y - u.y, tg.x - u.x); shoot(w, u, 'atgm', tg.x, tg.y, tg.id, { sz: u.alt }); u.fireT = T; u.cd = R(7, 11);
    }
  }
  separate(w);
  w.u = w.u.filter(u => !(u.type === 'truck' && !u.alive));
  // ---------- الجو ----------
  for (const a of w.air) flyAir(w, a, dt);
  w.air = w.air.filter(a => {
    if (a.state === 'down') return a.alive;
    const off = a.y < -280 || a.y > MH + 280 || a.x < -280 || a.x > MW + 280;
    if (off && a.kind === 'jet' && a.state === 'out') { w.pool[a.side].jet++; return false; }   // رجعت سالمة للقاعدة
    if (off && a.kind === 'drone' && a.state !== 'in') return false;
    return a.alive;
  });
  // ---------- المقذوفات ----------
  w.pr = w.pr.filter(p => {
    p.t += dt; if (p.t < 0) return true;
    if (p.kind === 'sam') { const a = p.air ? w.air.find(q => q.id === p.air) : null, h = !a && p.tgt ? w.u.find(q => q.id === p.tgt) : null;
      if (a && a.state !== 'down' && (p.hit || p.t < p.dur * .6)) { p.tx = a.x; p.ty = a.y; p.tz = a.alt; } else if (h && h.alive && (p.hit || p.t < p.dur * .6)) { p.tx = h.x; p.ty = h.y; p.tz = h.alt; } }
    const k = Math.min(1, p.t / p.dur); p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k; p.z = p.sz + (p.tz - p.sz) * k;
    if (k < 1) return true;
    impact(w, p); return false;
  });
  if (T > END - 40 && Math.floor(T * 2) !== Math.floor((T - dt) * 2)) for (const side of [0, 1] as const) {
    if (w.killed.sol[side] + 1 > allowed(w, 'sol', side) + .5) continue;
    const sq = w.u.filter(u => u.side === side && u.alive && u.type === 'inf'), u = sq[Math.floor(w.r() * sq.length)]; if (!u) continue;
    const s = u.sol.find(q => q.alive), e = nearest(enemies(w, side), u, 1100); if (!s || !e) continue;
    shoot(w, { id: e.id, side: e.side, x: e.x, y: e.y }, e.type === 'tank' || e.type === 'ifv' ? 'can' : 'mg', s.x, s.y, 0, { sz: 1 }); killSol(w, u, s);
  }
  if (T >= END) { w.over = true; w.fx.push({ k: 'msg', t: res.win ? (res.captured ? 'سيطرة كاملة' : 'نجحت العملية') : 'فشل الهجوم', side: res.win ? 0 : 1 }); }
}
/** الرمي المدرّع: يلقى هدف ← البرج يلف (1.6 راديان/ث) ← إذا ماشي: توقف قصير ← محاذاة ← رمي ← تعبئة */
function gun(w: World, u: Unit, dt: number) {
  const T = w.T, R = (a: number, b: number) => a + w.r() * (b - a), tank = u.type === 'tank', rng2 = tank ? 440 : 260;
  if (u.side === 1 && T < 60 && tank) { u.tur += clamp(angd(Math.PI / 2, u.tur), -dt, dt); return; }
  let tg = u.tgt ? w.u.find(q => q.id === u.tgt && q.alive) ?? null : null;
  if (!tg || dist(tg, u) > rng2 || T - u.acqT > 6) {
    const list = enemies(w, u.side, e => e.type !== 'arty' && e.type !== 'mlrs'), pref = list.filter(e => tank ? e.type !== 'inf' : e.type === 'inf' || e.type === 'ifv');
    tg = nearest(pref.length ? pref : list, u, rng2); u.tgt = tg ? tg.id : 0; u.acqT = T;
  }
  const rest = u.side ? Math.PI / 2 : -Math.PI / 2;
  if (!tg) { u.tur += clamp(angd(u.moving ? u.hull : rest, u.tur), -1.2 * dt, 1.2 * dt); return; }
  const want = Math.atan2(tg.y - u.y, tg.x - u.x), diff = angd(want, u.tur);
  u.tur += clamp(diff, -1.6 * dt, 1.6 * dt);
  if (u.cd > 0) return;
  // ماشي؟ توقف قصير (إذا الهدف بالمدى المؤثر) وإلا ينتظر لحد ما يوقف بالقفزة
  if (Math.abs(u.spd) > 2) { if (u.state === 'form' && dist(tg, u) < (tank ? 330 : 200) && T > u.haltT + 4) u.haltT = T + R(2, 3); return; }
  if (Math.abs(diff) > .05) return;
  if (tank) { shoot(w, u, 'ap', tg.x + R(-3, 3), tg.y + R(-3, 3), tg.id); u.fireT = T; u.cd = R(5.5, 8); u.shots++;
    if (u.side === 1 && u.shots % 2 === 0 && T > 60) { const used = new Set(w.u.filter(q => q.side === 1 && q.type === 'tank' && q.alive && q !== u).map(q => q.slot)), near = [u.slot - 1, u.slot + 1].filter(i => i >= 0 && i < w.berms.length && !used.has(i)); if (near.length) u.slot = near[Math.floor(w.r() * near.length)]; }   // يرمي طلقتين ويبدّل الساتر
  } else { for (let i = 0; i < 5; i++) w.ev.push({ t: T + i * .15, f: () => { if (u.alive && tg!.alive) { shoot(w, u, 'can', tg!.x + R(-5, 5), tg!.y + R(-5, 5), i === 4 ? tg!.id : 0); u.fireT = w.T; } } }); u.cd = R(3, 5); }
}
/** طيران: اتجاه وسرعة بلفات محدودة (ما يرجع بالعكس أبداً) */
function flyAir(w: World, a: Air, dt: number) {
  const T = w.T;
  if (a.state === 'down') { a.spin += dt * 4; a.alt = Math.max(0, a.alt - dt * (a.kind === 'jet' ? 24 : 16)); a.x += a.vx * dt * .55; a.y += a.vy * dt * .55; if (a.alt === 0 && a.alive) { a.alive = false; w.fx.push({ k: 'crash', x: a.x, y: a.y }); w.fx.push({ k: 'boom', x: a.x, y: a.y, cal: a.kind === 'jet' ? 3 : 1.4, z: 0 }); } return; }
  const jet = a.kind === 'jet', turnN = jet ? .75 : .8, turnB = jet ? 1.7 : 1.1;
  let want = a.hd, turn = turnN, base = jet ? 60 : 34;
  if (a.state === 'evade') { want = a.hd + a.evDir * 1.5; turn = turnB; base = jet ? 42 : 28; if (T > a.evadeT) a.state = a.prev === 'in' && jet && w.r() < .4 ? 'out' : a.prev; }
  else if (a.kind === 'drone') {
    if (a.state === 'dive') { const tg = w.u.find(q => q.id === a.tgt); if (tg) { a.tx = tg.x; a.ty = tg.y; } want = Math.atan2(a.ty - a.y, a.tx - a.x); turn = 1.7; a.spd = 95; a.alt = Math.max(0, a.alt - dt * 9); const d = Math.hypot(a.tx - a.x, a.ty - a.y);
      if (d < 8) { a.alive = false; a.state = 'down'; w.fx.push({ k: 'boom', x: a.x, y: a.y, cal: 1.6, z: 0 }); if (tg && tg.alive && mayKill(w, tg, .7)) kill(w, tg); else if (tg) { tg.hitT = T; tg.dmg++; w.fx.push({ k: 'hit', x: tg.x, y: tg.y, id: tg.id }); } return; } }
    else {
      if (Math.hypot(a.tx - a.x, a.ty - a.y) < 30) { a.tx = MW * (.15 + .7 * w.r()); a.ty = a.side ? 750 + w.r() * 450 : 120 + w.r() * 480; }
      want = Math.atan2(a.ty - a.y, a.tx - a.x);
      if (a.side === 1 && T > 70 && !a.dropped && w.r() < dt * .025) { const tg = nearest(enemies(w, 1, e => e.type === 'tank' || e.type === 'arty' || e.type === 'ad'), a, 600); if (tg) { a.state = 'dive'; a.tgt = tg.id; a.dropped = true; w.fx.push({ k: 'msg', t: 'مسيّرة انتحارية للعدو تنقض', side: 1 }); } }
      if (a.side === 0 && T > 40 && w.r() < dt * .05) { const tg = nearest(enemies(w, 0, e => e.type === 'tank' || e.type === 'ad' || e.type === 'arty'), a, 300); if (tg) shoot(w, { id: a.id, side: 0, x: a.x, y: a.y }, 'atgm', tg.x, tg.y, tg.id, { sz: a.alt }); }
    }
  } else if (a.state === 'in') {
    const tg = w.u.find(q => q.id === a.tgt && q.alive); if (tg) { a.tx = tg.x; a.ty = tg.y; }
    want = Math.atan2(a.ty - a.y, a.tx - a.x);
    if (Math.hypot(a.tx - a.x, a.ty - a.y) < 75 && Math.abs(angd(want, a.hd)) < .5) {
      a.dropped = true; a.state = 'out'; a.outT = T;
      for (let i = 0; i < 3; i++) { const bx = a.tx + (w.r() - .5) * 40 + Math.cos(a.hd) * i * 10, by = a.ty + (w.r() - .5) * 40 + Math.sin(a.hd) * i * 10, t2 = nearest(enemies(w, a.side), { x: bx, y: by }, 30); w.pr.push({ id: w.nid++, kind: 'bomb', side: a.side, sx: a.x, sy: a.y, sz: a.alt, tx: bx, ty: by, tz: 0, x: a.x, y: a.y, z: a.alt, t: -i * .16, dur: 1.5, tgt: t2?.id ?? 0, air: 0, hit: false, src: a.id }); }
    }
  } else if (a.state === 'out') {
    // يكمل لقدّام شوية (فوق خطوط العدو) وبعدين يلف لفة واسعة ويرجع لجهته
    if (T - a.outT > 1.4) { const homeY = a.side ? -400 : MH + 400, hx = a.x + (a.x < MW / 2 ? -250 : 250); want = Math.atan2(homeY - a.y, hx - a.x); }
  }
  const d = angd(want, a.hd), dh = clamp(d, -turn * dt, turn * dt); a.hd += dh;
  a.bank += (clamp(dh / dt / turnB, -1, 1) - a.bank) * Math.min(1, dt * 4);
  if (jet) a.spd = a.state === 'evade' ? 215 : 185;
  a.alt += (base - a.alt) * Math.min(1, dt * 1.5);
  a.vx = Math.cos(a.hd) * a.spd; a.vy = Math.sin(a.hd) * a.spd; a.x += a.vx * dt; a.y += a.vy * dt;
}
function sortie(w: World, side: 0 | 1) {
  const R = (a: number, b: number) => a + w.r() * (b - a), list = enemies(w, side), pri = list.filter(u => u.type === 'ad' || u.type === 'arty' || u.type === 'tank');
  const tg = (pri.length ? pri : list)[Math.floor(w.r() * (pri.length || list.length))]; if (!tg) return;
  w.pool[side].jet--;
  const y0 = side ? -220 : MH + 220, x0 = clamp(tg.x + R(-180, 180), -100, MW + 100), hd = Math.atan2(tg.y - y0, tg.x - x0);
  const j: Air = { id: w.nid++, side, kind: 'jet', model: side ? 'f16' : 'su25', x: x0, y: y0, alt: 60, vx: 0, vy: 0, hd, spd: 185, bank: 0, alive: true, state: 'in', prev: 'in', tx: tg.x, ty: tg.y, tgt: tg.id, dropped: false, flareT: -9, dieT: -1, spin: 0, engaged: 0, evadeT: -9, evDir: 1, outT: 0 };
  w.air.push(j); w.fx.push({ k: 'jet', id: j.id });
}
function impact(w: World, p: Proj) {
  const R = (a: number, b: number) => a + w.r() * (b - a), T = w.T;
  if (p.kind === 'sam') {
    const a = p.air ? w.air.find(q => q.id === p.air) : null, h = !a && p.tgt ? w.u.find(q => q.id === p.tgt) : null;
    if (a) a.engaged = 0; if (h) h.engaged = 0;
    w.fx.push({ k: 'boom', x: p.tx, y: p.ty, cal: .9, z: p.tz });
    if (p.hit && a && a.state !== 'down') { a.state = 'down'; a.dieT = T; w.killed.air[a.side]++; w.fx.push({ k: 'airkill', id: a.id, side: a.side }); w.fx.push({ k: 'msg', t: a.side ? `دفاعنا الجوي أسقط ${a.kind === 'jet' ? 'طائرة' : 'مسيّرة'} للعدو` : `دفاع العدو أسقط ${a.kind === 'jet' ? 'طائرة' : 'مسيّرة'} لنا`, side: a.side }); }
    else if (p.hit && h && h.alive) { h.alive = false; h.dieT = T; h.burn = 10; w.fx.push({ k: 'kill', id: h.id, side: h.side, type: 'heli' }); w.fx.push({ k: 'msg', t: h.side ? 'أسقطنا هليكوبتر للعدو' : 'خسرنا هليكوبتر', side: h.side }); }
    else if (a && a.kind === 'jet' && w.r() < .5) w.fx.push({ k: 'msg', t: a.side ? 'طائرة للعدو راوغت الصاروخ وهربت' : 'طائرتنا راوغت الصاروخ ونجت', side: a.side });
    return;
  }
  if (p.kind === 'mg') {
    const tu = p.tgt ? w.u.find(q => q.id === p.tgt) : null;
    if (tu && tu.alive && tu.type === 'inf') { tu.hitT = T; const s = tu.sol.find(q => q.alive && Math.hypot(q.x - p.tx, q.y - p.ty) < 7); if (s && mayKillSol(w, tu, .3)) killSol(w, tu, s); }
    w.fx.push({ k: 'mghit', x: p.tx, y: p.ty }); return;
  }
  const cal = { shell: 2.2, rocket: 1.9, ap: 1.1, atgm: 1.4, bomb: 3, can: .45, rpg: 1, mg: 0, sam: 0 }[p.kind], rad = { shell: 15, rocket: 14, ap: 4, atgm: 5, bomb: 22, can: 4, rpg: 4, mg: 0, sam: 0 }[p.kind];
  const tgt = p.tgt ? w.u.find(q => q.id === p.tgt) : null, cands = w.u.filter(u => u.alive && u.side !== p.side && u.type !== 'heli' && u.type !== 'truck' && dist(u, { x: p.tx, y: p.ty }) < rad + 6);
  let killed = false;
  for (const u of tgt && cands.includes(tgt) ? [tgt, ...cands.filter(c => c !== tgt)] : cands) {
    if (u.type === 'inf') { u.hitT = T; for (const s of u.sol) if (s.alive && Math.hypot(s.x - p.tx, s.y - p.ty) < rad && mayKillSol(w, u, p.kind === 'can' ? .35 : .5)) killSol(w, u, s); continue; }
    const base = ({ shell: .3, rocket: .25, ap: .62, atgm: .75, bomb: .7, can: .08, rpg: .45, mg: 0, sam: 0 } as Record<PK, number>)[p.kind] * (u === tgt ? 1 : .35);
    if (!killed && mayKill(w, u, base)) { kill(w, u); killed = true; }
    else if (u === tgt && (p.kind === 'ap' || p.kind === 'atgm' || p.kind === 'rpg' || p.kind === 'can')) { u.hitT = T; u.dmg++; w.fx.push({ k: 'hit', x: u.x + R(-2, 2), y: u.y + R(-2, 2), id: u.id });
      if ((u.type === 'tank' || u.type === 'ifv') && p.kind !== 'can' && w.r() < .6) { u.state = 'retreat'; u.retreatT = T + R(4, 7); } }   // مضروبة: ترجع لورا شوية
  }
  if (cal >= 1.4) for (const b of w.b) if (!b.dead && Math.hypot(b.x - p.tx, b.y - p.ty) < rad * .6 + b.w * .6) { b.hp -= cal * R(.12, .3); if (b.hp <= 0) { b.dead = true; w.fx.push({ k: 'house', id: b.id }); } }
  w.fx.push({ k: 'boom', x: p.tx, y: p.ty, cal, z: 0 });
}
export function bars(w: World) {
  const f = (s: 0 | 1) => { const tot = w.total[s].tank * 3 + w.total[s].ifv * 2 + w.total[s].inf * 5 * .4, lost = w.killed.veh[s] * 2.8 + w.killed.sol[s] * .4; return 100 * (1 - lost / Math.max(1, tot)); };
  return { a: f(0), d: f(1) };
}
export const phaseName = (w: World) => w.PH.filter(p => p[0] <= w.T).pop()![1];
export function skip(w: World) { while (!w.over) { step(w, .1); w.fx.length = 0; } }
