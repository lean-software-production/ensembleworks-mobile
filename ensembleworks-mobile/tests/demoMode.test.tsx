import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map();
  return { getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { data.set(key, value); } };
});
jest.mock('expo-crypto', () => ({ randomUUID: () => 'demo-ui-id' }));

// Exercise the real entry-point selection and composition, not a blanket mock.
process.env.EXPO_PUBLIC_APP_MODE = 'demo';
const App = require('../App').default;

test('explicit demo stays visibly labeled through sign-in, grid, controls, leave and rejoin', async () => {
  render(<App />);
  const label = () => expect(screen.getByText(/TEST ADAPTER MODE — no real media or backend/)).toBeTruthy();
  label();
  await act(async () => fireEvent.press(screen.getByText('Simulate sign-in and join')));
  fireEvent.changeText(screen.getByLabelText('Display name'), 'Mobile Alex');
  await act(async () => fireEvent.press(screen.getByText('Join room')));
  label();
  expect(screen.getByText('Mobile Alex (You)')).toBeTruthy();
  expect(screen.getByText('Alex')).toBeTruthy();
  expect(screen.getByText('Sam')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Mute microphone')));
  expect(screen.getByText('Unmute microphone')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Turn camera off')));
  expect(screen.getByText('Turn camera on')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Leave')));
  label();
  expect(screen.queryByText('Room team')).toBeNull();
  await act(async () => fireEvent.press(screen.getByText('Rejoin room')));
  expect(screen.queryByLabelText('Display name')).toBeNull();
  expect(screen.getByText('Mobile Alex (You)')).toBeTruthy();
  label();
  await act(async () => fireEvent.press(screen.getByText('Leave')));
});
