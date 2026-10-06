import { test, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  schedule: vi.fn(),
  cancel: vi.fn(),
  permission: vi.fn(),
  existing: vi.fn(),
}));
vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getAllScheduledNotificationsAsync: mocks.existing,
  requestPermissionsAsync: mocks.permission,
  scheduleNotificationAsync: mocks.schedule,
  cancelScheduledNotificationAsync: mocks.cancel,
  SchedulableTriggerInputTypes: { WEEKLY: "weekly", DAILY: "daily" },
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
}));
import {
  scheduleRoutine,
  scheduleEducation,
} from "../src/services/routine-notifications.native";
import { defaultRoutine, defaultEducation } from "../src/core/routine";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.existing.mockResolvedValue([]);
  mocks.permission.mockResolvedValue({ status: "granted" });
  let count = 0;
  mocks.schedule.mockImplementation(async () => `reminder-${++count}`);
  mocks.cancel.mockResolvedValue(undefined);
});
test("native adapter schedules 21 weekday-specific local meal reminders", async () => {
  const ids = await scheduleRoutine({ ...defaultRoutine, reminders: true });
  expect(ids.length).toBe(21);
  const calls = mocks.schedule.mock.calls.map((args) => args[0]);
  expect(
    calls.some(
      (c) =>
        c.trigger.weekday === 1 &&
        c.trigger.hour === 10 &&
        c.content.data.kind === "breakfast",
    ),
  ).toBe(true);
  expect(calls.every((c) => c.trigger.type === "weekly")).toBe(true);
});
test("partial scheduling failure cancels already-created reminders", async () => {
  mocks.schedule
    .mockResolvedValueOnce("created-before-error")
    .mockRejectedValueOnce(new Error("OS rejected schedule"));
  await expect(
    scheduleRoutine({ ...defaultRoutine, reminders: true }),
  ).rejects.toThrow("OS rejected");
  expect(mocks.cancel).toHaveBeenCalledWith("created-before-error");
});
test("denied permission or capacity never creates new reminders", async () => {
  mocks.permission.mockResolvedValueOnce({ status: "denied" });
  await expect(
    scheduleRoutine({ ...defaultRoutine, reminders: true }),
  ).rejects.toThrow("not permitted");
  expect(mocks.schedule).not.toHaveBeenCalled();
  mocks.existing.mockResolvedValue(Array.from({ length: 50 }, () => ({})));
  await expect(
    scheduleRoutine({ ...defaultRoutine, reminders: true }),
  ).rejects.toThrow("many reminders");
  expect(mocks.schedule).not.toHaveBeenCalled();
});
test("education reminder opt-in uses selected frequency and age restriction", async () => {
  expect(await scheduleEducation(defaultEducation, 30)).toEqual([]);
  await expect(
    scheduleEducation({ ...defaultEducation, enabled: true }, 51),
  ).rejects.toThrow("18–50");
  await scheduleEducation(
    { ...defaultEducation, enabled: true, frequency: "daily" },
    25,
  );
  expect(mocks.schedule.mock.calls[0][0].trigger.type).toBe("daily");
});
