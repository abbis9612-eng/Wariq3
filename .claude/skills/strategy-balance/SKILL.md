---
name: strategy-balance
description: >
  Balance a turn-based strategy game by measurement: headless Monte-Carlo simulation of many
  campaigns, faucet/sink maps for money and resources, outlier and dominant-strategy detection.
  Use when tuning numbers, after any change to economy/war/AI/diplomacy formulas, or when the
  owner says something is "too easy", "too hard", "broken" or "always happens". Ideas adapted from
  the MIT-licensed balance-check skill (Claude-Code-Game-Studios, Donchitos).
---

# Strategy balance

Never tune by feel alone. Every balance change ships with before/after numbers from the sim.

## Inputs (check they exist; if not, say "NOT ASSESSED — NO DATA" instead of guessing)

- The simulation core (pure functions, no DOM) — in this repo the `S` state + `nextMonth()` loop.
- Targets: `docs/features/<slug>/design.md` "Numbers" tables and `docs/GDD.md` acceptance targets.
  A value with no stated target is listed as "no stated range — not judged", never as fine.

## Workflow

1. **Name the question** as a metric: "how often does the player go bankrupt by 2030 as Iraq on
   medium doing nothing?" → `P(bankrupt | IQ, mid, idle, 2030)`.
2. **Define bot players** (scripted policies) that cover the space:
   - `idle` — presses next month only (the floor; the game must not win itself).
   - `turtle` — max economy, no wars.
   - `warmonger` — attacks the weakest reachable neighbour whenever chance > 60%.
   - `greedy-exploit` — repeats whatever action gave the best power delta last month (finds
     dominant strategies automatically).
3. **Run N campaigns per (country × difficulty × bot)** headless with a seeded RNG (≥ 200 runs
   per cell for rates, fewer for smoke tests). Record per month: GDP, power rank, debt/GDP,
   stability, factions, wars, fear; and the end state (win/lose reason, month).
4. **Report** against targets:

```
## Balance report: <system> — <date> — commit <hash>
Runs: <N> per cell · seeds <range> · bots <list>
| Metric | Target | Before | After | Verdict |
|---|---|---|---|---|
Dominant strategies: <bot/action that beats all others, with numbers>
Dead zones: <months/systems where nothing changes>
Degenerate loops: <R loops with no brake>
Recommendations: <priority, change, expected effect>
```

5. **Change one knob at a time**, rerun, keep or revert on the numbers. Log meaningful tuning in
   `docs/DECISIONS.md` and the feature's History line.

## Starting targets for this game ([ASSUMPTION] until the owner confirms)

| Metric | Target |
|---|---|
| `idle` bot loses or ends "صمود/هزيمة" | ≥ 80% of runs (doing nothing must not win) |
| `turtle` bot (medium) rank change by end year | improves 1-5 places, rarely #1 |
| `warmonger` collapses (coup/revolution/bankrupt/fall) | 40-70% on medium |
| Any single action repeated beats all bots | never (that's a dominant strategy) |
| AI-vs-AI wars ending in peace within 24 months | 50-80% |
| Countries eliminated by AI by 2036 (no player action) | 0-4 |
| Month resolution time (desktop headless) | < 15 ms; < 50 ms on a mid phone |

## Detection rules

- **Outlier**: weapon `power/cost` more than 2× its category median → check (`pw(id)/WPN[id][3]`).
- **Dominant strategy**: a bot policy whose win rate is > 1.5× the next best in ≥ 3 countries.
- **Infinite loop**: a resource or relation that only rises across 120 months in > 90% of runs.
- **Dead zone**: ≥ 6 consecutive months where the `idle` bot's metrics move < 1%.
- **Unfair start**: a country whose `turtle` bot loses > 60% on medium needs a softer opening.

## Gotchas

- `Math.random` everywhere makes runs unreproducible: inject a seeded RNG before measuring.
- UI code mixed into simulation code blocks headless runs: keep the sim DOM-free.
- Averages hide disasters; report p10/p50/p90 and the failure reasons.
- A change that helps one country often breaks a tiny one: always include LB/YE/JO in the grid.
