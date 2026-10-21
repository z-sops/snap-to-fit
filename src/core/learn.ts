// "Gym Truth" learning library. Plain-language education for adults, written from
// public health sources (NIH ODS, FDA, NIDA, ISSN position stands). No brand names,
// no dosing for drugs or prescription medicines, no medical advice.

export type LearnCategory = "danger" | "supplements" | "body" | "fuel" | "conditions" | "faq";
export type Verdict = "avoid" | "helpful" | "food-first" | "waste" | "know";

export interface Source { title: string; url: string }
export interface Article {
  id: string;
  category: LearnCategory;
  title: string;
  emoji: string;
  verdict: Verdict;
  summary: string;
  sections: { heading: string; body: string }[];
  caution?: string;
  sources: Source[];
}

export const categories: { id: LearnCategory; label: string; detail: string }[] = [
  { id: "danger", label: "Dangerous shortcuts", detail: "What gym myths and social media sell" },
  { id: "supplements", label: "Supplements: the science", detail: "Useful, food first, or a waste of money" },
  { id: "body", label: "Your body", detail: "Muscle, tendons, soreness and warning signs" },
  { id: "fuel", label: "Fuel basics", detail: "Calories, protein, carbs, fat, fiber, water" },
  { id: "conditions", label: "Health conditions & 50+", detail: "Heart stent, knees, back, neck, kidneys, prostate, muscle loss" },
  { id: "faq", label: "Beginner questions", detail: "What new gym-goers ask most" },
];

export const verdicts: Record<Verdict, { label: string; color: string; bg: string }> = {
  avoid: { label: "Avoid — dangerous", color: "#B42318", bg: "#FDECEC" },
  helpful: { label: "Can help some people", color: "#1E7A47", bg: "#E7F6EE" },
  "food-first": { label: "Food first", color: "#2747C9", bg: "#EEF2FF" },
  waste: { label: "Usually not worth it", color: "#9A5B00", bg: "#FFF4DE" },
  know: { label: "Good to know", color: "#4B5563", bg: "#F1F3F6" },
};

const S = {
  odsExercise: { title: "NIH ODS — Dietary Supplements for Exercise and Athletic Performance", url: "https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/" },
  odsWhatToKnow: { title: "NIH ODS — Dietary Supplements: What You Need to Know", url: "https://ods.od.nih.gov/factsheets/WYNTK-Consumer/" },
  odsMvm: { title: "NIH ODS — Multivitamin/mineral Supplements", url: "https://ods.od.nih.gov/factsheets/MVMS-Consumer/" },
  odsB12: { title: "NIH ODS — Vitamin B12", url: "https://ods.od.nih.gov/factsheets/VitaminB12-Consumer/" },
  odsD: { title: "NIH ODS — Vitamin D", url: "https://ods.od.nih.gov/factsheets/VitaminD-Consumer/" },
  odsOmega: { title: "NIH ODS — Omega-3 Fatty Acids", url: "https://ods.od.nih.gov/factsheets/Omega3FattyAcids-Consumer/" },
  odsCarnitine: { title: "NIH ODS — Carnitine", url: "https://ods.od.nih.gov/factsheets/Carnitine-HealthProfessional/" },
  fdaBodybuilding: { title: "FDA — Certain bodybuilding products put consumers at risk", url: "https://www.fda.gov/drugs/fraudulent-products/certain-bodybuilding-products-put-consumers-risk-heart-attack-stroke-serious-liver-damage-and-more" },
  fdaDmaa: { title: "FDA — DMAA in products marketed as dietary supplements", url: "https://www.fda.gov/food/dietary-supplement-products-ingredients/dmaa-products-marketed-dietary-supplements" },
  fdaBodybuildingRisky: { title: "FDA (US) — Caution: bodybuilding products can be risky", url: "https://www.fda.gov/consumers/consumer-updates/caution-bodybuilding-products-can-be-risky" },
  nhsSteroids: { title: "NHS (UK) — Anabolic steroid misuse", url: "https://www.nhs.uk/conditions/anabolic-steroid-misuse/" },
  nidaSteroids: { title: "NIDA — Anabolic steroids", url: "https://archives.drugabuse.gov/publications/nida-community-drug-alert-bulletin-anabolic-steroids" },
  issnProtein: { title: "ISSN position stand: protein and exercise (2017)", url: "https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8" },
  issnCreatine: { title: "ISSN position stand: creatine (2017)", url: "https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0173-z" },
  creatineMyths: { title: "Common questions and misconceptions about creatine (JISSN 2021)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7871530/" },
  rhabdo: { title: "Stony Brook Medicine — Early signs of rhabdomyolysis", url: "https://health.stonybrookmedicine.edu/understanding-the-early-signs-of-rhabdomyolysis/" },
  diureticNews: { title: "TODAY — Young bodybuilder dies of complications of severe dehydration (2025)", url: "https://www.today.com/today/amp/rcna194869" },
  dga: { title: "Dietary Guidelines for Americans", url: "https://www.dietaryguidelines.gov/" },
  usdaFdc: { title: "USDA FoodData Central", url: "https://fdc.nal.usda.gov/" },
  off: { title: "Open Food Facts", url: "https://world.openfoodfacts.org/" },
  photoStudy: { title: "Healio — AI photo calorie apps underestimated meals by ~33% (NUTRITION 2026)", url: "https://www.healio.com/news/primary-care/20260804/ai-photobased-calorietracking-tools-underestimate-them-by-33" },
  cdcOlder: { title: "CDC — Physical activity for older adults", url: "https://www.cdc.gov/physical-activity-basics/guidelines/older-adults.html" },
  cdcArthritis: { title: "CDC — Exercise to ease arthritis pain", url: "https://www.cdc.gov/arthritis/communications/features/arthritis-exercise.html" },
  agingMuscle: { title: "Volpi et al. — Muscle tissue changes with aging (NIH PMC)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2804956/" },
  medlineAging: { title: "MedlinePlus — Aging changes in bones, muscles and joints", url: "https://medlineplus.gov/ency/article/004015.htm" },
  protAge: { title: "PROT-AGE — Protein intake in older people (JAMDA 2013)", url: "https://doi.org/10.1016/j.jamda.2013.05.021" },
  pciExercise: { title: "Exercising safely after PCI (stent)", url: "https://healthlibrary.ecuhealth.org/heart-health/gestion/exercising-safely-after-percutaneous-coronary-intervention-pci" },
  ahaRehab: { title: "American Heart Association — Cardiac rehab", url: "https://www.heart.org/en/health-topics/cardiac-rehab" },
  nkfFit: { title: "National Kidney Foundation — Exercise and CKD", url: "https://www.kidney.org/atoz/content/stayfit" },
  niddkCkdDiet: { title: "NIDDK — Eating right for chronic kidney disease", url: "https://www.niddk.nih.gov/health-information/kidney-disease/chronic-kidney-disease-ckd/eating-nutrition" },
  urineProtein: { title: "MedlinePlus — Protein in urine test", url: "https://medlineplus.gov/lab-tests/protein-in-urine" },
  bphSelfCare: { title: "MedlinePlus — Enlarged prostate: self-care", url: "https://medlineplus.gov/ency/patientinstructions/000398.htm" },
  kegel: { title: "MedlinePlus — Kegel exercises", url: "https://medlineplus.gov/ency/patientinstructions/000141.htm" },
  psa: { title: "UCLA Health — What can affect PSA results", url: "https://www.uclahealth.org/news/psa-test-results-can-be-affected-by-different-factors" },
  kneeReplacement: { title: "AAOS OrthoInfo — Activities after knee replacement", url: "https://www.orthoinfo.org/recovery/activities-after-knee-replacement/" },
  lumbarDisc: { title: "AAOS OrthoInfo — Herniated disk in the lower back", url: "https://www.orthoinfo.org/diseases--conditions/herniated-disk-in-the-lower-back/" },
  cervical: { title: "AAOS OrthoInfo — Cervical spondylosis (neck arthritis)", url: "https://www.orthoinfo.org/diseases--conditions/cervical-spondylosis-arthritis-of-the-neck/" },
};

