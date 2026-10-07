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
  act,
  notify,
} from "../components/ui";
import { useStore } from "../services/store";
import { saveToken, clearToken } from "../services/storage";
import { cancelNotifications } from "../services/routine-notifications";
import { cancelReminder } from "../services/reminders";
import { emptyState } from "../core/model";
export default function Settings() {
  const { state, update } = useStore();
  const [token, setToken] = useState("");
  const p = state.profile!;
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
        <H>{p.name}’s profile</H>
        <P>
          {p.age} years · {p.height} cm · {p.weight} kg at setup · {p.goal}
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
          Withdrawal stops future requests. Previously sent requests may have
          been retained by the configured AI provider; check the provider’s
          terms before entering real data.
        </P>
      </Card>
      {__DEV__ ? (
        <Card>
          <H>Developer service pairing</H>
          <P>
            {process.env.EXPO_PUBLIC_API_URL
              ? "An AI service URL is configured."
              : "No AI service configured. Food and health logs work without it."}
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
        <H>Account & subscriptions</H>
        <P>
          Sign in for optional encrypted backups. Paid AI allowances are
          available when store products are configured.
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
        <H>Food, routine and education</H>
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
        <H>Your information</H>
        <P>
          {Platform.OS === "web"
            ? "This browser preview uses temporary memory only. Refreshing clears its data."
            : "Health profiles, logs and progress photos use encrypted local storage. Cloud backups are optional and uploaded from Account."}
        </P>
        <P>
          Photo originals and temporary processing files can remain outside the
          encrypted database. Clearing this profile does not erase those copies.
        </P>
        <P>
          Health connections read daily steps, available weight and heart rate
          only. Revoke access in Apple Health or Android Health Connect. No
          advertising trackers are included.
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
          Export includes sensitive health information. Choose a destination you
          trust.
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
        <H>About this build</H>
        <P>
          Snap to Fit · development build 0.3.1 · USA cuisine preferences and
          user-selected workout days. General-fitness estimates and
          educational demonstrations. Native-device testing and launch
          configuration are still required.
        </P>
      </Card>
    </Screen>
  );
}
