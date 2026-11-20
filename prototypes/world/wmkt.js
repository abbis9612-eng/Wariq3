// «العالم» W8: البحث لكل الدول + سوق السلاح (شراء وتصدير) [تقدير] — فحص node tests/wmkt.test.mjs
//  - البحث (الذكاء): نفس فروع ind.js (دروع، مسيّرات، صواريخ، إلكترونيات، صناعة) ونفس كلفة المستوى need(l)=0.4×(l+1)^1.4 مليار.
//    الميزانية = 0.5٪ من ميزانية الجيش للبحث العسكري + 0.02٪ من الناتج للصناعة. المستوى الجديد: قوة الجيش تنبني أسرع (+5٪ لكل مستوى)،
//    وإنتاج الصواريخ والمسيّرات حسب المستوى (نفس جدول W5c). اللاعب: مستوياته من بحثه هو (ind.js).
//  - الشراء: عقود من 10 دول مصنّعة بشروطها (علاقة، تحالف، عقوبات، حرب)، والعقد يفتح المنتج بـ🏭 الإنتاج ويوصل دفعة أولى بعد أشهر.
//    شراء سلاح روسي/صيني يزعّل أمريكا (مثل قانون كاتسا)، والعكس.
//  - التصدير: إذا عندك صناعة (مستوى 3+ بفرع، أو سلاحك الوطني)، دول تطلب تشتري منك: فلوس وعلاقة، بس أعداء المشتري يزعلون.
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const need = l => +(.4 * Math.pow(l + 1, 1.4)).toFixed(2);   // نفس ind.js
  const BR = ['arm', 'uav', 'msl', 'ew'];
  const MSLP = [0, 1, 3, 10, 35, 80], DRNP = [0, 5, 25, 100, 300, 600];
  // ===== البحث =====
  function ensure(W, WD) {
    if (!W.tech) { W.tech = {}; W.rp = {}; for (const id of W.ids) { const t = (WD.cs[id] || {}).tech || {}; W.tech[id] = { arm: t.arm || 0, uav: t.uav || 0, msl: t.msl || 0, ew: t.ew || 0, ind: t.ind ?? 1 }; W.rp[id] = 0; } W.tech0 = JSON.parse(JSON.stringify(W.tech)); }
    W.mkt = W.mkt || { offers: [], deals: [], t: {} }; return W;
  }
  const sumT = t => BR.reduce((s, k) => s + t[k], 0) + t.ind;
  // أثر التقنية على بناء الجيش (يقراه wsim): +5٪ لكل مستوى فوك البداية
  const techK = (W, id) => W.tech && W.tech0 ? 1 + .05 * (sumT(W.tech[id]) - sumT(W.tech0[id])) : 1;
  function month(W, WD, S) {
    ensure(W, WD); const me = W.me;
    for (const id of W.ids) { const c = W.C[id], T = W.tech[id]; if (!c) continue;
      if (id === me) { if (W.nat) Object.assign(T, W.nat.ind[0].tech); }
      else { W.rp[id] += c.gdp * c.milPct / 100 * .005 / 12; const ind = c.gdp * .0002 / 12;
        const k = BR.filter(b => T[b] < 5).sort((a, b) => T[a] - T[b])[0];
        if (k && W.rp[id] >= need(T[k])) { W.rp[id] -= need(T[k]); T[k]++; if (c.gdp > 300) W.log.push({ t: W.t, k: 'atech', id, b: k, l: T[k] }); }
        if (T.ind < 5 && W.rnd() < ind / need(T.ind)) T.ind++; }
      // الصواريخ والمسيّرات حسب المستوى الحالي (ما ينزل عن البداية)
      c.mslP = Math.max(c.mslP || 0, MSLP[T.msl]); c.drnP = Math.max(c.drnP || 0, DRNP[T.uav]);
    }
    exportOffers(W, WD, S);
    W.mkt.offers = W.mkt.offers.filter(o => W.t - o.t < 60);
  }
  // ===== سوق السلاح: المنتجات بشروطها [تقدير] =====
  // cat: plane (q طيارة، النوع من aircat)، sam (n بطارية، النظام من aircat)، tank (رخصة الدروع: المورّد + جيل)
  // price مليار للعقد (الدفعة الأولى ويا الدعم والتدريب)، days للتوصيل، rel أقل علاقة، ally يحتاج تحالف ويا البايع، rival دولة تزعل (−15)
  const P = (k, n, cat, o) => ({ k, n, cat, ...o });
  const SELL = {
    USA: [P('f35', 'F-35A ×12', 'plane', { t: 'f35', q: 12, price: 2.4, days: 540, rel: 75, ally: 1 }), P('f15', 'F-15EX ×12', 'plane', { t: 'f15', q: 12, price: 2.2, days: 450, rel: 55 }),
      P('f16', 'F-16 Block 70 ×16', 'plane', { t: 'f16', q: 16, price: 1.6, days: 400, rel: 40 }), P('pac', 'باتريوت PAC-3 ×2 بطارية', 'sam', { t: 'pac', q: 2, price: 2.2, days: 365, rel: 50 }),
      P('nasams', 'ناسامز ×2 بطارية', 'sam', { t: 'nasams', q: 2, price: .8, days: 300, rel: 40 }), P('thaad', 'ثاد ×1 بطارية', 'sam', { t: 'thaad', q: 1, price: 2.5, days: 600, rel: 75, ally: 1 }),
      P('abrams', 'رخصة دبابات أبرامز M1A2', 'tank', { gen: 4, price: 1.5, days: 365, rel: 45 })],
    RUS: [P('su35', 'سو-35 ×12', 'plane', { t: 'flanker', q: 12, price: 1.2, days: 450, rel: 20, rival: 'USA' }), P('su34', 'سو-34 ×12', 'plane', { t: 'su34', q: 12, price: 1, days: 450, rel: 40, rival: 'USA' }),
      P('s400', 'S-400 ×2 كتيبة', 'sam', { t: 's400', q: 2, price: 1.4, days: 540, rel: 30, rival: 'USA' }), P('pantsir', 'بانتسير ×3', 'sam', { t: 'pantsir', q: 3, price: .4, days: 240, rel: 0, rival: 'USA' }),
      P('t90', 'رخصة دبابات T-90MS', 'tank', { gen: 3.5, price: .8, days: 300, rel: 15, rival: 'USA' })],
    CHN: [P('j10', 'J-10CE ×16', 'plane', { t: 'light', q: 16, price: .9, days: 400, rel: 15, rival: 'USA' }), P('hq9', 'HQ-9BE ×2 كتيبة', 'sam', { t: 'hq9', q: 2, price: 1, days: 450, rel: 20, rival: 'USA' }),
      P('wl', 'وينغ لونغ ×12 (مسيّرات)', 'plane', { t: 'tb2', q: 12, price: .25, days: 180, rel: 0 }), P('vt4', 'رخصة دبابات VT-4', 'tank', { gen: 3.5, price: .6, days: 300, rel: 10 })],
    FRA: [P('rafale', 'رافال ×12', 'plane', { t: 'euro', q: 12, price: 2.6, days: 600, rel: 40 }), P('sampt', 'SAMP/T ×2', 'sam', { t: 'sampt', q: 2, price: 1.6, days: 540, rel: 45 })],
    GBR: [P('typhoon', 'يوروفايتر تايفون ×12', 'plane', { t: 'euro', q: 12, price: 2.4, days: 600, rel: 45 })],
    DEU: [P('irist', 'IRIS-T SLM ×2', 'sam', { t: 'irist', q: 2, price: .9, days: 365, rel: 40 }), P('leo', 'رخصة دبابات ليوبارد 2A8', 'tank', { gen: 4, price: 1.6, days: 400, rel: 50 })],
    SWE: [P('gripen', 'غريبن E ×12', 'plane', { t: 'euro', q: 12, price: 1.6, days: 540, rel: 15 })],
    KOR: [P('fa50', 'FA-50 ×16', 'plane', { t: 'jet_tr', q: 16, price: .8, days: 365, rel: 0 }), P('cheong', 'تشونغونغ ×2', 'sam', { t: 'cheong', q: 2, price: .8, days: 400, rel: 10 }),
      P('k2', 'رخصة دبابات K2', 'tank', { gen: 4, price: 1.2, days: 365, rel: 0 })],
    TUR: [P('tb2', 'بيرقدار TB2 ×12 (مسيّرات)', 'plane', { t: 'tb2', q: 12, price: .15, days: 150, rel: 0 }), P('hisar', 'حصار-O ×2 (دفاع قصير)', 'sam', { t: 'crotale', q: 2, price: .2, days: 240, rel: 0 })],
    ISR: [P('barak', 'باراك-8 ×2', 'sam', { t: 'barak8', q: 2, price: .9, days: 400, rel: 50 }), P('idome', 'القبة الحديدية ×2', 'sam', { t: 'idome', q: 2, price: .6, days: 365, rel: 60 })],
  };
  // العلاقة الفعلية للبيع = العلاقة + 35 إذا حلفاء (بيانات العلاقات ناقصة لأزواج كثيرة، مثل بولندا وكوريا)
  const eff = (W, S, x) => S.rel(W, x, W.me) + (S.allied(W, x, W.me) ? 35 : 0);
  // الطريق («يعرف المعدات من وين تجي»): برّاً إذا جار، وإلا بحراً لأكبر ميناء عندنا، وإلا جواً
  function route(W, WD, S, x) { const me = W.me; let land = false; for (let i = 0; i < WD.r.length && !land; i++) if (W.ctl[i] === me) for (const n of WD.r[i][7]) { const j = WD.r.findIndex(a => a[0] === n); if (j >= 0 && W.ctl[j] === x) { land = true; break; } }
    if (land) return { by: 'land', n: 'برّاً عبر الحدود' };
    const ports = WD.r.map((a, i) => [a, i]).filter(([a, i]) => W.ctl[i] === me && a[8] && a[8].length && a[9] && a[9].length).sort((p, q) => (q[0][9][0][1] || 0) - (p[0][9][0][1] || 0));
    return ports.length ? { by: 'sea', n: 'بحراً لميناء ' + ports[0][0][9][0][0], r: ports[0][0][0] } : { by: 'air', n: 'جواً (ماكو بحر)' }; }
  const sellers = W => Object.keys(SELL).filter(x => W.C[x]);
  // هل نقدر نشتري؟ (نص السبب أو null)
  function can(W, S, x, p) {
    const me = W.me; if (x === me) return 'هاي دولتنا';
    if (S.atWar(W, me, x)) return 'بحرب ويانا';
    if (W.wars.some(w => (w.a.includes(me) && w.b.some(e => S.allied(W, x, e) || e === x)) || (w.b.includes(me) && w.a.some(e => S.allied(W, x, e) || e === x)))) return 'نحارب حليفهم';
    if (W.sanc.some(s => s[0] === x && s[1] === me)) return 'معاقبينا';
    if (p.ally && !S.allied(W, me, x)) return 'بس لحلفائهم';
    const r = eff(W, S, x); if (r < p.rel) return `العلاقة ${r} (يحتاج ${p.rel})`;
    if (W.mkt.deals.filter(d => d.at > W.t).length >= 3) return 'عدنا 3 عقود شغالة';
    if (W.nat && W.nat.eco[0].cash - p.price < -W.nat.lim * .5) return 'الفلوس ما تكفي';
    if (W.mkt.deals.some(d => d.k === p.k && d.at > W.t)) return 'العقد شغال';
    return null;
  }
  function buy(W, WD, S, x, k) {
    ensure(W, WD); const p = (SELL[x] || []).find(o => o.k === k); if (!p) return 'غلط'; const no = can(W, S, x, p); if (no) return no;
    const CM = root.WCMD || (typeof require !== 'undefined' ? require('./wcmd.js') : null), days = Math.round(p.days * (W.cmd && CM ? CM.mult(W.cmd.c).deal : 1));   // القائد: اللوجستيك يقصّر التوصيل
    W.nat.eco[0].cash -= p.price; const d = { x, k, at: W.t + days, t: W.t, route: route(W, WD, S, x) }; W.mkt.deals.push(d);
    S.addRel(W, W.me, x, 5); if (p.rival && W.C[p.rival] && S.rel(W, p.rival, W.me) > -50) S.addRel(W, W.me, p.rival, -12);
    W.log.push({ t: W.t, k: 'arms', a: 'buy', x, n: p.n, d: days, route: d.route }); return d;
  }
  // التوصيل (يومي من nation.daily): يفتح المنتج بالكتالوج، والطيارات/البطاريات تنضاف لقوتنا (G.nat.arms تدخل بالمسرح الجاي)
  function deliver(W, WD, X) {
    if (!W.mkt) return; const NW = W.nat, ECON = X.ECON, AIR = X.AIR;
    for (const d of W.mkt.deals) { if (d.done || d.at > W.t) continue; d.done = 1; const p = SELL[d.x].find(o => o.k === d.k), c = W.C[W.me]; NW.arms = NW.arms || { jets: {}, sam: {}, tank: null };
      if (p.cat === 'plane') { NW.arms.jets[p.t] = (NW.arms.jets[p.t] || 0) + p.q; c.pw += p.q * 3 * (AIR.PLANES[p.t] && AIR.PLANES[p.t].aa > .6 ? 1.5 : 1); unlock(W, WD, X, d.x, p); }
      else if (p.cat === 'sam') { NW.arms.sam[p.t] = (NW.arms.sam[p.t] || 0) + p.q; c.adI += AIR.SYS[p.t] && Math.max(...AIR.SYS[p.t].mags.map(m => Math.max(...Object.values(m.r)))) > 100 ? 6 * p.q : 3 * p.q; unlock(W, WD, X, d.x, p); }
      else if (p.cat === 'tank') { NW.arms.tank = { x: d.x, gen: p.gen, n: p.n }; ECON.SUPPLY[0].arm = d.x; ECON.SUP_N[d.x] = WD.cs[d.x].ar; }
      W.log.push({ t: W.t, k: 'arms', a: 'got', x: d.x, n: p.n }); }
  }
  // يفتح طلبات الإنتاج للسلاح الجديد (نفس شكل كتالوج nation.js)
  function unlock(W, WD, X, x, p) {
    const I = X.ECON.ITEMS, AIR = X.AIR;
    if (p.cat === 'plane' && !I['pl_' + p.t] && AIR.PLANES[p.t]) { I['pl_' + p.t] = { n: p.n.replace(/ ×\d+.*/, '') + ' ×2', ic: '✈', cat: 'plane', plane: p.t, q: 2, side: 0, cost: +(p.price / p.q * 2 * .7).toFixed(2), days: 60, d: 'من ' + WD.cs[x].ar }; X.ECON.SUPPLY[0]['pl_' + p.t] = x; }
    if (p.cat === 'sam' && AIR.SYS[p.t]) for (const mg of AIR.SYS[p.t].mags) { if (mg.gun || I['sm_' + mg.n]) continue; const R = Math.max(...Object.values(mg.r)), q = R > 30 ? 8 : 24;
      I['sm_' + mg.n] = { n: `${/[a-z0-9]/i.test(mg.n) ? mg.n : 'صواريخ ' + AIR.SYS[p.t].n} ×${q}`, ic: '🚀', cat: 'sam', pool: mg.n, q, side: 0, cost: +((R > 100 ? .004 : R > 30 ? .0015 : .0003) * q).toFixed(3), days: R > 100 ? 40 : 20, d: 'ل' + AIR.SYS[p.t].n }; X.ECON.SUPPLY[0]['sm_' + mg.n] = x; }
    X.ECON.SUP_N[x] = WD.cs[x].ar;
  }
  // بعد تحميل لعبة: نرجّع المنتجات المفتوحة للكتالوج
  function relink(W, WD, X) { if (!W.mkt) return; for (const d of W.mkt.deals) if (d.done) { const p = SELL[d.x].find(o => o.k === d.k); if (p.cat === 'tank') { X.ECON.SUPPLY[0].arm = d.x; X.ECON.SUP_N[d.x] = WD.cs[d.x].ar; } else unlock(W, WD, X, d.x, p); } }
  // ===== التصدير =====
  const EXP = { arm: 'مدرعات', uav: 'مسيّرات', msl: 'صواريخ', ew: 'أنظمة حرب إلكترونية' };
  function canExport(W) { const T = W.tech[W.me] || {}, nat = W.nat && W.nat.ind[0].nat; return BR.filter(b => T[b] >= 3).concat(nat && nat.st >= 3 ? ['nat'] : []); }
  function exportOffers(W, WD, S) {
    const me = W.me, kinds = canExport(W); if (!kinds.length || W.mkt.offers.length >= 2 || W.rnd() > .25) return;
    const L = W.ids.filter(x => x !== me && W.C[x] && W.C[x].gdp >= 20 && S.rel(W, x, me) >= 25 && !S.atWar(W, x, me) && !W.sanc.some(s => s[0] === me && s[1] === x) && !W.mkt.offers.some(o => o.from === x));
    if (!L.length) return; const x = L[Math.floor(W.rnd() * L.length)], kind = kinds[Math.floor(W.rnd() * kinds.length)];
    const lv = kind === 'nat' ? 4 : W.tech[me][kind], v = +clamp(W.C[x].gdp * .0006 * (1 + lv / 5), .1, 4).toFixed(2);
    W.mkt.offers.push({ from: x, kind, v, t: W.t }); W.log.push({ t: W.t, k: 'arms', a: 'ask', x, kind, v });
  }
  function answer(W, WD, S, i, yes) {
    const o = W.mkt.offers[i]; if (!o) return null; W.mkt.offers.splice(i, 1); const me = W.me, x = o.from;
    if (!yes) { S.addRel(W, me, x, -2); return 'رفضنا'; }
    if (W.nat) W.nat.eco[0].cash += o.v; S.addRel(W, me, x, 6); W.C[x].pw *= 1.01;
    const en = W.wars.filter(w => w.a.includes(x) || w.b.includes(x)).flatMap(w => w.a.includes(x) ? w.b : w.a); for (const e of en) S.addRel(W, me, e, -15);
    W.ten = clamp((W.ten || 0) + (en.length ? 1 : 0), 0, 100);
    W.log.push({ t: W.t, k: 'arms', a: 'sold', x, kind: o.kind, v: o.v }); return `بعنا ${o.kind === 'nat' ? 'سلاحنا الوطني' : EXP[o.kind]} لـ${WD.cs[x].ar} بـ${o.v} مليار${en.length ? '، وأعداءهم زعلوا' : ''}`;
  }
  const API = { route, eff, ensure, month, techK, need, SELL, sellers, can, buy, deliver, relink, canExport, answer, EXP, BR };
  if (typeof module !== 'undefined') module.exports = API; else root.WMKT = API;
})(this);
