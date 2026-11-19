# يبني data/countries/XXX.json من: جداول ويكيبيديا (data/raw/wiki/XXX_*.json) + البنك الدولي (data/raw/worldbank.json)
# + التصحيح اليدوي (data/curation/XXX.json: نظام الحكم، العلاقات، الاتفاقيات، تصحيح الأرقام بمصادر ثانية، إضافات).
# python3 -I tools/data/build_country.py IRQ [--show]
import sys, json, re, glob, os
ID = sys.argv[1]; SHOW = '--show' in sys.argv
R = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
CL = {c['id']: c for c in json.load(open(f'{R}/world/countries.json'))}
WB = json.load(open(f'{R}/raw/worldbank.json')).get(ID, {})
cur = json.load(open(f'{R}/curation/{ID}.json')) if os.path.exists(f'{R}/curation/{ID}.json') else {}

# ===== أسماء الدول ← رموز =====
ORIG = {c['en'].lower(): k for k, c in CL.items()}
ORIG.update({'united states': 'USA', 'usa': 'USA', 'us': 'USA', 'soviet union': 'SUN', 'ussr': 'SUN', 'russia': 'RUS', 'russian federation': 'RUS', 'west germany': 'DEU', 'east germany': 'GDR', 'germany': 'DEU',
  'czechoslovakia': 'CSK', 'czech republic': 'CZE', 'czechia': 'CZE', 'yugoslavia': 'YUG', 'united kingdom': 'GBR', 'uk': 'GBR', 'south korea': 'KOR', 'republic of korea': 'KOR', 'north korea': 'PRK',
  'china': 'CHN', "people's republic of china": 'CHN', 'taiwan': 'TWN', 'iran': 'IRN', 'turkey': 'TUR', 'türkiye': 'TUR', 'netherlands': 'NLD', 'brazil': 'BRA', 'israel': 'ISR', 'france': 'FRA', 'italy': 'ITA',
  'spain': 'ESP', 'sweden': 'SWE', 'switzerland': 'CHE', 'ukraine': 'UKR', 'belarus': 'BLR', 'poland': 'POL', 'serbia': 'SRB', 'pakistan': 'PAK', 'india': 'IND', 'japan': 'JPN', 'canada': 'CAN', 'austria': 'AUT',
  'finland': 'FIN', 'norway': 'NOR', 'south africa': 'ZAF', 'egypt': 'EGY', 'jordan': 'JOR', 'iraq': 'IRQ', 'saudi arabia': 'SAU', 'united arab emirates': 'ARE', 'uae': 'ARE', 'australia': 'AUS', 'singapore': 'SGP',
  'belgium': 'BEL', 'romania': 'ROU', 'bulgaria': 'BGR', 'hungary': 'HUN', 'slovakia': 'SVK', 'greece': 'GRC', 'portugal': 'PRT', 'denmark': 'DNK', 'indonesia': 'IDN', 'argentina': 'ARG', 'chile': 'CHL', 'georgia': 'GEO'})
def orig(t):
    t = (t or '').lower().replace('\xa0', ' ')
    best = None
    for k, v in ORIG.items():
        i = t.find(k)
        if i >= 0 and (best is None or i < best[0] or (i == best[0] and len(k) > len(best[1]))): best = (i, k, v)
    return best[2] if best else None

# ===== العدد =====
def qty(s):
    s = (s or '').replace('\xa0', ' ').strip(); sl = s.lower()
    if not s or any(w in sl for w in ('unknown', 'n/a', 'classified', 'on order', 'planned', 'retired')): return None, None
    if 'dozen' in sl: return 24, 'ت'
    m = re.search(r'(\d[\d,]*)', s)
    if not m: return None, None
    n = int(m.group(1).replace(',', ''))
    approx = bool(re.search(r'[~≈+]|approx|about|est', sl)) or '–' in s or '-' in s
    return n, 'ت' if approx else None

