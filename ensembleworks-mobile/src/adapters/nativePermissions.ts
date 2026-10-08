import type { PermissionsPort } from '../application/ports';

// Supply `permissions` from @livekit/react-native-webrtc in the native
// composition; demo mode must never invoke this boundary.
export interface NativePermissionBoundary {
  request(descriptor: { name: 'microphone' | 'camera' }): Promise<boolean>;
  // iOS simulators have no video input. Detect that before asking LiveKit to
  // create a camera track, while still allowing an audio-only call.
  enumerateDevices?(): Promise<Array<{ kind?: string }>>;
}
export class NativePermissionsAdapter implements PermissionsPort {
  constructor(private native: NativePermissionBoundary) {}
  async request(): Promise<Awaited<ReturnType<PermissionsPort['request']>>> {
    const microphone = await this.native.request({ name: 'microphone' });
    if (microphone !== true) return { microphone: 'denied', camera: 'denied' };
    if (this.native.enumerateDevices) {
      const devices = await this.native.enumerateDevices();
      if (!devices.some(device => device.kind === 'videoinput')) {
        return { microphone: 'granted', camera: 'unavailable' };
      }
    }
    const camera = await this.native.request({ name: 'camera' });
    return { microphone: 'granted', camera: camera === true ? 'granted' : 'denied' };
  }
}
