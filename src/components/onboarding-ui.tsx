import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./ui";
import { doctorNotice } from "../core/safety";
import logoMark from "../../assets/logo-mark.png";

export const theme = {
  ink: colors.ink,
  muted: colors.muted,
  brand: colors.green, // electric blue (historic token name)
  brandSoft: colors.lime,
  bg: colors.card,
  surface: colors.bg,
  line: colors.line,
  protein: "#F26B5B",
  carbs: "#F2B63D",
  fat: "#7C5CF2",
  fiber: "#34B37A",
};

export function Logo({ size = 72 }: { size?: number }) {
  return (
    <Image
      source={logoMark}
      style={{ width: size, height: size, borderRadius: size * 0.23 }}
      accessibilityLabel="Snap to Fit logo"
    />
  );
}

/** Full-screen step: back arrow, "Step n of m", progress bar, big question, pinned Continue. */
export function StepShell({
  step,
  total,
  title,
  subtitle,
  onBack,
  onClose,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  children,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onClose?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={st.shell}>
      <View style={st.top}>
        <View style={st.topRow}>
          {onBack ? (
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Previous step" hitSlop={10} style={st.iconBtn}>
              <Ionicons name="arrow-back" size={24} color={theme.ink} />
            </Pressable>
          ) : (
            <View style={st.iconBtn} />
          )}
          <Text style={st.stepLabel}>Step {step} of {total}</Text>
          {onClose ? (
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close setup" hitSlop={10} style={st.iconBtn}>
              <Ionicons name="close" size={24} color={theme.ink} />
            </Pressable>
          ) : (
            <View style={st.iconBtn} />
          )}
        </View>
        <View style={st.track} accessibilityRole="progressbar" aria-valuenow={step} aria-valuemax={total}>
          <View style={[st.fill, { width: `${Math.round((step / total) * 100)}%` }]} />
        </View>
      </View>
      <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
        <Text style={st.title} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={st.subtitle}>{subtitle}</Text> : null}
        <View style={{ marginTop: 22 }}>{children}</View>
      </ScrollView>
      <View style={st.bottom}>
        <Pressable
          onPress={onNext}
          disabled={nextDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!nextDisabled }}
          style={[st.cta, nextDisabled && { opacity: 0.45 }]}
        >
          <Text style={st.ctaText}>{nextLabel}</Text>
        </Pressable>
        <Text style={st.notice}>{doctorNotice}</Text>
      </View>
    </View>
  );
}

/** Big selectable card (single or multi select). */
export function OptionCard({
  label,
  detail,
  emoji,
  selected,
  onPress,
  multi,
}: {
  label: string;
  detail?: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityLabel={label}
      accessibilityState={multi ? { checked: selected } : { selected }}
      aria-checked={selected}
      style={selected ? st.optionOn : st.option}
    >
      <View style={{ flex: 1 }}>
        <Text style={selected ? st.optionLabelOn : st.optionLabel}>{label}</Text>
        {detail ? <Text style={selected ? st.optionDetailOn : st.optionDetail}>{detail}</Text> : null}
      </View>
      {emoji ? <Text style={st.emoji}>{emoji}</Text> : null}
      {multi ? (
        <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={24} color={selected ? "white" : theme.muted} />
      ) : null}
    </Pressable>
  );
}

/** Two-way segmented switch, e.g. lb | kg. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={st.seg} accessibilityRole="radiogroup">
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          accessibilityRole="radio"
          accessibilityLabel={o.label}
          aria-checked={value === o.value}
          style={value === o.value ? st.segOn : st.segItem}
        >
          <Text style={value === o.value ? st.segTextOn : st.segText}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const ITEM_H = 52;
const VISIBLE = 5;

/**
 * Scroll wheel with a large highlighted centre value (as in the references).
 * Minus/plus buttons give an accessible and precise alternative to scrolling.
 */
