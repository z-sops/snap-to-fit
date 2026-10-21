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
| `node pipeline/read-pdf.cjs <file.pdf> [text]` | Reads the text of the publisher's own documentation, which ships inside the pinned archive. |

The last one matters: the rules in this file are not folklore. The Canadian
Nutrient File's *database structure and file content description 2026* and
its *users' guide 2026* are two PDFs inside the pinned archive, and the
reading of the `Measure_Weight_Conversion` field comes from them.

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

### The build checks before it parses

`data:build` does not read a publisher file until it has proved that the file
is the one the manifest pins. Before anything is parsed it checks:

- the shipped United States artefact, against its digest and its size;
- the publisher archive, against its digest and its size;
- **every file inside the archive**, against its digest and its size.

A missing file is a failure, not a skip. A changed or truncated file is a
failure. An unapproved source is a failure. The build stops before it has
published anything, so a broken source cannot reach a catalogue.

`data:fetch` checks the same way: the archive is verified before it is
unpacked, and the cache is only accepted once every published file inside it
has been checked too. A file that does not match discards the cache rather
than leaving it there to be read by a later build.

There is one exception, and it is explicit. The checked-in fixture is a slice
of the Canadian release whose bytes are deliberately not the published bytes,
so it cannot be compared with the manifest. A build against it runs in
`fixture` mode, says so in its own output, and is only reachable by asking
for it. The shipped United States artefact is checked in every mode, because
it has a real digest and the real file is in the repository.

### What CI does, and does not, verify

CI runs `data:verify`. It checks the shipped United States artefact, which is
in the repository, and it reports the Canadian archive as **not fetched**,
because CI does not download a 26 MB archive. So CI does **not** verify the
nine Canadian CSV files. The strict verification of all nine files happens in
the full build, in the environment where the pinned archive is available, and
that build is what the reports in `pipeline/reports/` come from.

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
- **A serving is the weight of a portion, in grams.** The Canadian release
  publishes the weight of the measure itself. The 2015 release published a
  conversion factor that had to be multiplied by a hundred to get the same
  number, and the 2026 release already includes that multiplication. The
  publisher's own worked examples are in the release: 250 ml of unsweetened
  applesauce is 257.819 g, and one medium Granny Smith apple is 167 g. A
  measure whose published weight is blank, is not a number, or is not
  positive is not a portion and never becomes one.
- **The inedible part is kept, not dropped.** A refuse measure is not a
  portion, so it is never a serving, but it travels with the record: the
  nutrient values are per 100 g of the *edible* part, and the difference
  between the two is exactly what a refuse measure says. A published zero
  refuse is a **known zero** — the publisher says the food has no inedible
  part — and it is not the same as the publisher saying nothing at all. A
  refuse share outside the range a share can take is refused and reported.
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

`pipeline/fixtures/cnf-2026/` is a slice of the Canadian release: twenty-two
foods, chosen to cover the interesting cases — a value with observations, an
inherited value, a calculated value, a nutrient the app does not map, the two
rows where the source contradicts itself on a nutrient the app does map, and
the two foods the publisher's own documentation works through, so the serving
weights can be checked against the publisher's numbers. The full release is
565,409 nutrient rows; the slice is 2,452.

`pipeline/fixtures/golden/cnf-foods.json` is the output the builder must
produce from that slice. It is checked in, and a test compares the built
dataset against it exactly. It carries 16 findings: the two source
contradictions, and 14 Canadian foods that name a United States record the
catalogue does not have.

To regenerate both, with the full Canadian release unpacked in the cache:

```
node pipeline/make-cnf-fixture.cjs <the unpacked CNF folder> pipeline/fixtures/cnf-2026
node --import tsx pipeline/make-golden.ts
```

The golden file is regenerated only when a normaliser's behaviour is
intentionally changed, and the change is then explained in the pull request.

## The measured results

`pipeline/reports/` holds three reports, all generated from the full United
States and Canadian sources:

- `build-us-ca.json` — the records, the findings and the value quality of
  every value;
- `benchmark-us-ca.json` — the three architectures, measured;
- `source-integrity.json` — what was checked against the manifest, by digest
  and by size, before the build parsed anything.

- 14,250 records: 8,257 from the United States and 5,993 from Canada.
- 222 findings: 220 Canadian foods that name a United States record the
  catalogue does not have, and 2 Canadian rows whose own source code
  contradicts the amount printed beside it.
- 11 artefacts checked against the manifest, 11 matching: the shipped United
  States catalogue, the publisher archive, and the nine CSV files inside it.
- The three architectures, on the real data. Each was loaded in a process of
  its own, so the heap figure is the catalogue and nothing else:

| | bytes | gzip | parsed at start-up | heap |
| --- | --- | --- | --- | --- |
| A, one merged catalogue | 40.6 MB | 1.70 MB | 40.6 MB, ~361 ms | 135 MB |
| B, one catalogue per market | 40.6 MB | 1.70 MB | the market in use: 22.6 MB (US) or 17.7 MB (CA), ~172 ms | 45 MB (US), 57 MB (CA) |
| C, a search index and a separate detail store | 37.5 MB | 1.55 MB | the index only: 925 KB, ~11 ms | 3 MB |

A lookup costs 0.10 to 0.24 microseconds in all three, so the choice is about
start-up cost and memory, not about speed.

**These are Node.js figures, measured on a desktop machine.** They are not
Android or iPhone performance, and they are not a reason to pick an
architecture. Architecture C's start-up numbers cover the search index only:
the cost of loading a food's nutrient detail, the behaviour of search itself,
the cache the app would use, and the behaviour of a real device are all
outside what was measured, and all have to be measured before anything is
chosen.

The measurement is in `pipeline/reports/`, not in this file, because the
numbers are from a run and they move a little between machines. The table
above is a copy of that run.
