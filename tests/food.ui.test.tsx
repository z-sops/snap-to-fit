import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
vi.mock("expo-router", () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/food",
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("../src/services/photos", () => ({
  pickPhoto: vi.fn(async () => ({
    uri: "data:image/jpeg;base64,YQ==",
    data: "YQ==",
    mimeType: "image/jpeg",
  })),
}));
vi.mock("../src/services/api", () => ({
  api: vi.fn(async () => ({
    name: "Estimated meal",
    calories: 400,
    protein: 30,
    carbs: 40,
    fat: 13,
    fibre: 4,
    uncertainty: "Review portion size.",
  })),
}));
import Food from "../src/app/food";
import { StoreProvider, useStore } from "../src/services/store";
import { emptyState, newProfile } from "../src/core/model";
import { saveState, saveSession, loadState } from "../src/services/storage";
import { pickPhoto } from "../src/services/photos";
function ReadyFood() {
  const { ready } = useStore();
  return ready ? <Food /> : null;
}
const profile = {
  ...newProfile,
  name: "Alex",
  age: 30,
  height: 175,
  weight: 80,
  targetWeight: 80,
  consent: true,
};
beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(window, "alert").mockImplementation(() => {});
  await saveSession(null);
  await saveState({ ...emptyState, profile }, "guest");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
test("manual meal updates totals, persists decimals, and can be removed", async () => {
  render(
    <StoreProvider>
      <ReadyFood />
    </StoreProvider>,
  );
  await screen.findByText("Log a meal manually");
  for (const [label, value] of [
    ["Meal and portion description", "Chicken bowl"],
    ["Calories (kcal)", "501.5"],
    ["Protein (g)", "40.5"],
    ["Carbs (g)", "50"],
    ["Fat (g)", "15"],
    ["Fibre (g)", "6"],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
  await screen.findByText("Chicken bowl");
  expect((await loadState()).meals[0].calories).toBe(501.5);
  fireEvent.click(screen.getByRole("button", { name: "Remove entry" }));
  await screen.findByText("No meals yet. Your first entry starts the story.");
  expect((await loadState()).meals.length).toBe(0);
});
test("camera processing is blocked until separate AI consent", async () => {
  render(
    <StoreProvider>
      <ReadyFood />
    </StoreProvider>,
  );
  await screen.findByText("Food photo");
  fireEvent.click(screen.getByRole("button", { name: "Take a snap" }));
  await waitFor(() => expect(window.alert).toHaveBeenCalled());
  expect(pickPhoto).not.toHaveBeenCalled();
});
test("photo estimate requires explicit review before logging", async () => {
  await saveState({ ...emptyState, profile: { ...profile, aiConsent: true } });
  render(
    <StoreProvider>
      <ReadyFood />
    </StoreProvider>,
  );
  await screen.findByText("Food photo");
  fireEvent.click(screen.getByRole("button", { name: "Choose photo" }));
  await screen.findByText("Review your meal estimate");
  expect((await loadState()).meals.length).toBe(0);
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm portions & save" }),
  );
  await screen.findByText("Estimated meal");
  expect((await loadState()).meals[0].source).toBe("photo");
});

test("medical photo review pauses confirmation but still allows accurate logging after acknowledgement", async () => {
  await saveState({
    ...emptyState,
    profile: { ...profile, aiConsent: true, conditions: ["type2"] },
  });
  render(
    <StoreProvider>
      <ReadyFood />
    </StoreProvider>,
  );
  await screen.findByText("Food photo");
  expect(
    screen.getByText(
      "Share this with your doctor. Apply these suggestions as advised by your doctor.",
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Choose photo" }));
  await screen.findByText("Check before choosing this meal");
  const confirm = screen.getByRole("button", {
    name: "Confirm portions & save",
  });
  expect(
    confirm.getAttribute("aria-disabled") === "true" ||
      confirm.hasAttribute("disabled"),
  ).toBe(true);
  expect((await loadState()).meals.length).toBe(0);
  fireEvent.click(
    screen.getByRole("checkbox", { name: /I reviewed the concerns/ }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm portions & save" }),
  );
  await screen.findByText("Estimated meal");
  expect((await loadState()).meals.length).toBe(1);
});
