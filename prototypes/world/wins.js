// «العالم» v5-3 (I-146، D-060): الداخل — الجماعات المسلحة والتمرد والمقاومة. فحص: node tests/wins.test.mjs
// كل جماعة: مقاتلين (بالآلاف)، رضا 0–100، داعم أجنبي، مناطق تنشط بيها (أو تمسكها إذا كيان بالخريطة).
// الجماعة الزعلانة تضرب (استقرار، فلوس، نفط) وتكبر إذا الشارع زعلان أو الداعم يدعمها؛ القمع يولّد «غضب» يطلع جماعات جديدة (حلقة B).
// أفعال اللاعب: احتواء/دمج بالجيش (فلوس ورواتب)، تفاوض وعفو (⭐2)، عملية أمنية (⭐1 + فلوس، قتلى، أشهر)، ضربة استخبارية (⭐1).
// بعد الغلبة الأسرى ينتظرون قرارك: دمج، حل وعفو، نفي، سجن، أو إعدام — كل واحد بثمنه (الإعدام أقسى: إدانة وعقوبات وثأر وشارع منقسم).
// الأرقام [تقدير].
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const WEST = ['USA', 'GBR', 'FRA', 'DEU', 'CAN', 'ITA', 'JPN', 'AUS'];
  const KIND = { mil: 'فصائل مسلحة', jih: 'جماعة جهادية', reb: 'تمرد مسلح', res: 'مقاومة', sep: 'انفصاليين' };
  // بذور حقيقية لبعض الدول؛ الكيانات اللي بالخريطة (WD.ent) تنضاف لحالها لدولتها [تقدير الأعداد]
  const SEED = {
    IRQ: [{ n: 'فصائل مسلحة خارج الدولة', k: 'mil', sup: 'IRN', str: 25, r: ['IRQ013', 'IRQ014', 'IRQ023', 'IRQ009'], fk: 'mil' }, { n: 'خلايا داعش', k: 'jih', str: 1.5, r: ['IRQ008', 'IRQ010', 'IRQ011', 'IRQ007'], sat: 0 }],
    SYR: [{ n: 'خلايا داعش', k: 'jih', str: 3, r: [], sat: 0 }], NGA: [{ n: 'بوكو حرام وولاية غرب أفريقيا', k: 'jih', str: 8, r: [], sat: 0 }],
    MLI: [{ n: 'جماعة نصرة الإسلام والمسلمين', k: 'jih', str: 6, r: [], sat: 0 }], AFG: [{ n: 'ولاية خراسان', k: 'jih', str: 2, r: [], sat: 0 }],
    PAK: [{ n: 'طالبان باكستان', k: 'jih', str: 6, sup: 'AFG', r: [], sat: 5 }], TUR: [{ n: 'حزب العمال الكردستاني', k: 'sep', str: 5, r: [], sat: 25 }],
    LBN: [{ n: 'حزب الله', k: 'mil', sup: 'IRN', str: 40, r: [], sat: 62 }], COL: [{ n: 'منشقو فارك وجيش التحرير', k: 'reb', str: 6, r: [], sat: 20 }],
    IND: [{ n: 'المتمردين الماويين', k: 'reb', str: 3, r: [], sat: 15 }], PHL: [{ n: 'متمردين بمينداناو', k: 'jih', str: 1, r: [], sat: 15 }],
  };
  const EK = { rebel: 'reb', jihadist: 'jih', militia: 'mil', rival_gov: 'reb', de_facto_state: 'sep' };
  const ESTR = { HTH: 150, RSF: 90, LNA: 70, SOL: 20, SHB: 10, HAM: 25, M23: 8, ARA: 30, MRS: 60, PLS: 8, SWD: 10 };
  const kOf = G => Math.max(.3, Math.min(20, G.C[G.me].gdp / 250));
  const cash = (G, v) => { if (G.nat) G.nat.eco[0].cash += v; };
  const fac = (G, f, v) => { const H = G.nat && G.nat.home; if (H && H.fac[f] != null) H.fac[f] = clamp(H.fac[f] + v, 0, 100); };
  const stab = (G, v) => { const c = G.C[G.me]; c.stab = clamp(c.stab + v, 0, 100); if (G.nat && G.nat.home) G.nat.home.stab = clamp(G.nat.home.stab + v, 0, 100); };
  const streetK = G => { const H = G.nat && G.nat.home; return H ? (H.fac.street != null ? 'street' : null) : null; };
  const armyK = G => { const H = G.nat && G.nat.home; return H ? ['security', 'irgc', 'army'].find(k => H.fac[k] != null) : null; };
  function add(G, o) { const I = G.ins; const g = { id: I.nid++, n: o.n, k: o.k, sup: o.sup || null, str: +o.str.toFixed(1), str0: +o.str.toFixed(1), sat: o.sat ?? 30, reg: o.reg || [], ent: o.ent || null, fk: o.fk || null, org: o.org || null, op: null, hit: -999, t0: G.t, kia: 0 }; I.g.push(g); return g; }
  function ensure(G, WD) {
    if (G.ins) return G.ins; const I = G.ins = { g: [], cap: [], jail: [], ret: [], heat: 0, nid: 1, opT: -999 }, me = G.me, H = G.nat && G.nat.home;
    for (const s of SEED[me] || []) { const reg = s.r.map(id => G.idx.get(id)).filter(i => i != null); const sat = s.fk && H && H.fac[s.fk] != null ? H.fac[s.fk] : s.sat ?? 30;
      if (!reg.length) { const own = []; for (let i = 0; i < WD.r.length; i++) if (G.ctl[i] === me) own.push(i); for (let j = 0; j < Math.min(3, own.length); j++) reg.push(own[(j * 7 + 3) % own.length]); }
      add(G, { ...s, reg: [...new Set(reg)], sat }); }
    for (const e in WD.ent || {}) { const E = WD.ent[e]; if (E.of !== me) continue; const reg = []; for (let i = 0; i < WD.r.length; i++) if (G.ctl[i] === e) reg.push(i); if (!reg.length) continue;
      add(G, { n: E.ar, k: EK[E.kind] || 'reb', sup: E.ally || null, str: ESTR[e] || 10, sat: E.kind === 'de_facto_state' ? 40 : 22, reg, ent: e }); }
    return I;
  }
  const live = G => (G.ins ? G.ins.g : []);
  const byId = (G, id) => live(G).find(g => g.id === +id);
  // قوتنا ضد الجماعة: الجيش الفعّال (بالآلاف) × جاهزيته
  const myK = (G, WD) => { const c = G.C[G.me], cs = WD.cs[G.me] || {}; return Math.max(5, (cs.act || 50000) / 1000 * (c.pw / Math.max(1, c.pw0 || c.pw))); };
  // ===== كل شهر =====
  function month(G, WD, S) {
    if (!G.nat) return; const I = ensure(G, WD), me = G.me, r = G.rnd || Math.random, k = kOf(G), H = G.nat.home, st = H && H.fac.street != null ? H.fac.street : G.C[me].stab;
    resistance(G, WD);
    for (const g of I.g.slice()) {
      if (g.fk && H && H.fac[g.fk] != null) g.sat = clamp(g.sat + (H.fac[g.fk] - g.sat) * .3, 0, 100);   // الفصائل المرتبطة بفئة: رضاها يمشي ويا الفئة
      // المقاومة بأرض اندمجت أو رجعت: تذبل
      if (g.k === 'res' && !g.reg.some(i => G.ctl[i] === me)) { g.str *= .7; }
      if (g.ent) g.reg = g.reg.filter(i => G.ctl[i] === g.ent || G.ctl[i] === me);
      // النمو: الشارع الزعلان، الداعم، الغضب؛ الرضا العالي يهديها
      const gr = .004 + (st < 40 ? .008 : 0) + (g.sup && G.C[g.sup] && !G.C[g.sup].dead && S.rel(G, g.sup, me) < 30 ? .01 : 0) + I.heat * .0003 - (g.sat > 60 ? .02 : 0) - (g.op ? .01 : 0);
      g.str = clamp(g.str * (1 + gr), .1, Math.max(g.str0 * 1.6, 3));
      // العملية الأمنية: خسائر الجماعة حسب نسبة القوة، وخسائرنا والمدنيين
      if (g.op) { const R = myK(G, WD) / Math.max(.1, g.str), f = clamp(.08 * Math.sqrt(R), .03, .35), lost = g.str * f, ours = Math.round(lost * 1000 * (g.ent ? .5 : .25)), civ = Math.round(lost * 1000 * .12);
        g.str -= lost; g.kia += Math.round(lost * 1000); g.op.m++; g.op.k += ours; g.op.c += civ; cash(G, -.08 * k); I.heat = clamp(I.heat + 2, 0, 100);
        if (g.sup && G.C[g.sup]) S.addRel(G, g.sup, me, -3); if (civ > 300) stab(G, -1);
        if (g.ent) { const tk = g.reg.filter(i => G.ctl[i] === g.ent && WD.r[i][7].some(nb => G.ctl[G.idx.get(nb)] === me)); if (tk.length && r() < .25 + f) { const i = tk[0]; G.ctl[i] = me; G.log.push({ t: G.t, k: 'insreg', g: g.n, r: WD.r[i][3] }); } }
        G.log.push({ t: G.t, k: 'insop', g: g.n, id: g.id, lost: Math.round(lost * 1000), ours, civ });
        if (g.str <= Math.max(.15, g.str0 * .12)) { beaten(G, WD, S, g); continue; } }
      // الهجمات
      const p = clamp(g.str / (g.str + 8) * Math.max(0, (45 - g.sat) / 45) * .5, 0, .5);   // الراضي (45+) ما يضرب الدولة
      if (r() < p) { g.hit = G.t; const big = g.str > 10 && r() < .3; stab(G, big ? -2 : -.6); if (big) cash(G, -.12 * k); if (streetK(G)) fac(G, 'street', big ? -3 : -1);
        const oilR = g.reg.find(i => WD.r[i][10] > 0); if (oilR != null && r() < .3) { G.C[me].oilDmg = Math.min(.5, (G.C[me].oilDmg || 0) + .03); }
        G.log.push({ t: G.t, k: 'insatk', g: g.n, id: g.id, big: big ? 1 : 0, r: g.reg.length ? WD.r[g.reg[Math.floor(r() * g.reg.length)]][3] : '' }); }
      if (g.str < .1 && !g.op) { I.g.splice(I.g.indexOf(g), 1); G.log.push({ t: G.t, k: 'insgone', g: g.n }); }
    }
    // السجون: كلفة وهروب
    for (const j of I.jail.slice()) { cash(G, -j.num * 2e-6); if (r() < .015) { I.jail.splice(I.jail.indexOf(j), 1); const g = add(G, { n: j.n + ' (هاربين من السجن)', k: j.k, sup: j.sup, str: j.num / 1000 * .5, sat: 5, reg: ownSome(G, WD, 2) }); G.log.push({ t: G.t, k: 'insbreak', g: g.n }); } }
    // الرجعة (عفو أو نفي أو ثأر)
    for (const q of I.ret.slice()) if (G.t >= q.t) { I.ret.splice(I.ret.indexOf(q), 1); if (r() < q.p) { const g = add(G, { n: q.n, k: q.k, sup: q.sup, str: q.str, sat: q.sat ?? 10, reg: ownSome(G, WD, 2) }); G.log.push({ t: G.t, k: 'insret', g: g.n, why: q.why }); } }
    // جماعة جديدة: الشارع زعلان جداً أو غضب القمع
    if ((st < 28 || I.heat > 45) && I.g.length < 6 && r() < .025 + I.heat * .0006) { const g = add(G, { n: I.heat > 45 ? 'جماعة ثأر' : 'تمرد مسلح بالأطراف', k: 'reb', str: 1 + r() * 2, sat: 10, reg: ownSome(G, WD, 2) }); G.log.push({ t: G.t, k: 'insnew', g: g.n }); }
    I.heat = clamp(I.heat - 2, 0, 100);
  }
  function ownSome(G, WD, n) { const o = []; for (let i = 0; i < WD.r.length; i++) if (G.ctl[i] === G.me) o.push(i); const r = G.rnd || Math.random, out = []; for (let j = 0; j < n && o.length; j++) out.push(o[Math.floor(r() * o.length)]); return [...new Set(out)]; }
  // المقاومة بالأرض المحتلة أو المضمومة (لحد ما تندمج)
  function resistance(G, WD) {
    const I = G.ins, me = G.me, by = {}; const GEO = root.WGEO || (typeof require !== 'undefined' ? require('./wgeo.js') : null);
    for (let i = 0; i < WD.r.length; i++) { const o = WD.r[i][1]; if (G.ctl[i] !== me || o === me || !WD.cs[o]) continue; if (GEO && GEO.integrated(G, o, me)) continue; (by[o] ||= []).push(i); }
    for (const o in by) { let g = I.g.find(x => x.k === 'res' && x.org === o); const n = by[o].length;
      if (!g) { if (n < 1) continue; g = add(G, { n: 'مقاومة ' + ((WD.cs[o] || {}).ar || o), k: 'res', sup: G.C[o] && !G.C[o].dead ? o : null, str: Math.min(30, .6 * n + 1), sat: 5, reg: by[o], org: o }); G.log.push({ t: G.t, k: 'insnew', g: g.n, res: 1 }); }
      else g.reg = by[o]; }
  }
  function beaten(G, WD, S, g) {
    const I = G.ins; I.g.splice(I.g.indexOf(g), 1);
    if (g.ent) for (const i of g.reg) if (G.ctl[i] === g.ent) G.ctl[i] = G.me;
    const num = Math.round(Math.max(200, g.str0 * 1000 * .25)); I.cap.push({ id: g.id, n: g.n, k: g.k, sup: g.sup, num, t: G.t, kia: g.kia, ours: g.op ? g.op.k : 0 });
    G.log.push({ t: G.t, k: 'insbeat', g: g.n, num });
  }
  // ===== أفعال اللاعب =====
  const COST = { talk: 2, op: 1, hit: 1 };
  function preview(G, WD, g) {
    const k = kOf(G), R = myK(G, WD) / Math.max(.1, g.str), f = clamp(.08 * Math.sqrt(R), .03, .35), mo = Math.ceil(Math.log(.12) / Math.log(1 - f));
    return { cont: +(g.str * .03 * Math.max(.6, k * .5)).toFixed(2), talkP: Math.round(clamp(.2 + g.sat / 150 - g.str / 400 - (G.ins.heat || 0) / 300, .08, .85) * 100), opCash: +(Math.max(.1, g.str * .02) * Math.max(.5, k * .5)).toFixed(2), opMo: clamp(mo, 1, 60), hitP: Math.round(clamp(.3 + .08 * ((G.nat && G.nat.ind && G.nat.ind[0].tech.ew) || 0), .2, .7) * 100), hitCash: +(.1 * k).toFixed(2), pay: +(Math.max(.05, g.str * .006) * Math.max(.5, k * .5)).toFixed(2) };
  }
  function act(G, WD, S, id, a) {
    const g = byId(G, id); if (!g) return 'ماكو هالجماعة'; const me = G.me, k = kOf(G), P = preview(G, WD, g), r = G.rnd || Math.random, I = G.ins;
    if (a === 'cont') {   // احتواء ودمج بالجيش
      if (g.k === 'jih') return 'الجماعات الجهادية ما تقبل تندمج'; if (g.sat < 30) return 'رضاهم واطي: لازم تفاوض أو تضغط أول (يحتاج 30+)';
      if (G.nat.eco[0].cash < P.cont) return 'الخزينة ما تكفي'; cash(G, -P.cont); I.g.splice(I.g.indexOf(g), 1);
      G.C[me].pw += g.str * 1.5; const ak = armyK(G); if (ak) fac(G, ak, -6); if (g.fk) fac(G, g.fk, 10); if (g.sup && G.C[g.sup]) S.addRel(G, g.sup, me, 5);
      if (g.sup === 'IRN') for (const x of ['USA', 'GBR']) if (G.C[x]) S.addRel(G, x, me, -3);
      I.ret.push({ n: g.n + ' (انشقاق)', k: g.k, sup: g.sup, str: g.str * .3, t: G.t + 540, p: .15, why: 'cont' });
      G.log.push({ t: G.t, k: 'insdo', a: 'cont', g: g.n }); return { ok: true, t: `${g.n} اندمجوا بالجيش (+${Math.round(g.str * 1.5)} قوة)، والجيش زعل شوية` }; }
    if (a === 'pay') {   // تهدئة: فلوس ووجهاء ومناصب (بلا نقاط قرار)؛ الرضا يرتفع بس الشارع يشوفها رشوة
      if (g.k === 'jih') return 'الجهاديين ما ينشرون'; if (g.op) return 'عليهم عملية'; if (G.nat.eco[0].cash < P.pay) return 'الخزينة ما تكفي';
      cash(G, -P.pay); g.sat = clamp(g.sat + 12, 0, 100); if (g.fk) fac(G, g.fk, 6); if (streetK(G)) fac(G, 'street', -1);
      G.log.push({ t: G.t, k: 'insdo', a: 'pay', g: g.n }); return { ok: true, t: `هدّينا ${g.n}: الرضا +12` }; }
    if (a === 'talk') {
      if (G.ap < COST.talk) return 'نقاط القرار ما تكفي'; G.ap -= COST.talk;
      if (r() * 100 < P.talkP) { I.g.splice(I.g.indexOf(g), 1); if (streetK(G)) fac(G, 'street', -3); if (g.fk) fac(G, g.fk, 6); for (const x of G.ids) if (x !== me && S.rel(G, x, me) > -40) S.addRel(G, x, me, 1);
        I.ret.push({ n: g.n + ' (رجعوا للسلاح)', k: g.k, sup: g.sup, str: g.str * .4, t: G.t + 365 + Math.floor(r() * 365), p: .25, why: 'talk' });
        G.log.push({ t: G.t, k: 'insdo', a: 'talk', g: g.n, ok: 1 }); return { ok: true, t: `اتفاق: ${g.n} سلّموا السلاح مقابل عفو` }; }
      g.sat = clamp(g.sat - 8, 0, 100); G.log.push({ t: G.t, k: 'insdo', a: 'talk', g: g.n, ok: 0 }); return { ok: true, t: 'المفاوضات فشلت، وزعلوا أكثر' }; }
    if (a === 'op') {
      if (g.op) return 'العملية شغّالة'; if (G.ap < COST.op) return 'نقاط القرار ما تكفي'; if (G.nat.eco[0].cash < P.opCash) return 'الخزينة ما تكفي';
      G.ap -= COST.op; cash(G, -P.opCash); g.op = { t: G.t, m: 0, k: 0, c: 0 }; g.sat = clamp(g.sat - 20, 0, 100); I.heat = clamp(I.heat + 5, 0, 100); const ak = armyK(G); if (ak) fac(G, ak, 2);
      G.log.push({ t: G.t, k: 'insdo', a: 'op', g: g.n }); return { ok: true, t: `بدت العملية الأمنية ضد ${g.n} (~${P.opMo} شهر)` }; }
    if (a === 'stop') { if (!g.op) return 'ماكو عملية'; g.op = null; G.log.push({ t: G.t, k: 'insdo', a: 'stop', g: g.n }); return { ok: true, t: 'وقفنا العملية' }; }
    if (a === 'hit') {
      if (G.ap < COST.hit) return 'نقاط القرار ما تكفي'; if (G.nat.eco[0].cash < P.hitCash) return 'الخزينة ما تكفي'; G.ap -= COST.hit; cash(G, -P.hitCash);
      if (r() * 100 < P.hitP) { g.str *= .7; g.sat = clamp(g.sat - 15, 0, 100); I.heat = clamp(I.heat + 4, 0, 100); G.log.push({ t: G.t, k: 'insdo', a: 'hit', g: g.n, ok: 1 }); return { ok: true, t: `ضربة ناجحة: قيادات ${g.n} سقطت (−30٪ قوة)` }; }
      if (g.sup && G.C[g.sup]) S.addRel(G, g.sup, me, -10); I.heat = clamp(I.heat + 8, 0, 100); stab(G, -1); G.log.push({ t: G.t, k: 'insdo', a: 'hit', g: g.n, ok: 0 }); return { ok: true, t: 'الضربة فشلت وانكشفت' }; }
    return 'غلط';
  }
  // ===== مصير المهزومين (D-060) =====
  const FATE = {
    integ: { n: 'دمج بالجيش', d: 'يصيرون جنود: الجيش يكبر شوية بس ولاؤهم ضعيف (15٪ ينشقون بعد سنتين)، والجيش يزعل' },
    free: { n: 'حل وعفو', d: 'برنامج تسريح وإعادة دمج (فلوس قليلة)؛ العالم يرتاح، الشارع يزعل شوية، و20٪ يرجعون للسلاح' },
    exile: { n: 'نفي', d: 'يطلعون برّا البلد (لداعمهم إذا عدهم)؛ الداعم يزعل، و15٪ يرجعون من برّا' },
    jail: { n: 'محاكمة وسجن', d: 'الأمن أحسن؛ كلفة سجون كل شهر، الغرب ينتقد شوية، وخطر هروب' },
    exec: { n: 'إعدام', d: 'أقسى خيار: إدانة دولية (−15 ويا الكل)، عقوبات غربية، الداعم يكرهنا، الشارع ينقسم، وثأر يطلع جماعات جديدة' },
  };
  function fate(G, WD, S, i, how) {
    const I = G.ins, q = I.cap[i]; if (!q) return 'ماكو أسرى'; const me = G.me, k = kOf(G), r = G.rnd || Math.random, ak = armyK(G), sk = streetK(G); I.cap.splice(i, 1);
    if (how === 'integ') { G.C[me].pw += q.num / 1000; if (ak) fac(G, ak, -4); I.ret.push({ n: q.n + ' (انشقاق)', k: q.k, sup: q.sup, str: q.num / 1000 * .4, t: G.t + 730, p: .15, why: 'integ' }); }
    else if (how === 'free') { cash(G, -q.num * 5e-6 * Math.max(1, k * .3)); if (sk) fac(G, sk, -2); for (const x of G.ids) if (x !== me && S.rel(G, x, me) > -40) S.addRel(G, x, me, 1); I.ret.push({ n: q.n + ' (رجعوا)', k: q.k, sup: q.sup, str: q.num / 1000 * .5, t: G.t + 365 + Math.floor(r() * 365), p: .2, why: 'free' }); }
    else if (how === 'exile') { if (q.sup && G.C[q.sup]) S.addRel(G, q.sup, me, -10); I.ret.push({ n: q.n + ' (من المنفى)', k: q.k, sup: q.sup, str: q.num / 1000 * .5, t: G.t + 540, p: .15, why: 'exile' }); }
    else if (how === 'jail') { I.jail.push({ n: q.n, k: q.k, sup: q.sup, num: q.num, t: G.t }); for (const x of WEST) if (G.C[x] && x !== me) S.addRel(G, x, me, -2); }
    else if (how === 'exec') {
      for (const x of G.ids) if (x !== me) S.addRel(G, x, me, x === q.sup ? -30 : -15);
      for (const x of WEST) if (G.C[x] && x !== me && S.rel(G, x, me) < 20 && !G.sanc.some(s => s[0] === x && s[1] === me)) G.sanc.push([x, me, 'light']);
      if (sk) fac(G, sk, -8); if (ak) fac(G, ak, 4); stab(G, -3); I.heat = clamp(I.heat + 30, 0, 100); G.ten = clamp((G.ten || 0) + 2, 0, 100);
      I.ret.push({ n: 'ثأر ' + q.n, k: 'reb', sup: q.sup, str: q.num / 1000 * .8 + 1, t: G.t + 180 + Math.floor(r() * 360), p: .6, why: 'exec', sat: 0 }); }
    else { I.cap.splice(i, 0, q); return 'غلط'; }
    G.log.push({ t: G.t, k: 'insfate', g: q.n, how, num: q.num }); return { ok: true };
  }
  const API = { KIND, SEED, FATE, COST, ensure, month, act, fate, preview, live, byId, myK };
  if (typeof module !== 'undefined') module.exports = API; else root.WINS = API;
})(typeof window !== 'undefined' ? window : globalThis);
