import React, { useEffect, useState } from "react";
import { router } from "expo-router";
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
import { countries } from "../core/meal-catalog";
import { uid } from "../core/model";
import type { CarePlan, MacroBudget, MealSlot } from "../core/planning-types";
export default function MealPlanner() {
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
      subtitle="Your seven-day plan · local ingredients and your eating pattern"
    >
      <Card tint>
        <H>
          {plan.mode === "fitness"
            ? "Your weekly fitness meal ideas"
            : plan.mode === "care-plan"
              ? "Your weekly care-plan organizer"
              : "Complete your local meal setup"}
        </H>
        <P>
          {countries.find((c) => c.value === plan.country)?.label ||
            "Choose a country"}{" "}
          · {plan.diet} · week of {plan.week}
        </P>
        <P>
          Use the protein sources shown as starting ideas. Calorie and macro
          budgets describe goals to plan toward; they are not nutrition values
          for an unmeasured recipe.
        </P>
        {p.familiarFoods ? <P>Your familiar foods: {p.familiarFoods}</P> : null}
        <Chips
          values={countries}
          selected={p.country || ""}
          onChange={(country) =>
            act(() =>
              update((s) => ({
                ...s,
                profile: s.profile ? { ...s.profile, country } : null,
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
          {day.weekday} · {day.date}
        </H>
        {day.meals.map((m) => (
          <Card key={m.slot}>
            <H>{m.slot[0].toUpperCase() + m.slot.slice(1)}</H>
            <P>
              {plan.mode === "fitness"
                ? m.name
                : state.carePlan?.meals[m.slot] || m.name}
            </P>
            {m.proteinSources.length ? (
              <P>Protein sources: {m.proteinSources.join(", ")}</P>
            ) : null}
            {m.budget ? (
              <P>
                Planning budget: {m.budget.calories} kcal · {m.budget.protein} g
                protein · {m.budget.carbs} g carbs · {m.budget.fat} g fat ·{" "}
                {m.budget.fibre} g fibre
              </P>
            ) : null}
            <P>{m.note}</P>
            <Button
              secondary
              title="Log the portions I actually ate"
              onPress={() => router.push("/food")}
            />
          </Card>
        ))}
      </Card>
      {plan.mode !== "fitness" ? (
        <Card>
          <H>
            {plan.mode === "care-plan"
              ? "Enter my existing care plan"
              : "Add my familiar meals"}
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
              label={`${slot} from my own plan`}
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
                    label={`My existing ${key} target (${key === "calories" ? "kcal" : "g"})`}
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
        <P>{flexible.reason}</P>
        <Button
          disabled={!flexible.available}
          title={
            flexible.eligible
              ? flexible.used
                ? "Selected for this week"
                : "Choose this week’s flexible meal"
              : "Unavailable for medical profiles"
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
