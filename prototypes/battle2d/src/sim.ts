// معركة الهجوم 2D الواقعية (I-049، D-026) — محاكاة بدون رسم، تتفحص بـ Node.
// النتيجة (فوز/خسارة، خسائر الطرفين) تجي من حساب اللعبة (doOp → res)، والمعركة تمثّلها بقتال حقيقي ممدود (~9 دقايق):
// نفس مراحل الأصل بالترتيب، بس كل طلقة لها رامي وهدف ومسار، والإصابة تنحسم عند الوصول.
// «منظّم الخسائر»: كل طرف عنده عدد قتلى نهائي (من res، بنفس معادلات الأصل) ومنحنى زمني؛ الضربة تقتل بس إذا الطرف بعده تحت منحناه،
// فالقتل يصير من ضربات حقيقية والنتيجة تطابق الحساب.
// الميدان: x من 0 لـ FW (متر، يسار←يمين)، y من 0 (الشمال، القرية) لـ FH (الجنوب، المهاجم).

export const FW = 900, FH = 1600;
export type Terr = 'desert' | 'plain' | 'hills' | 'mount';
export type Tactic = 'direct' | 'flank' | 'siege';
export interface Comp { troops: number; tank: number; air: number; arty: number; ad: number; drone: number; heli: number }
export interface Res { ca: Comp; cd: Comp; la: number; ld: number; win: boolean; cap: boolean; fell: boolean; captured: boolean; rname: string; wk: number; terr: Terr; tactic?: Tactic; an?: string; bn?: string }

export type Kind = 'tank' | 'ifv' | 'inf' | 'arty' | 'mlrs' | 'ad' | 'heli';
export interface Sol { x: number; y: number; ox: number; oy: number; alive: boolean; pose: 0 | 1 | 2; dir: number; fireT: number; deadT: number }   // pose: 0 واقف/يمشي، 1 منبطح، 2 يركض
export interface Unit {
  id: number; side: 0 | 1; kind: Kind; x: number; y: number; hd: number; tur: number; alive: boolean; deadT: number;
  tx: number; ty: number; spd: number; moving: boolean; cd: number; fireT: number; grp: number; spotted: boolean;
  sol: Sol[]; house: number; mounted: boolean; carrier: number; alt: number; smokeT: number; hitT: number; bx: number;
}
export interface Bld { id: number; x: number; y: number; w: number; h: number; r: number; t: number; hp: number; dead: boolean; owner: 0 | 1 }
export interface Air { id: number; side: 0 | 1; kind: 'jet' | 'drone'; x: number; y: number; alt: number; vx: number; vy: number; alive: boolean; tx: number; ty: number; dropped: boolean; deadT: number; model: string }
export type PKind = 'shell' | 'rocket' | 'ap' | 'atgm' | 'sam' | 'bomb' | 'mg' | 'can';
export interface Proj { id: number; kind: PKind; side: 0 | 1; sx: number; sy: number; sz: number; tx: number; ty: number; tz: number; t: number; dur: number; arc: number; tgt: number; air: number; x: number; y: number; z: number }
export type Fx =
  | { k: 'fire'; id: number; kind: PKind; x: number; y: number; a: number }
  | { k: 'boom'; x: number; y: number; cal: number; air?: boolean }
  | { k: 'hit'; x: number; y: number; kill: boolean; metal: boolean }
  | { k: 'mghit'; x: number; y: number }
  | { k: 'kill'; id: number; side: 0 | 1; kind: Kind | 'jet' | 'drone' | 'sol' }
  | { k: 'house'; id: number }
  | { k: 'capture'; id: number }
  | { k: 'smoke'; x: number; y: number; big: boolean }
  | { k: 'jet'; id: number }
  | { k: 'msg'; t: string; side: 0 | 1 | 2 };

export interface World {
  T: number; END: number; res: Res; tac: Tactic; r: () => number; nid: number;
  u: Unit[]; b: Bld[]; air: Air[]; pr: Proj[]; fx: Fx[]; ev: { t: number; f: () => void }[];
  PH: [number, string][]; vill: [number, number]; budget: { veh: [number, number]; sol: [number, number]; sup: number };
  killed: { veh: [number, number]; sol: [number, number]; sup: number }; over: boolean; phase: number; withdraw: boolean;
  T_ARMOR: number; T_ASSAULT: number; T_PREP: number; T_AIR: number; T_SMOKE: number;
}

const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
export const icons = (n: number, max: number, k: number) => n <= 0 ? 0 : clamp(Math.round(Math.log2(n + 1) * k), 1, max);
export function rng(seed: number) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const isSup = (u: Unit) => u.kind === 'arty' || u.kind === 'mlrs' || (u.side === 1 && u.kind === 'ad');

