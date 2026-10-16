import { useT, type T } from "../i18n";
import React, { useState } from "react";
import { Avatar, AvatarPicker } from "../components/Avatar";
import { WeekBars } from "../components/charts";
import { pickPhoto } from "../services/photos";
import { streak, weekReport, proteinTarget } from "../core/streaks";
import { bodyNumbers, adaptiveTdee } from "../core/targets";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, act, soft, isDark } from "../components/ui";
import { ProgressRing, theme } from "../components/onboarding-ui";
import { useStore } from "../services/store";
import { effectiveProfile } from "../core/progress";
import { nutritionTargets, todayTotals } from "../core/nutrition";
import { weeklySchedule } from "../core/schedule";
import { localDay, type Meal } from "../core/model";
import type { AppRoute } from "../components/navigation";

type Tile = { href: AppRoute; title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; tint: string };

export default function Today() {
  const tr = useT();
  const { state, update } = useStore();
  const p = effectiveProfile(state);
  const [day, setDay] = useState(() => localDay());
  const [picker, setPicker] = useState(false);
  if (!p) return null;
  const st = streak(state);
  const report = weekReport(state);
  const pTarget = proteinTarget(state);
  const numbers = bodyNumbers(p);
  const adaptive = adaptiveTdee(state);
  const saveAvatar = (avatar: NonNullable<typeof p.avatar>) =>
    act(async () => {
      await update((s) => ({ ...s, profile: s.profile ? { ...s.profile, avatar } : null }));
      setPicker(false);
    });
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

  const featured: Tile[] = [
    { href: "/medicines", title: "GLP-1 companion", detail: p.glp1 ? tr("{v0} · shots, side effects, protein", { v0: p.glp1.split(" (")[0] }) : "Ozempic, Wegovy, Mounjaro, Zepbound", icon: "medkit", tint: soft("#F3EDFF") },
    { href: "/education", title: "Gym Truth", detail: "Supplements, steroids, soreness — the science", icon: "school", tint: soft("#EAF7EF") },
    { href: "/coach", title: "AI Coach", detail: "Ask about food and moving", icon: "chatbubbles", tint: soft("#E9F6FF") },
  ];
  const more: Tile[] = [
    { href: "/meal-plan", title: "Meal plan", detail: "Your week of meals", icon: "calendar", tint: soft("#FFF1E6") },
    { href: "/journey", title: "Journey", detail: "Weight and photos", icon: "trending-up", tint: soft("#EEF2FF") },
    { href: "/health", title: "Health & watch", detail: "Steps, weight, readings", icon: "pulse", tint: soft("#FDEBEC") },
    { href: "/metabolic", title: "Tracker", detail: "Meal and routine times", icon: "time", tint: soft("#EAF7EF") },
    { href: "/gyms", title: "Gyms", detail: "Find one nearby", icon: "location", tint: soft("#FFF8DD") },
    { href: "/music", title: "Music", detail: "Your workout songs", icon: "musical-notes", tint: soft("#F0F4F8") },
  ];


  return (
    <Screen title={tr("Hi, {name} 👋", { name: p.name })} subtitle={dateLine(selected, isToday, tr)}>
      <View style={s.topRow}>
        <Avatar profile={p} size={52} onPress={() => setPicker(true)} />
        <View style={{ flex: 1 }}>
          <Text style={s.topTitle}>{st.loggedToday ? tr("Nice — you’re on track today") : st.current ? tr("Keep your streak alive") : tr("Let’s start your streak")}</Text>
          <Text style={s.topText}>{st.loggedToday ? tr("Every log makes your estimates smarter.") : tr("Log one meal to count today.")}</Text>
        </View>
        <View style={s.streak} accessibilityLabel={tr("{current} day streak", { current: st.current })}>
          <Text style={s.streakNum}>🔥 {st.current}</Text>
          <Text style={s.streakLabel}>{tr("day streak")}</Text>
        </View>
      </View>
      <WeekStrip selected={day} onSelect={setDay} meals={state.meals} />

      <View style={s.hero} accessibilityRole="summary">
        {targets.restricted ? (
          <View style={s.heroRow}>
            <ProgressRing size={150} stroke={14} progress={0} color={theme.brand}>
              <Text style={s.heroNum}>{Math.round(totals.calories).toLocaleString()}</Text>
              <Text style={s.heroUnit}>{tr("kcal eaten")}</Text>
            </ProgressRing>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>{tr("Targets paused")}</Text>
              <Text style={s.heroText}>{tr("Your health details mean your doctor or dietitian sets calorie goals. Keep logging meals here.")}</Text>
            </View>
          </View>
        ) : (
          <View style={s.heroRow}>
            <ProgressRing size={150} stroke={14} progress={totals.calories / targets.calories} color={left < 0 ? theme.protein : theme.brand}>
              <Text style={s.heroNum}>{Math.abs(left).toLocaleString()}</Text>
              <Text style={s.heroUnit}>{tr(left < 0 ? "kcal over" : "kcal left")}</Text>
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

      {isToday && pTarget > 0 && totals.protein >= pTarget ? (
        <View style={s.win} accessibilityRole="alert">
          <Text style={s.winEmoji}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.winTitle}>{tr("Protein goal reached!")}</Text>
            <Text style={s.winText}>{Math.round(totals.protein)} g today — that’s how you keep muscle while you get lean.</Text>
          </View>
        </View>
      ) : null}

      <View style={s.quickRow}>
        <QuickAction icon="camera" label="Snap" tint={theme.brand} dark onPress={() => router.navigate({ pathname: "/food", params: { snap: String(Date.now()) } })} a11y="Snap your meal now" />
        <QuickAction icon="barcode-outline" label="Barcode" tint={soft("#E7F6EE")} onPress={() => router.navigate("/food")} a11y="Scan a barcode" />
        <QuickAction icon="search" label="Search" tint={soft("#FFF4DE")} onPress={() => router.navigate("/food")} a11y="Search foods" />
        <QuickAction icon="barbell" label="Workout" tint={soft("#EEF2FF")} onPress={() => router.navigate("/move")} a11y="Start a workout" />
      </View>

      <Pressable onPress={() => router.navigate("/move")} accessibilityRole="button" accessibilityLabel={tr("Today's workout")} style={s.card}>
        <View style={[s.tileIcon, { backgroundColor: soft("#EEF2FF") }]}><Ionicons name="barbell" size={22} color={theme.brand} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardKicker}>{tr("Today's workout")}</Text>
          <Text style={s.cardTitle}>{!todayPlan || todayPlan.rest ? tr("No workout scheduled") : todayPlan.title}</Text>
          <Text style={s.cardText}>
            {!todayPlan || todayPlan.rest
              ? tr("Rest, stretch or take a gentle walk.")
              : todayPlan.completed
                ? tr("Done for today — nice work.")
                : tr("{length} exercises · about {duration} min", { length: todayPlan.items.length, duration: todayPlan.duration })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.muted} />
      </Pressable>

      <Pressable onPress={() => router.navigate("/report")} accessibilityRole="button" accessibilityLabel={tr("Open weekly report")} style={s.reportCard}>
        <View style={s.reportHead}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardKicker}>{tr("This week")}</Text>
            <Text style={s.cardTitle}>{report.daysLogged ? tr("{v0} kcal · {avgProtein} g protein avg", { v0: report.avgCalories.toLocaleString(), avgProtein: report.avgProtein }) : tr("Your weekly report starts today")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.muted} />
        </View>
        <WeekBars values={report.days.map((d) => d.calories)} labels={report.days.map((d) => d.label)} target={report.calorieTarget} />
        <Text style={s.cardText}>{tr(report.highlights[0]) || tr("Log meals for a few days to see your trends.")}</Text>
      </Pressable>

      <Pressable onPress={() => router.navigate("/numbers")} accessibilityRole="button" accessibilityLabel={tr("Open my numbers")} style={s.numbers}>
        <Num label="BMR" value={numbers.bmr.toLocaleString()} unit="kcal" />
        <Num label={adaptive ? tr("TDEE (adaptive)") : tr("TDEE")} value={(adaptive?.tdee || numbers.tdee).toLocaleString()} unit="kcal" />
        <Num label="BMI" value={String(numbers.bmi)} />
        <Ionicons name="chevron-forward" size={18} color={theme.muted} />
      </Pressable>

      <View style={s.sectionHead}>
        <Text style={s.section}>{isToday ? tr("Recently logged") : tr("Logged this day")}</Text>
        <Pressable onPress={() => router.navigate("/food")} accessibilityRole="button"><Text style={s.link}>{tr("Add food")}</Text></Pressable>
      </View>
      {meals.length ? meals.map((m) => <MealRow key={m.id} meal={m} />) : (
        <View style={[s.card, { justifyContent: "center" }]}>
          <Text style={s.cardText}>{tr("Nothing logged yet. Snap your first meal or add it by hand.")}</Text>
        </View>
      )}

      <Text style={[s.section, { marginTop: 10 }]}>{tr("For you")}</Text>
      {featured.map((f) => (
        <Pressable key={f.href} onPress={() => router.navigate(f.href)} accessibilityRole="button" accessibilityLabel={tr(f.title)} style={s.card}>
          <View style={[s.tileIcon, { backgroundColor: f.tint }]}><Ionicons name={f.icon} size={22} color={theme.ink} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{tr(f.title)}</Text>
            <Text style={s.cardText}>{tr(f.detail)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.muted} />
        </Pressable>
      ))}
      <Text style={[s.section, { marginTop: 10 }]}>{tr("More")}</Text>
      <View style={s.grid}>
        {more.map((t) => (
          <Pressable key={t.href} onPress={() => router.navigate(t.href)} accessibilityRole="button" accessibilityLabel={tr(t.title)} style={s.tile}>
            <View style={[s.tileIconSm, { backgroundColor: t.tint }]}><Ionicons name={t.icon} size={18} color={theme.ink} /></View>
            <Text style={s.tileTitle}>{tr(t.title)}</Text>
            <Text style={s.tileText}>{tr(t.detail)}</Text>
          </Pressable>
        ))}
      </View>
      <AvatarPicker visible={picker} profile={p} onClose={() => setPicker(false)} onSave={(a) => saveAvatar(a || {})}
        onPickPhoto={() => act(async () => {
          const img = await pickPhoto(false);
          if (img) await saveAvatar({ photoUri: img.thumb || img.uri });
        })} />
    </Screen>
  );
}

