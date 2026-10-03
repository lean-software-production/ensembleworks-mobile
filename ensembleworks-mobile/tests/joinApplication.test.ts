import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTestAdapters } from '../src/adapters/testAdapters';
import { PersistentIdentity, type KeyValueStorage } from '../src/adapters/persistentIdentity';
import { JoinApplication } from '../src/application/joinApplication';

function setup(id = 'mobile-unique-001') {
  const ports = createTestAdapters();
  const app = new JoinApplication(ports, () => id);
  return { ports, app };
}

test('first launch signs in, waits for a valid name, persists an independent ID and immediately joins team', async () => {
  const { ports, app } = setup();
  const phases: string[] = [];
  app.subscribe(state => phases.push(state.phase));
  await app.start();
  assert.equal(ports.authentication.session?.kind, 'demo');
  assert.equal(app.snapshot.phase, 'needs-name');
  assert.equal(ports.permissions.requests, 0);
  await app.submitDisplayName('   ');
  assert.equal(app.snapshot.phase, 'needs-name');
  assert.match(app.snapshot.message!, /display name/);
  assert.equal(await ports.identity.load(), null);
  await app.submitDisplayName('  Alex  ');
  assert.deepEqual(await ports.identity.load(), { participantId: 'mobile-unique-001', displayName: 'Alex' });
  assert.deepEqual(ports.tokens.requests, [{ room: 'team', identity: 'mobile-unique-001', name: 'Alex', session: ports.authentication.session }]);
  assert.equal(ports.permissions.requests, 1);
  assert.deepEqual(ports.room.operations, [
    { operation: 'join', value: { token: ports.tokens.result.enabled && ports.tokens.result.token, url: 'wss://demo.invalid', autoSubscribe: true } },
    { operation: 'microphone', value: true }, { operation: 'camera', value: true },
  ]);
  assert.equal(app.snapshot.phase, 'joined');
  assert.deepEqual(phases, ['signing-in', 'needs-name', 'needs-name', 'joining', 'joining', 'joined']);
});

test('permission resolution precedes token retrieval, connection and publications; duplicate submissions are ignored', async () => {
  const { ports, app } = setup();
  let grant!: (value: Awaited<ReturnType<typeof ports.permissions.request>>) => void;
  ports.permissions.request = () => new Promise(resolve => { grant = resolve; });
  await app.start();
  const joining = app.submitDisplayName('Alex');
  await Promise.resolve();
  await app.submitDisplayName('Someone else');
  assert.equal(app.snapshot.phase, 'joining');
  assert.equal(ports.tokens.requests.length, 0);
  assert.equal(ports.room.operations.length, 0);
  grant({ microphone: 'granted', camera: 'granted' });
  await joining;
  assert.equal(app.snapshot.phase, 'joined');
  assert.equal(ports.tokens.requests.length, 1);
  await app.start();
  assert.equal(ports.tokens.requests.length, 1);
});

for (const permission of ['microphone', 'camera'] as const) {
  test(`${permission} denial persists the name but does not retrieve a token or join`, async () => {
    const { ports, app } = setup();
    ports.permissions.result[permission] = 'denied';
    await app.start();
    await app.submitDisplayName('Alex');
    assert.equal(app.snapshot.phase, 'failed');
    assert.match(app.snapshot.message!, /permission/);
    assert.equal((await ports.identity.load())?.displayName, 'Alex');
    assert.equal(ports.tokens.requests.length, 0);
    assert.equal(ports.room.operations.length, 0);
  });
}

test('two people with identical names receive different mobile identities', async () => {
  const a = setup('mobile-a'); const b = setup('mobile-b');
  for (const { app } of [a, b]) { await app.start(); await app.submitDisplayName('Alex'); }
  assert.notEqual(a.ports.tokens.requests[0].identity, b.ports.tokens.requests[0].identity);
  assert.equal(a.ports.tokens.requests[0].name, b.ports.tokens.requests[0].name);
});

