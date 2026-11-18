// فحص المحاكاة بدون رسم: حرب آلية بين الطرفين، تطبع ملخص كل 10 أيام
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js');
const C = JSON.parse(fs.readFileSync(new URL('../cells.js', import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const days = +(process.argv[2] || 120), seed = +(process.argv[3] || 1), quiet = process.argv[4] === 'q';
const W = SIM.World(C, { seed }); SIM.scenario(W); const A = process.argv[5] === 'noair' ? null : AIR.create(W);
const t0 = performance.now(); let stats = { battles: 0, maxB: 0 };
for (let h = 0; h < days * 24; h++) {
  if (h % 6 === 0) { SIM.ai(W, 0); SIM.ai(W, 1); }
  SIM.step(W); if (A) AIR.step(A, W, SIM, .5); stats.maxB = Math.max(stats.maxB, W.battles.size);
  if (!quiet && (h + 1) % 240 === 0) { const s = SIM.score(W); const L = W.log.filter(l => l.t > W.t - 240); console.log(`يوم ${(h + 1) / 24}: مناطق ${s.cells} نقاط ${s.vp} فرق ${s.divs} معارك ${W.battles.size} | أخذ ${L.filter(l => l.k === 'take').map(l => (l.side ? 'IR:' : 'IQ:') + (C.cells[l.cell].city || l.cell)).join(' ')} | انسحاب ${L.filter(l => l.k === 'retreat').length} استسلام ${L.filter(l => l.k === 'surrender').length}`); }
}
const ms = performance.now() - t0, s = SIM.score(W);
if (A) console.log('الجو: إسقاط', A.kills, 'خسارة طيارات', A.lostPlanes, 'طيارات باقية', A.bases.map(b => b.n0).join(','), 'دفاع جوي ذخيرة', A.sams.map(s => s.ammo).join(','), 'باليستي باقي', A.mbases.map(m => m.ammo).join(','), 'ضربات', W.log.filter(l => l.k === 'air').length);
console.log('النهاية', JSON.stringify(s), 'أخذ', W.took, 'أقصى معارك', stats.maxB, 'ms/ساعة', (ms / (days * 24)).toFixed(3));
