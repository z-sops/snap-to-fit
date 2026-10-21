# M2 work packages — revised after independent review

**Status:** plan. No implementation is authorised beyond M2-0.
**Supersedes:** the work packages in the M2 proposal, which the reviewer
corrected on five points.

---

## 0. What changed in this revision

| Reviewer correction | How this plan changed |
|---|---|
| CNF sample count is not a missingness rule | A dedicated value-state model (`analysed` / `calculated` / `imputed` / `estimated` / `trace` / `unknown` / `documented-zero`) with quality, provenance and missingness kept **separate**. `Observations` is evidence, never a presence test. Specified in `docs/m2/CNF_2026_NORMALIZATION.md` and implemented in `research/normalize.ts`. |
| UK licensing is channel-specific | The registry records **four separate UK channels** with their own verdicts. The GOV.UK OGL does not override a dataset-specific restriction, and the FN-NBRI API's non-commercial terms are recorded as `prohibited`. Written clarification is a hard gate. |
| Reference values ≠ personal requirements | Three categories separated (composition data / labelling reference values / individual targets). Regional reference values are their own gated package. **No personal target changes in M2.** |
| Uncertainty is not a confidence interval from sample count | The state model replaces any numeric confidence band. No interval is computed from `Observations` alone. The AI-only fallback is a **separately labelled** estimate, not a catalogue value. |
| Existing M1 contracts must survive | M2-0 fixes a deterministic specification for ids, taxonomy, units, provenance and schema migration **before** any ingestion. A pinned-value regression harness is a release gate. |

---

## 1. Packages and dependencies

```
M2-0  Data governance, source verification, technical specification   [DONE — this milestone]
  |
  +-- M2-1  Regional labelling reference values      (legal + clinical gate)
  |
  +-- M2-2  Build pipeline and source manifest       (needs a permitted source)
  |     |
  |     +-- M2-3  Source-aware catalogue runtime
  |     |     |
  |     |     +-- M2-4  Ingredient alias table
  |     |     |     |
  |     |     |     +-- M2-6  Regional dish libraries
  |     |     |
  |     |     +-- M2-5  AI estimate safety and labelling
  |     |
  |     +-- M2-7  Provenance and honesty in the UI
  |
  +-- M2-8  Verification, release and rollback
```

**M2-1 is independent** of the data work and can start as soon as legal and
clinical sign-off exists. It is also the smallest package with the largest
correctness win: the app currently shows **FDA Daily Values to Canadian and
British users**.

**M2-2 is blocked on a permitted source.** The United States is permitted
today. Canada is permitted on the OGL-Canada reading, subject to legal
confirmation of attribution for the USDA-derived portion. The United Kingdom
is blocked pending written clarification.

---

## 2. M2-0 — Data governance, source verification, technical specification

**Status: complete in this milestone.** Delivered:

- `docs/DATA_SOURCES.md` — the registry, with commercial-use verdicts and
  evidence.
- `docs/m2/SOURCE_MANIFEST_SPEC.md` — manifest schema, reproducibility rules,
  the verification procedure, and the checksums of the artefacts already in the
  repository.
- `docs/m2/CNF_2026_NORMALIZATION.md` — the field-level matrix, measured
  against the official 2026 relational release.
- `docs/m2/COFID_SENTINELS_AND_PROVENANCE.md` — sentinel and provenance rules,
  from published documentation only.
- `docs/m2/LABELLING_REFERENCE_VALUES.md` — the three-market reference-value
  specification.
- `docs/m2/UK_LICENCE_QUESTION.md` — the questions to put in writing.
- `docs/m2/M2_WORK_PACKAGES.md` — this file.
- `docs/m2/ADAPTER_TEST_PLAN.md`, `docs/m2/SIZE_AND_COLDSTART_PLAN.md`.
- `research/` — the value-state model and the normalisation rules as
  executable code, with synthetic fixtures and 13 deterministic tests.

**Explicitly not done in M2-0:** no dataset ingested, no production file
changed, no identifier changed, no target changed.

---

## 3. M2-1 — Regional labelling reference values

**Depends on:** legal confirmation of the instrument per market; clinical
confirmation of the age scope and of showing a labelling percentage in a
consumer app.

**Contents**

- A `MarketReferenceValues` table per market, in the shape specified in
  `docs/m2/LABELLING_REFERENCE_VALUES.md` §6, with `basis` and `scope` on every
  value.
- The US table becomes the default; the Canada and UK tables are added.
- The food screen's wording changes from "vs. FDA Daily Values" to the
  market's own instrument.
- A market without a confirmed table renders "no regional reference value" —
  never a number borrowed from another market.

**Out of scope:** every personal target. The app's Mifflin estimate, protein
guidance, adaptive TDEE, glucose handling and insulin notices are untouched.

**Gates**

- G1.1 legal has confirmed the instrument and the reproduction right per
  market.
- G1.2 clinical has confirmed the age scope and the wording.
- G1.3 the three non-substitutions are resolved or explicitly left as "no
  value shown": **folate basis** (US µg DFE vs UK µg folic acid), **salt vs
  sodium**, and **age scope**.
- G1.4 the 179 core and 75 UI tests still pass, and a new test proves the US
  percentages are byte-identical to today.

---

## 4. M2-2 — Build pipeline and source manifest

**Depends on:** a source with a `permitted` verdict.

**Contents**

- `scripts/build-foods/` split into a per-source normaliser plus a merge step.
  Each normaliser reads one published format and emits the app's internal
  shape; the merge step combines them and writes the catalogue.
- `data/manifest.json` and the `data:fetch` / `data:build` / `data:verify`
  scripts specified in `docs/m2/SOURCE_MANIFEST_SPEC.md`.
