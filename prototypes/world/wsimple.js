// «العالم» I-169 (D-065): الوضع السهل — الدولة تمشي وحدها وإنت تقرر الحرب والسلام والجيش بس.
// المنطق نفسه بوت «المدير» بأداة الموازنة (tools/balance/world.mjs، انفحص 10 سنين) حتى ما نخترع إدارة جديدة ما منفحوصة.
// الفرق الوحيد: ما يعرض سلام وما يعلن حرب (هذني قرارك)، والأسرى يتسجنون، واقتراحات الوزراء تنقبل إذا الخزينة تتحمّل.
(function (root) {
  'use strict';
  const on = G => !!(G && G.cfg && G.cfg.simple);
  // D = { S, FUND, RES, M, HOME, P, WCAB, WINS } — نفس الوحدات بالصفحة (window) وبالفحص (require)
  function day(G, WD, D) {
    if (!on(G) || !G.nat) return; const e = G.nat.eco[0], lim = G.nat.lim || 1, H = G.nat.home;
    // القضايا الداخلية: الحل الأول (الأقوى) إذا عدنا فلوس، وإلا الأرخص — إلا الفئة اللي قريبة من الانقلاب: ندفعلها حتى لو بالدين (الدين أهون من انقلاب)
    const risk = k => H && H.fac[k] != null && H.fac[k] < 30 && ['army', 'irgc', 'royal', 'security', 'party'].includes(k);
    if (H && D.HOME) while (H.iss.length) { const q = H.iss[0], I = D.HOME.ISS[q.k]; D.HOME.choose(G.nat, 0, e.cash > lim * .2 || risk(q.k) ? 0 : I.o.length - 1); }
    // وإذا الفئة الخطرة تحت 25 وماكو قضية إلها: الوزراء يسوون نفس الحل كل أسبوع لحد ما ترتاح
    if (H && D.HOME && (G.t % 7) === 0) for (const k of Object.keys(H.fac)) if (risk(k) && H.fac[k] < 25 && D.HOME.ISS[k]) { D.HOME.ISS[k].o[0][1](G.nat); D.HOME.effects(G.nat); G.nat.log.push({ t: G.nat.t, side: 0, k: 'home', a: 'auto', i: k }); }
    // الأحداث السياسية: نفس قاعدة المدير
    if (D.P) while (G.pev && G.pev.length) D.P.choose(G, 0, e.cash > 0 ? 0 : D.P.PEV[G.pev[0].id].o.length - 1);
    // اقتراحات الوزراء: نوافق إذا الخزينة فوق نص الحد، وإلا نرفض
    if (G.cab && D.WCAB) for (const p of G.cab.props.slice()) D.WCAB.answer(G, WD, D.S, p.id, e.cash > lim * .5);
    // الأسرى: سجن (بلا إعدام ولا إطلاق)
    if (G.ins && D.WINS) while (G.ins.cap.length) { if (typeof D.WINS.fate(G, WD, D.S, 0, 'jail') === 'string') G.ins.cap.shift(); }
    // عروض الاتفاقيات (تجارة، عدم اعتداء، تحالف) وشراء سلاحنا: نقبلها مثل المدير
    while (G.offers && G.offers.length) D.S.answerOffer(G, WD, 0, true);
    if (G.mkt && D.M) while (G.mkt.offers.length) D.M.answer(G, WD, D.S, 0, true);
  }
  function month(G, WD, D) {
    if (!on(G) || !G.nat) return; const S = D.S, c = G.C[G.me], e = G.nat.eco[0], lim = G.nat.lim || 1, log = [];
    if (D.FUND) { const F = D.FUND.ensure(G); if (e.cash < 0) for (const k of ['bonds', 'stocks']) if (e.cash < 0 && F[k] > 0) D.FUND.take(G, k, Math.min(F[k], -e.cash + lim * .5));
      if (e.cash < 0 && !D.FUND.borrowOk(G, WD, S)) { D.FUND.borrow(G, WD, S); log.push('🏦 أخذنا قرض حتى نسد العجز'); }
      if (e.cash > lim * 3) D.FUND.put(G, 'bonds', +((e.cash - lim * 2) * .5).toFixed(2));
      if (e.cash > lim && D.RES) D.RES.fill(G, WD); }
    const tax0 = c.tax;
    if (e.cash < 0) { c.tax = 'high'; c.civ = e.cash < -lim * .5 ? 'cut' : 'mid'; } else if (e.cash > lim * 2) { c.tax = 'mid'; c.civ = 'more'; } else { c.tax = 'mid'; c.civ = 'mid'; }
    if (c.tax !== tax0) log.push(c.tax === 'high' ? '💰 رفعنا الضرايب لأن الخزينة بالسالب' : '💰 رجّعنا الضرايب عادية');
    e.prio = c.stab < 40 ? 'civ' : 'bal';
    if (G.ap >= 2 && G.t - (G.unT || -999) >= 180 && S.unSummit) S.unSummit(G);
    const EC = S.ECO, run = G.eco3 ? G.eco3.proj.filter(q => q.id === G.me && !q.done).length : 9;
    if (EC && run < 2) { const k = EC.elecDef(G, G.me) > .1 ? 'power' : c.oil > 0 ? 'oil' : 'fact', cd = EC.card(G, WD, G.me, k); if (e.cash > cd.cost + lim * 1.5 && !EC.can(G, WD, G.me, k)) { EC.start(G, WD, G.me, k); log.push(`🏗 الوزراء بدوا مشروع ${({ power: 'كهرباء', oil: 'نفط', fact: 'مصنع' })[k]}`); } }
    return log;
  }
  const API = { on, day, month };
  if (typeof module !== 'undefined') module.exports = API; else root.WSIMPLE = API;
})(typeof window !== 'undefined' ? window : globalThis);
