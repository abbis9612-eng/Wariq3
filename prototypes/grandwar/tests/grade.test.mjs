// فحص التقييم (GW11 B5): كل طريق يتحرك صح، والتقييم يتبع النهاية
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js'); const ECON = require('../econ.js'); const DIP = require('../dip.js'); const GRADE = require('../grade.js');
AIR.useEcon(ECON);
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const X = { SIM, ECON, DIP };
const mk = () => { const W = SIM.World(C, { seed: 3, roads: RD }); SIM.scenario(W); ECON.init(W); DIP.init(W); const A = AIR.create(W); return { W, A }; };
const g0 = (() => { const { W, A } = mk(); return GRADE.grade(W, A, X); })();
console.log('أول الحرب:', JSON.stringify(g0));
check(['B', 'C'].includes(g0.g), 'أول الحرب التقييم متوسط (B أو C)');
{ const { W, A } = mk(); W.cells.forEach((c, i) => { if (c.s === 1 && c.vp && i % 2) W.ctrl[i] = 0; }); const g = GRADE.grade(W, A, X); check(g.p.mil > g0.p.mil + 20, `أخذنا مدن إيرانية ← العسكري يصعد (${g0.p.mil} ← ${g.p.mil})`); }
{ const { W, A } = mk(); W.cells.forEach((c, i) => { if (c.s === 0 && c.vp && i % 2) W.ctrl[i] = 1; }); const g = GRADE.grade(W, A, X); check(g.p.mil < g0.p.mil && g.p.pop < g0.p.pop, `خسرنا مدن ← العسكري والشعب ينزلون (${g.p.mil}، ${g.p.pop})`); }
{ const { W, A } = mk(); W.eco[0].cash = -14; const g = GRADE.grade(W, A, X); check(g.p.eco < g0.p.eco - 30, `الدين ← الاقتصادي ينزل (${g0.p.eco} ← ${g.p.eco})`); }
{ const { W, A } = mk(); DIP.join(W, 'sa', 0); DIP.join(W, 'us', 0); W.dip.sanc = W.t + 999; const g = GRADE.grade(W, A, X); check(g.p.dip > g0.p.dip + 30, `حلفاء وعقوبات ← السياسي يصعد (${g0.p.dip} ← ${g.p.dip})`); }
{ const { W, A } = mk(); W.over = { loser: 1 }; check(GRADE.grade(W, A, X).g === 'S', 'إيران استسلمت ← S'); }
{ const { W, A } = mk(); W.over = { loser: 0 }; check(GRADE.grade(W, A, X).g === 'D', 'استسلمنا ← D'); }
{ const { W, A } = mk(); W.over = { peace: 'keep', res: 'win' }; const g = GRADE.grade(W, A, X); check(g.score >= g0.score + 14, 'سلام بفوز يرفع التقييم'); }
{ const { W, A } = mk(); W.cfg = { ez: { used: 1 } }; check(GRADE.grade(W, A, X).ez, 'يكتب إذا بالوضع الخاص'); }
console.log(fails ? `\n❌ ${fails} فشل` : '\n✅ كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
