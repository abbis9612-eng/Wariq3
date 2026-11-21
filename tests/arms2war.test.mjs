// فحص I-158: السلاح اللي نشتريه أو نصنعه يدخل الحرب فعلاً — طيارة بنوع جديد بنص الحرب، بطارية من السوق بنص الحرب، صواريخ دفاع جوي من السلم،
// الطيارات تبقى بعد الحرب، الحفظ يرجّع السرب والبطارية الجديدة، و«قوة الجيش +X٪» من البحث ترفع الرقم فعلاً.
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
new Function('window', fs.readFileSync(new URL('../prototypes/world/world-roads.js', import.meta.url), 'utf8'))(window); window.WD.WR = window.WR;
const WD = window.WD, S = require('../prototypes/world/wsim.js'), TH = require('../prototypes/world/theater.js'), SIM = require('../prototypes/world/gwsim.js');
const N = require('../prototypes/world/nation.js'), AW = require('../prototypes/world/airworld.js'), AIR = require('../prototypes/world/gwair.js'), ECON = require('../prototypes/world/gwecon.js'), MKT = require('../prototypes/world/wmkt.js'), RES = require('../prototypes/world/wres.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const G = S.init(WD, 'IRQ', { seed: 5 }); N.init(G, WD); G.ap = 9;
// صواريخ دفاع جوي انصنعت بالسلم
G.nat.samStock = { 'MIM-23': 40 };
S.act(G, WD, 'war', 'KWT'); const w = G.wars[G.wars.length - 1];
const T = TH.build(G, WD, w, 'IRQ'); T.arms = JSON.parse(JSON.stringify(G.nat.arms || { jets: {}, sam: {} })); T.samStock = G.nat.samStock; G.nat.samStock = {}; T.A = AW.build(T, G, WD);
if (!((T.A.pool[0]['MIM-23'] || 0) >= 40)) no('صواريخ السلم ما دخلت مخزون الحرب: ' + T.A.pool[0]['MIM-23']);
// طيارة بنوع ما عدنا قاعدته (F-35) تنصنع بنص الحرب
const t = Object.keys(AIR.PLANES).find(k => !T.A.bases.some(b => b.side === 0 && b.type === k) && AIR.PLANES[k].aa > .6);
ECON.ITEMS.pl_test = { n: 'تجربة ×4', ic: '✈', cat: 'plane', plane: t, q: 4, side: 0, cost: 1, days: 1 };
const p0 = T.A.bases.filter(b => b.side === 0).reduce((s, b) => s + b.n0, 0), pw0 = G.C.IRQ.pw;
N.deliver ? N.deliver(G, WD, { k: 'pl_test' }, { T, SIM }) : null;
const nb = T.A.bases.find(b => b.side === 0 && b.type === t);
if (!nb || nb.n0 !== 4) no(`الطيارات الجديدة (${t}) ما دخلت الحرب: ${nb ? nb.n0 : 'ماكو قاعدة'}`);
if (!(G.nat.arms.jets[t] >= 4)) no('الطيارات ما تبقى بعد الحرب (ما انحفظت بالترسانة)');
if (!(G.C.IRQ.pw > pw0)) no('قوة الجيش ما زادت بالطيارات');
// بطارية من السوق توصل بنص الحرب
const sys = Object.keys(AIR.SYS).find(k => k === 'pac') || Object.keys(AIR.SYS)[0], s0 = T.A.sams.filter(x => x.side === 0).length;
MKT.ensure ? MKT.ensure(G) : null; G.mkt = G.mkt || { deals: [], offers: [] };
const seller = Object.keys(MKT.SELL).find(x => MKT.SELL[x].some(o => o.cat === 'sam' && o.t === sys)); const off = MKT.SELL[seller].find(o => o.cat === 'sam' && o.t === sys);
G.mkt.deals.push({ x: seller, k: off.k, at: G.t, t: G.t, mode: 'cash' });
MKT.deliver(G, WD, { ECON, AIR, T, AWLD: AW });
if (T.A.sams.filter(x => x.side === 0).length !== s0 + off.q) no(`بطاريات السوق ما دخلت الحرب: ${s0} ← ${T.A.sams.filter(x => x.side === 0).length} (المفروض +${off.q})`);
// الحفظ والتحميل: السرب والبطارية الجديدة يرجعون بحالتهم
nb && (nb.ready = 3); const o = JSON.parse(JSON.stringify(AW.save(T.A))), A2 = AW.restore(AW.build(T, G, WD), o);
const nb2 = A2.bases.find(b => b.side === 0 && b.type === t && b.n === nb.n);
if (!nb2 || nb2.ready !== 3) no('السرب الجديد ضاع بعد التحميل: ' + (nb2 ? nb2.ready : 'ماكو'));
if (A2.sams.filter(x => x.side === 0).length !== T.A.sams.filter(x => x.side === 0).length) no('البطارية الجديدة ضاعت بعد التحميل');
// البحث «قوة الجيش +2٪» يرفع الرقم فوراً
const pw1 = G.C.IRQ.pw; RES.finish(G, WD, 'sof'); if (!(G.C.IRQ.pw > pw1 * 1.015)) no(`البحث ما رفع قوة الجيش: ${pw1.toFixed(0)} ← ${G.C.IRQ.pw.toFixed(0)}`);
// رخصة الدبابات ترفع جودة دروعنا بالحرب
G.nat.arms.tank = { x: 'USA', gen: 4, n: 'أبرامز' }; const T2 = TH.build(G, WD, w, 'IRQ'); if (!(T2.W.qual[0].hard >= .8 + 4 * .1 - 1e-9)) no('رخصة الدبابات ما أثرت بالحرب: ' + T2.W.qual[0].hard);
console.log(bad ? `❌ ${bad} مشاكل` : '✅ السلاح يدخل الحرب'); process.exit(bad ? 1 : 0);
