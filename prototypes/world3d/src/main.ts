// «العالم 3D» (WM11، I-065): خريطة العالم كلها 3D بنفس الشكل المرسوم، والحرب نفسها (sim2.ts) بمجسمات 3D حقيقية.
// الكاميرا من فوق وتميل/تلف بإصبعين؛ «تابع» يلاحق الأحداث؛ «🎬» كاميرا 3D ثانية تصوّر الإطلاق من الجنب.
import { Engine, Scene, Color4, Color3, HemisphericLight, DirectionalLight, Vector3, FreeCamera, Viewport, MeshBuilder, StandardMaterial, Sprite, Quaternion, type Mesh, type AbstractMesh, type Camera } from '@babylonjs/core';
import { buildTerrain, setTheme, placeTerrain, exagOf, groundH, LEVELS } from './terrain';
import { cam, camera, makeCamera, applyCamera, attachGestures, limit } from './cam';
import { buildLabels, updateLabels, showSites } from './labels';
import { FrontView } from './frontmode';
import { FrontCard, applyNames } from './frontcard';
import { clamp, lerp } from './geo';
import { loadModels, makeUnit, makeMissile, orient, PROTO, MODELS, setOutline, type UnitVis } from './units';
import { FX, C, SMOKE, type Trail } from './fx';
import { World, SITES, type V3, type Msl } from './sim2';
import { MSL, AIR, GROUND } from './catalog';
const $ = (id: string) => document.getElementById(id)!;
const R = (a: number, b: number) => a + Math.random() * (b - a);
const hyp = Math.hypot;
const qs = new URLSearchParams(location.search), AUTO = qs.has('auto'), LITE = qs.has('lite');
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } } };
let THEME: 'light' | 'dark' = (store.get('w3_theme') as any) || 'dark', SIZE = +(store.get('w3_size') || 1);
const SIZES = [1, 1.4, 1.9, 2.6];   // ٤ أحجام (I-067)
let SW = innerWidth, SH = innerHeight;
const DARK = () => THEME === 'dark';
const canvas = document.createElement('canvas'); $('stage').appendChild(canvas);
const engine = new Engine(canvas, !LITE, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: !LITE, powerPreference: 'high-performance' }, !LITE);
// دقة الرسم (WM13.1): شاشات التلفون بكثافة 3 = 9 أضعاف البكسلات؛ نحددها بـ 1.6، وتنزل لحالها إذا الإطارات طاحت
const DPR_MAX = Math.min(devicePixelRatio || 1, 1.6); let dpr = DPR_MAX, fpsAcc = 0, fpsN = 0, fpsT = 0;
if (!LITE) engine.setHardwareScalingLevel(1 / dpr);
function adaptQuality(dtMs: number) { if (LITE) return; fpsAcc += dtMs; fpsN++; if (performance.now() - fpsT < 2500) return; const fps = 1000 / (fpsAcc / fpsN); fpsT = performance.now(); fpsAcc = fpsN = 0;
  const nd = fps < 38 ? Math.max(1, dpr - .2) : fps > 56 ? Math.min(DPR_MAX, dpr + .1) : dpr; if (Math.abs(nd - dpr) > .01) { dpr = nd; engine.setHardwareScalingLevel(1 / dpr); } }
