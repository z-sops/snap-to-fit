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
vi.mock("react-native-svg", () => {
  const el = (tag: string) => (props: React.PropsWithChildren<Record<string, unknown>>) => React.createElement(tag, { "data-svg": tag }, props.children as React.ReactNode);
  return { default: el("svg"), Svg: el("svg"), Rect: el("rect"), Line: el("line"), Path: el("path"), Circle: el("circle"), G: el("g"), Text: el("text") };
});