export function create(res: Res, seed = (Math.random() * 1e9) | 0): World {
  const r = rng(seed), R = (a: number, b: number) => a + r() * (b - a), tac: Tactic = res.tactic ?? 'direct';
  // الجدول: الحصار يطوّل التمهيد ويقصّر الاقتحام؛ الالتفاف يقصّر التمهيد
  const T_PREP = tac === 'flank' ? 40 : 45, T_AIR = tac === 'siege' ? 230 : tac === 'flank' ? 125 : 150, T_SMOKE = T_AIR + 60, T_ARMOR = T_SMOKE + 25, T_ASSAULT = T_ARMOR + (tac === 'flank' ? 120 : 130), END = T_ASSAULT + (res.win ? 170 : 140);
  const w: World = {
    T: 0, END, res, tac, r, nid: 1, u: [], b: [], air: [], pr: [], fx: [], ev: [],
    PH: [[0, 'استطلاع بالمسيّرات'], [T_PREP, 'تمهيد مدفعي'], [T_AIR, 'ضربات جوية'], [T_SMOKE, 'ستار دخان'], [T_ARMOR, tac === 'flank' ? 'التفاف الدروع' : 'تقدّم الدروع'], [T_ASSAULT, 'اقتحام المشاة'], [END - 60, res.win ? 'تطهير القرية' : 'الانسحاب']],
    vill: [FW / 2, 260], budget: { veh: [0, 0], sol: [0, 0], sup: 0 }, killed: { veh: [0, 0], sol: [0, 0], sup: 0 }, over: false, phase: 0, withdraw: false,
    T_ARMOR, T_ASSAULT, T_PREP, T_AIR, T_SMOKE,
  };
  const ca = res.ca, cd = res.cd;
  const mk = (side: 0 | 1, kind: Kind, x: number, y: number, grp = 0): Unit => {
    const u: Unit = { id: w.nid++, side, kind, x, y, hd: side ? Math.PI / 2 : -Math.PI / 2, tur: side ? Math.PI / 2 : -Math.PI / 2, alive: true, deadT: -1, tx: x, ty: y, spd: 0, moving: false, cd: R(1, 6), fireT: -99, grp, spotted: false, sol: [], house: -1, mounted: false, carrier: -1, alt: 0, smokeT: -99, hitT: -99, bx: x };
    if (kind === 'inf') for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + R(-.3, .3), rr = i ? R(5, 11) : 0; u.sol.push({ x, y, ox: Math.cos(a) * rr, oy: Math.sin(a) * rr * 0.6, alive: true, pose: 0, dir: u.hd, fireT: -99, deadT: -1 }); }
    w.u.push(u); return u;
  };
  const line = (n: number, cx: number, y: number, spread: number, f: (x: number, y: number, i: number) => void) => { for (let i = 0; i < n; i++) f(cx + (n === 1 ? 0 : (i / (n - 1) - .5)) * spread + R(-12, 12), y + R(-20, 20), i); };
  // القرية: بيوت متجمعة حول الطريق بالشمال
  const nb = res.cap ? 30 : 18;
  for (let i = 0, t = 0; i < nb && t < 3000; t++) {
    const x = FW / 2 + R(-260, 260) * (0.5 + r() * 0.5), y = 260 + R(-170, 150), ty = Math.floor(r() * 5), wd = [11.6, 12.4, 13.2, 15.4, 16.8][ty];
    if (w.b.some(b => Math.hypot(b.x - x, b.y - y) < (b.w + wd) * 0.62 + 6) || Math.abs(x - roadX(y)) < wd * 0.55 + 7) continue;
    w.b.push({ id: i++, x, y, w: wd, h: wd, r: R(-0.25, 0.25) + (r() < .5 ? 0 : Math.PI / 2), t: ty, hp: 1, dead: false, owner: 1 });
  }
  w.vill = [w.b.reduce((a, b) => a + b.x, 0) / w.b.length, w.b.reduce((a, b) => a + b.y, 0) / w.b.length];
  // المدافع: دبابات بخط أمام القرية، مشاة بالبيوت، مدفعية ودفاع جوي ورا
  const nTD = icons(cd.tank, 10, 1.4), nID = icons(cd.troops, 10, 1.0), nAD = icons(cd.arty, 4, 0.6), nDD = icons(cd.ad, 3, 0.4);
  line(nTD, FW / 2, 520, 560, x2 => mk(1, 'tank', x2, 520 + R(-30, 30)));
  const hs = [...w.b].sort((a, b) => b.y - a.y);   // البيوت الجنوبية أول (مواجهة الهجوم)
  for (let i = 0; i < nID; i++) { const h = hs[i % hs.length], u = mk(1, 'inf', h.x, h.y); u.house = h.id; u.sol.forEach(s => { s.ox *= 0.9; s.oy *= 0.9; s.pose = 1; }); }
  line(nAD, FW / 2, 70, 360, x2 => mk(1, 'arty', x2, 70));
  line(nDD, FW / 2, 120, 300, x2 => mk(1, 'ad', x2, 120));
  // المهاجم: دروع بمجموعتين (قفزات)، ناقلات بالمشاة، مدفعية وراجمات ودفاع جوي بالخلف، هليكوبترات تجي بعدين
  const nTA = icons(ca.tank, 12, 1.6), nIA = icons(ca.troops, 10, 1.0), nAA = icons(ca.arty, 6, 0.8), nMA = ca.arty > 60 ? 2 : ca.arty > 10 ? 1 : 0, nDA = icons(ca.ad, 2, 0.3), nHA = icons(ca.heli, 4, 0.5);
  line(nTA, FW / 2, 1330, 640, (x2, y2, i) => mk(0, 'tank', x2, y2, i % 2));
  const nIFV = Math.max(1, Math.ceil(nIA / 2));
  line(nIFV, FW / 2, 1440, 560, (x2, y2, i) => mk(0, 'ifv', x2, y2, i % 2));
  const ifvs = w.u.filter(u => u.side === 0 && u.kind === 'ifv');
  for (let i = 0; i < nIA; i++) { const c = ifvs[i % ifvs.length], u = mk(0, 'inf', c.x, c.y); u.mounted = true; u.carrier = c.id; }
  line(nAA, FW / 2, 1560, 520, x2 => mk(0, 'arty', x2, 1560));
  line(nMA, FW / 2 + 300, 1545, 120, x2 => mk(0, 'mlrs', x2, 1545));
  line(nDA, FW / 2 - 320, 1520, 120, x2 => mk(0, 'ad', x2, 1520));
  for (let i = 0; i < nHA; i++) mk(0, 'heli', FW * (.2 + .6 * (nHA === 1 ? .5 : i / (nHA - 1))), FH + 150, i);
  // طيران: طلعات بأزواج خلال مرحلة الضربات الجوية (وطلعات العدو أقل)
  const nJA = icons(ca.air, 6, 0.7), nJD = icons(cd.air, 3, 0.4);
  for (let i = 0; i < nJA; i++) w.ev.push({ t: T_AIR + 4 + i * ((T_SMOKE - T_AIR - 12) / Math.max(1, nJA)), f: () => sortie(w, 0) });
  for (let i = 0; i < nJD; i++) w.ev.push({ t: T_AIR + 18 + i * 22 + R(0, 8), f: () => sortie(w, 1) });
  if (ca.drone > 0) w.ev.push({ t: 2, f: () => drone(w, 0) });
  if (cd.drone > 0) w.ev.push({ t: 14, f: () => drone(w, 1) });
  // ستار الدخان: خط قذائف دخان بين الطرفين
  for (let i = 0; i < 14; i++) w.ev.push({ t: T_SMOKE + 2 + i * 0.6, f: () => { const x = FW * (0.06 + 0.88 * i / 13); w.fx.push({ k: 'smoke', x, y: 900 + R(-30, 30), big: true }); } });
  // ميزانية الخسائر — نفس معادلات الأصل (kill): المهاجم clamp(la×4.5)، المدافع حسب الفوز
  const fa = clamp(res.la * 4.5, .05, .8), fd = res.win ? clamp(.45 + res.ld * 1.5, .5, .95) : clamp(res.ld * 2.5, .08, .4);
  const veh = (s: 0 | 1) => w.u.filter(u => u.side === s && u.kind !== 'inf' && !isSup(u)).length, sols = (s: 0 | 1) => w.u.filter(u => u.side === s && u.kind === 'inf').reduce((a, u) => a + u.sol.length, 0);
  w.budget.veh = [Math.round(veh(0) * fa), Math.round(veh(1) * fd)];
  w.budget.sol = [Math.round(sols(0) * fa), Math.round(sols(1) * fd)];
  w.budget.sup = Math.round(w.u.filter(u => u.side === 1 && isSup(u)).length * (res.win ? .7 : .2));
  w.fx.push({ k: 'msg', t: 'بدأت العملية: الطائرات المسيّرة تستطلع مواقع العدو', side: 2 });
  return w;
}
export function roadX(y: number) { return FW * 0.55 + Math.sin(y / 180) * 70; }

