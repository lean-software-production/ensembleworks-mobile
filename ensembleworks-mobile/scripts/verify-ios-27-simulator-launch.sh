#!/usr/bin/env bash
# Build a self-contained demo-mode simulator app and prove it remains running.
set -euo pipefail

BUNDLE_ID="dev.ensembleworks.mobile"
SCHEME="ensembleWorksMobile"
WORKSPACE="ios/${SCHEME}.xcworkspace"
DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-$PWD/.build/ios-27-simulator}"
DEVICE="${IOS_SIMULATOR_DEVICE:-$(xcrun simctl list devices booted -j | node -e '
  const devices = Object.values(JSON.parse(require("fs").readFileSync(0, "utf8")).devices).flat();
  const booted = devices.find((device) => device.state === "Booted");
  if (!booted) process.exit(1);
  process.stdout.write(booted.udid);
')}"
[[ -n "$DEVICE" ]] || { echo "Boot an iOS simulator or set IOS_SIMULATOR_DEVICE to its UDID" >&2; exit 1; }
APP_PATH="$DERIVED_DATA_PATH/Build/Products/Release-iphonesimulator/${SCHEME}.app"
CRASH_MARKER="$(mktemp -t ensembleworks-mobile-crash-marker)"
cleanup() {
  rm -f "$CRASH_MARKER"
}
trap cleanup EXIT
touch "$CRASH_MARKER"

# The Release bundle is embedded by Xcode, without Metro or a deep link. Expo
# inlines this explicit mode into this build's bundle without changing sources.
EXPO_PUBLIC_APP_MODE=demo xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$DEVICE" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  build

xcrun simctl bootstatus "$DEVICE" -b
xcrun simctl uninstall "$DEVICE" "$BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl install "$DEVICE" "$APP_PATH"
LAUNCH_OUTPUT="$(xcrun simctl launch "$DEVICE" "$BUNDLE_ID")"
printf '%s\n' "$LAUNCH_OUTPUT"
PID="${LAUNCH_OUTPUT##*: }"
[[ "$PID" =~ ^[0-9]+$ ]] || { echo "Could not read app PID from simctl launch output" >&2; exit 1; }

sleep 20
PROCESS_STATUS="$(xcrun simctl spawn "$DEVICE" launchctl print "pid/$PID")"
if grep -q 'properties = slain' <<<"$PROCESS_STATUS"; then
  echo "${BUNDLE_ID} was not still running after 20 seconds" >&2
  exit 1
fi
if find "$HOME/Library/Logs/DiagnosticReports" -type f -iname '*ensembleWorksMobile*' -newer "$CRASH_MARKER" -print -quit | grep -q .; then
  echo "A new ensembleWorksMobile crash report was written" >&2
  exit 1
fi

echo "${BUNDLE_ID} remained running for 20 seconds with no new crash report."
