// «العالم 3D» (WM11، I-065): خريطة العالم كلها 3D بنفس الشكل المرسوم، والحرب نفسها (sim2.ts) بمجسمات 3D حقيقية.
// الكاميرا من فوق وتميل/تلف بإصبعين؛ «تابع» يلاحق الأحداث؛ «🎬» كاميرا 3D ثانية تصوّر الإطلاق من الجنب.
import { Engine, Scene, Color4, Color3, HemisphericLight, DirectionalLight, Vector3, FreeCamera, Viewport, MeshBuilder, StandardMaterial, Sprite, Quaternion, type Mesh, type Camera } from '@babylonjs/core';
import { buildTerrain, setTheme, placeTerrain, exagOf, groundH, LEVELS } from './terrain';
import { cam, camera, makeCamera, applyCamera, attachGestures, limit } from './cam';
import { buildLabels, updateLabels } from './labels';
import { clamp, lerp } from './geo';
import { loadModels, makeUnit, orient, PROTO, MODELS, setOutline, type UnitVis } from './units';
import { FX, C, SMOKE, type Trail } from './fx';
import { World, SITES, type V3, type Msl } from './sim2';
import { MSL, AIR, GROUND } from './catalog';
const $ = (id: string) => document.getElementById(id)!;
const R = (a: number, b: number) => a + Math.random() * (b - a);
const hyp = Math.hypot;
const qs = new URLSearchParams(location.search), AUTO = qs.has('auto'), LITE = qs.has('lite');
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } } };
let THEME: 'light' | 'dark' = (store.get('w3_theme') as any) || 'dark', SIZE = +(store.get('w3_size') || 1), PIPON = store.get('w3_pip') !== '0';
const SIZES = [1, 1.6, 2.4];
let SW = innerWidth, SH = innerHeight;
const DARK = () => THEME === 'dark';
const canvas = document.createElement('canvas'); $('stage').appendChild(canvas);
const engine = new Engine(canvas, !LITE, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: !LITE, powerPreference: 'high-performance' }, !LITE);
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
function blast(p: { x: number; y: number }, r: number, ground: boolean, big = 1) {
  fx('glow', p, r * 3, .35, 40 * big); fx('glow', p, r * 7, .9, 90 * big, 0xff9a40); fx('ex', p, r * 2.2, 1.5, 34 * big); fx('ring', p, r * 5, .9, 34 * big);
  for (let i = 0; i < 6 + 6 * big; i++) { const a = R(0, 6.28), sp = R(.6, 1.6) * r * 2.5; fx('spark', p, R(.5, 1) * r, R(.5, 1.1), 0, 0xffc070, Math.cos(a) * sp, Math.sin(a) * sp); }
  for (let i = 0; i < 10 + 6 * big; i++) { const a = R(0, 6.28), d = R(.2, 1) * r; puff({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }, r * R(.4, .8), r * .05, R(14, 26), .6, ground ? 0x2a2622 : (DARK() ? 0x707a86 : 0x8a8a88), 6 * big, Math.cos(a) * r * .02, Math.sin(a) * r * .02); }
  if (ground) for (let i = 0; i < 4; i++) puff({ x: p.x + R(-r, r) * .3, y: p.y + R(-r, r) * .3 }, r * R(.5, .9), r * .08, R(40, 70), .55, 0x1e1b19, 6 * big, R(0, 1), R(0, 1));
}
let capAt = 0;
function caption(t: string) { const el = $('cap'); el.textContent = t; el.style.opacity = '1'; capAt = performance.now(); }
// ===== المخرج: لقطات بأولوية ومدة (وقت المحاكاة) =====
interface Focus { key: string; pos: () => { x: number; y: number } | null; w: () => number; ts: number; until: number; pri: number }
let focuses: Focus[] = [];
function focus(key: string, pos: Focus['pos'], w: number | (() => number), ts: number, dur: number, pri: number) { focuses = focuses.filter(f => f.key !== key); focuses.push({ key, pos, w: typeof w === 'number' ? () => w : w, ts, until: W.t + dur, pri }); }
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
    case 'kill_jet': blast(p, 60, false, 1.3); snd('boom_big', p, 1, .9); caption(D.side ? 'أسقطنا F-14 للعدو!' : `خسرنا ${AIR[D.type].name} — الطيار قفز بالمظلة`); focus('kj' + e.id, () => gf(p), 5000, .6, 6, 8); break;
    case 'crash': case 'debris_land': blast(p, 40, true); fx('fire', p, 18, 40, 10); snd('boom_mid', p, .7); break;
    case 'sam_silent': caption('رادار S-400 طفّى حتى لا يضربه الـHARM'); break;
    case 'sam_resume': caption('رادار S-400 رجع يشتغل'); break;
    case 'sam_kill': blast(p, 60, true, 1.4); fx('fire', p, 30, 120, 14); snd('boom_huge', p, 1, .9); caption('HARM دمّر منصة S-400!'); focus('sk' + Math.round(W.t), () => gf(p), 2200, .6, 6, 8); break;
    case 'selfdestruct': fx('glow', p, 40, .4, 24); fx('ex', p, 30, 1, 22); if (D.miss) caption(`الصاروخ فات ${D.tgt ? AIR[D.tgt]?.name ?? '' : 'الهدف'} بـ ${Math.round(D.miss)} م — راوغت ونجت`); snd('blast', p, .6); break;
    case 'bm_erect': caption('منصة ذو الفقار ترفع الصاروخ…'); focus('er' + Math.round(W.t), () => gf(p), 1600, 1.6, 8, 5); break;
    case 'bm_launch': { const m = W.msls.find(q => q.id === e.id); fx('glow', p, 120, .9, 50); fx('ring', p, 160, 2.5, 40); for (let i = 0; i < 30; i++) { const a = R(0, 6.28), s2 = R(4, 14); puff({ x: p.x + Math.cos(a) * R(5, 25), y: p.y + Math.sin(a) * R(5, 25) }, R(10, 20), R(3, 6), R(20, 36), .7, i % 3 ? 0xc9b48e : 0xffffff, 8, Math.cos(a) * s2, Math.sin(a) * s2); }
      snd('rocket', p, 1, .6); snd('boom_far', p, .9, .7); caption('ذو الفقار انطلق على قاعدة البصرة!'); focus('bl' + e.id, () => gf(p), 1800, .5, 4, 7);
      if (m) { focus('bm' + m.id, () => { const q = W.msls.find(x => x.id === m.id && x.ph !== 'dead'); return q ? { x: (q.p.x + q.tgtPt!.x) / 2, y: (q.p.y + q.tgtPt!.y) / 2 } : null; }, 200000, 10, 400, 3); startPip(m, p, 'zolf'); } break; }
    case 'incoming': snd('incoming', p, 1.2); snd('whiz', p, .8, .8); caption('صفير! الباليستي نازل على القاعدة'); break;
    case 'kill_bm': blast(p, 220, false, 1.5); fx('glow', p, 1500, 1.2, 150); snd('boom_huge', p, 1, .9); caption(`اعتراض! ضربة مباشرة على ارتفاع ${(p.z / 1000).toFixed(1)} كم`); focus('kb' + e.id, () => gf(p), 9000, .6, 6, 8); break;
    case 'bm_impact': blast(p, 180, true, 2); fx('fire', p, 60, 200, 20); fx('fire', { x: p.x + 60, y: p.y - 40 }, 40, 160, 14); snd('boom_huge', p, 1, .8); caption('الباليستي الثاني نزل على قاعدة البصرة — حريق'); focus('bi' + e.id, () => gf(p), 3500, .5, 7, 8); break;
    case 'advance': caption('الهجوم البري بدأ: دبابات أبرامز وعربات BMP تعبر الحدود'); focus('adv', () => gf(SITES.stage), 9000, 3, 12, 3); break;
    case 'gun': { const g = W.gnd.find(q => q.id === e.id); if (!g) break; lastGun.set(g.id, W.t); const h = D.hd, mz = { x: p.x + Math.cos(h) * 8, y: p.y + Math.sin(h) * 8 }; fx('glow', mz, 14, .18, 12); puff(mz, 6, 3, 4, .4, 0xc9b48e, 4); const m = W.msls.filter(q => q.from === g.type && q.ph !== 'dead').pop(); if (m?.tgtPt) fx('tracer', mz, 0, Math.max(.4, hyp(m.tgtPt.x - p.x, m.tgtPt.y - p.y) / 1650), 0, 0xffd28a, 0, 0, m.tgtPt); snd('tank', p, .5); break; }
    case 'salvo': caption(D.side ? 'راجمات العدو تضرب' : 'راجماتنا تمهّد على خط الدفاع'); snd('rocket', p, .7, 1.3); break;
    case 'rocket': fx('glow', p, 12, .15, 10); puff(p, 8, 3, 8, .4, 0xc9b48e, 4); break;
    case 'blast': { const r = D.r ?? 10; if (D.kind === 'shell') { fx('glow', p, r * 2, .2, 10); for (let i = 0; i < 3; i++) puff(p, r, 2, 5, .5, 0xa8957a, 4); }
      else if (D.kind === 'rocket') { fx('glow', p, 40, .25, 14); fx('spark', p, 20, .5, 0, 0xffc070, R(-40, 40), R(-40, 40)); for (let i = 0; i < 4; i++) puff(p, 16, 3, 8, .5, 0x3a332c, 5); if (Math.random() < .3) snd('boom_mid', p, .4); }
      else blast(p, r, true, D.kind === 'bomb' ? 1.1 : .8); if (D.kind === 'bomb') snd('boom_bomb', p, .9); break; }
    case 'kill_gnd': if (D.type === 't72') { const a = R(0, 6.28), d = R(6, 14); tossed.set(e.id!, { dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: R(-2, 2) }); } blast(p, 18, true, .8); fx('fire', p, 14, 90, 8); snd('boom_mid', p, .8); if (D.side === 0) caption(`خسرنا ${GROUND[D.type].name}`); break;
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
function audio() { try { if (!ac) { ac = new AudioContext(); master = ac.createGain(); master.gain.value = .9; master.connect(ac.createDynamicsCompressor()).connect(ac.destination); const a = ac; for (const [kk2, u] of Object.entries(SNDU)) fetch(u).then(r => r.arrayBuffer()).then(bb => a.decodeAudioData(bb)).then(buf => { smp[kk2.split('/').pop()!.replace('.mp3', '')] = buf; }).catch(() => {}); } if (ac.state === 'suspended') ac.resume(); } catch { /* */ } }
let curTs = 1;
function snd(n: string, p: V3, v: number, rate = 1) {
  if (!ac || !smp[n] || muted || act > 14) return; const eff = curTs * speed; if (eff > 40 && v < 1) return;
  const d = hyp(p.x - cam.x, p.y - cam.y), dEff = hyp(d, camW() * .4), delay = Math.min(2.5, d / 343) / Math.max(.4, eff), gain = v / (1 + dEff / 2500); if (gain < .03) return;
  const s = ac.createBufferSource(); s.buffer = smp[n]; s.playbackRate.value = rate; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(18000 / (1 + dEff / 4000), 600, 18000);
  const gn = ac.createGain(); gn.gain.value = gain; const pan = ac.createStereoPanner(); pan.pan.value = clamp((p.x - cam.x) / camW() * 1.4, -.8, .8); s.connect(lp).connect(gn).connect(pan).connect(master); s.start(ac.currentTime + delay); act++; s.onended = () => act--;
}

