# W2.4: المناطق البحرية والمضائق.
#   python3 tools/map/seas.py <مجلد Natural Earth>  ← data/world/seas.json + data/world/seas_geo.json
# البحار والخلجان من NE marine polys (1:50m)، والمحيطات والبحار الكبيرة تنقسم (k-means + فورونوي) لقطع ~1.5 مليون كم².
# كل منطقة بحرية: جيرانها البحرية، والمناطق البرية اللي على ساحلها. المضائق: نقاط حقيقية + المناطق البحرية اللي تربطها + البر اللي يطل عليها.
import json, math, sys, os, random
import numpy as np
from shapely.geometry import shape, Point, Polygon, MultiPolygon, box
from shapely.ops import unary_union, voronoi_diagram
from shapely.strtree import STRtree
random.seed(3); np.random.seed(3)
NE = sys.argv[1]; R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')
KM = lambda lat: 111.32 ** 2 * math.cos(math.radians(lat))
km2 = lambda g: sum(p.area * KM(p.centroid.y) for p in (g.geoms if hasattr(g, 'geoms') else [g])) if not g.is_empty else 0
F = [f for f in json.load(open(f'{NE}/ne_50m_geography_marine_polys.geojson'))['features'] if f['properties']['featurecla'] not in ('river', 'reef')]
AR = {'Arctic Ocean': 'المحيط المتجمد الشمالي', 'SOUTHERN OCEAN': 'المحيط الجنوبي', 'North Atlantic Ocean': 'شمال الأطلسي', 'North Pacific Ocean': 'شمال الهادئ', 'South Pacific Ocean': 'جنوب الهادئ', 'INDIAN OCEAN': 'المحيط الهندي', 'Korea Strait': 'مضيق كوريا', 'South Atlantic Ocean': 'جنوب الأطلسي'}
Z = []
for f in F:
    p = f['properties']; g = shape(f['geometry']).buffer(0)
    if g.is_empty or g.bounds[1] < -62: g = g.intersection(box(-180, -62, 180, 85))
    if g.is_empty: continue
    if km2(g) < 5000: continue   # مضائق وخلجان صغيرة كلش: يمثلها «المضيق» بدلها
    Z.append({'n': AR.get(p['name']) or p.get('name_ar') or p['name'], 'en': p['name'], 'k': p['featurecla'], 'g': g, 'a': km2(g)})
def split(z, T=1.5e6):
    k = max(1, round(z['a'] / T))
    if k == 1: return [z]
    g = z['g']; mnx, mny, mxx, mxy = g.bounds; pts = []
    while len(pts) < k * 50:
        q = np.random.uniform([mnx, mny], [mxx, mxy], (k * 300, 2)); pts += [x for x in q if g.contains(Point(x))]
    P = np.array(pts[:k * 50]); C = P[np.random.choice(len(P), k, replace=False)]
    for _ in range(25):
        lab = ((P[:, None] - C[None]) ** 2 * np.array([np.cos(np.radians(P[:, 1:2].mean())), 1])).sum(-1).argmin(1)
        C = np.array([P[lab == i].mean(0) if (lab == i).any() else C[i] for i in range(k)])
    vor = voronoi_diagram(MultiPolygon([Point(*c).buffer(.01) for c in C]).centroid if False else unary_union([Point(*c) for c in C]), envelope=g.envelope.buffer(1))
    out = []
    for cell in vor.geoms:
        pg = cell.intersection(g)
        if not pg.is_empty and km2(pg) > 2e4: out.append(dict(z, g=pg, a=km2(pg)))
    for i, o in enumerate(sorted(out, key=lambda o: (-o['g'].representative_point().y, o['g'].representative_point().x))): o['n'] = f"{z['n']} {i + 1}"
    return out
S = []
for z in Z: S += split(z, 1.5e6 if z['k'] == 'ocean' else 6e5)
S.sort(key=lambda z: (-z['g'].representative_point().y, z['g'].representative_point().x))
for i, z in enumerate(S): z['id'] = f'S{i + 1:03d}'
# الجيران البحرية والسواحل
G = [z['g'] for z in S]; T = STRtree(G)
for i, z in enumerate(S):
    z['nb'] = sorted({S[int(j)]['id'] for j in T.query(z['g'].buffer(.3)) if int(j) != i and G[int(j)].distance(z['g']) < .3})
RJ = json.load(open(f'{R}/world/regions.json')); RG = json.load(open(f'{R}/world/regions_geo.json'))
def rpoly(rid):
    ps = [Polygon([(x / 100, y / 100) for x, y in r]).buffer(0) for r in RG[rid] if len(r) > 3]
    return unary_union(ps)
