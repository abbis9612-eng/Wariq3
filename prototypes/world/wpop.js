// «العالم» v3 P (I-120): السكان يتغيرون كل شهر — ولادات، وفيات، هجرة ولاجئين، فئات الأعمار، البطالة، الخدمات، ومؤشر التنمية
// الأرقام: الخصوبة والعمر المتوقع من الأمم المتحدة (World Population Prospects 2024، تقريب لأقرب عُشر) للدول المهمة،
// والباقي [تقدير] من دخل الفرد. التصميم: docs/features/world-v3-plan.md (P) · فحص: node tests/wpop.test.mjs
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // [الخصوبة (ولد لكل امرأة)، العمر المتوقع]
  const DEMO = {
    IRQ: [3.4, 72], IRN: [1.7, 77], SAU: [2.3, 78], TUR: [1.6, 78], EGY: [2.8, 71], SYR: [2.7, 72], LBN: [2.0, 77], JOR: [2.6, 77], ISR: [2.9, 83],
    YEM: [3.7, 69], KWT: [2.0, 80], ARE: [1.4, 80], QAT: [1.8, 82], OMN: [2.5, 79], BHR: [1.8, 80], PSE: [3.4, 74], LBY: [2.4, 72], DZA: [2.7, 77],
    MAR: [2.3, 75], TUN: [1.8, 77], SDN: [4.3, 66], AFG: [4.8, 66], PAK: [3.5, 67], IND: [2.0, 72], CHN: [1.0, 78], RUS: [1.4, 73], UKR: [1.0, 70],
    USA: [1.6, 79], GBR: [1.5, 81], FRA: [1.7, 83], DEU: [1.4, 81], ITA: [1.2, 83], ESP: [1.1, 84], JPN: [1.2, 84], KOR: [.72, 84], TWN: [.87, 80],
    PRK: [1.8, 73], BRA: [1.6, 76], MEX: [1.8, 75], NGA: [4.4, 54], ETH: [4.0, 66], ZAF: [2.3, 62], AUS: [1.6, 84], CAN: [1.3, 82], VEN: [2.2, 72],
    IDN: [2.1, 71], BGD: [1.9, 73], AZE: [1.6, 74], ARM: [1.6, 76], GEO: [1.8, 72], KAZ: [3.0, 74], POL: [1.2, 78], CUB: [1.4, 78], SOM: [6.1, 57],
  };
  // نسبة الكبار (65+) الحقيقية لدول مهمة (البنك الدولي 2023، تقريب)
  const O65 = { JPN: .29, KOR: .19, CHN: .14, DEU: .22, ITA: .24, USA: .18, RUS: .16, IRN: .08, IND: .07, TUR: .10, UKR: .18, TWN: .19, ESP: .21, FRA: .22, GBR: .19, IRQ: .035, SAU: .03, EGY: .05 };
  const pcOf = c => c.gdp * 1e9 / c.pop;
  // الأساس من الدخل (للدول اللي ما بيها رقم): الأفقر خصوبتها أعلى وعمرها أقصر [تقدير]
  const guess = pc => [+(1.5 + 3.6 / (1 + pc / 3000)).toFixed(1), Math.round(clamp(52 + 11 * Math.log10(Math.max(300, pc) / 300), 52, 84))];
  // مؤشر التعليم والصحة (0–1): بداية من الدخل والعمر، ويرتفع بالمشاريع (جامعات، مستشفيات) وبحوث المجتمع
  const eduOf = pc => clamp(.2 + .3 * Math.log10(Math.max(500, pc) / 500), .2, .95);
  function make(G, WD, id) {
    const c = G.C[id], pc = pcOf(c), [tfr, le] = DEMO[id] || guess(pc);
    // فئات الأعمار من الخصوبة والعمر (تقريب): العراق ≈ 37٪ أطفال، 59٪ عاملين، 4٪ كبار؛ اليابان ≈ 12٪ / 59٪ / 29٪
    const k = clamp(.07 + .09 * tfr, .1, .5), o = O65[id] ?? clamp(.02 + .25 * Math.exp(-(tfr - 1) * 1.1) * (le > 74 ? 1 : .6), .02, .3), w = 1 - k - o;
    const un = clamp(pc < 5000 ? .14 : pc < 15000 ? .11 : .06, .03, .3);
    return { tfr, le, k: +k.toFixed(3), w: +w.toFixed(3), o: +o.toFixed(3), edu: +eduOf(pc).toFixed(3), hea: +clamp((le - 45) / 40, .1, 1).toFixed(3), un, un0: un, mig: 0, ref: 0, dead: 0, b: 0, d: 0, wg0: null, st: 0 };
  }
  function ensure(G, WD) {
    if (!G.pop3) { G.pop3 = {}; for (const id of G.ids) G.pop3[id] = make(G, WD, id); }
    return G.pop3;
  }
  // كل شهر لكل دولة: ينادى من wsim.econ (war = حرب على أرضنا)
  function tick(G, WD, id, war) {
    const P = ensure(G, WD), p = P[id] || (P[id] = make(G, WD, id)), c = G.C[id], pc = pcOf(c), pop = c.pop;
    // الولادات: الخصوبة × نسبة العاملين (النساء بعمر الإنجاب تقريباً) — العراق ≈ 2.5٪ بالسنة، اليابان ≈ 0.9٪
    const cbr = p.tfr * p.w * .0125 * (war ? .85 : 1);
    // الوفيات: الكبار يعيشون (العمر المتوقع − 62) سنة بعد التقاعد تقريباً، وشوية من الصغار حسب الصحة (والحرب تحسب لحالها من القتال، C1)
    const yrs = Math.max(8, p.le - 62), oldD = p.o / yrs, cdr = oldD + .0015 + Math.max(0, 75 - p.le) * .0003;
    // الهجرة: الاقتصاد والاستقرار يجذبون أو يطردون؛ الحرب على أرضنا = لاجئين (~1٪ بالسنة) [تقدير]
    // الدول الغنية تجذب مهاجرين (~0.3٪ بالسنة) [تقدير]
    // الدول الفقيرة ما تجذب مهاجرين حتى لو نموها عالي
    let mig = clamp((pc > 30000 ? .003 : 0) + (c.g - 2) * .0006 + (c.stab - 50) * .00008, -.008, .006); if (mig > 0) mig *= Math.min(1, pc / 20000); mig -= war ? .01 : 0;
    const births = pop * cbr / 12, deaths = pop * cdr / 12, move = pop * mig / 12;
    p.b = Math.round(births); p.d = Math.round(deaths); p.mig = Math.round(move); if (war) p.ref += Math.round(pop * .01 / 12);
    // الأعمار: الأطفال يكبرون (1/15 بالسنة)؛ المتقاعدين الجدد = اللي يموتون من الكبار + 3٪ (المجتمع يشيخ ببطء)؛ والوفيات الثانية من الصغار والعاملين
    const ret = (oldD * 1.03 + .0015) * pop / 12, oD = oldD * pop / 12, yD = deaths - oD;
    let K = p.k * pop + births - p.k * pop / 15 / 12 - yD * .4, Wk = p.w * pop + p.k * pop / 15 / 12 - ret - yD * .6 + move * .9, O = p.o * pop + ret - oD + move * .1;
    K = Math.max(1, K); Wk = Math.max(1, Wk); O = Math.max(1, O); const n = K + Wk + O;
    const wGrowth = (Wk / (p.w * pop) - 1) * 12;
    p.k = +(K / n).toFixed(4); p.w = +(Wk / n).toFixed(4); p.o = +(O / n).toFixed(4); c.pop = Math.round(n);
    // الخصوبة تنزل ببطء ويا تعليم المرأة (أقوى عامل) والدخل والتمدّن — 3٪ من الفرق بالسنة
    const tfrT = clamp(1.3 + 3.4 * (1 - p.edu) / (1 + pc / 20000), 1, 7); p.tfr = +(p.tfr + (tfrT - p.tfr) * .03 / 12).toFixed(3);
    // التعليم والصحة يتحسنون ببطء ويا الدخل والمشاريع (كل جامعة +3٪، كل شبكة مستشفيات +3٪)
    const eduT = clamp(eduOf(pc) + .03 * (c.univ || 0) + (c.socR || 0), .2, 1), heaT = clamp((p.le0 ?? (p.le0 = p.le)) / 85 - .2 + .03 * (c.hosp || 0) + (c.socR || 0), .1, 1);
    p.edu = +(p.edu + (eduT - p.edu) * .05 / 12).toFixed(4); p.hea = +(p.hea + (heaT - p.hea) * .05 / 12).toFixed(4);
    p.le = +clamp(p.le + ((45 + 40 * p.hea) - p.le) * .02 / 12 - (war ? .05 : 0), 40, 88).toFixed(2);
    // البطالة: النمو أقل من العادي = بطالة أكثر (قانون أوكن تقريباً)، والتعبئة تسحب عاطلين
    p.un = +clamp(p.un0 + (c.g0 - c.g) * .004 - (G.nat && id === G.me && G.nat.eco[0].mob ? .02 : 0), .02, .45).toFixed(3);
    if (p.wg0 == null) p.wg0 = wGrowth;
    p.wg = wGrowth;
    p.hdi = hdi(G, id);
    // الشارع للاعب: فرق البطالة عن البداية يزعّل أو يرضّي (يتطبّق كفرق حتى ما يتراكم)
    if (id === G.me && G.nat && G.nat.home) { const b = G.nat.home.base || (G.nat.home.base = {}), want = Math.round(-clamp((p.un - p.un0) * 40, -2, 6)); b.street = (b.street || 55) + want - p.st; p.st = want; }
  }
  // أثر قوة العمل على النمو: فرق نمو العاملين عن البداية (نص نقطة لكل 1٪)
  const growth = (G, id) => { const p = G.pop3 && G.pop3[id]; return p && p.wg0 != null ? clamp((p.wg - p.wg0) * 50, -1.5, 1) : 0; };
  // أثر البطالة على الاستقرار (للدول الثانية؛ اللاعب عبر الشارع)
  const stab = (G, id) => { const p = G.pop3 && G.pop3[id]; return p ? -clamp((p.un - p.un0) * 40, -2, 6) : 0; };
  // مؤشر التنمية (مثل HDI): العمر، التعليم، الدخل
  function hdi(G, id) {
    const p = G.pop3[id], c = G.C[id], pc = pcOf(c);
    const L = clamp((p.le - 20) / 65, 0, 1), E = clamp(p.edu, 0, 1), I = clamp(Math.log(Math.max(100, pc) / 100) / Math.log(750), 0, 1);
    return +Math.cbrt(L * E * I).toFixed(3);
  }
  // القتلى بالحرب (C1 يناديها): ينقصون من العاملين أكثر شي
  function loss(G, id, n) {
    const p = G.pop3 && G.pop3[id], c = G.C[id]; if (!p || !c || !(n > 0)) return;
    const pop = c.pop / (p.k + p.w + p.o), Wk = Math.max(1, p.w * pop - n * .85), K = Math.max(1, p.k * pop - n * .1), O = Math.max(1, p.o * pop - n * .05), t = K + Wk + O;
    p.k = +(K / t).toFixed(4); p.w = +(Wk / t).toFixed(4); p.o = +(O / t).toFixed(4); c.pop = Math.round(t); p.dead += Math.round(n);
  }
  const API = { DEMO, ensure, make, tick, growth, stab, hdi, loss, guess };
  if (typeof module !== 'undefined') module.exports = API; else root.WPOP = API;
})(typeof window !== 'undefined' ? window : globalThis);
