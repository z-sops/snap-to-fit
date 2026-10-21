# CNF 2026 — field and nutrient-state normalisation matrix

**Source:** Health Canada, *Canadian Nutrient File*, 2026 (relational CSV release)
**Dataset record:** <https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109>
**Retrieved and inspected:** 2026-10-21, from `cnf_fcen_all-files-data_2026.zip`
(SHA-256 `f5faad8977ee6bbdd9d69c8649077cacd87d8658ad200509a4047db1e29edcdd`).

> **Engineering specification. Not a licence clearance and not a clinical
> approval.** No CNF data is ingested by this milestone.

---

## 1. Which CNF release is authoritative

**The published 2026 relational CSV release is the authority.** The online
search tool and the `food-nutrition.canada.ca` API are *not* substitutes: they
expose different field names and a legacy dataset. Concretely, from the files
as published:

| Concept | CNF 2026 CSV column | CNF API field | Same? |
|---|---|---|---|
| The value | `Nutrient_Amount` | `nutrient_value` | renamed |
| Sample count | `Observations` | `number_observation` | renamed |
| Provenance code | `Nutrient_Source_Code` | `nutrient_source_id` | renamed |
| Nutrient | `Nutrient_Code` | `nutrient_name_id` / `nutrient_web_name` | renamed |
| Uncertainty | `STD_Error` | `standard_error` | renamed |
| Food | `Food_Code` | `food_code` | renamed |

The API additionally exposes `Refuse Amount` and `Yield Amount` endpoints and
returns per-row `panels`; the CSV release has no refuse/yield tables, so
"refuse" and "yield" are **not** available in the CSV release and must not be
silently substituted from the API.

**Rule:** an importer reads the CSV release. If the API is ever used, it is
adapted into the CSV field names first, and the adaptation is itself tested.

## 2. File inventory of the 2026 release

| File | Rows | Purpose |
|---|---|---|
| `Nutrient_Amount.csv` | 565,409 | one row per (food, nutrient) that has a value |
| `Food_Name.csv` | 5,993 | one row per food |
| `Nutrient_Name.csv` | 173 | the nutrient dictionary |
| `Nutrient_Source.csv` | 21 | the nutrient-provenance code list |
| `Food_Source.csv` | 18 | the food-provenance code list |
| `Measure_Name.csv` | ~5,000 | household measures |
| `Measure_Type.csv` | 3 | measure types: 3 Refuse, 6 User-defined, 9 Yield |
| `Measure_Weight_Conversion.csv` | 29,868 | conversion factors per food and measure |
| `CNF_Food_Group.csv` | 23 | the CNF food-group taxonomy |

All files are UTF-8 with a byte-order mark, comma separated, RFC 4180 quoting.

## 3. The missingness rule — the central correction

**A nutrient is unknown for a food exactly when there is no row for that
(food, nutrient) pair in `Nutrient_Amount.csv`.**

Measured on the 2026 release:

- 565,409 rows
- 5,993 distinct foods × 172 distinct nutrients = 1,030,796 possible pairs
- **density 54.9 %** — the table is sparse
- rows per food: minimum 14, median 94, maximum 162
- **zero empty `Nutrient_Amount` cells** — a present row always carries a number
- 199,662 rows carry the value `0`

So:

| Situation | Meaning | Normalised state |
|---|---|---|
| no row for (food, nutrient) | the source did not report this nutrient | `unknown`, no value |
| row present, value non-zero | a value, with the quality its source code describes | per §5 |
| row present, value `0` | a zero the source stands behind | `documented-zero` |
| row present, source code `12` | *"Nutrient value is an assumed zero"* | `documented-zero` |

**The `Observations` column is never used to decide whether a value exists.**
It records the number of analytical observations, and it is empty or zero for
every value that was not laboratory work. That is a statement about the
*evidence*, not about *presence*.

## 4. Why `Observations == 0` does not mean unknown — the evidence

Measured across all 565,409 rows of the 2026 release:

| `Nutrient_Source_Code` | Rows | obs > 0 | obs = 0 | obs empty | value = 0 | Description (published) |
|---|---|---|---|---|---|---|
| 0 | 313,311 | 96,830 | 211,651 | 4,830 | 77,194 | No change from USDA |
| 1 | 1,447 | 37 | 773 | 637 | 974 | Nutrient levels changed to meet the canadian regulations |
| 2 | 9,696 | 62 | 3,349 | 6,285 | 3,064 | Nutrient calculated from data other than USDA |
| 3 | 76,332 | 75,896 | 169 | 267 | 31,606 | Nutrient analyzed in a Canadian government lab |
| 4 | 14,897 | 97 | 9,805 | 4,995 | 1,440 | Nutrient calculated from USDA data |
| 5 | 11,869 | 1,037 | 4,569 | 6,263 | 4,926 | Nutrient imputed from a similar USDA food |
| 6 | 2,396 | 84 | 2,159 | 153 | 349 | Nutrient from canadian industry. Documentation incomplete. |
| 7 | 10,016 | 9,156 | 29 | 831 | 1,895 | Nutrient analyzed in Canadian product (non-government lab). Documentation complete. |
| 8 | 474 | 0 | 473 | 1 | 106 | Nutrient value of food created for the Nutrition Canada Survey |
| 9 | 821 | 113 | 122 | 586 | 381 | Nutrient from the label declaration |
| 10 | 4,174 | 446 | 36 | 3,692 | 498 | Nutrient derived from scientific literature |
| **12** | **65,887** | **270** | **16,059** | **49,558** | **65,805** | **Nutrient value is an assumed zero** |
| 14 | 3,798 | 12 | 951 | 2,835 | 70 | Provisional data |
| 15 | 2,122 | 162 | 81 | 1,879 | 959 | Nutrient value imputed from data other than USDA |
| 16 | 1,297 | 0 | 367 | 930 | 66 | Calculated field |
| 17 | 33,184 | 10,916 | 2,989 | 19,279 | 7,746 | Calculated from analytical Canadian data |
| 50 | 1,230 | 1,195 | 9 | 26 | 452 | Calculated from literature for surveys only |
| 51 | 12,386 | 15 | 2,718 | 9,653 | 2,112 | Calculated using a recipe |
| 81 | 14 | 0 | 0 | 14 | 0 | International database |
| 82 | 33 | 4 | 7 | 22 | 12 | Danish Food Composition Databank (revision 5.0) |
| 83 | 25 | 0 | 3 | 22 | 7 | Fineli. Finnish food composition database. National Public Health Institute. |

Read the table across:

- Source code 3 (Canadian government laboratory) has **75,896 of 76,332 rows
  with observations > 0** — the observation count is meaningful *here*.
- Source code 12 (assumed zero) has **270 rows with observations > 0, 16,059 with
  observations = 0 and 49,558 with observations empty**, and **65,805 rows with
  the value 0**. These are real values. Discarding them because there was no
  sample count would delete 65,805 legitimate zeros and 174 legitimate non-zero
  values.
- Source code 51 (calculated using a recipe) has **only 15 rows with any
  observation count** — a calculated value almost never has one, and it is
  still a value.
- Source code 16 (calculated field) has **zero** rows with observations > 0.

**Conclusion:** the source code is the authority on quality; the observation
count is evidence *within* the analytical states and nothing more.

## 5. Nutrient-source code → value state

Implemented in `research/normalize.ts` as `CNF_NUTRIENT_SOURCE_QUALITY`, and
pinned by `tests/m2-normalization.test.ts` against the published
`Nutrient_Source.csv`.

| Code | Published description | State | Notes |
|---|---|---|---|
| 0 | No change from USDA | `analysed` | The value is USDA's laboratory value, carried over unchanged. The provenance must say so; the state is still analytical. |
| 1 | Levels changed to meet the Canadian regulations | `calculated` | A Canadian regulatory adjustment of an inherited value. |
| 2 | Calculated from data other than USDA | `calculated` | |
| 3 | Analyzed in a Canadian government lab | `analysed` | The strongest provenance CNF has. |
| 4 | Calculated from USDA data | `calculated` | |
| 5 | Imputed from a similar USDA food | `imputed` | |
| 6 | From Canadian industry. **Documentation incomplete.** | `estimated` | Not laboratory work, and the documentation is admittedly incomplete. Must be labelled as such. |
| 7 | Analyzed in a Canadian product (non-government lab). Documentation complete. | `analysed` | |
| 8 | Value of food created for the Nutrition Canada Survey | `estimated` | A formulated food, not a measured one. |
| 9 | From the label declaration | `estimated` | A manufacturer-declared value. |
| 10 | Derived from scientific literature | `estimated` | |
| 12 | **Nutrient value is an assumed zero** | `documented-zero` | A value of 0 that the source stands behind. Never discard. |
| 14 | Provisional data | `estimated` | |
| 15 | Imputed from data other than USDA | `imputed` | |
| 16 | Calculated field | `calculated` | |
| 17 | Calculated from analytical Canadian data | `calculated` | |
| 50 | Calculated from literature for surveys only | `calculated` | |
| 51 | Calculated using a recipe | `calculated` | |
| 81 | International database | `analysed` | Another national laboratory dataset. Provenance must name it. |
| 82 | Danish Food Composition Databank | `analysed` | |
| 83 | Fineli, Finnish food composition database | `analysed` | |

