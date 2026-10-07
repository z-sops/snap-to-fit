import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./ui";

// A finite entrance, never a looping attention animation. Respect the device setting.
export function MotionReveal({ children }: { children: React.ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active || reduce) return;
      opacity.setValue(0);
      animation = Animated.timing(opacity, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      });
      animation.start();
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (reduce) => {
        if (reduce) {
          animation?.stop();
          opacity.setValue(1);
        }
      },
    );
    return () => {
      active = false;
      animation?.stop();
      subscription.remove();
    };
  }, [opacity]);
  return (
    <Animated.View
      style={{
        opacity,
        transform: [
          {
            translateY: opacity.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

export function FitnessHero({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <MotionReveal>
      <View style={s.hero}>
        <View pointerEvents="none" style={s.orbit}>
          <View style={s.orbitInner}>
            <Ionicons name="fitness" size={54} color="#DDF57A" />
          </View>
        </View>
        <View style={{ zIndex: 1, maxWidth: "78%" }}>
          <Text style={s.eyebrow}>SNAP TO FIT · YOUR EVERYDAY FITNESS</Text>
          <Text style={s.heroTitle}>{title}</Text>
          <Text style={s.heroDetail}>{detail}</Text>
        </View>
        {children}
      </View>
    </MotionReveal>
  );
}
export interface ChartPoint {
  label: string;
  value: number;
  at?: number;
}
export function BarChart({
  points,
  label,
  unit,
}: {
  points: ChartPoint[];
  label: string;
  unit: string;
}) {
  const maximum = Math.max(1, ...points.map((p) => p.value));
  const [selected, setSelected] = useState<number | null>(null);
  const point = selected === null ? null : points[selected];
  return (
    <MotionReveal>
      <View
        accessibilityLabel={`${label}. ${points.map((p) => `${p.label}: ${p.value} ${unit}`).join(", ")}`}
      >
        <Text style={s.caption}>
          {point
            ? `${point.label} · ${point.value} ${unit}`
            : `${label} · ${unit}`}
        </Text>
        <View style={s.bars}>
          {points.map((p, i) => (
            <Pressable
              key={`${p.label}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${p.label}: ${p.value} ${unit}`}
              onPress={() => setSelected(i)}
              style={s.barColumn}
            >
              <Text style={s.barValue}>{p.value}</Text>
              <View style={s.barTrack}>
                <View
                  style={{
                    height: p.value > 0 ? `${(p.value / maximum) * 100}%` : 0,
                    width: "100%",
                    borderRadius: 7,
                    backgroundColor: selected === i ? "#182643" : colors.green,
                  }}
                />
              </View>
              <Text style={s.tick}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        {!points.some((p) => p.value > 0) ? (
          <Text style={s.caption}>Your chart begins with your first log.</Text>
        ) : null}
      </View>
    </MotionReveal>
  );
}
export function TrendChart({
  points,
  label,
  unit,
}: {
  points: ChartPoint[];
  label: string;
  unit: string;
}) {
  const [width, setWidth] = useState(260);
  const [selected, setSelected] = useState<number | null>(null);
  if (!points.length)
    return (
      <Text style={s.caption}>
        No {label.toLowerCase()} readings yet. Add a reading to start your
        chart.
      </Text>
    );
  const low = Math.min(...points.map((p) => p.value));
  const high = Math.max(...points.map((p) => p.value));
  const pad = Math.max((high - low) * 0.15, 0.5);
  const min = low - pad,
    max = high + pad;
  const first = points[0].at ?? 0,
    last = points.at(-1)?.at ?? points.length - 1;
  const xy = points.map((p, i) => ({
    x:
      12 +
      (last === first ? 0.5 : ((p.at ?? i) - first) / (last - first)) *
        Math.max(1, width - 24),
    y: 12 + (1 - (p.value - min) / (max - min)) * 120,
  }));
  const chosen =
    points[
      selected !== null && selected < points.length
        ? selected
        : points.length - 1
    ];
  return (
    <MotionReveal>
      <View>
        <Text style={s.caption}>
          {label} · {chosen.label} · {chosen.value} {unit}
        </Text>
        <View style={{ flexDirection: "row", marginTop: 12 }}>
          <View
            style={{ width: 48, justifyContent: "space-between", height: 144 }}
          >
            <Text style={s.tick}>{max.toFixed(1)}</Text>
            <Text style={s.tick}>{min.toFixed(1)}</Text>
          </View>
          <View
            style={{ flex: 1, height: 144 }}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            accessibilityLabel={`${label} chart. ${points.map((p) => `${p.label}: ${p.value} ${unit}`).join(", ")}`}
          >
            {[12, 72, 132].map((top) => (
              <View
                key={top}
                style={{
                  position: "absolute",
                  top,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: colors.line,
                }}
              />
            ))}
            {xy.slice(1).map((p, i) => {
              const prev = xy[i],
                dx = p.x - prev.x,
                dy = p.y - prev.y,
                length = Math.hypot(dx, dy);
              return (
                <View
                  key={`line-${i}`}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: (prev.x + p.x - length) / 2,
                    top: (prev.y + p.y) / 2 - 1.5,
                    width: length,
                    height: 3,
                    backgroundColor: colors.green,
                    transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                  }}
                />
              );
            })}
            {xy.map((p, i) => (
              <Pressable
                key={`point-${i}`}
                onPress={() => setSelected(i)}
                accessibilityRole="button"
                accessibilityLabel={`${points[i].label}: ${points[i].value} ${unit}`}
                style={{
                  position: "absolute",
                  left: p.x - 15,
                  top: p.y - 15,
                  width: 30,
                  height: 30,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: selected === i ? 13 : 9,
                    height: selected === i ? 13 : 9,
                    borderRadius: 8,
                    backgroundColor: colors.green,
                    borderWidth: 2,
                    borderColor: "white",
                  }}
                />
              </Pressable>
            ))}
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginLeft: 48,
            marginTop: 8,
          }}
        >
          <Text style={s.tick}>{points[0].label}</Text>
          {points.length > 1 ? (
            <Text style={s.tick}>{points.at(-1)?.label}</Text>
          ) : null}
        </View>
        <Text style={s.caption}>
          Tap a point to inspect. Vertical axis is scaled to your readings.
        </Text>
      </View>
    </MotionReveal>
  );
}
const s = StyleSheet.create({
  hero: {
    backgroundColor: "#172443",
    borderRadius: 26,
    padding: 24,
    marginBottom: 18,
    overflow: "hidden",
    minHeight: 228,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#DDF57A",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 31,
    lineHeight: 35,
    fontWeight: "800",
    letterSpacing: -1,
    color: "white",
    marginBottom: 12,
  },
  heroDetail: {
    fontSize: 14,
    lineHeight: 22,
    color: "#C8D2EA",
    marginBottom: 14,
  },
  orbit: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 100,
    borderWidth: 24,
    borderColor: "#324574",
    borderTopColor: "#DDF57A",
    right: -55,
    top: 12,
    transform: [{ rotate: "-25deg" }],
    opacity: 0.75,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitInner: {
    width: 114,
    height: 114,
    borderRadius: 64,
    borderWidth: 9,
    borderColor: "#576FED",
    borderRightColor: "#90A3FA",
    alignItems: "center",
    justifyContent: "center",
  },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 8 },
  bars: { flexDirection: "row", gap: 10, marginTop: 18, marginBottom: 8 },
  barColumn: { flex: 1, alignItems: "center", minWidth: 22 },
  barTrack: {
    height: 108,
    width: "100%",
    maxWidth: 40,
    borderRadius: 7,
    backgroundColor: colors.lime,
    justifyContent: "flex-end",
    marginVertical: 8,
  },
  barValue: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  tick: { color: colors.muted, fontSize: 11 },
});