# ===== النوع =====
LAND = [(r'main battle tank|light tank|\btank\b', 'tank'), (r'infantry fighting', 'ifv'), (r'self[- ]propelled (howitzer|gun|artillery|mortar)|spg|sph', 'spg'),
  (r'multiple rocket|mlrs|rocket launcher|rocket artillery', 'mlrs'), (r'howitzer|field gun|gun-howitzer|towed', 'towed'), (r'anti-aircraft|surface-to-air|\bsam\b|air defen|spaag|anti aircraft', 'shorad'),
  (r'mrap|mine.resistant', 'mrap'), (r'armou?red personnel|\bapc\b|infantry mobility|armou?red (vehicle|car)|reconnaissance vehicle|scout|protected', 'apc'), (r'anti-tank|atgm|tank destroyer', 'atgm'),
  (r'ballistic missile|\bsrbm\b|\bmrbm\b|tactical missile', 'srbm'), (r'cruise missile', 'cruise')]
AIR = [(r'unmanned combat|ucav|attack drone|loitering', 'uav_strike'), (r'unmanned|uav|drone|\brpa', 'uav_isr'), (r'(heli|rotor).*(attack|anti-armou?r|gunship|close air)|(attack|anti-armou?r|gunship|close air).*(heli|rotor)', 'heli_attack'),
  (r'heli|rotor', 'heli_util'), (r'tanker|refuel', 'tanker'), (r'early warning|aew|awacs', 'awacs'), (r'bomber', 'bomber'),
  (r'multirole|fighter|interceptor|air superiority', 'fighter'), (r'attack|strike|cas|close air', 'attack'), (r'trainer|training', 'trainer'), (r'transport|airlift|cargo|vip|utility|liaison', 'transport'),
  (r'surveillance|reconnaissance|patrol|sigint|elint|isr', 'isr')]
NAVY = [(r'aircraft carrier|carrier', 'carrier'), (r'destroyer', 'destroyer'), (r'frigate', 'frigate'), (r'corvette', 'corvette'), (r'nuclear.*submarine|ssbn|ssn', 'sub_nuc'), (r'submarine', 'sub'),
  (r'missile boat|fast attack|attack craft', 'missile_boat'), (r'landing|amphib|ldp|lst|lpd|lhd', 'amphib'), (r'patrol|offshore|coast', 'patrol')]
SKIP = r'recovery|truck|utility vehicle|transporter|ambulance|engineer|bridg|tractor|radar|rifle|pistol|handgun|machine gun|grenade|mortar$|supply|support vessel|tug|survey|rhib|inflatable|training ship|yacht|light utility vehicle|tanker truck|fuel'
LONG = r'patriot|s-300|s-400|s-500|thaad|samp|aster 30|bavar|hq-9|hq-22|david|arrow|kn-06|nasams|iris-t slm|cheongung|km-sam|hawk|buk|s-125|s-75|s-200|kub|hq-16|khordad|sayyad|akash|barak|spyder'
SHORT_LONG = {'long': r'patriot|s-300|s-400|s-500|thaad|samp|bavar|hq-9|arrow|s-200|s-75|kn-06|david', 'medium': r'hawk|buk|s-125|kub|hq-16|hq-22|khordad|km-sam|nasams|iris-t slm|cheongung|akash|barak|spyder|kvadrat|sa-6|sa-11'}
def cat_of(rules, *txt):
    t = ' '.join(x or '' for x in txt).lower()
    for rx, c in rules:
        if re.search(rx, t): return c
    return None

# ===== الجيل 1–5 (تقدير حسب الموديل) =====
GEN = [(r'f-35|j-20|su-57|t-14|j-35|kf-21|f-22', 5), (r't-90|m1a2|leopard 2a[67]|k2\b|merkava (mk ?)?iv|challenger 3|type 99a|altay|leclerc|rafale|typhoon|su-35|su-30|j-16|j-10c|f-15e|f-15ex|f-16v|f-16 block (60|70|72)|gripen|f/a-18e|kaan|zulfiqar|bmp-3|puma|cv90|k21|ah-64e|mi-28|ka-52|t129|bayraktar|tb2|akinci|wing loong|ch-5|mq-9|s-400|patriot|thaad', 4),
  (r't-72|t-80|m1a1|m1\b|leopard 2|merkava|challenger|type 96|chieftain|mig-29|su-27|su-24|su-25|f-16|f-15|f/a-18|f-18|f-14|mirage 2000|j-10|jf-17|bmp-2|m2 bradley|warrior|marder|btr-80|btr-4|vn22|ah-64|mi-35|mi-24|s-300|pantsir|tor|hq-9|t-50|l-159|ch-4|karrar', 3),
  (r't-62|t-64|m60|amx-30|mig-23|mig-25|mirage f1|f-4|f-5|su-22|bmp-1|btr-70|btr-60|m113|amx-10|hawk|buk|kub|s-125|m109|m198|2s1|2s3|bm-21|d-30|d-20|m-46|type 63|mi-8|mi-17|uh-1|bell 412|c-130|an-32|l-39', 2),
  (r't-55|t-54|type 59|type 69|mig-21|f-7|j-7|mig-19|j-6|s-75|sa-2|m48|centurion|pt-76', 1)]
