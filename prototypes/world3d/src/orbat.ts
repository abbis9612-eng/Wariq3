// التشكيلات والاشتباك التلقائي (WM14، I-073) — منطق بس بدون رسم. التصميم: docs/features/orbat.md
// الوحدة اللي تتحرك وتقاتل = اللواء (كتائب جوّاه)، الفرق مجموعات ألوية. الجبهة = قطاعات الحدود الحقيقية (src/front.json).
// المعركة كل ساعة لعب: القوة = نار (ضد الأفراد/الدروع حسب صلابة الخصم) + صمود (دفاع أو اختراق) × الأرض × التحصين × الجو × الإمداد × التنظيم.
// الأرقام [تقديري] تنضبط بـ tools/orbattest.ts.

export type Side = 0 | 1;   // 0 العراق، 1 إيران
export type Terr = 'mount' | 'hills' | 'plain' | 'marsh' | 'river';
export type BnT = 'tank' | 'mech' | 'inf' | 'arty' | 'mlrs' | 'sup';
export type Kind = 'armor' | 'mech' | 'inf';
export type Post = 'hold' | 'attack' | 'reserve' | 'move' | 'retreat';
export type Order = null | { t: 'attack' | 'hold' | 'reserve'; s?: number };

// جدول الأجيال نفسه باللعبة الأصلية (index.html: GM)
export const GM = [0, 1, 1.6, 2.5, 3.8, 5.5];
// المعدات: جيلها من جدول اللعبة الأصلية (WPN)؛ قيم القتال لكل قطعة قبل الجيل [تقديري]
//   sa نار ضد الأفراد، ha نار ضد الدروع، df صمود بالدفاع، bk صمود بالهجوم (اختراق)، hard مدرّعة (0–1)، west كتيبة غربية (44) لو شرقية (31)
export interface EqDef { n: string; c: 'tank' | 'ifv' | 'apc' | 'arty' | 'mlrs'; gen: number; sa: number; ha: number; df: number; bk: number; hard: number; west?: boolean; model?: string }
export const EQ: Record<string, EqDef> = {
  M1: { n: 'أبرامز', c: 'tank', gen: 4, sa: 1, ha: 2.4, df: 1.4, bk: 1.6, hard: 1, west: true, model: 'abrams' },
  T90: { n: 'T-90', c: 'tank', gen: 4, sa: 1, ha: 2.4, df: 1.4, bk: 1.6, hard: 1, model: 't72' },
  KARRAR: { n: 'كرار', c: 'tank', gen: 3, sa: 1, ha: 2.4, df: 1.4, bk: 1.6, hard: 1, model: 't72' },
  T72: { n: 'T-72', c: 'tank', gen: 2, sa: 1, ha: 2.4, df: 1.4, bk: 1.6, hard: 1, model: 't72' },
  M60: { n: 'M60', c: 'tank', gen: 2, sa: 1, ha: 2.4, df: 1.4, bk: 1.6, hard: 1, west: true, model: 'abrams' },
  T55: { n: 'T-55', c: 'tank', gen: 1, sa: 1, ha: 2.4, df: 1.4, bk: 1.6, hard: 1, model: 't72' },
  BMP1: { n: 'BMP-1', c: 'ifv', gen: 1, sa: .8, ha: .9, df: .8, bk: .9, hard: .8, model: 'bmp' },
  BMP2: { n: 'BMP-2', c: 'ifv', gen: 2, sa: .8, ha: .9, df: .8, bk: .9, hard: .8, model: 'bmp' },
  M113: { n: 'M113', c: 'apc', gen: 1, sa: .45, ha: .2, df: .5, bk: .5, hard: .6, west: true, model: 'bmp' },
  M109: { n: 'M109', c: 'arty', gen: 3, sa: 1.8, ha: .3, df: .3, bk: .2, hard: .5, west: true, model: 'arty' },
  M198: { n: 'M198', c: 'arty', gen: 2, sa: 1.6, ha: .25, df: .3, bk: .1, hard: 0, west: true, model: 'arty' },
  D30: { n: 'D-30', c: 'arty', gen: 1, sa: 1.6, ha: .25, df: .3, bk: .1, hard: 0, model: 'arty' },
  GRAD: { n: 'غراد', c: 'mlrs', gen: 1, sa: 2.6, ha: .2, df: .2, bk: .1, hard: 0, model: 'grad' },
  FAJR5: { n: 'فجر-5', c: 'mlrs', gen: 2, sa: 2.6, ha: .2, df: .2, bk: .1, hard: 0, model: 'grad' },
};
// المشاة: لكل 100 مقاتل راجل (RPG وكورنيت ضمن ha) [تقديري]
const INF = { sa: 1.2, ha: .6, df: 4, bk: .5 };   // مشاة محصّنة بمضادات دروع: Abrams ≈ 190 جندي مدافع، T-55 ≈ 50
// أفراد الكتيبة حسب النوع، وعدد قطعها [تقديري؛ الحقيقة 500–800 للمشاة، 31 شرقي/44 غربي للدبابات]
const MEN: Record<BnT, number> = { tank: 250, mech: 600, inf: 650, arty: 400, mlrs: 350, sup: 800 };
const DISMOUNT: Record<BnT, number> = { tank: 0, mech: .7, inf: .85, arty: 0, mlrs: 0, sup: .1 };   // نسبة اللي يقاتلون راجلين
const TERR_DEF: Record<Terr, number> = { mount: 2.3, hills: 1.35, plain: 1, marsh: 1.6, river: 1.4 };   // بونص المدافع
const TERR_ARM: Record<Terr, number> = { mount: .4, hills: .85, plain: 1, marsh: .35, river: .75 };   // فعالية الدروع
const TERR_ADV: Record<Terr, number> = { mount: .35, hills: .7, plain: 1, marsh: .3, river: .45 };    // سرعة التقدم
export const WIDTH: Record<Terr, number> = { mount: 2, hills: 3, plain: 4, marsh: 2, river: 2 };      // ألوية تقاتل بنفس الوقت بالقطاع (لكل طرف)
export const TERR_AR: Record<Terr, string> = { mount: 'جبال', hills: 'تلال', plain: 'سهل', marsh: 'أهوار', river: 'نهر' };
export const KIND_AR: Record<Kind, string> = { armor: 'المدرع', mech: 'الآلي', inf: 'المشاة' };
export const BN_AR: Record<BnT, string> = { tank: 'دبابات', mech: 'مشاة آلية', inf: 'مشاة', arty: 'مدفعية', mlrs: 'راجمات', sup: 'إسناد' };

