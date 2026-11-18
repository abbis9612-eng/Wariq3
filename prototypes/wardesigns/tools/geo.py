# بيانات الخريطة المشتركة للنماذج الأربعة (WD0، I-078): محافظات العراق وإيران الحقيقية، جيرانها، نوع الأرض، أنهار، مدن.
#   python3 tools/geo.py <مجلد Natural Earth> <ملف ارتفاعات me_h.png> <levels.json>   ← data.js
# المصادر: Natural Earth (ملكية عامة)، ارتفاعات AWS Terrain Tiles (من world3d).
import json, math, sys
import numpy as np
from PIL import Image
from shapely.geometry import shape, Polygon, MultiPolygon, LineString, box, mapping
from shapely.ops import unary_union
NE, HPNG, LVJ = sys.argv[1], sys.argv[2], sys.argv[3]
LON0, LAT0, LON1, LAT1 = 38.5, 24.5, 63.5, 40.2
KX = 111.32 * math.cos(math.radians(33)); KY = 110.57
P = lambda lon, lat: ((lon - LON0) * KX, (LAT1 - lat) * KY)
def proj(g):
    if g.geom_type == 'Polygon': return Polygon([P(*c[:2]) for c in g.exterior.coords], [[P(*c[:2]) for c in r.coords] for r in g.interiors])
    if g.geom_type == 'MultiPolygon': return MultiPolygon([proj(p) for p in g.geoms])
    if g.geom_type == 'LineString': return LineString([P(*c[:2]) for c in g.coords])
    if g.geom_type == 'MultiLineString': return [proj(l) for l in g.geoms]
gj = lambda n: json.load(open(f'{NE}/{n}.geojson'))
BB = box(LON0, LAT0, LON1, LAT1)
def rings(g, tol):
    g = g.simplify(tol, preserve_topology=True); out = []
    for p in (g.geoms if g.geom_type == 'MultiPolygon' else [g]):
        if p.area < 4: continue
        out.append([[round(x, 1), round(y, 1)] for x, y in p.exterior.coords[:-1]])
    return out
# ارتفاعات (مستوى me من world3d)
lv = json.load(open(LVJ))['levels']['me']; m = lv['m']
H = np.asarray(Image.open(HPNG).convert('RGB')).astype(float); H = H[..., 0] * 256 + H[..., 1] + H[..., 2] / 256 - 32768
MX = lambda lo: (lo + 180) / 360; MY = lambda la: (1 - math.log(math.tan(math.pi / 4 + math.radians(la) / 2)) / math.pi) / 2
def elev(lon, lat):
    i = (MX(lon) - m[0]) / (m[2] - m[0]) * (H.shape[1] - 1); j = (MY(lat) - m[1]) / (m[3] - m[1]) * (H.shape[0] - 1)
    return max(0, H[int(np.clip(round(j), 0, H.shape[0] - 1)), int(np.clip(round(i), 0, H.shape[1] - 1))])
# المحافظات
DESERT = {'IQ-AN', 'IQ-MU', 'IQ-NA', 'IR-25', 'IR-12', 'IR-29', 'IR-13', 'IR-15'}
MARSH = {'IQ-MA', 'IQ-DQ'}   # الأهوار (ميسان وذي قار)
provs = []
for f in gj('ne_10m_admin_1_states_provinces')['features']:
    p = f['properties']
    if p['adm0_a3'] not in ('IRQ', 'IRN'): continue
    pid = p['iso_3166_2'] if p['name'] != 'Alborz' else 'IR-AL'
    g = shape(f['geometry']); gp = proj(g)
    n = (p.get('name_ar') or p['name']).replace('محافظة ', '')
    lo, la = g.representative_point().x, g.representative_point().y
    # الأرض: معدل ارتفاع وخشونة على شبكة نقاط داخل المحافظة
    x0, y0, x1, y1 = g.bounds; hs = []
    for a in np.linspace(x0, x1, 14):
        for b in np.linspace(y0, y1, 14):
            from shapely.geometry import Point
            if g.contains(Point(a, b)): hs.append(elev(a, b))
    hs = hs or [elev(lo, la)]; mean, sd = float(np.mean(hs)), float(np.std(hs))
    terr = 'plain' if pid == 'IR-10' else 'desert' if pid in DESERT else 'marsh' if pid in MARSH else 'mount' if sd > 380 or mean > 1500 else 'hills' if sd > 160 or mean > 650 else 'plain'
    c = gp.representative_point() if gp.geom_type == 'Polygon' else max(gp.geoms, key=lambda q: q.area).representative_point()
    provs.append(dict(id=pid, side=0 if p['adm0_a3'] == 'IRQ' else 1, n=n, terr=terr, elev=round(mean), sd=round(sd), area=round(gp.area), c=[round(c.x, 1), round(c.y, 1)], g=gp, poly=rings(gp, 1.6)))
