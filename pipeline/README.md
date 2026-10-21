# The offline food-data pipeline

This directory builds a normalised, provenance-carrying food catalogue from
published sources. It is **offline and reproducible**: the same pinned inputs
always produce the same output, byte for byte.

It is **not** part of the application. Nothing in `pipeline/` is imported by
`src/`, nothing here writes to `src/`, and no artefact produced here is
bundled. The application still runs on the catalogue it ships with.

## What it does

```
publisher archive ─┐
                   ├─► normaliser ─► merge ─► dataset ─► lint ─► report
repository artefact ┘
```

- **A normaliser per published format.** `pipeline/adapters/usda.ts` reads the
  catalogue the app already ships; `pipeline/adapters/cnf.ts` reads the
  Canadian Nutrient File's relational CSV files.
- **A merge step.** `pipeline/build/build.ts` joins the normalised records
  into one dataset, in a deterministic order, and writes the dataset and its
  manifest.
- **A lint.** `pipeline/build/lint.ts` records everything questionable in the
  sources as a finding, instead of quietly repairing it.
- **A measurement.** `pipeline/build/benchmark.ts` measures the three
  candidate architectures on the real data.

## Commands

| Command | What it does | Network |
| --- | --- | --- |
| `npm run data:verify` | Checks the pinned inputs against the manifest. Never downloads. | no |
| `npm run data:fetch -- <id>` | Downloads one publisher archive, verifies it, and unpacks it. | yes, on request only |
| `npm run data:build` | Builds the dataset from the cached sources into `pipeline/out/`. | no |
| `npm run data:bench` | Measures the three candidate architectures. | no |

`data:verify` is wired into CI. `data:fetch` is deliberately not: a build
must never reach the network on its own, and a download only happens when a
person asks for it.

The cache lives in `pipeline/.cache/` and the output in `pipeline/out/`. Both
are ignored by git, so a downloaded archive can never reach the application
bundle.

Two more scripts are for the evidence rather than for the build:

| Command | What it does |
| --- | --- |
| `node --import tsx pipeline/make-report.ts` | Writes `pipeline/reports/`, from the full sources. |
| `node --import tsx pipeline/analyse-conflicts.ts` | Measures the source contradictions the findings come from. |

## The manifest

`pipeline/manifest/sources.json` is the only place a download URL is allowed
to appear, and it is reviewed like code.

Every input states:

- the publisher, the dataset and the version;
- the licence, its URL, and the wording the publisher itself publishes;
- `commercial_use`: `permitted`, `prohibited` or `unresolved`;
- `legal_confirmation`: whether the legal review is recorded, and how;
- the SHA-256 and the byte length of the artefact, and of every file inside
  it.

Two things follow from that, and both are enforced in code:

1. **Fail closed.** A source whose commercial use is not `permitted` cannot
   be fetched and cannot be built. A licence question cannot be settled by
   accident, or by a build that someone forgot to look at.
2. **Fail on a checksum change.** Every input is checked against its pinned
   digest, and so is every file inside an archive. A changed publisher file
   fails the build, and fails CI.

The United Kingdom source is recorded in `excluded`, with the reason: the
commercial-use terms are unresolved, and the CoFID API is published under
CC BY-NC-SA 4.0, which does not permit use in a paid product.

## The record

Every food carries the nutrients the app knows about, in the app's own
canonical keys, plus the evidence for each one:

```jsonc
{
  "id": "ca:5224",
  "name": "Chicken, broilers or fryers, meat only, cooked, roasted",
  "region": "CA",
  "per100": { "energy_kcal": 277, "protein_g": 27.3 },
  "nutrients": {
    "energy_kcal": {
      "value": 277,
      "quality": "estimated",
      "source": "Canadian Nutrient File 2026",
      "sourceCode": "12",
      "observations": 0,
      "needsReview": true
    }
  },
  "foodProvenance": { "dataset": "cnf", "code": "5224", "name": "..." },
  "licence": { "name": "Open Government Licence - Canada", "commercial_use": "permitted" }
}
```

### The rules

