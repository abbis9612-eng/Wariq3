# يبني data/world/milsum.json: أرقام عسكرية موحّدة لكل الدول (157) من قائمتين بويكيبيديا مجمّعة من IISS Military Balance:
#  - List of countries by level of military equipment (دبابات، سفن حسب النوع، طائرات قتالية، مروحيات هجوم، نووي، أقمار)
#  - List of countries by number of military and paramilitary personnel (عامل، احتياط، شبه عسكري)
# python3 -I tools/data/build_lists.py
import json, re, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from names import R, CL, cid
def num(s):
    s = re.sub(r'\[.*?\]', '', s or '').replace(',', '')
    m = re.search(r'\d+(?:\.\d+)?', s); return float(m.group(0)) if m else None

out = {}; miss = []
E1 = json.load(open(f'{R}/raw/lists/List_of_countries_by_level_of_military_equipment.json'))
src_e = {'t': 'Wikipedia: ' + E1['title'] + ' (من IISS Military Balance ومصادر ثانية)', 'u': f"https://en.wikipedia.org/wiki/{E1['title'].replace(' ', '_')}?oldid={E1['revid']}", 'y': 2025}
for r in [r for r in E1["tables"][0]["rows"] if len(r) >= 16]:
    i = cid(r[0])
    if not i: miss.append(r[0]); continue
    # الميزانية منقسمة لخليتين (الصحيح + الكسر)
    b = num(r[1]); dec = re.match(r'\.(\d+)', r[2] or '')
    if b is not None and dec: b = float(f"{int(b)}.{dec.group(1)}")
    f = [num(x) for x in r[3:16]]
    nm = ['tanks', 'carriers', 'amphib', 'cruisers', 'destroyers', 'frigates', 'corvettes', 'subNuc', 'subs', 'combatAir', 'attackHeli', 'nukes', 'sats']
    o = out.setdefault(i, {}); o['budgetBusd'] = b; o['ppp'] = 'PPP' in (r[1] + r[2])
    for k, v in zip(nm, f): o[k] = int(v) if v is not None else None
E2 = json.load(open(f'{R}/raw/lists/List_of_countries_by_number_of_military_and_paramilitary_personnel.json'))
src_p = {'t': 'Wikipedia: ' + E2['title'] + ' (جدول IISS Military Balance)', 'u': f"https://en.wikipedia.org/wiki/{E2['title'].replace(' ', '_')}?oldid={E2['revid']}", 'y': 2025}
for r in [r for r in E2["tables"][0]["rows"] if len(r) >= 4]:
    i = cid(r[0])
    if not i: miss.append(r[0]); continue
    o = out.setdefault(i, {})
    for k, j in (('active', 1), ('reserve', 2), ('para', 3)): v = num(r[j]); o[k] = int(v) if v is not None else None
ids = {c['id'] for c in CL}
res = {'src': {'iiss_eq': src_e, 'iiss_pers': src_p}, 'note': 'أرقام موحّدة لكل الدول (ت): أساس اللعبة للإجمالي. ملفات الدول (data/countries) تصححها بمصادر أحدث وتضيف الموديلات.',
  'c': {k: v for k, v in sorted(out.items()) if k in ids}}
json.dump(res, open(f'{R}/world/milsum.json', 'w'), ensure_ascii=False, indent=0)
print('دول:', len(res['c']), '/ 157 · ناقصة:', sorted(ids - set(res['c']))); print('ما انربطت:', [m for m in miss if m][:40])
