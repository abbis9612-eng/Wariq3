// فحص مضيق هرمز (GW11 C1)
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url); const SIM = require('../sim.js'); const AIR = require('../air.js'); const ECON = require('../econ.js'); const DIP = require('../dip.js');
AIR.useEcon(ECON);
const rd = f => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('=').slice(1).join('=').trim().replace(/;$/, ''));
const C = rd('cells.js'), RD = rd('roads.js');
let fails = 0; const check = (ok, m) => { console.log((ok ? '✅ ' : '❌ ') + m); if (!ok) fails++; };
const mk = s => { const W = SIM.World(C, { seed: s, roads: RD }); SIM.scenario(W); ECON.init(W); DIP.init(W); const A = AIR.create(W); return { W, A }; };
{ const { W, A } = mk(1); const b0 = ECON.budget(W, A, 0).oil, i0 = ECON.budget(W, A, 1).oil, p0 = W.oil.price, sa0 = W.dip.c.sa.rel[1];
  DIP.closeHz(W); const b1 = ECON.budget(W, A, 0).oil, i1 = ECON.budget(W, A, 1).oil;
  check(b1 < b0 * .2, `إغلاق هرمز ← دخل نفط العراق ينزل ${Math.round((1 - b1 / b0) * 100)}٪ (كركوك–جيهان بس يبقى)`);
  check(i1 < i0 * .5, `وحتى إيران تخسر (${Math.round((1 - i1 / i0) * 100)}٪)`);
  check(W.oil.price >= p0 + 20 && W.dip.c.sa.rel[1] <= sa0 - 20, 'النفط يقفز والسعودية تزعل من إيران');
  DIP.openHz(W, 'us'); check(Math.abs(ECON.budget(W, A, 0).oil / (W.oil.price) - b0 / p0) < 1e-6, 'الفتح يرجّع الصادرات'); }
{ const { W } = mk(2); DIP.closeHz(W); W.dip.c.us.rel[0] = 95; let ok = null; for (let k = 0; k < 6 && !(ok && ok.ok); k++) { W.dip.cd = {}; ok = DIP.askHz(W, 0); }
  check(ok && ok.ok && W.dip.hz.op > W.t, 'أمريكا (علاقة 95) تقبل عملية فتح المضيق');
  for (let d = 0; d < 16; d++) { W.t += 24; DIP.daily(W, null, SIM, ECON); }
  check(!W.dip.hz.closed && W.log.some(l => l.a === 'hzopen' && l.how === 'us'), 'العملية الأمريكية فتحت المضيق'); }
{ const { W } = mk(3); DIP.closeHz(W); DIP.accept(W, 0, 'truce'); W.t += 24; DIP.daily(W, null, SIM, ECON); check(!W.dip.hz.closed, 'الهدنة تفتح المضيق'); }
// حرب آلية: إيران تهدد وتغلق أحياناً (بحلفاء للعراق)
{ let closes = 0, warns = 0; for (const s of [4, 5, 6, 7]) { const { W, A } = mk(s); DIP.join(W, 'sa', 0);
    for (let h = 0; h < 24 * 90; h++) { if (h % 6 === 0) { SIM.ai(W, 0); SIM.ai(W, 1); } SIM.step(W); AIR.step(A, W, SIM, .5); if (W.t % 24 === 0) { ECON.daily(W, A, SIM); DIP.daily(W, A, SIM, ECON); } }
    closes += W.log.filter(l => l.a === 'hzclose').length; warns += W.log.filter(l => l.a === 'hzwarn').length; }
  console.log(`  4 حروب × 90 يوم (السعودية ويانا): تهديد ${warns}، إغلاق ${closes}`); check(closes >= 1 && closes <= 8, 'إيران تغلق المضيق بس مو كل شوي'); }
console.log(fails ? `\n❌ ${fails} فشل` : '\n✅ كل الفحوص نجحت'); process.exit(fails ? 1 : 0);
