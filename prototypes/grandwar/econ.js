// «الحرب الكبرى» GW8 (I-090): الدولة والاقتصاد والإنتاج. بدون رسم؛ ينفحص بـ Node (tests/econ.test.mjs).
// الفكرة: كل شي بالحرب يصير قرار بفلوس.
//  - الدخل: النفط (حقول حقيقية تقريبية على الخريطة، تتصدّر من موانئ البصرة/جزيرة خرج) + ضرائب ودخل غير نفطي.
//  - المصاريف: رواتب ومصاريف الدولة، الجيش (الفرقة بالقتال تكلّف أكثر)، الطلعات، تصليح الحقول.
//  - الإنتاج: خطوط إنتاج؛ تطلب فرقة أو طيارة أو صواريخ دفاع جوي أو خط جديد، تدفع، وتوصل بعد أيام.
//  - أولوية الاقتصاد: مدني / متوازن / اقتصاد حرب.
//  - معنويات الشعب: تنزل بالخسائر والعجز وطول الحرب، وتصعد بالانتصارات. إذا انهارت الدولة تستسلم.
// كل الأرقام [تقدير] مقرّبة من الواقع (2024–2026)، بمليار دولار، واليوم هو وحدة الحساب.
(function (root) {
  const LL = (lat, lon) => [(lon - 38.5) * 93.3608, (40.2 - lat) * 110.57];   // نفس إسقاط air.js
  // ===== حقول النفط ومنافذ التصدير =====
  // out: مليون برميل/يوم. route: من وين يطلع للتصدير. off: بعيد عن الخريطة (ما ينضرب ولا ينحتل)
  const SITES = [
    { n: 'الرميلة', ll: [30.45, 47.35], side: 0, out: 1.45, route: 'south' },
    { n: 'غرب القرنة', ll: [30.95, 47.3], side: 0, out: .9, route: 'south' },
    { n: 'الزبير', ll: [30.3, 47.6], side: 0, out: .45, route: 'south' },
    { n: 'مجنون', ll: [31.05, 47.65], side: 0, out: .4, route: 'south' },
    { n: 'حقول ميسان', ll: [31.75, 47.5], side: 0, out: .45, route: 'south' },
    { n: 'كركوك', ll: [35.45, 44.4], side: 0, out: .35, route: 'north' },
    { n: 'موانئ البصرة النفطية', ll: [29.97, 48.47], side: 0, term: 'south' },
    { n: 'الأهواز', ll: [31.3, 48.75], side: 1, out: .75, route: 'kharg' },
    { n: 'مارون', ll: [31.0, 49.45], side: 1, out: .5, route: 'kharg' },
    { n: 'آزادكان', ll: [31.45, 47.85], side: 1, out: .35, route: 'kharg' },
    { n: 'آغاجاري', ll: [30.75, 49.8], side: 1, out: .25, route: 'kharg' },
    { n: 'كجساران', ll: [30.35, 50.8], side: 1, out: .5, route: 'kharg' },
    { n: 'باقي حقول إيران', side: 1, out: .95, route: 'kharg', off: 1 },
    { n: 'جزيرة خرج', ll: [29.25, 50.32], side: 1, term: 'kharg' },
  ];
  // لكل دولة: نسبة النفط اللي تتصدّر، خصم السعر (إيران تبيع بخصم بسبب العقوبات)، دخل غير نفطي، مصاريف الدولة، كلفة الجيش، حد الدين
  const LAND = [
    { n: 'العراق', exp: .82, disc: 1, other: .04, civ: .25, mil: 1, lim: 15, cash: 20, mor: 62, lines: 4 },
    { n: 'إيران', exp: .45, disc: .75, other: .11, civ: .16, mil: .5, lim: 10, cash: 10, mor: 58, lines: 4 },
  ];
  // كلفة الفرقة باليوم (مليار $): بالراحة، وبالقتال ×2.5، وبالمسير ×1.5
  const UPKEEP = { inf: .0011, mec: .002, arm: .0028 };
  const SORTIE = [.0004, .00025];   // كلفة الطلعة (وقود، ذخيرة، صيانة)
  const PRIO = {
    civ: { n: 'مدني', civ: 1, prod: .8, other: 1.08, mor: .04, d: 'الإنتاج الحربي أبطأ ×0.8، دخل أكثر، والشعب أرضى' },
    bal: { n: 'متوازن', civ: 1, prod: 1, other: 1, mor: 0, d: 'نص ونص' },
    war: { n: 'اقتصاد حرب', civ: .85, prod: 1.35, other: .95, mor: -.06, d: 'المصانع تشتغل للحرب: الإنتاج أسرع ×1.35، وتوفّر من مصاريف الدولة، بس الشعب يتعب' },
  };
  // ===== اللي تقدر تطلبه =====
  // cost/days: [العراق، إيران] أو رقم واحد. side: لدولة وحدة بس. pool: صواريخ تروح لمخزون البلد. plane: نوع الطيارة
  const ITEMS = {
    inf: { n: 'فرقة مشاة', ic: '🪖', cat: 'div', cost: [.35, .2], days: [14, 12], d: 'تعبئة وتدريب وتسليح' },
    mec: { n: 'فرقة آلية', ic: '🚙', cat: 'div', cost: [1.6, 1], days: [28, 30], d: 'مدرعات وشاحنات ومدفعية' },
    arm: { n: 'فرقة مدرعة', ic: '🛡', cat: 'div', cost: [2.8, 1.6], days: [40, 45], d: 'دبابات (أبرامز وT-72 / كرار)' },
    f16: { n: 'F-16IQ ×2', ic: '✈', cat: 'plane', plane: 'f16', q: 2, side: 0, cost: .14, days: 30, d: 'من أمريكا، تعويض الخسائر' },
    su25: { n: 'سوخوي-25 ×4', ic: '✈', cat: 'plane', plane: 'su25', q: 4, side: 0, cost: .1, days: 25, d: 'من روسيا/بيلاروسيا' },
    ch4: { n: 'مسيّرة CH-4B ×2', ic: '📡', cat: 'plane', plane: 'ch4', q: 2, side: 0, cost: .012, days: 10, d: 'من الصين' },
    f14: { n: 'F-14 ×2 (تصليح من المخزن)', ic: '✈', cat: 'plane', plane: 'f14', q: 2, side: 1, cost: .06, days: 35, d: 'تفكيك طيارات قديمة للقطع' },
    su24: { n: 'سوخوي-24 ×2', ic: '✈', cat: 'plane', plane: 'su24', q: 2, side: 1, cost: .05, days: 30, d: 'تصليح من المخزن' },
    m6: { n: 'مسيّرة مهاجر-6 ×2', ic: '📡', cat: 'plane', plane: 'm6', q: 2, side: 1, cost: .008, days: 8, d: 'صنع محلي' },
    pac2: { n: 'PAC-2 GEM-T ×8', ic: '🚀', cat: 'sam', pool: 'PAC-2 GEM-T', q: 8, side: 0, cost: .032, days: 30, d: 'لباتريوت: طيارات وكروز' },
    pac3: { n: 'PAC-3 MSE ×8', ic: '🚀', cat: 'sam', pool: 'PAC-3 MSE', q: 8, side: 0, cost: .034, days: 40, d: 'لباتريوت: ضد الباليستي' },
    e57: { n: '57E6 ×24', ic: '🚀', cat: 'sam', pool: '57E6', q: 24, side: 0, cost: .006, days: 20, d: 'لبانتسير: مسيّرات وكروز' },
    n48: { n: '48N6E2 ×8', ic: '🚀', cat: 'sam', pool: '48N6E2', q: 8, side: 1, cost: .016, days: 60, d: 'لـS-300 (من روسيا، بطيء)' },
    s4: { n: 'صياد-4 ×8', ic: '🚀', cat: 'sam', pool: 'صياد-4', q: 8, side: 1, cost: .01, days: 20, d: 'لباور-373' },
    s3: { n: 'صياد-3 ×8', ic: '🚀', cat: 'sam', pool: 'صياد-3', q: 8, side: 1, cost: .006, days: 15, d: 'لخرداد-15' },
    t9: { n: '9M331 ×8', ic: '🚀', cat: 'sam', pool: '9M331', q: 8, side: 1, cost: .004, days: 15, d: 'لتور' },
    line: { n: 'خط إنتاج جديد', ic: '🏭', cat: 'line', cost: [1.2, .8], days: [60, 50], d: 'تقدر تصنع شيين بنفس الوقت أكثر' },
  };
  const byS = (v, s) => Array.isArray(v) ? v[s] : v;
  const costOf = (k, s) => byS(ITEMS[k].cost, s);
  const daysOf = (k, s) => byS(ITEMS[k].days, s);
  const itemsFor = s => Object.keys(ITEMS).filter(k => ITEMS[k].side == null || ITEMS[k].side === s);

  // أقرب منطقة للنقطة (لحد 60 كم)
  function cellNear(W, p) { let best = -1, bd = 60; for (let i = 0; i < W.N; i++) { const c = W.cells[i].c, d = Math.hypot(c[0] - p[0], c[1] - p[1]); if (d < bd) { bd = d; best = i; } } return best; }

  function init(W) {
    W.eco = LAND.map((L, s) => ({ cash: L.cash, mor: L.mor, prio: 'bal', lines: L.lines, q: [], oid: 1, auto: true, day: Math.floor(W.t / 24), last: null, hist: [], morWhy: [] }));
    W.oil = { price: 95, sites: SITES.map(S => ({ n: S.n, side: S.side, out: S.out || 0, route: S.route, term: S.term, off: !!S.off, p: S.ll ? LL(...S.ll) : null, cell: S.ll ? cellNear(W, LL(...S.ll)) : -1, dmg: 0 })) };
    return W;
  }
  // حفظ قديم (قبل GW8) ← نبني الاقتصاد من جديد على حالة الحرب
  function ensure(W) { if (!W.eco) init(W); return W; }

  // حالة الموقع: شغال، بخطر (قرب الجبهة)، مضروب، بيد العدو
  function siteState(W, f) {
    if (f.off || f.cell < 0) return { k: 'ok', f: 1 };
    if (W.ctrl[f.cell] !== f.side) return { k: 'lost', f: 0 };
    let f0 = 1, k = 'ok';
    if (!f.term && W.cells[f.cell].nb.some(j => W.ctrl[j] !== f.side)) { f0 = .75; k = 'risk'; }   // قرب الجبهة: العمال ينسحبون جزئياً
    if (f.dmg > 0) { f0 *= .25; k = 'dmg'; }
    return { k, f: f0 };
  }
  // إنتاج وتصدير النفط لدولة (مليون برميل/يوم)
  function oilOf(W, s) {
    const O = W.oil, routes = {};
    for (const f of O.sites) if (f.term && f.side === s) routes[f.term] = siteState(W, f).f;
    let prod = 0, exp = 0;
    for (const f of O.sites) if (!f.term && f.side === s) { const q = f.out * siteState(W, f).f; prod += q; exp += q * (routes[f.route] ?? 1); }
    return { prod, exp: exp * LAND[s].exp };
  }
  // ميزانية اليوم (بدون شراء): كل بند لحاله حتى ينعرض للاعب
  function budget(W, A, s) {
    const e = W.eco[s], L = LAND[s], P = PRIO[e.prio], o = oilOf(W, s);
    const price = W.oil.price * L.disc * (s === 1 && W.dip && W.dip.sanc > W.t ? .8 : 1);   // GW10: العقوبات الأمريكية تكبّر خصم إيران
    const oil = o.exp * price * 1e-3, other = L.other * P.other;
    let army = 0; for (const d of W.divs) if (!d.dead && d.side === s && !d.ally) army += UPKEEP[d.kind] * (W.t - d.lastFight < 24 ? 2.5 : d.path.length ? 1.5 : 1) * L.mil;
    const civ = L.civ * P.civ;
    const air = (A && A.sor ? A.sor[s] : 0) * SORTIE[s];
    const fix = W.oil.sites.filter(f => f.side === s && f.dmg > 0).length * .002;
    const debt = e.cash < 0 ? -e.cash * .0003 : 0;
    const inc = oil + other, out = civ + army + air + fix + debt;
    return { oil, other, civ, army, air, fix, debt, inc, out, net: inc - out, prod: o.prod, exp: o.exp, price };
  }

  // ===== الطلب (الشراء) =====
  function canBuy(W, s, k) {
    const it = ITEMS[k]; if (!it || (it.side != null && it.side !== s)) return 'مو متوفر';
    const e = W.eco[s]; if (e.cash - costOf(k, s) < -LAND[s].lim * .5) return 'الفلوس ما تكفي (وصلنا حد الدين)';
    return null;
  }
  function buy(W, s, k, why) {
    const err = canBuy(W, s, k); if (err) return err;
    const e = W.eco[s], c = costOf(k, s), d = daysOf(k, s);
    e.cash -= c; e.spent = (e.spent || 0) + c;
    const o = { id: e.oid++, k, left: d, tot: d, paid: c, t: W.t }; e.q.push(o);
    if (!why) W.log.push({ t: W.t, side: s, k: 'order', it: k });
    return o;
  }
  function cancel(W, s, id) {
    const e = W.eco[s], i = e.q.findIndex(o => o.id === id); if (i < 0) return 0;
    const o = e.q[i], back = o.paid * (o.left < o.tot ? .5 : 1); e.cash += back; e.q.splice(i, 1); return back;
  }
  // توصيل الطلب
  function deliver(W, A, s, o, SIM) {
    const it = ITEMS[o.k];
    if (it.cat === 'div') {
      // بأكبر مدينة مزودة بأرضنا (مثل التعبئة)، وتنضم لأقرب جيش
      let best = -1, bv = -1; W.cells.forEach((c, i) => { if (W.ctrl[i] === s && c.s === s && W.sup[s][i] && (c.vp || 0) > bv) { bv = c.vp || 0; best = i; } });
      if (best < 0) return false;
      W.num = W.num || [100, 200]; const d = SIM.addDiv(W, s, o.k, best, W.num[s]++); d.org = d.orgMax * .6; SIM.joinArmy(W, d);
      W.log.push({ t: W.t, side: s, k: 'built', it: o.k, gift: o.gift, div: d.n, cell: best });
    } else if (it.cat === 'plane') {
      if (!A) return true;
      const bs = A.bases.filter(b => b.side === s && b.type === it.plane); if (!bs.length) return true;
      for (let n = 0; n < (it.q || 1); n++) { const b = bs.sort((a, c) => (c.max - c.n0) - (a.max - a.n0))[0]; if (b.n0 >= b.max) b.max++; b.n0++; b.ready++; }
      const b = bs[0];
      W.log.push({ t: W.t, side: s, k: 'built', it: o.k, gift: o.gift, base: b.n });
    } else if (it.cat === 'sam') {
      if (A) A.pool[s][it.pool] = (A.pool[s][it.pool] || 0) + it.q;
      W.log.push({ t: W.t, side: s, k: 'built', it: o.k, gift: o.gift });
    } else if (it.cat === 'line') { W.eco[s].lines++; W.log.push({ t: W.t, side: s, k: 'built', it: o.k, gift: o.gift }); }
    return true;
  }

  // ===== ضرب النفط =====
  function hitOil(W, i, side, p = .6) {
    const f = W.oil.sites[i]; if (!f || f.off || f.side === side) return false;
    if (W.rnd() > p) return false;
    const h = (f.term ? 96 : 120) + Math.round(W.rnd() * 168); f.dmg = Math.max(f.dmg, h);
    W.oil.price = Math.min(150, W.oil.price + (f.term ? 6 : 2.5));
    W.log.push({ t: W.t, side, k: 'oilhit', n: f.n, d: Math.round(h / 24), vs: f.side });
    W.eco[f.side].hit = (W.eco[f.side].hit || 0) + 1;
    return true;
  }
  // هدف نفطي للعدو (للطيارات والضربات): أقرب حقل/ميناء شغال بأرضه، بالمدى
  function oilTarget(W, side, from, maxD, avoid) {
    const c = W.oil.sites.map((f, i) => ({ f, i })).filter(({ f }) => f.side !== side && !f.off && f.p && !(f.dmg > 0) && f.cell >= 0 && W.ctrl[f.cell] === f.side && Math.hypot(f.p[0] - from[0], f.p[1] - from[1]) < maxD && !(avoid && avoid(f.p)));
    if (!c.length) return null; c.sort((a, b) => (b.f.out || 1.2) - (a.f.out || 1.2)); return c[Math.floor(W.rnd() * Math.min(2, c.length))];
  }

  // ===== كل يوم =====
  function daily(W, A, SIM) {
    ensure(W);
    const O = W.oil, day = Math.floor(W.t / 24);
    // سعر النفط: الحرب بالخليج ترفعه، والضربات تقفزه، ويرجع ببطء [تقدير]
    const lostQ = O.sites.reduce((q, f) => q + (f.term ? 0 : f.out * (1 - siteState(W, f).f)), 0);
    const tgt = 88 + lostQ * 6;
    O.price = Math.max(60, Math.min(150, O.price + (tgt - O.price) * .06 + (W.rnd() - .5) * 3));
    for (const f of O.sites) if (f.dmg > 0) f.dmg = Math.max(0, f.dmg - 24);
    for (const s of [0, 1]) {
      const e = W.eco[s], P = PRIO[e.prio], L = LAND[s];
      const B = budget(W, A, s); e.cash += B.net; e.last = B;
      // الإنتاج: الخطوط تشتغل على أول الطلبات بالترتيب
      const sp = P.prod * (e.mor < 30 ? .75 : 1);
      for (let k = 0; k < Math.min(e.lines, e.q.length); k++) e.q[k].left -= sp * (ITEMS[e.q[k].k].cat === 'div' && e.mor < 30 ? .8 : 1);
      for (let k = e.q.length - 1; k >= 0; k--) if (e.q[k].left <= 0) { const o = e.q[k]; if (deliver(W, A, s, o, SIM)) e.q.splice(k, 1); }
      morale(W, s, B);
      e.hist.push([day, +e.cash.toFixed(2), Math.round(e.mor)]); if (e.hist.length > 120) e.hist.shift();
      if (e.cash < -L.lim && !e.broke) { e.broke = 1; W.log.push({ t: W.t, side: s, k: 'broke' }); } else if (e.cash > 0) e.broke = 0;
    }
    // GW11 B1: سجل يومي للتقرير والرسوم: [يوم، نقاطنا، نقاطهم، خزينتنا، معنوياتنا، فرقنا، فرقهم، طياراتنا، طياراتهم، أسقطنا، أسقطوا، مناطقنا]
    { const vp = [0, 0], dv = [0, 0], pl = [0, 0]; W.cells.forEach((c, i) => { if (c.vp) vp[W.ctrl[i]] += c.vp; }); for (const d of W.divs) if (!d.dead) dv[d.side]++;
      if (A) for (const b of A.bases) pl[b.side] += b.n0;
      W.stats = W.stats || []; W.stats.push([day, vp[0], vp[1], +W.eco[0].cash.toFixed(2), Math.round(W.eco[0].mor), dv[0], dv[1], pl[0], pl[1], A ? A.kills[0] : 0, A ? A.kills[1] : 0, W.ctrl.reduce((n, x) => n + (x === 0 ? 1 : 0), 0)]);
      if (W.stats.length > 400) W.stats.shift(); }
    if (A) A.sor = [0, 0];
    for (const s of [0, 1]) if (s === 1 || W.eco[s].auto) aiEco(W, A, s);
    for (const s of [0, 1]) W.eco[s].day = day;
  }
  // معنويات الشعب: الأحداث من آخر يوم + الأولوية + العجز + طول الحرب
  function morale(W, s, B) {
    const e = W.eco[s], P = PRIO[e.prio], why = [];
    let dm = P.mor; if (P.mor) why.push([P.mor, P.n]);
    const wear = W.t > 24 * 30 ? -.05 : -.03; dm += wear; why.push([wear, 'طول الحرب']);
    if (e.cash < -LAND[s].lim) { dm -= 1.5; why.push([-1.5, 'رواتب متأخرة']); } else if (e.cash < 0) { dm -= .4; why.push([-.4, 'الدولة بالدين']); }
    for (let i = W.log.length - 1; i >= 0 && W.log[i].t > W.t - 24; i--) {
      const l = W.log[i];
      if (l.k === 'take' && l.cell != null) { const c = W.cells[l.cell]; if (!c.vp) continue; if (c.s === s && l.side !== s) { dm -= c.vp * 1.2; why.push([-c.vp * 1.2, 'خسرنا ' + (c.city || 'مدينة')]); } else if (l.side === s) { const v = c.s === s ? c.vp * 1.2 : c.vp * .8; dm += v; why.push([v, 'أخذنا ' + (c.city || 'مدينة')]); } }
      if (l.k === 'surrender') { if (l.side === s) { dm -= 1.5; why.push([-1.5, 'فرقة استسلمت']); } else { dm += .8; why.push([.8, 'فرقة عدو استسلمت']); } }
      if (l.k === 'oilhit' && l.vs === s) { dm -= .5; why.push([-.5, 'ضربوا ' + l.n]); }
      if (l.k === 'oilhit' && l.side === s) { dm += .3; why.push([.3, 'ضربنا ' + l.n]); }
    }
    e.mor = Math.max(0, Math.min(100, e.mor + dm)); e.dm = dm;
    e.morWhy = why.filter(w => Math.abs(w[0]) >= .01).slice(-6);
  }
  // ===== الوزير (الذكاء): يدير اقتصاد إيران دايماً، والعراق إذا خليته تلقائي =====
  function aiEco(W, A, s) {
    const e = W.eco[s], L = LAND[s];
    if (W.t > 24 * 3) e.prio = e.mor > 40 && e.cash > -L.lim * .3 ? 'war' : e.mor < 30 ? 'civ' : 'bal';
    const queued = k => e.q.filter(o => o.k === k).length;
    const room = () => e.q.length < e.lines + 1;
    const afford = k => e.cash - costOf(k, s) > -L.lim * .25;
    const planes = () => { if (A) for (const k of itemsFor(s)) { const it = ITEMS[k]; if (it.cat !== 'plane' || !room()) continue; const miss = A.bases.filter(b => b.side === s && b.type === it.plane).reduce((n, b) => n + b.max - b.n0, 0); if (miss >= it.q && queued(k) < Math.min(3, Math.floor(miss / it.q)) && afford(k)) buy(W, s, k, 'ai'); } };
    const divs = () => { const n = W.divs.filter(d => !d.dead && d.side === s).length + e.q.filter(o => ITEMS[o.k].cat === 'div').length;
      if (W.ob && n < W.ob[s] && room()) { const k = e.cash > 12 ? (n % 2 ? 'arm' : 'mec') : 'inf'; if (afford(k)) buy(W, s, k, 'ai'); } };
    const alive = W.divs.filter(d => !d.dead && d.side === s).length;
    // 0) الجيش نازل تحت 90%: الفرق أول شي. والقوة الجوية تحت 60%: الطيارات
    if (W.ob && alive < W.ob[s] * .9) divs();
    if (A) { const n0 = A.bases.filter(b => b.side === s).reduce((n, b) => n + b.n0, 0), mx = A.bases.filter(b => b.side === s).reduce((n, b) => n + b.max, 0); if (n0 < mx * .6) planes(); }
    // 1) صواريخ الدفاع الجوي إذا مخزون البلد قليل
    if (A) for (const k of itemsFor(s)) { const it = ITEMS[k]; if (it.cat !== 'sam' || !room()) continue; if ((A.pool[s][it.pool] || 0) < it.q * 2 && !queued(k) && afford(k)) buy(W, s, k, 'ai'); }
    // 2) تعويض الطيارات، 3) الفرق لحد حجم الجيش الأصلي (مشاة، والغني يشتري دروع)
    planes(); divs();
    // 4) خط إنتاج إذا عندنا فلوس والطابور مليان
    if (e.cash > 8 && e.q.length >= e.lines && e.lines < 7 && !queued('line')) buy(W, s, 'line', 'ai');
  }
  // معامل المعنويات على راحة الفرق (sim.js يقراه): تحت 50 التنظيم يرجع أبطأ
  const morF = (W, s) => !W.eco ? 1 : W.eco[s].mor >= 50 ? 1 : .6 + .4 * W.eco[s].mor / 50;

  const API = { SITES, LAND, ITEMS, PRIO, UPKEEP, init, ensure, budget, oilOf, siteState, canBuy, buy, cancel, deliver, daily, hitOil, oilTarget, itemsFor, costOf, daysOf, morF, aiEco };
  if (typeof module !== 'undefined') module.exports = API; else root.ECON = API;
})(this);
