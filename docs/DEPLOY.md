# Deploying Snap to Fit (DigitalOcean, ~$7/month)

What goes live: the API (accounts, backup, AI photo + Coach via Gemini, CGM, gyms), exercise
images, and the public website (privacy, terms, support, delete-account) — all on one $6
droplet with automatic HTTPS.

Never paste keys, passwords or the `.env` file into chat. You type them only on the server.

## 1. Create the droplet
DigitalOcean → Create → Droplets:
- Region **New York**, image **Ubuntu 24.04 LTS**, size **Basic · Regular · $6** (1 GB)
- **Backups: weekly**
- Authentication: SSH key (or password)
- Hostname `snaptofit-api`

Note the droplet **IP address**.

## 2. Point the domain at it
At your domain registrar (e.g. `snaptofit.app`) add two **A records** to the droplet IP:
| Name | Value |
|---|---|
| `@` | droplet IP |
| `api` | droplet IP |
Wait until `ping api.snaptofit.app` shows the IP (minutes to an hour).

## 3. Get a paid Gemini key
Google AI Studio → API keys → create a key in a project with **billing enabled** (paid tier;
the free tier may use prompts to improve Google products). Keep it private.

## 4. Install on the server
From Windows PowerShell:
```powershell
ssh root@<DROPLET-IP>
```
On the server:
```bash
git clone https://github.com/z-sops/snap-to-fit.git
cd snap-to-fit && git checkout main
cd deploy && bash setup.sh          # first run creates deploy/.env and stops
nano .env                           # fill in the values below, save with Ctrl+O, Enter, Ctrl+X
bash setup.sh                       # second run installs Docker, firewall, HTTPS, starts everything
```
Fill in `deploy/.env`:
- `API_DOMAIN=api.snaptofit.app`, `SITE_DOMAIN=snaptofit.app`
- `ACME_EMAIL=` your email (for HTTPS certificate notices)
- `OPERATOR_NAME=Zunitech`, `OPERATOR_COUNTRY=Pakistan`, `SUPPORT_EMAIL=` your support inbox
- `GEMINI_API_KEY=` the paid key
- Leave `DATA_ENCRYPTION_KEY` empty — setup generates it. **Copy it somewhere safe offline**
  (password manager). Without it, saved backups can’t be read.
- `DEXCOM_REDIRECT_URI=https://api.snaptofit.app/cgm/dexcom/callback` (only if you use Dexcom)

At the end you should see `{"status":"ok","aiConfigured":true}` and
"API is live at https://api.snaptofit.app".

Daily database backups run at 03:17 (kept 14 days) via `/usr/local/bin/snaptofit-backup`.

## 5. Point the app at the server
In the project on your PC create `.env.production`:
```
EXPO_PUBLIC_API_URL=https://api.snaptofit.app
EXPO_PUBLIC_SITE_URL=https://snaptofit.app
EXPO_PUBLIC_EXERCISE_MEDIA_URL=https://api.snaptofit.app/media/exercises
```
Then build the APK again (no prebuild needed for env-only changes):
```powershell
cd android
.\gradlew app:assembleRelease --max-workers=1 -PreactNativeArchitectures=arm64-v8a
adb install -r .\app\build\outputs\apk\release\app-release.apk
```
In the app: Menu → Account and backup → create an account; Settings → turn on AI consent;
then try Snap and Coach.

## Updating the server later
```bash
cd ~/snap-to-fit && git pull && cd deploy && docker compose up -d --build
```

## Checks
- `curl https://api.snaptofit.app/health` → `aiConfigured: true`
- `https://snaptofit.app/privacy` opens with your company name and email
- `docker compose logs -f api` to watch errors
