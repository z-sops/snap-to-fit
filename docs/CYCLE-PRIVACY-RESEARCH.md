# Snap to Fit — cycle tracking, privacy and release requirements

Research date: 7 October 2026. Markets: USA, Canada and UK. Status: researched product specification; no cycle feature implemented or regulator approval obtained.

## Confirmed product decision

Remove distress/SOS calling from the proposed roadmap. This includes microphone distress recognition, inactivity alarms, automatic escalation, emergency-contact messaging, location transmission and the previously suggested manual SOS button. A search of the recovered application source, server and documentation found no implemented distress/SOS dialling or messaging feature to remove. Existing informational urgent-symptom text is not an emergency calling feature and stays in place.

The cycle feature is optional personal recordkeeping. It must not diagnose pregnancy, infertility, PCOS or abnormal bleeding; recommend medication changes; identify contraceptive “safe days”; or prescribe exercises from an inferred hormonal phase. The existing doctor notice and anabolic-steroid misuse distinction remain unchanged.

This document separates legal requirements, product safeguards and unresolved applicability questions. It is not a legal clearance or a guarantee against a claim. Qualified counsel must assess the actual operator, data flows, marketing and launch jurisdictions before release.

## What official sources establish

| Market | Verified regulatory position | Product consequence |
|---|---|---|
| USA — medical-device boundary | FDA's January 2026 general-wellness guidance distinguishes lifestyle functions unrelated to disease diagnosis, treatment or prevention. It is not a blanket exemption for anything labelled wellness. [1] | Keep intended use to logging and general wellness. Obtain a written classification assessment of estimates, symptom messages and the whole app, including AI and glucose functions. |
| USA — federal health privacy | The FTC's Health Breach Notification Rule covers qualifying non-HIPAA personal-health-record businesses; unauthorised disclosures can constitute breaches, not just hacking. [2] | Assess applicability to Snap to Fit's combined self-entered and wearable data; establish an incident plan and prohibit hidden health-data disclosures. Do not assume HIPAA is the only relevant law. |
| USA — Washington | My Health My Data imposes health-data notice, consent and consumer-rights obligations, subject to statutory provisions. Washington's AG confirms enforcement can include private action. [3,4] | Build a health-data privacy notice; separate optional collection and sharing choices; enable withdrawal and applicable deletion, including processor/backup handling. A small app is not automatically exempt. |
| USA — California and other states | California identifies health information as sensitive under CCPA; applicability depends on statutory scope. The AG specifically warns health apps about reproductive-data protection. Nevada has a consumer-health-data statute. [5,6,7] | Perform a state-by-state applicability assessment. Separately assess California CMIA/reproductive digital-service coverage; do not treat CCPA size thresholds as a complete exemption from health privacy laws. |
| Canada — device boundary | Health Canada considers functionality, representations and intended use; general wellness and personal records can fall outside device regulation, while diagnostic/therapeutic purposes change the assessment. [8] | Logging-only scope reduces regulatory complexity but does not establish the classification of the entire application. |
| Canada — privacy | OPC guidance generally requires express consent for sensitive information. PIPEDA and substantially similar provincial laws must be mapped to activities and cross-border handling. [9,10] | Separate understandable consent, minimal collection, rights handling, processor oversight and disclosure of actual processing locations. Assess Quebec, Alberta and BC separately. |
| Canada — Quebec | CAI guidance requires privacy impact assessments for relevant information-system/service projects and certain handling outside Quebec, with privacy-officer involvement from the outset. [11] | Where applicable, conduct the assessment before development/transfer decisions, not after launch. |
| UK — device boundary | MHRA's software guidance considers intended purpose and marketing. Conception/contraception functions can be medical devices; a disclaimer does not undo qualifying functionality. [12] | No fertility or contraceptive functions in this phase. Review app-store copy, website, ads and AI responses as part of intended-use assessment. |
| UK — privacy | ICO requires an Article 6 lawful basis plus an Article 9 condition for special-category processing; high-risk processing requires a DPIA. Its period-app review stresses explicit opt-in, transparency and easy withdrawal. [13,14] | Document lawful bases before collection; use explicit consent for this optional feature where appropriate. Assess DPIA, overseas representation and international-transfer requirements against the actual operator/hosting. [15] |

Neither local storage nor a “not medical advice” notice automatically removes all legal duties. Store acceptance is also separate from legal/regulatory clearance.

## Corrections to the z.ai conversation

