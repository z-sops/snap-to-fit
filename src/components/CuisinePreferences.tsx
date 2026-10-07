import React, { useState } from "react";
import { View, Pressable, Text } from "react-native";
import { H, P, Button, colors } from "./ui";
import type { CuisinePreference } from "../core/planning-types";
export const cuisineOptions = [
  { value: "american", label: "American" }, { value: "british", label: "UK / British" },
  { value: "mexican", label: "Mexican" },
  { value: "asian-indian", label: "Indian" }, { value: "asian-chinese", label: "Chinese" },
  { value: "asian-japanese", label: "Japanese" }, { value: "asian-thai", label: "Thai" },
] as const;
export function cuisineLabel(value?: CuisinePreference) {
  return cuisineOptions.find(option => option.value === (value || "american"))?.label || "American";
}
export function CuisinePreferences({ value = "american", onChange }: { value?: CuisinePreference; onChange: (value: CuisinePreference) => void }) {
  const [open, setOpen] = useState(false);
  const [asian, setAsian] = useState(value.startsWith("asian-"));
  const option = (v: CuisinePreference, label: string) => <Pressable key={v} accessibilityRole="radio"
    accessibilityState={{ selected: value === v }} accessibilityLabel={label} onPress={() => { onChange(v); setOpen(false); }}
    style={{ minHeight: 48, justifyContent: "center", padding: 14, borderRadius: 12, backgroundColor: value === v ? colors.lime : colors.bg, marginBottom: 8 }}>
    <Text style={{ color: colors.ink, fontWeight: "600" }}>{label}{value === v ? " ✓" : ""}</Text>
  </Pressable>;
  return <>
    <H>Cuisine preference</H>
    <P>American is the default. Choose the food you enjoy; cuisine is separate from where you live, your diet and allergies.</P>
    <Button secondary title={`Cuisine: ${cuisineLabel(value)} · Change`} onPress={() => setOpen(!open)}/>
    {open ? <View accessibilityLabel="Choose cuisine">
      {cuisineOptions.slice(0,3).map(item => option(item.value, item.label))}
      <Button secondary title="Asian cuisines" onPress={() => setAsian(!asian)}/>
      {asian ? cuisineOptions.slice(3).map(item => option(item.value, item.label)) : null}
    </View> : null}
  </>;
}