/** المنحنى الزمني: نسبة القتلى المسموحة لحد هسه */
function allowed(w: World, what: 'veh' | 'sol' | 'sup', side: 0 | 1) {
  const t = w.T, A = w.T_ARMOR, S = w.T_ASSAULT, E = w.END, P = w.T_PREP;
  let k = 0;
  if (what === 'sup') k = smooth(P + 15, w.T_SMOKE, t);
  else if (side === 1 && what === 'veh') k = 0.15 * smooth(P + 20, w.T_AIR, t) + 0.25 * smooth(w.T_AIR, w.T_SMOKE, t) + 0.6 * smooth(A, S + 40, t);
  else if (side === 1) k = 0.15 * smooth(P + 20, A, t) + 0.25 * smooth(A, S, t) + 0.6 * smooth(S, E - 45, t);
  else if (what === 'veh') k = 0.1 * smooth(P + 30, A, t) + 0.9 * smooth(A + 20, E - 50, t);
  else k = smooth(S - 20, E - 40, t);
  return (what === 'sup' ? w.budget.sup : w.budget[what][side]) * k;
}
/** تكدر هالضربة تقتل؟ (المنظّم) */
function mayKill(w: World, u: Unit, base: number) {
  const s = u.side, what: 'veh' | 'sol' | 'sup' = isSup(u) ? 'sup' : u.kind === 'inf' ? 'sol' : 'veh';
  if (what === 'sup' && s === 0) return false;   // مدفعية المهاجم ما تنضرب (مثل الأصل)
  const done = what === 'sup' ? w.killed.sup : w.killed[what][s], al = allowed(w, what, s);
  if (done + 1 > al + 0.5) return false;
  const behind = al - done; return w.r() < Math.min(0.97, base * (behind > 2 ? 1.8 : 1) * (w.T > w.END - 50 ? 3 : 1));
}
function count(w: World, u: Unit) { if (isSup(u)) w.killed.sup++; else if (u.kind !== 'inf') w.killed.veh[u.side]++; }

function sortie(w: World, side: 0 | 1) {
  const R = (a: number, b: number) => a + w.r() * (b - a);
  const tgts = w.u.filter(u => u.side !== side && u.alive && u.kind !== 'heli' && !u.mounted); if (!tgts.length) return;
  const pri = tgts.filter(u => u.kind === 'arty' || u.kind === 'ad' || u.kind === 'tank'), t = (pri.length ? pri : tgts)[Math.floor(w.r() * (pri.length || tgts.length))];
  for (let k = 0; k < 2; k++) {
    const y0 = side ? -400 : FH + 400, x0 = t.x + R(-250, 250), ang = Math.atan2(t.y - y0, t.x + (k ? 40 : -40) - x0), sp = 210;
    const a: Air = { id: w.nid++, side, kind: 'jet', x: x0 + (k ? 60 : 0), y: y0 + (k ? (side ? -90 : 90) : 0), alt: 320, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, alive: true, tx: t.x + (k ? 35 : -35), ty: t.y, dropped: false, deadT: -1, model: side ? 'f16' : 'su25' };
    w.air.push(a); w.fx.push({ k: 'jet', id: a.id });
  }
  w.fx.push({ k: 'msg', t: side ? 'طائرات العدو تهاجم مواقعنا' : 'طائراتنا تضرب مواقع العدو', side });
}
function drone(w: World, side: 0 | 1) { w.air.push({ id: w.nid++, side, kind: 'drone', x: side ? FW + 100 : -100, y: side ? 900 : 700, alt: 900, vx: side ? -38 : 38, vy: 0, alive: true, tx: 0, ty: 0, dropped: false, deadT: -1, model: side ? 'shahed' : 'tb2' }); }

