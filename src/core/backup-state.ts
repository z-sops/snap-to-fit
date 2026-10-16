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
  // Photos never leave the device: progress photos, meal photo thumbnails and photo avatars.
  const clean = withoutDeviceReminders(s);
  return {
    ...clean,
    photos: [],
    meals: clean.meals.map(({ photoUri: _photo, ...m }) => m),
    profile: clean.profile?.avatar?.photoUri ? { ...clean.profile, avatar: { ...clean.profile.avatar, photoUri: undefined } } : clean.profile,
  };
}
