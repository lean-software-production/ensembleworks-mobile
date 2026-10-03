import type { ComponentType } from 'react';
import { Button, FlatList, StyleSheet, Text, View } from 'react-native';
import type { JoinApplication, JoinState } from '../application/joinApplication';
import type { Participant } from '../application/ports';

// Native compositions resolve the participant's SDK track here. Linux/demo
// compositions explicitly inject a test representation, never a native camera.
export type ParticipantVideoProps = { participant: Participant };
export type ParticipantVideoRenderer = ComponentType<ParticipantVideoProps>;
export function DemoParticipantVideo({ participant }: ParticipantVideoProps) {
  return <View style={styles.video} testID={`video-${participant.id}`}>
    <Text style={styles.text}>Test video — {participant.name}</Text>
  </View>;
}

export function CallScreen({ state, application, VideoRenderer }: {
  state: JoinState;
  application: JoinApplication;
  VideoRenderer: ParticipantVideoRenderer;
}) {
  return <View style={styles.screen}>
    <Text accessibilityRole="header" style={styles.text}>Room team</Text>
    {!(state.participants ?? []).some(p => !p.local) &&
      <Text style={styles.text}>You’re the only person here. Waiting for teammates.</Text>}
    <FlatList data={state.participants ?? []} numColumns={2} keyExtractor={p => p.id}
      renderItem={({ item }) => <View style={styles.tile} testID={`participant-${item.id}`}>
        {item.cameraEnabled ? <VideoRenderer participant={item} /> :
          <View style={styles.video}><Text style={styles.text}>{item.name} — Camera off</Text></View>}
        <Text style={styles.text}>{item.name}{item.local ? ' (You)' : ''}</Text>
      </View>} />
    <Button title={state.microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
      accessibilityLabel={state.microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
      disabled={state.controlsPending} onPress={() => void application.toggleMicrophone()} />
    <Button title={state.cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
      disabled={state.controlsPending} onPress={() => void application.toggleCamera()} />
    <Button title="Leave" onPress={() => void application.leave()} />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, gap: 12 },
  tile: { flex: 1, margin: 4, padding: 8, backgroundColor: '#243249', borderRadius: 8 },
  video: { minHeight: 140, justifyContent: 'center', alignItems: 'center', backgroundColor: '#34445e' },
  text: { color: '#ffffff', fontSize: 16, padding: 4 },
});
