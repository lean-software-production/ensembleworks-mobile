#!/usr/bin/env bash
# Google SDK fallback. Run inside Flox; installs only into the user's SDK.
set -euo pipefail
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
: "${JAVA_HOME:?Activate Flox first}"
mkdir -p "$ANDROID_HOME/cmdline-tools"
if [[ ! -x "$ANDROID_HOME/cmdline-tools/22.0/bin/sdkmanager" ]]; then
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  curl --fail --location --max-time 300 --output "$tmp/tools.zip" \
    https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip
  echo "4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583  $tmp/tools.zip" | sha256sum --check
  unzip -q "$tmp/tools.zip" -d "$tmp"
  mv "$tmp/cmdline-tools" "$ANDROID_HOME/cmdline-tools/22.0"
fi
sdkmanager="$ANDROID_HOME/cmdline-tools/22.0/bin/sdkmanager"
# Accept the Android SDK licenses explicitly, without an unbounded yes process.
printf 'y\ny\ny\ny\ny\ny\ny\ny\ny\ny\n' | "$sdkmanager" --sdk_root="$ANDROID_HOME" --licenses
"$sdkmanager" --sdk_root="$ANDROID_HOME" --channel=0 \
  'platform-tools' 'platforms;android-37.0' 'platforms;android-37.1' \
  'build-tools;36.0.0' 'build-tools;37.0.0' 'ndk;27.1.12297006' \
  'cmake;3.22.1' 'emulator' 'system-images;android-37.1;google_apis_ps16k;x86_64'
# sdkmanager has no revision selector for these package IDs. Fail closed if
# upstream stable revisions drift rather than silently using a different SDK.
for pin in 'cmdline-tools/22.0=22.0' 'platform-tools=37.0.1' 'emulator=37.2.12' \
  'platforms/android-37.0=2' 'platforms/android-37.1=1' \
  'build-tools/36.0.0=36.0.0' 'build-tools/37.0.0=37.0.0' \
  'ndk/27.1.12297006=27.1.12297006' 'cmake/3.22.1=3.22.1' \
  'system-images/android-37.1/google_apis_ps16k/x86_64=9'; do
  path=${pin%=*}; version=${pin#*=}
  if ! grep -Eq "^Pkg.Revision[[:space:]]*=[[:space:]]*${version//./\\.}[[:space:]]*$" "$ANDROID_HOME/$path/source.properties"; then
    echo "SDK revision drift: $path must be $version; inspect upstream before changing pins" >&2
    exit 1
  fi
done
printf 'Pinned SDK installed at %s\n' "$ANDROID_HOME"
