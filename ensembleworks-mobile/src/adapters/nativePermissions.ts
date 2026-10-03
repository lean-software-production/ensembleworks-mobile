import type { PermissionsPort } from '../application/ports';

// Supply `permissions` from @livekit/react-native-webrtc in the native
// composition; demo mode must never invoke this boundary.
export interface NativePermissionBoundary {
  request(descriptor: { name: 'microphone' | 'camera' }): Promise<boolean>;
}
export class NativePermissionsAdapter implements PermissionsPort {
  constructor(private native: NativePermissionBoundary) {}
  async request(): Promise<Awaited<ReturnType<PermissionsPort['request']>>> {
    const microphone = await this.native.request({ name: 'microphone' });
    const camera = await this.native.request({ name: 'camera' });
    return { microphone: microphone === true ? 'granted' : 'denied', camera: camera === true ? 'granted' : 'denied' };
  }
}
