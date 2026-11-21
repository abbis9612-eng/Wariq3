// فحص «العالم» v5-10 (I-154): مجلس الوزراء — 9 وزراء، الطرق الثلاث، المالية تنقذ الخزينة، المرشحين، «ليش نخسر؟»، والحفظ.
// node tests/wcab.test.mjs
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const window = {}; new Function('window', fs.readFileSync(new URL('../prototypes/world/world-data.js', import.meta.url), 'utf8'))(window);
const WD = window.WD, S = require('../prototypes/world/wsim.js'), N = require('../prototypes/world/nation.js'), CB = require('../prototypes/world/wcab.js'), P = require('../prototypes/world/wpol.js');
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const day = Q => { const b = Q.log.length; S.step(Q, WD, 1); N.daily(Q, WD, { S, SIM: null, T: null, before: b }); while (Q.pev.length) P.choose(Q, 0, 0); };
const G = S.init(WD, 'IRQ', { seed: 5 }); N.init(G, WD); for (let i = 0; i < 70; i++) day(G);
const C = G.cab; if (!C || Object.keys(C.m).length !== 9) no('ماكو 9 وزراء');
for (const k of CB.MK) { const m = C.m[k]; if (!(m.sk >= 1 && m.sk <= 5) || !m.n || !CB.TR[m.tr]) no('وزير ناقص ' + k); }
if (!C.rep || C.rep.rows.length !== 9) no('ماكو تقرير شهري');
// المالية التلقائية: خزينة سالبة ← تتصلح (صندوق/قرض/ضرايب)
const e = G.nat.eco[0]; e.cash = -3; const tax0 = G.C.IRQ.tax; for (let i = 0; i < 65; i++) day(G);
if (!(e.cash > -3 || G.C.IRQ.tax !== tax0)) no('وزير المالية ما سوّى شي والخزينة سالبة: ' + e.cash);
// «يقترح»: تتجمع اقتراحات وموافقة تنفذها
CB.setMode(G, 'rd', 'ask'); const R0 = require('../prototypes/world/wres.js').ensure(G); R0.slots.length = 0; e.cash = 200; for (let i = 0; i < 35; i++) day(G);
const pr = C.props.find(p => p.k === 'rd'); if (!pr) no('البحث بوضع «يقترح» ما اقترح'); else if (R0.slots.length) no('«يقترح» نفّذ بدون موافقة'); else { const r = CB.answer(G, WD, S, pr.id, true); if (typeof r === 'string') no('الموافقة: ' + r); }
// «أنا أقرر»: ما ينفذ
CB.setMode(G, 'fin', 'me'); const t1 = G.C.IRQ.tax; e.cash = -2; G.C.IRQ.tax = 'mid'; for (let i = 0; i < 35; i++) day(G); if (G.C.IRQ.tax !== 'mid') no('«أنا أقرر» والوزير غيّر الضرايب');
// مرشح: تعيينه يبدّل الوزير ويحرك الفئات
C.cand.push({ id: 999, k: 'oil', n: 'تجربة التجربة', sk: 5, xp: 0, tr: 'honest', fac: Object.keys(G.nat.home.fac)[0], t0: G.t });
const r = CB.appoint(G, 999); if (typeof r === 'string' || C.m.oil.n !== 'تجربة التجربة') no('التعيين ما صار');
// «ليش نخسر؟»
const W = CB.why(G); if (!W.length) no('تقرير «ليش» فاضي');
// الحفظ والترقية
const H = S.load(S.save(G), WD); if (!H.cab || H.cab.m.oil.n !== 'تجربة التجربة') no('الحفظ ضيّع الوزراء');
const old = JSON.parse(S.save(S.init(WD, 'IRQ', { seed: 1 }))); old.v = 22; delete old.cab; const L2 = S.load(JSON.stringify(old), WD); if (L2.v < 23) no('ترقية V22');
// العراق 4 سنين بلا لعب والوزراء تلقائي: ما يخسر والخزينة ما تبقى سالبة
for (const sd of [101, 202]) { const Q = S.init(WD, 'IRQ', { seed: sd }); N.init(Q, WD); let neg = 0; for (let d = 0; d < 365 * 4 && !Q.over; d++) { day(Q); if (Q.nat.eco[0].cash < -Q.nat.lim * .5) neg++; } if (Q.over) no(`العراق خسر بـ${sd}: ${Q.over.why}`); if (neg > 60) no(`الخزينة سالبة ${neg} يوم (بذرة ${sd})`); }
console.log(`الوزراء: ${CB.MK.map(k => C.m[k].n + ' ' + C.m[k].sk + '★').slice(0, 3).join('، ')}… · ليش: ${W.map(x => x.t).slice(0, 2).join(' | ')}`);
console.log(bad ? `❌ ${bad} مشاكل` : '✅ مجلس الوزراء تمام'); process.exit(bad ? 1 : 0);
