# M2-3 - Source-aware catalogue runtime: design

**Status: a design, not an implementation.** Nothing in this document has been
built. M2-3 production work is not authorised. This file records the design
that was reviewed and accepted as a direction, with the three corrections the
review required.

## 1. Architecture comparison

The three candidates were measured on the real data, from the strictly
verified sources (`pipeline/reports/benchmark-us-ca.json`):

| | bytes | gzip | parsed at start-up | heap (Node.js) |
|---|---|---|---|---|
| **A** one merged catalogue | 40.6 MB | 1.70 MB | 40.6 MB, ~361 ms | 135 MB |
| **B** one catalogue per market | 40.6 MB | 1.70 MB | the market in use: 22.6 MB (US) / 17.7 MB (CA), ~172 ms | 45 MB (US) / 57 MB (CA) |
| **C** search index, detail apart | 37.5 MB | 1.55 MB | the index only: 925 KB, ~11 ms | 3 MB |

**These are Node.js figures on a desktop.** They are not Android or iPhone
runtime performance, and they do not select an architecture. See §2.

**Correction 3 applies to B.** The single-market figure is not the runtime
budget. A Canadian user needs, at the same time:

- Canadian search results;
- United States fallback foods, when a Canadian equivalent is not approved;
- the existing United States recipe ingredients;
- the search token indexes;
- the cached detail of the foods that were opened.

So B has to be measured with all of that resident, not with one market
alone, and both together and lazily loaded. **Architecture B and
architecture C have not passed native-device acceptance, and this document
does not claim that they have.**

The design position is: **B is the baseline to measure, C is the target to
reach if the measurements justify it**, and the choice is made on device
evidence, not on the Node.js table.

## 2. React Native and Expo constraints, and the benchmarks still required

The catalogue is 40 MB of JSON. It cannot go into the Expo bundle, so it has
to be an asset or a download, and both change the install story and the
update story.

Required before the runtime is written, on a physical device, not on Node:

| Benchmark | What it decides |
|---|---|
| cold start to the first food screen, with the catalogue present, 30 runs, p50 and p95 | whether the catalogue is loaded eagerly, lazily, or on a background thread |
| JS heap high-water mark during a catalogue load | whether one market fits, and whether the detail store can be held |
| memory warning behaviour (iOS jetsam, Android `onTrimMemory`) | when the cache has to be dropped |
| search latency, cold token table and warm | whether the token index is precomputed, and how big it may be |
| search latency with **both** markets resident (B) and with the detail cache | the real budget, per correction 3 |
| time to first usable result with the Canadian market *and* the United States fallback | the combined scenario |
| the bundle and download size of each candidate | the install and the OTA story |
| behaviour with no network and with the Canadian asset absent | the offline story |

Deliverable: `docs/m2/M2_3_DEVICE_BENCHMARKS.md`, with the raw numbers and
the device they came from, before the runtime is written.

## 3. Backward-compatible identifiers

- The United States catalogue stays **v1**, exactly as it is. A **v2 reader**
  accepts both v1 and v2, and the app keeps loading `src/data/usda-foods.json`
  unchanged until a decision says otherwise.
- `usda:<ndb>` keeps meaning exactly what it means today, because it is
  persisted in `Meal.foodId`. `foodById` must dispatch on the **prefix**;
  today it strips `usda:` and parses a number, so a `cnf:` id would become
  `NaN` and silently return null.
- **`cnf:<Food_Code>` is the canonical Canadian identifier.** There is no
  `ca:` namespace. The identifier has to name the publication the record
  came from.
- `recipe:<id>` is untouched.
- A Canadian record and its United States cross-reference are **not the same
  identity**. The CNF names a United States number for 4,798 of its 5,993
  foods; that is a statement about origin. The Canadian record keeps its own
  identifier, its own values and its own provenance, and it is never merged
  with the United States one.
- **Nutrient equivalence is never approved automatically.** A cross-reference
  or a matching name does not create one. The two Canadian records whose
  source contradicts itself, `cnf:5224` and `cnf:7529`, are recorded as
  reviewed and not approved, and the alias registry refuses them.
- A pinned test enumerates every `usda:` id in the repository's fixtures and
  asserts it still resolves to the same values.

## 4. Ingredient aliases and recipe dependency safety

M2-4's foundation is in place: the canonical registry, its validation, and
the resolution contract. The runtime uses it; the foundation does not change
the engine.

**Correction 2 applies.** The rule is not "drop the missing ingredient and
carry on". It is:

- exact ingredient quantities and dependencies are preserved;
- a **reviewed, nutritionally appropriate** alias is preferred;
- an ingredient that cannot be resolved makes the recipe **incomplete** or
  **unavailable**;
- a partial nutrient calculation is **never** presented as a complete
  recipe;
- a different food is never silently substituted, and a nutrient is never
  invented as zero;
- the United States recipe behaviour and results are unchanged.

