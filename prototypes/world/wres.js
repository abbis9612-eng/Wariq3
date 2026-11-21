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
    // 👥 مجتمع
    med:   { s: 'soc', ic: '💊', img: 'rs_med', n: 'طب حديث', cost: 1, d: 'الصحة +5 والعمر المتوقع يرتفع', fx: { hea: .05 } },
    med2:  { s: 'soc', ic: '🧬', img: 'rs_med2', n: 'أدوية ولقاحات محلية', cost: 2, d: 'الصحة +5 ثاني، وجرحى الحرب يرجعون أسرع', fx: { hea: .05, heal: 1 }, req: ['med'] },
    edu:   { s: 'soc', ic: '📚', img: 'rs_edu', n: 'إصلاح التعليم', cost: 1, d: 'التعليم +5، والبحث أسرع +10٪', fx: { edu: .05, rs: .1 } },
    girls: { s: 'soc', ic: '👩‍🎓', img: 'rs_girls', n: 'تعليم البنات وتشغيل النساء', cost: 1, d: 'التعليم +4، قوة العمل أكبر (النمو +0.1٪)، والخصوبة تنزل أسرع', fx: { edu: .04, g: .1 }, req: ['edu'] },
    gov:   { s: 'soc', ic: '🏛', img: 'rs_gov', n: 'إدارة وحوكمة إلكترونية', cost: 1.5, d: 'فساد أقل: المشاريع أرخص وأسرع −10٪، والإيرادات +1٪', fx: { effK: .1, rev: .01 } },
    // 🧪 استراتيجي
    nucp:  { s: 'str', ic: '⚛', img: 'rs_nuclear', n: 'طاقة نووية سلمية', cost: 4, d: 'مفاعل كهرباء: قدرة الشبكة +15٪ من الطلب. تحت رقابة الوكالة الدولية (بدون عقوبات)', fx: { elec: .15 }, req: ['edu', 'solar'] },
    space: { s: 'str', ic: '🛰', img: 'rs_space', n: 'أقمار صناعية', cost: 3, d: 'اتصالات وملاحة وصور: النمو +0.1٪ دائم', fx: { g: .1 }, req: ['tele'] },
    nucw:  { s: 'str', ic: '☢', img: 'rs_nukew', n: 'برامج حساسة', cost: 0, d: 'مقفول: ينتظر قرارك عن النووي (مو بهاللعبة لحد ما تقرر)', lock: 1 },
  };
  const SEC = { mil: ['⚔', 'عسكري'], eco: ['💰', 'اقتصادي'], soc: ['👥', 'مجتمع'], str: ['🧪', 'استراتيجي'] };
  // المدة الأساس (يوم) حسب الكلفة لما الميزانية «متوسطة» — للعرض بس؛ الحقيقة من الميزانية
  function ensure(G) { if (!G.res3) G.res3 = { done: {}, cur: null, p: 0 }; return G.res3; }
  // سرعة البحث: الجامعات (+8٪ كل وحدة من المشاريع)، التعليم، وبحث «إصلاح التعليم»
  function speed(G, id) {
    const c = G.C[id], p = G.pop3 && G.pop3[id], R = ensure(G);
    return +((c.rdK || 1) * (.7 + .6 * (p ? p.edu : .5)) * (1 + (R.rs || 0))).toFixed(2);
  }
  const costOf = (G, k) => +(T[k].cost * ((G.nat && G.nat.ind[0].k) || 1)).toFixed(2);
  function can(G, WD, k) {
    const t = T[k], R = ensure(G); if (!t) return 'غلط'; if (t.lock) return 'مقفول'; if (R.done[k]) return 'مكتمل';
    if (t.need === 'oil' && !(G.C[G.me].oil > 0)) return 'ماكو نفط عدنا';
    const miss = (t.req || []).filter(r => !R.done[r]); if (miss.length) return 'يحتاج قبله: ' + miss.map(r => T[r].n).join('، ');
    return null;
  }
  // اختيار بحث مدني: الفرع العسكري يتوقف (فلوسه المجمعة تنتقل نصها، مثل تبديل الفرع بـ gwind)
  function pick(G, WD, k) {
    const err = can(G, WD, k); if (err) return err; const R = ensure(G), I = G.nat.ind[0];
    if (R.cur !== k) { R.p = (R.p || 0) * .5 + (I.rb !== 'civ' ? I.rp * .5 : 0); if (I.rb !== 'civ') { R.mil = I.rb; I.rp = 0; } I.rb = 'civ'; R.cur = k; }
    return { ok: true };
  }
  // يرجع للعسكري (ينادى لما اللاعب يختار فرع عسكري من الواجهة)
  function back(G, b) { const R = ensure(G), I = G.nat.ind[0]; if (I.rb === 'civ') { I.rp = (R.p || 0) * .5; R.p = 0; R.cur = null; } else if (I.rb !== b) I.rp *= .5; I.rb = b; }
  // كل يوم بعد IND.daily: الفلوس اللي تجمعت تروح للبحث المدني، والسرعة تضيف تقدم مجاني (للعسكري والمدني)
  function daily(G, WD) {
    const NW = G.nat; if (!NW) return; const R = ensure(G), I = NW.ind[0], b = I.bud ? [0, .02, .05, .1][I.bud] * (I.k || 1) : 0, sp = speed(G, G.me);
    if (I.rb === 'civ') {
      if (!R.cur) { I.rb = R.mil || 'arm'; return; }
      R.p += I.rp * sp; I.rp = 0;
      const need = costOf(G, R.cur); if (R.p >= need) { R.p -= need; finish(G, WD, R.cur); R.cur = null; I.rb = R.mil || 'arm'; I.rp = R.p; R.p = 0; }
    } else if (b && sp > 1 && I.tech[I.rb] < 5) I.rp += b * (sp - 1);   // العسكري: الجزء الزايد من السرعة مجاني
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
    G.log.push({ t: G.t, k: 'res', r: k, id: G.me });
  }
  // الأيام المتوقعة بالميزانية الحالية
  function days(G, k) { const I = G.nat.ind[0], b = [0, .02, .05, .1][I.bud] * (I.k || 1) * speed(G, G.me), R = ensure(G); return b ? Math.ceil((costOf(G, k) - (R.cur === k ? R.p : 0)) / b) : null; }
  const API = { T, SEC, ensure, speed, costOf, can, pick, back, daily, finish, days };
  if (typeof module !== 'undefined') module.exports = API; else root.WRES = API;
})(typeof window !== 'undefined' ? window : globalThis);
