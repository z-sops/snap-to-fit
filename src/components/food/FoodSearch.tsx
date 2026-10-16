import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sheet, Chip, palette } from "../design";
import { foodById, recipes, scale, searchFoods, type Food } from "../../core/foods";
import type { Meal } from "../../core/model";

type Tab = "search" | "recent" | "dishes";

/** Distinct recently logged database/barcode foods, newest first. */
export function recentFoodIds(meals: Meal[], limit = 25) {
  const ids: string[] = [];
  for (const m of [...meals].sort((a, b) => b.at.localeCompare(a.at)))
    if (m.foodId && !m.foodId.startsWith("off:") && !ids.includes(m.foodId)) {
      ids.push(m.foodId);
      if (ids.length >= limit) break;
    }
  return ids;
}

export function FoodRow({ food, onPress }: { food: Food; onPress: () => void }) {
  const sv = food.servings[0];
  const kcal = Math.round(scale(food, sv.grams).calories || 0);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${food.name}, ${kcal} calories per ${sv.label}`} onPress={onPress} style={s.row}>
      <View style={[s.dot, { backgroundColor: food.source === "recipe" ? palette.warnSoft : palette.goodSoft }]}>
        <Ionicons name={food.source === "recipe" ? "restaurant" : "leaf"} size={16} color={food.source === "recipe" ? palette.warn : palette.good} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={2}>{food.name}</Text>
        <Text style={s.meta} numberOfLines={1}>{kcal} kcal · {sv.label}{food.detail ? ` · ${food.detail}` : ""}</Text>
      </View>
      <Ionicons name="add-circle" size={28} color={palette.brand} />
    </Pressable>
  );
}

export function FoodSearch({ visible, onClose, onPick, meals, onBarcode }: {
  visible: boolean; onClose: () => void; onPick: (f: Food) => void; meals: Meal[]; onBarcode: () => void;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("search");
  const results = useMemo(() => {
    if (tab === "recent") return recentFoodIds(meals).map(foodById).filter(Boolean) as Food[];
    if (tab === "dishes") return recipes.map((r) => foodById(`recipe:${r.id}`)!).filter((f) => !query.trim() || f.name.toLowerCase().includes(query.trim().toLowerCase()));
    return searchFoods(query);
  }, [query, tab, meals]);
  return (
    <Sheet visible={visible} title="Search food" onClose={onClose}>
      <View style={s.searchBox}>
        <Ionicons name="search" size={20} color={palette.muted} />
        <TextInput autoFocus value={query} onChangeText={(v) => { setQuery(v); if (tab === "recent") setTab("search"); }}
          placeholder="Search 8,000+ foods, dishes, restaurants" placeholderTextColor={palette.muted}
          accessibilityLabel="Search foods" style={s.input} returnKeyType="search" />
        <Pressable accessibilityRole="button" accessibilityLabel="Scan a barcode" onPress={onBarcode} hitSlop={8}>
          <Ionicons name="barcode-outline" size={24} color={palette.brand} />
        </Pressable>
      </View>
      <View style={s.tabs}>
        <Chip label="All foods" selected={tab === "search"} onPress={() => setTab("search")} />
        <Chip label="Recent" selected={tab === "recent"} onPress={() => setTab("recent")} />
        <Chip label="Dishes" selected={tab === "dishes"} onPress={() => setTab("dishes")} />
      </View>
      {!query.trim() && tab === "search" ? <Text style={s.hint}>Popular foods</Text> : null}
      {results.length ? results.map((f) => <FoodRow key={f.id} food={f} onPress={() => onPick(f)} />) : (
        <Text style={s.empty}>
          {tab === "recent" ? "Foods you log will show up here for one-tap logging." : `No match for “${query.trim()}”. Try a simpler word (e.g. “chicken”), scan the barcode, or use Quick add.`}
        </Text>
      )}
      <Text style={s.credit}>Nutrition data: USDA FoodData Central (SR Legacy). Dishes are estimates from typical recipes.</Text>
    </Sheet>
  );
}

const s = StyleSheet.create({
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14, paddingVertical: 4 },
  input: { flex: 1, fontSize: 16, color: palette.ink, paddingVertical: 12 },
  tabs: { flexDirection: "row", gap: 8 },
  hint: { color: palette.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#EDF0F6" },
  dot: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  name: { color: palette.ink, fontSize: 15, fontWeight: "700" },
  meta: { color: palette.muted, fontSize: 13, marginTop: 2 },
  empty: { color: palette.muted, fontSize: 15, lineHeight: 21, textAlign: "center", paddingVertical: 24 },
  credit: { color: palette.muted, fontSize: 11, textAlign: "center", marginTop: 8 },
});