A missing ingredient must not turn chicken curry into a materially different
food while the app keeps claiming complete nutrition. The screen says which
ingredient is missing, and the numbers are not presented as the dish.

The alias table has to land **before** any catalogue refresh, and M2-3
depends on it. The order is: **M2-4 foundation (done) → reviewed market
mappings → M2-3 runtime → catalogue refresh**.

## 5. Food search ranking and deduplication

- The existing bands stay: popular at 1000, recipe dishes at 900, raw rows
  at 500, and every scoring adjustment with them.
- The United States ordering must be **byte-identical** to today, checked by
  a golden file of the current top results for a fixed query set.
- A market's own rows are searched in the same bands, and the **United
  States rows remain searchable**, so a Canadian user can still find "chicken
  breast" when no Canadian equivalent has been approved.
- Deduplication is by **canonical ingredient key**, not by name. A Canadian
  record and a United States record that a reviewer has approved as the same
  ingredient are one food to the user and two records to the app. Only a
  reviewed alias may merge them; a name match may not.
- An unapproved pair is **not** deduplicated, and the search says where each
  record came from.

## 6. Nutrient completeness, provenance and uncertainty

- The `known` / `partial` / `unknown` contract in `src/core/food-log.ts` is
  used unchanged. No second aggregation is introduced.
- Each value carries the source's own quality - `analysed`, `calculated`,
  `imputed`, `inherited`, `estimated`, `documented-zero` - and the app states
  it, so a user can see that a value was calculated rather than measured.
- The blanket `uncertainty` of 0.1 / 0.2 / 0.25 is replaced by the
  **source's own evidence**: the value's quality, and for the Canadian
  records the published observations and standard error. It is a **state**,
  not a confidence interval computed from a sample count.
- An unknown value stays unknown, and a documented zero stays a zero.
- The refusal and the edible portion travel with the record, so a Canadian
  food's numbers can be read against the right basis.

## 7. Safe market selection and international behaviour

- The market follows the profile's country through M1's `regionFor`, and a
  manual country choice always wins.
- A profile with no country keeps today's behaviour.
- A market with no catalogue falls back to the United States **and says so
  on the food screen**, with the source labelled. A fallback is never
  silent.
- The market is chosen at read time, not baked into stored meals, so
  changing a profile's country does not rewrite history.
- The United Kingdom stays out: nothing from CoFID is fetched, built or
  shipped.

## 8. Migration, rollback and offline operation

- The catalogue file is a versioned asset. The app reads the one it ships
  with and never writes it.
- The United States file stays exactly as it is; the Canadian file is added
  beside it. A rollback is removing the Canadian asset and turning the flag
  off, with no data migration.
- Offline is the default. The catalogue is a local asset, so no food lookup
  needs the network.
- A catalogue refresh is a content change, not a schema change. A newer file
  with the same schema is picked up by asset versioning; a schema change
  needs the v2 reader and a migration in the builder, never in the app.
- Every persisted `Meal.foodId` must resolve against every catalogue version
  the app has shipped, which is why the alias registry and the identifier
  rules come first.

## 9. Feature flags, acceptance tests and release gates

A build-time flag per market, defaulting to the United States only. It is
**not** `ENABLED_MARKETS`, which belongs to the labelling tables and means
something else.

| Gate | Statement |
|---|---|
| G3.1 | every persisted `usda:` id still resolves, checked by a pinned test |
| G3.2 | the United States search golden file is unchanged |
| G3.3 | the `known` / `partial` / `unknown` contract is unchanged, with no second aggregation |
| G3.4 | the catalogue's per-food metadata is present and complete |
| G3.5 | a Canadian user's screens show Canadian values with Canadian credit, and a United States user's screens are byte-identical to today |
| G3.6 | cold start and memory are inside a stated budget **on a physical device** |
| G3.7 | the app works with the network off, and with the Canadian asset absent |
| G3.8 | an unresolved ingredient makes the recipe incomplete, and the screen says so |

## 10. Exact dependency and licensing blockers

- **Canada.** The CNF is permitted on the OGL-Canada reading, but the legal
  review is recorded as `published-licence`, not as clearance.
  **Distribution is blocked until legal signs off on attribution**: the app
  must carry the Health Canada credit and the Open Government Licence notice.
- **United Kingdom.** CoFID stays excluded. The GOV.UK workbook, the "old
  foods" file and the FN-NBRI Food Labelling dataset are uncleared, and the
  CoFID API is published under CC BY-NC-SA 4.0, which prohibits use in a paid
  product. Nothing from the United Kingdom is fetched, built or shipped.
- **Attribution in the app.** `foodCredits` and `sourceDescriptions` need
  per-market entries with the licence wording, and `foodCatalogCredit`
  becomes per market. This is a code dependency of M2-3, not a later tidy-up.
- **No new npm dependency is proposed.** The runtime needs nothing the app
  does not already use.
- **Still open:** the Canadian licence review, and the device benchmarks.
  Both are gates, not preferences.