RP = [rpoly(r['id']) for r in RJ['r']]; RT = STRtree(RP)
coast = {}
for z in S:
    z['coast'] = sorted({RJ['r'][int(j)]['id'] for j in RT.query(z['g'].buffer(.25)) if RP[int(j)].distance(z['g']) < .25})
    for rid in z['coast']: coast.setdefault(rid, []).append(z['id'])
for i, r in enumerate(RJ['r']):   # جزر ببحار داخلية صغيرة (مثل الفلبين): أقرب منطقة بحرية
    if not r['nb'] and r['id'] not in coast:
        z = min(S, key=lambda z: z['g'].distance(RP[i])); z['coast'] = sorted(z['coast'] + [r['id']]); coast[r['id']] = [z['id']]
for r in RJ['r']:
    if r['id'] in coast: r['sea'] = coast[r['id']]
    else: r.pop('sea', None)
# المضائق (إحداثيات حقيقية تقريبية). w = العرض كم، trade = نسبة تقريبية من تجارة النفط البحرية العالمية تمر بيه
ST = [('hormuz', 'مضيق هرمز', 56.4, 26.55, 39, 20), ('bab', 'باب المندب', 43.4, 12.6, 26, 9), ('suez', 'قناة السويس', 32.35, 30.5, .3, 9), ('bosporus', 'البوسفور والدردنيل', 29.05, 41.1, .7, 3),
  ('gibraltar', 'جبل طارق', -5.6, 35.95, 14, 3), ('malacca', 'مضيق ملقا', 100.5, 3.0, 65, 23), ('panama', 'قناة بنما', -79.7, 9.1, .3, 1), ('taiwan', 'مضيق تايوان', 119.5, 24.2, 130, 5),
  ('danish', 'المضائق الدنماركية', 11.0, 55.8, 4, 2), ('korea', 'مضيق كوريا (تسوشيما)', 129.3, 34.4, 200, 3), ('lombok', 'لومبوك وسوندا', 115.7, -8.7, 20, 2), ('kerch', 'مضيق كيرتش', 36.55, 45.3, 4, 0), ('good_hope', 'رأس الرجاء الصالح', 18.5, -34.5, 0, 6)]
straits = []
for k, n, lon, lat, w, tr in ST:
    pt = Point(lon, lat); srt = sorted(S, key=lambda z: z['g'].distance(pt)); near = [srt[0]] + [next(z for z in srt[1:] if z['en'] != srt[0]['en'])]
    if k not in ('good_hope', 'kerch'):   # المضيق يربط البحرين (كيرتش: بحر آزوف مو منطقة منفصلة)
        a, b = near
        if b['id'] not in a['nb']: a['nb'] = sorted(a['nb'] + [b['id']]); b['nb'] = sorted(b['nb'] + [a['id']])
    land = [RJ['r'][int(j)] for j in RT.query(pt.buffer(1.2)) if RP[int(j)].distance(pt) < 1.0]
    straits.append({'id': k, 'n': n, 'll': [lon, lat], 'wKm': w, 'oilPct': tr, 'seas': [z['id'] for z in near], 'shore': sorted({x['id'] for x in land}), 'shoreCtl': sorted({x['ctl'] for x in land if x['ctl']})})
Q = lambda v: int(round(v * 100))
def rings(g):
    g = g.simplify(.05, preserve_topology=True); out = []
    for p in (g.geoms if hasattr(g, 'geoms') else [g]):
        if p.geom_type == 'Polygon' and (p.area > .05 or not out): out.append([[Q(x), Q(y)] for x, y in p.exterior.coords])
    return out
json.dump({'src': {'nemar': {'t': 'Natural Earth 1:50m geography marine polys', 'u': 'https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-geography-regions/', 'y': 2024},
  'straits': {'t': 'EIA: World Oil Transit Chokepoints (نسب تقريبية من تجارة النفط البحرية) + إحداثيات المضائق', 'u': 'https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints', 'y': 2024}},
  'note': 'مناطق بحرية: nb جيران بحرية، coast مناطق برية على الساحل. straits: المضائق والبر المطل عليها (shoreCtl = منو يسيطر على الساحل هسه)',
  's': [{'id': z['id'], 'n': z['n'], 'en': z['en'], 'k': z['k'], 'a': round(z['a']), 'll': [round(c, 2) for c in z['g'].representative_point().coords[0]], 'nb': z['nb'], 'coast': z['coast']} for z in S], 'straits': straits},
  open(f'{R}/world/seas.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump({z['id']: rings(z['g']) for z in S}, open(f'{R}/world/seas_geo.json', 'w'), separators=(',', ':'))
json.dump(RJ, open(f'{R}/world/regions.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('مناطق بحرية', len(S), '· بر ساحلي', len(coast), '· بحر بلا جيران', sum(1 for z in S if not z['nb']))
for s in straits: print(s['n'], s['seas'], s['shoreCtl'])
