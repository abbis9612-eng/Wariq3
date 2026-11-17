# بيانات «العالم 3D» (WM11.1، I-065): خريطة مرسومة بثيمين بنفس ألوان «الحرب من فوق» + ارتفاعات، بثلاث مستويات تفاصيل
#   w  = العالم كله (z4: 4096² ≈ 8 كم/بكسل)  ·  me = الشرق الأوسط (z7: 4096² ≈ 1 كم)  ·  th = الجبهة (نفس حدود WM8، 65 م)
# المصادر: Natural Earth (ملكية عامة)، ارتفاعات AWS Terrain Tiles (Mapzen/terrarium)، خضرة من Sentinel-2 cloudless 2016 (EOX، CC BY 4.0)
# python3 tools/world.py <مجلد ne> <مجلد كاش>   ← terrain/<lvl>_<theme>.webp, terrain/<lvl>_h.png (ارتفاع terrarium RGB)، terrain/levels.json، labels/labels.json
import json, math, os, subprocess, sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
Image.MAX_IMAGE_PIXELS = None
NE, CACHE = sys.argv[1], sys.argv[2]; os.makedirs(CACHE, exist_ok=True)
MX = lambda lo: (lo + 180) / 360
MY = lambda la: (1 - math.log(math.tan(math.pi / 4 + max(-85.05, min(85.05, la)) * math.pi / 360)) / math.pi) / 2
TH = {   # نفس ألوان prototypes/topdown/tools/style.py
  'light': dict(land=(222, 208, 176), land2=(206, 188, 150), veg=(170, 182, 128), water=(110, 160, 196), deep=(86, 136, 176), shade=(120, 100, 80), hi=(255, 248, 230), shore=(70, 110, 140), border=(59, 53, 48), bglow=(255, 255, 255), river=(79, 143, 191), road=(138, 122, 99), ice=(240, 244, 246)),
  'dark':  dict(land=(58, 64, 70), land2=(48, 54, 60), veg=(48, 70, 56), water=(18, 62, 98), deep=(12, 44, 74), shade=(10, 12, 16), hi=(120, 132, 146), shore=(40, 110, 150), border=(232, 237, 242), bglow=(159, 214, 255), river=(58, 166, 224), road=(110, 118, 129), ice=(150, 160, 170)),
}
LV = {
  'w':  dict(z=4, tx=(0, 15), ty=(0, 15), sz=4096, grid=512, res='50m', exag=14, bw=1.2, rw=0),
  'me': dict(z=7, tx=(72, 87), ty=(45, 60), sz=4096, grid=512, res='10m', exag=5, bw=1.6, rw=1.1),
}
def grab(url, z, tx, ty, ext):
    im = Image.new('RGB', ((tx[1] - tx[0] + 1) * 256, (ty[1] - ty[0] + 1) * 256))
    for y in range(ty[0], ty[1] + 1):
        for x in range(tx[0], tx[1] + 1):
            f = f'{CACHE}/{url.split("/")[2]}_{z}_{y}_{x}.{ext}'
            if not os.path.exists(f): subprocess.run(['curl', '-sSf', '--retry', '3', '-o', f, url.format(z=z, x=x, y=y)], check=True)
            im.paste(Image.open(f).convert('RGB'), ((x - tx[0]) * 256, (y - ty[0]) * 256))
    return im
TERR = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
EOX = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'
dec = lambda a: a[..., 0] * 256. + a[..., 1] + a[..., 2] / 256. - 32768
def enc(h):
    v = np.clip(np.round((h + 32768) * 256), 0, 2 ** 24 - 1).astype(np.int64)
    return Image.fromarray(np.stack([(v >> 16) & 255, (v >> 8) & 255, v & 255], -1).astype(np.uint8))
gj = lambda n: json.load(open(f'{NE}/{n}.geojson'))
def rings(geom):
    if geom['type'] == 'Polygon': yield from geom['coordinates']
    elif geom['type'] == 'MultiPolygon':
        for p in geom['coordinates']: yield from p
