# Release work and credentials

## Android testing

GitHub Actions → Android test APK builds a standalone APK with its JavaScript bundle included. It runs on native/source changes to main and can also be started manually. Download the `snap-to-fit-test-apk` artifact after a successful run, extract it and install the APK. It targets ARM64 phones and x86_64 emulators. This build uses the generated Expo template's test/debug signing key and is NOT a store release. Keep production signing separate. An installed APK with a different signing key cannot be updated in place; export logs before removing it.

`eas.json` also includes an internal `preview` APK profile. An Expo account/project is required for `npx eas-cli@latest build --platform android --profile preview`. Production iOS requires Apple signing credentials. Store releases require stable production identifiers, signing and approved health permissions.

## Backend deployment

The existing Docker recipe needs one persistent Node 24 service, HTTPS and a private durable database volume. Do not deploy the Node SQLite service onto an ephemeral filesystem or stateless Worker. Required runtime values: `DATA_ENCRYPTION_KEY` (stable 32-byte hex key), `DATABASE_PATH`, `HOST`, `PORT`, exact `WEB_ORIGIN`. Create the encryption key on the deployment platform and retain a separate secure backup. Never commit secrets. AI/CGM/gym/billing features remain inactive without their provider configuration.

Configure the mobile/web build with `EXPO_PUBLIC_API_URL` pointing to that HTTPS service. Public policy links use `EXPO_PUBLIC_PRIVACY_URL` and `EXPO_PUBLIC_TERMS_URL`. `EXPO_PUBLIC_*` values are embedded in app bundles; only public URLs or public provider SDK keys belong there.

## Provider setup needed

- AI: server-side `GEMINI_API_KEY`; verify configured model and consent before live analysis.
- Gyms: server-side `GOOGLE_PLACES_API_KEY`, Places API (New), billing, API/IP restrictions and project quotas.
- Dexcom: approved client ID/secret, correct region and exact HTTPS callback. Sandbox data stays visibly simulated. Abbott authorized integration is still unimplemented.
- Purchases: decide free/paid features and products; Apple/Google products, RevenueCat entitlement/offering, public platform SDK keys and secret server key. Keep billing disabled until sandbox purchase/restore tests pass.
- Direct music account linking: registered/approved provider apps and native SDK implementation still required. Current buttons launch the services externally.
- OTA: Expo account/project and update URL/channel configuration, `expo-updates`, runtime compatibility and an initial new binary are required. No OTA deployment is currently active. Native dependency changes still require a new binary.

## Acceptance before public launch

Read `docs/CLAIMS-AUDIT.md` and `docs/CYCLE-PRIVACY-RESEARCH.md`. Public launch requires operator-specific medical-device/intended-use and health-data/privacy review in each target market. Disclaimers and passing tests are not legal clearance. SOS/distress calling is excluded; reproductive tracking is not implemented or approved for launch.

Install on physical Android/iOS devices and check encrypted storage after restart, account switching/deletion, reminders across timezone changes, camera consent, health read permissions, gym permission denial, local audio and lock-screen/Bluetooth interruptions, purchases and accessibility. Review exercise form and every health claim. Finalize operator identity/contact, retention/deletion policy, regional availability and store disclosures. Publish reviewed privacy/terms pages; no operator/contact identity has been invented in this repository.

Android minimum SDK is 26 (Android 8) to satisfy the bundled Health Connect library. The first APK workflow failed at manifest merge with minSdk 24; the config plugin now sets 26. Health Connect itself requires a supported device/OS and enabled sharing.
