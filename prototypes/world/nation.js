// «العالم» (D-050، I-105): طبقة الدولة = أنظمة «الحرب الكبرى» نفسها على دولة اللاعب:
//  - الداخل: home.js (الفئات حسب نظام الحكم، القضايا بقرارات، الانقلاب والثورة والإفلاس)
//  - التصنيع والبحث: ind.js (5 فروع، منتجات محلية، سلاح وطني، قطاعات، مشاريع كبرى)
//  - الإنتاج: econ.js (طلب فرق وطيارات وصواريخ دفاع جوي وخطوط إنتاج، المورّد وقطع الغيار، أولوية الاقتصاد، المعنويات)
// الحالة بـ G.nat بنفس شكل «الحرب الكبرى» (W.eco[0]، W.ind[0]، W.home)، والطرف 1 = الخصم الرئيسي (أو لا أحد).
// فحص: node tests/nation.test.mjs
(function (root) {
  'use strict';
  const req = typeof require !== 'undefined' ? require : null;
  const CAS = root.WCAS || (req ? req('./wcas.js') : null);   // v3 C1: الخسائر من المسرح
  const RES = root.WRES || (req ? req('./wres.js') : null);   // v3 R: شجرة البحث الموحّدة
  const HOME = root.HOME || req('./gwhome.js'), IND = root.IND || req('./gwind.js'), ECON = root.ECON || req('./gwecon.js'), AIR = root.AIR || req('./gwair.js');
  const CAT = root.AIRCAT || req('./aircat.js'), ADV = root.ADV || req('./gwadvise.js'), GRADE = root.GRADE || req('./gwgrade.js'), MKT = root.WMKT || req('./wmkt.js'), CMD = root.WCMD || req('./wcmd.js');
  // الفئات حسب نظام الحكم (نفس data/world/SCHEMA.md و build_country.py)، والعراق بفئاته الأصلية
  const FACS = { theo: ['clergy', 'irgc', 'army', 'street', 'biz'], amon: ['royal', 'army', 'clergy', 'street', 'biz'], one: ['party', 'army', 'street', 'biz'], mil: ['army', 'militia', 'street', 'biz'],
    auth: ['army', 'security', 'street', 'biz'], trans: ['army', 'factions', 'street', 'biz'], cmon: ['army', 'parties', 'street', 'biz'], parl: ['army', 'parties', 'street', 'biz'], pres: ['army', 'parties', 'street', 'biz'], semi: ['army', 'parties', 'street', 'biz'] };
  // المورّد من اسم الموديل [تقدير]
  const SUPRX = [[/abrams|m1a|f-16|f-15|f-35|f\/a-18|hornet|patriot|pac-|nasams|hawk|mim-|thaad|m109|m113|bradley|himars|apache|black hawk|uh-60|ah-64|stryker|m60|m48/i, 'USA'], [/leopard|iris-t|pzh|puma|boxer|marder/i, 'DEU'],
    [/rafale|leclerc|samp|aster|caesar|mirage|vab|vbci|crotale/i, 'FRA'], [/typhoon|eurofighter|tornado/i, 'EUR'], [/challenger|warrior|storm shadow/i, 'GBR'], [/gripen|cv90|archer|stridsvagn/i, 'SWE'],
    [/t-72|t-90|t-80|t-62|t-55|t-54|bmp|btr|su-|mig-|s-300|s-400|buk|pantsir|\btor\b|kub|9m\d|48n6|5v\d|v-60|3m9|57e6|s-125|osa|tunguska|mi-8|mi-17|mi-24|mi-35|ka-52|2s|bm-21|grad|smerch|iskander|lion of babylon/i, 'RUS'],
    [/type \d|j-10|j-11|j-16|j-20|jf-17|hq-|vt-4|ch-4|ch-5|wing loong|pl-|z-10|z-9|plz/i, 'CHN'], [/k2|k9|k21|fa-50|t-50|kf-21|cheongung|km-sam/i, 'KOR'], [/merkava|arrow|iron dome|barak|spyder|david|namer|heron|hermes/i, 'ISR'],
    [/altay|bayraktar|tb2|akinci|t129|kirpi|ejder|cobra|fnss|otokar/i, 'TUR']];
  let SUP0c = null; const SUPID = { us: 'USA', ru: 'RUS', cn: 'CHN' };
  const SUP0 = () => SUP0c || (SUP0c = Object.fromEntries(Object.entries(ECON.SUPPLY[0] || {}).map(([k, v]) => [k, SUPID[v] || v])));
  const EUR = ['DEU', 'GBR', 'ITA', 'ESP'];   // اليوروفايتر والتورنادو: شراكة
  const supOf = (m, me) => { const r = (SUPRX.find(([rx]) => rx.test(m || '')) || [0, null])[1]; return r === 'EUR' ? (EUR.includes(me) ? null : 'GBR') : r; };
  const PCOST = { f35: .22, j20: .25, f15: .2, euro: .2, f18: .14, f16: .14, flanker: .1, su34: .1, light: .08, su24: .05, su25: .05, jet_tr: .05, old: .03, f14: .06, tb2: .02 };
  const MCOST = { long: .004, medium: .0015, short: .0003 };   // مليار للصاروخ الواحد [تقدير]
  const NI = { arm: 'دروع', uav: 'مسيّرات', msl: 'صواريخ', ew: 'إلكترونيات', ind: 'صناعة' };
  // ===== البداية =====
  function init(G, WD) {
    const me = G.me, cs = WD.cs[me], c = G.C[me], gt = cs.gt || 'parl';
    const NW = { t: G.t * 24, log: [], lim: Math.max(2, c.gdp * .06), patron: null, cfg: {} };
    Object.defineProperty(NW, 'rnd', { value: G.rnd || Math.random, writable: true, enumerable: false, configurable: true });
    // الاقتصاد (شكل econ.js): الخزينة 8٪ من الناتج (حد 400 مليار)، المعنويات من الاستقرار، خطوط الإنتاج حسب حجم الصناعة
    const tech = cs.tech || {}, lines = 2 + Math.min(5, Math.round((tech.ind || 1) + Math.log10(Math.max(1, c.gdp)) - 1));
    const eco = o => ({ cash: o.cash, mor: o.mor, prio: 'bal', lines: o.lines, q: [], oid: 1, auto: false, day: 0, last: null, hist: [], morWhy: [] });
    NW.eco = [eco({ cash: Math.min(400, c.gdp * .08), mor: Math.round(c.stab), lines }), eco({ cash: 10, mor: 55, lines: 3 })];
    // الداخل: فئات نظام الحكم (العراق بفئاته الأصلية)، والبداية حول الاستقرار الحالي
    const fk = me === 'IRQ' ? HOME.FK : FACS[gt] || FACS.parl, base = Math.round(c.stab);
    HOME.init(NW, { fk, stab: base, fac: Object.fromEntries(fk.map((k, i) => [k, Math.max(15, Math.min(85, base + [6, -4, 2, -2, 0][i % 5]))])) });
    NW.home.base = { ...NW.home.fac }; NW.home.revR = .02; NW.home.gap = [18, 14];   // سنين مو أشهر: الفئات ترجع لوضعها، وقضية كل 18–31 يوم [تقدير]
    NW.home.costK = Math.max(.1, Math.min(20, c.gdp / 250));   // سنين مو أشهر: الفئات ترجع لوضعها (نص الفرق بـ~70 يوم) [تقدير]
    // التصنيع والبحث: مستويات البداية من بيانات الدولة (W1/W4)، والطرف 1 من خصمها الرئيسي إذا بحرب
    IND.init(NW); const t0 = k => Math.max(0, Math.min(5, Math.round(k || 0)));
    NW.ind[0].tech = { arm: t0(tech.arm), uav: t0(tech.uav), msl: t0(tech.msl), ew: t0(tech.ew), ind: t0(tech.ind ?? 1) }; NW.ind[0].bud = 1; NW.ind[0].nat.name = '';
    NW.start0 = { ...NW.ind[0].tech };
    G.nat = NW; catalog(G, WD); return NW;   // NW.g0 (لقطة البداية للتقييم) تنأخذ أول ما ينحسب التقييم
  }
  // كتالوج الطلبات لهالدولة (فوك كتالوج econ.js): الفرق والخطوط نفسها، والطيارات من أنواع قوتها الجوية، والصواريخ لبطارياتها
  function catalog(G, WD) {
    const me = G.me, cs = WD.cs[me], I = ECON.ITEMS, aw = (WD.aw || {})[me]; IND.register(ECON);
    if (me !== 'IRQ') for (const k of Object.keys(I)) if (I[k].side === 0 && !I[k].req) delete I[k];
    for (const k of Object.keys(I)) if (I[k].side === 1) delete I[k];
    for (const k of Object.keys(I)) if (/^(pl_|sm_)/.test(k)) delete I[k];
    SUP0(); ECON.SUPPLY[0] = {};
    const tsup = supOf(((cs.kit || {}).tank || [0, []])[1].join(' '), me), asup = supOf(((cs.kit || {}).afv || [0, []])[1].join(' '), me);
    if (tsup && tsup !== me) ECON.SUPPLY[0].arm = tsup; if (asup && asup !== me) ECON.SUPPLY[0].mec = asup;
    // للعراق: كتالوج «الحرب الكبرى» الأصلي (F-16IQ، باتريوت...) يبقى ويا مورّديه، والإضافات بس للأنواع اللي ما بيه
    if (me === 'IRQ') Object.assign(ECON.SUPPLY[0], SUP0());
    const have = new Set(Object.values(I).filter(x => x.side === 0).map(x => x.plane || x.pool).filter(Boolean));
    const models = [...(cs.jets || []).map(([m]) => m), ...(((cs.kit || {}).jet || [0, []])[1] || [])], modelOf = t => (aw && aw.nm && aw.nm[t]) || models.find(m => CAT.planeType(m) === t);   // aw.nm: أسماء منسّقة (السعودية: تايفون وتورنادو)
    const jets = aw && aw.jets ? aw.jets.map(([t]) => t) : models.map(CAT.planeType);
    for (const t of jets) { if (I['pl_' + t] || have.has(t) || !AIR.PLANES[t]) continue; const P = AIR.PLANES[t], m = modelOf(t), nm = m ? m.replace(/\s*\(.*$/, '').replace(/ Fighting Falcon| Typhoon/, '') : P.n.split(/[،/]/)[0].trim();
      I['pl_' + t] = { n: `${nm} ×2`, ic: '✈', cat: 'plane', plane: t, q: 2, side: 0, cost: PCOST[t] ?? .1, days: Math.round(25 + (PCOST[t] ?? .1) * 150), d: 'تعويض وتوسيع القوة الجوية' };
      const sp = m ? supOf(m, me) : null; if (sp && sp !== me) ECON.SUPPLY[0]['pl_' + t] = sp; }
    if ((cs.tech || {}).uav >= 1 && !I.pl_tb2 && !have.has('tb2')) I.pl_tb2 = { n: 'مسيّرة استطلاع ×2', ic: '📡', cat: 'plane', plane: 'tb2', q: 2, side: 0, cost: .02, days: 10, d: 'تشوف ورا الجبهة' };
    const sams = aw && aw.sam ? aw.sam.map(([sy]) => sy) : (cs.adL || []).map(([m]) => CAT.samType(m));
    for (const sy of new Set(sams)) { const S = AIR.SYS[sy]; if (!S) continue; for (const mg of S.mags) { if (mg.gun || I['sm_' + mg.n] || have.has(mg.n)) continue;
      const lay = Math.max(...Object.values(mg.r)) > 100 ? 'long' : Math.max(...Object.values(mg.r)) > 30 ? 'medium' : 'short', q = lay === 'short' ? 24 : 8;
      I['sm_' + mg.n] = { n: `${/[a-z0-9]/i.test(mg.n) ? mg.n : 'صواريخ ' + S.n} ×${q}`, ic: '🚀', cat: 'sam', pool: mg.n, q, side: 0, cost: +(MCOST[lay] * q).toFixed(3), days: lay === 'long' ? 40 : 20, d: 'ل' + S.n };
      const sp = sy === 'crotale' ? null : supOf((S.full || S.n) + ' ' + mg.n, me); if (sp && sp !== me) ECON.SUPPLY[0]['sm_' + mg.n] = sp; } }
    // أسماء المنتجات المحلية والسلاح الوطني عامة (للعراق تبقى «بابل» و«صقر»)
    if (me !== 'IRQ') { IND.LOCAL.larm.n = 'مدرعة محلية (تطوير دبابة)'; IND.LOCAL.larm.d = 'تحديث دبابات محلي'; IND.LOCAL.luav.n = 'مسيّرة استطلاع محلية ×2'; IND.LOCAL.luav.plane = 'tb2'; IND.LOCAL.luav.d = 'بدل المستوردة';
      IND.LOCAL.lmec.d = 'مدرعات خفيفة تتجمّع محلياً'; IND.MEGA.pipe.d = 'أنابيب وموانئ بديلة: إذا مضيق انغلق أو انحاصرنا يطلع 40٪ من النفط';
      IND.MEGA.fort.d = 'ضربات العدو على مدننا وقواتنا بالمدن أضعف 25٪، والمعنويات أثبت';
      IND.BR.arm.d = 'هجوم الدروع والآليات +3٪ لكل مستوى، ويفتح آلية محلية (2) ومدرعة محلية (4)'; IND.NAT[2].d = 'سلاح وطني (' + WD.cs[me].ar + ') باسمك، تمويه صحراوي على أخضر: الضربة +15٪'; }   // V0: ولا نص عراقي لدولة ثانية
    ECON.LAND[0] = { ...ECON.LAND[0], lim: G.nat.lim, n: WD.cs[me].ar };
    for (const id of new Set(Object.values(ECON.SUPPLY[0]))) ECON.SUP_N[id] = WD.cs[id] ? WD.cs[id].ar : id;
    MKT.relink(G, WD, { ECON, AIR });   // W8: السلاح اللي اشتريناه من السوق يرجع للكتالوج
  }
  // علاقة اللاعب بالمورّدين بشكل W.dip اللي يقراه econ.js (حليف = كامل، بحرب ويانا = صفر)
  function dipShim(G, WD, S) {
    const NW = G.nat, me = G.me; NW.dip = { c: {} };
    for (const id of new Set(Object.values(ECON.SUPPLY[0]))) { const w = S.atWar(G, me, id), al = S.allied(G, me, id);
      NW.dip.c[id] = { st: al ? 'ally0' : w ? 'ally1' : '', rel: [S.rel(G, id, me), 0] }; }
    Object.defineProperty(NW, 'dipRel', { value: (id, v) => { const t = id === 'us' ? 'USA' : id; if (G.C[t]) { const m = G.rel[me] || (G.rel[me] = {}); m[t] = Math.max(-100, Math.min(100, (m[t] || 0) + v)); } }, configurable: true, enumerable: false });
  }
  const PRIO_G = { civ: .2, bal: 0, war: -.5 };   // أثر أولوية الاقتصاد على النمو السنوي ٪ [تقدير]
  // ===== كل يوم =====
  // X = { S: wsim، SIM: محرك الحرب، T: المسرح أو null، before: طول سجل العالم قبل اليوم }
  function daily(G, WD, X) {
    const NW = G.nat; if (!NW) return; const S = X.S, T = X.T, me = G.me, c = G.C[me], e = NW.eco[0];
    if (!NW.home.base) NW.home.base = Object.fromEntries(Object.keys(NW.home.fac).map(k => [k, 55]));
    NW.home.revR = .02; NW.home.gap = NW.home.gap || [18, 14]; NW.home.costK = Math.max(.1, Math.min(20, c.gdp / 250)); NW.ind[0].k = +Math.pow(NW.home.costK, .6).toFixed(3)   /* R2: البحث يكبر أبطأ من الاقتصاد (أمريكا ×6 مو ×20) حتى ميزانية الخانة تبقى معقولة */;
    if (!NW.g0) NW.g0 = snap(G, WD, S);   // لقطة البداية للتقييم
    NW.t = G.t * 24; Object.defineProperty(NW, 'rnd', { value: G.rnd || Math.random, writable: true, enumerable: false, configurable: true });
    NW.lim = Math.max(2, c.gdp * .06); ECON.LAND[0].lim = NW.lim; dipShim(G, WD, S);
    // الواجهة بين المحاكاتين: الإنفاق المدني والأولوية من wsim
    e.civL = c.civ === 'cut' ? 'cut' : c.civ === 'more' ? 'more' : 'norm';
    // أحداث العالم ← سجل الدولة بشكل «الحرب الكبرى» (المدن، السلام، الاستسلام)
    for (const l of G.log.slice(X.before || 0)) {
      if (l.k === 'take') { const a = WD.r[(T && T._idx ? T._idx : idx(WD)).get(l.r)]; if (!a) continue; const vp = (a[12] ? 4 : 0) + (a[13] ? 6 : (a[9] || []).length ? 1 : 0);
        if (l.by === me) NW.log.push({ t: NW.t, k: 'take', side: 0, vp, own: a[1] === me ? 0 : 1, city: (a[9][0] || [a[3]])[0] }); else if (l.from === me) NW.log.push({ t: NW.t, k: 'take', side: 1, vp, own: 0, city: (a[9][0] || [a[3]])[0] }); }
      if (l.k === 'peace') NW.log.push({ t: NW.t, k: 'dip', a: 'peace' });
      if (l.k === 'strike' && l.t === me && l.kind === 'city') NW.log.push({ t: NW.t, k: 'oilhit', vs: 0, side: 1, n: 'مدننا' });
    }
    if (T) for (const l of T.W.log.slice(T.natN ?? T.W.log.length)) { if (l.k === 'surrender') NW.log.push({ t: NW.t, k: 'surrender', side: l.side });
      // C2: تقرير معركة لما مدينة/هدف مهم ينسقط (ويا خسائر الطرفين آخر 3 أيام)
      if (l.k === 'take' && CAS) { const C = CAS.ensure(G), h = C.hot.filter(x => x.cell === l.cell && G.t - x.t <= 3); CAS.report(G, { k: 'take', war: T.war, us: l.side === 0, cell: l.cell, n: (T.W.cells[l.cell] || {}).n || '', loss: h.reduce((s, x) => s + x.n, 0) }); } }
    if (T && CAS) CAS.theater(G, T, X.SIM.TEMPL);
    if (T) T.natN = T.W.log.length;
    // الإنتاج (نفس econ.js daily): الخطوط تشتغل على أول الطلبات، والسرعة حسب الأولوية والصناعة والمعنويات
    const P = ECON.PRIO[e.prio], sp = P.prod * (NW.indF ? NW.indF[0].prod : 1) * (e.mor < 30 ? .75 : 1) * (G.cmd ? CMD.mult(G.cmd.c).prod : 1) * (1 + (c.prodK || 0));   // القائد: اللوجستيك يسرّع الإنتاج
    for (let k = 0; k < Math.min(e.lines, e.q.length); k++) e.q[k].left -= sp * (ECON.ITEMS[e.q[k].k] && ECON.ITEMS[e.q[k].k].cat === 'div' && e.mor < 30 ? .8 : 1);
    for (let k = e.q.length - 1; k >= 0; k--) if (e.q[k].left <= 0) { const o = e.q[k]; deliver(G, WD, o, X); e.q.splice(k, 1); }
    MKT.deliver(G, WD, { ECON, AIR });   // W8: عقود سوق السلاح اللي وصلت
    // المعنويات (نفس منطق econ.js morale بأحداث العالم)
    morale(G, NW, !!T || G.wars.some(w => w.a.includes(me) || w.b.includes(me)));
    // الداخل والتصنيع (الملفات نفسها)
    HOME.daily(NW, T ? T.A : null, { ECON });
    IND.daily(NW, T ? T.A : null, { SIM: X.SIM, ECON });
    if (RES) RES.daily(G, WD);
    // آثار على المسرح: التصنيع (W.indF) والداخل (W.homeF) — sim.js وair.js يقرونها مثل «الحرب الكبرى»
    if (T) { T.W.indF = [NW.indF[0], { armAtk: 1, eye: 1, samPk: 1, ewDef: 1, prod: 1, fort: 1, locCost: 1, oil: 1, fix: 1, sup: 0, br: 1 }]; T.W.homeF = NW.homeF; T.W.eco = undefined; }
    // آثار على اقتصاد العالم: أولوية الاقتصاد على النمو، والسلاح الوطني المصدّر دخل
    c.prioG = PRIO_G[e.prio] || 0; c.stab = NW.home.stab;
    if (NW.over && !G.over) { G.over = { t: G.t, why: NW.over.why }; G.log.push({ t: G.t, k: 'over', why: NW.over.why }); }
    e.hist.push([G.t, +e.cash.toFixed(2), Math.round(e.mor)]); if (e.hist.length > 120) e.hist.shift();
    if (NW.log.length > 300) NW.log.splice(0, NW.log.length - 300);
  }
  let IDX = null; const idx = WD => IDX || (IDX = new Map(WD.r.map((a, i) => [a[0], i])));
  function morale(G, NW, atWar) {
    const e = NW.eco[0], P = ECON.PRIO[e.prio], why = []; let dm = P.mor; if (P.mor) why.push([P.mor, P.n]);
    if (e.civL === 'cut') { dm -= .1; why.push([-.1, 'تقشف بالرواتب']); } else if (e.civL === 'more') { dm += .06; why.push([.06, 'زيادة رواتب وخدمات']); }
    if (atWar) { dm -= .04; why.push([-.04, 'الحرب']); } else { const back = (G.C[G.me].stab - e.mor) * .02; dm += back; if (Math.abs(back) > .01) why.push([back, 'الحياة الطبيعية']); }
    // W9: العقوبة حسب عمق الدين (قبلها −0.4 باليوم من أول دولار سالب = انهيار بشهرين بلعبة سنين)
    if (e.cash < -NW.lim) { dm -= 1.5; why.push([-1.5, 'رواتب متأخرة']); } else if (e.cash < 0) { const v = .05 + .35 * (-e.cash / NW.lim); dm -= v; why.push([-v, 'الدولة بالدين']); }
    for (let i = NW.log.length - 1; i >= 0 && NW.log[i].t > NW.t - 24; i--) { const l = NW.log[i];
      if (l.k === 'take' && l.vp) { if (l.side === 1) { dm -= l.vp * 1.2; why.push([-l.vp * 1.2, 'خسرنا ' + (l.city || 'مدينة')]); } else { dm += l.vp * .8; why.push([l.vp * .8, 'أخذنا ' + (l.city || 'مدينة')]); } }
      if (l.k === 'surrender') { if (l.side === 0) { dm -= 1.5; why.push([-1.5, 'فرقة استسلمت']); } else { dm += .8; why.push([.8, 'فرقة عدو استسلمت']); } }
      if (l.k === 'oilhit' && l.vs === 0) { dm -= .5; why.push([-.5, 'ضربوا ' + l.n]); }
      if (l.k === 'dip' && l.a === 'peace') { dm += 6; why.push([6, 'السلام']); } }
    e.mor = Math.max(0, Math.min(100, e.mor + dm)); e.dm = dm; e.morWhy = why.filter(w => Math.abs(w[0]) >= .01).slice(-6);
  }
  // التوصيل: بالحرب للمسرح نفسه (econ.js deliver: فرقة بأكبر مدينة، طيارات لقواعدها، صواريخ لمخزون الدفاع الجوي)، وبالسلم قوة الجيش تكبر
  const DIVPW = { inf: 15, mec: 60, arm: 140 };   // قوة تقريبية للفرقة بمقياس wsim [تقدير]
  function deliver(G, WD, o, X) {
    const it = ECON.ITEMS[o.k], c = G.C[G.me], NW = G.nat, T = X.T; if (!it) return;
    if (it.cat === 'line') { NW.eco[0].lines++; NW.log.push({ t: NW.t, side: 0, k: 'built', it: o.k }); return; }
    if (T && (it.cat === 'div' || it.cat === 'plane' || it.cat === 'sam')) { T.W.num = T.W.num || [100, 200]; ECON.deliver(T.W, T.A, 0, o, X.SIM); }
    NW.arms = NW.arms || { jets: {}, sam: {}, tank: null };
    if (it.cat === 'div') c.pw += (DIVPW[it.kind || o.k] || 30) * ((it.kind || o.k) === 'arm' && NW.arms.tank ? NW.arms.tank.gen / 3 : 1);
    else if (it.cat === 'plane') { c.pw += (it.q || 1) * 3 * (AIR.PLANES[it.plane] && AIR.PLANES[it.plane].aa > .6 ? 1.5 : 1); if (!T) NW.arms.jets[it.plane] = (NW.arms.jets[it.plane] || 0) + (it.q || 1); }   // بالسلم: تنضاف للقواعد بالمسرح الجاي
    else if (it.cat === 'sam') { NW.samStock = NW.samStock || {}; NW.samStock[it.pool] = (NW.samStock[it.pool] || 0) + it.q; }
    NW.log.push({ t: NW.t, side: 0, k: 'built', it: o.k });
  }
  // الطلب (econ.js canBuy/buy/cancel نفسها على دولة اللاعب)
  const buy = (G, k) => ECON.buy(G.nat, 0, k);
  const canBuy = (G, k) => ECON.canBuy(G.nat, 0, k);
  const cancel = (G, id) => ECON.cancel(G.nat, 0, id);
  const items = () => ECON.itemsFor(0);
  // ===== المستشارين (advise.js نفسه): العالم يعطيه المسرح (إذا بحرب) + اقتصاد الدولة وداخلها =====
  const EMPTY = { divs: [], battles: new Map(), sup: [[], []], cells: [], plans: [], bridges: [] };
  function view(G, T) { const NW = G.nat, Wx = Object.create(T ? T.W : EMPTY); Wx.eco = NW.eco; Wx.home = NW.home; Wx.dip = NW.dip; Wx.over = G.over ? { loser: 0 } : null; if (!T) Wx.t = 24 * 99; return Wx; }
  function advice(G, WD, X) {
    const NW = G.nat; if (!NW) return []; const T = X.T, en = T ? T.side[1][0] : null;
    return ADV.list(view(G, T), T ? T.A : null, { SIM: X.SIM, ECON, DIP: null, HOME, foe: en ? WD.cs[en].ar : 'العدو', sups: [...new Set(Object.values(ECON.SUPPLY[0]))],
      arrowTip: '➹ جرّب: اضغط فرقتك بالجبهة ← «➹ خطة بسهم» ← ارسم الطريق خلية خلية ← نفّذ. الدروع تصير رأس الحربة' }, 0);
  }
  // ===== التقييم (grade.js نفسه، بنفس الأوزان والدرجات S–D) — طرق الفوز من العالم [تقدير] =====
  // كل طريق = 50 إذا بقى الوضع مثل ما استلمته (W9: قبلها الدول الكبيرة تاخذ S بدون ما تسوي شي):
  //  ⚔ عسكري: أرض أخذناها +25، أرض خسرناها −60×النسبة، قوة الجيش نسبةً للعالم ±20، سير حروبنا
  //  💰 اقتصادي: نمونا ناقص نمو العالم (×8 لكل ٪ سنوي، ±25)، الخزينة نسبةً لحد الدين ±15، الدين ±10
  //  🤝 سياسي: حلفاء جدد ×8، تجارة جديدة ×3، معدل العلاقات ×0.5
  //  🙂 الشعب: الاستقرار ناقص البداية ×0.8، المعنويات فوك/تحت 50 ×0.3
  const cl = v => Math.max(0, Math.min(100, v));
  const relAvg = (G, me) => { const v = Object.values(G.rel[me] || {}); return v.length ? v.reduce((t, x) => t + x, 0) / v.length : 0; };
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 0; };
  function snap(G, WD, S) { const me = G.me, c = G.C[me];
    return { t: G.t, gdp: c.gdp, pw: c.pw, stab: c.stab, debt: c.debt / c.gdp, al: G.ids.filter(x => x !== me && S.allied(G, me, x)).length, tr: G.trade.filter(p => p.includes(me)).length, rel: relAvg(G, me),
      wg: Object.fromEntries(G.ids.map(x => [x, [G.C[x].gdp, G.C[x].pw]])) }; }
  function paths(G, WD, S) {
    const me = G.me, c = G.C[me], NW = G.nat, e = NW.eco[0], z = NW.g0 || (NW.g0 = snap(G, WD, S)); let own = 0, kept = 0, held = 0;
    WD.r.forEach((a, i) => { if (a[1] === me) { own++; if (G.ctl[i] === me) kept++; } else if (G.ctl[i] === me) held++; });
    const k = own ? kept / own : 1, wars = G.wars.filter(w => w.a.includes(me) || w.b.includes(me));
    const ws = wars.length ? wars.reduce((t, w) => t + (w.a.includes(me) ? w.score : -w.score), 0) / wars.length : 0;
    const yrs = Math.max(.25, (G.t - z.t) / 365), ids = Object.keys(z.wg).filter(x => G.C[x]);
    const pwR = (c.pw / z.pw) / Math.max(.01, med(ids.map(x => G.C[x].pw / z.wg[x][1])));
    const gMe = (Math.pow(c.gdp / z.gdp, 1 / yrs) - 1) * 100, gW = med(ids.map(x => (Math.pow(G.C[x].gdp / z.wg[x][0], 1 / yrs) - 1) * 100));
    const mil = cl(50 + Math.min(1, held / Math.max(1, own) / .15) * 25 - (1 - k) * 60 + Math.max(-20, Math.min(20, Math.log2(pwR) * 20)) + ws * .15);
    const eco = cl(50 + Math.max(-25, Math.min(25, (gMe - gW) * 8)) + Math.max(-15, Math.min(15, e.cash / NW.lim * 7.5)) + Math.max(-10, Math.min(10, (z.debt - c.debt / c.gdp) * 50)));
    const al = G.ids.filter(x => x !== me && S.allied(G, me, x)).length, tr = G.trade.filter(p => p.includes(me)).length;
    const dip = cl(50 + (al - z.al) * 8 + (tr - z.tr) * 3 + (relAvg(G, me) - z.rel) * .5);
    const pop = cl(50 + (NW.home.stab - z.stab) * .8 + (e.mor - 50) * .3);
    return { mil: Math.round(mil), eco: Math.round(eco), dip: Math.round(dip), pop: Math.round(pop) };
  }
  function grade(G, WD, S) { const p = paths(G, WD, S); return GRADE.grade(view(G, null), null, { paths: () => p }, 0); }
  const API = { init, catalog, daily, buy, canBuy, cancel, items, advice, paths, grade, GR: GRADE.GR, FACS, NI, supOf };
  if (typeof module !== 'undefined') module.exports = API; else root.NATION = API;
})(this);
