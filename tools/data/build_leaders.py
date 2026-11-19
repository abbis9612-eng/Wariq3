# يبني data/world/leaders.json: رئيس الدولة ورئيس الحكومة لكل دولة من «List of current heads of state and government» بويكيبيديا
# python3 tools/data/build_leaders.py
import json, re, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from names import R, CL, cid
D = json.load(open(f'{R}/raw/lists/leaders.json'))
def split(x):
    x = re.sub(r'\[.*?\]', '', x).strip(); p = re.split(r'\s+[–-]\s+', x, maxsplit=1)
    return {'role': p[0], 'name': p[1]} if len(p) == 2 else {'role': '', 'name': x}
out = {}
for t in D['tables']:
    for r in t['rows']:
        if len(r) < 3: continue
        i = cid(r[0])
        if not i: continue
        hs, hg = split(r[-2]), split(r[-1])
        if i in out:   # صف ثاني: إيران (المرشد + الرئيس)؛ فنزويلا (القائمة بالأعمال أولاً ونخليها)
            if out[i]['hog'] is None and hs['name'] != out[i]['hos']['name'] and i != 'VEN': out[i]['hog'] = hs
            continue
        out[i] = {'hos': hs, 'hog': hg if hg != hs else None}
ids = {c['id'] for c in CL}
res = {'src': {'leaders': {'t': 'Wikipedia: ' + D['title'], 'u': f"https://en.wikipedia.org/wiki/{D['title'].replace(' ', '_')}?oldid={D['revid']}", 'y': 2026, 'note': 'سحب نوفمبر 2026'}}, 'c': {k: out[k] for k in sorted(out) if k in ids}}
json.dump(res, open(f'{R}/world/leaders.json', 'w'), ensure_ascii=False, indent=0)
print('قادة:', len(res['c']), '/ 157 · ناقصة:', sorted(ids - set(res['c'])))
