import { useT } from "../i18n";
import React, { useState } from "react";
import { View, Pressable, Text } from "react-native";
import { H, P, Button, colors } from "./ui";
import type { CuisinePreference } from "../core/planning-types";
export const cuisineOptions = [
  { value: "american", label: "American" }, { value: "british", label: "UK / British" },
  { value: "mexican", label: "Mexican" },
  { value: "german", label: "German" }, { value: "french", label: "French" }, { value: "brazilian", label: "Brazilian" },
  { value: "asian-indian", label: "Indian" }, { value: "asian-chinese", label: "Chinese" },
  { value: "asian-japanese", label: "Japanese" }, { value: "asian-thai", label: "Thai" },
] as const;
// Owner decision (Oct 2026): the Asian submenu offers Indian only. Chinese,
// Japanese and Thai stay valid stored values so earlier choices keep working,
// but they are only listed for a user who already has one selected.
const offeredAsian: CuisinePreference[] = ["asian-indian"];
export function asianChoices(current?: CuisinePreference) {
  return cuisineOptions.slice(6).filter(o => offeredAsian.includes(o.value) || o.value === current);
}
export function cuisineLabel(value?: CuisinePreference) {
  return cuisineOptions.find(option => option.value === (value || "american"))?.label || "American";
}
export function CuisinePreferences({ value = "american", onChange }: { value?: CuisinePreference; onChange: (value: CuisinePreference) => void }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [asian, setAsian] = useState(value.startsWith("asian-"));
  const option = (v: CuisinePreference, label: string) => <Pressable key={v} accessibilityRole="radio"
    accessibilityState={{ selected: value === v }} accessibilityLabel={tr(label)} onPress={() => { onChange(v); setOpen(false); }}
    style={{ minHeight: 48, justifyContent: "center", padding: 14, borderRadius: 12, backgroundColor: value === v ? colors.lime : colors.bg, marginBottom: 8 }}>
    <Text style={{ color: colors.ink, fontWeight: "600" }}>{label}{value === v ? " ✓" : ""}</Text>
  </Pressable>;
  return <>
    <H>{tr("Cuisine preference")}</H>
    <P>{tr("American is the default. Choose the food you enjoy; cuisine is separate from where you live, your diet and allergies.")}</P>
    <Button secondary title={tr("Cuisine: {v0} · Change", { v0: tr(cuisineLabel(value)) })} onPress={() => setOpen(!open)}/>
    {open ? <View accessibilityLabel={tr("Choose cuisine")}>
      {cuisineOptions.slice(0,6).map(item => option(item.value, tr(item.label)))}
      <Button secondary title="Asian cuisines" onPress={() => setAsian(!asian)}/>
      {asian ? asianChoices(value).map(item => option(item.value, tr(item.label))) : null}
    </View> : null}
  </>;
}
