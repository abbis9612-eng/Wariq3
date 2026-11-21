// «العالم» v5-4 (I-147، D-060): نظام الحكم (5 أنظمة بآثار) والتحالف الإسلامي. فحص: node tests/wgov.test.mjs
// الأنظمة: برلمانية، رئاسية، ملكية، حكم عسكري، نظام إسلامي. كل نظام يغيّر: الفئات اللي تسندك، الانتخابات، العلاقات، ونقاط القرار (أسرع مقابل شرعية).
// التغيير: إصلاح (⭐3، 12–24 شهر، يحتاج سند فئة) أو انقلاب/ثورة (⭐2، فوري، خطر يفشل).
// التحالف الإسلامي: النظام الإسلامي أو الملكية يأسّسون (⭐3) ويدعون دول منظمة التعاون الإسلامي (⭐1)؛ 3 درجات: اقتصادي، دفاعي (دفاع مشترك)، قيادة موحّدة.
// الذكاء: الانقلاب بالدول الضعيفة ممكن يطلع حكم عسكري، والدول الإسلامية الكبيرة ممكن تأسّس تحالف منافس وتدعوك. الأرقام [تقدير].
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const WEST = ['USA', 'GBR', 'FRA', 'DEU', 'CAN', 'ITA', 'JPN', 'AUS'];
  // pil = الفئة اللي لازم تسند التغيير؛ base = تعديل الوضع الطبيعي للفئات؛ ap = نقاط قرار إضافية بالشهر
  const GOV = {
    parl: { n: 'جمهورية برلمانية', ic: '🏛', demo: 1, ap: 0, fk: ['army', 'parties', 'street', 'biz'], pil: 'street', base: { parties: 4, street: 2 }, d: 'انتخابات كل 4 سنين وبرلمان. شرعية عالية والغرب يرتاح، بس القرار أبطأ والأحزاب تشاركك' },
    pres: { n: 'جمهورية رئاسية', ic: '🎙', demo: 1, ap: .25, fk: ['army', 'parties', 'street', 'biz'], pil: 'street', base: { street: 2 }, d: 'رئيس منتخب بصلاحيات واسعة: انتخابات كل 4 سنين، وقرار أسرع شوية (+1 نقطة كل 4 أشهر)' },
    amon: { n: 'ملكية', ic: '👑', demo: 0, ap: .5, fk: ['royal', 'army', 'clergy', 'street', 'biz'], pil: 'army', base: { royal: 10, street: -3 }, d: 'ملك يحكم بلا انتخابات: الأسرة الحاكمة ورجال الدين سند، الخليج يرتاح، والغرب يتقبل. +1 نقطة قرار كل شهرين' },
    mil: { n: 'حكم عسكري', ic: '🎖', demo: 0, ap: 1, fk: ['army', 'militia', 'street', 'biz'], pil: 'army', base: { army: 8, street: -10, biz: -4 }, d: 'الجيش يحكم: نقطة قرار إضافية كل شهر، بس الشرعية واطية: الغرب يعاقب، الشارع يغلي، والانقلاب أسهل' },
    theo: { n: 'نظام إسلامي', ic: '🕌', demo: 0, ap: .5, fk: ['clergy', 'irgc', 'army', 'street', 'biz'], pil: 'clergy', base: { clergy: 12, biz: -6 }, d: 'الشريعة مصدر التشريع: رجال الدين والحرس سند، الدول الإسلامية تقترب والغرب يبعد، +1 نقطة كل شهرين، ويفتح تأسيس تحالف إسلامي' },
  };
  const ORDER = ['parl', 'pres', 'amon', 'mil', 'theo'];
  const TERM = { parl: 4, pres: 4 };
  const BCOL = ['#0f7f6a', '#7a4ea3', '#9c6b1e'];
  const LVL = ['', 'اقتصادي', 'دفاعي', 'قيادة موحّدة'];
  const oic = WD => ((WD.bl || {}).OIC || { m: [] }).m;
  function ensure(G) { if (!G.gov) G.gov = { ov: {}, tr: null, apx: 0, bid: 1 }; if (!G.iblocs) G.iblocs = []; if (!G.ibinv) G.ibinv = []; return G.gov; }
  // نظام الدولة الحالي: المتغيّر باللعبة أو الأصلي من البيانات (الأنظمة الثانية بالبيانات: حزب واحد، سلطوي، انتقالي… تبقى مثل ما هي)
  const gtOf = (G, WD, id) => (G.gov && G.gov.ov && G.gov.ov[id]) || (WD.cs[id] || {}).gt || 'parl';
  const nameOf = (G, WD, id) => { const g = gtOf(G, WD, id); return G.gov && G.gov.ov && G.gov.ov[id] ? GOV[g].n : (WD.cs[id] || {}).gov || (GOV[g] || {}).n || g; };
  const isDemo = (G, WD, id) => { const ov = G.gov && G.gov.ov && G.gov.ov[id]; return ov ? !!GOV[ov].demo : null; };   // null = اسأل البيانات
  const pilOf = (G, to) => { const H = G.nat && G.nat.home, F = H ? H.fac : {}; const k = GOV[to].pil; return F[k] != null ? [k, F[k]] : ['street', F.street ?? G.C[G.me].stab]; };
  // ===== تغيير النظام =====
  function canChange(G, WD, to, how) {
    const g = ensure(G), cur = gtOf(G, WD, G.me); if (!GOV[to]) return 'نظام غلط'; if (cur === to) return 'هذا نظامنا هسه'; if (g.tr) return 'أكو تغيير شغّال';
    if (to === 'theo' && !oic(WD).includes(G.me)) return 'النظام الإسلامي يحتاج دولة بمنظمة التعاون الإسلامي';
    if (how === 'reform') { if (G.ap < 3) return 'نقاط القرار ما تكفي (3)'; const [k, v] = pilOf(G, to); if (v < 50) return `يحتاج سند ${k === 'street' ? 'الشارع' : 'الفئة'} 50+ (هسه ${Math.round(v)})`; }
    else if (G.ap < 2) return 'نقاط القرار ما تكفي (2)';
    return null;
  }
  const monthsOf = (G, WD, to) => { const cur = gtOf(G, WD, G.me), far = !!(GOV[cur] || {}).demo !== !!GOV[to].demo; return far ? 24 : 12; };
  const coupP = (G, to) => { const [, v] = pilOf(G, to), H = G.nat && G.nat.home, a = H && H.fac.army != null ? H.fac.army : 50; return clamp((to === 'mil' ? a : (v + a) / 2) / 100 * .9, .1, .85); };
  function change(G, WD, S, to, how) {
    const e = canChange(G, WD, to, how); if (e) return e; const g = G.gov, r = G.rnd || Math.random;
    if (how === 'reform') { G.ap -= 3; g.tr = { to, t0: G.t, t1: G.t + monthsOf(G, WD, to) * 30 }; G.log.push({ t: G.t, k: 'gov', a: 'start', to }); return { ok: true, t: `بدا الإصلاح نحو ${GOV[to].n}: ${monthsOf(G, WD, to)} شهر` }; }
    G.ap -= 2; const p = coupP(G, to);
    if (r() < p) { apply(G, WD, S, G.me, to, 'coup'); stab(G, -12); return { ok: true, t: `نجح التغيير السريع: صرنا ${GOV[to].n}` }; }
    stab(G, -15); fac(G, 'army', -15); G.log.push({ t: G.t, k: 'gov', a: 'fail', to }); return { ok: true, fail: 1, t: 'فشل التغيير السريع: الجيش انقسم والاستقرار انهار' };
  }
  const fac = (G, k, v) => { const H = G.nat && G.nat.home; if (H && H.fac[k] != null) H.fac[k] = clamp(H.fac[k] + v, 0, 100); };
  const stab = (G, v) => { const c = G.C[G.me]; c.stab = clamp(c.stab + v, 0, 100); if (G.nat && G.nat.home) G.nat.home.stab = clamp(G.nat.home.stab + v, 0, 100); };
  function apply(G, WD, S, id, to, how) {
    ensure(G); const from = gtOf(G, WD, id); G.gov.ov[id] = to; const T = GOV[to];
    if (id === G.me && G.nat && G.nat.home) { const H = G.nat.home, old = H.fk || Object.keys(H.fac), avg = old.reduce((s, k) => s + (H.fac[k] ?? 50), 0) / Math.max(1, old.length);
      const keep = old.filter(k => k === 'tribe' || k === 'mil'), fk = [...new Set([...T.fk, ...keep])], nf = {}, nb = {};
      for (const k of fk) { nf[k] = clamp(H.fac[k] ?? avg, 0, 100); nb[k] = clamp(((H.base || {})[k] ?? 50) + (T.base[k] || 0), 15, 85); }
      H.fk = fk; H.fac = nf; H.base = nb; }
    // الانتخابات
    if (G.elec) { if (T.demo && G.elec[id] == null) G.elec[id] = G.t + (TERM[to] || 4) * 365; if (!T.demo) delete G.elec[id]; }
    // العلاقات
    const O = oic(WD); for (const x of G.ids) { if (x === id) continue; let d = 0;
      if (WEST.includes(x)) d += to === 'mil' ? -12 : to === 'theo' ? -10 : T.demo && !(GOV[from] || {}).demo ? 8 : 0;
      if (to === 'theo' && O.includes(x)) d += 8; if (to === 'theo' && x === 'ISR') d -= 20; if (to === 'amon' && ['SAU', 'ARE', 'QAT', 'KWT', 'BHR', 'OMN', 'JOR', 'MAR'].includes(x)) d += 5;
      if (how === 'coup') d -= 5; if (d) S.addRel(G, x, id, d); }
    if (to === 'mil' && id === G.me) for (const x of WEST) if (G.C[x] && x !== id && S.rel(G, x, id) < 20 && !G.sanc.some(s => s[0] === x && s[1] === id)) G.sanc.push([x, id, 'light']);
    G.log.push({ t: G.t, k: 'gov', a: 'done', id, to, from, how });
  }
  // ===== التحالف الإسلامي =====
  const mine = G => G.iblocs.find(b => b.founder === G.me);
  const inBloc = (G, x) => G.iblocs.find(b => b.m.includes(x));
  function canFound(G, WD) { ensure(G); const gt = gtOf(G, WD, G.me); if (!['theo', 'amon'].includes(gt)) return 'يحتاج نظام إسلامي أو ملكية'; if (!oic(WD).includes(G.me)) return 'لازم دولة بمنظمة التعاون الإسلامي'; if (inBloc(G, G.me)) return 'إحنا بتحالف إسلامي أصلاً'; if (G.ap < 3) return 'نقاط القرار ما تكفي (3)'; return null; }
  function found(G, WD, S, by = G.me, ai = false) {
    if (!ai) { const e = canFound(G, WD); if (e) return e; G.ap -= 3; }
    const g = ensure(G), b = { id: g.bid++, n: 'التحالف الإسلامي' + (G.iblocs.length ? ' — ' + ((WD.cs[by] || {}).ar || by) : ''), founder: by, m: [by], lvl: 1, col: BCOL[G.iblocs.length % BCOL.length], t: G.t };
    G.iblocs.push(b); for (const x of G.ids) if (x !== by) S.addRel(G, x, by, WEST.includes(x) ? -5 : x === 'ISR' ? -10 : oic(WD).includes(x) ? 4 : 0); G.ten = clamp((G.ten || 0) + 3, 0, 100);
    G.log.push({ t: G.t, k: 'ibloc', a: 'found', by, n: b.n }); return ai ? b : { ok: true, t: `تأسّس ${b.n}` };
  }
  const joinP = (G, WD, S, b, x) => { const r = S.rel(G, x, b.founder), gx = gtOf(G, WD, x); let p = (r + 20) / 120 + (['theo', 'amon'].includes(gx) ? .12 : 0) + (gx === gtOf(G, WD, b.founder) ? .08 : 0) - ((WD.bl.NATO || { m: [] }).m.includes(x) ? .5 : 0) - (inBloc(G, x) ? 1 : 0) - (S.atWar(G, x, b.founder) ? 1 : 0);
    return clamp(p, 0, .9); };
  function invite(G, WD, S, x) {
    const b = mine(G); if (!b) return 'ما عدنا تحالف'; if (G.ap < 1) return 'نقاط القرار ما تكفي'; if (!oic(WD).includes(x)) return 'مو بمنظمة التعاون الإسلامي'; if (b.m.includes(x)) return 'عضو أصلاً'; if (!G.C[x] || G.C[x].dead) return 'غلط';
    G.ap -= 1; const p = joinP(G, WD, S, b, x), r = G.rnd || Math.random;
    if (r() < p) { b.m.push(x); S.addRel(G, x, G.me, 5); G.log.push({ t: G.t, k: 'ibloc', a: 'join', x, n: b.n }); return { ok: true, t: `${(WD.cs[x] || {}).ar} انضمت لـ${b.n}` }; }
    S.addRel(G, x, G.me, -3); G.log.push({ t: G.t, k: 'ibloc', a: 'no', x, n: b.n }); return { ok: true, fail: 1, t: `${(WD.cs[x] || {}).ar} رفضت الدعوة` };
  }
  function upgrade(G, WD, S) {
    const b = mine(G); if (!b) return 'ما عدنا تحالف'; if (b.lvl >= 3) return 'أعلى درجة'; const need = [0, 3, 5][b.lvl]; if (b.m.length < need) return `يحتاج ${need} أعضاء (هسه ${b.m.length})`; if (G.ap < 2) return 'نقاط القرار ما تكفي (2)';
    G.ap -= 2; b.lvl++; for (const x of WEST) if (G.C[x]) S.addRel(G, x, G.me, -5); G.ten = clamp((G.ten || 0) + (b.lvl === 3 ? 5 : 3), 0, 100);
    G.log.push({ t: G.t, k: 'ibloc', a: 'lvl', lvl: b.lvl, n: b.n }); return { ok: true, t: `${b.n} صار ${LVL[b.lvl]}` };
  }
  function leave(G, WD, S) { const b = inBloc(G, G.me); if (!b) return 'مو بتحالف'; if (b.founder === G.me) { G.iblocs.splice(G.iblocs.indexOf(b), 1); G.log.push({ t: G.t, k: 'ibloc', a: 'end', n: b.n }); return { ok: true, t: 'حلّينا التحالف' }; }
    b.m = b.m.filter(x => x !== G.me); S.addRel(G, b.founder, G.me, -15); G.log.push({ t: G.t, k: 'ibloc', a: 'leave', x: G.me, n: b.n }); return { ok: true, t: `طلعنا من ${b.n}` }; }
  function answer(G, WD, S, i, yes) { const q = G.ibinv[i]; if (!q) return 'ماكو دعوة'; G.ibinv.splice(i, 1); const b = G.iblocs.find(x => x.id === q.b); if (!b) return 'التحالف انحل';
    if (yes) { if (inBloc(G, G.me)) return 'إحنا بتحالف ثاني'; b.m.push(G.me); S.addRel(G, b.founder, G.me, 8); for (const x of WEST) if (G.C[x]) S.addRel(G, x, G.me, -4); G.log.push({ t: G.t, k: 'ibloc', a: 'join', x: G.me, n: b.n }); return { ok: true, t: `انضمينا لـ${b.n}` }; }
    S.addRel(G, b.founder, G.me, -5); return { ok: true, t: 'رفضنا الدعوة' }; }
  // حلف دفاعي (الدرجة 2+): wsim.allied يسأل هنا
  const defAllied = (G, a, b) => (G.iblocs || []).some(q => q.lvl >= 2 && q.m.includes(a) && q.m.includes(b));
  // ===== كل شهر =====
  function month(G, WD, S) {
    const g = ensure(G), me = G.me, r = G.rnd || Math.random, O = oic(WD);
    // تنظيف: الأعضاء الميتين
    for (const b of G.iblocs.slice()) { b.m = b.m.filter(x => G.C[x] && !G.C[x].dead && G.ids.includes(x)); if (!b.m.includes(b.founder)) { if (b.m.length) b.founder = b.m[0]; else G.iblocs.splice(G.iblocs.indexOf(b), 1); } }
    if (G.nat) {
      // نقاط القرار الإضافية حسب النظام، والقيادة الموحّدة +0.5
      const ib = inBloc(G, me); g.apx += (GOV[gtOf(G, WD, me)] || { ap: 0 }).ap + (ib && ib.lvl >= 3 ? .5 : 0); while (g.apx >= 1) { g.apx -= 1; G.ap = Math.min(((S.K || {}).apMax || 8), G.ap + 1); }
      // الإصلاح الشغّال
      if (g.tr) { stab(G, -.4); if (G.t >= g.tr.t1) { const to = g.tr.to; g.tr = null; apply(G, WD, S, me, to, 'reform'); } }
      // التحالف الاقتصادي: نمو صغير حسب عدد الأعضاء
      G.C[me].ibG = ib ? +Math.min(.4, .08 * (ib.m.length - 1)).toFixed(2) : 0;
    }
    // الذكاء: دولة إسلامية كبيرة (نظام إسلامي أو ملكية) تأسّس تحالف بعد سنة، مرة كل فترة، لحد تحالفين
    if (G.t > 365 && G.iblocs.filter(b => b.founder !== me).length < 2 && r() < .015) {
      const C = G.ids.filter(x => x !== me && O.includes(x) && ['theo', 'amon'].includes(gtOf(G, WD, x)) && !inBloc(G, x) && G.C[x].gdp > 80).sort((a, b) => G.C[b].pw - G.C[a].pw);
      if (C.length) { const b = found(G, WD, S, C[0], true); for (const x of G.ids) if (x !== me && x !== b.founder && O.includes(x) && !inBloc(G, x) && S.rel(G, x, b.founder) >= 45 && r() < joinP(G, WD, S, b, x)) b.m.push(x); } }
    // تحالفات الذكاء تكبر وتدعونا
    for (const b of G.iblocs) { if (b.founder === me) continue;
      if (r() < .08) { const c = G.ids.filter(x => x !== me && O.includes(x) && !inBloc(G, x)); const x = c[Math.floor(r() * c.length)]; if (x && r() < joinP(G, WD, S, b, x)) { b.m.push(x); G.log.push({ t: G.t, k: 'ibloc', a: 'join', x, n: b.n }); } }
      if (b.lvl < 3 && b.m.length >= [0, 3, 5][b.lvl] && r() < .04) { b.lvl++; G.log.push({ t: G.t, k: 'ibloc', a: 'lvl', lvl: b.lvl, n: b.n }); }
      if (G.nat && O.includes(me) && !inBloc(G, me) && !G.ibinv.some(q => q.b === b.id) && S.rel(G, b.founder, me) >= 30 && r() < .05) { G.ibinv.push({ b: b.id, t: G.t }); G.log.push({ t: G.t, k: 'ibloc', a: 'inv', n: b.n, by: b.founder }); } }
    G.ibinv = G.ibinv.filter(q => G.t - q.t < 120);
  }
  // انقلاب الذكاء (wpol.coup يسأل هنا): 40٪ يطلع حكم عسكري
  function aiCoup(G, WD, S, id) { ensure(G); const r = G.rnd || Math.random; if (gtOf(G, WD, id) !== 'mil' && r() < .4) apply(G, WD, S, id, 'mil', 'coup'); }
  const API = { GOV, ORDER, LVL, ensure, gtOf, nameOf, isDemo, canChange, change, monthsOf, coupP, apply, canFound, found, invite, upgrade, leave, answer, joinP, mine, inBloc, defAllied, month, aiCoup };
  if (typeof module !== 'undefined') module.exports = API; else root.WGOV = API;
})(typeof window !== 'undefined' ? window : globalThis);
