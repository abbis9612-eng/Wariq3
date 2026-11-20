// «العالم» W5 (D-050): الجو الحقيقي بمسرح الحرب = محرك «الحرب الكبرى» (air.js) نفسه، بس القواعد والطيارات والدفاع الجوي ومواقع الصواريخ
// تنبني من بيانات كل دولة الحقيقية: data/curation/airwar.json (تركيبة الطيران، البطاريات، القواعد بإحداثياتها) والـ W1/W4 للدول الباقية.
// فحص: node tests/airworld.test.mjs
(function (root) {
  'use strict';
  const req = typeof require !== 'undefined' ? require : null;
  const AIR = root.AIR || req('./gwair.js'), CAT = root.AIRCAT || req('./aircat.js');
  const CAP_PL = 160, CAP_SAM = 16, REACH = 900;   // حد التلفون: طيارات وبطاريات لكل طرف، ومدى القواعد عن الجبهة (كم)
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function build(T, G, WD) {
    const W = T.W, LL = (lat, lon) => [(lon - T.lon0) * T.KX, (T.lat1 - lat) * T.KY];
    const front = [0, 1].map(s => T.cells.map((c, i) => i).filter(i => W.ctrl[i] === s && W.cells[i].nb.some(j => W.ctrl[j] !== s)).map(i => W.cells[i].c));
    const dFront = (s, p) => front[1 - s].reduce((m, f) => Math.min(m, d2(f, p)), 1e9);
    const bases = [], sams = [], mbases = [], pool = [{}, {}], info = [{ planes: 0, sams: 0, scale: 1 }, { planes: 0, sams: 0, scale: 1 }];
    for (const s of [0, 1]) {
      const orders = [];   // [base pos, name, type, n]
      let samList = [];
      for (const k of T.side[s]) {
        const cs = WD.cs[k]; if (!cs) continue;
        const inTh = T.cells.some(c => c.own === k), lead = k === T.side[s][0];
        if (!inTh && !lead) continue;
        const cm = lead ? .7 : .35, live = G.C[k] ? Math.min(1, G.C[k].pw / G.C[k].pw0) : 1, aw = (WD.aw || {})[k];
        // الطيارات: التركيبة المعروفة، وإلا من قائمة الموديلات، وإلا من الإجمالي بنوع حسب الجيل
        let jets = aw && aw.jets ? aw.jets.map(([t, n]) => [t, n]) : (cs.jets || []).map(([m, n]) => [CAT.planeType(m), n]);
        if (!jets.length && cs.air) jets = [[((cs.gen || {}).jet || 2) >= 3.5 ? 'f16' : ((cs.gen || {}).jet || 2) >= 2.5 ? 'light' : 'old', cs.air]];
        const AR = k === G.me ? (T.arms || (G.nat && G.nat.arms)) : null;   // W8: اللي اشتريناه وأنتجناه بالسلم (نسخة ثابتة للمسرح)
        if (AR) for (const [t, n] of Object.entries(AR.jets || {})) { const j = jets.find(x => x[0] === t); if (j) j[1] += n / cm; else jets.push([t, n / cm]); }
        // القواعد: المعروفة بإحداثياتها، وإلا مدن الطرف بالمسرح
        let bl = aw && aw.bases ? aw.bases.map(([n, lat, lon]) => ({ n, p: LL(lat, lon), ll: [lat, lon] })) : [];
        if (!bl.length) bl = T.cells.filter(c => c.own === k && c.vp >= 3).slice(0, 4).map(c => ({ n: 'مطار ' + (c.city || ''), p: c.c, ll: [c.ll[1], c.ll[0]] }));
        bl = bl.filter(b => dFront(s, b.p) < REACH).sort((a, b) => dFront(s, a.p) - dFront(s, b.p)).slice(0, 6);
        if (!bl.length) continue;
        let bi = 0;
        for (const [t, n] of jets) { const m = Math.round(n * cm * live); if (m < 1 || !AIR.PLANES[t]) continue; const b = bl[bi++ % bl.length]; orders.push({ b, t, n: m, k }); }
        // مسيّرات استطلاع للي عنده صناعة مسيّرات
        if (((cs.tech || {}).uav || 0) >= 3) orders.push({ b: bl[bl.length - 1], t: 'tb2', n: 6, k });
        // الدفاع الجوي
        let sl = aw && aw.sam ? aw.sam.slice() : (cs.adL || []).map(([m, n, cat]) => [CAT.samType(m), Math.max(1, Math.round(n / (cat === 'long' ? 8 : 6)))]);
        if (!sl.length && cs.mb) sl = [['crotale', Math.max(1, Math.round(Math.sqrt(cs.mb)))]];
        if (AR) for (const [sy, n] of Object.entries(AR.sam || {})) if (AIR.SYS[sy]) sl.push([sy, n / cm]);
        for (const [sy, n] of sl) { const m = Math.round(n * cm); for (let i = 0; i < m; i++) samList.push({ sy, k, bl }); }
        // مواقع الصواريخ والمسيّرات (من مخزون الدولة بالمحاكاة)
        const c = G.C[k];
        if (lead && c && (c.msl + c.drn) > 5) {
          const rear = T.cells.filter(x => x.own === k && W.ctrl[T.cells.indexOf(x)] === s).map(x => ({ x, d: dFront(s, x.c) })).filter(o => o.d > 80 && o.d < 700).sort((a, b) => (b.x.vp || 0) - (a.x.vp || 0) || a.d - b.d).slice(0, 2);
          const mun = CAT.munOf(k);
          rear.forEach((o, i) => mbases.push({ n: (i ? 'موقع مسيّرات' : 'قاعدة صواريخ') + ' — ' + (o.x.city || 'المؤخرة'), ll: [o.x.ll[1], o.x.ll[0]], side: s,
            bm: Math.min(80, Math.round(c.msl * .08 / rear.length)), cm: Math.min(16, Math.round(c.msl * .02 / rear.length)), uav: Math.min(200, Math.round(c.drn * .08 / rear.length)), ...(mun ? { mun } : {}) }));
        }
      }
      // حد التلفون للطيارات (بنفس النسبة)
      const tot = orders.reduce((t, o) => t + o.n, 0), f = tot > CAP_PL ? CAP_PL / tot : 1; info[s].scale = 1 / f;
      for (const o of orders) { const n = Math.max(1, Math.round(o.n * f)); bases.push({ n: o.b.n + (orders.filter(x => x.b === o.b).length > 1 ? ` (${AIR.PLANES[o.t].n.split(/[ ،/]/)[0]})` : ''), rw: 0, ll: o.b.ll, side: s, type: o.t, planes: n, cc: o.k }); info[s].planes += n; }
      // البطاريات: الأبعد مدى أول؛ مواقعها: قرب القواعد والمدن الكبيرة اللي قريبة من الجبهة
      const rng = sy => Math.max(...AIR.SYS[sy].mags.map(m => Math.max(...Object.values(m.r))));
      samList.sort((a, b) => rng(b.sy) - rng(a.sy)); samList = samList.slice(0, CAP_SAM);
      const spots = [...T.cells.filter(c => W.ctrl[T.cells.indexOf(c)] === s && c.vp >= 3).map(c => ({ n: c.city, p: c.c, ll: [c.ll[1], c.ll[0]] })), ...bases.filter(b => b.side === s).map(b => ({ n: b.n, p: LL(...b.ll), ll: b.ll }))]
        .map(o => ({ ...o, d: dFront(s, o.p) })).filter(o => o.d > 15 && o.d < 600).sort((a, b) => a.d - b.d);
      // العقيدة: البعيدة (فوك 100 كم) 60–300 كم ورا الجبهة، المتوسطة 25–150، القصيرة ويا المدن القريبة [تقدير]
      const band = sy => { const r = rng(sy); return r > 100 ? [60, 300] : r > 30 ? [25, 150] : [10, 80]; }, used = new Map();
      samList.forEach((x, i) => { const [lo, hi] = band(x.sy), cand = spots.filter(o => o.d >= lo && o.d <= hi); const L = cand.length ? cand : spots;
        const sp = L.slice().sort((a, b) => (used.get(a) || 0) - (used.get(b) || 0))[0]; if (!sp) return; const j = used.get(sp) || 0; used.set(sp, j + 1);
        sams.push({ n: `${AIR.SYS[x.sy].n} — ${sp.n || ''}`, ll: [sp.ll[0] + j * .05, sp.ll[1] + j * .05], side: s, sys: x.sy, cc: x.k });
        for (const m of AIR.SYS[x.sy].mags) if (!m.gun) pool[s][m.n] = (pool[s][m.n] || 0) + m.stock; });
      info[s].sams = sams.filter(x => x.side === s).length;
    }
    const A = AIR.create(W, { LL, bases, sams, mbases, pool, raidSides: [0, 1].filter(s => mbases.some(m => m.side === s)), raidCd: 40, realDoc: true });
    A.info = info; A.LLp = { lon0: T.lon0, lat1: T.lat1, KX: T.KX, KY: T.KY };
    return A;
  }
  // الضربات المركّبة: الطرف 0 (اللاعب) يقرر بنفسه (A.raidSides يتغير من الواجهة)؛ هنا بس نضبط
  function setPlayerRaids(A, on) { const s = new Set(A.raidSides); if (on) s.add(0); else s.delete(0); A.raidSides = [...s].sort(); }
  // الحفظ: الحالة اللي تتغير بس (الطيارات الجاهزة، البطاريات وذخيرتها، المخازن)، والباقي يتبني من جديد
  function save(A) { return { t: A.t, wt: A.wt, id: A.id, kills: A.kills, lostPlanes: A.lostPlanes, stat: A.stat, raidCd: A.raidCd, raidSides: A.raidSides, pool: A.pool,
    bases: A.bases.map(b => ({ ready: b.ready, n0: b.n0, down: b.down, mission: b.mission })), sams: A.sams.map(s => ({ p: s.p, down: s.down, doc: s.doc, mags: s.mags.map(m => ({ ready: m.ready, stock: m.stock, ready0: m.ready0 })) })),
    mbases: A.mbases.map(m => ({ bm: m.bm, cm: m.cm, uav: m.uav })) }; }
  function restore(A, o) { if (!o) return A; Object.assign(A, { t: o.t, wt: o.wt, id: o.id, kills: o.kills, lostPlanes: o.lostPlanes, stat: o.stat, raidCd: o.raidCd, raidSides: o.raidSides, pool: o.pool });
    o.bases.forEach((b, i) => A.bases[i] && Object.assign(A.bases[i], b)); o.sams.forEach((s, i) => { const x = A.sams[i]; if (!x) return; x.p = s.p; x.down = s.down; x.doc = s.doc; s.mags.forEach((m, j) => x.mags[j] && Object.assign(x.mags[j], m)); });
    o.mbases.forEach((m, i) => A.mbases[i] && Object.assign(A.mbases[i], m)); return A; }
  const API = { build, save, restore, setPlayerRaids };
  if (typeof module !== 'undefined') module.exports = API; else root.AIRWORLD = API;
})(this);
