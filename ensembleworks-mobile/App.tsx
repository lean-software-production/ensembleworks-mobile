import { useCallback, useEffect, useState } from 'react';
import { Button, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { createComposition } from './src/application/composition';
import { JoinApplication } from './src/application/joinApplication';
import { type Session } from './src/application/ports';
import { PersistentIdentity } from './src/adapters/persistentIdentity';
import { CloudflareAccessAuthentication, deploymentConfiguration, NativeCookieTransport, PersistentAccessSessionStore } from './src/adapters/cloudflareAccess';
import { HttpTokenAdapter } from './src/adapters/httpTokens';
import { CallScreen, DemoParticipantVideo } from './src/components/CallScreen';
import { AccessSignIn } from './src/components/AccessSignIn';
import { TokenIntegrationStatus } from './src/components/TokenIntegrationStatus';

const mode = process.env.EXPO_PUBLIC_APP_MODE === 'demo' ? 'demo' : 'production';
const deployment = deploymentConfiguration();
const accessAuthentication = mode === 'production' && deployment ? new CloudflareAccessAuthentication(
  deployment, new NativeCookieTransport(), new PersistentAccessSessionStore(AsyncStorage),
) : null;
const productionTokens = accessAuthentication ? new HttpTokenAdapter(
  deployment!.baseUrl, new NativeCookieTransport(), () => accessAuthentication.expireSession(),
) : null;
const composition = createComposition(mode);
const application = composition.ports ? new JoinApplication(
  { ...composition.ports, identity: new PersistentIdentity(AsyncStorage) },
  () => `mobile-${randomUUID()}`,
) : null;

export default function App() {
  const [state, setState] = useState(application?.snapshot);
  const [name, setName] = useState('');
  const [authenticatedSession, setAuthenticatedSession] = useState<Session | null>(null);
  const [signInRequired, setSignInRequired] = useState(false);
  const sessionExpired = useCallback(() => {
    // Do not remount AccessSignIn: its initial native-session restoration would
    // turn a rejected token request into an automatic retry loop.
    setAuthenticatedSession(null);
    setSignInRequired(true);
  }, []);
  const authenticated = useCallback((session: Session) => {
    setAuthenticatedSession(session);
    setSignInRequired(false);
  }, []);
  useEffect(() => application?.subscribe(setState), []);
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>ensembleWorks Mobile</Text>
        <Text accessibilityRole="text" style={styles.body}>{composition.label}</Text>
        {!application && !accessAuthentication && <Text style={styles.body}>Production is unconfigured. Set EXPO_PUBLIC_DEPLOYMENT_URL to the HTTPS deployment URL.</Text>}
        {!application && accessAuthentication && <>
          <AccessSignIn authentication={accessAuthentication} onAuthenticated={authenticated} signInRequired={signInRequired} />
          {authenticatedSession && productionTokens && <TokenIntegrationStatus session={authenticatedSession}
            tokens={productionTokens} onSessionExpired={sessionExpired} />}
        </>}
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
        {state?.phase === 'failed' && <Button title="Retry / sign in again" onPress={() => void application?.start()} />}
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
