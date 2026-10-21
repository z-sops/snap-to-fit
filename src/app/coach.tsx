import { useLang, useT } from "../i18n";
import { insulinNotices, recentLow, usesInsulin } from "../core/insulin-safety";
import { effectiveProfile } from "../core/progress";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, act, colors, soft } from "../components/ui";
import { useStore } from "../services/store";
import { api } from "../services/api";
import { nutritionTargets, todayTotals } from "../core/nutrition";
import { verifiedTotals } from "../core/food-log";
import { urgentMessage, medicationRequest, restrictedHealthAdvice } from "../core/safety";
import { uid, type Message } from "../core/model";
import { emergencyInstruction, regionFor } from "../core/locale";
export default function Coach() {
  const tr = useT();
  const lang = useLang();
  const { state, update } = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const p = effectiveProfile(state)!;
  const region = regionFor(p.country);
  const send = (question = text) =>
    act(async () => {
      if (busy || !question.trim()) return;
      setBusy(true);
      setText("");
      const user: Message = { id: uid(), role: "user", text: question.trim() };
      try {
        await update((s) => ({ ...s, messages: [...s.messages, user] }));
        let answer = urgentMessage(question) || restrictedHealthAdvice(question);
        if (answer) answer = tr(answer);
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
            language: lang,
            // The server only sends context when the user has agreed to AI.
            aiConsent: p.aiConsent,
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
              cuisine: p.cuisine || "american",
              dietType: p.dietType,
              allergyFoods: p.allergyFoods,
              familiarFoods: p.familiarFoods,
              injuries: p.injuries,
              experience: p.experience,
              days: p.days,
              workoutDays: p.workoutDays,
              targetWeight: p.targetWeight,
              activity: p.activity,
            },
            targets: targets.restricted ? null : targets,
            // Context only, so the coach can warn about low-glucose risk. Units are never sent.
            insulinSafety: usesInsulin(state)
              ? { types: state.medicines.filter((m) => m.kind === "insulin").map((m) => m.insulinType || "other"), recentLow: recentLow(state), notices: insulinNotices(state).map((n) => n.text) }
              : undefined,
            // Only a nutrient that is at least partly known is sent, and each
            // one says whether it is a confirmed total or a lower bound. A
            // nutrient nobody reported is left out rather than sent as zero.
            totals: verifiedTotals(todayTotals(state.meals)),
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
  const prompts = [
    { q: "Explain my daily calorie and macro targets.", label: "📊 My macros" },
    { q: "Suggest a balanced meal that respects my food preferences and allergies.", label: "🥗 Meal ideas" },
    { q: "Give me three high-protein breakfast ideas.", label: "🍳 Protein breakfast" },
    { q: "How do I eat out at a restaurant and stay on track?", label: "🍔 Eating out" },
    { q: "Explain how to approach today’s workout.", label: "🏋️ Today’s workout" },
    { q: "What are gentle food ideas on days I feel nauseous?", label: "🤢 Nausea-friendly food" },
  ];
  return (
    <Screen title="AI Coach" subtitle="Food and movement guidance grounded in your profile">
      <View style={c.hero}>
        <View style={c.botAvatar}><Text style={{ fontSize: 26 }}>✨</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={c.heroTitle}>Hi {p.name}, I’m your Snap coach</Text>
          <Text style={c.heroText}>{tr("Ask about meals, macros, workouts or habits. I don’t diagnose, change medicines or handle emergencies — in an emergency {emergency}.", { emergency: emergencyInstruction(region) })}</Text>
        </View>
      </View>
      <View style={c.prompts}>
        {prompts.map((x) => (
          <Pressable key={x.q} accessibilityRole="button" accessibilityLabel={tr(x.label)} onPress={() => send(x.q)} style={c.prompt}>
            <Text style={c.promptText}>{tr(x.label)}</Text>
          </Pressable>
        ))}
      </View>
      {state.messages.map((m) => (
        <View key={m.id} style={[c.bubbleRow, m.role === "user" && { justifyContent: "flex-end" }]}>
          {m.role === "assistant" ? <View style={c.miniBot}><Text>✨</Text></View> : null}
          <View style={[c.bubble, m.role === "user" ? c.userBubble : c.botBubble]}>
            <Text style={[c.bubbleText, m.role === "user" && { color: "#fff" }]}>{m.text}</Text>
          </View>
        </View>
      ))}
      {busy ? (
        <View style={c.bubbleRow}>
          <View style={c.miniBot}><Text>✨</Text></View>
          <View style={[c.bubble, c.botBubble]}><Text style={c.bubbleText}>{tr("Thinking…")}</Text></View>
        </View>
      ) : null}
      <View style={c.composer}>
        <TextInput value={text} onChangeText={setText} placeholder={tr("What can I eat for dinner?")} placeholderTextColor={colors.muted}
          accessibilityLabel={tr("Message your coach")} style={c.input} multiline onSubmitEditing={() => send()} />
        <Pressable accessibilityRole="button" accessibilityLabel={tr("Send message")} disabled={busy || !text.trim()} onPress={() => send()}
          style={[c.send, (busy || !text.trim()) && { opacity: 0.4 }]}>
          <Ionicons name="arrow-up" size={22} color="#fff" />
        </Pressable>
      </View>
      <Text style={c.small}>{tr("AI answers can be wrong — check anything important with your doctor or dietitian. Only the profile details needed for your question are sent. The coach doesn’t calculate fertile or safe days or prescribe cycle-based training.")}</Text>
    </Screen>
  );
}

const c = StyleSheet.create({
  hero: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.card, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: colors.hairline },
  botAvatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: soft("#F3EDFF"), alignItems: "center", justifyContent: "center" },
  heroTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  heroText: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  prompts: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 12 },
  prompt: { backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.line },
  promptText: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 10 },
  miniBot: { width: 30, height: 30, borderRadius: 10, backgroundColor: soft("#F3EDFF"), alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "82%", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { backgroundColor: colors.green, borderBottomRightRadius: 6 },
  botBubble: { backgroundColor: colors.card, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.hairline },
  bubbleText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, backgroundColor: colors.card, borderRadius: 24, padding: 8, borderWidth: 1, borderColor: colors.line, marginTop: 6 },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingHorizontal: 10, paddingVertical: 10, maxHeight: 120 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  small: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 10 },
});
