# Food-labelling reference values — US, Canada, United Kingdom

**Purpose:** specify the reference values the app may show as a "percent daily
value" in each market, with the right source, age scope, unit and rounding.

> **Engineering specification. Not legal advice and not clinical approval.**
> Regional reference values may be **implemented only after this specification
> and the necessary review are approved** (M2-1). Nothing in this document
> changes a number the app currently shows.

---

## 1. Three different things that must not be confused

| | What it is | Who sets it | Can it be personalised? |
|---|---|---|---|
| **A. Food composition data** | What nutrients are in a food. | The national composition database (USDA, CNF, CoFID). | No. |
| **B. Labelling reference values** | The denominator for a "percent daily value" on a label. A population reference, not an individual's requirement. | The labelling regulator: the FDA (US), Health Canada (Canada), retained Regulation (EU) 1169/2011 (UK). | **No.** |
| **C. Individual dietary or medical targets** | What *this person* should eat. | Clinicians, dietitians, and the app's own general-fitness estimates. | Yes — and these need clinical review. |

**The confusion this document prevents:** the United Kingdom publishes both
*Nutrient Reference Intakes* (individual requirements) and *Nutrition
Reference Values* (labelling denominators). **The labelling NRVs are the ones a
percent daily value is computed against. An RNI is not a labelling value and
must not be substituted for one.** The UK's own labelling annex is titled
*"U.K. Daily Reference Intakes for Vitamins and Minerals"* — the word
"reference" is doing the work, and it is what makes the distinction.

**Nothing in M2-0 changes any personal target.** The app's Mifflin–St Jeor
energy estimate, its protein guidance, its adaptive TDEE and its insulin safety
notices are all category (C) and are out of scope. They stay exactly as they
are until a separate clinical review.

---

## 2. The current state in the app

`src/core/foods.ts` holds a single `nutrientInfo` table whose `dv` values are
**the US FDA Daily Values**, and it applies them in every market. The food
screen's own wording says so: *"Today's fiber, sodium, potassium, iron,
vitamins and more vs. FDA Daily Values."*

That is **factually wrong for Canadian and British users**. The table below
shows how wrong, and by how much.

## 3. US — FDA Daily Values

**Source:** 21 CFR 101.9 (Nutrition and Supplement Facts), the labelling
reference values for adults and children aged 4 and over.

| App key | App's current `dv` | FDA DV | Match |
|---|---|---|---|
| calories | — | 2000 kcal | app has no DV for energy |
| protein | 50 g | 50 g | yes |
| carbs | 275 g | 275 g | yes |
| fat | 78 g | 78 g | yes |
| fibre | 28 g | 28 g | yes |
| **sugar** | — | **no established Daily Value** | app has no DV for sugars, and neither does the FDA for **total** sugars |
| satFat | 20 g | 20 g | yes |
| sodium | 2300 mg | 2300 mg | yes |
| potassium | 4700 mg | 4700 mg | yes |
| calcium | 1300 mg | 1300 mg | yes |
| iron | 18 mg | 18 mg | yes |
| magnesium | 420 mg | 420 mg | yes |
| zinc | 11 mg | 11 mg | yes |
| vitaminC | 90 mg | 90 mg | yes |
| vitaminD | 20 µg | 20 µg | yes |
| vitaminB12 | 2.4 µg | 2.4 µg | yes |
| folate | 400 µg | 400 µg DFE | yes (the app labels it "Folate") |
| vitaminA | 900 µg | 900 µg RAE | yes (the app labels it "Vitamin A") |
| cholesterol | 300 mg | 300 mg | yes |

**The US column is already correct.** It is retained as the default so no
existing behaviour changes.

### 3.1 Total sugars versus added sugars — the substitution to avoid

The FDA is explicit
(<https://www.fda.gov/food/nutrition-facts-label/added-sugars-nutrition-facts-label>,
read 2026-10-21):

> *"Total Sugars include sugars naturally present in many nutritious foods and
> beverages… **There is no Daily Value for total sugars because no
> recommendation has been made for the total amount to eat in a day.**"*
>
> *"**The Daily Value for added sugars is 50 grams per day** based on a 2,000
> calorie daily diet."*

These are **two different nutrients**:

| | Quantity | US Daily Value | App key |
|---|---|---|---|
| Total sugars | all sugars, natural and added | **none** | `sugar` (USDA "Sugars", CNF "Sugars, total", CoFID "Sugars") |
| Added sugars | sugars added in processing | 50 g | **none — the app does not track this** |

