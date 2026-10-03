// Application contracts contain no React Native, Cloudflare, or LiveKit imports.
export type Unsubscribe = () => void;
export type Session = { kind: 'demo'; id: string } | { kind: 'authenticated'; id: string };
export interface AuthenticationPort {
  current(): Promise<Session | null>;
  signIn(): Promise<Session>;
  subscribe(listener: (session: Session | null) => void): Unsubscribe;
}
export interface Identity { participantId: string; displayName: string }
export interface IdentityStoragePort {
  load(): Promise<Identity | null>;
  save(identity: Identity): Promise<void>;
}
export type Permission = 'granted' | 'denied';
export interface PermissionsPort {
  request(): Promise<{ microphone: Permission; camera: Permission }>;
}
export interface TokenRequest { room: 'team'; identity: string; name: string; session: Session }
export type TokenResult = { enabled: false } | { enabled: true; token: string; url: string };
export interface TokenPort { retrieve(request: TokenRequest): Promise<TokenResult> }
export interface Participant {
  id: string;
  name: string;
  local: boolean;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  // Native rendering resolves the SDK track separately by participant ID.
}
export type RoomEvent =
  | { type: 'participants'; participants: Participant[] }
  | { type: 'disconnected'; reason?: string }
  | { type: 'error'; message: string };
export interface RoomPort {
  join(input: { token: string; url: string; autoSubscribe: true }): Promise<void>;
  setMicrophone(enabled: boolean): Promise<void>;
  setCamera(enabled: boolean): Promise<void>;
  setRemoteAudioGain(participantId: string, gain: number): void;
  subscribe(listener: (event: RoomEvent) => void): Unsubscribe;
  // Includes disconnecting, releasing local media, and stopping the audio session.
  leave(): Promise<void>;
}
export interface ApplicationPorts {
  authentication: AuthenticationPort;
  tokens: TokenPort;
  identity: IdentityStoragePort;
  permissions: PermissionsPort;
  room: RoomPort;
}
export type FailureCode = 'authentication-required' | 'authentication-unresolved' | 'network' | 'invalid-response';
export class AdapterError extends Error {
  constructor(public readonly code: FailureCode, message: string) { super(message); this.name = 'AdapterError'; }
}
