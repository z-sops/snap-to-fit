import { useT, translateActive } from "../i18n";
import React, { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, act, notify, soft } from "../components/ui";
import { Surface, SectionHeader, Chip, PrimaryButton, Sheet, Pill, palette } from "../components/design";
import { Sparkline } from "../components/charts";
import { TrendChart } from "../components/visuals";
import { readingTrend } from "../core/chart-data";
import { useStore } from "../services/store";
import { haptic } from "../services/feedback";
import { connectHealth, installHealthConnect, openHealthSettings, HealthIssue, type HealthSnapshot } from "../services/health";
import { uid, numeric, type Reading } from "../core/model";
import { formatDateTime, formatNumber, formatTime, regionFor } from "../core/locale";

type Kind = Reading["kind"];
const kinds: { id: Kind; label: string; emoji: string; tint: string }[] = [
  { id: "weight", label: "Weight", emoji: "⚖️", tint: "#EEF2FF" },
  { id: "waist", label: "Waist", emoji: "📏", tint: "#E7F6EE" },
  { id: "bp", label: "Blood pressure", emoji: "❤️", tint: "#FDECEC" },
  { id: "glucose", label: "Glucose", emoji: "🩸", tint: "#FFF4DE" },
];
const devices = [
  { name: "Apple Watch", icon: "watch-outline" as const, platform: "ios", route: "Via Apple Health on iPhone", detail: "Pair your watch with iPhone and let it sync to Apple Health. Then allow Snap to Fit read-only access to steps, weight and heart rate. Workout sessions are not imported." },
  { name: "Android health", icon: "heart-circle-outline" as const, platform: "android", route: "Via Health Connect", detail: "Enable Health Connect on your phone. Let your tracker app share steps, weight and heart rate, then grant Snap to Fit read-only access. Workout sessions are not imported." },
  { name: "Fitbit / Google Health", icon: "fitness-outline" as const, platform: "android", route: "Via Health Connect on Android", detail: "In the Fitbit app, turn on sharing to Health Connect. Then refresh here. This does not sign into your Fitbit cloud account and does not import workouts." },
];

