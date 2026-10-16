// Small, crisp SVG charts: weekly bars with a target line and a weight sparkline.
import React from "react";
import { Text, View, StyleSheet } from "react-native";
import Svg, { Line, Rect, Path, Circle } from "react-native-svg";
import { palette } from "./design";

export function WeekBars({ values, labels, target, color = palette.brand, height = 140, width = 320, highlightLast = true }: {
  values: number[]; labels: string[]; target?: number | null; color?: string; height?: number; width?: number; highlightLast?: boolean;
}) {
  const max = Math.max(1, target || 0, ...values) * 1.15;
  const gap = 10;
  const bw = (width - gap * (values.length - 1)) / values.length;
  const y = (v: number) => height - (v / max) * height;
  return (
    <View accessibilityLabel={`Bar chart: ${values.map((v, i) => `${labels[i]} ${v}`).join(", ")}`}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {values.map((v, i) => {
          const over = !!target && v > target * 1.05;
          const h = Math.max(v > 0 ? 4 : 0, height - y(v));
          return <Rect key={i} x={i * (bw + gap)} y={height - h} width={bw} height={h} rx={8}
            fill={over ? palette.carbs : color} opacity={highlightLast && i === values.length - 1 ? 1 : 0.55} />;
        })}
        {target ? <Line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke={palette.ink} strokeDasharray="5 5" strokeWidth={1.5} opacity={0.45} /> : null}
      </Svg>
      <View style={c.labels}>{labels.map((l, i) => <Text key={i} style={c.label}>{l}</Text>)}</View>
    </View>
  );
}

export function Sparkline({ points, width = 320, height = 90, color = palette.brand }: { points: number[]; width?: number; height?: number; color?: string }) {
  if (points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((v, i) => [(i / (points.length - 1)) * (width - 12) + 6, height - 8 - ((v - min) / span) * (height - 16)]);
  const d = xy.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)},${yy.toFixed(1)}`).join(" ");
  const area = `${d} L${xy[xy.length - 1][0]},${height} L${xy[0][0]},${height} Z`;
  const [lx, ly] = xy[xy.length - 1];
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" accessibilityLabel="Weight trend">
      <Path d={area} fill={color} opacity={0.08} />
      <Path d={d} stroke={color} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={lx} cy={ly} r={5} fill={color} />
    </Svg>
  );
}

const c = StyleSheet.create({
  labels: { flexDirection: "row", justifyContent: "space-around", marginTop: 6 },
  label: { color: palette.muted, fontSize: 12, fontWeight: "700", flex: 1, textAlign: "center" },
});