const scene = new Scene(engine); scene.skipPointerMovePicking = true; scene.autoClear = true;
const SKY = { dark: new Color4(.05, .07, .1, 1), light: new Color4(.72, .8, .86, 1) };
const applyTheme = () => { scene.clearColor = SKY[THEME]; scene.fogColor = new Color3(SKY[THEME].r, SKY[THEME].g, SKY[THEME].b); document.documentElement.classList.toggle('light', !DARK()); };
scene.fogMode = Scene.FOGMODE_EXP2; applyTheme();
makeCamera(scene);
const hemi = new HemisphericLight('h', new Vector3(0, 1, 0), scene); hemi.intensity = 1.1; hemi.groundColor = new Color3(.35, .33, .3);
const sun = new DirectionalLight('sun', new Vector3(-.5, -1, .4), scene); sun.intensity = 2.3;
let exag = 1;
const Y = (x: number, y: number, z: number) => groundH(x, y) * exag + z;   // ارتفاع العرض: الأرض المضخّمة + الارتفاع فوقها
const F = new FX(scene, groundH, () => cam, () => exag);
const hfov = () => 2 * Math.atan(Math.tan(camera.fov / 2) * SW / SH);
const camW = () => cam.D * 2 * Math.tan(hfov() / 2);
let curCam: Camera, curH = 1;
const mppAt = (dx: number, dy: number, dz: number) => 2 * Math.hypot(dx, dy, dz) * Math.tan(curCam.fov / 2) / curH;
// ===== shims: نفس نداءات المؤثرات بالنسخة 2D =====
const P3 = (p: any) => ({ x: p.x, y: p.y, z: p.z ?? 0 });
function puff(p: { x: number; y: number; z?: number }, r: number, gr: number, life: number, a: number, tint: number, minPx = 4, vx = 0, vy = 0) { const q = P3(p); F.puff(q, r, gr, life, a, C(tint), minPx, { x: vx, y: vy, z: q.z < 60 ? R(.5, 3) + r * .03 : 0 }); }
type FK = 'glow' | 'ex' | 'ring' | 'flare' | 'fire' | 'spark' | 'tracer';
function fx(kind: FK, p: { x: number; y: number; z?: number }, size: number, life: number, minPx: number, tint = 0xffffff, vx = 0, vy = 0, to?: { x: number; y: number; z?: number }) { F.fx(kind, P3(p), size, life, minPx, C(tint), { x: vx, y: vy, z: kind === 'spark' ? R(5, 25) : 0 }, to ? P3(to) : undefined); }
const lastGun = new Map<number, number>(), tossed = new Map<number, { dx: number; dy: number; r: number }>();
const smokeCol = () => DARK() ? 0xb8c4d0 : 0xffffff;
// انفجار طبقات: ومضة بيضاء ← كرة نار ← موجة صدمة ← شظايا ← عمود دخان يبقى
function impact(p: { x: number; y: number; z?: number }, power: number) {
  const d = hyp(p.x - cam.x, p.y - cam.y), R0 = camW() * .9; if (d > R0 * 1.5) return; const near = clamp(1 - d / (R0 * 1.5), 0, 1);
  trauma = Math.min(1, trauma + power * near * .8); thump(p, power);
  if (power * near > .7) { const el = $('flash'); el.style.transition = 'none'; el.style.opacity = String(Math.min(.5, power * near * .35)); requestAnimationFrame(() => { el.style.transition = 'opacity .35s'; el.style.opacity = '0'; }); }
}
const hitStop = (ms: number) => { hitStopUntil = performance.now() + ms; };
function blast(p: { x: number; y: number }, r: number, ground: boolean, big = 1) { impact(p, clamp(Math.sqrt(r / 40), .3, 1.6) * big);
  fx('glow', p, r * 3, .35, 40 * big); fx('glow', p, r * 7, .9, 90 * big, 0xff9a40); fx('ex', p, r * 2.2, 1.5, 34 * big); fx('ring', p, r * 5, .9, 34 * big);
  for (let i = 0; i < 6 + 6 * big; i++) { const a = R(0, 6.28), sp = R(.6, 1.6) * r * 2.5; fx('spark', p, R(.5, 1) * r, R(.5, 1.1), 0, 0xffc070, Math.cos(a) * sp, Math.sin(a) * sp); }
  for (let i = 0; i < 10 + 6 * big; i++) { const a = R(0, 6.28), d = R(.2, 1) * r; puff({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }, r * R(.4, .8), r * .05, R(14, 26), .6, ground ? 0x2a2622 : (DARK() ? 0x707a86 : 0x8a8a88), 6 * big, Math.cos(a) * r * .02, Math.sin(a) * r * .02); }
  if (ground) for (let i = 0; i < 4; i++) puff({ x: p.x + R(-r, r) * .3, y: p.y + R(-r, r) * .3 }, r * R(.5, .9), r * .08, R(40, 70), .55, 0x1e1b19, 6 * big, R(0, 1), R(0, 1));
}
let capAt = 0;
function caption(t: string) { const el = $('cap'); el.textContent = t; el.style.opacity = '1'; capAt = performance.now(); }
// ===== المخرج: لقطات بأولوية ومدة (وقت المحاكاة) =====
interface Focus { key: string; pos: () => { x: number; y: number } | null; w: () => number; ts: number; until: number; pri: number; rt0: number }
let focuses: Focus[] = [];
function focus(key: string, pos: Focus['pos'], w: number | (() => number), ts: number, dur: number, pri: number) { focuses = focuses.filter(f => f.key !== key); focuses.push({ key, pos, w: typeof w === 'number' ? () => w : w, ts, until: W.t + dur, pri, rt0: performance.now() }); }
const gf = (p: { x: number; y: number; z?: number }) => ({ x: p.x, y: p.y, z: p.z ?? 0 });
const jetPos = (id: number) => () => { const j = W.jets.find(q => q.id === id); return j && j.st !== 'gone' ? gf(j.p) : null; };
function followMissile(m: Msl, pri: number) {
  const tgtOf = () => { const q = W.msls.find(x => x.id === m.id); if (!q) return null; const tj = q.tgtJet ? W.jets.find(j => j.id === q.tgtJet) : null, tm = q.tgtMsl ? W.msls.find(x => x.id === q.tgtMsl) : null; return tj ? tj.p : tm ? tm.p : q.tgtPt ?? null; };
  focus('m' + m.id, () => { const q = W.msls.find(x => x.id === m.id && x.ph !== 'dead'); if (!q) return null; const t = tgtOf(); return t ? { x: (q.p.x + t.x) / 2, y: (q.p.y + t.y) / 2, z: (q.p.z + (t.z ?? 0)) / 2 } : gf(q.p); },
    () => { const q = W.msls.find(x => x.id === m.id); const t = tgtOf(); return q && t ? clamp(hyp(q.p.x - t.x, q.p.y - t.y) * 1.5, 2500, 120000) : 8000; }, 1.5, 400, pri);
}
function onEvent(e: { type: string; p: V3; id?: number; data?: any }) {
  const p = e.p, D = e.data || {};
  switch (e.type) {
    case 'takeoff': { const j = W.jets.find(q => q.id === e.id)!; if (j.slot === 0) { caption(j.side ? 'إنذار! F-14 إيرانية تقلع من أميدية للاعتراض' : j.mission === 'sead' ? 'أربع F-16 تقلع بأزواج: مهمة إخماد الدفاع الجوي' : 'أربع Su-25 تقلع: قصف دروع العدو'); focus('to' + j.id, jetPos(j.id), 4500, 2.5, 14, 3); } snd('jet_roar', p, .9, j.type === 'su25' ? .85 : 1); break; }
    case 'liftoff': for (let i = 0; i < 3; i++) puff(p, 14, 4, 6, .35, 0xd8cfbf, 3); break;
    case 'scramble': caption('رادار إيران لكط طياراتنا — F-14 تستعد'); break;
    case 'sam_alert': caption(D.type === 's400' ? 'S-400 لكط الطيارات — الأنابيب ترتفع' : 'الباتريوت جاهز'); if (D.type === 's400') focus('alert', () => gf(SITES.s400), 1600, 2, 10, 4); break;
    case 'sam_eject': { const m = W.msls.find(q => q.id === e.id); for (let i = 0; i < 10; i++) puff({ x: p.x + R(-6, 6), y: p.y + R(-6, 6) }, R(4, 8), 3, R(4, 7), .6, 0xffffff, 6); snd('eject', p, 1, .9); snd('woosh', p, .7, .7); caption('S-400: إطلاق بارد — الغاز يطرد الصاروخ لفوق ثم يشتعل');
      focus('ej' + e.id, () => gf(p), 1100, .45, 3, 7); if (m) { followMissile(m, 5); if (!PIP || W.t - PIP.t0 > 2.5) startPip(m, p, 's400'); } break; }
    case 'ignite': fx('glow', p, 40, .4, 30); for (let i = 0; i < 8; i++) puff(p, R(5, 9), 3, R(6, 10), .6, 0xffffff, 6); snd('launch', p, 1, .95); break;
    case 'sam_hot': { const m = W.msls.find(q => q.id === e.id); fx('glow', p, 50, .5, 36); for (let i = 0; i < 16; i++) { const a = D.az + Math.PI + R(-.9, .9); puff({ x: p.x + Math.cos(a) * R(3, 16), y: p.y + Math.sin(a) * R(3, 16) }, R(6, 12), 3, R(10, 18), .65, i % 3 ? 0xffffff : 0xc9b48e, 8, Math.cos(a) * R(2, 8), Math.sin(a) * R(2, 8)); }
      snd('launch', p, 1, 1); snd('rocket', p, .7, 1.1); caption('باتريوت PAC-3: إطلاق مايل على الصاروخ النازل'); focus('ph' + e.id, () => gf(p), 1100, .45, 2.6, 7); if (m) { followMissile(m, 5); if (!PIP || W.t - PIP.t0 > 2) startPip(m, p, 'patriot', D.az); } break; }
    case 'air_launch': { const m = W.msls.find(q => q.id === e.id);
      caption(D.w === 'AGM-88' ? 'F-16 أطلقت HARM على رادار S-400 — يسقط ثم يشتعل' : D.w === 'AIM-54' ? 'F-14 أطلقت فينكس بعيد المدى' : D.w === 'AIM-120' ? 'F-16 أطلقت AIM-120 على الـF-14' : 'Su-25 فوق الهدف — قنابل');
      snd(D.w === 'FAB-500' ? 'woosh' : 'rocket', p, .6, 1.2);
      if (m && D.w !== 'FAB-500') { followMissile(m, 4); const j = W.jets.filter(q => q.side === D.side && q.type === D.by).sort((a, c) => hyp(a.p.x - p.x, a.p.y - p.y) - hyp(c.p.x - p.x, c.p.y - p.y))[0]; if (!PIP || W.t - PIP.t0 > 6) startPip(m, p, 'air', undefined, j?.id); }
      else focus('bomb' + e.id, () => gf(p), 3500, .7, 6, 4); break; }
    case 'ignite_air': fx('glow', p, 30, .3, 20); snd('rocket', p, .5, 1.3); break;
    case 'evade': caption(D.split ? 'Split-S: تنقلب على ظهرها وتسحب لتحت هرباً من الصاروخ' : 'مراوغة! كسر حاد بكل الـG عمودي على الصاروخ ومشاعل'); snd('sonic', p, .5); focus('ev' + e.id, jetPos(e.id!), 3500, .7, 5, 6); break;
    case 'popup': caption('Su-25 تطلع لفوق فجأة (pop-up) قبل الهدف…'); focus('pu' + e.id, jetPos(e.id!), 3000, 1, 9, 5); break;
    case 'rollin': caption('…تقلب على جنبها وتغطس 30° على الدبابات'); focus('ri' + e.id, jetPos(e.id!), 2600, .8, 10, 6); break;
    case 'break': { const j = W.jets.find(q => q.id === e.id); if (j && j.slot === 0) { caption('كسر فوق المدرج: لفة 180° حادة ثم دورة الهبوط'); focus('br' + e.id, jetPos(e.id!), 4500, 2, 14, 2); } break; }
    case 'goaround': caption('ما اصطفّت على المدرج — ترجع تدور مرة ثانية'); break;
    case 'cm': for (let i = 0; i < 4; i++) { const s2 = i % 2 ? 1 : -1, h = D.hd; fx('flare', p, 14, 3.5, 7, 0xffffff, -Math.cos(h) * 60 + Math.sin(h) * s2 * 45, -Math.sin(h) * 60 - Math.cos(h) * s2 * 45); } break;
    case 'kill_jet': hitStop(110); blast(p, 60, false, 1.3); snd('boom_big', p, 1, .9); caption(D.side ? 'أسقطنا F-14 للعدو!' : `خسرنا ${AIR[D.type].name} — الطيار قفز بالمظلة`); focus('kj' + e.id, () => gf(p), 5000, .6, 6, 8); break;
    case 'crash': case 'debris_land': blast(p, 40, true); fx('fire', p, 18, 40, 10); snd('boom_mid', p, .7); break;
    case 'sam_silent': caption('رادار S-400 طفّى حتى لا يضربه الـHARM'); break;
    case 'sam_resume': caption('رادار S-400 رجع يشتغل'); break;
    case 'sam_kill': hitStop(110); blast(p, 60, true, 1.4); fx('fire', p, 30, 120, 14); snd('boom_huge', p, 1, .9); caption('HARM دمّر منصة S-400!'); focus('sk' + Math.round(W.t), () => gf(p), 2200, .6, 6, 8); break;
    case 'selfdestruct': fx('glow', p, 40, .4, 24); fx('ex', p, 30, 1, 22); if (D.miss) caption(`الصاروخ فات ${D.tgt ? AIR[D.tgt]?.name ?? '' : 'الهدف'} بـ ${Math.round(D.miss)} م — راوغت ونجت`); snd('blast', p, .6); break;
    case 'bm_erect': caption('منصة ذو الفقار ترفع الصاروخ…'); focus('er' + Math.round(W.t), () => gf(p), 1600, 1.6, 8, 5); break;
    case 'bm_launch': { const m = W.msls.find(q => q.id === e.id); fx('glow', p, 120, .9, 50); fx('ring', p, 160, 2.5, 40); for (let i = 0; i < 30; i++) { const a = R(0, 6.28), s2 = R(4, 14); puff({ x: p.x + Math.cos(a) * R(5, 25), y: p.y + Math.sin(a) * R(5, 25) }, R(10, 20), R(3, 6), R(20, 36), .7, i % 3 ? 0xc9b48e : 0xffffff, 8, Math.cos(a) * s2, Math.sin(a) * s2); }
      snd('rocket', p, 1, .6); snd('boom_far', p, .9, .7); caption('ذو الفقار انطلق على قاعدة البصرة!'); focus('bl' + e.id, () => gf(p), 1800, .5, 4, 7);
      if (m) { focus('bm' + m.id, () => { const q = W.msls.find(x => x.id === m.id && x.ph !== 'dead'); return q ? { x: (q.p.x + q.tgtPt!.x) / 2, y: (q.p.y + q.tgtPt!.y) / 2 } : null; }, 200000, 10, 400, 3); startPip(m, p, 'zolf'); } break; }
    case 'incoming': snd('incoming', p, 1.2); snd('whiz', p, .8, .8); caption('صفير! الباليستي نازل على القاعدة'); break;
    case 'kill_bm': hitStop(130); blast(p, 220, false, 1.5); fx('glow', p, 1500, 1.2, 150); snd('boom_huge', p, 1, .9); caption(`اعتراض! ضربة مباشرة على ارتفاع ${(p.z / 1000).toFixed(1)} كم`); focus('kb' + e.id, () => gf(p), 9000, .6, 6, 8); break;
    case 'bm_impact': hitStop(130); blast(p, 180, true, 2); fx('fire', p, 60, 200, 20); fx('fire', { x: p.x + 60, y: p.y - 40 }, 40, 160, 14); snd('boom_huge', p, 1, .8); caption('الباليستي الثاني نزل على قاعدة البصرة — حريق'); focus('bi' + e.id, () => gf(p), 3500, .5, 7, 8); break;
    case 'advance': caption('الهجوم البري بدأ: دبابات أبرامز وعربات BMP تعبر الحدود'); focus('adv', () => gf(SITES.stage), 9000, 3, 12, 3); break;
    case 'gun': { const g = W.gnd.find(q => q.id === e.id); if (!g) break; lastGun.set(g.id, W.t); const h = D.hd, mz = { x: p.x + Math.cos(h) * 8, y: p.y + Math.sin(h) * 8 }; fx('glow', mz, 14, .18, 12); puff(mz, 6, 3, 4, .4, 0xc9b48e, 4); const m = W.msls.filter(q => q.from === g.type && q.ph !== 'dead').pop(); if (m?.tgtPt) fx('tracer', mz, 0, Math.max(.4, hyp(m.tgtPt.x - p.x, m.tgtPt.y - p.y) / 1650), 0, 0xffd28a, 0, 0, m.tgtPt); snd('tank', p, .5); break; }
    case 'salvo': caption(D.side ? 'راجمات العدو تضرب' : 'راجماتنا تمهّد على خط الدفاع'); snd('rocket', p, .7, 1.3); break;
    case 'rocket': fx('glow', p, 12, .15, 10); puff(p, 8, 3, 8, .4, 0xc9b48e, 4); break;
    case 'blast': { const r = D.r ?? 10; if (D.kind === 'shell') { fx('glow', p, r * 2, .2, 10); for (let i = 0; i < 3; i++) puff(p, r, 2, 5, .5, 0xa8957a, 4); }
      else if (D.kind === 'rocket') { fx('glow', p, 40, .25, 14); fx('spark', p, 20, .5, 0, 0xffc070, R(-40, 40), R(-40, 40)); for (let i = 0; i < 4; i++) puff(p, 16, 3, 8, .5, 0x3a332c, 5); if (Math.random() < .3) snd('boom_mid', p, .4); }
      else blast(p, r, true, D.kind === 'bomb' ? 1.1 : .8); if (D.kind === 'bomb') snd('boom_bomb', p, .9); break; }
    case 'kill_gnd': if (hyp(p.x - cam.x, p.y - cam.y) < camW()) hitStop(70); if (D.type === 't72') { const a = R(0, 6.28), d = R(6, 14); tossed.set(e.id!, { dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: R(-2, 2) }); } blast(p, 18, true, .8); fx('fire', p, 14, 90, 8); snd('boom_mid', p, .8); if (D.side === 0) caption(`خسرنا ${GROUND[D.type].name}`); break;
    case 'reinforce': caption(`تعزيزات: ${D.n} دبابات جديدة ورتل إمداد بالطريق`); focus('rf' + Math.round(W.t), () => gf(p), 6000, 4, 10, 4); break;
    case 'landed': { const j = W.jets.find(q => q.id === e.id); if (j && j.side === 0) caption(`${AIR[j.type].name} رجعت وهبطت بالقاعدة`); break; }
    case 'objective': caption('قواتنا وصلت خرمشهر — الهدف تحقق'); focus('obj', () => gf(SITES.objective), 9000, 2, 20, 9); break;
  }
}
const len3 = (a: V3) => hyp(a.x, a.y, a.z);
const isBurning = (m: Msl) => { const M = MSL[m.type]; return m.type === 'Zolfaghar' ? m.t < 26 : m.type === '122mm' ? m.t < 2 : m.ph === 'boost' && M.burn > 0; };
// ===== الصوت: يوصل بسرعة الصوت (محدود)، والبعيد مكتوم =====
let ac: AudioContext | null = null, master: GainNode; const smp: Record<string, AudioBuffer> = {}; let muted = false, act = 0;
const SNDU = { ...import.meta.glob('../../theater/sounds/{launch,rocket,boom_big,boom_far,boom_mid,incoming,tank,eject,whiz}.mp3', { query: '?url', import: 'default', eager: true }), ...import.meta.glob('../../battle-classic/sounds/{jet_roar,woosh,boom_huge,blast,sonic,boom_bomb}.mp3', { query: '?url', import: 'default', eager: true }) } as Record<string, string>;
function audio() { try { if (!ac) { ac = new AudioContext(); master = ac.createGain(); master.gain.value = 1; const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6; comp.knee.value = 8; master.connect(comp).connect(ac.destination); initEngines(ac); const a = ac; for (const [kk2, u] of Object.entries(SNDU)) fetch(u).then(r => r.arrayBuffer()).then(bb => a.decodeAudioData(bb)).then(buf => { smp[kk2.split('/').pop()!.replace('.mp3', '')] = buf; }).catch(() => {}); } if (ac.state === 'suspended') ac.resume(); } catch { /* */ } }
let curTs = 1;
function snd(n: string, p: V3, v: number, rate = 1) {
  if (!ac || !smp[n] || muted || act > 14) return; const eff = curTs * speed; if (eff > 40 && v < 1) return;
  const d = hyp(p.x - cam.x, p.y - cam.y, (p.z ?? 0) - cam.z), dEff = hyp(d, camW() * .12), delay = Math.min(1.5, d / 343) / Math.max(.4, eff), gain = 1.25 * v / (1 + dEff / (camW() * .7 + 1200)); if (gain < .03) return;   // الصوت يتحسب من نقطة الفرجة مو من ارتفاع الكاميرا
  const s = ac.createBufferSource(); s.buffer = smp[n]; s.playbackRate.value = rate; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(18000 / (1 + dEff / (camW() * 2 + 3000)), 800, 18000);
  const gn = ac.createGain(); gn.gain.value = gain; const pan = ac.createStereoPanner(); pan.pan.value = clamp((p.x - cam.x) / camW() * 1.4, -.8, .8); s.connect(lp).connect(gn).connect(pan).connect(master); s.start(ac.currentTime + delay); act++; s.onended = () => act--;
}

