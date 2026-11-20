# W2.1 (I-097، D-046): يقسم العالم لمناطق لعب من محافظات Natural Earth (admin-1).
#   python3 tools/map/regions.py <مجلد Natural Earth geojson>   ← data/world/regions.json + data/world/regions_geo.json
# القاعدة: المحافظة الصغيرة تندمج ويا جارتها بنفس الدولة، والكبيرة تنقسم (k-means + فورونوي) لحد ما كل منطقة قريبة من الحجم الهدف.
# الحجم الهدف حسب درجة الدولة (أ أصغر = تفاصيل أكثر) وأكبر بالقطب. الأراضي اللي مو من الـ157 تبقى «محايدة» حتى الخريطة ما بيها فراغات.
import json, math, sys, os, random, re
import numpy as np
from shapely.geometry import shape, Point, Polygon, MultiPolygon, mapping
from shapely.ops import unary_union, voronoi_diagram
from shapely.strtree import STRtree
random.seed(11); np.random.seed(11)
NE = sys.argv[1]; R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data')
CL = {c['id']: c for c in json.load(open(f'{R}/world/countries.json'))}
# أقاليم تابعة لدولة من الـ157 (السيادة/السيطرة الفعلية تنحط بـ control.json)
OWN = {'HKG': 'CHN', 'MAC': 'CHN', 'SAH': 'MAR', 'SOL': 'SOM', 'KOS': 'SRB', 'CYN': 'CYP', 'KAB': 'KAZ', 'KAS': 'IND', 'GRL': 'DNK', 'FRO': 'DNK', 'ALD': 'FIN',
  'FLK': 'GBR', 'SGS': 'GBR', 'IOT': 'GBR', 'ESB': 'CYP', 'WSB': 'CYP', 'PRI': 'USA', 'GUM': 'USA', 'VIR': 'USA', 'MNP': 'USA', 'ASM': 'USA', 'USG': 'CUB', 'NCL': 'FRA', 'PYF': 'FRA', 'PGA': None}
DROP = {'ATA', 'ATF', 'HMD', 'CLP', 'CSI', 'ATC', 'UMI', 'VAT', 'PGA'}
TGT = {'A': 25000, 'B': 40000, 'C': 60000, None: 90000}     # كم² للمنطقة
KM = lambda lat: 111.32 ** 2 * math.cos(math.radians(lat))
def km2(g):
    if g.is_empty: return 0
    return sum(p.area * KM(p.centroid.y) for p in (g.geoms if hasattr(g, 'geoms') else [g]))
def tgt(cid, lat, dens=None):
    t = TGT[CL[cid]['tier'] if cid in CL else None]
    f = 1 if dens is None else min(3.5, max(.72, (40 / max(dens, .1)) ** .45))
    return t * f * (1.8 if abs(lat) > 62 else 1.3 if abs(lat) > 55 else 1)
nm = lambda p: re.sub(r'^(محافظة|منطقة|ولاية|مقاطعة|إقليم|جهة|إمارة|بلدية|مدينة) ', '', (p.get('name_ar') or p.get('name') or '').strip()) or p.get('name') or '؟'

# 1) المحافظات
prov = []
for f in json.load(open(f'{NE}/ne_10m_admin_1_states_provinces.geojson'))['features']:
    p = f['properties']; a = p['adm0_a3']
    if a in DROP: continue
    c = a if a in CL else OWN.get(a, '~' + a)   # ~XXX = أرض محايدة (دولة صغيرة مو باللعبة)
    if c is None: continue
    g = shape(f['geometry']).buffer(0)
    if g.is_empty: continue
    prov.append({'c': c, 'src': a, 'code': p.get('adm1_code') or p.get('iso_3166_2'), 'n': nm(p), 'en': p.get('name') or '', 'g': g, 'a': km2(g)})
print('محافظات', len(prov))
# كثافة تقريبية لكل محافظة: نص سكان الدولة حسب المساحة ونص حسب سكان المدن (Natural Earth populated places) — الصحاري والقطب مناطق أكبر
PP = [(f['geometry']['coordinates'], f['properties'].get('pop_max') or 0) for f in json.load(open(f'{NE}/ne_10m_populated_places_simple.geojson'))['features']]
PT = STRtree([Point(*c) for c, _ in PP])
cpop = {}; carea = {}
for x in prov:
    x['cp'] = sum(PP[int(j)][1] for j in PT.query(x['g'], predicate='contains')); cpop[x['c']] = cpop.get(x['c'], 0) + x['cp']; carea[x['c']] = carea.get(x['c'], 0) + x['a']
for x in prov:
    P0 = (CL[x['c']]['base']['pop'] if x['c'] in CL else 3e5)
    x['pop'] = P0 * (.4 * x['a'] / max(1, carea[x['c']]) + .6 * x['cp'] / max(1, cpop[x['c']]))

# 2) دمج الصغيرة ويا جارة بنفس الدولة (أصغر جارة أول)، وتنحسب الأسماء «أ + ب»
def merge_small(L):
    by = {}
    for x in L: by.setdefault(x['c'], []).append(x)
    out = []
    for c, P in by.items():
        P = [dict(x, names=[x['n']]) for x in P]
        changed = True
        while changed:
            changed = False
            P.sort(key=lambda x: x['a'])
            for x in P:
                lat = x['g'].representative_point().y; mn = tgt(c, lat, x['pop'] / max(1, x['a'])) * .33
                if x['a'] >= mn: continue
                nb = [y for y in P if y is not x and y['src'] == x['src'] and y['g'].distance(x['g']) < .02]
                if not nb:
                    if x['a'] < 300 and len(P) > 1:   # جزيرة صغيرة: تنضم لأقرب منطقة
                        nb = [min((y for y in P if y is not x and y['src'] == x['src']), key=lambda y: y['g'].distance(x['g']), default=None)]
                        nb = [y for y in nb if y]
                    else: continue
                if not nb: continue
                y = min(nb, key=lambda y: y['a'])
                y['g'] = unary_union([y['g'], x['g']]).buffer(0); y['a'] += x['a']; y['pop'] += x['pop']; y['names'] = y['names'] + x['names']; P.remove(x); changed = True; break
        out += P
    return out
