// 870+ exercise library (free-exercise-db, public domain) with muscle/equipment/level
// filters and profile-aware safety: exercises that conflict with a user's conditions or
// movement limits are hidden or flagged "ask your physical therapist first".
import type { Profile } from "./model";

export interface LibraryExercise {
  id: string;
  name: string;
  category: string;
  level: "beginner" | "intermediate" | "expert";
  equipment: string;
  force: string;
  mechanic: string;
  primary: string[];
  secondary: string[];
  steps: string[];
  images: string[];
}
type Row = [string, string, string, LibraryExercise["level"], string, string, string, string[], string[], string[], number];

/** Media host; defaults to the public dataset on GitHub until we self-host on our CDN. */
export const mediaBase =
  process.env.EXPO_PUBLIC_EXERCISE_MEDIA_URL || "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

let cache: LibraryExercise[] | null = null;
export function library(): LibraryExercise[] {
  if (!cache) {
    const data = require("../data/exercises.json") as { exercises: Row[] };
    cache = data.exercises.map((r) => ({
      id: r[0], name: r[1], category: r[2], level: r[3], equipment: r[4], force: r[5], mechanic: r[6],
      primary: r[7], secondary: r[8], steps: r[9],
      images: Array.from({ length: r[10] }, (_, i) => `${mediaBase}/${r[0]}/${i}.jpg`),
    }));
  }
  return cache;
}
export const exerciseById = (id: string) => library().find((e) => e.id === id) || null;

export const muscleGroups: { id: string; label: string; emoji: string; muscles: string[] }[] = [
  { id: "chest", label: "Chest", emoji: "🫁", muscles: ["chest"] },
  { id: "back", label: "Back", emoji: "🔙", muscles: ["lats", "middle back", "lower back", "traps"] },
  { id: "shoulders", label: "Shoulders", emoji: "🤷", muscles: ["shoulders"] },
  { id: "arms", label: "Arms", emoji: "💪", muscles: ["biceps", "triceps", "forearms"] },
  { id: "legs", label: "Legs", emoji: "🦵", muscles: ["quadriceps", "hamstrings", "calves", "adductors", "abductors"] },
  { id: "glutes", label: "Glutes", emoji: "🍑", muscles: ["glutes"] },
  { id: "core", label: "Core", emoji: "🎯", muscles: ["abdominals"] },
  { id: "cardio", label: "Cardio", emoji: "❤️", muscles: [] },
  { id: "stretch", label: "Stretch", emoji: "🧘", muscles: [] },
];
export const equipmentGroups: { id: string; label: string; match: string[] }[] = [
  { id: "body", label: "No equipment", match: ["body only"] },
  { id: "home", label: "Home (bands, dumbbells, kettlebell)", match: ["body only", "bands", "dumbbell", "kettlebells", "exercise ball", "medicine ball", "foam roll"] },
  { id: "dumbbell", label: "Dumbbells", match: ["dumbbell"] },
  { id: "barbell", label: "Barbell", match: ["barbell", "e-z curl bar"] },
  { id: "machine", label: "Machines & cables", match: ["machine", "cable"] },
];

export interface SafetyNote { level: "hide" | "caution"; reason: string }