function enemies(w: World, u: { side: number }, kinds?: Kind[]) { return w.u.filter(e => e.side !== u.side && e.alive && !e.mounted && (!kinds || kinds.includes(e.kind))); }
function nearest(list: Unit[], p: { x: number; y: number }, max = 1e9) { let b: Unit | null = null, bd = max; for (const e of list) { const d = dist(e, p); if (d < bd) { bd = d; b = e; } } return b; }
function fire(w: World, u: Unit, kind: PKind, tx: number, ty: number, tgt: number, opt: { air?: number; tz?: number; sz?: number } = {}) {
  const d = Math.hypot(tx - u.x, ty - u.y), spd = { shell: 260, rocket: 230, ap: 1500, atgm: 280, sam: 700, bomb: 1, mg: 800, can: 1000 }[kind];
  const arc = kind === 'shell' ? d * 0.35 : kind === 'rocket' ? d * 0.22 : 0, dur = Math.max(0.06, d / spd + (kind === 'shell' ? 2 : 0));
  const sz = opt.sz ?? (u.kind === 'heli' ? u.alt : 2);
  w.pr.push({ id: w.nid++, kind, side: u.side, sx: u.x, sy: u.y, sz, tx, ty, tz: opt.tz ?? 1, t: 0, dur, arc, tgt, air: opt.air ?? 0, x: u.x, y: u.y, z: sz });
  u.fireT = w.T; if (kind !== 'mg' && w.r() < 0.5) u.spotted = true; const a = Math.atan2(ty - u.y, tx - u.x); if (u.kind === 'tank' || u.kind === 'ifv') u.tur = a; else if (u.kind !== 'inf' && u.kind !== 'heli') u.hd = a;
  if (kind !== 'mg') w.fx.push({ k: 'fire', id: u.id, kind, x: u.x, y: u.y, a });
}

