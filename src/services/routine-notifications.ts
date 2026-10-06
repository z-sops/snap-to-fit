import type { Routine, EducationSettings } from "../core/planning-types";
export async function scheduleRoutine(_r: Routine): Promise<string[]> {
  throw new Error(
    "Routine notifications require an Android or iPhone development build. Your routine can still be saved without notifications.",
  );
}
export async function scheduleEducation(
  _e: EducationSettings,
  _age: number,
): Promise<string[]> {
  throw new Error(
    "Education notifications require an Android or iPhone device build.",
  );
}
export async function cancelNotifications(_ids: string[]): Promise<void> {}
