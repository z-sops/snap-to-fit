# Data sources and licensing registry

**Owner:** engineering, with legal sign-off required before any dataset is ingested
**Status:** M2-0 governance, live from commit `feat/m2-data-governance`
**Scope:** every dataset the product reads, or may read, food-composition data.

This registry is the single place that says what a dataset is, who publishes it,
what licence it carries, and whether we may use it commercially. **A dataset with
no entry here may not be downloaded into the repository, bundled into the app, or
used to produce a number the app shows.**

> **This document records engineering research, not legal advice.** The
> "Commercial use" column is an engineering reading of published licence terms.
> Every row marked `unresolved` needs written confirmation from the publisher
> and sign-off by legal before use. No row marked `prohibited` may be used.

---

## 1. Registry schema

| Field | Meaning |
|---|---|
| `id` | Stable identifier used in the source manifest and in code. Never reused. |
| `name` | Human name, as the publisher writes it. |
| `publisher` | The organisation that publishes it. |
| `dataset` | The exact release, with its version or date. |
| `landing_url` | The publisher's page describing the dataset. |
| `download_url` | The exact file or archive used. |
| `licence` | The licence name, verbatim. |
| `licence_url` | Where the licence text lives. |
| `commercial_use` | `permitted` · `prohibited` · `unresolved` — the only three values allowed. |
| `evidence` | The quoted words the verdict rests on, with the date checked. |
| `restrictions` | What the licence forbids, in our words. |
| `citation` | The text we must show wherever the data appears. |
| `checksum` | SHA-256 of the exact bytes used, in the source manifest. |
| `status` | `active` · `research` · `blocked` · `rejected`. |
| `reviewed` | Who reviewed it and when. |
| `next_review` | When the licence must be re-checked. |

A `permitted` verdict expires on `next_review`. It does not carry forward
silently.

---

## 2. Registry

### 2.1 `usda-fdc` — United States

| Field | Value |
|---|---|
| name | USDA FoodData Central |
| publisher | U.S. Department of Agriculture, Agricultural Research Service |
| dataset | SR Legacy (April 2018) — the release the app already ships; Foundation Foods (April 2026); FNDDS 2021-2023; Branded (April 2026) |
| landing_url | https://fdc.nal.usda.gov/ |
| download_url | https://fdc.nal.usda.gov/download-datasets/ (bulk CSV/JSON) · https://fdc.nal.usda.gov/api-guide/ (REST, key required) |
| licence | CC0 1.0 Universal (public domain) |
| licence_url | https://fdc.nal.usda.gov/api-guide/ (Licensing section) |
| **commercial_use** | **permitted** |
| evidence | *"USDA FoodData Central data are in the public domain and they are not copyrighted. They are published under CC0 1.0 Universal (CC0 1.0). No permission is needed for their use, but we request that users list FoodData Central as the source of the data."* (checked 2026-10-21) |
| restrictions | None. Attribution is requested, not required. |
| citation | "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019. fdc.nal.usda.gov." |
| status | **active** — SR Legacy is already bundled as `src/data/usda-foods.json` |
| notes | SR Legacy is the **final** SR release and is no longer updated. Foundation Foods (every two years) is the modern analytical dataset and carries sample counts and analytical metadata that SR Legacy does not. Moving to it is a quality upgrade inside the same licence, not a new source. |

### 2.2 `ca-cnf` — Canada

| Field | Value |
|---|---|
| name | Canadian Nutrient File (FCÉN), 2026 |
| publisher | Health Canada, Government of Canada |
| dataset | CNF 2026 — relational CSV release (published 2026-05-14, released 2026-05-19, modified 2026-10-04) |
| landing_url | https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/canadian-nutrient-file-about-us.html |
| download_url | https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109 (dataset record) · resource `019f2a90-e3a9-489d-b6e1-f74f4ba1d006` = `cnf_fcen_all-files-data_2026.zip` |
| licence | Open Government Licence – Canada (OGL-Canada) |
| licence_url | https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109 |
| **commercial_use** | **permitted** |
| evidence | Dataset record states: *"Licence: Open Government Licence - Canada"*, publisher Health Canada, with the OGL's standard terms permitting use, reproduction and redistribution including commercial use, with attribution. (checked 2026-10-21) |
| restrictions | Attribution required. No warranty. |
| citation | Health Canada. 2026. Canadian Nutrient File. Ottawa, Health Canada. |
| status | **research** — specification and normalisation written; **not ingested** |
| checksum | ZIP `f5faad8977ee6bbdd9d69c8649077cacd87d8658ad200509a4047db1e29edcdd` (26,656,195 bytes). Per-file checksums in `docs/m2/SOURCE_MANIFEST_SPEC.md`. |
| notes | **The CSV release is the authority, not the API.** The API exposes different field names (`nutrient_value`, `number_observation`, `nutrient_source_id`) from the published CSVs (`Nutrient_Amount`, `Observations`, `Nutrient_Source_Code`). The legacy 2015 online dataset and the API must not be silently substituted. Much of the CNF is derived from USDA SR (up to SR27); the Canadian-specific contribution is fortification and regulatory levels, Canadian-only foods and some brand foods. Per-value provenance is in `Nutrient_Source.csv` and must survive into the catalogue. |

