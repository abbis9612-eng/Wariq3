// «العالم» v3 R (I-121): شجرة البحث الموحّدة — العسكري (فروع «الحرب الكبرى» الخمسة) + الاقتصادي + المجتمع + الاستراتيجي
// كل بحث بطاقة: شنو يفتح، الكلفة، المدة، وشنو يحتاج قبله. السرعة من الجامعات والتعليم والميزانية.
// الميزانية نفسها (gwind.js) تمول البحث المختار؛ لما المختار مو فرع عسكري، gwind يجمع الفلوس بـ I.rp وهذا الملف ياخذها.
// التصميم: docs/features/world-v3-plan.md (R) · فحص: node tests/wres.test.mjs
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // cost = مليار $ (يتضرب بحجم الاقتصاد مثل باقي البحث)، fx = الأثر لما يخلص [تقدير]
  const T = {
    // 💰 اقتصادي
    oilx:  { s: 'eco', ic: '🛢', img: 'rs_oil', n: 'استخراج نفط محسّن', cost: 1.5, d: 'حقن الغاز والماء بالحقول القديمة: إنتاج النفط +6٪', fx: { oilK: .06 }, need: 'oil' },
    oilx2: { s: 'eco', ic: '🛢', img: 'rs_oil2', n: 'حفر أفقي وحقول عميقة', cost: 3, d: 'إنتاج النفط +6٪ ثاني', fx: { oilK: .06 }, req: ['oilx'], need: 'oil' },
    refx:  { s: 'eco', ic: '🏭', img: 'rs_refinery', n: 'تكرير متقدم وبتروكيماويات', cost: 2, d: 'نبيع منتجات بدل نفط خام: الناتج غير النفطي +1٪', fx: { core: .01 }, req: ['oilx'] },
    solar: { s: 'eco', ic: '☀', img: 'rs_solar', n: 'طاقة شمسية', cost: 1.5, d: 'كهرباء رخيصة: قدرة الشبكة +10٪ من الطلب', fx: { elec: .1 } },
    agri:  { s: 'eco', ic: '🌾', img: 'rs_agri', n: 'زراعة ذكية وري بالتنقيط', cost: 1, d: 'أمن غذائي: الناتج +0.5٪ والاستقرار +1', fx: { core: .005, stab: 1 } },
    manuf: { s: 'eco', ic: '⚙', img: 'rs_manuf', n: 'تصنيع متقدم', cost: 2.5, d: 'مصانع أحدث: النمو +0.1٪ دائم، والإنتاج الحربي أسرع +5٪', fx: { g: .1, prod: .05 }, req: ['agri'] },
    tele:  { s: 'eco', ic: '📶', img: 'rs_telecom', n: 'اتصالات وإنترنت سريع', cost: 1.5, d: 'خدمات رقمية: النمو +0.1٪ دائم', fx: { g: .1 } },
    desal: { s: 'eco', ic: '💧', img: 'rs_desal', n: 'تحلية المياه', cost: 2, d: 'ماي للمدن والزراعة: الاستقرار +1 والناتج +0.5٪', fx: { stab: 1, core: .005 }, need: 'sea' },
    lithium:{ s: 'eco', ic: '⛏', img: 'rs_lithium', n: 'الليثيوم والتعدين', cost: 2.5, d: 'معادن البطاريات والصناعة: الناتج +1٪', fx: { core: .01 }, req: ['manuf'] },
    tourism:{ s: 'eco', ic: '🕌', img: 'rs_tourism', n: 'السياحة والمواقع التاريخية', cost: 1, d: 'زوار ودخل: الناتج +0.8٪ والإيرادات +0.5٪', fx: { core: .008, rev: .005 } },
    finance:{ s: 'eco', ic: '🏦', img: 'rs_finance', n: 'الخدمات المالية', cost: 1.5, d: 'بورصة وبنوك قوية: ربح الصندوق السيادي +25٪ والنمو +0.05٪', fx: { fundK: .25, g: .05 }, req: ['tele'] },
    civai: { s: 'eco', ic: '🤖', img: 'rs_civai', n: 'الذكاء الاصطناعي المدني', cost: 3, d: 'إنتاجية أعلى: النمو +0.1٪ والبحث أسرع +5٪', fx: { g: .1, rs: .05 }, req: ['tele'] },
    // 👥 مجتمع
    med:   { s: 'soc', ic: '💊', img: 'rs_med', n: 'طب حديث', cost: 1, d: 'الصحة +5 والعمر المتوقع يرتفع', fx: { hea: .05 } },
    med2:  { s: 'soc', ic: '🧬', img: 'rs_med2', n: 'أدوية ولقاحات محلية', cost: 2, d: 'الصحة +5 ثاني، وجرحى الحرب يرجعون أسرع', fx: { hea: .05, heal: 1 }, req: ['med'] },
    edu:   { s: 'soc', ic: '📚', img: 'rs_edu', n: 'إصلاح التعليم', cost: 1, d: 'التعليم +5، والبحث أسرع +10٪', fx: { edu: .05, rs: .1 } },
    girls: { s: 'soc', ic: '👩‍🎓', img: 'rs_girls', n: 'تعليم البنات وتشغيل النساء', cost: 1, d: 'التعليم +4، قوة العمل أكبر (النمو +0.1٪)، والخصوبة تنزل أسرع', fx: { edu: .04, g: .1 }, req: ['edu'] },
    food:  { s: 'soc', ic: '🌾', img: 'rs_food', n: 'الأمن الغذائي', cost: 1, d: 'مخازن حبوب وصوامع: الاستقرار +2', fx: { stab: 2 }, req: ['agri'] },
    anticorr:{ s: 'soc', ic: '⚖', img: 'rs_anticorr', n: 'مكافحة الفساد', cost: 2, d: 'المشاريع أرخص وأسرع −10٪ ثاني، والإيرادات +1٪', fx: { effK: .1, rev: .01 }, req: ['gov'] },
    softpower:{ s: 'soc', ic: '🎭', img: 'rs_softpower', n: 'الإعلام والقوة الناعمة', cost: 1.5, d: 'صورتنا بالعالم أحسن: العلاقة ويا كل الدول اللي تحبنا +5', fx: { soft: 5 } },
    gov:   { s: 'soc', ic: '🏛', img: 'rs_gov', n: 'إدارة وحوكمة إلكترونية', cost: 1.5, d: 'فساد أقل: المشاريع أرخص وأسرع −10٪، والإيرادات +1٪', fx: { effK: .1, rev: .01 } },
    // 🧪 استراتيجي
    nucp:  { s: 'str', ic: '⚛', img: 'rs_nuclear', n: 'طاقة نووية سلمية', cost: 4, d: 'مفاعل كهرباء: قدرة الشبكة +15٪ من الطلب. تحت رقابة الوكالة الدولية (بدون عقوبات)', fx: { elec: .15 }, req: ['edu', 'solar'] },
    space: { s: 'str', ic: '🛰', img: 'rs_space', n: 'أقمار صناعية', cost: 3, d: 'اتصالات وملاحة وصور: النمو +0.1٪ دائم', fx: { g: .1 }, req: ['tele'] },
    // ⚔ عسكري — الجيل السادس والمستقبل (يحتاج مستوى بالفروع: reqT = [فرع، مستوى])
    cyber: { s: 'mil', ic: '💻', img: 'rs_cyber', n: 'الحرب السيبرانية', cost: 2, d: 'هجوم ودفاع إلكتروني: قوة الجيش +2٪', fx: { pwK: .02 }, reqT: ['ew', 4] },
    milsat:{ s: 'mil', ic: '🛰', img: 'rs_milsat', n: 'أقمار عسكرية', cost: 4, d: 'نشوف كل أساطيل العدو بالبحر (ماكو «❓ تماس»)، وقوة الجيش +2٪', fx: { sat: 1, pwK: .02 }, reqT: ['ew', 3], req: ['tele'] },
    logi:  { s: 'mil', ic: '🚚', img: 'rs_logistics', n: 'لوجستيك حديث', cost: 1.5, d: 'الإنتاج الحربي أسرع +5٪', fx: { prod: .05 }, reqT: ['ind', 3] },
    sof:   { s: 'mil', ic: '🥷', img: 'rs_sof', n: 'قوات خاصة', cost: 1.5, d: 'قوة الجيش +2٪', fx: { pwK: .02 }, reqT: ['arm', 3] },
    bmd:   { s: 'mil', ic: '🛡', img: 'rs_bmd', n: 'دفاع صاروخي متعدد الطبقات', cost: 4, d: 'اعتراض الصواريخ والمسيّرات أقوى +20٪', fx: { adI: .2 }, reqT: ['msl', 5] },
    aip:   { s: 'mil', ic: '🌊', img: 'rs_aip', n: 'غواصات حديثة (AIP)', cost: 3, d: 'قوة الجيش +3٪ (بحرية أخفى)', fx: { pwK: .03 }, reqT: ['ind', 4] },
    stealth:{ s: 'mil', ic: '🥷', img: 'rs_stealth', n: 'التخفي', cost: 5, d: 'طياراتنا أصعب تنشاف: قوة الجيش +4٪', fx: { pwK: .04 }, reqT: ['ew', 5] },
    hyper: { s: 'mil', ic: '☄', img: 'rs_hypersonic', n: 'صواريخ فرط صوتية', cost: 6, d: 'صواريخنا ينعترض منها 30٪ أقل', fx: { hyp: .3 }, reqT: ['msl', 6] },
    laser: { s: 'mil', ic: '🔦', img: 'rs_laser', n: 'ليزر دفاعي', cost: 6, d: 'اعتراض المسيّرات والصواريخ القصيرة أرخص وأقوى +15٪', fx: { adI: .15 }, reqT: ['ew', 6], req: ['bmd'] },
    swarm: { s: 'mil', ic: '🐝', img: 'rs_swarm', n: 'أسراب المسيّرات', cost: 5, d: 'إنتاج المسيّرات +40٪', fx: { drn: .4 }, reqT: ['uav', 6] },
    aimil: { s: 'mil', ic: '🧠', img: 'rs_ai', n: 'ذكاء اصطناعي بالقيادة', cost: 5, d: 'البحث أسرع +10٪ وقوة الجيش +3٪', fx: { rs: .1, pwK: .03 }, reqT: ['ew', 6] },
    g6:    { s: 'mil', ic: '✈', img: 'rs_6gen', n: 'مقاتلة الجيل السادس', cost: 9, d: 'قوة الجيش +6٪', fx: { pwK: .06 }, reqT: ['ind', 6], req: ['stealth'] },
    launch:{ s: 'str', ic: '🚀', img: 'rs_launch', n: 'صاروخ الفضاء الوطني', cost: 5, d: 'نطلق أقمارنا بنفسنا: البحث أسرع +5٪ والنمو +0.05٪، ويفتح مشروع «قمر الرقيب» أرخص', fx: { rs: .05, g: .05 }, req: ['space'] },
    enrich:{ s: 'str', ic: '⚛', img: 'rs_enrich', n: 'تخصيب اليورانيوم', cost: 0, d: 'مقفول: حساس جداً (عقوبات وتهديد بالحرب) — ينتظر قرارك عن النووي', lock: 1 },
    nucw:  { s: 'str', ic: '☢', img: 'rs_nukew', n: 'برامج حساسة', cost: 0, d: 'مقفول: ينتظر قرارك عن النووي (مو بهاللعبة لحد ما تقرر)', lock: 1 },
  };
  const SEC = { mil: ['⚔', 'عسكري'], eco: ['💰', 'اقتصادي'], soc: ['👥', 'مجتمع'], str: ['🧪', 'استراتيجي'] };
  // المدة الأساس (يوم) حسب الكلفة لما الميزانية «متوسطة» — للعرض بس؛ الحقيقة من الميزانية
  // R2 (I-130): خانات بحث متوازية — كل خانة برنامج شغال وتدفع ميزانيتها. البحث العسكري للمستوى 6.
  const MAXL = 6;
  function ensure(G) {
    if (!G.res3) G.res3 = { done: {}, slots: [] };
    const R = G.res3;
    // ترقية الحفظ القديم (بحث واحد): البحث المدني والفرع العسكري يصيرون خانتين
    if (!R.slots) { R.slots = []; const I = G.nat && G.nat.ind[0];
      if (R.cur) R.slots.push({ k: R.cur, p: R.p || 0 });
      if (I && I.rb && I.rb !== 'civ') R.slots.push({ k: 'm:' + I.rb, p: I.rp || 0 }); else if (I && R.mil) R.slots.push({ k: 'm:' + R.mil, p: 0 });
      delete R.cur; delete R.p; delete R.mil; if (I) { I.rb = 'civ'; I.rp = 0; } }
    if (G.nat && G.nat.ind[0].rb !== 'civ') { const I = G.nat.ind[0]; if (I.rb && !R.slots.some(q => q.k === 'm:' + I.rb)) R.slots.unshift({ k: 'm:' + I.rb, p: I.rp || 0 }); I.rb = 'civ'; I.rp = 0; }
    return R;
  }
  // عدد الخانات = العلماء: حجم الاقتصاد والتعليم والجامعات (2 للدول الصغيرة، لحد 6)
  function slotsMax(G) { const c = G.C[G.me], p = G.pop3 && G.pop3[G.me], R = G.res3 || {};
    return Math.min(6, 2 + (c.gdp > 500 ? 1 : 0) + (c.gdp > 3000 ? 1 : 0) + (p && p.edu > .75 ? 1 : 0) + ((c.univ || 0) >= 2 ? 1 : 0) + (R.done && R.done.aimil ? 1 : 0)); }
  // سرعة البحث: الجامعات (+8٪ كل وحدة من المشاريع)، التعليم، وبحث «إصلاح التعليم»
  function speed(G, id) {
    const c = G.C[id], p = G.pop3 && G.pop3[id], R = ensure(G);
    return +((c.rdK || 1) * (.7 + .6 * (p ? p.edu : .5)) * (1 + (R.rs || 0))).toFixed(2);
  }
  // الكلفة تكبر ويا حجم الاقتصاد (مثل الميزانية) حتى الدول الكبيرة ما تخلص بيومين
  const costOf = (G, k) => k.startsWith('m:') ? +((root.IND || require('./gwind.js')).need(G.nat.ind[0].tech[k.slice(2)] || 0) * ((G.nat && G.nat.ind[0].k) || 1)).toFixed(2) : +(T[k].cost * ((G.nat && G.nat.ind[0].k) || 1)).toFixed(2);
  const nameOf = (G, k) => { if (k.startsWith('m:')) { const IND = root.IND || require('./gwind.js'), b = k.slice(2), l = G.nat.ind[0].tech[b] || 0; return `${IND.BR[b].ic} ${IND.BR[b].n} — المستوى ${l + 1}`; } return `${T[k].ic} ${T[k].n}`; };
  function can(G, WD, k) {
    const t = T[k], R = ensure(G); if (!t) return 'غلط'; if (t.lock) return 'مقفول'; if (R.done[k]) return 'مكتمل';
    if (t.need === 'oil' && !(G.C[G.me].oil > 0)) return 'ماكو نفط عدنا';
    if (t.need === 'sea' && WD && !WD.r.some((r, i) => G.ctl[i] === G.me && (r[8] || []).length)) return 'ماكو ساحل';
    if (t.reqT && G.nat && (G.nat.ind[0].tech[t.reqT[0]] || 0) < t.reqT[1]) { const IND = root.IND || require('./gwind.js'); return `يحتاج «${IND.BR[t.reqT[0]].n}» مستوى ${t.reqT[1]}`; }
    const miss = (t.req || []).filter(r => !R.done[r]); if (miss.length) return 'يحتاج قبله: ' + miss.map(r => T[r].n).join('، ');
    return null;
  }
  // تشغيل بحث بخانة فاضية (k = مفتاح بحث، أو 'm:فرع' للعسكري)
  function pick(G, WD, k) {
    const R = ensure(G); if (R.slots.some(q => q.k === k)) return 'شغّال أصلاً';
    if (k.startsWith('m:')) { const l = G.nat.ind[0].tech[k.slice(2)] || 0; if (l >= MAXL) return 'أعلى مستوى'; }
    else { const err = can(G, WD, k); if (err) return err; }
    if (R.slots.length >= slotsMax(G)) return `كل الخانات (${slotsMax(G)}) مشغولة: وقّف وحدة أول`;
    R.slots.push({ k, p: 0 }); return { ok: true };
  }
  // توقيف خانة (التقدم يضيع نصه)
  function drop(G, i) { const R = ensure(G); if (!R.slots[i]) return 'غلط'; R.slots.splice(i, 1); return { ok: true }; }
  // التوافق ويا الواجهة القديمة: «ابحث هنا» بفرع عسكري
  function back(G, b) { return pick(G, null, 'm:' + b); }
  // شغّل كل الخانات الفاضية: الفرع العسكري الأوطى أول، وبعدين أرخص بحث مفتوح
  function fill(G, WD) { const R = ensure(G), IND = root.IND || require('./gwind.js'), I = G.nat.ind[0];
    for (const b of IND.BRK.slice().sort((a, c) => (I.tech[a] || 0) - (I.tech[c] || 0))) { if (R.slots.length >= slotsMax(G)) break; if ((I.tech[b] || 0) < MAXL) pick(G, WD, 'm:' + b); }
    for (const k of Object.keys(T).filter(k => !can(G, WD, k)).sort((a, c) => T[a].cost - T[c].cost)) { if (R.slots.length >= slotsMax(G)) break; pick(G, WD, k); }
    return { ok: true }; }
  // كل يوم بعد IND.daily: gwind جمع ميزانية خانة وحدة بـ I.rp؛ الخانات الثانية تدفع من الخزينة؛ كل خانة تتقدم بالسرعة
  function daily(G, WD) {
    const NW = G.nat; if (!NW) return; const R = ensure(G), I = NW.ind[0], e = NW.eco[0], b = I.bud ? [0, .02, .05, .1][I.bud] * (I.k || 1) : 0, sp = speed(G, G.me);
    const pool = I.rp; I.rp = 0; if (!b || !R.slots.length) { R.cost = 0; return; }
    const extra = (R.slots.length - 1) * b; let ok = 1; if (extra > 0) { if (e.cash > -10 * (I.k || 1)) e.cash -= extra; else ok = 0; }
    R.cost = +(b * R.slots.length).toFixed(3);
    for (const q of R.slots.slice()) { q.p += (ok || q === R.slots[0] ? b : 0) * sp; const need = costOf(G, q.k);
      if (q.p < need) continue; R.slots.splice(R.slots.indexOf(q), 1);
      if (q.k.startsWith('m:')) { const br = q.k.slice(2); I.tech[br] = Math.min(MAXL, (I.tech[br] || 0) + 1); NW.log.push({ t: NW.t, side: 0, k: 'tech', b: br, l: I.tech[br] }); G.log.push({ t: G.t, k: 'res', r: q.k, l: I.tech[br], id: G.me });
        if (R.auto !== false && I.tech[br] < MAXL) R.slots.push({ k: q.k, p: q.p - need }); }
      else finish(G, WD, q.k); }
  }
  function finish(G, WD, k) {
    const R = ensure(G), t = T[k], f = t.fx || {}, c = G.C[G.me]; R.done[k] = G.t;
    if (f.oilK) c.oilK = (c.oilK || 1) + f.oilK;
    if (f.core) c.core *= 1 + f.core;
    if (f.g) c.g0 += f.g;
    if (f.elec && G.eco3 && G.eco3.elec[G.me]) { const e = G.eco3.elec[G.me]; e.cap += e.dem * f.elec; }
    if (f.stab && G.nat.home) { const bs = G.nat.home.base || (G.nat.home.base = {}); bs.street = Math.min(80, (bs.street || 55) + f.stab); }
    if (f.hea) c.heaR = (c.heaR || 0) + f.hea;
    if (f.edu) c.eduR = (c.eduR || 0) + f.edu;
    if (f.rs) R.rs = (R.rs || 0) + f.rs;
    if (f.effK) c.effK = (c.effK || 0) + f.effK;
    if (f.rev) c.revCore += f.rev;
    if (f.prod) c.prodK = (c.prodK || 0) + f.prod;
    if (f.adK) c.adK = (c.adK || 0) + f.adK;
    if (f.heal) c.heal = 1;
    if (f.pwK) c.pwK = (c.pwK || 1) + f.pwK;
    if (f.adI) c.adI = (c.adI || 0) * (1 + f.adI);
    if (f.hyp) c.hyp = (c.hyp || 0) + f.hyp;
    if (f.drn) c.drnP = (c.drnP || 0) * (1 + f.drn);
    if (f.sat) c.sat = 1;
    if (f.fundK) c.fundK = (c.fundK || 0) + f.fundK;
    if (f.soft) { const S = root.WSIM || require('./wsim.js'); for (const x of G.ids) if (x !== G.me && S.rel(G, G.me, x) > 0) S.addRel(G, G.me, x, f.soft); }
    G.log.push({ t: G.t, k: 'res', r: k, id: G.me });
  }
  // الأيام المتوقعة بالميزانية الحالية (لخانة وحدة)
  function days(G, k) { const I = G.nat.ind[0], b = [0, .02, .05, .1][I.bud] * (I.k || 1) * speed(G, G.me), R = ensure(G), q = R.slots.find(x => x.k === k); return b ? Math.max(1, Math.ceil((costOf(G, k) - (q ? q.p : 0)) / b)) : null; }
  const API = { T, SEC, MAXL, ensure, speed, costOf, nameOf, can, pick, drop, back, fill, daily, finish, days, slotsMax };
  if (typeof module !== 'undefined') module.exports = API; else root.WRES = API;
})(typeof window !== 'undefined' ? window : globalThis);
