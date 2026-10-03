import type { ComponentProps } from 'react';
import { Text } from 'react-native';
import { VideoTrack } from '@livekit/react-native';
import type { ParticipantVideoProps, ParticipantVideoRenderer } from './CallScreen';

// The native room composition supplies a resolver backed by its SDK room.
// Not selected by demo mode or unresolved production authentication.
export function createNativeParticipantVideo(
  resolveTrack: (participantId: string) => ComponentProps<typeof VideoTrack>['trackRef'],
): ParticipantVideoRenderer {
  return function NativeParticipantVideo({ participant }: ParticipantVideoProps) {
    const trackRef = resolveTrack(participant.id);
    return trackRef ? <VideoTrack trackRef={trackRef} mirror={participant.local}
      objectFit="cover" style={{ width: '100%', height: 140 }} /> :
      <Text>Waiting for {participant.name}'s video</Text>;
  };
}
