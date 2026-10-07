import { Platform, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TrendChart } from "../components/visuals";
import { readingTrend } from "../core/chart-data";
import React, { useState } from "react";
import { router } from "expo-router";
import {
  colors,
  Screen,
  Card,
  H,
  P,
  Chips,
  Field,
  Button,
  Row,
  Metric,
  act,
  notify,
} from "../components/ui";
import { useStore } from "../services/store";
import { connectHealth, type HealthSnapshot } from "../services/health";
import { uid, numeric, type Reading } from "../core/model";
export default function Health() {
  const { state, update } = useStore();
  const [kind, setKind] = useState<Reading["kind"]>("glucose");
  const [value, setValue] = useState("");
  const [second, setSecond] = useState("");
  const [unit, setUnit] = useState("mg/dL");
  const [context, setContext] = useState("");
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  async function refreshHealth() {
    setBusy(true);
    try {
      setSnapshot(await connectHealth());
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="Know your baseline."
      subtitle="A clear record for you—and your next care appointment."
    >
      <Card>
        <H>Your watches & trackers</H>
        <P>
          Choose your device. Read-only access keeps you in control of what you
          share.
        </P>
        {[
          {
            name: "Apple Watch",
            icon: "watch-outline" as const,
            platform: "ios",
            route: "Via Apple Health on iPhone",
            detail:
              "Pair your watch with iPhone and let it sync to Apple Health. Then allow Snap to Fit to read steps, weight and heart rate. This is an iPhone connection, not a standalone watch app.",
          },
          {
            name: "Android health",
            icon: "heart-circle-outline" as const,
            platform: "android",
            route: "Via Health Connect",
            detail:
              "Enable Health Connect on your phone. Let your supported tracker app share steps, weight and heart rate, then grant Snap to Fit read access.",
          },
          {
            name: "Fitbit / Google Health",
            icon: "fitness-outline" as const,
            platform: "android",
            route: "Via Health Connect on Android",
            detail:
              "Sync your Fitbit to its companion app. In Fitbit / Google Health connections, enable sharing to Health Connect for the data you want. Then refresh here. This connection does not sign into your Fitbit cloud account.",
          },
        ].map((device) => (
          <View
            key={device.name}
            style={{
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 18,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <Row>
              <Ionicons name={device.icon} size={30} color={colors.green} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 18, color: colors.ink, fontWeight: "700" }}
                >
                  {device.name}
                </Text>
                <Text
                  style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}
                >
                  {device.route}
                </Text>
              </View>
            </Row>
            <P>{device.detail}</P>
            <Text
              style={{ color: colors.green, fontSize: 12, fontWeight: "700" }}
            >
              {Platform.OS === device.platform
                ? "Native reader available · device verification pending"
                : `Connect in the ${device.platform === "ios" ? "iPhone" : "Android"} app`}
            </Text>
            <Button
              disabled={busy || Platform.OS !== device.platform}
              title={
                busy
                  ? "Reading health data…"
                  : `Connect / refresh ${device.name}`
              }
              onPress={() => act(refreshHealth)}
            />
          </View>
        ))}
        <P>
          Website preview cannot read watch data. No samples can mean no
          permission, no synced records, or an unsupported data type. We never
          treat missing data as zero.
        </P>
        {snapshot ? (
          <>
            <Row>
              <Metric label="Steps today" value={snapshot.steps ?? "—"} />
              <Metric label="Weight" value={snapshot.weight ?? "—"} unit="kg" />
              <Metric
                label="Heart rate"
                value={snapshot.heartRate ?? "—"}
                unit="bpm"
              />
            </Row>
            <P>
              {snapshot.source} · {new Date(snapshot.at).toLocaleString()}
            </P>
            <P>{snapshot.note}</P>
          </>
        ) : null}
      </Card>
      <Card>
        <H>CGM sensor accounts</H>
        <P>
          Dexcom historical OAuth integration and provider availability. Delayed
          readings are not live alerts.
        </P>
        <Button title="Connect my CGM" onPress={() => router.push("/cgm")} />
      </Card>
      <Card>
        <H>Add a reading</H>
        <Chips
          values={[
            { value: "glucose", label: "Glucose" },
            { value: "bp", label: "Blood pressure" },
            { value: "weight", label: "Weight" },
            { value: "waist", label: "Waist" },
          ]}
          selected={kind}
          onChange={(v) => {
            setKind(v);
            setValue("");
            setSecond("");
          }}
        />
        {kind === "glucose" ? (
          <Chips
            values={[
              { value: "mg/dL", label: "mg/dL" },
              { value: "mmol/L", label: "mmol/L" },
            ]}
            selected={unit}
            onChange={setUnit}
          />
        ) : null}
        <Field
          label={
            kind === "bp"
              ? "Systolic (mmHg)"
              : `${kind} (${kind === "glucose" ? unit : kind === "weight" ? "kg" : "cm"})`
          }
          numeric
          value={value}
          onChange={setValue}
        />
        {kind === "bp" ? (
          <Field
            label="Diastolic (mmHg)"
            numeric
            value={second}
            onChange={setSecond}
          />
        ) : null}
        <Field
          label="Context / notes"
          value={context}
          onChange={setContext}
          placeholder="Fasting, after meal, seated…"
        />
        <Button
          title="Save reading"
          onPress={() =>
            act(async () => {
              const range =
                kind === "glucose"
                  ? unit === "mg/dL"
                    ? [10, 1000]
                    : [0.5, 55.5]
                  : kind === "weight"
                    ? [30, 350]
                    : kind === "waist"
                      ? [30, 250]
                      : [40, 300];
              const n = numeric(value, range[0], range[1], "Reading");
              const d =
                kind === "bp"
                  ? numeric(second, 20, 200, "Diastolic")
                  : undefined;
              if (d && d >= n)
                throw new Error(
                  "Systolic must be greater than diastolic. Check your reading.",
                );
              await update((s) => ({
                ...s,
                readings: [
                  ...s.readings,
                  {
                    id: uid(),
                    at: new Date().toISOString(),
                    kind,
                    value: n,
                    second: d,
                    unit:
                      kind === "glucose"
                        ? unit
                        : kind === "weight"
                          ? "kg"
                          : kind === "waist"
                            ? "cm"
                            : "mmHg",
                    context,
                    source: "manual",
                  },
                ],
              }));
              if (kind === "glucose" && (unit === "mg/dL" ? n < 70 : n < 3.9))
                notify(
                  "Your reading is low. Follow your prescribed low-glucose action plan. Seek urgent help if confused, faint or unable to swallow.",
                );
              if (kind === "bp" && (n >= 180 || (d ?? 0) >= 120))
                notify(
                  "This reading is very high. Seek prompt medical assessment; with chest pain, breathlessness, weakness or vision changes, get emergency help now.",
                );
              setValue("");
              setSecond("");
              setContext("");
            })
          }
        />
      </Card>
      <Card>
        <H>Your reading trends</H>
        <Chips
          values={[
            { value: "glucose", label: "Glucose" },
            { value: "weight", label: "Weight" },
            { value: "waist", label: "Waist" },
            { value: "bp", label: "Blood pressure" },
          ]}
          selected={kind}
          onChange={(v) => {
            setKind(v);
            setValue("");
            setSecond("");
          }}
        />
        <TrendChart
          points={readingTrend(
            state.readings,
            kind,
            kind === "glucose"
              ? unit
              : kind === "weight"
                ? "kg"
                : kind === "waist"
                  ? "cm"
                  : "mmHg",
          )}
          label={
            kind === "bp"
              ? "Systolic blood pressure"
              : kind[0].toUpperCase() + kind.slice(1)
          }
          unit={
            kind === "glucose"
              ? unit
              : kind === "weight"
                ? "kg"
                : kind === "waist"
                  ? "cm"
                  : "mmHg"
          }
        />
      </Card>
      <Card>
        <H>Recent readings</H>
        <P>
          Logs with limited notices for manually entered low glucose or very
          high blood pressure. No notice does not establish safety. This is not
          continuous monitoring; a single reading cannot diagnose a condition
          or set a medication dose.
        </P>
        {[...state.readings]
          .reverse()
          .slice(0, 20)
          .map((r) => (
            <Card key={r.id}>
              <H>
                {r.kind.toUpperCase()} · {r.value}
                {r.second ? ` / ${r.second}` : ""} {r.unit}
              </H>
              <P>
                {new Date(r.at).toLocaleString()} · {r.context || r.source}
              </P>
              <Button
                secondary
                title="Remove reading"
                onPress={() =>
                  act(() =>
                    update((s) => ({
                      ...s,
                      readings: s.readings.filter((x) => x.id !== r.id),
                    })),
                  )
                }
              />
            </Card>
          ))}
        {!state.readings.length ? <P>No readings yet.</P> : null}
      </Card>
    </Screen>
  );
}
