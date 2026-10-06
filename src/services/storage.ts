import type { Session } from "./session-types";
// Web preview is memory-only; never persist health data or tokens in localStorage.
import { emptyState, type State } from "../core/model";
const namespaces = new Map<string, State>();
let session: Session | null = null;
const revisions = new Map<string, number>();
let token = "";
export async function loadState(namespace = "guest"): Promise<State> {
  return JSON.parse(JSON.stringify(namespaces.get(namespace) || emptyState));
}
export async function saveState(s: State, namespace = "guest") {
  namespaces.set(namespace, JSON.parse(JSON.stringify(s)));
}
export async function saveToken(t: string) {
  token = t;
}
export async function getToken() {
  return session?.token || token;
}
export async function clearToken() {
  token = "";
}

export async function saveSession(s: Session | null) {
  session = s;
}
export async function getSession() {
  return session;
}
export async function removeNamespace(namespace: string) {
  namespaces.delete(namespace);
}
export async function getBackupRevision(namespace: string) {
  return revisions.get(namespace) || 0;
}
export async function saveBackupRevision(namespace: string, revision: number) {
  revisions.set(namespace, revision);
}
