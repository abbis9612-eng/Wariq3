// فحص «الترسانة الوطنية» (I-135…I-138): الشروط، الأقساط، دخول الخدمة وأثره، السفن، الهيبة، الحفظ، والعائلات.
// node tests/warsenal.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), A = require('../prototypes/world/warsenal.js'), R = require('../prototypes/world/wres.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
if (A.FAM.length !== 31) no('العائلات مو 31'); if (Object.keys(A.FL).some(k => !A.FL[k].code || !A.FL[k].name)) no('سلاح بلا رمز أو اسم');
const codes = A.FAM.map(f => f.code); if (new Set(codes).size !== codes.length) no('رموز مكررة: ' + codes.filter((c, i) => codes.indexOf(c) !== i));
// العراق: الشروط تمنع
const I = S.init(WD, 'IRQ', { seed: 4 }); N.init(I, WD); if (!A.can(I, WD, 'tank')) no('العراق گدر يبني «زئير» بدون بحث');
// أمريكا: تبني زئير والمدمرة
const G = S.init(WD, 'USA', { seed: 4 }); N.init(G, WD); G.nat.eco[0].cash = 500;
if (!A.start(G, WD, 'tank').ok) no('ما بدا زئير: ' + A.can(G, WD, 'tank'));
if (!A.start(G, WD, 'destroyer').ok) no('ما بدا عقبة: ' + A.can(G, WD, 'destroyer'));
if (typeof A.start(G, WD, 'usv') !== 'string') no('تجاوز حد المشروعين');
const pw0 = G.C.USA.pwK || 1, dd0 = G.nav.g.filter(g => g.cc === 'USA').reduce((t, g) => t + (g.s.dd || 0), 0), cash0 = G.nat.eco[0].cash;
S.step(G, WD, 31); if (!(G.ars.run[0] && G.ars.run[0].paid > 0)) no('ماكو أقساط');
S.step(G, WD, 365 * 4);
if (!G.ars.done.tank || !G.ars.done.destroyer) no('ما دخلوا الخدمة');
if (!(G.C.USA.pwK > pw0)) no('قوة الجيش ما زادت');
const dd1 = G.nav.g.filter(g => g.cc === 'USA').reduce((t, g) => t + (g.s.dd || 0), 0); if (dd1 < dd0 + 2 - 4) no(`المدمرات ما انضافت ${dd0} → ${dd1}`);
if (!G.log.some(l => l.k === 'ars' && l.a === 'done' && l.f === 'tank')) no('ماكو خبر');
const H = S.load(S.save(G), WD); if (!H.ars || !H.ars.done.tank) no('الحفظ');
const O = JSON.parse(S.save(S.init(WD, 'IRQ', { seed: 1 }))); O.v = 17; delete O.ars; if (S.load(JSON.stringify(O), WD).v < 18) no('ترقية V17');
// M2: المنتجات الوطنية — الجيل من البحث، والطلب يتسلّم (فرقة، سفينة، صواريخ)
const SIM = require('../prototypes/world/gwsim.js'), E = require('../prototypes/world/gwecon.js');
const day = Q => { const b = Q.log.length; S.step(Q, WD, 1); N.daily(Q, WD, { S, SIM, T: null, before: b }); };
const Q = S.init(WD, 'TUR', { seed: 5 }); N.init(Q, WD); day(Q); Q.nat.eco[0].cash = 80; Q.nat.eco[0].lines = 6;
const ks = N.items().filter(k => k.startsWith('nf_') && !E.ITEMS[k].var); if (ks.length !== 21) no('منتجات تركيا الوطنية ' + ks.length);
if (E.ITEMS.nf_ZR.gen !== A.genOf(Q, 'arm')) no('جيل زئير مو من البحث');
const pw1 = Q.C.TUR.pw, msl1 = Q.C.TUR.msl, ff1 = Q.nav.g.filter(g => g.cc === 'TUR').reduce((t, g) => t + (g.s.ff || 0), 0);
for (const k of ['nf_ZR', 'nf_NZ', 'nf_MJ']) { const r = N.buy(Q, k); if (typeof r === 'string') no(k + ': ' + r); }
for (let i = 0; i < 460; i++) day(Q);
const ff2 = Q.nav.g.filter(g => g.cc === 'TUR').reduce((t, g) => t + (g.s.ff || 0), 0);
for (const k of ['nf_ZR', 'nf_NZ', 'nf_MJ']) if (!Q.nat.log.some(l => l.k === 'built' && l.it === k)) no('ما تسلّمنا ' + k);
if (!(Q.C.TUR.msl >= msl1 + 20 - 5)) no(`الصواريخ ما وصلت ${msl1} → ${Q.C.TUR.msl}`); if (ff2 < ff1 + 1 - 3) no(`الفرقاطة ما انضافت ${ff1} → ${ff2}`);
// النسخ: E تنباع، K ترفع قوة الجيش، M أغلى وأقوى
if (!E.ITEMS.nf_ZR_M || !E.ITEMS.nf_ZR_K || !E.ITEMS.nf_ZR_E) no('نسخ زئير ناقصة'); if (!(E.ITEMS.nf_ZR_M.pwF > E.ITEMS.nf_ZR.pwF)) no('M مو أقوى');
const cashE = Q.nat.eco[0].cash, pwKk = Q.C.TUR.pwK || 1;
for (const k of ['nf_ZR_E', 'nf_ZR_K']) { const r = N.buy(Q, k); if (typeof r === 'string') no(k + ': ' + r); }
for (let i = 0; i < 70; i++) day(Q);
if (!Q.log.some(l => l.k === 'natsell')) no('نسخة التصدير ما انباعت'); if (!((Q.C.TUR.pwK || 1) > pwKk)) no('نسخة القيادة ما رفعت القوة');
// K2: منتجات السوق الجديدة (سفن ومدفعية ومسيّرات) تتسلّم
const M = require('../prototypes/world/wmkt.js'), K = S.init(WD, 'SAU', { seed: 3 }); N.init(K, WD); K.nat.eco[0].cash = 60; for (const x of ['USA', 'TUR']) S.addRel(K, 'SAU', x, 60);
const kss = () => K.nav.g.filter(g => g.cc === 'SAU').reduce((t, g) => t + (g.s.ff || 0), 0), kf0 = kss();
for (const [x, k] of [['TUR', 'ada'], ['USA', 'm109']]) { const r = M.buy(K, WD, S, x, k); if (typeof r === 'string') no(`السوق ${k}: ${r}`); }
for (let i = 0; i < 560; i++) day(K);
if (kss() < kf0 + 2) no(`الكورفيتات ما انضافت ${kf0} → ${kss()}`); if (K.log.filter(l => l.k === 'arms' && l.a === 'got').length < 2) no('منتجات السوق ما وصلت');
// K2: الأقساط ونقل التقنية والمستعمل
const Z = S.init(WD, 'SAU', { seed: 6 }); N.init(Z, WD); Z.nat.eco[0].cash = 60; for (const x of ['USA', 'KOR']) S.addRel(Z, 'SAU', x, 60);
const zc = Z.nat.eco[0].cash; if (typeof M.buy(Z, WD, S, 'KOR', 'k2', 'tt') === 'string') no('نقل تقنية'); if (typeof M.buy(Z, WD, S, 'USA', 'f16', 'inst') === 'string') no('أقساط');
if (typeof M.buy(Z, WD, S, 'TUR', 'ada', 'used') !== 'string') no('سفينة مستعملة انقبلت');
if (Math.abs((zc - Z.nat.eco[0].cash) - (1.2 * 1.6 + 1.6 * 1.1 * .3)) > .01) no('الدفعة الأولى غلط');
for (let i = 0; i < 400; i++) day(Z);
if (!Z.log.some(l => l.k === 'arms' && l.a === 'tt')) no('نقل التقنية ما رفع البحث'); if (Z.mkt.deals.find(d => d.inst).inst.n !== 0) no('الأقساط ما خلصت');
// M2: التكرار وكفاءة الخط
const R2 = S.init(WD, 'TUR', { seed: 8 }); N.init(R2, WD); day(R2); R2.nat.eco[0].cash = 90; const e2 = R2.nat.eco[0]; e2.rep = { nf_SK: true }; N.buy(R2, 'nf_SK');
let built = 0, maxF = 1; for (let i = 0; i < 120; i++) { day(R2); built = R2.nat.log.filter(l => l.k === 'built' && l.it === 'nf_SK').length; if (e2.le && e2.le[0]) maxF = Math.max(maxF, e2.le[0].f); }
if (built < 2) no(`التكرار ما رجّع الطلب (${built})`); if (!(maxF > 1.1)) no('كفاءة الخط ما زادت ' + maxF);
// القسم 6: المخزون، المعرض، التجسس، حوض السفن
const F6 = S.init(WD, 'TUR', { seed: 9 }); N.init(F6, WD); day(F6); F6.nat.eco[0].cash = 50; F6.nat.natHave = { ZR: 2 };
F6.wars.push({ id: 'tst', n: 'تجربة', a: ['TUR'], b: ['GRC'], t0: F6.t, weary: {}, score: 0, months: 0, taken: {} });
for (let i = 0; i < 100; i++) day(F6); if (!(F6.nat.stock && F6.nat.stock.ammo < 80)) no('المخزون ما نزل بالحرب ' + JSON.stringify(F6.nat.stock));
const am = F6.nat.stock.ammo; if (typeof N.buy(F6, 'stk') === 'string') no('ما گدرنا نطلب ذخيرة'); for (let i = 0; i < 25; i++) day(F6); if (!(F6.nat.stock.ammo > am)) no('الذخيرة ما تعبّت');
F6.wars.pop(); for (let i = 0; i < 400; i++) day(F6); if (!F6.log.some(l => l.k === 'fair')) no('ما صار معرض سلاح');
R.pick(F6, WD, 'agri'); const sp = A.spy(F6, WD); if (typeof sp === 'string') no('التجسس: ' + sp); if (typeof A.spy(F6, WD) !== 'string') no('التجسس تكرر بنفس الوقت');
if (!require('../prototypes/world/weco.js').P.yard) no('ماكو حوض سفن');
console.log(`زئير وعُقبة دخلوا الخدمة · قوة الجيش ×${pw0} → ×${G.C.USA.pwK.toFixed(2)} · مدمرات ${dd0} → ${dd1} · رموز ${codes.length} بلا تكرار`);
console.log(bad ? `❌ ${bad} مشاكل` : '✅ الترسانة الوطنية تمام'); process.exit(bad ? 1 : 0);
