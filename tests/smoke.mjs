// اختبار دخان: يشغّل اللعبة بمتصفح بلا واجهة ويفشل عند أي خطأ JavaScript.
// التشغيل: node tests/smoke.mjs [index.html] [months] [country]
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const file = path.resolve(process.argv[2] || 'index.html');
const MONTHS = +(process.argv[3] || 36);
const PID = process.argv[4] || 'IQ';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());
await page.goto('file://' + file);
await page.evaluate(pid => { try { localStorage.clear() } catch (e) {} ; U.start.pid = pid; }, PID);
await page.click('[data-a=begin]');

const stats = await page.evaluate(async ({ MONTHS }) => {
  const out = { months: 0, over: null, worst: 0, issues: 0 };
  for (let i = 0; i < MONTHS && !S.over; i++) {
    while (S.issues.length) { const it = S.issues[0]; out.issues++; resolveIssue(it.uid, 0); }
    const t = performance.now(); A.next(); const dt = performance.now() - t;
    out.worst = Math.max(out.worst, dt); out.months++;
    for (const tab of ['map', 'state', 'army', 'world', 'report']) { U.tab = tab; render(); }
    for (const [tab, subs] of Object.entries({ state: ['eco', 'res', 'home', 'regs'], army: ['forces', 'ind', 'rd', 'nat', 'nuke'], world: ['rank', 'dip', 'wars'] }))
      for (const s of subs) { U.tab = tab; U.sub[tab] = s; render(); }
  }
  out.over = S.over; out.y = S.y; out.m = S.m; out.rank = ranking().findIndex(x => x.id === S.pid) + 1;
  out.debtRatio = +(S.p.debt / P().gdp).toFixed(2); out.stab = Math.round(P().stab);
  for (const o of alive()) if (o.id !== S.pid) sheetCountry(o.id);
  closeSheet();
  return out;
}, { MONTHS });

// معركة واحدة
const battle = await page.evaluate(() => {
  const me = S.pid; const t = alive().find(o => o.id !== me && reachable(me, o.id) && !allied(o.id, me));
  if (!t) return 'no target';
  declareWar(me, t.id); const r = targets(me, t.id)[0];
  const res = doOp(me, t.id, r.id, { commit: 'mid', tactic: 'direct' });
  Battle.play(res, () => {}); return t.id;
});
await page.waitForTimeout(2500);
await page.screenshot({ path: process.env.SHOT || '/tmp/battle.png' });
await page.evaluate(() => A.battleSkip());
await page.waitForTimeout(800);
await page.evaluate(() => A.battleEnd());

console.log(JSON.stringify({ file: path.basename(file), PID, ...stats, battle, errors }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
