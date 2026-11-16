# بيانات الخريطة المرسومة: Natural Earth 10m (ملكية عامة) مقصوصة على قطاع الجبهة ومحوّلة لمتر (ميركاتور محلي)
# python3 tools/mapdata.py  ← src/mapdata.json
import json, math
from shapely.geometry import shape, box, mapping, LineString, Polygon, MultiPolygon, MultiLineString
LON0, LON1, LAT0, LAT1 = 46.2, 49.7, 29.8, 33.1
REF = (31.45, 47.95)
MPU = 40075016 * math.cos(math.radians(REF[0]))
MX = lambda lo: (lo + 180) / 360
MY = lambda la: (1 - math.log(math.tan(math.pi / 4 + la * math.pi / 360)) / math.pi) / 2
def xy(lo, la): return [round((MX(lo) - MX(REF[1])) * MPU / 10) * 10, round(-(MY(la) - MY(REF[0])) * MPU / 10) * 10]
B = box(LON0, LAT0, LON1, LAT1)
def feats(n): return json.load(open(f'/tmp/ne/{n}.geojson'))['features']
def lines(g, tol):
    g = g.intersection(B)
    if g.is_empty: return []
    gs = list(g.geoms) if hasattr(g, 'geoms') else [g]
    out = []
    for l in gs:
        if isinstance(l, LineString): l = l.simplify(tol); out.append([c for p in l.coords for c in xy(*p)])
    return out
def polys(g, tol):
    g = g.intersection(B)
    if g.is_empty: return []
    gs = list(g.geoms) if hasattr(g, 'geoms') else [g]
    out = []
    for p in gs:
        if isinstance(p, Polygon) and p.area > 1e-5: p = p.simplify(tol); out.append([[c for q in p.exterior.coords for c in xy(*q)]] + [[c for q in r.coords for c in xy(*q)] for r in p.interiors])
    return out
D = {'ref': REF, 'bbox': [xy(LON0, LAT1), xy(LON1, LAT0)], 'land': [], 'lakes': [], 'rivers': [], 'roads': [], 'borders': [], 'places': [], 'airports': []}
for f in feats('ne_10m_land'): D['land'] += polys(shape(f['geometry']), .002)
for f in feats('ne_10m_lakes'): D['lakes'] += polys(shape(f['geometry']), .002)
for f in feats('ne_10m_rivers_lake_centerlines'):
    for l in lines(shape(f['geometry']), .002): D['rivers'].append({'n': f['properties'].get('name') or '', 'r': f['properties'].get('scalerank', 9), 'p': l})
for f in feats('ne_10m_roads'):
    for l in lines(shape(f['geometry']), .002): D['roads'].append({'t': f['properties'].get('type', ''), 'p': l})
for f in feats('ne_10m_admin_0_boundary_lines_land'): D['borders'] += lines(shape(f['geometry']), .002)
for f in feats('ne_10m_populated_places_simple'):
    g = shape(f['geometry'])
    if B.contains(g): D['places'].append({'n': f['properties']['name'], 'pop': f['properties'].get('pop_max', 0), 'p': xy(g.x, g.y)})
for f in feats('ne_10m_airports'):
    g = shape(f['geometry'])
    if B.contains(g): D['airports'].append({'n': f['properties']['name'], 'k': f['properties'].get('type', ''), 'p': xy(g.x, g.y)})
# مدن بأسماء عربية من OSM (إذا موجودة)
import os
if os.path.exists('tools/places_osm.json'):
    D['cities'] = [{'n': e['tags'].get('name:ar') or e['tags'].get('name'), 'pop': int(str(e['tags'].get('population', '50000')).split()[0].replace(',', '') or 50000), 'p': xy(e['lon'], e['lat'])} for e in json.load(open('tools/places_osm.json'))['elements']]
json.dump(D, open('src/mapdata.json', 'w'), separators=(',', ':'))
print({k: len(v) for k, v in D.items() if isinstance(v, list)}, 'places:', [p['n'] for p in D['places']], 'airports:', [(a['n'], a['k']) for a in D['airports']])
print('rivers:', sorted(set(r['n'] for r in D['rivers'])))
