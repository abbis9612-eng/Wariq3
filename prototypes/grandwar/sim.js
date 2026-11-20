// «الحرب الكبرى» GW1.2 (I-080، D-039): محاكاة الحرب على المناطق، بالساعات. بدون رسم؛ تنفحص بـ Node (tests/sim.test.mjs).
// الفكرة مثل Hearts of Iron بس أبسط:
//  - كل فرقة بمنطقة. تتحرك لمنطقة جارة بسرعة حسب الأرض. إذا بيها عدو → معركة على الحد.
//  - المعركة كل ساعة: هجوم كل طرف (خفيف/ثقيل حسب درع العدو) ضد «صموده» (دفاع للمدافع، اختراق للمهاجم).
//    الضربات اللي تتجاوز الصمود تأذي أكثر (×4). الأذى ينزل التنظيم بسرعة والعدد (القوة) ببطء.
//  - المدافع اللي تنظيمه يخلص ينسحب لمنطقة صديقة؛ إذا ما عنده وين (مطوّق) يستسلم. المهاجم اللي يخلص تنظيمه يوقف.
//  - المنطقة تصير لك من توصلها. الإمداد يمشي من مدنك الكبيرة على مناطقك؛ المقطوع يضعف.
//  - الذكاء: نفس القواعد للطرفين. يمسك الجبهة، يهاجم بس لما يكون أقوى بوضوح، ويدز الاحتياط للثغرات.
(function (root) {
  const TEMPL = {
    //        خفيف  ثقيل  دفاع  اختراق  درع  تنظيم  سرعة كم/س  جنود  دبابات مدرعات مدافع
    inf: { soft: 9, hard: 1.6, def: 28, brk: 6, hd: .05, org: 60, spd: 4, men: 10000, tk: 0, ifv: 30, gun: 54 },
    mec: { soft: 12, hard: 6, def: 30, brk: 18, hd: .55, org: 50, spd: 8, men: 9000, tk: 90, ifv: 220, gun: 54 },
    arm: { soft: 13, hard: 13, def: 20, brk: 32, hd: .8, org: 40, spd: 9, men: 8000, tk: 240, ifv: 110, gun: 36 },
  };
  const KIND_N = { inf: 'مشاة', mec: 'آلية', arm: 'مدرعة' };
  // الأرض: هجوم المهاجم، سرعة الحركة، عرض الجبهة (كم فرقة تهاجم مرة وحدة)، وعقوبة إضافية للدروع
  const TERR = {
    plain: { atk: 1, spd: 1, w: 4, armor: 1, n: 'سهل' }, desert: { atk: 1, spd: .9, w: 4, armor: 1, n: 'صحرا' },
    hills: { atk: .78, spd: .7, w: 3, armor: .85, n: 'تلال' }, mount: { atk: .55, spd: .45, w: 2, armor: .6, n: 'جبال' },
    marsh: { atk: .55, spd: .4, w: 2, armor: .55, n: 'أهوار' }, city: { atk: .7, spd: .8, w: 3, armor: .65, n: 'مدينة' },
  };
  const RIVER_ATK = .7, RIVER_SPD = .6;
  // GW8: معنويات الشعب تحت 50 = التنظيم يرجع أبطأ بالراحة
  const morF = (W, s) => !W.eco ? 1 : W.eco[s].mor >= 50 ? 1 : .6 + .4 * W.eco[s].mor / 50;
  const K_ORG = 1.0, K_STR = .0035;

  // مولّد أرقام عشوائية بحالة تنحفظ (GW7): نفس الحالة = نفس الحرب بالضبط بعد التحميل
  function mulberry(a) { const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; f.get = () => a; f.set = v => { a = v; }; return f; }

  function World(C, opt = {}) {
    const cells = C.cells, N = cells.length;
    const edgeOf = new Map(); // "i,j" → {river, seg}
    for (const [i, j, r, seg] of C.edges) { edgeOf.set(i + ',' + j, { r, seg }); edgeOf.set(j + ',' + i, { r, seg }); }
    const dist = (a, b) => Math.hypot(cells[a].c[0] - cells[b].c[0], cells[a].c[1] - cells[b].c[1]);
    const W = {
      cells, N, edgeOf, dist, t: 0, rnd: mulberry(opt.seed || 1), ctrl: new Int8Array(N), divs: [], battles: new Map(),
      log: [], sup: [new Uint8Array(N), new Uint8Array(N)], qual: [{ hard: 1.15, org: 1.1, atk: 1.1 }, { hard: .9, org: 1, atk: 1 }], lost: [0, 0], took: [0, 0],
    };
    for (let i = 0; i < N; i++) W.ctrl[i] = cells[i].s;
    // R5b: الطرق والجسور (roads.js من Natural Earth). بدونها الإمداد يمشي مثل قبل
    const R = opt.roads; W.road = new Map(); W.bridges = []; W.bridgeOf = new Map();
    if (R) { for (const [i, j, c] of R.e) { W.road.set(i + ',' + j, c); W.road.set(j + ',' + i, c); }
      R.br.forEach(([i, j, x, y, n], k) => { W.bridges.push({ k, i, j, p: [x, y], n, down: 0 }); W.bridgeOf.set(i + ',' + j, k); W.bridgeOf.set(j + ',' + i, k); }); } else W.noRoads = true;
    W.vpTotal = [0, 0]; for (const c of cells) if (c.vp) W.vpTotal[c.s] += c.vp;
    return W;
  }

  let NID = 1;
  function addDiv(W, side, kind, cell, num) {
    const T = TEMPL[kind];
    const d = { id: NID++, side, kind, num, n: `${side ? 'الفرقة' : 'الفرقة'} ${num} ${KIND_N[kind]}`, cell, str: 1, org: T.org * W.qual[side].org, orgMax: T.org * W.qual[side].org, ent: 0, path: [], prog: 0, mode: 'auto', exp: 0, lastFight: -999, dead: false };
    W.divs.push(d); return d;
  }
  const alive = W => W.divs.filter(d => !d.dead);
  const divsIn = (W, cell) => W.divs.filter(d => !d.dead && d.cell === cell);

  // قوة الهجوم لفرقة على منطقة (مع الأرض والنهر والإمداد والتنظيم)
  function atkOf(W, d, tgtCell, fromCell, enemyHd) {
    const T = TEMPL[d.kind], tr = TERR[W.cells[tgtCell].t];
    let a = (T.soft * (1 - enemyHd) + T.hard * W.qual[d.side].hard * enemyHd) * d.str * W.qual[d.side].atk;
    a *= tr.atk * (d.kind === 'inf' ? 1 : tr.armor);
    if (fromCell != null && W.edgeOf.get(fromCell + ',' + tgtCell)?.r) a *= RIVER_ATK;
    if (!W.sup[d.side][d.cell]) a *= .6;
    a *= .5 + .5 * Math.min(1, d.org / d.orgMax * 1.25);
    if (d.kind !== 'inf' && W.indF) a *= W.indF[d.side].armAtk;   // C4: بحث الدروع والسلاح الوطني
    return a;
  }
  const hdOf = ds => ds.length ? ds.reduce((s, d) => s + TEMPL[d.kind].hd * d.str, 0) / ds.reduce((s, d) => s + d.str, 0) : 0;
  function hits(power, cap) { return power <= cap ? power * .1 : cap * .1 + (power - cap) * .4; }

  // الإمداد: من المدن الكبيرة اللي بعدها بيدك، على مناطقك
  // كلفة عبور حد للإمداد: طريق سريع 1، طريق 1.5، بلا طريق 3.5 (شاحنات بالبر)؛ نهر بلا جسر سالم +4 (عبّارات/جسور عائمة)
  const SUP_BUDGET = 15;
  function edgeCost(W, a, b) {
    const r = W.road.get(a + ',' + b); let c = r === 2 ? 1 : r === 1 ? 1.5 : 3.5;
    if (W.edgeOf.get(a + ',' + b)?.r) { const k = W.bridgeOf.get(a + ',' + b); if (k == null || W.bridges[k].down > 0) c += 4; }
    return c;
  }
  const bridgeOK = (W, a, b) => { const k = W.bridgeOf.get(a + ',' + b); return k != null && !(W.bridges[k].down > 0); };
  function supply(W) {
    if (W.allSup) { W.sup[0].fill(1); W.sup[1].fill(1); return; }
    if (!W.noRoads) { // R5b: الإمداد يمشي على الطرق والجسور من المدن الكبيرة، لحد «ميزانية» 15
      W.supC = W.supC || [new Float32Array(W.N), new Float32Array(W.N)];
      for (const s of [0, 1]) {
        const C = W.supC[s]; C.fill(1e9); const sup = W.sup[s]; sup.fill(0); const q = [];
        W.cells.forEach((c, i) => { if (W.ctrl[i] === s && c.s === s && (c.vp || 0) >= 3) { C[i] = 0; q.push(i); } });
        while (q.length) { let bi = 0; for (let k = 1; k < q.length; k++) if (C[q[k]] < C[q[bi]]) bi = k; const i = q.splice(bi, 1)[0]; if (C[i] > SUP_BUDGET + (W.indF ? W.indF[s].sup : 0) + (s === 0 && W.homeF ? W.homeF.sup : 0)) continue; sup[i] = 1;
          for (const j of W.cells[i].nb) if (W.ctrl[j] === s) { const nc = C[i] + edgeCost(W, i, j); if (nc < C[j]) { if (C[j] === 1e9) q.push(j); C[j] = nc; } } }
      }
      return;
    }
    for (const s of [0, 1]) {
      const sup = W.sup[s]; sup.fill(0); const q = [];
      W.cells.forEach((c, i) => { if (W.ctrl[i] === s && c.s === s && (c.vp || 0) >= 3) { sup[i] = 1; q.push(i); } });
      while (q.length) { const i = q.pop(); for (const j of W.cells[i].nb) if (!sup[j] && W.ctrl[j] === s) { sup[j] = 1; q.push(j); } }
    }
  }

  // ===== الليل والطقس (R5c، I-088) =====
  // الساعة الحقيقية (اللعبة تبدي 06:00، 14 آذار): ليل 19:00–05:00. الطقس يتغير كل ساعة (سلسلة ماركوف) [تقدير]:
  // صافي ← غيم (~مرتين بالأسبوع، 4–12 س)، مطر (~مرة بالأسبوع بآذار، 6–18 س)، عاصفة غبار (~مرة كل 10 أيام، 12–36 س)
  const WX = { clear: { n: 'صافي', atk: 1, mv: 1, air: 1, obs: 1 }, cloud: { n: 'غيوم', atk: 1, mv: 1, air: .85, obs: .9 },
    rain: { n: 'مطر وطين', atk: .9, mv: .8, air: .8, obs: .7 }, dust: { n: 'عاصفة غبار', atk: .75, mv: .7, air: 0, obs: .3 } };
  function weather(W) {
    W.hour = (6 + W.t) % 24; W.night = W.hour >= 19 || W.hour < 5;
    if (!W.wx) { W.wx = 'clear'; W.wxT = 0; }
    if (W.wxT > 0) { W.wxT--; if (W.wxT === 0) { W.wx = 'clear'; W.log.push({ t: W.t, k: 'wx', wx: 'clear' }); } return; }
    if (W.wx !== 'clear') return; const r = W.rnd();
    const set = (wx, a, b) => { W.wx = wx; W.wxT = a + Math.floor(W.rnd() * (b - a)); W.log.push({ t: W.t, k: 'wx', wx, h: W.wxT }); };
    if (r < .004) set('dust', 12, 36); else if (r < .010) set('rain', 6, 18); else if (r < .022) set('cloud', 4, 12);
  }
  // معامل الهجوم: الليل يضعف الهجوم (العراق عنده مناظير حرارية أحدث بالأبرامز ×0.9، إيران ×0.8) والطقس
  const envAtk = (W, side) => (W.night ? (side ? .8 : .9) : 1) * (WX[W.wx || 'clear'].atk);
  const envMv = W => (W.night ? .8 : 1) * WX[W.wx || 'clear'].mv;

  // ===== الاستخبارات (R5d، I-088): كل طرف يعرف بس اللي يشوفه =====
  // يشوف: مناطق فرقه والجارة إلها (تماس)، مراصد الحدود (أحياناً)، المعارك، ونقاط الاستطلاع من الجو (W.spots من air.js).
  // اللي شافه ينحفظ «لقطة» (عدد الفرق ونوعها وقوتها ساعتها) وتعتق؛ اللي ما شافه ما يعرفه. الذكاء يقرر بنفس المعلومات.
  function initIntel(W) { W.seen = [new Float64Array(W.N).fill(-1e9), new Float64Array(W.N).fill(-1e9)]; W.snap = [new Map(), new Map()]; W.spots = W.spots || [[], []]; }
  function intel(W) {
    if (!W.seen) initIntel(W);
    const byCell = new Map(); for (const d of W.divs) if (!d.dead) { if (!byCell.has(d.cell)) byCell.set(d.cell, []); byCell.get(d.cell).push(d); }
    for (const s of [0, 1]) {
      const obs = new Uint8Array(W.N);
      for (const d of W.divs) if (!d.dead && d.side === s) { obs[d.cell] = 1; for (const j of W.cells[d.cell].nb) obs[j] = 1; }
      for (let i = 0; i < W.N; i++) if (W.ctrl[i] === s) for (const j of W.cells[i].nb) if (!obs[j] && W.ctrl[j] !== s && W.rnd() < .2 * (W.night ? .5 : 1) * WX[W.wx || 'clear'].obs) obs[j] = 1;   // مراصد ودوريات الحدود (الليل والغبار يقللونها)
      for (const [x, y, r] of W.spots[s]) for (let i = 0; i < W.N; i++) { const c = W.cells[i].c; if (Math.abs(c[0] - x) < r && Math.abs(c[1] - y) < r && Math.hypot(c[0] - x, c[1] - y) < r) obs[i] = 1; }
      W.spots[s].length = 0;
      for (const b of W.battles.values()) { obs[b.tg] = 1; for (const f of b.from) obs[f] = 1; }
      const SN = W.snap[s];
      for (let i = 0; i < W.N; i++) {
        if (!obs[i]) continue; W.seen[s][i] = W.t;
        const en = (byCell.get(i) || []).filter(d => d.side !== s);
        if (en.length) SN.set(i, { t: W.t, divs: en.map(d => ({ id: d.id, kind: d.kind, str: d.str, org: d.org, orgMax: d.orgMax, ent: d.ent, n: d.n, side: d.side })) }); else SN.delete(i);
      }
      for (const [c, sn] of SN) if (W.t - sn.t > 120) SN.delete(c);
    }
  }
  // العدو اللي يعرفه الطرف s: الطازج (شافه هالساعتين) حقيقي، والقديم لقطة بمكانها القديم
  function known(W, s) {
    if (W.noFog || ezIntel(W, s) || !W.seen) return alive(W).filter(d => d.side !== s);
    const out = [], fresh = new Set();
    for (const d of W.divs) if (!d.dead && d.side !== s && W.t - W.seen[s][d.cell] <= 2) { out.push(d); fresh.add(d.cell); }
    for (const [c, sn] of W.snap[s]) if (!fresh.has(c) && W.t - sn.t <= 96) for (const q of sn.divs) out.push({ ...q, cell: c, ghost: W.t - sn.t });
    return out;
  }
  const ezIntel = (W, s) => s === 0 && ((W.cfg && W.cfg.ez && W.cfg.ez.on && W.cfg.ez.intel) || (W.dip && W.dip.reveal > W.t));   // + C7: عملية الكشف   // GW11 B4: الوضع الخاص «كشف كامل» للاعب
  const isSeen = (W, s, cell, h = 2) => W.noFog || ezIntel(W, s) || !W.seen || W.t - W.seen[s][cell] <= h;

  // ساعة وحدة
  // GW10: هدنة = ما اكو هجوم (الحركة بأرضنا بس)
  const inTruce = W => !!(W.dip && W.dip.truce > W.t);
  function step(W) {
    W.t++;
    if (inTruce(W)) for (const d of W.divs) if (!d.dead && d.path.length && W.ctrl[d.path[0]] !== d.side) { d.path = []; d.prog = 0; if (d.mode === 'manual') d.mode = 'hold'; }
    weather(W);
    for (const b of W.bridges) if (b.down > 0) { b.down = Math.max(0, b.down - (W.indF ? W.indF[W.ctrl[b.i]].br : 1)); if (b.down === 0) W.log.push({ t: W.t, side: b.by, k: 'bridgefix', cell: b.i, n: b.n }); }   // C5: النقل يصلّح أسرع
    if (W.t % 6 === 1) supply(W);
    if (!W.noFog) intel(W);
    const D = alive(W);
    const byCell = new Map(); for (const d of D) { if (!byCell.has(d.cell)) byCell.set(d.cell, []); byCell.get(d.cell).push(d); }
    // المعارك: كل فرقة هدفها الجاي منطقة بيها عدو
    const fights = new Map();
    for (const d of D) {
      if (!d.path.length) continue; const tg = d.path[0];
      const en = (byCell.get(tg) || []).filter(e => e.side !== d.side);
      if (!en.length) continue;
      if (!fights.has(tg)) fights.set(tg, { tg, att: [], def: en, side: d.side });
      const f = fights.get(tg); if (f.side === d.side) f.att.push(d);
    }
    const seen = new Set();
    for (const f of fights.values()) {
      seen.add(f.tg);
      const tr = TERR[W.cells[f.tg].t];
      // عرض الجبهة: أقوى الفرق تدخل، الباقي ينتظر
      f.att.sort((a, b) => b.str * b.org - a.str * a.org); const A = f.att.slice(0, tr.w + 1 + (new Set(f.att.map(a => a.cell)).size > 1 ? 1 : 0));
      const Dd = f.def.slice(0, tr.w + 2);
      const hA = hdOf(A), hD = hdOf(Dd);
      const flank = new Set(A.map(a => a.cell)).size > 1 ? 1.15 : 1;
      const luck = .85 + W.rnd() * .3;
      let aPow = A.reduce((s, a) => s + atkOf(W, a, f.tg, a.cell, hD), 0) * flank * luck * envAtk(W, f.side);
      let dPow = Dd.reduce((s, d) => s + atkOf(W, d, f.tg, null, hA) / TERR[W.cells[f.tg].t].atk * (d.kind === 'inf' ? 1 : 1 / tr.armor), 0) * (1.15 - (luck - 1));
      const dCap = Dd.reduce((s, d) => s + TEMPL[d.kind].def * d.str * (1 + .6 * d.ent) * (W.sup[d.side][d.cell] ? 1 : .6), 0);
      const aCap = A.reduce((s, a) => s + TEMPL[a.kind].brk * a.str, 0);
      const hOnD = hits(aPow, dCap), hOnA = hits(dPow, aCap);
      for (const d of Dd) { const share = 1 / Dd.length; d.org = Math.max(0, d.org - hOnD * share * K_ORG); d.str = Math.max(.02, d.str - hOnD * share * K_STR); d.lastFight = W.t; }
      for (const a of A) { const share = 1 / A.length; a.org = Math.max(0, a.org - hOnA * share * K_ORG); a.str = Math.max(.02, a.str - hOnA * share * K_STR); a.lastFight = W.t; }
      // سجل المعركة للرسم والتقرير
      let b = W.battles.get(f.tg); if (!b) { b = { tg: f.tg, side: f.side, t0: W.t, from: new Set() }; W.battles.set(f.tg, b); }
      b.t = W.t; A.forEach(a => b.from.add(a.cell));
      const aO = A.reduce((s, a) => s + a.org / a.orgMax, 0) / A.length, dO = Dd.reduce((s, d) => s + d.org / d.orgMax, 0) / Dd.length;
      b.win = aO / (aO + dO + 1e-6); b.why = { aPow, dPow, dCap, aCap, terr: W.cells[f.tg].t, river: A.some(a => W.edgeOf.get(a.cell + ',' + f.tg)?.r), flank: flank > 1 };
      b.na = A.length; b.nd = Dd.length;
      // المهاجم اللي خلص تنظيمه يوقف
      for (const a of A) if (a.org < 1) { a.path = []; a.prog = 0; W.cool = W.cool || new Map(); W.cool.set(a.side + ':' + f.tg, W.t + 72); W.stalls = (W.stalls || 0) + 1; if (a.mode === 'plan') { } else if (a.mode === 'manual') { a.mode = 'hold'; W.log.push({ t: W.t, side: a.side, k: 'stall', div: a.n, cell: f.tg }); } }
      // المدافع اللي خلص تنظيمه ينسحب أو يستسلم
      for (const d of f.def) if (d.org < 1) retreat(W, d, byCell);
    }
    for (const k of [...W.battles.keys()]) if (!seen.has(k)) W.battles.delete(k);
    if (W.t % 24 === 0) daily(W);
    // الحركة
    for (const d of D) {
      if (d.dead) continue;
      if (!d.path.length) { // راحة: تنظيم وتحصين وتعويض
        d.ent = Math.min(1, d.ent + 1 / 96);
        if (W.t - d.lastFight > 6 && W.sup[d.side][d.cell]) { d.org = Math.min(d.orgMax, d.org + d.orgMax / 40 * morF(W, d.side) * (d.side === 0 && W.homeF ? W.homeF.org : 1)); d.str = Math.min(1, d.str + .0012 * (W.partsF ? W.partsF[d.side][d.kind] ?? 1 : 1)); }   // C2: قطع الغيار   // C6: الجيش الزعلان يرتاح أبطأ
        if (!W.sup[d.side][d.cell]) { d.str = Math.max(.05, d.str - .0008); d.org = Math.max(0, Math.min(d.org, d.orgMax * .5)); }
        continue;
      }
      d.ent = 0;
      if (W.t - d.lastFight > 6 && W.sup[d.side][d.cell]) d.org = Math.min(d.orgMax, d.org + d.orgMax / 120);
      const tg = d.path[0];
      const en = (byCell.get(tg) || []).filter(e => e.side !== d.side && !e.dead);
      if (en.length) continue; // بعده يقاتل
      const tr = TERR[W.cells[tg].t]; const T = TEMPL[d.kind];
      // سرعات حقيقية (I-084): المسير ورا الخطوط بسرعة الرتل (معدل اليوم: دروع ~200 كم/يوم)،
      // أما التقدّم بأرض العدو فبطيء: استطلاع، ألغام، تطهير، وقفات (دروع ~45 كم/يوم، مشاة ~20)
      const adv = W.ctrl[tg] !== d.side ? (d.kind === 'inf' ? .2 : .22) : 1;
      const rd = W.road.get(d.cell + ',' + tg), v = T.spd * tr.spd * adv * (W.edgeOf.get(d.cell + ',' + tg)?.r && !bridgeOK(W, d.cell, tg) ? RIVER_SPD : 1) * (rd === 2 ? 1.5 : rd === 1 ? 1.25 : 1) * (W.sup[d.side][d.cell] ? 1 : .5) * envMv(W); // الطريق أسرع، والجسر السالم ما يأخّر؛ الليل والطقس أبطأ
      d.prog += v; d.v = v;
      if (d.prog >= W.dist(d.cell, tg)) {
        d.prog = 0; byCell.get(d.cell)?.splice(byCell.get(d.cell).indexOf(d), 1);
        d.cell = tg; d.path.shift(); d.arrT = W.t; if (!byCell.has(tg)) byCell.set(tg, []); byCell.get(tg).push(d);
        if (W.ctrl[tg] !== d.side) { W.ctrl[tg] = d.side; W.took[d.side]++; if (W.cells[tg].vp) W.log.push({ t: W.t, side: d.side, k: 'take', cell: tg }); }
        if (!d.path.length && d.mode === 'manual') d.mode = 'hold';
      }
    }
  }

  // كل يوم: تعبئة (فرقة جديدة كل 8 أيام إذا الجيش أقل من حجمه الأصلي) وفحص الاستسلام
  function daily(W) {
    // GW11 B4: الحرب بمدة: تخلص بنهاية المدة ويطلع التقييم
    if (W.cfg && W.cfg.dur && !W.over && W.t >= W.cfg.dur * 24) { W.over = { t: W.t, end: 'dur', loser: -1 }; W.log.push({ t: W.t, k: 'warend' }); }
    for (const s of [0, 1]) {
      const n = alive(W).filter(d => d.side === s).length;
      W.mob = W.mob || [0, 0]; W.ob = W.ob || [n, n];
      if (!W.eco && n < W.ob[s] && W.t - W.mob[s] >= 24 * 8) { // GW8: مع الاقتصاد الفرق الجديدة تنشترى (econ.js)
        let best = -1, bv = -1; W.cells.forEach((c, i) => { if (W.ctrl[i] === s && c.s === s && W.sup[s][i] && (c.vp || 0) > bv) { bv = c.vp || 0; best = i; } });
        if (best >= 0) { W.mob[s] = W.t; W.num = W.num || [100, 200]; const d = addDiv(W, s, 'inf', best, W.num[s]++); d.org = d.orgMax * .5; d.str = .7; joinArmy(W, d); W.log.push({ t: W.t, side: s, k: 'mob', div: d.n, cell: best }); }
      }
      // استسلام: إذا الدولة خسرت 70% من نقاط مدنها
      const own = W.cells.reduce((v, c, i) => v + (c.s === s && W.ctrl[i] === s ? (c.vp || 0) : 0), 0);
      // GW8: الشعب المنهار (معنويات تحت 25) يستسلم أبكر، وإذا وصلت صفر الدولة تنهار
      const mor = W.eco ? W.eco[s].mor : 50;
      if (s === 0 && W.cfg && W.cfg.ez && W.cfg.ez.on && W.cfg.ez.immune) continue;   // الوضع الخاص: حصانة من الاستسلام
      if (!W.over && (own <= W.vpTotal[s] * (mor < 25 ? .45 : .3) || mor <= 0)) { W.over = { t: W.t, loser: s, why: mor <= 0 ? 'mor' : 'vp' }; W.log.push({ t: W.t, side: s, k: 'capitulate', why: W.over.why }); }
    }
  }
  function retreat(W, d, byCell) {
    const opts = W.cells[d.cell].nb.filter(j => W.ctrl[j] === d.side && !(byCell.get(j) || []).some(e => e.side !== d.side));
    if (!opts.length) { d.dead = true; W.lost[d.side]++; W.log.push({ t: W.t, side: d.side, k: 'surrender', div: d.n, cell: d.cell }); return; }
    // ابعد مكان عن العدو، ويفضّل المزود
    const score = j => (W.sup[d.side][j] ? 2 : 0) - W.cells[j].nb.filter(k => W.ctrl[k] !== d.side).length;
    opts.sort((a, b) => score(b) - score(a));
    byCell.get(d.cell)?.splice(byCell.get(d.cell).indexOf(d), 1);
    d.cell = opts[0]; d.path = []; d.prog = 0; d.ent = 0; d.org = Math.max(d.org, 2);
    if (!byCell.has(d.cell)) byCell.set(d.cell, []); byCell.get(d.cell).push(d);
    W.log.push({ t: W.t, side: d.side, k: 'retreat', div: d.n, cell: d.cell });
  }

  // طريق بأقل وقت: على مناطقك، وآخر خطوة ممكن تكون منطقة عدو جارة
  function route(W, d, goal, deep) {
    const N = W.N, best = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1); best[d.cell] = 0;
    const open = [d.cell];
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (best[open[k]] < best[open[bi]]) bi = k;
      const i = open.splice(bi, 1)[0]; if (i === goal) break;
      for (const j of W.cells[i].nb) {
        const foe = W.ctrl[j] !== d.side; if (foe && j !== goal && !deep) continue;
        const c = best[i] + W.dist(i, j) / (TEMPL[d.kind].spd * TERR[W.cells[j].t].spd) * (foe ? 3 : 1);
        if (c < best[j]) { if (best[j] === Infinity) open.push(j); best[j] = c; prev[j] = i; }
      }
    }
    if (best[goal] === Infinity) return null;
    const p = []; for (let i = goal; i !== d.cell; i = prev[i]) p.unshift(i); return p;
  }
  function order(W, d, goal, mode = 'manual', deep = false) { if (!(goal >= 0 && goal < W.N)) return false; if (goal === d.cell) { d.path = []; d.mode = 'hold'; return true; } const p = route(W, d, goal, deep); if (!p) return false; d.path = p; d.prog = 0; d.mode = mode; return true; }

  // ===== الذكاء (نفس القواعد للطرفين) =====
  function frontCells(W, s) { const F = []; for (let i = 0; i < W.N; i++) if (W.ctrl[i] === s && W.cells[i].nb.some(j => W.ctrl[j] !== s)) F.push(i); return F; }
  const power = d => (TEMPL[d.kind].soft + TEMPL[d.kind].def * .5) * d.str * (d.org / d.orgMax);
  function ai(W, s, opt = {}) {
    if (s === 0) runPlans(W);
    const aggr = opt.aggr ?? (s === 1 && W.cfg ? DIFF[W.cfg.diff || 'mid'].aggr : 1.6);
    const D = alive(W); const mine = D.filter(d => d.side === s), theirs = known(W, s); // الذكاء يقرر بالمعلومات اللي عنده بس
    const enemyAt = new Map(); for (const e of theirs) enemyAt.set(e.cell, (enemyAt.get(e.cell) || 0) + power(e));
    const mineAt = new Map(); for (const d of mine) { if (!mineAt.has(d.cell)) mineAt.set(d.cell, []); mineAt.get(d.cell).push(d); }
    const F = frontCells(W, s);
    const threat = i => W.cells[i].nb.reduce((t, j) => t + (W.ctrl[j] !== s ? (enemyAt.get(j) || 0) : 0), 0) + (W.cells[i].vp || 0) * 2;
    // 1) هجوم: لكل منطقة عدو جارة، شوف شكد نقدر نجمع عليها
    const cand = new Map();
    for (const i of F) for (const j of W.cells[i].nb) if (W.ctrl[j] !== s && !cand.has(j)) cand.set(j, 1);
    const used = new Set(D.filter(d => d.side === s && d.path.length).map(d => d.id));
    const targets = [];
    for (const j of cand.keys()) {
      let def = theirs.filter(e => e.cell === j);
      // منطقة عدو ما شفناها من يوم: نفترض بيها فرقة (الحذر)، ما نمشي لها كأنها فاضية
      if (!def.length && !isSeen(W, s, j, 24)) def = [{ kind: 'inf', str: .7, org: 42, orgMax: 60, ent: 0, guess: 1 }];
      const tr = TERR[W.cells[j].t];
      const dVal = def.reduce((t, e) => t + TEMPL[e.kind].def * e.str * (1 + .6 * e.ent) * (e.org / e.orgMax + .3), 0);
      const avail = [];
      for (const i of W.cells[j].nb) if (W.ctrl[i] === s) for (const d of (mineAt.get(i) || [])) if (d.mode === 'auto' && !used.has(d.id) && d.org > d.orgMax * .7 && d.str > .45 && !(W.armies && W.armies[d.army]?.stance === 'defend')) avail.push(d);
      if (!avail.length) continue;
      const aVal = avail.reduce((t, d) => t + atkOf(W, d, j, d.cell, def.length ? hdOf(def) : 0), 0) * envAtk(W, s); // الذكاء يعرف الليل والطقس (يفضّل يهاجم بالنهار والصحو)
      const ratio = def.length ? aVal / (dVal * .1 + .001) : 99;
      // ما نتقدم لمنطقة فاضية إذا راح تصير بروز (أغلب جيرانها للعدو): نخلي الخط مستقيم
      const ownNb = W.cells[j].nb.filter(k => W.ctrl[k] === s).length;
      if (!def.length && ownNb * 2 < W.cells[j].nb.length && !(W.cells[j].s === s)) continue;
      const gain = (W.cells[j].vp || 0) * 3 + 1 + (W.cells[j].s === s ? 3 : 0);
      targets.push({ j, def, avail, ratio, score: ratio * gain });
    }
    targets.sort((a, b) => b.score - a.score); if (inTruce(W)) targets.length = 0;
    for (const T of targets) {
      if (T.ratio < (T.def.length ? aggr : 0)) continue;
      if (W.cool && (W.cool.get(s + ':' + T.j) || 0) > W.t) continue; // هجوم فشل هنا قريب: لا تعيده هسه
      const tr = TERR[W.cells[T.j].t];
      let n = 0;
      for (const d of T.avail) {
        if (used.has(d.id)) continue; if (n >= tr.w + 1) break;
        // لا تفرّغ منطقة جبهة عليها تهديد
        const stay = (mineAt.get(d.cell) || []).filter(x => !used.has(x.id) && x !== d).length;
        if (stay === 0 && threat(d.cell) > 4 && T.def.length) continue;
        if (!T.def.length && stay === 0 && threat(d.cell) > 0) continue;
        d.path = [T.j]; d.prog = 0; used.add(d.id); n++;
      }
    }
    // 2) دفاع: كل منطقة جبهة يكون بيها شي حسب التهديد، والاحتياط يروح للمحتاج
    const incoming = new Map(); for (const d of mine) if (d.path.length && W.ctrl[d.path[d.path.length - 1]] === s) { const e = d.path[d.path.length - 1]; incoming.set(e, (incoming.get(e) || 0) + 1); }
    const need = F.map(i => ({ i, t: threat(i), have: (mineAt.get(i) || []).filter(d => !used.has(d.id) || !d.path.length).length + (incoming.get(i) || 0) }));
    // العمق: المدن المهمة القريبة من الجبهة تبقى بيها حامية (حتى الثغرة ما توصل للمدينة فاضية)
    const Fs = new Set(F);
    for (let i = 0; i < W.N; i++) if (W.ctrl[i] === s && !Fs.has(i) && (W.cells[i].vp || 0) >= 3 && F.some(f => W.dist(f, i) < 110))
      need.push({ i, t: 25, have: (mineAt.get(i) || []).filter(d => !used.has(d.id) || !d.path.length).length + (incoming.get(i) || 0), depth: 1 });
    const needSet = new Set(need.map(n => n.i)); const free = mine.filter(d => d.mode === 'auto' && !used.has(d.id) && !d.path.length && !needSet.has(d.cell) && W.t - (d.arrT || -99) >= 24);
    // فائض الجبهة الهادية
    for (const i of F) { const here = (mineAt.get(i) || []).filter(d => d.mode === 'auto' && !used.has(d.id) && !d.path.length); const want = Math.max(1, Math.round(threat(i) / 25)); const settled = here.filter(d => W.t - (d.arrT || -99) >= 48); if (here.length > want + 2) free.push(...settled.slice(0, here.length - want - 2)); }
    need.sort((a, b) => (a.have - a.t / 25) - (b.have - b.t / 25));
    for (const nd of need) {
      const want = Math.max(1, Math.min(4, Math.round(nd.t / 25)));
      while (nd.have < want && free.length) {
        // أقرب فرقة حرة
        let bk = 0, bd = Infinity; free.forEach((d, k) => { const dd = W.dist(d.cell, nd.i); if (dd < bd) { bd = dd; bk = k; } });
        const d = free.splice(bk, 1)[0]; if (d.cell !== nd.i && !order(W, d, nd.i, 'auto')) continue; d.mode = 'auto'; nd.have++;
      }
    }
  }

  // ===== GW11 B4: الصعوبة والإعدادات =====
  // aggr: قد شنو الذكاء الإيراني يجرأ يهاجم (أقل = أجرأ)؛ atk/org: جودة الجيش الإيراني؛ cash/mor: إضافة لخزينة العراق ومعنوياته
  const DIFF = { easy: { n: 'سهل', aggr: 1.9, atk: .9, org: .92, cash: 10, mor: 8 }, mid: { n: 'متوسط', aggr: 1.6, atk: 1, org: 1, cash: 0, mor: 0 }, hard: { n: 'صعب', aggr: 1.4, atk: 1.1, org: 1.06, cash: -5, mor: -5 } };
  function applyCfg(W, cfg) {
    W.cfg = { diff: 'mid', dur: 0, ez: {}, ...cfg }; const D = DIFF[W.cfg.diff] || DIFF.mid;
    W.qual[1].atk *= D.atk; W.qual[1].org *= D.org; for (const d of W.divs) if (d.side === 1) { d.orgMax *= D.org; d.org = Math.min(d.org * D.org, d.orgMax); }
    if (W.eco) { W.eco[0].cash += D.cash; W.eco[0].mor = Math.max(0, Math.min(100, W.eco[0].mor + D.mor)); }
    return W;
  }
  // ===== السيناريو: العراق ضد إيران، آذار 2027 =====
  function scenario(W, opt = {}) {
    const OB = opt.ob || [{ inf: 16, mec: 11, arm: 9 }, { inf: 26, mec: 10, arm: 6 }];
    for (const s of [0, 1]) {
      const F = frontCells(W, s); let num = 1;
      const list = []; for (const k of ['arm', 'mec', 'inf']) for (let n = 0; n < OB[s][k]; n++) list.push(k);
      // ترتيب الجبهة: الأكثر أهمية (قرب مدن كبيرة وسهل) أول
      const imp = i => { let v = 0; for (let j = 0; j < W.N; j++) if (W.cells[j].vp && W.cells[j].s === s) v += W.cells[j].vp * 60 / (60 + W.dist(i, j)); return v * (TERR[W.cells[i].t].spd) ; };
      F.sort((a, b) => imp(b) - imp(a));
      // أول شي: حامية مشاة بكل مدينة مهمة قريبة من الحدود (البصرة، العمارة، ...)، وبعدين الجبهة
      const depth = []; for (let i = 0; i < W.N; i++) if (W.cells[i].s === s && (W.cells[i].vp || 0) >= 3 && !F.includes(i) && F.some(f => W.dist(f, i) < 110)) depth.push(i);
      for (const i of depth) { const k2 = list.lastIndexOf('inf'); if (k2 < 0) break; list.splice(k2, 1); const d = addDiv(W, s, 'inf', i, s ? 20 + num : num); d.ent = 1; num++; }
      let k = 0;
      for (const kind of list) { const cell = F[k % F.length]; const d = addDiv(W, s, kind, cell, s ? 20 + num : num); d.ent = 1; num++; k++; }
    }
    supply(W); W.ob = [0, 1].map(s => alive(W).filter(d => d.side === s).length); makeArmies(W); if (!W.noFog) intel(W);
  }

  // ===== الجيوش (R5a): كل طرف 3 جيوش حسب مكان الجبهة (شمال، وسط، جنوب) =====
  const ARMY_N = [['الجيش الشمالي', 'الجيش الأوسط', 'الجيش الجنوبي'], ['جيش أذربيجان وكردستان', 'جيش كرمانشاه وإيلام', 'جيش خوزستان']];
  function makeArmies(W) {
    W.armies = []; W.plans = []; W.planId = 1;
    for (const s of [0, 1]) for (let k = 0; k < 3; k++) W.armies.push({ id: W.armies.length, side: s, n: ARMY_N[s][k], k, stance: 'auto' });
    for (const d of alive(W)) joinArmy(W, d);
  }
  // الحدود بين الجيوش على ارتفاع الخريطة (كم من فوق): الشمال فوق 640، الجنوب تحت 900
  function joinArmy(W, d) { if (!W.armies) return; const y = W.cells[d.cell].c[1]; const k = y < 640 ? 0 : y < 900 ? 1 : 2; d.army = W.armies.find(a => a.side === d.side && a.k === k).id; }

  // ===== خطط الهجوم بالأسهم (R5a) =====
  // السهم = سلسلة مناطق متجاورة. رأس الحربة (الدروع والآليات المختارة) يتجمّع أول (تحضير)، وبعدين يهاجم منطقة منطقة على طول السهم.
  // الخطة تخلص إذا وصلت الهدف، وتتوقف إذا رأس الحربة تعب أو انقتل (3 توقفات بدون تقدّم).
  function cellChain(W, pts) {
    const out = []; for (const c of pts) if (c >= 0 && out[out.length - 1] !== c) out.push(c);
    const full = [out[0]];
    for (let i = 1; i < out.length; i++) { const a = full[full.length - 1], b = out[i]; if (W.cells[a].nb.includes(b)) { full.push(b); continue; }
      // سد الفراغ بأقصر طريق
      const prev = new Map([[a, -1]]), q = [a]; while (q.length) { const x = q.shift(); if (x === b) break; for (const y of W.cells[x].nb) if (!prev.has(y)) { prev.set(y, x); q.push(y); } }
      const seg = []; for (let x = b; x !== a && x !== undefined; x = prev.get(x)) seg.unshift(x); full.push(...seg); }
    return full.filter((c, i) => full.indexOf(c) === i);
  }
  function makePlan(W, side, divs, pathCells) {
    const path = cellChain(W, pathCells); if (path.length < 2) return null;
    const spear = divs.filter(d => d.kind !== 'inf').length ? divs.filter(d => d.kind !== 'inf') : divs;
    for (const d of divs) if (d.plan) cancelPlan(W, W.plans.find(p => p.id === d.plan));
    const P = { id: W.planId++, side, path, divs: spear.map(d => d.id), st: 'prep', t0: W.t, prep: 8, stalls: 0, last: W.t, taken: 0 };
    for (const d of spear) { d.mode = 'plan'; d.plan = P.id; d.path = []; d.prog = 0; }
    W.plans.push(P); W.log.push({ t: W.t, side, k: 'plan', id: P.id, cell: path[path.length - 1] }); return P;
  }
  function cancelPlan(W, P) { if (!P) return; P.st = P.st === 'done' ? 'done' : 'cancel'; for (const d of W.divs) if (d.plan === P.id) { d.plan = null; if (d.mode === 'plan') { d.mode = 'auto'; if (d.path.length && W.ctrl[d.path[0]] !== d.side) d.path = []; } } }
  function runPlans(W) {
    for (const P of W.plans || []) {
      if (P.st !== 'prep' && P.st !== 'go') continue; if (inTruce(W)) { P.last = W.t; continue; }
      const D = W.divs.filter(d => !d.dead && d.plan === P.id); if (!D.length) { P.st = 'fail'; W.log.push({ t: W.t, side: P.side, k: 'planfail', id: P.id }); continue; }
      // رأس الحربة يكمل لقدّام من أبعد نقطة وصلها على السهم (اللي يضيع وراه يمسكه المشاة)، فما يرجع ويروح
      const reach = Math.max(0, ...D.map(d => P.path.indexOf(d.cell)));
      let ni = P.path.findIndex((c, i) => i > reach && W.ctrl[c] !== P.side);
      if (ni < 0 && W.ctrl[P.path[P.path.length - 1]] !== P.side) ni = P.path.length - 1;
      if (ni < 0) { P.st = 'done'; W.log.push({ t: W.t, side: P.side, k: 'plandone', id: P.id, cell: P.path[P.path.length - 1] }); cancelPlan(W, P); P.st = 'done'; continue; }
      const nextT = P.path[ni];
      // نقطة التجمّع: أقرب منطقة إلنا جارة للهدف الجاي (على السهم إذا ممكن)
      const stage = (ni > 0 && W.ctrl[P.path[ni - 1]] === P.side) ? P.path[ni - 1] : W.cells[nextT].nb.filter(j => W.ctrl[j] === P.side).sort((a, b) => W.dist(a, D[0].cell) - W.dist(b, D[0].cell))[0];
      if (stage == null) { P.st = 'fail'; cancelPlan(W, P); P.st = 'fail'; continue; }
      if (P.st === 'prep') {
        let ready = true;
        for (const d of D) { if (d.cell !== stage && !W.cells[stage].nb.includes(d.cell)) { ready = false; if (!d.path.length) order(W, d, stage, 'plan'); } }
        // اللي يوصل يتجمّع؛ إذا طوّلوا أكثر من 30 ساعة نبدي باللي وصل والباقي يلحق
        const near = D.filter(d => d.cell === stage || W.cells[stage].nb.includes(d.cell)).length;
        if ((ready && W.t - P.t0 >= P.prep) || (W.t - P.t0 >= 30 && near > 0)) { P.st = 'go'; P.last = W.t; W.log.push({ t: W.t, side: P.side, k: 'plango', id: P.id }); }
        continue;
      }
      for (const d of D) {
        if (d.org < d.orgMax * .25) continue; // تعب: يرتاح بمكانه
        if (d.path.length && d.path[d.path.length - 1] === nextT) continue;
        if (W.cells[d.cell].nb.includes(nextT)) { d.path = [nextT]; d.prog = 0; d.mode = 'plan'; }
        else if (!d.path.length || d.path[d.path.length - 1] !== stage) order(W, d, stage, 'plan');
      }
      // التقدّم: كم منطقة أخذنا على السهم
      const taken = P.path.filter(c => W.ctrl[c] === P.side).length;
      if (taken > P.taken) { P.taken = taken; P.last = W.t; P.stalls = 0; }
      else if (W.t - P.last > 48) { P.stalls++; P.last = W.t; if (P.stalls >= 3) { W.log.push({ t: W.t, side: P.side, k: 'planstall', id: P.id }); cancelPlan(W, P); P.st = 'stall'; } }
    }
  }

  // R5b: ضرب جسر: ينقطع لحد ما يصلحه المهندسين (~2–4 أيام)، والإمداد ينعاد حسابه فوراً
  function hitBridge(W, k, side, p = .7) {
    const b = W.bridges[k]; if (!b) return false; if (W.rnd() > p) return false;
    b.down = 48 + Math.round(W.rnd() * 48); b.by = side; W.log.push({ t: W.t, side, k: 'bridge', cell: b.i, n: b.n }); supply(W); return true;
  }
  // ضربة جوية أو صاروخ على منطقة: ينزل تنظيم وعدد فرق العدو بيها
  function airHit(W, side, cell, power) {
    power *= (W.night ? .8 : 1) * (WX[W.wx || 'clear'].air || 1) * (W.indF ? W.indF[1 - side].ewDef * (W.cells[cell].vp ? W.indF[1 - side].fort : 1) : 1);   // C4: التشويش، وC9: تحصين المدن   // بالليل والغيم القصف أقل دقة
    const en = W.divs.filter(d => !d.dead && d.side !== side && d.cell === cell); if (!en.length) return 0;
    for (const d of en) { d.org = Math.max(0, d.org - power * 4 / en.length); d.str = Math.max(.05, d.str - power * .005 / en.length); d.hitT = W.t; }
    W.log.push({ t: W.t, side, k: 'air', cell }); return en.length;
  }
  // ===== GW11 B3: توقّع الهجوم قبل ما تأمر =====
  // نفس حساب المعركة بـ step() (عرض الجبهة، الالتفاف، الأرض، النهر، الإمداد، التحصين، الليل والطقس) على نسخ من الفرق،
  // بمولّد أرقام خاص (ما يغيّر حالة الحرب)، كم مرة، ونرجّع: الفرصة، الساعات، خسائر الطرفين.
  // defs: (اختياري) اللي نعرفه عن العدو بالمنطقة (ضباب الحرب)؛ بدونه ناخذ الحقيقي
  function forecast(W, att, tg, runs = 24, defs) {
    att = att.filter(d => !d.dead && (d.cell === tg || W.cells[d.cell].nb.includes(tg))); if (!att.length) return null;
    const side = att[0].side, def0 = (defs || W.divs.filter(d => !d.dead && d.cell === tg && d.side !== side)).map(d => ({ ...d, cell: tg }));
    if (!def0.length) return { empty: true, chance: 1 };
    const tr = TERR[W.cells[tg].t]; let seed = (tg * 7919 + W.t * 31 + att.length) % 2147483646 + 1; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    let wins = 0, hW = 0, la = 0, ld = 0;
    for (let r = 0; r < runs; r++) {
      const A = att.map(d => ({ ...d })), D = def0.map(d => ({ ...d })); let h = 0, won = false;
      for (h = 1; h <= 168; h++) {
        const Aa = A.filter(a => a.org >= 1).sort((a, b) => b.str * b.org - a.str * a.org), Dd0 = D.filter(d => d.org >= 1);
        if (!Dd0.length) { won = true; break; } if (!Aa.length) break;
        const As = Aa.slice(0, tr.w + 1 + (new Set(Aa.map(a => a.cell)).size > 1 ? 1 : 0)), Dd = Dd0.slice(0, tr.w + 2);
        const hA = hdOf(As), hD = hdOf(Dd), flank = new Set(As.map(a => a.cell)).size > 1 ? 1.15 : 1, luck = .85 + rnd() * .3;
        const aPow = As.reduce((t, a) => t + atkOf(W, a, tg, a.cell, hD), 0) * flank * luck * envAtk(W, side);
        const dPow = Dd.reduce((t, d) => t + atkOf(W, d, tg, null, hA) / tr.atk * (d.kind === 'inf' ? 1 : 1 / tr.armor), 0) * (1.15 - (luck - 1));
        const dCap = Dd.reduce((t, d) => t + TEMPL[d.kind].def * d.str * (1 + .6 * d.ent) * (W.sup[d.side][d.cell] ? 1 : .6), 0), aCap = As.reduce((t, a) => t + TEMPL[a.kind].brk * a.str, 0);
        const hOnD = hits(aPow, dCap), hOnA = hits(dPow, aCap);
        for (const d of Dd) { d.org = Math.max(0, d.org - hOnD / Dd.length * K_ORG); d.str = Math.max(.02, d.str - hOnD / Dd.length * K_STR); }
        for (const a of As) { a.org = Math.max(0, a.org - hOnA / As.length * K_ORG); a.str = Math.max(.02, a.str - hOnA / As.length * K_STR); }
      }
      if (won) { wins++; hW += h; }
      la += A.reduce((t, a, i) => t + att[i].str - a.str, 0) / att.reduce((t, a) => t + a.str, 0);
      ld += D.reduce((t, d, i) => t + def0[i].str - d.str, 0) / def0.reduce((t, d) => t + d.str, 0);
    }
    return { chance: wins / runs, hours: wins ? hW / wins : null, la: la / runs, ld: ld / runs, nd: def0.length, na: att.length };
  }
  // تلخيص الحرب
  function score(W) { const vp = [0, 0]; W.cells.forEach((c, i) => { if (c.vp) vp[W.ctrl[i]] += c.vp; }); return { vp, cells: [0, 1].map(s => W.ctrl.reduce((n, x) => n + (x === s ? 1 : 0), 0)), divs: [0, 1].map(s => alive(W).filter(d => d.side === s).length), lost: W.lost.slice() }; }

  const API = { DIFF, applyCfg, forecast, inTruce, getNID: () => NID, setNID: v => { NID = v; }, WX, weather, envAtk, envMv, hitBridge, edgeCost, SUP_BUDGET, intel, known, isSeen, initIntel, makePlan, cancelPlan, runPlans, cellChain, joinArmy, airHit, TEMPL, TERR, KIND_N, World, addDiv, step, ai, order, route, scenario, supply, score, alive, divsIn, frontCells, power };
  if (typeof module !== 'undefined') module.exports = API; else root.SIM = API;
})(this);
