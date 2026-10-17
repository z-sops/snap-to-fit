export interface HealthSnapshot {
  steps: number | null;
  weight: number | null;
  heartRate: number | null;
  at: string;
  source: string;
  note: string;
}
/** A connection problem the person can fix themselves; `action` names the screen that fixes it. */
export class HealthIssue extends Error {
  constructor(
    message: string,
    public action?: "install" | "settings",
  ) {
    super(message);
    this.name = "HealthIssue";
  }
}
