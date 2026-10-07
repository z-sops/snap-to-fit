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
          targets and movement demonstrations are intended as general fitness
          information, not diagnosis or treatment. AI estimates can be wrong;
          animations have not received a complete professional form review.
          Progress photos show visual changes only. Use your
          prescribed treatment plan and your sensor’s official app for glucose
          alerts.
        </P>
      </Card>
      <Card>
        <H>Information you control</H>
        <P>
          On supported phones, profile details, health logs, meals, meal plans,
          routine check-ins, chat and saved progress-photo copies are stored in
          an encrypted device database. Photo selection/processing can also
          leave temporary files or originals in your photo library outside that
          database. The browser preview is temporary. Health permissions
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
          the service using a server-held key; this is not end-to-end encryption.
          Connecting Dexcom stores encrypted authorization tokens
          on that service. Usage counters enforce AI limits. No advertising
          trackers are included.
        </P>
      </Card>
      <Card>
        <H>Nearby gym searches</H>
        <P>When you consent to a gym search, your one-time location or entered area is sent through our server to Google Maps. Search coordinates and listings are not stored in your profile or backup. Google processes searches under its own policies. Opening directions or a Maps search launches Google Maps separately.</P>
        <Button secondary title="Google privacy policy" onPress={() => Linking.openURL("https://policies.google.com/privacy")} />
      </Card>
      <Card>
        <H>Access, export and deletion</H>
        <P>
          Settings exports your logs and clears your local profile. Account lets
          you upload or restore backups, sign out, recover access or permanently
          delete records in the active service database. Logical deletion is
          not guaranteed forensic erasure; operator backups and provider copies
          need their own retention/deletion process. Local clear does not delete a
          cloud backup. Store subscriptions must be cancelled separately in
          Apple or Google subscription settings.
        </P>
      </Card>
      <Card>
        <H>Reading notices and reminders</H>
        <P>
          Manual glucose and blood-pressure entries can show limited threshold
          notices. These are not continuous monitoring or a complete assessment:
          no notice does not mean a reading or workout is safe. Notifications
          can be delayed or missed. Follow your existing care plan and official
          sensor alerts; this app does not contact emergency services.
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
