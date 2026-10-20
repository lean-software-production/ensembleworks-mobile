#!/usr/bin/env bash
# No authentication: use only the script-owned factory AVD, never an owner AVD.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_HOME:?Activate Flox first}"
mode=${ANDROID_LAUNCH_MODE:-both}
case "$mode" in production|demo|both) ;; *) echo 'ANDROID_LAUNCH_MODE must be production, demo or both' >&2; exit 2 ;; esac
# Fixed public address: do not accept arbitrary (potentially credential-bearing) URLs.
export EXPO_PUBLIC_DEPLOYMENT_URL=https://canvas-ew-lsp-001.ensembleworks.dev/
evidence=${ANDROID_EVIDENCE_DIR:-$PWD/docs/evidence/android-launch}
artifacts=${ANDROID_ARTIFACT_DIR:-$HOME/.local/share/ensembleworks-mobile/artifacts/iteration-004/launch}
mkdir -p "$evidence" "$artifacts"
serial=emulator-5580
app=dev.ensembleworks.mobile
adb_cmd() { timeout --kill-after=5 30 adb -s "$serial" "$@"; }
if adb_cmd get-state >/dev/null 2>&1; then
  echo 'Port 5580 is occupied; stop that emulator before running this check.' >&2
  exit 1
fi
emulator_pid=
cleanup() {
  if [[ -n "$emulator_pid" ]]; then
    adb_cmd emu kill >/dev/null 2>&1 || true
    wait "$emulator_pid" || true
    emulator_pid=
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
node --version
for current in production demo; do
  [[ "$mode" == both || "$mode" == "$current" ]] || continue
  export EXPO_PUBLIC_APP_MODE=$current EW_ANDROID_ARCHITECTURES=x86_64
  rm -f "$evidence/$current.png" "$evidence/$current-result.txt" "$evidence/$current-crash.log"
  printf 'Building %s, deployment %s, architecture x86_64\n' "$current" "$EXPO_PUBLIC_DEPLOYMENT_URL"
  # Clean generation and bundling prevent a previous mode's embedded JS being reused.
  timeout --kill-after=15 300 npx expo prebuild --clean --platform android
  npm run build:android
  apk="$artifacts/$current-x86_64-release.apk"
  cp android/app/build/outputs/apk/release/app-release.apk "$apk"
  sha256sum "$apk" | tee "$evidence/$current-apk.sha256"
  # Retain hardware/boot diagnostics, but omit unnecessary public ADB identity.
  EW_EMULATOR_SECONDS=360 bash scripts/android-emulator.sh headless \
    > >(grep --line-buffered -viE 'adb public key|adb\.pubkey' >"$evidence/$current-emulator.log") 2>&1 &
  emulator_pid=$!
  booted=false
  for ((attempt=0; attempt<120; attempt++)); do
    kill -0 "$emulator_pid" 2>/dev/null || { echo 'Emulator exited before boot' >&2; exit 1; }
    if [[ "$(adb_cmd shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == 1 ]]; then booted=true; break; fi
    sleep 2
  done
  [[ "$booted" == true ]] || { echo 'Emulator boot timed out' >&2; exit 1; }
  # Clear any factory app state before launching; no saved Access session is used.
  adb_cmd uninstall "$app" >/dev/null 2>&1 || true
  adb_cmd install "$apk"
  adb_cmd logcat -b crash -c
  adb_cmd shell am start -W -n "$app/.MainActivity"
  initial_pid=$(adb_cmd shell pidof "$app" | tr -d '\r' || true)
  if [[ ! "$initial_pid" =~ ^[0-9]+$ ]]; then
    adb_cmd logcat -b crash -d -v brief >"$evidence/$current-crash.log"
    echo 'No app process after launch; inspect crash evidence' >&2
    exit 1
  fi
  sleep 20
  final_pid=$(adb_cmd shell pidof "$app" | tr -d '\r' || true)
  adb_cmd logcat -b crash -d -v brief >"$evidence/$current-crash.log"
  [[ "$final_pid" == "$initial_pid" ]] || { echo 'App exited or restarted in launch window' >&2; exit 1; }
  # Crash buffer only, never general app/network traffic. Fresh factory launch;
  # reject any crash in this window, including native tombstone reports.
  adb_cmd logcat -b crash -d -v brief >"$evidence/$current-crash.log"
  if grep -q '[^[:space:]]' "$evidence/$current-crash.log"; then
    echo 'Launch-window crash buffer is nonempty; inspect crash evidence' >&2; exit 1
  fi
  adb_cmd exec-out screencap -p >"$evidence/$current.png"
  printf '%s: %s; PID %s survived 20 seconds; crash buffer empty; screenshot %s\n' \
    "$current" "$serial" "$final_pid" "$evidence/$current.png" | tee "$evidence/$current-result.txt"
  cleanup
done
