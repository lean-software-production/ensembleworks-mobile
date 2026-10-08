import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AdapterError, type Session, type TokenPort } from '../application/ports';

// This deliberately displays only the room contract, never the returned token or URL.
export function TokenIntegrationStatus({ session, tokens, onSessionExpired }: {
  session: Session;
  tokens: TokenPort;
  onSessionExpired: () => void;
}) {
  const [status, setStatus] = useState<'checking' | 'ready' | 'unavailable' | 'expired'>('checking');
  useEffect(() => {
    let active = true;
    setStatus('checking');
    void tokens.retrieve({
      room: 'team', identity: 'mobile-integration-check', name: 'Mobile integration check', session,
    }).then(result => {
      if (active) setStatus(result.enabled ? 'ready' : 'unavailable');
    }, error => {
      if (!active) return;
      if (error instanceof AdapterError && error.code === 'authentication-required') {
        setStatus('expired');
        onSessionExpired();
      } else setStatus('unavailable');
    });
    return () => { active = false; };
  }, [session, tokens, onSessionExpired]);

  return <View>
    <Text>Authenticated native session.</Text>
    <Text>Logical room: team</Text>
    {status === 'checking' && <Text>Checking room integration…</Text>}
    {status === 'ready' && <Text>Actual room: canvas-team</Text>}
    {status === 'unavailable' && <Text>Room media is unavailable. Try again later.</Text>}
    {status === 'expired' && <Text>Session expired. Sign in again to check the room.</Text>}
  </View>;
}