def lines(geom):
    if geom['type'] == 'LineString': yield geom['coordinates']
    elif geom['type'] == 'MultiLineString': yield from geom['coordinates']
meta = {}
for name, L in LV.items():
    z, n, S = L['z'], 2 ** L['z'], L['sz']; x0, y0 = L['tx'][0], L['ty'][0]
    W = (L['tx'][1] - x0 + 1) * 256; H = (L['ty'][1] - y0 + 1) * 256; k = S / W
    P = lambda lo, la: ((MX(lo) * n - x0) * 256 * k, (MY(la) * n - y0) * 256 * k)
    # ارتفاعات
    dem = np.asarray(grab(TERR, z, L['tx'], L['ty'], 'png')).astype(np.float64); h = dec(dem)
    hl = np.maximum(h, 0).astype(np.float32); hl = np.asarray(Image.fromarray(hl).resize((S, S), Image.BILINEAR)).astype(np.float32)
    # ماء: كل شي مو يابسة + بحيرات (Natural Earth)
    land = Image.new('L', (S, S), 0); d = ImageDraw.Draw(land)
    for f in gj(f'ne_{L["res"]}_land')['features']:
        for r in rings(f['geometry']):
            pts = [P(*c[:2]) for c in r];
            if len(pts) > 2: d.polygon(pts, fill=255)
    for f in gj(f'ne_{L["res"]}_lakes')['features']:
        for r in rings(f['geometry']):
            pts = [P(*c[:2]) for c in r]
            if len(pts) > 2: d.polygon(pts, fill=0)
    wat = 1 - np.asarray(land.filter(ImageFilter.GaussianBlur(.6))).astype(np.float32) / 255
    deep = np.clip(-h / 3000, 0, 1).astype(np.float32); deep = np.asarray(Image.fromarray(deep).resize((S, S), Image.BILINEAR)).astype(np.float32)
    # خضرة من صور الأقمار (نفس مصنّف WM8)
    sat = np.asarray(grab(EOX, z, L['tx'], L['ty'], 'jpg').resize((S, S), Image.BILINEAR)).astype(np.float32) / 255
    R, G, B = sat[..., 0], sat[..., 1], sat[..., 2]; lum = (R + G + B) / 3
    veg = ((G > R * 1.03) & (G > B * 1.05) & (lum < .55)).astype(np.uint8) * 255
    veg = np.asarray(Image.fromarray(veg).filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (y0 * 256 + (np.arange(S) + .5) / k) / (n * 256)))))[:, None]   # خط العرض لكل صف
    ice = np.clip((lum - .72) * 5, 0, 1) * (1 - wat) * np.clip(np.maximum((np.abs(lat) - 55) / 6, (hl - 3800) / 800), 0, 1)   # ثلج بس بالبرد أو فوق الجبال (مو الصحراء)
    # ظل التضاريس (مضخّم حسب المستوى حتى يبين)
    mpp = 40075016 / (n * 256) / k
    gy, gx = np.gradient(hl, mpp); az, alt = math.radians(315), math.radians(42)
    slope = np.arctan(np.hypot(gx, gy) * 1.6 * L['exag']); aspect = np.arctan2(-gx, gy)
    rel = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1).astype(np.float32)
    rng = np.random.default_rng(3); noise = np.asarray(Image.fromarray((rng.random((S // 8 + 1, S // 8 + 1)) * 255).astype(np.uint8)).resize((S, S), Image.BICUBIC)).astype(np.float32) / 255
    bl = [l for f in gj(f'ne_{L["res"]}_admin_0_boundary_lines_land')['features'] for l in lines(f['geometry'])]
    rv = [l for f in gj(f'ne_{L["res"]}_rivers_lake_centerlines')['features'] if f['properties'].get('scalerank', 9) <= (6 if name == 'w' else 9) for l in lines(f['geometry'])] if L['rw'] else []
    for t, c in TH.items():
        C = lambda q: np.array(c[q], np.float32)
        img = C('land')[None, None] * (1 - noise[..., None] * .5) + C('land2')[None, None] * (noise[..., None] * .5)
        img = img * (1 - veg[..., None] * .75) + C('veg')[None, None] * veg[..., None] * .75
        img = img * (1 - ice[..., None] * .8) + C('ice')[None, None] * ice[..., None] * .8
        s = (rel - .7)[..., None]
        img = np.where(s < 0, img * (1 + s * 1.1) + C('shade') * (-s * .4), img + (C('hi') - img) * s * .9)
        edge = np.asarray(Image.fromarray((wat * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))).astype(np.float32) / 255 - wat
        water = C('water')[None, None] * (1 - deep[..., None]) + C('deep')[None, None] * deep[..., None]
        img = img * (1 - wat[..., None]) + water * wat[..., None]
        img = img * (1 - edge[..., None] * .7) + C('shore')[None, None] * edge[..., None] * .7
        im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)); dr = ImageDraw.Draw(im)
        for l in rv: dr.line([P(*q[:2]) for q in l], fill=c['river'], width=max(1, round(L['rw'])))
        for l in bl: pts = [P(*q[:2]) for q in l]; dr.line(pts, fill=c['bglow'], width=round(L['bw'] * 3)) if t == 'dark' else None
        im = Image.blend(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), im, .55) if t == 'dark' else im; dr = ImageDraw.Draw(im)
        for l in rv: dr.line([P(*q[:2]) for q in l], fill=c['river'], width=max(1, round(L['rw'])))
        for l in bl: dr.line([P(*q[:2]) for q in l], fill=c['border'], width=max(1, round(L['bw'])))
        im.save(f'terrain/{name}_{t}.webp', quality=86, method=6)
    g = L['grid'] + 1; hg = np.asarray(Image.fromarray(np.maximum(h, 0).astype(np.float32)).resize((g, g), Image.BOX)).astype(np.float32)
    enc(hg).save(f'terrain/{name}_h.png', optimize=True)
    meta[name] = dict(m=[x0 / n, y0 / n, (L['tx'][1] + 1) / n, (L['ty'][1] + 1) / n], grid=L['grid'], hmax=float(hg.max()))
    print(name, S, 'mpp', round(mpp), 'hmax', round(float(hg.max())))
# الجبهة: نفس خرائط WM8 (المرسومة) + ارتفاع z10 بنفس الحدود + طرق وأنهار وحدود من mapdata
T = '../topdown'
bm = json.load(open(f'{T}/textures/basemap.json')); md = json.load(open(f'{T}/src/mapdata.json'))
REF = (31.45, 47.95); MPU = 40075016 * math.cos(math.radians(REF[0]))
b = bm['b']; m0 = (MX(REF[1]) + b[0] / MPU, MY(REF[0]) - b[1] / MPU, MX(REF[1]) + b[2] / MPU, MY(REF[0]) - b[3] / MPU)
z = 10; n = 2 ** z; tx = (int(m0[0] * n), int(m0[2] * n)); ty = (int(m0[1] * n), int(m0[3] * n))
dem = dec(np.asarray(grab(TERR, z, tx, ty, 'png')).astype(np.float64)); dem = np.maximum(dem, 0)
g = 513; hg = np.zeros((g, g), np.float32)
for j in range(g):
    my = m0[1] + (m0[3] - m0[1]) * j / (g - 1); py = (my * n - ty[0]) * 256
    for i in range(g):
        mx = m0[0] + (m0[2] - m0[0]) * i / (g - 1); px = (mx * n - tx[0]) * 256
        hg[j, i] = dem[min(dem.shape[0] - 1, int(py)), min(dem.shape[1] - 1, int(px))]
enc(hg).save('terrain/th_h.png', optimize=True)
for t, c in TH.items():
    im = Image.open(f'{T}/textures/map_{t}_1.webp').convert('RGB'); W, H = im.size; dr = ImageDraw.Draw(im)
    Q = lambda x, y: ((x - b[0]) / (b[2] - b[0]) * W, (b[1] - y) / (b[1] - b[3]) * H)
    pl = lambda p: [Q(p[i], p[i + 1]) for i in range(0, len(p) - 1, 2)]
    for r in md['roads']: dr.line(pl(r['p']), fill=c['road'], width=1)
    for r in md['rivers']: dr.line(pl(r['p']), fill=c['river'], width=2)
    for l in md['borders']: dr.line(pl(l), fill=c['bglow'] if t == 'dark' else c['border'], width=1)   # رفيعة: البكسل هنا 130 م
    im.save(f'terrain/th_{t}.webp', quality=86, method=6)
meta['th'] = dict(m=list(m0), grid=g - 1, hmax=float(hg.max()))
# المستوى الأدق «cl» فوق ساحة المعركة (البصرة ← شلامجة ← خرمشهر): ~16 م/بكسل، حدوده على شبكة الجبهة حتى ما يصير شق
cell = (m0[2] - m0[0]) / 256   # على شبكة الجبهة المرسومة (256، WM13.1) حتى ما يصير شق
snap = lambda v, o, up: m0[o] + (math.ceil if up else math.floor)((v - m0[o]) / cell) * cell
c0 = [snap(MX(47.55), 0, 0), snap(MY(30.72), 1, 0), snap(MX(48.25), 0, 1), snap(MY(30.30), 1, 1)]
z = 13; n = 2 ** z; tx = (int(c0[0] * n), int(c0[2] * n)); ty = (int(c0[1] * n), int(c0[3] * n))
sat = grab(EOX, z, tx, ty, 'jpg'); cw = 4096; ch_ = round(cw * (c0[3] - c0[1]) / (c0[2] - c0[0]))
crop = lambda im: im.crop(((c0[0] * n - tx[0]) * 256, (c0[1] * n - ty[0]) * 256, (c0[2] * n - tx[0]) * 256, (c0[3] * n - ty[0]) * 256))
sat = np.asarray(crop(sat).resize((cw, ch_), Image.BILINEAR)).astype(np.float32) / 255
z2 = 12; n2 = 2 ** z2; t2x = (int(c0[0] * n2), int(c0[2] * n2)); t2y = (int(c0[1] * n2), int(c0[3] * n2))
dem = dec(np.asarray(grab(TERR, z2, t2x, t2y, 'png')).astype(np.float64)); dem = np.maximum(dem, 0).astype(np.float32)
demi = Image.fromarray(dem).crop(((c0[0] * n2 - t2x[0]) * 256, (c0[1] * n2 - t2y[0]) * 256, (c0[2] * n2 - t2x[0]) * 256, (c0[3] * n2 - t2y[0]) * 256))
hl = np.asarray(demi.resize((cw, ch_), Image.BILINEAR)).astype(np.float32)
R_, G_, B_ = sat[..., 0], sat[..., 1], sat[..., 2]; lum = (R_ + G_ + B_) / 3
water = ((B_ > R_ * 1.02) & (lum < .42)) | ((B_ > R_ + .04) & (G_ > R_) & (lum < .5))
wat = np.asarray(Image.fromarray((water * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(.8))).astype(np.float32) / 255
veg = ((G_ > R_ * 1.03) & (G_ > B_ * 1.05) & (lum < .55)).astype(np.uint8) * 255
veg = np.asarray(Image.fromarray(veg).filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
mpp = 40075016 * (c0[2] - c0[0]) / cw
gy, gx = np.gradient(hl, mpp); az, alt = math.radians(315), math.radians(42)
slope = np.arctan(np.hypot(gx, gy) * 1.6 * 2); aspect = np.arctan2(-gx, gy)
rel = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1).astype(np.float32)
rng = np.random.default_rng(5); noise = np.asarray(Image.fromarray((rng.random((ch_ // 8 + 1, cw // 8 + 1)) * 255).astype(np.uint8)).resize((cw, ch_), Image.BICUBIC)).astype(np.float32) / 255
PX = lambda x, y: ((MX(REF[1]) + x / MPU - c0[0]) / (c0[2] - c0[0]) * cw, (MY(REF[0]) - y / MPU - c0[1]) / (c0[3] - c0[1]) * ch_)
plc = lambda p: [PX(p[i], p[i + 1]) for i in range(0, len(p) - 1, 2)]
for t, c in TH.items():
    C = lambda q: np.array(c[q], np.float32)
    img = C('land')[None, None] * (1 - noise[..., None] * .5) + C('land2')[None, None] * (noise[..., None] * .5)
    img = img * (1 - veg[..., None] * .75) + C('veg')[None, None] * veg[..., None] * .75
    sh = (rel - .7)[..., None]; img = np.where(sh < 0, img * (1 + sh * 1.1) + C('shade') * (-sh * .4), img + (C('hi') - img) * sh * .9)
    edge = np.asarray(Image.fromarray((wat * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))).astype(np.float32) / 255 - wat
    img = img * (1 - wat[..., None]) + C('water')[None, None] * wat[..., None]; img = img * (1 - edge[..., None] * .7) + C('shore')[None, None] * edge[..., None] * .7
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)); dr = ImageDraw.Draw(im)
    for r in md['roads']: dr.line(plc(r['p']), fill=c['road'], width=3)
    for r in md['rivers']: dr.line(plc(r['p']), fill=c['shore'], width=19, joint='curve')   # الأنهار (شط العرب ~350 م) ماء بعرضها
    for r in md['rivers']: dr.line(plc(r['p']), fill=c['water'], width=15, joint='curve')
    for l in md['borders']: dr.line(plc(l), fill=c['bglow'], width=5); dr.line(plc(l), fill=c['border'], width=2)
    im.save(f'terrain/cl_{t}.webp', quality=84, method=6)
g = 513; hg = np.asarray(demi.resize((g, g), Image.BILINEAR)).astype(np.float32); enc(hg).save('terrain/cl_h.png', optimize=True)
meta['cl'] = dict(m=c0, grid=512, hmax=float(hg.max())); print('cl', cw, ch_, 'mpp', round(mpp, 1))
json.dump(dict(levels=meta, ref=REF, mpu=MPU), open('terrain/levels.json', 'w'))
# الأسماء بالعربي: دول (مع مستوى الظهور) ومدن
labs = dict(countries=[], cities=[])
for f in gj('ne_50m_admin_0_countries')['features']:
    p = f['properties']
    if p.get('NAME_AR') and p.get('LABEL_X') is not None: labs['countries'].append(dict(n=p['NAME_AR'], lon=round(p['LABEL_X'], 3), lat=round(p['LABEL_Y'], 3), r=p.get('MIN_LABEL', 5), a3=p.get('ADM0_A3')))
me = LV['me']; mb = (me['tx'][0] / 128, me['ty'][0] / 128, (me['tx'][1] + 1) / 128, (me['ty'][1] + 1) / 128)
for f in gj('ne_50m_populated_places')['features']:
    p = f['properties']; lo, la = f['geometry']['coordinates'][:2]; inME = mb[0] <= MX(lo) <= mb[2] and mb[1] <= MY(la) <= mb[3]
    if p.get('NAME_AR') and (p['SCALERANK'] <= 2 or (inME and p['SCALERANK'] <= 6)): labs['cities'].append(dict(n=p['NAME_AR'], lon=round(lo, 3), lat=round(la, 3), r=p['SCALERANK'], cap=int(p.get('ADM0CAP') or 0), pop=p.get('POP_MAX', 0)))
json.dump(labs, open('labels/labels.json', 'w'), ensure_ascii=False)
print('labels', len(labs['countries']), len(labs['cities']))
