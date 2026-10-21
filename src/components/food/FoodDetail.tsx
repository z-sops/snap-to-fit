import { useT } from "../../i18n";
import { soft } from "../ui";
import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sheet, Surface, Pill, StatTile, Stepper, Chip, PrimaryButton, palette, Bar } from "../design";
import {
  addedFat, nutrientInfo, nutrientKeys, scale, withAddedFat,
  type AddedFat, type Food, type NutrientKey,
} from "../../core/foods";
import { mealFromFood, type NewMeal } from "../../core/meals";
import { openFoodFactsCredit, sourceDescriptions } from "../../core/food-sources";
import { mealSlotNames, type MealSlotName } from "../../core/model";

export type { NewMeal } from "../../core/meals";

const sourceBadge: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  usda: { label: sourceDescriptions.usda.label, icon: "shield-checkmark", color: palette.good, bg: palette.goodSoft },
  recipe: { label: sourceDescriptions.recipe.label, icon: "restaurant", color: palette.warn, bg: palette.warnSoft },
  barcode: { label: sourceDescriptions.barcode.label, icon: "barcode", color: palette.brand, bg: palette.brandSoft },
  photo: { label: sourceDescriptions.photo.label, icon: "sparkles", color: "#6D28D9", bg: soft("#F3EDFF") },
};
const micros: NutrientKey[] = nutrientKeys.filter((k) => !["calories", "protein", "carbs", "fat"].includes(k));

