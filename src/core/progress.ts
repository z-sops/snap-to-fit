import { type State, type Profile } from "./model";
export function effectiveProfile(state: State): Profile | null {
  const p = state.profile;
  if (!p) return null;
  const recent = state.readings
    .filter((r) => r.kind === "weight" && Number.isFinite(r.value))
    .sort((a, b) => a.at.localeCompare(b.at))
    .at(-1);
  if (!recent) return p;
  const reached =
    p.goal === "lose"
      ? recent.value <= p.targetWeight
      : p.goal === "gain"
        ? recent.value >= p.targetWeight
        : false;
  return {
    ...p,
    weight: recent.value,
    goal: reached ? "maintain" : p.goal,
    targetWeight: reached ? recent.value : p.targetWeight,
  };
}
export function mergeRecords<T extends { id: string }>(
  local: T[],
  remote: T[],
) {
  const map = new Map(remote.map((x) => [x.id, x]));
  for (const x of local) map.set(x.id, x);
  return [...map.values()];
}
