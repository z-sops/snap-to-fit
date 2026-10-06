import { doctorNotice } from "../core/safety";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
export async function scheduleReminder(date: Date) {
  if (date.getTime() <= Date.now())
    throw new Error("Choose a future reminder date and time.");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Private reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error(
      "Notifications were not allowed. Your schedule is still saved.",
    );
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Snap to Fit",
      body: `You have a scheduled reminder. Open the app to review it. ${doctorNotice}`,
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: "reminders",
    },
  });
}
export async function cancelReminder(id: string) {
  await Notifications.cancelScheduledNotificationAsync(id);
}
