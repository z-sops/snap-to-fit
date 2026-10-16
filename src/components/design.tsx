// Shared visual building blocks for the redesigned feature homes: surfaces with soft
// shadows, pills, section headers, stat tiles, macro bars, steppers and bottom sheets.
import React from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, isDark } from "./ui";
import { useMenuInsets } from "./menu-insets";
import { useT } from "../i18n";

export const palette = {
  ink: colors.ink,
  muted: colors.muted,
  brand: colors.green,
  brandSoft: colors.lime,
  bg: colors.bg,
  card: colors.card,
  hairline: colors.hairline,
  line: colors.line,
  protein: "#F26B5B",
  carbs: "#F2B63D",
  fat: "#7C5CF2",
  fiber: "#34B37A",
  good: isDark ? "#4ADE80" : "#1E7A47",
  goodSoft: isDark ? "#11291C" : "#E7F6EE",
  warn: isDark ? "#F5C26B" : "#9A5B00",
  warnSoft: isDark ? "#2A2213" : "#FFF4DE",
  bad: isDark ? "#FF8A7A" : "#B42318",
  badSoft: isDark ? "#2E1414" : "#FDECEC",
  night: isDark ? "#1A2440" : "#111A2E",
};

const shadow: ViewStyle = Platform.select({
  web: { boxShadow: "0 6px 24px rgba(23,33,59,0.07)" } as ViewStyle,
  default: { shadowColor: "#17213B", shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
}) as ViewStyle;

export function Surface({ children, style, dark }: { children: React.ReactNode; style?: ViewStyle; dark?: boolean }) {
  return <View style={[d.surface, shadow, dark && { backgroundColor: palette.night, borderColor: palette.night }, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const tr = useT();
  return (
    <View style={d.sectionRow}>
      <Text style={d.sectionTitle}>{tr(title)}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={tr(action)} onPress={onAction} hitSlop={8}>
          <Text style={d.sectionAction}>{tr(action)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Pill({ label, color = palette.brand, bg = palette.brandSoft, icon }: { label: string; color?: string; bg?: string; icon?: string }) {
  const tr = useT();
  return (
    <View style={[d.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon as never} size={12} color={color} /> : null}
      <Text style={[d.pillText, { color }]}>{tr(label)}</Text>
    </View>
  );
}

export function StatTile({ label, value, unit, color = palette.ink, bg = palette.card }: { label: string; value: string | number; unit?: string; color?: string; bg?: string }) {
  const tr = useT();
  return (
    <View style={[d.tile, { backgroundColor: bg }]} accessibilityLabel={`${label} ${value}${unit ? ` ${unit}` : ""}`}>
      <Text style={d.tileLabel}>{tr(label)}</Text>
      <Text style={[d.tileValue, { color }]}>
        {value}
        {unit ? <Text style={d.tileUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

/** Horizontal progress bar; `over` turns it amber when a limit is passed. */
export function Bar({ value, total, color, height = 8 }: { value: number; total: number; color: string; height?: number }) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={[d.barTrack, { height, borderRadius: height }]}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

export function MacroBar({ label, value, total, color, unit = "g" }: { label: string; value: number; total?: number; color: string; unit?: string }) {
  const tr = useT();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={d.macroLabel}>{tr(label)}</Text>
      <Bar value={value} total={total || value || 1} color={color} />
      <Text style={d.macroValue}>
        {Math.round(value)}
        {total ? <Text style={d.macroTotal}> / {Math.round(total)}{unit}</Text> : <Text style={d.macroTotal}>{unit}</Text>}
      </Text>
    </View>
  );
}

export function Stepper({ value, onChange, step = 0.5, min = 0.25, max = 20, label }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; label: string }) {
  const tr = useT();
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, ""));
  return (
    <View style={d.stepper} accessibilityLabel={`${label}: ${fmt(value)}`}>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("Less {label}", { label: tr(label) })} onPress={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))} style={d.stepBtn}>
        <Ionicons name="remove" size={20} color={palette.ink} />
      </Pressable>
      <Text style={d.stepValue}>{fmt(value)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("More {label}", { label: tr(label) })} onPress={() => onChange(Math.min(max, Math.round((value + step) * 100) / 100))} style={d.stepBtn}>
        <Ionicons name="add" size={20} color={palette.ink} />
      </Pressable>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const tr = useT();
  return (
    <Pressable accessibilityRole="button" aria-selected={!!selected} accessibilityLabel={tr(label)} onPress={onPress}
      style={[d.chip, selected && { backgroundColor: palette.ink, borderColor: palette.ink }]}>
      <Text style={[d.chipText, selected && { color: isDark ? palette.bg : "#fff" }]}>{tr(label)}</Text>
    </Pressable>
  );
}

export function PrimaryButton({ title, onPress, disabled, icon }: { title: string; onPress: () => void; disabled?: boolean; icon?: string }) {
  const tr = useT();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={tr(title)} disabled={disabled} onPress={onPress}
      style={[d.primary, disabled && { opacity: 0.45 }]}>
      {icon ? <Ionicons name={icon as never} size={20} color="#fff" /> : null}
      <Text style={d.primaryText}>{tr(title)}</Text>
    </Pressable>
  );
}

/** Full-height sheet with its own header and Back/Close, used for add-food flows. */
export function Sheet({ visible, title, onClose, children, footer, closeLabel = "Close" }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; closeLabel?: string }) {
  const insets = useMenuInsets();
  const tr = useT();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}>
      <View style={[d.sheet, { paddingTop: Platform.OS === "ios" ? 12 : insets.top + 8 }]}>
        <View style={d.sheetHead}>
          <Pressable accessibilityRole="button" accessibilityLabel={tr(closeLabel)} onPress={onClose} hitSlop={10} style={d.sheetClose}>
            <Ionicons name={closeLabel === "Back" ? "chevron-back" : "close"} size={24} color={palette.ink} />
          </Pressable>
          <Text style={d.sheetTitle} numberOfLines={1}>{tr(title)}</Text>
          <View style={d.sheetClose} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={d.sheetBody}>{children}</ScrollView>
        {footer ? <View style={[d.sheetFoot, { paddingBottom: insets.bottom + 12 }]}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

const d = StyleSheet.create({
  surface: { backgroundColor: palette.card, borderRadius: 24, borderWidth: 1, borderColor: palette.hairline, padding: 18, gap: 12 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  sectionTitle: { color: palette.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  sectionAction: { color: palette.brand, fontSize: 15, fontWeight: "700" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: "800" },
  tile: { flex: 1, borderRadius: 18, padding: 12, gap: 2, borderWidth: 1, borderColor: palette.hairline },
  tileLabel: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  tileValue: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  tileUnit: { fontSize: 13, fontWeight: "700", color: palette.muted },
  barTrack: { backgroundColor: palette.hairline, overflow: "hidden" },
  macroLabel: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  macroValue: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  macroTotal: { color: palette.muted, fontSize: 12, fontWeight: "600" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: palette.bg, borderRadius: 999, padding: 4 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.card, alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 44, textAlign: "center", color: palette.ink, fontSize: 18, fontWeight: "800" },
  chip: { borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { color: palette.ink, fontSize: 14, fontWeight: "700" },
  primary: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.brand, borderRadius: 18, paddingVertical: 16 },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  sheet: { flex: 1, backgroundColor: palette.bg },
  sheetHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8 },
  sheetClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sheetTitle: { flex: 1, textAlign: "center", color: palette.ink, fontSize: 17, fontWeight: "800" },
  sheetBody: { padding: 16, gap: 14, paddingBottom: 32 },
  sheetFoot: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderColor: palette.line, backgroundColor: palette.card },
});
