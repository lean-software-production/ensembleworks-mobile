import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import { createComposition } from '../src/application/composition';
import { createTestAdapters } from '../src/adapters/testAdapters';

jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map();
  return { getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { data.set(key, value); } };
});
jest.mock('expo-crypto', () => ({ randomUUID: () => 'ui-test-id' }));
jest.mock('../src/application/composition', () => {
  const { createTestAdapters } = require('../src/adapters/testAdapters');
  const composition = { label: 'Test-adapter mode', ports: createTestAdapters() };
  return { createComposition: () => composition };
});

test('joining, permission retry, connection retry and expired session are visible and actionable', async () => {
  const ports = createComposition('demo').ports as ReturnType<typeof createTestAdapters>;
  render(<App />);
  await act(async () => fireEvent.press(screen.getByText('Simulate sign-in and join')));
  fireEvent.changeText(screen.getByLabelText('Display name'), 'Alex');
  let grant!: (result: typeof ports.permissions.result) => void;
  ports.permissions.request = () => new Promise(resolve => { grant = resolve; });
  await act(async () => fireEvent.press(screen.getByText('Join room')));
  expect(screen.getByText('Joining…')).toBeTruthy();
  await act(async () => grant({ microphone: 'granted', camera: 'denied' }));
  expect(screen.getByText(/Enable them in Settings/)).toBeTruthy();
  ports.permissions.request = async () => ({ microphone: 'granted', camera: 'granted' });
  ports.tokens.error = new Error('offline');
  await act(async () => fireEvent.press(screen.getByText('Retry / sign in again')));
  expect(screen.getByText(/Check your connection and retry/)).toBeTruthy();
  ports.tokens.error = null;
  await act(async () => fireEvent.press(screen.getByText('Retry / sign in again')));
  expect(screen.getByText('Alex (You)')).toBeTruthy();
  expect(screen.getByText('You’re the only person here. Waiting for teammates.')).toBeTruthy();
  await act(async () => ports.authentication.expire());
  expect(screen.queryByText('Room team')).toBeNull();
  expect(screen.getByText(/Your session expired/)).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Retry / sign in again')));
  expect(screen.getByText('Room team')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Leave')));
  expect(screen.getByText('Rejoin room')).toBeTruthy();
});
