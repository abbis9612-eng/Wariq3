// معركة الهجوم — نقل حرفي لوحدة Battle من index.html (D-024)
// نفس الـ34 ثانية، نفس المراحل، نفس الترتيب والسرعات وجدول الخسائر. بدون أي رسم.
// الميدان افتراضي 440×800 «بكسل» مثل شاشة تلفون؛ الرسم 3D يعتبر البكسل = متر.
// كل رسمة بالأصل (puff/flash/crater/snd) صارت حدث Fx يقراه الرسم.

export const VW = 440, VH = 800, FIELD = 3000, END = 34, CARD = 32;
export const PPM = VH / FIELD;
export const PH: [number, string][] = [[0, 'استطلاع بالمسيّرات'], [4, 'تمهيد مدفعي'], [11, 'ضربات جوية'], [15, 'ستار دخان'], [18, 'تقدّم الدروع'], [25, 'اقتحام المشاة'], [32, '']];

export interface Comp { troops: number; tank: number; air: number; arty: number; ad: number; drone: number; heli: number; navy?: number }
export type Terr = 'desert' | 'plain' | 'hills' | 'mount';
export interface Res { ca: Comp; cd: Comp; la: number; ld: number; win: boolean; cap: boolean; fell: boolean; captured: boolean; rname: string; wk: number; terr: Terr; an?: string; bn?: string }

export type Kind = 'tank' | 'inf' | 'arty' | 'mlrs' | 'ad';
export interface Unit { id: number; side: 0 | 1; type: Kind; x: number; y: number; a: number; cd: number; alive: boolean; die: number; vx: number; vy: number; rot: number; moving?: boolean; burn?: number; fireT: number }
export interface Bld { id: number; x: number; y: number; w: number; h: number; r: number; c: number; dead: boolean }
export interface Air { id: number; kind: 'drone' | 'jet'; x: number; y: number; vx: number; vy: number; side: 0 | 1; drop: boolean }
export interface Heli { id: number; side: 0; x: number; y: number; ty: number; t0: number; cd: number; alive: boolean; rot: number; fireT: number }
export type PKind = 'shell' | 'tank' | 'rocket' | 'msl' | 'atgm' | 'mg';
export interface Proj { id: number; x: number; y: number; sx: number; sy: number; tx: number; ty: number; t: number; dur: number; kind: PKind }

export type Fx =
  | { k: 'boom'; x: number; y: number; cal: number }                 // explode(): انفجار + حفرة + اهتزاز
  | { k: 'muzzle'; x: number; y: number; a: number; kind: PKind; src: number } // fire(): ومضة + غبار + صوت
  | { k: 'mg'; x: number; y: number; src: number }                   // صوت رشاش
  | { k: 'mghit'; x: number; y: number }
  | { k: 'mslhit'; x: number; y: number }
  | { k: 'screen'; x: number; y: number }                            // ستار الدخان
  | { k: 'house'; id: number }                                        // بيت انهدم
  | { k: 'jet'; id: number }
  | { k: 'die'; id: number };

export interface World {
  T: number; res: Res; r: () => number;
  u: Unit[]; b: Bld[]; pr: Proj[]; air: Air[]; heli: Heli[]; ev: { t: number; f: () => void }[];
  fx: Fx[]; nid: number; ended: boolean;
}

const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
export const icons = (n: number, max: number, k: number) => n <= 0 ? 0 : clamp(Math.round(Math.log2(n + 1) * k), 1, max);

