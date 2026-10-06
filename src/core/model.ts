import type {
  DietType,
  Allergen,
  MealPlan,
  Routine,
  RoutineEvent,
  EducationSettings,
  CarePlan,
} from "./planning-types";
export type Goal = "lose" | "maintain" | "gain";
export type Place = "gym" | "home" | "walk";
export type Condition =
  | "type1"
  | "type2"
  | "hypertension"
  | "heart"
  | "kidney"
  | "pregnant"
  | "eating-disorder";
export interface Profile {
  country?: string;
  dietType?: DietType;
  allergyFoods?: Allergen[];
  familiarFoods?: string;
  name: string;
  age: number;
  sex: "male" | "female";
  height: number;
  weight: number;
  targetWeight: number;
  goal: Goal;
  activity: 1.2 | 1.375 | 1.55 | 1.725;
  experience: "beginner" | "experienced";
  days: number;
  place: Place;
  conditions: Condition[];
  insulin: boolean;
  medicines: string;
  allergies: string;
  diet: string;
  injuries: string;
  cleared: boolean;
  consent: boolean;
  aiConsent: boolean;
}
export interface Targets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  bmi: number;
  maintenance: number;
  notes: string[];
  restricted: boolean;
}
export interface Meal {
  id: string;
  at: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  source: "manual" | "photo";
}
export interface Reading {
  id: string;
  at: string;
  kind: "weight" | "waist" | "glucose" | "bp";
  value: number;
  second?: number;
  unit: string;
  context: string;
  source: string;
}
export interface Medicine {
  id: string;
  name: string;
  dose: string;
  kind: "tablet" | "insulin" | "injection";
  time: string;
  nextDate: string;
  reminderId?: string;
}
export interface DoseLog {
  id: string;
  at: string;
  medicineId: string;
  name: string;
  dose: string;
  symptoms: string;
}
export interface WorkoutLog {
  id: string;
  at: string;
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  minutes: number;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}
export interface CGMReading {
  id: string;
  at: string;
  value: number | null;
  unit: "mg/dL" | "mmol/L";
  trend: string | null;
  status: "high" | "low" | null;
  source: string;
}
export interface State {
  mealPlan?: MealPlan;
  routine?: Routine;
  routineEvents?: RoutineEvent[];
  education?: EducationSettings;
  carePlan?: CarePlan;
  flexibleMeals?: { id: string; week: string; at: string }[];
  version: 1;
  profile: Profile | null;
  meals: Meal[];
  readings: Reading[];
  medicines: Medicine[];
  doses: DoseLog[];
  workouts: WorkoutLog[];
  messages: Message[];
  photos: { id: string; at: string; image: string }[];
  cgm: CGMReading[];
}
export const emptyState: State = {
  version: 1,
  profile: null,
  meals: [],
  readings: [],
  medicines: [],
  doses: [],
  workouts: [],
  messages: [],
  photos: [],
  cgm: [],
};
export const newProfile: Profile = {
  name: "",
  age: 0,
  sex: "female",
  height: 0,
  weight: 0,
  targetWeight: 0,
  goal: "maintain",
  activity: 1.2,
  experience: "beginner",
  days: 3,
  place: "gym",
  conditions: [],
  insulin: false,
  medicines: "",
  allergies: "",
  diet: "No preference",
  injuries: "",
  cleared: false,
  consent: false,
  aiConsent: false,
};
export function localDay(at: string | Date = new Date()) {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
export function numeric(text: string, min: number, max: number, label: string) {
  if (!text.trim()) throw new Error(`${label} is required.`);
  const n = Number(text);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error(`${label} must be between ${min} and ${max}.`);
  return n;
}
export function validateProfile(p: Profile) {
  if (!p || typeof p !== "object" || typeof p.name !== "string")
    throw new Error("Invalid profile.");
  if (
    !["male", "female"].includes(p.sex) ||
    !["lose", "gain", "maintain"].includes(p.goal) ||
    !["gym", "home", "walk"].includes(p.place) ||
    !["beginner", "experienced"].includes(p.experience)
  )
    throw new Error("Invalid profile preferences.");
  if (
    ![1.2, 1.375, 1.55, 1.725].includes(p.activity) ||
    ![2, 3, 4, 5].includes(p.days)
  )
    throw new Error("Invalid activity preferences.");
  const conditions = [
    "type1",
    "type2",
    "hypertension",
    "heart",
    "kidney",
    "pregnant",
    "eating-disorder",
  ];
  if (
    !Array.isArray(p.conditions) ||
    p.conditions.some((c) => !conditions.includes(c))
  )
    throw new Error("Invalid health context.");
  for (const name of ["medicines", "allergies", "diet", "injuries"] as const)
    if (typeof p[name] !== "string" || p[name].length > 2000)
      throw new Error("Invalid health preferences.");
  for (const name of ["insulin", "cleared", "consent", "aiConsent"] as const)
    if (typeof p[name] !== "boolean")
      throw new Error("Invalid consent or health setting.");
  if (
    p.country !== undefined &&
    !["PK", "IN", "BD", "US", "CA", "GB", "AE", "SA", "TR", "OTHER"].includes(
      p.country,
    )
  )
    throw new Error("Invalid country preference.");
  if (
    p.dietType !== undefined &&
    !["vegan", "vegetarian", "omnivore"].includes(p.dietType)
  )
    throw new Error("Invalid eating pattern.");
  if (
    p.allergyFoods !== undefined &&
    (!Array.isArray(p.allergyFoods) ||
      p.allergyFoods.some(
        (a) =>
          ![
            "milk",
            "egg",
            "fish",
            "shellfish",
            "wheat",
            "soy",
            "peanut",
            "tree-nut",
            "sesame",
          ].includes(a),
      ))
  )
    throw new Error("Invalid food allergy selection.");
  if (
    p.familiarFoods !== undefined &&
    (typeof p.familiarFoods !== "string" || p.familiarFoods.length > 1000)
  )
    throw new Error("Invalid familiar-food preferences.");
  if (!p.name.trim()) throw new Error("Please enter your name.");
  numeric(String(p.age), 18, 100, "Age");
  numeric(String(p.height), 100, 230, "Height (cm)");
  numeric(String(p.weight), 30, 350, "Weight (kg)");
  numeric(String(p.targetWeight), 30, 350, "Target weight");
  if (!Number.isInteger(p.age)) throw new Error("Age must be a whole number.");
  if (!p.consent)
    throw new Error("Please acknowledge how your information is used.");
  if (p.goal === "lose" && p.targetWeight >= p.weight)
    throw new Error(
      "Choose a target below your current weight for weight loss.",
    );
  if (p.goal === "gain" && p.targetWeight <= p.weight)
    throw new Error(
      "Choose a target above your current weight for weight gain.",
    );
  if (p.targetWeight / (p.height / 100) ** 2 < 18.5 && p.goal === "lose")
    throw new Error(
      "This target is below the adult BMI reference range. Weight-loss planning is unavailable for this target.",
    );
}
