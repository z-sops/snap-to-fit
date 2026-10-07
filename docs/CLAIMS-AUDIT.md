# Snap to Fit claims and privacy audit — 7 October 2026

Baseline: main `d4bed2315ba6f5025323cb9515d35c5e3fbed979`. Audit changes are a local patch until the user applies and pushes them. This is a code/claims review and official-source research, not regulatory approval, a lawyer's opinion or a guarantee against a lawsuit.

## DEVELOPMENT

Reviewed application routes, shared UI, nutrition/meal planning, food review, exercise planners and animation source, health/CGM readers, reminders, chat/AI policy, photo/storage/backup handling, accounts, gyms, music, billing and release/feature documents. Generated movement HTML and bundled/binary dependencies were not independently audited line by line; their source and documented provenance were reviewed. Static inspection cannot prove the behavior of a deployed provider, operating system or future AI answer.

| Finding | Correction or disposition |
| --- | --- |
| Saved progress photos use encrypted SQLite, but image selection/manipulation returns filesystem URIs before the app saves a base64 copy. Absolute encrypted/local-photo wording omitted originals and temporary files. | Privacy, Settings and Journey now explain the distinction. No cache-erasure guarantee is made. Cache lifecycle and device/cloud photo-library behavior still need device testing. |
| Server encrypts backups with a key it holds and decrypts them for restore. | Account and privacy screens explicitly say encryption at rest, not end-to-end encryption. |
| Account deletion cascades active database rows; it does not demonstrate erasure of host snapshots, provider copies or photo originals. | UI now explains logical deletion and separate retention/deletion processes. Operator policy and backup handling remain unresolved. |
| Health screen said recordkeeping only, despite low-glucose and high-BP threshold notices. | UI now accurately describes limited manual-entry notices. It says absence of a notice is not clearance. Medical-device classification remains a launch question. |
| AI coach lacked explicit reproductive-prediction and steroid-protocol boundaries. | Added shared local/server refusal for recognizable requests, policy limits on fertility/contraception/PCOS and cycle-phase prescriptions, and steroid dosing/stacks/cycles. These English keyword guards are defense in depth, not comprehensive clinical validation. |
| Nutrition pauses underweight/out-of-scope age targets, while both workout planners still assigned intensity. | Both exercise planners use one conservative scope rule and pause sets/reps/duration for those profiles. BMI/age rules are product scope limits, not evidence that everyone outside them cannot exercise. |
| Coach sent free-text preferences but omitted structured allergies and vegan/vegetarian selections. | Consented chat now sends the existing structured fields to the server's existing validated profile whitelist. It does not certify allergen safety. |
| Medicine reminders could be interpreted as dependable dose alerts. | Explicitly states one-time reminders can be delayed or missed, without changing the prescribed schedule or reminder flow. |
| Loading/storage-error views omitted the mandatory notices. | Both views now include the exact doctor notice and steroid warning. |

Preserved: offline logs, medical care-plan organizer, photo review gate, gym/location consent, local audio/external music shortcuts, wearer readers, CGM history, charts, human viewer, meals, reminders, accounts and billing scaffolding. No unsupported guaranteed fat measurement, dangerous glucose-spike prediction, 100% safety or permanent muscle-gain promise was found in the reviewed product wording. This is a finding about the reviewed source, not future AI output or external marketing.

## Removed proposal and cycle scope

Distress/SOS calling, messaging, emergency-contact escalation and distress recognition are excluded, including the proposed manual SOS button. There was no implemented calling/messaging feature to delete in this baseline. Informational urgent-symptom guidance remains; it does not call anyone.

Period/cycle tracking is not implemented. Do not ship z.ai's unvalidated ±2-day predictions, fixed phase-to-training rules, fertility/contraceptive claims, default medium-flow entries or absolute privacy claims. See [cycle research](CYCLE-PRIVACY-RESEARCH.md) for jurisdiction-specific evidence, privacy design and remaining decisions. The separate Opportunity Intelligence/Pitch-tab I7 document belongs to a different project and is excluded.

## AUTOMATED VERIFICATION

Local patched checkout: **69 core/backend tests + 17 UI/adapter tests = 86 passed**, lint passed, TypeScript passed. Added tests exercise both refusal paths, the real authenticated HTTP service with no AI key, both workout planners, the rendered coach's offline refusal, and consented transmission of structured dietary context.