export function FoodDetail({ food, visible, onClose, onAdd, initialSlot, photoUri, photoThumb, photo, note, review, initialFat, initialQty }: {
  food: Food | null; visible: boolean; onClose: () => void; onAdd: (meal: NewMeal) => void;
  initialSlot: MealSlotName; photoUri?: string; photoThumb?: string; photo?: boolean; note?: string; initialFat?: AddedFat; initialQty?: number;
  /** Diet, allergy or medical concerns that must be acknowledged before adding. */
  review?: (meal: NewMeal) => { messages: string[]; alternative: string } | null;
}) {
  const tr = useT();
  const [ack, setAck] = useState(false);
  const [servingIndex, setServingIndex] = useState(0);
  const [qty, setQty] = useState(initialQty || 1);
  const [fat, setFat] = useState<AddedFat>(initialFat || "none");
  const [slot, setSlot] = useState<MealSlotName>(initialSlot);
  const [showMicros, setShowMicros] = useState(false);
  const serving = food?.servings[Math.min(servingIndex, (food?.servings.length || 1) - 1)];
  const meal = useMemo(
    () => (food && serving ? mealFromFood(food, serving.grams * qty, qty, serving.label, fat, slot, photo) : null),
    [food, serving, qty, fat, slot, photo],
  );
  // The nutrients of this exact amount. A nutrient the source does not know
  // stays undefined, so it can be shown as unavailable instead of as zero.
  const scaled = useMemo(
    () => (food ? withAddedFat(scale(food, (serving?.grams || 0) * qty), fat) : null),
    [food, serving, qty, fat],
  );
  if (!food || !serving || !meal) return null;
  const concerns = review?.(meal) || null;
  const blocked = !!concerns && !ack;
  const source = photo ? "photo" : food.source;
  const badge = sourceBadge[source];
  const description = sourceDescriptions[source];
  const slotLabel = mealSlotNames.find((s) => s.id === slot)!.label;
  const nutrient = (key: NutrientKey) => scaled?.[key];
  const tile = (key: NutrientKey, label: string, color: string) => {
    const value = nutrient(key);
    return (
      <StatTile
        label={label}
        value={value === undefined ? "—" : Math.round(value)}
        unit={value === undefined ? undefined : "g"}
        color={color}
      />
    );
  };
  return (
    <Sheet visible={visible} title={photo ? tr("Review your meal") : tr("Add food")} onClose={onClose} closeLabel="Back"
      footer={<PrimaryButton title={tr("Add to {slot}", { slot: tr(slotLabel) })} icon="add-circle" disabled={blocked} onPress={() => onAdd({ ...meal, photoUri: photoThumb || photoUri })} />}>
      {photoUri ? <Image source={{ uri: photoUri }} style={s.photo} resizeMode="cover" accessibilityLabel={tr("Your meal photo")} /> : null}
      <Surface>
        <Pill label={badge.label} icon={badge.icon} color={badge.color} bg={badge.bg} />
        <Text style={s.name}>{tr(food.name)}</Text>
        {food.detail ? <Text style={s.detail}>{tr(food.detail)}</Text> : null}
        <Text style={s.note}>{tr(description.detail)}</Text>
        {note ? <Text style={s.note}>{note}</Text> : null}
        <View style={s.kcalRow}>
          <View>
            <Text style={s.kcal} accessibilityLabel={`${meal.calories} calories`}>{meal.calories.toLocaleString()}</Text>
            <Text style={s.kcalUnit}>kcal</Text>
          </View>
          <View style={s.rangeBox}>
            <Text style={s.rangeLabel}>{tr("Likely range")}</Text>
            <Text style={s.range}>{meal.range![0]}–{meal.range![1]} kcal</Text>
          </View>
        </View>
        <View style={s.tiles}>
          {tile("protein", "Protein", palette.protein)}
          {tile("carbs", "Carbs", palette.carbs)}
          {tile("fat", "Fat", palette.fat)}
          {tile("fibre", "Fiber", palette.fiber)}
        </View>
        {source === "barcode" ? <Text style={s.note}>{tr(openFoodFactsCredit)}</Text> : null}
      </Surface>

      {concerns ? (
        <Surface style={{ backgroundColor: palette.warnSoft, borderColor: palette.warnSoft }}>
          <Text style={s.h}>{tr("Check before choosing this meal")}</Text>
          {concerns.messages.map((m) => <Text key={m} style={s.concern}>• {m}</Text>)}
          <Text style={s.concern}>{concerns.alternative}</Text>
          <Pressable accessibilityRole="checkbox" aria-checked={ack} accessibilityState={{ checked: ack }}
            accessibilityLabel={tr("I reviewed the concerns and ingredients. This does not certify food safety; I can still record what I actually ate.")}
            onPress={() => setAck(!ack)} style={s.ackRow}>
            <Ionicons name={ack ? "checkbox" : "square-outline"} size={24} color={palette.ink} />
            <Text style={[s.concern, { flex: 1 }]}>{tr("I reviewed the concerns and ingredients. This does not certify food safety; I can still record what I actually ate.")}</Text>
          </Pressable>
        </Surface>
      ) : null}

      {food.items?.length ? (
        <Surface>
          <Text style={s.h}>{tr("What we found")}</Text>
          {food.items.map((i) => (
            <View key={`${i.name}-${i.grams}`} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{i.name} · {i.grams} g</Text>
                {i.matched ? <Text style={s.note}>USDA: {i.matched}</Text> : <Text style={s.note}>{tr("No database match — AI estimate used")}</Text>}
              </View>
              <Text style={s.itemName}>{i.calories !== undefined ? `${i.calories} kcal` : "—"}</Text>
            </View>
          ))}
          <Text style={s.note}>{tr("Wrong item or portion? Go back and search the food instead — database entries are more accurate than any photo.")}</Text>
        </Surface>
      ) : null}

      <Surface>
        <Text style={s.h}>{tr("How much?")}</Text>
        <View style={s.wrap}>
          {food.servings.map((sv, i) => (
            <Chip key={sv.label} label={`${sv.label}${sv.label.includes("g") && /^\d/.test(sv.label) ? "" : ` · ${Math.round(sv.grams)} g`}`} selected={i === servingIndex} onPress={() => setServingIndex(i)} />
          ))}
        </View>
        <View style={s.qtyRow}>
          <Text style={s.qtyLabel}>{tr("Servings")}</Text>
          <Stepper label="servings" value={qty} onChange={setQty} step={0.5} min={0.25} />
        </View>
        <Text style={s.note}>Total {Math.round(serving.grams * qty)} g. Portions you eyeball are often bigger than they look — weigh once in a while.</Text>
      </Surface>

      <Surface>
        <Text style={s.h}>{tr("Cooked with extra oil, butter or ghee?")}</Text>
        <Text style={s.note}>{tr("Hidden cooking fat is the most-missed calorie source in food logs. 1 tbsp of oil ≈ 120 kcal.")}</Text>
        <View style={s.wrap}>
          {(Object.keys(addedFat) as AddedFat[]).map((k) => (
            <Chip key={k} label={addedFat[k].label} selected={fat === k} onPress={() => setFat(k)} />
          ))}
        </View>
      </Surface>

      <Surface>
        <Text style={s.h}>{tr("Add to")}</Text>
        <View style={s.wrap}>
          {mealSlotNames.map((m) => <Chip key={m.id} label={`${m.emoji} ${tr(m.label)}`} selected={slot === m.id} onPress={() => setSlot(m.id)} />)}
        </View>
      </Surface>

      <Surface>
        <Pressable accessibilityRole="button" accessibilityLabel={showMicros ? tr("Hide nutrients") : tr("Show all nutrients")} onPress={() => setShowMicros(!showMicros)} style={s.microHead}>
          <Text style={s.h}>{tr("Vitamins & minerals")}</Text>
          <Ionicons name={showMicros ? "chevron-up" : "chevron-down"} size={20} color={palette.muted} />
        </Pressable>
        {showMicros ? (
          micros.map((k) => {
            const info = nutrientInfo[k];
            // Unavailable stays unavailable; only a real zero shows as zero.
            const v = nutrient(k);
            return (
              <View key={k} style={s.microRow}>
                <Text style={s.microName}>{tr(info.label)}</Text>
                <View style={{ flex: 1 }}>{v !== undefined && info.dv ? <Bar value={v} total={info.dv} color={info.limit ? palette.carbs : palette.fiber} height={6} /> : null}</View>
                <Text style={s.microValue}>{v === undefined ? tr("Not available") : `${v} ${info.unit}`}{v !== undefined && info.dv ? `  ${Math.round((v / info.dv) * 100)}%` : ""}</Text>
              </View>
            );
          })
        ) : (
          <Text style={s.note}>{tr("Sodium, potassium, calcium, iron, vitamins C, D, B12 and more, with % Daily Value.")}</Text>
        )}
      </Surface>
    </Sheet>
  );
}

