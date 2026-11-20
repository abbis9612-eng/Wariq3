# يولّد docs/art/grok-prompts.md: نص طلب كامل مستقل لكل صورة (I-112، I-114)
# كل عنصر: وصف دقيق + ألوان وتمويه الدولة الحقيقية + لقطتين (A بطاقة، B من فوق) + اسم الملف.
# python3 tools/art/make_prompts.py
import os

STYLE = ("Photorealistic 3D render in the style of a high-end military simulation game asset, real materials "
  "(matte painted steel with slight dust and wear, rubber tyres, tinted glass). Pure flat white background (#FFFFFF), "
  "nothing else in the scene, no ground texture, no scenery, no people. No cast shadow on the background. "
  "Soft daylight from the top-left. One object only, centered, filling about 80% of the frame, fully visible, "
  "nothing cut off. Square 1024x1024. No text, no letters, no numbers, no logos, no watermark. "
  "Accurate to the real system: correct number of axles or road wheels, correct number of missile canisters, "
  "correct proportions; do not invent extra weapons.")
VIEW = {
  'A': "Camera: three-quarter view from the front-left, about 35 degrees above the ground (catalogue photo angle).",
  'B': "Camera: straight top-down view from directly above, no perspective tilt, the front of the object pointing to the RIGHT side of the image.",
}
# ألوان الدول (الطلاء الحقيقي)
C = {
  'TUR': "Turkish Land Forces paint: three-tone NATO-style woodland camouflage of olive green, dark brown and black in large irregular patches",
  'RUS3': "Russian army three-tone camouflage: Russian green base with large light-sand and black patches (the scheme seen on S-400 and Pantsir units)",
  'RUSG': "Russian army solid protective green (dark olive green), black rubber, no camouflage pattern",
  'USAT': "US Army CARC desert tan (sand) solid color, as deployed in the Middle East",
  'USAG': "US Army CARC NATO green solid color",
  'ISR': "Israel Defense Forces 'Sinai grey' paint: a solid greyish olive-sand color",
  'IRN': "Iranian army desert camouflage: sand-tan base with brown and dark khaki irregular stripes",
  'CHN': "Chinese PLA pixelated digital camouflage in greens: light green, dark green, brown and black small square pixels",
  'CHND': "Chinese PLA pixelated desert digital camouflage: sand, light brown and dark brown square pixels",
  'DEU': "German Bundeswehr three-tone NATO camouflage: dark green, leather brown and black",
  'GBR': "British Army solid NATO green",
  'NOR': "Norwegian army dark green with black disruptive patches",
  'KOR': "South Korean army four-tone woodland camouflage: green, dark brown, black and sand",
}
I = []   # (رقم، مفتاح ملف، الاسم، الوصف، اللون، اللقطات)
def add(key, name, desc, col, views='AB'): I.append((len(I) + 1, key, name, desc, col, views))
S1 = "PART 1 — AIR DEFENSE (shown in firing position: launcher raised, stabilizer legs lowered to the ground)"
add('siper', 'SIPER Block-1 long-range SAM launcher (Turkey, Aselsan/Roketsan)', "Heavy 8x8 military truck with a boxy armored cab. At the rear, a raised launcher holding 4 large rectangular missile canisters in a 2x2 block, elevated about 60 degrees toward the rear. Four hydraulic stabilizer legs on outrigger arms touching the ground.", C['TUR'])
add('hisar-o', 'HISAR-O+ medium-range SAM launcher (Turkey)', "6x6 military truck with a forward armored cab. At the rear, a raised launcher holding 6 rectangular missile canisters (2 rows of 3), elevated about 55 degrees toward the rear. Stabilizer legs down.", C['TUR'])
add('hisar-a', 'HISAR-A+ short-range SAM on the ACV-30 tracked vehicle (Turkey)', "Low tracked armored vehicle with 6 road wheels per side. A compact turret with 2 missiles on each side (4 in total), and a flat rotating search radar on top of the turret.", C['TUR'])
add('korkut', 'KORKUT 35 mm self-propelled anti-aircraft gun (Turkey)', "The same low ACV-30 tracked hull with 6 road wheels per side. The turret has two long 35 mm cannons side by side, and a rotating search radar on the turret rear.", C['TUR'])
add('s400', 'S-400 Triumf 5P85TE2 launcher (Russia)', "BAZ-64022 6x6 tractor truck pulling a semi-trailer. On the trailer, 4 long round missile tubes raised fully vertical (90 degrees). Stabilizer jacks down.", C['RUS3'])
add('s500', 'S-500 Prometey launcher (Russia)', "Very large MZKT 8x8 truck with 2 very large round missile tubes raised fully vertical. Stabilizer jacks down.", C['RUS3'])
add('patriot', 'Patriot PAC-3 M903 launcher (USA)', "M983 HEMTT 8x8 tractor pulling a semi-trailer with a box launcher of 4 large rectangular canisters, raised about 38 degrees and pointing to the rear. Leveling jacks down.", C['USAT'])
add('thaad', 'THAAD launcher (USA)', "Oshkosh M1120 HEMTT 8x8 truck with a box launcher holding 8 interceptor canisters (2 rows of 4), raised about 45 degrees and pointing to the rear.", C['USAT'])
add('arrow', 'Arrow 3 launcher (Israel)', "A truck towing a launcher trailer with 6 large round canisters in 2 rows of 3, raised about 65 degrees toward the rear.", C['ISR'])
add('dsling', "David's Sling launcher (Israel)", "8x8 heavy truck with a vertical box launcher made of 12 square cells (Stunner missiles), raised fully vertical.", C['ISR'])
add('idome', 'Iron Dome Tamir launcher (Israel)', "Towed launcher box on a small 2-axle trailer. The box is raised about 55 degrees, and its face shows 20 tube openings in a 4x5 grid.", C['ISR'])
add('bavar', 'Bavar-373 launcher (Iran)', "Iranian 6x6 heavy military truck with 4 large rectangular canisters raised fully vertical.", C['IRN'])
add('khordad', 'Khordad-15 launcher (Iran)', "Iranian 6x6 military truck with 4 rectangular canisters (Sayyad-3 missiles) in a 2x2 block, raised about 60 degrees.", C['IRN'])
add('hq9', 'HQ-9B launcher (China)', "Taian 8x8 heavy truck with 4 round missile canisters in a 2x2 block, raised fully vertical.", C['CHN'])
add('nasams', 'NASAMS launcher (Norway/USA)', "Towed launcher trailer with 6 AMRAAM canisters in 2 rows of 3, raised about 30 degrees.", C['NOR'])
add('irist', 'IRIS-T SLM launcher (Germany)', "MAN 6x6 military truck with 8 missile canisters in 2 rows of 4, raised fully vertical.", C['DEU'])
add('pantsir', 'Pantsir-S1 (Russia)', "KAMAZ 8x8 truck carrying a turret with 12 missile tubes (6 on each side), 2 twin 30 mm cannons, a rotating search radar on top and a tracking radar on the front of the turret.", C['RUS3'])
add('tor', 'Tor-M2 (Russia)', "Tracked vehicle with a large boxy turret holding vertical missiles, a flat search radar on top and a round tracking radar dish on the front of the turret.", C['RUSG'])
add('camm', 'Sky Sabre / CAMM launcher (UK)', "Military 6x6 truck with 8 vertical missile canisters in 2 rows of 4.", C['GBR'])
add('cheong', 'Cheongung-II KM-SAM launcher (South Korea)', "Military 6x6 truck with 8 vertical missile canisters in 2 rows of 4.", C['KOR'])
n1 = len(I)
S2 = "PART 2 — AIRCRAFT (in flight, landing gear up, no pilot visible through glare)"
AIRV = {'A': "Camera: three-quarter view from the front-left and slightly above the aircraft.", 'B': "Camera: straight top-down view from directly above, the nose pointing to the RIGHT side of the image, wings level."}
add('f35', 'F-35A Lightning II (USA)', "Single-engine stealth fighter.", "Real paint: radar-absorbent dark grey (FS 36170) with a slightly lighter grey edge treatment, small low-visibility grey markings only")
add('f22', 'F-22 Raptor (USA)', "Twin-engine stealth fighter with twin canted tails.", "Real paint: two-tone grey camouflage (FS 36170 and 36375) in a soft disruptive pattern")
add('f15', 'F-15E Strike Eagle (USA)', "Twin-engine, twin vertical tails, two-seat cockpit, conformal fuel tanks.", "Real paint: solid Dark Gunship Grey (FS 36118)")
add('f16', 'F-16C Fighting Falcon (USA)', "Single-engine fighter, bubble canopy.", "Real paint: two-tone light grey (FS 36270 and 36375)")
add('f18', 'F/A-18E Super Hornet (USA)', "Twin-engine, twin canted tails, rectangular intakes.", "Real paint: two-tone US Navy grey (FS 36320 and 36375)")
add('b1b', 'B-1B Lancer (USA)', "Swing-wing bomber with wings swept back, four engines in two pods under the wing roots.", "Real paint: solid Gunship Grey (FS 36081)")
add('rafale', 'Rafale (France)', "Delta wing with canards, twin engines, single tail.", "Real paint: French Air and Space Force medium grey with satin finish")
add('typhoon', 'Eurofighter Typhoon', "Delta wing with canards under the cockpit, twin engines, single tail, chin intake.", "Real paint: light air-superiority grey")
add('su35', 'Su-35S (Russia)', "Twin-engine Flanker, twin tails.", "Real paint: Russian two-tone grey-blue camouflage (light grey-blue and dark grey splinter pattern) with a light blue underside")
add('su34', 'Su-34 (Russia)', "Flanker-based strike fighter with a wide flat nose and side-by-side cockpit, twin tails.", "Real paint: Russian two-tone grey-blue 'sea' camouflage with light blue underside")
add('su57', 'Su-57 (Russia)', "Twin-engine stealth fighter with wide flat body and all-moving tails.", "Real paint: Russian grey-blue digital/splinter camouflage")
add('j20', 'J-20 (China)', "Large twin-engine stealth fighter with canards and long fuselage.", "Real paint: PLA Air Force dark grey stealth coating with lighter grey low-visibility markings")
add('mig29', 'MiG-29 (Iran)', "Twin-engine, twin tails, under-wing intakes.", "Real paint: Iranian Air Force two-tone grey camouflage")
add('f14', 'F-14A Tomcat (Iran)', "Swing-wing twin-engine fighter, twin tails, wings half swept.", "Real paint: Iranian Air Force 'Asia Minor' desert camouflage: sand, tan-brown and grey-green on top, light blue-grey underside")
add('su24', 'Su-24MK (Iran)', "Swing-wing two-seat attack jet, side-by-side cockpit.", "Real paint: Iranian desert camouflage (sand and brown) on top, light blue underside")
add('tb2', 'Bayraktar TB2 drone (Turkey)', "Medium-altitude drone with long straight wings, inverted-V tail, pusher propeller at the rear.", "Real paint: solid light grey")
add('shahed', 'Shahed-136 one-way attack drone (Iran)', "Small delta-wing drone with a pusher propeller and small vertical fins on the wing tips.", "Real paint: solid light grey", 'B')
n2 = len(I)
S3 = "PART 3 — SHIPS (no water: the ship alone on white, the full hull visible down to the keel, red anti-fouling paint below the waterline)"
SHV = {'A': "Camera: three-quarter view from the front-left and from above.", 'B': "Camera: straight top-down view from directly above, the bow pointing to the RIGHT side of the image."}
add('carrier', 'Nimitz-class aircraft carrier (USA)', "Flight deck with a few parked jets and helicopters, island superstructure on the starboard (right) side.", "Real paint: US Navy haze grey hull and superstructure, dark grey non-skid flight deck with white and yellow deck lines")
add('ddg', 'Arleigh Burke-class destroyer (USA)', "Angled superstructure with flat radar panels, a single gun on the bow, vertical launch cells.", "Real paint: US Navy haze grey")
add('frigate', 'Modern stealth frigate', "Angular stealthy superstructure, single mast, gun on the bow.", "Real paint: light naval grey")
add('sub', 'Virginia-class attack submarine at the surface', "Long black cylinder hull, conning tower (sail) visible.", "Real paint: anechoic black")
add('fac', 'Iranian fast attack missile boat', "Small fast boat with 4 anti-ship missile canisters on the rear deck.", "Real paint: grey with darker grey deck")
add('t055', 'Type 055 destroyer (China)', "Large destroyer with an integrated mast and flat radar panels.", "Real paint: PLA Navy light grey")
add('kirov', 'Kirov-class battlecruiser (Russia)', "Very large warship with tall superstructure, many missile hatches on the bow.", "Real paint: Russian Navy light grey with black boot-topping at the waterline")
n3 = len(I)
S4 = "PART 4 — TANKS AND ARMORED VEHICLES (turret facing forward)"
add('abrams', 'M1A2 SEPv3 Abrams (USA)', "Main battle tank with a long 120 mm gun and flat angular turret.", C['USAT'])
add('t90', 'T-90M (Russia)', "Main battle tank with reactive armor blocks on the turret and hull.", C['RUSG'])
add('t72', 'T-72B3 (Russia)', "Main battle tank with a rounded turret and reactive armor blocks.", C['RUSG'])
add('leopard', 'Leopard 2A7 (Germany)', "Main battle tank with a wedge-shaped turret front.", C['DEU'])
add('merkava', 'Merkava Mk4 (Israel)', "Main battle tank with a long wedge-shaped turret and engine at the front.", C['ISR'])
add('k2', 'K2 Black Panther (South Korea)', "Main battle tank with an angular turret.", C['KOR'])
add('altay', 'Altay (Turkey)', "Main battle tank with an angular modular-armor turret.", C['TUR'])
add('type99', 'Type 99A (China)', "Main battle tank with an arrow-shaped turret front.", C['CHN'])
add('bmp3', 'BMP-3 (Russia)', "Infantry fighting vehicle with a turret carrying a 100 mm gun and a 30 mm cannon.", C['RUSG'])
add('bradley', 'M2A4 Bradley (USA)', "Infantry fighting vehicle with a 25 mm cannon turret and a TOW launcher box on the side.", C['USAT'])
n4 = len(I)
S5 = "PART 5 — MISSILE LAUNCHERS (missile raised to fire)"
add('iskander', 'Iskander-M (Russia)', "MZKT 8x8 launcher with 2 ballistic missiles, one raised fully vertical.", C['RUS3'])
add('zolfaghar', 'Zolfaghar / Fateh launcher (Iran)', "6x6 military truck with 1 ballistic missile raised fully vertical.", C['IRN'])
add('himars', 'HIMARS (USA)', "FMTV 6x6 truck with a raised rocket pod at the rear.", C['USAT'])
add('df17', 'DF-17 (China)', "10x10 heavy launcher with 1 hypersonic missile (with a wedge-shaped glide vehicle on top) raised fully vertical.", C['CHN'])
add('shahed-l', 'Shahed-136 truck launcher (Iran)', "Truck with an angled launch rack holding 5 drones side by side.", C['IRN'], 'A')

