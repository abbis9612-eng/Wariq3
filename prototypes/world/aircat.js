// «العالم» W5 (D-050): كتالوج الطيارات والدفاع الجوي لكل العالم — يضيف على كتالوج «الحرب الكبرى» (air.js: PLANES وSYS) بنفس الوحدات والمعاني.
// الأرقام من مصادر مفتوحة (مدى، سرعة، أفق الرادار)، والاحتمالات [ASSUMPTION] بنفس منطق docs/features/grandwar-air-defense.md.
(function (root) {
  const AIR = root.AIR || (typeof require !== 'undefined' ? require('./gwair.js') : null);
  const SC = 60, KMS = ms => ms * SC / 1000;
  const P = AIR.PLANES, S = AIR.SYS;
  // ===== الطيارات (المفاتيح الموجودة: f16، su25، f14، su24، ch4، m6) =====
  const add = (o, k, v) => { if (!o[k]) o[k] = v; };
  add(P, 'f35', { n: 'F-35', night: 1, v: KMS(260), aa: .7, ag: 1.25, ecm: .45, rcs: .005, cruise: 9, low: .3, hi: 1, harm: 1, aam: { n: 'AIM-120C', r: 80, v: KMS(1300), pk: .55 } });
  add(P, 'f15', { n: 'F-15', night: 1, v: KMS(270), aa: .75, ag: 1.15, ecm: .75, rcs: 25, cruise: 9, low: .3, hi: 1, aam: { n: 'AIM-120', r: 70, v: KMS(1300), pk: .5 } });
  add(P, 'f18', { n: 'F/A-18', night: 1, v: KMS(250), aa: .6, ag: 1, ecm: .75, rcs: 5, cruise: 8, low: .25, hi: 1, harm: 1, aam: { n: 'AIM-120', r: 70, v: KMS(1300), pk: .5 } });
  add(P, 'euro', { n: 'رافال/تايفون/غريبن', night: 1, v: KMS(270), aa: .72, ag: 1.05, ecm: .6, rcs: 1.5, cruise: 9, low: .25, hi: 1, aam: { n: 'ميتيور/ميكا', r: 80, v: KMS(1200), pk: .55 } });
  add(P, 'flanker', { n: 'سو-30/35، J-11/16', night: 1, v: KMS(270), aa: .68, ag: .95, ecm: .8, rcs: 12, cruise: 9, low: .3, hi: 1, aam: { n: 'R-77 / PL-12', r: 70, v: KMS(1200), pk: .45 } });
  add(P, 'su34', { n: 'سو-34', night: 1, v: KMS(250), aa: .3, ag: 1.3, ecm: .85, rcs: 10, cruise: 7, low: .2, hi: 1, harm: 1 });
  add(P, 'j20', { n: 'J-20 / سو-57', night: 1, v: KMS(280), aa: .75, ag: 1, ecm: .5, rcs: .1, cruise: 10, low: .3, hi: 1, aam: { n: 'PL-15 / R-77M', r: 100, v: KMS(1400), pk: .5 } });
  add(P, 'light', { n: 'ميغ-29، J-10، JF-17، ميراج 2000، تيجاس', night: 1, v: KMS(250), aa: .52, ag: .85, ecm: .9, rcs: 4, cruise: 7, low: .25, aam: { n: 'R-27 / PL-12 / MICA', r: 45, v: KMS(1100), pk: .38 } });
  add(P, 'old', { n: 'ميغ-21، F-5، F-7، F-4', night: 0, v: KMS(230), aa: .3, ag: .55, ecm: 1, rcs: 4, cruise: 6, low: .2, aam: { n: 'R-60 / AIM-9', r: 8, v: KMS(800), pk: .3 } });
  add(P, 'jet_tr', { n: 'طائرات تدريب مسلحة (T-50، L-159، هوك، K-8)', night: 0, v: KMS(220), aa: .2, ag: .6, ecm: 1, rcs: 3, cruise: 5, low: .15 });
  add(P, 'tb2', { n: 'مسيّرة استطلاع (TB2، هيرون، وينغ لونغ)', night: 1, v: KMS(55), aa: 0, ag: 0, ecm: 1, rcs: .3, cruise: 5, low: 5, isr: 1, drone: 1, endur: 350, eye: 40 });
  // من اسم موديل (بالبيانات) ← نوع طيارة بالمحرك
  const PL_RX = [[/f-35/i, 'f35'], [/f-22|j-20|su-57|j-35/i, 'j20'], [/f-15/i, 'f15'], [/f\/a-18|f-18|hornet/i, 'f18'], [/rafale|typhoon|eurofighter|gripen/i, 'euro'],
    [/su-30|su-35|su-27|j-11|j-15|j-16|flanker/i, 'flanker'], [/su-34/i, 'su34'], [/su-24|tornado|jaguar|q-5/i, 'su24'], [/su-25|a-10|su-22|a-29|super tucano/i, 'su25'], [/f-14/i, 'f14'],
    [/f-16|kf-21/i, 'f16'], [/mig-29|mig-35|j-10|jf-17|mirage 2000|tejas|fc-1/i, 'light'], [/mig-21|f-5|f-7|j-7|f-4|mirage (iii|5|f1)|mig-23|kfir/i, 'old'], [/t-50|fa-50|l-159|hawk|k-8|m-346|l-39|yak-130|aermacchi|alpha jet/i, 'jet_tr']];
  const planeType = m => (PL_RX.find(([rx]) => rx.test(m)) || [0, 'light'])[1];

  // ===== الدفاع الجوي (الموجودة: pac، pantsir، s300، bavar، khordad، tor) =====
  const M = (n, r, pk, o = {}) => ({ n, ready: o.ready ?? 16, perL: o.perL ?? 4, stock: o.stock ?? 8, v: KMS(o.v ?? 1300), r, zMax: o.zMax ?? 25, zMin: o.zMin ?? .02, pk, salvo: o.salvo || { air: 2, uav: 1, cm: 2, tbm: 2 }, ...(o.res ? { res: o.res } : {}), ...(o.gun ? { gun: 1 } : {}) });
  const sys = (k, o) => add(S, k, { cold: 0, slew: 0, pack: .5, setup: .5, reload: 45, uav: 'self', react: .15, gap: .06, ...o });
  sys('s400', { n: 'S-400', full: 'S-400 «تريومف» (48N6DM / 40N6)', layer: 'بعيد', hm: 25, det: 400, ch: 10, mg: 20, cold: 1, pack: .1, setup: .1, reload: 60,
    mags: [M('48N6DM', { air: 250, uav: 60, cm: 80, tbm: 60 }, { air: .75, uav: .75, cm: .65, tbm: .55 }, { ready: 32, v: 2000, zMax: 30, zMin: .01 })] });
  sys('hq9', { n: 'HQ-9', full: 'HQ-9 / FD-2000', layer: 'بعيد', hm: 20, det: 300, ch: 6, mg: 12, mags: [M('HQ-9B', { air: 200, uav: 60, cm: 70, tbm: 40 }, { air: .7, uav: .75, cm: .6, tbm: .5 }, { ready: 24, v: 1900, zMax: 27 })] });
  sys('sampt', { n: 'SAMP/T', full: 'SAMP/T «ماما» (أستر 30)', layer: 'بعيد', hm: 8, det: 250, ch: 10, mg: 16, mags: [M('Aster 30', { air: 120, uav: 50, cm: 60, tbm: 25 }, { air: .75, uav: .85, cm: .75, tbm: .55 }, { ready: 32, perL: 8, v: 1400, zMax: 20 })] });
  sys('thaad', { n: 'ثاد', full: 'THAAD (رادار AN/TPY-2)', layer: 'باليستي', hm: 5, det: 1000, ch: 8, mg: 16, reload: 60, uav: 'none',
    mags: [M('THAAD', { tbm: 200 }, { tbm: .85 }, { ready: 48, perL: 8, stock: 24, v: 2800, zMax: 150, zMin: 40, salvo: { tbm: 2 } })] });
  sys('arrow', { n: 'حيتس (آرو)', full: 'آرو 2 / آرو 3', layer: 'باليستي', hm: 10, det: 800, ch: 6, mg: 12, uav: 'none',
    mags: [M('Arrow 3', { tbm: 150 }, { tbm: .8 }, { ready: 24, perL: 6, stock: 12, v: 2500, zMax: 100, zMin: 10, salvo: { tbm: 2 } })] });
  sys('dsling', { n: 'مقلاع داود', full: 'مقلاع داود (ستانر)', layer: 'متوسط', hm: 10, det: 250, ch: 6, mg: 12, mags: [M('Stunner', { air: 100, uav: 50, cm: 70, tbm: 40 }, { air: .7, uav: .85, cm: .8, tbm: .6 }, { ready: 24, perL: 12, v: 2000 })] });
  sys('idome', { n: 'القبة الحديدية', full: 'القبة الحديدية (تامير)', layer: 'قريب', hm: 8, det: 70, ch: 8, mg: 20, react: .08, gap: .03, pack: .3, setup: .3, reload: 20, uav: 'all',
    mags: [M('Tamir', { air: 10, uav: 40, cm: 40 }, { air: .4, uav: .85, cm: .8 }, { ready: 60, perL: 20, stock: 60, v: 700, zMax: 10, salvo: { air: 1, uav: 1, cm: 1 } })] });
  sys('nasams', { n: 'ناسامز', full: 'NASAMS (AIM-120 AMRAAM)', layer: 'متوسط', hm: 10, det: 120, ch: 6, mg: 12, uav: 'all', mags: [M('AMRAAM', { air: 30, uav: 25, cm: 25 }, { air: .7, uav: .8, cm: .75 }, { ready: 24, perL: 6, v: 1300, zMax: 16 })] });
  sys('irist', { n: 'IRIS-T SLM', full: 'IRIS-T SLM', layer: 'متوسط', hm: 10, det: 250, ch: 8, mg: 16, uav: 'all', mags: [M('IRIS-T SL', { air: 40, uav: 35, cm: 35 }, { air: .75, uav: .9, cm: .85 }, { ready: 24, perL: 8, v: 1100, zMax: 20 })] });
  sys('buk', { n: 'بوك', full: 'بوك-M2/M3 (9M317)', layer: 'متوسط', hm: 8, det: 160, ch: 4, mg: 8, uav: 'all', mags: [M('9M317', { air: 45, uav: 30, cm: 25, tbm: 10 }, { air: .65, uav: .7, cm: .55, tbm: .3 }, { ready: 16, perL: 4, v: 1200, zMax: 25 })] });
  sys('hq16', { n: 'HQ-16', full: 'HQ-16 / LY-80', layer: 'متوسط', hm: 8, det: 150, ch: 4, mg: 8, mags: [M('HQ-16', { air: 40, uav: 30, cm: 25 }, { air: .62, uav: .7, cm: .55 }, { ready: 24, perL: 6, v: 1200 })] });
  sys('cheong', { n: 'تشونغونغ', full: 'تشونغونغ-II (KM-SAM)', layer: 'متوسط', hm: 8, det: 100, ch: 6, mg: 12, mags: [M('KM-SAM II', { air: 40, uav: 30, cm: 30, tbm: 20 }, { air: .7, uav: .8, cm: .7, tbm: .5 }, { ready: 32, perL: 8, v: 1500 })] });
  sys('akash', { n: 'آكاش', full: 'آكاش', layer: 'متوسط', hm: 8, det: 120, ch: 4, mg: 8, mags: [M('Akash', { air: 30, uav: 25, cm: 25 }, { air: .6, uav: .65, cm: .55 }, { ready: 24, perL: 3, v: 900 })] });
  sys('barak8', { n: 'باراك-8', full: 'باراك-8 / MRSAM', layer: 'متوسط', hm: 10, det: 200, ch: 8, mg: 16, mags: [M('Barak 8', { air: 70, uav: 50, cm: 60 }, { air: .7, uav: .8, cm: .75 }, { ready: 32, perL: 8, v: 1400 })] });
  sys('hawk', { n: 'هوك', full: 'MIM-23 هوك', layer: 'متوسط', hm: 6, det: 100, ch: 1, mg: 2, reload: 60, mags: [M('MIM-23', { air: 40, uav: 20, cm: 20 }, { air: .45, uav: .5, cm: .35 }, { ready: 9, perL: 3, v: 800, zMax: 18, zMin: .06 })] });
  sys('kub', { n: 'كوب (SA-6)', full: '2K12 كوب', layer: 'متوسط', hm: 6, det: 75, ch: 1, mg: 3, mags: [M('3M9', { air: 24, uav: 15, cm: 12 }, { air: .45, uav: .4, cm: .3 }, { ready: 12, perL: 3, v: 900, zMax: 14 })] });
  sys('s125', { n: 'S-125 (SA-3)', full: 'S-125 «بتشورا»', layer: 'متوسط', hm: 6, det: 110, ch: 1, mg: 2, reload: 60, mags: [M('V-601', { air: 25, uav: 15, cm: 10 }, { air: .4, uav: .35, cm: .25 }, { ready: 8, perL: 2, v: 900, zMax: 18 })] });
  sys('s75', { n: 'S-75 (SA-2)', full: 'S-75 «دفينا»', layer: 'بعيد', hm: 8, det: 150, ch: 1, mg: 3, reload: 90, mags: [M('V-750', { air: 45, cm: 10 }, { air: .3, cm: .15 }, { ready: 6, perL: 1, v: 1000, zMax: 27, zMin: .3 })] });
  sys('s200', { n: 'S-200 (SA-5)', full: 'S-200 «فيغا»', layer: 'بعيد', hm: 20, det: 300, ch: 1, mg: 2, reload: 120, uav: 'none', mags: [M('5V28', { air: 250 }, { air: .3 }, { ready: 6, perL: 1, v: 1200, zMax: 40, zMin: .3 })] });
  sys('crotale', { n: 'قصير المدى (كروتال، HQ-7، أفنجر، ستريلا-10)', full: 'دفاع جوي قصير', layer: 'قريب', hm: 4, det: 20, ch: 1, mg: 2, react: .1, gap: .05, reload: 20, uav: 'all',
    mags: [M('قصير', { air: 10, uav: 8, cm: 8 }, { air: .45, uav: .6, cm: .5 }, { ready: 8, perL: 4, v: 800, zMax: 5, zMin: .005 })] });
  const SAM_RX = [[/s-400/i, 's400'], [/s-300/i, 's300'], [/hq-9|fd-2000/i, 'hq9'], [/patriot|pac-[23]/i, 'pac'], [/samp|aster 30|mamba/i, 'sampt'], [/thaad/i, 'thaad'], [/arrow/i, 'arrow'], [/david/i, 'dsling'],
    [/iron dome/i, 'idome'], [/nasams/i, 'nasams'], [/iris-t/i, 'irist'], [/buk/i, 'buk'], [/hq-16|ly-80/i, 'hq16'], [/cheongung|km-sam/i, 'cheong'], [/akash/i, 'akash'], [/barak/i, 'barak8'],
    [/hawk/i, 'hawk'], [/kub|sa-6/i, 'kub'], [/s-125|pechora|sa-3/i, 's125'], [/s-75|sa-2/i, 's75'], [/s-200|sa-5/i, 's200'], [/bavar/i, 'bavar'], [/khordad|sayyad-3/i, 'khordad'], [/pantsir/i, 'pantsir'], [/tor\b|tor-m|9k330/i, 'tor']];
  const samType = m => (SAM_RX.find(([rx]) => rx.test(m)) || [0, 'crotale'])[1];
  // ===== ذخائر الضربات المركّبة لكل دولة (الإيرانية موجودة: fateh، f313، zolf، shahed، paveh) =====
  const MU = AIR.MUN, bm = (n, range, ap) => ({ n, kind: 'bm', range, ap, wh: 1.1, rcs: .3 }), uv = (n, v, range) => ({ n, kind: 'uav', v: KMS(v), z: .6, wh: .35, rcs: .1, range }), cm = (n, v, range) => ({ n, kind: 'cm', v: KMS(v), z: .04, wh: .9, rcs: .1, range });
  Object.assign(MU, { ...MU, iskander: MU.iskander || bm('إسكندر-M', 500, 100), geran: MU.geran || uv('جيران-2', 51, 2000), kalibr: MU.kalibr || cm('كاليبر', 250, 1500),
    lyuty: MU.lyuty || uv('ليوتي', 55, 1000), neptune: MU.neptune || cm('نبتون', 250, 400), atacms: MU.atacms || bm('ATACMS', 300, 80),
    brahmos: MU.brahmos || cm('براهموس', 800, 450), prithvi: MU.prithvi || bm('بريثفي', 350, 90), babur: MU.babur || cm('بابر', 250, 700), ghaznavi: MU.ghaznavi || bm('غزنوي/شاهين', 300, 80),
    df15: MU.df15 || bm('DF-15/16', 800, 160), cj10: MU.cj10 || cm('CJ-10', 250, 1500), hwasong: MU.hwasong || bm('KN-23', 700, 140), lora: MU.lora || bm('لورا/جريكو', 400, 100),
    harop: MU.harop || uv('هاروب', 50, 1000), tomahawk: MU.tomahawk || cm('توماهوك', 250, 1600), scalp: MU.scalp || cm('ستورم شادو/سكالب', 280, 550), tb_kamikaze: MU.tb_kamikaze || uv('مسيّرة انتحارية', 50, 1000),
    srbm: MU.srbm || bm('صاروخ باليستي قصير', 300, 80), cmgen: MU.cmgen || cm('صاروخ كروز', 250, 1000), bayraktar_k: MU.bayraktar_k || uv('مسيّرة انتحارية', 50, 1000) });
  const MUN_OF = { RUS: { bm: 'iskander', uav: 'geran', cm: 'kalibr' }, BLR: { bm: 'iskander', uav: 'geran', cm: 'kalibr' }, UKR: { bm: 'atacms', uav: 'lyuty', cm: 'neptune' }, IND: { bm: 'prithvi', uav: 'harop', cm: 'brahmos' },
    PAK: { bm: 'ghaznavi', uav: 'tb_kamikaze', cm: 'babur' }, CHN: { bm: 'df15', uav: 'tb_kamikaze', cm: 'cj10' }, PRK: { bm: 'hwasong', uav: 'tb_kamikaze', cm: 'cmgen' }, ISR: { bm: 'lora', uav: 'harop', cm: 'cmgen' },
    USA: { bm: 'atacms', uav: 'tb_kamikaze', cm: 'tomahawk' }, GBR: { bm: 'srbm', uav: 'tb_kamikaze', cm: 'scalp' }, FRA: { bm: 'srbm', uav: 'tb_kamikaze', cm: 'scalp' }, IRN: null, YEM: null };
  const munOf = id => id in MUN_OF ? MUN_OF[id] : { bm: 'srbm', uav: 'tb_kamikaze', cm: 'cmgen' };
  const API = { planeType, munOf, samType, PL_RX, SAM_RX };
  if (typeof module !== 'undefined') module.exports = API; else root.AIRCAT = API;
})(this);
