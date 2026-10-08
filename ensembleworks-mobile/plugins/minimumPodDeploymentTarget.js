const { withPodfile } = require('expo/config-plugins');

const MINIMUM = '15.1';
const MARKER = '# Raise pod deployment targets';
const POST_INSTALL = /post_install do \|installer\|\n/;

// Some pods (AsyncStorage's resource bundle, for one) still declare iOS 13.4,
// which current Xcode refuses to build. Prebuild regenerates ios/, so the
// Podfile change lives here rather than in the generated project.
const SNIPPET = `    ${MARKER} below ${MINIMUM}; current Xcode rejects older ones.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_configuration|
        current = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current && Gem::Version.new(current) < Gem::Version.new('${MINIMUM}')
          build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MINIMUM}'
        end
      end
    end
`;

module.exports = function withMinimumPodDeploymentTarget(config) {
  return withPodfile(config, (podfileConfig) => {
    const { contents } = podfileConfig.modResults;
    if (contents.includes(MARKER)) return podfileConfig;
    if (!POST_INSTALL.test(contents)) {
      throw new Error('minimumPodDeploymentTarget: no post_install block in the generated Podfile');
    }
    podfileConfig.modResults.contents = contents.replace(POST_INSTALL, (match) => match + SNIPPET);
    return podfileConfig;
  });
};
