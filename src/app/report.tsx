import { useT } from "../i18n";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/ui";
import { Surface, StatTile, palette } from "../components/design";
import { WeekBars, Sparkline } from "../components/charts";
import { useStore } from "../services/store";
import { achievements, streak, weekReport } from "../core/streaks";

export default function Report() {
  const tr = useT();
  const { state } = useStore();
  const r = weekReport(state);
  const st = streak(state);
  const badges = achievements(state);
  const units = state.profile?.units || "imperial";
  const [from] = useState(() => new Date(new Date().getTime() - 30 * 864e5).toISOString());
  const weights = state.readings.filter((x) => x.kind === "weight" && x.at >= from).sort((a, b) => a.at.localeCompare(b.at));
  const unit = units === "imperial" ? "lb" : "kg";
  const shown = weights.map((w) => w.value);
  const change = r.weightChange === null ? null : Math.round(r.weightChange * (units === "imperial" ? 2.2046 : 1) * 10) / 10;
  return (
    <Screen title="Weekly report" subtitle="Your last 7 days">
      <Surface dark>
        <Text style={s.darkKicker}>{tr("Streak")}</Text>
        <Text style={s.darkBig}>🔥 {st.current} day{st.current === 1 ? "" : "s"}</Text>
        <Text style={s.darkText}>Best ever: {st.best} day{st.best === 1 ? "" : "s"}. {st.loggedToday ? tr("Today is counted.") : tr("Log something today to keep it going.")}</Text>
      </Surface>

      <View style={s.row}>
        <StatTile label="Days logged" value={`${r.daysLogged}/7`} />
        <StatTile label="Avg calories" value={r.avgCalories.toLocaleString()} unit="kcal" />
      </View>
      <View style={s.row}>
        <StatTile label="Avg protein" value={r.avgProtein} unit="g" color={palette.protein} />
        <StatTile label="Workouts" value={r.workouts} color={palette.brand} />
      </View>

      <Surface>
        <Text style={s.h}>{tr("Calories")}</Text>
        <WeekBars values={r.days.map((d) => d.calories)} labels={r.days.map((d) => d.label)} target={r.calorieTarget} />
        <Text style={s.p}>{r.calorieTarget ? tr("Dashed line: your {v0} kcal daily estimate. Amber bars ran more than 5% over.", { v0: r.calorieTarget.toLocaleString() }) : tr("Your care team sets your calorie target.")}</Text>
      </Surface>

      <Surface>
        <Text style={s.h}>{tr("Protein")}</Text>
        <WeekBars values={r.days.map((d) => d.protein)} labels={r.days.map((d) => d.label)} target={r.proteinTarget || null} color={palette.protein} />
        <Text style={s.p}>{r.proteinTarget ? tr("Goal reached on {proteinDays} of 7 days (target {proteinTarget} g).", { proteinDays: r.proteinDays, proteinTarget: r.proteinTarget }) : tr("Log meals to see your protein trend.")}</Text>
      </Surface>

      <Surface>
        <Text style={s.h}>{tr("Weight trend · 30 days")}</Text>
        {shown.length >= 2 ? (
          <>
            <Sparkline points={shown} />
            <Text style={s.p}>{change === null ? "" : tr("{v0}{change} {unit} this week. ", { v0: change > 0 ? "+" : "", change, unit })}Day-to-day weight jumps with water and salt — watch the trend, not one weigh-in.</Text>
          </>
        ) : <Text style={s.p}>{tr("Add your weight in Health two or more times to see your trend.")}</Text>}
      </Surface>

      <Surface>
        <Text style={s.h}>{tr("Highlights")}</Text>
        {r.highlights.length ? r.highlights.map((h) => <Text key={h} style={s.highlight}>{tr(h)}</Text>) : <Text style={s.p}>{tr("Log meals and workouts to unlock highlights.")}</Text>}
      </Surface>

      <Surface>
        <Text style={s.h}>{tr("Achievements")}</Text>
        <View style={s.badges}>
          {badges.map((b) => (
            <View key={b.id} style={[s.badge, !b.done && { opacity: 0.4 }]} accessibilityLabel={`${b.label}: ${b.done ? "unlocked" : "locked"}`}>
              <Text style={s.badgeIcon}>{b.done ? "🏅" : "🔒"}</Text>
              <Text style={s.badgeTitle}>{tr(b.label)}</Text>
              <Text style={s.badgeText}>{tr(b.detail)}</Text>
            </View>
          ))}
        </View>
      </Surface>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  h: { color: palette.ink, fontSize: 17, fontWeight: "800" },
  p: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  darkKicker: { color: "#A9B4CC", fontSize: 13, fontWeight: "700" },
  darkBig: { color: "#fff", fontSize: 34, fontWeight: "900" },
  darkText: { color: "#C9D2E5", fontSize: 14 },
  highlight: { color: palette.ink, fontSize: 15, fontWeight: "700" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badge: { width: "30%", flexGrow: 1, alignItems: "center", backgroundColor: palette.bg, borderRadius: 18, padding: 12, gap: 2 },
  badgeIcon: { fontSize: 26 },
  badgeTitle: { color: palette.ink, fontSize: 13, fontWeight: "800", textAlign: "center" },
  badgeText: { color: palette.muted, fontSize: 11, textAlign: "center" },
});