export function create(res: Res, rnd: () => number = Math.random): World {
  const w: World = { T: 0, res, r: rnd, u: [], b: [], pr: [], air: [], heli: [], ev: [], fx: [], nid: 1, ended: false };
  const R = (a: number, b: number) => a + rnd() * (b - a);
  const W_ = VW, H = VH, m = PPM, ca = res.ca, cd = res.cd, u = w.u;
  const unit = (side: 0 | 1, type: Kind, x: number, y: number): Unit => ({ id: w.nid++, side, type, x, y, a: side ? Math.PI / 2 : -Math.PI / 2, cd: R(.5, 4), alive: true, die: 1e9, vx: 0, vy: 0, rot: R(0, 6), fireT: -9 });
  const lay = (side: 0 | 1, type: Kind, n: number, yf: number, spread: number) => { for (let i = 0; i < n; i++) { const x = W_ * (.5 + (n === 1 ? 0 : (i / (n - 1) - .5)) * spread) + R(-14, 14); u.push(unit(side, type, x, H * yf + R(-.025, .025) * H)); } };
  lay(0, 'tank', icons(ca.tank, 9, 1.05), .86, .8); lay(0, 'inf', icons(ca.troops, 7, .8), .93, .85); lay(0, 'arty', icons(ca.arty, 5, .6), .975, .7); lay(0, 'mlrs', ca.arty > 60 ? 2 : ca.arty > 10 ? 1 : 0, .965, .3); lay(0, 'ad', icons(ca.ad, 2, .3), .95, .5);
  lay(1, 'tank', icons(cd.tank, 8, .95), .25, .75); lay(1, 'inf', icons(cd.troops, 7, .8), .2, .8); lay(1, 'arty', icons(cd.arty, 4, .55), .05, .7); lay(1, 'ad', icons(cd.ad, 2, .3), .09, .5);
  // بيوت
  const nb = res.cap ? 26 : 14; for (let i = 0; i < nb; i++) { const bw = R(16, 30) * m * 1.6 + 6; w.b.push({ id: i, x: W_ * .5 + R(-.3, .3) * W_, y: H * (.13 + R(-.07, .09)), w: bw, h: bw * R(.7, 1.3), r: R(-.2, .2), c: Math.floor(rnd() * 4), dead: false }); }
  // مروحيات وطيران ومسيّرات
  const nh = icons(ca.heli, 3, .45); for (let i = 0; i < nh; i++) w.heli.push({ id: w.nid++, side: 0, x: W_ * (.25 + .5 * i / Math.max(1, nh - 1 || 1)), y: H * 1.08, ty: H * (.5 + R(-.05, .05)), t0: 19 + i * 1.2, cd: 1, alive: true, rot: 0, fireT: -9 });
  const E = (t: number, f: () => void) => w.ev.push({ t, f });
  if (ca.drone > 0) E(.3, () => w.air.push({ id: w.nid++, kind: 'drone', x: W_ * .2, y: H * 1.05, vx: W_ * .02, vy: -H * .055, side: 0, drop: false }));
  if (cd.drone > 0) E(1.5, () => w.air.push({ id: w.nid++, kind: 'drone', x: W_ * .8, y: -H * .05, vx: -W_ * .02, vy: H * .05, side: 1, drop: false }));
  const nj = icons(ca.air, 4, .5); for (let i = 0; i < nj; i++) E(11 + i * .9, () => jet(w, 0, W_ * (.25 + .5 * rnd())));
  const njd = icons(cd.air, 2, .35); for (let i = 0; i < njd; i++) E(13 + i * 1.4, () => jet(w, 1, W_ * (.25 + .5 * rnd())));
  for (let i = 0; i < 10; i++) E(15 + i * .25, () => { const x = W_ * (.08 + .84 * i / 9); w.fx.push({ k: 'screen', x, y: H * (.52 + R(-.03, .03)) }); });
  // جدول الخسائر
  const kill = (side: 0 | 1, frac: number, t0: number, t1: number) => { const l = u.filter(x => x.side === side && x.type !== 'arty' && x.type !== 'mlrs'), n = Math.round(l.length * frac); l.sort(() => rnd() - .5).slice(0, n).forEach(x => x.die = R(t0, t1)); };
  kill(0, clamp(res.la * 4.5, .05, .8), 19, 31); kill(1, res.win ? clamp(.45 + res.ld * 1.5, .5, .95) : clamp(res.ld * 2.5, .08, .4), 5, 31);
  const da = u.filter(x => x.side === 1 && (x.type === 'arty' || x.type === 'ad')); da.slice(0, Math.round(da.length * (res.win ? .7 : .2))).forEach(x => x.die = R(6, 16));
  return w;
}

function jet(w: World, side: 0 | 1, x: number) {
  const R = (a: number, b: number) => a + w.r() * (b - a), H = VH;
  const j: Air = { id: w.nid++, kind: 'jet', x, y: side ? -40 : H + 40, vx: R(-20, 20), vy: (side ? 1 : -1) * 300 * PPM * 1.6, side, drop: false };
  w.air.push(j); w.fx.push({ k: 'jet', id: j.id });
}
function enemyOf(w: World, side: number) { const l = w.u.filter(x => x.side !== side && x.alive); return l.length ? l[Math.floor(w.r() * l.length)] : null; }
function fire(w: World, from: { x: number; y: number; id: number }, tx: number, ty: number, kind: PKind) {
  const sp = ({ shell: 520, tank: 1500, rocket: 420, msl: 650, atgm: 300, mg: 1 } as const)[kind] * PPM, d = Math.hypot(tx - from.x, ty - from.y);
  w.pr.push({ id: w.nid++, x: from.x, y: from.y, sx: from.x, sy: from.y, tx, ty, t: 0, dur: Math.max(.08, d / sp), kind });
  const a = Math.atan2(ty - from.y, tx - from.x); w.fx.push({ k: 'muzzle', x: from.x, y: from.y, a, kind, src: from.id });
}
function explode(w: World, x: number, y: number, cal: number) {
  const r = cal * PPM * 14 + 3; w.fx.push({ k: 'boom', x, y, cal });
  w.b.forEach(b => { if (!b.dead && Math.hypot(b.x - x, b.y - y) < r * 2 + b.w / 2 && w.r() < .5 + cal * .12) { b.dead = true; w.fx.push({ k: 'house', id: b.id }); } });
}

