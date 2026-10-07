import { FitnessHero, BarChart } from "../components/visuals";
import { weeklyActivity } from "../core/chart-data";
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
      <FitnessHero
        title={
          p.goal === "lose"
            ? "Build habits that last."
            : p.goal === "gain"
              ? "Fuel your strength."
              : "Find your balance."
        }
        detail="Log a meal. Make time to move. Build a routine that feels like you."
      >
        <Button
          title="Open today’s workout"
          onPress={() => router.push("/move")}
        />
      </FitnessHero>
      <Card>
        <H>Your activity this week</H>
        <BarChart
          points={weeklyActivity(state.workouts)}
          label="Exercise entries"
          unit="entries"
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
        <H>Connected to your lifestyle</H>
        <P>
          Apple Watch, Fitbit and Android health data, with your permission.
        </P>
        <Button
          title="Connect my watch or tracker"
          onPress={() => router.push("/health")}
        />
        <Button
          secondary
          title="Music for my workout"
          onPress={() => router.push("/music")}
        />
      </Card>
      <Card>
        <H>Find a gym nearby</H>
        <P>Search your current location or an area anywhere in the world.</P>
        <Button title="Find nearby gyms" onPress={() => router.push("/gyms")} />
      </Card>
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