const has = (e: LibraryExercise, re: RegExp) => re.test(e.name);
/** Why an exercise may not suit this person, from their own profile details. */
export function safetyFor(e: LibraryExercise, p: Pick<Profile, "age" | "conditions" | "limits" | "experience">): SafetyNote | null {
  const limits = p.limits || [];
  const heavy = ["powerlifting", "olympic weightlifting", "strongman"].includes(e.category);
  const jumping = e.category === "plyometrics" || has(e, /jump|hop|bound|skip/i);
  if (p.conditions.includes("heart") || p.conditions.includes("hypertension")) {
    if (heavy) return { level: "hide", reason: "Maximal and Olympic lifts spike blood pressure. Ask your cardiologist before lifting heavy." };
  }
  if (p.conditions.includes("pregnant") && (heavy || jumping || e.primary.includes("abdominals") && has(e, /crunch|sit-up|v-up|leg raise/i)))
    return { level: "hide", reason: "Not recommended in pregnancy without your obstetric care team's OK." };
  if (limits.includes("lower-back")) {
    if (e.primary.includes("lower back") || has(e, /deadlift|good morning|hyperextension|back squat|full squat|clean|snatch|sit-up|crunch|v-up|jackknife/i) || heavy)
      return { level: "hide", reason: "Heavy spinal loading, bending under load and repeated crunching can aggravate a disc. Ask your physical therapist first." };
    if (e.equipment === "barbell" && has(e, /squat|row|lunge/i)) return { level: "caution", reason: "Barbell loading through the spine — start with machine or supported versions." };
  }
  if (limits.includes("neck")) {
    if (e.primary.includes("neck") || has(e, /behind the neck|neck press|shrug|headstand|neck bridge/i))
      return { level: "hide", reason: "Loads the neck directly. Ask your physical therapist first." };
    if (e.equipment === "barbell" && has(e, /overhead|shoulder press|military/i)) return { level: "caution", reason: "Heavy overhead pressing loads the neck — keep it light and pain-free." };
  }
  if (limits.includes("knee") || limits.includes("knee-replacement")) {
    if (jumping) return { level: "hide", reason: "Jumping and landing are high-impact on the knee." };
    if (limits.includes("knee-replacement") && has(e, /kneeling|pistol|sissy/i)) return { level: "hide", reason: "Deep knee bending and kneeling stress a new knee — follow your surgeon's plan." };
    if (has(e, /lunge|full squat|pistol|sissy|hack squat|jefferson/i)) return { level: "caution", reason: "Deep knee bending — use a pain-free range or a supported version." };
  }
  if (limits.includes("shoulder")) {
    if (has(e, /behind the neck|upright row|dip|kipping|snatch/i)) return { level: "hide", reason: "A position that commonly irritates sore shoulders." };
    if (e.primary.includes("shoulders") && e.equipment === "barbell") return { level: "caution", reason: "Use dumbbells or cables and a pain-free range." };
  }
  if (p.age >= 65 && (heavy || jumping)) return { level: "caution", reason: "High-impact or maximal lifts — check with your doctor and build up slowly." };
  if (p.experience === "beginner" && e.level === "expert") return { level: "caution", reason: "Advanced technique — learn it with a coach first." };
  return null;
}

export interface LibraryFilter { query?: string; group?: string; equipment?: string; level?: string }
export function filterLibrary(f: LibraryFilter, p?: Pick<Profile, "age" | "conditions" | "limits" | "experience">) {
  const q = (f.query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const group = muscleGroups.find((g) => g.id === f.group);
  const eq = equipmentGroups.find((g) => g.id === f.equipment);
  const out: { e: LibraryExercise; safety: SafetyNote | null }[] = [];
  for (const e of library()) {
    if (q.length && !q.every((w) => `${e.name} ${e.primary.join(" ")} ${e.equipment}`.toLowerCase().includes(w))) continue;
    if (group) {
      if (group.id === "cardio" ? e.category !== "cardio" : group.id === "stretch" ? e.category !== "stretching" : !e.primary.some((m) => group.muscles.includes(m))) continue;
    }
    if (eq && !eq.match.includes(e.equipment)) continue;
    if (f.level && e.level !== f.level) continue;
    const safety = p ? safetyFor(e, p) : null;
    if (safety?.level === "hide") continue;
    out.push({ e, safety });
  }
  const rank = { beginner: 0, intermediate: 1, expert: 2 };
  return out.sort((a, b) => Number(!!a.safety) - Number(!!b.safety) || rank[a.e.level] - rank[b.e.level] || a.e.name.localeCompare(b.e.name));
}

/** Library picture for the app's built-in plan exercises. */
export const planExerciseMedia: Record<string, string> = {
  squat: "Bodyweight_Squat", press: "Dumbbell_Shoulder_Press", row: "Bent_Over_Two-Dumbbell_Row", curl: "Dumbbell_Bicep_Curl",
  hinge: "Band_Good_Morning", walk: "Walking_Treadmill", "goblet-squat": "Goblet_Squat", pushup: "Pushups",
  "incline-pushup": "Incline_Push-Up", "chest-press": "Leverage_Chest_Press", lunge: "Dumbbell_Lunges", plank: "Plank",
  bridge: "Butt_Lift_Bridge", "lateral-raise": "Side_Lateral_Raise", rdl: "Romanian_Deadlift", calf: "Standing_Calf_Raises",
  pulldown: "Wide-Grip_Lat_Pulldown", triceps: "Triceps_Pushdown", "hammer-curl": "Hammer_Curls", deadbug: "Dead_Bug",
  cycle: "Bicycling_Stationary",
};
export const planImage = (id: string) => (planExerciseMedia[id] ? `${mediaBase}/${planExerciseMedia[id]}/0.jpg` : undefined);