export function step(w: World, dt: number) {
  w.T += dt; const t = w.T, u = w.u, res = w.res, H = VH, ppm = PPM;
  const R = (a: number, b: number) => a + w.r() * (b - a);
  // الأحداث المجدولة (نسخة حتى الحدث يكدر يضيف أحداث)
  const due = w.ev.filter(e => e.t <= t); w.ev = w.ev.filter(e => e.t > t); due.forEach(e => e.f());
  const adv = res.win ? 1 : .45;
  u.forEach(x => {
    if (!x.alive) return;
    if (t >= x.die) { x.alive = false; w.fx.push({ k: 'die', id: x.id }); const sh = enemyOf(w, x.side); if (sh && x.type !== 'inf') { w.pr.push({ id: w.nid++, x: sh.x, y: sh.y, sx: sh.x, sy: sh.y, tx: x.x, ty: x.y, t: 0, dur: .25, kind: 'tank' }); w.fx.push({ k: 'muzzle', x: sh.x, y: sh.y, a: Math.atan2(x.y - sh.y, x.x - sh.x), kind: 'tank', src: sh.id }); } explode(w, x.x, x.y, x.type === 'inf' ? 1 : 2); x.burn = x.type === 'inf' ? 0 : R(8, 20); return; }
    x.cd -= dt;
    if (x.side === 0) { const go = x.type === 'tank' ? t > 18 : x.type === 'inf' ? t > 24.5 : false; if (go && t < 32) { const lim = H * (x.type === 'tank' ? (.86 - .5 * adv) : (.93 - .62 * adv)); if (x.y > lim) { const v = (x.type === 'tank' ? 11 : 3.2) * ppm * 3.2; x.y -= v * dt; x.vy = -v; x.moving = true; } else { x.moving = false; x.vy = 0; } } else { x.moving = false; x.vy = 0; } }
    else if (!res.win && t > 27 && x.type === 'tank' && x.y < H * .4) { x.y += 6 * ppm * 3 * dt; x.vy = 6 * ppm * 3; x.moving = true; }
    if (x.cd <= 0) {
      const e = enemyOf(w, x.side); if (!e) return; const sc = () => R(-1, 1) * 40 * ppm * 3;
      if (x.type === 'arty') { if (t > 4 && t < 30) { x.a = Math.atan2(e.y - x.y, e.x - x.x); fire(w, x, e.x + sc() * 2, e.y + sc() * 2, 'shell'); x.fireT = t; x.cd = R(3, 6); } else x.cd = 1; }
      else if (x.type === 'mlrs') { if (t > 5 && t < 16) { x.a = Math.atan2(e.y - x.y, e.x - x.x); for (let i = 0; i < 6; i++) w.ev.push({ t: t + i * .18, f: () => { const q = enemyOf(w, 0); if (q) { fire(w, x, q.x + sc() * 3, q.y + sc() * 3, 'rocket'); x.fireT = w.T; } } }); x.cd = 7; } else x.cd = 1; }
      else if (x.type === 'tank') { if (t > 17.5 && Math.hypot(e.x - x.x, e.y - x.y) < 2200 * ppm * 1.4) { x.a = Math.atan2(e.y - x.y, e.x - x.x); fire(w, x, e.x + sc() * .4, e.y + sc() * .4, 'tank'); x.fireT = t; x.cd = R(2.5, 5); } else x.cd = .6; }
      else if (x.type === 'inf') { if (t > 23 && Math.hypot(e.x - x.x, e.y - x.y) < 1200 * ppm * 1.6) { x.a = Math.atan2(e.y - x.y, e.x - x.x); for (let i = 0; i < 4; i++) w.ev.push({ t: t + i * .09, f: () => { w.fx.push({ k: 'mg', x: x.x, y: x.y, src: x.id }); x.fireT = w.T; w.pr.push({ id: w.nid++, x: x.x, y: x.y, sx: x.x, sy: x.y, tx: e.x + R(-12, 12), ty: e.y + R(-12, 12), t: 0, dur: .12, kind: 'mg' }); } }); x.cd = R(.8, 2); } else x.cd = .7; }
      else if (x.type === 'ad') { const j = w.air.find(z => z.side !== x.side && z.y > 0 && z.y < H); if (j) { x.a = Math.atan2(j.y - x.y, j.x - x.x); fire(w, x, j.x + j.vx * .8, j.y + j.vy * .8, 'msl'); x.fireT = t; x.cd = 4; } else x.cd = .5; }
    }
  });
  w.heli.forEach(h => { if (t < h.t0 || !h.alive) return; h.rot += dt * 40; if (h.y > h.ty) h.y -= 70 * ppm * 3 * dt; else { h.x += Math.sin(t + h.t0) * 8 * dt; h.cd -= dt; if (h.cd <= 0 && t < 31) { const e = enemyOf(w, 0); if (e) { fire(w, h, e.x, e.y, 'atgm'); h.fireT = t; h.cd = R(2.5, 4); } } } });
  w.air = w.air.filter(j => {
    j.x += j.vx * dt; j.y += j.vy * dt;
    if (j.kind === 'jet' && !j.drop && (j.side ? j.y > H * .7 : j.y < H * .3)) { j.drop = true; for (let i = 0; i < 3; i++) { const e = enemyOf(w, j.side); if (e) w.ev.push({ t: w.T + i * .2, f: () => explode(w, e.x + R(-30, 30), e.y + R(-30, 30), 3) }); } }
    return j.y > -80 && j.y < H + 80;
  });
  w.pr = w.pr.filter(p => {
    p.t += dt; const k = p.t / p.dur; p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k;
    if (k >= 1) { if (p.kind === 'mg') w.fx.push({ k: 'mghit', x: p.tx, y: p.ty }); else if (p.kind === 'msl') w.fx.push({ k: 'mslhit', x: p.tx, y: p.ty }); else explode(w, p.tx, p.ty, p.kind === 'shell' ? 2.4 : p.kind === 'rocket' ? 2 : 1.3); return false; }
    return true;
  });
  u.forEach(x => { if (x.burn! > 0) x.burn! -= dt; });
}

