# W2.3: نوع الأرض والمدن والموانئ والمطارات لكل منطقة بالعالم.
#   python3 tools/map/terrain.py <مجلد Natural Earth> <مجلد بلاطات الارتفاع terrarium z5 (t_x_y.png)>  ← يضيف لـ data/world/regions.json
# الأرض: الارتفاع ووعورته من AWS Terrain Tiles (z5 ≈ 5 كم)، الصحاري والأراضي الرطبة من NE geography regions، الجليد من NE glaciated، المدن من NE urban areas،
# والغابات/الأدغال تقدير بخط العرض والارتفاع (ما عدنا صور أقمار هنا) → كلها درجة ثقة ت.
import json, math, sys, os, random
import numpy as np
from PIL import Image
from shapely.geometry import shape, Point, Polygon, MultiPolygon
from shapely.strtree import STRtree
random.seed(5)
NE, DEM = sys.argv[1], sys.argv[2]; R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')
RJ = json.load(open(f'{R}/world/regions.json')); G = json.load(open(f'{R}/world/regions_geo.json'))
Z = 5; N = 2 ** Z; M = np.zeros((N * 256, N * 256), dtype=np.float32)
for x in range(N):
    for y in range(N):
        a = np.asarray(Image.open(f'{DEM}/t_{x}_{y}.png').convert('RGB')).astype(np.float32)
        M[y * 256:(y + 1) * 256, x * 256:(x + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
S = M.shape[0]
def elev(lon, lat):
    lat = max(-85, min(85, lat)); u = (lon + 180) / 360; v = (1 - math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) / math.pi) / 2
    return float(M[min(S - 1, int(v * S)), min(S - 1, int(u * S))])
def poly(rid):
    ps = [Polygon([(x / 100, y / 100) for x, y in ring]) for ring in G[rid] if len(ring) > 3]
    ps = [p.buffer(0) for p in ps]; return MultiPolygon([q for p in ps for q in (p.geoms if hasattr(p, 'geoms') else [p]) if q.geom_type == 'Polygon']) if len(ps) != 1 else ps[0]
gj = lambda n: json.load(open(f'{NE}/{n}.geojson'))['features']
GEO = [(shape(f['geometry']).buffer(0), f['properties']['FEATURECLA'], f['properties'].get('NAME_AR') or f['properties']['NAME']) for f in gj('ne_10m_geography_regions_polys') if f['properties']['FEATURECLA'] in ('Desert', 'Wetlands', 'Tundra', 'Delta')]
# أراضي رطبة كبيرة مو موجودة أو صغيرة بـ NE (مستطيلات تقريبية، ت)
WET = {'أهوار العراق': (46.2, 30.6, 47.8, 32.2), 'السد (جنوب السودان)': (29.5, 6.5, 32.0, 9.8), 'بانتانال': (-58.5, -20.5, -55.5, -16.0), 'أوكافانغو': (22.0, -20.0, 24.0, -18.5),
  'مستنقعات بريبيات': (25.0, 51.5, 30.5, 52.6), 'إيفرغليدز': (-81.5, 25.2, -80.4, 26.6), 'سونداربانس': (88.5, 21.5, 90.0, 22.5), 'دلتا النيجر الداخلية': (-5.5, 14.0, -3.5, 16.0), 'دلتا ميكونغ': (104.8, 9.0, 106.8, 10.8)}
from shapely.geometry import box
for k, b in WET.items(): GEO.append((box(*b), 'Wetlands', k))
# مناطق جافة كبيرة ناقصة من NE (مستطيلات تقريبية، ت): تصير صحرا إذا مو وعرة، إلا الوديان على نهر كبير (زراعة مروية)
ARID = {'نجد والربع الخالي': (36, 16.5, 56, 32), 'هضبة إيران (كوير ولوط)': (52, 27, 62, 35.5), 'داخل أستراليا': (114, -32, 146, -19.5),
  'ثار': (69, 24, 74, 29.5), 'أتاكاما': (-71.5, -27, -68.5, -18), 'الحوض العظيم وموهافي': (-120, 33, -109, 42), 'القرن الأفريقي': (40, 2, 51.5, 11), 'قره قوم وقزل قوم': (53, 37, 66, 45.5), 'سيناء والنقب': (32.5, 29.5, 35.3, 31.3)}
for k, b in ARID.items(): GEO.append((box(*b), 'Desert', k))
GEO.append((Polygon([(37.5, 35.0), (40.5, 35.2), (42.5, 34.2), (43.5, 32.6), (44.6, 31.4), (46.6, 30.0), (46.6, 29.0), (37.5, 29.0)]), 'Desert', 'بادية العراق والشام'))
RIV = [shape(f['geometry']) for f in gj('ne_10m_rivers_lake_centerlines') if (f['properties'].get('scalerank') or 9) <= 4 and f['geometry']]
RT = STRtree(RIV)
GT = STRtree([g for g, _, _ in GEO])
ICE = [shape(f['geometry']).buffer(0) for f in gj('ne_10m_glaciated_areas')]; IT = STRtree(ICE)
URB = [shape(f['geometry']).buffer(0).simplify(.002) for f in gj('ne_10m_urban_areas')]; UT = STRtree(URB)
PP = [(Point(f['geometry']['coordinates']), f['properties']) for f in gj('ne_10m_populated_places_simple')]; PT = STRtree([p for p, _ in PP])
PO = [(Point(f['geometry']['coordinates']), f['properties']) for f in gj('ne_10m_ports')]; POT = STRtree([p for p, _ in PO])
AP = [(Point(f['geometry']['coordinates']), f['properties']) for f in gj('ne_10m_airports')]; APT = STRtree([p for p, _ in AP])
def sx(a, b):
    try: return a.intersection(b).area
    except Exception: return a.buffer(0).intersection(b.buffer(0)).area if a.is_valid or True else 0
KM = lambda lat: 111.32 ** 2 * math.cos(math.radians(lat))
cnt = {}
for r in RJ['r']:
    g = poly(r['id']).buffer(0); mnx, mny, mxx, mxy = g.bounds; pts = []; tries = 0
    while len(pts) < 50 and tries < 4000:
        tries += 1; p = Point(random.uniform(mnx, mxx), random.uniform(mny, mxy))
        if g.contains(p): pts.append(p)
    if not pts: pts = [g.representative_point()]
    el = np.array([max(0, elev(p.x, p.y)) for p in pts]); lat = abs(r['ll'][1])
    r['el'] = int(el.mean()); r['rug'] = int(el.std())
    area = g.area; frac = lambda T, L: sum(sx(L[int(i)], g) for i in T.query(g)) / max(area, 1e-9)
    ice = frac(IT, ICE); urb = frac(UT, URB)
    geo = [GEO[int(i)] for i in GT.query(g) if sx(GEO[int(i)][0], g) > (.25 if GEO[int(i)][1] != 'Wetlands' else .3) * area]
    kinds = {k for _, k, _ in geo}
    if ice > .5 or lat > 72: t = 'snow'
    elif urb > .12 or (urb > .05 and r['a'] < 3000): t = 'city'
    elif r['el'] > 2200 or r['rug'] > 550: t = 'mount'
    elif ('Wetlands' in kinds or 'Delta' in kinds) and r['el'] < 200: t = 'marsh'
    elif 'Desert' in kinds and r['rug'] < 250 and not (r['el'] < 250 and any(RIV[int(i)].intersects(g) for i in RT.query(g))): t = 'desert'
    elif 'Tundra' in kinds or lat > 64: t = 'tundra'
    elif r['rug'] > 200 or r['el'] > 1200: t = 'hills'
    elif lat < 12 and r['el'] < 1000: t = 'jungle'
    elif 50 <= lat <= 64: t = 'forest'
    else: t = 'plain'
    r['t'] = t; cnt[t] = cnt.get(t, 0) + 1
    r['urb'] = round(urb, 3)
    # المدن (أكبر 3) والعاصمة
    cs = sorted([PP[int(i)][1] for i in PT.query(g, predicate='contains')], key=lambda p: -(p.get('pop_max') or 0))
    if cs:
        r['cities'] = [[c.get('name_ar') or c['name'], c.get('pop_max') or 0] for c in cs[:3]]
        if any(c.get('adm0cap') for c in cs): r['cap'] = 1
    if cs and (cs[0].get('pop_max') or 0) >= 1e6: r['metro'] = 1   # مدينة كبيرة داخل المنطقة: قتال شوارع
    r['pop'] = int(sum(c.get('pop_max') or 0 for c in cs))   # سكان المدن بس (للوزن)
    ports = [PO[int(i)][1] for i in POT.query(g.buffer(.15))]
    if ports: r['port'] = len(ports)
    aps = [AP[int(i)][1] for i in APT.query(g, predicate='contains')]
    if aps:
        r['air'] = len(aps)
        mil = [a for a in aps if 'military' in (a.get('type') or '')]
        if mil: r['airMil'] = len(mil)
RJ['src']['dem'] = {'t': 'AWS Terrain Tiles (Mapzen terrarium, SRTM/GMTED/ETOPO) z5', 'u': 'https://registry.opendata.aws/terrain-tiles/', 'y': 2024}
RJ['src']['negeo'] = {'t': 'Natural Earth 1:10m: geography regions (صحاري، أراضي رطبة)، glaciated areas، urban areas، populated places، ports، airports', 'u': 'https://www.naturalearthdata.com/', 'y': 2024}
RJ['terrainNote'] = 't: plain سهل، desert صحرا، hills تلال، mount جبال، marsh أهوار، forest غابة، jungle أدغال، tundra تندرا، snow ثلج، city مدينة. el متوسط الارتفاع (م)، rug الوعورة (انحراف الارتفاع). الغابات والأدغال تقدير بخط العرض (ت)'
json.dump(RJ, open(f'{R}/world/regions.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('أنواع الأرض', dict(sorted(cnt.items(), key=lambda x: -x[1])))
print('بيها مدن', sum(1 for r in RJ['r'] if r.get('cities')), '· عواصم', sum(1 for r in RJ['r'] if r.get('cap')), '· موانئ', sum(1 for r in RJ['r'] if r.get('port')), '· مطارات عسكرية', sum(1 for r in RJ['r'] if r.get('airMil')))
for r in RJ['r']:
    if r['c'] == 'IRQ': print(r['id'], r['n'], r['t'], r['el'], r['rug'], (r.get('cities') or [['-']])[0][0])
