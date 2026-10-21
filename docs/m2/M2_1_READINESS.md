# M2-1 readiness — regional labelling reference values

**Status: the engineering implementation is complete on the M2-1 branch and
is DISABLED. Production activation, legal and clinical sign-off, merging and
deployment are not authorised.**

**Authorisation state**

| | |
|---|---|
| M2-0 | accepted, engineering level, at `ac637d5` |
| M2-1 | **engineering implementation complete on `feat/m2-regional-reference-values`, disabled.** Production activation not authorised. |
| M2-2 (ingestion) | not authorised |
| M2-3 (source-aware runtime) | not authorised |
| Merging, deploying, releasing | not authorised |

---

## 1. What is already in place

The reference-value tables are specified and tested in
`research/reference-values.ts` and `tests/m2-reference-values.test.ts`.
**Every table carries `approved: false`.** The module is not imported by `src/`
or `server/`, so it cannot reach a device build.

| Market | Instrument | Status |
|---|---|---|
| US | FDA Daily Values, 21 CFR 101.9 | specified, matches the app exactly |
| CA | Health Canada Nutrition Labelling Table of Daily Values (2022) | specified |
| GB | retained Regulation (EU) 1169/2011 Annex XIII | specified, **and the UK data itself is licence-blocked** |

The tables that are ready for the review gates:

- **United States** — every value matches the app's own `nutrientInfo` table
  key by key, including the nutrients the app deliberately leaves without a
  value. Switching the app onto this table changes nothing.
- **Canada** — the adult columns, with the corrected 3400 mg potassium, and
  with the saturated-fat percentage deliberately unavailable.
- **United Kingdom** — the adult annex values, with the salt/sodium and
  folate-basis distinctions, and with fibre and cholesterol deliberately
  absent.

## 2. What is blocked, and by what

| Blocker | Gate | Owner |
|---|---|---|
| The app may not reproduce the Canadian or British values | legal confirmation of the instrument and the reproduction right per market | legal |
| The app may show a labelling percentage as a consumer statement | clinical confirmation of the age scope and the wording | clinical |
| The app may show a percentage for a nutrient whose quantity does not match the denominator | resolved per nutrient: the tables already omit the mismatched ones | engineering (done) |
| The UK food **composition** data | written licence clarification from FSA / FN-BRI / OPSI | legal + publisher |

**Note the two are independent.** The labelling reference values are a
regulator's denominators, not the food database. The UK *food data* is
licence-blocked; the UK *labelling values* are published in retained
legislation and are a separate question. M2-1 does not need the CoFID data.

## 3. The M2-1 design, as implemented on the branch

The implementation is on `feat/m2-regional-reference-values`, built on the
accepted M2-0 commit. It is **not activated**: the regional percentages stay
disabled until the review below is done.

1. **A per-market denominator.** `src/core/reference-values.ts` holds the
   three tables, the approval gate and the resolver. The market comes from the
   profile's country through the existing M1 `regionFor` mapping, so a manual
   country choice always wins.
2. **A single entry point.** `resolvePercent(market, key, amount, state)`
   returns a percentage, or nothing. There is no second path and no
   cross-market fallback: a market that is not enabled resolves to
   "not-enabled", and a market that publishes no value for a nutrient resolves
   to "no-value". Neither ever resolves to another country's number.
3. **The incumbent is untouched.** The United States is the only enabled
   market, so a United States user sees exactly what they see today, and a
   test compares the resolver's output with the app's existing calculation key
   by key.
4. **A profile with no country** predates the country setting and keeps the
   incumbent United States denominator, which is what it sees today.
5. **The wording follows the market.** The "vs. FDA Daily Values" line is
   kept for the United States, and a market without its own values is told
   so, with no percentage shown.

### United States display compatibility

The United States screens are compared against the accepted M2-0 baseline.

| Screen | Before M2-1 | Now |
|---|---|---|
| Food screen, daily vitamins and minerals | amount and progress bar, **no percentage text** | **the same** — amount and progress bar, no percentage text |
| Food screen, daily vitamins and minerals, a partly known value | `200 mg` | `200+ mg` — the plus is required by the lower-bound correction |
| Food detail sheet, micronutrients | amount and percentage | **the same** — amount and percentage, with the same rounding |
| Food screen, macro bars | amount, with a `+` on a lower bound | **the same** |

