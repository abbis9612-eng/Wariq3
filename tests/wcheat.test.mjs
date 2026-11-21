// فحص I-157: وضع الغش — فلوس، البحث كامل (والنووي يبقى مقفول)، نقاط قرار، استقرار، والحفظ.
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), C = require('../prototypes/world/wcheat.js'), R = require('../prototypes/world/wres.js'), A = require('../prototypes/world/warsenal.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const G = S.init(WD, 'IRQ', { seed: 3 }); N.init(G, WD); N.daily(G, WD, { S, SIM: null, T: null, before: 0 });
const c0 = G.nat.eco[0].cash; C.money(G); if (!(G.nat.eco[0].cash >= c0 + 999)) no('الفلوس ما زادت');
const r = C.research(G, WD); if (typeof r === 'string') no(r);
const D = R.ensure(G).done, open = Object.keys(R.T).filter(k => !R.T[k].lock && !D[k]); if (open.length) no('بحوث ما خلصت: ' + open.join(','));
if (D.enrich || D.nucw) no('النووي انفتح بالغش'); if (Object.values(G.nat.ind[0].tech).some(v => v < R.MAXL)) no('فرع بحث ناقص');
const no2 = A.natOpen(G); if (!no2.land || !no2.air) no('الصنع الوطني ما انفتح بعد البحث');
C.ap(G); if (G.ap !== 99) no('نقاط القرار'); C.calm(G); if (G.C.IRQ.stab !== 90) no('الاستقرار'); C.debt(G); if (G.C.IRQ.debt !== 0) no('الدين');
for (let i = 0; i < 40; i++) { const b = G.log.length; S.step(G, WD, 1); N.daily(G, WD, { S, SIM: null, T: null, before: b }); }
const H = S.load(S.save(G), WD); if (!H.cfg.cheat || !R.ensure(H).done.oilx) no('الحفظ ضيّع الغش');
console.log(bad ? `❌ ${bad} مشاكل` : '✅ وضع الغش تمام'); process.exit(bad ? 1 : 0);
