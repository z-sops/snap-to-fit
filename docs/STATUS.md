# Implementation status — v0.3.0, 2026-10-06

## Verified in this workspace

- TypeScript strict checks and ESLint.
- 56 automated core/backend tests, including separate-account backup isolation, ciphertext owner binding, stale-backup conflicts, session rotation/revocation, concurrent recovery-code single-use, deletion cascades, quota limits, weekly calendars and provider token reload.
- 11 interaction/notification-adapter tests: serialized state/account isolation, manual food entry, AI consent, medical photo acknowledgement, routine editing and check-ins, reminder permission/capacity handling, partial-failure cleanup and education opt-in. Native APIs in these adapter tests are mocked; real device behavior is not verified.
- Android/iOS Hermes bundle compilation and static web export with 18 routes. No signed native installer is included.

## Added in v0.3

Localized general-fitness weekly meal ideas, structured dietary preference/allergies, medical care-plan organizer, optional flexible meal, photo-review gate, routine clocks/check-ins, recurring local meal/education reminders and universal doctor/steroid notices. Nine country selections map to starting cuisine templates; other countries use familiar-meal setup. Budgets are not measured recipe nutrition. Medical meal templates/targets are entered by users from an existing plan, not generated as treatment. Reminder delivery and timezone changes still need physical-device testing.

## Implemented since v0.1

Accounts, recoverable sessions, encrypted persistent backups/provider tokens, explicit account deletion, RevenueCat purchase/restore flows with server entitlements, expanded movement library, actual weekly training schedules, weight-based target refresh and app privacy screens. Docker deployment recipe is included but its image was not built here.

## Remaining acceptance and external dependencies

- Android Gradle/Xcode native builds, signing and physical-device verification: encryption after restart, camera, permissions, HealthKit/Health Connect, reminders, account switching, store purchases and accessibility.
- Live AI and Dexcom tests require credentials. Commercial Dexcom access and Abbott partner integration require provider approval. Abbott is not implemented; background CGM polling and emergency monitoring are not implemented.
- Public privacy/terms URLs, operator contact, data-retention policy, store health-data declarations, regional availability and medical-claim review are operator launch work.
- Pricing/products are undecided. Billing is disabled until configured; purchase/restore code is unverified against live store products.
- Browser automation could not start. DOM tests are not a successful browser/device visual review.
- Programmatic movement demonstrations are illustrations, not a comprehensive professionally reviewed exercise asset library. Generic variants may share demonstrations; equipment and form need review.

## Deliberate product boundaries

Photos and waist-to-height ratio track progress, not visceral fat or DEXA accuracy. Medical contexts pause automated nutrition/intensity prescriptions. Prescribed medicine reminders are one-time entries. Cloud backups are explicit and conflict-protected, not continuous sync. Progress photos stay on-device; restored reminders require re-enabling on that device. Web preview data is ephemeral. Logical deletion is not a forensic erasure guarantee.

Core offline modules are free; Pro is currently wired to configurable AI allowance. No consumer price or active premium subscription is simulated. Competitor claims from the brief were not verified and must not be published as established facts.

## Nearby gyms addition

Mobile/web `/gyms` page, optional foreground location consent, manual global area search, radius selection, Google Places server adapter, nearest-first GPS listings and external directions added. Locations/listings are not saved to profile or backup. Live listings await Google Places credentials, billing and deployed backend; native permissions and browser geolocation await device testing. The external Google Maps search does not require our Places key.

## Workout music addition

External Spotify/Apple Music/YouTube Music launchers and session-local audio-file playback with workout controls added. Native background/lock-screen capability is configured; playback, interruptions, Bluetooth and picker behavior await real-device tests. Provider account linking and direct streaming controls are not implemented.
