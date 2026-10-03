import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JoinApplication } from '../src/application/joinApplication';
import { createTestAdapters } from '../src/adapters/testAdapters';
import type { Participant, RoomEvent } from '../src/application/ports';

const teammate = (id: string, cameraEnabled = true): Participant => ({
  id, name: 'Alex', local: false, cameraEnabled, microphoneEnabled: true,
});
async function setup() {
  const ports = createTestAdapters();
  ports.room.participants = [teammate('remote-a'), teammate('remote-b', false)];
  const app = new JoinApplication(ports, () => 'mobile-local');
  await app.start(); await app.submitDisplayName('Alex');
  return { app, ports };
}

test('grid includes independent local identity and remote names, with equal audio gain on join and updates', async () => {
  const { app, ports } = await setup();
  assert.deepEqual(app.snapshot.participants?.map(p => p.id), ['mobile-local', 'remote-a', 'remote-b']);
  assert.equal(app.snapshot.participants?.[0].local, true);
  assert.equal(app.snapshot.participants?.[2].cameraEnabled, false);
  assert.deepEqual(ports.room.operations.filter(o => o.operation === 'audioGain').map(o => o.value), [
    { participantId: 'remote-a', gain: 1 }, { participantId: 'remote-b', gain: 1 },
  ]);
  ports.room.emit({ type: 'participants', participants: [teammate('remote-c')] });
  assert.deepEqual(app.snapshot.participants?.map(p => p.id), ['mobile-local', 'remote-c']);
  assert.deepEqual(ports.room.operations.at(-1)?.value, { participantId: 'remote-c', gain: 1 });
  const snapshot = app.snapshot;
  snapshot.participants![0].name = 'tampered';
  assert.equal(app.snapshot.participants![0].name, 'Alex');
});

test('microphone/camera controls publish off/on and update local preview, not remote state', async () => {
  const { app, ports } = await setup();
  for (const toggle of [() => app.toggleMicrophone(), () => app.toggleCamera()]) { await toggle(); await toggle(); }
  assert.deepEqual(ports.room.operations.filter(o => o.operation === 'microphone' || o.operation === 'camera'), [
    { operation: 'microphone', value: true }, { operation: 'camera', value: true },
    { operation: 'microphone', value: false }, { operation: 'microphone', value: true },
    { operation: 'camera', value: false }, { operation: 'camera', value: true },
  ]);
  await app.toggleCamera();
  assert.equal(app.snapshot.cameraEnabled, false);
  assert.equal(app.snapshot.participants![0].cameraEnabled, false);
  assert.equal(app.snapshot.participants![1].cameraEnabled, true);
});

test('failed controls retain publication state and overlapping toggles are ignored', async () => {
  const { app, ports } = await setup();
  let reject!: (error: Error) => void;
  ports.room.setMicrophone = () => new Promise((_, fail) => { reject = fail; });
  const toggle = app.toggleMicrophone();
  assert.equal(app.snapshot.controlsPending, true);
  await app.toggleCamera();
  assert.equal(app.snapshot.cameraEnabled, true);
  reject(new Error('publish failed')); await toggle;
  assert.equal(app.snapshot.microphoneEnabled, true);
  assert.equal(app.snapshot.controlsPending, false);
  assert.match(app.snapshot.message!, /microphone/);
});

test('leave unsubscribes, releases media/audio, clears grid; stale events and pending controls cannot restore call; rejoin reuses identity', async () => {
  const { app, ports } = await setup();
  // Capture a listener as an SDK callback might already be queued before unsubscribe.
  let late!: (event: RoomEvent) => void;
  const subscribe = ports.room.subscribe.bind(ports.room);
  ports.room.subscribe = listener => { late = listener; return subscribe(listener); };
  await app.leave(); await app.start();
  let publish!: () => void;
  ports.room.setCamera = () => new Promise(resolve => { publish = resolve; });
  const toggle = app.toggleCamera();
  const leaving = app.leave();
  assert.equal(app.snapshot.phase, 'leaving');
  publish(); await toggle; await leaving;
  assert.equal(ports.room.subscriptionCount, 0);
  assert.equal(ports.room.audioSessionActive, false);
  assert.equal(ports.room.connected, false);
  assert.deepEqual(ports.room.operations.slice(-3).map(o => o.operation), ['disconnect', 'releaseMedia', 'stopAudioSession']);
  late({ type: 'participants', participants: [teammate('ghost')] });
  assert.equal(app.snapshot.phase, 'idle');
  const readState = () => app.snapshot;
  assert.equal(readState().participants, undefined);
  const previousCallEvent = late;
  ports.room.setCamera = async () => {};
  await app.start();
  previousCallEvent({ type: 'participants', participants: [teammate('ghost')] });
  assert.equal(app.snapshot.participants?.some(p => p.id === 'ghost'), false);
  late({ type: 'participants', participants: [teammate('new-peer')] });
  assert.equal(app.snapshot.phase, 'joined');
  assert.equal(ports.room.subscriptionCount, 1);
  assert.deepEqual(ports.tokens.requests.map(r => [r.identity, r.name]), Array(3).fill(['mobile-local', 'Alex']));
});
