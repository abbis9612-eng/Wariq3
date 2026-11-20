# W5 (D-050): الطرق والأنهار للعالم كله (حتى مسرح الحرب يحسب الطرق والجسور مثل «الحرب الكبرى» tools/roads.py).
#   python3 tools/map/roads.py <مجلد Natural Earth>   ← prototypes/world/world-roads.js
# نفس الأصناف: سريع (2) = Major Highway، طريق (1) = Road/Secondary/Unknown. الأنهار: scalerank ≤ 7 بأسمائها. مبسّطة 0.025° (~2.5 كم)، إحداثيات ×100 فروق.
import json, sys, os
from shapely.geometry import shape
NE = sys.argv[1]; OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'prototypes', 'world', 'world-roads.js')
CLS = {'Major Highway': 2, 'Road': 1, 'Secondary Highway': 1, 'Unknown': 1, 'Beltway': 2, 'Bypass': 1}
def lines(g):
    return [g] if g.geom_type == 'LineString' else list(g.geoms) if g.geom_type == 'MultiLineString' else []
def enc(l):
    f, px, py = [], 0, 0
    for x, y in l.coords:
        X, Y = int(round(x * 100)), int(round(y * 100))
        if f and X == px and Y == py: continue
        f += [X - px, Y - py]; px, py = X, Y
    return f
R, n = [], 0
for ft in json.load(open(f'{NE}/ne_10m_roads.geojson'))['features']:
    c = CLS.get(ft['properties'].get('type'))
    if not c or not ft['geometry']: continue
    for l in lines(shape(ft['geometry'])):
        l = l.simplify(.025)
        if l.length < .03: continue
        e = enc(l)
        if len(e) >= 4: R.append([c] + e); n += len(e) // 2
V = []
for ft in json.load(open(f'{NE}/ne_10m_rivers_lake_centerlines.geojson'))['features']:
    p = ft['properties']
    if (p.get('scalerank') or 99) > 7 or not ft['geometry']: continue
    nm = p.get('name_ar') or p.get('name') or 'نهر'
    for l in lines(shape(ft['geometry'])):
        l = l.simplify(.02)
        e = enc(l)
        if len(e) >= 4: V.append([nm] + e)
s = json.dumps({'r': R, 'v': V}, ensure_ascii=False, separators=(',', ':'))
open(OUT, 'w').write('// مولّد بـ tools/map/roads.py من Natural Earth (ne_10m_roads، ne_10m_rivers_lake_centerlines، ملكية عامة) — لا تعدّله باليد\nwindow.WR=' + s + ';\n')
print('طرق', len(R), 'خط', n, 'نقطة · أنهار', len(V), '· حجم', round(len(s.encode()) / 1e6, 2), 'ميغا')
