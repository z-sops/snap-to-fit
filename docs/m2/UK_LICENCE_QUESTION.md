# UK licence question — what must be clarified in writing

**Status:** OPEN. This is a blocker for every United Kingdom data work.

**Why it exists:** the official sources for the UK food composition data do not
say the same thing about commercial re-use, and the API terms forbid exactly
the use we would need. Nobody should resolve this by inference.

---

## 1. The conflicting statements

### 1.1 GOV.UK — Open Government Licence

The CoFID 2021 publication page on GOV.UK hosts the workbook and the user
guide. The Open Government Licence v3.0 covers "all content is available under
the Open Government Licence v3.0 except where otherwise stated"
(<https://www.legislation.gov.uk/eur/2011/1169/annex/XIII> footer).

FN-BRI's own FAQ states the position directly:

> *"The Composition of Foods integrated dataset files are available from the UK
> government web archive free of charge in Excel format, however the data itself
> is subject to use under the Open Government Licence for Public Sector
> Information. The information can be freely used but the source of the
> information must be acknowledged."*
> — <https://fnnbri.quadram.ac.uk/help/>

The official consumer service "Explore Food" says the same:

> *"The information used in this resource is provided under the Open Government
> Licence."* — <https://explorefood.foodafactoflife.org.uk/>

### 1.2 The FSA CoF IDS user document — Crown copyright

The user document for the same integrated dataset states the opposite:

> *"the integrated dataset files are available from FSA website free of charge,
> however the data itself is subject to Crown copyright. The terms and
> conditions for use of the food composition datasets, as set out by The
> Controller of Her Majesty's Stationery Office, are detailed in Annex 1. If you
> wish to re-use the food composition data, either within, or to create, another
> product, you are required to purchase a copyright licence (a Click-Use Value
> Added Licence) from Office of Public Sector Information (OPSI)."*

and the end-user terms it quotes say:

> *"The End-User MAY NOT under any circumstances: a. sell or distribute the Data
> in whole or in part or any extract therefrom to any third party or to another
> location; b. use the Database or extracts therefrom whether in machine-readable,
> optical or printed form to produce other products of any kind without the
> written permission from the Controller; c. use the Data or Database to provide
> consultancy services to third parties."*

> Source: *McCance & Widdowson's Composition of Foods Integrated Dataset
> (CoF IDS) User Document*, reproduced by FAO at
> <https://www.fao.org/uploads/media/British_FCDB_cof_user_doc.pdf>

**Read together, these cannot both be describing the same artefact.** Either the
workbook on GOV.UK has been re-licensed under the OGL since that user
document was written, or the user document still describes the underlying Crown
copyright and the OGL applies to the publication page rather than the data.

### 1.3 FN-NBRI CoFID API — non-commercial

The FN-NBRI developer-tools page publishes a licence for the **API**:

> *"Licence: Creative Commons Attribution–NonCommercial–ShareAlike 4.0
> International (CC BY-NC-SA 4.0)"*
>
> *"Not permitted: Any commercial use, including licensing or sublicensing of
> derivative works for commercial purposes; Distribution of the data or
> derivatives without applying the same CC BY-NC-SA 4.0 licence; Removing or
> obscuring attribution to FN-NBRI / McCance & Widdowson"*
>
> *"Commercial or special-permission enquiries: fn-nbri@quadram.ac.uk"*
>
> — <https://fnnbri.quadram.ac.uk/developer-tools/>

**This channel is closed to us.** Snap to Fit has paid plans, so the product is
commercial, and the licence explicitly names "incorporating the data into paid
products" as prohibited. Recorded as `rejected` in `docs/DATA_SOURCES.md` so it
is not re-litigated.

### 1.4 The UK Food Labelling dataset — no published licence found

FN-BRI also publishes a *"UK Composition of Foods Labelling dataset (2021)"*,
described as the CoFID data *"adjusted by supplementing missing values and
recalculating specific nutrients to ensure adherence to labelling
regulations"*, aimed at *"software or app producers generating the mandatory EU
nutrition information for food products and recipes"*
(<https://fnnbri.quadram.ac.uk/labelling/>).

This is the dataset closest to our use case, and it is the one with **no
licence published on the pages checked** (2026-10-21). The developer-tools page
states CC BY-NC-SA 4.0 for the *CoFID API*; it does not state a separate
licence for the labelling dataset. If the labelling dataset is derived from the
Crown-copyright source, or is covered by the same non-commercial terms, it is
closed to us.

---

## 2. Why this cannot be resolved by reading

Three reasons, each sufficient on its own:

1. **The dataset is Crown-copyright material that was published under a
   general licence statement.** "Free of charge" and "may be re-used
   commercially" are different claims, and the sources make the first but not
   clearly the second.
2. **The conflicting documents may be describing different artefacts or
   different eras.** The FSA user document is from the FSA era; the FN-BRI
   FAQ and the Explore Food service are current. Which governs *today* is a
   question for the publisher.
3. **A licence that is ambiguous in a published source is not a licence we can
   rely on for a commercial product.** The cost of being wrong is the product.

---

## 3. The questions to put in writing

To be addressed jointly to **FN-BBRI** (`fn-nbri@quadram.ac.uk`), **Public
Health England / the Food Standards Agency** as the original dataset owner, and
**the Office of Public Sector Information** as the licensing authority.

1. **GOV.UK CoFID 2021 workbook.** Is the data licensed to the public under
   the Open Government Licence v3.0, so that it may be reproduced, adapted and
   redistributed in a commercial mobile application with attribution? If not,
   what licence does apply, and what is required to obtain permission?
2. **CoFID "old foods" file.** The same question for the 393 foods that were
   not reviewed in the 2015, 2019 or 2021 releases.
3. **FN-NBRI CoFID API.** The page states CC BY-NC-SA 4.0. Is commercial use
   available under a separate commercial licence, and on what terms? We are
   **not** asking to use the API under its current terms; we are asking
   whether a commercial licence exists.
4. **FN-NBRI Food Labelling dataset and API.** What licence applies? Is
   commercial use permitted, and is there a commercial licence?
5. **Derived and redistributed forms.** If a commercial licence is available,
   does it permit building a derived catalogue (a transformed subset with our
   own identifiers and provenance), shipping it inside a mobile application,
   and displaying the values to end users?
6. **Attribution wording.** What exact text must be displayed, in what
   places, and is a clickable link to the source required?
7. **Update cadence.** CoFID 2021 is five years old, with a milk survey from
   2025. If a licence is granted, what is the process and the frequency for
   obtaining a current release?

---

## 4. What we do in the meantime

1. **Nothing UK is downloaded, parsed, bundled or called.** The registry marks
   `uk-cofid-govuk`, `uk-cofid-oldfoods` and `uk-fnnbri-labelling` as
   `unresolved` / `blocked`, and `uk-fnnbri-cofid-api` as `rejected`.
2. **No CoFID fixture is redistributed.** The CoFID test fixture is synthetic:
   invented rows that exercise the published sentinel rules. The real code
   tables, which are small and carry the OGL-Canada licence, *are* reproduced
   for Canada.
3. **The app keeps telling the truth.** The food search sheet says: *"The
   bundled catalogue is the US USDA reference set. Canadian and UK national
   food catalogues are not included yet."* That sentence is removed only when
   the data behind it exists and is licensed.
4. **The United Kingdom still gets regional behaviour** from M1: units, dates,
   the clock, the emergency number and the spoken voice are all market-aware
   without needing a UK food database.

---

## 5. Decision point for the owner

| Option | Consequence |
|---|---|
| **A.** Fund the written clarification and wait | The United Kingdom can get a genuine national catalogue. Cost is a few weeks of waiting. |
| **B.** Ship the UK with the US catalogue and the honest label | No UK-specific foods. The app is still correct, just less local. This is the current state. |
| **C.** Build a small UK food set from scratch, from public recipes and label values | Not a food composition database, and it would carry the same provenance problem. **Not recommended.** |

**Recommendation: A, with B as the standing default.** Option B is what ships
today and is honest. The United Kingdom work should start only when the
clarification is in writing.
