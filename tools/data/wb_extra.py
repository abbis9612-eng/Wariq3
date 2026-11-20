# يضيف لـ data/raw/worldbank.json: دين الحكومة، إيراداتها، مصاريفها (% من الناتج)، والصادرات (% من الناتج) — آخر قيمة 2015–2025.
#   curl "https://api.worldbank.org/v2/country/all/indicator/<IND>?format=json&per_page=20000&date=2015:2025" > <dir>/wb_<IND>.json
#   python3 -I tools/data/wb_extra.py <dir>
import json, os, sys
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'data'); D = sys.argv[1]
WB = json.load(open(f'{R}/raw/worldbank.json')); MAP = {'PSE': 'PSX', 'SSD': 'SDS'}
for k, ind in (('debt', 'GC.DOD.TOTL.GD.ZS'), ('rev', 'GC.REV.XGRT.GD.ZS'), ('spend', 'GC.XPN.TOTL.GD.ZS'), ('exp', 'NE.EXP.GNFS.ZS')):
    rows = json.load(open(f'{D}/wb_{ind}.json'))[1]; n = 0
    for r in rows:
        c = MAP.get(r['countryiso3code'], r['countryiso3code'])
        if c not in WB or r['value'] is None: continue
        y = int(r['date'])
        if k not in WB[c] or WB[c][k]['y'] < y: WB[c][k] = {'v': r['value'], 'y': y}; n += 1
    print(k, ind, 'دول', sum(1 for c in WB.values() if k in c))
json.dump(WB, open(f'{R}/raw/worldbank.json', 'w'), ensure_ascii=False, indent=0)
