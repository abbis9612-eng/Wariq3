// فحص بيانات «العالم» (GW12 W1): كل رقم بمصدر، النطاقات معقولة، وتغطية الدرجات
// node tests/data.test.mjs
import fs from 'fs';
const root = new URL('../data/', import.meta.url);
const list = JSON.parse(fs.readFileSync(new URL('world/countries.json', root), 'utf8'));
const ids = new Set(list.map(c => c.id)), tierOf = Object.fromEntries(list.map(c => [c.id, c.tier]));
let fails = 0, warns = 0; const bad = m => { console.log('❌ ' + m); fails++; }, warn = m => { if (warns++ < 40) console.log('⚠️ ' + m); };
const files = fs.readdirSync(new URL('countries/', root)).filter(f => /^[A-Z]{3}\.json$/.test(f));
const KNOWN = new Set([...ids, 'SUN', 'CSK', 'YUG', 'GDR', 'EU', 'INT']);   // منشأ قديم أو مشترك (سوفيتي، تشيكوسلوفاكي، يوغسلافي...)
let nums = 0;
for (const f of files) {
  const id = f.slice(0, 3); let d; try { d = JSON.parse(fs.readFileSync(new URL('countries/' + f, root), 'utf8')); } catch (e) { bad(`${f}: JSON خربان ${e.message}`); continue; }
  if (!ids.has(id) || d.id !== id) bad(`${f}: الرمز مو بالقائمة أو ما يطابق`);
  const S = d.src || {};
  const walk = (o, path) => {
    if (Array.isArray(o)) return o.forEach((x, i) => walk(x, path + '[' + i + ']'));
    if (!o || typeof o !== 'object') return;
    if ('v' in o || 'n' in o) { nums++; if (!o.s && o.c !== 'ق') bad(`${id} ${path}: رقم بلا مصدر`); else if (o.s && !o.s.split(',').every(k => S[k.trim()])) bad(`${id} ${path}: المصدر «${o.s}» مو معرّف بـ src`); if (!['ح', 'ت', 'ق'].includes(o.c)) bad(`${id} ${path}: درجة الثقة ناقصة`); }
    if ('gen' in o && !(o.gen >= 1 && o.gen <= 5)) bad(`${id} ${path}: الجيل ${o.gen}`);
    if ('n' in o && !(o.n >= 0)) bad(`${id} ${path}: عدد سالب`);
    if ('orig' in o && !KNOWN.has(o.orig)) warn(`${id} ${path}: بلد منشأ «${o.orig}» مو بالقائمة`);
    for (const k in o) if (k !== 'src') walk(o[k], path + '.' + k);
  };
  walk(d, id);
  for (const k in S) if (!S[k].t || !S[k].y) bad(`${id}: المصدر ${k} ناقص عنوان أو سنة`);
  const g = d.eco?.gdpBusd?.v, mb = d.mil?.budgetBusd?.v, act = d.mil?.active?.v, pop = d.pop?.v;
  if (g && mb && mb > g * .4) bad(`${id}: ميزانية الجيش ${mb} أكبر من 40٪ من الناتج ${g}`);
  if (pop && act && act > pop * .06) bad(`${id}: الجيش العامل ${act} أكبر من 6٪ من السكان`);
  for (const [o, v] of Object.entries(d.rel || {})) { if (!ids.has(o)) bad(`${id}: علاقة ويا «${o}» مو بالقائمة`); if (!(v >= -100 && v <= 100)) bad(`${id}: علاقة ${o} = ${v}`); }
  if (tierOf[id] === 'A') for (const k of ['gov', 'pop', 'eco', 'mil', 'ind', 'pol', 'rel']) if (!d[k]) bad(`${id} (درجة أ): القسم «${k}» ناقص`);
}
const have = new Set(files.map(f => f.slice(0, 3)));
const cov = t => `${list.filter(c => c.tier === t && have.has(c.id)).length}/${list.filter(c => c.tier === t).length}`;
console.log(`الدول ${list.length} · ملفات ${files.length} · أرقام ${nums} · التغطية: أ ${cov('A')}، ب ${cov('B')}، ج ${cov('C')}${warns ? ` · تحذيرات ${warns}` : ''}`);
for (const w of ['blocs', 'nuclear', 'sanctions', 'conflicts']) if (!fs.existsSync(new URL(`world/${w}.json`, root))) console.log(`⏳ data/world/${w}.json لسه ما انعمل`);
console.log(fails ? `\n❌ ${fails} مشكلة` : '\n✅ البيانات الموجودة سليمة'); process.exit(fails ? 1 : 0);
