import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdapterError, type TokenRequest, type RoomEvent } from '../src/application/ports';
import { HttpTokenAdapter, type HttpResponse } from '../src/adapters/httpTokens';
import { createTestAdapters } from '../src/adapters/testAdapters';
import { createComposition, UnresolvedAccessAuthentication } from '../src/application/composition';
import { tokenResponses } from './fixtures/tokenResponses';

const request: TokenRequest = { room: 'team', identity: 'mobile-001', name: 'A & B / 林', session: { kind: 'authenticated', id: 'local-session-handle' } };
function response(fixture: { status: number; body: string; redirected?: boolean; contentType?: string }): HttpResponse {
  return { status: fixture.status, redirected: fixture.redirected ?? false,
    headers: { get: () => fixture.contentType ?? 'application/json' }, text: async () => fixture.body };
}
function hasCode(code: AdapterError['code']) {
  return (error: unknown) => error instanceof AdapterError && error.code === code;
}
test('HTTP adapter requests logical team with separately encoded ID/name and parses real JSON', async () => {
  const calls: Array<{ url: string; session: TokenRequest['session'] }> = [];
  const adapter = new HttpTokenAdapter('https://canvas.example/ignored', { get: async (url, session) => {
    calls.push({ url, session }); return response(tokenResponses.success);
  } });
  assert.deepEqual(await adapter.retrieve(request), { enabled: true, token: 'signed-fixture-token', url: 'wss://canvas.example/livekit' });
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/api/av/token');
  assert.deepEqual(Object.fromEntries(url.searchParams), { room: 'team', identity: 'mobile-001', name: request.name });
  assert.equal(calls[0].session, request.session);
  assert.ok(!calls[0].url.includes(request.session.id));
});
test('disabled media stays disabled, not a successful join', async () => {
  const adapter = new HttpTokenAdapter('https://canvas.example', { get: async () => response(tokenResponses.disabled) });
  assert.deepEqual(await adapter.retrieve(request), { enabled: false });
});
for (const key of ['redirect', 'followedRedirect', 'loginHtml'] as const) {
  test(`Access ${key} requires sign-in`, async () => {
    const adapter = new HttpTokenAdapter('https://canvas.example', { get: async () => response(tokenResponses[key]) });
    await assert.rejects(adapter.retrieve(request), hasCode('authentication-required'));
  });
}
for (const status of [401, 403]) {
  test(`HTTP ${status} requires sign-in`, async () => {
    const adapter = new HttpTokenAdapter('https://canvas.example', { get: async () => response({ status, body: '{}' }) });
    await assert.rejects(adapter.retrieve(request), hasCode('authentication-required'));
  });
}
for (const key of ['malformedJson', 'missingToken'] as const) {
  test(`${key} is an invalid contract`, async () => {
    const adapter = new HttpTokenAdapter('https://canvas.example', { get: async () => response(tokenResponses[key]) });
    await assert.rejects(adapter.retrieve(request), hasCode('invalid-response'));
  });
}
test('rejects malformed contracts and insecure signaling URLs', async () => {
  for (const data of [null, [], {}, { enabled: 'true' }, { enabled: true, token: '', url: 'wss://host' },
    { enabled: true, token: 'secret', url: 'ws://host' }, { enabled: true, token: 'secret', url: 'not a url' }]) {
    const adapter = new HttpTokenAdapter('https://canvas.example', { get: async () => response({ status: 200, body: JSON.stringify(data) }) });
    await assert.rejects(adapter.retrieve(request), hasCode('invalid-response'));
  }
});
test('network, response-body failure, and server errors are actionable and redact secrets', async () => {
  for (const get of [async () => { throw new Error('secret-cookie'); },
    async () => ({ ...response(tokenResponses.success), text: async () => { throw new Error('secret-token'); } }),
    async () => response(tokenResponses.unavailable)]) {
    const adapter = new HttpTokenAdapter('https://canvas.example', { get });
    await assert.rejects(adapter.retrieve(request), error => hasCode('network')(error) && !String(error).includes('secret'));
  }
});
test('fake sessions are rejected before any transport call; insecure backend configuration rejected', async () => {
  let calls = 0;
  const adapter = new HttpTokenAdapter('https://canvas.example', { get: async () => { calls++; return response(tokenResponses.success); } });
  await assert.rejects(adapter.retrieve({ ...request, session: { kind: 'demo', id: 'fake' } }), hasCode('authentication-required'));
  assert.equal(calls, 0);
  assert.throws(() => new HttpTokenAdapter('http://canvas.example', { get: async () => response(tokenResponses.success) }));
});
test('test auth simulates sign-in, reusable session, expiry, failure and unsubscription', async () => {
  const { authentication } = createTestAdapters();
  const events: unknown[] = [];
  assert.equal(await authentication.current(), null);
  const unsubscribe = authentication.subscribe(session => events.push(session));
  const session = await authentication.signIn();
  assert.equal(session.kind, 'demo');
  assert.deepEqual(await authentication.current(), session);
  authentication.expire();
  assert.equal(await authentication.current(), null);
  assert.deepEqual(events, [session, null]);
  unsubscribe();
  await authentication.signIn();
  assert.equal(events.length, 2);
  authentication.signInError = new Error('sign-in canceled');
  await assert.rejects(authentication.signIn(), /canceled/);
});
test('identity storage is independent of name and survives adapter reuse without object aliasing', async () => {
  const { identity } = createTestAdapters();
  assert.equal(await identity.load(), null);
  const value = { participantId: 'mobile-002', displayName: 'Alex' };
  await identity.save(value);
  value.displayName = 'Changed';
  const saved = (await identity.load())!;
  assert.deepEqual(saved, { participantId: 'mobile-002', displayName: 'Alex' });
  saved.participantId = 'Changed';
  assert.equal((await identity.load())!.participantId, 'mobile-002');
});
test('test permission and token adapters simulate denial, disabled media and failures', async () => {
  const { permissions, tokens } = createTestAdapters();
  assert.deepEqual(await permissions.request(), { microphone: 'granted', camera: 'granted' });
  permissions.result.camera = 'denied';
  assert.equal((await permissions.request()).camera, 'denied');
  assert.equal(permissions.requests, 2);
  tokens.result = { enabled: false };
  assert.deepEqual(await tokens.retrieve(request), { enabled: false });
  assert.deepEqual(tokens.requests, [request]);
  tokens.error = new Error('offline');
  await assert.rejects(tokens.retrieve(request), /offline/);
});
test('room double models publication, participant changes, gain, disconnect and cleanup', async () => {
  const { room } = createTestAdapters();
  const events: RoomEvent[] = [];
  const unsubscribe = room.subscribe(event => events.push(event));
  room.participants = [{ id: 'teammate', name: 'Alex', local: false, cameraEnabled: false, microphoneEnabled: true }];
  const input = { token: 'fixture', url: 'wss://demo.invalid', autoSubscribe: true as const };
  await room.join(input);
  assert.deepEqual(events[0], { type: 'participants', participants: room.participants });
  await room.setMicrophone(true); await room.setCamera(true);
  await room.setMicrophone(false); await room.setCamera(false);
  room.setRemoteAudioGain('teammate', 1);
  room.emit({ type: 'participants', participants: [] });
  room.emit({ type: 'disconnected', reason: 'network' });
  room.emit({ type: 'error', message: 'connection failed' });
  assert.equal(events.length, 4);
  unsubscribe();
  await room.leave();
  room.emit({ type: 'participants', participants: room.participants });
  assert.equal(events.length, 4);
  assert.equal(room.subscriptionCount, 0);
  assert.equal(room.connected, false);
  assert.equal(room.audioSessionActive, false);
  assert.equal(room.microphoneEnabled, false);
  assert.equal(room.cameraEnabled, false);
  assert.deepEqual(room.operations, [
    { operation: 'join', value: input }, { operation: 'microphone', value: true }, { operation: 'camera', value: true },
    { operation: 'microphone', value: false }, { operation: 'camera', value: false },
    { operation: 'audioGain', value: { participantId: 'teammate', gain: 1 } },
    { operation: 'disconnect' }, { operation: 'releaseMedia' }, { operation: 'stopAudioSession' },
  ]);
  room.joinError = new Error('cannot connect');
  await assert.rejects(room.join(input), /cannot connect/);
  assert.equal(room.connected, false);
});
test('composition only selects test adapters explicitly and never falls back', async () => {
  assert.equal(createComposition('production').ports, null);
  const injected = createTestAdapters();
  assert.equal(createComposition('production', injected).ports, injected);
  const demo = createComposition('demo');
  assert.match(demo.label, /TEST ADAPTER MODE/);
  assert.notEqual(demo.ports, createComposition('demo').ports);
  const unresolved = new UnresolvedAccessAuthentication();
  assert.equal(await unresolved.current(), null);
  await assert.rejects(unresolved.signIn(), hasCode('authentication-unresolved'));
});
