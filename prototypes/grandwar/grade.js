// «الحرب الكبرى» GW11 B5: طرق الفوز الأربعة والتقييم S–D. بدون رسم؛ فحص tests/grade.test.mjs.
// كل طريق 0–100:
//  ⚔ عسكري: مدن إيران اللي بيدنا (30% من نقاطهم = كامل) + مدننا اللي باقية + نسبة الإسقاط
//  💰 اقتصادي: الخزينة فوق حد الدين + صادرات النفط من أصلها + ماكو دين
//  🤝 سياسي: حلفاء دخلوا ويانا + عقوبات على إيران + مين أتعب (تعب إيران ضد تعبنا)
//  🙂 الشعب: معنويات الشعب + ما خسرنا مدن
// التقييم = عسكري 40% + اقتصادي 20% + سياسي 20% + الشعب 20%، وبعدين نهاية الحرب: استسلام إيران S، استسلامنا D، سلام بفوز +15، بخسارة −25
(function (root) {
  const cl = v => Math.max(0, Math.min(100, v));
  function paths(W, A, X, me = 0) {
    const { DIP, ECON } = X, o = 1 - me, V = DIP.vpOf(W), e = W.eco ? W.eco[me] : { cash: 0, mor: 50 };
    const held = V.held[me] / W.vpTotal[o], kept = V.own[me] / W.vpTotal[me];
    const kr = A ? Math.min(1, A.kills[me] / Math.max(1, A.kills[o]) / 2) : .5;
    const mil = cl(Math.min(1, held / .3) * 55 + kept * 30 + kr * 15 - (1 - kept) * 40);
    const L = ECON.LAND[me], ex = ECON.oilOf(W, me).exp, ex0 = ECON.SITES.filter(s => s.side === me && !s.term).reduce((t, s) => t + s.out, 0) * L.exp;
    const eco = cl(Math.max(0, Math.min(1, (e.cash + L.lim) / (L.lim + 30))) * 50 + Math.min(1, ex / ex0) * 30 + (e.cash >= 0 ? 20 : 0));
    const D = W.dip; let dip = 0;
    if (D) { const allies = DIP.COUNTRIES.filter(C => D.c[C.id].st === 'ally' + me).length; dip = cl(Math.min(2, allies) * 20 + (D.sanc > W.t ? 15 : 0) + Math.max(0, Math.min(1, (DIP.weary(W, o) - DIP.weary(W, me) + .5))) * 45); }
    const pop = cl(e.mor * .8 + kept * 20);
    return { mil: Math.round(mil), eco: Math.round(eco), dip: Math.round(dip), pop: Math.round(pop) };
  }
  const GR = [[85, 'S', 'قائد أسطوري'], [70, 'A', 'نصر واضح'], [55, 'B', 'قيادة ناجحة'], [40, 'C', 'صمود'], [-1, 'D', 'قيادة متعثرة']];
  function grade(W, A, X, me = 0) {
    const p = paths(W, A, X, me); let sc = p.mil * .4 + p.eco * .2 + p.dip * .2 + p.pop * .2; const ov = W.over;
    if (ov) { if (ov.peace) sc += ov.res === 'win' ? 15 : ov.res === 'loss' ? -25 : 0; else if (ov.loser === 1 - me) sc = 100; else if (ov.loser === me) sc = Math.min(sc, 20); }
    sc = Math.round(cl(sc)); const g = GR.find(r => sc >= r[0]);
    return { score: sc, g: g[1], t: g[2], p, ez: !!(W.cfg && W.cfg.ez && W.cfg.ez.used) };
  }
  const API = { paths, grade, GR };
  if (typeof module !== 'undefined') module.exports = API; else root.GRADE = API;
})(this);