**The app's `sugar` key is total sugars.** It must therefore carry **no
United States Daily Value**, which is what the app does today and what the
research table does. The 50 g added-sugars figure belongs to a nutrient the
app does not hold and must never be used for `sugar`.

This is recorded in code as `US_ADDED_SUGARS_DAILY_VALUE`, with a comment, so
it cannot be picked up by accident, and a regression test asserts that
`referenceValueFor("US", "sugar")` and `percentDailyValue("US", "sugar", 30)`
are both undefined.

## 4. Canada — Nutrition Labelling Table of Daily Values (2022)

**Source:** Health Canada, *Nutrition labelling — Table of daily values*,
published 20 October 2022, **incorporated by reference in the Food and Drug
Regulations** (<https://www.canada.ca/en/health-canada/services/technical-documents-labelling-requirements/table-daily-values.html>).
A 2016 transitional version applied until 31 December 2025; **the 2022 table is
the only one in force now** (checked 2026-10-21).

### 4.1 Part 1 — macronutrients and sodium, two age columns

| Item | Food solely for children 1–4 y | Children 4+ y and adults |
|---|---|---|
| Fat | 44 g | **75 g** |
| Sum of saturated fatty acids and trans fatty acids | 10 g | 20 g |
| Fibre | 14 g | 28 g |
| Sugars | 50 g | **100 g** |
| Cholesterol | 300 mg | 300 mg |
| Sodium | 1200 mg | 2300 mg |

### 4.2 Part 2 — vitamins and minerals, three age columns

| Item | Infants 6–12 mo | Infants 6–12 mo or children 1–4 y | Children 4+ y and adults |
|---|---|---|---|
| Potassium | 860 mg | 2000 mg | **3400 mg** |
| Calcium | 260 mg | 700 mg | 1300 mg |
| Iron | 11 mg | 7 mg | 18 mg |
| Vitamin A | 500 µg | 300 µg | 900 µg |
| Vitamin C | 50 mg | 15 mg | 90 mg |
| Vitamin D | 10 µg | 15 µg | 20 µg |
| Vitamin E | 5 mg | 6 mg | 15 mg |
| Vitamin K | 2.5 µg | 30 µg | 120 µg |
| Thiamin | 0.3 mg | 0.5 mg | 1.2 mg |
| Riboflavin | 0.4 mg | 0.5 mg | 1.3 mg |
| Niacin | 4 mg | 6 mg | 16 mg |
| Vitamin B6 | 0.3 mg | 0.5 mg | 1.7 mg |
| Folate | 80 µg DFE | 150 µg DFE | 400 µg DFE |
| Vitamin B12 | 0.5 µg | 0.9 µg | 2.4 µg |
| Choline | 150 mg | 200 mg | 550 mg |
| Biotin | 6 µg | 8 µg | 30 µg |
| Pantothenic acid | 1.8 mg | 2 mg | 5 mg |
| Phosphorus | 275 mg | 460 mg | 1250 mg |
| Iodide | 130 µg | 90 µg | 150 µg |
| Magnesium | 75 mg | 80 mg | 420 mg |
| Zinc | 3 mg | 3 mg | 11 mg |
| Selenium | 20 µg | 20 µg | 55 µg |
| Copper | 0.2 mg | 0.3 mg | 0.9 mg |
| Manganese | 0.6 mg | 1.2 mg | 2.3 mg |
| Chromium | 5.5 µg | 11 µg | 35 µg |
| Molybdenum | 3 µg | 17 µg | 45 µg |
| Chloride | 570 mg | 1500 mg | 2300 mg |

### 4.3 What changes for a Canadian user

| App key | US (current) | Canada (adults) | Difference |
|---|---|---|---|
| fat | 78 g | 75 g | 3 g |
| sugar | none (no US total-sugars DV) | 100 g (total sugars) | new in Canada |
| **potassium** | **4700 mg** | **3400 mg** | **1300 mg** |
| everything else the app shows | — | — | unchanged |

**Potassium is the one real correction** — the app would otherwise tell a
Canadian that 3400 mg of potassium is 79 % of the daily value when it is in
fact 100 %.

Canada's sugars value is for **total sugars**, the same quantity the app
tracks, so it is a direct counterpart to the United Kingdom's 90 g and is not
affected by the added-sugars distinction.

### 4.4 Canadian open items

- **Energy and carbohydrate.** The Part 1 table as published lists six items;
  energy (2000 kcal) is not among them, and carbohydrate is not a Canadian
  labelling DV at all. The energy DV must be confirmed from the incorporated-by-
  reference document and the Food and Drug Regulations before it is used.
- **Protein** is likewise not a Canadian labelling DV. The app's `dv: 50` for
  protein is a US DV and has no Canadian equivalent in this table.
- **Rounding and the "a little / a lot" rules.** Health Canada's nutrition
  facts table guidance sets 5 % DV or less as *"a little"* and 15 % DV or more
  as *"a lot"* (<https://www.canada.ca/en/health-canada/services/food-nutrition/nutrition-labelling/nutrition-facts-tables.html>).
  The exact declaration rounding rules must be confirmed from the regulations.
- The 2022 table was updated for potassium and sodium to reflect NASEM's 2019
  DRIs. Any earlier table must not be used.

## 5. United Kingdom — retained Regulation (EU) 1169/2011, Annex XIII

**Source:** *Regulation (EU) No 1169/2011 … Annex XIII*, as retained in UK law
(<https://www.legislation.gov.uk/eur/2011/1169/annex/XIII>). Read 2026-10-21.
This is the **nutrition declaration reference values** — the denominators for
%NRV on a UK nutrition declaration.

### 5.1 Part A — UK Daily Reference Intakes for vitamins and minerals (adults)

| Nutrient | NRV | Nutrient | NRV |
|---|---|---|---|
| Vitamin A | 800 µg | Potassium | 2000 mg |
| Vitamin D | 5 µg | Chloride | 800 mg |
| Vitamin E | 12 mg | Calcium | 800 mg |
| Vitamin K | 75 µg | Phosphorus | 700 mg |
| Vitamin C | 80 mg | Magnesium | 375 mg |
| Thiamin | 1.1 mg | Iron | 14 mg |
| Riboflavin | 1.4 mg | Zinc | 10 mg |
| Niacin | 16 mg | Copper | 1 mg |
| Vitamin B6 | 1.4 mg | Manganese | 2 mg |
| Folic acid | 200 µg | Fluoride | 3.5 mg |
| Vitamin B12 | 2.5 µg | Selenium | 55 µg |
| Biotin | 50 µg | Chromium | 40 µg |
| Pantothenic acid | 6 mg | Molybdenum | 50 µg |
| | | Iodine | 150 µg |

**Significant amount rule (Part A, point 2):** 15 % of the NRV supplied by
100 g or 100 ml (products other than beverages); 7.5 % per 100 ml for
beverages; 15 % per portion where the package contains a single portion.

### 5.2 Part B — Reference intakes for energy and selected nutrients other than vitamins and minerals (adults)

| Energy or nutrient | Reference intake |
|---|---|
| Energy | 8400 kJ / 2000 kcal |
| Total fat | 70 g |
| Saturates | 20 g |
| Carbohydrate | 260 g |
| Sugars | 90 g |
| Protein | 50 g |
| Salt | 6 g |

### 5.3 What changes for a British user

| App key | US (current) | UK (adults) | Difference |
|---|---|---|---|
| fat | 78 g | 70 g | 8 g |
| carbs | 275 g | 260 g | 15 g |
| sugar | none (no US total-sugars DV) | 90 g (total sugars) | new in the UK |
| satFat | 20 g | 20 g | — |
| **vitaminD** | **20 µg** | **5 µg** | **4×** |
| **calcium** | **1300 mg** | **800 mg** | 500 mg |
| **folate** | **400 µg DFE** | **200 µg folic acid** | different basis — see below |
| vitaminB12 | 2.4 µg | 2.5 µg | 0.1 µg |
| vitaminA | 900 µg | 800 µg | 100 µg |
| vitaminC | 90 mg | 80 mg | 10 mg |
| **magnesium** | **420 mg** | **375 mg** | 45 mg |
| **iron** | **18 mg** | **14 mg** | 4 mg |
| **zinc** | **11 mg** | **10 mg** | 1 mg |
| sodium | 2300 mg | not an NRV in Annex XIII (salt 6 g is) | see below |
| potassium | 4700 mg | 2000 mg | 2700 mg |
| fibre | 28 g | not in Annex XIII | no value |
| cholesterol | 300 mg | not in Annex XIII | no value |

**Three of these are not simple substitutions.**

1. **Folate.** The US value is *400 µg dietary folate equivalents (DFE)*; the
   UK value is *200 µg folic acid*. They are **different quantities** and are
   not interchangeable. Showing one under the other's label would be wrong.
2. **Sodium.** Annex XIII does not set a sodium NRV; it sets **salt, 6 g**
   (which is approximately 2400 mg sodium). The app's sodium key needs a
   decision: either the UK table carries sodium as a derived figure with the
   conversion stated, or the UK sodium row shows no reference value. **The
   research table takes the second route: `GB_REFERENCE_VALUES` has no sodium
   entry, and the salt reference intake is recorded separately as
   `GB_SALT_REFERENCE_INTAKE` so it can never be offered for sodium.**
3. **Age scope.** Annex XIII as read is **adults**. Children's labelling values
   are not in this annex, and the app's audience is 18+. The specification
   therefore adopts the adult column and says so; a children's table would be
   a separate exercise.

Two more gaps are deliberate and are not filled in from anywhere else:
**fibre and cholesterol are not in Annex XIII**, so the United Kingdom has no
reference value for either. The United Kingdom's Nutrient Reference Intakes
and Dietary Reference Values are individual dietary requirements, not
labelling values, and are not substituted here.

### 5.4 United Kingdom open items

- **Salt versus sodium**, as above.
- **Rounding rules for %NRV declarations.** The Annex does not set them; they
  are in the labelling guidance. Must be confirmed before the app renders a
  %NRV.
- **Whether the retained EU regulation remains the operative labelling
  instrument**, and any amendments applied since. legislation.gov.uk records
  *"no known outstanding effects"* for Annex XIII, but the app must not
  present this as legal advice.
- **The UK Food Labelling dataset** (FN-NBRI) is a labelling-specific
  restatement of CoFID; it is **not** a source of reference values, and it is
  not licensed for commercial use either.

## 6. The proposed shape of the reference-value table

One table, per market, versioned, with the source and the review date attached
to every value:

```ts
export interface ReferenceValue {
  /** The denominator for the percent daily value, in the app's unit. */
  value: number;
  /** The unit the value is expressed in. */
  unit: "g" | "mg" | "mcg" | "kcal";
  /**
   * The basis of the value, which is not always the same as the app's key.
   * "folate" is 400 ug DFE in the US and 200 ug of folic acid in the UK.
   */
  basis?: string;
  /** The population the value applies to. */
  scope: "adults" | "children-1-4" | "infants-6-12" | "any";
}

export interface MarketReferenceValues {
  market: "US" | "CA" | "GB";
  /** The instrument the values come from. */
  source: string;
  sourceUrl: string;
  /** The version of the instrument. */
  version: string;
  /** When the values were checked. */
  reviewed: string;
  values: Partial<Record<AppNutrientKey, ReferenceValue>>;
}
```

Rules:

1. **A market with no confirmed table shows no number.** The UI renders "no
   regional reference value", never a number borrowed from another market.
2. **`basis` is mandatory when it is not the obvious one.** A UK folate row must
   say it is folic acid.
3. **`scope` is mandatory.** A value is only shown for a population it applies
   to. The app's audience is adults, so a children-only value is not used.
4. **The US table remains the default** so nothing changes for a US user and
   no existing test moves.
5. **No value is derived by arithmetic without the derivation being written
   down.** Salt→sodium is the only likely case, and it is called out above as
   an open decision.

## 7. What is explicitly out of scope

- The app's calorie, protein, glucose and medical targets. Unchanged.
- The insulin safety notices. Unchanged.
- Any statement to the user that a given intake is "enough" or "too much" for
  them personally. The app may show a labelling percentage; it may not turn
  that into personal advice.

## 8. Approval gate for M2-1

M2-1 may not start until:

1. legal has confirmed which instrument governs each market and that the
   values may be reproduced in the app;
2. clinical has confirmed the age scope and that the labelling values may be
   shown as a labelling percentage in a consumer app;
3. the table above is approved, with the non-substitutions (folate basis,
   salt/sodium, age scope, and the absent fibre and cholesterol values)
   resolved or explicitly left as "no value shown".

## 9. The specification as code

The tables above are expressed in `research/reference-values.ts` and pinned by
`tests/m2-reference-values.test.ts` (12 deterministic tests). That module is
**research only**: it is not imported by `src/` or `server/`, and every table
carries `approved: false` until the review above happens.

The tests include the guarantee that matters most for the shipping app:
**the United States table is compared against the app's own `nutrientInfo`
table, key by key, and must match it exactly** — so switching the app onto
these tables cannot change a single number for a United States user. The same
file also asserts the added-sugars substitution is impossible, that Canada
keeps its 3400 mg potassium, that the United Kingdom keeps its 5 µg vitamin D,
that salt is never offered for sodium, and that no market borrows another's
value.
