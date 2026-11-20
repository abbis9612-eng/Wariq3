# أسماء القادة بالعربي: من صفحة «List of current heads of state and government» ناخذ رابط كل قائد، ومن صفحته بويكيبيديا الإنكليزية ناخذ رابط اللغة العربية (hreflang="ar").
# python3 -I tools/data/leaders_ar.py   ← data/world/leaders_ar.json  (يتوقف ثانيتين بين الصفحات؛ يكمل من وين وقف)
import json, re, os, time, urllib.request, urllib.parse, html as H
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data'); OUT = f'{R}/world/leaders_ar.json'
UA = {'User-Agent': 'WariqGameData/1.0 (offline game research script)'}
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read().decode('utf8')
LD = json.load(open(f'{R}/world/leaders.json'))['c']
names = {h['name'] for d in LD.values() for h in (d['hos'], d.get('hog')) if h}
page = get('https://en.wikipedia.org/wiki/List_of_current_heads_of_state_and_government')
links = {}
for href, txt in re.findall(r'<a [^>]*?href="(?:https://en\.wikipedia\.org)?/wiki/([^"#:]+)"[^>]*>([^<]+)</a>', page):
    t = H.unescape(txt).strip()
    if t in names and t not in links: links[t] = href
out = json.load(open(OUT)) if os.path.exists(OUT) else {}
print('قادة', len(names), '· روابط', len(links), '· موجود', len(out))
for n, href in sorted(links.items()):
    if out.get(n): continue
    try:
        p = get('https://en.wikipedia.org/wiki/' + urllib.parse.quote(urllib.parse.unquote(href), safe='/()%,\'!'))
        m = re.search(r'<a href="https://ar\.wikipedia\.org/wiki/([^"]+)"[^>]*hreflang="ar"', p) or re.search(r'hreflang="ar"[^>]*href="https://ar\.wikipedia\.org/wiki/([^"]+)"', p)
        out[n] = H.unescape(urllib.parse.unquote(m.group(1))).replace('_', ' ') if m else None
    except Exception as e: out[n] = None; print('خطأ', n, e)
    json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=0); time.sleep(2)
print('عربي', sum(1 for v in out.values() if v), '/', len(out), '· بلا رابط:', sorted(names - set(links))[:30])
