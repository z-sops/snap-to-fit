import { backupState, withoutDeviceReminders } from "../core/backup-state";
import React, { useState, useEffect } from "react";
import { router } from "expo-router";
import {
  Screen,
  Card,
  H,
  P,
  Button,
  Field,
  Chips,
  Check,
  act,
  notify,
} from "../components/ui";
import { api, publicAPI } from "../services/api";
import {
  getSession,
  saveSession,
  saveState,
  removeNamespace,
  getBackupRevision,
  saveBackupRevision,
  clearToken,
} from "../services/storage";
import { cancelNotifications } from "../services/routine-notifications";
import { cancelReminder } from "../services/reminders";
import { useStore } from "../services/store";
import { type State } from "../core/model";
import type { Session } from "../services/session-types";
export default function Account() {
  const { state, namespace, switchAccount, update } = useStore();
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState("");
  const [newRecovery, setNewRecovery] = useState("");
  const [copy, setCopy] = useState(false);
  const [backupConsent, setBackupConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getSession().then(setSession);
  }, []);
  const run = (fn: () => Promise<void>) =>
    act(async () => {
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    });
  const stopReminders = async () => {
    await cancelNotifications([
      ...(state.routine?.reminderIds || []),
      ...(state.education?.reminderIds || []),
    ]);
    for (const m of state.medicines)
      if (m.reminderId) await cancelReminder(m.reminderId);
    await update((s) => ({
      ...s,
      medicines: s.medicines.map(({ reminderId, ...m }) => m),
      routine: s.routine
        ? { ...s.routine, reminders: false, reminderIds: [] }
        : undefined,
      education: s.education
        ? { ...s.education, enabled: false, reminderIds: [] }
        : undefined,
    }));
  };
  return (
    <Screen
      title="Your account."
      subtitle="Optional private backup. Offline use stays available."
    >
      {!session ? (
        <Card>
          <H>Sign in or create an account</H>
          <Chips
            values={[
              { value: "login", label: "Sign in" },
              { value: "register", label: "Create account" },
              { value: "recover", label: "Recover access" },
            ]}
            selected={mode}
            onChange={setMode}
          />
          <Field
            label="Username"
            value={username}
            onChange={setUsername}
            placeholder="3–32 letters, numbers or underscores"
          />
          <Field
            label={
              mode === "recover"
                ? "New password"
                : "Password (at least 12 characters)"
            }
            secret
            value={password}
            onChange={setPassword}
          />
          {mode === "recover" ? (
            <Field
              label="Account recovery code"
              secret
              value={recovery}
              onChange={setRecovery}
            />
          ) : null}
          {mode === "register" && state.profile ? (
            <Check
              label="Copy my current offline profile and logs into this new account on this device"
              value={copy}
              onChange={setCopy}
            />
          ) : null}
          <Button
            disabled={busy}
            title={
              mode === "register"
                ? "Create my account"
                : mode === "recover"
                  ? "Recover account"
                  : "Sign in"
            }
            onPress={() =>
              run(async () => {
                const next = await publicAPI<
                  Session & { recoveryCode?: string }
                >(`/auth/${mode}`, {
                  username,
                  password,
                  recoveryCode: recovery,
                });
                await stopReminders();
                if (mode === "register" && copy)
                  await saveState(withoutDeviceReminders(state), next.userId);
                const { recoveryCode, ...sessionData } = next;
                await saveSession(sessionData);
                await clearToken();
                await switchAccount(next.userId);
                setSession(sessionData);
                setNewRecovery(recoveryCode || "");
                setPassword("");
                setRecovery("");
              })
            }
          />
          <P>
            Account recovery uses a private one-time code, so no email address
            is required. Keep it somewhere safe. Losing both your password and
            code means we cannot restore access.
          </P>
        </Card>
      ) : (
        <>
          <Card tint>
            <H>Signed in as {session.username}</H>
            <P>
              Your device profile is isolated from other accounts. Cloud backups
              are uploaded only when you choose. Switching accounts stops
              reminders; re-enable them after signing in.
            </P>
            {!state.profile ? (
              <Button
                title="Set up my profile"
                onPress={() => router.push("/onboarding")}
              />
            ) : null}
            <Button
              secondary
              title="Sign out"
              disabled={busy}
              onPress={() =>
                run(async () => {
                  try {
                    await api("/auth/logout", {});
                  } catch {
                    /* Local sign-out remains available offline. */
                  }
                  await stopReminders();
                  await saveSession(null);
                  await switchAccount("guest");
                  setSession(null);
                })
              }
            />
          </Card>
          {newRecovery ? (
            <Card>
              <H>Save your recovery code</H>
              <P>{newRecovery}</P>
              <P>
                This code is shown once. Keep it outside this app in a secure
                place. A successful account recovery replaces the old code.
              </P>
              <Button
                title="I have saved my recovery code"
                onPress={() => setNewRecovery("")}
              />
            </Card>
          ) : null}
          <Card>
            <H>Encrypted cloud backup</H>
            <Check
              label="I agree to upload my profile, health logs, meal plans, routine settings, medication history and chat to my private encrypted backup. Progress photos stay on this device."
              value={backupConsent}
              onChange={setBackupConsent}
            />
            <Button
              disabled={busy || !backupConsent || !state.profile}
              title="Upload my current backup"
              onPress={() =>
                run(async () => {
                  const revision = await getBackupRevision(namespace);
                  const result = await api<{ revision: number }>(
                    "/backup/put",
                    {
                      revision,
                      state: backupState(state),
                    },
                  );
                  await saveBackupRevision(namespace, result.revision);
                  notify("Private backup uploaded.");
                })
              }
            />
            <Button
              secondary
              disabled={busy}
              title="Restore backup from cloud"
              onPress={() =>
                run(async () => {
                  const result = await api<{
                    revision: number;
                    state: State | null;
                  }>("/backup/get", {});
                  if (!result.state)
                    throw new Error("No cloud backup exists yet.");
                  if (state.profile)
                    throw new Error(
                      "To avoid overwriting local records, clear this account’s local profile in Settings before restoring. Your cloud backup will remain available.",
                    );
                  await update(() => ({ ...result.state!, photos: [] }));
                  await saveBackupRevision(namespace, result.revision);
                  notify("Cloud backup restored.");
                })
              }
            />
            <P>
              Uploads check the backup revision. A newer copy on another device
              prevents silent overwrite. Photos and reminder identifiers are not
              uploaded.
            </P>
            <P>
              Backups are encrypted at rest with a server-held key. The service
              can decrypt them for restore; this is not end-to-end encryption.
            </P>
          </Card>
          <Card>
            <H>Delete my account permanently</H>
            <P>
              This removes server-side sessions, backups, CGM tokens and usage
              records. It also removes this account’s local profile. Other
              accounts and the offline guest profile remain separate.
            </P>
            <P>
              This is deletion from the active databases, not guaranteed forensic
              erasure. Provider records, operator snapshots, store billing and
              original or temporary photos have separate deletion processes.
            </P>
            <Field
              label="Confirm current password"
              secret
              value={password}
              onChange={setPassword}
            />
            <Button
              secondary
              disabled={busy || !password}
              title="Delete account and my data"
              onPress={() =>
                run(async () => {
                  await api("/auth/delete", { password });
                  await stopReminders();
                  await removeNamespace(namespace);
                  await saveSession(null);
                  await switchAccount("guest");
                  setSession(null);
                  setPassword("");
                  setNewRecovery("");
                  notify("Account and private backup deleted.");
                })
              }
            />
          </Card>
        </>
      )}
      <Card>
        <Button
          secondary
          title="Privacy and app terms"
          onPress={() => router.push("/legal")}
        />
        <Button
          secondary
          title="Use offline mode"
          onPress={() => router.replace(state.profile ? "/" : "/onboarding")}
        />
      </Card>
    </Screen>
  );
}