export function step(w: World, dt: number) {
  if (w.over) { w.T += dt; return; }
  w.T += dt; const T = w.T, R = (a: number, b: number) => a + w.r() * (b - a), res = w.res;
  const due = w.ev.filter(e => e.t <= T); w.ev = w.ev.filter(e => e.t > T); due.forEach(e => e.f());
  const ph = w.PH.filter(p => p[0] <= T).length - 1; if (ph !== w.phase) { w.phase = ph; const m = PHASE_MSG[ph]; if (m) w.fx.push({ k: 'msg', t: m(w), side: 2 }); }
  const lose = !res.win, stopY = lose ? 820 : 470;   // الدروع توقف هنا (بالفشل تتعطل أبعد)
  if (lose && !w.withdraw && T > w.END - 70) { w.withdraw = true; w.fx.push({ k: 'msg', t: 'الهجوم تعطّل — قواتنا تنسحب تحت ستار الدخان', side: 0 }); for (let i = 0; i < 8; i++) w.fx.push({ k: 'smoke', x: FW * (0.1 + 0.8 * i / 7), y: 950, big: true }); }

  if (Math.floor(T) !== Math.floor(T - dt)) for (const u of w.u) if (u.alive && !u.spotted && !u.mounted && u.kind !== 'heli' && w.u.some(e => e.side !== u.side && e.alive && !e.mounted && e.kind !== 'arty' && dist(e, u) < 850)) u.spotted = true;
  for (const u of w.u) {
    if (!u.alive || u.mounted) continue;
    u.cd -= dt;
    // ---------- الحركة ----------
    if (u.side === 0 && (u.kind === 'tank' || u.kind === 'ifv')) {
      if (w.withdraw) { u.tx = u.x; u.ty = 1400; }
      else if (T > w.T_ARMOR) {
        // قفزات: مجموعة تتحرك 12 ث والثانية تغطي، وبعدين تتبادل
        const cyc = Math.floor((T - w.T_ARMOR) / 12), go = cyc % 2 === u.grp;
        const front = u.kind === 'tank' ? stopY : stopY + 160;
        // الالتفاف: الدبابات تطلع للشرق بنص الطريق وترجع تدخل على جنب القرية
        const flank = w.tac === 'flank' && u.kind === 'tank' ? Math.sin(clamp((1330 - u.y) / (1330 - front), 0, 1) * Math.PI * 0.75) * 300 - (u.bx - FW / 2) * 0.4 : 0;
        if (go) { u.ty = Math.max(front, u.y - 90); u.tx = u.bx + flank; }
      }
    }
    if (u.side === 1 && u.kind === 'tank' && lose && T > w.T_ASSAULT + 40 && !w.withdraw) u.ty = 660;   // هجوم معاكس بالفشل
    if (u.side === 1 && res.win && T > w.END - 40) { u.ty = -80; }   // بقايا العدو تنسحب شمال
    if (u.kind === 'heli') stepHeli(w, u, dt);
    else if (u.kind !== 'inf') {
      const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy), vmax = u.kind === 'tank' ? 7 : u.kind === 'ifv' ? 8 : 5;
      if (d > 2) { u.spd = Math.min(vmax, u.spd + dt * 2.5, d * 0.8); const a = Math.atan2(dy, dx); u.hd += Math.atan2(Math.sin(a - u.hd), Math.cos(a - u.hd)) * Math.min(1, dt * 1.6); u.x += Math.cos(u.hd) * u.spd * dt; u.y += Math.sin(u.hd) * u.spd * dt; u.moving = true; }
      else { u.spd = 0; u.moving = false; }
    }
    // الناقلة توصل خط النزول ← تنزّل المشاة
    if (u.kind === 'ifv' && u.side === 0 && !w.withdraw && T > w.T_ARMOR && u.y <= stopY + 175 && !u.moving) for (const s of w.u) if (s.mounted && s.carrier === u.id) { s.mounted = false; s.x = u.x + R(-8, 8); s.y = u.y + 10; s.sol.forEach(q => { q.x = s.x + q.ox; q.y = s.y + q.oy; }); s.tx = s.x; s.ty = s.y; w.fx.push({ k: 'msg', t: 'المشاة نزلوا من الناقلات', side: 0 }); }
    if (u.kind === 'inf') stepInf(w, u, dt);
    // ---------- الرمي ----------
    if (u.cd > 0) continue;
    if (u.kind === 'arty') {
      const ok = u.side === 0 ? T > w.T_PREP && T < w.T_ASSAULT + 60 && !w.withdraw : T > w.T_PREP + 8;
      if (!ok) { u.cd = 2; continue; }
      // تهدف على اللي انكشف (المسيّرة) — المدفعية تفضّل مدفعية العدو ودفاعه الجوي بالتمهيد
      const vis = enemies(w, u).filter(e => e.spotted && e.kind !== 'heli'), pref = vis.filter(e => (T < w.T_ARMOR ? ['arty', 'ad', 'tank'] : ['tank', 'ifv', 'inf']).includes(e.kind));
      const tg = (pref.length ? pref : vis)[Math.floor(w.r() * (pref.length || vis.length))];
      if (tg) { const sp = u.side === 0 ? 30 : 45; fire(w, u, 'shell', tg.x + R(-sp, sp), tg.y + R(-sp, sp), tg.id); u.cd = R(6, 10); }
      else { fire(w, u, 'shell', (u.side ? 450 : w.vill[0]) + R(-200, 200), (u.side ? 1250 : w.vill[1]) + R(-120, 120), 0); u.cd = R(10, 16); }
    } else if (u.kind === 'mlrs') {
      if (!(T > w.T_PREP + 10 && T < w.T_SMOKE)) { u.cd = 3; continue; }
      const vis = enemies(w, u).filter(e => e.spotted), tg = vis[Math.floor(w.r() * vis.length)] ?? null, cx = tg ? tg.x : w.vill[0], cy = tg ? tg.y : w.vill[1];
      for (let i = 0; i < 12; i++) w.ev.push({ t: T + i * 0.35, f: () => { if (u.alive) fire(w, u, 'rocket', cx + R(-70, 70), cy + R(-55, 55), i < 3 && tg ? tg.id : 0); } });
      u.cd = 55;
    } else if (u.kind === 'ad') {
      const a = w.air.find(j => j.side !== u.side && j.alive && j.y > -100 && j.y < FH + 100 && Math.hypot(j.x - u.x, j.y - u.y) < 2600 && !w.pr.some(p => p.air === j.id));
      const hl = !a ? w.u.find(h => h.kind === 'heli' && h.side !== u.side && h.alive && h.alt > 20) : null;
      if (a) { fire(w, u, 'sam', a.x + a.vx * 2, a.y + a.vy * 2, 0, { air: a.id, tz: a.alt, sz: 6 }); u.cd = R(5, 9); }
      else if (hl && w.r() < 0.3) { fire(w, u, 'sam', hl.x, hl.y, hl.id, { tz: hl.alt, sz: 6 }); u.cd = R(8, 14); }
      else u.cd = 1;
    } else if (u.kind === 'tank' || u.kind === 'ifv') {
      const range = u.kind === 'tank' ? 1500 : 900, armed = u.side === 1 ? T > w.T_PREP : T > w.T_ARMOR - 5;
      if (!armed) { u.cd = 2; continue; }
      const list = enemies(w, u).filter(e => e.kind !== 'heli' && e.kind !== 'arty' && e.kind !== 'mlrs' || dist(e, u) < 700);
      const pref = list.filter(e => u.kind === 'tank' ? e.kind === 'tank' || e.kind === 'ifv' || e.kind === 'ad' : e.kind === 'inf');
      const tg = nearest(pref.length ? pref : list, u, range);
      if (!tg) { u.cd = 1.5; continue; }
      if (u.kind === 'tank') { fire(w, u, 'ap', tg.x, tg.y, tg.id); u.cd = R(u.moving ? 8 : 5, u.moving ? 13 : 9); }
      else { for (let i = 0; i < 5; i++) w.ev.push({ t: T + i * 0.22, f: () => { if (u.alive) fire(w, u, 'can', tg.x + R(-6, 6), tg.y + R(-6, 6), i === 4 ? tg.id : 0); } }); u.cd = R(4, 7); }
    }
  }
  // ---------- الطيران ----------
  for (const a of w.air) {
    if (!a.alive) { a.alt = Math.max(0, a.alt - dt * 60); a.x += a.vx * dt * 0.6; a.y += a.vy * dt * 0.6; if (a.alt === 0 && a.deadT > 0) { a.deadT = -2; a.vx = a.vy = 0; w.fx.push({ k: 'boom', x: a.x, y: a.y, cal: 2.4 }); } continue; }
    if (a.kind === 'drone') {
      a.x += a.vx * dt; a.y += Math.sin(T / 20 + a.id) * 6 * dt;
      if (a.x > FW + 150 || a.x < -150) { a.vx = -a.vx; a.y = a.side ? R(700, 1300) : R(150, 650); }
      // تكشف اللي تحتها (دائرة 260 م)
      for (const e of w.u) if (e.side !== a.side && !e.spotted && Math.hypot(e.x - a.x, e.y - a.y) < 260) { e.spotted = true; }
      continue;
    }
    a.x += a.vx * dt; a.y += a.vy * dt;
    const dToT = Math.hypot(a.tx - a.x, a.ty - a.y);
    if (!a.dropped && dToT < 520) {
      a.dropped = true;
      for (let i = 0; i < 2; i++) { const bx = a.tx + R(-25, 25), by = a.ty + R(-25, 25); w.pr.push({ id: w.nid++, kind: 'bomb', side: a.side, sx: a.x, sy: a.y, sz: a.alt, tx: bx, ty: by, tz: 0, t: 0, dur: 2.6 + i * 0.25, arc: 0, tgt: nearest(enemies(w, a).filter(e => e.kind !== 'heli'), { x: bx, y: by }, 60)?.id ?? 0, air: 0, x: a.x, y: a.y, z: a.alt }); }
    }
  }
  w.air = w.air.filter(a => a.kind === 'drone' || (a.y > -700 && a.y < FH + 700) || (!a.alive && a.deadT !== -2));
  // ---------- المقذوفات ----------
  w.pr = w.pr.filter(p => {
    p.t += dt; const k = Math.min(1, p.t / p.dur);
    if (p.kind === 'sam' && p.air) { const a = w.air.find(j => j.id === p.air); if (a && a.alive) { p.tx = a.x; p.ty = a.y; p.tz = a.alt; } }
    p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k; p.z = p.sz + (p.tz - p.sz) * (p.kind === 'bomb' ? k * k : k) + Math.sin(Math.PI * k) * p.arc;
    if (k < 1) return true;
    impact(w, p); return false;
  });
  // التحقق من الانتهاء
  if (T >= w.END) { w.over = true; w.fx.push({ k: 'msg', t: res.win ? (res.captured ? 'سيطرة كاملة على المنطقة' : 'نجحت العملية') : 'فشل الهجوم', side: res.win ? 0 : 1 }); }
}

