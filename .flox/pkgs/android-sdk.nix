# Build with: flox activate -d .. -- flox build -d .. android-sdk
# Explicit import keeps SDK metadata/archive hashes independent of catalog drift.
{ }:
let
  pkgs = import (builtins.fetchTarball {
    url = "https://github.com/flox/nixpkgs/archive/151fa4e8ddfdd8dd25d945ad94ed54a13de9f6e4.tar.gz";
    sha256 = "0rm5v6n0kgqq5xrc34imn8nxx0y2xlmhpa0nag9sk6m6ys9slaij";
  }) {
    system = "x86_64-linux";
    config = {
      android_sdk.accept_license = true;
      # Only the composed SDK and the exact upstream archives it consumes.
      allowUnfreePredicate = p:
        pkgs.lib.hasPrefix "android-sdk-" (pkgs.lib.getName p) || builtins.elem p.name [
          "androidsdk"
          "sdk-tools-linux-4333796.zip"
          "commandlinetools-linux-15859902_latest.zip"
          "platform-tools_r37.0.1-linux.zip"
          "platform-37.1_r01.zip"
          "build-tools_r37_linux.zip"
          "build-tools_r36_linux.zip"
          "android-ndk-r27b-linux.zip"
          "cmake-3.22.1-linux.zip"
          "emulator-linux_x64-15917651.zip"
          "x86_64-ps16k-37.1_r08.zip"
        ];
    };
  };
in
(pkgs.androidenv.composeAndroidPackages {
  toolsVersion = "26.1.1";
  cmdLineToolsVersion = "22.0";
  platformToolsVersion = "37.0.1";
  platformVersions = [ "37.1" ];
  # Expo's own Android module also requests 36.0.0 (observed release failure).
  buildToolsVersions = [ "37.0.0" "36.0.0" ];
  includeNDK = true;
  ndkVersions = [ "27.1.12297006" ];
  cmakeVersions = [ "3.22.1" ];
  includeEmulator = true;
  emulatorVersion = "37.1.11"; # Stable; 37.2.4 uses the preview license.
  includeSystemImages = true;
  systemImageTypes = [ "google_apis_ps16k" ];
  abiVersions = [ "x86_64" ]; # Latest stable API 37.1 Google APIs revision 8.
  includeSources = false;
}).androidsdk
