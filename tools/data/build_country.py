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
    s = re.sub(r'\[[^\]]*\]|\([^)]*\)', ' ', s)   # حواشي وأقواس (سنوات، طلبات)
    m = re.search(r'\d{1,3}(?:,\d{3})+(?!\d)|\d+', s)
    if not m: return None, None
    n = int(m.group(0).replace(',', ''))
    if 1900 <= n <= 2035 and not re.match(r'^\s*\d+\s*$', s): return None, None   # سنة مو عدد
    approx = bool(re.search(r'[~≈+]|approx|about|est', sl)) or '–' in s or '-' in s
    return n, 'ت' if approx else None

# ===== النوع =====
LAND = [(r'anti-tank|anti tank|atgm|tank destroyer|guided missile', 'atgm'), (r'main battle tank|light tank|\bmbt\b|(?<!anti-)(?<!anti )\btanks?\b', 'tank'), (r'infantry fighting|\bifv', 'ifv'), (r'self[- ]propelled (howitzer|gun|artillery|mortar)|spg|sph', 'spg'),
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
GEN = [(r'f-35|j-20|su-57|t-14|j-35|kf-21|f-22', 5), (r'archer|caesar|\bk9\b|pzh 2000|atmos|cv90|strf 90|patria amv|boxer|lynx|kf41|nh90|uh-60m|leopard 2a5|leopard 2a8|stridsvagn 122|f-16 block 7|f-16v|gripen e|m1a2|t-90m|t-72b3|su-34|himars|m270|zuzana 2|dita|vt-4|centauro ii|rch 155|j-10ce|m-346|fa-50|t-84 oplot|puma|ah-1z|h225m|aw101|mh-60r|lav 6|m777|k239|krab|rooivalk|piranha v|leclerc|t-80u|bmp-3|polonez|semser|arlan|t-90s', 4), (r't-90|m1a2|leopard 2a[67]|k2\b|merkava (mk ?)?iv|challenger 3|type 99a|altay|leclerc|rafale|typhoon|su-35|su-30|j-16|j-10c|f-15e|f-15ex|f-16v|f-16 block (60|70|72)|gripen|f/a-18e|kaan|zulfiqar|bmp-3|puma|cv90|k21|ah-64e|mi-28|ka-52|t129|bayraktar|tb2|akinci|wing loong|ch-5|mq-9|s-400|patriot|thaad', 4),
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
BAD_SEC = r'non-commissioned|support|ready reserve|reserve fleet|under construction|history|histor|1990|gulf war|losses|personnel|infantry weapons|protective|radar|former|retired|small arms|commander|rank|future|order|procurement|historic|museum|captured'
for f in sorted(glob.glob(f'{R}/raw/wiki/{ID}_*.json')):
    d = json.load(open(f)); sk = wsrc(f, d); kind = os.path.basename(f)[4:-5]
    for t in d['tables']:
        if re.search(BAD_SEC, t['sec'].lower()): continue
        H = t['hdr']; col = lambda *ks: next((i for k in ks for i, h in enumerate(H) if k in h and 'name' not in h and 'pennant' not in h and 'hull' not in h), None)
        ci_n = next((i for k in ('class', 'model', 'name', 'aircraft', 'system', 'vehicle', 'type') for i, h in enumerate(H) if h.startswith(k)), next((i for i, h in enumerate(H) if h not in ('image', 'picture', 'photo', 'images', '')), 0)); ci_o = col('origin', 'country', 'manufacturer'); ci_t = col('type', 'role'); ci_q = col('in service', 'quantity', 'number in service', 'number of', 'total', 'active', 'inventory', 'number', 'ships', 'units'); ci_v = col('variant')
        if ci_q is None:
            # قوائم سفن بلا عمود عدد: كل صف = سفينة، نجمعها حسب الفئة (class)
            ci_c = col('class')
            if kind != 'navy' or ci_c is None: continue
            agg = {}; ty = {}
            for r in t['rows']:
                if len(set(r)) == 1 or len(r) <= ci_c: continue
                k = re.sub(r'\s+', ' ', r[ci_c]).strip()
                if k: agg[k] = agg.get(k, 0) + 1; ty[k] = r[ci_t] if ci_t is not None and ci_t < len(r) else ''
            for k, n in agg.items():
                cc = cat_of(NAVY, ty.get(k, ''), t['sec'], k)
                if cc: navy.append({'m': k, 'n': n, 'orig': ID, 's': sk, 'c': 'ت', 'cat': cc, 'gen': gen_of(k)[0], 'note': 'عدد الصفوف بالقائمة'})
            continue
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
                cc = cat_of(LAND, typ, grp) or cat_of(LAND, t['sec'].split('/')[-1])
                if not cc: continue
                if cc == 'shorad' or re.search(LONG, name.lower()):
                    lvl = 'long' if re.search(SHORT_LONG['long'], name.lower()) else 'medium' if re.search(SHORT_LONG['medium'], name.lower()) else 'short'
                    it['cat'] = lvl; ad.append(it); continue
                if cc in ('srbm', 'cruise'): it['cat'] = cc; msl.append(it); continue
                it['cat'] = cc; land.append(it)

# ===== حدود معقولية: رقم أكبر = خطأ قراءة، ينشال ويطلع تحذير =====
CAP = {'tank': 15000, 'ifv': 25000, 'apc': 40000, 'mrap': 15000, 'spg': 8000, 'towed': 10000, 'mlrs': 5000, 'atgm': 20000, 'fighter': 1500, 'attack': 800, 'heli_attack': 1200, 'heli_util': 2500, 'transport': 800, 'trainer': 1500,
  'uav_isr': 5000, 'uav_strike': 5000, 'tanker': 300, 'awacs': 100, 'bomber': 300, 'isr': 500, 'long': 600, 'medium': 600, 'short': 5000, 'srbm': 3000, 'cruise': 3000}
for nm, L in (('land', land), ('air', air), ('ad', ad), ('msl', msl), ('navy', navy)):
    for x in L[:]:
        lim = CAP.get(x['cat'], 120)
        if x['n'] > lim: print(f"⚠️ {ID} {nm} {x['m'][:40]} = {x['n']} > {lim} (انشال)"); L.remove(x)
    # تكرار نفس الموديل من جدولين: خلي الأكبر
    seen = {}
    for x in L[:]:
        k = (x['cat'], re.sub(r'\W', '', x['m'].lower())[:24])
        if k in seen:
            y = seen[k]
            if x['n'] > y['n']: L.remove(y); seen[k] = x
            else: L.remove(x)
        else: seen[k] = x
land = [x for x in land if x['cat'] != 'atgm' or x['n'] <= 3000]

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

# ===== الأرقام الموحّدة (milsum، من IISS) =====
MS = json.load(open(f'{R}/world/milsum.json')); ms = MS['c'].get(ID)
if ms:
    for k, v in MS['src'].items(): src[k] = v
    V = lambda k, sk: {'v': ms[k], 's': sk, 'c': 'ت'} if ms.get(k) is not None else None
    sumo = {k: V(k, 'iiss_eq') for k in ('tanks', 'carriers', 'amphib', 'cruisers', 'destroyers', 'frigates', 'corvettes', 'subNuc', 'subs', 'combatAir', 'attackHeli', 'sats')}
    sumo.update({k: V(k, 'iiss_pers') for k in ('active', 'reserve', 'para')})
    sumo = {k: v for k, v in sumo.items() if v}
    for k, v in cur.get('sum', {}).items(): sumo[k] = v   # تصحيح بمصدر أحدث
else: sumo = cur.get('sum', {})

# ===== المالية العامة =====
FI = json.load(open(f'{R}/curation/fiscal.json')); src['imf25'] = FI['src']['imf25']

# ===== البنك الدولي =====
src['wb'] = {'t': 'World Bank WDI (SP.POP.TOTL, NY.GDP.MKTP.CD, NY.GDP.MKTP.KD.ZG, MS.MIL.XPND.CD/GD.ZS ← SIPRI, MS.MIL.TOTL.P1, FP.CPI.TOTL.ZG)', 'u': 'https://api.worldbank.org/v2/', 'y': 2026}
# ===== الحكم والقادة والعلاقات والصناعة والاستقرار (لكل الدول) =====
GV = json.load(open(f'{R}/curation/gov.json')); LD = json.load(open(f'{R}/world/leaders.json')); RL = json.load(open(f'{R}/world/rel.json')); TA = json.load(open(f'{R}/curation/tierA.json'))
BL = json.load(open(f'{R}/world/blocs.json')); CF = json.load(open(f'{R}/world/conflicts.json')); SN = json.load(open(f'{R}/world/sanctions.json'))
src['govt'] = GV['src']['govt']; src['leaders'] = LD['src']['leaders']; src.update(RL['src']); src['tierA'] = TA['src']['tierA']
gt, free = GV['c'][ID]; ld = LD['c'].get(ID, {})
gov = {'type': gt, 'ar': GV['types'][gt], 'free': free, 'hos': ld.get('hos'), 'hog': ld.get('hog'), 's': 'govt,leaders', 'c': 'ح', **(cur.get('gov') or {})}
gov.pop('head', None); gov.pop('v', None) if 'v' in gov and not isinstance(gov.get('v'), (int, float)) else None
if cur.get('gov', {}).get('v'): gov['desc'] = cur['gov']['v']
gov['s'] = 'govt,leaders'; gov['c'] = 'ح'
rel = {k: v[0] for k, v in RL['c'].get(ID, {}).items()}; rel.update(cur.get('relFix', {}))
ta = TA['c'].get(ID)
FACS = {'theo': ['clergy', 'irgc', 'army', 'street', 'biz'], 'amon': ['royal', 'army', 'clergy', 'street', 'biz'], 'one': ['party', 'army', 'street', 'biz'], 'mil': ['army', 'militia', 'street', 'biz'],
  'auth': ['army', 'security', 'street', 'biz'], 'trans': ['army', 'factions', 'street', 'biz'], 'cmon': ['army', 'parties', 'street', 'biz'], 'parl': ['army', 'parties', 'street', 'biz'], 'pres': ['army', 'parties', 'street', 'biz'], 'semi': ['army', 'parties', 'street', 'biz']}
war_home = [c['id'] for c in CF['conflicts'] if c['state'] == 'active' and (ID in c.get('b', []) or (ID in c.get('a', []) and not all(x in CL for x in c.get('b', []))))]
if ta and ta.get('tanksActive') is not None and sumo is not None:
    sumo['tanksActive'] = {'v': ta['tanksActive'], 's': 'tierA', 'c': 'ت', 'note': 'العاملة؛ الباقي من sum.tanks مخزون'}
    if sumo.get('tanks') and sumo['tanks']['v'] < ta['tanksActive']: sumo['tanks'] = dict(sumo['tanks'], v=ta['tanksActive'])
ind = cur.get('ind') or ({'tech': ta['tech'], 'makes': ta['makes'], 's': 'tierA', 'c': 'ت'} if ta else None)
stab0 = ta['stab'] if ta else max(15, min(80, 55 + 8 * free - 15 * len(war_home)))
pol = {'factions': (cur.get('pol') or {}).get('factions') or FACS[gt], 'stab': {'v': (cur.get('pol') or {}).get('stab', {}).get('v', stab0), 's': 'tierA' if ta else 'govt', 'c': 'ت'}, 'warHome': war_home}
if ta and ta.get('ins'): pol['insurgency'] = ta['ins']
treaties = sorted({k for k, b in BL['blocs'].items() if ID in b['m']} | set(cur.get('treaties', [])) | {f"PACT_{p['b'] if p['a'] == ID else p['a']}" for p in BL['pacts'] if ID in (p['a'], p['b'])})
sanct = [{'by': x['by'], 'level': x['level'], 'ar': x['ar']} for x in SN['list'] if x['on'] == ID]
confl = [c['id'] for c in CF['conflicts'] if ID in c.get('a', []) + c.get('b', []) + c.get('hit', [])]

W = lambda k, f=1, nd=None: ({'v': round(WB[k]['v'] * f, nd) if nd is not None else WB[k]['v'] * f, 'y': WB[k]['y'], 's': 'wb', 'c': 'ح'} if k in WB else None)
out = {'id': ID, 'ar': CL[ID]['ar'], 'en': CL[ID]['en'], 'tier': CL[ID]['tier'], 'asOf': '2026-11', 'src': src,
  'gov': gov, 'pop': cur.get('pop') or W('pop', 1, 0),
  'eco': {k: v for k, v in {'gdpBusd': W('gdp', 1e-9, 1), 'growth': W('growth', 1, 1), 'infl': W('infl', 1, 1), 'oilRentPct': W('oilrent', 1, 1),
     'debtPct': ({'v': FI['debt'][ID], 'y': 2025, 's': 'imf25', 'c': 'ت'} if ID in FI['debt'] else W('debt', 1, 1) or {'v': 55, 's': 'imf25', 'c': 'ق', 'note': 'افتراض'}),
     'revPct': W('rev', 1, 1), 'spendPct': W('spend', 1, 1), 'expPct': W('exp', 1, 1), **cur.get('eco', {})}.items() if v},
  'mil': {k: v for k, v in {'budgetBusd': W('milx', 1e-9, 2), 'budgetPctGdp': W('milpct', 1, 2), 'personnelWB': W('troops', 1, 0), 'sum': sumo or None, **cur.get('mil', {}), 'land': land, 'air': air, 'ad': ad, 'msl': msl, 'navy': navy}.items() if v is not None},
  'ind': ind, 'pol': pol, 'rel': rel, 'treaties': treaties, 'sanctions': sanct, 'conflicts': confl, 'notes': cur.get('notes', '')}
# ===== ملخص بالفئات (W4): المجموع، الجيل الغالب، وأهم 3 موديلات — لكل الدول؛ درجة ج بلا قوائم تاخذ قالب منطقتها =====
ME_IDS = {'IRQ', 'IRN', 'SYR', 'JOR', 'LBN', 'ISR', 'PSX', 'SAU', 'ARE', 'QAT', 'KWT', 'BHR', 'OMN', 'YEM', 'TUR', 'EGY', 'LBY', 'TUN', 'DZA', 'MAR', 'AFG'}
reg = 'me' if ID in ME_IDS else {'af': 'af', 'eu': 'eu', 'as': 'as', 'na': 'la', 'sa': 'la', 'oc': 'as'}[CL[ID]['cont']]
if ID in ('USA', 'CAN'): reg = 'eu'
TPL = {   # قوالب تقريبية لما ما عدنا قائمة (ق): الموديلات الشائعة بكل منطقة
  'af': {'tank': (1.4, ['T-55', 'T-54', 'Type 59']), 'afv': (1.6, ['BTR-60', 'BRDM-2', 'Panhard AML']), 'art': (1.8, ['D-30', 'BM-21 Grad', 'M-46']), 'jet': (1.6, ['MiG-21', 'Su-25', 'L-39']), 'heli': (2, ['Mi-24', 'Mi-8/17'])},
  'me': {'tank': (2, ['T-62', 'T-55', 'M60']), 'afv': (2, ['BMP-1', 'M113', 'BTR-60']), 'art': (2, ['D-30', 'M109', 'BM-21 Grad']), 'jet': (2.2, ['MiG-29', 'F-5', 'Mirage F1']), 'heli': (2.2, ['Mi-24', 'Mi-8/17', 'Bell 412'])},
  'eu': {'tank': (2.6, ['T-72', 'Leopard 1', 'Leopard 2A4']), 'afv': (2.4, ['BMP-2', 'M113', 'Patria AMV']), 'art': (2.4, ['2S1', 'M109', 'D-30']), 'jet': (2.8, ['F-16', 'MiG-29', 'Gripen']), 'heli': (2.6, ['Mi-24', 'AW139', 'UH-60'])},
  'as': {'tank': (1.8, ['Type 59', 'T-55', 'T-72']), 'afv': (1.8, ['M113', 'BTR-70', 'Type 63']), 'art': (1.8, ['M101', 'D-30', 'Type 54']), 'jet': (2, ['F-5', 'MiG-21', 'F-7']), 'heli': (2, ['Mi-8/17', 'Bell 412', 'UH-1'])},
  'la': {'tank': (1.6, ['AMX-13', 'M41', 'T-55']), 'afv': (1.8, ['M113', 'EE-11 Urutu', 'BTR-80']), 'art': (1.8, ['M101', 'M114', 'OTO Melara Mod 56']), 'jet': (1.8, ['A-29 Super Tucano', 'F-5', 'Mirage 5']), 'heli': (2, ['Bell 412', 'UH-1H', 'Mi-17'])}}[reg]
_M = json.load(open(f'{R}/curation/models.json')); MD = _M['c'].get(ID, {}); MDS = _M['src']['mdl']
GR = {'tank': (land, ('tank',)), 'afv': (land, ('ifv', 'apc', 'mrap')), 'art': (land, ('spg', 'towed', 'mlrs')), 'jet': (air, ('fighter', 'attack', 'bomber')), 'heli': (air, ('heli_attack', 'heli_util')),
  'uav': (air, ('uav_isr', 'uav_strike')), 'ad': (ad, ('long', 'medium', 'short')), 'navy': (navy, None)}
sv0 = lambda k: (sumo.get(k) or {}).get('v') if sumo else None
OFF = {'tank': sv0('tanksActive') or sv0('tanks'), 'jet': sv0('combatAir'), 'navy': sum(sv0(k) or 0 for k in ('carriers', 'cruisers', 'destroyers', 'frigates', 'corvettes', 'subNuc', 'subs', 'amphib')) or None}
grp = {}
for g, (L, cats) in GR.items():
    its = [x for x in L if cats is None or x['cat'] in cats]; nP = sum(x['n'] for x in its)
    top = sorted(its, key=lambda x: -x['n'])[:3]
    gen = round(sum(x['n'] * x['gen'] for x in its) / nP, 1) if nP else None
    n, sk, cf = OFF.get(g), 'iiss_eq', 'ت'
    if n is None and nP: n, sk, cf = nP, its[0]['s'], 'ت'
    if n is None and g in TPL and OFF.get('tank'):   # تقدير من الدبابات (نسب شائعة) [ق]
        n, sk, cf = round(OFF['tank'] * {'afv': 2.5, 'art': .9, 'heli': .25}.get(g, 0)) or None, 'tpl', 'ق'
    if not n and not nP: continue
    o = {'n': n or 0, 's': sk, 'c': cf}
    if top: o['top'] = [[x['m'][:40], x['n'], x['gen'], x['orig']] for x in top]; o['gen'] = gen
    elif MD.get(g): o['top'] = [[m, None, gen_of(m)[0], None] for m in MD[g][:4]]; o['gen'] = round(sum(gen_of(m)[0] for m in MD[g][:3]) / min(3, len(MD[g])), 1); o['mdl'] = 1; src['mdl'] = MDS
    elif g in TPL: o['top'] = [[m, None, None, None] for m in TPL[g][1]]; o['gen'] = TPL[g][0]; o['tpl'] = reg
    if nP and n and abs(nP - n) / max(n, 1) > .6: o['note'] = f'مجموع القوائم {nP} يختلف عن الإجمالي؛ الإجمالي هو المعتمد'
    grp[g] = o
src['tpl'] = {'t': f'قالب منطقة ({reg}): موديلات شائعة ونسب تقريبية من الدبابات (مدرعات ×2.5، مدفعية ×0.9، مروحيات ×0.25) — تقدير المصمم', 'u': 'docs/features/world-plan.md', 'y': 2026}
out['mil']['grp'] = grp
json.dump(out, open(f'{R}/countries/{ID}.json', 'w'), ensure_ascii=False, indent=1)
tot = lambda L, *cs: sum(x['n'] for x in L if not cs or x['cat'] in cs)
sv = lambda k: (sumo.get(k) or {}).get('v', '-')
print(f"{ID} [موحّد: دبابات {sv('tanks')} · طائرات قتال {sv('combatAir')} · عامل {sv('active')}]  [موديلات: دبابات {tot(land,'tank')} · مدرعات {tot(land,'ifv','apc','mrap')} · مدفعية {tot(land,'spg','towed','mlrs')} · مقاتلات/هجوم {tot(air,'fighter','attack')} · مروحيات {tot(air,'heli_attack','heli_util')} · مسيّرات {tot(air,'uav_isr','uav_strike')} · دفاع جوي {len(ad)} نوع · بحرية {tot(navy)} · بنود {len(land)+len(air)+len(ad)+len(navy)+len(msl)}")
if SHOW:
    for nm, L in (('land', land), ('air', air), ('ad', ad), ('msl', msl), ('navy', navy)):
        for x in L: print(f"  {nm:5} {x['cat']:11} {x['n']:>6} g{x['gen']} {x['orig']:4} {x['c']} {x['m'][:45]}")
