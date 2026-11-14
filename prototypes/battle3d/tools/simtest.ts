// يفحص إن sim.ts يطابق معركة اللعبة الأساسية: يشغّل كود Battle الأصلي من index.html داخل Node
// (بدون رسم) جنب النقل، على نفس النتائج، ويقارن المعدلات على بذور كثيرة.
// node tools/simtest.ts [عدد_البذور]
import fs from 'fs';
import type { Res } from '../src/sim.ts';
import { create, step, SAMPLES, VW, VH, END } from '../src/sim.ts';

const N = +(process.argv[2] || 200);
const html = fs.readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('const Battle=(()=>{'), html.indexOf('return {play};\n})();'));
const noop: any = new Proxy(function () {}, { get: (_t, k) => k === Symbol.toPrimitive ? () => 0 : noop, apply: () => noop, set: () => true });
const mkOrig = new Function('document', 'A', '$', 'C', 'TERR', 'clamp', 'pick', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'window',
  src + `
  return { init(r,w,h){res=r;W_=w;H=h;ppm=H/FIELD;T=0;muted=true;makeGround(r.terr);setup();}, step(dt){T+=dt;step(dt)}, get S(){return S_}, get T(){return T} };})();return Battle;`);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = (a: any[]) => a[Math.floor(Math.random() * a.length)];
const doc = { createElement: () => ({ getContext: () => noop, width: 0, height: 0 }) };

function mulberry(a: number) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

type Stat = Record<string, number>;
function summarize(u: any[], b: any[], extra: Stat): Stat {
  const s: Stat = { ...extra };
  for (const side of [0, 1]) for (const ty of ['tank', 'inf', 'arty', 'mlrs', 'ad']) {
    const l = u.filter(x => x.side === side && x.type === ty); if (!l.length) continue;
    s[`${side ? 'D' : 'A'}.${ty}.n`] = l.length; s[`${side ? 'D' : 'A'}.${ty}.alive`] = l.filter(x => x.alive).length;
    s[`${side ? 'D' : 'A'}.${ty}.y`] = l.reduce((a, x) => a + x.y, 0) / l.length;
  }
  s.houses = b.length; s.housesDead = b.filter(x => x.dead).length; return s;
}
function runOrig(res: Res, seed: number) {
  const r = mulberry(seed); const mr = Math.random; Math.random = r;
  try {
    const B = mkOrig(doc, {}, () => noop, () => ({ f: '', n: '' }), {}, clamp, pick, {}, () => 0, () => 0, {});
    B.init(structuredClone(res), VW, VH); let booms = 0;
    for (let i = 0; i < END * 60; i++) { const before = B.S.flash.length; B.step(1 / 60); booms += 0 * before; }
    return summarize(B.S.u, B.S.b, { booms });
  } finally { Math.random = mr; }
}
function runPort(res: Res, seed: number) {
  const w = create(structuredClone(res), mulberry(seed)); let booms = 0, bad = 0;
  for (let i = 0; i < END * 60; i++) { step(w, 1 / 60); for (const f of w.fx) if (f.k === 'boom') booms++; w.fx.length = 0; for (const x of w.u) if (!isFinite(x.x + x.y)) bad++; }
  if (bad) throw new Error('NaN position');
  return summarize(w.u, w.b, { booms: 0 * booms });
}
let ok = true;
for (const [name, res] of Object.entries(SAMPLES)) {
  const acc: Record<string, [number, number]> = {};
  for (let s = 1; s <= N; s++) {
    const o = runOrig(res, s * 7919), p = runPort(res, s * 104729);
    for (const k of new Set([...Object.keys(o), ...Object.keys(p)])) { acc[k] ??= [0, 0]; acc[k][0] += (o[k] ?? 0) / N; acc[k][1] += (p[k] ?? 0) / N; }
  }
  console.log(`\n== ${name} (${N} معركة لكل طرف)  المفتاح: الأصل | النقل`);
  for (const [k, [a, b]] of Object.entries(acc)) {
    if (k === 'booms') continue;
    const tol = k.endsWith('.y') ? 4 : Math.max(.35, Math.abs(a) * .08); const bad = Math.abs(a - b) > tol; if (bad) ok = false;
    console.log(`${bad ? '✗' : '✓'} ${k.padEnd(14)} ${a.toFixed(2).padStart(8)} | ${b.toFixed(2).padStart(8)}`);
  }
}
console.log(ok ? '\nPASS: النقل يطابق الأصل' : '\nFAIL'); if (!ok) process.exit(1);