- A builder version, so a change to a normaliser is visible in the manifest.
- The CNF normaliser, which reads the 2026 relational CSVs and applies
  `docs/m2/CNF_2026_NORMALIZATION.md` exactly.

**Gates**

- G2.1 `data:verify` is wired into CI and fails on a checksum change.
- G2.2 a source with `commercial_use: unresolved` or `prohibited` cannot be
  fetched by a build script.
- G2.3 a golden test proves the builder is byte-deterministic from pinned
  inputs.
- G2.4 the manifest is reviewed like code.

---

## 5. M2-3 — Source-aware catalogue runtime

**Depends on:** M2-2.

**Contents**

- Schema v2 for the catalogue: the row keeps its compact form and gains a
  metadata element carrying source, region, version, per-value state and
  provenance. A v1 reader stays so an older file still loads.
- `foodById` dispatches on the id prefix. `usda:` keeps meaning exactly what
  it means today, because it is persisted in `Meal.foodId`.
- Market-aware ranking **inside** the existing bands (popular ≈ 1000, recipes
  ≈ 900, raw rows ≈ 500). The US ordering must be identical to today.
- Per-food uncertainty taken from the source's own evidence, replacing the
  blanket 0.1 / 0.2 / 0.25 — but **as a state, not as a confidence interval**
  computed from a sample count.
- `sourceDescriptions` extended with the Canadian and UK entries and their
  licence wording; `foodCatalogCredit` becomes per market.

**Gates**

- G3.1 every persisted `usda:` id still resolves; a pinned test enumerates
  them.
- G3.2 the US ranking golden file is unchanged.
- G3.3 the known / partial / unknown contract in `src/core/food-log.ts` is
  used unchanged; no second aggregation is introduced.
- G3.4 the catalogue's per-food metadata is present and complete.

---

## 6. M2-4 — Ingredient alias table

**Depends on:** M2-2, and it must land **before** any catalogue refresh.

**Why it is first.** `recipeFood()` in `src/core/foods.ts` throws on a missing
ingredient id, and every dish and recipe addresses its ingredients by USDA
number. A catalogue regeneration would break the meal plan outright. The alias
table removes that coupling.

**Contents**

- `Recipe.parts` and `Dish.parts` address ingredients by a stable canonical
  key, resolved per market with a fallback order.
- The alias table is seeded from the current NDB ids, so the 72 popular foods
  and every dish keep resolving exactly as they do.
- A missing ingredient falls back instead of throwing.

**Gates**

- G4.1 every alias resolves in every market that ships.
- G4.2 the US meal plan is identical before and after (the existing
  `tests/planning.test.ts` assertions are the harness).
- G4.3 no production path can throw on a missing ingredient.

---

## 7. M2-5 — AI estimate safety and labelling

**Depends on:** M2-3, M2-4.

This package answers the reviewer's point that a database-matched ingredient and
an unmatched one must be visibly different to the user, and that an AI
estimate is not a catalogue value.

**Contents**

- The `/food` provider prompt names the user's market's database and its naming
  convention, so the model's food names match the catalogue's rows. It carries a
  **country code only** — no profile, no identifiers, no health context.
- A matched ingredient is priced from the catalogue and is labelled as a
  catalogue value.
- An unmatched ingredient uses a **separately labelled AI-only estimate** with
  a wider uncertainty, and every micronutrient the app could not source from
  the catalogue stays `unknown`.
- The user can tell a verified reference nutrient from an AI estimate, in the
  detail sheet and in the day totals.
- `validatePhotoResult` bounds are kept (kcal ≤ 5000, macros ≤ 500, ≤ 12 items,
  grams ≤ 2000) and are extended only to cover a new source's range, never
  relaxed.
- The consent gate is unchanged and still blocks every provider call without
  `aiConsent: true`.

**Gates**

- G5.1 a matched item is priced from the catalogue; an unmatched one is
  labelled as an AI estimate and its unknown micronutrients are recorded.
- G5.2 the prompt contains no personal data and no free-text personal context.
- G5.3 the consent negative tests still prove **zero** provider requests
  without confirmed consent.
- G5.4 the medical safety restrictions in `server/policy.mjs` are unchanged
  apart from additions that restrict rather than relax.

---

## 8. M6 — Regional dish libraries

**Depends on:** M2-4.

- Dishes and recipes built on the regional catalogues, with allergen inference
  scoped to the taxonomies the app actually understands. A Canadian food must
  not inherit USDA group-code allergens.
- `planSignature` is bumped so the weekly plan cache is invalidated.

**Gates:** G6.1 every dish resolves in every market; G6.2 allergen inference
runs only on understood taxonomies; G6.3 the US plan is unchanged.

## 9. M2-7 — Provenance and honesty in the UI

**Depends on:** M2-3.

- Per-food source, version and licence, shown in the detail sheet.
- The value's state, so a calculated or estimated figure is visibly different
  from an analysed one.
- Per-market catalogue credits in the app, the public site and the store
  listing, each carrying the source's required citation.

**Gates:** G7.1 the credit text is generated from the registry, not retyped;
G7.2 the site and the store listing describe the catalogue that actually
ships.

## 10. M2-8 — Verification, release and rollback

- Dataset lint, the pinned-value regression harness, the per-market store
  listings, and the rollback plan (a data revert, because every persisted
  `usda:` id keeps resolving across the revert).
- The existing 179 core and 75 UI tests must pass unchanged throughout.

---

## 11. What stays out of M2 entirely

- Adaptive coaching, speech recognition, watch-session import, billing changes,
  the 3-D movement rebuild, and any change to the medical or emergency copy
  beyond what a separate clinical review approves.
- Any new personal target, in any market.
- Any ingestion of a source whose commercial-use verdict is not `permitted`.
