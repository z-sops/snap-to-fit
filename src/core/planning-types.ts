export type DietType = "vegan" | "vegetarian" | "omnivore";
export type Allergen =
  | "milk"
  | "egg"
  | "fish"
  | "shellfish"
  | "wheat"
  | "soy"
  | "peanut"
  | "tree-nut"
  | "sesame";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export interface MacroBudget {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}
export interface PlannedMeal {
  slot: MealSlot;
  name: string;
  proteinSources: string[];
  ingredients: string[];
  budget: MacroBudget | null;
  note: string;
}
export interface MealPlan {
  week: string;
  signature: string;
  mode: "fitness" | "care-plan" | "allergy-review" | "local-setup";
  country: string;
  diet: DietType;
  days: { date: string; weekday: string; meals: PlannedMeal[] }[];
  notes: string[];
}
export interface RoutineTimes {
  wake: string;
  breakfast: string;
  lunch: string;
  dinner: string;
}
export interface Routine {
  regular: RoutineTimes;
  weekend: RoutineTimes;
  weekendDays: number[];
  reminders: boolean;
  wakeReminder: boolean;
  reminderIds: string[];
  timezone: string;
}
export interface RoutineEvent {
  id: string;
  at: string;
  kind: "wake" | "breakfast" | "lunch" | "dinner";
}
export interface EducationSettings {
  enabled: boolean;
  frequency: "weekly" | "daily";
  time: string;
  weekday: number;
  reminderIds: string[];
}
export interface CarePlan {
  targets: Partial<MacroBudget>;
  meals: Partial<Record<MealSlot, string>>;
  acknowledged: boolean;
}
