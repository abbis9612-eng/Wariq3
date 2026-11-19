// «الحرب الكبرى» GW10 (I-091): عالم أوسع — الدول والدبلوماسية والتحالفات والهدنة والسلام والأحداث. بدون رسم؛ فحص tests/dip.test.mjs.
// الحرب تبقى بين جبهتين (العراق ضد إيران) على نفس الخريطة. الدول الثانية تأثر من برّا:
//  - علاقة كل دولة ويا الطرفين (−100..100) تتغير بالبعثات والأحداث وتصرفات الحرب.
//  - تطلب منها مساعدة (فلوس، صواريخ، طيارات)، أو تدخل الحرب وياك (قوة عسكرية توصل للعراق)، أو عقوبات على إيران.
//  - هدنة وسلام بشروط: إيران تقبل حسب «تعب الحرب» عندها (معنويات، مدن خسرتها، فلوس، طول الحرب).
//  - أحداث عالمية: أوبك، هرمز، مجلس الأمن، نازحين، حاملة طائرات، شحنات سلاح، مظاهرات، قروض.
// الأرقام [تقدير] لعلاقات 2026 (بعد سقوط نظام الأسد بسوريا أواخر 2024).
(function (root) {
  const LL = (lat, lon) => [(lon - 38.5) * 93.3608, (40.2 - lat) * 110.57];
  // will: none (علاقات بس) / aid (مساعدة) / troops (تدخل بقوات) / air (تدخل بطيارات ودفاع جوي)
  // aid: [حزم للعراق، حزم لإيران]؛ الحزمة 'cash:a-b' أو مفتاح من ECON.ITEMS. join: أقل علاقة حتى تدخل الحرب. force: القوة اللي ترسلها
  const COUNTRIES = [
    { id: 'kw', n: 'الكويت', f: '🇰🇼', rel: [25, -15], will: 'aid', gulf: 1, aid: [['cash:1-2.5'], []], to: [29.6, 47.5] },
    { id: 'sa', n: 'السعودية', f: '🇸🇦', rel: [25, -35], will: 'troops', gulf: 1, join: 80, force: [['arm', 1], ['mec', 2]], aid: [['cash:2-5', 'pac2'], []], to: [30.3, 46.1] },
    { id: 'ae', n: 'الإمارات', f: '🇦🇪', rel: [20, -15], will: 'aid', gulf: 1, aid: [['cash:1.5-4'], ['cash:.5-1']] },
    { id: 'qa', n: 'قطر', f: '🇶🇦', rel: [15, 20], will: 'aid', gulf: 1, med: 1, aid: [['cash:1-2'], ['cash:.5-1.5']] },
    { id: 'jo', n: 'الأردن', f: '🇯🇴', rel: [35, -20], will: 'troops', join: 85, force: [['mec', 1]], aid: [['cash:.2-.5'], []], to: [33.4, 40.6] },
    { id: 'sy', n: 'سوريا', f: '🇸🇾', rel: [10, -40], will: 'none' },
    { id: 'tr', n: 'تركيا', f: '🇹🇷', rel: [15, 5], will: 'troops', med: 1, join: 90, force: [['arm', 1], ['mec', 1]], aid: [['cash:.5-1.5', 'inf'], ['cash:.3-.8']], to: [36.9, 42.9] },
    { id: 'az', n: 'أذربيجان', f: '🇦🇿', rel: [5, -20], will: 'aid', aid: [['cash:.3-.8'], []] },
    { id: 'am', n: 'أرمينيا', f: '🇦🇲', rel: [0, 25], will: 'none' },
    { id: 'pk', n: 'باكستان', f: '🇵🇰', rel: [5, 10], will: 'none', med: 1 },
    // القوى الكبرى (برّا الخريطة)
    { id: 'us', n: 'أمريكا', f: '🇺🇸', rel: [30, -80], will: 'air', power: 1, sanc: 1, join: 80, aid: [['pac3', 'pac2', 'f16', 'cash:.5-1.5'], []] },
    { id: 'ru', n: 'روسيا', f: '🇷🇺', rel: [10, 45], will: 'aid', power: 1, aid: [['su25', 'e57'], ['n48', 'su24', 's4']] },
    { id: 'cn', n: 'الصين', f: '🇨🇳', rel: [20, 40], will: 'aid', power: 1, aid: [['ch4', 'cash:.5-2'], ['m6', 'cash:1-3', 's3']] },
  ];
  const BY = Object.fromEntries(COUNTRIES.map(c => [c.id, c]));
  const C_MISSION = .2;   // كلفة البعثة الدبلوماسية (مليار)
  const TERMS = {
    truce: { n: 'هدنة 7 أيام', need: .5, d: 'القتال يوقف أسبوع (الهجمات والطلعات الهجومية والضربات)، وبعدها الحرب ترجع إذا ما صار سلام' },
    sq: { n: 'سلام: حدود قبل الحرب', need: .78, d: 'كلمن يرجع لحدوده، والحرب تخلص بتعادل' },
    keep: { n: 'سلام: نحتفظ باللي أخذناه', need: .98, d: 'المناطق الإيرانية اللي بيدنا تبقى إلنا' },
    rep: { n: 'سلام + تعويضات 10 مليار', need: 1.15, d: 'حدود قبل الحرب، وإيران تدفع 10 مليار' },
  };

  function init(W) {
    W.dip = { c: {}, truce: 0, sanc: 0, cd: {}, offer: null, evT: {}, ev: [], inbound: [], hist: [], peaceCd: 0, iranCd: 24 * 5 };
    for (const C of COUNTRIES) W.dip.c[C.id] = { rel: C.rel.slice(), st: 'neutral' };
    return W;
  }
  const ensure = W => { if (!W.dip) init(W); return W; };
  const clamp = v => Math.max(-100, Math.min(100, v));
  const day = W => Math.floor(W.t / 24);
  const say = (W, o) => { const { k, ...r } = o; W.log.push({ t: W.t, ...r, k: 'dip', term: k }); };   // term = نوع الهدنة/السلام
  function rel(W, id, s, dv) { const c = W.dip.c[id]; c.rel[s] = clamp(c.rel[s] + dv); return c.rel[s]; }

  // ===== تعب الحرب: شكد الطرف يريد يخلّص (0 مرتاح، فوق 1 منهار) =====
  function vpOf(W) { const own = [0, 0], held = [0, 0]; W.cells.forEach((c, i) => { if (!c.vp) return; if (W.ctrl[i] === c.s) own[c.s] += c.vp; else held[W.ctrl[i]] += c.vp; }); return { own, held }; }
  function weary(W, s) {
    const e = W.eco ? W.eco[s] : { mor: 55, cash: 5 }, V = vpOf(W), o = 1 - s;
    const lost = 1 - V.own[s] / W.vpTotal[s], gain = V.held[s] / W.vpTotal[o];
    let w = (100 - e.mor) / 100 * .8 + lost * 2.2 - gain * 1.5 + (e.cash < 0 ? .25 : 0) + day(W) / 400;
    // حلفاء العدو يخوّفون، وحلفاؤنا يقوّون
    for (const C of COUNTRIES) { const st = W.dip.c[C.id].st; if (st === 'ally' + o) w += .08; if (st === 'ally' + s) w -= .06; }
    if (s === 1 && W.dip.sanc > W.t) w += .08;
    return w;
  }
  // جواب الطرف على شروط (مع وسيط يزيد القبول)
  function verdict(W, s, k, med) { const w = weary(W, s) + (med ? .12 : 0), need = TERMS[k].need; if (k === 'keep' && vpOf(W).held[1 - s] <= 0) return { ok: false, m: -1, why: 'ما بيدنا مدن إيرانية' }; return { ok: w >= need, m: w - need }; }
  const guess = v => v.why ? v.why : v.m >= .1 ? 'تقبل أكيد' : v.m >= 0 ? 'تقبل على الأغلب' : v.m > -.12 ? 'مترددة' : 'ترفض';

  // ===== أفعال (اللاعب = side 0، والذكاء يستعملها لإيران) =====
  function cdLeft(W, s, id, act) { return Math.max(0, (W.dip.cd[s + id + act] || 0) - W.t); }
  function setCd(W, s, id, act, h) { W.dip.cd[s + id + act] = W.t + h; }
  function mission(W, s, id) {
    const e = W.eco && W.eco[s]; if (cdLeft(W, s, id, 'm')) return 'البعثة الأخيرة قريبة، انتظر ' + Math.ceil(cdLeft(W, s, id, 'm') / 24) + ' يوم';
    if (e && e.cash - C_MISSION < -8) return 'الفلوس ما تكفي';
    if (e) e.cash -= C_MISSION; setCd(W, s, id, 'm', 24 * 7);
    const dv = 6 + Math.round(W.rnd() * 5); rel(W, id, s, dv); say(W, { side: s, a: 'mission', id, dv }); return { dv };
  }
  function pickAid(W, s, C) { const L = (C.aid || [[], []])[s]; return L.length ? L[Math.floor(W.rnd() * L.length)] : null; }
  const aidP = (W, s, id) => { const c = W.dip.c[id]; return Math.max(0, Math.min(.95, (c.rel[s] - 10) / 50 + (c.st === 'ally' + s ? .3 : 0))); };
  function askAid(W, s, id) {
    const C = BY[id], c = W.dip.c[id]; if (C.will === 'none' || !pickAid(W, s, C)) return 'هالدولة ما تساعد';
    if (c.st === 'ally' + (1 - s)) return 'هالدولة بالحرب ضدنا';
    if (cdLeft(W, s, id, 'a')) return 'طلبنا قريب، انتظر ' + Math.ceil(cdLeft(W, s, id, 'a') / 24) + ' يوم';
    setCd(W, s, id, 'a', 24 * 15);
    const p = aidP(W, s, id);
    if (W.rnd() > p) { rel(W, id, s, -2); say(W, { side: s, a: 'aidno', id }); return { ok: false, p }; }
    const pkg = pickAid(W, s, C); const at = W.t + 24 * (4 + Math.floor(W.rnd() * 9));
    W.dip.inbound.push({ s, id, pkg, at }); rel(W, id, s, -4); say(W, { side: s, a: 'aidyes', id, pkg, d: Math.round((at - W.t) / 24) });
    return { ok: true, pkg, p };
  }
  function askJoin(W, s, id) {
    const C = BY[id], c = W.dip.c[id]; if (!C.join || s !== 0) return 'هالدولة ما تدخل الحرب';
    if (c.st !== 'neutral') return 'هي أصلاً ' + (c.st === 'ally0' ? 'ويانا' : 'ويا إيران');
    if (cdLeft(W, s, id, 'j')) return 'رفضت قريب، انتظر ' + Math.ceil(cdLeft(W, s, id, 'j') / 24) + ' يوم';
    setCd(W, s, id, 'j', 24 * 20);
    if (c.rel[s] < C.join) { rel(W, id, s, -3); say(W, { side: s, a: 'joinno', id, need: C.join }); return { ok: false }; }
    join(W, id, s); return { ok: true };
  }
  function join(W, id, s) {
    const C = BY[id], c = W.dip.c[id]; c.st = 'ally' + s; c.rel[1 - s] = -100;
    if (C.force) for (const [k, n] of C.force) for (let i = 0; i < n; i++) W.dip.inbound.push({ s, id, pkg: 'div:' + k, at: W.t + 24 * (8 + i * 2) });
    if (C.will === 'air') { W.dip.inbound.push({ s, id, pkg: 'f16', at: W.t + 24 * 5 }, { s, id, pkg: 'f16', at: W.t + 24 * 9 }, { s, id, pkg: 'pac3', at: W.t + 24 * 6 }); }
    if (W.eco) { W.eco[s].mor = Math.min(100, W.eco[s].mor + 6); W.eco[1 - s].mor = Math.max(0, W.eco[1 - s].mor - 5); }
    say(W, { side: s, a: 'join', id });
  }
  function askSanc(W, s, id) {
    const C = BY[id], c = W.dip.c[id]; if (!C.sanc || s !== 0) return 'بس أمريكا تقدر تفرض عقوبات';
    if (W.dip.sanc > W.t) return 'العقوبات شغالة';
    if (cdLeft(W, s, id, 's')) return 'انتظر ' + Math.ceil(cdLeft(W, s, id, 's') / 24) + ' يوم';
    setCd(W, s, id, 's', 24 * 20);
    const p = Math.max(0, Math.min(.9, (c.rel[s] - 40) / 40)); if (W.rnd() > p) { say(W, { side: s, a: 'sancno', id }); return { ok: false, p }; }
    W.dip.sanc = W.t + 24 * 60; rel(W, id, s, -5); rel(W, 'cn', s, -4); say(W, { side: s, a: 'sanc', id }); return { ok: true };
  }
  // عرض هدنة أو سلام على الطرف الثاني. med = دولة وسيطة (علاقتها ≥30 ويا الطرفين)
  function propose(W, s, k, med) {
    if (W.over) return 'الحرب خلصت';
    if (k === 'truce' && W.dip.truce > W.t) return 'اكو هدنة هسه';
    if (W.dip.peaceCd > W.t) return 'رفضوا قريب، جرّب بعد ' + Math.ceil((W.dip.peaceCd - W.t) / 24) + ' يوم';
    let mOK = false; if (med) { const c = W.dip.c[med]; mOK = BY[med].med && c.rel[0] >= 30 && c.rel[1] >= 30 && c.st === 'neutral'; if (!mOK) return `${BY[med].n} ما تقدر تتوسط (لازم علاقتها 30+ ويا الطرفين)`; }
    const v = verdict(W, 1 - s, k, mOK);
    if (!v.ok) { W.dip.peaceCd = W.t + 24 * 5; say(W, { side: s, a: 'refuse', k, med }); return { ok: false, v }; }
    accept(W, s, k, med); return { ok: true, v };
  }
  function accept(W, s, k, med) {
    if (k === 'truce') { W.dip.truce = W.t + 24 * 7; for (const d of W.divs) if (!d.dead && d.path.length && W.ctrl[d.path[0]] !== d.side) { d.path = []; d.prog = 0; } say(W, { side: s, a: 'truce', med }); return; }
    // سلام: الحرب تخلص
    const by = s; let res = k === 'sq' ? 'draw' : (by === 0 ? 'win' : 'loss');
    if (k === 'rep' && W.eco) { W.eco[by].cash += 10; W.eco[1 - by].cash -= 10; }
    W.over = { t: W.t, peace: k, by, res, loser: res === 'win' ? 1 : res === 'loss' ? 0 : -1 };
    say(W, { side: s, a: 'peace', k, res, med });
  }
  // عرض من إيران (اللاعب يقرر)
  function answerOffer(W, yes) {
    const o = W.dip.offer; if (!o) return; W.dip.offer = null;
    if (yes) accept(W, 1, o.k); else { say(W, { side: 0, a: 'reject', k: o.k }); if (W.eco) W.eco[0].mor = Math.max(0, W.eco[0].mor + (o.k === 'keep' ? 2 : -1)); }
  }

  // ===== الأحداث العالمية =====
  // كل حدث: شرط، احتمال باليوم، وأقل فترة بين مرتين (أيام). choice: خيارات للاعب (أو الذكاء لإيران)
  const EVENTS = [
    { id: 'opec', n: '🛢 أوبك+ تزيد الإنتاج', p: .012, gap: 30, fx: W => { if (W.oil) W.oil.price = Math.max(60, W.oil.price - 10); }, txt: 'السعودية والإمارات رفعوا الإنتاج حتى يهدّون السوق: سعر النفط نزل ~10$.' },
    { id: 'hormuz', n: '⚓ حادث ناقلة بمضيق هرمز', p: .01, gap: 25, fx: W => { if (W.oil) W.oil.price = Math.min(150, W.oil.price + 12); for (const C of COUNTRIES) if (C.gulf) rel(W, C.id, 1, -8); rel(W, 'us', 1, -5); }, txt: 'زوارق إيرانية احتجزت ناقلة: سعر النفط قفز ~12$، ودول الخليج زعلت من إيران.' },
    { id: 'unsc', n: '🇺🇳 مجلس الأمن يدعو لوقف إطلاق النار', p: .008, gap: 30, when: W => day(W) > 15, choice: [
      { n: 'نقبل الدعوة (هدنة إذا إيران وافقت)', fx: W => { const v = verdict(W, 1, 'truce', true); if (v.ok || weary(W, 1) > .35) { accept(W, 0, 'truce'); return 'إيران وافقت: هدنة 7 أيام'; } for (const C of COUNTRIES) rel(W, C.id, 0, 2); return 'إيران رفضت، والعالم شاف إنك تريد السلام (+2 علاقات)'; } },
      { n: 'نكمل الحرب', fx: W => { for (const C of COUNTRIES) rel(W, C.id, 0, -3); return 'العالم زعل شوية (−3 علاقات)'; } }] },
    { id: 'refugees', n: '🏕 موجة نازحين', p: .015, gap: 20, when: W => W.log.some(l => l.k === 'take' && l.side === 1 && l.t > W.t - 24 * 5 && W.cells[l.cell].vp), choice: [
      { n: 'نفتح مخيمات (−0.4 مليار)', fx: W => { if (W.eco) { W.eco[0].cash -= .4; W.eco[0].mor = Math.min(100, W.eco[0].mor + 2); } rel(W, 'tr', 0, 3); rel(W, 'jo', 0, 3); return 'الناس ارتاحت (+2 معنويات)، وتركيا والأردن شكرونا'; } },
      { n: 'نخليهم يعبرون للجيران', fx: W => { rel(W, 'tr', 0, -6); rel(W, 'jo', 0, -6); return 'تركيا والأردن زعلوا (−6)'; } }] },
    { id: 'carrier', n: '🚢 حاملة طائرات أمريكية تدخل الخليج', p: .01, gap: 40, when: W => W.dip.c.us.rel[0] >= 45, fx: W => { if (W.eco) { W.eco[0].mor = Math.min(100, W.eco[0].mor + 3); W.eco[1].mor = Math.max(0, W.eco[1].mor - 2); } }, txt: 'أمريكا ترسل رسالة لإيران: معنوياتنا +3 ومعنوياتهم −2.' },
    { id: 'ruship', n: '🚂 شحنة سلاح روسية لإيران', p: .012, gap: 25, when: W => W.dip.c.ru.rel[1] >= 40, fx: W => { W.dip.inbound.push({ s: 1, id: 'ru', pkg: 'n48', at: W.t + 24 * 3 }, { s: 1, id: 'ru', pkg: 'su24', at: W.t + 24 * 6 }); }, txt: 'المخابرات تقول قطار سلاح عبر بحر قزوين: صواريخ S-300 وطيارات سوخوي لإيران.' },
    { id: 'protest0', n: '📢 مظاهرات ببغداد', p: .03, gap: 15, when: W => W.eco && W.eco[0].mor < 38, choice: [
      { n: 'نزيد الرواتب (−1 مليار)', fx: W => { W.eco[0].cash -= 1; W.eco[0].mor = Math.min(100, W.eco[0].mor + 6); return 'الناس هدأت (+6 معنويات)'; } },
      { n: 'نفرّقهم بالقوة', fx: W => { W.eco[0].mor = Math.min(100, W.eco[0].mor + 1); rel(W, 'us', 0, -6); return 'هدأت شوية (+1)، بس أمريكا والغرب زعلوا (−6)'; } }] },
    { id: 'protest1', n: '📢 مظاهرات بطهران', p: .03, gap: 15, when: W => W.eco && W.eco[1].mor < 38, fx: W => { W.eco[1].mor = Math.max(0, W.eco[1].mor - 2); }, txt: 'الشعب الإيراني تعب من الحرب: معنوياتهم −2.' },
    { id: 'loan', n: '🏦 الصين تعرض قرض', p: .008, gap: 45, when: W => W.eco && W.eco[0].cash < 8, choice: [
      { n: 'نقبل (+5 مليار)', fx: W => { W.eco[0].cash += 5; rel(W, 'cn', 0, 5); rel(W, 'us', 0, -5); return '+5 مليار. الصين +5، أمريكا −5'; } },
      { n: 'نرفض', fx: W => { rel(W, 'us', 0, 2); return 'أمريكا +2'; } }] },
  ];
  const EV = Object.fromEntries(EVENTS.map(e => [e.id, e]));
  function fireEvents(W) {
    for (const E of EVENTS) {
      if ((W.dip.evT[E.id] || -1e9) > W.t - 24 * E.gap) continue; if (E.when && !E.when(W)) continue; if (W.rnd() > E.p) continue;
      W.dip.evT[E.id] = W.t;
      if (E.choice) { if (W.dip.ev.length < 3) W.dip.ev.push({ id: E.id, t: W.t }); say(W, { side: 0, a: 'event', ev: E.id }); }
      else { E.fx(W); say(W, { side: 0, a: 'event', ev: E.id }); }
    }
  }
  // اللاعب يختار بحدث
  function choose(W, idx, ci) { const q = W.dip.ev[idx]; if (!q) return null; W.dip.ev.splice(idx, 1); const r = EV[q.id].choice[ci].fx(W); say(W, { side: 0, a: 'chose', ev: q.id, r }); return r; }

  // ===== كل يوم =====
  function daily(W, A, SIM, ECON) {
    ensure(W); const D = W.dip;
    // توصيل المساعدات والقوات
    for (let i = D.inbound.length - 1; i >= 0; i--) {
      const q = D.inbound[i]; if (q.at > W.t) continue; D.inbound.splice(i, 1);
      if (q.pkg.startsWith('cash:')) { const [a, b] = q.pkg.slice(5).split('-').map(Number); const v = +(a + W.rnd() * (b - a)).toFixed(1); if (W.eco) W.eco[q.s].cash += v; say(W, { side: q.s, a: 'got', id: q.id, cash: v }); }
      else if (q.pkg.startsWith('div:')) { const k = q.pkg.slice(4), C = BY[q.id]; const cell = arrival(W, q.s, C); if (cell < 0) continue; const d = SIM.addDiv(W, q.s, k, cell, 0); d.n = `${C.f} ${C.n}: ${SIM.KIND_N[k]}`; d.ally = q.id; d.org = d.orgMax * .8; SIM.joinArmy(W, d); say(W, { side: q.s, a: 'arrive', id: q.id, div: d.n, cell }); }
      else if (ECON && ECON.ITEMS[q.pkg]) { ECON.deliver(W, A, q.s, { k: q.pkg, gift: q.id }, SIM); say(W, { side: q.s, a: 'got', id: q.id, it: q.pkg }); }
    }
    // العلاقات ترجع ببطء لأصلها (1 كل 3 أيام)، إلا الحلفاء بالحرب
    if (day(W) % 3 === 0) for (const C of COUNTRIES) { const c = D.c[C.id]; if (c.st !== 'neutral') continue; for (const s of [0, 1]) { const d0 = C.rel[s] - c.rel[s]; if (Math.abs(d0) >= 1) c.rel[s] += Math.sign(d0); } }
    // ردود فعل على الحرب (آخر يوم): المدن اللي انحتلت، وضرب النفط
    for (let i = W.log.length - 1; i >= 0 && W.log[i].t > W.t - 24; i--) {
      const l = W.log[i];
      if (l.k === 'take' && W.cells[l.cell]?.vp && W.cells[l.cell].s !== l.side) { const att = l.side; for (const C of COUNTRIES) if (C.gulf || C.id === 'jo' || C.id === 'us') { rel(W, C.id, att, att === 1 ? -2 : -.5); } if (att === 1) rel(W, 'ru', 1, 1); }
      if (l.k === 'oilhit') { for (const C of COUNTRIES) if (C.gulf) rel(W, C.id, l.side, -1.5); if (l.vs === 1) rel(W, 'cn', 0, -2); }
    }
    if (D.truce && D.truce <= W.t && D.truce > W.t - 24) say(W, { side: 0, a: 'truceend' });
    fireEvents(W);
    if (!W.over) iranDip(W);
    D.hist.push([day(W), +weary(W, 0).toFixed(2), +weary(W, 1).toFixed(2)]); if (D.hist.length > 120) D.hist.shift();
  }
  // نقطة وصول القوات الحليفة: أقرب منطقة إلنا مزودة لحدود الدولة الحليفة
  function arrival(W, s, C) {
    const p = C.to ? LL(...C.to) : null; let best = -1, bd = 1e9;
    W.cells.forEach((c, i) => { if (W.ctrl[i] !== s || c.s !== s || !W.sup[s][i]) return; const d = p ? Math.hypot(c.c[0] - p[0], c.c[1] - p[1]) : -(c.vp || 0); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  // ===== ذكاء إيران الدبلوماسي =====
  function iranDip(W) {
    const D = W.dip; if (D.iranCd > W.t) return; D.iranCd = W.t + 24 * (4 + Math.floor(W.rnd() * 4));
    // يطلب مساعدة من أحسن صديق، أو يبعث بعثة
    const fr = COUNTRIES.filter(C => C.will !== 'none' && D.c[C.id].st !== 'ally0' && (C.aid || [[], []])[1].length).sort((a, b) => D.c[b.id].rel[1] - D.c[a.id].rel[1]);
    if (fr[0] && D.c[fr[0].id].rel[1] >= 35) askAid(W, 1, fr[0].id); else if (fr[0]) mission(W, 1, fr[0].id);
    // يعرض سلام إذا تعبان، أو يطلب منك تتنازل إذا انت التعبان
    if (D.offer || W.over || D.truce > W.t) return;
    const w1 = weary(W, 1), w0 = weary(W, 0);
    if (w1 > .85 && W.rnd() < .5) { D.offer = { k: 'sq', t: W.t }; say(W, { side: 1, a: 'offer', k: 'sq' }); }
    else if (w1 > .6 && W.rnd() < .3) { D.offer = { k: 'truce', t: W.t }; say(W, { side: 1, a: 'offer', k: 'truce' }); }
    else if (w0 > 1 && vpOf(W).held[1] > 0 && W.rnd() < .4) { D.offer = { k: 'keep', t: W.t }; say(W, { side: 1, a: 'offer', k: 'keep' }); }
  }
  // للمحاكاة والجو: هدنة هسه؟
  const truce = W => !!(W.dip && W.dip.truce > W.t);

  const API = { aidP, COUNTRIES, BY, TERMS, EVENTS, EV, C_MISSION, init, ensure, daily, weary, verdict, guess, mission, askAid, askJoin, askSanc, propose, accept, answerOffer, choose, truce, vpOf, cdLeft, join };
  if (typeof module !== 'undefined') module.exports = API; else root.DIP = API;
})(this);
