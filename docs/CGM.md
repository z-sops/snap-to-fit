# CGM connection

## Implemented connection path

Sign in to your Snap to Fit account. Health → Connect my CGM opens Dexcom's official OAuth login. The server verifies single-use expiring state, exchanges the code, encrypts per-user tokens at rest, rotates refresh tokens and fetches `/v3/users/self/egvs`. Return to the app and manually sync historical readings.

Configure `DEXCOM_REGION` (`sandbox`, `us`, `eu`, or `jp`), `DEXCOM_CLIENT_ID`, `DEXCOM_CLIENT_SECRET` and the exact registered HTTPS `DEXCOM_REDIRECT_URI` ending `/cgm/dexcom/callback`.

Stored authorization tokens survive service restart when the database and encryption key persist. Pending OAuth attempts expire and do not survive restart. Disconnect clears provider tokens; revoke access in Dexcom to remove provider authorization. No background polling or real-time alarms are implemented. Commercial credentials and device acceptance testing remain necessary.

## Freshness and clinical use

The official Dexcom documentation states a one-hour delay for mobile uploads in the US and a three-hour delay outside the US including Japan. Receiver-upload availability differs. Values are historical, with source and measurement timestamps. Special low/high codes are displayed as LOW/HIGH, not as precise numbers. Sandbox is clearly labeled simulated. These records must not drive immediate workout safety, dosing, or hypoglycemia alarms. Keep the manufacturer app and its alarms active.

Commercial data access requires Dexcom's partnership/review process. Creating a developer account provides sandbox access, not automatic commercial production access. Provider support and country availability must be checked during launch preparation.

## FreeStyle Libre

Abbott documents LibreLinkUp caregiver sharing and LibreView uploads. That does not establish an open public integration entitlement for this app. The UI identifies Abbott partner integration as unconfigured. No password scraping, unofficial LibreLinkUp login, sensor reverse engineering or fabricated readings are included. Implement a partner adapter only after receiving authorized documentation and access.

## Official references checked 2026-10-06

- https://developer.dexcom.com/docs/dexcomv3/endpoint-overview
- https://developer.dexcom.com/docs/dexcom/authentication
- https://developer.dexcom.com/docs/dexcom/scopes-access
- https://developer.dexcom.com/docs/swaggerv3/other/getestimatedglucosevaluesv3
- https://www.support.freestyle.abbott/hc/en-us/articles/36332656335505-How-does-the-LibreLinkUp-app-work