# الجيران: حدود مشتركة أطول من 4 كم
for a in provs: a['nb'] = []
for i, a in enumerate(provs):
    for b in provs[i + 1:]:
        if not a['g'].buffer(3).intersects(b['g'].buffer(3)): continue
        L = a['g'].buffer(3).intersection(b['g'].buffer(3)).area / 6
        if L > 6: a['nb'].append(b['id']); b['nb'].append(a['id'])
# تصحيح: حدود بغداد مع صلاح الدين وواسط رفيعة بالبيانات
for x, y in [('IQ-BG', 'IQ-SD'), ('IQ-BG', 'IQ-WA')]:
    A = next(q for q in provs if q['id'] == x); B = next(q for q in provs if q['id'] == y)
    if y not in A['nb']: A['nb'].append(y); B['nb'].append(x)
# اليابسة والدول المجاورة والبحيرات والأنهار
land = unary_union([shape(f['geometry']).intersection(BB) for f in gj('ne_50m_land')['features'] if shape(f['geometry']).intersects(BB)])
land = rings(proj(land), 2.5)
lakes = [r for f in gj('ne_10m_lakes')['features'] if shape(f['geometry']).intersects(BB) and (f['properties'].get('scalerank') or 9) <= 6 for r in rings(proj(shape(f['geometry']).intersection(BB)), 2)]
NB = {'TUR': 'تركيا', 'SYR': 'سوريا', 'JOR': 'الأردن', 'SAU': 'السعودية', 'KWT': 'الكويت', 'AZE': 'أذربيجان', 'ARM': 'أرمينيا', 'TKM': 'تركمانستان', 'AFG': 'أفغانستان', 'PAK': 'باكستان', 'BHR': 'البحرين', 'QAT': 'قطر', 'ARE': 'الإمارات', 'OMN': 'عُمان'}
others = []
for f in gj('ne_50m_admin_0_countries')['features']:
    a3 = f['properties']['ADM0_A3']
    if a3 in NB and shape(f['geometry']).intersects(BB):
        g = shape(f['geometry']).intersection(BB); gp = proj(g); c = gp.representative_point()
        others.append(dict(id=a3, n=NB[a3], poly=rings(gp, 3), c=[round(c.x), round(c.y)]))
rivers = []
for f in gj('ne_10m_rivers_lake_centerlines')['features']:
    pr = f['properties']; g = shape(f['geometry'])
    if (pr.get('scalerank') or 9) > 7 or not g.intersects(BB): continue
    g = g.intersection(BB); ls = proj(g); ls = ls if isinstance(ls, list) else [ls]
    for l in ls:
        if l.length < 20: continue
        l = l.simplify(1.2); rivers.append(dict(n=pr.get('name_ar') or pr.get('name') or '', w=1 + max(0, 6 - (pr.get('scalerank') or 6)) * .5, p=[[round(x, 1), round(y, 1)] for x, y in l.coords]))
