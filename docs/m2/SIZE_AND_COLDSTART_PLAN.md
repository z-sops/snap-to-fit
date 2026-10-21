# Dataset size and cold-start benchmarking plan

**Purpose:** decide, with numbers, how the catalogue is shipped — as one
bundled file, as per-market files, or as a downloaded artefact — before any
data is built.

**Status:** plan. No measurement has been taken on a device, and this milestone
adds no data.

---

## 1. What we know today

| Artefact | Size | Rows | Notes |
|---|---|---|---|
| `src/data/usda-foods.json` | 1,420,723 B (1.42 MB) | 8,257 | SR Legacy, 19 nutrients, compact tuple rows |
| `src/data/exercises.json` | 709,372 B (0.71 MB) | 876 | |
| `src/components/movement-html.ts` | 4,055,918 B (4.06 MB) | — | Generated Three.js bundle, already the largest asset |

The food catalogue is **not** the biggest thing in the app today, but it is the
one that grows.

## 2. What the merged catalogue would weigh

Projections, from the sources verified in M2-0:

| Source | Foods | Nutrient rows | Raw CSV | Note |
|---|---|---|---|---|
| USDA SR Legacy (already bundled) | 8,257 | 8,257 × 19 | — | 1.42 MB today |
| USDA Foundation Foods (2026) | ~1,000+ | — | 32 MB unzipped CSV | Adds analytical depth, not breadth |
| CNF 2026 | 5,993 | 565,409 | 21.1 MB | 54.9 % dense; ~94 nutrients per food on average |
| CoFID 2021 (if licensed) | 2,887 + 393 | — | Excel | Energy in kJ; needs a conversion |

**A straight merge of SR Legacy + CNF would be roughly 14,250 foods.** At the
current encoding — a compact row of numbers plus a name and two servings — a
row costs roughly 120–180 bytes, so:

| Scenario | Estimate | Notes |
|---|---|---|
| SR Legacy only (today) | 1.4 MB | measured |
| + CNF 2026, same 19 nutrients | **≈ 2.3–2.6 MB** | the CNF's 19 mapped nutrients only |
| + CNF 2026, all 172 nutrients | ≈ 3.5–4.5 MB | only worth it if the app shows them |
| + CoFID, if licensed | ≈ 3.0–3.5 MB | |
| + full per-value provenance metadata | **× 1.3–1.6** | a source code and a state per value is not free |

**The provenance metadata is the expensive part, and it is the part that
matters.** Storing a quality state and a source code for every value of every
food is what makes the catalogue honest, and it is what pushes a merged
catalogue towards 4–6 MB.

## 3. The shape of the decision

Three options, with the trade-off that matters for each.

### Option A — one merged file, bundled

- **Size:** 4–6 MB inside the app binary.
- **Cold start:** the catalogue is `require`d lazily today (`dataset()` in
  `src/core/foods.ts:62`), so it costs nothing until a food function is
  called. A merged file keeps that property.
- **Cost:** every user in every market downloads all three countries' data.
- **Good when:** the total stays under roughly 5 MB and the market is chosen at
  build time.

### Option B — one file per market, bundled, loaded on demand

- **Size:** the binary carries all three, but the JS bundle only parses the one
  the user needs.
- **Cold start:** unchanged, because the current loader is already lazy.
- **Cost:** still ships every market's data to every user.
- **Good when:** per-market files are needed anyway for the credits and the
  ranking, and the total is acceptable.

### Option C — catalogue downloaded after install

- **Size:** the binary stays at today's size; the catalogue is fetched once
  and stored in the app's data directory, with the checksum from the manifest
  verified before use.
- **Cold start:** the first food search needs a download. This is a real
  product cost: a user who opens the food screen offline on day one sees
  nothing.
- **Good when:** the catalogue is large, changes often, or must be refreshed
  without an app release.
- **Requires:** a signed, checksummed download, an offline story, and a
  fallback to the bundled US data.

**Recommendation: Option B, with Option C kept in reserve.** The catalogue is
data that changes on the publisher's schedule, not on ours, which argues for
C — but C makes the first-run experience worse, and our catalogue is small
enough that B is defensible. The decision is revisited if the merged catalogue
passes 6 MB.

## 4. What to measure

A benchmark script, run on a physical device before the catalogue is built.

### 4.1 Size

| Measurement | How | Budget |
|---|---|---|
| raw source bytes | the manifest's per-file checksums | known |
| generated artefact | `wc -c` on the built file | ≤ 5 MB, hard ceiling 6 MB |
| delta against the current file | artefact bytes − 1,420,723 | reported |
| compressed size | gzip, as a store binary | reported |
| per-market split | bytes per market file | reported |
| metadata overhead | bytes with provenance ÷ bytes without | **≤ 1.6×** |

### 4.2 Cold start

| Measurement | How | Budget |
|---|---|---|
| module load time | `performance.now()` around the first `require` of the catalogue, on a physical device, release build | ≤ 120 ms for the US file |
| first search latency | first `searchFoods()` call, cold | ≤ 150 ms |
| steady search latency | 100 searches, warm | ≤ 8 ms each |
| first meal-plan build | `buildMealPlan()` cold | ≤ 200 ms |
| memory | resident set after loading the catalogue | ≤ 12 MB |

**The current numbers must be measured first, as a baseline.** The budgets
above are proposals; the real gate is *no worse than today's catalogue by more
than 50 %* on cold start.

### 4.3 Build and export

| Measurement | How | Budget |
|---|---|---|
| `npx expo export --platform all` wall time | before and after | ≤ +30 s |
| exported bundle size | before and after | reported |
| CI job time | before and after | ≤ +60 s |

## 5. The measurement harness

`research/bench/` is the intended home. It must:

- run against the **committed** catalogue, not a download;
- be runnable on a device through a development build, and on CI against Node;
- print a single machine-readable summary so a regression is a diff, not a
  judgement call;
- never be a gate on a machine whose numbers cannot be compared to a phone's.
  CI compares **sizes**; latency budgets are checked on a device.

**Nothing in this plan is implemented in M2-0.** The plan exists so that
M2-2 makes an informed size decision instead of discovering the problem after
the data is built.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Provenance metadata makes the catalogue 1.6× bigger than the values | Store the source code once per food and a per-nutrient state only where it differs from the food's default. Most foods inherit a single provenance. |
| A merged catalogue is too big for a store binary | Option B or C, decided before the build. |
| A downloaded catalogue (Option C) is stale or tampered with | Checksum from the manifest, verified before use; refuse to use a catalogue that does not match. |
| The catalogue changes more often than the app | This is the strongest argument for Option C and for a refresh mechanism; it is a product decision, not an engineering one. |
| Building for three markets triples the build time | Builders are incremental and cached by input checksum. |
