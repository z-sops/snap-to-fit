import React from "react";
import { Linking } from "react-native";
import { Screen, Card, H, P, Button } from "../components/ui";
export default function Legal() {
  return (
    <Screen title="Your privacy." subtitle="App data and service information">
      <Card>
        <H>Fitness estimates and tracking</H>
        <P>
          Snap to Fit is for adults aged 18 or older. Food estimates, calorie
          targets and movement demonstrations are general fitness information.
          They do not diagnose conditions, measure visceral fat or prescribe
          medication. Progress photos show visual changes only. Use your
          prescribed treatment plan and your sensor’s official app for glucose
          alerts.
        </P>
      </Card>
      <Card>
        <H>Information you control</H>
        <P>
          On supported phones, profile details, health logs, meals, meal plans,
          routine check-ins, chat and progress photos are stored in an encrypted
          device database. The browser preview is temporary. Health permissions
          are read-only and optional; revoke them in your device health
          settings. Progress photos remain on your device.
        </P>
        <P>
          When you request AI analysis with consent, a resized meal photo or
          your question and relevant profile are sent through the configured
          server to its AI provider. Provider retention is governed by that
          provider’s terms. Do not photograph other people or upload information
          you do not want processed.
        </P>
        <P>
          An optional account stores a username, salted password hash,
          recovery-code hash and session hashes. Manual backups are encrypted on
          the service. Connecting Dexcom stores encrypted authorization tokens
          on that service. Usage counters enforce AI limits. No advertising
          trackers are included.
        </P>
      </Card>
      <Card>
        <H>Access, export and deletion</H>
        <P>
          Settings exports your logs and clears your local profile. Account lets
          you upload or restore backups, sign out, recover access or permanently
          delete server-side account records. Local clear does not delete a
          cloud backup. Store subscriptions must be cancelled separately in
          Apple or Google subscription settings.
        </P>
      </Card>
      <Card>
        <H>Published policies</H>
        <P>
          The release operator must publish its full privacy policy and terms,
          including its identity, contact details, retention schedule and
          regional rights. Public policy links are configured for each release.
        </P>
        {process.env.EXPO_PUBLIC_PRIVACY_URL ? (
          <Button
            secondary
            title="Read privacy policy"
            onPress={() =>
              Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL!)
            }
          />
        ) : null}
        {process.env.EXPO_PUBLIC_TERMS_URL ? (
          <Button
            secondary
            title="Read terms of use"
            onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_TERMS_URL!)}
          />
        ) : null}
      </Card>
    </Screen>
  );
}
