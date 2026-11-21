// «العالم» v4 (I-135): «الترسانة الوطنية» — 12 سلاح نجم خاص بدولة اللاعب، بري وجوي وبحري وفضائي.
// كل واحد مشروع استراتيجي: يحتاج مستوى بحث، ياخذ سنين، يندفع أقساط شهرية من الخزينة، ولما يخلص إله أثر كبير بالحرب + هيبة.
// كلها مبنية على أسلحة حقيقية موجودة أو تنبني هسه (ref). الأرقام [تقدير]. الصور: docs/art/grok-v6-flagship.md · فحص: node tests/warsenal.test.mjs
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // cost = مليار $ (يتضرب بحجم الاقتصاد ^0.6 مثل البحث)، mo = أشهر، req = [[فرع، مستوى]...]، rq = بحوث لازم تخلص، sea = يحتاج ساحل
  const FL = {
    // I-137: الرمز فوق الاسم (حرفين + الجيل×10؛ الترسانة 50) والاسم اللي اختاره المالك
    tank:    { kind: 'دبابة', dom: 'land', ic: '🛡', code: 'ZR-50', name: 'زئير', n: 'دبابة الجيل القادم', ref: 'مثل KF51 بانثر وT-14 أرماتا', d: 'مدفع 130 ملم، حماية نشطة تفجّر الصواريخ قبل ما توصل، ومسيّرة من البرج: هجوم فرق الدروع +25٪ وقوة الجيش +6٪', cost: 12, mo: 36, req: [['arm', 5]], fx: { armAtk: .25, pwK: .06 } },
    ugv:     { kind: 'روبوت', dom: 'land', ic: '🤖', code: 'DB-50', name: 'الذئب', n: 'روبوتات قتالية', ref: 'مثل THeMIS الإستونية وUran-9 الروسية', d: 'مدرعات بلا جنود ترافق الدبابات: خسائرنا البشرية بالقتال −30٪', cost: 6, mo: 24, req: [['arm', 4], ['ind', 4]], fx: { cas: .3 } },
    hyper:   { kind: 'صاروخ', dom: 'land', ic: '☄', code: 'TQ-50', name: 'الثاقب', n: 'منظومة فرط صوتية متنقلة', ref: 'مثل DF-17 الصيني وفتّاح-2 الإيراني', d: 'صواريخنا تقريباً ما تنعترض (−60٪ اعتراض) وتضرب أقوى +30٪', cost: 15, mo: 36, req: [['msl', 6]], fx: { hyp: .6, strk: .3 } },
    ad:      { kind: 'منظومة', dom: 'land', ic: '🔆', code: 'HS-50', name: 'الحصن', n: 'قبة الليزر والصواريخ', ref: 'مثل الشعاع الحديدي وسيبر وS-400', d: 'دفاع جوي بطبقات ويا ليزر: اعتراض الصواريخ والمسيّرات +35٪، وصواريخ الدفاع أدق +20٪', cost: 14, mo: 30, req: [['msl', 5], ['ew', 5]], fx: { adI: .35, samPk: .2 } },
    fighter: { kind: 'مقاتلة', dom: 'air', ic: '✈', code: 'SF-50', name: 'سيف الله', n: 'الشبحية الوطنية وجناحها الوفي', ref: 'مثل KAAN ويا أنكا-3، وF-35 ويا مسيّرات CCA', d: 'مقاتلة جيل خامس تطير وياها مسيّرات مقاتلة: قوة الجيش +10٪', cost: 25, mo: 60, req: [['ind', 5], ['ew', 5]], fx: { pwK: .1 } },
    bomber:  { kind: 'قاذفة', dom: 'air', ic: '🦇', code: 'YB-50', name: 'اليرموك', n: 'القاذفة الشبحية المسيّرة', ref: 'مثل B-21 رايدر', d: 'تضرب عمق العدو (مطارات ومصانع): ضرباتنا أقوى +40٪ وقوة الجيش +4٪', cost: 20, mo: 48, req: [['uav', 5], ['ew', 5]], rq: ['stealth'], fx: { strk: .4, pwK: .04 } },
    swarm:   { kind: 'سرب', dom: 'air', ic: '🐝', code: 'QD-50', name: 'القادسية', n: 'سرب المسيّرات الانتحارية', ref: 'مثل تجارب الأسراب الحقيقية', d: 'عشرات المسيّرات تطلع سوا وتغرّق دفاع العدو: إنتاج المسيّرات ×1.6 و+300 مسيّرة فوراً', cost: 4, mo: 18, req: [['uav', 5]], fx: { drnK: .6, drn: 300 } },
    carrier: { kind: 'حاملة', dom: 'sea', ic: '🛳', code: 'FQ-50', name: 'الفاروق', n: 'حاملة المسيّرات', ref: 'مثل «أناضول» التركية و«شهيد باقري» الإيرانية', d: 'سفينة سطحها مليان مسيّرات مقاتلة: حاملة جديدة بأسطولنا تطلّع طيران بأي بحر', cost: 18, mo: 48, req: [['ind', 5], ['uav', 5]], sea: 1, fx: { ships: { cv: 1, ff: 2 } } },
    destroyer:{ kind: 'مدمرة', dom: 'sea', ic: '⚓', code: 'UQ-50', name: 'عُقبة', n: 'المدمرة الثقيلة', ref: 'مثل Type 055 الصينية وسيجونغ الكورية', d: 'ترمي من عشرات الخلايا بنفس الوقت: مدمرتين ثقال بأسطولنا ودفاع جوي بحري', cost: 14, mo: 42, req: [['ind', 5], ['msl', 5]], sea: 1, fx: { ships: { dd: 2 } } },
    sub:     { kind: 'غواصة', dom: 'sea', ic: '🌊', code: 'TR-50', name: 'طارق', n: 'الغواصة ويا غواصتها المسيّرة', ref: 'مثل غواصات AIP وOrca XLUUV', d: 'تكسر الحصار وتغرق ناقلات العدو: غواصتين هجوميتين حديثتين', cost: 12, mo: 48, req: [['ind', 5]], sea: 1, fx: { ships: { ssn: 2 } } },
    usv:     { kind: 'زوارق', dom: 'sea', ic: '🚤', code: 'DS-50', name: 'ذات الصواري', n: 'الزوارق المسيّرة الانتحارية', ref: 'مثل الزوارق المسيّرة اللي غيّرت حرب البحر الأسود', d: 'تقفل مضيق بلا خسائر بشرية: 8 زوارق صواريخ مسيّرة', cost: 3, mo: 18, req: [['uav', 4]], sea: 1, fx: { ships: { fac: 8 } } },
    space:   { kind: 'قمر', dom: 'space', ic: '🛰', code: 'RQ-50', name: 'الرقيب', n: 'صاروخ الفضاء وقمر التجسس', ref: 'برامج فضاء وطنية حقيقية', d: 'نشوف كل شي (ماكو ضباب بالبحر)، والبحث أسرع +5٪', cost: 10, mo: 36, req: [['ind', 4]], rq: ['tele'], fx: { sat: 1, rs: .05 } },
  };
  // I-137: الاسم اللي يطلع = النوع + الاسم («دبابة زئير»، «مدمرة الطوفان») ويا الرمز فوقه
  const title = k => { const f = FL[k]; return f.name ? `${f.kind} ${f.name}` : f.n; };
  // I-138: عائلات السلاح الوطني (31 نوع) — الرمز = حرفين + الجيل×10 (50 = الترسانة ⭐). img = صورة الإعلان (v6 للترسانة، v7 للباقي)
  const FAM = [
    ['land', 'دبابة', 'ZR', 'زئير', 'v6_fl_tank', 'tank'], ['land', 'دبابة خفيفة', 'DH', 'ضِرار', 'v7_fm_dh'], ['land', 'مدرعة', 'LT', 'الليث', 'v7_fm_lt'], ['land', 'ناقلة جنود', 'SK', 'الصخرة', 'v7_fm_sk'],
    ['land', 'مدفعية', 'HT', 'حِطّين', 'v7_fm_ht'], ['land', 'راجمة', 'WB', 'الوابل', 'v7_fm_wb'], ['land', 'روبوت', 'DB', 'الذئب', 'v6_fl_ugv', 'ugv'],
    ['air', 'مقاتلة', 'SF', 'سيف الله', 'v6_fl_fighter', 'fighter'], ['air', 'مقاتلة خفيفة', 'NS', 'نسر', 'v7_fm_ns'], ['air', 'طيارة هجوم', 'ZB', 'الزبير', 'v7_fm_zb'], ['air', 'قاذفة', 'YB', 'اليرموك', 'v6_fl_bomber', 'bomber'],
    ['air', 'مروحية', 'AF', 'العاصفة', 'v7_fm_af'], ['air', 'طيارة تدريب', 'SB', 'الشِّبل', 'v7_fm_sb'], ['air', 'طيارة نقل', 'RH', 'الرحّال', 'v7_fm_rh'], ['air', 'مسيّرة', 'ZL', 'الظل', 'v7_fm_zl'], ['air', 'سرب', 'QD', 'القادسية', 'v6_fl_swarm', 'swarm'],
    ['sea', 'حاملة', 'FQ', 'الفاروق', 'v6_fl_dronecarrier', 'carrier'], ['sea', 'مدمرة', 'UQ', 'عُقبة', 'v6_fl_destroyer', 'destroyer'], ['sea', 'فرقاطة', 'MJ', 'الموج', 'v7_fm_mj'], ['sea', 'كورفيت', 'AS', 'الإعصار', 'v7_fm_as'],
    ['sea', 'غواصة', 'TR', 'طارق', 'v6_fl_sub', 'sub'], ['sea', 'زوارق', 'DS', 'ذات الصواري', 'v6_fl_usv', 'usv'], ['sea', 'سفينة إنزال', 'JS', 'الجسر', 'v7_fm_js'],
    ['msl', 'صاروخ', 'TQ', 'الثاقب', 'v6_fl_hyper', 'hyper'], ['msl', 'صاروخ باليستي', 'NZ', 'النيزك', 'v7_fm_nz'], ['msl', 'صاروخ كروز', 'SH', 'السهم', 'v7_fm_sh'], ['msl', 'صاروخ مضاد سفن', 'QS', 'القرش', 'v7_fm_qs'],
    ['msl', 'منظومة', 'HS', 'الحصن', 'v6_fl_ad', 'ad'], ['msl', 'دفاع جوي', 'DR', 'الدرع', 'v7_fm_dr'], ['space', 'قمر', 'RQ', 'الرقيب', 'v6_fl_space', 'space'], ['space', 'صاروخ فضاء', 'MR', 'المعراج', 'v7_fm_mr'],
  ].map(([dom, kind, code, name, img, fl]) => ({ dom, kind, code, name, img, fl }));
  const DOM = { land: ['🛡', 'البر'], air: ['✈', 'الجو'], sea: ['⚓', 'البحر'], msl: ['🚀', 'الصواريخ والدفاع الجوي'], space: ['🛰', 'الفضاء'] };
  const MAXRUN = 2;
  function ensure(G) { if (!G.ars) G.ars = { done: {}, run: [] }; return G.ars; }
  const kOf = G => (G.nat && G.nat.ind[0].k) || 1;
  // بحث «صاروخ الفضاء الوطني» يرخّص قمر الرقيب −30٪
  const costOf = (G, k) => +(FL[k].cost * kOf(G) * (k === 'space' && G.res3 && G.res3.done && G.res3.done.launch ? .7 : 1)).toFixed(1);
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
    if (G.nat) { const N = G.nat.natShips = G.nat.natShips || {}; for (const t in ships) N[t] = (N[t] || 0) + ships[t]; }
  }

  // ===== M2 (I-128، I-138): الإنتاج الوطني — 21 نوع من العائلة تنطلب من الإنتاج، وجيلها من بحثنا (الرقم = الجيل×10) =====
  // cat: div فرقة · plane طيارات · sam صواريخ دفاع · nav سفن (تنضاف للأسطول) · msl صواريخ/مسيّرات/ضد سفن (مخزون). br = فرع البحث اللي يحدد الجيل. [تقدير]
  const PROD = {
    ZR: { cat: 'div', kind: 'arm', br: 'arm', cost: 2.4, days: 45, pw: 1.3, d: 'فرقة دبابات رئيسية' }, DH: { cat: 'div', kind: 'arm', br: 'arm', cost: 1.6, days: 35, pw: .8, d: 'دبابات خفيفة سريعة للاستطلاع' },
    LT: { cat: 'div', kind: 'mec', br: 'arm', cost: 1.5, days: 30, pw: 1.1, d: 'مدرعات قتال مشاة' }, SK: { cat: 'div', kind: 'mec', br: 'arm', cost: 1.1, days: 25, pw: .9, d: 'ناقلات جنود محمية' },
    HT: { cat: 'div', kind: 'mec', br: 'ind', cost: 1.4, days: 30, pw: 1, d: 'كتائب مدفعية ذاتية' }, WB: { cat: 'div', kind: 'mec', br: 'msl', cost: 1.3, days: 28, pw: 1, d: 'كتائب راجمات دقيقة' },
    SF: { cat: 'plane', plane: 'f16', q: 2, br: 'ew', cost: .45, days: 120, pw: 2.5, d: 'مقاتلات شبحية ×2' }, NS: { cat: 'plane', plane: 'f16', q: 2, br: 'ind', cost: .2, days: 60, pw: 1.3, d: 'مقاتلات خفيفة ×2' },
    ZB: { cat: 'plane', plane: 'su25', q: 2, br: 'ind', cost: .12, days: 45, pw: 1.1, d: 'طيارات هجوم أرضي ×2' }, AF: { cat: 'plane', plane: 'su25', q: 2, br: 'ind', cost: .08, days: 40, pw: 1, d: 'مروحيات هجومية ×2' },
    ZL: { cat: 'plane', plane: 'ch4', q: 2, br: 'uav', cost: .03, days: 15, pw: 1, d: 'مسيّرات هجومية كبيرة ×2' }, QD: { cat: 'msl', drn: 60, br: 'uav', cost: .02, days: 10, pw: 1, d: '60 مسيّرة انتحارية' },
    UQ: { cat: 'nav', ships: { dd: 1 }, br: 'ind', cost: 1.6, days: 540, pw: 1, d: 'مدمرة صواريخ تنضاف لأسطولنا' }, MJ: { cat: 'nav', ships: { ff: 1 }, br: 'ind', cost: .7, days: 420, pw: 1, d: 'فرقاطة تنضاف لأسطولنا' },
    AS: { cat: 'nav', ships: { fac: 2 }, br: 'ind', cost: .25, days: 240, pw: 1, d: 'كورفيتين' }, TR: { cat: 'nav', ships: { ss: 1 }, br: 'ind', cost: .9, days: 600, pw: 1, d: 'غواصة' }, JS: { cat: 'nav', ships: { amp: 1 }, br: 'ind', cost: .5, days: 420, pw: 1, d: 'سفينة إنزال' },
    NZ: { cat: 'msl', msl: 20, br: 'msl', cost: .1, days: 30, pw: 1, d: '20 صاروخ باليستي' }, SH: { cat: 'msl', msl: 12, br: 'msl', cost: .06, days: 25, pw: 1, d: '12 صاروخ كروز' },
    QS: { cat: 'msl', asm: 16, br: 'msl', cost: .05, days: 25, pw: 1, d: '16 صاروخ ضد السفن' }, DR: { cat: 'sam', pool: '57E6', q: 24, br: 'msl', cost: .008, days: 20, pw: 1, d: '24 صاروخ دفاع جوي قصير' },
  };
  // الجيل من مستوى البحث: 1 ← جيل 1، 2–3 ← 2، 4 ← 3، 5–6 ← 4
  const genOf = (G, br) => { const t = (G.nat && G.nat.ind[0].tech[br]) || 0; return t >= 5 ? 4 : t >= 4 ? 3 : t >= 2 ? 2 : t >= 1 ? 1 : 0; };
  function register(G, WD, ECON) {
    for (const code in PROD) { const P = PROD[code], f = FAM.find(x => x.code === code), g = genOf(G, P.br), key = 'nf_' + code;
      if (g < 1 || (P.cat === 'nav' && !coast(G, WD))) { delete ECON.ITEMS[key]; continue; }
      const k = .7 + .15 * g;
      ECON.ITEMS[key] = { n: `${code}-${g * 10} ${f.kind} ${f.name}`, ic: ({ land: '🛡', air: '✈', sea: '⚓', msl: '🚀' })[f.dom] || '⭐', cat: P.cat, kind: P.kind, plane: P.plane, q: P.q, pool: P.pool, side: 0,
        cost: +(P.cost * k).toFixed(3), days: P.days, nat: code, gen: g, img: f.img, pwF: +(P.pw * (.6 + .2 * g)).toFixed(2), d: `${P.d} · صنع وطني 100٪ (ما يحتاج قطع من برّا)` };
      // النسخ (مثل T-90A/M/S): M مطوّرة (جيل 3+)، K قيادة (للفرق)، E تصدير (تنباع لدولة صديقة أول ما تخلص)
      const base = ECON.ITEMS[key], V = { M: g >= 3, K: P.cat === 'div', E: P.cat !== 'msl' };
      for (const v of ['M', 'K', 'E']) { const vk = key + '_' + v; if (!V[v]) { delete ECON.ITEMS[vk]; continue; }
        const m = { M: [1.25, 1.15, 1.25, 'المطوّرة', 'أقوى +25٪: حماية وإلكترونيات أحدث'], K: [1.3, 1.1, 1.1, 'القيادة', 'نسخة قيادة: اتصالات وتنسيق، كل وحدة ترفع قوة الجيش كله +0.4٪ (لحد 6٪)'], E: [.9, 1, 0, 'للتصدير', 'نسخة تصدير: أول ما تخلص تنباع لدولة صديقة بربح ~45٪ وعلاقة +3'] }[v];
        ECON.ITEMS[vk] = { ...base, n: `${code}-${g * 10}${v} ${f.kind} ${f.name} ${m[3]}`, cost: +(base.cost * m[0]).toFixed(3), days: Math.round(base.days * m[1]), pwF: +(base.pwF * (m[2] || 0)).toFixed(2), var: v, d: m[4] }; } }
  }
  // التسليم (ينادى من nation.deliver للمنتجات الوطنية)
  function deliver(G, WD, it, T) {
    const c = G.C[G.me], P = PROD[it.nat], NW = G.nat; NW.arms = NW.arms || { jets: {}, sam: {}, tank: null };
    // نسخة التصدير: تنباع فوراً لأقرب صديق (علاقة 25+ ومو بحرب ويانا)
    if (it.var === 'E') { const S = root.WSIM || require('./wsim.js'), buyer = G.ids.filter(x => x !== G.me && S.rel(G, G.me, x) >= 25 && !S.atWar(G, G.me, x)).sort((a, b) => S.rel(G, G.me, b) - S.rel(G, G.me, a))[0];
      if (buyer) { const v = +(it.cost * 1.45).toFixed(3); NW.eco[0].cash += v; S.addRel(G, G.me, buyer, 3); G.log.push({ t: G.t, k: 'natsell', x: buyer, n: it.n, v }); return; } }
    if (it.var === 'K') c.pwK = Math.min(1.5, (c.pwK || 1) + .004);
    // نسجّل السلاح الوطني اللي عدنا (للرسم على الخريطة: الدبابة والسفن بشكلها)
    NW.natHave = NW.natHave || {}; NW.natHave[it.nat] = (NW.natHave[it.nat] || 0) + 1;
    if (it.cat === 'div') c.pw += 30 * it.pwF * (it.kind === 'arm' ? 1.5 : 1);
    else if (it.cat === 'plane') { c.pw += (it.q || 1) * 3 * it.pwF; if (!T) NW.arms.jets[it.plane] = (NW.arms.jets[it.plane] || 0) + (it.q || 1); }
    else if (it.cat === 'sam') { NW.samStock = NW.samStock || {}; NW.samStock[it.pool] = (NW.samStock[it.pool] || 0) + it.q; }
    else if (it.cat === 'nav' && G.nav) addShips(G, WD, P.ships);
    else if (it.cat === 'msl') { if (P.msl) c.msl = (c.msl || 0) + P.msl; if (P.drn) c.drn = (c.drn || 0) + P.drn; if (P.asm && G.nav) { G.nav.asm = G.nav.asm || {}; G.nav.asm[G.me] = (G.nav.asm[G.me] || 0) + P.asm; } }
  }
  // للمسرح: هجوم الدروع ودقة الدفاع الجوي (nation.js يضربها بـ indF كل يوم)
  function indF(G, F) { const A = G.ars; if (!A || !F) return; if (A.done.tank) F.armAtk *= 1 + FL.tank.fx.armAtk; if (A.done.ad) F.samPk *= 1 + FL.ad.fx.samPk; }
  // الخسائر: الروبوتات تنقص خسائرنا البشرية
  const casK = G => (G.ars && G.ars.done.ugv ? 1 - FL.ugv.fx.cas : 1);
  const API = { FL, FAM, DOM, PROD, addShips, genOf, register, deliver, title, MAXRUN, ensure, costOf, can, start, month, apply, indF, casK };
  if (typeof module !== 'undefined') module.exports = API; else root.WARS = API;
})(typeof window !== 'undefined' ? window : globalThis);