These checks do not validate every AI answer, exercise form, encryption on a physical phone, legal applicability, provider retention, installed APK behavior or store review. Earlier 81-test CI relates to the baseline redesign, not this unpushed audit patch.

## MANUAL WINDOWS / REAL-DEVICE ACCEPTANCE

Deferred. Apply the patch to the Windows Git clone, review, push and obtain a new successful APK. Then test camera/photo caches, clear/delete/account switching, reminders under denied permissions and OS restrictions, lock-screen audio, HealthKit/Health Connect permissions and actual tracker data. Review all rendered exercise motions and mobile layouts. A GitHub push does not update an installed APK or the private website.

## Unresolved public-launch requirements

1. **Medical-device/intended-use review of the whole app** in each market, particularly manual glucose/BP interpretation, patient-directed chat and future reproductive functions. Do not claim FDA/Health Canada/MHRA approval, HIPAA compliance, a universal medical-device exemption or legal clearance. An educational disclaimer does not override actual functionality or marketing.
2. **Operator identity and real privacy/terms pages**, appropriate lawful bases/consent, processor agreements, retention/deletion including snapshots, access/export/withdrawal processes, breach response, international transfers and regional scope. Existing on-device toggles are not a complete compliance program. Assess USA state health-data laws, Canadian federal/provincial scope and UK special-category obligations.
3. **AI clinical/adversarial evaluation** with live credentials and representative languages/questions; provider contractual retention/data-use review and operator-controlled consent evidence. Prompts/regex do not prevent all harmful outputs. Do not launch disease-treatment advice or claim validated personalized coaching.
4. **Clinical review** of threshold notices, nutrition scope and exercise assets. Formula estimates, planning budgets and weight windows are not measured metabolism, measured recipe nutrition or guaranteed outcomes. Historical CGM must not drive immediate dosing or workout clearance.
5. **Store/provider requirements**: health declarations, purchase terms and sandbox testing, signing, HealthKit/Health Connect/Dexcom permissions and licenses. Pricing from z.ai remains an unapproved proposal. Music shortcuts do not confer streaming rights or account linking; gym listings are not a suitability endorsement.

## Primary sources and legal interpretation

- [FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance): express and implied benefit/safety claims need appropriate scientific support; disclosures cannot contradict the overall claim. Applied here to app/marketing wording, not as proof that every feature is compliant.
- [FDA software-function policy](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/policy-device-software-functions-and-mobile-medical-applications), [non-device examples](https://www.fda.gov/medical-devices/device-software-functions-including-mobile-medical-applications/examples-software-functions-are-not-medical-devices), [enforcement discretion examples](https://www.fda.gov/medical-devices/device-software-functions-including-mobile-medical-applications/examples-software-functions-which-fda-will-exercise-enforcement-discretion): simple storage/display and patient-specific interpretation are materially different functions. Enforcement discretion is not approval or a declaration of non-device status. The app's threshold notices warrant specific classification review; this report does not determine their category.
- [MHRA intended purpose](https://www.gov.uk/government/publications/crafting-an-intended-purpose-in-the-context-of-software-as-a-medical-device-samd/crafting-an-intended-purpose-in-the-context-of-software-as-a-medical-device-samd), [MHRA software guidance](https://www.gov.uk/government/publications/medical-devices-software-applications-apps): review intended users, indications, outputs and actual claims/functions.
- [Health Canada SaMD guidance](https://www.canada.ca/en/health-canada/services/drugs-health-products/medical-devices/application-information/guidance-documents/software-medical-device-guidance-document.html): classify using intended use and functionality; do not assume the complete app qualifies merely because it contains wellness logging.
- [FTC health breach rule](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0), [Washington consumer health-data law](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true), [Canada OPC consent](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/), [ICO special-category data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/special-category-data/): applicability, express consent/lawful bases and breach/deletion duties require operator-specific assessment. Full reproductive-data research and additional state/provincial sources are in the linked cycle report.

A regional health/privacy lawyer must assess the actual operator and proposed public release. This audit has corrected identified source-level issues; it has not certified the app as legally compliant.
