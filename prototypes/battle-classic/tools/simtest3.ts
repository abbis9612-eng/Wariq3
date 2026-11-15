// فحص v3: node tools/simtest3.ts [عدد] — الخسائر = الميزانية، تعزيزات تنصرف، دفاع جوي يسقط، المعركة تخلص، ما أكو أرقام خربانة
import { create, step, SAMPLES, END } from '../src/sim3.ts';
import type { Res } from '../src/sim3.ts';
const N = +(process.argv[2] || 20); let bad = 0;
const cases: [string, Res][] = [...Object.entries(SAMPLES)];
for (const [name, res] of cases) {
  const A: Record<string, number> = {};
  const add = (k: string, v: number) => { A[k] = (A[k] ?? 0) + v / N; };
  let miss = 0;
  for (let s = 1; s <= N; s++) {
    const w = create(structuredClone(res), s * 7919); let sam = 0, samHit = 0, shots = 0;
    while (!w.over) { step(w, 1 / 20); for (const f of w.fx) { if (f.k === 'fire') { shots++; if (f.kind === 'sam') sam++; } if (f.k === 'airkill') samHit++; } w.fx.length = 0; for (const u of w.u) if (!isFinite(u.x + u.y)) { bad++; console.log('NaN', name, u.type); break; } }
    add('vehA', w.killed.veh[0]); add('bvehA', w.budget.veh[0]); add('vehD', w.killed.veh[1]); add('bvehD', w.budget.veh[1]);
    add('solA', w.killed.sol[0]); add('bsolA', w.budget.sol[0]); add('solD', w.killed.sol[1]); add('bsolD', w.budget.sol[1]); add('sup', w.killed.sup); add('bsup', w.budget.sup);
    add('tanksA', w.total[0].tank); add('poolLeftA', w.pool[0].tank); add('tanksD', w.total[1].tank); add('poolLeftD', w.pool[1].tank);
    add('airA', w.killed.air[0]); add('airD', w.killed.air[1]); add('sam', sam); add('samHit', samHit); add('shots/s', shots / END);
    add('cap%', 100 * w.b.filter(b => b.owner === 0).length / w.b.length);
    const m = Math.abs(w.killed.veh[0] - w.budget.veh[0]) + Math.abs(w.killed.veh[1] - w.budget.veh[1]) + Math.abs(w.killed.sup - w.budget.sup) + (Math.abs(w.killed.sol[0] - w.budget.sol[0]) + Math.abs(w.killed.sol[1] - w.budget.sol[1])) / 5;
    if (m > 3) miss++;
  }
  const f = (k: string) => (A[k] ?? 0).toFixed(1);
  console.log(`${name.padEnd(8)} مركبات مهاجم ${f('vehA')}/${f('bvehA')} مدافع ${f('vehD')}/${f('bvehD')} | إسناد ${f('sup')}/${f('bsup')} | جنود ${f('solA')}/${f('bsolA')}، ${f('solD')}/${f('bsolD')} | دبابات مهاجم ${f('tanksA')} (باقي بالمخزون ${f('poolLeftA')}) مدافع ${f('tanksD')} (${f('poolLeftD')}) | جو سقط: لنا ${f('airA')} للعدو ${f('airD')}، صواريخ دفاع ${f('sam')} أصابت ${f('samHit')} | طلقة/ث ${f('shots/s')} | بيوت مسيطرة ${f('cap%')}٪ | بعيدة ${miss}/${N}`);
  if (miss > N * .15) bad++;
}
console.log(bad ? 'FAIL' : 'PASS'); if (bad) process.exit(1);