1. **No rigid phase-to-training schedule.** Do not present follicular days as a guaranteed strength window or ovulation as an automatic intensity/injury rule. US Office on Women's Health and NHS material support individual symptom awareness and gentle activity where appropriate, rather than the supplied fixed schedule. [16,17]
2. **No validated ±2-day promise exists here.** A fixed range is a proposed algorithm, not proven accuracy. Predictions remain disabled until the algorithm, variability handling and user-facing uncertainty have been validated and reviewed.
3. **Do not constrain records to “normal” defaults.** Users must be able to log longer/shorter or irregular patterns without the app diagnosing them. A 28-day default is not a measurement. No automatic medium-flow entry; require a user choice or leave flow unspecified.
4. **Two cycles requires three starts.** Start-to-start intervals must be counted explicitly. The supplied spec contradicts itself about defaults before enough history. Initial release should show history only; a later estimate release needs one consistent, reviewed minimum-history policy.
5. **Predicted periods are not observed periods.** No “Day 2 of your period” nudge based solely on a predicted date; no inferred ovulation displayed as confirmed.
6. **Do not wait three heavy-flow days or ten bleeding days to make care information available.** Generic logged thresholds are not triage. ACOG describes circumstances requiring prompt/emergency assessment, including very frequent product changes with systemic symptoms. NHS provides urgent guidance for severe/worsening pain. Clinical wording and regional care routes must be professionally reviewed. [17,18]
7. **“Never shared” conflicts with health sync and export.** Describe exact flows. Encryption alone does not justify “we cannot access your data.” Do not promise immunity from legal disclosure requests.
8. **Cycle event counters can still be sensitive.** Even an account-linked enabled flag or period-log count may disclose reproductive-health activity. Exclude all cycle-related telemetry in the first release, rather than assuming payload-free analytics is harmless.
9. **Pregnancy support is not unlocked by a checkbox.** “My doctor cleared exercise” is not sufficient validation of personalised pregnancy advice. Pregnancy workouts and fertility tools stay outside this phase.

## Proposed first-release experience

These are conservative engineering/product decisions, not statements that every law mandates this exact interface.

- Entry: Health → optional cycle journal; off by default. Preserve existing adult-only access rather than expanding to minors without a separate assessment.
- Users choose whether tracking applies to them; do not enable it from a gender field.
- Record start/end dates, optional flow and optional symptoms/mood. Distinguish spotting, period bleeding and unspecified entries. Permit correction/deletion and keep observed records separate from derived values.
- Calendar and historical summaries first. No next-period estimate at initial cycle launch unless validation and clinical/legal review have already passed.
- Later estimates: visibly uncertain, based on adequate logged history; suppress when unsuitable, highly variable or insufficient. No pregnancy probability, fertile windows, “safe days” or exact hormone-phase claims.
- Workout options respond to the user's reported comfort/energy, are dismissible and leave the plan unchanged. Example: “How are you feeling today? You can choose your planned session, a lighter session, or rest.” This does not assess fitness to exercise.
- Education links and accessible care information are available regardless of prediction state. No automated calling, SMS or location disclosure.
- Optional appointment export can include a separately selected cycle section, previewed before sharing. Default off; clear that an exported file leaves app control.
- Native health write/read sync remains deferred pending permission, conflict-resolution, deletion and platform review. Do not silently expand the current readers into reproductive-health writers.

## Data handling requirements before implementation

1. Map every field and derived value: native database, web storage, backups, server, AI prompts, crash SDKs, analytics, logs, export files and device health stores.
2. First-version design: native encrypted storage with OS-backed key protection. Exclude cycle records from existing account/cloud backups by default. Web cycle tracking stays disabled until a reviewed storage design exists; browser session state is not equivalent to encrypted native storage.
3. No cycle fields, dates, symptoms, counts, feature flags or screen-specific activity sent to AI providers, ad/attribution SDKs, analytics or crash reports. Audit screenshots, breadcrumbs, URLs and filenames too.
4. Do not combine gym location with cycle data, profile users for advertising, sell reproductive data or use it for model training.
5. Separate feature consent from any future sync/backup/export permission; no pre-ticked boxes. Record only the minimum consent evidence, disclose its purpose and retention, and support withdrawal without breaking unrelated fitness features.
6. Provide free access/export/correction/deletion mechanisms. Define retention, deletion timing, backup expiry and valid legal-hold exceptions accurately. Account switching, logout and deletion must not expose another user's cycle data.
7. Neutral notifications from the first release, if reminders are later introduced; no automatic lock-screen cycle notification or reproductive wording without user-controlled disclosure. Protect app-switcher previews and review screenshot/session-replay tooling.
8. Name the real data controller/operator and privacy contact. Publish concise privacy information, health-data notices where applicable, processor contracts and actual transfer locations. Do not invent business identity or a legal approval badge.
9. Create an incident response plan. Under applicable PIPEDA rules, assess real risk of significant harm and retain breach records for two years. The FTC rule has its own notification timing/categories; map each relevant regime instead of using one global deadline. [2,19]
10. Align Apple privacy labels, Google Data Safety and health declarations with actual collection/processing. Apple restricts health-context advertising/data mining; Google prohibits misleading health functionality. [20,21]

