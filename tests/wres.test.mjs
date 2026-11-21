// فحص «العالم» v3 R (I-121): شجرة البحث — اختيار بحث مدني، الفلوس تتحول له، يخلص ويطبق أثره، يرجع للعسكري، الشروط، السرعة، والحفظ.
// node tests/wres.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), SIM = require('../prototypes/world/gwsim.js'), R = require('../prototypes/world/wres.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const day = G => { const b = G.log.length; S.step(G, WD, 1); N.daily(G, WD, { S, SIM, T: null, before: b }); };
const G = S.init(WD, 'IRQ', { seed: 9 }); N.init(G, WD); const I = G.nat.ind[0]; I.bud = 3;
if (!R.can(G, WD, 'oilx2')) no('«حفر أفقي» انفتح بدون «استخراج محسّن»');
if (R.can(G, WD, 'nucw') !== 'مقفول') no('النووي العسكري مو مقفول');
if (!R.can(G, WD, 'oilx') === false) no('ما يگدر يبحث استخراج النفط');
const sp = R.speed(G, 'IRQ'); if (!(sp > .5 && sp < 2)) no('السرعة ' + sp);
const mil0 = I.rb, oilK0 = G.C.IRQ.oilK || 1;
const r = R.pick(G, WD, 'oilx'); if (!r.ok || I.rb !== 'civ') no('ما اختار البحث المدني');
let d = 0; while (!G.res3.done.oilx && d < 400) { day(G); d++; }
if (!G.res3.done.oilx) no('«استخراج محسّن» ما خلص بـ400 يوم'); else if (!(G.C.IRQ.oilK > oilK0)) no('أثر النفط ما تطبق');
if (I.rb !== mil0) no(`ما رجع للفرع العسكري (${I.rb})`);
if (!G.log.some(l => l.k === 'res' && l.r === 'oilx')) no('ماكو خبر بالسجل');
// التعليم يسرّع
R.pick(G, WD, 'edu'); d = 0; while (!G.res3.done.edu && d < 400) { day(G); d++; } if (!(R.speed(G, 'IRQ') > sp)) no('إصلاح التعليم ما سرّع البحث');
// العسكري يتقدم بعد
const t0 = I.tech[I.rb]; for (let k = 0; k < 120; k++) day(G); if (!(I.tech[I.rb] > t0 || I.rp > 0)) no('البحث العسكري ما يتقدم');
// الرجوع اليدوي من مدني لعسكري
R.pick(G, WD, 'agri'); day(G); R.back(G, 'uav'); if (I.rb !== 'uav' || G.res3.cur) no('الرجوع للعسكري');
const H = S.load(S.save(G), WD); if (!H.res3 || !H.res3.done.oilx) no('الحفظ ضيّع البحث');
console.log(`سرعة البحث ${sp} → ${R.speed(G, 'IRQ')} · «استخراج محسّن» خلص بيوم ${G.res3.done.oilx - G.res3.done.oilx % 1} · oilK ${G.C.IRQ.oilK}`);
console.log(bad ? `❌ ${bad} مشاكل` : '✅ شجرة البحث تمام'); process.exit(bad ? 1 : 0);
