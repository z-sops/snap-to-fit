import { useT } from "../i18n";
import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import {
  Screen,
  Card,
  H,
  P,
  Button,
  Chips,
  Field,
  Check,
  act,
  notify,
} from "../components/ui";
import { useStore } from "../services/store";
import { effectiveProfile } from "../core/progress";
import {
  buildMealPlan,
  planSignature,
  mealSlots,
  conditionNotes,
  flexibleMealStatus,
  validateCarePlan,
  weekStart,
} from "../core/meal-planning";
import { CuisinePreferences, cuisineLabel } from "../components/CuisinePreferences";
import { localDay, uid } from "../core/model";
import { nutritionTargets } from "../core/nutrition";
import type { CarePlan, MacroBudget, MealSlot } from "../core/planning-types";
export default function MealPlanner() {
  const tr = useT();
  const { state, update } = useStore();
  const p = effectiveProfile(state)!;
  const signature = planSignature(p);
  const plan =
    state.mealPlan?.signature === signature ? state.mealPlan : buildMealPlan(p);
  const [selected, setSelected] = useState(0);
  const [meals, setMeals] = useState<Partial<Record<MealSlot, string>>>(
    state.carePlan?.meals || {},
  );
  const [targets, setTargets] = useState<Record<keyof MacroBudget, string>>({
    calories: String(state.carePlan?.targets.calories ?? ""),
    protein: String(state.carePlan?.targets.protein ?? ""),
    carbs: String(state.carePlan?.targets.carbs ?? ""),
    fat: String(state.carePlan?.targets.fat ?? ""),
    fibre: String(state.carePlan?.targets.fibre ?? ""),
  });
  const [ack, setAck] = useState(state.carePlan?.acknowledged || false);
  const flexible = flexibleMealStatus(state, p);
  const targets0 = (() => { const t = nutritionTargets(p); return t.restricted ? null : t; })();
  const day = plan.days[selected];
  useEffect(() => {
    if (state.mealPlan?.signature !== signature)
      void update((s) => ({ ...s, mealPlan: buildMealPlan(p) })).catch(
        () => {},
      );
  }, [signature, state.mealPlan?.signature, update, p]);
  return (
    <Screen
      title="Food that feels familiar."
      subtitle="Your seven-day plan · cuisine preferences and your eating pattern"
    >
      <Card tint>
        <H>
          {plan.mode === "fitness"
            ? tr("Your weekly fitness meal ideas")
            : plan.mode === "care-plan"
              ? tr("Your weekly care-plan organizer")
              : tr("Complete your local meal setup")}
        </H>
        <P>{tr("{cuisine} · {diet} · week of {week}", { cuisine: tr(cuisineLabel(p.cuisine)), diet: tr(plan.diet), week: plan.week })}</P>
        {plan.mode === "fitness" && targets0 ? (
          <P>
            {tr("Built from your age, height, weight and activity: about {maint} kcal burned a day (TDEE), so {cal} kcal a day to {goal}. Workout days get a little more food, rest days a little less; the week averages out.", {
              maint: targets0.maintenance.toLocaleString(), cal: targets0.calories.toLocaleString(),
              goal: tr(p.goal === "lose" ? "lose weight" : p.goal === "gain" ? "build muscle" : "maintain"),
            })}
          </P>
        ) : (
          <P>
            {tr("Use the protein sources shown as starting ideas. Calorie and macro budgets describe goals to plan toward; they are not nutrition values for an unmeasured recipe.")}
          </P>
        )}
        {p.familiarFoods ? <P>Your familiar foods: {p.familiarFoods}</P> : null}
        <CuisinePreferences
          value={p.cuisine}
          onChange={(cuisine) =>
            act(() =>
              update((s) => ({
                ...s,
                profile: s.profile ? { ...s.profile, cuisine } : null,
              })),
            )
          }
        />
        <Button
          secondary
          title="Edit dietary preferences and allergies"
          onPress={() => router.push("/onboarding")}
        />
      </Card>
      <Card>
        <Chips
          values={plan.days.map((d, i) => ({
            value: i,
            label: d.weekday.slice(0, 3),
          }))}
          selected={selected}
          onChange={setSelected}
        />
        <H>
          {tr(day.weekday)} · {day.date}
        </H>
        {plan.mode === "fitness" && day.target ? (
          <P>
            {tr(day.training ? "Training day · {kcal} kcal · more carbs for your workout" : "Rest day · {kcal} kcal", { kcal: day.target.calories.toLocaleString() })}
          </P>
        ) : null}
        <View style={{ gap: 12 }}>
        {day.meals.map((m) => (
          <Card key={m.slot}>
            <H>{tr(m.slot[0].toUpperCase() + m.slot.slice(1))}</H>
            <P>
              {plan.mode === "fitness"
                ? tr(m.name)
                : state.carePlan?.meals[m.slot] || tr(m.name)}
            </P>
            {m.nutrition ? (
              <P>
                {tr("{servings} × {label} · {kcal} kcal · {protein} g protein · {carbs} g carbs · {fat} g fat", {
                  servings: m.servings || 1, label: tr(m.servingLabel || ""), kcal: m.nutrition.calories,
                  protein: m.nutrition.protein, carbs: m.nutrition.carbs, fat: m.nutrition.fat,
                })}
              </P>
            ) : m.budget ? (
              <P>
                {tr("Planning budget: {kcal} kcal · {protein} g protein · {carbs} g carbs · {fat} g fat", {
                  kcal: m.budget.calories, protein: m.budget.protein, carbs: m.budget.carbs, fat: m.budget.fat,
                })}
              </P>
            ) : null}
            <P>{tr(m.note)}</P>
            <Button
              secondary
              title={day.date === localDay() && m.dishId ? "Log it" : "Log the portions I actually ate"}
              onPress={() => router.push("/food")}
            />
          </Card>
        ))}
        </View>
      </Card>
      {plan.mode !== "fitness" ? (
        <Card>
          <H>
            {plan.mode === "care-plan"
              ? tr("Enter my existing care plan")
              : tr("Add my familiar meals")}
          </H>
          <P>
            These meal names repeat across the week as your editable starting
            template. The app does not prescribe portions for a medical
            condition. Choose food already appropriate for your personal
            restrictions.
          </P>
          {mealSlots.map((slot) => (
            <Field
              key={slot}
              label={tr("{slot} from my own plan", { slot })}
              value={meals[slot] || ""}
              onChange={(v) => setMeals((x) => ({ ...x, [slot]: v }))}
            />
          ))}
          {plan.mode === "care-plan" ? (
            <>
              <P>
                Optional daily targets copied from your existing plan. Leave
                unknown values empty. These targets are user-entered references
                and are not generated by the app.
              </P>
              {(["calories", "protein", "carbs", "fat", "fibre"] as const).map(
                (key) => (
                  <Field
                    key={key}
                    label={tr("My existing {key} target ({v1})", { key, v1: key === "calories" ? "kcal" : "g" })}
                    numeric
                    value={targets[key]}
                    onChange={(v) => setTargets((x) => ({ ...x, [key]: v }))}
                  />
                ),
              )}
              <Check
                label="I copied these targets from my existing individual care plan."
                value={ack}
                onChange={setAck}
              />
            </>
          ) : null}
          <Button
            title="Save my meal template"
            onPress={() =>
              act(async () => {
                const entered: Partial<MacroBudget> = {};
                if (plan.mode === "care-plan")
                  for (const key of [
                    "calories",
                    "protein",
                    "carbs",
                    "fat",
                    "fibre",
                  ] as const)
                    if (targets[key].trim())
                      entered[key] = Number(targets[key]);
                if (Object.keys(entered).length && !ack)
                  throw new Error(
                    "Confirm that the targets come from your existing care plan.",
                  );
                const care: CarePlan = {
                  meals,
                  targets: entered,
                  acknowledged: ack,
                };
                validateCarePlan(care);
                await update((s) => ({ ...s, carePlan: care }));
                notify("Your meal template is saved.");
              })
            }
          />
        </Card>
      ) : null}
      <Card>
        <H>Flexible meal</H>
        <P>{tr(flexible.reason)}</P>
        <Button
          disabled={!flexible.available}
          title={
            flexible.eligible
              ? flexible.used
                ? tr("Selected for this week")
                : tr("Choose this week’s flexible meal")
              : tr("Unavailable for medical profiles")
          }
          onPress={() =>
            act(async () => {
              await update((s) => {
                if (!flexibleMealStatus(s, effectiveProfile(s)!).available)
                  throw new Error(
                    "A flexible meal is not currently available.",
                  );
                return {
                  ...s,
                  flexibleMeals: [
                    ...(s.flexibleMeals || []).filter(
                      (x) => x.week !== weekStart(),
                    ),
                    {
                      id: uid(),
                      week: weekStart(),
                      at: new Date().toISOString(),
                    },
                  ],
                };
              });
              notify(
                "Flexible meal selected. Log its actual portions as usual.",
              );
            })
          }
        />
      </Card>
      <Card>
        <H>Planning notes</H>
        {plan.notes.map((n) => (
          <P key={n}>{n}</P>
        ))}
        {conditionNotes(p).map((n) => (
          <P key={n}>{n}</P>
        ))}
      </Card>
    </Screen>
  );
}
