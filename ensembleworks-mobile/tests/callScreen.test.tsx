import { useEffect, useState } from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { JoinApplication } from '../src/application/joinApplication';
import { createTestAdapters } from '../src/adapters/testAdapters';
import { CallScreen, DemoParticipantVideo } from '../src/components/CallScreen';
import { createNativeParticipantVideo } from '../src/components/NativeParticipantVideo';

// Only native video drawing is replaced; application decisions use actual ports.
jest.mock('@livekit/react-native', () => ({
  VideoTrack: jest.fn(() => {
    const { Text } = require('react-native');
    return <Text>Native video surface</Text>;
  }),
}));

function Harness({ app }: { app: JoinApplication }) {
  const [state, setState] = useState(app.snapshot);
  useEffect(() => app.subscribe(setState), [app]);
  return state.phase === 'joined' ? <CallScreen state={state} application={app} VideoRenderer={DemoParticipantVideo} /> :
    <><Text>{state.phase}</Text><Button title="Rejoin room" onPress={() => void app.start()} /></>;
}
async function setup() {
  const ports = createTestAdapters();
  ports.room.participants = [
    { id: 'remote-video', name: 'Taylor', local: false, cameraEnabled: true, microphoneEnabled: true },
    { id: 'remote-off', name: 'Sam', local: false, cameraEnabled: false, microphoneEnabled: true },
  ];
  const app = new JoinApplication(ports, () => 'mobile-self');
  await app.start(); await app.submitDisplayName('Alex');
  render(<Harness app={app} />);
  return { app, ports };
}

test('grid renders remote video, self preview, names, and named camera-off placeholder', async () => {
  await setup();
  expect(screen.getByText('Alex (You)')).toBeTruthy();
  expect(screen.getByTestId('video-mobile-self')).toBeTruthy();
  expect(screen.getByText('Taylor')).toBeTruthy();
  expect(screen.getByTestId('video-remote-video')).toBeTruthy();
  expect(screen.getByText('Sam — Camera off')).toBeTruthy();
  expect(screen.queryByTestId('video-remote-off')).toBeNull();
});

test('microphone and camera controls update labels and self placeholder through publication operations', async () => {
  const { ports } = await setup();
  await act(async () => fireEvent.press(screen.getByText('Mute microphone')));
  expect(screen.getByText('Unmute microphone')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Unmute microphone')));
  await act(async () => fireEvent.press(screen.getByText('Turn camera off')));
  expect(screen.getByText('Alex — Camera off')).toBeTruthy();
  expect(screen.queryByTestId('video-mobile-self')).toBeNull();
  await act(async () => fireEvent.press(screen.getByText('Turn camera on')));
  expect(screen.getByTestId('video-mobile-self')).toBeTruthy();
  expect(ports.room.operations.slice(-4)).toEqual([
    { operation: 'microphone', value: false }, { operation: 'microphone', value: true },
    { operation: 'camera', value: false }, { operation: 'camera', value: true },
  ]);
});

test('participant events replace tiles; Leave clears call and Rejoin restores saved self', async () => {
  const { ports } = await setup();
  act(() => ports.room.emit({ type: 'participants', participants: [
    { id: 'new-peer', name: 'Jordan', local: false, cameraEnabled: false, microphoneEnabled: true },
  ] }));
  expect(screen.queryByText('Taylor')).toBeNull();
  expect(screen.queryByText('Sam')).toBeNull();
  expect(screen.getByText('Jordan — Camera off')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Leave')));
  expect(screen.queryByText('Room team')).toBeNull();
  expect(ports.room.subscriptionCount).toBe(0);
  await act(async () => fireEvent.press(screen.getByText('Rejoin room')));
  expect(screen.getByText('Alex (You)')).toBeTruthy();
  expect(ports.tokens.requests[1].identity).toBe('mobile-self');
});

test('empty room shows a waiting message without hiding self preview or controls', async () => {
  const { ports } = await setup();
  expect(screen.queryByText('You’re the only person here. Waiting for teammates.')).toBeNull();
  act(() => ports.room.emit({ type: 'participants', participants: [] }));
  expect(screen.getByText('You’re the only person here. Waiting for teammates.')).toBeTruthy();
  expect(screen.getByTestId('video-mobile-self')).toBeTruthy();
  expect(screen.getByText('Leave')).toBeTruthy();
});

test('native video renderer resolves SDK tracks by ID and mirrors only self', () => {
  const { VideoTrack } = require('@livekit/react-native');
  const track = { publication: { trackSid: 'camera-track' } };
  const resolve = jest.fn(() => track as never);
  const Video = createNativeParticipantVideo(resolve);
  const local = { id: 'self', name: 'Alex', local: true, cameraEnabled: true, microphoneEnabled: true };
  const view = render(<Video participant={local} />);
  expect(resolve).toHaveBeenCalledWith('self');
  expect(VideoTrack.mock.calls.at(-1)[0]).toMatchObject({ trackRef: track, mirror: true, objectFit: 'cover' });
  view.rerender(<Video participant={{ ...local, id: 'remote', local: false }} />);
  expect(VideoTrack.mock.calls.at(-1)[0].mirror).toBe(false);
  const WaitingVideo = createNativeParticipantVideo(() => undefined);
  view.unmount();
  render(<WaitingVideo participant={local} />);
  expect(screen.getByText("Waiting for Alex's video")).toBeTruthy();
});
