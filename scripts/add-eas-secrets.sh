#!/usr/bin/env bash
# Helper: Create EAS secrets for AdMob keys
# Usage: ensure you are logged in to Expo (eas login) and run this script. It will prompt for values.
# This script only generates the `eas secret:create` commands for you to run manually.

set -euo pipefail

SECRETS=(
  "EXPO_PUBLIC_ADMOB_APP_ID"
  "EXPO_PUBLIC_ADMOB_BANNER_ANDROID"
  "EXPO_PUBLIC_ADMOB_BANNER_IOS"
  "EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID"
  "EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS"
  "EXPO_PUBLIC_ADMOB_REWARDED_ANDROID"
  "EXPO_PUBLIC_ADMOB_REWARDED_IOS"
)

echo "This will create EAS secrets for AdMob keys. Run these commands one-by-one after logging in with 'eas login'.\n"
for key in "${SECRETS[@]}"; do
  echo "# Create secret for $key"
  echo "eas secret:create --name $key --value \"<PASTE_VALUE_HERE>\" --scope project"
  echo
done

echo "After creating secrets, EAS builds will inject them into expoConfig.extra at build time."
