// فحص التشكيلات والاشتباك (WM14.1، D-011): node tools/orbattest.ts
import { readFileSync } from 'node:fs';
import { Front, ARMIES, parseInv, power, bdeStr, bdeCount, bdeCount0, bdeMen, type Bde, type Terr, type FrontData } from '../src/orbat.ts';
const FD: FrontData = JSON.parse(readFileSync(new URL('../src/front.json', import.meta.url), 'utf8'));
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const r1 = (x: number) => Math.round(x * 10) / 10;

console.log('== 1) التشكيلات من المخزون ==');
const W0 = new Front(FD, 1);
for (const a of ARMIES) {
  const bs = W0.bdes.filter(b => b.side === a.side), ds = W0.divs.filter(d => d.side === a.side);
  const k = (x: string) => bs.filter(b => b.kind === x).length;
  console.log(`${a.name}: ${ds.length} فرقة، ${bs.length} لواء (مدرع ${k('armor')}، آلي ${k('mech')}، مشاة ${k('inf')})، أفراد ${Math.round(bs.reduce((s, b) => s + bdeMen(b), 0) / 1000)} ألف، دبابات ${bs.reduce((s, b) => s + bdeCount(b, 'tank'), 0)}، مدفعية ${bs.reduce((s, b) => s + bdeCount(b, 'arty'), 0)}، راجمات ${bs.reduce((s, b) => s + bdeCount(b, 'mlrs'), 0)}، جو ${Math.round(a.air)}`);
  const tot = W0.totals(a.side), inv = Object.fromEntries(parseInv(a.inv));
  ok(Object.keys(inv).every(id => Math.abs((tot[id] || 0) - inv[id]) < 1e-6), `${a.name}: مجموع الألوية + الاحتياط = المخزون بالضبط`);
  const cp = bs.reduce((s, b) => { const p = power(b, .4, 'plain', 'def'); return s + p.fire + p.tough; }, 0); console.log(`   القوة الكلية (سهل، دفاع): ${Math.round(cp)}`);
  const ex = bs[0]; console.log('   مثال:', ex.name, '←', ex.bns.map(bn => `${bn.t}(${bn.men}${bn.eq.map(e => ' ' + e.id + '×' + e.n).join('')})`).join(' + '));
}
ok(W0.secs.every(s => W0.inSec(s.i, 0).length > 0 && W0.inSec(s.i, 1).length > 0), 'كل قطاع بي ألوية للطرفين');

