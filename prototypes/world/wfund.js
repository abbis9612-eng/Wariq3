// «العالم» v3 E3+E4 (I-119): الصندوق السيادي (سندات، أسهم، مشاريع بدول صديقة، قروض) + الاستثمار الأجنبي عندك (عروض الشركات)
// العوائد: سندات ~3.5٪، أسهم ~7٪ بالمعدل ويا تذبذب ~15٪ بالسنة (تاريخ الأسواق العالمية، تقريب)؛ مشاريع برّا 6–10٪؛ قروض 4–8٪ [تقدير].
// التصميم: docs/features/world-v3-plan.md (E3، E4) · فحص: node tests/wfund.test.mjs
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // مشاريع برّا: المبلغ (مليار $)، العائد بالسنة، النفوذ (علاقة)، الخطر
  const ABROAD = {
    port: { n: 'ميناء ومنطقة حرة', ic: '⚓', amt: 3, yr: .07, rel: 8, risk: 'متوسط' },
    mine: { n: 'منجم (فوسفات، نحاس، ليثيوم)', ic: '⛏', amt: 2, yr: .09, rel: 5, risk: 'عالي' },
    refin: { n: 'مصفى وشركة طاقة', ic: '🏭', amt: 4, yr: .08, rel: 6, risk: 'متوسط' },
    farm: { n: 'أراضي زراعية (أمن غذائي)', ic: '🌾', amt: 1.5, yr: .06, rel: 5, risk: 'قليل' },
  };
  // الشركات اللي تعرض تستثمر عندك (E4)
  const FIRMS = { CHN: ['شركة صينية حكومية', 'إدارة 25 سنة'], USA: ['شركة أمريكية', 'حصة 40٪ من الإنتاج'], FRA: ['شركة فرنسية (مثل توتال)', 'حصة 40٪ من الإنتاج'], GBR: ['شركة بريطانية', 'حصة 40٪ من الإنتاج'], RUS: ['شركة روسية', 'حصة 40٪ وتواجد روسي'], TUR: ['شركة تركية', 'حصة 35٪ من الإنتاج'], ARE: ['صندوق إماراتي', 'حصة 35٪ من الإنتاج'], SAU: ['صندوق سعودي', 'حصة 35٪ من الإنتاج'], DEU: ['شركة ألمانية', 'حصة 40٪ من الإنتاج'], JPN: ['شركة يابانية', 'حصة 40٪ من الإنتاج'], KOR: ['شركة كورية', 'حصة 40٪ من الإنتاج'], IND: ['شركة هندية', 'حصة 40٪ من الإنتاج'] };
  function ensure(G) { if (!G.fund3) G.fund3 = { bonds: 0, stocks: 0, idx: 100, inv: [], loans: [], offers: [], inc: 0, nid: 1 }; return G.fund3; }
  const rng = G => { let a = ((G.rs || 1) * 13 + (G.t || 0) * 7727) | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const cashOf = G => G.nat ? G.nat.eco[0].cash : 0;
  const pay = (G, v) => { G.nat.eco[0].cash += v; };
  const total = G => { const F = ensure(G); return F.bonds + F.stocks + F.inv.reduce((t, i) => t + i.amt, 0) + F.loans.reduce((t, l) => t + l.left, 0); };
  // الإيداع والسحب (السندات والأسهم): الخزينة لازم تبقى موجبة بعد الإيداع
  function put(G, kind, v) { const F = ensure(G); if (!(v > 0)) return 'غلط'; if (cashOf(G) - v < 0) return 'الخزينة ما تكفي'; pay(G, -v); F[kind] += v; G.log.push({ t: G.t, k: 'fund', a: 'put', w: kind, v }); return { ok: true }; }
  function take(G, kind, v) { const F = ensure(G); v = Math.min(v, F[kind]); if (!(v > 0)) return 'ماكو فلوس بهالحساب'; F[kind] -= v; pay(G, v); G.log.push({ t: G.t, k: 'fund', a: 'take', w: kind, v }); return { ok: true }; }
  // وين نگدر نستثمر: دول علاقتها ويانا 30+، مو بحرب ويانا، ومو معاقبة عقوبات ثقيلة
  function okAbroad(G, WD, S, x) {
    if (x === G.me || !G.C[x]) return 'غلط'; if (S.rel(G, G.me, x) < 30) return 'العلاقة أقل من 30'; if (S.atWar(G, G.me, x)) return 'بحرب ويانا';
    if (G.sanc.some(s => s[0] === G.me && s[1] === x)) return 'معاقبينها'; if (WD.cs[x].sanc === 'heavy') return 'عليها عقوبات ثقيلة'; return null;
  }
  function invest(G, WD, S, x, k) {
    const err = okAbroad(G, WD, S, x); if (err) return err; const p = ABROAD[k], F = ensure(G); if (!p) return 'غلط';
    if (F.inv.filter(i => i.x === x).length >= 2) return 'عدنا مشروعين بهالدولة (الحد)';
    if (cashOf(G) - p.amt < 0) return 'الخزينة ما تكفي'; pay(G, -p.amt);
    F.inv.push({ id: F.nid++, x, k, amt: p.amt, yr: p.yr, t0: G.t }); S.addRel(G, G.me, x, p.rel); G.log.push({ t: G.t, k: 'fund', a: 'inv', x, pk: k, v: p.amt }); return { ok: true };
  }
  // القروض: لدول دخلها أقل من 15 ألف $ للفرد وعلاقتها 10+؛ الفائدة أعلى للأفقر والأقل استقراراً
  function loanTerms(G, x) { const c = G.C[x], pc = c.gdp * 1e9 / c.pop; return { amt: +clamp(c.gdp * .02, .5, 5).toFixed(1), rate: +clamp(.04 + (60 - c.stab) * .001 + (pc < 3000 ? .02 : 0), .03, .1).toFixed(3), mo: 60 }; }
  function lend(G, WD, S, x) {
    if (x === G.me || !G.C[x]) return 'غلط'; const c = G.C[x], pc = c.gdp * 1e9 / c.pop, F = ensure(G);
    if (pc > 15000) return 'دولة غنية ما تحتاج'; if (S.rel(G, G.me, x) < 10) return 'العلاقة أقل من 10'; if (S.atWar(G, G.me, x)) return 'بحرب ويانا'; if (F.loans.some(l => l.x === x)) return 'عندها قرض منا';
    const L = loanTerms(G, x); if (cashOf(G) - L.amt < 0) return 'الخزينة ما تكفي'; pay(G, -L.amt); c.debt += L.amt;
    F.loans.push({ id: F.nid++, x, amt: L.amt, left: L.amt, rate: L.rate, mo: L.mo, t0: G.t }); S.addRel(G, G.me, x, 10); G.log.push({ t: G.t, k: 'fund', a: 'loan', x, v: L.amt }); return { ok: true };
  }
  // كل شهر: العوائد للخزينة، الأسهم تتذبذب، المشاريع برّا تنخسر بالحرب أو الخلاف، القروض تترجع أو تتعثر، وعروض الشركات
  function month(G, WD, S) {
    if (!G.nat) return; const F = ensure(G), r = rng(G); let inc = 0;
    inc += F.bonds * .035 / 12;
    // الأسهم: متوسط 7٪ وتذبذب 15٪ بالسنة؛ الصدمات العالمية والنفط فوق 120$ تنزّلها
    const shock = (G.gshock && G.gshock.until > G.t ? -.06 : 0) + (G.oilP > 120 ? -.02 : 0);
    const m = .07 / 12 + (r() + r() + r() - 1.5) * .15 / Math.sqrt(12) * 2 + shock; F.stocks *= 1 + m; F.idx = +(F.idx * (1 + m)).toFixed(2);
    for (const i of F.inv.slice()) {
      const lost = S.atWar(G, G.me, i.x) ? 'الحرب' : S.rel(G, G.me, i.x) < -20 ? 'الخلاف' : G.sanc.some(s => s[0] === G.me && s[1] === i.x) ? 'العقوبات' : (G.C[i.x].stab < 15 && r() < .1) ? 'الفوضى هناك' : null;
      if (lost) { F.inv.splice(F.inv.indexOf(i), 1); G.log.push({ t: G.t, k: 'fund', a: 'lost', x: i.x, pk: i.k, v: i.amt, why: lost }); continue; }
      inc += i.amt * i.yr / 12; }
    for (const l of F.loans.slice()) {
      const c = G.C[l.x]; if ((c.crisis || c.stab < 20) && r() < .05) { F.loans.splice(F.loans.indexOf(l), 1); pay(G, l.left * .4); G.log.push({ t: G.t, k: 'fund', a: 'default', x: l.x, v: +(l.left * .6).toFixed(2) }); continue; }
      const back = l.amt / l.mo; inc += l.left * l.rate / 12; l.left = Math.max(0, l.left - back); pay(G, back); c.debt = Math.max(0, c.debt - back);
      if (l.left <= 1e-6) { F.loans.splice(F.loans.indexOf(l), 1); G.log.push({ t: G.t, k: 'fund', a: 'repaid', x: l.x }); } }
    // بحث «الخدمات المالية» يزيد الربح
    inc *= 1 + ((G.C[G.me] && G.C[G.me].fundK) || 0);
    pay(G, inc); F.inc = +inc.toFixed(3);
    // E4: عروض الشركات تجي أكثر إذا الاستقرار عالي، ماكو عقوبات، كفاءة أعلى، وكهرباء كافية
    F.offers = F.offers.filter(o => o.until > G.t);
    const c = G.C[G.me], sl = S.sancOf ? S.sancOf(G, WD, G.me) : (WD.cs[G.me].sanc || null), war = G.wars.some(w => w.a.includes(G.me) || w.b.includes(G.me));
    const p = clamp(.09 * (c.stab / 60) * (sl === 'heavy' ? .1 : sl ? .5 : 1) * (war ? .3 : 1) * (1 + (c.effK || 0) * 3), 0, .12);
    if (!F.offers.length && r() < p) {
      const from = Object.keys(FIRMS).filter(x => x !== G.me && G.C[x] && S.rel(G, G.me, x) > -10 && !S.atWar(G, G.me, x)).sort((a, b) => S.rel(G, G.me, b) + r() * 40 - S.rel(G, G.me, a) - r() * 40)[0];
      const ECO = root.WECO || (typeof require !== 'undefined' ? require('./weco.js') : null);
      const ks = ['power', 'port', 'refin', 'road'].concat(c.oil > 0 ? ['oil', 'oil'] : []), k = ks[Math.floor(r() * ks.length)];
      if (from && ECO && !ECO.can(G, WD, G.me, k)) { const cd = ECO.card(G, WD, G.me, k); F.offers.push({ id: F.nid++, from, k, v: cd.cost, terms: FIRMS[from][1], until: G.t + 60 }); G.log.push({ t: G.t, k: 'fund', a: 'offer', x: from, pk: k, v: cd.cost }); }
    }
  }
  // قبول العرض: المشروع ينبني ببلاش (الشركة تدفع)، بس 40٪ من أثره يروح إلها؛ العلاقة ويا دولتها تتحسن
  function answer(G, WD, S, id, yes) {
    const F = ensure(G), o = F.offers.find(x => x.id === id); if (!o) return 'العرض انتهى'; F.offers.splice(F.offers.indexOf(o), 1);
    if (!yes) { S.addRel(G, G.me, o.from, -3); G.log.push({ t: G.t, k: 'fund', a: 'reject', x: o.from, pk: o.k }); return { ok: true }; }
    const ECO = root.WECO || require('./weco.js'), r = ECO.start(G, WD, G.me, o.k); if (!r.ok) return r;
    r.q.cost = 0; r.q.share = .4; r.q.fx = o.from; S.addRel(G, G.me, o.from, 8); G.log.push({ t: G.t, k: 'fund', a: 'accept', x: o.from, pk: o.k, v: o.v }); return { ok: true };
  }
  const API = { ABROAD, FIRMS, ensure, total, put, take, okAbroad, invest, loanTerms, lend, month, answer };
  if (typeof module !== 'undefined') module.exports = API; else root.WFUND = API;
})(typeof window !== 'undefined' ? window : globalThis);
