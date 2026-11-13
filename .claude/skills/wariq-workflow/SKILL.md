---
name: wariq-workflow
description: >
  The mandatory change protocol for the WW3 grand-strategy game in this repo. Use at the start of
  every session and for EVERY change request, new idea, tweak, bug report or "change X" message
  from the user, however small. Keeps docs/PLAN.md, docs/IDEAS.md, CHANGELOG.md and git history in
  step so no change or idea is ever lost. Arabic triggers: غيّر، ضيف، شيل، فكرة، عدّل، صلّح، ليش.
---

# Wariq workflow (change protocol)

The owner changes their mind often and adds ideas constantly. The protocol below makes every idea
traceable, every change reversible, and the plan always current. Never skip a step.

## Session start (always)

1. Read `CLAUDE.md`, then `docs/PLAN.md` (current phase + next tasks), the top of `CHANGELOG.md`,
   and the open items in `docs/IDEAS.md`.
2. `git status` + `git log --oneline -10`. Uncommitted work from a previous session is reported to
   the user before anything else.
3. Work on the designated branch; never rewrite pushed history.

## Every user message that asks for something

1. **Capture first.** Add each distinct idea to `docs/IDEAS.md` as `I-NNN` (next free number, never
   reused) with date, the user's words (short, Arabic as given), status `new`.
2. **Triage.** Decide: fits the current phase → `accepted`, link it to a PLAN task; belongs later →
   `planned` + phase; conflicts with a pillar or an earlier decision → say so plainly to the user,
   propose an alternative, and log the outcome in `docs/DECISIONS.md`. Never silently drop an idea.
3. **If it changes the plan**, edit `docs/PLAN.md` in place (small edit) and add a line to the
   plan's change log. The plan is a living document, not a contract with the past; but leaving
   the plan without recording why is forbidden.
4. **Implement** in the smallest coherent step. One idea → one commit when possible.
5. **Verify** (see below). A change is not done until verified.
6. **Record**: `CHANGELOG.md` entry under `[Unreleased]` (Arabic, player-facing wording), IDEAS status
   → `done` with the commit hash, GDD/feature doc updated if a rule or number changed (one fact,
   one home: numbers live in `docs/features/<slug>/design.md` or the code constant it names).
7. **Commit + push**: message `type(scope): summary` + `Refs: I-NNN` (types: feat, fix, balance,
   ui, perf, docs, refactor, chore). Push to the session branch.

## Verification checklist (pick what applies)

- Game boots with no console errors (headless Chromium via Playwright: load `index.html`, start a
  new game, advance 24 months, open every tab and sheet, run one battle; fail on `pageerror`).
- Old save still loads (save version bumped + migration added if the state shape changed).
- Balance-sensitive change → run the headless simulation (`strategy-balance` skill) before/after.
- UI change → screenshot at 390×844 (phone) and 360×740 in both dark and light, RTL intact.
- Performance-sensitive change → frame time on the map and battle screens (`performance-optimization`).

## Rules that never bend

- `archive/v0.1.0-original.html` is frozen. Never edit it.
- Never delete an idea, a decision or a changelog line; mark it `rejected`/`superseded` instead.
- Never break the player's save: bump `SAVE_VERSION` and add a migration for any state change.
- Tag releases `vX.Y.Z` (semver: Z = fixes/balance, Y = features, X = big overhauls).
- If the request is ambiguous in a way that changes what you'd build, ask one short question with
  options and a recommendation. Otherwise act and state the assumption.
- Report honestly: what was verified, what wasn't, and what needs the owner's phone to check.
