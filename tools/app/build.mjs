// يبني تطبيق «العالم» (PWA) بمجلد app/: ملفات اللعبة + الصور والأصوات من «الحرب الكبرى» + الأيقونات + service worker بقائمة كل الملفات.
// node tools/app/build.mjs   ← بعدها app/ ينرفع لأي استضافة HTTPS (GitHub Pages بالـworkflow) أو يدخل Capacitor (android/).
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
const R = path.resolve(new URL('../..', import.meta.url).pathname), OUT = path.join(R, 'app'), W = path.join(R, 'prototypes/world'), GW = path.join(R, 'prototypes/grandwar');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const files = [];
const cp = (src, rel) => { const d = path.join(OUT, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(src, d); files.push(rel); };
// 1) اللعبة: index.html وكل سكربت يناديه (نقرا القائمة من الصفحة نفسها حتى ما ننسى ملف)
const html = fs.readFileSync(path.join(W, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
for (const s of scripts) cp(path.join(W, s), s);
cp(path.join(W, 'index.html'), 'index.html'); cp(path.join(W, 'manifest.webmanifest'), 'manifest.webmanifest');
for (const f of fs.readdirSync(path.join(W, 'icons'))) cp(path.join(W, 'icons', f), 'icons/' + f);
if (fs.existsSync(path.join(W, 'fonts'))) for (const f of fs.readdirSync(path.join(W, 'fonts'))) if (/\.(woff2|css|txt)$/i.test(f)) cp(path.join(W, 'fonts', f), 'fonts/' + f);   // I-144: الخطوط داخل التطبيق (بدون نت)
if (fs.existsSync(path.join(W, 'map'))) for (const f of fs.readdirSync(path.join(W, 'map'))) if (/\.(webp|png|jpg)$/i.test(f)) cp(path.join(W, 'map', f), 'map/' + f);
// 2) الصور والأصوات (مشهد المعركة والجو): كل webp بـ img/ (و img/bv/) وكل الأصوات
const walk = (d, base) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p, base + f + '/'); else if (/\.(webp|mp3|ogg|wav|m4a)$/i.test(f)) cp(p, base + f); } };
walk(path.join(GW, 'img'), 'img/'); if (fs.existsSync(path.join(GW, 'sounds'))) walk(path.join(GW, 'sounds'), 'sounds/');
// 3) النسخة = آخر commit + بصمة المحتوى (كل تغيير = كاش جديد)
let ver = 'dev'; try { ver = execSync('git rev-parse --short HEAD', { cwd: R }).toString().trim(); } catch (e) { }
const sum = files.reduce((h, f) => { const b = fs.readFileSync(path.join(OUT, f)); let x = h; for (let i = 0; i < b.length; i += 997) x = (x * 31 + b[i]) | 0; return (x * 31 + b.length) | 0; }, 7);
ver += '-' + (sum >>> 0).toString(36);
fs.writeFileSync(path.join(OUT, 'version.txt'), ver + '\n'); files.push('version.txt');
const sw = fs.readFileSync(path.join(R, 'tools/app/sw.tpl.js'), 'utf8').replace('__VER__', ver).replace('__FILES__', JSON.stringify(['./', ...files], null, 0));
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);
const size = files.reduce((t, f) => t + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`app/ جاهز: ${files.length} ملف، ${(size / 1048576).toFixed(1)} ميغا، نسخة ${ver}`);