// ===== المخرج =====
// ===== صوت مركّب (WM12.4، I-067): ضربة واطية للانفجار + طقة، محركات مستمرة بدوبلر، وخفض لحظي للأصوات =====
let noiseBuf: AudioBuffer | null = null;
const listener = () => ({ x: cam.x, y: cam.y, z: cam.z });
function thump(p: { x: number; y: number; z?: number }, power: number) {
  if (!ac || muted) return; const L = listener(), d = hyp(p.x - L.x, p.y - L.y, (p.z ?? 0) - L.z), att = 1 / (1 + d / (camW() * .7 + 1200)), g0 = Math.min(1.2, power * att); if (g0 < .04) return;
  const t = ac.currentTime + Math.min(1.2, d / 343) / Math.max(.4, curTs * speed);
  // ضربة واطية (تنحس بالصدر): جيبية تنزل من 90 لـ 32 هرتز
  const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(32, t + .45);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(g0 * .95, t + .012); g.gain.exponentialRampToValueAtTime(.001, t + .9 + power * .4); o.connect(g).connect(master); o.start(t); o.stop(t + 1.5);
  // طقة حادة بالبداية (ضوضاء قصيرة عالية) — بس للقريب
  if (noiseBuf && att > .35) { const n = ac.createBufferSource(), hp = ac.createBiquadFilter(), ng = ac.createGain(); n.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = 1400; ng.gain.setValueAtTime(g0 * .6, t); ng.gain.exponentialRampToValueAtTime(.001, t + .07); n.connect(hp).connect(ng).connect(master); n.start(t, Math.random()); n.stop(t + .1); }
  // خفض لحظي لباقي الأصوات بالانفجار الكبير (ducking)
  if (g0 > .7) { master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(.55, t, .02); master.gain.setTargetAtTime(1, t + .25, .25); }
}
interface Voice { src: AudioBufferSourceNode | OscillatorNode; f: BiquadFilterNode; g: GainNode; pan: StereoPannerNode; n2?: AudioBufferSourceNode }
const jetV: Voice[] = [], tankV: Voice[] = [];
function initEngines(a: AudioContext) {
  noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const ch = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < ch.length; i++) { b = .97 * b + .03 * (Math.random() * 2 - 1); ch[i] = b * 6 + (Math.random() * 2 - 1) * .25; }
  const mk = (jet: boolean): Voice => { const pan = a.createStereoPanner(), g = a.createGain(), f = a.createBiquadFilter(); g.gain.value = 0; f.type = jet ? 'bandpass' : 'lowpass'; f.Q.value = jet ? .7 : 1.2; f.frequency.value = jet ? 900 : 220;
    let src: AudioBufferSourceNode | OscillatorNode;
    if (jet) { const s2 = a.createBufferSource(); s2.buffer = noiseBuf; s2.loop = true; s2.start(0, Math.random() * 2); src = s2; }
    else { const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 36; o.start(); src = o; }
    src.connect(f).connect(g).connect(pan).connect(master); return { src, f, g, pan }; };
  for (let i = 0; i < 4; i++) jetV.push(mk(true)); for (let i = 0; i < 2; i++) tankV.push(mk(false));
}
// كل إطار: أقرب الطيارات والدبابات للمكان اللي تتفرج عليه ياخذون صوت محرك مستمر
function updateEngines() {
  if (!ac || !jetV.length) return; const t = ac.currentTime, L = listener(), eff = (follow ? curTs : 1) * speed * GAME, quiet = muted || !running || paused ? 0 : eff > 20 ? .35 : 1;
  const js = W.jets.filter(j => W.alive(j) || j.st === 'roll').map(j => ({ j, d: hyp(j.p.x - L.x, j.p.y - L.y, j.p.z - L.z) })).sort((a, b) => a.d - b.d);
  jetV.forEach((v, i) => { const e = js[i]; let gain = 0, fr = 900, rate = 1, pan = 0;
    if (e && e.d < camW() * 2.5 + 4000) { const j = e.j, ux = (L.x - j.p.x) / (e.d || 1), uy = (L.y - j.p.y) / (e.d || 1), uz = (L.z - j.p.z) / (e.d || 1), cg = Math.cos(j.gam);
      const vr = (Math.cos(j.hd) * cg * ux + Math.sin(j.hd) * cg * uy + Math.sin(j.gam) * uz) * j.spd, dop = clamp(343 / (343 - clamp(vr, -250, 250)), .7, 1.6);   // دوبلر: يعلى لما تقرب وينزل لما تبعد
      gain = .55 * (.5 + Math.min(1, j.spd / 250) * .5 + (j.n > 5 ? .3 : 0)) / (1 + e.d / (camW() * .5 + 700)); fr = 650 * dop * (1 + (j.n - 1) * .04); rate = dop; pan = clamp((j.p.x - L.x) / (camW() * .6), -.8, .8); }
    v.g.gain.setTargetAtTime(gain * quiet, t, .12); v.f.frequency.setTargetAtTime(fr, t, .1); (v.src as AudioBufferSourceNode).playbackRate.setTargetAtTime(rate, t, .1); v.pan.pan.setTargetAtTime(pan, t, .1); });
  const gs = W.gnd.filter(g => g.st !== 'dead' && g.st !== 'gone' && Math.abs(g.spd) > .5 && g.type !== 'grad').map(g => ({ g, d: hyp(g.p.x - L.x, g.p.y - L.y) })).sort((a, b) => a.d - b.d);
  tankV.forEach((v, i) => { const e = gs[i]; let gain = 0, fr = 36;
    if (e && cam.D < 8000 && e.d < camW() * 1.5) { gain = .32 * (.4 + Math.abs(e.g.spd) / 14) / (1 + e.d / (camW() * .4 + 200)); fr = 30 + Math.abs(e.g.spd) * 1.6 + i * 3; }
    v.g.gain.setTargetAtTime(gain * quiet, t, .2); (v.src as OscillatorNode).frequency.setTargetAtTime(fr, t, .2); v.f.frequency.setTargetAtTime(160 + fr * 3, t, .2); });
}
// «سرعة لعبة» (D-034): الوقت الأساسي ×3 من الحقيقة، إلا لحظات التبطيء
const GAME = 3; let hitStopUntil = 0, trauma = 0;
const ZOOMS = [.55, 1, 2.2]; let ZI = +(store.get('w3_zoom') ?? 0);
function director(): ReturnType<typeof director0> { const r = MODE === 'front' && FV ? FV.director() : director0(); if (r.key !== 'overview') r.w *= ZOOMS[ZI]; return r; }
function director0(): { x: number; y: number; z: number; w: number; ts: number; key: string; hd?: number } {
  focuses = focuses.filter(f => W.t < f.until && f.pos());
  const f = focuses.sort((a, c) => c.pri - a.pri)[0];
  if (f) { const p = f.pos()! as { x: number; y: number; z?: number }; return { x: p.x, y: p.y, z: p.z ?? 0, w: f.w(), ts: f.ts < 1 && performance.now() - f.rt0 > 2200 ? 1 : f.ts, key: f.key }; }   // التبطيء ثانيتين حقيقيتين بالكثير (D-034)
  const fight = W.gnd.filter(g => g.st === 'move' && g.side === 0);
  // قريب على الآليات (I-066): يتابع دبابة وحدة ويتنقل بينهن كل 15 ث، بدل المجموعة من بعيد
  const tanks = fight.filter(g => g.type !== 'truck').sort((a, b) => a.id - b.id);
  if (tanks.length) { const g = tanks[Math.floor(W.t / 15) % tanks.length]; return { x: g.p.x + Math.cos(g.hd) * 120, y: g.p.y + Math.sin(g.hd) * 120, z: 0, w: 650, ts: 3, key: 'g' + g.id, hd: g.hd as number | undefined }; }
  const air = W.jets.filter(j => j.side === 0 && W.alive(j));
  if (air.length) { const ls = air.filter(j => j.slot % 2 === 0).sort((a, b) => a.id - b.id), j = (ls.length ? ls : air)[Math.floor(W.t / 30) % (ls.length || air.length)]; return { x: j.p.x, y: j.p.y, z: j.p.z, w: 3200, ts: 8, key: 'a' + j.id, hd: j.hd as number | undefined }; }   // يتابع طيارة قائدة وجناحها جنبها
  return { x: (SITES.stage.x + SITES.base.x) / 2, y: SITES.stage.y, z: 0, w: 60000, ts: 16, key: 'idle' };
}
function hud() {
  if (performance.now() - capAt > 4500) $('cap').style.opacity = '0';
  if (MODE === 'front' && FV) { const h = FV.hud(); $('stats').innerHTML = h.stats; $('read').textContent = h.battles ? `⚔ ${h.battles} معارك هسه` : ''; $('rate').textContent = `ساعة لعب/ثانية ×${speed}`; $('rate').className = 'tag'; $('clock').textContent = h.clock; return; }
  const S = W.stats; $('stats').innerHTML = `✈ خسرنا <b>${S.lostA[0]}</b> · أسقطنا <b>${S.lostA[1]}</b> │ 🛡 خسرنا <b>${S.lostG[0]}</b> · دمّرنا <b>${S.lostG[1]}</b> │ 🚀 اعترضنا <b>${S.bmShot}</b>/${S.bm}`;
  const o = W.msls.find(m => m.ph !== 'dead' && ['48N6', 'PAC-3', 'AIM-54', 'AIM-120', 'AGM-88', 'Zolfaghar'].includes(m.type)); let t = '';
  if (o && follow) { const sp = len3(o.vel); t = `${MSL[o.type].name} · ارتفاع ${(o.p.z / 1000).toFixed(1)} كم · ${Math.round(sp)} م/ث (ماخ ${(sp / 300).toFixed(1)})`; }
  $('read').textContent = t; const eff = (follow ? curTs : 1) * speed * ((follow ? curTs : 1) < 1 ? 1 : GAME); $('rate').textContent = eff < .95 ? `تبطيء ×${eff.toFixed(1)}` : `الوقت ×${Math.round(eff)}`; $('rate').className = 'tag' + (eff < .95 ? ' slow' : '');
  $('clock').textContent = `${Math.floor(W.t / 60)}:${String(Math.floor(W.t % 60)).padStart(2, '0')}`;
}
function endText() { const S = W.stats; return `قواتنا وصلت خرمشهر بعد ${Math.round(W.t / 60)} دقيقة قتال.<br>طيارات: خسرنا ${S.lostA[0]} وأسقطنا ${S.lostA[1]}<br>دروع: خسرنا ${S.lostG[0]} (وصلت ${S.reinf} تعزيزات) ودمّرنا ${S.lostG[1]}<br>باليستي: اعترضنا ${S.bmShot} من ${S.bm}`; }// ===== المؤثرات لكل خطوة محاكاة (نقاط الذيول، بخار، غبار، جنازير) =====
let mTrail = new Map<number, Trail>(), dTrail = new Map<object, Trail>(), vTrail = new Map<number, Trail>(), tTrail = new Map<number, Trail[]>();
const trailOf = (m: Msl) => m.type === 'Zolfaghar' ? { r0: 4, gr: 6, life: 70, a: .85 } : m.type === '122mm' ? { r0: .8, gr: 1.6, life: 12, a: .5 } : { r0: 1.4, gr: 3, life: 40, a: .8 };
function fxStep(dt: number) {
  if (dTrail.size > 60) for (const [k2, tr] of dTrail) if (!tr.live && !F.trails.includes(tr)) dTrail.delete(k2);
  if (mTrail.size > 200) for (const [k2, tr] of mTrail) if (!tr.live && !F.trails.includes(tr)) mTrail.delete(k2);
  for (const m of W.msls) { let tr = mTrail.get(m.id);
    if (isBurning(m) && m.ph !== 'dead') { if (!tr) { tr = F.trail({ ...trailOf(m), col: SMOKE }); mTrail.set(m.id, tr); } F.add(tr, m.p, Math.max(6, hyp(m.vel.x, m.vel.y, m.vel.z) * .04)); }
    else if (tr && tr.live) { F.add(tr, m.p, 0); tr.live = false; } }
  for (const d of W.debris) { let tr = dTrail.get(d); if (!d.burn) { if (tr) tr.live = false; continue; } if (!tr) { tr = F.trail({ r0: 2, gr: 4, life: 30, a: .65, col: new Color3(.18, .16, .15) }); dTrail.set(d, tr); } F.add(tr, d.p, 20); }
  for (const j of W.jets) if (j.st === 'hit' && Math.random() < dt * 20) puff(j.p, R(6, 12), R(3, 6), R(14, 22), .7, 0x2b2724, 4);
  for (const f of F.fxs) if (f.kind === 'flare') { let tr = dTrail.get(f); if (!tr) { if (dTrail.size > 80) continue; tr = F.trail({ maxPts: 40, r0: .8, gr: 1.8, life: 6, a: .6, col: SMOKE }); dTrail.set(f, tr); } F.add(tr, f.p, 6); if (f.t > f.life - .1) tr.live = false; }
  // بخار أطراف الأجنحة بالـG العالي (الجناح مايل حسب الميلان)، وخيط تكثيف فوق 8.5 كم
  for (const j of W.jets) { const fly = W.alive(j), L2 = MODELS[AIR[j.type].sprite].len, rx = Math.sin(j.hd), ry = -Math.cos(j.hd), cb = Math.cos(j.bank), sb = Math.sin(j.bank), span = L2 * .34;
    for (const sd of [-1, 1]) { const key = j.id * 10 + (sd + 1), on = fly && j.n > 4.2; let tr = vTrail.get(key);
      if (on) { if (!tr) { tr = F.trail({ r0: .4, gr: .8, life: 2.2, a: .55, col: SMOKE, minPx: .8 }); vTrail.set(key, tr); } F.add(tr, { x: j.p.x + rx * cb * span * sd, y: j.p.y + ry * cb * span * sd, z: j.p.z + sb * span * sd }, 8); }
      else if (tr) { tr.live = false; vTrail.delete(key); } }
    { const k7 = j.id * 10 + 7; let st = vTrail.get(k7); if (fly && j.st !== 'hit') { if (!st) { st = F.trail({ r0: .5, gr: 1, life: 1.4, a: .38, col: SMOKE, minPx: 1.4 }); vTrail.set(k7, st); } F.add(st, { x: j.p.x - Math.cos(j.hd) * L2 * .5, y: j.p.y - Math.sin(j.hd) * L2 * .5, z: j.p.z }, 10); } else if (st) { st.live = false; vTrail.delete(k7); } }   // خيط سرعة (I-067)
    const key = j.id * 10 + 5, on = fly && j.p.z > 8500; let tr = vTrail.get(key);
    if (on) { if (!tr) { tr = F.trail({ r0: 1.5, gr: 2.5, life: 50, a: .5, col: SMOKE }); vTrail.set(key, tr); } F.add(tr, { x: j.p.x - Math.cos(j.hd) * L2 * 2, y: j.p.y - Math.sin(j.hd) * L2 * 2, z: j.p.z }, 30); }
    else if (tr) { tr.live = false; vTrail.delete(key); } }
  // الدبابات: غبار ورا الجنزير، وآثار جنزير على الأرض (شريطين)
  for (const g of W.gnd) { if (g.st === 'dead' || g.st === 'gone' || Math.abs(g.spd) < 1.5) continue; const L2 = MODELS[GROUND[g.type].sprite].len * .5, dir = Math.sign(g.spd);
    if (Math.random() < dt * Math.abs(g.spd) * .7) puff({ x: g.p.x - Math.cos(g.hd) * L2 * dir + R(-2, 2), y: g.p.y - Math.sin(g.hd) * L2 * dir + R(-2, 2), z: 1 }, R(3.5, 6), R(1.8, 3), R(6, 11), .4, DARK() ? 0x8a7c66 : 0xd8c8a4, 4, R(-1, 1), R(-1, 1));
    if (g.type === 'truck') continue; let tk = tTrail.get(g.id); if (!tk) { tk = [-1.7, 1.7].map(() => F.trail({ maxPts: 70, r0: .35, gr: 0, life: 240, a: .35, col: DARK() ? new Color3(.1, .09, .08) : new Color3(.42, .35, .25), flat: true, minPx: .5 })); tTrail.set(g.id, tk); }
    tk.forEach((t, i) => { const o = i ? 1.7 : -1.7; F.add(t, { x: g.p.x - Math.sin(g.hd) * o, y: g.p.y + Math.cos(g.hd) * o, z: 0 }, 12); }); }
}
// ===== الوحدات 3D =====
const UV = new Map<string, UnitVis & { dk: boolean; seen: number; flag: Sprite; side: 0 | 1; len: number; air: boolean; z: number; nf?: boolean }>(); let frameNo = 0;
function unitAt(key: string, n: string, side: 0 | 1, p: V3, q: Quaternion, o: { dead?: boolean; tur?: number; recoil?: number; toss?: { dx: number; dy: number; r: number }; air?: boolean; raise?: number; noFlag?: boolean } = {}) {
  let u = UV.get(key); if (u && u.dk !== !!o.dead && !PROTO[n].cont) { u.node.dispose(); u.sh.dispose(); u.flag.dispose(); UV.delete(key); u = undefined; }
  if (!u) { const b = makeUnit(n, scene, !!o.dead), flag = new Sprite('f', F.flags); flag.cellIndex = side; u = { ...b, dk: !!o.dead, seen: 0, flag, side, len: MODELS[n].len, air: !!o.air, z: 0 }; UV.set(key, u);
    if (PROTO[n].cont && o.dead) for (const m of u.node.getChildMeshes()) m.material = deadMat; }
  if (PROTO[n].cont && o.dead && !u.dk) { u.dk = true; for (const m of u.node.getChildMeshes()) m.material = deadMat; }
  u.seen = frameNo; u.z = p.z; u.nf = !!o.noFlag; u.node.setEnabled(true); u.node.position.set(p.x - cam.x, Y(p.x, p.y, p.z), p.y - cam.y); u.node.rotationQuaternion = q;
  if (u.tur && o.tur !== undefined) { u.tur.rotation.y = 0; const rel = o.tur; u.tur.rotationQuaternion = Quaternion.RotationYawPitchRoll(-rel, 0, 0); const P = PROTO[n].piv!; u.tur.position.set(P.x - Math.sin(-rel) * (o.recoil ?? 0) * .6, P.y, P.z - Math.cos(-rel) * (o.recoil ?? 0) * .6);
    if (o.toss) { u.tur.position.addInPlaceFromFloats(o.toss.dx, .4, o.toss.dy); u.tur.rotationQuaternion = Quaternion.RotationYawPitchRoll(-rel + o.toss.r, .35, .2); } }
  if (u.anim && o.raise !== undefined) { const a = u.anim; a.start(false, 1, a.from, a.to); a.goToFrame(a.from + (a.to - a.from) * o.raise); a.pause(); }
  // ظل الطيارة على الأرض (مزاح مع الشمس حسب الارتفاع)
  if (u.air && p.z > 5 && !o.dead) { const off = Math.min(p.z, 3000) * .45; u.sh.setEnabled(true); u.sh.position.set(p.x - cam.x + off * .5, groundH(p.x, p.y) * exag + .3, p.y - cam.y - off * .4); const e = new Vector3(); q.toEulerAnglesToRef(e); u.sh.rotationQuaternion = Quaternion.RotationYawPitchRoll(e.y, 0, 0); }
  else u.sh.setEnabled(false);
  return u;
}
const deadMat = new StandardMaterial('dead3', scene); deadMat.diffuseColor = new Color3(.08, .075, .07); deadMat.specularColor = Color3.Black();
function placeUnits() {
  frameNo++;
  if (MODE === 'front') { FV?.place3d(); for (const [, u] of UV) if (u.seen !== frameNo) { u.node.setEnabled(false); u.sh.setEnabled(false); u.flag.isVisible = false; } return; }
  for (const j of W.jets) { if (j.st === 'gone') continue; const air = j.st !== 'landed' && j.st !== 'parked'; unitAt('j' + j.id, AIR[j.type].sprite, j.side, j.p, air ? orient(j.hd, j.gam, j.bank) : orient(j.hd), { air }); }
  for (const bt of W.bats) bt.launchers.forEach((l, i) => unitAt(`b${bt.id}_${i}`, bt.type, bt.side, l.p, orient(l.hd), { dead: !l.alive, raise: bt.type === 's400' ? l.raise : undefined }));
  W.tels.forEach((tl, i) => unitAt('tel' + i, 'zolf', 1, tl.p, orient(3.6)));
  for (const g of W.gnd) { if (g.st === 'gone') continue; const hasT = g.type === 'abrams' || g.type === 't72', lg = lastGun.get(g.id);
    unitAt('g' + g.id, GROUND[g.type].sprite, g.side, g.p, orient(g.hd), { dead: g.st === 'dead', tur: hasT ? -Math.atan2(Math.sin(g.turret - g.hd), Math.cos(g.turret - g.hd)) * -1 : undefined, recoil: lg !== undefined ? Math.max(0, 1 - (W.t - lg) / .5) : 0, toss: tossed.get(g.id) }); }
  for (const [, u] of UV) if (u.seen !== frameNo) { u.node.setEnabled(false); u.sh.setEnabled(false); u.flag.isVisible = false; }
}
const AIRN = new Set(['f16', 'su25', 'f14']);
// الحجم لكل كاميرا: حقيقي من قريب، ومن بعيد حد أدنى بالبكسل حتى تنشاف (حجم ١/٢/٣)
function scaleUnits(c: Camera) { const cp = c.position, showUnits = cam.D < 2.2e6, big = c === camera ? SIZES[SIZE] : 1, minPx0 = c === camera ? 44 : 0;
  for (const [, u] of UV) { if (u.seen !== frameNo) continue; const p = u.node.position, px = mppAt(p.x - cp.x, p.y - cp.y, p.z - cp.z), minPx = minPx0 * (AIRN.has(u.n) ? 1.25 : 1), S = Math.max(1, minPx * px / u.len) * big;
    u.node.setEnabled(showUnits || c !== camera); u.node.scaling.setAll(S); u.sh.scaling.set(S, .02, S);
    u.flag.isVisible = c === camera && showUnits && !u.dk && !u.nf; u.flag.position.set(p.x + 1.2 * px * 14, p.y + PROTO[u.n].h * S + 8 * px, p.z); u.flag.width = 18 * px * Math.sqrt(big); u.flag.height = 12 * px * Math.sqrt(big); } }
