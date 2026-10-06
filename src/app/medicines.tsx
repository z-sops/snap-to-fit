import React, { useState } from "react";
import {
  Screen,
  Card,
  H,
  P,
  Field,
  Chips,
  Button,
  Check,
  act,
  notify,
} from "../components/ui";
import { useStore } from "../services/store";
import { uid, type Medicine } from "../core/model";
import { scheduleReminder, cancelReminder } from "../services/reminders";
export default function Medicines() {
  const { state, update } = useStore();
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [kind, setKind] = useState<Medicine["kind"]>("injection");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [remind, setRemind] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Screen
      title="Your prescribed routine."
      subtitle="Track medicines and injections. Keep your care decisions with your prescriber."
    >
      <Card tint>
        <H>Injection companion</H>
        <P>
          Record prescribed doses, dates and symptoms alongside weight progress.
          Reaching a target, a plateau or a certain number of injections does
          not automatically mean you should stop or take a break.
        </P>
      </Card>
      <Card>
        <H>Add an existing prescription</H>
        <Chips
          values={[
            { value: "injection", label: "Weight-loss injection" },
            { value: "tablet", label: "Tablet" },
            { value: "insulin", label: "Insulin" },
          ]}
          selected={kind}
          onChange={setKind}
        />
        <Field label="Medication name" value={name} onChange={setName} />
        <Field
          label="Prescribed dose (include units)"
          value={dose}
          onChange={setDose}
          placeholder="Copy exactly from your prescription"
        />
        <Field
          label="Next scheduled date (YYYY-MM-DD)"
          value={date}
          onChange={setDate}
        />
        <Field label="Local time (HH:MM)" value={time} onChange={setTime} />
        <Check
          label="Notify me once at this date and time"
          value={remind}
          onChange={setRemind}
        />
        <Button
          disabled={busy}
          title="Save prescription schedule"
          onPress={() =>
            act(async () => {
              if (!name.trim() || !dose.trim())
                throw new Error("Enter the medication and prescribed dose.");
              if (
                !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
              )
                throw new Error("Use YYYY-MM-DD and HH:MM.");
              const when = new Date(`${date}T${time}:00`);
              if (
                !Number.isFinite(when.getTime()) ||
                when.getFullYear() !== Number(date.slice(0, 4)) ||
                when.getMonth() + 1 !== Number(date.slice(5, 7)) ||
                when.getDate() !== Number(date.slice(8, 10))
              )
                throw new Error("Invalid date.");
              setBusy(true);
              let reminderId: string | undefined;
              try {
                if (remind) reminderId = await scheduleReminder(when);
                await update((s) => ({
                  ...s,
                  medicines: [
                    ...s.medicines,
                    {
                      id: uid(),
                      name,
                      dose,
                      kind,
                      time,
                      nextDate: date,
                      reminderId,
                    },
                  ],
                  profile: s.profile
                    ? {
                        ...s.profile,
                        medicines: `${s.profile.medicines}\n${name} (${kind})`,
                        insulin: s.profile.insulin || kind === "insulin",
                      }
                    : null,
                }));
                setName("");
                setDose("");
                setDate("");
              } catch (e) {
                if (reminderId) await cancelReminder(reminderId);
                throw e;
              } finally {
                setBusy(false);
              }
            })
          }
        />
        <P>
          Reminders are one-time and do not advance your prescribed schedule.
          Confirm and add the next date yourself.
        </P>
      </Card>
      <Card>
        <H>My medications</H>
        <Field
          label="Symptoms / notes for your next dose log"
          value={symptoms}
          onChange={setSymptoms}
        />
        {state.medicines.map((m) => (
          <Card key={m.id}>
            <H>{m.name}</H>
            <P>
              {m.dose} · {m.kind} · scheduled {m.nextDate} at {m.time}
            </P>
            <P>
              {state.doses.filter((d) => d.medicineId === m.id).length}{" "}
              administrations recorded
            </P>
            <Button
              title="Record dose taken now"
              onPress={() =>
                act(async () => {
                  await update((s) => ({
                    ...s,
                    doses: [
                      ...s.doses,
                      {
                        id: uid(),
                        at: new Date().toISOString(),
                        medicineId: m.id,
                        name: m.name,
                        dose: m.dose,
                        symptoms,
                      },
                    ],
                  }));
                  setSymptoms("");
                  notify(
                    "Administration recorded. This does not recommend taking another dose or changing your schedule.",
                  );
                })
              }
            />
            <Button
              secondary
              title="Remove schedule & reminder"
              onPress={() =>
                act(async () => {
                  if (m.reminderId) await cancelReminder(m.reminderId);
                  await update((s) => ({
                    ...s,
                    medicines: s.medicines.filter((x) => x.id !== m.id),
                  }));
                })
              }
            />
          </Card>
        ))}
        {!state.medicines.length ? <P>No medications added.</P> : null}
      </Card>
      <Card>
        <H>Administration history</H>
        {[...state.doses].reverse().map((d) => (
          <Card key={d.id}>
            <P>
              {d.name} · {d.dose} · {new Date(d.at).toLocaleString()}
            </P>
            <P>{d.symptoms || "No symptoms recorded"}</P>
            <Button
              secondary
              title="Remove incorrect dose log"
              onPress={() =>
                act(() =>
                  update((s) => ({
                    ...s,
                    doses: s.doses.filter((x) => x.id !== d.id),
                  })),
                )
              }
            />
          </Card>
        ))}
      </Card>
    </Screen>
  );
}
