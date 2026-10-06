import React, { useState } from "react";
import { router } from "expo-router";
import {
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
  return (
    <Screen
      title="Know your baseline."
      subtitle="A clear record for you—and your next care appointment."
    >
      <Card>
        <H>Connected health</H>
        <P>
          With your permission, read daily steps, available weight and
          heart-rate records from Apple Health or Health Connect. Glucose and BP
          use manual logs in this build.
        </P>
        <Button
          disabled={busy}
          title={
            busy ? "Reading health data…" : "Connect & refresh health data"
          }
          onPress={() =>
            act(async () => {
              setBusy(true);
              try {
                setSnapshot(await connectHealth());
              } finally {
                setBusy(false);
              }
            })
          }
        />
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
        <H>Recent readings</H>
        <P>
          Record-keeping only. A single reading cannot diagnose a condition or
          set a medication dose.
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