// ===== الصواريخ (جسم + لهب)، المظلات =====
const mPool: Mesh[] = [], gPool: Sprite[] = [], chPool: Mesh[] = [];
const mMat = new StandardMaterial('mm', scene); mMat.diffuseColor = new Color3(.93, .93, .9); mMat.emissiveColor = new Color3(.35, .35, .33);
const chMat = new StandardMaterial('chm', scene); chMat.diffuseColor = new Color3(.95, .62, .2); chMat.emissiveColor = new Color3(.3, .2, .08); chMat.backFaceCulling = false;
interface MV { m: Msl; body: AbstractMesh; glow?: Sprite; model: boolean }
// صواريخ 3D حقيقية (WM12.2)؛ صاروخ الغراد يبقى أسطوانة (صغير وكثير)
const MSL3D: Record<string, string> = { '48N6': 'm_48n6', 'PAC-3': 'm_pac3', 'AIM-120': 'm_aim120', 'AIM-54': 'm_aim54', 'AGM-88': 'm_harm', 'Zolfaghar': 'm_zolf', 'FAB-500': 'm_fab' };
const mModels = new Map<number, AbstractMesh>();
let mVis: MV[] = [], chVis: { c: any; mesh: Mesh }[] = [];
function placeMissiles() {
  mVis = []; let gi = 0, mi = 0; const alive = new Set<number>();
  for (const m of W.msls) { if (m.ph === 'dead' || m.type === '125mm' || m.type === '120mm') continue; const mn = MSL3D[m.type];
    let body: AbstractMesh;
    if (mn && PROTO[mn]) { body = mModels.get(m.id) ?? (() => { const b = makeMissile(mn, scene); mModels.set(m.id, b); return b; })(); alive.add(m.id); }
    else body = mPool[mi] ?? (() => { const b = MeshBuilder.CreateCylinder('msl', { height: 1, diameter: 1, tessellation: 8 }, scene); b.material = mMat; b.isPickable = false; mPool.push(b); return b; })(), mi++;
    body.setEnabled(true); body.position.set(m.p.x - cam.x, Y(m.p.x, m.p.y, m.p.z), m.p.y - cam.y);
    const v = new Vector3(m.vel.x, m.vel.z, m.vel.y); if (v.lengthSquared() < 1) v.set(0, 1, 0); v.normalize();
    body.rotationQuaternion = Quaternion.FromUnitVectorsToRef(mn ? Vector3.Forward() : Vector3.UpReadOnly, v, new Quaternion());
    const mv: MV = { m, body, model: !!mn }; if (isBurning(m) || m.type === 'Zolfaghar') { const g = gPool[gi] ?? (() => { const s2 = new Sprite('mg', F.glow); gPool.push(s2); return s2; })(); gi++; g.isVisible = true; mv.glow = g; }
    mVis.push(mv); }
  for (const [id, b] of mModels) if (!alive.has(id)) { b.dispose(); mModels.delete(id); }
  for (; mi < mPool.length; mi++) mPool[mi].setEnabled(false); for (; gi < gPool.length; gi++) gPool[gi].isVisible = false;
  chVis = []; let ci = 0;
  for (const c of W.chutes) { const mesh = chPool[ci] ?? (() => { const b = MeshBuilder.CreateSphere('chute', { diameter: 1, segments: 8, slice: .5 }, scene); b.material = chMat; chPool.push(b); return b; })(); ci++;
    const age = c.landed ? (W.t - c.landed) / 12 : 0; mesh.setEnabled(age < 1); mesh.position.set(c.p.x - cam.x, Y(c.p.x, c.p.y, c.p.z) + (c.landed ? 0 : 6), c.p.y - cam.y); mesh.rotation.x = c.landed ? Math.PI / 2 * Math.min(1, age * 3) : 0; chVis.push({ c, mesh }); }
  for (; ci < chPool.length; ci++) chPool[ci].setEnabled(false);
}
function scaleMissiles(c: Camera) { const cp = c.position, big = c === camera ? SIZES[SIZE] : 1;
  for (const { m, body, glow, model } of mVis) { const M = MSL[m.type], p = body.position, px = mppAt(p.x - cp.x, p.y - cp.y, p.z - cp.z);
    // الصاروخ أكبر بوضوح من بعيد (حد أدنى ~30 بكسل × الحجم)، وحقيقي من قريب
    const S = Math.max(1, (c === camera ? 30 : 6) * big * px / M.len), L = model ? M.len * S : Math.max(M.len, 7 * px * big), D = Math.max(M.diam, 2.2 * px * big);
    if (model) body.scaling.setAll(S); else body.scaling.set(D, L, D);
    if (glow) { const burning = isBurning(m), u = body.rotationQuaternion!, tail = (model ? new Vector3(0, 0, -L / 2) : new Vector3(0, -L / 2, 0)).rotateByQuaternionToRef(u, new Vector3()); glow.position.copyFrom(p).addInPlace(tail);
      const gs = burning ? Math.max(m.type === '122mm' ? 12 * px : 28 * px * Math.sqrt(big), L * .9) * R(.9, 1.1) : 12 * px; glow.width = glow.height = gs; glow.color.set(1, burning ? 1 : .8, burning ? 1 : .6, burning ? 1 : .4);
      if (m.type === 'Zolfaghar' && m.vel.z < -900 && m.p.z < 45000) { glow.width = glow.height = gs + (45000 - m.p.z) / 900 * px * 3; glow.color.set(1, .75, .45, 1); } } }
  for (const { mesh } of chVis) { const p = mesh.position, px = mppAt(p.x - cp.x, p.y - cp.y, p.z - cp.z), S = Math.max(9, 10 * px); mesh.scaling.set(S, S * .45, S); } }
