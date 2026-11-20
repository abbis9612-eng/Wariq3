// «العالم» (D-050، I-105): طبقة الدولة = أنظمة «الحرب الكبرى» نفسها على دولة اللاعب:
//  - الداخل: home.js (الفئات حسب نظام الحكم، القضايا بقرارات، الانقلاب والثورة والإفلاس)
//  - التصنيع والبحث: ind.js (5 فروع، منتجات محلية، سلاح وطني، قطاعات، مشاريع كبرى)
//  - الإنتاج: econ.js (طلب فرق وطيارات وصواريخ دفاع جوي وخطوط إنتاج، المورّد وقطع الغيار، أولوية الاقتصاد، المعنويات)
// الحالة بـ G.nat بنفس شكل «الحرب الكبرى» (W.eco[0]، W.ind[0]، W.home)، والطرف 1 = الخصم الرئيسي (أو لا أحد).
// فحص: node tests/nation.test.mjs
(function (root) {
  'use strict';
  const req = typeof require !== 'undefined' ? require : null;
  const HOME = root.HOME || req('./gwhome.js'), IND = root.IND || req('./gwind.js'), ECON = root.ECON || req('./gwecon.js'), AIR = root.AIR || req('./gwair.js');
  const CAT = root.AIRCAT || req('./aircat.js');
  // الفئات حسب نظام الحكم (نفس data/world/SCHEMA.md و build_country.py)، والعراق بفئاته الأصلية
  const FACS = { theo: ['clergy', 'irgc', 'army', 'street', 'biz'], amon: ['royal', 'army', 'clergy', 'street', 'biz'], one: ['party', 'army', 'street', 'biz'], mil: ['army', 'militia', 'street', 'biz'],
    auth: ['army', 'security', 'street', 'biz'], trans: ['army', 'factions', 'street', 'biz'], cmon: ['army', 'parties', 'street', 'biz'], parl: ['army', 'parties', 'street', 'biz'], pres: ['army', 'parties', 'street', 'biz'], semi: ['army', 'parties', 'street', 'biz'] };
  // المورّد من اسم الموديل [تقدير]
  const SUPRX = [[/abrams|m1a|f-16|f-15|f-35|f\/a-18|hornet|patriot|pac-|nasams|thaad|m109|m113|bradley|himars|apache|black hawk|uh-60|ah-64|stryker|m60|m48/i, 'USA'], [/leopard|iris-t|pzh|puma|boxer|marder/i, 'DEU'],
    [/rafale|leclerc|samp|aster|caesar|mirage|vab|vbci|crotale/i, 'FRA'], [/typhoon|eurofighter|challenger|warrior|storm shadow/i, 'GBR'], [/gripen|cv90|archer|stridsvagn/i, 'SWE'],
    [/t-72|t-90|t-80|t-62|t-55|t-54|bmp|btr|su-|mig-|s-300|s-400|buk|pantsir|tor|kub|s-125|osa|tunguska|mi-8|mi-17|mi-24|mi-35|ka-52|2s|bm-21|grad|smerch|iskander|lion of babylon/i, 'RUS'],
    [/type \d|j-10|j-11|j-16|j-20|jf-17|hq-|vt-4|ch-4|ch-5|wing loong|pl-|z-10|z-9|plz/i, 'CHN'], [/k2|k9|k21|fa-50|t-50|kf-21|cheongung|km-sam/i, 'KOR'], [/merkava|arrow|iron dome|barak|spyder|david|namer|heron|hermes/i, 'ISR'],
    [/altay|bayraktar|tb2|akinci|t129|kirpi|ejder|cobra|fnss|otokar/i, 'TUR']];
  const supOf = m => (SUPRX.find(([rx]) => rx.test(m || '')) || [0, null])[1];
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
    // التصنيع والبحث: مستويات البداية من بيانات الدولة (W1/W4)، والطرف 1 من خصمها الرئيسي إذا بحرب
    IND.init(NW); const t0 = k => Math.max(0, Math.min(5, Math.round(k || 0)));
    NW.ind[0].tech = { arm: t0(tech.arm), uav: t0(tech.uav), msl: t0(tech.msl), ew: t0(tech.ew), ind: t0(tech.ind ?? 1) }; NW.ind[0].bud = 1; NW.ind[0].nat.name = '';
    NW.start0 = { ...NW.ind[0].tech };
    G.nat = NW; catalog(G, WD); return NW;
  }
  // كتالوج الطلبات لهالدولة (فوك كتالوج econ.js): الفرق والخطوط نفسها، والطيارات من أنواع قوتها الجوية، والصواريخ لبطارياتها
  function catalog(G, WD) {
    const me = G.me, cs = WD.cs[me], I = ECON.ITEMS, aw = (WD.aw || {})[me];
    if (me !== 'IRQ') for (const k of Object.keys(I)) if (I[k].side === 0 && !I[k].req) delete I[k];
    for (const k of Object.keys(I)) if (I[k].side === 1) delete I[k];
    for (const k of Object.keys(I)) if (/^(pl_|sm_)/.test(k)) delete I[k];
    ECON.SUPPLY[0] = {};
    const tsup = supOf(((cs.kit || {}).tank || [0, []])[1].join(' ')), asup = supOf(((cs.kit || {}).afv || [0, []])[1].join(' '));
    if (tsup && tsup !== me) ECON.SUPPLY[0].arm = tsup; if (asup && asup !== me) ECON.SUPPLY[0].mec = asup;
    const jets = aw && aw.jets ? aw.jets.map(([t]) => [t, (cs.jets || []).map(j => j[0]).join(' ')]) : (cs.jets || []).map(([m]) => [CAT.planeType(m), m]);
    for (const [t, m] of jets) { if (I['pl_' + t] || !AIR.PLANES[t]) continue; const P = AIR.PLANES[t];
      I['pl_' + t] = { n: `${P.n} ×2`, ic: '✈', cat: 'plane', plane: t, q: 2, side: 0, cost: PCOST[t] ?? .1, days: Math.round(25 + (PCOST[t] ?? .1) * 150), d: 'تعويض وتوسيع القوة الجوية' };
      const sp = supOf(m) || supOf(P.n); if (sp && sp !== me) ECON.SUPPLY[0]['pl_' + t] = sp; }
    if ((cs.tech || {}).uav >= 1 && !I.pl_tb2) I.pl_tb2 = { n: 'مسيّرة استطلاع ×2', ic: '📡', cat: 'plane', plane: 'tb2', q: 2, side: 0, cost: .02, days: 10, d: 'تشوف ورا الجبهة' };
    const sams = aw && aw.sam ? aw.sam.map(([sy]) => sy) : (cs.adL || []).map(([m]) => CAT.samType(m));
    for (const sy of new Set(sams)) { const S = AIR.SYS[sy]; if (!S) continue; for (const mg of S.mags) { if (mg.gun || I['sm_' + mg.n]) continue;
      const lay = Math.max(...Object.values(mg.r)) > 100 ? 'long' : Math.max(...Object.values(mg.r)) > 30 ? 'medium' : 'short', q = lay === 'short' ? 24 : 8;
      I['sm_' + mg.n] = { n: `${mg.n} ×${q}`, ic: '🚀', cat: 'sam', pool: mg.n, q, side: 0, cost: +(MCOST[lay] * q).toFixed(3), days: lay === 'long' ? 40 : 20, d: 'ل' + S.n };
      const sp = supOf(S.full || S.n); if (sp && sp !== me) ECON.SUPPLY[0]['sm_' + mg.n] = sp; } }
    // أسماء المنتجات المحلية والسلاح الوطني عامة (للعراق تبقى «بابل» و«صقر»)
    if (me !== 'IRQ') { IND.LOCAL.larm.n = 'مدرعة محلية (تطوير دبابة)'; IND.LOCAL.larm.d = 'تحديث دبابات محلي'; IND.LOCAL.luav.n = 'مسيّرة استطلاع محلية ×2'; IND.LOCAL.luav.plane = 'tb2'; IND.LOCAL.luav.d = 'بدل المستوردة';
      IND.LOCAL.lmec.d = 'مدرعات خفيفة تتجمّع محلياً'; IND.MEGA.pipe.d = 'أنابيب وموانئ بديلة: إذا مضيق انغلق أو انحاصرنا يطلع 40٪ من النفط';
      IND.MEGA.fort.d = 'ضربات العدو على مدننا وقواتنا بالمدن أضعف 25٪، والمعنويات أثبت'; }
    ECON.LAND[0] = { ...ECON.LAND[0], lim: G.nat.lim, n: WD.cs[me].ar };
    for (const id of new Set(Object.values(ECON.SUPPLY[0]))) ECON.SUP_N[id] = WD.cs[id] ? WD.cs[id].ar : id;
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
    if (T) for (const l of T.W.log.slice(T.natN ?? T.W.log.length)) if (l.k === 'surrender') NW.log.push({ t: NW.t, k: 'surrender', side: l.side });
    if (T) T.natN = T.W.log.length;
    // الإنتاج (نفس econ.js daily): الخطوط تشتغل على أول الطلبات، والسرعة حسب الأولوية والصناعة والمعنويات
    const P = ECON.PRIO[e.prio], sp = P.prod * (NW.indF ? NW.indF[0].prod : 1) * (e.mor < 30 ? .75 : 1);
    for (let k = 0; k < Math.min(e.lines, e.q.length); k++) e.q[k].left -= sp * (ECON.ITEMS[e.q[k].k] && ECON.ITEMS[e.q[k].k].cat === 'div' && e.mor < 30 ? .8 : 1);
    for (let k = e.q.length - 1; k >= 0; k--) if (e.q[k].left <= 0) { const o = e.q[k]; deliver(G, WD, o, X); e.q.splice(k, 1); }
    // المعنويات (نفس منطق econ.js morale بأحداث العالم)
    morale(G, NW, !!T || G.wars.some(w => w.a.includes(me) || w.b.includes(me)));
    // الداخل والتصنيع (الملفات نفسها)
    HOME.daily(NW, T ? T.A : null, { ECON });
    IND.daily(NW, T ? T.A : null, { SIM: X.SIM, ECON });
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
    if (e.cash < -NW.lim) { dm -= 1.5; why.push([-1.5, 'رواتب متأخرة']); } else if (e.cash < 0) { dm -= .4; why.push([-.4, 'الدولة بالدين']); }
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
    if (it.cat === 'div') c.pw += DIVPW[it.kind || o.k] || 30; else if (it.cat === 'plane') c.pw += (it.q || 1) * 3 * (AIR.PLANES[it.plane] && AIR.PLANES[it.plane].aa > .6 ? 1.5 : 1);
    else if (it.cat === 'sam') { NW.samStock = NW.samStock || {}; NW.samStock[it.pool] = (NW.samStock[it.pool] || 0) + it.q; }
    NW.log.push({ t: NW.t, side: 0, k: 'built', it: o.k });
  }
  // الطلب (econ.js canBuy/buy/cancel نفسها على دولة اللاعب)
  const buy = (G, k) => ECON.buy(G.nat, 0, k);
  const canBuy = (G, k) => ECON.canBuy(G.nat, 0, k);
  const cancel = (G, id) => ECON.cancel(G.nat, 0, id);
  const items = () => ECON.itemsFor(0);
  const API = { init, catalog, daily, buy, canBuy, cancel, items, FACS, NI, supOf };
  if (typeof module !== 'undefined') module.exports = API; else root.NATION = API;
})(this);