- **Unknown is not zero.** A nutrient the source did not report is absent from
  `per100`; it is never written as `0`. The app's own contract, in
  `src/core/food-log.ts`, is that a missing value is unknown and a reported
  zero is a real zero.
- **The quality of a value is kept, not flattened.** `analysed`, `calculated`,
  `imputed`, `inherited` and `estimated` are the source's own statement about
  how the number came about, and each one is carried through from the
  Canadian `Nutrient_Source_Code`.
- **A documented zero is only a zero when the source says so.** The code `12`
  means "assumed zero" in the Canadian file. When such a row's amount is
  `0`, it is a documented zero. When it is not `0`, the row contradicts itself,
  and the value is kept, flagged `estimated` and marked `needsReview` — never
  dropped, and never quietly believed.
- **A cross-reference is not an identity.** The Canadian file names a United
  States record for 4,798 of its 5,993 foods. That pointer is carried
  through as published, and the Canadian food keeps its own identifier, its
  own values and its own provenance. Where the pointer names a record the
  catalogue does not have, it is reported as a finding rather than left
  pointing at nothing.
- **The United States is unchanged.** The United States normaliser reproduces
  the shipped catalogue's value for value. A test asserts it, for every food
  and every nutrient.

## The gates

| Gate | Where it is met |
| --- | --- |
| G2.1 `data:verify` in CI, failing on a checksum change | `.github/workflows/ci.yml`; `pipeline/fetch.ts` |
| G2.2 an uncleared source cannot be fetched or built | `mayUse()` in `pipeline/fetch.ts`; the build refuses any input that is not `permitted` |
| G2.3 a golden test proves the build is deterministic | `tests/m2-pipeline.test.ts`, against `pipeline/fixtures/golden/cnf-foods.json` |
| G2.4 the manifest is reviewed like code | `pipeline/manifest/sources.json` is a reviewed file in the pull request |

## The fixtures and the golden file

`pipeline/fixtures/cnf-2026/` is a slice of the Canadian release: twenty
foods, chosen to cover the interesting cases — a value with observations, an
inherited value, a calculated value, a nutrient the app does not map, and the
two rows where the source contradicts itself on a nutrient the app does map.
The full release is 565,409 nutrient rows; the slice is 2,300.

`pipeline/fixtures/golden/cnf-foods.json` is the output the builder must
produce from that slice. It is checked in, and a test compares the built
dataset against it exactly.

To regenerate both, with the full Canadian release unpacked in the cache:

```
node pipeline/make-cnf-fixture.cjs <the unpacked CNF folder> pipeline/fixtures/cnf-2026
node --import tsx pipeline/make-golden.ts
```

The golden file is regenerated only when a normaliser's behaviour is
intentionally changed, and the change is then explained in the pull request.

## The measured results

`pipeline/reports/build-us-ca.json` and `pipeline/reports/benchmark-us-ca.json`
are the measured output for the full United States and Canadian sources.

- 14,250 records: 8,257 from the United States and 5,993 from Canada.
- 222 findings: 220 Canadian foods that name a United States record the
  catalogue does not have, and 2 Canadian rows whose own source code
  contradicts the amount printed beside it.
- The three architectures, on the real data. Each was loaded in a process of
  its own, so the heap figure is the catalogue and nothing else:

| | bytes | gzip | parsed at start-up | heap |
| --- | --- | --- | --- | --- |
| A, one merged catalogue | 40.3 MB | 1.69 MB | 40.3 MB, ~397 ms | 134 MB |
| B, one catalogue per market | 40.3 MB | 1.69 MB | the market in use: 22.6 MB (US) or 17.8 MB (CA), ~190 ms | 45 MB (US), 57 MB (CA) |
| C, a search index and a separate detail store | 37.4 MB | 1.55 MB | the index only: 925 KB, ~25 ms | 3 MB |

A lookup costs 0.10 to 0.24 microseconds in all three, so the choice is about
start-up cost and memory, not about speed.

The measurement is in `pipeline/reports/`, not in this file, because the
numbers are from a run and they move a little between machines. The table
above is a copy of that run.
