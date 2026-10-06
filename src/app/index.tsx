import { effectiveProfile } from "../core/progress";
import { educationCard } from "../core/routine";
import { buildMealPlan } from "../core/meal-planning";
import React from "react";
import { router } from "expo-router";
import {
  Screen,
  Card,
  H,
  P,
  Row,
  Metric,
  Progress,
  Button,
} from "../components/ui";
import { useStore } from "../services/store";
import { nutritionTargets, todayTotals } from "../core/nutrition";
import { localDay } from "../core/model";
export default function Today() {
  const { state } = useStore();
  const p = effectiveProfile(state);
  if (!p) return null;
  const targets = nutritionTargets(p);
  const totals = todayTotals(state.meals);
  const sessions = state.workouts.filter(
    (w) => localDay(w.at) === localDay(),
  ).length;
  return (
    <Screen
      title={`Let's move, ${p.name}.`}
      subtitle="Small steps. A stronger tomorrow."
    >
      <Card tint>
        <P>YOUR DAILY FOCUS</P>
        <H>
          {p.goal === "lose"
            ? "Build habits that last."
            : p.goal === "gain"
              ? "Fuel your strength."
              : "Find your balance."}
        </H>
        <P>Log a meal, make time to move, and check in with yourself.</P>
        <Button
          title="Open today’s workout"
          onPress={() => router.push("/move")}
        />
      </Card>
      <Card>
        <H>Nutrition today</H>
        <Row>
          <Metric
            label="Logged"
            value={Math.round(totals.calories)}
            unit="kcal"
          />
          <Metric
            label={targets.restricted ? "Target paused" : "Estimated target"}
            value={targets.restricted ? "—" : targets.calories}
            unit={targets.restricted ? "" : "kcal"}
          />
        </Row>
        {!targets.restricted ? (
          <Progress value={totals.calories} total={targets.calories} />
        ) : (
          <P>
            Automatic targets are paused for your health context. Track meals
            and use your existing care plan.
          </P>
        )}
        <Row>
          <Metric label="Protein" value={Math.round(totals.protein)} unit="g" />
          <Metric label="Carbs" value={Math.round(totals.carbs)} unit="g" />
          <Metric label="Fat" value={Math.round(totals.fat)} unit="g" />
        </Row>
        <Button
          secondary
          title="Snap or log a meal"
          onPress={() => router.push("/food")}
        />
      </Card>
      <Card>
        <H>Your local weekly meal plan</H>
        <P>
          {buildMealPlan(p).mode === "fitness"
            ? "Local meal ideas and your calorie/protein planning budgets."
            : "Your seven-day meal organizer is ready. Complete it using your personal food and care-plan preferences."}
        </P>
        <Button
          title="Open my weekly meal plan"
          onPress={() => router.push("/meal-plan")}
        />
        <Button
          secondary
          title="Set regular and weekend meal reminders"
          onPress={() => router.push("/metabolic")}
        />
      </Card>
      {p.age >= 18 && p.age <= 50 ? (
        <Card>
          <H>{educationCard().title}</H>
          <P>{educationCard().text}</P>
          <Button
            secondary
            title="Steroid-risk education and reminders"
            onPress={() => router.push("/education")}
          />
        </Card>
      ) : null}
      <Card>
        <H>Check in</H>
        <Row>
          <Metric label="BMI estimate" value={targets.bmi} />
          <Metric label="Exercise entries today" value={sessions} />
        </Row>
        <P>BMI is a screening measure and does not measure body fat.</P>
        <Button
          secondary
          title="Weight journey & progress photos"
          onPress={() => router.push("/journey")}
        />
        <Button
          secondary
          title="Medication & injection companion"
          onPress={() => router.push("/medicines")}
        />
      </Card>
    </Screen>
  );
}
