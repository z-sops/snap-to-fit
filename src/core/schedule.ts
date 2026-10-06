import { exercises, type Exercise } from "./workouts";
import { localDay, type Profile, type WorkoutLog, type Place } from "./model";
export interface ScheduledDay {
  date: string;
  weekday: string;
  title: string;
  rest: boolean;
  restricted: boolean;
  items: Exercise[];
  sets: number;
  reps: number;
  duration: number;
  completed: boolean;
}
const daysByCount: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 5, 6],
};
export function isRestricted(p: Profile) {
  return (
    p.conditions.length > 0 ||
    p.insulin ||
    !!p.medicines.trim() ||
    !!p.injuries.trim()
  );
}
export function weeklySchedule(
  p: Profile,
  logs: WorkoutLog[],
  place: Place,
  date = new Date(),
): ScheduledDay[] {
  const monday = new Date(date);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const selected = daysByCount[p.days] || daysByCount[3];
  const split =
    p.experience === "beginner" || p.days <= 3
      ? "full"
      : p.days === 4
        ? "upperlower"
        : "ppl";
  const groups =
    place === "walk"
      ? [{ title: "Comfortable walk", ids: ["walk"] }]
      : place === "home"
        ? [
            {
              title: "Full body A",
              ids: ["squat", "pushup", "row", "bridge", "plank"],
            },
            {
              title: "Full body B",
              ids: ["lunge", "incline-pushup", "hinge", "curl", "deadbug"],
            },
          ]
        : split === "full"
          ? [
              {
                title: "Full body A",
                ids: ["goblet-squat", "chest-press", "row", "hinge", "plank"],
              },
              {
                title: "Full body B",
                ids: ["lunge", "press", "pulldown", "curl", "bridge"],
              },
            ]
          : split === "upperlower"
            ? [
                {
                  title: "Upper body",
                  ids: ["chest-press", "row", "press", "curl", "triceps"],
                },
                {
                  title: "Lower body + core",
                  ids: ["goblet-squat", "rdl", "lunge", "calf", "plank"],
                },
              ]
            : [
                {
                  title: "Push · chest, shoulders & triceps",
                  ids: ["chest-press", "press", "lateral-raise", "triceps"],
                },
                {
                  title: "Pull · back & biceps",
                  ids: ["pulldown", "row", "curl", "hammer-curl"],
                },
                {
                  title: "Legs + core",
                  ids: ["goblet-squat", "rdl", "lunge", "calf", "plank"],
                },
              ];
  let index = 0;
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + offset);
    const active = selected.includes(day.getDay());
    const group = groups[index % groups.length];
    if (active) index++;
    const restricted = isRestricted(p);
    return {
      date: localDay(day),
      weekday: day.toLocaleDateString("en", { weekday: "short" }),
      title: restricted
        ? "Follow your existing care plan"
        : active
          ? group.title
          : "Recovery day",
      rest: !active,
      restricted,
      items: active
        ? group.ids
            .map((id) => exercises.find((e) => e.id === id)!)
            .filter(Boolean)
        : [],
      sets: restricted ? 0 : p.experience === "beginner" ? 2 : 3,
      reps: restricted ? 0 : 10,
      duration: restricted ? 0 : place === "walk" ? 20 : 35,
      completed: logs.some((l) => localDay(l.at) === localDay(day)),
    };
  });
}
export function progressionSuggestion(logs: WorkoutLog[], id: string) {
  const recent = logs.filter((l) => l.exerciseId === id).slice(-2);
  if (recent.length < 2)
    return "Start with a comfortable load. Record two sessions to compare your progress.";
  const [a, b] = recent;
  if (b.weight < a.weight || b.reps < a.reps)
    return "Keep the load comfortable while you rebuild consistency. Progress is not always an increase.";
  return "If the last two sessions felt controlled and you recovered well, consider a small increase next time. Keep the same load if form or comfort changes.";
}
