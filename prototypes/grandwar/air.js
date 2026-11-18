// «الحرب الكبرى» — الجو والصواريخ والدفاع الجوي (I-082، GW5/I-086).
// بدون رسم. الوحدات: المسافة كم، الارتفاع كم، الوقت «ثانية جو» = دقيقة حقيقية (SC=60)، فالسرعات كلها حقيقية بنفس المقياس:
// طيارة 250 م/ث = 15 كم/ثانية جو، صاروخ S-300 ~1.9 كم/ث = 114، شاهد-136 ~51 م/ث = 3، باليستي 300 كم ~5 دقايق.
// الأرقام من مصادر مفتوحة (docs/features/grandwar-air-defense.md)، واللي ما معروف علناً معلّم [ASSUMPTION].
(function (root) {
  const LL = (lat, lon) => [(lon - 38.5) * 93.3608, (40.2 - lat) * 110.57];
  const SC = 60, KMS = ms => ms * SC / 1000;                      // م/ث ← كم بثانية الجو
  const HOR = (hm, zkm) => 4.12 * (Math.sqrt(Math.max(0, hm)) + Math.sqrt(Math.max(0, zkm * 1000))); // أفق الرادار (كم): ارتفاع الهوائي م، الهدف كم
  const rnd01 = a => Math.max(0, Math.min(1, a));

  // ===== الطيارات =====
  const PLANES = {
    //        السرعة      جو-جو أرض  تشويش  مقطع راداري م²  ارتفاع التنقل/الواطي كم
    f16: { n: 'F-16IQ', v: KMS(250), aa: .5, ag: 1, ecm: .8, rcs: 1.2, cruise: 7, low: .25, hi: 1, harm: 1, aam: { n: 'AIM-7M', r: 40, v: KMS(1000), pk: .4 } },
    su25: { n: 'سوخوي-25', v: KMS(200), aa: .08, ag: 1.35, ecm: 1, rcs: 12, cruise: 4, low: .1 },
    f14: { n: 'F-14A', v: KMS(250), aa: .55, ag: .55, ecm: .9, rcs: 20, cruise: 8, low: .3, aam: { n: 'AIM-54 / فكور-90', r: 90, v: KMS(1000), pk: .25 } },
    su24: { n: 'سوخوي-24', v: KMS(260), aa: .05, ag: 1.2, ecm: .95, rcs: 8, cruise: 5, low: .12, spr: 'su25' },
  };
  // ===== ذخائر الهجوم الإيرانية =====
  const MUN = {
    fateh: { n: 'فاتح-110', kind: 'bm', range: 300, ap: 80, wh: 1.1, rcs: .3 },
    f313: { n: 'فاتح-313', kind: 'bm', range: 500, ap: 110, wh: 1.1, rcs: .3 },
    zolf: { n: 'ذو الفقار', kind: 'bm', range: 700, ap: 150, wh: 1.2, rcs: .3 },
    shahed: { n: 'شاهد-136', kind: 'uav', v: KMS(51), z: .6, wh: .35, rcs: .1, range: 2000 },
    paveh: { n: 'باوه (كروز)', kind: 'cm', v: KMS(250), z: .04, wh: .9, rcs: .1, range: 1650 },
  };
  // ===== أنظمة الدفاع الجوي =====
  // det: كشف الرادار لهدف بحجم مقاتلة (كم) · hm: ارتفاع الهوائي (م) · ch: أهداف مرة وحدة · mg: صواريخ موجّهة مرة وحدة
  // react: من الكشف لأول إطلاق · gap: بين صاروخ وصاروخ · reload: تلقيم منصة (ثواني جو = دقايق)
  // r: المدى حسب الهدف (tbm = نصف قطر المنطقة المحمية ضد الباليستي) · pk: احتمال إصابة الصاروخ الواحد بظروف عادية
  const SYS = {
    pac: {
      n: 'باتريوت', full: 'MIM-104 باتريوت (PAC-2 GEM-T + PAC-3 MSE)', layer: 'بعيد', img: 'patriot', hm: 5, det: 170, ch: 5, mg: 9, react: .15, gap: .07, cold: 0, slew: 1, reload: 60, uav: 'self',
      mags: [
        { n: 'PAC-2 GEM-T', ready: 16, perL: 4, stock: 8, v: KMS(1700), r: { air: 160, uav: 60, cm: 60, tbm: 20 }, zMax: 24, zMin: .06, pk: { air: .7, uav: .8, cm: .55, tbm: .4 }, salvo: { air: 2, uav: 1, cm: 2, tbm: 2 } },
        { n: 'PAC-3 MSE', res: 'tbm', ready: 12, perL: 12, stock: 12, v: KMS(1700), r: { air: 60, uav: 40, cm: 40, tbm: 35 }, zMax: 36, zMin: .03, pk: { air: .7, uav: .85, cm: .75, tbm: .7 }, salvo: { air: 1, uav: 1, cm: 2, tbm: 2 } },
      ]
    },
    pantsir: {
      n: 'بانتسير-S1', full: 'بانتسير-S1 (صواريخ 57E6 + مدفعين 30 ملم)', layer: 'قريب', img: null, hm: 6, det: 36, ch: 4, mg: 4, react: .08, gap: .04, cold: 0, reload: 30, uav: 'all',
      mags: [
        { n: '57E6', ready: 24, perL: 12, stock: 24, v: KMS(900), r: { air: 20, uav: 15, cm: 15 }, zMax: 15, zMin: .005, pk: { air: .55, uav: .7, cm: .65 }, salvo: { air: 2, uav: 1, cm: 1 } },
        { n: 'مدفع 2A38M', gun: 1, ready: 1e9, perL: 0, stock: 0, r: { air: 4, uav: 4, cm: 4 }, zMax: 3, zMin: 0, pk: { air: .12, uav: .3, cm: .25 }, salvo: { air: 1, uav: 1, cm: 1 } },
      ]
    },
    s300: {
      n: 'S-300PMU2', full: 'S-300PMU2 «فيفوريت» (48N6E2)', layer: 'بعيد', img: 's400', hm: 25, det: 300, ch: 6, mg: 12, react: .15, gap: .05, cold: 1, reload: 60, uav: 'self',
      mags: [{ n: '48N6E2', ready: 24, perL: 4, stock: 24, v: KMS(1900), r: { air: 195, uav: 60, cm: 70, tbm: 40 }, zMax: 27, zMin: .01, pk: { air: .7, uav: .75, cm: .6, tbm: .5 }, salvo: { air: 2, uav: 1, cm: 2, tbm: 2 } }]
    },
    bavar: {
      n: 'باور-373', full: 'باور-373 (صياد-4)', layer: 'بعيد', img: 's400', hm: 15, det: 320, ch: 6, mg: 12, react: .2, gap: .06, cold: 0, reload: 60, uav: 'self',
      mags: [{ n: 'صياد-4', ready: 24, perL: 4, stock: 12, v: KMS(1600), r: { air: 200, uav: 50, cm: 60, tbm: 30 }, zMax: 27, zMin: .05, pk: { air: .6, uav: .75, cm: .55, tbm: .35 }, salvo: { air: 2, uav: 1, cm: 2, tbm: 2 } }]
    },
    khordad: {
      n: 'خرداد-15', full: 'خرداد-15 (صياد-3)', layer: 'متوسط', img: 's400', hm: 10, det: 150, ch: 6, mg: 12, react: .2, gap: .06, cold: 0, reload: 45, uav: 'self',
      mags: [{ n: 'صياد-3', ready: 16, perL: 4, stock: 8, v: KMS(1300), r: { air: 120, uav: 45, cm: 45 }, zMax: 27, zMin: .06, pk: { air: .6, uav: .75, cm: .5 }, salvo: { air: 2, uav: 1, cm: 2 } }]
    },
    tor: {
      n: 'تور-M1', full: 'تور-M1 (9M331) — دزفول المحلي نسخة منه', layer: 'قريب', img: null, hm: 5, det: 25, ch: 2, mg: 4, react: .1, gap: .05, cold: 1, reload: 18, uav: 'all',
      mags: [{ n: '9M331', ready: 16, perL: 8, stock: 16, v: KMS(800), r: { air: 12, uav: 12, cm: 12 }, zMax: 6, zMin: .01, pk: { air: .6, uav: .85, cm: .7 }, salvo: { air: 2, uav: 1, cm: 1 } }]
    },
  };
  const MANPADS = { n: 'دفاع جوي محمول', r: 5, zMax: 3.5, v: KMS(600), pk: { air: .25, uav: .3, cm: .2 } };
  const CLS_N = { air: 'طيارات', uav: 'مسيّرات', cm: 'صواريخ كروز', tbm: 'صواريخ باليستية' };

  const BASES = [
    { n: 'قاعدة بلد', rw: 0.3, ll: [33.94, 44.36], side: 0, type: 'f16', planes: 24 },
    { n: 'عين الأسد', rw: -0.2, ll: [33.79, 42.44], side: 0, type: 'f16', planes: 10 },
    { n: 'الإمام علي', rw: 0.5, ll: [30.94, 46.09], side: 0, type: 'su25', planes: 14 },
    { n: 'كركوك', rw: 0.1, ll: [35.47, 44.35], side: 0, type: 'su25', planes: 8 },
    { n: 'وحدتي (دزفول)', rw: -0.4, ll: [32.43, 48.4], side: 1, type: 'su24', planes: 12 },
    { n: 'أميدية', rw: 0.2, ll: [30.83, 49.53], side: 1, type: 'f14', planes: 10 },
    { n: 'نوجه (همدان)', rw: 0.6, ll: [35.21, 48.65], side: 1, type: 'f14', planes: 16 },
    { n: 'بوشهر', rw: 0.9, ll: [28.94, 50.83], side: 1, type: 'f14', planes: 12 },
    { n: 'شيراز', rw: 0.3, ll: [29.54, 52.59], side: 1, type: 'su24', planes: 10 },
  ];
  // المواقع تقريبية [ASSUMPTION]. العراق ما عنده باتريوت بالواقع: البطاريتين «سيناريو» (مثل مساعدة حليف). بانتسير-S1 عند العراق من 2014.
  const SAMS = [
    { n: 'باتريوت — بغداد', ll: [33.25, 44.5], side: 0, sys: 'pac', scen: 1 },
    { n: 'باتريوت — البصرة', ll: [30.6, 47.65], side: 0, sys: 'pac', scen: 1 },
    { n: 'باتريوت — قاعدة بلد', ll: [33.97, 44.3], side: 0, sys: 'pac', scen: 1 },
    { n: 'بانتسير — بغداد', ll: [33.33, 44.3], side: 0, sys: 'pantsir' },
    { n: 'بانتسير — عين الأسد', ll: [33.8, 42.47], side: 0, sys: 'pantsir' },
    { n: 'بانتسير — الإمام علي', ll: [30.98, 46.05], side: 0, sys: 'pantsir' },
    { n: 'S-300 — الأهواز', ll: [31.4, 48.8], side: 1, sys: 's300' },
    { n: 'S-300 — طهران', ll: [35.6, 51.3], side: 1, sys: 's300' },
    { n: 'باور-373 — همدان', ll: [35.0, 48.4], side: 1, sys: 'bavar' },
    { n: 'خرداد-15 — دزفول', ll: [32.3, 48.55], side: 1, sys: 'khordad' },
    { n: 'خرداد-15 — كرمانشاه', ll: [34.4, 47.2], side: 1, sys: 'khordad' },
    { n: 'تور-M1 — قاعدة وحدتي', ll: [32.45, 48.33], side: 1, sys: 'tor' },
    { n: 'تور-M1 — خرم آباد', ll: [33.5, 48.25], side: 1, sys: 'tor' },
  ];
  // مواقع الإطلاق الإيرانية (صواريخ باليستية وكروز ومسيّرات)
  const MBASES = [
    { n: 'قاعدة صواريخ كرمانشاه', ll: [34.2, 47.35], side: 1, bm: 40, cm: 8, uav: 0 },
    { n: 'قاعدة صواريخ خرم آباد', ll: [33.48, 48.35], side: 1, bm: 40, cm: 8, uav: 0 },
    { n: 'موقع مسيّرات — الأهواز', ll: [31.2, 48.95], side: 1, bm: 0, cm: 0, uav: 60 },
    { n: 'موقع مسيّرات — إيلام', ll: [33.55, 46.6], side: 1, bm: 0, cm: 0, uav: 40 },
  ];

  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const emit = (A, e) => { A.ev.push(e); if (A.ev.length > 400) A.ev.splice(0, 100); };
  const angN = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const cls = T => T.kind === 'bm' ? 'tbm' : T.kind === 'uav' ? 'uav' : T.kind === 'cm' ? 'cm' : 'air';
  const rcsOf = T => T.kind ? (T.rcs ?? .1) : PLANES[T.type].rcs;
  const alive = T => T && !T.done && T.st !== 'dead' && T.st !== 'fall';

  function mkSite(s) {
    const S = SYS[s.sys];
    return { ...s, kind: s.sys, p: LL(...s.ll), mags: S.mags.map(m => ({ ...m, ready0: m.ready, orig: m.ready, stock0: m.stock, rl: 0 })), eng: [], down: 0, emcon: 0, fired: 0, hits: 0, alert: 0, radar: 0 };
  }
  function create(W, opt = {}) {
    const A = {
      t: 0, id: 1, rnd: W.rnd, wt: W.t || 0,
      bases: (opt.bases || BASES).map(b => ({ ...b, p: LL(...b.ll), n0: b.planes, max: b.planes, rein: 0, ready: b.planes, cd: 3 + W.rnd() * 10, mission: { kind: 'auto' }, plan: null, down: 0 })),
      sams: (opt.sams || SAMS).map(mkSite),
      mbases: (opt.mbases || MBASES).map(m => ({ ...m, p: LL(...m.ll), bm0: m.bm, cm0: m.cm, uav0: m.uav })),
      planes: [], msls: [], ev: [], kills: [0, 0], lostPlanes: [0, 0], queue: [], raids: {}, raidCd: opt.raidCd ?? (30 + W.rnd() * 40),
      stat: { tbm: [0, 0], uav: [0, 0], cm: [0, 0] }, // [اعترضنا، وصل]
    };
    return A;
  }
  // ===== حماية/مدى: هل البطارية تشوف وتقدر تضرب هدف بهالمكان والارتفاع =====
  function seeR(s, z, rcs) { const S = SYS[s.sys]; return Math.min(S.det * Math.pow(rcs / 2, .25), HOR(S.hm, z)); }
  function covers(s, p, z, c = 'air', rcs = 2) {
    if (s.down > 0) return false; const d = d2(s.p, p), see = seeR(s, z, rcs);
    return s.mags.some(m => m.r[c] && (m.ready > 0 || m.stock > 0) && d < Math.min(m.r[c], see) && z <= m.zMax && z >= m.zMin);
  }

  // ===== الذكاء: شنو يسوي كل مطار =====
  function planFor(A, W, b) {
    const side = b.side, T = PLANES[b.type];
    const bats = [...W.battles.values()].map(bt => {
      const mine = bt.side === side; const cell = mine ? bt.tg : [...bt.from][0];
      const p = W.cells[cell].c; return { cell, p, w: (bt.na + bt.nd) * (mine ? 1.2 : 1.4), dist: d2(p, b.p) };
    }).filter(x => x.dist < 900).sort((a, c) => c.w / (1 + c.dist / 400) - a.w / (1 + a.dist / 400));
    if (T.aa >= .5 && (A.rnd() < .45 || !bats.length)) {
      // دورية الحماية فوق المعركة، بس برّا مظلة الدفاع الجوي للعدو (الطيارين يتجنبونها): نرجّع النقطة لجهة مطارنا لحد ما تطلع
      let tgt = bats[0] ? bats[0].p : nearestFront(W, side, b.p); if (!tgt) return null;
      for (let k = 0; k < 12 && A.sams.some(s => s.side !== side && covers(s, tgt, T.cruise, 'air', T.rcs) && d2(s.p, tgt) < Math.min(...s.mags.map(m => m.r.air || 0)) * .9 + 15); k++) tgt = [tgt[0] + (b.p[0] - tgt[0]) * .2, tgt[1] + (b.p[1] - tgt[1]) * .2];
      return { kind: 'cap', p: tgt };
    }
    // المظلة على ارتفاع الهجوم: الواطي يتخبى ورا أفق الرادار، والعالي (F-16 بقنابل موجهة) فوق المحمول بس بمدى الصواريخ البعيدة
    const zAtk = T.hi ? 5.5 : T.low;
    const cover = p => A.sams.filter(s => s.side !== side && covers(s, p, zAtk, 'air', T.rcs));
    for (const bt of bats) {
      const cv = cover(bt.p);
      if (!cv.length) return { kind: 'cas', p: bt.p, cell: bt.cell };
      if (cv.length === 1 && T.ag > .9) return A.rnd() < .55 ? { kind: 'strike', p: cv[0].p, sam: A.sams.indexOf(cv[0]) } : { kind: 'cas', p: bt.p, cell: bt.cell };
    }
    const sam = A.sams.filter(s => s.side !== side && !s.down && d2(s.p, b.p) < 700).sort((a, c) => d2(a.p, b.p) - d2(c.p, b.p))[0];
    if (sam && T.ag > .9) return { kind: 'strike', p: sam.p, sam: A.sams.indexOf(sam) };
    return null;
  }
  function nearestFront(W, side, p) {
    let best = null, bd = 1e9;
    for (let i = 0; i < W.N; i++) if (W.ctrl[i] === side && W.cells[i].nb.some(j => W.ctrl[j] !== side)) { const dd = d2(W.cells[i].c, p); if (dd < bd) { bd = dd; best = W.cells[i].c; } }
    return best;
  }
  // أقرب منطقة (للمحمول: هل تحت الطيارة قوات عدو)
  function cellNear(W, x, y, maxD) {
    let best = -1, bd = maxD; for (let i = 0; i < W.N; i++) { const c = W.cells[i].c, dd = Math.abs(c[0] - x) + Math.abs(c[1] - y); if (dd < bd) { bd = dd; best = i; } } return best;
  }

  // ===== إطلاق الذخائر الإيرانية (يدوي للفحص، أو من مخطط الضربات) =====
  function spawn(A, kind, from, to, o = {}) {
    const M = MUN[o.mun || (kind === 'bm' ? 'fateh' : kind === 'uav' ? 'shahed' : 'paveh')];
    const m = { kind, mun: o.mun, n: M.n, side: o.side ?? 1, x: from[0], y: from[1], z: kind === 'bm' ? 0 : M.z, x0: from[0], y0: from[1], tp: [...to], t: 0, trail: [], tg: o.tg || { kind: 'point', p: to, n: 'هدف' }, rid: o.rid, rcs: M.rcs, wh: M.wh, vx: 0, vy: 0, vz: 0 };
    if (kind === 'bm') { m.D = d2(from, to); m.T = 2 + m.D / 120; m.ap = M.ap * Math.min(1, .45 + m.D / M.range * .6); m.f = 0; }
    else { m.v = M.v; m.zc = M.z * (.8 + A.rnd() * .5); const side = (A.rnd() - .5) * (kind === 'uav' ? 90 : 40); const mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2, L = d2(from, to) || 1; m.wp = [[mx - (to[1] - from[1]) / L * side, my + (to[0] - from[0]) / L * side], to]; m.h = Math.atan2(to[1] - from[1], to[0] - from[0]); }
    A.msls.push(m); return m;
  }
  function flightT(kind, D) { return kind === 'bm' ? 2 + D / 120 + .06 : D / MUN[kind === 'uav' ? 'shahed' : 'paveh'].v; }
  // ضربة مركّبة (مثل نيسان 2024): مسيّرات أول لأنها بطيئة، بعدين كروز، والباليستي آخر شي، والكل يوصل سوا
  function planRaid(A, W) {
    const side = 1;
    const tg = raidTarget(A, W, side); if (!tg) return;
    const from = (k, n) => A.mbases.filter(m => m.side === side && m[k] > 0 && d2(m.p, tg.p) < (k === 'bm' ? 700 : MUN[k === 'uav' ? 'shahed' : 'paveh'].range)).sort((a, b) => d2(a.p, tg.p) - d2(b.p, tg.p)).slice(0, n);
    const items = [];
    const nU = 4 + Math.floor(A.rnd() * 9), nC = Math.floor(A.rnd() * 4), nB = 2 + Math.floor(A.rnd() * 5);
    for (const [k, n] of [['uav', nU], ['cm', nC], ['bm', nB]]) { const src = from(k, 2); if (!src.length) continue; for (let i = 0; i < n; i++) { const mb = src[i % src.length]; if (mb[k] <= 0) continue; mb[k]--; const tp = [tg.p[0] + (A.rnd() - .5) * 6, tg.p[1] + (A.rnd() - .5) * 6]; const D = d2(mb.p, tp); const mun = k === 'bm' ? (D < 300 ? 'fateh' : D < 500 ? 'f313' : 'zolf') : k === 'uav' ? 'shahed' : 'paveh'; items.push({ k, mb, tp, mun, T: flightT(k, D) }); } }
    if (!items.length) return;
    const Tm = Math.max(...items.map(i => i.T)), rid = A.id++;
    for (const it of items) A.queue.push({ t: A.t + (Tm - it.T) + A.rnd() * (it.k === 'uav' ? 1.5 : .3), ...it, rid, tg, erect: it.k === 'bm' ? 0 : null });
    const n = { uav: 0, cm: 0, bm: 0 }; items.forEach(i => n[i.k]++);
    A.raids[rid] = { tg, n, total: items.length, down: 0, hit: 0, eta: A.t + Tm, side };
    emit(A, { k: 'raid', side, x: tg.p[0], y: tg.p[1], tgt: tg.n, n, eta: Tm, rid });
  }
  function raidTarget(A, W, side) {
    const r = A.rnd();
    const bases = A.bases.filter(b => b.side !== side && A.mbases.some(m => m.side === side && d2(m.p, b.p) < 700));
    if (bases.length && r < .55) { const b = bases[Math.floor(A.rnd() * bases.length)]; return { kind: 'base', p: b.p, n: b.n, b }; }
    const sams = A.sams.filter(s => s.side !== side && !s.down && A.mbases.some(m => m.side === side && d2(m.p, s.p) < 700));
    if (sams.length && r < .75) { const s = sams[Math.floor(A.rnd() * sams.length)]; return { kind: 'sam', p: s.p, n: s.n, s }; }
    const cnt = new Map(); for (const d of W.divs) if (!d.dead && d.side !== side) cnt.set(d.cell, (cnt.get(d.cell) || 0) + 1);
    let best = null, bv = 0; for (const [c, n] of cnt) { const dd = Math.min(...A.mbases.filter(m => m.side === side).map(m => d2(W.cells[c].c, m.p))); if (dd < 650 && n > bv) { bv = n; best = c; } }
    return best != null ? { kind: 'troops', p: W.cells[best].c, cell: best, n: W.cells[best].city || 'تجمّع قوات' } : (bases[0] ? { kind: 'base', p: bases[0].p, n: bases[0].n, b: bases[0] } : null);
  }

  // ===== خطوة =====
  function step(A, W, SIM, dt) {
    if (dt > .03) { const n = Math.ceil(dt / .03); for (let i = 0; i < n; i++) step(A, W, SIM, dt / n); return; }
    A.t += dt;
    // اللوجستيات على ساعة اللعبة (ساعات): تصليح، تعويض طيارات، ذخيرة
    const dH = Math.max(0, (W.t || 0) - A.wt); A.wt = W.t || 0;
    if (dH) logistics(A, W, dH);
    sorties(A, W, dt);
    for (const p of A.planes) fly(A, W, SIM, p, dt);
    if (A.decoys) { for (const f of A.decoys) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; } A.decoys = A.decoys.filter(f => f.t < .08); }
    A.planes = A.planes.filter(p => p.st !== 'dead');
    // ضربات إيران المركّبة
    A.raidCd -= dt; if (A.raidCd <= 0) { A.raidCd = 70 + A.rnd() * 90; planRaid(A, W); }
    for (let i = A.queue.length - 1; i >= 0; i--) {
      const q = A.queue[i]; if (A.t < q.t) continue;
      if (q.k === 'bm' && q.erect === 0) { q.erect = 1; q.t += .06; emit(A, { k: 'bmerect', side: 1, x: q.mb.p[0], y: q.mb.p[1] }); continue; }
      A.queue.splice(i, 1); const off = [(A.rnd() - .5) * 3, (A.rnd() - .5) * 3];
      const m = spawn(A, q.k, [q.mb.p[0] + off[0], q.mb.p[1] + off[1]], q.tp, { mun: q.mun, tg: q.tg, rid: q.rid, side: q.mb.side });
      emit(A, { k: q.k === 'bm' ? 'bmlaunch' : q.k === 'uav' ? 'uavlaunch' : 'cmlaunch', side: q.mb.side, x: m.x, y: m.y, n: q.mb.n, tgt: q.tg.n, mun: MUN[q.mun].n });
    }
    // الدفاع الجوي
    for (const s of A.sams) defend(A, W, s, dt);
    manpads(A, W, dt);
    // الصواريخ والذخائر تتحرك
    for (const m of A.msls) { if (m.done) continue; m.t += dt; if (m.t < 0) continue; const px = m.x, py = m.y, pz = m.z; moveMsl(A, W, SIM, m, dt); if (!m.done) { m.vx = (m.x - px) / dt; m.vy = (m.y - py) / dt; m.vz = (m.z - pz) / dt; } const L = m.trail[m.trail.length - 1]; if (!L || Math.hypot(L[0] - m.x, L[1] - m.y) > 1.5 || Math.abs(L[2] - m.z) > 1.5) m.trail.push([m.x, m.y, m.z, A.t]); if (m.trail.length > 90) m.trail.shift(); }
    A.msls = A.msls.filter(m => !m.done || A.t - (m.doneT ?? (m.doneT = A.t)) < 1.2);
    // نهاية الضربات المركّبة
    for (const id in A.raids) { const r = A.raids[id]; if (r.down + r.hit >= r.total) { emit(A, { k: 'raidEnd', side: r.side, tgt: r.tg.n, n: r.n, down: r.down, hit: r.hit, total: r.total, x: r.tg.p[0], y: r.tg.p[1] }); delete A.raids[id]; } }
  }

  function logistics(A, W, dH) {
    for (const b of A.bases) { b.down = Math.max(0, b.down - dH); b.rein += dH; if (b.rein >= 24) { b.rein = 0; if (b.n0 < b.max) { b.n0++; b.ready++; } } }
    for (const s of A.sams) { s.down = Math.max(0, s.down - dH); s.sup = (s.sup || 0) + dH; if (s.sup >= 24) { s.sup = 0; for (const m of s.mags) if (!m.gun) { m.stock = Math.min(m.stock0, m.stock + m.perL); m.fix = (m.fix || 0) + 1; if (m.fix >= 2 && m.ready0 < m.orig) { m.fix = 0; m.ready0 += m.perL; } } } } // ذخيرة كل يوم، ومنصة بدل المحروقة كل يومين
    for (const m of A.mbases) { m.sup = (m.sup || 0) + dH; if (m.sup >= 24) { m.sup = 0; m.bm = Math.min(m.bm0, m.bm + 2); m.cm = Math.min(m.cm0, m.cm + 1); m.uav = Math.min(m.uav0, m.uav + 6); } }
  }

  function sorties(A, W, dt) {
    for (const b of A.bases) {
      b.cd -= dt;
      if (b.cd > 0 || b.down > 0 || b.ready < 2) continue;
      const m = b.mission.kind === 'auto' ? planFor(A, W, b) : b.mission;
      b.cd = 12 + A.rnd() * 14;
      if (!m || m.kind === 'idle' || !m.p) continue;
      const T = PLANES[b.type];
      const k = Math.min(b.ready, m.kind === 'cap' ? 2 : m.kind === 'strike' ? 4 : 2); b.ready -= k;
      const fid = A.id++, rh = b.rw, rx = Math.cos(rh), ry = Math.sin(rh);
      for (let i = 0; i < k; i++) A.planes.push({ id: A.id++, fid, slot: i, side: b.side, type: b.type, base: A.bases.indexOf(b), x: b.p[0] - rx * 1.2, y: b.p[1] - ry * 1.2, z: 0, h: rh, v: 0, m: { ...m }, st: 'roll', t: -i * .25, shots: T.aam ? 2 : 0, harm: m.kind === 'strike' && T.harm && i < 2 ? 1 : 0, bombs: T.ag > 1.1 ? 2 : 1, zT: 0, alt: 0, bank: 0, gam: 0, flares: 30, vx: 0, vy: 0, vz: 0, trk: [] });
      emit(A, { k: 'takeoff', side: b.side, x: b.p[0], y: b.p[1], base: b.n, n: k, kind: m.kind });
    }
  }

  // ===== الطيارة =====
  function fly(A, W, SIM, p, dt) {
    if (p.st === 'dead') return;
    p.t += dt; if (p.t < 0) return;
    const px = p.x, py = p.y, pz = p.z;
    if (p.st !== p.lastSt) { p.lastSt = p.st; p.stT = 0; } else p.stT = (p.stT || 0) + dt;
    const base = A.bases[p.base], T = PLANES[p.type], M = p.m;
    if (p.st === 'fall') { p.z = Math.max(0, p.z - dt * 6); p.h += dt * 4; p.bank += dt * 6; p.gam = -1; p.x += Math.cos(p.h) * T.v * .6 * dt; p.y += Math.sin(p.h) * T.v * .6 * dt; if (p.z <= 0) { p.st = 'dead'; emit(A, { k: 'crash', x: p.x, y: p.y, side: p.side }); } p.alt = p.z / 6; return; }
    // مراقب: حالة تكتيكية علقت (أكثر من 3 دقايق) ← رجوع؛ رجوع علق ساعتين ← تنزل وين ما كانت (حتى ما تبقى تدور)
    const tac = { popup: 1, dive: 1, pull: 1, harm: 1, loft: 1, crank: 1, final: 1 };
    if (tac[p.st] && p.stT > 3) { if (p.st === 'final') { land(A, p, base); return; } p.st = 'back'; }
    if (p.st === 'back' && p.stT > 120) { land(A, p, base); return; }
    // وقود: طلعة أقصاها ~ساعة ونص
    if (p.t > 95 && (p.st === 'out' || p.st === 'orbit')) p.st = 'back';
    let tx = M.p[0], ty = M.p[1], spd = T.v, turn = 6; const d = Math.hypot(tx - p.x, ty - p.y);
    // تهرّب: صاروخ جاي عليه قريب ← لفّة حادة (يحط الصاروخ على جنبه) وينزل ويرمي مشاعل/رقائق
    const threat = A.msls.find(m => m.tgt === p && !m.done && m.t > 0 && Math.hypot(m.x - p.x, m.y - p.y) < 18);
    if (threat && p.st !== 'roll' && p.st !== 'final') {
      p.ev = .25; const ang = Math.atan2(threat.y - p.y, threat.x - p.x) + Math.PI / 2 * (p.id % 2 ? 1 : -1);
      tx = p.x + Math.cos(ang) * 30; ty = p.y + Math.sin(ang) * 30; turn = 9; spd = T.v * 1.25; p.zT = Math.max(.08, p.z - 2);
      p.fl = (p.fl || 0) - dt; if (p.fl <= 0 && p.flares > 0) { p.fl = .03; p.flares--; (A.decoys = A.decoys || []).push({ x: p.x, y: p.y, vx: -Math.cos(p.h) * 2, vy: -Math.sin(p.h) * 2, t: 0 }); if (p.flares % 4 === 0) emit(A, { k: 'flare', x: p.x, y: p.y }); }
    } else if (p.ev > 0) { p.ev -= dt; tx = p.x + Math.cos(p.h) * 30; ty = p.y + Math.sin(p.h) * 30; }
    else if (p.st === 'roll') { tx = p.x + Math.cos(base.rw) * 20; ty = p.y + Math.sin(base.rw) * 20; spd = Math.min(T.v, (p.v || 0) + dt * 9.6); turn = 0; p.zT = p.v > KMS(75) ? 1.5 : 0; if (p.z > .15) p.st = 'out'; }
    else if (p.st === 'out') {
      // تنقّل عالي بأرضنا، وينزل واطي ~100 كم قبل الهدف إذا مهمته إسناد بطيارة هجوم (تحت أفق الرادار)
      p.zT = M.kind === 'cap' ? T.cruise : M.kind === 'cas' ? (T.hi ? 5.5 : d > 110 ? T.cruise * .6 : T.low) : M.kind === 'strike' ? (p.harm ? T.cruise : d > 110 ? T.cruise * .6 : T.low) : T.cruise;
      if (M.kind === 'cas' && T.hi && d < 7) { attack(A, W, SIM, p); p.bombs--; p.st = p.bombs > 0 ? 'pull' : 'back'; p.ph = 0; }
      else if ((M.kind === 'cas' || (M.kind === 'strike' && !p.harm)) && !T.hi && d < 12) { p.st = 'popup'; p.ph = 0; }
      else if (M.kind === 'strike' && !p.harm && T.hi && d < 7) { attack(A, W, SIM, p); p.bombs--; p.st = 'back'; }
      if (M.kind === 'strike' && p.harm && d < 85) { p.st = 'harm'; p.ph = 0; }
      if (M.kind === 'cap' && d < 18) { p.st = 'orbit'; p.ph = 0; }
    }
    else if (p.st === 'popup') { p.ph += dt; p.zT = 1.6; turn = 8; if (p.z > 1.2 || p.ph > .4) p.st = 'dive'; }   // صعود سريع قبل الغطس
    else if (p.st === 'dive') { p.zT = .3; spd = T.v * 1.15; turn = 7; if (d < 3.5) { if (p.bombs > 0) { p.bombs--; attack(A, W, SIM, p); } p.st = 'pull'; p.ph = 0; } }
    else if (p.st === 'pull') { p.ph += dt; p.zT = T.low * 3; const ang = p.h + (p.id % 2 ? 1 : -1) * 1.6; tx = p.x + Math.cos(ang) * 30; ty = p.y + Math.sin(ang) * 30; turn = 8; if (p.ph > .5) p.st = p.bombs > 0 && d < 40 ? 'out' : 'back'; }
    else if (p.st === 'harm') { // F-16: يطلق AGM-88 من ~85 كم على رادار البطارية، ويلف ويبتعد
      p.ph += dt; p.zT = T.cruise;
      if (p.harm && p.ph > .05) { p.harm = 0; const sm = A.sams[M.sam]; A.msls.push({ kind: 'harm', side: p.side, x: p.x, y: p.y, z: p.z, h: p.h, tgtSam: M.sam, tx: sm.p[0], ty: sm.p[1], t: 0, trail: [], v: KMS(700), vx: 0, vy: 0, vz: 0 }); emit(A, { k: 'harmlaunch', side: p.side, x: p.x, y: p.y, n: sm.n }); }
      if (p.ph > .05) { const ang = Math.atan2(ty - p.y, tx - p.x) + 2.2; tx = p.x + Math.cos(ang) * 30; ty = p.y + Math.sin(ang) * 30; }
      if (p.ph > .5) p.st = 'back';
    }
    else if (p.st === 'orbit') { p.ph += dt; const a2 = p.ph * (T.v / 15) + p.slot * 3; tx = M.p[0] + Math.cos(a2) * 15; ty = M.p[1] + Math.sin(a2) * 15; p.zT = T.cruise; if (p.ph > 35) p.st = 'back'; }
    else if (p.st === 'loft') { p.ph += dt; p.zT = p.z + 1; tx = p.lt.x; ty = p.lt.y; if (p.ph > .05) { p.shots--; A.msls.push({ kind: 'aam', side: p.side, x: p.x, y: p.y, z: p.z, h: p.h, tgt: p.lt, v0: T.aam.v, pk: T.aam.pk * PLANES[p.lt.type].ecm, t: 0, tmax: T.aam.r / (T.aam.v * .7), trail: [], from: T.aam.n, vx: 0, vy: 0, vz: 0 }); emit(A, { k: 'aam', side: p.side, x: p.x, y: p.y }); p.st = 'crank'; p.ph = 0; } }
    else if (p.st === 'crank') { p.ph += dt; const ang = Math.atan2(p.lt.y - p.y, p.lt.x - p.x) + .9 * (p.id % 2 ? 1 : -1); tx = p.x + Math.cos(ang) * 30; ty = p.y + Math.sin(ang) * 30; if (p.ph > .6) p.st = p.shots > 0 && M.kind === 'cap' ? 'orbit' : 'back'; }
    else if (p.st === 'back') { // رجوع: نقطة اقتراب على امتداد المدرج 20 كم
      const ax = base.p[0] - Math.cos(base.rw) * 20, ay = base.p[1] - Math.sin(base.rw) * 20; tx = ax; ty = ay; const db = Math.hypot(base.p[0] - p.x, base.p[1] - p.y); p.zT = db > 80 ? T.cruise * .7 : 1.2;
      if (Math.hypot(ax - p.x, ay - p.y) < 5 || db < 22) p.st = 'final';
    }
    else if (p.st === 'final') { tx = base.p[0]; ty = base.p[1]; spd = T.v * .32; p.zT = 0; turn = 8;
      const bd = Math.hypot(base.p[0] - p.x, base.p[1] - p.y), ahead = Math.cos(Math.atan2(base.p[1] - p.y, base.p[0] - p.x) - p.h) > 0;
      if (bd < 2 || (!ahead && bd < 5)) { land(A, p, base); return; } }
    // جو-جو: الحماية تشوف طيارة عدو بمدى صاروخها ← ترفع الأنف وترمي
    if (p.shots > 0 && T.aam && (p.st === 'orbit' || p.st === 'out' || p.st === 'back')) {
      const e = A.planes.find(q => q.side !== p.side && q.st !== 'fall' && q.st !== 'roll' && q.st !== 'dead' && q.t >= 0 && Math.hypot(q.x - p.x, q.y - p.y) < T.aam.r && !A.msls.some(m => m.tgt === q && !m.done && m.kind === 'aam'));
      if (e && A.rnd() < dt * 8) { p.st = 'loft'; p.ph = 0; p.lt = e; }
    }
    // الحركة: الأنف يلف بحد (نصف قطر لفة ~2.5 كم)، الجناح يميل، والارتفاع يتغير بمعدل صعود حقيقي
    const want = Math.atan2(ty - p.y, tx - p.x), dh = angN(want - p.h);
    const rate = Math.max(-turn, Math.min(turn, dh * 6)); p.h += rate * dt;
    const bankT = Math.atan(rate / 6 * 1.4); p.bank += Math.max(-25 * dt, Math.min(25 * dt, bankT - p.bank));
    p.v = spd; const dz = Math.max(-6 * dt, Math.min(4 * dt, p.zT - p.z)); p.z = Math.max(0, p.z + dz); p.gam = Math.max(-1, Math.min(1, dz / dt / 4));
    p.x += Math.cos(p.h) * spd * dt; p.y += Math.sin(p.h) * spd * dt; p.alt = p.z / 6;
    p.vx = (p.x - px) / dt; p.vy = (p.y - py) / dt; p.vz = (p.z - pz) / dt;
    const L = p.trk[p.trk.length - 1]; if (!L || Math.hypot(L[0] - p.x, L[1] - p.y) > 2) { p.trk.push([p.x, p.y]); if (p.trk.length > 24) p.trk.shift(); }
  }
  function land(A, p, base) { p.st = 'dead'; base.ready = Math.min(base.n0, base.ready + 1); emit(A, { k: 'land', x: p.x, y: p.y, side: p.side }); }

  // ===== الدفاع الجوي: كشف ← توزيع الأهداف على القنوات ← صليات ← نظرة ← رمي ثاني =====
  function threatsFor(A, s) {
    const out = [];
    for (const q of A.planes) if (q.side !== s.side && q.t >= 0 && q.st !== 'fall' && q.st !== 'roll' && q.st !== 'dead') out.push(q);
    for (const m of A.msls) if (!m.done && m.side !== s.side && m.t >= 0 && (m.kind === 'bm' || m.kind === 'uav' || m.kind === 'cm')) out.push(m);
    return out;
  }
  function magFor(s, T, c, d, z) {
    let best = null, bs = -1;
    for (const m of s.mags) {
      if (m.ready <= 0 || !m.r[c]) continue;
      if (m.res && m.res !== c && d > 25) continue;   // مخزن محجوز للباليستي (باتريوت PAC-3): ما يضرب غيره إلا دفاع عن نفسه
      if (c === 'tbm') { if (!(T.f > .5 && z < m.zMax + 15 && z > 20 && d2(T.tp, s.p) < m.r.tbm && d < m.r.tbm + 120)) continue; } // ضد الباليستي: إطلاق والهدف نازل وفوق ~20 كم (حتى الحطام ما يطيح على المحمي)
      else if (!(d < m.r[c] && z <= m.zMax && z >= m.zMin)) continue;
      // الأفضل: احتمال أعلى، ولو تساوى نحافظ على الصاروخ الغالي (المدفع أول ضد المسيّرة القريبة)
      const sc = m.pk[c] + (m.gun ? .5 : 0) - (c === 'tbm' ? 0 : m.r[c] / 1000);
      if (sc > bs) { bs = sc; best = m; }
    }
    return best;
  }
  function defend(A, W, s, dt) {
    const S = SYS[s.sys];
    s.radar = (s.radar || 0) + dt * (s.down || s.emcon > 0 ? 0 : 40);
    // تلقيم المنصات من الاحتياط
    for (const m of s.mags) if (!m.gun && m.ready < m.ready0 && m.stock > 0) { m.rl += dt; if (m.rl >= S.reload) { m.rl = 0; const k = Math.min(m.perL, m.stock, m.ready0 - m.ready); m.stock -= k; m.ready += k; } } else m.rl = 0;
    s.emcon = Math.max(0, s.emcon - dt);
    if (s.down > 0) { s.eng.length = 0; s.alert = 0; return; }
    if (s.emcon > 0) { s.eng.length = 0; return; }   // الرادار مطفي خوفاً من صاروخ مضاد رادار
    // HARM جاي: نص الوقت الطاقم يطفي الرادار (يسلم من الضربة بس يسكت عن الرمي فترة)
    const harm = A.msls.find(m => m.kind === 'harm' && !m.done && m.tgtSam === A.sams.indexOf(s) && !m.seen && Math.hypot(m.x - s.p[0], m.y - s.p[1]) < 60);
    if (harm) { harm.seen = 1; if (A.rnd() < .5) { s.emcon = .7 + A.rnd() * .6; emit(A, { k: 'emcon', side: s.side, x: s.p[0], y: s.p[1], n: s.n }); return; } }
    const TH = threatsFor(A, s); const vis = [];
    for (const T of TH) { const d = Math.hypot(T.x - s.p[0], T.y - s.p[1]); if (d < seeR(s, T.z, rcsOf(T)) || (T.kind === 'bm' && d < S.det * 1.4)) vis.push({ T, d, c: cls(T) }); }
    if (vis.length) s.alert = 5; else s.alert = Math.max(0, s.alert - dt);
    s.raise = Math.max(0, Math.min(1, (s.raise || 0) + (s.alert > 0 ? dt / .03 : -dt / .2)));
    s.tracks = vis.length;
    // اشتباكات خلصت أو هدفها راح
    s.eng = s.eng.filter(e => alive(e.T) && (e.toFire > 0 || e.inAir > 0 || vis.some(v => v.T === e.T)));
    // قنوات فاضية ← أهداف جديدة بالأولوية: باليستي ← كروز ← طيارات ← مسيّرات
    const PRI = { tbm: 4, cm: 3, air: 2, uav: 1 };
    if (s.eng.length < S.ch) {
      const cand = vis.filter(v => !s.eng.some(e => e.T === v.T) && (v.c !== 'uav' || S.uav === 'all' || v.d < 25))
        .map(v => ({ ...v, mag: magFor(s, v.T, v.c, v.d, v.T.z) })).filter(v => v.mag)
        // توزيع النار: ما نرمي على هدف عليه بالجو صواريخ كافية من بطارية ثانية
        .filter(v => A.msls.filter(m => m.tgt === v.T && !m.done && (m.kind === 'sam')).length < (v.mag.salvo[v.c] || 1))
        .sort((a, b) => PRI[b.c] - PRI[a.c] || a.d - b.d);
      for (const v of cand) { if (s.eng.length >= S.ch) break; s.eng.push({ T: v.T, c: v.c, mag: v.mag, toFire: v.mag.salvo[v.c] || 1, inAir: 0, next: A.t + S.react, shots: 0 }); }
    }
    // الرمي
    const flying = A.msls.filter(m => m.site === s && !m.done && !m.gun).length;
    let guided = flying;
    for (const e of s.eng) {
      e.inAir = A.msls.filter(m => m.eng === e && !m.done).length;
      // نظرة بعد الصلية: إذا الهدف بعده حي وبالمدى، صلية ثانية (رمي-نظرة-رمي)
      if (e.toFire === 0 && e.inAir === 0 && e.shots > 0) { const mg = magFor(s, e.T, e.c, Math.hypot(e.T.x - s.p[0], e.T.y - s.p[1]), e.T.z); if (mg) { e.mag = mg; e.toFire = mg.salvo[e.c] || 1; e.next = A.t + .03; } }
      if (e.toFire <= 0 || A.t < e.next) continue;
      // قبل كل صاروخ: الهدف بعده بالغلاف؟ (وإذا خلص صاروخ هالمخزن نبدّل للثاني)
      const mgNow = magFor(s, e.T, e.c, Math.hypot(e.T.x - s.p[0], e.T.y - s.p[1]), e.T.z); if (!mgNow) { e.toFire = 0; continue; } if (e.mag.ready <= 0 || e.mag.gun !== mgNow.gun) e.mag = mgNow;
      if (!e.mag.gun && guided >= S.mg) continue;
      const brg = Math.atan2(e.T.y - s.p[1], e.T.x - s.p[0]); if (s.az == null) s.az = brg;
      if (S.slew) { const dz = angN(brg - s.az); s.az += Math.max(-25 * dt, Math.min(25 * dt, dz)); if (Math.abs(dz) > .2) continue; } else s.az = brg;
      if (S.cold && !e.mag.gun && s.raise < 1) continue;
      e.mag.ready--; e.toFire--; e.shots++; e.next = A.t + (e.mag.gun ? .02 : S.gap); s.fired++;
      const d0 = Math.hypot(e.T.x - s.p[0], e.T.y - s.p[1]), rr = e.mag.r[e.c];
      // الاحتمال: قاعدة النظام × تشويش الطيارة × (أضعف بآخر المدى)
      let pk = e.mag.pk[e.c] * (e.c === 'air' ? PLANES[e.T.type].ecm : 1) * (e.c === 'tbm' ? 1 : 1 - .35 * Math.pow(Math.min(1, d0 / rr), 2));
      if (e.mag.gun) { if (A.rnd() < pk) { hitTarget(A, W, e.T, s.side, s.n, 'gun', s); s.hits++; } emit(A, { k: 'gun', side: s.side, x: s.p[0], y: s.p[1], tx: e.T.x, ty: e.T.y }); continue; }
      guided++;
      const z0 = 0, tmax = (c => c === 'tbm' ? (rr + 40) / (e.mag.v * .7) : rr / (e.mag.v * .7) + .1)(e.c);
      A.msls.push({ kind: 'sam', side: s.side, x: s.p[0], y: s.p[1], z: z0, h: S.slew ? s.az : brg, tgt: e.T, pk, t: 0, tmax, v0: e.mag.v, v: 0, trail: [], from: s.n, site: s, eng: e, sys: s.sys, cold: S.cold, abm: e.c === 'tbm', vx: 0, vy: 0, vz: 0 });
      emit(A, { k: 'samlaunch', side: s.side, x: s.p[0], y: s.p[1], n: s.n, kind: s.sys, cold: S.cold, h: S.slew ? s.az : brg, c: e.c });
    }
  }
  // الدفاع الجوي المحمول مع القوات: أي طيارة/مسيّرة/كروز واطية فوق منطقة بيها قوات عدو تنرمى عليها
  function manpads(A, W, dt) {
    if (!W.N) return;
    const low = [...A.planes.filter(p => p.t >= 0 && p.st !== 'fall' && p.st !== 'dead' && p.st !== 'roll' && p.z < MANPADS.zMax && p.z > .03), ...A.msls.filter(m => !m.done && (m.kind === 'uav' || m.kind === 'cm'))];
    for (const T of low) {
      T.mpT = (T.mpT || 0) - dt; if (T.mpT > 0) continue; T.mpT = .25;  // نفحص كل ربع دقيقة
      const ci = cellNear(W, T.x, T.y, 60); if (ci < 0) continue;
      const foe = 1 - T.side; if (W.ctrl[ci] !== foe) continue;
      const n = W.divs.filter(d => !d.dead && d.side === foe && d.cell === ci).length; if (!n) continue;
      const c = cls(T); if (A.rnd() > .06 * n * (T.z < 1 ? 1.5 : 1) * (c === 'air' ? 1 : .25)) continue;
      const a = A.rnd() * 6.28, r = 2 + A.rnd() * 2.5, sx = T.x + Math.cos(a) * r, sy = T.y + Math.sin(a) * r;
      A.msls.push({ kind: 'sam', side: foe, x: sx, y: sy, z: 0, h: Math.atan2(T.y - sy, T.x - sx), tgt: T, pk: MANPADS.pk[c] * (c === 'air' ? PLANES[T.type].ecm : 1), ir: 1, t: 0, tmax: .2, v0: MANPADS.v, v: 0, trail: [], from: MANPADS.n, sys: 'manpads', vx: 0, vy: 0, vz: 0 });
      emit(A, { k: 'samlaunch', side: foe, x: sx, y: sy, n: MANPADS.n, kind: 'manpads', h: Math.atan2(T.y - sy, T.x - sx), c });
    }
  }

  // ===== حركة الصواريخ =====
  function moveMsl(A, W, SIM, m, dt) {
    if (m.kind === 'bm') {
      m.f = Math.min(1, m.t / m.T); const f = m.f; m.x = m.x0 + (m.tp[0] - m.x0) * f; m.y = m.y0 + (m.tp[1] - m.y0) * f; m.z = 4 * m.ap * f * (1 - f);
      if (f > .8 && !m.boom) { m.boom = 1; emit(A, { k: 'reentry', x: m.x, y: m.y }); }
      if (f >= 1) { m.done = 1; impact(A, W, SIM, m); }
      return;
    }
    if (m.kind === 'uav' || m.kind === 'cm') {
      const wp = m.wp[0]; const want = Math.atan2(wp[1] - m.y, wp[0] - m.x); m.h += Math.max(-2 * dt * 60, Math.min(2 * dt * 60, angN(want - m.h)));
      const dd = Math.hypot(wp[0] - m.x, wp[1] - m.y);
      const last = m.wp.length === 1; m.z += ((last && dd < (m.kind === 'uav' ? 3 : 2) ? 0 : m.zc) - m.z) * Math.min(1, dt * 20);
      if (dd < m.v * dt * 1.2 + .3) { if (last) { m.done = 1; impact(A, W, SIM, m); return; } m.wp.shift(); }
      m.x += Math.cos(m.h) * m.v * dt; m.y += Math.sin(m.h) * m.v * dt; return;
    }
    if (m.kind === 'harm') {
      const sm = A.sams[m.tgtSam]; const want = Math.atan2(m.ty - m.y, m.tx - m.x); m.h += Math.max(-3, Math.min(3, angN(want - m.h)));
      m.x += Math.cos(m.h) * m.v * dt; m.y += Math.sin(m.h) * m.v * dt; const D = Math.hypot(m.tx - m.x, m.ty - m.y); m.z = Math.max(0, Math.min(m.z + dt * 3, D * .15));
      if (D < m.v * dt + .3) {
        m.done = 1; const on = !sm.down && sm.emcon <= 0;
        if (A.rnd() < (on ? .65 : .12)) { sm.down = Math.max(sm.down, 36); sm.eng.length = 0; emit(A, { k: 'harmhit', x: m.tx, y: m.ty, side: m.side, n: sm.n }); }
        else emit(A, { k: 'harmmiss', x: m.tx + 1, y: m.ty + 1, side: m.side, n: sm.n, off: !on });
      }
      return;
    }
    // صاروخ دفاع جوي أو جو-جو: يوجّه على نقطة الالتقاء المتوقعة (توجيه بالتقدّم)
    if (m.tgt && !m.tgt.kind && A.decoys && m.ir && !m.fooled && A.decoys.some(f => Math.hypot(f.x - m.x, f.y - m.y) < 4) && A.rnd() < .3) m.fooled = 1;
    const T = m.tgt;
    if (!alive(T) || (m.site && (m.site.down > 0 || m.site.emcon > 0) && !m.ir)) { m.done = 1; emit(A, { k: 'selfd', x: m.x, y: m.y, z: m.z }); return; } // بدون رادار التوجيه الصاروخ يدمّر نفسه
    if (m.cold && m.t < .03) { m.z = m.t / .03 * .03; m.v = 0; if (m.t + dt >= .03) emit(A, { k: 'ignite', x: m.x, y: m.y, side: m.side }); return; }
    const boostT = .05; m.v = m.v0 * (m.t < boostT ? .35 + .65 * m.t / boostT : Math.max(.55, 1 - (m.t - boostT) / m.tmax * .45)); m.boost = m.t < boostT * 2;
    const rx = T.x - m.x, ry = T.y - m.y, rz = (T.z || 0) - m.z, D = Math.hypot(rx, ry, rz);
    // نقطة الالتقاء: نحل |r + V·t| = v·t (معادلة تربيعية)، وإذا ما بيها حل نلاحق الهدف مباشرة
    const Vx = T.vx || 0, Vy = T.vy || 0, Vz = T.vz || 0, qa = Vx * Vx + Vy * Vy + Vz * Vz - m.v * m.v, qb = 2 * (rx * Vx + ry * Vy + rz * Vz), qc = D * D;
    let ti = -1; if (Math.abs(qa) < 1e-6) ti = qb < 0 ? -qc / qb : -1; else { const disc = qb * qb - 4 * qa * qc; if (disc >= 0) { const s1 = (-qb - Math.sqrt(disc)) / (2 * qa), s2 = (-qb + Math.sqrt(disc)) / (2 * qa); ti = Math.min(...[s1, s2].filter(x => x > 0), 1e9); if (ti === 1e9) ti = -1; } }
    let ax = rx, ay = ry, az = rz; if (ti > 0) { ax += Vx * ti; ay += Vy * ti; az = Math.max(-m.z, rz + Vz * ti); }
    if (m.fooled) { ax += 3; ay -= 2; az -= .5; }
    if (m.t < .02 && !m.cold) az = Math.max(az, .5 * Math.hypot(ax, ay)); // يطلع لفوق شوية من المنصة
    const L = Math.hypot(ax, ay, az) || 1, step = m.v * dt;
    if (D <= Math.max(.25, step * 1.05)) {
      m.done = 1; m.x = T.x; m.y = T.y; m.z = T.z || 0;
      const pk = m.fooled ? m.pk * .1 : m.pk * (T.ev > 0 ? .7 : 1) * (m.ir && T.flares > 0 && !T.kind ? .55 : 1);
      if (A.rnd() < pk) { hitTarget(A, W, T, m.side, m.from, m.kind, m.site); if (m.site) m.site.hits++; }
      else emit(A, { k: 'miss', x: m.x, y: m.y, z: m.z, side: m.side, burst: 1 });
      return;
    }
    m.x += ax / L * step; m.y += ay / L * step; m.z = Math.max(0, m.z + az / L * step); m.h = Math.atan2(ay, ax);
    if (m.t > m.tmax) { m.done = 1; emit(A, { k: 'selfd', x: m.x, y: m.y, z: m.z }); }
  }
  function hitTarget(A, W, T, side, by, how, site) {
    const c = cls(T);
    if (T.kind) { // ذخيرة انعترضت
      T.done = 1; A.stat[c] && A.stat[c][0]++; if (T.rid && A.raids[T.rid]) A.raids[T.rid].down++;
      emit(A, { k: 'intercept', x: T.x, y: T.y, z: T.z, side, what: c, by, gun: how === 'gun' });
      return;
    }
    T.st = 'fall'; T.t = 0; if (A.rnd() < .7) emit(A, { k: 'eject', x: T.x, y: T.y, side: T.side });
    A.kills[side]++; A.lostPlanes[T.side]++; A.bases[T.base].n0 = Math.max(0, A.bases[T.base].n0 - 1);
    emit(A, { k: 'kill', x: T.x, y: T.y, z: T.z, side, victim: PLANES[T.type].n, vside: T.side, by: how === 'aam' ? 'aam' : by });
  }
  function attack(A, W, SIM, p) {
    const T = PLANES[p.type];
    if (p.m.kind === 'strike' && p.m.sam != null) {
      const s = A.sams[p.m.sam]; if (d2(s.p, [p.x, p.y]) < 12) siteHit(A, s, 1.2, p.side, 'bomb');
      return;
    }
    let cell = p.m.cell; const en = c => W.divs.filter(d => !d.dead && d.side !== p.side && d.cell === c);
    if (cell == null || !en(cell).length) { let bd = 40; cell = null; for (const d of W.divs) if (!d.dead && d.side !== p.side) { const dd = d2(W.cells[d.cell].c, [p.x, p.y]); if (dd < bd) { bd = dd; cell = d.cell; } } }
    const c = cell != null ? W.cells[cell].c : [p.x, p.y];
    emit(A, { k: 'bomb', x: c[0] + (A.rnd() - .5) * 4, y: c[1] + (A.rnd() - .5) * 4, side: p.side });
    if (cell != null) SIM.airHit(W, p.side, cell, T.ag);
  }
  // ضربة على بطارية: منصات تنحرق (جاهز ينقص)، وأحياناً الرادار (تتعطل ساعات)
  function siteHit(A, s, k, side, how) {
    const m = s.mags.find(q => !q.gun && q.ready0 > 0);
    if (m && A.rnd() < .6 * k) { const lost = Math.min(m.ready0, m.perL); m.ready0 -= lost; m.ready = Math.min(m.ready, m.ready0); }
    if (A.rnd() < .35 * k) { s.down = Math.max(s.down, 24 + A.rnd() * 24); s.eng.length = 0; }
    emit(A, { k: 'bomb', x: s.p[0], y: s.p[1], side, what: s.n, small: how !== 'bomb' });
  }
  function impact(A, W, SIM, m) {
    const c = cls(m); A.stat[c] && A.stat[c][1]++; if (m.rid && A.raids[m.rid]) A.raids[m.rid].hit++;
    emit(A, { k: m.kind === 'bm' ? 'bmimpact' : 'munhit', kind: m.kind, x: m.x, y: m.y, side: m.side, tgt: m.tg.n });
    const k = m.wh || 1, tg = m.tg;
    if (tg.kind === 'base' && d2(tg.p, [m.x, m.y]) < 6) { const b = tg.b; if (b.ready > 0 && A.rnd() < .3 * k) { b.ready--; b.n0 = Math.max(0, b.n0 - 1); A.lostPlanes[b.side]++; } b.down = Math.max(b.down, 4 * k); }
    if (tg.kind === 'sam' && d2(tg.p, [m.x, m.y]) < 6) siteHit(A, tg.s, .7 * k, m.side, m.kind);
    if (tg.kind === 'troops') SIM.airHit(W, m.side, tg.cell, k);
  }
  const API = { create, step, spawn, covers, seeR, HOR, PLANES, BASES, SAMS, MBASES, SYS, MUN, MANPADS, CLS_N, LL, SC, KMS };
  if (typeof module !== 'undefined') module.exports = API; else root.AIR = API;
})(this);