export default function Health() {
  const tr = useT();
  const { state, update } = useStore();
  const p = state.profile!;
  const imperial = (p.units || "imperial") === "imperial";
  const region = regionFor(p.country);
  const [entry, setEntry] = useState<Kind | null>(null);
  const [trend, setTrend] = useState<Kind>("weight");
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = (k: Kind) => state.readings.filter((r) => r.kind === k).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  const show = (r?: Reading) => {
    if (!r) return "—";
    if (r.kind === "weight") return imperial ? `${Math.round(r.value * 2.2046 * 10) / 10} lb` : `${r.value} kg`;
    if (r.kind === "waist") return imperial ? `${Math.round((r.value / 2.54) * 10) / 10} in` : `${r.value} cm`;
    if (r.kind === "bp") return `${r.value}/${r.second} mmHg`;
    return `${r.value} ${r.unit}`;
  };
  const series = state.readings.filter((r) => r.kind === trend).sort((a, b) => a.at.localeCompare(b.at));
  const myDevices = devices.filter((d) => d.platform === Platform.OS);
  const refresh = async () => {
    setBusy(true);
    try {
      const snap = await connectHealth();
      setSnapshot(snap);
      const empty = snap.steps == null && snap.weight == null && snap.heartRate == null;
      const msg = empty
        ? translateActive(snap.note)
        : translateActive("Connected to {source}. Steps: {steps} · Heart rate: {hr}", {
            source: snap.source,
            steps: snap.steps != null ? formatNumber(snap.steps, region) : "—",
            hr: snap.heartRate != null ? `${snap.heartRate} bpm` : "—",
          });
      if (Platform.OS === "web") notify(msg);
      else Alert.alert("Snap to Fit", msg, empty && Platform.OS === "android"
        ? [{ text: translateActive("OK") }, { text: translateActive("Open Health Connect"), onPress: openHealthSettings }]
        : undefined);
    } catch (e) {
      const issue = e instanceof HealthIssue ? e : null;
      const msg = translateActive(e instanceof Error ? e.message : "Something went wrong. Try again.");
      if (Platform.OS === "web" || !issue?.action) notify(msg);
      else Alert.alert("Snap to Fit", msg, [
        { text: translateActive("Not now"), style: "cancel" },
        issue.action === "install"
          ? { text: translateActive("Get Health Connect"), onPress: () => void installHealthConnect() }
          : { text: translateActive("Open Health Connect"), onPress: openHealthSettings },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Health" subtitle="Your body numbers and devices — a clear record for your next appointment">
      <Surface dark>
        <Text style={s.darkLabel}>{tr("Latest")}</Text>
        <View style={s.heroRow}>
          <Hero label="Steps today" value={snapshot?.steps != null ? formatNumber(snapshot.steps, region) : "—"} />
          <Hero label="Weight" value={show(latest("weight"))} />
          <Hero label="Heart rate" value={snapshot?.heartRate != null ? `${snapshot.heartRate} bpm` : "—"} />
        </View>
        <Text style={s.darkSmall}>{snapshot ? `${snapshot.source} · ${formatTime(snapshot.at, region)}` : tr("Connect your watch or tracker below for steps and heart rate.")}</Text>
      </Surface>

      <SectionHeader title="Log a reading" />
      <View style={s.tiles}>
        {kinds.map((k) => (
          <Pressable key={k.id} accessibilityRole="button" accessibilityLabel={`Log ${k.label}`} onPress={() => setEntry(k.id)} style={[s.tile, { backgroundColor: soft(k.tint) }]}>
            <Text style={s.tileEmoji}>{k.emoji}</Text>
            <Text style={s.tileTitle}>{tr(k.label)}</Text>
            <Text style={s.tileValue}>{show(latest(k.id))}</Text>
          </Pressable>
        ))}
      </View>

      <Surface>
        <Text style={s.h}>{tr("Trends")}</Text>
        <View style={s.wrap}>{kinds.map((k) => <Chip key={k.id} label={k.label} selected={trend === k.id} onPress={() => setTrend(k.id)} />)}</View>
        {trend === "weight" || trend === "waist" ? (
          series.length >= 2
            ? <Sparkline points={series.map((r) => (trend === "weight" ? (imperial ? r.value * 2.2046 : r.value) : imperial ? r.value / 2.54 : r.value))} />
            : <Text style={s.p}>Log two or more {trend} readings to see a trend.</Text>
        ) : (
          <TrendChart points={readingTrend(state.readings, trend, trend === "bp" ? "mmHg" : latest("glucose")?.unit || "mg/dL")}
            label={trend === "bp" ? tr("Systolic blood pressure") : tr("Glucose")} unit={trend === "bp" ? "mmHg" : latest("glucose")?.unit || "mg/dL"} />
        )}
      </Surface>

      <SectionHeader title="Watches & trackers" />
      {(myDevices.length ? myDevices : devices).map((d) => (
        <Surface key={d.name}>
          <View style={s.devRow}>
            <View style={s.devIcon}><Ionicons name={d.icon} size={24} color={palette.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.h}>{d.name}</Text>
              <Text style={s.small}>{d.route}</Text>
            </View>
          </View>
          <Text style={s.p}>{tr(d.detail)}</Text>
          <PrimaryButton title={busy ? tr("Reading health data…") : tr("Connect / refresh {name}", { name: d.name })} disabled={busy || Platform.OS !== d.platform} icon="sync" onPress={refresh} />
          {Platform.OS !== d.platform ? <Text style={s.small}>Available in the {d.platform === "ios" ? "iPhone" : tr("Android")} app.</Text> : null}
        </Surface>
      ))}
      {snapshot?.note ? <Text style={s.small}>{tr(snapshot.note)}</Text> : null}
      <Text style={s.small}>{tr("Read-only. No samples can mean no permission or no synced data — missing data is never treated as zero.")}</Text>

      <Pressable accessibilityRole="button" accessibilityLabel={tr("Connect my CGM")} onPress={() => router.push("/cgm")} style={s.cgm}>
        <Ionicons name="water" size={22} color={palette.brand} />
        <View style={{ flex: 1 }}>
          <Text style={s.h}>{tr("Continuous glucose monitor")}</Text>
          <Text style={s.small}>{tr("Dexcom history (delayed, not live alerts)")}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.muted} />
      </Pressable>

      <SectionHeader title="Recent readings" />
      {!state.readings.length ? <Text style={s.p}>{tr("No readings yet.")}</Text> : null}
      {[...state.readings].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20).map((r) => (
        <View key={r.id} style={s.readRow}>
          <Text style={s.readEmoji}>{kinds.find((k) => k.id === r.kind)?.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.readValue}>{show(r)}</Text>
            <Text style={s.small}>{formatDateTime(r.at, region)}{r.context ? ` · ${r.context}` : ""}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={tr("Remove reading")} hitSlop={8} onPress={() => act(() => update((x) => ({ ...x, readings: x.readings.filter((y) => y.id !== r.id) })))}>
            <Ionicons name="trash-outline" size={18} color={palette.muted} />
          </Pressable>
        </View>
      ))}
      <Text style={s.small}>{tr("Notices appear for manually entered low glucose or very high blood pressure. No notice doesn’t mean a reading is safe; one reading can’t diagnose a condition or set a medicine dose.")}</Text>

      {entry ? <ReadingSheet kind={entry} imperial={imperial} onClose={() => setEntry(null)} onSave={(r) => act(async () => {
        await update((x) => ({ ...x, readings: [...x.readings, r] }));
        haptic("success");
        setEntry(null);
        if (r.kind === "glucose" && (r.unit === "mg/dL" ? r.value < 70 : r.value < 3.9))
          notify("Your reading is low. Follow your prescribed low-glucose action plan. Seek urgent help if confused, faint or unable to swallow.");
        if (r.kind === "bp" && (r.value >= 180 || (r.second ?? 0) >= 120))
          notify("This reading is very high. Seek prompt medical assessment; with chest pain, breathlessness, weakness or vision changes, get emergency help now.");
      })} /> : null}
    </Screen>
  );
}

function Hero({ label, value }: { label: string; value: string }) {
  const tr = useT();
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.darkSmall}>{tr(label)}</Text>
      <Text style={s.darkValue}>{value}</Text>
    </View>
  );
}

