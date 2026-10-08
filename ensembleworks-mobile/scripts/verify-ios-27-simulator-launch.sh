#!/usr/bin/env bash
# Build embedded-JavaScript simulator apps and prove demo and production launch.
set -euo pipefail

BUNDLE_ID="dev.ensembleworks.mobile"
SCHEME="ensembleWorksMobile"
WORKSPACE="ios/${SCHEME}.xcworkspace"
DERIVED_DATA_ROOT="${DERIVED_DATA_PATH:-$PWD/.build/ios-27-simulator}"
EVIDENCE_DIR="${SIMULATOR_EVIDENCE_DIR:-$PWD/docs/evidence}"
# This is a public deployment address, not a credential. Supplying it to the
# production bundle keeps application source free of a deployment default.
PRODUCTION_DEPLOYMENT_URL="${EXPO_PUBLIC_DEPLOYMENT_URL:-https://canvas-ew-lsp-001.ensembleworks.dev}"
MODE="${SIMULATOR_LAUNCH_MODE:-both}"
DEVICE="${IOS_SIMULATOR_DEVICE:-$(xcrun simctl list devices booted -j | node -e '
  const devices = Object.values(JSON.parse(require("fs").readFileSync(0, "utf8")).devices).flat();
  const booted = devices.find((device) => device.state === "Booted");
  if (!booted) process.exit(1);
  process.stdout.write(booted.udid);
')}"
[[ -n "$DEVICE" ]] || { echo "Boot an iOS simulator or set IOS_SIMULATOR_DEVICE to its UDID" >&2; exit 1; }
case "$MODE" in demo|production|both) ;; *) echo "SIMULATOR_LAUNCH_MODE must be demo, production, or both" >&2; exit 1 ;; esac
mkdir -p "$EVIDENCE_DIR"

CRASH_MARKER="$(mktemp -t ensembleworks-mobile-crash-marker)"
cleanup() { rm -f "$CRASH_MARKER"; }
trap cleanup EXIT
touch "$CRASH_MARKER"

verify_launch() {
  local mode="$1"
  local derived_data_path="$DERIVED_DATA_ROOT/$mode"
  local app_path="$derived_data_path/Build/Products/Release-iphonesimulator/${SCHEME}.app"
  local launch_output pid process_status screenshot
  screenshot="$EVIDENCE_DIR/ios-27-simulator-${mode}-launch.png"

  echo "Building embedded ${mode} bundle..."
  if [[ "$mode" == demo ]]; then
    EXPO_PUBLIC_APP_MODE=demo xcodebuild \
      -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
      -sdk iphonesimulator -destination "platform=iOS Simulator,id=$DEVICE" \
      -derivedDataPath "$derived_data_path" build
  else
    EXPO_PUBLIC_APP_MODE=production EXPO_PUBLIC_DEPLOYMENT_URL="$PRODUCTION_DEPLOYMENT_URL" xcodebuild \
      -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
      -sdk iphonesimulator -destination "platform=iOS Simulator,id=$DEVICE" \
      -derivedDataPath "$derived_data_path" build
  fi

  xcrun simctl bootstatus "$DEVICE" -b
  xcrun simctl uninstall "$DEVICE" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl install "$DEVICE" "$app_path"
  launch_output="$(xcrun simctl launch "$DEVICE" "$BUNDLE_ID")"
  printf '%s\n' "$launch_output"
  pid="${launch_output##*: }"
  [[ "$pid" =~ ^[0-9]+$ ]] || { echo "Could not read app PID from simctl launch output" >&2; exit 1; }

  sleep 20
  process_status="$(xcrun simctl spawn "$DEVICE" launchctl print "pid/$pid")"
  if grep -q 'properties = slain' <<<"$process_status"; then
    echo "${BUNDLE_ID} (${mode}) was not still running after 20 seconds" >&2
    exit 1
  fi
  if find "$HOME/Library/Logs/DiagnosticReports" -type f -iname '*ensembleWorksMobile*' -newer "$CRASH_MARKER" -print -quit | grep -q .; then
    echo "A new ensembleWorksMobile crash report was written during ${mode} launch" >&2
    exit 1
  fi
  # Capture only the entry point: it contains neither an Access cookie nor token.
  xcrun simctl io "$DEVICE" screenshot "$screenshot"
  echo "${BUNDLE_ID} (${mode}) remained running for 20 seconds with no new crash report. Screenshot: ${screenshot}"
}

[[ "$MODE" == demo || "$MODE" == both ]] && verify_launch demo
[[ "$MODE" == production || "$MODE" == both ]] && verify_launch production
