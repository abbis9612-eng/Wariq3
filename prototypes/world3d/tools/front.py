# قطاعات جبهة العراق–إيران (WM14، I-073): الحدود الحقيقية (Natural Earth 10m) مقسّمة ~55 كم،
# ونوع الأرض لكل قطاع من الارتفاعات الحقيقية (terrain/me_h.png)، والمدن الأهداف القريبة.
#   python3 tools/front.py <مجلد ne>   ← يكتب src/front.json
import json, math, sys
import numpy as np
from PIL import Image
NE = sys.argv[1]
REF = (31.45, 47.95); MPU = 40075016 * math.cos(math.radians(REF[0]))
MX = lambda lon: (lon + 180) / 360
MY = lambda lat: (1 - math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) / math.pi) / 2
XY = lambda lat, lon: ((MX(lon) - MX(REF[1])) * MPU, -(MY(lat) - MY(REF[0])) * MPU)
# الحدود: نلم القطع بسلسلة وحدة من تركيا (شمال) لشط العرب (جنوب)
segs = []
for f in json.load(open(f'{NE}/ne_10m_admin_0_boundary_lines_land.geojson'))['features']:
    p = f['properties']
    if {p['ADM0_A3_L'], p['ADM0_A3_R']} == {'IRQ', 'IRN'}:
        g = f['geometry']; segs += g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
segs = [[tuple(q) for q in s] for s in segs]
start = max((s for s in segs), key=lambda s: max(s[0][1], s[-1][1])); segs.remove(start)
if start[0][1] < start[-1][1]: start = start[::-1]
line = list(start)
while segs:
    e = line[-1]; best = min(((math.dist(e, s[0]), s, False) for s in segs), key=lambda t: t[0]); bestr = min(((math.dist(e, s[-1]), s, True) for s in segs), key=lambda t: t[0])
    d, s, rev = min(best, bestr, key=lambda t: t[0])
    if d > .05: print('فجوة', round(d, 3), 'بقت', len(segs)); break
    segs.remove(s); line += (s[::-1] if rev else s)[1:]
P = np.array([XY(lat, lon) for lon, lat in line])
cum = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
L = cum[-1]; N = round(L / 55000); print('طول الحدود', round(L / 1000), 'كم →', N, 'قطاع')
at = lambda s: np.array([np.interp(s, cum, P[:, 0]), np.interp(s, cum, P[:, 1])])
# ارتفاعات me
lv = json.load(open('terrain/levels.json'))['levels']['me']; m = lv['m']
H = np.asarray(Image.open('terrain/me_h.png').convert('RGB')).astype(float); H = H[..., 0] * 256 + H[..., 1] + H[..., 2] / 256 - 32768
def elev(x, y):
    u = x / MPU + MX(REF[1]); w = -y / MPU + MY(REF[0])
    i = (u - m[0]) / (m[2] - m[0]) * (H.shape[1] - 1); j = (w - m[1]) / (m[3] - m[1]) * (H.shape[0] - 1)
    return H[int(np.clip(round(j), 0, H.shape[0] - 1)), int(np.clip(round(i), 0, H.shape[1] - 1))]
# مدن أهداف [قيمة: 1 بلدة حدودية، 2 مدينة، 3 مدينة كبيرة/نفط]
CITIES = [('IQ', 'البصرة', 30.51, 47.81, 3), ('IQ', 'الفاو', 29.98, 48.47, 1), ('IQ', 'القرنة', 31.01, 47.43, 1), ('IQ', 'العمارة', 31.84, 47.15, 2), ('IQ', 'الكوت', 32.51, 45.82, 2),
          ('IQ', 'بدرة', 33.11, 45.94, 1), ('IQ', 'مندلي', 33.75, 45.55, 1), ('IQ', 'خانقين', 34.35, 45.38, 1), ('IQ', 'بعقوبة', 33.75, 44.64, 2), ('IQ', 'حلبجة', 35.18, 45.99, 1),
          ('IQ', 'السليمانية', 35.56, 45.44, 3), ('IQ', 'رانية', 36.25, 44.88, 1), ('IQ', 'كركوك', 35.47, 44.39, 3),
          ('IR', 'عبادان', 30.34, 48.30, 3), ('IR', 'خرمشهر', 30.44, 48.17, 2), ('IR', 'الأهواز', 31.32, 48.67, 3), ('IR', 'سوسنگرد', 31.56, 48.18, 1), ('IR', 'دهلران', 32.69, 47.27, 1),
          ('IR', 'مهران', 33.12, 46.16, 1), ('IR', 'إيلام', 33.64, 46.42, 2), ('IR', 'قصر شيرين', 34.52, 45.58, 1), ('IR', 'إسلام آباد غرب', 34.11, 46.53, 1), ('IR', 'كرمانشاه', 34.31, 47.07, 3),
          ('IR', 'مريوان', 35.52, 46.18, 1), ('IR', 'سردشت', 36.15, 45.48, 1), ('IR', 'بيرانشهر', 36.70, 45.14, 1)]
CXY = [(c, n, *XY(la, lo), v) for c, n, la, lo, v in CITIES]
# الأهوار (الحويزة) والأنهار بالقطاع [مناطق تقريبية]
MARSH = [(31.0, 47.35, 31.85, 47.85)]
secs = []
for k in range(N):
    s0, s1 = L * k / N, L * (k + 1) / N; a, b = at(s0), at(s1); c = at((s0 + s1) / 2)
    t = (b - a) / np.linalg.norm(b - a); n = np.array([-t[1], t[0]])
    if n[0] < 0: n = -n   # الطبيعي يأشر لإيران (شرق)
    hs = [elev(*(c + t * dt + n * dn)) for dt in np.linspace(-25e3, 25e3, 7) for dn in np.linspace(-30e3, 30e3, 9)]
    mean, sd = float(np.mean(hs)), float(np.std(hs))
    lat = REF[0] - 0; lon = 0
    # نرجع خط العرض/الطول من x,y للمطابقة مع الأهوار
    lon = (c[0] / MPU + MX(REF[1])) * 360 - 180; yy = -c[1] / MPU + MY(REF[0]); lat = math.degrees(2 * math.atan(math.exp(math.pi * (1 - 2 * yy))) - math.pi / 2)
    terr = 'mount' if sd > 400 or mean > 900 else 'hills' if sd > 90 or mean > 300 else 'plain'
    if any(a0 <= lat <= a1 and o0 <= lon <= o1 for a0, o0, a1, o1 in MARSH): terr = 'marsh'
    if lat < 30.62: terr = 'river'   # شط العرب
    near = [{'side': cc, 'n': nm, 'x': round(x), 'y': round(y), 'v': v} for cc, nm, x, y, v in CXY if math.hypot(x - c[0], y - c[1]) < 110e3]
    secs.append({'i': k, 'a': [round(a[0]), round(a[1])], 'b': [round(b[0]), round(b[1])], 'c': [round(c[0]), round(c[1])], 'n': [round(n[0], 4), round(n[1], 4)],
                 'lat': round(lat, 2), 'lon': round(lon, 2), 'terr': terr, 'elev': round(mean), 'sd': round(sd), 'cities': near})
    print(k, round(lat, 2), round(lon, 2), terr, round(mean), round(sd), [q['n'] for q in near])
json.dump({'len': round(L), 'sectors': secs, 'cities': [{'side': c, 'n': n, 'x': round(x), 'y': round(y), 'v': v} for c, n, x, y, v in CXY]}, open('src/front.json', 'w'), ensure_ascii=False)
