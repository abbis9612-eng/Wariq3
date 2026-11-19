// «الحرب الكبرى» GW11 B2: المستشارين — 3 نصائح حسب وضعك، كل وحدة بزر يوديك للمكان. بدون رسم؛ فحص tests/advise.test.mjs.
// كل نصيحة: { id, w (تحذير؟), p (أهمية)، t (النص)، a (الفعل: prod | eco:cash | eco:mor | dip:war | dip:ctry | ev | div:ID | cell:N | sam:N | base:N | arrow)، l (اسم الزر) }
(function (root) {
  function list(W, A, X, me = 0) {
    const { SIM, ECON, DIP } = X, out = [], add = o => out.push(o);
    const e = W.eco && W.eco[me], D = W.dip, my = SIM.alive(W).filter(d => d.side === me);
    const city = c => W.cells[c].city || 'منطقة';
    // 1) عرض من إيران أو حدث ينتظر قرارك
    if (D && D.offer) add({ id: 'offer', w: 1, p: 100, t: `✉️ إيران عارضة «${DIP.TERMS[D.offer.k].n}». ردّ عليها`, a: 'dip:war', l: 'شوف العرض' });
    if (D && D.ev && D.ev.length) add({ id: 'ev', w: 1, p: 95, t: `📢 «${DIP.EV[D.ev[0].id].n}» ينتظر قرارك`, a: 'ev', l: 'قرّر' });
    // هرمز
    if (D && D.hz && D.hz.closed && !D.hz.op) add({ id: 'hz', w: 1, p: 92, t: `⚓ هرمز مغلق من ${Math.floor((W.t - D.hz.since) / 24)} يوم: فلوس النفط واقفة. اطلب من أمريكا عملية فتح، أو هدنة`, a: 'dip:war', l: 'السياسة' });
    else if (D && D.hz && D.hz.warn) add({ id: 'hzw', w: 1, p: 88, t: '⚓ إيران تهدد تغلق هرمز: إذا تعبانة، هدنة ممكن توقف هذا', a: 'dip:war', l: 'السياسة' });
    // 2) فرق بلا إمداد (مطوّقة أو مقطوعة)
    const cut = my.filter(d => !W.sup[me][d.cell]);
    if (cut.length) add({ id: 'cut', w: 1, p: 90, t: `⛓ ${cut.length > 1 ? cut.length + ' فرق' : cut[0].n} بلا إمداد قرب ${city(cut[0].cell)}: تضعف كل ساعة. انسحب أو افتح طريق`, a: 'div:' + cut[0].id, l: 'روح إلها' });
    // 3) معركة دفاع خسرانة
    let worst = null; for (const b of W.battles.values()) if (b.side !== me && b.win > .62 && (!worst || b.win > worst.win)) worst = b;
    if (worst) add({ id: 'battle', w: 1, p: 85, t: `⚔ دفاعنا بـ${city(worst.tg)} ينكسر (إيران غالبة ${Math.round(worst.win * 100)}٪): دز احتياط أو طيارات إسناد`, a: 'cell:' + worst.tg, l: 'روح للمعركة' });
    // 4) الفلوس
    if (e && e.cash < 0) add({ id: 'debt', w: 1, p: 80, t: `💸 الخزينة بالدين (${e.cash.toFixed(1)} مليار): المعنويات تنزل. خفّف الشراء، أو أولوية «اقتصاد حرب»، أو اطلب مساعدة من الخليج`, a: 'eco:cash', l: 'الاقتصاد' });
    else if (e && e.last && e.last.net < 0 && e.cash < 4) add({ id: 'cash', w: 1, p: 70, t: `💰 الخزينة تخلص (${e.cash.toFixed(1)} مليار و${Math.round(e.last.net * 1000)} مليون باليوم)`, a: 'eco:cash', l: 'الاقتصاد' });
    // 5) بطارية دفاع جوي تخلص صواريخها والمخزن فاضي
    if (A) A.sams.forEach((s, i) => { if (s.side !== me || out.some(o => o.id === 'sam')) return; const m = s.mags.find(q => !q.gun); if (!m) return;
      if (m.ready + m.stock <= m.orig * .25 && !(A.pool[me][m.n] > 0)) add({ id: 'sam', w: 1, p: 75, t: `🚀 ${s.n}: باقي ${m.ready + m.stock} صاروخ ${m.n} ومخزن البلد فاضي. اشتري`, a: 'prod', l: 'اشتري' }); });
    // C2: مورّد قاطع أو مقصّر بقطع الغيار
    if (W.dip) for (const x of ['us', 'ru', 'cn']) { const ks = Object.keys(ECON.SUPPLY[me]).filter(k => ECON.SUPPLY[me][k] === x); if (!ks.length) continue; const pf = ECON.parts(W, me, ks[0]); if (pf < 1) { add({ id: 'parts', w: 1, p: 68, t: `🔧 قطع غيار ${ECON.SUP_N[x]} ${Math.round(pf * 100)}٪: ${ks.includes('f16') ? 'طيارات F-16 محبوسة، ' : ''}الشراء أغلى. حسّن العلاقة`, a: 'dip:ctry', l: 'السياسة' }); break; } }
    // 6) المعنويات
    if (e && e.mor < 40) add({ id: 'mor', w: 1, p: 65, t: `😟 معنويات الشعب ${Math.round(e.mor)}: تحت 30 الإنتاج يبطأ، وتحت 25 نستسلم أبكر. جرّب أولوية «مدني»، أو انتصار على مدينة`, a: 'eco:mor', l: 'الشعب' });
    // 7) إيران تعبانة: فرصة سلام
    if (D && !W.over && !(D.peaceCd > W.t)) { const k = ['rep', 'keep', 'sq'].find(k => DIP.verdict(W, 1 - me, k).ok); if (k) add({ id: 'peace', w: 0, p: 60, t: `🕊 إيران تعبانة: تقبل «${DIP.TERMS[k].n}» على الأغلب`, a: 'dip:war', l: 'اعرض' }); }
    // 8) الطيارات نازلة
    if (A) { const n = A.bases.filter(b => b.side === me).reduce((s, b) => s + b.n0, 0), mx = A.bases.filter(b => b.side === me).reduce((s, b) => s + b.max, 0);
      if (n < mx * .5 && e && !e.auto && !e.q.some(o => ECON.ITEMS[o.k].cat === 'plane')) add({ id: 'planes', w: 1, p: 55, t: `✈ باقي ${n} من ${mx} طيارة وما طالبين تعويض`, a: 'prod', l: 'اطلب' }); }
    // 9) خطوط إنتاج فاضية
    if (e && !e.auto && e.q.length < e.lines) add({ id: 'lines', w: 0, p: 45, t: `🏭 ${e.lines - e.q.length} خط إنتاج فاضي: ممكن تطلب فرق أو صواريخ`, a: 'prod', l: 'الإنتاج' });
    // 10) دولة قريبة تدخل ويانا
    if (D) for (const C of DIP.COUNTRIES) { const c = D.c[C.id]; if (C.join && c.st === 'neutral' && c.rel[me] >= C.join - 12 && c.rel[me] < C.join) { add({ id: 'ally', w: 0, p: 40, t: `🤝 ${C.f} ${C.n} علاقتها ${Math.round(c.rel[me])}: باقي ${Math.ceil(C.join - c.rel[me])} وتدخل الحرب ويانا`, a: 'dip:ctry', l: 'السياسة' }); break; } }
    // 11) جسر مقطوع ورا جبهتنا
    const br = (W.bridges || []).find(b => b.down > 0 && b.by !== me && (W.ctrl[b.i] === me || W.ctrl[b.j] === me));
    if (br) add({ id: 'bridge', w: 0, p: 35, t: `🌉 إيران قطعت جسر ${br.n}: الإمداد يدوّر، والمهندسين يصلحونه بـ${Math.ceil(br.down / 24)} يوم`, a: 'cell:' + br.i, l: 'وين؟' });
    // 12) نصيحة للبداية: ارسم سهم بالدروع
    if (W.t < 24 * 10 && !(W.plans || []).some(p => p.side === me)) add({ id: 'arrow', w: 0, p: 20, t: '🏹 جرّب: 🪖 الجيش ← «اختر الجيش» ← «🏹 سهم» وارسم الهجوم بإصبعك. الدروع تصير رأس الحربة', a: 'arrow', l: 'الجيوش' });
    return out.sort((a, b) => b.p - a.p).slice(0, 3);
  }
  const API = { list };
  if (typeof module !== 'undefined') module.exports = API; else root.ADV = API;
})(this);
