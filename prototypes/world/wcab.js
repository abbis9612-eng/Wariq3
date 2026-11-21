// «العالم» v5-10 (I-154، D-060): مجلس الوزراء — 9 وزارات، كل وزير يراقب ملفه، يگول شنو صاير، يقترح، أو يشتغل لحاله.
// كل وزير: مهارة 1–5 (تكبر بالخبرة)، صفة (نزيه/فاسد/جريء/حذر/خبير)، محسوب على فئة. 3 طرق لكل وزارة: me (أنا أقرر)، ask (يقترح وأوافق)، auto (تلقائي).
// + تقرير «ليش نخسر؟»: أكبر الأسباب من لقطات شهرية (النفط، الاقتصاد، الخزينة، الاستقرار). التصميم: docs/features/world-v5-plan.md · فحص: node tests/wcab.test.mjs
(function (root) {
  'use strict';
  const req = n => (typeof require !== 'undefined' ? require(n) : null);
  const ECO = () => root.WECO || req('./weco.js'), FUND = () => root.WFUND || req('./wfund.js'), RES = () => root.WRES || req('./wres.js'),
    HOME = () => root.HOME || req('./gwhome.js'), INS = () => root.WINS || req('./wins.js'), ECON = () => root.ECON || req('./gwecon.js'), MKT = () => root.WMKT || req('./wmkt.js');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // الوزارات: الاسم، الأيقونة، والطريقة الافتراضية (اللي تصرف نقاط قرار أو تغيّر العلاقات تبدي «يقترح»)
  const MIN = {
    fin: { n: 'المالية', ic: '💰', d: 'الضرايب، الإنفاق، الصندوق السيادي، والقروض', mode: 'auto' },
    oil: { n: 'النفط والطاقة', ic: '🛢', d: 'حقول النفط والكهرباء والمصافي', mode: 'auto' },
    ind: { n: 'الصناعة', ic: '🏭', d: 'المصانع والصنع الوطني', mode: 'auto' },
    trd: { n: 'التجارة', ic: '📦', d: 'عروض الشركات والسوق', mode: 'ask' },
    def: { n: 'الدفاع', ic: '🛡', d: 'الذخيرة والوقود وجاهزية الجيش', mode: 'auto' },
    int: { n: 'الداخلية', ic: '🏛', d: 'القضايا الداخلية والاستقرار', mode: 'auto' },
    frn: { n: 'الخارجية', ic: '🤝', d: 'العروض الدبلوماسية', mode: 'ask' },
    svc: { n: 'الخدمات', ic: '🏥', d: 'المستشفيات والجامعات والسكن', mode: 'auto' },
    rd: { n: 'البحث', ic: '🧪', d: 'خانات البحث', mode: 'auto' },
  };
  const MK = Object.keys(MIN);
  const TR = { honest: 'نزيه', corrupt: 'فاسد', bold: 'جريء', careful: 'حذر', expert: 'خبير' };
  const FIRST = ['أحمد', 'محمد', 'علي', 'عمر', 'خالد', 'حسن', 'يوسف', 'إبراهيم', 'سعد', 'فاروق', 'طارق', 'زيد', 'سلمان', 'ماجد', 'نزار', 'عادل', 'سامي', 'ليث', 'منى', 'هدى', 'سارة', 'رنا', 'نادية', 'ريم'];
  const LAST = ['الجبوري', 'الدليمي', 'العبيدي', 'التميمي', 'الحسني', 'الخفاجي', 'الشمري', 'الزبيدي', 'الربيعي', 'العاني', 'الكبيسي', 'السامرائي', 'البياتي', 'الحديثي', 'النعيمي', 'الراوي'];
  const rngOf = G => { let a = ((G.rs || 1) * 31 + (G.t || 0) * 7919 + ((G.cab && G.cab.nid) || 0) * 104729) | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const pick = (r, L) => L[Math.floor(r() * L.length)];
  function person(G, k, sk, r) {
    const facs = Object.keys((G.nat && G.nat.home && G.nat.home.fac) || { army: 1 }), x = r();
    const tr = x < .12 ? 'corrupt' : x < .32 ? 'honest' : x < .5 ? 'careful' : x < .66 ? 'bold' : x < .8 ? 'expert' : 'honest';
    return { id: (G.cab ? G.cab.nid++ : 0), k, n: pick(r, FIRST) + ' ' + pick(r, LAST), sk: clamp(Math.round(sk), 1, 5), xp: 0, tr, fac: pick(r, facs), t0: G.t, last: '' };
  }
  function ensure(G) {
    if (G.cab) return G.cab;
    const C = G.cab = { m: {}, mode: {}, lim: { floor: null, defK: 1 }, cand: [], props: [], rep: null, snap: [], log: [], nid: 1, candT: (G.t || 0) + 120 };
    const r = rngOf(G);
    for (const k of MK) { C.m[k] = person(G, k, 2 + (r() < .45 ? 1 : 0), r); C.mode[k] = MIN[k].mode; }
    return C;
  }
  const floorOf = G => { const C = ensure(G); return C.lim.floor != null ? C.lim.floor : Math.max(2, (G.nat ? G.nat.lim : 5) * .4); };
  // صافي الخزينة بالشهر من اللقطات
  const netOf = G => { const C = ensure(G), s = C.snap; if (s.length < 2) return 0; const a = s[Math.max(0, s.length - 4)], b = s[s.length - 1]; return (b.cash - a.cash) / Math.max(1, (b.t - a.t) / 30); };

  // ===== شنو يقترح كل وزير (كود قابل للحفظ + نص) =====
  function plan(G, WD, S, k) {
    const me = G.me, c = G.C[me], e = G.nat.eco[0], fl = floorOf(G), out = [], add = (code, t, w = 1) => out.push({ c: code, t, w });
    const EC = ECO(), F = FUND() && FUND().ensure(G), proj = q => G.eco3 && G.eco3.proj.some(p => p.id === me && !p.done && p.k === q), cost = q => EC.card(G, WD, me, q).cost;
    // ميزانية مشاريع مشتركة: مشروع وحد بالشهر لكل الحكومة، وبس إذا يبقى فوق الحد ضعفين والخزينة مو نازلة
    const C0 = ensure(G), netP = netOf(G), startOk = q => EC && EC.P[q] && !EC.can(G, WD, me, q) && !proj(q) && !C0.projT && (netP >= 0 || e.cash > fl * 4);
    const H = G.nat.home, street = H && H.fac ? (H.fac.street ?? 50) : 50, m = C0.m[k];
    if (k === 'fin') {
      const net = netOf(G);
      if (e.cash < fl * .5 && F) { const t = (F.bonds || 0) + (F.stocks || 0); if (t > .1) add('fund:take', `نسحب ${Math.min(t, fl - e.cash).toFixed(1)} مليار من الصندوق السيادي للخزينة`, 3); }
      if (e.cash < 0 && FUND() && !FUND().borrowOk(G, WD, S)) add('fund:borrow', 'ناخذ قرض طوارئ حتى ما تتأخر الرواتب', 3);
      // التقشف يكلف ~0.9٪ نمو بالسنة: بس لما الخزينة قريبة من الصفر وتنزل، وبعد الصندوق والقرض
      if (e.cash < fl * .3 && net < 0) { if (c.tax !== 'high' && street > 45) add('tax:high', 'نرفع الضرايب درجة: الدخل +4٪ من الاقتصاد، والشارع يزعل شوية', 2); else if (c.civ !== 'cut') add('civ:cut', 'نخفّض الإنفاق المدني: نوفر 15٪، والناس تزعل', 2); }
      // التقشف مؤقت: أول ما الخزينة ترجع، نرجّع الإنفاق والضرايب (الحذر يستنى أكثر)
      else if (c.civ === 'cut' && e.cash > fl * (m.tr === 'careful' ? .8 : .5) && net >= 0) add('civ:mid', 'الخزينة رجعت: نرجّع الإنفاق المدني عادي والناس ترتاح', 2);
      else if (c.tax === 'high' && e.cash > fl * (m.tr === 'careful' ? 1.2 : .8) && net >= 0) add('tax:mid', 'الخزينة رجعت: نرجّع الضرايب عادية والنمو يتحسن', 2);
      else if (e.cash > fl * 3 && net >= 0) add('fund:put', `نحط ${((e.cash - fl * 2) * .5).toFixed(1)} مليار فائض بالسندات (3.5٪ بالسنة)`, 1);
    } else if (k === 'oil') {
      if (EC && EC.elecDef(G, me) > .08 && startOk('power') && e.cash > cost('power') + fl * 1.5) add('proj:power', `محطة كهرباء: النقص ${Math.round(EC.elecDef(G, me) * 100)}٪ يأكل النمو`, 2);
      else if (c.oil > 0 && startOk('oil') && e.cash > cost('oil') * 1.2 + fl * 2) add('proj:oil', 'نوسّع حقل نفط: +250 ألف برميل باليوم بعد 3 سنين', 1);
      else if (startOk('refin') && e.cash > cost('refin') * 1.2 + fl * 2.5) add('proj:refin', 'مصفى: بنزين محلي بدل الاستيراد', 1);
    } else if (k === 'ind') {
      if (startOk('fact') && e.cash > cost('fact') * 1.2 + fl * 2.5) add('proj:fact', 'مصنع: الناتج غير النفطي يكبر', 1);
    } else if (k === 'def') {
      const st = G.nat.stock; if (st && (st.ammo < 55 || st.fuel < 55) && e.cash > fl * .5 && ECON().ITEMS.stk && !e.q.some(o => o.k === 'stk')) add('buy:stk', `نعبّي الذخيرة (${Math.round(st.ammo)}٪) والوقود (${Math.round(st.fuel)}٪)`, 2);
    } else if (k === 'int') {
      if (H && H.iss && H.iss.length) add('iss:auto', `نحل قضية «${HOME().ISS[H.iss[0].k].t}»`, 2);
      else { const g = G.ins && G.ins.g.find(g => !g.op && g.k !== 'jih' && g.sat < 45 && g.hit > G.t - 60); if (g && e.cash > fl + INS().preview(G, WD, g).pay) add('ins:pay:' + g.id, `نهدّي «${g.n}» بالفلوس والوجهاء (رضاهم ${Math.round(g.sat)}، ضربوا قريب)`, 2); }
    } else if (k === 'frn') {
      if (G.offers && G.offers.length) add('offer:yes', `نقبل عرض ${(WD.cs[G.offers[0].from] || {}).ar || ''}`.trim(), 1);
    } else if (k === 'trd') {
      if (G.mkt && G.mkt.offers && G.mkt.offers.length && e.cash > fl) add('mkt:yes', 'نقبل عرض شركة/بيع بالسوق', 1);
    } else if (k === 'svc') {
      const P = G.pop3 && G.pop3[me];
      if (P && P.hea < .62 && startOk('hosp') && e.cash > cost('hosp') + fl * 2) add('proj:hosp', `مستشفيات: الصحة ${Math.round(P.hea * 100)} من 100`, 1);
      else if (P && P.edu < .6 && startOk('univ') && e.cash > cost('univ') + fl * 2) add('proj:univ', `جامعة: التعليم ${Math.round(P.edu * 100)} من 100`, 1);
    } else if (k === 'rd') {
      const R = RES() && RES().ensure(G); if (R && R.slots.length > 1 && e.cash < fl * .6 && netOf(G) < .5) add('res:drop', `الخزينة ضيقة: نوقف خانة بحث (${R.slots.length} شغّالة، كل وحدة تصرف كل يوم)`, 2);
      else if (R && R.slots.length < RES().slotsMax(G) && e.cash > fl * 1.5) add('res:fill', 'نشغّل خانات البحث الفاضية', 1);
    }
    return out;
  }
  // ===== تنفيذ قرار (من الوزير التلقائي أو من «وافق») =====
  function exec(G, WD, S, code) {
    const me = G.me, c = G.C[me], e = G.nat.eco[0], fl = floorOf(G), [a, b] = code.split(':');
    try {
      if (a === 'tax') { c.tax = b; return true; }
      if (a === 'civ') { c.civ = b; return true; }
      if (a === 'fund') { const F = FUND(), Fd = F.ensure(G);
        if (b === 'take') { for (const q of ['bonds', 'stocks']) if (e.cash < fl && Fd[q] > 0) F.take(G, q, Math.min(Fd[q], fl - e.cash)); return true; }
        if (b === 'put') return typeof F.put(G, 'bonds', +((e.cash - fl * 2) * .5).toFixed(2)) !== 'string';
        if (b === 'borrow') return typeof F.borrow(G, WD, S) !== 'string'; }
      if (a === 'proj') { const ok = typeof ECO().start(G, WD, me, b) !== 'string'; if (ok) ensure(G).projT = 1; return ok; }
      if (a === 'buy') return typeof ECON().buy(G.nat, 0, b) !== 'string';
      if (a === 'iss') { const H = G.nat.home, I = HOME().ISS[H.iss[0].k], sk = ensure(G).m.int.sk; HOME().choose(G.nat, 0, e.cash > G.nat.lim * .2 || sk >= 4 ? 0 : I.o.length - 1); return true; }
      if (a === 'offer') { S.answerOffer(G, WD, 0, true); return true; }
      if (a === 'mkt') { MKT().answer(G, WD, S, 0, true); return true; }
      if (a === 'ins') return typeof INS().act(G, WD, S, code.split(':')[2], 'pay') !== 'string';
      if (a === 'res') { if (b === 'drop') { const R = RES().ensure(G); return typeof RES().drop(G, R.slots.length - 1) !== 'string'; } RES().fill(G, WD); return true; }
    } catch (err) { return false; }
    return false;
  }
  // ===== كل شهر =====
  function month(G, WD, S) {
    if (!G.nat) return; const C = ensure(G), r = rngOf(G), me = G.me, c = G.C[me], e = G.nat.eco[0];
    C.snap.push({ t: G.t, gdp: +c.gdp.toFixed(2), core: +c.core.toFixed(2), og: +(c.gdp - c.core).toFixed(2), oilP: Math.round(G.oilP || 0), cash: +e.cash.toFixed(2), stab: Math.round(c.stab), kbd: Math.round(c.oil || 0) }); if (C.snap.length > 30) C.snap.shift();
    const rows = [], acts = []; C.projT = 0;
    for (const k of MK) { const m = C.m[k], mode = C.mode[k], P = plan(G, WD, S, k).sort((x, y) => y.w - x.w);
      m.xp++; if (m.xp % 24 === 0 && m.sk < 5 && r() < (m.tr === 'expert' ? .8 : .55)) { m.sk++; acts.push(`⭐ ${m.n} (${MIN[k].n}) صار أشطر: ${m.sk} نجوم`); }
      // الفاسد ياكل من الخزينة (ينكشف أحياناً)
      if (m.tr === 'corrupt') { const st = +(Math.max(0, c.gdp) * .0004 * (k === 'fin' || k === 'oil' ? 2 : 1)).toFixed(3); e.cash -= st; m.stolen = +((m.stolen || 0) + st).toFixed(3); if (r() < .04) { m.caught = 1; acts.push(`🕵 انكشف إن ${m.n} (${MIN[k].n}) يختلس: ${m.stolen.toFixed(2)} مليار لحد هسه`); } }
      let st = 'ok', line = P.length ? P[0].t : 'كلشي ماشي';
      if (P.length && mode === 'auto') { let done = 0; for (const p of P.slice(0, k === 'fin' ? 2 : 1)) {
          if (r() < (5 - m.sk) * .06) { line = `⏳ تأخر: ${p.t}`; st = 'warn'; continue; }   // الضعيف يغلط أو يتأخر
          if (exec(G, WD, S, p.c)) { done++; acts.push(`${MIN[k].ic} ${MIN[k].n}: ${p.t}`); line = '✓ ' + p.t; } }
        m.last = line; }
      else if (P.length && mode === 'ask') { for (const p of P.slice(0, 2)) if (!C.props.some(q => q.k === k && q.c === p.c)) C.props.push({ id: C.nid++, k, c: p.c, t: p.t, at: G.t }); st = 'warn'; line = 'يقترح: ' + P[0].t; m.last = line; }
      else if (P.length) { st = P[0].w >= 2 ? 'warn' : 'ok'; line = 'ينصح: ' + P[0].t; m.last = line; }
      rows.push({ k, st, t: line }); }
    // المالية: تحذير مبكر قبل ما تخلص الخزينة
    const net = netOf(G); if (net < 0 && e.cash > 0) { const mo = e.cash / -net; if (mo < 8) { const R = rows.find(x => x.k === 'fin'); R.st = mo < 3 ? 'bad' : 'warn'; R.t = `⚠ بهالمعدل الخزينة تخلص بعد ~${Math.max(1, Math.round(mo))} شهر (${net.toFixed(2)} بالشهر)`; } }
    if (e.cash < 0) { const R = rows.find(x => x.k === 'fin'); R.st = 'bad'; }
    C.props = C.props.filter(p => G.t - p.at < 90).slice(-8);
    // مرشحين أحسن كل ~6 أشهر
    if (G.t >= C.candT) { C.candT = G.t + 150 + Math.floor(r() * 90); const k = pick(r, MK), cur = C.m[k], p = person(G, k, cur.sk + (r() < .6 ? 1 : r() < .5 ? 0 : 2), r); if (p.sk > cur.sk || r() < .3) { C.cand.push(p); if (C.cand.length > 3) C.cand.shift(); acts.push(`👤 مرشّح لـ${MIN[k].n}: ${p.n} (${p.sk} نجوم)`); } }
    C.rep = { t: G.t, rows, acts }; C.log = acts.concat(C.log).slice(0, 30);
    const nb = rows.filter(x => x.st !== 'ok').length; if (nb || acts.length) G.log.push({ t: G.t, k: 'cab', warn: nb, n: acts.length, a: acts[0] || '' });
  }
  // موافقة/رفض اقتراح
  function answer(G, WD, S, id, yes) { const C = ensure(G), i = C.props.findIndex(p => p.id === id); if (i < 0) return 'غلط'; const p = C.props.splice(i, 1)[0]; if (!yes) return { ok: true }; return exec(G, WD, S, p.c) ? { ok: true, t: p.t } : 'ما ينفع هسه'; }
  function setMode(G, k, mode) { const C = ensure(G); if (!MIN[k] || !['me', 'ask', 'auto'].includes(mode)) return 'غلط'; C.mode[k] = mode; return { ok: true }; }
  // تعيين مرشّح: فئة الجديد ترضى، وفئة القديم تزعل
  function appoint(G, id) { const C = ensure(G), i = C.cand.findIndex(p => p.id === id); if (i < 0) return 'غلط'; const p = C.cand.splice(i, 1)[0], old = C.m[p.k], F = G.nat.home && G.nat.home.fac;
    if (F) { if (F[old.fac] != null) F[old.fac] = clamp(F[old.fac] - 6, 0, 100); if (F[p.fac] != null) F[p.fac] = clamp(F[p.fac] + 4, 0, 100); }
    p.t0 = G.t; C.m[p.k] = p; G.log.push({ t: G.t, k: 'cab', a: `👤 عيّنا ${p.n} وزير ${MIN[p.k].n} بدل ${old.n}`, n: 1, warn: 0 }); return { ok: true, old }; }
  // ===== «ليش نخسر؟»: أكبر الأسباب بين هسه وقبل ~سنة =====
  function why(G) {
    const C = ensure(G), s = C.snap; if (s.length < 3) return [];
    const b = s[s.length - 1], a = s[Math.max(0, s.length - 13)], out = [], pct = (x, y) => y ? (x - y) / Math.abs(y) * 100 : 0;
    const dOil = b.og - a.og; if (Math.abs(dOil) > b.gdp * .01) out.push({ w: Math.abs(dOil), bad: dOil < 0, k: 'oil', t: `دخل النفط ${dOil < 0 ? 'نزل' : 'صعد'} ${Math.abs(pct(b.og, a.og)).toFixed(0)}٪: السعر ${a.oilP}$ ← ${b.oilP}$${a.kbd !== b.kbd ? ` والإنتاج ${a.kbd} ← ${b.kbd} ألف برميل` : ''}` });
    const dCore = b.core - a.core; if (Math.abs(dCore) > b.gdp * .005) out.push({ w: Math.abs(dCore), bad: dCore < 0, k: 'ind', t: `الاقتصاد غير النفطي ${dCore < 0 ? 'نزل' : 'كبر'} ${Math.abs(pct(b.core, a.core)).toFixed(1)}٪` });
    const net = netOf(G); if (net < -.01) out.push({ w: -net * 12, bad: true, k: 'fin', t: `الخزينة تنقص ${(-net).toFixed(2)} مليار بالشهر${b.cash > 0 ? `: تخلص بعد ~${Math.max(1, Math.round(b.cash / -net))} شهر` : ''}` });
    else if (net > .01) out.push({ w: net * 12, bad: false, k: 'fin', t: `الخزينة تزيد ${net.toFixed(2)} مليار بالشهر` });
    const dSt = b.stab - a.stab; if (Math.abs(dSt) >= 4) { const F = G.nat.home && G.nat.home.fac, lo = F ? Object.entries(F).sort((x, y) => x[1] - y[1])[0] : null, FN = (HOME() && HOME().FAC) || {};
      out.push({ w: Math.abs(dSt) * b.gdp * .002, bad: dSt < 0, k: 'int', t: `الاستقرار ${a.stab} ← ${b.stab}${lo ? `؛ أزعل فئة: ${(FN[lo[0]] || {}).n || lo[0]} (${Math.round(lo[1])})` : ''}` }); }
    return out.sort((x, y) => (y.bad - x.bad) || (y.w - x.w)).slice(0, 4);
  }
  const API = { MIN, MK, TR, ensure, plan, exec, month, answer, setMode, appoint, why, floorOf, netOf };
  if (typeof module !== 'undefined') module.exports = API; else root.WCAB = API;
})(typeof window !== 'undefined' ? window : globalThis);
