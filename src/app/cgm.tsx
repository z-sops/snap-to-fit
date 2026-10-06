import React, { useState } from "react";
import { Linking } from "react-native";
import {
  Screen,
  Card,
  H,
  P,
  Button,
  Metric,
  act,
  notify,
} from "../components/ui";
import { useStore } from "../services/store";
import { api } from "../services/api";
import type { CGMReading } from "../core/model";
interface Status {
  dexcom: {
    configured: boolean;
    connected: boolean;
    region: string;
    sandbox: boolean;
    note: string;
  };
  libre: { configured: boolean; note: string };
}
export default function CGM() {
  const { state, update } = useStore();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncAt, setSyncAt] = useState("");
  const readings = state.cgm || [];
  const latest = readings.at(-1);
  const action = (fn: () => Promise<void>) =>
    act(async () => {
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    });
  return (
    <Screen
      title="Connect your CGM."
      subtitle="Read-only sensor history. Clear source and freshness."
    >
      <Card tint>
        <H>Keep your sensor app active</H>
        <P>
          Snap to Fit’s cloud connection reads historical glucose data. It is
          not a real-time glucose monitor, dosing tool or replacement for your
          sensor’s alarms. Internet and provider permissions are required.
        </P>
      </Card>
      <Card>
        <H>Dexcom G6 / G7</H>
        <P>
          {status
            ? status.dexcom.note
            : "Check whether your configured service has Dexcom developer access."}
        </P>
        <Button
          disabled={busy}
          title="Check provider availability"
          onPress={() =>
            action(async () => setStatus(await api<Status>("/cgm/status", {})))
          }
        />
        <Button
          disabled={busy}
          title="Connect Dexcom account"
          onPress={() =>
            action(async () => {
              const result = await api<{ url: string }>(
                "/cgm/dexcom/start",
                {},
              );
              if (
                !/^https:\/\/(sandbox-api\.dexcom\.com|api\.dexcom\.(com|eu|jp))\/v3\/oauth2\/login\?/.test(
                  result.url,
                )
              )
                throw new Error("Unexpected authorization URL.");
              await Linking.openURL(result.url);
            })
          }
        />
        <P>
          Sign in only on Dexcom’s authorization page. Your Dexcom password is
          never entered into Snap to Fit.
        </P>
        <Button
          disabled={busy}
          title="Sync historical readings"
          onPress={() =>
            action(async () => {
              const result = await api<{
                readings: CGMReading[];
                syncedAt: string;
                sandbox: boolean;
              }>("/cgm/dexcom/sync", {});
              await update((s) => {
                const byId = new Map((s.cgm || []).map((r) => [r.id, r]));
                for (const r of result.readings) byId.set(r.id, r);
                return {
                  ...s,
                  cgm: [...byId.values()]
                    .sort((a, b) => a.at.localeCompare(b.at))
                    .slice(-10000),
                };
              });
              setSyncAt(result.syncedAt);
              if (result.sandbox)
                notify(
                  "These are simulated Dexcom sandbox readings, not your glucose.",
                );
            })
          }
        />
        <Button
          secondary
          disabled={busy}
          title="Disconnect Dexcom & clear imported readings"
          onPress={() =>
            action(async () => {
              await api("/cgm/dexcom/disconnect", {});
              await update((s) => ({ ...s, cgm: [] }));
              setStatus(null);
              notify(
                "Disconnected. Also revoke access in your Dexcom account if desired.",
              );
            })
          }
        />
        {syncAt ? <P>Last fetch: {new Date(syncAt).toLocaleString()}</P> : null}
      </Card>
      <Card>
        <H>FreeStyle Libre</H>
        <P>
          Abbott partner access is not configured. LibreLinkUp caregiver sharing
          does not automatically grant Snap to Fit access. No unofficial
          password-sharing connection is included.
        </P>
      </Card>
      <Card>
        <H>Latest available historical reading</H>
        {latest ? (
          <>
            <Metric
              label={latest.unit}
              value={
                latest.status === "low"
                  ? "LOW"
                  : latest.status === "high"
                    ? "HIGH"
                    : (latest.value ?? "Unavailable")
              }
            />
            <P>
              {latest.source} · measured {new Date(latest.at).toLocaleString()}
            </P>
            <P>
              Trend at that time: {latest.trend || "unavailable"}. Check your
              sensor app for your current value.
            </P>
          </>
        ) : (
          <P>
            No CGM history imported yet. Manual glucose tracking is available in
            Health.
          </P>
        )}
      </Card>
      <Card>
        <H>Recent history</H>
        {[...readings]
          .reverse()
          .slice(0, 30)
          .map((r) => (
            <P key={r.id}>
              {new Date(r.at).toLocaleString()} ·{" "}
              {r.status ? r.status.toUpperCase() : r.value} {r.unit} ·{" "}
              {r.source}
            </P>
          ))}
      </Card>
    </Screen>
  );
}
