# يبني data/world/rel.json: علاقة كل دولة بكل دولة (−100..100) = قواعد (تكتلات، معاهدات، حروب، عقوبات، جوار تقريبي) + أزواج معروفة (data/curation/rel_known.json)
# python3 tools/data/build_rel.py
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from names import R, CL
ids = [c['id'] for c in CL]; S = set(ids)
B = json.load(open(f'{R}/world/blocs.json')); C = json.load(open(f'{R}/world/conflicts.json')); SA = json.load(open(f'{R}/world/sanctions.json')); K = json.load(open(f'{R}/curation/rel_known.json'))
M = {}; why = {}
def add(a, b, v, r):
    if a == b or a not in S or b not in S: return
    for x, y in ((a, b), (b, a)): M[(x, y)] = M.get((x, y), 0) + v; why.setdefault((x, y), []).append(r)
W = {'defense': 40, 'political': 10, 'economic': 15}
for k, bl in B['blocs'].items():
    w = 25 if k == 'EU' else W[bl['kind']]
    for i, a in enumerate(bl['m']):
        for b in bl['m'][i + 1:]: add(a, b, w, k)
for p in B['pacts']: add(p['a'], p['b'], 25 if p.get('kind') == 'partnership' else 50, 'معاهدة')
CW = {'active': -90, 'ceasefire_fragile': -80, 'tension': -50}
for c in C['conflicts']:
    for a in c.get('a', []):
        for b in c.get('b', []): add(a, b, CW.get(c['state'], -40), c['id'])
        for a2 in c.get('a', []):
            if a2 < a: add(a, a2, 15, c['id'] + ' (نفس الجبهة)')
    for h in c.get('hit', []):
        for b in c.get('b', []): add(h, b, -35, c['id'] + ' (انضربت)')
EU = B['blocs']['EU']['m']; LV = {'heavy': -40, 'medium': -25, 'light': -10}
for s in SA['list']:
    for by in s['by']:
        for x in (EU if by == 'EU' else [] if by == 'UN' else [by]): add(x, s['on'], LV[s['level']], 'عقوبات')
for a, b, v, r in K['pairs']:
    for x, y in ((a, b), (b, a)):
        if x in S and y in S: M[(x, y)] = v; why[(x, y)] = ['معروفة' + (': ' + r if r else '')]
out = {}
for (a, b), v in M.items():
    v = max(-100, min(100, round(v)))
    if v: out.setdefault(a, {})[b] = [v, '، '.join(why[(a, b)])[:80]]
res = {'src': {'rules': {'t': 'قواعد من blocs.json وconflicts.json وsanctions.json (تكتل دفاعي +40، معاهدة +50، حرب −90، عقوبات ثقيلة −40...)', 'u': 'data/world/', 'y': 2026}, **K['src']},
  'note': 'كل قيمة ت (تقدير). الأزواج الغير مذكورة = 0 (محايد).', 'c': {k: dict(sorted(out[k].items())) for k in sorted(out)}}
json.dump(res, open(f'{R}/world/rel.json', 'w'), ensure_ascii=False, indent=0)
n = sum(len(v) for v in out.values()); print('علاقات غير محايدة:', n, '· دول إلها علاقات:', len(out), '/ 157')
for a in ('IRQ', 'USA', 'IRN'):
    L = sorted(out[a].items(), key=lambda x: x[1][0]); print(a, 'أسوأ:', [(k, v[0]) for k, v in L[:5]], 'أحسن:', [(k, v[0]) for k, v in L[-5:]])
