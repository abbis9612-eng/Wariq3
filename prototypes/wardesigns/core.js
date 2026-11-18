// الأساس المشترك للنماذج الأربعة (WD0، I-078، D-038): الجيوش، معادلة المعركة، أدوات.
// نفس الجيوش ونفس المعادلة بكل النماذج، حتى المقارنة تكون على طريقة اللعب بس.
'use strict';
const GM = [0, 1, 1.6, 2.5, 3.8, 5.5];   // نفس جدول الأجيال باللعبة
const SIDE = [{ n: 'العراق', f: '🇮🇶', fem: false }, { n: 'إيران', f: '🇮🇷', fem: true }];
const TERR = {   // def: بونص المدافع، arm: فعالية الدروع، mv: سرعة الحركة
  plain: { n: 'سهل', def: 1, arm: 1, mv: 1 }, desert: { n: 'صحراء', def: 1, arm: 1, mv: .9 }, hills: { n: 'تلال', def: 1.35, arm: .85, mv: .75 },
  mount: { n: 'جبال', def: 2.1, arm: .45, mv: .45 }, marsh: { n: 'أهوار', def: 1.6, arm: .4, mv: .4 }, city: { n: 'مدينة', def: 2, arm: .6, mv: .7 },
};
const KIND = { armor: { n: 'مدرعة', g: '⬭', spd: 1.3 }, mech: { n: 'آلية', g: '⬭✕', spd: 1.2 }, inf: { n: 'مشاة', g: '✕', spd: .8 }, sf: { n: 'قوات خاصة', g: 'ق', spd: 1 }, mtn: { n: 'جبلية', g: '▲', spd: .9 } };
// ---------- الجيوش (من مخزون العراق وإيران باللعبة؛ أسماء مقترحة) ----------
// men أفراد، tk دبابات، ifv مدرعات مشاة، gun مدافع وراجمات، gen جيل الدبابات، q تدريب
function makeArmies() {
  const D = (side, n, kind, men, tk, ifv, gun, gen, q = 1) => ({ side, n, kind, men, tk, ifv, gun, gen, q, men0: men, tk0: tk, ifv0: ifv, gun0: gun, org: 100, dug: 0, exp: 0 });
  const iq = [
    D(0, 'الفرقة 9 المدرعة', 'armor', 9000, 88, 60, 36, 4, 1.1), D(0, 'الفرقة 10 المدرعة', 'armor', 9000, 62, 60, 36, 4),
    D(0, 'الفرقة 5 الآلية', 'mech', 10000, 93, 90, 36, 2), D(0, 'الفرقة 8 الآلية', 'mech', 10000, 89, 90, 36, 1.4),
    D(0, 'الفرقة 1 مشاة', 'inf', 12000, 0, 20, 36, 1), D(0, 'الفرقة 7 مشاة', 'inf', 12000, 0, 20, 36, 1), D(0, 'الفرقة 11 مشاة', 'inf', 12000, 0, 20, 24, 1),
    D(0, 'الفرقة 14 مشاة', 'inf', 12000, 0, 20, 24, 1), D(0, 'الفرقة 15 مشاة', 'inf', 12000, 0, 20, 24, 1), D(0, 'الفرقة 16 مشاة', 'inf', 11000, 0, 15, 24, 1),
    D(0, 'فرقة المهام الخاصة', 'sf', 6000, 0, 40, 0, 1, 1.4), D(0, 'الفرقة 3 جبلية', 'mtn', 10000, 0, 10, 18, 1, 1.05),
  ];
  const ir = [
    D(1, 'الفرقة 92 المدرعة', 'armor', 11000, 100, 70, 54, 2.3), D(1, 'الفرقة 81 المدرعة', 'armor', 11000, 110, 70, 54, 2), D(1, 'الفرقة 16 المدرعة', 'armor', 11000, 100, 60, 54, 2),
    D(1, 'الفرقة 88 المدرعة', 'armor', 11000, 110, 60, 36, 1), D(1, 'الفرقة 77 الآلية', 'mech', 12000, 70, 90, 54, 1.6), D(1, 'الفرقة 21 الآلية', 'mech', 12000, 70, 90, 54, 1.5),
    D(1, 'الفرقة 28 مشاة', 'inf', 13000, 30, 20, 54, 1), D(1, 'الفرقة 64 مشاة', 'inf', 13000, 30, 20, 54, 1), D(1, 'الفرقة 30 مشاة', 'inf', 13000, 20, 20, 54, 1),
    D(1, 'فرقة الحرس 27', 'inf', 14000, 20, 30, 36, 1, 1.1), D(1, 'فرقة الحرس 31', 'inf', 14000, 20, 30, 36, 1, 1.1), D(1, 'فرقة الحرس 8', 'inf', 14000, 10, 20, 36, 1, 1.1),
    D(1, 'فرقة الحرس 41', 'inf', 14000, 10, 20, 36, 1, 1.1), D(1, 'فرقة الحرس 25', 'inf', 14000, 10, 20, 36, 1, 1.1),
    D(1, 'الفرقة 58 جبلية', 'mtn', 11000, 0, 10, 36, 1, 1.05), D(1, 'لواء صابرين الخاص', 'sf', 5000, 0, 20, 0, 1, 1.3),
  ];
  let id = 1; return [...iq, ...ir].map(u => Object.assign(u, { id: id++ }));
}
// قوة الجو والصواريخ (نفس اللعبة: جيل × عدد) — العراق F-16 أحدث، إيران عدد أكبر وصواريخ أكثر
const AIR = [{ sorties: 3, power: 1.15, msl: 2 }, { sorties: 3, power: .95, msl: 4 }];
// ---------- معادلة المعركة ----------
const str = u => (u.men / u.men0 * .45 + (u.tk0 ? u.tk / u.tk0 : 1) * .3 + (u.ifv0 ? u.ifv / u.ifv0 : 1) * .15 + (u.gun0 ? u.gun / u.gun0 : 1) * .1);
/** قوة الوحدة: att بالهجوم (الدروع تخترق)، def بالدفاع (المشاة المحصّنة قوية) */
function unitPower(u, role, terr) {
  const T = TERR[terr] || TERR.plain, g = GM[Math.floor(u.gen)] + (GM[Math.ceil(u.gen)] - GM[Math.floor(u.gen)]) * (u.gen % 1);
  const inf = u.men / 100 * (role === 'def' ? 5.2 : 1.7) * (u.kind === 'mtn' && (terr === 'mount' || terr === 'hills') ? 1.6 : 1) * (u.kind === 'sf' ? 1.5 : 1);
  const arm = (u.tk * g * (role === 'att' ? 4 : 3.8) + u.ifv * g * 1.7) * T.arm;
  const art = u.gun * 1.9;
  return (inf + arm + art) * u.q * (.5 + .5 * u.org / 100) * (1 + .2 * u.exp);
}
/** يحسب المعركة: att/def قوائم وحدات. ctx: terr، air (طلعات جوية لكل طرف)، msl، supply، flank. يرجع النسبة والعوامل */
function battleCalc(att, def, ctx) {
  const terr = ctx.terr || 'plain', T = TERR[terr];
  const PA = att.reduce((s, u) => s + unitPower(u, 'att', terr), 0), PD = def.reduce((s, u) => s + unitPower(u, 'def', terr), 0);
  const dug = def.length ? def.reduce((s, u) => s + u.dug, 0) / def.length : 0;
  const airA = (ctx.airA || 0) * AIR[att[0]?.side ?? 0].power, airD = (ctx.airD || 0) * AIR[def[0]?.side ?? 1].power;
  const f = {
    'العدد والمعدات والجيل': PD ? PA / PD : 9,
    'الأرض': 1 / T.def,
    'التحصين': 1 / (1 + .7 * dug),
    'الجو والصواريخ': (1 + .12 * airA + .1 * (ctx.mslA || 0)) / (1 + .12 * airD + .1 * (ctx.mslD || 0)),
    'الإمداد': (ctx.supA ?? 1) / (ctx.supD ?? 1),
    'الأجناب': ctx.flank || 1,
    'الحظ': ctx.luck ?? (.85 + Math.random() * .3),
  };
  const R = Object.values(f).reduce((a, b) => a * b, 1);
  return { R, f, PA, PD };
}
/** يطبق خسائر أسبوع قتال (أو جزء منه w) حسب النسبة: الأس 0.6 مو تربيعي (بيانات معارك حقيقية) */
function applyBattle(att, def, R, w = 1) {
  const k = Math.pow(R, .6), lD = Math.min(.45, .09 * k) * w, lA = Math.min(.45, .09 / k) * w;
  const hit = (u, l, orgL) => { u.men = Math.max(0, u.men * (1 - l)); u.tk = Math.max(0, u.tk * (1 - l * 1.15)); u.ifv = Math.max(0, u.ifv * (1 - l * 1.1)); u.gun = Math.max(0, u.gun * (1 - l * .5)); u.org = Math.max(0, u.org - orgL); u.exp = Math.min(1, u.exp + .04 * w); };
  def.forEach(u => hit(u, lD, 40 * Math.min(2, k) * w)); att.forEach(u => hit(u, lA, 40 * Math.min(2, 1 / k) * w));
  return { lA, lD };
}
const alive = u => str(u) > .12;
// شرح النتيجة بسطر: أكبر عاملين لصالح كل طرف
function whyText(f, attSide) {
  const e = Object.entries(f).filter(([k]) => k !== 'الحظ').map(([k, v]) => [k, Math.log(v)]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
  return e.map(([k, v]) => `${k}: ${v > 0 ? SIDE[attSide].f : SIDE[1 - attSide].f} ×${Math.exp(Math.abs(v)).toFixed(1)}`).join(' · ');
}
// ---------- أدوات ----------
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const fmt = n => Math.round(n).toLocaleString('en');
const fmtK = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + ' ألف' : String(Math.round(n));
const vb = (s, m, f) => SIDE[s].fem ? f : m;
// ---------- صوت خفيف (اختياري) ----------
const SND = (() => { let ac = null, on = true; const ctx = () => { if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { } return ac; };
  const tone = (f0, f1, d, type = 'sine', v = .2) => { if (!on) return; const a = ctx(); if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, a.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), a.currentTime + d); g.gain.setValueAtTime(v, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + d); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + d); };
  const boom = (v = .35) => { if (!on) return; const a = ctx(); if (!a) return; const b = a.createBuffer(1, a.sampleRate * .6, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = v; s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start(); tone(90, 35, .5, 'sine', v); };
  return { click: () => tone(900, 600, .06, 'square', .05), move: () => tone(300, 520, .15, 'triangle', .08), boom, win: () => { tone(520, 780, .25, 'triangle', .12); setTimeout(() => tone(780, 1040, .3, 'triangle', .12), 180); }, toggle: () => (on = !on), get on() { return on; } }; })();
