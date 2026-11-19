// فحص المستشارين (GW11 B2): كل قاعدة تطلع بحالتها، والأهم أول، و3 بالأكثر
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js'); const ECON = require('../econ.js'); const DIP = require('../dip.js'); const ADV = require('../advise.js');
AIR.useEcon(ECON);
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const X = { SIM, ECON, DIP };
const mk = () => { const W = SIM.World(C, { seed: 9, roads: RD }); SIM.scenario(W); ECON.init(W); DIP.init(W); const A = AIR.create(W); return { W, A }; };
const ids = (W, A) => ADV.list(W, A, X).map(o => o.id);
{ const { W, A } = mk(); const L = ADV.list(W, A, X); check(L.length <= 3 && L.every(o => o.t && o.a && o.l), `أول الحرب: ${L.map(o => o.id).join('، ')}`); }
{ const { W, A } = mk(); W.dip.offer = { k: 'sq', t: 0 }; check(ids(W, A)[0] === 'offer', 'عرض إيران أول نصيحة'); }
{ const { W, A } = mk(); const d = SIM.alive(W).find(d => d.side === 0); W.sup[0][d.cell] = 0; check(ids(W, A).includes('cut'), 'فرقة بلا إمداد'); }
{ const { W, A } = mk(); W.eco[0].cash = -3; check(ids(W, A).includes('debt'), 'الخزينة بالدين'); }
{ const { W, A } = mk(); W.eco[0].mor = 30; check(ids(W, A).includes('mor'), 'المعنويات نازلة'); }
{ const { W, A } = mk(); const s = A.sams.find(s => s.side === 0 && s.sys === 'pac'); s.mags.forEach(m => { m.ready = 0; m.stock = 0; }); for (const k in A.pool[0]) A.pool[0][k] = 0; check(ids(W, A).includes('sam'), 'بطارية تخلص صواريخها والمخزن فاضي'); }
{ const { W, A } = mk(); W.eco[1].mor = 5; W.eco[1].cash = -9; W.cells.forEach((c, i) => { if (c.s === 1 && c.vp && i % 2) W.ctrl[i] = 0; }); check(ids(W, A).includes('peace'), 'إيران تعبانة ← اعرض سلام'); }
{ const { W, A } = mk(); W.eco[0].auto = false; check(ids(W, A).includes('lines'), 'خطوط فاضية لما انت تقرر'); }
{ const { W, A } = mk(); W.dip.c.sa.rel[0] = 72; W.eco[0].auto = true; check(ADV.list(W, A, X).some(o => o.id === 'ally' || o.p > 40), 'السعودية قريبة تدخل (أو اكو أهم منها)'); }
{ const { W, A } = mk(); W.dip.offer = { k: 'sq' }; W.eco[0].cash = -3; W.eco[0].mor = 30; const d = SIM.alive(W).find(d => d.side === 0); W.sup[0][d.cell] = 0; const L = ids(W, A); check(L.length === 3 && L[0] === 'offer' && L[1] === 'cut', 'بالزحمة: 3 بس والأهم أول (' + L.join('، ') + ')'); }
// حرب آلية 40 يوم: المستشارين ما يطيحون
{ const { W, A } = mk(); let err = null; try { for (let h = 0; h < 24 * 40; h++) { if (h % 6 === 0) { SIM.ai(W, 0); SIM.ai(W, 1); } SIM.step(W); AIR.step(A, W, SIM, .5); if (W.t % 24 === 0) { ECON.daily(W, A, SIM); DIP.daily(W, A, SIM, ECON); ADV.list(W, A, X); } } } catch (e) { err = e; }
  check(!err, 'حرب 40 يوم والمستشارين يشتغلون كل يوم' + (err ? ': ' + err.message : '')); }
console.log(fails ? `\n❌ ${fails} فشل` : '\n✅ كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