The daily summary is **not** given percentage text, because it never had any.
M2-1 had added percentages there; that was an unrequested presentation change
and it has been removed, so the United States daily summary reads as it did
before. The only difference in the United States is the `+` on a partly known
value, which the lower-bound correction requires, and which the Home screen
has used since M1.

A screen test pins this: the United States daily rows carry no percentage,
and the food detail sheet still does.

### What is implemented but disabled

| Feature | State |
|---|---|
| The United States percentages | Enabled. Identical to today, except the `+` on a partly known value. |
| The Canadian percentages | **Implemented and disabled.** The table is present and tested, but `ENABLED_MARKETS` does not include Canada. |
| The United Kingdom percentages | **Implemented and disabled**, for the same reason. |
| Any regional percentage for a market with no table | Shows an unavailable state, never a foreign number. |
| The nutrient completeness contract | Unchanged and respected: an unknown value produces no percentage, and a partly known one is shown as a lower bound and its percentage is rounded **down** so the figure is a true minimum. |

### What is not implemented and not authorised

- No regional labelling percentage is switched on.
- No personalised target is changed.
- No food composition dataset is ingested.
- No food catalogue, recipe library, barcode scanner, AI Coach or meal-planning
  behaviour is rebuilt.

## 4. The acceptance gates M2-1 would have to pass

- G1.1 legal has confirmed the instrument and the reproduction right per
  market, and clinical has confirmed the age scope and the wording.
- G1.2 the tables are approved one market at a time. **A market that is not
  approved shows an unavailable state. It does not keep the United States
  numbers**, because those are the wrong denominator for a Canadian or British
  user. The United States is the incumbent: its values are what the app has
  always shown, so using its own table changes nothing and needs no new
  clearance.
- G1.3 **no number changes for a United States user.** The existing
  key-by-key comparison against `nutrientInfo` is the test, and it runs
  unchanged.
- G1.4 the mismatched quantities stay unavailable: Canada's saturated fat,
  the United Kingdom's sodium, fibre and cholesterol, and the United States'
  total sugars. Each has a deterministic test.
- G1.5 the app never shows a percentage borrowed from another market.
- G1.6 the 211 core tests and 75 UI tests still pass, and a new test proves
  the United States percentages are byte-identical to today's.
- G1.7 the copy is reviewed: a labelling percentage is a reference point,
  not personal advice, and the app must not turn it into a recommendation.

## 5. What M2-1 will deliberately not do

- It will not change any personalised target: not the energy estimate, not
  the protein guidance, not the adaptive expenditure, not the glucose
  handling, not the insulin notices. Those are individual requirements and
  need a clinical review of their own.
- It will not add a nutrient the app does not hold, and it will not use a
  denominator for a different quantity.
- It will not touch the food catalogue, the recipe library, the search
  ranking, or the nutrient completeness contract.
- It will not add a region picker. The market follows the country the user
  already chose, and the language stays separate from the market.

## 6. Known open items carried into M2-1

| Item | Note |
|---|---|
| Canadian energy, carbohydrate and protein Daily Values | Not in the published Part 1 table. To be confirmed from the incorporated-by-reference document before those keys are given a Canadian value. |
| United Kingdom "saturates" | Recorded with the annex's own wording. If the UK labelling quantity is established to include trans fatty acids, the United Kingdom needs the same treatment as Canada. |
| The 82 source-code-12 conflicts | Preserved and flagged in the M2-0 research code. A data question for M2-2, not an M2-1 question. |
| The United Kingdom food data | Licence-blocked. M2-1 does not depend on it. |

## 7. Recommendation

**M2-1 is ready to be authorised for the United States and Canada once the
legal and clinical gates are cleared, and for the United Kingdom only for the
values that do not depend on the blocked food data** — which is all of the
labelling values, since they come from legislation rather than from the
dataset.

The single highest-value item in the whole M2 programme is the smallest one:
the app currently shows **FDA Daily Values to Canadian and British users**.
Correcting that is a factuality fix, not a feature, and it needs no new data.

> This document is engineering planning. It is not legal advice and not a
> clinical approval, and it does not assert that any table is cleared for use.
