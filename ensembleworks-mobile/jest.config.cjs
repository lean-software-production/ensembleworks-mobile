module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.tsx'],
  moduleNameMapper: {
    '^react-native-webview$': '<rootDir>/tests/mocks/reactNativeWebview.tsx',
    '^@livekit/react-native$': '<rootDir>/tests/mocks/livekitReactNative.tsx',
    '^@livekit/react-native-webrtc$': '<rootDir>/tests/mocks/livekitWebrtc.ts',
  },
};
