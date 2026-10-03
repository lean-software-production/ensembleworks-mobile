import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JoinApplication } from '../src/application/joinApplication';
import { AdapterError, type RoomEvent } from '../src/application/ports';
import { createTestAdapters } from '../src/adapters/testAdapters';

async function setup() {
  const ports = createTestAdapters();
  const app = new JoinApplication(ports, () => 'mobile-recovery');
  await app.start();
  return { ports, app };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

for (const failure of ['permission', 'disabled', 'network', 'connection']) {
  test(`${failure} is actionable and retry rejoins with saved identity`, async () => {
    const { ports, app } = await setup();
    if (failure === 'permission') ports.permissions.result.camera = 'denied';
    if (failure === 'disabled') ports.tokens.result = { enabled: false };
    if (failure === 'network') ports.tokens.error = new Error('offline');
    if (failure === 'connection') ports.room.joinError = new Error('offline');
    await app.submitDisplayName('Alex');
    assert.equal(app.snapshot.phase, 'failed');
    assert.match(app.snapshot.message!, /retry|Try again/);
    ports.permissions.result.camera = 'granted';
    ports.tokens.result = { enabled: true, token: 'test', url: 'wss://demo.invalid' };
    ports.tokens.error = ports.room.joinError = null;
    await app.start();
    assert.equal(app.snapshot.phase, 'joined');
    assert.equal(app.snapshot.identity?.participantId, 'mobile-recovery');
    assert.equal(ports.room.subscriptionCount, 1);
  });
}

for (const type of ['disconnected', 'error', 'expiry'] as const) {
  test(`${type} ends the call, clears tiles, cleans media, ignores late events, and allows retry`, async () => {
    const { ports, app } = await setup();
    let late!: (event: RoomEvent) => void;
    const subscribe = ports.room.subscribe.bind(ports.room);
    ports.room.subscribe = listener => { late = listener; return subscribe(listener); };
    await app.submitDisplayName('Alex');
    if (type === 'expiry') ports.authentication.expire();
    else ports.room.emit(type === 'error' ? { type, message: 'SDK failed' } : { type });
    await settle();
    assert.equal(app.snapshot.phase, 'failed');
    assert.equal(app.snapshot.participants, undefined);
    assert.equal(ports.room.subscriptionCount, 0);
    assert.equal(ports.room.connected, false);
    assert.equal(ports.room.audioSessionActive, false);
    late({ type: 'participants', participants: [] });
    assert.equal(app.snapshot.phase, 'failed');
    await app.start();
    assert.equal(app.snapshot.phase, 'joined');
  });
}

test('expiry while permissions are pending cannot use a stale token or join', async () => {
  const { ports, app } = await setup();
  let grant!: (result: typeof ports.permissions.result) => void;
  ports.permissions.request = () => new Promise(resolve => { grant = resolve; });
  const joining = app.submitDisplayName('Alex');
  await Promise.resolve();
  ports.authentication.expire();
  grant({ camera: 'granted', microphone: 'granted' });
  await joining;
  assert.equal(app.snapshot.phase, 'failed');
  assert.match(app.snapshot.message!, /expired/);
  assert.equal(ports.tokens.requests.length, 0);
  assert.equal(ports.room.connected, false);
});

test('disconnect during join cannot publish media or report a successful join', async () => {
  const { ports, app } = await setup();
  ports.room.join = async () => {
    ports.room.connected = true;
    ports.room.emit({ type: 'disconnected' });
  };
  await app.submitDisplayName('Alex');
  assert.equal(app.snapshot.phase, 'failed');
  assert.equal(ports.room.subscriptionCount, 0);
  assert.equal(ports.room.connected, false);
  assert.equal(ports.room.operations.some(o => o.operation === 'microphone'), false);
});

test('expiry waits for an in-flight publication before releasing media and audio', async () => {
  const { ports, app } = await setup();
  await app.submitDisplayName('Alex');
  let publish!: () => void;
  ports.room.setCamera = () => new Promise(resolve => { publish = resolve; });
  const toggling = app.toggleCamera();
  ports.authentication.expire();
  assert.equal(app.snapshot.phase, 'leaving');
  assert.equal(ports.room.subscriptionCount, 0);
  publish();
  await toggling; await settle();
  assert.equal(app.snapshot.phase, 'failed');
  assert.equal(app.snapshot.participants, undefined);
  assert.deepEqual(ports.room.operations.slice(-3).map(o => o.operation), ['disconnect', 'releaseMedia', 'stopAudioSession']);
});

test('Access rejection forces a new sign-in rather than reusing a cached session', async () => {
  const { ports, app } = await setup();
  ports.tokens.error = new AdapterError('authentication-required', 'Access login');
  await app.submitDisplayName('Alex');
  assert.match(app.snapshot.message!, /expired/);
  let signIns = 0;
  const signIn = ports.authentication.signIn.bind(ports.authentication);
  ports.authentication.signIn = async () => { signIns++; return signIn(); };
  ports.tokens.error = null;
  await app.start();
  assert.equal(signIns, 1);
  assert.equal(app.snapshot.phase, 'joined');
});

for (const trigger of ['leave', 'failed join', 'disconnect', 'expiry'] as const) {
  test(`${trigger}: cleanup failure is reported and blocks authentication and rejoin until recovered`, async () => {
    const { ports, app } = await setup();
    const leave = ports.room.leave.bind(ports.room);
    ports.room.leave = async () => { throw new Error('cleanup failed'); };
    if (trigger === 'failed join') ports.room.joinError = new Error('connection failed');
    await app.submitDisplayName('Alex');
    if (trigger === 'leave') await app.leave();
    if (trigger === 'disconnect') ports.room.emit({ type: 'disconnected' });
    if (trigger === 'expiry') ports.authentication.expire();
    await settle();
    assert.equal(app.snapshot.phase, 'failed');
    assert.match(app.snapshot.message!, /Media cleanup failed/);
    assert.equal(ports.room.subscriptionCount, 0);

    const operations: string[] = [];
    const current = ports.authentication.current.bind(ports.authentication);
    const signIn = ports.authentication.signIn.bind(ports.authentication);
    const load = ports.identity.load.bind(ports.identity);
    ports.authentication.current = async () => { operations.push('current'); return current(); };
    ports.authentication.signIn = async () => { operations.push('signIn'); return signIn(); };
    ports.identity.load = async () => { operations.push('identity'); return load(); };
    await app.start();
    assert.equal(app.snapshot.phase, 'failed');
    assert.match(app.snapshot.message!, /Media cleanup failed/);
    assert.doesNotMatch(app.snapshot.message!, /Unable to sign in/);
    assert.equal(operations.length, 0);
    assert.equal(ports.tokens.requests.length, 1);

    ports.room.leave = async () => { operations.push('cleanup'); await leave(); };
    ports.room.joinError = null;
    await app.start();
    assert.equal(operations[0], 'cleanup');
    assert.equal(app.snapshot.phase, 'joined');
    assert.equal(ports.tokens.requests.length, 2);
    assert.equal(ports.room.subscriptionCount, 1);
    if (trigger === 'expiry') assert.ok(operations.includes('signIn'));
  });
}
