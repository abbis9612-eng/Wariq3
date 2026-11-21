// «العالم» I-157: وضع الغش للمالك (تجربة سريعة): فلوس، البحث كامل، نقاط قرار، استقرار. ينفتح من ⚙ الإعدادات. فحص: node tests/wcheat.test.mjs
(function (root) {
  'use strict';
  const req = n => (typeof require !== 'undefined' ? require(n) : null);
  const RES = () => root.WRES || req('./wres.js'), IND = () => root.IND || req('./gwind.js');
  const mark = (G, a) => { G.cfg = G.cfg || {}; G.cfg.cheat = (G.cfg.cheat || 0) + 1; G.log.push({ t: G.t, k: 'cheat', a }); };
  function money(G, v = 1000) { if (!G.nat) return 'ماكو دولة'; G.nat.eco[0].cash += v; mark(G, 'money'); return { ok: true, t: `+${v} مليار بالخزينة` }; }
  function debt(G) { const c = G.C[G.me]; c.debt = 0; mark(G, 'debt'); return { ok: true, t: 'الدين العام صار صفر' }; }
  // كل فروع البحث العسكري لآخر مستوى، وكل بحوث الشجرة مكتملة بآثارها
  function research(G, WD) {
    if (!G.nat) return 'ماكو دولة'; const R = RES(), I = G.nat.ind[0], S = R.ensure(G);
    for (const b of IND().BRK) I.tech[b] = R.MAXL;
    S.slots = []; let n = 0, more = true;
    let guard = 0; while (more && guard++ < 60) { more = false; for (const k of Object.keys(R.T)) { const t = R.T[k]; if (S.done[k] || t.lock || (t.req || []).some(r => !S.done[r])) continue; R.finish(G, WD, k); n++; more = true; } }
    mark(G, 'research'); return { ok: true, t: `البحث كامل: ${n} بحث خلص وكل الفروع مستوى ${R.MAXL}` };
  }
  function ap(G) { G.ap = 99; mark(G, 'ap'); return { ok: true, t: 'نقاط القرار 99' }; }
  function calm(G) { const c = G.C[G.me], H = G.nat && G.nat.home; c.stab = 90; if (H) { H.stab = 90; for (const k in H.fac) H.fac[k] = 85; } mark(G, 'calm'); return { ok: true, t: 'الاستقرار 90 وكل الفئات راضية' }; }
  const API = { money, debt, research, ap, calm };
  if (typeof module !== 'undefined') module.exports = API; else root.WCHEAT = API;
})(typeof window !== 'undefined' ? window : globalThis);
