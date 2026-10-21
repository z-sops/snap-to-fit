import { useT } from "../i18n";
// Guided workout: one exercise at a time, set counter, rest timer and spoken cues.
import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sheet, PrimaryButton, Pill, Stepper, palette } from "./design";
import { say, quiet } from "../services/voice";
import { haptic } from "../services/feedback";
import { uid, type WorkoutLog } from "../core/model";
import { lbToKg, weightDisplayFor } from "../core/units";
import type { Region, WeightDisplay } from "../core/locale";

export interface PlayerItem { id: string; name: string; image?: string; sets: number; reps: number; cues?: string[]; seconds?: number }

export function WorkoutPlayer({ visible, title, items, voice, region, onVoice, onClose, onFinish, units, weightDisplay }: {
  visible: boolean; title: string; items: PlayerItem[]; voice: boolean; region: Region; onVoice: (v: boolean) => void;
  onClose: () => void; onFinish: (logs: WorkoutLog[]) => void; units: "imperial" | "metric"; weightDisplay?: WeightDisplay;
}) {
  const tr = useT();
  // The entered weight follows the same unit the rest of the app shows.
  const display = weightDisplayFor({ units, weightDisplay });
  const weightUnit = display === "kg" ? "kg" : display === "st" ? "st + lb" : "lb";
  const weightInLb = display !== "kg";
  const [index, setIndex] = useState(0);
  const [set, setSet] = useState(1);
  const [rest, setRest] = useState(0);
  const [restLength, setRestLength] = useState(60);
  const [reps, setReps] = useState(items[0]?.reps || 10);
  const [weight, setWeight] = useState("");
  const [done, setDone] = useState<Record<string, { sets: number; reps: number; weight: number }>>({});
  const [started] = useState(() => new Date().getTime());
  const announced = useRef("");
  const item = items[index];
  const finished = index >= items.length;

  // Announce each exercise once when it comes up.
  useEffect(() => {
    if (!visible || !item) return;
    const key = `${item.id}-${index}`;
    if (announced.current === key) return;
    announced.current = key;
    say(index === 0 ? "Let's go. {name}. {sets} sets of {reps}." : "Next. {name}. {sets} sets of {reps}.", voice, { name: item.name, sets: item.sets, reps: item.reps }, region);
  }, [visible, item, index, voice, region]);

  // Rest countdown with spoken cues at 10 seconds and at the end.
  useEffect(() => {
    if (rest <= 0) return;
    const timer = setTimeout(() => {
      const next = rest - 1;
      if (next === 10) say("10 seconds.", voice, undefined, region);
      if (next === 0) { say("Set {set}. Go.", voice, { set }, region); haptic("warning"); }
      setRest(next);
    }, 1000);
    return () => clearTimeout(timer);
  }, [rest, voice, set, region]);

  useEffect(() => () => quiet(), []);

  const completeSet = () => {
    if (!item) return;
    haptic("success");
    const kg = Number(weight) > 0 ? (weightInLb ? lbToKg(Number(weight)) : Number(weight)) : 0;
    const prev = done[item.id];
    setDone({ ...done, [item.id]: { sets: (prev?.sets || 0) + 1, reps, weight: Math.round(kg * 10) / 10 } });
    if (set < item.sets) {
      setSet(set + 1);
      setRest(restLength);
      say("Nice. Rest {sec} seconds.", voice, { sec: restLength }, region);
    } else nextExercise();
  };
  const nextExercise = () => {
    const n = index + 1;
    setIndex(n);
    setSet(1);
    setRest(0);
    setWeight("");
    if (n < items.length) setReps(items[n].reps);
    else say("Workout complete. Great job!", voice, undefined, region);
  };
  const finish = () => {
    const minutes = Math.max(1, Math.round((new Date().getTime() - started) / 60000));
    const per = Math.max(1, Math.round(minutes / Math.max(1, Object.keys(done).length)));
    const logs: WorkoutLog[] = items.filter((i) => done[i.id]).map((i) => ({
      id: uid(), at: new Date().toISOString(), exerciseId: i.id, name: i.name,
      sets: done[i.id].sets, reps: done[i.id].reps, weight: done[i.id].weight, minutes: per,
    }));
    quiet();
    onFinish(logs);
  };

  return (
    <Sheet visible={visible} title={title} onClose={() => { quiet(); onClose(); }}
      footer={finished ? <PrimaryButton title="Save workout" icon="checkmark-done" onPress={finish} />
        : rest > 0 ? <PrimaryButton title="Skip rest" icon="play-skip-forward" onPress={() => { setRest(0); say("Set {set}. Go.", voice, { set }, region); }} />
        : <PrimaryButton title={tr("Done · set {set} of {v1}", { set, v1: item?.sets })} icon="checkmark-circle" onPress={completeSet} />}>
      <View style={s.topRow}>
        <Pill label={finished ? tr("Finished") : `Exercise ${index + 1} of ${items.length}`} />
        <Pressable accessibilityRole="switch" aria-checked={voice} accessibilityLabel={tr("Spoken workout cues")} onPress={() => onVoice(!voice)} style={s.voice}>
          <Ionicons name={voice ? "volume-high" : "volume-mute"} size={18} color={voice ? palette.brand : palette.muted} />
          <Text style={[s.voiceText, !voice && { color: palette.muted }]}>{tr("Spoken cues")} {voice ? tr("on") : tr("off")}</Text>
        </Pressable>
      </View>
      <View style={s.progress}>{items.map((it, i) => <View key={it.id + i} style={[s.seg, i < index && { backgroundColor: palette.brand }, i === index && { backgroundColor: palette.carbs }]} />)}</View>

      {finished ? (
        <View style={s.doneBox}>
          <Text style={s.doneEmoji}>🏆</Text>
          <Text style={s.doneTitle}>{tr("Workout complete!")}</Text>
          <Text style={s.p}>{Object.keys(done).length} exercises · {Object.values(done).reduce((a, d) => a + d.sets, 0)} sets. Save it to your log and keep your streak going.</Text>
        </View>
      ) : item ? (
        <>
          {item.image ? <Image source={{ uri: item.image }} style={s.image} resizeMode="cover" accessibilityLabel={`${item.name} demonstration`} /> : null}
          <Text style={s.name}>{item.name}</Text>
          {rest > 0 ? (
            <View style={s.restBox} accessibilityLabel={tr("Rest {rest} seconds", { rest })}>
              <Text style={s.restLabel}>{tr("Rest")}</Text>
              <Text style={s.restNum}>{rest}s</Text>
              <Text style={s.p}>Next: set {set} of {item.sets} · {item.reps} reps</Text>
            </View>
          ) : (
            <>
              <View style={s.statRow}>
                <View style={s.stat}><Text style={s.statLabel}>{tr("Set")}</Text><Text style={s.statNum}>{set}/{item.sets}</Text></View>
                <View style={s.stat}><Text style={s.statLabel}>{tr("Reps")}</Text><Stepper label="reps" value={reps} onChange={setReps} step={1} min={1} max={100} /></View>
              </View>
              <TextInput value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder={tr("Weight ({v0}) — leave empty for bodyweight", { v0: weightUnit })}
                placeholderTextColor={palette.muted} accessibilityLabel={tr("Weight used")} style={s.input} />
              {(item.cues || []).slice(0, 3).map((c) => <Text key={c} style={s.cue}>• {tr(c)}</Text>)}
            </>
          )}
          <View style={s.restPick}>
            <Text style={s.p}>{tr("Rest between sets")}</Text>
            {[45, 60, 90, 120].map((sec) => (
              <Pressable key={sec} accessibilityRole="button" accessibilityLabel={tr("Set rest to {sec} seconds", { sec })} onPress={() => setRestLength(sec)}
                style={[s.restChip, restLength === sec && { backgroundColor: palette.ink }]}>
                <Text style={[s.restChipText, restLength === sec && { color: palette.bg }]}>{sec}s</Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={tr("Skip this exercise")} onPress={nextExercise}><Text style={s.skip}>{tr("Skip this exercise")}</Text></Pressable>
          <Text style={s.small}>{tr("Spoken cues are read aloud by your phone. This is one-way audio only — the app never listens to you or records your voice.")}</Text>
          <Text style={s.small}>{tr("Stop if you feel sharp pain, chest pain, dizziness or unusual shortness of breath.")}</Text>
        </>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  voice: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: palette.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  voiceText: { color: palette.brand, fontWeight: "800", fontSize: 13 },
  progress: { flexDirection: "row", gap: 4 },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: palette.line },
  image: { width: "100%", height: 230, borderRadius: 24, backgroundColor: palette.card },
  name: { color: palette.ink, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  statRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: palette.card, borderRadius: 20, padding: 14, gap: 6, alignItems: "center" },
  statLabel: { color: palette.muted, fontWeight: "700", fontSize: 12 },
  statNum: { color: palette.ink, fontWeight: "900", fontSize: 30 },
  input: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: palette.ink },
  cue: { color: palette.ink, fontSize: 14, lineHeight: 20 },
  restBox: { backgroundColor: palette.night, borderRadius: 24, padding: 22, alignItems: "center", gap: 4 },
  restLabel: { color: "#A9B4CC", fontWeight: "800" },
  restNum: { color: "#fff", fontSize: 64, fontWeight: "900" },
  restPick: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  restChip: { backgroundColor: palette.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  restChipText: { color: palette.ink, fontWeight: "800" },
  skip: { color: palette.brand, fontWeight: "700", textAlign: "center", paddingVertical: 6 },
  small: { color: palette.muted, fontSize: 12, textAlign: "center" },
  p: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  doneBox: { alignItems: "center", gap: 8, paddingVertical: 24 },
  doneEmoji: { fontSize: 64 },
  doneTitle: { color: palette.ink, fontSize: 26, fontWeight: "900" },
});
