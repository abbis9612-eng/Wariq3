# W2.5: يحزم بيانات العالم لملف واحد تقراه الصفحة: prototypes/world/world-data.js
#   python3 tools/map/bundle.py
# - المناطق: خصائص مختصرة + أشكال (إحداثيات ×100 كأعداد صحيحة، فرق عن النقطة السابقة حتى يصغر الملف)
# - حدود الدول مدموجة ومبسطة (للتكبير البعيد: أسرع رسم)
# - ملخص كل دولة (القائد، الحكم، السكان، الناتج، الجيش، العلاقات) من data/countries
import json, os, glob
from shapely.geometry import Polygon
from shapely.ops import unary_union
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data'); OUT = os.path.join(R, '..', 'prototypes', 'world', 'world-data.js')
RJ = json.load(open(f'{R}/world/regions.json')); RG = json.load(open(f'{R}/world/regions_geo.json'))
SJ = json.load(open(f'{R}/world/seas.json')); SG = json.load(open(f'{R}/world/seas_geo.json'))
CL = json.load(open(f'{R}/world/countries.json')); REL = json.load(open(f'{R}/world/rel.json'))['c']
def delta(rings):
    out = []
    for ring in rings:
        f = []; px = py = 0
        for x, y in ring: f += [x - px, y - py]; px, py = x, y
        out.append(f)
    return out
T = ['plain', 'desert', 'hills', 'mount', 'marsh', 'forest', 'jungle', 'tundra', 'snow', 'city']
regs = []
for r in RJ['r']:
    regs.append([r['id'], r['c'] or '', r['ctl'] or '', r['n'], T.index(r['t']), r['a'], r['ll'], r['nb'], r.get('sea', []), r.get('cities', []), r.get('oil', 0), r.get('gas', 0), r.get('cap', 0), r.get('metro', 0),
      (r.get('why') or {}).get('note', ''), r['el'], r.get('port', 0), r.get('fields', []), r.get('nt') or ''])
# حدود الدول (حسب المسيطر) مبسطة
by = {}
for r in RJ['r']:
    k = r['ctl'] or ('~' + (r.get('nt') or ''))
    by.setdefault(k, []).extend(Polygon([(x / 100, y / 100) for x, y in ring]).buffer(0) for ring in RG[r['id']] if len(ring) > 3)
lod = {}
for k, ps in by.items():
    g = unary_union(ps).buffer(.02).buffer(-.02).simplify(.12, preserve_topology=True); rings = []
    for p in (g.geoms if hasattr(g, 'geoms') else [g]):
        if p.geom_type == 'Polygon' and p.area > .02: rings.append([[int(round(x * 100)), int(round(y * 100))] for x, y in p.exterior.coords])
    if rings: lod[k] = delta(rings)
cs = {}
for f in glob.glob(f'{R}/countries/*.json'):
    d = json.load(open(f)); m = d.get('mil', {}); s = m.get('sum') or {}; v = lambda o: (o or {}).get('v')
    g = d.get('gov') or {}; nm = lambda h: (h or {}).get('name')
    cs[d['id']] = {'ar': d['ar'], 'en': d['en'], 'tier': d['tier'], 'gov': g.get('ar'), 'free': g.get('free'), 'hos': nm(g.get('hos')), 'hosR': (g.get('hos') or {}).get('role'), 'hog': nm(g.get('hog')), 'hogR': (g.get('hog') or {}).get('role'),
      'pop': v(d.get('pop')), 'gdp': v((d.get('eco') or {}).get('gdpBusd')), 'mb': v(m.get('budgetBusd')), 'act': v(s.get('active')), 'tanks': v(s.get('tanksActive')) or v(s.get('tanks')), 'air': v(s.get('combatAir')),
      'nuke': None, 'stab': v((d.get('pol') or {}).get('stab')), 'tr': d.get('treaties', []), 'war': (d.get('pol') or {}).get('warHome', []), 'conf': d.get('conflicts', [])}
NUC = json.load(open(f'{R}/world/nuclear.json'))
for n in NUC['states']:
    if n['id'] in cs: cs[n['id']]['nuke'] = n['stockpile']['v']
BL = json.load(open(f'{R}/world/blocs.json')); CF = json.load(open(f'{R}/world/conflicts.json'))
LAR = json.load(open(f'{R}/world/leaders_ar.json')) if os.path.exists(f'{R}/world/leaders_ar.json') else {}
for c in cs.values():
    for k in ('hos', 'hog'):
        if c.get(k) and LAR.get(c[k]): c[k] = LAR[c[k]]
TRN = {k: b['ar'] for k, b in BL['blocs'].items()}; TRN.update({'OIC': 'منظمة التعاون الإسلامي', 'US_SFA': 'اتفاقية الإطار الاستراتيجي ويا أمريكا', 'ARABLEAGUE': 'الجامعة العربية'})
CFN = {c['id']: c['ar'] for c in CF['conflicts']}
W = {'asOf': '2026-11', 'T': T, 'r': regs, 'g': {r['id']: delta(RG[r['id']]) for r in RJ['r']}, 's': [[z['id'], z['n'], z['ll'], z['nb'], z['k']] for z in SJ['s']], 'sg': {k: delta(v) for k, v in SG.items()},
  'st': SJ['straits'], 'lod': lod, 'cs': cs, 'ent': RJ['entities'], 'trn': TRN, 'cfn': CFN, 'rel': {a: {b: v[0] for b, v in m.items()} for a, m in REL.items()}}
s = json.dumps(W, ensure_ascii=False, separators=(',', ':'))
open(OUT, 'w').write('// مولّد بـ tools/map/bundle.py من data/world — لا تعدّله باليد\nwindow.WD=' + s + ';\n')
print('حجم', round(len(s.encode()) / 1e6, 2), 'ميغا · مناطق', len(regs), '· دول بالحدود المبسطة', len(lod), '· نقاط المبسطة', sum(len(f) // 2 for v in lod.values() for f in v))
