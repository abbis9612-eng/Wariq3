# W2.3ب: النفط والغاز لكل منطقة: كل حقل ينحط بأقرب منطقة برية من نفس الدولة (الحقول البحرية على الساحل).
#   python3 tools/map/energy.py   ← يضيف oil (ألف برميل/يوم) و gas (مليار م³/سنة) و fields لـ data/world/regions.json
import json, os
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')
RJ = json.load(open(f'{R}/world/regions.json')); E = json.load(open(f'{R}/curation/energy.json'))
for r in RJ['r']:
    for k in ('oil', 'gas', 'fields'): r.pop(k, None)
GG = json.load(open(f'{R}/world/regions_geo.json'))
GP = {k: unary_union([Polygon([(x / 100, y / 100) for x, y in r]).buffer(0) for r in v if len(r) > 3]) for k, v in GG.items()}
tot = {'oil': 0, 'gas': 0}
for c, d in E['c'].items():
    L = [r for r in RJ['r'] if r['c'] == c]
    so = sum(f[2] for f in d['f']) or 1; sg = sum(f[3] for f in d['f']) or 1
    for lon, lat, po, pg, n in d['f']:
        pt = Point(lon, lat); r = min(L, key=lambda r: GP[r['id']].distance(pt))   # داخلها = 0، وإلا أقرب ساحل
        o = round(d['oil'] * po / so); g = round(d['gas'] * pg / sg, 1)
        r['oil'] = r.get('oil', 0) + o; r['gas'] = round(r.get('gas', 0) + g, 1); r.setdefault('fields', []).append(n)
        tot['oil'] += o; tot['gas'] += g
RJ['src'].update(E['src'])
json.dump(RJ, open(f'{R}/world/regions.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('مناطق بيها نفط/غاز', sum(1 for r in RJ['r'] if r.get('oil') or r.get('gas')), '· نفط', tot['oil'], 'ألف ب/ي · غاز', round(tot['gas']), 'مليار م³')
for r in RJ['r']:
    if r['c'] in ('IRQ', 'IRN') and (r.get('oil') or r.get('gas')): print(r['id'], r['n'], r['ctl'], r.get('oil'), r.get('gas'), r['fields'])
