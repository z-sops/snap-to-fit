# USA-focused usability update — v0.3.1

Baseline: `cbc2400`. Local incremental changes awaiting manual apply/push and a new APK. Existing health logs, consent settings, prescriptions and offline features remain in place.

## Decisions from the user's device feedback

- Bottom navigation: remove crowded line-art icons. Five text destinations with equal-width touch targets: Today, Food, Move, Health, More. More contains Tracker, Coach, Meal plan, Gyms, Music and Settings. Native layout and accessibility text scaling still need device acceptance.
- Workout week: ask for 1–7 days, then the actual weekdays. No automatic Monday/Wednesday/Friday or alternate-day selection. Consecutive days are accepted. Unselected dates say no workout scheduled, not compulsory recovery. Existing users without selected days see the editor in Move. Training intensity still follows the existing health-context restrictions; preference is not clinical clearance.
- Meal preference: American default; UK/British, Mexican and Asian submenu with Indian, Chinese, Japanese and Thai. Country tabs removed from onboarding/meal planning, with no Pakistan option in that picker. Existing country fields remain valid for backup compatibility, but cuisine independently selects suggestions. Changing cuisine regenerates the planning cache, not actual food logs. Diet, allergies and familiar foods stay separate. Meals are original generic dish ideas; budgets are not measured recipe nutrition or an allergen guarantee.
- Gyms: when no online service URL is configured, both search actions open real Google Maps searches without first waiting for app GPS. Configured in-app listings can use a recent location (up to two minutes, at most 1 km uncertainty), otherwise request a balanced current fix with a 30-second bound. Disabled location services and failure show manual city/ZIP guidance. Coordinates remain session-only. Radius applies only to configured in-app results; external Maps uses its own controls.
- Build identification: app version 0.3.1, Android versionCode 2; Settings names this usability update. An installed 0.3.0 binary does not acquire these changes from a GitHub push.

## Primary-source product research, 7 October 2026

1. [Mealime getting started](https://support.mealime.com/article/151-getting-started-guide): separates diet, allergies and dislikes; supports self-selected recipes, automatic building and cuisine search. Its reported counts and marketing outcomes are not copied into Snap to Fit.
2. [Mealime eating preferences](https://support.mealime.com/article/43-i-do-i-change-my-eating-preferences): preferences can be edited and reflected in the next plan. This supports keeping preferences revisable rather than treating nationality as a fixed dietary identity.
3. [Samsung Food recipe search/filter help](https://support.samsungfood.com/hc/en-us/articles/18365507924372-Getting-Started-with-Samsung-Food-Save-Search-and-Share-Recipes): lists cuisine separately from diet, meal type, ingredients, cooking time and nutrition. It provides a filter/apply interaction. We adopt the separation, not a copied UI or recipe catalog.
4. [Eat This Much personalization](https://www.eatthismuch.com/meal-planner/): describes food preferences, schedule and allergies. [Manual planning option](https://help.eatthismuch.com/help/can-i-disable-the-automatic-generator-and-enter-my-own-foods) confirms people can build/edit plans rather than accept compulsory generation.
5. [Expo SDK 57 location](https://docs.expo.dev/versions/v57.0.0/sdk/location/): documents that a fresh position can take several seconds, last-known position can be faster subject to freshness/accuracy bounds, and location-services availability can be checked.

Inference/design choice: use one compact cuisine chooser with an expandable Asian submenu, independent dietary/allergy fields and an American default. The exact default, allowed cuisines and user-owned workout calendar come from the user's instruction, not a claim that competing apps use this exact hierarchy. Additional recipe filters or barcode features are outside this fix.

## Verification and pending acceptance

Automated: **72 core/backend + 23 UI/adapter tests = 95 passed**, lint and TypeScript passed. Android/iOS Hermes bundles and the 20-route static web export passed. Tests cover calendar selection and legacy no-auto-schedule behavior, profile validation, cuisines/diet filters/planning budget totals, recent GPS/disabled services/timeouts, Maps fallback, menu interaction and persisted workout choices while retaining logs.

Native location and navigation geometry remain device checks. Direct Google Maps launches require Maps/browser connectivity; they are external results, not in-app listings. In-app Google Places credentials, billing, deployed HTTPS backend and live testing are still pending. This patch does not supply credentials or claim to complete those integrations. No live-provider/network results, human exercise form validation, legal clearance or public-site deployment are inferred from passing tests.

Manual acceptance: Settings shows 0.3.1; nav labels do not overlap at the phone's text scale; More reaches all secondary sections; Monday/Tuesday/Wednesday selections persist after restart; American default can change to Mexican/Indian without changing recorded meals; gym searches work externally, or use configured listings with permission denial/timeouts handled. Continue the broader physical-device acceptance list in RELEASE.md.