**An unrecognised code** keeps the value but is recorded as `estimated` with the
raw code, rather than being guessed at. The code table is the extension point;
adding a code is a data change that must be reviewed.

## 6. Food-level provenance

`Food_Source.csv` gives the food's origin. It is **separate** from the
nutrient-level provenance and must be stored separately, because a food can be
"Canadian only" while one of its nutrient values is still USDA-derived.

| Code | Foods | Published description |
|---|---|---|
| 0 | 3,529 | Food based on data from USDA: No changes |
| 1 | 87 | …some nutrients changed to meet Canadian regulations |
| 3 | 347 | …some nutrients analyzed in the Canadian product |
| 4 | 9 | …some nutrients calculated in the Canadian product |
| 6 | 7 | …some values supplied by manufacturers of the Canadian product |
| 9 | 2 | Data supplied by an international database other than USDA |
| 10 | 1 | …some nutrient analyzed in the Canadian product. Food has been deleted from USDA |
| 11 | 75 | Food based on data from USDA. Food has been deleted from USDA |
| 12 | 130 | …information from USDA survey files |
| 20 | 25 | Canadian food supply, not found in USDA: no changes from Nutrition Canada Survey (1970–1972) |
| 23 | 255 | Canadian food supply, major nutrients analyzed in the Canadian product |
| 24 | 45 | Major nutrients calculated in the Canadian product; not a SNAP-CAN food |
| 26 | 116 | Canadian food supply, not found in USDA: values supplied by manufacturers of the Canadian product |
| 28 | 212 | Traditional food |
| 35 | 134 | CNF recipe compilation |
| 37 | 1,019 | CNF Sampling and Analysis Program (SNAP-CAN) |

`Food_Name.csv` also carries a `USDA_NDB_Code` for **4,798 of 5,993** foods; the
other 1,195 are Canadian-only. That column is the natural cross-reference to
the app's existing `usda:` identifiers and is what makes the M1 stable-id
contract work.

## 7. Nutrient mapping onto the app's 19 keys

The app's key order and set are fixed in `src/core/foods.ts`:
`calories, protein, carbs, fat, fibre, sugar, satFat, sodium, potassium, calcium,
iron, magnesium, zinc, vitaminC, vitaminD, vitaminB12, folate, vitaminA,
cholesterol`.

The app's units are `kcal`, `g`, `mg`, `mcg`. CNF's `Nutrient_Unit` is a word:
`Gram`, `Milligram`, `Microgram`, `kilocalorie`, `International Unit`,
`Niacin Equivalents`. A unit map is therefore required, and **one CNF nutrient
must never be mapped**: vitamin D also exists in International Units
(`VITD_IU`, `Nutrient_Code` 324) alongside micrograms (`VITD`, code 328). Mixing
them would be wrong by a factor of 40.

