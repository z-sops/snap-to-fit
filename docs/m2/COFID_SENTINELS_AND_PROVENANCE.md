# CoFID — sentinel values, provenance and interpretation

**Dataset in scope:** McCance and Widdowson's *The Composition of Foods
Integrated Dataset* (CoFID) 2021, as published on GOV.UK, plus its "old foods"
file and the FN-NBRI derivatives.

> **Engineering specification. Not a licence clearance.**
> **No CoFID file has been downloaded, parsed or redistributed for this
> project**, because its commercial-use terms are unresolved
> (`docs/m2/UK_LICENCE_QUESTION.md`). Everything below is taken from the
> publisher's own published documentation.

---

## 1. Where the rules come from

| Fact | Published by | URL |
|---|---|---|
| Nutrient values are per 100 g (per 100 ml for alcoholic drinks) | CoFID 2021 user guide, "Data formats" | https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/971021/McCance_and_Widdowsons_Composition_of_Foods_integrated_dataset_2021.pdf |
| Sentinels: `( )` estimated, `Tr` trace, `N` no reliable amount | CoFID user guide, "Notes on the data values" | same |
| Footnotes are attached to values in square brackets | CoFID user guide | same |
| 2,887 foods in the main dataset, 393 in the "old foods" file | FN-NBRI, "Nutrients" | https://fnnbri.quadram.ac.uk/data/ |
| 13 worksheets and their contents | CoFID user guide | as above |
| CoFID 2021 corrections (vitamin C in watercress, iodine in soya yogurt, vitamin E / sugars / biotin in sweet potato) | GOV.UK publication page | https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid |
| Analytical surveys that updated it (milk 2025, pork 2020, fruit and vegetables 2017 and 2013, eggs 2013, fish 2013, processed foods 2013, biscuits/buns/cakes 2011) | FN-NBRI | https://fnnbri.quadram.ac.uk/data/ |

## 2. The sentinel values

CoFID does not use blanks the way USDA does. It uses three textual markers in
the nutrient cells.

| Sentinel | Published meaning | Normalised state | Stored as a number? |
|---|---|---|---|
| `N` | *"Where a nutrient is present in significant quantities, but there is no reliable information on the amount, the value is represented by N."* | `unknown` | **No.** There is no number. |
| `Tr` | *"A trace value for a nutrient is represented by Tr."* | `trace` | **No.** A trace is present but unquantified. It must never become a 0 mg, and it must never become a 100 g-basis zero. |
| `( 1.2 )` | *"Nutrient values within round brackets, ( ), are estimated."* | `estimated` | Yes — 1.2, with the state `estimated`. |
| empty cell | no value published for that cell | `unknown` | No. |
| `0` | a zero the source stands behind | `documented-zero` | Yes — 0, with the state `documented-zero`. |

**The three mistakes this table exists to prevent:**

1. **A trace turned into a zero.** `Tr` means "a little". Rendering it as
   `0 mg` is a false measurement, and it also makes the food look deficient in
   a nutrient it may well contain.
2. **An estimate treated as a measurement.** `( 1.2 )` is a number the compiler
   judged reasonable. Storing it as an analysed value overstates its quality.
3. **An `N` treated as zero.** `N` means the amount is not known, not that it
   is nothing.

Implemented in `research/normalize.ts` as `normalizeCofidValue`, and pinned by
`tests/m2-normalization.test.ts` against a **synthetic** fixture.

## 3. Footnotes

CoFID attaches food-specific footnotes to values in square brackets, for
example `1.2 [1]`. The footnotes are published in the *Nutrient Footnotes*
worksheet.

**Rule:** a footnote is provenance, not a separate value. The number is kept
and its state is downgraded to `estimated` when the footnote marks it as
derived or imputed. The footnote text must be carried alongside the value so
the app can say *why* a figure is what it is, or drop the figure if the
footnote says the value is not usable.

The CSV-equivalent footnote list is not published in a machine-readable form
alongside the 2021 workbook, so the footnote handling is **specified but not
implemented** until the licensed data is in hand and its structure is
confirmed.

