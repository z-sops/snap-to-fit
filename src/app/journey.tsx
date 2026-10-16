import { useT } from "../i18n";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, act } from "../components/ui";
import { Surface, SectionHeader, Bar, PrimaryButton, Pill, palette } from "../components/design";
import { Sparkline } from "../components/charts";
import { useStore } from "../services/store";
import { weightProjection } from "../core/nutrition";
import { pickPhoto } from "../services/photos";
import { waistRatio, plateauReview } from "../core/trends";
import { uid } from "../core/model";

export default function Journey() {
  const tr = useT();
  const { state, update } = useStore();
  const p = state.profile!;
  const imperial = (p.units || "imperial") === "imperial";
  const w = (kg: number) => (imperial ? Math.round(kg * 2.2046 * 10) / 10 : Math.round(kg * 10) / 10);
  const unit = imperial ? "lb" : "kg";
  const weights = state.readings.filter((r) => r.kind === "weight").sort((a, b) => a.at.localeCompare(b.at));
  const start = weights[0]?.value ?? p.weight;
  const current = weights.at(-1)?.value ?? p.weight;
  const projection = weightProjection({ ...p, weight: current });
  const change = current - start;
  const toGo = Math.abs(current - p.targetWeight);
  // Progress only counts movement toward the goal.
  const span = p.targetWeight - start;
  const progress = Math.abs(span) > 0.1 ? Math.max(0, Math.min(1, (current - start) / span)) : 1;
  const waist = state.readings.filter((r) => r.kind === "waist").at(-1);
  const ratio = waist ? waistRatio(p.height, waist.value) : null;
  const review = plateauReview(state.readings);
  const photos = [...(state.photos || [])].sort((a, b) => a.at.localeCompare(b.at));
  const first = photos[0], latest = photos.at(-1);
  const addPhoto = () => act(async () => {
    const img = await pickPhoto(false);
    if (img) await update((s) => ({ ...s, photos: [...(s.photos || []), { id: uid(), at: new Date().toISOString(), image: img.uri }] }));
  });
  return (
    <Screen title="Your journey" subtitle="Track the trend. Celebrate the consistency.">
      <Surface dark>
        <View style={s.row3}>
          <Stat label="Start" value={`${w(start)}`} unit={unit} />
          <Stat label="Now" value={`${w(current)}`} unit={unit} big />
          <Stat label="Goal" value={`${w(p.targetWeight)}`} unit={unit} />
        </View>
        <Bar value={progress} total={1} color={palette.fiber} height={10} />
        <Text style={s.darkText}>
          {change === 0 ? tr("Your first weigh-in sets the starting line.") : `${change > 0 ? "+" : "−"}${w(Math.abs(change))} ${unit} so far · ${w(toGo)} ${unit} to go`}
        </Text>
      </Surface>

      <Surface>
        <View style={s.between}><Text style={s.h}>{tr("Weight trend")}</Text><Pill label={tr("{length} weigh-ins", { length: weights.length })} /></View>
        {weights.length >= 2 ? <Sparkline points={weights.slice(-60).map((r) => w(r.value))} /> : <Text style={s.p}>{tr("Add two or more weigh-ins to draw your trend.")}</Text>}
        <Text style={s.p}>{review.message}</Text>
        <PrimaryButton title="Log weight or waist" icon="scale" onPress={() => router.push("/health")} />
      </Surface>

      <Surface>
        <Text style={s.h}>{tr("Planning window")}</Text>
        <Text style={s.p}>
          {projection
            ? tr("About {minWeeks}–{maxWeeks} weeks at a steady {v2} a week. {label}", { minWeeks: projection.minWeeks, maxWeeks: projection.maxWeeks, v2: imperial ? "0.5–1 lb" : "0.25–0.5 kg", label: projection.label })
            : tr("No automatic timeline for your current goal or health context. Your logs stay available.")}
        </Text>
      </Surface>

      <Surface>
        <View style={s.between}><Text style={s.h}>{tr("Waist-to-height")}</Text><Text style={s.big}>{ratio ?? "—"}</Text></View>
        <Text style={s.p}>
          {waist ? tr("Latest waist: {w}. ", { w: imperial ? `${Math.round((waist.value / 2.54) * 10) / 10} in` : `${waist.value} cm` }) : tr("Add a waist measurement in Health. ")}
          A screening measure many clinicians use alongside BMI — not a body-fat or visceral-fat reading.
        </Text>
      </Surface>

      <SectionHeader title="Progress photos" action="Add" onAction={addPhoto} />
      {first && latest && first.id !== latest.id ? (
        <Surface>
          <Text style={s.h}>{tr("Then vs now")}</Text>
          <View style={s.compare}>
            {[first, latest].map((ph, i) => (
              <View key={ph.id} style={{ flex: 1, gap: 6 }}>
                <Image source={{ uri: ph.image }} style={s.compareImg} resizeMode="cover" />
                <Text style={s.caption}>{i === 0 ? tr("First") : tr("Latest")} · {new Date(ph.at).toLocaleDateString(tr("en-US"), { month: "short", day: "numeric" })}</Text>
              </View>
            ))}
          </View>
        </Surface>
      ) : null}
      <View style={s.grid}>
        {photos.map((ph) => (
          <View key={ph.id} style={s.cell}>
            <Image source={{ uri: ph.image }} style={s.cellImg} resizeMode="cover" />
            <View style={s.cellBar}>
              <Text style={s.caption}>{new Date(ph.at).toLocaleDateString(tr("en-US"), { month: "short", day: "numeric" })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={tr("Delete photo")} hitSlop={8}
                onPress={() => act(() => update((x) => ({ ...x, photos: x.photos.filter((y) => y.id !== ph.id) })))}>
                <Ionicons name="trash-outline" size={16} color={palette.muted} />
              </Pressable>
            </View>
          </View>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel={tr("Add progress photo")} onPress={addPhoto} style={[s.cell, s.addCell]}>
          <Ionicons name="camera-outline" size={28} color={palette.brand} />
          <Text style={s.addText}>{tr("Add photo")}</Text>
        </Pressable>
      </View>
      <Text style={s.small}>{tr("Photos stay encrypted on this phone, are never sent for AI analysis and are left out of cloud backups. We don’t estimate body fat from photos.")}</Text>
    </Screen>
  );
}

function Stat({ label, value, unit, big }: { label: string; value: string; unit: string; big?: boolean }) {
  const tr = useT();
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={s.darkLabel}>{tr(label)}</Text>
      <Text style={[s.darkValue, big && { fontSize: 34 }]}>{value}<Text style={s.darkUnit}> {unit}</Text></Text>
    </View>
  );
}

const s = StyleSheet.create({
  row3: { flexDirection: "row", alignItems: "flex-end" },
  darkLabel: { color: "#A9B4CC", fontSize: 12, fontWeight: "700" },
  darkValue: { color: "#fff", fontSize: 24, fontWeight: "900" },
  darkUnit: { color: "#A9B4CC", fontSize: 13, fontWeight: "700" },
  darkText: { color: "#C9D2E5", fontSize: 14, textAlign: "center" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  h: { color: palette.ink, fontSize: 17, fontWeight: "800" },
  p: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  big: { color: palette.ink, fontSize: 26, fontWeight: "900" },
  compare: { flexDirection: "row", gap: 10 },
  compareImg: { width: "100%", aspectRatio: 3 / 4, borderRadius: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: "31%", flexGrow: 1, backgroundColor: palette.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: palette.hairline },
  cellImg: { width: "100%", aspectRatio: 3 / 4 },
  cellBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 6 },
  caption: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  addCell: { alignItems: "center", justifyContent: "center", minHeight: 140, gap: 4, borderStyle: "dashed", borderColor: palette.line },
  addText: { color: palette.brand, fontWeight: "800", fontSize: 13 },
  small: { color: palette.muted, fontSize: 12, lineHeight: 17 },
});
