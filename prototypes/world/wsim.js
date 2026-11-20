// «العالم» GW12 W3: محاكاة 157 دولة (السلام أساس، والحرب قرار). فحص: node tests/wsim.test.mjs
// الوقت يمشي بالأيام، والحساب الكبير كل شهر: اقتصاد كل دولة، الاستقرار، الجيش، الحروب، والذكاء.
// كل رقم بالتصميم مكتوب بـ docs/features/world-w3.md؛ الأرقام [تقدير] تنضبط بالمحاكاة (strategy-balance).
(function (root) {
  'use strict';
  const START = Date.UTC(2026, 10, 20);   // 20 تشرين الثاني 2026: الوضع الحقيقي (D-048)
  const V = 4;                              // إصدار حفظ «العالم» (2: الصواريخ والدفاع الجوي؛ 3: البحرية والمضائق)
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  // ===== ثوابت [تقدير] =====
  const K = {
    oilBase: 65, oilDisrupt: 3.5,        // سعر النفط = 65$ × (1 + 3.5 × نسبة النفط المقطوع عالمياً)
    oilTake: .6,                          // حصة الحكومة من دخل النفط
    upkeep: 1 / 72,                       // الجيش يحتاج تمويل: بدون ميزانية يخسر ~1.4٪ بالشهر (يتآكل بـ6 سنين)
    apMonth: 2, apMax: 8,                 // نقاط القرار
    stabMove: .08,                        // الاستقرار يمشي 8٪ من الفرق كل شهر
    tradeG: .15, tradeMax: 1,             // كل اتفاقية تجارة +0.15٪ نمو (حد 1٪)
    sancG: { heavy: -1.5, medium: -.8, light: -.3 },
    warHomeG: -1.5, warAwayG: -.4, warHomeStab: -10,
    collapse: { stab: 15, months: 6 },    // الاستقرار تحت 15 لستة أشهر = انهيار النظام
  };
  const TAX = { low: { r: -.04, g: .3, s: 3 }, mid: { r: 0, g: 0, s: 0 }, high: { r: .04, g: -.4, s: -6 } };
  const CIV = { cut: { k: .85, g: -.5, s: -8 }, mid: { k: 1, g: 0, s: 0 }, more: { k: 1.12, g: .2, s: 5 } };
  const TERR_DEF = { plain: 1, desert: 1.1, hills: 1.4, mount: 2, marsh: 1.8, forest: 1.4, jungle: 1.8, tundra: 1.3, snow: 1.6, city: 2.2 };

  // ===== البداية =====
  function init(WD, me, opt = {}) {
    const seed = opt.seed ?? 20261120, W = { v: V, seed, rs: seed, t: 0, me, ap: 4, log: [], over: null, cfg: { diff: opt.diff || 'normal' } };
    W.ids = Object.keys(WD.cs).sort();
    W.ctl = WD.r.map(a => a[2] || '');               // المسيطر على كل منطقة (يتغير بالحرب)
    W.C = {};
    for (const id of W.ids) W.C[id] = initCountry(WD, id);
    // العلاقات: نسخة من rel.json (القيم الأصلية = «الأساس» اللي ترجعله ببطء)
    W.rel = {}; for (const a in WD.rel) W.rel[a] = { ...WD.rel[a] };
    W.base = WD.rel;
    // المعاهدات الدفاعية: الناتو (المادة 5) + الاتفاقيات الثنائية؛ التكتلات من tr
    W.pacts = [];
    for (const id of W.ids) for (const t of WD.cs[id].tr || []) if (t.startsWith('PACT_')) { const o = t.slice(5); if (id < o && WD.cs[o]) W.pacts.push([id, o]); }
    W.natoL = W.ids.filter(id => (WD.cs[id].tr || []).includes('NATO'));
    W.trade = [];   // [a, b]
    W.sanc = [];    // [by, on, level]  (العقوبات الحقيقية تنحسب من الـ cs: نخزن بس اللي يضيفها اللاعب أو الذكاء)
    W.wars = [];
    for (const w of opt.wars || START_WARS) W.wars.push({ ...w, since: 0, months: 0, weary: Object.fromEntries([...w.a, ...w.b].map(x => [x, w.weary0 || 30])), score: w.score0 || 0, taken: {} });
    W.stx = { hormuz: .65 };   // W5d: نسبة القطع بكل مضيق (هرمز حقيقي: يشتغل ~35٪ من الطبيعي)
    W.hormuz = .65;
    price(W, WD);
    for (const id of W.ids) { const c = W.C[id]; c.oil = oilOf(W, WD, id); c.oil0 = c.oil; c.core = Math.max(c.gdp * .2, c.gdp - oilGDP(c.oil, W.oilP)); c.revCore = clamp((c.rev0 * c.gdp - K.oilTake * oilGDP(c.oil, W.oilP)) / c.core, .06, .45);
      // نثبّت العجز الأولي على الحقيقي تقريباً (بيانات الإيرادات والمصاريف من سنين مختلفة، فنحصره بين فائض 3٪ وعجز 5٪)
      const dp = c.debt / c.gdp * 100, rev = c.core * c.revCore + oilGDP(c.oil, W.oilP) * K.oilTake, def = clamp(c.spend0 - c.rev0, -.03, .05) * c.gdp;
      c.civ0 = clamp((rev + def - c.gdp * c.milPct / 100 - c.debt * rate(c, dp)) / c.core, .03, .6); }
    W.rnd = mulberry(W.rs); ix(W, WD); note(W, { k: 'start', me });
    return W;
  }
  // الحروب الجارية بين دول (الحروب ويا الكيانات تبقى استنزاف داخلي): من data/world/conflicts.json
  const START_WARS = [
    { id: 'iran_war', n: 'حرب إيران 2026', a: ['USA', 'ISR'], b: ['IRN'], score0: 25, weary0: 45, fort0: 2.5 },
    { id: 'ukraine', n: 'الحرب الروسية الأوكرانية', a: ['RUS'], b: ['UKR'], score0: 10, weary0: 60, fort0: 2.5 },
  ];
  function initCountry(WD, id) {
    const s = WD.cs[id], gdp = s.gdp || 5, mil = s.milPct ?? (s.mb && s.gdp ? s.mb / s.gdp * 100 : 1.5), t = s.tech || {};
    // القوة [تقدير]: بري (دبابات بجيلها، طيران، مروحيات، أفراد) × المسيّرات، + بحري (سفن، غواصات)
    const gq = (k, d) => 1 + (((s.gen || {})[k] ?? d) - 2) / 4;   // جيل السلاح (W4): الجيل 2 = ×1، الجيل 4 = ×1.5
    const land = ((s.tanks || 0) * .5 * gq('tank', 1 + (t.arm || 1) / 2) + (s.air || 0) * 1.5 * gq('jet', 1 + (t.air || 1) / 2) + (s.heli || 0) * gq('heli', 2) + (s.act || 0) / 800) * (1 + (t.uav || 1) / 10);
    const sea = (s.ships || 0) * 6 + (s.subs || 0) * 4, pw = land + sea;
    // النمو الأساسي: 30٪ من آخر سنة حقيقية + 70٪ «لحاق» (الدول الفقيرة تنمو أسرع) [تقدير]
    const pc = gdp * 1e9 / (s.pop || 1e6), conv = 1.8 + 2.4 * (1 - Math.min(1, pc / 40000));
    const g0 = clamp(.3 * (s.g ?? conv) + .7 * conv, -1, 6.5);
    return { id, gdp, g0, g: g0, pop: s.pop || 1e6, debt: gdp * (s.debt ?? 55) / 100, rev0: clamp((s.rev ?? 22) / 100, .08, .5),
      spend0: clamp((s.spend ?? (s.rev ?? 22) + 2) / 100, .08, .6), milPct: clamp(mil, .3, 30), tax: 'mid', civ: 'mid',
      stab0: s.stab ?? 55, stab: s.stab ?? 55, landK: pw > 0 ? land / pw : 1, pw: Math.max(1, pw), pw0: Math.max(1, pw), nuke: s.nuke || 0, low: 0, cash: 0, bal: 0, why: [],
      // W5c: الصواريخ والمسيّرات بعيدة المدى والدفاع الجوي [تقدير]: المخزون حسب مستوى صناعة الصواريخ/المسيّرات، والإنتاج الشهري كذلك
      msl: [0, 20, 80, 300, 1000, 2500][t.msl || 0], drn: [0, 30, 150, 600, 2000, 4000][t.uav || 0],
      mslP: [0, 1, 3, 10, 35, 80][t.msl || 0], drnP: [0, 5, 25, 100, 300, 600][t.uav || 0],
      nav: Math.max(0, sea * gq('navy', 2)), navMode: 'block', blk: 0,
      adI: Math.round((Math.sqrt(((s.kit && s.kit.ad && s.kit.ad[0]) || 0)) * 4 + Math.sqrt(s.mb || 0) * 5) * (.6 + .2 * ((s.gen || {}).ad || 3))), oilDmg: 0 };
  }
  // الفائدة: الدول الغنية تقترض أرخص؛ والدين فوك 90٪ يرفعها [تقدير]
  const rate = (c, dp) => (c.gdp / c.pop * 1e9 > 30000 ? .012 : .035) + .0002 * Math.max(0, dp - 90);
  // ===== النفط =====
  const oilGDP = (kbd, P) => kbd * 1000 * 365 * P / 1e9;   // مليار $ بالسنة
  function oilOf(W, WD, id) { let o = 0; for (let i = 0; i < WD.r.length; i++) if (W.ctl[i] === id) o += WD.r[i][10] || 0; return o * (1 - ((W.C && W.C[id] && W.C[id].oilDmg) || 0)) * (1 - .6 * ((W.C && W.C[id] && W.C[id].blk) || 0)); }
  function price(W, WD) { let disrupt = 0; const ST = (WD && WD.st) || [];
    for (const k in W.stx || {}) { const st = ST.find(x => x.id === k); disrupt += (st ? st.oilPct / 100 : .2) * W.stx[k]; }
    W.hormuz = (W.stx || {}).hormuz || 0; W.oilP = K.oilBase * (1 + K.oilDisrupt * disrupt); return W.oilP; }
  // ===== أدوات =====
  const ix = (W, WD) => W.idx || (W.idx = new Map(WD.r.map((a, i) => [a[0], i])));
  const rel = (W, a, b) => (W.rel[a] && W.rel[a][b]) || 0;
  function addRel(W, a, b, v) { if (a === b) return; for (const [x, y] of [[a, b], [b, a]]) { const m = W.rel[x] ||= {}; m[y] = clamp(Math.round((m[y] || 0) + v), -100, 100); } }
  const atWar = (W, a, b) => W.wars.find(w => (w.a.includes(a) && w.b.includes(b)) || (w.b.includes(a) && w.a.includes(b)));
  const allied = (W, a, b) => W.pacts.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a)) || (W.natoL.includes(a) && W.natoL.includes(b));
  function note(W, o) { W.log.push({ t: W.t, ...o }); if (W.log.length > 400) W.log.splice(0, W.log.length - 400); }
  const date = t => new Date(START + t * 864e5);
  const sancOn = (WD, W, id) => { let lv = (WD.cs[id].sanc || null); for (const s of W.sanc) if (s[1] === id) lv = lv === 'heavy' || s[2] === 'heavy' ? 'heavy' : 'medium'; return lv; };

  // ===== يوم =====
  function step(W, WD, days = 1) {
    ix(W, WD);
    for (let d = 0; d < days && !W.over; d++) {
      W.t++;
      if (date(W.t).getUTCDate() === 1) month(W, WD);
    }
    return W;
  }
  // ===== شهر =====
  function month(W, WD) {
    W.rnd = mulberry(W.rs = (W.rs + 7919 * W.t) | 0);
    navy(W, WD); straits(W, WD);
    price(W, WD);
    for (const id of W.ids) econ(W, WD, id);
    for (const w of W.wars.slice()) war(W, WD, w);
    // الصواريخ: إنتاج شهري، تصليح النفط المضروب، والذكاء بالحرب يرمي 15٪ من مخزونه على الخصم
    for (const id of W.ids) { const c = W.C[id]; if (c.msl == null) continue; c.msl += c.mslP; c.drn += c.drnP; c.oilDmg = Math.max(0, (c.oilDmg || 0) * .9 - .01); }
    for (const w of W.wars) for (const [mine, oth] of [[w.a, w.b], [w.b, w.a]]) for (const id of mine.slice(0, 2)) {
      if (id === W.me || !W.C[id] || !(W.C[id].msl + W.C[id].drn)) continue;
      const tgt = oth.find(o => W.C[o]); if (!tgt) continue;
      // الديمقراطيات ما تضرب المدن؛ الباقي أحياناً
      const kind = W.C[tgt].oil > 200 && W.rnd() < .35 ? 'oil' : (WD.cs[id].free === 2 || W.rnd() < .6) ? 'mil' : 'city';
      strike(W, WD, id, tgt, kind, Math.round(W.C[id].msl * .15), Math.round(W.C[id].drn * .15));
    }
    for (const id of W.ids) if (id !== W.me) ai(W, WD, id);
    // العلاقات ترجع ببطء للأساس (الذاكرة الدبلوماسية)
    for (const a in W.rel) for (const b in W.rel[a]) { const base = (W.base[a] && W.base[a][b]) || 0, v = W.rel[a][b]; if (v !== base && !atWar(W, a, b)) W.rel[a][b] = Math.round(v + (base - v) * .03); }
    W.ap = Math.min(K.apMax, W.ap + K.apMonth);
    note(W, { k: 'month', oil: Math.round(W.oilP) });
  }
  function econ(W, WD, id) {
    const c = W.C[id], tx = TAX[c.tax], cv = CIV[c.civ], why = [];
    const add = (v, r) => { if (Math.abs(v) >= .05) why.push([r, +v.toFixed(2)]); return v; };
    let g = c.g0;
    g += add(tx.g, 'الضرايب'); g += add(cv.g, 'الإنفاق المدني');
    g += add(-.08 * Math.max(0, c.milPct - 3), 'ميزانية الجيش');
    const ws = W.wars.filter(w => w.a.includes(id) || w.b.includes(id));
    for (const w of ws) { const home = homeFront(W, WD, w, id); g += add(home ? K.warHomeG : K.warAwayG, w.n); }
    const sl = sancOn(WD, W, id); if (sl) g += add(K.sancG[sl], 'العقوبات');
    if (c.prioG) g += add(c.prioG, 'أولوية الاقتصاد');
    if (c.blk) g += add(-2.5 * c.blk, 'الحصار البحري');
    const tr = W.trade.filter(p => p[0] === id || p[1] === id).length; if (tr) g += add(Math.min(K.tradeMax, tr * K.tradeG), 'اتفاقيات التجارة');
    const dp = c.debt / c.gdp * 100; if (dp > 110) g += add(-.01 * (dp - 110), 'الدين');
    g += add(clamp((c.stab - c.stab0) * .02, -1.5, .4), 'الاستقرار');
    g = clamp(g, -15, 12); c.g = g;
    c.core *= 1 + g / 1200;
    c.oil = oilOf(W, WD, id);
    const og = oilGDP(c.oil, W.oilP); c.gdp = c.core + og;
    // الميزانية (مليار $ بالشهر)
    const rev = (c.core * clamp(c.revCore + tx.r, .04, .6) + og * K.oilTake) / 12;
    const mil = c.gdp * c.milPct / 100 / 12, civ = c.core * c.civ0 * cv.k / 12;
    // الفائدة ما تتجاوز ربع الإيرادات: فوكها = جدولة/تعثّر (أزمة دين تضرب الاستقرار)
    let intr = c.debt * rate(c, dp) / 12; c.crisis = intr > rev * .25; if (c.crisis) intr = rev * .25;
    c.bal = rev - mil - civ - intr;
    // W.nat (دولة اللاعب، nation.js): الفائض/العجز يروح للخزينة (منها يدفع البحث والإنتاج والقرارات)، والخزينة السالبة فائدتها أعلى
    // اللاعب: العجز/الفائض «الأساسي» (نسبته من الناتج أول شهر) يبقى على الدين مثل كل الدول، والفرق اللي تسببه قراراتك (ضرايب، إنفاق، حرب، نفط) + 0.25٪ من الناتج للمشتريات يروح للخزينة [تقدير]
    if (id === W.me && W.nat) { const e = W.nat.eco[0]; if (c.balF == null) c.balF = c.bal / c.gdp; const b0 = c.balF * c.gdp;
      c.debt = Math.max(0, c.debt - b0); e.cash += (c.bal - b0) + c.gdp * .0025; if (e.cash < 0) e.cash -= -e.cash * rate(c, dp) * 1.5 / 12; }
    else c.debt = Math.max(0, c.debt - c.bal);
    c.budget = { rev, mil, civ, intr };
    // الجيش: الميزانية تبني، والصيانة تآكل (التوازن = القوة الحالية إذا الميزانية ما تتغير)
    const eff = c.pw0 * K.upkeep * 12 / Math.max(.01, (WD.cs[id].gdp || c.gdp) * (c.milPct0 ??= c.milPct) / 100);
    c.pw = Math.max(1, c.pw + mil * 12 * eff / 12 - c.pw * K.upkeep);
    // الاستقرار
    let tgt = c.stab0 + tx.s + cv.s + clamp((g - c.g0) * 1.5, -10, 4);
    for (const w of ws) { const home = homeFront(W, WD, w, id); tgt += home ? K.warHomeStab : -2; tgt -= Math.max(0, (w.weary[id] || 0) - 50) / 5; }
    if (sl === 'heavy') tgt -= 5; if (c.crisis) tgt -= 8; if (c.blk > .3) tgt -= 4;
    c.stab = clamp(c.stab + (tgt - c.stab) * K.stabMove, 0, 100);
    if (id === W.me && W.nat && W.nat.home) c.stab = W.nat.home.stab;   // الاستقرار للاعب = استقرار الداخل (الفئات، home.js)
    c.why = why;
    if (id === W.me) {
      if (c.stab < K.collapse.stab) { c.low++; note(W, { k: 'warn', w: 'collapse', left: K.collapse.months - c.low }); if (c.low >= K.collapse.months && W.cfg.diff !== 'ez') { W.over = { t: W.t, why: 'collapse' }; note(W, { k: 'over', why: 'collapse' }); } }
      else c.low = 0;
      if (c.crisis && !c._cw) { note(W, { k: 'warn', w: 'debt' }); } c._cw = c.crisis;
    }
  }
  // ===== الحرب (مجرّدة بـ W3؛ المحرك الكامل بـ W5) =====
  function frontRegions(W, WD, w) {   // مناطق الطرف ب اللي تلامس الطرف أ، والعكس
    const A = new Set(w.a), B = new Set(w.b), fa = [], fb = [];
    for (let i = 0; i < WD.r.length; i++) { const s = W.ctl[i]; if (!A.has(s) && !B.has(s)) continue;
      for (const n of WD.r[i][7]) { const j = W.idx.get(n), o = W.ctl[j]; if ((A.has(s) && B.has(o))) { fa.push(i); break; } if (B.has(s) && A.has(o)) { fb.push(i); break; } } }
    return [fa, fb];
  }
  function homeFront(W, WD, w, id) { return !!(w._front && (w._front[0].some(i => W.ctl[i] === id) || w._front[1].some(i => W.ctl[i] === id))) || (w.id === 'iran_war' && id === 'IRN'); }
  function sidePower(W, WD, side, front) {
    let p = 0; for (const id of side) { const c = W.C[id]; if (!c) continue; const touches = front.some(i => W.ctl[i] === id); p += c.pw * (touches ? (c.landK ?? 1) : .25); } return Math.max(1, p);
  }
  function war(W, WD, w) {
    ix(W, WD); w.months++; const [fa, fb] = w._front = frontRegions(W, WD, w);
    // W5: حرب اللاعب البرية تنحسم بمسرح الحرب (theater.js) بالساعات؛ هنا بس التعب وعروض السلام
    if (w.detail) { for (const id of [...w.a, ...w.b]) { const mine = w.a.includes(id) ? w.score : -w.score; w.weary[id] = clamp((w.weary[id] || 0) + 1.5 + (mine < 0 ? 1.5 : 0), 0, 100); } return peaceTalk(W, WD, w); }
    // الدعم: الدول اللي تحب طرف (علاقة > 60) وتعادي الثاني (< −30) تعطيه 3٪ من قوتها (سلاح وذخيرة وتمويل) [تقدير]
    const aid = (side, oth) => { let p = 0; for (const x of W.ids) { if (side.includes(x) || oth.includes(x)) continue; const ok = side.some(s => rel(W, x, s) > 60) && oth.some(o => rel(W, x, o) < -30); if (ok) p += W.C[x].pw * .03; } return p; };
    const pa = sidePower(W, WD, w.a, fa) + aid(w.a, w.b), pb = sidePower(W, WD, w.b, fb) + aid(w.b, w.a), r = pa / pb;
    w.r = r;
    // خسائر: 0.6–1.5٪ من القوة بالشهر لكل طرف، أكثر على الأضعف
    for (const id of w.a) W.C[id].pw *= 1 - .006 * clamp(1 / r, .5, 2.5);
    for (const id of w.b) W.C[id].pw *= 1 - .006 * clamp(r, .5, 2.5);
    // التحصين: الجبهة القديمة محصنة (×2.5)، والجديدة تتحصن خلال 6 أشهر (من ×1.2 لـ ×2)
    const fort = w.fort0 || Math.min(2, 1.2 + w.months * .13);
    // تقدم: منطقة وحدة بالشهر عادةً (المنطقة = آلاف الكيلومترات)، الأسهل أرضاً أول؛ الاحتمال يكبر ويا التفوق
    const take = (from, to, re) => {
      const cand = from.map(i => [i, TERR_DEF[WD.T[WD.r[i][4]]] * (WD.r[i][13] ? 1.6 : 1) * (1 + W.rnd() * .6)]).sort((a, b) => a[1] - b[1]);
      const n = re > 4 ? 2 : 1;
      for (const [i, d] of cand.slice(0, n)) { if (W.rnd() > clamp(.12 * (re / d - 1), 0, .6)) continue;
        const was = W.ctl[i]; const by = to.find(x => WD.r[i][7].some(nb => W.ctl[W.idx.get(nb)] === x)) || to[0]; W.ctl[i] = by; w.taken[WD.r[i][0]] = by; note(W, { k: 'take', war: w.id, r: WD.r[i][0], by, from: was });
        w.score += (to === w.a ? 1 : -1) * (3 + (WD.r[i][12] ? 15 : 0) + Math.min(10, (WD.r[i][10] || 0) / 50)); }
    };
    if (fb.length && r / fort > 1.3) take(fb, w.a, r / fort);
    else if (fa.length && 1 / r / fort > 1.3) take(fa, w.b, 1 / r / fort);
    w.score = clamp(w.score + (r > 1 ? 1 : -1) * Math.min(3, Math.abs(Math.log(r)) * 2), -100, 100);
    for (const id of [...w.a, ...w.b]) { const mine = w.a.includes(id) ? w.score : -w.score; w.weary[id] = clamp((w.weary[id] || 0) + 1.5 + (mine < 0 ? 1.5 : 0), 0, 100); }
    return peaceTalk(W, WD, w);
  }
  // السلام: الطرف الخسران والتعبان يطلب، والثاني يقبل إذا هو هم تعبان أو ربحان كفاية (اللاعب يقرر بنفسه)
  function peaceTalk(W, WD, w) {
    for (const [mine, other] of [[w.a, w.b], [w.b, w.a]]) {
      const lead = mine[0]; if (lead === W.me) continue;
      const s = mine === w.a ? w.score : -w.score, wr = w.weary[lead];
      if ((wr > 75 && s < 10) || s < -60 || (wr > 60 && Math.abs(s) < 15 && w.months > 6)) {
        const ol = other[0]; if (ol === W.me) { if (!w.offer) { w.offer = lead; note(W, { k: 'peaceOffer', war: w.id, from: lead }); } continue; }
        const os = -s, owr = w.weary[ol];
        if (owr > 55 || os > 40) return endWar(W, WD, w, 'peace');
      }
    }
  }
  function endWar(W, WD, w, how) {
    W.wars = W.wars.filter(x => x !== w);
    if (w.id === 'iran_war' && W.stx) W.stx.hormuz = Math.min(W.stx.hormuz || 0, .3);
    for (const a of w.a) for (const b of w.b) addRel(W, a, b, 20);
    note(W, { k: 'peace', war: w.id, n: w.n, how, kept: Object.keys(w.taken).length });
  }
  // ===== الذكاء (بالسلام) =====
  function ai(W, WD, id) {
    const c = W.C[id];
    // تهديد: أقوى جار عدو / قوتي
    let threat = 0;
    for (const o in W.rel[id] || {}) { const v = W.rel[id][o]; if (v < -40 && W.C[o]) threat = Math.max(threat, W.C[o].pw / c.pw * (-v / 100)); }
    if (W.wars.some(w => w.a.includes(id) || w.b.includes(id))) threat = Math.max(threat, 1.5);
    const dpp = c.debt / c.gdp * 100;
    const want = clamp(c.milPct0 * (threat > 1 ? 1.25 : threat < .3 ? .95 : 1) * (dpp > 100 && threat < 1.5 ? .85 : 1), .3, 25);
    c.milPct += (want - c.milPct) * .1;
    const dp = c.debt / c.gdp * 100;
    c.civ = dp > 130 && c.bal < 0 ? 'cut' : c.stab < 35 && dp < 90 ? 'more' : 'mid';
    c.tax = dp > 110 && c.bal < 0 ? 'high' : 'mid';
    // حرب جديدة؟ نادر كلش: عداء شديد + قوة ×2.5 + جار + ما محمي بتحالف أو نووي
    if (W.rnd() < .0015 * (WD.cs[id].free === 2 ? .25 : 1)) {
      for (const o in W.rel[id] || {}) {
        const t = W.C[o]; if (!t || W.rel[id][o] > -70 || atWar(W, id, o) || t.nuke || allied(W, id, o)) continue;
        if (W.rel[id][o] > -85 && !TENSION.some(p => p.includes(id) && p.includes(o))) continue;   // يحتاج عداء شديد كلش أو نزاع حدودي معروف
        if (!neighbors(W, WD, id, o)) continue;
        const prot = W.ids.filter(x => allied(W, o, x)).reduce((s, x) => s + W.C[x].pw, 0);
        if (c.pw > 2.5 * (t.pw + prot * .5) && c.stab > 40) { declare(W, WD, id, o, true); break; }
      }
    }
  }
  const TENSION = [['IND', 'PAK'], ['PAK', 'AFG'], ['THA', 'KHM'], ['ARM', 'AZE'], ['ETH', 'ERI'], ['RWA', 'COD'], ['VEN', 'GUY'], ['CHN', 'TWN'], ['KOR', 'PRK'], ['MAR', 'DZA'], ['EGY', 'ETH']];   // نزاعات حدودية/وجودية معروفة
  function neighbors(W, WD, a, b) {
    ix(W, WD);
    for (let i = 0; i < WD.r.length; i++) if (W.ctl[i] === a) for (const n of WD.r[i][7]) if (W.ctl[W.idx.get(n)] === b) return true;
    return false;
  }
  // ===== أفعال (اللاعب، ونفسها للذكاء) =====
  // ===== البحرية والحصار والمضائق (W5d) [تقدير] =====
  // كل حرب: بحرية كل طرف (السفن والغواصات بجيلها) بالبحار اللي يوصلها (بحار سواحله وجيرانها؛ البحريات الكبيرة فوك 1500 توصل لكل مكان).
  // الطرف الأقوى ×2 بالبحار المشتركة يحاصر سواحل الخصم (إذا مهمته «حصار»): نسبة الحصار = حصة سواحل الخصم بهالبحار.
  // الحصار: −2.5٪ نمو، −60٪ تصدير نفط (×النسبة)، والاستقرار ينزل. الخسائر 1.5٪ بالشهر × نسبة القوة.
  function seasOf(W, WD, id) { const S = new Set(); for (let i = 0; i < WD.r.length; i++) if (W.ctl[i] === id) for (const z of WD.r[i][8] || []) S.add(z); return S; }
  function reach(W, WD, id) { const S = seasOf(W, WD, id), R = new Set(S); const nb = new Map((WD.s || []).map(z => [z[0], z[3]])); for (const z of S) for (const n of nb.get(z) || []) R.add(n); return R; }
  function navy(W, WD) {
    for (const id of W.ids) if (W.C[id].nav != null) W.C[id].blk = 0;
    for (const w of W.wars) {
      const side = L => L.filter(x => W.C[x] && W.C[x].nav > 0);
      const A = side(w.a), B = side(w.b); if (!A.length || !B.length) continue;
      const sea = L => { const all = new Set(); for (const x of L) { if (W.C[x].nav > 1500) return null; for (const z of reach(W, WD, x)) all.add(z); } return all; };
      const RA = sea(A), RB = sea(B);
      for (const [M, O, RM] of [[A, B, RA], [B, A, RB]]) {
        const nm = M.reduce((t, x) => t + W.C[x].nav, 0), no = O.reduce((t, x) => t + W.C[x].nav, 0) + 1;
        // الاشتباك: خسائر للطرفين (الأضعف يخسر أكثر)
        for (const x of O) W.C[x].nav *= 1 - Math.min(.05, .015 * nm / no * .5);
        // الحصار: المهاجم لازم مهمته «حصار» وأقوى ×2
        if (nm < 2 * no) continue;
        for (const x of O) { if (M.every(m => (W.C[m].navMode || 'block') !== 'block')) continue;
          const S = seasOf(W, WD, x); if (!S.size) continue; let k = 0; for (const z of S) if (!RM || RM.has(z)) k++;
          const def = (W.C[x].navMode === 'def' ? .6 : 1) / (1 + (W.C[x].drn || 0) / 4000); W.C[x].blk = Math.max(W.C[x].blk, Math.min(1, k / S.size) * def);
          if (W.C[x].blk > .2 && !w._blkNoted) { w._blkNoted = 1; note(W, { k: 'blockade', on: x, by: M[0], f: Math.round(W.C[x].blk * 100) }); } }
      }
    }
  }
  function straits(W, WD) {
    W.stx = W.stx || {};
    for (const st of WD.st || []) {
      let tgt = 0;
      for (const w of W.wars) for (const [M, O] of [[w.a, w.b], [w.b, w.a]]) {
        // دولة على الساحل بحرب وعندها صواريخ أو بحرية تقطع المضيق؛ إذا بحرية خصمها أقوى ×3 (مرافقة) القطع أقل
        const shore = st.shore.map(r => W.ctl[ix(W, WD).get(r)]).filter(x => M.includes(x));
        if (!shore.length) continue; const x = W.C[shore[0]]; if (!x || (x.msl + x.drn < 10 && x.nav < 20)) continue;
        const esc = O.reduce((t, o) => t + (W.C[o] ? W.C[o].nav : 0), 0) > 3 * x.nav;
        tgt = Math.max(tgt, esc ? (x.msl + x.drn > 500 ? .6 : .35) : .65);   // الصواريخ والمسيّرات تخلي القطع مستمر حتى ويا المرافقة
      }
      const cur = W.stx[st.id] || 0, nx = tgt > cur ? Math.min(tgt, cur + .3) : Math.max(tgt, cur - .2);
      if (nx > .05 && cur <= .05) note(W, { k: 'strait', id: st.id, n: st.n, f: Math.round(nx * 100) });
      if (nx > 0) W.stx[st.id] = +nx.toFixed(2); else delete W.stx[st.id];
    }
  }
  // ===== الضربات بعيدة المدى (W5c) =====
  // الاعتراض: الدفاع الجوي يعترض أكثر لما الرشقة صغيرة (يتشبّع بالكثرة)؛ المسيّرات تنعترض أسهل من الباليستي.
  // الأثر لكل إصابة [تقدير]: «جيش» −0.04٪ قوة، «مدن» −0.05 استقرار و−0.005٪ اقتصاد (والعالم يزعل شوية)، «نفط» −0.2٪ من الإنتاج (يتصلح 10٪ بالشهر).
  function strike(W, WD, by, t, kind, nm, nd) {
    const a = W.C[by], c = W.C[t]; if (!a || !c) return null;
    nm = Math.max(0, Math.min(nm, Math.floor(a.msl))); nd = Math.max(0, Math.min(nd, Math.floor(a.drn))); if (!nm && !nd) return null;
    a.msl -= nm; a.drn -= nd;
    const sat = x => c.adI / (c.adI + x * .3 + 1);   // التشبّع
    const im = Math.round(nm * Math.min(.9, sat(nm) * 1.1)), id = Math.round(nd * Math.min(.97, sat(nd) * 1.5)), hits = (nm - im) + (nd - id) * .25;
    if (kind === 'mil') c.pw *= 1 - Math.min(.15, hits * .0004);
    else if (kind === 'city') { c.stab = clamp(c.stab - hits * .05, 0, 100); c.core *= 1 - Math.min(.05, hits * .00005); for (const x of W.ids) if (x !== by && x !== t && rel(W, x, t) > 20) addRel(W, by, x, -Math.min(5, hits / 50)); }
    else if (kind === 'oil') c.oilDmg = Math.min(.7, (c.oilDmg || 0) + hits * .002);
    const r = { by, t, kind, nm, nd, im, id, hits: Math.round(hits) }; note(W, { k: 'strike', ...r }); return r;
  }
  function playerStrike(W, WD, t, kind, share = .25) {
    if (W.ap < 1) return { ok: false, why: 'نقاط القرار ما تكفي' }; if (!atWar(W, W.me, t)) return { ok: false, why: 'مو بحرب وياها' };
    const a = W.C[W.me]; if (!(a.msl + a.drn >= 1)) return { ok: false, why: 'ما عدنا صواريخ ولا مسيّرات' };
    W.ap -= 1; const r = strike(W, WD, W.me, t, kind, Math.ceil(a.msl * share), Math.ceil(a.drn * share)); return { ok: true, r };
  }
  const COST = { improve: 1, trade: 1, ally: 2, sanction: 1, war: 3, peace: 1 };
  function can(W, WD, act, t) {
    const me = W.me, r = rel(W, me, t);
    if (!W.C[t] || t === me) return 'مو دولة';
    if (W.ap < COST[act]) return 'نقاط القرار ما تكفي';
    if (act === 'trade') { if (W.trade.some(p => (p[0] === me && p[1] === t) || (p[1] === me && p[0] === t))) return 'عدنا اتفاقية'; if (r < 20) return 'العلاقة لازم 20 وفوك'; if (atWar(W, me, t)) return 'بحرب'; }
    if (act === 'ally') { if (allied(W, me, t)) return 'حلفاء أصلاً'; if (r < 60) return 'العلاقة لازم 60 وفوك'; }
    if (act === 'sanction' && W.sanc.some(s => s[0] === me && s[1] === t)) return 'معاقبينها أصلاً';
    if (act === 'war') { if (atWar(W, me, t)) return 'بحرب أصلاً'; if (allied(W, me, t)) return 'حليفتنا'; }
    if (act === 'improve' && r >= 90) return 'العلاقة بأعلى شي';
    return null;
  }
  function act(W, WD, a, t) {
    const no = can(W, WD, a, t); if (no) return { ok: false, why: no };
    const me = W.me; W.ap -= COST[a];
    if (a === 'improve') { addRel(W, me, t, 10); note(W, { k: 'dip', a, t }); return { ok: true, msg: `العلاقة ويا ${t} تحسنت` }; }
    if (a === 'trade') { const v = aiAccept(W, WD, t, 'trade'); if (!v.ok) { note(W, { k: 'dip', a: 'refuse', t, what: 'trade' }); return { ok: false, why: v.why, spent: true }; } W.trade.push([me, t]); addRel(W, me, t, 5); note(W, { k: 'dip', a, t }); return { ok: true }; }
    if (a === 'ally') { const v = aiAccept(W, WD, t, 'ally'); if (!v.ok) { note(W, { k: 'dip', a: 'refuse', t, what: 'ally' }); return { ok: false, why: v.why, spent: true }; } W.pacts.push([me, t]); addRel(W, me, t, 10); note(W, { k: 'dip', a, t }); return { ok: true }; }
    if (a === 'sanction') { W.sanc.push([me, t, W.C[me].gdp > 3000 ? 'heavy' : 'light']); addRel(W, me, t, -25); note(W, { k: 'dip', a, t }); return { ok: true }; }
    if (a === 'war') { declare(W, WD, me, t, false); return { ok: true }; }
    return { ok: false, why: '؟' };
  }
  function aiAccept(W, WD, t, what) {
    const r = rel(W, t, W.me), c = W.C[t], m = W.C[W.me];
    if (what === 'trade') return r >= 20 ? { ok: true } : { ok: false, why: 'رفضوا: العلاقة ضعيفة' };
    if (what === 'ally') {
      // يقبلون إذا العلاقة عالية، وإحنا مو ضعاف كلش، وما نجرّهم لحرب ويا حليف إلهم
      const myEnemies = W.wars.filter(w => w.a.includes(W.me) || w.b.includes(W.me)).flatMap(w => w.a.includes(W.me) ? w.b : w.a);
      if (myEnemies.some(e => rel(W, t, e) > 30)) return { ok: false, why: 'رفضوا: عدونا صديقهم' };
      const u = r / 100 + Math.min(1, m.pw / c.pw) * .4 - (myEnemies.length ? .3 : 0);
      return u > .75 ? { ok: true } : { ok: false, why: 'رفضوا: ما يشوفون مصلحة كافية' };
    }
    return { ok: false };
  }
  function declare(W, WD, a, b, byAI) {
    const A = [a], B = [b];
    // التحالفات الدفاعية: حلفاء المعتدى عليه يدخلون؛ حلفاء المعتدي ما ملزومين
    for (const x of W.ids) if (x !== a && x !== b && allied(W, b, x) && !allied(W, a, x)) B.push(x);
    const w = { id: 'w' + W.t + a + b, n: `حرب ${WD.cs[a].ar} و${WD.cs[b].ar}`, a: A, b: B, since: W.t, months: 0, weary: Object.fromEntries([...A, ...B].map(x => [x, 0])), score: 0, taken: {}, byAI };
    W.wars.push(w);
    addRel(W, a, b, -100);
    for (const x of W.ids) if (x !== a && x !== b) addRel(W, a, x, B.includes(x) ? -60 : rel(W, x, b) > 30 ? -25 : -8);   // العالم ما يحب المعتدي
    W.C[a].stab = clamp(W.C[a].stab + (rel(W, a, b) <= -60 ? 4 : -6), 0, 100);
    note(W, { k: 'war', id: w.id, a, b, join: B.slice(1), byAI });
    return w;
  }
  function offerPeace(W, WD, wid) {
    const w = W.wars.find(x => x.id === wid); if (!w) return { ok: false, why: 'ما اكو حرب' };
    if (W.ap < COST.peace) return { ok: false, why: 'نقاط القرار ما تكفي' };
    W.ap -= COST.peace;
    if (w.offer) { endWar(W, WD, w, 'peace'); return { ok: true }; }
    const mineA = w.a.includes(W.me), other = mineA ? w.b[0] : w.a[0], os = mineA ? -w.score : w.score, owr = w.weary[other] || 0;
    if (owr > 50 || os < -20) { endWar(W, WD, w, 'peace'); return { ok: true }; }
    note(W, { k: 'dip', a: 'refuse', t: other, what: 'peace' });
    return { ok: false, why: `${WD.cs[other].ar} رفضت: مو تعبانة (${Math.round(owr)}) وتشوف نفسها رابحة`, spent: true };
  }
  // ===== ترتيب وحفظ =====
  function rank(W, k) { return W.ids.slice().sort((a, b) => W.C[b][k] - W.C[a][k]); }
  function save(W) {
    const { rnd, idx, base, ...o } = W;
    o.wars = W.wars.map(({ _front, ...w }) => w);
    return JSON.stringify(o);
  }
  function load(s, WD) {
    const o = typeof s === 'string' ? JSON.parse(s) : s;
    if (!o || !o.v) return null;
    // ترقيات: 1 ← 2 (W5c): نضيف المخزون والدفاع الجوي لكل دولة من بياناتها
    if (o.v < 2) { for (const id of o.ids) { const f = initCountry(WD, id), c = o.C[id]; for (const k of ['msl', 'drn', 'mslP', 'drnP', 'adI', 'oilDmg']) if (c[k] == null) c[k] = f[k]; } o.v = 2; }
    if (o.v < 3) { for (const id of o.ids) { const f = initCountry(WD, id), c = o.C[id]; for (const k of ['nav', 'navMode', 'blk']) if (c[k] == null) c[k] = f[k]; } o.stx = { hormuz: o.hormuz ?? 0 }; o.v = 3; }
    // 3 ← 4 (D-050): طبقة الدولة (G.nat) تنبني بـ nation.js أول ما اللعبة تفتح إذا ما موجودة
    if (o.v < 4) o.v = 4;
    o.base = WD.rel; o.rnd = mulberry(o.rs); return o;
  }
  const API = { V, K, START, init, addRel, navy, straits, step, month, act, can, offerPeace, declare, endWar, strike, playerStrike, rank, save, load, date, rel, atWar, allied, COST, TAX, CIV };
  if (typeof module !== 'undefined') module.exports = API; else root.WSIM = API;
})(this);
