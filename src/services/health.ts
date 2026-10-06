export interface HealthSnapshot {
  steps: number | null;
  weight: number | null;
  heartRate: number | null;
  at: string;
  source: string;
  note: string;
}
export async function connectHealth(): Promise<HealthSnapshot> {
  throw new Error(
    "Apple Health and Health Connect are available in native device builds. The web preview uses manual entries.",
  );
}
