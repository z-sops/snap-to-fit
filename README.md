# Snap to Fit — v0.3.1

English adult fitness app for Android and iOS, implemented with Expo 57 and React Native. The source includes all module screens and a multi-user backend. It is a development release: signed native builds, physical-device acceptance testing and configured external services are still needed before publishing.

## Included

- Four-step onboarding, health context and separate optional AI consent.
- Calories, protein, carbs, fats and fibre estimates for eligible general-fitness profiles. Latest weight logs update estimates; reached goals switch derived estimates to maintenance.
- Manual food logs and camera/gallery AI estimates requiring portion confirmation before saving.
- Weekly gym/home/walking calendars using the user's selected weekdays (1–7 days), beginner full-body, upper/lower and push/pull/legs splits, 21 exercises with 17 illustrative offline 3D movement patterns, performance logs and rest timer. Unselected days are not compulsory rest days.
- Glucose, BP, weight and waist logs; weight journey, progress photos, waist-to-height ratio and repeated-weight plateau review.
- Prescribed medication/injection records, symptoms and one-time local reminders.
- Read-only HealthKit and Android Health Connect adapters for steps, weight and heart rate.
- English AI coach with general-fitness target context, symptom routing and medication-change guards.
- Per-user Dexcom OAuth connection, encrypted persistent server tokens and manual historical imports. Abbott connection is clearly marked unavailable pending partner access.
- Username/password accounts, private recovery code, rotating sessions, isolated encrypted device profiles, optional encrypted cloud backups with revision checks, export and account deletion.
- RevenueCat offerings, purchase, restore and subscription management with server-side entitlement verification. Core offline modules are free; optional Pro increases AI allowance. Billing is off until pricing/products are configured.
- Privacy information and configurable public policy links. No doctor dashboard or advertising trackers.

## New in v0.3.1

- Five readable text navigation buttons (Today, Food, Move, Health, More); secondary destinations are in More. Bottom line-art icons removed.
- User-selected workout count and weekdays, with no automatically assigned alternate-day calendar. Existing profiles choose their days in Move.
- USA-focused cuisine preferences: American default, UK/British, Mexican, and Asian subchoices Indian/Chinese/Japanese/Thai. Diet and allergies remain separate. Legacy country fields remain readable but no longer select meal templates.
- Gym searches open Google Maps directly when this build has no online listing service. Configured in-app searches use a recent approximate location when available, detect disabled location services and provide manual city/ZIP fallback. Google Places credentials/billing and backend deployment remain required for in-app listings.

## Included from v0.3.0

- Structured vegan/vegetarian/mixed onboarding, familiar foods and known ingredient allergies.
- Weekly general-fitness meal ideas with daily planning budgets split across meals. Cuisine selection now follows v0.3.1 preferences above. This is not a complete worldwide recipe database or measured recipe nutrition.
- Medical profiles get an automatic seven-day organizer populated from their own entered care-plan meals and optional targets. The app does not create an autonomous therapeutic diet. Unstructured allergies pause automatic recipe suggestions. Catalog matches still need label/recipe and cross-contact review.
- Photo concerns require explicit acknowledgement before confirming the estimate. Medical context, possible animal ingredients, recorded allergies and entered-carb-reference overages are shown without pretending to predict a dangerous glucose spike. Logging actual consumption remains available.
- One optional flexible-meal choice per local week for eligible general-fitness profiles; unavailable for medical profiles. It does not increase the calorie budget or certify a food as safe.
- Metabolic Tracker with regular/weekend wake and meal times, configurable weekend days, actual meal check-ins and an elapsed clock after an actual breakfast check-in.
- Repeating local meal reminders and optional wake reminder, separate from medicine reminders. Notifications require device permission, clean up partial failures and stop on account switching/local deletion. Backup/restore strips device reminder IDs and disables reminders until re-enabled on that device.
- A doctor-sharing notice and anabolic-steroid warning on every screen. Ages 18–50 also receive education cards and optional weekly/daily local reminders. Prescribed corticosteroids are distinguished from non-prescribed anabolic misuse.

## Run

Node.js 24 LTS is required for the backend's built-in SQLite API.

```sh
npm ci
npm run web
```

