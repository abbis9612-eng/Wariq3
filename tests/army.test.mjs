// فحص I-167: الجيش يطلع للحرب كامل — دبابات العراق تصير فرق مدرعة (قبل صفر)، والفرق اللي تنصنع بالسلم تدخل الحرب بعددها،
// وتبين على خريطة السلم، وتنقص بعد الحرب بنسبة اللي انقتل، والحفظ يرجّعها، وترقية V29.
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
new Function('window', fs.readFileSync(new URL('../prototypes/world/world-roads.js', import.meta.url), 'utf8'))(window); window.WD.WR = window.WR;
const WD = window.WD, S = require('../prototypes/world/wsim.js'), TH = require('../prototypes/world/theater.js'), SIM = require('../prototypes/world/gwsim.js'), N = require('../prototypes/world/nation.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const mk = () => { const G = S.init(WD, 'IRQ', { seed: 5 }); N.init(G, WD); G.ap = 9; return G; };
const war = G => { S.act(G, WD, 'war', 'IRN'); const w = G.wars[G.wars.length - 1]; return TH.build(G, WD, w, 'IRQ'); };
// 1) العراق (330 دبابة) يطلع بفرق مدرعة
const G0 = mk(), T0 = war(G0); if (!T0) { no('المسرح ما انبنى'); process.exit(1); }
const r0 = T0.raw[0]; if (!(r0.arm >= 1)) no('العراق بلا فرق مدرعة: ' + JSON.stringify(r0));
console.log('العراق بلا شراء:', JSON.stringify(r0), '— إيران:', JSON.stringify(T0.raw[1]));
// 2) نشتري فرقتين مدرعات وفرقة آلية بالسلم ← تدخل كلها
const G1 = mk(); for (const k of ['arm', 'arm', 'mec']) N.deliver(G1, WD, { k }, { T: null });
if (!G1.nat.ob || G1.nat.ob.arm !== 2 || G1.nat.ob.mec !== 1) no('الفرق المصنوعة ما انسجلت: ' + JSON.stringify(G1.nat.ob));
const T1 = war(G1), r1 = T1.raw[0];
if (r1.arm !== r0.arm + 2) no(`المدرعات: ${r0.arm} + 2 ≠ ${r1.arm}`); if (r1.mec !== r0.mec + 1) no(`الآلية: ${r0.mec} + 1 ≠ ${r1.mec}`);
if (Math.abs(r1.inf - r0.inf) > 1) no(`المشاة تغيّرت بلا سبب: ${r0.inf} ← ${r1.inf}`);   // pw المضاف ما ينحسب مرتين
// 3) خريطة السلم تبينها
const H0 = TH.home(G0, WD, 'IRQ'), H1 = TH.home(G1, WD, 'IRQ'); if (!H0 || !H1) no('خريطة السلم ما انبنت');
if (H0 && H1 && H1.raw[0].arm !== H0.raw[0].arm + 2) no(`خريطة السلم: ${H0.raw[0].arm} + 2 ≠ ${H1.raw[0].arm}`);
// 4) بعد الحرب: نص المدرعات انقتلت ← الفرق المصنوعة تنقص بالنسبة
const arms = T1.W.divs.filter(d => d.side === 0 && d.kind === 'arm'); arms.slice(0, Math.ceil(arms.length / 2)).forEach(d => { d.dead = true; });
N.warEnd(G1, T1); if (G1.nat.ob.arm !== Math.round(2 * (arms.length - Math.ceil(arms.length / 2)) / arms.length)) no('ما نقصت بعد الحرب: ' + JSON.stringify(G1.nat.ob));
// 5) الحفظ والترقية
const L = S.load(S.save(G1), WD); if (!L.nat.ob || L.nat.ob.mec !== G1.nat.ob.mec) no('الحفظ ضيّع الفرق المصنوعة');
const old = JSON.parse(S.save(mk())); old.v = 29; delete old.nat.ob; delete old.nat.obPw; const L2 = S.load(JSON.stringify(old), WD);
if (L2.v < 30 || !L2.nat.ob || L2.nat.ob.arm !== 0) no('ترقية V29');
// 6) المشهد (I-167 د): 5 فرق مدرعة تنضغط لـ45 آلية، والتعزيزات توصل بوقتها وتنحسب
const BV = require('../prototypes/world/gwbv.js');
const B2 = BV.create({ seed: 3, terr: 'plain', me: 0, att: { side: 1, divs: [1, 2, 3, 4, 5].map(i => ({ kind: 'arm', str: 1, n: 'a' + i })) }, def: { side: 0, divs: [{ kind: 'inf', str: 1, n: 'd' }] } });
const na = B2.units.filter(u => u.side === 1).length; if (na > 48 || na < 35) no('آليات 5 فرق مدرعة بالمشهد: ' + na);
const B3 = BV.create({ seed: 3, terr: 'plain', me: 0, att: { side: 1, divs: [{ kind: 'arm', str: 1, n: 'A1' }], reinf: [{ kind: 'arm', str: .8, n: 'R1', at: 100 }] }, def: { side: 0, divs: [{ kind: 'mec', str: 1, n: 'D1' }] } });
const u0 = B3.units.filter(u => u.side === 1).length, i0 = B3.init[1]; for (let t = 0; t < 120; t += .05) BV.step(B3, .05);
if (!B3.arrived.includes('R1') || B3.units.filter(u => u.side === 1).length <= u0 || !(B3.init[1] > i0)) no('التعزيزات ما وصلت للمشهد');
console.log(bad ? `❌ ${bad} مشاكل` : '✅ الجيش يطلع كامل والفرق المصنوعة تدخل الحرب'); process.exit(bad ? 1 : 0);
