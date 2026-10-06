import React from "react";
import { test, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StoreProvider, useStore } from "../src/services/store";
import { emptyState, newProfile } from "../src/core/model";
import { saveState, saveSession } from "../src/services/storage";
function Harness() {
  const { state, ready, namespace, update, switchAccount } = useStore();
  return (
    <div>
      <span>{ready ? "ready" : "loading"}</span>
      <span data-testid="identity">{namespace}</span>
      <span data-testid="profile">{state.profile?.name || "empty"}</span>
      <button onClick={() => switchAccount("other")}>Switch</button>
      <button
        onClick={() => {
          void update((s) => ({
            ...s,
            messages: [...s.messages, { id: "1", role: "user", text: "one" }],
          }));
          void update((s) => ({
            ...s,
            messages: [...s.messages, { id: "2", role: "user", text: "two" }],
          }));
        }}
      >
        Log twice
      </button>
      <span data-testid="count">{state.messages.length}</span>
    </div>
  );
}
test("store serializes concurrent writes and switches to isolated account state", async () => {
  await saveSession(null);
  await saveState(
    { ...emptyState, profile: { ...newProfile, name: "Guest" } },
    "guest",
  );
  await saveState(emptyState, "other");
  render(
    <StoreProvider>
      <Harness />
    </StoreProvider>,
  );
  await screen.findByText("ready");
  expect(screen.getByTestId("profile").textContent).toBe("Guest");
  fireEvent.click(screen.getByText("Log twice"));
  await waitFor(() =>
    expect(screen.getByTestId("count").textContent).toBe("2"),
  );
  fireEvent.click(screen.getByText("Switch"));
  await waitFor(() =>
    expect(screen.getByTestId("identity").textContent).toBe("other"),
  );
  expect(screen.getByTestId("profile").textContent).toBe("empty");
  expect(screen.getByTestId("count").textContent).toBe("0");
});