/** شريطي القوة مثل hud() بالأصل (نسبة مئوية) */
export function bars(w: World) { const T = w.T, res = w.res, pa = clamp((T - 19) / 12, 0, 1), pd = clamp((T - 5) / 26, 0, 1); return { a: 100 - res.la * 100 * pa * 2.2, d: 100 - res.ld * 100 * pd * (res.win ? 1.6 : 1) }; }
export const phase = (T: number) => PH.filter(p => p[0] <= T).pop()![1];
/** زر «تخطّي» بالأصل */
export function skip(w: World) { if (w.T < 31.9) { w.T = 31.9; w.ev = []; w.u.forEach(x => { if (x.die < 1e8) x.die = 0; }); } }
export const stamp = (res: Res) => res.fell ? 'سقطت العاصمة' : res.captured ? 'سيطرة كاملة' : res.win ? 'نجحت العملية' : 'فشل الهجوم';

/** أمثلة نتائج للتجربة (نفس شكل doOp) */
export const SAMPLES: Record<string, Res> = {
  win: { ca: { troops: 42000, tank: 220, air: 40, arty: 140, ad: 20, drone: 30, heli: 24 }, cd: { troops: 26000, tank: 120, air: 12, arty: 60, ad: 14, drone: 8, heli: 4 }, la: .07, ld: .22, win: true, cap: false, fell: false, captured: false, rname: 'البصرة', wk: 3, terr: 'desert' },
  lose: { ca: { troops: 18000, tank: 60, air: 6, arty: 30, ad: 6, drone: 4, heli: 2 }, cd: { troops: 40000, tank: 200, air: 30, arty: 120, ad: 24, drone: 20, heli: 10 }, la: .16, ld: .05, win: false, cap: false, fell: false, captured: false, rname: 'الموصل', wk: 4, terr: 'hills' },
  capital: { ca: { troops: 60000, tank: 400, air: 80, arty: 260, ad: 30, drone: 60, heli: 40 }, cd: { troops: 30000, tank: 150, air: 20, arty: 80, ad: 20, drone: 10, heli: 6 }, la: .05, ld: .3, win: true, cap: true, fell: true, captured: true, rname: 'العاصمة', wk: 5, terr: 'plain' },
};
