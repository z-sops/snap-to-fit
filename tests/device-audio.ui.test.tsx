import React from "react";
import { test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("expo-router", () => ({ usePathname: () => "/music", router: { navigate: vi.fn() } }));
import { DeviceAudioPicker } from "../src/components/DeviceAudioPicker";

afterEach(() => cleanup());

const songs = [
  { id: "1", name: "Morning Run.mp3", durationMs: 185000 },
  { id: "2", name: "Leg Day Beats.m4a", durationMs: 242000 },
];
function source(granted: boolean, canAskAgain = true, tracks = songs) {
  return {
    deviceAudioPermission: vi.fn(async () => ({ granted, canAskAgain })),
    listDeviceAudio: vi.fn(async () => tracks),
  };
}

test("in-app song list: Back button, search, and picking a song closes the list", async () => {
  const onClose = vi.fn(), onPick = vi.fn();
  const src = source(true);
  render(<DeviceAudioPicker open onClose={onClose} onPick={onPick} source={src} />);
  expect(screen.getByRole("button", { name: "Back to Snap to Fit" })).toBeTruthy();
  expect(await screen.findByRole("button", { name: "Play Morning Run.mp3" })).toBeTruthy();
  expect(screen.getByText("3:05")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Search your songs"), { target: { value: "leg" } });
  expect(screen.queryByRole("button", { name: "Play Morning Run.mp3" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Play Leg Day Beats.m4a" }));
  expect(onPick).toHaveBeenCalledWith(songs[1]);
  expect(onClose).toHaveBeenCalled();
  expect(src.deviceAudioPermission).toHaveBeenCalledWith(true);
});

test("Back returns to the app without choosing", async () => {
  const onClose = vi.fn(), onPick = vi.fn();
  render(<DeviceAudioPicker open onClose={onClose} onPick={onPick} source={source(true)} />);
  await screen.findByRole("button", { name: "Play Morning Run.mp3" });
  fireEvent.click(screen.getByRole("button", { name: "Back to Snap to Fit" }));
  expect(onClose).toHaveBeenCalled();
  expect(onPick).not.toHaveBeenCalled();
});

test("denied permission explains, offers settings and a way back; no songs are listed", async () => {
  const onClose = vi.fn();
  const src = source(false, false);
  render(<DeviceAudioPicker open onClose={onClose} onPick={vi.fn()} source={src} />);
  expect(await screen.findByText("Allow access to your music")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open phone settings" })).toBeTruthy();
  expect(screen.queryByText(/Browse Files/)).toBeNull();
  expect(src.listDeviceAudio).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Back to Music" }));
  expect(onClose).toHaveBeenCalled();
});

test("empty library says so and can check again, without the Files picker", async () => {
  render(<DeviceAudioPicker open onClose={vi.fn()} onPick={vi.fn()} source={source(true, true, [])} />);
  expect(await screen.findByText("No songs found on this phone")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
  expect(screen.queryByText(/Browse Files/)).toBeNull();
});
