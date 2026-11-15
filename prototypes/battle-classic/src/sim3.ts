// المعركة الكلاسيكية v3 (D-028، I-053): قتال حقيقي بمخزون وتعزيزات ودفاع جوي يسقط وجبهة تتحرك.
// - أعداد كل طرف من عتاده (res.ca/cd): بالساحة عدد محدود، والباقي تعزيزات تجي بدال اللي ينضرب لحد ما يخلص المخزون.
// - الدفاع الجوي بذخيرة وإعادة تعبئة؛ كل صاروخ ينحسم وقت الإطلاق (يصيب/ينخدع بالمشاعل) باحتمال من قوة الدفاع مقابل الطيران.
// - «منظّم الخسائر»: خسائر الأرض النهائية = نفس معادلات الأصل من la/ld/win (D-026)؛ الضربة تقتل بس إذا الطرف تحت منحناه الزمني.
// - الشكل شكل الأصل: أيقونات مكبرة، بس الخريطة أكبر (600×1400) والجبهة تتقدم/تتراجع.
import { SAMPLES, stamp } from './sim.ts';
import type { Res, Terr } from './sim.ts';
export { SAMPLES, stamp }; export type { Res, Terr };

export const MW = 600, MH = 1400, S = 2.4, END = 255;
export type Kind = 'tank' | 'ifv' | 'inf' | 'arty' | 'mlrs' | 'ad' | 'heli';
export interface Sol { ox: number; oy: number; x: number; y: number; alive: boolean; prone: boolean; fireT: number; dieT: number; a: number }
export interface Unit {
  id: number; side: 0 | 1; type: Kind; x: number; y: number; hull: number; tur: number; alive: boolean; dieT: number; moving: boolean;
  cd: number; fireT: number; hitT: number; dmg: number; burn: number; slot: number; grp: number; sol: Sol[]; house: number; ammo: number; reload: number; alt: number; spawnT: number; rot: number; tx: number; ty: number;
}
export interface Air { id: number; side: 0 | 1; kind: 'jet' | 'drone'; model: string; x: number; y: number; alt: number; vx: number; vy: number; alive: boolean; state: 'in' | 'out' | 'down' | 'dive'; tx: number; ty: number; tgt: number; dropped: boolean; flareT: number; dieT: number; spin: number; engaged: number }
export type PK = 'shell' | 'rocket' | 'ap' | 'atgm' | 'sam' | 'bomb' | 'mg' | 'can' | 'rpg';
export interface Proj { id: number; kind: PK; side: 0 | 1; sx: number; sy: number; sz: number; tx: number; ty: number; tz: number; x: number; y: number; z: number; t: number; dur: number; tgt: number; air: number; hit: boolean; src: number }
export interface Bld { id: number; x: number; y: number; w: number; h: number; r: number; c: number; hp: number; dead: boolean; owner: 0 | 1 }
export type Fx =
  | { k: 'fire'; kind: PK; x: number; y: number; a: number; id: number; z: number }
  | { k: 'boom'; x: number; y: number; cal: number; z: number }
  | { k: 'hit'; x: number; y: number; id: number }
  | { k: 'kill'; id: number; side: 0 | 1; type: Kind | 'sol' }
  | { k: 'airkill'; id: number; side: 0 | 1 } | { k: 'crash'; x: number; y: number }
  | { k: 'flares'; id: number } | { k: 'jet'; id: number } | { k: 'spawn'; id: number }
  | { k: 'house'; id: number } | { k: 'capture'; id: number } | { k: 'smoke'; x: number; y: number }
  | { k: 'mghit'; x: number; y: number } | { k: 'msg'; t: string; side: 0 | 1 | 2 };
type Pool = { tank: number; ifv: number; inf: number; heli: number; jet: number; drone: number };
export interface World {
  T: number; res: Res; r: () => number; nid: number; u: Unit[]; air: Air[]; pr: Proj[]; b: Bld[]; fx: Fx[]; ev: { t: number; f: () => void }[];
  pool: [Pool, Pool]; total: [Pool, Pool]; cap: [Pool, Pool]; lastSpawn: Record<string, number>;
  budget: { veh: [number, number]; sol: [number, number]; sup: number }; killed: { veh: [number, number]; sol: [number, number]; sup: number; air: [number, number] };
  pk: [{ jet: number; drone: number; heli: number }, { jet: number; drone: number; heli: number }];
  frontA: number; frontD: number; vill: [number, number]; PH: [number, string][]; phase: number; over: boolean; withdraw: boolean;
}
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const lg = (n: number, k: number, lo: number, hi: number) => n <= 0 ? 0 : clamp(Math.round(Math.log2(n + 1) * k), lo, hi);
export function rng(seed: number) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const DEF_LINE = 520, VILL_Y = 230;
export const roadX = (y: number) => MW * .52 + Math.sin(y / 160) * 55 + Math.sin(y / 61) * 12;