# المدن (أسماء عربية، إحداثيات حقيقية تقريبية، السكان بالألف)
CITIES = [l.split(',') for l in '''بغداد,33.34,44.39,7000,IQ-BG,cap
البصرة,30.51,47.81,1300,IQ-BA,
الموصل,36.34,43.13,1500,IQ-NI,
أربيل,36.19,44.01,1100,IQ-AR,
السليمانية,35.56,45.43,900,IQ-SU,
كركوك,35.47,44.39,900,IQ-TS,
دهوك,36.87,42.99,350,IQ-DA,
النجف,32.00,44.34,800,IQ-NA,
كربلاء,32.62,44.02,700,IQ-KA,
الحلة,32.48,44.42,600,IQ-BB,
الديوانية,31.99,44.92,450,IQ-QA,
الناصرية,31.05,46.26,550,IQ-DQ,
العمارة,31.84,47.14,450,IQ-MA,
الكوت,32.51,45.82,450,IQ-WA,
بعقوبة,33.75,44.64,500,IQ-DI,
تكريت,34.61,43.68,200,IQ-SD,
سامراء,34.20,43.87,300,IQ-SD,
الرمادي,33.42,43.30,550,IQ-AN,
الفلوجة,33.35,43.78,350,IQ-AN,
القائم,34.37,41.09,150,IQ-AN,
السماوة,31.31,45.28,350,IQ-MU,
الفاو,29.98,48.47,100,IQ-BA,
القرنة,31.01,47.43,60,IQ-BA,
خانقين,34.35,45.38,180,IQ-DI,
مندلي,33.75,45.55,40,IQ-DI,
بدرة,33.11,45.94,30,IQ-WA,
حلبجة,35.18,45.99,100,IQ-SU,
زاخو,37.14,42.68,200,IQ-DA,
طهران,35.69,51.39,9000,IR-07,cap
كرج,35.84,50.94,1600,IR-AL,
الأهواز,31.32,48.67,1200,IR-10,
عبادان,30.34,48.30,230,IR-10,
خرمشهر,30.44,48.17,170,IR-10,
دزفول,32.38,48.40,270,IR-10,
سوسنگرد,31.56,48.18,50,IR-10,
كرمانشاه,34.31,47.07,950,IR-17,
قصر شيرين,34.52,45.58,20,IR-17,
إسلام آباد غرب,34.11,46.53,90,IR-17,
إيلام,33.64,46.42,200,IR-05,
مهران,33.12,46.16,30,IR-05,
دهلران,32.69,47.27,40,IR-05,
سنندج,35.31,47.00,410,IR-16,
مريوان,35.52,46.18,110,IR-16,
أرومية,37.55,45.07,740,IR-02,
بيرانشهر,36.70,45.14,80,IR-02,
تبريز,38.08,46.29,1600,IR-01,
أردبيل,38.25,48.29,530,IR-03,
رشت,37.28,49.58,680,IR-19,
زنجان,36.67,48.48,430,IR-11,
قزوين,36.27,50.00,400,IR-28,
همدان,34.80,48.52,550,IR-24,
خرم آباد,33.49,48.36,370,IR-20,
أراك,34.09,49.69,520,IR-22,
قم,34.64,50.88,1200,IR-26,
أصفهان,32.65,51.67,2000,IR-04,
شهركرد,32.33,50.86,190,IR-08,
ياسوج,30.67,51.59,130,IR-18,
شيراز,29.59,52.58,1600,IR-14,
بوشهر,28.97,50.84,230,IR-06,
بندر عباس,27.18,56.27,530,IR-23,
ساري,36.57,53.06,300,IR-21,
سمنان,35.57,53.39,180,IR-12,
يزد,31.90,54.37,530,IR-25,
كرمان,30.28,57.08,540,IR-15,
مشهد,36.30,59.60,3000,IR-30,
بجنورد,37.47,57.33,230,IR-31,
بيرجند,32.87,59.22,200,IR-29,
زاهدان,29.50,60.86,590,IR-13,
گرگان,36.84,54.44,350,IR-27,'''.split('\n')]
cities = [dict(n=n, xy=[round(c, 1) for c in P(float(lo), float(la))], pop=int(pp), prov=pv, cap=bool(cp.strip())) for n, la, lo, pp, pv, cp in CITIES]
for pv in provs:
    cs = sorted([c for c in cities if c['prov'] == pv['id']], key=lambda c: -c['pop'])
    pv['city'] = cs[0]['n'] if cs else pv['n']; pv['pop'] = sum(c['pop'] for c in cs)
    del pv['g']
