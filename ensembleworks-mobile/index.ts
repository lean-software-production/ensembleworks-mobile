import { registerRootComponent } from 'expo';
import { registerGlobals } from '@livekit/react-native';
import App from './App';

// Install native WebRTC globals before any room is created.
registerGlobals();
registerRootComponent(App);
