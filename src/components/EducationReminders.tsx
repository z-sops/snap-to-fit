import { useLang, useT } from "../i18n";
import { steroidLinks } from "../core/regions";
import React, { useState } from "react";
import { Linking } from "react-native";
import {
  Card,
  H,
  P,
  Button,
  Field,
  Chips,
  Check,
  act,
  notify,
} from "./ui";
import { useStore } from "../services/store";
import { getSession } from "../services/storage";
import {
  scheduleEducation,
  cancelNotifications,
} from "../services/routine-notifications";
import {
  defaultEducation,
  validateEducation,
} from "../core/routine";
import type { EducationSettings } from "../core/planning-types";
export function EducationReminders() {
  const tr = useT();
  const lang = useLang();
  const { state, namespace, update } = useStore();
  const p = state.profile!;
  const [settings, setSettings] = useState<EducationSettings>(
    state.education || defaultEducation,
  );
  const [busy, setBusy] = useState(false);
  const eligible = p.age >= 18 && p.age <= 50;
  return (
      <Card>
        <H>{tr("Optional Gym Truth reminders")}</H>
        <P>
          {tr("Education is available at every age. Automatic awareness reminders are offered to users aged 18–50; weekly is the default, and daily is optional.")}
        </P>
        <Check
          label="Send steroid-risk education reminders on this device"
          value={settings.enabled}
          onChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
        />
        <Chips
          values={[
            { value: "weekly", label: tr("Weekly") },
            { value: "daily", label: tr("Daily") },
          ]}
          selected={settings.frequency}
          onChange={(v) => setSettings((s) => ({ ...s, frequency: v }))}
        />
        <Field
          label="Reminder time (HH:MM)"
          value={settings.time}
          onChange={(v) => setSettings((s) => ({ ...s, time: v }))}
        />
        {settings.frequency === "weekly" ? (
          <Chips
            values={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (label, i) => ({ value: i + 1, label }),
            )}
            selected={settings.weekday}
            onChange={(v) => setSettings((s) => ({ ...s, weekday: v }))}
          />
        ) : null}
        <Button
          disabled={busy || (settings.enabled && !eligible)}
          title={busy ? tr("Saving…") : tr("Save education reminders")}
          onPress={() =>
            act(async () => {
              validateEducation(settings);
              setBusy(true);
              let ids: string[] = [];
              try {
                await cancelNotifications(state.education?.reminderIds || []);
                await update((s) => ({
                  ...s,
                  education: { ...settings, enabled: false, reminderIds: [] },
                }));
                ids = await scheduleEducation(settings, p.age);
                if (((await getSession())?.userId || "guest") !== namespace)
                  throw new Error("Account changed. Reminders cancelled.");
                await update((s) => ({
                  ...s,
                  education: { ...settings, reminderIds: ids },
                }));
                setSettings((s) => ({ ...s, reminderIds: ids }));
                notify("Education preferences saved.");
              } catch (e) {
                await cancelNotifications(ids);
                setSettings((s) => ({ ...s, enabled: false, reminderIds: [] }));
                throw e;
              } finally {
                setBusy(false);
              }
            })
          }
        />
        {steroidLinks(p.country, lang).map((l) => (
          <Button key={l.url} secondary title={l.title} onPress={() => Linking.openURL(l.url)} />
        ))}
      </Card>
  );
}

export { steroidLinks } from "../core/regions";