def gen_of(m):
    t = m.lower()
    for rx, g in GEN:
        if re.search(rx, t): return g, 'ت'
    return 2, 'ق'

src = {}; land = []; air = []; ad = []; navy = []; msl = []
def wsrc(f, d):
    k = 'wiki_' + os.path.basename(f)[4:-5]
    src[k] = {'t': 'Wikipedia: ' + d['title'], 'u': d['url'] + (f"?oldid={d['revid']}" if d.get('revid') else ''), 'y': 2026, 'note': 'نسخة الصفحة بتاريخ السحب؛ أرقام ويكيبيديا تنراجع ويا مصادر ثانية'}
    return k
BAD_SEC = r'history|histor|1990|gulf war|losses|personnel|infantry weapons|protective|radar|former|retired|small arms|commander|rank|future|order|procurement|historic|museum|captured'
for f in sorted(glob.glob(f'{R}/raw/wiki/{ID}_*.json')):
    d = json.load(open(f)); sk = wsrc(f, d); kind = os.path.basename(f)[4:-5]
    for t in d['tables']:
        if re.search(BAD_SEC, t['sec'].lower()): continue
        H = t['hdr']; col = lambda *ks: next((i for k in ks for i, h in enumerate(H) if k in h and 'name' not in h and 'pennant' not in h), None)
        ci_n = 0; ci_o = col('origin', 'country', 'manufacturer'); ci_t = col('type', 'role'); ci_q = col('in service', 'quantity', 'number of', 'total', 'active', 'inventory', 'number'); ci_v = col('variant')
        if ci_q is None: continue
        grp = ''
        for r in t['rows']:
            if len(set(r)) == 1: grp = r[0]; continue
            if len(r) <= ci_q: continue
            name = re.sub(r'\s+', ' ', r[ci_n]).strip(); typ = r[ci_t] if ci_t is not None and ci_t < len(r) else ''
            tl = (typ + ' ' + grp).lower()
            if not name or re.search(r'transporter|recovery|truck|tractor', typ.lower()) or (re.search(SKIP, tl) and not re.search(r'main battle|fighting|self-propelled|attack', typ.lower())): continue
            if name in ('N/A', '-', '—'): name = 'محلي (بلا اسم)'
            n, c = qty(r[ci_q])
            if not n: continue
            o = orig(r[ci_o]) if ci_o is not None and ci_o < len(r) else None
            note = (r[col('notes')] if col('notes') is not None and col('notes') < len(r) else '')[:140]
            var = r[ci_v] if ci_v is not None and ci_v < len(r) else ''
            it = {'m': name + (f' ({var})' if var and var not in name else ''), 'n': n, 'orig': o or 'INT', 's': sk, 'c': c or 'ت'}
            if note: it['note'] = note
            g, gc = gen_of(it['m']); it['gen'] = g
            if kind in ('air', 'aviation'):
                cc = cat_of(AIR, typ + ' ' + grp + (' heli' if re.search(r'^(mil |bell|eurocopter|aérospatiale|aerospatiale|h2\d\d|sikorsky|agusta|ah-|uh-|ch-47|ka-|mi-)', name.lower()) else ''))
                if not cc: continue
                it['cat'] = cc; air.append(it)
            elif kind == 'navy':
                cc = cat_of(NAVY, typ, grp, name)
                if not cc: continue
                it['cat'] = cc; navy.append(it)
            else:
                if 'aviation' in t['sec'].lower() or 'helicopter' in (typ + grp).lower() or 'unmanned' in (typ + grp).lower():
                    cc = cat_of(AIR, typ + ' ' + grp + (' heli' if 'helicopter' in grp.lower() else ''))
                    if cc: it['cat'] = cc; air.append(it)
                    continue
                cc = cat_of(LAND, typ, grp)
                if not cc: continue
                if cc == 'shorad' or re.search(LONG, name.lower()):
                    lvl = 'long' if re.search(SHORT_LONG['long'], name.lower()) else 'medium' if re.search(SHORT_LONG['medium'], name.lower()) else 'short'
                    it['cat'] = lvl; ad.append(it); continue
                if cc in ('srbm', 'cruise'): it['cat'] = cc; msl.append(it); continue
                it['cat'] = cc; land.append(it)

