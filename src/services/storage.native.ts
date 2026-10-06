import type { Session } from "./session-types";
import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { emptyState, type State } from "../core/model";
let dbPromise: Promise<SQLite.SQLiteDatabase> | undefined;
function database() {
  if (!dbPromise)
    dbPromise = (async () => {
      let key = await SecureStore.getItemAsync("stf-db-key");
      if (!key) {
        key = Array.from(await Crypto.getRandomBytesAsync(32), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        await SecureStore.setItemAsync("stf-db-key", key, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      }
      if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid database key.");
      const db = await SQLite.openDatabaseAsync("snap-to-fit.db");
      await db.execAsync(`PRAGMA key = "x'${key}'";`);
      const cipher = await db.getFirstAsync<Record<string, string>>(
        "PRAGMA cipher_version;",
      );
      if (!cipher) {
        await db.closeAsync();
        throw new Error(
          "Encrypted storage requires a development build. Expo Go cannot store your health profile.",
        );
      }
      await db.execAsync(
        "PRAGMA journal_mode = WAL; PRAGMA secure_delete = ON; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS namespaces (namespace TEXT PRIMARY KEY,value TEXT NOT NULL);",
      );
      return db;
    })();
  return dbPromise;
}
export async function loadState(namespace = "guest"): Promise<State> {
  const db = await database();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM namespaces WHERE namespace=?",
    namespace,
  );
  if (!row && namespace === "guest") {
    const legacy = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_state WHERE id=1",
    );
    if (legacy) {
      await db.runAsync(
        "INSERT OR IGNORE INTO namespaces VALUES(?,?)",
        namespace,
        legacy.value,
      );
      await db.runAsync("DELETE FROM app_state");
      return JSON.parse(legacy.value);
    }
  }
  if (!row) return JSON.parse(JSON.stringify(emptyState));
  const state = JSON.parse(row.value);
  if (state.version !== 1) throw new Error("Unsupported data version.");
  return state;
}
export async function saveState(state: State, namespace = "guest") {
  const db = await database();
  await db.runAsync(
    "INSERT INTO namespaces(namespace,value) VALUES(?,?) ON CONFLICT(namespace) DO UPDATE SET value=excluded.value",
    namespace,
    JSON.stringify(state),
  );
}
export async function saveToken(token: string) {
  await SecureStore.setItemAsync("stf-api-token", token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
export async function getToken() {
  const session = await getSession();
  if (session) return session.token;
  return (await SecureStore.getItemAsync("stf-api-token")) || "";
}
export async function clearToken() {
  await SecureStore.deleteItemAsync("stf-api-token");
}

export async function saveSession(session: Session | null) {
  if (session)
    await SecureStore.setItemAsync("stf-session", JSON.stringify(session), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  else await SecureStore.deleteItemAsync("stf-session");
}
export async function getSession(): Promise<Session | null> {
  const value = await SecureStore.getItemAsync("stf-session");
  return value ? JSON.parse(value) : null;
}
export async function removeNamespace(namespace: string) {
  const db = await database();
  await db.runAsync("DELETE FROM namespaces WHERE namespace=?", namespace);
}
export async function getBackupRevision(namespace: string) {
  return Number((await SecureStore.getItemAsync("stf-rev-" + namespace)) || 0);
}
export async function saveBackupRevision(namespace: string, revision: number) {
  await SecureStore.setItemAsync("stf-rev-" + namespace, String(revision));
}
