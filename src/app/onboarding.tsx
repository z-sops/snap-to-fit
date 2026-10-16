import { buildMealPlan, dietaryType } from "../core/meal-planning";
import { dietChoices, allergenChoices } from "../core/meal-catalog";
import { CuisinePreferences } from "../components/CuisinePreferences";
import { weekdays } from "../components/WorkoutPreferences";
import { cancelNotifications } from "../services/routine-notifications";
import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { act, notify } from "../components/ui";
import {
  Logo,
  OptionCard,
  ProgressRing,
  Segmented,
  StepShell,
  WheelPicker,
  theme,
  useCountUp,
} from "../components/onboarding-ui";
import { useStore } from "../services/store";
import { newProfile, type Profile, type Condition, type MovementLimit, validateProfile, uid } from "../core/model";
import { nutritionTargets } from "../core/nutrition";
import { doctorNotice, steroidNotice } from "../core/safety";
import {
  cmToHeightValue,
  heightOptions,
  heightToCm,
  kgToWeightValue,
  weightOptions,
  weightToKg,
  formatWeight,
  type Units,
} from "../core/units";
import menuArt from "../../assets/menu-nutrition.png";
import { glp1Choices } from "../core/glp1";

const limitChoices: { value: MovementLimit; label: string; emoji: string }[] = [
  { value: "knee", label: "Knee pain or knee arthritis", emoji: "🦵" },
  { value: "knee-replacement", label: "Knee replacement (done or planned)", emoji: "🦿" },
  { value: "lower-back", label: "Lower back / slip disc (L3–L5)", emoji: "🧍" },
  { value: "neck", label: "Neck / cervical problem", emoji: "🧑‍⚕️" },
  { value: "shoulder", label: "Shoulder pain or injury", emoji: "💪" },
  { value: "prostate", label: "Prostate problem", emoji: "🚹" },
];

const conditions: { value: Condition; label: string }[] = [
  { value: "type1", label: "Type 1 diabetes" },
  { value: "type2", label: "Type 2 diabetes" },
  { value: "hypertension", label: "High blood pressure" },
  { value: "heart", label: "Heart condition / stent / bypass / angioplasty" },
  { value: "kidney", label: "Kidney condition" },
  { value: "pregnant", label: "Pregnant / breastfeeding" },
  { value: "eating-disorder", label: "Eating-disorder history" },
];

type StepId =
  | "name" | "sex" | "age" | "height" | "weight" | "goal" | "target" | "activity"
  | "training" | "week" | "health" | "glp1" | "injuries" | "diet" | "cuisine" | "consent";

function startProfile(existing: Profile | null): Profile {
  if (existing) return { ...existing, units: existing.units ?? "metric" };
  return { ...newProfile, age: 30, height: 170, weight: 75, targetWeight: 75 };
}

