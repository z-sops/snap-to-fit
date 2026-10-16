import { doctorNotice, steroidNotice } from "../core/safety";
import React, { useEffect, useState } from "react";
import { useMenuInsets } from "./menu-insets";
import menuArt from "../../assets/menu-nutrition.png";
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
  Animated,
  Modal,
  AccessibilityInfo,
  Image,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useOptionalStore } from "../services/store";
import {
  activeMainTab,
  isActive,
  mainTabs,
  menuSections,
  type AppRoute,
} from "./navigation";
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
  const store = useOptionalStore();
  // Before a profile exists only onboarding/account/legal/gyms are reachable,
  // so the main tabs are hidden instead of bouncing back to onboarding.
  const hasProfile = !!store?.state.profile;
  const [menu, setMenu] = useState(false);
  const active = activeMainTab(path);
  const go = (href: AppRoute) => {
    setMenu(false);
    if (!isActive(path, href)) router.navigate(href);
  };
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.shell}>
        <View style={s.brand}>
          <Pressable
            onPress={() => setMenu(true)}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            aria-expanded={menu}
            hitSlop={8}
            style={s.iconButton}
          >
            <Ionicons name="menu" size={26} color={colors.ink} />
          </Pressable>
          <Text style={s.logo}>
            snap<Text style={{ color: colors.green }}> to fit</Text>
            <Text style={{ fontSize: 11, color: colors.green }}> ✦</Text>
          </Text>
          {hasProfile ? (
            <Pressable
              onPress={() => go("/settings")}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              hitSlop={8}
              style={s.iconButton}
            >
              <Ionicons name="settings-outline" size={24} color={colors.ink} />
            </Pressable>
          ) : (
            <View style={s.iconButton} />
          )}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          <SafetyNotice />
          {children}
          <Text style={s.footer}>Your pace. Your progress.</Text>
        </ScrollView>
        {hasProfile ? (
          <View style={s.nav} accessibilityRole="tablist">
            {mainTabs.map(({ href, label, icon }) => {
              const selected = active === href;
              return (
                <Pressable
                  key={href}
                  onPress={() => go(href)}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  aria-selected={selected}
                  style={selected ? s.navItemActive : s.navItem}
                >
                  <Ionicons
                    name={icon as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={selected ? colors.green : colors.muted}
                  />
                  <Text style={selected ? s.navLabelActive : s.navLabel}>{label}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setMenu(true)}
              accessibilityRole="button"
              accessibilityLabel="Menu"
              aria-expanded={menu}
              aria-selected={!active}
              style={!active ? s.navItemActive : s.navItem}
            >
              <Ionicons name="grid-outline" size={20} color={!active ? colors.green : colors.muted} />
              <Text style={!active ? s.navLabelActive : s.navLabel}>Menu</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <SideMenu
        open={menu}
        path={path}
        hasProfile={hasProfile}
        onClose={() => setMenu(false)}
        onGo={go}
      />
    </KeyboardAvoidingView>
  );
}
function SafetyNotice() {
  return (
    <View accessibilityRole="summary" style={s.notice}>
      <Text style={s.noticeMain}>{doctorNotice}</Text>
      <Text style={s.noticeSub}>{steroidNotice}</Text>
    </View>
  );
}
const MENU_WIDTH = 300;
function SideMenu({
  open,
  path,
  hasProfile,
  onClose,
  onGo,
}: {
  open: boolean;
  path: string;
  hasProfile: boolean;
  onClose: () => void;
  onGo: (href: AppRoute) => void;
}) {
  const [slide] = useState(() => new Animated.Value(0));
  const insets = useMenuInsets();
  // Stays mounted after `open` turns false until the slide-out finishes.
  const [mounted, setMounted] = useState(false);
  const visible = open || mounted;
  useEffect(() => {
    let cancelled = false;
    const run = (to: number, done: () => void) =>
      void AccessibilityInfo.isReduceMotionEnabled()
        .catch(() => false)
        .then((reduce) => {
          if (cancelled) return;
          if (reduce) {
            slide.setValue(to);
            done();
            return;
          }
          Animated.timing(slide, {
            toValue: to,
            duration: 220,
            useNativeDriver: Platform.OS !== "web",
          }).start(({ finished }) => finished && !cancelled && done());
        });
    if (open) run(1, () => setMounted(true));
    else run(0, () => setMounted(false));
    return () => {
      cancelled = true;
    };
  }, [open, slide]);
  if (!visible) return null;
  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-MENU_WIDTH, 0] });
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.menuRoot}>
        <Animated.View style={[s.backdrop, { opacity: slide }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close menu" />
        </Animated.View>
        <Animated.View
          style={[
            s.drawer,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 8, transform: [{ translateX }] },
          ]}
          accessibilityViewIsModal
        >
          <View style={s.drawerHead}>
            <Text style={s.drawerLogo}>
              snap<Text style={{ color: colors.green }}> to fit</Text>
              <Text style={{ fontSize: 13, color: colors.green }}> ✦</Text>
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" hitSlop={8} style={s.iconButton}>
              <Ionicons name="close" size={26} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}>
            {menuSections(hasProfile).map((section) => (
              <View key={section.title} style={{ marginTop: 14 }}>
                <Text style={s.menuSection}>{section.title}</Text>
                {section.items.map(({ href, label, icon }) => {
                  const selected = isActive(path, href);
                  return (
                    <Pressable
                      key={href}
                      onPress={() => onGo(href)}
                      accessibilityRole="link"
                      accessibilityLabel={label}
                      aria-selected={selected}
                      style={selected ? s.menuItemActive : s.menuItem}
                    >
                      <Ionicons
                        name={icon as keyof typeof Ionicons.glyphMap}
                        size={20}
                        color={selected ? colors.green : colors.ink}
                      />
                      <Text style={selected ? s.menuLabelActive : s.menuLabel}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {!hasProfile ? (
              <View style={s.menuInfo}>
                <Ionicons name="lock-open-outline" size={22} color={colors.green} />
                <Text style={s.menuInfoTitle}>Finish your profile to unlock everything</Text>
                <Text style={s.menuInfoBody}>
                  Today, Food, Move, Health, meal plans, the tracker, coach and music
                  appear here once your profile is saved. It takes about 5 minutes.
                </Text>
              </View>
            ) : null}
            <View style={s.menuNoticeBox}>
              <Text style={s.menuNotice}>{doctorNotice}</Text>
            </View>
            {/* Decorative illustration; sits at the bottom when there is room. */}
            <View style={s.menuArtWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Image source={menuArt} style={s.menuArt} resizeMode="contain" accessibilityIgnoresInvertColors />
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
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
  logo: { fontSize: 30, fontWeight: "800", letterSpacing: -1, color: colors.ink },
  drawerLogo: { fontSize: 28, fontWeight: "800", letterSpacing: -1, color: colors.ink },
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
  navItem: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 2, gap: 2 },
  navItemActive: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 16, paddingHorizontal: 2, gap: 2, backgroundColor: colors.lime },
  navLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  navLabelActive: { fontSize: 12, color: colors.green, fontWeight: "700" },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  notice: { padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: "#D89D36", backgroundColor: colors.amber, marginBottom: 18 },
  noticeMain: { color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  noticeSub: { color: colors.ink, fontSize: 11, lineHeight: 17, marginTop: 6 },
  menuRoot: { flex: 1, flexDirection: "row" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(23,33,59,0.45)" },
  drawer: { width: MENU_WIDTH, maxWidth: "85%", height: "100%", backgroundColor: "white", paddingHorizontal: 14, borderTopRightRadius: 22, borderBottomRightRadius: 22 },
  drawerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 6, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.line },
  menuSection: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, paddingHorizontal: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingHorizontal: 10, borderRadius: 12 },
  menuItemActive: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.lime },
  menuLabel: { fontSize: 15, color: colors.ink, fontWeight: "600" },
  menuLabelActive: { fontSize: 15, color: colors.green, fontWeight: "700" },
  menuNotice: { fontSize: 12, lineHeight: 17, color: colors.ink, fontWeight: "600" },
  menuNoticeBox: { marginTop: 18, padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: "#D89D36", backgroundColor: colors.amber },
  menuArtWrap: { flexGrow: 1, justifyContent: "flex-end", marginTop: 16 },
  // Explicit height: web otherwise applies the bitmap height and ignores aspectRatio.
  menuArt: { width: "100%", height: 230, opacity: 0.95 },
  menuInfo: { marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: colors.lime, gap: 6 },
  menuInfoTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  menuInfoBody: { fontSize: 13, lineHeight: 19, color: colors.muted },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: colors.muted,
    marginTop: 20,
  },
});
