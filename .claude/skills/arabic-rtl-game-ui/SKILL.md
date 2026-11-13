---
name: arabic-rtl-game-ui
description: >
  Arabic-first, right-to-left game UI and writing rules for this game: layout mirroring, Arabic
  typography, numbers and units, bidi pitfalls in DOM and canvas, and the in-game voice (Iraqi
  dialect). Use for any UI text, new screen, tooltip, report line, event text or font change.
---

# Arabic RTL game UI

## Voice and copy

- In-game voice: **Iraqi Arabic dialect** for advisor/report lines and buttons (ماكو، تگدر، هسه،
  شغّال), already used throughout; Modern Standard Arabic only for official documents (treaty text,
  news headlines). Never mix within one sentence.
- Keep the established vocabulary: نقاط القرار، الاستقرار، مؤشر الخوف، الفئات، عملية عسكرية.
  New terms go into a glossary table in `docs/GDD.md` before use.
- Buttons are verbs in the imperative (أعلن، وقّع، اطلب). Report lines are past tense + cause
  ("التضخم وصل ٩٪ بسبب الدين والعجز").
- Months use the Levantine/Iraqi names already in `MONTHS` (كانون الثاني ...).

## Layout

- `<html lang="ar" dir="rtl">`; use logical CSS properties only (`margin-inline-start`,
  `inset-inline-end`, `padding-inline`, `text-align:start`). Never `left/right` for layout.
- Directional icons (arrows, "next" chevrons, progress) mirror in RTL; clocks, charts' time axes
  and media controls do not. The power chart currently uses `scaleX(-1)`: keep time flowing
  right→left consistently across all charts.
- Numbers, currency and Latin weapon names (F-16, T-90) are LTR islands: wrap mixed runs in
  `<bdi>` or `dir="ltr"` spans to stop punctuation jumping.

## Numbers

- Pick one digit system per surface and keep it: the game uses Western digits (`toLocaleString('en')`)
  with Arabic units (مليار، ترليون، ٪). Keep that; don't mix Eastern-Arabic digits into data cells.
- Signs: use the true minus `−` (U+2212) as the code already does in `fmtM`.
- Percent: `٪` after the number.

## Typography

- Fonts: Reem Kufi (display/headings) + IBM Plex Sans Arabic (body). For offline/app builds,
  self-host subsets (woff2) and declare `font-display: swap`.
- Minimum body 14 px on phones, 12 px for secondary text; line-height ≥ 1.5 (Arabic needs height
  for diacritics). Don't letter-space Arabic (breaks joining).
- Canvas text: set `ctx.direction = 'rtl'` and an Arabic-capable font explicitly; measure before
  drawing labels; wait for `document.fonts.ready` before the first map draw.

## Checks

- Screenshot every changed screen at 390×844 and 360×740 in dark and light themes.
- Search the diff for `left:|right:|margin-left|padding-right|text-align:left` → replace with logical.
- Read every new string aloud in the dialect; if it sounds like a translation, rewrite it.
