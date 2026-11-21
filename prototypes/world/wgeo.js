// «العالم» v5-2 (I-145، D-060): بعد استسلام دولة — ضم، حكومة تابعة، أو تعويض. كل خيار إله ثمن (الركيزة 4: القوة إلها ثمن).
// ضم: أرضها كلها إلنا (النفط والسكان وجزء من الاقتصاد)، الدولة تختفي من العالم، خوف عالمي وعقوبات، والمناطق «محتلة» 3 سنين (مقاومة) قبل ما تندمج.
// تابعة: تبقى دولة بس تحالف إجباري، تدفع 8٪ من إيراداتها كل شهر، ولونها بلوننا على الخريطة؛ تتمرد إذا ضعفت أو كرهتنا.
// تعويض: أرضها ترجع، ناخذ فلوس (10٪ من ناتجها، لحد 50 مليار)، والعلاقة تتحسن.
// فحص: node tests/wgeo.test.mjs
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const WEST = ['USA', 'GBR', 'FRA', 'DEU', 'CAN', 'ITA', 'JPN', 'AUS'];
  function ensure(G) { if (!G.geo) G.geo = { annex: {}, pup: {}, post: null }; return G.geo; }
  // شنو يصير بكل خيار (للعرض قبل القرار)
  function preview(G, WD, by, x) {
    const c = G.C[x], n = WD.r.filter((r, i) => G.ctl[i] === x || (G.ctl[i] === by && r[1] === x)).length;
    return {
      annex: `أرضهم كلها (${n} منطقة) ونفطهم وسكانهم (${(c.pop / 1e6).toFixed(1)} مليون) تصير إلنا، و+50٪ من اقتصادهم. الثمن: كل العالم يخاف (علاقات −10، جيرانهم وحلفاؤهم −25)، عقوبات من الغرب إذا علاقتنا وياهم مو زينة، ومقاومة بالمناطق 3 سنين`,
      pup: `يبقون دولة بس تابعين إلنا: تحالف إجباري، يدخلون حروبنا، ويدفعون ~${(Math.max(0, (c.budget ? c.budget.rev : c.gdp * .02)) * .08).toFixed(2)} مليار كل شهر. يتمردون إذا ضعفوا أو كرهونا`,
      comp: `أرضهم ترجعلهم ونسحب جيشنا، وناخذ تعويض ${Math.min(50, c.gdp * .1).toFixed(1)} مليار. العلاقة ويا العالم تتحسن`,
    };
  }
  function strip(G, x) {   // تشيل الدولة المضمومة من كل أنظمة العالم
    G.ids = G.ids.filter(k => k !== x);
    for (const w of G.wars.slice()) { w.a = w.a.filter(k => k !== x); w.b = w.b.filter(k => k !== x); if (!w.a.length || !w.b.length) G.wars.splice(G.wars.indexOf(w), 1); }
    G.pacts = (G.pacts || []).filter(p => p[0] !== x && p[1] !== x); if (G.blocs) G.blocs = G.blocs.map(m => m.filter(k => k !== x));
    G.sanc = (G.sanc || []).filter(s => s[0] !== x && s[1] !== x); if (G.elec) delete G.elec[x]; G.offers = (G.offers || []).filter(o => o.from !== x);
    if (G.trade) G.trade = G.trade.filter(p => p[0] !== x && p[1] !== x); if (G.nav && G.nav.g) G.nav.g = G.nav.g.filter(g => g.cc !== x);
    if (G.natoL) G.natoL = G.natoL.filter(k => k !== x);
  }
  function annex(G, WD, S, by, x) {
    const A = ensure(G), cb = G.C[by], cx = G.C[x]; if (!cx || cx.dead) return 'غلط';
    for (let i = 0; i < WD.r.length; i++) if (G.ctl[i] === x || WD.r[i][1] === x && G.ctl[i] !== by && !G.ids.includes(G.ctl[i])) G.ctl[i] = by;
    cb.core += cx.core * .5; cb.pop += cx.pop; cb.debt += cx.debt * .5; cb.pw += cx.pw * .3; cb.pw0 = (cb.pw0 || cb.pw) + cx.pw * .3;
    cx.dead = 1; cx.annexBy = by; A.annex[x] = { by, t: G.t };
    // الخوف: كل العالم −10، جيرانهم وحلفاؤهم −25؛ التوتر +8؛ الغرب يعاقب إذا علاقتنا وياه تحت 20
    for (const k of G.ids) if (k !== by && k !== x) { const near = S.allied(G, k, x) || WD.r.some((r, i) => r[1] === x && r[7].some(nb => G.ctl[G.idx.get(nb)] === k)); S.addRel(G, k, by, near ? -25 : -10); }
    G.ten = clamp((G.ten || 0) + 8, 0, 100);
    for (const k of WEST) if (G.C[k] && k !== by && S.rel(G, k, by) < 20 && !G.sanc.some(s => s[0] === k && s[1] === by)) G.sanc.push([k, by, 'light']);
    strip(G, x); G.log.push({ t: G.t, k: 'annex', by, x });
    return { ok: true };
  }
  function puppet(G, WD, S, by, x) {
    const A = ensure(G), cx = G.C[x]; if (!cx || cx.dead) return 'غلط';
    for (let i = 0; i < WD.r.length; i++) if (WD.r[i][1] === x && G.ctl[i] === by) G.ctl[i] = x;   // أرضهم ترجعلهم
    A.pup[x] = { by, t: G.t }; if (!S.allied(G, by, x)) G.pacts.push([by, x]);
    G.rel[x] = G.rel[x] || {}; G.rel[by] = G.rel[by] || {}; G.rel[x][by] = Math.max(G.rel[x][by] || 0, 30); G.rel[by][x] = Math.max(G.rel[by][x] || 0, 50);
    cx.stab = clamp(cx.stab - 10, 0, 100); G.ten = clamp((G.ten || 0) + 3, 0, 100);
    for (const k of G.ids) if (k !== by && k !== x && S.allied(G, k, x)) S.addRel(G, k, by, -15);
    G.log.push({ t: G.t, k: 'puppet', by, x }); return { ok: true };
  }
  function compensate(G, WD, S, by, x) {
    const cx = G.C[x]; if (!cx || cx.dead) return 'غلط';
    for (let i = 0; i < WD.r.length; i++) if (WD.r[i][1] === x && G.ctl[i] === by) G.ctl[i] = x;
    const v = +Math.min(50, cx.gdp * .1).toFixed(1); cx.debt += v; if (by === G.me && G.nat) G.nat.eco[0].cash += v; else G.C[by].core += v * .2;
    S.addRel(G, x, by, 10); for (const k of G.ids) if (k !== by && k !== x) S.addRel(G, k, by, 3);
    G.log.push({ t: G.t, k: 'comp', by, x, v }); return { ok: true, v };
  }
  // قرار اللاعب بعد الاستسلام
  function decide(G, WD, S, how) { const A = ensure(G), P = A.post; if (!P) return 'ماكو قرار'; A.post = null; const f = { annex, pup: puppet, comp: compensate }[how]; return f ? f(G, WD, S, G.me, P.x) : 'غلط'; }
  // كل شهر: التابعين يدفعون، ويتمردون إذا ضعفوا أو كرهونا؛ المضموم يندمج بعد 3 سنين
  function month(G, WD, S) {
    const A = ensure(G), r = G.rnd || Math.random;
    for (const x in A.pup) { const p = A.pup[x], cx = G.C[x], cb = G.C[p.by]; if (!cx || cx.dead || !cb) { delete A.pup[x]; continue; }
      const t = Math.max(0, (cx.budget ? cx.budget.rev : cx.gdp * .02) * .08); cx.debt += t; if (p.by === G.me && G.nat) G.nat.eco[0].cash += t; else cb.core += t * .2; p.paid = +((p.paid || 0) + t).toFixed(2);
      const hate = S.rel(G, x, p.by) < 0, weak = cb.pw < cx.pw * .8, unstable = cx.stab < 20;
      if ((hate || weak || unstable) && r() < (hate ? .04 : .02)) { delete A.pup[x]; G.pacts = G.pacts.filter(q => !((q[0] === p.by && q[1] === x) || (q[0] === x && q[1] === p.by))); S.addRel(G, x, p.by, -40); G.log.push({ t: G.t, k: 'pupfree', by: p.by, x, why: hate ? 'hate' : weak ? 'weak' : 'chaos' }); } }
  }
  // المضموم: مناطقه «محتلة» لحد 3 سنين، بعدها تندمج (wpol.occupation يسأل هنا)
  const integrated = (G, origin, k) => { const a = G.geo && G.geo.annex[origin]; return !!(a && a.by === k && G.t - a.t > 365 * 3); };
  const isAnnexed = (G, origin) => !!(G.geo && G.geo.annex[origin]);
  const API = { ensure, preview, annex, puppet, compensate, decide, month, integrated, isAnnexed };
  if (typeof module !== 'undefined') module.exports = API; else root.WGEO = API;
})(typeof window !== 'undefined' ? window : globalThis);
