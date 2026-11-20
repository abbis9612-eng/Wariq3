// فحص «العالم» v3 E (I-119): المشاريع (بطاقة الربح، الأقساط، الإكمال، الأثر)، الكهرباء، القطاعات، وذكاء الدول، والحفظ.
// node tests/weco.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), E = require('../prototypes/world/weco.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const G = S.init(WD, 'IRQ', { seed: 5 }); N.init(G, WD);
if (!G.eco3) no('ماكو G.eco3');
const d0 = E.elecDef(G, 'IRQ'); if (Math.abs(d0 - .3) > .02) no(`نقص كهرباء العراق ${d0}`);
if (Math.abs(E.elecG(G, 'IRQ')) > 1e-9) no('الكهرباء غيّرت النمو بأول يوم');
for (const k in E.P) { const cd = E.card(G, WD, 'IRQ', k); if (!(cd.cost > 0 && cd.mo > 0)) no(`بطاقة ${k} غلط ${JSON.stringify(cd)}`); }
const oc = E.card(G, WD, 'IRQ', 'oil'); if (!(oc.tback > .3 && oc.tback < 4)) no(`حقل النفط يرجع فلوسه بـ${oc.tback} سنة؟`);
if (!E.can(G, WD, 'IRQ', 'oil') === false) no('العراق ما يگدر يبني حقل نفط');
if (!E.can(G, WD, 'LBN', 'oil')) no('لبنان بدون نفط وگدر يبني حقل');
const sec = E.sectors(G, WD, 'IRQ'); if (sec[0][0].indexOf('النفط') < 0) no('أكبر قطاع بالعراق مو النفط: ' + sec[0][0]);
const cash0 = G.nat.eco[0].cash, oil0 = G.C.IRQ.oil;
const r1 = E.start(G, WD, 'IRQ', 'oil'), r2 = E.start(G, WD, 'IRQ', 'power');
if (!r1.ok || !r2.ok) no('ما بدا المشروع: ' + r1 + ' ' + r2);
if (G.eco3.proj[0].r < 0 || G.ctl[G.eco3.proj[0].r] !== 'IRQ') no('مكان المشروع مو بأرضنا');
for (let i = 0; i < 6; i++) E.start(G, WD, 'IRQ', 'house'); if (G.eco3.proj.filter(q => q.id === 'IRQ' && !q.done).length > 6) no('تجاوز حد 6 مشاريع');
S.step(G, WD, 31);
if (!(G.eco3.spend.IRQ > 0)) no('ماكو أقساط');
// حفظ وتحميل بالنص
const G2 = S.load(S.save(G), WD); if (!G2.eco3 || G2.eco3.proj.length !== G.eco3.proj.length) no('الحفظ ضيّع المشاريع');
S.step(G, WD, 365 * 4 + 30);
const pj = G.eco3.proj.find(q => q.k === 'oil'); if (!pj || !pj.done) no('حقل النفط ما كمل بعد 4 سنين'); 
if (!(G.C.IRQ.oil > oil0 + 150)) no(`النفط ما زاد: ${oil0} → ${G.C.IRQ.oil}`);
if (!(G.eco3.elec.IRQ.cap > 0)) no('الكهرباء');
const built = G.log.filter(l => l.k === 'proj' && l.a === 'start' && l.id !== 'IRQ').length; if (built < 10) no(`الدول الثانية بنت ${built} مشروع بس`);
// حفظ قديم (V10، بدون eco3) يترقى
const old = JSON.parse(S.save(S.init(WD, 'IRQ', { seed: 1 }))); delete old.eco3; old.v = 10; const G3 = S.load(JSON.stringify(old), WD); if (!G3.eco3 || !G3.eco3.elec.IRQ) no('حفظ V10 ما ترقى');
console.log(`نقص كهرباء العراق ${Math.round(d0 * 100)}٪ · حقل نفط: ${oc.cost} مليار، ${oc.mo} شهر، الخزينة ترجعها بـ${oc.tback} سنة · نفط ${Math.round(oil0)} → ${Math.round(G.C.IRQ.oil)} · مشاريع الدول ${built} · خزينة ${cash0.toFixed(1)} → ${G.nat.eco[0].cash.toFixed(1)}`);
console.log(bad ? `❌ ${bad} مشاكل` : '✅ المشاريع والكهرباء تمام'); process.exit(bad ? 1 : 0);
