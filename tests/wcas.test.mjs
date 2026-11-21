// فحص «العالم» v3 C1 (I-118): الخسائر — حروب العالم، الضربات، السفن، المستشفيات، السكان والمعنويات، والحفظ.
// node tests/wcas.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), C = require('../prototypes/world/wcas.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const G = S.init(WD, 'IRQ', { seed: 3 }); N.init(G, WD);
S.step(G, WD, 365);
const R = G.cas3.c.RUS || {}, U = G.cas3.c.UKR || {};
if (!(U.kia > 3000)) no('أوكرانيا بحرب وخسائرها قليلة: ' + U.kia);
for (const id in G.cas3.c) { const t = G.cas3.c[id]; if (t.kia && !(t.wia > t.kia * 1.5 && t.wia < t.kia * 4)) no(`${id}: نسبة الجرحى ${t.wia}/${t.kia}`); for (const k in t) if (!Number.isFinite(t[k]) || t[k] < 0) no(`${id}.${k}=${t[k]}`); }
// ضربة على مدينتنا: مدنيين، سكان أقل، معنويات أقل
const pop0 = G.C.IRQ.pop, mor0 = G.nat.eco[0].mor, civ0 = C.tot(G, 'IRQ').civ;
C.strike(G, { t: 'IRQ', kind: 'city', hits: 200 });
if (!(C.tot(G, 'IRQ').civ - civ0 >= 590)) no('الضربة ما سوت ضحايا');
if (!(G.C.IRQ.pop < pop0)) no('السكان ما نقصوا'); if (!(G.nat.eco[0].mor < mor0)) no('المعنويات ما نزلت');
if (!(G.cas3.day.me.civ >= 600)) no('عداد اليوم');
// المستشفيات: جرحى أكثر من السعة = وفيات أكثر
const cap = C.cap(G, 'IRQ'); G.cas3.care.IRQ = cap * 3; const k0 = C.tot(G, 'IRQ').kia; C.month(G); const died = C.tot(G, 'IRQ').kia - k0;
if (!(died > cap * .1)) no(`المستشفيات المليانة ما زادت الوفيات (${died})`);
// سفينة
C.sink(G, 'IRQ', 'destroyer', 5); if (C.tot(G, 'IRQ').sh !== 1) no('السفينة');
// حفظ وترقية
const H = S.load(S.save(G), WD); if (!H.cas3 || H.cas3.c.IRQ.civ !== G.cas3.c.IRQ.civ) no('الحفظ');
const old = JSON.parse(S.save(S.init(WD, 'IRQ', { seed: 1 }))); old.v = 14; delete old.cas3; const G3 = S.load(JSON.stringify(old), WD); if (G3.v < 15) no('ترقية V14');
console.log(`سنة: روسيا ${R.kia || 0} قتيل/${R.wia || 0} جريح · أوكرانيا ${U.kia || 0}/${U.wia || 0}/${U.civ || 0} مدني · سعة مستشفيات العراق ${cap} · ماتوا من الزحمة ${died}`);
console.log(bad ? `❌ ${bad} مشاكل` : '✅ الخسائر تمام'); process.exit(bad ? 1 : 0);
