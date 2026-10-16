import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/ui";
import { ProgressRing, theme } from "../components/onboarding-ui";
import { useStore } from "../services/store";
import { effectiveProfile } from "../core/progress";
import { nutritionTargets, todayTotals } from "../core/nutrition";
import { weeklySchedule } from "../core/schedule";
import { localDay, type Meal } from "../core/model";
import type { AppRoute } from "../components/navigation";

type Tile = { href: AppRoute; title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; tint: string };

export default function Today() {
  const { state } = useStore();
  const p = effectiveProfile(state);
  const [day, setDay] = useState(() => localDay());
  if (!p) return null;
  const targets = nutritionTargets(p);
  const selected = new Date(`${day}T12:00:00`);
  const totals = todayTotals(state.meals, selected);
  const isToday = day === localDay();
  const week = weeklySchedule(p, state.workouts, p.place, new Date());
  const todayPlan = week.find((d) => d.date === localDay());
  const meals = state.meals
    .filter((m) => localDay(m.at) === day)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3);
  const left = Math.round(targets.calories - totals.calories);

  const tiles: Tile[] = [
    { href: "/meal-plan", title: "Meal plan", detail: "Your week of meals", icon: "calendar", tint: "#FFF1E6" },
    { href: "/metabolic", title: "Tracker", detail: "Meal and routine times", icon: "time", tint: "#EAF7EF" },
    { href: "/journey", title: "Journey", detail: "Weight and photos", icon: "trending-up", tint: "#EEF2FF" },
    { href: "/health", title: "Health & watch", detail: "Steps, weight, readings", icon: "pulse", tint: "#FDEBEC" },
    { href: "/medicines", title: p.glp1 ? "GLP-1 companion" : "Prescribed routine", detail: p.glp1 ? "Shots, symptoms, reminders" : "Medicines and reminders", icon: "medkit", tint: "#F3EDFF" },
    { href: "/coach", title: "Coach", detail: "Ask about food and moving", icon: "chatbubbles", tint: "#E9F6FF" },
    { href: "/gyms", title: "Gyms", detail: "Find one nearby", icon: "location", tint: "#FFF8DD" },
    { href: "/music", title: "Music", detail: "Your workout songs", icon: "musical-notes", tint: "#F0F4F8" },
    ...(p.age <= 50 ? [{ href: "/education", title: "Learn", detail: "Build strength safely", icon: "school", tint: "#EAF7EF" } as Tile] : []),
  ];

  return (
    <Screen title={`Hi, ${p.name} 👋`} subtitle={dateLine(selected, isToday)}>
      <WeekStrip selected={day} onSelect={setDay} meals={state.meals} />

      <View style={s.hero} accessibilityRole="summary">
        {targets.restricted ? (
          <View style={s.heroRow}>
            <ProgressRing size={150} stroke={14} progress={0} color={theme.brand}>
              <Text style={s.heroNum}>{Math.round(totals.calories).toLocaleString()}</Text>
              <Text style={s.heroUnit}>kcal eaten</Text>
            </ProgressRing>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>Targets paused</Text>
              <Text style={s.heroText}>Your health details mean your doctor or dietitian sets calorie goals. Keep logging meals here.</Text>
            </View>
          </View>
        ) : (
          <View style={s.heroRow}>
            <ProgressRing size={150} stroke={14} progress={totals.calories / targets.calories} color={left < 0 ? theme.protein : theme.brand}>
              <Text style={s.heroNum}>{Math.abs(left).toLocaleString()}</Text>
              <Text style={s.heroUnit}>{left < 0 ? "kcal over" : "kcal left"}</Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: 12 }}>
              <Stat label="Eaten" value={`${Math.round(totals.calories).toLocaleString()} kcal`} />
              <Stat label="Daily estimate" value={`${targets.calories.toLocaleString()} kcal`} />
            </View>
          </View>
        )}
        <View style={s.macros}>
          <MacroRing label="Protein" eaten={totals.protein} target={targets.restricted ? 0 : targets.protein} color={theme.protein} />
          <MacroRing label="Carbs" eaten={totals.carbs} target={targets.restricted ? 0 : targets.carbs} color={theme.carbs} />
          <MacroRing label="Fat" eaten={totals.fat} target={targets.restricted ? 0 : targets.fat} color={theme.fat} />
        </View>
      </View>

      <Pressable onPress={() => router.navigate("/food")} accessibilityRole="button" accessibilityLabel="Snap a meal" style={s.snap}>
        <View style={s.snapIcon}><Ionicons name="camera" size={30} color="white" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.snapTitle}>Snap your meal</Text>
          <Text style={s.snapText}>Take a photo and check calories and macros in seconds.</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="white" />
      </Pressable>

      <Pressable onPress={() => router.navigate("/move")} accessibilityRole="button" accessibilityLabel="Today's workout" style={s.card}>
        <View style={[s.tileIcon, { backgroundColor: "#EEF2FF" }]}><Ionicons name="barbell" size={22} color={theme.brand} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardKicker}>Today&apos;s workout</Text>
          <Text style={s.cardTitle}>{!todayPlan || todayPlan.rest ? "No workout scheduled" : todayPlan.title}</Text>
          <Text style={s.cardText}>
            {!todayPlan || todayPlan.rest
              ? "Rest, stretch or take a gentle walk."
              : todayPlan.completed
                ? "Done for today — nice work."
                : `${todayPlan.items.length} exercises · about ${todayPlan.duration} min`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.muted} />
      </Pressable>

      <View style={s.sectionHead}>
        <Text style={s.section}>{isToday ? "Recently logged" : "Logged this day"}</Text>
        <Pressable onPress={() => router.navigate("/food")} accessibilityRole="button"><Text style={s.link}>Add food</Text></Pressable>
      </View>
      {meals.length ? meals.map((m) => <MealRow key={m.id} meal={m} />) : (
        <View style={[s.card, { justifyContent: "center" }]}>
          <Text style={s.cardText}>Nothing logged yet. Snap your first meal or add it by hand.</Text>
        </View>
      )}

      <Text style={[s.section, { marginTop: 10 }]}>Explore</Text>
      <View style={s.grid}>
        {tiles.map((t) => (
          <Pressable key={t.href} onPress={() => router.navigate(t.href)} accessibilityRole="button" accessibilityLabel={t.title} style={s.tile}>
            <View style={[s.tileIcon, { backgroundColor: t.tint }]}><Ionicons name={t.icon} size={22} color={theme.ink} /></View>
            <Text style={s.tileTitle}>{t.title}</Text>
            <Text style={s.tileText}>{t.detail}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function dateLine(d: Date, isToday: boolean) {
  const label = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return isToday ? `Today · ${label}` : label;
}

function WeekStrip({ selected, onSelect, meals }: { selected: string; onSelect: (d: string) => void; meals: Meal[] }) {
  const today = new Date();
  const start = new Date(today);
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay()); // US week: Sunday first
  const logged = new Set(meals.map((m) => localDay(m.at)));
  const todayKey = localDay();
  return (
    <View style={s.week} accessibilityRole="tablist">
      {Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = localDay(d);
        const on = key === selected;
        const future = key > todayKey;
        return (
          <Pressable key={key} disabled={future} onPress={() => onSelect(key)} accessibilityRole="tab"
            accessibilityLabel={d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            aria-selected={on} style={[on ? s.dayOn : s.day, future && { opacity: 0.4 }]}>
            <Text style={on ? s.dayNameOn : s.dayName}>{d.toLocaleDateString(undefined, { weekday: "narrow" })}</Text>
            <Text style={on ? s.dayNumOn : s.dayNum}>{d.getDate()}</Text>
            <View style={[s.dot, { backgroundColor: logged.has(key) ? (on ? "white" : theme.brand) : "transparent" }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function MacroRing({ label, eaten, target, color }: { label: string; eaten: number; target: number; color: string }) {
  return (
    <View style={s.macro}>
      <ProgressRing size={66} stroke={7} progress={target ? eaten / target : 0} color={color}>
        <Text style={s.macroNum}>{Math.round(eaten)}g</Text>
      </ProgressRing>
      <Text style={s.macroLabel}>{label}</Text>
      <Text style={s.macroSub}>{target ? `${Math.max(0, Math.round(target - eaten))}g left` : "logged"}</Text>
    </View>
  );
}

function MealRow({ meal }: { meal: Meal }) {
  const time = new Date(meal.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <View style={s.mealRow}>
      <View style={[s.tileIcon, { backgroundColor: "#FFF1E6" }]}>
        <Ionicons name={meal.source === "photo" ? "camera" : "restaurant"} size={20} color={theme.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.mealName} numberOfLines={1}>{meal.name}</Text>
        <View style={s.chips}>
          <Chip text={`P ${Math.round(meal.protein)}g`} color={theme.protein} />
          <Chip text={`C ${Math.round(meal.carbs)}g`} color={theme.carbs} />
          <Chip text={`F ${Math.round(meal.fat)}g`} color={theme.fat} />
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={s.mealKcal}>{Math.round(meal.calories)} kcal</Text>
        <Text style={s.mealTime}>{time}</Text>
      </View>
    </View>
  );
}

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <View style={[s.chip, { backgroundColor: `${color}22` }]}>
      <Text style={[s.chipText, { color }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  week: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  day: { width: 42, paddingVertical: 8, borderRadius: 16, alignItems: "center", backgroundColor: "white" },
  dayOn: { width: 42, paddingVertical: 8, borderRadius: 16, alignItems: "center", backgroundColor: theme.brand },
  dayName: { fontSize: 12, fontWeight: "700", color: theme.muted },
  dayNameOn: { fontSize: 12, fontWeight: "700", color: "#DCE4FF" },
  dayNum: { fontSize: 16, fontWeight: "800", color: theme.ink, marginTop: 2 },
  dayNumOn: { fontSize: 16, fontWeight: "800", color: "white", marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 4 },
  hero: { backgroundColor: "white", borderRadius: 26, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: theme.line },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  heroNum: { fontSize: 30, fontWeight: "800", color: theme.ink, letterSpacing: -0.8 },
  heroUnit: { fontSize: 12, fontWeight: "700", color: theme.muted },
  heroTitle: { fontSize: 17, fontWeight: "800", color: theme.ink, marginBottom: 4 },
  heroText: { fontSize: 13, lineHeight: 19, color: theme.muted },
  statLabel: { fontSize: 12, fontWeight: "700", color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontWeight: "800", color: theme.ink, marginTop: 2 },
  macros: { flexDirection: "row", justifyContent: "space-around", marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderColor: theme.surface },
  macro: { alignItems: "center", gap: 4 },
  macroNum: { fontSize: 14, fontWeight: "800", color: theme.ink },
  macroLabel: { fontSize: 13, fontWeight: "800", color: theme.ink, marginTop: 2 },
  macroSub: { fontSize: 11, color: theme.muted },
  snap: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: theme.ink, borderRadius: 24, padding: 18, marginBottom: 14 },
  snapIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: theme.brand, alignItems: "center", justifyContent: "center" },
  snapTitle: { fontSize: 19, fontWeight: "800", color: "white" },
  snapText: { fontSize: 13, lineHeight: 18, color: "#C9D2EE", marginTop: 3 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "white", borderRadius: 22, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.line },
  cardKicker: { fontSize: 12, fontWeight: "800", color: theme.brand, textTransform: "uppercase", letterSpacing: 0.5 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: theme.ink, marginTop: 2 },
  cardText: { fontSize: 13, lineHeight: 19, color: theme.muted, marginTop: 2 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 10 },
  section: { fontSize: 19, fontWeight: "800", color: theme.ink, marginBottom: 10 },
  link: { fontSize: 14, fontWeight: "800", color: theme.brand, marginBottom: 10 },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.line },
  mealName: { fontSize: 15, fontWeight: "800", color: theme.ink },
  mealKcal: { fontSize: 15, fontWeight: "800", color: theme.ink },
  mealTime: { fontSize: 12, color: theme.muted, marginTop: 2 },
  chips: { flexDirection: "row", gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  chipText: { fontSize: 11, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { width: "47.5%", flexGrow: 1, backgroundColor: "white", borderRadius: 22, padding: 16, borderWidth: 1, borderColor: theme.line, minHeight: 128 },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tileTitle: { fontSize: 16, fontWeight: "800", color: theme.ink, marginTop: 12 },
  tileText: { fontSize: 12, lineHeight: 17, color: theme.muted, marginTop: 3 },
});
