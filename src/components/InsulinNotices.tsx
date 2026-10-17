import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useT } from "../i18n";
import { palette } from "./design";
import { soft } from "./ui";
import { insulinNotices } from "../core/insulin-safety";
import type { State } from "../core/model";

/** Low-glucose safety notices for insulin users (renders nothing for everyone else). */
export function InsulinNotices({ state, aboutToTrain }: { state: State; aboutToTrain?: boolean }) {
  const tr = useT();
  const notices = insulinNotices(state, { aboutToTrain });
  if (!notices.length) return null;
  return (
    <View style={s.box} accessibilityRole="alert">
      <View style={s.head}>
        <Ionicons name="water" size={18} color={palette.warn} />
        <Text style={s.title}>{tr("Insulin safety")}</Text>
      </View>
      {notices.map((n) => (
        <Text key={n.text} style={[s.text, n.level === "urgent" && s.urgent]}>• {tr(n.text)}</Text>
      ))}
      <Text style={s.small}>{tr("Snap to Fit never suggests or changes insulin. Follow the plan from your care team.")}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: soft("#FFF4DE"), borderRadius: 18, padding: 14, gap: 6, borderWidth: 1, borderColor: palette.warn },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  text: { color: palette.ink, fontSize: 14, lineHeight: 20 },
  urgent: { fontWeight: "800" },
  small: { color: palette.muted, fontSize: 12, lineHeight: 17 },
});
