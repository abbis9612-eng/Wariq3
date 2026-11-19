// «الحرب الكبرى» GW7: الحفظ والتحميل (I-089).
// القاعدة: حفظ المالك ما ينكسر أبداً ← كل حفظ بيه رقم إصدار (V)، وأي تغيير بالحالة = رفع V + دالة ترقية بـ MIG.
// الحفظ: الحرب كلها بالضبط (المناطق، الفرق، المعارك، الخطط، الاستخبارات، الجسور، الطقس، الأرقام العشوائية)،
// والجو «على الأرض»: المطارات والبطاريات والمخازن؛ الطيارات اللي بالجو ترجع لقواعدها، والصواريخ بالجو تنشال.
(function (root) {
  const V = 2;
  const MIG = {
    // 1 ← 2 (GW8): الاقتصاد (W.eco، W.oil) جديد؛ ينبني من حالة الحرب وقت التحميل (ECON.ensure بـ restore)
    1: s => { s.v = 2; return s; },
  };
  // أشياء ثابتة تنبني من الخريطة (ما تنحفظ)
  const W_STATIC = new Set(['cells', 'N', 'edgeOf', 'dist', 'rnd', 'road', 'bridgeOf', 'spots']);
  const A_SKIP = new Set(['rnd', 'planes', 'msls', 'ev', 'decoys', 'queue', 'raids']);
  const enc = v => {
    if (v instanceof Map) return { __m: [...v].map(([k, x]) => [k, enc(x)]) };
    if (v instanceof Set) return { __s: [...v] };
    if (ArrayBuffer.isView(v)) return { __t: v.constructor.name, a: Array.from(v) };
    if (Array.isArray(v)) return v.map(enc);
    if (v && typeof v === 'object') { const o = {}; for (const k in v) if (typeof v[k] !== 'function') o[k] = enc(v[k]); return o; }
    return v;
  };
  const TA = { Int8Array, Uint8Array, Float32Array, Float64Array, Int16Array, Int32Array, Uint16Array };
  const dec = v => {
    if (Array.isArray(v)) return v.map(dec);
    if (v && typeof v === 'object') {
      if (v.__m) return new Map(v.__m.map(([k, x]) => [k, dec(x)]));
      if (v.__s) return new Set(v.__s);
      if (v.__t) return new TA[v.__t](v.a);
      const o = {}; for (const k in v) o[k] = dec(v[k]); return o;
    }
    return v;
  };
  function snapshot(W, A, SIM, extra = {}) {
    const w = {}; for (const k in W) if (!W_STATIC.has(k) && typeof W[k] !== 'function') w[k] = enc(W[k]);
    if (w.log && w.log.length > 400) w.log = w.log.slice(-400);
    const a = {}; if (A) {
      for (const k in A) if (!A_SKIP.has(k) && typeof A[k] !== 'function') a[k] = enc(A[k]);
      // الطيارات بالجو ترجع جاهزة لقواعدها؛ اشتباكات الدفاع الجوي تبدي من جديد
      a.bases = A.bases.map((b, i) => ({ ...enc(b), ready: Math.min(b.n0, b.ready + A.planes.filter(p => p.base === i && p.st !== 'dead' && p.st !== 'fall').length) }));
      a.sams = A.sams.map(s => ({ ...enc(s), eng: [] }));
    }
    return { v: V, game: 'grandwar', saved: Date.now(), seed: extra.seed, rng: W.rnd.get(), nid: SIM.getNID(), W: w, A: a, ui: extra.ui || {} };
  }
  function migrate(s) {
    if (!s || s.game !== 'grandwar') throw new Error('مو حفظ «الحرب الكبرى»');
    if (s.v > V) throw new Error(`الحفظ من نسخة أحدث (${s.v})`);
    while (s.v < V) { const f = MIG[s.v]; if (!f) throw new Error('ما اكو ترقية للإصدار ' + s.v); s = f(s); }
    return s;
  }
  // يرجّع العالم والجو من الحفظ (W جديد من الخريطة + الحالة فوقه)
  function restore(s, C, opt, SIM, AIR, ECON) {
    s = migrate(s);
    const W = SIM.World(C, { ...opt, seed: s.seed });
    const w = dec(s.W); for (const k in w) W[k] = w[k];
    // الجسور: الحالة (المضروب) من الحفظ، والباقي من الخريطة
    SIM.setNID(s.nid);
    W.spots = [[], []];
    const A = AIR.create(W); const a = dec(s.A);
    for (const k in a) A[k] = a[k];
    A.rnd = W.rnd; A.planes = []; A.msls = []; A.ev = []; A.queue = []; A.raids = {}; A.decoys = [];
    if (ECON) ECON.ensure(W);   // حفظ قديم بلا اقتصاد ← نبنيه (ما يسحب أرقام عشوائية)
    W.rnd.set(s.rng);   // آخر شي: بناء الجو يسحب أرقام عشوائية، فنرجّع الحالة بعده حتى الحرب تكمل بالضبط
    return { W, A, ui: s.ui, saved: s.saved, seed: s.seed };
  }
  // ===== التخزين بالتلفون (localStorage): كتابة آمنة = نكتب نسخة مؤقتة، نتأكد منها، ونخلي الحفظ القديم احتياط =====
  const KEY = n => 'gw.save.' + n;
  function write(st, slot, s) {
    const txt = JSON.stringify(s);
    st.setItem(KEY(slot) + '.tmp', txt);
    if (st.getItem(KEY(slot) + '.tmp') !== txt) throw new Error('الكتابة ما تمت');
    const old = st.getItem(KEY(slot)); if (old) st.setItem(KEY(slot) + '.bak', old);
    st.setItem(KEY(slot), txt); st.removeItem(KEY(slot) + '.tmp');
    return txt.length;
  }
  function read(st, slot) {
    for (const k of [KEY(slot), KEY(slot) + '.bak']) { const t = st.getItem(k); if (!t) continue; try { return JSON.parse(t); } catch (e) { } } // إذا الحفظ خربان ناخذ الاحتياط
    return null;
  }
  function info(st, slot) { const s = read(st, slot); return s && { saved: s.saved, t: s.W.t, ui: s.ui, v: s.v }; }
  function remove(st, slot) { for (const k of ['', '.bak', '.tmp']) st.removeItem(KEY(slot) + k); }
  const API = { V, MIG, snapshot, restore, migrate, write, read, info, remove, enc, dec };
  if (typeof module !== 'undefined') module.exports = API; else root.SAVE = API;
})(this);
