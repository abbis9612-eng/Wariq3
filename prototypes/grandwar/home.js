// «الحرب الكبرى» GW11 C6: الداخل العراقي — الاستقرار، 5 فئات، قضايا بقرارات، وخسارة بانقلاب أو ثورة أو إفلاس. فحص tests/home.test.mjs.
// (من لعبة المالك الأصلية: الفئات والقضايا وطرق الخسارة، بس على مقياس الحرب وبفئات العراق: الجيش، الشارع، العشائر، الفصائل المسلحة، رجال الأعمال)
// الأرقام [تقدير]. للعراق بس (إيران تبقى بالمعنويات).
(function (root) {
  const FAC = {
    army: { n: 'الجيش', ic: '🪖', d: 'يريد رواتب وتسليح وانتصارات. تحت 40 الفرق ترتاح أبطأ، وتحت 20 لأسبوعين = انقلاب' },
    street: { n: 'الشارع', ic: '👥', d: 'يريد كهرباء ووقود ورواتب وسلام. ينزل ويا المعنويات والدين و«اقتصاد الحرب»' },
    tribe: { n: 'العشائر', ic: '🏕', d: 'تتأذى من خسارة المدن والنزوح. تحت 30 الإمداد بمناطقها يضعف' },
    mil: { n: 'الفصائل المسلحة', ic: '🏴', d: 'بعضها قريب من إيران. تحالفنا ويا أمريكا يزعّلها، وتحت 25 ممكن تهاجم قواعدنا' },
    biz: { n: 'رجال الأعمال', ic: '💼', d: 'يريدون دين أقل وتجارة. تحت 30 الدخل غير النفطي ينزل' },
  };
  const FK = Object.keys(FAC);
  // القضايا: كل وحدة إلها فئة، ونص، وخيارات { n، fx(W) }. crit = توقف الوقت لحد ما تقرر
  const ISS = {
    army: { t: 'الجيش يطلب مكافآت ورواتب متأخرة', x: 'قادة الفرق يكولون الجنود ما استلموا مستحقاتهم من شهرين.', o: [['ادفع (0.6 مليار)', W => { cash(W, -.6); fac(W, 'army', 14); }], ['ارفض', W => { fac(W, 'army', -12); }]] },
    street: { t: 'غلاء وانقطاع كهرباء', x: 'الناس تتظاهر على أسعار البنزين وساعات القطع.', o: [['دعم الوقود والكهرباء (0.8 مليار)', W => { cash(W, -.8); fac(W, 'street', 14); fac(W, 'biz', -3); mor(W, 2); }], ['قطع مبرمج ونفسّر للناس', W => { fac(W, 'street', -8); }]] },
    tribe: { t: 'شيوخ العشائر يطلبون حماية للنازحين', x: 'آلاف العوائل نزحت، والعشائر تطلب سلاح ومخيمات.', o: [['مخيمات وسلاح (0.4 مليار)', W => { cash(W, -.4); fac(W, 'tribe', 14); fac(W, 'army', -3); }], ['الدولة تتكفل بعدين', W => { fac(W, 'tribe', -10); }]] },
    mil: { t: 'الفصائل تطلب تبقى برّا قيادة الجيش', x: 'بعض الفصائل تريد قرارها بإيدها، وأمريكا تراقب.', o: [['وافق', W => { fac(W, 'mil', 14); fac(W, 'army', -8); dipRel(W, 'us', -5); }], ['ادمجهم بالجيش', W => { fac(W, 'mil', -14); fac(W, 'army', 6); dipRel(W, 'us', 3); }]] },
    biz: { t: 'التجار يطلبون إعفاءات وفتح الحدود', x: 'غرف التجارة تكول الحرب كتلت السوق.', o: [['إعفاءات (0.3 مليار)', W => { cash(W, -.3); fac(W, 'biz', 14); fac(W, 'street', 2); }], ['ارفض', W => { fac(W, 'biz', -9); }]] },
  };
  const cash = (W, v) => { if (W.eco) W.eco[0].cash += v; };
  const mor = (W, v) => { if (W.eco) W.eco[0].mor = Math.max(0, Math.min(100, W.eco[0].mor + v)); };
  const fac = (W, k, v) => { const F = W.home.fac; F[k] = Math.max(0, Math.min(100, F[k] + v)); };
  const dipRel = (W, id, v) => { if (W.dip && W.dip.c[id]) { const c = W.dip.c[id]; c.rel[0] = Math.max(-100, Math.min(100, c.rel[0] + v)); } };

  function init(W) { W.home = { stab: 60, fac: { army: 62, street: 55, tribe: 58, mil: 50, biz: 55 }, iss: [], issT: W.t + 24 * 5, warn: { coup: 0, rev: 0, bank: 0 }, why: [], hit: 0 }; return W; }
  const ensure = W => { if (!W.home) init(W); return W; };
  // آثار يقراها sim/econ
  function effects(W) { const F = W.home.fac; W.homeF = { org: F.army < 40 ? .85 : 1, other: F.biz < 30 ? .8 : 1, sup: F.tribe < 30 ? -1 : 0 }; }
  function daily(W, A, X) {
    ensure(W); const H = W.home, F = H.fac, e = W.eco ? W.eco[0] : { cash: 5, mor: 55, prio: 'bal' }, why = [];
    const d = (k, v, r) => { if (!v) return; F[k] = Math.max(0, Math.min(100, F[k] + v)); if (Math.abs(v) >= .2) why.push([k, v, r]); };
    // ثابت كل يوم
    if (e.cash < 0) { d('army', -.5, 'الرواتب'); d('biz', -.4, 'الدين'); d('street', -.3, 'الدين'); }
    if (e.prio === 'war') { d('street', -.15, 'اقتصاد الحرب'); d('army', .1, 'اقتصاد الحرب'); } else if (e.prio === 'civ') { d('street', .1, 'الأولوية مدنية'); d('biz', .1, 'الأولوية مدنية'); }
    if (W.dip && W.dip.hz && W.dip.hz.closed) { d('biz', -.3, 'هرمز مغلق'); d('street', -.2, 'هرمز مغلق'); }
    if (W.dip && W.dip.c.us.st === 'ally0') d('mil', -.25, 'التحالف ويا أمريكا');
    if (e.civL === 'cut') { d('street', -.3, 'تقشف'); d('army', -.15, 'تقشف'); } else if (e.civL === 'more') d('street', .2, 'زيادة رواتب');
    if (e.fuel) d('street', .15, 'دعم الوقود'); if (e.mob) { d('army', .1, 'التعبئة'); d('biz', -.15, 'التعبئة'); }
    d('street', (e.mor - F.street) * .03, 'المعنويات');
    // أحداث آخر يوم
    for (let i = W.log.length - 1; i >= 0 && W.log[i].t > W.t - 24; i--) { const l = W.log[i];
      if (l.k === 'take' && W.cells[l.cell] && W.cells[l.cell].vp) { const c = W.cells[l.cell]; if (c.s === 0 && l.side === 1) { d('tribe', -c.vp * .8, 'خسرنا ' + (c.city || 'مدينة')); d('army', -c.vp * .6, 'خسرنا ' + (c.city || 'مدينة')); } if (l.side === 0) d('army', c.vp * .5, 'أخذنا ' + (c.city || 'مدينة')); }
      if (l.k === 'surrender' && l.side === 0) d('army', -2, 'فرقة استسلمت');
      if (l.k === 'dip' && l.a === 'join' && l.id === 'us' && l.side === 0) d('mil', -10, 'أمريكا دخلت ويانا');
      if (l.k === 'dip' && l.a === 'peace') d('street', 8, 'السلام'); }
    // الاستقرار يتبع الفئات والمعنويات
    const avg = FK.reduce((t, k) => t + F[k], 0) / FK.length; H.stab += ((avg * .6 + e.mor * .4) - H.stab) * .15; H.stab = Math.max(0, Math.min(100, H.stab));
    H.why = why.slice(-6);
    // الفصائل الزعلانة تضرب قاعدة
    if (A && F.mil < 25 && W.rnd() < .06) { const b = A.bases.find(x => x.side === 0 && x.n === 'عين الأسد') || A.bases.find(x => x.side === 0); if (b) { b.down = Math.max(b.down, 12); mor(W, -2); W.log.push({ t: W.t, side: 0, k: 'home', a: 'milhit', n: b.n }); } }
    // القضايا: كل 6–11 يوم، على أزعل فئة (أو عشوائي)
    if (W.t >= H.issT && H.iss.length < 2 && !W.over) { const k = W.rnd() < .7 ? FK.slice().sort((a, b) => F[a] - F[b])[0] : FK[Math.floor(W.rnd() * FK.length)];
      H.iss.push({ k, t: W.t, crit: F[k] < 25 }); H.issT = W.t + 24 * (6 + Math.floor(W.rnd() * 6)); W.log.push({ t: W.t, side: 0, k: 'home', a: 'issue', i: k }); }
    // قضية قديمة (أكثر من 5 أيام) والمستشارين يحلونها لحالهم: يدفعون إذا عندنا فلوس، وإلا الخيار الثاني
    for (let i = H.iss.length - 1; i >= 0; i--) if (!H.iss[i].crit && W.t - H.iss[i].t > 24 * 5) { ISS[H.iss[i].k].o[e.cash > 5 ? 0 : 1][1](W); W.log.push({ t: W.t, side: 0, k: 'home', a: 'auto', i: H.iss[i].k }); H.iss.splice(i, 1); }
    // طرق الخسارة (للعراق): انقلاب، ثورة، إفلاس
    const L = X && X.ECON ? X.ECON.LAND[0].lim : 15, immune = W.cfg && W.cfg.ez && W.cfg.ez.on && W.cfg.ez.immune;
    const tick = (k, bad, days, why) => { if (bad) { H.warn[k]++; if (H.warn[k] === 1 || H.warn[k] === days - 3) W.log.push({ t: W.t, side: 0, k: 'home', a: 'warn', w: k, left: days - H.warn[k] }); if (H.warn[k] >= days && !W.over && !immune) { W.over = { t: W.t, loser: 0, why }; W.log.push({ t: W.t, side: 0, k: 'capitulate', why }); } } else H.warn[k] = 0; };
    tick('coup', F.army < 20, 14, 'coup'); tick('rev', H.stab < 15, 14, 'rev'); tick('bank', e.cash < -L * 1.5, 30, 'bank');
    effects(W);
  }
  function choose(W, idx, ci) { const H = W.home, q = H.iss[idx]; if (!q) return null; H.iss.splice(idx, 1); ISS[q.k].o[ci][1](W); W.log.push({ t: W.t, side: 0, k: 'home', a: 'chose', i: q.k, c: ci }); effects(W); return ISS[q.k].o[ci][0]; }
  const API = { FAC, FK, ISS, init, ensure, effects, daily, choose };
  if (typeof module !== 'undefined') module.exports = API; else root.HOME = API;
})(this);
