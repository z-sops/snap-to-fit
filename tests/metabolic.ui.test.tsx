import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
vi.mock("expo-router", () => ({
  router: { push: vi.fn() },
  Link: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/metabolic",
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
const notifications = vi.hoisted(() => ({
  schedule: vi.fn(async () => ["routine-reminder"]),
  cancel: vi.fn(async () => {}),
}));
vi.mock("../src/services/routine-notifications", () => ({
  scheduleRoutine: notifications.schedule,
  cancelNotifications: notifications.cancel,
}));
import Metabolic from "../src/app/metabolic";
import { StoreProvider, useStore } from "../src/services/store";
import { saveState, saveSession, loadState } from "../src/services/storage";
import { emptyState, newProfile } from "../src/core/model";
function Ready() {
  const { ready } = useStore();
  return ready ? <Metabolic /> : null;
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(window, "alert").mockImplementation(() => {});
  await saveSession(null);
  await saveState({
    ...emptyState,
    profile: {
      ...newProfile,
      name: "Alex",
      age: 30,
      height: 175,
      weight: 80,
      targetWeight: 80,
      consent: true,
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
test("routine saves separate weekday/weekend times and starts actual clock only after check-in", async () => {
  render(
    <StoreProvider>
      <Ready />
    </StoreProvider>,
  );
  await screen.findByText("Set your usual times");
  fireEvent.change(screen.getByLabelText("Breakfast (regular, HH:MM)"), {
    target: { value: "08:45" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Weekend days" }));
  fireEvent.change(screen.getByLabelText("Breakfast (weekend, HH:MM)"), {
    target: { value: "10:30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save my routine" }));
  await waitFor(async () =>
    expect((await loadState()).routine?.weekend.breakfast).toBe("10:30"),
  );
  expect((await loadState()).routine?.regular.breakfast).toBe("08:45");
  expect((await loadState()).routineEvents).toBeUndefined();
  fireEvent.click(
    screen.getByRole("button", { name: "Record my breakfast time now" }),
  );
  await waitFor(async () =>
    expect((await loadState()).routineEvents?.[0].kind).toBe("breakfast"),
  );
});
test("saving with reminders invokes scheduler and invalid times do not schedule", async () => {
  render(
    <StoreProvider>
      <Ready />
    </StoreProvider>,
  );
  await screen.findByText("Set your usual times");
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "Send repeating local meal reminders on this device",
    }),
  );
  fireEvent.change(screen.getByLabelText("Breakfast (regular, HH:MM)"), {
    target: { value: "99:00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save my routine" }));
  await waitFor(() => expect(window.alert).toHaveBeenCalled());
  expect(notifications.schedule).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Breakfast (regular, HH:MM)"), {
    target: { value: "08:00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save my routine" }));
  await waitFor(async () =>
    expect((await loadState()).routine?.reminders).toBe(true),
  );
  expect((await loadState()).routine?.reminderIds).toEqual([
    "routine-reminder",
  ]);
});