// ===== المخرج =====
function director(): { x: number; y: number; z: number; w: number; ts: number; key: string } {
  focuses = focuses.filter(f => W.t < f.until && f.pos());
  const f = focuses.sort((a, c) => c.pri - a.pri)[0];
  if (f) { const p = f.pos()! as { x: number; y: number; z?: number }; return { x: p.x, y: p.y, z: p.z ?? 0, w: f.w(), ts: f.ts, key: f.key }; }
  const fight = W.gnd.filter(g => g.st === 'move' && g.side === 0);
  // قريب على الآليات (I-066): يتابع دبابة وحدة ويتنقل بينهن كل 15 ث، بدل المجموعة من بعيد
  const tanks = fight.filter(g => g.type !== 'truck').sort((a, b) => a.id - b.id);
  if (tanks.length) { const g = tanks[Math.floor(W.t / 15) % tanks.length]; return { x: g.p.x + Math.cos(g.hd) * 120, y: g.p.y + Math.sin(g.hd) * 120, z: 0, w: 650, ts: 3, key: 'g' + g.id }; }
  const air = W.jets.filter(j => j.side === 0 && W.alive(j));
  if (air.length) { const ls = air.filter(j => j.slot % 2 === 0).sort((a, b) => a.id - b.id), j = (ls.length ? ls : air)[Math.floor(W.t / 30) % (ls.length || air.length)]; return { x: j.p.x, y: j.p.y, z: j.p.z, w: 3200, ts: 8, key: 'a' + j.id }; }   // يتابع طيارة قائدة وجناحها جنبها
  return { x: (SITES.stage.x + SITES.base.x) / 2, y: SITES.stage.y, z: 0, w: 60000, ts: 16, key: 'idle' };
}
function hud() {
  if (performance.now() - capAt > 4500) $('cap').style.opacity = '0';
  const S = W.stats; $('stats').innerHTML = `✈ خسرنا <b>${S.lostA[0]}</b> · أسقطنا <b>${S.lostA[1]}</b> │ 🛡 خسرنا <b>${S.lostG[0]}</b> · دمّرنا <b>${S.lostG[1]}</b> │ 🚀 اعترضنا <b>${S.bmShot}</b>/${S.bm}`;
  const o = W.msls.find(m => m.ph !== 'dead' && ['48N6', 'PAC-3', 'AIM-54', 'AIM-120', 'AGM-88', 'Zolfaghar'].includes(m.type)); let t = '';
  if (o && follow) { const sp = len3(o.vel); t = `${MSL[o.type].name} · ارتفاع ${(o.p.z / 1000).toFixed(1)} كم · ${Math.round(sp)} م/ث (ماخ ${(sp / 300).toFixed(1)})`; }
  $('read').textContent = t; const eff = (follow ? curTs : 1) * speed; $('rate').textContent = eff < .95 ? `تبطيء ×${eff.toFixed(1)}` : `الوقت ×${Math.round(eff)}`; $('rate').className = 'tag' + (eff < .95 ? ' slow' : '');
  $('clock').textContent = `${Math.floor(W.t / 60)}:${String(Math.floor(W.t % 60)).padStart(2, '0')}`;
}
function endText() { const S = W.stats; return `قواتنا وصلت خرمشهر بعد ${Math.round(W.t / 60)} دقيقة قتال.<br>طيارات: خسرنا ${S.lostA[0]} وأسقطنا ${S.lostA[1]}<br>دروع: خسرنا ${S.lostG[0]} (وصلت ${S.reinf} تعزيزات) ودمّرنا ${S.lostG[1]}<br>باليستي: اعترضنا ${S.bmShot} من ${S.bm}`; }// ===== المؤثرات لكل خطوة محاكاة (نقاط الذيول، بخار، غبار، جنازير) =====
let mTrail = new Map<number, Trail>(), dTrail = new Map<object, Trail>(), vTrail = new Map<number, Trail>(), tTrail = new Map<number, Trail[]>();
const trailOf = (m: Msl) => m.type === 'Zolfaghar' ? { r0: 4, gr: 6, life: 70, a: .85 } : m.type === '122mm' ? { r0: .8, gr: 1.6, life: 12, a: .5 } : { r0: 1.4, gr: 3, life: 40, a: .8 };
function fxStep(dt: number) {
  for (const m of W.msls) { let tr = mTrail.get(m.id);
    if (isBurning(m) && m.ph !== 'dead') { if (!tr) { tr = F.trail({ ...trailOf(m), col: SMOKE }); mTrail.set(m.id, tr); } F.add(tr, m.p, Math.max(6, hyp(m.vel.x, m.vel.y, m.vel.z) * .04)); }
    else if (tr && tr.live) { F.add(tr, m.p, 0); tr.live = false; } }
  for (const d of W.debris) { let tr = dTrail.get(d); if (!d.burn) { if (tr) tr.live = false; continue; } if (!tr) { tr = F.trail({ r0: 2, gr: 4, life: 30, a: .65, col: new Color3(.18, .16, .15) }); dTrail.set(d, tr); } F.add(tr, d.p, 20); }
  for (const j of W.jets) if (j.st === 'hit' && Math.random() < dt * 20) puff(j.p, R(6, 12), R(3, 6), R(14, 22), .7, 0x2b2724, 4);
  for (const f of F.fxs) if (f.kind === 'flare') { let tr = dTrail.get(f); if (!tr) { tr = F.trail({ r0: .8, gr: 1.8, life: 10, a: .6, col: SMOKE }); dTrail.set(f, tr); } F.add(tr, f.p, 6); if (f.t > f.life - .1) tr.live = false; }
  // بخار أطراف الأجنحة بالـG العالي (الجناح مايل حسب الميلان)، وخيط تكثيف فوق 8.5 كم
  for (const j of W.jets) { const fly = W.alive(j), L2 = MODELS[AIR[j.type].sprite].len, rx = Math.sin(j.hd), ry = -Math.cos(j.hd), cb = Math.cos(j.bank), sb = Math.sin(j.bank), span = L2 * .34;
    for (const sd of [-1, 1]) { const key = j.id * 10 + (sd + 1), on = fly && j.n > 4.2; let tr = vTrail.get(key);
      if (on) { if (!tr) { tr = F.trail({ r0: .4, gr: .8, life: 2.2, a: .55, col: SMOKE, minPx: .8 }); vTrail.set(key, tr); } F.add(tr, { x: j.p.x + rx * cb * span * sd, y: j.p.y + ry * cb * span * sd, z: j.p.z + sb * span * sd }, 8); }
      else if (tr) { tr.live = false; vTrail.delete(key); } }
    const key = j.id * 10 + 5, on = fly && j.p.z > 8500; let tr = vTrail.get(key);
    if (on) { if (!tr) { tr = F.trail({ r0: 1.5, gr: 2.5, life: 50, a: .5, col: SMOKE }); vTrail.set(key, tr); } F.add(tr, { x: j.p.x - Math.cos(j.hd) * L2 * 2, y: j.p.y - Math.sin(j.hd) * L2 * 2, z: j.p.z }, 30); }
    else if (tr) { tr.live = false; vTrail.delete(key); } }
  // الدبابات: غبار ورا الجنزير، وآثار جنزير على الأرض (شريطين)
  for (const g of W.gnd) { if (g.st === 'dead' || g.st === 'gone' || Math.abs(g.spd) < 1.5) continue; const L2 = MODELS[GROUND[g.type].sprite].len * .5, dir = Math.sign(g.spd);
    if (Math.random() < dt * Math.abs(g.spd) * .35) puff({ x: g.p.x - Math.cos(g.hd) * L2 * dir + R(-2, 2), y: g.p.y - Math.sin(g.hd) * L2 * dir + R(-2, 2), z: 1 }, R(2.5, 4), R(1.2, 2.2), R(5, 9), .35, DARK() ? 0x8a7c66 : 0xd8c8a4, 3, R(-1, 1), R(-1, 1));
    if (g.type === 'truck') continue; let tk = tTrail.get(g.id); if (!tk) { tk = [-1.7, 1.7].map(() => F.trail({ r0: .35, gr: 0, life: 900, a: .35, col: DARK() ? new Color3(.1, .09, .08) : new Color3(.42, .35, .25), flat: true, minPx: .5 })); tTrail.set(g.id, tk); }
    tk.forEach((t, i) => { const o = i ? 1.7 : -1.7; F.add(t, { x: g.p.x - Math.sin(g.hd) * o, y: g.p.y + Math.cos(g.hd) * o, z: 0 }, 7); }); }
}
// ===== الوحدات 3D =====
const UV = new Map<string, UnitVis & { dk: boolean; seen: number; flag: Sprite; side: 0 | 1; len: number; air: boolean; z: number }>(); let frameNo = 0;
function unitAt(key: string, n: string, side: 0 | 1, p: V3, q: Quaternion, o: { dead?: boolean; tur?: number; recoil?: number; toss?: { dx: number; dy: number; r: number }; air?: boolean; raise?: number } = {}) {
  let u = UV.get(key); if (u && u.dk !== !!o.dead && !PROTO[n].cont) { u.node.dispose(); u.sh.dispose(); u.flag.dispose(); UV.delete(key); u = undefined; }
  if (!u) { const b = makeUnit(n, scene, !!o.dead), flag = new Sprite('f', F.flags); flag.cellIndex = side; u = { ...b, dk: !!o.dead, seen: 0, flag, side, len: MODELS[n].len, air: !!o.air, z: 0 }; UV.set(key, u);
    if (PROTO[n].cont && o.dead) for (const m of u.node.getChildMeshes()) m.material = deadMat; }
  if (PROTO[n].cont && o.dead && !u.dk) { u.dk = true; for (const m of u.node.getChildMeshes()) m.material = deadMat; }
  u.seen = frameNo; u.z = p.z; u.node.setEnabled(true); u.node.position.set(p.x - cam.x, Y(p.x, p.y, p.z), p.y - cam.y); u.node.rotationQuaternion = q;
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
  for (const j of W.jets) { if (j.st === 'gone') continue; const air = j.st !== 'landed' && j.st !== 'parked'; unitAt('j' + j.id, AIR[j.type].sprite, j.side, j.p, air ? orient(j.hd, j.gam, j.bank) : orient(j.hd), { air }); }
  for (const bt of W.bats) bt.launchers.forEach((l, i) => unitAt(`b${bt.id}_${i}`, bt.type, bt.side, l.p, orient(l.hd), { dead: !l.alive, raise: bt.type === 's400' ? l.raise : undefined }));
  W.tels.forEach((tl, i) => unitAt('tel' + i, 'zolf', 1, tl.p, orient(3.6)));
  for (const g of W.gnd) { if (g.st === 'gone') continue; const hasT = g.type === 'abrams' || g.type === 't72', lg = lastGun.get(g.id);
    unitAt('g' + g.id, GROUND[g.type].sprite, g.side, g.p, orient(g.hd), { dead: g.st === 'dead', tur: hasT ? -Math.atan2(Math.sin(g.turret - g.hd), Math.cos(g.turret - g.hd)) * -1 : undefined, recoil: lg !== undefined ? Math.max(0, 1 - (W.t - lg) / .5) : 0, toss: tossed.get(g.id) }); }
  for (const [, u] of UV) if (u.seen !== frameNo) { u.node.setEnabled(false); u.sh.setEnabled(false); u.flag.isVisible = false; }
}
// الحجم لكل كاميرا: حقيقي من قريب، ومن بعيد حد أدنى بالبكسل حتى تنشاف (حجم ١/٢/٣)
function scaleUnits(c: Camera) { const cp = c.position, showUnits = cam.D < 2.2e6, big = c === camera ? SIZES[SIZE] : 1, minPx = c === camera ? 34 : 0;
  for (const [, u] of UV) { if (u.seen !== frameNo) continue; const p = u.node.position, px = mppAt(p.x - cp.x, p.y - cp.y, p.z - cp.z), S = Math.max(1, minPx * px / u.len) * big;
    u.node.setEnabled(showUnits || c !== camera); u.node.scaling.setAll(S); u.sh.scaling.set(S, .02, S);
    u.flag.isVisible = c === camera && showUnits && !u.dk; u.flag.position.set(p.x + 1.2 * px * 14, p.y + PROTO[u.n].h * S + 8 * px, p.z); u.flag.width = 18 * px * Math.sqrt(big); u.flag.height = 12 * px * Math.sqrt(big); } }
