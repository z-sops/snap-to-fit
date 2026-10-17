import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from "react-native-health-connect";
import { Linking } from "react-native";
import { HealthIssue, type HealthSnapshot } from "./health-issue";
export { HealthIssue } from "./health-issue";
export type { HealthSnapshot } from "./health-issue";

const PROVIDER = "com.google.android.apps.healthdata";
const WANTED = [
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "Weight" },
  { accessType: "read", recordType: "HeartRate" },
] as const;

/** Play Store page for Health Connect; the `url` extra returns the user to onboarding after install. */
export async function installHealthConnect() {
  const market = `market://details?id=${PROVIDER}&url=healthconnect%3A%2F%2Fonboarding`;
  try {
    await Linking.openURL(market);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${PROVIDER}`);
  }
}
export function openHealthSettings() {
  try {
    openHealthConnectSettings();
  } catch {
    void Linking.openSettings();
  }
}

function recordTypes(list: unknown[]) {
  return new Set(
    list.map((p) =>
      p && typeof p === "object" && "recordType" in p && (p as { accessType?: string }).accessType !== "write"
        ? String((p as { recordType: string }).recordType)
        : "",
    ).filter(Boolean),
  );
}

export async function connectHealth(): Promise<HealthSnapshot> {
  // 1. Is Health Connect present and current? (Built in on Android 14+, a Play Store app on 13 and older.)
  let status: number;
  try {
    status = await getSdkStatus(PROVIDER);
  } catch {
    throw new HealthIssue(
      "Health Connect could not be reached on this phone. Update Google Play services and Health Connect, then try again.",
      "install",
    );
  }
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
    throw new HealthIssue(
      "Health Connect needs to be installed or updated from the Play Store. After that, come back and tap Connect again.",
      "install",
    );
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE)
    throw new HealthIssue(
      "Health Connect is not available on this phone (it needs Android 9 or newer with Google Play). You can still log steps, weight and heart rate by hand.",
    );
  if (!(await initialize(PROVIDER)))
    throw new HealthIssue("Health Connect did not start. Open Health Connect once, then try again.", "settings");

  // 2. Permissions: reuse what is already granted; only show the dialog for what is missing.
  let allowed = recordTypes(await getGrantedPermissions().catch(() => []));
  if (WANTED.some((w) => !allowed.has(w.recordType))) {
    try {
      const granted = await requestPermission([...WANTED]);
      allowed = new Set([...allowed, ...recordTypes(granted)]);
    } catch {
      throw new HealthIssue(
        "The Health Connect permission screen could not open. Open Health Connect → App permissions → Snap to Fit and allow Steps, Weight and Heart rate.",
        "settings",
      );
    }
  }
  if (!allowed.size)
    // After two "Don't allow" answers Android stops showing the dialog, so the only path is the settings page.
    throw new HealthIssue(
      "Snap to Fit has no Health Connect permission yet. Open Health Connect → App permissions → Snap to Fit and allow Steps, Weight and Heart rate.",
      "settings",
    );

  // 3. Read today's data.
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const filter = { operator: "between" as const, startTime: start.toISOString(), endTime: new Date().toISOString() };
  const weekAgo = new Date(Date.now() - 30 * 86400000);
  const [steps, weight, heart] = await Promise.all([
    allowed.has("Steps") ? aggregateRecord({ recordType: "Steps", timeRangeFilter: filter }).catch(() => null) : null,
    allowed.has("Weight")
      ? readRecords("Weight", {
          timeRangeFilter: { operator: "between", startTime: weekAgo.toISOString(), endTime: new Date().toISOString() },
          ascendingOrder: false,
          pageSize: 1,
        }).catch(() => null)
      : null,
    allowed.has("HeartRate")
      ? readRecords("HeartRate", { timeRangeFilter: filter, ascendingOrder: false, pageSize: 1 }).catch(() => null)
      : null,
  ]);
  const snapshot: HealthSnapshot = {
    steps: steps?.COUNT_TOTAL ?? null,
    weight: weight?.records[0]?.weight.inKilograms ?? null,
    heartRate: heart?.records[0]?.samples.at(-1)?.beatsPerMinute ?? null,
    at: new Date().toISOString(),
    source: "Health Connect",
    note: "Read-only daily steps and available weight/heart-rate samples. Missing values are not zero. Device-source data must be shared to Health Connect.",
  };
  if (snapshot.steps == null && snapshot.weight == null && snapshot.heartRate == null)
    snapshot.note =
      "Connected, but no data has reached Health Connect today. In the Fitbit app (or your tracker's app), turn on sharing to Health Connect, let it sync, then tap refresh.";
  return snapshot;
}
