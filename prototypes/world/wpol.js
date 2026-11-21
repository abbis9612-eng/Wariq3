// «العالم» W7: السياسة والأحداث لكل الدول [تقدير] — فحص node tests/wpol.test.mjs
//  - الانتخابات بالديمقراطيات (نظام برلماني/رئاسي/شبه رئاسي/ملكية دستورية وحرية 1+): كل 4–5 سنين. اللاعب يقدر يخسر (نهاية اللعبة)،
//    وقبلها بشهر قضية «حملة انتخابية» بقرارات. الذكاء: المعارضة تفوز ← حكومة جديدة (استقرار +5، العلاقات ترجع شوية لأساسها).
//  - الانقلابات بالدول الضعيفة (الذكاء): الاستقرار تحت 30 والنظام عسكري/سلطوي/انتقالي أكثر احتمال ← نظام جديد، ويطلع من حروبه الخسرانة.
//  - سبب الحرب: إعلان حرب بدون سبب (عداء −60، نزاع معروف، حليفنا بحرب وياهم، ماسكين أرضنا) = العالم يزعل أكثر، استقرارنا −8، توتر +5.
//  - الاحتلال: كل منطقة ماسكها من غير صاحبها تكلّف نمو واستقرار، وبعد سنة ممكن تثور وترجع لصاحبها.
//  - أحداث عالمية: زلزال/فيضان، أوبك+، أزمة مالية، وباء، هجوم إرهابي، فضيحة — اللي تخص اللاعب بقرارات (W.pev).
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DEMO = ['parl', 'pres', 'semi', 'cmon'], TERM = { pres: 4, parl: 4, semi: 5, cmon: 4 };
  const START = Date.UTC(2026, 10, 20);
  // مواعيد معروفة (من الدساتير والدورات الحالية) — الباقي موزّع على الدورة [تقدير]
  const KNOWN = { USA: '2028-11-07', GBR: '2029-08-15', FRA: '2027-04-23', DEU: '2029-09-23', IRQ: '2029-11-10', TUR: '2028-05-14', BRA: '2026-10-04', IND: '2029-05-01', JPN: '2028-07-10', ISR: '2026-10-27', UKR: '2029-03-31', POL: '2027-10-10', ITA: '2027-09-26', CAN: '2029-10-15', AUS: '2028-05-20', KOR: '2027-03-03' };
  const dayOf = s => Math.round((Date.parse(s) - START) / 864e5);
  const hash = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  const isDemo = cs => cs && DEMO.includes(cs.gt) && cs.free >= 1;
  // v5-4: النظام ممكن يتغيّر باللعبة (WGOV)
  const GOV = () => root.WGOV || (typeof require !== 'undefined' ? require('./wgov.js') : null);
  const demoOf = (W, WD, id) => { const g = GOV() && GOV().isDemo(W, WD, id); return g != null ? g : isDemo(WD.cs[id]); };
  const gtOf = (W, WD, id) => GOV() ? GOV().gtOf(W, WD, id) : WD.cs[id].gt;
  function ensure(W, WD) {
    if (W.elec) return W;
    W.elec = {}; for (const id of W.ids) { const cs = WD.cs[id]; if (!isDemo(cs)) continue; const T = (TERM[cs.gt] || 4) * 365;
      let t = KNOWN[id] ? dayOf(KNOWN[id]) : 30 + hash(id) % T; while (t < 20) t += T; W.elec[id] = t; }
    W.pev = W.pev || []; W.coupT = W.coupT || {}; W.occT = W.occT || {};
    return W;
  }
  // ===== سبب الحرب =====
  function casus(W, WD, S, a, b) {
    if ((W.rel[a] || {})[b] <= -60) return 'عداء شديد';
    if (S.TENSION && S.TENSION.some(p => p.includes(a) && p.includes(b))) return 'نزاع حدودي معروف';
    if (W.ids.some(x => x !== a && S.allied(W, a, x) && S.atWar(W, x, b))) return 'حليفنا بحرب وياهم';
    for (let i = 0; i < WD.r.length; i++) if (WD.r[i][1] === a && W.ctl[i] === b) return 'ماسكين أرض إلنا';
    return null;
  }
  // عقوبة إعلان حرب بدون سبب (اللاعب أو الذكاء)
  function noCause(W, WD, S, a) { for (const x of W.ids) if (x !== a) S.addRel(W, a, x, -10); const c = W.C[a]; c.stab = clamp(c.stab - 8, 0, 100); W.ten = clamp((W.ten || 0) + 5, 0, 100); }
  // ===== كل شهر =====
  function month(W, WD, S) {
    ensure(W, WD); const me = W.me;
    // الانتخابات
    for (const id in W.elec) { if (W.elec[id] > W.t) { if (id === me && W.elec[id] - W.t <= 31 && !W.pev.some(e => e.id === 'campaign')) W.pev.push({ id: 'campaign', t: W.t }); continue; }
      if (!demoOf(W, WD, id)) { delete W.elec[id]; continue; } W.elec[id] += (TERM[gtOf(W, WD, id)] || 4) * 365; election(W, WD, S, id); }
    // الانقلابات (الذكاء) والاحتلال
    for (const id of W.ids) { const c = W.C[id]; if (id === me || !c) continue; const gt = gtOf(W, WD, id);
      if (c.stab < 30 && W.t - (W.coupT[id] || -999) > 365) { const p = (30 - c.stab) / 300 * (['mil', 'auth', 'trans'].includes(gt) ? 2 : demoOf(W, WD, id) ? .3 : 1); if (W.rnd() < p) coup(W, WD, S, id); } }
    occupation(W, WD, S);
    // أحداث عالمية: حدث واحد كل شهرين تقريباً
    if (W.rnd() < .5) worldEvent(W, WD, S);
    if (W.gshock && W.gshock.until <= W.t) W.gshock = null; if (W.oilShock && W.oilShock.until <= W.t) W.oilShock = null;
  }
  function election(W, WD, S, id) {
    const c = W.C[id], me = W.me;
    if (id === me) {
      const H = W.nat && W.nat.home, F = H ? H.fac : {}, e = W.nat && W.nat.eco[0];
      const sc = .35 * (F.street ?? c.stab) + .25 * (F.parties ?? c.stab) + .25 * (e ? e.mor : c.stab) + 2 * Math.max(-5, Math.min(5, c.g)) + (W.campaign || 0) + (W.rnd() * 16 - 8);
      W.campaign = 0; W.log.push({ t: W.t, k: 'elect', id, me: 1, win: sc >= 40, sc: Math.round(sc) });   // W9: 40 (قبلها 45: المدير الزين يخسر 1 من 2)
      if (sc >= 40) { c.stab = clamp(c.stab + 5, 0, 100); if (H) H.stab = clamp(H.stab + 5, 0, 100); }
      else if (!W.over && (!W.cfg || W.cfg.diff !== 'ez')) W.over = { t: W.t, why: 'election' };
      return;
    }
    const inc = clamp(.25 + c.stab / 140 + c.g / 25, .1, .85), win = W.rnd() < inc;
    if (!win) { c.stab = clamp(c.stab + 5, 0, 100); for (const o in W.rel[id] || {}) { const b = (W.base[id] && W.base[id][o]) || 0; W.rel[id][o] = Math.round(W.rel[id][o] + (b - W.rel[id][o]) * .3); } }
    W.log.push({ t: W.t, k: 'elect', id, win });
  }
  function coup(W, WD, S, id) {
    const c = W.C[id]; W.coupT[id] = W.t; c.stab = 45; c.low = 0;
    for (const w of W.wars.slice()) if ((w.a.includes(id) || w.b.includes(id)) && w.a[0] !== W.me && w.b[0] !== W.me) { const s = w.a.includes(id) ? w.score : -w.score; if (s < 0 && (w.a[0] === id || w.b[0] === id)) S.endWar(W, WD, w, 'coup'); }
    for (const o in W.rel[id] || {}) W.rel[id][o] = Math.round(W.rel[id][o] * .7 + (W.rnd() * 20 - 10));
    W.ten = clamp((W.ten || 0) + 2, 0, 100); W.log.push({ t: W.t, k: 'coup', id }); if (GOV()) GOV().aiCoup(W, WD, S, id);
  }
  // الاحتلال: كل منطقة مأخوذة (صاحبها دولة) تكلّف المحتل −0.05٪ نمو (لحد −1.5) و−0.15 استقرار (لحد −3) بالشهر؛ بعد سنة 1٪ بالشهر تثور وترجع إذا صاحبها مو بحرب ويا المحتل
  function occupation(W, WD, S) {
    const GEO = root.WGEO || (typeof require !== 'undefined' ? require('./wgeo.js') : null);
    const n = {}; for (let i = 0; i < WD.r.length; i++) { const o = WD.r[i][1], k = W.ctl[i]; if (!k || k === o || !W.C[o] || !W.C[k] || (GEO && GEO.integrated(W, o, k))) { delete W.occT[i]; continue; }   // v5-2: المضموم يندمج بعد 3 سنين
      if (W.occT[i] == null) W.occT[i] = W.t; n[k] = (n[k] || 0) + 1;
      if (W.t - W.occT[i] > 365 && !S.atWar(W, k, o) && W.rnd() < .01) { if (GEO && GEO.isAnnexed(W, o)) { W.C[k].stab = clamp(W.C[k].stab - 2, 0, 100); W.log.push({ t: W.t, k: 'resist', r: WD.r[i][0], by: k, o }); continue; } W.ctl[i] = o; delete W.occT[i]; W.log.push({ t: W.t, k: 'revolt', r: WD.r[i][0], from: k, to: o }); } }   // المضموم ما يرجع لدولة انمحت: مقاومة
    for (const id of W.ids) { const c = W.C[id]; c.occG = n[id] ? -Math.min(1.5, n[id] * .05) : 0; if (n[id]) c.stab = clamp(c.stab - Math.min(3, n[id] * .15), 0, 100); c.occN = n[id] || 0; }
  }
  // ===== الأحداث العالمية =====
  const pick = (W, L, wf) => { const t = L.reduce((s, x) => s + wf(x), 0); let r = W.rnd() * t; for (const x of L) { r -= wf(x); if (r <= 0) return x; } return L[0]; };
  function worldEvent(W, WD, S) {
    const me = W.me, k = pick(W, ['quake', 'opec', 'fin', 'terror', 'scandal', 'pandemic'], x => ({ quake: 4, opec: 2, fin: 1, terror: 3, scandal: 2, pandemic: .3 })[x]);
    if (k === 'quake') { const id = pick(W, W.ids, x => Math.sqrt(W.C[x].pop || 1)), c = W.C[id], f = .003 + W.rnd() * .012; c.gdp *= 1 - f; c.stab = clamp(c.stab - 3, 0, 100);
      W.log.push({ t: W.t, k: 'disaster', id, f: +(f * 100).toFixed(1), kind: W.rnd() < .5 ? 'quake' : 'flood' }); if (id === me) W.pev.push({ id: 'quake', t: W.t }); }
    else if (k === 'opec') { const up = W.rnd() < .5, v = up ? 10 : -8; W.oilShock = { v, until: W.t + 180 }; W.log.push({ t: W.t, k: 'opec', v }); }
    else if (k === 'fin' && !W.gshock) { W.gshock = { v: -1.2, until: W.t + 180, n: 'أزمة مالية عالمية' }; W.log.push({ t: W.t, k: 'fin' }); }
    else if (k === 'pandemic' && !W.gshock) { W.gshock = { v: -.8, until: W.t + 120, n: 'وباء' }; for (const id of W.ids) W.C[id].stab = clamp(W.C[id].stab - 2, 0, 100); W.log.push({ t: W.t, k: 'pandemic' }); }
    else if (k === 'terror') { const id = pick(W, W.ids, x => (W.C[x].stab < 40 ? 3 : 1) * Math.sqrt(W.C[x].pop || 1) / 100), c = W.C[id]; c.stab = clamp(c.stab - 4, 0, 100); W.log.push({ t: W.t, k: 'terror', id }); if (id === me) W.pev.push({ id: 'terror', t: W.t }); }
    else if (k === 'scandal' && demoOf(W, WD, me) && W.rnd() < .5) W.pev.push({ id: 'scandal', t: W.t });
    if (W.pev.length > 3) W.pev.splice(0, W.pev.length - 3);
  }
  // أحداث اللاعب بقرارات (الكلف بحجم الاقتصاد: k = الناتج/250)
  const cash = (W, v) => { if (W.nat) W.nat.eco[0].cash += v; };
  const fac = (W, f, v) => { const H = W.nat && W.nat.home; if (H && H.fac[f] != null) H.fac[f] = clamp(H.fac[f] + v, 0, 100); };
  const stab = (W, v) => { const c = W.C[W.me]; c.stab = clamp(c.stab + v, 0, 100); if (W.nat) W.nat.home.stab = clamp(W.nat.home.stab + v, 0, 100); };
  const PEV = {
    campaign: { n: '🗳 الانتخابات بعد شهر', x: 'الحملة الانتخابية بدت. المعارضة تهاجم الحكومة على الأسعار والأمن. النتيجة تعتمد على الشارع والأحزاب ومعنويات الناس والنمو.', o: [
      [k => `وعود وصرف (−${(1.5 * k).toFixed(1)} مليار)`, (W, k) => { cash(W, -1.5 * k); W.campaign = 8; fac(W, 'street', 4); return 'الناس فرحت بالوعود (+8 بالانتخابات)'; }],
      [() => 'حملة على الإنجازات', W => { W.campaign = 3; return '+3 بالانتخابات'; }],
      [() => 'تحالف ويا أحزاب ثانية (حصص)', W => { W.campaign = 6; fac(W, 'parties', 8); fac(W, 'street', -3); return '+6 بالانتخابات، والشارع زعل شوية من الحصص'; }]] },
    quake: { n: '🌊 كارثة طبيعية ببلدنا', x: 'زلزال/فيضان ضرب مناطق بالبلد: بيوت مهدمة وناس بالعراء.', o: [
      [k => `إغاثة كبيرة (−${(1 * k).toFixed(1)} مليار)`, (W, k) => { cash(W, -k); stab(W, 4); return 'الناس شافت الدولة وياها (+4 استقرار)'; }],
      [() => 'نطلب مساعدة دولية', (W) => { stab(W, 1); return 'وصلت مساعدات، بس الناس تقول الدولة غايبة (+1)'; }],
      [() => 'ميزانية الطوارئ بس', W => { stab(W, -3); return 'الناس زعلانة (−3 استقرار)'; }]] },
    terror: { n: '💥 هجوم إرهابي', x: 'تفجير بمكان مزدحم وضحايا. الناس خايفة وغاضبة.', o: [
      [() => 'حملة أمنية واسعة', W => { stab(W, 2); fac(W, 'army', 3); fac(W, 'security', 3); for (const x of ['USA', 'GBR', 'FRA', 'DEU']) if (W.rel[W.me]) W.rel[W.me][x] = (W.rel[W.me][x] || 0) - 3; return '+2 استقرار، والغرب منزعج شوية من الاعتقالات'; }],
      [k => `وحدة وطنية وتعويض الضحايا (−${(.3 * k).toFixed(1)} مليار)`, (W, k) => { cash(W, -.3 * k); stab(W, 3); fac(W, 'street', 3); return '+3 استقرار'; }]] },
    scandal: { n: '📰 فضيحة فساد بالحكومة', x: 'تسريبات عن صفقات بوزارة. الإعلام والمعارضة يطالبون بالاستقالة.', o: [
      [() => 'نقيل الوزير ونحقق', W => { fac(W, 'parties', -4); fac(W, 'street', 5); return 'الشارع ارتاح، والأحزاب زعلت'; }],
      [() => 'ننكر ونهاجم الإعلام', W => { fac(W, 'street', -6); stab(W, -2); return 'الشارع غاضب (−6)'; }]] },
  };
  function choose(W, i, j) { const q = W.pev[i]; if (!q) return null; W.pev.splice(i, 1); const k = Math.max(.3, Math.min(20, W.C[W.me].gdp / 250)); const r = PEV[q.id].o[j][1](W, k); W.log.push({ t: W.t, k: 'pchose', id: q.id, r }); return r; }
  const API = { ensure, month, casus, noCause, election, coup, choose, PEV, isDemo, demoOf, KNOWN };
  if (typeof module !== 'undefined') module.exports = API; else root.WPOL = API;
})(this);
