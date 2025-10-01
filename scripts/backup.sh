#!/usr/bin/env bash
# Create a timestamped zip backup of the project root into backups/
# Excludes common heavy folders like node_modules, android/build, ios build artifacts, .git, .expo, and backups/
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
mkdir -p backups
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
FILENAME="NEW-app-backup-${TIMESTAMP}.zip"
EXCLUDES=(
  "node_modules/*"
  "android/build/*"
  "android/app/build/*"
  "ios/Pods/*"
  "ios/build/*"
  ".git/*"
  "backups/*"
  "**/.expo/*"
  "**/.expo-shared/*"
  "**/*.keystore"
  "**/*.jks"
  "**/*.env"
)
# Build the exclude args for zip
EXCLUDE_ARGS=()
for e in "${EXCLUDES[@]}"; do
  EXCLUDE_ARGS+=("-x" "$e")
done

echo "Creating backup: backups/$FILENAME"
# Use zip to create archive; fallback to tar.gz if zip missing
if command -v zip >/dev/null 2>&1; then
  # zip wants patterns relative to current dir; include dotfiles explicitly
  zip -r "backups/$FILENAME" . -q "-x" "${EXCLUDES[@]}"
else
  echo "zip not found; using tar.gz instead"
  tar --exclude='node_modules' --exclude='backups' --exclude='.git' -czf "backups/NEW-app-backup-${TIMESTAMP}.tar.gz" .
  echo "Created backups/NEW-app-backup-${TIMESTAMP}.tar.gz"
  exit 0
fi

echo "Backup complete: backups/$FILENAME"
