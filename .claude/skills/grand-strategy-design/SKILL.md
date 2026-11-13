---
name: grand-strategy-design
description: >
  Systems-design know-how for turn-based geopolitical / grand-strategy games (country management,
  economy, diplomacy, war, AI nations, events). Use when designing or changing any game system,
  mechanic, number, event, AI behavior, win/lose condition or progression in this game, or when
  judging whether a feature idea is good. Not for code structure (see CLAUDE.md) or pure UI layout
  (`game-ui-ux`).
---

# Grand-strategy systems design

A grand-strategy game is a web of feedback loops the player steers with a few levers per turn.
It is fun when every decision is a **visible trade-off** whose **consequences the player can trace**
and when the world **pushes back** as the player grows. Most failures come from hidden causality,
dominant strategies and a dead late game.

## Pillars for this game (check every idea against them)

1. **Real stakes, real world.** Real countries, plausible numbers, real geography. Fiction is
   allowed only where it serves play (custom weapons, a unified state).
2. **Every month is a decision.** A month with nothing worth deciding is a design bug. Decision
   points (AP) are scarce on purpose; never add a free action that removes a trade-off.
3. **Cause → effect is readable.** Every number that moves can answer "why?" in one tap.
4. **Power has a price.** Expansion raises fear, coalitions, war-weariness, debt, occupation cost.
5. **Short sessions, long campaign.** One month plays in under a minute on a phone; a campaign
   spans years.

## Design workflow

1. **State the player decision** the feature creates: what they give up, what they get, when it
   pays off. No real decision → it is flavor, not a mechanic. Keep it, but cheap.
2. **Map the loop.** Draw the variables it touches and the sign of each arrow. Label every loop
   reinforcing (R: snowball) or balancing (B: brake). Each R loop needs a B loop that grows with it.
3. **Find the counter-play.** Who/what in the world reacts (AI states, factions, markets)? A
   mechanic with no counter becomes the dominant strategy.
4. **Set numbers with units and a target.** "Peace in 5-10 months for evenly matched wars", not
   "wars end eventually". Mark guesses `[ASSUMPTION]` and tune with the headless sim (`strategy-balance`).
5. **Design the explanation** at the same time: the tooltip/report line that tells the player
   what happened and why. If you can't write that line, the mechanic is too opaque.
6. **Check the extremes**: turn 1, a tiny state (Lebanon), a superpower (US/China), at war on 3
   fronts, 0 AP, bankrupt, after a nuclear exchange, year 2050.

## Proven patterns

- **Diminishing returns** on any stat the player can pour money into (sqrt/log curves, caps).
- **Rubber-banding by the world, not by cheating**: fear → coalitions, overextension → unrest,
  occupation → resistance, dominance → sanctions. The brake must be explained to the player.
- **Telegraph before punishing**: warnings N turns before coup/revolution/bankruptcy (already
  in the game; keep this pattern for every new lose condition).
- **Late-game scenarios**: escalating world events (crises, pandemics, climate shocks, rival
  superpower blocs) so the last third has new problems, not just bigger numbers.
- **Asymmetric starts**: each country needs a distinct opening problem and opportunity
  (Iraq: oil + fragile stability; Turkey: straits + NATO; Saudi: money, no manpower).
- **Events with choices** beat events without: 2-3 options, each with a cost; avoid an obvious
  best option. Use pre-conditions so events fit the situation.
- **Fog of war as gameplay**: estimates (`est()`) improved by intel investment; never show
  exact enemy numbers for free.
- **AI nations** decide with utility scoring over a few drives (security, greed, ideology,
  survival), with personality weights per country and hysteresis so they don't flip-flop.
  See `ai-behavior-trees-utility-ai`. The AI must obey the same rules as the player, or the
  difference must be a deliberate, documented difficulty knob.

## Anti-patterns (reject or redesign)

- A new resource that only gates one thing (pure friction).
- Bigger number = strictly better (no trade-off): every upgrade costs upkeep, risk or opportunity.
- Random events that wreck the player with no warning or counter.
- Systems the player can't see: if it matters, it is in a report line, a tooltip or a bar.
- Micromanagement that scales with empire size: automate or aggregate as the player grows.
- Win conditions reachable by one exploit (e.g. a degenerate unify/union chain).

## Review checklist for a feature idea

| Question | Pass when |
|---|---|
| Decision? | The player gives something up to use it |
| Loop | Its R loop has a matching B loop |
| Counter | AI/world reacts to it |
| Readable | One report line explains each effect |
| Numbers | Units + target + `[ASSUMPTION]` marks |
| Extremes | Survives tiny/huge country, war, bankrupt, late game |
| Phone | Usable one-handed in ≤ 3 taps from the main screen |
| Save | State change has a migration |
