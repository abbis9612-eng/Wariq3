// يفحص المعركة 2D: node tools/simtest.ts [عدد]
// لكل نموذج نتيجة: تخلص بوقتها، الخسائر تطابق ميزانية الحساب (نفس معادلات الأصل)، ما أكو أرقام خربانة
import { create, step, SAMPLES } from '../src/sim.ts';
import type { Res } from '../src/sim.ts';
const N = +(process.argv[2] || 30); let bad = 0;
const cases: [string, Res][] = [...Object.entries(SAMPLES), ['win_flank', { ...SAMPLES.win, tactic: 'flank' }], ['lose_siege', { ...SAMPLES.lose, tactic: 'siege' }]];
for (const [name, res] of cases) {
  const agg = { end: 0, vA: 0, bvA: 0, vD: 0, bvD: 0, sA: 0, bsA: 0, sD: 0, bsD: 0, sup: 0, bsup: 0, houses: 0, cap: 0, shots: 0, misses: 0 };
  for (let s = 1; s <= N; s++) {
    const w = create(structuredClone(res), s * 7919); let shots = 0;
    while (!w.over && w.T < 2000) { step(w, 1 / 20); for (const f of w.fx) if (f.k === 'fire') shots++; w.fx.length = 0;
      for (const u of w.u) if (!isFinite(u.x + u.y)) { console.log('NaN', name, s, u.kind); bad++; break; } }
    agg.end += w.T / N; agg.shots += shots / N;
    agg.vA += w.killed.veh[0] / N; agg.bvA += w.budget.veh[0] / N; agg.vD += w.killed.veh[1] / N; agg.bvD += w.budget.veh[1] / N;
    agg.sA += w.killed.sol[0] / N; agg.bsA += w.budget.sol[0] / N; agg.sD += w.killed.sol[1] / N; agg.bsD += w.budget.sol[1] / N;
    agg.sup += w.killed.sup / N; agg.bsup += w.budget.sup / N; agg.houses += w.b.filter(b => b.dead).length / N; agg.cap += w.b.filter(b => b.owner === 0).length / w.b.length / N;
    const miss = Math.abs(w.killed.veh[0] - w.budget.veh[0]) + Math.abs(w.killed.veh[1] - w.budget.veh[1]) + Math.abs(w.killed.sup - w.budget.sup) + Math.abs(w.killed.sol[0] - w.budget.sol[0]) / 4 + Math.abs(w.killed.sol[1] - w.budget.sol[1]) / 4;
    if (miss > 3) agg.misses++;
  }
  const f = (x: number) => x.toFixed(1);
  console.log(`${name.padEnd(11)} مدة ${(agg.end / 60).toFixed(1)}د | مركبات مهاجم ${f(agg.vA)}/${f(agg.bvA)} مدافع ${f(agg.vD)}/${f(agg.bvD)} | إسناد ${f(agg.sup)}/${f(agg.bsup)} | جنود مهاجم ${f(agg.sA)}/${f(agg.bsA)} مدافع ${f(agg.sD)}/${f(agg.bsD)} | بيوت مهدمة ${f(agg.houses)} مسيطر ${(agg.cap * 100).toFixed(0)}٪ | طلقات ${agg.shots.toFixed(0)} | بعيدة عن الميزانية ${agg.misses}/${N}`);
  if (agg.misses > N * 0.1) bad++;
}
console.log(bad ? 'FAIL' : 'PASS'); if (bad) process.exit(1);
