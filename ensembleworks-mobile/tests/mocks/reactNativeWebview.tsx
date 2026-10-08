import { View } from 'react-native';

// Native WebView is exercised in the simulator; component tests only need its
// boundary to render without requiring the iOS TurboModule.
export const WebView = (props: React.ComponentProps<typeof View>) => <View {...props} />;
