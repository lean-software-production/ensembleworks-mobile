import { act, fireEvent, render, screen } from '@testing-library/react-native';

const session = { kind: 'authenticated' as const, id: 'access-session:canvas.example.test' };

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}) }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'subscription-test-id') }));
jest.mock('../src/adapters/cloudflareAccess', () => {
  let instance: any;
  class Authentication {
    deployment = { baseUrl: 'https://canvas.example.test', host: 'canvas.example.test' };
    listeners = new Set<any>();
    current = jest.fn(async () => ({ kind: 'authenticated', id: 'access-session:canvas.example.test' }));
    signIn = jest.fn(async () => ({ kind: 'authenticated', id: 'access-session:canvas.example.test' }));
    completeSignIn = jest.fn(async () => 'authenticated');
    cancelSignIn = jest.fn(async () => {});
    expireSession = jest.fn(async () => {});
    subscribe(listener: any) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    emit(mockValue: any) { for (const listener of this.listeners) listener(mockValue); }
  }
  return {
    deploymentConfiguration: () => ({ baseUrl: 'https://canvas.example.test', host: 'canvas.example.test' }),
    CloudflareAccessAuthentication: class extends Authentication { constructor() { super(); instance = this; } },
    NativeCookieTransport: class {},
    PersistentAccessSessionStore: class {},
    HttpTokenAdapter: class { retrieve = jest.fn(async () => ({ enabled: false })); },
    authentication: () => instance,
  };
});

process.env.EXPO_PUBLIC_APP_MODE = 'production';
const App = require('../App').default;
const { authentication } = jest.requireMock('../src/adapters/cloudflareAccess') as { authentication: () => { emit(value: typeof session | null): void; signIn: jest.Mock } };

test('authentication expiry returns App to sign-in and retry uses the authentication owner', async () => {
  render(<App />);
  await screen.findByText('Authenticated native session.');

  await act(async () => authentication().emit(null));

  expect(screen.getByText('Session expired. Sign in again to check the room.')).toBeTruthy();
  expect(screen.getByText('Sign in with GitHub')).toBeTruthy();
  expect(screen.queryByText('Authenticated native session.')).toBeNull();

  await act(async () => fireEvent.press(screen.getByText('Sign in with GitHub')));
  expect(authentication().signIn).toHaveBeenCalledTimes(1);
});

test('an expired production session hides application retry until Access sign-in publishes a session', async () => {
  render(<App />);
  await screen.findByText('Authenticated native session.');

  await act(async () => fireEvent.press(screen.getByText('Join room')));
  await screen.findByLabelText('Display name');
  await act(async () => authentication().emit(null));

  expect(screen.getByText(/Your session expired/)).toBeTruthy();
  expect(screen.getByText('Sign in with GitHub')).toBeTruthy();
  expect(screen.queryByText('Retry / sign in again')).toBeNull();

  await act(async () => authentication().emit(session));

  expect(screen.getByText('Retry / sign in again')).toBeTruthy();
});
