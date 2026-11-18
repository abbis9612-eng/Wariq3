// فحص الليل والطقس (R5c، I-088)
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js');
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const days = 60, W = SIM.World(C, { seed: 4, roads: RD }); SIM.scenario(W); const A = AIR.create(W);
let night = 0; const wxH = { clear: 0, cloud: 0, rain: 0, dust: 0 }, storms = []; let sortie = { day: 0, night: 0, dust: 0 }, su25night = 0;
for (let h = 0; h < days * 24; h++) {
  if (h % 6 === 0) { SIM.ai(W, 0); SIM.ai(W, 1); } SIM.step(W); AIR.step(A, W, SIM, 2);
  night += W.night ? 1 : 0; wxH[W.wx]++;
  for (const e of A.ev) if (e.k === 'takeoff') { if (W.wx === 'dust') sortie.dust++; else if (W.night) sortie.night++; else sortie.day++; if (W.night && /الإمام علي|كركوك/.test(e.base)) su25night++; } A.ev.length = 0;
}
for (const l of W.log) if (l.k === 'wx' && l.wx === 'dust') storms.push(l.h);
console.log(`ليل ${Math.round(night / (days * 24) * 100)}% من الساعات · طقس: ${Object.entries(wxH).map(([k, v]) => `${SIM.WX[k].n} ${Math.round(v / (days * 24) * 100)}%`).join('، ')}`);
console.log(`عواصف غبار بـ${days} يوم: ${storms.length} (طولها ${storms.join('، ')} س) · طلعات: نهار ${sortie.day}، ليل ${sortie.night}، بالغبار ${sortie.dust} · سوخوي-25 بالليل ${su25night}`);
check(night / (days * 24) > .35 && night / (days * 24) < .5, 'الليل ~40% (19:00–05:00)');
check(storms.length >= 2 && storms.length <= 12, 'عواصف غبار كم مرة بالشهرين');
check(sortie.dust === 0, 'ما اكو طيران بعاصفة الغبار');
check(su25night === 0, 'سوخوي-25 ما تطير بالليل');
check(SIM.envAtk({ night: true, wx: 'clear' }, 1) < SIM.envAtk({ night: true, wx: 'clear' }, 0), 'بالليل الهجوم الإيراني أضعف (مناظير أقدم)');
console.log(fails ? `❌ ${fails} فشل` : '✅ كل الفحوص نجحت'); process.exitCode = fails ? 1 : 0;
