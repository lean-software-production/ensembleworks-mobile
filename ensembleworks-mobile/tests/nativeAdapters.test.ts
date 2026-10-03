import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { RoomEvent as SDKEvent } from 'livekit-client';
import { LiveKitRoomAdapter, type LiveKitBoundary } from '../src/adapters/liveKitRoom';
import { NativePermissionsAdapter } from '../src/adapters/nativePermissions';
import type { RoomEvent } from '../src/application/ports';

function setup() {
  const events = new EventEmitter();
  const operations: unknown[][] = [];
  const local = { identity: 'mobile-local', name: 'Alex', isCameraEnabled: true, isMicrophoneEnabled: true,
    setMicrophoneEnabled: async (enabled: boolean) => { operations.push(['microphone', enabled]); },
    setCameraEnabled: async (enabled: boolean) => { operations.push(['camera', enabled]); } };
  const remote = { identity: 'remote-id', name: 'Sam', isCameraEnabled: false, isMicrophoneEnabled: true,
    setVolume: (gain: number) => { operations.push(['volume', gain]); } };
  let connectionError: Error | null = null;
  let disconnectError: Error | null = null;
  // Only SDK members used by the adapter are modeled, not unrelated networking,
  // track internals or native rendering. No application decisions are mocked.
  const sdk = {
    localParticipant: local, remoteParticipants: new Map([[remote.identity, remote]]),
    on: events.on.bind(events), off: events.off.bind(events),
    connect: async (...args: unknown[]) => { operations.push(['connect', ...args]); if (connectionError) throw connectionError; },
    disconnect: async (stopTracks: boolean) => { operations.push(['disconnect', stopTracks]); if (disconnectError) throw disconnectError; },
  } as unknown as LiveKitBoundary;
  const adapter = new LiveKitRoomAdapter(sdk, {
    startAudioSession: async () => { operations.push(['startAudio']); },
    stopAudioSession: async () => { operations.push(['stopAudio']); },
  });
  return { adapter, sdk, events, operations, local, remote,
    failConnection: () => { connectionError = new Error('cannot connect'); },
    failDisconnect: () => { disconnectError = new Error('cannot disconnect'); } };
}

test('LiveKit boundary maps token connection, subscription, publications, equal gain and track cleanup', async () => {
  const { adapter, operations } = setup();
  await adapter.join({ token: 'runtime-token', url: 'wss://returned.example/livekit', autoSubscribe: true });
  await adapter.setMicrophone(true); await adapter.setMicrophone(false);
  await adapter.setCamera(true); await adapter.setCamera(false);
  adapter.setRemoteAudioGain('remote-id', 1);
  adapter.setRemoteAudioGain('missing', 1);
  await adapter.leave();
  assert.deepEqual(operations, [['startAudio'], ['connect', 'wss://returned.example/livekit', 'runtime-token', { autoSubscribe: true }],
    ['microphone', true], ['microphone', false], ['camera', true], ['camera', false], ['volume', 1],
    ['disconnect', true], ['stopAudio']]);
});

test('SDK events map snapshots, names, camera states, removals, failure and unsubscription', () => {
  const { adapter, events, sdk, local, remote } = setup();
  const received: RoomEvent[] = [];
  const unsubscribe = adapter.subscribe(event => received.push(event));
  events.emit(SDKEvent.Connected);
  assert.deepEqual(received[0], { type: 'participants', participants: [
    { id: 'mobile-local', name: 'Alex', local: true, cameraEnabled: true, microphoneEnabled: true },
    { id: 'remote-id', name: 'Sam', local: false, cameraEnabled: false, microphoneEnabled: true },
  ] });
  for (const event of [SDKEvent.ParticipantConnected, SDKEvent.ParticipantNameChanged, SDKEvent.TrackSubscribed,
    SDKEvent.TrackUnsubscribed, SDKEvent.TrackMuted, SDKEvent.TrackUnmuted,
    SDKEvent.LocalTrackPublished, SDKEvent.LocalTrackUnpublished]) {
    remote.name = 'Renamed'; remote.isCameraEnabled = true; local.isMicrophoneEnabled = false;
    events.emit(event);
    const latest = received.at(-1)!;
    assert.equal(latest.type, 'participants');
    if (latest.type === 'participants') {
      assert.equal(latest.participants[1].name, 'Renamed');
      assert.equal(latest.participants[1].cameraEnabled, true);
      assert.equal(latest.participants[0].microphoneEnabled, false);
    }
  }
  sdk.remoteParticipants.clear(); events.emit(SDKEvent.ParticipantDisconnected);
  assert.equal((received.at(-1) as Extract<RoomEvent, { type: 'participants' }>).participants.length, 1);
  events.emit(SDKEvent.Disconnected, 'sensitive-sdk-detail');
  events.emit(SDKEvent.MediaDevicesError, new Error('secret'));
  assert.deepEqual(received.slice(-2), [{ type: 'disconnected', reason: 'The media connection ended.' },
    { type: 'error', message: 'Unable to access media devices.' }]);
  const count = received.length;
  unsubscribe(); unsubscribe();
  assert.equal(events.eventNames().length, 0);
  events.emit(SDKEvent.ParticipantConnected); events.emit(SDKEvent.Disconnected);
  assert.equal(received.length, count);
});

test('SDK join errors propagate for application recovery; failed disconnect still stops audio', async () => {
  const { adapter, operations, failConnection, failDisconnect } = setup();
  failConnection();
  await assert.rejects(adapter.join({ token: 'fixture', url: 'wss://example', autoSubscribe: true }), /cannot connect/);
  failDisconnect();
  await assert.rejects(adapter.leave(), /cannot disconnect/);
  assert.deepEqual(operations.slice(-2), [['disconnect', true], ['stopAudio']]);
});

test('native permission boundary requests both capabilities and maps grants/denials without capture', async () => {
  for (const denied of ['microphone', 'camera', null]) {
    const calls: string[] = [];
    const adapter = new NativePermissionsAdapter({ request: async ({ name }) => { calls.push(name); return name !== denied; } });
    assert.deepEqual(await adapter.request(), { microphone: denied === 'microphone' ? 'denied' : 'granted', camera: denied === 'camera' ? 'denied' : 'granted' });
    assert.deepEqual(calls, ['microphone', 'camera']);
  }
  const adapter = new NativePermissionsAdapter({ request: async () => { throw new Error('native request failed'); } });
  await assert.rejects(adapter.request(), /native request failed/);
});
