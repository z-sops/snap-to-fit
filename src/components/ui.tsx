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
  BackHandler,
  Appearance,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useOptionalStore } from "../services/store";
import { useT, translateActive } from "../i18n";
import {
  activeMainTab,
  isActive,
  mainTabs,
  menuSections,
  normalizePath,
  type AppRoute,
} from "./navigation";
import { Ionicons } from "@expo/vector-icons";
/** Pastel tint in light mode; a faint wash of the same hue on dark backgrounds. */
export const soft = (hex: string) => (Appearance.getColorScheme() === "dark" ? `${hex}24` : hex);
/** Follows the phone's light/dark setting at launch. */
export const isDark = Appearance.getColorScheme() === "dark";
export const colors = isDark
  ? { ink: "#EEF2FA", muted: "#9AA6BF", green: "#6B8CFF", lime: "#1C2A55", bg: "#0B1220", line: "#26324A", amber: "#2A2213", card: "#141D31", hairline: "#1F2A42" }
  : { ink: "#17213B", muted: "#5D6880", green: "#355AF4", lime: "#EEF2FF", bg: "#F4F6FA", line: "#E2E7F0", amber: "#FFF6E7", card: "#FFFFFF", hairline: "#EDF0F6" };
export function notify(raw: string) {
  const message = translateActive(raw);
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
/** Screens without their own back step: main tabs and first-run onboarding. */
const noBackBar = ["/", "/food", "/move", "/health", "/onboarding"];

export function Screen({
  children,
  title,
  subtitle,
  onBack,
  backLabel,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** In-screen back step (e.g. topic → list). Also handles the Android back key. */
  onBack?: () => void;
  backLabel?: string;
}) {
  const path = usePathname();
  const store = useOptionalStore();
  // Before a profile exists only onboarding/account/legal/gyms are reachable,
  // so the main tabs are hidden instead of bouncing back to onboarding.
  const hasProfile = !!store?.state.profile;
  const [menu, setMenu] = useState(false);
  const active = activeMainTab(path);
  const tr = useT();
  const go = (href: AppRoute) => {
    setMenu(false);
    if (!isActive(path, href)) router.navigate(href);
  };
  const showBack = !!onBack || (hasProfile && !noBackBar.includes(normalizePath(path)));
  const back = () => {
    if (onBack) return onBack();
    if (router.canGoBack?.()) router.back();
    else router.navigate("/");
  };
  useEffect(() => {
    if (!onBack || Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
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
            accessibilityLabel={tr("Open menu")}
            aria-expanded={menu}
            hitSlop={8}
            style={s.iconButton}
          >
            <Ionicons name="menu" size={26} color={colors.ink} />
          </Pressable>
          <Text style={s.logo}>
            snap<Text style={{ color: colors.green }}> to fit</Text>
            <Text style={{ fontSize: 14, color: colors.green }}> ✦</Text>
          </Text>
          {hasProfile ? (
            <Pressable
              onPress={() => go("/settings")}
              accessibilityRole="button"
              accessibilityLabel={tr("Open settings")}
              hitSlop={8}
              style={s.iconButton}
            >
              <Ionicons name="settings-outline" size={24} color={colors.ink} />
            </Pressable>
          ) : (
            <View style={s.iconButton} />
          )}
        </View>
        {showBack ? (
          <View style={s.backBar}>
            <Pressable
              onPress={back}
              accessibilityRole="button"
              accessibilityLabel={tr(backLabel || tr("Back"))}
              hitSlop={8}
              style={s.backBtn}
            >
              <Ionicons name="chevron-back" size={20} color={colors.green} />
              <Text style={s.backText}>{tr(backLabel || tr("Back"))}</Text>
            </Pressable>
          </View>
        ) : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          <Text style={s.title}>{tr(title)}</Text>
          {subtitle ? <Text style={s.subtitle}>{tr(subtitle)}</Text> : null}
          <SafetyNotice />
          {children}
          <Text style={s.footer}>{tr("Your pace. Your progress.")}</Text>
        </ScrollView>
        {hasProfile ? (
          <View style={s.nav} accessibilityRole="tablist">
            {mainTabs.slice(0, 2).map((t) => (
              <NavTab key={t.href} item={t} selected={active === t.href} onPress={() => go(t.href)} />
            ))}
            <View style={s.snapSlot}>
              <Pressable
                onPress={() => {
                  setMenu(false);
                  // Opens the camera straight away on the Food screen.
                  router.navigate({ pathname: "/food", params: { snap: String(Date.now()) } });
                }}
                accessibilityRole="button"
                accessibilityLabel={tr("Snap a meal")}
                style={s.snapBtn}
              >
                <Ionicons name="camera" size={28} color="white" />
              </Pressable>
              <Text style={s.snapLabel}>{tr("Snap")}</Text>
            </View>
            {mainTabs.slice(2).map((t) => (
              <NavTab key={t.href} item={t} selected={active === t.href} onPress={() => go(t.href)} />
            ))}
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
function NavTab({ item, selected, onPress }: { item: (typeof mainTabs)[number]; selected: boolean; onPress: () => void }) {
  const tr = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={tr(item.label)}
      aria-selected={selected}
      style={selected ? s.navItemActive : s.navItem}
    >
      <Ionicons
        name={item.icon as keyof typeof Ionicons.glyphMap}
        size={20}
        color={selected ? colors.green : colors.muted}
      />
      <Text style={selected ? s.navLabelActive : s.navLabel}>{tr(item.label)}</Text>
    </Pressable>
  );
}
/** Compact doctor notice on every screen: one line, tap to read the full text. */
function SafetyNotice() {
  const [open, setOpen] = useState(false);
  const tr = useT();
  return (
    <Pressable accessibilityRole="button" aria-expanded={open} accessibilityLabel={tr(open ? tr("Hide safety notice") : tr("Show safety notice"))}
      onPress={() => setOpen(!open)} style={[s.notice, !open && s.noticeCompact]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="information-circle-outline" size={18} color={isDark ? "#F5C26B" : "#9A5B00"} />
        <Text style={[s.noticeMain, { flex: 1 }]} numberOfLines={open ? undefined : 1}>{tr(doctorNotice)}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={isDark ? "#F5C26B" : "#9A5B00"} />
      </View>
      {open ? <Text style={s.noticeSub}>{tr(steroidNotice)}</Text> : null}
    </Pressable>
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
  const tr = useT();
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
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={tr("Close menu")} />
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
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={tr("Close menu")} hitSlop={8} style={s.iconButton}>
              <Ionicons name="close" size={26} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}>
            {menuSections(hasProfile).map((section) => (
              <View key={section.title} style={{ marginTop: 14 }}>
                <Text style={s.menuSection}>{tr(section.title)}</Text>
                {section.items.map(({ href, label, icon }) => {
                  const selected = isActive(path, href);
                  return (
                    <Pressable
                      key={href}
                      onPress={() => onGo(href)}
                      accessibilityRole="link"
                      accessibilityLabel={tr(label)}
                      aria-selected={selected}
                      style={selected ? s.menuItemActive : s.menuItem}
                    >
                      <Ionicons
                        name={icon as keyof typeof Ionicons.glyphMap}
                        size={20}
                        color={selected ? colors.green : colors.ink}
                      />
                      <Text style={selected ? s.menuLabelActive : s.menuLabel}>{tr(label)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {!hasProfile ? (
              <View style={s.menuInfo}>
                <Ionicons name="lock-open-outline" size={22} color={colors.green} />
                <Text style={s.menuInfoTitle}>{tr("Finish your profile to unlock everything")}</Text>
                <Text style={s.menuInfoBody}>{tr("Today, Food, Move, Health, meal plans, the tracker, coach and music appear here once your profile is saved. It takes about 5 minutes.")}</Text>
              </View>
            ) : null}
            <View style={s.menuNoticeBox}>
              <Text style={s.menuNotice}>{tr(doctorNotice)}</Text>
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
  const tr = useT();
  return <Text style={s.heading}>{typeof children === "string" ? tr(children) : children}</Text>;
}
export function P({ children }: { children: React.ReactNode }) {
  const tr = useT();
  return <Text style={s.body}>{typeof children === "string" ? tr(children) : children}</Text>;
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
  const tr = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr(title)}
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
        {tr(title)}
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
  const tr = useT();
  return (
    <View style={{ marginBottom: 14, flexGrow: 1 }}>
      <Text style={s.label}>{tr(label)}</Text>
      <TextInput
        accessibilityLabel={tr(label)}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        secureTextEntry={secret}
        placeholder={placeholder ? tr(placeholder) : undefined}
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
  const tr = useT();
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
              color: selected === v.value ? (isDark ? colors.bg : "white") : colors.ink,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {tr(v.label)}
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
  const tr = useT();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={tr(label)}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{ flexDirection: "row", gap: 12, paddingVertical: 12 }}
    >
      <Ionicons
        name={value ? "checkbox" : "square-outline"}
        size={24}
        color={colors.green}
      />
      <Text style={[s.body, { flex: 1 }]}>{tr(label)}</Text>
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
  const tr = useT();
  return (
    <View style={{ flex: 1, minWidth: 80 }}>
      <Text style={s.metric}>
        {value}
        <Text style={{ fontSize: 13, color: colors.muted }}> {unit}</Text>
      </Text>
      <Text style={s.label}>{tr(label)}</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  logo: { fontSize: 34, fontWeight: "800", letterSpacing: -1, color: colors.ink },
  drawerLogo: { fontSize: 31, fontWeight: "800", letterSpacing: -1, color: colors.ink },
  content: { padding: 20, paddingBottom: 28 },
  title: {
    fontSize: 32,
    fontWeight: "900",
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
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: 14,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 6px 24px rgba(23,33,59,0.06)" } as object)
      : { shadowColor: "#17213B", shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: isDark ? 0 : 1 }),
  },
  heading: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: colors.ink,
    marginBottom: 10,
  },
  body: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: 10 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "center",
  },
  button: {
    backgroundColor: colors.green,
    borderRadius: 18,
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  buttonText: { color: "white", fontWeight: "800", fontSize: 16 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14,
    fontSize: 16,
    color: colors.ink,
    minHeight: 48,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 15 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 15,
    paddingVertical: 10,
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
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  navItem: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 2, gap: 2 },
  navItemActive: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 16, paddingHorizontal: 2, gap: 2, backgroundColor: colors.lime },
  snapSlot: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  snapBtn: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", marginTop: -30, borderWidth: 5, borderColor: "white", shadowColor: "#17213B", shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  snapLabel: { fontSize: 12, fontWeight: "800", color: colors.ink, marginTop: 2 },
  navLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  navLabelActive: { fontSize: 12, color: colors.green, fontWeight: "700" },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backBar: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2, backgroundColor: colors.bg },
  backBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 2, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 999, backgroundColor: colors.lime },
  backText: { color: colors.green, fontSize: 15, fontWeight: "700" },
  notice: { padding: 12, borderRadius: 14, backgroundColor: colors.amber, marginBottom: 16 },
  noticeCompact: { paddingVertical: 8 },
  noticeMain: { color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  noticeSub: { color: colors.ink, fontSize: 11, lineHeight: 17, marginTop: 6 },
  menuRoot: { flex: 1, flexDirection: "row" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(23,33,59,0.45)" },
  drawer: { width: MENU_WIDTH, maxWidth: "85%", height: "100%", backgroundColor: colors.card, paddingHorizontal: 14, borderTopRightRadius: 22, borderBottomRightRadius: 22 },
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
