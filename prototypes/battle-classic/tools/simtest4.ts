// فحص v4: node tools/simtest4.ts [عدد] — الخسائر = الميزانية، تعزيزات تنصرف، دفاع جوي يسقط، المعركة تخلص، ما أكو أرقام خربانة
import { create, step, SAMPLES, END } from '../src/sim4.ts';
import type { Res } from '../src/sim4.ts';
const N = +(process.argv[2] || 20); let bad = 0;
const cases: [string, Res][] = [...Object.entries(SAMPLES)];
for (const [name, res] of cases) {
  const A: Record<string, number> = {};
  const add = (k: string, v: number) => { A[k] = (A[k] ?? 0) + v / N; };
  let miss = 0;
  for (let s = 1; s <= N; s++) {
    const w = create(structuredClone(res), s * 7919); let sam = 0, samHit = 0, shots = 0, olap = 0, samples = 0, maxJetTurn = 0, maxTankTurn = 0, misalign = 0, fastRev = 0;
    const prevHd = new Map<number, number>(), prevHull = new Map<number, number>();
    while (!w.over) { step(w, 1 / 20);
      if (w.T > 30) { const v = w.u.filter(u => u.alive && (u.type === 'tank' || u.type === 'ifv') && u.state !== 'road'); samples++; let o = false; for (let i = 0; i < v.length && !o; i++) for (let j = i + 1; j < v.length; j++) if (Math.hypot(v[i].x - v[j].x, v[i].y - v[j].y) < 16) { o = true; break; } if (o) olap++; }
      for (const a of w.air) if (a.state !== 'down') { const ph = prevHd.get(a.id); if (ph !== undefined) maxJetTurn = Math.max(maxJetTurn, Math.abs(Math.atan2(Math.sin(a.hd - ph), Math.cos(a.hd - ph))) * 20); prevHd.set(a.id, a.hd); if (a.spd > 1 && Math.abs(Math.atan2(Math.sin(Math.atan2(a.vy, a.vx) - a.hd), Math.cos(Math.atan2(a.vy, a.vx) - a.hd))) > .02) misalign++; }
      for (const u of w.u) if (u.alive && (u.type === 'tank' || u.type === 'ifv')) { const ph = prevHull.get(u.id); if (ph !== undefined) maxTankTurn = Math.max(maxTankTurn, Math.abs(Math.atan2(Math.sin(u.hull - ph), Math.cos(u.hull - ph))) * 20); prevHull.set(u.id, u.hull); if (u.spd < -7) fastRev++; } for (const f of w.fx) { if (f.k === 'fire') { shots++; if (f.kind === 'sam') sam++; } if (f.k === 'airkill') samHit++; } w.fx.length = 0; for (const u of w.u) if (!isFinite(u.x + u.y)) { bad++; console.log('NaN', name, u.type); break; } }
    add('vehA', w.killed.veh[0]); add('bvehA', w.budget.veh[0]); add('vehD', w.killed.veh[1]); add('bvehD', w.budget.veh[1]);
    add('solA', w.killed.sol[0]); add('bsolA', w.budget.sol[0]); add('solD', w.killed.sol[1]); add('bsolD', w.budget.sol[1]); add('sup', w.killed.sup); add('bsup', w.budget.sup);
    add('tanksA', w.total[0].tank); add('poolLeftA', w.pool[0].tank); add('tanksD', w.total[1].tank); add('poolLeftD', w.pool[1].tank);
    add('airA', w.killed.air[0]); add('airD', w.killed.air[1]); add('sam', sam); add('samHit', samHit); add('shots/s', shots / END);
    add('cap%', 100 * w.b.filter(b => b.owner === 0).length / w.b.length); add('olap%', 100 * olap / Math.max(1, samples)); A.jetTurn = Math.max(A.jetTurn ?? 0, maxJetTurn); A.tankTurn = Math.max(A.tankTurn ?? 0, maxTankTurn); add('misalign', misalign); add('fastRev', fastRev); add('jetsLeft', w.pool[0].jet);
    const m = Math.abs(w.killed.veh[0] - w.budget.veh[0]) + Math.abs(w.killed.veh[1] - w.budget.veh[1]) + Math.abs(w.killed.sup - w.budget.sup) + (Math.abs(w.killed.sol[0] - w.budget.sol[0]) + Math.abs(w.killed.sol[1] - w.budget.sol[1])) / 5;
    if (m > 3) miss++;
  }
  const f = (k: string) => (A[k] ?? 0).toFixed(1);
  console.log(`${name.padEnd(8)} مركبات مهاجم ${f('vehA')}/${f('bvehA')} مدافع ${f('vehD')}/${f('bvehD')} | إسناد ${f('sup')}/${f('bsup')} | جنود ${f('solA')}/${f('bsolA')}، ${f('solD')}/${f('bsolD')} | دبابات مهاجم ${f('tanksA')} (باقي بالمخزون ${f('poolLeftA')}) مدافع ${f('tanksD')} (${f('poolLeftD')}) | جو سقط: لنا ${f('airA')} للعدو ${f('airD')}، صواريخ دفاع ${f('sam')} أصابت ${f('samHit')} | طلقة/ث ${f('shots/s')} | بيوت مسيطرة ${f('cap%')}٪ | تداخل دبابات ${f('olap%')}٪ من الوقت | أقصى لفّة: طيارة ${(A.jetTurn).toFixed(2)} دبابة ${(A.tankTurn).toFixed(2)} راد/ث | طيارة بالعكس ${f('misalign')} | ريوس سريع ${f('fastRev')} | بعيدة ${miss}/${N}`);
  if (A['olap%'] > 3 || A.jetTurn > 1.75 || A.tankTurn > 1.45 || A.misalign > 0 || A.fastRev > 0) { bad++; console.log('  ✗ حركة'); }
  if (miss > N * .15) bad++;
}
console.log(bad ? 'FAIL' : 'PASS'); if (bad) process.exit(1);
