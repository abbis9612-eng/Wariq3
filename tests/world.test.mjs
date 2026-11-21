// فحص خريطة «العالم» (GW12 W2.5): تنفتح بلا أخطاء، الضغط يختار منطقة، والرسم سريع حتى مع معالج أبطأ ×4 (تقليد تلفون متوسط).
// node tests/world.test.mjs [مجلد الصور]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
let bad = 0; const no = m => { console.log('❌ ' + m); bad++; };
const t0 = Date.now(); await p.goto(new URL('../prototypes/world/index.html', import.meta.url).href); await p.waitForFunction(() => window.__W, null, { timeout: 60000 });
const load = Date.now() - t0;
const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const view = (lon, lat, s, m = 'pol') => p.evaluate(([lon, lat, s, m]) => { const W = __W; W.cam.x = lon * Math.PI / 180; W.cam.y = -Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); W.cam.s = s; W.setMode(m); const a = []; for (let i = 0; i < 5; i++) a.push(W.draw()); return a.sort((x, y) => x - y)[2]; }, [lon, lat, s, m]);
const V = [['العالم كله', 20, 28, 70], ['الشرق الأوسط', 44, 31, 900], ['الشرق الأوسط (أرض)', 44, 31, 900, 'ter'], ['أوروبا قريب', 15, 50, 1500], ['العراق قريب', 44, 33, 4000], ['آسيا (علاقات)', 100, 30, 500, 'rel']];
const res = [];
for (const [n, lon, lat, s, m] of V) { const ms = await view(lon, lat, s, m); res.push(`${n} ${ms.toFixed(1)}ms`); if (ms > 33) no(`${n}: الرسم ${ms.toFixed(1)}ms (أبطأ من 30 إطار بالثانية)`); if (OUT) await p.screenshot({ path: `${OUT}/world_${res.length}.png` }); }
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
// الضغط على بغداد يختار منطقة عراقية
await view(44.4, 33.3, 3000); await p.evaluate(() => __W.tap(innerWidth / 2, innerHeight / 2));
const sel = await p.evaluate(() => __W.sel && [__W.sel.id, __W.sel.ctl]);
if (!sel || sel[1] !== 'IRQ') no('الضغط على بغداد ما اختار منطقة عراقية: ' + sel);
if (!(await p.isVisible('#card'))) no('البطاقة ما طلعت');
if (OUT) await p.screenshot({ path: `${OUT}/world_card.png` });
// W3: لعبة كاملة — تختار العراق، تبدي، سنة تمشي، وكل الألواح تنفتح، وأفعال الدبلوماسية تشتغل
await p.evaluate(() => { document.querySelector('#card').hidden = true; });
await p.fill('#q', 'العراق'); await p.click('#clist button[data-c=IRQ]'); await p.click('#go');
await p.evaluate(() => __G.step(400));
for (const t of ['me', 'flow', 'build', 'pop', 'dip', 'war', 'world', 'news']) { const tab = { flow: 'me', build: 'me', pop: 'me', war: 'dip', world: 'dip', news: 'dip' }[t]; if (tab) { if (!(await p.isVisible('#sheet [data-gp=' + t + ']'))) await p.click(`#tabs button[data-p=${tab}]`); await p.click(`#sheet [data-gp=${t}]`); } else await p.click(`#tabs button[data-p=${t}]`); if (!(await p.isVisible('#sheet'))) no('اللوح ما انفتح: ' + t); if (OUT) await p.screenshot({ path: `${OUT}/play_${t}.png` }); }
await p.click('#tabs button[data-p=me]'); await p.click('#sheet .seg[data-k=tax] button[data-v=high]');
const st = await p.evaluate(() => ({ t: __G.G.t, tax: __G.G.C.IRQ.tax, saved: (() => { try { return !!localStorage.getItem('wariq.world.v1'); } catch (e) { return 'ممنوع'; } })() }));
if (st.t < 400 || st.tax !== 'high') no('اللعب ما مشى: ' + JSON.stringify(st));
// W5: حرب برية = مسرح بخلايا وفرق، ويمشي بلا أخطاء
await p.evaluate(() => { __G.G.ap = 9; }); await p.evaluate(() => { const r = __W.R.find(r => r.ctl === 'SYR' && r.cap); __W.cam.x = r.ll[0] * Math.PI / 180; __W.cam.y = -Math.log(Math.tan(Math.PI / 4 + r.ll[1] * Math.PI / 360)); __W.cam.s = 3000; __W.tap(innerWidth / 2, innerHeight / 2); });
await p.click('[data-act=war]'); await p.click('[data-act=war]');
const th = await p.evaluate(() => __G.T && __G.T.cells.length); if (!th) no('إعلان الحرب على سوريا ما بنى مسرح');
await p.evaluate(() => __G.step(30)); if (OUT) await p.screenshot({ path: `${OUT}/play_theater.png` });
if (errs.length) no('أخطاء بالصفحة: ' + errs.join(' | '));
console.log(`تحميل ${load}ms · معالج ×4: ${res.join(' · ')} · الضغط: ${sel}`);
console.log(bad ? `\n❌ ${bad} مشكلة` : '\n✅ الخريطة سليمة'); await b.close(); process.exit(bad ? 1 : 0);
