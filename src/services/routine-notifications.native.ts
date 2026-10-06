import { doctorNotice } from "../core/safety";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Routine, EducationSettings } from "../core/planning-types";
import {
  reminderSpecs,
  clockMinutes,
  validateEducation,
} from "../core/routine";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
async function prepare(count = 1) {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  if (existing.length + count > 60)
    throw new Error(
      "This device already has many reminders. Remove unused reminders before adding this routine; medicine reminders will be kept.",
    );
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("routine", {
      name: "Routine and education",
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error(
      "Notifications are not permitted. Your schedule is saved; enable notifications in device settings to activate reminders.",
    );
}
export async function cancelNotifications(ids: string[]) {
  for (const id of ids)
    await Notifications.cancelScheduledNotificationAsync(id);
}
export async function scheduleRoutine(r: Routine) {
  const specs = reminderSpecs(r);
  if (!specs.length) return [];
  await prepare(specs.length);
  const ids: string[] = [];
  try {
    for (const spec of specs)
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Snap to Fit",
            body: spec.body,
            sound: false,
            data: { screen: "/metabolic", kind: spec.kind },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: spec.weekday,
            hour: spec.hour,
            minute: spec.minute,
            channelId: "routine",
          },
        }),
      );
    return ids;
  } catch (e) {
    await cancelNotifications(ids);
    throw e;
  }
}
export async function scheduleEducation(e: EducationSettings, age: number) {
  validateEducation(e);
  if (!e.enabled) return [];
  if (age < 18 || age > 50)
    throw new Error(
      "Scheduled steroid-awareness messages are available for ages 18–50. Education remains available to everyone.",
    );
  await prepare();
  const minutes = clockMinutes(e.time);
  return [
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Snap to Fit · Build strength safely",
        body: `Avoid non-prescribed anabolic steroids. Open the app for today’s education and practical fitness habits. ${doctorNotice}`,
        sound: false,
        data: { screen: "/education" },
      },
      trigger:
        e.frequency === "daily"
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: Math.floor(minutes / 60),
              minute: minutes % 60,
              channelId: "routine",
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: e.weekday,
              hour: Math.floor(minutes / 60),
              minute: minutes % 60,
              channelId: "routine",
            },
    }),
  ];
}
