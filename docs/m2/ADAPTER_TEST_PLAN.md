# Adapter test plan (M2-0 proposal)

**Purpose:** specify the deterministic tests that must exist before a single
byte of a new dataset is imported, so that the import is provably safe rather
than hopefully safe.

**Status:** proposal. The parts already implemented in M2-0 are marked
**[done]**.

---

## 1. Principles

1. **No network.** Every test runs against a checked-in fixture. The dataset
   itself is committed to the app, so the tests never need the network.
2. **Fixtures are small and synthetic where a licence requires it.** The CNF's
   small reference tables are reproduced with attribution under the Open
   Government Licence – Canada. The CoFID fixture is **synthetic**: invented
   rows that exercise the published sentinel rules, because the CoFID's
   commercial terms are unresolved.
3. **Every rule in the specification is a test.** If a rule is written in
   `docs/m2/`, a test exists that fails when the rule is broken.
4. **The existing suite is the baseline.** The 179 core and 75 UI tests must
   pass before and after every package.

---

## 2. Layer 1 — the normalisation rules **[done]**

`tests/m2-normalization.test.ts` (20 tests) over `research/normalize.ts`:

| Test | Pins |
|---|---|
| every app nutrient key maps to exactly one CNF tag | the mapping is one-to-one and total |
| the two excluded CNF nutrients are recorded as excluded | `ENERC_KJ` and `VITD_IU` are never mapped |
| the published CNF code table matches the quality map | every code in `Nutrient_Source.csv` has a quality |
| a value with no laboratory observations is still a value | `Observations == 0` does **not** mean unknown |
| an assumed zero is a documented zero | source code 12 with an amount of 0 |
| **an assumed zero paired with a non-zero amount is a conflict** | the published amount survives, the row is flagged, and no verified quality is claimed |
| **an assumed zero with a large non-zero amount is also a conflict** | the same rule at a different magnitude |
| **a blank amount is never a zero** | `Number("")` is 0 and must not be read that way |
| a laboratory value keeps its observations and its source | code 3, observations and `STD_Error` carried through |
| imputed, estimated and calculated values are told apart | the three states are distinct |
| **a value carried over from USDA is not claimed to be laboratory analysed** | code 0 is `inherited`, never `analysed` |
| **an international database value is not claimed to be laboratory analysed** | codes 81/82/83 are `inherited` |
| **an unknown source code is flagged for review** | the amount is kept, the row is flagged, it is not settled |
| an absent row is the only thing that means unknown | and it carries no value |
| a zero that was measured is a documented zero | value 0 with any other code |
| an unrecognised source code keeps the value but does not claim quality | the code table is the extension point |
| the CoFID sentinels are read as the user guide documents them | `N`, `Tr`, `( )`, a footnoted value, empty, `0` |
| no CNF fixture row turns an unknown into a number | no regression of the M1 contract |
| a value is never displayed when its state says it is not a number | unknown and trace are not numbers |
| **no fixture row silently replaces a published amount with zero** | the blanket guard against Correction A |

## 2b. Layer 1b — the labelling reference values **[done, read-only]**

`tests/m2-reference-values.test.ts` (12 tests) over
`research/reference-values.ts`:

| Test | Pins |
|---|---|
| **the United States table reproduces the values the app uses today** | key by key against the app's own `nutrientInfo`, including the nutrients the app leaves out |
| **the added sugars Daily Value is never used for total sugars** | no US value for `sugar`, and the 50 g added-sugars figure is not substituted |
| Canada uses the adult columns, including the corrected potassium | 3400 mg, and the other Canadian adult values |
| the United Kingdom uses the adult annex values | vitamin D 5 µg and the rest |
| **the United Kingdom sets salt, not sodium, and salt is not sodium** | the sodium key has no UK value; the salt figure is recorded separately |
| **the United Kingdom annex has no cholesterol and no fibre value** | no value, and no borrowing |
| folate records the basis it is measured on | DFE against folic acid |
| **a market never borrows another market's value** | the defect this app has today |
| a missing reference value produces no percentage | undefined, not a number |
| the missing values for each market are known | the gaps are explicit |
| no table is marked approved before review | `approved: false` on every table |
| every value carries a unit and a scope | the shape is complete |

## 3. Layer 2 — the source adapters (M2-2)

Each adapter is tested against a small fixture, with the same shape.

| Test | Pins |
|---|---|
| the adapter reads the published field names, not the API's | `Nutrient_Amount` / `Observations` / `Nutrient_Source_Code` |
| a UTF-8 byte-order mark does not corrupt the first column | the published files all have one |
| quoted fields containing commas survive | food descriptions contain commas |
| the adapter is deterministic | same fixture in, same output out, twice |
| the adapter never reads a file that is not in the manifest | a checksum mismatch fails the build |
| the adapter refuses a source whose verdict is not `permitted` | the licence gate is in code, not in a reviewer's memory |

**CNF adapter specific**

