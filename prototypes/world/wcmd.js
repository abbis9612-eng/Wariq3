// «العالم» I-108: قائد القوات المسلحة — رتبة ومهارات وخبرة، ونسبة زيادة بقوة الجيش، والانتشار واللوجستيك [تقدير]
// التصميم: docs/features/world-cmd.md · فحص: node tests/wcmd.test.mjs
// الأسماء متولّدة (خيالية) حسب منطقة الدولة، مو أشخاص حقيقيين.
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const RANK = ['لواء', 'فريق', 'فريق أول', 'مشير'], STARS = ['★', '★★', '★★★', '★★★★'], XPN = [0, 120, 300, 600];
  const SK = { atk: '⚔ هجوم', def: '🛡 دفاع', log: '🚚 لوجستيك', plan: '🗺 تخطيط' };
  const SKD = { atk: 'الهجوم +2.5٪ لكل نقطة', def: 'الصلابة والتنظيم +2.5٪ لكل نقطة', log: 'الانتشار للجبهة +12٪ سرعة، الإنتاج +4٪، عقود السلاح أسرع 5٪ لكل نقطة', plan: 'الحرب المختصرة (بلا جبهة) +3٪ وتحضير الخطط أقصر لكل نقطة' };
  // أسماء (خيالية) حسب المنطقة
  const N = {
    arab: [['عبد الكريم', 'صالح', 'قاسم', 'حيدر', 'سعد', 'فاضل', 'ماجد', 'رعد', 'خالد', 'عماد', 'ناصر', 'طارق'], ['الجبوري', 'العبيدي', 'الزبيدي', 'الشمري', 'الربيعي', 'التميمي', 'الدليمي', 'الحسيني', 'الخزرجي', 'العاني', 'المالكي', 'السامرائي']],
    fa: [['محمد رضا', 'علي أكبر', 'حسين', 'مهدي', 'غلام علي', 'أمير'], ['رستمي', 'كاظمي', 'شاهرخي', 'نوري', 'بهرامي', 'سليماني فر']],
    tr: [['مراد', 'أوغوز', 'كمال', 'أردم', 'يلماز', 'جنكيز'], ['أكسوي', 'دمير', 'قايا', 'أرسلان', 'توران', 'أوزتورك']],
    ru: [['أليكسي', 'فاليري', 'ديمتري', 'سيرغي', 'أندريه', 'إيغور'], ['فولكوف', 'سوكولوف', 'موروزوف', 'لِبيديف', 'كوزلوف', 'نوفيكوف']],
    west: [['جيمس', 'روبرت', 'مارك', 'توماس', 'دانيال', 'ريتشارد'], ['هاريسون', 'كولينز', 'بريستون', 'والكر', 'هيوز', 'لاندري']],
    asia: [['وي', 'هونغ', 'جين', 'كينجي', 'مين جون', 'راهول'], ['تشانغ', 'ليو', 'تاناكا', 'كيم', 'شارما', 'نغوين']],
    af: [['أمادو', 'كوامي', 'جوزيف', 'إبراهيم', 'موسى', 'سامويل'], ['ديالو', 'أوكونكو', 'مبيكي', 'توري', 'كامارا', 'أوبيانغ']],
    lat: [['كارلوس', 'خوسيه', 'لويس', 'ميغيل', 'فرناندو', 'رافائيل'], ['ريبيرو', 'ألفاريز', 'مندوزا', 'سيلفا', 'روخاس', 'كاسترو']],
  };
  const ARAB = /^(IRQ|SYR|JOR|LBN|PSX|SAU|KWT|BHR|QAT|ARE|OMN|YEM|EGY|LBY|TUN|DZA|MAR|MRT|SDN|SOM|DJI)$/;
  const grp = (id, cont) => ARAB.test(id) ? 'arab' : /^(IRN|AFG|TJK)$/.test(id) ? 'fa' : /^(TUR|AZE|TKM|UZB|KAZ|KGZ)$/.test(id) ? 'tr' : /^(RUS|BLR|UKR|SRB|BGR|MDA|ARM|GEO|MNG)$/.test(id) ? 'ru'
    : cont === 'as' || cont === 'oc' && id === 'PNG' ? 'asia' : cont === 'af' ? 'af' : cont === 'sa' || /^(MEX|CUB|DOM|GTM|HND|NIC|PAN|SLV|CRI)$/.test(id) ? 'lat' : 'west';
  const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hash = s => { let h = 11; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; };
  // جودة القيادة للذكاء 1–5: جيل الدبابات والطيارات + التقنية + خبرة الحرب [تقدير]
  function quality(WD, id) { const cs = WD.cs[id] || {}, g = cs.gen || {}, t = cs.tech || {}, war = (cs.war && cs.war.length) || (cs.conf && cs.conf.length) ? .5 : 0;
    return clamp(Math.round(((g.tank || 2) + (g.jet || 2)) / 2 - .5 + ((t.arm || 0) + (t.uav || 0) + (t.ew || 0)) / 6 + war + (hash(id) % 3 - 1) * .5), 1, 5); }
  // مرشح: مجموع المهارات حسب جودة الدولة، موزّع حسب «طبع» المرشح
  function cand(WD, id, seed, q, cont) { const r = mul(seed), [F, L] = N[grp(id, cont)], pts = 4 + q * 2 + Math.floor(r() * 3), sk = { atk: 0, def: 0, log: 0, plan: 0 }, K = Object.keys(sk);
    const lean = K[Math.floor(r() * 4)]; for (let i = 0; i < pts; i++) { const k = r() < .4 ? lean : K[Math.floor(r() * 4)]; if (sk[k] < 5) sk[k]++; else i--; if (K.every(x => sk[x] >= 5)) break; }
    return { n: F[Math.floor(r() * F.length)] + ' ' + L[Math.floor(r() * L.length)], rank: q >= 4 ? 1 : 0, xp: 0, sk, lean, since: 0 }; }
  function ensure(G, WD) {
    if (!G.cmdq) { G.cmdq = {}; for (const id of G.ids) G.cmdq[id] = quality(WD, id); }
    if (!G.cmd) { const q = G.cmdq[G.me], cont = (WD.cs[G.me] || {}).cont; G.cmd = { c: cand(WD, G.me, (G.seed || 1) * 7 + hash(G.me), q, cont), cands: [], candT: -999, chg: -999, drill: -999 }; }
    return G.cmd;
  }
  function cands(G, WD) { const C = ensure(G, WD); if (G.t - C.candT > 365 || !C.cands.length) { const q = G.cmdq[G.me], cont = (WD.cs[G.me] || {}).cont; C.cands = [1, 2, 3].map(i => cand(WD, G.me, (G.seed || 1) * 131 + G.t * 7 + i * 977 + hash(G.me), clamp(q + (i === 3 ? 1 : 0) - (i === 1 ? 1 : 0), 1, 5), cont)); C.candT = G.t; } return C.cands; }
  // نِسب الزيادة (يقراها المسرح والمحاكاة والإنتاج والسوق)
  function mult(c) { const R = c.rank, s = c.sk; return { atk: 1 + .03 * R + .025 * s.atk, def: 1 + .03 * R + .025 * s.def, move: 1 + .12 * s.log, prod: 1 + .04 * s.log, deal: 1 - .05 * s.log, plan: 1 + .03 * s.plan + .03 * R }; }
  const power = c => { const m = mult(c); return +((m.atk + m.def) / 2).toFixed(3); };
  const k = (G, id) => id === G.me && G.cmd ? mult(G.cmd.c).plan : 1 + .03 * (((G.cmdq || {})[id] || 3) - 3);   // للحرب المختصرة (wsim sidePower)
  // كل يوم: خبرة (الحرب أكثر) والترقية
  function daily(G, X) { const C = G.cmd; if (!C) return null; const c = C.c, war = G.wars.some(w => w.a.includes(G.me) || w.b.includes(G.me));
    c.xp += war ? 1 + (X && X.wins ? X.wins * 4 : 0) : .08; if (C.drill > G.t - 30) c.xp += .3;
    if (c.rank < 3 && c.xp >= XPN[c.rank + 1]) { c.rank++; const pts = Object.keys(c.sk).filter(x => c.sk[x] < 5); if (pts.length) c.sk[c.lean && c.sk[c.lean] < 5 ? c.lean : pts[0]]++; G.log.push({ t: G.t, k: 'cmd', a: 'promo', n: c.n, r: RANK[c.rank] }); return 'promo'; }
    return null; }
  function change(G, WD, i) { const C = ensure(G, WD), L = cands(G, WD), n = L[i]; if (!n) return 'غلط'; if (G.ap < 1) return 'نقاط القرار ما تكفي';
    G.ap -= 1; const often = G.t - C.chg < 365; C.c = { ...n, since: G.t }; C.cands.splice(i, 1); C.chg = G.t;
    if (often && G.nat && G.nat.home.fac.army != null) G.nat.home.fac.army = Math.max(0, G.nat.home.fac.army - 5);
    G.log.push({ t: G.t, k: 'cmd', a: 'new', n: n.n, often }); return { ok: true, often }; }
  const drillCost = G => Math.max(.05, G.C[G.me].gdp * .001);
  function drill(G) { const C = G.cmd; if (!C) return 'ماكو قائد'; if (G.t - C.drill < 60) return 'مناورات قريبة، انتظر ' + Math.ceil((60 - G.t + C.drill) / 30) + ' شهر'; const v = drillCost(G); if (G.nat && G.nat.eco[0].cash < v) return 'الخزينة ما تكفي';
    if (G.nat) G.nat.eco[0].cash -= v; C.drill = G.t; C.c.xp += 15; G.log.push({ t: G.t, k: 'cmd', a: 'drill', v: +v.toFixed(2) }); return { ok: true }; }
  // قائد دولة ثانية (للعرض): اسم ورتبة ثابتين من جودتها
  const AIC = {}; function ai(G, WD, id) { if (AIC[id]) return AIC[id]; const q = (G.cmdq || {})[id] || quality(WD, id), c = cand(WD, id, hash(id) * 13 + 5, q, (WD.cs[id] || {}).cont); c.rank = clamp(q - 2, 0, 3); return AIC[id] = c; }
  const API = { ai, RANK, STARS, XPN, SK, SKD, quality, ensure, cands, mult, power, k, daily, change, drill, drillCost };
  if (typeof module !== 'undefined') module.exports = API; else root.WCMD = API;
})(this);
