import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { WebView } from 'react-native-webview';
import { AccessSignIn } from '../src/components/AccessSignIn';
import type { CloudflareAccessAuthentication } from '../src/adapters/cloudflareAccess';

const deployment = { baseUrl: 'https://canvas.example.test', host: 'canvas.example.test' };

test('restores a valid native session when the sign-in view initializes', async () => {
  const authentication = {
    deployment,
    current: jest.fn(async () => ({ kind: 'authenticated', id: 'access-session:canvas.example.test' })),
  } as unknown as CloudflareAccessAuthentication;

  render(<AccessSignIn authentication={authentication} />);
  await screen.findByText('Authenticated native session restored. You can join the room.');

  expect(authentication.current).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Sign in with GitHub')).toBeNull();
});

test('an expired persisted session returns the sign-in view to interactive sign-in', async () => {
  const authentication = {
    deployment,
    current: jest.fn(async () => null),
    signIn: jest.fn(() => new Promise(() => {})),
  } as unknown as CloudflareAccessAuthentication;

  render(<AccessSignIn authentication={authentication} />);
  await screen.findByText('Sign in with GitHub');

  expect(authentication.current).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Authenticated native session restored. You can join the room.')).toBeNull();
});

test('token expiry invalidates restoration and presents sign-in without another native check', async () => {
  let resolveCurrent!: (session: { kind: 'authenticated'; id: string }) => void;
  const onAuthenticated = jest.fn();
  const authentication = {
    deployment,
    current: jest.fn(() => new Promise(resolve => { resolveCurrent = resolve; })),
  } as unknown as CloudflareAccessAuthentication;

  const view = render(<AccessSignIn authentication={authentication} onAuthenticated={onAuthenticated} />);
  view.rerender(<AccessSignIn authentication={authentication} onAuthenticated={onAuthenticated} signInRequired />);
  await act(async () => resolveCurrent({ kind: 'authenticated', id: 'access-session:canvas.example.test' }));

  expect(authentication.current).toHaveBeenCalledTimes(1);
  expect(onAuthenticated).not.toHaveBeenCalled();
  expect(screen.getByText('Session expired. Sign in again to check the room.')).toBeTruthy();
  expect(screen.getByText('Sign in with GitHub')).toBeTruthy();
});

test('an Access redirect leaves the WebView open until a later native confirmation completes sign-in', async () => {
  let resolveSignIn!: (session: { kind: 'authenticated'; id: string }) => void;
  let confirmations = 0;
  const authentication = {
    deployment: { baseUrl: 'https://canvas.example.test', host: 'canvas.example.test' },
    current: jest.fn(async () => null),
    signIn: jest.fn(() => new Promise(resolve => { resolveSignIn = resolve; })),

    completeSignIn: jest.fn(async () => {
      confirmations++;
      if (confirmations === 1) return 'awaiting-sign-in';
      resolveSignIn({ kind: 'authenticated', id: 'access-session:canvas.example.test' });
      return 'authenticated';
    }),
  } as unknown as CloudflareAccessAuthentication;

  const view = render(<AccessSignIn authentication={authentication} />);
  await act(async () => fireEvent.press(screen.getByText('Sign in with GitHub')));
  await act(async () => view.UNSAFE_getByType(WebView).props.onLoadEnd());
  expect(view.UNSAFE_getByType(WebView)).toBeTruthy();
  expect(screen.getByText('Complete GitHub sign-in in the page, then return here.')).toBeTruthy();

  await act(async () => view.UNSAFE_getByType(WebView).props.onNavigationStateChange());
  expect(authentication.completeSignIn).toHaveBeenCalledTimes(2);
  expect(view.UNSAFE_queryByType(WebView)).toBeNull();
  expect(screen.getByText('Signed in with the native session. You can join the room.')).toBeTruthy();
});

test('a native verification failure gives connection retry guidance rather than GitHub instructions', async () => {
  const authentication = {
    deployment: { baseUrl: 'https://canvas.example.test', host: 'canvas.example.test' },
    current: jest.fn(async () => null),
    signIn: jest.fn(() => new Promise(() => {})),
    completeSignIn: jest.fn(async () => 'verification-unavailable'),
  } as unknown as CloudflareAccessAuthentication;

  const view = render(<AccessSignIn authentication={authentication} />);
  await act(async () => fireEvent.press(screen.getByText('Sign in with GitHub')));
  await act(async () => view.UNSAFE_getByType(WebView).props.onLoadEnd());

  expect(screen.getByText('Unable to verify the native session. Check your connection and try again.')).toBeTruthy();
  expect(screen.queryByText('Complete GitHub sign-in in the page, then return here.')).toBeNull();
});

test('a rejected attempt closes the WebView and ignores its late native confirmation', async () => {
  let rejectSignIn!: (error: Error) => void;
  let resolveConfirmation!: (result: 'authenticated' | 'awaiting-sign-in' | 'verification-unavailable') => void;
  const authentication = {
    deployment: { baseUrl: 'https://canvas.example.test', host: 'canvas.example.test' },
    current: jest.fn(async () => null),
    signIn: jest.fn(() => new Promise((_, reject) => { rejectSignIn = reject; })),
    completeSignIn: jest.fn(() => new Promise<'authenticated' | 'awaiting-sign-in' | 'verification-unavailable'>(resolve => { resolveConfirmation = resolve; })),
  } as unknown as CloudflareAccessAuthentication;

  const view = render(<AccessSignIn authentication={authentication} />);
  await act(async () => fireEvent.press(screen.getByText('Sign in with GitHub')));
  await act(async () => view.UNSAFE_getByType(WebView).props.onLoadEnd());
  expect(authentication.completeSignIn).toHaveBeenCalledTimes(1);

  await act(async () => rejectSignIn(new Error('storage unavailable')));
  expect(view.UNSAFE_queryByType(WebView)).toBeNull();
  expect(screen.getByText('Sign in was not completed. Try again.')).toBeTruthy();

  await act(async () => resolveConfirmation('awaiting-sign-in'));
  expect(screen.queryByText('Complete GitHub sign-in in the page, then return here.')).toBeNull();
  expect(screen.getByText('Sign in was not completed. Try again.')).toBeTruthy();

  await act(async () => fireEvent.press(screen.getByText('Sign in with GitHub')));
  expect(authentication.signIn).toHaveBeenCalledTimes(2);
  expect(view.UNSAFE_getByType(WebView)).toBeTruthy();
});
