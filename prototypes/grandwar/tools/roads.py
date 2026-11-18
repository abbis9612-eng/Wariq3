# «الحرب الكبرى» R5b (I-088): الطرق والجسور على المناطق.
#   python3 tools/roads.py <مجلد Natural Earth>   ← roads.js
# المصدر: Natural Earth ne_10m_roads (ملكية عامة) وne_10m_rivers_lake_centerlines.
# لكل حد بين منطقتين جارتين: هل يعبره طريق (وصنفه)؛ وإذا الحد نهر والطريق يعبره = جسر (بمكانه واسم النهر).
# وخطوط الطرق نفسها مبسّطة للرسم.
import json, math, sys
from shapely.geometry import shape, LineString, MultiLineString, box, Point
from shapely.strtree import STRtree
NE = sys.argv[1]
LON0, LAT1 = 38.5, 40.2
KX = 111.32 * math.cos(math.radians(33)); KY = 110.57
P = lambda lon, lat: ((lon - LON0) * KX, (LAT1 - lat) * KY)
src = open('cells.js').read(); C = json.loads(src[src.index('=') + 1:].strip().rstrip(';'))
cells, edges = C['cells'], C['edges']
xs = [p[0] for c in cells for p in c['ring']]; ys = [p[1] for c in cells for p in c['ring']]
BB = box(min(xs) - 20, min(ys) - 20, max(xs) + 20, max(ys) + 20)
def lines(g):
    if g.geom_type == 'LineString': return [g]
    if g.geom_type == 'MultiLineString': return list(g.geoms)
    return []
CLS = {'Major Highway': 2, 'Road': 1, 'Secondary Highway': 1, 'Unknown': 1}
roads = []
for f in json.load(open(f'{NE}/ne_10m_roads.geojson'))['features']:
    t = f['properties'].get('type');
    if t not in CLS: continue
    for l in lines(shape(f['geometry'])):
        pl = LineString([P(*c[:2]) for c in l.coords]).intersection(BB)
        for q in lines(pl):
            if q.length > 2: roads.append((CLS[t], q))
rtree = STRtree([q for _, q in roads])
AR = {'Tigris': 'دجلة', 'Dicle': 'دجلة', 'Euphrates': 'الفرات', 'Firat': 'الفرات', 'Al Furat': 'الفرات', 'Shatt al Arab': 'شط العرب', 'Karun': 'كارون', 'Diyala': 'ديالى', 'Sirvan': 'ديالى', 'Karkheh': 'الكرخة', 'Zab': 'الزاب', 'Great Zab': 'الزاب الكبير', 'Little Zab': 'الزاب الصغير', 'Dez': 'دز', 'Gharraf Canal': 'الغراف', 'Shatt al Hillah': 'شط الحلة', 'Hindiyah Channel': 'الهندية', 'Atshan': 'العطشان'}
rivers = []
for f in json.load(open(f'{NE}/ne_10m_rivers_lake_centerlines.geojson'))['features']:
    n = f['properties'].get('name') or ''
    for l in lines(shape(f['geometry'])):
        q = LineString([P(*c[:2]) for c in l.coords])
        if q.intersects(BB): rivers.append((n, q))
def river_name(pt):
    best = min(rivers, key=lambda r: r[1].distance(pt)) if rivers else ('', None)
    n = best[0]; return AR.get(n) or next((v for k, v in AR.items() if k in n), 'النهر')
E, BR = [], []
for i, j, r, seg in edges:
    b = MultiLineString([s for s in seg if len(s) > 1])
    if b.is_empty: continue
    best = 0; hit = None
    for k in rtree.query(b):
        c, q = roads[int(k)]
        if q.intersects(b):
            if c > best: best = c
            x = q.intersection(b); hit = x.representative_point() if not x.is_empty else hit
    if best:
        E.append([i, j, best])
        if r and hit is not None: BR.append([i, j, round(hit.x, 1), round(hit.y, 1), river_name(hit)])
L = [{'t': c, 'p': [[round(x, 1), round(y, 1)] for x, y in q.simplify(1.2).coords]} for c, q in roads]
open('roads.js', 'w').write('// مولّد بـ tools/roads.py من Natural Earth (ملكية عامة) — لا تعدّله باليد\nwindow.ROADS=' + json.dumps({'e': E, 'br': BR, 'lines': L}, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('edges with road', len(E), 'bridges', len(BR), 'lines', len(L), 'points', sum(len(l['p']) for l in L))