| App key | CNF code | CNF symbol | INFOODS tag | CNF unit | App unit | Decimals | Note |
|---|---|---|---|---|---|---|---|
| calories | 208 | KCAL | `ENERC_KCAL` | kilocalorie | kcal | 0 | Direct; **no kJ conversion needed.** `ENERC_KJ` (code 268) is excluded. |
| protein | 203 | PROT | `PROCNT` | Gram | g | 2 | |
| carbs | 205 | CARB | `CHOCDF` | Gram | g | 2 | "by difference" — not directly measured |
| fat | 204 | FAT | `FAT` | Gram | g | 2 | |
| fibre | 291 | TDF | `FIBTG` | Gram | g | 1 | "total dietary" |
| sugar | 269 | TSUG | `SUGAR` | Gram | g | 2 | total sugars |
| satFat | 606 | TSAT | `FASAT` | Gram | g | 3 | "Fatty acids, saturated, total". Tag is `FASAT`, not `FSAT`. |
| sodium | 307 | NA | `NA` | Milligram | mg | 0 | |
| potassium | 306 | K | `K` | Milligram | mg | 0 | |
| calcium | 301 | CA | `CA` | Milligram | mg | 0 | |
| iron | 303 | FE | `FE` | Milligram | mg | 2 | |
| magnesium | 304 | MG | `MG` | Milligram | mg | 0 | |
| zinc | 309 | ZN | `ZN` | Milligram | mg | 2 | |
| vitaminC | 401 | VITC | `VITC` | Milligram | mg | 1 | |
| vitaminD | 328 | D3+D2-µg | `VITD` | Microgram | mcg | 1 | D2 + D3. **`VITD_IU` excluded.** |
| vitaminB12 | 418 | B12 | `VITB12` | Microgram | mcg | 2 | |
| folate | 435 | DFE | `FOLDFE` | Microgram | mcg | 0 | "Dietary folate equivalents". `FOL` (417) is *total folacin* — different. |
| vitaminA | 320 | RAE | `VITA_RAE` | Microgram | mcg | 0 | "Retinol activity equivalents". `RETOL` (319) is retinol — different. |
| cholesterol | 601 | CHOL | `CHOLE` | Milligram | mg | 2 | |

CNF nutrients deliberately **not** mapped: `ENERC_KJ`, `VITD_IU`, `RETOL`,
`FOL`, `FOLAC`, `FOLFD`, `NIAEQ`, the 20 amino acids, the fatty-acid fractions,
`WATER`, `ASH`, the sugars and the alcohol entries. They remain available in
the source for future work but are not silently folded into an app key.

The mapping is pinned in code as `CNF_TAGS_BY_APP_KEY` and tested for
one-to-one coverage.

## 8. Serving measures

CNF gives household measures through `Measure_Weight_Conversion.csv`
(`Food_Code`, `Measure_Type_Code`, `Measure_Code`, `Measure_Weight_Conversion`)
joined to `Measure_Name.csv` (`Measure_Code`, description) and `Measure_Type.csv`
(`Refuse`, `User-defined`, `Yield`).

- The app's serving model is `{ label, grams }`. A CNF measure becomes
  `{ label: measure description, grams: 100 × conversion factor }`.
- **`Measure_Type_Code` 3 (Refuse) and 9 (Yield) must be handled, not dropped.**
  A refuse measure is the inedible portion; a yield measure is the edible
  yield. The app's serving grams are the *edible* portion, so a yield measure
  is the correct basis and a refuse measure is not a serving at all. The CSV
  release has no refuse/yield tables, so refuse data is **unavailable in the
  authoritative release** and must not be taken from the API.
- The app already appends `"100 g"` and `"1 oz"` to every food. CNF supplies
  its own household measures, so the merged serving list must be de-duplicated
  the way `fromRow` does today.

## 9. Taxonomies

CNF's `CNF_Food_Group_Code` (23 groups, e.g. `Dairy and Egg Products`,
`Spices and Herbs`, `Babyfoods`) is a **different taxonomy** from the USDA group
codes the app's `dishTraits` and `dishIngredients` read off `row[2]`.

**Rule:** the USDA group codes keep their meaning. A CNF food must not be fed
into the USDA-group allergen heuristic, because the code spaces are not
interchangeable. A taxonomy mapping (CNF group → app group) is a separate,
explicit, reviewed table, and until it exists, allergen inference applies only
to USDA-sourced foods.

## 10. The normalisation rules, in one place

```
row absent                       -> { state: "unknown" }
row present, Nutrient_Amount = 0 -> { state: "documented-zero", value: 0 }
row present, source code 12     -> { state: "documented-zero", value: 0 }
row present, otherwise          -> { state: quality(source code), value: amount }
unknown source code              -> { state: "estimated", value: amount, sourceCode: code }
```

with `Observations` and `STD_Error` carried through as evidence, **never** as a
presence test.

This is implemented in `research/normalize.ts` and pinned by
`tests/m2-normalization.test.ts` (13 deterministic tests, no network).
