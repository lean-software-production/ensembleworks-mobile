const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// JNI_OnLoad looks up these relocated Java classes by their original names.
const rules = '\n# LiveKit WebRTC JNI name-based lookup (Android release startup)\n-keep class livekit.org.webrtc.** { *; }\n-keep class livekit.org.jni_zero.** { *; }\n';

module.exports = function withLiveKitJniKeepRules(config) {
  return withDangerousMod(config, ['android', async (config) => {
    const file = path.join(config.modRequest.platformProjectRoot, 'app/proguard-rules.pro');
    const existing = await fs.readFile(file, 'utf8');
    if (!existing.includes(rules.trim())) await fs.writeFile(file, existing + rules);
    return config;
  }]);
};
