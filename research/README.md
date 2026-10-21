# M2-0 research code

**Nothing in this directory is part of the shipping app.**

No file here is imported by `src/` or `server/`. The Expo bundler walks the
import graph from the entry point, so these files cannot reach a device build.
`tsc --noEmit` and `expo lint` do cover them, so the code is held to the same
standard as production code.

## Why this exists

The M2-0 milestone is allowed to add *research* artefacts but not to change
production behaviour. The hardest part of adding national food data is not the
downloading — it is deciding, exactly, what each published number *means*.
Writing those decisions down as code, with tests, is how they get reviewed
honestly before they are allowed near a user's nutrition.

## Contents

| File | What it is |
|---|---|
| `normalize.ts` | The value-state model, the CNF 2026 source-code → quality map, the CNF and CoFID normalisers, and the app-key → CNF-tag mapping. |
| `reference-values.ts` | The food-labelling reference values for the three markets, as a specification. Every table is marked `approved: false` and nothing in it is enabled. |
| `measure-cnf-2026.mjs` | The measurement script that produces the figures quoted in the documentation and the generated summary fixture. Needs the official archive to be present; it is not run by the test suite. |
| `fixtures/` | The research inputs. Four small reference tables reproduced from the Health Canada CNF 2026 release under the Open Government Licence – Canada, one **generated** summary of the official release, plus **synthetic** examples for the CNF amount rows and the CoFID sentinels. See `fixtures/README.md` for the provenance and the checksums. |

## The rule the code encodes

A value's **quality**, its **provenance** and its **missingness** are three
different things and are never collapsed into one.

- *quality* — `analysed` · `calculated` · `imputed` · `estimated` · `trace` ·
  `unknown` · `documented-zero`
- *provenance* — the source's own code and description for that value
- *missingness* — whether the source reported a value at all

The consequence that matters: **a value with no laboratory observations is
not a missing value.** Health Canada's CNF publishes calculated, imputed,
estimated and *assumed-zero* values, and those values legitimately have no
observation count. Treating `Observations == 0` as "not reported" would delete
**149,873 legitimate zeros and 219,204 legitimate non-zero values** in the
2026 release alone. The missingness rule for CNF is the *absence of a row*, and
the quality comes from the source code.

Three further rules came out of the review and are now enforced by the code and
its tests:

- **A source code never overwrites a reported amount.** Code 12 says the value
  is an *assumed zero*; it is applied only where the amount really is zero.
  The 82 rows that pair it with a non-zero amount are a source-data conflict:
  the amount is preserved, the row is flagged for review, and no verified
  quality is claimed.
- **A blank amount is not a zero.** `Number("")` is 0, and reading it that way
  would invent a measurement.
- **A source code does not by itself establish laboratory analysis.** Code 0
  says only that a value is unchanged from USDA, and codes 81/82/83 name
  another national dataset. Both are `inherited`, which is a value with an
  unstated quality, rather than `analysed`.

The same discipline applies to the UK sentinels: a `Tr` is present but
unquantified, and must never become a zero; a bracketed `( 1.2 )` is an
estimate, and is not a measurement; an `N` is not known, and is not a zero.

## Tests

- `tests/m2-normalization.test.ts` — 20 deterministic tests, no network. They
  pin the mapping, the quality table, the missingness rule, the sentinels, the
  conflict handling, and the four invariants that matter most: no unknown
  value ever becomes a number, no value that is not a number is ever
  displayable, no published amount is ever silently replaced, and a flagged
  value is never treated as settled.
- `tests/m2-reference-values.test.ts` — 12 deterministic tests. They compare
  the United States table against the app's own `nutrientInfo` key by key, so
  switching the app onto these tables cannot change a number for a United
  States user, and they assert the added-sugars substitution is impossible,
  that Canada keeps 3400 mg potassium, that the United Kingdom keeps 5 µg
  vitamin D, that salt is never offered for sodium, and that no market
  borrows another's value.

## What this directory does not do

- It does not import, parse or bundle any dataset.
- It does not change `src/core/foods.ts`, `src/core/food-log.ts` or any other
  production file.
- It does not change an identifier, a target, or a calculation.
- It does not enable a regional labelling percentage: every reference-value
  table is marked `approved: false`, and the specification and the app are
  still separate.
- It does not include UK data of any kind. The CoFID fixture is synthetic.