function stepHeli(w: World, h: Unit, dt: number) {
  const T = w.T, start = w.T_ARMOR + 25 + h.grp * 7;
  if (T < start) return;
  if (!h.moving && h.alt === 0) { h.moving = true; h.y = FH + 120; }
  const hoverY = (w.res.win ? 900 : 1050) + (h.id % 3) * 40, out = w.withdraw || T > w.END - 30;
  h.alt = Math.min(h.alt + dt * 12, 45);
  const ty = out ? FH + 300 : hoverY; const dy = ty - h.y;
  if (Math.abs(dy) > 3) { h.y += Math.sign(dy) * Math.min(Math.abs(dy), 35 * dt); h.hd = dy < 0 ? -Math.PI / 2 : Math.PI / 2; h.spotted = true; }
  else { h.x += Math.sin(T * 0.3 + h.id) * 3 * dt; const tg = nearest(enemies(w, h, ['tank', 'ifv', 'ad']), h, 3000); if (tg) h.hd += Math.atan2(Math.sin(Math.atan2(tg.y - h.y, tg.x - h.x) - h.hd), Math.cos(Math.atan2(tg.y - h.y, tg.x - h.x) - h.hd)) * Math.min(1, dt); }
  if (Math.abs(dy) <= 3 && T - h.fireT > 9 + (h.id % 4)) { const tg = nearest(enemies(w, h, ['tank', 'ifv', 'ad']), h, 3200); if (tg) { fire(w, h, 'atgm', tg.x, tg.y, tg.id); } }
}

