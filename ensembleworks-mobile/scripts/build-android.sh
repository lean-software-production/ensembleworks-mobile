#!/usr/bin/env bash
# Release includes its JS bundle and prebuild's development keystore, not Metro.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_HOME:?Activate Flox first}"
: "${JAVA_HOME:?Activate Flox first}"
case "${EXPO_PUBLIC_APP_MODE:-production}" in
  production) : "${EXPO_PUBLIC_DEPLOYMENT_URL:?Set the public deployment URL for production}" ;;
  demo) ;;
  *) echo 'EXPO_PUBLIC_APP_MODE must be production or demo' >&2; exit 2 ;;
esac
export EXPO_PUBLIC_APP_MODE=${EXPO_PUBLIC_APP_MODE:-production}
[[ -x android/gradlew ]] || { echo 'Run npx expo prebuild --platform android first' >&2; exit 1; }
# The architecture override is useful for the factory emulator; default APK also
# includes arm64 for the physical Pixel handoff.
cd android
# Flox's JDK exports its host jni.h via CPATH. Android must use the NDK
# jni.h instead: the host's JNIEnv_/JavaVM_ ABI differs from _JNIEnv/_JavaVM.
unset CPATH C_INCLUDE_PATH CPLUS_INCLUDE_PATH
args=()
if [[ -n "${EW_ANDROID_ARCHITECTURES:-}" ]]; then
  args+=("-PreactNativeArchitectures=$EW_ANDROID_ARCHITECTURES")
fi
exec timeout --foreground --kill-after=30 "${EW_ANDROID_BUILD_SECONDS:-2400}" \
  ./gradlew --no-daemon --max-workers=4 :app:assembleRelease "${args[@]}"
