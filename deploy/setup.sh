#!/usr/bin/env bash
# One-time (and repeatable) setup for a fresh Ubuntu 24.04 droplet.
# Usage (as root, from the repo):  cd snap-to-fit/deploy && bash setup.sh
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created deploy/.env — fill in API_DOMAIN, SITE_DOMAIN, ACME_EMAIL, OPERATOR_NAME, SUPPORT_EMAIL and GEMINI_API_KEY, then run this again."
  exit 1
fi
set -a; . ./.env; set +a
for v in API_DOMAIN SITE_DOMAIN ACME_EMAIL OPERATOR_NAME SUPPORT_EMAIL; do
  if [ -z "${!v:-}" ] || [[ "${!v}" == *example.com* ]]; then echo "Set $v in deploy/.env first."; exit 1; fi
done

# 1. Swap (1 GB droplets need it for docker builds)
if ! swapon --show | grep -q swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2. Docker + firewall
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
apt-get install -y ufw >/dev/null
ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null; ufw --force enable >/dev/null

# 3. Encryption key for stored accounts/backups (generated once, keep a copy offline!)
if [ -z "${DATA_ENCRYPTION_KEY:-}" ]; then
  key=$(openssl rand -hex 32)
  sed -i "s/^DATA_ENCRYPTION_KEY=.*/DATA_ENCRYPTION_KEY=$key/" .env
  echo ">>> Generated DATA_ENCRYPTION_KEY and saved it in deploy/.env. Copy it somewhere safe and offline NOW — without it, saved backups cannot be read."
fi
if ! grep -q '^WEB_ORIGIN=https' .env; then sed -i "s#^WEB_ORIGIN=.*#WEB_ORIGIN=https://$SITE_DOMAIN#" .env; fi
chmod 600 .env

# 4. Public website from templates
rm -rf public && mkdir -p public media
updated=$(date +"%B %-d, %Y")
for f in site/*.html site/*.css; do
  sed -e "s#{{OPERATOR_NAME}}#$OPERATOR_NAME#g" -e "s#{{SUPPORT_EMAIL}}#$SUPPORT_EMAIL#g" \
      -e "s#{{OPERATOR_COUNTRY}}#${OPERATOR_COUNTRY:-}#g" -e "s#{{SITE_DOMAIN}}#$SITE_DOMAIN#g" \
      -e "s#{{API_DOMAIN}}#$API_DOMAIN#g" -e "s#{{UPDATED}}#$updated#g" "$f" > "public/$(basename "$f")"
done

# 5. Exercise images (public domain) served from our own domain
if [ ! -d media/exercises ]; then bash ../scripts/mirror-exercise-media.sh media/exercises || echo "Exercise media mirror failed — the app falls back to the public dataset."; fi

# 6. Start
docker compose up -d --build

# 7. Daily encrypted-database backup (keeps 14 days)
cp backup.sh /usr/local/bin/snaptofit-backup && chmod +x /usr/local/bin/snaptofit-backup
( crontab -l 2>/dev/null | grep -v snaptofit-backup; echo "17 3 * * * /usr/local/bin/snaptofit-backup >/var/log/snaptofit-backup.log 2>&1" ) | crontab -

echo "Waiting for HTTPS certificates…"; sleep 20
curl -fsS "https://$API_DOMAIN/health" && echo && echo "API is live at https://$API_DOMAIN"
echo "Website: https://$SITE_DOMAIN  (privacy, terms, support, delete-account)"