prov = merge_small(prov); print('بعد الدمج', len(prov))

# 3) تقسيم الكبيرة
def split(x, k=None):
    g = x['g']; lat = g.representative_point().y; k = k or max(1, round(x['a'] / tgt(x['c'], lat, x['pop'] / max(1, x['a']))))
    if k == 1: return [x]
    mnx, mny, mxx, mxy = g.bounds; pts = []
    while len(pts) < k * 60:
        q = np.random.uniform([mnx, mny], [mxx, mxy], (k * 200, 2))
        pts += [p for p in q if g.contains(Point(p))]
    P = np.array(pts[:k * 60]); cx = math.cos(math.radians(lat)); W = np.array([cx, 1])
    C = P[np.random.choice(len(P), k, replace=False)]
    for _ in range(30):
        lab = (((P[:, None, :] - C[None]) * W) ** 2).sum(-1).argmin(1)
        C = np.array([P[lab == i].mean(0) if (lab == i).any() else C[i] for i in range(k)])
    vor = voronoi_diagram(MultiPolygon() if False else unary_union([Point(*c) for c in C]), envelope=g.envelope.buffer(1))
    parts = []
    for cell in vor.geoms:
        pg = cell.intersection(g)
        if pg.is_empty or km2(pg) < 50: continue
        parts.append(pg)
    out = []
    for i, pg in enumerate(sorted(parts, key=lambda p: (-p.representative_point().y, p.representative_point().x))):
        out.append(dict(x, g=pg, a=km2(pg), part=i + 1, of=len(parts)))
    return out
reg = []
for x in prov: reg += split(x)
# أقل عدد مناطق للدولة حتى الحرب تنلعب (أ 8، ب 4، ج 2)، بالتقسيم الإضافي لأكبر منطقة
MINR = {'A': 8, 'B': 4, 'C': 2}
for c in CL:
    while True:
        R_ = [r for r in reg if r['c'] == c]
        if len(R_) >= MINR[CL[c]['tier']] or sum(r['a'] for r in R_) < 1500 * len(R_) * 2: break
        big = max(R_, key=lambda r: r['a']); new = split(dict(big, pop=big['pop']), 2)
        if len(new) < 2: break
        reg.remove(big); reg += new
print('مناطق', len(reg))

# 4) الأرقام والأسماء والجيران
reg.sort(key=lambda r: (r['c'], -r['g'].representative_point().y))
cnt = {}
for r in reg:
    cnt[r['c']] = cnt.get(r['c'], 0) + 1; r['id'] = f"{r['c'].lstrip('~')}{cnt[r['c']]:03d}" if not r['c'].startswith('~') else f"X{r['c'][1:]}{cnt[r['c']]:02d}"
    base = r['names'][0] if len(r['names']) == 1 else '، '.join(r['names'][:2]) + ('…' if len(r['names']) > 2 else '')
    r['name'] = base + (f" {r['part']}" if r.get('of', 1) > 1 else '')
G = [r['g'] for r in reg]; T = STRtree(G)
for i, r in enumerate(reg):
    nb = []
    for j in T.query(r['g'].buffer(.02)):
        j = int(j)
        if j == i: continue
        sh = r['g'].buffer(.01).intersection(G[j].buffer(.01))
        if not sh.is_empty and sh.area > 1e-5: nb.append(reg[j]['id'])
    r['nb'] = sorted(set(nb))
# 5) الكتابة: خصائص + أشكال مبسطة (0.02° ≈ 2 كم، إحداثيات ×100 كأعداد صحيحة)
Q = lambda v: int(round(v * 100))
def rings(g):
    g = g.simplify(.02, preserve_topology=True); out = []
    for p in (g.geoms if hasattr(g, 'geoms') else [g]):
        if p.geom_type != 'Polygon' or p.area < 2e-4 and len(out): continue
        out.append([[Q(x), Q(y)] for x, y in p.exterior.coords])
    return out
props = [{'id': r['id'], 'c': None if r['c'].startswith('~') else r['c'], 'nt': r['c'][1:] if r['c'].startswith('~') else None, 'n': r['name'], 'en': r['en'],
  'adm': r['code'], 'src': r['src'], 'a': round(r['a']), 'll': [round(c, 3) for c in r['g'].representative_point().coords[0]], 'nb': r['nb']} for r in reg]
json.dump({'src': {'ne': {'t': 'Natural Earth 1:10m Admin-1 States, Provinces (v5.1)', 'u': 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/', 'y': 2024}},
  'note': 'مناطق اللعب: c = الدولة صاحبة الأرض (مالكة)، nt = أرض محايدة مو باللعبة. السيطرة الفعلية 2026 بـ control.json', 'r': props}, open(f'{R}/world/regions.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump({r['id']: rings(r['g']) for r in reg}, open(f'{R}/world/regions_geo.json', 'w'), separators=(',', ':'))
from collections import Counter
cc = Counter(p['c'] for p in props if p['c'])
print('دول', len(cc), '· محايدة', sum(1 for p in props if not p['c']), '· بلا جيران', sum(1 for p in props if not p['nb']))
print('أكثر', cc.most_common(10)); print('العراق', cc['IRQ'], 'إيران', cc['IRN'], 'أمريكا', cc['USA'], 'قطر', cc['QAT'], 'لبنان', cc['LBN'])