function dateLine(d: Date, isToday: boolean, tr: T) {
  const label = d.toLocaleDateString(tr("en-US"), { weekday: "long", month: "long", day: "numeric" });
  return isToday ? tr("Today · {label}", { label }) : label;
}

function WeekStrip({ selected, onSelect, meals }: { selected: string; onSelect: (d: string) => void; meals: Meal[] }) {
  const tr = useT();
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
            accessibilityLabel={d.toLocaleDateString(tr("en-US"), { weekday: "long", month: "short", day: "numeric" })}
            aria-selected={on} style={[on ? s.dayOn : s.day, future && { opacity: 0.4 }]}>
            <Text style={on ? s.dayNameOn : s.dayName}>{d.toLocaleDateString(tr("en-US"), { weekday: "narrow" })}</Text>
            <Text style={on ? s.dayNumOn : s.dayNum}>{d.getDate()}</Text>
            <View style={[s.dot, { backgroundColor: logged.has(key) ? (on ? "white" : theme.brand) : "transparent" }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

function QuickAction({ icon, label, tint, onPress, a11y, dark }: { icon: keyof typeof Ionicons.glyphMap; label: string; tint: string; onPress: () => void; a11y: string; dark?: boolean }) {
  const tr = useT();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={tr(a11y)} style={[s.quick, dark && { backgroundColor: "#111A2E", borderColor: "#111A2E" }]}>
      <View style={[s.quickIcon, { backgroundColor: tint }]}><Ionicons name={icon} size={22} color={dark ? "white" : theme.ink} /></View>
      <Text style={[s.quickText, dark && { color: "white" }]}>{tr(label)}</Text>
    </Pressable>
  );
}

function Num({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const tr = useT();
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.statLabel}>{tr(label)}</Text>
      <Text style={s.numValue}>{value}{unit ? <Text style={s.numUnit}> {unit}</Text> : null}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const tr = useT();
  return (
    <View>
      <Text style={s.statLabel}>{tr(label)}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function MacroRing({ label, eaten, target, color }: { label: string; eaten: number; target: number; color: string }) {
  const tr = useT();
  return (
    <View style={s.macro}>
      <ProgressRing size={66} stroke={7} progress={target ? eaten / target : 0} color={color}>
        <Text style={s.macroNum}>{Math.round(eaten)}g</Text>
      </ProgressRing>
      <Text style={s.macroLabel}>{tr(label)}</Text>
      <Text style={s.macroSub}>{target ? tr("{n}g left", { n: Math.max(0, Math.round(target - eaten)) }) : tr("logged")}</Text>
    </View>
  );
}

function MealRow({ meal }: { meal: Meal }) {
  const tr = useT();
  const time = new Date(meal.at).toLocaleTimeString(tr("en-US"), { hour: "numeric", minute: "2-digit" });
  return (
    <View style={s.mealRow}>
      <View style={[s.tileIcon, { backgroundColor: soft("#FFF1E6") }]}>
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
  const tr = useT();
  return (
    <View style={[s.chip, { backgroundColor: `${color}22` }]}>
      <Text style={[s.chipText, { color }]}>{tr(text)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  topTitle: { fontSize: 15, fontWeight: "800", color: theme.ink },
  topText: { fontSize: 12, color: theme.muted, marginTop: 2 },
  streak: { alignItems: "center", backgroundColor: soft("#FFF4DE"), borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  streakNum: { fontSize: 17, fontWeight: "900", color: isDark ? "#F5C26B" : "#9A5B00" },
  streakLabel: { fontSize: 10, fontWeight: "700", color: isDark ? "#F5C26B" : "#9A5B00" },
  win: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: soft("#E7F6EE"), borderRadius: 22, padding: 16, marginBottom: 14 },
  winEmoji: { fontSize: 30 },
  winTitle: { fontSize: 16, fontWeight: "800", color: isDark ? "#4ADE80" : "#1E7A47" },
  winText: { fontSize: 13, color: isDark ? "#4ADE80" : "#1E7A47", marginTop: 2, lineHeight: 18 },
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  quick: { flex: 1, alignItems: "center", gap: 8, backgroundColor: theme.bg, borderRadius: 20, paddingVertical: 14, borderWidth: 1, borderColor: theme.line },
  quickIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  quickText: { fontSize: 13, fontWeight: "800", color: theme.ink },
  reportCard: { backgroundColor: theme.bg, borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.line, gap: 10 },
  reportHead: { flexDirection: "row", alignItems: "center" },
  numbers: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.bg, borderRadius: 22, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.line },
  numValue: { fontSize: 18, fontWeight: "800", color: theme.ink, marginTop: 2 },
  numUnit: { fontSize: 11, color: theme.muted, fontWeight: "700" },
  tileIconSm: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  week: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  day: { width: 42, paddingVertical: 8, borderRadius: 16, alignItems: "center", backgroundColor: theme.bg },
  dayOn: { width: 42, paddingVertical: 8, borderRadius: 16, alignItems: "center", backgroundColor: theme.brand },
  dayName: { fontSize: 12, fontWeight: "700", color: theme.muted },
  dayNameOn: { fontSize: 12, fontWeight: "700", color: "#DCE4FF" },
  dayNum: { fontSize: 16, fontWeight: "800", color: theme.ink, marginTop: 2 },
  dayNumOn: { fontSize: 16, fontWeight: "800", color: "white", marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 4 },
  hero: { backgroundColor: theme.bg, borderRadius: 26, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: theme.line },
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
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: theme.bg, borderRadius: 22, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.line },
  cardKicker: { fontSize: 12, fontWeight: "800", color: theme.brand, textTransform: "uppercase", letterSpacing: 0.5 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: theme.ink, marginTop: 2 },
  cardText: { fontSize: 13, lineHeight: 19, color: theme.muted, marginTop: 2 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 10 },
  section: { fontSize: 19, fontWeight: "800", color: theme.ink, marginBottom: 10 },
  link: { fontSize: 14, fontWeight: "800", color: theme.brand, marginBottom: 10 },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.bg, borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.line },
  mealName: { fontSize: 15, fontWeight: "800", color: theme.ink },
  mealKcal: { fontSize: 15, fontWeight: "800", color: theme.ink },
  mealTime: { fontSize: 12, color: theme.muted, marginTop: 2 },
  chips: { flexDirection: "row", gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  chipText: { fontSize: 11, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { width: "30%", flexGrow: 1, backgroundColor: theme.bg, borderRadius: 20, padding: 12, borderWidth: 1, borderColor: theme.line, minHeight: 112 },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tileTitle: { fontSize: 14, fontWeight: "800", color: theme.ink, marginTop: 10 },
  tileText: { fontSize: 12, lineHeight: 17, color: theme.muted, marginTop: 3 },
});