export function WheelPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
    // Only re-centre when the option list changes (e.g. unit switch) or on mount.
  }, [ready, options]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i: number) => {
    const clamped = Math.min(options.length - 1, Math.max(0, i));
    if (options[clamped] && options[clamped].value !== value) onChange(options[clamped].value);
    return clamped;
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => pick(Math.round(y / ITEM_H)), Platform.OS === "web" ? 140 : 60);
  };
  const step = (d: number) => {
    const i = pick(index + d);
    ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
  };

  return (
    <View style={st.wheelWrap}>
      <Text style={st.bigValue} accessibilityLiveRegion="polite">{options[index]?.label}</Text>
      <View style={st.wheelRow}>
        <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} style={st.stepBtn}>
          <Ionicons name="remove" size={22} color={theme.ink} />
        </Pressable>
        <View
          style={st.wheel}
          onLayout={() => setReady(true)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: options[index]?.label }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
        >
          <View pointerEvents="none" style={st.wheelBand} />
          <ScrollView
            ref={ref}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_H}
            decelerationRate="fast"
            onScroll={onScroll}
            scrollEventThrottle={32}
            nestedScrollEnabled
            contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
          >
            {options.map((o, i) => {
              const d = Math.abs(i - index);
              return (
                <Pressable key={o.value} onPress={() => { pick(i); ref.current?.scrollTo({ y: i * ITEM_H, animated: true }); }} style={st.wheelItem}>
                  <Text style={[st.wheelText, d === 0 ? st.wheelTextOn : { opacity: d === 1 ? 0.55 : 0.25 }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <Pressable onPress={() => step(1)} accessibilityRole="button" accessibilityLabel={`Increase ${label}`} style={st.stepBtn}>
          <Ionicons name="add" size={22} color={theme.ink} />
        </Pressable>
      </View>
    </View>
  );
}

/** Ring built from plain Views (two rotating halves) — no native SVG module needed. */
export function ProgressRing({
  size,
  stroke,
  progress,
  color,
  track = theme.line,
  children,
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const half = size / 2;
  const ring = { width: size, height: size, borderRadius: half, borderWidth: stroke };
  // Each half-ring starts hidden and rotates clockwise into its half: 12→6 o'clock
  // on the right, then 6→12 o'clock on the left.
  const rightDeg = Math.min(p, 0.5) * 360; // 0..180
  const leftDeg = Math.max(0, p - 0.5) * 360; // 0..180
  return (
    <View style={{ width: size, height: size }}>
      <View style={[ring, { position: "absolute", borderColor: track }]} />
      {/* right half */}
      <View style={{ position: "absolute", width: half, height: size, left: half, overflow: "hidden" }}>
        <View style={{ width: size, height: size, left: -half, transform: [{ rotate: `${rightDeg}deg` }] }}>
          <View style={{ width: half, height: size, overflow: "hidden" }}>
            <View style={[ring, { borderColor: color }]} />
          </View>
        </View>
      </View>
      {/* left half */}
      <View style={{ position: "absolute", width: half, height: size, left: 0, overflow: "hidden" }}>
        <View style={{ width: size, height: size, transform: [{ rotate: `${leftDeg}deg` }] }}>
          <View style={{ width: half, height: size, left: half, overflow: "hidden" }}>
            <View style={[ring, { borderColor: color, left: -half }]} />
          </View>
        </View>
      </View>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>{children}</View>
    </View>
  );
}

/** Counts a number up once on mount; instant when reduce-motion is on. */
export function useCountUp(target: number, ms = 900) {
  const [value, setValue] = useState(target);
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let active = true;
    const id = anim.addListener(({ value: v }) => active && setValue(Math.round(v * target)));
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => true)
      .then((reduce) => {
        if (!active) return;
        if (reduce) return setValue(target);
        anim.setValue(0);
        Animated.timing(anim, { toValue: 1, duration: ms, useNativeDriver: false }).start();
      });
    return () => {
      active = false;
      anim.removeListener(id);
    };
  }, [target, ms, anim]);
  return value;
}

const st = StyleSheet.create({
  shell: { flex: 1, backgroundColor: theme.bg },
  top: { paddingHorizontal: 16, paddingTop: 8 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stepLabel: { fontSize: 14, fontWeight: "700", color: theme.ink },
  track: { height: 5, borderRadius: 3, backgroundColor: theme.surface, marginTop: 6, marginHorizontal: 56, overflow: "hidden" },
  fill: { height: 5, borderRadius: 3, backgroundColor: theme.brand },
  body: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 24, maxWidth: 560, width: "100%", alignSelf: "center" },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "800", color: theme.ink, textAlign: "center", letterSpacing: -0.6 },
  subtitle: { fontSize: 15, lineHeight: 22, color: theme.muted, textAlign: "center", marginTop: 10 },
  bottom: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderColor: theme.surface, maxWidth: 560, width: "100%", alignSelf: "center" },
  cta: { backgroundColor: theme.brand, minHeight: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "white", fontSize: 17, fontWeight: "800" },
  notice: { fontSize: 11, lineHeight: 15, color: theme.muted, textAlign: "center", marginTop: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 18, backgroundColor: theme.surface, marginBottom: 12, borderWidth: 2, borderColor: theme.surface },
  optionOn: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 18, backgroundColor: theme.brand, marginBottom: 12, borderWidth: 2, borderColor: theme.brand },
  optionLabel: { fontSize: 17, fontWeight: "700", color: theme.ink },
  optionLabelOn: { fontSize: 17, fontWeight: "800", color: "white" },
  optionDetail: { fontSize: 13, lineHeight: 18, color: theme.muted, marginTop: 3 },
  optionDetailOn: { fontSize: 13, lineHeight: 18, color: "#E3E9FF", marginTop: 3 },
  emoji: { fontSize: 28 },
  seg: { flexDirection: "row", alignSelf: "center", backgroundColor: theme.surface, borderRadius: 14, padding: 4, marginBottom: 18 },
  segItem: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 11 },
  segOn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 11, backgroundColor: colors.card },
  segText: { fontSize: 15, fontWeight: "700", color: theme.muted },
  segTextOn: { fontSize: 15, fontWeight: "800", color: theme.ink },
  wheelWrap: { alignItems: "center" },
  bigValue: { fontSize: 44, fontWeight: "800", color: theme.ink, letterSpacing: -1, marginBottom: 12 },
  wheelRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  wheel: { width: 180, height: ITEM_H * VISIBLE, overflow: "hidden" },
  wheelBand: { position: "absolute", left: 0, right: 0, top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H, borderRadius: 14, backgroundColor: theme.brandSoft },
  wheelItem: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  wheelText: { fontSize: 20, fontWeight: "600", color: theme.ink },
  wheelTextOn: { fontSize: 24, fontWeight: "800", color: theme.brand },
});