function storageDouble(): KeyValueStorage {
  const data = new Map<string, string>();
  return { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } };
}

test('serialized identity survives a new adapter/application; valid sessions are reused and expired sessions sign in', async () => {
  const storage = storageDouble();
  const ports = createTestAdapters();
  const firstPorts = { ...ports, identity: new PersistentIdentity(storage) };
  const first = new JoinApplication(firstPorts, () => 'mobile-persisted');
  await first.start(); await first.submitDisplayName('林');
  const session = ports.authentication.session;
  let signIns = 0;
  const signIn = ports.authentication.signIn.bind(ports.authentication);
  ports.authentication.signIn = async () => { signIns++; return signIn(); };
  const relaunch = () => new JoinApplication({ ...ports, identity: new PersistentIdentity(storage) }, () => { throw new Error('Must reuse ID'); });
  const second = relaunch(); await second.start();
  assert.equal(second.snapshot.phase, 'joined');
  assert.equal(signIns, 0);
  assert.equal(ports.tokens.requests[1].session, session);
  ports.authentication.expire();
  const third = relaunch(); await third.start();
  assert.equal(signIns, 1);
  assert.equal(third.snapshot.phase, 'joined');
  assert.deepEqual(ports.tokens.requests.map(r => [r.identity, r.name]), Array(3).fill(['mobile-persisted', '林']));
});

test('disabled media and token errors never report joined or start media', async () => {
  for (const failure of ['disabled', 'network']) {
    const { ports, app } = setup();
    if (failure === 'disabled') ports.tokens.result = { enabled: false };
    else ports.tokens.error = new Error('offline');
    await app.start(); await app.submitDisplayName('Alex');
    assert.equal(app.snapshot.phase, 'failed');
    assert.equal(ports.room.operations.length, 0);
  }
});

test('failed connection or initial publication cleans up instead of reporting success', async () => {
  for (const failure of ['join', 'microphone', 'camera']) {
    const { ports, app } = setup();
    if (failure === 'join') ports.room.joinError = new Error('cannot connect');
    if (failure === 'microphone') ports.room.setMicrophone = async () => { throw new Error('publish failed'); };
    if (failure === 'camera') ports.room.setCamera = async () => { throw new Error('publish failed'); };
    await app.start(); await app.submitDisplayName('Alex');
    assert.equal(app.snapshot.phase, 'failed');
    assert.equal(ports.room.connected, false);
    assert.equal(ports.room.audioSessionActive, false);
    assert.deepEqual(ports.room.operations.slice(-3).map(o => o.operation), ['disconnect', 'releaseMedia', 'stopAudioSession']);
  }
});

test('sign-in and storage failures do not request permissions or use unsaved identities', async () => {
  const { ports, app } = setup();
  ports.authentication.signInError = new Error('canceled');
  await app.start();
  assert.equal(app.snapshot.phase, 'failed');
  assert.equal(ports.permissions.requests, 0);
  const other = setup();
  other.ports.identity.save = async () => { throw new Error('disk full'); };
  await other.app.start(); await other.app.submitDisplayName('Alex');
  assert.equal(other.app.snapshot.phase, 'failed');
  assert.equal(other.ports.permissions.requests, 0);
});

test('persistent adapter checks actual JSON and propagates storage errors', async () => {
  for (const raw of ['not JSON', '{}', 'null', '{"participantId":"","displayName":"Alex"}', '{"participantId":"id","displayName":4}']) {
    const adapter = new PersistentIdentity({ getItem: async () => raw, setItem: async () => {} });
    await assert.rejects(adapter.load());
  }
  const adapter = new PersistentIdentity({ getItem: async () => { throw new Error('unavailable'); }, setItem: async () => { throw new Error('full'); } });
  await assert.rejects(adapter.load(), /unavailable/);
  await assert.rejects(adapter.save({ participantId: 'id', displayName: 'Alex' }), /full/);
});
