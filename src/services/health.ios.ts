import {
  isHealthDataAvailable,
  requestAuthorization,
  getMostRecentQuantitySample,
  queryStatisticsForQuantity,
} from "@kingstinct/react-native-healthkit";
import type { HealthSnapshot } from "./health";
export async function connectHealth(): Promise<HealthSnapshot> {
  if (!isHealthDataAvailable())
    throw new Error("Apple Health is unavailable on this device.");
  await requestAuthorization({
    toRead: [
      "HKQuantityTypeIdentifierStepCount",
      "HKQuantityTypeIdentifierBodyMass",
      "HKQuantityTypeIdentifierHeartRate",
    ],
  });
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const [steps, weight, heart] = await Promise.all([
    queryStatisticsForQuantity(
      "HKQuantityTypeIdentifierStepCount",
      ["cumulativeSum"],
      { filter: { date: { startDate, endDate: new Date() } }, unit: "count" },
    ),
    getMostRecentQuantitySample("HKQuantityTypeIdentifierBodyMass", "kg"),
    getMostRecentQuantitySample(
      "HKQuantityTypeIdentifierHeartRate",
      "count/min",
    ),
  ]);
  return {
    steps: steps.sumQuantity?.quantity ?? null,
    weight: weight?.quantity ?? null,
    heartRate: heart?.quantity ?? null,
    at: new Date().toISOString(),
    source: "Apple Health",
    note: "No returned data may mean permission was declined or there are no samples. Apple Watch data must first sync to Apple Health.",
  };
}
