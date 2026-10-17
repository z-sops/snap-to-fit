import { HealthIssue, type HealthSnapshot } from "./health-issue";
export { HealthIssue } from "./health-issue";
export type { HealthSnapshot } from "./health-issue";
export async function connectHealth(): Promise<HealthSnapshot> {
  throw new HealthIssue(
    "Apple Health and Health Connect are available in native device builds. The web preview uses manual entries.",
  );
}
export async function installHealthConnect() {}
export function openHealthSettings() {}
