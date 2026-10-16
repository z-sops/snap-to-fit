import { vi } from "vitest";
import React from "react";
// Native-only modules used by the redesigned screens.
vi.mock("expo-camera", () => ({
  CameraView: () => React.createElement("div", { "data-testid": "camera" }),
  useCameraPermissions: () => [{ granted: false, canAskAgain: true }, vi.fn()],
}));
vi.mock("expo-haptics", () => ({
  notificationAsync: vi.fn(), selectionAsync: vi.fn(), impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success", Warning: "warning" }, ImpactFeedbackStyle: { Light: "light" },
}));
vi.mock("expo-speech", () => ({ speak: vi.fn(), stop: vi.fn(async () => {}), isSpeakingAsync: vi.fn(async () => false) }));
