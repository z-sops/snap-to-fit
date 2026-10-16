import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, act } from "../components/ui";
import { Sheet, Chip, Pill, PrimaryButton, Surface, palette } from "../components/design";
import { useStore } from "../services/store";
import { haptic } from "../services/feedback";
import { equipmentGroups, filterLibrary, library, muscleGroups, safetyFor, type LibraryExercise } from "../core/exercise-library";

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export default function Exercises() {
  const { state, update } = useStore();
  const p = state.profile!;
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | undefined>();
  const [equipment, setEquipment] = useState<string | undefined>(p.place === "home" ? "home" : undefined);
  const [level, setLevel] = useState<string | undefined>();
  const [open, setOpen] = useState<LibraryExercise | null>(null);
  const results = useMemo(() => filterLibrary({ query, group, equipment, level }, p), [query, group, equipment, level, p]);
  const mine = state.myWorkout || [];
  const hidden = library().length - filterLibrary({}, p).length;
  const toggle = (id: string) =>
    act(async () => {
      haptic("tap");
      await update((s) => {
        const list = s.myWorkout || [];
        return { ...s, myWorkout: list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(0, 12) };
      });
    });
  return (
    <Screen title="Exercise library" subtitle={`${library().length} exercises with step-by-step form`}>
      <View style={s.search}>
        <Ionicons name="search" size={20} color={palette.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search squat, row, plank…" placeholderTextColor={palette.muted}
          accessibilityLabel="Search exercises" style={s.input} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip label="All" selected={!group} onPress={() => setGroup(undefined)} />
        {muscleGroups.map((g) => <Chip key={g.id} label={`${g.emoji} ${g.label}`} selected={group === g.id} onPress={() => setGroup(group === g.id ? undefined : g.id)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip label="Any equipment" selected={!equipment} onPress={() => setEquipment(undefined)} />
        {equipmentGroups.map((g) => <Chip key={g.id} label={g.label} selected={equipment === g.id} onPress={() => setEquipment(equipment === g.id ? undefined : g.id)} />)}
      </ScrollView>
      <View style={s.chipsWrap}>
        {(["beginner", "intermediate", "expert"] as const).map((l) => <Chip key={l} label={cap(l)} selected={level === l} onPress={() => setLevel(level === l ? undefined : l)} />)}
      </View>
      {hidden > 0 ? (
        <View style={s.safety}>
          <Ionicons name="shield-checkmark" size={18} color={palette.good} />
          <Text style={s.safetyText}>{hidden} exercises are hidden because they don’t suit the health details or movement limits in your profile. Your physical therapist can clear them.</Text>
        </View>
      ) : null}
      {mine.length ? <Pill label={`${mine.length} in My workout`} icon="barbell" /> : null}
      <Text style={s.count}>{results.length} results</Text>
      <FlatList scrollEnabled={false} data={results.slice(0, 120)} keyExtractor={(r) => r.e.id}
        renderItem={({ item: { e, safety } }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={e.name} onPress={() => setOpen(e)} style={s.row}>
            <Image source={{ uri: e.images[0] }} style={s.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={2}>{e.name}</Text>
              <Text style={s.meta} numberOfLines={1}>{cap(e.primary.join(", "))} · {cap(e.equipment)} · {cap(e.level)}</Text>
              {safety ? <Text style={s.caution} numberOfLines={1}>⚠️ {safety.reason}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={mine.includes(e.id) ? `Remove ${e.name} from my workout` : `Add ${e.name} to my workout`} onPress={() => toggle(e.id)} hitSlop={8}>
              <Ionicons name={mine.includes(e.id) ? "checkmark-circle" : "add-circle-outline"} size={28} color={palette.brand} />
            </Pressable>
          </Pressable>
        )} />
      {results.length > 120 ? <Text style={s.count}>Showing 120 — narrow with search or filters.</Text> : null}
      <Text style={s.credit}>Exercise data and images: free-exercise-db (public domain).</Text>
      <ExerciseDetail exercise={open} onClose={() => setOpen(null)} inWorkout={!!open && mine.includes(open.id)} onToggle={() => open && toggle(open.id)} />
    </Screen>
  );
}

function ExerciseDetail({ exercise, onClose, inWorkout, onToggle }: { exercise: LibraryExercise | null; onClose: () => void; inWorkout: boolean; onToggle: () => void }) {
  const { state } = useStore();
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!exercise || exercise.images.length < 2) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % exercise.images.length), 1100);
    return () => clearInterval(timer);
  }, [exercise]);
  if (!exercise) return null;
  const safety = state.profile ? safetyFor(exercise, state.profile) : null;
  return (
    <Sheet visible onClose={onClose} title={exercise.name} closeLabel="Back"
      footer={<PrimaryButton title={inWorkout ? "Remove from My workout" : "Add to My workout"} icon={inWorkout ? "remove-circle" : "add-circle"} onPress={onToggle} />}>
      <Image source={{ uri: exercise.images[frame] || exercise.images[0] }} style={s.hero} resizeMode="cover" accessibilityLabel={`${exercise.name} demonstration`} />
      <View style={s.chipsWrap}>
        <Pill label={cap(exercise.level)} />
        <Pill label={cap(exercise.equipment)} color={palette.good} bg={palette.goodSoft} />
        <Pill label={cap(exercise.category)} color={palette.warn} bg={palette.warnSoft} />
      </View>
      {safety ? (
        <Surface style={{ backgroundColor: palette.warnSoft, borderColor: palette.warnSoft }}>
          <Text style={s.cautionTitle}>Check first</Text>
          <Text style={s.cautionBody}>{safety.reason}</Text>
        </Surface>
      ) : null}
      <Surface>
        <Text style={s.h}>Muscles</Text>
        <Text style={s.p}>Main: {cap(exercise.primary.join(", "))}{exercise.secondary.length ? ` · Also: ${cap(exercise.secondary.join(", "))}` : ""}</Text>
      </Surface>
      <Surface>
        <Text style={s.h}>How to do it</Text>
        {exercise.steps.map((step, i) => (
          <View key={i} style={s.step}>
            <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
            <Text style={[s.p, { flex: 1, color: palette.ink }]}>{step}</Text>
          </View>
        ))}
      </Surface>
      <Text style={s.small}>Start light. Stop for sharp pain, dizziness or chest pain. Not a substitute for coaching or physical therapy.</Text>
    </Sheet>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, color: palette.ink, paddingVertical: 12 },
  chips: { gap: 8, paddingVertical: 2 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  safety: { flexDirection: "row", gap: 8, backgroundColor: palette.goodSoft, borderRadius: 16, padding: 12 },
  safetyText: { flex: 1, color: palette.good, fontSize: 13, lineHeight: 18 },
  count: { color: palette.muted, fontSize: 13, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#EDF0F6" },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: palette.bg },
  name: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  meta: { color: palette.muted, fontSize: 12, marginTop: 2 },
  caution: { color: palette.warn, fontSize: 12, marginTop: 2 },
  credit: { color: palette.muted, fontSize: 11, textAlign: "center" },
  hero: { width: "100%", height: 260, borderRadius: 24, backgroundColor: "#fff" },
  h: { color: palette.ink, fontSize: 17, fontWeight: "800" },
  p: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: palette.brandSoft, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: palette.brand, fontWeight: "900" },
  cautionTitle: { color: "#6B4300", fontWeight: "800", fontSize: 16 },
  cautionBody: { color: "#6B4300", fontSize: 14, lineHeight: 20 },
  small: { color: palette.muted, fontSize: 12, textAlign: "center" },
});
