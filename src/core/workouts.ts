import { type Profile, type Place, type WorkoutLog } from "./model";
export interface Exercise {
  id: string;
  name: string;
  muscle: string;
  place: Place[];
  motion:
    | "squat"
    | "press"
    | "row"
    | "curl"
    | "walk"
    | "hinge"
    | "pushup"
    | "lunge"
    | "plank"
    | "bridge"
    | "raise"
    | "chestPress"
    | "calf"
    | "pulldown"
    | "triceps"
    | "deadbug"
    | "cycle";
  cues: string[];
  equipment: string;
}
export const exercises: Exercise[] = [
  {
    id: "squat",
    name: "Bodyweight squat",
    muscle: "Quads · glutes",
    place: ["home", "gym"],
    motion: "squat",
    equipment: "Bodyweight",
    cues: [
      "Keep feet planted and knees following your toes.",
      "Use a comfortable range; stop for pain.",
      "Move under control and keep breathing.",
    ],
  },
  {
    id: "press",
    name: "Seated dumbbell shoulder press",
    muscle: "Shoulders · triceps",
    place: ["gym"],
    motion: "press",
    equipment: "Dumbbells + bench",
    cues: [
      "Use a light load you can control.",
      "Keep ribs stacked over hips.",
      "Press without locking out aggressively.",
    ],
  },
  {
    id: "row",
    name: "Standing band row",
    muscle: "Back · biceps",
    place: ["home", "gym"],
    motion: "row",
    equipment: "Secure resistance band",
    cues: [
      "Check that the band anchor is secure.",
      "Pull elbows back with shoulders relaxed.",
      "Return slowly; avoid jerking.",
    ],
  },
  {
    id: "curl",
    name: "Dumbbell biceps curl",
    muscle: "Biceps",
    place: ["home", "gym"],
    motion: "curl",
    equipment: "Dumbbells",
    cues: [
      "Keep upper arms beside your torso.",
      "Avoid swinging or arching your back.",
      "Lower the weight slowly.",
    ],
  },
  {
    id: "hinge",
    name: "Bodyweight hip hinge",
    muscle: "Glutes · hamstrings",
    place: ["home", "gym"],
    motion: "hinge",
    equipment: "Bodyweight",
    cues: [
      "Soften your knees and move hips back.",
      "Maintain a comfortable neutral spine.",
      "Practice without load first.",
    ],
  },
  {
    id: "walk",
    name: "Comfortable walk",
    muscle: "Whole body · aerobic",
    place: ["walk", "home", "gym"],
    motion: "walk",
    equipment: "Comfortable shoes",
    cues: [
      "Choose a comfortable pace.",
      "You should be able to talk.",
      "Stop if you feel chest pain, faintness or unusual breathlessness.",
    ],
  },
];
const additional: {
  id: string;
  name: string;
  muscle: string;
  motion: Exercise["motion"];
  equipment: string;
  place: Place[];
  cues: string[];
}[] = [
  {
    id: "goblet-squat",
    name: "Goblet squat",
    muscle: "Quads · glutes",
    motion: "squat",
    equipment: "Dumbbell",
    place: ["gym", "home"],
    cues: [
      "Hold the weight close to your chest.",
      "Keep feet planted; move through a comfortable range.",
    ],
  },
  {
    id: "pushup",
    name: "Floor push-up",
    muscle: "Chest · triceps",
    motion: "pushup",
    equipment: "Mat",
    place: ["gym", "home"],
    cues: [
      "Keep your body aligned.",
      "Lower under control; choose an incline variation if needed.",
    ],
  },
  {
    id: "incline-pushup",
    name: "Incline push-up",
    muscle: "Chest · triceps",
    motion: "pushup",
    equipment: "Stable raised surface",
    place: ["gym", "home"],
    cues: [
      "Use a stable surface that cannot move.",
      "Keep shoulders and hips aligned.",
    ],
  },
  {
    id: "chest-press",
    name: "Dumbbell chest press",
    muscle: "Chest · triceps",
    motion: "chestPress",
    equipment: "Dumbbells + bench",
    place: ["gym"],
    cues: [
      "Start light and use a stable bench.",
      "Keep wrists stacked; lower to a comfortable depth.",
    ],
  },
  {
    id: "lunge",
    name: "Reverse lunge",
    muscle: "Quads · glutes",
    motion: "lunge",
    equipment: "Bodyweight",
    place: ["gym", "home"],
    cues: [
      "Step back with control.",
      "Keep your front foot planted; use support if balance is difficult.",
    ],
  },
  {
    id: "plank",
    name: "Forearm plank",
    muscle: "Core",
    motion: "plank",
    equipment: "Mat",
    place: ["gym", "home"],
    cues: [
      "Keep ribs and hips aligned.",
      "Breathe continuously; stop before your position collapses.",
    ],
  },
  {
    id: "bridge",
    name: "Glute bridge",
    muscle: "Glutes · core",
    motion: "bridge",
    equipment: "Mat",
    place: ["gym", "home"],
    cues: [
      "Plant your feet and lift your hips without arching your back.",
      "Move slowly and keep breathing.",
    ],
  },
  {
    id: "lateral-raise",
    name: "Dumbbell lateral raise",
    muscle: "Shoulders",
    motion: "raise",
    equipment: "Light dumbbells",
    place: ["gym", "home"],
    cues: [
      "Use light weights and relaxed shoulders.",
      "Raise with control to a comfortable height.",
    ],
  },
  {
    id: "rdl",
    name: "Dumbbell Romanian deadlift",
    muscle: "Hamstrings · glutes",
    motion: "hinge",
    equipment: "Dumbbells",
    place: ["gym", "home"],
    cues: [
      "Keep weights close to your legs.",
      "Hinge at the hips; avoid rounding or forcing depth.",
    ],
  },
  {
    id: "calf",
    name: "Standing calf raise",
    muscle: "Calves",
    motion: "calf",
    equipment: "Stable support",
    place: ["gym", "home"],
    cues: [
      "Hold a stable support if needed.",
      "Rise and lower slowly through a comfortable range.",
    ],
  },
  {
    id: "pulldown",
    name: "Lat pulldown",
    muscle: "Back · biceps",
    motion: "pulldown",
    equipment: "Cable machine",
    place: ["gym"],
    cues: [
      "Adjust the thigh pad securely.",
      "Pull in front of your head with relaxed shoulders.",
    ],
  },
  {
    id: "triceps",
    name: "Standing band triceps pressdown",
    muscle: "Triceps",
    motion: "triceps",
    equipment: "Secure resistance band",
    place: ["gym", "home"],
    cues: [
      "Check your band anchor.",
      "Keep elbows beside you and extend under control.",
    ],
  },
  {
    id: "hammer-curl",
    name: "Dumbbell hammer curl",
    muscle: "Biceps · forearms",
    motion: "curl",
    equipment: "Dumbbells",
    place: ["gym", "home"],
    cues: ["Keep palms facing inward.", "Avoid swinging your torso."],
  },
  {
    id: "deadbug",
    name: "Dead bug",
    muscle: "Core",
    motion: "deadbug",
    equipment: "Mat",
    place: ["gym", "home"],
    cues: [
      "Keep your lower back comfortable and ribs controlled.",
      "Extend opposite limbs without arching your back.",
    ],
  },
  {
    id: "cycle",
    name: "Easy stationary cycling",
    muscle: "Aerobic · legs",
    motion: "cycle",
    equipment: "Stationary bike",
    place: ["gym"],
    cues: [
      "Set saddle height before starting.",
      "Use a comfortable pace and resistance.",
    ],
  },
];
exercises.push(...additional);
export function workoutPlan(p: Profile, place: Place, session: number) {
  const restricted =
    p.conditions.length > 0 ||
    p.insulin ||
    !!p.medicines.trim() ||
    !!p.injuries.trim();
  if (restricted)
    return {
      restricted: true,
      title: "Exercise library",
      note: "Personalized intensity and scheduling are paused for your health context. Follow your existing care plan; these demonstrations are educational.",
      items: exercises.filter((e) => e.place.includes(place)),
      sets: 0,
      reps: 0,
    };
  const groups =
    place === "walk"
      ? [["walk"]]
      : place === "home"
        ? [
            ["squat", "row", "hinge"],
            ["row", "curl", "squat"],
          ]
        : [
            ["squat", "row", "hinge"],
            ["press", "curl", "row"],
            ["hinge", "squat", "press"],
          ];
  const chosen = groups[session % groups.length];
  return {
    restricted: false,
    title:
      place === "walk"
        ? "Walking day"
        : place === "home"
          ? "Home strength"
          : session % 3 === 1
            ? "Shoulders + arms"
            : "Full-body strength",
    note: "Warm up gently. Use comfortable loads and leave recovery time between strength sessions. Sets and reps are starting suggestions.",
    items: chosen.map((id) => exercises.find((e) => e.id === id)!),
    sets: p.experience === "beginner" ? 2 : 3,
    reps: 10,
  };
}
export function lastPerformance(logs: WorkoutLog[], id: string) {
  return [...logs].reverse().find((l) => l.exerciseId === id);
}
