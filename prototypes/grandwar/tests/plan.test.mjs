// فحص خطط الأسهم: سهم من البصرة للأهواز بالدروع العراقية، نشوف يتحضّر ويهاجم ويأخذ مناطق
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js');
const C = JSON.parse(fs.readFileSync(new URL('../cells.js', import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
let ok = 0, tot = 0;
for (const seed of [1, 2, 3, 4]) {
  const W = SIM.World(C, { seed }); SIM.scenario(W);
  const find = n => C.cells.findIndex(c => c.city === n); const basra = find('البصرة'), ahvaz = find('الأهواز');
  const near = SIM.alive(W).filter(d => d.side === 0 && W.dist(d.cell, basra) < 160 && d.kind !== 'inf').slice(0, 4);
  const P = SIM.makePlan(W, 0, near, [basra, ahvaz]);
  const log = [];
  for (let h = 0; h < 24 * 20; h++) { if (h % 6 === 0) { SIM.ai(W, 0); SIM.ai(W, 1); } SIM.step(W); if (h % 24 === 23) log.push(`${P.st}:${P.path.filter(c => W.ctrl[c] === 0).length}/${P.path.length}`); }
  tot++; if (P.taken > 1 || P.st === 'done') ok++;
  console.log('seed', seed, 'رأس حربة', near.length, 'السهم', P.path.length, 'مناطق', '| ' + log.join(' '), '| الحالة', P.st, 'أخذنا', W.ctrl[ahvaz] === 0 ? 'الأهواز ✅' : 'لا');
}
console.log('خطط تقدّمت', ok, 'من', tot);