### 2.3 `uk-cofid-govuk` — United Kingdom, GOV.UK bulk workbook

| Field | Value |
|---|---|
| name | McCance and Widdowson's The Composition of Foods Integrated Dataset (CoFID) 2021 |
| publisher | Public Health England (dataset page on GOV.UK) |
| dataset | CoFID 2021 workbook — 2,887 foods, plus 393 in a separate "old foods" file; 13 worksheets |
| landing_url | https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid |
| download_url | The same landing page (workbook + 2021 user guide PDF) |
| licence | **Conflicting — see `docs/m2/UK_LICENCE_QUESTION.md`** |
| licence_url | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ |
| **commercial_use** | **unresolved** |
| evidence | FN-BRI FAQ: *"the data itself is subject to use under the Open Government Licence for Public Sector Information. The information can be freely used but the source of the information must be acknowledged."* The official consumer service "Explore Food": *"The information used in this resource is provided under the Open Government Licence."* **Against that**, the FSA CoF IDS user document for the same dataset states: *"the data itself is subject to Crown copyright… to create another product, you are required to purchase a copyright licence (a Click-Use Value Added Licence) from OPSI"*, and the End-User *"MAY NOT… use the Database or extracts therefrom whether in machine-readable… form to produce other products of any kind without the written permission from the Controller."* (all three checked 2026-10-21) |
| restrictions | Unknown until clarified. |
| citation | "PHE (Public Health England) (2021) Composition of foods integrated dataset (CoFID). Available at: https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid" |
| status | **blocked** — not downloaded, not parsed, not bundled |
| notes | No CoFID file has been downloaded, parsed or redistributed for this project. The sentinel specification in `docs/m2/COFID_SENTINELS_AND_PROVENANCE.md` is taken from the published user guide, not from a local copy. The dataset is also **stale**: the last full update was 2021, and the only recent analytical survey listed by FN-BRI is *"Nutrient analysis of cows' milk 2025"*. |

### 2.4 `uk-cofid-oldfoods` — United Kingdom, "old foods" file

| Field | Value |
|---|---|
| name | CoFID "old foods" dataset — foods carried over from the 2008 update that were not reviewed in the 2015, 2019 or 2021 releases |
| publisher | Public Health England / FN-NBRI |
| dataset | 393 foods, published separately from the main workbook |
| landing_url | https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid |
| licence | **Conflicting — inherits the CoFID question** |
| **commercial_use** | **unresolved** |
| evidence | GOV.UK: *"certain foods that were included in the 2008 update were not reviewed or validated in the 2015, 2019 or 2021 update, and those foods are published separately in a file containing data for 'old' foods."* |
| restrictions | Unknown. These are the least recently validated values in the UK set and should not be presented as current even if the licence clears. |
| status | **blocked** |
| notes | Tracked separately because its provenance and its review status differ from the main workbook. If the main CoFID licence clears, this file needs its own clearance and a separate staleness disclosure. |

### 2.5 `uk-fnnbri-cofid-api` — FN-NBRI CoFID API

| Field | Value |
|---|---|
| name | FN-NBRI CoFID API |
| publisher | Food & Nutrition National Biosciences Research Infrastructure, Quadram Institute Bioscience |
| dataset | CoFID v2.2.0 via REST |
| landing_url | https://fnnbri.quadram.ac.uk/developer-tools/ |
| licence | **CC BY-NC-SA 4.0** |
| licence_url | https://creativecommons.org/licenses/by-nc-sa/4.0/ |
| **commercial_use** | **prohibited** |
| evidence | FN-NBRI's own licence page: *"Not permitted: Any commercial use, including licensing or sublicensing of derivative works for commercial purposes… incorporating the data into paid products"*, and *"You may not use the data or API for commercial purposes. This includes selling access, incorporating the data into paid products, or using it in revenue-generating services."* (checked 2026-10-21) |
| restrictions | Non-commercial only. ShareAlike. Attribution required. |
| status | **rejected** — must not be used, bundled, or called by the app |
| notes | Snap to Fit has paid plans, so this is a commercial product. This channel is categorically closed and is recorded here so nobody re-litigates it later. |

### 2.6 `uk-fnnbri-labelling` — FN-NBRI Food Labelling dataset and API