## 4. Quality states used for CoFID

CoFID does not publish a per-value provenance code list the way CNF does. The
state of a CoFID value is therefore derived from the sentinel and the
worksheet it came from:

| Origin | State |
|---|---|
| a plain numeric value in a nutrient worksheet | `analysed` |
| a bracketed value | `estimated` |
| `Tr` | `trace` |
| `N` | `unknown` |
| `0` | `documented-zero` |
| a value in the *Proximates* worksheet that the compiler flagged by footnote | `estimated` |

**This is weaker than CNF's provenance and the app must say so.** Where CNF
tells us "analysed in a Canadian government lab" for a value, CoFID only tells
us "a number, in a worksheet, possibly with a footnote". A future improvement
would be to cross-reference the *Analytical Surveys* list published by FN-BRI
to attribute a food to the survey that measured it — but that mapping is not
available in a machine-readable form today.

## 5. Worksheets and the app's 19 nutrients

CoFID's 13 worksheets are: Factors, Proximates, Inorganics, Vitamins, Vitamin
Fractions, Saturated fatty acids per 100 g fatty acids, Saturated fatty acids
per 100 g food, Monounsaturated fatty acids per 100 g fatty acids,
Monounsaturated fatty acids per 100 g food, Polyunsaturated fatty acids per
100 g fatty acids, Polyunsaturated fatty acids per 100 g food, Other fatty acids
per 100 g food, Phytosterols, Organic acids, Labelling, Nutrient Footnotes.

The app's 19 keys map onto:

| App key | CoFID worksheet | Note |
|---|---|---|
| calories | Proximates (energy, kJ) | CoFID publishes energy in **kilojoules**; the app stores kilocalories. A conversion is required, and the conversion factor and its rounding rule must be specified. This is a real difference from CNF, which publishes `ENERC_KCAL` directly. |
| protein, carbs, fat, fibre, sugar | Proximates | |
| satFat | Saturated fatty acids per 100 g food | Note the two sheets: "per 100 g fatty acids" is a *composition* figure, "per 100 g food" is the *food* figure. The app wants the food figure. Picking the wrong sheet is a plausible and consequential error. |
| sodium, potassium, calcium, iron, magnesium, zinc | Inorganics | |
| vitaminC, vitaminD, vitaminB12, folate, vitaminA | Vitamins | |
| cholesterol | — | **CoFID does not publish total cholesterol.** The app's `cholesterol` key has no UK equivalent in the cited worksheets and must be recorded as unknown for UK foods, not substituted. |

The "Labelling" worksheet is CoFID's own restatement for nutrition labelling
and is a *different* dataset from the nutrient sheets. It is not a substitute
for them and is not used for the app's nutrient values.

## 6. Units

CoFID nutrient values are per 100 g of food, except alcoholic beverages which
are per 100 ml. The app stores per-100 g. Any alcoholic beverage therefore
needs a density decision, which does not exist today and must be specified
before any alcohol is ingested.

## 7. Provenance the app must show

For every UK food, the app must be able to say:

- the source: *"UK food composition data: McCance and Widdowson's Composition of
  Foods Integrated Dataset (CoFID) 2021, Public Health England"* — with the
  licence wording **once G1 has cleared it**;
- the version: 2021, and the fact that only selected foods have been re-analysed
  since (milk 2025, pork 2020, fruit and vegetables 2017 and 2013, eggs 2013,
  fish 2013, processed foods 2013, biscuits/buns/cakes 2011);
- whether the value was estimated, a trace, or not known;
- for the "old foods" file, that the value was **not reviewed** in the 2015,
  2019 or 2021 updates.

## 8. What is explicitly not decided here

- Whether CoFID may be used commercially at all. That is
  `docs/m2/UK_LICENCE_QUESTION.md` and it is a blocker, not a detail.
- The precise kJ→kcal conversion factor and rounding rule. It is specified as
  required work, not as a decision.
- The alcohol density rule.
- The CNF↔CoFID cross-reference for foods present in both.
