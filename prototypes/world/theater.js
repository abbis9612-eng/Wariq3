// «العالم» GW12 W5 (I-103، D-049): مسرح الحرب. لما اللاعب يدخل حرب برية، مناطق الجبهة تنقسم لخلايا سداسية (~30–60 كم)
// وتشتغل عليها فرق حقيقية (محسوبة من جيش كل دولة) بمحرك «الحرب الكبرى» (gwsim.js = نسخة من prototypes/grandwar/sim.js) بالساعات.
// السيطرة ترجع لمناطق الخريطة: المنطقة لمنو يمسك أغلب خلاياها. فحص: node tests/theater.test.mjs
(function (root) {
  'use strict';
  const SIM = root.SIM || (typeof require !== 'undefined' ? require('./gwsim.js') : null);
  // خطوط محصنة (حقول ألغام، خنادق، تحصينات): الجبهات القديمة (مثل أوكرانيا) ما تنكسر بسهولة [تقدير]
  if (SIM && !SIM.TERR.fort) SIM.TERR.fort = { atk: .45, spd: .55, w: 2, armor: .55, n: 'خطوط محصنة' };
  const HOPS = 3, MAXREG = 160, TARGET = 900;   // عمق المسرح بالمناطق، وحده، وعدد الخلايا المستهدف [تقدير]
  const TMAP = { plain: 'plain', desert: 'desert', hills: 'hills', mount: 'mount', marsh: 'marsh', city: 'city', forest: 'hills', jungle: 'marsh', tundra: 'plain', snow: 'mount' };
  const decode = rings => rings.map(f => { const a = []; let x = 0, y = 0; for (let i = 0; i < f.length; i += 2) { x += f[i]; y += f[i + 1]; a.push([x / 100, y / 100]); } return a; });
  const inRing = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

  // ===== البناء =====
  function build(G, WD, war, me, fix) {
    const idx = new Map(WD.r.map((a, i) => [a[0], i]));
    const mineA = war.a.includes(me), side0 = mineA ? war.a : war.b, side1 = mineA ? war.b : war.a;
    const sideOf = k => side0.includes(k) ? 0 : side1.includes(k) ? 1 : -1, CTL = fix ? fix.ctl0 : G.ctl;
    // 1) مناطق الجبهة وعمقها (لحد 3 جيران)، بس أراضي الطرفين
    let regs;
    if (fix) regs = fix.regs; else {
    const front = [];
    for (let i = 0; i < WD.r.length; i++) { const s = sideOf(G.ctl[i]); if (s < 0) continue; if (WD.r[i][7].some(n => { const o = sideOf(G.ctl[idx.get(n)]); return o >= 0 && o !== s; })) front.push(i); }
    if (!front.length) return null;   // ما اكو تماس بري (مثل أمريكا وإيران): الحرب تبقى مختصرة
    const dist = new Map(front.map(i => [i, 0])), q = front.slice();
    while (q.length) { const i = q.shift(), d = dist.get(i); if (d >= HOPS) continue; for (const n of WD.r[i][7]) { const j = idx.get(n); if (!dist.has(j) && sideOf(G.ctl[j]) >= 0) { dist.set(j, d + 1); q.push(j); } } }
    regs = [...dist.keys()].sort((a, b) => dist.get(a) - dist.get(b) || WD.r[b][5] - WD.r[a][5]).slice(0, MAXREG);
    }
    const depth = new Map(regs.map((r, i) => [r, i]));
    // 2) إسقاط محلي بالكيلومترات (مثل «الحرب الكبرى»: y لتحت)
    const polys = regs.map(i => decode(WD.g[WD.r[i][0]]));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const P of polys) for (const r of P) for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const lat0 = (y0 + y1) / 2, KX = 111.32 * Math.cos(lat0 * Math.PI / 180), KY = 110.57;
    const area = regs.reduce((t, i) => t + WD.r[i][5], 0);
    const hs = Math.max(28, Math.min((fix && fix.hsMax) || 80, Math.sqrt(area / ((fix && fix.target) || TARGET) / .866)));   // المسافة بين مراكز الخلايا (كم)؛ أرض الدولة بالسلم (home) خلاياها أكبر
    const bb = polys.map(P => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const r of P) for (const [x, y] of r) { a = Math.min(a, x); c = Math.max(c, x); b = Math.min(b, y); d = Math.max(d, y); } return [a, b, c, d]; });
    // 3) شبكة سداسية: كل خلية تاخذ منطقتها (اللي مركزها بيها)
    const W0 = (x1 - x0) * KX, H0 = (y1 - y0) * KY, rows = Math.ceil(H0 / (hs * .866)) + 1, cols = Math.ceil(W0 / hs) + 1;
    const cells = [], at = new Map();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const X = c * hs + (r & 1 ? hs / 2 : 0), Y = r * hs * .866, lon = x0 + X / KX, lat = y1 - Y / KY;
      let k = -1; for (let m = 0; m < regs.length; m++) { const b = bb[m]; if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue; if (polys[m].some(R => inRing(R, lon, lat))) { k = m; break; } }
      if (k < 0) continue;
      const ri = regs[k], ctl = CTL[ri];
      at.set(r + ',' + c, cells.length);
      cells.push({ c: [X, Y], ll: [lon, lat], rc: [r, c], reg: ri, own: ctl, s: sideOf(ctl), home: sideOf(WD.r[ri][1] || ctl), t: TMAP[WD.T[WD.r[ri][4]]] || 'plain', nb: [] });
    }
    // مناطق صغيرة ما طاحت بيها خلية: نعطيها أقرب خلية (حتى ما تضيع مدينة مثل غزة)
    const covered = new Set(cells.map(c => c.reg));
    for (const ri of regs) if (!covered.has(ri)) { const [lon, lat] = WD.r[ri][6]; let best = -1, bd = 1e9; cells.forEach((c, i) => { const d = (c.ll[0] - lon) ** 2 + (c.ll[1] - lat) ** 2; if (d < bd) { bd = d; best = i; } }); if (best >= 0 && bd < 1) cells[best].extra = (cells[best].extra || []).concat(ri); }
    // الجيران السداسية
    for (const cl of cells) { const [r, c] = cl.rc, odd = r & 1; const D = [[0, -1], [0, 1], [-1, odd ? 0 : -1], [-1, odd ? 1 : 0], [1, odd ? 0 : -1], [1, odd ? 1 : 0]];
      for (const [dr, dc] of D) { const j = at.get((r + dr) + ',' + (c + dc)); if (j != null) cl.nb.push(j); } }
    // 4) المدن = نقاط النصر: خلية مركز كل منطقة بيها مدن (المليون 6، 300 ألف 3، العاصمة +4)
    for (const ri of regs) { const a = WD.r[ri], cs = a[9]; if (!cs || !cs.length) continue; const [lon, lat] = a[6];
      let best = -1, bd = 1e9; cells.forEach((c, i) => { if (c.reg !== ri) return; const d = (c.ll[0] - lon) ** 2 + (c.ll[1] - lat) ** 2; if (d < bd) { bd = d; best = i; } });
      if (best < 0) continue; const p = cs[0][1] || 0, cl = cells[best]; cl.vp = Math.max(cl.vp || 0, (p >= 1e6 ? 6 : p >= 3e5 ? 3 : 1) + (a[12] ? 4 : 0)); cl.city = cs[0][0]; if (a[12] || p >= 1e6) cl.t = 'city'; }
    // كل طرف لازم عنده مدينة إمداد (≥3) بالمسرح، وإلا نعتبر أكبر مدنه
    for (const s of [0, 1]) if (!cells.some(c => c.s === s && (c.vp || 0) >= 3)) { const L = cells.filter(c => c.s === s).sort((a, b) => (b.vp || 0) - (a.vp || 0) || depth.get(b.reg) - depth.get(a.reg)); if (L[0]) L[0].vp = 3; }
    // الجبهة القديمة: الخلايا على خط التماس وخلية ورا كل وحدة = خطوط محصنة
    if (war.fort0) { const F = new Set(); cells.forEach((c, i) => { if (c.nb.some(j => cells[j].s !== c.s)) F.add(i); });
      for (let k = 0; k < 2; k++) for (const i of [...F]) for (const j of cells[i].nb) if (cells[j].s === cells[i].s) F.add(j);
      for (const i of F) if (cells[i].t !== 'city' && cells[i].t !== 'mount') cells[i].t = 'fort'; }
    // الطرق والأنهار والجسور (مثل «الحرب الكبرى» tools/roads.py بس وقت البناء): كل طريق/نهر يعبر حد بين خليتين جارتين
    const WR = (typeof window !== 'undefined' && window.WR) || WD.WR, edges = [], roads = { e: [], br: [] };
    if (WR) {
      const hexAt = (X, Y) => { const r0 = Math.round(Y / (hs * .866)); let best = null, bd = 1e9;
        for (let r = r0 - 1; r <= r0 + 1; r++) { const c0 = Math.round((X - (r & 1 ? hs / 2 : 0)) / hs); for (let c = c0 - 1; c <= c0 + 1; c++) { const j = at.get(r + ',' + c); if (j == null) continue; const d = (cells[j].c[0] - X) ** 2 + (cells[j].c[1] - Y) ** 2; if (d < bd) { bd = d; best = j; } } }
        return bd < (hs * .75) ** 2 ? best : null; };
      const walk = (f, cb) => { let x = 0, y = 0, px = null, py = null, prev = null;
        for (let i = 0; i < f.length; i += 2) { x += f[i]; y += f[i + 1]; const lon = x / 100, lat = y / 100;
          if (lon < x0 - 1 || lon > x1 + 1 || lat < y0 - 1 || lat > y1 + 1) { px = null; prev = null; continue; }
          const X = (lon - x0) * KX, Y = (y1 - lat) * KY;
          if (px != null) { const n = Math.max(1, Math.ceil(Math.hypot(X - px, Y - py) / (hs / 3))); for (let k = 1; k <= n; k++) { const h = hexAt(px + (X - px) * k / n, py + (Y - py) * k / n); if (h != null && prev != null && h !== prev) cb(prev, h, (px + X) / 2, (py + Y) / 2); if (h != null) prev = h; } }
          else prev = hexAt(X, Y);
          px = X; py = Y; } };
      const key = (a, b) => a < b ? a + ',' + b : b + ',' + a, RC = new Map(), RV = new Map();
      for (const r of WR.r) walk(r.slice(1), (a, b) => { if (!cells[a].nb.includes(b)) return; const k = key(a, b); RC.set(k, Math.max(RC.get(k) || 0, r[0])); });
      for (const v of WR.v) walk(v.slice(1), (a, b, x, y) => { if (!cells[a].nb.includes(b)) return; const k = key(a, b); if (!RV.has(k)) RV.set(k, [v[0], x, y]); });
      for (const [k, c] of RC) { const [a, b] = k.split(',').map(Number); roads.e.push([a, b, c]); }
      for (const [k, [n, x, y]] of RV) { const [a, b] = k.split(',').map(Number); edges.push([a, b, 1, null]); if (RC.has(k)) roads.br.push([a, b, x, y, 'جسر ' + n]); }
    }
    const T = { v: 1, war: war.id, me, side: [side0, side1], hs, hsMax: fix && fix.hsMax, target: fix && fix.target, lon0: x0, lat1: y1, KX, KY, regs, ctl0: fix ? fix.ctl0 : Object.fromEntries(regs.map(r => [r, G.ctl[r]])), cells, t: 0 };
    T.W = SIM.World({ cells: cells.map(c => ({ c: c.c, s: c.s, t: c.t, nb: c.nb, vp: c.vp || 0, city: c.city })), edges }, { seed: (G.seed || 1) + G.t, roads: WR ? roads : null });
    T.nRoads = roads.e.length; T.nBr = roads.br.length; T.nRiv = edges.length;
    T.W.cells.forEach((c, i) => { T.W.ctrl[i] = cells[i].s; });
    T.W.plans = []; T.W.planId = 1;   // خطط الهجوم بالأسهم (من «الحرب الكبرى»)
    SIM.initIntel(T.W);              // الضباب والاستخبارات: كل طرف يعرف بس اللي يشوفه (من «الحرب الكبرى»)
    Object.defineProperty(T, '_G', { value: G, writable: true }); Object.defineProperty(T, '_WD', { value: WD });
    if (!fix) army(T, G, WD);
    return T;
  }
  // ===== الجيوش: فرق من أرقام كل دولة الحقيقية =====
  // كل دولة لها خلايا بالمسرح تدز نسبة من جيشها: الطرف الرئيسي 70٪، الحليف 40٪ [تقدير]. فرقة = ~12 ألف (مدرعة 240 دبابة، آلية 90 دبابة + 220 مدرعة)
  function army(T, G, WD) {
    const W = T.W, CAP = 70;
    for (const s of [0, 1]) {
      let inf = 0, mec = 0, arm = 0;
      for (const k of T.side[s]) {
        const cs = WD.cs[k]; if (!cs || !T.cells.some(c => c.own === k)) continue;
        // المدافع على أرضه (الطرف ب بالحرب الأصلية، أو عاصمته بالمسرح) يرمي كل ثقله؛ المهاجم يخلي قوات بباقي حدوده
        const wr = G.wars.find(x => x.id === T.war) || {}, defender = (wr.b || []).includes(k) || (!(wr.a || []).includes(k) && T.regs.some(r => WD.r[r][12] && T.ctl0[r] === k));
        const commit = k === T.side[s][0] ? (defender ? .9 : .5) : .35, live = (G.C[k] ? G.C[k].pw / G.C[k].pw0 : 1);
        // المدافع يعبّي جزء من الاحتياط
        const men = ((cs.act || 0) + (defender ? (cs.res || 0) * .5 : 0)) * commit * live, tanks = (cs.tanks || 0) * commit * live, afv = ((cs.kit && cs.kit.afv && cs.kit.afv[0]) || (cs.tanks || 0) * 2.5) * commit * live;
        const a = Math.floor(tanks / 240), m = Math.floor(Math.max(0, afv - a * 110) / 220);
        arm += a; mec += m; inf += Math.max(1, Math.round((men - (a + m) * 9000) / 12000));
      }
      T.raw = T.raw || []; T.raw[s] = { inf, mec, arm };
      // الجودة: جيل الدبابات والطيارات (W4) والسيطرة الجوية
      const g = k => (WD.cs[k] && WD.cs[k].gen) || {}, lead = T.side[s][0], gt = g(lead).tank || 2, gj = g(lead).jet || 2;
      const uav = ((WD.cs[lead] || {}).tech || {}).uav || 1;   // المسيّرات ترفع الهجوم والصمود (أوكرانيا 5، تركيا 5، إيران 4)
      W.qual[s] = { hard: .8 + gt * .1, org: .9 + (gt - 2) * .05 + uav * .02, atk: .85 + gj * .06 + uav * .03 };
    }
    // حد للتلفون: أكبر طرف 70 فرقة بالأكثر، والطرفين ينضغطون بنفس النسبة (حتى الميزان يبقى صحيح)
    const big = Math.max(...T.raw.map(o => o.inf + o.mec + o.arm)), f = big > CAP ? CAP / big : 1;
    T.ob = T.raw.map(o => ({ inf: Math.max(2, Math.round(o.inf * f)), mec: Math.round(o.mec * f), arm: Math.round(o.arm * f), scale: 1 / f }));
    // نوزع الفرق: حاميات بالمدن القريبة من الجبهة، والباقي على الجبهة (نفس طريقة «الحرب الكبرى»)
    SIM.scenario(W, { ob: T.ob.map(o => ({ inf: o.inf, mec: o.mec, arm: o.arm })) });
    W.ob = [0, 1].map(s => SIM.alive(W).filter(d => d.side === s).length);
    initAir(T, G, WD);
    for (const d of W.divs) d.n = `${d.side ? '' : ''}${SIM.KIND_N[d.kind]} ${d.num}`;
  }
  // ===== التشغيل =====
  function step(T, hours = 1) {
    const W = T.W;
    for (let h = 0; h < hours && !W.over; h++) {
      SIM.step(W); T.t++;
      if (W.t % 24 === 12 && T.air && !T.A) airDay(T, T._G, T._WD);   // الجو البسيط بس إذا الجو الحقيقي ما موجود (حفظ قديم)
      if (W.t % 6 === 0) { SIM.ai(W, 1); if (T.auto0 !== false) SIM.ai(W, 0, { aggr: T.aggr0 || 1.6 }); else SIM.runPlans(W); fill(T, 1); if (T.auto0 !== false) fill(T, 0); }
    }
    return T;
  }
  // ===== الجو (W5b) [تقدير] =====
  // كل طرف: طيارات قتال (الإجمالي × نسبة الالتزام) بجودة جيلها، ومروحيات هجوم، ودفاع جوي (عدد المنظومات بجيلها).
  // كل يوم: معركة السيطرة الجوية (الحصة = قوتي ÷ مجموع القوتين)، بعدها الطلعات تضرب حسب المهمة، والخسائر حسب دفاع الخصم وطياراته.
  const AQ = g => .6 + .2 * (g || 2);   // جيل 2 = ×1، جيل 4 = ×1.4، جيل 5 = ×1.6
  function initAir(T, G, WD) {
    T.air = { A: [0, 0], H: [0, 0], AD: [0, 0], q: [1, 1], qa: [1, 1], sup: [.5, .5], lost: [0, 0], mode: ['cas', 'cas'], hits: [], kills: [0, 0] };
    for (const s of [0, 1]) for (const k of T.side[s]) {
      const cs = WD.cs[k]; if (!cs || !T.cells.some(c => c.own === k)) continue;
      const lead = k === T.side[s][0], cm = lead ? .7 : .3, live = G.C[k] ? Math.min(1, G.C[k].pw / G.C[k].pw0) : 1, gen = cs.gen || {};
      const a = (cs.air || 0) * cm * live; T.air.A[s] += a; T.air.H[s] += (cs.heli || 0) * cm * live;
      if (lead) { T.air.q[s] = AQ(gen.jet); T.air.qa[s] = AQ(gen.ad); }
      const adn = (cs.kit && cs.kit.ad && cs.kit.ad[0]) || 0; T.air.AD[s] += (Math.sqrt(adn * cm) * 4 + Math.sqrt(cs.mb || 0) * 5 * cm) * AQ(gen.ad || 3);   // المنظومات المعروفة + تقدير من الميزانية (باتريوت، S-300، ناسامز...)
    }
    T.air.A0 = T.air.A.slice();
  }
  function airDay(T, G, WD) {
    const W = T.W, A = T.air; A.hits = A.hits.filter(h => W.t - h[2] < 48);
    A.mode[1] = A.sup[1] < .25 && A.A[1] > 5 ? 'cap' : A.sup[1] > .6 ? 'deep' : 'cas';   // ذكاء الخصم: إذا خسران الجو يحمي، وإذا مسيطر يضرب العمق
    const E = [0, 1].map(s => A.A[s] * A.q[s]);
    for (const s of [0, 1]) { const o = 1 - s, cap = A.mode[s] === 'cap' ? 1.6 : 1; A.sup[s] = (E[s] * cap + 1) / (E[s] * cap + E[o] * (A.mode[o] === 'cap' ? 1.6 : 1) + 8 * A.AD[o] + 2); }   // الدفاع الجوي يمنع السيطرة الكاملة
    const wx = W.wx === 'dust' ? .2 : W.wx === 'rain' ? .7 : 1;
    for (const s of [0, 1]) {
      const o = 1 - s, sorties = A.A[s] * .8 * wx, share = A.mode[s] === 'cap' ? .25 : .7;
      // الضربات: الحصة الجوية تحدد شكد توصل؛ المروحيات تدعم الجبهة بس
      let pow = (sorties * share * A.sup[s] * A.q[s] + A.H[s] * .3 * A.sup[s]) * .02;
      if (pow > .05) {
        const enemy = W.divs.filter(d => !d.dead && d.side === o);
        let tg;
        if (A.mode[s] === 'deep') tg = enemy.filter(d => !W.cells[d.cell].nb.some(j => W.ctrl[j] === s)).map(d => d.cell);   // العمق: الاحتياط والتعزيزات
        if (!tg || !tg.length) { tg = [...W.battles.values()].map(b => b.tg).filter(c => enemy.some(d => d.cell === c)); if (!tg.length) tg = enemy.filter(d => W.cells[d.cell].nb.some(j => W.ctrl[j] === s)).map(d => d.cell); }
        tg = [...new Set(tg)].slice(0, 8);
        for (const c of tg) { SIM.airHit(W, s, c, pow / tg.length * 4); A.hits.push([c, s, W.t]); }
        // ضرب العمق يأذي اقتصاد الخصم شوية (مصافي، جسور، مصانع)
        if (A.mode[s] === 'deep' && G.C[T.side[o][0]]) G.C[T.side[o][0]].core *= 1 - .00004 * sorties * A.sup[s];
      }
      // الخسائر: دفاع الخصم الجوي وطياراته (أقل إذا عندنا السيطرة)
      const lossRate = .0015 + .004 * (A.AD[o] / (A.AD[o] + E[s] * .05 + 1)) * A.qa[o] / A.q[s] + .004 * (1 - A.sup[s]);
      const lost = Math.min(A.A[s], sorties * lossRate * (A.mode[s] === 'cap' ? .6 : 1));
      A.A[s] -= lost; A.lost[s] += lost; A.kills[o] += lost;
      A.H[s] = Math.max(0, A.H[s] - A.H[s] * .002 * (1 + A.AD[o] / 50));
      A.AD[s] = Math.max(0, A.AD[s] - (A.mode[o] === 'deep' ? .004 : .001) * A.AD[s] * A.sup[o] * 2);   // ضرب الدفاع الجوي (إخماد)
      // تعويض بطيء: 1٪ من الخسارة بالأسبوع لكل جيل (إنتاج وصيانة)
      A.A[s] = Math.min(A.A0[s], A.A[s] + A.A0[s] * .0006);
    }
  }
  // التقدّم بالفراغ: ذكاء «الحرب الكبرى» ما يدخل خلية فاضية تصير بروز؛ بالشبكة السداسية الجبهة مفتوحة أكثر،
  // فالفرقة المرتاحة تاخذ خلية عدو فاضية تجاورها إذا عندنا خليتين جنبها على الأقل (ما نفتح ثغرة ورانا)
  function fill(T, s) {
    const W = T.W, P = [0, 1].map(x => SIM.alive(W).filter(d => d.side === x).reduce((t, d) => t + SIM.power(d), 0));
    if (P[s] < P[1 - s] * 1.3) return;   // التقدّم بالفراغ بس للطرف الأقوى بوضوح
    const occ = new Map(); for (const d of W.divs) if (!d.dead) occ.set(d.cell, (occ.get(d.cell) || 0) | (1 << d.side));
    for (const d of W.divs) {
      if (d.dead || d.side !== s || d.path.length || d.mode !== 'auto' || d.org < d.orgMax * .6) continue;
      const here = W.divs.filter(x => !x.dead && x.side === s && x.cell === d.cell).length;
      const opt = W.cells[d.cell].nb.filter(j => W.ctrl[j] !== s && !((occ.get(j) || 0) & (1 << (1 - s))) && W.cells[j].nb.filter(k => W.ctrl[k] === s).length >= 2);
      if (!opt.length || (here < 2 && W.cells[d.cell].nb.some(j => (occ.get(j) || 0) & (1 << (1 - s))))) continue;
      opt.sort((a, b) => (W.cells[b].vp || 0) - (W.cells[a].vp || 0)); d.path = [opt[0]]; d.prog = 0;
    }
  }
  // السيطرة ترجع للخريطة: المنطقة لمنو يمسك أكثر من نص خلاياها (المسيطر = أول دولة من الطرف تجاور المنطقة، أو قائد الطرف)
  function sync(T, G, WD) {
    const cnt = new Map();
    T.cells.forEach((c, i) => { const s = T.W.ctrl[i]; for (const r of [c.reg, ...(c.extra || [])]) { const m = cnt.get(r) || [0, 0]; m[s]++; cnt.set(r, m); } });
    const changed = [];
    for (const [ri, m] of cnt) {
      const cur = G.ctl[ri], curS = T.side[0].includes(cur) ? 0 : T.side[1].includes(cur) ? 1 : -1, win = m[0] > m[1] ? 0 : m[1] > m[0] ? 1 : curS;
      if (win === curS || win < 0) continue;
      const home = WD.r[ri][1], who = T.side[win].includes(home) ? home : T.side[win][0];
      G.ctl[ri] = who; changed.push([WD.r[ri][0], who, cur]);
    }
    return changed;
  }
  function score(T) { const s = SIM.score(T.W); return { vp: s.vp, divs: s.divs, lost: s.lost, cells: s.cells, over: T.W.over }; }
  // الحفظ: الخلايا تنبني من جديد بنفس الطريقة؛ نحفظ بس الفرق والسيطرة والوقت
  function save(T) { const W = T.W; return { regs: T.regs, ctl0: T.ctl0, war: T.war, t: T.t, wt: W.t, ctrl: Array.from(W.ctrl), divs: W.divs.filter(d => !d.dead).map(d => ({ ...d, path: d.path.slice() })), lost: W.lost, took: W.took, ob: W.ob, over: W.over, rng: W.rnd.get(), nid: SIM.getNID(), mob: W.mob, num: W.num, cool: W.cool ? [...W.cool] : null, stalls: W.stalls, wx: W.wx, wxT: W.wxT, qual: W.qual, tob: T.ob, aggr0: T.aggr0, auto0: T.auto0, vp0: T.vp0, hour: W.hour, night: W.night, air: T.air, plans: W.plans, planId: W.planId, bridges: (W.bridges || []).map(b => b.down), seen: W.seen ? W.seen.map(a => Array.from(a, v => v < -1e8 ? null : v)) : null, snap: W.snap ? W.snap.map(m => [...m]) : null, dip: W.dip || null, hsMax: T.hsMax, target: T.target }; }
  function restore(o, G, WD, war, me) {
    const T = build(G, WD, war, me, { regs: o.regs, ctl0: o.ctl0, hsMax: o.hsMax, target: o.target }); if (!T) return null; const W = T.W;
    W.divs = o.divs.map(d => ({ ...d })); o.ctrl.forEach((s, i) => { if (i < W.N) W.ctrl[i] = s; }); W.t = o.wt; T.t = o.t; W.lost = o.lost; W.took = o.took; W.ob = o.ob; W.over = o.over; W.rnd.set(o.rng); SIM.setNID(Math.max(SIM.getNID(), o.nid)); W.mob = o.mob; W.num = o.num; if (o.cool) W.cool = new Map(o.cool); W.stalls = o.stalls; W.wx = o.wx; W.wxT = o.wxT; if (o.qual) W.qual = o.qual; T.ob = o.tob; T.aggr0 = o.aggr0; T.auto0 = o.auto0; T.vp0 = o.vp0; W.hour = o.hour; W.night = o.night; T.air = o.air; W.plans = o.plans || []; W.planId = o.planId || 1; if (o.bridges) o.bridges.forEach((d, i) => { if (W.bridges[i]) W.bridges[i].down = d; });
    if (o.seen) { W.seen = o.seen.map(a => Float64Array.from(a, v => v == null ? -1e9 : v)); W.snap = o.snap.map(e => new Map(e)); W.spots = [[], []]; } else SIM.intel(W);
    if (o.dip) W.dip = o.dip;   // W6: دبلوماسية الحرب (dip.js)
    SIM.supply(W); return T;
  }
  // ===== I-106: أرض الدولة وجيشها بالسلم («جيشك من أول يوم») =====
  // نفس الشبكة السداسية ونفس محرك «الحرب الكبرى»، بس بطرف واحد: كل مناطقنا المتصلة بالعاصمة (لحد 160)، وخلايا ~500 (أكبر للدول الكبيرة)،
  // والفرق من جيشنا الحقيقي كامل (أفراد عاملين، دبابات، مدرعات — نفس حساب army) بحد 70 للتلفون، موزعة: مشاة بالمدن، دروع وآليات حول العاصمة والحدود.
  const HOME = { id: 'home', n: 'جيشنا', a: [], b: [] };
  function home(G, WD, me) {
    const idx = new Map(WD.r.map((a, i) => [a[0], i]));
    let cap = WD.r.findIndex(a => G.ctl[WD.r.indexOf(a)] === me && a[12]); if (cap < 0) cap = G.ctl.findIndex(k => k === me); if (cap < 0) return null;
    const seen = new Map([[cap, 0]]), q = [cap];
    while (q.length) { const i = q.shift(); for (const n of WD.r[i][7]) { const j = idx.get(n); if (j != null && !seen.has(j) && G.ctl[j] === me) { seen.set(j, seen.get(i) + 1); q.push(j); } } }
    const regs = [...seen.keys()].sort((a, b) => seen.get(a) - seen.get(b) || (WD.r[b][10] || 0) - (WD.r[a][10] || 0)).slice(0, MAXREG);
    const war = { ...HOME, a: [me] };
    const T = build(G, WD, war, me, { regs, ctl0: Object.fromEntries(regs.map(r => [r, G.ctl[r]])), hsMax: 160, target: 500 }); if (!T) return null;
    homeArmy(T, G, WD); return T;
  }
  function homeArmy(T, G, WD) {
    const W = T.W, me = T.me, cs = WD.cs[me] || {}, live = G.C[me] ? Math.min(1.5, G.C[me].pw / G.C[me].pw0) : 1, g = cs.gen || {}, uav = (cs.tech || {}).uav || 1;
    W.qual[0] = { hard: .8 + (g.tank || 2) * .1, org: .9 + ((g.tank || 2) - 2) * .05 + uav * .02, atk: .85 + (g.jet || 2) * .06 + uav * .03 };
    const tanks = (cs.tanks || 0) * live, afv = ((cs.kit && cs.kit.afv && cs.kit.afv[0]) || (cs.tanks || 0) * 2.5) * live, men = (cs.act || 0) * live;
    const a = Math.floor(tanks / 240), m = Math.floor(Math.max(0, afv - a * 110) / 220), i = Math.max(1, Math.round((men - (a + m) * 9000) / 12000));
    const tot = a + m + i, f = tot > 70 ? 70 / tot : 1;
    T.raw = [{ inf: i, mec: m, arm: a }, { inf: 0, mec: 0, arm: 0 }];
    T.ob = [{ inf: Math.max(1, Math.round(i * f)), mec: Math.round(m * f), arm: Math.round(a * f), scale: 1 / f }, { inf: 0, mec: 0, arm: 0, scale: 1 }];
    // الأماكن: المدن (أكبر أول) للمشاة، والعاصمة والحدود للدروع والآليات؛ بحد 3 فرق بالخلية
    const N = T.cells.length, border = new Set(), idx = new Map(WD.r.map((r, j) => [r[0], j]));
    T.cells.forEach((c, k) => { if (WD.r[c.reg][7].some(n => G.ctl[idx.get(n)] !== me)) border.add(k); });   // خلايا مناطق الحدود
    const cities = T.cells.map((c, k) => k).filter(k => T.cells[k].vp).sort((x, y) => (T.cells[y].vp || 0) - (T.cells[x].vp || 0));
    const capK = cities[0] ?? 0, cnt = new Uint8Array(N);
    const near = (k, list) => list.filter(j => cnt[j] < 3).sort((x, y) => W.dist(k, x) - W.dist(k, y))[0];
    const put = (kind, k, num) => { const d = SIM.addDiv(W, 0, kind, k, num); d.ent = 1; cnt[k]++; return d; };
    let num = 1; const B = [...border], all = T.cells.map((c, k) => k);
    for (let n = 0; n < T.ob[0].inf; n++) { const k = cities.length ? cities[n % cities.length] : all[n % N]; put('inf', cnt[k] < 3 ? k : near(k, all) ?? k, num++); }
    // الدروع والآليات: بالتناوب على المدن (أكبر أول) ونقاط الحدود الموزعة (كل خامس خلية حدود)، فرقتين بالمكان بالأكثر
    const spots = []; const Bs = B.filter((k, j) => j % 5 === 0); for (let j = 0; j < Math.max(cities.length, Bs.length); j++) { if (cities[j] != null) spots.push(cities[j]); if (Bs[j] != null) spots.push(Bs[j]); }
    if (!spots.length) spots.push(capK); let sp = 0;
    for (const kind of ['arm', 'mec']) for (let n = 0; n < T.ob[0][kind]; n++) { let k = spots[sp++ % spots.length]; if (cnt[k] >= 2) k = near(k, all) ?? k; put(kind, k, num++); }
    SIM.supply(W); W.ob = [SIM.alive(W).length, 0]; SIM.intel(W);
    T.vp0 = [0, 0]; T.aggr0 = 99; T.auto0 = false;
  }
  const API = { build, step, sync, score, save, restore, HOPS, airDay, home, HOME };
  if (typeof module !== 'undefined') module.exports = API; else root.THEATER = API;
})(this);