console.log('\n== 2) معارك ثنائية (200 مرة لكل وحدة) ==');
const pick = (side: 0 | 1, kind: string, tank?: string) => W0.bdes.find(b => b.side === side && b.kind === kind && (!tank || b.bns.some(bn => bn.eq.some(e => e.id === tank))))!;
const clone = (b: Bde): Bde => JSON.parse(JSON.stringify(b));
function duel(A: Bde[], D: Bde[], terr: Terr, dug: number, seeds = 200) {
  let win = 0, hrs = 0, lA = 0, lD = 0, R0 = 0;
  for (let s = 1; s <= seeds; s++) {
    const fd: FrontData = { sectors: [{ ...FD.sectors[19], i: 0, terr, cities: [] }], cities: [] };
    const W = new Front(fd, s * 7 + 3); W.auto = [false, false]; W.airMod = [1, 1];
    const a = A.map(clone), d = D.map(clone);
    let id = 1; for (const q of [...a, ...d]) { q.id = id++; q.s = q.ts = 0; q.mv = -1; q.org = 100; q.restT = 0; q.ord = null; }
    a.forEach(q => { q.side = 0; q.post = 'attack'; q.ord = { t: 'attack' }; }); d.forEach(q => { q.side = 1; q.post = 'hold'; q.dug = dug; });
    W.bdes = [...a, ...d];
    const s0 = a.map(bdeStr), d0 = d.map(bdeStr);
    let h = 0; for (; h < 120; h++) { W.step(); if (h === 0) R0 += W.battles.get(0)?.R ?? 0; if (W.done.length) break; }
    if (W.done.some(b => b.done === 'break')) win++;
    hrs += h; lA += a.reduce((s, q, j) => s + s0[j] - bdeStr(q), 0) / a.length; lD += d.reduce((s, q, j) => s + d0[j] - bdeStr(q), 0) / d.length;
  }
  return { win: win / seeds, h: hrs / seeds, lA: lA / seeds, lD: lD / seeds, R: R0 / seeds };
}
const IQarm = pick(0, 'armor', 'M1'), IQinf = pick(0, 'inf'), IRinf = pick(1, 'inf'), IRarm = pick(1, 'armor'), IRarm55 = W0.bdes.filter(b => b.side === 1 && b.kind !== 'inf').pop()!;
const show = (n: string, r: ReturnType<typeof duel>) => console.log(`  ${n}: النسبة ${r1(r.R)} · المهاجم يخترق ${Math.round(r.win * 100)}% · ${Math.round(r.h)} ساعة · خسارة المهاجم ${Math.round(r.lA * 100)}% المدافع ${Math.round(r.lD * 100)}%`);
const T: [string, Bde[], Bde[], Terr, number, (r: any) => boolean, string][] = [
  ['أبرامز مدرع ← مشاة إيران، سهل', [IQarm], [IRinf], 'plain', .6, r => r.win > .7, 'القوي يربح بالسهل'],
  ['أبرامز مدرع ← مشاة إيران، جبال', [IQarm], [IRinf], 'mount', .6, r => r.win < .4, 'المشاة المحصّنة بالجبل تصمد'],
  ['T-72 مدرع إيران ← أبرامز مدرع، سهل', [IRarm], [IQarm], 'plain', .3, r => r.win < .15, 'الجيل الأقدم ما يكسر الأحدث المدافع'],
  ['مشاة ← مشاة (نفسها)، سهل', [IQinf], [clone(IQinf)], 'plain', .3, r => r.win < .5, 'المدافع عنده أفضلية بالتساوي'],
  ['3 مشاة إيران ← 1 مشاة عراقية، سهل', [IRinf, clone(IRinf), clone(IRinf)], [IQinf], 'plain', .6, r => r.win > .75, 'قاعدة 3:1 تخترق'],
  ['2 مدرع T-55 ← مشاة عراقية، أهوار', [IRarm55, clone(IRarm55)], [IQinf], 'marsh', .6, r => r.win < .5, 'الدروع تتعثر بالأهوار'],
  ['أبرامز + آلي ← مشاة إيران، نهر', [IQarm, pick(0, 'mech')], [IRinf], 'river', .6, r => r.win > .4, 'عبور نهر صعب بس ممكن للأقوى'],
];
for (const [n, A, D, t, dug, cond, msg] of T) { const r = duel(A, D, t, dug); show(n, r); ok(cond(r), msg); }