export function create(res: Res, seed = (Math.random() * 1e9) | 0): World {
  const r = rng(seed), R = (a: number, b: number) => a + r() * (b - a), ca = res.ca, cd = res.cd;
  const total: [Pool, Pool] = [
    { tank: lg(ca.tank, 2.2, 4, 26), ifv: 0, inf: lg(ca.troops, 1.3, 4, 18), heli: lg(ca.heli, .8, 0, 6), jet: lg(ca.air, 1.5, 0, 14), drone: lg(ca.drone, 1.2, 0, 10) },
    { tank: lg(cd.tank, 2.0, 3, 24), ifv: 0, inf: lg(cd.troops, 1.2, 4, 16), heli: lg(cd.heli, .5, 0, 3), jet: lg(cd.air, 1.1, 0, 8), drone: lg(cd.drone, 1.2, 0, 10) },
  ];
  total[0].ifv = Math.ceil(total[0].inf / 3);
  const cap: [Pool, Pool] = [{ tank: 9, ifv: 4, inf: 8, heli: 3, jet: 2, drone: 2 }, { tank: 7, ifv: 0, inf: 8, heli: 2, jet: 2, drone: 2 }];
  const pk = (s: 0 | 1) => { const mine = s ? cd : ca, theirs = s ? ca : cd, j = clamp(.3 + .45 * mine.ad / (mine.ad + theirs.air * .5 + 1), .3, .8); return { jet: j, drone: Math.min(.92, j + .18), heli: clamp(j - .05, .25, .75) }; };
  const w: World = {
    T: 0, res, r, nid: 1, u: [], air: [], pr: [], b: [], fx: [], ev: [], pool: [{ ...total[0] }, { ...total[1] }], total, cap, lastSpawn: {},
    budget: { veh: [0, 0], sol: [0, 0], sup: 0 }, killed: { veh: [0, 0], sol: [0, 0], sup: 0, air: [0, 0] }, pk: [pk(0), pk(1)],
    frontA: 1150, frontD: DEF_LINE, vill: [MW / 2, VILL_Y], phase: 0, over: false, withdraw: false,
    PH: [[0, 'استطلاع بالمسيّرات'], [25, 'تمهيد مدفعي'], [70, 'ضربات جوية'], [100, 'ستار دخان'], [110, 'تقدّم الدروع'], [175, 'اقتحام المشاة'], [228, res.win ? 'تطهير القرية' : 'الانسحاب']],
  };
  // القرية
  const nb = res.cap ? 30 : 20;
  for (let i = 0, t = 0; i < nb && t < 4000; t++) { const x = MW / 2 + R(-230, 230) * (.45 + r() * .55), y = VILL_Y + R(-150, 120), bw = R(12, 18);
    if (w.b.some(b => Math.hypot(b.x - x, b.y - y) < (b.w + bw) * 1.25 + 4) || Math.abs(x - roadX(y)) < bw + 8) continue;
    w.b.push({ id: i++, x, y, w: bw, h: bw * R(.8, 1.2), r: R(-.25, .25), c: Math.floor(r() * 4), hp: 1, dead: false, owner: 1 }); }
  // ثابتين: مدفعية وراجمات ودفاع جوي
  const line = (n: number, cx: number, y: number, sp: number, f: (x: number, y: number, i: number) => void) => { for (let i = 0; i < n; i++) f(cx + (n === 1 ? 0 : (i / (n - 1) - .5)) * sp + R(-10, 10), y + R(-10, 10), i); };
  line(lg(ca.arty, .8, 1, 6), MW / 2, MH - 70, 380, (x, y) => mk(w, 0, 'arty', x, y));
  line(ca.arty > 60 ? 2 : ca.arty > 10 ? 1 : 0, MW / 2 + 230, MH - 95, 60, (x, y) => mk(w, 0, 'mlrs', x, y));
  line(lg(ca.ad, .5, 1, 3), MW / 2 - 200, MH - 130, 120, (x, y) => mk(w, 0, 'ad', x, y));
  line(lg(cd.arty, .6, 1, 4), MW / 2, 60, 320, (x, y) => mk(w, 1, 'arty', x, y));
  line(lg(cd.ad, .5, 1, 3), MW / 2 + 150, 110, 160, (x, y) => mk(w, 1, 'ad', x, y));
  // الأولى بالساحة
  for (let i = 0; i < Math.min(cap[1].tank, total[1].tank); i++) spawn(w, 1, 'tank', true);
  for (let i = 0; i < Math.min(cap[1].inf, total[1].inf); i++) spawn(w, 1, 'inf', true);
  for (let i = 0; i < Math.min(cap[0].tank, total[0].tank); i++) spawn(w, 0, 'tank', true);
  for (let i = 0; i < Math.min(cap[0].ifv, total[0].ifv); i++) spawn(w, 0, 'ifv', true);
  for (let i = 0; i < Math.min(cap[0].inf, total[0].inf); i++) spawn(w, 0, 'inf', true);
  // ميزانية الخسائر (نفس معادلات الأصل kill())
  const fa = clamp(res.la * 4.5, .05, .8), fd = res.win ? clamp(.45 + res.ld * 1.5, .5, .95) : clamp(res.ld * 2.5, .08, .4);
  const vehTot = (s: 0 | 1) => total[s].tank + total[s].ifv + w.u.filter(u => u.side === s && u.type === 'ad').length;
  w.budget.veh = [Math.round(vehTot(0) * fa), Math.round(vehTot(1) * fd)];
  w.budget.sol = [Math.round(total[0].inf * 5 * fa), Math.round(total[1].inf * 5 * fd)];
  w.budget.sup = Math.round(w.u.filter(u => u.side === 1 && u.type === 'arty').length * (res.win ? .7 : .2));
  // ستار الدخان
  for (let i = 0; i < 16; i++) w.ev.push({ t: 100 + i * .35, f: () => w.fx.push({ k: 'smoke', x: MW * (.04 + .92 * i / 15), y: 820 + R(-25, 25) }) });
  w.fx.push({ k: 'msg', t: 'بدأت العملية', side: 2 });
  return w;
}
function mk(w: World, side: 0 | 1, type: Kind, x: number, y: number): Unit {
  const a = side ? Math.PI / 2 : -Math.PI / 2;
  const u: Unit = { id: w.nid++, side, type, x, y, hull: a, tur: a, alive: true, dieT: -1, moving: false, cd: 1 + w.r() * 4, fireT: -9, hitT: -9, dmg: 0, burn: 0, slot: w.r(), grp: w.nid % 2, sol: [], house: -1, ammo: type === 'ad' ? 8 : 0, reload: 0, alt: type === 'heli' ? 0 : 0, spawnT: w.T, rot: w.r() * 6, tx: x, ty: y };
  if (type === 'inf') { const F = [[-5, -3], [4, -5], [-1, 1], [6, 4], [-6, 5]]; for (const [ox, oy] of F) u.sol.push({ ox: ox * S, oy: oy * S, x: x + ox * S, y: y + oy * S, alive: true, prone: false, fireT: -9, dieT: -1, a }); }
  w.u.push(u); return u;
}
/** تعزيز: يدخل من حافة طرفه (أو بمكانه لو بداية المعركة) */
function spawn(w: World, side: 0 | 1, type: 'tank' | 'ifv' | 'inf' | 'heli', initial = false) {
  if (w.pool[side][type] <= 0) return null; w.pool[side][type]--;
  const R = (a: number, b: number) => a + w.r() * (b - a), x = R(MW * .1, MW * .9);
  let y = side ? -40 : MH + 40;
  if (initial) y = side ? (type === 'inf' ? 0 : DEF_LINE + R(-25, 25)) : (type === 'tank' ? 1150 + R(-30, 30) : type === 'ifv' ? 1230 + R(-20, 20) : 1260 + R(-30, 30));
  const u = mk(w, side, type, x, y);
  if (type === 'inf' && side === 1) { const hs = w.b.filter(b => !b.dead).sort((a, b) => b.y - a.y), h = hs[w.u.filter(q => q.side === 1 && q.type === 'inf').length % Math.max(1, hs.length)]; if (h) { u.house = h.id; if (initial) { u.x = h.x; u.y = h.y + 10; u.sol.forEach(s => { s.x = u.x + s.ox * .8; s.y = u.y + s.oy * .8; s.prone = true; }); } } }
  if (!initial) w.fx.push({ k: 'spawn', id: u.id });
  return u;
}
function allowed(w: World, what: 'veh' | 'sol' | 'sup', side: 0 | 1) {
  const t = w.T; let k: number;
  if (what === 'sup') k = smooth(30, 100, t);
  else if (side === 1 && what === 'veh') k = .1 * smooth(30, 70, t) + .15 * smooth(70, 110, t) + .75 * smooth(110, 225, t);
  else if (side === 1) k = .1 * smooth(30, 110, t) + .9 * smooth(140, 235, t);
  else if (what === 'veh') k = .06 * smooth(40, 110, t) + .94 * smooth(115, 232, t);
  else k = smooth(140, 238, t);
  return (what === 'sup' ? w.budget.sup : w.budget[what][side]) * k;
}
const cat = (u: Unit): 'veh' | 'sup' | 'sol' | null => u.type === 'inf' ? 'sol' : (u.type === 'arty' || u.type === 'mlrs') ? (u.side === 1 ? 'sup' : null) : u.type === 'heli' ? null : 'veh';
function mayKill(w: World, u: Unit, base: number) {
  const c = cat(u); if (!c) return false;
  const done = c === 'sup' ? w.killed.sup : w.killed[c][u.side], al = allowed(w, c, u.side);
  if (done + 1 > al + .5) return false;
  return w.r() < Math.min(.97, base * (al - done > 2 ? 1.8 : 1) * (w.T > END - 40 ? 2.5 : 1));
}
function kill(w: World, u: Unit) {
  u.alive = false; u.dieT = w.T; u.moving = false; u.burn = u.type === 'inf' ? 0 : 14 + w.r() * 14;
  const c = cat(u); if (c === 'sup') w.killed.sup++; else if (c === 'veh') w.killed.veh[u.side]++;
  w.fx.push({ k: 'kill', id: u.id, side: u.side, type: u.type });
  const nm = { tank: 'دبابة', ifv: 'ناقلة', ad: 'منظومة دفاع جوي', arty: 'مدفع', mlrs: 'راجمة', heli: 'هليكوبتر', inf: 'حضيرة' }[u.type];
  w.fx.push({ k: 'msg', t: u.side ? `تدمير ${nm} للعدو` : `خسرنا ${nm}`, side: u.side });
}
function killSol(w: World, u: Unit, s: Sol) { s.alive = false; s.dieT = w.T; w.killed.sol[u.side]++; w.fx.push({ k: 'kill', id: u.id, side: u.side, type: 'sol' }); if (!u.sol.some(q => q.alive)) { u.alive = false; u.dieT = w.T; } }
const enemies = (w: World, side: number, f?: (u: Unit) => boolean) => w.u.filter(u => u.side !== side && u.alive && u.type !== 'heli' && (!f || f(u)));
function nearest<T extends { x: number; y: number }>(l: T[], p: { x: number; y: number }, max = 1e9) { let b: T | null = null, bd = max; for (const e of l) { const d = dist(e, p); if (d < bd) { bd = d; b = e; } } return b; }
function shoot(w: World, u: { id: number; side: 0 | 1; x: number; y: number }, kind: PK, tx: number, ty: number, tgt: number, o: { sz?: number; tz?: number; air?: number; hit?: boolean; spd?: number } = {}) {
  const d = Math.hypot(tx - u.x, ty - u.y), sp = o.spd ?? { shell: 170, rocket: 150, ap: 650, atgm: 190, sam: 330, bomb: 1, mg: 500, can: 520, rpg: 140 }[kind];
  const dur = kind === 'bomb' ? 1.5 : Math.max(.06, d / sp);
  w.pr.push({ id: w.nid++, kind, side: u.side, sx: u.x, sy: u.y, sz: o.sz ?? 2, tx, ty, tz: o.tz ?? 0, x: u.x, y: u.y, z: o.sz ?? 2, t: 0, dur, tgt, air: o.air ?? 0, hit: o.hit ?? false, src: u.id });
  const a = Math.atan2(ty - u.y, tx - u.x);
  if (kind !== 'mg') w.fx.push({ k: 'fire', kind, x: u.x, y: u.y, a, id: u.id, z: o.sz ?? 0 });
  return a;
}