// ===== اللقطة القريبة: كاميرا 3D ثانية من الجنب =====
let PIP: { mid: number; at: V3; kind: string; t0: number; dur: number; az?: number; jet?: number; hd: number } | null = null, pipBig = false;
const pipCam = new FreeCamera('pip', new Vector3(0, 10, 0), scene); pipCam.fov = .75; pipCam.minZ = .5; pipCam.maxZ = 4e5; pipCam.inputs.clear();
const pipRect = () => { const W0 = pipBig ? SW - 16 : Math.round(Math.min(SW * .5, 260)), H0 = pipBig ? Math.round(SH * .6) : Math.round(W0 * 1.2), X0 = 8, Y0 = pipBig ? 76 : 96; return { W0, H0, X0, Y0 }; };
function startPip(m: Msl, at: V3, kind: string, az?: number, jet?: number) {
  if (SHOTMODE === 2) return;
  if (SHOTMODE === 0) { const hd = az !== undefined ? -az : kind === 'air' && jet ? -(W.jets.find(j => j.id === jet)?.hd ?? 0) : cam.head; cine = { until: performance.now() + (kind === 'zolf' ? 4200 : 3200), head: hd }; return; }   /* لقطة داخل الشاشة: الكاميرا الرئيسية تميل للجنب */
  const l = W.bats.flatMap(bb => bb.launchers).find(l2 => hyp(l2.p.x - at.x, l2.p.y - at.y) < 40), tel = W.tels.find(tl => hyp(tl.p.x - at.x, tl.p.y - at.y) < 40);
  PIP = { mid: m.id, at: l ? { ...l.p, z: 0 } : tel ? { ...tel.p, z: 0 } : { ...at }, kind, t0: W.t, dur: kind === 'zolf' ? 14 : kind === 'air' ? 8 : 9, az, jet, hd: l ? l.hd : tel ? 3.6 : 0 };
}
function placePip() {
  const el = $('pipbox'); if (!PIP || W.t - PIP.t0 > PIP.dur) { if (PIP) { PIP = null; pipBig = false; } scene.activeCameras = [camera]; el.hidden = true; return; }
  const m = W.msls.find(q => q.id === PIP!.mid), jet = PIP.jet ? W.jets.find(j => j.id === PIP!.jet) : null;
  const base = PIP.kind === 'air' && jet ? jet.p : PIP.at, top = m && m.ph !== 'dead' ? m.p : base;
  const up = top.z - base.z, dist = hyp(top.x - base.x, top.y - base.y, up);
  let side = PIP.hd + Math.PI / 2; if (PIP.kind === 'patriot' && PIP.az !== undefined) side = PIP.az + Math.PI / 2; if (PIP.kind === 'air' && jet) side = jet.hd - Math.PI / 2;
  const d = PIP.kind === 'zolf' ? 70 + dist * .55 : PIP.kind === 'air' ? 45 + dist * .6 : 34 + dist * .6, h = PIP.kind === 'air' ? 8 : 4 + Math.min(up, 600) * .25;
  const look = { x: (base.x + top.x) / 2, y: (base.y + top.y) / 2, z: (base.z + top.z) / 2 + (PIP.kind === 'air' ? 0 : 5) };
  const cpos = { x: look.x + Math.cos(side) * d, y: look.y + Math.sin(side) * d, z: Math.max(base.z, look.z) + h - (PIP.kind === 'air' ? 0 : Math.min(up, 600) * .2) };
  pipCam.position.set(cpos.x - cam.x, Y(cpos.x, cpos.y, PIP.kind === 'air' ? cpos.z : Math.max(2, cpos.z - base.z)), cpos.y - cam.y);
  pipCam.setTarget(new Vector3(look.x - cam.x, Y(look.x, look.y, PIP.kind === 'air' ? look.z : look.z - base.z), look.y - cam.y));
  const { W0, H0, X0, Y0 } = pipRect(); pipCam.viewport = new Viewport(X0 / SW, 1 - (Y0 + H0) / SH, W0 / SW, H0 / SH); scene.activeCameras = [camera, pipCam];
  el.hidden = false; el.style.cssText = `left:${X0}px;top:${Y0}px;width:${W0}px;height:${H0}px`;
  const st = !m || m.ph === 'dead' ? '' : m.ph === 'eject' ? ' — طرد بالغاز' : m.ph === 'drop' ? ' — سقوط حر' : isBurning(m) ? ' — اشتعال' : '';
  $('piptitle').textContent = ({ s400: 'S-400 إطلاق بارد', patriot: 'باتريوت PAC-3', zolf: 'ذو الفقار', air: 'صاروخ من الطيارة' } as Record<string, string>)[PIP.kind] + st; $('piphint').hidden = pipBig;
}
// ===== الكاميرا تتبع المخرج =====
let follow = true, fly: { x0: number; y0: number; z0: number; w0: number; t: number; d: number } | null = null, shotKey = '';
function setFollow(on: boolean) { follow = on; $('bFollow').setAttribute('aria-pressed', String(on)); if (on) shotKey = ''; }
const D_of = (w: number) => w / (2 * Math.tan(hfov() / 2));
// أوضاع الكاميرا (WM13.2، I-069): من فوق / مايل (55°) / مطاردة (مايل وورا الآلية)؛ ولقطة الإطلاق تميل الكاميرا الرئيسية للجنب ثواني (I-071)
let CAMMODE = +(store.get('w3_cam') ?? 1), SHOTMODE = +(store.get('w3_shot') ?? 0), cine: { until: number; head: number } | null = null;
const angLerp = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
function camAngles(sh: ReturnType<typeof director>, rdt: number) {
  let tT = CAMMODE === 0 ? 0 : CAMMODE === 1 ? .95 : 1.12, hT = CAMMODE === 2 && sh.hd !== undefined ? Math.PI / 2 - sh.hd : CAMMODE === 0 ? 0 : cam.head;
  if (cine && performance.now() < cine.until) { tT = 1.2; hT = cine.head; } else cine = null;
  const k = 1 - Math.exp(-rdt * (cine ? 3 : 1.6)); cam.tilt += (tT - cam.tilt) * k; cam.head = angLerp(cam.head, hT, k * (CAMMODE === 2 ? .7 : 1));
}
function camUpdate(sh: ReturnType<typeof director>, rdt: number) {
  if (!follow) return; const w0 = camW(); camAngles(sh, rdt);
  if (sh.key !== shotKey) { const d = hyp(sh.x - cam.x, sh.y - cam.y); if (shotKey && d > Math.max(w0, sh.w) * .8) fly = { x0: cam.x, y0: cam.y, z0: cam.z, w0, t: 0, d: shotKey === 'world' ? 4.5 : clamp(.8 + Math.log10(d / Math.min(w0, sh.w) + 1) * .45, .8, 2.2) }; shotKey = sh.key; }
  if (fly) { fly.t += rdt; const u = clamp(fly.t / fly.d, 0, 1), e = u * u * (3 - 2 * u), dist = hyp(sh.x - fly.x0, sh.y - fly.y0), l0 = Math.log(fly.w0), l1 = Math.log(sh.w), bump = Math.max(0, Math.log(dist * 1.3) - Math.max(l0, l1));
    cam.x = lerp(fly.x0, sh.x, e); cam.y = lerp(fly.y0, sh.y, e); cam.z = lerp(fly.z0, sh.z, e); cam.D = D_of(Math.exp(lerp(l0, l1, e) + bump * Math.sin(Math.PI * e))); if (u >= 1) fly = null; return; }
  const a = 1 - Math.exp(-rdt * 3), z = 1 - Math.exp(-rdt * 2.4); cam.x = lerp(cam.x, sh.x, a); cam.y = lerp(cam.y, sh.y, a); cam.z = lerp(cam.z, sh.z, a); cam.D = D_of(Math.exp(lerp(Math.log(w0), Math.log(sh.w), z)));
}
// ===== الحلقة =====
let W = new World(), speed = 1, paused = false, running = false, ended = false, MODE: 'op' | 'front' = 'op', FV: FrontView | null = null;
function reset() { W = new World(); F.clear(); mTrail = new Map(); dTrail = new Map(); vTrail = new Map(); tTrail = new Map(); focuses = []; PIP = null; ended = false; shotKey = ''; fly = null; lastGun.clear(); tossed.clear(); mModels.forEach(b => b.dispose()); mModels.clear(); trauma = 0; for (const [, u] of UV) { u.node.dispose(); u.sh.dispose(); u.flag.dispose(); } UV.clear(); }
function start(mode: 'op' | 'front' = 'op') { reset(); MODE = mode; FV?.dispose(); FV = null; showSites(mode === 'op');
  card.close(); if (mode === 'front') { FV = new FrontView(fctx, qs.has('seed') ? +qs.get('seed')! : undefined); applyNames(FV.W); FV.onTap = (b, s) => onFrontTap(b, s); setFollow(true); const o = FV.overview(); if (cam.D > 2e6) { cam.x = o.x; cam.y = o.y; cam.z = 0; } shotKey = 'world'; running = true; $('start').hidden = true; $('ui').hidden = false; $('end').hidden = true; audio(); caption('الجبهة كاملة: كل لواء برمزه وشريط قوته — والمعارك تنحسم للأقوى'); $('endH').textContent = 'انتهى شهر الحرب'; return; }
  $('endH').textContent = 'انتهت العملية'; setFollow(true); shotKey = 'world'; if (cam.D < 1e6) { const s = director(); cam.x = s.x; cam.y = s.y; cam.z = s.z; cam.D = D_of(s.w); shotKey = ''; } /* أول مرة: الكاميرا تنزل من العالم كله للمعركة */ running = true; $('start').hidden = true; $('ui').hidden = false; $('end').hidden = true; audio(); caption('العملية بدأت: الهدف خرمشهر'); }
