# «الحرب الكبرى» GW1.1 (I-080، D-039): يقسم العراق وإيران لمناطق صغيرة (مثل مقاطعات Hearts of Iron).
#   python3 tools/cells.py <مجلد Natural Earth> ../world3d/terrain ../wardesigns/data.js   ← cells.js
# المناطق أصغر قرب الحدود (~32 كم) وأكبر بعيد (~75 كم). كل منطقة داخل محافظة وحدة، بأرضها (من الارتفاعات)،
# مدينتها إذا بيها، وجيرانها مع الحد المشترك (حتى نرسم خط الجبهة) وهل بينهم نهر.
import json, math, sys, random
import numpy as np
from PIL import Image
from shapely.geometry import shape, Point, Polygon, MultiPolygon, LineString, MultiPoint, box
from shapely.ops import unary_union, voronoi_diagram, linemerge
from shapely.strtree import STRtree
from shapely.prepared import prep
NE, TER, WD = sys.argv[1:4]
random.seed(7); np.random.seed(7)
LON0, LAT1 = 38.5, 40.2
KX = 111.32 * math.cos(math.radians(33)); KY = 110.57
P = lambda lon, lat: ((lon - LON0) * KX, (LAT1 - lat) * KY)
def proj(g):
    if g.geom_type == 'Polygon': return Polygon([P(*c[:2]) for c in g.exterior.coords], [[P(*c[:2]) for c in r.coords] for r in g.interiors])
    if g.geom_type == 'MultiPolygon': return MultiPolygon([proj(p) for p in g.geoms])
    if g.geom_type == 'LineString': return LineString([P(*c[:2]) for c in g.coords])
    if g.geom_type == 'MultiLineString': return [proj(l) for l in g.geoms]
gj = lambda n: json.load(open(f'{NE}/{n}.geojson'))
# ارتفاعات (مستوى me)
lv = json.load(open(f'{TER}/levels.json'))['levels']['me']; m = lv['m']
H = np.asarray(Image.open(f'{TER}/me_h.png').convert('RGB')).astype(float); H = H[..., 0] * 256 + H[..., 1] + H[..., 2] / 256 - 32768
def elev_km(x, y):
    lon, lat = x / KX + LON0, LAT1 - y / KY
    u = (lon + 180) / 360; v = (1 - math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) / math.pi) / 2
    i = (u - m[0]) / (m[2] - m[0]) * (H.shape[1] - 1); j = (v - m[1]) / (m[3] - m[1]) * (H.shape[0] - 1)
    return max(0.0, H[int(np.clip(round(j), 0, H.shape[0] - 1)), int(np.clip(round(i), 0, H.shape[1] - 1))])
# المحافظات والحدود
provs = []
for f in gj('ne_10m_admin_1_states_provinces')['features']:
    p = f['properties']
    if p['adm0_a3'] not in ('IRQ', 'IRN'): continue
    pid = p['iso_3166_2'] if p['name'] != 'Alborz' else 'IR-AL'
    g = proj(shape(f['geometry'])).buffer(0)
    provs.append(dict(id=pid, side=0 if p['adm0_a3'] == 'IRQ' else 1, g=g, n=(p.get('name_ar') or p['name']).replace('محافظة ', '')))
IQ = unary_union([p['g'] for p in provs if p['side'] == 0]); IR = unary_union([p['g'] for p in provs if p['side'] == 1])
BORDER = IQ.buffer(1).intersection(IR.buffer(1)).boundary if False else IQ.boundary.intersection(IR.buffer(2))
DESERT = {'IQ-AN', 'IQ-MU', 'IQ-NA', 'IR-25', 'IR-12', 'IR-29', 'IR-13', 'IR-15'}
MARSH = Polygon([P(*q) for q in [(46.25, 31.2), (46.9, 31.0), (47.35, 30.85), (47.75, 30.95), (47.85, 31.45), (47.75, 31.95), (47.3, 31.95), (46.9, 31.6), (46.3, 31.5)]])
# بذور: متباعدة حسب البعد عن حدود العراق–إيران
def spacing(x, y):
    d = BORDER.distance(Point(x, y))
    return 32 + 43 * min(1, d / 550)
cells = []
for pi, pv in enumerate(provs):
    g = pv['g']; pg = prep(g); x0, y0, x1, y1 = g.bounds; pts = []
    tries = int((x1 - x0) * (y1 - y0) / 40) + 400
    for _ in range(tries):
        x, y = random.uniform(x0, x1), random.uniform(y0, y1)
        if not pg.contains(Point(x, y)): continue
        r = spacing(x, y) * .92
        if all((x - a) ** 2 + (y - b) ** 2 > r * r for a, b in pts): pts.append((x, y))
    if not pts: pts = [g.representative_point().coords[0]]
    # تنعيم لويد مرتين
    for it in range(3):
        if len(pts) == 1: polys = [g]; break
        vd = voronoi_diagram(MultiPoint(pts), envelope=g.buffer(200))
        polys = []
        for q in pts:
            c = next(v for v in vd.geoms if v.contains(Point(q)))
            polys.append(c.intersection(g))
        if it < 2: pts = [(pp.centroid.x, pp.centroid.y) if not pp.is_empty else q for pp, q in zip(polys, pts)]
    for pp in polys:
        if pp.is_empty: continue
        if pp.geom_type == 'MultiPolygon':  # القطع الصغيرة تنضم للأكبر
            pp = max(pp.geoms, key=lambda a: a.area)
        if pp.geom_type != 'Polygon' or pp.area < 30: continue
        cells.append(dict(pr=pi, s=pv['side'], g=pp))
