#!/usr/bin/env bash
# Copies the API's SQLite volume to /root/backups (data inside stays encrypted with DATA_ENCRYPTION_KEY).
set -euo pipefail
dest=/root/backups; mkdir -p "$dest"
vol=$(docker volume ls -q | grep 'api-data$' | head -1)
docker run --rm -v "$vol":/data:ro -v "$dest":/backup alpine tar czf "/backup/snaptofit-$(date +%F).tgz" -C /data .
find "$dest" -name 'snaptofit-*.tgz' -mtime +14 -delete
echo "Backup done: $dest/snaptofit-$(date +%F).tgz"
