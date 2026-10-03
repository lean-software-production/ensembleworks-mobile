import {
  type ApplicationPorts, type AuthenticationPort, type Identity, type IdentityStoragePort,
  type Participant, type PermissionsPort, type RoomEvent, type RoomPort, type Session,
  type TokenPort, type TokenRequest, type TokenResult,
} from '../application/ports';

export class MemoryAuthentication implements AuthenticationPort {
  session: Session | null = null;
  signInError: Error | null = null;
  private listeners = new Set<(session: Session | null) => void>();
  async current() { return this.session; }
  async signIn() {
    if (this.signInError) throw this.signInError;
    this.session = { kind: 'demo', id: 'demo-session' };
    this.emit();
    return this.session;
  }
  expire() { this.session = null; this.emit(); }
  subscribe(listener: (session: Session | null) => void) {
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }
  private emit() { for (const listener of this.listeners) listener(this.session); }
}
export class MemoryIdentity implements IdentityStoragePort {
  constructor(private value: Identity | null = null) {}
  async load() { return this.value ? { ...this.value } : null; }
  async save(identity: Identity) { this.value = { ...identity }; }
}
export class TestPermissions implements PermissionsPort {
  result: Awaited<ReturnType<PermissionsPort['request']>> = { microphone: 'granted', camera: 'granted' };
  requests = 0;
  async request() { this.requests++; return { ...this.result }; }
}
export class TestTokens implements TokenPort {
  requests: TokenRequest[] = [];
  result: TokenResult = { enabled: true, token: 'demo-token-not-for-production', url: 'wss://demo.invalid' };
  error: Error | null = null;
  async retrieve(request: TokenRequest) {
    this.requests.push({ ...request });
    if (this.error) throw this.error;
    return { ...this.result };
  }
}
export class TestRoom implements RoomPort {
  operations: Array<{ operation: string; value?: unknown }> = [];
  joinError: Error | null = null;
  participants: Participant[] = [];
  connected = false;
  microphoneEnabled = false;
  cameraEnabled = false;
  audioSessionActive = false;
  private listeners = new Set<(event: RoomEvent) => void>();
  get subscriptionCount() { return this.listeners.size; }
  async join(input: Parameters<RoomPort['join']>[0]) {
    this.operations.push({ operation: 'join', value: { ...input } });
    if (this.joinError) throw this.joinError;
    this.connected = true; this.audioSessionActive = true;
    this.emit({ type: 'participants', participants: this.participants.map(p => ({ ...p })) });
  }
  async setMicrophone(enabled: boolean) {
    this.operations.push({ operation: 'microphone', value: enabled }); this.microphoneEnabled = enabled;
  }
  async setCamera(enabled: boolean) {
    this.operations.push({ operation: 'camera', value: enabled }); this.cameraEnabled = enabled;
  }
  setRemoteAudioGain(participantId: string, gain: number) {
    this.operations.push({ operation: 'audioGain', value: { participantId, gain } });
  }
  subscribe(listener: (event: RoomEvent) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  emit(event: RoomEvent) { for (const listener of this.listeners) listener(event); }
  async leave() {
    this.operations.push({ operation: 'disconnect' }, { operation: 'releaseMedia' }, { operation: 'stopAudioSession' });
    this.connected = false; this.microphoneEnabled = false; this.cameraEnabled = false;
    this.audioSessionActive = false;
  }
}
export function createTestAdapters() {
  return {
    authentication: new MemoryAuthentication(), tokens: new TestTokens(), identity: new MemoryIdentity(),
    permissions: new TestPermissions(), room: new TestRoom(),
  } satisfies ApplicationPorts;
}
