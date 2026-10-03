import { useEffect, useState } from 'react';
import { Button, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { createComposition } from './src/application/composition';
import { JoinApplication } from './src/application/joinApplication';
import { PersistentIdentity } from './src/adapters/persistentIdentity';
import { CallScreen, DemoParticipantVideo } from './src/components/CallScreen';

const composition = createComposition(process.env.EXPO_PUBLIC_APP_MODE === 'demo' ? 'demo' : 'production');
const application = composition.ports ? new JoinApplication(
  { ...composition.ports, identity: new PersistentIdentity(AsyncStorage) },
  () => `mobile-${randomUUID()}`,
) : null;

export default function App() {
  const [state, setState] = useState(application?.snapshot);
  const [name, setName] = useState('');
  useEffect(() => application?.subscribe(setState), []);
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>ensembleWorks Mobile</Text>
        <Text accessibilityRole="text" style={styles.body}>{composition.label}</Text>
        {!application && <Text style={styles.body}>Native Cloudflare sign-in remains unresolved for iteration 002.</Text>}
        {state?.phase === 'idle' && <Button title={state.identity ? 'Rejoin room' : 'Simulate sign-in and join'} onPress={() => void application?.start()} />}
        {state?.phase === 'needs-name' && <>
          <Text style={styles.body}>Choose a display name. It will be remembered on this device.</Text>
          <TextInput accessibilityLabel="Display name" value={name} onChangeText={setName}
            style={styles.input} autoCapitalize="words" />
          <Button title="Join room" onPress={() => void application?.submitDisplayName(name)} />
        </>}
        {(state?.phase === 'signing-in' || state?.phase === 'joining') && <Text style={styles.body}>{state.phase === 'signing-in' ? 'Signing in…' : 'Joining…'}</Text>}
        {state?.phase === 'joined' && application && <CallScreen state={state} application={application}
          VideoRenderer={DemoParticipantVideo} />}
        {state?.phase === 'leaving' && <Text style={styles.body}>Leaving…</Text>}
        {state?.message && <Text accessibilityRole="alert" style={styles.body}>{state.message}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101827' },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { color: '#ffffff', fontSize: 28, fontWeight: '600' },
  body: { color: '#d1d5db', fontSize: 17, lineHeight: 26 },
  input: { backgroundColor: '#ffffff', color: '#101827', padding: 12, borderRadius: 6 },
});
