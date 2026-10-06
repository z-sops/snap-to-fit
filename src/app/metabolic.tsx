import React, { useState, useEffect } from "react";
import { router } from "expo-router";
import {
  Screen,
  Card,
  H,
  P,
  Field,
  Button,
  Chips,
  Check,
  act,
  notify,
} from "../components/ui";
import { useStore } from "../services/store";
import { getSession } from "../services/storage";
import {
  scheduleRoutine,
  cancelNotifications,
} from "../services/routine-notifications";
import {
  defaultRoutine,
  routineLabels,
  routineTimes,
  validateRoutine,
  breakfastStatus,
} from "../core/routine";
import { localDay, uid } from "../core/model";
import type { Routine } from "../core/planning-types";
export default function Metabolic() {
  const { state, namespace, update } = useStore();
  const [routine, setRoutine] = useState<Routine>(
    state.routine || JSON.parse(JSON.stringify(defaultRoutine)),
  );
  const [group, setGroup] = useState<"regular" | "weekend">("regular");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const active = state.routine || defaultRoutine;
  const times = routineTimes(active, now);
  const breakfast = breakfastStatus(state.routineEvents || [], now);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const save = () =>
    act(async () => {
      validateRoutine(routine);
      setBusy(true);
      let ids: string[] = [];
      try {
        await cancelNotifications(state.routine?.reminderIds || []);
        const saved = {
          ...routine,
          reminderIds: [],
          reminders: false,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        await update((s) => ({ ...s, routine: saved }));
        if (routine.reminders) {
          ids = await scheduleRoutine(routine);
          if (((await getSession())?.userId || "guest") !== namespace)
            throw new Error("Account changed. Reminder setup cancelled.");
          await update((s) => ({
            ...s,
            routine: { ...saved, reminders: true, reminderIds: ids },
          }));
        }
        setRoutine({
          ...saved,
          reminders: routine.reminders,
          reminderIds: ids,
        });
        notify(
          routine.reminders
            ? "Routine saved and reminders requested on this device."
            : "Routine saved without notifications.",
        );
      } catch (e) {
        await cancelNotifications(ids);
        setRoutine((x) => ({ ...x, reminders: false, reminderIds: [] }));
        throw e;
      } finally {
        setBusy(false);
      }
    });
  return (
    <Screen
      title="Your Metabolic Tracker."
      subtitle="Your routine clock · regular days and weekends"
    >
      <Card tint>
        <H>Today’s rhythm</H>
        <P>
          {active.weekendDays.includes(now.getDay())
            ? "Weekend"
            : "Regular day"}{" "}
          · wake {times.wake} · breakfast {times.breakfast} · lunch{" "}
          {times.lunch} · dinner {times.dinner}
        </P>
        {breakfast ? (
          <P>
            Breakfast recorded at {new Date(breakfast.at).toLocaleTimeString()}{" "}
            · {breakfast.elapsedMinutes} minutes since you recorded it.
          </P>
        ) : (
          <P>
            Planned breakfast is {times.breakfast}. No actual breakfast has been
            recorded today.
          </P>
        )}
        <P>
          This tracks planned times and your actual check-ins. Metabolism does
          not start or stop at breakfast; no calorie-burn, insulin or glucose
          response is measured here.
        </P>
        {(["wake", "breakfast", "lunch", "dinner"] as const).map((kind) => (
          <Button
            key={kind}
            secondary
            title={`Record ${kind === "wake" ? "that I woke up" : `my ${kind} time`} now`}
            onPress={() =>
              act(() =>
                update((s) => ({
                  ...s,
                  routineEvents: [
                    ...(s.routineEvents || []).filter(
                      (e) =>
                        !(e.kind === kind && localDay(e.at) === localDay()),
                    ),
                    { id: uid(), kind, at: new Date().toISOString() },
                  ].slice(-500),
                })),
              )
            }
          />
        ))}
        <Button
          secondary
          title="Open my weekly meal plan"
          onPress={() => router.push("/meal-plan")}
        />
      </Card>
      <Card>
        <H>Set your usual times</H>
        <Chips
          values={[
            { value: "regular", label: "Regular days" },
            { value: "weekend", label: "Weekend days" },
          ]}
          selected={group}
          onChange={setGroup}
        />
        {(["wake", "breakfast", "lunch", "dinner"] as const).map((kind) => (
          <Field
            key={kind}
            label={`${routineLabels[kind]} (${group}, HH:MM)`}
            value={routine[group][kind]}
            onChange={(v) =>
              setRoutine((r) => ({ ...r, [group]: { ...r[group], [kind]: v } }))
            }
          />
        ))}
        <P>
          Choose your weekend days. Saturday and Sunday are the default; change
          them to match your routine.
        </P>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
          <Check
            key={day}
            label={day}
            value={routine.weekendDays.includes(i)}
            onChange={(v) =>
              setRoutine((r) => ({
                ...r,
                weekendDays: v
                  ? [...r.weekendDays, i]
                  : r.weekendDays.filter((x) => x !== i),
              }))
            }
          />
        ))}
        <Check
          label="Send repeating local meal reminders on this device"
          value={routine.reminders}
          onChange={(v) => setRoutine((r) => ({ ...r, reminders: v }))}
        />
        <Check
          label="Also remind me at my planned wake-up time"
          value={routine.wakeReminder}
          onChange={(v) => setRoutine((r) => ({ ...r, wakeReminder: v }))}
        />
        <Button
          disabled={busy}
          title={busy ? "Saving routine…" : "Save my routine"}
          onPress={save}
        />
        <P>
          Reminders use device local time. Notifications may be delayed or
          hidden by device settings and are not medicine or emergency alarms.
          Review and save again after travel or a timezone change. Signing out
          stops this account’s reminders.
        </P>
      </Card>
      <Card>
        <H>Your recent check-ins</H>
        {[...(state.routineEvents || [])]
          .reverse()
          .slice(0, 16)
          .map((e) => (
            <P key={e.id}>
              {routineLabels[e.kind]} · {new Date(e.at).toLocaleString()}
            </P>
          ))}
      </Card>
    </Screen>
  );
}
