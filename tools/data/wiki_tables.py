# يسحب جداول المعدات من صفحة ويكيبيديا (API: action=parse) ويطلع صفوف: القسم، الموديل، المنشأ، النوع، العدد، الملاحظة
# python3 -I tools/data/wiki_tables.py "Page_Title" [out.json]
import sys, json, re, urllib.request, urllib.parse, html
from html.parser import HTMLParser
title = sys.argv[1]
u = 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(title)
req = urllib.request.Request(u, headers={'User-Agent': 'WariqGameData/1.0 (offline game research script)'})
try: H = urllib.request.urlopen(req, timeout=60).read().decode('utf8')
except Exception as e: print(json.dumps({'error': str(e), 'title': title})); sys.exit(0)
m = re.search(r'"wgRevisionId":(\d+)', H); rev = int(m.group(1)) if m else None
m = re.search(r'"wgPageName":"([^"]+)"', H); real = (m.group(1) if m else title).replace('_', ' ')
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.sec = []; s.tables = []; s.tab = None; s.row = None; s.cell = None; s.inh = None; s.depth = 0; s.skip = 0
    def handle_starttag(s, t, a):
        a = dict(a)
        if t in ('h2', 'h3', 'h4'): s.inh = t; s.htxt = ''
        if t in ('sup', 'style'): s.skip += 1
        if t == 'table':
            s.depth += 1
            if s.depth == 1 and 'wikitable' in (a.get('class') or ''): s.tab = {'sec': ' / '.join(s.sec[-2:]), 'rows': []}
        if s.tab is not None and s.depth == 1:
            if t == 'tr': s.row = []
            if t in ('td', 'th') and s.row is not None: s.cell = {'t': '', 'h': t == 'th', 'span': int(re.sub(r'\D', '', a.get('rowspan') or '1') or 1), 'cs': int(re.sub(r'\D', '', a.get('colspan') or '1') or 1)}
            if t == 'br' and s.cell is not None: s.cell['t'] += ' '
    def handle_endtag(s, t):
        if t in ('sup', 'style'): s.skip = max(0, s.skip - 1)
        if t in ('h2', 'h3', 'h4') and s.inh:
            lvl = {'h2': 0, 'h3': 1, 'h4': 2}[t]; s.sec = s.sec[:lvl] + [s.htxt.strip()]; s.inh = None
        if s.tab is not None and s.depth == 1:
            if t in ('td', 'th') and s.cell is not None: s.cell['t'] = re.sub(r'\s+', ' ', s.cell['t']).strip(); s.row.append(s.cell); s.cell = None
            if t == 'tr' and s.row is not None: s.tab['rows'].append(s.row); s.row = None
        if t == 'table':
            if s.depth == 1 and s.tab is not None: s.tables.append(s.tab); s.tab = None
            s.depth -= 1
    def handle_data(s, x):
        if s.skip: return
        if s.inh: s.htxt += x
        if s.cell is not None: s.cell['t'] += x
p = P(); p.feed(H)
out = []
for tb in p.tables:
    rows = tb['rows']; 
    if not rows: continue
    hdr = [c['t'].lower() for c in rows[0]] if all(c['h'] for c in rows[0]) else []
    # إعادة بناء rowspan بسيطة
    grid = []; pend = {}
    for r in rows[1:] if hdr else rows:
        line = []; ci = 0; it = iter(r)
        while True:
            if ci in pend and pend[ci][1] > 0: line.append(pend[ci][0]); pend[ci][1] -= 1; ci += 1; continue
            c = next(it, None)
            if c is None: break
            for k in range(c['cs']):
                line.append(c['t'])
                if c['span'] > 1: pend[ci] = [c['t'], c['span'] - 1]
                ci += 1
        grid.append(line)
    out.append({'sec': tb['sec'], 'hdr': hdr, 'rows': grid})
res = {'title': real, 'revid': rev, 'url': 'https://en.wikipedia.org/wiki/' + real.replace(' ', '_'), 'tables': out}
if len(sys.argv) > 2: json.dump(res, open(sys.argv[2], 'w'), ensure_ascii=False)
print(json.dumps({'title': real, 'revid': rev, 'tables': len(out), 'secs': sorted(set(t['sec'] for t in out))[:40]}, ensure_ascii=False))
