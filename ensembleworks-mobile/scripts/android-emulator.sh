#!/usr/bin/env bash
# Credential-free development AVD. Run through flox; never use an owner login AVD.
set -euo pipefail
mode=${1:-headless}
case "$mode" in
  headless) window=(-no-window) ;;
  windowed) window=() ;;
  *) echo 'Usage: bash scripts/android-emulator.sh [headless|windowed]' >&2; exit 2 ;;
esac
: "${ANDROID_HOME:?Activate the repository Flox environment first}"
: "${JAVA_HOME:?Activate the repository Flox environment first}"
image='system-images;android-37.1;google_apis_ps16k;x86_64'
name=ensembleworks-api37-1-factory
# Isolate from any AVD where the owner might have signed in.
export ANDROID_AVD_HOME="${HOME}/.android/ensembleworks-factory-avd"
mkdir -p "$ANDROID_AVD_HOME"
[[ -r /dev/kvm && -w /dev/kvm ]] || { echo 'KVM is not accessible' >&2; exit 1; }
[[ -r /dev/video0 ]] || { echo 'Host webcam /dev/video0 is not accessible' >&2; exit 1; }
[[ -d "$ANDROID_HOME/system-images/android-37.1/google_apis_ps16k/x86_64" ]] || {
  echo 'Install the pinned SDK: bash scripts/install-android-sdk.sh' >&2; exit 1;
}
emulator -accel-check
emulator -webcam-list
if [[ ! -f "$ANDROID_AVD_HOME/$name.avd/config.ini" ]]; then
  avdmanager create avd --name "$name" --package "$image" --device pixel_9 --force <<< no
fi
config="$ANDROID_AVD_HOME/$name.avd/config.ini"
# Idempotently set only script-owned hardware properties.
for setting in hw.gpu.enabled=yes hw.gpu.mode=host hw.camera.front=webcam0 \
  hw.camera.back=none hw.audioInput=yes hw.audioOutput=yes hw.ramSize=4096 \
  disk.dataPartition.size=6G; do
  key=${setting%%=*}
  value=${setting#*=}
  tmp=$(mktemp "$ANDROID_AVD_HOME/config.XXXXXX")
  awk -v key="$key" 'index($0, key "=") != 1 && index($0, key " =") != 1' "$config" > "$tmp"
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$config"
done
# KVM/host GPU are mandatory: no software-rendering fallback. Audio is on by
# default; explicitly keep microphone input enabled (never pass -no-audio).
# A bound applies to owner windowed runs too; override for a longer session.
exec timeout --foreground --kill-after=10 "${EW_EMULATOR_SECONDS:-1800}" \
  emulator -avd "$name" -port 5580 -accel on -gpu host -camera-front webcam0 \
  -camera-back none -no-snapshot -no-boot-anim -no-metrics "${window[@]}"