export const articles: Article[] = [
  // ---------------- Dangerous shortcuts ----------------
  {
    id: "steroids", category: "danger", emoji: "💉", verdict: "avoid",
    title: "Anabolic steroids ('juice', 'a cycle')",
    summary: "Fast size from injections or pills comes with real, sometimes permanent damage. Muscle you build naturally stays; steroid side effects can stay too.",
    sections: [
      { heading: "What they are", body: "Lab-made versions of testosterone. Without a prescription for a medical condition they are illegal to buy and use in the US." },
      { heading: "What they can do to you", body: "Shrinking testicles, low sperm count, permanent breast growth in men, hair loss, severe acne, high blood pressure, bad cholesterol, blood clots, heart attack and stroke risk, liver tumours. Women can develop a deeper voice and body-hair growth. In teens they can stop growth early, so you end up shorter for life." },
      { heading: "Your mind", body: "Mood swings, aggression and, after stopping, depression, fatigue and strong cravings to use again. Some users develop a distorted view of their own body." },
      { heading: "Needles", body: "Shared or non-sterile needles spread HIV, hepatitis B and C, abscesses and heart-valve infections." },
    ],
    caution: "If you are using or thinking about using steroids, talk to a doctor confidentially. Do not stop prescribed steroid medicines (like prednisone) on your own — those are different medicines.",
    sources: [S.fdaBodybuildingRisky, S.nhsSteroids, S.nidaSteroids],
  },
  {
    id: "sarms", category: "danger", emoji: "⚠️", verdict: "avoid",
    title: "SARMs and 'research chemicals'",
    summary: "Sold online as a 'safe steroid' or labelled 'for research only'. The FDA says they are unapproved drugs with serious risks.",
    sections: [
      { heading: "What the FDA warns", body: "Liver injury including liver failure, higher risk of heart attack and stroke, psychosis, sleep problems, infertility and testicle shrinkage. Quality is unknown — you cannot know what is really in the bottle." },
      { heading: "Red flags", body: "'Not for human consumption', 'for research purposes', social-media promises of fast muscle, and products that come with dosing directions anyway." },
      { heading: "Get help if", body: "You have nausea, unusual weakness, fever, belly or chest pain, shortness of breath, yellow skin or eyes, or dark urine." },
    ],
    caution: "Talk to a health professional before using any product sold to increase muscle.",
    sources: [S.fdaBodybuilding],
  },
  {
    id: "diuretics", category: "danger", emoji: "🚱", verdict: "avoid",
    title: "Water pills for 'cuts' (diuretics such as furosemide)",
    summary: "Diuretics make your kidneys flush water and salts. Using them to look 'shredded' can cause dangerous dehydration and heart-rhythm problems.",
    sections: [
      { heading: "Why people use them", body: "To drop water under the skin so muscles look sharper for a photo, a show or a weigh-in. The 'cut' is water, not fat, and comes back as soon as you drink." },
      { heading: "What can go wrong", body: "Loss of potassium, sodium and magnesium can trigger cramps, weakness, fainting, kidney injury and irregular heartbeat. Young competitors have died from complications of severe dehydration linked to diuretic use." },
      { heading: "The real way to look defined", body: "Lower body fat over weeks with a modest calorie deficit, enough protein, strength training and sleep. Definition comes from fat loss and muscle, not from draining water." },
    ],
    caution: "Prescription diuretics are medicines for heart, kidney and blood-pressure conditions. Never take someone else's, and never stop or change your own without your doctor.",
    sources: [S.diureticNews, S.odsExercise],
  },
  {
    id: "fat-burners", category: "danger", emoji: "🔥", verdict: "avoid",
    title: "Stimulant 'fat burners' and DMAA",
    summary: "Strong stimulant blends promise fast fat loss. Some contain banned ingredients the FDA links to heart attacks and seizures.",
    sections: [
      { heading: "DMAA", body: "The FDA says DMAA is illegal in supplements. It raises blood pressure and is linked to heart attack, irregular heartbeat and seizures — worse when mixed with caffeine. Label names include methylhexanamine, geranamine, dimethylamylamine and 1,3-dimethylpentylamine." },
      { heading: "Stacking stimulants", body: "Burner + pre-workout + energy drink + coffee can add up to far more caffeine than is safe. Racing heart, chest pain or fainting means stop and get medical help." },
      { heading: "What actually works", body: "A sustainable calorie deficit you can keep for months, protein at each meal, strength training, daily steps and sleep." },
    ],
    caution: "Do not use weight-loss or stimulant products if you have a heart condition, high blood pressure or take medicines without asking your doctor.",
    sources: [S.fdaDmaa, S.odsExercise],
  },
  {
    id: "quality", category: "danger", emoji: "🔍", verdict: "know",
    title: "Who checks supplements? (Spoiler: not the FDA, first)",
    summary: "Supplements do not need FDA approval before they are sold. The company is responsible for safety and honest labels.",
    sections: [
      { heading: "What that means for you", body: "A product can reach the shelf without proof it works. Bodybuilding and weight-loss products have been found with hidden drugs." },
      { heading: "Quality seals", body: "Independent testing seals (such as USP, NSF or ConsumerLab) mean the product was checked for what is on the label and for harmful contaminants. They do not prove a product is safe for you or that it works." },
      { heading: "Proprietary blends", body: "If a label lists a 'blend' without the amount of each ingredient, you cannot know how much of anything you are taking." },
    ],
    sources: [S.odsWhatToKnow, S.odsExercise],
  },

  // ---------------- Supplements: the science ----------------
  {
    id: "protein-powder", category: "supplements", emoji: "🥤", verdict: "food-first",
    title: "Protein powder",
    summary: "Just protein in a convenient form. Helpful if you struggle to reach your daily protein from food — not magic, and not required to build muscle.",
    sections: [
      { heading: "How much protein matters", body: "People who train usually do well on 1.2–2.0 g of protein per kg of body weight per day (about 0.55–0.9 g per lb). Total daily protein matters most." },
      { heading: "When to take it", body: "Any time it helps you reach your total — with breakfast, after training, or as a snack. Spreading protein over 3–5 meals of roughly 20–40 g each works well. There is no tiny 30-minute 'window' you must hit." },
      { heading: "Food does the same job", body: "Chicken, fish, eggs, Greek yogurt, milk, beans, lentils and tofu all count. A shake is a convenience, not a requirement." },
      { heading: "BCAAs are already inside", body: "Whey and other complete proteins already contain BCAAs (leucine, isoleucine, valine). 'Added BCAAs' on a tub is mostly marketing." },
    ],
    caution: "If you have kidney disease or your doctor limits protein, ask before increasing protein.",
    sources: [S.odsExercise, S.issnProtein],
  },
  {
    id: "mass-gainer", category: "supplements", emoji: "🍚", verdict: "waste",
    title: "Mass gainers ('mega mass', weight gainers)",
    summary: "Mostly carbohydrate (often sugars) plus some protein — a very large calorie shake. It adds weight, not 'muscle by itself'.",
    sections: [
      { heading: "Who it might suit", body: "Someone who truly cannot eat enough food to gain weight, as a short-term convenience." },
      { heading: "Why most beginners do not need it", body: "One serving can be 1,000+ calories. Without enough training, extra calories become body fat. Milk, oats, peanut butter, rice, bananas and an extra meal do the same job for less money." },
      { heading: "Muscle gain is slow", body: "Muscle grows from training plus enough protein and calories over months. A small, steady calorie surplus beats a giant one." },
    ],
    caution: "Check labels for added sugars, and talk to your doctor if you have diabetes.",
    sources: [S.odsExercise, S.issnProtein],
  },
  {
    id: "creatine", category: "supplements", emoji: "⚡", verdict: "helpful",
    title: "Creatine (monohydrate)",
    summary: "One of the best-studied supplements. It can improve strength and power in short, hard efforts like lifting and sprints.",
    sections: [
      { heading: "What studies used", body: "Either 3–5 g once a day (muscles fill up over about 3–4 weeks), or a 'loading' week of about 20 g per day split into four 5 g servings for 5–7 days, then 3–5 g a day. Loading is optional — it only gets you there faster." },
      { heading: "Never all at once", body: "Taking 20 g in one go is not 'stronger' — it mostly causes stomach upset, nausea or diarrhea. More than you need is simply wasted." },
      { heading: "Water", body: "Creatine pulls water into muscle, so 1–2 kg of weight gain in the first month is normal water, not fat. Drink enough fluids, especially in heat." },
      { heading: "'Boosters' and fancy forms", body: "Monohydrate is the form with the evidence. Expensive 'advanced' creatine forms and 'boosters' have not been shown to work better." },
    ],
    caution: "Talk to your doctor first if you have kidney disease, diabetes or take regular medicines. Creatine can slightly raise creatinine on blood tests — tell your doctor you take it.",
    sources: [S.odsExercise, S.issnCreatine, S.creatineMyths],
  },
  {
    id: "pre-workout", category: "supplements", emoji: "☕", verdict: "know",
    title: "Pre-workout powders",
    summary: "Mostly caffeine plus extras. Caffeine can help performance, but scoops can carry a lot of it.",
    sections: [
      { heading: "Caffeine limits", body: "The FDA cites about 400 mg a day as generally safe for healthy adults — from all sources combined. One scoop can contain a large share of that, before coffee or energy drinks." },
      { heading: "Common effects", body: "Jitters, fast heartbeat, upset stomach and poor sleep. Tingling skin usually comes from beta-alanine and is harmless." },
      { heading: "Multi-ingredient blends", body: "Most research tests single ingredients. The safety of a specific mix is usually unknown, and 'proprietary blends' hide the amounts." },
      { heading: "Free alternative", body: "Sleep well, eat a meal with carbs 1–3 hours before training, or have a coffee." },
    ],
    caution: "Avoid stimulant pre-workouts if you have heart problems, high blood pressure, anxiety, are pregnant, or take medicines — ask your doctor.",
    sources: [S.odsExercise, S.fdaDmaa],
  },
  {
    id: "bcaa-eaa", category: "supplements", emoji: "🧪", verdict: "waste",
    title: "BCAAs and amino-acid drinks",
    summary: "If you eat enough protein, separate BCAA or amino-acid drinks add little.",
    sections: [
      { heading: "The evidence", body: "Little evidence that BCAAs improve performance or recovery when total protein intake is adequate." },
      { heading: "Why", body: "Whole protein foods and protein powder already contain all essential amino acids, including BCAAs." },
      { heading: "Better use of money", body: "Spend it on protein foods you enjoy and will eat consistently." },
    ],
    sources: [S.odsExercise],
  },
  {
    id: "carnitine", category: "supplements", emoji: "🧴", verdict: "waste",
    title: "L-carnitine ('fat burner')",
    summary: "Your body makes all the carnitine it needs. Studies in healthy people show mixed or no benefit for performance or fat loss.",
    sections: [
      { heading: "The evidence", body: "Healthy adults make enough carnitine in the liver and kidneys. Fat-loss results come mostly from people with obesity or diabetes, and are small." },
      { heading: "Side effects", body: "Around 3 g a day can cause nausea, stomach cramps, diarrhea and a fishy body odour." },
    ],
    caution: "People with seizure disorders or kidney disease should not take it without a doctor.",
    sources: [S.odsCarnitine],
  },
  {
    id: "arginine", category: "supplements", emoji: "💪", verdict: "waste",
    title: "L-arginine and 'pump' products",
    summary: "Reviews of many studies found little or no performance benefit from arginine.",
    sections: [
      { heading: "The evidence", body: "Doses of 2–20 g a day had little to no effect on strength or endurance, and it does not reliably raise growth hormone." },
      { heading: "Side effects", body: "Larger amounts can cause diarrhea and nausea and can lower blood pressure slightly." },
    ],
    caution: "Ask your doctor first if you take blood-pressure or heart medicines.",
    sources: [S.odsExercise],
  },
  {
    id: "beta-alanine", category: "supplements", emoji: "✨", verdict: "know",
    title: "Beta-alanine (the 'tingle')",
    summary: "May help modestly in hard efforts lasting about 1–10 minutes. The skin tingling is harmless.",
    sections: [
      { heading: "The evidence", body: "Benefits are small and inconsistent, mostly for high-intensity intervals rather than heavy single lifts." },
      { heading: "Tingling", body: "Larger single amounts cause tingling of the face, neck and hands for about an hour. Smaller split amounts or taking it with food reduce it." },
    ],
    sources: [S.odsExercise],
  },
  {
    id: "multivitamin", category: "supplements", emoji: "💊", verdict: "food-first",
    title: "Multivitamins",
    summary: "For most healthy people eating a varied diet, multivitamins show little benefit. They can help if your diet misses food groups.",
    sections: [
      { heading: "May help", body: "Very low-calorie diets, poor appetite, strict vegetarian or vegan diets, and people a doctor finds low in a nutrient." },
      { heading: "Too much is possible", body: "Stacking a multivitamin with fortified foods and other pills can push iron, vitamin A, zinc, niacin or folic acid too high." },
    ],
    caution: "Talk to your doctor before starting supplements, especially if you take warfarin or other medicines.",
    sources: [S.odsMvm],
  },
  {
    id: "vitamin-d", category: "supplements", emoji: "☀️", verdict: "food-first",
    title: "Vitamin D3",
    summary: "Important for bones and muscles. Worth checking if you get little sun, have darker skin or a doctor finds you low — not a muscle builder.",
    sections: [
      { heading: "Daily needs", body: "Adults 19–70 need 15 mcg (600 IU) a day; the upper limit from all sources is 100 mcg (4,000 IU) unless a doctor prescribes more for a deficiency." },
      { heading: "Too much", body: "Very high supplement intake can cause nausea, weakness, confusion, kidney stones and heart-rhythm problems." },
    ],
    caution: "Ask your doctor about a blood test before taking high doses.",
    sources: [S.odsD],
  },
  {
    id: "b12", category: "supplements", emoji: "🔋", verdict: "food-first",
    title: "Vitamin B12 'for energy'",
    summary: "B12 only boosts energy if you are deficient. Extra B12 does not add energy or endurance when your levels are normal.",
    sections: [
      { heading: "Who may need it", body: "Vegans and vegetarians, adults over 50, and people taking metformin or long-term acid reducers." },
      { heading: "How much", body: "Adults need about 2.4 mcg a day — easily met by animal foods or fortified foods." },
    ],
    sources: [S.odsB12],
  },
  {
    id: "omega-3", category: "supplements", emoji: "🐟", verdict: "food-first",
    title: "Omega-3 (fish oil)",
    summary: "Fatty fish twice a week is the simplest source. Supplements show limited benefit for healthy people without heart risk.",
    sections: [
      { heading: "Food sources", body: "Salmon, sardines, mackerel, trout, walnuts, chia and flaxseed." },
      { heading: "Supplements", body: "The FDA advises no more than 5 g a day of EPA and DHA combined from supplements. Side effects include fishy aftertaste, heartburn and loose stools." },
    ],
    caution: "Fish oil can increase bleeding risk with blood thinners — ask your doctor.",
    sources: [S.odsOmega],
  },

  // ---------------- Your body ----------------
  {
    id: "muscle", category: "body", emoji: "🫀", verdict: "know",
    title: "What muscle is and how it grows",
    summary: "Muscles are bundles of fibers that grow when you challenge them, feed them and let them recover.",
    sections: [
      { heading: "Fibers", body: "Each muscle is made of thousands of long fibers. Training stresses them; during rest they rebuild a little stronger and, over time, a little bigger." },
      { heading: "The three things that matter", body: "1) Progressive overload — slowly add weight, reps or sets. 2) Enough protein and calories. 3) Sleep and rest days." },
      { heading: "Realistic speed", body: "Strength often improves in the first weeks as your nerves learn the movement. Visible muscle takes months of consistent training." },
    ],
    sources: [S.issnProtein],
  },
  {
    id: "tendons", category: "body", emoji: "🦴", verdict: "know",
    title: "Tendons and joints: why to go slow",
    summary: "Tendons connect muscle to bone. They adapt more slowly than muscle, so jumping weights too fast is a common way to get hurt.",
    sections: [
      { heading: "Go gradually", body: "Increase load in small steps, warm up, and use good form before going heavier." },
      { heading: "Warning signs", body: "Pain in a joint or tendon that is sharp, gets worse each session or lingers for days is not 'good pain' — rest it and get it checked." },
    ],
    sources: [S.odsExercise],
  },
  {
    id: "soreness", category: "body", emoji: "😣", verdict: "know",
    title: "Soreness vs injury",
    summary: "Feeling sore 1–3 days after a new workout is normal. Sharp pain, swelling or pain that stops you moving is not.",
    sections: [
      { heading: "Normal soreness", body: "Dull, achy, in the muscle you trained, worst about 24–72 hours later, and easing with gentle movement. It gets milder as your body adapts." },
      { heading: "Probably an injury", body: "Sudden sharp pain during a lift, a pop, swelling, bruising, joint pain, or weakness that does not improve." },
      { heading: "Will my muscles 'tear'?", body: "Training causes tiny, normal micro-damage that your body repairs. Real tears are injuries — usually from too much weight, poor form or no warm-up." },
    ],
    sources: [S.rhabdo],
  },
  {
    id: "rhabdo", category: "body", emoji: "🚨", verdict: "avoid",
    title: "Overdoing it: rhabdomyolysis warning signs",
    summary: "Extreme first workouts, heat and dehydration can break down muscle so fast that it harms the kidneys. It is rare, but serious.",
    sections: [
      { heading: "Get emergency care if", body: "Your urine turns dark or tea-coloured, you have severe muscle pain or swelling far beyond normal soreness, you cannot move a limb because of weakness, you have not urinated for hours, or you feel confused or feverish." },
      { heading: "Lower your risk", body: "Start easy, build up over weeks, drink fluids, avoid extreme sessions in heat, and avoid alcohol and drugs around hard training." },
    ],
    caution: "Call your local emergency number (911 in the US and Canada, 999 in the UK) or go to the nearest emergency room for the signs above.",
    sources: [S.rhabdo],
  },

  // ---------------- Fuel basics ----------------
  {
    id: "calories", category: "fuel", emoji: "🔢", verdict: "know",
    title: "Calories, simply",
    summary: "Calories are the energy in food. Eating a little less than you burn loses fat; a little more helps you gain.",
    sections: [
      { heading: "Small changes win", body: "Big deficits make you tired, hungry and weaker in the gym. A modest change you can keep for months beats a crash diet." },
      { heading: "Snap to Fit's estimate", body: "Your daily estimate is a starting point from a standard formula. Your doctor or dietitian may set different targets, especially with a health condition." },
    ],
    sources: [S.dga],
  },
  {
    id: "macros", category: "fuel", emoji: "🍽️", verdict: "know",
    title: "Protein, carbs and fat",
    summary: "Protein builds and repairs, carbs fuel training, and fat supports hormones and health. You need all three.",
    sections: [
      { heading: "Protein", body: "About 1.2–2.0 g per kg a day for people who train, spread across meals." },
      { heading: "Carbs", body: "Your main training fuel — rice, oats, potatoes, fruit, bread and pasta. Active people may need 3–10 g per kg a day depending on how much they train." },
      { heading: "Fat", body: "About 20–35% of your calories from foods like olive oil, nuts, avocado, eggs and fish." },
    ],
    sources: [S.odsExercise],
  },
  {
    id: "fiber-water", category: "fuel", emoji: "💧", verdict: "know",
    title: "Fiber and water",
    summary: "Fiber keeps you full and your gut healthy; water keeps you performing — especially with creatine, heat or sweating.",
    sections: [
      { heading: "Fiber", body: "A common guide is about 14 g of fiber per 1,000 calories — from vegetables, fruit, beans, lentils, oats and whole grains." },
      { heading: "Water", body: "Needs vary with body size, heat and sweat. Drink through the day; pale-yellow urine is a simple check. Dark urine after hard training needs attention." },
    ],
    sources: [S.dga, S.rhabdo],
  },

  {
    id: "how-we-estimate", category: "fuel", emoji: "🔬", verdict: "know",
    title: "How Snap to Fit estimates your food",
    summary: "Lab data first, package labels second, photos last — and always an honest range instead of a fake-precise number.",
    sections: [
      { heading: "Search", body: "Foods come from USDA FoodData Central (SR Legacy) — lab-analysed reference values for 8,000+ foods with up to 19 nutrients. Dishes like biryani or a burrito bowl are built from USDA ingredients in typical home portions, so they carry a wider range." },
      { heading: "Barcode", body: "Packaged foods come from Open Food Facts, a free open database of package labels. Check the label on your package — recipes change." },
      { heading: "Photo", body: "The AI names the foods and estimates grams; the calories then come from USDA data for each item. A 2026 study found popular photo apps underestimated meals by about a third, mostly fat — so we ask about cooking oil and show a range." },
      { heading: "Why a range", body: "Portions you eyeball, hidden oil, butter and sauces make every food log approximate. The likely range shows how sure the estimate is; weighing food now and then keeps you honest." },
    ],
    sources: [S.usdaFdc, S.off, S.photoStudy],
  },

  // ---------------- Health conditions & 50+ ----------------
  {
    id: "muscle-loss-50", category: "conditions", emoji: "📉", verdict: "know",
    title: "Muscle loss after 50 (sarcopenia): what and why",
    summary: "From about age 30, adults slowly lose muscle — roughly 3–8% per decade — and the loss speeds up after 60. Strength training and enough protein slow it down at any age.",
    sections: [
      { heading: "What it is", body: "Sarcopenia means losing muscle size and strength with age. Muscle fibers shrink, some are replaced by fat and stiffer tissue, and nerves that drive muscle become less efficient. Less muscle means weaker legs, slower walking, poorer balance and a higher chance of falls." },
      { heading: "Why it happens", body: "Several things together: less physical activity, falling hormone levels (such as testosterone), eating too little protein or too few calories, illness or bed rest, and genes. A few weeks of bed rest can take away muscle that takes months to rebuild." },
      { heading: "What slows it", body: "Muscle-strengthening on at least 2 days a week for all major muscle groups (bands, machines, body weight or weights), plus regular walking and balance practice. Older muscles still grow when trained — it is never too late to start." },
      { heading: "Protein matters more after 50", body: "Experts on ageing suggest at least 1.0–1.2 g of protein per kg of body weight a day for older adults, and 1.2 g/kg or more if you exercise — spread across meals. People with kidney disease who are not on dialysis are the exception and may need less: ask your doctor or dietitian." },
      { heading: "Warning sign", body: "Struggling to stand up from a chair without your hands, slower walking, or unplanned weight loss are worth mentioning to your doctor." },
    ],
    caution: "Testosterone or 'boosters' are not a shortcut for muscle loss. Testosterone is a prescription medicine with real risks — only use it if your doctor prescribes it.",
    sources: [S.agingMuscle, S.medlineAging, S.cdcOlder, S.protAge],
  },
  {
    id: "start-50", category: "conditions", emoji: "🧓", verdict: "know",
    title: "Starting the gym after 50",
    summary: "Your weekly target is the same as younger adults, plus balance work: about 150 minutes of moderate activity and strength training on 2 or more days.",
    sections: [
      { heading: "A simple week", body: "Brisk walking or cycling 30 minutes on 5 days, two short full-body strength sessions, and a few minutes of balance practice (heel-to-toe walking, standing from a chair, single-leg stands holding support)." },
      { heading: "Go slower than younger lifters", body: "Use lighter weights with more reps (10–15), warm up for 5–10 minutes, rest longer between sets and add load in small steps. Machines with back support are a good start." },
      { heading: "Breathing", body: "Breathe out as you push or lift, and never hold your breath during a heavy effort — it sharply raises blood pressure." },
      { heading: "Recovery", body: "Muscles and tendons recover more slowly with age. A rest or light day between strength sessions is normal and helpful." },
    ],
    caution: "Ask your doctor before starting if you have heart disease, high blood pressure, diabetes, kidney disease, joint replacements or take regular medicines.",
    sources: [S.cdcOlder, S.medlineAging],
  },
  {
    id: "heart-stent", category: "conditions", emoji: "❤️", verdict: "know",
    title: "Heart stent, angioplasty or bypass: how to exercise",
    summary: "Exercise is part of recovery, but it should start under a supervised cardiac rehab program, with your cardiologist setting your limits.",
    sections: [
      { heading: "Start with cardiac rehab", body: "Cardiac rehab is a medically supervised program designed by your heart team. It tests what your heart can safely do and teaches you how hard to work. Ask your cardiologist for a referral — it is the safest place to begin." },
      { heading: "Cardio", body: "Walking, stationary cycling and swimming are good choices. Start gently and build up over weeks toward about 150 minutes a week, at a pace where you can still talk." },
      { heading: "Strength", body: "Light to moderate strength training with bands, body weight or light machines on 2 or more days a week is usually part of the plan once your team clears it. Use more reps with lighter weight, breathe out on effort and avoid straining or breath-holding. Ask when you may lift heavier, and about any short-term limits after the procedure." },
      { heading: "Medicines change how exercise feels", body: "Some heart medicines lower your heart rate, so heart-rate targets on a watch may not apply — your rehab team can give you the right effort level. Blood thinners make bruising and bleeding easier, so ask about contact sports." },
      { heading: "Stop and get help", body: "Chest pain, pressure or tightness, pain spreading to the arm, jaw or back, unusual shortness of breath, dizziness, fainting or a racing or irregular heartbeat: stop and call your local emergency number (911 in the US and Canada, 999 in the UK)." },
    ],
    caution: "Do not use stimulant pre-workouts, fat burners or energy drinks without asking your cardiologist.",
    sources: [S.ahaRehab, S.pciExercise],
  },
  {
    id: "blood-pressure", category: "conditions", emoji: "🩺", verdict: "know",
    title: "High blood pressure and lifting",
    summary: "Regular exercise helps lower blood pressure. The key is to avoid straining and breath-holding with heavy weights.",
    sections: [
      { heading: "What helps", body: "Daily walking or cycling and moderate strength training with controlled breathing." },
      { heading: "What to avoid", body: "Maximum lifts, holding your breath while pushing, and stimulant pre-workouts or fat burners, which raise blood pressure." },
      { heading: "Ask first if", body: "Your blood pressure is very high or not yet controlled — your doctor may want it treated before you train hard." },
    ],
    caution: "Never change blood-pressure medicines because you have started exercising — talk to your doctor.",
    sources: [S.cdcOlder, S.fdaDmaa],
  },
  {
    id: "diabetes-exercise", category: "conditions", emoji: "🩸", verdict: "know",
    title: "Diabetes and exercise",
    summary: "Exercise improves blood sugar control. If you use insulin or some diabetes pills, low blood sugar during or after exercise is the main risk.",
    sections: [
      { heading: "Be prepared", body: "Check your glucose before and after exercise if your care team advises it, and carry fast-acting sugar. Low blood sugar can appear hours after a workout." },
      { heading: "Feet", body: "Wear well-fitting shoes and check your feet for blisters or cuts, especially if you have reduced feeling in them." },
    ],
    caution: "Follow your care team's plan for insulin and food around exercise. Snap to Fit cannot adjust your medicine.",
    sources: [S.cdcOlder],
  },
  {
    id: "kidney-exercise", category: "conditions", emoji: "🫘", verdict: "know",
    title: "Kidney disease: exercise, protein and supplements",
    summary: "Exercise is recommended at every stage of kidney disease. Protein, fluids and supplements need your kidney team's guidance.",
    sections: [
      { heading: "Exercise", body: "Walking, cycling and light strength training with bands or weights help keep muscles and bones strong. Start slowly, warm up, and ask your team which exercises suit you — especially if you have a dialysis access in your arm." },
      { heading: "Protein", body: "If you are not on dialysis, a lower-protein diet is usually advised to reduce strain on the kidneys. If you are on dialysis, you often need more protein. Too little can cause malnutrition, so a kidney dietitian should set your amount." },
      { heading: "Fluids", body: "Some people with kidney disease must limit fluids. Ask your team how much to drink before, during and after exercise." },
      { heading: "Avoid without your team's OK", body: "Creatine, protein shakes and mass gainers, high-dose vitamins, herbal products and regular pain relievers such as ibuprofen or naproxen, which can harm kidneys." },
    ],
    caution: "Talk to your kidney doctor before starting any exercise program or supplement.",
    sources: [S.nkfFit, S.niddkCkdDiet, S.urineProtein],
  },
  {
    id: "protein-urine", category: "conditions", emoji: "🧫", verdict: "know",
    title: "Will protein powder put protein in my urine?",
    summary: "Healthy kidneys keep protein in the blood. Protein that keeps showing up in urine is a sign to check the kidneys — not something normal eating causes.",
    sections: [
      { heading: "Why protein appears in urine", body: "When kidney filters are damaged, protein (often albumin) leaks into urine. Diabetes, high blood pressure, heart disease and a family history of kidney disease raise the risk." },
      { heading: "Short-term causes", body: "Hard exercise, dehydration, stress and some diets can raise urine protein for a short time. Avoid a hard workout before a urine test and tell your doctor if you trained the day before." },
      { heading: "If you are over 50 and take protein", body: "If your kidneys are healthy, a sensible protein intake is not what causes protein in urine. If you have diabetes, high blood pressure or kidney disease, ask your doctor for a urine albumin test and how much protein is right for you." },
      { heading: "See your doctor if", body: "Your urine is persistently foamy or bloody, or you have swelling of the feet, ankles or face." },
    ],
    caution: "One test result does not diagnose kidney disease — your doctor will repeat or add tests.",
    sources: [S.urineProtein, S.niddkCkdDiet],
  },
  {
    id: "prostate", category: "conditions", emoji: "🚹", verdict: "know",
    title: "Prostate problems and exercise",
    summary: "Staying active helps urinary symptoms of an enlarged prostate. A few simple changes make training more comfortable.",
    sections: [
      { heading: "What helps", body: "Regular exercise and keeping warm — cold and inactivity can make enlarged-prostate symptoms worse. Walking, strength training and swimming are all fine for most men." },
      { heading: "Drinks and pre-workouts", body: "Caffeine and alcohol can worsen urgency, especially later in the day, and many pre-workouts are high in caffeine. Spread fluids through the day instead of drinking a lot at once, and avoid drinking within 2 hours of bed." },
      { heading: "Cold and sinus medicines", body: "Decongestants and antihistamines can make urinating harder. Ask your pharmacist before using them." },
      { heading: "Cycling", body: "Long rides put pressure on the area. Use a padded or split saddle, stand up on the pedals now and then, and tell your doctor about recent long rides before a PSA test — cycling and ejaculation can temporarily raise PSA." },
      { heading: "Pelvic floor (Kegel) exercises", body: "These can help with urine leakage, including after prostate surgery. Ask your doctor or a pelvic-floor physical therapist to teach you the right technique." },
      { heading: "Testosterone and steroids", body: "Men with prostate cancer or on prostate-cancer treatment must not use testosterone, 'boosters' or steroids unless their cancer doctor approves." },
    ],
    caution: "See your doctor if you have trouble passing urine, blood in urine, fever or pain — and get checked before assuming symptoms are 'just age'.",
    sources: [S.bphSelfCare, S.kegel, S.psa],
  },
  {
    id: "knee-pain", category: "conditions", emoji: "🦵", verdict: "know",
    title: "Knee pain and knee arthritis",
    summary: "Exercise is one of the best treatments for knee arthritis. Low-impact cardio and leg strengthening reduce pain and improve how you move.",
    sections: [
      { heading: "What helps", body: "Walking, stationary cycling, swimming and water exercise. Strong thigh and hip muscles take load off the knee: sit-to-stands from a chair, low step-ups, leg press in a comfortable range, glute bridges and side-lying leg raises." },
      { heading: "Go easy on", body: "Jumping, running on hard surfaces, deep loaded squats and lunges that cause pain, and twisting on a planted foot." },
      { heading: "A useful pain check", body: "Many physical therapists use this rule: mild discomfort that settles within 24 hours is usually acceptable; pain that is sharp, causes limping or is worse the next day means reduce the load." },
      { heading: "Weight", body: "Each pound of body weight adds load to the knees with every step, so steady weight loss often eases knee pain." },
    ],
    caution: "A swollen, hot, locking or giving-way knee needs a doctor's check before you train it.",
    sources: [S.cdcArthritis, S.cdcOlder],
  },
  {
    id: "knee-replacement", category: "conditions", emoji: "🦿", verdict: "know",
    title: "Knee replacement — before and after",
    summary: "Before surgery, staying as strong and active as you comfortably can helps recovery. After surgery, your physical therapy plan comes first.",
    sections: [
      { heading: "Waiting for surgery", body: "Ask your surgeon about 'prehab': gentle strengthening for thighs and hips, a stationary bike and walking as tolerated. Stronger muscles before surgery usually make the first weeks easier." },
      { heading: "After surgery", body: "Keep doing the exercises your physical therapist prescribes for at least 2 months. Walking is encouraged but does not replace them. Swelling can last 3–6 months." },
      { heading: "Good long-term activities", body: "Walking, cycling, swimming (once the wound has healed and your doctor approves), golf and similar lower-impact activities." },
      { heading: "Avoid", body: "High-impact activities such as jumping, jogging and skiing, and doing too much too soon. Keep your weight steady to protect the new joint." },
    ],
    caution: "Your surgeon and physical therapist decide when you may return to the gym, drive or play sports.",
    sources: [S.kneeReplacement],
  },
  {
    id: "slip-disc", category: "conditions", emoji: "🧍", verdict: "know",
    title: "Slip disc and lower-back pain (L3, L4, L5)",
    summary: "Most lower-back disc problems happen at the lowest levels of the spine and improve within a few months with movement and physical therapy.",
    sections: [
      { heading: "What it is", body: "A 'slip disc' is a herniated disc: the soft centre of a disc pushes out and can press on a nerve, causing back pain or pain down the leg (sciatica). The lowest discs (around L4–L5 and L5–S1) carry the most load and are affected most often." },
      { heading: "Keep moving", body: "Limit bed rest to 1–2 days. Short walks, breaks from long sitting and slow, controlled movement help. Most people are symptom-free within 3–4 months." },
      { heading: "In the gym", body: "A physical therapist can give you a core and back-strengthening program. Start with supported machines, bridges, bird-dogs and walking. Avoid heavy deadlifts, heavy squats with a bar on your back, sit-ups, twisting with weights and fast bending until your therapist clears you." },
      { heading: "Lifting at home and work", body: "Bend your knees, keep the load close, and avoid twisting while lifting." },
      { heading: "Emergency signs", body: "Loss of bladder or bowel control, numbness in the groin or inner thighs, or rapidly worsening leg weakness: go to the emergency room immediately." },
    ],
    caution: "Get a doctor's or physical therapist's assessment before training with back pain that spreads down the leg.",
    sources: [S.lumbarDisc],
  },
  {
    id: "cervical", category: "conditions", emoji: "🧑‍⚕️", verdict: "know",
    title: "Neck problems (cervical spondylosis or disc)",
    summary: "Physical therapy is usually the first treatment: exercises to ease pain and build neck strength and flexibility, plus posture work.",
    sections: [
      { heading: "What helps", body: "Gentle neck range-of-motion and strengthening exercises from a therapist (often 6–8 weeks), upper-back and shoulder-blade strengthening, and good posture at the desk and phone." },
      { heading: "Avoid until cleared", body: "Heavy overhead pressing, heavy shrugs, behind-the-neck presses or pulldowns, headstands and neck bridges, and jerky or bouncing neck movements." },
      { heading: "See a doctor promptly if", body: "You have clumsy hands (trouble buttoning or writing), loss of balance or falls, or weakness or numbness in the arms or legs that is getting worse — these can mean the spinal cord is being pressed." },
    ],
    caution: "Ask your doctor or physical therapist before lifting weights with neck pain that spreads to the arm.",
    sources: [S.cervical],
  },

  // ---------------- Beginner questions ----------------
  {
    id: "faq-supplements", category: "faq", emoji: "🛒", verdict: "know",
    title: "Do I need supplements to start the gym?",
    summary: "No. Training consistently, eating enough protein, sleeping and being patient matter far more than any tub.",
    sections: [
      { heading: "If you buy one thing", body: "Protein powder only if you cannot reach your protein from food. Creatine monohydrate is the best-studied option for strength — optional." },
      { heading: "Skip", body: "Steroids, SARMs, diuretics, stimulant fat burners and 'research chemicals'." },
    ],
    sources: [S.odsExercise, S.fdaBodybuilding],
  },
  {
    id: "faq-first-week", category: "faq", emoji: "🗓️", verdict: "know",
    title: "What will my first weeks feel like?",
    summary: "Expect soreness, some tiredness and fast early strength gains as your body learns the movements.",
    sections: [
      { heading: "Week 1–2", body: "Muscles may feel sore for 1–3 days after sessions. Start lighter than you think and focus on form." },
      { heading: "Week 3–8", body: "Soreness fades, weights go up, and workouts feel more natural. Visible changes usually take longer — stay consistent." },
    ],
    sources: [S.rhabdo],
  },
  {
    id: "faq-creatinine", category: "faq", emoji: "🧾", verdict: "know",
    title: "Creatine or creatinine — what is the difference?",
    summary: "Creatine is the supplement. Creatinine is a waste product your kidneys clear, measured in blood tests.",
    sections: [
      { heading: "Why it matters", body: "Taking creatine can raise creatinine a little on lab tests without kidney damage in healthy people. Tell your doctor you take creatine so results are read correctly." },
      { heading: "Is creatine a steroid?", body: "No. It is a natural compound found in meat and fish and made by your body." },
    ],
    caution: "If you have kidney disease, talk to your doctor before using creatine.",
    sources: [S.creatineMyths, S.issnCreatine],
  },
  {
    id: "faq-shake-timing", category: "faq", emoji: "⏱️", verdict: "know",
    title: "Do I have to drink a shake right after the gym?",
    summary: "No rush. Your total protein across the day matters most; a protein-rich meal within a few hours is fine.",
    sections: [
      { heading: "Simple plan", body: "Eat protein at each meal (roughly 20–40 g), including one meal before or after training." },
    ],
    sources: [S.issnProtein],
  },
];