def block(n, key, name, desc, col, views, vset):
    out = [f"### {n}. {name}\n"]
    for v in views:
        p = f"{name}. {desc} {col}. {vset[v]} {STYLE}"
        out.append(f"**{n}{v.lower()} — save as `{n:02d}{v.lower()}-{key}.jpg`**\n```\n{p}\n```\n")
    return '\n'.join(out)
H = """# طلبات الصور للعبة (لـ Grok) — كل الصور بنصوص كاملة

**للمالك:** انطي هذا الملف كله لـ Grok وقله:
> سوّي كل الصور اللي بهذا الملف، كل نص بصورة لحاله، بالترتيب، وسمّي كل صورة باسمها المكتوب فوق النص.

- كل نص **كامل لحاله**: بيه شكل المنظومة، **ألوان وتمويه الدولة الحقيقي**، اللقطة، والأسلوب. فتكدر تنسخ أي نص لحاله إذا Grok ما يقبل الملف كله.
- كل عنصر إله لقطتين: **A** مايلة من قدّام (للوحات)، و**B** من فوق ووجهها لليمين (للخريطة).
- إذا صورة طلعت غلط (العدد أو الشكل أو اللون)، اطلب يعيدها. وإذا يسوي نسختين، ابعثهن الثنتين.
- الصور الراجعة تنحط بـ [`out/`](out/) (I-113)، بالأسماء المكتوبة، وأنا أقصّها وأدخلها اللعبة.

**ألوان الدول المستعملة:** تركيا تمويه ثلاثي (زيتوني، بني، أسود) · روسيا أخضر ويا بقع رملي وأسود (S-400/بانتسير) أو أخضر سادة · أمريكا رملي (الشرق الأوسط) · إسرائيل «رمادي سيناء» · إيران رملي ويا خطوط بني · الصين تمويه رقمي مربعات · ألمانيا ثلاثي الناتو · بريطانيا أخضر سادة · كوريا تمويه رباعي · الطيارات والسفن بألوانها الرسمية (مكتوبة بكل نص).

---
"""
parts = [(S1, 0, n1, VIEW), (S2, n1, n2, AIRV), (S3, n2, n3, SHV), (S4, n3, n4, VIEW), (S5, n4, len(I), VIEW)]
body = []
for title, a, b, vs in parts:
    body.append(f"## {title}\n")
    for it in I[a:b]: body.append(block(*it, vs))
total = sum(len(it[5]) for it in I)
open(os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'art', 'grok-prompts.md'), 'w').write(H + f"**المجموع:** {len(I)} عنصر، {total} صورة.\n\n" + '\n'.join(body))
print(len(I), 'items', total, 'images')