export interface ArmyDef {
  side: Side; name: string; fem?: boolean; troops: number /* ألف */; inv: string; ifv: { armor: string; mech: string }; q: number /* تدريب */;
  deploy: { heavy: number; inf: number } /* نسبة اللي بجبهة العراق–إيران */; air: number /* قوة جو محسوبة */; aggr: number; divNum: number[];
}
// من بيانات اللعبة الأصلية (index.html): الجنود والمخزون؛ نوع ناقلات المشاة والنسب [تقديري]
export const ARMIES: ArmyDef[] = [
  { side: 0, name: 'العراق', troops: 193, inv: 'M1:100,T90:73,T72:120,T55:70,M109:40,M198:100,D30:150,GRAD:50', ifv: { armor: 'BMP1', mech: 'M113' }, q: 1, deploy: { heavy: 1, inf: 1 }, air: 0, aggr: .6, divNum: [9, 10, 5, 8, 1, 7, 11, 14, 15, 16, 17, 18, 19, 20, 3, 4, 2, 6, 12, 21] },
  { side: 1, name: 'إيران', fem: true, troops: 610, inv: 'T72:480,KARRAR:50,M60:150,T55:500,FAJR5:300,D30:1000,GRAD:500,M109:150', ifv: { armor: 'BMP2', mech: 'M113' }, q: 1, deploy: { heavy: .75, inf: .45 }, air: 0, aggr: .45, divNum: [92, 81, 16, 88, 21, 28, 64, 77, 30, 84, 58, 40, 23, 55, 65, 71, 25, 41, 27, 31, 8, 14, 17, 19, 33, 35, 36, 38] },
];
// قوة الجو (جيل × عدد، المروحيات نص، المسيّرات ثلث) من مخزون اللعبة الأصلية
const AIRGEN: Record<string, [number, number]> = { F16: [4, 1], FA50: [3, 1], SU25: [2, 1], MI28: [4, .5], MI35: [3, .5], GAZELLE: [1, .5], CH4: [3, .3], F14: [2, 1], F4: [1, 1], F5: [1, 1], MIG29: [3, 1], SU24: [2, 1], AH1: [2, .5], TOUFAN: [2, .5], MOHAJER: [2, .3] };
const AIRINV = ['F16:34,FA50:24,SU25:20,MI28:15,MI35:25,GAZELLE:6,CH4:10', 'F14:15,F4:40,F5:35,MIG29:18,SU24:20,AH1:20,TOUFAN:40,MOHAJER:150'];
ARMIES.forEach((a, i) => a.air = parseInv(AIRINV[i]).reduce((s, [id, n]) => s + n * GM[AIRGEN[id][0]] * AIRGEN[id][1], 0));

export function parseInv(s: string): [string, number][] { return s.split(',').map(p => p.split(':')).map(([k, v]) => [k, +v] as [string, number]); }
export function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;

export interface Item { id: string; n: number; n0: number }
export interface Bn { t: BnT; men: number; men0: number; eq: Item[] }
export interface Bde { id: number; side: Side; num: number; name: string; kind: Kind; div: number; bns: Bn[]; s: number; ts: number; mv: number; org: number; dug: number; exp: number; post: Post; ord: Order; x: number; y: number; hd: number; fight: boolean; restT: number; row: number }
export interface Div { id: number; side: Side; num: number; name: string; kind: Kind; bdes: number[] }
export interface Sector { i: number; a: number[]; b: number[]; c: number[]; n: number[]; terr: Terr; cities: City[]; lat: number; lon: number }
export interface City { side: string; n: string; x: number; y: number; v: number; owner?: Side }
export interface Battle { s: number; att: Side; t0: number; h: number; R: number; why: Record<string, number>; loss: [Loss, Loss]; att0: number[]; def0: number[]; done?: string }
export interface Loss { men: number; tank: number; ifv: number; arty: number }
export interface Ev { t: number; type: string; s?: number; side?: Side; id?: number; txt: string }
export interface FrontData { sectors: Sector[]; cities: City[] }

