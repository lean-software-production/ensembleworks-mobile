import { render, screen, waitFor } from '@testing-library/react-native';
import { AdapterError, type TokenPort } from '../src/application/ports';
import { TokenIntegrationStatus } from '../src/components/TokenIntegrationStatus';

test('integration view exposes authenticated status and room names without token details', async () => {
  const tokens: TokenPort = { retrieve: jest.fn(async () => ({ enabled: true, token: 'secret-token', url: 'wss://secret.example' })) };
  render(<TokenIntegrationStatus session={{ kind: 'authenticated', id: 'local-session' }} tokens={tokens} onSessionExpired={() => {}} />);
  await screen.findByText('Actual room: canvas-team');
  expect(screen.getByText('Authenticated native session.')).toBeTruthy();
  expect(screen.getByText('Logical room: team')).toBeTruthy();
  expect(screen.queryByText(/secret-token|secret.example/)).toBeNull();
});

test('authentication-required token response returns the integration view to sign-in', async () => {
  const onSessionExpired = jest.fn();
  const tokens: TokenPort = { retrieve: jest.fn(async () => { throw new AdapterError('authentication-required', 'login page'); }) };
  render(<TokenIntegrationStatus session={{ kind: 'authenticated', id: 'local-session' }} tokens={tokens} onSessionExpired={onSessionExpired} />);
  await screen.findByText('Session expired. Sign in again to check the room.');
  await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));
});
