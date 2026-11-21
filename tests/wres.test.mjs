// فحص «العالم» v4 R2 (I-130): خانات البحث المتوازية — العدد حسب العلماء، كل خانة تدفع، العسكري لحد 6، بحوث المستقبل بشروطها، ترقية الحفظ القديم.
// node tests/wres.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), SIM = require('../prototypes/world/gwsim.js'), R = require('../prototypes/world/wres.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const day = G => { const b = G.log.length; S.step(G, WD, 1); N.daily(G, WD, { S, SIM, T: null, before: b }); };
// العراق: خانتين
const G = S.init(WD, 'IRQ', { seed: 9 }); N.init(G, WD); const I = G.nat.ind[0]; I.bud = 3;
R.ensure(G); const mx = R.slotsMax(G); if (mx < 2 || mx > 3) no('خانات العراق ' + mx);
if (!G.res3.slots.some(q => q.k === 'm:arm')) no('اللعبة الجديدة ما بدت بخانة عسكرية'); if (!R.pick(G, WD, 'oilx').ok) no('ما شغّل الخانة الثانية');
if (mx === 2 && typeof R.pick(G, WD, 'agri') !== 'string') no('شغّل أكثر من الخانات');
const cash0 = G.nat.eco[0].cash; day(G); const spent = cash0 - G.nat.eco[0].cash;
const arm0 = I.tech.arm; let d = 0, d1; while ((!G.res3.done.oilx || I.tech.arm === arm0) && d < 500) { day(G); d++; }
if (!G.res3.done.oilx) no('«استخراج محسّن» ما خلص'); if (I.tech.arm <= arm0) no('الدروع ما تقدمت');
if (!(G.C.IRQ.oilK > 1)) no('أثر النفط'); d1 = d;
// أمريكا: 5 خانات تقريباً، وتگدر تبحث المستوى 6 وبحوث المستقبل
const U = S.init(WD, 'USA', { seed: 9 }); N.init(U, WD); U.nat.ind[0].bud = 3; const um = R.slotsMax(U); if (um < 4) no('خانات أمريكا ' + um);
if (typeof R.pick(U, WD, 'm:msl') === 'string') no('أمريكا ما تگدر تبحث الصواريخ 6');
if (typeof R.pick(U, WD, 'hyper') !== 'string') no('فرط صوتي انفتح قبل الصواريخ 6');
R.fill(U, WD); if (U.res3.slots.length !== um) no('«شغّل كل الخانات» ما عبّاها');
d = 0; while (U.nat.ind[0].tech.msl < 6 && d < 900) { day(U); d++; } if (U.nat.ind[0].tech.msl < 6) no('الصواريخ ما وصلت 6');
if (typeof R.pick(U, WD, 'hyper') === 'string' && !U.res3.slots.some(q => q.k === 'hyper')) { R.drop(U, 0); if (typeof R.pick(U, WD, 'hyper') === 'string') no('فرط صوتي ما انفتح بعد الصواريخ 6'); }
// ترقية حفظ قديم (بحث واحد)
const O = S.init(WD, 'IRQ', { seed: 2 }); N.init(O, WD); O.res3 = { done: {}, cur: 'agri', p: .3 }; O.nat.ind[0].rb = 'uav'; O.nat.ind[0].rp = .2; delete O.res3.slots;
const r0 = R.ensure(O); if (!r0.slots || r0.slots.length !== 2 || O.nat.ind[0].rb !== 'civ') no('ترقية الحفظ القديم: ' + JSON.stringify(r0.slots));
const H = S.load(S.save(G), WD); if (!H.res3 || !H.res3.slots) no('الحفظ');
console.log(`العراق: ${mx} خانة، صرف يوم ${spent.toFixed(3)} مليار، النفط والدروع خلصوا بـ${d1} يوم · أمريكا: ${um} خانة، الصواريخ 6 بعد ${d} يوم`);
console.log(bad ? `❌ ${bad} مشاكل` : '✅ خانات البحث تمام'); process.exit(bad ? 1 : 0);