export function articlesIn(category: LearnCategory) {
  return articles.filter((a) => a.category === category);
}

/** Topics matched to a profile's own health details, ages 50+ and movement limits. */
export function topicsFor(p: { age: number; conditions: string[]; limits?: string[]; sex?: string }) {
  const ids: string[] = [];
  const add = (...x: string[]) => x.forEach((id) => !ids.includes(id) && ids.push(id));
  if (p.age >= 50) add("muscle-loss-50", "start-50");
  if (p.conditions.includes("heart")) add("heart-stent");
  if (p.conditions.includes("hypertension")) add("blood-pressure");
  if (p.conditions.includes("type1") || p.conditions.includes("type2")) add("diabetes-exercise", "protein-urine");
  if (p.conditions.includes("kidney")) add("kidney-exercise", "protein-urine");
  const l = p.limits || [];
  if (l.includes("knee")) add("knee-pain");
  if (l.includes("knee-replacement")) add("knee-replacement");
  if (l.includes("lower-back")) add("slip-disc");
  if (l.includes("neck")) add("cervical");
  if (l.includes("prostate")) add("prostate");
  if (p.age >= 50 && p.sex === "male") add("prostate");
  return ids.map((id) => articles.find((a) => a.id === id)!).filter(Boolean);
}

export function searchArticles(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return articles;
  return articles.filter((a) =>
    [a.title, a.summary, ...a.sections.map((s) => `${s.heading} ${s.body}`)].join(" ").toLowerCase().includes(q),
  );
}
