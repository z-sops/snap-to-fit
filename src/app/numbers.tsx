import React from "react";
import { StyleSheet, Text, View, Linking, Pressable } from "react-native";
import { router } from "expo-router";
import { Screen } from "../components/ui";
import { Surface, StatTile, Pill, PrimaryButton, palette } from "../components/design";
import { useStore } from "../services/store";
import { effectiveProfile } from "../core/progress";
import { nutritionTargets } from "../core/nutrition";
import { bodyNumbers, adaptiveTdee, proteinGuidance } from "../core/targets";
import { formatWeight, formatHeight } from "../core/units";

const bmiBands = [
  { upTo: 18.5, color: "#7DB3FF", label: "<18.5" },
  { upTo: 25, color: palette.fiber, label: "18.5–24.9" },
  { upTo: 30, color: palette.carbs, label: "25–29.9" },
  { upTo: 45, color: palette.protein, label: "30+" },
];

export default function Numbers() {
  const { state } = useStore();
  const p = effectiveProfile(state)!;
  const n = bodyNumbers(p);
  const t = nutritionTargets(p);
  const adaptive = adaptiveTdee(state);
  const protein = proteinGuidance(p);
  const units = p.units || "imperial";
  const pos = Math.min(1, Math.max(0, (n.bmi - 15) / 25));
  return (
    <Screen title="My numbers" subtitle={`${formatWeight(p.weight, units)} · ${formatHeight(p.height, units)} · ${p.age} yrs`}>
      <View style={s.row}>
        <StatTile label="BMR" value={n.bmr.toLocaleString()} unit="kcal" color={palette.brand} />
        <StatTile label="TDEE" value={(adaptive?.tdee || n.tdee).toLocaleString()} unit="kcal" color={palette.ink} />
      </View>

      <Surface>
        <Text style={s.h}>BMR — calories at complete rest</Text>
        <Text style={s.p}>The energy your body uses just to keep you alive (breathing, heart, brain) if you stayed in bed all day. Calculated with the Mifflin–St Jeor equation from your sex, age, height and weight.</Text>
      </Surface>

      <Surface>
        <View style={s.between}>
          <Text style={s.h}>TDEE — calories you burn per day</Text>
          {adaptive ? <Pill label="Adaptive" icon="sparkles" color={palette.good} bg={palette.goodSoft} /> : null}
        </View>
        <Text style={s.p}>
          {adaptive
            ? `Learned from your last ${adaptive.days} days of food logs and weigh-ins: ${adaptive.tdee.toLocaleString()} kcal. The formula estimate is ${n.tdee.toLocaleString()} kcal.`
            : `BMR × your activity level (${n.activityLabel.toLowerCase()}): ${n.tdee.toLocaleString()} kcal. Log meals and weigh in for two weeks and Snap to Fit learns your real number.`}
        </Text>
      </Surface>

      <Surface>
        <View style={s.between}>
          <Text style={s.h}>BMI</Text>
          <Text style={s.big}>{n.bmi}</Text>
        </View>
        <View style={s.gauge}>
          {bmiBands.map((b, i) => <View key={b.label} style={{ flex: i === 3 ? 1.5 : 1, backgroundColor: b.color, height: 10 }} />)}
          <View style={[s.marker, { left: `${pos * 100}%` }]} />
        </View>
        <View style={s.between}>{bmiBands.map((b) => <Text key={b.label} style={s.small}>{b.label}</Text>)}</View>
        <Text style={s.p}>{n.bmiLabel}. BMI is a quick screening number — it can’t tell muscle from fat, so athletes often read “high”. It isn’t a diagnosis.</Text>
      </Surface>

      <Surface>
        <Text style={s.h}>Daily calories</Text>
        {t.restricted ? (
          <Text style={s.p}>Because you shared health conditions or medicines, your doctor or dietitian sets your calorie target. Snap to Fit keeps logging and education on.</Text>
        ) : (
          <>
            <Text style={s.big}>{t.calories.toLocaleString()} kcal</Text>
            <Text style={s.p}>
              {p.goal === "lose" ? `About ${(t.maintenance - t.calories).toLocaleString()} kcal below your TDEE — a moderate deficit you can keep up.` : p.goal === "gain" ? "A small surplus above your TDEE for steady, lean gains." : "Matches your TDEE to maintain your weight."}
            </Text>
          </>
        )}
      </Surface>

      <Surface>
        <Text style={s.h}>Protein</Text>
        {protein ? (
          <>
            <Text style={s.big}>{protein.low}–{protein.high} g / day</Text>
            <Text style={s.p}>{protein.perKg} of reference body weight. {protein.reason} Confirm the right amount with your doctor or dietitian.</Text>
          </>
        ) : (
          <Text style={s.p}>With kidney disease, pregnancy or an eating-disorder history, your care team should set your protein amount.</Text>
        )}
      </Surface>

      <Surface>
        <Text style={s.h}>How we calculate</Text>
        <Text style={s.p}>BMR: Mifflin–St Jeor (1990). TDEE: BMR × activity factor, or adaptive from intake minus the energy in your weight trend (≈7,700 kcal per kg). Protein: 1.0–1.8 g/kg depending on age, training and GLP-1 use, using a reference weight capped at BMI 27. Estimates, not measurements.</Text>
        <Pressable accessibilityRole="link" accessibilityLabel="Dietary Guidelines for Americans" onPress={() => Linking.openURL("https://www.dietaryguidelines.gov/")}>
          <Text style={s.link}>Dietary Guidelines for Americans ↗</Text>
        </Pressable>
      </Surface>
      <PrimaryButton title="Update my weight" icon="scale" onPress={() => router.push("/health")} />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  h: { color: palette.ink, fontSize: 17, fontWeight: "800", flexShrink: 1 },
  p: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  big: { color: palette.ink, fontSize: 28, fontWeight: "900", letterSpacing: -0.6 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  gauge: { flexDirection: "row", borderRadius: 6, overflow: "visible", position: "relative", marginTop: 4 },
  marker: { position: "absolute", top: -5, width: 4, height: 20, marginLeft: -2, borderRadius: 2, backgroundColor: palette.ink },
  small: { color: palette.muted, fontSize: 11, fontWeight: "700" },
  link: { color: palette.brand, fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
});
