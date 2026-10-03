import { render, screen } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

// A typo must not silently opt a production build into simulated success.
process.env.EXPO_PUBLIC_APP_MODE = 'Demo';
const App = require('../App').default;

test('unresolved production is visible and never offers simulated joining', () => {
  render(<App />);
  expect(screen.getByText(/Native Cloudflare sign-in remains unresolved/)).toBeTruthy();
  expect(screen.queryByText(/TEST ADAPTER MODE/)).toBeNull();
  expect(screen.queryByText('Simulate sign-in and join')).toBeNull();
  expect(screen.queryByText('Room team')).toBeNull();
});
