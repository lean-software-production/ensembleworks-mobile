import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { CloudflareAccessAuthentication } from '../adapters/cloudflareAccess';
import type { Session } from '../application/ports';

export function AccessSignIn({ authentication, onAuthenticated, signInRequired = false }: {
  authentication: CloudflareAccessAuthentication;
  onAuthenticated?: (session: Session) => void;
  // Token expiry is terminal for the displayed session. This is deliberately
  // separate from initialization, which is the only time current() is called.
  signInRequired?: boolean;
}) {
  const [showWebView, setShowWebView] = useState(false);
  const [restored, setRestored] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // This ref advances synchronously, unlike React state. It protects only text
  // presentation; verification ownership and serialization live in the adapter.
  const viewAttempt = useRef(0);
  useEffect(() => {
    if (!signInRequired) return;
    // Invalidate an initial restoration check as well as WebView callbacks.
    ++viewAttempt.current;
    setRestored(false);
    setShowWebView(false);
    setMessage('Session expired. Sign in again to check the room.');
  }, [signInRequired]);
  useEffect(() => {
    if (signInRequired) return;
    const attempt = ++viewAttempt.current;
    void authentication.current().then(
      session => {
        if (viewAttempt.current === attempt && session) {
          setRestored(true);
          onAuthenticated?.(session);
          setMessage('Authenticated native session restored. Room setup is not installed yet.');
        }
      },
      () => {
        if (viewAttempt.current === attempt) setMessage('Unable to restore the saved session. Please sign in again.');
      },
    );
    return () => { if (viewAttempt.current === attempt) ++viewAttempt.current; };
  }, [authentication]);
  const begin = () => {
    const attempt = ++viewAttempt.current;
    setRestored(false);
    setMessage(null);
    setShowWebView(true);
    void authentication.signIn().then(
      session => {
        if (viewAttempt.current === attempt) {
          setShowWebView(false);
          onAuthenticated?.(session);
          setMessage('Signed in with the native session. Room setup is not installed yet.');
        }
      },
      () => {
        if (viewAttempt.current === attempt) {
          // A failed adapter attempt is terminal. Invalidate any WebView callback
          // already in flight before returning to a real, fresh sign-in action.
          ++viewAttempt.current;
          setShowWebView(false);
          setMessage('Sign in was not completed. Try again.');
        }
      },
    );
  };
  const confirmFromNative = () => {
    const attempt = viewAttempt.current;
    void authentication.completeSignIn().then(
      result => {
        if (viewAttempt.current !== attempt) return;
        if (result === 'awaiting-sign-in') {
          setMessage('Complete GitHub sign-in in the page, then return here.');
        } else if (result === 'verification-unavailable') {
          setMessage('Unable to verify the native session. Check your connection and try again.');
        }
      },
      () => { if (viewAttempt.current === attempt) setMessage('Sign in was not completed. Try again.'); },
    );
  };
  if (!showWebView) return <View style={styles.section}>
    <Text style={styles.body}>Sign in to the configured ensembleWorks deployment to continue.</Text>
    {!restored && <Button title="Sign in with GitHub" onPress={begin} />}
    {message && <Text accessibilityRole="alert" style={styles.body}>{message}</Text>}
  </View>;
  return <View style={styles.webContainer}>
    <Text style={styles.body}>Complete the normal Cloudflare Access sign-in.</Text>
    <WebView source={{ uri: authentication.deployment.baseUrl }} sharedCookiesEnabled
      onLoadEnd={confirmFromNative} onNavigationStateChange={confirmFromNative}
      onError={() => setMessage('Unable to load sign-in. Check your connection and try again.')} />
    <Button title="Cancel sign-in" onPress={() => {
      ++viewAttempt.current;
      void authentication.cancelSignIn();
      setShowWebView(false);
    }} />
    {message && <Text accessibilityRole="alert" style={styles.body}>{message}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 16 },
  webContainer: { flex: 1, gap: 12 },
  body: { color: '#d1d5db', fontSize: 17, lineHeight: 26 },
});