export default function Onboarding() {
  const { state, update } = useStore();
  const editing = !!state.profile;
  const [p, setP] = useState<Profile>(() => startProfile(state.profile));
  const [phase, setPhase] = useState<"welcome" | "steps" | "reveal">(editing ? "steps" : "welcome");
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [glpAnswer, setGlpAnswer] = useState<"yes" | "no" | undefined>(
    state.profile ? (state.profile.glp1 ? "yes" : "no") : undefined,
  );
  const [otherMeds, setOtherMeds] = useState(() =>
    (state.profile?.medicines || "")
      .split("\n")
      .filter((l) => !l.startsWith("GLP-1:"))
      .join("\n")
      .trim(),
  );
  const units: Units = p.units ?? "imperial";
  const change = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));

  const steps = useMemo<StepId[]>(
    () => [
      "name", "sex", "age", "height", "weight", "goal",
      ...(p.goal === "maintain" ? [] : (["target"] as StepId[])),
      "activity", "training", "week", "health", "glp1", "injuries", "diet", "cuisine", "consent",
    ],
    [p.goal],
  );
  const id = steps[Math.min(index, steps.length - 1)];

  // Medication text the rest of the app reads (Medicines screen, coach safeguards, targets pause).
  const finalProfile = (): Profile => {
    const glp1 = glpAnswer === "yes" ? p.glp1 || "" : "";
    const medicines = [glp1 ? `GLP-1: ${glp1}` : "", otherMeds.trim()].filter(Boolean).join("\n");
    return {
      ...p,
      glp1: glp1 || undefined,
      medicines,
      targetWeight: p.goal === "maintain" ? p.weight : p.targetWeight,
    };
  };

  const stepError = (s: StepId): string | null => {
    switch (s) {
      case "name":
        return p.name.trim() ? null : "Enter your first name.";
      case "target":
        if (p.goal === "lose" && p.targetWeight >= p.weight) return "Choose a target below your current weight.";
        if (p.goal === "gain" && p.targetWeight <= p.weight) return "Choose a target above your current weight.";
        if (p.goal === "lose" && p.targetWeight / (p.height / 100) ** 2 < 18.5)
          return "This target is below the adult BMI reference range. Choose a higher target.";
        return null;
      case "week":
        return p.workoutDays && p.workoutDays.length === p.days ? null : `Choose ${p.days} workout day${p.days > 1 ? "s" : ""}.`;
      case "glp1":
        if (!glpAnswer) return "Choose Yes or No.";
        if (glpAnswer === "yes" && !p.glp1) return "Choose the medication on your prescription.";
        return null;
      case "consent":
        return p.consent ? null : "Please confirm you are 18 or older and understand how your information is used.";
      default:
        return null;
    }
  };

  const next = () => {
    const err = stepError(id);
    if (err) return notify(err);
    if (id === "goal" && p.goal !== "maintain" && p.targetWeight === p.weight)
      change("targetWeight", Math.round((p.goal === "lose" ? p.weight - 5 : p.weight + 3) * 10) / 10);
    if (index < steps.length - 1) return setIndex(index + 1);
    try {
      validateProfile(finalProfile());
    } catch (e) {
      return notify(e instanceof Error ? e.message : "Check your answers.");
    }
    setPhase("reveal");
  };
  const back = () => (index > 0 ? setIndex(index - 1) : editing ? close() : setPhase("welcome"));
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const save = () =>
    act(async () => {
      const fp = finalProfile();
      validateProfile(fp);
      setBusy(true);
      try {
        if (fp.age > 50) await cancelNotifications(state.education?.reminderIds || []);
        await update((s) => ({
          ...s,
          profile: fp,
          education: fp.age > 50 && s.education ? { ...s.education, enabled: false, reminderIds: [] } : s.education,
          mealPlan: buildMealPlan(fp),
          readings:
            s.profile && s.profile.weight === fp.weight
              ? s.readings
              : [
                  ...s.readings,
                  { id: uid(), at: new Date().toISOString(), kind: "weight", value: fp.weight, unit: "kg", context: "Starting weight", source: "manual" },
                ],
        }));
        router.replace("/");
      } finally {
        setBusy(false);
      }
    });

  if (phase === "welcome") return <Welcome onStart={() => setPhase("steps")} />;
  if (phase === "reveal")
    return <Reveal profile={finalProfile()} busy={busy} onBack={() => setPhase("steps")} onStart={save} />;

  const shell = (title: string, subtitle: string | undefined, body: React.ReactNode, nextLabel?: string) => (
    <StepShell
      step={index + 1}
      total={steps.length}
      title={title}
      subtitle={subtitle}
      onBack={back}
      onClose={editing ? close : undefined}
      onNext={next}
      nextLabel={nextLabel}
    >
      {body}
    </StepShell>
  );

  switch (id) {
    case "name":
      return shell("What should we call you?", "Your first name personalises your plan.",
        <TextInput
          value={p.name}
          onChangeText={(v) => change("name", v)}
          placeholder="First name"
          placeholderTextColor={theme.muted}
          accessibilityLabel="First name"
          autoFocus={!editing}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={next}
          style={s.bigInput}
        />);
    case "sex":
      return shell("Which sex should we use for your estimate?", "Used only in the calorie formula. It does not represent your gender identity.",
        <>
          <OptionCard label="Female" emoji="🙋‍♀️" selected={p.sex === "female"} onPress={() => change("sex", "female")} />
          <OptionCard label="Male" emoji="🙋‍♂️" selected={p.sex === "male"} onPress={() => change("sex", "male")} />
        </>);
    case "age":
      return shell("How old are you?", "Snap to Fit is for adults 18 and over.",
        <WheelPicker label="Age" value={p.age} onChange={(v) => change("age", v)}
          options={Array.from({ length: 83 }, (_, i) => ({ value: 18 + i, label: `${18 + i}` }))} />);
    case "height":
      return shell("How tall are you?", undefined,
        <>
          <Segmented value={units} onChange={(u) => change("units", u)}
            options={[{ value: "imperial", label: "ft / in" }, { value: "metric", label: "cm" }]} />
          <WheelPicker label="Height" options={heightOptions(units)} value={cmToHeightValue(p.height, units)}
            onChange={(v) => change("height", heightToCm(v, units))} />
        </>);
    case "weight":
      return shell("What is your current weight?", undefined,
        <>
          <Segmented value={units} onChange={(u) => change("units", u)}
            options={[{ value: "imperial", label: "lb" }, { value: "metric", label: "kg" }]} />
          <WheelPicker label="Weight" options={weightOptions(units)} value={kgToWeightValue(p.weight, units)}
            onChange={(v) => change("weight", weightToKg(v, units))} />
        </>);
    case "goal":
      return shell("What is your main goal?", undefined,
        <>
          <OptionCard label="Lose fat" detail="A gentle calorie deficit" emoji="🔥" selected={p.goal === "lose"} onPress={() => change("goal", "lose")} />
          <OptionCard label="Maintain" detail="Keep your weight steady" emoji="⚖️" selected={p.goal === "maintain"} onPress={() => change("goal", "maintain")} />
          <OptionCard label="Build muscle" detail="A small calorie surplus" emoji="💪" selected={p.goal === "gain"} onPress={() => change("goal", "gain")} />
        </>);
    case "target":
      return shell("What is your target weight?", `You are ${formatWeight(p.weight, units)} today. Timelines are estimates.`,
        <WheelPicker label="Target weight" options={weightOptions(units)} value={kgToWeightValue(p.targetWeight, units)}
          onChange={(v) => change("targetWeight", weightToKg(v, units))} />);
    case "activity":
      return shell("What is your lifestyle?", "Your usual day, outside planned workouts.",
        <>
          <OptionCard label="Sedentary" detail="Mostly sitting" emoji="🧑‍💻" selected={p.activity === 1.2} onPress={() => change("activity", 1.2)} />
          <OptionCard label="Lightly active" detail="Some walking" emoji="🚶" selected={p.activity === 1.375} onPress={() => change("activity", 1.375)} />
          <OptionCard label="Active" detail="On your feet most of the day" emoji="🏃" selected={p.activity === 1.55} onPress={() => change("activity", 1.55)} />
          <OptionCard label="Very active" detail="Physical job or daily training" emoji="🚴" selected={p.activity === 1.725} onPress={() => change("activity", 1.725)} />
        </>);
    case "training":
      return shell("How do you like to train?", undefined,
        <>
          <Text style={s.group}>Experience</Text>
          <OptionCard label="Beginner" emoji="🌱" selected={p.experience === "beginner"} onPress={() => change("experience", "beginner")} />
          <OptionCard label="Experienced" emoji="🏋️" selected={p.experience === "experienced"} onPress={() => change("experience", "experienced")} />
          <Text style={s.group}>Where</Text>
          <OptionCard label="Gym" emoji="🏟️" selected={p.place === "gym"} onPress={() => change("place", "gym")} />
          <OptionCard label="Home" emoji="🏠" selected={p.place === "home"} onPress={() => change("place", "home")} />
          <OptionCard label="Walking" emoji="👟" selected={p.place === "walk"} onPress={() => change("place", "walk")} />
        </>);
    case "week": {
      const chosen = p.workoutDays || [];
      return shell("Plan your workout week", "You choose the days. Consecutive days are fine — adjust recovery to how you feel.",
        <>
          <Text style={s.group}>Days per week</Text>
          <View style={s.dayCount}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Pressable key={n} onPress={() => setP((prev) => ({ ...prev, days: n, workoutDays: undefined }))}
                accessibilityRole="radio" accessibilityLabel={`${n} days per week`} aria-checked={p.days === n}
                style={p.days === n ? s.countOn : s.count}>
                <Text style={p.days === n ? s.countTextOn : s.countText}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.group}>Choose {p.days} day{p.days > 1 ? "s" : ""} · {chosen.length} selected</Text>
          {weekdays.map((d) => (
            <OptionCard key={d.value} multi label={d.label} selected={chosen.includes(d.value)}
              onPress={() => change("workoutDays", chosen.includes(d.value) ? chosen.filter((x) => x !== d.value) : [...chosen, d.value])} />
          ))}
        </>);
    }
    case "health":
      return shell("Any health conditions?", "Select all that apply. Health conditions pause automatic calorie targets so your care team can guide them.",
        <>
          {conditions.map((c) => (
            <OptionCard key={c.value} multi label={c.label} selected={p.conditions.includes(c.value)}
              onPress={() => change("conditions", p.conditions.includes(c.value) ? p.conditions.filter((x) => x !== c.value) : [...p.conditions, c.value])} />
          ))}
          <OptionCard multi label="I use insulin" selected={p.insulin} onPress={() => change("insulin", !p.insulin)} />
          <OptionCard label="None of these" emoji="✅" selected={!p.conditions.length && !p.insulin}
            onPress={() => setP((prev) => ({ ...prev, conditions: [], insulin: false }))} />
        </>);
    case "glp1":
      return shell("Are you taking a GLP-1 medication?", "For example Ozempic, Wegovy, Mounjaro or Zepbound. We only record what your prescriber chose — we never advise on doses.",
        <>
          <OptionCard label="No" selected={glpAnswer === "no"} onPress={() => { setGlpAnswer("no"); change("glp1", undefined); }} />
          <OptionCard label="Yes" selected={glpAnswer === "yes"} onPress={() => setGlpAnswer("yes")} />
          {glpAnswer === "yes" ? (
            <>
              <Text style={s.group}>Which one is on your prescription?</Text>
              {glp1Choices.map((g) => (
                <OptionCard key={g} label={g} selected={p.glp1 === g} onPress={() => change("glp1", g)} />
              ))}
              <Text style={s.caution}>
                Do not start, stop, skip or change a dose because of this app. Follow your Medication Guide and ask your prescriber or pharmacist.
              </Text>
            </>
          ) : null}
          <Text style={s.group}>Other prescribed medicines (optional)</Text>
          <TextInput value={otherMeds} onChangeText={setOtherMeds} placeholder="Names and usual timing" placeholderTextColor={theme.muted}
            accessibilityLabel="Other prescribed medicines" multiline style={s.textArea} />
        </>);
    case "injuries":
      return shell("Any injuries or movement limits?", "Optional. We show safety guides for these in Gym Truth and do not assign exercise intensity — your doctor or physical therapist does.",
        <>
          {limitChoices.map((l) => {
            const on = (p.limits || []).includes(l.value);
            return (
              <OptionCard key={l.value} multi emoji={l.emoji} label={l.label} selected={on}
                onPress={() => change("limits", on ? (p.limits || []).filter((x) => x !== l.value) : [...(p.limits || []), l.value])} />
            );
          })}
          <Text style={s.group}>Anything else (optional)</Text>
          <TextInput value={p.injuries} onChangeText={(v) => change("injuries", v)} placeholder="For example: hip surgery last year"
            placeholderTextColor={theme.muted} accessibilityLabel="Injuries or movement limitations" multiline style={s.textArea} />
        </>,
        p.injuries.trim() || p.limits?.length ? "Continue" : "Skip — none");
    case "diet":
      return shell("How do you eat?", undefined,
        <>
          {dietChoices.map((d) => (
            <OptionCard key={d.value} label={d.label} selected={(p.dietType || dietaryType(p)) === d.value} onPress={() => change("dietType", d.value)} />
          ))}
          <Text style={s.group}>Food allergies (select all)</Text>
          <View style={s.chips}>
            {allergenChoices.map((a) => {
              const on = (p.allergyFoods || []).includes(a.value);
              return (
                <Pressable key={a.value} onPress={() => change("allergyFoods", on ? (p.allergyFoods || []).filter((x) => x !== a.value) : [...(p.allergyFoods || []), a.value])}
                  accessibilityRole="checkbox" accessibilityLabel={a.label} aria-checked={on} style={on ? s.chipOn : s.chip}>
                  <Text style={on ? s.chipTextOn : s.chipText}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.caution}>Always read package labels for allergens.</Text>
        </>);
    case "cuisine":
      return shell("What food do you enjoy?", "We use this for meal ideas. American is the default.",
        <>
          <CuisinePreferences value={p.cuisine} onChange={(v) => change("cuisine", v)} />
          <TextInput value={p.familiarFoods || ""} onChangeText={(v) => change("familiarFoods", v)} placeholder="Foods you usually buy and cook (optional)"
            placeholderTextColor={theme.muted} accessibilityLabel="Familiar foods" multiline style={s.textArea} />
        </>);
    case "consent":
      return shell("You stay in control", undefined,
        <>
          <View style={s.infoCard}>
            <Text style={s.infoText}>Your profile and logs are stored on this device. Nutrition and exercise estimates are educational. Snap to Fit does not diagnose, prescribe or tell you to change medicines.</Text>
            <Text style={[s.infoText, { marginTop: 8, fontWeight: "700" }]}>{doctorNotice}</Text>
            <Text style={[s.infoText, { marginTop: 8 }]}>{steroidNotice}</Text>
          </View>
          <OptionCard multi label="I am 18 or older and understand how my health information is used." selected={p.consent} onPress={() => change("consent", !p.consent)} />
          <OptionCard multi label="Optional: allow selected profile details and photos to be sent to the AI service when I ask for chat or food analysis." selected={p.aiConsent} onPress={() => change("aiConsent", !p.aiConsent)} />
          <Text style={s.caution}>You can change consent or delete your information in Settings.</Text>
        </>, "See my plan");
  }
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.welcome}>
      <Logo size={88} />
      <Text style={s.brand}>snap<Text style={{ color: theme.brand }}> to fit</Text></Text>
      <Text style={s.tagline}>Snap your meals. Move your way. See your progress.</Text>
      <Image source={menuArt} style={s.hero} resizeMode="contain" accessibilityIgnoresInvertColors />
      <View style={{ width: "100%", maxWidth: 480 }}>
        <Pressable onPress={onStart} accessibilityRole="button" style={s.cta}><Text style={s.ctaText}>Get started</Text></Pressable>
        <Pressable onPress={() => router.push("/account")} accessibilityRole="button" style={s.link}><Text style={s.linkText}>I already have an account</Text></Pressable>
        <Pressable onPress={() => router.push("/legal")} accessibilityRole="button" style={s.link}><Text style={s.linkMuted}>Privacy and app terms</Text></Pressable>
        <Text style={s.notice}>{doctorNotice}</Text>
      </View>
    </ScrollView>
  );
}