| Field | Value |
|---|---|
| name | UK Composition of Foods Labelling dataset (2021) |
| publisher | Food & Nutrition NBRI, Quadram Institute Bioscience |
| dataset | CoFID adjusted for nutrition labelling: *"supplementing missing values and recalculating specific nutrients to ensure adherence to labelling regulations"* |
| landing_url | https://fnnbri.quadram.ac.uk/labelling/ · https://fnnbri.quadram.ac.uk/developer-tools/ |
| licence | **Not established.** The developer-tools page states the licence for the *CoFID API* as CC BY-NC-SA 4.0; it does not state a separate licence for the labelling dataset. |
| **commercial_use** | **unresolved** |
| evidence | The labelling dataset is described as the variant intended for *"software or app producers generating the mandatory EU nutrition information"*, which is exactly our use case — but no licence is published for it on the pages checked (2026-10-21). |
| restrictions | Unknown. The NC terms may be assumed to cover it, which would prohibit it. |
| status | **blocked** — not downloaded, not used |
| notes | This is the most promising channel commercially **and** the most uncertain. It is the dataset designed for our use, and it may be derived from a Crown-copyright source. It is also the most likely to be covered by non-commercial terms. It needs written clarification before anything else in the UK is attempted. |

### 2.7 `off` — Open Food Facts

| Field | Value |
|---|---|
| name | Open Food Facts |
| publisher | Open Food Facts contributors |
| dataset | Live crowd-contributed database, read per barcode |
| landing_url | https://world.openfoodfacts.org/ |
| licence | Open Database License (ODbL) 1.0 |
| licence_url | https://opendatacommons.org/licenses/odbl/1-0/ |
| **commercial_use** | **permitted, with share-alike conditions on derived databases** |
| evidence | Already in production use in the app with attribution in `src/core/food-sources.ts` and in the scanner sheet. |
| restrictions | Attribution and share-alike. |
| citation | "Product data © Open Food Facts contributors (ODbL). Always check the package label." |
| status | **active** |
| notes | The app reads single products by barcode and does not build a derived database, so the share-alike obligation does not currently bite. If M2 ever mirrors OFF into a local catalogue, the ODbL share-alike obligations must be re-reviewed. |

### 2.8 `free-exercise-db` — exercise media (separate track)

| Field | Value |
|---|---|
| name | free-exercise-db |
| publisher | yuhonas (GitHub) |
| dataset | 876 exercises, images mirrored to our own CDN |
| licence | Unlicense (public domain) |
| licence_url | https://unlicense.org/ |
| **commercial_use** | **permitted** |
| status | **active** — `src/data/exercises.json` |
| notes | **Tracked separately on purpose.** Exercise media is not food data and has its own rights and biomechanical-review question. It is not covered by any food-data clearance, and M2 must not treat it as settled. |

---

## 3. In-repository artefacts

These are already committed and are the inputs to every build.

| Artefact | Source | Licence | SHA-256 | Bytes |
|---|---|---|---|---|
| `src/data/usda-foods.json` | USDA SR28 (SR Legacy), built by `scripts/build-foods.mjs` | public domain | recorded in `docs/m2/SOURCE_MANIFEST_SPEC.md` | 1,420,723 |
| `src/data/exercises.json` | free-exercise-db, built by `scripts/build-exercises.mjs` | Unlicense | recorded in `docs/m2/SOURCE_MANIFEST_SPEC.md` | 709,372 |

---

## 4. Do-not-ingest list

Until written clearance arrives, none of these may be downloaded into the
repository, bundled, or queried by the shipping app:

- `uk-cofid-govuk` — the GOV.UK CoFID 2021 workbook
- `uk-cofid-oldfoods` — the CoFID "old foods" file
- `uk-fnnbri-labelling` — the FN-NBRI Food Labelling dataset and API
- `uk-fnnbri-cofid-api` — rejected outright (non-commercial)

This list is enforced by review. A future change that adds any of them needs a
new registry entry with a `permitted` verdict and a legal sign-off recorded
here.

---

## 5. What is still open

| # | Question | Owner | Blocks |
|---|---|---|---|
| 1 | Does the GOV.UK CoFID 2021 workbook fall under the Open Government Licence, or does the Crown-copyright/Click-Use position in the FSA user document still apply to re-use inside a commercial app? | legal + FSA/FN-BRI | all UK ingestion |
| 2 | Is there a separate licence for the FN-NBRI Food Labelling dataset, and is it commercial? | legal + FN-BRI | all UK ingestion |
| 3 | Are the CNF's USDA-derived values usable for commercial release under OGL-Canada, and must they be attributed to USDA as well? | legal | Canadian attribution wording |
| 4 | Which reference values may be shown as a "% daily value" per market, and with what age scope? | clinical + legal | reference-value work |
| 5 | Does the exercise media survive a commercial release and a biomechanical review? | legal + clinical | exercise media |

Questions 1 and 2 are the critical path for the United Kingdom. Until they are
answered in writing, the United Kingdom ships with the honest statement that
the app already shows: *"The bundled catalogue is the US USDA reference set.
Canadian and UK national food catalogues are not included yet."*