function ReadingSheet({ kind, imperial, onClose, onSave }: { kind: Kind; imperial: boolean; onClose: () => void; onSave: (r: Reading) => void }) {
  const tr = useT();
  const [value, setValue] = useState("");
  const [second, setSecond] = useState("");
  const [unit, setUnit] = useState("mg/dL");
  const [context, setContext] = useState("");
  const meta = kinds.find((k) => k.id === kind)!;
  const label = kind === "bp" ? "Systolic (mmHg)" : kind === "weight" ? `Weight (${imperial ? "lb" : "kg"})` : kind === "waist" ? `Waist (${imperial ? "in" : "cm"})` : `Glucose (${unit})`;
  return (
    <Sheet visible title={tr("Log {what}", { what: tr(meta.label).toLowerCase() })} onClose={onClose}
      footer={<PrimaryButton title="Save reading" icon="checkmark" onPress={() => {
        try {
          let n: number;
          let d: number | undefined;
          if (kind === "weight") n = imperial ? Math.round((numeric(value, 66, 772, "Weight") / 2.2046) * 10) / 10 : numeric(value, 30, 350, "Weight");
          else if (kind === "waist") n = imperial ? Math.round(numeric(value, 12, 98, "Waist") * 2.54 * 10) / 10 : numeric(value, 30, 250, "Waist");
          else if (kind === "glucose") n = unit === "mg/dL" ? numeric(value, 10, 1000, "Glucose") : numeric(value, 0.5, 55.5, "Glucose");
          else { n = numeric(value, 40, 300, "Systolic"); d = numeric(second, 20, 200, "Diastolic"); if (d >= n) throw new Error("Systolic must be greater than diastolic. Check your reading."); }
          onSave({ id: uid(), at: new Date().toISOString(), kind, value: n, second: d, unit: kind === "glucose" ? unit : kind === "weight" ? "kg" : kind === "waist" ? "cm" : "mmHg", context: context.trim(), source: "manual" });
        } catch (e) { notify((e as Error).message); }
      }} />}>
      <Text style={s.bigEmoji}>{meta.emoji}</Text>
      {kind === "glucose" ? <View style={s.wrap}>{["mg/dL", "mmol/L"].map((u) => <Chip key={u} label={u} selected={unit === u} onPress={() => setUnit(u)} />)}</View> : null}
      <TextInput value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder={tr(label)} placeholderTextColor={palette.muted} accessibilityLabel={tr(label)} style={s.input} />
      {kind === "bp" ? <TextInput value={second} onChangeText={setSecond} keyboardType="number-pad" placeholder={tr("Diastolic (mmHg)")} placeholderTextColor={palette.muted} accessibilityLabel={tr("Diastolic (mmHg)")} style={s.input} /> : null}
      <TextInput value={context} onChangeText={setContext} placeholder={tr("Context (fasting, after meal, seated…)")} placeholderTextColor={palette.muted} accessibilityLabel={tr("Context / notes")} style={s.input} />
      {kind === "weight" ? <Pill label="Tip: weigh in the morning, after the bathroom, before eating" icon="sunny" /> : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  darkLabel: { color: "#A9B4CC", fontSize: 13, fontWeight: "700" },
  heroRow: { flexDirection: "row", gap: 8 },
  darkValue: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 2 },
  darkSmall: { color: "#A9B4CC", fontSize: 12 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "47%", flexGrow: 1, borderRadius: 22, padding: 16, gap: 4 },
  tileEmoji: { fontSize: 26 },
  tileTitle: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  tileValue: { color: palette.muted, fontSize: 13, fontWeight: "700" },
  h: { color: palette.ink, fontSize: 17, fontWeight: "800" },
  p: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  small: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  devRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  devIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.brandSoft, alignItems: "center", justifyContent: "center" },
  cgm: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: palette.hairline },
  readRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.card, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: palette.hairline },
  readEmoji: { fontSize: 22 },
  readValue: { color: palette.ink, fontSize: 16, fontWeight: "800" },
  input: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, fontSize: 18, color: palette.ink },
  bigEmoji: { fontSize: 48, textAlign: "center" },
});
