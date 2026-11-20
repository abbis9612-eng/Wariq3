# يدوّر صفحات معدات الجيش/القوة الجوية/البحرية لدول درجة ب وج ببحث ويكيبيديا (صفحة البحث العادية)، ويسحب جداولها.
#   python3 -I tools/data/find_pages.py   ← tools/data/pages_bc.json + data/raw/wiki/XXX_{army,air,navy}.json  (يكمل من وين وقف، ثانيتين بين الطلبات)
import json, os, re, time, subprocess, sys, urllib.request, urllib.parse, html as H
B = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(B, '..', '..', 'data')
UA = {'User-Agent': 'WariqGameData/1.0 (offline game research script)'}
FIX = {'Dem. Rep. Congo': 'Democratic Republic of the Congo', 'Central African Rep.': 'Central African Republic', 'Bosnia and Herz.': 'Bosnia and Herzegovina', 'Eq. Guinea': 'Equatorial Guinea',
  'S. Sudan': 'South Sudan', 'Dominican Rep.': 'Dominican Republic', 'eSwatini': 'Eswatini', 'Congo': 'Republic of the Congo', "Côte d'Ivoire": 'Ivory Coast'}
CL = [c for c in json.load(open(f'{R}/world/countries.json')) if c['tier'] in ('B', 'C')]
OUT = f'{B}/pages_bc.json'; P = json.load(open(OUT)) if os.path.exists(OUT) else {}
def search(q):
    u = 'https://en.wikipedia.org/w/index.php?' + urllib.parse.urlencode({'search': q, 'title': 'Special:Search', 'profile': 'advanced', 'fulltext': 1, 'ns0': 1})
    h = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read().decode('utf8'); time.sleep(2)
    return [H.unescape(t) for t in re.findall(r'mw-search-result-heading"><a href="/wiki/[^"]+" title="([^"]+)"', h)]
KIND = {'army': (r'equipment|Army|Armed Forces|Defence Force|Defense Force|Military of|Land Forces|Ground Forces', '{} army equipment'),
        'air': (r'Air Force|Air Corps|Aviation|aircraft', '{} air force aircraft'), 'navy': (r'Navy|Naval|Coast Guard', '{} navy ships')}
for c in CL:
    en = FIX.get(c['en'], c['en']); stem = en.split(' ')[-1] if en.startswith('Republic of the') else en
    P.setdefault(c['id'], {})
    for k, (rx, q) in KIND.items():
        if k in P[c['id']]: continue
        try: res = search(q.format(en))
        except Exception as e: print('خطأ بحث', c['id'], k, e); continue
        pick = next((t for t in res if stem.split(' ')[0] in t and re.search(rx, t)), None)
        P[c['id']][k] = pick; json.dump(P, open(OUT, 'w'), ensure_ascii=False, indent=0)
        if pick and not os.path.exists(f'{R}/raw/wiki/{c["id"]}_{k}.json'):
            subprocess.run([sys.executable, '-I', f'{B}/wiki_tables.py', pick.replace(' ', '_'), f'{R}/raw/wiki/{c["id"]}_{k}.json'], timeout=120); time.sleep(2)
        print(c['id'], k, pick, flush=True)
print('خلص', sum(1 for v in P.values() for x in v.values() if x), 'صفحة')
