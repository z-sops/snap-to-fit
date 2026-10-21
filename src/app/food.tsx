import { useT } from "../i18n";
import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, act, soft } from "../components/ui";
import { Surface, SectionHeader, Bar, Sheet, PrimaryButton, Chip, palette } from "../components/design";
import { FoodSearch } from "../components/food/FoodSearch";
import { FoodDetail, type NewMeal } from "../components/food/FoodDetail";
import { BarcodeScanner } from "../components/food/BarcodeScanner";
import { useStore } from "../services/store";
import { api } from "../services/api";
import { pickPhoto } from "../services/photos";
import { haptic } from "../services/feedback";
import { foodReview } from "../core/food-review";
import { effectiveProfile } from "../core/progress";
import { nutritionTargets, validateMeal } from "../core/nutrition";
import { bySlot, mealsOn, nutrientTotals, sumCalories } from "../core/food-log";
import { foodById, nutrientInfo, type Food, type NutrientKey } from "../core/foods";
import { loggedSourceDescriptions, loggedSourceOf } from "../core/food-sources";
import type { PlannedMeal } from "../core/planning-types";
import { uid, numeric, defaultSlot, localDay, mealSlotNames, type Meal, type MealSlotName } from "../core/model";
import { proteinGuidance } from "../core/targets";
import { photoFood, type PhotoResult } from "../core/photo-estimate";

type Flow = null | "search" | "barcode" | "detail" | "quick";