function stepSim(simDt: number, budget = 9) { let left = simDt, n = 0; const t0 = performance.now(); while (left > 1e-6 && n < 3000 && (n % 50 || performance.now() - t0 < budget)) { const d = Math.min(.02, left); left -= d; n++; W.step(d); fxStep(d); for (const e of W.ev.splice(0)) onEvent(e); } F.age(simDt - Math.max(0, left)); }
scene.onBeforeCameraRenderObservable.add(c => { curCam = c; const vp = c.viewport; curH = engine.getRenderHeight() * vp.height || 1; F.k = c === camera ? 1.5 * SIZES[SIZE] : 1; F.view = c === camera ? camW() + cam.D * Math.tan(cam.tilt) * 2 : 4000; scaleUnits(c); scaleMissiles(c); F.draw(c, mppAt, C(smokeCol())); });
function frame() {
  SW = engine.getRenderWidth() / (engine.getHardwareScalingLevel() ? 1 / engine.getHardwareScalingLevel() : 1); SH = engine.getRenderHeight() / (1 / engine.getHardwareScalingLevel());
  SW = innerWidth; SH = innerHeight;
  limit(); exag = exagOf(cam.D); const gh = groundH(cam.x, cam.y) * exag + cam.z; applyCamera(gh);
  if (trauma > 0) { const sh = trauma * trauma * camW() * .012; camera.position.addInPlaceFromFloats(R(-1, 1) * sh, R(-1, 1) * sh * .4, R(-1, 1) * sh); trauma = Math.max(0, trauma - engine.getDeltaTime() / 1000 * 1.6); }
  scene.fogDensity = cam.tilt > .15 ? 1.6 / (cam.D * 9) : 0; placeTerrain(cam, exag, camera.position, scene.fogColor, scene.fogDensity * .7);
  if (unitsReady) { placeUnits(); if (MODE === 'op') { placeMissiles(); placePip(); } }
  updateEngines();
  scene.render(); updateLabels(scene, SW, SH, (x, y) => groundH(x, y) * exag); if (MODE === 'front' && FV) { FV.draw(Math.min(.05, engine.getDeltaTime() / 1000), SW, SH); card.tick(performance.now()); } if (running) hud();
}
let unitsReady = false;
engine.runRenderLoop(() => {
  const rdt = Math.min(.05, engine.getDeltaTime() / 1000); adaptQuality(engine.getDeltaTime());
  if (FV) FV.live = running && !paused;
  if (running && !paused && MODE === 'front' && FV) { FV.update(rdt * speed); F.age(rdt); camUpdate(director(), rdt); if (FV.ended && !ended) { ended = true; $('end').hidden = false; $('endTxt').innerHTML = FV.endText(); } }
  else if (running && !paused) { const sh = director(); curTs = follow ? sh.ts : 1; if (performance.now() > hitStopUntil) stepSim(rdt * curTs * speed * (curTs < 1 ? 1 : GAME)); camUpdate(director(), rdt); if (W.endT > 0 && W.t > W.endT && !ended) { ended = true; $('end').hidden = false; $('endTxt').innerHTML = endText(); } }
  else if (running) camUpdate(director(), 0);
  if (!follow && running) cam.z *= Math.exp(-rdt * 1.5);   // لما تتحكم بإيدك الهدف ينزل للأرض بالتدريج
  frame();
});
window.addEventListener('resize', () => engine.resize());
const inPip = (x: number, y: number) => { if (!PIP) return false; const { W0, H0, X0, Y0 } = pipRect(); return x > X0 && x < X0 + W0 && y > Y0 && y < Y0 + H0; };
attachGestures(scene, canvas, () => setFollow(false), (x, y) => { if (inPip(x, y)) { pipBig = !pipBig; return true; } return false; });
// ===== الجبهة (WM14) =====
const fctx = { scene, unitAt: (k: string, n: string, side: 0 | 1, p: V3, q: Quaternion, o?: any) => unitAt(k, n, side, p, q, o), orient: (hd: number) => orient(hd), fx: (k: any, p: any, size: number, life: number, minPx: number, tint?: number, vx?: number, vy?: number, to?: any) => fx(k, p, size, life, minPx, tint, vx, vy, to),
  // انفجار خفيف للجبهة: بدون ومضة شاشة ولا هزّة (المعارك كثيرة)، وصوت واطي إذا قريب
  blast: (p: any, r: number) => { fx('glow', p, r * 4, .3, 14, 0xff9a40); fx('ex', p, r * 2.2, 1.3, 14); for (let i = 0; i < 3; i++) puff({ x: p.x + R(-r, r) * .4, y: p.y + R(-r, r) * .4 }, r * R(.5, .9), r * .06, R(10, 18), .5, 0x2a2622, 4); if (hyp(p.x - cam.x, p.y - cam.y) < camW()) thump(p, .18); },
  puff: (p: any, r: number, gr: number, life: number, a: number, tint: number, minPx?: number) => puff(p, r, gr, life, a, tint, minPx), caption, ground: (x: number, y: number) => groundH(x, y) * exag, camW, size: () => SIZES[SIZE] };
