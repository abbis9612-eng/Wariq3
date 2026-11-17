# أقنعة الأرض لمستوى «cl» (WM15.1، I-075): من صور Sentinel-2 cloudless (EOX، CC BY 4.0) المخزونة من world.py
#   R = خضرة (بساتين نخل)  ·  G = ماء  ·  B = عمران (بيوت)   ← terrain/cl_mask.png (~33 م/بكسل)
#   python3 tools/masks.py <مجلد كاش البلاطات>   (نفس كاش world.py)
import json, math, os, sys, numpy as np
from PIL import Image, ImageFilter
CACHE = sys.argv[1]
m = json.load(open('terrain/levels.json'))['levels']['cl']['m']
z = 13; n = 2 ** z; tx = (int(m[0] * n), int(m[2] * n)); ty = (int(m[1] * n), int(m[3] * n))
im = Image.new('RGB', ((tx[1] - tx[0] + 1) * 256, (ty[1] - ty[0] + 1) * 256))
for y in range(ty[0], ty[1] + 1):
    for x in range(tx[0], tx[1] + 1):
        f = f'{CACHE}/tiles.maps.eox.at_{z}_{y}_{x}.jpg'
        im.paste(Image.open(f).convert('RGB'), ((x - tx[0]) * 256, (y - ty[0]) * 256))
im = im.crop(((m[0] * n - tx[0]) * 256, (m[1] * n - ty[0]) * 256, (m[2] * n - tx[0]) * 256, (m[3] * n - ty[0]) * 256))
W = 2048; H = round(W * im.height / im.width)
full = np.asarray(im).astype(np.float32) / 255
R, G, B = full[..., 0], full[..., 1], full[..., 2]; lum = (R + G + B) / 3
# تباين محلي (خشونة): النخل والبيوت متخشنة، الماء والصحرا ناعمة
g = Image.fromarray((lum * 255).astype(np.uint8)); mean = np.asarray(g.filter(ImageFilter.BoxBlur(3))).astype(np.float32) / 255
rough = np.asarray(Image.fromarray((np.abs(lum - mean) * 255 * 6).clip(0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(3))).astype(np.float32) / 255
# الماء: ناعم وغامق (شط العرب زيتوني عكر، الأحواض خضرة)
water = (rough < .10) & (lum < .66) & ((np.abs(G - R) < .1) | (G > R + .08))
water = np.asarray(Image.fromarray((water * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))) > 127
# بعد كل نقطة عن الأنهار (mapdata: شط العرب، كارون...) بالبكسل
from PIL import ImageDraw
REF = (31.45, 47.95); MPU = 40075016 * math.cos(math.radians(REF[0]))
MX = lambda lo: (lo + 180) / 360; MY = lambda la: (1 - math.log(math.tan(math.pi / 4 + la * math.pi / 360)) / math.pi) / 2
md = json.load(open('../topdown/src/mapdata.json'))
PX = lambda x, y: ((MX(REF[1]) + x / MPU - m[0]) / (m[2] - m[0]) * im.width, (MY(REF[0]) - y / MPU - m[1]) / (m[3] - m[1]) * im.height)
mpp = 40075016 * math.cos(math.radians(30.5)) * (m[2] - m[0]) / im.width
rv = Image.new('L', im.size, 0); d = ImageDraw.Draw(rv)
for r in md['rivers']: p_ = r['p']; d.line([PX(p_[i], p_[i + 1]) for i in range(0, len(p_) - 1, 2)], fill=255, width=int(3600 / mpp), joint='curve')   # شريط ~1.8 كم كل جهة من النهر
near = np.asarray(rv) > 127
# النخل: قرب النهر، متخشن، مو ساطع (ظل السعف)، مو ماء
palm = near & (rough > .14) & (lum < .72) & ~water
# البيوت: جوّا المدن والقرى (مواقع حقيقية) ومو ماء؛ الكثافة من الخشونة
TOWNS = [('خرمشهر', 30.44, 48.17, 3200), ('شلامجة', 30.505, 48.01, 700), ('التنومة', 30.51, 47.865, 1700), ('البصرة', 30.515, 47.80, 5200), ('الصالحية', 30.48, 47.93, 500), ('أبو الخصيب', 30.45, 47.97, 900)]
tw = Image.new('L', im.size, 0); d = ImageDraw.Draw(tw)
for _, la, lo, r in TOWNS:
    cx, cy = PX(*[(MX(lo) - MX(REF[1])) * MPU, -(MY(la) - MY(REF[0])) * MPU]); rr = r / mpp; d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=255)
tw = np.asarray(tw.resize((tw.width // 8, tw.height // 8), Image.BILINEAR).filter(ImageFilter.GaussianBlur(3)).resize(tw.size, Image.BILINEAR)).astype(np.float32) / 255
built = (tw * np.clip(.35 + rough * 2.5, 0, 1)) * ~water
veg = palm
def out(a, blur):
    i = Image.fromarray((a * 255).astype(np.uint8)).resize((W, H), Image.BOX)
    return np.asarray(i.filter(ImageFilter.GaussianBlur(blur))).astype(np.uint8)
mask = np.stack([out(veg.astype(np.float32), .6), out(water.astype(np.float32), .4), out(np.clip(built, 0, 1), .8)], -1)
Image.fromarray(mask).save('terrain/cl_mask.png', optimize=True)
Image.fromarray(np.asarray(im.resize((W, H), Image.BILINEAR))).save(os.path.join(os.path.dirname(CACHE.rstrip('/')), 'cl_sat_preview.jpg'), quality=80)
print('cl_mask', W, H, 'm/px', round(40075016 * math.cos(math.radians(30.5)) * (m[2] - m[0]) / W, 1), 'veg%', round(veg.mean() * 100, 1), 'water%', round(water.mean() * 100, 1), 'built%', round(float((built > .4).mean()) * 100, 1))
