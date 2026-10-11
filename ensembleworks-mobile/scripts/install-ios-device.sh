#!/usr/bin/env bash
# Build a signed embedded-JavaScript app, then install and launch it on a connected iPhone.
set -euo pipefail

BUNDLE_ID="dev.ensembleworks.mobile"
SCHEME="ensembleWorksMobile"
WORKSPACE="ios/${SCHEME}.xcworkspace"
MODE="${IOS_DEVICE_MODE:-production}"
DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-$PWD/.build/ios-device}/$MODE"
APP_PATH="$DERIVED_DATA_PATH/Build/Products/Release-iphoneos/${SCHEME}.app"
# This is a public deployment address, not a credential. Supplying it to the
# production bundle keeps application source free of a deployment default.
PRODUCTION_DEPLOYMENT_URL="${EXPO_PUBLIC_DEPLOYMENT_URL:-https://canvas-ew-lsp-001.ensembleworks.dev}"
case "$MODE" in demo|production) ;; *) echo "IOS_DEVICE_MODE must be demo or production" >&2; exit 1 ;; esac

DEVICE_LIST="$(mktemp -t ensembleworks-mobile-devices)"
cleanup() { rm -f "$DEVICE_LIST"; }
trap cleanup EXIT
xcrun devicectl list devices --json-output "$DEVICE_LIST" >/dev/null
DEVICE="${IOS_DEVICE:-$(node -e '
  const devices = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).result.devices;
  const connected = devices.find((device) =>
    device.hardwareProperties.reality === "physical" &&
    device.hardwareProperties.platform === "iOS" &&
    device.connectionProperties.tunnelState !== "unavailable");
  if (connected) process.stdout.write(connected.hardwareProperties.udid);
' "$DEVICE_LIST")}"
[[ -n "$DEVICE" ]] || { echo "Connect and unlock a trusted iPhone with Developer Mode on, or set IOS_DEVICE to its UDID" >&2; exit 1; }

# Signing uses the team selected once in Xcode's Signing & Capabilities editor;
# that selection lives in the generated ios/ project and is not committed.
echo "Building signed ${MODE} bundle for ${DEVICE}..."
if [[ "$MODE" == demo ]]; then
  EXPO_PUBLIC_APP_MODE=demo xcodebuild \
    -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
    -destination "id=$DEVICE" -derivedDataPath "$DERIVED_DATA_PATH" \
    -allowProvisioningUpdates -allowProvisioningDeviceRegistration build
else
  EXPO_PUBLIC_APP_MODE=production EXPO_PUBLIC_DEPLOYMENT_URL="$PRODUCTION_DEPLOYMENT_URL" xcodebuild \
    -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
    -destination "id=$DEVICE" -derivedDataPath "$DERIVED_DATA_PATH" \
    -allowProvisioningUpdates -allowProvisioningDeviceRegistration build
fi

xcrun devicectl device install app --device "$DEVICE" "$APP_PATH"
xcrun devicectl device process launch --device "$DEVICE" "$BUNDLE_ID"
echo "${BUNDLE_ID} (${MODE}) is installed and launched on ${DEVICE}."
