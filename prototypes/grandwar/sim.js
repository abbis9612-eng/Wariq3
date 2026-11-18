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
  const K_ORG = 1.0, K_STR = .0035;

  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

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
    return a;
  }
  const hdOf = ds => ds.length ? ds.reduce((s, d) => s + TEMPL[d.kind].hd * d.str, 0) / ds.reduce((s, d) => s + d.str, 0) : 0;
  function hits(power, cap) { return power <= cap ? power * .1 : cap * .1 + (power - cap) * .4; }

  // الإمداد: من المدن الكبيرة اللي بعدها بيدك، على مناطقك
  function supply(W) {
    if (W.allSup) { W.sup[0].fill(1); W.sup[1].fill(1); return; }
    for (const s of [0, 1]) {
      const sup = W.sup[s]; sup.fill(0); const q = [];
      W.cells.forEach((c, i) => { if (W.ctrl[i] === s && c.s === s && (c.vp || 0) >= 3) { sup[i] = 1; q.push(i); } });
      while (q.length) { const i = q.pop(); for (const j of W.cells[i].nb) if (!sup[j] && W.ctrl[j] === s) { sup[j] = 1; q.push(j); } }
    }
  }

  // ساعة وحدة
  function step(W) {
    W.t++;
    if (W.t % 6 === 1) supply(W);
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
      let aPow = A.reduce((s, a) => s + atkOf(W, a, f.tg, a.cell, hD), 0) * flank * luck;
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
      for (const a of A) if (a.org < 1) { a.path = []; a.prog = 0; W.cool = W.cool || new Map(); W.cool.set(a.side + ':' + f.tg, W.t + 72); W.stalls = (W.stalls || 0) + 1; if (a.mode === 'manual') { a.mode = 'hold'; W.log.push({ t: W.t, side: a.side, k: 'stall', div: a.n, cell: f.tg }); } }
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
        if (W.t - d.lastFight > 6 && W.sup[d.side][d.cell]) { d.org = Math.min(d.orgMax, d.org + d.orgMax / 40); d.str = Math.min(1, d.str + .0012); }
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
      const v = T.spd * tr.spd * adv * (W.edgeOf.get(d.cell + ',' + tg)?.r ? RIVER_SPD : 1) * (W.sup[d.side][d.cell] ? 1 : .5);
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
    for (const s of [0, 1]) {
      const n = alive(W).filter(d => d.side === s).length;
      W.mob = W.mob || [0, 0]; W.ob = W.ob || [n, n];
      if (n < W.ob[s] && W.t - W.mob[s] >= 24 * 8) {
        let best = -1, bv = -1; W.cells.forEach((c, i) => { if (W.ctrl[i] === s && c.s === s && W.sup[s][i] && (c.vp || 0) > bv) { bv = c.vp || 0; best = i; } });
        if (best >= 0) { W.mob[s] = W.t; W.num = W.num || [100, 200]; const d = addDiv(W, s, 'inf', best, W.num[s]++); d.org = d.orgMax * .5; d.str = .7; W.log.push({ t: W.t, side: s, k: 'mob', div: d.n, cell: best }); }
      }
      // استسلام: إذا الدولة خسرت 70% من نقاط مدنها
      const own = W.cells.reduce((v, c, i) => v + (c.s === s && W.ctrl[i] === s ? (c.vp || 0) : 0), 0);
      if (!W.over && own <= W.vpTotal[s] * .3) { W.over = { t: W.t, loser: s }; W.log.push({ t: W.t, side: s, k: 'capitulate' }); }
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
  function order(W, d, goal, mode = 'manual', deep = false) { if (goal === d.cell) { d.path = []; d.mode = 'hold'; return true; } const p = route(W, d, goal, deep); if (!p) return false; d.path = p; d.prog = 0; d.mode = mode; return true; }

  // ===== الذكاء (نفس القواعد للطرفين) =====
  function frontCells(W, s) { const F = []; for (let i = 0; i < W.N; i++) if (W.ctrl[i] === s && W.cells[i].nb.some(j => W.ctrl[j] !== s)) F.push(i); return F; }
  const power = d => (TEMPL[d.kind].soft + TEMPL[d.kind].def * .5) * d.str * (d.org / d.orgMax);
  function ai(W, s, opt = {}) {
    const aggr = opt.aggr ?? 1.6;
    const D = alive(W); const mine = D.filter(d => d.side === s), theirs = D.filter(d => d.side !== s);
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
      const def = theirs.filter(e => e.cell === j);
      const tr = TERR[W.cells[j].t];
      const dVal = def.reduce((t, e) => t + TEMPL[e.kind].def * e.str * (1 + .6 * e.ent) * (e.org / e.orgMax + .3), 0);
      const avail = [];
      for (const i of W.cells[j].nb) if (W.ctrl[i] === s) for (const d of (mineAt.get(i) || [])) if (d.mode === 'auto' && !used.has(d.id) && d.org > d.orgMax * .7 && d.str > .45) avail.push(d);
      if (!avail.length) continue;
      const aVal = avail.reduce((t, d) => t + atkOf(W, d, j, d.cell, def.length ? hdOf(def) : 0), 0);
      const ratio = def.length ? aVal / (dVal * .1 + .001) : 99;
      // ما نتقدم لمنطقة فاضية إذا راح تصير بروز (أغلب جيرانها للعدو): نخلي الخط مستقيم
      const ownNb = W.cells[j].nb.filter(k => W.ctrl[k] === s).length;
      if (!def.length && ownNb * 2 < W.cells[j].nb.length && !(W.cells[j].s === s)) continue;
      const gain = (W.cells[j].vp || 0) * 3 + 1 + (W.cells[j].s === s ? 3 : 0);
      targets.push({ j, def, avail, ratio, score: ratio * gain });
    }
    targets.sort((a, b) => b.score - a.score);
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
    supply(W); W.ob = [0, 1].map(s => alive(W).filter(d => d.side === s).length);
  }

  // ضربة جوية أو صاروخ على منطقة: ينزل تنظيم وعدد فرق العدو بيها
  function airHit(W, side, cell, power) {
    const en = W.divs.filter(d => !d.dead && d.side !== side && d.cell === cell); if (!en.length) return 0;
    for (const d of en) { d.org = Math.max(0, d.org - power * 4 / en.length); d.str = Math.max(.05, d.str - power * .005 / en.length); d.hitT = W.t; }
    W.log.push({ t: W.t, side, k: 'air', cell }); return en.length;
  }
  // تلخيص الحرب
  function score(W) { const vp = [0, 0]; W.cells.forEach((c, i) => { if (c.vp) vp[W.ctrl[i]] += c.vp; }); return { vp, cells: [0, 1].map(s => W.ctrl.reduce((n, x) => n + (x === s ? 1 : 0), 0)), divs: [0, 1].map(s => alive(W).filter(d => d.side === s).length), lost: W.lost.slice() }; }

  const API = { airHit, TEMPL, TERR, KIND_N, World, addDiv, step, ai, order, route, scenario, supply, score, alive, divsIn, frontCells, power };
  if (typeof module !== 'undefined') module.exports = API; else root.SIM = API;
})(this);
