// يدوّر على بذرة تعطي قصة متوازنة للعرض (نفس القوانين، بس نختار التشغيلة)
import { World } from '../src/sim2.ts';
const res: any[] = [];
for (let seed = 1; seed <= 16; seed++) { const w = new World(seed), c: Record<string, number> = {}; while (w.t < 2600 && !(w.endT > 0 && w.t > w.endT)) { w.step(.02); for (const e of w.ev.splice(0)) c[e.type] = (c[e.type] || 0) + 1; }
  const S = w.stats, sc = +(S.lostA[0] >= 1 && S.lostA[0] <= 3) + +(S.lostA[1] >= 1) + +((c.sam_kill || 0) >= 1) + +(S.lostG[0] >= 2 && S.lostG[0] <= 6) + +(S.reinf >= 1) + +w.won + +((c.kill_bm || 0) >= 1) + +((c.landed || 0) >= 3) + +((c.sam_eject || 0) >= 3);
  res.push({ seed, sc, t: w.t | 0, lostA: S.lostA, lostG: S.lostG, harm: c.sam_kill || 0, bm: `${S.bmShot}/${S.bm}`, reinf: S.reinf, won: w.won, landed: c.landed || 0, sam: c.sam_eject || 0 }); }
res.sort((a, b) => b.sc - a.sc || a.t - b.t); console.log(res.slice(0, 8).map(r => JSON.stringify(r)).join('\n'));
