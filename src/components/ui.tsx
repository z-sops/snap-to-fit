import { doctorNotice, steroidNotice } from "../core/safety";
import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Link, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
export const colors = {
  ink: "#17213B",
  muted: "#5D6880",
  green: "#355AF4",
  lime: "#EEF2FF",
  bg: "#F4F6FA",
  line: "#E2E7F0",
  amber: "#FFF6E7",
};
export function notify(message: string) {
  if (Platform.OS === "web") window.alert(message);
  else Alert.alert("Snap to Fit", message);
}
export async function act(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    notify(e instanceof Error ? e.message : "Something went wrong. Try again.");
  }
}
export function Screen({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const nav = [
    ["/", "Today"], ["/food", "Food"], ["/move", "Move"], ["/health", "Health"],
  ] as const;
  const moreRoute = !nav.some(([href]) => href === path);
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.shell}>
        <View style={s.brand}>
          <Text style={s.logo}>
            snap<Text style={{ color: colors.green }}> to fit</Text>
            <Text style={{ fontSize: 11, color: colors.green }}> ✦</Text>
          </Text>
          <Link href="/settings" accessibilityLabel="Open settings">
            <Ionicons name="settings-outline" size={24} color={colors.ink} />
          </Link>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          <View
            accessibilityRole="summary"
            style={{
              padding: 12,
              borderRadius: 12,
              borderLeftWidth: 3,
              borderLeftColor: "#D89D36",
              backgroundColor: colors.amber,
              marginBottom: 18,
            }}
          >
            <Text
              style={{
                color: colors.ink,
                fontSize: 12,
                lineHeight: 18,
                fontWeight: "600",
              }}
            >
              {doctorNotice}
            </Text>
            <Text
              style={{
                color: colors.ink,
                fontSize: 11,
                lineHeight: 17,
                marginTop: 6,
              }}
            >
              {steroidNotice}
            </Text>
          </View>
          {children}
          <Text style={s.footer}>Your pace. Your progress.</Text>
        </ScrollView>
        {more ? <View style={{ backgroundColor: "white", padding: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {([["/metabolic", "Tracker"], ["/coach", "Coach"], ["/meal-plan", "Meal plan"], ["/gyms", "Gyms"], ["/music", "Music"], ["/settings", "Settings"]] as const).map(([href, label]) =>
            <Link key={href} href={href} asChild><Pressable onPress={() => setMore(false)} accessibilityRole="button" accessibilityLabel={label}
              style={{ minHeight: 48, minWidth: 88, padding: 14, borderRadius: 12, backgroundColor: colors.bg }}><Text style={{ color: colors.ink, fontWeight: "600" }}>{label}</Text></Pressable></Link>)}
        </View> : null}
        <View style={s.nav}>
          {nav.map(([href, label]) => (
            <Link key={href} href={href} asChild>
              <Pressable
                style={[
                  s.navItem,
                  path === href && {
                    backgroundColor: colors.lime,
                    borderRadius: 16,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: path === href }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: path === href ? colors.green : colors.muted,
                    fontWeight: "600",
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            </Link>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="More" accessibilityState={{ expanded: more, selected: moreRoute }} onPress={() => setMore(!more)} style={[s.navItem, (more || moreRoute) && { backgroundColor: colors.lime }]}>
            <Text style={{ fontSize: 12, color: more || moreRoute ? colors.green : colors.muted, fontWeight: "700" }}>More</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
export function Card({
  children,
  tint = false,
}: {
  children: React.ReactNode;
  tint?: boolean;
}) {
  return (
    <View
      style={[
        s.card,
        tint && { backgroundColor: colors.lime, borderColor: colors.lime },
      ]}
    >
      {children}
    </View>
  );
}
export function H({ children }: { children: React.ReactNode }) {
  return <Text style={s.heading}>{children}</Text>;
}
export function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.body}>{children}</Text>;
}
export function Row({ children }: { children: React.ReactNode }) {
  return <View style={s.row}>{children}</View>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        secondary && {
          backgroundColor: "transparent",
          borderColor: colors.line,
          borderWidth: 1,
        },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  numeric = false,
  placeholder,
  secret = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  numeric?: boolean;
  placeholder?: string;
  secret?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14, flexGrow: 1 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        secureTextEntry={secret}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={s.input}
        autoCapitalize="none"
      />
    </View>
  );
}
export function Chips<T extends string | number>({
  values,
  selected,
  onChange,
}: {
  values: readonly { value: T; label: string }[];
  selected: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.chips}>
      {values.map((v) => (
        <Pressable
          key={String(v.value)}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === v.value }}
          onPress={() => onChange(v.value)}
          style={[
            s.chip,
            selected === v.value && {
              backgroundColor: colors.ink,
              borderColor: colors.ink,
            },
          ]}
        >
          <Text
            style={{
              color: selected === v.value ? "white" : colors.ink,
              fontSize: 13,
            }}
          >
            {v.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{ flexDirection: "row", gap: 12, paddingVertical: 12 }}
    >
      <Ionicons
        name={value ? "checkbox" : "square-outline"}
        size={24}
        color={colors.green}
      />
      <Text style={[s.body, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}
export function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 80 }}>
      <Text style={s.metric}>
        {value}
        <Text style={{ fontSize: 13, color: colors.muted }}> {unit}</Text>
      </Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}
export function Progress({ value, total }: { value: number; total: number }) {
  return (
    <View
      style={{
        height: 7,
        backgroundColor: colors.line,
        borderRadius: 8,
        marginVertical: 12,
      }}
    >
      <View
        style={{
          width: `${Math.min(100, Math.max(0, (value / total) * 100))}%`,
          height: 7,
          backgroundColor: colors.green,
          borderRadius: 8,
        }}
      />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  shell: { flex: 1, width: "100%", maxWidth: 800, alignSelf: "center" },
  brand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  logo: { fontSize: 25, fontWeight: "800", letterSpacing: -1 },
  content: { padding: 20, paddingBottom: 28 },
  title: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.ink,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.muted,
    marginBottom: 24,
  },
  card: {
    padding: 22,
    borderRadius: 22,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 16,
  },
  heading: {
    fontSize: 21,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 12,
  },
  body: { fontSize: 15, lineHeight: 24, color: colors.muted, marginBottom: 10 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "center",
  },
  button: {
    backgroundColor: colors.green,
    borderRadius: 15,
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  buttonText: { color: "white", fontWeight: "700", fontSize: 15 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.ink,
    minHeight: 48,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 15 },
  chip: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  metric: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 6,
  },
  nav: {
    flexDirection: "row",
    paddingBottom: 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  navItem: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 2 },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: colors.muted,
    marginTop: 20,
  },
});
