import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CloudflareAccessAuthentication, deploymentConfiguration, NativeCookieTransport, type AccessSessionStore, type NativeResponse } from '../src/adapters/cloudflareAccess';
import { AdapterError } from '../src/application/ports';

class Store implements AccessSessionStore {
  value = false;
  saved: string[] = [];
  cleared: string[] = [];
  async load() { return this.value; }
  async save(host: string) { this.value = true; this.saved.push(host); }
  async clear(host: string) { this.value = false; this.cleared.push(host); }
}
const configured = deploymentConfiguration('https://canvas.example.test/a-path')!;
const response = (status: number, redirected = false): NativeResponse => ({
  status, redirected, headers: { get: () => 'text/html' }, text: async () => '<html>deployment page</html>',
});

test('native transport delegates opaque cookie handling to fetch for session and token HTTP', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: unknown; options: unknown }> = [];
  const nativeResponse = response(200);
  globalThis.fetch = (async (url, options) => {
    calls.push({ url, options });
    return nativeResponse;
  }) as typeof fetch;
  try {
    const transport = new NativeCookieTransport();
    for (const url of [configured.baseUrl, `${configured.baseUrl}/api/av/token`]) {
      assert.equal(await transport.get(url), nativeResponse);
    }
    assert.deepEqual(calls, [configured.baseUrl, `${configured.baseUrl}/api/av/token`].map(url => ({
      url, options: { credentials: 'include', redirect: 'manual' },
    })));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a deployment must be explicitly configured as an HTTPS origin', () => {
  assert.equal(deploymentConfiguration(undefined), null);
  assert.equal(deploymentConfiguration('http://canvas.example.test'), null);
  assert.equal(deploymentConfiguration('not a url'), null);
  assert.deepEqual(configured, { baseUrl: 'https://canvas.example.test', host: 'canvas.example.test' });
});

test('sign-in resolves only after an authenticated native request, not after loading web content', async () => {
  const store = new Store();
  let nativeRequests = 0;
  const authentication = new CloudflareAccessAuthentication(configured, { get: async () => {
    nativeRequests++; return response(200);
  } }, store);
  const signingIn = authentication.signIn();
  assert.equal(nativeRequests, 0);
  assert.equal(await authentication.completeSignIn(), 'authenticated');
  assert.deepEqual(await signingIn, { kind: 'authenticated', id: 'access-session:canvas.example.test' });
  assert.equal(nativeRequests, 1);
  assert.deepEqual(store.saved, ['canvas.example.test']);
});

test('a deferred native check from a cancelled attempt cannot authenticate a later attempt', async () => {
  const store = new Store();
  let resolveFirst!: (value: NativeResponse) => void;
  let requests = 0;
  const authentication = new CloudflareAccessAuthentication(configured, { get: async () => {
    requests++;
    if (requests === 1) return await new Promise<NativeResponse>(resolve => { resolveFirst = resolve; });
    return response(200);
  } }, store);

  const firstSignIn = authentication.signIn();
  const firstCheck = authentication.completeSignIn();
  await Promise.resolve();
  await Promise.resolve();
  await authentication.cancelSignIn();
  await assert.rejects(firstSignIn, /cancelled/);

  const secondSignIn = authentication.signIn();
  const secondCheck = authentication.completeSignIn();
  resolveFirst(response(200));

  assert.equal(await firstCheck, 'verification-unavailable');
  assert.equal(await secondCheck, 'authenticated');
  assert.deepEqual(await secondSignIn, { kind: 'authenticated', id: 'access-session:canvas.example.test' });
  assert.equal(requests, 2);
  assert.deepEqual(store.saved, ['canvas.example.test']);
});

test('a rejected session-marker save rejects that attempt and allows another sign-in', async () => {
  const store = new Store();
  let failSave = true;
  store.save = async function(host: string) {
    this.saved.push(host);
    if (failSave) { failSave = false; throw new Error('disk unavailable'); }
    this.value = true;
  };
  const authentication = new CloudflareAccessAuthentication(configured, { get: async () => response(200) }, store);

  const failedSignIn = authentication.signIn();
  assert.equal(await authentication.completeSignIn(), 'verification-unavailable');
  await assert.rejects(failedSignIn, (error: unknown) => error instanceof AdapterError && error.code === 'authentication-required');
  assert.deepEqual(store.cleared, ['canvas.example.test']);

  const retry = authentication.signIn();
  assert.equal(await authentication.completeSignIn(), 'authenticated');
  assert.deepEqual(await retry, { kind: 'authenticated', id: 'access-session:canvas.example.test' });
});

