// «الحرب الكبرى» GW11 C3–C5 (I-095): التصنيع الحربي الوطني، والبحث، والقطاعات. بدون رسم؛ فحص tests/ind.test.mjs.
//  C3: صنع محلي (هيئة التصنيع الحربي): منتجات محلية بدل الاستيراد (ما تعتمد على مورّد)، تنفتح بمستوى البحث، وسلاح وطني بتسميتك بأربع مراحل.
//  C4: البحث: 5 فروع × 5 مستويات بمقياس الحرب (أسابيع)، ميزانية يومية، وكل مستوى إله أثر.
//  C5: القطاعات: صناعة حربية، نفط وطاقة، نقل؛ 5 مستويات بكلفة ومدة.
// الأرقام [تقدير].
(function (root) {
  const BR = {
    arm: { n: 'الدروع', ic: '🛡', d: 'هجوم الدروع والآليات +3٪ لكل مستوى، ويفتح آلية محلية (2) ودبابة «بابل» محلية (4)' },
    uav: { n: 'المسيّرات', ic: '📡', d: 'المسيّرات تشوف أبعد +10٪ لكل مستوى، ويفتح مسيّرة استطلاع محلية «صقر» (2)' },
    msl: { n: 'الصواريخ والدفاع الجوي', ic: '🚀', d: 'صواريخ الدفاع الجوي أدق +3٪ لكل مستوى، ويفتح صاروخ دفاع جوي محلي (3)' },
    ew: { n: 'الإلكترونيات والتشويش', ic: '📶', d: 'ضربات العدو الجوية علينا أضعف −5٪ لكل مستوى' },
    ind: { n: 'الصناعة', ic: '⚙', d: 'الإنتاج أسرع +8٪ والمحلي أرخص −5٪ لكل مستوى' },
  };
  const BRK = Object.keys(BR);
  // مستويات البداية [تقدير]: العراق صناعته قليلة، وإيران عندها صناعة حربية كبيرة
  const START = [{ arm: 1, uav: 1, msl: 0, ew: 0, ind: 1 }, { arm: 3, uav: 4, msl: 4, ew: 2, ind: 3 }];
  const BUD = [[0, 'متوقف'], [.02, 'قليلة'], [.05, 'متوسطة'], [.1, 'عالية']];   // مليار $ باليوم
  const need = l => +(.4 * Math.pow(l + 1, 1.4)).toFixed(2);   // كلفة المستوى الجاي (مليار): 1→1.1، 2→1.9، 3→2.8، 4→3.8
  // المنتجات المحلية (تنضاف لـ ECON.ITEMS): req = [فرع، مستوى]
  const LOCAL = {
    lmec: { n: 'آلية محلية (تجميع)', ic: '🚙', cat: 'div', kind: 'mec', side: 0, cost: 1.2, days: 35, req: ['arm', 2], d: 'مدرعات خفيفة تتجمّع بالتاجي' },
    larm: { n: 'مدرعة «بابل» محلية', ic: '🛡', cat: 'div', kind: 'arm', side: 0, cost: 2.2, days: 50, req: ['arm', 4], d: 'تحديث T-72 محلي' },
    luav: { n: 'مسيّرة «صقر» ×2', ic: '📡', cat: 'plane', plane: 'ch4', q: 2, side: 0, cost: .008, days: 9, req: ['uav', 2], d: 'استطلاع محلي بدل CH-4 الصينية' },
    lsam: { n: 'صاروخ دفاع جوي محلي ×16', ic: '🚀', cat: 'sam', pool: '57E6', q: 16, side: 0, cost: .005, days: 18, req: ['msl', 3], d: 'نسخة محلية لصاروخ بانتسير' },
  };
  // السلاح الوطني: 4 مراحل (من لعبة المالك الأصلية)
  const NAT = [
    { n: 'ترخيص وتجميع', cost: 1, days: 30, req: 1, d: 'نجمّع سلاح أجنبي بترخيص' },
    { n: 'نسخة مطوّرة', cost: 2, days: 45, req: 3, d: 'نحسّن عليه محلياً: الدروع +5٪' },
    { n: 'تصميم وطني', cost: 3, days: 60, req: 4, d: 'سلاح عراقي باسمك ولونك: الدروع +10٪ ومشاة الآليات أرخص' },
    { n: 'تصدير', cost: 1.5, days: 30, req: 5, d: 'نبيعه برّا: دخل +20 مليون باليوم' },
  ];
  // القطاعات
  const SEC = {
    war: { n: 'صناعة حربية', ic: '🏭', d: 'كل مستوى: الإنتاج أسرع +6٪، وكل مستويين خط إنتاج جديد' },
    oil: { n: 'نفط وطاقة', ic: '🛢', d: 'كل مستوى: إنتاج النفط +3٪ وتصليح الحقول أسرع +20٪' },
    tr: { n: 'نقل وطرق', ic: '🛣', d: 'كل مستوى: الإمداد يوصل أبعد +1، والجسور تتصلح أسرع +20٪' },
  };
  const secCost = l => +(.8 * (l + 1)).toFixed(1), SEC_DAYS = 20;
  // C9: مشاريع كبرى حربية (واحد بالمرة)
  const MEGA = {
    pipe: { n: '🛢 أنابيب وموانئ بديلة', cost: 6, days: 45, d: 'توسيع أنبوب جيهان وخط البصرة–العقبة: إذا هرمز انغلق أو الفاو انضربت يطلع 40٪ من نفط الجنوب بدل 5٪' },
    fort: { n: '🛡 تحصين المدن والملاجئ', cost: 4, days: 30, d: 'ضربات إيران على مدننا وقواتنا بالمدن أضعف 25٪، والمعنويات أثبت' },
    radar: { n: '📡 رادار إنذار مبكر', cost: 3, days: 30, d: 'دفاعنا الجوي أدق +6٪ ويشوف الضربات أبكر' },
  };
  function megaGo(W, s, k) { const I = W.ind[s]; I.mega = I.mega || {}; const M = MEGA[k]; if (!M) return 'غلط'; if (I.mega[k]) return 'مكتمل'; if (I.megaRun) return 'اكو مشروع كبير شغال';
    const e = W.eco[s]; if (e.cash - M.cost < -5) return 'الفلوس ما تكفي'; e.cash -= M.cost; I.megaRun = { k, left: M.days }; W.log.push({ t: W.t, side: s, k: 'megago', m: k }); return { ok: true }; }

  function init(W) {
    W.ind = [0, 1].map(s => ({ tech: { ...START[s] }, rb: s ? 'msl' : 'arm', rp: 0, bud: s ? 2 : 1, nat: { st: 0, run: null, name: s ? 'كرار' : '', col: '#5a7d3a' }, sec: { war: 0, oil: 0, tr: 0 }, secRun: null }));
    return W;
  }
  const ensure = W => { if (!W.ind) init(W); return W; };
  const has = (W, s, k) => { const it = LOCAL[k]; return !it || !W.ind || W.ind[s].tech[it.req[0]] >= it.req[1]; };
  // آثار يقراها sim/air/econ (أرقام بسيطة على W)
  function effects(W) {
    W.indF = [0, 1].map(s => { const I = W.ind[s], t = I.tech, g = k => Math.max(0, t[k] - START[s][k]);
      const mg = I.mega || {};
      return { armAtk: 1 + .03 * g('arm') + (I.nat.st >= 2 ? .05 : 0) + (I.nat.st >= 3 ? .05 : 0), eye: 1 + .1 * g('uav'), samPk: (1 + .03 * g('msl')) * (mg.radar ? 1.06 : 1), ewDef: 1 - .05 * g('ew'),
        prod: (1 + .08 * g('ind')) * (1 + .06 * I.sec.war), pipe: !!(I.mega && I.mega.pipe), fort: I.mega && I.mega.fort ? .75 : 1, locCost: 1 - .05 * g('ind'), oil: 1 + .03 * I.sec.oil, fix: 1 + .2 * I.sec.oil, sup: I.sec.tr, br: 1 + .2 * I.sec.tr, exp: I.nat.st >= 4 ? .02 : 0 }; });
  }
  // البحث: تبدّل الفرع (النقاط تبقى للفرع الجديد بنص قيمتها) والميزانية
  function setBranch(W, s, b) { const I = W.ind[s]; if (I.rb === b || !BR[b]) return; I.rp *= .5; I.rb = b; }
  function setBudget(W, s, i) { W.ind[s].bud = Math.max(0, Math.min(BUD.length - 1, i)); }
  // C3: السلاح الوطني والقطاعات (مشاريع بكلفة ومدة)
  function natGo(W, s) { const I = W.ind[s], st = NAT[I.nat.st]; if (!st) return 'وصلنا آخر مرحلة'; if (I.nat.run) return 'المرحلة الجاية شغالة';
    const top = Math.max(...BRK.map(k => I.tech[k])); if (top < st.req) return `تحتاج فرع بحث مستوى ${st.req}`; const e = W.eco[s]; if (e.cash - st.cost < -5) return 'الفلوس ما تكفي';
    e.cash -= st.cost; I.nat.run = { left: st.days }; W.log.push({ t: W.t, side: s, k: 'natgo', st: I.nat.st }); return { ok: true }; }
  function secGo(W, s, k) { const I = W.ind[s]; if (!SEC[k]) return 'غلط'; if (I.secRun) return 'اكو قطاع يتطوّر هسه'; if (I.sec[k] >= 5) return 'آخر مستوى'; const c = secCost(I.sec[k]), e = W.eco[s]; if (e.cash - c < -5) return 'الفلوس ما تكفي';
    e.cash -= c; I.secRun = { k, left: SEC_DAYS }; return { ok: true, c }; }
  // كل يوم
  function daily(W, A, X) {
    ensure(W); const { SIM, ECON } = X;
    for (const s of [0, 1]) {
      const I = W.ind[s], e = W.eco && W.eco[s], b = BUD[I.bud][0];
      if (e && b && e.cash > -10) { e.cash -= b; I.rp += b; }
      if (I.tech[I.rb] < 5 && I.rp >= need(I.tech[I.rb])) { I.rp -= need(I.tech[I.rb]); I.tech[I.rb]++; W.log.push({ t: W.t, side: s, k: 'tech', b: I.rb, l: I.tech[I.rb] });
        if (I.tech[I.rb] >= 5) { const nx = BRK.filter(k => I.tech[k] < 5).sort((a, c) => I.tech[a] - I.tech[c])[0]; if (nx) I.rb = nx; } }
      if (I.nat.run && --I.nat.run.left <= 0) { I.nat.run = null; I.nat.st++; W.log.push({ t: W.t, side: s, k: 'nat', st: I.nat.st }); }
      if (I.secRun && --I.secRun.left <= 0) { const k = I.secRun.k; I.sec[k]++; I.secRun = null; if (k === 'war' && I.sec.war % 2 === 0 && e) e.lines++; W.log.push({ t: W.t, side: s, k: 'sec', sec: k, l: I.sec[k] }); }
      if (e && I.nat.st >= 4) e.cash += .02;
      if (I.megaRun && --I.megaRun.left <= 0) { I.mega = I.mega || {}; I.mega[I.megaRun.k] = 1; W.log.push({ t: W.t, side: s, k: 'mega', m: I.megaRun.k }); I.megaRun = null; }
    }
    // ذكاء إيران: ميزانية متوسطة، يبدّل للفرع الأضعف، ويطوّر صناعة حربية إذا عنده فلوس
    const J = W.ind[1]; if (J.tech[J.rb] >= 5) setBranch(W, 1, BRK.sort((a, c) => J.tech[a] - J.tech[c])[0]);
    if (W.eco && W.eco[1].cash > 12 && !J.secRun) secGo(W, 1, J.sec.war <= J.sec.tr ? 'war' : 'tr');
    // العراق إذا الوزير يدير: يحط ميزانية قليلة ويطوّر النفط إذا عنده فلوس
    if (W.eco && W.eco[0].auto) { const I = W.ind[0]; if (I.bud === 0 && W.eco[0].cash > 5) I.bud = 1; if (W.eco[0].cash > 18 && !I.secRun) secGo(W, 0, I.sec.oil <= I.sec.war ? 'oil' : 'war'); }
    effects(W);
  }
  // المنتجات المحلية تنضاف لكتالوج الاقتصاد
  function register(ECON) { for (const k in LOCAL) ECON.ITEMS[k] = LOCAL[k]; }
  const API = { MEGA, megaGo, register, BR, BRK, START, BUD, need, LOCAL, NAT, SEC, secCost, SEC_DAYS, init, ensure, has, effects, setBranch, setBudget, natGo, secGo, daily };
  if (typeof module !== 'undefined') module.exports = API; else root.IND = API;
})(this);
