# شكل بيانات «العالم» (GW12 W1)

كل رقم بالبيانات إله **مصدر** و**سنة** و**درجة ثقة**، حتى نعرف شنو حقيقي وشنو تقدير.
- **ح** = حقيقي: من مصدر معتبر، بالرقم.
- **ت** = تقدير: مصادر تختلف، أو رقم سري، أو محسوب.
- **ق** = قالب: درجة ج، مأخوذ من دول تشبهها، لحد ما ينبحث.

## `data/world/countries.json`
قائمة الـ157 دولة:
- **`id`:** رمز ISO-3 من Natural Earth؛
- **`ar` / `en`:** الاسم؛
- **`cont`:** القارة (af، as، eu، na، sa، oc)؛
- **`tier`:** درجة التفصيل (A ~30، B ~60، C ~67)؛
- **`base`:** السكان والناتج من Natural Earth (أساس مؤقت لحد ما يتبدّل بالبحث).

## `data/countries/XXX.json` (لكل دولة)
```json
{
  "id": "IRQ", "asOf": "2026-01",
  "src": { "sipri25": { "t": "SIPRI Military Expenditure Database 2025", "u": "https://…", "y": 2025 } },
  "gov": { "type": "parl|pres|monarchy|theocracy|military|oneparty|transition", "head": "رئيس الوزراء", "v": "…", "s": "…", "c": "ح" },
  "pop": { "v": 46000000, "s": "wb25", "c": "ح" },
  "eco": { "gdpBusd": {…}, "growth": {…}, "debtPct": {…}, "budgetBusd": {…}, "oilMbpd": {…}, "oilExpMbpd": {…}, "gasBcm": {…}, "exportRoutes": ["…"] },
  "mil": {
    "active": {…}, "reserve": {…}, "para": {…}, "budgetBusd": {…}, "budgetPctGdp": {…}, "conscription": true,
    "land": [ { "m": "M1A1M Abrams", "ar": "أبرامز M1A1", "cat": "tank|ifv|apc|spg|towed|mlrs|atgm|shorad", "n": 140, "gen": 3, "orig": "USA", "s": "…", "c": "ت" } ],
    "air":  [ { "m": "F-16IQ", "cat": "fighter|attack|bomber|transport|tanker|awacs|trainer|uav_isr|uav_strike|heli_attack|heli_util", "n": 34, "gen": 4, "orig": "USA", "base": "Balad", "s": "…", "c": "ح" } ],
    "ad":   [ { "m": "Pantsir-S1", "cat": "long|medium|short", "n": 24, "unit": "launcher|battery", "orig": "RUS", "s": "…", "c": "ت" } ],
    "msl":  [ { "m": "…", "cat": "srbm|mrbm|irbm|icbm|cruise|loitering", "rangeKm": 300, "n": 0, "s": "…", "c": "ت" } ],
    "navy": [ { "m": "…", "cat": "carrier|destroyer|frigate|corvette|sub|sub_nuc|patrol|missile_boat|amphib", "n": 0, "s": "…", "c": "ح" } ],
    "nuclear": { "warheads": 0, "doctrine": "…", "s": "…" },
    "bases": [ { "n": "Balad Air Base", "ll": [33.94, 44.36], "kind": "air|naval|army", "s": "…" } ],
    "foreignBases": [ { "who": "USA", "where": "…", "s": "…" } ]
  },
  "ind": { "tech": { "arm": 1, "uav": 1, "msl": 0, "ew": 0, "ind": 1 }, "makes": ["…"], "s": "…", "c": "ت" },
  "pol": { "factions": ["army", "street", "tribe", "mil", "biz"], "stab": { "v": 55, "c": "ت" }, "insurgency": "…" },
  "rel": { "USA": 30, "IRN": 40 },
  "treaties": ["ARABLEAGUE"],
  "sanctions": [],
  "conflicts": [],
  "notes": "…"
}
```
- `gen`: جيل السلاح من 1 (قديم كلش، مثل T-55 وميغ-21) لـ 5 (أحدث شي، مثل F-35 وT-14).
- `rel`: بس الدول المهمة؛ الباقي ينحسب من التكتلات والقرب.
- **ملفات العالم:** `blocs.json` (التكتلات والاتفاقيات)، `nuclear.json`، `sanctions.json`، `conflicts.json` (الحروب والنزاعات الجارية وخطوط السيطرة).

**الفحص:** `tests/data.test.mjs`:
- كل رقم بمصدر موجود بـ `src`؛
- النطاقات معقولة؛
- كل دولة درجة أ عندها ملف كامل.
