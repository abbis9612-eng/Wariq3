// «العالم» W6 (D-050، I-105): دبلوماسية الحرب = dip.js من «الحرب الكبرى» نفسه (gwdip.js) على حرب اللاعب بالمسرح:
//  هدنة وسلام بشروط حسب «تعب الحرب»، وسطاء، طلب مساعدة، دخول دول ويانا بقواتها، عقوبات، أحداث بقرارات، عمليات سرية، وعروض الخصم.
// الدول ما ثابتة مثل «الحرب الكبرى» (13 دولة حول العراق): تنبني لكل حرب من بيانات العالم — الجيران، القوى الكبرى،
// واللي علاقتهم قوية ويا الطرفين — بعلاقاتها الحقيقية (G.rel) وحجم اقتصادها وجيشها [تقدير].
// الحالة بـ T.W.dip (تنحفظ ويا المسرح)، والعلاقات ترجع لـ G.rel، والدولة اللي تدخل ويانا تنضاف للحرب بالعالم.
// فحص: node tests/wardip.test.mjs
(function (root) {
  'use strict';
  const req = typeof require !== 'undefined' ? require : null;
  const DIP = root.DIP || req('./gwdip.js'), ECON = root.ECON || req('./gwecon.js');
  const POW = ['USA', 'RUS', 'CHN', 'GBR', 'FRA'], WEST = ['USA', 'GBR', 'FRA', 'DEU'];
  const MED = ['QAT', 'OMN', 'TUR', 'CHE', 'NOR', 'EGY', 'IND', 'BRA', 'SAU', 'KWT', 'DZA', 'ZAF', 'IDN'];
  let NB = null;
  const nbOf = WD => { if (NB) return NB; NB = {}; const own = new Map(WD.r.map(a => [a[0], a[1]]));
    for (const a of WD.r) for (const n of a[7]) { const o = own.get(n); if (o && o !== a[1]) (NB[a[1]] ||= new Set()).add(o); } return NB; };
  const capOf = (WD, x) => { const a = WD.r.find(a => a[1] === x && a[12]) || WD.r.find(a => a[1] === x); return a ? a : null; };
  const cityOf = (WD, x) => { const a = capOf(WD, x); return a ? ((a[9] && a[9][0] && a[9][0][0]) || a[3]) : WD.cs[x].ar; };
  const r1 = v => Math.round(v * 10) / 10;
  // ===== الدول لهالحرب [تقدير] =====
  function countries(G, WD, S, T) {
    const me = G.me, foe = T.side[1][0], inWar = new Set([...T.side[0], ...T.side[1]]), nb = nbOf(WD);
    const near = x => (nb[me] && nb[me].has(x)) || (nb[foe] && nb[foe].has(x));
    const cand = G.ids.filter(x => !inWar.has(x) && WD.cs[x] && G.C[x]).map(x => {
      const a = S.rel(G, x, me), b = S.rel(G, x, foe), c = G.C[x];
      return { x, a, b, sc: (near(x) ? 60 : 0) + (POW.includes(x) ? 70 : 0) + Math.abs(a) + Math.abs(b) * .6 + Math.log10(Math.max(1, c.gdp)) * 6 };
    }).sort((p, q) => q.sc - p.sc).slice(0, 14);
    return cand.map(({ x, a, b }) => {
      const c = G.C[x], cs = WD.cs[x], big = c.pw > 1500, al = S.allied(G, x, me);
      const will = c.gdp < 25 ? 'none' : WEST.slice(0, 3).includes(x) ? 'air' : POW.includes(x) ? 'aid' : near(x) && c.pw > 150 ? 'troops' : 'aid';
      const cash = (lo, hi) => 'cash:' + r1(Math.max(.1, Math.min(6, c.gdp * lo))) + '-' + r1(Math.max(.2, Math.min(12, c.gdp * hi)));
      const sup = Object.keys(ECON.SUPPLY[0]).filter(k => ECON.SUPPLY[0][k] === x && ECON.ITEMS[k]).slice(0, 3);
      const myPl = Object.keys(ECON.ITEMS).filter(k => ECON.ITEMS[k].side === 0 && ECON.ITEMS[k].cat === 'plane' && ECON.SUPPLY[0][k] === x);
      const ll = (capOf(WD, x) || [])[6];
      return { id: x, n: cs.ar, f: '', rel: [a, b], will, join: (al ? 60 : 82) + (POW.includes(x) && G.C[foe].nuke ? 15 : 0), med: MED.includes(x) || (c.gdp > 800 && Math.abs(a) < 40 && Math.abs(b) < 40) ? 1 : 0,
        power: POW.includes(x) ? 1 : 0, sanc: WEST.includes(x) ? 1 : 0, gulf: 0, near: near(x) ? 1 : 0,
        force: will === 'troops' || will === 'air' ? (big ? [['arm', 1], ['mec', 2]] : c.pw > 400 ? [['arm', 1], ['mec', 1]] : [['mec', 1]]) : null,
        airPkg: will === 'air' ? (myPl.length ? [myPl[0], myPl[0]] : []) : null,
        aid: [[cash(.0008, .003), ...sup], b > 20 ? [cash(.0005, .002)] : []], to: ll ? [ll[1], ll[0]] : null };
    });
  }
  // ===== أحداث العالم بقرارات (نفس فكرة EVENTS بـ«الحرب الكبرى»، بأسماء هالحرب) [تقدير] =====
  function events(G, WD, T) {
    const me = G.me, foe = T.side[1][0], FN = WD.cs[foe].ar, k = Math.max(.3, Math.min(20, G.C[me].gdp / 250));
    const best = (W, s, f = () => true) => DIP.COUNTRIES.filter(f).sort((a, b) => W.dip.c[b.id].rel[s] - W.dip.c[a.id].rel[s])[0];
    const rl = (W, id, s, v) => { const c = W.dip.c[id]; if (c) c.rel[s] = Math.max(-100, Math.min(100, c.rel[s] + v)); };
    return [
      { id: 'unsc', n: '🇺🇳 مجلس الأمن يدعو لوقف إطلاق النار', p: .008, gap: 30, when: W => W.t > 24 * 15, choice: [
        { n: `نقبل الدعوة (هدنة إذا ${FN} وافقت)`, fx: W => { const v = DIP.verdict(W, 1, 'truce', true); if (v.ok || DIP.weary(W, 1) > .35) { DIP.accept(W, 0, 'truce'); return `${FN} وافقت: هدنة 7 أيام`; } for (const C of DIP.COUNTRIES) rl(W, C.id, 0, 2); return `${FN} رفضت، والعالم شاف إنك تريد السلام (+2 علاقات)`; } },
        { n: 'نكمل الحرب', fx: W => { for (const C of DIP.COUNTRIES) rl(W, C.id, 0, -3); return 'العالم زعل شوية (−3 علاقات)'; } }] },
      { id: 'refugees', n: '🏕 موجة نازحين', p: .015, gap: 20, when: W => W.log.some(l => l.k === 'take' && l.side === 1 && l.t > W.t - 24 * 5 && W.cells[l.cell] && W.cells[l.cell].vp), choice: [
        { n: `نفتح مخيمات (−${r1(.4 * k)} مليار)`, fx: W => { if (W.eco) { W.eco[0].cash -= .4 * k; W.eco[0].mor = Math.min(100, W.eco[0].mor + 2); } for (const C of DIP.COUNTRIES) if (C.near) rl(W, C.id, 0, 3); return 'الناس ارتاحت (+2 معنويات)، والجيران شكرونا'; } },
        { n: 'نخليهم يعبرون للجيران', fx: W => { for (const C of DIP.COUNTRIES) if (C.near) rl(W, C.id, 0, -6); return 'الجيران زعلوا (−6)'; } }] },
      { id: 'carrier', n: '🚢 قوة كبرى ترسل حاملة طائرات قربنا', p: .01, gap: 40, when: W => { const B = best(W, 0, C => C.power); return B && W.dip.c[B.id].rel[0] >= 45; },
        fx: W => { if (W.eco) { W.eco[0].mor = Math.min(100, W.eco[0].mor + 3); W.eco[1].mor = Math.max(0, W.eco[1].mor - 2); } }, txt: `رسالة لـ${FN}: معنوياتنا +3 ومعنوياتهم −2.` },
      { id: 'foeship', n: `🚂 شحنة سلاح لـ${FN}`, p: .012, gap: 25, when: W => { const B = best(W, 1, C => C.power); return B && W.dip.c[B.id].rel[1] >= 40; },
        fx: W => { if (W.eco) W.eco[1].mor = Math.min(100, W.eco[1].mor + 3); for (const d of W.divs) if (!d.dead && d.side === 1) d.str = Math.min(1, d.str + .03); }, txt: `المخابرات تقول قوة كبرى صديقة لـ${FN} بعثتلها سلاح وذخيرة: فرقهم تتعوّض شوية.` },
      { id: 'protest0', n: `📢 مظاهرات بـ${cityOf(WD, me)}`, p: .03, gap: 15, when: W => W.eco && W.eco[0].mor < 38, choice: [
        { n: `نزيد الرواتب (−${r1(k)} مليار)`, fx: W => { W.eco[0].cash -= k; W.eco[0].mor = Math.min(100, W.eco[0].mor + 6); return 'الناس هدأت (+6 معنويات)'; } },
        { n: 'نفرّقهم بالقوة', fx: W => { W.eco[0].mor = Math.min(100, W.eco[0].mor + 1); for (const x of WEST) rl(W, x, 0, -6); return 'هدأت شوية (+1)، بس الغرب زعل (−6)'; } }] },
      { id: 'protest1', n: `📢 مظاهرات بـ${cityOf(WD, foe)}`, p: .03, gap: 15, when: W => W.eco && W.eco[1].mor < 38, fx: W => { W.eco[1].mor = Math.max(0, W.eco[1].mor - 2); }, txt: `شعب ${FN} تعب من الحرب: معنوياتهم −2.` },
      { id: 'loan', n: '🏦 عرض قرض', p: .008, gap: 45, when: W => W.eco && W.eco[0].cash < 8 * k, choice: [
        { n: `نقبل (+${r1(5 * k)} مليار)`, fx: W => { W.eco[0].cash += 5 * k; const B = best(W, 0, C => C.power) || DIP.COUNTRIES[0]; rl(W, B.id, 0, 5); return `+${r1(5 * k)} مليار من ${B.n} (+5 علاقة)`; } },
        { n: 'نرفض', fx: () => 'ماكو تغيير' }] },
    ];
  }
  // ===== البداية لحرب جديدة بالمسرح، أو بعد التحميل =====
  function setup(G, WD, S, T) {
    const foe = T.side[1][0], FN = WD.cs[foe].ar, W = T.W, fresh = !W.dip;
    const list = fresh ? countries(G, WD, S, T) : W.dip.cl;
    DIP.configure({ countries: list, events: events(G, WD, T), hz: false, LL: (lat, lon) => [(lon - T.lon0) * T.KX, (T.lat1 - lat) * T.KY],
      names: { foe: FN, foeCities: 'مدن من ' + FN, sancMsg: 'بس أمريكا وبريطانيا وفرنسا وألمانيا يقدرون يفرضون عقوبات' },
      terms: { keep: { d: `المناطق اللي أخذناها من ${FN} تبقى إلنا` }, rep: { d: `حدود قبل الحرب، و${FN} تدفع 10 مليار` } },
      ops: { recon: { n: `🛰 كشف جيش ${FN}`, d: `نشوف كل فرق ${FN} 48 ساعة (مصادر وأقمار صناعية حليفة)` }, riot: { n: `📢 تحريض مظاهرات بـ${cityOf(WD, foe)}`, d: `معنويات ${FN} −6` }, comm: { d: `تنظيم أكبر جيش لـ${FN} قدّامنا ينزل 30٪` }, oil: { d: 'ماكو بالعالم بعد (النفط بالضربات)' } } });
    if (fresh) { DIP.init(W); W.dip.cl = list; for (const C of list) W.dip.c[C.id].s0 = C.rel.slice(); }
    return W.dip;
  }
  // اقتصاد وتصنيع اللاعب يدخلون dip.js بس وقت النداء (المسرح بدونهم حتى sim.js ما يتأثر)
  function withNat(G, T, fn) { const W = T.W, NW = G.nat, o = [W.eco, W.ind]; if (NW) { W.eco = NW.eco; W.ind = NW.ind; } try { return fn(W); } finally { W.eco = o[0]; W.ind = o[1]; } }
  // العلاقات من dip.js ترجع للعالم، والدولة اللي دخلت ويانا تنضاف للحرب
  function sync(G, WD, S, T) {
    const W = T.W, me = G.me, foe = T.side[1][0], w = G.wars.find(x => x.id === T.war); if (!W.dip) return;
    for (const C of DIP.COUNTRIES) { const c = W.dip.c[C.id]; if (!c) continue; c.s0 = c.s0 || c.rel.slice();
      for (const [s, k] of [[0, me], [1, foe]]) { const d = Math.trunc(c.rel[s] - c.s0[s]); if (d) { S.addRel(G, C.id, k, d); c.s0[s] += d; } }
      if (w && c.st === 'ally0' && !w.a.includes(C.id) && !w.b.includes(C.id)) { (w.a.includes(me) ? w.a : w.b).push(C.id); G.log.push({ t: G.t, k: 'joinus', war: w.n, who: C.id }); } }
    if (G.nat) G.nat.eco[1].mor = Math.max(0, Math.min(100, G.C[foe].stab));
  }
  function daily(G, WD, X) { const T = X.T; if (!T || !T.W.dip) return; withNat(G, T, W => DIP.daily(W, T.A, X.SIM, ECON)); sync(G, WD, X.S, T); }
  // أفعال اللاعب (نفس dip.js)
  const act = (G, WD, S, T, f) => { const r = withNat(G, T, f); sync(G, WD, S, T); return r; };
  const API = { setup, daily, sync, act, withNat, countries };
  if (typeof module !== 'undefined') module.exports = API; else root.WARDIP = API;
})(this);
