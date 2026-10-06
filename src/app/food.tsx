import { foodReview } from "../core/food-review";
import { router } from "expo-router";
import { effectiveProfile } from "../core/progress";
import React, { useState } from "react";
import { Image } from "react-native";
import {
  Screen,
  Card,
  Check,
  H,
  P,
  Field,
  Button,
  Row,
  Metric,
  act,
} from "../components/ui";
import { useStore } from "../services/store";
import { api } from "../services/api";
import { pickPhoto } from "../services/photos";
import { todayTotals, nutritionTargets, validateMeal } from "../core/nutrition";
import { uid, localDay, numeric, type Meal } from "../core/model";
export default function Food() {
  const { state, update } = useStore();
  const p = effectiveProfile(state)!;
  const targets = nutritionTargets(p);
  const total = todayTotals(state.meals);
  const [name, setName] = useState("");
  const [values, setValues] = useState({
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fibre: "",
  });
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<Meal["source"]>("manual");
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const review =
    source === "photo"
      ? foodReview(
          p,
          { name, carbs: Number(values.carbs) || 0 },
          state.carePlan?.acknowledged ? state.carePlan.targets : undefined,
          total.carbs,
        )
      : null;
  const scan = (camera: boolean) =>
    act(async () => {
      if (!p.aiConsent)
        throw new Error(
          "Enable optional AI consent in Settings before photo analysis.",
        );
      setBusy(true);
      try {
        const img = await pickPhoto(camera);
        if (!img) return;
        setPhoto(img.uri);
        const result = await api<{
          name: string;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          fibre: number;
          uncertainty: string;
        }>("/food", { image: img.data, mimeType: img.mimeType });
        validateMeal({ ...result, source: "photo" });
        setReviewed(false);
        setName(result.name);
        setValues({
          calories: String(result.calories),
          protein: String(result.protein),
          carbs: String(result.carbs),
          fat: String(result.fat),
          fibre: String(result.fibre),
        });
        setNote(result.uncertainty);
        setSource("photo");
      } finally {
        setBusy(false);
      }
    });
  return (
    <Screen
      title="Fuel your day."
      subtitle="Snap a meal. Check the portions. Make it count."
    >
      <Card tint>
        <Row>
          <Metric
            label="Calories logged"
            value={Math.round(total.calories)}
            unit="kcal"
          />
          <Metric
            label="Protein logged"
            value={Math.round(total.protein)}
            unit="g"
          />
        </Row>
        {!targets.restricted ? (
          <P>
            Estimated daily targets: {targets.calories} kcal · {targets.protein}{" "}
            g protein · {targets.carbs} g carbs · {targets.fat} g fat ·{" "}
            {targets.fibre} g fibre.
          </P>
        ) : (
          <P>Automatic targets are paused for your medical context.</P>
        )}
      </Card>
      <Button
        secondary
        title="My local weekly meal plan"
        onPress={() => router.push("/meal-plan")}
      />
      <Card>
        <H>Food photo</H>
        <P>
          Only the selected food photo is sent for AI analysis. Portions and
          hidden ingredients are uncertain; review the result before saving.
        </P>
        <Row>
          <Button
            disabled={busy}
            title={busy ? "Analyzing…" : "Take a snap"}
            onPress={() => scan(true)}
          />
          <Button
            secondary
            disabled={busy}
            title="Choose photo"
            onPress={() => scan(false)}
          />
        </Row>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ height: 180, borderRadius: 16, marginTop: 16 }}
            resizeMode="cover"
          />
        ) : null}
        {note ? <P>{note}</P> : null}
      </Card>
      <Card>
        <H>
          {source === "photo"
            ? "Review your meal estimate"
            : "Log a meal manually"}
        </H>
        <Field
          label="Meal and portion description"
          value={name}
          onChange={(v) => {
            setReviewed(false);
            setName(v);
          }}
          placeholder="Grilled chicken, rice and salad"
        />
        {(["calories", "protein", "carbs", "fat", "fibre"] as const).map(
          (k) => (
            <Field
              key={k}
              label={`${k[0].toUpperCase() + k.slice(1)} (${k === "calories" ? "kcal" : "g"})`}
              numeric
              value={values[k]}
              onChange={(v) => {
                setReviewed(false);
                setValues((prev) => ({ ...prev, [k]: v }));
              }}
            />
          ),
        )}
        <P>
          Enter values for the entire meal. Check packaged-food labels when
          available.
        </P>
        {review?.requiresReview ? (
          <Card>
            <H>Check before choosing this meal</H>
            {review.messages.map((message) => (
              <P key={message}>{message}</P>
            ))}
            <P>{review.alternative}</P>
            <Check
              label="I reviewed the concerns and ingredients. This acknowledgment does not certify food safety; I can still record what I actually ate."
              value={reviewed}
              onChange={setReviewed}
            />
          </Card>
        ) : null}
        <Button
          disabled={busy || !!(review?.requiresReview && !reviewed)}
          title={source === "photo" ? "Confirm portions & save" : "Save meal"}
          onPress={() =>
            act(async () => {
              if (review?.requiresReview && !reviewed)
                throw new Error(
                  "Review the food concerns before confirming this estimate.",
                );
              const meal = {
                name,
                source,
                calories: numeric(values.calories, 0, 5000, "Calories"),
                protein: numeric(values.protein, 0, 500, "Protein"),
                carbs: numeric(values.carbs, 0, 500, "Carbs"),
                fat: numeric(values.fat, 0, 500, "Fat"),
                fibre: numeric(values.fibre, 0, 500, "Fibre"),
              };
              validateMeal(meal);
              await update((s) => ({
                ...s,
                meals: [
                  ...s.meals,
                  { ...meal, id: uid(), at: new Date().toISOString() },
                ],
              }));
              setName("");
              setValues({
                calories: "",
                protein: "",
                carbs: "",
                fat: "",
                fibre: "",
              });
              setPhoto("");
              setNote("");
              setSource("manual");
            })
          }
        />
      </Card>
      <Card>
        <H>Today’s food log</H>
        {state.meals.filter((m) => localDay(m.at) === localDay()).length ===
        0 ? (
          <P>No meals yet. Your first entry starts the story.</P>
        ) : null}
        {state.meals
          .filter((m) => localDay(m.at) === localDay())
          .map((m) => (
            <Card key={m.id}>
              <H>{m.name}</H>
              <P>
                {m.calories} kcal · P {m.protein} g · C {m.carbs} g · F {m.fat}{" "}
                g
              </P>
              <Button
                secondary
                title="Remove entry"
                onPress={() =>
                  act(() =>
                    update((s) => ({
                      ...s,
                      meals: s.meals.filter((x) => x.id !== m.id),
                    })),
                  )
                }
              />
            </Card>
          ))}
      </Card>
    </Screen>
  );
}