// ===== الصواريخ (جسم + لهب)، المظلات =====
const mPool: Mesh[] = [], gPool: Sprite[] = [], chPool: Mesh[] = [];
const mMat = new StandardMaterial('mm', scene); mMat.diffuseColor = new Color3(.93, .93, .9); mMat.emissiveColor = new Color3(.35, .35, .33);
const chMat = new StandardMaterial('chm', scene); chMat.diffuseColor = new Color3(.95, .62, .2); chMat.emissiveColor = new Color3(.3, .2, .08); chMat.backFaceCulling = false;
interface MV { m: Msl; body: Mesh; glow?: Sprite }
let mVis: MV[] = [], chVis: { c: any; mesh: Mesh }[] = [];
function placeMissiles() {
  mVis = []; let gi = 0, mi = 0;
  for (const m of W.msls) { if (m.ph === 'dead' || m.type === '125mm' || m.type === '120mm') continue; const M = MSL[m.type];
    const body = mPool[mi] ?? (() => { const b = MeshBuilder.CreateCylinder('msl', { height: 1, diameter: 1, tessellation: 8 }, scene); b.material = mMat; b.isPickable = false; mPool.push(b); return b; })(); mi++;
    body.setEnabled(true); body.position.set(m.p.x - cam.x, Y(m.p.x, m.p.y, m.p.z), m.p.y - cam.y);
    const v = new Vector3(m.vel.x, m.vel.z, m.vel.y); if (v.lengthSquared() < 1) v.set(0, 1, 0); v.normalize();
    body.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.UpReadOnly, v, new Quaternion());
    const mv: MV = { m, body }; if (isBurning(m) || m.type === 'Zolfaghar') { const g = gPool[gi] ?? (() => { const s = new Sprite('mg', F.glow); gPool.push(s); return s; })(); gi++; g.isVisible = true; mv.glow = g; }
    mVis.push(mv); void M; }
  for (; mi < mPool.length; mi++) mPool[mi].setEnabled(false); for (; gi < gPool.length; gi++) gPool[gi].isVisible = false;
  chVis = []; let ci = 0;
  for (const c of W.chutes) { const mesh = chPool[ci] ?? (() => { const b = MeshBuilder.CreateSphere('chute', { diameter: 1, segments: 8, slice: .5 }, scene); b.material = chMat; chPool.push(b); return b; })(); ci++;
    const age = c.landed ? (W.t - c.landed) / 12 : 0; mesh.setEnabled(age < 1); mesh.position.set(c.p.x - cam.x, Y(c.p.x, c.p.y, c.p.z) + (c.landed ? 0 : 6), c.p.y - cam.y); mesh.rotation.x = c.landed ? Math.PI / 2 * Math.min(1, age * 3) : 0; chVis.push({ c, mesh }); }
  for (; ci < chPool.length; ci++) chPool[ci].setEnabled(false);
}
function scaleMissiles(c: Camera) { const cp = c.position;
  for (const { m, body, glow } of mVis) { const M = MSL[m.type], p = body.position, px = mppAt(p.x - cp.x, p.y - cp.y, p.z - cp.z), L = Math.max(M.len, (m.type === '122mm' ? 6 : 10) * px), D = Math.max(M.diam, (c === camera ? 2 : 1.2) * px);
    body.scaling.set(D, L, D); mMat.emissiveColor.set(.35, .35, .33);
    if (glow) { const burning = isBurning(m), u = body.rotationQuaternion!, tail = new Vector3(0, -L / 2, 0).rotateByQuaternionToRef(u, new Vector3()); glow.position.copyFrom(p).addInPlace(tail);
      const gs = burning ? Math.max(m.type === '122mm' ? 10 * px : 22 * px, L * 1.6) * R(.9, 1.1) : 12 * px; glow.width = glow.height = gs; glow.color.set(1, burning ? 1 : .8, burning ? 1 : .6, burning ? 1 : .4);
      if (m.type === 'Zolfaghar' && m.vel.z < -900 && m.p.z < 45000) { glow.width = glow.height = gs + (45000 - m.p.z) / 900 * px * 3; glow.color.set(1, .75, .45, 1); } } }
  for (const { mesh } of chVis) { const p = mesh.position, px = mppAt(p.x - cp.x, p.y - cp.y, p.z - cp.z), S = Math.max(9, 10 * px); mesh.scaling.set(S, S * .45, S); } }
