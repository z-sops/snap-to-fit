import { doctorNotice } from "./safety";
import { localDay } from "./model";
import type {
  Routine,
  RoutineTimes,
  RoutineEvent,
  EducationSettings,
} from "./planning-types";
export const defaultRoutine: Routine = {
  regular: {
    wake: "07:00",
    breakfast: "08:00",
    lunch: "13:00",
    dinner: "19:00",
  },
  weekend: {
    wake: "09:00",
    breakfast: "10:00",
    lunch: "14:00",
    dinner: "20:00",
  },
  weekendDays: [0, 6],
  reminders: false,
  wakeReminder: false,
  reminderIds: [],
  timezone: "",
};
export const defaultEducation: EducationSettings = {
  enabled: false,
  frequency: "weekly",
  time: "18:00",
  weekday: 1,
  reminderIds: [],
};
export const routineLabels = {
  wake: "Wake-up",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};
export function clockMinutes(value: string) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error("Use 24-hour time as HH:MM, for example 08:30.");
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function validateRoutine(r: Routine) {
  if (
    !r ||
    !r.regular ||
    !r.weekend ||
    !Array.isArray(r.weekendDays) ||
    r.weekendDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    new Set(r.weekendDays).size !== r.weekendDays.length
  )
    throw new Error("Invalid weekend selection.");
  for (const group of [r.regular, r.weekend])
    for (const kind of ["wake", "breakfast", "lunch", "dinner"] as const)
      clockMinutes(group[kind]);
  if (
    typeof r.reminders !== "boolean" ||
    typeof r.wakeReminder !== "boolean" ||
    typeof r.timezone !== "string" ||
    !Array.isArray(r.reminderIds)
  )
    throw new Error("Invalid routine settings.");
}
export function routineTimes(r: Routine, date = new Date()): RoutineTimes {
  return r.weekendDays.includes(date.getDay()) ? r.weekend : r.regular;
}
export function reminderSpecs(r: Routine) {
  validateRoutine(r);
  if (!r.reminders) return [];
  return Array.from({ length: 7 }, (_, day) => {
    const times = r.weekendDays.includes(day) ? r.weekend : r.regular;
    return (["wake", "breakfast", "lunch", "dinner"] as const)
      .filter((kind) => kind !== "wake" || r.wakeReminder)
      .map((kind) => {
        const minute = clockMinutes(times[kind]);
        return {
          weekday: day + 1,
          hour: Math.floor(minute / 60),
          minute: minute % 60,
          kind,
          body:
            (kind === "wake"
              ? "Your planned wake-up time is here. Start your day at your own pace."
              : `Enjoy your ${kind}! Open your meal plan and record your actual meal when ready.`) +
            ` ${doctorNotice}`,
        };
      });
  }).flat();
}
export function breakfastStatus(events: RoutineEvent[], date = new Date()) {
  const latest = events
    .filter((e) => e.kind === "breakfast" && localDay(e.at) === localDay(date))
    .sort((a, b) => a.at.localeCompare(b.at))
    .at(-1);
  if (!latest) return null;
  return {
    at: latest.at,
    elapsedMinutes: Math.max(
      0,
      Math.floor((date.getTime() - new Date(latest.at).getTime()) / 60000),
    ),
  };
}
export const educationCards = [
  {
    title: "Build strength without risky shortcuts",
    text: "Non-prescribed anabolic steroid misuse can cause serious harm. Build consistency through training, recovery and varied food. Natural fitness does not mean zero risk or guaranteed results.",
  },
  {
    title: "Heart and circulation",
    text: "Anabolic steroid misuse can raise blood pressure and cholesterol and is associated with heart attack and stroke. Seek medical advice if you are using them.",
  },
  {
    title: "Hormones and fertility",
    text: "Misuse can affect fertility, sexual function and menstrual cycles. Do not assume a bodybuilding cycle protects your hormones.",
  },
  {
    title: "Liver, kidneys and mood",
    text: "Anabolic steroid misuse can harm the liver and kidneys and affect mood. Supplements labeled natural are not automatically safe.",
  },
  {
    title: "Prescribed medicines are different",
    text: "Anabolic steroids and prescribed corticosteroids are different medicines. Do not stop or change prescribed treatment because of a fitness warning.",
  },
];
export function educationCard(date = new Date()) {
  const index =
    Math.floor(new Date(localDay(date) + "T12:00:00").getTime() / 86400000) %
    educationCards.length;
  return educationCards[index];
}
export function validateEducation(e: EducationSettings) {
  if (
    !e ||
    typeof e.enabled !== "boolean" ||
    !["weekly", "daily"].includes(e.frequency) ||
    !Number.isInteger(e.weekday) ||
    e.weekday < 1 ||
    e.weekday > 7 ||
    !Array.isArray(e.reminderIds)
  )
    throw new Error("Invalid education reminders.");
  clockMinutes(e.time);
}
