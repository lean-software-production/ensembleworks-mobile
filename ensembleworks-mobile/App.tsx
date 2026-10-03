import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

import { createComposition } from './src/application/composition';

const composition = createComposition(process.env.EXPO_PUBLIC_APP_MODE === 'demo' ? 'demo' : 'production');

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>ensembleWorks Mobile</Text>
        <Text style={styles.body}>Native development build ready.</Text>
        <Text accessibilityRole="text" style={styles.body}>{composition.label}</Text>
        <Text style={styles.body}>
          Cloudflare sign-in and iPhone signaling verification are the next integration milestone.
          This scaffold does not join a room or access your camera or microphone.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101827' },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { color: '#ffffff', fontSize: 28, fontWeight: '600' },
  body: { color: '#d1d5db', fontSize: 17, lineHeight: 26 },
});