Browser data is temporary memory. Native encrypted storage, health permissions and reminders need a custom development build; Expo Go is unsupported.

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile development --platform all
npx expo start --dev-client
```

Apple/Google signing and Expo accounts are needed. Local builds use `npm run android` with Android SDK/JDK or `npm run ios` on macOS/Xcode. Review the default bundle IDs `com.zunitech.snaptofit` before registering. Native folders are generated through app configuration and plugins.

## Online service and accounts

1. Copy `server/.env.example` to `server/.env`; set a server-side Gemini key for AI.
2. Run `npm run server`.
3. Copy `.env.example` to `.env`; set the public API URL and restart Expo. A phone requires a reachable HTTPS URL.
4. Create an account from onboarding or Settings → Account. Save the one-time recovery code. AI processing needs separate consent in Settings.

No secrets are embedded in the mobile app. Legacy developer pairing is optional and disabled by default. A local development encryption key is created with restrictive file permissions; production refuses to start without an explicit persistent `DATA_ENCRYPTION_KEY`.

Cloud backup uploads are explicit. Photos and reminder IDs stay local. Restore is allowed only into an empty local profile to prevent overwriting records; a revision conflict prevents silent overwrite across devices. This is manual backup/restore, not continuous cross-device sync.

## Deploy the backend

The included Dockerfile runs one Node process with a persistent SQLite database. Use an HTTPS reverse proxy, a durable `/app/data` volume writable by container UID 1000 and a stable secret key. Keep the key separate from DB backups; loss of it makes encrypted data unreadable. Do not expose database files. Set an exact browser origin when enabling the web client.

```sh
docker build -t snap-to-fit .
docker run --env-file server/.env -e NODE_ENV=production -e HOST=0.0.0.0 -e DATABASE_PATH=/app/data/accounts.sqlite -p 8787:8787 -v snap-fit-data:/app/data snap-to-fit
```

The Docker image was supplied but not built in this environment. One instance is supported; in-memory IP limits and OAuth pending state need shared infrastructure before multi-instance scaling. Put stricter registration/abuse controls at the gateway for public launch. Authentication secrets, access and refresh tokens are stored as hashes; health backups and provider tokens use AES-256-GCM. The service operator still controls the decryption key.

## CGM

Configure the registered Dexcom client, secret, region and exact HTTPS callback `/cgm/dexcom/callback`. Health → Connect my CGM opens official OAuth. Sandbox values are labeled simulated. Imports are historical and manually refreshed; no emergency monitoring or background polling is claimed. Commercial provider approval is required. See `docs/CGM.md`.

## Store subscriptions

Create approved Apple/Google products and a RevenueCat project. Attach products to a `pro` entitlement and a current offering, configure public platform keys in the app and the secret API key on the server, then set `BILLING_ENABLED=true`. Store-localized prices and durations are displayed; no price is hardcoded. Verify sandbox purchase/restore/cancel on real devices before enabling billing. Account deletion does not cancel a store subscription. AI allowances default to 5/free and 50/Pro requests per UTC day and are configurable; failed upstream requests currently consume an allowance.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:ui
npm run movement
npx expo export --platform all
```

56 backend/core tests and 11 interaction/notification-adapter tests passed, along with strict type checking, lint and Android/iOS Hermes plus web export. These exports are JavaScript bundles, not signed APK/IPA files. See `docs/STATUS.md` for tested limits and external launch dependencies.

Progress photos do not measure visceral fat. Medical contexts pause autonomous target/intensity prescriptions. GLP-1 records do not recommend changing, stopping or tapering prescribed treatment. Movement models are illustrations requiring review before launch.

## GitHub updates

Canonical source: https://github.com/z-sops/snap-to-fit. Every push and pull request runs type checking, lint, tests and Android/iOS/web bundle exports in GitHub Actions. Secrets and local health databases are excluded from Git.

Clone this repository for a fresh checkout; use `git pull --ff-only` for later updates, followed by `npm ci` if dependencies change. Commit and push reviewed source changes to keep GitHub current. Git does not automatically upload unsaved local edits or update installed mobile apps. Store releases and Expo OTA updates require separately configured signing, builds and release channels.

## Nearby gyms (mobile and web)

`/gyms` is accessible without onboarding. Today links to this page. Users opt in before a one-time location request or an explicit area search. GPS results use selectable 1/5/10/25 km circles and nearest-first straight-line distances; area results use provider relevance. Gym cards show name/address and open directions/details in Google Maps. No background location collection, saved location or sponsored ranking is added.

Set `GOOGLE_PLACES_API_KEY` on the server, enable Places API (New) and billing, restrict the key to the provider API/server IPs and configure quotas. Use the existing `EXPO_PUBLIC_API_URL` and exact `WEB_ORIGIN`. The public search endpoint has the existing IP rate limit; apply gateway abuse controls and project quotas before public launch. Web location requires HTTPS (localhost for development). Without a key/server, the external Search Google Maps button remains usable, while in-app listings report configuration errors. Coverage depends on provider availability and listings. No live provider or real-device location test has been performed. Include location/provider processing in published policies.

## Workout music

Music opens Spotify, Apple Music or YouTube Music with official web links; platform app-link handling may open their installed apps. These are external-service launchers, not OAuth account connectors or embedded streaming SDKs. Direct in-app provider playback/library access needs separate approved provider SDK integrations and credentials. The local player uses `expo-audio` and `expo-document-picker`: one selected audio file, play/pause, seek, repeat and workout-screen controls. Native background/lock-screen playback is configured but requires physical-device testing. No microphone access or music uploads. Selection is session-only and file-picker copies may remain in the OS-managed cache; music is excluded from health backups. Protected service downloads cannot be played by this importer.
