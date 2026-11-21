// «العالم» v4 (I-135): «الترسانة الوطنية» — 12 سلاح نجم خاص بدولة اللاعب، بري وجوي وبحري وفضائي.
// كل واحد مشروع استراتيجي: يحتاج مستوى بحث، ياخذ سنين، يندفع أقساط شهرية من الخزينة، ولما يخلص إله أثر كبير بالحرب + هيبة.
// كلها مبنية على أسلحة حقيقية موجودة أو تنبني هسه (ref). الأرقام [تقدير]. الصور: docs/art/grok-v6-flagship.md · فحص: node tests/warsenal.test.mjs
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // cost = مليار $ (يتضرب بحجم الاقتصاد ^0.6 مثل البحث)، mo = أشهر، req = [[فرع، مستوى]...]، rq = بحوث لازم تخلص، sea = يحتاج ساحل
  const FL = {
    tank:    { dom: 'land', ic: '🛡', n: 'دبابة الجيل القادم', ref: 'مثل KF51 بانثر وT-14 أرماتا', d: 'مدفع 130 ملم، حماية نشطة تفجّر الصواريخ قبل ما توصل، ومسيّرة من البرج: هجوم فرق الدروع +25٪ وقوة الجيش +6٪', cost: 12, mo: 36, req: [['arm', 5]], fx: { armAtk: .25, pwK: .06 } },
    ugv:     { dom: 'land', ic: '🤖', n: 'روبوتات قتالية', ref: 'مثل THeMIS الإستونية وUran-9 الروسية', d: 'مدرعات بلا جنود ترافق الدبابات: خسائرنا البشرية بالقتال −30٪', cost: 6, mo: 24, req: [['arm', 4], ['ind', 4]], fx: { cas: .3 } },
    hyper:   { dom: 'land', ic: '☄', n: 'منظومة فرط صوتية متنقلة', ref: 'مثل DF-17 الصيني وفتّاح-2 الإيراني', d: 'صواريخنا تقريباً ما تنعترض (−60٪ اعتراض) وتضرب أقوى +30٪', cost: 15, mo: 36, req: [['msl', 6]], fx: { hyp: .6, strk: .3 } },
    ad:      { dom: 'land', ic: '🔆', n: 'قبة الليزر والصواريخ', ref: 'مثل الشعاع الحديدي وسيبر وS-400', d: 'دفاع جوي بطبقات ويا ليزر: اعتراض الصواريخ والمسيّرات +35٪، وصواريخ الدفاع أدق +20٪', cost: 14, mo: 30, req: [['msl', 5], ['ew', 5]], fx: { adI: .35, samPk: .2 } },
    fighter: { dom: 'air', ic: '✈', n: 'الشبحية الوطنية وجناحها الوفي', ref: 'مثل KAAN ويا أنكا-3، وF-35 ويا مسيّرات CCA', d: 'مقاتلة جيل خامس تطير وياها مسيّرات مقاتلة: قوة الجيش +10٪', cost: 25, mo: 60, req: [['ind', 5], ['ew', 5]], fx: { pwK: .1 } },
    bomber:  { dom: 'air', ic: '🦇', n: 'القاذفة الشبحية المسيّرة', ref: 'مثل B-21 رايدر', d: 'تضرب عمق العدو (مطارات ومصانع): ضرباتنا أقوى +40٪ وقوة الجيش +4٪', cost: 20, mo: 48, req: [['uav', 5], ['ew', 5]], rq: ['stealth'], fx: { strk: .4, pwK: .04 } },
    swarm:   { dom: 'air', ic: '🐝', n: 'سرب المسيّرات الانتحارية', ref: 'مثل تجارب الأسراب الحقيقية', d: 'عشرات المسيّرات تطلع سوا وتغرّق دفاع العدو: إنتاج المسيّرات ×1.6 و+300 مسيّرة فوراً', cost: 4, mo: 18, req: [['uav', 5]], fx: { drnK: .6, drn: 300 } },
    carrier: { dom: 'sea', ic: '🛳', n: 'حاملة المسيّرات', ref: 'مثل «أناضول» التركية و«شهيد باقري» الإيرانية', d: 'سفينة سطحها مليان مسيّرات مقاتلة: حاملة جديدة بأسطولنا تطلّع طيران بأي بحر', cost: 18, mo: 48, req: [['ind', 5], ['uav', 5]], sea: 1, fx: { ships: { cv: 1, ff: 2 } } },
    destroyer:{ dom: 'sea', ic: '⚓', n: 'المدمرة الثقيلة', ref: 'مثل Type 055 الصينية وسيجونغ الكورية', d: 'ترمي من عشرات الخلايا بنفس الوقت: مدمرتين ثقال بأسطولنا ودفاع جوي بحري', cost: 14, mo: 42, req: [['ind', 5], ['msl', 5]], sea: 1, fx: { ships: { dd: 2 } } },
    sub:     { dom: 'sea', ic: '🌊', n: 'الغواصة ويا غواصتها المسيّرة', ref: 'مثل غواصات AIP وOrca XLUUV', d: 'تكسر الحصار وتغرق ناقلات العدو: غواصتين هجوميتين حديثتين', cost: 12, mo: 48, req: [['ind', 5]], sea: 1, fx: { ships: { ssn: 2 } } },
    usv:     { dom: 'sea', ic: '🚤', n: 'الزوارق المسيّرة الانتحارية', ref: 'مثل الزوارق المسيّرة اللي غيّرت حرب البحر الأسود', d: 'تقفل مضيق بلا خسائر بشرية: 8 زوارق صواريخ مسيّرة', cost: 3, mo: 18, req: [['uav', 4]], sea: 1, fx: { ships: { fac: 8 } } },
    space:   { dom: 'space', ic: '🛰', n: 'صاروخ الفضاء وقمر التجسس', ref: 'برامج فضاء وطنية حقيقية', d: 'نشوف كل شي (ماكو ضباب بالبحر)، والبحث أسرع +5٪', cost: 10, mo: 36, req: [['ind', 4]], rq: ['tele'], fx: { sat: 1, rs: .05 } },
  };
  const DOM = { land: ['🛡', 'البر'], air: ['✈', 'الجو'], sea: ['⚓', 'البحر'], space: ['🛰', 'الفضاء'] };
  const MAXRUN = 2;
  function ensure(G) { if (!G.ars) G.ars = { done: {}, run: [] }; return G.ars; }
  const kOf = G => (G.nat && G.nat.ind[0].k) || 1;
  const costOf = (G, k) => +(FL[k].cost * kOf(G)).toFixed(1);
  const coast = (G, WD) => WD.r.some((r, i) => G.ctl[i] === G.me && (r[8] || []).length);
  function can(G, WD, k) {
    const f = FL[k], A = ensure(G); if (!f) return 'غلط'; if (A.done[k]) return 'بالخدمة'; if (A.run.some(q => q.k === k)) return 'ينبني';
    if (A.run.length >= MAXRUN) return `${MAXRUN} مشاريع كبرى تنبني (الحد)`;
    const I = G.nat.ind[0], IND = root.IND || require('./gwind.js'), RD = G.res3 && G.res3.done || {}, RES = root.WRES || require('./wres.js');
    const miss = (f.req || []).filter(([b, l]) => (I.tech[b] || 0) < l).map(([b, l]) => `«${IND.BR[b].n}» ${l}`).concat((f.rq || []).filter(r => !RD[r]).map(r => `بحث «${RES.T[r].n}»`));
    if (miss.length) return 'يحتاج: ' + miss.join('، ');
    if (f.sea && !coast(G, WD)) return 'ماكو ساحل';
    return null;
  }
  function start(G, WD, k) { const err = can(G, WD, k); if (err) return err; const A = ensure(G), c = costOf(G, k); A.run.push({ k, t0: G.t, mo: FL[k].mo, cost: c, paid: 0 }); G.log.push({ t: G.t, k: 'ars', a: 'start', f: k, v: c }); return { ok: true }; }
  // كل شهر: قسط من الخزينة، والمشروع اللي كمل يدخل الخدمة
  function month(G, WD) {
    if (!G.nat) return; const A = ensure(G), e = G.nat.eco[0];
    for (const q of A.run.slice()) { const inst = q.cost / q.mo; e.cash -= inst; q.paid += inst;
      if (G.t - q.t0 >= q.mo * 30.4 - 1) { A.run.splice(A.run.indexOf(q), 1); A.done[q.k] = G.t; apply(G, WD, q.k); G.log.push({ t: G.t, k: 'ars', a: 'done', f: q.k }); } }
  }
  function apply(G, WD, k) {
    const f = FL[k].fx, c = G.C[G.me];
    if (f.pwK) c.pwK = (c.pwK || 1) + f.pwK;
    if (f.hyp) c.hyp = Math.min(.9, (c.hyp || 0) + f.hyp);
    if (f.strk) c.strk = (c.strk || 1) + f.strk;
    if (f.adI) c.adI = (c.adI || 0) * (1 + f.adI);
    if (f.drnK) c.drnP = (c.drnP || 0) * (1 + f.drnK);
    if (f.drn) c.drn = (c.drn || 0) + f.drn;
    if (f.sat) c.sat = 1;
    if (f.rs && G.res3) G.res3.rs = (G.res3.rs || 0) + f.rs;
    if (f.ships && G.nav) addShips(G, WD, f.ships);
    // الهيبة: الشعب يفخر، والحلفاء يقربون
    if (G.nat.home) { const b = G.nat.home.base || (G.nat.home.base = {}); b.street = Math.min(85, (b.street || 55) + 3); }
    const S = root.WSIM || require('./wsim.js'); for (const x of G.ids) if (x !== G.me && S.allied(G, G.me, x)) S.addRel(G, G.me, x, 5);
  }
  // السفن الجديدة تنضاف لأكبر أسطول عدنا، وإذا ماكو أسطول ينبني واحد جديد بأقرب بحر لساحلنا
  function addShips(G, WD, ships) {
    let g = G.nav.g.filter(x => x.cc === G.me).sort((a, b) => Object.values(b.s).reduce((t, v) => t + v, 0) - Object.values(a.s).reduce((t, v) => t + v, 0))[0];
    if (!g) { let z = -1; for (let i = 0; i < WD.r.length && z < 0; i++) if (G.ctl[i] === G.me) for (const sid of WD.r[i][8] || []) { const k = WD.s.findIndex(q => q[0] === sid); if (k >= 0) { z = k; break; } }
      if (z < 0) return; g = { id: Math.max(0, ...G.nav.g.map(x => x.id)) + 1, cc: G.me, s: {}, s0: {}, z, home: z, path: [], prog: 0, mode: 'patrol', dmg: 0, man: 0 }; G.nav.g.push(g); }
    for (const t in ships) { g.s[t] = (g.s[t] || 0) + ships[t]; g.s0[t] = (g.s0[t] || 0) + ships[t]; }
  }
  // للمسرح: هجوم الدروع ودقة الدفاع الجوي (nation.js يضربها بـ indF كل يوم)
  function indF(G, F) { const A = G.ars; if (!A || !F) return; if (A.done.tank) F.armAtk *= 1 + FL.tank.fx.armAtk; if (A.done.ad) F.samPk *= 1 + FL.ad.fx.samPk; }
  // الخسائر: الروبوتات تنقص خسائرنا البشرية
  const casK = G => (G.ars && G.ars.done.ugv ? 1 - FL.ugv.fx.cas : 1);
  const API = { FL, DOM, MAXRUN, ensure, costOf, can, start, month, apply, indF, casK };
  if (typeof module !== 'undefined') module.exports = API; else root.WARS = API;
})(typeof window !== 'undefined' ? window : globalThis);