## Claims and wording

Suitable draft purpose: “Record your periods and symptoms, view your logged history, and prepare information to discuss with a healthcare professional.”

If estimates are later enabled: “Estimates are based on your logged history and may be inaccurate. Do not use them for contraception, fertility planning, pregnancy assessment or medical decisions.”

Preserve on every screen: “Share this with your doctor. Apply these suggestions as advised by your doctor.”

Do not claim: medical approval, guaranteed accuracy, safe fertility days, hormone optimisation, automatic protection, permanent muscle gains, 100% safety, or absolute protection from disclosure/litigation. A disclaimer supplements truthful behaviour; it does not replace compliance.

## Verification and release gates

- **Development:** no cycle implementation yet; no emergency calling feature found. Distress/SOS removed from planned scope.
- **Automated verification needed after implementation:** opt-in/off states; invalid dates and overlapping records; account isolation; encryption and key handling; exclusion from backups/AI/telemetry; record corrections; delete/reset behaviour; historical versus predicted states; export default-off; accessibility; notification privacy.
- **Manual acceptance:** real Android/iOS storage/restart/account-switch tests, network and SDK inspection, export/share inspection, permission denial, notification and app-switcher privacy. No automated test establishes clinical accuracy or legal compliance.
- **Clinical review:** qualified women's-health reviewer approves education, prediction limitations, symptom/care wording and any workout suggestions. Do not publish a “reviewed by” label without actual permission and documented review.
- **Legal release review:** counsel maps the actual business and all target states/provinces, checks medical-device intended use, California health-specific applicability, consent/rights, transfers, representation, incident duties and marketing. Country/store rollout remains gated until unresolved requirements are satisfied.

## Primary sources

[1] FDA, General Wellness: Policy for Low Risk Devices, January 2026: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices

[2] FTC, Complying with the Health Breach Notification Rule: https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0

[3] Washington Attorney General, My Health My Data guidance/private enforcement: https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy

[4] Washington RCW 19.373, including consent, privacy notice, rights and processor contracts: https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true

[5] California Attorney General, CCPA scope and sensitive information: https://www.oag.ca.gov/privacy/ccpa

[6] California Attorney General, health-app reproductive privacy warning: https://www.oag.ca.gov/news/press-releases/attorney-general-bonta-emphasizes-health-apps-legal-obligation-protect

[7] Nevada Legislature, NRS 603A consumer-health-data provisions: https://www.leg.state.nv.us/NRS/NRS-603A.html

[8] Health Canada, Software as a Medical Device definition and classification: https://www.canada.ca/en/health-canada/services/drugs-health-products/medical-devices/application-information/guidance-documents/software-medical-device-guidance-document.html

[9] OPC Canada, PIPEDA consent: https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/

[10] OPC Canada, provincial privacy-law applicability: https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/prov-pipeda/

[11] Quebec CAI, private-enterprise privacy responsibilities and impact assessments: https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/responsable-protection-renseignements-personnels-entreprise

[12] MHRA, software guidance, especially intended purpose/disclaimers and conception: https://www.gov.uk/government/publications/medical-devices-software-applications-apps

[13] ICO, special-category data: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/special-category-data/

[14] ICO, period/fertility app review recommendations: https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2024/02/ico-urges-all-app-developers-to-prioritise-privacy/

[15] ICO, international transfers: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-brief-guide-to-international-transfers/

[16] US Office on Women's Health, activity and menstrual cycle: https://womenshealth.gov/getting-active/physical-activity-menstrual-cycle

[17] NHS, period pain, reviewed March 2026: https://www.nhs.uk/symptoms/period-pain/

[18] ACOG, abnormal uterine bleeding: https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding

[19] OPC Canada, mandatory breach reporting/records: https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/privacy-breaches-at-your-business/gd_pb_201810/

[20] Apple, App Review Guidelines, health/fitness privacy: https://developer.apple.com/app-store/review/guidelines/uk/

[21] Google Play, Health Content and Services: https://support.google.com/googleplay/android-developer/answer/16679511?hl=en

Research limitation: the official California Civil Code 56.06 page could not be retrieved in this session. CMIA is therefore recorded as an explicit unresolved legal-review item, not a completed statutory applicability conclusion. Other US states, provincial obligations, UK territorial distinctions and law changes still require an exhaustive launch-specific assessment. The final app has not been audited for compliance, and no feature is marked legally cleared.