console.log('\n== 3) شهر حرب كامل (100 مرة) ==');
let ms = 0; const fr: number[][] = [], cities: Record<string, number> = {}, loss = [[0, 0, 0], [0, 0, 0]]; let nan = false, neg = false, battles = 0, breaks = 0; const byS = [[0, 0], [0, 0]];
for (let s = 1; s <= 100; s++) {
  const W = new Front(FD, s); const t0 = performance.now();
  for (let h = 0; h < 24 * 30; h++) W.step();
  ms += performance.now() - t0;
  fr.push(W.f.map(x => x / 1000));
  for (const c of W.cities) if (c.owner !== (c.side === 'IQ' ? 0 : 1)) cities[c.n] = (cities[c.n] || 0) + 1;
  for (const sd of [0, 1]) { loss[sd][0] += W.lost[sd].men; loss[sd][1] += W.lost[sd].tank; loss[sd][2] += W.lost[sd].arty; }
  if (W.f.some(isNaN) || W.bdes.some(b => isNaN(b.org) || isNaN(b.x))) nan = true;
  if (W.bdes.some(b => b.bns.some(bn => bn.men < 0 || bn.eq.some(e => e.n < 0)))) neg = true;
  battles += W.done.length + W.battles.size; breaks += W.done.filter(b => b.done === 'break').length; for (const b of W.done) { byS[b.att][0]++; if (b.done === 'break') byS[b.att][1]++; }
}
const avg = W0.secs.map((_, i) => fr.reduce((s, f) => s + f[i], 0) / fr.length), mx = W0.secs.map((_, i) => Math.max(...fr.map(f => Math.abs(f[i]))));
console.log('  الجبهة بعد شهر (كم، موجب = العراق تقدم داخل إيران) لكل قطاع من الشمال للجنوب:');
console.log('  ' + W0.secs.map((s, i) => `${i + 1}${s.terr[0]}:${r1(avg[i])}`).join('  '));
console.log('  أقصى إزاحة:', mx.map(Math.round).join(' '));
console.log('  مدن تغيّرت (من 100):', JSON.stringify(cities));
console.log(`  خسائر/شهر: العراق ${Math.round(loss[0][0] / 100)} فرد، ${Math.round(loss[0][1] / 100)} دبابة، ${Math.round(loss[0][2] / 100)} مدفع · إيران ${Math.round(loss[1][0] / 100)} فرد، ${Math.round(loss[1][1] / 100)} دبابة، ${Math.round(loss[1][2] / 100)} مدفع`);
console.log(`  هجمات العراق ${r1(byS[0][0] / 100)} (اخترق ${r1(byS[0][1] / 100)}) · هجمات إيران ${r1(byS[1][0] / 100)} (اخترق ${r1(byS[1][1] / 100)})`);
console.log(`  معارك/شهر ${r1(battles / 100)}، اختراقات ${r1(breaks / 100)}، وقت الساعة ${r1(ms / 100 / 720 * 1000)} ميكروثانية`);
ok(!nan, 'ما أكو NaN'); ok(!neg, 'ما أكو أعداد سالبة');
ok(ms / 100 / 720 < 1, 'ساعة لعب أقل من 1 ملي ثانية');
ok(battles / 100 >= 4, 'أكو معارك فعلاً (≥4 بالشهر)');
ok(W0.secs.every((s, i) => s.terr !== 'mount' || Math.abs(avg[i]) < 15), 'الجبال ما تنهار بالمعدل (<15 كم)');
ok(mx.some(x => x > 10), 'الجبهة تتحرك بمكان ما (>10 كم)');

console.log('\n== 4) الأقوى يربح: نفس الحرب بس العراق ×2.5 (50 مرة) ==');
const big = ARMIES.map(a => a.side === 0 ? { ...a, troops: a.troops * 2.5, inv: parseInv(a.inv).map(([k, n]) => `${k}:${Math.round(n * 2.5)}`).join(','), air: a.air * 2.5 } : a);
const fb: number[] = W0.secs.map(() => 0);
for (let s = 1; s <= 50; s++) { const W = new Front(FD, s, big); for (let h = 0; h < 24 * 30; h++) W.step(); W.f.forEach((x, i) => fb[i] += x / 1000 / 50); }
console.log('  ' + W0.secs.map((s, i) => `${i + 1}${s.terr[0]}:${r1(fb[i])}`).join('  '));
const flatIdx = W0.secs.map((s, i) => i).filter(i => W0.secs[i].terr !== 'mount');
ok(flatIdx.reduce((s, i) => s + fb[i], 0) / flatIdx.length > 5, 'العراق الأقوى يتقدم بالمعدل بالسهول والتلال');
ok(flatIdx.reduce((s, i) => s + avg[i], 0) / flatIdx.length < 0, 'وبالأرقام الحقيقية إيران (ضعف القوة تقريباً) هي اللي تتقدم');
console.log(fails ? `\n✗ ${fails} فشل` : '\nALL PASS');
process.exit(fails ? 1 : 0);
