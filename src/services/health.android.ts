import {
  initialize,
  requestPermission,
  aggregateRecord,
  readRecords,
} from "react-native-health-connect";
import type { HealthSnapshot } from "./health";
export async function connectHealth(): Promise<HealthSnapshot> {
  if (!(await initialize()))
    throw new Error(
      "Health Connect is unavailable. Install or enable it on a supported Android device.",
    );
  const granted = await requestPermission([
    { accessType: "read", recordType: "Steps" },
    { accessType: "read", recordType: "Weight" },
    { accessType: "read", recordType: "HeartRate" },
  ]);
  const allowed = new Set(
    granted.map((p) => ("recordType" in p ? p.recordType : "")),
  );
  if (!allowed.size)
    throw new Error(
      "No health permissions were granted. Manual tracking is still available.",
    );
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const filter = {
    operator: "between" as const,
    startTime: start.toISOString(),
    endTime: new Date().toISOString(),
  };
  const [steps, weight, heart] = await Promise.all([
    allowed.has("Steps")
      ? aggregateRecord({ recordType: "Steps", timeRangeFilter: filter })
      : null,
    allowed.has("Weight")
      ? readRecords("Weight", {
          timeRangeFilter: filter,
          ascendingOrder: false,
          pageSize: 1,
        })
      : null,
    allowed.has("HeartRate")
      ? readRecords("HeartRate", {
          timeRangeFilter: filter,
          ascendingOrder: false,
          pageSize: 1,
        })
      : null,
  ]);
  return {
    steps: steps?.COUNT_TOTAL ?? null,
    weight: weight?.records[0]?.weight.inKilograms ?? null,
    heartRate: heart?.records[0]?.samples.at(-1)?.beatsPerMinute ?? null,
    at: new Date().toISOString(),
    source: "Health Connect",
    note: "Read-only daily steps and available weight/heart-rate samples. Missing values are not zero. Device-source data must be shared to Health Connect.",
  };
}