function stepInf(w: World, u: Unit, dt: number) {
  const T = w.T, R = (a: number, b: number) => a + w.r() * (b - a), alive = u.sol.filter(s => s.alive);
  if (!alive.length) { u.alive = false; return; }
  // المهاجم: يتقدم بقفزات للبيوت؛ المدافع: بالبيوت
  if (u.side === 0) {
    if (w.withdraw) { u.ty = 1350; }
    else if (T > w.T_ASSAULT - 30) {
      // كل حضيرة تاخذ أقرب بيت ما مسيطر عليه وما راحت له حضيرة ثانية
      let target = w.res.win && u.house >= 0 ? w.b[u.house] : null;
      if (w.res.win && (!target || target.owner === 0)) { const taken = new Set(w.u.filter(o => o !== u && o.side === 0 && o.alive && o.kind === 'inf').map(o => o.house)); const free = w.b.filter(b => b.owner === 1 && !taken.has(b.id)), any = w.b.filter(b => b.owner === 1); target = (free.length ? free : any).sort((a, b) => dist(a, u) - dist(b, u))[0] ?? null; u.house = target ? target.id : -1; }
      const goalY = w.res.win ? (target ? target.y + 14 : w.vill[1]) : 760;
      const cyc = Math.floor((T + u.id * 3) / 9) % 2 === 0;
      if (cyc || (target && dist(u, target) < 120)) { u.ty = target ? goalY : Math.max(goalY, u.y - 40); if (target) u.tx = target.x + 6; }
      if (target && dist(u, target) < (T > w.END - 60 ? 150 : 30)) { const def = w.u.filter(d => d.side === 1 && d.alive && d.house === target.id); if (!def.length) { target.owner = 0; u.house = -1; w.fx.push({ k: 'capture', id: target.id }); if (w.b.every(b => b.owner === 0)) w.fx.push({ k: 'msg', t: 'القرية كلها بيدنا', side: 0 }); } }
    }
  } else if (w.res.win && T > w.END - 75) { if (u.house >= 0) { u.house = -1; if (!w.u.some(o => o !== u && o.side === 1 && o.kind === 'inf' && o.alive && o.house === -2)) w.fx.push({ k: 'msg', t: 'العدو يترك البيوت وينسحب', side: 1 }); u.house = -2; } u.ty = -60; }
  const dx = u.tx - u.x, dy = u.ty - u.y, d = Math.hypot(dx, dy), under = T - u.hitT < 4;
  const v = under ? 1.2 : 2.6;
  if (d > 1.5) { const k = Math.min(1, v * dt / d); u.x += dx * k; u.y += dy * k; u.moving = true; u.hd = Math.atan2(dy, dx); } else u.moving = false;
  // الجنود: يلحقون مكانهم، ينبطحون تحت النار، ويرمون رشقات
  const enemy = nearest(enemies(w, u, ['inf', 'tank', 'ifv']), u, u.side === 0 ? 420 : 480);
  for (const s of u.sol) {
    if (!s.alive) continue;
    const gx = u.x + s.ox, gy = u.y + s.oy, ex = gx - s.x, ey = gy - s.y, ed = Math.hypot(ex, ey);
    if (ed > 0.4) { const sp = (u.moving ? v : 1.5) * (ed > 6 ? 1.6 : 1); const k = Math.min(1, sp * dt / ed); s.x += ex * k; s.y += ey * k; s.dir = Math.atan2(ey, ex); s.pose = u.moving ? 2 : s.pose; }
    else if (!u.moving) s.pose = under || u.side === 1 ? 1 : (enemy ? 1 : 0);
    if (enemy && !u.moving && T - s.fireT > R(1.6, 4.5) && (u.side === 1 ? T > w.T_ARMOR - 20 : true)) {
      s.fireT = T; s.dir = Math.atan2(enemy.y - s.y, enemy.x - s.x);
      const tsol = enemy.kind === 'inf' ? enemy.sol.filter(q => q.alive) : [];
      const q = tsol.length ? tsol[Math.floor(w.r() * tsol.length)] : null;
      const tx = q ? q.x : enemy.x, ty = q ? q.y : enemy.y;
      w.pr.push({ id: w.nid++, kind: 'mg', side: u.side, sx: s.x, sy: s.y, sz: 1.2, tx: tx + R(-3, 3), ty: ty + R(-3, 3), tz: 0.5, t: 0, dur: Math.hypot(tx - s.x, ty - s.y) / 800, arc: 0, tgt: q ? enemy.id : 0, air: 0, x: s.x, y: s.y, z: 1.2 });
      w.fx.push({ k: 'fire', id: u.id, kind: 'mg', x: s.x, y: s.y, a: s.dir });
    }
  }
  // آر بي جي على المدرعات القريبة
  const arm = nearest(enemies(w, u, ['tank', 'ifv']), u, 300);
  if (arm && !u.moving && T - u.fireT > R(18, 30)) fire(w, u, 'atgm', arm.x, arm.y, arm.id, { sz: 1.3 });
}

function killUnit(w: World, u: Unit) {
  u.alive = false; u.deadT = w.T; u.moving = false; count(w, u);
  w.fx.push({ k: 'kill', id: u.id, side: u.side, kind: u.kind });
  for (const s of w.u) if (s.mounted && s.carrier === u.id) { s.mounted = false; s.x = u.x; s.y = u.y; s.sol.forEach(q => { q.x = u.x + q.ox; q.y = u.y + q.oy; }); s.tx = s.x; s.ty = s.y + 30; }
  const name = { tank: 'دبابة', ifv: 'ناقلة', ad: 'منظومة دفاع جوي', arty: 'مدفع', mlrs: 'راجمة', heli: 'هليكوبتر', inf: 'حضيرة' }[u.kind];
  w.fx.push({ k: 'msg', t: u.side === 1 ? `تدمير ${name} للعدو` : `خسرنا ${name}`, side: u.side });
}
function impact(w: World, p: Proj) {
  const R = (a: number, b: number) => a + w.r() * (b - a);
  if (p.kind === 'mg') {
    const tu = p.tgt ? w.u.find(u => u.id === p.tgt) : null;
    if (tu && tu.alive && tu.kind === 'inf') {
      tu.hitT = w.T; const near = tu.sol.filter(s => s.alive && Math.hypot(s.x - p.tx, s.y - p.ty) < 6);
      if (near.length && w.killed.sol[tu.side] + 1 <= allowed(w, 'sol', tu.side) + 0.5 && w.r() < 0.35) { const s = near[0]; s.alive = false; s.deadT = w.T; w.killed.sol[tu.side]++; w.fx.push({ k: 'kill', id: tu.id, side: tu.side, kind: 'sol' }); }
    }
    w.fx.push({ k: 'mghit', x: p.tx, y: p.ty }); return;
  }
  if (p.kind === 'sam') {
    const a = p.air ? w.air.find(j => j.id === p.air) : null, h = !a && p.tgt ? w.u.find(u => u.id === p.tgt) : null;
    w.fx.push({ k: 'boom', x: p.tx, y: p.ty, cal: 0.8, air: true });
    // إسقاط الطائرات حسب قوة الدفاع الجوي للمدافع مقابل طيران المهاجم (من res)
    const def = p.side === 1 ? w.res.cd : w.res.ca, att = p.side === 1 ? w.res.ca : w.res.cd, pk = clamp(def.ad / (def.ad + att.air + 1) * 0.55, 0.05, 0.45);
    if (a && a.alive && w.r() < pk) { a.alive = false; a.deadT = w.T; w.fx.push({ k: 'kill', id: a.id, side: a.side, kind: a.kind }); w.fx.push({ k: 'msg', t: a.side === 0 ? 'دفاع العدو الجوي أسقط طائرة لنا' : 'دفاعنا الجوي أسقط طائرة للعدو', side: a.side }); }
    if (h && h.alive && mayKill(w, h, 0.35)) { killUnit(w, h); }
    return;
  }
  const cal = { shell: 2.2, rocket: 1.8, ap: 1.2, atgm: 1.4, bomb: 3.2, can: 0.5, mg: 0, sam: 0 }[p.kind];
  // نشوف منو قريب من نقطة الانفجار
  const rad = { shell: 28, rocket: 24, ap: 6, atgm: 7, bomb: 40, can: 5, mg: 0, sam: 0 }[p.kind];
  const tgt = p.tgt ? w.u.find(u => u.id === p.tgt) : null;
  let killed = false;
  const cands = w.u.filter(u => u.alive && !u.mounted && u.side !== p.side && u.kind !== 'heli' && dist(u, { x: p.tx, y: p.ty }) < rad + 6);
  for (const u of tgt && tgt.alive && cands.includes(tgt) ? [tgt, ...cands.filter(c => c !== tgt)] : cands) {
    if (u.kind === 'inf') {
      u.hitT = w.T;
      const near = u.sol.filter(s => s.alive && Math.hypot(s.x - p.tx, s.y - p.ty) < rad);
      for (const s of near) if (w.killed.sol[u.side] + 1 <= allowed(w, 'sol', u.side) + 0.5 && w.r() < (p.kind === 'can' ? 0.4 : 0.55)) { s.alive = false; s.deadT = w.T; w.killed.sol[u.side]++; w.fx.push({ k: 'kill', id: u.id, side: u.side, kind: 'sol' }); }
      continue;
    }
    const base = { shell: 0.3, rocket: 0.25, ap: 0.6, atgm: 0.72, bomb: 0.75, can: u.kind === 'ifv' ? 0.12 : 0.03, mg: 0, sam: 0 }[p.kind] * (u === tgt ? 1 : 0.4);
    if (!killed && mayKill(w, u, base)) { killUnit(w, u); killed = true; w.fx.push({ k: 'hit', x: u.x, y: u.y, kill: true, metal: true }); }
    else if (u === tgt && (p.kind === 'ap' || p.kind === 'atgm')) { u.hitT = w.T; w.fx.push({ k: 'hit', x: u.x + R(-2, 2), y: u.y + R(-2, 2), kill: false, metal: true }); }
  }
  // البيوت تنضرب
  if (cal >= 1.4) for (const b of w.b) if (!b.dead && Math.hypot(b.x - p.tx, b.y - p.ty) < rad * 0.6 + b.w * 0.5) { b.hp -= cal * R(0.15, 0.4); if (b.hp <= 0) { b.dead = true; w.fx.push({ k: 'house', id: b.id }); } }
  w.fx.push({ k: 'boom', x: p.tx, y: p.ty, cal });
}

