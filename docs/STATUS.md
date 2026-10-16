# Implementation status — v0.3.0, 2026-10-06

## v0.3.1 usability update — 2026-10-07

USA-focused cuisine picker, user-selected workout weekdays, five text navigation destinations and improved gym/Maps fallback are implemented locally. See `US-PREFERENCES.md` for research, compatibility and verification scope. The original country-template/default calendar descriptions below describe earlier development; v0.3.1 supersedes them. A fresh APK and native-device acceptance are required after this patch is pushed.

## Verified in this workspace

- TypeScript strict checks and ESLint.
- 66 automated core/backend tests, including separate-account backup isolation, ciphertext owner binding, stale-backup conflicts, session rotation/revocation, concurrent recovery-code single-use, deletion cascades, quota limits, weekly calendars and provider token reload.
- 15 interaction/notification-adapter tests: serialized state/account isolation, manual food entry, AI consent, medical photo acknowledgement, routine editing and check-ins, reminder permission/capacity handling, partial-failure cleanup and education opt-in. Native APIs in these adapter tests are mocked; real device behavior is not verified.
- Android/iOS Hermes bundle compilation and static web export with 20 routes. No signed native installer is included.

## Added in v0.3

Localized general-fitness weekly meal ideas, structured dietary preference/allergies, medical care-plan organizer, optional flexible meal, photo-review gate, routine clocks/check-ins, recurring local meal/education reminders and universal doctor/steroid notices. Nine country selections map to starting cuisine templates; other countries use familiar-meal setup. Budgets are not measured recipe nutrition. Medical meal templates/targets are entered by users from an existing plan, not generated as treatment. Reminder delivery and timezone changes still need physical-device testing.

## Implemented since v0.1

Accounts, recoverable sessions, encrypted persistent backups/provider tokens, explicit account deletion, RevenueCat purchase/restore flows with server entitlements, expanded movement library, actual weekly training schedules, weight-based target refresh and app privacy screens. Docker deployment recipe is included but its image was not built here.

## Remaining acceptance and external dependencies

- Android Gradle/Xcode native builds, signing and physical-device verification: encryption after restart, camera, permissions, HealthKit/Health Connect, reminders, account switching, store purchases and accessibility.
- Live AI and Dexcom tests require credentials. Commercial Dexcom access and Abbott partner integration require provider approval. Abbott is not implemented; background CGM polling and emergency monitoring are not implemented.
- Public privacy/terms URLs, operator contact, data-retention policy, store health-data declarations, regional availability and medical-claim review are operator launch work.
- Pricing/products are undecided. Billing is disabled until configured; purchase/restore code is unverified against live store products.
- Local browser launch is blocked by socket restrictions; the published private Site reaches a ChatGPT sign-in wall in the verification browser. DOM tests and asset checks are not a successful browser/device visual review.
- Programmatic movement demonstrations are illustrations, not a comprehensive professionally reviewed exercise asset library. Generic variants may share demonstrations; equipment and form need review.

## Deliberate product boundaries

Photos and waist-to-height ratio track progress, not visceral fat or DEXA accuracy. Medical contexts pause automated nutrition/intensity prescriptions. Prescribed medicine reminders are one-time entries. Cloud backups are explicit and conflict-protected, not continuous sync. Progress photos stay on-device; restored reminders require re-enabling on that device. Web preview data is ephemeral. Logical deletion is not a forensic erasure guarantee.

Core offline modules are free; Pro is currently wired to configurable AI allowance. No consumer price or active premium subscription is simulated. Competitor claims from the brief were not verified and must not be published as established facts.

## Nearby gyms addition

Mobile/web `/gyms` page, optional foreground location consent, manual global area search, radius selection, Google Places server adapter, nearest-first GPS listings and external directions added. Locations/listings are not saved to profile or backup. Live listings await Google Places credentials, billing and deployed backend; native permissions and browser geolocation await device testing. The external Google Maps search does not require our Places key.

## Workout music addition