# خط الحدود العراقية الإيرانية (من الشمال للجنوب) + قطاعات لوحة الجبهة (WD2)
segs = []
for f in gj('ne_10m_admin_0_boundary_lines_land')['features']:
    pr = f['properties']
    if {pr['ADM0_A3_L'], pr['ADM0_A3_R']} == {'IRQ', 'IRN'}:
        g = f['geometry']; segs += g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
segs = [[tuple(q) for q in s_] for s_ in segs]; st = max(segs, key=lambda s_: max(s_[0][1], s_[-1][1])); segs.remove(st)
if st[0][1] < st[-1][1]: st = st[::-1]
line = list(st)
while segs:
    e = line[-1]; d, s_, rev = min([(math.dist(e, x[0]), x, False) for x in segs] + [(math.dist(e, x[-1]), x, True) for x in segs], key=lambda t: t[0])
    if d > .05: break
    segs.remove(s_); line += (s_[::-1] if rev else s_)[1:]
border = [list(P(lo, la)) for lo, la in LineString(line).simplify(.01).coords]
SECT = [('أربيل–أذربيجان', 37.4, 36.1, 'mount', 'رانية', 'بيرانشهر'), ('السليمانية–كردستان', 36.1, 35.0, 'mount', 'حلبجة', 'مريوان'), ('خانقين–قصر شيرين', 35.0, 34.15, 'hills', 'خانقين', 'قصر شيرين'),
        ('مندلي–إسلام آباد', 34.15, 33.35, 'hills', 'مندلي', 'إسلام آباد غرب'), ('بدرة–مهران', 33.35, 32.6, 'plain', 'بدرة', 'مهران'), ('العمارة–دهلران', 32.6, 31.65, 'plain', 'العمارة', 'دهلران'),
        ('الأهوار–الحويزة', 31.65, 30.75, 'marsh', 'القرنة', 'سوسنگرد'), ('البصرة–خرمشهر', 30.75, 29.9, 'plain', 'البصرة', 'خرمشهر')]
sectors = []
for n, la0, la1, terr, c0, c1 in SECT:
    pts = [P(lo, la) for lo, la in line if la1 <= la <= la0]
    if len(pts) < 2: continue
    a, b = pts[0], pts[-1]; tx, ty = b[0] - a[0], b[1] - a[1]; L = math.hypot(tx, ty); nx, ny = ty / L, -tx / L
    if nx < 0: nx, ny = -nx, -ny   # الطبيعي يأشر لإيران (شرق)
    sectors.append(dict(n=n, terr=terr, pts=[[round(x, 1), round(y, 1)] for x, y in pts], nrm=[round(nx, 3), round(ny, 3)], cities=[c0, c1]))
W, Hh = P(LON1, LAT0)
out = dict(border=[[round(x, 1), round(y, 1)] for x, y in border], sectors=sectors, W=round(W), H=round(Hh), proj=dict(lon0=LON0, lat1=LAT1, kx=round(KX, 4), ky=KY), provs=provs, land=land, lakes=lakes, others=others, rivers=rivers, cities=cities)
s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open('data.js', 'w').write('// مولّد بـ tools/geo.py — لا تعدّله باليد\nwindow.GEO=' + s + ';\n')
print('sectors', len(sectors), [len(x['pts']) for x in sectors]); print('provs', len(provs), 'land', len(land), 'lakes', len(lakes), 'others', len(others), 'rivers', len(rivers), 'cities', len(cities), 'KB', len(s) // 1024)
for p in provs: print(p['id'], p['n'], p['terr'], p['nb'])
