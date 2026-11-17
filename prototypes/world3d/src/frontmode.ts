// «الجبهة كاملة» (WM14.3–14.4، I-072، I-073): ألوية العراق وإيران على حدودهم الحقيقية، تتحرك وتشتبك تلقائياً (orbat.ts).
// العرض حسب البعد: بعيد = عدّاد لكل قطاع (رمز عسكري + ×عدد + شريط قوة)، وسط = عدّاد لكل لواء، قريب = كتائب بمجسمات 3D تتقاتل.
// الرموز مثل الناتو (APP-6): الصديق مستطيل أزرق، العدو معيّن أحمر؛ بيضوي = دروع، × = مشاة، الاثنين = آلي؛ X فوقه = لواء.
import { Vector3, Matrix, type Quaternion, type Scene } from '@babylonjs/core';
import { Front, bdeStr, bdeMen, bdeCount, bdeCount0, EQ, TERR_AR, KIND_AR, type Bde, type FrontData, type Side, type Kind, type BnT } from './orbat';
import FDjson from './front.json';
import { cam, camera } from './cam';
const FD = FDjson as unknown as FrontData;
type P = { x: number; y: number; z?: number };
export interface Ctx {
  scene: Scene; unitAt: (key: string, n: string, side: 0 | 1, p: { x: number; y: number; z: number }, q: Quaternion, o?: { dead?: boolean; tur?: number; noFlag?: boolean }) => unknown; orient: (hd: number) => Quaternion;
  fx: (kind: 'glow' | 'tracer' | 'ex' | 'ring' | 'spark', p: P, size: number, life: number, minPx: number, tint?: number, vx?: number, vy?: number, to?: P) => void;
  blast: (p: P, r: number, ground: boolean, big?: number) => void; puff: (p: P, r: number, gr: number, life: number, a: number, tint: number, minPx?: number) => void;
  caption: (t: string) => void; ground: (x: number, y: number) => number; camW: () => number; size: () => number;
}
export const FLAG = ['🇮🇶', '🇮🇷'];
const fmt = (n: number) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + ' ألف' : String(Math.round(n));
const R = (a: number, b: number) => a + Math.random() * (b - a);
// شكل الرمز (SVG): إطار حسب الطرف + علامة النوع
function glyph(side: Side, kind: Kind) {
  const fr = side === 0 ? '<rect x="2" y="2" width="32" height="20" rx="1.5"/>' : '<path d="M18 1 35 12 18 23 1 12Z"/>';
  const box = side === 0 ? [4, 4, 32, 20] : [10, 6, 26, 18];
  const ov = `<ellipse cx="18" cy="12" rx="${side === 0 ? 9 : 6}" ry="${side === 0 ? 5 : 3.4}" class="g"/>`, x = `<path class="g" d="M${box[0]} ${box[1]} ${box[2]} ${box[3]}M${box[2]} ${box[1]} ${box[0]} ${box[3]}"/>`;
  return `<svg viewBox="0 0 36 24" class="fr">${fr}${kind === 'inf' ? x : kind === 'armor' ? ov : ov + x}</svg>`;
}
interface Ct { el: HTMLDivElement; bar: HTMLElement; org: HTMLElement; num: HTMLElement; arr: HTMLElement; mult?: HTMLElement; key: string; last: string }
export class FrontView {
  W: Front; t = 0; acc = 0; ended = false; root: HTMLDivElement; svg: SVGSVGElement; terr: SVGPathElement[]; line: SVGPathElement; line2: SVGPathElement;
  cts = new Map<string, Ct>(); vis = new Map<number, { x: number; y: number }>(); btEl = new Map<number, HTMLDivElement>();
  focusQ: { key: string; x: number; y: number; w: number; hd?: number; until: number; pri: number; t0: number } | null = null; cycle = 0; tier: 'far' | 'mid' | 'near' = 'far';
  onTap: (b: Bde | null, sec: number | null, stack?: boolean) => void = () => {};
  constructor(public C: Ctx, seed = Math.floor(Math.random() * 1e6)) {
    this.W = new Front(FD, seed);
    this.root = document.createElement('div'); this.root.id = 'front'; document.body.appendChild(this.root);
    const NS = 'http://www.w3.org/2000/svg';
    this.svg = document.createElementNS(NS, 'svg') as SVGSVGElement; this.svg.setAttribute('class', 'fsvg'); this.root.appendChild(this.svg);
    this.terr = [0, 1].map(s => { const p = document.createElementNS(NS, 'path') as SVGPathElement; p.setAttribute('class', 'terr t' + s); this.svg.appendChild(p); return p; });
    this.line2 = document.createElementNS(NS, 'path') as SVGPathElement; this.line2.setAttribute('class', 'fl2'); this.svg.appendChild(this.line2);
    this.line = document.createElementNS(NS, 'path') as SVGPathElement; this.line.setAttribute('class', 'fl'); this.svg.appendChild(this.line);
  }
  dispose() { this.root.remove(); }
  // ---------- الزمن: ساعة لعب لكل ثانية حقيقية بـ ×1 ----------
  update(hours: number) {
    if (this.ended) return;
    this.acc += hours; let n = 0;
    while (this.acc >= 1 && n < 64) { this.acc -= 1; n++; this.W.step(); for (const e of this.W.ev.splice(0)) this.onEvent(e); if (this.W.t >= 24 * 30) { this.ended = true; break; } }
  }
  onEvent(e: { type: string; s?: number; side?: Side; txt: string }) {
    const s = e.s ?? 0, fp = this.W.fp(s), sd = e.side ?? 0, sec = this.W.secs[s], hd = Math.atan2(sec.n[1], sec.n[0]) + (sd === 1 ? Math.PI : 0);
    const pri: Record<string, number> = { city: 5, break: 4, op: 3, gather: 2, battle: 2, retreat: 1 };
    if (['city', 'break', 'op', 'gather'].includes(e.type)) this.C.caption(`${FLAG[sd]} ${e.txt}`);
    if (pri[e.type] && (!this.focusQ || pri[e.type] >= this.focusQ.pri || performance.now() > this.focusQ.until))
      this.focusQ = { key: e.type + s + this.W.t, x: fp.x, y: fp.y, w: e.type === 'gather' ? 70000 : 40000, hd, until: performance.now() + (e.type === 'city' || e.type === 'break' ? 10000 : 7000), pri: pri[e.type], t0: performance.now() };
  }
  /** وسط المعركة: معدل مواقع الألوية اللي تتقاتل */
  spot(s: number) {
    // نقطة التماس: بين أول مهاجم وأول مدافع (نفس الترتيب اللي بـ Front.place، فهم مقابل بعض)
    const f = (sd: Side) => this.W.bdes.filter(b => b.s === s && b.side === sd && b.fight && this.vis.has(b.id)).sort((x, y) => x.id - y.id)[0];
    const a = f(0), d = f(1); if (!a || !d) return this.W.fp(s);
    const va = this.vis.get(a.id)!, vd = this.vis.get(d.id)!; return { x: (va.x + vd.x) / 2, y: (va.y + vd.y) / 2 };
  }
  overview() { const xs = this.W.secs.map(s => s.c[0]), ys = this.W.secs.map(s => s.c[1]); return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, z: 0, w: 1.25e6, ts: 1, key: 'overview' }; }
  /** المخرج: حدث مهم ← معركة جارية بالتناوب ← نظرة الجبهة كلها */
  director(): { x: number; y: number; z: number; w: number; ts: number; key: string; hd?: number } {
    const now = performance.now();
    if (this.focusQ && now < this.focusQ.until) { const f = this.focusQ; return { x: f.x, y: f.y, z: 0, w: f.w, ts: 1, key: f.key, hd: f.hd }; }
    const bts = [...this.W.battles.values()].sort((a, b) => a.s - b.s);
    if (bts.length) { const b = bts[Math.floor(now / 12000) % bts.length], fp = this.spot(b.s), sec = this.W.secs[b.s]; return { x: fp.x, y: fp.y, z: 0, w: 30000, ts: 1, key: 'bt' + b.s, hd: Math.atan2(sec.n[1], sec.n[0]) + (b.att === 1 ? Math.PI : 0) }; }
    return this.overview();
  }
  // ---------- الرسم ----------
  proj(x: number, y: number, tm: Matrix, vp: any, out: Vector3) { Vector3.ProjectToRef(new Vector3(x - cam.x, this.C.ground(x, y), y - cam.y), Matrix.IdentityReadOnly, tm, vp, out); return out.z > 0 && out.z < 1; }
  draw(rdt: number, SW: number, SH: number) {
    const W = this.W, cw = this.C.camW(), ext = Math.max(cw, cam.D * .84); this.tier = ext >= 140000 ? 'far' : ext >= 26000 ? 'mid' : 'near';   // حجم المنظر (العرض أو الطول، التلفون عمودي)
    const tm = this.C.scene.getTransformMatrix(), vp = camera.viewport.toGlobal(SW, SH), o = new Vector3();
    const pt = (x: number, y: number) => this.proj(x, y, tm, vp, o) ? `${o.x.toFixed(1)},${o.y.toFixed(1)}` : null;
    // الأرض المحتلة: مضلع لكل قطاع بين الحدود وخط الجبهة
    const tp = ['', ''];
    W.secs.forEach((s, i) => {
      const f = W.f[i]; if (Math.abs(f) < 800) return;
      const fa = (i > 0 ? (W.f[i - 1] + f) / 2 : f), fb = (i < W.secs.length - 1 ? (W.f[i + 1] + f) / 2 : f), n = s.n;
      const ring = [[s.a[0], s.a[1]], [s.c[0], s.c[1]], [s.b[0], s.b[1]], [s.b[0] + n[0] * fb, s.b[1] + n[1] * fb], [s.c[0] + n[0] * f, s.c[1] + n[1] * f], [s.a[0] + n[0] * fa, s.a[1] + n[1] * fa]];
      const ps = ring.map(q => pt(q[0], q[1])); if (ps.some(q => !q)) return;
      tp[f > 0 ? 0 : 1] += 'M' + ps.join('L') + 'Z';
    });
    this.terr[0].setAttribute('d', tp[0]); this.terr[1].setAttribute('d', tp[1]);
    // خط الجبهة (يتقطع إذا نقطة ورا الكاميرا)
    let d = '', pen = false;
    W.secs.forEach((s, i) => {
      // نفس نقاط مضلع الأرض: بداية القطاع ووسطه ونهايته (الألوية تنرتب على خط القطاع نفسه)
      const f = W.f[i], fa = i > 0 ? (W.f[i - 1] + f) / 2 : f, fb = i < W.secs.length - 1 ? (W.f[i + 1] + f) / 2 : f, n = s.n;
      const pts: number[][] = [[s.a[0] + n[0] * fa, s.a[1] + n[1] * fa], [s.c[0] + n[0] * f, s.c[1] + n[1] * f], [s.b[0] + n[0] * fb, s.b[1] + n[1] * fb]];
      for (const q of pts) { const p = pt(q[0], q[1]); if (!p) { pen = false; continue; } d += (pen ? 'L' : 'M') + p; pen = true; }
    });
    this.line.setAttribute('d', d); this.line2.setAttribute('d', d);
    // مواقع العرض تلحق مواقع المحاكاة بنعومة
    const k = 1 - Math.exp(-rdt * 2.5);
    for (const b of W.bdes) { if (!W.alive(b)) continue; let v = this.vis.get(b.id); if (!v) { v = { x: b.x, y: b.y }; this.vis.set(b.id, v); } v.x += (b.x - v.x) * k; v.y += (b.y - v.y) * k; }
    // العدّادات
    const used = new Set<string>(), boxes: number[][] = [];
    const place = (key: string, x: number, y: number, mk: () => Ct, upd: (c: Ct) => void, pri: number, hd?: number) => {
      if (!this.proj(x, y, tm, vp, o) || o.x < -40 || o.x > SW + 40 || o.y < -40 || o.y > SH + 40) return;
      const sx = o.x, sy = o.y, bx = [sx - 22, sy - 26, sx + 22, sy + 14];
      if (pri < 9 && boxes.some(q => bx[0] < q[2] && bx[2] > q[0] && bx[1] < q[3] && bx[3] > q[1])) return;
      boxes.push(bx); let c = this.cts.get(key); if (!c) { c = mk(); this.cts.set(key, c); this.root.appendChild(c.el); }
      used.add(key); c.el.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`; upd(c);
      if (hd !== undefined && this.proj(x + Math.cos(hd) * 3000, y + Math.sin(hd) * 3000, tm, vp, o)) { const a = Math.atan2(o.y - sy, o.x - sx); c.arr.style.display = ''; c.arr.style.transform = `rotate(${a.toFixed(2)}rad)`; } else c.arr.style.display = 'none';
    };
    const mkCt = (side: Side, kind: Kind, ech: string, b?: Bde, sec?: number): Ct => {
      const el = document.createElement('div'); el.className = `ct s${side}`;
      el.innerHTML = `<i class="arr"></i><div class="ech">${ech}</div>${glyph(side, kind)}<b class="mult"></b><div class="bar"><i></i></div><div class="org"><i></i></div><div class="num"></div>`;
      el.onclick = () => this.onTap(b ?? null, sec ?? null, !b);
      return { el, bar: el.querySelector('.bar i')!, org: el.querySelector('.org i')!, num: el.querySelector('.num')!, arr: el.querySelector('.arr')!, mult: el.querySelector('.mult')!, key: '', last: '' };
    };
    const setBar = (c: Ct, str: number, org: number, num: string, mult = '') => {
      const sig = `${Math.round(str * 50)}|${Math.round(org / 2)}|${num}|${mult}`; if (sig === c.last) return; c.last = sig;
      c.bar.style.width = `${Math.round(str * 100)}%`; c.bar.style.background = str > .66 ? '#52c46a' : str > .4 ? '#e6c040' : '#e0573a';
      c.org.style.width = `${Math.round(org)}%`; c.num.textContent = num; if (c.mult) c.mult.textContent = mult;
    };
    const bnum = (bs: Bde[]) => { const heavy = bs.some(b => b.kind !== 'inf'); const t = bs.reduce((s, b) => s + bdeCount(b, 'tank'), 0); return heavy && t >= 1 ? `${Math.round(t)} دبابة` : `${fmt(bs.reduce((s, b) => s + bdeMen(b), 0))}`; };
    if (this.tier === 'far') {
      // عدّاد لكل قطاع وطرف (مثل HOI4): الرمز حسب الأغلب، ×عدد الألوية، والقوة بالمعدل
      for (let i = 0; i < W.secs.length; i++) for (const side of [0, 1] as Side[]) {
        const bs = W.bdes.filter(b => b.side === side && b.s === i && W.alive(b) && b.mv < 0); if (!bs.length) continue;
        const kind: Kind = bs.some(b => b.kind === 'armor') ? 'armor' : bs.some(b => b.kind === 'mech') ? 'mech' : 'inf';
        // العدّاد بجهة طرفه من خط الجبهة (حتى ما يغطي على عدّاد العدو)
        const sec = W.secs[i], fp = W.fp(i), off = Math.max(7000, cw * .045) * (side === 0 ? -1 : 1), x = fp.x + sec.n[0] * off, y = fp.y + sec.n[1] * off;
        const atk = bs.some(b => b.post === 'attack');
        place(`s${i}_${side}_${kind}`, x, y, () => mkCt(side, kind, bs.length > 2 ? 'XX' : 'X', undefined, i), c => setBar(c, bs.reduce((s, b) => s + bdeStr(b), 0) / bs.length, bs.reduce((s, b) => s + b.org, 0) / bs.length, bnum(bs), bs.length > 1 ? `×${bs.length}` : ''), atk ? 8 : 5, atk ? Math.atan2(sec.n[1], sec.n[0]) + (side ? Math.PI : 0) : undefined);
      }
      // المتحركين بين القطاعات
      for (const b of W.bdes) if (W.alive(b) && b.mv >= 0) { const v = this.vis.get(b.id)!; place('b' + b.id, v.x, v.y, () => mkCt(b.side, b.kind, 'X', b), c => setBar(c, bdeStr(b), b.org, ''), 2, b.hd); }
    } else {
      for (const b of W.bdes) {
        if (!W.alive(b)) continue; const v = this.vis.get(b.id)!;
        const pri = b.fight ? 8 : b.post === 'attack' ? 7 : b.kind !== 'inf' ? 5 : 4;
        place('b' + b.id, v.x, v.y, () => mkCt(b.side, b.kind, 'X', b), c => { setBar(c, bdeStr(b), b.org, this.tier === 'near' ? '' : bnum([b])); c.el.classList.toggle('sm', this.tier === 'near'); c.el.classList.toggle('rt', b.post === 'retreat'); c.el.classList.toggle('od', !!b.ord); },
          pri, b.mv >= 0 || b.post === 'attack' || b.post === 'retreat' ? (b.post === 'retreat' ? b.hd + Math.PI : b.hd) : undefined);
      }
    }
    // علامات المعارك ⚔: شريط منو غالب (نصيب المهاجم = R/(1+R))
    for (const [s, bt] of W.battles) {
      const fp = this.spot(s), key = 'bt' + s;
      place(key, fp.x, fp.y, () => { const el = document.createElement('div'); el.className = 'ct btl'; el.innerHTML = '<div class="sw">⚔</div><div class="vs"><i></i></div><div class="num"></div>'; el.onclick = () => this.onTap(null, s); return { el, bar: el.querySelector('.vs i')!, org: el, num: el.querySelector('.num')!, arr: document.createElement('i'), key, last: '' }; },
        c => { const sh = bt.R / (1 + bt.R); const sig = `${Math.round(sh * 40)}|${bt.att}`; if (sig !== c.last) { c.last = sig; c.bar.style.width = `${Math.round(sh * 100)}%`; c.bar.parentElement!.className = 'vs a' + bt.att; c.num.textContent = TERR_AR[W.secs[s].terr]; } }, 9);
    }
    for (const [k2, c] of this.cts) if (!used.has(k2)) { c.el.style.transform = 'translate(-999px,-999px)'; if (k2.startsWith('bt') && !W.battles.has(+k2.slice(2))) { c.el.remove(); this.cts.delete(k2); } }
    this.battleFx(rdt, cw);
  }
  // ---------- قريب: كتائب 3D ----------
  layout(b: Bde) {
    // بالمعركة الكتائب الأمامية تتقدم لخط التماس (~700 م منه)، والمدفعية ورا
    const v = this.vis.get(b.id)!, hd = b.hd, fw = b.fight ? 1800 : 0, fx = Math.cos(hd), fy = Math.sin(hd), rx = Math.sin(hd), ry = -Math.cos(hd);
    const front = b.bns.filter(bn => bn.t === 'tank' || bn.t === 'mech' || bn.t === 'inf'), back = b.bns.filter(bn => bn.t === 'arty' || bn.t === 'mlrs');
    const out: { key: string; model: string; x: number; y: number; hd: number; dead: boolean; bn: BnT; flag: boolean }[] = [];
    // المجسمات مكبّرة حتى تنشاف (حد أدنى بالبكسل)، فالمسافات تكبر وياها حتى ما تتكدس؛ ومن أبعد مجسم واحد لكل كتيبة
    const mpp = this.C.camW() / Math.max(320, innerWidth), disp = Math.max(10, 44 * this.C.size() * mpp), per = disp * 1.15, nm = per * 3 < 900 ? 3 : 1, gap = Math.max(1100, per * nm * 1.35);
    const put = (bns: typeof front, fwd: number) => bns.forEach((bn, j) => {
      const along = (j - (bns.length - 1) / 2) * gap, it = bn.eq[0], model = bn.t === 'inf' ? 'truck' : it ? (bn.t === 'arty' ? 'truck' : EQ[it.id].model || 'truck') : 'truck';
      const alive = bn.t === 'inf' ? Math.round(nm * bn.men / bn.men0) : it ? Math.ceil(nm * it.n / Math.max(1, it.n0) - .15) : nm;
      for (let m = 0; m < nm; m++) { const a = along + (m - (nm - 1) / 2) * Math.max(170, per), f = fwd + (m % 2) * -Math.max(60, per * .3); out.push({ key: `fb${b.id}_${bn.t}${j}_${m}`, model, x: v.x + fx * f + rx * a, y: v.y + fy * f + ry * a, hd: hd + (m - 1) * .05, dead: m >= alive, bn: bn.t, flag: m === Math.floor(nm / 2) }); }
    });
    put(front, fw); put(back, fw - Math.max(2600, per * 3));
    return out;
  }
  place3d() {
    if (this.tier !== 'near') return;
    const r = this.C.camW() * 1.6;
    for (const b of this.W.bdes) {
      if (!this.W.alive(b)) continue; const v = this.vis.get(b.id); if (!v || Math.hypot(v.x - cam.x, v.y - cam.y) > r + 4000) continue;
      for (const u of this.layout(b)) this.C.unitAt(u.key, u.model, b.side, { x: u.x, y: u.y, z: 0 }, this.C.orient(u.hd), { dead: u.dead, tur: 0, noFlag: !u.flag });
    }
  }
  // مؤثرات المعارك: قريب = طلقات بين الكتائب وانفجارات؛ وسط/بعيد = ومضات مدفعية ودخان
  live = true;   // الوقت ماشي (مو موقف)؛ المؤثرات بس وقت الحركة
  battleFx(rdt: number, cw: number) {
    if (!this.live) return;
    for (const [s, bt] of this.W.battles) {
      const fp = this.W.fp(s); if (Math.hypot(fp.x - cam.x, fp.y - cam.y) > cw * 1.4) continue;
      const atk = this.W.inSec(s, bt.att).filter(b => b.fight), dfs = this.W.inSec(s, (1 - bt.att) as Side).filter(b => b.fight);
      if (!atk.length || !dfs.length) continue;
      if (this.tier === 'near') {
        if (Math.random() < rdt * 7) {
          const A = this.layout(atk[Math.floor(Math.random() * atk.length)]).filter(u => !u.dead && u.bn !== 'arty' && u.bn !== 'mlrs'), D = this.layout(dfs[Math.floor(Math.random() * dfs.length)]).filter(u => !u.dead);
          const flip = Math.random() < .45, a = (flip ? D : A)[Math.floor(Math.random() * (flip ? D : A).length)], d = (flip ? A : D)[Math.floor(Math.random() * (flip ? A : D).length)];
          if (a && d) { const to = { x: d.x + R(-40, 40), y: d.y + R(-40, 40), z: 1.5 }; this.C.fx('glow', { x: a.x, y: a.y, z: 2 }, 16, .15, 8, 0xffd27a); this.C.fx('tracer', { x: a.x, y: a.y, z: 2 }, 3, .45, 4, 0xffd27a, 0, 0, to);
            if (Math.random() < .35) setTimeout(() => this.C.blast(to, R(6, 12), true, .35), 400); }
        }
        if (Math.random() < rdt * 1.2) { const D = this.layout(dfs[0]); const q = D[Math.floor(Math.random() * D.length)]; if (q) this.C.blast({ x: q.x + R(-500, 500), y: q.y + R(-500, 500) }, R(14, 26), true, .55); }
      } else if (Math.random() < rdt * (this.tier === 'mid' ? 5 : 2)) {
        const b = [...atk, ...dfs][Math.floor(Math.random() * (atk.length + dfs.length))], v = this.vis.get(b.id)!, sp = this.tier === 'mid' ? 2500 : 8000;
        const p = { x: v.x + R(-sp, sp), y: v.y + R(-sp, sp) };
        this.C.fx('glow', p, cw * .012, .35, 9, 0xffa040);
        if (Math.random() < .3) this.C.puff(p, cw * .01, cw * .004, 25, .35, 0x2a2622, 5);
      }
    }
  }
  hud() {
    const W = this.W, day = Math.floor(W.t / 24) + 1, hr = W.t % 24;
    const area = (sd: Side) => W.secs.reduce((s, sec, i) => { const f = sd === 0 ? W.f[i] : -W.f[i]; const tl = Math.hypot(sec.b[0] - sec.a[0], sec.b[1] - sec.a[1]); return s + Math.max(0, f) * tl / 1e6; }, 0);
    const cities = (sd: Side) => W.cities.filter(c => c.owner === sd && c.side !== (sd === 0 ? 'IQ' : 'IR')).length;
    const L = W.lost;
    return {
      stats: `${FLAG[0]} خسر <b>${fmt(L[0].men)}</b> · 🛡<b>${Math.round(L[0].tank)}</b> · أخذ <b>${Math.round(area(0)).toLocaleString('en')}</b> كم² ${cities(0) ? `· ${cities(0) === 1 ? 'مدينة' : cities(0) + ' مدن'}` : ''} │ ${FLAG[1]} خسرت <b>${fmt(L[1].men)}</b> · 🛡<b>${Math.round(L[1].tank)}</b> · أخذت <b>${Math.round(area(1)).toLocaleString('en')}</b> كم² ${cities(1) ? `· ${cities(1) === 1 ? 'مدينة' : cities(1) + ' مدن'}` : ''}`,
      clock: `اليوم ${day} · ${String(hr).padStart(2, '0')}:00`, battles: W.battles.size, area, cities,
    };
  }
  endText() {
    const h = this.hud(), W = this.W;
    const taken = (sd: Side) => W.cities.filter(c => c.owner === sd && c.side !== (sd === 0 ? 'IQ' : 'IR')).map(c => c.n).join('، ') || 'ولا مدينة';
    return `بعد شهر حرب:<br>${FLAG[0]} العراق: أخذ ${Math.round(h.area(0)).toLocaleString('en')} كم² (${taken(0)})، خسر ${fmt(W.lost[0].men)} فرد و${Math.round(W.lost[0].tank)} دبابة.<br>${FLAG[1]} إيران: أخذت ${Math.round(h.area(1)).toLocaleString('en')} كم² (${taken(1)})، خسرت ${fmt(W.lost[1].men)} فرد و${Math.round(W.lost[1].tank)} دبابة.`;
  }
}
export { bdeCount0, KIND_AR };