External Spotify/Apple Music/YouTube Music launchers and session-local audio-file playback with workout controls added. Native background/lock-screen capability is configured; playback, interruptions, Bluetooth and picker behavior await real-device tests. Provider account linking and direct streaming controls are not implemented.

## Release infrastructure work

The current web bundle is deployed as an owner-private test site at https://snap-to-fit.zbaig-newacct.chatgpt.site. This is a snapshot of the verified bundle; GitHub pushes alone do not republish the Site. Web state remains session-only and online service credentials are not configured. The native Android prebuild completed successfully in this workspace. A GitHub Actions workflow builds standalone test-signed Android APKs on relevant main-branch pushes and offers a manual trigger. A successful native APK build and physical-device acceptance are separate checks; see the workflow’s current result. Detailed deployment/account requirements are in `docs/RELEASE.md`.

## UI, human movement and wearable connection update

Shared typography, navigation, inputs and cards now use the navy/blue visual system.
The dashboard includes a finite animated hero and a seven-day activity bar chart.
Health and Journey include interactive reading charts using actual logs, chronological
date spacing, consistent units and explicit empty states. Reduced-motion preferences
are respected. No illustrative health readings are presented as user data.

The primitive capsule/cylinder person is replaced with a skinned CC0 MakeHuman
anatomical human, fitness clothing, studio lighting and camera/playback/skin-tone
controls. Walking and push-up use CC0 baked clips; other motions remain illustrative
programmatic poses and need a professional form/equipment review. Embedded assets
work without a third-party model request; see docs/licenses/HUMAN-MOVEMENT.md.

Dedicated Apple Watch, Android health and Fitbit / Google Health setup cards now
explain and trigger the existing native readers on supported platforms. Apple Watch
uses Apple Health on iPhone; Fitbit uses data shared to Health Connect on Android.
There is no standalone watchOS app, direct Fitbit cloud OAuth, or web watch access.
Real tracker/device sync and permissions remain acceptance checks.

Validation for this update: lint/typecheck, 66 core/backend tests, 15 UI tests, 20-route web export, native Android prebuild (minSdk 26), and 12 finite skinned poses each for the embedded walking and push-up clips. GPU rendering and physical-device wearable sync remain unverified.

## 16 Oct 2026 — dependency reproducibility and navigation fix

Checked against main `418780f`. Changes are on branch `fix/npm-ci-drawer-nav`.

**npm ci (CI blocker).** Commit `67efda1` regenerated `package-lock.json` without
peer dependencies (676 lines dropped while `package.json` dependencies were unchanged),
typical of an npm config with `legacy-peer-deps=true`. npm 7+ installs required peers,
so `npm ci` failed with EUSAGE. The lock was restored from `cbc2400` (last green CI),
version fields set to 0.3.1, and normalised with Node 24.22 / npm 11.21 using
`npm install --package-lock-only` (no `--force`, no `--legacy-peer-deps`, package set
unchanged; `@react-native/metro-config` stays 0.86.3 to match React Native 0.86.3).
Clean `npm ci` passes. On Windows check `npm config get legacy-peer-deps` returns
`false` before regenerating the lock.

**Navigation root cause.** The four main bottom tabs were `<Link asChild>` around a
`Pressable` with a style array. expo-router's Slot rejects style arrays on asChild
children (throws in development, mangles merged props in release); More and the
secondary items did not hit this (More was not a Link, items used plain style objects),
matching the device report. Separately, the root layout returned `<Redirect>` instead
of the Stack for unprofiled users, unmounting the navigator, and onboarding showed tabs
that could only bounce back to onboarding.

**Fix.** Bottom bar (Today, Food, Move, Health, Menu) uses `Pressable` +
`router.navigate`. A slide-out side menu (hamburger in the header or Menu tab) lists
every screen in sections, respects reduced motion and closes with Android back. Before
a profile exists the tabs are hidden and the menu offers only onboarding, sign-in, gyms
and legal. The root layout always renders the Stack and guards profile-only screens
with `Stack.Protected`. Doctor/steroid notices remain on every screen and in the menu.
Web static export also stopped crashing on `Audio` during server render.

