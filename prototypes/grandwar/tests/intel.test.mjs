// فحص الاستخبارات (R5d، I-088): كم من فرق العدو يعرف كل طرف (شافها بآخر 24 ساعة)، وهل مسيّرات الاستطلاع تكشف العمق
// node tests/intel.test.mjs [أيام]
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js');
const C = JSON.parse(fs.readFileSync(new URL('../cells.js', import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const RD = JSON.parse(fs.readFileSync(new URL('../roads.js', import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));  // R5b: الطرق والجسور
const days = +(process.argv[2] || 6);
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
function run(air, seed = 3) {
  const W = SIM.World(C, { seed, roads: process.env.NOROADS ? null : RD }); SIM.scenario(W); const A = air ? AIR.create(W) : null;
  const st = [{ front: [0, 0], deep: [0, 0] }, { front: [0, 0], deep: [0, 0] }];
  for (let h = 0; h < days * 24; h++) {
    if (h % 6 === 0) { SIM.ai(W, 0); SIM.ai(W, 1); } SIM.step(W); if (A) AIR.step(A, W, SIM, 9.6);
    if (h % 6 !== 5) continue;
    for (const s of [0, 1]) for (const d of SIM.alive(W)) { if (d.side === s) continue; const front = W.cells[d.cell].nb.some(j => W.ctrl[j] === s); const k = front ? 'front' : 'deep'; st[s][k][1]++; if (SIM.isSeen(W, s, d.cell, 24)) st[s][k][0]++; }
  }
  const pc = a => Math.round(a[0] / Math.max(1, a[1]) * 100);
  return { W, A, iq: { front: pc(st[0].front), deep: pc(st[0].deep) }, ir: { front: pc(st[1].front), deep: pc(st[1].deep) } };
}
const a = run(false), b = run(true);
console.log(`بدون مسيّرات: العراق يعرف (آخر 24 س) ${a.iq.front}% من فرق الجبهة و${a.iq.deep}% من العمق · إيران ${a.ir.front}% و${a.ir.deep}%`);
console.log(`ويا المسيّرات والطيارات: العراق ${b.iq.front}% جبهة و${b.iq.deep}% عمق · إيران ${b.ir.front}% و${b.ir.deep}%`);
check(a.iq.front > 80, 'فرق الجبهة (بتماس) أغلبها تنشاف');
check(a.iq.deep < 40, 'العمق مخفي بدون استطلاع');
check(b.iq.deep > a.iq.deep + 10, 'الاستطلاع الجوي يكشف العمق');
// الذكاء ما يشوف اللي ما يعرفه
const W = b.W; const hidden = SIM.alive(W).filter(d => d.side === 0 && !SIM.isSeen(W, 1, d.cell)).length, kn = SIM.known(W, 1).filter(d => !d.ghost).length, real = SIM.alive(W).filter(d => d.side === 0).length;
console.log(`إيران (الذكاء) تعرف بالضبط ${kn} من ${real} فرقة عراقية، و${hidden} مخفية عنها`);
check(hidden > 0 && kn < real, 'الذكاء الإيراني يلعب بنفس الضباب');
const recon = b.A.lostPlanes; console.log('مسيّرات/طيارات انفقدت', recon);
console.log(fails ? `❌ ${fails} فشل` : '✅ كل الفحوص نجحت'); process.exitCode = fails ? 1 : 0;