// ---------- إحصاءات اللواء ----------
export function bdeMen(b: Bde) { return b.bns.reduce((s, bn) => s + bn.men, 0); }
export function bdeMen0(b: Bde) { return b.bns.reduce((s, bn) => s + bn.men0, 0); }
export function bdeCount(b: Bde, c: EqDef['c'] | 'ifvapc') { let n = 0; for (const bn of b.bns) for (const it of bn.eq) { const e = EQ[it.id]; if (e.c === c || (c === 'ifvapc' && (e.c === 'ifv' || e.c === 'apc'))) n += it.n; } return n; }
export function bdeCount0(b: Bde, c: EqDef['c'] | 'ifvapc') { let n = 0; for (const bn of b.bns) for (const it of bn.eq) { const e = EQ[it.id]; if (e.c === c || (c === 'ifvapc' && (e.c === 'ifv' || e.c === 'apc'))) n += it.n0; } return n; }
/** القوة الباقية (0–1): وزن الأفراد والمعدات حسب قيمتها */
export function bdeStr(b: Bde) { let v = 0, v0 = 0; for (const bn of b.bns) { v += bn.men / 100; v0 += bn.men0 / 100; for (const it of bn.eq) { const w = GM[EQ[it.id].gen] * 2; v += it.n * w; v0 += it.n0 * w; } } return v0 ? v / v0 : 0; }
/** الصلابة: نسبة المدرعات مقابل حضائر المشاة (مثل HOI4) */
export function hardness(bs: Bde[]) { let h = 0, s = 0; for (const b of bs) for (const bn of b.bns) { s += bn.men * DISMOUNT[bn.t] / 10; for (const it of bn.eq) { const e = EQ[it.id]; if (e.c === 'arty' || e.c === 'mlrs') continue; h += it.n * e.hard; s += it.n * (1 - e.hard); } } return h + s ? h / (h + s) : 0; }
/** نار وصمود اللواء ضد خصم صلابته hE على أرض ter. role: 'att' يستعمل الاختراق، 'def' الدفاع */
export function power(b: Bde, hE: number, ter: Terr, role: 'att' | 'def', q = 1) {
  let fire = 0, tough = 0, fireHA = 0, gs = 0, gn = 0;
  for (const bn of b.bns) {
    const dis = bn.men * DISMOUNT[bn.t] / 100;
    fire += dis * (INF.sa * (1 - hE) + INF.ha * hE) * q; fireHA += dis * INF.ha * hE * q; tough += dis * (role === 'def' ? INF.df : INF.bk) * q;
    for (const it of bn.eq) {
      const e = EQ[it.id], g = GM[e.gen], am = 1 - e.hard + e.hard * TERR_ARM[ter], n = it.n * g * am;
      fire += n * (e.sa * (1 - hE) + e.ha * hE); fireHA += n * e.ha * hE; tough += n * (role === 'def' ? e.df : e.bk);
      if (e.c === 'tank' || e.c === 'ifv') { gs += it.n * e.gen; gn += it.n; }
    }
  }
  return { fire, tough, fireHA, gen: gn ? gs / gn : 0 };
}