**Owner decisions.** Asian cuisine submenu now offers Indian only; an existing saved
Chinese/Japanese/Thai choice stays valid and visible (not erased). Workout weekdays
already matched the request (user-chosen, consecutive allowed); unchanged. Gym copy
shortened, addresses capped at two lines; still list + external Google Maps, no
embedded map.

**Validation (this workspace, Node 24.22 / npm 11.21).** `npm ci`, typecheck, lint,
77 core/backend tests, 27 UI tests (new: navigation helpers, guard, tab/menu UI,
cuisine), `expo export --platform all` (Android/iOS Hermes + web). Playwright on the
production web export: 26/26 navigation checks (fresh user → onboarding, guarded deep
link, onboarding → home, all 4 tabs, all 14 menu destinations with doctor notice), zero
page errors. NOT yet done: Android APK build from this commit and Pixel 6a acceptance.

## 16 Oct 2026 — new onboarding and Home (UI redesign phase 1–2)

Owner supplied 15 reference screens (Caloriesense, Cal AI, DietAI, SnapNutrition,
SageUp and others). Decisions: light theme, US units (lb, ft/in) by default with a
metric toggle, a new logo, onboarding and Home first.

- Onboarding: welcome screen with logo mark (concept A, `assets/logo-mark.*`,
  pending owner's final pick), then one question per card (15–16 steps) with wheel
  pickers, option cards, a GLP-1 step that records the prescribed brand only (no
  dose advice), consent, and a "Your plan" reveal (animated calories and macro
  rings; paused when health conditions or medicines are recorded). Doctor notice
  is pinned on every step. Profile gains optional `units` and `glp1`; stored values
  stay kg/cm.
- Home: greeting, Sunday-first week strip (tap past days), calories-left ring with
  eaten/estimate, protein/carbs/fat rings, "Snap your meal" hero card, today's
  workout card, recently logged meals with macro chips, and an Explore grid that
  gives every feature its own entry.
- Bottom bar: Today, Food, raised centre Snap button, Move, Health; the full menu
  stays behind ☰.
- Rings are built from plain Views (no new native module), so this update needs a
  new APK build but not `npm ci` or `prebuild`.

Validation: typecheck, lint, 80 core and 32 UI tests (new: units, onboarding flow),
`expo export --platform all`, and a web walkthrough of onboarding → Home with a
logged meal (no page errors). Not yet tested on the Pixel 6a.

## Progress 2026-10-16 — Gym Truth learning hub
- `/education` is now **Gym Truth**: 5 card categories (Dangerous shortcuts, Supplements: the science, Your body, Fuel basics, Beginner questions), 30 topics, search, verdict pills (Avoid / Can help / Food first / Usually not worth it), doctor notice + sources on every topic. No brand names.
- Content lives in `src/core/learn.ts` (NIH ODS, FDA, NIDA, ISSN sources). Reminder settings moved to `src/components/EducationReminders.tsx`.
- Home tile and menu renamed to "Gym Truth" and shown at every age. JS-only change: no prebuild needed.

## Progress 2026-10-16 — Health conditions & 50+, Back button everywhere
- Gym Truth gains a "Health conditions & 50+" category (12 topics): muscle loss after 50 (sarcopenia), starting after 50, heart stent/bypass, blood pressure, diabetes, kidney disease, protein in urine, prostate, knee arthritis, knee replacement, slip disc L3–L5, neck/cervical. Each has red-flag signs and sources (CDC, AHA, NKF, NIDDK, MedlinePlus, AAOS, PROT-AGE).
- Onboarding "injuries" step now has structured movement limits (knee, knee replacement, lower back, neck, shoulder, prostate) saved as `profile.limits`; they pause exercise intensity like other health details.
- "For you" list on Gym Truth and "Exercise safety guides for you" card on Move, matched to age 50+, conditions and limits; `/education?topic=<id>` opens a topic.
- Every non-tab screen shows a Back button under the header (router.back, or Home when there is no history). In-screen steps (topic → list → hub) use the same button and the Android back key.
