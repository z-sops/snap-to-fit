# Canadian and United States records: what a cross-reference would mean

**Status: a decision, not an implementation.**

## The decision

Two kinds of cross-reference are treated differently.

**The publisher's own is carried through.** The Canadian Nutrient File
publishes a `USDA_NDB_Code` for many of its foods: for 4,798 of its 5,993
foods, naming 4,622 distinct United States records. That is Health Canada's
own statement about which United States record a Canadian food came from, so
the pipeline carries it as a `crossReference` on the record, unchanged.

It is **not** an identity. The Canadian food keeps its own identifier, its
own provenance and its own values. The pointer is a statement about origin,
not permission to merge the two records or to prefer one set of numbers over
the other.

**An inferred one is not built.** Nothing in the pipeline matches a Canadian
food to a United States food by name, by description, or by similarity. Where
the publisher states a correspondence, the pipeline carries it; where it does
not, the pipeline does not invent one.

## Why automatic matching would be wrong

**The identifiers mean different things.** A United States record is
addressed by its NDB number, and the app persists that number in
`Meal.foodId`. A Canadian record is addressed by the Canadian Nutrient
File's own food number. The numbers are not derived from one another, and
neither is a transformation of the other.

**The preparations differ.** The two catalogues describe different things
under similar names. A United States "chicken breast, roasted" and a
Canadian "chicken, broilers or fryers, meat only, cooked, roasted" are
close enough to look like a pair and different enough that the nutrient
values are not interchangeable. The name is not evidence of equivalence; it
is evidence that two datasets both contain chicken.

**The measurement basis differs.** The United States records are per 100
grams. The Canadian file describes food **as measured**, with portions,
serving sizes and densities in `Measure_Name.csv`, `Measure_Type.csv` and
`Measure_Weight_Conversion.csv`. Converting one to the other needs the
measure, not a name. That is why those three tables exist in the release, and
why the Canadian normaliser reads them.

**The nutrient coverage differs.** The Canadian release carries 172 nutrients
and reports them for 54.9% of the foods it lists. The 19 nutrients the app
maps are the part that overlaps. The rest is real data the app does not
model, and it is not evidence of anything about the mapped nutrients.

## A pointer that does not resolve

The catalogue the app ships is SR Legacy, 8,257 foods. The Canadian file
names 4,622 distinct United States records, and **209 of them are not in the
shipped catalogue**: the Canadian file was rebuilt from FoodData Central, so
some of the foods it names are newer records that carry an FDC identifier
rather than an NDB number, and some are NDB numbers that the shipped SR
Legacy selection does not include.

So the pipeline checks every pointer, and reports the ones that do not
resolve as findings, rather than leaving a pointer to nothing:

```
unresolved-cross-reference  the source names usda:28145210 as the matching
                             record, and this catalogue does not have it
```

220 of the 5,993 Canadian foods carry such a pointer in the full release. A
pointer that does not resolve is information, and it is shown as
information.

## The measured facts

| | United States | Canada |
| --- | --- | --- |
| records in the catalogue | 8,257 | 5,993 |
| nutrients published per record | 19, as the app maps them | 172 in total, of which 19 are mapped |
| rows of source data | the shipped catalogue | 565,409 nutrient rows |
| identifier namespace | `usda:<ndb>` | `ca:<cnf>` |
| commercial use | CC0 1.0, permitted | Open Government Licence — Canada, permitted |
| foods that name a United States record | — | 4,798 of 5,993 |
| of those, pointers that do not resolve | — | 220 foods, 209 distinct records |

## The one place a contradiction is kept, not repaired

The Canadian file contains rows whose own source code contradicts their own
amount. The `Nutrient_Source_Code` `12` means "assumed zero". On 65,805 of
the 65,887 such rows the amount is indeed zero, and the value is a documented
zero. On the other 82 it is not, and the row contradicts itself. Eighty of
those 82 have no observations at all; two have observations.

Two of those 82 land on a nutrient the app maps:

| Food | Nutrient | Amount | Observations |
| --- | --- | --- | --- |
| 5224 | 208, energy in kilocalories | 277 | 0 |
| 7529 | 601, cholesterol | 1 | none recorded |

The pipeline keeps both values, marks them `estimated`, and marks them
`needsReview`. It does not drop them, and it does not believe them. The
Canadian users' guide is explicit that a code `12` row without observations
is an assumed value, not a measurement, and an assumed value that is not zero
is an editorial carry-over.

This is the shape of the whole question. A Canadian record can be
defensible, and still not be a measurement, and the difference has to survive
into the app rather than being flattened by the pipeline.

## What a cross-reference beyond the publisher's would need

1. **A reviewed, hand-built mapping**, not a name match. A curated table of
   canonical keys, in the sense of
   `docs/m2/INGREDIENT_ALIAS_MIGRATION.md`, is the only form that would be
   defensible.
2. **A measure alignment** for each pair, so that a Canadian portion-based
   value and a United States per-100-gram value are on the same basis before
   they are compared.
3. **A stated rule for the pair's nutrient values**: which of the two is
   used, and what is said to the user about the other. A number that came
   from a different publication is still a number the user will act on.
4. **A decision about the licence and the credit**, per pair, because the
   Canadian values and the United States values carry different terms.

Until all four exist, the two catalogues stay separate, and the app shows a
Canadian user Canadian values, sourced and credited as Canadian.