const PHASE_MSG: Record<number, (w: World) => string> = {
  1: () => 'المدفعية تبدأ التمهيد على المواقع المكشوفة',
  2: () => 'الطيران يدخل المعركة',
  3: () => 'ستار دخان لتغطية تقدّم الدروع',
  4: w => w.tac === 'flank' ? 'الدروع تلتف من الجنب' : 'الدروع تتقدم بقفزات — مجموعة تتحرك ومجموعة تغطي',
  5: () => 'المشاة يقتحمون القرية بيت بيت',
};

/** شريطي القوة: نسبة الباقي */
export function bars(w: World) {
  const tot = (s: 0 | 1) => { const l = w.u.filter(u => u.side === s); return l.reduce((a, u) => a + (u.kind === 'inf' ? u.sol.length * 0.3 : 3), 0); };
  const left = (s: 0 | 1) => w.u.filter(u => u.side === s).reduce((a, u) => a + (u.kind === 'inf' ? u.sol.filter(q => q.alive).length * 0.3 : u.alive ? 3 : 0), 0);
  return { a: 100 * left(0) / Math.max(1, tot(0)), d: 100 * left(1) / Math.max(1, tot(1)) };
}
export const phaseName = (w: World) => w.PH.filter(p => p[0] <= w.T).pop()![1];
export const stamp = (res: Res) => res.fell ? 'سقطت العاصمة' : res.captured ? 'سيطرة كاملة' : res.win ? 'نجحت العملية' : 'فشل الهجوم';
export function skip(w: World) { while (!w.over) { step(w, 0.5); w.fx.length = 0; } }

export const SAMPLES: Record<string, Res> = {
  win: { ca: { troops: 42000, tank: 220, air: 40, arty: 140, ad: 20, drone: 30, heli: 24 }, cd: { troops: 26000, tank: 120, air: 12, arty: 60, ad: 14, drone: 8, heli: 4 }, la: .07, ld: .22, win: true, cap: false, fell: false, captured: false, rname: 'البصرة', wk: 3, terr: 'desert', tactic: 'direct' },
  lose: { ca: { troops: 18000, tank: 60, air: 6, arty: 30, ad: 6, drone: 4, heli: 2 }, cd: { troops: 40000, tank: 200, air: 30, arty: 120, ad: 24, drone: 20, heli: 10 }, la: .16, ld: .05, win: false, cap: false, fell: false, captured: false, rname: 'الموصل', wk: 4, terr: 'hills', tactic: 'direct' },
  capital: { ca: { troops: 60000, tank: 400, air: 80, arty: 260, ad: 30, drone: 60, heli: 40 }, cd: { troops: 30000, tank: 150, air: 20, arty: 80, ad: 20, drone: 10, heli: 6 }, la: .05, ld: .3, win: true, cap: true, fell: true, captured: true, rname: 'العاصمة', wk: 5, terr: 'plain', tactic: 'siege' },
};