| Test | Pins |
|---|---|
| density is 54.9 % and an absent pair is unknown | the missingness rule |
| a food with 14 nutrient rows and one with 162 both parse | the range of coverage |
| `Nutrient_Amount` is never empty in the release, and a 0 is kept | zero is a value |
| `Measure_Type_Code` 3 (Refuse) and 9 (Yield) are distinguished | a refuse measure is not a serving |
| `USDA_NDB_Code` is captured on 4,798 of 5,993 foods | the cross-reference to `usda:` ids |
| `Food_Source_Code` is stored separately from the nutrient-level code | food provenance and value provenance are different |
| the nutrient-group mapping is explicit, and allergen inference runs only on understood taxonomies | the USDA group codes keep their meaning |

**CoFID adapter specific** — *cannot be written until G1 clears*

| Test | Pins |
|---|---|
| `N` is unknown | |
| `Tr` is a trace and is never a number | |
| `( 1.2 )` is an estimate with the value 1.2 | |
| energy is converted from kJ with the specified factor and rounding | the factor must be written down first |
| cholesterol is unknown, because CoFID does not publish it | no substitution |
| alcoholic beverages are excluded until a density rule exists | |
| the "old foods" file is flagged as not reviewed since 2008 | |

## 4. Layer 3 — the catalogue (M2-3)

| Test | Pins |
|---|---|
| every persisted `usda:` id still resolves | the M1 stable-id contract |
| `cnf:` and `cofid:` ids resolve; an unknown prefix returns `null` and never throws | |
| the US ranking golden file is byte-identical to today | search ranking is unchanged for US users |
| a Canadian profile ranks the Canadian entry above the US one, inside the same band | market-aware ranking |
| a source with weaker provenance does not outrank a better-supported match | the reviewer's explicit constraint |
| a food with an unknown nutrient has the nutrient absent, not zero | the M1 completeness contract |
| a food with a documented zero has 0 | |
| per-food metadata is present and complete | source, version, state |
| the `Food` interface is unchanged for the shipping app | no type churn |

## 5. Layer 4 — the ingredient aliases (M2-4)

| Test | Pins |
|---|---|
| every alias resolves in every market that ships | |
| the alias table is seeded so all 72 popular foods and every dish resolve | the M1 dish library |
| a missing ingredient falls back instead of throwing | the `recipeFood()` throw is removed |
| the US meal plan is identical before and after | the `tests/planning.test.ts` harness |
| the plan cache key changes when the dish library changes | `planSignature` |

## 6. Layer 5 — the AI path (M2-5)

| Test | Pins |
|---|---|
| a matched ingredient is priced from the catalogue | |
| an unmatched ingredient is labelled as an AI estimate with a wider range | |
| the micronutrients the app could not source stay unknown | |
| the prompt carries a country code and no personal data | a string assertion on the captured request |
| `validatePhotoResult` still rejects out-of-range values | the existing bounds |
| no provider request happens without `aiConsent: true` | the existing M1 negative tests |
| the medical restrictions in the policy are unchanged | a policy-diff assertion |

## 7. Layer 6 — the shipped artefact (M2-8)

| Test | Pins |
|---|---|
| the dataset lint: structure, ranges, provenance, licence keys, checksums | |
| the pinned-value regression harness: the values the current tests pin are unchanged for the US catalogue | chicken breast 151 kcal / 30.5 g protein; the OFF sodium g→mg and kJ→kcal conversions; recipe calories within range |
| the golden build: the builder output is byte-identical to the committed artefact | |
| the manifest lock matches the manifest | |
| the bundle-size budget and the cold-start budget | see `docs/m2/SIZE_AND_COLDSTART_PLAN.md` |

## 8. Fixtures to be created

| Fixture | Origin | Licence | Status |
|---|---|---|---|
| `research/fixtures/cnf-2026-nutrient-source.csv` | real, 22 rows | OGL-Canada | **[done]** |
| `research/fixtures/cnf-2026-food-source.csv` | real, 18 rows | OGL-Canada | **[done]** |
| `research/fixtures/cnf-2026-nutrient-name.csv` | real, 173 rows | OGL-Canada | **[done]** |
| `research/fixtures/cnf-2026-food-group.csv` | real, 23 rows | OGL-Canada | **[done]** |
| `research/fixtures/cnf-2026-nutrient-amount-summary.csv` | **generated** from the official release by `research/measure-cnf-2026.mjs` | OGL-Canada, derived | **[done]** |
| `research/fixtures/cnf-2026-nutrient-amount.synthetic.csv` | synthetic, 22 rows | project | **[done]** |
| `research/fixtures/cofid-2021-sentinels.synthetic.csv` | synthetic, 10 rows | project | **[done]** |
| `tests/fixtures/food-catalogue.sample.json` | synthetic | project | M2-3 |
| `tests/fixtures/ingredient-aliases.sample.json` | synthetic | project | M2-4 |
| `tests/fixtures/photo-estimate.sample.json` | synthetic | project | M2-5 |
| `tests/fixtures/manifest.sample.json` | synthetic | project | M2-2 |

**Rule:** a fixture that contains real third-party rows is only created when the
licence permits redistribution and the file is small enough to be worth
committing. Everything else is synthetic.
