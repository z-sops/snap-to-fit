import React from "react";
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
const camera = vi.hoisted(() => ({ granted: false, canAskAgain: true }));
vi.mock("expo-camera", () => ({
  CameraView: () => React.createElement("div", { "data-testid": "camera" }),
  useCameraPermissions: () => [{ granted: camera.granted, canAskAgain: camera.canAskAgain }, vi.fn()],
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
// The scanner only offers the camera on a phone, so the platform is set to iOS.
vi.mock("react-native", async () => {
  const actual = (await vi.importActual("react-native-web")) as Record<string, unknown>;
  return { ...actual, Platform: { ...(actual.Platform as object), OS: "ios" } };
});
vi.mock("expo-router", () => ({
  usePathname: () => "/food",
  router: { navigate: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => false },
}));
vi.mock("../src/services/barcode", () => ({ lookupBarcode: vi.fn() }));
import { BarcodeScanner } from "../src/components/food/BarcodeScanner";
import { lookupBarcode } from "../src/services/barcode";

const lookup = vi.mocked(lookupBarcode);

/** The failure the lookup service reports. */
class LookupFailure extends Error {
  kind: string;
  constructor(kind: string) {
    super(kind);
    this.kind = kind;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  camera.granted = false;
  camera.canAskAgain = true;
});
afterEach(() => cleanup());

const renderScanner = () =>
  render(
    <BarcodeScanner
      visible
      onClose={() => {}}
      onFound={() => {}}
      onSearchInstead={() => {}}
    />,
  );

const findProduct = async () => {
  fireEvent.change(await screen.findByLabelText("Barcode number"), {
    target: { value: "012345678905" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find product" }));
};

test("without camera permission the user is offered the type-in fallback", async () => {
  renderScanner();
  expect(await screen.findByText("Allow the camera to scan barcodes")).toBeTruthy();
  expect(screen.getByText("Or type the number")).toBeTruthy();
  expect(screen.getByLabelText("Barcode number")).toBeTruthy();
});

test("when camera access is switched off the app says so and still offers the fallback", async () => {
  camera.canAskAgain = false;
  renderScanner();
  expect(
    await screen.findByText(/Camera access is switched off for this app/),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open phone settings" })).toBeTruthy();
  expect(screen.getByLabelText("Barcode number")).toBeTruthy();
});

test("an unknown product says so and offers the name search", async () => {
  lookup.mockResolvedValue(null);
  renderScanner();
  await findProduct();
  expect(
    await screen.findByText(/This product isn’t in the open database yet/),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Search by name" })).toBeTruthy();
});

test("being offline is reported plainly, not as a raw platform error", async () => {
  lookup.mockRejectedValue(new LookupFailure("offline"));
  renderScanner();
  await findProduct();
  expect(await screen.findByText(/You appear to be offline/)).toBeTruthy();
  expect(screen.queryByText(/Network request failed/)).toBeNull();
});

test("a slow product database is reported as a timeout", async () => {
  lookup.mockRejectedValue(new LookupFailure("timeout"));
  renderScanner();
  await findProduct();
  expect(
    await screen.findByText(/took too long to answer/),
  ).toBeTruthy();
});

test("the Open Food Facts credit is shown wherever a barcode is scanned", async () => {
  renderScanner();
  await waitFor(() =>
    expect(
      screen.getByText("Product data © Open Food Facts contributors (ODbL). Always check the package label."),
    ).toBeTruthy(),
  );
});