# ===== التصحيح اليدوي =====
src.update(cur.get('src', {}))
for o in cur.get('fix', []):   # {"in": "land", "match": "M1A1", "n":…, "s":…, "c":…, "note":…} أو "drop": true
    L = {'land': land, 'air': air, 'ad': ad, 'navy': navy, 'msl': msl}[o['in']]
    hit = [x for x in L if re.search(o['match'], x['m'], re.I)]
    if not hit: print('⚠️ ما لكيت', o['match'], 'بـ', o['in']); continue
    for x in hit:
        if o.get('drop'): L.remove(x); continue
        for k in ('n', 's', 'c', 'note', 'cat', 'gen', 'orig', 'm'):
            if k in o: x[k] = o[k]
for o in cur.get('add', []): {'land': land, 'air': air, 'ad': ad, 'navy': navy, 'msl': msl}[o.pop('in')].append(o)

# ===== البنك الدولي =====
src['wb'] = {'t': 'World Bank WDI (SP.POP.TOTL, NY.GDP.MKTP.CD, NY.GDP.MKTP.KD.ZG, MS.MIL.XPND.CD/GD.ZS ← SIPRI, MS.MIL.TOTL.P1, FP.CPI.TOTL.ZG)', 'u': 'https://api.worldbank.org/v2/', 'y': 2026}
W = lambda k, f=1, nd=None: ({'v': round(WB[k]['v'] * f, nd) if nd is not None else WB[k]['v'] * f, 'y': WB[k]['y'], 's': 'wb', 'c': 'ح'} if k in WB else None)
out = {'id': ID, 'ar': CL[ID]['ar'], 'en': CL[ID]['en'], 'tier': CL[ID]['tier'], 'asOf': '2026-11', 'src': src,
  'gov': cur.get('gov'), 'pop': W('pop', 1, 0),
  'eco': {k: v for k, v in {'gdpBusd': W('gdp', 1e-9, 1), 'growth': W('growth', 1, 1), 'infl': W('infl', 1, 1), 'oilRentPct': W('oilrent', 1, 1), **cur.get('eco', {})}.items() if v},
  'mil': {k: v for k, v in {'budgetBusd': W('milx', 1e-9, 2), 'budgetPctGdp': W('milpct', 1, 2), 'personnelWB': W('troops', 1, 0), **cur.get('mil', {}), 'land': land, 'air': air, 'ad': ad, 'msl': msl, 'navy': navy}.items() if v is not None},
  'ind': cur.get('ind'), 'pol': cur.get('pol'), 'rel': cur.get('rel', {}), 'treaties': cur.get('treaties', []), 'sanctions': cur.get('sanctions', []), 'conflicts': cur.get('conflicts', []), 'notes': cur.get('notes', '')}
json.dump(out, open(f'{R}/countries/{ID}.json', 'w'), ensure_ascii=False, indent=1)
tot = lambda L, *cs: sum(x['n'] for x in L if not cs or x['cat'] in cs)
print(f"{ID}: دبابات {tot(land,'tank')} · مدرعات {tot(land,'ifv','apc','mrap')} · مدفعية {tot(land,'spg','towed','mlrs')} · مقاتلات/هجوم {tot(air,'fighter','attack')} · مروحيات {tot(air,'heli_attack','heli_util')} · مسيّرات {tot(air,'uav_isr','uav_strike')} · دفاع جوي {len(ad)} نوع · بحرية {tot(navy)} · بنود {len(land)+len(air)+len(ad)+len(navy)+len(msl)}")
if SHOW:
    for nm, L in (('land', land), ('air', air), ('ad', ad), ('msl', msl), ('navy', navy)):
        for x in L: print(f"  {nm:5} {x['cat']:11} {x['n']:>6} g{x['gen']} {x['orig']:4} {x['c']} {x['m'][:45]}")
