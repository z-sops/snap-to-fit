# Nutrition and medical boundaries

The general-adult estimate uses Mifflin–St Jeor resting-energy calculation: 10 × kg + 6.25 × cm − 5 × age + sex-specific equation constant. Selected activity multipliers estimate maintenance. The implementation uses a modest capped deficit or small gain adjustment, plus configurable product defaults for protein/fat/fibre; these defaults are not clinical prescriptions or validated individualized targets. Macro energy reconciles within rounding.

Medical conditions, insulin, other medication context, underweight profiles and ages beyond the original equation sample range pause automatic targets. Allergies and food preferences are sent as user-provided context only when optional AI processing is enabled. The server recomputes targets and ignores caller-supplied target numbers. An AI policy and keyword guards are defense in depth, not a guarantee of clinical safety.

The original equation was developed in healthy people; do not market extrapolated targets as disease treatment. BMI and waist ratios are screening measures. Weight planning windows assume 0.25–0.5 kg/week and are not guaranteed deadlines. Plateau reviews require repeated entries across four weeks and do not determine medicine duration.

References:

- Mifflin et al., 1990: https://pubmed.ncbi.nlm.nih.gov/2305711/
- ADA exercise and glucose: https://diabetes.org/health-wellness/fitness/blood-glucose-and-exercise
- NIDDK weight-management medicines: https://www.niddk.nih.gov/health-information/weight-management/prescription-medications-treat-overweight-obesity
- NHS waist-to-height ratio: https://www.nhs.uk/health-assessment-tools/calculate-your-waist-to-height-ratio

## Onboarding copy already implemented

“Take about 5 minutes. Accurate answers help us personalize responsibly.”

“Nutrition and exercise estimates are educational. We do not diagnose disease, measure visceral fat from photos, or tell you to change medicines. Weight timelines are estimates.”

AI consent is separate and optional. This copy explains current behavior; it is not a substitute for reviewing the product's intended use, public terms or clinical claims.
