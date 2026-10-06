import type { State } from "./model";
export function withoutDeviceReminders(s: State): State {
  return {
    ...s,
    medicines: s.medicines.map(({ reminderId, ...m }) => m),
    routine: s.routine
      ? { ...s.routine, reminders: false, reminderIds: [] }
      : undefined,
    education: s.education
      ? { ...s.education, enabled: false, reminderIds: [] }
      : undefined,
  };
}
export function backupState(s: State): State {
  return { ...withoutDeviceReminders(s), photos: [] };
}
