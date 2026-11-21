// «العالم» v5-7 (I-150): «مسيرتنا» — مؤشر قوة الدولة كل شهر من أول يوم (100 = البداية)، الإنجازات، وتقرير نهاية السنة.
// المؤشر = 40٪ الاقتصاد + 35٪ الجيش + 15٪ الاستقرار + 10٪ التقنية، كلها نسبة لقيمتها بأول شهر (التقنية +2 حتى الدولة اللي تبدي واطية ما ينتفخ مؤشرها). فحص: node tests/wrise.test.mjs
(function (root) {
  'use strict';
  const techAvg = G => { const t = (G.nat && G.nat.ind && G.nat.ind[0].tech) || {}, v = Object.values(t); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 1; };
  function ensure(G) { if (!G.rise) G.rise = { h: [], ms: [], yr: [], b: null, lt: -1 }; return G.rise; }
  function snap(G, S) {
    const c = G.C[G.me]; return { t: G.t, gdp: +c.gdp.toFixed(1), pw: Math.round(c.pw), stab: Math.round(c.stab), tech: +techAvg(G).toFixed(2), rk: S.rank(G, 'pw').indexOf(G.me) + 1, rg: S.rank(G, 'gdp').indexOf(G.me) + 1 };
  }
  const idxOf = (s, b) => Math.round(100 * (.4 * s.gdp / b.gdp + .35 * s.pw / Math.max(1, b.pw) + .15 * s.stab / Math.max(1, b.stab) + .1 * (s.tech + 2) / (b.tech + 2)));
  // الإنجازات من السجل (اللي تخص دولتنا بس)
  function scan(G, WD) {
    const R = ensure(G), me = G.me, L = G.log, nm = k => (WD.cs[k] || {}).ar || k;
    // بالوقت مو بالرقم (السجل ممكن يتقص): كل سطر بعد آخر يوم شفناه
    const lt = R.lt ?? -1; for (let i = Math.max(0, L.findIndex(l => (l.t ?? 0) > lt)); i >= 0 && i < L.length; i++) { const l = L[i]; if ((l.t ?? 0) <= lt) continue; let t = null;
      if (l.k === 'ars' && l.a === 'done') { const A = root.WARS || (typeof require !== 'undefined' ? require('./warsenal.js') : null); t = `⭐ دخل الخدمة: ${A && A.FL[l.f] ? A.title(l.f) : 'سلاح الترسانة'}`; }
      else if (l.k === 'peace' && (R.mw || []).includes(l.war)) { const w = l.n || l.war; t = `🕊 انتهت ${w}${l.kept ? ` وبقت ${l.kept} منطقة بإيدنا` : ''}`; }
      else if (l.k === 'cap' && l.who && l.who !== me) t = `🏳 ${nm(l.who)} استسلمت`;
      else if (l.k === 'res' && l.id === me && /^nat|^g6|^hyper|^milsat|^stealth/.test(String(l.r))) t = `🔬 خلص بحث كبير`;
      else if (l.k === 'cab' && /عيّنا/.test(l.a || '')) t = l.a;
      if (t) R.ms.push({ t: l.t ?? G.t, x: t }); }
    R.lt = G.t; if (R.ms.length > 60) R.ms.splice(0, R.ms.length - 60);
  }
  // كل شهر: لقطة + المؤشر، وأول كانون الثاني تقرير السنة
  function month(G, WD, S) {
    if (!G.nat) return; const R = ensure(G), s = snap(G, S); scan(G, WD); R.mw = G.wars.filter(w => w.a.includes(G.me) || w.b.includes(G.me)).map(w => w.id); if (!R.b) R.b = s; s.i = idxOf(s, R.b); R.h.push(s); if (R.h.length > 600) R.h.shift();
    const d = S.date(G.t); if (d.getUTCMonth() === 0 && R.h.length > 6) { const a = R.h[Math.max(0, R.h.length - 13)];
      const y = { y: d.getUTCFullYear() - 1, i0: a.i, i1: s.i, gdp: +((s.gdp / a.gdp - 1) * 100).toFixed(1), pw: +((s.pw / Math.max(1, a.pw) - 1) * 100).toFixed(1), rk0: a.rk, rk1: s.rk, rg0: a.rg, rg1: s.rg, ms: R.ms.filter(m => m.t > a.t).map(m => m.x).slice(-4) };
      R.yr.push(y); if (R.yr.length > 30) R.yr.shift(); G.log.push({ t: G.t, k: 'year', y: y.y, i0: y.i0, i1: y.i1, rk0: y.rk0, rk1: y.rk1 }); }
  }
  const now = G => { const R = ensure(G); return R.h.length ? R.h[R.h.length - 1] : null; };
  const API = { ensure, month, idxOf, now, scan };
  if (typeof module !== 'undefined') module.exports = API; else root.WRISE = API;
})(typeof window !== 'undefined' ? window : globalThis);