test('an Access redirect during a new sign-in leaves the WebView flow pending until native confirmation succeeds', async () => {
  const store = new Store();
  let requests = 0;
  const authentication = new CloudflareAccessAuthentication(configured, { get: async () =>
    response(++requests === 1 ? 302 : 200, requests === 1),
  }, store);

  const signingIn = authentication.signIn();
  assert.equal(await authentication.completeSignIn(), 'awaiting-sign-in');
  assert.equal(store.cleared.length, 0);

  assert.equal(await authentication.completeSignIn(), 'authenticated');
  assert.deepEqual(await signingIn, { kind: 'authenticated', id: 'access-session:canvas.example.test' });
  assert.deepEqual(store.saved, ['canvas.example.test']);
});

test('a native verification failure tells the view that connection retry is needed', async () => {
  const store = new Store();
  const authentication = new CloudflareAccessAuthentication(configured, { get: async () => { throw new Error('offline'); } }, store);

  authentication.signIn();
  assert.equal(await authentication.completeSignIn(), 'verification-unavailable');
  assert.equal(store.cleared.length, 0);
});

test('cancelling while a session-marker save is deferred clears that marker before a retry', async () => {
  const store = new Store();
  let resolveSave!: () => void;
  let signalSaveStarted!: () => void;
  let saveStarted = new Promise<void>(resolve => { signalSaveStarted = resolve; });
  store.save = async function(host: string) {
    this.saved.push(host);
    signalSaveStarted();
    await new Promise<void>(resolve => { resolveSave = resolve; });
    this.value = true;
  };
  const authentication = new CloudflareAccessAuthentication(configured, { get: async () => response(200) }, store);

  const first = authentication.signIn();
  const firstCheck = authentication.completeSignIn();
  await saveStarted;
  await authentication.cancelSignIn();
  const rejected = assert.rejects(first, /cancelled/);
  resolveSave();
  assert.equal(await firstCheck, 'verification-unavailable');
  await rejected;

  const retry = authentication.signIn();
  saveStarted = new Promise<void>(resolve => { signalSaveStarted = resolve; });
  const retryCheck = authentication.completeSignIn();
  await saveStarted;
  resolveSave();
  assert.equal(await retryCheck, 'authenticated');
  await retry;
  assert.equal(store.value, true);
});

test('a deferred failed-attempt clear retains ownership until it cannot erase a retry', async () => {
  const store = new Store();
  let rejectSave = true;
  let resolveClear!: () => void;
  let signalClearStarted!: () => void;
  const clearStarted = new Promise<void>(resolve => { signalClearStarted = resolve; });
  store.save = async function(host: string) {
    this.saved.push(host);
    if (rejectSave) { rejectSave = false; throw new Error('disk unavailable'); }
    this.value = true;
  };
  store.clear = async function(host: string) {
    this.cleared.push(host);
    signalClearStarted();
    await new Promise<void>(resolve => { resolveClear = resolve; });
    this.value = false;
  };
  const authentication = new CloudflareAccessAuthentication(configured, { get: async () => response(200) }, store);

  const failed = authentication.signIn();
  const failedCheck = authentication.completeSignIn();
  await clearStarted;
  // The old attempt still owns cleanup, so this is not a new attempt that it can erase.
  assert.strictEqual(authentication.signIn(), failed);
  resolveClear();
  assert.equal(await failedCheck, 'verification-unavailable');
  await assert.rejects(failed, /Unable to save/);

  const retry = authentication.signIn();
  const retryCheck = authentication.completeSignIn();
  // The clear above is complete before this save is allowed to begin.
  assert.equal(await retryCheck, 'authenticated');
  await retry;
  assert.equal(store.value, true);
});

test('a confirmed native session is reused after relaunch', async () => {
  const store = new Store(); store.value = true;
  const authentication = new CloudflareAccessAuthentication(configured, { get: async () => response(200) }, store);
  assert.deepEqual(await authentication.current(), { kind: 'authenticated', id: 'access-session:canvas.example.test' });
});

test('an Access redirect clears the stored session and does not authenticate', async () => {
  const store = new Store(); store.value = true;
  const events: Array<string | null> = [];
  const authentication = new CloudflareAccessAuthentication(configured, { get: async () => response(302, true) }, store);
  authentication.subscribe(session => events.push(session?.id ?? null));
  assert.equal(await authentication.current(), null);
  assert.deepEqual(store.cleared, ['canvas.example.test']);
  assert.deepEqual(events, [null]);
});

test('network failures do not claim a session or erase a session without expiry evidence', async () => {
  const store = new Store(); store.value = true;
  const authentication = new CloudflareAccessAuthentication(configured, { get: async () => { throw new Error('offline'); } }, store);
  assert.equal(await authentication.current(), null);
  assert.equal(store.value, true);
});
