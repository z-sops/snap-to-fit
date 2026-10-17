import { translateActive, useT } from "../i18n";
import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, H, P, Button, act, notify } from "../components/ui";
import { Surface, SectionHeader, Chip, PrimaryButton, Sheet, Pill, palette } from "../components/design";
import { WorkoutPreferences } from "../components/WorkoutPreferences";
import { WorkoutPlayer, type PlayerItem } from "../components/WorkoutPlayer";
import { MusicControls } from "../components/MusicControls";
import { useStore } from "../services/store";
import { haptic } from "../services/feedback";
import { weeklySchedule, isRestricted } from "../core/schedule";
import { topicsFor } from "../core/learn";
import { exerciseById, planImage } from "../core/exercise-library";
import { streak } from "../core/streaks";
import { uid, numeric, validateProfile, type Place, type State, localDay } from "../core/model";
import { preWorkoutChecks, usesInsulin } from "../core/insulin-safety";
import { InsulinNotices } from "../components/InsulinNotices";
import { scheduleReminder } from "../services/reminders";

export default function Move() {
  const tr = useT();
  const { state, update } = useStore();
  const p = state.profile!;
  const [editingWeek, setEditingWeek] = useState(!p.workoutDays);
  const [weekProfile, setWeekProfile] = useState(p);
  const [place, setPlace] = useState<Place>(p.place);
  const [selectedDate, setSelectedDate] = useState(localDay());
  const [player, setPlayer] = useState<null | { title: string; items: PlayerItem[] }>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [pending, setPending] = useState<null | { title: string; items: PlayerItem[] }>(null);
  const insulin = usesInsulin(state);
  // Insulin users confirm a short low-glucose checklist before every workout.
  const start = (w: { title: string; items: PlayerItem[] }) => (insulin ? setPending(w) : setPlayer(w));
  const week = weeklySchedule(p, state.workouts, place);
  const day = week.find((d) => d.date === selectedDate) || week[0];
  const restricted = isRestricted(p);
  const voice = state.voiceCues !== false;
  const units = p.units || "imperial";
  const doneDays = week.filter((d) => d.completed).length;
  const planned = week.filter((d) => !d.rest).length;
  const weekMinutes = state.workouts.filter((w) => week.some((d) => d.date === localDay(w.at))).reduce((a, w) => a + w.minutes, 0);
  const st = streak(state);
  const guides = topicsFor(p);
  const mine = (state.myWorkout || []).map(exerciseById).filter(Boolean) as NonNullable<ReturnType<typeof exerciseById>>[];

  const planItems: PlayerItem[] = day.items.map((e) => ({ id: e.id, name: e.name, image: planImage(e.id), sets: day.sets || 2, reps: day.reps || 10, cues: e.cues }));
  const myItems: PlayerItem[] = mine.map((e) => ({ id: e.id, name: e.name, image: e.images[0], sets: p.experience === "beginner" ? 2 : 3, reps: 10, cues: e.steps.slice(0, 3) }));

  const save = (logs: typeof state.workouts) =>
    act(async () => {
      if (logs.length) await update((s) => ({ ...s, workouts: [...s.workouts, ...logs] }));
      haptic("success");
      setPlayer(null);
      if (insulin) {
        // Exercise keeps lowering glucose for hours; remind once, about an hour later.
        await scheduleReminder(new Date(Date.now() + 60 * 60_000), translateActive("Check your glucose: exercise can keep lowering it for hours, including tonight.")).catch(() => {});
        notify("Workout saved. Check your glucose now and again later today — exercise can lower it for hours.");
      }
    });

  return (
    <Screen title="Move" subtitle={tr("{days} sessions a week · {experience}", { days: p.days, experience: tr(p.experience) })}>
      <Surface dark>
        <View style={s.sumRow}>
          <View>
            <Text style={s.darkLabel}>{tr("This week")}</Text>
            <Text style={s.darkBig}>{doneDays}<Text style={s.darkUnit}> / {tr("{n} sessions", { n: planned })}</Text></Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.darkLabel}>{tr("Active minutes")}</Text>
            <Text style={s.darkMid}>{weekMinutes} min</Text>
          </View>
        </View>
        <View style={s.days}>
          {week.map((d) => (
            <Pressable key={d.date} accessibilityRole="tab" aria-selected={d.date === selectedDate} accessibilityLabel={`${d.weekday}${d.rest ? ", rest day" : ""}${d.completed ? ", done" : ""}`}
              onPress={() => setSelectedDate(d.date)} style={[s.day, d.date === selectedDate && s.dayOn]}>
              <Text style={[s.dayName, d.date === selectedDate && { color: "#17213B" }]}>{tr(d.weekday).slice(0, 1).toUpperCase()}</Text>
              <Ionicons name={d.completed ? "checkmark-circle" : d.rest ? "ellipse-outline" : "barbell"} size={16} color={d.completed ? palette.fiber : d.date === selectedDate ? "#17213B" : "#A9B4CC"} />
            </Pressable>
          ))}
        </View>
        <Text style={s.darkSmall}>{st.current ? tr("🔥 {current}-day streak · ", { current: st.current }) : tr("Start a streak today · ")}{tr("tap a day to see its plan")}</Text>
      </Surface>

      <InsulinNotices state={state} />
      <View style={s.chipsRow}>
        {(["gym", "home", "walk"] as Place[]).map((pl) => <Chip key={pl} label={pl === "gym" ? "🏋️ Gym" : pl === "home" ? "🏠 Home" : "🚶 Walking"} selected={place === pl} onPress={() => setPlace(pl)} />)}
      </View>

      <Surface>
        <Text style={s.kicker}>{day.date === localDay() ? tr("Today") : day.weekday}</Text>
        <Text style={s.title}>{restricted ? tr("Your care plan comes first") : day.rest ? tr("Rest or light activity") : day.title}</Text>
        <Text style={s.p}>
          {restricted
            ? tr("Because of your health details, Snap to Fit doesn’t assign intensity. Use the library and safety guides with your doctor or physical therapist.")
            : day.rest
              ? tr("No session planned. A walk, stretching or mobility work all count.")
              : tr("{length} exercises · {sets} sets × {reps} reps · about {duration} min", { length: day.items.length, sets: day.sets, reps: day.reps, duration: day.duration })}
        </Text>
        {!restricted && !day.rest ? (
          <>
            {planItems.map((it) => (
              <View key={it.id} style={s.exRow}>
                {it.image ? <Image source={{ uri: it.image }} style={s.exImg} /> : <View style={[s.exImg, s.exIcon]}><Ionicons name="barbell" size={18} color={palette.brand} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={s.exName}>{it.name}</Text>
                  <Text style={s.exMeta}>{it.sets} × {it.reps}</Text>
                </View>
              </View>
            ))}
            <PrimaryButton title={day.completed ? tr("Do it again") : tr("Start workout")} icon="play" onPress={() => start({ title: day.title, items: planItems })} />
          </>
        ) : (
          <PrimaryButton title="Browse exercises" icon="search" onPress={() => router.push("/exercises")} />
        )}
      </Surface>

      {mine.length ? (
        <Surface>
          <View style={s.between}><Text style={s.title}>{tr("My workout")}</Text><Pill label={`${mine.length} exercises`} /></View>
          {myItems.map((it) => (
            <View key={it.id} style={s.exRow}>
              <Image source={{ uri: it.image }} style={s.exImg} />
              <Text style={[s.exName, { flex: 1 }]}>{it.name}</Text>
            </View>
          ))}
          <PrimaryButton title="Start my workout" icon="play" onPress={() => start({ title: "My workout", items: myItems })} />
        </Surface>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel={tr("Open exercise library")} onPress={() => router.push("/exercises")} style={s.libCard}>
        <View style={s.libIcon}><Ionicons name="library" size={26} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.libTitle}>{tr("Exercise library")}</Text>
          <Text style={s.libText}>{tr("870+ exercises by muscle and equipment, with form steps. Filtered for your health details.")}</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#fff" />
      </Pressable>

      <View style={s.chipsRow}>
        <Chip label={voice ? "🔊 Voice coach on" : "🔇 Voice coach off"} selected={voice} onPress={() => act(() => update((x) => ({ ...x, voiceCues: !voice })))} />
        <Chip label="➕ Log activity" onPress={() => setLogOpen(true)} />
        <Chip label="🎵 Workout music" onPress={() => router.push("/music")} />
      </View>
      <MusicControls />

      {guides.length ? (
        <Card tint>
          <H>{tr("Exercise safety guides for you")}</H>
          <P>{tr("Based on your profile. Your doctor or physical therapist sets your limits — these guides help you ask the right questions.")}</P>
          {guides.slice(0, 4).map((a) => (
            <Button key={a.id} secondary title={`${a.emoji} ${a.title}`} onPress={() => router.push({ pathname: "/education", params: { topic: a.id } })} />
          ))}
        </Card>
      ) : null}

      <Card>
        <Button secondary title={editingWeek ? tr("Close week settings") : tr("Choose / change my workout days")} onPress={() => { setWeekProfile(p); setEditingWeek(!editingWeek); }} />
        {editingWeek ? <>
          <WorkoutPreferences profile={weekProfile} onChange={setWeekProfile} />
          <Button title="Save my workout week" onPress={() => act(async () => {
            if (!weekProfile.workoutDays) throw new Error("Choose your workout days first.");
            validateProfile(weekProfile);
            await update((x) => ({ ...x, profile: x.profile ? { ...x.profile, days: weekProfile.days, workoutDays: weekProfile.workoutDays } : null }));
            setEditingWeek(false);
          })} />
        </> : null}
      </Card>

      <SectionHeader title="Recent sessions" />
      {state.workouts.length === 0 ? <Text style={s.p}>{tr("Finish a workout or log an activity to see it here.")}</Text> : null}
      {[...state.workouts].reverse().slice(0, 12).map((w) => (
        <View key={w.id} style={s.logRow}>
          <View style={[s.exImg, s.exIcon]}><Ionicons name="barbell" size={18} color={palette.brand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.exName}>{w.name}</Text>
            <Text style={s.exMeta}>{w.sets ? `${w.sets} × ${w.reps}${w.weight ? ` · ${units === "imperial" ? Math.round(w.weight * 2.2046) + " lb" : w.weight + " kg"}` : ""} · ` : ""}{w.minutes} min · {new Date(w.at).toLocaleDateString(tr("en-US"), { month: "short", day: "numeric" })}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${w.name}`} onPress={() => act(() => update((x) => ({ ...x, workouts: x.workouts.filter((y) => y.id !== w.id) })))} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={palette.muted} />
          </Pressable>
        </View>
      ))}

      {pending ? <InsulinCheck state={state} onCancel={() => setPending(null)} onStart={() => { setPlayer(pending); setPending(null); }} /> : null}
      {player ? (
      <WorkoutPlayer visible title={player.title} items={player.items} voice={voice} units={units}
          onVoice={(v) => act(() => update((x) => ({ ...x, voiceCues: v })))} onClose={() => setPlayer(null)} onFinish={save} />
      ) : null}
      <LogActivity visible={logOpen} onClose={() => setLogOpen(false)} onSave={(entry) => act(async () => {
        await update((x) => ({ ...x, workouts: [...x.workouts, entry] }));
        haptic("success");
        setLogOpen(false);
      })} />
    </Screen>
  );
}

const activities = [
  { id: "walk", name: "Walking" }, { id: "run", name: "Running" }, { id: "cycle", name: "Cycling" },
  { id: "swim", name: "Swimming" }, { id: "yoga", name: "Yoga / stretching" }, { id: "sport", name: "Sports" }, { id: "strength", name: "Strength training" },
];
function LogActivity({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (e: { id: string; at: string; exerciseId: string; name: string; sets: number; reps: number; weight: number; minutes: number }) => void }) {
  const tr = useT();
  const [kind, setKind] = useState("walk");
  const [minutes, setMinutes] = useState("");
  return (
    <Sheet visible={visible} title="Log activity" onClose={onClose}
      footer={<PrimaryButton title="Save activity" icon="checkmark" onPress={() => act(async () => {
        const a = activities.find((x) => x.id === kind)!;
        onSave({ id: uid(), at: new Date().toISOString(), exerciseId: a.id, name: a.name, sets: 0, reps: 0, weight: 0, minutes: numeric(minutes, 1, 240, "Duration") });
        setMinutes("");
      })} />}>
      <View style={s.chipsRow}>{activities.map((a) => <Chip key={a.id} label={a.name} selected={kind === a.id} onPress={() => setKind(a.id)} />)}</View>
      <TextInput value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder={tr("Minutes")} placeholderTextColor={palette.muted}
        accessibilityLabel={tr("Duration (minutes)")} style={s.input} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  checkIntro: { color: palette.ink, fontSize: 15, lineHeight: 21, marginTop: 6 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  checkText: { color: palette.ink, fontSize: 15, lineHeight: 21, flex: 1 },
  checkSmall: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  darkLabel: { color: "#A9B4CC", fontSize: 13, fontWeight: "700" },
  darkBig: { color: "#fff", fontSize: 36, fontWeight: "900" },
  darkUnit: { color: "#A9B4CC", fontSize: 15, fontWeight: "700" },
  darkMid: { color: "#fff", fontSize: 20, fontWeight: "800" },
  darkSmall: { color: "#C9D2E5", fontSize: 12 },
  days: { flexDirection: "row", justifyContent: "space-between" },
  day: { width: 40, alignItems: "center", gap: 6, paddingVertical: 8, borderRadius: 14 },
  dayOn: { backgroundColor: "#fff" },
  dayName: { color: "#A9B4CC", fontWeight: "800" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginVertical: 8 },
  kicker: { color: palette.brand, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  title: { color: palette.ink, fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  p: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  exRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  exImg: { width: 52, height: 52, borderRadius: 14, backgroundColor: palette.bg },
  exIcon: { alignItems: "center", justifyContent: "center", backgroundColor: palette.brandSoft },
  exName: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  exMeta: { color: palette.muted, fontSize: 12, marginTop: 2 },
  libCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: palette.brand, borderRadius: 24, padding: 18 },
  libIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  libTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  libText: { color: "#DCE4FF", fontSize: 13, lineHeight: 18, marginTop: 2 },
  logRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: palette.card, borderRadius: 18, padding: 10, borderWidth: 1, borderColor: palette.hairline },
  input: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: palette.ink },
});

/** Before-workout checklist for insulin users. The two required ticks unlock Start. */
function InsulinCheck({ state, onCancel, onStart }: { state: State; onCancel: () => void; onStart: () => void }) {
  const tr = useT();
  const [ticked, setTicked] = useState<string[]>([]);
  const ready = preWorkoutChecks.every((c) => !c.required || ticked.includes(c.id));
  return (
    <Sheet visible title={tr("Before you start")} onClose={onCancel}
      footer={<PrimaryButton title="Start workout" icon="play" disabled={!ready} onPress={onStart} />}>
      <InsulinNotices state={state} aboutToTrain />
      <Text style={s.checkIntro}>{tr("You use insulin, so exercise can lower your glucose during and for hours after. Quick check:")}</Text>
      {preWorkoutChecks.map((c) => (
        <Pressable key={c.id} accessibilityRole="checkbox" aria-checked={ticked.includes(c.id)} accessibilityLabel={tr(c.text)}
          onPress={() => setTicked((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} style={s.checkRow}>
          <Ionicons name={ticked.includes(c.id) ? "checkbox" : "square-outline"} size={24} color={palette.brand} />
          <Text style={s.checkText}>{tr(c.text)}{c.required ? "" : ` ${tr("(optional)")}`}</Text>
        </Pressable>
      ))}
      <Text style={s.checkSmall}>{tr("If your glucose is low, or high with ketones, don't exercise — follow your care team's plan. Stop and treat a low if you feel shaky, sweaty, dizzy or confused.")}</Text>
    </Sheet>
  );
}
