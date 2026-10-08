module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.tsx'],
  moduleNameMapper: { '^react-native-webview$': '<rootDir>/tests/mocks/reactNativeWebview.tsx' },
};