// ===== اللقطة القريبة: كاميرا 3D ثانية من الجنب =====
let PIP: { mid: number; at: V3; kind: string; t0: number; dur: number; az?: number; jet?: number; hd: number } | null = null, pipBig = false;
const pipCam = new FreeCamera('pip', new Vector3(0, 10, 0), scene); pipCam.fov = .75; pipCam.minZ = .5; pipCam.maxZ = 4e5; pipCam.inputs.clear();
const pipRect = () => { const W0 = pipBig ? SW - 16 : Math.round(Math.min(SW * .5, 260)), H0 = pipBig ? Math.round(SH * .6) : Math.round(W0 * 1.2), X0 = 8, Y0 = pipBig ? 76 : 96; return { W0, H0, X0, Y0 }; };
function startPip(m: Msl, at: V3, kind: string, az?: number, jet?: number) {
  if (!PIPON) return; const l = W.bats.flatMap(bb => bb.launchers).find(l2 => hyp(l2.p.x - at.x, l2.p.y - at.y) < 40), tel = W.tels.find(tl => hyp(tl.p.x - at.x, tl.p.y - at.y) < 40);
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
function camUpdate(sh: ReturnType<typeof director>, rdt: number) {
  if (!follow) return; const w0 = camW();
  if (sh.key !== shotKey) { const d = hyp(sh.x - cam.x, sh.y - cam.y); if (shotKey && d > Math.max(w0, sh.w) * .8) fly = { x0: cam.x, y0: cam.y, z0: cam.z, w0, t: 0, d: shotKey === 'world' ? 4.5 : clamp(.8 + Math.log10(d / Math.min(w0, sh.w) + 1) * .45, .8, 2.2) }; shotKey = sh.key; }
  if (fly) { fly.t += rdt; const u = clamp(fly.t / fly.d, 0, 1), e = u * u * (3 - 2 * u), dist = hyp(sh.x - fly.x0, sh.y - fly.y0), l0 = Math.log(fly.w0), l1 = Math.log(sh.w), bump = Math.max(0, Math.log(dist * 1.3) - Math.max(l0, l1));
    cam.x = lerp(fly.x0, sh.x, e); cam.y = lerp(fly.y0, sh.y, e); cam.z = lerp(fly.z0, sh.z, e); cam.D = D_of(Math.exp(lerp(l0, l1, e) + bump * Math.sin(Math.PI * e))); if (u >= 1) fly = null; return; }
  const a = 1 - Math.exp(-rdt * 3), z = 1 - Math.exp(-rdt * 2.4); cam.x = lerp(cam.x, sh.x, a); cam.y = lerp(cam.y, sh.y, a); cam.z = lerp(cam.z, sh.z, a); cam.D = D_of(Math.exp(lerp(Math.log(w0), Math.log(sh.w), z)));
}
// ===== الحلقة =====
let W = new World(), speed = 1, paused = false, running = false, ended = false;
function reset() { W = new World(); F.clear(); mTrail = new Map(); dTrail = new Map(); vTrail = new Map(); tTrail = new Map(); focuses = []; PIP = null; ended = false; shotKey = ''; fly = null; lastGun.clear(); tossed.clear(); for (const [, u] of UV) { u.node.dispose(); u.sh.dispose(); u.flag.dispose(); } UV.clear(); }
function start() { reset(); setFollow(true); shotKey = 'world'; if (cam.D < 1e6) { const s = director(); cam.x = s.x; cam.y = s.y; cam.z = s.z; cam.D = D_of(s.w); shotKey = ''; } /* أول مرة: الكاميرا تنزل من العالم كله للمعركة */ running = true; $('start').hidden = true; $('ui').hidden = false; $('end').hidden = true; audio(); caption('العملية بدأت: الهدف خرمشهر'); }
function stepSim(simDt: number, budget = 14) { let left = simDt, n = 0; const t0 = performance.now(); while (left > 1e-6 && n < 3000 && (n % 50 || performance.now() - t0 < budget)) { const d = Math.min(.02, left); left -= d; n++; W.step(d); fxStep(d); for (const e of W.ev.splice(0)) onEvent(e); } F.age(simDt - Math.max(0, left)); }
scene.onBeforeCameraRenderObservable.add(c => { curCam = c; const vp = c.viewport; curH = engine.getRenderHeight() * vp.height || 1; scaleUnits(c); scaleMissiles(c); F.draw(c, mppAt, C(smokeCol())); });
function frame() {
  SW = engine.getRenderWidth() / (engine.getHardwareScalingLevel() ? 1 / engine.getHardwareScalingLevel() : 1); SH = engine.getRenderHeight() / (1 / engine.getHardwareScalingLevel());
  SW = innerWidth; SH = innerHeight;
  limit(); exag = exagOf(cam.D); const gh = groundH(cam.x, cam.y) * exag + (follow ? cam.z : 0); applyCamera(gh);
  scene.fogDensity = cam.tilt > .15 ? 1.6 / (cam.D * 9) : 0; placeTerrain(cam, exag, camera.position, scene.fogColor, scene.fogDensity * .7);
  if (unitsReady) { placeUnits(); placeMissiles(); placePip(); }
  scene.render(); updateLabels(scene, SW, SH, (x, y) => groundH(x, y) * exag); if (running) hud();
}
let unitsReady = false;
engine.runRenderLoop(() => {
  const rdt = Math.min(.05, engine.getDeltaTime() / 1000);
  if (running && !paused) { const sh = director(); curTs = follow ? sh.ts : 1; stepSim(rdt * curTs * speed); camUpdate(director(), rdt); if (W.endT > 0 && W.t > W.endT && !ended) { ended = true; $('end').hidden = false; $('endTxt').innerHTML = endText(); } }
  else if (running) camUpdate(director(), 0);
  frame();
});
window.addEventListener('resize', () => engine.resize());
const inPip = (x: number, y: number) => { if (!PIP) return false; const { W0, H0, X0, Y0 } = pipRect(); return x > X0 && x < X0 + W0 && y > Y0 && y < Y0 + H0; };
attachGestures(scene, canvas, () => setFollow(false), (x, y) => { if (inPip(x, y)) { pipBig = !pipBig; return true; } return false; });
// ===== الأزرار =====
const themeBtn = () => { $('bTheme').textContent = DARK() ? '🌙' : '☀️'; applyTheme(); setOutline(DARK()); };
const sizeBtn = () => { $('bSize').textContent = ['حجم ١', 'حجم ٢', 'حجم ٣'][SIZE]; };
const pipBtn = () => { $('bPip').textContent = PIPON ? '🎬 قريب' : '🎬 مطفأ'; $('bPip').setAttribute('aria-pressed', String(PIPON)); };
$('bTheme').onclick = async () => { THEME = DARK() ? 'light' : 'dark'; store.set('w3_theme', THEME); themeBtn(); await setTheme(scene, THEME); };
$('bSize').onclick = () => { SIZE = (SIZE + 1) % 3; store.set('w3_size', String(SIZE)); sizeBtn(); };
$('bPip').onclick = () => { PIPON = !PIPON; store.set('w3_pip', PIPON ? '1' : '0'); if (!PIPON) PIP = null; pipBtn(); };
$('bFollow').onclick = () => setFollow(!follow);
$('bTop').onclick = () => { const t0 = cam.tilt, h0 = cam.head, s = performance.now(); const go = () => { const u = Math.min(1, (performance.now() - s) / 600), e = u * u * (3 - 2 * u); cam.tilt = t0 * (1 - e); cam.head = h0 * (1 - e); if (u < 1) requestAnimationFrame(go); }; go(); };
$('bPause').onclick = () => { paused = !paused; $('bPause').textContent = paused ? '▶' : '⏸'; };
const spdBtns = document.querySelectorAll<HTMLButtonElement>('#spd button');
spdBtns.forEach(bt => bt.onclick = () => { speed = +bt.dataset.s!; spdBtns.forEach(x => x.setAttribute('aria-pressed', String(x === bt))); });
$('bMute').onclick = () => { muted = !muted; $('bMute').textContent = muted ? '🔇' : '🔊'; if (ac) muted ? ac.suspend() : ac.resume(); };
$('bGo').onclick = start; $('bAgain').onclick = start;
themeBtn(); sizeBtn(); pipBtn();
let nl = 0; const prog = (s: string) => { nl++; $('load').textContent = `يحمّل ${s}… ${nl}`; };
await buildTerrain(scene, THEME, prog);
buildLabels(document.body, [['قاعدة البصرة', SITES.base], ['S-400', SITES.s400], ['باتريوت', SITES.pat], ['ذو الفقار', SITES.zolf], ['أميدية', SITES.omid], ['شلامجة', SITES.stage], ['خرمشهر ← الهدف', SITES.objective], ['خط دفاعهم', SITES.defense]]);
cam.x = SITES.stage.x; cam.y = SITES.stage.y; cam.D = 2.6e7;
await loadModels(scene, prog); unitsReady = true;
$('load').textContent = ''; ($('bGo') as HTMLButtonElement).disabled = false; $('bGo').textContent = 'ابدأ العملية';
if (AUTO) { start(); (window as any).ready = true; }
(window as any).seek = async (t: number) => { while (W.t < t - 1e-4) stepSim(Math.min(2, t - W.t), 1e9); const sh = director(); shotKey = sh.key; fly = null; cam.x = sh.x; cam.y = sh.y; cam.z = sh.z; cam.D = D_of(sh.w); curTs = sh.ts; frame(); await scene.whenReadyAsync(); frame(); };
(window as any).opts = async (th: string, sz: number) => { THEME = th as any; SIZE = sz; themeBtn(); sizeBtn(); await setTheme(scene, THEME); frame(); };
(window as any).camSet = async (o: any) => { setFollow(false); Object.assign(cam, o); frame(); await scene.whenReadyAsync(); frame(); };
(window as any).J3 = () => { const u = UV.get('j3')!; const act = scene.getActiveMeshes().data; return JSON.stringify({ en: u.node.isEnabled(), hullEn: u.hull.isEnabled(), vis: u.hull.isVisible, active: act.includes(u.hull), sub: u.hull.subMeshes?.length, verts: u.hull.getTotalVertices(), bb: u.hull.getBoundingInfo().boundingBox.extendSizeWorld.asArray().map(v => +v.toFixed(1)), pos: u.hull.getAbsolutePosition().asArray().map(v => +v.toFixed(0)), mat: u.hull.material?.getClassName(), alpha: (u.hull.material as any)?.subMaterials?.map((m: any) => m?.alpha + '/' + m?.transparencyMode) }); }; (window as any).W = () => W; (window as any).UVd = () => [...UV.entries()].filter(([, u]) => u.node.isEnabled()).sort((a, b) => Vector3.Distance(a[1].node.position, camera.position) - Vector3.Distance(b[1].node.position, camera.position)).slice(0, 4).map(([k, u]) => k + ' S=' + u.node.scaling.x.toFixed(1) + ' p=' + u.node.position.asArray().map(v => v.toFixed(0)).join(',') + ' cam=' + camera.position.asArray().map(v => v.toFixed(0)).join(',')); (window as any).freeze = () => engine.stopRenderLoop(); (window as any).pip = (big: boolean) => { pipBig = big; frame(); };
(window as any).ready0 = true; (window as any).hide = (re: string) => { for (const m of scene.meshes) if (new RegExp(re).test(m.name)) m.isVisible = false; for (const sm of scene.spriteManagers ?? []) if (new RegExp(re).test(sm.name)) (sm as any).isVisible = false; frame(); }; (window as any).LV = () => (LEVELS as any[]).map(l => [l.name, l.mesh.getTotalIndices(), l.m.map((v: number) => v.toFixed(7)).join(',')]);