// ---------- العالم ----------
export class Front {
  t = 0; bdes: Bde[] = []; divs: Div[] = []; secs: Sector[]; f: number[]; cities: City[]; ev: Ev[] = []; battles = new Map<number, Battle>(); done: Battle[] = []; r: () => number; nid = 1;
  stock: Record<string, number>[] = [{}, {}];   // معدات ما دخلت بألوية (احتياط تعويض)
  lost: Loss[] = [{ men: 0, tank: 0, ifv: 0, arty: 0 }, { men: 0, tank: 0, ifv: 0, arty: 0 }];
  airMod: number[] = [1, 1]; priority: number[][] = [[], []];   // أولوية هجوم من اللاعب لكل طرف وقطاع
  auto = [true, true]; ops: { side: Side; s: number; t0: number; goal: number; ids: number[]; go: boolean }[] = [];
  armies: ArmyDef[];
  constructor(fd: FrontData, seed = 1, armies: ArmyDef[] = ARMIES) {
    this.armies = armies;
    this.r = rng(seed); this.secs = fd.sectors; this.f = this.secs.map(() => 0); this.priority = [this.secs.map(() => 1), this.secs.map(() => 1)];
    this.cities = fd.cities.map(c => ({ ...c, owner: (c.side === 'IQ' ? 0 : 1) as Side }));
    // كل مدينة تنحسب لأقرب قطاع بس (حتى ما تسقط مدينة من قطاع بعيد عنها)
    const near = (c: City) => { let bi = 0, bd = 1e18; this.secs.forEach((s, i) => { const d = Math.hypot(c.x - s.c[0], c.y - s.c[1]); if (d < bd) { bd = d; bi = i; } }); return bi; };
    this.secs = this.secs.map(s => ({ ...s, cities: s.cities.filter(c => near(c) === s.i) }));
    for (const a of armies) this.build(a);
    const r = armies[0].air / armies[1].air, k = .18 * clamp(Math.log2(r), -1.5, 1.5) / 1.5;
    this.airMod = [1 + k, 1 - k];
    this.deploy();
  }
  // يبني التشكيلات من الجنود والمخزون: الدبابات كتائب (أحسن جيل أول)، نصها لألوية مدرعة (2 دبابات + 1 آلية)، الباقي ألوية آلية (1 + 2)، ثم مشاة بالأفراد الباقين
  build(a: ArmyDef) {
    const inv = Object.fromEntries(parseInv(a.inv)), stock = this.stock[a.side];
    const tankBns: Item[][] = [];
    const tanks = Object.keys(inv).filter(k => EQ[k].c === 'tank').sort((x, y) => EQ[y].gen - EQ[x].gen);
    for (const id of tanks) { let left = inv[id]; const sz = EQ[id].west ? 44 : 31; while (left >= sz * .6) { const n = Math.min(sz, left); tankBns.push([{ id, n, n0: n }]); left -= n; } stock[id] = left; }
    const T = tankBns.length, nArm = Math.floor(T * .5 / 2), nMech = T - nArm * 2;
    const maneuver = a.troops * 1000 * .6;
    const tmpl: { kind: Kind; bns: BnT[] }[] = [];
    for (let i = 0; i < nArm; i++) tmpl.push({ kind: 'armor', bns: ['tank', 'tank', 'mech', 'arty', 'sup'] });
    for (let i = 0; i < nMech; i++) tmpl.push({ kind: 'mech', bns: ['tank', 'mech', 'mech', 'arty', 'sup'] });
    const heavyMen = tmpl.reduce((s, t) => s + t.bns.reduce((q, b) => q + MEN[b], 0), 0);
    const nInf = Math.max(0, Math.floor((maneuver - heavyMen) / (MEN.inf * 3 + MEN.arty + MEN.sup)));
    for (let i = 0; i < nInf; i++) tmpl.push({ kind: 'inf', bns: ['inf', 'inf', 'inf', 'arty', 'sup'] });
    // المدفعية: ذاتية الحركة للمدرعة، المقطورة الأحسن للآلية، الباقي للمشاة؛ 18 قطعة للكتيبة، واللي ما لگت مدفعية تنشال كتيبتها
    const arty = Object.keys(inv).filter(k => EQ[k].c === 'arty').sort((x, y) => EQ[y].gen - EQ[x].gen), artyLeft: Record<string, number> = Object.fromEntries(arty.map(k => [k, inv[k]]));
    const mlrs = Object.keys(inv).filter(k => EQ[k].c === 'mlrs').sort((x, y) => EQ[y].gen - EQ[x].gen), mlrsLeft: Record<string, number> = Object.fromEntries(mlrs.map(k => [k, inv[k]]));
    const takeArty = (): Item[] | null => { for (const id of arty) if (artyLeft[id] >= 12) { const n = Math.min(18, artyLeft[id]); artyLeft[id] -= n; return [{ id, n, n0: n }]; } return null; };
    let tb = 0, bn = 0;
    const made: Bde[] = [];
    for (const t of tmpl) {
      const bns: Bn[] = [];
      for (const bt of t.bns) {
        let eq: Item[] = [];
        if (bt === 'tank') eq = tankBns[tb++];
        else if (bt === 'mech') { const id = t.kind === 'armor' ? a.ifv.armor : a.ifv.mech, n = EQ[id].west ? 44 : 30; eq = [{ id, n, n0: n }]; }
        else if (bt === 'arty') { const e = takeArty(); if (!e) continue; eq = e; }
        bns.push({ t: bt, men: MEN[bt], men0: MEN[bt], eq });
      }
      const b: Bde = { id: this.nid++, side: a.side, num: 0, name: '', kind: t.kind, div: 0, bns, s: 0, ts: 0, mv: -1, org: 100, dug: .3, exp: 0, post: 'hold', ord: null, x: 0, y: 0, hd: 0, fight: false, restT: 0, row: 0 };
      made.push(b); bn++;
    }
    for (const id of arty) stock[id] = artyLeft[id];
    // الراجمات: كتيبة 18 لكل فرقة (أول لواء بيها) لحد ما تخلص
    // نسبة اللي بالجبهة: الثقيلة أولاً (المدرعة أحسن)، والمشاة حسب النسبة
    const heavy = made.filter(b => b.kind !== 'inf'), inf = made.filter(b => b.kind === 'inf');
    const dep = [...heavy.slice(0, Math.round(heavy.length * a.deploy.heavy)), ...inf.slice(0, Math.round(inf.length * a.deploy.inf))];
    // الفرق: مدرعة = 2 مدرع + 1 آلي، آلية = 3 آلي، مشاة = 3 مشاة
    const arm = dep.filter(b => b.kind === 'armor'), mech = dep.filter(b => b.kind === 'mech'), infs = dep.filter(b => b.kind === 'inf');
    const groups: { kind: Kind; bs: Bde[] }[] = [];
    while (arm.length) groups.push({ kind: 'armor', bs: [...arm.splice(0, 2), ...mech.splice(0, 1)] });
    while (mech.length) groups.push({ kind: 'mech', bs: mech.splice(0, 3) });
    while (infs.length) groups.push({ kind: 'inf', bs: infs.splice(0, 3) });
    let bNum = 1, di = 0;
    for (const g of groups) {
      const num = a.divNum[di] ?? (100 + di), d: Div = { id: this.nid++, side: a.side, num, name: `الفرقة ${num} ${g.kind === 'armor' ? 'المدرعة' : g.kind === 'mech' ? 'الآلية' : 'مشاة'}`, kind: g.kind, bdes: [] }; di++;
      for (const b of g.bs) { b.div = d.id; b.num = num * 10 + (d.bdes.length + 1); b.name = `اللواء ${b.num} ${KIND_AR[b.kind]}`; d.bdes.push(b.id); bNum++; }
      const m = mlrs.find(id => mlrsLeft[id] >= 12);
      if (m) { const n = Math.min(18, mlrsLeft[m]); mlrsLeft[m] -= n; g.bs[0].bns.push({ t: 'mlrs', men: MEN.mlrs, men0: MEN.mlrs, eq: [{ id: m, n, n0: n }] }); }
      this.divs.push(d); this.bdes.push(...g.bs);
    }
    for (const id of mlrs) stock[id] = mlrsLeft[id];
    // اللي ما انتشر بالجبهة يرجع للاحتياط (معداته)
    for (const b of made) if (!dep.includes(b)) for (const bn of b.bns) for (const it of bn.eq) stock[it.id] = (stock[it.id] || 0) + it.n;
  }
  // الانتشار الأول: كل قطاع بي على الأقل لواء، الثقيلة بالسهول، المشاة بالجبال، والباقي احتياط ورا القطاعات المهمة
  deploy() {
    for (const side of [0, 1] as Side[]) {
      const my = this.bdes.filter(b => b.side === side), N = this.secs.length;
      const infs = my.filter(b => b.kind === 'inf'), heavy = my.filter(b => b.kind !== 'inf');
      const order = this.secs.map(s => s.i);
      // مشاة: لواء لكل قطاع (الجبال ثنين إذا يكفي)
      let k = 0;
      for (const b of my) b.s = b.ts = -1;
      for (const i of order) { const b = infs[k]; if (!b) break; k++; b.s = b.ts = i; }
      for (const i of order) if (this.secs[i].terr === 'mount' || this.secs[i].terr === 'hills') { const b = infs[k]; if (!b) break; k++; b.s = b.ts = i; }
      // ثقيلة: السهول والأهوار والنهر (الجنوب والوسط) بالتناوب
      const flat0 = order.filter(i => this.secs[i].terr !== 'mount'), flat = flat0.length ? flat0 : order;
      const empty = order.filter(i => !my.some(b => b.s === i && infs.indexOf(b) >= 0 && infs.indexOf(b) < k));
      heavy.forEach((b, j) => { b.s = b.ts = j < empty.length ? empty[j] : flat[(j * 3) % flat.length]; });
      // الباقي احتياط موزّع
      for (; k < infs.length; k++) { infs[k].s = infs[k].ts = order[(k * 7) % N]; infs[k].post = 'reserve'; }
      for (const b of my) { b.dug = b.kind === 'inf' ? .6 : .3; }
    }
    this.place();
  }
  sideName(s: Side) { return this.armies[s].name; }
  /** الفعل حسب الدولة: إيران مؤنث بالعربي («إيران اخترقت») */
  vb(s: Side, m: string, f: string) { return this.armies[s].fem ? f : m; }
  emit(type: string, txt: string, o: Partial<Ev> = {}) { this.ev.push({ t: this.t, type, txt, ...o }); }
  bde(id: number) { return this.bdes.find(b => b.id === id); }
  /** أمر من اللاعب (اختياري، D-035): null = تلقائي */
  order(id: number, o: Order) { const b = this.bde(id); if (!b) return; b.ord = o; if (!o) { if (b.post === 'attack') b.post = 'hold'; return; } this.planOrders(b.side); }
  /** تسمية من اللاعب (I-074): الأسماء الحالية مقترحة */
  rename(id: number, name: string) { const b = this.bde(id) || this.divs.find(d => d.id === id); if (b && name.trim()) b.name = name.trim().slice(0, 40); }
  alive(b: Bde) { return bdeStr(b) > .08; }
  /** نقطة الجبهة بالقطاع (موجب = داخل إيران) */
  fp(i: number) { const s = this.secs[i], f = this.f[i]; return { x: s.c[0] + s.n[0] * f, y: s.c[1] + s.n[1] * f }; }
  inSec(i: number, side: Side) { return this.bdes.filter(b => b.side === side && b.s === i && b.mv < 0 && this.alive(b)); }
  /** عمق الطرف داخل أرض الخصم (كم) */
  depth(i: number, side: Side) { return (side === 0 ? this.f[i] : -this.f[i]) / 1000; }
  supply(i: number, side: Side) { return clamp(1 - Math.max(0, this.depth(i, side)) / 300, .55, 1) * (1 - .12 * Math.max(0, this.airMod[1 - side] - 1) / .18); }

