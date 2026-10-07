import { buildMealPlan,dietaryType } from "../core/meal-planning";
import { dietChoices, allergenChoices } from "../core/meal-catalog";
import { CuisinePreferences } from "../components/CuisinePreferences";
import { WorkoutPreferences } from "../components/WorkoutPreferences";
import {cancelNotifications} from '../services/routine-notifications';
import React, { useState } from "react";
import { router } from "expo-router";
import {
  Screen,
  Card,
  H,
  P,
  Button,
  Field,
  Chips,
  Check,
  Progress,
  act,
} from "../components/ui";
import { useStore } from "../services/store";
import {
  newProfile,
  type Profile,
  type Condition,
  validateProfile,
  numeric,
  uid,
} from "../core/model";
export default function Onboarding() {
  const { state, update } = useStore();
  const [p, setP] = useState<Profile>(state.profile || newProfile);
  const [numbers, setNumbers] = useState({
    age: p.age ? String(p.age) : "",
    height: p.height ? String(p.height) : "",
    weight: p.weight ? String(p.weight) : "",
    targetWeight: p.targetWeight ? String(p.targetWeight) : "",
  });
  const setNumber = (key: keyof typeof numbers, value: string) =>
    setNumbers((prev) => ({ ...prev, [key]: value }));
  const advance = () =>
    act(async () => {
      if (step === 0) {
        if (!p.name.trim()) throw new Error("Enter your name.");
        const age = numeric(numbers.age, 18, 100, "Age");
        if (!Number.isInteger(age))
          throw new Error("Age must be a whole number.");
        const height = numeric(numbers.height, 100, 230, "Height");
        const weight = numeric(numbers.weight, 30, 350, "Weight");
        setP((prev) => ({ ...prev, age, height, weight }));
      }
      if (step === 2) {
        if (!p.workoutDays || p.workoutDays.length !== p.days)
          throw new Error("Choose your workout days for the week.");
        const targetWeight = numeric(
          numbers.targetWeight,
          30,
          350,
          "Target weight",
        );
        validateProfile({ ...p, targetWeight, consent: true });
        change("targetWeight", targetWeight);
      }
      setStep(step + 1);
    });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const change = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));
  const conditions: { value: Condition; label: string }[] = [
    { value: "type1", label: "Type 1 diabetes" },
    { value: "type2", label: "Type 2 diabetes" },
    { value: "hypertension", label: "High blood pressure" },
    { value: "heart", label: "Heart condition / bypass / angioplasty" },
    { value: "kidney", label: "Kidney condition" },
    { value: "pregnant", label: "Pregnant / breastfeeding" },
    { value: "eating-disorder", label: "Eating-disorder history" },
  ];
  return (
    <Screen
      title={
        [
          "A little about you.",
          "Your health matters.",
          "Build your routine.",
          "Ready for your journey?",
        ][step]
      }
      subtitle={`Step ${step + 1} of 4 · Take about 5 minutes. Accurate answers help us personalize responsibly.`}
    >
      <Progress value={step + 1} total={4} />
      {step === 0 ? (
        <Card>
          <H>Your starting point</H>
          <Field
            label="First name"
            value={p.name}
            onChange={(v) => change("name", v)}
          />
          <Field
            label="Age (18+)"
            numeric
            value={numbers.age}
            onChange={(v) => setNumber("age", v)}
          />
          <P>
            Sex used for the metabolic estimation formula. It does not represent
            your gender identity.
          </P>
          <Chips
            values={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ]}
            selected={p.sex}
            onChange={(v) => change("sex", v)}
          />
          <Field
            label="Height (cm)"
            numeric
            value={numbers.height}
            onChange={(v) => setNumber("height", v)}
          />
          <Field
            label="Weight (kg)"
            numeric
            value={numbers.weight}
            onChange={(v) => setNumber("weight", v)}
          />
        </Card>
      ) : null}
      {step === 1 ? (
        <Card>
          <H>Medical context</H>
          <P>
            Select every condition that applies. Conditions can overlap. Medical
            profiles can track progress, but automatic clinical targets and
            exercise intensity are paused.
          </P>
          {conditions.map((c) => (
            <Check
              key={c.value}
              label={c.label}
              value={p.conditions.includes(c.value)}
              onChange={(v) =>
                change(
                  "conditions",
                  v
                    ? [...p.conditions, c.value]
                    : p.conditions.filter((x) => x !== c.value),
                )
              }
            />
          ))}
          <Check
            label="I use insulin"
            value={p.insulin}
            onChange={(v) => change("insulin", v)}
          />
          <Field
            label="Medicines and usual timing (or leave blank)"
            value={p.medicines}
            onChange={(v) => change("medicines", v)}
            placeholder="Names, prescribed schedule"
          />
          <Field
            label="Injuries or movement limitations"
            value={p.injuries}
            onChange={(v) => change("injuries", v)}
          />
          <P>
            Record current BP and glucose in Health after setup. Medication
            timing alone cannot establish a safe exercise window.
          </P>
        </Card>
      ) : null}
      {step === 2 ? (
        <Card>
          <H>Goals and preferences</H>
          <Chips
            values={[
              { value: "lose", label: "Lose fat" },
              { value: "maintain", label: "Maintain" },
              { value: "gain", label: "Build muscle" },
            ]}
            selected={p.goal}
            onChange={(v) => change("goal", v)}
          />
          <Field
            label="Target weight (kg)"
            numeric
            value={numbers.targetWeight}
            onChange={(v) => setNumber("targetWeight", v)}
          />
          <P>Your usual activity level</P>
          <Chips
            values={[
              { value: 1.2, label: "Mostly seated" },
              { value: 1.375, label: "Lightly active" },
              { value: 1.55, label: "Moderately active" },
              { value: 1.725, label: "Very active" },
            ]}
            selected={p.activity}
            onChange={(v) => change("activity", v)}
          />
          <Chips
            values={[
              { value: "beginner", label: "Beginner" },
              { value: "experienced", label: "Experienced" },
            ]}
            selected={p.experience}
            onChange={(v) => change("experience", v)}
          />
          <Chips
            values={[
              { value: "gym", label: "Gym" },
              { value: "home", label: "Home" },
              { value: "walk", label: "Walking" },
            ]}
            selected={p.place}
            onChange={(v) => change("place", v)}
          />
          <WorkoutPreferences profile={p} onChange={setP}/>
          <CuisinePreferences value={p.cuisine} onChange={v => change("cuisine", v)}/>
          <H>Diet and protein sources</H>
          <P>
            Choose your eating pattern. Vegan excludes meat, fish,
            eggs and dairy; vegetarian excludes meat and fish.
          </P>
          <Chips
            values={dietChoices}
            selected={p.dietType || dietaryType(p)}
            onChange={(v) => change("dietType", v)}
          />
          <Field
            label="Familiar foods available to me"
            value={p.familiarFoods || ""}
            onChange={(v) => change("familiarFoods", v)}
            placeholder="Foods you normally buy and cook"
          />
          <P>Known food allergies (select every applicable ingredient)</P>
          {allergenChoices.map((a) => (
            <Check
              key={a.value}
              label={a.label}
              value={(p.allergyFoods || []).includes(a.value)}
              onChange={(checked) =>
                change(
                  "allergyFoods",
                  checked
                    ? [...(p.allergyFoods || []), a.value]
                    : (p.allergyFoods || []).filter((x) => x !== a.value),
                )
              }
            />
          ))}
          <Field
            label="Diet preferences"
            value={p.diet}
            onChange={(v) => change("diet", v)}
          />
          <Field
            label="Food allergies"
            value={p.allergies}
            onChange={(v) => change("allergies", v)}
          />
        </Card>
      ) : null}
      {step === 3 ? (
        <Card>
          <H>You stay in control</H>
          <P>
            Your profile and logs are stored on this device in the native app.
            Web preview information disappears when refreshed. Photos are
            optional.
          </P>
          <P>
            Nutrition and exercise estimates are educational. We do not diagnose
            disease, measure visceral fat from photos, or tell you to change
            medicines. Weight timelines are estimates.
          </P>
          <Check
            label="I am 18 or older and understand how my health information is used."
            value={p.consent}
            onChange={(v) => change("consent", v)}
          />
          <Check
            label="Allow selected profile details and photos to be sent to the configured AI service when I request chat or food analysis."
            value={p.aiConsent}
            onChange={(v) => change("aiConsent", v)}
          />
          <P>
            AI consent is optional. Logging and workouts do not require it. You
            can withdraw consent or delete your information in Settings.
          </P>
        </Card>
      ) : null}
      {step < 3 ? (
        <Button title="Continue" onPress={advance} />
      ) : (
        <Button
          disabled={busy}
          title={busy ? "Saving…" : "Start my journey"}
          onPress={() =>
            act(async () => {
              validateProfile(p);
              setBusy(true);
              try {
                if(p.age>50)await cancelNotifications(state.education?.reminderIds||[]);
                await update((s) => ({
                  ...s,
                  profile: p,
                  education:p.age>50&&s.education?{...s.education,enabled:false,reminderIds:[]}:s.education,
                  mealPlan: buildMealPlan(p),
                  readings:
                    s.profile && s.profile.weight === p.weight
                      ? s.readings
                      : [
                          ...s.readings,
                          {
                            id: uid(),
                            at: new Date().toISOString(),
                            kind: "weight",
                            value: p.weight,
                            unit: "kg",
                            context: "Starting weight",
                            source: "manual",
                          },
                        ],
                }));
                router.replace("/");
              } finally {
                setBusy(false);
              }
            })
          }
        />
      )}
      {step > 0 ? (
        <Button secondary title="Back" onPress={() => setStep(step - 1)} />
      ) : null}
      {step === 0 ? (
        <Button
          secondary
          title="Already have an account? Sign in"
          onPress={() => router.push("/account")}
        />
      ) : null}
      <Button
        secondary
        title="Privacy and app terms"
        onPress={() => router.push("/legal")}
      />
    </Screen>
  );
}