const card = new FrontCard(() => FV!.W, 0);
function onFrontTap(b: any, s: number | null, stack?: boolean) {
  if (!FV) return;
  if (stack && s !== null) { const p = FV.W.fp(s); setFollow(false); fly = null; const x0 = cam.x, y0 = cam.y, D0 = cam.D, D1 = D_of(70000), t0 = performance.now(); const go = () => { const u = Math.min(1, (performance.now() - t0) / 900), e = u * u * (3 - 2 * u); cam.x = lerp(x0, p.x, e); cam.y = lerp(y0, p.y, e); cam.D = Math.exp(lerp(Math.log(D0), Math.log(D1), e)); if (u < 1) requestAnimationFrame(go); }; go(); return; }
  if (b) card.openB(b); else if (s !== null) card.openS(s);
}
(window as any).fseek = async (h: number) => { if (!FV) return; FV.update(h); const sh = director(); shotKey = sh.key; fly = null; cam.x = sh.x; cam.y = sh.y; cam.z = 0; cam.D = D_of(sh.w); camAngles(sh, 10); for (let i = 0; i < 3; i++) frame(); await scene.whenReadyAsync(); frame(); };
(window as any).fperf = (frames = 60, step = true) => { if (!FV) return ''; for (const k in PT) delete PT[k]; const t0 = performance.now(), dc0 = (engine as any)._drawCalls?.current ?? 0;
  for (let i = 0; i < frames; i++) { tm('step', () => step && FV!.update(1 / 60 * 8)); tm('units', () => placeUnits()); tm('render', () => scene.render()); tm('overlay', () => FV!.draw(1 / 60, SW, SH)); tm('labels', () => updateLabels(scene, SW, SH, (x, y) => groundH(x, y) * exag)); }
  const terr = scene.meshes.filter(m => m.name.startsWith('terrain_')).map(m => `${m.name}:${Math.round(((m as any).getTotalIndices?.() ?? 0) / 3000)}k`).join(' ');
  return JSON.stringify({ msPerFrame: +((performance.now() - t0) / frames).toFixed(1), parts: Object.fromEntries(Object.entries(PT).map(([k, v]) => [k, +(v / frames).toFixed(2)])), drawCalls: Math.round(((engine as any)._drawCalls?.current - dc0) / frames), units: [...UV.values()].filter(u => u.seen === frameNo).length, dom: document.querySelectorAll('#front .ct').length, terr }); };