  // ---------- كل ساعة ----------
  step() {
    this.t += 1;
    for (const b of this.bdes) b.fight = false;
    if (this.t % 6 === 1) for (const side of [0, 1] as Side[]) if (this.auto[side]) this.plan(side); else this.planOrders(side);
    this.move();
    for (let i = 0; i < this.secs.length; i++) this.fight(i);
    for (const b of this.bdes) {
      if (!this.alive(b)) continue;
      if (!b.fight) { b.org = Math.min(100, b.org + (b.post === 'reserve' ? 2.2 : 1.3) * this.supply(b.s, b.side)); if (b.mv < 0 && b.post !== 'attack') b.dug = Math.min(1, b.dug + 1 / 60); }
      if (b.restT > 0) b.restT--;
      this.refit(b);
    }
    this.place();
  }
  // تعويض بطيء من الاحتياط لما اللواء مو بمعركة (أفراد 0.3% بالساعة، معدات من المخزون)
  refit(b: Bde) {
    if (b.fight) return;
    for (const bn of b.bns) {
      bn.men = Math.min(bn.men0, bn.men + bn.men0 * .003);
      for (const it of bn.eq) { const need = it.n0 - it.n, st = this.stock[b.side][it.id] || 0; if (need >= 1 && st >= 1 && this.r() < .05) { it.n += 1; this.stock[b.side][it.id] = st - 1; } }
    }
  }
  // الحركة بين القطاعات: على طريق خلفي، ثقيلة 8 كم/س، مشاة 6 [تقديري]
  move() {
    for (const b of this.bdes) {
      if (!this.alive(b) || b.s === b.ts) { b.mv = -1; continue; }
      if (b.fight) continue;
      const a = this.secs[b.s].c, c = this.secs[b.ts].c, d = Math.hypot(c[0] - a[0], c[1] - a[1]) / 1000;
      if (b.mv < 0) { b.mv = 0; b.dug = 0; }
      b.mv += (b.kind === 'inf' ? 6 : 8) / Math.max(1, d);
      if (b.mv >= 1) { b.s = b.ts; b.mv = -1; }
    }
  }
  // ---------- المعركة بقطاع ----------
  fight(i: number) {
    const ter = this.secs[i].terr;
    const A0 = this.inSec(i, 0), A1 = this.inSec(i, 1);
    const atk0 = A0.filter(b => b.post === 'attack'), atk1 = A1.filter(b => b.post === 'attack');
    const a_ = atk0.length && (!atk1.length || this.battles.get(i)?.att === 0) ? 0 : atk1.length ? 1 : -1;
    const bt = this.battles.get(i);
    if (a_ < 0) { if (bt) this.endBattle(i, 'stop'); return; }
    const att = a_ as Side, def = (1 - att) as Side, W = WIDTH[ter];
    const atk = (att === 0 ? atk0 : atk1).sort((x, y) => y.org - x.org).slice(0, W);
    const dfs = (def === 0 ? A0 : A1).filter(b => b.post !== 'retreat' && b.restT <= 0).sort((x, y) => (y.post === 'reserve' ? -1 : 0) - (x.post === 'reserve' ? -1 : 0) || y.org - x.org).slice(0, W);
    if (!dfs.length) { this.advance(i, att, atk); if (bt) this.endBattle(i, 'break'); return; }
    let b: Battle;
    if (bt && bt.att === att) b = bt;
    else {
      if (bt) this.endBattle(i, 'stop');
      b = { s: i, att, t0: this.t, h: 0, R: 1, why: {}, loss: [{ men: 0, tank: 0, ifv: 0, arty: 0 }, { men: 0, tank: 0, ifv: 0, arty: 0 }], att0: atk.map(q => q.id), def0: dfs.map(q => q.id) };
      this.battles.set(i, b);
      this.emit('battle', `${this.sideName(att)} ${this.vb(att, 'يهاجم', 'تهاجم')} ${this.place_(i)}`, { s: i, side: att });
    }
    b.h++;
    for (const q of [...atk, ...dfs]) q.fight = true;
    const { fac, SA, SD, hA } = this.calc(i, att, atk, dfs, b.h, true);
    const R = Object.values(fac).reduce((p, x) => p * x, 1);
    b.R = R;
    for (const k in fac) b.why[k] = (b.why[k] || 0) * .8 + Math.log(fac[k]) * .2;
    // خسائر الساعة: الأس 0.6 بدل التربيعي (معارك حقيقية؛ Dupuy/Fain) [تقديري]
    const k = Math.pow(R, .6);
    const orgD = 3.2 * k, orgA = 3.2 / k, strD = .0045 * k, strA = .0045 / k;
    const haA = SA.fire ? SA.fireHA / SA.fire : 0, haD = SD.fire ? SD.fireHA / SD.fire : 0;
    for (const q of dfs) this.hurt(q, orgD * (1 - .3 * q.dug), strD, haA, b.loss[def]);
    for (const q of atk) this.hurt(q, orgA, strA, haD, b.loss[att]);
    // النتيجة: المدافع ينكسر تحت 20 تنظيم، المهاجم يوقف تحت 30
    let broke = 0;
    for (const q of dfs) if (q.org < 20 || !this.alive(q)) { this.retreat(q, i, hA); broke++; }
    for (const q of atk) if (q.org < 30 || !this.alive(q)) { q.post = 'hold'; q.restT = 12; this.emit('halt', `${q.name} وقف هجومه (${this.place_(i)})`, { s: i, side: att, id: q.id }); }
    for (const q of [...atk, ...dfs]) q.exp = Math.min(1, q.exp + .002);
    // تقدم بطيء وقت المعركة إذا الكفة مايلة كلش
    if (R > 3) this.shift(i, att, .35 * (R - 3) * TERR_ADV[ter]);
    if (broke === dfs.length && !this.inSec(i, def).some(q => q.post !== 'retreat' && q.restT <= 0)) this.endBattle(i, 'break');
  }
  /** عوامل المعركة (نفسها للقتال ولتقدير الذكاء). rand=false للتقدير بدون حظ */
  calc(i: number, att: Side, atk: Bde[], dfs: Bde[], h: number, rand: boolean) {
    const sec = this.secs[i], ter = sec.terr, def = (1 - att) as Side;
    const hA = hardness(atk), hD = hardness(dfs);
    // مدينة قريبة من خط الجبهة بأرض المدافع = قتال مدن
    const city = sec.cities.some(c => this.cityOwner(c) === def && Math.hypot(c.x - this.fp(i).x, c.y - this.fp(i).y) < 12000);
    const terMul = city ? Math.max(2, TERR_DEF[ter]) : TERR_DEF[ter];
    const sideCP = (bs: Bde[], hE: number, role: 'att' | 'def', side: Side) => {
      let raw = 0, fire = 0, fireHA = 0, gen = 0, gn = 0, org = 0, dug = 0, exp = 0;
      for (const q of bs) { const p = power(q, hE, ter, role, this.armies[side].q); raw += p.fire + p.tough; fire += p.fire; fireHA += p.fireHA; if (p.gen) { gen += p.gen; gn++; } org += q.org; dug += q.dug; exp += q.exp; }
      const n = bs.length || 1;
      // بونص قيادة: ثنين أو أكثر من نفس الفرقة سوا
      const divs = new Map<number, number>(); bs.forEach(q => divs.set(q.div, (divs.get(q.div) || 0) + 1)); const cmd = [...divs.values()].some(v => v >= 2) ? 1.1 : 1;
      return { raw, fire, fireHA, org: org / n, dug: dug / n, exp: exp / n, gen: gn ? gen / gn : 0, cmd };
    };
    const SA = sideCP(atk, hD, 'att', att), SD = sideCP(dfs, hA, 'def', def);
    const ra = rand ? .88 + this.r() * .24 : 1, rd = rand ? .88 + this.r() * .24 : 1;
    const fac: Record<string, number> = {
      'العدد والمعدات': SD.raw ? SA.raw / SD.raw : 99,
      'الأرض': 1 / terMul * (ter === 'river' && h < 18 ? .7 : 1),
      'التحصين': 1 / (1 + .8 * SD.dug),
      'الجو': this.airMod[att] / this.airMod[def],
      'الإمداد': this.supply(i, att) / this.supply(i, def),
      'التنظيم': (.5 + .5 * SA.org / 100) / (.5 + .5 * SD.org / 100),
      'الخبرة والقيادة': (1 + .2 * SA.exp) * SA.cmd / ((1 + .2 * SD.exp) * SD.cmd),
      'الأجناب': this.flank(i, att),
      'الحظ': ra / rd,
    };
    return { fac, SA, SD, hA, hD, R: Object.values(fac).reduce((p, x) => p * x, 1) };
  }
  hurt(q: Bde, org: number, str: number, haE: number, L: Loss) {
    q.org = Math.max(0, q.org - org);
    for (const bn of q.bns) {
      const back = bn.t === 'arty' || bn.t === 'mlrs' ? .35 : 1;
      const dm = bn.men * str * (.6 + .8 * (1 - haE)) * back * DISMOUNT_OR(bn.t);
      bn.men -= dm; L.men += dm; this.lost[q.side].men += dm;
      for (const it of bn.eq) {
        const e = EQ[it.id], d = it.n * str * (e.hard > .5 ? .6 + .8 * haE : .6 + .8 * (1 - haE)) * back;
        it.n = Math.max(0, it.n - d);
        const c = e.c === 'tank' ? 'tank' : e.c === 'arty' || e.c === 'mlrs' ? 'arty' : 'ifv';
        L[c] += d; this.lost[q.side][c] += d;
      }
    }
  }
  retreat(q: Bde, i: number, hE: number) {
    if (q.post === 'retreat') return;
    q.post = 'retreat'; q.restT = 24; q.dug = 0;
    // خسارة إضافية بالانسحاب: أكثر إذا العدو مدرّع (ملاحقة)
    this.hurt(q, 0, .03 + .05 * hE, .5, this.battles.get(i)?.loss[q.side] || { men: 0, tank: 0, ifv: 0, arty: 0 });
    this.emit('retreat', `${q.name} انسحب من ${this.place_(i)}`, { s: i, side: q.side, id: q.id });
  }
  /** الجبهة تتحرك لصالح side بمقدار km */
  shift(i: number, side: Side, km: number) {
    const lim = 140000;
    this.f[i] = clamp(this.f[i] + (side === 0 ? 1 : -1) * km * 1000, -lim, lim);
    for (const c of this.secs[i].cities) {
      const own = this.cityOwner(c);
      if (own !== side && this.passed(c, i, side)) { const cc = this.cities.find(x => x.n === c.n)!; cc.owner = side; this.emit('city', `${this.sideName(side)} ${this.vb(side, 'سيطر', 'سيطرت')} على ${c.n}`, { s: i, side }); }
    }
  }
  cityOwner(c: City): Side { return (this.cities.find(x => x.n === c.n)?.owner ?? (c.side === 'IQ' ? 0 : 1)) as Side; }
  /** المدينة صارت ورا خط الجبهة من جهة side؟ (إسقاط على طبيعي القطاع) */
  passed(c: City, i: number, side: Side) { const s = this.secs[i], d = (c.x - s.c[0]) * s.n[0] + (c.y - s.c[1]) * s.n[1]; return side === 0 ? this.f[i] > d + 3000 : this.f[i] < d - 3000; }
  advance(i: number, side: Side, atk: Bde[]) {
    if (!atk.length) return;
    const ter = this.secs[i].terr, armor = hardness(atk);
    // كم/س؛ إذا بعد أكو وحدات للعدو بالقطاع (منسحبة/ترتاح) تأخّر التقدم (قتال تأخيري)
    const delay = this.bdes.some(b => b.side !== side && b.s === i && this.alive(b)) ? .25 : 1;
    const v = (.6 + 1.4 * armor) * TERR_ADV[ter] * this.supply(i, side) * delay;
    this.shift(i, side, v);
    for (const q of atk) { q.org = Math.max(0, q.org - .4); q.fight = true; }
    if (this.t % 12 === 0) this.emit('advance', `${this.sideName(side)} ${this.vb(side, 'يتقدم', 'تتقدم')} ب${this.place_(i)}`, { s: i, side });
  }
  /** الأجناب: إذا القطاعات الجنب متقدمة لصالح المهاجم أكثر من 20 كم، المدافع مكشوف */
  flank(i: number, att: Side) {
    let m = 1; const sg = att === 0 ? 1 : -1;
    for (const j of [i - 1, i + 1]) if (j >= 0 && j < this.f.length && sg * (this.f[j] - this.f[i]) > 20000) m *= 1.15;
    return m;
  }
  endBattle(i: number, why: string) {
    const b = this.battles.get(i); if (!b) return;
    b.done = why; this.battles.delete(i); this.done.push(b);
    if (why === 'break') this.emit('break', `${this.sideName(b.att)} ${this.vb(b.att, 'اخترق', 'اخترقت')} ${this.place_(i)}`, { s: i, side: b.att });
    else this.emit('end', `توقفت المعركة ب${this.place_(i)}`, { s: i, side: b.att });
  }
  place_(i: number) { const s = this.secs[i], c = s.cities.slice().sort((a, b) => b.v - a.v)[0]; return c ? `قطاع ${c.n}` : `القطاع ${i + 1}`; }

