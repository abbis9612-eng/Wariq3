// فحص الطرق والجسور (R5b، I-088)
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js');
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const W = SIM.World(C, { seed: 1, roads: RD }); SIM.scenario(W);
const byN = {}; W.bridges.forEach(b => byN[b.n] = (byN[b.n] || 0) + 1);
console.log('الجسور:', JSON.stringify(byN), '· حدود بيها طريق', RD.e.length);
check(byN['دجلة'] > 10 && byN['الفرات'] > 10, 'جسور دجلة والفرات موجودة');
// كلفة الإمداد: جسر سالم أرخص من نهر بلا جسر
const b = W.bridges.find(x => x.n === 'دجلة'); const c0 = SIM.edgeCost(W, b.i, b.j); b.down = 48; const c1 = SIM.edgeCost(W, b.i, b.j); b.down = 0;
console.log(`عبور دجلة: بالجسر ${c0} · الجسر مضروب ${c1}`); check(c1 >= c0 + 4, 'ضرب الجسر يغلّي الإمداد');
// منطقة مقطوعة: نحاصر منطقة عراقية بعيدة عن المدن ونشوف
const sup0 = [...W.sup[0]].reduce((a, x) => a + x, 0); W.bridges.forEach(x => x.down = 999); SIM.supply(W); const sup1 = [...W.sup[0]].reduce((a, x) => a + x, 0);
console.log(`مناطق عراقية بإمداد: ${sup0} ← بعد ضرب كل الجسور ${sup1}`); check(sup1 <= sup0, 'ضرب الجسور ما يزيد الإمداد');
// إيران: الشرق البعيد بلا طرق يطلع بلا إمداد (صحرا لوت)
const ir = [...W.sup[1]].reduce((a, x) => a + x, 0), irT = [...W.ctrl].filter(x => x === 1).length; console.log(`إيران: ${ir} من ${irT} منطقة بإمداد`);
check(ir < irT, 'البعيد بلا طرق ما يوصله إمداد');
console.log(fails ? `❌ ${fails} فشل` : '✅ كل الفحوص نجحت'); process.exitCode = fails ? 1 : 0;
