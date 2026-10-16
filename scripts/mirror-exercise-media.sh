#!/usr/bin/env bash
# Downloads free-exercise-db images (public domain) so we serve them from our own domain.
# Usage: bash scripts/mirror-exercise-media.sh <target dir>
set -euo pipefail
target=${1:?target dir}
tmp=$(mktemp -d)
curl -fsSL https://codeload.github.com/yuhonas/free-exercise-db/tar.gz/refs/heads/main | tar xz -C "$tmp"
mkdir -p "$target"
cp -r "$tmp"/free-exercise-db-main/exercises/. "$target"/
find "$target" -type f ! -name '*.jpg' -delete
rm -rf "$tmp"
echo "Mirrored $(find "$target" -name '*.jpg' | wc -l) images to $target"