const s = StyleSheet.create({
  photo: { width: "100%", height: 220, borderRadius: 24 },
  name: { color: palette.ink, fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  detail: { color: palette.muted, fontSize: 14 },
  kcalRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  kcal: { color: palette.ink, fontSize: 48, fontWeight: "900", letterSpacing: -1.5 },
  kcalUnit: { color: palette.muted, fontSize: 14, fontWeight: "700", marginTop: -6 },
  rangeBox: { alignItems: "flex-end", backgroundColor: palette.bg, borderRadius: 14, padding: 10 },
  rangeLabel: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  range: { color: palette.ink, fontSize: 16, fontWeight: "800" },
  tiles: { flexDirection: "row", gap: 8 },
  h: { color: palette.ink, fontSize: 17, fontWeight: "800" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qtyLabel: { color: palette.ink, fontSize: 16, fontWeight: "700" },
  note: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  concern: { color: palette.warn, fontSize: 14, lineHeight: 20 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, borderTopWidth: 1, borderColor: palette.hairline },
  itemName: { color: palette.ink, fontSize: 15, fontWeight: "700" },
  ackRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  microHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  microRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  microName: { width: 110, color: palette.ink, fontSize: 14, fontWeight: "600" },
  microValue: { width: 120, textAlign: "right", color: palette.muted, fontSize: 13, fontWeight: "600" },
});
