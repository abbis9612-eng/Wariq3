// «العالم» v3 E (I-119): القطاعات، مشاريع البناء ببطاقة ربح، الكهرباء، وتدفق الفلوس
// الأرقام: كلفة حقول النفط ~20 ألف $ لكل برميل/يوم بالحقول الموجودة بالشرق الأوسط، والتطوير 2–5 سنين (Global Energy Monitor، IEA) [تقدير بحدود المصادر]؛
// الباقي [تقدير]. التصميم: docs/features/world-v3-plan.md (E1، E2، E5) · فحص: node tests/weco.test.mjs
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // نقص الكهرباء المعروف (نسبة الطلب اللي ما تنغطى) [تقدير من الأخبار: العراق ~27 جيجا مقابل ~40 بالصيف]
  const ELEC_DEF = { IRQ: .3, LBN: .5, SYR: .55, YEM: .6, IRN: .1, PAK: .15, EGY: .05, NGA: .45, LBY: .25, SDN: .45, AFG: .4, ZAF: .1, VEN: .25, CUB: .3, BGD: .1, KEN: .1, ETH: .3, IRQ_: 0 };
  // المشاريع: الكلفة (مليار $)، المدة (أشهر)، والأثر لما يكمل
  const P = {
    oil:   { n: 'توسعة حقل نفط', ic: '🛢', img: 'pj_oil', cost: 5, mo: 36, d: '+250 ألف برميل باليوم', need: 'oil', kbd: 250 },
    refin: { n: 'مصفى', ic: '🏭', img: 'pj_refinery', cost: 4, mo: 30, d: 'بنزين محلي بدل الاستيراد: الناتج +2.5 مليار/سنة', core: 2.5 },
    power: { n: 'محطة كهرباء (2 جيجا)', ic: '⚡', img: 'pj_power', cost: 2.2, mo: 24, d: 'تسد نقص الكهرباء: الاستقرار والصناعة', gw: 2 },
    road:  { n: 'طرق وسكك (ممر تجاري)', ic: '🛣', img: 'pj_rail', cost: 6, mo: 48, d: 'التجارة والنمو: +0.15٪ نمو دائم', g: .15 },
    port:  { n: 'ميناء تجاري', ic: '⚓', img: 'pj_port', cost: 3, mo: 36, d: 'صادرات وتجارة: الناتج +1.8 مليار/سنة', need: 'sea', core: 1.8 },
    fact:  { n: 'مصانع (حديد، إسمنت، أسمدة)', ic: '🏗', img: 'pj_factory', cost: 1.5, mo: 24, d: 'وظائف وصادرات: الناتج +1 مليار/سنة', core: 1, jobs: 1 },
    farm:  { n: 'ري وسدود وزراعة', ic: '🌾', img: 'pj_dam', cost: 2.5, mo: 42, d: 'أمن غذائي: الناتج +1 مليار/سنة واستقرار', core: 1, stab: 1 },
    house: { n: 'مجمعات سكنية', ic: '🏠', img: 'pj_housing', cost: 2, mo: 24, d: 'الشارع يرضى: استقرار +3', stab: 3 },
    hosp:  { n: 'شبكة مستشفيات', ic: '🏥', img: 'pj_hospital', cost: 1.2, mo: 18, d: 'صحة: استقرار +1، والجرحى بالحرب يتعالجون', stab: 1, health: 1 },
    univ:  { n: 'جامعات ومراكز بحث', ic: '🎓', img: 'pj_university', cost: 1.2, mo: 36, d: 'البحث أسرع +8٪، وعمال أمهر', rd: .08 },
    arms:  { n: 'مصنع حربي', ic: '🪖', img: 'pj_arms', cost: 2, mo: 30, d: 'خط إنتاج حربي جديد', lines: 1 },
  };
  // الكفاءة والفساد: الدول الأفقر تكلّف وتتأخر أكثر (×1 للغنية لحد ×1.45) [تقدير]
  // بحث «الحوكمة» (wres) ينقص الكلفة
  const eff = c => (1 + clamp((30000 - c.gdp * 1e9 / c.pop) / 60000, 0, .45)) * (1 - (c.effK || 0));
  // سعر صغير للدول الصغيرة: المشروع بحجم الاقتصاد (ما نخلي جزيرة تبني ميناء بـ3 مليار ولا أمريكا محطة بـ2 مليار تفرق)
  const scale = c => clamp(c.gdp / 250, .25, 8);
  function ensure(G, WD) {
    if (!G.eco3) { G.eco3 = { proj: [], oilAdd: {}, elec: {}, flow: null, pid: 1 };
      for (const id of G.ids) { const c = G.C[id], d = ELEC_DEF[id] || 0, dem = Math.max(.5, c.gdp * .15); const e = G.eco3.elec[id] = { dem: +dem.toFixed(1), cap: +(dem * (1 - d)).toFixed(1), d0: 0 }; e.d0 = clamp(1 - e.cap / e.dem, 0, .9); } }
    return G.eco3;
  }
  const elecDef = (G, id) => { const e = G.eco3 && G.eco3.elec[id]; return e ? clamp(1 - e.cap / e.dem, 0, .9) : 0; };
  // القطاعات (تقدير من البيانات: النفط حقيقي، والباقي حسب دخل الفرد) — للعرض والتفسير
  function sectors(G, WD, id) {
    const c = G.C[id], oil = Math.max(0, c.gdp - c.core), pc = c.gdp * 1e9 / c.pop, core = c.core;
    const ag = clamp(.28 - pc / 120000, .01, .28), ind = clamp(.22 + (pc < 20000 ? .06 : 0), .15, .32), mil = Math.min(.04, c.milPct / 100);
    const L = [['🛢 النفط والغاز', oil], ['🌾 الزراعة', core * ag], ['🏭 الصناعة والبناء', core * ind], ['🪖 الصناعة الحربية', c.gdp * mil * .3], ['🛍 الخدمات والتجارة', core * (1 - ag - ind) - c.gdp * mil * .3]];
    return L.map(([n, v]) => [n, Math.max(0, v)]).sort((a, b) => b[1] - a[1]);
  }
  // بطاقة المشروع: الكلفة والمدة الحقيقية لهالدولة، والدخل المتوقع، وكم يرجع فلوسه
  function card(G, WD, id, k) {
    const c = G.C[id], p = P[k], e = eff(c), sc = p.kbd || p.gw ? 1 : scale(c), cost = +(p.cost * e * sc).toFixed(2), mo = Math.round(p.mo * (1 + (e - 1) * .7));
    let gdp = 0, rev = 0;
    if (p.kbd) { gdp = p.kbd * 1000 * 365 * G.oilP / 1e9; rev = gdp * .6; }
    if (p.core) { gdp = p.core * sc; rev = gdp * (c.revCore || .2); }
    if (p.g) { gdp = c.core * p.g / 100 * 5; rev = gdp * (c.revCore || .2); }   // 5 سنين تراكم
    if (p.gw) { const d = elecDef(G, id); gdp = c.core * Math.min(d, p.gw / ensure(G, WD).elec[id].dem) * .015 * 4; rev = gdp * (c.revCore || .2); }
    // back = كم سنة حتى الاقتصاد يرجع الكلفة (الناتج)، tback = حتى الخزينة ترجعها (الضرايب + حصة النفط)
    return { cost, mo, gdp: +gdp.toFixed(2), rev: +rev.toFixed(2), back: gdp > 0 ? +(cost / gdp).toFixed(1) : null, tback: rev > 0 ? +(cost / rev).toFixed(1) : null };
  }
  function can(G, WD, id, k) {
    const p = P[k], E = ensure(G, WD); if (!p) return 'غلط';
    if (p.need === 'oil' && !(G.C[id].oil > 0)) return 'ماكو نفط عدنا';
    if (p.need === 'sea' && !WD.r.some((r, i) => G.ctl[i] === id && (r[8] || []).length)) return 'ماكو ساحل';
    if (E.proj.filter(q => q.id === id && !q.done).length >= 6) return 'عدنا 6 مشاريع تنبني (الحد)';
    return null;
  }
  // مكان المشروع: منطقة حقيقية (النفط بأكثر منطقة نفط، الميناء بساحل، والباقي بأكبر مدينة) — يبين على الخريطة
  function place(G, WD, id, k) {
    let best = -1, bv = -1; WD.r.forEach((r, i) => { if (G.ctl[i] !== id) return; const pop = (r[9] || []).reduce((t, x) => t + x[1], 0), v = k === 'oil' ? (r[10] || 0) : k === 'port' ? ((r[8] || []).length ? pop + 1 : -1) : pop + (r[12] ? 1e7 : 0);
      const busy = G.eco3.proj.filter(q => q.r === i).length; if (v / (1 + busy) > bv) { bv = v / (1 + busy); best = i; } });
    return best;
  }
  function start(G, WD, id, k) {
    const err = can(G, WD, id, k); if (err) return err; const E = G.eco3, cd = card(G, WD, id, k), r = place(G, WD, id, k);
    const q = { pid: E.pid++, id, k, r, t0: G.t, mo: cd.mo, cost: cd.cost, paid: 0, done: 0 }; E.proj.push(q);
    G.log.push({ t: G.t, k: 'proj', a: 'start', id, pk: k, r, cost: cd.cost, mo: cd.mo }); return { ok: true, q };
  }
  // كل شهر: الدفعة الشهرية من الخزينة، والمشاريع اللي كملت تشتغل
  function month(G, WD) {
    const E = ensure(G, WD); let spend = {};
    for (const q of E.proj) { if (q.done) continue; const inst = q.cost / q.mo; q.paid += inst; spend[q.id] = (spend[q.id] || 0) + inst;
      if (q.id === G.me && G.nat) G.nat.eco[0].cash -= inst; else if (G.C[q.id]) G.C[q.id].debt += inst;
      if (G.ctl[q.r] !== q.id) { q.lost = 1; continue; }   // المنطقة انحتلت: المشروع يوقف
      if (G.t - q.t0 >= q.mo * 30.4 - 1) { q.done = G.t; apply(G, WD, q); G.log.push({ t: G.t, k: 'proj', a: 'done', id: q.id, pk: q.k, r: q.r }); } }
    E.proj = E.proj.filter(q => !q.lost && !(q.done && q.id !== G.me));   // مشاريع الدول الثانية اللي كملت تنشال (أثرها بقى بالاقتصاد)
    // الكهرباء: الطلب يكبر 4٪ بالسنة
    // الشبكة العادية تكبر ويا الطلب (4٪)، إلا الدول اللي عندها نقص (3٪): النقص يزيد شوية شوية إذا ما تبني محطات
    for (const id in E.elec) { const e = E.elec[id]; e.dem = +(e.dem * (1 + .04 / 12)).toFixed(2); e.cap = +(e.cap * (1 + (e.d0 > 0 ? .03 : .04) / 12)).toFixed(2); }
    E.spend = spend; return spend;
  }
  function apply(G, WD, q) {
    // q.share: حصة الشركة الأجنبية (E4) من الأثر
    const c = G.C[q.id], p = P[q.k], E = G.eco3, sc = (p.kbd || p.gw ? 1 : scale(c)) * (1 - (q.share || 0));
    if (p.kbd) E.oilAdd[q.r] = (E.oilAdd[q.r] || 0) + p.kbd * (1 - (q.share || 0));
    if (p.core) c.core += p.core * sc;
    if (p.g) c.g0 += p.g * (1 - (q.share || 0));
    if (p.gw) E.elec[q.id].cap += p.gw * (1 - (q.share || 0));
    if (p.stab && q.id === G.me && G.nat) { const b = G.nat.home.base || (G.nat.home.base = {}); b.street = Math.min(80, (b.street || 55) + p.stab); }
    else if (p.stab) c.stab = Math.min(100, c.stab + p.stab);
    if (p.lines && q.id === G.me && G.nat) G.nat.eco[0].lines += p.lines;
    if (p.rd) { c.rdK = (c.rdK || 1) + p.rd; c.univ = (c.univ || 0) + 1; }
    if (p.health) c.hosp = (c.hosp || 0) + 1;
  }
  // الذكاء: الدول الثانية تبني بنفسها (مرة بالسنة تقريباً، حسب الفائض والنقص)
  function ai(G, WD) {
    // ينادى كل شهر؛ عشوائية خاصة حتى ما تغيّر أحداث باقي اللعبة
    let a0 = ((G.rs || 1) * 7 + (G.t || 0) * 104729) | 0; const rnd = () => { a0 = a0 + 0x6D2B79F5 | 0; let t = Math.imul(a0 ^ a0 >>> 15, 1 | a0); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    for (const id of G.ids) { if (id === G.me || rnd() > .08) continue; const c = G.C[id], d = elecDef(G, id);
      const k = d > .15 ? 'power' : c.oil > 300 && rnd() < .4 ? 'oil' : ['fact', 'road', 'house', 'farm', 'univ', 'hosp'][Math.floor(rnd() * 6)]; if (!can(G, WD, id, k)) start(G, WD, id, k); }
  }
  // أثر الكهرباء على النمو (يقراه wsim.econ)
  // نسبة لنقص البداية: بأول يوم ماكو أثر (التوازن ما يتغير)، تسد النقص = نمو +، يزيد النقص = نمو −
  const elecG = (G, id) => { const e = G.eco3 && G.eco3.elec[id]; return e ? -2 * (elecDef(G, id) - e.d0) : 0; };
  const API = { P, ELEC_DEF, ensure, sectors, card, can, start, month, apply, ai, eff, elecDef, elecG, place };
  if (typeof module !== 'undefined') module.exports = API; else root.WECO = API;
})(this);
