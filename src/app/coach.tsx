import { effectiveProfile } from "../core/progress";
import React, { useState } from "react";
import {
  Screen,
  Card,
  H,
  P,
  Field,
  Button,
  Chips,
  act,
} from "../components/ui";
import { useStore } from "../services/store";
import { api } from "../services/api";
import { nutritionTargets, todayTotals } from "../core/nutrition";
import { urgentMessage, medicationRequest, restrictedHealthAdvice } from "../core/safety";
import { uid, type Message } from "../core/model";
export default function Coach() {
  const { state, update } = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const p = effectiveProfile(state)!;
  const send = (question = text) =>
    act(async () => {
      if (busy || !question.trim()) return;
      setBusy(true);
      setText("");
      const user: Message = { id: uid(), role: "user", text: question.trim() };
      try {
        await update((s) => ({ ...s, messages: [...s.messages, user] }));
        let answer = urgentMessage(question) || restrictedHealthAdvice(question);
        if (!answer && medicationRequest(question))
          answer =
            "I can help you record your prescribed schedule and prepare questions for your prescriber. I cannot recommend doses, injection breaks, stopping, tapering, or insulin changes.";
        if (!answer) {
          if (!p.aiConsent)
            throw new Error(
              "Enable optional AI consent in Settings to use the connected coach.",
            );
          const targets = nutritionTargets(p);
          const result = await api<{ text: string }>("/chat", {
            question,
            history: state.messages.slice(-8),
            profile: {
              age: p.age,
              sex: p.sex,
              height: p.height,
              weight: p.weight,
              goal: p.goal,
              conditions: p.conditions,
              insulin: p.insulin,
              medicines: p.medicines,
              allergies: p.allergies,
              diet: p.diet,
              country: p.country,
              dietType: p.dietType,
              allergyFoods: p.allergyFoods,
              familiarFoods: p.familiarFoods,
              injuries: p.injuries,
              experience: p.experience,
              targetWeight: p.targetWeight,
              activity: p.activity,
            },
            targets: targets.restricted ? null : targets,
            totals: todayTotals(state.meals),
          });
          answer = result.text;
        }
        await update((s) => ({
          ...s,
          messages: [
            ...s.messages,
            { id: uid(), role: "assistant", text: answer! },
          ],
        }));
      } catch (e) {
        await update((s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              id: uid(),
              role: "assistant",
              text:
                e instanceof Error
                  ? e.message
                  : "Chat could not connect. Please try again.",
            },
          ],
        }));
      } finally {
        setBusy(false);
      }
    });
  return (
    <Screen
      title="Your daily coach."
      subtitle="Practical food and movement guidance, grounded in your profile."
    >
      <Card tint>
        <H>Ask about your day</H>
        <P>
          The coach uses computed targets for eligible general-fitness profiles.
          It explains estimates and can suggest meals; it does not diagnose or
          change medication. Selected profile details are sent only when you
          ask.
        </P>
        <P>
          AI answers can be wrong. This chat does not monitor emergencies or
          contact emergency services. It does not calculate fertile or safe
          days, diagnose reproductive conditions or prescribe cycle-based training.
        </P>
        <Chips
          values={[
            {
              value: "Explain my daily calorie and macro targets.",
              label: "My macros",
            },
            {
              value:
                "Suggest a balanced meal that respects my food preferences and allergies.",
              label: "Meal ideas",
            },
            {
              value: "Explain how to approach today’s workout.",
              label: "Today’s workout",
            },
          ]}
          selected=""
          onChange={(v) => send(v)}
        />
      </Card>
      {state.messages.map((m) => (
        <Card key={m.id} tint={m.role === "user"}>
          <H>{m.role === "user" ? "You" : "Snap coach"}</H>
          <P>{m.text}</P>
        </Card>
      ))}
      <Card>
        <Field
          label="Message your coach"
          value={text}
          onChange={setText}
          placeholder="What can I eat for dinner?"
        />
        <Button
          disabled={busy || !text.trim()}
          title={busy ? "Thinking…" : "Send message"}
          onPress={() => send()}
        />
      </Card>
    </Screen>
  );
}
