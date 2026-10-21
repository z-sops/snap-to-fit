import { CountryPicker } from "../components/CountryPicker";
import { formatHeight, formatWeight, presentationFor, weightDisplayFor, type Units } from "../core/units";
import { weightDisplayOptions, type WeightDisplay } from "../core/locale";
import React, { useState } from "react";
import { Platform, Alert, Share } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Card,
  H,
  P,
  Check,
  Field,
  Button,
  Chips,
  act,
  notify,
} from "../components/ui";
import { useStore } from "../services/store";
import { saveToken, clearToken } from "../services/storage";
import { cancelNotifications } from "../services/routine-notifications";
import { cancelReminder } from "../services/reminders";
import { emptyState } from "../core/model";
import { languages, useLang, useT } from "../i18n";
export default function Settings() {
  const { state, update } = useStore();
  const [token, setToken] = useState("");
  const p = state.profile!;
  const lang = useLang();
  const tr = useT();
  const presentation = presentationFor(p);
  const units: Units = p.units || "metric";
  const weightDisplay = weightDisplayFor(p);
  const weightChoices = weightDisplayOptions(presentation.region).map((d) => ({
    value: d,
    label: d === "kg" ? "Kilograms (kg)" : d === "lb" ? "Pounds (lb)" : "Stone and pounds (st)",
  }));
  const setProfile = (patch: Partial<typeof p>) =>
    act(() => update((x) => (x.profile ? { ...x, profile: { ...x.profile, ...patch } } : x)));
  const erase = () =>
    act(async () => {
      await cancelNotifications([
        ...(state.routine?.reminderIds || []),
        ...(state.education?.reminderIds || []),
      ]);
      for (const m of state.medicines)
        if (m.reminderId) await cancelReminder(m.reminderId);
      await clearToken();
      await update(() => JSON.parse(JSON.stringify(emptyState)));
      router.replace("/onboarding");
    });
  return (
    <Screen
      title="Make it yours."
      subtitle="Your profile, connections and privacy."
    >
      <Card>
        <H>{`🌐 ${tr("Language")}`}</H>
        <Chips values={languages.map((l) => ({ value: l.id, label: l.label }))} selected={lang}
          onChange={(v) => act(() => update((s) => ({ ...s, language: v })))} />
        <P>{tr("Health articles in Gym Truth are in English for now.")}</P>
      </Card>
      <Card>
        <H>{tr("Country")}</H>
        <P>{tr("Sets the date format, the spoken voice and the official health sources we show. Units stay as you chose them.")}</P>
        <CountryPicker value={p.country} onChange={(c) => setProfile({ country: c })} />
      </Card>
      <Card>
        <H>{tr("Units")}</H>
        <P>{tr("Your weight and height are always stored in kilograms and centimetres. Changing this changes what you see and enter — it never rewrites your logs.")}</P>
        <Chips
          values={[
            { value: "metric" as Units, label: "Metric (kg, cm)" },
            { value: "imperial" as Units, label: "Imperial (lb, ft/in)" },
          ]}
          selected={units}
          onChange={(v) => setProfile({ units: v, weightDisplay: v === "imperial" ? "lb" : "kg" })}
        />
        <H>{tr("Show weight in")}</H>
        <Chips values={weightChoices} selected={weightDisplay} onChange={(v) => setProfile({ weightDisplay: v as WeightDisplay })} />
        <P>{tr("Dates look like {date}, times like {time} and numbers like {number}.", { date: presentation.dateFormat, time: presentation.timeFormat, number: presentation.numberFormat })}</P>
        <P>{tr("The emergency number for your region is {number}.", { number: presentation.emergencyService })}</P>
      </Card>
      <Card>
        <H>{tr("Spoken workout cues")}</H>
        <P>{tr("Your phone reads the exercise names, set counts and rest times out loud. This is one-way audio only — the app never listens to you or records your voice.")}</P>
        <Check
          label="Read workout cues out loud"
          value={state.voiceCues !== false}
          onChange={(v) => act(() => update((x) => ({ ...x, voiceCues: v })))}
        />
      </Card>
      <Card>
        <H>{tr("{name}’s profile", { name: p.name })}</H>
        <P>
          {tr("{age} years", { age: p.age })} · {formatHeight(p.height, units)} · {formatWeight(p.weight, units, weightDisplay)} {tr("at setup")} · {tr(p.goal === "lose" ? "lose weight" : p.goal === "gain" ? "build muscle" : "maintain")}
        </P>
        <Button
          title="Edit health profile & preferences"
          onPress={() => router.push("/onboarding")}
        />
        <Check
          label="Allow AI processing when I request food analysis or chat"
          value={p.aiConsent}
          onChange={(v) =>
            act(() =>
              update((s) => ({
                ...s,
                profile: s.profile ? { ...s.profile, aiConsent: v } : null,
              })),
            )
          }
        />
        <P>
          {tr("Withdrawal stops future requests. Previously sent requests may have been retained by the configured AI provider; check the provider’s terms before entering real data.")}
        </P>
      </Card>
      {__DEV__ ? (
        <Card>
          <H>{tr("Developer service pairing")}</H>
          <P>
            {process.env.EXPO_PUBLIC_API_URL
              ? tr("An AI service URL is configured.")
              : tr("No AI service configured. Food and health logs work without it.")}
          </P>
          <Field
            label="Private pairing token"
            secret
            value={token}
            onChange={setToken}
          />
          <Button
            title="Save pairing token"
            onPress={() =>
              act(async () => {
                if (token.length < 24)
                  throw new Error(
                    "Use a random token of at least 24 characters.",
                  );
                await saveToken(token);
                setToken("");
                notify("Pairing token saved.");
              })
            }
          />
          <Button
            secondary
            title="Disconnect AI service"
            onPress={() =>
              act(async () => {
                await clearToken();
                notify("AI service disconnected.");
              })
            }
          />
        </Card>
      ) : null}
      <Card>
        <H>{tr("Account & subscriptions")}</H>
        <P>
          {tr("Sign in for optional encrypted backups. Paid AI allowances are available when store products are configured.")}
        </P>
        <Button
          title="Account and private backup"
          onPress={() => router.push("/account")}
        />
        <Button
          secondary
          title="Plans and purchases"
          onPress={() => router.push("/subscription")}
        />
        <Button
          secondary
          title="Privacy and terms"
          onPress={() => router.push("/legal")}
        />
      </Card>
      <Card>
        <H>{tr("Food, routine and education")}</H>
        <Button
          title="Weekly meal plan"
          onPress={() => router.push("/meal-plan")}
        />
        <Button
          secondary
          title="Metabolic Tracker"
          onPress={() => router.push("/metabolic")}
        />
        <Button
          secondary
          title="Steroid-risk education"
          onPress={() => router.push("/education")}
        />
      </Card>
      <Card>
        <H>{tr("Your information")}</H>
        <P>
          {Platform.OS === "web"
            ? tr("This browser preview uses temporary memory only. Refreshing clears its data.")
            : tr("Health profiles, logs and progress photos use encrypted local storage. Cloud backups are optional and uploaded from Account.")}
        </P>
        <P>
          {tr("Photo originals and temporary processing files can remain outside the encrypted database. Clearing this profile does not erase those copies.")}
        </P>
        <P>
          {tr("Health connections read daily steps, available weight and heart rate only. Revoke access in Apple Health or Android Health Connect. No advertising trackers are included.")}
        </P>
        <Button
          secondary
          title="Export my logs (without photos or chat)"
          onPress={() =>
            act(async () => {
              const exported = {
                notice:
                  "Share this with your doctor. Apply these suggestions as advised by your doctor.",
                version: state.version,
                mealPlan: state.mealPlan,
                routine: state.routine
                  ? { ...state.routine, reminderIds: [] }
                  : undefined,
                routineEvents: state.routineEvents,
                carePlan: state.carePlan,
                profile: state.profile,
                meals: state.meals,
                readings: state.readings,
                medicines: state.medicines.map(({ reminderId, ...m }) => m),
                doses: state.doses,
                workouts: state.workouts,
              };
              await Share.share({ message: JSON.stringify(exported, null, 2) });
            })
          }
        />
        <P>
          {tr("Export includes sensitive health information. Choose a destination you trust.")}
        </P>
        <Button
          secondary
          title="Clear my local profile"
          onPress={() => {
            if (Platform.OS === "web") {
              if (
                window.confirm(
                  "Delete your profile, logs, photos, chat and reminders?",
                )
              )
                erase();
            } else
              Alert.alert(
                "Clear local profile?",
                "This removes this profile’s local logs, photos, chat and reminders. Cloud backups remain available in Account.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: erase },
                ],
              );
          }}
        />
      </Card>
      <Card>
        <H>{tr("About this build")}</H>
        <P>
          {tr("Snap to Fit · development build 0.3.1 · USA cuisine preferences and user-selected workout days. General-fitness estimates and educational demonstrations. Native-device testing and launch configuration are still required.")}
        </P>
      </Card>
    </Screen>
  );
}