export default function FoodScreen() {
  const tr = useT();
  const { state, update } = useStore();
  const p = effectiveProfile(state)!;
  const targets = nutritionTargets(p);
  const protein = proteinGuidance(p);
  const today = mealsOn(state.meals);
  const sections = bySlot(today);
  const { totals, unknown, partial } = nutrientTotals(today);
  const [flow, setFlow] = useState<Flow>(null);
  const [slot, setSlot] = useState<MealSlotName>(defaultSlot());
  const [food, setFood] = useState<Food | null>(null);
  const [photo, setPhoto] = useState<{ uri: string; thumb?: string; estimate: boolean; note?: string; fat?: PhotoResult["cookingFat"] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showMicros, setShowMicros] = useState(false);
  const [qty, setQty] = useState<number | undefined>(undefined);
  // Today's suggestions from the weekly plan (only general-fitness plans carry dishes).
  const planned = state.mealPlan?.days.find((d) => d.date === localDay())?.meals || [];
  const logPlanned = (m: PlannedMeal) => {
    const f = m.dishId ? foodById(`recipe:${m.dishId}`) : null;
    if (!f) return;
    setSlot(m.slot);
    setQty(m.servings);
    setFood(f);
    setFlow("detail");
  };

  const add = (meal: NewMeal) =>
    act(async () => {
      validateMeal(meal);
      await update((s) => ({ ...s, meals: [...s.meals, { ...meal, id: uid(), at: new Date().toISOString() } as Meal] }));
      haptic("success");
      setFlow(null);
      setFood(null);
      setPhoto(null);
      setNotice(tr("Added {name} · {kcal} kcal", { name: tr(meal.name), kcal: meal.calories }));
    });

  const review = (meal: NewMeal) => {
    const r = foodReview(p, { name: meal.name, carbs: meal.carbs }, state.carePlan?.acknowledged ? state.carePlan.targets : undefined, totals.carbs || 0);
    return r.requiresReview ? r : null;
  };

  const open = (s: MealSlotName, f: Flow) => {
    setSlot(s);
    setQty(undefined);
    setFlow(f);
  };

  // The camera opens first, whatever the AI settings: the photo is kept with the entry and
  // AI analysis runs only when consented and the online service exists.
  const scan = (camera: boolean) =>
    act(async () => {
      setBusy(true);
      try {
        const img = await pickPhoto(camera);
        if (!img) return;
        if (!p.aiConsent || !process.env.EXPO_PUBLIC_API_URL) {
          setPhoto({
            uri: img.uri, thumb: img.thumb, estimate: false,
            note: !p.aiConsent
              ? tr("Photo added. Automatic calories need AI analysis, which is off. Turn it on in Settings, or find what you ate below.")
              : "Photo added. AI meal analysis is not connected in this test build yet, so find what you ate below.",
          });
          return;
        }
        // The server only sends a photograph to the provider with confirmed consent.
        const result = await api<PhotoResult>("/food", {
          image: img.data,
          mimeType: img.mimeType,
          aiConsent: p.aiConsent,
        });
        validateMeal({ ...result, source: "photo" });
        setPhoto({ uri: img.uri, thumb: img.thumb, estimate: true, note: result.uncertainty, fat: result.cookingFat });
        setFood(photoFood(result));
        setFlow("detail");
      } finally {
        setBusy(false);
      }
    });

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // The centre Snap button opens /food?snap=<timestamp>; each tap opens the camera once.
  const { snap } = useLocalSearchParams<{ snap?: string }>();
  const handledSnap = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!snap || handledSnap.current === snap) return;
    handledSnap.current = snap;
    scan(true);
  }, [snap]); // eslint-disable-line react-hooks/exhaustive-deps

  const eaten = Math.round(totals.calories || 0);
  const left = targets.restricted ? null : targets.calories - eaten;
  const micros: NutrientKey[] = ["fibre", "sodium", "satFat", "sugar", "potassium", "calcium", "iron", "magnesium", "vitaminC", "vitaminD", "vitaminB12", "folate"];

  return (
    <Screen title="Food" subtitle={new Date().toLocaleDateString(tr("en-US"), { weekday: "long", month: "long", day: "numeric" })}>
      <Surface dark>
        <View style={s.sumRow}>
          <View>
            <Text style={s.sumLabel}>{tr("Eaten today")}</Text>
            <Text style={s.sumBig}>{eaten.toLocaleString()} <Text style={s.sumUnit}>kcal</Text></Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.sumLabel}>{left === null ? tr("Calorie target") : left >= 0 ? tr("Left") : tr("Over")}</Text>
            <Text style={s.sumMid}>{left === null ? tr("Set by your care team") : `${Math.abs(left).toLocaleString()} kcal`}</Text>
          </View>
        </View>
        {left !== null ? <Bar value={eaten} total={targets.calories} color={left >= 0 ? "#6EA8FF" : palette.carbs} height={10} /> : null}
        <View style={s.macros}>
          <MacroBarDark label="Protein" value={totals.protein || 0} total={targets.restricted ? protein?.low : targets.protein} color={palette.protein} />
          <MacroBarDark label="Carbs" value={totals.carbs || 0} total={targets.restricted ? undefined : targets.carbs} color={palette.carbs} />
          <MacroBarDark label="Fat" value={totals.fat || 0} total={targets.restricted ? undefined : targets.fat} color={palette.fat} />
        </View>
        {targets.restricted && protein ? (
          <Text style={s.sumNote}>Protein range {protein.low}–{protein.high} g/day to protect muscle — confirm with your doctor. Calorie targets stay with your care team.</Text>
        ) : null}
        {unknown.length || partial.length ? (
          <Text style={s.sumNote}>{tr("Some nutrients were not reported by every food, so those totals are lower bounds rather than confirmed values.")}</Text>
        ) : null}
      </Surface>

      <View style={s.actions}>
        <Action icon="camera" label={busy ? tr("Opening…") : tr("Snap meal")} a11y="Take a snap" tint={soft("#EEF2FF")} color={palette.brand} onPress={() => scan(true)} />
        <Action icon="barcode-outline" label="Barcode" a11y="Scan barcode" tint={soft("#E7F6EE")} color={palette.good} onPress={() => open(defaultSlot(), "barcode")} />
        <Action icon="search" label="Search" a11y="Search food" tint={soft("#FFF4DE")} color={palette.warn} onPress={() => open(defaultSlot(), "search")} />
        <Action icon="flash" label="Quick add" a11y="Quick add calories" tint={soft("#F3EDFF")} color="#6D28D9" onPress={() => open(defaultSlot(), "quick")} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={tr("Choose photo")} onPress={() => scan(false)} style={s.gallery}>
        <Ionicons name="images-outline" size={16} color={palette.brand} />
        <Text style={s.galleryText}>{tr("Use a photo from your gallery")}</Text>
      </Pressable>

      {notice ? (
        <View style={s.toast} accessibilityRole="alert">
          <Ionicons name="checkmark-circle" size={20} color={palette.good} />
          <Text style={s.toastText}>{notice}</Text>
        </View>
      ) : null}

      {photo && !photo.estimate ? (
        <Surface>
          <Image source={{ uri: photo.uri }} style={s.photo} resizeMode="cover" accessibilityLabel={tr("Your meal photo")} />
          <Text style={s.body}>{tr(photo.note)}</Text>
          <PrimaryButton title="Find what you ate" icon="search" onPress={() => open(defaultSlot(), "search")} />
        </Surface>
      ) : null}

      {mealSlotNames.map((m) => {
        const list = sections[m.id];
        return (
          <Surface key={m.id}>
            <View style={s.slotHead}>
              <Text style={s.slotTitle}>{m.emoji}  {tr(m.label)}</Text>
              <Text style={s.slotKcal}>{sumCalories(list)} kcal</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={tr("Add to {slot}", { slot: tr(m.label) })} onPress={() => open(m.id, "search")} hitSlop={8} style={s.plus}>
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </View>
            {list.length === 0 ? (() => {
              const plan = planned.find((x) => x.slot === m.id && x.dishId && x.nutrition);
              if (!plan) return <Text style={s.empty}>{tr("Nothing logged yet.")}</Text>;
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={tr("Log planned meal: {name}", { name: tr(plan.name) })} onPress={() => logPlanned(plan)} style={s.planned}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.plannedKicker}>{tr("From your plan")}</Text>
                    <Text style={s.itemName} numberOfLines={2}>{tr(plan.name)}</Text>
                    <Text style={s.itemMeta}>{plan.servings} × {tr(plan.servingLabel)} · {plan.nutrition!.calories} kcal · {plan.nutrition!.protein} g {tr("protein")}</Text>
                  </View>
                  <View style={s.plannedBtn}><Text style={s.plannedBtnText}>{tr("Log it")}</Text></View>
                </Pressable>
              );
            })() : null}
            {list.map((meal) => (
              <View key={meal.id} style={s.item}>
                {meal.photoUri ? <Image source={{ uri: meal.photoUri }} style={s.thumb} /> : (
                  <View style={[s.thumb, s.thumbIcon]}>
                    <Ionicons name={meal.source === "photo" ? "camera" : meal.source === "barcode" ? "barcode" : meal.source === "quick" || meal.source === "manual" ? "flash" : "leaf"} size={18} color={palette.brand} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName} numberOfLines={1}>{tr(meal.name)}</Text>
                  <Text style={s.itemMeta} numberOfLines={1}>
                    {meal.servingLabel ? `${meal.servings && meal.servings !== 1 ? `${meal.servings} × ` : ""}${meal.servingLabel} · ` : ""}P {Math.round(meal.protein)} · C {Math.round(meal.carbs)} · F {Math.round(meal.fat)}
                  </Text>
                  <Text style={s.itemSource} numberOfLines={1}>{tr(loggedSourceDescriptions[loggedSourceOf(meal)].label)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.itemKcal}>{Math.round(meal.calories)}</Text>
                  {meal.range ? <Text style={s.itemRange}>{meal.range[0]}–{meal.range[1]}</Text> : null}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${meal.name}`} hitSlop={8}
                  onPress={() => act(() => update((st) => ({ ...st, meals: st.meals.filter((x) => x.id !== meal.id) })))}>
                  <Ionicons name="trash-outline" size={18} color={palette.muted} />
                </Pressable>
              </View>
            ))}
          </Surface>
        );
      })}

      <Surface>
        <Pressable accessibilityRole="button" accessibilityLabel={showMicros ? tr("Hide vitamins and minerals") : tr("Show vitamins and minerals")} onPress={() => setShowMicros(!showMicros)} style={s.slotHead}>
          <Text style={s.slotTitle}>{tr("🧪 Vitamins & minerals")}</Text>
          <Ionicons name={showMicros ? "chevron-up" : "chevron-down"} size={20} color={palette.muted} />
        </Pressable>
        {showMicros ? micros.map((k) => {
          const info = nutrientInfo[k];
          const v = totals[k];
          return (
            <View key={k} style={s.microRow}>
              <Text style={s.microName}>{tr(info.label)}</Text>
              <View style={{ flex: 1 }}>{info.dv ? <Bar value={v || 0} total={info.dv} color={info.limit && (v || 0) > info.dv ? palette.bad : info.limit ? palette.carbs : palette.fiber} height={6} /> : null}</View>
              <Text style={s.microValue}>{unknown.includes(k) ? tr("Not available") : v === undefined ? "—" : `${v} ${info.unit}`}</Text>
            </View>
          );
        }) : <Text style={s.empty}>{tr("Today’s fiber, sodium, potassium, iron, vitamins and more vs. FDA Daily Values. Foods from search and barcode carry full nutrients; quick adds don’t.")}</Text>}
      </Surface>

      <SectionHeader title="Plan ahead" />
      <PrimaryButton title="My weekly meal plan" icon="calendar" onPress={() => router.push("/meal-plan")} />

      <FoodSearch visible={flow === "search"} meals={state.meals} onClose={() => setFlow(null)}
        onPick={(f) => { setFood(f); setFlow("detail"); }} onBarcode={() => setFlow("barcode")} />
      <BarcodeScanner visible={flow === "barcode"} onClose={() => setFlow(null)}
        onFound={(f) => { setFood(f); setFlow("detail"); }} onSearchInstead={() => setFlow("search")} />
      <FoodDetail key={`${food?.id || "none"}-${qty || 1}`} food={food} visible={flow === "detail"} initialSlot={slot} initialQty={qty}
        photo={food?.id === "photo"} photoUri={photo?.uri} photoThumb={photo?.thumb} note={food?.id === "photo" ? photo?.note : undefined}
        initialFat={food?.id === "photo" ? photo?.fat : undefined}
        review={review} onClose={() => setFlow(food?.id === "photo" ? null : "search")} onAdd={add} />
      <QuickAdd visible={flow === "quick"} slot={slot} onClose={() => setFlow(null)} onAdd={add} photoUri={photo && !photo.estimate ? photo.thumb || photo.uri : undefined} />
    </Screen>
  );
}

function MacroBarDark(props: { label: string; value: number; total?: number; color: string }) {
  const tr = useT();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={s.darkLabel}>{tr(props.label)}</Text>
      <Bar value={props.value} total={props.total || props.value || 1} color={props.color} />
      <Text style={s.darkValue}>{Math.round(props.value)}<Text style={s.darkTotal}>{props.total ? ` / ${props.total}g` : "g"}</Text></Text>
    </View>
  );
}

function Action({ icon, label, a11y, tint, color, onPress }: { icon: string; label: string; a11y: string; tint: string; color: string; onPress: () => void }) {
  const tr = useT();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={tr(a11y)} onPress={onPress} style={s.action}>
      <View style={[s.actionIcon, { backgroundColor: tint }]}><Ionicons name={icon as never} size={24} color={color} /></View>
      <Text style={s.actionText}>{tr(label)}</Text>
    </Pressable>
  );
}

function QuickAdd({ visible, slot, onClose, onAdd, photoUri }: { visible: boolean; slot: MealSlotName; onClose: () => void; onAdd: (m: NewMeal) => void; photoUri?: string }) {
  const tr = useT();
  const [name, setName] = useState("");
  const [values, setValues] = useState({ calories: "", protein: "", carbs: "", fat: "", fibre: "" });
  const [where, setWhere] = useState<MealSlotName>(slot);
  useEffect(() => { if (visible) setWhere(slot); }, [visible, slot]); // eslint-disable-line react-hooks/set-state-in-effect
  const fields = [["calories", "Calories (kcal)"], ["protein", "Protein (g)"], ["carbs", "Carbs (g)"], ["fat", "Fat (g)"], ["fibre", "Fiber (g)"]] as const;
  return (
    <Sheet visible={visible} title="Quick add" onClose={onClose}
      footer={<PrimaryButton title="Save meal" icon="checkmark" onPress={() => act(async () => {
        const meal: NewMeal = {
          name: name.trim() || "Quick add", source: "quick", slot: where, photoUri,
          calories: numeric(values.calories, 0, 5000, "Calories"), protein: numeric(values.protein || "0", 0, 500, "Protein"),
          carbs: numeric(values.carbs || "0", 0, 500, "Carbs"), fat: numeric(values.fat || "0", 0, 500, "Fat"), fibre: numeric(values.fibre || "0", 0, 500, "Fiber"),
          // A field the user left blank was never known, not measured as zero.
          unknownNutrients: fields.filter(([k]) => !values[k].trim()).map(([k]) => k),
        };
        onAdd(meal);
        setName(""); setValues({ calories: "", protein: "", carbs: "", fat: "", fibre: "" });
      })} />}>
      <Text style={s.body}>{tr("Use this for a package label or a restaurant menu that lists calories. Leave a field empty if the label does not say it, so it is not counted as zero.")}</Text>
      <TextInput value={name} onChangeText={setName} placeholder={tr("What did you eat?")} placeholderTextColor={palette.muted} accessibilityLabel={tr("Meal name")} style={s.input} />
      {fields.map(([k, label]) => (
        <TextInput key={k} value={values[k]} onChangeText={(v) => setValues((x) => ({ ...x, [k]: v }))} placeholder={tr(label)}
          placeholderTextColor={palette.muted} keyboardType="decimal-pad" accessibilityLabel={tr(label)} style={s.input} />
      ))}
      <View style={s.wrap}>{mealSlotNames.map((m) => <Chip key={m.id} label={`${m.emoji} ${tr(m.label)}`} selected={where === m.id} onPress={() => setWhere(m.id)} />)}</View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  sumLabel: { color: "#A9B4CC", fontSize: 13, fontWeight: "700" },
  sumBig: { color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: -1 },
  sumUnit: { color: "#A9B4CC", fontSize: 15, fontWeight: "700" },
  sumMid: { color: "#fff", fontSize: 18, fontWeight: "800" },
  sumNote: { color: "#C9D2E5", fontSize: 13, lineHeight: 18 },
  macros: { flexDirection: "row", gap: 14 },
  darkLabel: { color: "#A9B4CC", fontSize: 12, fontWeight: "700" },
  darkValue: { color: "#fff", fontSize: 15, fontWeight: "800" },
  darkTotal: { color: "#A9B4CC", fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1, alignItems: "center", gap: 8, paddingHorizontal: 4, backgroundColor: palette.card, borderRadius: 20, paddingVertical: 14, borderWidth: 1, borderColor: palette.hairline },
  actionIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  actionText: { color: palette.ink, fontSize: 13, fontWeight: "800", textAlign: "center", lineHeight: 17 },
  gallery: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 },
  galleryText: { color: palette.brand, fontSize: 14, fontWeight: "700" },
  toast: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: palette.goodSoft, borderRadius: 16, padding: 12 },
  toastText: { color: palette.good, fontWeight: "700", flex: 1 },
  photo: { width: "100%", height: 200, borderRadius: 18 },
  body: { color: palette.muted, fontSize: 15, lineHeight: 21 },
  slotHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  slotTitle: { flex: 1, color: palette.ink, fontSize: 18, fontWeight: "800" },
  slotKcal: { color: palette.muted, fontSize: 14, fontWeight: "700" },
  plus: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center" },
  empty: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  planned: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: palette.line, padding: 12 },
  plannedKicker: { color: palette.brand, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  plannedBtn: { backgroundColor: palette.brand, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  plannedBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, borderTopWidth: 1, borderColor: palette.hairline },
  thumb: { width: 44, height: 44, borderRadius: 14 },
  thumbIcon: { backgroundColor: palette.brandSoft, alignItems: "center", justifyContent: "center" },
  itemName: { color: palette.ink, fontSize: 15, fontWeight: "700" },
  itemMeta: { color: palette.muted, fontSize: 12, marginTop: 2 },
  itemSource: { color: palette.brand, fontSize: 11, fontWeight: "700", marginTop: 2 },
  itemKcal: { color: palette.ink, fontSize: 16, fontWeight: "800" },
  itemRange: { color: palette.muted, fontSize: 11 },
  microRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 3 },
  microName: { width: 110, color: palette.ink, fontSize: 14, fontWeight: "600" },
  microValue: { width: 96, textAlign: "right", color: palette.muted, fontSize: 13, fontWeight: "600" },
  input: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: palette.ink },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
