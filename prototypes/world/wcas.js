// «العالم» v3 C1 (I-118): القتلى والجرحى والأسرى والمدنيين — من كل معركة وضربة وسفينة تغرق
// النسب [تقدير مشهور من حروب حديثة]: من خسائر الوحدة ~25٪ قتلى، ~65٪ جرحى، ~10٪ أسرى ومفقودين (الجرحى ~2.5–3 أضعاف القتلى).
// الجرحى يحتاجون مستشفيات: إذا السعة ما تكفي، يموت أكثر والمعنويات تنزل. الأسلوب: أرقام وانفجارات، بلا دم.
// التصميم: docs/features/world-v3-plan.md (C1) · فحص: node tests/wcas.test.mjs
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const POP = root.WPOP || (typeof require !== 'undefined' ? require('./wpop.js') : null);
  const Z = () => ({ kia: 0, wia: 0, pow: 0, civ: 0, tk: 0, pl: 0, sh: 0 });
  // طاقم السفن (تقريب): حاملة ~5000، طراد/مدمرة ~300، فرقاطة ~200، كورفيت ~80، غواصة ~100، زورق ~20
  const CREW = k => /carrier|cv/i.test(k) ? 5000 : /cru|des|dd/i.test(k) ? 300 : /fri|ff/i.test(k) ? 200 : /cor/i.test(k) ? 80 : /sub|ss/i.test(k) ? 100 : 20;
  function ensure(G) { if (!G.cas3) G.cas3 = { c: {}, care: {}, day: { t: -1, me: Z(), en: Z() }, rep: [], hot: [], snap: {} }; return G.cas3; }
  const tot = (G, id) => { const C = ensure(G); return C.c[id] || (C.c[id] = Z()); };
  // خسائر من حرب اللاعب؟ (للعدادات اليومية)
  const foeOfMe = (G, id) => G.wars.some(w => (w.a.includes(G.me) && w.b.includes(id)) || (w.b.includes(G.me) && w.a.includes(id)));
  // يضيف خسائر لدولة: o = { kia, wia, pow, civ, tk, pl, sh }، where = مكان (للنقاط الساخنة)
  function add(G, id, o, where) {
    if (!G.C[id]) return; const C = ensure(G), T = tot(G, id);
    // I-135: الروبوتات القتالية تنقص خسائرنا البشرية
    if (id === G.me && G.ars && G.ars.done.ugv && (root.WARS || (typeof require !== 'undefined' && require('./warsenal.js')))) { const k = (root.WARS || require('./warsenal.js')).casK(G); o = { ...o, kia: (o.kia || 0) * k, wia: (o.wia || 0) * k, pow: (o.pow || 0) * k }; }
    if (C.day.t !== Math.floor(G.t)) { C.day = { t: Math.floor(G.t), me: Z(), en: Z() }; }
    const bucket = id === G.me ? C.day.me : foeOfMe(G, id) ? C.day.en : null;
    for (const k in o) { const v = Math.max(0, Math.round(o[k] || 0)); T[k] += v; if (bucket) bucket[k] += v; }
    C.care[id] = (C.care[id] || 0) + Math.round(o.wia || 0);
    const dead = Math.round((o.kia || 0) + (o.civ || 0)); if (dead && POP && G.pop3) POP.loss(G, id, dead);
    // المعنويات وتعب الحرب: 1000 قتيل ببلد 50 مليون ≈ −0.2 معنويات [تقدير]
    const hit = dead / Math.max(1, G.C[id].pop / 1e6) * .01;
    if (id === G.me && G.nat) G.nat.eco[0].mor = clamp(G.nat.eco[0].mor - hit, 0, 100); else G.C[id].stab = clamp(G.C[id].stab - hit * .3, 0, 100);
    for (const w of G.wars) if (w.a.includes(id) || w.b.includes(id)) w.weary[id] = clamp((w.weary[id] || 0) + hit * .5, 0, 100);
    if (where && dead + (o.wia || 0) > 0) { C.hot.push({ t: G.t, id, n: dead + (o.wia || 0), ...where }); if (C.hot.length > 60) C.hot.splice(0, C.hot.length - 60); }
  }
  // خسائر وحدة عسكرية: men = عدد الرجال اللي راحوا من الوحدة
  const unit = (men, pow = .1) => ({ kia: men * .25, wia: men * (.75 - pow), pow: men * pow });
  // حروب الدول الثانية (المحاكاة المجردة): كل شهر ~2٪ من الجيش العامل خسائر (قتلى+جرحى+أسرى)، أكثر على الأضعف
  // (روسيا بأوكرانيا ≈ 25–35 ألف بالشهر بتقديرات 2024–2025) [تقدير بحدود المصادر]
  function warMonth(G, WD, w) {
    if (w.detail) return; const r = w.r || 1;
    for (const [side, k] of [[w.a, clamp(1 / r, .6, 2)], [w.b, clamp(r, .6, 2)]]) for (const id of side) {
      const act = (WD.cs[id] && WD.cs[id].act) || G.C[id].pop * .004, men = act * .012 * k * (side.length > 1 && id !== side[0] ? .3 : 1);
      add(G, id, { ...unit(men, .06), tk: men / 900 * 3, civ: men * .15 }, { war: w.id });
    }
  }
  // الضربات: كل صاروخ يوصل مدينة ≈ 3 ضحايا مدنيين و9 جرحى؛ على هدف عسكري ≈ 1.5 قتيل [تقدير من ضربات 2022–2025]
  function strike(G, r) {
    if (!r || !r.hits) return;
    if (r.kind === 'city') add(G, r.t, { civ: r.hits * 3, wia: r.hits * 9 }, { strike: 1 });
    else if (r.kind === 'mil') add(G, r.t, { kia: r.hits * 1.5, wia: r.hits * 4 }, { strike: 1 });
    else add(G, r.t, { civ: r.hits * .5, wia: r.hits * 1.5 }, { strike: 1 });
  }
  // سفينة تغرق: ~40٪ من الطاقم يموتون، 30٪ جرحى، والباقي ينسحبون
  function sink(G, cc, ty, z) { const n = CREW(ty || ''); add(G, cc, { kia: n * .4, wia: n * .3, sh: 1 }, { sea: z }); }
  // مسرح حرب اللاعب: نقارن قوة كل فرقة بآخر مرة (الخسائر = الفرق × عدد رجالها)
  function theater(G, T, TEMPL) {
    if (!T || !T.W) return; const C = ensure(G), S = C.snap, W = T.W;
    for (const d of W.divs) {
      const tp = TEMPL[d.kind] || { men: 9000, tk: 0 }, key = T.war + ':' + d.id, prev = S[key], cur = d.dead ? 0 : d.str;
      if (prev != null && prev > cur + 1e-4) { const lost = (prev - cur) * tp.men, id = T.side[d.side][0];
        add(G, id, { ...unit(lost, d.dead ? .5 : .08), tk: (prev - cur) * (tp.tk || 0) * .8 }, { cell: d.cell, war: T.war }); }
      S[key] = cur;
    }
  }
  // تقرير معركة (C2): ينادى لما منطقة تنسقط
  function report(G, o) { const C = ensure(G); C.rep.push({ t: G.t, ...o }); if (C.rep.length > 30) C.rep.shift(); }
  // كل شهر: الجرحى بالمستشفيات — يطيبون (~50٪ بالشهر، 65٪ ويا بحث الأدوية)، والزايد عن السعة يموت أكثر
  function month(G) {
    const C = ensure(G);
    for (const id in C.care) { const n = C.care[id]; if (!n || !G.C[id]) continue; const c = G.C[id], p = G.pop3 && G.pop3[id];
      const cap = cap0(G, id), over = Math.max(0, n - cap), died = Math.round(over * .06 + Math.min(n, cap) * .01);
      if (died) { tot(G, id).kia += died; if (POP && G.pop3) POP.loss(G, id, died); if (id === G.me && G.nat && over > 0) G.nat.eco[0].mor = clamp(G.nat.eco[0].mor - Math.min(4, over / cap * 3), 0, 100); }
      C.care[id] = Math.max(0, Math.round((n - died) * (1 - (c.heal ? .65 : .5)))); C.over = C.over || {}; C.over[id] = over; }
    C.snap = Object.fromEntries(Object.entries(C.snap).filter(([k]) => G.wars.some(w => k.startsWith(w.id + ':'))));
  }
  // سعة المستشفيات للجرحى: ~2.5 سرير لكل ألف × الصحة × 15٪ للحرب، وكل شبكة مستشفيات (المشاريع) +20٪ [تقدير]
  const cap0 = (G, id) => { const c = G.C[id], p = G.pop3 && G.pop3[id]; return Math.round(c.pop / 1000 * 2.5 * (p ? p.hea : .6) * .15 * (1 + .2 * (c.hosp || 0))); };
  // أعنف 3 أماكن بآخر 3 أيام (للنقاط الساخنة بغرفة العمليات)
  function hot(G, n = 3) { const C = ensure(G), m = new Map(); for (const h of C.hot) { if (G.t - h.t > 3) continue; const k = h.cell != null ? 'c' + h.cell : h.sea != null ? 's' + h.sea : h.war != null ? 'w' + h.war : 'x'; const e = m.get(k) || { ...h, n: 0 }; e.n += h.n; m.set(k, e); } return [...m.values()].sort((a, b) => b.n - a.n).slice(0, n); }
  const API = { ensure, add, unit, warMonth, strike, sink, theater, report, month, hot, cap: cap0, CREW, tot };
  if (typeof module !== 'undefined') module.exports = API; else root.WCAS = API;
})(typeof window !== 'undefined' ? window : globalThis);
