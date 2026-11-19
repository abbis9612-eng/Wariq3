# أسماء الدول بالإنكليزي ← رموزنا (مشترك بين أدوات البيانات)
import json, re, os, unicodedata
R = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
CL = json.load(open(f'{R}/world/countries.json'))
ALIAS = {'united states': 'USA', 'russia': 'RUS', 'china': 'CHN', "people's republic of china": 'CHN', 'south korea': 'KOR', 'north korea': 'PRK', 'iran': 'IRN', 'syria': 'SYR', 'taiwan': 'TWN',
  'united kingdom': 'GBR', 'vietnam': 'VNM', 'laos': 'LAO', 'bolivia': 'BOL', 'venezuela': 'VEN', 'tanzania': 'TZA', 'czech republic': 'CZE', 'czechia': 'CZE', 'democratic republic of the congo': 'COD',
  'dr congo': 'COD', 'congo democratic republic of the': 'COD', 'congo republic of the': 'COG', 'republic of the congo': 'COG', 'congo': 'COG', 'ivory coast': 'CIV', "côte d'ivoire": 'CIV', 'moldova': 'MDA', 'turkey': 'TUR', 'türkiye': 'TUR', 'north macedonia': 'MKD', 'macedonia': 'MKD',
  'eswatini': 'SWZ', 'swaziland': 'SWZ', 'gambia': 'GMB', 'the gambia': 'GMB', 'bahamas': 'BHS', 'myanmar': 'MMR', 'brunei': 'BRN', 'east timor': 'TLS', 'timor-leste': 'TLS',
  'cape verde': 'CPV', 'bosnia and herzegovina': 'BIH', 'central african republic': 'CAF', 'dominican republic': 'DOM', 'united arab emirates': 'ARE', 'papua new guinea': 'PNG', 'kyrgyzstan': 'KGZ', "democratic people's republic of korea": 'PRK', 'republic of korea': 'KOR', 'republic of china': 'TWN', 'equatorial guinea': 'GNQ', 'palestine': 'PSX', 'state of palestine': 'PSX', 'south sudan': 'SDS'}
def key(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'\[.*?\]|\(.*?\)', '', s); return re.sub(r'[^a-z\' -]', '', s).strip()
IDX = {key(c['en']): c['id'] for c in CL}; IDX.update({key(k): v for k, v in ALIAS.items()})
def cid(name):
    k = key(name)
    if k in IDX: return IDX[k]
    for kk, v in IDX.items():
        if k.startswith(kk) and len(kk) > 4: return v