export function step(w: World, dt: number) {
  w.T += dt; const T = w.T, res = w.res, R = (a: number, b: number) => a + w.r() * (b - a);
  if (w.over) return;
  const due = w.ev.filter(e => e.t <= T); w.ev = w.ev.filter(e => e.t > T); due.forEach(e => e.f());
  const ph = w.PH.filter(p => p[0] <= T).length - 1; if (ph !== w.phase) { w.phase = ph; w.fx.push({ k: 'msg', t: w.PH[ph][1], side: 2 }); }
  // ---------- الجبهة ----------
  if (res.win) { w.frontA = 1150 - smooth(110, 205, T) * (1150 - (DEF_LINE - 60)) - smooth(205, 236, T) * (DEF_LINE - 60 - (VILL_Y + 40)); w.frontD = DEF_LINE - smooth(185, 225, T) * (DEF_LINE - VILL_Y + 20) - smooth(232, 250, T) * 300; }
  else { w.frontA = 1150 - smooth(110, 170, T) * 380 + smooth(228, 250, T) * 420; w.frontD = DEF_LINE + smooth(185, 220, T) * 140; if (!w.withdraw && T > 228) { w.withdraw = true; w.fx.push({ k: 'msg', t: 'الهجوم تعطّل — قواتنا تنسحب', side: 0 }); for (let i = 0; i < 10; i++) w.fx.push({ k: 'smoke', x: MW * (.06 + .88 * i / 9), y: w.frontA - 30 }); } }
  // ---------- تعزيزات ----------
  if (Math.floor(T) !== Math.floor(T - dt)) for (const side of [0, 1] as const) for (const ty of ['tank', 'ifv', 'inf', 'heli'] as const) {
    const act = w.u.filter(u => u.side === side && u.type === ty && u.alive).length, key = side + ty;
    const ok = ty === 'heli' ? T > (side ? 120 : 115) && T < 235 : ty === 'inf' && side === 0 ? T > 60 : T > 20;
    if (ok && act < w.cap[side][ty] && w.pool[side][ty] > 0 && T - (w.lastSpawn[key] ?? -99) > (ty === 'heli' ? 14 : 5) && !(side === 0 && w.withdraw)) {
      const u = spawn(w, side, ty); if (u) { w.lastSpawn[key] = T; if (act > 0 && (ty === 'tank' || ty === 'heli')) w.fx.push({ k: 'msg', t: side ? `تعزيزات للعدو: ${ty === 'tank' ? 'دبابة' : 'هليكوبتر'}` : `وصلت ${ty === 'tank' ? 'دبابة' : 'هليكوبتر'} تعزيز`, side }); }
    }
  }
  // طيران ومسيّرات: طلعات متتالية (اللي يوقع يجي غيره)
  for (const side of [0, 1] as const) {
    const jets = w.air.filter(a => a.side === side && a.kind === 'jet' && a.state !== 'down').length, drones = w.air.filter(a => a.side === side && a.kind === 'drone' && a.state !== 'down').length;
    if (T > (side ? 80 : 70) && T < 232 && jets < w.cap[side].jet && w.pool[side].jet > 0 && T - (w.lastSpawn[side + 'jet'] ?? -99) > (T < 110 ? 5 : 16)) { w.lastSpawn[side + 'jet'] = T; sortie(w, side); }
    if (T > (side ? 6 : 1) && T < 240 && drones < w.cap[side].drone && w.pool[side].drone > 0 && T - (w.lastSpawn[side + 'drone'] ?? -99) > 9) { w.lastSpawn[side + 'drone'] = T; w.pool[side].drone--; const x = R(MW * .15, MW * .85); w.air.push({ id: w.nid++, side, kind: 'drone', model: side ? 'shahed' : 'tb2', x, y: side ? -40 : MH + 40, alt: 34, vx: 0, vy: side ? 32 : -32, alive: true, state: 'in', tx: x, ty: side ? R(800, 1150) : R(150, 600), tgt: 0, dropped: false, flareT: -9, dieT: -1, spin: 0, engaged: 0 }); }
  }
  // ---------- الوحدات ----------
  for (const u of w.u) {
    if (!u.alive) { if (u.burn > 0) u.burn -= dt; continue; }
    u.cd -= dt;
    let gx = u.x, gy = u.y, spd = 0;
    if (u.type === 'tank' || u.type === 'ifv') {
      const front = u.side ? w.frontD : w.frontA, off = u.type === 'ifv' ? 70 : 0;
      gx = MW * (.08 + .84 * u.slot); gy = front + (u.side ? -1 : 1) * (off + (u.grp ? 22 : 0));
      const arrived = Math.abs(u.y - gy) < 6, bound = T > 110 && Math.floor((T + u.grp * 6) / 12) % 2 === 0;   // قفزات: مجموعة تتحرك ومجموعة تغطي
      spd = T - u.spawnT < 30 && dist(u, { x: gx, y: gy }) > 60 ? 22 : bound || !arrived ? 13 : 0;
      if (u.side === 1 && res.win && T > 236) { gy = -80; spd = 14; }
    } else if (u.type === 'inf') {
      if (u.side === 0) {
        if (res.win && T > 175) { const h = w.b.find(b => b.id === u.house && b.owner === 1) ?? nearest(w.b.filter(b => b.owner === 1 && !w.u.some(q => q !== u && q.side === 0 && q.alive && q.type === 'inf' && q.house === b.id)), u) ?? nearest(w.b.filter(b => b.owner === 1), u); u.house = h ? h.id : -1; if (h) { gx = h.x + 8; gy = h.y + 16; } else { gx = w.vill[0]; gy = VILL_Y; }
          if (h && dist(u, h) < 32 && !w.u.some(d => d.side === 1 && d.alive && d.type === 'inf' && d.house === h.id)) { h.owner = 0; u.house = -1; w.fx.push({ k: 'capture', id: h.id }); } }
        else { gx = MW * (.1 + .8 * u.slot); gy = w.frontA + 45; }
        const far = dist(u, { x: gx, y: gy }) > 120; spd = far ? 19 : Math.floor((T + u.id) / 6) % 3 === 0 ? 0 : 9;   // بعيد: يركض (أو بالناقلة)، قريب: قفزات
      } else {
        const h = w.b.find(b => b.id === u.house); if (h) { gx = h.x; gy = h.y + 10; } else { gx = MW * (.15 + .7 * u.slot); gy = w.frontD - 40; }
        if (!res.win && T > 185 && T < 236) { gx = MW * (.12 + .76 * u.slot); gy = w.frontD + 30; }   // هجوم معاكس
        if (res.win && T > 236) { gy = -80; u.house = -1; } spd = 10;
      }
    } else if (u.type === 'heli') {
      const hover = u.side ? w.frontD - 160 : w.frontA + 170; gx = MW * (.15 + .7 * u.slot) + Math.sin(T * .4 + u.id) * 20; gy = (T > 238 || (u.side === 0 && w.withdraw)) ? (u.side ? -100 : MH + 100) : hover; spd = 26;
      u.alt = Math.min(24, u.alt + dt * 10);
    }
    if (spd > 0) {
      const dx = gx - u.x, dy = gy - u.y, d = Math.hypot(dx, dy);
      if (d > 2) { const a = Math.atan2(dy, dx); if (u.type === 'tank' || u.type === 'ifv') { u.hull += Math.atan2(Math.sin(a - u.hull), Math.cos(a - u.hull)) * Math.min(1, dt * 2.2); } else u.hull = a; const v = Math.min(spd, d * 1.5) * dt; u.x += Math.cos(u.type === 'tank' || u.type === 'ifv' ? u.hull : a) * v; u.y += Math.sin(u.type === 'tank' || u.type === 'ifv' ? u.hull : a) * v; u.moving = true; } else u.moving = false;
    } else u.moving = false;
    if (u.type === 'inf') { const under = T - u.hitT < 3; for (const s of u.sol) if (s.alive) { const tx = u.x + s.ox, ty = u.y + s.oy, ex = tx - s.x, ey = ty - s.y, ed = Math.hypot(ex, ey); if (ed > .5) { const k = Math.min(1, (u.moving ? 14 : 6) * dt / ed); s.x += ex * k; s.y += ey * k; } s.prone = (!u.moving && (under || u.side === 1 || T > 120)); } }
    if (u.type === 'tank' || u.type === 'ifv') { /* البرج يلف للهدف */ }
    // ---------- الرمي ----------
    if (u.cd > 0) continue;
    if (u.type === 'arty') {
      if (!(T > 25 && (u.side === 1 || (T < 205 && !w.withdraw)))) { u.cd = 1; continue; }
      const vis = enemies(w, u.side, e => (e as any).spotted !== false), tg = vis.length ? vis[Math.floor(w.r() * vis.length)] : null;
      if (tg) { u.tur = shoot(w, u, 'shell', tg.x + R(-16, 16), tg.y + R(-16, 16), tg.id); u.hull = u.tur; u.fireT = T; u.cd = T < 70 ? R(2.5, 4.5) : R(5, 8); } else u.cd = 2;
    } else if (u.type === 'mlrs') {
      if (!(T > 30 && T < 104)) { u.cd = 2; continue; }
      const vis = enemies(w, u.side), tg = vis[Math.floor(w.r() * vis.length)]; if (!tg) { u.cd = 2; continue; }
      u.hull = Math.atan2(tg.y - u.y, tg.x - u.x);
      for (let i = 0; i < 12; i++) w.ev.push({ t: T + i * .28, f: () => { if (u.alive) { shoot(w, u, 'rocket', tg.x + R(-26, 26), tg.y + R(-22, 22), i < 4 ? tg.id : 0); u.fireT = w.T; } } });
      u.cd = 24;
    } else if (u.type === 'ad') {
      if (u.ammo <= 0) { u.reload += dt; if (u.reload > 14) { u.ammo = 8; u.reload = 0; } u.cd = .5; continue; }
      const cand = w.air.filter(a => a.side !== u.side && a.alive && a.state !== 'down' && !a.engaged && dist(a, u) < 1000 && a.y > -20 && a.y < MH + 20).sort((a, b) => (a.kind === 'jet' ? 0 : 1) - (b.kind === 'jet' ? 0 : 1) || dist(a, u) - dist(b, u));
      const hl = !cand.length ? w.u.find(h => h.type === 'heli' && h.side !== u.side && h.alive && h.alt > 10 && !(h as any).engaged && dist(h, u) < 900) : null;
      if (cand.length) { const a = cand[0], hit = w.r() < w.pk[u.side][a.kind]; a.engaged = 1; u.tur = shoot(w, u, 'sam', a.x, a.y, 0, { air: a.id, tz: a.alt, sz: 4, hit }); u.hull = u.tur; u.ammo--; u.fireT = T; u.cd = R(2, 3.5); if (!hit && a.kind === 'jet') { a.flareT = T + Math.min(2.5, dist(a, u) / 330 - .8); } }
      else if (hl) { const hit = w.r() < w.pk[u.side].heli; (hl as any).engaged = 1; shoot(w, u, 'sam', hl.x, hl.y, hl.id, { tz: hl.alt, sz: 4, hit }); u.ammo--; u.fireT = T; u.cd = R(3, 5); }
      else u.cd = .6;
    } else if (u.type === 'tank' || u.type === 'ifv') {
      if (T < (u.side ? 60 : 105)) { u.cd = 1; continue; }
      const rng2 = u.type === 'tank' ? 430 : 260, list = enemies(w, u.side, e => e.type !== 'arty' && e.type !== 'mlrs'), pref = list.filter(e => u.type === 'tank' ? e.type !== 'inf' : e.type === 'inf' || e.type === 'ifv');
      const tg = nearest(pref.length ? pref : list, u, rng2); if (!tg) { u.cd = 1; continue; }
      u.tur = Math.atan2(tg.y - u.y, tg.x - u.x);
      if (u.type === 'tank') { shoot(w, u, 'ap', tg.x + R(-3, 3), tg.y + R(-3, 3), tg.id); u.fireT = T; u.cd = u.moving ? R(6, 9) : R(3.5, 6); }
      else { for (let i = 0; i < 5; i++) w.ev.push({ t: T + i * .15, f: () => { if (u.alive) { shoot(w, u, 'can', tg.x + R(-5, 5), tg.y + R(-5, 5), i === 4 ? tg.id : 0); u.fireT = w.T; } } }); u.cd = R(3, 5); }
    } else if (u.type === 'inf') {
      const tg = nearest(enemies(w, u.side, e => e.type === 'inf' || e.type === 'ifv' || e.type === 'tank'), u, 190);
      if (!tg) { u.cd = 1; continue; }
      if ((tg.type === 'tank' || tg.type === 'ifv') && dist(tg, u) < 120 && w.r() < .35) { const s = u.sol.find(q => q.alive)!; shoot(w, { id: u.id, side: u.side, x: s.x, y: s.y }, 'rpg', tg.x, tg.y, tg.id, { sz: 1 }); s.fireT = T; u.fireT = T; u.cd = R(8, 14); continue; }
      const al = u.sol.filter(q => q.alive); for (const s of al) if (w.r() < .6) { const tsol = tg.type === 'inf' ? tg.sol.filter(q => q.alive) : []; const q = tsol.length ? tsol[Math.floor(w.r() * tsol.length)] : null; s.a = Math.atan2((q ? q.y : tg.y) - s.y, (q ? q.x : tg.x) - s.x);
        for (let i = 0; i < 3; i++) w.ev.push({ t: T + i * .1 + w.r() * .3, f: () => { if (s.alive) { s.fireT = w.T; shoot(w, { id: u.id, side: u.side, x: s.x, y: s.y }, 'mg', (q ? q.x : tg.x) + R(-4, 4), (q ? q.y : tg.y) + R(-4, 4), i === 2 && q ? tg.id : 0, { sz: 1 }); } } }); }
      u.fireT = T; u.cd = R(1.2, 2.6);
    } else if (u.type === 'heli') {
      if (u.alt < 18 || T > 238) { u.cd = 1; continue; }
      const tg = nearest(enemies(w, u.side, e => e.type === 'tank' || e.type === 'ifv' || e.type === 'ad'), u, 420); if (!tg) { u.cd = 1.5; continue; }
      u.hull = Math.atan2(tg.y - u.y, tg.x - u.x); shoot(w, u, 'atgm', tg.x, tg.y, tg.id, { sz: u.alt }); u.fireT = T; u.cd = R(6, 10);
    }
  }
  // المسيّرات تكشف (المدفعية ترمي على المكشوف)
  // ---------- الجو ----------
  for (const a of w.air) {
    if (a.state === 'down') { a.dieT += 0; a.spin += dt * 4; a.alt = Math.max(0, a.alt - dt * (a.kind === 'jet' ? 26 : 18)); a.x += a.vx * dt * .5; a.y += a.vy * dt * .5; if (a.alt === 0 && a.alive) { a.alive = false; w.fx.push({ k: 'crash', x: a.x, y: a.y }); w.fx.push({ k: 'boom', x: a.x, y: a.y, cal: a.kind === 'jet' ? 3 : 1.4, z: 0 }); } continue; }
    if (a.kind === 'drone') {
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (a.side === 1 && T > 60 && !a.dropped && w.r() < dt * .03) { const tg = nearest(enemies(w, 1, e => e.type === 'tank' || e.type === 'arty' || e.type === 'ad'), a, 600); if (tg) { a.state = 'dive'; a.tgt = tg.id; a.tx = tg.x; a.ty = tg.y; a.dropped = true; w.fx.push({ k: 'msg', t: 'مسيّرة انتحارية للعدو تنقض', side: 1 }); } }
      if (a.state === 'dive') { const tg = w.u.find(q => q.id === a.tgt); if (tg) { a.tx = tg.x; a.ty = tg.y; } a.vx = dx / (d || 1) * 95; a.vy = dy / (d || 1) * 95; a.alt = Math.max(0, a.alt - dt * 9); if (d < 8) { a.alive = false; a.state = 'down'; w.fx.push({ k: 'boom', x: a.x, y: a.y, cal: 1.6, z: 0 }); if (tg && tg.alive && mayKill(w, tg, .7)) kill(w, tg); else if (tg) { tg.hitT = T; tg.dmg++; w.fx.push({ k: 'hit', x: tg.x, y: tg.y, id: tg.id }); } } }
      else { if (d < 20) { a.tx = MW * (.15 + .7 * w.r()); a.ty = a.side ? 750 + w.r() * 450 : 120 + w.r() * 480; } a.vx = dx / (d || 1) * 32; a.vy = dy / (d || 1) * 32;
        // طائرة بيرقدار تضرب بصاروخ صغير
        if (a.side === 0 && T > 40 && w.r() < dt * .06) { const tg = nearest(enemies(w, 0, e => e.type === 'tank' || e.type === 'ad' || e.type === 'arty'), a, 300); if (tg) shoot(w, { id: a.id, side: 0, x: a.x, y: a.y }, 'atgm', tg.x, tg.y, tg.id, { sz: a.alt }); } }
      a.x += a.vx * dt; a.y += a.vy * dt; continue;
    }
    a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.state === 'in' && !a.dropped && Math.hypot(a.tx - a.x, a.ty - a.y) < 70) {
      a.dropped = true; a.state = 'out';
      for (let i = 0; i < 3; i++) { const bx = a.tx + R(-22, 22), by = a.ty + R(-22, 22), tg = nearest(enemies(w, a.side), { x: bx, y: by }, 30); w.pr.push({ id: w.nid++, kind: 'bomb', side: a.side, sx: a.x, sy: a.y, sz: a.alt, tx: bx, ty: by, tz: 0, x: a.x, y: a.y, z: a.alt, t: -i * .18, dur: 1.5, tgt: tg?.id ?? 0, air: 0, hit: false, src: a.id }); }
      // ينسحب ويلف راجع لجهته
      const sgn = a.side ? -1 : 1; a.vx = a.vx * .6 + (w.r() - .5) * 90; a.vy = sgn * 170;
    }
  }
  w.air = w.air.filter(a => a.kind === 'drone' ? (a.alive || a.state === 'down') && (a.y > -150 && a.y < MH + 150 || a.state !== 'in') : (a.alive) && a.y > -260 && a.y < MH + 260 && a.x > -260 && a.x < MW + 260);
  // ---------- المقذوفات ----------
  w.pr = w.pr.filter(p => {
    p.t += dt; if (p.t < 0) return true;
    if (p.kind === 'sam') { const a = p.air ? w.air.find(q => q.id === p.air) : null, h = !a && p.tgt ? w.u.find(q => q.id === p.tgt) : null, tgt = a ?? h;
      if (tgt && (a ? a.state !== 'down' : h!.alive)) { const rem = Math.max(.05, p.dur - p.t); if (p.hit || p.t < p.dur * .7) { p.tx = tgt.x; p.ty = tgt.y; p.tz = a ? a.alt : h!.alt; } void rem; } }
    const k = Math.min(1, p.t / p.dur); p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k; p.z = p.sz + (p.tz - p.sz) * k;
    if (k < 1) return true;
    impact(w, p); return false;
  });
  if (T > END - 26 && Math.floor(T * 2) !== Math.floor((T - dt) * 2)) for (const side of [0, 1] as const) {
    if (w.killed.sol[side] + 1 > allowed(w, 'sol', side) + .5) continue;
    const sq = w.u.filter(u => u.side === side && u.alive && u.type === 'inf'), u = sq[Math.floor(w.r() * sq.length)]; if (!u) continue;
    const s = u.sol.find(q => q.alive), e = nearest(enemies(w, side), u, 600); if (!s || !e) continue;
    shoot(w, { id: e.id, side: e.side, x: e.x, y: e.y }, e.type === 'tank' || e.type === 'ifv' ? 'can' : 'mg', s.x, s.y, 0, { sz: 1 }); killSol(w, u, s);
  }
  if (T >= END) { w.over = true; w.fx.push({ k: 'msg', t: res.win ? (res.captured ? 'سيطرة كاملة' : 'نجحت العملية') : 'فشل الهجوم', side: res.win ? 0 : 1 }); }
}
function sortie(w: World, side: 0 | 1) {
  const R = (a: number, b: number) => a + w.r() * (b - a), list = enemies(w, side), pri = list.filter(u => u.type === 'ad' || u.type === 'arty' || u.type === 'tank');
  const tg = (pri.length ? pri : list)[Math.floor(w.r() * (pri.length || list.length))]; if (!tg) return;
  w.pool[side].jet--;
  const y0 = side ? -200 : MH + 200, x0 = tg.x + R(-150, 150), a = Math.atan2(tg.y - y0, tg.x - x0), sp = 190;
  const j: Air = { id: w.nid++, side, kind: 'jet', model: side ? 'f16' : 'su25', x: x0, y: y0, alt: 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, alive: true, state: 'in', tx: tg.x, ty: tg.y, tgt: tg.id, dropped: false, flareT: -9, dieT: -1, spin: 0, engaged: 0 };
  w.air.push(j); w.fx.push({ k: 'jet', id: j.id });
}
function impact(w: World, p: Proj) {
  const R = (a: number, b: number) => a + w.r() * (b - a), T = w.T;
  if (p.kind === 'sam') {
    const a = p.air ? w.air.find(q => q.id === p.air) : null, h = !a && p.tgt ? w.u.find(q => q.id === p.tgt) : null;
    if (a) a.engaged = 0; if (h) (h as any).engaged = 0;
    w.fx.push({ k: 'boom', x: p.tx, y: p.ty, cal: .9, z: p.tz });
    if (p.hit && a && a.state !== 'down') { a.state = 'down'; a.dieT = T; w.killed.air[a.side]++; w.fx.push({ k: 'airkill', id: a.id, side: a.side }); w.fx.push({ k: 'msg', t: a.side ? `دفاعنا الجوي أسقط ${a.kind === 'jet' ? 'طائرة' : 'مسيّرة'} للعدو` : `دفاع العدو أسقط ${a.kind === 'jet' ? 'طائرة' : 'مسيّرة'} لنا`, side: a.side }); }
    else if (p.hit && h && h.alive) { h.alive = false; h.dieT = T; h.burn = 10; w.fx.push({ k: 'kill', id: h.id, side: h.side, type: 'heli' }); w.fx.push({ k: 'msg', t: h.side ? 'أسقطنا هليكوبتر للعدو' : 'خسرنا هليكوبتر', side: h.side }); }
    return;
  }
  if (p.kind === 'mg') {
    const tu = p.tgt ? w.u.find(q => q.id === p.tgt) : null;
    if (tu && tu.alive && tu.type === 'inf') { tu.hitT = T; const s = tu.sol.find(q => q.alive && Math.hypot(q.x - p.tx, q.y - p.ty) < 7); if (s && mayKillSol(w, tu, .3)) killSol(w, tu, s); }
    w.fx.push({ k: 'mghit', x: p.tx, y: p.ty }); return;
  }
  const cal = { shell: 2.2, rocket: 1.9, ap: 1.1, atgm: 1.4, bomb: 3, can: .45, rpg: 1, mg: 0, sam: 0 }[p.kind], rad = { shell: 15, rocket: 14, ap: 4, atgm: 5, bomb: 22, can: 4, rpg: 4, mg: 0, sam: 0 }[p.kind];
  const tgt = p.tgt ? w.u.find(q => q.id === p.tgt) : null, cands = w.u.filter(u => u.alive && u.side !== p.side && u.type !== 'heli' && dist(u, { x: p.tx, y: p.ty }) < rad + 6);
  let killed = false;
  for (const u of tgt && cands.includes(tgt) ? [tgt, ...cands.filter(c => c !== tgt)] : cands) {
    if (u.type === 'inf') { u.hitT = T; for (const s of u.sol) if (s.alive && Math.hypot(s.x - p.tx, s.y - p.ty) < rad && mayKillSol(w, u, p.kind === 'can' ? .35 : .5)) killSol(w, u, s); continue; }
    const base = ({ shell: .3, rocket: .25, ap: .62, atgm: .75, bomb: .7, can: .08, rpg: .45, mg: 0, sam: 0 } as Record<PK, number>)[p.kind] * (u === tgt ? 1 : .35);
    if (!killed && mayKill(w, u, base)) { kill(w, u); killed = true; }
    else if (u === tgt && (p.kind === 'ap' || p.kind === 'atgm' || p.kind === 'rpg' || p.kind === 'can')) { u.hitT = T; u.dmg++; w.fx.push({ k: 'hit', x: u.x + R(-2, 2), y: u.y + R(-2, 2), id: u.id }); }
  }
  if (cal >= 1.4) for (const b of w.b) if (!b.dead && Math.hypot(b.x - p.tx, b.y - p.ty) < rad * .6 + b.w * .6) { b.hp -= cal * R(.12, .3); if (b.hp <= 0) { b.dead = true; w.fx.push({ k: 'house', id: b.id }); } }
  // الطلقة الخارقة اللي تخطئ تكمل وتضرب الأرض ورا؛ الباقي ينفجر بمكانه
  w.fx.push({ k: 'boom', x: p.tx, y: p.ty, cal, z: 0 });
}
function mayKillSol(w: World, u: Unit, base: number) { const al = allowed(w, 'sol', u.side), done = w.killed.sol[u.side]; if (done + 1 > al + .5) return false; return w.r() < Math.min(.95, base * (al - done > 3 ? 1.8 : 1) * (w.T > END - 40 ? 2.5 : 1)); }

export function bars(w: World) {
  const f = (s: 0 | 1) => { const tot = w.total[s].tank * 3 + w.total[s].ifv * 2 + w.total[s].inf * 5 * .4, lost = w.killed.veh[s] * 2.8 + w.killed.sol[s] * .4; return 100 * (1 - lost / Math.max(1, tot)); };
  return { a: f(0), d: f(1) };
}
export const phaseName = (w: World) => w.PH.filter(p => p[0] <= w.T).pop()![1];
export function skip(w: World) { while (!w.over) { step(w, .1); w.fx.length = 0; } }
