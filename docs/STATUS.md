# Implementation status — v0.3.0, 2026-10-06

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