function Reveal({ profile, busy, onBack, onStart }: { profile: Profile; busy: boolean; onBack: () => void; onStart: () => void }) {
  const t = nutritionTargets(profile);
  const kcal = useCountUp(t.restricted ? 0 : t.calories);
  return (
    <ScrollView contentContainerStyle={s.reveal}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to your answers" style={s.revealBack}>
        <Text style={s.linkMuted}>‹ Edit answers</Text>
      </Pressable>
      <Text style={s.revealTitle} accessibilityRole="header">Your plan is ready, {profile.name.trim()}.</Text>
      {t.restricted ? (
        <View style={[s.infoCard, { marginTop: 20 }]}>
          <Text style={s.infoTitle}>Calorie targets are paused</Text>
          <Text style={s.infoText}>
            Because you shared health conditions or medicines, Snap to Fit will not set automatic calorie or macro targets. Logging, workouts, progress and education stay on. Ask your doctor or dietitian for targets that fit your care plan.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ alignItems: "center", marginTop: 26 }}>
            <ProgressRing size={210} stroke={16} progress={1} color={theme.brand}>
              <Text style={s.kcal}>{kcal.toLocaleString()}</Text>
              <Text style={s.kcalLabel}>calories / day</Text>
            </ProgressRing>
          </View>
          <View style={s.macros}>
            <Macro label="Protein" grams={t.protein} color={theme.protein} share={(t.protein * 4) / t.calories} />
            <Macro label="Carbs" grams={t.carbs} color={theme.carbs} share={(t.carbs * 4) / t.calories} />
            <Macro label="Fat" grams={t.fat} color={theme.fat} share={(t.fat * 9) / t.calories} />
          </View>
          <Text style={s.revealNote}>
            Estimate from the Mifflin–St Jeor equation and your activity level ({t.maintenance.toLocaleString()} kcal to maintain). It is not a measured metabolism.
          </Text>
        </>
      )}
      <View style={[s.infoCard, { marginTop: 18 }]}>
        <Text style={[s.infoText, { fontWeight: "700" }]}>{doctorNotice}</Text>
      </View>
      <Pressable onPress={onStart} disabled={busy} accessibilityRole="button" style={[s.cta, { marginTop: 22 }, busy && { opacity: 0.5 }]}>
        <Text style={s.ctaText}>{busy ? "Saving…" : "Start my journey"}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Macro({ label, grams, color, share }: { label: string; grams: number; color: string; share: number }) {
  return (
    <View style={s.macro}>
      <ProgressRing size={74} stroke={8} progress={share} color={color}>
        <Text style={s.macroG}>{grams}g</Text>
      </ProgressRing>
      <Text style={s.macroLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bigInput: { fontSize: 26, fontWeight: "700", color: theme.ink, textAlign: "center", borderBottomWidth: 2, borderColor: theme.brand, paddingVertical: 12, marginHorizontal: 10 },
  textArea: { minHeight: 90, fontSize: 16, color: theme.ink, backgroundColor: theme.surface, borderRadius: 16, padding: 14, textAlignVertical: "top", marginTop: 4 },
  group: { fontSize: 13, fontWeight: "800", color: theme.muted, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 10, marginBottom: 10 },
  caution: { fontSize: 13, lineHeight: 19, color: theme.muted, marginTop: 6, marginBottom: 10 },
  dayCount: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  count: { width: 42, height: 46, borderRadius: 14, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  countOn: { width: 42, height: 46, borderRadius: 14, backgroundColor: theme.brand, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: 17, fontWeight: "700", color: theme.ink },
  countTextOn: { fontSize: 17, fontWeight: "800", color: "white" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.surface },
  chipOn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.brand },
  chipText: { fontSize: 14, fontWeight: "600", color: theme.ink },
  chipTextOn: { fontSize: 14, fontWeight: "700", color: "white" },
  infoCard: { backgroundColor: "#FFF6E7", borderRadius: 16, padding: 14, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: "#D89D36" },
  infoTitle: { fontSize: 16, fontWeight: "800", color: theme.ink, marginBottom: 6 },
  infoText: { fontSize: 13, lineHeight: 19, color: theme.ink },
  welcome: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "white" },
  brand: { fontSize: 38, fontWeight: "800", letterSpacing: -1.2, color: theme.ink, marginTop: 14 },
  tagline: { fontSize: 16, lineHeight: 23, color: theme.muted, textAlign: "center", marginTop: 8, maxWidth: 320 },
  hero: { width: "100%", maxWidth: 360, height: 250, marginVertical: 18 },
  cta: { backgroundColor: theme.brand, minHeight: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "white", fontSize: 17, fontWeight: "800" },
  link: { minHeight: 46, alignItems: "center", justifyContent: "center" },
  linkText: { fontSize: 16, fontWeight: "700", color: theme.brand },
  linkMuted: { fontSize: 14, fontWeight: "600", color: theme.muted },
  notice: { fontSize: 11, lineHeight: 15, color: theme.muted, textAlign: "center", marginTop: 6 },
  reveal: { flexGrow: 1, padding: 24, backgroundColor: "white", maxWidth: 560, width: "100%", alignSelf: "center" },
  revealBack: { minHeight: 40, justifyContent: "center" },
  revealTitle: { fontSize: 30, lineHeight: 36, fontWeight: "800", color: theme.ink, letterSpacing: -0.6, marginTop: 6 },
  kcal: { fontSize: 46, fontWeight: "800", color: theme.ink, letterSpacing: -1 },
  kcalLabel: { fontSize: 14, color: theme.muted, fontWeight: "600" },
  macros: { flexDirection: "row", justifyContent: "space-around", marginTop: 26 },
  macro: { alignItems: "center", gap: 8 },
  macroG: { fontSize: 16, fontWeight: "800", color: theme.ink },
  macroLabel: { fontSize: 14, fontWeight: "700", color: theme.muted },
  revealNote: { fontSize: 12, lineHeight: 18, color: theme.muted, textAlign: "center", marginTop: 18 },
});
