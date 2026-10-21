# The ingredient alias table: the contract M2-4 must satisfy

**Status: contract only. Nothing here is implemented.**

This is the document M2-4 is built against, and the reason M2-4 has to land
**before** any catalogue refresh rather than after it.

## The problem, stated exactly

`recipeFood()` in `src/core/foods.ts` throws when a recipe names an
ingredient the catalogue does not have:

```ts
const row = byId.get(id);
if (!row) throw new Error(`Recipe ${r.id} uses missing USDA food ${id}`);
```

Every recipe and every dish addresses its ingredients by a **USDA number**,
and those numbers are the only thing tying the meal plan to the catalogue
that happens to be shipped. So a catalogue regeneration is not a data change;
it is a change to the meaning of every recipe, and a single missing row
breaks the meal plan outright rather than degrading it.

The numbers in the repository today:

| What | How many | Where |
| --- | --- | --- |
| `popular` entries, addressed by USDA number | 74 | `src/core/foods.ts` |
| recipes | 116 | `src/core/foods.ts` |
| distinct ingredient numbers used by those recipes | 138 | `src/core/foods.ts` |
| persisted food ids in a user's history | any number of `usda:<ndb>` | `Meal.foodId` |

## The contract

### 1. Ingredients are addressed by a stable canonical key

A recipe part is a canonical key and a gram weight. The key names the
*ingredient*, not a row:

```
chicken breast            ->  ingredient:chicken-breast
white rice, cooked        ->  ingredient:rice-white-cooked
whole milk                ->  ingredient:milk-whole
```

The key is a string, it is not derived from any publisher's identifier, and it
does not change when the catalogue is refreshed. A key is the app's own
vocabulary; the sources are matched to it.

### 2. The alias table maps a key to a source id, per market, in order

```jsonc
"ingredient:chicken-breast": {
  "US": ["usda:5064", "usda:5098"],
  "CA": ["ca:5224", "ca:5226"]
}
```

- The list is **ordered**: the first entry is preferred, the rest are
  fallbacks.
- Each market's list is resolved against that market's own catalogue. A key
  never resolves to an id that does not exist in the market being used.
- A key with no entry for a market falls back to the market's default order
  (today: the United States), and says so in the record.

### 3. The table is seeded from the numbers in use today

The seed is the current 74 popular numbers and the current 138 recipe
ingredient numbers. The seeding rule is strict:

> For every popular entry and every recipe ingredient that exists today, the
> alias table must resolve, in the United States, to **the same id that
> resolves today**.

A test enumerates all of them and compares against the current behaviour.
This is gate G4.2, and it is the reason the seed is not "a sensible set of
aliases" but "the exact set that is in use".

### 4. Resolution never throws

If a key resolves to nothing in a market, the ingredient is **dropped** and
the recipe is built from the ingredients that did resolve, with the gram
weights of the missing ones excluded from the total. The recipe still
renders. It does not throw, and it does not silently claim a weight it does
not have.

- The gram total is the sum of the parts that resolved, not the sum that was
  written in the recipe. A recipe that loses an ingredient is a smaller
  recipe, and says so.
- The dropped ingredient is recorded on the built recipe, so the screen can
  say "this dish is missing its yoghurt" rather than quietly serving a
  different dish.
- A recipe that loses ingredients worth more than a stated threshold is
  flagged for review, not shipped silently.

This is gate G4.3, and it is a change to `recipeFood()`'s contract, so it is
a change to the app and not only to the data.

### 5. A canonical key is never invented at runtime

The keys are data, in a file, reviewed like code. The builder does not
generate a key for a food it has not been given one for; a food with no key
keeps its own id, and the alias table simply does not mention it.

## What the alias table must not do

- It must not change the numbers in the United States catalogue. The shipped
  catalogue stays byte-identical through M2-4.
- It must not renumber a persisted `Meal.foodId`. A `usda:` id in a user's
  history keeps meaning what it means today, which is gate G3.1 in the
  work packages and the reason the id prefix is not cosmetic.
- It must not rank foods differently. The search bands — popular at 1000,
  recipe dishes at 900, raw rows at 500 — are untouched by M2-4, and the
  United States order stays exactly as it is.
- It must not turn a missing ingredient into a zero. An ingredient that does
  not resolve contributes nothing, and is not a nutrient of zero.

## The order of work

```
M2-4 (this contract)  ->  a catalogue refresh  ->  M2-3 runtime
```

A refresh before M2-4 is what the throwing `recipeFood()` turns into a
production incident. A refresh after M2-4 is a data change, which is what a
data change should be.

## The gates, restated

| Gate | Statement | How it is checked |
| --- | --- | --- |
| G4.1 | every alias resolves in every market that ships | a test that resolves every key in every enabled market, against the catalogue that ships |
| G4.2 | the United States meal plan is identical before and after | the existing `tests/planning.test.ts` assertions, plus a test that enumerates the 74 popular and 138 recipe numbers and compares the resolution |
| G4.3 | no production path can throw on a missing ingredient | a test that resolves a recipe whose ingredients are absent, and asserts that it returns a recipe rather than throwing |
