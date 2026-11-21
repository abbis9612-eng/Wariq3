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
    const front = [0, 1].map(s => T.cells.map((c, i) => i).filter(i => W.ctrl[i] === s && (T.kind === 'air' || W.cells[i].nb.some(j => W.ctrl[j] !== s))).map(i => W.cells[i].c));   // المسرح الجوي: «الجبهة» = كل أرض الطرف
    const HOME = T.kind !== 'air' && !front[0].length && !front[1].length;   // I-106: أرض دولتنا بالسلم (ماكو جبهة): كل القواعد والبطاريات بأماكنها
    const dFront = (s, p) => HOME ? 100 : front[1 - s].reduce((m, f) => Math.min(m, d2(f, p)), 1e9);
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
        if (HOME) bl = bl.filter(b => T.cells.some(c => c.own === k && d2(c.c, b.p) < T.hs * 2));   // بالسلم: بس القواعد اللي بأرضنا (قواعد أمريكا بالخليج مو هنا)
        if (!bl.length) bl = T.cells.filter(c => c.own === k && c.vp >= 3).sort((a, b) => b.vp - a.vp).slice(0, 4).map(c => ({ n: 'مطار ' + (c.city || ''), p: c.c, ll: [c.ll[1], c.ll[0]] }));
        bl = bl.filter(b => dFront(s, b.p) < (T.kind === 'air' ? 2200 : REACH)).sort((a, b) => dFront(s, a.p) - dFront(s, b.p)).slice(0, 6);
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
          // المسرح الجوي: مواقع الصواريخ بأرضنا أو أرض الصديق المضيف
          const rear = T.cells.filter(x => (x.own === k || T.kind === 'air') && W.ctrl[T.cells.indexOf(x)] === s).map(x => ({ x, d: dFront(s, x.c) })).filter(o => o.d > 80 && o.d < (T.kind === 'air' ? 2500 : 700)).sort((a, b) => (b.x.vp || 0) - (a.x.vp || 0) || a.d - b.d).slice(0, 2);
          const mun = CAT.munOf(k);
          rear.forEach((o, i) => mbases.push({ n: (i ? 'موقع مسيّرات' : 'قاعدة صواريخ') + ' — ' + (o.x.city || 'المؤخرة'), ll: [o.x.ll[1], o.x.ll[0]], side: s,
            bm: Math.min(200, Math.round(c.msl * .1 / rear.length)), cm: Math.min(40, Math.round(c.msl * .025 / rear.length)), uav: Math.min(400, Math.round(c.drn * .1 / rear.length)),   /* I-159: مخزون أكبر للضربات الأكبر */ ...(mun ? { mun } : {}) }));
        }
      }
      // حد التلفون للطيارات (بنفس النسبة)
      const tot = orders.reduce((t, o) => t + o.n, 0), f = tot > CAP_PL ? CAP_PL / tot : 1; info[s].scale = 1 / f;
      for (const o of orders) { const n = Math.max(1, Math.round(o.n * f)), nm = (((WD.aw || {})[o.k] || {}).nm || {})[o.t];   // nm = اسم الطراز الحقيقي لهاي الدولة (B-1B بدل «سوخوي-24»)
        bases.push({ n: o.b.n + (orders.filter(x => x.b === o.b).length > 1 ? ` (${(nm || AIR.PLANES[o.t].n).split(/[ ،/(]/)[0]})` : ''), rw: 0, ll: o.b.ll, side: s, type: o.t, planes: n, cc: o.k, ...(nm ? { nm: nm.replace(/ \([^)]*\)$/, '') } : {}) }); info[s].planes += n; }
      // البطاريات: الأبعد مدى أول؛ مواقعها: قرب القواعد والمدن الكبيرة اللي قريبة من الجبهة
      const rng = sy => Math.max(...AIR.SYS[sy].mags.map(m => Math.max(...Object.values(m.r))));
      samList.sort((a, b) => rng(b.sy) - rng(a.sy)); samList = samList.slice(0, CAP_SAM);
      const spots = [...T.cells.filter(c => W.ctrl[T.cells.indexOf(c)] === s && c.vp >= 3).map(c => ({ n: c.city, p: c.c, ll: [c.ll[1], c.ll[0]] })), ...bases.filter(b => b.side === s).map(b => ({ n: b.n, p: LL(...b.ll), ll: b.ll }))]
        .map(o => ({ ...o, d: dFront(s, o.p) })).filter(o => o.d > 15 && o.d < (T.kind === 'air' ? 2500 : 600)).sort((a, b) => a.d - b.d);
      // العقيدة: البعيدة (فوك 100 كم) 60–300 كم ورا الجبهة، المتوسطة 25–150، القصيرة ويا المدن القريبة [تقدير]
      const band = sy => { const r = rng(sy); return r > 100 ? [60, 300] : r > 30 ? [25, 150] : [10, 80]; }, used = new Map();
      samList.forEach((x, i) => { const [lo, hi] = band(x.sy), cand = spots.filter(o => o.d >= lo && o.d <= hi); const L = cand.length ? cand : spots;
        const sp = L.slice().sort((a, b) => (used.get(a) || 0) - (used.get(b) || 0))[0]; if (!sp) return; const j = used.get(sp) || 0; used.set(sp, j + 1);
        sams.push({ n: `${AIR.SYS[x.sy].n} — ${sp.n || ''}`, ll: [sp.ll[0] + j * .05, sp.ll[1] + j * .05], side: s, sys: x.sy, cc: x.k });
        for (const m of AIR.SYS[x.sy].mags) if (!m.gun) pool[s][m.n] = (pool[s][m.n] || 0) + m.stock; });
      info[s].sams = sams.filter(x => x.side === s).length;
    }
    if (T.samStock) for (const [k, v] of Object.entries(T.samStock)) pool[0][k] = (pool[0][k] || 0) + v;
    // ===== I-160: شلون الدول الكبرى تغلب الدفاع الجوي (حزيران 2025) — لكل طرف حسب قائده =====
    const techOf = k => (k === G.me && G.nat && G.nat.ind ? G.nat.ind[0].tech : (G.tech && G.tech[k]) || (WD.cs[k] || {}).tech || {});
    const BIG_EW = { USA: .15, ISR: .12, RUS: .05, CHN: .05, GBR: .05, FRA: .05 };   // طيارات حرب إلكترونية مخصصة (Growler، إيتان…) [تقدير]
    const MALD = { USA: 60, ISR: 30, GBR: 10, FRA: 10, CHN: 20, RUS: 15 };   // أفخاخ بالمخزن لكل حرب [تقدير]
    const ew = [0, 1].map(s => { const k = T.side[s][0], e = techOf(k).ew || 0; return Math.min(.6, Math.max(0, (e - 1) / 6) + (BIG_EW[k] || 0)); });
    const mald = [0, 1].map(s => { const k = T.side[s][0], e = techOf(k).ew || 0; return MALD[k] || (e >= 4 ? 10 : 0); });
    const sead = [0, 1].map(s => ew[s] >= .3 ? 1 : 0);
    const regen = [0, 1].map(s => { const k = T.side[s][0], c = G.C[k]; if (!c) return 1; const sanc = (G.sanc || []).filter(x => x[1] === k).length; return +Math.max(.25, Math.min(1.3, Math.log10(Math.max(10, c.gdp)) / 3.5 * (sanc >= 3 ? .6 : 1))).toFixed(2); });
    // توماهوك من البحر: مدمرات وغواصات الطرف قريبة من المسرح (لحد 1600 كم من أرض العدو) تصير مواقع إطلاق كروز
    if (G.nav && G.nav.g && WD.s) for (const s of [0, 1]) for (const k of T.side[s]) { const mun = CAT.munOf(k), cmM = (mun && mun.cm) || 'tomahawk';
      for (const g of G.nav.g) { if (g.cc !== k) continue; const nC = Math.min(160, (g.s.dd || 0) * 8 + (g.s.ssn || 0) * 12 + (g.s.cv ? 0 : 0) + (g.s.ff || 0) * 2); if (nC < 8) continue;
        const z = WD.s[g.z], ll = [z[2][1], z[2][0]], p = LL(...ll); if (dFront(s, p) > (AIR.MUN[cmM] ? AIR.MUN[cmM].range : 1600) || dFront(s, p) < 30) continue;
        mbases.push({ n: `${(WD.cs[k] || {}).ar || k}: سفن ${z[1]}`, ll, side: s, bm: 0, cm: nC, uav: 0, mun: { cm: cmM }, sea: 1 }); } }   // I-158: صواريخ الدفاع الجوي اللي صنعناها بالسلم
    const A = AIR.create(W, { LL, bases, sams, mbases, pool, raidSides: [0, 1].filter(s => mbases.some(m => m.side === s)), raidCd: 20, realDoc: true, raidK: 2.5, raidCdK: .45, pkK: 1.5, ew, mald, sead, regen, alphaH: sead.map(x => x ? 24 : 0), siteKill: true });   // I-159: ضربات مركّبة ×2.5 بالحجم وأكثر من ضعف التكرار، وطلعات أكبر ×1.5
    A.info = info; A.seadInfo = { ew, mald: mald.slice(), sead, regen }; A.LLp = { lon0: T.lon0, lat1: T.lat1, KX: T.KX, KY: T.KY };
    return A;
  }
  // الضربات المركّبة: الطرف 0 (اللاعب) يقرر بنفسه (A.raidSides يتغير من الواجهة)؛ هنا بس نضبط
  function setPlayerRaids(A, on) { const s = new Set(A.raidSides); if (on) s.add(0); else s.delete(0); A.raidSides = [...s].sort(); }
  // الحفظ: الحالة اللي تتغير بس (الطيارات الجاهزة، البطاريات وذخيرتها، المخازن)، والباقي يتبني من جديد
  // ===== I-158: السلاح اللي يوصل بنص الحرب (إنتاج أو سوق) يدخل المعركة فوراً =====
  const llP = (A, lat, lon) => { const L = A.LLp; return L ? [(lon - L.lon0) * L.KX, (L.lat1 - lat) * L.KY] : [0, 0]; };
  const shortN = t => ((AIR.PLANES[t] || {}).n || t).split(/[ ،/(]/)[0];
  // سرب جديد: بقاعدة من نفس النوع، وإلا بأقرب قاعدة إلنا (سرب جديد بنفس المطار)
  function addPlanes(A, s, type, q, cc, fresh) {
    if (!A || !AIR.PLANES[type]) return null; let b = fresh ? null : A.bases.find(x => x.side === s && x.type === type);
    if (!b) { const src = A.bases.filter(x => x.side === s && !x.down)[0] || A.bases.find(x => x.side === s); if (!src) return null;
      b = { ...src, n: src.n.replace(/ \([^)]*\)$/, '') + ` (${shortN(type)})`, type, cc: cc || src.cc, n0: 0, max: 0, ready: 0, rein: 0, cd: 5, mission: { kind: 'auto' }, plan: null, down: 0 }; delete b.nm; A.bases.push(b); }
    b.n0 += q; b.max = Math.max(b.max, b.n0); b.ready += q; return b;
  }
  // بطارية جديدة قرب أول بطارية إلنا (أو أول قاعدة)، وصواريخها بالمخزون
  function addSam(A, s, sys, cc) {
    if (!A || !AIR.SYS[sys] || !AIR.mkSite) return null; const ref = A.sams.find(x => x.side === s) || A.bases.find(x => x.side === s); if (!ref || !ref.ll) return null;
    const j = A.sams.filter(x => x.side === s && x.sys === sys).length, o = { n: `${AIR.SYS[sys].n} — جديدة`, ll: [ref.ll[0] + .06 * (j + 1), ref.ll[1] + .06 * (j + 1)], side: s, sys, cc };
    const site = AIR.mkSite(o, (lat, lon) => llP(A, lat, lon)); A.sams.push(site);
    for (const m of AIR.SYS[sys].mags) if (!m.gun) A.pool[s][m.n] = (A.pool[s][m.n] || 0) + m.stock; return site;
  }
  // الحفظ: بمفتاح (الطرف|النوع|الاسم) مو بالترتيب، حتى السرب أو البطارية الجديدة ما تخربط الباقي بعد التحميل
  const bK = (b, i, L) => `${b.side}|${b.type}|${b.n}|${L.slice(0, i).filter(y => y.side === b.side && y.type === b.type && y.n === b.n).length}`, sK = (x, i, L) => `${x.side}|${x.sys}|${x.n}|${L.slice(0, i).filter(y => y.side === x.side && y.sys === x.sys && y.n === x.n).length}`;
  function save(A) { return { t: A.t, wt: A.wt, id: A.id, kills: A.kills, lostPlanes: A.lostPlanes, stat: A.stat, raidCd: A.raidCd, raidSides: A.raidSides, pool: A.pool, opened: A.opened, mald: A.mald, alphaH: A.alphaH,
    bases: A.bases.map((b, i, L) => ({ k: bK(b, i, L), ready: b.ready, n0: b.n0, max: b.max, down: b.down, mission: b.mission, ll: b.ll, cc: b.cc })), sams: A.sams.map((s, i, L) => ({ k: sK(s, i, L), sys: s.sys, side: s.side, cc: s.cc, ll: s.ll, p: s.p, down: s.down, doc: s.doc, rd: s.rd || 0, dead: s.dead || 0, mags: s.mags.map(m => ({ ready: m.ready, stock: m.stock, ready0: m.ready0 })) })),
    mbases: A.mbases.map(m => ({ bm: m.bm, cm: m.cm, uav: m.uav })) }; }
  function restore(A, o) { if (!o) return A; Object.assign(A, { t: o.t, wt: o.wt, id: o.id, kills: o.kills, lostPlanes: o.lostPlanes, stat: o.stat, raidCd: o.raidCd, raidSides: o.raidSides, pool: o.pool }); if (o.opened) A.opened = o.opened; else A.opened = [1, 1]; if (o.mald) A.mald = o.mald; if (o.alphaH) A.alphaH = o.alphaH; else A.alphaH = [0, 0];   // حفظ قديم: الضربة الأولى انحسبت خلاص
    const BM = new Map(A.bases.map((b, i, L) => [bK(b, i, L), b])), SM = new Map(A.sams.map((x, i, L) => [sK(x, i, L), x]));
    const keyed = o.bases.length && o.bases.every(b => b.k), nb = [];
    o.bases.forEach((b, i) => { let x = b.k ? BM.get(b.k) : A.bases[i];
      if (!x && b.k) { const [sd, ty] = b.k.split('|'); x = addPlanes(A, +sd, ty, 0, b.cc, true); if (x) { x.n = b.k.split('|').slice(2, -1).join('|'); if (b.ll) { x.ll = b.ll; x.p = llP(A, ...b.ll); } } }
      if (x) { const { k, ll, cc, ...st } = b; Object.assign(x, st); if (x.max == null || x.max < x.n0) x.max = x.n0; nb.push(x); } });
    if (keyed) A.bases = nb;   // الحفظ هو الحقيقة: نفس القواعد وبنفس الترتيب (الجبهة تتحرك، فالبناء الجديد ممكن يطلع قواعد ثانية)
    const skeyed = o.sams.length && o.sams.every(x => x.k), ns = [];
    o.sams.forEach((s, i) => { let x = s.k ? SM.get(s.k) : A.sams[i]; if (!x && s.k && s.sys) { x = addSam(A, s.side, s.sys, s.cc); if (x) { A.sams.pop(); for (const m of AIR.SYS[s.sys].mags) if (!m.gun) A.pool[s.side][m.n] -= m.stock; if (s.ll) x.ll = s.ll; } }
      if (!x) return; x.p = s.p; x.down = s.down; x.doc = s.doc; if (s.rd) x.rd = s.rd; if (s.dead) x.dead = 1; s.mags.forEach((m, j) => x.mags[j] && Object.assign(x.mags[j], m)); ns.push(x); });
    if (skeyed) A.sams = ns; else for (const x of ns) if (!A.sams.includes(x)) A.sams.push(x);
    o.mbases.forEach((m, i) => A.mbases[i] && Object.assign(A.mbases[i], m)); return A; }
  const API = { build, save, restore, setPlayerRaids, addPlanes, addSam };
  if (typeof module !== 'undefined') module.exports = API; else root.AIRWORLD = API;
})(this);
