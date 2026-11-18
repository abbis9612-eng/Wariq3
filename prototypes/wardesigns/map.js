// الخريطة المشتركة (WD0): رسم العراق وإيران بمحافظاتهما الحقيقية + سحب وتكبير بالإصبع + ضغطة.
// الإحداثيات بالكيلومتر (x شرق، y جنوب). كل نموذج يرسم فوقها بـ onDraw.
'use strict';
const COL = { sea: '#a8c4d4', land: '#efe7d2', other: '#e2dccc', otherLine: '#b9b0a0', provLine: 'rgba(80,70,55,.35)', border: '#3b342c', river: '#4f8fbf', lake: '#9cc0d6', me: '#3f7fd0', foe: '#cf4a3c', text: '#2b2620', halo: 'rgba(247,241,226,.92)' };
class MapView {
  constructor(cv, o = {}) {
    this.cv = cv; this.g = cv.getContext('2d'); this.o = o; this.dpr = Math.min(2, devicePixelRatio || 1);
    this.cam = { x: GEO.W * .3, y: GEO.H * .5, k: 1 }; this.provs = GEO.provs; this.byId = Object.fromEntries(this.provs.map(p => [p.id, p]));
    const path = rings => { const p = new Path2D(); for (const r of rings) { p.moveTo(r[0][0], r[0][1]); for (let i = 1; i < r.length; i++) p.lineTo(r[i][0], r[i][1]); p.closePath(); } return p; };
    this.provs.forEach(p => p.path = path(p.poly));
    this.land = path(GEO.land); this.lakes = path(GEO.lakes); this.others = GEO.others.map(c => ({ ...c, path: path(c.poly) }));
    this.iq = path(this.provs.filter(p => p.side === 0).flatMap(p => p.poly)); this.ir = path(this.provs.filter(p => p.side === 1).flatMap(p => p.poly));
    this.resize(); addEventListener('resize', () => this.resize()); this.input();
  }
  resize() { const r = this.cv.getBoundingClientRect(); this.w = r.width; this.h = r.height; this.cv.width = r.width * this.dpr; this.cv.height = r.height * this.dpr; }
  /** يأطّر منطقة، ويترك مكان للشريط فوق (top) والأزرار تحت (bot) بالبكسل */
  fit(x0, y0, x1, y1, top = 84, bot = 150) { const h = Math.max(100, this.h - top - bot); this.cam.k = Math.min(this.w / (x1 - x0), h / (y1 - y0)); this.cam.x = (x0 + x1) / 2; this.cam.y = (y0 + y1) / 2 + (bot - top) / 2 / this.cam.k; }
  w2s(x, y) { return [(x - this.cam.x) * this.cam.k + this.w / 2, (y - this.cam.y) * this.cam.k + this.h / 2]; }
  s2w(sx, sy) { return [(sx - this.w / 2) / this.cam.k + this.cam.x, (sy - this.h / 2) / this.cam.k + this.cam.y]; }
  provAt(x, y) { const g = this.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); let r = null; for (const p of this.provs) if (g.isPointInPath(p.path, x, y)) { r = p; break; } g.restore(); return r; }
  input() {
    const pts = new Map(); let last = null, down = null, moved = false;
    const two = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    const zoom = (f, sx, sy) => { const [wx, wy] = this.s2w(sx, sy); this.cam.k = clamp(this.cam.k * f, .12, 6); const [wx2, wy2] = this.s2w(sx, sy); this.cam.x += wx - wx2; this.cam.y += wy - wy2; };
    this.cv.addEventListener('pointerdown', e => { this.cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); down = { x: e.offsetX, y: e.offsetY, t: performance.now() }; moved = false; last = pts.size === 2 ? two() : null; this.o.onDown?.(e.offsetX, e.offsetY); });
    this.cv.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return;
      if (down && Math.hypot(e.offsetX - down.x, e.offsetY - down.y) > 7) moved = true;
      if (this.o.onDrag && pts.size === 1 && this.o.onDrag(e.offsetX, e.offsetY, false)) { p.x = e.offsetX; p.y = e.offsetY; return; }
      if (pts.size === 1 && moved) { this.cam.x -= (e.offsetX - p.x) / this.cam.k; this.cam.y -= (e.offsetY - p.y) / this.cam.k; }
      p.x = e.offsetX; p.y = e.offsetY;
      if (pts.size === 2) { const n = two(); if (last) { zoom(n.d / last.d, n.x, n.y); this.cam.x -= (n.x - last.x) / this.cam.k; this.cam.y -= (n.y - last.y) / this.cam.k; } last = n; } });
    const up = e => { const had = pts.delete(e.pointerId); last = pts.size === 2 ? two() : null;
      if (had && pts.size === 0) { if (this.o.onDrag && this.o.onDrag(e.offsetX, e.offsetY, true)) return; if (!moved && down && performance.now() - down.t < 500) { const [x, y] = this.s2w(e.offsetX, e.offsetY); this.o.onTap?.(x, y, e.offsetX, e.offsetY); } } };
    this.cv.addEventListener('pointerup', up); this.cv.addEventListener('pointercancel', up);
    this.cv.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(-e.deltaY * .0015), e.offsetX, e.offsetY); }, { passive: false });
  }
  /** يرسم الخريطة: owner(p) يرجع الطرف المسيطر على المحافظة (أو -1) */
  draw(owner, me) {
    const g = this.g, k = this.cam.k; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.fillStyle = COL.sea; g.fillRect(0, 0, this.w, this.h);
    g.save(); g.translate(this.w / 2, this.h / 2); g.scale(k, k); g.translate(-this.cam.x, -this.cam.y);
    g.fillStyle = COL.other; g.fill(this.land);
    for (const c of this.others) { g.strokeStyle = COL.otherLine; g.lineWidth = 1 / k; g.stroke(c.path); }
    for (const p of this.provs) { const o = owner ? owner(p) : p.side; g.fillStyle = COL.land; g.fill(p.path); if (o >= 0) { g.fillStyle = o === me ? 'rgba(63,127,208,.22)' : 'rgba(207,74,60,.22)'; g.fill(p.path); } }
    // تظليل الجبال (خطوط مايلة خفيفة)
    g.save(); for (const p of this.provs) if (p.terr === 'mount' || p.terr === 'marsh') { g.save(); g.clip(p.path); g.strokeStyle = p.terr === 'mount' ? 'rgba(120,95,60,.18)' : 'rgba(60,120,140,.22)'; g.lineWidth = 1.2 / k; const s = 9; for (let x = -GEO.H; x < GEO.W; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + GEO.H, GEO.H); g.stroke(); } g.restore(); } g.restore();
    g.fillStyle = COL.lake; g.fill(this.lakes);
    g.strokeStyle = COL.river; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const r of GEO.rivers) { g.lineWidth = r.w * 1.1 / k; g.beginPath(); r.p.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); }
    g.strokeStyle = COL.provLine; g.lineWidth = 1 / k; for (const p of this.provs) g.stroke(p.path);
    g.strokeStyle = COL.border; g.lineWidth = 2.2 / k; g.stroke(this.iq); g.stroke(this.ir);
    g.restore();
    // أسماء: دول جارة، محافظات (من قريب)، مدن
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const label = (t, x, y, font, col = COL.text) => { const [sx, sy] = this.w2s(x, y); if (sx < -60 || sx > this.w + 60 || sy < -20 || sy > this.h + 20) return; g.font = font; g.lineWidth = 3; g.strokeStyle = COL.halo; g.strokeText(t, sx, sy); g.fillStyle = col; g.fillText(t, sx, sy); };
    for (const c of this.others) label(c.n, c.c[0], c.c[1], '600 12px "IBM Plex Sans Arabic"', '#8a8070');
    if (k > .55) for (const p of this.provs) label(p.n, p.c[0], p.c[1] + 14 / k, `500 ${k > 1.2 ? 12 : 10}px "IBM Plex Sans Arabic"`, 'rgba(60,52,44,.75)');
    for (const c of GEO.cities) { if (!(c.cap || c.pop > (k > 1 ? 0 : k > .5 ? 300 : 1200))) continue; const [sx, sy] = this.w2s(c.xy[0], c.xy[1]); if (sx < -40 || sx > this.w + 40 || sy < -20 || sy > this.h + 20) continue;
      g.beginPath(); g.arc(sx, sy, c.cap ? 4.5 : 3, 0, 7); g.fillStyle = c.cap ? '#1d1a16' : '#4a4238'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
      if (c.cap || k > .4) label(c.n, c.xy[0], c.xy[1] - 9 / k, `${c.cap ? 700 : 600} ${c.cap ? 13 : 11}px "IBM Plex Sans Arabic"`); }
  }
}
// الفرقة على الخريطة: صورة حقيقية من فوق (دبابة للمدرعة، مدرعة للآلية، جنود للمشاة) بإطار لون طرفها + عدد واضح + شريط قوة
const UIMG = {}; ['abrams', 'abrams_t', 't72', 't72_t', 'bmp'].forEach(n => { const i = new Image(); i.src = `img/${n}.webp`; UIMG[n] = i; });
function drawUnit(g, sx, sy, u, me, o = {}) {
  const s = o.s || 1, friend = u.side === me, r = 19 * s, st = str(u);
  g.save(); g.translate(sx, sy);
  if (o.sel) { g.beginPath(); g.arc(0, 0, r + 7 * s, 0, 7); g.fillStyle = 'rgba(255,210,90,.55)'; g.fill(); }
  g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 5 * s; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fillStyle = friend ? '#dfeafa' : '#fae2dd'; g.fill(); g.shadowBlur = 0;
  g.lineWidth = 3 * s; g.strokeStyle = friend ? '#2f6fd0' : '#c8402f'; g.stroke();
  g.save(); g.beginPath(); g.arc(0, 0, r - 2 * s, 0, 7); g.clip();
  const heavy = u.kind === 'armor' || u.kind === 'mech', tk = u.side === 0 && u.gen >= 3 ? 'abrams' : 't72', rot = friend ? -Math.PI / 2 : Math.PI / 2;
  const pic = (n, dx, dy, k) => { const im = UIMG[n]; if (!im || !im.complete) return; g.save(); g.translate(dx, dy); g.rotate(rot); g.drawImage(im, -k / 2, -k / 2, k, k); g.restore(); };
  if (heavy) { if (u.kind === 'mech') { pic('bmp', -6 * s, 5 * s, 34 * s); pic(tk, 7 * s, -4 * s, 38 * s); pic(tk + '_t', 7 * s, -4 * s, 38 * s); } else { pic(tk, -7 * s, 4 * s, 36 * s); pic(tk + '_t', -7 * s, 4 * s, 36 * s); pic(tk, 7 * s, -5 * s, 36 * s); pic(tk + '_t', 7 * s, -5 * s, 36 * s); } }
  else { // جنود: ثلاث حضائر صغار
    for (let i = 0; i < 9; i++) { const x = ((i % 3) - 1) * 9 * s, y = (Math.floor(i / 3) - 1) * 8 * s; g.fillStyle = friend ? '#3b4a2a' : '#6a5233'; g.beginPath(); g.ellipse(x, y + 2 * s, 3.2 * s, 2.4 * s, 0, 0, 7); g.fill(); g.fillStyle = friend ? '#5d6e3e' : '#8a6e46'; g.beginPath(); g.arc(x, y, 2.2 * s, 0, 7); g.fill(); }
    if (u.kind === 'mtn') { g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(-8 * s, 11 * s); g.lineTo(0, 2 * s); g.lineTo(8 * s, 11 * s); g.fill(); } }
  g.restore();
  // العدد: الدبابات للمدرعة/الآلية، الجنود للمشاة
  const lab = heavy && u.tk >= 1 ? `${Math.round(u.tk)} 🛡` : `${(u.men / 1000).toFixed(u.men >= 10000 ? 0 : 1)}k 👥`;
  g.font = `700 ${10.5 * s}px "IBM Plex Sans Arabic",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; const w = g.measureText(lab).width + 8 * s;
  g.fillStyle = friend ? '#2f6fd0' : '#c8402f'; g.beginPath(); g.roundRect(-w / 2, r + 1 * s, w, 14 * s, 6 * s); g.fill(); g.fillStyle = '#fff'; g.fillText(lab, 0, r + 8 * s);
  // شريط القوة
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(-r, -r - 7 * s, 2 * r, 4 * s); g.fillStyle = st > .66 ? '#3fae5a' : st > .4 ? '#e3b53a' : '#d9503e'; g.fillRect(-r, -r - 7 * s, 2 * r * clamp(st, 0, 1), 4 * s);
  if (o.badge) { g.font = `700 ${13 * s}px sans-serif`; g.fillStyle = '#fff'; g.strokeStyle = '#13161a'; g.lineWidth = 3; g.strokeText(o.badge, r + 4 * s, -r + 4 * s); g.fillText(o.badge, r + 4 * s, -r + 4 * s); }
  g.restore();
}
// سهم حركة/هجوم
function drawArrow(g, a, b, col, wd = 4, dash = null) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 4) return;
  g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = wd; g.lineCap = 'round'; if (dash) g.setLineDash(dash);
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0] - Math.cos(ang) * wd * 2.2, b[1] - Math.sin(ang) * wd * 2.2); g.stroke(); g.setLineDash([]);
  g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - Math.cos(ang - .45) * wd * 3.4, b[1] - Math.sin(ang - .45) * wd * 3.4); g.lineTo(b[0] - Math.cos(ang + .45) * wd * 3.4, b[1] - Math.sin(ang + .45) * wd * 3.4); g.closePath(); g.fill(); g.restore();
}
// انفجار/دخان 2D بسيط على الخريطة
const FXL = [];
function boomAt(x, y, big = 1) { for (let i = 0; i < 6 + 6 * big; i++) FXL.push({ x, y, vx: (Math.random() - .5) * 30 * big, vy: (Math.random() - .5) * 30 * big, t: 0, life: .6 + Math.random() * .8, r: (3 + Math.random() * 4) * big, fire: i < 5 }); }
function drawFx(g, mv, dt) {
  for (const f of FXL) { f.t += dt; f.x += f.vx * dt / mv.cam.k; f.y += f.vy * dt / mv.cam.k; }
  for (let i = FXL.length - 1; i >= 0; i--) if (FXL[i].t > FXL[i].life) FXL.splice(i, 1);
  for (const f of FXL) { const [sx, sy] = mv.w2s(f.x, f.y), u = f.t / f.life; g.beginPath(); g.arc(sx, sy, f.r * (1 + u * 1.5), 0, 7); g.fillStyle = f.fire && u < .45 ? `rgba(255,${150 + 80 * (1 - u)},60,${.9 - u * 1.5})` : `rgba(90,80,70,${.28 * (1 - u)})`; g.fill(); }
}
// ---------- واجهة: رسالة، ورقة سفلية ----------
const $ = s => document.querySelector(s);
function toast(t, bad) { const el = $('#toast'); el.textContent = t; el.className = 'show' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => el.className = '', 2600); }
function sheet(html) { $('#sheet .in').innerHTML = html; $('#sheet').hidden = false; }
function closeSheet() { $('#sheet').hidden = true; }