  // ---------- ذكاء الطرف (كل 6 ساعات) ----------
  plan(side: Side) {
    const A = this.armies[side], my = this.bdes.filter(b => b.side === side && this.alive(b)), N = this.secs.length;
    // 1) المتعبين للاحتياط، المنسحبين يرجعون يمسكون إذا ارتاحوا
    for (const b of my) {
      if (b.ord) continue;
      if (b.post === 'retreat' && b.restT <= 0) b.post = b.org > 40 ? 'hold' : 'reserve';
      if (b.post === 'attack' && (b.org < 45 || bdeStr(b) < .45)) { b.post = 'reserve'; }
      if (b.post === 'reserve' && b.org > 85 && bdeStr(b) > .6) b.post = 'hold';
    }
    // 2) خطر: قطاع العدو بي أقوى بكثير ← ابعث احتياط
    const est = (i: number, s: Side) => this.inSec(i, s).reduce((q, b) => q + bdeStr(b) * (b.kind === 'inf' ? 1 : 1.8) * b.org / 100, 0);
    const busy = new Set(this.ops.filter(o => !o.go).flatMap(o => o.ids));
    const free = () => my.filter(b => !busy.has(b.id) && !b.ord && b.mv < 0 && !b.fight && b.post !== 'retreat' && b.org > 70 && bdeStr(b) > .55 && this.inSec(b.s, side).filter(q => q.post !== 'reserve').length > 1);
    for (let i = 0; i < N; i++) {
      const mine = est(i, side), them = est(i, (1 - side) as Side) * (.8 + this.r() * .4);
      if (them > mine * 1.6 || mine < .3) {
        const f = free().sort((x, y) => Math.abs(x.s - i) - Math.abs(y.s - i))[0];
        if (f && Math.abs(f.s - i) <= 6) { f.ts = i; f.post = 'hold'; }
      }
    }
    // 3) هجوم: أحسن قطاع حسب (قيمة المدن + 1) × النسبة المتوقعة ÷ صعوبة الأرض؛ عملية وحدة جديدة بالمرة
    const myOps = this.ops.filter(o => o.side === side);
    for (const o of myOps) {
      // تجمّع أول: الألوية توصل كلها (أو يمر يومين) وبعدين تهاجم سوا
      if (!o.go) {
        const bs = o.ids.map(id => this.bde(id)!).filter(b => b && this.alive(b) && !b.ord);
        if (bs.every(b => b.s === o.s && b.mv < 0) || this.t - o.t0 > 48) { o.go = true; for (const b of bs) if (b.s === o.s && b.mv < 0 && b.org > 50) b.post = 'attack'; o.t0 = this.t; if (bs.some(b => b.post === 'attack')) this.emit('op', `${A.name} ${this.vb(side, 'يبدي', 'تبدي')} هجوم على ${this.place_(o.s)}`, { s: o.s, side }); }
        continue;
      }
      const atk = this.inSec(o.s, side).filter(b => b.post === 'attack');
      if (!atk.length || this.depth(o.s, side) >= o.goal || this.t - o.t0 > 24 * 10) { this.ops.splice(this.ops.indexOf(o), 1); for (const b of atk) if (!b.ord) b.post = 'hold'; }
    }
    if (this.ops.filter(o => o.side === side).length < 2 && this.r() < A.aggr * .5) {
      // يقدّر النسبة بنفس معادلة المعركة، مع ضباب (±25%) على قوة العدو
      let best = -1, bs = 0, bpool: Bde[] = [];
      const need = 1.9 - A.aggr * .6;   // العراق 1.54، إيران 1.63 (أولوية اللاعب تقبل نسبة أقل)
      for (let i = 0; i < N; i++) {
        if (this.ops.some(o => o.s === i)) continue;
        const ter = this.secs[i].terr, w = WIDTH[ter];
        const dfs = this.inSec(i, (1 - side) as Side).filter(b => b.post !== 'retreat').sort((x, y) => y.org - x.org).slice(0, w);
        const pool = [...this.inSec(i, side).filter(b => !b.ord && b.post === 'hold' && b.org > 70 && bdeStr(b) > .55), ...free().filter(b => b.s !== i && Math.abs(b.s - i) <= 4)]
          .sort((x, y) => (x.kind === 'inf' ? 1 : 0) - (y.kind === 'inf' ? 1 : 0) || Math.abs(x.s - i) - Math.abs(y.s - i)).slice(0, w);
        if (!pool.length) continue;
        // لازم يبقى بالقطاع ماسك واحد على الأقل إذا كلهم راح يهاجمون
        const fog = .75 + this.r() * .5, R = dfs.length ? this.calc(i, side, pool, dfs, 0, false).R / fog : 5;
        if (R < need / Math.sqrt(this.priority[side][i])) continue;
        const val = 1 + this.secs[i].cities.filter(c => this.cityOwner(c) !== side).reduce((q, c) => q + c.v, 0);
        const sc = val * Math.min(R, 4) * TERR_ADV[ter] * this.priority[side][i];
        if (sc > bs) { bs = sc; best = i; bpool = pool; }
      }
      if (best >= 0) {
        for (const b of bpool) { b.ts = best; b.post = 'hold'; }
        this.ops.push({ side, s: best, t0: this.t, goal: 15 + this.r() * 35, ids: bpool.map(b => b.id), go: false });
        this.emit('gather', `${A.name} ${this.vb(side, 'يحشد', 'تحشد')} قوات قرب ${this.place_(best)}`, { s: best, side });
      }
    }
    this.planOrders(side);
  }
  /** أوامر اللاعب تتطبق فوق الذكاء */
  planOrders(side: Side) {
    for (const b of this.bdes) {
      if (b.side !== side || !b.ord || !this.alive(b)) continue;
      if (b.ord.s !== undefined) b.ts = b.ord.s;
      if (b.post === 'retreat' && b.restT > 0) continue;
      b.post = b.ord.t === 'attack' ? (b.org > 30 ? 'attack' : 'hold') : b.ord.t;
    }
  }
  // ---------- المواقع للرسم ----------
  place() {
    const rows = new Map<string, Bde[]>();
    // اللي يتقاتلون: صف خاص بالقطاع (row 2) — المهاجم رقم j مقابل المدافع رقم j على نفس الموقع على طول الجبهة، وقريبين من الخط
    for (const b of this.bdes) { if (!this.alive(b)) continue; const k = b.s + ':' + b.side + ':' + (b.fight && b.mv < 0 ? 2 : b.post === 'reserve' || b.post === 'retreat' ? 1 : 0); if (!rows.has(k)) rows.set(k, []); rows.get(k)!.push(b); }
    const nFight = (si: number) => Math.max(rows.get(si + ':0:2')?.length ?? 0, rows.get(si + ':1:2')?.length ?? 0);
    for (const [k, bs] of rows) {
      const [si, sd, rs] = k.split(':').map(Number), s = this.secs[si], p = this.fp(si), back = sd === 0 ? -1 : 1;
      const tx = s.b[0] - s.a[0], ty = s.b[1] - s.a[1], tl = Math.hypot(tx, ty), t = [tx / tl, ty / tl];
      bs.sort((x, y) => x.id - y.id).forEach((b, j) => {
        const n = rs === 2 ? nFight(si) : bs.length, along = ((j + .5) / n - .5) * tl * (rs === 2 ? .45 : .8), dep = rs === 2 ? 2500 : (rs ? 28000 : 5000) + (j % 2) * 3500;
        let x = p.x + t[0] * along + s.n[0] * back * dep, y = p.y + t[1] * along + s.n[1] * back * dep;
        if (b.mv >= 0) { const c = this.secs[b.ts], q = { x: c.c[0] + c.n[0] * (this.f[b.ts] + back * 25000), y: c.c[1] + c.n[1] * (this.f[b.ts] + back * 25000) }; const o = { x: s.c[0] + s.n[0] * (this.f[si] + back * 25000), y: s.c[1] + s.n[1] * (this.f[si] + back * 25000) }; x = o.x + (q.x - o.x) * b.mv; y = o.y + (q.y - o.y) * b.mv; b.hd = Math.atan2(q.y - o.y, q.x - o.x); }
        else b.hd = Math.atan2(-s.n[1] * back, -s.n[0] * back);
        b.x = x; b.y = y;
      });
    }
  }
  /** مجموع معدات الطرف (بالألوية + الاحتياط) — للفحص */
  totals(side: Side) { const o: Record<string, number> = { ...this.stock[side] }; for (const b of this.bdes) if (b.side === side) for (const bn of b.bns) for (const it of bn.eq) o[it.id] = (o[it.id] || 0) + it.n; return o; }
}
function DISMOUNT_OR(t: BnT) { return t === 'tank' ? .5 : 1; }
