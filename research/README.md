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
| `fixtures/` | The research inputs. Four small reference tables reproduced from the Health Canada CNF 2026 release under the Open Government Licence – Canada, plus **synthetic** examples for the CNF amount rows and the CoFID sentinels. See `fixtures/README.md` for the provenance and the checksums. |

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
65,805 legitimate zeros and 174 legitimate non-zero values in the 2026 release
alone. The missingness rule for CNF is the *absence of a row*, and the quality
comes from the source code.

The same discipline applies to the UK sentinels: a `Tr` is present but
unquantified, and must never become a zero; a bracketed `( 1.2 )` is an
estimate, and is not a measurement; an `N` is not known, and is not a zero.

## Tests

`tests/m2-normalization.test.ts` — 13 deterministic tests, no network. They
pin the mapping, the quality table, the missingness rule, the sentinels, and
the two invariants that matter most: no unknown value ever becomes a number,
and no value that is not a number is ever displayable.

## What this directory does not do

- It does not import, parse or bundle any dataset.
- It does not change `src/core/foods.ts`, `src/core/food-log.ts` or any other
  production file.
- It does not change an identifier, a target, or a calculation.
- It does not include UK data of any kind. The CoFID fixture is synthetic.