# القطع اللي ضاعت (أجزاء MultiPolygon) تنضم لأقرب منطقة بنفس المحافظة
print('cells', len(cells))
# الأرض
for c in cells:
    g = c['g']; x0, y0, x1, y1 = g.bounds; pg = prep(g); hs = []
    for a in np.linspace(x0, x1, 9):
        for b in np.linspace(y0, y1, 9):
            if pg.contains(Point(a, b)): hs.append(elev_km(a, b))
    ct = g.representative_point(); hs = hs or [elev_km(ct.x, ct.y)]
    mean, sd = float(np.mean(hs)), float(np.std(hs))
    pid = provs[c['pr']]['id']
    if MARSH.contains(ct): t = 'marsh'
    elif sd > 330 or mean > 1800: t = 'mount'
    elif sd > 140 or mean > 900: t = 'hills'
    elif pid in DESERT and mean < 900: t = 'desert'
    else: t = 'plain'
    c.update(t=t, elev=round(mean), c=(round(ct.x, 1), round(ct.y, 1)))
# المدن (من بيانات wardesigns بأسمائها العربية)
GEO = json.loads(open(WD).read().split('=', 1)[1].rstrip().rstrip(';'))
tree = STRtree([c['g'] for c in cells])
for city in GEO['cities']:
    pt = Point(*city['xy']); hit = [i for i in tree.query(pt) if cells[i]['g'].contains(pt)]
    if not hit: continue
    c = cells[hit[0]]
    if c.get('city') and c['pop'] >= city['pop']: continue
    c['city'] = city['n']; c['pop'] = city['pop']; c['cap'] = city['cap']
    c['vp'] = 10 if city['cap'] else 5 if city['pop'] >= 1500 else 3 if city['pop'] >= 600 else 1
    if city['pop'] >= 400: c['t'] = 'city'
    c['c'] = (round(city['xy'][0], 1), round(city['xy'][1], 1))
# الأنهار الكبيرة
rivers = []
for f in gj('ne_10m_rivers_lake_centerlines')['features']:
    g = shape(f['geometry']); b = g.bounds
    if b[2] < 38.5 or b[0] > 56 or b[3] < 27 or b[1] > 39.5: continue
    if (f['properties'].get('scalerank') or 9) > 7: continue
    for l in (proj(g) if g.geom_type == 'MultiLineString' else [proj(g)]): rivers.append(l)
RIV = unary_union(rivers)
# الجيران والحد المشترك
edges = []
for i, a in enumerate(cells):
    for j in tree.query(a['g'].buffer(1.5)):
        if j <= i: continue
        b = cells[j]; sh = a['g'].buffer(1.2).intersection(b['g'].buffer(1.2))
        if sh.is_empty or sh.area < 4: continue
        seg = a['g'].boundary.intersection(b['g'].buffer(1.2))
        lines = [seg] if seg.geom_type == 'LineString' else [q for q in getattr(seg, 'geoms', []) if q.geom_type == 'LineString']
        if not lines: continue
        mg = linemerge(lines) if len(lines) > 1 else lines[0]
        parts = [mg] if mg.geom_type == 'LineString' else list(mg.geoms)
        L = sum(p.length for p in parts)
        if L < 3: continue
        river = 1 if LineString([a['c'], b['c']]).intersects(RIV) else 0
        edges.append([int(i), int(j), river, [[[round(x, 1), round(y, 1)] for x, y in p.simplify(1.2).coords] for p in parts]])
for c in cells: c['nb'] = []
for e in edges: cells[e[0]]['nb'].append(e[1]); cells[e[1]]['nb'].append(e[0])
# بدون جيران (جزر): نشيلها
keep = [i for i, c in enumerate(cells) if c['nb']]
print('isolated', len(cells) - len(keep))
out = dict(provs=[dict(id=p['id'], n=p['n'], s=p['side']) for p in provs], cells=[], edges=[])
for i, c in enumerate(cells):
    ring = [[round(x, 1), round(y, 1)] for x, y in c['g'].simplify(1.2).exterior.coords[:-1]]
    d = dict(pr=c['pr'], s=c['s'], t=c['t'], c=list(c['c']), a=round(c['g'].area), ring=ring, nb=c['nb'])
    for k in ('city', 'pop', 'cap', 'vp'):
        if k in c: d[k] = c[k]
    out['cells'].append(d)
out['edges'] = edges
from collections import Counter
print('terrain', Counter(c['t'] for c in cells), 'cities', sum(1 for c in cells if 'city' in c), 'edges', len(edges), 'river edges', sum(e[2] for e in edges))
open('cells.js', 'w').write('// مولّد بـ tools/cells.py — لا تعدّله باليد\nwindow.CELLS=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