(window as any).FV = () => FV; (window as any).fdbg2 = () => JSON.stringify({ fxs: F.fxs.length, kinds: F.fxs.reduce((o: any, f) => (o[f.kind] = (o[f.kind] || 0) + 1, o), {}), puffs: F.puffs.length, us: [...UV.entries()].filter(([, u]) => u.seen === frameNo).slice(0, 5).map(([k, u]) => [k, u.n, u.node.isEnabled(), +u.node.scaling.x.toFixed(1), Math.round(u.node.position.x), Math.round(u.node.position.y), Math.round(u.node.position.z)]) }); (window as any).fdbg = () => JSON.stringify({ MODE, tier: FV?.tier, cam: { x: Math.round(cam.x), y: Math.round(cam.y), D: Math.round(cam.D) }, seen: [...UV.values()].filter(u => u.seen === frameNo).length, UV: UV.size, frameNo, cts: [...document.querySelectorAll('#front .ct')].filter(e => !(e as HTMLElement).style.transform.includes('-999')).length, line: (document.querySelector('.fl') as any)?.getAttribute('d')?.length }); (window as any).card = card;
// ===== الأزرار =====
const themeBtn = () => { $('bTheme').textContent = DARK() ? '🌙' : '☀️'; applyTheme(); setOutline(DARK()); };
const sizeBtn = () => { $('bSize').textContent = ['حجم ١', 'حجم ٢', 'حجم ٣', 'حجم ٤'][SIZE]; };
const zoomBtn = () => { $('bZoom').textContent = ['📷 قريب', '📷 وسط', '📷 بعيد'][ZI]; };
$('bZoom').onclick = () => { ZI = (ZI + 1) % 3; store.set('w3_zoom', String(ZI)); zoomBtn(); shotKey = ''; };
const pipBtn = () => { $('bPip').textContent = ['🎬 بالشاشة', '🎬 نافذة', '🎬 مطفأ'][SHOTMODE]; $('bPip').setAttribute('aria-pressed', String(SHOTMODE !== 2)); };
const camBtn = () => { $('bCam').textContent = ['🎥 من فوق', '🎥 مايل', '🎥 مطاردة'][CAMMODE]; };
$('bCam').onclick = () => { CAMMODE = (CAMMODE + 1) % 3; store.set('w3_cam', String(CAMMODE)); camBtn(); setFollow(true); };
$('bTheme').onclick = async () => { THEME = DARK() ? 'light' : 'dark'; store.set('w3_theme', THEME); themeBtn(); await setTheme(scene, THEME); };
$('bSize').onclick = () => { SIZE = (SIZE + 1) % 4; store.set('w3_size', String(SIZE)); sizeBtn(); };
$('bPip').onclick = () => { SHOTMODE = (SHOTMODE + 1) % 3; store.set('w3_shot', String(SHOTMODE)); if (SHOTMODE !== 1) PIP = null; pipBtn(); };
$('bFollow').onclick = () => setFollow(!follow);
$('bTop').onclick = () => { const t0 = cam.tilt, h0 = cam.head, s = performance.now(); const go = () => { const u = Math.min(1, (performance.now() - s) / 600), e = u * u * (3 - 2 * u); cam.tilt = t0 * (1 - e); cam.head = h0 * (1 - e); if (u < 1) requestAnimationFrame(go); }; go(); };
$('bPause').onclick = () => { paused = !paused; $('bPause').textContent = paused ? '▶' : '⏸'; };
const spdBtns = document.querySelectorAll<HTMLButtonElement>('#spd button');
spdBtns.forEach(bt => bt.onclick = () => { speed = +bt.dataset.s!; spdBtns.forEach(x => x.setAttribute('aria-pressed', String(x === bt))); });
$('bMute').onclick = () => { muted = !muted; $('bMute').textContent = muted ? '🔇' : '🔊'; if (ac) muted ? ac.suspend() : ac.resume(); };
$('bGo').onclick = () => start('op'); $('bFront').onclick = () => start('front'); $('bAgain').onclick = () => start(MODE);
themeBtn(); sizeBtn(); pipBtn(); zoomBtn(); camBtn();
let nl = 0; const prog = (s: string) => { nl++; $('load').textContent = `يحمّل ${s}… ${nl}`; };
await buildTerrain(scene, THEME, prog);
buildLabels(document.body, [['قاعدة البصرة', SITES.base], ['S-400', SITES.s400], ['باتريوت', SITES.pat], ['ذو الفقار', SITES.zolf], ['أميدية', SITES.omid], ['شلامجة', SITES.stage], ['خرمشهر ← الهدف', SITES.objective], ['خط دفاعهم', SITES.defense]]);
cam.x = SITES.stage.x; cam.y = SITES.stage.y; cam.D = 2.6e7;
await loadModels(scene, prog); unitsReady = true;
$('load').textContent = ''; ($('bGo') as HTMLButtonElement).disabled = false; ($('bFront') as HTMLButtonElement).disabled = false; $('bGo').textContent = '✈ عملية شلامجة';
if (AUTO) { start(qs.get('mode') === 'front' ? 'front' : 'op'); (window as any).ready = true; }
(window as any).seek = async (t: number) => { while (W.t < t - 1e-4) stepSim(Math.min(2, t - W.t), 1e9); const sh = director(); shotKey = sh.key; fly = null; cam.x = sh.x; cam.y = sh.y; cam.z = sh.z; cam.D = D_of(sh.w); curTs = sh.ts; camAngles(sh, 10); frame(); await scene.whenReadyAsync(); frame(); };
(window as any).opts = async (th: string, sz: number) => { THEME = th as any; SIZE = sz; themeBtn(); sizeBtn(); await setTheme(scene, THEME); frame(); };
(window as any).camMode = (m: number) => { CAMMODE = m; camBtn(); };
(window as any).camSet = async (o: any) => { setFollow(false); Object.assign(cam, o); frame(); await scene.whenReadyAsync(); frame(); };
(window as any).J3 = () => { const u = UV.get('j3')!; const act = scene.getActiveMeshes().data; return JSON.stringify({ en: u.node.isEnabled(), hullEn: u.hull.isEnabled(), vis: u.hull.isVisible, active: act.includes(u.hull), sub: u.hull.subMeshes?.length, verts: u.hull.getTotalVertices(), bb: u.hull.getBoundingInfo().boundingBox.extendSizeWorld.asArray().map(v => +v.toFixed(1)), pos: u.hull.getAbsolutePosition().asArray().map(v => +v.toFixed(0)), mat: u.hull.material?.getClassName(), alpha: (u.hull.material as any)?.subMaterials?.map((m: any) => m?.alpha + '/' + m?.transparencyMode) }); }; (window as any).W = () => W; (window as any).UVd = () => [...UV.entries()].filter(([, u]) => u.node.isEnabled()).sort((a, b) => Vector3.Distance(a[1].node.position, camera.position) - Vector3.Distance(b[1].node.position, camera.position)).slice(0, 4).map(([k, u]) => k + ' S=' + u.node.scaling.x.toFixed(1) + ' p=' + u.node.position.asArray().map(v => v.toFixed(0)).join(',') + ' cam=' + camera.position.asArray().map(v => v.toFixed(0)).join(',')); (window as any).freeze = () => engine.stopRenderLoop(); (window as any).pip = (big: boolean) => { pipBig = big; frame(); };
(window as any).ready0 = true;
// فحص اتجاه المجسم: عرض الطرف الأمامي (+z) مقابل الخلفي — الذيل (المثبتات) أعرض من الأنف
(window as any).noseCheck = () => Object.keys(MODELS).filter(n => PROTO[n]?.hull).map(n => { const pos = PROTO[n].hull.getVerticesData('position')!; let z0 = 1e9, z1 = -1e9;
  for (let i = 2; i < pos.length; i += 3) { z0 = Math.min(z0, pos[i]); z1 = Math.max(z1, pos[i]); } const L = z1 - z0; let wF = 0, wB = 0, hF = 0, hB = 0;
  for (let i = 0; i < pos.length; i += 3) { const x = Math.abs(pos[i]), y = pos[i + 1], z = pos[i + 2]; if (z > z1 - L * .12) { wF = Math.max(wF, x); hF = Math.max(hF, y); } if (z < z0 + L * .12) { wB = Math.max(wB, x); hB = Math.max(hB, y); } }
  return `${n}: front(+z) half-width ${wF.toFixed(2)} height ${hF.toFixed(2)} | back half-width ${wB.toFixed(2)} height ${hB.toFixed(2)}`; }).join('\n');
// قياس الأداء (WM13.1): عدادات + زمن كل جزء بالإطار
const PT: Record<string, number> = {}; const tm = (k: string, f: () => void) => { const t0 = performance.now(); f(); PT[k] = (PT[k] ?? 0) + performance.now() - t0; };
(window as any).perf = (frames = 60) => { for (const k in PT) delete PT[k]; const t0 = performance.now(), dc0 = (engine as any)._drawCalls?.current ?? 0;
  for (let i = 0; i < frames; i++) { tm('step', () => stepSim(1 / 60 * 3)); tm('units', () => { placeUnits(); placeMissiles(); }); tm('render', () => scene.render()); tm('labels', () => updateLabels(scene, SW, SH, (x, y) => groundH(x, y) * exag)); }
  const tri = scene.getActiveMeshes().data.reduce((a: number, m: any) => a + (m.getTotalIndices?.() ?? 0) / 3, 0);
  const tp = F.trails.reduce((a, r) => a + r.pts.length, 0);
  return JSON.stringify({ msPerFrame: +((performance.now() - t0) / frames).toFixed(1), parts: Object.fromEntries(Object.entries(PT).map(([k, v]) => [k, +(v / frames).toFixed(2)])), drawCallsPerFrame: Math.round(((engine as any)._drawCalls?.current - dc0) / frames), activeMeshes: scene.getActiveMeshes().length, triangles: Math.round(tri), meshes: scene.meshes.length, puffs: F.puffs.length, fxs: F.fxs.length, trails: F.trails.length, trailPts: tp, units: UV.size, labels: document.querySelectorAll('.lab').length }); }; (window as any).hide = (re: string) => { for (const m of scene.meshes) if (new RegExp(re).test(m.name)) m.isVisible = false; for (const sm of scene.spriteManagers ?? []) if (new RegExp(re).test(sm.name)) (sm as any).isVisible = false; frame(); }; (window as any).LV = () => (LEVELS as any[]).map(l => [l.name, l.mesh.getTotalIndices(), l.m.map((v: number) => v.toFixed(7)).join(',')]);
